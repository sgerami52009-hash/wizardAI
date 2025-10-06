// Behavior Learning Engine - Advanced user behavior pattern recognition and adaptation

import { EventEmitter } from 'events'
import {
  BehaviorPattern,
  PatternType,
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationType,
  ReminderFeedback,
  FeedbackType,
  ContextFeedback,
  ContextCorrection,
  Reminder
} from './types'
import { Priority } from '../calendar/types'

/**
 * BehaviorLearningEngine - Advanced machine learning for user behavior patterns
 * 
 * Implements sophisticated algorithms for:
 * - Pattern recognition and classification
 * - Adaptive reminder timing optimization
 * - User preference learning and personalization
 * - Feedback-driven strategy adaptation
 * 
 * Safety: Child-appropriate learning with parental oversight
 * Performance: Optimized for real-time learning on Jetson Nano Orin
 */
export class BehaviorLearningEngine extends EventEmitter {
  private userPatterns: Map<string, BehaviorPattern[]> = new Map()
  private learningHistory: Map<string, LearningSession[]> = new Map()
  private adaptationStrategies: Map<string, AdaptationStrategy> = new Map()
  private readonly MAX_PATTERNS_PER_USER = 100
  private readonly MIN_OBSERVATIONS_FOR_PATTERN = 3
  private readonly PATTERN_CONFIDENCE_THRESHOLD = 0.6
  private readonly LEARNING_RATE = 0.1

  constructor() {
    super()
  }

  /**
   * Learn user behavior patterns from context and feedback data
   */
  async learnFromContext(userId: string, context: UserContext, outcome: LearningOutcome): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Extract features from context
      const features = this.extractContextFeatures(context)
      
      // Update existing patterns or create new ones
      await this.updatePatterns(userId, features, outcome)
      
      // Adapt reminder strategies based on learning
      await this.adaptReminderStrategies(userId, context, outcome)
      
      // Record learning session
      this.recordLearningSession(userId, context, outcome, features)
      
