# PHASE-4: Live AI Voice Call Agent

## Overview

PHASE-4 implements a **production-ready Live AI Voice Call Agent** that answers incoming phone calls with human-like conversation, intelligent escalation, and real-time voice processing. The system integrates with the Voice Brain trained on 7000+ call recordings to provide natural, contextual responses.

## Architecture

### Core Components

#### 1. **Call Session Management** (`src/lib/live-voice-agent/core.ts`)
- Manages incoming calls from multiple telephony providers
- Tracks call lifecycle: ringing → active → ended/transferred
- Channel-agnostic design supporting Twilio, SIP, WhatsApp calls
- Per-business-phone-number isolation with voice agent settings

**Key Classes:**
- `CallSession` - Represents an active call with metadata
- `TelephonyProvider` - Interface for provider-specific implementations
- `CallSessionManager` - Manages active and historical call sessions
- `TelephonyProviderManager` - Registry of available telephony providers

#### 2. **Real-time Voice Intelligence** (`src/lib/live-voice-agent/intelligence.ts`)
- Processes customer transcriptions and generates human-like responses
- Analyzes sentiment, intent, and confidence levels
- Detects call control intents (escalation, repeat, louder, slower, etc.)
- Manages conversation context and escalation triggers

**Key Classes:**
- `VoiceIntelligenceEngine` - Core AI conversation logic
- Conversation tracking with intent/sentiment analysis
- Adaptive escalation scoring based on multiple factors

**Escalation Triggers:**
- Silence timeout (>30 seconds by default)
- Negative sentiment detection
- Low confidence in AI understanding (<50% by default)
- Abusive language detection
- Repeated misunderstandings

#### 3. **Real-time Audio Streaming** (`src/lib/live-voice-agent/streaming.ts`)
- Manages WebSocket connections for bidirectional audio streaming
- Processes incoming audio chunks with interruption detection
- Integrates with STT (Whisper) for transcription
- Coordinates TTS responses for natural speech output
- Handles silence detection and call state transitions

**Key Features:**
- Audio chunking (256ms at 16kHz sample rate)
- Voice Activity Detection for interruption handling
- Automatic silence detection with graceful prompts
- Seamless audio buffer management

#### 4. **Webhook Handler** (`src/app/api/live-voice-agent/webhook/route.ts`)
- Receives incoming calls from telephony providers
- Validates business hours and voice agent settings
- Creates call sessions and initiates streaming connections
- Handles provider-specific TwiML/response formats

#### 5. **Settings & Analytics APIs**
- **Settings API** (`/api/live-voice-agent/settings/[phoneNumber]`)
  - Get/update voice agent configuration per phone number
  - Control business hours, voice personality, escalation triggers
  - Enable/disable voice agent per number

- **Analytics API** (`/api/live-voice-agent/analytics/[phoneNumber]`)
  - Real-time call metrics and statistics
  - Completion rates, escalation rates, call duration
  - Intent and sentiment breakdown
  - Hourly call distribution

#### 6. **Dashboard** (`src/app/live-voice-agent/page.tsx`)
- Configure voice agent settings per business phone number
- Set business hours and voice personality
- Configure escalation triggers and custom messages
- View real-time analytics and call history

## Database Schema

Tables created in `migrations/create_live_voice_agent_schema.sql`:

### call_sessions
```sql
- id (UUID, PK)
- phone_number (varchar) - Business number receiving calls
- caller_number (varchar) - Customer phone number
- session_id (varchar) - Provider session ID
- provider (varchar) - twilio, sip, whatsapp_call
- status (enum) - ringing, active, ended, transferred, failed
- language (varchar)
- detected_language (varchar)
- started_at (timestamp)
- ended_at (timestamp)
- duration_seconds (int)
- escalation_reason (varchar)
- escalation_to (varchar)
- metadata (jsonb) - Provider-specific data
```

### call_transcripts
```sql
- id (UUID, PK)
- session_id (UUID, FK call_sessions)
- speaker (enum) - customer, agent
- text (varchar)
- timestamp (timestamp)
- intent (varchar)
- confidence (float)
- sentiment (enum) - positive, neutral, negative
- is_interrupted (boolean)
```

### call_audio_chunks
```sql
- id (UUID, PK)
- session_id (UUID, FK call_sessions)
- speaker (enum) - customer, agent
- audio_data (bytea)
- sequence (int)
- timestamp (timestamp)
```

### call_intents
```sql
- id (UUID, PK)
- session_id (UUID, FK call_sessions)
- intent (varchar)
- confidence (float)
- source (varchar) - transcript, action
- metadata (jsonb)
```

