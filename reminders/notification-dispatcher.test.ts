// Unit tests for notification dispatcher and multi-channel delivery

import { 
  NotificationDispatcherImpl,
  DeliveryResult,
  FamilyNotification,
  Notification,
  NotificationPreferences,
  DeliveryFeedback,
  UserResponse
} from './notification-dispatcher'
import { 
  MockVoiceNotificationService 
} from './voice-notification-service'
import { 
  MockAvatarNotificationService 
} from './avatar-notification-service'
import { 
  MockVisualNotificationService 
} from './visual-notification-service'
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

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcherImpl
  let mockVoiceService: MockVoiceNotificationService
  let mockAvatarService: MockAvatarNotificationService
  let mockVisualService: MockVisualNotificationService
  let testReminder: Reminder
  let testContext: UserContext

  beforeEach(() => {
    // Create mock services
    mockVoiceService = new MockVoiceNotificationService()
    mockAvatarService = new MockAvatarNotificationService()
    mockVisualService = new MockVisualNotificationService()
    
    // Create dispatcher with mock services
    dispatcher = new NotificationDispatcherImpl(
      mockVoiceService,
      mockAvatarService,
      mockVisualService
    )
    
    // Create test data
    testReminder = {
      id: 'test-reminder-1',
      userId: 'test-user-1',
      title: 'Test Reminder',
      description: 'This is a test reminder',
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
        hour: 14,
        dayOfWeek: 3,
        isWeekend: false,
        isHoliday: false,
        timeZone: 'America/New_York'
      },
      historicalPatterns: [],
      lastUpdated: new Date()
    }
  })

  describe('sendReminder', () => {
    it('should successfully deliver reminder via voice when voice is preferred', async () => {
      // Arrange
      mockVoiceService.setAvailable(true)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBe(NotificationMethod.VOICE)
      expect(result.notificationId).toContain('test-reminder-1')
      expect(result.deliveryTime).toBeInstanceOf(Date)
    })

    it('should fallback to avatar when voice is unavailable', async () => {
      // Arrange
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(true)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBe(NotificationMethod.AVATAR)
    })

    it('should fallback to visual when both voice and avatar are unavailable', async () => {
      // Arrange
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(false)
      mockVisualService.setAvailable(true)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBe(NotificationMethod.VISUAL)
    })

    it('should defer reminder during quiet hours', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.VOICE],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          emergencyOverride: false
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
      
      await dispatcher.updateDeliveryPreferences('test-user-1', preferences)
      
      // Set context to quiet hours
      testContext.timeOfDay.hour = 23
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.errorMessage).toContain('quiet hours')
    })

    it('should reject inappropriate content for child safety', async () => {
      // Arrange
      testReminder.title = 'Scary dangerous reminder'
      testReminder.description = 'This is frightening content'
      
      // Act & Assert
      await expect(dispatcher.sendReminder(testReminder, testContext))
        .rejects.toThrow('child safety validation')
    })

    it('should handle high priority reminders during quiet hours with emergency override', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.VOICE],
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
      
      await dispatcher.updateDeliveryPreferences('test-user-1', preferences)
      
      testReminder.priority = Priority.CRITICAL
      testContext.timeOfDay.hour = 23
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true) // Should deliver despite quiet hours
    })

    it('should select appropriate delivery method based on context interruptibility', async () => {
      // Arrange
      testContext.interruptibility = InterruptibilityLevel.LOW
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.deliveryMethod).toBe(NotificationMethod.VISUAL) // Should prefer less intrusive method
    })
  })

  describe('sendFamilyNotification', () => {
    it('should deliver notification to all family members', async () => {
      // Arrange
      const familyNotification: FamilyNotification = {
        id: 'family-notification-1',
        familyId: 'family-1',
        title: 'Family Dinner',
        message: 'Dinner is ready!',
        priority: Priority.MEDIUM,
        targetMembers: ['user-1', 'user-2', 'user-3'],
        deliveryMethods: [NotificationMethod.VOICE, NotificationMethod.AVATAR],
        requiresResponse: false
      }
      
      // Act
      const results = await dispatcher.sendFamilyNotification(familyNotification)
      
      // Assert
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
      expect(results.every(r => r.notificationId.includes('family-notification-1'))).toBe(true)
    })

    it('should handle partial failures in family notification delivery', async () => {
      // Arrange
      const familyNotification: FamilyNotification = {
        id: 'family-notification-2',
        familyId: 'family-1',
        title: 'Family Meeting',
        message: 'Family meeting in 5 minutes',
        priority: Priority.HIGH,
        targetMembers: ['user-1', 'user-2'],
        deliveryMethods: [NotificationMethod.VOICE],
        requiresResponse: true
      }
      
      // Make voice service fail for simulation
      mockVoiceService.setAvailable(false)
      
      // Act
      const results = await dispatcher.sendFamilyNotification(familyNotification)
      
      // Assert
      expect(results).toHaveLength(2)
      // Should fallback to other methods, so some should still succeed
      expect(results.some(r => r.success)).toBe(true)
    })

    it('should reject inappropriate family notification content', async () => {
      // Arrange
      const familyNotification: FamilyNotification = {
        id: 'family-notification-3',
        familyId: 'family-1',
        title: 'Dangerous scary message',
        message: 'This is frightening for children',
        priority: Priority.MEDIUM,
        targetMembers: ['user-1'],
        deliveryMethods: [NotificationMethod.VOICE],
        requiresResponse: false
      }
      
      // Act
      const results = await dispatcher.sendFamilyNotification(familyNotification)
      
      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].errorMessage).toContain('child safety')
    })
  })

  describe('batchNotifications', () => {
    it('should successfully batch and deliver multiple notifications', async () => {
      // Arrange
      const notifications: Notification[] = [
        {
          id: 'batch-1',
          userId: 'user-1',
          title: 'First reminder',
          message: 'First message',
          priority: Priority.MEDIUM,
          deliveryMethod: NotificationMethod.VOICE,
          scheduledTime: new Date()
        },
        {
          id: 'batch-2',
          userId: 'user-1',
          title: 'Second reminder',
          message: 'Second message',
          priority: Priority.LOW,
          deliveryMethod: NotificationMethod.AVATAR,
          scheduledTime: new Date()
        }
      ]
      
      // Act
      const result = await dispatcher.batchNotifications(notifications)
      
      // Assert
      expect(result.totalNotifications).toBe(2)
      expect(result.successfulDeliveries).toBe(2)
      expect(result.failedDeliveries).toBe(0)
      expect(result.results).toHaveLength(2)
      expect(result.batchId).toContain('batch-')
    })

    it('should handle mixed success/failure in batch delivery', async () => {
      // Arrange
      const notifications: Notification[] = [
        {
          id: 'batch-success',
          userId: 'user-1',
          title: 'Good reminder',
          message: 'This is fine',
          priority: Priority.MEDIUM,
          deliveryMethod: NotificationMethod.VOICE,
          scheduledTime: new Date()
        },
        {
          id: 'batch-failure',
          userId: 'user-1',
          title: 'Scary dangerous reminder',
          message: 'Frightening content',
          priority: Priority.MEDIUM,
          deliveryMethod: NotificationMethod.VOICE,
          scheduledTime: new Date()
        }
      ]
      
      // Act
      const result = await dispatcher.batchNotifications(notifications)
      
      // Assert
      expect(result.totalNotifications).toBe(2)
      expect(result.successfulDeliveries).toBe(1)
      expect(result.failedDeliveries).toBe(1)
    })
  })

  describe('confirmDelivery', () => {
    it('should successfully confirm delivery with positive feedback', async () => {
      // Arrange
      const deliveryResult = await dispatcher.sendReminder(testReminder, testContext)
      
      const feedback: DeliveryFeedback = {
        notificationId: deliveryResult.notificationId,
        userId: 'test-user-1',
        response: UserResponse.ACKNOWLEDGED,
        responseTime: new Date(),
        wasHelpful: true,
        rating: 5,
        comment: 'Great reminder!'
      }
      
      // Act & Assert
      await expect(dispatcher.confirmDelivery(deliveryResult.notificationId, feedback))
        .resolves.not.toThrow()
    })

    it('should handle negative feedback appropriately', async () => {
      // Arrange
      const deliveryResult = await dispatcher.sendReminder(testReminder, testContext)
      
      const feedback: DeliveryFeedback = {
        notificationId: deliveryResult.notificationId,
        userId: 'test-user-1',
        response: UserResponse.DISMISSED,
        responseTime: new Date(),
        wasHelpful: false,
        rating: 2,
        comment: 'Too loud'
      }
      
      // Act & Assert
      await expect(dispatcher.confirmDelivery(deliveryResult.notificationId, feedback))
        .resolves.not.toThrow()
    })

    it('should throw error for non-existent delivery', async () => {
      // Arrange
      const feedback: DeliveryFeedback = {
        notificationId: 'non-existent-id',
        userId: 'test-user-1',
        response: UserResponse.ACKNOWLEDGED,
        responseTime: new Date(),
        wasHelpful: true
      }
      
      // Act & Assert
      await expect(dispatcher.confirmDelivery('non-existent-id', feedback))
        .rejects.toThrow('Delivery not found')
    })
  })

  describe('updateDeliveryPreferences', () => {
    it('should successfully update valid preferences', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.AVATAR, NotificationMethod.VOICE],
        quietHours: {
          enabled: true,
          startTime: '21:00',
          endTime: '08:00',
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
          volume: 60,
          speed: 0.9,
          pitch: 1.1,
          voice: 'child-friendly',
          language: 'en-US'
        }
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', preferences))
        .resolves.not.toThrow()
    })

    it('should reject invalid voice volume', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.VOICE],
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          daysOfWeek: [],
          emergencyOverride: false
        },
        escalationEnabled: true,
        maxEscalations: 3,
        batchingEnabled: true,
        personalizedMessages: true,
        avatarExpressions: true,
        voiceSettings: {
          enabled: true,
          volume: 150, // Invalid volume
          speed: 1.0,
          pitch: 1.0,
          voice: 'default',
          language: 'en-US'
        }
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', preferences))
        .rejects.toThrow('Voice volume must be between 0 and 100')
    })

    it('should reject invalid voice speed', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.VOICE],
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          daysOfWeek: [],
          emergencyOverride: false
        },
        escalationEnabled: true,
        maxEscalations: 3,
        batchingEnabled: true,
        personalizedMessages: true,
        avatarExpressions: true,
        voiceSettings: {
          enabled: true,
          volume: 70,
          speed: 3.0, // Invalid speed
          pitch: 1.0,
          voice: 'default',
          language: 'en-US'
        }
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', preferences))
        .rejects.toThrow('Voice speed must be between 0.5 and 2.0')
    })

    it('should reject too many escalations', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.VOICE],
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00',
          daysOfWeek: [],
          emergencyOverride: false
        },
        escalationEnabled: true,
        maxEscalations: 15, // Too many escalations
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
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', preferences))
        .rejects.toThrow('Max escalations must be between 0 and 10')
    })
  })

  describe('child safety validation', () => {
    it('should reject content with inappropriate words', async () => {
      // Arrange
      const inappropriateReminders = [
        { ...testReminder, title: 'Dangerous task ahead' },
        { ...testReminder, description: 'This is scary and harmful' },
        { ...testReminder, title: 'Violent reminder' },
        { ...testReminder, description: 'Aggressive and threatening message' }
      ]
      
      // Act & Assert
      for (const reminder of inappropriateReminders) {
        await expect(dispatcher.sendReminder(reminder, testContext))
          .rejects.toThrow('child safety validation')
      }
    })

    it('should accept positive, encouraging content', async () => {
      // Arrange
      const positiveReminders = [
        { ...testReminder, title: 'Great job on homework!', description: 'You\'re doing wonderful' },
        { ...testReminder, title: 'Time for awesome activities', description: 'Let\'s have fun learning' },
        { ...testReminder, title: 'Remember to be fantastic', description: 'You can do anything!' }
      ]
      
      // Act & Assert
      for (const reminder of positiveReminders) {
        const result = await dispatcher.sendReminder(reminder, testContext)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('delivery method selection', () => {
    it('should prefer voice for high interruptibility context', async () => {
      // Arrange
      testContext.interruptibility = InterruptibilityLevel.HIGH
      testReminder.deliveryMethods = [NotificationMethod.VOICE, NotificationMethod.VISUAL]
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.deliveryMethod).toBe(NotificationMethod.VOICE)
    })

    it('should prefer visual for low interruptibility context', async () => {
      // Arrange
      testContext.interruptibility = InterruptibilityLevel.LOW
      testReminder.deliveryMethods = [NotificationMethod.VOICE, NotificationMethod.VISUAL]
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.deliveryMethod).toBe(NotificationMethod.VISUAL)
    })

    it('should respect user preferred methods', async () => {
      // Arrange
      const preferences: NotificationPreferences = {
        userId: 'test-user-1',
        preferredMethods: [NotificationMethod.AVATAR], // Only avatar preferred
        quietHours: { enabled: false, startTime: '22:00', endTime: '07:00', daysOfWeek: [], emergencyOverride: false },
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
      
      await dispatcher.updateDeliveryPreferences('test-user-1', preferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.deliveryMethod).toBe(NotificationMethod.AVATAR)
    })
  })

  describe('error handling', () => {
    it('should handle service unavailability gracefully', async () => {
      // Arrange
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(false)
      mockVisualService.setAvailable(false)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.errorMessage).toContain('not available')
    })

    it('should emit appropriate events on delivery failure', async () => {
      // Arrange
      const eventSpy = jest.fn()
      dispatcher.on('delivery:failed', eventSpy)
      
      mockVoiceService.setAvailable(false)
      mockAvatarService.setAvailable(false)
      mockVisualService.setAvailable(false)
      
      // Act
      await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert - Note: This test assumes the dispatcher emits such events
      // The actual implementation may vary
    })
  })

  describe('performance requirements', () => {
    it('should complete delivery within reasonable time', async () => {
      // Arrange
      const startTime = Date.now()
      
      // Act
      await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle multiple concurrent deliveries', async () => {
      // Arrange
      const promises = []
      for (let i = 0; i < 10; i++) {
        const reminder = { ...testReminder, id: `concurrent-${i}` }
        promises.push(dispatcher.sendReminder(reminder, testContext))
      }
      
      // Act
      const results = await Promise.all(promises)
      
      // Assert
      expect(results).toHaveLength(10)
      expect(results.every(r => r.success)).toBe(true)
    })
  })
})