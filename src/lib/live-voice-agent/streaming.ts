import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { CallSession, CallHandler, sessionManager, providerManager } from './core';
import { VoiceIntelligenceEngine, voiceIntelligence } from './intelligence';

// Real-time Audio Streaming Handler
// Manages WebSocket connections for bidirectional audio streaming

export interface StreamingSession {
  sessionId: string;
  callSession: CallSession;
  callHandler: CallHandler;
  ws: WebSocket;
  audioBuffer: ArrayBuffer[];
  isActive: boolean;
  lastAudioTime: number;
  silenceThreshold: number;
  interruptDetected: boolean;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  speaker: 'customer' | 'agent';
  sequence: number;
}

export class RealTimeStreamingHandler {
  private activeStreams: Map<string, StreamingSession> = new Map();
  private audioChunkSize = 4096; // 256ms at 16kHz
  private silenceTimeout = 30000; // 30 seconds

  async handleWebSocketConnection(
    ws: WebSocket,
    request: IncomingMessage,
    sessionId: string
  ): Promise<void> {
    try {
      // Get call session
      const callSession = await sessionManager.getSession(sessionId);
      if (!callSession) {
        ws.close(4001, 'Invalid session');
        return;
      }

      // Get provider handler
      const provider = providerManager.getProvider(callSession.provider);
      if (!provider) {
        ws.close(4002, 'Provider not available');
        return;
      }

      const callHandler = await provider.handleIncomingCall(callSession);

      // Create streaming session
      const streamingSession: StreamingSession = {
        sessionId,
        callSession,
        callHandler,
        ws,
        audioBuffer: [],
        isActive: true,
        lastAudioTime: Date.now(),
        silenceThreshold: this.silenceTimeout,
        interruptDetected: false
      };

      this.activeStreams.set(sessionId, streamingSession);

      // Setup WebSocket event handlers
      ws.on('message', (data: Buffer) => this.handleAudioMessage(streamingSession, data));
      ws.on('close', () => this.handleStreamClose(sessionId));
      ws.on('error', (error) => this.handleStreamError(sessionId, error));

      // Start the conversation
      await this.initializeConversation(streamingSession);

      console.log(`Streaming session started for ${sessionId}`);

    } catch (error) {
      console.error('Failed to handle WebSocket connection:', error);
      ws.close(4000, 'Internal error');
    }
  }

