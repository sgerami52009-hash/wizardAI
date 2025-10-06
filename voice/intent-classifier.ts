/**
 * Intent Classification System
 * Safety: All intents validated for child-appropriate content
 * Performance: Local NLU processing <100ms on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { 
  IntentClassifier, 
  IntentResult, 
  IntentDefinition, 
  ParameterDefinition,
  ConversationContext 
} from './interfaces';
import { validateChildSafeContent } from '../safety/content-safety-filter';
import { sanitizeForLog } from '../models/user-profiles';

export interface IntentPattern {
  pattern: RegExp;
  weight: number;
  requiredEntities?: string[];
  contextDependencies?: string[];
}

export interface EntityExtractor {
  extractEntities(text: string): Promise<ExtractedEntity[]>;
  registerEntityType(type: string, patterns: RegExp[]): void;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface ClassificationContext {
  conversationHistory: string[];
  activeTopics: string[];
  userPreferences: Record<string, any>;
  timeContext: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
    isWeekend: boolean;
  };
  environmentContext: {
    location: string;
    otherUsers: string[];
    ambientNoise: 'quiet' | 'moderate' | 'noisy';
  };
}

export class LocalIntentClassifier extends EventEmitter implements IntentClassifier {
  private registeredIntents: Map<string, IntentDefinition> = new Map();
  private intentPatterns: Map<string, IntentPattern[]> = new Map();
  private entityExtractor: EntityExtractor;
  private confidenceThreshold: number = 0.7;
  private maxAlternatives: number = 3;

  constructor(entityExtractor: EntityExtractor) {
    super();
    this.entityExtractor = entityExtractor;
    this.initializeBuiltInIntents();
  }

  async classifyIntent(text: string, context: ConversationContext): Promise<IntentResult> {
    try {
      // Safety validation first
      const safetyResult = await validateChildSafeContent(text, context.userId);
      if (!safetyResult.isAllowed) {
        this.emit('safetyViolation', { text: sanitizeForLog(text), userId: context.userId });
        return this.createSafetyBlockedResult();
      }

      const startTime = Date.now();
      
      // Normalize and preprocess text
      const normalizedText = this.normalizeText(text);
      
      // Extract entities
      const entities = await this.entityExtractor.extractEntities(normalizedText);
      
      // Build classification context
      const classificationContext = this.buildClassificationContext(context);
      
      // Score all registered intents
      const intentScores = await this.scoreIntents(normalizedText, entities, classificationContext);
      
      // Select best intent and alternatives
      const result = this.selectBestIntent(intentScores, entities, context);
      
      const processingTime = Date.now() - startTime;
      this.emit('intentClassified', { 
        intent: result.intent, 
        confidence: result.confidence, 
        processingTime,
        userId: context.userId 
      });

      return result;
    } catch (error) {
      this.emit('classificationError', { error, text: sanitizeForLog(text) });
      return this.createErrorFallbackResult();
    }
  }

  registerIntent(intent: IntentDefinition): void {
    // Validate intent definition
    if (!this.validateIntentDefinition(intent)) {
      throw new Error(`Invalid intent definition: ${intent.name}`);
    }

    this.registeredIntents.set(intent.name, intent);
    
    // Compile patterns for efficient matching
    const patterns = intent.patterns.map(pattern => this.compilePattern(pattern));
    this.intentPatterns.set(intent.name, patterns);
    
    this.emit('intentRegistered', { intentName: intent.name });
  }

  updateContext(context: ConversationContext): void {
    // Update internal context for better classification
    this.emit('contextUpdated', { sessionId: context.sessionId });
  }

  getRegisteredIntents(): IntentDefinition[] {
    return Array.from(this.registeredIntents.values());
  }

  private initializeBuiltInIntents(): void {
    // Smart home control intents
    this.registerIntent({
      name: 'smart_home.lights.control',
      patterns: [
        'turn (on|off) the lights?',
        '(dim|brighten) the lights?',
        'set lights? to \\d+%?',
        'lights? (on|off)',
        'make .* brighter',
        'turn them (on|off)'
      ],
      parameters: [
        { name: 'action', type: 'string', required: true },
        { name: 'location', type: 'string', required: false },
        { name: 'brightness', type: 'number', required: false }
      ],
      requiredConfidence: 0.8,
      safetyLevel: 'child'
    });

    // Scheduling intents
    this.registerIntent({
      name: 'scheduling.create_reminder',
      patterns: [
        'remind me to .+ (at|in) .+',
        'set a reminder for .+',
        'don\'t forget to .+',
        'schedule .+ for .+',
        'remind me to .+ at .+'
      ],
      parameters: [
        { name: 'task', type: 'string', required: true },
        { name: 'time', type: 'time', required: true },
        { name: 'date', type: 'date', required: false }
      ],
      requiredConfidence: 0.75,
      safetyLevel: 'child'
    });

    // Information requests
    this.registerIntent({
      name: 'information.weather',
      patterns: [
        'what\'s the weather (like)?',
        'how\'s the weather',
        'is it (raining|sunny|cloudy)',
        'weather (forecast|report)',
        'what.s the weather like'
      ],
      parameters: [
        { name: 'location', type: 'string', required: false },
        { name: 'timeframe', type: 'string', required: false }
      ],
      requiredConfidence: 0.85,
      safetyLevel: 'child'
    });

    // Conversation management
    this.registerIntent({
      name: 'conversation.greeting',
      patterns: [
        '(hi|hello|hey) there?',
        'good (morning|afternoon|evening)',
        'how are you',
        'what\'s up',
        'hello there',
        'good morning'
      ],
      parameters: [],
      requiredConfidence: 0.9,
      safetyLevel: 'child'
    });

    this.registerIntent({
      name: 'conversation.goodbye',
      patterns: [
        '(bye|goodbye|see you)',
        'talk to you later',
        'that\'s all',
        'thank you'
      ],
      parameters: [],
      requiredConfidence: 0.9,
      safetyLevel: 'child'
    });

    // Clarification and help
    this.registerIntent({
      name: 'system.help',
      patterns: [
        'help me?',
        'what can you do',
        'how do I .+',
        'I need help'
      ],
      parameters: [
        { name: 'topic', type: 'string', required: false }
      ],
      requiredConfidence: 0.8,
      safetyLevel: 'child'
    });
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private compilePattern(pattern: string): IntentPattern {
    try {
      // Create a more flexible regex pattern
      const regex = new RegExp(pattern, 'i');
      
      // Calculate pattern weight based on specificity
      const weight = this.calculatePatternWeight(pattern);
      
      return {
        pattern: regex,
        weight,
        requiredEntities: this.extractRequiredEntities(pattern),
        contextDependencies: this.extractContextDependencies(pattern)
      };
    } catch (error) {
      // Fallback to simple string matching if regex fails
      const simplePattern = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      return {
        pattern: simplePattern,
        weight: 0.5,
        requiredEntities: [],
        contextDependencies: []
      };
    }
  }

  private calculatePatternWeight(pattern: string): number {
    // More specific patterns get higher weights
    let weight = 1.0;
    
    // Bonus for exact word matches
    if (pattern.includes('\\b')) weight += 0.2;
    
    // Bonus for required parameters
    if (pattern.includes('\\d+')) weight += 0.1;
    
    // Penalty for very general patterns
    if (pattern.length < 10) weight -= 0.1;
    
    return Math.max(0.1, Math.min(2.0, weight));
  }

  private extractRequiredEntities(pattern: string): string[] {
    // Extract entity placeholders from pattern
    const entityMatches = pattern.match(/\{(\w+)\}/g);
    return entityMatches ? entityMatches.map(match => match.slice(1, -1)) : [];
  }

  private extractContextDependencies(pattern: string): string[] {
    // Extract context dependencies from pattern annotations
    const contextMatches = pattern.match(/@(\w+)/g);
    return contextMatches ? contextMatches.map(match => match.slice(1)) : [];
  }

  private buildClassificationContext(context: ConversationContext): ClassificationContext {
    const now = new Date();
    const hour = now.getHours();
    
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else if (hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    return {
      conversationHistory: context.turns.slice(-5).map((turn: any) => turn.recognizedText),
      activeTopics: context.activeTopics,
      userPreferences: context.userPreferences,
      timeContext: {
        timeOfDay,
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        isWeekend: now.getDay() === 0 || now.getDay() === 6
      },
      environmentContext: {
        location: context.environmentContext?.location || 'home',
        otherUsers: context.environmentContext?.otherUsers || [],
        ambientNoise: context.environmentContext?.ambientNoise || 'quiet'
      }
    };
  }

  private async scoreIntents(
    text: string, 
    entities: ExtractedEntity[], 
    context: ClassificationContext
  ): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    for (const [intentName, patterns] of this.intentPatterns) {
      let maxScore = 0;

      for (const pattern of patterns) {
        const score = this.scorePattern(text, pattern, entities, context);
        maxScore = Math.max(maxScore, score);
      }

      if (maxScore > 0) {
        scores.set(intentName, maxScore);
      }
    }

    return scores;
  }

  private scorePattern(
    text: string, 
    pattern: IntentPattern, 
    entities: ExtractedEntity[], 
    context: ClassificationContext
  ): number {
    let score = 0;

    // Base pattern matching
    const match = pattern.pattern.test(text);
    if (!match) return 0;

    score = pattern.weight;

    // Boost for entity matches
    if (pattern.requiredEntities) {
      const foundEntities = pattern.requiredEntities.filter(entityType =>
        entities.some(entity => entity.type === entityType)
      );
      score *= (foundEntities.length / pattern.requiredEntities.length);
    }

    // Context relevance boost
    score *= this.calculateContextRelevance(pattern, context);

    // Conversation history relevance
    score *= this.calculateHistoryRelevance(text, context.conversationHistory);

    return Math.min(1.0, score);
  }

  private calculateContextRelevance(pattern: IntentPattern, context: ClassificationContext): number {
    let relevance = 1.0;

    // Time-based relevance adjustments
    if (pattern.contextDependencies?.includes('time')) {
      // Scheduling intents more relevant during planning times
      if (context.timeContext.timeOfDay === 'morning' || context.timeContext.timeOfDay === 'evening') {
        relevance *= 1.2;
      }
    }

    // Environment-based adjustments
    if (pattern.contextDependencies?.includes('environment')) {
      // Smart home intents more relevant when at home
      if (context.environmentContext.location === 'home') {
        relevance *= 1.1;
      }
    }

    return relevance;
  }

  private calculateHistoryRelevance(text: string, history: string[]): number {
    if (history.length === 0) return 1.0;

    // Check for topic continuity
    const recentHistory = history.slice(-2);
    let relevance = 1.0;

    for (const historicalText of recentHistory) {
      const commonWords = this.findCommonWords(text, historicalText);
      if (commonWords.length > 0) {
        relevance *= 1.1; // Boost for topic continuity
      }
    }

    return Math.min(1.5, relevance);
  }

  private findCommonWords(text1: string, text2: string): string[] {
    const words1 = new Set(text1.split(' ').filter(word => word.length > 3));
    const words2 = new Set(text2.split(' ').filter(word => word.length > 3));
    
    return Array.from(words1).filter(word => words2.has(word));
  }

  private selectBestIntent(
    scores: Map<string, number>, 
    entities: ExtractedEntity[], 
    context: ConversationContext
  ): IntentResult {
    const sortedIntents = Array.from(scores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, this.maxAlternatives + 1);

    if (sortedIntents.length === 0 || sortedIntents[0][1] < this.confidenceThreshold) {
      return this.createUnknownIntentResult();
    }

    const [bestIntentName, bestScore] = sortedIntents[0];
    const bestIntent = this.registeredIntents.get(bestIntentName)!;

    // Extract parameters for the best intent
    const parameters = this.extractParameters(bestIntent, entities, context);

    // Check if confirmation is required
    const requiresConfirmation = this.shouldRequireConfirmation(bestIntent, bestScore, parameters);

    // Build alternatives
    const alternatives = sortedIntents.slice(1).map(([intentName, score]) => ({
      intent: intentName,
      confidence: score,
      parameters: this.extractParameters(this.registeredIntents.get(intentName)!, entities, context),
      requiresConfirmation: false
    }));

    return {
      intent: bestIntentName,
      confidence: bestScore,
      parameters,
      requiresConfirmation,
      alternatives
    };
  }

  private extractParameters(
    intent: IntentDefinition, 
    entities: ExtractedEntity[], 
    context: ConversationContext
  ): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const paramDef of intent.parameters) {
      const entity = entities.find(e => e.type === paramDef.name);
      
      if (entity) {
        parameters[paramDef.name] = this.convertEntityValue(entity.value, paramDef.type);
      } else if (paramDef.required) {
        // Try to extract from context or conversation history
        const contextValue = this.extractFromContext(paramDef.name, context);
        if (contextValue) {
          parameters[paramDef.name] = contextValue;
        }
      }
    }

    return parameters;
  }

  private convertEntityValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value) || 0;
      case 'date':
        return new Date(value);
      case 'time':
        return value; // Keep as string for now, could parse to time object
      default:
        return value;
    }
  }

  private extractFromContext(paramName: string, context: ConversationContext): any {
    // Try to extract parameter from conversation context
    if (paramName === 'location' && context.environmentContext?.location) {
      return context.environmentContext.location;
    }
    
    // Could add more context-based parameter extraction here
    return null;
  }

  private shouldRequireConfirmation(
    intent: IntentDefinition, 
    confidence: number, 
    parameters: Record<string, any>
  ): boolean {
    // Require confirmation for low confidence
    if (confidence < intent.requiredConfidence) return true;

    // Require confirmation for actions with missing required parameters
    const missingRequired = intent.parameters
      .filter(p => p.required && !parameters[p.name])
      .length > 0;

    if (missingRequired) return true;

    // Require confirmation for potentially dangerous actions
    const dangerousIntents = ['smart_home.security', 'system.shutdown', 'smart_home.locks'];
    if (dangerousIntents.some(dangerous => intent.name.startsWith(dangerous))) {
      return true;
    }

    return false;
  }

  private validateIntentDefinition(intent: IntentDefinition): boolean {
    if (!intent.name || intent.name.trim().length === 0) return false;
    if (!intent.patterns || intent.patterns.length === 0) return false;
    if (!intent.parameters) return false;
    if (intent.requiredConfidence < 0 || intent.requiredConfidence > 1) return false;
    
    return true;
  }

  private createSafetyBlockedResult(): IntentResult {
    return {
      intent: 'system.safety_blocked',
      confidence: 1.0,
      parameters: {},
      requiresConfirmation: false
    };
  }

  private createErrorFallbackResult(): IntentResult {
    return {
      intent: 'system.error',
      confidence: 0.0,
      parameters: {},
      requiresConfirmation: false
    };
  }

  private createUnknownIntentResult(): IntentResult {
    return {
      intent: 'system.unknown',
      confidence: 0.0,
      parameters: {},
      requiresConfirmation: true
    };
  }
}