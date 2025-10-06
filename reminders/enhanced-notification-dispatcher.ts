// Enhanced notification dispatcher with full avatar and voice integration

import { EventEmitter } from 'events'
import { 
  NotificationDispatcher,
  DeliveryResult,
  FamilyNotification,
  Notification,
  BatchDeliveryResult,
  DeliveryFeedback,
  NotificationPreferences,
  UserResponse
} from './notification-dispatcher'
import { 
  VoiceNotificationService,
  createVoiceNotificationService
} from './voice-notification-service'
import { 
  AvatarNotificationService,
  createAvatarNotificationService
} from './avatar-notification-service'
import { 
  VisualNotificationService,
  createVisualNotificationService
} from './visual-notification-service'
import { 
  AvatarVoiceIntegration,
  createAvatarVoiceIntegration,
  MultiModalDeliveryResult
} from './avatar-voice-integration'
import { 
  Reminder, 
  UserContext, 
  NotificationMethod,
  CompletionStatus,
  Priority
} from './types'
import { scheduleEventBus } from '../scheduling/events'

/**
 * Enhanced notification dispatcher with full multi-modal integration
 * Provides intelligent, child-safe, and engaging reminder delivery
 */
export class EnhancedNotificationDispatcher extends EventEmitter implements NotificationDispatcher {
  private voiceService: VoiceNotificationService
  private avatarService: AvatarNotificationService
  private visualService: VisualNotificationService
  private avatarVoiceIntegration: AvatarVoiceIntegration
  
  private userPreferences: Map<string, NotificationPreferences> = new Map()
  private activeDeliveries: Map<string, DeliveryResult> = new Map()
  private deliveryHistory: Map<string, DeliveryHistoryEntry[]> = new Map()
  private performanceMetrics: PerformanceMetrics = {
    totalDeliveries: 0,
    successfulDeliveries: 0,
    averageResponseTime: 0,
    userEngagementRate: 0,
    childSafetyViolations: 0
  }

  constructor() {
    super()
    
    // Initialize services
    this.voiceService = createVoiceNotificationService()
    this.avatarService = createAvatarNotificationService()
    this.visualService = createVisualNotificationService()
    this.avatarVoiceIntegration = createAvatarVoiceIntegration(
      this.voiceService,
      this.avatarService
    )
    
    // Set up event listeners
    this.setupEventListeners()
    
    // Initialize performance monitoring
    this.initializePerformanceMonitoring()
  }

