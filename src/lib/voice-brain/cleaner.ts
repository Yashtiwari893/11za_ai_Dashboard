import { supabase } from '@/lib/supabaseClient';

// Transcript Cleaning and Normalization Service
// Cleans transcripts while preserving human imperfection

export interface RawTranscript {
  callId: string;
  text: string;
  language: string;
  confidence: number;
}

export interface CleanedTranscript {
  id?: string;
  callId?: string;
  originalText: string;
  cleanedText: string;
  language: string;
  changes: TranscriptChange[];
  quality: {
    clarity: number; // 0-1, how clear the speech is
    completeness: number; // 0-1, how complete the conversation is
    naturalness: number; // 0-1, how natural it sounds
  };
}

export interface TranscriptChange {
  type: 'removal' | 'replacement' | 'normalization';
  original: string;
  replacement: string;
  position: number;
  reason: string;
}

// Transcript Cleaner Class
export class TranscriptCleaner {
  // Fillers to remove (but keep some for naturalness)
  private readonly fillers = new Set([
    'uh', 'um', 'uhh', 'umm', 'er', 'ah', 'eh',
    'hmm', 'hmmm', 'mm', 'mmm',
    'you know', 'like', 'sort of', 'kind of',
    'actually', 'basically', 'literally'
  ]);

  // Hinglish normalization patterns
  private readonly hinglishPatterns: Array<{
    pattern: RegExp;
    replacement: string;
    reason: string;
  }> = [
    // Common Hinglish spellings
    { pattern: /\bmai\b/gi, replacement: 'main', reason: 'Hinglish normalization' },
    { pattern: /\bhain\b/gi, replacement: 'hain', reason: 'Hinglish normalization' },
    { pattern: /\bkai\b/gi, replacement: 'ki', reason: 'Hinglish normalization' },
    { pattern: /\bkaisa\b/gi, replacement: 'kaisa', reason: 'Hinglish normalization' },
    { pattern: /\bkahan\b/gi, replacement: 'kahan', reason: 'Hinglish normalization' },
    { pattern: /\bkaha\b/gi, replacement: 'kaha', reason: 'Hinglish normalization' },
    { pattern: /\bkab\b/gi, replacement: 'kab', reason: 'Hinglish normalization' },
    { pattern: /\bkoi\b/gi, replacement: 'koi', reason: 'Hinglish normalization' },
    { pattern: /\bkuch\b/gi, replacement: 'kuch', reason: 'Hinglish normalization' },
    { pattern: /\bkarta\b/gi, replacement: 'karta', reason: 'Hinglish normalization' },
    { pattern: /\bkarna\b/gi, replacement: 'karna', reason: 'Hinglish normalization' },
    { pattern: /\bkar\b/gi, replacement: 'kar', reason: 'Hinglish normalization' },
    { pattern: /\btha\b/gi, replacement: 'tha', reason: 'Hinglish normalization' },
    { pattern: /\bthe\b/gi, replacement: 'the', reason: 'Hinglish normalization' },
    { pattern: /\bho\b/gi, replacement: 'ho', reason: 'Hinglish normalization' },
    { pattern: /\bhai\b/gi, replacement: 'hai', reason: 'Hinglish normalization' },
    { pattern: /\bna\b/gi, replacement: 'na', reason: 'Hinglish normalization' },
    { pattern: /\bnhi\b/gi, replacement: 'nahi', reason: 'Hinglish normalization' },
    { pattern: /\bji\b/gi, replacement: 'ji', reason: 'Hinglish normalization' },
    // Price and numbers
    { pattern: /\b(\d+)\s*rupaye?\b/gi, replacement: '₹$1', reason: 'Currency normalization' },
    { pattern: /\b(\d+)\s*rs\b/gi, replacement: '₹$1', reason: 'Currency normalization' },
    // Common phrases
    { pattern: /\bthik\s+hai\b/gi, replacement: 'thik hai', reason: 'Phrase normalization' },
    { pattern: /\baccha\s+hai\b/gi, replacement: 'achha hai', reason: 'Spelling correction' },
  ];

  // Emotion words to preserve
  private readonly emotionWords = new Set([
    'please', 'thank you', 'sorry', 'excuse me', 'pardon',
    'wonderful', 'amazing', 'great', 'good', 'nice', 'excellent',
    'worried', 'concerned', 'frustrated', 'angry', 'happy', 'pleased',
    'sure', 'definitely', 'absolutely', 'certainly'
  ]);