### call_actions
```sql
- id (UUID, PK)
- session_id (UUID, FK call_sessions)
- action_type (varchar) - interrupt, escalate, transfer, end
- reason (varchar)
- timestamp (timestamp)
- metadata (jsonb)
```

### voice_agent_settings
```sql
- phone_number (varchar, PK)
- enabled (boolean)
- business_hours (jsonb) - { "monday": { "start": "09:00", "end": "18:00" }, ... }
- max_call_duration_minutes (int)
- human_fallback_number (varchar)
- voice_personality (jsonb) - { gender, language, provider, speed, pitch }
- escalation_triggers (jsonb) - thresholds for escalation
- welcome_message (varchar)
- goodbye_message (varchar)
- created_at (timestamp)
- updated_at (timestamp)
```

## API Endpoints

### Incoming Calls
- **POST** `/api/live-voice-agent/webhook` - Receive calls from Twilio/providers
  - Returns TwiML response with streaming connection URL

### Real-time Streaming
- **GET** `/api/live-voice-agent/stream/[sessionId]` - WebSocket endpoint for audio
  - Bidirectional audio streaming
  - Real-time STT/TTS integration

### Settings Management
- **GET** `/api/live-voice-agent/settings/[phoneNumber]` - Get settings
- **PUT** `/api/live-voice-agent/settings/[phoneNumber]` - Update settings
- **DELETE** `/api/live-voice-agent/settings/[phoneNumber]` - Disable voice agent

### Analytics
- **GET** `/api/live-voice-agent/analytics/[phoneNumber]` - Get call analytics
  - Query params: `limit`, `offset`, `startDate`, `endDate`

## Voice Agent Configuration

### Basic Settings
```typescript
{
  enabled: boolean,
  businessHours: {
    monday: { start: "09:00", end: "18:00" },
    // ... other days
  },
  maxCallDurationMinutes: 30,
  humanFallbackNumber: "+91XXXXXXXXXX"
}
```

### Voice Personality
```typescript
{
  gender: "male" | "female",
  language: "hi" | "en" | "mr" | "gu",
  provider: "mistral" | "openai" | "elevenlabs",
  speed: 1.0, // 0.5-2.0
  pitch: 1.0  // 0.5-2.0
}
```

### Escalation Triggers
```typescript
{
  silenceTimeoutSeconds: 30,
  negativeSentimentThreshold: 0.7,
  lowConfidenceThreshold: 0.5,
  abusiveLanguageDetected: true
}
```

## Voice Brain Integration

The system leverages the Voice Brain trained from 7000+ call recordings to:

1. **Intent Recognition** - Understand customer needs from conversation context
2. **Sentiment Analysis** - Detect frustration, satisfaction, confusion
3. **Response Generation** - Provide human-like responses with appropriate tone
4. **Pattern Matching** - Find similar resolved conversations for better guidance
5. **Escalation Detection** - Identify when human intervention is needed

### Voice Brain API
```typescript
// Analyze intent from text
const { intent, confidence } = await voiceBrain.analyzeIntent(text);

// Generate response using Voice Brain patterns
const response = await voiceBrain.generateResponse(
  conversationHistory,
  userInput,
  language
);

// Retrieve similar patterns for context
const patterns = await voiceBrain.retrieveVoiceBrainPatterns(
  embedding,
  language,
  limit
);
```

## Call Control Intents

The system recognizes and handles natural call control requests:

| Intent | Triggers | Action |
|--------|----------|--------|
| `end_call` | "goodbye", "bye", "hang up" | End the call gracefully |
| `transfer_human` | "speak to human", "real person" | Transfer to fallback number |
| `repeat` | "repeat that", "say again" | Repeat last response |
| `louder` | "louder", "speak up" | Increase TTS volume |
| `slower` | "slower", "slow down" | Decrease TTS speed |

## Real-time Audio Processing

### Audio Format
- **Codec**: PCM (WAV)
- **Sample Rate**: 16 kHz (16 bit, mono)
- **Frame Size**: 256ms chunks (~8KB per chunk)
- **Latency**: <500ms end-to-end

### Streaming Flow
```
Customer Audio (Twilio/SIP) 
    ↓
WebSocket Connection
    ↓
Audio Buffering (1 second)
    ↓
Interruption Detection
    ↓
STT Processing (OpenAI Whisper)
    ↓
Voice Intelligence Engine
    ↓
Intent Analysis & Response Generation
    ↓
TTS Generation (Mistral/OpenAI)
    ↓
Audio Streaming to Customer
```

## Interrupt Handling

