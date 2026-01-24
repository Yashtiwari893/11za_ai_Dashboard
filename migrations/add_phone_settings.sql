-- Create phone_settings table for voice reply preferences
CREATE TABLE IF NOT EXISTS phone_settings (
    phone_number TEXT PRIMARY KEY,
    voice_reply_enabled BOOLEAN DEFAULT FALSE,
    preferred_language TEXT DEFAULT 'en',
    voice_gender TEXT DEFAULT 'female' CHECK (voice_gender IN ('male', 'female')),
    voice_provider TEXT DEFAULT 'mistral' CHECK (voice_provider IN ('mistral', 'azure', 'elevenlabs')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_settings_enabled ON phone_settings(voice_reply_enabled);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_phone_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phone_settings_updated_at_trigger
    BEFORE UPDATE ON phone_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_phone_settings_updated_at();

-- Insert default settings for existing phone numbers (if any)
INSERT INTO phone_settings (phone_number)
SELECT DISTINCT phone_number FROM whatsapp_messages
ON CONFLICT (phone_number) DO NOTHING;