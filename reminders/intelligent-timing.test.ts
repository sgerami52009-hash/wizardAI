// IntelligentTimingSystem unit tests

import { IntelligentTimingSystem } from './intelligent-timing'
import { ContextAnalyzer } from './context-analyzer'
import {
  Reminder,
  ReminderType,
  CompletionStatus,
  ReminderFeedback,
  FeedbackType,
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationType
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'

describe('IntelligentTimingSystem', () => {
  let timingSystem: IntelligentTimingSystem
  let mockContextAnalyzer: jest.Mocked<ContextAnalyzer>
  
  beforeEach(() => {
    mockContextAnalyzer = {
      analyzeUserContext: jest.fn(),
      shouldDeferReminder: jest.fn(),
      predictOptimalReminderTime: jest.fn(),
      batchReminders: jest.fn(),
      learnFromUserFeedback: jest.fn(),
      getBehaviorPatterns: jest.fn()
    } as any
    
    timingSystem = new IntelligentTimingSystem(mockContextAnalyzer)
  })

  describe('optimizeReminderTiming', () => {
    it('should optimize timing for immediate delivery when context is good', async () => {
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

      const mockContext: UserContext = {
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

      mockContextAnalyzer.analyzeUserContext.mockResolvedValue(mockContext)
      mockContextAnalyzer.shouldDeferReminder.mockResolvedValue({
        shouldDefer: false,
        reason: 'User context is suitable',
        confidence: 0.8
      })

      const result = await timingSystem.optimizeReminderTiming(reminder)
      
      expect(result.originalTime).toEqual(reminder.triggerTime)
      expect(result.deferralDecision.shouldDefer).toBe(false)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.reasoning).toContain('Immediate delivery')
    })

    it('should defer timing when context is poor', async () => {
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

      const mockContext: UserContext = {
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

      const deferUntil = new Date(Date.now() + 6 * 60 * 60 * 1000) // 6 hours later

      mockContextAnalyzer.analyzeUserContext.mockResolvedValue(mockContext)
      mockContextAnalyzer.shouldDeferReminder.mockResolvedValue({
        shouldDefer: true,
        deferUntil,
        reason: 'User is sleeping',
        confidence: 0.9
      })
      mockContextAnalyzer.predictOptimalReminderTime.mockResolvedValue(deferUntil)

      const result = await timingSystem.optimizeReminderTiming(reminder)
      
      expect(result.deferralDecision.shouldDefer).toBe(true)
      expect(result.optimizedTime.getTime()).toBeGreaterThan(new Date().getTime())
      expect(result.reasoning).toContain('Deferred')
    })

    it('should handle errors gracefully', async () => {
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

      mockContextAnalyzer.analyzeUserContext.mockRejectedValue(new Error('Context analysis failed'))

      const result = await timingSystem.optimizeReminderTiming(reminder)
      
      expect(result.originalTime).toEqual(reminder.triggerTime)
      expect(result.optimizedTime).toEqual(reminder.triggerTime)
      expect(result.confidence).toBeLessThan(0.5)
      expect(result.reasoning).toContain('error')
    })
  })

  describe('optimizeReminderBatching', () => {
    it('should batch reminders intelligently', async () => {
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

      const mockContext: UserContext = {
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

      const mockBatches = [
        {
          id: 'batch1',
          reminders: [reminders[0]], // High priority first
          batchTime: new Date(),
          deliveryMethod: NotificationMethod.VOICE,
          priority: Priority.HIGH,
          estimatedDeliveryTime: new Date()
        },
        {
          id: 'batch2',
          reminders: [reminders[1]],
          batchTime: new Date(),
          deliveryMethod: NotificationMethod.VOICE,
          priority: Priority.LOW,
          estimatedDeliveryTime: new Date()
        }
      ]

      mockContextAnalyzer.analyzeUserContext.mockResolvedValue(mockContext)
      mockContextAnalyzer.batchReminders.mockResolvedValue(mockBatches)

      const result = await timingSystem.optimizeReminderBatching(reminders, 'user1')
      
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].priority).toBe(Priority.HIGH) // High priority should be first
    })

    it('should return empty array for no reminders', async () => {
      const result = await timingSystem.optimizeReminderBatching([], 'user1')
      expect(result).toEqual([])
    })
  })

  describe('adaptReminderStrategy', () => {
    it('should adapt strategy based on positive feedback', async () => {
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 5,
        wasHelpful: true,
        comment: 'Perfect timing!'
      }

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

      let eventEmitted = false
      timingSystem.on('reminder:strategy:adapted', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.feedback).toEqual(feedback)
      })

      await timingSystem.adaptReminderStrategy('user1', feedback, reminder)
      
      expect(eventEmitted).toBe(true)
      
      const strategy = timingSystem.getUserStrategy('user1')
      expect(strategy.confidence).toBeGreaterThan(0.7) // Should increase confidence
    })

    it('should adapt strategy based on negative feedback', async () => {
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 1,
        wasHelpful: false,
        comment: 'Terrible timing'
      }

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

      const originalStrategy = timingSystem.getUserStrategy('user1')
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))
      
      await timingSystem.adaptReminderStrategy('user1', feedback, reminder)
      
      const adaptedStrategy = timingSystem.getUserStrategy('user1')
      expect(adaptedStrategy.lastUpdated.getTime()).toBeGreaterThanOrEqual(originalStrategy.lastUpdated.getTime())
      
      const adaptations = timingSystem.getAdaptationHistory('user1')
      expect(adaptations.length).toBe(1)
      expect(adaptations[0].wasHelpful).toBe(false)
    })

    it('should adapt batching preferences based on frequency feedback', async () => {
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.FREQUENCY,
        rating: 2,
        wasHelpful: false,
        comment: 'too many reminders at once'
      }

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

      const originalStrategy = timingSystem.getUserStrategy('user1')
      const originalBatchSize = originalStrategy.batchingPreferences.maxBatchSize
      
      await timingSystem.adaptReminderStrategy('user1', feedback, reminder)
      
      const adaptedStrategy = timingSystem.getUserStrategy('user1')
      expect(adaptedStrategy.batchingPreferences.maxBatchSize).toBeLessThan(originalBatchSize)
    })
  })

  describe('getUserStrategy', () => {
    it('should return default strategy for new user', () => {
      const strategy = timingSystem.getUserStrategy('newuser')
      
      expect(strategy.userId).toBe('newuser')
      expect(strategy.name).toBe('Default Strategy')
      expect(strategy.timingPreferences.preferredHours).toContain(8)
      expect(strategy.timingPreferences.preferredHours).toContain(17)
      expect(strategy.confidence).toBe(0.7)
    })

    it('should return existing strategy for known user', () => {
      const customStrategy = {
        userId: 'user1',
        name: 'Custom Strategy',
        timingPreferences: {
          preferredHours: [9, 13, 18],
          avoidHours: [0, 1, 2, 3, 4, 5, 6, 22, 23],
          weekendAdjustment: 120
        },
        priorityHandling: {
          allowHighPriorityInterruption: false,
          highPriorityAdvanceMinutes: 5,
          lowPriorityDelayMinutes: 60
        },
        contextAdjustments: {},
        batchingPreferences: {
          maxBatchSize: 2,
          prioritizeByType: false,
          typePreferences: {}
        },
        deliveryPreferences: {
          methodPenalties: {},
          preferredMethods: ['visual']
        },
        confidence: 0.9,
        createdAt: new Date(),
        lastUpdated: new Date()
      }

      timingSystem.updateUserStrategy('user1', customStrategy)
      
      const retrievedStrategy = timingSystem.getUserStrategy('user1')
      expect(retrievedStrategy.name).toBe('Custom Strategy')
      expect(retrievedStrategy.confidence).toBe(0.9)
    })
  })

  describe('updateUserStrategy', () => {
    it('should update user strategy with new preferences', () => {
      let eventEmitted = false
      timingSystem.on('reminder:strategy:updated', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.updates.name).toBe('Updated Strategy')
      })

      timingSystem.updateUserStrategy('user1', {
        name: 'Updated Strategy',
        confidence: 0.95
      })
      
      const strategy = timingSystem.getUserStrategy('user1')
      expect(strategy.name).toBe('Updated Strategy')
      expect(strategy.confidence).toBe(0.95)
      expect(eventEmitted).toBe(true)
    })
  })

  describe('analyzeUserBehaviorPatterns', () => {
    it('should analyze user behavior and provide recommendations', async () => {
      mockContextAnalyzer.getBehaviorPatterns.mockReturnValue([
        {
          patternType: 'work_hours' as any,
          frequency: 5,
          confidence: 0.9,
          lastObserved: new Date(),
          metadata: { startHour: 9, endHour: 17 }
        }
      ])

      // Add some adaptation history
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 4,
        wasHelpful: true
      }

      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test',
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

      await timingSystem.adaptReminderStrategy('user1', feedback, reminder)

      const analysis = await timingSystem.analyzeUserBehaviorPatterns('user1')
      
      expect(analysis.userId).toBe('user1')
      expect(analysis.patterns.length).toBe(1)
      expect(analysis.adaptationCount).toBe(1)
      expect(analysis.strategyEffectiveness).toBeGreaterThan(0.5)
      expect(analysis.recommendations).toBeDefined()
      expect(analysis.lastAnalyzed).toBeInstanceOf(Date)
    })
  })

  describe('getAdaptationHistory', () => {
    it('should return empty array for user with no adaptations', () => {
      const history = timingSystem.getAdaptationHistory('newuser')
      expect(history).toEqual([])
    })

    it('should return adaptation history after adaptations', async () => {
      const feedback: ReminderFeedback = {
        feedbackTime: new Date(),
        feedbackType: FeedbackType.TIMING,
        rating: 3,
        wasHelpful: true
      }

      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test',
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

      await timingSystem.adaptReminderStrategy('user1', feedback, reminder)
      
      const history = timingSystem.getAdaptationHistory('user1')
      expect(history.length).toBe(1)
      expect(history[0].feedbackType).toBe(FeedbackType.TIMING)
      expect(history[0].wasHelpful).toBe(true)
    })
  })
})