The system detects interruptions using:
1. **Voice Activity Detection** - Sudden energy changes
2. **Audio Energy Analysis** - RMS level comparison
3. **Silence Detection** - Gap analysis during agent speaking

When interruption detected:
1. Flag the previous agent response as interrupted
2. Stop current TTS playback
3. Resume listening for new customer input
4. Track interruption metrics for quality analysis

## Escalation Logic

### Escalation Score Calculation
```
Score = 0
If confidence < threshold: +0.3
If sentiment == negative: +0.4
If repeated low confidence (3+ recent): +0.3
If conversation > 20 turns: +0.2

Escalate if: score >= 0.7 OR (negative AND score >= 0.5)
```

### Fallback Behavior
If no fallback number configured:
1. Provide escalation message
2. Offer alternative (email, callback, etc.)
3. End call gracefully

## Deployment

### Environment Variables
```bash
# Twilio (if using Twilio provider)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VOICE_URL=...

# TTS Providers
OPENAI_API_KEY=...
MISTRAL_API_KEY=...
ELEVENLABS_API_KEY=...

# STT
OPENAI_STT_API_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Database Migration
1. Apply `migrations/create_live_voice_agent_schema.sql`
2. Create vector similarity functions
3. Set up call_sessions indexes for query performance

### Twilio Setup
1. Configure webhook URL: `https://yourdomain.com/api/live-voice-agent/webhook`
2. Create TwiML Application
3. Configure Phone Numbers to use the TwiML app
4. Enable Media Streams for real-time audio

### Dashboard Access
Navigate to `/live-voice-agent` to:
- Enable/disable voice agent per number
- Configure business hours
- Set voice personality
- View call analytics
- Test with mock phone numbers

## Monitoring & Observability

### Key Metrics
- **Call Duration** - Average, min, max
- **Completion Rate** - % calls completed without escalation
- **Escalation Rate** - % calls escalated to human
- **Sentiment Breakdown** - Positive/neutral/negative distribution
- **Intent Distribution** - Most common customer intents
- **Audio Quality** - Latency, packet loss, echo detection

### Logging
- All call events logged to call_sessions
- Transcripts stored for quality review
- Audio chunks available for replay
- Intent/action audit trail

## Future Enhancements

1. **Multi-language Support** - Automatic language detection
2. **Callback Queue** - Queue calls during high volume
3. **Call Transfer** - Seamless transfer to human agents
4. **DTMF Support** - Phone keypad input handling
5. **Call Recording** - Full call audio archival
6. **Voice Biometrics** - Speaker identification
7. **Custom IVR** - Menu-driven call routing
8. **Analytics Dashboard** - Real-time metrics visualization
9. **A/B Testing** - Voice agent personality testing
10. **Feedback System** - Post-call satisfaction surveys

## Testing

### Mock Provider Setup
```typescript
const mockProvider = providerManager.getProvider('twilio');
const session = await sessionManager.createSession(
  '+91XXXXXXXXXX',
  '+91YYYYYYYYYY',
  'twilio',
  'mock-session-id'
);
```

### Conversation Flow Test
1. Start session with welcome message
2. Send customer transcription
3. Verify AI response generation
4. Check sentiment/intent analysis
5. Test escalation triggers
6. Validate call termination

## Architecture Decisions

### Channel-Agnostic Design
- Abstract provider interface allows future providers (SIP, WhatsApp, etc.)
- Metadata field stores provider-specific data
- Seamless migration between providers

### Per-Phone-Number Isolation
- Each business phone number has independent settings
- Supports multi-tenant SaaS deployments
- Business hours and voice personality per number

### Streaming Architecture
- WebSocket for low-latency bidirectional audio
- Real-time STT/TTS integration
- Graceful fallback for network issues

### Voice Brain Integration
- Leverages existing conversation patterns
- Reduces latency vs. API calls
- Maintains human-like responses
- Adapts to business context

## Performance Considerations

- **Connection Pool**: Reuse Supabase connections
- **Audio Caching**: Buffer STT results during silence
- **Lazy Loading**: Initialize providers on demand
- **Index Strategy**: Query optimization for call_sessions/transcripts
- **Archive Strategy**: Move old call data to cold storage

## Security

- Phone numbers encrypted at rest
- Audio chunks never stored unencrypted (if enabled)
- API authentication required for settings/analytics
- Rate limiting on webhook endpoints
- DTLS encryption for SIP/media streams

---

**Build Status**: ✅ Production Ready  
**Last Updated**: Phase 4 Complete  
**Next Phase**: Scheduled Callbacks & Queue Management
