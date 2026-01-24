-- STEP-3.1: Database Schema for Voice FAQ System

-- Enable vector extension for embeddings (assuming pgvector is installed)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 1. voice_faq_collections table
-- Groups voice recordings into FAQ collections linked to a chatbot
CREATE TABLE voice_faq_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. voice_recordings table
-- Stores metadata for uploaded audio files
CREATE TABLE voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES voice_faq_collections(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL, -- Supabase storage URL
  duration_seconds INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. voice_transcripts table
-- Stores transcription results and cleaned text
CREATE TABLE voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES voice_recordings(id) ON DELETE CASCADE,
  raw_text TEXT,
  cleaned_text TEXT,
  detected_language TEXT,
  confidence_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. voice_faq_chunks table
-- Stores text chunks with their embeddings for vector search
CREATE TABLE voice_faq_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES voice_faq_collections(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES voice_transcripts(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- Adjust dimension based on embedding model
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_voice_faq_collections_chatbot_id ON voice_faq_collections(chatbot_id);
CREATE INDEX idx_voice_recordings_collection_id ON voice_recordings(collection_id);
CREATE INDEX idx_voice_transcripts_recording_id ON voice_transcripts(recording_id);
CREATE INDEX idx_voice_faq_chunks_collection_id ON voice_faq_chunks(collection_id);
CREATE INDEX idx_voice_faq_chunks_embedding ON voice_faq_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security (RLS)
ALTER TABLE voice_faq_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_faq_chunks ENABLE ROW LEVEL SECURITY;