// Context Analyzer - Intelligent reminder timing and user behavior analysis

import { EventEmitter } from 'events'
import {
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationInfo,
  LocationType,
  DeviceProximity,
  TimeContext,
  BehaviorPattern,
  PatternType,
  DeferralDecision,
  ContextFeedback,
  ContextCorrection,
  Reminder,
  ReminderBatch,
  ReminderFeedback
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'
import { BehaviorLearningEngine, LearningOutcome, LearningOutcomeType } from './behavior-learning'

/**
 * ContextAnalyzer - Analyzes user context and optimizes reminder timing
 * 
 * Provides context-aware reminder timing optimization, user behavior learning,
 * and intelligent deferral decisions based on user activity and availability.
 * 
 * Safety: Respects user privacy and child-appropriate interaction patterns
 * Performance: Optimized for real-time context analysis on Jetson Nano Orin
 */
export class ContextAnalyzer extends EventEmitter {
  private userContexts: Map<string, UserContext> = new Map()
  private behaviorPatterns: Map<string, BehaviorPattern[]> = new Map()
  private contextHistory: Map<string, UserContext[]> = new Map()
  private behaviorLearning: BehaviorLearningEngine
  private readonly MAX_HISTORY_SIZE = 100
  private readonly CONTEXT_CACHE_TTL_MS = 30000 // 30 seconds
  private readonly LEARNING_THRESHOLD = 5 // Minimum observations for pattern learning

  constructor() {
    super()
    this.behaviorLearning = new BehaviorLearningEngine()
    
    // Forward learning events
    this.behaviorLearning.on('behavior:learned', (data) => {
      this.emit('reminder:behavior:learned', data)
    })
    
    this.behaviorLearning.on('behavior:learning:error', (data) => {
      this.emit('reminder:learning:error', data)
    })
  }

  /**
   * Analyze current user context with real-time data
   */
  async analyzeUserContext(userId: string): Promise<UserContext> {
    const startTime = Date.now()
    
    try {
      // Get cached context if recent enough
      const cachedContext = this.userContexts.get(userId)
      if (cachedContext && this.isContextFresh(cachedContext)) {
        return cachedContext
      }

      // Analyze current context
      const context = await this.gatherContextData(userId)
      
      // Store context and update history
      this.userContexts.set(userId, context)
      this.updateContextHistory(userId, context)
      
      // Emit context analysis event
      this.emit('reminder:context:analyzed', {
        userId,
        context: this.summarizeContext(context),
        confidence: this.calculateContextConfidence(context),
        analysisTime: Date.now() - startTime,
        timestamp: new Date()
      })

      return context
    } catch (error) {
      // Return default context on error
      return this.getDefaultContext(userId)
    }
  }

  /**
   * Predict optimal reminder time based on context and user patterns
   */
  async predictOptimalReminderTime(reminder: Reminder, context: UserContext): Promise<Date> {
    const userPatterns = this.behaviorPatterns.get(reminder.userId) || []
    
    // If user is currently available and interruptible, deliver now
    if (this.isCurrentlyOptimal(context, reminder)) {
      return new Date()
    }

    // Find next optimal time based on patterns
    const nextOptimalTime = this.findNextOptimalTime(reminder, context, userPatterns)
    
    // Don't defer more than 4 hours for high priority reminders
    const maxDeferralTime = this.getMaxDeferralTime(reminder.priority)
    const maxTime = new Date(reminder.triggerTime.getTime() + maxDeferralTime)
    
    return nextOptimalTime > maxTime ? maxTime : nextOptimalTime
  }

  /**
   * Determine if reminder should be deferred based on context
   */
  async shouldDeferReminder(reminder: Reminder, context: UserContext): Promise<DeferralDecision> {
    const deferralScore = this.calculateDeferralScore(reminder, context)
    const shouldDefer = deferralScore > 0.6 // Threshold for deferral
    
    if (!shouldDefer) {
      return {
        shouldDefer: false,
        reason: 'User context is suitable for reminder delivery',
        confidence: 1 - deferralScore
      }
    }

    const deferUntil = await this.predictOptimalReminderTime(reminder, context)
    const alternativeMethods = this.suggestAlternativeDeliveryMethods(context, reminder)
    
    return {
      shouldDefer: true,
      deferUntil,
      reason: this.getDeferralReason(context, deferralScore),
      confidence: deferralScore,
      alternativeDeliveryMethods: alternativeMethods
    }
  }

  /**
   * Batch reminders intelligently based on context and timing
   */
  async batchReminders(reminders: Reminder[], context: UserContext): Promise<ReminderBatch[]> {
    if (reminders.length === 0) {
      return []
    }

    // Sort reminders by priority and timing
    const sortedReminders = [...reminders].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.triggerTime.getTime() - b.triggerTime.getTime()
    })

    const batches: ReminderBatch[] = []
    let currentBatch: Reminder[] = []
    const maxBatchSize = this.getOptimalBatchSize(context)
    
    for (const reminder of sortedReminders) {
      // Start new batch if current is full or delivery method differs significantly
      if (currentBatch.length >= maxBatchSize || 
          (currentBatch.length > 0 && !this.canBatchTogether(currentBatch[0], reminder))) {
        
        if (currentBatch.length > 0) {
          batches.push(this.createBatch(currentBatch, context))
          currentBatch = []
        }
      }
      
      currentBatch.push(reminder)
    }

    // Add final batch
    if (currentBatch.length > 0) {
      batches.push(this.createBatch(currentBatch, context))
    }

    return batches
  }

  /**
   * Learn from user feedback to improve context predictions
   */
  async learnFromUserFeedback(userId: string, feedback: ContextFeedback): Promise<void> {
    // Update behavior patterns based on feedback
    const patterns = this.behaviorPatterns.get(userId) || []
    
    // Analyze feedback accuracy
    const accuracy = feedback.accuracy
    if (accuracy < 0.7) {
      // Poor prediction - learn from corrections
      await this.updatePatternsFromCorrections(userId, feedback.corrections)
    }

    // Update existing patterns or create new ones
    this.updateBehaviorPatterns(userId, feedback)
    
    // Use advanced behavior learning engine
    await this.behaviorLearning.learnFromContextFeedback(userId, feedback)
    
    // Emit learning event
    this.emit('reminder:context:learned', {
      userId,
      accuracy,
      corrections: feedback.corrections.length,
      timestamp: new Date()
    })
  }

  /**
   * Learn from reminder feedback to improve timing predictions
   */
  async learnFromReminderFeedback(userId: string, reminder: Reminder, feedback: ReminderFeedback): Promise<void> {
    // Use behavior learning engine for advanced learning
    await this.behaviorLearning.learnFromReminderFeedback(userId, reminder, feedback)
    
    // Update local patterns for backward compatibility
    const outcome: LearningOutcome = {
      type: feedback.wasHelpful ? LearningOutcomeType.POSITIVE : LearningOutcomeType.NEGATIVE,
      confidence: feedback.rating ? feedback.rating / 5 : (feedback.wasHelpful ? 0.8 : 0.2),
      context: 'reminder_feedback',
      metadata: {
        feedbackType: feedback.feedbackType,
        rating: feedback.rating
      }
    }
    
    // Create context from feedback timing
    const context = await this.reconstructContextFromFeedback(userId, feedback)
    await this.behaviorLearning.learnFromContext(userId, context, outcome)
    
    // Emit learning event
    this.emit('reminder:feedback:learned', {
      userId,
      reminderId: reminder.id,
      wasHelpful: feedback.wasHelpful,
      feedbackType: feedback.feedbackType,
      timestamp: new Date()
    })
  }

  /**
   * Get enhanced timing prediction using behavior learning
   */
  async predictOptimalReminderTimeEnhanced(reminder: Reminder, context: UserContext): Promise<Date> {
    try {
      // Use behavior learning engine for prediction
      const prediction = await this.behaviorLearning.predictOptimalTiming(reminder.userId, reminder, context)
      
      if (prediction.confidence > 0.6) {
        return prediction.suggestedTime
      }
    } catch (error) {
      // Fallback to original method
    }
    
    // Fallback to original prediction method
    return this.predictOptimalReminderTime(reminder, context)
  }

  /**
   * Get user learning statistics
   */
  getUserLearningStats(userId: string): any {
    return this.behaviorLearning.getLearningStats(userId)
  }

  /**
   * Get user adaptation strategy
   */
  getUserAdaptationStrategy(userId: string): any {
    return this.behaviorLearning.getAdaptationStrategy(userId)
  }

  /**
   * Update context model with new data
   */
  async updateContextModel(userId: string, contextData: any): Promise<void> {
    const currentContext = this.userContexts.get(userId)
    if (!currentContext) {
      return
    }

    // Update context with new data
    const updatedContext = this.mergeContextData(currentContext, contextData)
    this.userContexts.set(userId, updatedContext)
    
    // Check for significant context changes
    if (this.hasSignificantContextChange(currentContext, updatedContext)) {
      this.emit('reminder:context:changed', {
        userId,
        previousContext: this.summarizeContext(currentContext),
        newContext: this.summarizeContext(updatedContext),
        changeType: this.getContextChangeType(currentContext, updatedContext),
        timestamp: new Date()
      })
    }
  }

  /**
   * Get current context for user (cached or default)
   */
  getCurrentContext(userId: string): UserContext {
    return this.userContexts.get(userId) || this.getDefaultContext(userId)
  }

  /**
   * Get behavior patterns for user
   */
  getBehaviorPatterns(userId: string): BehaviorPattern[] {
    return this.behaviorPatterns.get(userId) || []
  }

  // Private helper methods

  private async gatherContextData(userId: string): Promise<UserContext> {
    const now = new Date()
    
    // Gather real-time context data from multiple sources
    const [activity, location, availability, deviceProximity] = await Promise.all([
      this.detectActivityRealTime(userId),
      this.detectLocationWithAwareness(userId),
      this.detectAvailabilityFromCalendar(userId),
      this.detectDeviceProximityAdvanced(userId)
    ])
    
    const interruptibility = this.calculateInterruptibilityAdvanced(userId, activity, availability, location)
    const timeContext = this.getAdvancedTimeContext()
    
    return {
      userId,
      currentActivity: activity,
      location,
      availability,
      interruptibility,
      deviceProximity,
      timeOfDay: timeContext,
      historicalPatterns: this.behaviorPatterns.get(userId) || [],
      lastUpdated: now
    }
  }

  /**
   * Real-time activity detection using multiple sensor inputs
   */
  private async detectActivityRealTime(userId: string): Promise<ActivityType> {
    try {
      // Combine multiple detection methods for accuracy
      const timeBasedActivity = this.detectActivityFromTime()
      const sensorBasedActivity = await this.detectActivityFromSensors(userId)
      const calendarBasedActivity = await this.detectActivityFromCalendar(userId)
      const patternBasedActivity = this.detectActivityFromPatterns(userId)
      
      // Weight and combine different detection methods
      return this.combineActivityDetections([
        { activity: timeBasedActivity, confidence: 0.3 },
        { activity: sensorBasedActivity, confidence: 0.4 },
        { activity: calendarBasedActivity, confidence: 0.6 },
        { activity: patternBasedActivity, confidence: 0.5 }
      ])
    } catch (error) {
      // Fallback to time-based detection
      return this.detectActivityFromTime()
    }
  }

  private detectActivityFromTime(): ActivityType {
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    if (hour >= 22 || hour <= 6) {
      return ActivityType.SLEEPING
    } else if (hour >= 9 && hour <= 17 && !isWeekend) {
      return ActivityType.WORKING
    } else if (hour >= 7 && hour <= 8 || hour >= 12 && hour <= 13 || hour >= 18 && hour <= 19) {
      return ActivityType.EATING
    } else if (hour >= 6 && hour <= 7 || hour >= 17 && hour <= 18) {
      return ActivityType.EXERCISING
    } else {
      return ActivityType.RELAXING
    }
  }

  private async detectActivityFromSensors(userId: string): Promise<ActivityType> {
    // In a real implementation, this would integrate with:
    // - Motion sensors for movement detection
    // - Sound sensors for activity recognition
    // - Smart home devices (lights, TV, etc.)
    // - Wearable devices if available
    
    // Placeholder implementation with simulated sensor data
    const motionLevel = Math.random() // 0-1, simulating motion sensor
    const soundLevel = Math.random() // 0-1, simulating sound sensor
    const lightStatus = Math.random() > 0.5 // Boolean, simulating smart lights
    
    if (motionLevel < 0.1 && soundLevel < 0.1 && !lightStatus) {
      return ActivityType.SLEEPING
    } else if (motionLevel > 0.7) {
      return ActivityType.EXERCISING
    } else if (soundLevel > 0.6) {
      return ActivityType.SOCIALIZING
    } else {
      return ActivityType.RELAXING
    }
  }

  private async detectActivityFromCalendar(userId: string): Promise<ActivityType> {
    // Check current calendar events to infer activity
    const now = new Date()
    const currentHour = now.getHours()
    
    // Simulate calendar check - in real implementation would query calendar
    // This would check for active meetings, work blocks, etc.
    if (currentHour >= 9 && currentHour <= 17) {
      // Check if in a meeting or work block
      const hasWorkEvent = Math.random() > 0.6 // Simulate calendar check
      if (hasWorkEvent) {
        return ActivityType.WORKING
      }
    }
    
    return ActivityType.UNKNOWN
  }

  private detectActivityFromPatterns(userId: string): ActivityType {
    const patterns = this.behaviorPatterns.get(userId) || []
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay()
    
    // Find patterns that match current time
    const relevantPatterns = patterns.filter(pattern => {
      if (pattern.patternType === PatternType.WORK_HOURS && pattern.metadata.startHour && pattern.metadata.endHour) {
        return currentHour >= pattern.metadata.startHour && currentHour <= pattern.metadata.endHour
      }
      if (pattern.patternType === PatternType.SLEEP_TIME && pattern.metadata.sleepHour) {
        return Math.abs(currentHour - pattern.metadata.sleepHour) <= 1
      }
      return false
    })
    
    if (relevantPatterns.length > 0) {
      const bestPattern = relevantPatterns.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      )
      
      switch (bestPattern.patternType) {
        case PatternType.WORK_HOURS:
          return ActivityType.WORKING
        case PatternType.SLEEP_TIME:
          return ActivityType.SLEEPING
        case PatternType.EXERCISE_TIME:
          return ActivityType.EXERCISING
        case PatternType.MEAL_TIMES:
          return ActivityType.EATING
        default:
          return ActivityType.UNKNOWN
      }
    }
    
    return ActivityType.UNKNOWN
  }

  private combineActivityDetections(detections: Array<{ activity: ActivityType, confidence: number }>): ActivityType {
    // Remove unknown activities and weight by confidence
    const validDetections = detections.filter(d => d.activity !== ActivityType.UNKNOWN)
    
    if (validDetections.length === 0) {
      return ActivityType.UNKNOWN
    }
    
    // Calculate weighted scores for each activity type
    const activityScores = new Map<ActivityType, number>()
    
    for (const detection of validDetections) {
      const currentScore = activityScores.get(detection.activity) || 0
      activityScores.set(detection.activity, currentScore + detection.confidence)
    }
    
    // Return activity with highest weighted score
    let bestActivity = ActivityType.UNKNOWN
    let bestScore = 0
    
    for (const [activity, score] of activityScores) {
      if (score > bestScore) {
        bestScore = score
        bestActivity = activity
      }
    }
    
    return bestActivity
  }

  /**
   * Enhanced location detection with multiple awareness sources
   */
  private async detectLocationWithAwareness(userId: string): Promise<LocationInfo> {
    try {
      // Combine multiple location detection methods
      const wifiBasedLocation = await this.detectLocationFromWifi()
      const deviceBasedLocation = await this.detectLocationFromDevices(userId)
      const timeBasedLocation = this.detectLocationFromTimePatterns(userId)
      const calendarBasedLocation = await this.detectLocationFromCalendar(userId)
      
      // Combine location detections with confidence weighting
      return this.combineLocationDetections([
        wifiBasedLocation,
        deviceBasedLocation,
        timeBasedLocation,
        calendarBasedLocation
      ])
    } catch (error) {
      // Fallback to basic time-based detection
      return this.detectLocationFromTimePatterns(userId)
    }
  }

  private async detectLocationFromWifi(): Promise<LocationInfo> {
    // In real implementation, would check WiFi network SSID/BSSID
    // to determine location (home network vs work network vs public)
    
    // Simulate WiFi-based location detection
    const networks = ['HOME_NETWORK', 'WORK_NETWORK', 'PUBLIC_WIFI', 'UNKNOWN']
    const currentNetwork = networks[Math.floor(Math.random() * networks.length)]
    
    switch (currentNetwork) {
      case 'HOME_NETWORK':
        return {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.95,
          coordinates: { latitude: 40.7128, longitude: -74.0060 } // Example coordinates
        }
      case 'WORK_NETWORK':
        return {
          name: 'Office',
          type: LocationType.WORK,
          confidence: 0.90,
          coordinates: { latitude: 40.7589, longitude: -73.9851 }
        }
      case 'PUBLIC_WIFI':
        return {
          name: 'Public Location',
          type: LocationType.OTHER,
          confidence: 0.60
        }
      default:
        return {
          name: 'Unknown',
          type: LocationType.OTHER,
          confidence: 0.20
        }
    }
  }

  private async detectLocationFromDevices(userId: string): Promise<LocationInfo> {
    // In real implementation, would check:
    // - Connected smart home devices
    // - Bluetooth beacons
    // - IoT device presence
    // - Smart speakers/displays in different rooms
    
    // Simulate device-based location detection
    const connectedDevices = ['living_room_speaker', 'bedroom_display', 'kitchen_hub', 'office_computer']
    const activeDevice = connectedDevices[Math.floor(Math.random() * connectedDevices.length)]
    
    const deviceLocations: Record<string, LocationInfo> = {
      'living_room_speaker': { name: 'Living Room', type: LocationType.HOME, confidence: 0.85 },
      'bedroom_display': { name: 'Bedroom', type: LocationType.HOME, confidence: 0.90 },
      'kitchen_hub': { name: 'Kitchen', type: LocationType.HOME, confidence: 0.88 },
      'office_computer': { name: 'Home Office', type: LocationType.WORK, confidence: 0.80 }
    }
    
    return deviceLocations[activeDevice] || {
      name: 'Unknown',
      type: LocationType.OTHER,
      confidence: 0.30
    }
  }

  private detectLocationFromTimePatterns(userId: string): LocationInfo {
    const patterns = this.behaviorPatterns.get(userId) || []
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    // Check for location patterns
    const locationPatterns = patterns.filter(p => 
      p.patternType === PatternType.WORK_HOURS && 
      p.metadata.location
    )
    
    if (locationPatterns.length > 0) {
      const workPattern = locationPatterns.find(p => 
        hour >= (p.metadata.startHour || 9) && 
        hour <= (p.metadata.endHour || 17) &&
        !isWeekend
      )
      
      if (workPattern) {
        return {
          name: workPattern.metadata.location,
          type: LocationType.WORK,
          confidence: workPattern.confidence
        }
      }
    }
    
    // Default time-based location inference
    if (hour >= 9 && hour <= 17 && !isWeekend) {
      return {
        name: 'Work',
        type: LocationType.WORK,
        confidence: 0.70
      }
    } else if (hour >= 8 && hour <= 9 && !isWeekend) {
      return {
        name: 'Commute to Work',
        type: LocationType.COMMUTE,
        confidence: 0.60
      }
    } else if (hour >= 17 && hour <= 18 && !isWeekend) {
      return {
        name: 'Commute from Work',
        type: LocationType.COMMUTE,
        confidence: 0.60
      }
    } else {
      return {
        name: 'Home',
        type: LocationType.HOME,
        confidence: 0.80
      }
    }
  }

  private async detectLocationFromCalendar(userId: string): Promise<LocationInfo> {
    // In real implementation, would check current calendar events for location
    const now = new Date()
    const hour = now.getHours()
    
    // Simulate calendar location check
    if (hour >= 9 && hour <= 17) {
      const hasLocationEvent = Math.random() > 0.7 // Simulate calendar event with location
      if (hasLocationEvent) {
        const locations = [
          { name: 'Conference Room A', type: LocationType.WORK, confidence: 0.95 },
          { name: 'Client Office', type: LocationType.WORK, confidence: 0.90 },
          { name: 'Coffee Shop Meeting', type: LocationType.OTHER, confidence: 0.85 }
        ]
        return locations[Math.floor(Math.random() * locations.length)]
      }
    }
    
    return {
      name: 'Unknown',
      type: LocationType.OTHER,
      confidence: 0.10
    }
  }

  private combineLocationDetections(locations: LocationInfo[]): LocationInfo {
    // Filter out low-confidence detections
    const validLocations = locations.filter(loc => loc.confidence > 0.30)
    
    if (validLocations.length === 0) {
      return {
        name: 'Unknown',
        type: LocationType.OTHER,
        confidence: 0.10
      }
    }
    
    // Return location with highest confidence
    return validLocations.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    )
  }

  /**
   * Enhanced availability detection from calendar and context
   */
  private async detectAvailabilityFromCalendar(userId: string): Promise<AvailabilityStatus> {
    try {
      // Check multiple sources for availability
      const calendarAvailability = await this.checkCalendarAvailability(userId)
      const manualStatus = await this.checkManualStatus(userId)
      const contextAvailability = this.inferAvailabilityFromContext(userId)
      
      // Priority: Manual status > Calendar > Context inference
      if (manualStatus !== AvailabilityStatus.AVAILABLE) {
        return manualStatus
      }
      
      if (calendarAvailability !== AvailabilityStatus.AVAILABLE) {
        return calendarAvailability
      }
      
      return contextAvailability
    } catch (error) {
      return AvailabilityStatus.AVAILABLE
    }
  }

  private async checkCalendarAvailability(userId: string): Promise<AvailabilityStatus> {
    // In real implementation, would query calendar for current events
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    
    // Simulate calendar event check
    const hasCurrentEvent = Math.random() > 0.6 // 40% chance of being in an event
    
    if (hasCurrentEvent) {
      // Simulate different types of calendar events
      const eventTypes = ['meeting', 'focus_time', 'lunch', 'appointment']
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      
      switch (eventType) {
        case 'meeting':
          return AvailabilityStatus.BUSY
        case 'focus_time':
          return AvailabilityStatus.DO_NOT_DISTURB
        case 'lunch':
          return AvailabilityStatus.AWAY
        case 'appointment':
          return AvailabilityStatus.BUSY
        default:
          return AvailabilityStatus.BUSY
      }
    }
    
    return AvailabilityStatus.AVAILABLE
  }

  private async checkManualStatus(userId: string): Promise<AvailabilityStatus> {
    // In real implementation, would check user-set status
    // This could be set through voice commands or UI
    
    // Simulate manual status (most users don't set manual status)
    const hasManualStatus = Math.random() > 0.9 // 10% chance of manual status
    
    if (hasManualStatus) {
      const statuses = [
        AvailabilityStatus.DO_NOT_DISTURB,
        AvailabilityStatus.BUSY,
        AvailabilityStatus.AWAY
      ]
      return statuses[Math.floor(Math.random() * statuses.length)]
    }
    
    return AvailabilityStatus.AVAILABLE
  }

  private inferAvailabilityFromContext(userId: string): AvailabilityStatus {
    const hour = new Date().getHours()
    
    // Infer availability from time and typical patterns
    if (hour >= 22 || hour <= 6) {
      return AvailabilityStatus.DO_NOT_DISTURB // Sleep hours
    } else if (hour >= 12 && hour <= 13) {
      return AvailabilityStatus.AWAY // Lunch time
    } else if (hour >= 9 && hour <= 17) {
      return AvailabilityStatus.BUSY // Work hours
    } else {
      return AvailabilityStatus.AVAILABLE
    }
  }

  /**
   * Advanced interruptibility calculation with multiple factors
   */
  private calculateInterruptibilityAdvanced(userId: string, activity: ActivityType, availability: AvailabilityStatus, location: LocationInfo): InterruptibilityLevel {
    let interruptibilityScore = 0.5 // Base score
    
    // Availability factor (highest weight)
    switch (availability) {
      case AvailabilityStatus.DO_NOT_DISTURB:
        return InterruptibilityLevel.NONE
      case AvailabilityStatus.BUSY:
        interruptibilityScore -= 0.3
        break
      case AvailabilityStatus.AWAY:
        interruptibilityScore -= 0.2
        break
      case AvailabilityStatus.AVAILABLE:
        interruptibilityScore += 0.2
        break
    }
    
    // Activity factor
    switch (activity) {
      case ActivityType.SLEEPING:
        return InterruptibilityLevel.NONE
      case ActivityType.WORKING:
        interruptibilityScore -= 0.2
        break
      case ActivityType.EATING:
        interruptibilityScore -= 0.1
        break
      case ActivityType.EXERCISING:
        interruptibilityScore -= 0.15
        break
      case ActivityType.RELAXING:
        interruptibilityScore += 0.3
        break
      case ActivityType.SOCIALIZING:
        interruptibilityScore -= 0.1
        break
    }
    
    // Location factor
    switch (location.type) {
      case LocationType.HOME:
        interruptibilityScore += 0.1
        break
      case LocationType.WORK:
        interruptibilityScore -= 0.1
        break
      case LocationType.COMMUTE:
        interruptibilityScore -= 0.2
        break
    }
    
    // Time of day factor
    const hour = new Date().getHours()
    if (hour >= 22 || hour <= 6) {
      interruptibilityScore -= 0.4 // Late night/early morning
    } else if (hour >= 12 && hour <= 13) {
      interruptibilityScore -= 0.1 // Lunch time
    }
    
    // Convert score to level
    if (interruptibilityScore >= 0.7) {
      return InterruptibilityLevel.HIGH
    } else if (interruptibilityScore >= 0.4) {
      return InterruptibilityLevel.MEDIUM
    } else if (interruptibilityScore >= 0.1) {
      return InterruptibilityLevel.LOW
    } else {
      return InterruptibilityLevel.NONE
    }
  }

  /**
   * Advanced device proximity detection with multiple sensors
   */
  private async detectDeviceProximityAdvanced(userId: string): Promise<DeviceProximity> {
    try {
      // In real implementation, would check:
      // - Bluetooth signal strength
      // - WiFi connection status
      // - Voice activity detection
      // - Motion sensors
      // - Smart home device interactions
      
      // Simulate advanced proximity detection
      const bluetoothSignal = Math.random() * 100 // 0-100 signal strength
      const wifiConnected = Math.random() > 0.2 // 80% chance connected to home WiFi
      const recentVoiceActivity = Math.random() > 0.7 // 30% chance of recent voice
      const motionDetected = Math.random() > 0.5 // 50% chance of motion
      
      let isNearby = false
      let distance = 100 // Default far distance
      
      if (bluetoothSignal > 70 || recentVoiceActivity) {
        isNearby = true
        distance = Math.max(1, (100 - bluetoothSignal) / 10) // 1-10 meters based on signal
      } else if (wifiConnected && motionDetected) {
        isNearby = true
        distance = Math.random() * 20 + 5 // 5-25 meters (same building)
      } else if (wifiConnected) {
        isNearby = true
        distance = Math.random() * 50 + 10 // 10-60 meters (home network range)
      }
      
      return {
        isNearby,
        distance,
        lastSeen: new Date(),
        deviceType: 'home_assistant'
      }
    } catch (error) {
      // Fallback to basic detection
      return {
        isNearby: true,
        distance: 5,
        lastSeen: new Date(),
        deviceType: 'home_assistant'
      }
    }
  }

  /**
   * Advanced time context with additional temporal factors
   */
  private getAdvancedTimeContext(): TimeContext {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()
    
    // Check for holidays (simplified implementation)
    const isHoliday = this.checkIfHoliday(now)
    
    return {
      hour,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isHoliday,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  /**
   * Simple holiday detection (would be more comprehensive in real implementation)
   */
  private checkIfHoliday(date: Date): boolean {
    const month = date.getMonth()
    const day = date.getDate()
    
    // Common holidays (simplified)
    const holidays = [
      { month: 0, day: 1 },   // New Year's Day
      { month: 6, day: 4 },   // Independence Day
      { month: 11, day: 25 }  // Christmas
    ]
    
    return holidays.some(holiday => 
      holiday.month === month && holiday.day === day
    )
  }

  /**
   * Legacy methods for backward compatibility
   */
  private detectAvailability(userId: string): AvailabilityStatus {
    const context = this.userContexts.get(userId)
    return context?.availability || AvailabilityStatus.AVAILABLE
  }

  private detectActivity(userId: string): ActivityType {
    const context = this.userContexts.get(userId)
    return context?.currentActivity || ActivityType.UNKNOWN
  }

  private isContextFresh(context: UserContext): boolean {
    const age = Date.now() - context.lastUpdated.getTime()
    return age < this.CONTEXT_CACHE_TTL_MS
  }

  private updateContextHistory(userId: string, context: UserContext): void {
    let history = this.contextHistory.get(userId) || []
    history.push(context)
    
    // Keep only recent history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history = history.slice(-this.MAX_HISTORY_SIZE)
    }
    
    this.contextHistory.set(userId, history)
  }

  private calculateContextConfidence(context: UserContext): number {
    // Calculate confidence based on data freshness and sensor reliability
    let confidence = 0.8 // Base confidence
    
    // Adjust based on location confidence
    if (context.location.confidence) {
      confidence = (confidence + context.location.confidence) / 2
    }
    
    // Adjust based on device proximity
    if (context.deviceProximity.isNearby) {
      confidence += 0.1
    }
    
    return Math.min(confidence, 1.0)
  }

  private summarizeContext(context: UserContext): any {
    return {
      activity: context.currentActivity,
      location: context.location.name,
      availability: context.availability,
      interruptibility: context.interruptibility,
      deviceProximity: context.deviceProximity.isNearby
    }
  }

  private getDefaultContext(userId: string): UserContext {
    return {
      userId,
      currentActivity: ActivityType.UNKNOWN,
      location: {
        name: 'Unknown',
        type: LocationType.OTHER,
        confidence: 0.1
      },
      availability: AvailabilityStatus.AVAILABLE,
      interruptibility: InterruptibilityLevel.MEDIUM,
      deviceProximity: {
        isNearby: false,
        lastSeen: new Date(),
        deviceType: 'unknown'
      },
      timeOfDay: this.getAdvancedTimeContext(),
      historicalPatterns: [],
      lastUpdated: new Date()
    }
  }

  private isCurrentlyOptimal(context: UserContext, reminder: Reminder): boolean {
    // Check if current context is good for delivery
    if (context.availability === AvailabilityStatus.DO_NOT_DISTURB) {
      return false
    }
    
    if (context.interruptibility === InterruptibilityLevel.NONE) {
      return false
    }
    
    // High priority reminders can interrupt more
    if (reminder.priority >= Priority.HIGH && 
        context.interruptibility >= InterruptibilityLevel.LOW) {
      return true
    }
    
    // Medium priority needs medium interruptibility
    if (reminder.priority >= Priority.MEDIUM && 
        context.interruptibility >= InterruptibilityLevel.MEDIUM) {
      return true
    }
    
    // Low priority needs high interruptibility
    return context.interruptibility >= InterruptibilityLevel.HIGH
  }

  private findNextOptimalTime(reminder: Reminder, context: UserContext, patterns: BehaviorPattern[]): Date {
    const now = new Date()
    const maxLookAhead = 4 * 60 * 60 * 1000 // 4 hours
    
    // Look for patterns that suggest good times
    const availabilityPatterns = patterns.filter(p => 
      p.patternType === PatternType.WORK_HOURS || 
      p.patternType === PatternType.WAKE_TIME
    )
    
    if (availabilityPatterns.length > 0) {
      // Use pattern-based prediction
      const nextGoodTime = this.predictFromPatterns(availabilityPatterns, now)
      if (nextGoodTime && nextGoodTime.getTime() - now.getTime() <= maxLookAhead) {
        return nextGoodTime
      }
    }
    
    // Fallback: find next reasonable time based on current context
    return this.findNextReasonableTime(now, context)
  }

  private predictFromPatterns(patterns: BehaviorPattern[], fromTime: Date): Date | null {
    // Simple pattern-based prediction
    // In a real implementation, this would use more sophisticated ML
    
    const workPattern = patterns.find(p => p.patternType === PatternType.WORK_HOURS)
    if (workPattern && workPattern.metadata.endHour) {
      const nextDay = new Date(fromTime)
      nextDay.setDate(nextDay.getDate() + 1)
      nextDay.setHours(workPattern.metadata.endHour + 1, 0, 0, 0)
      return nextDay
    }
    
    return null
  }

  private findNextReasonableTime(fromTime: Date, context: UserContext): Date {
    const nextTime = new Date(fromTime)
    
    // If it's late at night, defer to morning
    if (nextTime.getHours() >= 22 || nextTime.getHours() <= 6) {
      nextTime.setDate(nextTime.getDate() + 1)
      nextTime.setHours(8, 0, 0, 0)
      return nextTime
    }
    
    // If during work hours, defer to after work
    if (nextTime.getHours() >= 9 && nextTime.getHours() <= 17) {
      nextTime.setHours(18, 0, 0, 0)
      return nextTime
    }
    
    // Otherwise, defer by 1 hour
    nextTime.setTime(nextTime.getTime() + 60 * 60 * 1000)
    return nextTime
  }

  private getMaxDeferralTime(priority: Priority): number {
    switch (priority) {
      case Priority.CRITICAL:
        return 30 * 60 * 1000 // 30 minutes
      case Priority.HIGH:
        return 2 * 60 * 60 * 1000 // 2 hours
      case Priority.MEDIUM:
        return 4 * 60 * 60 * 1000 // 4 hours
      case Priority.LOW:
        return 8 * 60 * 60 * 1000 // 8 hours
      default:
        return 4 * 60 * 60 * 1000
    }
  }

  private calculateDeferralScore(reminder: Reminder, context: UserContext): number {
    let score = 0
    
    // Availability impact
    switch (context.availability) {
      case AvailabilityStatus.DO_NOT_DISTURB:
        score += 0.9
        break
      case AvailabilityStatus.BUSY:
        score += 0.6
        break
      case AvailabilityStatus.AWAY:
        score += 0.8
        break
    }
    
    // Interruptibility impact
    switch (context.interruptibility) {
      case InterruptibilityLevel.NONE:
        score += 0.9
        break
      case InterruptibilityLevel.LOW:
        score += 0.6
        break
      case InterruptibilityLevel.MEDIUM:
        score += 0.3
        break
    }
    
    // Activity impact
    switch (context.currentActivity) {
      case ActivityType.SLEEPING:
        score += 0.9
        break
      case ActivityType.WORKING:
        score += 0.5
        break
      case ActivityType.EATING:
        score += 0.4
        break
    }
    
    // Priority adjustment
    const priorityAdjustment = (Priority.CRITICAL - reminder.priority) * 0.2
    score += priorityAdjustment
    
    return Math.min(Math.max(score, 0), 1)
  }

  private getDeferralReason(context: UserContext, score: number): string {
    if (context.availability === AvailabilityStatus.DO_NOT_DISTURB) {
      return 'User is in do not disturb mode'
    }
    if (context.currentActivity === ActivityType.SLEEPING) {
      return 'User is sleeping'
    }
    if (context.interruptibility === InterruptibilityLevel.NONE) {
      return 'User should not be interrupted'
    }
    if (context.availability === AvailabilityStatus.BUSY) {
      return 'User is currently busy'
    }
    return 'Suboptimal timing for reminder delivery'
  }

  private suggestAlternativeDeliveryMethods(context: UserContext, reminder: Reminder): NotificationMethod[] {
    // Return alternative delivery methods based on context
    const alternatives: NotificationMethod[] = []
    
    if (!context.deviceProximity.isNearby) {
      // User not near device - suggest visual notification
      alternatives.push(NotificationMethod.VISUAL)
    }
    
    if (context.currentActivity === ActivityType.WORKING) {
      // During work - suggest less intrusive methods
      alternatives.push(NotificationMethod.VISUAL, NotificationMethod.SOUND)
    }
    
    return alternatives
  }

  private getOptimalBatchSize(context: UserContext): number {
    // Adjust batch size based on context
    if (context.interruptibility === InterruptibilityLevel.HIGH) {
      return 5 // Can handle more reminders
    } else if (context.interruptibility === InterruptibilityLevel.MEDIUM) {
      return 3
    } else {
      return 1 // Minimal interruption
    }
  }

  private canBatchTogether(reminder1: Reminder, reminder2: Reminder): boolean {
    // Check if reminders can be batched together
    const timeDiff = Math.abs(reminder1.triggerTime.getTime() - reminder2.triggerTime.getTime())
    const maxTimeDiff = 5 * 60 * 1000 // 5 minutes
    
    return timeDiff <= maxTimeDiff && 
           reminder1.priority === reminder2.priority &&
           reminder1.deliveryMethods.some(m => reminder2.deliveryMethods.includes(m))
  }

  private createBatch(reminders: Reminder[], context: UserContext): ReminderBatch {
    const primaryMethod = reminders[0].deliveryMethods[0]
    const maxPriority = Math.max(...reminders.map(r => r.priority))
    
    return {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reminders,
      batchTime: new Date(),
      deliveryMethod: primaryMethod,
      priority: maxPriority,
      estimatedDeliveryTime: new Date()
    }
  }

  private async updatePatternsFromCorrections(userId: string, corrections: ContextCorrection[]): Promise<void> {
    // Learn from user corrections to improve predictions
    const patterns = this.behaviorPatterns.get(userId) || []
    
    for (const correction of corrections) {
      // Update or create patterns based on corrections
      if (correction.importance > 0.7) {
        // High importance correction - update patterns
        this.updatePatternFromCorrection(userId, correction, patterns)
      }
    }
    
    this.behaviorPatterns.set(userId, patterns)
  }

  private updatePatternFromCorrection(userId: string, correction: ContextCorrection, patterns: BehaviorPattern[]): void {
    // Simple pattern update - in real implementation would use ML
    const existingPattern = patterns.find(p => 
      p.patternType === this.getPatternTypeFromField(correction.field)
    )
    
    if (existingPattern) {
      existingPattern.confidence = Math.max(0.1, existingPattern.confidence - 0.1)
      existingPattern.lastObserved = new Date()
    }
  }

  private getPatternTypeFromField(field: string): PatternType {
    switch (field) {
      case 'currentActivity':
        return PatternType.WORK_HOURS
      case 'availability':
        return PatternType.RESPONSE_PREFERENCE
      default:
        return PatternType.RESPONSE_PREFERENCE
    }
  }

  private updateBehaviorPatterns(userId: string, feedback: ContextFeedback): void {
    const patterns = this.behaviorPatterns.get(userId) || []
    
    // Simple pattern learning - would be more sophisticated in real implementation
    const timePattern: BehaviorPattern = {
      patternType: PatternType.RESPONSE_PREFERENCE,
      frequency: 1,
      confidence: feedback.accuracy,
      lastObserved: new Date(),
      metadata: {
        timeOfDay: feedback.contextTime.getHours(),
        dayOfWeek: feedback.contextTime.getDay()
      }
    }
    
    patterns.push(timePattern)
    
    // Keep only recent patterns
    const recentPatterns = patterns
      .filter(p => Date.now() - p.lastObserved.getTime() < 30 * 24 * 60 * 60 * 1000) // 30 days
      .slice(-50) // Keep last 50 patterns
    
    this.behaviorPatterns.set(userId, recentPatterns)
  }

  private mergeContextData(currentContext: UserContext, newData: any): UserContext {
    return {
      ...currentContext,
      ...newData,
      lastUpdated: new Date()
    }
  }

  private hasSignificantContextChange(oldContext: UserContext, newContext: UserContext): boolean {
    return oldContext.currentActivity !== newContext.currentActivity ||
           oldContext.availability !== newContext.availability ||
           oldContext.location.type !== newContext.location.type
  }

  private getContextChangeType(oldContext: UserContext, newContext: UserContext): string {
    if (oldContext.currentActivity !== newContext.currentActivity) {
      return 'activity_change'
    }
    if (oldContext.availability !== newContext.availability) {
      return 'availability_change'
    }
    if (oldContext.location.type !== newContext.location.type) {
      return 'location_change'
    }
    return 'general_change'
  }

  private async reconstructContextFromFeedback(userId: string, feedback: ReminderFeedback): Promise<UserContext> {
    // Try to get context from cache first
    const cachedContext = this.userContexts.get(userId)
    if (cachedContext) {
      return cachedContext
    }
    
    // Reconstruct basic context from feedback timing
    const feedbackTime = feedback.feedbackTime
    
    return {
      userId,
      currentActivity: this.inferActivityFromTime(feedbackTime),
      location: {
        name: 'Unknown',
        type: LocationType.HOME, // Default assumption
        confidence: 0.5
      },
      availability: this.inferAvailabilityFromTime(feedbackTime),
      interruptibility: InterruptibilityLevel.MEDIUM,
      deviceProximity: {
        isNearby: true, // Assumption since they provided feedback
        lastSeen: feedbackTime,
        deviceType: 'home_assistant'
      },
      timeOfDay: {
        hour: feedbackTime.getHours(),
        dayOfWeek: feedbackTime.getDay(),
        isWeekend: feedbackTime.getDay() === 0 || feedbackTime.getDay() === 6,
        isHoliday: this.checkIfHoliday(feedbackTime),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      historicalPatterns: this.behaviorPatterns.get(userId) || [],
      lastUpdated: feedbackTime
    }
  }

  private inferActivityFromTime(time: Date): ActivityType {
    const hour = time.getHours()
    const dayOfWeek = time.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    if (hour >= 22 || hour <= 6) {
      return ActivityType.SLEEPING
    } else if (hour >= 9 && hour <= 17 && !isWeekend) {
      return ActivityType.WORKING
    } else if ((hour >= 7 && hour <= 8) || (hour >= 12 && hour <= 13) || (hour >= 18 && hour <= 19)) {
      return ActivityType.EATING
    } else {
      return ActivityType.RELAXING
    }
  }

  private inferAvailabilityFromTime(time: Date): AvailabilityStatus {
    const hour = time.getHours()
    
    if (hour >= 22 || hour <= 6) {
      return AvailabilityStatus.DO_NOT_DISTURB
    } else if (hour >= 9 && hour <= 17) {
      return AvailabilityStatus.BUSY
    } else {
      return AvailabilityStatus.AVAILABLE
    }
  }
}