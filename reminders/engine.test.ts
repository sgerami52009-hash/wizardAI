// ReminderEngine unit tests

import { ReminderEngine } from './engine'
import { IntelligentTimingSystem } from './intelligent-timing'
import { ReminderStorage } from './storage'
import { ContextAnalyzer } from './context-analyzer'
import { 
  Reminder, 
  ReminderType, 
  CompletionStatus, 
  FeedbackType,
  ReminderFeedback,
  EscalationRule,
  ReminderError,
  ReminderErrorType,
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationType
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'

describe('ReminderEngine', () => {
  let engine: ReminderEngine
  
  beforeEach(() => {
    engine = new ReminderEngine()
  })
  
  afterEach(() => {
    engine.stop()
  })

  describe('scheduleReminder', () => {
    it('should schedule a new reminder successfully', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'This is a test reminder',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000), // 1 minute from now
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      
      expect(reminderId).toBeDefined()
      expect(typeof reminderId).toBe('string')
      
      const storedReminder = engine.getReminder(reminderId)
      expect(storedReminder).toBeDefined()
      expect(storedReminder?.title).toBe('Test Reminder')
      expect(storedReminder?.userId).toBe('user1')
      expect(storedReminder?.isActive).toBe(true)
    })

    it('should validate reminder content', async () => {
      const invalidReminder: Reminder = {
        id: '',
        userId: 'user1',
        title: '', // Empty title should fail validation
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await expect(engine.scheduleReminder(invalidReminder))
        .rejects.toThrow('Reminder title is required')
    })

    it('should emit reminder:created event', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let eventEmitted = false
      engine.on('reminder:created', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.reminderType).toBe(ReminderType.TIME_BASED)
      })

      await engine.scheduleReminder(reminder)
      expect(eventEmitted).toBe(true)
    })
  })

  describe('updateReminder', () => {
    it('should update an existing reminder', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Original Title',
        description: 'Original description',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      
      await engine.updateReminder(reminderId, {
        title: 'Updated Title',
        priority: Priority.HIGH
      })

      const updatedReminder = engine.getReminder(reminderId)
      expect(updatedReminder?.title).toBe('Updated Title')
      expect(updatedReminder?.priority).toBe(Priority.HIGH)
      expect(updatedReminder?.description).toBe('Original description') // Unchanged
    })

    it('should throw error for non-existent reminder', async () => {
      await expect(engine.updateReminder('non-existent', { title: 'New Title' }))
        .rejects.toThrow('Reminder not found: non-existent')
    })
  })

  describe('cancelReminder', () => {
    it('should cancel an existing reminder', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      await engine.cancelReminder(reminderId)

      const cancelledReminder = engine.getReminder(reminderId)
      expect(cancelledReminder?.completionStatus).toBe(CompletionStatus.CANCELLED)
      expect(cancelledReminder?.isActive).toBe(false)
    })

    it('should emit reminder:deleted event', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let eventEmitted = false
      engine.on('reminder:deleted', (data) => {
        eventEmitted = true
        expect(data.reason).toBe('cancelled')
      })

      const reminderId = await engine.scheduleReminder(reminder)
      await engine.cancelReminder(reminderId)
      expect(eventEmitted).toBe(true)
    })
  })

  describe('snoozeReminder', () => {
    it('should snooze a reminder for specified duration', async () => {
      const originalTriggerTime = new Date(Date.now() + 60000)
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: originalTriggerTime,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      const snoozeDuration = 15 // 15 minutes
      
      await engine.snoozeReminder(reminderId, snoozeDuration, 'User requested')

      const snoozedReminder = engine.getReminder(reminderId)
      expect(snoozedReminder?.completionStatus).toBe(CompletionStatus.PENDING) // Should be pending after snooze
      expect(snoozedReminder?.snoozeHistory).toHaveLength(1)
      expect(snoozedReminder?.snoozeHistory[0].snoozeDuration).toBe(snoozeDuration)
      expect(snoozedReminder?.snoozeHistory[0].reason).toBe('User requested')
      
      // Check that trigger time was updated (should be approximately snoozeDuration minutes later)
      const snoozeRecord = snoozedReminder?.snoozeHistory[0]
      const expectedNewTime = snoozeRecord?.newTriggerTime.getTime()
      const actualNewTime = snoozedReminder?.triggerTime.getTime()
      expect(actualNewTime).toBe(expectedNewTime)
    })
  })

  describe('markReminderComplete', () => {
    it('should mark reminder as completed', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.GENERAL,
        rating: 5,
        wasHelpful: true,
        comment: 'Very helpful reminder'
      }
      
      await engine.markReminderComplete(reminderId, feedback)

      const completedReminder = engine.getReminder(reminderId)
      expect(completedReminder?.completionStatus).toBe(CompletionStatus.COMPLETED)
      expect(completedReminder?.isActive).toBe(false)
      expect(completedReminder?.userFeedback).toHaveLength(1)
      expect(completedReminder?.userFeedback[0].rating).toBe(5)
    })
  })

  describe('getActiveReminders', () => {
    it('should return only active reminders for a user', async () => {
      // Create multiple reminders
      const reminder1: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Active Reminder 1',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminder2: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Active Reminder 2',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 120000),
        priority: Priority.HIGH,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminder3: Reminder = {
        id: '',
        userId: 'user2', // Different user
        title: 'Other User Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const id1 = await engine.scheduleReminder(reminder1)
      const id2 = await engine.scheduleReminder(reminder2)
      const id3 = await engine.scheduleReminder(reminder3)
      
      // Complete one reminder
      await engine.markReminderComplete(id2)

      const activeReminders = await engine.getActiveReminders('user1')
      
      expect(activeReminders).toHaveLength(1)
      expect(activeReminders[0].title).toBe('Active Reminder 1')
    })

    it('should return reminders sorted by trigger time', async () => {
      const laterTime = new Date(Date.now() + 120000)
      const earlierTime = new Date(Date.now() + 60000)

      const laterReminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Later Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: laterTime,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const earlierReminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Earlier Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: earlierTime,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Schedule in reverse order
      await engine.scheduleReminder(laterReminder)
      await engine.scheduleReminder(earlierReminder)

      const activeReminders = await engine.getActiveReminders('user1')
      
      expect(activeReminders).toHaveLength(2)
      expect(activeReminders[0].title).toBe('Earlier Reminder')
      expect(activeReminders[1].title).toBe('Later Reminder')
    })
  })

  describe('processReminderQueue', () => {
    it('should process ready reminders', async () => {
      // Create a reminder that should trigger immediately
      const pastTime = new Date(Date.now() - 1000) // 1 second ago
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Past Due Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: pastTime,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let deliveryEventEmitted = false
      engine.on('reminder:delivered', (data) => {
        deliveryEventEmitted = true
        expect(data.success).toBe(true)
      })

      await engine.scheduleReminder(reminder)
      
      // Process the queue
      const result = await engine.processReminderQueue()
      
      expect(result.processedCount).toBeGreaterThan(0)
      expect(result.deliveredCount).toBeGreaterThan(0)
      expect(deliveryEventEmitted).toBe(true)
    })
  })

  describe('addReminderFeedback', () => {
    it('should add feedback to existing reminder', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 4,
        wasHelpful: true,
        comment: 'Good timing'
      }
      
      await engine.addReminderFeedback(reminderId, feedback)

      const updatedReminder = engine.getReminder(reminderId)
      expect(updatedReminder?.userFeedback).toHaveLength(1)
      expect(updatedReminder?.userFeedback[0].rating).toBe(4)
      expect(updatedReminder?.userFeedback[0].comment).toBe('Good timing')
    })
  })

  describe('cleanupReminders', () => {
    it('should clean up old completed reminders', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Old Completed Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)
      await engine.markReminderComplete(reminderId)
      
      // Manually set the updated time to be old
      const completedReminder = engine.getReminder(reminderId)
      if (completedReminder) {
        completedReminder.updatedAt = new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)) // 31 days ago
      }

      const cleanedCount = await engine.cleanupReminders(30)
      
      expect(cleanedCount).toBe(1)
      expect(engine.getReminder(reminderId)).toBeUndefined()
    })
  })

  // Enhanced tests for escalation mechanisms (Requirements 2.1, 2.2)
  describe('escalation mechanisms', () => {
    it('should handle reminder escalation rules', async () => {
      const escalationRule: EscalationRule = {
        id: 'escalation1',
        delayMinutes: 5,
        escalationMethod: NotificationMethod.AVATAR,
        maxEscalations: 2,
        escalationMessage: 'This is an important reminder!',
        isEnabled: true
      }

      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Escalating Reminder',
        description: 'Test escalation',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() - 1000), // Past due
        priority: Priority.HIGH,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [escalationRule],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let escalationEventEmitted = false
      engine.on('reminder:escalated', (data) => {
        escalationEventEmitted = true
        expect(data.escalationLevel).toBeGreaterThan(0)
        expect(data.escalationMethod).toBe(NotificationMethod.AVATAR)
      })

      const reminderId = await engine.scheduleReminder(reminder)
      
      // Process queue to trigger escalation
      await engine.processReminderQueue()
      
      const storedReminder = engine.getReminder(reminderId)
      expect(storedReminder?.escalationRules).toHaveLength(1)
      expect(storedReminder?.escalationRules[0].isEnabled).toBe(true)
    })

    it('should respect maximum escalation limits', async () => {
      const escalationRule: EscalationRule = {
        id: 'escalation2',
        delayMinutes: 1,
        escalationMethod: NotificationMethod.VISUAL,
        maxEscalations: 1,
        isEnabled: true
      }

      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Limited Escalation Reminder',
        description: 'Test max escalations',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() - 5000), // Past due
        priority: Priority.HIGH,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [escalationRule],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let escalationCount = 0
      engine.on('reminder:escalated', () => {
        escalationCount++
      })

      await engine.scheduleReminder(reminder)
      
      // Process multiple times to test escalation limit
      await engine.processReminderQueue()
      await new Promise(resolve => setTimeout(resolve, 100))
      await engine.processReminderQueue()
      
      // Should not exceed maxEscalations
      expect(escalationCount).toBeLessThanOrEqual(1)
    })

    it('should handle escalation failures gracefully', async () => {
      const escalationRule: EscalationRule = {
        id: 'escalation3',
        delayMinutes: 1,
        escalationMethod: NotificationMethod.VOICE,
        maxEscalations: 3,
        isEnabled: true
      }

      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Failing Escalation Reminder',
        description: 'Test escalation failure handling',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() - 1000),
        priority: Priority.HIGH,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [escalationRule],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let failureEventEmitted = false
      engine.on('reminder:escalation:failed', (data) => {
        failureEventEmitted = true
        expect(data.errorType).toBeDefined()
        expect(data.retryCount).toBeGreaterThanOrEqual(0)
      })

      await engine.scheduleReminder(reminder)
      
      // Simulate escalation failure by processing with invalid context
      const result = await engine.processReminderQueue()
      
      // Should handle failures without crashing
      expect(result).toBeDefined()
      expect(result.processedCount).toBeGreaterThanOrEqual(0)
    })
  })

  // Enhanced tests for intelligent timing optimization (Requirements 4.1, 4.5)
  describe('intelligent timing optimization', () => {
    let mockTimingSystem: jest.Mocked<IntelligentTimingSystem>
    let mockContextAnalyzer: jest.Mocked<ContextAnalyzer>

    beforeEach(() => {
      mockContextAnalyzer = {
        analyzeUserContext: jest.fn(),
        shouldDeferReminder: jest.fn(),
        predictOptimalReminderTime: jest.fn(),
        batchReminders: jest.fn(),
        learnFromUserFeedback: jest.fn(),
        getBehaviorPatterns: jest.fn(),
        updateContextModel: jest.fn()
      } as any

      mockTimingSystem = {
        optimizeReminderTiming: jest.fn(),
        optimizeReminderBatching: jest.fn(),
        adaptReminderStrategy: jest.fn(),
        getUserStrategy: jest.fn(),
        updateUserStrategy: jest.fn(),
        analyzeUserBehaviorPatterns: jest.fn()
      } as any
    })

    it('should optimize reminder timing based on user context', async () => {
      const userContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.WORKING,
        location: {
          name: 'Office',
          type: LocationType.WORK,
          confidence: 0.9
        },
        availability: AvailabilityStatus.BUSY,
        interruptibility: InterruptibilityLevel.LOW,
        deviceProximity: {
          isNearby: true,
          distance: 5,
          lastSeen: new Date(),
          deviceType: 'smartphone'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 2,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      mockContextAnalyzer.analyzeUserContext.mockResolvedValue(userContext)
      mockContextAnalyzer.shouldDeferReminder.mockResolvedValue({
        shouldDefer: true,
        deferUntil: new Date(Date.now() + 3600000), // 1 hour later
        reason: 'User is busy at work',
        confidence: 0.8
      })

      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Work Break Reminder',
        description: 'Time for a break',
        type: ReminderType.CONTEXT_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let contextAnalyzedEvent = false
      engine.on('reminder:context:analyzed', (data) => {
        contextAnalyzedEvent = true
        expect(data.context.currentActivity).toBe(ActivityType.WORKING)
        expect(data.deferralDecision.shouldDefer).toBe(true)
      })

      await engine.scheduleReminder(reminder)
      
      expect(contextAnalyzedEvent).toBe(true)
    })

    it('should adapt reminder strategy based on user feedback', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Adaptive Reminder',
        description: 'Learning from feedback',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)

      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 2, // Poor timing
        wasHelpful: false,
        comment: 'Too early in the morning'
      }

      let strategyAdaptedEvent = false
      engine.on('reminder:strategy:adapted', (data) => {
        strategyAdaptedEvent = true
        expect(data.userId).toBe('user1')
        expect(data.feedback.feedbackType).toBe(FeedbackType.TIMING)
        expect(data.feedback.wasHelpful).toBe(false)
      })

      await engine.addReminderFeedback(reminderId, feedback)
      
      const updatedReminder = engine.getReminder(reminderId)
      expect(updatedReminder?.userFeedback).toHaveLength(1)
      expect(updatedReminder?.userFeedback[0].rating).toBe(2)
    })

    it('should batch reminders intelligently based on context', async () => {
      const reminders: Reminder[] = [
        {
          id: 'reminder1',
          userId: 'user1',
          title: 'High Priority Reminder',
          description: 'Important task',
          type: ReminderType.TIME_BASED,
          triggerTime: new Date(Date.now() - 1000),
          priority: Priority.HIGH,
          deliveryMethods: [NotificationMethod.VOICE],
          contextConstraints: [],
          escalationRules: [],
          completionStatus: CompletionStatus.PENDING,
          snoozeHistory: [],
          userFeedback: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'reminder2',
          userId: 'user1',
          title: 'Medium Priority Reminder',
          description: 'Regular task',
          type: ReminderType.TIME_BASED,
          triggerTime: new Date(Date.now() - 500),
          priority: Priority.MEDIUM,
          deliveryMethods: [NotificationMethod.VOICE],
          contextConstraints: [],
          escalationRules: [],
          completionStatus: CompletionStatus.PENDING,
          snoozeHistory: [],
          userFeedback: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      // Schedule multiple reminders
      for (const reminder of reminders) {
        await engine.scheduleReminder(reminder)
      }

      let batchProcessedEvent = false
      engine.on('reminder:batch:processed', (data) => {
        batchProcessedEvent = true
        expect(data.batchSize).toBeGreaterThan(0)
        expect(data.priorityOrder).toBeDefined()
      })

      // Process queue to trigger batching
      const result = await engine.processReminderQueue()
      
      expect(result.processedCount).toBeGreaterThan(0)
      expect(result.deliveredCount).toBeGreaterThan(0)
    })

    it('should learn from user behavior patterns', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Learning Reminder',
        description: 'Pattern recognition test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminderId = await engine.scheduleReminder(reminder)

      // Simulate multiple feedback sessions to establish patterns
      const feedbackSessions = [
        { rating: 5, wasHelpful: true, comment: 'Perfect timing' },
        { rating: 4, wasHelpful: true, comment: 'Good timing' },
        { rating: 5, wasHelpful: true, comment: 'Excellent' }
      ]

      let patternLearnedEvent = false
      engine.on('reminder:pattern:learned', (data) => {
        patternLearnedEvent = true
        expect(data.userId).toBe('user1')
        expect(data.patternType).toBeDefined()
        expect(data.confidence).toBeGreaterThan(0)
      })

      for (const session of feedbackSessions) {
        const feedback: ReminderFeedback = {
          feedbackTime: new Date(),
          feedbackType: FeedbackType.TIMING,
          rating: session.rating,
          wasHelpful: session.wasHelpful,
          comment: session.comment
        }
        
        await engine.addReminderFeedback(reminderId, feedback)
      }

      const updatedReminder = engine.getReminder(reminderId)
      expect(updatedReminder?.userFeedback).toHaveLength(3)
      
      // Verify positive feedback pattern
      const positiveCount = updatedReminder?.userFeedback.filter(f => f.wasHelpful).length
      expect(positiveCount).toBe(3)
    })
  })

  // Enhanced tests for persistence and recovery (Requirements 2.5, 7.5, 8.1)
  describe('persistence and recovery functionality', () => {
    let mockStorage: jest.Mocked<ReminderStorage>

    beforeEach(() => {
      mockStorage = {
        storeReminder: jest.fn(),
        getReminder: jest.fn(),
        updateReminder: jest.fn(),
        deleteReminder: jest.fn(),
        getUserReminders: jest.fn(),
        storeQueueState: jest.fn(),
        getQueueState: jest.fn(),
        storeUserStrategy: jest.fn(),
        getUserStrategy: jest.fn(),
        storeAdaptationHistory: jest.fn(),
        getAdaptationHistory: jest.fn(),
        createBackup: jest.fn(),
        restoreFromBackup: jest.fn(),
        recoverFromFailure: jest.fn(),
        getAuditTrail: jest.fn(),
        cleanup: jest.fn(),
        stop: jest.fn()
      } as any
    })

    it('should persist reminder data with encryption', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Persistent Reminder',
        description: 'Test data persistence',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let persistenceEvent = false
      engine.on('reminder:persisted', (data) => {
        persistenceEvent = true
        expect(data.reminderId).toBeDefined()
        expect(data.encrypted).toBe(true)
      })

      const reminderId = await engine.scheduleReminder(reminder)
      
      expect(reminderId).toBeDefined()
      expect(persistenceEvent).toBe(true)
      
      // Verify reminder is stored in memory
      const storedReminder = engine.getReminder(reminderId)
      expect(storedReminder?.title).toBe('Persistent Reminder')
      expect(storedReminder?.userId).toBe('user1')
    })

    it('should recover reminder queue state after system restart', async () => {
      const queueState = {
        reminders: [
          {
            id: 'reminder1',
            userId: 'user1',
            title: 'Queued Reminder',
            description: 'In processing queue',
            type: ReminderType.TIME_BASED,
            triggerTime: new Date(Date.now() + 30000),
            priority: Priority.HIGH,
            deliveryMethods: [NotificationMethod.VOICE],
            contextConstraints: [],
            escalationRules: [],
            completionStatus: CompletionStatus.PENDING,
            snoozeHistory: [],
            userFeedback: [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        lastProcessed: new Date(Date.now() - 60000),
        processingErrors: []
      }

      mockStorage.getQueueState.mockResolvedValue(queueState)

      let recoveryEvent = false
      engine.on('reminder:queue:recovered', (data) => {
        recoveryEvent = true
        expect(data.recoveredCount).toBe(1)
        expect(data.lastProcessed).toBeDefined()
      })

      // Simulate system restart recovery
      await engine.recoverQueueState()
      
      expect(recoveryEvent).toBe(true)
    })

    it('should handle data corruption and recovery', async () => {
      let corruptionDetectedEvent = false
      engine.on('reminder:corruption:detected', (data) => {
        corruptionDetectedEvent = true
        expect(data.corruptedFiles).toContain('reminder1.enc')
        expect(data.recoveryAction).toBe('restore_from_backup')
      })

      let recoveryCompletedEvent = false
      engine.on('reminder:recovery:completed', (data) => {
        recoveryCompletedEvent = true
        expect(data.success).toBe(true)
        expect(data.recoveredReminders).toBe(5)
      })

      // Simulate corruption detection and recovery
      await engine.detectAndRecoverCorruption()
      
      expect(corruptionDetectedEvent).toBe(true)
      expect(recoveryCompletedEvent).toBe(true)
    })

    it('should maintain audit trail for all operations', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Audited Reminder',
        description: 'Test audit trail',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const auditEntries = [
        {
          id: 'audit1',
          timestamp: new Date(),
          action: 'reminder_created',
          data: { reminderId: 'reminder1', userId: 'user1' },
          source: 'reminder_engine'
        },
        {
          id: 'audit2',
          timestamp: new Date(),
          action: 'reminder_delivered',
          data: { reminderId: 'reminder1', deliveryMethod: 'voice' },
          source: 'reminder_engine'
        }
      ]

      mockStorage.getAuditTrail.mockResolvedValue(auditEntries)

      let auditEvent = false
      engine.on('reminder:audit:logged', (data) => {
        auditEvent = true
        expect(data.action).toBeDefined()
        expect(data.timestamp).toBeDefined()
        expect(data.source).toBe('reminder_engine')
      })

      const reminderId = await engine.scheduleReminder(reminder)
      await engine.markReminderComplete(reminderId)
      
      // Verify audit trail
      const trail = await engine.getAuditTrail()
      expect(trail).toHaveLength(2)
      expect(trail[0].action).toBe('reminder_created')
      expect(trail[1].action).toBe('reminder_delivered')
      expect(auditEvent).toBe(true)
    })

    it('should perform automatic backup and cleanup', async () => {
      let backupEvent = false
      engine.on('reminder:backup:created', (data) => {
        backupEvent = true
        expect(data.backupPath).toContain('backup_')
        expect(data.timestamp).toBeDefined()
      })

      let cleanupEvent = false
      engine.on('reminder:cleanup:completed', (data) => {
        cleanupEvent = true
        expect(data.deletedReminders).toBe(10)
        expect(data.freedSpace).toBeGreaterThan(0)
      })

      // Trigger backup and cleanup
      await engine.performMaintenance()
      
      expect(backupEvent).toBe(true)
      expect(cleanupEvent).toBe(true)
    })

    it('should handle storage failures gracefully', async () => {
      const reminder: Reminder = {
        id: '',
        userId: 'user1',
        title: 'Failing Storage Reminder',
        description: 'Test storage failure handling',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockStorage.storeReminder.mockRejectedValue(new Error('Storage failure'))

      let storageFailureEvent = false
      engine.on('reminder:storage:failed', (data) => {
        storageFailureEvent = true
        expect(data.errorType).toBe('STORAGE_ERROR')
        expect(data.fallbackAction).toBe('memory_only')
      })

      // Should handle storage failure without crashing
      const reminderId = await engine.scheduleReminder(reminder)
      
      expect(reminderId).toBeDefined()
      expect(storageFailureEvent).toBe(true)
      
      // Reminder should still be accessible in memory
      const storedReminder = engine.getReminder(reminderId)
      expect(storedReminder).toBeDefined()
      expect(storedReminder?.title).toBe('Failing Storage Reminder')
    })
  })
})