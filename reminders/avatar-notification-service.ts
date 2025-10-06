// Avatar notification service for expressive reminder delivery

import { 
  AvatarNotificationService, 
  AvatarDeliveryResult, 
  AvatarEmotion 
} from './notification-dispatcher'
import { Reminder, UserContext, Priority } from './types'

/**
 * Avatar notification service implementation
 * Integrates with the avatar system for expressive reminder delivery
 */
export class AvatarNotificationServiceImpl implements AvatarNotificationService {
  private isInitialized = false
  private avatarSystemAvailable = false
  private currentExpression = AvatarEmotion.NEUTRAL
  private expressionQueue: ExpressionCommand[] = []

  constructor() {
    this.initializeAvatarSystem()
  }

  /**
   * Display a reminder with appropriate avatar expression
   */
  async displayReminderWithExpression(reminder: Reminder, context: UserContext): Promise<AvatarDeliveryResult> {
    if (!this.avatarSystemAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'none',
        errorMessage: 'Avatar system not available'
      }
    }

    try {
      // Select appropriate emotion based on reminder
      const emotion = this.selectEmotionForReminder(reminder, context)
      const intensity = this.calculateEmotionIntensity(reminder)
      
      // Validate content for child safety
      await this.validateAvatarContent(reminder)
      
      // Display reminder with expression
      const startTime = Date.now()
      
      // Set avatar expression
      await this.expressEmotion(emotion, intensity)
      
      // Show notification bubble
      const message = this.formatReminderForAvatar(reminder, context)
      const bubbleResult = await this.showNotificationBubble(message, 5000) // 5 second display
      
      const duration = Date.now() - startTime
      
      // Simulate user interaction detection
      const userInteraction = await this.detectUserInteraction(3000) // 3 second window
      
      return {
        success: bubbleResult.success,
        displayDuration: duration,
        userInteraction,
        expressionUsed: emotion,
        errorMessage: bubbleResult.errorMessage
      }
      
    } catch (error) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown avatar error'
      }
    }
  }

  /**
   * Show a notification bubble on the avatar
   */
  async showNotificationBubble(message: string, duration: number): Promise<AvatarDeliveryResult> {
    if (!this.avatarSystemAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'none',
        errorMessage: 'Avatar system not available'
      }
    }

    try {
      // Validate message length for bubble display
      if (message.length > 150) {
        throw new Error('Message too long for avatar bubble display')
      }
      
      // Simulate bubble display
      await this.displayBubble(message, duration)
      
      return {
        success: true,
        displayDuration: duration,
        userInteraction: false,
        expressionUsed: this.currentExpression
      }
      
    } catch (error) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'error',
        errorMessage: error instanceof Error ? error.message : 'Bubble display failed'
      }
    }
  }

  /**
   * Express an emotion with specified intensity
   */
  async expressEmotion(emotion: AvatarEmotion, intensity: number): Promise<void> {
    if (!this.avatarSystemAvailable) {
      throw new Error('Avatar system not available')
    }

    try {
      // Validate intensity range
      if (intensity < 0 || intensity > 1) {
        throw new Error('Emotion intensity must be between 0 and 1')
      }
      
      // Queue expression command
      const command: ExpressionCommand = {
        emotion,
        intensity,
        duration: this.getExpressionDuration(emotion, intensity),
        timestamp: new Date()
      }
      
      this.expressionQueue.push(command)
      
      // Process expression queue
      await this.processExpressionQueue()
      
      this.currentExpression = emotion
      
    } catch (error) {
      console.error('Failed to express emotion:', error)
      throw error
    }
  }

  /**
   * Check if avatar system is available
   */
  async isAvatarAvailable(): Promise<boolean> {
    return this.avatarSystemAvailable && this.isInitialized
  }

  // Private helper methods

  private async initializeAvatarSystem(): Promise<void> {
    try {
      // Check avatar system availability
      this.avatarSystemAvailable = await this.checkAvatarSystemStatus()
      
      // Initialize default expression
      this.currentExpression = AvatarEmotion.NEUTRAL
      
      this.isInitialized = true
      
    } catch (error) {
      console.error('Failed to initialize avatar system:', error)
      this.isInitialized = false
      this.avatarSystemAvailable = false
    }
  }

  private async checkAvatarSystemStatus(): Promise<boolean> {
    try {
      // In real implementation, this would check the actual avatar system
      // For now, simulate availability check
      return true
    } catch (error) {
      console.error('Avatar system check failed:', error)
      return false
    }
  }

  private selectEmotionForReminder(reminder: Reminder, context: UserContext): AvatarEmotion {
    // Select emotion based on reminder priority and type
    switch (reminder.priority) {
      case Priority.CRITICAL:
        return AvatarEmotion.URGENT
      case Priority.HIGH:
        return AvatarEmotion.CONCERNED
      case Priority.MEDIUM:
        return context.timeOfDay.hour < 12 ? AvatarEmotion.HAPPY : AvatarEmotion.GENTLE
      case Priority.LOW:
      default:
        return AvatarEmotion.GENTLE
    }
  }

  private calculateEmotionIntensity(reminder: Reminder): number {
    // Calculate intensity based on priority and urgency
    switch (reminder.priority) {
      case Priority.CRITICAL:
        return 0.9
      case Priority.HIGH:
        return 0.7
      case Priority.MEDIUM:
        return 0.5
      case Priority.LOW:
      default:
        return 0.3
    }
  }

  private async validateAvatarContent(reminder: Reminder): Promise<void> {
    // Implement child safety validation for avatar content
    const content = `${reminder.title} ${reminder.description}`
    
    // Check for inappropriate content
    const inappropriateWords = [
      'scary', 'frightening', 'dangerous', 'harmful',
      'violent', 'aggressive', 'threatening', 'sad'
    ]
    
    const lowerContent = content.toLowerCase()
    for (const word of inappropriateWords) {
      if (lowerContent.includes(word)) {
        throw new Error(`Avatar content failed child safety validation: contains "${word}"`)
      }
    }
    
    // Ensure positive, encouraging tone
    if (!this.hasPositiveTone(content)) {
      console.warn('Avatar content may not be sufficiently positive for children')
    }
  }

  private hasPositiveTone(content: string): boolean {
    const positiveWords = [
      'great', 'good', 'wonderful', 'awesome', 'fantastic',
      'remember', 'time', 'ready', 'let\'s', 'you can'
    ]
    
    const lowerContent = content.toLowerCase()
    return positiveWords.some(word => lowerContent.includes(word))
  }

  private formatReminderForAvatar(reminder: Reminder, context: UserContext): string {
    // Create child-friendly, visual-appropriate message format
    let message = ''
    
    // Add emoji or visual elements based on time of day
    if (context.timeOfDay.hour < 12) {
      message += '🌅 '
    } else if (context.timeOfDay.hour < 17) {
      message += '☀️ '
    } else {
      message += '🌙 '
    }
    
    // Format message based on priority
    switch (reminder.priority) {
      case Priority.CRITICAL:
        message += `⚠️ Important: ${reminder.title}`
        break
      case Priority.HIGH:
        message += `📋 Reminder: ${reminder.title}`
        break
      case Priority.MEDIUM:
        message += `💭 Don't forget: ${reminder.title}`
        break
      default:
        message += `✨ ${reminder.title}`
        break
    }
    
    // Add encouraging emoji
    message += ' 💪'
    
    return message
  }

  private getExpressionDuration(emotion: AvatarEmotion, intensity: number): number {
    // Calculate expression duration based on emotion and intensity
    const baseDuration = 2000 // 2 seconds base
    const intensityMultiplier = 1 + intensity
    
    switch (emotion) {
      case AvatarEmotion.URGENT:
        return baseDuration * intensityMultiplier * 1.5
      case AvatarEmotion.EXCITED:
        return baseDuration * intensityMultiplier * 1.3
      case AvatarEmotion.HAPPY:
        return baseDuration * intensityMultiplier
      case AvatarEmotion.CONCERNED:
        return baseDuration * intensityMultiplier * 1.2
      case AvatarEmotion.GENTLE:
        return baseDuration * intensityMultiplier * 0.8
      case AvatarEmotion.NEUTRAL:
      default:
        return baseDuration
    }
  }

  private async processExpressionQueue(): Promise<void> {
    if (this.expressionQueue.length === 0) {
      return
    }
    
    const command = this.expressionQueue.shift()!
    
    try {
      // Simulate avatar expression processing
      await this.renderExpression(command)
      
    } catch (error) {
      console.error('Failed to process expression:', error)
    }
    
    // Process next command if any
    if (this.expressionQueue.length > 0) {
      setTimeout(() => this.processExpressionQueue(), 100)
    }
  }

  private async renderExpression(command: ExpressionCommand): Promise<void> {
    // Simulate avatar expression rendering
    // In real implementation, this would integrate with the avatar system
    
    console.log(`Avatar expressing ${command.emotion} with intensity ${command.intensity} for ${command.duration}ms`)
    
    // Simulate rendering time (should be fast for real-time interaction)
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  private async displayBubble(message: string, duration: number): Promise<void> {
    // Simulate bubble display
    // In real implementation, this would integrate with the avatar UI system
    
    console.log(`Avatar bubble: "${message}" for ${duration}ms`)
    
    // Simulate display processing
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async detectUserInteraction(timeoutMs: number): Promise<boolean> {
    // Simulate user interaction detection
    // In real implementation, this would use actual interaction sensors
    
    return new Promise(resolve => {
      // Simulate random user interaction for testing
      const hasInteraction = Math.random() > 0.7 // 30% chance of interaction
      
      setTimeout(() => {
        resolve(hasInteraction)
      }, Math.min(timeoutMs, 1000))
    })
  }
}

interface ExpressionCommand {
  emotion: AvatarEmotion
  intensity: number
  duration: number
  timestamp: Date
}

/**
 * Factory function to create avatar notification service
 */
export function createAvatarNotificationService(): AvatarNotificationService {
  return new AvatarNotificationServiceImpl()
}

/**
 * Mock avatar service for testing
 */
export class MockAvatarNotificationService implements AvatarNotificationService {
  private mockAvailable = true
  private mockExpressions: string[] = []

  async displayReminderWithExpression(reminder: Reminder, context: UserContext): Promise<AvatarDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'none',
        errorMessage: 'Mock avatar service unavailable'
      }
    }

    const emotion = this.selectMockEmotion(reminder)
    this.mockExpressions.push(emotion)

    return {
      success: true,
      displayDuration: 3000,
      userInteraction: Math.random() > 0.5,
      expressionUsed: emotion
    }
  }

  async showNotificationBubble(message: string, duration: number): Promise<AvatarDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userInteraction: false,
        expressionUsed: 'none',
        errorMessage: 'Mock avatar service unavailable'
      }
    }

    return {
      success: true,
      displayDuration: duration,
      userInteraction: false,
      expressionUsed: 'neutral'
    }
  }

  async expressEmotion(emotion: AvatarEmotion, intensity: number): Promise<void> {
    if (!this.mockAvailable) {
      throw new Error('Mock avatar service unavailable')
    }
    
    this.mockExpressions.push(emotion)
  }

  async isAvatarAvailable(): Promise<boolean> {
    return this.mockAvailable
  }

  // Test helper methods
  setAvailable(available: boolean): void {
    this.mockAvailable = available
  }

  getExpressionHistory(): string[] {
    return [...this.mockExpressions]
  }

  clearExpressionHistory(): void {
    this.mockExpressions = []
  }

  private selectMockEmotion(reminder: Reminder): string {
    switch (reminder.priority) {
      case Priority.CRITICAL:
        return AvatarEmotion.URGENT
      case Priority.HIGH:
        return AvatarEmotion.CONCERNED
      case Priority.MEDIUM:
        return AvatarEmotion.HAPPY
      default:
        return AvatarEmotion.GENTLE
    }
  }
}