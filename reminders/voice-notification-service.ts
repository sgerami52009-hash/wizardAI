// Voice notification service for spoken reminder delivery

import { 
  VoiceNotificationService, 
  VoiceDeliveryResult, 
  VoiceOption, 
  VoiceSettings 
} from './notification-dispatcher'
import { Reminder, UserContext } from './types'

/**
 * Voice notification service implementation
 * Integrates with the voice pipeline for spoken reminder delivery
 */
export class VoiceNotificationServiceImpl implements VoiceNotificationService {
  private isInitialized = false
  private availableVoices: VoiceOption[] = []
  private currentVolume = 70
  private voicePipelineAvailable = false

  constructor() {
    this.initializeVoiceSystem()
  }

  /**
   * Speak a reminder using the voice pipeline
   */
  async speakReminder(reminder: Reminder, context: UserContext): Promise<VoiceDeliveryResult> {
    if (!this.voicePipelineAvailable) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: 'Voice pipeline not available'
      }
    }

    try {
      // Format reminder message for speech
      const message = this.formatReminderForSpeech(reminder, context)
      
      // Validate content for child safety
      await this.validateSpeechContent(message)
      
      // Get voice settings for user
      const voiceSettings = await this.getVoiceSettings(reminder.userId)
      
      // Speak the message
      const startTime = Date.now()
      const result = await this.speakMessage(message, voiceSettings)
      const duration = Date.now() - startTime
      
      return {
        ...result,
        duration
      }
      
    } catch (error) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown voice error'
      }
    }
  }

  /**
   * Speak a message with specified voice settings
   */
  async speakMessage(message: string, settings: VoiceSettings): Promise<VoiceDeliveryResult> {
    if (!this.voicePipelineAvailable) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: 'Voice pipeline not available'
      }
    }

    try {
      // Simulate voice pipeline integration
      // In real implementation, this would integrate with the actual voice pipeline
      const startTime = Date.now()
      
      // Validate message length (max 500ms response time requirement)
      if (message.length > 200) {
        throw new Error('Message too long for voice delivery')
      }
      
      // Simulate speech synthesis
      await this.synthesizeSpeech(message, settings)
      
      const duration = Date.now() - startTime
      
      // Ensure we meet the 500ms latency requirement
      if (duration > 500) {
        console.warn(`Voice delivery exceeded 500ms latency: ${duration}ms`)
      }
      
      return {
        success: true,
        duration,
        audioLevel: settings.volume,
        interrupted: false
      }
      
    } catch (error) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: error instanceof Error ? error.message : 'Speech synthesis failed'
      }
    }
  }

  /**
   * Check if voice system is available
   */
  async isVoiceAvailable(): Promise<boolean> {
    return this.voicePipelineAvailable && this.isInitialized
  }

  /**
   * Get available voice options
   */
  async getAvailableVoices(): Promise<VoiceOption[]> {
    return this.availableVoices
  }

  // Private helper methods

  private async initializeVoiceSystem(): Promise<void> {
    try {
      // Initialize available voices
      this.availableVoices = [
        {
          id: 'default-female',
          name: 'Default Female',
          language: 'en-US',
          gender: 'female',
          isDefault: true
        },
        {
          id: 'default-male',
          name: 'Default Male',
          language: 'en-US',
          gender: 'male',
          isDefault: false
        },
        {
          id: 'child-friendly',
          name: 'Child Friendly',
          language: 'en-US',
          gender: 'neutral',
          isDefault: false
        }
      ]
      
      // Check voice pipeline availability
      this.voicePipelineAvailable = await this.checkVoicePipelineStatus()
      
      this.isInitialized = true
      
    } catch (error) {
      console.error('Failed to initialize voice system:', error)
      this.isInitialized = false
      this.voicePipelineAvailable = false
    }
  }

  private async checkVoicePipelineStatus(): Promise<boolean> {
    try {
      // In real implementation, this would check the actual voice pipeline
      // For now, simulate availability check
      return true
    } catch (error) {
      console.error('Voice pipeline check failed:', error)
      return false
    }
  }

  private formatReminderForSpeech(reminder: Reminder, context: UserContext): string {
    // Create child-friendly, encouraging speech format
    const timeContext = this.getTimeContext(context)
    let message = ''
    
    // Add greeting based on time of day
    if (context.timeOfDay.hour < 12) {
      message += 'Good morning! '
    } else if (context.timeOfDay.hour < 17) {
      message += 'Good afternoon! '
    } else {
      message += 'Good evening! '
    }
    
    // Add reminder content with encouraging tone
    switch (reminder.priority) {
      case 4: // CRITICAL
        message += `This is important: ${reminder.title}.`
        break
      case 3: // HIGH
        message += `Here's a reminder: ${reminder.title}.`
        break
      case 2: // MEDIUM
        message += `Just a friendly reminder about ${reminder.title}.`
        break
      default: // LOW
        message += `When you have a moment, remember ${reminder.title}.`
        break
    }
    
    // Add description if available and not too long
    if (reminder.description && reminder.description.length < 100) {
      message += ` ${reminder.description}`
    }
    
    // Add encouraging closing
    message += ' You\'ve got this!'
    
    return message
  }

  private getTimeContext(context: UserContext): string {
    const hour = context.timeOfDay.hour
    
    if (hour < 6) return 'early morning'
    if (hour < 12) return 'morning'
    if (hour < 17) return 'afternoon'
    if (hour < 21) return 'evening'
    return 'night'
  }

  private async validateSpeechContent(message: string): Promise<void> {
    // Implement child safety validation for speech content
    const inappropriateWords = [
      'dangerous', 'harmful', 'scary', 'frightening',
      'violent', 'aggressive', 'threatening'
    ]
    
    const lowerMessage = message.toLowerCase()
    for (const word of inappropriateWords) {
      if (lowerMessage.includes(word)) {
        throw new Error(`Speech content failed child safety validation: contains "${word}"`)
      }
    }
    
    // Check message length for age-appropriate attention span
    if (message.length > 300) {
      throw new Error('Speech message too long for child attention span')
    }
  }

  private async getVoiceSettings(userId: string): Promise<VoiceSettings> {
    // In real implementation, this would fetch user-specific voice settings
    // For now, return child-friendly defaults
    return {
      enabled: true,
      volume: 70,
      speed: 0.9, // Slightly slower for children
      pitch: 1.1, // Slightly higher pitch for friendliness
      voice: 'child-friendly',
      language: 'en-US'
    }
  }

  private async synthesizeSpeech(message: string, settings: VoiceSettings): Promise<void> {
    // Simulate speech synthesis with proper timing
    // In real implementation, this would integrate with the voice pipeline
    
    // Calculate estimated speech duration (average 150 words per minute)
    const wordCount = message.split(' ').length
    const estimatedDuration = (wordCount / 150) * 60 * 1000 // Convert to milliseconds
    const adjustedDuration = estimatedDuration / settings.speed
    
    // Simulate processing time (should be minimal for real-time speech)
    await new Promise(resolve => setTimeout(resolve, Math.min(adjustedDuration, 100)))
    
    // Set volume level
    this.currentVolume = settings.volume
    
    // Log speech for debugging (in real implementation, never persist voice data)
    console.log(`Speaking: "${message}" (${settings.voice}, ${settings.speed}x speed)`)
  }
}

