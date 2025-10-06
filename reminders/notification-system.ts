// Notification system exports and factory functions

// Core notification dispatcher
export { 
  NotificationDispatcher,
  NotificationDispatcherImpl,
  DeliveryResult,
  FamilyNotification,
  Notification,
  BatchDeliveryResult,
  DeliveryFeedback,
  NotificationPreferences,
  UserResponse,
  VoiceNotificationService,
  AvatarNotificationService,
  VisualNotificationService,
  AvatarEmotion,
  VoiceSettings
} from './notification-dispatcher'

// Enhanced notification dispatcher
export {
  EnhancedNotificationDispatcher,
  createEnhancedNotificationDispatcher
} from './enhanced-notification-dispatcher'

// Service implementations
export {
  VoiceNotificationServiceImpl,
  createVoiceNotificationService,
  MockVoiceNotificationService
} from './voice-notification-service'

export {
  AvatarNotificationServiceImpl,
  createAvatarNotificationService,
  MockAvatarNotificationService
} from './avatar-notification-service'

export {
  VisualNotificationServiceImpl,
  createVisualNotificationService,
  MockVisualNotificationService
} from './visual-notification-service'

// Avatar-voice integration
export {
  AvatarVoiceIntegration,
  createAvatarVoiceIntegration,
  MultiModalDeliveryResult,
  PersonalizedContent
} from './avatar-voice-integration'

/**
 * Factory function to create a complete notification system
 * with all services integrated
 */
export function createNotificationSystem(): {
  dispatcher: EnhancedNotificationDispatcher
  voiceService: VoiceNotificationService
  avatarService: AvatarNotificationService
  visualService: VisualNotificationService
} {
  const dispatcher = createEnhancedNotificationDispatcher()
  
  // Services are created internally by the enhanced dispatcher
  // This factory provides access to the complete system
  return {
    dispatcher,
    // Note: In the actual implementation, these would be the same instances
    // used by the dispatcher. For now, we create new instances for the interface
    voiceService: createVoiceNotificationService(),
    avatarService: createAvatarNotificationService(),
    visualService: createVisualNotificationService()
  }
}

/**
 * Factory function to create a test notification system
 * with mock services for testing
 */
export function createTestNotificationSystem(): {
  dispatcher: NotificationDispatcherImpl
  voiceService: MockVoiceNotificationService
  avatarService: MockAvatarNotificationService
  visualService: MockVisualNotificationService
} {
  const voiceService = new MockVoiceNotificationService()
  const avatarService = new MockAvatarNotificationService()
  const visualService = new MockVisualNotificationService()
  
  const dispatcher = new NotificationDispatcherImpl(
    voiceService,
    avatarService,
    visualService
  )
  
  return {
    dispatcher,
    voiceService,
    avatarService,
    visualService
  }
}

// Re-export types from the main types file
export type {
  Reminder,
  UserContext,
  Priority,
  NotificationMethod,
  ReminderType,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  CompletionStatus
} from './types'