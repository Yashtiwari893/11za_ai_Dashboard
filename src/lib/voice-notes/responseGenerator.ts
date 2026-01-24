import { supabase } from '@/lib/supabaseClient';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!
});

export interface ResponseResult {
    success: boolean;
    error?: string;
    textResponse?: string;
    voiceScript?: string;
}

/**
 * Generate human-like response for voice conversations
 */
export async function generateHumanLikeResponse(
    transcript: string,
    intent: string,
    knowledge: any[],
    language: string,
    voiceMessageId: string,
    fromNumber: string,
    toNumber: string
): Promise<ResponseResult> {
    try {
        console.log(`💭 Generating response for intent: ${intent}`);

        // Get conversation context
        const context = await getConversationContext(fromNumber, toNumber, 5);

        // Build knowledge context
        const knowledgeContext = buildKnowledgeContext(knowledge);

        // Generate response using LLM
        const response = await generateResponseWithLLM(
            transcript,
            intent,
            knowledgeContext,
            context,
            language
        );

        // Create voice-optimized script
        const voiceScript = createVoiceScript(response, language);

        // Store response in database
        await storeResponse(voiceMessageId, response, voiceScript);

        console.log(`✅ Generated response: "${response}"`);

        return {
            success: true,
            textResponse: response,
            voiceScript
        };

    } catch (error) {
        console.error('❌ Response generation failed:', error);

        // Fallback response
        const fallbackResponse = getFallbackResponse(intent, language);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            textResponse: fallbackResponse,
            voiceScript: fallbackResponse
        };
    }
}

/**
 * Get recent conversation context
 */
async function getConversationContext(
    userNumber: string,
    businessNumber: string,
    limit: number
): Promise<Array<{role: string, content: string}>> {
    try {
        const { data, error } = await supabase
            .rpc('get_voice_conversation_context', {
                p_user_number: userNumber,
                p_business_number: businessNumber,
                p_limit: limit
            });

        if (error || !data) return [];

        return data.map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.transcript_text || msg.content_text || ''
        }));

    } catch (error) {
        console.error('Failed to get conversation context:', error);
        return [];
    }
}

/**
 * Build knowledge context from retrieved items
 */
function buildKnowledgeContext(knowledge: any[]): string {
    if (!knowledge || knowledge.length === 0) {
        return 'No specific knowledge available.';
    }

    const contextParts = knowledge.map(item => {
        switch (item.type) {
            case 'pdf_chunk':
                return `Document: ${item.content}`;
            case 'shopify_product':
                return `Product: ${item.content}`;
            case 'voice_pattern':
                return `Similar conversation: ${item.content}`;
            default:
                return item.content;
        }
    });

    return contextParts.join('\n\n');
}

/**
 * Generate response using Groq LLM
 */
async function generateResponseWithLLM(
    transcript: string,
    intent: string,
    knowledge: string,
    context: Array<{role: string, content: string}>,
    language: string
): Promise<string> {
    const systemPrompt = createSystemPrompt(language);
    const userPrompt = createUserPrompt(transcript, intent, knowledge, context, language);

    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        model: 'mixtral-8x7b-32768',
        temperature: 0.7,
        max_tokens: 300,
        top_p: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || getFallbackResponse(intent, language);
}

/**
 * Create system prompt for voice responses
 */
