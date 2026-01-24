import { supabase } from '@/lib/supabaseClient';

// Voice Brain Ingestion Pipeline
// Processes call recordings into structured conversations

export interface CallRecording {
  id: string;
  phoneNumber: string;
  audioUrl: string;
  duration?: number;
  language?: string;
}

export interface ConversationTurn {
  role: 'customer' | 'agent';
  text: string;
  language: string;
  confidence?: number;
  startTime?: number;
  endTime?: number;
}

export interface ProcessedConversation {
  callId: string;
  turns: ConversationTurn[];
  metadata: {
    totalDuration: number;
    language: string;
    confidence: number;
  };
}

// Speech-to-Text Service Interface
export interface STTProvider {
  name: string;
  transcribeAudio(audioUrl: string, options: STTOptions): Promise<TranscriptionResult>;
  supportsSpeakerDiarization(): boolean;
  getSupportedLanguages(): string[];
}

export interface STTOptions {
  language?: string;
  enableSpeakerDiarization?: boolean;
  maxSpeakers?: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  segments: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string; // For speaker diarization
  confidence: number;
}

// OpenAI Whisper STT Provider (Primary)
class WhisperSTTProvider implements STTProvider {
  name = 'whisper';

  async transcribeAudio(audioUrl: string, options: STTOptions): Promise<TranscriptionResult> {
    // TODO: Implement OpenAI Whisper API call
    // For now, return mock data
    console.log(`Whisper STT: Processing ${audioUrl} in ${options.language}`);

    // Mock transcription result
    return {
      transcript: "Customer: Hello, I want to know the price of this product. Agent: The price is ₹500. Customer: Is it available? Agent: Yes, it's available in stock.",
      confidence: 0.95,
      language: options.language || 'hi',
      segments: [
        { start: 0, end: 3, text: "Hello, I want to know the price of this product.", speaker: "customer", confidence: 0.96 },
        { start: 4, end: 6, text: "The price is ₹500.", speaker: "agent", confidence: 0.98 },
        { start: 7, end: 9, text: "Is it available?", speaker: "customer", confidence: 0.94 },
        { start: 10, end: 12, text: "Yes, it's available in stock.", speaker: "agent", confidence: 0.97 }
      ]
    };
  }

  supportsSpeakerDiarization(): boolean {
    return true; // Whisper can do speaker diarization
  }

  getSupportedLanguages(): string[] {
    return ['en', 'hi', 'gu', 'mr', 'bn', 'te', 'ta', 'kn', 'ml', 'pa'];
  }
}

// Google Speech-to-Text Provider (Fallback)
class GoogleSTTProvider implements STTProvider {
  name = 'google';

  async transcribeAudio(audioUrl: string, options: STTOptions): Promise<TranscriptionResult> {
    // TODO: Implement Google STT API call
    throw new Error('Google STT not yet implemented');
  }

  supportsSpeakerDiarization(): boolean {
    return true;
  }

  getSupportedLanguages(): string[] {
    return ['en', 'hi', 'gu', 'mr', 'bn', 'te', 'ta', 'kn', 'ml', 'pa'];
  }
}

// STT Manager with fallback
export class STTManager {
  private providers: Map<string, STTProvider> = new Map();

  constructor() {
    this.registerProvider(new WhisperSTTProvider());
    this.registerProvider(new GoogleSTTProvider());
  }

  registerProvider(provider: STTProvider): void {
    this.providers.set(provider.name, provider);
  }

  async transcribeAudio(
    audioUrl: string,
    options: STTOptions = {},
    providerName: string = 'whisper'
  ): Promise<TranscriptionResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`STT provider '${providerName}' not found`);
    }

    // Validate language support
    if (options.language && !provider.getSupportedLanguages().includes(options.language)) {
      console.warn(`Language '${options.language}' not supported by ${providerName}, using 'hi'`);
      options.language = 'hi';
    }

    try {
      console.log(`Starting STT transcription with ${providerName}...`);
      const result = await provider.transcribeAudio(audioUrl, options);
      console.log(`STT completed with confidence: ${result.confidence}`);
      return result;
    } catch (error) {
      console.error(`STT failed with ${providerName}:`, error);

      // Try fallback provider if primary fails
      if (providerName === 'whisper') {
        console.log('Trying Google STT as fallback...');
        return await this.transcribeAudio(audioUrl, options, 'google');
      }

      throw error;
    }
  }
}

