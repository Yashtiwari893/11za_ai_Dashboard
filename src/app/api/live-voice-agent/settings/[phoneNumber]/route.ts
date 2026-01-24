import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionManager } from '@/lib/live-voice-agent/core';

// Get voice agent settings for a phone number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    const { phoneNumber } = await params;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const settings = await sessionManager.getVoiceAgentSettings(phoneNumber);

    if (!settings) {
      // Return default settings
      const defaultSettings = {
        enabled: false,
        businessHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: { start: '09:00', end: '18:00' },
          sunday: { start: '09:00', end: '18:00' }
        },
        maxCallDurationMinutes: 30,
        voicePersonality: {
          gender: 'female',
          language: 'hi',
          provider: 'mistral',
          speed: 1.0,
          pitch: 1.0
        },
        escalationTriggers: {
          silenceTimeoutSeconds: 30,
          negativeSentimentThreshold: 0.7,
          lowConfidenceThreshold: 0.5,
          abusiveLanguageDetected: true
        },
        welcomeMessage: 'नमस्ते! मैं आपकी मदद कैसे कर सकता हूँ?',
        goodbyeMessage: 'धन्यवाद! अगर आपकी कोई और मदद चाहिए तो बताएं।'
      };

      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json(settings);

  } catch (error) {
    console.error('Error fetching voice agent settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update voice agent settings for a phone number
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    const { phoneNumber } = await params;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const settings = await request.json();

    // Validate settings
    if (!isValidVoiceAgentSettings(settings)) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    // Upsert settings
    const { data, error } = await supabase
      .from('voice_agent_settings')
      .upsert({
        phone_number: phoneNumber,
        enabled: settings.enabled,
        business_hours: settings.businessHours,
        max_call_duration_minutes: settings.maxCallDurationMinutes,
        human_fallback_number: settings.humanFallbackNumber,
        voice_personality: settings.voicePersonality,
        escalation_triggers: settings.escalationTriggers,
        welcome_message: settings.welcomeMessage,
        goodbye_message: settings.goodbyeMessage,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating voice agent settings:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating voice agent settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete voice agent settings (disable voice agent)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ phoneNumber: string }> }
) {
  try {
    const { phoneNumber } = await params;
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('voice_agent_settings')
      .delete()
      .eq('phone_number', phoneNumber);

    if (error) {
      console.error('Error deleting voice agent settings:', error);
      return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Voice agent disabled' });

  } catch (error) {
    console.error('Error deleting voice agent settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function isValidVoiceAgentSettings(settings: any): boolean {
  return (
    typeof settings.enabled === 'boolean' &&
    typeof settings.maxCallDurationMinutes === 'number' &&
    settings.maxCallDurationMinutes > 0 &&
    settings.maxCallDurationMinutes <= 120 &&
    typeof settings.voicePersonality === 'object' &&
    typeof settings.escalationTriggers === 'object' &&
    typeof settings.welcomeMessage === 'string' &&
    typeof settings.goodbyeMessage === 'string'
  );
}