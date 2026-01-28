# Call Recording RAG Extension

This document describes the call recording audio support added to the existing PDF-based RAG system.

## Architecture Overview

The system extends the existing RAG pipeline to support call recordings (audio) as a **new knowledge source** alongside PDFs, without modifying or breaking the existing PDF pipeline.

### Key Design Principle: Isolation

- **PDF Pipeline** (`/src/app/api/files/*`, `/src/app/pdf/*`) - UNTOUCHED
- **Call Pipeline** (`/src/app/api/calls/*`, `/src/app/api/bulk-upload-calls`, `/src/app/calls/*`) - NEW and ISOLATED
- **Unified RAG** (`rag_chunks` table) - Extended to support both sources using `source_type` and `source_id`

## Database Schema

### New Tables

1. **call_recordings** - Stores audio file metadata and processing status
   - Tracks phone number, file URL, processing status
   - Statuses: `uploaded`, `transcribing`, `classifying`, `chunking`, `11za_related`, `spam`, `blank`, `failed`

2. **call_transcripts** - Stores transcribed text from audio
   - One transcript per call recording
   - Includes transcript length for blank detection

3. **call_classifications** - AI-generated classification results
   - Is blank? Is spam? Is 11za related?
   - Confidence scores (0-1) for each classification

### Modified Tables

**rag_chunks** - Extended with:
- `source_type` (TEXT) - `'pdf'` or `'call'`
- `source_id` (UUID) - References `rag_files.id` (PDF) or `call_recordings.id` (call)

## Processing Pipeline

### Flow for Each Call

```
1. Audio Upload
   ↓
2. Store metadata in call_recordings (status: uploaded)
   ↓
3. Transcribe audio → Groq Whisper
   ↓
4. Detect blank (< 50 chars) → Status: blank [STOP]
   ↓
5. Classify spam → Status: spam if confident [STOP]
   ↓
6. Classify 11za relevance
   ├─ Not relevant → Status: not_relevant [STOP]
   └─ Related → Continue
   ↓
7. Chunk transcript (1600 chars, 200 overlap)
   ↓
8. Generate embeddings for each chunk
   ↓
9. Save chunks to rag_chunks with source_type='call'
   ↓
10. Status: 11za_related [COMPLETE]
```

### Key Decision Points

- **Blank Detection**: Threshold of 50 characters
- **Spam Confidence**: > 70% triggers spam status
- **Relevance Confidence**: > 50% keeps call in RAG
- Only **approved calls** (status: `11za_related`) are used in retrieval

## API Endpoints

### Call Management

**POST `/api/bulk-upload-calls`**
- Upload 1-50 audio files
- Accepts: MP3, WAV, OGG (max 100MB each)
- Returns: List of uploaded call IDs and failures
- Triggers async processing

**GET `/api/calls`**
- Query parameters: `phone_number`, `status`
- Returns: Call recordings with metadata, classification, transcript

**DELETE `/api/calls`**
- Query parameter: `id`
- Cascades: Deletes call record + transcript + classification + RAG chunks

**POST `/api/process-calls-worker`**
- Manual retry of failed calls
- Internal endpoint for async processing

## UI - Call Recording Management

### New Page: `/app/calls`

**Left Panel: Phone Numbers**
- List of WhatsApp business numbers
- Shows: call count, approved count per number
- "+ New Phone Number" button

**Right Panel: Configuration Tab**
- Same settings as PDF page (Intent, System Prompt, Auth Token, Origin)
- Shared with PDF pipeline

**Right Panel: Call Recordings Tab**
- **Bulk Upload**: Upload up to 50 files at once with progress bar
- **Single Upload**: Alternative for single file
- **Filters**: All, Approved, Spam, Blank, Failed
- **Call List**: For each call:
  - File name, status badge, processing animation
  - Upload time, process time
  - Transcript length, chunk count
  - Classification details with confidence scores
  - Transcript preview (expandable)
  - Retry (if failed) and Delete buttons

## Retrieval: Dual-Source RAG

### For WhatsApp Auto-Responder

When a user sends a WhatsApp message to a phone number:

1. Embed the message
2. Call `retrieveRelevantChunksDualSource(embedding, phone_number)`
3. Returns top chunks from:
   - All PDF chunks (via `source_type = 'pdf'`)
   - Approved call chunks for that phone (via `source_type = 'call' AND status = '11za_related'`)
4. Rank by similarity and use in LLM context

### Implementation Details

```typescript
// Two approaches available:

// A) Fallback (JavaScript):
// Queries rag_chunks directly, filters, calculates cosine similarity
// Works without database RPC setup

// B) Optimized (RPC):
// Requires: create_call_retrieval_rpc.sql migration
// Single database call, vectorized operations
// Better performance for large datasets
```

