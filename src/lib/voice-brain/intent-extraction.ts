import { supabase } from '@/lib/supabaseClient';
import { embedText } from '@/lib/embeddings';

// Intent Extraction and Clustering Service
// Analyzes conversations to extract intents and response patterns

export interface ConversationAnalysis {
  callId: string;
  customerQuestions: string[];
  agentResponses: string[];
  intent: string;
  confidence: number;
  metadata: {
    language: string;
    tone: string;
    domain: string;
  };
}

export interface IntentCluster {
  intentName: string;
  domain: string;
  primaryExamples: string[];
  secondaryIntents: string[];
  tone: string;
  language: string;
  confidenceScore: number;
  sampleCount: number;
}

export interface ResponsePattern {
  intentId: string;
  responseStyle: string;
  avgResponseLength: number;
  commonPhrases: string[];
  emojiUsage: string[];
  language: string;
  sampleResponses: string[];
  effectivenessScore: number;
}

// Pre-defined intent patterns for Hindi/English conversations
const INTENT_PATTERNS = {
  price_inquiry: {
    keywords: ['price', 'cost', 'rate', 'kitna', 'kitne', 'daam', 'bhaw', 'mol'],
    domain: 'sales',
    tone: 'neutral'
  },
  availability_check: {
    keywords: ['available', 'stock', 'mil', 'milta', 'hai', 'nahi', 'available'],
    domain: 'sales',
    tone: 'neutral'
  },
  delivery_inquiry: {
    keywords: ['delivery', 'deliver', 'bhej', 'bhejne', 'time', 'kitne', 'din', 'when'],
    domain: 'logistics',
    tone: 'neutral'
  },
  return_exchange: {
    keywords: ['return', 'exchange', 'replace', 'badal', 'warranty', 'defect', 'fault'],
    domain: 'support',
    tone: 'frustrated'
  },
  complaint: {
    keywords: ['problem', 'issue', 'complaint', 'shikayat', 'galat', 'wrong', 'bad'],
    domain: 'support',
    tone: 'frustrated'
  },
  booking_reservation: {
    keywords: ['book', 'reserve', 'order', 'karna', 'chahta', 'want', 'need'],
    domain: 'sales',
    tone: 'urgent'
  },
  information_request: {
    keywords: ['tell', 'explain', 'about', 'kya', 'kaise', 'what', 'how', 'why'],
    domain: 'faq',
    tone: 'curious'
  },
  greeting: {
    keywords: ['hello', 'hi', 'namaste', 'good morning', 'good evening'],
    domain: 'general',
    tone: 'friendly'
  }
};

// Intent Extraction Service
export class IntentExtractor {
  async analyzeConversation(callId: string): Promise<ConversationAnalysis> {
    console.log(`Analyzing conversation for call ${callId}`);

    // Get conversation turns
    const { data: turns, error } = await supabase
      .from('voice_conversations')
      .select('*')
      .eq('call_id', callId)
      .order('sequence');

    if (error || !turns || turns.length === 0) {
      throw new Error(`Failed to fetch conversation turns: ${error?.message}`);
    }

    // Separate customer and agent turns
    const customerTurns = turns.filter(turn => turn.role === 'customer');
    const agentTurns = turns.filter(turn => turn.role === 'agent');

    const customerQuestions = customerTurns.map(turn => turn.text);
    const agentResponses = agentTurns.map(turn => turn.text);

    // Extract primary intent
    const intentAnalysis = this.extractIntent(customerQuestions);
    const toneAnalysis = this.analyzeTone(customerQuestions);
    const domainAnalysis = this.analyzeDomain(customerQuestions);

    const analysis: ConversationAnalysis = {
      callId,
      customerQuestions,
      agentResponses,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      metadata: {
        language: turns[0]?.language || 'hi',
        tone: toneAnalysis,
        domain: domainAnalysis
      }
    };

    console.log(`Conversation analysis complete: ${intentAnalysis.intent} (${intentAnalysis.confidence})`);
    return analysis;
  }

