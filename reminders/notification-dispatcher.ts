// Notification dispatcher for multi-channel reminder delivery

import { EventEmitter } from 'events'
import { 
  Reminder, 
  UserContext, 
  NotificationMethod, 
  ReminderError, 
  ReminderErrorType,
  CompletionStatus,
  Priority
} from './types'
import { scheduleEventBus } from '../scheduling/events'

export interface NotificationDispatcher {
  sendReminder(reminder: Reminder, context: UserContext): Promise<DeliveryResult>
  sendFamilyNotification(notification: FamilyNotification): Promise<DeliveryResult[]>
  escalateReminder(reminderId: string, escalationLevel: number): Promise<DeliveryResult>
  batchNotifications(notifications: Notification[]): Promise<BatchDeliveryResult>
  confirmDelivery(notificationId: string, feedback: DeliveryFeedback): Promise<void>
  updateDeliveryPreferences(userId: string, preferences: NotificationPreferences): Promise<void>
}

export interface DeliveryResult {
  success: boolean
  notificationId: string
  deliveryMethod: NotificationMethod
  deliveryTime: Date
  userResponse?: UserResponse
  requiresEscalation: boolean
  errorMessage?: string
  retryCount: number
}

export interface FamilyNotification {
  id: string
  familyId: string
  title: string
  message: string
  priority: Priority
  targetMembers: string[]
  deliveryMethods: NotificationMethod[]
  expiresAt?: Date
  requiresResponse: boolean
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  priority: Priority
  deliveryMethod: NotificationMethod
  scheduledTime: Date
  expiresAt?: Date
  metadata?: Record<string, any>
}

export interface BatchDeliveryResult {
  totalNotifications: number
  successfulDeliveries: number
  failedDeliveries: number
  results: DeliveryResult[]
  batchId: string
  completedAt: Date
}

export interface DeliveryFeedback {
  notificationId: string
  userId: string
  response: UserResponse
  responseTime: Date
  wasHelpful: boolean
  rating?: number
  comment?: string
}

export enum UserResponse {
  ACKNOWLEDGED = 'acknowledged',
  DISMISSED = 'dismissed',
  SNOOZED = 'snoozed',
  COMPLETED = 'completed',
  NO_RESPONSE = 'no_response'
}

export interface NotificationPreferences {
  userId: string
  preferredMethods: NotificationMethod[]
  quietHours: QuietHours
  escalationEnabled: boolean
  maxEscalations: number
  batchingEnabled: boolean
  personalizedMessages: boolean
  avatarExpressions: boolean
  voiceSettings: VoiceSettings
}

export interface QuietHours {
  enabled: boolean
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  daysOfWeek: number[] // 0-6, Sunday = 0
  emergencyOverride: boolean
}

export interface VoiceSettings {
  enabled: boolean
  volume: number // 0-100
  speed: number // 0.5-2.0
  pitch: number // 0.5-2.0
  voice: string
  language: string
}

// Voice integration interface
export interface VoiceNotificationService {
  speakReminder(reminder: Reminder, context: UserContext): Promise<VoiceDeliveryResult>
  speakMessage(message: string, settings: VoiceSettings): Promise<VoiceDeliveryResult>
  isVoiceAvailable(): Promise<boolean>
  getAvailableVoices(): Promise<VoiceOption[]>
}

export interface VoiceDeliveryResult {
  success: boolean
  duration: number
  audioLevel: number
  interrupted: boolean
  errorMessage?: string
}

export interface VoiceOption {
  id: string
  name: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  isDefault: boolean
}

// Avatar integration interface
export interface AvatarNotificationService {
  displayReminderWithExpression(reminder: Reminder, context: UserContext): Promise<AvatarDeliveryResult>
  showNotificationBubble(message: string, duration: number): Promise<AvatarDeliveryResult>
  expressEmotion(emotion: AvatarEmotion, intensity: number): Promise<void>
  isAvatarAvailable(): Promise<boolean>
}