// Speaker Separation and Conversation Structuring
export class ConversationProcessor {
  static processTranscription(
    transcription: TranscriptionResult,
    phoneNumber: string
  ): ConversationTurn[] {
    const turns: ConversationTurn[] = [];

    // Group segments by speaker and create conversation turns
    let currentSpeaker: string | null = null;
    let currentText = '';
    let currentStart = 0;
    let currentConfidence = 0;
    let segmentCount = 0;

    for (const segment of transcription.segments) {
      const speaker = segment.speaker || 'unknown';

      if (currentSpeaker !== speaker && currentSpeaker !== null) {
        // Save previous turn
        turns.push({
          role: this.mapSpeakerToRole(currentSpeaker, phoneNumber),
          text: currentText.trim(),
          language: transcription.language,
          confidence: currentConfidence / segmentCount,
          startTime: currentStart,
          endTime: segment.start
        });

        // Reset for new speaker
        currentText = '';
        currentConfidence = 0;
        segmentCount = 0;
        currentStart = segment.start;
      }

      currentSpeaker = speaker;
      currentText += (currentText ? ' ' : '') + segment.text;
      currentConfidence += segment.confidence;
      segmentCount++;
    }

    // Add final turn
    if (currentSpeaker && currentText) {
      turns.push({
        role: this.mapSpeakerToRole(currentSpeaker, phoneNumber),
        text: currentText.trim(),
        language: transcription.language,
        confidence: segmentCount > 0 ? currentConfidence / segmentCount : 0,
        startTime: currentStart,
        endTime: transcription.segments[transcription.segments.length - 1]?.end || 0
      });
    }

    return turns;
  }

  private static mapSpeakerToRole(speaker: string, phoneNumber: string): 'customer' | 'agent' {
    // Simple heuristic: assume first speaker is customer
    // In production, you might need more sophisticated speaker identification
    return speaker.toLowerCase().includes('customer') ||
           speaker.toLowerCase().includes('caller') ||
           speaker === 'SPEAKER_00' ? 'customer' : 'agent';
  }
}

// Main Ingestion Pipeline
export class VoiceBrainIngestion {
  private sttManager = new STTManager();

  async processCallRecording(recording: CallRecording): Promise<ProcessedConversation> {
    console.log(`Processing call recording: ${recording.id}`);

    try {
      // Update status to processing
      await supabase
        .from('voice_calls')
        .update({ status: 'processing' })
        .eq('id', recording.id);

      // Step 1: Speech-to-Text with speaker diarization
      const transcription = await this.sttManager.transcribeAudio(
        recording.audioUrl,
        {
          language: recording.language || 'hi',
          enableSpeakerDiarization: true,
          maxSpeakers: 2
        }
      );

      // Step 2: Structure into conversation turns
      const turns = ConversationProcessor.processTranscription(transcription, recording.phoneNumber);

      // Step 3: Save to database
      await this.saveProcessedConversation(recording.id, turns, transcription);

      // Step 4: Update status to processed
      await supabase
        .from('voice_calls')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          transcript: transcription.transcript
        })
        .eq('id', recording.id);

      const processedConversation: ProcessedConversation = {
        callId: recording.id,
        turns,
        metadata: {
          totalDuration: recording.duration || 0,
          language: transcription.language,
          confidence: transcription.confidence
        }
      };

      console.log(`Successfully processed call ${recording.id} with ${turns.length} conversation turns`);
      return processedConversation;

    } catch (error) {
      console.error(`Failed to process call ${recording.id}:`, error);

      // Update status to failed
      await supabase
        .from('voice_calls')
        .update({ status: 'failed' })
        .eq('id', recording.id);

      throw error;
    }
  }

  private async saveProcessedConversation(
    callId: string,
    turns: ConversationTurn[],
    transcription: TranscriptionResult
  ): Promise<void> {
    // Save conversation turns
    const conversationInserts = turns.map((turn, index) => ({
      call_id: callId,
      sequence: index + 1,
      role: turn.role,
      text: turn.text,
      language: turn.language,
      confidence_score: turn.confidence,
      start_time: turn.startTime,
      end_time: turn.endTime
    }));

    const { error: conversationError } = await supabase
      .from('voice_conversations')
      .insert(conversationInserts);

    if (conversationError) {
      throw new Error(`Failed to save conversation turns: ${conversationError.message}`);
    }

    console.log(`Saved ${turns.length} conversation turns for call ${callId}`);
  }

  // Batch processing for multiple recordings
  async processBatch(recordings: CallRecording[], batchSize: number = 5): Promise<ProcessedConversation[]> {
    const results: ProcessedConversation[] = [];

    for (let i = 0; i < recordings.length; i += batchSize) {
      const batch = recordings.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordings.length / batchSize)}`);

      const batchPromises = batch.map(recording => this.processCallRecording(recording));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch processing error:', result.reason);
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + batchSize < recordings.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Global instance
export const voiceBrainIngestion = new VoiceBrainIngestion();