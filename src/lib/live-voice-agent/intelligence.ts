import { supabase } from '@/lib/supabaseClient';
import { VoiceBrain } from '@/lib/voice-brain';
import { TTSManager } from '@/lib/voice/tts';
import { CallSession, CallHandler, VoiceAgentSettings } from './core';

// Real-time Voice Intelligence Pipeline
// Handles AI conversation logic, interrupt detection, and human-like responses

export interface ConversationContext {
  sessionId: string;
  phoneNumber: string;
  callerNumber: string;
  language: string;
  conversationHistory: ConversationTurn[];
  currentIntent?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  silenceCount: number;
  lastActivity: Date;
  escalationScore: number;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'customer' | 'agent';
  text: string;
  audioUrl?: string;
  intent?: string;
  sentiment?: number;
  confidence?: number;
  isInterrupted?: boolean;
}

export interface VoiceResponse {
  text: string;
  audioData?: ArrayBuffer;
  shouldEndCall: boolean;
  shouldTransfer: boolean;
  transferReason?: string;
  confidence: number;
  intent: string;
}

// Voice Intelligence Engine
export class VoiceIntelligenceEngine {
  private voiceBrain: VoiceBrain;
  private ttsManager: TTSManager;
  private activeContexts: Map<string, ConversationContext> = new Map();

  constructor() {
    this.voiceBrain = new VoiceBrain();
    this.ttsManager = new TTSManager();
  }

  async initialize(): Promise<void> {
    await this.voiceBrain.initialize();
    // TTS manager is initialized on demand
  }

  async startConversation(
    sessionId: string,
    phoneNumber: string,
    callerNumber: string,
    settings: VoiceAgentSettings
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      sessionId,
      phoneNumber,
      callerNumber,
      language: settings.voicePersonality.language,
      conversationHistory: [],
      sentiment: 'neutral',
      confidence: 1.0,
      silenceCount: 0,
      lastActivity: new Date(),
      escalationScore: 0
    };

    this.activeContexts.set(sessionId, context);

    // Generate welcome message
    const welcomeResponse = await this.generateResponse(context, settings.welcomeMessage, settings);
    context.conversationHistory.push({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      speaker: 'agent',
      text: welcomeResponse.text,
      intent: 'greeting',
      confidence: welcomeResponse.confidence
    });

