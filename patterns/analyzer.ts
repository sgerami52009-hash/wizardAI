// Enhanced Pattern Analyzer Implementation with Multi-Dimensional Recognition

import { EventEmitter } from 'events';
import { 
  PatternAnalyzer, 
  PatternAnalysisResult, 
  UserPreferences, 
  HabitPattern, 
  PatternFeedback, 
  PatternInsights,
  PreferenceDomain,
  TimeWindow,
  IdentifiedPattern,
  InferredPreference,
  DetectedHabit,
  ContextualFactor,
  ConfidenceScore,
  PreferenceType,
  HabitType,
  ContextualFactorType,
  PatternFeedbackType,
  FrequencyType,
  TimeUnit,
  PreferenceSource,
  PreferenceValueType
} from './types';
import { FilteredInteraction } from '../privacy/types';
import { 
  IdentifiedPattern as LearningPattern,
  PatternType,
  TemporalContext,
  EnvironmentalContext,
  SocialContext,
  DeviceContext,
  TimeOfDay,
  DayOfWeek
} from '../learning/types';

/**
 * Enhanced PatternAnalyzer with multi-dimensional pattern recognition capabilities.
 * Implements temporal, contextual, and behavioral pattern detection with preference inference
 * and habit detection algorithms optimized for Jetson Nano Orin constraints.
 */
export class EnhancedPatternAnalyzer implements PatternAnalyzer {
  private eventBus: EventEmitter;
  private patternCache: Map<string, IdentifiedPattern[]> = new Map();
  private preferenceCache: Map<string, Map<PreferenceDomain, UserPreferences>> = new Map();
  private habitCache: Map<string, HabitPattern[]> = new Map();
  private feedbackHistory: Map<string, PatternFeedback[]> = new Map();
  
  // Pattern recognition thresholds
  private readonly PATTERN_STRENGTH_THRESHOLD = 0.6;
  private readonly HABIT_FREQUENCY_THRESHOLD = 3;
  private readonly PREFERENCE_CONFIDENCE_THRESHOLD = 0.7;
  private readonly CONTEXTUAL_CORRELATION_THRESHOLD = 0.5;

  // Memory optimization settings for Jetson Nano Orin
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes

  constructor(eventBus?: EventEmitter) {
    this.eventBus = eventBus || new EventEmitter();
    this.setupCacheCleanup();
  }

