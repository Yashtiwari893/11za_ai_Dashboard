-- STEP-2.1: Database Schema for Chatbots, Data Sources, and WhatsApp Integration

-- 1. chatbots table
-- Stores information about each AI chatbot
CREATE TABLE chatbots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  language_mode TEXT DEFAULT 'auto' CHECK (language_mode IN ('auto', 'fixed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. data_sources table
-- Links chatbots to their knowledge sources (PDFs, OCR images, Shopify stores, future voice FAQs)
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'ocr_image', 'shopify', 'voice_faq')),
  reference_id UUID, -- References files.id, shopify_stores.id, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. whatsapp_numbers table
-- Stores WhatsApp business numbers with their auth tokens
CREATE TABLE whatsapp_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  auth_token TEXT NOT NULL,
  origin TEXT, -- e.g., '11za', 'twilio', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. chatbot_whatsapp_map table
-- Many-to-many relationship between chatbots and WhatsApp numbers
CREATE TABLE chatbot_whatsapp_map (
  chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,
  whatsapp_number_id UUID REFERENCES whatsapp_numbers(id) ON DELETE CASCADE,
  PRIMARY KEY (chatbot_id, whatsapp_number_id)
);

-- Indexes for performance
CREATE INDEX idx_chatbots_created_by ON chatbots(created_by);
CREATE INDEX idx_data_sources_chatbot_id ON data_sources(chatbot_id);
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_whatsapp_numbers_phone_number ON whatsapp_numbers(phone_number);

-- Enable Row Level Security (RLS) - policies will be added later
ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_whatsapp_map ENABLE ROW LEVEL SECURITY;