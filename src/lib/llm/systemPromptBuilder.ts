// STEP-5.1: System Prompt Builder

import { ChatbotConfig } from '../retrieval/types'

export interface PromptContext {
  chatbot: ChatbotConfig
  channel: 'whatsapp' | 'web' | 'voice'
  userLanguage?: string
  hasContext: boolean
}

export class SystemPromptBuilder {
  static build(context: PromptContext): string {
    const { chatbot, channel, userLanguage, hasContext } = context

    let prompt = ''

    // Base personality from chatbot config
    if (chatbot.system_prompt) {
      prompt += chatbot.system_prompt + '\n\n'
    }

    // Channel-specific instructions
    switch (channel) {
      case 'whatsapp':
        prompt += 'You are responding in WhatsApp. Keep responses concise, friendly, and under 300 characters when possible. Use emojis sparingly and appropriately.\n\n'
        break
      case 'web':
        prompt += 'You are responding in a web chat interface. Provide helpful, detailed responses while remaining conversational.\n\n'
        break
      case 'voice':
        prompt += 'You are responding in a voice interface. Keep responses natural and conversational, suitable for speech synthesis.\n\n'
        break
    }

    // Language handling
    if (userLanguage && userLanguage !== 'en') {
      const langName = this.getLanguageName(userLanguage);
      prompt += 'Respond in ' + langName + '. Match the user\'s language exactly.\n\n';
    }

    // Context availability
    if (hasContext) {
      prompt += 'Use the provided context to answer accurately. If the context doesn\'t contain relevant information, politely say you don\'t have that information.\n\n';
    } else {
      prompt += 'You don\'t have specific context for this query. Provide a general helpful response or ask for clarification.\n\n';
    }

    // General rules
    prompt += 'Rules:\n';
    prompt += '- Never mention that you are an AI or bot\n';
    prompt += '- Be helpful, accurate, and professional\n';
    prompt += '- If unsure, ask for clarification\n';
    prompt += '- Keep responses focused and relevant\n';

    return prompt.trim();
  }

  private static getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi',
      // Add more as needed
    };
    return languages[code] || code;
  }
}