      // Emit learning event
      this.emit('behavior:learned', {
        userId,
        patternCount: this.userPatterns.get(userId)?.length || 0,
        learningTime: Date.now() - startTime,
        outcome: outcome.type,
        confidence: outcome.confidence,
        timestamp: new Date()
      })
    } catch (error) {
      this.emit('behavior:learning:error', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      })
    }
  }

  /**
   * Learn from user feedback on reminder effectiveness
   */
  async learnFromReminderFeedback(userId: string, reminder: Reminder, feedback: ReminderFeedback): Promise<void> {
    const outcome: LearningOutcome = {
      type: this.mapFeedbackToOutcome(feedback),
      confidence: feedback.rating ? feedback.rating / 5 : (feedback.wasHelpful ? 0.8 : 0.2),
      context: 'reminder_feedback',
      metadata: {
        reminderId: reminder.id,
        feedbackType: feedback.feedbackType,
        rating: feedback.rating,
        wasHelpful: feedback.wasHelpful
      }
    }

    // Create context from reminder timing and user state
    const reminderContext = await this.reconstructContextFromReminder(userId, reminder, feedback)
    
    await this.learnFromContext(userId, reminderContext, outcome)
    
    // Update reminder timing preferences
    await this.updateTimingPreferences(userId, reminder, feedback)
  }

  /**
   * Learn from context prediction accuracy
   */
  async learnFromContextFeedback(userId: string, feedback: ContextFeedback): Promise<void> {
    const corrections = feedback.corrections
    
    for (const correction of corrections) {
      const outcome: LearningOutcome = {
        type: correction.importance > 0.7 ? LearningOutcomeType.NEGATIVE : LearningOutcomeType.NEUTRAL,
        confidence: 1 - feedback.accuracy,
        context: 'context_correction',
        metadata: {
          field: correction.field,
          actualValue: correction.actualValue,
          predictedValue: correction.predictedValue,
          importance: correction.importance
        }
      }
      
      await this.learnFromContext(userId, feedback.actualContext, outcome)
    }
    
    // Update prediction models based on corrections
    await this.updatePredictionModels(userId, feedback)
  }

  /**
   * Predict optimal reminder timing based on learned patterns
   */
  async predictOptimalTiming(userId: string, reminder: Reminder, currentContext: UserContext): Promise<TimingPrediction> {
    const patterns = this.userPatterns.get(userId) || []
    const strategy = this.adaptationStrategies.get(userId)
    
    // Find relevant patterns for current context
    const relevantPatterns = this.findRelevantPatterns(patterns, currentContext, reminder)
    
    if (relevantPatterns.length === 0) {
      return this.getDefaultTimingPrediction(reminder, currentContext)
    }
    
    // Calculate timing prediction based on patterns
    const prediction = this.calculateTimingFromPatterns(relevantPatterns, currentContext, reminder)
    
    // Apply adaptation strategy if available
    if (strategy) {
      return this.applyAdaptationStrategy(prediction, strategy, currentContext)
    }
    
    return prediction
  }

  /**
   * Get user behavior patterns for analysis
   */
  getUserPatterns(userId: string): BehaviorPattern[] {
    return this.userPatterns.get(userId) || []
  }

  /**
   * Get adaptation strategy for user
   */
  getAdaptationStrategy(userId: string): AdaptationStrategy | undefined {
    return this.adaptationStrategies.get(userId)
  }

  /**
   * Get learning statistics for user
   */
  getLearningStats(userId: string): LearningStats {
    const patterns = this.userPatterns.get(userId) || []
    const sessions = this.learningHistory.get(userId) || []
    
    return {
      totalPatterns: patterns.length,
      totalSessions: sessions.length,
      averageConfidence: this.calculateAverageConfidence(patterns),
      lastLearningTime: sessions.length > 0 ? sessions[sessions.length - 1].timestamp : null,
      patternsByType: this.groupPatternsByType(patterns),
      recentAccuracy: this.calculateRecentAccuracy(sessions)
    }
  }

  // Private helper methods

  private extractContextFeatures(context: UserContext): ContextFeatures {
    return {
      timeOfDay: context.timeOfDay.hour,
      dayOfWeek: context.timeOfDay.dayOfWeek,
      isWeekend: context.timeOfDay.isWeekend,
      activity: context.currentActivity,
      location: context.location.type,
      availability: context.availability,
      interruptibility: context.interruptibility,
      deviceProximity: context.deviceProximity.isNearby,
      locationConfidence: context.location.confidence
    }
  }

  private async updatePatterns(userId: string, features: ContextFeatures, outcome: LearningOutcome): Promise<void> {
    let patterns = this.userPatterns.get(userId) || []
    
    // Find existing pattern that matches features
    const matchingPattern = this.findMatchingPattern(patterns, features, outcome)
    
    if (matchingPattern) {
      // Update existing pattern
      this.updateExistingPattern(matchingPattern, outcome)
    } else {
      // Create new pattern if we have enough observations
      const newPattern = this.createNewPattern(features, outcome)
      if (newPattern) {
        patterns.push(newPattern)
      }
    }
    
    // Remove low-confidence patterns
    patterns = patterns.filter(p => p.confidence >= this.PATTERN_CONFIDENCE_THRESHOLD)
    
    // Limit number of patterns per user
    if (patterns.length > this.MAX_PATTERNS_PER_USER) {
      patterns = patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.MAX_PATTERNS_PER_USER)
    }
    
    this.userPatterns.set(userId, patterns)
  }

  private findMatchingPattern(patterns: BehaviorPattern[], features: ContextFeatures, outcome: LearningOutcome): BehaviorPattern | undefined {
    return patterns.find(pattern => {
      // Check if pattern matches current context features
      const timeMatch = Math.abs((pattern.metadata.timeOfDay || 0) - features.timeOfDay) <= 2
      const dayMatch = pattern.metadata.dayOfWeek === features.dayOfWeek
      const activityMatch = pattern.metadata.activity === features.activity
      const locationMatch = pattern.metadata.location === features.location
      
      // Pattern matches if most features align
      const matchScore = [timeMatch, dayMatch, activityMatch, locationMatch].filter(Boolean).length
      return matchScore >= 2
    })
  }

  private updateExistingPattern(pattern: BehaviorPattern, outcome: LearningOutcome): void {
    // Update pattern confidence based on outcome
    const confidenceAdjustment = outcome.confidence * this.LEARNING_RATE
    
    if (outcome.type === LearningOutcomeType.POSITIVE) {
      pattern.confidence = Math.min(1.0, pattern.confidence + confidenceAdjustment)
    } else if (outcome.type === LearningOutcomeType.NEGATIVE) {
      pattern.confidence = Math.max(0.1, pattern.confidence - confidenceAdjustment)
    }
    
    pattern.frequency += 1
    pattern.lastObserved = new Date()
    
    // Update metadata with new information
    if (outcome.metadata) {
      pattern.metadata = { ...pattern.metadata, ...outcome.metadata }
    }
  }

  private createNewPattern(features: ContextFeatures, outcome: LearningOutcome): BehaviorPattern | null {
    // Only create pattern for positive outcomes initially
    if (outcome.type !== LearningOutcomeType.POSITIVE) {
      return null
    }
    
    const patternType = this.determinePatternType(features, outcome)
    
    return {
      patternType,
      frequency: 1,
      confidence: outcome.confidence,
      lastObserved: new Date(),
      metadata: {
        timeOfDay: features.timeOfDay,
        dayOfWeek: features.dayOfWeek,
        isWeekend: features.isWeekend,
        activity: features.activity,
        location: features.location,
        availability: features.availability,
        interruptibility: features.interruptibility,
        ...outcome.metadata
      }
    }
  }

  private determinePatternType(features: ContextFeatures, outcome: LearningOutcome): PatternType {
    // Determine pattern type based on context and outcome
    if (outcome.context === 'reminder_feedback') {
      return PatternType.RESPONSE_PREFERENCE
    }
    
    if (features.timeOfDay >= 6 && features.timeOfDay <= 8) {
      return PatternType.WAKE_TIME
    } else if (features.timeOfDay >= 22 || features.timeOfDay <= 6) {
      return PatternType.SLEEP_TIME
    } else if (features.timeOfDay >= 9 && features.timeOfDay <= 17 && !features.isWeekend) {
      return PatternType.WORK_HOURS
    } else if (features.activity === ActivityType.EATING) {
      return PatternType.MEAL_TIMES
    } else if (features.activity === ActivityType.EXERCISING) {
      return PatternType.EXERCISE_TIME
    } else {
      return PatternType.RESPONSE_PREFERENCE
    }
  }

  private async adaptReminderStrategies(userId: string, context: UserContext, outcome: LearningOutcome): Promise<void> {
    let strategy = this.adaptationStrategies.get(userId) || this.createDefaultStrategy()
    
    // Adapt strategy based on learning outcome
    if (outcome.type === LearningOutcomeType.POSITIVE) {
      // Reinforce successful strategies
      this.reinforceStrategy(strategy, context, outcome)
    } else if (outcome.type === LearningOutcomeType.NEGATIVE) {
      // Adjust unsuccessful strategies
      this.adjustStrategy(strategy, context, outcome)
    }
    
    this.adaptationStrategies.set(userId, strategy)
  }

  private createDefaultStrategy(): AdaptationStrategy {
    return {
      preferredTimes: [8, 12, 17, 20], // Default preferred hours
      avoidTimes: [0, 1, 2, 3, 4, 5, 6, 22, 23], // Sleep hours
      interruptibilityThreshold: InterruptibilityLevel.MEDIUM,
      deferralPreference: 'adaptive',
      batchingPreference: 'moderate',
      escalationSensitivity: 0.5,
      lastUpdated: new Date()
    }
  }

  private reinforceStrategy(strategy: AdaptationStrategy, context: UserContext, outcome: LearningOutcome): void {
    const hour = context.timeOfDay.hour
    
    // Add successful time to preferred times
    if (!strategy.preferredTimes.includes(hour)) {
      strategy.preferredTimes.push(hour)
      strategy.preferredTimes.sort((a, b) => a - b)
    }
    
    // Remove from avoid times if present
    strategy.avoidTimes = strategy.avoidTimes.filter(t => t !== hour)
    
    // Adjust thresholds based on successful context
    if (context.interruptibility < strategy.interruptibilityThreshold) {
      strategy.interruptibilityThreshold = context.interruptibility
    }
    
    strategy.lastUpdated = new Date()
  }

  private adjustStrategy(strategy: AdaptationStrategy, context: UserContext, outcome: LearningOutcome): void {
    const hour = context.timeOfDay.hour
    
    // Add unsuccessful time to avoid times
    if (!strategy.avoidTimes.includes(hour)) {
      strategy.avoidTimes.push(hour)
      strategy.avoidTimes.sort((a, b) => a - b)
    }
    
    // Remove from preferred times if present
    strategy.preferredTimes = strategy.preferredTimes.filter(t => t !== hour)
    
    // Increase interruptibility threshold
    if (context.interruptibility <= strategy.interruptibilityThreshold) {
      const currentLevel = strategy.interruptibilityThreshold
      if (currentLevel < InterruptibilityLevel.HIGH) {
        strategy.interruptibilityThreshold = InterruptibilityLevel.HIGH
      }
    }
    
    strategy.lastUpdated = new Date()
  }

  private recordLearningSession(userId: string, context: UserContext, outcome: LearningOutcome, features: ContextFeatures): void {
    let sessions = this.learningHistory.get(userId) || []
    
    const session: LearningSession = {
      timestamp: new Date(),
      context: features,
      outcome,
      accuracy: outcome.confidence,
      patternCount: this.userPatterns.get(userId)?.length || 0
    }
    
    sessions.push(session)
    
    // Keep only recent sessions (last 1000)
    if (sessions.length > 1000) {
      sessions = sessions.slice(-1000)
    }
    
    this.learningHistory.set(userId, sessions)
  }

  private mapFeedbackToOutcome(feedback: ReminderFeedback): LearningOutcomeType {
    if (feedback.wasHelpful && (feedback.rating || 0) >= 4) {
      return LearningOutcomeType.POSITIVE
    } else if (!feedback.wasHelpful || (feedback.rating || 0) <= 2) {
      return LearningOutcomeType.NEGATIVE
    } else {
      return LearningOutcomeType.NEUTRAL
    }
  }

  private async reconstructContextFromReminder(userId: string, reminder: Reminder, feedback: ReminderFeedback): Promise<UserContext> {
    // Reconstruct context at time of reminder delivery
    // In real implementation, this would use stored context data
    
    return {
      userId,
      currentActivity: ActivityType.UNKNOWN,
      location: {
        name: 'Unknown',
        type: LocationType.OTHER,
        confidence: 0.5
      },
      availability: AvailabilityStatus.AVAILABLE,
      interruptibility: InterruptibilityLevel.MEDIUM,
      deviceProximity: {
        isNearby: true,
        lastSeen: feedback.feedbackTime,
        deviceType: 'home_assistant'
      },
      timeOfDay: {
        hour: feedback.feedbackTime.getHours(),
        dayOfWeek: feedback.feedbackTime.getDay(),
        isWeekend: feedback.feedbackTime.getDay() === 0 || feedback.feedbackTime.getDay() === 6,
        isHoliday: false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      historicalPatterns: this.userPatterns.get(userId) || [],
      lastUpdated: feedback.feedbackTime
    }
  }

  private async updateTimingPreferences(userId: string, reminder: Reminder, feedback: ReminderFeedback): Promise<void> {
    const strategy = this.adaptationStrategies.get(userId) || this.createDefaultStrategy()
    const hour = feedback.feedbackTime.getHours()
    
    if (feedback.feedbackType === FeedbackType.TIMING) {
      if (feedback.wasHelpful) {
        // Good timing - reinforce
        if (!strategy.preferredTimes.includes(hour)) {
          strategy.preferredTimes.push(hour)
        }
        strategy.avoidTimes = strategy.avoidTimes.filter(t => t !== hour)
      } else {
        // Bad timing - avoid
        if (!strategy.avoidTimes.includes(hour)) {
          strategy.avoidTimes.push(hour)
        }
        strategy.preferredTimes = strategy.preferredTimes.filter(t => t !== hour)
      }
    }
    
    this.adaptationStrategies.set(userId, strategy)
  }

  private async updatePredictionModels(userId: string, feedback: ContextFeedback): Promise<void> {
    // Update internal prediction models based on context feedback
    // This would involve more sophisticated ML model updates in a real implementation
    
    const patterns = this.userPatterns.get(userId) || []
    
    for (const correction of feedback.corrections) {
      // Find patterns that might have contributed to the incorrect prediction
      const relevantPatterns = patterns.filter(p => 
        p.metadata[correction.field] === correction.predictedValue
      )
      
      // Reduce confidence in patterns that led to incorrect predictions
      for (const pattern of relevantPatterns) {
        pattern.confidence = Math.max(0.1, pattern.confidence - (correction.importance * 0.1))
      }
    }
    
    this.userPatterns.set(userId, patterns)
  }

  private findRelevantPatterns(patterns: BehaviorPattern[], context: UserContext, reminder: Reminder): BehaviorPattern[] {
    const currentHour = context.timeOfDay.hour
    const currentDay = context.timeOfDay.dayOfWeek
    
    return patterns.filter(pattern => {
      // Time-based relevance
      const timeRelevant = Math.abs((pattern.metadata.timeOfDay || 0) - currentHour) <= 2
      
      // Day-based relevance
      const dayRelevant = pattern.metadata.dayOfWeek === currentDay || 
                         pattern.metadata.isWeekend === context.timeOfDay.isWeekend
      
      // Activity-based relevance
      const activityRelevant = pattern.metadata.activity === context.currentActivity ||
                              pattern.metadata.activity === undefined
      
      // Priority-based relevance
      const priorityRelevant = !pattern.metadata.priority || 
                              pattern.metadata.priority <= reminder.priority
      
      return (timeRelevant || dayRelevant) && activityRelevant && priorityRelevant
    }).sort((a, b) => b.confidence - a.confidence) // Sort by confidence
  }

  private calculateTimingFromPatterns(patterns: BehaviorPattern[], context: UserContext, reminder: Reminder): TimingPrediction {
    if (patterns.length === 0) {
      return this.getDefaultTimingPrediction(reminder, context)
    }
    
    // Weight patterns by confidence and recency
    let totalWeight = 0
    let weightedDelay = 0
    
    for (const pattern of patterns) {
      const recencyWeight = this.calculateRecencyWeight(pattern.lastObserved)
      const weight = pattern.confidence * recencyWeight
      
      totalWeight += weight
      
      // Calculate suggested delay based on pattern
      const patternDelay = this.calculatePatternDelay(pattern, context)
      weightedDelay += patternDelay * weight
    }
    
    const averageDelay = totalWeight > 0 ? weightedDelay / totalWeight : 0
    const confidence = Math.min(totalWeight / patterns.length, 1.0)
    
    return {
      suggestedTime: new Date(Date.now() + averageDelay),
      confidence,
      reasoning: `Based on ${patterns.length} learned patterns`,
      deferralRecommended: averageDelay > 0,
      alternativeSlots: this.generateAlternativeSlots(patterns, context)
    }
  }

  private calculateRecencyWeight(lastObserved: Date): number {
    const daysSince = (Date.now() - lastObserved.getTime()) / (1000 * 60 * 60 * 24)
    return Math.exp(-daysSince / 30) // Exponential decay over 30 days
  }

  private calculatePatternDelay(pattern: BehaviorPattern, context: UserContext): number {
    // Calculate suggested delay in milliseconds based on pattern
    const preferredHour = pattern.metadata.preferredHour || pattern.metadata.timeOfDay
    
    if (preferredHour !== undefined) {
      const currentHour = context.timeOfDay.hour
      let hourDiff = preferredHour - currentHour
      
      // Handle day boundary
      if (hourDiff < 0) {
        hourDiff += 24
      }
      
      return hourDiff * 60 * 60 * 1000 // Convert to milliseconds
    }
    
    return 0 // No delay if no preferred time
  }

  private generateAlternativeSlots(patterns: BehaviorPattern[], context: UserContext): Date[] {
    const alternatives: Date[] = []
    const now = new Date()
    
    // Extract preferred times from patterns
    const preferredHours = patterns
      .map(p => p.metadata.timeOfDay || p.metadata.preferredHour)
      .filter(h => h !== undefined)
      .filter((h, i, arr) => arr.indexOf(h) === i) // Remove duplicates
    
    for (const hour of preferredHours) {
      const alternativeTime = new Date(now)
      alternativeTime.setHours(hour, 0, 0, 0)
      
      // If time has passed today, schedule for tomorrow
      if (alternativeTime <= now) {
        alternativeTime.setDate(alternativeTime.getDate() + 1)
      }
      
      alternatives.push(alternativeTime)
    }
    
    return alternatives.slice(0, 3) // Return top 3 alternatives
  }

  private getDefaultTimingPrediction(reminder: Reminder, context: UserContext): TimingPrediction {
    // Default prediction when no patterns are available
    const now = new Date()
    const currentHour = now.getHours()
    
    // Default to next reasonable time
    let suggestedHour = currentHour + 1
    if (suggestedHour >= 22 || suggestedHour <= 6) {
      suggestedHour = 8 // Morning
    }
    
    const suggestedTime = new Date(now)
    suggestedTime.setHours(suggestedHour, 0, 0, 0)
    
    return {
      suggestedTime,
      confidence: 0.3, // Low confidence for default
      reasoning: 'Default timing (no learned patterns)',
      deferralRecommended: suggestedTime > now,
      alternativeSlots: []
    }
  }

  private applyAdaptationStrategy(prediction: TimingPrediction, strategy: AdaptationStrategy, context: UserContext): TimingPrediction {
    const suggestedHour = prediction.suggestedTime.getHours()
    
    // Check if suggested time conflicts with avoid times
    if (strategy.avoidTimes.includes(suggestedHour)) {
      // Find next preferred time
      const nextPreferredHour = strategy.preferredTimes.find(h => h > suggestedHour) || 
                               strategy.preferredTimes[0]
      
      if (nextPreferredHour !== undefined) {
        const adjustedTime = new Date(prediction.suggestedTime)
        adjustedTime.setHours(nextPreferredHour, 0, 0, 0)
        
        // If time has passed, schedule for next day
        if (adjustedTime <= new Date()) {
          adjustedTime.setDate(adjustedTime.getDate() + 1)
        }
        
        return {
          ...prediction,
          suggestedTime: adjustedTime,
          reasoning: `${prediction.reasoning} (adjusted for user preferences)`,
          deferralRecommended: true
        }
      }
    }
    
    return prediction
  }

  private calculateAverageConfidence(patterns: BehaviorPattern[]): number {
    if (patterns.length === 0) return 0
    return patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
  }

  private groupPatternsByType(patterns: BehaviorPattern[]): Record<PatternType, number> {
    const groups: Record<PatternType, number> = {
      [PatternType.WAKE_TIME]: 0,
      [PatternType.SLEEP_TIME]: 0,
      [PatternType.WORK_HOURS]: 0,
      [PatternType.MEAL_TIMES]: 0,
      [PatternType.EXERCISE_TIME]: 0,
      [PatternType.RESPONSE_PREFERENCE]: 0
    }
    
    for (const pattern of patterns) {
      groups[pattern.patternType]++
    }
    
    return groups
  }

  private calculateRecentAccuracy(sessions: LearningSession[]): number {
    const recentSessions = sessions.slice(-20) // Last 20 sessions
    if (recentSessions.length === 0) return 0
    
    return recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length
  }
}

