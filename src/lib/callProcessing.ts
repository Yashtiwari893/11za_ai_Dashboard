import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY!,
});

/**
 * Transcribe audio using Groq Whisper API
 */
export async function transcribeAudio(audioBuffer: Buffer, fileName: string): Promise<string> {
    try {
        // Create a File object from the buffer for Groq API
        const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' });
        const file = new File([blob], fileName, { type: 'audio/mpeg' });
        
        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: "whisper-large-v3-turbo",
            language: "en",
        });

        return transcription.text || "";
    } catch (error) {
        console.error("Transcription error:", error);
        throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

/**
 * Detect if transcript is essentially blank (too short or empty)
 */
export function detectBlank(transcript: string, minLength = 50): boolean {
    const trimmed = transcript.trim();
    return trimmed.length < minLength;
}

/**
 * Classify if transcript is spam using LLM
 */
export async function classifySpam(transcript: string): Promise<{ isSpam: boolean; confidence: number }> {
    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a spam detector. Analyze the given transcript and determine if it's spam/marketing/junk content.
                    
Respond ONLY with a JSON object in this format (no other text):
{"is_spam": boolean, "confidence": number}

Where:
- is_spam: true if this is spam/junk/marketing, false otherwise
- confidence: 0-1 confidence score`
                },
                {
                    role: "user",
                    content: `Analyze this transcript:\n\n${transcript}`
                }
            ],
            temperature: 0.1,
            max_tokens: 50
        });

        const content = response.choices[0]?.message?.content || '{"is_spam": false, "confidence": 0}';
        const result = JSON.parse(content);
        return {
            isSpam: result.is_spam,
            confidence: Math.min(1, Math.max(0, result.confidence))
        };
    } catch (error) {
        console.error("Spam classification error:", error);
        return { isSpam: false, confidence: 0 };
    }
}

/**
 * Classify if transcript is related to 11za (relevance classification)
 */
export async function classify11zaRelevance(transcript: string): Promise<{ isRelated: boolean; confidence: number }> {
    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a relevance classifier. Determine if the given transcript is related to 11za business/services/context.

11za is a platform for business services, customer engagement, and communications. Content is relevant if it discusses:
- 11za services or features
- Customer inquiries related to business/communications
- General business conversations that could be business-relevant
- Support queries about digital services

Respond ONLY with a JSON object in this format (no other text):
{"is_related": boolean, "confidence": number}

Where:
- is_related: true if this is 11za-relevant, false otherwise
- confidence: 0-1 confidence score`
                },
                {
                    role: "user",
                    content: `Analyze this transcript:\n\n${transcript}`
                }
            ],
            temperature: 0.1,
            max_tokens: 50
        });

        const content = response.choices[0]?.message?.content || '{"is_related": false, "confidence": 0}';
        const result = JSON.parse(content);
        return {
            isRelated: result.is_related,
            confidence: Math.min(1, Math.max(0, result.confidence))
        };
    } catch (error) {
        console.error("11za relevance classification error:", error);
        return { isRelated: false, confidence: 0 };
    }
}
