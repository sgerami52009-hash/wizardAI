/**
 * LLM Configuration and Provider Management
 * 
 * Manages different LLM providers, API keys, and configuration options
 * for the enhanced learning engine with proper safety and privacy controls.
 */

import { LLMProvider, LLMOptions } from './llm-enhanced-engine';

/**
 * LLM Configuration interface
 */
export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  safetyLevel: 'strict' | 'moderate' | 'relaxed';
  childSafetyEnabled: boolean;
  privacyMode: 'high' | 'medium' | 'low';
  offlineFallback: boolean;
  rateLimiting: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

/**
 * Default LLM configuration for family-safe operation
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'local', // Default to local for privacy
  model: 'gpt-4',
  maxTokens: 500,
  temperature: 0.7,
  safetyLevel: 'strict',
  childSafetyEnabled: true,
  privacyMode: 'high',
  offlineFallback: true,
  rateLimiting: {
    requestsPerMinute: 20,
    requestsPerHour: 100
  }
};

/**
 * Anthropic Claude provider
 */
export class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-3-sonnet-20240229', baseUrl = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateCompletion(prompt: string, options: LLMOptions = {}): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: options.maxTokens || 500,
          temperature: options.temperature || 0.7,
          system: options.systemPrompt || 'You are a helpful family assistant focused on child safety and educational content.',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      return data.content[0]?.text || '';
    } catch (error) {
      console.error('Anthropic completion error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Anthropic doesn't provide embeddings, use a simple hash-based approach
    const hash = this.textToHash(text);
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  async analyzeText(text: string, task: string): Promise<any> {
    const prompt = `Perform ${task} on this text: "${text}". Provide structured results.`;
    const result = await this.generateCompletion(prompt);
    
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result, task };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        })
      });
      return response.status !== 401; // Not unauthorized
    } catch {
      return false;
    }
  }

  private textToHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Ollama local LLM provider
 */
export class OllamaProvider implements LLMProvider {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(model = 'llama3', baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateCompletion(prompt: string, options: LLMOptions = {}): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: (options.systemPrompt || '') + '\n\n' + prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.topP || 1.0,
            num_predict: options.maxTokens || 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      console.error('Ollama completion error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding || [];
    } catch (error) {
      console.error('Ollama embedding error:', error);
      // Fallback to simple hash-based embedding
      return this.generateHashEmbedding(text);
    }
  }

  async analyzeText(text: string, task: string): Promise<any> {
    const prompt = `Task: ${task}\nText: "${text}"\nProvide structured analysis:`;
    const result = await this.generateCompletion(prompt);
    
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result, task };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private generateHashEmbedding(text: string): number[] {
    const hash = this.textToHash(text);
    return Array.from({ length: 384 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  private textToHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * LLM Provider Factory
 */
export class LLMProviderFactory {
  static createProvider(config: LLMConfig): LLMProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.apiKey) {
          console.warn('OpenAI API key not provided, falling back to local provider');
          return new LocalLLMProvider('');
        }
        return new OpenAIProvider(config.apiKey, config.baseUrl);
        
      case 'anthropic':
        if (!config.apiKey) {
          console.warn('Anthropic API key not provided, falling back to local provider');
          return new LocalLLMProvider('');
        }
        return new AnthropicProvider(config.apiKey, config.model, config.baseUrl);
        
      case 'ollama':
        return new OllamaProvider(config.model, config.baseUrl);
        
      case 'local':
      default:
        return new LocalLLMProvider(config.model || '');
    }
  }
}

/**
 * Rate limiting for LLM requests
 */
export class LLMRateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const key = `${userId}_minute`;
    const hourKey = `${userId}_hour`;
    
    // Check minute limit
    const minuteData = this.requestCounts.get(key);
    if (minuteData) {
      if (now < minuteData.resetTime) {
        if (minuteData.count >= this.config.rateLimiting.requestsPerMinute) {
          return false;
        }
      } else {
        // Reset minute counter
        this.requestCounts.set(key, { count: 0, resetTime: now + 60000 });
      }
    } else {
      this.requestCounts.set(key, { count: 0, resetTime: now + 60000 });
    }

    // Check hour limit
    const hourData = this.requestCounts.get(hourKey);
    if (hourData) {
      if (now < hourData.resetTime) {
        if (hourData.count >= this.config.rateLimiting.requestsPerHour) {
          return false;
        }
      } else {
        // Reset hour counter
        this.requestCounts.set(hourKey, { count: 0, resetTime: now + 3600000 });
      }
    } else {
      this.requestCounts.set(hourKey, { count: 0, resetTime: now + 3600000 });
    }

    // Increment counters
    const currentMinute = this.requestCounts.get(key)!;
    const currentHour = this.requestCounts.get(hourKey)!;
    
    currentMinute.count++;
    currentHour.count++;
    
    return true;
  }
}

/**
 * Content safety filter for LLM responses
 */
export class LLMSafetyFilter {
  private config: LLMConfig;
  private unsafePatterns: RegExp[];

  constructor(config: LLMConfig) {
    this.config = config;
    this.unsafePatterns = [
      /\b(violence|weapon|dangerous|harmful)\b/i,
      /\b(inappropriate|adult|mature)\b/i,
      // Add more patterns as needed
    ];
  }

  async filterResponse(response: string, context: any): Promise<string> {
    if (!this.config.childSafetyEnabled) {
      return response;
    }

    // Check for unsafe patterns
    for (const pattern of this.unsafePatterns) {
      if (pattern.test(response)) {
        console.warn('Unsafe content detected in LLM response');
        return this.generateSafeAlternative(context);
      }
    }

    // Additional safety checks based on safety level
    if (this.config.safetyLevel === 'strict') {
      return this.applyStrictSafetyFilter(response);
    }

    return response;
  }

  private generateSafeAlternative(context: any): string {
    return "I want to make sure I give you safe and appropriate suggestions. Let me help you with family-friendly activities instead.";
  }

  private applyStrictSafetyFilter(response: string): string {
    // Apply strict filtering for child safety
    return response
      .replace(/\b(buy|purchase|spend money)\b/gi, 'consider')
      .replace(/\b(alone|by yourself)\b/gi, 'with family supervision')
      .substring(0, 200); // Limit response length
  }
}

// Import the existing providers
import { OpenAIProvider, LocalLLMProvider } from './llm-enhanced-engine';

export { OpenAIProvider, LocalLLMProvider, LLMProvider, LLMOptions };