// BehaviorLearningEngine unit tests

import { BehaviorLearningEngine, LearningOutcome, LearningOutcomeType } from './behavior-learning'
import {
  UserContext,
  ActivityType,
  AvailabilityStatus,
  InterruptibilityLevel,
  LocationType,
  Reminder,
  ReminderType,
  CompletionStatus,
  ReminderFeedback,
  FeedbackType,
  ContextFeedback,
  ContextCorrection,
  PatternType
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'

describe('BehaviorLearningEngine', () => {
  let learningEngine: BehaviorLearningEngine
  
  beforeEach(() => {
    learningEngine = new BehaviorLearningEngine()
  })

  describe('learnFromContext', () => {
    it('should learn from positive context outcomes', async () => {
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

      const outcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'reminder_delivery',
        metadata: { successful: true }
      }

      let eventEmitted = false
      learningEngine.on('behavior:learned', (data) => {
        eventEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.outcome).toBe(LearningOutcomeType.POSITIVE)
        expect(data.confidence).toBe(0.8)
      })

      await learningEngine.learnFromContext('user1', context, outcome)
      
      expect(eventEmitted).toBe(true)
      
      const patterns = learningEngine.getUserPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].confidence).toBeGreaterThan(0)
    })

    it('should learn from negative context outcomes', async () => {
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

      const outcome: LearningOutcome = {
        type: LearningOutcomeType.NEGATIVE,
        confidence: 0.9,
        context: 'reminder_delivery',
        metadata: { interrupted_sleep: true }
      }

      await learningEngine.learnFromContext('user1', context, outcome)
      
      const strategy = learningEngine.getAdaptationStrategy('user1')
      expect(strategy).toBeDefined()
      expect(strategy!.avoidTimes).toContain(2) // Should avoid 2 AM
    })

    it('should emit error event on learning failure', async () => {
      const invalidContext = null as any
      const outcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'test'
      }

      let errorEmitted = false
      learningEngine.on('behavior:learning:error', (data) => {
        errorEmitted = true
        expect(data.userId).toBe('user1')
        expect(data.error).toBeDefined()
      })

      await learningEngine.learnFromContext('user1', invalidContext, outcome)
      expect(errorEmitted).toBe(true)
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

      await learningEngine.learnFromReminderFeedback('user1', reminder, feedback)
      
      const patterns = learningEngine.getUserPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
      
      const strategy = learningEngine.getAdaptationStrategy('user1')
      expect(strategy).toBeDefined()
      expect(strategy!.preferredTimes).toContain(feedback.feedbackTime.getHours())
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

      await learningEngine.learnFromReminderFeedback('user1', reminder, feedback)
      
      const strategy = learningEngine.getAdaptationStrategy('user1')
      expect(strategy).toBeDefined()
      expect(strategy!.avoidTimes).toContain(feedback.feedbackTime.getHours())
    })
  })

  describe('learnFromContextFeedback', () => {
    it('should learn from context prediction corrections', async () => {
      const actualContext: UserContext = {
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
      }

      const predictedContext: UserContext = {
        ...actualContext,
        currentActivity: ActivityType.RELAXING,
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.HIGH
      }

      const feedback: ContextFeedback = {
        userId: 'user1',
        contextTime: new Date(),
        actualContext,
        predictedContext,
        accuracy: 0.4,
        corrections: [
          {
            field: 'currentActivity',
            actualValue: ActivityType.WORKING,
            predictedValue: ActivityType.RELAXING,
            importance: 0.9
          },
          {
            field: 'availability',
            actualValue: AvailabilityStatus.BUSY,
            predictedValue: AvailabilityStatus.AVAILABLE,
            importance: 0.8
          }
        ]
      }

      // First create a positive pattern to update
      const positiveOutcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'initial_pattern'
      }
      await learningEngine.learnFromContext('user1', actualContext, positiveOutcome)
      
      // Now learn from the feedback
      await learningEngine.learnFromContextFeedback('user1', feedback)
      
      const patterns = learningEngine.getUserPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
      
      // Should have learned patterns from the context
      const workPattern = patterns.find(p => p.patternType === PatternType.WORK_HOURS)
      expect(workPattern).toBeDefined()
    })
  })

  describe('predictOptimalTiming', () => {
    it('should predict timing based on learned patterns', async () => {
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
      }

      // First, train the engine with some patterns
      const positiveOutcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.9,
        context: 'reminder_delivery',
        metadata: { preferredHour: 14 }
      }

      const afternoonContext = { ...context, timeOfDay: { ...context.timeOfDay, hour: 14 } }
      await learningEngine.learnFromContext('user1', afternoonContext, positiveOutcome)

      // Now predict timing
      const prediction = await learningEngine.predictOptimalTiming('user1', reminder, context)
      
      expect(prediction).toBeDefined()
      expect(prediction.suggestedTime).toBeInstanceOf(Date)
      expect(prediction.confidence).toBeGreaterThan(0)
      expect(prediction.reasoning).toBeDefined()
      expect(typeof prediction.deferralRecommended).toBe('boolean')
    })

    it('should return default prediction when no patterns exist', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'newuser',
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
        userId: 'newuser',
        currentActivity: ActivityType.UNKNOWN,
        location: {
          name: 'Unknown',
          type: LocationType.OTHER,
          confidence: 0.1
        },
        availability: AvailabilityStatus.AVAILABLE,
        interruptibility: InterruptibilityLevel.MEDIUM,
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
      }

      const prediction = await learningEngine.predictOptimalTiming('newuser', reminder, context)
      
      expect(prediction).toBeDefined()
      expect(prediction.confidence).toBeLessThan(0.5) // Low confidence for default
      expect(prediction.reasoning).toContain('Default')
    })
  })

  describe('getUserPatterns', () => {
    it('should return empty array for new user', () => {
      const patterns = learningEngine.getUserPatterns('newuser')
      expect(patterns).toEqual([])
    })

    it('should return patterns after learning', async () => {
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

      const outcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'test'
      }

      await learningEngine.learnFromContext('user1', context, outcome)
      
      const patterns = learningEngine.getUserPatterns('user1')
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].confidence).toBeGreaterThan(0)
      expect(patterns[0].patternType).toBeDefined()
    })
  })

  describe('getAdaptationStrategy', () => {
    it('should return undefined for new user', () => {
      const strategy = learningEngine.getAdaptationStrategy('newuser')
      expect(strategy).toBeUndefined()
    })

    it('should return strategy after learning', async () => {
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

      const outcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'test'
      }

      await learningEngine.learnFromContext('user1', context, outcome)
      
      const strategy = learningEngine.getAdaptationStrategy('user1')
      expect(strategy).toBeDefined()
      expect(strategy!.preferredTimes).toBeDefined()
      expect(strategy!.avoidTimes).toBeDefined()
      expect(strategy!.interruptibilityThreshold).toBeDefined()
    })
  })

  describe('getLearningStats', () => {
    it('should return empty stats for new user', () => {
      const stats = learningEngine.getLearningStats('newuser')
      
      expect(stats.totalPatterns).toBe(0)
      expect(stats.totalSessions).toBe(0)
      expect(stats.averageConfidence).toBe(0)
      expect(stats.lastLearningTime).toBeNull()
      expect(stats.recentAccuracy).toBe(0)
    })

    it('should return accurate stats after learning', async () => {
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

      const outcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'test'
      }

      await learningEngine.learnFromContext('user1', context, outcome)
      
      const stats = learningEngine.getLearningStats('user1')
      
      expect(stats.totalPatterns).toBeGreaterThan(0)
      expect(stats.totalSessions).toBeGreaterThan(0)
      expect(stats.averageConfidence).toBeGreaterThan(0)
      expect(stats.lastLearningTime).toBeInstanceOf(Date)
      expect(stats.patternsByType).toBeDefined()
    })
  })

  describe('pattern management', () => {
    it('should limit number of patterns per user', async () => {
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

      // Create many learning sessions
      for (let i = 0; i < 150; i++) {
        const outcome: LearningOutcome = {
          type: LearningOutcomeType.POSITIVE,
          confidence: 0.8,
          context: `test_${i}`,
          metadata: { hour: (i % 24) }
        }

        const contextVariation = {
          ...context,
          timeOfDay: { ...context.timeOfDay, hour: i % 24 }
        }

        await learningEngine.learnFromContext('user1', contextVariation, outcome)
      }
      
      const patterns = learningEngine.getUserPatterns('user1')
      expect(patterns.length).toBeLessThanOrEqual(100) // Should be limited
    })

    it('should remove low-confidence patterns', async () => {
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

      // Create a positive pattern first
      const positiveOutcome: LearningOutcome = {
        type: LearningOutcomeType.POSITIVE,
        confidence: 0.8,
        context: 'test'
      }
      await learningEngine.learnFromContext('user1', context, positiveOutcome)

      // Then create many negative outcomes to reduce confidence
      for (let i = 0; i < 10; i++) {
        const negativeOutcome: LearningOutcome = {
          type: LearningOutcomeType.NEGATIVE,
          confidence: 0.9,
          context: 'test'
        }
        await learningEngine.learnFromContext('user1', context, negativeOutcome)
      }
      
      const patterns = learningEngine.getUserPatterns('user1')
      // Low confidence patterns should be filtered out
      patterns.forEach(pattern => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0.6)
      })
    })
  })
})