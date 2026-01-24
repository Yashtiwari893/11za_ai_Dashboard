import { supabase } from '@/lib/supabaseClient';

// Live Voice Agent Core Architecture
// Channel-agnostic voice call handling with real-time AI responses

export interface CallSession {
  id: string;
  phoneNumber: string; // Business number
  callerNumber: string; // Customer number
  sessionId: string; // Provider session ID
  provider: string; // twilio, sip, whatsapp_call
  status: 'ringing' | 'active' | 'ended' | 'transferred' | 'failed';
  language: string;
  detectedLanguage?: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  escalationReason?: string;
  escalationTo?: string;
}

export interface VoiceAgentSettings {
  enabled: boolean;
  businessHours: Record<string, { start: string; end: string }>;
  maxCallDurationMinutes: number;
  humanFallbackNumber?: string;
  voicePersonality: {
    gender: 'male' | 'female';
    language: string;
    provider: string;
    speed: number;
    pitch: number;
  };
  escalationTriggers: {
    silenceTimeoutSeconds: number;
    negativeSentimentThreshold: number;
    lowConfidenceThreshold: number;
    abusiveLanguageDetected: boolean;
  };
  welcomeMessage: string;
  goodbyeMessage: string;
}

// Provider Interface - Channel Agnostic
export interface TelephonyProvider {
  name: string;
  initialize(): Promise<void>;
  handleIncomingCall(session: CallSession): Promise<CallHandler>;
  makeOutboundCall(to: string, from: string): Promise<CallHandler>;
  getSupportedFeatures(): ProviderFeatures;
}

export interface ProviderFeatures {
  realTimeAudio: boolean;
  streamingSTT: boolean;
  streamingTTS: boolean;
  interruptHandling: boolean;
  callTransfer: boolean;
  recording: boolean;
}

export interface CallHandler {
  session: CallSession;
  onAudioChunk: (audioData: ArrayBuffer, speaker: 'customer' | 'agent') => Promise<void>;
  onTranscription: (text: string, isPartial: boolean, confidence: number) => Promise<void>;
  sendAudio: (audioData: ArrayBuffer) => Promise<void>;
  interruptAudio: () => Promise<void>;
  transferCall: (to: string) => Promise<void>;
  endCall: (reason?: string) => Promise<void>;
  getCallMetrics: () => CallMetrics;
}

export interface CallMetrics {
  duration: number;
  audioQuality: number;
  latency: number;
  interruptions: number;
  transcriptions: number;
}

// Twilio Provider Implementation
class TwilioProvider implements TelephonyProvider {
  name = 'twilio';

  async initialize(): Promise<void> {
    // Initialize Twilio client
    console.log('Initializing Twilio provider...');
  }

  async handleIncomingCall(session: CallSession): Promise<CallHandler> {
    // Create Twilio call handler
    return new TwilioCallHandler(session);
  }

  async makeOutboundCall(to: string, from: string): Promise<CallHandler> {
    // Create outbound Twilio call
    throw new Error('Outbound calls not yet implemented');
  }

  getSupportedFeatures(): ProviderFeatures {
    return {
      realTimeAudio: true,
      streamingSTT: true,
      streamingTTS: true,
      interruptHandling: true,
      callTransfer: true,
      recording: true
    };
  }
}

// SIP Provider (Future)
class SIPProvider implements TelephonyProvider {
  name = 'sip';

  async initialize(): Promise<void> {
    console.log('Initializing SIP provider...');
  }

  async handleIncomingCall(session: CallSession): Promise<CallHandler> {
    return new SIPCallHandler(session);
  }

  async makeOutboundCall(to: string, from: string): Promise<CallHandler> {
    throw new Error('Outbound calls not yet implemented');
  }

  getSupportedFeatures(): ProviderFeatures {
    return {
      realTimeAudio: true,
      streamingSTT: false,
      streamingTTS: false,
      interruptHandling: false,
      callTransfer: true,
      recording: true
    };
  }
}

// Provider Manager
export class TelephonyProviderManager {
  private providers: Map<string, TelephonyProvider> = new Map();

  constructor() {
    this.registerProvider(new TwilioProvider());
    this.registerProvider(new SIPProvider());
  }

  registerProvider(provider: TelephonyProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): TelephonyProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Call Session Manager
export class CallSessionManager {
  private activeSessions: Map<string, CallSession> = new Map();

