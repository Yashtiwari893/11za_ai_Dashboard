// STEP-4.1: Unified Retrieval Interface and Types

export interface UnifiedChunk {
  source_type: 'file' | 'shopify' | 'voice_faq'
  source_id: string // e.g., file_id, store_id, collection_id
  chunk_text: string
  similarity: number
  metadata: {
    chunk_id: string
    title?: string
    url?: string
    page_number?: number
    collection_name?: string
    recording_id?: string
    [key: string]: any
  }
}

export interface RetrievalQuery {
  chatbot_id: string
  query: string
  channel?: 'whatsapp' | 'web' | 'voice'
  limit?: number
  debug?: boolean
}

export interface RetrievalResult {
  context: UnifiedChunk[]
  debug?: {
    sources_used: string[]
    total_chunks: number
    latency_ms: number
    source_breakdown: {
      source_type: string
      chunks_found: number
      top_similarity: number
    }[]
  }
}

export interface SourceResolver {
  resolve(queryEmbedding: number[], chatbotId: string, limit?: number): Promise<UnifiedChunk[]>
  getSourceType(): string
}

export interface ChatbotConfig {
  id: string
  name: string
  system_prompt?: string
  data_sources: {
    type: 'file' | 'shopify' | 'voice_faq'
    reference_id: string
  }[]
}