export interface AvatarDeliveryResult {
  success: boolean
  displayDuration: number
  userInteraction: boolean
  expressionUsed: string
  errorMessage?: string
}

export enum AvatarEmotion {
  NEUTRAL = 'neutral',
  HAPPY = 'happy',
  CONCERNED = 'concerned',
  EXCITED = 'excited',
  GENTLE = 'gentle',
  URGENT = 'urgent'
}

// Visual notification interface
export interface VisualNotificationService {
  showPopup(notification: Notification): Promise<VisualDeliveryResult>
  showBanner(message: string, duration: number): Promise<VisualDeliveryResult>
  flashScreen(color: string, duration: number): Promise<VisualDeliveryResult>
  isDisplayAvailable(): Promise<boolean>
}

export interface VisualDeliveryResult {
  success: boolean
  displayDuration: number
  userDismissed: boolean
  clickedThrough: boolean
  errorMessage?: string
}

/**
 * Main notification dispatcher implementation
 * Coordinates multi-channel reminder delivery with intelligent routing
 */
export class NotificationDispatcherImpl extends EventEmitter implements NotificationDispatcher {
  private voiceService?: VoiceNotificationService
  private avatarService?: AvatarNotificationService
  private visualService?: VisualNotificationService
  private userPreferences: Map<string, NotificationPreferences> = new Map()
  private activeDeliveries: Map<string, DeliveryResult> = new Map()
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    voiceService?: VoiceNotificationService,
    avatarService?: AvatarNotificationService,
    visualService?: VisualNotificationService
  ) {
    super()
    this.voiceService = voiceService
    this.avatarService = avatarService
    this.visualService = visualService
    
    // Listen for system events
    scheduleEventBus.on('reminder:triggered', this.handleReminderTriggered.bind(this))
    scheduleEventBus.on('system:performance:warning', this.handlePerformanceWarning.bind(this))
  }

  /**
   * Send a reminder through the most appropriate delivery method
   */
  async sendReminder(reminder: Reminder, context: UserContext): Promise<DeliveryResult> {
    const notificationId = `${reminder.id}-${Date.now()}`
    
    try {
      // Validate child-appropriate content
      await this.validateChildSafeContent(reminder)
      
      // Get user preferences
      const preferences = await this.getUserPreferences(reminder.userId)
      
      // Check quiet hours
      if (this.isQuietHours(preferences, context)) {
        return this.deferReminder(reminder, context, notificationId)
      }
      
      // Select optimal delivery method
      const deliveryMethod = this.selectDeliveryMethod(reminder, context, preferences)
      
      // Deliver notification
      const result = await this.deliverNotification(reminder, deliveryMethod, context, notificationId)
      
      // Store result for tracking
      this.activeDeliveries.set(notificationId, result)
      
      // Schedule escalation if needed
      if (!result.success && reminder.escalationRules.length > 0) {
        this.scheduleEscalation(reminder, 0, notificationId)
      }
      
      // Emit delivery event
      scheduleEventBus.emit('reminder:delivered', {
        reminderId: reminder.id,
        deliveryMethod: deliveryMethod.toString(),
        deliveryTime: result.deliveryTime,
        success: result.success,
        userResponse: result.userResponse?.toString()
      })
      
      return result
      
    } catch (error) {
      const errorResult: DeliveryResult = {
        success: false,
        notificationId,
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
   * Send notifications to multiple family members
   */
  async sendFamilyNotification(notification: FamilyNotification): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = []
    
    for (const memberId of notification.targetMembers) {
      try {
        const memberReminder: Reminder = {
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
        
        // Get member context (simplified for family notifications)
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
        
        const result = await this.sendReminder(memberReminder, context)
        results.push(result)
        
      } catch (error) {
        results.push({
          success: false,
          notificationId: `family-${notification.id}-${memberId}`,
          deliveryMethod: NotificationMethod.VISUAL,
          deliveryTime: new Date(),
          requiresEscalation: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          retryCount: 0
        })
      }
    }
    
    return results
  }

  /**
   * Escalate a reminder to the next level
   */
  async escalateReminder(reminderId: string, escalationLevel: number): Promise<DeliveryResult> {
    // Implementation for escalation logic
    // This would retrieve the original reminder and apply escalation rules
    throw new Error('Escalation not yet implemented')
  }

  /**
   * Batch multiple notifications for efficient delivery
   */
  async batchNotifications(notifications: Notification[]): Promise<BatchDeliveryResult> {
    const batchId = `batch-${Date.now()}`
    const results: DeliveryResult[] = []
    
    // Group notifications by user and delivery method
    const groupedNotifications = this.groupNotifications(notifications)
    
    for (const [key, group] of groupedNotifications) {
      try {
        const batchResult = await this.deliverBatch(group, batchId)
        results.push(...batchResult)
      } catch (error) {
        // Add failed results for the entire group
        group.forEach(notification => {
          results.push({
            success: false,
            notificationId: notification.id,
            deliveryMethod: notification.deliveryMethod,
            deliveryTime: new Date(),
            requiresEscalation: false,
            errorMessage: error instanceof Error ? error.message : 'Batch delivery failed',
            retryCount: 0
          })
        })
      }
    }
    
    return {
      totalNotifications: notifications.length,
      successfulDeliveries: results.filter(r => r.success).length,
      failedDeliveries: results.filter(r => !r.success).length,
      results,
      batchId,
      completedAt: new Date()
    }
  }

  /**
   * Confirm delivery and process user feedback
   */
  async confirmDelivery(notificationId: string, feedback: DeliveryFeedback): Promise<void> {
    const delivery = this.activeDeliveries.get(notificationId)
    if (!delivery) {
      throw new Error(`Delivery not found: ${notificationId}`)
    }
    
    // Update delivery result with user response
    delivery.userResponse = feedback.response
    
    // Cancel any pending escalations
    const escalationTimer = this.escalationTimers.get(notificationId)
    if (escalationTimer) {
      clearTimeout(escalationTimer)
      this.escalationTimers.delete(notificationId)
    }
    
    // Process feedback for learning
    await this.processFeedback(feedback)
    
    // Clean up
    this.activeDeliveries.delete(notificationId)
  }

  /**
   * Update user notification preferences
   */
  async updateDeliveryPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    // Validate preferences
    await this.validatePreferences(preferences)
    
    // Store preferences
    this.userPreferences.set(userId, preferences)
    
    // Emit preferences updated event
    this.emit('preferences:updated', { userId, preferences })
  }

  // Private helper methods

  private async validateChildSafeContent(reminder: Reminder): Promise<void> {
    // Implement child safety validation
    // This should integrate with the safety validator from the design
    const content = `${reminder.title} ${reminder.description}`
    
    // Basic validation - in real implementation, this would use the safety validator
    const inappropriateWords = ['dangerous', 'harmful', 'inappropriate']
    for (const word of inappropriateWords) {
      if (content.toLowerCase().includes(word)) {
        throw new Error(`Content failed child safety validation: contains "${word}"`)
      }
    }
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = this.userPreferences.get(userId)
    if (preferences) {
      return preferences
    }
    
    // Return default preferences
    return {
      userId,
      preferredMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        emergencyOverride: true
      },
      escalationEnabled: true,
      maxEscalations: 3,
      batchingEnabled: true,
      personalizedMessages: true,
      avatarExpressions: true,
      voiceSettings: {
        enabled: true,
        volume: 70,
        speed: 1.0,
        pitch: 1.0,
        voice: 'default',
        language: 'en-US'
      }
    }
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
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime
    } else {
      return currentTime >= startTime && currentTime <= endTime
    }
  }

  private deferReminder(reminder: Reminder, context: UserContext, notificationId: string): DeliveryResult {
    // Calculate next available time after quiet hours
    const preferences = this.userPreferences.get(reminder.userId)!
    const [endHour, endMinute] = preferences.quietHours.endTime.split(':').map(Number)
    
    const nextDelivery = new Date()
    nextDelivery.setHours(endHour, endMinute, 0, 0)
    
    // If end time is today but already passed, schedule for tomorrow
    if (nextDelivery <= new Date()) {
      nextDelivery.setDate(nextDelivery.getDate() + 1)
    }
    
    return {
      success: false,
      notificationId,
      deliveryMethod: NotificationMethod.VISUAL,
      deliveryTime: new Date(),
      requiresEscalation: false,
      errorMessage: `Deferred until ${nextDelivery.toLocaleTimeString()} (quiet hours)`,
      retryCount: 0
    }
  }

  private selectDeliveryMethod(
    reminder: Reminder, 
    context: UserContext, 
    preferences: NotificationPreferences
  ): NotificationMethod {
    // Priority-based method selection
    const availableMethods = reminder.deliveryMethods.filter(method => 
      preferences.preferredMethods.includes(method)
    )
    
    if (availableMethods.length === 0) {
      return NotificationMethod.VISUAL // Fallback
    }
    
    // Consider context for method selection
    switch (context.interruptibility) {
      case 'high':
        return availableMethods.includes(NotificationMethod.VOICE) 
          ? NotificationMethod.VOICE 
          : availableMethods[0]
      case 'medium':
        return availableMethods.includes(NotificationMethod.AVATAR)
          ? NotificationMethod.AVATAR
          : availableMethods[0]
      case 'low':
        return availableMethods.includes(NotificationMethod.VISUAL)
          ? NotificationMethod.VISUAL
          : availableMethods[0]
      default:
        return availableMethods[0]
    }
  }

  private async deliverNotification(
    reminder: Reminder,
    method: NotificationMethod,
    context: UserContext,
    notificationId: string
  ): Promise<DeliveryResult> {
    const startTime = new Date()
    
    try {
      switch (method) {
        case NotificationMethod.VOICE:
          return await this.deliverVoiceNotification(reminder, context, notificationId)
        case NotificationMethod.AVATAR:
          return await this.deliverAvatarNotification(reminder, context, notificationId)
        case NotificationMethod.VISUAL:
          return await this.deliverVisualNotification(reminder, context, notificationId)
        default:
          throw new Error(`Unsupported delivery method: ${method}`)
      }
    } catch (error) {
      return {
        success: false,
        notificationId,
        deliveryMethod: method,
        deliveryTime: startTime,
        requiresEscalation: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      }
    }
  }

  private async deliverVoiceNotification(
    reminder: Reminder,
    context: UserContext,
    notificationId: string
  ): Promise<DeliveryResult> {
    if (!this.voiceService) {
      throw new Error('Voice service not available')
    }
    
    const isAvailable = await this.voiceService.isVoiceAvailable()
    if (!isAvailable) {
      throw new Error('Voice system not available')
    }
    
    const result = await this.voiceService.speakReminder(reminder, context)
    
    return {
      success: result.success,
      notificationId,
      deliveryMethod: NotificationMethod.VOICE,
      deliveryTime: new Date(),
      requiresEscalation: !result.success,
      errorMessage: result.errorMessage,
      retryCount: 0
    }
  }

  private async deliverAvatarNotification(
    reminder: Reminder,
    context: UserContext,
    notificationId: string
  ): Promise<DeliveryResult> {
    if (!this.avatarService) {
      throw new Error('Avatar service not available')
    }
    
    const isAvailable = await this.avatarService.isAvatarAvailable()
    if (!isAvailable) {
      throw new Error('Avatar system not available')
    }
    
    const result = await this.avatarService.displayReminderWithExpression(reminder, context)
    
    return {
      success: result.success,
      notificationId,
      deliveryMethod: NotificationMethod.AVATAR,
      deliveryTime: new Date(),
      requiresEscalation: !result.success,
      errorMessage: result.errorMessage,
      retryCount: 0,
      userResponse: result.userInteraction ? UserResponse.ACKNOWLEDGED : UserResponse.NO_RESPONSE
    }
  }

  private async deliverVisualNotification(
    reminder: Reminder,
    context: UserContext,
    notificationId: string
  ): Promise<DeliveryResult> {
    if (!this.visualService) {
      throw new Error('Visual service not available')
    }
    
    const isAvailable = await this.visualService.isDisplayAvailable()
    if (!isAvailable) {
      throw new Error('Display system not available')
    }
    
    const notification: Notification = {
      id: notificationId,
      userId: reminder.userId,
      title: reminder.title,
      message: reminder.description,
      priority: reminder.priority,
      deliveryMethod: NotificationMethod.VISUAL,
      scheduledTime: new Date()
    }
    
    const result = await this.visualService.showPopup(notification)
    
    return {
      success: result.success,
      notificationId,
      deliveryMethod: NotificationMethod.VISUAL,
      deliveryTime: new Date(),
      requiresEscalation: !result.success,
      errorMessage: result.errorMessage,
      retryCount: 0,
      userResponse: result.userDismissed ? UserResponse.DISMISSED : 
                   result.clickedThrough ? UserResponse.ACKNOWLEDGED : UserResponse.NO_RESPONSE
    }
  }

  private scheduleEscalation(reminder: Reminder, level: number, notificationId: string): void {
    if (level >= reminder.escalationRules.length) {
      return // No more escalation rules
    }
    
    const rule = reminder.escalationRules[level]
    const timer = setTimeout(async () => {
      try {
        await this.escalateReminder(reminder.id, level + 1)
      } catch (error) {
        console.error(`Escalation failed for reminder ${reminder.id}:`, error)
      }
    }, rule.delayMinutes * 60 * 1000)
    
    this.escalationTimers.set(notificationId, timer)
  }

  private groupNotifications(notifications: Notification[]): Map<string, Notification[]> {
    const groups = new Map<string, Notification[]>()
    
    for (const notification of notifications) {
      const key = `${notification.userId}-${notification.deliveryMethod}`
      const group = groups.get(key) || []
      group.push(notification)
      groups.set(key, group)
    }
    
    return groups
  }

  private async deliverBatch(notifications: Notification[], batchId: string): Promise<DeliveryResult[]> {
    // Simplified batch delivery - in real implementation, this would optimize delivery
    const results: DeliveryResult[] = []
    
    for (const notification of notifications) {
      // Convert notification to reminder for delivery
      const reminder: Reminder = {
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
      
      const context: UserContext = {
        userId: notification.userId,
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
      
      const result = await this.sendReminder(reminder, context)
      results.push(result)
    }
    
    return results
  }

  private async processFeedback(feedback: DeliveryFeedback): Promise<void> {
    // Store feedback for learning and adaptation
    this.emit('feedback:received', feedback)
  }

  private async validatePreferences(preferences: NotificationPreferences): Promise<void> {
    // Validate preference values
    if (preferences.voiceSettings.volume < 0 || preferences.voiceSettings.volume > 100) {
      throw new Error('Voice volume must be between 0 and 100')
    }
    
    if (preferences.voiceSettings.speed < 0.5 || preferences.voiceSettings.speed > 2.0) {
      throw new Error('Voice speed must be between 0.5 and 2.0')
    }
    
    if (preferences.maxEscalations < 0 || preferences.maxEscalations > 10) {
      throw new Error('Max escalations must be between 0 and 10')
    }
  }

  private handleReminderTriggered(data: any): void {
    // Handle reminder triggered events from the event bus
    console.log('Reminder triggered:', data.reminderId)
  }

  private handlePerformanceWarning(data: any): void {
    // Handle performance warnings by adjusting delivery strategies
    if (data.component === 'NotificationDispatcher') {
      console.warn('Performance warning in notification dispatcher:', data)
      // Could implement adaptive delivery strategies here
    }
  }
}