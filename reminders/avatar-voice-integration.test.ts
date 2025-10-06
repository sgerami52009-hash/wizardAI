// Unit tests for avatar and voice integration

import { 
  AvatarVoiceIntegration,
  MultiModalDeliveryResult,
  PersonalizedContent
} from './avatar-voice-integration'
import { 
  MockVoiceNotificationService 
} from './voice-notification-service'
import { 
  MockAvatarNotificationService 
} from './avatar-notification-service'
import { 
  AvatarEmotion,
  NotificationPreferences,
  VoiceSettings
} from './notification-dispatcher'
import { 
  Reminder, 
  UserContext, 
  Priority, 
  NotificationMethod,
  CompletionStatus,
  ReminderType,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel
} from './types'

describe('AvatarVoiceIntegration', () => {
  let integration: AvatarVoiceIntegration
  let mockVoiceService: MockVoiceNotificationService
  let mockAvatarService: MockAvatarNotificationService
  let testReminder: Reminder
  let testContext: UserContext
  let testPreferences: NotificationPreferences

  beforeEach(() => {
    // Create mock services
    mockVoiceService = new MockVoiceNotificationService()
    mockAvatarService = new MockAvatarNotificationService()
    
    // Create integration
    integration = new AvatarVoiceIntegration(mockVoiceService, mockAvatarService)
    
    // Create test data
    testReminder = {
      id: 'test-reminder-1',
      userId: 'test-user-1',
      title: 'Practice piano',
      description: 'Time for your wonderful piano practice!',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(),
      priority: Priority.MEDIUM,
      deliveryMethods: [NotificationMethod.VOICE, NotificationMethod.AVATAR],
      contextConstraints: [],
      escalationRules: [],
      completionStatus: CompletionStatus.PENDING,
      snoozeHistory: [],
      userFeedback: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    testContext = {
      userId: 'test-user-1',
      currentActivity: ActivityType.RELAXING,
      location: {
        name: 'home',
        type: 'home' as any,
        confidence: 0.9
      },
      availability: AvailabilityStatus.AVAILABLE,
      interruptibility: InterruptibilityLevel.MEDIUM,
      deviceProximity: {
        isNearby: true,
        lastSeen: new Date(),
        deviceType: 'home_assistant'
      },
      timeOfDay: {
        hour: 16, // 4 PM
        dayOfWeek: 3, // Wednesday
        isWeekend: false,
        isHoliday: false,
        timeZone: 'America/New_York'
      },
      historicalPatterns: [],
      lastUpdated: new Date()
    }
    
    testPreferences = {
      userId: 'test-user-1',
      preferredMethods: [NotificationMethod.AVATAR, NotificationMethod.VOICE],
      quietHours: {
        enabled: true,
        startTime: '21:00',
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
  })

  describe('deliverMultiModalReminder', () => {
    it('should successfully deliver synchronized avatar and voice reminder', async () => {
      // Arrange
      mockVoiceService.setAvailable(true)
      mockAvatarService.setAvailable(true)
      
      // Act
      const result = await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryId).toContain('multimodal')
      expect(result.voiceResult.success).toBe(true)
      expect(result.avatarResult.success).toBe(true)
      expect(result.synchronization.synchronized).toBe(true)
      expect(result.userEngagement.attentionCaptured).toBeDefined()
    })

    it('should handle voice service failure gracefully', async () => {
      // Arrange
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(true)
      
      // Act
      const result = await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.voiceResult.success).toBe(false)
      expect(result.voiceResult.errorMessage).toContain('unavailable')
    })

    it('should handle avatar service failure gracefully', async () => {
      // Arrange
      mockVoiceService.setAvailable(true)
      mockAvatarService.setAvailable(false)
      
      // Act
      const result = await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.avatarResult.success).toBe(false)
      expect(result.avatarResult.errorMessage).toContain('unavailable')
    })

    it('should reject inappropriate content for child safety', async () => {
      // Arrange
      testReminder.title = 'Scary dangerous task'
      testReminder.description = 'This is frightening and harmful'
      
      // Act & Assert
      await expect(integration.deliverMultiModalReminder(testReminder, testContext))
        .rejects.toThrow('child safety validation')
    })

    it('should emit multimodal delivery events', async () => {
      // Arrange
      const eventSpy = jest.fn()
      integration.on('multimodal:delivered', eventSpy)
      
      mockVoiceService.setAvailable(true)
      mockAvatarService.setAvailable(true)
      
      // Act
      await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderId: testReminder.id,
          result: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('personalizeReminderContent', () => {
    it('should create personalized content with appropriate voice message', async () => {
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      expect(content.voiceMessage.text).toContain('Good afternoon') // Based on 4 PM context
      expect(content.voiceMessage.text).toContain(testReminder.title)
      expect(content.voiceMessage.text).toContain('You\'ve got this!') // Encouraging closing
      expect(content.voiceMessage.settings.speed).toBe(0.9) // Child-friendly speed
      expect(content.voiceMessage.personalizationElements).toContain('time-based-greeting')
    })

    it('should create personalized avatar expression based on priority', async () => {
      // Arrange - High priority reminder
      testReminder.priority = Priority.HIGH
      
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      expect(content.avatarExpression.emotion).toBe(AvatarEmotion.CONCERNED)
      expect(content.avatarExpression.intensity).toBeGreaterThan(0.5)
      expect(content.avatarExpression.visualMessage).toContain('📋') // High priority emoji
      expect(content.avatarExpression.personalizationElements).toContain('context-aware-emotion')
    })

    it('should adjust content for different times of day', async () => {
      // Arrange - Morning context
      testContext.timeOfDay.hour = 8
      
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      expect(content.voiceMessage.text).toContain('Good morning')
      expect(content.avatarExpression.visualMessage).toContain('🌅') // Morning emoji
      expect(content.avatarExpression.emotion).toBe(AvatarEmotion.HAPPY) // Morning happiness
    })

    it('should create appropriate content for critical priority', async () => {
      // Arrange
      testReminder.priority = Priority.CRITICAL
      testReminder.title = 'Important medicine time'
      
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      expect(content.voiceMessage.text).toContain('This is really important')
      expect(content.avatarExpression.emotion).toBe(AvatarEmotion.URGENT)
      expect(content.avatarExpression.intensity).toBeGreaterThan(0.8)
      expect(content.avatarExpression.visualMessage).toContain('⚠️') // Urgent emoji
    })

    it('should calculate appropriate personalization level', async () => {
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      expect(content.personalizationLevel).toBeGreaterThan(0.5) // High personalization
      expect(content.personalizationLevel).toBeLessThanOrEqual(1.0)
    })
  })

  describe('expressContextualEmotion', () => {
    it('should express appropriate emotion for high priority reminder', async () => {
      // Arrange
      testReminder.priority = Priority.HIGH
      mockAvatarService.clearExpressionHistory()
      
      // Act
      await integration.expressContextualEmotion(testReminder, testContext)
      
      // Assert
      const expressions = mockAvatarService.getExpressionHistory()
      expect(expressions).toContain(AvatarEmotion.CONCERNED)
    })

    it('should express happy emotion for morning low priority reminder', async () => {
      // Arrange
      testReminder.priority = Priority.LOW
      testContext.timeOfDay.hour = 9 // Morning
      mockAvatarService.clearExpressionHistory()
      
      // Act
      await integration.expressContextualEmotion(testReminder, testContext)
      
      // Assert
      const expressions = mockAvatarService.getExpressionHistory()
      expect(expressions).toContain(AvatarEmotion.HAPPY)
    })

    it('should express gentle emotion for evening reminders', async () => {
      // Arrange
      testReminder.priority = Priority.MEDIUM
      testContext.timeOfDay.hour = 19 // Evening
      mockAvatarService.clearExpressionHistory()
      
      // Act
      await integration.expressContextualEmotion(testReminder, testContext)
      
      // Assert
      const expressions = mockAvatarService.getExpressionHistory()
      expect(expressions).toContain(AvatarEmotion.GENTLE)
    })

    it('should emit avatar expression events', async () => {
      // Arrange
      const eventSpy = jest.fn()
      integration.on('avatar:expression', eventSpy)
      
      // Act
      await integration.expressContextualEmotion(testReminder, testContext)
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderId: testReminder.id,
          emotion: expect.any(String),
          intensity: expect.any(Number),
          context: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('coordinateDeliveryTiming', () => {
    it('should create appropriate timing coordination for voice and avatar', async () => {
      // Arrange
      const voiceContent = 'Good afternoon! Here\'s a reminder about piano practice. You\'ve got this!'
      const avatarExpression = AvatarEmotion.HAPPY
      
      // Act
      const coordination = await integration.coordinateDeliveryTiming(
        voiceContent,
        avatarExpression,
        testPreferences
      )
      
      // Assert
      expect(coordination.voiceStartDelay).toBeDefined()
      expect(coordination.avatarStartDelay).toBeDefined()
      expect(coordination.totalDuration).toBeGreaterThan(0)
      expect(coordination.synchronizationPoints).toHaveLength(3) // start, midpoint, end
      expect(coordination.fallbackStrategy).toBe('sequential')
    })

    it('should calculate appropriate durations based on content length', async () => {
      // Arrange
      const shortContent = 'Quick reminder!'
      const longContent = 'This is a much longer reminder message that will take more time to speak and should result in a longer total duration for the coordination.'
      
      // Act
      const shortCoordination = await integration.coordinateDeliveryTiming(
        shortContent,
        AvatarEmotion.HAPPY,
        testPreferences
      )
      
      const longCoordination = await integration.coordinateDeliveryTiming(
        longContent,
        AvatarEmotion.HAPPY,
        testPreferences
      )
      
      // Assert
      expect(longCoordination.totalDuration).toBeGreaterThan(shortCoordination.totalDuration)
    })

    it('should include proper synchronization points', async () => {
      // Arrange
      const voiceContent = 'Test reminder message'
      
      // Act
      const coordination = await integration.coordinateDeliveryTiming(
        voiceContent,
        AvatarEmotion.GENTLE,
        testPreferences
      )
      
      // Assert
      expect(coordination.synchronizationPoints[0].action).toBe('start_both')
      expect(coordination.synchronizationPoints[1].action).toBe('mid_point_check')
      expect(coordination.synchronizationPoints[2].action).toBe('end_coordination')
      
      // Verify timing progression
      expect(coordination.synchronizationPoints[0].time).toBe(0)
      expect(coordination.synchronizationPoints[1].time).toBeGreaterThan(0)
      expect(coordination.synchronizationPoints[2].time).toBe(coordination.totalDuration)
    })
  })

  describe('child safety and content validation', () => {
    it('should reject content with inappropriate words', async () => {
      // Arrange
      const inappropriateReminders = [
        { ...testReminder, title: 'Scary task', description: 'This is frightening' },
        { ...testReminder, title: 'Dangerous activity', description: 'Harmful content' },
        { ...testReminder, title: 'Violent reminder', description: 'Aggressive message' }
      ]
      
      // Act & Assert
      for (const reminder of inappropriateReminders) {
        await expect(integration.deliverMultiModalReminder(reminder, testContext))
          .rejects.toThrow('child safety validation')
      }
    })

    it('should accept positive, encouraging content', async () => {
      // Arrange
      const positiveReminders = [
        { ...testReminder, title: 'Great job time!', description: 'You\'re doing wonderful' },
        { ...testReminder, title: 'Fun learning activity', description: 'Let\'s have an awesome time' },
        { ...testReminder, title: 'Remember to be fantastic', description: 'You can do anything!' }
      ]
      
      // Act & Assert
      for (const reminder of positiveReminders) {
        const result = await integration.deliverMultiModalReminder(reminder, testContext)
        expect(result.success).toBe(true)
      }
    })

    it('should limit content length for child attention span', async () => {
      // Arrange
      testReminder.description = 'This is an extremely long reminder description that goes on and on with way too much information for a child to process effectively and should be rejected for being too lengthy and overwhelming for young users to understand and follow properly.'
      
      // Act & Assert
      await expect(integration.deliverMultiModalReminder(testReminder, testContext))
        .rejects.toThrow('too long for child attention span')
    })
  })

  describe('personalization features', () => {
    it('should create different greetings based on time of day', async () => {
      // Test different times
      const timeTests = [
        { hour: 7, expectedGreeting: 'Rise and shine!' },
        { hour: 10, expectedGreeting: 'Good morning, superstar!' },
        { hour: 14, expectedGreeting: 'Hey there, champion!' },
        { hour: 18, expectedGreeting: 'Good evening, awesome!' },
        { hour: 22, expectedGreeting: 'Hey there!' }
      ]
      
      for (const test of timeTests) {
        // Arrange
        testContext.timeOfDay.hour = test.hour
        
        // Act
        const content = await integration.personalizeReminderContent(
          testReminder, 
          testContext, 
          testPreferences
        )
        
        // Assert
        expect(content.voiceMessage.text).toContain(test.expectedGreeting)
      }
    })

    it('should format reminders differently based on priority', async () => {
      const priorityTests = [
        { priority: Priority.CRITICAL, expectedFormat: 'This is really important:' },
        { priority: Priority.HIGH, expectedFormat: 'Here\'s something important to remember:' },
        { priority: Priority.MEDIUM, expectedFormat: 'Just a friendly reminder about' },
        { priority: Priority.LOW, expectedFormat: 'When you\'re ready, remember' }
      ]
      
      for (const test of priorityTests) {
        // Arrange
        testReminder.priority = test.priority
        
        // Act
        const content = await integration.personalizeReminderContent(
          testReminder, 
          testContext, 
          testPreferences
        )
        
        // Assert
        expect(content.voiceMessage.text).toContain(test.expectedFormat)
      }
    })

    it('should include encouraging closings', async () => {
      // Act
      const content = await integration.personalizeReminderContent(
        testReminder, 
        testContext, 
        testPreferences
      )
      
      // Assert
      const encouragingClosings = [
        'You\'ve got this!',
        'I believe in you!',
        'You\'re amazing!',
        'Keep being awesome!',
        'You can do it!'
      ]
      
      const hasEncouragingClosing = encouragingClosings.some(closing => 
        content.voiceMessage.text.includes(closing)
      )
      expect(hasEncouragingClosing).toBe(true)
    })
  })

  describe('synchronization metrics', () => {
    it('should calculate synchronization metrics correctly', async () => {
      // Arrange
      mockVoiceService.setAvailable(true)
      mockAvatarService.setAvailable(true)
      
      // Act
      const result = await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.synchronization.synchronized).toBeDefined()
      expect(result.synchronization.timingOffset).toBeGreaterThanOrEqual(0)
      expect(result.synchronization.coordinationSuccess).toBeDefined()
    })

    it('should assess user engagement appropriately', async () => {
      // Arrange
      mockVoiceService.setAvailable(true)
      mockAvatarService.setAvailable(true)
      
      // Act
      const result = await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.userEngagement.attentionCaptured).toBeDefined()
      expect(result.userEngagement.responseReceived).toBeDefined()
      expect(result.userEngagement.engagementLevel).toBeGreaterThanOrEqual(0)
      expect(result.userEngagement.engagementLevel).toBeLessThanOrEqual(1)
    })
  })

  describe('error handling and resilience', () => {
    it('should handle service initialization failures', async () => {
      // Arrange
      const failingVoiceService = new MockVoiceNotificationService()
      failingVoiceService.setAvailable(false)
      
      const failingAvatarService = new MockAvatarNotificationService()
      failingAvatarService.setAvailable(false)
      
      const failingIntegration = new AvatarVoiceIntegration(
        failingVoiceService, 
        failingAvatarService
      )
      
      // Act
      const result = await failingIntegration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.voiceResult.errorMessage).toContain('unavailable')
      expect(result.avatarResult.errorMessage).toContain('unavailable')
    })

    it('should emit failure events appropriately', async () => {
      // Arrange
      const eventSpy = jest.fn()
      integration.on('multimodal:failed', eventSpy)
      
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(false)
      
      // Act
      await integration.deliverMultiModalReminder(testReminder, testContext)
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderId: testReminder.id,
          error: expect.any(String),
          timestamp: expect.any(Date)
        })
      )
    })
  })
})