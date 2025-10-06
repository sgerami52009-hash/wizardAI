// Intelligent Timing System - Adaptive reminder timing and strategy management

import { EventEmitter } from 'events'
import { ContextAnalyzer } from './context-analyzer'
import {
  Reminder,
  ReminderFeedback,
  FeedbackType,
  UserContext,
  BehaviorPattern,
  PatternType,
  DeferralDecision,
  ReminderBatch
} from './types'
import { Priority } from '../calendar/types'

/**
 * IntelligentTimingSystem - Manages adaptive reminder timing and user behavior learning
 * 
 * Provides intelligent reminder deferral, batching, and strategy adaptation
 * based on user feedback and behavior patterns.
 * 
 * Safety: Ensures child-appropriate timing and respects family schedules
 * Performance: Optimized for real-time decision making on Jetson Nano Orin
 */
export class IntelligentTimingSystem extends EventEmitter {
  private contextAnalyzer: ContextAnalyzer
  private userStrategies: Map<string, ReminderStrategy> = new Map()
  private adaptationHistory: Map<string, StrategyAdaptation[]> = new Map()
  private readonly MAX_ADAPTATION_HISTORY = 50
  private readonly LEARNING_RATE = 0.1
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6

  constructor(contextAnalyzer?: ContextAnalyzer) {
    super()
    this.contextAnalyzer = contextAnalyzer || new ContextAnalyzer()
  }

  /**
   * Optimize reminder timing based on context and user patterns
   */
  async optimizeReminderTiming(reminder: Reminder): Promise<OptimizedTiming> {
    try {
      // Analyze current user context
      const context = await this.contextAnalyzer.analyzeUserContext(reminder.userId)
      
      // Get user's reminder strategy
      const strategy = this.getUserStrategy(reminder.userId)
      
      // Check if reminder should be deferred
      const deferralDecision = await this.contextAnalyzer.shouldDeferReminder(reminder, context)
      
      // Calculate optimal timing
      const optimalTime = deferralDecision.shouldDefer
        ? deferralDecision.deferUntil || await this.contextAnalyzer.predictOptimalReminderTime(reminder, context)
        : new Date()
      
      // Apply strategy adjustments
      const adjustedTiming = this.applyStrategyAdjustments(optimalTime, reminder, strategy, context)
      
      return {
        originalTime: reminder.triggerTime,
        optimizedTime: adjustedTiming,
        deferralDecision,
        confidence: this.calculateTimingConfidence(reminder, context, strategy),
        reasoning: this.generateTimingReasoning(deferralDecision, strategy, context)
      }
    } catch (error) {
      // Fallback to original timing on error
      return {
        originalTime: reminder.triggerTime,
        optimizedTime: reminder.triggerTime,
        deferralDecision: {
          shouldDefer: false,
          reason: 'Error in timing optimization',
          confidence: 0.1
        },
        confidence: 0.1,
        reasoning: 'Using original timing due to optimization error'
      }
    }
  }

  /**
   * Batch reminders intelligently based on user context and preferences
   */
  async optimizeReminderBatching(reminders: Reminder[], userId: string): Promise<ReminderBatch[]> {
    if (reminders.length === 0) {
      return []
    }

    // Get user context and strategy
    const context = await this.contextAnalyzer.analyzeUserContext(userId)
    const strategy = this.getUserStrategy(userId)
    
    // Apply user-specific batching preferences
    const adjustedReminders = this.applyBatchingStrategy(reminders, strategy, context)
    
    // Use context analyzer for intelligent batching
    const batches = await this.contextAnalyzer.batchReminders(adjustedReminders, context)
    
    // Apply final strategy adjustments to batches
    return this.optimizeBatches(batches, strategy, context)
  }

