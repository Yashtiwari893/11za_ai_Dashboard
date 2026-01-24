'use client';

import { useEffect } from 'react';
import { initializeLiveVoiceAgent } from '@/lib/live-voice-agent/init';

export default function LiveVoiceAgentInitializer() {
  useEffect(() => {
    // Initialize the live voice agent system on client mount
    initializeLiveVoiceAgent().catch(console.error);

    // Cleanup on unmount
    return () => {
      // Note: In a real implementation, you might want to call shutdownLiveVoiceAgent here
      // But since this is a layout component, it will only unmount on page navigation
    };
  }, []);

  return null; // This component doesn't render anything
}