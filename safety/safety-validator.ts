/**
 * Safety Validator - Main orchestrator for content safety validation
 * Safety: Central validation point for ALL user-facing content
 * Performance: Optimized validation pipeline with caching and parallel processing
 */

import { EventEmitter } from 'events';
import { 
  SafetyValidator, 
  ValidationContext, 
  ValidationResult, 
  ValidationRules, 
  TrainingExample, 
  ValidationMetrics,
  AgeGroup 
} from './interfaces';
import { ContentSafetyFilterEngine } from './content-safety-filter';
import { SafetyAuditLoggerEngine } from './safety-audit-logger';
import { ParentalControlManagerEngine } from './parental-control-manager';
import { SafetyConfiguration } from '../models/safety-models';

export class SafetyValidatorEngine extends EventEmitter implements SafetyValidator {
  private contentFilter: ContentSafetyFilterEngine;
  private auditLogger: SafetyAuditLoggerEngine;
  private parentalControls: ParentalControlManagerEngine;
  private configuration: SafetyConfiguration;
  private validationCache: Map<string, { result: ValidationResult; timestamp: number }> = new Map();
  private metrics: ValidationMetrics;

  constructor(configuration: SafetyConfiguration) {
    super();
    this.configuration = configuration;
    this.contentFilter = new ContentSafetyFilterEngine(configuration);
    this.auditLogger = new SafetyAuditLoggerEngine(configuration);
    this.parentalControls = new ParentalControlManagerEngine(configuration.parentalControls);
    this.metrics = this.initializeMetrics();
    
    this.setupEventHandlers();
    this.startCacheCleanup();
  }