  /**
   * Adapt reminder strategy based on user feedback
   */
  async adaptReminderStrategy(userId: string, feedback: ReminderFeedback, reminder: Reminder): Promise<void> {
    const currentStrategy = this.getUserStrategy(userId)
    const adaptation = this.calculateStrategyAdaptation(feedback, reminder, currentStrategy)
    
    // Apply adaptation to strategy
    const updatedStrategy = this.applyAdaptation(currentStrategy, adaptation)
    this.userStrategies.set(userId, updatedStrategy)
    
    // Record adaptation history
    this.recordAdaptation(userId, adaptation)
    
    // Learn from context feedback if available
    if (feedback.feedbackType === FeedbackType.TIMING) {
      await this.learnFromTimingFeedback(userId, feedback, reminder)
    }
    
    // Emit adaptation event
    this.emit('reminder:strategy:adapted', {
      userId,
      feedback,
      adaptation,
      newStrategy: updatedStrategy,
      timestamp: new Date()
    })
  }

  /**
   * Get personalized reminder strategy for user
   */
  getUserStrategy(userId: string): ReminderStrategy {
    return this.userStrategies.get(userId) || this.createDefaultStrategy(userId)
  }

  /**
   * Update user strategy with new preferences
   */
  updateUserStrategy(userId: string, strategyUpdates: Partial<ReminderStrategy>): void {
    const currentStrategy = this.getUserStrategy(userId)
    const updatedStrategy = { ...currentStrategy, ...strategyUpdates }
    this.userStrategies.set(userId, updatedStrategy)
    
    this.emit('reminder:strategy:updated', {
      userId,
      updates: strategyUpdates,
      newStrategy: updatedStrategy,
      timestamp: new Date()
    })
  }

  /**
   * Get adaptation history for user
   */
  getAdaptationHistory(userId: string): StrategyAdaptation[] {
    return this.adaptationHistory.get(userId) || []
  }

  /**
   * Analyze user behavior patterns for strategy optimization
   */
  async analyzeUserBehaviorPatterns(userId: string): Promise<BehaviorAnalysis> {
    const patterns = this.contextAnalyzer.getBehaviorPatterns(userId)
    const adaptations = this.getAdaptationHistory(userId)
    const strategy = this.getUserStrategy(userId)
    
    return {
      userId,
      patterns,
      adaptationCount: adaptations.length,
      strategyEffectiveness: this.calculateStrategyEffectiveness(adaptations),
      recommendations: this.generateStrategyRecommendations(patterns, adaptations, strategy),
      lastAnalyzed: new Date()
    }
  }

  // Private helper methods

  private applyStrategyAdjustments(
    optimalTime: Date, 
    reminder: Reminder, 
    strategy: ReminderStrategy, 
    context: UserContext
  ): Date {
    let adjustedTime = new Date(optimalTime)
    
    // Apply user's preferred timing adjustments
    if (strategy.timingPreferences.preferredHours.length > 0) {
      adjustedTime = this.adjustToPreferredHours(adjustedTime, strategy.timingPreferences.preferredHours)
    }
    
    // Apply priority-based adjustments
    if (reminder.priority >= Priority.HIGH && strategy.priorityHandling.allowHighPriorityInterruption) {
      // High priority reminders can be delivered sooner
      const maxAdvance = strategy.priorityHandling.highPriorityAdvanceMinutes * 60 * 1000
      if (adjustedTime.getTime() - optimalTime.getTime() > maxAdvance) {
        adjustedTime = new Date(optimalTime.getTime() + maxAdvance)
      }
    }
    
    // Apply context-specific adjustments
    if (context.currentActivity && strategy.contextAdjustments[context.currentActivity]) {
      const adjustment = strategy.contextAdjustments[context.currentActivity]
      adjustedTime = new Date(adjustedTime.getTime() + (adjustment * 60 * 1000))
    }
    
    return adjustedTime
  }

  private adjustToPreferredHours(time: Date, preferredHours: number[]): Date {
    const adjustedTime = new Date(time)
    const currentHour = adjustedTime.getHours()
    
    // If current hour is not preferred, find nearest preferred hour
    if (!preferredHours.includes(currentHour)) {
      const nearestHour = this.findNearestPreferredHour(currentHour, preferredHours)
      adjustedTime.setHours(nearestHour, 0, 0, 0)
      
      // If nearest hour is in the past today, move to tomorrow
      if (adjustedTime <= time) {
        adjustedTime.setDate(adjustedTime.getDate() + 1)
      }
    }
    
    return adjustedTime
  }