  async cleanTranscript(transcript: RawTranscript): Promise<CleanedTranscript> {
    console.log(`Cleaning transcript for call ${transcript.callId}`);

    let cleanedText = transcript.text;
    const changes: TranscriptChange[] = [];

    // Step 1: Light filler removal (keep some for naturalness)
    const fillerChanges = this.removeFillersLightly(cleanedText);
    changes.push(...fillerChanges.changes);
    cleanedText = fillerChanges.text;

    // Step 2: Hinglish normalization
    const normalizationChanges = this.normalizeHinglish(cleanedText);
    changes.push(...normalizationChanges.changes);
    cleanedText = normalizationChanges.text;

    // Step 3: Preserve emotion words and natural breaks
    const emotionPreservation = this.preserveEmotionalContent(cleanedText);
    changes.push(...emotionPreservation.changes);
    cleanedText = emotionPreservation.text;

    // Step 4: Quality assessment
    const quality = this.assessQuality(transcript, cleanedText, changes);

    const result: CleanedTranscript = {
      originalText: transcript.text,
      cleanedText,
      language: transcript.language,
      changes,
      quality
    };

    console.log(`Transcript cleaning completed: ${changes.length} changes, quality: ${JSON.stringify(quality)}`);
    return result;
  }

  private removeFillersLightly(text: string): { text: string; changes: TranscriptChange[] } {
    const changes: TranscriptChange[] = [];
    let result = text;

    // Only remove excessive fillers, keep some for naturalness
    const words = result.split(/\s+/);
    const cleanedWords: string[] = [];
    let fillerCount = 0;

    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]$/, '');
      if (this.fillers.has(cleanWord)) {
        fillerCount++;
        // Keep every 3rd filler for naturalness
        if (fillerCount % 3 !== 0) {
          changes.push({
            type: 'removal',
            original: word,
            replacement: '',
            position: result.indexOf(word),
            reason: 'Light filler removal for naturalness'
          });
          continue;
        }
      }
      cleanedWords.push(word);
    }

    result = cleanedWords.join(' ');
    return { text: result, changes };
  }

  private normalizeHinglish(text: string): { text: string; changes: TranscriptChange[] } {
    const changes: TranscriptChange[] = [];
    let result = text;

    for (const { pattern, replacement, reason } of this.hinglishPatterns) {
      const matches = [...result.matchAll(pattern)];
      for (const match of matches) {
        if (match[0] !== replacement) {
          changes.push({
            type: 'replacement',
            original: match[0],
            replacement,
            position: match.index,
            reason
          });
          result = result.replace(match[0], replacement);
        }
      }
    }

    return { text: result, changes };
  }

  private preserveEmotionalContent(text: string): { text: string; changes: TranscriptChange[] } {
    const changes: TranscriptChange[] = [];
    let result = text;

    // Ensure sentence breaks are preserved for natural rhythm
    result = result.replace(/([.!?])\s*([A-Z])/g, '$1\n$2');

    // Preserve emotional emphasis (multiple exclamation marks, etc.)
    // This is more about not removing them rather than changing

    return { text: result, changes };
  }

  private assessQuality(
    original: RawTranscript,
    cleaned: string,
    changes: TranscriptChange[]
  ): CleanedTranscript['quality'] {
    // Clarity: Based on confidence and filler removal
    const clarity = Math.min(original.confidence + 0.1, 1.0); // Slight boost for cleaning

    // Completeness: Based on text length preservation
    const completeness = Math.max(0.7, cleaned.length / original.text.length);

    // Naturalness: Based on preserved fillers and emotion words
    const emotionWordCount = this.countEmotionWords(cleaned);
    const naturalness = Math.min(emotionWordCount * 0.1 + 0.6, 1.0);

    return { clarity, completeness, naturalness };
  }

  private countEmotionWords(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => this.emotionWords.has(word.replace(/[.,!?;:]$/, ''))).length;
  }

  // Batch processing for multiple transcripts
  async cleanBatch(transcripts: RawTranscript[]): Promise<CleanedTranscript[]> {
    console.log(`Cleaning batch of ${transcripts.length} transcripts`);

    const results: CleanedTranscript[] = [];
    const batchSize = 10;

    for (let i = 0; i < transcripts.length; i += batchSize) {
      const batch = transcripts.slice(i, i + batchSize);
      const batchPromises = batch.map(transcript => this.cleanTranscript(transcript));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Progress logging
      console.log(`Cleaned ${Math.min(i + batchSize, transcripts.length)}/${transcripts.length} transcripts`);
    }

    return results;
  }

  // Save cleaned transcripts to database
  async saveCleanedTranscripts(cleanedTranscripts: CleanedTranscript[]): Promise<void> {
    const updates = cleanedTranscripts.map(ct => ({
      id: ct.id || ct.callId,
      cleaned_transcript: ct.cleanedText,
      cleaning_changes: ct.changes,
      transcript_quality: ct.quality
    }));

    const { error } = await supabase
      .from('voice_calls')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save cleaned transcripts: ${error.message}`);
    }

    console.log(`Saved ${cleanedTranscripts.length} cleaned transcripts`);
  }
}

// Global instance
export const transcriptCleaner = new TranscriptCleaner();