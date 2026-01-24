import { supabase } from '@/lib/supabaseClient';

export interface AudioStorageResult {
    success: boolean;
    error?: string;
    audioUrl?: string;
    fileName?: string;
}

/**
 * Download audio from WhatsApp media URL and store in Supabase Storage
 */
export async function downloadAndStoreAudio(
    mediaUrl: string,
    originalFileName?: string
): Promise<AudioStorageResult> {
    try {
        console.log(`📥 Downloading audio from: ${mediaUrl}`);

        // Download the audio file
        const response = await fetch(mediaUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                'User-Agent': 'WhatsApp-API/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'audio/ogg';

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const extension = getAudioExtension(contentType);
        const fileName = originalFileName ||
            `voice_${timestamp}_${randomId}.${extension}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('voice-notes')
            .upload(fileName, audioBuffer, {
                contentType: contentType,
                upsert: false
            });

        if (error) {
            throw new Error(`Supabase storage upload failed: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('voice-notes')
            .getPublicUrl(fileName);

        console.log(`✅ Audio stored successfully: ${fileName}`);

        return {
            success: true,
            audioUrl: urlData.publicUrl,
            fileName
        };

    } catch (error) {
        console.error('❌ Audio storage failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get appropriate file extension based on content type
 */
function getAudioExtension(contentType: string): string {
    const extensions: Record<string, string> = {
        'audio/ogg': 'ogg',
        'audio/opus': 'opus',
        'audio/mp3': 'mp3',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/webm': 'webm',
        'audio/aac': 'aac'
    };

    return extensions[contentType] || 'ogg'; // Default to ogg for WhatsApp
}

/**
 * Delete audio file from storage (cleanup)
 */
export async function deleteAudioFile(fileName: string): Promise<boolean> {
    try {
        const { error } = await supabase.storage
            .from('voice-notes')
            .remove([fileName]);

        if (error) {
            console.error('Failed to delete audio file:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error deleting audio file:', error);
        return false;
    }
}