## Processing Implementation

### Audio Transcription

- **Service**: Groq Whisper Large V3 Turbo
- **Language**: English (fixed)
- **Error Handling**: Retries on failure, marks call as `failed` if unsuccessful

### Classification

All classifications use **Groq LLM** (llama-3.3-70b-versatile):

1. **Blank Detection**: Character length check (< 50)
2. **Spam Detection**: LLM classification with confidence
3. **11za Relevance**: LLM classification with confidence

Each has structured JSON response parsing with fallback defaults.

## Library Functions

### `/src/lib/callProcessing.ts`

```typescript
transcribeAudio(buffer, fileName) → transcript text
detectBlank(transcript, minLength?) → boolean
classifySpam(transcript) → { isSpam, confidence }
classify11zaRelevance(transcript) → { isRelated, confidence }
```

### `/src/lib/retrieval.ts`

```typescript
retrieveRelevantChunksDualSource(embedding, phone?, limit?)
  → { id, chunk, similarity, source_type, source_id }[]
```

## Configuration

### Environment Variables Required

Already present, no new env vars needed:
- `GROQ_API_KEY` - For Whisper transcription and classifications
- `MISTRAL_API_KEY` - For embeddings
- Database credentials (Supabase)

### Storage Configuration

Uses Supabase Storage bucket: `audio-files`
- Path structure: `calls/{phone_number}/{call_id}/{filename}`
- Supports: MP3, WAV, OGG
- Max size: 100MB per file

## Integration Points

### Chat Endpoint

**POST `/api/chat`**
- New parameter: `phone_number` (optional)
- If provided: Uses dual-source retrieval
- If not provided: Uses traditional file-based retrieval (backward compatible)

### WhatsApp Auto-Responder

**Updated**: `/src/lib/autoResponder.ts`
- Now calls `retrieveRelevantChunksDualSource()` instead of separate PDF queries
- Seamlessly includes approved call chunks in context
- Maintains backward compatibility with PDF-only setup

## Data Flow Diagram

```
User uploads call recording
        ↓
/api/bulk-upload-calls
        ↓
Store in call_recordings table
Upload audio to Supabase Storage
        ↓
/api/process-calls-worker (async)
        ↓
Transcribe (Groq Whisper)
↓
Create call_transcripts record
↓
Classify (Groq LLM)
↓
Create call_classifications record
↓
Update call_recordings status
        ↓
   [Decision Point]
   ├─ Blank? → Status: blank
   ├─ Spam? → Status: spam
   ├─ Not relevant? → Status: not_relevant
   └─ Relevant → Continue
        ↓
Chunk transcript
Generate embeddings (Mistral)
Save to rag_chunks (source_type='call')
        ↓
Status: 11za_related ✓

---

User sends WhatsApp message
        ↓
/api/whatsapp/auto-respond
        ↓
generateAutoResponse()
        ↓
retrieveRelevantChunksDualSource()
        ↓
Query rag_chunks:
├─ PDF chunks (source_type='pdf')
└─ Approved call chunks
        ↓
LLM generates response using both sources
        ↓
Send WhatsApp reply
```

## Error Handling

- **Upload Errors**: Invalid file type, size > 100MB, upload fails
- **Transcription Errors**: Audio corrupted, unsupported format → call marked `failed`
- **Classification Errors**: LLM API unavailable → fallback defaults (not classified)
- **Embedding Errors**: Rate limited → exponential backoff
- **Deletion**: Cascading delete removes all dependent records (transcript, classification, chunks)

## Testing Checklist

- [ ] Upload single call recording
- [ ] Bulk upload multiple recordings
- [ ] Monitor status transitions (uploaded → transcribing → classifying → 11za_related)
- [ ] Verify transcript appears in UI
- [ ] Check classification confidence scores
- [ ] Filter by status (Approved, Spam, Blank)
- [ ] Delete call and verify chunks removed
- [ ] Retry failed call
- [ ] Send WhatsApp message and verify response includes call chunks
- [ ] Verify PDF-only setup still works (no phone_number param in chat)

## Performance Considerations

- **Bulk Processing**: Up to 50 files per upload
- **Async Processing**: Non-blocking, background jobs
- **Polling**: Client polls every 5 seconds while calls being processed
- **Embedding**: Exponential backoff on rate limits
- **Retrieval**: Cosine similarity search (with optional vectorized RPC)

## Limitations & Future Work

Current:
- Language: Fixed English only
- Classification: LLM-based (no ML model training)
- Batch size: 50 files max
- Processing: Sequential within each call

Future:
- Multi-language support
- Custom ML classification models
- Parallel chunk processing
- Call summary generation
- Speaker diarization (multi-person detection)
- Call duration and quality metrics
- Automatic meeting notes from calls
