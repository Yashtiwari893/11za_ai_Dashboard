-- PHASE-2 STEP-1: Voice FAQ Ingestion Pipeline - Database Schema

-- Enable vector extension for future embeddings (assuming pgvector is installed)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 1. voice_faqs table
-- Groups voice recordings into FAQ collections for a tenant
CREATE TABLE voice_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, -- References auth.users(id) or tenant table
  title TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  source TEXT NOT NULL CHECK (source IN ('call', 'manual', 'upload')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. voice_recordings table
-- Stores individual audio recordings with their transcripts
CREATE TABLE voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id UUID REFERENCES voice_faqs(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL, -- Supabase storage URL
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  transcript_raw TEXT,
  transcript_clean TEXT,
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  transcription_provider TEXT, -- 'whisper', 'assemblyai', 'deepgram'
  transcription_confidence FLOAT,
  detected_language TEXT,
  transcription_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_voice_faqs_tenant_id ON voice_faqs(tenant_id);
CREATE INDEX idx_voice_faqs_created_at ON voice_faqs(created_at);
CREATE INDEX idx_voice_recordings_faq_id ON voice_recordings(faq_id);
CREATE INDEX idx_voice_recordings_status ON voice_recordings(transcription_status);
CREATE INDEX idx_voice_recordings_created_at ON voice_recordings(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE voice_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic tenant isolation - customize based on your auth model)
-- These are examples - adjust based on your authentication system
CREATE POLICY "Users can view their own voice_faqs" ON voice_faqs
  FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Users can insert their own voice_faqs" ON voice_faqs
  FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Users can update their own voice_faqs" ON voice_faqs
  FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Users can view their own voice_recordings" ON voice_recordings
  FOR SELECT USING (
    faq_id IN (
      SELECT id FROM voice_faqs WHERE tenant_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own voice_recordings" ON voice_recordings
  FOR INSERT WITH CHECK (
    faq_id IN (
      SELECT id FROM voice_faqs WHERE tenant_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own voice_recordings" ON voice_recordings
  FOR UPDATE USING (
    faq_id IN (
      SELECT id FROM voice_faqs WHERE tenant_id = auth.uid()
    )
  );