  /**
   * Send a reminder with intelligent delivery method selection
   */
  async sendReminder(reminder: Reminder, context: UserContext): Promise<DeliveryResult> {
    const deliveryId = `enhanced-${reminder.id}-${Date.now()}`
    const startTime = Date.now()
    
    try {
      // Update performance metrics
      this.performanceMetrics.totalDeliveries++
      
      // Validate child-appropriate content
      await this.validateChildSafeContent(reminder)
      
      // Get user preferences
      const preferences = await this.getUserPreferences(reminder.userId)
      
      // Check quiet hours and context constraints
      if (await this.shouldDeferDelivery(reminder, context, preferences)) {
        return this.createDeferredResult(deliveryId, reminder, context)
      }
      
      // Select optimal delivery strategy
      const deliveryStrategy = await this.selectDeliveryStrategy(reminder, context, preferences)
      
      // Execute delivery based on strategy
      let result: DeliveryResult
      
      switch (deliveryStrategy.type) {
        case 'multimodal':
          result = await this.executeMultiModalDelivery(reminder, context, deliveryId)
          break
        case 'voice-primary':
          result = await this.executeVoicePrimaryDelivery(reminder, context, deliveryId)
          break
        case 'avatar-primary':
          result = await this.executeAvatarPrimaryDelivery(reminder, context, deliveryId)
          break
        case 'visual-only':
          result = await this.executeVisualOnlyDelivery(reminder, context, deliveryId)
          break
        default:
          result = await this.executeFallbackDelivery(reminder, context, deliveryId)
      }
      
      // Update performance metrics
      if (result.success) {
        this.performanceMetrics.successfulDeliveries++
      }
      
      const responseTime = Date.now() - startTime
      this.updateAverageResponseTime(responseTime)
      
      // Store delivery result
      this.activeDeliveries.set(deliveryId, result)
      this.recordDeliveryHistory(reminder.userId, result, deliveryStrategy)
      
      // Emit delivery event
      scheduleEventBus.emit('reminder:delivered', {
        reminderId: reminder.id,
        deliveryMethod: result.deliveryMethod.toString(),
        deliveryTime: result.deliveryTime,
        success: result.success,
        userResponse: result.userResponse?.toString()
      })
      
      // Schedule follow-up if needed
      if (result.success && !result.userResponse) {
        this.scheduleFollowUp(reminder, result, deliveryStrategy)
      }
      
      return result
      
    } catch (error) {
      // Handle child safety violations
      if (error instanceof Error && error.message.includes('child safety')) {
        this.performanceMetrics.childSafetyViolations++
        
        scheduleEventBus.emit('system:error', {
          component: 'EnhancedNotificationDispatcher',
          errorType: 'ChildSafetyViolation',
          errorMessage: error.message,
          timestamp: new Date(),
          userId: reminder.userId
        })
      }
      
      const errorResult: DeliveryResult = {
        success: false,
        notificationId: deliveryId,
        deliveryMethod: NotificationMethod.VISUAL,
        deliveryTime: new Date(),
        requiresEscalation: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      }
      
      scheduleEventBus.emit('reminder:failed', {
        reminderId: reminder.id,
        failureTime: new Date(),
        errorType: 'DeliveryError',
        errorMessage: errorResult.errorMessage || 'Unknown error',
        retryCount: 0,
        canRetry: true
      })
      
      return errorResult
    }
  }

  /**
   * Send family notifications with coordinated delivery
   */
  async sendFamilyNotification(notification: FamilyNotification): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = []
    