    return context;
  }

  async processTranscription(
    sessionId: string,
    transcription: string,
    isPartial: boolean,
    confidence: number,
    settings: VoiceAgentSettings
  ): Promise<VoiceResponse | null> {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      console.error(`No active context for session ${sessionId}`);
      return null;
    }

    // Update context with new transcription
    context.lastActivity = new Date();
    context.silenceCount = 0;

    if (!isPartial) {
      // Add customer turn to history
      const customerTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        speaker: 'customer',
        text: transcription,
        confidence
      };

      context.conversationHistory.push(customerTurn);

      // Analyze sentiment and intent
      const analysis = await this.analyzeText(transcription);
      context.sentiment = analysis.sentiment;
      context.currentIntent = analysis.intent;
      context.confidence = analysis.confidence;

      // Update escalation score
      context.escalationScore = this.calculateEscalationScore(context, analysis, settings);

      // Check for escalation triggers
      if (this.shouldEscalate(context, settings)) {
        return {
          text: settings.goodbyeMessage,
          shouldEndCall: false,
          shouldTransfer: true,
          transferReason: this.getEscalationReason(context),
          confidence: 0.9,
          intent: 'escalation'
        };
      }

      // Generate AI response using Voice Brain
      const response = await this.generateResponse(context, transcription, settings);

      // Add agent turn to history
      const agentTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        speaker: 'agent',
        text: response.text,
        intent: response.intent,
        confidence: response.confidence
      };

      context.conversationHistory.push(agentTurn);

      return response;
    }

    return null; // Partial transcription, no response yet
  }

  async handleSilence(sessionId: string, durationSeconds: number, settings: VoiceAgentSettings): Promise<VoiceResponse | null> {
    const context = this.activeContexts.get(sessionId);
    if (!context) return null;

    context.silenceCount += durationSeconds;

    // Check silence timeout
    if (context.silenceCount >= settings.escalationTriggers.silenceTimeoutSeconds) {
      return {
        text: "I haven't heard from you for a while. Let me transfer you to a human representative.",
        shouldEndCall: false,
        shouldTransfer: true,
        transferReason: 'silence_timeout',
        confidence: 0.9,
        intent: 'silence_timeout'
      };
    }

    // Generate gentle prompt if silence is getting long
    if (context.silenceCount >= 10) {
      return {
        text: "Are you still there?",
        shouldEndCall: false,
        shouldTransfer: false,
        confidence: 0.8,
        intent: 'silence_check'
      };
    }

    return null;
  }

  async handleInterruption(sessionId: string): Promise<void> {
    const context = this.activeContexts.get(sessionId);
    if (!context) return;

    // Mark last agent turn as interrupted
    const lastAgentTurn = context.conversationHistory
      .filter(turn => turn.speaker === 'agent')
      .pop();

    if (lastAgentTurn) {
      lastAgentTurn.isInterrupted = true;
    }

    console.log(`Interruption detected in session ${sessionId}`);
  }

  private async analyzeText(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    confidence: number;
  }> {
    // Use Voice Brain for intent analysis
    const intentResult = await this.voiceBrain.analyzeIntent(text);

    // Simple sentiment analysis (could be enhanced with ML model)
    const sentiment = this.analyzeSentiment(text);

    return {
      sentiment,
      intent: intentResult.intent,
      confidence: intentResult.confidence
    };
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['good', 'great', 'excellent', 'thanks', 'thank you', 'helpful', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'angry', 'frustrated', 'stupid'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateEscalationScore(
    context: ConversationContext,
    analysis: { sentiment: string; intent: string; confidence: number },
    settings: VoiceAgentSettings
  ): number {
    let score = 0;

    // Low confidence in understanding
    if (analysis.confidence < settings.escalationTriggers.lowConfidenceThreshold) {
      score += 0.3;
    }

    // Negative sentiment
    if (analysis.sentiment === 'negative') {
      score += 0.4;
    }

    // Repeated low confidence turns
    const recentTurns = context.conversationHistory.slice(-5);
    const lowConfidenceTurns = recentTurns.filter(turn => turn.confidence && turn.confidence < 0.6).length;
    if (lowConfidenceTurns >= 3) {
      score += 0.3;
    }

    // Long conversation without resolution
    if (context.conversationHistory.length > 20) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private shouldEscalate(context: ConversationContext, settings: VoiceAgentSettings): boolean {
    return (
      context.escalationScore >= 0.7 ||
      context.sentiment === 'negative' && context.escalationScore >= 0.5 ||
      context.confidence < settings.escalationTriggers.lowConfidenceThreshold
    );
  }

  private getEscalationReason(context: ConversationContext): string {
    if (context.sentiment === 'negative') return 'negative_sentiment';
    if (context.confidence < 0.5) return 'low_confidence';
    if (context.escalationScore >= 0.7) return 'high_escalation_score';
    return 'general_escalation';
  }

  private async generateResponse(
    context: ConversationContext,
    userInput: string,
    settings: VoiceAgentSettings
  ): Promise<VoiceResponse> {
    try {
      // Use Voice Brain to generate human-like response
      const voiceBrainResponse = await this.voiceBrain.generateResponse(
        context.conversationHistory,
        userInput,
        context.language
      );

      // Check for call control intents
      const controlIntent = this.detectCallControlIntent(userInput);
      if (controlIntent) {
        return this.handleCallControlIntent(controlIntent, settings);
      }

      return {
        text: voiceBrainResponse.text,
        shouldEndCall: voiceBrainResponse.shouldEndCall,
        shouldTransfer: false,
        confidence: voiceBrainResponse.confidence,
        intent: voiceBrainResponse.intent
      };

    } catch (error) {
      console.error('Error generating response:', error);

      // Fallback response
      return {
        text: "I'm sorry, I'm having trouble understanding. Let me connect you with a human representative.",
        shouldEndCall: false,
        shouldTransfer: true,
        transferReason: 'ai_error',
        confidence: 0.5,
        intent: 'error_fallback'
      };
    }
  }

  private detectCallControlIntent(text: string): string | null {
    const lowerText = text.toLowerCase();

    const controlPatterns = {
      'end_call': ['goodbye', 'bye', 'hang up', 'end call', 'that\'s all'],
      'transfer_human': ['speak to human', 'talk to person', 'human representative', 'real person'],
      'repeat': ['repeat that', 'say again', 'what did you say'],
      'louder': ['louder', 'speak up', 'can\'t hear you'],
      'slower': ['slower', 'speak slower', 'slow down']
    };

    for (const [intent, patterns] of Object.entries(controlPatterns)) {
      if (patterns.some(pattern => lowerText.includes(pattern))) {
        return intent;
      }
    }

    return null;
  }

  private handleCallControlIntent(intent: string, settings: VoiceAgentSettings): VoiceResponse {
    switch (intent) {
      case 'end_call':
        return {
          text: settings.goodbyeMessage,
          shouldEndCall: true,
          shouldTransfer: false,
          confidence: 0.9,
          intent: 'end_call'
        };

      case 'transfer_human':
        return {
          text: "I'll connect you with a human representative right away.",
          shouldEndCall: false,
          shouldTransfer: true,
          transferReason: 'user_request',
          confidence: 0.9,
          intent: 'transfer_human'
        };

      case 'repeat':
        return {
          text: "I'll repeat that for you.",
          shouldEndCall: false,
          shouldTransfer: false,
          confidence: 0.8,
          intent: 'repeat'
        };

      case 'louder':
        return {
          text: "I'll speak louder now.",
          shouldEndCall: false,
          shouldTransfer: false,
          confidence: 0.8,
          intent: 'louder'
        };

      case 'slower':
        return {
          text: "I'll speak more slowly.",
          shouldEndCall: false,
          shouldTransfer: false,
          confidence: 0.8,
          intent: 'slower'
        };

      default:
        return {
          text: "I'm not sure what you mean. Could you please clarify?",
          shouldEndCall: false,
          shouldTransfer: false,
          confidence: 0.6,
          intent: 'clarify'
        };
    }
  }

  async saveConversation(sessionId: string): Promise<void> {
    const context = this.activeContexts.get(sessionId);
    if (!context) return;

    // Save conversation history to database
    const transcripts = context.conversationHistory.map(turn => ({
      session_id: sessionId,
      speaker: turn.speaker,
      text: turn.text,
      timestamp: turn.timestamp.toISOString(),
      intent: turn.intent,
      confidence: turn.confidence,
      sentiment: turn.sentiment,
      is_interrupted: turn.isInterrupted
    }));

    const { error } = await supabase
      .from('call_transcripts')
      .insert(transcripts);

    if (error) {
      console.error('Failed to save conversation:', error);
    }

    // Remove from active contexts
    this.activeContexts.delete(sessionId);
  }

  getActiveContexts(): ConversationContext[] {
    return Array.from(this.activeContexts.values());
  }
}

// Global instance
export const voiceIntelligence = new VoiceIntelligenceEngine();