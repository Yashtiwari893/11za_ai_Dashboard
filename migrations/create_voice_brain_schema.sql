-- Voice Brain Database Schema for PHASE-3
-- Stores call recordings, transcripts, conversations, intents, and response patterns

-- Main calls table
CREATE TABLE voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    audio_url TEXT, -- Supabase Storage URL
    transcript TEXT, -- Raw transcript from STT
    duration_seconds INTEGER,
    language TEXT DEFAULT 'hi', -- hi, en, gu, etc.
    call_direction TEXT CHECK (call_direction IN ('inbound', 'outbound')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed'))
);

-- Structured conversations (customer/agent turns)
CREATE TABLE voice_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES voice_calls(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL, -- Turn number in conversation
    role TEXT NOT NULL CHECK (role IN ('customer', 'agent')),
    text TEXT NOT NULL,
    language TEXT DEFAULT 'hi',
    confidence_score FLOAT, -- STT confidence
    start_time FLOAT, -- Start time in audio (seconds)
    end_time FLOAT, -- End time in audio (seconds)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intent clusters extracted from conversations
CREATE TABLE voice_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_name TEXT NOT NULL, -- e.g., 'price_inquiry', 'availability_check'
    domain TEXT DEFAULT 'general', -- sales, support, faq, complaint
    primary_examples TEXT[], -- Array of customer question variants
    secondary_intents TEXT[], -- Related intents
    tone TEXT DEFAULT 'neutral', -- friendly, urgent, frustrated, polite
    language TEXT DEFAULT 'hi',
    confidence_score FLOAT DEFAULT 0.0,
    sample_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent response patterns per intent
CREATE TABLE voice_response_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id UUID REFERENCES voice_intents(id) ON DELETE CASCADE,
    response_style TEXT DEFAULT 'direct', -- direct, empathetic, detailed, concise
    avg_response_length INTEGER, -- Average character count
    common_phrases TEXT[], -- Frequently used phrases
    emoji_usage TEXT[], -- Emojis used in responses
    language TEXT DEFAULT 'hi',
    sample_responses TEXT[], -- Array of actual agent responses
    effectiveness_score FLOAT DEFAULT 0.0, -- Based on conversation outcomes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embeddings for semantic search
CREATE TABLE voice_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL CHECK (content_type IN ('question', 'response', 'intent')),
    content_id UUID NOT NULL, -- References to the actual content
    embedding VECTOR(1536), -- OpenAI ada-002 dimensions
    text_content TEXT, -- Original text for reference
    language TEXT DEFAULT 'hi',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_voice_calls_phone ON voice_calls(phone_number);
CREATE INDEX idx_voice_calls_status ON voice_calls(status);
CREATE INDEX idx_voice_conversations_call_id ON voice_conversations(call_id);
CREATE INDEX idx_voice_conversations_role ON voice_conversations(role);
CREATE INDEX idx_voice_intents_name ON voice_intents(intent_name);
CREATE INDEX idx_voice_response_patterns_intent ON voice_response_patterns(intent_id);

-- Vector search functions (requires pgvector)
CREATE OR REPLACE FUNCTION match_voice_questions(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE(
    content_id UUID,
    text_content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.content_id,
        ve.text_content,
        1 - (ve.embedding <=> query_embedding) AS similarity
    FROM voice_embeddings ve
    WHERE ve.content_type = 'question'
    AND 1 - (ve.embedding <=> query_embedding) > match_threshold
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_voice_responses(
    query_embedding VECTOR(1536),
    intent_filter TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 3
)
RETURNS TABLE(
    response_text TEXT,
    intent_name TEXT,
    similarity FLOAT,
    style TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ve.text_content,
        vi.intent_name,
        1 - (ve.embedding <=> query_embedding) AS similarity,
        vrp.response_style
    FROM voice_embeddings ve
    JOIN voice_response_patterns vrp ON vrp.id = ve.content_id
    JOIN voice_intents vi ON vi.id = vrp.intent_id
    WHERE ve.content_type = 'response'
    AND (intent_filter IS NULL OR vi.intent_name = intent_filter)
    AND 1 - (ve.embedding <=> query_embedding) > match_threshold
    ORDER BY ve.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- RLS Policies (if using RLS)
-- ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_intents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_response_patterns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE voice_embeddings ENABLE ROW LEVEL SECURITY;