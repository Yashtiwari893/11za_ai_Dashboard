import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { voiceBrainIngestion } from '@/lib/voice-brain/ingestion';
import { transcriptCleaner } from '@/lib/voice-brain/cleaner';
import { intentExtractor, intentClustering, embeddingGenerator } from '@/lib/voice-brain/intent-extraction';

// Upload call recording
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('audio') as File;
        const phoneNumber = formData.get('phoneNumber') as string;
        const language = formData.get('language') as string || 'hi';
        const duration = parseInt(formData.get('duration') as string) || 0;

        if (!file || !phoneNumber) {
            return NextResponse.json(
                { error: 'Audio file and phone number are required' },
                { status: 400 }
            );
        }

        // Upload to Supabase Storage
        const fileName = `calls/${phoneNumber}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice-recordings')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json(
                { error: 'Failed to upload audio file' },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('voice-recordings')
            .getPublicUrl(fileName);

        // Save call record
        const { data: callData, error: callError } = await supabase
            .from('voice_calls')
            .insert({
                phone_number: phoneNumber,
                audio_url: urlData.publicUrl,
                duration_seconds: duration,
                language,
                call_direction: 'inbound'
            })
            .select()
            .single();

        if (callError) {
            console.error('Database insert error:', callError);
            return NextResponse.json(
                { error: 'Failed to save call record' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            callId: callData.id,
            message: 'Call recording uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}