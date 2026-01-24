import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phoneNumber = searchParams.get('phone');

        if (!phoneNumber) {
            return NextResponse.json(
                { error: 'Phone number is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('phone_settings')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching phone settings:', error);
            return NextResponse.json(
                { error: 'Failed to fetch phone settings' },
                { status: 500 }
            );
        }

        // Return default settings if not found
        const settings = data || {
            phone_number: phoneNumber,
            voice_reply_enabled: false,
            preferred_language: 'en',
            voice_gender: 'female',
            voice_provider: 'mistral',
        };

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error in phone settings GET:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            phone_number,
            voice_reply_enabled,
            preferred_language,
            voice_gender,
            voice_provider
        } = body;

        if (!phone_number) {
            return NextResponse.json(
                { error: 'Phone number is required' },
                { status: 400 }
            );
        }

        // Validate inputs
        if (voice_gender && !['male', 'female'].includes(voice_gender)) {
            return NextResponse.json(
                { error: 'Invalid voice gender. Must be male or female' },
                { status: 400 }
            );
        }

        if (voice_provider && !['mistral', 'azure', 'elevenlabs'].includes(voice_provider)) {
            return NextResponse.json(
                { error: 'Invalid voice provider. Must be mistral, azure, or elevenlabs' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('phone_settings')
            .upsert({
                phone_number,
                voice_reply_enabled: voice_reply_enabled ?? false,
                preferred_language: preferred_language ?? 'en',
                voice_gender: voice_gender ?? 'female',
                voice_provider: voice_provider ?? 'mistral',
            })
            .select()
            .single();

        if (error) {
            console.error('Error updating phone settings:', error);
            return NextResponse.json(
                { error: 'Failed to update phone settings' },
                { status: 500 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in phone settings POST:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}