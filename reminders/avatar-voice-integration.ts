// Avatar and voice integration for expressive reminder delivery

import { EventEmitter } from 'events'
import { 
  NotificationDispatcher,
  VoiceNotificationService,
  AvatarNotificationService,
  DeliveryResult,
  AvatarEmotion,
  VoiceSettings,
  NotificationPreferences
} from './notification-dispatcher'
import { 
  Reminder, 
  UserContext, 
  Priority,
  NotificationMethod 
} from './types'
import { scheduleEventBus } from '../scheduling/events'

/**
 * Integrated avatar and voice notification coordinator
 * Provides synchronized multi-modal reminder delivery
 */
export class AvatarVoiceIntegration extends EventEmitter {
  private voiceService: VoiceNotificationService
  private avatarService: AvatarNotificationService
  private userPreferences: Map<string, NotificationPreferences> = new Map()
  private activeDeliveries: Map<string, MultiModalDelivery> = new Map()

  constructor(
    voiceService: VoiceNotificationService,
    avatarService: AvatarNotificationService
  ) {
    super()
    this.voiceService = voiceService
    this.avatarService = avatarService
    
    // Listen for system events
    scheduleEventBus.on('reminder:triggered', this.handleReminderTriggered.bind(this))
  }

  /**
   * Deliver reminder using synchronized avatar and voice
   */
  async deliverMultiModalReminder(
    reminder: Reminder, 
    context: UserContext
  ): Promise<MultiModalDeliveryResult> {
    const deliveryId = `multimodal-${reminder.id}-${Date.now()}`
    
    try {
      // Get user preferences for personalization
      const preferences = await this.getUserPreferences(reminder.userId)
      
      // Validate content for child safety
      await this.validateMultiModalContent(reminder)
      
      // Create coordinated delivery plan
      const deliveryPlan = await this.createDeliveryPlan(reminder, context, preferences)
      
      // Execute synchronized delivery
      const result = await this.executeSynchronizedDelivery(deliveryPlan, deliveryId)
      
      // Track delivery for feedback
      this.activeDeliveries.set(deliveryId, {
        reminder,
        context,
        plan: deliveryPlan,
        result,
        startTime: new Date()
      })
      
      // Emit delivery event
      this.emit('multimodal:delivered', {
        deliveryId,
        reminderId: reminder.id,
        result,
        timestamp: new Date()
      })
      
      return result
      
    } catch (error) {
      const errorResult: MultiModalDeliveryResult = {
        success: false,
        deliveryId,
        voiceResult: {
          success: false,
          duration: 0,
          audioLevel: 0,
          interrupted: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        avatarResult: {
          success: false,
          displayDuration: 0,
          userInteraction: false,
          expressionUsed: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        synchronization: {
          synchronized: false,
          timingOffset: 0,
          coordinationSuccess: false
        },
        userEngagement: {
          attentionCaptured: false,
          responseReceived: false,
          engagementLevel: 0
        }
      }
      
      this.emit('multimodal:failed', {
        deliveryId,
        reminderId: reminder.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      })
      
      return errorResult
    }
  }

  /**
   * Create personalized reminder content based on user preferences
   */
  async personalizeReminderContent(
    reminder: Reminder, 
    context: UserContext, 
    preferences: NotificationPreferences
  ): Promise<PersonalizedContent> {
    try {
      // Create personalized voice message
      const voiceMessage = await this.createPersonalizedVoiceMessage(reminder, context, preferences)
      
      // Create personalized avatar expression
      const avatarExpression = await this.createPersonalizedAvatarExpression(reminder, context, preferences)
      
      // Create coordinated timing
      const timing = await this.calculateOptimalTiming(reminder, context, preferences)
      
      return {
        voiceMessage,
        avatarExpression,
        timing,
        personalizationLevel: this.calculatePersonalizationLevel(preferences)
      }
      
    } catch (error) {
      throw new Error(`Failed to personalize content: ${error}`)
    }
  }

  /**
   * Handle contextual avatar expressions for different reminder types
   */
  async expressContextualEmotion(
    reminder: Reminder, 
    context: UserContext
  ): Promise<void> {
    try {
      // Select emotion based on reminder and context
      const emotion = this.selectContextualEmotion(reminder, context)
      const intensity = this.calculateEmotionIntensity(reminder, context)
      
      // Express emotion through avatar
      await this.avatarService.expressEmotion(emotion, intensity)
      
      // Log expression for learning
      this.emit('avatar:expression', {
        reminderId: reminder.id,
        emotion,
        intensity,
        context: this.summarizeContext(context),
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('Failed to express contextual emotion:', error)
      throw error
    }
  }

  /**
   * Coordinate voice and avatar timing for synchronized delivery
   */
  async coordinateDeliveryTiming(
    voiceContent: string,
    avatarExpression: AvatarEmotion,
    preferences: NotificationPreferences
  ): Promise<DeliveryCoordination> {
    try {
      // Calculate voice duration
      const voiceDuration = this.estimateVoiceDuration(voiceContent, preferences.voiceSettings)
      
      // Calculate avatar expression duration
      const avatarDuration = this.estimateAvatarDuration(avatarExpression)
      
      // Create synchronized timing plan
      const coordination: DeliveryCoordination = {
        voiceStartDelay: 0,
        avatarStartDelay: 0,
        totalDuration: Math.max(voiceDuration, avatarDuration),
        synchronizationPoints: [],
        fallbackStrategy: 'sequential'
      }
      
      // Add synchronization points for key moments
      coordination.synchronizationPoints = [
        {
          time: 0,
          action: 'start_both',
          description: 'Begin voice and avatar simultaneously'
        },
        {
          time: Math.min(voiceDuration, avatarDuration) * 0.5,
          action: 'mid_point_check',
          description: 'Verify synchronization at midpoint'
        },
        {
          time: coordination.totalDuration,
          action: 'end_coordination',
          description: 'Complete synchronized delivery'
        }
      ]
      
      return coordination
      
    } catch (error) {
      throw new Error(`Failed to coordinate delivery timing: ${error}`)
    }
  }

  // Private helper methods

  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = this.userPreferences.get(userId)
    if (preferences) {
      return preferences
    }
    
    // Return child-friendly defaults
    return {
      userId,
      preferredMethods: [NotificationMethod.VOICE, NotificationMethod.AVATAR],
      quietHours: {
        enabled: true,
        startTime: '20:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        emergencyOverride: true
      },
      escalationEnabled: true,
      maxEscalations: 2,
      batchingEnabled: false, // Disable batching for personalized delivery
      personalizedMessages: true,
      avatarExpressions: true,
      voiceSettings: {
        enabled: true,
        volume: 65,
        speed: 0.9, // Slightly slower for children
        pitch: 1.1, // Slightly higher for friendliness
        voice: 'child-friendly',
        language: 'en-US'
      }
    }
  }

  private async validateMultiModalContent(reminder: Reminder): Promise<void> {
    // Comprehensive child safety validation for multi-modal content
    const content = `${reminder.title} ${reminder.description}`
    
    // Check for inappropriate content
    const inappropriateWords = [
      'scary', 'frightening', 'dangerous', 'harmful', 'violent',
      'aggressive', 'threatening', 'sad', 'angry', 'upset'
    ]
    
    const lowerContent = content.toLowerCase()
    for (const word of inappropriateWords) {
      if (lowerContent.includes(word)) {
        throw new Error(`Multi-modal content failed child safety validation: contains "${word}"`)
      }
    }
    
    // Ensure positive, encouraging tone
    const positiveWords = [
      'great', 'good', 'wonderful', 'awesome', 'fantastic',
      'remember', 'time', 'ready', 'let\'s', 'you can'
    ]
    
    const hasPositiveTone = positiveWords.some(word => lowerContent.includes(word))
    if (!hasPositiveTone) {
      console.warn('Multi-modal content may benefit from more positive language')
    }
    
    // Validate content length for attention span
    if (content.length > 150) {
      throw new Error('Content too long for child attention span in multi-modal delivery')
    }
  }

  private async createDeliveryPlan(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<MultiModalDeliveryPlan> {
    // Create personalized content
    const personalizedContent = await this.personalizeReminderContent(reminder, context, preferences)
    
    // Create delivery coordination
    const coordination = await this.coordinateDeliveryTiming(
      personalizedContent.voiceMessage.text,
      personalizedContent.avatarExpression.emotion,
      preferences
    )
    
    return {
      reminder,
      context,
      personalizedContent,
      coordination,
      preferences,
      createdAt: new Date()
    }
  }

  private async executeSynchronizedDelivery(
    plan: MultiModalDeliveryPlan,
    deliveryId: string
  ): Promise<MultiModalDeliveryResult> {
    const startTime = Date.now()
    
    try {
      // Start avatar expression first (visual cue)
      const avatarPromise = this.avatarService.displayReminderWithExpression(
        plan.reminder,
        plan.context
      )
      
      // Start voice delivery with slight delay for synchronization
      await new Promise(resolve => setTimeout(resolve, plan.coordination.voiceStartDelay))
      const voicePromise = this.voiceService.speakReminder(
        plan.reminder,
        plan.context
      )
      
      // Wait for both to complete
      const [avatarResult, voiceResult] = await Promise.all([
        avatarPromise,
        voicePromise
      ])
      
      // Calculate synchronization metrics
      const synchronization = this.calculateSynchronizationMetrics(
        voiceResult,
        avatarResult,
        plan.coordination
      )
      
      // Assess user engagement
      const userEngagement = this.assessUserEngagement(
        voiceResult,
        avatarResult,
        plan.context
      )
      
      return {
        success: voiceResult.success && avatarResult.success,
        deliveryId,
        voiceResult,
        avatarResult,
        synchronization,
        userEngagement
      }
      
    } catch (error) {
      throw new Error(`Synchronized delivery failed: ${error}`)
    }
  }

  private async createPersonalizedVoiceMessage(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<PersonalizedVoiceMessage> {
    // Create age-appropriate, encouraging voice message
    let message = ''
    
    // Add personalized greeting based on time and context
    const greeting = this.createPersonalizedGreeting(context, preferences)
    message += greeting + ' '
    
    // Add reminder content with encouraging tone
    const reminderText = this.formatReminderForVoice(reminder, context)
    message += reminderText
    
    // Add personalized closing
    const closing = this.createPersonalizedClosing(reminder, context)
    message += ' ' + closing
    
    return {
      text: message,
      settings: preferences.voiceSettings,
      estimatedDuration: this.estimateVoiceDuration(message, preferences.voiceSettings),
      personalizationElements: [
        'time-based-greeting',
        'encouraging-tone',
        'personalized-closing'
      ]
    }
  }

  private async createPersonalizedAvatarExpression(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<PersonalizedAvatarExpression> {
    // Select appropriate emotion and intensity
    const emotion = this.selectContextualEmotion(reminder, context)
    const intensity = this.calculateEmotionIntensity(reminder, context)
    
    // Create visual message for avatar bubble
    const visualMessage = this.formatReminderForAvatar(reminder, context)
    
    return {
      emotion,
      intensity,
      visualMessage,
      duration: this.estimateAvatarDuration(emotion),
      personalizationElements: [
        'context-aware-emotion',
        'priority-based-intensity',
        'visual-message-formatting'
      ]
    }
  }

  private createPersonalizedGreeting(context: UserContext, preferences: NotificationPreferences): string {
    const hour = context.timeOfDay.hour
    const isWeekend = context.timeOfDay.isWeekend
    
    if (hour < 8) {
      return isWeekend ? 'Good morning, sleepyhead!' : 'Rise and shine!'
    } else if (hour < 12) {
      return 'Good morning, superstar!'
    } else if (hour < 17) {
      return 'Hey there, champion!'
    } else if (hour < 20) {
      return 'Good evening, awesome!'
    } else {
      return 'Hey there!'
    }
  }

  private formatReminderForVoice(reminder: Reminder, context: UserContext): string {
    // Format reminder with encouraging, child-friendly language
    switch (reminder.priority) {
      case Priority.CRITICAL:
        return `This is really important: ${reminder.title}.`
      case Priority.HIGH:
        return `Here's something important to remember: ${reminder.title}.`
      case Priority.MEDIUM:
        return `Just a friendly reminder about ${reminder.title}.`
      default:
        return `When you're ready, remember ${reminder.title}.`
    }
  }

  private formatReminderForAvatar(reminder: Reminder, context: UserContext): string {
    // Create visual message with emojis and child-friendly formatting
    const timeEmoji = context.timeOfDay.hour < 12 ? '🌅' : 
                     context.timeOfDay.hour < 17 ? '☀️' : '🌙'
    
    const priorityEmoji = reminder.priority >= Priority.HIGH ? '⚠️' : 
                         reminder.priority >= Priority.MEDIUM ? '📋' : '💭'
    
    return `${timeEmoji} ${priorityEmoji} ${reminder.title} 💪`
  }

  private createPersonalizedClosing(reminder: Reminder, context: UserContext): string {
    const closings = [
      'You\'ve got this!',
      'I believe in you!',
      'You\'re amazing!',
      'Keep being awesome!',
      'You can do it!'
    ]
    
    // Select closing based on time and priority
    const index = (context.timeOfDay.hour + reminder.priority) % closings.length
    return closings[index]
  }

  private selectContextualEmotion(reminder: Reminder, context: UserContext): AvatarEmotion {
    // Select emotion based on reminder priority, time, and context
    if (reminder.priority >= Priority.CRITICAL) {
      return AvatarEmotion.URGENT
    }
    
    if (reminder.priority >= Priority.HIGH) {
      return context.interruptibility === 'high' ? AvatarEmotion.CONCERNED : AvatarEmotion.GENTLE
    }
    
    // For medium/low priority, use positive emotions
    if (context.timeOfDay.hour < 12) {
      return AvatarEmotion.HAPPY
    } else if (context.timeOfDay.hour < 17) {
      return AvatarEmotion.EXCITED
    } else {
      return AvatarEmotion.GENTLE
    }
  }

  private calculateEmotionIntensity(reminder: Reminder, context: UserContext): number {
    let intensity = 0.3 // Base intensity
    
    // Adjust for priority
    intensity += (reminder.priority - 1) * 0.2
    
    // Adjust for context
    switch (context.interruptibility) {
      case 'high':
        intensity += 0.2
        break
      case 'medium':
        intensity += 0.1
        break
      case 'low':
        intensity -= 0.1
        break
    }
    
    // Ensure intensity stays within bounds
    return Math.max(0.1, Math.min(1.0, intensity))
  }

  private estimateVoiceDuration(message: string, settings: VoiceSettings): number {
    // Estimate speech duration (average 150 words per minute)
    const wordCount = message.split(' ').length
    const baseDuration = (wordCount / 150) * 60 * 1000 // Convert to milliseconds
    return baseDuration / settings.speed
  }

  private estimateAvatarDuration(emotion: AvatarEmotion): number {
    // Estimate avatar expression duration based on emotion
    const baseDuration = 3000 // 3 seconds base
    
    switch (emotion) {
      case AvatarEmotion.URGENT:
        return baseDuration * 1.5
      case AvatarEmotion.EXCITED:
        return baseDuration * 1.3
      case AvatarEmotion.HAPPY:
        return baseDuration
      case AvatarEmotion.CONCERNED:
        return baseDuration * 1.2
      case AvatarEmotion.GENTLE:
        return baseDuration * 0.8
      default:
        return baseDuration
    }
  }

  private calculateOptimalTiming(
    reminder: Reminder,
    context: UserContext,
    preferences: NotificationPreferences
  ): Promise<OptimalTiming> {
    return Promise.resolve({
      voiceDelay: 200, // Slight delay after avatar starts
      avatarDelay: 0,
      totalDuration: 5000,
      synchronizationPoints: [
        { time: 0, event: 'start' },
        { time: 2500, event: 'midpoint' },
        { time: 5000, event: 'end' }
      ]
    })
  }

  private calculatePersonalizationLevel(preferences: NotificationPreferences): number {
    let level = 0
    
    if (preferences.personalizedMessages) level += 0.3
    if (preferences.avatarExpressions) level += 0.3
    if (preferences.voiceSettings.enabled) level += 0.2
    if (preferences.preferredMethods.length > 1) level += 0.2
    
    return Math.min(1.0, level)
  }

  private calculateSynchronizationMetrics(
    voiceResult: any,
    avatarResult: any,
    coordination: DeliveryCoordination
  ): SynchronizationMetrics {
    // Calculate how well voice and avatar were synchronized
    const timingOffset = Math.abs(voiceResult.duration - avatarResult.displayDuration)
    const synchronized = timingOffset < 500 // Within 500ms is considered synchronized
    
    return {
      synchronized,
      timingOffset,
      coordinationSuccess: voiceResult.success && avatarResult.success
    }
  }

  private assessUserEngagement(
    voiceResult: any,
    avatarResult: any,
    context: UserContext
  ): UserEngagementMetrics {
    // Assess how well the multi-modal delivery engaged the user
    const attentionCaptured = avatarResult.userInteraction || !voiceResult.interrupted
    const responseReceived = avatarResult.userInteraction
    
    let engagementLevel = 0
    if (attentionCaptured) engagementLevel += 0.5
    if (responseReceived) engagementLevel += 0.5
    
    return {
      attentionCaptured,
      responseReceived,
      engagementLevel
    }
  }

  private summarizeContext(context: UserContext): any {
    return {
      activity: context.currentActivity,
      location: context.location.name,
      availability: context.availability,
      timeOfDay: context.timeOfDay.hour
    }
  }

  private handleReminderTriggered(data: any): void {
    // Handle reminder triggered events for multi-modal delivery
    console.log('Multi-modal reminder triggered:', data.reminderId)
  }
}

// Supporting interfaces
export interface MultiModalDeliveryResult {
  success: boolean
  deliveryId: string
  voiceResult: any
  avatarResult: any
  synchronization: SynchronizationMetrics
  userEngagement: UserEngagementMetrics
}

export interface MultiModalDelivery {
  reminder: Reminder
  context: UserContext
  plan: MultiModalDeliveryPlan
  result: MultiModalDeliveryResult
  startTime: Date
}

export interface MultiModalDeliveryPlan {
  reminder: Reminder
  context: UserContext
  personalizedContent: PersonalizedContent
  coordination: DeliveryCoordination
  preferences: NotificationPreferences
  createdAt: Date
}

export interface PersonalizedContent {
  voiceMessage: PersonalizedVoiceMessage
  avatarExpression: PersonalizedAvatarExpression
  timing: OptimalTiming
  personalizationLevel: number
}

export interface PersonalizedVoiceMessage {
  text: string
  settings: VoiceSettings
  estimatedDuration: number
  personalizationElements: string[]
}

export interface PersonalizedAvatarExpression {
  emotion: AvatarEmotion
  intensity: number
  visualMessage: string
  duration: number
  personalizationElements: string[]
}

export interface OptimalTiming {
  voiceDelay: number
  avatarDelay: number
  totalDuration: number
  synchronizationPoints: TimingPoint[]
}

export interface TimingPoint {
  time: number
  event: string
}

export interface DeliveryCoordination {
  voiceStartDelay: number
  avatarStartDelay: number
  totalDuration: number
  synchronizationPoints: SynchronizationPoint[]
  fallbackStrategy: string
}

export interface SynchronizationPoint {
  time: number
  action: string
  description: string
}

export interface SynchronizationMetrics {
  synchronized: boolean
  timingOffset: number
  coordinationSuccess: boolean
}

export interface UserEngagementMetrics {
  attentionCaptured: boolean
  responseReceived: boolean
  engagementLevel: number
}

/**
 * Factory function to create avatar-voice integration
 */
export function createAvatarVoiceIntegration(
  voiceService: VoiceNotificationService,
  avatarService: AvatarNotificationService
): AvatarVoiceIntegration {
  return new AvatarVoiceIntegration(voiceService, avatarService)
}