/**
 * Factory function to create voice notification service
 */
export function createVoiceNotificationService(): VoiceNotificationService {
  return new VoiceNotificationServiceImpl()
}

/**
 * Mock voice service for testing
 */
export class MockVoiceNotificationService implements VoiceNotificationService {
  private mockAvailable = true
  private mockVoices: VoiceOption[] = [
    {
      id: 'test-voice',
      name: 'Test Voice',
      language: 'en-US',
      gender: 'neutral',
      isDefault: true
    }
  ]

  async speakReminder(reminder: Reminder, context: UserContext): Promise<VoiceDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: 'Mock voice service unavailable'
      }
    }

    return {
      success: true,
      duration: 1000,
      audioLevel: 70,
      interrupted: false
    }
  }

  async speakMessage(message: string, settings: VoiceSettings): Promise<VoiceDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        duration: 0,
        audioLevel: 0,
        interrupted: false,
        errorMessage: 'Mock voice service unavailable'
      }
    }

    return {
      success: true,
      duration: message.length * 50, // Simulate speech duration
      audioLevel: settings.volume,
      interrupted: false
    }
  }

  async isVoiceAvailable(): Promise<boolean> {
    return this.mockAvailable
  }

  async getAvailableVoices(): Promise<VoiceOption[]> {
    return this.mockVoices
  }

  // Test helper methods
  setAvailable(available: boolean): void {
    this.mockAvailable = available
  }

  addMockVoice(voice: VoiceOption): void {
    this.mockVoices.push(voice)
  }
}