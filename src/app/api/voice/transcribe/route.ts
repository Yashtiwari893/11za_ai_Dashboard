import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Logger } from '@/lib/monitoring/logger'
import { VoiceTranscriber } from '@/lib/voice/transcriber'
import { TranscriptCleaner } from '@/lib/voice/cleaner'

export async function POST(request: NextRequest) {
  const requestId = Logger.createRequestId()
  Logger.info('Voice transcription started', { request_id: requestId })

  try {
    const supabase = await createClient()
    const { recording_id } = await request.json()

    if (!recording_id) {
      Logger.warn('Missing recording_id', { request_id: requestId })
      return NextResponse.json(
        { error: 'Missing recording_id' },
        { status: 400 }
      )
    }

    // Fetch recording details
    const { data: recording, error: fetchError } = await supabase
      .from('voice_recordings')
      .select('*, voice_faqs(*)')
      .eq('id', recording_id)
      .single()

    if (fetchError || !recording) {
      Logger.error('Recording not found', {
        request_id: requestId,
        recording_id,
        error: fetchError?.message
      })
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }

    // Update status to processing
    await supabase
      .from('voice_recordings')
      .update({
        transcription_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', recording_id)

    try {
      // Transcribe audio
      const transcriptionResult = await VoiceTranscriber.transcribe(recording.audio_url)

      // Clean transcript
      const cleanedTranscript = TranscriptCleaner.clean(transcriptionResult.text)

      // Update recording with results
      const { error: updateError } = await supabase
        .from('voice_recordings')
        .update({
          transcript_raw: transcriptionResult.text,
          transcript_clean: cleanedTranscript,
          transcription_status: 'completed',
          transcription_provider: transcriptionResult.provider,
          transcription_confidence: transcriptionResult.confidence,
          detected_language: transcriptionResult.detectedLanguage,
          updated_at: new Date().toISOString()
        })
        .eq('id', recording_id)

      if (updateError) {
        Logger.error('Failed to update recording', {
          request_id: requestId,
          recording_id,
          error: updateError.message
        })
        throw updateError
      }

      Logger.info('Voice transcription completed', {
        request_id: requestId,
        recording_id,
        provider: transcriptionResult.provider,
        confidence: transcriptionResult.confidence
      })

      return NextResponse.json({
        success: true,
        recording_id,
        transcript_raw: transcriptionResult.text,
        transcript_clean: cleanedTranscript,
        confidence: transcriptionResult.confidence,
        detected_language: transcriptionResult.detectedLanguage
      })

    } catch (transcriptionError) {
      // Update status to failed
      await supabase
        .from('voice_recordings')
        .update({
          transcription_status: 'failed',
          transcription_error: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', recording_id)

      Logger.error('Transcription failed', {
        request_id: requestId,
        recording_id,
        error: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'
      })

      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 500 }
      )
    }

  } catch (error) {
    Logger.error('Voice transcription request failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}