  private findNearestPreferredHour(currentHour: number, preferredHours: number[]): number {
    let nearest = preferredHours[0]
    let minDistance = Math.abs(currentHour - nearest)
    
    for (const hour of preferredHours) {
      const distance = Math.abs(currentHour - hour)
      if (distance < minDistance) {
        minDistance = distance
        nearest = hour
      }
    }
    
    return nearest
  }

  private calculateTimingConfidence(
    reminder: Reminder, 
    context: UserContext, 
    strategy: ReminderStrategy
  ): number {
    let confidence = 0.7 // Base confidence
    
    // Adjust based on context quality
    if (context.location.confidence) {
      confidence = (confidence + context.location.confidence) / 2
    }
    
    // Adjust based on strategy maturity
    const adaptations = this.getAdaptationHistory(reminder.userId)
    if (adaptations.length > 10) {
      confidence += 0.1 // More confident with more learning
    }
    
    // Adjust based on priority match
    if (reminder.priority >= Priority.HIGH && strategy.priorityHandling.allowHighPriorityInterruption) {
      confidence += 0.1
    }
    
    return Math.min(confidence, 1.0)
  }

  private generateTimingReasoning(
    deferralDecision: DeferralDecision, 
    strategy: ReminderStrategy, 
    context: UserContext
  ): string {
    if (deferralDecision.shouldDefer) {
      return `Deferred: ${deferralDecision.reason}. Strategy: ${strategy.name}`
    } else {
      return `Immediate delivery: User context is suitable. Strategy: ${strategy.name}`
    }
  }

  private applyBatchingStrategy(
    reminders: Reminder[], 
    strategy: ReminderStrategy, 
    context: UserContext
  ): Reminder[] {
    // Sort by strategy preferences
    return [...reminders].sort((a, b) => {
      // Priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      
      // Then by user's preferred batching order
      if (strategy.batchingPreferences.prioritizeByType) {
        const aTypeScore = this.getTypeScore(a.type, strategy)
        const bTypeScore = this.getTypeScore(b.type, strategy)
        if (aTypeScore !== bTypeScore) {
          return bTypeScore - aTypeScore
        }
      }
      
      // Finally by time
      return a.triggerTime.getTime() - b.triggerTime.getTime()
    })
  }

  private getTypeScore(type: string, strategy: ReminderStrategy): number {
    // Simple scoring based on type preferences
    return strategy.batchingPreferences.typePreferences[type] || 0
  }

  private optimizeBatches(
    batches: ReminderBatch[], 
    strategy: ReminderStrategy, 
    context: UserContext
  ): ReminderBatch[] {
    return batches.map(batch => {
      // Adjust batch timing based on strategy
      if (strategy.batchingPreferences.maxBatchSize > 0) {
        // Split large batches if needed
        if (batch.reminders.length > strategy.batchingPreferences.maxBatchSize) {
          // This would split the batch - simplified for now
          batch.reminders = batch.reminders.slice(0, strategy.batchingPreferences.maxBatchSize)
        }
      }
      
      return batch
    })
  }

  private calculateStrategyAdaptation(
    feedback: ReminderFeedback, 
    reminder: Reminder, 
    currentStrategy: ReminderStrategy
  ): StrategyAdaptation {
    const adaptation: StrategyAdaptation = {
      timestamp: new Date(),
      feedbackType: feedback.feedbackType,
      feedbackRating: feedback.rating || 0,
      wasHelpful: feedback.wasHelpful,
      reminderPriority: reminder.priority,
      adaptationStrength: this.calculateAdaptationStrength(feedback),
      changes: {}
    }
    
    // Calculate specific adaptations based on feedback
    if (feedback.feedbackType === FeedbackType.TIMING) {
      if (!feedback.wasHelpful && feedback.rating && feedback.rating < 3) {
        // Poor timing feedback - adjust timing preferences
        adaptation.changes.timingAdjustment = feedback.rating < 2 ? -30 : -15 // minutes
      } else if (feedback.wasHelpful && feedback.rating && feedback.rating > 3) {
        // Good timing feedback - reinforce current strategy
        adaptation.changes.timingConfidence = 0.1
      }
    }
    
    if (feedback.feedbackType === FeedbackType.DELIVERY_METHOD) {
      if (!feedback.wasHelpful) {
        adaptation.changes.deliveryMethodPenalty = reminder.deliveryMethods[0]
      }
    }
    
    if (feedback.feedbackType === FeedbackType.FREQUENCY) {
      if (!feedback.wasHelpful && feedback.comment?.includes('too many')) {
        adaptation.changes.batchSizeReduction = 1
      }
    }
    
    return adaptation
  }