  private extractIntent(questions: string[]): { intent: string; confidence: number } {
    const combinedText = questions.join(' ').toLowerCase();
    let bestIntent = 'general_inquiry';
    let bestScore = 0;

    for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
          score += matches.length;
        }
      }

      // Boost score for exact phrase matches
      for (const question of questions) {
        for (const keyword of pattern.keywords) {
          if (question.toLowerCase().includes(keyword)) {
            score += 0.5;
          }
        }
      }

      if (score > bestScore) {
        bestIntent = intentName;
        bestScore = score;
      }
    }

    // Normalize confidence score
    const confidence = Math.min(bestScore / 3, 1.0);

    return { intent: bestIntent, confidence };
  }

  private analyzeTone(questions: string[]): string {
    const combinedText = questions.join(' ').toLowerCase();

    // Tone indicators
    const frustratedWords = ['problem', 'issue', 'complaint', 'shikayat', 'galat', 'wrong', 'bad', 'angry'];
    const urgentWords = ['urgent', 'fast', 'quick', 'immediately', 'now', 'jaldi'];
    const politeWords = ['please', 'thank you', 'kindly', 'request', 'meharbani'];

    let frustratedScore = 0, urgentScore = 0, politeScore = 0;

    for (const word of frustratedWords) {
      if (combinedText.includes(word)) frustratedScore++;
    }
    for (const word of urgentWords) {
      if (combinedText.includes(word)) urgentScore++;
    }
    for (const word of politeWords) {
      if (combinedText.includes(word)) politeScore++;
    }

    if (frustratedScore > urgentScore && frustratedScore > politeScore) return 'frustrated';
    if (urgentScore > frustratedScore && urgentScore > politeScore) return 'urgent';
    if (politeScore > frustratedScore && politeScore > urgentScore) return 'polite';

    return 'neutral';
  }

  private analyzeDomain(questions: string[]): string {
    const combinedText = questions.join(' ').toLowerCase();

    if (combinedText.includes('price') || combinedText.includes('cost') || combinedText.includes('buy')) {
      return 'sales';
    }
    if (combinedText.includes('return') || combinedText.includes('warranty') || combinedText.includes('defect')) {
      return 'support';
    }
    if (combinedText.includes('delivery') || combinedText.includes('shipping')) {
      return 'logistics';
    }

    return 'general';
  }

  // Batch analysis for multiple conversations
  async analyzeBatch(callIds: string[]): Promise<ConversationAnalysis[]> {
    console.log(`Analyzing batch of ${callIds.length} conversations`);

    const results: ConversationAnalysis[] = [];
    const batchSize = 20;

    for (let i = 0; i < callIds.length; i += batchSize) {
      const batch = callIds.slice(i, i + batchSize);
      const batchPromises = batch.map(callId => this.analyzeConversation(callId));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch analysis error:', result.reason);
        }
      }

      console.log(`Analyzed ${Math.min(i + batchSize, callIds.length)}/${callIds.length} conversations`);
    }

    return results;
  }
}

// Intent Clustering Service
export class IntentClustering {
  async createIntentClusters(analyses: ConversationAnalysis[]): Promise<void> {
    console.log(`Creating intent clusters from ${analyses.length} analyses`);

    const intentGroups = new Map<string, ConversationAnalysis[]>();

    // Group analyses by intent
    for (const analysis of analyses) {
      if (!intentGroups.has(analysis.intent)) {
        intentGroups.set(analysis.intent, []);
      }
      intentGroups.get(analysis.intent)!.push(analysis);
    }

    // Create clusters for each intent
    for (const [intentName, groupAnalyses] of intentGroups) {
      await this.createIntentCluster(intentName, groupAnalyses);
    }

    console.log(`Created ${intentGroups.size} intent clusters`);
  }

  private async createIntentCluster(intentName: string, analyses: ConversationAnalysis[]): Promise<void> {
    // Aggregate data for the cluster
    const primaryExamples = analyses.flatMap(a => a.customerQuestions);
    const tones = analyses.map(a => a.metadata.tone);
    const domains = analyses.map(a => a.metadata.domain);
    const languages = analyses.map(a => a.metadata.language);

    // Find most common tone and domain
    const mostCommonTone = this.findMostCommon(tones);
    const mostCommonDomain = this.findMostCommon(domains);
    const mostCommonLanguage = this.findMostCommon(languages);

    // Calculate average confidence
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    const cluster: IntentCluster = {
      intentName,
      domain: mostCommonDomain,
      primaryExamples: primaryExamples.slice(0, 50), // Limit examples
      secondaryIntents: [], // Will be filled by relationship analysis
      tone: mostCommonTone,
      language: mostCommonLanguage,
      confidenceScore: avgConfidence,
      sampleCount: analyses.length
    };

    // Save to database
    const { data, error } = await supabase
      .from('voice_intents')
      .upsert({
        intent_name: cluster.intentName,
        domain: cluster.domain,
        primary_examples: cluster.primaryExamples,
        secondary_intents: cluster.secondaryIntents,
        tone: cluster.tone,
        language: cluster.language,
        confidence_score: cluster.confidenceScore,
        sample_count: cluster.sampleCount
      })
      .select()
      .single();

    if (error) {
      console.error(`Failed to save intent cluster ${intentName}:`, error);
      return;
    }

    console.log(`Saved intent cluster: ${intentName} (${analyses.length} samples)`);

    // Create response patterns for this intent
    await this.createResponsePatterns(data.id, analyses);
  }

