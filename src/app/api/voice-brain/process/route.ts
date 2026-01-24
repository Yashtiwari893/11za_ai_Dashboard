import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { voiceBrainIngestion } from '@/lib/voice-brain/ingestion';
import { transcriptCleaner } from '@/lib/voice-brain/cleaner';
import { intentExtractor, intentClustering, embeddingGenerator } from '@/lib/voice-brain/intent-extraction';

// Process call recordings (batch)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { callIds, processType = 'full' } = body;

        if (!callIds || !Array.isArray(callIds)) {
            return NextResponse.json(
                { error: 'callIds array is required' },
                { status: 400 }
            );
        }

        console.log(`Starting ${processType} processing for ${callIds.length} calls`);

        // Get call records
        const { data: calls, error: fetchError } = await supabase
            .from('voice_calls')
            .select('*')
            .in('id', callIds)
            .eq('status', 'uploaded');

        if (fetchError || !calls) {
            return NextResponse.json(
                { error: 'Failed to fetch call records' },
                { status: 500 }
            );
        }

        const recordings = calls.map(call => ({
            id: call.id,
            phoneNumber: call.phone_number,
            audioUrl: call.audio_url,
            duration: call.duration_seconds,
            language: call.language
        }));

        const results = {
            ingestion: { success: 0, failed: 0 },
            cleaning: { success: 0, failed: 0 },
            intentAnalysis: { success: 0, failed: 0 },
            embeddingGeneration: false
        };

        // Step 1: Audio Ingestion (STT + Speaker Separation)
        if (processType === 'full' || processType === 'ingestion') {
            console.log('Step 1: Processing audio ingestion...');
            try {
                const ingestionResults = await voiceBrainIngestion.processBatch(recordings);
                results.ingestion.success = ingestionResults.length;
                results.ingestion.failed = recordings.length - ingestionResults.length;
                console.log(`Ingestion complete: ${results.ingestion.success} success, ${results.ingestion.failed} failed`);
            } catch (error) {
                console.error('Ingestion failed:', error);
                results.ingestion.failed = recordings.length;
            }
        }

        // Step 2: Transcript Cleaning
        if (processType === 'full' || processType === 'cleaning') {
            console.log('Step 2: Processing transcript cleaning...');
            try {
                // Get processed transcripts
                const { data: processedCalls } = await supabase
                    .from('voice_calls')
                    .select('id, transcript, language')
                    .in('id', callIds)
                    .eq('status', 'processed');

                if (processedCalls && processedCalls.length > 0) {
                    const rawTranscripts = processedCalls.map(call => ({
                        callId: call.id,
                        text: call.transcript || '',
                        language: call.language || 'hi',
                        confidence: 0.9 // Would come from STT
                    }));

                    const cleanedTranscripts = await transcriptCleaner.cleanBatch(rawTranscripts);
                    await transcriptCleaner.saveCleanedTranscripts(cleanedTranscripts);

                    results.cleaning.success = cleanedTranscripts.length;
                    console.log(`Cleaning complete: ${results.cleaning.success} transcripts cleaned`);
                }
            } catch (error) {
                console.error('Cleaning failed:', error);
                results.cleaning.failed = callIds.length;
            }
        }

        // Step 3: Intent Extraction & Clustering
        if (processType === 'full' || processType === 'intent') {
            console.log('Step 3: Processing intent extraction...');
            try {
                const analyses = await intentExtractor.analyzeBatch(callIds);
                await intentClustering.createIntentClusters(analyses);

                results.intentAnalysis.success = analyses.length;
                console.log(`Intent analysis complete: ${results.intentAnalysis.success} conversations analyzed`);
            } catch (error) {
                console.error('Intent analysis failed:', error);
                results.intentAnalysis.failed = callIds.length;
            }
        }

        // Step 4: Embedding Generation
        if (processType === 'full' || processType === 'embeddings') {
            console.log('Step 4: Generating embeddings...');
            try {
                await embeddingGenerator.generateEmbeddingsForIntents();
                results.embeddingGeneration = true;
                console.log('Embedding generation complete');
            } catch (error) {
                console.error('Embedding generation failed:', error);
                results.embeddingGeneration = false;
            }
        }

        return NextResponse.json({
            success: true,
            results,
            message: `Voice brain processing completed for ${callIds.length} calls`
        });

    } catch (error) {
        console.error('Processing error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Get processing status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'all';

        let query = supabase
            .from('voice_calls')
            .select('id, phone_number, status, created_at, processed_at');

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch processing status' },
                { status: 500 }
            );
        }

        // Get summary stats
        const statusCounts = data?.reduce((acc, call) => {
            acc[call.status] = (acc[call.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>) || {};

        return NextResponse.json({
            calls: data,
            stats: statusCounts
        });

    } catch (error) {
        console.error('Status fetch error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}