  async createSession(
    phoneNumber: string,
    callerNumber: string,
    provider: string,
    sessionId: string
  ): Promise<CallSession> {
    const session: CallSession = {
      id: crypto.randomUUID(),
      phoneNumber,
      callerNumber,
      sessionId,
      provider,
      status: 'ringing',
      language: 'hi',
      startedAt: new Date()
    };

    // Save to database
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({
        id: session.id,
        phone_number: phoneNumber,
        caller_number: callerNumber,
        session_id: sessionId,
        provider,
        status: 'ringing',
        language: 'hi'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create call session: ${error.message}`);
    }

    this.activeSessions.set(session.id, session);
    console.log(`Created call session: ${session.id} for ${callerNumber} → ${phoneNumber}`);

    return session;
  }

  async updateSessionStatus(sessionId: string, status: CallSession['status'], metadata?: any): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
      if (status === 'ended' || status === 'transferred') {
        session.endedAt = new Date();
        session.durationSeconds = session.endedAt.getTime() - session.startedAt.getTime();
      }
    }

    const updateData: any = { status };
    if (metadata) {
      updateData.metadata = metadata;
    }
    if (status === 'ended' || status === 'transferred') {
      updateData.ended_at = new Date().toISOString();
      updateData.duration_seconds = session?.durationSeconds;
    }

    const { error } = await supabase
      .from('call_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error(`Failed to update session ${sessionId} status:`, error);
    }
  }

  async getSession(sessionId: string): Promise<CallSession | null> {
    // Check active sessions first
    const activeSession = this.activeSessions.get(sessionId);
    if (activeSession) {
      return activeSession;
    }

    // Load from database
    const { data, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      phoneNumber: data.phone_number,
      callerNumber: data.caller_number,
      sessionId: data.session_id,
      provider: data.provider,
      status: data.status,
      language: data.language,
      detectedLanguage: data.detected_language,
      startedAt: new Date(data.started_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : undefined,
      durationSeconds: data.duration_seconds,
      escalationReason: data.escalation_reason,
      escalationTo: data.escalation_to
    };
  }

  async getActiveSessions(): Promise<CallSession[]> {
    return Array.from(this.activeSessions.values()).filter(s => s.status === 'active');
  }

  async getVoiceAgentSettings(phoneNumber: string): Promise<VoiceAgentSettings | null> {
    const { data, error } = await supabase
      .from('voice_agent_settings')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      enabled: data.enabled,
      businessHours: data.business_hours,
      maxCallDurationMinutes: data.max_call_duration_minutes,
      humanFallbackNumber: data.human_fallback_number,
      voicePersonality: data.voice_personality,
      escalationTriggers: data.escalation_triggers,
      welcomeMessage: data.welcome_message,
      goodbyeMessage: data.goodbye_message
    };
  }
}

// Global instances
export const providerManager = new TelephonyProviderManager();
export const sessionManager = new CallSessionManager();

// Placeholder implementations (to be implemented based on actual providers)
class TwilioCallHandler implements CallHandler {
  constructor(public session: CallSession) {}

  async onAudioChunk(audioData: ArrayBuffer, speaker: 'customer' | 'agent'): Promise<void> {
    // Handle incoming audio chunk
    console.log(`Twilio: Received ${audioData.byteLength} bytes from ${speaker}`);
  }

  async onTranscription(text: string, isPartial: boolean, confidence: number): Promise<void> {
    // Handle transcription update
    console.log(`Twilio: Transcription ${isPartial ? '(partial)' : '(final)'}: ${text}`);
  }

  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    // Send audio to caller
    console.log(`Twilio: Sending ${audioData.byteLength} bytes of audio`);
  }

  async interruptAudio(): Promise<void> {
    // Interrupt current audio playback
    console.log('Twilio: Interrupting audio playback');
  }

  async transferCall(to: string): Promise<void> {
    // Transfer call to human agent
    console.log(`Twilio: Transferring call to ${to}`);
  }

  async endCall(reason?: string): Promise<void> {
    // End the call
    console.log(`Twilio: Ending call${reason ? ` (${reason})` : ''}`);
  }

  getCallMetrics(): CallMetrics {
    return {
      duration: 0,
      audioQuality: 1.0,
      latency: 100,
      interruptions: 0,
      transcriptions: 0
    };
  }
}

class SIPCallHandler implements CallHandler {
  constructor(public session: CallSession) {}

  async onAudioChunk(audioData: ArrayBuffer, speaker: 'customer' | 'agent'): Promise<void> {
    throw new Error('SIP audio streaming not implemented');
  }

  async onTranscription(text: string, isPartial: boolean, confidence: number): Promise<void> {
    throw new Error('SIP transcription not implemented');
  }

  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    throw new Error('SIP audio sending not implemented');
  }

  async interruptAudio(): Promise<void> {
    throw new Error('SIP interrupt not implemented');
  }

  async transferCall(to: string): Promise<void> {
    console.log(`SIP: Transferring call to ${to}`);
  }

  async endCall(reason?: string): Promise<void> {
    console.log(`SIP: Ending call${reason ? ` (${reason})` : ''}`);
  }

  getCallMetrics(): CallMetrics {
    return {
      duration: 0,
      audioQuality: 0.8,
      latency: 200,
      interruptions: 0,
      transcriptions: 0
    };
  }
}