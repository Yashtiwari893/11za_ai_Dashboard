import { voiceIntelligence } from '@/lib/live-voice-agent/intelligence';
import { streamingHandler } from '@/lib/live-voice-agent/streaming';

// Initialize the Live Voice Agent system
export async function initializeLiveVoiceAgent(): Promise<void> {
  try {
    console.log('Initializing Live Voice Agent system...');

    // Initialize voice intelligence engine
    await voiceIntelligence.initialize();
    console.log('✓ Voice Intelligence Engine initialized');

    // Start streaming handler monitoring
    streamingHandler.startMonitoring();
    console.log('✓ Real-time Streaming Handler monitoring started');

    console.log('🎉 Live Voice Agent system ready!');

  } catch (error) {
    console.error('Failed to initialize Live Voice Agent system:', error);
    throw error;
  }
}

// Graceful shutdown
export async function shutdownLiveVoiceAgent(): Promise<void> {
  try {
    console.log('Shutting down Live Voice Agent system...');

    // Save any active conversations
    const activeContexts = voiceIntelligence.getActiveContexts();
    for (const context of activeContexts) {
      await voiceIntelligence.saveConversation(context.sessionId);
    }

    console.log('✓ Active conversations saved');

    // Close active streams
    const activeStreams = streamingHandler.getActiveStreams();
    for (const stream of activeStreams) {
      stream.ws.close(1000, 'server_shutdown');
    }

    console.log('✓ Active streams closed');

    console.log('👋 Live Voice Agent system shut down gracefully');

  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}