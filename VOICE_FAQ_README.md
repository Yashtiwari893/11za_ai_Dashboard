# Voice FAQ Ingestion Pipeline - Setup Guide

## Overview
This module provides a complete voice FAQ ingestion pipeline for the AI Dashboard. It handles audio upload, transcription, cleaning, and storage in a structured format ready for RAG (Retrieval-Augmented Generation).

## Database Setup

### 1. Run Migration
Execute the SQL migration in your Supabase SQL editor:
```sql
-- File: migrations/create_voice_faq_ingestion_schema.sql
```

### 2. Supabase Storage Bucket
Create a new storage bucket in Supabase Dashboard:

**Bucket Name:** `voice_recordings`
**Public:** No (private bucket)
**Allowed MIME Types:**
- `audio/wav`
- `audio/mpeg`
- `audio/mp4`
- `audio/x-m4a`

**File Size Limit:** 50MB per file

### 3. Storage Policies
Configure RLS policies for the bucket (if needed):
- Allow authenticated users to upload to their tenant folder
- Allow read access for transcription services

## API Endpoints

### POST /api/voice/upload
Upload an audio file and create a voice FAQ collection.

**Request (multipart/form-data):**
```
audio: File (WAV/MP3/M4A)
tenant_id: string (UUID)
faq_title: string
language: string (optional, default: 'en')
```

**Response:**
```json
{
  "success": true,
  "faq_id": "uuid",
  "recording_id": "uuid",
  "audio_url": "https://..."
}
```

**Example Usage:**
```bash
curl -X POST http://localhost:3000/api/voice/upload \
  -F "audio=@recording.wav" \
  -F "tenant_id=123e4567-e89b-12d3-a456-426614174000" \
  -F "faq_title=How to reset password" \
  -F "language=en"
```

### POST /api/voice/transcribe
Transcribe an uploaded audio recording.

**Request:**
```json
{
  "recording_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "recording_id": "uuid",
  "transcript_raw": "raw transcription text...",
  "transcript_clean": "cleaned transcription text...",
  "confidence": 0.95,
  "detected_language": "en"
}
```

**Example Usage:**
```bash
curl -X POST http://localhost:3000/api/voice/transcribe \
  -H "Content-Type: application/json" \
  -d '{"recording_id": "123e4567-e89b-12d3-a456-426614174000"}'
```

## Transcription Providers

### Current Implementation
- **Mock Provider**: For development/testing
- Returns sample transcription with 95% confidence

### Adding Real Providers

#### 1. Whisper (OpenAI)
```typescript
// lib/voice/providers/whisper.ts
import OpenAI from 'openai'

export class WhisperProvider implements TranscriptionProvider {
  name = 'whisper'
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Download audio and transcribe using Whisper API
    // Implementation details...
  }
}
```

#### 2. AssemblyAI
```typescript
// lib/voice/providers/assemblyai.ts
export class AssemblyAIProvider implements TranscriptionProvider {
  name = 'assemblyai'
  // Implementation...
}
```

#### 3. Register Provider
```typescript
// In your app initialization
import { WhisperProvider } from '@/lib/voice/providers/whisper'
VoiceTranscriber.registerProvider(new WhisperProvider())
```

## Data Flow

```
Audio Upload → Validation → Supabase Storage → Database Entry → Transcription → Cleaning → Storage
     ↓             ↓             ↓                    ↓              ↓            ↓         ↓
   Client       File Type     Private URL          voice_faqs    Provider API   Filler     voice_recordings
   Request      Size Check    voice_recordings/    voice_recordings  Removal   Removal    (transcript_clean)
```

## File Structure

```
src/
├── app/api/voice/
│   ├── upload/route.ts      # Audio upload endpoint
│   └── transcribe/route.ts  # Transcription endpoint
├── lib/voice/
│   ├── transcriber.ts       # Transcription service
│   ├── cleaner.ts          # Transcript cleaning
│   └── providers/          # Provider implementations
└── migrations/
    └── create_voice_faq_ingestion_schema.sql
```

## Environment Variables

```env
# Required for transcription providers
OPENAI_API_KEY=sk-...
ASSEMBLYAI_API_KEY=...
DEEPGRAM_API_KEY=...

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Future Enhancements

1. **Batch Processing**: Queue system for multiple files
2. **Real-time Transcription**: WebSocket-based streaming
3. **Speaker Diarization**: Identify different speakers
4. **Language Detection**: Auto-detect language if not provided
5. **Quality Metrics**: WER (Word Error Rate) tracking
6. **Audio Preprocessing**: Noise reduction, normalization

## Monitoring

All operations are logged using the existing Logger system:
- Request IDs for tracing
- Performance metrics
- Error tracking
- Provider usage statistics

## Testing

### Unit Tests
```typescript
// Test transcript cleaning
const raw = "uh, well, you know, the password reset is, um, available in settings."
const cleaned = TranscriptCleaner.clean(raw)
// Expected: "The password reset is available in settings."
```

### Integration Tests
```typescript
// Test full pipeline
const result = await uploadAudio(file)
const transcription = await transcribeAudio(result.recording_id)
expect(transcription.success).toBe(true)
```