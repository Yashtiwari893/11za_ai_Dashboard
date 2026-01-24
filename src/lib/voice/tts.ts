import { supabase } from '@/lib/supabaseClient';

// TTS Provider Interface
export interface TTSProvider {
  name: string;
  generateSpeech(text: string, options: TTSOptions): Promise<ArrayBuffer>;
  getSupportedLanguages(): string[];
  getSupportedVoices(): VoiceOption[];
}

export interface TTSOptions {
  language: string;
  gender: 'male' | 'female';
  speed?: number;
  pitch?: number;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: string;
}

// Mistral TTS Provider (Default)
class MistralTTSProvider implements TTSProvider {
  name = 'mistral';

  async generateSpeech(text: string, options: TTSOptions): Promise<ArrayBuffer> {
    // TODO: Implement Mistral TTS API call
    // For now, return a mock audio buffer
    console.log(`Mistral TTS: Generating speech for "${text.substring(0, 50)}..." in ${options.language}`);

    // Mock implementation - replace with actual API call
    const mockAudioBuffer = new ArrayBuffer(1024); // Placeholder
    return mockAudioBuffer;
  }

  getSupportedLanguages(): string[] {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh'];
  }

  getSupportedVoices(): VoiceOption[] {
    return [
      { id: 'female-1', name: 'Female Voice 1', gender: 'female', language: 'en' },
      { id: 'male-1', name: 'Male Voice 1', gender: 'male', language: 'en' },
    ];
  }
}

// Azure TTS Provider (Future)
class AzureTTSProvider implements TTSProvider {
  name = 'azure';

  async generateSpeech(text: string, options: TTSOptions): Promise<ArrayBuffer> {
    // TODO: Implement Azure TTS API call
    throw new Error('Azure TTS not yet implemented');
  }

  getSupportedLanguages(): string[] {
    return ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'];
  }

  getSupportedVoices(): VoiceOption[] {
    return [];
  }
}

// ElevenLabs TTS Provider (Future)
class ElevenLabsTTSProvider implements TTSProvider {
  name = 'elevenlabs';

  async generateSpeech(text: string, options: TTSOptions): Promise<ArrayBuffer> {
    // TODO: Implement ElevenLabs TTS API call
    throw new Error('ElevenLabs TTS not yet implemented');
  }

  getSupportedLanguages(): string[] {
    return ['en', 'es', 'fr', 'de', 'it', 'pt'];
  }

  getSupportedVoices(): VoiceOption[] {
    return [];
  }
}

// TTS Manager - Provider abstraction with retry and fallback
export class TTSManager {
  private providers: Map<string, TTSProvider> = new Map();

  constructor() {
    this.registerProvider(new MistralTTSProvider());
    this.registerProvider(new AzureTTSProvider());
    this.registerProvider(new ElevenLabsTTSProvider());
  }

  registerProvider(provider: TTSProvider): void {
    this.providers.set(provider.name, provider);
  }

  async textToSpeech(
    text: string,
    options: TTSOptions,
    providerName: string = 'mistral',
    maxRetries: number = 2
  ): Promise<ArrayBuffer> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`TTS provider '${providerName}' not found`);
    }

    // Validate language support
    if (!provider.getSupportedLanguages().includes(options.language)) {
      console.warn(`Language '${options.language}' not supported by ${providerName}, using 'en'`);
      options.language = 'en';
    }

    // Retry logic with fallback
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`TTS attempt ${attempt + 1}/${maxRetries + 1} using ${providerName}`);
        return await provider.generateSpeech(text, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(`TTS attempt ${attempt + 1} failed:`, error);

        // On last attempt, try fallback to Mistral if not already using it
        if (attempt === maxRetries - 1 && providerName !== 'mistral') {
          console.log('Falling back to Mistral TTS');
          return await this.textToSpeech(text, options, 'mistral', 0);
        }
      }
    }

    throw new Error(`TTS failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  // Auto-summarize long text for TTS (WhatsApp audio limits)
  static summarizeForTTS(text: string, maxLength: number = 2000): string {
    if (text.length <= maxLength) {
      return text;
    }

    console.log(`Summarizing text from ${text.length} to ~${maxLength} characters for TTS`);

    // Simple summarization: take first part, add summary note
    const truncated = text.substring(0, maxLength - 100);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('\n')
    );

    const summary = lastSentenceEnd > 0
      ? truncated.substring(0, lastSentenceEnd + 1)
      : truncated;

    return summary + '\n\n[Message summarized for voice reply]';
  }

  // Detect language from text (simple heuristic)
  static detectLanguage(text: string): string {
    // Simple language detection based on common words
    const spanishWords = /\b(hola|gracias|por favor|de|que|como|si|no)\b/i;
    const frenchWords = /\b(bonjour|merci|s'il vous plaît|de|que|comme|oui|non)\b/i;
    const germanWords = /\b(hallo|danke|bitte|von|das|wie|ja|nein)\b/i;
    const italianWords = /\b(ciao|grazie|per favore|di|che|come|sì|no)\b/i;
    const portugueseWords = /\b(olá|obrigado|por favor|de|que|como|sim|não)\b/i;

    if (spanishWords.test(text)) return 'es';
    if (frenchWords.test(text)) return 'fr';
    if (germanWords.test(text)) return 'de';
    if (italianWords.test(text)) return 'it';
    if (portugueseWords.test(text)) return 'pt';

    return 'en'; // Default to English
  }
}

// Global TTS manager instance
export const ttsManager = new TTSManager();

// Store audio file in Supabase Storage
export async function storeVoiceReply(
  audioBuffer: ArrayBuffer,
  phoneNumber: string,
  metadata: {
    language: string;
    textLength: number;
    duration?: number;
  }
): Promise<string> {
  const timestamp = Date.now();
  const filename = `voice_${phoneNumber.replace(/[^a-zA-Z0-9]/g, '')}_${timestamp}.mp3`;

  // Convert AudioBuffer to Uint8Array (simplified - actual implementation would depend on audio format)
  const audioData = new Uint8Array(audioBuffer.byteLength);
  // TODO: Proper audio buffer to MP3 conversion

  const { data, error } = await supabase.storage
    .from('voice-replies')
    .upload(filename, audioData, {
      contentType: 'audio/mpeg',
      metadata: {
        phone_number: phoneNumber,
        language: metadata.language,
        text_length: metadata.textLength.toString(),
        duration: metadata.duration?.toString() || '0',
      },
    });

  if (error) {
    throw new Error(`Failed to store voice reply: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('voice-replies')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}