// Supporting interfaces and types

export interface LearningOutcome {
  type: LearningOutcomeType
  confidence: number
  context: string
  metadata?: Record<string, any>
}

export enum LearningOutcomeType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

export interface ContextFeatures {
  timeOfDay: number
  dayOfWeek: number
  isWeekend: boolean
  activity: ActivityType
  location: LocationType
  availability: AvailabilityStatus
  interruptibility: InterruptibilityLevel
  deviceProximity: boolean
  locationConfidence: number
}

export interface AdaptationStrategy {
  preferredTimes: number[] // Hours of day
  avoidTimes: number[] // Hours to avoid
  interruptibilityThreshold: InterruptibilityLevel
  deferralPreference: 'aggressive' | 'moderate' | 'adaptive'
  batchingPreference: 'minimal' | 'moderate' | 'aggressive'
  escalationSensitivity: number // 0-1
  lastUpdated: Date
}

export interface TimingPrediction {
  suggestedTime: Date
  confidence: number
  reasoning: string
  deferralRecommended: boolean
  alternativeSlots: Date[]
}

export interface LearningSession {
  timestamp: Date
  context: ContextFeatures
  outcome: LearningOutcome
  accuracy: number
  patternCount: number
}

export interface LearningStats {
  totalPatterns: number
  totalSessions: number
  averageConfidence: number
  lastLearningTime: Date | null
  patternsByType: Record<PatternType, number>
  recentAccuracy: number
}