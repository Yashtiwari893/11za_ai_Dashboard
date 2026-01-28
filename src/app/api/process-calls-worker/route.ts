import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import {
    transcribeAudio,
    detectBlank,
    classifySpam,
    classify11zaRelevance
} from "@/lib/callProcessing";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes (Vercel hobby plan limit)

type ProcessingRequest = {
    callId?: string;
    phoneNumber?: string;
    fileName?: string;
    bufferBase64?: string;
};

const BLANK_THRESHOLD = 50;
const SPAM_CONFIDENCE_THRESHOLD = 0.7;
const RELEVANCE_CONFIDENCE_THRESHOLD = 0.5;

export async function POST(req: Request) {
    try {
        const body: ProcessingRequest = await req.json();
        const { callId, bufferBase64 } = body;

        if (!callId) {
            return NextResponse.json({ error: "callId is required" }, { status: 400 });
        }

        // Retrieve the call recording
        const { data: callRecord, error: fetchError } = await supabase
            .from("call_recordings")
            .select("*")
            .eq("id", callId)
            .single();

        if (fetchError || !callRecord) {
            console.error("Call not found:", callId);
            return NextResponse.json({ error: "Call not found" }, { status: 404 });
        }

        try {
            // Decode audio buffer if provided, otherwise fetch from storage
            let audioBuffer: Buffer;
            if (bufferBase64) {
                audioBuffer = Buffer.from(bufferBase64, "base64");
            } else {
                // Fetch from storage using the file_url
                const response = await fetch(callRecord.file_url);
                audioBuffer = Buffer.from(await response.arrayBuffer());
            }

            await processCallRecording(callId, callRecord as CallRecord, audioBuffer);

            return NextResponse.json({ success: true, callId });
        } catch (processingError) {
            console.error("Processing error:", processingError);

            // Mark as failed
            await supabase
                .from("call_recordings")
                .update({
                    status: "failed",
                    error_reason: processingError instanceof Error ? processingError.message : "Unknown error",
                    processed_at: new Date().toISOString()
                })
                .eq("id", callId);

            return NextResponse.json(
                {
                    success: false,
                    callId,
                    error: processingError instanceof Error ? processingError.message : "Processing failed"
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error("Worker error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

type CallRecord = {
    id: string;
    phone_number: string;
    file_name: string;
    file_url: string;
    [key: string]: unknown;
};

async function processCallRecording(callId: string, callRecord: CallRecord, audioBuffer: Buffer) {
    try {
        // Step 1: Update status to transcribing
        await supabase
            .from("call_recordings")
            .update({ status: "transcribing" })
            .eq("id", callId);

        // Step 2: Transcribe audio
        console.log(`[${callId}] Transcribing audio...`);
        const transcript = await transcribeAudio(audioBuffer, callRecord.file_name);
        console.log(`[${callId}] Transcribed: ${transcript.length} characters`);

        // Step 3: Save transcript
        await supabase
            .from("call_transcripts")
            .insert([
                {
                    call_recording_id: callId,
                    transcript,
                    transcript_length: transcript.length,
                    language: "en"
                }
            ]);

        // Step 4: Check if blank
        const isBlank = detectBlank(transcript, BLANK_THRESHOLD);
        if (isBlank) {
            console.log(`[${callId}] Marked as BLANK`);
            await supabase
                .from("call_recordings")
                .update({
                    status: "blank",
                    processed_at: new Date().toISOString()
                })
                .eq("id", callId);

            await supabase
                .from("call_classifications")
                .insert([
                    {
                        call_recording_id: callId,
                        is_blank: true,
                        is_spam: false,
                        is_11za_related: false,
                        blank_confidence: 1.0,
                        spam_confidence: 0,
                        relevance_confidence: 0
                    }
                ]);

            return;
        }

        // Step 5: Classify spam
        console.log(`[${callId}] Classifying spam...`);
        await supabase
            .from("call_recordings")
            .update({ status: "classifying" })
            .eq("id", callId);

        const spamResult = await classifySpam(transcript);
        const isSpam = spamResult.isSpam && spamResult.confidence > SPAM_CONFIDENCE_THRESHOLD;

        if (isSpam) {
            console.log(`[${callId}] Marked as SPAM (confidence: ${spamResult.confidence})`);
            await supabase
                .from("call_recordings")
                .update({
                    status: "spam",
                    processed_at: new Date().toISOString()
                })
                .eq("id", callId);

            await supabase
                .from("call_classifications")
                .insert([
                    {
                        call_recording_id: callId,
                        is_blank: false,
                        is_spam: true,
                        is_11za_related: false,
                        blank_confidence: 0,
                        spam_confidence: spamResult.confidence,
                        relevance_confidence: 0
                    }
                ]);

            return;
        }

        // Step 6: Classify 11za relevance
        console.log(`[${callId}] Classifying 11za relevance...`);
        const relevanceResult = await classify11zaRelevance(transcript);
        const isRelated = relevanceResult.isRelated && relevanceResult.confidence > RELEVANCE_CONFIDENCE_THRESHOLD;

        // Save classification
        await supabase
            .from("call_classifications")
            .insert([
                {
                    call_recording_id: callId,
                    is_blank: false,
                    is_spam: false,
                    is_11za_related: isRelated,
                    blank_confidence: 0,
                    spam_confidence: spamResult.confidence,
                    relevance_confidence: relevanceResult.confidence
                }
            ]);

        if (!isRelated) {
            console.log(`[${callId}] Not 11za related (confidence: ${relevanceResult.confidence})`);
            await supabase
                .from("call_recordings")
                .update({
                    status: "not_relevant",
                    processed_at: new Date().toISOString()
                })
                .eq("id", callId);

            return;
        }

        // Step 7: Chunk transcript
        console.log(`[${callId}] Chunking transcript...`);
        await supabase
            .from("call_recordings")
            .update({ status: "chunking" })
            .eq("id", callId);

        const chunks = chunkText(transcript, 1600, 200);
        console.log(`[${callId}] Created ${chunks.length} chunks`);

        // Step 8: Generate embeddings and save to rag_chunks
        console.log(`[${callId}] Generating embeddings...`);
        const chunkRecords = await Promise.all(
            chunks.map(async (chunk, index) => {
                try {
                    const embedding = await embedText(chunk);
                    return {
                        file_id: null, // NULL for call source
                        chunk_index: index,
                        chunk_text: chunk,
                        embedding,
                        source_type: "call" as const,
                        source_id: callId
                    };
                } catch (error) {
                    console.error(`Error embedding chunk ${index}:`, error);
                    throw error;
                }
            })
        );

        // Batch insert chunks
        await supabase
            .from("rag_chunks")
            .insert(chunkRecords);

        console.log(`[${callId}] Processing COMPLETE`);
        await supabase
            .from("call_recordings")
            .update({
                status: "11za_related",
                processed_at: new Date().toISOString()
            })
            .eq("id", callId);

    } catch (error) {
        console.error(`[${callId}] Processing error:`, error);
        throw error;
    }
}
