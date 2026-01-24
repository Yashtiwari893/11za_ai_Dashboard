import { Logger } from '@/lib/monitoring/logger'

export class TranscriptCleaner {
  // Common filler words and phrases to remove
  private static readonly FILLER_WORDS = [
    'uh', 'um', 'uhm', 'er', 'ah', 'hmm', 'mm-hmm', 'mm', 'mhm',
    'you know', 'like', 'sort of', 'kind of', 'i mean', 'well',
    'so', 'basically', 'actually', 'literally', 'totally'
  ]

  // Punctuation patterns to fix
  private static readonly PUNCTUATION_FIXES = [
    { pattern: /\s+([.,!?;:])/g, replacement: '$1' }, // Remove space before punctuation
    { pattern: /([.,!?;:])([a-zA-Z])/g, replacement: '$1 $2' }, // Add space after punctuation
    { pattern: /\s+/g, replacement: ' ' }, // Normalize multiple spaces
    { pattern: /(\w)'(\w)/g, replacement: '$1\'$2' }, // Fix apostrophes
  ]

  static clean(rawTranscript: string): string {
    const requestId = Logger.createRequestId()
    Logger.info('Starting transcript cleaning', {
      request_id: requestId,
      original_length: rawTranscript.length
    })

    let cleaned = rawTranscript.toLowerCase()

    // Remove filler words
    cleaned = this.removeFillerWords(cleaned)

    // Fix punctuation and spacing
    cleaned = this.fixPunctuation(cleaned)

    // Capitalize first letter of sentences
    cleaned = this.capitalizeSentences(cleaned)

    // Clean up extra whitespace
    cleaned = cleaned.trim()

    Logger.info('Transcript cleaning completed', {
      request_id: requestId,
      cleaned_length: cleaned.length,
      reduction_percent: Math.round((1 - cleaned.length / rawTranscript.length) * 100)
    })

    return cleaned
  }

  private static removeFillerWords(text: string): string {
    let cleaned = text

    // Remove filler words with word boundaries
    for (const filler of this.FILLER_WORDS) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi')
      cleaned = cleaned.replace(regex, '')
    }

    // Remove multiple consecutive fillers
    cleaned = cleaned.replace(/\s+/g, ' ')

    return cleaned.trim()
  }

  private static fixPunctuation(text: string): string {
    let cleaned = text

    for (const fix of this.PUNCTUATION_FIXES) {
      cleaned = cleaned.replace(fix.pattern, fix.replacement)
    }

    return cleaned
  }

  private static capitalizeSentences(text: string): string {
    // Split into sentences and capitalize first letter
    const sentences = text.split(/[.!?]+/)

    const capitalized = sentences.map(sentence => {
      const trimmed = sentence.trim()
      if (trimmed.length === 0) return trimmed

      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    })

    // Join sentences back with appropriate punctuation
    return capitalized.join('. ').replace(/\.+$/, '') + '.'
  }

  // Additional utility methods for future enhancement

  static extractKeyPhrases(text: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || []
    const wordCount: { [key: string]: number } = {}

    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  static estimateConfidence(rawText: string, cleanedText: string): number {
    // Simple confidence estimation based on text quality
    const rawLength = rawText.length
    const cleanedLength = cleanedText.length
    const reductionRatio = cleanedLength / rawLength

    // Higher confidence for texts that needed less cleaning
    const baseConfidence = Math.max(0.5, 1 - (1 - reductionRatio) * 2)

    // Additional factors
    const hasProperPunctuation = /[.!?]/.test(cleanedText)
    const hasVariedVocabulary = new Set(cleanedText.split(' ')).size > cleanedText.split(' ').length * 0.3

    let confidence = baseConfidence
    if (hasProperPunctuation) confidence += 0.1
    if (hasVariedVocabulary) confidence += 0.1

    return Math.min(1.0, confidence)
  }
}