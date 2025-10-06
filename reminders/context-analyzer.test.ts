// ContextAnalyzer unit tests

import { ContextAnalyzer } from './context-analyzer'
import {
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationType,
  Reminder,
  ReminderType,
  CompletionStatus,
  ContextFeedback,
  ContextCorrection,
  ReminderFeedback,
  FeedbackType
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'

describe('ContextAnalyzer', () => {
  let analyzer: ContextAnalyzer
  
  beforeEach(() => {
    analyzer = new ContextAnalyzer()
  })

  describe('analyzeUserContext', () => {
    it('should analyze user context successfully', async () => {
      const context = await analyzer.analyzeUserContext('user1')
      
      expect(context).toBeDefined()
      expect(context.userId).toBe('user1')
      expect(context.currentActivity).toBeDefined()
      expect(context.location).toBeDefined()
      expect(context.availability).toBeDefined()
      expect(context.interruptibility).toBeDefined()
      expect(context.deviceProximity).toBeDefined()
      expect(context.timeOfDay).toBeDefined()
      expect(context.lastUpdated).toBeInstanceOf(Date)
    })

    it('should emit context analyzed event', async () => {
      let eventEmitted = false
      analyzer.on('reminder:context:analyzed', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.confidence).toBeGreaterThan(0)
        expect(data.analysisTime).toBeGreaterThan(0)
      })

      await analyzer.analyzeUserContext('user1')
      expect(eventEmitted).toBe(true)
    })

    it('should cache context for performance', async () => {
      const context1 = await analyzer.analyzeUserContext('user1')
      const context2 = await analyzer.analyzeUserContext('user1')
      
      // Should return same cached context
      expect(context1.lastUpdated.getTime()).toBe(context2.lastUpdated.getTime())
    })
  })

  describe('predictOptimalReminderTime', () => {
    it('should return current time for optimal context', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const optimalContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.RELAXING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const optimalTime = await analyzer.predictOptimalReminderTime(reminder, optimalContext)
      const now = new Date()
      
      // Should be very close to current time (within 1 minute)
      expect(Math.abs(optimalTime.getTime() - now.getTime())).toBeLessThan(60000)
    })

    it('should defer for suboptimal context', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.LOW,
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

      const suboptimalContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.SLEEPING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.DO_NOT_DISTURB,
        interruptibility: InterruptibilityLevel.NONE,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 2, // 2 AM
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const optimalTime = await analyzer.predictOptimalReminderTime(reminder, suboptimalContext)
      const now = new Date()
      
      // Should be deferred to later
      expect(optimalTime.getTime()).toBeGreaterThan(now.getTime())
    })
  })

  describe('shouldDeferReminder', () => {
    it('should not defer for good context', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const goodContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.RELAXING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const decision = await analyzer.shouldDeferReminder(reminder, goodContext)
      
      expect(decision.shouldDefer).toBe(false)
      expect(decision.reason).toContain('suitable')
      expect(decision.confidence).toBeGreaterThan(0)
    })

    it('should defer for bad context', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.LOW,
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

      const badContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.SLEEPING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.DO_NOT_DISTURB,
        interruptibility: InterruptibilityLevel.NONE,
        deviceProximity: {
          isNearby: false,
          distance: 10,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 2,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const decision = await analyzer.shouldDeferReminder(reminder, badContext)
      
      expect(decision.shouldDefer).toBe(true)
      expect(decision.deferUntil).toBeDefined()
      expect(decision.deferUntil!.getTime()).toBeGreaterThan(new Date().getTime())
      expect(decision.reason).toBeDefined()
      expect(decision.confidence).toBeGreaterThan(0.5)
    })

    it('should provide alternative delivery methods when deferring', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.LOW,
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

      const workContext: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.WORKING,
        location: {
          name: 'Work',
          type: LocationType.WORK,
          confidence: 0.9
        },
        availability: AvailabilityStatus.BUSY,
        interruptibility: InterruptibilityLevel.LOW,
        deviceProximity: {
          isNearby: false,
          distance: 100,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 10,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const decision = await analyzer.shouldDeferReminder(reminder, workContext)
      
      if (decision.shouldDefer && decision.alternativeDeliveryMethods) {
        expect(decision.alternativeDeliveryMethods.length).toBeGreaterThan(0)
      }
    })
  })

  describe('batchReminders', () => {
    it('should batch reminders by priority and timing', async () => {
      const reminders: Reminder[] = [
        {
          id: 'test1',
          userId: 'user1',
          title: 'High Priority Reminder',
          description: 'Test',
          type: ReminderType.TIME_BASED,
          triggerTime: new Date(),
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
          id: 'test2',
          userId: 'user1',
          title: 'Low Priority Reminder',
          description: 'Test',
          type: ReminderType.TIME_BASED,
          triggerTime: new Date(),
          priority: Priority.LOW,
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

      const context: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.RELAXING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const batches = await analyzer.batchReminders(reminders, context)
      
      expect(batches.length).toBeGreaterThan(0)
      expect(batches[0].reminders.length).toBeGreaterThan(0)
      expect(batches[0].priority).toBeDefined()
      expect(batches[0].deliveryMethod).toBeDefined()
      
      // High priority should come first
      expect(batches[0].reminders[0].priority).toBe(Priority.HIGH)
    })

    it('should return empty array for no reminders', async () => {
      const context: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.RELAXING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const batches = await analyzer.batchReminders([], context)
      expect(batches).toEqual([])
    })
  })

  describe('learnFromUserFeedback', () => {
    it('should learn from user feedback', async () => {
      const feedback: ContextFeedback = {
        userId: 'user1',
        contextTime: new Date(),
        actualContext: {
          userId: 'user1',
          currentActivity: ActivityType.WORKING,
          location: {
            name: 'Home',
            type: LocationType.HOME,
            confidence: 0.9
          },
          availability: AvailabilityStatus.BUSY,
          interruptibility: InterruptibilityLevel.LOW,
          deviceProximity: {
            isNearby: true,
            distance: 1,
            lastSeen: new Date(),
            deviceType: 'home_assistant'
          },
          timeOfDay: {
            hour: 10,
            dayOfWeek: 3,
            isWeekend: false,
            isHoliday: false,
            timeZone: 'UTC'
          },
          historicalPatterns: [],
          lastUpdated: new Date()
        },
        predictedContext: {
          userId: 'user1',
          currentActivity: ActivityType.RELAXING,
          location: {
            name: 'Home',
            type: LocationType.HOME,
            confidence: 0.9
          },
          availability: AvailabilityStatus.AVAILABLE,
          interruptibility: InterruptibilityLevel.HIGH,
          deviceProximity: {
            isNearby: true,
            distance: 1,
            lastSeen: new Date(),
            deviceType: 'home_assistant'
          },
          timeOfDay: {
            hour: 10,
            dayOfWeek: 3,
            isWeekend: false,
            isHoliday: false,
            timeZone: 'UTC'
          },
          historicalPatterns: [],
          lastUpdated: new Date()
        },
        accuracy: 0.5,
        corrections: [
          {
            field: 'currentActivity',
            actualValue: ActivityType.WORKING,
            predictedValue: ActivityType.RELAXING,
            importance: 0.8
          }
        ]
      }

      let eventEmitted = false
      analyzer.on('reminder:context:learned', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.accuracy).toBe(0.5)
        expect(data.corrections).toBe(1)
      })

      await analyzer.learnFromUserFeedback('user1', feedback)
      expect(eventEmitted).toBe(true)
      
      // Check that patterns were updated
      const patterns = analyzer.getBehaviorPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
    })
  })

  describe('learnFromReminderFeedback', () => {
    it('should learn from positive reminder feedback', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 5,
        comment: 'Perfect timing!',
        wasHelpful: true
      }

      let eventEmitted = false
      analyzer.on('reminder:feedback:learned', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.reminderId).toBe('test1')
        expect(data.wasHelpful).toBe(true)
      })

      await analyzer.learnFromReminderFeedback('user1', reminder, feedback)
      expect(eventEmitted).toBe(true)
    })

    it('should learn from negative reminder feedback', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 1,
        comment: 'Terrible timing',
        wasHelpful: false
      }

      let eventEmitted = false
      analyzer.on('reminder:feedback:learned', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.wasHelpful).toBe(false)
      })

      await analyzer.learnFromReminderFeedback('user1', reminder, feedback)
      expect(eventEmitted).toBe(true)
    })
  })

  describe('predictOptimalReminderTimeEnhanced', () => {
    it('should use enhanced prediction when available', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const context: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.RELAXING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 14,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const enhancedTime = await analyzer.predictOptimalReminderTimeEnhanced(reminder, context)
      const originalTime = await analyzer.predictOptimalReminderTime(reminder, context)
      
      expect(enhancedTime).toBeInstanceOf(Date)
      // Enhanced prediction should be available (may be same as original for new users)
      expect(enhancedTime.getTime()).toBeGreaterThanOrEqual(originalTime.getTime() - 60000)
    })

    it('should fallback to original prediction on error', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
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

      const context: UserContext = {
        userId: 'user1',
        currentActivity: ActivityType.SLEEPING,
        location: {
          name: 'Home',
          type: LocationType.HOME,
          confidence: 0.9
        },
        availability: AvailabilityStatus.DO_NOT_DISTURB,
        interruptibility: InterruptibilityLevel.NONE,
        deviceProximity: {
          isNearby: true,
          distance: 1,
          lastSeen: new Date(),
          deviceType: 'home_assistant'
        },
        timeOfDay: {
          hour: 2,
          dayOfWeek: 3,
          isWeekend: false,
          isHoliday: false,
          timeZone: 'UTC'
        },
        historicalPatterns: [],
        lastUpdated: new Date()
      }

      const enhancedTime = await analyzer.predictOptimalReminderTimeEnhanced(reminder, context)
      
      expect(enhancedTime).toBeInstanceOf(Date)
      expect(enhancedTime.getTime()).toBeGreaterThan(new Date().getTime())
    })
  })

  describe('getUserLearningStats', () => {
    it('should return learning statistics', () => {
      const stats = analyzer.getUserLearningStats('user1')
      
      expect(stats).toBeDefined()
      expect(typeof stats.totalPatterns).toBe('number')
      expect(typeof stats.totalSessions).toBe('number')
      expect(typeof stats.averageConfidence).toBe('number')
    })
  })

  describe('getUserAdaptationStrategy', () => {
    it('should return adaptation strategy', () => {
      const strategy = analyzer.getUserAdaptationStrategy('user1')
      
      // May be undefined for new users
      if (strategy) {
        expect(strategy.preferredTimes).toBeDefined()
        expect(strategy.avoidTimes).toBeDefined()
        expect(strategy.interruptibilityThreshold).toBeDefined()
      }
    })
  })

  describe('updateContextModel', () => {
    it('should update context with new data', async () => {
      // First analyze context to create initial context
      const initialContext = await analyzer.analyzeUserContext('user1')
      
      let eventEmitted = false
      analyzer.on('reminder:context:changed', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.changeType).toBeDefined()
      })

      // Update with different activity than initial
      const newActivity = initialContext.currentActivity === ActivityType.WORKING 
        ? ActivityType.RELAXING 
        : ActivityType.WORKING
      
      await analyzer.updateContextModel('user1', {
        currentActivity: newActivity
      })

      const updatedContext = analyzer.getCurrentContext('user1')
      expect(updatedContext.currentActivity).toBe(newActivity)
      expect(eventEmitted).toBe(true)
    })

    it('should not emit event for insignificant changes', async () => {
      await analyzer.analyzeUserContext('user1')
      
      let eventEmitted = false
      analyzer.on('reminder:context:changed', () => {
        eventEmitted = true
      })

      // Update with same data
      await analyzer.updateContextModel('user1', {
        lastUpdated: new Date()
      })

      expect(eventEmitted).toBe(false)
    })
  })

  describe('getCurrentContext', () => {
    it('should return cached context if available', async () => {
      const analyzedContext = await analyzer.analyzeUserContext('user1')
      const currentContext = analyzer.getCurrentContext('user1')
      
      expect(currentContext.userId).toBe(analyzedContext.userId)
      expect(currentContext.lastUpdated.getTime()).toBe(analyzedContext.lastUpdated.getTime())
    })

    it('should return default context if no cached context', () => {
      const defaultContext = analyzer.getCurrentContext('newuser')
      
      expect(defaultContext.userId).toBe('newuser')
      expect(defaultContext.currentActivity).toBe(ActivityType.UNKNOWN)
      expect(defaultContext.availability).toBe(AvailabilityStatus.AVAILABLE)
    })
  })

  describe('getBehaviorPatterns', () => {
    it('should return empty array for user with no patterns', () => {
      const patterns = analyzer.getBehaviorPatterns('newuser')
      expect(patterns).toEqual([])
    })

    it('should return patterns after learning', async () => {
      const feedback: ContextFeedback = {
        userId: 'user1',
        contextTime: new Date(),
        actualContext: analyzer.getCurrentContext('user1'),
        predictedContext: analyzer.getCurrentContext('user1'),
        accuracy: 0.8,
        corrections: []
      }

      await analyzer.learnFromUserFeedback('user1', feedback)
      
      const patterns = analyzer.getBehaviorPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
    })
  })
})