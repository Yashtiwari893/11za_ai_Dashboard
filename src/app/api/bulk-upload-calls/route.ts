import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";
export const maxDuration = 300;

type UploadResult = {
    fileName: string;
    fileSize: number;
    callId: string;
};

type FailedResult = {
    fileName: string;
    error: string;
};

export async function POST(req: Request) {
    try {
        const form = await req.formData();
        const phoneNumber = form.get("phone_number") as string | null;
        const files = form.getAll("files") as File[];

        if (!phoneNumber) {
            return NextResponse.json({ error: "phone_number is required" }, { status: 400 });
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "At least one audio file is required" }, { status: 400 });
        }

        if (files.length > 50) {
            return NextResponse.json(
                { error: "Maximum 50 files per upload" },
                { status: 400 }
            );
        }

        const uploaded: UploadResult[] = [];
        const failed: FailedResult[] = [];

        for (const file of files) {
            try {
                const fileSize = file.size;

                // Validate file size (100MB max)
                if (fileSize > 100 * 1024 * 1024) {
                    failed.push({
                        fileName: file.name,
                        error: "File size exceeds 100MB limit"
                    });
                    continue;
                }

                // Validate file type
                const validMimeTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"];
                if (!validMimeTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg)$/i)) {
                    failed.push({
                        fileName: file.name,
                        error: "Invalid audio format. Supported: MP3, WAV, OGG"
                    });
                    continue;
                }

                const callId = uuidv4();
                const buffer = await file.arrayBuffer();

                // Upload to Supabase Storage
                const storagePath = `calls/${phoneNumber}/${callId}/${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from("audio-files")
                    .upload(storagePath, buffer, {
                        contentType: file.type,
                        upsert: true
                    });

                if (uploadError) {
                    throw uploadError;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from("audio-files")
                    .getPublicUrl(storagePath);

                // Create call recording record
                const { data: callData, error: insertError } = await supabase
                    .from("call_recordings")
                    .insert([
                        {
                            id: callId,
                            phone_number: phoneNumber,
                            file_name: file.name,
                            file_size_bytes: fileSize,
                            file_url: urlData.publicUrl,
                            status: "uploaded",
                            duration_seconds: null,
                        }
                    ])
                    .select("id")
                    .single();

                if (insertError) {
                    throw insertError;
                }

                uploaded.push({
                    fileName: file.name,
                    fileSize: fileSize,
                    callId: callData.id
                });

                // Trigger async processing
                await triggerProcessing(callData.id, phoneNumber, file.name, buffer);

            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                failed.push({
                    fileName: file.name,
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        }

        return NextResponse.json({
            success: true,
            uploaded,
            failed,
            summary: `${uploaded.length} uploaded, ${failed.length} failed`
        });

    } catch (error) {
        console.error("Error in bulk upload:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * Trigger async processing via a separate worker
 */
async function triggerProcessing(
    callId: string,
    phoneNumber: string,
    fileName: string,
    buffer: ArrayBuffer
) {
    try {
        // Queue for background processing
        await fetch(`${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/process-calls-worker`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                callId,
                phoneNumber,
                fileName,
                bufferBase64: Buffer.from(buffer).toString("base64")
            })
        }).catch(err => {
            console.error("Failed to queue processing:", err);
            // Don't fail the upload if async processing fails to queue
        });
    } catch (error) {
        console.error("Error triggering processing:", error);
    }
}