  private async createResponsePatterns(intentId: string, analyses: ConversationAnalysis[]): Promise<void> {
    const allResponses = analyses.flatMap(a => a.agentResponses);

    if (allResponses.length === 0) return;

    // Analyze response patterns
    const avgLength = allResponses.reduce((sum, r) => sum + r.length, 0) / allResponses.length;
    const commonPhrases = this.extractCommonPhrases(allResponses);
    const emojiUsage = this.extractEmojis(allResponses);
    const responseStyles = this.categorizeResponseStyles(allResponses);

    const pattern: ResponsePattern = {
      intentId,
      responseStyle: responseStyles[0] || 'direct', // Most common style
      avgResponseLength: Math.round(avgLength),
      commonPhrases,
      emojiUsage,
      language: analyses[0]?.metadata.language || 'hi',
      sampleResponses: allResponses.slice(0, 20), // Limit samples
      effectivenessScore: 0.8 // Placeholder - would be calculated based on outcomes
    };

    const { error } = await supabase
      .from('voice_response_patterns')
      .insert({
        intent_id: pattern.intentId,
        response_style: pattern.responseStyle,
        avg_response_length: pattern.avgResponseLength,
        common_phrases: pattern.commonPhrases,
        emoji_usage: pattern.emojiUsage,
        language: pattern.language,
        sample_responses: pattern.sampleResponses,
        effectiveness_score: pattern.effectivenessScore
      });

    if (error) {
      console.error(`Failed to save response pattern for intent ${intentId}:`, error);
    } else {
      console.log(`Saved response pattern for intent ${intentId}`);
    }
  }

  private findMostCommon(items: string[]): string {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let mostCommon = '';
    let maxCount = 0;
    for (const [item, count] of counts) {
      if (count > maxCount) {
        mostCommon = item;
        maxCount = count;
      }
    }

    return mostCommon;
  }

  private extractCommonPhrases(responses: string[]): string[] {
    const phrases: string[] = [];
    const commonStarters = ['sure', 'yes', 'no', 'the price', 'it will', 'we have', 'please'];

    for (const starter of commonStarters) {
      const count = responses.filter(r => r.toLowerCase().startsWith(starter)).length;
      if (count > responses.length * 0.3) { // If >30% of responses start with this
        phrases.push(starter);
      }
    }

    return phrases.slice(0, 10);
  }

  private extractEmojis(responses: string[]): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
    const emojis = new Set<string>();

    for (const response of responses) {
      const matches = response.match(emojiRegex);
      if (matches) {
        matches.forEach(emoji => emojis.add(emoji));
      }
    }

    return Array.from(emojis);
  }

  private categorizeResponseStyles(responses: string[]): string[] {
    const styles = ['direct', 'empathetic', 'detailed', 'concise'];
    const styleCounts = new Map<string, number>();

    for (const response of responses) {
      if (response.includes('sorry') || response.includes('understand')) {
        styleCounts.set('empathetic', (styleCounts.get('empathetic') || 0) + 1);
      } else if (response.length > 100) {
        styleCounts.set('detailed', (styleCounts.get('detailed') || 0) + 1);
      } else if (response.length < 30) {
        styleCounts.set('concise', (styleCounts.get('concise') || 0) + 1);
      } else {
        styleCounts.set('direct', (styleCounts.get('direct') || 0) + 1);
      }
    }

    return Array.from(styleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([style]) => style);
  }
}

// Embedding Generation Service
export class EmbeddingGenerator {
  async generateEmbeddingsForIntents(): Promise<void> {
    console.log('Generating embeddings for voice intents...');

    // Get all intents
    const { data: intents, error } = await supabase
      .from('voice_intents')
      .select('*');

    if (error || !intents) {
      throw new Error(`Failed to fetch intents: ${error?.message}`);
    }

    for (const intent of intents) {
      await this.generateIntentEmbeddings(intent);
    }

    console.log(`Generated embeddings for ${intents.length} intents`);
  }

  private async generateIntentEmbeddings(intent: any): Promise<void> {
    // Generate embeddings for primary examples
    for (const example of intent.primary_examples.slice(0, 10)) { // Limit for performance
      const embedding = await embedText(example);

      await supabase
        .from('voice_embeddings')
        .insert({
          content_type: 'question',
          content_id: intent.id,
          embedding,
          text_content: example,
          language: intent.language
        });
    }

    // Generate embeddings for response patterns
    const { data: patterns } = await supabase
      .from('voice_response_patterns')
      .select('*')
      .eq('intent_id', intent.id);

    if (patterns) {
      for (const pattern of patterns) {
        for (const response of pattern.sample_responses.slice(0, 5)) {
          const embedding = await embedText(response);

          await supabase
            .from('voice_embeddings')
            .insert({
              content_type: 'response',
              content_id: pattern.id,
              embedding,
              text_content: response,
              language: pattern.language
            });
        }
      }
    }

    console.log(`Generated embeddings for intent: ${intent.intent_name}`);
  }
}

// Global instances
export const intentExtractor = new IntentExtractor();
export const intentClustering = new IntentClustering();
export const embeddingGenerator = new EmbeddingGenerator();