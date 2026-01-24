import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST() {
    try {
        console.log('Starting phone settings migration...');

        // Test if table exists by trying to select from it
        const { error: testError } = await supabase
            .from('phone_settings')
            .select('phone_number')
            .limit(1);

        if (!testError) {
            return NextResponse.json({
                success: true,
                message: 'Phone settings table already exists'
            });
        }

        // If we get here, table doesn't exist - we'll need to create it manually
        // For now, return instructions
        return NextResponse.json({
            success: false,
            message: 'Please run the SQL migration manually in your Supabase dashboard',
            sql: `
-- Run this in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS phone_settings (
    phone_number TEXT PRIMARY KEY,
    voice_reply_enabled BOOLEAN DEFAULT FALSE,
    preferred_language TEXT DEFAULT 'en',
    voice_gender TEXT DEFAULT 'female' CHECK (voice_gender IN ('male', 'female')),
    voice_provider TEXT DEFAULT 'mistral' CHECK (voice_provider IN ('mistral', 'azure', 'elevenlabs')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_settings_enabled ON phone_settings(voice_reply_enabled);

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

INSERT INTO phone_settings (phone_number)
SELECT DISTINCT phone_number FROM whatsapp_messages
ON CONFLICT (phone_number) DO NOTHING;
            `
        });
    } catch (err: unknown) {
        console.error("MIGRATION_ERROR:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}