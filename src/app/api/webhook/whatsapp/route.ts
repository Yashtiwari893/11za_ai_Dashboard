import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { generateAutoResponse } from "@/lib/autoResponder";
import { processVoiceNote } from "@/lib/voice-notes/voiceProcessor";

// Type definition for WhatsApp webhook payload
type WhatsAppWebhookPayload = {
    messageId: string;
    channel: string;
    from: string;
    to: string;
    receivedAt: string;
    content: {
        contentType: string;
        text?: string;
        mediaUrl?: string;
        mediaType?: string;
        fileName?: string;
        fileSize?: number;
        duration?: number;
    };
    whatsapp?: {
        senderName?: string;
    };
    timestamp: string;
    event: string;
    isin24window?: boolean;
    isResponded?: boolean;
    UserResponse?: string;
};

export async function POST(req: Request) {
    try {
        const payload: WhatsAppWebhookPayload = await req.json();

        console.log("Received WhatsApp webhook:", payload);

        // Validate required fields
        if (!payload.messageId || !payload.from || !payload.to) {
            return NextResponse.json(
                { error: "Missing required fields: messageId, from, or to" },
                { status: 400 }
            );
        }

        // Check if this is a voice note
        const isVoiceNote = payload.content?.contentType === "audio" ||
                           payload.content?.contentType === "voice" ||
                           payload.content?.mediaType === "audio";

        // Insert into database
        const { data, error } = await supabase
            .from("whatsapp_messages")
            .insert([
                {
                    message_id: payload.messageId,
                    channel: payload.channel,
                    from_number: payload.from,
                    to_number: payload.to,
                    received_at: payload.receivedAt,
                    content_type: payload.content?.contentType,
                    content_text: payload.content?.text || payload.UserResponse,
                    sender_name: payload.whatsapp?.senderName,
                    event_type: payload.event,
                    is_in_24_window: payload.isin24window || false,
                    is_responded: payload.isResponded || false,
                    is_voice_note: isVoiceNote,
                    raw_payload: payload,
                },
            ])
            .select();

        if (error) {
            console.error("Database error:", error);

            // Handle duplicate message_id (already processed)
            if (error.code === "23505") {
                return NextResponse.json(
                    {
                        success: true,
                        message: "Message already processed",
                        duplicate: true
                    },
                    { status: 200 }
                );
            }

            throw error;
        }

        console.log("Message stored successfully:", data);

        // Handle voice notes
        if (isVoiceNote && payload.event === "MoMessage" && payload.content?.mediaUrl) {
            console.log("🎵 Processing voice note for message:", payload.messageId);

            try {
                const voiceResult = await processVoiceNote(
                    data[0].id, // whatsapp_message_id
                    payload.messageId,
                    payload.from,
                    payload.to,
                    payload.content.mediaUrl,
                    payload.content.fileName,
                    payload.content.duration,
                    payload.content.fileSize
                );

                if (voiceResult.success) {
                    console.log("✅ Voice note processed successfully");
                } else {
                    console.error("❌ Voice note processing failed:", voiceResult.error);
                }
            } catch (voiceError) {
                console.error("❌ Voice processing error:", voiceError);
                // Continue with normal flow - don't fail the webhook
            }
        }

        // Handle text messages (existing logic)
        const messageText = payload.content?.text || payload.UserResponse;
        if (messageText && payload.event === "MoMessage" && !isVoiceNote) {
            console.log("💬 Processing text message for message:", payload.messageId);

            // Process directly - await the full response
            // Use payload.to (the business number) to look up the correct file/credentials
            const result = await generateAutoResponse(
                payload.from,
                payload.to,
                messageText,
                payload.messageId
            );

            if (result.success) {
                console.log("✅ Auto-response sent successfully");
            } else {
                console.error("❌ Auto-response failed:", result.error);
            }
        }

        return NextResponse.json({
            success: true,
            message: "WhatsApp message received and stored",
            data: data?.[0],
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("WEBHOOK_ERROR:", message, err);
        return NextResponse.json(
            { error: message, details: err },
            { status: 500 }
        );
    }
}

// Optional: Add GET endpoint for webhook verification (some services require this)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    // Verify token (set this in your environment variables)
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "your_verify_token";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
    }

    return NextResponse.json(
        { error: "Verification failed" },
        { status: 403 }
    );
}
