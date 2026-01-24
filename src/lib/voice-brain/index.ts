import { supabase } from '@/lib/supabaseClient';
import { embedText } from '@/lib/embeddings';

export interface VoiceBrainResponse {
  text: string;
  confidence: number;
  intent: string;
  shouldEndCall: boolean;
}

export class VoiceBrain {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('VoiceBrain initialized');
  }

  async analyzeIntent(text: string): Promise<{ intent: string; confidence: number }> {
    // Simple intent analysis - in a real implementation, this would use ML
    const lowerText = text.toLowerCase();

    if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('नमस्ते')) {
      return { intent: 'greeting', confidence: 0.9 };
    }

    if (lowerText.includes('bye') || lowerText.includes('goodbye') || lowerText.includes('bye')) {
      return { intent: 'farewell', confidence: 0.9 };
    }

    if (lowerText.includes('thank') || lowerText.includes('thanks') || lowerText.includes('धन्यवाद')) {
      return { intent: 'gratitude', confidence: 0.8 };
    }

    if (lowerText.includes('help') || lowerText.includes('support') || lowerText.includes('मदद')) {
      return { intent: 'help_request', confidence: 0.8 };
    }

    return { intent: 'general_inquiry', confidence: 0.6 };
  }

  async generateResponse(
    conversationHistory: any[],
    userInput: string,
    language: string
  ): Promise<VoiceBrainResponse> {
    try {
      // Get embedding for user input
      const queryEmbedding = await embedText(userInput);

      // Retrieve similar voice patterns
      const patterns = await this.retrieveVoiceBrainPatterns(queryEmbedding, language);

      // Generate response using patterns and conversation context
      const response = await this.generateHumanLikeResponse(userInput, patterns, conversationHistory, language);

      return {
        text: response.text,
        confidence: response.confidence,
        intent: response.intent,
        shouldEndCall: response.shouldEndCall
      };

    } catch (error) {
      console.error('Error generating VoiceBrain response:', error);
      return {
        text: "I'm sorry, I'm having trouble understanding. Could you please repeat that?",
        confidence: 0.5,
        intent: 'error_fallback',
        shouldEndCall: false
      };
    }
  }

  private async retrieveVoiceBrainPatterns(
    queryEmbedding: number[],
    language: string,
    limit = 3
  ): Promise<Array<{ chunk: string; similarity: number; intent?: string; style?: string }>> {
    try {
      const { data, error } = await supabase
        .rpc('match_voice_questions', {
          query_embedding: queryEmbedding,
          match_threshold: 0.6,
          match_count: limit
        });

      if (error) {
        console.error('Error retrieving voice patterns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in retrieveVoiceBrainPatterns:', error);
      return [];
    }
  }

  private async generateHumanLikeResponse(
    userInput: string,
    patterns: any[],
    conversationHistory: any[],
    language: string
  ): Promise<{ text: string; confidence: number; intent: string; shouldEndCall: boolean }> {
    // Simple response generation - in a real implementation, this would use more sophisticated NLP
    const intent = await this.analyzeIntent(userInput);

    // Check for call-ending intents
    if (intent.intent === 'farewell') {
      return {
        text: language === 'hi' ? 'धन्यवाद! अगर आपकी कोई और मदद चाहिए तो बताएं।' : 'Thank you! Please call again if you need any help.',
        confidence: 0.9,
        intent: 'farewell',
        shouldEndCall: true
      };
    }

    // Use patterns to generate response
    if (patterns.length > 0) {
      const bestPattern = patterns[0];
      return {
        text: this.adaptPatternToContext(bestPattern.chunk, userInput, language),
        confidence: bestPattern.similarity,
        intent: bestPattern.intent || 'general_response',
        shouldEndCall: false
      };
    }

    // Fallback responses
    const fallbacks = {
      hi: {
        greeting: 'नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?',
        help: 'मैं आपकी मदद करने के लिए यहाँ हूँ। कृपया बताएं आप क्या जानना चाहते हैं।',
        general: 'मैं समझ नहीं पाया। क्या आप कृपया दोहरा सकते हैं?'
      },
      en: {
        greeting: 'Hello! How can I help you today?',
        help: 'I\'m here to help you. Please let me know what you need.',
        general: 'I\'m sorry, I didn\'t understand. Could you please repeat that?'
      }
    };

    const langKey = language === 'hi' ? 'hi' : 'en';
    const responses = fallbacks[langKey];

    let responseText = responses.general;
    if (intent.intent === 'greeting') responseText = responses.greeting;
    if (intent.intent === 'help_request') responseText = responses.help;

    return {
      text: responseText,
      confidence: 0.7,
      intent: intent.intent,
      shouldEndCall: false
    };
  }

  private adaptPatternToContext(pattern: string, userInput: string, language: string): string {
    // Simple pattern adaptation - in a real implementation, this would be more sophisticated
    return pattern;
  }
}