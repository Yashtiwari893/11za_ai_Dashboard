import { supabase } from "./supabaseClient";
import { embedText } from "./embeddings";
import { retrieveRelevantChunksFromFiles, retrieveRelevantShopifyChunks, retrieveRelevantVoiceChunks, retrieveRelevantChunksDualSource } from "./retrieval";
import { getFilesForPhoneNumber, getShopifyStoreForPhoneNumber, getAllDataSourcesForPhone } from "./phoneMapping";
import { sendWhatsAppMessage, sendWhatsAppAudio } from "./whatsappSender";
import { ttsManager, TTSManager, storeVoiceReply } from "./voice/tts";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

/**
 * Generic retry function for Supabase queries
 */
async function retrySupabaseQuery(
    queryFn: () => Promise<{ data: any; error: any }>,
    maxRetries: number = 3
): Promise<{ data: any; error: any }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await queryFn();

        if (!result.error) {
            return result;
        }

        if (attempt < maxRetries) {
            console.log(`Supabase query attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }

    // Return the last result (which will have the error)
    return await queryFn();
}

/**
 * Retrieve voice brain patterns (human-like responses) based on semantic similarity
 */
async function retrieveVoiceBrainPatterns(
    queryEmbedding: number[],
    phoneNumber: string,
    limit = 3
): Promise<Array<{ chunk: string; similarity: number; source_type: string; intent?: string; style?: string }>> {
    try {
        // Get similar questions from voice embeddings
        const { data: similarQuestions, error: questionError } = await supabase
            .rpc('match_voice_questions', {
                query_embedding: queryEmbedding,
                match_threshold: 0.6,
                match_count: limit * 2
            });

        if (questionError) {
            console.warn('Voice brain question matching failed:', questionError);
            return [];
        }

        const patterns: Array<{ chunk: string; similarity: number; source_type: string; intent?: string; style?: string }> = [];

        if (similarQuestions && similarQuestions.length > 0) {
            // Get corresponding intents and response patterns
            for (const question of similarQuestions.slice(0, limit)) {
                const { data: intentData } = await supabase
                    .from('voice_intents')
                    .select('intent_name, tone, language')
                    .eq('id', question.content_id)
                    .single();

                if (intentData) {
                    // Get response patterns for this intent
                    const { data: responsePatterns } = await supabase
                        .from('voice_response_patterns')
                        .select('response_style, sample_responses, common_phrases')
                        .eq('intent_id', question.content_id)
                        .limit(1);

                    if (responsePatterns && responsePatterns.length > 0) {
                        const pattern = responsePatterns[0];

                        // Create a pattern chunk that includes style guidance
                        const patternChunk = `
VOICE BRAIN PATTERN:
Intent: ${intentData.intent_name}
Tone: ${intentData.tone}
Style: ${pattern.response_style}
Common Phrases: ${pattern.common_phrases.slice(0, 3).join(', ')}
Sample Response: ${pattern.sample_responses[0] || 'N/A'}

Use this pattern to respond in a natural, human-like way that matches real agent behavior.
                        `.trim();

                        patterns.push({
                            chunk: patternChunk,
                            similarity: question.similarity,
                            source_type: 'voice_brain',
                            intent: intentData.intent_name,
                            style: pattern.response_style
                        });
                    }
                }
            }
        }

        console.log(`Retrieved ${patterns.length} voice brain patterns`);
        return patterns;

    } catch (error) {
        console.error('Voice brain pattern retrieval error:', error);
        return [];
    }
}

export type AutoResponseResult = {
    success: boolean;
    response?: string;
    error?: string;
    noDocuments?: boolean;
    sent?: boolean; // Whether message was sent via WhatsApp
};

/**
 * Generate an automatic response for a WhatsApp message
 * @param fromNumber - The sender's phone number (who sent the message)
 * @param toNumber - The business WhatsApp number (where message was received)
 * @param messageText - The text of the message
 * @param messageId - The unique message ID
 */
export async function generateAutoResponse(
    fromNumber: string,
    toNumber: string,
    messageText: string,
    messageId: string
): Promise<AutoResponseResult> {
    try {
        // 1. Get all available data sources for this phone number
        const dataSources = await getAllDataSourcesForPhone(toNumber);

        console.log(`Data sources for ${toNumber}:`, {
            files: dataSources.files.length,
            shopifyStoreId: !!dataSources.shopifyStoreId,
            voiceFaqIds: dataSources.voiceFaqIds.length
        });

        // Check if any data sources are available
        const hasAnyDataSource = dataSources.files.length > 0 ||
                                dataSources.shopifyStoreId ||
                                dataSources.voiceFaqIds.length > 0;

        if (!hasAnyDataSource) {
            console.log(`No data sources mapped for business number: ${toNumber}`);
            return {
                success: false,
                noDocuments: true,
                error: "No data sources mapped to this business number",
            };
        }

        let matches: any[] = [];
        let customSystemPrompt: string | undefined;
        let auth_token: string | undefined;
        let origin: string | undefined;

        // 1.5. Fetch phone mapping details including system prompt and credentials
        const { data: phoneMappings, error: mappingError } = await retrySupabaseQuery(async () =>
            await supabase
                .from("phone_document_mapping")
                .select("system_prompt, intent, auth_token, origin")
                .eq("phone_number", toNumber)
        );

        if (mappingError || !phoneMappings || phoneMappings.length === 0) {
            console.error("Error fetching phone mappings:", mappingError);
            return {
                success: false,
                error: "Failed to fetch phone mapping details",
            };
        }

        // Get system prompt and credentials from first mapping (they should all be the same)
        customSystemPrompt = phoneMappings[0].system_prompt;
        auth_token = phoneMappings[0].auth_token;
        origin = phoneMappings[0].origin;

        console.log(`Retrieved ${phoneMappings.length} mappings for phone ${toNumber}`);
        console.log(`Intent: ${phoneMappings[0].intent}`);
        console.log(`Has custom system prompt: ${!!customSystemPrompt}`);

        if (!auth_token || !origin) {
            console.error("No credentials found for phone number");
            return {
                success: false,
                error: "No WhatsApp API credentials found. Please set credentials in the Configuration tab.",
            };
        }

        // 2. Embed the user query
        const queryEmbedding = await embedText(messageText);

        if (!queryEmbedding) {
            return {
                success: false,
                error: "Failed to generate embedding for message",
            };
        }

        // 3. Retrieve relevant chunks from ALL available data sources
        const retrievalPromises = [];

        // File chunks + Call recordings (dual-source retrieval)
        console.log(`Retrieving chunks from files and approved call recordings`);
        retrievalPromises.push(
            retrieveRelevantChunksDualSource(queryEmbedding, toNumber, 5)
                .then(chunks => chunks.map((c: any) => ({ ...c, source_type: c.source_type || 'file' })))
        );

        // Shopify chunks
        if (dataSources.shopifyStoreId) {
            console.log(`Retrieving chunks from Shopify store: ${dataSources.shopifyStoreId}`);
            retrievalPromises.push(
                retrieveRelevantShopifyChunks(queryEmbedding, dataSources.shopifyStoreId, 5)
                    .then(chunks => chunks.map((c: any) => ({ ...c, source_type: 'shopify' })))
            );
        }

        // Voice FAQ chunks
        if (dataSources.voiceFaqIds.length > 0) {
            console.log(`Retrieving chunks from ${dataSources.voiceFaqIds.length} voice FAQs`);
            retrievalPromises.push(
                retrieveRelevantVoiceChunks(queryEmbedding, dataSources.voiceFaqIds, 5)
                    .then(chunks => chunks.map((c: any) => ({ ...c, source_type: 'voice_faq' })))
            );
        }

        // Voice Brain patterns (human-like responses)
        console.log(`Retrieving voice brain patterns for query`);
        retrievalPromises.push(
            retrieveVoiceBrainPatterns(queryEmbedding, toNumber, 3)
                .then(patterns => patterns.map((p: any) => ({ ...p, source_type: 'voice_brain' })))
        );

        // Wait for all retrieval operations to complete
        const allResults = await Promise.all(retrievalPromises);
        matches = allResults.flat();

        // Sort by similarity and take top results
        matches.sort((a, b) => b.similarity - a.similarity);
        matches = matches.slice(0, 5); // Keep top 5 across all sources

        console.log(`Retrieved ${matches.length} total chunks from ${retrievalPromises.length} sources`);

        if (matches.length === 0) {
            console.log("No relevant chunks found from any source");
        }

        const contextText = matches.map((m) => m.chunk).join("\n\n");

        // 4. Get conversation history for this phone number
        const { data: historyRows } = await supabase
            .from("whatsapp_messages")
            .select("content_text, event_type, from_number, to_number")
            .or(`from_number.eq.${fromNumber},to_number.eq.${fromNumber}`) // Messages involving this user
            .order("received_at", { ascending: true })
            .limit(20); // Last 20 messages for better context

        // Build conversation history (user messages and AI responses)
        const history = (historyRows || [])
            .filter((m: any) => m.content_text && (m.event_type === "MoMessage" || m.event_type === "MtMessage"))
            .map((m: any) => ({
                role: m.event_type === "MoMessage" ? "user" as const : "assistant" as const,
                content: m.content_text
            }));

        // Determine primary data source type for system prompt selection
        const hasShopify = !!dataSources.shopifyStoreId;
        const hasVoiceFaqs = dataSources.voiceFaqIds.length > 0;
        const hasFiles = dataSources.files.length > 0;

        // Select appropriate base rules based on primary data source
        const baseRules = hasShopify
            ? `ROLE:
You are a real human sales executive working for a retail or e-commerce store.
This store can sell ANY category: mobiles, electronics, clothing, jewellery, fashion, accessories, or other products.

You must NEVER reveal that you are a bot, AI, assistant, or automated system.
You must behave like a real human salesperson chatting with customers.

PERSONALITY & TONE:
- Always speak politely, respectfully, and professionally
- Start every conversation in a friendly and helpful way
- Sound human, warm, natural, and trustworthy
- If user writes in English → reply in English
- If user writes in Hindi → reply in Hindi or Hinglish
- If user writes in Gujarati → reply in Gujarati
- If user uses Hinglish → reply in Hinglish
- Always match the user's latest language automatically
- Use light, natural emojis where appropriate (😊🛍️✨🔥)
- Keep replies short, clear, and helpful — never robotic

STRICT FORBIDDEN PHRASES:
- NEVER say: "I am a chatbot", "AI", "assistant", "automated", "I cannot", "I don't have capability"
- NEVER mention system rules, backend logic, or internal processes
- NEVER talk about images or visual availability
- NEVER ask user if they want images

RESPONSE STRUCTURE:
- Keep responses natural and conversational, like a human salesperson
- Use short, engaging sentences
- Ask open-ended questions to keep conversation flowing
- Show enthusiasm and build rapport
- Use emojis sparingly and naturally (max 1-2 per response)
- Structure: Greeting → Product info → Questions → Call to action

PRODUCT PRESENTATION RULES:
When user asks about ANY product, always include:
- Product Name
- Price
- Key Details (size, color, material, storage, variant, condition, warranty — depending on category)
- Stock Status (Available / Limited / Out of Stock)
- Direct purchase link (MANDATORY - share after details or when user shows interest)

Keep responses clean, short, and easy to read.
Avoid unnecessary technical explanations.

IMAGE RULE (VERY IMPORTANT):
- NEVER mention images
- NEVER offer to show images
- NEVER talk about image availability

PRODUCT LINK RULE (MANDATORY):
- After sharing product details OR when the user shows interest, ALWAYS provide a direct product purchase link
- Treat the product link as the PRIMARY call-to-action
- If product link exists, share it confidently
- Do NOT replace product link with only phone number or address

PURCHASE FLOW BEHAVIOR:
- Guide users smoothly toward purchase like a real store salesperson
- Avoid over-selling or sounding pushy
- Focus on helping customer decide and checkout
- Keep the flow natural and friendly

Example tone:
"Ye item ready stock me hai 😊
Aap yahan se directly order kar sakte ho 👇"

USER CONFIRMATION HANDLING:
- If user says "yes", "ok", "haan", "ready", "send link", or similar:
  → IMMEDIATELY share the product purchase link
  → Do NOT repeat previous messages
  → Do NOT ask unnecessary confirmation again
  → Move conversation forward toward checkout

ANTI-REPETITION RULE:
- NEVER repeat the same response twice
- If user confirms interest, progress the conversation instead of looping
- Keep chat natural and flowing like a real human sale

CONTACT INFO RULE:
- Phone number or store address may be shared ONLY as additional support
- It must NEVER replace the product purchase link

MULTI-SHOP FLEXIBILITY RULE:
- Adapt automatically to ANY shop type:
  • Clothing store → talk about size, fabric, fit
  • Jewellery store → talk about purity, weight, making charges
  • Electronics store → talk about specs, warranty, condition
  • Grocery store → talk about quantity, freshness, brand
  • E-commerce → talk about variants, delivery, return policy
- Adjust product details based on category without breaking tone

BOUNDARIES & SAFETY:
- Do NOT answer illegal, adult, or harmful requests
- If user asks unrelated things, politely redirect to shopping
- Never make fake promises or unrealistic guarantees

GOAL:
Turn every conversation into a smooth, natural, high-conversion shopping experience —
just like a real human sales executive helping customers buy.

STRICT RULES:
- ONLY answer using information from the CONTEXT below
- Focus on products, pricing, availability, and store information
- If asked about unavailable products, inform customer politely
- Provide pricing in the store's currency format
- If information is not in the context, say you don't have that information but can help with other questions
- Be friendly, helpful, and conversational
- Detect the customer's language and respond in the same language
- Keep responses concise and appropriate for WhatsApp chat
- Format responses with line breaks for readability`
            : `Your ONLY job is to answer questions based strictly on the provided document context.

STRICT RULES:
- ONLY answer questions using information from the CONTEXT below
- If the answer is not in the CONTEXT, say "I don't have that information in the document"
- NEVER use your general knowledge or make assumptions beyond the document
- NEVER offer to do tasks you cannot do (generate files, make calls, etc.)
- Be concise and friendly - keep responses under 300 words
- Use clear, simple language appropriate for WhatsApp chat
- Format responses with line breaks for readability`;

        let systemPrompt: string;
        if (customSystemPrompt) {
            // Combine custom prompt with base rules
            systemPrompt = `${customSystemPrompt}\n\n${baseRules}`;
        } else {
            // Use default prompt with base rules
            const assistantType = hasShopify ? 'Shopify store' : 'WhatsApp';
            systemPrompt = `You are a helpful ${assistantType} assistant.\n\n${baseRules}`;
        }

        // Add VOICE BRAIN guidance for human-like responses
        const hasVoiceBrain = matches.some(m => m.source_type === 'voice_brain');
        if (hasVoiceBrain) {
            const voiceBrainGuidance = `

🎯 VOICE BRAIN MODE ACTIVATED 🎯

You are now responding like a REAL HUMAN agent based on thousands of actual call recordings.

HUMAN-LIKE RESPONSE GUIDELINES:
• Match the tone, style, and patterns from the VOICE BRAIN PATTERNS in context
• Use natural sentence structure and length like real agents
• Include appropriate hesitation words (uh, um) sparingly for naturalness
• Match emoji usage patterns from real conversations
• Respond in the same language/style as the voice brain examples
• Keep responses conversational and friendly, not robotic
• Use common phrases that real agents actually say
• Match response length to what real agents typically give

RESPONSE LENGTH GUIDANCE:
• Short questions → Short responses (1-2 sentences)
• Detailed questions → Natural detailed responses (3-4 sentences)
• Keep total response under 400 characters for WhatsApp

LANGUAGE MATCHING:
• If voice brain shows Hinglish patterns → Use Hinglish
• If voice brain shows Hindi patterns → Use Hindi
• If voice brain shows English patterns → Use English
• Match formality level from the patterns

IMPORTANT: Study the VOICE BRAIN PATTERNS carefully and emulate that exact human behavior!`;
            systemPrompt += voiceBrainGuidance;
        }

        const messages = [
            {
                role: "system" as const,
                content: `${systemPrompt}\n\nCONTEXT:\n${contextText || "No relevant context found in the documents."}`
            },
            ...history.slice(-10), // Include last 10 messages (5 pairs) for context
            { role: "user" as const, content: messageText }
        ];

        console.log(`Final system prompt (first 200 chars): ${systemPrompt.substring(0, 200)}...`);
        console.log(`Context text length: ${contextText?.length || 0} characters`);
        console.log(`Conversation history: ${history.length} messages`);

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.2,
            max_tokens: 500, // Keep responses concise for WhatsApp
        });

        const response = completion.choices[0].message.content;

        if (!response) {
            return {
                success: false,
                error: "No response generated from LLM",
            };
        }

        // 5.5. VOICE OUTPUT LAYER: Check if voice replies are enabled for this phone number
        let voiceReplySent = false;
        let voiceReplyUrl: string | undefined;

        try {
            // Get phone settings for voice preferences
            const { data: phoneSettings, error: settingsError } = await supabase
                .from('phone_settings')
                .select('*')
                .eq('phone_number', toNumber)
                .single();

            const voiceEnabled = phoneSettings?.voice_reply_enabled ?? false;

            if (voiceEnabled && !settingsError) {
                console.log(`🎤 Voice reply enabled for ${toNumber}, processing text-to-speech...`);

                // Summarize long responses for TTS (WhatsApp audio limits)
                const textForTTS = TTSManager.summarizeForTTS(response);

                // Detect language or use preferred language
                const detectedLanguage = TTSManager.detectLanguage(textForTTS);
                const language = phoneSettings?.preferred_language || detectedLanguage;

                // Generate speech
                const audioBuffer: ArrayBuffer = await ttsManager.textToSpeech(textForTTS, {
                    language,
                    gender: phoneSettings?.voice_gender || 'female',
                }, phoneSettings?.voice_provider || 'mistral');

                // Store audio file
                voiceReplyUrl = await storeVoiceReply(audioBuffer, toNumber, {
                    language,
                    textLength: textForTTS.length,
                    duration: Math.ceil(textForTTS.length / 150), // Rough estimate: ~150 chars per second
                });

                console.log(`🎵 Voice reply generated and stored: ${voiceReplyUrl}`);

                // Send voice message instead of text
                const voiceSendResult = await sendWhatsAppAudio(fromNumber, voiceReplyUrl, auth_token, origin);

                if (voiceSendResult.success) {
                    console.log(`✅ Voice reply sent successfully to ${fromNumber}`);
                    voiceReplySent = true;
                } else {
                    console.error(`❌ Voice reply failed, falling back to text:`, voiceSendResult.error);
                    // Fall back to text reply (will happen below)
                }
            }
        } catch (voiceError) {
            console.error(`❌ Voice processing error, falling back to text:`, voiceError);
            // Continue with text reply (will happen below)
        }

        // 6. Send the response via WhatsApp (text or voice already handled above)
        let sendResult;
        if (voiceReplySent) {
            // Voice was already sent, just return success
            sendResult = { success: true };
        } else {
            // Send text reply (normal flow or fallback from voice failure)
            sendResult = await sendWhatsAppMessage(fromNumber, response, auth_token, origin);
        }

        if (!sendResult.success) {
            console.error("Failed to send WhatsApp message:", sendResult.error);
            // Still mark as attempted in database
            await supabase
                .from("whatsapp_messages")
                .update({
                    auto_respond_sent: false,
                    response_sent_at: new Date().toISOString(),
                })
                .eq("message_id", messageId);

            return {
                success: false,
                response,
                sent: false,
                error: `Generated response but failed to send: ${sendResult.error}`,
            };
        }

        // 6.5. Store the AI response in the database for conversation history
        const responseMessageId = `auto_${messageId}_${Date.now()}`;
        const contentType = voiceReplySent ? "audio" : "text";
        const contentData = voiceReplySent
            ? { contentType: "audio", audioUrl: voiceReplyUrl, text: response }
            : { contentType: "text", text: response };

        await supabase
            .from("whatsapp_messages")
            .insert([
                {
                    message_id: responseMessageId,
                    channel: "whatsapp",
                    from_number: toNumber, // Business number (sender)
                    to_number: fromNumber, // Customer number (recipient)
                    received_at: new Date().toISOString(),
                    content_type: contentType,
                    content_text: response, // Always store text for reference
                    content_audio_url: voiceReplySent ? voiceReplyUrl : null,
                    sender_name: "AI Assistant",
                    event_type: "MtMessage", // Mobile Terminated (outgoing)
                    is_in_24_window: true,
                    is_responded: false,
                    raw_payload: {
                        messageId: responseMessageId,
                        channel: "whatsapp",
                        from: toNumber,
                        to: fromNumber,
                        content: contentData,
                        event: "MtMessage",
                        isAutoResponse: true,
                        voiceReply: voiceReplySent,
                    },
                },
            ]);

        // 7. Mark the message as responded in database
        await supabase
            .from("whatsapp_messages")
            .update({
                auto_respond_sent: true,
                response_sent_at: new Date().toISOString(),
            })
            .eq("message_id", messageId);

        console.log(`✅ Auto-response sent successfully to ${fromNumber}`);

        return {
            success: true,
            response,
            sent: true,
        };
    } catch (error) {
        console.error("Auto-response error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
