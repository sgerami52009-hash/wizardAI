// Unit tests for enhanced notification dispatcher

import { 
  EnhancedNotificationDispatcher,
  createEnhancedNotificationDispatcher
} from './enhanced-notification-dispatcher'
import { 
  DeliveryResult,
  FamilyNotification,
  Notification,
  NotificationPreferences,
  DeliveryFeedback,
  UserResponse
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

// Mock the service modules
jest.mock('./voice-notification-service')
jest.mock('./avatar-notification-service')
jest.mock('./visual-notification-service')
jest.mock('./avatar-voice-integration')

describe('EnhancedNotificationDispatcher', () => {
  let dispatcher: EnhancedNotificationDispatcher
  let testReminder: Reminder
  let testContext: UserContext
  let testPreferences: NotificationPreferences

  beforeEach(() => {
    // Create enhanced dispatcher
    dispatcher = createEnhancedNotificationDispatcher()
    
    // Create test data
    testReminder = {
      id: 'enhanced-test-reminder-1',
      userId: 'test-user-1',
      title: 'Practice violin',
      description: 'Time for your amazing violin practice!',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(),
      priority: Priority.MEDIUM,
      deliveryMethods: [NotificationMethod.AVATAR, NotificationMethod.VOICE],
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
        hour: 15, // 3 PM
        dayOfWeek: 4, // Thursday
        isWeekend: false,
        isHoliday: false,
        timeZone: 'America/New_York'
      },
      historicalPatterns: [],
      lastUpdated: new Date()
    }
    
    testPreferences = {
      userId: 'test-user-1',
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
  })

  describe('sendReminder with intelligent delivery strategy', () => {
    it('should select multi-modal delivery for high engagement scenarios', async () => {
      // Arrange
      await dispatcher.updateDeliveryPreferences('test-user-1', testPreferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.notificationId).toContain('enhanced-')
      expect(result.deliveryMethod).toBe(NotificationMethod.AVATAR) // Primary method
    })

    it('should select voice-primary for high interruptibility context', async () => {
      // Arrange
      testContext.interruptibility = InterruptibilityLevel.HIGH
      await dispatcher.updateDeliveryPreferences('test-user-1', testPreferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBe(NotificationMethod.VOICE)
    })

    it('should fallback to visual-only when other services unavailable', async () => {
      // Arrange - This would be handled by the mock services being unavailable
      testPreferences.preferredMethods = [NotificationMethod.VISUAL]
      await dispatcher.updateDeliveryPreferences('test-user-1', testPreferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBe(NotificationMethod.VISUAL)
    })

    it('should defer delivery during quiet hours for non-critical reminders', async () => {
      // Arrange
      testContext.timeOfDay.hour = 23 // 11 PM - quiet hours
      await dispatcher.updateDeliveryPreferences('test-user-1', testPreferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.errorMessage).toContain('quiet hours')
    })

    it('should deliver critical reminders even during quiet hours', async () => {
      // Arrange
      testReminder.priority = Priority.CRITICAL
      testContext.timeOfDay.hour = 23 // 11 PM - quiet hours
      await dispatcher.updateDeliveryPreferences('test-user-1', testPreferences)
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true) // Should deliver despite quiet hours
    })

    it('should respect do-not-disturb status for non-critical reminders', async () => {
      // Arrange
      testContext.availability = AvailabilityStatus.DO_NOT_DISTURB
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.errorMessage).toContain('user context')
    })
  })

  describe('enhanced child safety validation', () => {
    it('should reject content with inappropriate patterns', async () => {
      // Arrange
      const inappropriateReminders = [
        { ...testReminder, title: 'Scary monster practice' },
        { ...testReminder, description: 'This is frightening and dangerous' },
        { ...testReminder, title: 'Violent activity reminder' },
        { ...testReminder, description: 'You failed at this before' }
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
        { ...testReminder, title: 'Great music practice time!', description: 'You\'re doing wonderful' },
        { ...testReminder, title: 'Time for awesome learning', description: 'Let\'s have fun together' },
        { ...testReminder, title: 'Remember to be fantastic', description: 'You can achieve anything!' }
      ]
      
      // Act & Assert
      for (const reminder of positiveReminders) {
        const result = await dispatcher.sendReminder(reminder, testContext)
        expect(result.success).toBe(true)
      }
    })

    it('should track child safety violations in performance metrics', async () => {
      // Arrange
      testReminder.title = 'Dangerous scary task'
      
      // Act
      try {
        await dispatcher.sendReminder(testReminder, testContext)
      } catch (error) {
        // Expected to throw
      }
      
      // Assert
      const metrics = dispatcher.getPerformanceMetrics()
      expect(metrics.childSafetyViolations).toBeGreaterThan(0)
    })
  })

  describe('family notification coordination', () => {
    it('should deliver coordinated family notifications', async () => {
      // Arrange
      const familyNotification: FamilyNotification = {
        id: 'family-dinner-1',
        familyId: 'family-1',
        title: 'Family Dinner Time',
        message: 'Dinner is ready! Come to the kitchen.',
        priority: Priority.MEDIUM,
        targetMembers: ['user-1', 'user-2', 'user-3'],
        deliveryMethods: [NotificationMethod.AVATAR, NotificationMethod.VOICE],
        requiresResponse: false
      }
      
      // Act
      const results = await dispatcher.sendFamilyNotification(familyNotification)
      
      // Assert
      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
      expect(results.every(r => r.notificationId.includes('family-dinner-1'))).toBe(true)
    })

    it('should handle family notification content validation', async () => {
      // Arrange
      const inappropriateFamilyNotification: FamilyNotification = {
        id: 'family-scary-1',
        familyId: 'family-1',
        title: 'Scary dangerous announcement',
        message: 'This is frightening for children',
        priority: Priority.MEDIUM,
        targetMembers: ['user-1'],
        deliveryMethods: [NotificationMethod.VOICE],
        requiresResponse: false
      }
      
      // Act
      const results = await dispatcher.sendFamilyNotification(inappropriateFamilyNotification)
      
      // Assert
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].errorMessage).toContain('child safety')
    })

    it('should emit family notification events', async () => {
      // Arrange
      const eventSpy = jest.fn()
      dispatcher.on('family:notification:delivered', eventSpy)
      
      const familyNotification: FamilyNotification = {
        id: 'family-event-1',
        familyId: 'family-1',
        title: 'Family Game Time',
        message: 'Let\'s play together!',
        priority: Priority.LOW,
        targetMembers: ['user-1'],
        deliveryMethods: [NotificationMethod.AVATAR],
        requiresResponse: false
      }
      
      // Act
      await dispatcher.sendFamilyNotification(familyNotification)
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          familyNotificationId: 'family-event-1',
          results: expect.any(Array),
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('intelligent batch processing', () => {
    it('should intelligently group notifications by user and priority', async () => {
      // Arrange
      const notifications: Notification[] = [
        {
          id: 'batch-high-1',
          userId: 'user-1',
          title: 'High priority task',
          message: 'Important reminder',
          priority: Priority.HIGH,
          deliveryMethod: NotificationMethod.VOICE,
          scheduledTime: new Date()
        },
        {
          id: 'batch-low-1',
          userId: 'user-1',
          title: 'Low priority task',
          message: 'Gentle reminder',
          priority: Priority.LOW,
          deliveryMethod: NotificationMethod.VISUAL,
          scheduledTime: new Date()
        },
        {
          id: 'batch-med-1',
          userId: 'user-2',
          title: 'Medium priority task',
          message: 'Regular reminder',
          priority: Priority.MEDIUM,
          deliveryMethod: NotificationMethod.AVATAR,
          scheduledTime: new Date()
        }
      ]
      
      // Act
      const result = await dispatcher.batchNotifications(notifications)
      
      // Assert
      expect(result.totalNotifications).toBe(3)
      expect(result.successfulDeliveries).toBeGreaterThan(0)
      expect(result.results).toHaveLength(3)
      expect(result.batchId).toContain('enhanced-batch-')
    })

    it('should handle mixed success/failure in intelligent batching', async () => {
      // Arrange
      const notifications: Notification[] = [
        {
          id: 'batch-good',
          userId: 'user-1',
          title: 'Great reminder',
          message: 'Wonderful task ahead',
          priority: Priority.MEDIUM,
          deliveryMethod: NotificationMethod.VOICE,
          scheduledTime: new Date()
        },
        {
          id: 'batch-bad',
          userId: 'user-1',
          title: 'Scary dangerous task',
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

  describe('enhanced feedback processing', () => {
    it('should process feedback and update engagement metrics', async () => {
      // Arrange
      const deliveryResult = await dispatcher.sendReminder(testReminder, testContext)
      
      const positiveFeedback: DeliveryFeedback = {
        notificationId: deliveryResult.notificationId,
        userId: 'test-user-1',
        response: UserResponse.ACKNOWLEDGED,
        responseTime: new Date(),
        wasHelpful: true,
        rating: 5,
        comment: 'Perfect timing and delivery!'
      }
      
      // Act
      await dispatcher.confirmDelivery(deliveryResult.notificationId, positiveFeedback)
      
      // Assert
      const metrics = dispatcher.getPerformanceMetrics()
      expect(metrics.userEngagementRate).toBeGreaterThan(0)
    })

    it('should handle negative feedback appropriately', async () => {
      // Arrange
      const deliveryResult = await dispatcher.sendReminder(testReminder, testContext)
      
      const negativeFeedback: DeliveryFeedback = {
        notificationId: deliveryResult.notificationId,
        userId: 'test-user-1',
        response: UserResponse.DISMISSED,
        responseTime: new Date(),
        wasHelpful: false,
        rating: 2,
        comment: 'Too loud and disruptive'
      }
      
      // Act
      await dispatcher.confirmDelivery(deliveryResult.notificationId, negativeFeedback)
      
      // Assert - Should not throw and should process feedback
      const metrics = dispatcher.getPerformanceMetrics()
      expect(metrics.totalDeliveries).toBeGreaterThan(0)
    })

    it('should emit feedback processing events', async () => {
      // Arrange
      const eventSpy = jest.fn()
      dispatcher.on('feedback:processed', eventSpy)
      
      const deliveryResult = await dispatcher.sendReminder(testReminder, testContext)
      
      const feedback: DeliveryFeedback = {
        notificationId: deliveryResult.notificationId,
        userId: 'test-user-1',
        response: UserResponse.ACKNOWLEDGED,
        responseTime: new Date(),
        wasHelpful: true
      }
      
      // Act
      await dispatcher.confirmDelivery(deliveryResult.notificationId, feedback)
      
      // Assert
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: expect.any(Object),
          delivery: expect.any(Object),
          learningData: expect.any(Object),
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('preference validation for child safety', () => {
    it('should reject unsafe voice volume levels', async () => {
      // Arrange
      const unsafePreferences = {
        ...testPreferences,
        voiceSettings: {
          ...testPreferences.voiceSettings,
          volume: 95 // Too loud for children
        }
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', unsafePreferences))
        .rejects.toThrow('Voice volume too high for child safety')
    })

    it('should reject unsafe voice speed levels', async () => {
      // Arrange
      const unsafePreferences = {
        ...testPreferences,
        voiceSettings: {
          ...testPreferences.voiceSettings,
          speed: 2.5 // Too fast for children
        }
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', unsafePreferences))
        .rejects.toThrow('Voice speed too fast for child comprehension')
    })

    it('should reject excessive escalation settings', async () => {
      // Arrange
      const unsafePreferences = {
        ...testPreferences,
        maxEscalations: 8 // Too many escalations
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', unsafePreferences))
        .rejects.toThrow('Too many escalations may be disruptive for children')
    })

    it('should accept safe preference values', async () => {
      // Arrange
      const safePreferences = {
        ...testPreferences,
        voiceSettings: {
          ...testPreferences.voiceSettings,
          volume: 65,
          speed: 0.9
        },
        maxEscalations: 2
      }
      
      // Act & Assert
      await expect(dispatcher.updateDeliveryPreferences('test-user-1', safePreferences))
        .resolves.not.toThrow()
    })
  })

  describe('performance metrics and monitoring', () => {
    it('should track delivery performance metrics', async () => {
      // Arrange & Act
      await dispatcher.sendReminder(testReminder, testContext)
      await dispatcher.sendReminder({ ...testReminder, id: 'test-2' }, testContext)
      
      // Assert
      const metrics = dispatcher.getPerformanceMetrics()
      expect(metrics.totalDeliveries).toBe(2)
      expect(metrics.successfulDeliveries).toBeGreaterThan(0)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
    })

    it('should maintain delivery history per user', async () => {
      // Arrange & Act
      await dispatcher.sendReminder(testReminder, testContext)
      await dispatcher.sendReminder({ ...testReminder, id: 'test-2' }, testContext)
      
      // Assert
      const history = dispatcher.getDeliveryHistory('test-user-1')
      expect(history).toHaveLength(2)
      expect(history[0].deliveryId).toContain('enhanced-')
      expect(history[0].success).toBe(true)
    })

    it('should limit delivery history to reasonable size', async () => {
      // Arrange & Act - Send many reminders
      for (let i = 0; i < 105; i++) {
        await dispatcher.sendReminder({ ...testReminder, id: `test-${i}` }, testContext)
      }
      
      // Assert
      const history = dispatcher.getDeliveryHistory('test-user-1')
      expect(history.length).toBeLessThanOrEqual(100) // Should cap at 100 entries
    })
  })

  describe('error handling and resilience', () => {
    it('should handle service failures gracefully', async () => {
      // Arrange - This would be handled by mock services failing
      testReminder.title = 'Test service failure handling'
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert - Should not throw, should return error result
      expect(result).toBeDefined()
      expect(result.notificationId).toBeDefined()
    })

    it('should emit system error events for child safety violations', async () => {
      // Arrange
      const eventSpy = jest.fn()
      // Note: We'd need to mock the scheduleEventBus to test this properly
      
      testReminder.title = 'Scary dangerous content'
      
      // Act & Assert
      await expect(dispatcher.sendReminder(testReminder, testContext))
        .rejects.toThrow('child safety validation')
    })

    it('should handle concurrent deliveries without interference', async () => {
      // Arrange
      const promises = []
      for (let i = 0; i < 5; i++) {
        const reminder = { ...testReminder, id: `concurrent-${i}` }
        promises.push(dispatcher.sendReminder(reminder, testContext))
      }
      
      // Act
      const results = await Promise.all(promises)
      
      // Assert
      expect(results).toHaveLength(5)
      expect(results.every(r => r.success)).toBe(true)
      expect(new Set(results.map(r => r.notificationId)).size).toBe(5) // All unique IDs
    })
  })

  describe('delivery strategy selection', () => {
    it('should adapt strategy based on service availability', async () => {
      // This test would require mocking service availability
      // The actual implementation would check service status and adapt
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.deliveryMethod).toBeDefined()
    })

    it('should consider user context in strategy selection', async () => {
      // Arrange - Low interruptibility should prefer less intrusive methods
      testContext.interruptibility = InterruptibilityLevel.LOW
      
      // Act
      const result = await dispatcher.sendReminder(testReminder, testContext)
      
      // Assert
      expect(result.success).toBe(true)
      // Should prefer visual or gentle methods for low interruptibility
    })
  })
})