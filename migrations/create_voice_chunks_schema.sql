-- PHASE-2 STEP-2: Voice FAQ Chunking and Embedding Integration

-- Enable vector extension for embeddings (assuming pgvector is installed)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 1. voice_chunks table
-- Stores chunked and embedded voice FAQ content for vector search
CREATE TABLE voice_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id UUID REFERENCES voice_faqs(id) ON DELETE CASCADE,
  recording_id UUID REFERENCES voice_recordings(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- Adjust dimension based on embedding model (Mistral = 1024, OpenAI = 1536)
  language TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_voice_chunks_faq_id ON voice_chunks(faq_id);
CREATE INDEX idx_voice_chunks_recording_id ON voice_chunks(recording_id);
CREATE INDEX idx_voice_chunks_language ON voice_chunks(language);
CREATE INDEX idx_voice_chunks_embedding ON voice_chunks USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security (RLS)
ALTER TABLE voice_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (tenant isolation through voice_faqs relationship)
CREATE POLICY "Users can view voice_chunks for their FAQs" ON voice_chunks
  FOR SELECT USING (
    faq_id IN (
      SELECT id FROM voice_faqs WHERE tenant_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert voice_chunks for their FAQs" ON voice_chunks
  FOR INSERT WITH CHECK (
    faq_id IN (
      SELECT id FROM voice_faqs WHERE tenant_id = auth.uid()
    )
  );

-- Function to search voice chunks by vector similarity
-- This mirrors the existing match_documents and match_shopify_chunks functions
CREATE OR REPLACE FUNCTION match_voice_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.1,
  match_count INT DEFAULT 5,
  faq_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  faq_id UUID,
  recording_id UUID,
  chunk_text TEXT,
  similarity FLOAT,
  metadata JSONB,
  language TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vc.id,
    vc.faq_id,
    vc.recording_id,
    vc.chunk_text,
    1 - (vc.embedding <=> query_embedding) AS similarity,
    vc.metadata,
    vc.language
  FROM voice_chunks vc
  WHERE (faq_ids IS NULL OR vc.faq_id = ANY(faq_ids))
    AND 1 - (vc.embedding <=> query_embedding) > match_threshold
  ORDER BY vc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;