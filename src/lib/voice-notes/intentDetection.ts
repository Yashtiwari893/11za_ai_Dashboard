import { supabase } from '@/lib/supabaseClient';
import { embedText } from '@/lib/embeddings';

export interface IntentResult {
    success: boolean;
    error?: string;
    intent?: string;
    confidence?: number;
    category?: string;
    entities?: Record<string, any>;
    knowledge?: KnowledgeItem[];
}

export interface KnowledgeItem {
    type: 'pdf_chunk' | 'shopify_product' | 'voice_pattern' | 'faq';
    content: string;
    sourceId: string;
    relevanceScore: number;
    metadata?: Record<string, any>;
}

/**
 * Detect intent from transcript and retrieve relevant knowledge
 */
export async function detectIntentAndRetrieveKnowledge(
    transcript: string,
    language: string,
    voiceMessageId: string,
    businessNumber: string
): Promise<IntentResult> {
    try {
        console.log(`🧠 Detecting intent for: "${transcript}"`);

        // Generate embedding for the transcript
        const queryEmbedding = await embedText(transcript);

        // Detect intent using multiple methods
        const intentAnalysis = await analyzeIntent(transcript, language);

        // Retrieve relevant knowledge
        const knowledge = await retrieveRelevantKnowledge(
            queryEmbedding,
            transcript,
            intentAnalysis.intent,
            businessNumber,
            voiceMessageId
        );

        console.log(`🎯 Detected intent: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
        console.log(`📚 Retrieved ${knowledge.length} knowledge items`);

        return {
            success: true,
            intent: intentAnalysis.intent,
            confidence: intentAnalysis.confidence,
            category: intentAnalysis.category,
            entities: intentAnalysis.entities,
            knowledge
        };

    } catch (error) {
        console.error('❌ Intent detection failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Analyze intent from transcript using multiple approaches
 */
async function analyzeIntent(transcript: string, language: string): Promise<{
    intent: string;
    confidence: number;
    category: string;
    entities: Record<string, any>;
}> {
    const lowerTranscript = transcript.toLowerCase();

    // Rule-based intent detection
    const ruleBased = detectIntentByRules(lowerTranscript, language);

    // Voice Brain pattern matching
    const voiceBrainMatch = await matchVoiceBrainPatterns(lowerTranscript, language);

    // Combine results (weighted average)
    const combinedIntent = ruleBased.confidence > voiceBrainMatch.confidence ?
        ruleBased : voiceBrainMatch;

    return combinedIntent;
}

/**
 * Rule-based intent detection
 */
function detectIntentByRules(transcript: string, language: string): {
    intent: string;
    confidence: number;
    category: string;
    entities: Record<string, any>;
} {
    const patterns = {
        // Hindi patterns
        hi: {
            greeting: ['नमस्ते', 'हेलो', 'हाय', 'गुड मोर्निंग', 'गुड इवनिंग', 'प्रणाम'],
            question: ['क्या', 'कैसे', 'कब', 'कहाँ', 'क्यों', 'कौन'],
            complaint: ['समस्या', 'गलत', 'बुरा', 'शिकायत', 'परेशान'],
            order: ['चाहिए', 'मिल सकता', 'खरीदना', 'ऑर्डर', 'बुक'],
            thanks: ['धन्यवाद', 'थैंक्यू', 'शुक्रिया'],
            help: ['मदद', 'सहायता', 'समझ नहीं', 'कन्फ्यूज']
        },
        // English patterns
        en: {
            greeting: ['hello', 'hi', 'hey', 'good morning', 'good evening'],
            question: ['what', 'how', 'when', 'where', 'why', 'who', 'can you'],
            complaint: ['problem', 'wrong', 'bad', 'complaint', 'issue'],
            order: ['want', 'need', 'buy', 'order', 'book', 'purchase'],
            thanks: ['thank you', 'thanks', 'appreciate'],
            help: ['help', 'assist', 'confused', 'don\'t understand']
        }
    };

    const langPatterns = patterns[language as keyof typeof patterns] || patterns.hi;
    let bestMatch = { intent: 'general_inquiry', confidence: 0.3, category: 'informational', entities: {} };

    for (const [intent, keywords] of Object.entries(langPatterns)) {
        const matches = keywords.filter(keyword => transcript.includes(keyword)).length;
        const confidence = Math.min(matches / keywords.length, 1.0);

        if (confidence > bestMatch.confidence) {
            bestMatch = {
                intent,
                confidence,
                category: getIntentCategory(intent),
                entities: extractEntities(transcript, intent, language)
            };
        }
    }

    return bestMatch;
}

/**
 * Match against Voice Brain patterns
 */
async function matchVoiceBrainPatterns(transcript: string, language: string): Promise<{
    intent: string;
    confidence: number;
    category: string;
    entities: Record<string, any>;
}> {
    try {
        // Query voice brain patterns
        const { data: patterns, error } = await supabase
            .rpc('match_voice_questions', {
                query_embedding: await embedText(transcript),
                match_threshold: 0.7,
                match_count: 5
            });

        if (error || !patterns || patterns.length === 0) {
            return { intent: 'general_inquiry', confidence: 0.2, category: 'informational', entities: {} };
        }

        // Use the best matching pattern
        const bestMatch = patterns[0];
        return {
            intent: bestMatch.intent || 'general_inquiry',
            confidence: bestMatch.similarity,
            category: getIntentCategory(bestMatch.intent),
            entities: {}
        };

    } catch (error) {
        console.error('Voice Brain pattern matching failed:', error);
        return { intent: 'general_inquiry', confidence: 0.1, category: 'informational', entities: {} };
    }
}

/**
 * Get intent category
 */
function getIntentCategory(intent: string): string {
    const categories: Record<string, string> = {
        greeting: 'social',
        question: 'informational',
        complaint: 'emotional',
        order: 'transactional',
        thanks: 'social',
        help: 'support'
    };

    return categories[intent] || 'informational';
}

/**
 * Extract entities from transcript
 */
function extractEntities(transcript: string, intent: string, language: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Simple entity extraction - could be enhanced with NLP models
    if (intent === 'order') {
        // Look for product names, quantities, etc.
        // This is a placeholder - real implementation would use NER
    }

    return entities;
}

/**
 * Retrieve relevant knowledge based on intent and query
 */
async function retrieveRelevantKnowledge(
    queryEmbedding: number[],
    transcript: string,
    intent: string,
    businessNumber: string,
    voiceMessageId: string
): Promise<KnowledgeItem[]> {
    const knowledge: KnowledgeItem[] = [];

    try {
        // 1. Retrieve PDF chunks
        const pdfChunks = await retrievePDFChunks(queryEmbedding, businessNumber);
        knowledge.push(...pdfChunks);

        // 2. Retrieve Shopify products
        const products = await retrieveShopifyProducts(queryEmbedding, transcript, businessNumber);
        knowledge.push(...products);

        // 3. Retrieve Voice FAQ patterns
        const voicePatterns = await retrieveVoicePatterns(queryEmbedding, intent);
        knowledge.push(...voicePatterns);

        // Store knowledge retrieval in database
        await storeKnowledgeRetrieval(voiceMessageId, knowledge);

        // Return top 5 most relevant items
        return knowledge
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5);

    } catch (error) {
        console.error('Knowledge retrieval failed:', error);
        return [];
    }
}

/**
 * Retrieve relevant PDF chunks
 */
async function retrievePDFChunks(queryEmbedding: number[], businessNumber: string): Promise<KnowledgeItem[]> {
    try {
        const { data: files } = await supabase
            .from('phone_mappings')
            .select('file_ids')
            .eq('phone_number', businessNumber)
            .single();

        if (!files?.file_ids || files.file_ids.length === 0) {
            return [];
        }

        const { data: chunks, error } = await supabase
            .rpc('match_rag_chunks', {
                query_embedding: queryEmbedding,
                match_threshold: 0.7,
                match_count: 3,
                file_ids: files.file_ids
            });

        if (error || !chunks) return [];

        return chunks.map((chunk: any) => ({
            type: 'pdf_chunk' as const,
            content: chunk.chunk,
            sourceId: chunk.file_id,
            relevanceScore: chunk.similarity,
            metadata: { pdfName: chunk.pdf_name }
        }));

    } catch (error) {
        console.error('PDF chunk retrieval failed:', error);
        return [];
    }
}

/**
 * Retrieve relevant Shopify products
 */
async function retrieveShopifyProducts(
    queryEmbedding: number[],
    transcript: string,
    businessNumber: string
): Promise<KnowledgeItem[]> {
    try {
        // Check if business has Shopify integration
        const { data: shopifyStore } = await supabase
            .from('phone_mappings')
            .select('shopify_store_id')
            .eq('phone_number', businessNumber)
            .single();

        if (!shopifyStore?.shopify_store_id) {
            return [];
        }

        // Search products by embedding similarity
        const { data: products, error } = await supabase
            .rpc('match_shopify_chunks', {
                query_embedding: queryEmbedding,
                match_threshold: 0.6,
                match_count: 2,
                store_id: shopifyStore.shopify_store_id
            });

        if (error || !products) return [];

        return products.map((product: any) => ({
            type: 'shopify_product' as const,
            content: product.chunk,
            sourceId: product.product_id,
            relevanceScore: product.similarity,
            metadata: { productTitle: product.product_title }
        }));

    } catch (error) {
        console.error('Shopify product retrieval failed:', error);
        return [];
    }
}

/**
 * Retrieve relevant voice patterns
 */
async function retrieveVoicePatterns(queryEmbedding: number[], intent: string): Promise<KnowledgeItem[]> {
    try {
        const { data: patterns, error } = await supabase
            .rpc('match_voice_questions', {
                query_embedding: queryEmbedding,
                match_threshold: 0.7,
                match_count: 3
            });

        if (error || !patterns) return [];

        return patterns.map((pattern: any) => ({
            type: 'voice_pattern' as const,
            content: pattern.chunk,
            sourceId: pattern.id.toString(),
            relevanceScore: pattern.similarity,
            metadata: { intent: pattern.intent, style: pattern.style }
        }));

    } catch (error) {
        console.error('Voice pattern retrieval failed:', error);
        return [];
    }
}

/**
 * Store knowledge retrieval for analytics
 */
async function storeKnowledgeRetrieval(voiceMessageId: string, knowledge: KnowledgeItem[]): Promise<void> {
    try {
        const retrievalRecords = knowledge.map(item => ({
            voice_message_id: voiceMessageId,
            knowledge_type: item.type,
            source_id: item.sourceId,
            content: item.content,
            relevance_score: item.relevanceScore
        }));

        await supabase
            .from('voice_knowledge_retrieval')
            .insert(retrievalRecords);

    } catch (error) {
        console.error('Failed to store knowledge retrieval:', error);
        // Don't throw - not critical
    }
}