# Quick Reference: Live Voice Agent

## 🚀 Getting Started

### 1. Enable Voice Agent for a Number
```bash
POST /api/live-voice-agent/settings/+91XXXXXXXXXX
{
  "enabled": true,
  "businessHours": {
    "monday": { "start": "09:00", "end": "18:00" },
    ...
  },
  "maxCallDurationMinutes": 30,
  "humanFallbackNumber": "+91YYYYYYYYYY",
  "voicePersonality": {
    "gender": "female",
    "language": "hi",
    "provider": "mistral",
    "speed": 1.0,
    "pitch": 1.0
  },
  "escalationTriggers": {
    "silenceTimeoutSeconds": 30,
    "negativeSentimentThreshold": 0.7,
    "lowConfidenceThreshold": 0.5,
    "abusiveLanguageDetected": true
  },
  "welcomeMessage": "नमस्ते! मैं आपकी मदद कैसे कर सकता हूँ?",
  "goodbyeMessage": "धन्यवाद! अगर आपकी कोई और मदद चाहिए तो बताएं।"
}
```

### 2. Configure Twilio
```
1. Go to https://console.twilio.com
2. Navigate to Phone Numbers → Manage Numbers
3. Click your number
4. Under "Voice Configuration":
   - Configure with: Application
   - Select/Create TwiML App
5. In TwiML App settings:
   - Voice: POST webhook to https://yourdomain.com/api/live-voice-agent/webhook
   - Enable Media Streams
6. Save
```

### 3. Test on Dashboard
Navigate to `/live-voice-agent` to:
- Select phone number
- Configure settings
- View analytics
- Test with mock calls

## 📊 Dashboard URLs

| Page | URL | Purpose |
|------|-----|---------|
| Main | `/live-voice-agent` | Configure + Analytics |
| Settings API | `/api/live-voice-agent/settings/[phoneNumber]` | Programmatic config |
| Analytics API | `/api/live-voice-agent/analytics/[phoneNumber]` | Metrics & history |
| Webhook | `/api/live-voice-agent/webhook` | Receives incoming calls |

## 🎯 Common Tasks

### Get Current Settings
```bash
GET /api/live-voice-agent/settings/+91XXXXXXXXXX
```

### Update Business Hours
```bash
PUT /api/live-voice-agent/settings/+91XXXXXXXXXX
{
  "businessHours": {
    "monday": { "start": "10:00", "end": "19:00" },
    ...
  }
}
```

### View Call Analytics
```bash
GET /api/live-voice-agent/analytics/+91XXXXXXXXXX?limit=50&offset=0
```

Query params:
- `limit`: Results per page (default 50)
- `offset`: Pagination offset (default 0)
- `startDate`: ISO date filter
- `endDate`: ISO date filter

### Disable Voice Agent
```bash
DELETE /api/live-voice-agent/settings/+91XXXXXXXXXX
```

## 🎤 Call Flow

```
1. Incoming Call
   ↓
2. Webhook validates business hours & settings
   ↓
3. If outside hours: Play message & hangup
   ↓
4. Create call session
   ↓
5. Connect to WebSocket streaming
   ↓
6. Play welcome message
   ↓
7. Listen to customer (STT → Whisper)
   ↓
8. Analyze sentiment/intent via Voice Brain
   ↓
9. Check escalation score
   ↓
10. If escalate: Transfer to fallback number
    ↓
11. If continue: Generate response via Voice Brain
    ↓
12. Play response (TTS → Customer)
    ↓
13. Repeat from step 7
```

## 📱 Voice Personalities

### Available Languages
- `hi` - Hindi
- `en` - English  
- `mr` - Marathi
- `gu` - Gujarati

### Available Providers
- `mistral` - Mistral TTS (recommended)
- `openai` - OpenAI TTS
- `elevenlabs` - ElevenLabs

### Speed & Pitch Ranges
- Speed: 0.5 - 2.0 (1.0 = normal)
- Pitch: 0.5 - 2.0 (1.0 = normal)

## 🚨 Escalation Triggers

| Trigger | Default | Action |
|---------|---------|--------|
| Silence | 30s | Prompt "Are you still there?" |
| Silence | 60s | Escalate to human |
| Negative sentiment | 70% score | Escalate |
| Low confidence | <50% | Count towards escalation |
| Repeated misunderstanding | 3+ turns | Escalate |
| Abusive language | Detected | Escalate |

