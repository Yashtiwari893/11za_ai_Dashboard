# Call Recording Integration Quick Start

## Installation Steps

### 1. Apply Database Migrations

Run these SQL migrations in order:

```bash
# 1. Create call recording schema
migrations/create_call_recordings_schema.sql

# 2. (Optional) Create RPC function for optimized retrieval
migrations/create_call_retrieval_rpc.sql
```

### 2. Configure Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create bucket named `audio-files` (if not exists)
3. Set bucket policies to allow authenticated uploads

### 3. Verify Environment Variables

Required (should already exist):
```env
GROQ_API_KEY=your_groq_api_key
MISTRAL_API_KEY=your_mistral_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Test the Integration

#### Test Upload via API

```bash
curl -X POST http://localhost:3000/api/bulk-upload-calls \
  -F "phone_number=15558346206" \
  -F "files=@sample_call.mp3"
```

#### Test Chat with Call Chunks

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "message": "Tell me about the call recording",
    "phone_number": "15558346206"
  }'
```

## File Structure

New files created:

```
src/
  lib/
    callProcessing.ts         # Audio transcription & classification
    retrieval.ts              # Updated: Added dual-source retrieval
    autoResponder.ts          # Updated: Uses dual-source retrieval
  app/
    api/
      calls/
        route.ts              # GET/DELETE calls
      bulk-upload-calls/
        route.ts              # POST upload (batch/single)
      process-calls-worker/
        route.ts              # POST async processing
      chat/
        route.ts              # Updated: Supports phone_number param
    calls/
      page.tsx                # New UI page

migrations/
  create_call_recordings_schema.sql    # New DB tables
  create_call_retrieval_rpc.sql        # Optional RPC optimization

CALL_RECORDING_README.md      # Full documentation
```

## UI Navigation

### For Call Recordings

1. Go to `/calls` (new page)
2. Click "+ New Phone Number" to create a phone entry
3. Or select existing phone number from left panel
4. Click "Call Recordings" tab
5. Upload audio files (bulk or single)
6. Monitor processing status
7. View transcripts and classifications

### PDF Management (Unchanged)

1. Go to `/files` (existing page)
2. Same workflow as before - no changes

## API Usage Examples

### Upload Multiple Call Recordings

```typescript
const formData = new FormData();
formData.append('phone_number', '15558346206');
formData.append('files', audioFile1);
formData.append('files', audioFile2);
formData.append('files', audioFile3);

const res = await fetch('/api/bulk-upload-calls', {
  method: 'POST',
  body: formData
});

const { uploaded, failed } = await res.json();
console.log(`Uploaded: ${uploaded.length}, Failed: ${failed.length}`);
```

### Query Calls by Status

```typescript
// Get all approved calls for a phone
const res = await fetch(
  '/api/calls?phone_number=15558346206&status=11za_related'
);
const { calls } = await res.json();
```

### Delete a Call

```typescript
const res = await fetch(`/api/calls?id=${callId}`, {
  method: 'DELETE'
});
```

### Use Dual-Source Retrieval in Chat

```typescript
// Automatic when phone_number is provided
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'user-session-123',
    message: 'What did the customer say?',
    phone_number: '15558346206'  // ← Uses both PDF and approved calls
  })
});
```

## Processing Status Reference

| Status | Meaning | Usable in RAG? |
|--------|---------|---|
| `uploaded` | File received, waiting to process | No |
| `transcribing` | Converting audio to text | No |
| `classifying` | Running ML classifications | No |
| `chunking` | Breaking text into chunks | No |
| `blank` | Too short/empty | No |
| `spam` | Detected as spam/junk | No |
| `not_relevant` | Not related to 11za | No |
| `11za_related` | ✅ Approved & ready | **YES** |
| `failed` | Error during processing | No |

## Monitoring & Debugging

### Check Processing Status

```typescript
const res = await fetch('/api/calls?phone_number=15558346206');
const { calls } = await res.json();

calls.forEach(call => {
  console.log(`${call.file_name}: ${call.status}`);
  if (call.status === 'failed') {
    console.log(`  Error: ${call.error_reason}`);
  }
});
```

### View Classification Details

```typescript
const call = calls[0];
console.log('Classification:', {
  blank: `${call.classification.is_blank} (${call.classification.blank_confidence * 100}%)`,
  spam: `${call.classification.is_spam} (${call.classification.spam_confidence * 100}%)`,
  relevant: `${call.classification.is_11za_related} (${call.classification.relevance_confidence * 100}%)`
});
```

### Monitor Retrieval Sources

```typescript
// In chat response, you can see which sources were used:
const res = await fetch('/api/chat', { /* ... */ });
// PDF chunks: source_type === 'pdf'
// Call chunks: source_type === 'call'
```

## Troubleshooting

### Calls stuck in "transcribing"

- Check Groq API key is valid
- Check audio file isn't corrupted
- Manually retry via UI "Retry" button

### No call chunks appearing in responses

1. Verify calls have status `11za_related`
2. Check relevance confidence > 50%
3. Ensure phone_number param passed to `/api/chat`
4. Check rag_chunks table has entries with source_type='call'

### Uploads failing with file type error

- Valid formats: MP3, WAV, OGG
- Check MIME type header
- File extension must match content

### Storage quota exceeded

- Check Supabase Storage bucket size
- Delete old call recordings via UI
- Archive old calls externally if needed

## Performance Tips

1. **Bulk Upload**: Use bulk endpoint for 2+ files (more efficient)
2. **Polling**: UI polls every 5s while processing - adjust if needed
3. **Retrieval**: Use RPC function migration for datasets > 10K chunks
4. **Embeddings**: Groq has rate limits - exponential backoff is automatic

## Security Considerations

- Call recordings stored in authenticated bucket (`audio-files`)
- Phone numbers used as path prefix (isolation)
- Classifications stored in database (encrypted by Supabase)
- All API calls require valid session
- Transcripts retained indefinitely (consider GDPR compliance)

## Next Steps

1. ✅ Upload a test call recording
2. ✅ Monitor processing in UI
3. ✅ Send WhatsApp message to test dual-source retrieval
4. ✅ Verify response includes information from calls
5. 📝 Consider implementing call webhooks for alerts
6. 📝 Consider implementing call analytics dashboard
