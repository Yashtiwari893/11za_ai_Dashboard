import { supabase } from '@/lib/supabaseClient';
import { downloadAndStoreAudio } from './audioStorage';
import { transcribeAudio } from './speechToText';
import { detectIntentAndRetrieveKnowledge } from './intentDetection';
import { generateHumanLikeResponse } from './responseGenerator';
import { generateVoiceResponse } from './voiceGeneration';
import { sendWhatsAppVoiceResponse } from './whatsappSender';

export interface VoiceProcessingResult {
    success: boolean;
    error?: string;
    voiceMessageId?: string;
    transcript?: string;
    responseSent?: boolean;
}

/**
 * Main voice note processing pipeline
 * Orchestrates the entire flow from audio download to WhatsApp response
 */
export async function processVoiceNote(
    whatsappMessageId: number,
    messageId: string,
    fromNumber: string,
    toNumber: string,
    mediaUrl: string,
    fileName?: string,
    duration?: number,
    fileSize?: number
): Promise<VoiceProcessingResult> {
    let voiceMessageId: string | undefined;

    try {
        console.log(`🎵 Starting voice note processing for message: ${messageId}`);

        // STEP 1: Download and store audio file
        console.log('📥 Step 1: Downloading and storing audio...');
        const audioResult = await downloadAndStoreAudio(mediaUrl, fileName);
        if (!audioResult.success) {
            throw new Error(`Audio download failed: ${audioResult.error}`);
        }

        // STEP 2: Create voice message record
        console.log('💾 Step 2: Creating voice message record...');
        const { data: voiceMessage, error: voiceError } = await supabase
            .from('voice_messages')
            .insert({
                whatsapp_message_id: whatsappMessageId,
                message_id: messageId,
                from_number: fromNumber,
                to_number: toNumber,
                audio_url: audioResult.audioUrl!,
                audio_file_name: audioResult.fileName,
                audio_duration_seconds: duration,
                audio_size_bytes: fileSize,
                processing_status: 'processing',
                processing_started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (voiceError) {
            throw new Error(`Failed to create voice message record: ${voiceError.message}`);
        }

        voiceMessageId = voiceMessage.id;
        console.log(`✅ Voice message created: ${voiceMessageId}`);

        // STEP 3: Speech-to-Text (STT)
        console.log('🎤 Step 3: Transcribing audio...');
        const transcriptResult = await transcribeAudio(
            audioResult.audioUrl!,
            voiceMessageId!,
            toNumber // business number for language detection
        );

        if (!transcriptResult.success) {
            throw new Error(`STT failed: ${transcriptResult.error}`);
        }

        console.log(`📝 Transcript: "${transcriptResult.transcript}"`);

        // STEP 4: Intent Detection & Knowledge Retrieval
        console.log('🧠 Step 4: Detecting intent and retrieving knowledge...');
        const intentResult = await detectIntentAndRetrieveKnowledge(
            transcriptResult.transcript!,
            transcriptResult.language!,
            voiceMessageId!,
            toNumber
        );

        if (!intentResult.success) {
            throw new Error(`Intent detection failed: ${intentResult.error}`);
        }

        // STEP 5: Generate Human-like Response
        console.log('💭 Step 5: Generating human-like response...');
        const responseResult = await generateHumanLikeResponse(
            transcriptResult.transcript!,
            intentResult.intent!,
            intentResult.knowledge!,
            transcriptResult.language!,
            voiceMessageId!,
            fromNumber,
            toNumber
        );

        if (!responseResult.success) {
            throw new Error(`Response generation failed: ${responseResult.error}`);
        }

        // STEP 6: Generate Voice Response (TTS)
        console.log('🔊 Step 6: Generating voice response...');
        const voiceGenResult = await generateVoiceResponse(
            responseResult.voiceScript!,
            responseResult.textResponse!,
            transcriptResult.language!,
            voiceMessageId!,
            toNumber
        );

        if (!voiceGenResult.success) {
            throw new Error(`Voice generation failed: ${voiceGenResult.error}`);
        }

        // STEP 7: Send WhatsApp Response
        console.log('📤 Step 7: Sending WhatsApp response...');
        const sendResult = await sendWhatsAppVoiceResponse(
            fromNumber,
            toNumber,
            voiceGenResult.audioUrl!,
            responseResult.textResponse,
            voiceMessageId
        );

        if (!sendResult.success) {
            throw new Error(`WhatsApp send failed: ${sendResult.error}`);
        }

        // STEP 8: Update conversation context
        console.log('📊 Step 8: Updating conversation context...');
        await updateConversationContext(fromNumber, toNumber);

        // STEP 9: Mark processing as complete
        await supabase
            .from('voice_messages')
            .update({
                processing_status: 'completed',
                processing_completed_at: new Date().toISOString(),
                detected_language: transcriptResult.language
            })
            .eq('id', voiceMessageId);

        console.log(`✅ Voice note processing completed successfully for message: ${messageId}`);

        return {
            success: true,
            voiceMessageId,
            transcript: transcriptResult.transcript,
            responseSent: true
        };

    } catch (error) {
        console.error('❌ Voice note processing failed:', error);

        // Mark as failed if we have a voice message ID
        if (voiceMessageId) {
            await supabase
                .from('voice_messages')
                .update({
                    processing_status: 'failed',
                    processing_error: error instanceof Error ? error.message : 'Unknown error',
                    processing_completed_at: new Date().toISOString()
                })
                .eq('id', voiceMessageId);
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            voiceMessageId
        };
    }
}

/**
 * Update conversation context and statistics
 */
async function updateConversationContext(userNumber: string, businessNumber: string): Promise<void> {
    try {
        await supabase.rpc('update_voice_conversation_stats', {
            p_user_number: userNumber,
            p_business_number: businessNumber
        });
    } catch (error) {
        console.error('Failed to update conversation context:', error);
        // Don't throw - this is not critical
    }
}