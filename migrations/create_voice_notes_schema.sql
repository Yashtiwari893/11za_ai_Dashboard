-- =========================================
-- PHASE-4: WhatsApp Voice Notes Processing
-- Voice Messages, Transcripts, and Responses
-- =========================================

-- =========================================
-- 1. Voice Messages: Store incoming voice notes
-- =========================================
CREATE TABLE IF NOT EXISTS voice_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_message_id BIGINT REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL, -- WhatsApp message ID
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    audio_url TEXT NOT NULL, -- Supabase storage URL
    audio_file_name TEXT,
    audio_duration_seconds DECIMAL(5,2),
    audio_size_bytes INTEGER,
    detected_language TEXT,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice messages
CREATE INDEX IF NOT EXISTS idx_voice_messages_message_id ON voice_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_voice_messages_from_number ON voice_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_voice_messages_processing_status ON voice_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_voice_messages_created_at ON voice_messages(created_at DESC);

-- =========================================
-- 2. Voice Transcripts: STT results
-- =========================================
CREATE TABLE IF NOT EXISTS voice_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_message_id UUID REFERENCES voice_messages(id) ON DELETE CASCADE,
    raw_transcript TEXT, -- Raw STT output
    cleaned_transcript TEXT, -- Cleaned transcript (fillers removed)
    detected_language TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    stt_provider TEXT, -- 'openai', 'google', 'azure', etc.
    stt_model TEXT,
    processing_time_ms INTEGER,
    word_count INTEGER,
    speaker_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice transcripts
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_voice_message_id ON voice_transcripts(voice_message_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcripts_confidence ON voice_transcripts(confidence_score);

-- =========================================
-- 3. Voice Intents: Detected intents from transcript
-- =========================================
CREATE TABLE IF NOT EXISTS voice_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_message_id UUID REFERENCES voice_messages(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES voice_transcripts(id) ON DELETE CASCADE,
    intent TEXT NOT NULL, -- 'question', 'complaint', 'order', 'greeting', etc.
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    intent_category TEXT, -- 'informational', 'transactional', 'emotional'
    detected_entities JSONB, -- Extracted entities like product names, amounts, etc.
    voice_brain_match TEXT, -- Closest matching voice pattern
    voice_brain_similarity DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice intents
CREATE INDEX IF NOT EXISTS idx_voice_intents_voice_message_id ON voice_intents(voice_message_id);
CREATE INDEX IF NOT EXISTS idx_voice_intents_intent ON voice_intents(intent);
CREATE INDEX IF NOT EXISTS idx_voice_intents_category ON voice_intents(intent_category);

-- =========================================
-- 4. Voice Responses: Generated responses
-- =========================================
CREATE TABLE IF NOT EXISTS voice_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_message_id UUID REFERENCES voice_messages(id) ON DELETE CASCADE,
    response_type TEXT DEFAULT 'voice' CHECK (response_type IN ('voice', 'text', 'both')),
    text_response TEXT, -- Human-like text response
    voice_script TEXT, -- Script optimized for TTS (conversational)
    tts_provider TEXT, -- 'mistral', 'openai', 'elevenlabs'
    tts_voice TEXT, -- Voice ID/name
    tts_speed DECIMAL(2,1) DEFAULT 1.0,
    tts_pitch DECIMAL(2,1) DEFAULT 1.0,
    audio_url TEXT, -- Generated audio file URL
    audio_duration_seconds DECIMAL(5,2),
    audio_size_bytes INTEGER,
    whatsapp_message_id TEXT, -- WhatsApp message ID of the response
    sent_at TIMESTAMPTZ,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed')),
    delivery_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for voice responses
CREATE INDEX IF NOT EXISTS idx_voice_responses_voice_message_id ON voice_responses(voice_message_id);
CREATE INDEX IF NOT EXISTS idx_voice_responses_delivery_status ON voice_responses(delivery_status);
CREATE INDEX IF NOT EXISTS idx_voice_responses_sent_at ON voice_responses(sent_at DESC);

-- =========================================
-- 5. Voice Conversations: Maintain conversation context
-- =========================================
CREATE TABLE IF NOT EXISTS voice_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_number TEXT NOT NULL,
    business_number TEXT NOT NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    total_audio_duration DECIMAL(8,2) DEFAULT 0,
    average_confidence DECIMAL(3,2),
    dominant_language TEXT,
    conversation_status TEXT DEFAULT 'active' CHECK (conversation_status IN ('active', 'ended', 'escalated')),
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_number, business_number)
);