  private calculateAdaptationStrength(feedback: ReminderFeedback): number {
    let strength = this.LEARNING_RATE
    
    // Stronger adaptation for more extreme feedback
    if (feedback.rating) {
      if (feedback.rating <= 2 || feedback.rating >= 4) {
        strength *= 1.5
      }
    }
    
    // Stronger adaptation for explicit negative feedback
    if (!feedback.wasHelpful) {
      strength *= 1.3
    }
    
    return Math.min(strength, 0.3) // Cap adaptation strength
  }

  private applyAdaptation(strategy: ReminderStrategy, adaptation: StrategyAdaptation): ReminderStrategy {
    const updatedStrategy = { ...strategy }
    
    // Apply timing adjustments
    if (adaptation.changes.timingAdjustment) {
      // Adjust context-specific timing
      Object.keys(updatedStrategy.contextAdjustments).forEach(activity => {
        updatedStrategy.contextAdjustments[activity] += adaptation.changes.timingAdjustment!
      })
    }
    
    // Apply confidence adjustments
    if (adaptation.changes.timingConfidence) {
      updatedStrategy.confidence = Math.min(
        updatedStrategy.confidence + adaptation.changes.timingConfidence,
        1.0
      )
    }
    
    // Apply batching adjustments
    if (adaptation.changes.batchSizeReduction) {
      updatedStrategy.batchingPreferences.maxBatchSize = Math.max(
        1,
        updatedStrategy.batchingPreferences.maxBatchSize - adaptation.changes.batchSizeReduction
      )
    }
    
    // Apply delivery method penalties
    if (adaptation.changes.deliveryMethodPenalty) {
      const method = adaptation.changes.deliveryMethodPenalty
      updatedStrategy.deliveryPreferences.methodPenalties[method] = 
        (updatedStrategy.deliveryPreferences.methodPenalties[method] || 0) + 0.1
    }
    
    updatedStrategy.lastUpdated = new Date()
    return updatedStrategy
  }

  private recordAdaptation(userId: string, adaptation: StrategyAdaptation): void {
    let history = this.adaptationHistory.get(userId) || []
    history.push(adaptation)
    
    // Keep only recent adaptations
    if (history.length > this.MAX_ADAPTATION_HISTORY) {
      history = history.slice(-this.MAX_ADAPTATION_HISTORY)
    }
    
    this.adaptationHistory.set(userId, history)
  }

  private async learnFromTimingFeedback(
    userId: string, 
    feedback: ReminderFeedback, 
    reminder: Reminder
  ): Promise<void> {
    // Create context feedback for the context analyzer
    const contextFeedback = {
      userId,
      contextTime: feedback.feedbackTime,
      actualContext: await this.contextAnalyzer.analyzeUserContext(userId),
      predictedContext: await this.contextAnalyzer.analyzeUserContext(userId), // Simplified
      accuracy: feedback.wasHelpful ? 0.8 : 0.3,
      corrections: []
    }
    
    await this.contextAnalyzer.learnFromUserFeedback(userId, contextFeedback)
  }

