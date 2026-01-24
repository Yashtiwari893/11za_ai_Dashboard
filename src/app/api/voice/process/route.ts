import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Logger } from '@/lib/monitoring/logger'
import { chunkText } from '@/lib/chunk'
import { embedText } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  const requestId = Logger.createRequestId()
  Logger.info('Voice processing started', { request_id: requestId })

  try {
    const supabase = await createClient()
    const { faq_id, recording_id } = await request.json()

    if (!faq_id && !recording_id) {
      Logger.warn('Missing faq_id or recording_id', { request_id: requestId })
      return NextResponse.json(
        { error: 'Missing faq_id or recording_id' },
        { status: 400 }
      )
    }

    let recordings: any[] = []

    // Fetch recordings based on input
    if (recording_id) {
      // Process single recording
      const { data: recording, error } = await supabase
        .from('voice_recordings')
        .select('*, voice_faqs(*)')
        .eq('id', recording_id)
        .eq('transcription_status', 'completed')
        .single()

      if (error || !recording) {
        Logger.error('Recording not found or not ready', {
          request_id: requestId,
          recording_id,
          error: error?.message
        })
        return NextResponse.json(
          { error: 'Recording not found or transcription not completed' },
          { status: 404 }
        )
      }

      recordings = [recording]
    } else {
      // Process all recordings for the FAQ
      const { data: faqRecordings, error } = await supabase
        .from('voice_recordings')
        .select('*, voice_faqs(*)')
        .eq('faq_id', faq_id)
        .eq('transcription_status', 'completed')

      if (error) {
        Logger.error('Failed to fetch FAQ recordings', {
          request_id: requestId,
          faq_id,
          error: error.message
        })
        return NextResponse.json(
          { error: 'Failed to fetch recordings' },
          { status: 500 }
        )
      }

      recordings = faqRecordings || []
    }

    if (recordings.length === 0) {
      Logger.warn('No completed recordings found', {
        request_id: requestId,
        faq_id,
        recording_id
      })
      return NextResponse.json(
        { error: 'No completed recordings found for processing' },
        { status: 404 }
      )
    }

    let totalChunks = 0
    const processedRecordings = []

    // Process each recording
    for (const recording of recordings) {
      try {
        Logger.info('Processing recording', {
          request_id: requestId,
          recording_id: recording.id,
          transcript_length: recording.transcript_clean?.length || 0
        })

        // Skip if no cleaned transcript
        if (!recording.transcript_clean) {
          Logger.warn('No cleaned transcript for recording', {
            request_id: requestId,
            recording_id: recording.id
          })
          continue
        }

        // Check if chunks already exist for this recording
        const { data: existingChunks } = await supabase
          .from('voice_chunks')
          .select('id')
          .eq('recording_id', recording.id)
          .limit(1)

        if (existingChunks && existingChunks.length > 0) {
          Logger.info('Chunks already exist for recording, skipping', {
            request_id: requestId,
            recording_id: recording.id
          })
          continue
        }

        // Chunk the cleaned transcript
        const chunks = chunkText(recording.transcript_clean, 1600, 200)

        Logger.info('Transcript chunked', {
          request_id: requestId,
          recording_id: recording.id,
          chunks_count: chunks.length
        })

        // Process chunks in batches to avoid overwhelming the embedding API
        const batchSize = 5
        const chunkInserts = []

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize)

          for (const chunkText of batch) {
            try {
              // Generate embedding for chunk
              const embedding = await embedText(chunkText)

              // Prepare metadata
              const metadata: Record<string, any> = {
                source: 'voice_faq',
                title: recording.voice_faqs?.title || 'Voice FAQ',
                duration: recording.duration_seconds,
                confidence: recording.transcription_confidence,
                original_audio_url: recording.audio_url,
                chunk_index: chunkInserts.length,
                total_chunks: chunks.length
              }

              chunkInserts.push({
                faq_id: recording.faq_id,
                recording_id: recording.id,
                chunk_text: chunkText,
                embedding: `[${embedding.join(',')}]`, // Convert to PostgreSQL vector format
                language: recording.voice_faqs?.language || recording.detected_language || 'en',
                metadata
              })

            } catch (embedError) {
              Logger.error('Failed to embed chunk', {
                request_id: requestId,
                recording_id: recording.id,
                chunk_index: chunkInserts.length,
                error: embedError instanceof Error ? embedError.message : 'Unknown error'
              })
              // Continue with other chunks
            }
          }

          // Small delay between batches to be respectful to the API
          if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }

        // Insert chunks in batch
        if (chunkInserts.length > 0) {
          const { error: insertError } = await supabase
            .from('voice_chunks')
            .insert(chunkInserts)

          if (insertError) {
            Logger.error('Failed to insert chunks', {
              request_id: requestId,
              recording_id: recording.id,
              chunks_count: chunkInserts.length,
              error: insertError.message
            })
            throw insertError
          }

          totalChunks += chunkInserts.length

          Logger.info('Chunks inserted successfully', {
            request_id: requestId,
            recording_id: recording.id,
            chunks_inserted: chunkInserts.length
          })
        }

        processedRecordings.push({
          recording_id: recording.id,
          chunks_created: chunkInserts.length
        })

      } catch (recordingError) {
        Logger.error('Failed to process recording', {
          request_id: requestId,
          recording_id: recording.id,
          error: recordingError instanceof Error ? recordingError.message : 'Unknown error'
        })
        // Continue with other recordings
      }
    }

    Logger.info('Voice processing completed', {
      request_id: requestId,
      recordings_processed: processedRecordings.length,
      total_chunks: totalChunks
    })

    return NextResponse.json({
      success: true,
      recordings_processed: processedRecordings.length,
      total_chunks: totalChunks,
      processed_recordings: processedRecordings
    })

  } catch (error) {
    Logger.error('Voice processing failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}