// STEP-6: Production Logger

export interface LogContext {
  request_id?: string
  chatbot_id?: string
  channel?: string
  user_id?: string
  latency_ms?: number
  [key: string]: any
}

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export class Logger {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  static createRequestId(): string {
    return this.generateRequestId()
  }

  private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    }
    return JSON.stringify(logEntry)
  }

  static info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context))
  }

  static warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context))
  }

  static error(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, context))
  }

  static critical(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.CRITICAL, message, context))
    // In production, this could trigger alerts
  }

  // Convenience methods for common events
  static logRetrievalStart(requestId: string, chatbotId: string, query: string): void {
    this.info('Retrieval started', { request_id: requestId, chatbot_id: chatbotId, query })
  }

  static logRetrievalEnd(requestId: string, chunksFound: number, latency: number): void {
    this.info('Retrieval completed', { request_id: requestId, chunks_found: chunksFound, latency_ms: latency })
  }

  static logLLMCall(requestId: string, tokensUsed?: number): void {
    this.info('LLM call completed', { request_id: requestId, tokens_used: tokensUsed })
  }

  static logLLMError(requestId: string, error: string): void {
    this.error('LLM call failed', { request_id: requestId, error })
  }

  static logGuardrailViolation(requestId: string, violation: string): void {
    this.warn('Guardrail violation', { request_id: requestId, violation })
  }

  static logFallbackTriggered(requestId: string, reason: string): void {
    this.warn('Fallback triggered', { request_id: requestId, reason })
  }
}