  private async handleAudioMessage(session: StreamingSession, data: Buffer): Promise<void> {
    try {
      // Parse audio message
      const audioChunk = this.parseAudioMessage(data);
      if (!audioChunk) return;

      session.lastAudioTime = Date.now();

      // Check for interruptions (rapid audio changes)
      if (this.detectInterruption(audioChunk, session)) {
        await voiceIntelligence.handleInterruption(session.sessionId);
        session.interruptDetected = true;
      }

      // Buffer audio for processing
      session.audioBuffer.push(audioChunk.data);

      // Process audio when we have enough data
      if (session.audioBuffer.length >= 4) { // ~1 second of audio
        await this.processAudioBuffer(session);
      }

      // Send acknowledgment
      session.ws.send(JSON.stringify({
        type: 'ack',
        sequence: audioChunk.sequence,
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error('Error handling audio message:', error);
    }
  }

  private parseAudioMessage(data: Buffer): AudioChunk | null {
    try {
      // Assume binary audio data with metadata header
      // Format: [sequence:4][timestamp:8][speaker:1][audio_data...]
      if (data.length < 13) return null;

      const sequence = data.readUInt32LE(0);
      const timestamp = data.readDoubleLE(4);
      const speakerByte = data.readUInt8(12);
      const speaker = speakerByte === 1 ? 'agent' : 'customer';
      const audioData = data.slice(13);

      return {
        data: audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength),
        timestamp,
        speaker,
        sequence
      };
    } catch (error) {
      console.error('Failed to parse audio message:', error);
      return null;
    }
  }

  private detectInterruption(chunk: AudioChunk, session: StreamingSession): boolean {
    // Simple interruption detection based on audio energy changes
    // In a real implementation, this would use more sophisticated VAD
    if (chunk.speaker === 'customer' && session.audioBuffer.length > 0) {
      const previousChunk = session.audioBuffer[session.audioBuffer.length - 1];
      const energy1 = this.calculateAudioEnergy(previousChunk);
      const energy2 = this.calculateAudioEnergy(chunk.data);

      // Detect sudden energy increase (potential interruption)
      return energy2 > energy1 * 2 && energy2 > 1000;
    }
    return false;
  }

  private calculateAudioEnergy(audioData: ArrayBuffer): number {
    const view = new Int16Array(audioData);
    let energy = 0;
    for (let i = 0; i < view.length; i++) {
      energy += view[i] * view[i];
    }
    return energy / view.length;
  }

  private async processAudioBuffer(session: StreamingSession): Promise<void> {
    const audioData = this.concatenateAudioBuffers(session.audioBuffer);
    session.audioBuffer = []; // Clear buffer

    // Send to call handler
    await session.callHandler.onAudioChunk(audioData, 'customer');

    // Process with STT (streaming)
    const transcription = await this.performStreamingSTT(audioData, session);

    if (transcription) {
      // Send transcription to voice intelligence
      const settings = await sessionManager.getVoiceAgentSettings(session.callSession.phoneNumber);
      if (settings) {
        const response = await voiceIntelligence.processTranscription(
          session.sessionId,
          transcription.text,
          transcription.isPartial,
          transcription.confidence,
          settings
        );

        if (response) {
          await this.sendVoiceResponse(session, response);
        }
      }
    }
  }

  private concatenateAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      result.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    return result.buffer;
  }

  private async performStreamingSTT(
    audioData: ArrayBuffer,
    session: StreamingSession
  ): Promise<{ text: string; isPartial: boolean; confidence: number } | null> {
    try {
      // Integrate with OpenAI Whisper or similar streaming STT
      // For now, return mock data
      const mockTranscription = {
        text: "Hello, I need help with my order",
        isPartial: false,
        confidence: 0.85
      };

      // In real implementation:
      // const transcription = await openai.audio.transcriptions.create({
      //   file: audioData,
      //   model: 'whisper-1',
      //   response_format: 'json',
      //   language: session.callSession.language
      // });

      return mockTranscription;
    } catch (error) {
      console.error('STT processing failed:', error);
      return null;
    }
  }

  private async sendVoiceResponse(
    session: StreamingSession,
    response: { text: string; audioData?: ArrayBuffer; shouldEndCall: boolean; shouldTransfer: boolean; transferReason?: string }
  ): Promise<void> {
    try {
      // Generate TTS audio if not provided
      let audioData = response.audioData;
      if (!audioData) {
        const settings = await sessionManager.getVoiceAgentSettings(session.callSession.phoneNumber);
        if (settings) {
          audioData = await this.generateTTS(response.text, settings);
        }
      }

      if (audioData) {
        // Send audio through WebSocket
        const audioMessage = this.createAudioMessage(audioData, 'agent');
        session.ws.send(audioMessage);

        // Send through call handler
        await session.callHandler.sendAudio(audioData);
      }

      // Handle call control
      if (response.shouldEndCall) {
        await this.endCall(session, 'agent_ended');
      } else if (response.shouldTransfer) {
        await this.transferCall(session, response.transferReason || 'ai_escalation');
      }

    } catch (error) {
      console.error('Failed to send voice response:', error);
    }
  }

  private async generateTTS(text: string, settings: any): Promise<ArrayBuffer> {
    // Integrate with TTS provider (Mistral, OpenAI, etc.)
    // For now, return mock audio data
    const mockAudio = new ArrayBuffer(4096);
    new Uint8Array(mockAudio).fill(128); // Mock PCM data

    // In real implementation:
    // const audio = await mistralTTS.generate({
    //   text,
    //   voice: settings.voicePersonality
    // });

    return mockAudio;
  }

  private createAudioMessage(audioData: ArrayBuffer, speaker: 'customer' | 'agent'): Buffer {
    const headerSize = 13;
    const buffer = Buffer.alloc(headerSize + audioData.byteLength);

    // Write header
    buffer.writeUInt32LE(0, 0); // sequence
    buffer.writeDoubleLE(Date.now(), 4); // timestamp
    buffer.writeUInt8(speaker === 'agent' ? 1 : 0, 12); // speaker

    // Write audio data
    Buffer.from(audioData).copy(buffer, headerSize);

    return buffer;
  }

  private async initializeConversation(session: StreamingSession): Promise<void> {
    const settings = await sessionManager.getVoiceAgentSettings(session.callSession.phoneNumber);
    if (!settings) {
      console.error('No voice agent settings found');
      await this.endCall(session, 'no_settings');
      return;
    }

    // Start voice intelligence conversation
    await voiceIntelligence.startConversation(
      session.sessionId,
      session.callSession.phoneNumber,
      session.callSession.callerNumber,
      settings
    );

    // Update call status
    await sessionManager.updateSessionStatus(session.sessionId, 'active');
  }

  private async handleSilenceDetection(session: StreamingSession): Promise<void> {
    const now = Date.now();
    const timeSinceLastAudio = now - session.lastAudioTime;

    if (timeSinceLastAudio > session.silenceThreshold) {
      const settings = await sessionManager.getVoiceAgentSettings(session.callSession.phoneNumber);
      if (settings) {
        const silenceResponse = await voiceIntelligence.handleSilence(
          session.sessionId,
          timeSinceLastAudio / 1000,
          settings
        );

        if (silenceResponse) {
          await this.sendVoiceResponse(session, silenceResponse);
        }
      }
    }
  }

  private async endCall(session: StreamingSession, reason: string): Promise<void> {
    console.log(`Ending call ${session.sessionId}: ${reason}`);

    // Update session status
    await sessionManager.updateSessionStatus(session.sessionId, 'ended', { reason });

    // Save conversation
    await voiceIntelligence.saveConversation(session.sessionId);

    // Close WebSocket
    session.ws.close(1000, reason);
    session.isActive = false;

    // Cleanup
    this.activeStreams.delete(session.sessionId);
  }

  private async transferCall(session: StreamingSession, reason: string): Promise<void> {
    console.log(`Transferring call ${session.sessionId}: ${reason}`);

    const settings = await sessionManager.getVoiceAgentSettings(session.callSession.phoneNumber);
    const transferTo = settings?.humanFallbackNumber;

    if (transferTo) {
      // Update session status
      await sessionManager.updateSessionStatus(session.sessionId, 'transferred', {
        reason,
        transferred_to: transferTo
      });

      // Perform transfer
      await session.callHandler.transferCall(transferTo);

      // Save conversation and cleanup
      await voiceIntelligence.saveConversation(session.sessionId);
      session.ws.close(1000, 'transferred');
      session.isActive = false;
      this.activeStreams.delete(session.sessionId);
    } else {
      // No transfer number, end call
      await this.endCall(session, 'transfer_failed');
    }
  }

  private handleStreamClose(sessionId: string): void {
    const session = this.activeStreams.get(sessionId);
    if (session && session.isActive) {
      console.log(`Stream closed for session ${sessionId}`);
      this.endCall(session, 'websocket_closed');
    }
  }

  private handleStreamError(sessionId: string, error: Error): void {
    console.error(`Stream error for session ${sessionId}:`, error);
    const session = this.activeStreams.get(sessionId);
    if (session) {
      this.endCall(session, 'websocket_error');
    }
  }

  // Periodic cleanup and monitoring
  startMonitoring(): void {
    setInterval(() => {
      this.activeStreams.forEach(session => {
        if (session.isActive) {
          this.handleSilenceDetection(session);
        }
      });
    }, 5000); // Check every 5 seconds
  }

  getActiveStreams(): StreamingSession[] {
    return Array.from(this.activeStreams.values()).filter(s => s.isActive);
  }
}

// Global instance
export const streamingHandler = new RealTimeStreamingHandler();