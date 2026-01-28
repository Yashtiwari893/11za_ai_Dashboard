-- Call Recordings Schema - Extends RAG system to support audio/transcripts
-- Fully isolated from PDF pipeline. Uses matching rag_chunks table for unified retrieval.

-- 1. call_recordings - Main table for call audio files
CREATE TABLE call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
    status IN (
      'uploaded',
      'transcribing',
      'classifying',
      'chunking',
      '11za_related',
      'spam',
      'blank',
      'failed'
    )
  ),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  duration_seconds DECIMAL(10, 2),
  
  CONSTRAINT fk_phone_number FOREIGN KEY (phone_number) 
    REFERENCES phone_settings(phone_number) ON DELETE CASCADE
);

-- 2. call_transcripts - Store transcripts for each call
CREATE TABLE call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id UUID NOT NULL UNIQUE,
  transcript TEXT,
  transcript_length INTEGER,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_call_recording FOREIGN KEY (call_recording_id) 
    REFERENCES call_recordings(id) ON DELETE CASCADE
);

-- 3. call_classifications - Classification results for each call
CREATE TABLE call_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id UUID NOT NULL UNIQUE,
  
  -- Classifications
  is_blank BOOLEAN,
  is_spam BOOLEAN,
  is_11za_related BOOLEAN,
  
  -- Confidence scores (0-1)
  blank_confidence DECIMAL(3, 2),
  spam_confidence DECIMAL(3, 2),
  relevance_confidence DECIMAL(3, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_call_recording FOREIGN KEY (call_recording_id) 
    REFERENCES call_recordings(id) ON DELETE CASCADE
);

-- 4. Extend rag_chunks to support both PDF and call sources
ALTER TABLE rag_chunks 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'pdf' CHECK (source_type IN ('pdf', 'call')),
ADD COLUMN IF NOT EXISTS source_id UUID;

-- For PDF sources, source_id references rag_files.id
-- For call sources, source_id references call_recordings.id

-- 5. Indexes for performance
CREATE INDEX idx_call_recordings_phone_number ON call_recordings(phone_number);
CREATE INDEX idx_call_recordings_status ON call_recordings(status);
CREATE INDEX idx_call_recordings_uploaded_at ON call_recordings(uploaded_at DESC);
CREATE INDEX idx_call_transcripts_call_recording_id ON call_transcripts(call_recording_id);
CREATE INDEX idx_call_classifications_call_recording_id ON call_classifications(call_recording_id);
CREATE INDEX idx_rag_chunks_source_type ON rag_chunks(source_type);
CREATE INDEX idx_rag_chunks_source_id ON rag_chunks(source_id);

-- 6. Create views for easier querying
CREATE OR REPLACE VIEW v_call_recordings_with_metadata AS
SELECT 
  cr.id,
  cr.phone_number,
  cr.file_name,
  cr.status,
  cr.uploaded_at,
  cr.processed_at,
  cr.error_reason,
  ct.transcript,
  ct.transcript_length,
  cc.is_blank,
  cc.is_spam,
  cc.is_11za_related,
  cc.blank_confidence,
  cc.spam_confidence,
  cc.relevance_confidence,
  COALESCE(chunk_counts.chunk_count, 0) AS chunk_count
FROM call_recordings cr
LEFT JOIN call_transcripts ct ON cr.id = ct.call_recording_id
LEFT JOIN call_classifications cc ON cr.id = cc.call_recording_id
LEFT JOIN (
  SELECT source_id, COUNT(*) as chunk_count 
  FROM rag_chunks 
  WHERE source_type = 'call'
  GROUP BY source_id
) chunk_counts ON cr.id = chunk_counts.source_id;
