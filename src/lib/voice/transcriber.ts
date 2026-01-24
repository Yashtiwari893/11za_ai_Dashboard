import { Logger } from '@/lib/monitoring/logger'

export interface TranscriptionResult {
  text: string
  confidence: number
  detectedLanguage?: string
  provider: string
  duration?: number
  timestamps?: Array<{
    start: number
    end: number
    text: string
  }>
}

export interface TranscriptionProvider {
  name: string
  transcribe(audioUrl: string, options?: any): Promise<TranscriptionResult>
  isAvailable(): boolean
}

export class VoiceTranscriber {
  private static providers: Map<string, TranscriptionProvider> = new Map()

  static registerProvider(provider: TranscriptionProvider) {
    this.providers.set(provider.name, provider)
    Logger.info(`Transcription provider registered: ${provider.name}`)
  }

  static async transcribe(audioUrl: string, preferredProvider?: string): Promise<TranscriptionResult> {
    const requestId = Logger.createRequestId()
    Logger.info('Starting transcription', { request_id: requestId, audio_url: audioUrl })

    // Find available provider
    let provider: TranscriptionProvider | undefined

    if (preferredProvider && this.providers.has(preferredProvider)) {
      provider = this.providers.get(preferredProvider)
      if (!provider?.isAvailable()) {
        Logger.warn(`Preferred provider ${preferredProvider} not available`, { request_id: requestId })
        provider = undefined
      }
    }

    // Fallback to any available provider
    if (!provider) {
      for (const [name, p] of this.providers) {
        if (p.isAvailable()) {
          provider = p
          Logger.info(`Using provider: ${name}`, { request_id: requestId })
          break
        }
      }
    }

    if (!provider) {
      Logger.error('No transcription providers available', { request_id: requestId })
      throw new Error('No transcription providers available')
    }

    try {
      const result = await provider.transcribe(audioUrl)
      Logger.info('Transcription completed', {
        request_id: requestId,
        provider: provider.name,
        confidence: result.confidence,
        text_length: result.text.length
      })
      return result
    } catch (error) {
      Logger.error('Transcription failed', {
        request_id: requestId,
        provider: provider.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}

// Mock provider for development/testing
class MockTranscriptionProvider implements TranscriptionProvider {
  name = 'mock'

  isAvailable(): boolean {
    return process.env.NODE_ENV === 'development'
  }

  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))

    return {
      text: 'This is a mock transcription of the audio file. In a real implementation, this would contain the actual transcribed text from the audio.',
      confidence: 0.95,
      detectedLanguage: 'en',
      provider: 'mock',
      duration: 10.5
    }
  }
}

// Register mock provider for development
VoiceTranscriber.registerProvider(new MockTranscriptionProvider())