All thresholds configurable per phone number!

## 🎯 Call Control Commands

Customer can say:
- **"goodbye"** / **"bye"** → End call
- **"speak to human"** / **"real person"** → Transfer
- **"repeat that"** / **"say again"** → Repeat last response
- **"louder"** / **"speak up"** → Increase volume
- **"slower"** / **"slow down"** → Slow down speech

## 📊 Analytics Metrics

**Retrieved on analytics endpoint:**
- `totalCalls` - Total call count
- `totalDuration` - Sum of all call durations
- `averageDuration` - Average call duration
- `completionRate` - % calls completed (no escalation)
- `escalationRate` - % calls escalated
- `averageSentiment` - Avg sentiment score
- `callStatusBreakdown` - Count by status
- `hourlyDistribution` - Calls per hour
- `intentBreakdown` - Calls per intent

## 🔧 Troubleshooting

### Call not connecting?
1. Check business hours in settings
2. Verify voice agent is enabled
3. Check Twilio webhook URL configured
4. Look for errors in call logs

### No transcription?
1. Check Whisper API key configured
2. Verify audio is flowing (check streaming logs)
3. Test audio quality/bit rate

### Wrong escalation behavior?
1. Review escalation trigger values
2. Check sentiment analysis scores
3. Monitor confidence metrics
4. Adjust thresholds if needed

### Poor voice quality?
1. Check TTS provider configuration
2. Adjust speed (lower = clearer)
3. Verify audio codec settings
4. Test with different TTS providers

## 🔐 Environment Variables

```bash
# Twilio (if using Twilio)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token

# TTS Providers
OPENAI_API_KEY=your_key
MISTRAL_API_KEY=your_key
ELEVENLABS_API_KEY=your_key

# STT
OPENAI_STT_API_KEY=your_key

# Domain for webhooks
NEXT_PUBLIC_DOMAIN=yourdomain.com
```

## 📈 Performance Tips

1. **Optimize Escalation Triggers**
   - Too aggressive = more transfers
   - Too lenient = frustrated customers
   - Monitor metrics and adjust

2. **Choose Right TTS Provider**
   - Mistral: Fast, natural
   - OpenAI: High quality
   - ElevenLabs: Most natural (but slower)

3. **Business Hours Strategy**
   - Align with support team availability
   - Consider timezone for global numbers
   - Different hours per day if needed

4. **Voice Personality**
   - Female often perceived as friendlier
   - Match brand voice
   - Test with real customers

5. **Fallback Numbers**
   - Keep queue length monitored
   - Have backup escalation path
   - Implement callbacks if possible

## 🐛 Debug Mode

Enable detailed logging:
```typescript
// In any route handler:
console.log('Call session:', session);
console.log('Intelligence context:', context);
console.log('Escalation score:', escalationScore);
console.log('Sentiment:', sentiment);
console.log('Confidence:', confidence);
```

## 📞 Database Queries

### Get recent calls for a number
```sql
SELECT * FROM call_sessions 
WHERE phone_number = '+91XXXXXXXXXX'
ORDER BY started_at DESC 
LIMIT 10;
```

### Get calls with negative sentiment
```sql
SELECT cs.*, ct.text, ct.sentiment 
FROM call_sessions cs
JOIN call_transcripts ct ON cs.id = ct.session_id
WHERE cs.phone_number = '+91XXXXXXXXXX'
AND ct.sentiment = 'negative'
ORDER BY ct.timestamp DESC;
```

### Get escalation reasons
```sql
SELECT escalation_reason, COUNT(*) as count
FROM call_sessions
WHERE phone_number = '+91XXXXXXXXXX'
AND status = 'transferred'
GROUP BY escalation_reason;
```

### Get average call duration by hour
```sql
SELECT 
  EXTRACT(HOUR FROM started_at) as hour,
  AVG(duration_seconds) as avg_duration,
  COUNT(*) as call_count
FROM call_sessions
WHERE phone_number = '+91XXXXXXXXXX'
GROUP BY hour
ORDER BY hour;
```

## 🎓 Learning Resources

- Voice Brain patterns: `/src/lib/voice-brain/`
- TTS implementation: `/src/lib/voice/tts.ts`
- Embeddings system: `/src/lib/embeddings.ts`
- Phone mapping: `/src/lib/phoneMapping.ts`

---

**Need help?** Check the full documentation in `PHASE4_LIVE_VOICE_AGENT.md`
