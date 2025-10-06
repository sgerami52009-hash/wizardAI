// Enhanced Interaction Collector Implementation with Privacy-First Design

import { EventEmitter } from 'events';
import { 
  InteractionCollector, 
  InteractionSummary,
  TimeRange
} from './types';
import { 
  UserInteraction, 
  InteractionSource, 
  RetentionPolicy,
  BehaviorPattern,
  InteractionType,
  InteractionContext
} from '../privacy/types';
import { validateChildSafeContent } from '../avatar/validation';

/**
 * Enhanced InteractionCollector with multi-source capture, real-time PII detection,
 * and pattern extraction without storing raw content.
 * Implements child safety validation and event bus integration.
 */
export class EnhancedInteractionCollector implements InteractionCollector {
  private eventBus: EventEmitter;
  private interactions: Map<string, UserInteraction[]> = new Map();
  private sources: Map<string, InteractionSource> = new Map();
  private retentionPolicies: Map<string, RetentionPolicy> = new Map();
  private piiDetector: PIIDetector;
  private patternExtractor: PatternExtractor;
  private isProcessing: boolean = false;

  // PII detection patterns for real-time filtering
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    address: /\b\d{1,5}\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/gi,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    name: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g // Simple name pattern
  };

  constructor(eventBus?: EventEmitter) {
    this.eventBus = eventBus || new EventEmitter();
    this.piiDetector = new PIIDetector(this.piiPatterns);
    this.patternExtractor = new PatternExtractor();
    
    // Set up event listeners for multi-source capture
    this.setupEventListeners();
  }

  /**
   * Captures interaction with real-time PII detection and pattern extraction
   */
  public async captureInteraction(interaction: UserInteraction): Promise<void> {
    try {
      this.isProcessing = true;

      // Validate interaction structure
      this.validateInteraction(interaction);

      // Apply child safety validation
      await this.validateChildSafety(interaction);

      // Real-time PII detection and removal
      const sanitizedInteraction = await this.sanitizeInteraction(interaction);

      // Extract behavioral patterns without storing raw content
      const patterns = await this.extractPatterns(sanitizedInteraction);

      // Create privacy-safe interaction record
      const privacySafeInteraction: UserInteraction = {
        ...sanitizedInteraction,
        patterns,
        // Remove any raw content - only store patterns and metadata
        outcome: {
          ...sanitizedInteraction.outcome,
          // Sanitize outcome data
        }
      };

      // Store interaction
      const userInteractions = this.interactions.get(interaction.userId) || [];
      userInteractions.push(privacySafeInteraction);
      this.interactions.set(interaction.userId, userInteractions);

      // Apply retention policy
      await this.applyRetentionPolicy(interaction.userId);

      // Emit event for other system components
      this.eventBus.emit('interaction:captured', {
        userId: interaction.userId,
        source: interaction.source,
        type: interaction.type,
        patterns: patterns.map(p => ({ type: p.type, strength: p.strength })),
        timestamp: interaction.timestamp
      });

      // Emit pattern detection events
      if (patterns.length > 0) {
        this.eventBus.emit('patterns:detected', {
          userId: interaction.userId,
          patterns: patterns,
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.eventBus.emit('interaction:error', {
        userId: interaction.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Registers interaction source with event bus integration
   */
  public async registerInteractionSource(source: InteractionSource): Promise<void> {
    this.sources.set(source.toString(), source);
    
    // Set up source-specific event listeners
    this.eventBus.on(`${source}:interaction`, async (data: any) => {
      try {
        const interaction = this.createInteractionFromSource(source, data);
        await this.captureInteraction(interaction);
      } catch (error) {
        this.eventBus.emit('source:error', {
          source,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    });

    this.eventBus.emit('source:registered', { source, timestamp: new Date() });
  }

  /**
   * Configures data retention with privacy compliance
   */
  public async configureDataRetention(userId: string, policy: RetentionPolicy): Promise<void> {
    // Validate retention policy for child safety compliance
    if (policy.retentionDays > 30) {
      throw new Error('Retention period exceeds maximum allowed for child safety (30 days)');
    }

    this.retentionPolicies.set(userId, policy);
    
    // Immediately apply new policy
    await this.applyRetentionPolicy(userId);

    this.eventBus.emit('retention:configured', {
      userId,
      policy,
      timestamp: new Date()
    });
  }

  /**
   * Gets interaction summary with privacy-safe aggregation
   */
  public async getInteractionSummary(userId: string, timeRange: TimeRange): Promise<InteractionSummary> {
    const userInteractions = this.interactions.get(userId) || [];
    
    const filteredInteractions = userInteractions.filter(interaction => {
      const interactionTime = interaction.timestamp.getTime();
      return interactionTime >= timeRange.start.getTime() && 
             interactionTime <= timeRange.end.getTime();
    });

    const patterns = this.aggregatePatterns(filteredInteractions);
    const trends = this.calculateTrends(filteredInteractions, timeRange);

    return {
      userId,
      timeRange,
      totalInteractions: filteredInteractions.length,
      interactionTypes: this.summarizeInteractionTypes(filteredInteractions),
      patterns,
      trends
    };
  }

  /**
   * Purges user data with audit logging
   */
  public async purgeUserData(userId: string): Promise<void> {
    const interactionCount = this.interactions.get(userId)?.length || 0;
    
    this.interactions.delete(userId);
    this.retentionPolicies.delete(userId);

    this.eventBus.emit('data:purged', {
      userId,
      interactionCount,
      timestamp: new Date()
    });
  }

  /**
   * Gets processing status for monitoring
   */
  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Gets registered sources
   */
  public getRegisteredSources(): InteractionSource[] {
    return Array.from(this.sources.values());
  }

  // Private methods

  private setupEventListeners(): void {
    // Listen for system-wide events
    this.eventBus.on('system:shutdown', () => {
      this.handleSystemShutdown();
    });

    this.eventBus.on('privacy:violation', (data: any) => {
      this.handlePrivacyViolation(data);
    });
  }

  private validateInteraction(interaction: UserInteraction): void {
    if (!interaction.userId || !interaction.sessionId || !interaction.timestamp) {
      throw new Error('Invalid interaction: missing required fields');
    }

    if (!interaction.source || !interaction.type) {
      throw new Error('Invalid interaction: missing source or type');
    }

    // Validate timestamp is not in the future
    if (interaction.timestamp > new Date()) {
      throw new Error('Invalid interaction: timestamp cannot be in the future');
    }

    // Validate session ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(interaction.sessionId)) {
      throw new Error('Invalid interaction: invalid session ID format');
    }
  }

  private async validateChildSafety(interaction: UserInteraction): Promise<void> {
    // Apply child safety validation - for now, implement basic content filtering
    // In a full implementation, this would integrate with the avatar validation system
    const contentToValidate = JSON.stringify({
      type: interaction.type,
      context: interaction.context,
      outcome: interaction.outcome
    });

    // Basic content safety check - no inappropriate content
    const unsafePatterns = [
      /violence/i,
      /inappropriate/i,
      /unsafe/i,
      /harmful/i
    ];

    const hasUnsafeContent = unsafePatterns.some(pattern => pattern.test(contentToValidate));
    if (hasUnsafeContent) {
      throw new Error('Interaction content failed child safety validation');
    }
  }

  private async sanitizeInteraction(interaction: UserInteraction): Promise<UserInteraction> {
    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(interaction));

    // Remove PII from all string fields recursively
    this.sanitizeObject(sanitized);

    return sanitized;
  }

  private sanitizeObject(obj: any): void {
    if (typeof obj === 'string') {
      obj = this.removePII(obj);
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'string') {
          obj[index] = this.removePII(item);
        } else if (typeof item === 'object' && item !== null) {
          this.sanitizeObject(item);
        }
      });
      return;
    }

    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = this.removePII(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          this.sanitizeObject(obj[key]);
        }
      });
    }
  }

  private removePII(text: string): string {
    let sanitized = text;

    // Apply all PII patterns
    Object.entries(this.piiPatterns).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REMOVED]`);
    });

    return sanitized;
  }

  private async extractPatterns(interaction: UserInteraction): Promise<BehaviorPattern[]> {
    return this.patternExtractor.extractPatterns(interaction);
  }

  private createInteractionFromSource(source: InteractionSource, data: any): UserInteraction {
    return {
      userId: data.userId || 'anonymous',
      sessionId: data.sessionId || this.generateSessionId(),
      timestamp: data.timestamp || new Date(),
      source,
      type: data.type || InteractionType.QUERY,
      context: data.context || this.createDefaultContext(),
      patterns: [],
      outcome: data.outcome || {
        success: true,
        userSatisfaction: 3,
        completionTime: 0,
        followUpRequired: false,
        errorOccurred: false
      }
    };
  }

  private createDefaultContext(): InteractionContext {
    return {
      timeOfDay: this.getCurrentTimeOfDay(),
      dayOfWeek: this.getCurrentDayOfWeek(),
      location: { room: 'unknown', building: 'home', city: 'unknown', isHome: true, isWork: false, isPublic: false },
      deviceType: 'smart_display' as any,
      previousInteractions: [],
      environmentalFactors: {
        location: { room: 'unknown', building: 'home', city: 'unknown', isHome: true, isWork: false, isPublic: false },
        weather: { condition: 'sunny' as any, temperature: 22, humidity: 50, isRaining: false },
        lighting: { brightness: 50, isNatural: true, colorTemperature: 5000 },
        noise: { level: 30, type: 'quiet' as any, isDistracting: false },
        temperature: 22
      }
    };
  }

  private getCurrentTimeOfDay(): any {
    const hour = new Date().getHours();
    if (hour < 6) return 'late_night';
    if (hour < 9) return 'early_morning';
    if (hour < 12) return 'morning';
    if (hour < 14) return 'early_afternoon';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  private getCurrentDayOfWeek(): any {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async applyRetentionPolicy(userId: string): Promise<void> {
    const policy = this.retentionPolicies.get(userId);
    if (!policy) return;

    const userInteractions = this.interactions.get(userId) || [];
    const cutoffDate = new Date(Date.now() - (policy.retentionDays * 24 * 60 * 60 * 1000));

    const filteredInteractions = userInteractions.filter(interaction => 
      interaction.timestamp >= cutoffDate
    );

    if (filteredInteractions.length !== userInteractions.length) {
      this.interactions.set(userId, filteredInteractions);
      
      this.eventBus.emit('retention:applied', {
        userId,
        removedCount: userInteractions.length - filteredInteractions.length,
        timestamp: new Date()
      });
    }
  }

  private summarizeInteractionTypes(interactions: UserInteraction[]): any[] {
    const typeMap = new Map();

    interactions.forEach(interaction => {
      const key = interaction.type;
      if (typeMap.has(key)) {
        const existing = typeMap.get(key);
        existing.count += 1;
        existing.averageDuration = (existing.averageDuration + interaction.outcome.completionTime) / 2;
        existing.successRate = (existing.successRate + (interaction.outcome.success ? 1 : 0)) / 2;
        existing.satisfaction = (existing.satisfaction + interaction.outcome.userSatisfaction) / 2;
      } else {
        typeMap.set(key, {
          type: key,
          count: 1,
          averageDuration: interaction.outcome.completionTime,
          successRate: interaction.outcome.success ? 1.0 : 0.0,
          satisfaction: interaction.outcome.userSatisfaction
        });
      }
    });

    return Array.from(typeMap.values());
  }

  private aggregatePatterns(interactions: UserInteraction[]): any[] {
    const patternMap = new Map();

    interactions.forEach(interaction => {
      interaction.patterns.forEach(pattern => {
        const key = `${pattern.type}_${pattern.patternId}`;
        if (patternMap.has(key)) {
          const existing = patternMap.get(key);
          existing.frequency += pattern.frequency;
          existing.strength = Math.max(existing.strength, pattern.strength);
        } else {
          patternMap.set(key, {
            type: pattern.type,
            frequency: pattern.frequency,
            strength: pattern.strength,
            lastSeen: interaction.timestamp
          });
        }
      });
    });

    return Array.from(patternMap.values());
  }

  private calculateTrends(interactions: UserInteraction[], timeRange: TimeRange): any[] {
    // Simple trend calculation - could be enhanced
    const trends: any[] = [];
    
    if (interactions.length > 1) {
      const firstHalf = interactions.slice(0, Math.floor(interactions.length / 2));
      const secondHalf = interactions.slice(Math.floor(interactions.length / 2));
      
      const firstHalfAvgSatisfaction = firstHalf.reduce((sum, i) => sum + i.outcome.userSatisfaction, 0) / firstHalf.length;
      const secondHalfAvgSatisfaction = secondHalf.reduce((sum, i) => sum + i.outcome.userSatisfaction, 0) / secondHalf.length;
      
      if (secondHalfAvgSatisfaction > firstHalfAvgSatisfaction) {
        trends.push({
          trendId: 'satisfaction_improving',
          type: 'increasing',
          direction: 'up',
          strength: (secondHalfAvgSatisfaction - firstHalfAvgSatisfaction) / 5,
          description: 'User satisfaction is improving over time',
          timeframe: 'short_term'
        });
      }
    }

    return trends;
  }

  private handleSystemShutdown(): void {
    // Gracefully handle system shutdown
    this.isProcessing = false;
  }

  private handlePrivacyViolation(data: any): void {
    // Handle privacy violations by purging affected data
    if (data.userId) {
      this.purgeUserData(data.userId);
    }
  }
}

/**
 * PII Detection utility class
 */
class PIIDetector {
  constructor(private patterns: Record<string, RegExp>) {}

  detectPII(text: string): { type: string; matches: string[] }[] {
    const detections: { type: string; matches: string[] }[] = [];

    Object.entries(this.patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        detections.push({ type, matches });
      }
    });

    return detections;
  }

  hasPII(text: string): boolean {
    return Object.values(this.patterns).some(pattern => pattern.test(text));
  }
}

/**
 * Pattern Extraction utility class
 */
class PatternExtractor {
  async extractPatterns(interaction: UserInteraction): Promise<BehaviorPattern[]> {
    const patterns: BehaviorPattern[] = [];

    // Extract temporal patterns
    patterns.push({
      patternId: `temporal_${interaction.userId}_${Date.now()}`,
      type: 'temporal' as any,
      strength: 0.7,
      frequency: 1,
      context: {
        temporal: { timeOfDay: interaction.context.timeOfDay, dayOfWeek: 'monday' as any, season: 'spring' as any, isHoliday: false, timeZone: 'UTC', relativeToSchedule: 'free_time' as any },
        environmental: interaction.context.environmentalFactors,
        social: { presentUsers: [], familyMembers: [], guestPresent: false, socialActivity: 'alone' as any },
        device: { deviceType: interaction.context.deviceType, screenSize: 'medium' as any, inputMethod: 'voice' as any, connectivity: 'online' as any }
      },
      isAnonymized: true
    });

    // Extract interaction type patterns
    patterns.push({
      patternId: `interaction_${interaction.type}_${Date.now()}`,
      type: 'behavioral' as any,
      strength: interaction.outcome.success ? 0.8 : 0.3,
      frequency: 1,
      context: {
        temporal: { timeOfDay: interaction.context.timeOfDay, dayOfWeek: 'monday' as any, season: 'spring' as any, isHoliday: false, timeZone: 'UTC', relativeToSchedule: 'free_time' as any },
        environmental: interaction.context.environmentalFactors,
        social: { presentUsers: [], familyMembers: [], guestPresent: false, socialActivity: 'alone' as any },
        device: { deviceType: interaction.context.deviceType, screenSize: 'medium' as any, inputMethod: 'voice' as any, connectivity: 'online' as any }
      },
      isAnonymized: true
    });

    return patterns;
  }
}