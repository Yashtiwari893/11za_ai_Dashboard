import { supabase } from '@/lib/supabaseClient';

export interface WhatsAppSendResult {
    success: boolean;
    error?: string;
    messageId?: string;
}

/**
 * Send voice response via WhatsApp API
 */
export async function sendWhatsAppVoiceResponse(
    toNumber: string,
    fromNumber: string,
    audioUrl: string,
    textMessage?: string,
    voiceMessageId?: string
): Promise<WhatsAppSendResult> {
    try {
        console.log(`📤 Sending voice response to ${toNumber}`);

        // Get WhatsApp credentials for this business number
        const credentials = await getWhatsAppCredentials(fromNumber);
        if (!credentials) {
            throw new Error('WhatsApp credentials not found for business number');
        }

        // Send voice message via 11za API
        const response = await sendVoiceMessage(
            credentials,
            toNumber,
            audioUrl,
            textMessage
        );

        if (!response.success) {
            throw new Error(`WhatsApp API error: ${response.error}`);
        }

        // Update database with sent status
        if (voiceMessageId) {
            await updateResponseStatus(voiceMessageId, response.messageId);
        }

        console.log(`✅ Voice response sent: ${response.messageId}`);

        return {
            success: true,
            messageId: response.messageId
        };

    } catch (error) {
        console.error('❌ WhatsApp voice send failed:', error);

        // Update failure status
        if (voiceMessageId) {
            await updateResponseStatus(voiceMessageId, undefined, error instanceof Error ? error.message : 'Unknown error');
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get WhatsApp credentials for business number
 */
async function getWhatsAppCredentials(businessNumber: string): Promise<{
    apiKey: string;
    instanceId: string;
    accessToken?: string;
} | null> {
    try {
        const { data, error } = await supabase
            .from('phone_mappings')
            .select('whatsapp_api_key, whatsapp_instance_id, whatsapp_access_token')
            .eq('phone_number', businessNumber)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            apiKey: data.whatsapp_api_key,
            instanceId: data.whatsapp_instance_id,
            accessToken: data.whatsapp_access_token
        };

    } catch (error) {
        console.error('Failed to get WhatsApp credentials:', error);
        return null;
    }
}

/**
 * Send voice message via 11za WhatsApp API
 */
async function sendVoiceMessage(
    credentials: any,
    toNumber: string,
    audioUrl: string,
    textMessage?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
        const apiUrl = `https://api.11za.in/sendVoice`;

        // Prepare request payload
        const payload = {
            instance_id: credentials.instanceId,
            access_token: credentials.accessToken || credentials.apiKey,
            to: toNumber,
            audio_url: audioUrl,
            ...(textMessage && { caption: textMessage })
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`11za API error: ${result.message || response.statusText}`);
        }

        if (result.status !== 'success') {
            throw new Error(`11za API returned error: ${result.message}`);
        }

        return {
            success: true,
            messageId: result.message_id || result.id
        };

    } catch (error) {
        console.error('11za API call failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown API error'
        };
    }
}

/**
 * Update response status in database
 */
async function updateResponseStatus(
    voiceMessageId: string,
    messageId?: string,
    error?: string
): Promise<void> {
    try {
        const updateData: any = {
            sent_at: new Date().toISOString(),
            delivery_status: messageId ? 'sent' : 'failed'
        };

        if (messageId) {
            updateData.whatsapp_message_id = messageId;
        }

        if (error) {
            updateData.delivery_error = error;
        }

        await supabase
            .from('voice_responses')
            .update(updateData)
            .eq('voice_message_id', voiceMessageId);

    } catch (dbError) {
        console.error('Failed to update response status:', dbError);
        // Don't throw - not critical
    }
}

/**
 * Send text message only (fallback)
 */
export async function sendWhatsAppTextResponse(
    toNumber: string,
    fromNumber: string,
    textMessage: string,
    voiceMessageId?: string
): Promise<WhatsAppSendResult> {
    try {
        console.log(`📤 Sending text fallback to ${toNumber}: "${textMessage}"`);

        const credentials = await getWhatsAppCredentials(fromNumber);
        if (!credentials) {
            throw new Error('WhatsApp credentials not found');
        }

        const apiUrl = `https://api.11za.in/sendMessage`;

        const payload = {
            instance_id: credentials.instanceId,
            access_token: credentials.accessToken || credentials.apiKey,
            to: toNumber,
            message: textMessage
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
            throw new Error(`11za API error: ${result.message || response.statusText}`);
        }

        return {
            success: true,
            messageId: result.message_id || result.id
        };

    } catch (error) {
        console.error('❌ WhatsApp text send failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Check delivery status of sent message
 */
export async function checkMessageStatus(
    messageId: string,
    businessNumber: string
): Promise<'sent' | 'delivered' | 'read' | 'failed'> {
    try {
        const credentials = await getWhatsAppCredentials(businessNumber);
        if (!credentials) {
            return 'failed';
        }

        const apiUrl = `https://api.11za.in/messageStatus`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.apiKey}`
            },
            body: JSON.stringify({
                instance_id: credentials.instanceId,
                access_token: credentials.accessToken || credentials.apiKey,
                message_id: messageId
            })
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            return result.delivery_status || 'sent';
        }

        return 'failed';

    } catch (error) {
        console.error('Failed to check message status:', error);
        return 'failed';
    }
}