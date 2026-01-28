-- Optional: Create RPC function for optimized dual-source retrieval
-- This allows efficient querying of both PDF and approved call chunks in a single database call

CREATE OR REPLACE FUNCTION match_documents_with_calls(
    query_embedding vector(1024),
    match_count int DEFAULT 10,
    target_phone text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    chunk_text text,
    similarity float,
    source_type text,
    source_id uuid,
    file_id uuid
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rc.id,
        rc.chunk_text,
        (1 - (rc.embedding <=> query_embedding)) as similarity,
        rc.source_type,
        rc.source_id,
        rc.file_id
    FROM rag_chunks rc
    WHERE
        -- Include all PDF chunks (file_id not null)
        (rc.source_type = 'pdf' AND rc.file_id IS NOT NULL)
        OR
        -- OR include call chunks only if they're from approved calls for this phone
        (rc.source_type = 'call' AND rc.source_id IS NOT NULL AND 
         EXISTS (
            SELECT 1 FROM call_recordings cr
            WHERE cr.id = rc.source_id
            AND cr.status = '11za_related'
            AND (target_phone IS NULL OR cr.phone_number = target_phone)
         ))
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance on the new RPC function
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
