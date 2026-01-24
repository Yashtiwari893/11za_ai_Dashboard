import OpenAI from 'openai';
import { supabase } from '@/lib/supabaseClient';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required for speech-to-text');
        }
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return openai;
}

export interface TranscriptResult {
    success: boolean;
    error?: string;
    transcript?: string;
    language?: string;
    confidence?: number;
    processingTime?: number;
}

/**
 * Transcribe audio to text with multi-language support
 */
export async function transcribeAudio(
    audioUrl: string,
    voiceMessageId: string,
    businessNumber: string
): Promise<TranscriptResult> {
    const startTime = Date.now();

    try {
        console.log(`🎤 Transcribing audio: ${audioUrl}`);

        // Download audio file
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio for transcription: ${audioResponse.status}`);
        }

        const audioBlob = await audioResponse.blob();

        // Detect language from business number settings (default to Hindi)
        const detectedLanguage = await getBusinessLanguage(businessNumber);

        // Transcribe with OpenAI Whisper
        const transcription = await getOpenAIClient().audio.transcriptions.create({
            file: audioBlob,
            model: 'whisper-1',
            language: detectedLanguage, // 'hi', 'en', 'mr', 'gu'
            response_format: 'json',
            temperature: 0 // More deterministic for consistent results
        });

        const transcript = transcription.text;
        const processingTime = Date.now() - startTime;

        // Clean the transcript (remove fillers, normalize)
        const cleanedTranscript = cleanTranscript(transcript, detectedLanguage);

        // Store transcript in database
        const { error: transcriptError } = await supabase
            .from('voice_transcripts')
            .insert({
                voice_message_id: voiceMessageId,
                raw_transcript: transcript,
                cleaned_transcript: cleanedTranscript,
                detected_language: detectedLanguage,
                confidence_score: 0.85, // OpenAI doesn't provide confidence, use default
                stt_provider: 'openai',
                stt_model: 'whisper-1',
                processing_time_ms: processingTime,
                word_count: cleanedTranscript.split(' ').length,
                speaker_count: 1
            });

        if (transcriptError) {
            console.error('Failed to store transcript:', transcriptError);
            // Don't throw - we still have the transcript
        }

        console.log(`📝 Transcription completed: "${cleanedTranscript}" (${processingTime}ms)`);

        return {
            success: true,
            transcript: cleanedTranscript,
            language: detectedLanguage,
            confidence: 0.85,
            processingTime
        };

    } catch (error) {
        console.error('❌ Transcription failed:', error);
        const processingTime = Date.now() - startTime;

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown transcription error',
            processingTime
        };
    }
}

/**
 * Get business language preference from settings
 */
async function getBusinessLanguage(businessNumber: string): Promise<string> {
    try {
        // Check if there's a phone mapping or settings table
        const { data, error } = await supabase
            .from('phone_mappings')
            .select('language')
            .eq('phone_number', businessNumber)
            .single();

        if (data?.language) {
            return data.language;
        }
    } catch (error) {
        // Ignore error, use default
    }

    // Default to Hindi for Indian businesses
    return 'hi';
}

/**
 * Clean transcript by removing fillers and normalizing text
 */
function cleanTranscript(transcript: string, language: string): string {
    let cleaned = transcript.trim();

    // Language-specific filler words
    const fillers: Record<string, string[]> = {
        'hi': ['अहं', 'मैं', 'हाँ', 'हां', 'अच्छा', 'ठीक', 'ओके', 'ओह', 'वाह', 'अरे', 'यार', 'भाई', 'बहन'],
        'en': ['um', 'uh', 'like', 'you know', 'so', 'well', 'actually', 'basically', 'literally'],
        'mr': ['अहो', 'म्हणजे', 'काय', 'बरं', 'हो', 'अरे', 'यार', 'भाई'],
        'gu': ['હં', 'હા', 'અહો', 'અરે', 'ભાઈ', 'યાર']
    };

    const languageFillers = fillers[language] || fillers['hi'];

    // Remove filler words (case insensitive)
    const fillerRegex = new RegExp(`\\b(${languageFillers.join('|')})\\b`, 'gi');
    cleaned = cleaned.replace(fillerRegex, '').trim();

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove leading/trailing punctuation that might be artifacts
    cleaned = cleaned.replace(/^[.,!?;:\s]+|[.,!?;:\s]+$/g, '');

    return cleaned.trim();
}

/**
 * Alternative STT providers (for fallback or comparison)
 */
export async function transcribeWithGoogle(
    audioUrl: string,
    language: string
): Promise<TranscriptResult> {
    // Placeholder for Google Speech-to-Text
    // Would require Google Cloud credentials
    throw new Error('Google STT not implemented yet');
}

export async function transcribeWithAzure(
    audioUrl: string,
    language: string
): Promise<TranscriptResult> {
    // Placeholder for Azure Speech Services
    // Would require Azure credentials
    throw new Error('Azure STT not implemented yet');
}