function createSystemPrompt(language: string): string {
    const prompts = {
        hi: `तुम एक सहायक WhatsApp असिस्टेंट हो। तुम्हारी प्रतिक्रियाएं:
- हमेशा हिंदी में होनी चाहिए
- बातचीत जैसी लगनी चाहिए, औपचारिक नहीं
- छोटे वाक्य इस्तेमाल करो
- "हाँ", "अच्छा", "ठीक है" जैसे शब्दों का इस्तेमाल करो
- कभी भी "AI" या "बॉट" का जिक्र न करो
- ग्राहक की भाषा का सम्मान करो
- सहायक और मिलनसार बनो`,

        en: `You are a helpful WhatsApp assistant. Your responses should:
- Always be in English
- Sound conversational, not formal
- Use short sentences
- Include filler words like "yeah", "okay", "sure"
- Never mention "AI" or "bot"
- Respect customer's language
- Be helpful and friendly`,

        mr: `तुम एक सहायक WhatsApp असिस्टेंट आहात. तुमच्या प्रतिक्रिया:
- नेहमी मराठीत असाव्यात
- गप्पा मारल्यासारख्या वाटाव्यात, औपचारिक नाही
- छोटी वाक्ये वापरा
- "हो", "बरं", "ठीक" असं बोलावं
- कधीही "AI" किंवा "बॉट" न सांगा
- ग्राहकाच्या भाषेचा मान राखा
- सहायक आणि मैत्रीपूर्ण व्हा`,

        gu: `તમે એક મદદગાર WhatsApp સહાયક છો. તમારા જવાબ:
- હંમેશા ગુજરાતીમાં હોવા જોઈએ
- વાતચીત જેવા લાગવા જોઈએ, ઔપચારિક નહીં
- નાના વાક્યો વાપરો
- "હા", "બરાબર", "ઠીક છે" જેવા શબ્દો વાપરો
- ક્યારેય "AI" અથવા "બૉટ" ન ઉલ્લેખ કરો
- ગ્રાહકની ભાષાનો આદર કરો
- મદદગાર અને મૈત્રીપૂર્ણ બનો`
    };

    return prompts[language as keyof typeof prompts] || prompts.hi;
}

/**
 * Create user prompt with context
 */
function createUserPrompt(
    transcript: string,
    intent: string,
    knowledge: string,
    context: Array<{role: string, content: string}>,
    language: string
): string {
    const contextStr = context.length > 0
        ? `\n\nपिछली बातचीत:\n${context.map(c => `${c.role}: ${c.content}`).join('\n')}`
        : '';

    return `ग्राहक ने कहा: "${transcript}"

Intent: ${intent}
Knowledge: ${knowledge}${contextStr}

उपर दिए गए संदर्भ के आधार पर एक सहायक जवाब दो।`;
}

/**
 * Create voice-optimized script for TTS
 */
function createVoiceScript(textResponse: string, language: string): string {
    // Add pauses and emphasis for better voice delivery
    let script = textResponse;

    // Add pause markers for TTS
    script = script.replace(/[,;]/g, '...');
    script = script.replace(/[.!?]/g, '। ');

    // Add conversational elements
    if (language === 'hi') {
        // Add Hindi conversational fillers
        if (Math.random() > 0.7) {
            script = script.replace(/^/, 'अच्छा, ');
        }
        if (Math.random() > 0.8) {
            script = script.replace(/$/, ' जी।');
        }
    }

    return script.trim();
}

/**
 * Store response in database
 */
async function storeResponse(
    voiceMessageId: string,
    textResponse: string,
    voiceScript: string
): Promise<void> {
    try {
        await supabase
            .from('voice_responses')
            .insert({
                voice_message_id: voiceMessageId,
                text_response: textResponse,
                voice_script: voiceScript,
                response_type: 'voice'
            });
    } catch (error) {
        console.error('Failed to store response:', error);
        // Don't throw - not critical
    }
}

/**
 * Get fallback response for errors
 */
function getFallbackResponse(intent: string, language: string): string {
    const fallbacks = {
        hi: {
            greeting: 'नमस्ते! क्या मदद चाहिए?',
            question: 'माफ़ कीजिए, मैं यह समझ नहीं पाया। क्या आप दोहरा सकते हैं?',
            complaint: 'माफ़ कीजिए, मैं आपकी समस्या को हल करने की कोशिश कर रहा हूँ।',
            order: 'ठीक है, मैं आपका ऑर्डर प्रोसेस करता हूँ।',
            default: 'माफ़ कीजिए, मैं समझ नहीं पाया। क्या आप स्पष्ट कर सकते हैं?'
        },
        en: {
            greeting: 'Hello! How can I help you?',
            question: 'Sorry, I didn\'t understand. Can you please repeat?',
            complaint: 'Sorry, I\'m trying to resolve your issue.',
            order: 'Okay, I\'ll process your order.',
            default: 'Sorry, I didn\'t catch that. Can you clarify?'
        }
    };

    const langFallbacks = fallbacks[language as keyof typeof fallbacks] || fallbacks.hi;

    return langFallbacks[intent as keyof typeof langFallbacks] || langFallbacks.default;
}