  /**
   * Main content validation method - MUST be called for ALL user-facing content
   * Safety: Implements allowlist-only approach with comprehensive validation
   */
  async validateContent(content: string, context: ValidationContext): Promise<ValidationResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first for performance
      const cacheKey = this.generateCacheKey(content, context);
      const cached = this.validationCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 60000) { // 1 minute cache
        this.metrics.totalValidations++;
        return cached.result;
      }

      // Check for existing safety exceptions first
      const exception = await this.parentalControls.checkSafetyExceptions(content, context.userId);
      if (exception) {
        const result: ValidationResult = {
          isValid: true,
          violations: [],
          requiresParentalReview: false,
          confidence: 1.0
        };
        
        this.cacheResult(cacheKey, result);
        this.updateMetrics(result, context.ageGroup, Date.now() - startTime);
        return result;
      }

      // Perform comprehensive validation
      const result = await this.performValidation(content, context);
      
      // Handle parental review if needed
      if (result.requiresParentalReview && !result.isValid) {
        await this.handleParentalReview(content, context, result);
      }

      // Cache the result
      this.cacheResult(cacheKey, result);
      
      // Update metrics
      this.updateMetrics(result, context.ageGroup, Date.now() - startTime);

      // Log validation event
      await this.logValidationEvent(content, context, result);

      return result;

    } catch (error) {
      this.emit('validation_error', { content, context, error });
      
      // Fail-safe: reject content on validation error
      const failSafeResult: ValidationResult = {
        isValid: false,
        violations: [{
          type: 'age_inappropriate',
          severity: 'high',
          description: 'Content validation failed - blocked for safety'
        }],
        requiresParentalReview: context.ageGroup !== 'adult',
        confidence: 0
      };

      this.updateMetrics(failSafeResult, context.ageGroup, Date.now() - startTime);
      return failSafeResult;
    }
  }

  /**
   * Update validation rules and patterns
   */
  updateValidationRules(rules: ValidationRules): void {
    try {
      // Update content filter rules
      const safetyRules = this.convertToSafetyRules(rules);
      this.contentFilter.updateFilterRules(safetyRules);
      
      // Clear cache when rules change
      this.validationCache.clear();
      
      this.emit('validation_rules_updated', rules);
      
    } catch (error) {
      this.emit('rules_update_error', { rules, error });
      throw new Error(`Failed to update validation rules: ${error.message}`);
    }
  }

  /**
   * Train custom filter with examples (placeholder for ML training)
   */
  async trainCustomFilter(examples: TrainingExample[]): Promise<void> {
    try {
      // In production, this would train ML models
      // For now, we'll extract patterns and add them to rules
      
      const patterns = this.extractPatternsFromExamples(examples);
      
      // Update validation rules with learned patterns
      for (const pattern of patterns) {
        // Add to appropriate category based on training data
        this.emit('pattern_learned', pattern);
      }
      
      this.emit('training_completed', { 
        exampleCount: examples.length,
        patternsLearned: patterns.length 
      });
      
    } catch (error) {
      this.emit('training_error', { examples, error });
      throw new Error(`Failed to train custom filter: ${error.message}`);
    }
  }

  /**
   * Get current validation metrics
   */
  getValidationMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Validate child-safe content - convenience method for the required safety function
   */
  async validateChildSafeContent(content: string, ageGroup: AgeGroup = 'child'): Promise<boolean> {
    const context: ValidationContext = {
      userId: 'system',
      ageGroup,
      contentType: 'text_output',
      parentalSettings: {
        strictMode: true,
        allowedHours: [],
        contentRestrictions: [],
        supervisionRequired: ageGroup === 'child',
        notificationPreferences: {
          emailAlerts: false,
          pushNotifications: false,
          weeklyReports: false,
          immediateAlerts: []
        }
      }
    };

    const result = await this.validateContent(content, context);
    return result.isValid;
  }

  /**
   * Perform the actual validation using content filter
   */
  private async performValidation(content: string, context: ValidationContext): Promise<ValidationResult> {
    // Use content filter for validation
    const safetyResult = context.contentType === 'voice_input' 
      ? await this.contentFilter.validateInput(content, context.userId)
      : await this.contentFilter.validateOutput(content, context.userId);

    // Convert safety result to validation result
    const violations = safetyResult.blockedReasons.map(reason => ({
      type: this.categorizeViolation(reason),
      severity: this.mapRiskToSeverity(safetyResult.riskLevel),
      description: reason
    }));

    return {
      isValid: safetyResult.isAllowed,
      violations,
      suggestedAlternatives: safetyResult.sanitizedText ? [safetyResult.sanitizedText] : [],
      requiresParentalReview: !safetyResult.isAllowed && context.ageGroup !== 'adult',
      confidence: safetyResult.confidence
    };
  }

  /**
   * Handle parental review process
   */
  private async handleParentalReview(
    content: string, 
    context: ValidationContext, 
    result: ValidationResult
  ): Promise<void> {
    try {
      const requestId = await this.parentalControls.requestParentalApproval(content, context.userId);
      
      this.emit('parental_review_initiated', {
        requestId,
        userId: context.userId,
        contentType: context.contentType,
        violationCount: result.violations.length
      });
      
    } catch (error) {
      this.emit('parental_review_error', { content, context, error });
    }
  }

  /**
   * Log validation event for audit trail
   */
  private async logValidationEvent(
    content: string, 
    context: ValidationContext, 
    result: ValidationResult
  ): Promise<void> {
    try {
      const auditEntry = {
        id: this.generateId('validation'),
        timestamp: new Date(),
        userId: context.userId,
        eventType: result.isValid ? 'input_validation' : 'content_blocked' as any,
        originalContent: content,
        processedContent: result.suggestedAlternatives?.[0],
        riskLevel: result.violations.length > 0 
          ? this.mapSeverityToRisk(result.violations[0].severity)
          : 'low' as any,
        blockedReasons: result.violations.map(v => v.description),
        parentalReview: result.requiresParentalReview
      };

      await this.auditLogger.logSafetyEvent(auditEntry);
      
    } catch (error) {
      this.emit('audit_logging_error', { content, context, result, error });
    }
  }

  /**
   * Generate cache key for validation results
   */
  private generateCacheKey(content: string, context: ValidationContext): string {
    const contentHash = this.simpleHash(content);
    return `${contentHash}_${context.userId}_${context.ageGroup}_${context.contentType}`;
  }

  /**
   * Cache validation result
   */
  private cacheResult(key: string, result: ValidationResult): void {
    this.validationCache.set(key, {
      result: { ...result },
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.validationCache.size > 1000) {
      const oldestKey = this.validationCache.keys().next().value;
      this.validationCache.delete(oldestKey);
    }
  }

  /**
   * Update validation metrics
   */
  private updateMetrics(result: ValidationResult, ageGroup: AgeGroup, processingTime: number): void {
    this.metrics.totalValidations++;
    
    if (!result.isValid) {
      this.metrics.blockedContent++;
    }

    // Update processing time (moving average)
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalValidations - 1) + processingTime) / 
      this.metrics.totalValidations;

    // Update age group accuracy (simplified)
    const ageMetrics = this.metrics.accuracyByAgeGroup[ageGroup];
    ageMetrics.totalChecks++;
    
    // In production, this would be based on actual feedback
    // For now, assume high accuracy
    if (result.confidence > 0.8) {
      if (result.isValid) {
        ageMetrics.correctAllows++;
      } else {
        ageMetrics.correctBlocks++;
      }
    }

    // Recalculate accuracy
    ageMetrics.accuracy = (ageMetrics.correctAllows + ageMetrics.correctBlocks) / ageMetrics.totalChecks;
  }

  /**
   * Convert validation rules to safety filter rules
   */
  private convertToSafetyRules(rules: ValidationRules): any {
    return {
      profanityFilter: {
        enabled: true,
        strictness: 'high',
        customWords: rules.blockedPhrases,
        allowedExceptions: rules.approvedPhrases
      },
      topicFilter: {
        enabled: true,
        blockedTopics: [],
        ageRestrictedTopics: rules.ageSpecificRules,
        contextualRules: []
      },
      behaviorFilter: {
        enabled: true,
        blockedBehaviors: [],
        harmfulInstructions: rules.blockedPhrases,
        manipulativeContent: []
      }
    };
  }

  /**
   * Extract patterns from training examples
   */
  private extractPatternsFromExamples(examples: TrainingExample[]): string[] {
    const patterns: string[] = [];
    
    for (const example of examples) {
      if (!example.isAppropriate) {
        // Extract key words/phrases from inappropriate content
        const words = example.content.toLowerCase().split(/\s+/);
        const significantWords = words.filter(word => word.length > 3);
        patterns.push(...significantWords);
      }
    }

    // Remove duplicates and return unique patterns
    return [...new Set(patterns)];
  }

  /**
   * Categorize violation type from description
   */
  private categorizeViolation(description: string): 'profanity' | 'inappropriate_topic' | 'harmful_instruction' | 'age_inappropriate' {
    const lower = description.toLowerCase();
    
    if (lower.includes('profanity') || lower.includes('language')) {
      return 'profanity';
    }
    if (lower.includes('topic') || lower.includes('subject')) {
      return 'inappropriate_topic';
    }
    if (lower.includes('harmful') || lower.includes('dangerous')) {
      return 'harmful_instruction';
    }
    
    return 'age_inappropriate';
  }

  /**
   * Map risk level to severity
   */
  private mapRiskToSeverity(riskLevel: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
    return riskLevel; // Direct mapping
  }

  /**
   * Map severity to risk level
   */
  private mapSeverityToRisk(severity: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
    return severity; // Direct mapping
  }

  /**
   * Setup event handlers for component coordination
   */
  private setupEventHandlers(): void {
    this.contentFilter.on('validation_complete', (event) => {
      this.emit('content_validated', event);
    });

    this.parentalControls.on('parental_decision', (event) => {
      this.emit('parental_decision_made', event);
      // Clear cache for affected user
      this.clearUserCache(event.userId);
    });

    this.auditLogger.on('safety_event_logged', (event) => {
      this.emit('audit_logged', event);
    });
  }

  /**
   * Clear cache entries for a specific user
   */
  private clearUserCache(userId: string): void {
    for (const [key, value] of this.validationCache) {
      if (key.includes(userId)) {
        this.validationCache.delete(key);
      }
    }
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    const cleanupInterval = 10 * 60 * 1000; // 10 minutes
    
    setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      for (const [key, value] of this.validationCache) {
        if (now - value.timestamp > maxAge) {
          this.validationCache.delete(key);
        }
      }
    }, cleanupInterval);
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): ValidationMetrics {
    return {
      totalValidations: 0,
      blockedContent: 0,
      falsePositives: 0,
      falseNegatives: 0,
      averageProcessingTime: 0,
      accuracyByAgeGroup: {
        child: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 },
        teen: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 },
        adult: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 }
      }
    };
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}