  /**
   * Analyzes patterns with multi-dimensional recognition across temporal, contextual, and behavioral dimensions
   */
  public async analyzePatterns(interactions: FilteredInteraction[]): Promise<PatternAnalysisResult> {
    if (!interactions || interactions.length === 0) {
      throw new Error('No interactions provided for pattern analysis');
    }

    const userId = interactions[0].userId;
    const startTime = Date.now();

    try {
      // Multi-dimensional pattern identification
      const temporalPatterns = await this.identifyTemporalPatterns(interactions);
      const contextualPatterns = await this.identifyContextualPatterns(interactions);
      const behavioralPatterns = await this.identifyBehavioralPatterns(interactions);
      
      // Combine all patterns
      const allPatterns = [...temporalPatterns, ...contextualPatterns, ...behavioralPatterns];
      
      // Apply pattern correlation analysis
      const correlatedPatterns = await this.analyzePatternCorrelations(allPatterns);
      
      // Infer preferences from identified patterns
      const preferences = await this.inferPreferencesFromPatterns(correlatedPatterns, userId);
      
      // Detect habits from pattern frequency and strength
      const habits = await this.detectHabitsFromPatterns(correlatedPatterns, userId);
      
      // Analyze contextual factors that influence patterns
      const contextualFactors = await this.analyzeContextualFactors(interactions, correlatedPatterns);
      
      // Calculate confidence scores
      const confidence = this.calculateConfidenceScores(correlatedPatterns, preferences, habits, contextualFactors);
      
      // Cache results for performance optimization
      this.cachePatternResults(userId, correlatedPatterns, preferences, habits);
      
      const analysisTime = Date.now() - startTime;
      
      // Emit analytics event
      this.eventBus.emit('pattern:analysis:completed', {
        userId,
        patternCount: correlatedPatterns.length,
        analysisTime,
        confidence: confidence.overall
      });

      return {
        userId,
        patterns: correlatedPatterns,
        preferences,
        habits,
        contextualFactors,
        confidence,
        analysisTimestamp: new Date()
      };

    } catch (error) {
      this.eventBus.emit('pattern:analysis:error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Identifies user preferences within a specific domain using advanced inference algorithms
   */
  public async identifyPreferences(userId: string, domain: PreferenceDomain): Promise<UserPreferences> {
    // Check cache first
    const userPreferences = this.preferenceCache.get(userId);
    if (userPreferences?.has(domain)) {
      const cached = userPreferences.get(domain)!;
      // Return cached if recent (within 1 hour)
      if (Date.now() - cached.lastUpdated.getTime() < 3600000) {
        return cached;
      }
    }

    // Get user patterns for preference inference
    const userPatterns = this.patternCache.get(userId) || [];
    const domainPatterns = userPatterns.filter(pattern => 
      this.isDomainRelevant(pattern, domain)
    );

    const preferences = await this.inferDomainSpecificPreferences(domainPatterns, domain);
    const confidence = this.calculatePreferenceConfidence(preferences, domainPatterns);

    const result: UserPreferences = {
      userId,
      domain,
      preferences,
      confidence,
      lastUpdated: new Date(),
      source: PreferenceSource.INFERRED
    };

    // Cache the result
    this.cacheUserPreferences(userId, domain, result);

    return result;
  }

  /**
   * Detects habits using advanced routine identification logic
   */
  public async detectHabits(userId: string, timeWindow: TimeWindow): Promise<HabitPattern[]> {
    // Check cache first
    const cachedHabits = this.habitCache.get(userId);
    if (cachedHabits && cachedHabits.length > 0) {
      // Filter habits within time window
      return cachedHabits.filter(habit => 
        habit.lastObserved >= timeWindow.start && 
        habit.firstObserved <= timeWindow.end
      );
    }

    const userPatterns = this.patternCache.get(userId) || [];
    
    // Group patterns by similarity for habit detection
    const patternGroups = this.groupSimilarPatterns(userPatterns);
    
    const habits: HabitPattern[] = [];
    
    for (const group of patternGroups) {
      if (group.length >= this.HABIT_FREQUENCY_THRESHOLD) {
        const habit = await this.createHabitFromPatternGroup(group, userId, timeWindow);
        if (habit) {
          habits.push(habit);
        }
      }
    }

    // Cache habits
    this.habitCache.set(userId, habits);

    return habits;
  }

  /**
   * Updates pattern weights based on user feedback
   */
  public async updatePatternWeights(userId: string, feedback: PatternFeedback): Promise<void> {
    // Store feedback history
    const userFeedback = this.feedbackHistory.get(userId) || [];
    userFeedback.push(feedback);
    this.feedbackHistory.set(userId, userFeedback);

    // Update pattern weights based on feedback
    const userPatterns = this.patternCache.get(userId) || [];
    const updatedPatterns = userPatterns.map(pattern => {
      if (pattern.id === feedback.patternId) {
        return this.adjustPatternWeight(pattern, feedback);
      }
      return pattern;
    });

    this.patternCache.set(userId, updatedPatterns);

    // Emit feedback processed event
    this.eventBus.emit('pattern:feedback:processed', {
      userId,
      patternId: feedback.patternId,
      feedbackType: feedback.feedbackType,
      timestamp: new Date()
    });
  }

  /**
   * Generates comprehensive pattern insights for user
   */
  public async getPatternInsights(userId: string): Promise<PatternInsights> {
    const userPatterns = this.patternCache.get(userId) || [];
    
    // Categorize patterns by strength
    const strongPatterns = userPatterns.filter(p => p.strength >= 0.8);
    const emergingPatterns = userPatterns.filter(p => 
      p.strength >= 0.5 && p.strength < 0.8 && 
      this.isRecentPattern(p)
    );
    const fadingPatterns = userPatterns.filter(p => 
      p.strength < 0.5 && 
      this.isOldPattern(p)
    );

    // Generate recommendations based on patterns
    const recommendations = await this.generatePatternRecommendations(userPatterns, userId);

    return {
      userId,
      totalPatterns: userPatterns.length,
      strongPatterns,
      emergingPatterns,
      fadingPatterns,
      recommendations,
      generatedAt: new Date()
    };
  }

  // Private implementation methods

  private setupCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCaches();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  private cleanupCaches(): void {
    // Clean up pattern cache if it exceeds max size
    if (this.patternCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.patternCache.entries());
      entries.sort((a, b) => {
        const aLastAccess = Math.max(...a[1].map(p => p.lastObserved.getTime()));
        const bLastAccess = Math.max(...b[1].map(p => p.lastObserved.getTime()));
        return aLastAccess - bLastAccess;
      });
      
      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.patternCache.delete(entries[i][0]);
      }
    }

    // Similar cleanup for other caches
    this.cleanupPreferenceCache();
    this.cleanupHabitCache();
  }

  private cleanupPreferenceCache(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    for (const [userId, preferences] of this.preferenceCache) {
      for (const [domain, pref] of preferences) {
        if (pref.lastUpdated.getTime() < cutoffTime) {
          preferences.delete(domain);
        }
      }
      if (preferences.size === 0) {
        this.preferenceCache.delete(userId);
      }
    }
  }

  private cleanupHabitCache(): void {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    for (const [userId, habits] of this.habitCache) {
      const recentHabits = habits.filter(h => h.lastObserved.getTime() >= cutoffTime);
      if (recentHabits.length !== habits.length) {
        this.habitCache.set(userId, recentHabits);
      }
    }
  }

  /**
   * Identifies temporal patterns from interactions (time-based behaviors)
   */
  private async identifyTemporalPatterns(interactions: FilteredInteraction[]): Promise<IdentifiedPattern[]> {
    const temporalMap = new Map<string, {
      timeOfDay: TimeOfDay;
      dayOfWeek: DayOfWeek;
      interactions: FilteredInteraction[];
    }>();

    // Group interactions by temporal context
    interactions.forEach(interaction => {
      const timeKey = `${interaction.context?.timeOfDay || 'unknown'}_${interaction.context?.dayOfWeek || 'unknown'}`;
      if (!temporalMap.has(timeKey)) {
        temporalMap.set(timeKey, {
          timeOfDay: interaction.context?.timeOfDay as TimeOfDay || TimeOfDay.MORNING,
          dayOfWeek: interaction.context?.dayOfWeek as DayOfWeek || DayOfWeek.MONDAY,
          interactions: []
        });
      }
      temporalMap.get(timeKey)!.interactions.push(interaction);
    });

    const patterns: IdentifiedPattern[] = [];

    // Analyze each temporal group for patterns
    for (const [timeKey, group] of temporalMap) {
      if (group.interactions.length >= 2) { // Minimum threshold for pattern
        const strength = Math.min(group.interactions.length / 10, 1.0); // Normalize to 0-1
        const frequency = group.interactions.length;

        patterns.push({
          id: this.generatePatternId('temporal', timeKey),
          type: PatternType.TEMPORAL,
          description: `Regular activity during ${group.timeOfDay} on ${group.dayOfWeek}`,
          frequency,
          strength,
          context: this.extractPatternContext(group.interactions),
          examples: this.createPatternExamples(group.interactions.slice(0, 3)),
          lastObserved: new Date(Math.max(...group.interactions.map(i => i.timestamp.getTime())))
        });
      }
    }

    return patterns.filter(p => p.strength >= this.PATTERN_STRENGTH_THRESHOLD);
  }

  /**
   * Identifies contextual patterns from environmental and situational factors
   */
  private async identifyContextualPatterns(interactions: FilteredInteraction[]): Promise<IdentifiedPattern[]> {
    const contextualGroups = new Map<string, FilteredInteraction[]>();

    // Group by contextual similarity
    interactions.forEach(interaction => {
      const contextKey = this.generateContextKey(interaction);
      if (!contextualGroups.has(contextKey)) {
        contextualGroups.set(contextKey, []);
      }
      contextualGroups.get(contextKey)!.push(interaction);
    });

    const patterns: IdentifiedPattern[] = [];

    for (const [contextKey, group] of contextualGroups) {
      if (group.length >= 2) {
        const strength = this.calculateContextualStrength(group);
        const frequency = group.length;

        if (strength >= this.PATTERN_STRENGTH_THRESHOLD) {
          patterns.push({
            id: this.generatePatternId('contextual', contextKey),
            type: PatternType.CONTEXTUAL,
            description: `Contextual behavior pattern: ${contextKey}`,
            frequency,
            strength,
            context: this.extractPatternContext(group),
            examples: this.createPatternExamples(group.slice(0, 3)),
            lastObserved: new Date(Math.max(...group.map(i => i.timestamp.getTime())))
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Identifies behavioral patterns from user actions and outcomes
   */
  private async identifyBehavioralPatterns(interactions: FilteredInteraction[]): Promise<IdentifiedPattern[]> {
    const behaviorMap = new Map<string, FilteredInteraction[]>();

    // Group by behavior type and outcome
    interactions.forEach(interaction => {
      interaction.patterns.forEach(pattern => {
        const behaviorKey = `${pattern.type}_${pattern.strength > 0.5 ? 'positive' : 'negative'}`;
        if (!behaviorMap.has(behaviorKey)) {
          behaviorMap.set(behaviorKey, []);
        }
        behaviorMap.get(behaviorKey)!.push(interaction);
      });
    });

    const patterns: IdentifiedPattern[] = [];

    for (const [behaviorKey, group] of behaviorMap) {
      if (group.length >= 2) {
        const avgStrength = group.reduce((sum, interaction) => {
          const patternStrength = interaction.patterns.reduce((pSum, p) => pSum + p.strength, 0) / interaction.patterns.length;
          return sum + patternStrength;
        }, 0) / group.length;

        if (avgStrength >= this.PATTERN_STRENGTH_THRESHOLD) {
          patterns.push({
            id: this.generatePatternId('behavioral', behaviorKey),
            type: PatternType.BEHAVIORAL,
            description: `Behavioral pattern: ${behaviorKey}`,
            frequency: group.length,
            strength: avgStrength,
            context: this.extractPatternContext(group),
            examples: this.createPatternExamples(group.slice(0, 3)),
            lastObserved: new Date(Math.max(...group.map(i => i.timestamp.getTime())))
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Analyzes correlations between different patterns
   */
  private async analyzePatternCorrelations(patterns: IdentifiedPattern[]): Promise<IdentifiedPattern[]> {
    // For now, return patterns as-is. In a full implementation, this would:
    // 1. Calculate correlation coefficients between patterns
    // 2. Merge highly correlated patterns
    // 3. Adjust pattern strengths based on correlations
    // 4. Identify pattern sequences and dependencies
    
    return patterns.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Infers user preferences from identified patterns
   */
  private async inferPreferencesFromPatterns(patterns: IdentifiedPattern[], userId: string): Promise<InferredPreference[]> {
    const preferences: InferredPreference[] = [];

    // Group patterns by type for preference inference
    const patternsByType = new Map<PatternType, IdentifiedPattern[]>();
    patterns.forEach(pattern => {
      if (!patternsByType.has(pattern.type)) {
        patternsByType.set(pattern.type, []);
      }
      patternsByType.get(pattern.type)!.push(pattern);
    });

    // Infer preferences from each pattern type
    for (const [type, typePatterns] of patternsByType) {
      const strongPatterns = typePatterns.filter(p => p.strength >= this.PREFERENCE_CONFIDENCE_THRESHOLD);
      
      if (strongPatterns.length > 0) {
        const avgStrength = strongPatterns.reduce((sum, p) => sum + p.strength, 0) / strongPatterns.length;
        
        preferences.push({
          preferenceId: this.generatePreferenceId(userId, type),
          type: this.mapPatternTypeToPreferenceType(type),
          value: this.extractPreferenceValue(strongPatterns),
          confidence: avgStrength,
          evidence: this.createPreferenceEvidence(strongPatterns),
          context: this.createPreferenceContext(strongPatterns),
          inferredAt: new Date()
        });
      }
    }

    return preferences;
  }

  /**
   * Detects habits from pattern frequency and consistency
   */
  private async detectHabitsFromPatterns(patterns: IdentifiedPattern[], userId: string): Promise<DetectedHabit[]> {
    const habits: DetectedHabit[] = [];

    // Filter patterns that could be habits (high frequency and strength)
    const habitCandidates = patterns.filter(pattern => 
      pattern.frequency >= this.HABIT_FREQUENCY_THRESHOLD && 
      pattern.strength >= this.PATTERN_STRENGTH_THRESHOLD
    );

    for (const pattern of habitCandidates) {
      const predictability = this.calculateHabitPredictability(pattern);
      
      if (predictability >= 0.6) { // Threshold for habit classification
        habits.push({
          habitId: this.generateHabitId(userId, pattern.type),
          type: this.mapPatternTypeToHabitType(pattern.type),
          description: `Habitual ${pattern.description.toLowerCase()}`,
          strength: pattern.strength,
          frequency: pattern.frequency,
          context: this.createHabitContext(pattern),
          predictability,
          lastOccurrence: pattern.lastObserved
        });
      }
    }

    return habits;
  }

  /**
   * Analyzes contextual factors that influence patterns
   */
  private async analyzeContextualFactors(interactions: FilteredInteraction[], patterns: IdentifiedPattern[]): Promise<ContextualFactor[]> {
    const factors: ContextualFactor[] = [];

    // Analyze temporal factors
    const temporalInfluence = this.calculateTemporalInfluence(interactions);
    if (temporalInfluence > this.CONTEXTUAL_CORRELATION_THRESHOLD) {
      factors.push({
        factorId: this.generateFactorId('temporal'),
        type: ContextualFactorType.TEMPORAL,
        influence: temporalInfluence,
        description: 'Time-based patterns significantly influence user behavior',
        examples: this.extractTemporalExamples(patterns),
        correlations: []
      });
    }

    // Analyze environmental factors
    const environmentalInfluence = this.calculateEnvironmentalInfluence(interactions);
    if (environmentalInfluence > this.CONTEXTUAL_CORRELATION_THRESHOLD) {
      factors.push({
        factorId: this.generateFactorId('environmental'),
        type: ContextualFactorType.ENVIRONMENTAL,
        influence: environmentalInfluence,
        description: 'Environmental conditions affect interaction patterns',
        examples: this.extractEnvironmentalExamples(patterns),
        correlations: []
      });
    }

    // Analyze social factors
    const socialInfluence = this.calculateSocialInfluence(interactions);
    if (socialInfluence > this.CONTEXTUAL_CORRELATION_THRESHOLD) {
      factors.push({
        factorId: this.generateFactorId('social'),
        type: ContextualFactorType.SOCIAL,
        influence: socialInfluence,
        description: 'Social context influences user interaction patterns',
        examples: this.extractSocialExamples(patterns),
        correlations: []
      });
    }

    return factors;
  }

  /**
   * Calculates comprehensive confidence scores
   */
  private calculateConfidenceScores(
    patterns: IdentifiedPattern[], 
    preferences: InferredPreference[], 
    habits: DetectedHabit[], 
    factors: ContextualFactor[]
  ): ConfidenceScore {
    const patternConfidence = patterns.length > 0 ? 
      patterns.reduce((sum, p) => sum + p.strength, 0) / patterns.length : 0;
    
    const preferenceConfidence = preferences.length > 0 ? 
      preferences.reduce((sum, p) => sum + p.confidence, 0) / preferences.length : 0;
    
    const habitConfidence = habits.length > 0 ? 
      habits.reduce((sum, h) => sum + h.predictability, 0) / habits.length : 0;
    
    const contextualConfidence = factors.length > 0 ? 
      factors.reduce((sum, f) => sum + f.influence, 0) / factors.length : 0;

    const overall = (patternConfidence + preferenceConfidence + habitConfidence + contextualConfidence) / 4;

    return {
      overall,
      patternRecognition: patternConfidence,
      preferenceInference: preferenceConfidence,
      habitDetection: habitConfidence,
      contextualAnalysis: contextualConfidence
    };
  }

  // Helper methods for pattern analysis

  private generateContextKey(interaction: FilteredInteraction): string {
    const context = interaction.context;
    return `${context?.deviceType || 'unknown'}_${context?.timeOfDay || 'unknown'}_${context?.environmentalFactors?.location?.room || 'unknown'}`;
  }

  private calculateContextualStrength(interactions: FilteredInteraction[]): number {
    if (interactions.length === 0) return 0;
    
    // Calculate strength based on consistency and frequency
    const avgPatternStrength = interactions.reduce((sum, interaction) => {
      const patternStrength = interaction.patterns.reduce((pSum, p) => pSum + p.strength, 0) / Math.max(interaction.patterns.length, 1);
      return sum + patternStrength;
    }, 0) / interactions.length;

    const frequencyBonus = Math.min(interactions.length / 10, 0.3); // Up to 30% bonus for frequency
    
    return Math.min(avgPatternStrength + frequencyBonus, 1.0);
  }

  private extractPatternContext(interactions: FilteredInteraction[]): any {
    if (interactions.length === 0) {
      return { temporal: {}, environmental: {}, social: {}, device: {} };
    }

    const firstInteraction = interactions[0];
    return {
      temporal: {
        timeOfDay: firstInteraction.context?.timeOfDay || TimeOfDay.MORNING,
        dayOfWeek: firstInteraction.context?.dayOfWeek || DayOfWeek.MONDAY,
        season: 'spring',
        isHoliday: false,
        timeZone: 'UTC',
        relativeToSchedule: 'free_time'
      },
      environmental: firstInteraction.context?.environmentalFactors || {
        location: { room: 'unknown', building: 'home', city: 'unknown', isHome: true, isWork: false, isPublic: false },
        weather: { condition: 'sunny', temperature: 22, humidity: 50, isRaining: false },
        lighting: { brightness: 50, isNatural: true, colorTemperature: 5000 },
        noise: { level: 30, type: 'quiet', isDistracting: false },
        temperature: 22
      },
      social: {
        presentUsers: [],
        familyMembers: [],
        guestPresent: false,
        socialActivity: 'alone'
      },
      device: {
        deviceType: firstInteraction.context?.deviceType || 'smart_display',
        screenSize: 'medium',
        inputMethod: 'voice',
        connectivity: 'online'
      }
    };
  }

  private createPatternExamples(interactions: FilteredInteraction[]): any[] {
    return interactions.map(interaction => ({
      timestamp: interaction.timestamp,
      context: `${interaction.context?.timeOfDay || 'unknown'} interaction`,
      outcome: 'Successful interaction',
      confidence: 0.8
    }));
  }

  private generatePatternId(type: string, key: string): string {
    return `pattern_${type}_${key}_${Date.now()}`;
  }

  private generatePreferenceId(userId: string, type: PatternType): string {
    return `pref_${userId}_${type}_${Date.now()}`;
  }

  private generateHabitId(userId: string, type: PatternType): string {
    return `habit_${userId}_${type}_${Date.now()}`;
  }

  private generateFactorId(type: string): string {
    return `factor_${type}_${Date.now()}`;
  }

  private mapPatternTypeToPreferenceType(patternType: PatternType): PreferenceType {
    switch (patternType) {
      case PatternType.TEMPORAL:
        return PreferenceType.TEMPORAL;
      case PatternType.CONTEXTUAL:
        return PreferenceType.CONTEXTUAL;
      case PatternType.BEHAVIORAL:
        return PreferenceType.CATEGORICAL;
      default:
        return PreferenceType.CATEGORICAL;
    }
  }

  private mapPatternTypeToHabitType(patternType: PatternType): HabitType {
    switch (patternType) {
      case PatternType.TEMPORAL:
        return HabitType.ROUTINE;
      case PatternType.BEHAVIORAL:
        return HabitType.BEHAVIORAL;
      default:
        return HabitType.ROUTINE;
    }
  }

  private extractPreferenceValue(patterns: IdentifiedPattern[]): any {
    // Extract the most common pattern characteristic as preference value
    const values = patterns.map(p => p.type);
    const valueCount = new Map();
    values.forEach(v => valueCount.set(v, (valueCount.get(v) || 0) + 1));
    
    let maxCount = 0;
    let mostCommon = values[0];
    for (const [value, count] of valueCount) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }
    
    return mostCommon;
  }

  private createPreferenceEvidence(patterns: IdentifiedPattern[]): any[] {
    return patterns.slice(0, 3).map(pattern => ({
      evidenceId: `evidence_${pattern.id}`,
      type: 'behavioral',
      strength: pattern.strength,
      description: pattern.description,
      timestamp: pattern.lastObserved,
      context: {
        source: 'pattern_analysis',
        reliability: pattern.strength,
        recency: this.calculateRecency(pattern.lastObserved),
        relevance: 0.8,
        consistency: pattern.frequency / 10
      }
    }));
  }

  private createPreferenceContext(patterns: IdentifiedPattern[]): any {
    return {
      domain: 'interaction',
      scope: 'contextual',
      conditions: [],
      exceptions: []
    };
  }

  private calculateHabitPredictability(pattern: IdentifiedPattern): number {
    // Calculate predictability based on frequency and strength
    const frequencyScore = Math.min(pattern.frequency / 10, 1.0);
    const strengthScore = pattern.strength;
    const consistencyScore = this.calculatePatternConsistency(pattern);
    
    return (frequencyScore + strengthScore + consistencyScore) / 3;
  }

  private calculatePatternConsistency(pattern: IdentifiedPattern): number {
    // For now, use strength as a proxy for consistency
    // In a full implementation, this would analyze the variance in pattern occurrences
    return pattern.strength;
  }

  private createHabitContext(pattern: IdentifiedPattern): any {
    return {
      temporal: pattern.context.temporal,
      environmental: pattern.context.environmental,
      social: pattern.context.social,
      emotional: {
        mood: 'neutral',
        energy: 'moderate',
        stress: 'calm',
        engagement: 'moderate',
        satisfaction: 'satisfied'
      },
      situational: {
        situation: 'routine',
        urgency: 'low',
        complexity: 'simple',
        novelty: 'familiar',
        constraints: []
      }
    };
  }

  private calculateTemporalInfluence(interactions: FilteredInteraction[]): number {
    const timeGroups = new Map();
    interactions.forEach(interaction => {
      const timeKey = interaction.context?.timeOfDay || 'unknown';
      timeGroups.set(timeKey, (timeGroups.get(timeKey) || 0) + 1);
    });
    
    // Calculate variance in temporal distribution
    const values = Array.from(timeGroups.values());
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Higher variance indicates stronger temporal influence
    return Math.min(variance / mean, 1.0);
  }

  private calculateEnvironmentalInfluence(interactions: FilteredInteraction[]): number {
    // Simplified calculation - in practice would analyze environmental context correlation
    return 0.6;
  }

  private calculateSocialInfluence(interactions: FilteredInteraction[]): number {
    // Simplified calculation - in practice would analyze social context patterns
    return 0.5;
  }

  private extractTemporalExamples(patterns: IdentifiedPattern[]): string[] {
    return patterns
      .filter(p => p.type === PatternType.TEMPORAL)
      .slice(0, 3)
      .map(p => p.description);
  }

  private extractEnvironmentalExamples(patterns: IdentifiedPattern[]): string[] {
    return patterns
      .filter(p => p.type === PatternType.CONTEXTUAL)
      .slice(0, 3)
      .map(p => p.description);
  }

  private extractSocialExamples(patterns: IdentifiedPattern[]): string[] {
    return ['Family interaction patterns', 'Guest presence effects', 'Social activity preferences'];
  }

  private calculateRecency(date: Date): number {
    const daysSince = (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - (daysSince / 30)); // Decay over 30 days
  }

  private cachePatternResults(userId: string, patterns: IdentifiedPattern[], preferences: InferredPreference[], habits: DetectedHabit[]): void {
    this.patternCache.set(userId, patterns);
    
    // Cache preferences by domain
    if (!this.preferenceCache.has(userId)) {
      this.preferenceCache.set(userId, new Map());
    }
    
    // Cache habits
    const existingHabits = this.habitCache.get(userId) || [];
    const mergedHabits = this.mergeHabits(existingHabits, habits);
    this.habitCache.set(userId, mergedHabits);
  }

  private mergeHabits(existing: HabitPattern[], newHabits: DetectedHabit[]): HabitPattern[] {
    const merged = [...existing];
    
    newHabits.forEach(newHabit => {
      const existingIndex = merged.findIndex(h => 
        h.type === newHabit.type && 
        this.isSimilarHabitContext(h.context, newHabit.context)
      );
      
      if (existingIndex >= 0) {
        // Update existing habit
        merged[existingIndex] = {
          ...merged[existingIndex],
          strength: Math.max(merged[existingIndex].strength, newHabit.strength),
          frequency: {
            ...merged[existingIndex].frequency,
            interval: merged[existingIndex].frequency.interval + newHabit.frequency
          },
          lastObserved: newHabit.lastOccurrence
        };
      } else {
        // Add new habit
        merged.push({
          habitId: newHabit.habitId,
          userId: '', // Will be set by caller
          type: newHabit.type,
          description: newHabit.description,
          frequency: {
            type: FrequencyType.REGULAR,
            interval: 1,
            timeUnit: TimeUnit.DAY,
            regularity: newHabit.predictability,
            exceptions: []
          },
          strength: newHabit.strength,
          context: newHabit.context,
          triggers: [],
          outcomes: [],
          firstObserved: newHabit.lastOccurrence,
          lastObserved: newHabit.lastOccurrence
        });
      }
    });
    
    return merged;
  }

  private isSimilarHabitContext(context1: any, context2: any): boolean {
    // Simple similarity check - in practice would be more sophisticated
    return context1.temporal?.timeOfDay === context2.temporal?.timeOfDay;
  }

  private cacheUserPreferences(userId: string, domain: PreferenceDomain, preferences: UserPreferences): void {
    if (!this.preferenceCache.has(userId)) {
      this.preferenceCache.set(userId, new Map());
    }
    this.preferenceCache.get(userId)!.set(domain, preferences);
  }

  private isDomainRelevant(pattern: IdentifiedPattern, domain: PreferenceDomain): boolean {
    switch (domain) {
      case PreferenceDomain.COMMUNICATION:
        return pattern.type === PatternType.BEHAVIORAL;
      case PreferenceDomain.SCHEDULING:
        return pattern.type === PatternType.TEMPORAL;
      case PreferenceDomain.INTERACTION:
        return pattern.type === PatternType.CONTEXTUAL;
      default:
        return true;
    }
  }

  private async inferDomainSpecificPreferences(patterns: IdentifiedPattern[], domain: PreferenceDomain): Promise<any[]> {
    const preferences: any[] = [];
    
    patterns.forEach(pattern => {
      preferences.push({
        key: `${domain}_${pattern.type}`,
        value: pattern.description,
        type: PreferenceValueType.STRING,
        confidence: pattern.strength,
        lastUpdated: new Date(),
        source: PreferenceSource.INFERRED
      });
    });
    
    return preferences;
  }

  private calculatePreferenceConfidence(preferences: any[], patterns: IdentifiedPattern[]): number {
    if (preferences.length === 0) return 0;
    
    const avgConfidence = preferences.reduce((sum, p) => sum + p.confidence, 0) / preferences.length;
    const patternSupport = Math.min(patterns.length / 5, 1.0); // Bonus for more supporting patterns
    
    return Math.min(avgConfidence + (patternSupport * 0.2), 1.0);
  }

  private groupSimilarPatterns(patterns: IdentifiedPattern[]): IdentifiedPattern[][] {
    const groups: IdentifiedPattern[][] = [];
    const used = new Set<string>();
    
    patterns.forEach(pattern => {
      if (used.has(pattern.id)) return;
      
      const group = [pattern];
      used.add(pattern.id);
      
      // Find similar patterns
      patterns.forEach(otherPattern => {
        if (used.has(otherPattern.id)) return;
        
        if (this.arePatternsGroupable(pattern, otherPattern)) {
          group.push(otherPattern);
          used.add(otherPattern.id);
        }
      });
      
      groups.push(group);
    });
    
    return groups;
  }

  private arePatternsGroupable(pattern1: IdentifiedPattern, pattern2: IdentifiedPattern): boolean {
    // Group patterns of same type with similar context
    return pattern1.type === pattern2.type && 
           this.isSimilarContext(pattern1.context, pattern2.context);
  }

  private isSimilarContext(context1: any, context2: any): boolean {
    // Simple context similarity check
    return context1.temporal?.timeOfDay === context2.temporal?.timeOfDay ||
           context1.device?.deviceType === context2.device?.deviceType;
  }

  private async createHabitFromPatternGroup(group: IdentifiedPattern[], userId: string, timeWindow: TimeWindow): Promise<HabitPattern | null> {
    if (group.length < this.HABIT_FREQUENCY_THRESHOLD) return null;
    
    const avgStrength = group.reduce((sum, p) => sum + p.strength, 0) / group.length;
    
    const firstObserved = new Date(Math.min(...group.map(p => p.lastObserved.getTime())));
    const lastObserved = new Date(Math.max(...group.map(p => p.lastObserved.getTime())));
    
    return {
      habitId: this.generateHabitId(userId, group[0].type),
      userId,
      type: this.mapPatternTypeToHabitType(group[0].type),
      description: `Habitual ${group[0].description.toLowerCase()}`,
      frequency: {
        type: FrequencyType.REGULAR,
        interval: this.calculateHabitInterval(group),
        timeUnit: TimeUnit.DAY,
        regularity: avgStrength,
        exceptions: []
      },
      strength: avgStrength,
      context: this.createHabitContext(group[0]),
      triggers: [],
      outcomes: [],
      firstObserved,
      lastObserved
    };
  }

  private calculateHabitInterval(patterns: IdentifiedPattern[]): number {
    // Calculate average interval between pattern occurrences
    if (patterns.length < 2) return 1;
    
    const timestamps = patterns.map(p => p.lastObserved.getTime()).sort();
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      const interval = (timestamps[i] - timestamps[i-1]) / (24 * 60 * 60 * 1000); // Days
      intervals.push(interval);
    }
    
    return Math.round(intervals.reduce((sum, i) => sum + i, 0) / intervals.length) || 1;
  }

  private adjustPatternWeight(pattern: IdentifiedPattern, feedback: PatternFeedback): IdentifiedPattern {
    let strengthAdjustment = 0;
    
    switch (feedback.feedbackType) {
      case PatternFeedbackType.CONFIRMATION:
        strengthAdjustment = 0.1;
        break;
      case PatternFeedbackType.CORRECTION:
        strengthAdjustment = -0.2;
        break;
      case PatternFeedbackType.ENHANCEMENT:
        strengthAdjustment = 0.05;
        break;
      case PatternFeedbackType.REJECTION:
        strengthAdjustment = -0.3;
        break;
    }
    
    // Apply feedback accuracy and relevance weights
    const feedbackWeight = (feedback.accuracy + feedback.relevance) / 2;
    strengthAdjustment *= feedbackWeight;
    
    return {
      ...pattern,
      strength: Math.max(0, Math.min(1, pattern.strength + strengthAdjustment))
    };
  }

  private isRecentPattern(pattern: IdentifiedPattern): boolean {
    const daysSince = (Date.now() - pattern.lastObserved.getTime()) / (24 * 60 * 60 * 1000);
    return daysSince <= 7; // Pattern observed within last week
  }

  private isOldPattern(pattern: IdentifiedPattern): boolean {
    const daysSince = (Date.now() - pattern.lastObserved.getTime()) / (24 * 60 * 60 * 1000);
    return daysSince > 30; // Pattern not observed in over a month
  }

  private async generatePatternRecommendations(patterns: IdentifiedPattern[], userId: string): Promise<any[]> {
    const recommendations: any[] = [];
    
    // Recommend based on strong patterns
    const strongPatterns = patterns.filter(p => p.strength >= 0.8);
    if (strongPatterns.length > 0) {
      recommendations.push({
        recommendationId: `rec_strong_${userId}_${Date.now()}`,
        type: 'optimization',
        description: 'Leverage strong behavioral patterns for better personalization',
        priority: 'high',
        expectedBenefit: 'Improved user experience through pattern-based optimization',
        implementation: ['Enhance pattern-based recommendations', 'Optimize timing based on strong patterns']
      });
    }
    
    // Recommend based on emerging patterns
    const emergingPatterns = patterns.filter(p => this.isRecentPattern(p) && p.strength >= 0.6);
    if (emergingPatterns.length > 0) {
      recommendations.push({
        recommendationId: `rec_emerging_${userId}_${Date.now()}`,
        type: 'exploration',
        description: 'Monitor and nurture emerging behavioral patterns',
        priority: 'medium',
        expectedBenefit: 'Early adaptation to changing user preferences',
        implementation: ['Increase monitoring of emerging patterns', 'Provide gentle reinforcement']
      });
    }
    
    return recommendations;
  }
}

// Export the enhanced analyzer as default
export { EnhancedPatternAnalyzer as DefaultPatternAnalyzer };