import { supabase } from "@/lib/supabaseClient";

export async function retrieveRelevantChunks(
    queryEmbedding: number[],
    fileId?: string,
    limit = 5
) {
    const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_count: limit,
        target_file: fileId ?? null,
    });

    if (error) {
        console.error("VECTOR SEARCH ERROR:", error);
        throw error;
    }

    return data as { id: string; chunk: string; similarity: number }[];
}

/**
 * Retrieve relevant chunks from multiple files (for phone number mappings)
 */
export async function retrieveRelevantChunksFromFiles(
    queryEmbedding: number[],
    fileIds: string[],
    limit = 5
) {
    if (fileIds.length === 0) {
        return [];
    }

    if (fileIds.length === 1) {
        return retrieveRelevantChunks(queryEmbedding, fileIds[0], limit);
    }

    // For multiple files, we need to search across all of them
    // We'll get results from each file and then merge them
    const allChunks: { id: string; chunk: string; similarity: number; file_id: string }[] = [];

    for (const fileId of fileIds) {
        const chunks = await retrieveRelevantChunks(queryEmbedding, fileId, limit);
        allChunks.push(...chunks.map(c => ({ ...c, file_id: fileId })));
    }

    // Sort by similarity and return top N
    return allChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}

/**
 * Retrieve relevant Shopify chunks for a store
 */
export async function retrieveRelevantShopifyChunks(
    queryEmbedding: number[],
    storeId: string,
    limit = 5
) {
    const { data, error } = await supabase.rpc("match_shopify_chunks", {
        query_embedding: queryEmbedding,
        store_id_param: storeId,
        match_count: limit,
    });

    if (error) {
        console.error("SHOPIFY VECTOR SEARCH ERROR:", error);
        throw error;
    }

    return data?.map((row: any) => ({
        id: row.id,
        chunk: row.chunk_text,
        similarity: row.similarity,
        store_id: row.store_id,
        content_type: row.content_type,
        title: row.title,
        metadata: row.metadata
    })) || [];
}

/**
 * Retrieve relevant voice chunks for FAQ collections
 */
export async function retrieveRelevantVoiceChunks(
    queryEmbedding: number[],
    faqIds: string[],
    limit = 5
) {
    if (faqIds.length === 0) {
        return [];
    }

    const { data, error } = await supabase.rpc("match_voice_chunks", {
        query_embedding: queryEmbedding,
        faq_ids: faqIds,
        match_count: limit,
    });

    if (error) {
        console.error("VOICE VECTOR SEARCH ERROR:", error);
        throw error;
    }

    return data?.map((row: any) => ({
        id: row.id,
        chunk: row.chunk_text,
        similarity: row.similarity,
        faq_id: row.faq_id,
        recording_id: row.recording_id,
        language: row.language,
        metadata: row.metadata,
        source_type: 'voice_faq'
    })) || [];
}

/**
 * Retrieve relevant chunks from BOTH PDF and approved call recordings
 * Only includes call chunks that are marked as 11za_related (approved)
 */
export async function retrieveRelevantChunksDualSource(
    queryEmbedding: number[],
    phoneNumber?: string,
    limit = 10
) {
    try {
        // Query both PDF chunks and approved call chunks
        const { data, error } = await supabase.rpc("match_documents_with_calls", {
            query_embedding: queryEmbedding,
            match_count: limit,
            target_phone: phoneNumber ?? null,
        });

        if (error) {
            // Fallback: if RPC doesn't exist, manually query
            console.warn("Fallback to manual dual-source retrieval");
            return await fallbackDualSourceRetrieval(queryEmbedding, phoneNumber, limit);
        }

        return data as { id: string; chunk: string; similarity: number; source_type: string; source_id: string }[];
    } catch (err) {
        console.error("Dual source retrieval error, using fallback:", err);
        return await fallbackDualSourceRetrieval(queryEmbedding, phoneNumber, limit);
    }
}

/**
 * Fallback dual-source retrieval if RPC not available
 */
async function fallbackDualSourceRetrieval(
    queryEmbedding: number[],
    phoneNumber?: string,
    limit = 10
) {
    try {
        // Query both PDF and call chunks
        let query = supabase
            .from("rag_chunks")
            .select("id, chunk_text, embedding, source_type, source_id, file_id")
            .filter("embedding", "cd", `[${queryEmbedding.join(",")}]`);

        // If phone number provided, only get chunks from approved calls for that phone
        if (phoneNumber) {
            const { data: approvedCalls } = await supabase
                .from("call_recordings")
                .select("id")
                .eq("phone_number", phoneNumber)
                .eq("status", "11za_related");

            const callIds = approvedCalls?.map((c: any) => c.id) || [];

            // Get both PDF and call chunks
            query = query.or(
                `source_type.eq.pdf,and(source_type.eq.call,source_id.in.(${callIds.join(",")}))`
            );
        }

        const { data: allChunks } = await query;

        if (!allChunks || allChunks.length === 0) {
            return [];
        }

        // Calculate similarity scores manually and sort
        const chunksWithSimilarity = allChunks
            .filter((chunk: any) => chunk.embedding && Array.isArray(chunk.embedding))
            .map((chunk: any) => {
                const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
                return {
                    id: chunk.id,
                    chunk: chunk.chunk_text,
                    similarity,
                    source_type: chunk.source_type,
                    source_id: chunk.source_id
                };
            })
            .sort((a: any, b: any) => b.similarity - a.similarity)
            .slice(0, limit);

        return chunksWithSimilarity;
    } catch (error) {
        console.error("Fallback dual-source retrieval error:", error);
        return [];
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
}
