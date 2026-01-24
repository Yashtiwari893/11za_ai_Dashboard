import { NextRequest, NextResponse } from 'next/server';
import { sessionManager, providerManager } from '@/lib/live-voice-agent/core';
import { voiceIntelligence } from '@/lib/live-voice-agent/intelligence';
import { streamingHandler } from '@/lib/live-voice-agent/streaming';

// Webhook endpoint for incoming calls from telephony providers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = request.headers.get('x-provider') || 'twilio';

    console.log(`Incoming ${provider} webhook:`, body);

    // Handle based on provider
    switch (provider) {
      case 'twilio':
        return await handleTwilioWebhook(body);
      case 'sip':
        return await handleSIPWebhook(body);
      default:
        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleTwilioWebhook(body: any): Promise<NextResponse> {
  const {
    CallSid,
    From: callerNumber,
    To: phoneNumber,
    CallStatus,
    Direction
  } = body;

  // Only handle inbound calls
  if (Direction !== 'inbound') {
    return NextResponse.json({ message: 'Ignored outbound call' });
  }

  try {
    // Check if voice agent is enabled for this number
    const settings = await sessionManager.getVoiceAgentSettings(phoneNumber);
    if (!settings?.enabled) {
      console.log(`Voice agent disabled for ${phoneNumber}`);
      return NextResponse.json({ message: 'Voice agent disabled' });
    }

    // Check business hours
    if (!isWithinBusinessHours(settings.businessHours)) {
      console.log(`Outside business hours for ${phoneNumber}`);
      return generateTwiMLResponse('business_hours_message');
    }

    // Create call session
    const session = await sessionManager.createSession(
      phoneNumber,
      callerNumber,
      'twilio',
      CallSid
    );

    // Generate TwiML response to connect to streaming
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${process.env.NEXT_PUBLIC_DOMAIN}/api/live-voice-agent/stream/${session.id}">
      <Parameter name="sessionId" value="${session.id}" />
    </Stream>
  </Connect>
</Response>`;

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'application/xml' }
    });

  } catch (error) {
    console.error('Twilio webhook handling error:', error);
    return generateTwiMLResponse('error_message');
  }
}

async function handleSIPWebhook(body: any): Promise<NextResponse> {
  // SIP webhook handling (placeholder)
  console.log('SIP webhook received:', body);
  return NextResponse.json({ message: 'SIP not yet implemented' });
}

function isWithinBusinessHours(businessHours: Record<string, { start: string; end: string }>): boolean {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  const hours = businessHours[dayOfWeek];
  if (!hours) return false;

  return currentTime >= hours.start && currentTime <= hours.end;
}

function generateTwiMLResponse(messageType: string): NextResponse {
  const messages = {
    business_hours_message: "Thank you for calling. We're currently outside business hours. Please call back during our operating hours.",
    error_message: "We're experiencing technical difficulties. Please try again later."
  };

  const message = messages[messageType as keyof typeof messages] || messages.error_message;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${message}</Say>
  <Hangup />
</Response>`;

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'application/xml' }
  });
}