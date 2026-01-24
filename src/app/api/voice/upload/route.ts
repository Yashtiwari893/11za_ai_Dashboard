import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Logger } from '@/lib/monitoring/logger'
import { createClient as createStorageClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const requestId = Logger.createRequestId()
  Logger.info('Voice upload started', { request_id: requestId })

  try {
    const supabase = await createClient()
    const storageClient = createStorageClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const tenantId = formData.get('tenant_id') as string
    const faqTitle = formData.get('faq_title') as string
    const language = formData.get('language') as string || 'en'

    // Validate inputs
    if (!audioFile || !tenantId || !faqTitle) {
      Logger.warn('Missing required fields', { request_id: requestId })
      return NextResponse.json(
        { error: 'Missing required fields: audio, tenant_id, faq_title' },
        { status: 400 }
      )
    }

    // Validate audio file
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a']
    if (!allowedTypes.includes(audioFile.type)) {
      Logger.warn('Invalid audio file type', {
        request_id: requestId,
        file_type: audioFile.type
      })
      return NextResponse.json(
        { error: 'Invalid audio file type. Supported: WAV, MP3, M4A' },
        { status: 400 }
      )
    }

    if (audioFile.size > 50 * 1024 * 1024) { // 50MB limit
      Logger.warn('Audio file too large', {
        request_id: requestId,
        file_size: audioFile.size
      })
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size: 50MB' },
        { status: 400 }
      )
    }

    // Create voice_faq entry
    const { data: faqData, error: faqError } = await supabase
      .from('voice_faqs')
      .insert({
        tenant_id: tenantId,
        title: faqTitle,
        language: language,
        source: 'upload'
      })
      .select()
      .single()

    if (faqError) {
      Logger.error('Failed to create voice_faq', {
        request_id: requestId,
        error: faqError.message
      })
      return NextResponse.json(
        { error: 'Failed to create FAQ collection' },
        { status: 500 }
      )
    }

    // Generate storage path
    const timestamp = Date.now()
    const fileExtension = audioFile.name.split('.').pop() || 'wav'
    const storagePath = `voice_recordings/${tenantId}/${faqData.id}/${timestamp}.${fileExtension}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from('voice_recordings')
      .upload(storagePath, audioFile, {
        contentType: audioFile.type,
        upsert: false
      })

    if (uploadError) {
      Logger.error('Failed to upload audio file', {
        request_id: requestId,
        error: uploadError.message
      })

      // Clean up the faq entry
      await supabase.from('voice_faqs').delete().eq('id', faqData.id)

      return NextResponse.json(
        { error: 'Failed to upload audio file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = storageClient.storage
      .from('voice_recordings')
      .getPublicUrl(storagePath)

    // Create voice_recording entry
    const { data: recordingData, error: recordingError } = await supabase
      .from('voice_recordings')
      .insert({
        faq_id: faqData.id,
        audio_url: urlData.publicUrl,
        file_size_bytes: audioFile.size,
        transcription_status: 'pending'
      })
      .select()
      .single()

    if (recordingError) {
      Logger.error('Failed to create voice_recording', {
        request_id: requestId,
        error: recordingError.message
      })

      // Clean up files
      await storageClient.storage.from('voice_recordings').remove([storagePath])
      await supabase.from('voice_faqs').delete().eq('id', faqData.id)

      return NextResponse.json(
        { error: 'Failed to create recording entry' },
        { status: 500 }
      )
    }

    Logger.info('Voice upload completed', {
      request_id: requestId,
      faq_id: faqData.id,
      recording_id: recordingData.id
    })

    return NextResponse.json({
      success: true,
      faq_id: faqData.id,
      recording_id: recordingData.id,
      audio_url: urlData.publicUrl
    })

  } catch (error) {
    Logger.error('Voice upload failed', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}