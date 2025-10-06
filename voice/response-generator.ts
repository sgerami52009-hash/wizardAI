/**
 * Response Generation Engine
 * 
 * Generates natural, contextually appropriate responses based on command results
 * and user profiles. Implements template-based generation with personality adaptation
 * and response variation to avoid repetitive interactions.
 * 
 * Safety: All responses validated through child-safety filters
 * Performance: Target <300ms response generation on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { 
  ResponseGenerator, 
  ResponseContext, 
  ResponseTemplate, 
  CommandResult
} from './interfaces';
import { ConversationTurn } from '../models/conversation-context';
import { PersonalityProfile } from '../models/voice-models';
import { validateChildSafeContent } from '../safety/content-safety-filter';

export interface ResponseVariation {
  pattern: string;
  weight: number;
  lastUsed?: Date;
  usageCount: number;
  contextTags: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'time' | 'dynamic';
  required: boolean;
  defaultValue?: any;
  validator?: (value: any) => boolean;
}

export interface ResponseGenerationOptions {
  maxVariationHistory: number;
  personalityWeight: number;
  contextWeight: number;
  variationThreshold: number;
}

export class ResponseGenerationEngine extends EventEmitter implements ResponseGenerator {
  private templates: Map<string, ResponseTemplate> = new Map();
  private variationHistory: Map<string, ResponseVariation[]> = new Map();
  private personality: PersonalityProfile | null = null;
  private options: ResponseGenerationOptions;
  private responseCache: Map<string, { response: string; timestamp: Date }> = new Map();

  constructor(options: Partial<ResponseGenerationOptions> = {}) {
    super();
    
    this.options = {
      maxVariationHistory: 10,
      personalityWeight: 0.7,
      contextWeight: 0.8,
      variationThreshold: 0.3,
      ...options
    };

    this.initializeDefaultTemplates();
  }

  /**
   * Generate contextually appropriate response
   * Requirements: 3.3, 3.6 - Natural responses with personality adaptation
   */
  async generateResponse(result: CommandResult, context: ResponseContext): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Get base template for the intent
      const template = this.getTemplate(context.currentIntent);
      if (!template) {
        return this.generateFallbackResponse(result, context);
      }

      // Select appropriate variation to avoid repetition
      const variation = this.selectResponseVariation(template, context);
      
      // Apply personality adaptation
      const personalizedResponse = this.applyPersonalityAdaptation(variation, context);
      
      // Insert dynamic content
      const populatedResponse = await this.populateTemplate(personalizedResponse, result, context);
      
      // Validate child safety
      const safetyResult = await validateChildSafeContent(populatedResponse, context.userId);
      if (!safetyResult.isAllowed) {
        this.emit('safetyViolation', { response: populatedResponse, context, reason: safetyResult.blockedReasons });
        return this.generateSafeAlternative(result, context);
      }

      // Update usage tracking
      this.updateVariationUsage(context.currentIntent, variation);
      
      // Cache response for potential reuse
      this.cacheResponse(context, populatedResponse);
      
      const processingTime = Date.now() - startTime;
      this.emit('responseGenerated', { 
        intent: context.currentIntent, 
        processingTime, 
        responseLength: populatedResponse.length 
      });

      return populatedResponse;

    } catch (error) {
      this.emit('error', { error, context, stage: 'response_generation' });
      return this.generateErrorResponse(context);
    }
  }

  /**
   * Set personality profile for response adaptation
   * Requirements: 3.6 - Personality-aware language adaptation
   */
  setPersonality(personality: PersonalityProfile): void {
    this.personality = personality;
    this.emit('personalityUpdated', { personalityId: personality.id });
  }

  /**
   * Add response template for specific intent
   * Requirements: 3.3 - Template-based response generation
   */
  addResponseTemplate(intent: string, template: ResponseTemplate): void {
    // Validate template safety
    if (!template.safetyValidated) {
      throw new Error(`Template for intent '${intent}' must be safety validated`);
    }

    this.templates.set(intent, template);
    this.initializeVariationHistory(intent, template);
    this.emit('templateAdded', { intent, templateId: template.patterns[0] });
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): Map<string, ResponseTemplate> {
    return new Map(this.templates);
  }

  /**
   * Initialize default response templates for common intents
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Record<string, ResponseTemplate> = {
      'greeting': {
        patterns: [
          "Hello! How can I help you today?",
          "Hi there! What would you like to do?",
          "Good to see you! How may I assist?",
          "Hello! I'm here to help with whatever you need."
        ],
        variables: [],
        safetyValidated: true,
        personalityAdaptations: {
          'friendly': "Hi! I'm so excited to help you today!",
          'professional': "Good day. How may I be of assistance?",
          'playful': "Hey there, friend! Ready for some fun?"
        }
      },
      'confirmation': {
        patterns: [
          "Got it! I'll {action} for you.",
          "Sure thing! {action} coming right up.",
          "Absolutely! Let me {action} now.",
          "Perfect! I'm {action} right away."
        ],
        variables: ['action'],
        safetyValidated: true,
        personalityAdaptations: {
          'enthusiastic': "Awesome! I'm super excited to {action} for you!",
          'calm': "Certainly. I'll {action} for you now.",
          'helpful': "Of course! I'd be happy to {action}."
        }
      },
      'error': {
        patterns: [
          "I'm sorry, I couldn't do that right now. Let's try something else!",
          "Oops! Something didn't work as expected. Would you like to try again?",
          "I ran into a little problem. Can we try a different approach?",
          "That didn't work out, but I'm here to help find another way!"
        ],
        variables: [],
        safetyValidated: true,
        personalityAdaptations: {
          'apologetic': "I'm really sorry that didn't work. Let me help you try again.",
          'encouraging': "No worries! These things happen. Let's figure this out together!",
          'solution_focused': "Let's try a different approach to get this done for you."
        }
      },
      'clarification': {
        patterns: [
          "I want to make sure I understand. Did you mean {clarification}?",
          "Just to confirm, you'd like me to {clarification}?",
          "Let me check - are you asking me to {clarification}?",
          "To be sure I get this right, you want {clarification}?"
        ],
        variables: ['clarification'],
        safetyValidated: true,
        personalityAdaptations: {
          'careful': "I want to be absolutely sure I understand correctly. You mean {clarification}?",
          'friendly': "Just making sure I've got this right - you want {clarification}?",
          'thorough': "Let me verify the details. You're asking for {clarification}, correct?"
        }
      }
    };

    Object.entries(defaultTemplates).forEach(([intent, template]) => {
      this.templates.set(intent, template);
      this.initializeVariationHistory(intent, template);
    });
  }

  /**
   * Get template for specific intent with fallback
   */
  private getTemplate(intent: string): ResponseTemplate | null {
    // Direct match
    if (this.templates.has(intent)) {
      return this.templates.get(intent)!;
    }

    // Try to find partial match or category
    const intentCategory = intent.split('.')[0];
    if (this.templates.has(intentCategory)) {
      return this.templates.get(intentCategory)!;
    }

    // Check for generic templates
    const genericIntents = ['confirmation', 'error', 'clarification'];
    for (const generic of genericIntents) {
      if (intent.includes(generic) && this.templates.has(generic)) {
        return this.templates.get(generic)!;
      }
    }

    return null;
  }

  /**
   * Select response variation to avoid repetition
   * Requirements: 3.3 - Response variation algorithms
   */
  private selectResponseVariation(template: ResponseTemplate, context: ResponseContext): string {
    const variations = this.variationHistory.get(context.currentIntent) || [];
    
    if (variations.length === 0) {
      // Initialize variations from template patterns
      const newVariations = template.patterns.map((pattern, index) => ({
        pattern,
        weight: 1.0,
        usageCount: 0,
        contextTags: this.extractContextTags(context)
      }));
      this.variationHistory.set(context.currentIntent, newVariations);
      return template.patterns[0];
    }

    // Calculate weights based on usage history and context
    const weightedVariations = variations.map(variation => {
      let weight = variation.weight;
      
      // Reduce weight for recently used variations
      if (variation.lastUsed) {
        const timeSinceUsed = Date.now() - variation.lastUsed.getTime();
        const hoursSinceUsed = timeSinceUsed / (1000 * 60 * 60);
        weight *= Math.min(1.0, hoursSinceUsed / 2); // Reduce weight for 2 hours
      }
      
      // Reduce weight for frequently used variations
      const usageFrequency = variation.usageCount / Math.max(1, variations.length);
      weight *= Math.max(0.1, 1.0 - usageFrequency * 0.5);
      
      // Boost weight for context-appropriate variations
      const contextMatch = this.calculateContextMatch(variation.contextTags, context);
      weight *= (1.0 + contextMatch * 0.3);
      
      return { ...variation, calculatedWeight: weight };
    });

    // Select variation using weighted random selection
    const totalWeight = weightedVariations.reduce((sum, v) => sum + v.calculatedWeight, 0);
    let random = Math.random() * totalWeight;
    
    for (const variation of weightedVariations) {
      random -= variation.calculatedWeight;
      if (random <= 0) {
        return variation.pattern;
      }
    }
    
    // Fallback to first variation
    return variations[0].pattern;
  }

  /**
   * Apply personality-based adaptations to response
   * Requirements: 3.6 - Personality-aware language adaptation
   */
  private applyPersonalityAdaptation(response: string, context: ResponseContext): string {
    if (!this.personality) {
      return response;
    }

    const template = this.getTemplate(context.currentIntent);
    if (!template || !template.personalityAdaptations) {
      return this.applyPersonalityTraits(response);
    }

    // Check for direct personality adaptation
    const personalityStyle = this.determinePersonalityStyle();
    if (template.personalityAdaptations[personalityStyle]) {
      return template.personalityAdaptations[personalityStyle];
    }

    return this.applyPersonalityTraits(response);
  }

  /**
   * Apply personality traits to modify response tone and style
   */
  private applyPersonalityTraits(response: string): string {
    if (!this.personality) {
      return response;
    }

    let adaptedResponse = response;
    const traits = this.personality.responseStyle;

    // Apply enthusiasm
    if (traits.enthusiasm > 0.7) {
      adaptedResponse = this.addEnthusiasm(adaptedResponse);
    }

    // Apply helpfulness
    if (traits.helpfulness > 0.8) {
      adaptedResponse = this.addHelpfulness(adaptedResponse);
    }

    // Apply humor (carefully for child safety)
    if (traits.humor > 0.6 && this.isHumorAppropriate(response)) {
      adaptedResponse = this.addMildHumor(adaptedResponse);
    }

    return adaptedResponse;
  }

  /**
   * Populate template with dynamic content
   * Requirements: 3.3 - Dynamic content insertion
   */
  private async populateTemplate(
    template: string, 
    result: CommandResult, 
    context: ResponseContext
  ): Promise<string> {
    let populatedResponse = template;

    // Replace standard variables
    const variables = {
      'action': this.extractActionFromResult(result),
      'result': result.data ? JSON.stringify(result.data) : result.response,
      'user': context.userId,
      'time': new Date().toLocaleTimeString(),
      'clarification': result.response
    };

    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      populatedResponse = populatedResponse.replace(regex, String(value));
    });

    // Add context-aware content
    populatedResponse = this.addContextualContent(populatedResponse, context);

    return populatedResponse;
  }

  /**
   * Generate fallback response when no template is available
   */
  private generateFallbackResponse(result: CommandResult, context: ResponseContext): string {
    if (result.success) {
      return result.response || "Done! Is there anything else I can help you with?";
    } else {
      return "I couldn't complete that request right now. Would you like to try something else?";
    }
  }

  /**
   * Generate safe alternative when content fails safety validation
   */
  private generateSafeAlternative(result: CommandResult, context: ResponseContext): string {
    const safeResponses = [
      "Let me help you with something else instead.",
      "I'd like to try a different approach. What else can I do for you?",
      "How about we work on something different together?",
      "I'm here to help! What would you like to do next?"
    ];
    
    return safeResponses[Math.floor(Math.random() * safeResponses.length)];
  }

  /**
   * Generate error response for system failures
   */
  private generateErrorResponse(context: ResponseContext): string {
    const errorResponses = [
      "I'm having a little trouble right now. Let's try again in a moment!",
      "Something's not working quite right. Can we try that again?",
      "I need a moment to get back on track. Please try again!",
      "Let me reset and we can try that again together."
    ];
    
    return errorResponses[Math.floor(Math.random() * errorResponses.length)];
  }

  // Helper methods for personality and context processing

  private determinePersonalityStyle(): string {
    if (!this.personality) return 'neutral';
    
    const traits = this.personality.responseStyle;
    
    if (traits.enthusiasm > 0.8) return 'enthusiastic';
    if (traits.helpfulness > 0.8) return 'helpful';
    if (traits.patience > 0.8) return 'calm';
    if (traits.humor > 0.7) return 'playful';
    if (traits.formality > 0.7) return 'professional';
    
    return 'friendly';
  }

  private extractContextTags(context: ResponseContext): string[] {
    const tags: string[] = [];
    
    // Add time-based tags
    const hour = new Date().getHours();
    if (hour < 12) tags.push('morning');
    else if (hour < 17) tags.push('afternoon');
    else tags.push('evening');
    
    // Add user preference tags
    if (context.userPreferences.language) {
      tags.push(`lang_${context.userPreferences.language}`);
    }
    
    // Add safety level tag
    tags.push(`safety_${context.safetyLevel}`);
    
    return tags;
  }

  private calculateContextMatch(variationTags: string[], context: ResponseContext): number {
    const currentTags = this.extractContextTags(context);
    const matches = variationTags.filter(tag => currentTags.includes(tag)).length;
    return matches / Math.max(1, variationTags.length);
  }

  private addEnthusiasm(response: string): string {
    // Add exclamation points and positive words
    return response.replace(/\./g, '!').replace(/\bI\b/g, "I'm excited to");
  }

  private addHelpfulness(response: string): string {
    // Add helpful phrases
    if (!response.includes('help')) {
      return response + " I'm here to help with anything else you need!";
    }
    return response;
  }

  private addMildHumor(response: string): string {
    // Very mild, child-appropriate humor additions
    const humorPhrases = [
      " (that was fun!)",
      " - piece of cake!",
      " - easy peasy!",
      " - mission accomplished!"
    ];
    
    if (Math.random() < 0.3) {
      const phrase = humorPhrases[Math.floor(Math.random() * humorPhrases.length)];
      return response + phrase;
    }
    
    return response;
  }

  private isHumorAppropriate(response: string): boolean {
    // Check if humor is appropriate for the context
    const seriousKeywords = ['error', 'problem', 'sorry', 'failed', 'wrong'];
    return !seriousKeywords.some(keyword => response.toLowerCase().includes(keyword));
  }

  private extractActionFromResult(result: CommandResult): string {
    // Extract action description from command result
    if (result.data && result.data.action) {
      return result.data.action;
    }
    
    // Parse from response text
    const actionMatch = result.response.match(/(?:will|going to|about to)\s+(.+?)(?:\.|$)/i);
    if (actionMatch) {
      return actionMatch[1];
    }
    
    return 'complete your request';
  }

  private addContextualContent(response: string, context: ResponseContext): string {
    // Add context from conversation history
    if (context.conversationHistory.length > 0) {
      const lastTurn = context.conversationHistory[context.conversationHistory.length - 1];
      
      // Reference previous interaction if relevant
      if (lastTurn.intent.intent === context.currentIntent && 
          Date.now() - lastTurn.timestamp.getTime() < 60000) { // Within 1 minute
        response = "Like before, " + response.toLowerCase();
      }
    }
    
    return response;
  }

  private initializeVariationHistory(intent: string, template: ResponseTemplate): void {
    const variations = template.patterns.map(pattern => ({
      pattern,
      weight: 1.0,
      usageCount: 0,
      contextTags: []
    }));
    
    this.variationHistory.set(intent, variations);
  }

  private updateVariationUsage(intent: string, selectedPattern: string): void {
    const variations = this.variationHistory.get(intent);
    if (!variations) return;
    
    const variation = variations.find(v => v.pattern === selectedPattern);
    if (variation) {
      variation.usageCount++;
      variation.lastUsed = new Date();
    }
  }

  private cacheResponse(context: ResponseContext, response: string): void {
    const cacheKey = `${context.userId}_${context.currentIntent}`;
    this.responseCache.set(cacheKey, {
      response,
      timestamp: new Date()
    });
    
    // Clean old cache entries
    if (this.responseCache.size > 100) {
      const oldestKey = Array.from(this.responseCache.keys())[0];
      this.responseCache.delete(oldestKey);
    }
  }
}