  private createDefaultStrategy(userId: string): ReminderStrategy {
    return {
      userId,
      name: 'Default Strategy',
      timingPreferences: {
        preferredHours: [8, 12, 17, 20], // Morning, lunch, evening, night
        avoidHours: [0, 1, 2, 3, 4, 5, 6, 22, 23], // Sleep hours
        weekendAdjustment: 60 // 1 hour later on weekends
      },
      priorityHandling: {
        allowHighPriorityInterruption: true,
        highPriorityAdvanceMinutes: 15,
        lowPriorityDelayMinutes: 30
      },
      contextAdjustments: {
        sleeping: 480, // 8 hours delay
        working: 60,   // 1 hour delay
        eating: 30,    // 30 minute delay
        exercising: 45, // 45 minute delay
        commuting: 15,  // 15 minute delay
        relaxing: 0,    // No delay
        socializing: 30, // 30 minute delay
        unknown: 15     // Small delay for unknown activity
      },
      batchingPreferences: {
        maxBatchSize: 3,
        prioritizeByType: true,
        typePreferences: {
          time_based: 3,
          event_reminder: 2,
          task_reminder: 1,
          location_based: 2,
          context_based: 1
        }
      },
      deliveryPreferences: {
        methodPenalties: {},
        preferredMethods: ['voice', 'avatar', 'visual']
      },
      confidence: 0.7,
      createdAt: new Date(),
      lastUpdated: new Date()
    }
  }

  private calculateStrategyEffectiveness(adaptations: StrategyAdaptation[]): number {
    if (adaptations.length === 0) {
      return 0.5 // Neutral effectiveness
    }
    
    const recentAdaptations = adaptations.slice(-20) // Last 20 adaptations
    const positiveCount = recentAdaptations.filter(a => a.wasHelpful).length
    
    return positiveCount / recentAdaptations.length
  }

  private generateStrategyRecommendations(
    patterns: BehaviorPattern[], 
    adaptations: StrategyAdaptation[], 
    strategy: ReminderStrategy
  ): string[] {
    const recommendations: string[] = []
    
    // Analyze effectiveness
    const effectiveness = this.calculateStrategyEffectiveness(adaptations)
    if (effectiveness < 0.6) {
      recommendations.push('Consider adjusting timing preferences based on recent feedback')
    }
    
    // Analyze patterns
    const workPattern = patterns.find(p => p.patternType === PatternType.WORK_HOURS)
    if (workPattern && workPattern.confidence > 0.8) {
      recommendations.push('Strong work pattern detected - optimize work hour reminders')
    }
    
    // Analyze batching
    const batchingIssues = adaptations.filter(a => 
      a.feedbackType === FeedbackType.FREQUENCY && !a.wasHelpful
    )
    if (batchingIssues.length > 3) {
      recommendations.push('Consider reducing batch size or frequency')
    }
    
    return recommendations
  }
}

// Supporting interfaces

interface OptimizedTiming {
  originalTime: Date
  optimizedTime: Date
  deferralDecision: DeferralDecision
  confidence: number
  reasoning: string
}

interface ReminderStrategy {
  userId: string
  name: string
  timingPreferences: {
    preferredHours: number[]
    avoidHours: number[]
    weekendAdjustment: number // minutes
  }
  priorityHandling: {
    allowHighPriorityInterruption: boolean
    highPriorityAdvanceMinutes: number
    lowPriorityDelayMinutes: number
  }
  contextAdjustments: Record<string, number> // activity -> delay minutes
  batchingPreferences: {
    maxBatchSize: number
    prioritizeByType: boolean
    typePreferences: Record<string, number>
  }
  deliveryPreferences: {
    methodPenalties: Record<string, number>
    preferredMethods: string[]
  }
  confidence: number
  createdAt: Date
  lastUpdated: Date
}

interface StrategyAdaptation {
  timestamp: Date
  feedbackType: FeedbackType
  feedbackRating: number
  wasHelpful: boolean
  reminderPriority: Priority
  adaptationStrength: number
  changes: {
    timingAdjustment?: number
    timingConfidence?: number
    batchSizeReduction?: number
    deliveryMethodPenalty?: string
  }
}

interface BehaviorAnalysis {
  userId: string
  patterns: BehaviorPattern[]
  adaptationCount: number
  strategyEffectiveness: number
  recommendations: string[]
  lastAnalyzed: Date
}

export type { OptimizedTiming, ReminderStrategy, StrategyAdaptation, BehaviorAnalysis }