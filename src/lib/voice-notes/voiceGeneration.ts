import { supabase } from '@/lib/supabaseClient';
import { TTSManager } from '@/lib/voice/tts';

const ttsManager = new TTSManager();

export interface VoiceGenerationResult {
    success: boolean;
    error?: string;
    audioUrl?: string;
    duration?: number;
}

/**
 * Generate voice audio from text script
 */
export async function generateVoiceResponse(
    voiceScript: string,
    textResponse: string,
    language: string,
    voiceMessageId: string,
    businessNumber: string
): Promise<VoiceGenerationResult> {
    try {
        console.log(`🔊 Generating voice for: "${voiceScript}"`);

        // Get voice settings for business
        const voiceSettings = await getVoiceSettings(businessNumber, language);

        // Generate TTS audio
        const audioBuffer = await ttsManager.textToSpeech(voiceScript, {
            language: voiceSettings.language,
            gender: voiceSettings.gender,
            speed: voiceSettings.speed,
            pitch: voiceSettings.pitch
        });

        // Store audio in Supabase Storage
        const audioUrl = await storeVoiceAudio(audioBuffer, voiceMessageId);

        // Calculate duration (rough estimate: 150 words per minute)
        const wordCount = voiceScript.split(' ').length;
        const estimatedDuration = (wordCount / 150) * 60; // seconds

        // Update voice response record with audio info
        await updateVoiceResponse(voiceMessageId, audioUrl, estimatedDuration, voiceSettings);

        console.log(`✅ Voice generated: ${audioUrl} (${estimatedDuration.toFixed(1)}s)`);

        return {
            success: true,
            audioUrl,
            duration: estimatedDuration
        };

    } catch (error) {
        console.error('❌ Voice generation failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get voice settings for business
 */
async function getVoiceSettings(businessNumber: string, language: string): Promise<{
    language: string;
    gender: 'male' | 'female';
    speed: number;
    pitch: number;
    provider: string;
}> {
    try {
        // Check for business-specific voice settings
        const { data: settings } = await supabase
            .from('phone_mappings')
            .select('voice_settings')
            .eq('phone_number', businessNumber)
            .single();

        if (settings?.voice_settings) {
            return settings.voice_settings;
        }
    } catch (error) {
        // Ignore error, use defaults
    }

    // Default voice settings based on language
    const defaults: Record<string, any> = {
        hi: { language: 'hi', gender: 'female', speed: 1.0, pitch: 1.0, provider: 'mistral' },
        en: { language: 'en', gender: 'female', speed: 1.0, pitch: 1.0, provider: 'mistral' },
        mr: { language: 'mr', gender: 'female', speed: 1.0, pitch: 1.0, provider: 'mistral' },
        gu: { language: 'gu', gender: 'female', speed: 1.0, pitch: 1.0, provider: 'mistral' }
    };

    return defaults[language] || defaults.hi;
}

/**
 * Store voice audio in Supabase Storage
 */
async function storeVoiceAudio(audioBuffer: ArrayBuffer, voiceMessageId: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `voice_response_${voiceMessageId}_${timestamp}.mp3`;

    const { data, error } = await supabase.storage
        .from('voice-responses')
        .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false
        });

    if (error) {
        throw new Error(`Failed to store voice audio: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('voice-responses')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

/**
 * Update voice response record with audio information
 */
async function updateVoiceResponse(
    voiceMessageId: string,
    audioUrl: string,
    duration: number,
    voiceSettings: any
): Promise<void> {
    try {
        await supabase
            .from('voice_responses')
            .update({
                audio_url: audioUrl,
                audio_duration_seconds: duration,
                tts_provider: voiceSettings.provider,
                tts_voice: `${voiceSettings.language}_${voiceSettings.gender}`,
                tts_speed: voiceSettings.speed,
                tts_pitch: voiceSettings.pitch
            })
            .eq('voice_message_id', voiceMessageId);
    } catch (error) {
        console.error('Failed to update voice response:', error);
        // Don't throw - not critical
    }
}

/**
 * Alternative TTS providers for fallback
 */
export async function generateVoiceWithMistral(
    text: string,
    voiceSettings: any
): Promise<ArrayBuffer> {
    // Use existing Mistral TTS implementation
    return await ttsManager.textToSpeech(text, voiceSettings);
}

export async function generateVoiceWithOpenAI(
    text: string,
    voiceSettings: any
): Promise<ArrayBuffer> {
    // Placeholder for OpenAI TTS
    // Would use OpenAI's TTS API
    throw new Error('OpenAI TTS not implemented yet');
}

export async function generateVoiceWithElevenLabs(
    text: string,
    voiceSettings: any
): Promise<ArrayBuffer> {
    // Placeholder for ElevenLabs TTS
    // Would use ElevenLabs API
    throw new Error('ElevenLabs TTS not implemented yet');
}