-- Indexes for voice conversations
CREATE INDEX IF NOT EXISTS idx_voice_conversations_user_business ON voice_conversations(user_number, business_number);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_status ON voice_conversations(conversation_status);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_last_message ON voice_conversations(last_message_at DESC);

-- =========================================
-- 6. Voice Knowledge Retrieval: Store retrieved context
-- =========================================
CREATE TABLE IF NOT EXISTS voice_knowledge_retrieval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_message_id UUID REFERENCES voice_messages(id) ON DELETE CASCADE,
    knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('pdf_chunk', 'shopify_product', 'voice_pattern', 'faq')),
    source_id TEXT NOT NULL, -- File ID, Product ID, etc.
    content TEXT NOT NULL,
    relevance_score DECIMAL(3,2),
    retrieved_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for knowledge retrieval
CREATE INDEX IF NOT EXISTS idx_voice_knowledge_voice_message_id ON voice_knowledge_retrieval(voice_message_id);
CREATE INDEX IF NOT EXISTS idx_voice_knowledge_type ON voice_knowledge_retrieval(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_voice_knowledge_relevance ON voice_knowledge_retrieval(relevance_score DESC);

-- =========================================
-- Add columns to existing whatsapp_messages table
-- =========================================
DO $$
BEGIN
    -- Add voice-related columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'is_voice_note') THEN
        ALTER TABLE whatsapp_messages ADD COLUMN is_voice_note BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'voice_message_id') THEN
        ALTER TABLE whatsapp_messages ADD COLUMN voice_message_id UUID REFERENCES voice_messages(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_messages' AND column_name = 'voice_response_id') THEN
        ALTER TABLE whatsapp_messages ADD COLUMN voice_response_id UUID REFERENCES voice_responses(id);
    END IF;
END $$;

-- =========================================
-- Functions for voice processing
-- =========================================

-- Function to get conversation context
CREATE OR REPLACE FUNCTION get_voice_conversation_context(
    p_user_number TEXT,
    p_business_number TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    message_id TEXT,
    direction TEXT,
    content_type TEXT,
    content_text TEXT,
    transcript_text TEXT,
    response_text TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        wm.message_id,
        CASE WHEN wm.from_number = p_user_number THEN 'inbound' ELSE 'outbound' END as direction,
        wm.content_type,
        wm.content_text,
        vt.cleaned_transcript as transcript_text,
        vr.text_response as response_text,
        wm.created_at
    FROM whatsapp_messages wm
    LEFT JOIN voice_messages vm ON wm.id = vm.whatsapp_message_id
    LEFT JOIN voice_transcripts vt ON vm.id = vt.voice_message_id
    LEFT JOIN voice_responses vr ON vm.id = vr.voice_message_id
    WHERE (wm.from_number = p_user_number AND wm.to_number = p_business_number)
       OR (wm.from_number = p_business_number AND wm.to_number = p_user_number)
    ORDER BY wm.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function to update conversation stats
CREATE OR REPLACE FUNCTION update_voice_conversation_stats(
    p_user_number TEXT,
    p_business_number TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    conv_record RECORD;
BEGIN
    -- Get or create conversation record
    INSERT INTO voice_conversations (user_number, business_number)
    VALUES (p_user_number, p_business_number)
    ON CONFLICT (user_number, business_number) DO NOTHING;

    -- Update stats
    UPDATE voice_conversations
    SET
        last_message_at = NOW(),
        message_count = (
            SELECT COUNT(*)
            FROM whatsapp_messages
            WHERE (from_number = p_user_number AND to_number = p_business_number)
               OR (from_number = p_business_number AND to_number = p_user_number)
        ),
        total_audio_duration = COALESCE((
            SELECT SUM(audio_duration_seconds)
            FROM voice_messages vm
            JOIN whatsapp_messages wm ON vm.whatsapp_message_id = wm.id
            WHERE (wm.from_number = p_user_number AND wm.to_number = p_business_number)
        ), 0),
        average_confidence = (
            SELECT AVG(confidence_score)
            FROM voice_transcripts vt
            JOIN voice_messages vm ON vt.voice_message_id = vm.id
            JOIN whatsapp_messages wm ON vm.whatsapp_message_id = wm.id
            WHERE (wm.from_number = p_user_number AND wm.to_number = p_business_number)
        ),
        dominant_language = (
            SELECT detected_language
            FROM voice_transcripts vt
            JOIN voice_messages vm ON vt.voice_message_id = vm.id
            JOIN whatsapp_messages wm ON vm.whatsapp_message_id = wm.id
            WHERE (wm.from_number = p_user_number AND wm.to_number = p_business_number)
            GROUP BY detected_language
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        updated_at = NOW()
    WHERE user_number = p_user_number AND business_number = p_business_number;
END;
$$;