    try {
      // Validate family notification content
      await this.validateFamilyNotificationContent(notification)
      
      // Create coordinated delivery plan for family members
      const deliveryPlan = await this.createFamilyDeliveryPlan(notification)
      
      // Execute coordinated delivery
      for (const memberPlan of deliveryPlan.memberPlans) {
        try {
          const memberReminder = this.createReminderFromFamilyNotification(
            notification, 
            memberPlan.memberId
          )
          
          const result = await this.sendReminder(memberReminder, memberPlan.context)
          results.push(result)
          
        } catch (error) {
          results.push(this.createErrorResult(
            `family-${notification.id}-${memberPlan.memberId}`,
            error instanceof Error ? error.message : 'Family delivery failed'
          ))
        }
      }
      
      // Emit family delivery event
      this.emit('family:notification:delivered', {
        familyNotificationId: notification.id,
        results,
        timestamp: new Date()
      })
      
      return results
      
    } catch (error) {
      // Return error results for all target members
      return notification.targetMembers.map(memberId => 
        this.createErrorResult(
          `family-${notification.id}-${memberId}`,
          error instanceof Error ? error.message : 'Family notification failed'
        )
      )
    }
  }

  /**
   * Escalate reminder with enhanced strategies
   */
  async escalateReminder(reminderId: string, escalationLevel: number): Promise<DeliveryResult> {
    // Enhanced escalation implementation
    throw new Error('Enhanced escalation not yet implemented')
  }

  /**
   * Batch notifications with intelligent grouping
   */
  async batchNotifications(notifications: Notification[]): Promise<BatchDeliveryResult> {
    const batchId = `enhanced-batch-${Date.now()}`
    const results: DeliveryResult[] = []
    
    try {
      // Group notifications intelligently
      const groups = await this.createIntelligentGroups(notifications)
      
      // Process each group
      for (const group of groups) {
        const groupResults = await this.processBatchGroup(group, batchId)
        results.push(...groupResults)
      }
      
      return {
        totalNotifications: notifications.length,
        successfulDeliveries: results.filter(r => r.success).length,
        failedDeliveries: results.filter(r => !r.success).length,
        results,
        batchId,
        completedAt: new Date()
      }
      
    } catch (error) {
      throw new Error(`Batch processing failed: ${error}`)
    }
  }

  /**
   * Confirm delivery with enhanced feedback processing
   */
  async confirmDelivery(notificationId: string, feedback: DeliveryFeedback): Promise<void> {
    const delivery = this.activeDeliveries.get(notificationId)
    if (!delivery) {
      throw new Error(`Delivery not found: ${notificationId}`)
    }
    
    try {
      // Update delivery result
      delivery.userResponse = feedback.response
      
      // Process feedback for learning
      await this.processEnhancedFeedback(feedback, delivery)
      
      // Update user engagement metrics
      this.updateUserEngagementMetrics(feedback)
      
      // Clean up
      this.activeDeliveries.delete(notificationId)
      
      // Emit feedback event
      this.emit('delivery:confirmed', {
        notificationId,
        feedback,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('Failed to confirm delivery:', error)
      throw error
    }
  }

  /**
   * Update delivery preferences with validation
   */
  async updateDeliveryPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    try {
      // Validate preferences for child safety
      await this.validatePreferencesForChildSafety(preferences)
      
      // Store preferences
      this.userPreferences.set(userId, preferences)
      
      // Emit preferences updated event
      this.emit('preferences:updated', { 
        userId, 
        preferences,
        timestamp: new Date()
      })
      
    } catch (error) {
      throw new Error(`Failed to update preferences: ${error}`)
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Get delivery history for a user
   */
  getDeliveryHistory(userId: string): DeliveryHistoryEntry[] {
    return this.deliveryHistory.get(userId) || []
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for avatar-voice integration events
    this.avatarVoiceIntegration.on('multimodal:delivered', (data) => {
      this.emit('multimodal:delivered', data)
    })
    
    this.avatarVoiceIntegration.on('multimodal:failed', (data) => {
      this.emit('multimodal:failed', data)
    })
    
    // Listen for system performance events
    scheduleEventBus.on('system:performance:warning', (data) => {
      if (data.component === 'NotificationDispatcher') {
        this.handlePerformanceWarning(data)
      }
    })
  }

  private initializePerformanceMonitoring(): void {
    // Set up periodic performance reporting
    setInterval(() => {
      this.reportPerformanceMetrics()
    }, 60000) // Report every minute
  }

  private async validateChildSafeContent(reminder: Reminder): Promise<void> {
    // Enhanced child safety validation
    const content = `${reminder.title} ${reminder.description}`
    
    // Check for inappropriate content
    const inappropriatePatterns = [
      /\b(scary|frightening|dangerous|harmful)\b/i,
      /\b(violent|aggressive|threatening)\b/i,
      /\b(sad|angry|upset|worried)\b/i,
      /\b(fail|failure|wrong|bad)\b/i
    ]
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(content)) {
        throw new Error(`Content failed child safety validation: inappropriate pattern detected`)
      }
    }
    
    // Ensure positive tone
    const positivePatterns = [
      /\b(great|good|wonderful|awesome|fantastic)\b/i,
      /\b(remember|time|ready|let's|you can)\b/i,
      /\b(help|support|encourage|celebrate)\b/i
    ]
    
    const hasPositiveTone = positivePatterns.some(pattern => pattern.test(content))
    if (!hasPositiveTone && reminder.priority >= Priority.MEDIUM) {
      console.warn('Reminder content may benefit from more positive language')
    }
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = this.userPreferences.get(userId)
    if (preferences) {
      return preferences
    }
    
    // Return enhanced child-friendly defaults
    return {
      userId,
      preferredMethods: [NotificationMethod.AVATAR, NotificationMethod.VOICE, NotificationMethod.VISUAL],
      quietHours: {
        enabled: true,
        startTime: '20:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        emergencyOverride: true
      },
      escalationEnabled: true,
      maxEscalations: 2,
      batchingEnabled: false,
      personalizedMessages: true,
      avatarExpressions: true,
      voiceSettings: {
        enabled: true,
        volume: 65,
        speed: 0.9,
        pitch: 1.1,
        voice: 'child-friendly',
        language: 'en-US'
      }
    }
  }

  private async shouldDeferDelivery(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<boolean> {
    // Check quiet hours
    if (this.isQuietHours(preferences, context)) {
      return reminder.priority < Priority.CRITICAL
    }
    
    // Check user availability
    if (context.availability === 'do_not_disturb') {
      return reminder.priority < Priority.CRITICAL
    }
    
    // Check interruptibility
    if (context.interruptibility === 'none') {
      return reminder.priority < Priority.HIGH
    }
    
    return false
  }

  private isQuietHours(preferences: NotificationPreferences, context: UserContext): boolean {
    if (!preferences.quietHours.enabled) {
      return false
    }
    
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute
    
    const [startHour, startMinute] = preferences.quietHours.startTime.split(':').map(Number)
    const [endHour, endMinute] = preferences.quietHours.endTime.split(':').map(Number)
    const startTime = startHour * 60 + startMinute
    const endTime = endHour * 60 + endMinute
    
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime
    } else {
      return currentTime >= startTime && currentTime <= endTime
    }
  }

  private async selectDeliveryStrategy(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<DeliveryStrategy> {
    // Intelligent delivery strategy selection
    const availableServices = await this.checkServiceAvailability()
    
    // Multi-modal delivery for high engagement
    if (availableServices.voice && availableServices.avatar && 
        preferences.personalizedMessages && preferences.avatarExpressions) {
      return {
        type: 'multimodal',
        primary: NotificationMethod.AVATAR,
        secondary: NotificationMethod.VOICE,
        reasoning: 'High engagement multi-modal delivery'
      }
    }
    
    // Voice-primary for high interruptibility
    if (availableServices.voice && context.interruptibility === 'high') {
      return {
        type: 'voice-primary',
        primary: NotificationMethod.VOICE,
        secondary: NotificationMethod.VISUAL,
        reasoning: 'High interruptibility context'
      }
    }
    
    // Avatar-primary for medium engagement
    if (availableServices.avatar && preferences.avatarExpressions) {
      return {
        type: 'avatar-primary',
        primary: NotificationMethod.AVATAR,
        secondary: NotificationMethod.VISUAL,
        reasoning: 'Avatar expressions enabled'
      }
    }
    
    // Visual fallback
    return {
      type: 'visual-only',
      primary: NotificationMethod.VISUAL,
      reasoning: 'Fallback to visual delivery'
    }
  }

  private async checkServiceAvailability(): Promise<ServiceAvailability> {
    const [voice, avatar, visual] = await Promise.all([
      this.voiceService.isVoiceAvailable(),
      this.avatarService.isAvatarAvailable(),
      this.visualService.isDisplayAvailable()
    ])
    
    return { voice, avatar, visual }
  }

  private async executeMultiModalDelivery(
    reminder: Reminder,
    context: UserContext,
    deliveryId: string
  ): Promise<DeliveryResult> {
    try {
      const multiModalResult = await this.avatarVoiceIntegration.deliverMultiModalReminder(
        reminder,
        context
      )
      
      return {
        success: multiModalResult.success,
        notificationId: deliveryId,
        deliveryMethod: NotificationMethod.AVATAR, // Primary method
        deliveryTime: new Date(),
        requiresEscalation: !multiModalResult.success,
        userResponse: multiModalResult.userEngagement.responseReceived ? 
          UserResponse.ACKNOWLEDGED : UserResponse.NO_RESPONSE,
        retryCount: 0
      }
      
    } catch (error) {
      throw new Error(`Multi-modal delivery failed: ${error}`)
    }
  }

  private async executeVoicePrimaryDelivery(
    reminder: Reminder,
    context: UserContext,
    deliveryId: string
  ): Promise<DeliveryResult> {
    try {
      const voiceResult = await this.voiceService.speakReminder(reminder, context)
      
      return {
        success: voiceResult.success,
        notificationId: deliveryId,
        deliveryMethod: NotificationMethod.VOICE,
        deliveryTime: new Date(),
        requiresEscalation: !voiceResult.success,
        errorMessage: voiceResult.errorMessage,
        retryCount: 0
      }
      
    } catch (error) {
      throw new Error(`Voice-primary delivery failed: ${error}`)
    }
  }

  private async executeAvatarPrimaryDelivery(
    reminder: Reminder,
    context: UserContext,
    deliveryId: string
  ): Promise<DeliveryResult> {
    try {
      const avatarResult = await this.avatarService.displayReminderWithExpression(reminder, context)
      
      return {
        success: avatarResult.success,
        notificationId: deliveryId,
        deliveryMethod: NotificationMethod.AVATAR,
        deliveryTime: new Date(),
        requiresEscalation: !avatarResult.success,
        errorMessage: avatarResult.errorMessage,
        userResponse: avatarResult.userInteraction ? 
          UserResponse.ACKNOWLEDGED : UserResponse.NO_RESPONSE,
        retryCount: 0
      }
      
    } catch (error) {
      throw new Error(`Avatar-primary delivery failed: ${error}`)
    }
  }

  private async executeVisualOnlyDelivery(
    reminder: Reminder,
    context: UserContext,
    deliveryId: string
  ): Promise<DeliveryResult> {
    try {
      const notification: Notification = {
        id: deliveryId,
        userId: reminder.userId,
        title: reminder.title,
        message: reminder.description,
        priority: reminder.priority,
        deliveryMethod: NotificationMethod.VISUAL,
        scheduledTime: new Date()
      }
      
      const visualResult = await this.visualService.showPopup(notification)
      
      return {
        success: visualResult.success,
        notificationId: deliveryId,
        deliveryMethod: NotificationMethod.VISUAL,
        deliveryTime: new Date(),
        requiresEscalation: !visualResult.success,
        errorMessage: visualResult.errorMessage,
        userResponse: visualResult.userDismissed ? UserResponse.DISMISSED :
                     visualResult.clickedThrough ? UserResponse.ACKNOWLEDGED : UserResponse.NO_RESPONSE,
        retryCount: 0
      }
      
    } catch (error) {
      throw new Error(`Visual-only delivery failed: ${error}`)
    }
  }

  private async executeFallbackDelivery(
    reminder: Reminder,
    context: UserContext,
    deliveryId: string
  ): Promise<DeliveryResult> {
    // Fallback to visual delivery
    return this.executeVisualOnlyDelivery(reminder, context, deliveryId)
  }

  private createDeferredResult(
    deliveryId: string,
    reminder: Reminder,
    context: UserContext
  ): DeliveryResult {
    return {
      success: false,
      notificationId: deliveryId,
      deliveryMethod: NotificationMethod.VISUAL,
      deliveryTime: new Date(),
      requiresEscalation: false,
      errorMessage: 'Delivery deferred due to quiet hours or user context',
      retryCount: 0
    }
  }

  private createErrorResult(notificationId: string, errorMessage: string): DeliveryResult {
    return {
      success: false,
      notificationId,
      deliveryMethod: NotificationMethod.VISUAL,
      deliveryTime: new Date(),
      requiresEscalation: false,
      errorMessage,
      retryCount: 0
    }
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalDeliveries = this.performanceMetrics.totalDeliveries
    const currentAverage = this.performanceMetrics.averageResponseTime
    
    this.performanceMetrics.averageResponseTime = 
      ((currentAverage * (totalDeliveries - 1)) + responseTime) / totalDeliveries
  }

  private updateUserEngagementMetrics(feedback: DeliveryFeedback): void {
    const engagementBoost = feedback.wasHelpful ? 0.1 : -0.05
    this.performanceMetrics.userEngagementRate = Math.max(0, 
      Math.min(1, this.performanceMetrics.userEngagementRate + engagementBoost)
    )
  }

  private recordDeliveryHistory(
    userId: string,
    result: DeliveryResult,
    strategy: DeliveryStrategy
  ): void {
    const history = this.deliveryHistory.get(userId) || []
    
    history.push({
      deliveryId: result.notificationId,
      timestamp: result.deliveryTime,
      method: result.deliveryMethod,
      success: result.success,
      strategy: strategy.type,
      userResponse: result.userResponse,
      errorMessage: result.errorMessage
    })
    
    // Keep only last 100 entries per user
    if (history.length > 100) {
      history.shift()
    }
    
    this.deliveryHistory.set(userId, history)
  }

  private scheduleFollowUp(
    reminder: Reminder,
    result: DeliveryResult,
    strategy: DeliveryStrategy
  ): void {
    // Schedule follow-up for important reminders without user response
    if (reminder.priority >= Priority.HIGH) {
      setTimeout(() => {
        // Check if user has responded in the meantime
        const currentResult = this.activeDeliveries.get(result.notificationId)
        if (currentResult && !currentResult.userResponse) {
          // Implement follow-up logic
          console.log(`Follow-up needed for reminder ${reminder.id}`)
        }
      }, 300000) // 5 minutes
    }
  }

  private reportPerformanceMetrics(): void {
    scheduleEventBus.emit('system:performance:report', {
      component: 'EnhancedNotificationDispatcher',
      metrics: this.performanceMetrics,
      timestamp: new Date()
    })
  }

  private handlePerformanceWarning(data: any): void {
    console.warn('Performance warning in notification dispatcher:', data)
    // Implement adaptive performance strategies
  }

  // Additional helper methods for family notifications and batching
  private async validateFamilyNotificationContent(notification: FamilyNotification): Promise<void> {
    await this.validateChildSafeContent({
      id: notification.id,
      title: notification.title,
      description: notification.message
    } as Reminder)
  }

  private async createFamilyDeliveryPlan(notification: FamilyNotification): Promise<FamilyDeliveryPlan> {
    const memberPlans: FamilyMemberPlan[] = []
    
    for (const memberId of notification.targetMembers) {
      const context: UserContext = {
        userId: memberId,
        currentActivity: 'unknown' as any,
        location: { name: 'home', type: 'home' as any, confidence: 0.8 },
        availability: 'available' as any,
        interruptibility: 'medium' as any,
        deviceProximity: { isNearby: true, lastSeen: new Date(), deviceType: 'home_assistant' },
        timeOfDay: {
          hour: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          isWeekend: [0, 6].includes(new Date().getDay()),
          isHoliday: false,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }
      
      memberPlans.push({
        memberId,
        context,
        deliveryMethod: notification.deliveryMethods[0] || NotificationMethod.VISUAL
      })
    }
    
    return {
      notification,
      memberPlans,
      coordinatedDelivery: true,
      createdAt: new Date()
    }
  }

  private createReminderFromFamilyNotification(
    notification: FamilyNotification,
    memberId: string
  ): Reminder {
    return {
      id: `family-${notification.id}-${memberId}`,
      userId: memberId,
      title: notification.title,
      description: notification.message,
      type: 'time_based' as any,
      triggerTime: new Date(),
      priority: notification.priority,
      deliveryMethods: notification.deliveryMethods,
      contextConstraints: [],
      escalationRules: [],
      completionStatus: CompletionStatus.PENDING,
      snoozeHistory: [],
      userFeedback: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private async createIntelligentGroups(notifications: Notification[]): Promise<NotificationGroup[]> {
    // Group notifications by user and priority for intelligent batching
    const groups: NotificationGroup[] = []
    const userGroups = new Map<string, Notification[]>()
    
    // Group by user
    for (const notification of notifications) {
      const userNotifications = userGroups.get(notification.userId) || []
      userNotifications.push(notification)
      userGroups.set(notification.userId, userNotifications)
    }
    
    // Create groups with intelligent batching
    for (const [userId, userNotifications] of userGroups) {
      // Sort by priority
      userNotifications.sort((a, b) => b.priority - a.priority)
      
      groups.push({
        userId,
        notifications: userNotifications,
        batchStrategy: 'priority-ordered'
      })
    }
    
    return groups
  }

  private async processBatchGroup(group: NotificationGroup, batchId: string): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = []
    
    for (const notification of group.notifications) {
      try {
        const reminder = this.createReminderFromNotification(notification)
        const context = await this.getContextForUser(notification.userId)
        const result = await this.sendReminder(reminder, context)
        results.push(result)
      } catch (error) {
        results.push(this.createErrorResult(
          notification.id,
          error instanceof Error ? error.message : 'Batch processing failed'
        ))
      }
    }
    
    return results
  }

  private createReminderFromNotification(notification: Notification): Reminder {
    return {
      id: notification.id,
      userId: notification.userId,
      title: notification.title,
      description: notification.message,
      type: 'time_based' as any,
      triggerTime: notification.scheduledTime,
      priority: notification.priority,
      deliveryMethods: [notification.deliveryMethod],
      contextConstraints: [],
      escalationRules: [],
      completionStatus: CompletionStatus.PENDING,
      snoozeHistory: [],
      userFeedback: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private async getContextForUser(userId: string): Promise<UserContext> {
    // Simplified context for batch processing
    return {
      userId,
      currentActivity: 'unknown' as any,
      location: { name: 'home', type: 'home' as any, confidence: 0.8 },
      availability: 'available' as any,
      interruptibility: 'medium' as any,
      deviceProximity: { isNearby: true, lastSeen: new Date(), deviceType: 'home_assistant' },
      timeOfDay: {
        hour: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        isWeekend: [0, 6].includes(new Date().getDay()),
        isHoliday: false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      historicalPatterns: [],
      lastUpdated: new Date()
    }
  }

  private async processEnhancedFeedback(
    feedback: DeliveryFeedback,
    delivery: DeliveryResult
  ): Promise<void> {
    // Enhanced feedback processing for learning and adaptation
    this.emit('feedback:processed', {
      feedback,
      delivery,
      learningData: {
        deliveryMethod: delivery.deliveryMethod,
        success: delivery.success,
        userSatisfaction: feedback.wasHelpful,
        responseTime: feedback.responseTime.getTime() - delivery.deliveryTime.getTime()
      },
      timestamp: new Date()
    })
  }

  private async validatePreferencesForChildSafety(preferences: NotificationPreferences): Promise<void> {
    // Validate preferences for child safety
    if (preferences.voiceSettings.volume > 80) {
      throw new Error('Voice volume too high for child safety')
    }
    
    if (preferences.voiceSettings.speed > 1.5) {
      throw new Error('Voice speed too fast for child comprehension')
    }
    
    if (preferences.maxEscalations > 5) {
      throw new Error('Too many escalations may be disruptive for children')
    }
  }
}

// Supporting interfaces
interface DeliveryStrategy {
  type: 'multimodal' | 'voice-primary' | 'avatar-primary' | 'visual-only'
  primary: NotificationMethod
  secondary?: NotificationMethod
  reasoning: string
}

interface ServiceAvailability {
  voice: boolean
  avatar: boolean
  visual: boolean
}

interface PerformanceMetrics {
  totalDeliveries: number
  successfulDeliveries: number
  averageResponseTime: number
  userEngagementRate: number
  childSafetyViolations: number
}

interface DeliveryHistoryEntry {
  deliveryId: string
  timestamp: Date
  method: NotificationMethod
  success: boolean
  strategy: string
  userResponse?: UserResponse
  errorMessage?: string
}

interface FamilyDeliveryPlan {
  notification: FamilyNotification
  memberPlans: FamilyMemberPlan[]
  coordinatedDelivery: boolean
  createdAt: Date
}

interface FamilyMemberPlan {
  memberId: string
  context: UserContext
  deliveryMethod: NotificationMethod
}

interface NotificationGroup {
  userId: string
  notifications: Notification[]
  batchStrategy: string
}

/**
 * Factory function to create enhanced notification dispatcher
 */
export function createEnhancedNotificationDispatcher(): EnhancedNotificationDispatcher {
  return new EnhancedNotificationDispatcher()
}