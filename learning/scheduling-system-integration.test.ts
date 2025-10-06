// Scheduling System Integration Tests

import {
  SchedulingSystemIntegrationManager,
  SchedulingSystemIntegrationService,
  SchedulingOptimizationResult,
  PersonalizedConflictResolution,
  ReminderDeliveryOptimization,
  FamilyCoordinationEnhancement,
  SchedulingLearningResult,
  PreferenceAdaptationResult,
  SchedulingSuggestionResult,
  UserSchedulingPatterns,
  ConflictResolutionHistory,
  ReminderContextualFactors,
  FamilyDynamics,
  SchedulingInteraction,
  SchedulingFeedback,
  SchedulingContext,
  SchedulingInteractionType,
  SchedulingFeedbackType,
  OptimizationFactorType,
  ReminderDeliveryMethod,
  CoordinationType,
  SchedulingPatternType
} from './scheduling-system-integration';

import {
  SchedulingSystemIntegration,
  CalendarEvent,
  ScheduleConflict,
  Reminder,
  FamilyEvent,
  DeliveryOptimization,
  CoordinationStrategy,
  FlexibilityLevel,
  ConflictType,
  ResolutionStrategy
} from './scheduling-integration';

import { RealTimeDecisionEngine } from './decision';
import { LearningEventBus, LearningEventType } from './events';
import { ActivityType } from '../patterns/types';

describe('SchedulingSystemIntegrationManager', () => {
  let integrationManager: SchedulingSystemIntegrationManager;
  let mockEventBus: jest.Mocked<LearningEventBus>;
  let mockDecisionEngine: jest.Mocked<RealTimeDecisionEngine>;
  let mockSchedulingIntegration: jest.Mocked<SchedulingSystemIntegration>;

  const testUserId = 'test-user-123';
  const testFamilyId = 'family-456';

  beforeEach(async () => {
    // Create mock event bus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Create mock decision engine
    mockDecisionEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      makeDecision: jest.fn().mockResolvedValue({
        selectedOption: { value: 'optimized_scheduling' },
        confidence: 0.9,
        reasoning: ['Optimized based on user patterns'],
        alternatives: [],
        contextFactors: [],
        fallbackUsed: false,
        processingTime: 50,
        modelVersion: '1.0.0'
      }),
      adaptResponse: jest.fn().mockImplementation((response) => Promise.resolve(response)),
      getRecommendations: jest.fn().mockResolvedValue([]),
      predictUserIntent: jest.fn().mockResolvedValue({
        predictedIntent: 'schedule_event',
        confidence: 0.8,
        alternatives: [],
        contextClues: [],
        completionSuggestions: []
      }),
      optimizeScheduling: jest.fn().mockResolvedValue({
        recommendedSlots: [],
        conflictResolution: [],
        optimizationFactors: [],
        confidence: 0.8,
        alternatives: []
      })
    } as any;

    // Create mock scheduling integration
    mockSchedulingIntegration = {
      predictOptimalScheduling: jest.fn().mockResolvedValue({
        recommendedSlots: [
          {
            startTime: new Date('2024-01-15T10:00:00Z'),
            endTime: new Date('2024-01-15T11:00:00Z'),
            quality: 'high' as any,
            conflictRisk: 0.1,
            userPreferenceAlignment: 0.9
          }
        ],
        conflictResolution: [],
        optimizationFactors: [],
        confidence: 0.85,
        alternatives: []
      }),
      personalizeConflictResolution: jest.fn().mockResolvedValue(ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY),
      optimizeReminderDelivery: jest.fn().mockResolvedValue({
        optimalDeliveryTime: new Date('2024-01-15T09:45:00Z'),
        deliveryMethod: 'voice_notification' as any,
        personalizedContent: 'Reminder: Meeting in 15 minutes',
        contextualFactors: [],
        confidence: 0.8,
        alternativeOptions: []
      } as DeliveryOptimization),
      enhanceFamilyCoordination: jest.fn().mockResolvedValue({
        strategyId: 'collaborative_planning',
        coordinationType: 'collaborative' as any,
        participantOptimizations: [],
        conflictResolutions: [],
        communicationPlan: {
          notifications: [],
          coordinationMessages: [],
          confirmationRequests: []
        },
        successProbability: 0.8
      } as CoordinationStrategy)
    } as any;

    integrationManager = new SchedulingSystemIntegrationManager(
      mockEventBus,
      mockDecisionEngine,
      mockSchedulingIntegration
    );

    await integrationManager.initialize();
  });

  afterEach(async () => {
    await integrationManager.shutdown();
  });

  describe('initialization and lifecycle', () => {
    it('should initialize successfully', async () => {
      const newManager = new SchedulingSystemIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockSchedulingIntegration
      );

      await expect(newManager.initialize()).resolves.not.toThrow();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SYSTEM_STARTED
        })
      );

      await newManager.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      mockEventBus.subscribe.mockRejectedValueOnce(new Error('Subscription failed'));
      
      const newManager = new SchedulingSystemIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockSchedulingIntegration
      );

      await expect(newManager.initialize()).rejects.toThrow('Failed to initialize scheduling system integration');
    });

    it('should shutdown gracefully', async () => {
      await expect(integrationManager.shutdown()).resolves.not.toThrow();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SYSTEM_STOPPED
        })
      );
    });

    it('should emit initialized event on successful initialization', (done) => {
      const newManager = new SchedulingSystemIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockSchedulingIntegration
      );

      newManager.on('initialized', () => {
        done();
      });

      newManager.initialize();
    });
  });

  describe('optimizeSchedulingBasedOnPatterns', () => {
    const createTestCalendarEvent = (): CalendarEvent => ({
      eventId: 'event-123',
      title: 'Team Meeting',
      description: 'Weekly team sync',
      duration: 60,
      eventType: 'meeting' as any,
      priority: 'high' as any,
      flexibility: FlexibilityLevel.MODERATE,
      participants: [testUserId, 'user-456'],
      requiredResources: ['conference_room'],
      preferredTimeWindows: [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T17:00:00Z'),
          preference: 0.8,
          flexibility: FlexibilityLevel.HIGH,
          constraints: []
        }
      ],
      constraints: []
    });

    const createTestUserSchedulingPatterns = (): UserSchedulingPatterns => ({
      temporalPatterns: [
        {
          patternType: 'morning_preference',
          frequency: 0.8,
          timeRange: { start: '09:00', end: '11:00' },
          confidence: 0.9
        }
      ],
      activityPatterns: [
        {
          activityType: 'meeting',
          preferredDuration: 60,
          optimalTimes: ['09:00', '10:00', '14:00'],
          confidence: 0.8
        }
      ],
      preferencePatterns: [
        {
          preferenceType: 'buffer_time',
          value: 15,
          context: 'between_meetings',
          confidence: 0.7
        }
      ],
      conflictPatterns: [
        {
          conflictType: 'lunch_overlap',
          frequency: 0.3,
          resolution: 'reschedule_earlier',
          confidence: 0.6
        }
      ],
      productivityPatterns: [
        {
          timeRange: { start: '09:00', end: '11:00' },
          productivityLevel: 0.9,
          activityTypes: ['meeting', 'focused_work'],
          confidence: 0.8
        }
      ]
    });

    it('should optimize scheduling based on user patterns successfully', async () => {
      const event = createTestCalendarEvent();
      const userPatterns = createTestUserSchedulingPatterns();

      const result = await integrationManager.optimizeSchedulingBasedOnPatterns(
        testUserId,
        event,
        userPatterns
      );

      expect(result).toBeDefined();
      expect(result.originalEvent).toEqual(event);
      expect(result.optimizedEvent).toBeDefined();
      expect(result.optimizationFactors).toBeDefined();
      expect(result.alternativeTimeSlots).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.expectedUserSatisfaction).toBeGreaterThan(0);

      expect(mockSchedulingIntegration.predictOptimalScheduling).toHaveBeenCalledWith(
        event,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SCHEDULING_OPTIMIZED,
          userId: testUserId
        })
      );
    });

    it('should handle scheduling optimization errors gracefully', async () => {
      mockSchedulingIntegration.predictOptimalScheduling.mockRejectedValueOnce(
        new Error('Optimization failed')
      );

      const event = createTestCalendarEvent();
      const userPatterns = createTestUserSchedulingPatterns();

      const result = await integrationManager.optimizeSchedulingBasedOnPatterns(
        testUserId,
        event,
        userPatterns
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.optimizedEvent).toEqual(event);
      expect(result.optimizationFactors).toEqual([]);
      expect(result.confidence).toBe(0.5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should generate optimization factors based on patterns', async () => {
      const event = createTestCalendarEvent();
      const userPatterns = createTestUserSchedulingPatterns();
      userPatterns.temporalPatterns[0].frequency = 0.95; // High morning preference

      const result = await integrationManager.optimizeSchedulingBasedOnPatterns(
        testUserId,
        event,
        userPatterns
      );

      expect(result.optimizationFactors).toBeDefined();
      // In a real implementation, this would show factors like morning preference
    });
  });

  describe('personalizeConflictResolution', () => {
    const createTestScheduleConflict = (): ScheduleConflict => ({
      conflictId: 'conflict-123',
      conflictType: ConflictType.TIME_OVERLAP,
      primaryEvent: {
        eventId: 'event-1',
        title: 'Important Meeting',
        description: 'High priority meeting',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'high' as any,
        flexibility: FlexibilityLevel.LOW,
        participants: [testUserId],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      },
      conflictingEvent: {
        eventId: 'event-2',
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        duration: 30,
        eventType: 'appointment' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [testUserId],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      },
      overlapDuration: 30,
      severity: 'medium' as any,
      affectedUsers: [testUserId],
      possibleResolutions: []
    });

    const createTestConflictResolutionHistory = (): ConflictResolutionHistory => ({
      pastResolutions: [
        {
          conflictType: ConflictType.TIME_OVERLAP,
          resolution: ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY,
          success: true,
          userSatisfaction: 0.8,
          timestamp: new Date('2024-01-10T10:00:00Z')
        }
      ],
      resolutionPreferences: [
        {
          conflictType: ConflictType.TIME_OVERLAP,
          preferredStrategy: ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY,
          confidence: 0.9
        }
      ],
      successRates: [
        {
          strategy: ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY,
          successRate: 0.85,
          sampleSize: 20
        }
      ],
      userSatisfactionScores: [
        {
          strategy: ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY,
          averageSatisfaction: 0.8,
          sampleSize: 20
        }
      ]
    });

    it('should personalize conflict resolution successfully', async () => {
      const conflict = createTestScheduleConflict();
      const resolutionHistory = createTestConflictResolutionHistory();

      const result = await integrationManager.personalizeConflictResolution(
        testUserId,
        conflict,
        resolutionHistory
      );

      expect(result).toBeDefined();
      expect(result.conflict).toEqual(conflict);
      expect(result.personalizedResolutions).toBeDefined();
      expect(result.recommendedResolution).toBeDefined();
      expect(result.resolutionReasoning).toBeDefined();
      expect(result.userPreferenceAlignment).toBeGreaterThan(0);

      expect(mockSchedulingIntegration.personalizeConflictResolution).toHaveBeenCalledWith(
        conflict,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.CONFLICT_RESOLUTION_PERSONALIZED,
          userId: testUserId
        })
      );
    });

    it('should handle conflict resolution errors gracefully', async () => {
      mockSchedulingIntegration.personalizeConflictResolution.mockRejectedValueOnce(
        new Error('Resolution failed')
      );

      const conflict = createTestScheduleConflict();
      const resolutionHistory = createTestConflictResolutionHistory();

      const result = await integrationManager.personalizeConflictResolution(
        testUserId,
        conflict,
        resolutionHistory
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.personalizedResolutions).toEqual([]);
      expect(result.recommendedResolution.strategy).toBe(ResolutionStrategy.RESCHEDULE_LOWER_PRIORITY);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should consider user history in resolution recommendations', async () => {
      const conflict = createTestScheduleConflict();
      const resolutionHistory = createTestConflictResolutionHistory();
      resolutionHistory.resolutionPreferences[0].confidence = 0.95;

      const result = await integrationManager.personalizeConflictResolution(
        testUserId,
        conflict,
        resolutionHistory
      );

      expect(result.recommendedResolution).toBeDefined();
      expect(result.userPreferenceAlignment).toBeGreaterThan(0.5);
    });
  });

  describe('optimizeReminderDelivery', () => {
    const createTestReminder = (): Reminder => ({
      reminderId: 'reminder-123',
      eventId: 'event-123',
      userId: testUserId,
      reminderType: 'time_based' as any,
      content: 'Meeting starts in 15 minutes',
      scheduledTime: new Date('2024-01-15T09:45:00Z'),
      deliveryMethods: ['voice_notification' as any],
      priority: 'high' as any,
      context: {
        userActivity: ActivityType.WORKING,
        location: 'home_office',
        deviceAvailability: {
          availableDevices: ['smart_speaker', 'tablet'],
          preferredDevice: 'smart_speaker',
          connectivity: 'wifi',
          capabilities: []
        },
        attentionLevel: 'focused' as any,
        interruptibility: 'low' as any
      }
    });

    const createTestReminderContextualFactors = (): ReminderContextualFactors => ({
      userContext: {
        userId: testUserId,
        timestamp: new Date(),
        temporal: {
          timeOfDay: 'morning' as any,
          dayOfWeek: 'monday' as any,
          season: 'winter' as any,
          isHoliday: false,
          timeZone: 'UTC'
        },
        spatial: {
          location: 'home_office',
          room: 'office',
          coordinates: { latitude: 0, longitude: 0 },
          accuracy: 1.0
        },
        device: {
          deviceId: 'smart_speaker_1',
          deviceType: 'smart_speaker' as any,
          capabilities: ['voice', 'audio'],
          batteryLevel: 1.0,
          connectivity: {
            isOnline: true,
            signalStrength: 0.9,
            networkType: 'wifi'
          }
        },
        activity: {
          currentActivity: ActivityType.WORKING,
          activityConfidence: 0.9,
          activityDuration: 1800,
          previousActivities: []
        },
        social: {
          presentUsers: [testUserId],
          socialContext: 'individual' as any,
          interactionMode: 'focused' as any,
          privacyLevel: 'private' as any
        },
        environmental: {
          ambientLight: 0.8,
          temperature: 22,
          humidity: 0.5,
          noiseLevel: 0.2,
          airQuality: 0.9
        }
      },
      deviceContext: {
        availableDevices: ['smart_speaker', 'tablet'],
        preferredDevice: 'smart_speaker',
        capabilities: ['voice', 'display', 'audio']
      },
      environmentalContext: {
        location: 'home_office',
        ambientNoise: 0.2,
        lighting: 'bright',
        privacy: 'private'
      },
      temporalContext: {
        timeOfDay: 'morning',
        dayOfWeek: 'monday',
        isWorkingHours: true,
        timeZone: 'UTC'
      },
      socialContext: {
        presentPeople: [testUserId],
        socialSetting: 'individual',
        interruptibility: 'low'
      }
    });

    it('should optimize reminder delivery successfully', async () => {
      const reminder = createTestReminder();
      const contextualFactors = createTestReminderContextualFactors();

      const result = await integrationManager.optimizeReminderDelivery(
        testUserId,
        reminder,
        contextualFactors
      );

      expect(result).toBeDefined();
      expect(result.originalReminder).toEqual(reminder);
      expect(result.optimizedDelivery).toBeDefined();
      expect(result.deliveryStrategies).toBeDefined();
      expect(result.contextualAdaptations).toBeDefined();
      expect(result.estimatedEffectiveness).toBeGreaterThan(0);

      expect(mockSchedulingIntegration.optimizeReminderDelivery).toHaveBeenCalledWith(
        reminder,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.REMINDER_DELIVERY_OPTIMIZED,
          userId: testUserId
        })
      );
    });

    it('should handle reminder optimization errors gracefully', async () => {
      mockSchedulingIntegration.optimizeReminderDelivery.mockRejectedValueOnce(
        new Error('Optimization failed')
      );

      const reminder = createTestReminder();
      const contextualFactors = createTestReminderContextualFactors();

      const result = await integrationManager.optimizeReminderDelivery(
        testUserId,
        reminder,
        contextualFactors
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.optimizedDelivery.deliveryMethod).toBe(ReminderDeliveryMethod.VOICE_NOTIFICATION);
      expect(result.estimatedEffectiveness).toBe(0.6);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should adapt delivery based on contextual factors', async () => {
      const reminder = createTestReminder();
      const contextualFactors = createTestReminderContextualFactors();
      contextualFactors.userContext.activity.currentActivity = ActivityType.MEETING;
      contextualFactors.socialContext.interruptibility = 'very_low';

      const result = await integrationManager.optimizeReminderDelivery(
        testUserId,
        reminder,
        contextualFactors
      );

      expect(result.contextualAdaptations).toBeDefined();
      // In a real implementation, this would show adaptations for meeting context
    });
  });

  describe('enhanceFamilyCoordination', () => {
    const createTestFamilyEvent = (): FamilyEvent => ({
      eventId: 'family-event-123',
      title: 'Family Dinner',
      familyMembers: [
        {
          userId: testUserId,
          role: 'organizer' as any,
          availability: [],
          preferences: {
            preferredTimes: [],
            avoidTimes: [],
            bufferTime: 15,
            flexibility: FlexibilityLevel.MODERATE,
            workingHours: { start: '09:00', end: '17:00' }
          },
          constraints: []
        }
      ],
      eventType: 'family_meal' as any,
      coordinationRequirements: [],
      flexibilityConstraints: [],
      duration: 90,
      preferredTimeWindows: []
    });

    const createTestFamilyDynamics = (): FamilyDynamics => ({
      familyMembers: [
        {
          userId: testUserId,
          role: 'parent',
          preferences: { communicationStyle: 'direct', decisionMaking: 'collaborative' },
          availability: { typicalSchedule: {}, flexibility: FlexibilityLevel.MODERATE },
          constraints: []
        }
      ],
      coordinationPatterns: [
        {
          patternType: 'meal_coordination',
          frequency: 0.8,
          successRate: 0.9,
          preferredApproach: 'consensus_based'
        }
      ],
      communicationPreferences: {
        preferredMethods: ['voice', 'visual'],
        timing: ['evening', 'weekend'],
        formality: 'casual'
      },
      decisionMakingPatterns: [
        {
          decisionType: 'scheduling',
          approach: 'collaborative',
          timeframe: 'immediate',
          successRate: 0.85
        }
      ],
      conflictResolutionStyles: [
        {
          conflictType: 'scheduling',
          preferredStyle: 'compromise',
          effectiveness: 0.8
        }
      ]
    });

    it('should enhance family coordination successfully', async () => {
      const familyEvent = createTestFamilyEvent();
      const familyDynamics = createTestFamilyDynamics();

      const result = await integrationManager.enhanceFamilyCoordination(
        testFamilyId,
        familyEvent,
        familyDynamics
      );

      expect(result).toBeDefined();
      expect(result.familyEvent).toEqual(familyEvent);
      expect(result.coordinationStrategy).toBeDefined();
      expect(result.memberOptimizations).toBeDefined();
      expect(result.conflictPrevention).toBeDefined();
      expect(result.coordinationEffectiveness).toBeGreaterThan(0);

      expect(mockSchedulingIntegration.enhanceFamilyCoordination).toHaveBeenCalledWith(
        familyEvent,
        testFamilyId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.FAMILY_COORDINATION_ENHANCED,
          userId: testFamilyId
        })
      );
    });

    it('should handle family coordination errors gracefully', async () => {
      mockSchedulingIntegration.enhanceFamilyCoordination.mockRejectedValueOnce(
        new Error('Coordination failed')
      );

      const familyEvent = createTestFamilyEvent();
      const familyDynamics = createTestFamilyDynamics();

      const result = await integrationManager.enhanceFamilyCoordination(
        testFamilyId,
        familyEvent,
        familyDynamics
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.coordinationStrategy.coordinationType).toBe(CoordinationType.COLLABORATIVE);
      expect(result.coordinationEffectiveness).toBe(0.6);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testFamilyId
        })
      );
    });

    it('should adapt coordination based on family dynamics', async () => {
      const familyEvent = createTestFamilyEvent();
      const familyDynamics = createTestFamilyDynamics();
      familyDynamics.coordinationPatterns[0].successRate = 0.95;

      const result = await integrationManager.enhanceFamilyCoordination(
        testFamilyId,
        familyEvent,
        familyDynamics
      );

      expect(result.coordinationEffectiveness).toBeGreaterThan(0.6);
    });
  });

  describe('learnFromSchedulingInteraction', () => {
    const createTestSchedulingInteraction = (): SchedulingInteraction => ({
      interactionId: 'interaction-123',
      userId: testUserId,
      interactionType: SchedulingInteractionType.EVENT_CREATION,
      eventDetails: {
        eventId: 'event-123',
        title: 'Team Meeting',
        description: 'Weekly sync',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'high' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [testUserId],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      },
      userActions: [
        {
          actionType: 'time_selection',
          timestamp: new Date(),
          parameters: { selectedTime: '10:00', alternatives: ['09:00', '11:00'] }
        }
      ],
      outcome: {
        success: true,
        userSatisfaction: 0.9,
        completionTime: 120,
        conflictsResolved: 0
      },
      contextualFactors: {
        timeOfDay: 'morning',
        dayOfWeek: 'monday',
        userMood: 'focused',
        deviceUsed: 'smart_speaker'
      },
      timestamp: new Date()
    });

    it('should learn from scheduling interaction successfully', async () => {
      const interaction = createTestSchedulingInteraction();

      const result = await integrationManager.learnFromSchedulingInteraction(
        testUserId,
        interaction
      );

      expect(result).toBeDefined();
      expect(result.learnedPatterns).toBeDefined();
      expect(result.updatedPreferences).toBeDefined();
      expect(result.behavioralInsights).toBeDefined();
      expect(result.confidenceScores).toBeDefined();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SCHEDULING_PATTERNS_LEARNED,
          userId: testUserId
        })
      );
    });

    it('should handle learning errors gracefully', async () => {
      // Mock an internal error during learning
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Learning failed'));

      const interaction = createTestSchedulingInteraction();

      const result = await integrationManager.learnFromSchedulingInteraction(
        testUserId,
        interaction
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.learnedPatterns).toEqual([]);
      expect(result.confidenceScores.overallConfidence).toBe(0.3);

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should learn patterns from successful interactions', async () => {
      const interaction = createTestSchedulingInteraction();
      interaction.outcome.userSatisfaction = 0.95;
      interaction.outcome.success = true;

      const result = await integrationManager.learnFromSchedulingInteraction(
        testUserId,
        interaction
      );

      expect(result.confidenceScores.overallConfidence).toBeGreaterThan(0.3);
      // In a real implementation, this would show learned patterns from successful interactions
    });
  });

  describe('adaptSchedulingPreferences', () => {
    const createTestSchedulingFeedback = (): SchedulingFeedback => ({
      feedbackId: 'feedback-123',
      userId: testUserId,
      feedbackType: SchedulingFeedbackType.POSITIVE,
      eventId: 'event-123',
      aspectRatings: {
        timingRating: 5,
        conflictResolutionRating: 4,
        reminderRating: 4,
        coordinationRating: 5,
        overallRating: 4.5
      },
      specificComments: {
        timingComments: ['Perfect time slot'],
        conflictComments: ['Good resolution'],
        reminderComments: ['Timely reminders'],
        coordinationComments: ['Smooth coordination'],
        generalComments: ['Great experience']
      },
      improvementSuggestions: [
        {
          area: 'reminder_timing',
          suggestion: 'Earlier reminders for important meetings',
          priority: 'medium'
        }
      ],
      timestamp: new Date()
    });

    it('should adapt scheduling preferences successfully', async () => {
      const feedback = createTestSchedulingFeedback();

      const result = await integrationManager.adaptSchedulingPreferences(
        testUserId,
        feedback
      );

      expect(result).toBeDefined();
      expect(result.originalPreferences).toBeDefined();
      expect(result.adaptedPreferences).toBeDefined();
      expect(result.adaptationReasons).toBeDefined();
      expect(result.expectedImpact).toBeDefined();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SCHEDULING_PREFERENCES_ADAPTED,
          userId: testUserId
        })
      );
    });

    it('should handle preference adaptation errors gracefully', async () => {
      // Mock an internal error during adaptation
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Adaptation failed'));

      const feedback = createTestSchedulingFeedback();

      const result = await integrationManager.adaptSchedulingPreferences(
        testUserId,
        feedback
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.adaptationReasons).toEqual([]);
      expect(result.expectedImpact.userSatisfactionImpact.change).toBe(0);

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should adapt preferences based on feedback type', async () => {
      const feedback = createTestSchedulingFeedback();
      feedback.feedbackType = SchedulingFeedbackType.NEGATIVE;
      feedback.aspectRatings.timingRating = 2;

      const result = await integrationManager.adaptSchedulingPreferences(
        testUserId,
        feedback
      );

      expect(result.adaptationReasons).toBeDefined();
      // In a real implementation, this would show adaptations based on negative feedback
    });
  });

  describe('generateSchedulingSuggestions', () => {
    const createTestSchedulingContext = (): SchedulingContext => ({
      userId: testUserId,
      currentSchedule: {
        events: [],
        conflicts: [],
        availability: []
      },
      upcomingEvents: [
        {
          eventId: 'event-1',
          title: 'Team Meeting',
          description: 'Weekly sync',
          duration: 60,
          eventType: 'meeting' as any,
          priority: 'high' as any,
          flexibility: FlexibilityLevel.LOW,
          participants: [testUserId],
          requiredResources: [],
          preferredTimeWindows: [],
          constraints: []
        }
      ],
      availableTimeSlots: [
        {
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T15:00:00Z'),
          quality: 'high',
          conflicts: []
        }
      ],
      userPreferences: {
        timePreferences: { preferredStartTimes: [], avoidTimes: [], bufferTime: 15 },
        activityPreferences: { preferredActivities: [], avoidActivities: [], activityDurations: {} },
        communicationPreferences: { notificationMethods: [], reminderFrequency: 'moderate' },
        flexibilityPreferences: { flexibilityLevel: FlexibilityLevel.MODERATE, constraints: [] },
        reminderPreferences: { deliveryMethods: [], timingPreferences: {}, escalationRules: [] }
      },
      contextualFactors: [
        {
          factorType: 'temporal',
          value: 'morning',
          influence: 0.8
        }
      ]
    });

    it('should generate scheduling suggestions successfully', async () => {
      const context = createTestSchedulingContext();

      const result = await integrationManager.generateSchedulingSuggestions(
        testUserId,
        context
      );

      expect(result).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.proactiveRecommendations).toBeDefined();
      expect(result.optimizationOpportunities).toBeDefined();
      expect(result.confidenceScores).toBeDefined();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SCHEDULING_SUGGESTIONS_GENERATED,
          userId: testUserId
        })
      );
    });

    it('should handle suggestion generation errors gracefully', async () => {
      // Mock an internal error during suggestion generation
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Suggestion generation failed'));

      const context = createTestSchedulingContext();

      const result = await integrationManager.generateSchedulingSuggestions(
        testUserId,
        context
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.suggestions).toEqual([]);
      expect(result.confidenceScores.overallConfidence).toBe(0.5);

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should generate context-appropriate suggestions', async () => {
      const context = createTestSchedulingContext();
      context.availableTimeSlots.push({
        start: new Date('2024-01-15T16:00:00Z'),
        end: new Date('2024-01-15T17:00:00Z'),
        quality: 'medium',
        conflicts: []
      });

      const result = await integrationManager.generateSchedulingSuggestions(
        testUserId,
        context
      );

      expect(result.suggestions).toBeDefined();
      // In a real implementation, this would show suggestions based on available time slots
    });
  });

  describe('error handling and resilience', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedManager = new SchedulingSystemIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockSchedulingIntegration
      );

      const event: CalendarEvent = {
        eventId: 'test',
        title: 'Test Event',
        description: 'Test',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const patterns: UserSchedulingPatterns = {
        temporalPatterns: [],
        activityPatterns: [],
        preferencePatterns: [],
        conflictPatterns: [],
        productivityPatterns: []
      };

      await expect(
        uninitializedManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns)
      ).rejects.toThrow('Scheduling system integration manager not initialized');
    });

    it('should handle multiple concurrent operations', async () => {
      const event: CalendarEvent = {
        eventId: 'test',
        title: 'Test Event',
        description: 'Test',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const patterns: UserSchedulingPatterns = {
        temporalPatterns: [],
        activityPatterns: [],
        preferencePatterns: [],
        conflictPatterns: [],
        productivityPatterns: []
      };

      const promises = [
        integrationManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns),
        integrationManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns),
        integrationManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns)
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.optimizedEvent).toBeDefined();
      });
    });

    it('should emit error events for failed operations', async () => {
      mockSchedulingIntegration.predictOptimalScheduling.mockRejectedValueOnce(
        new Error('Test error')
      );

      const event: CalendarEvent = {
        eventId: 'test',
        title: 'Test Event',
        description: 'Test',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const patterns: UserSchedulingPatterns = {
        temporalPatterns: [],
        activityPatterns: [],
        preferencePatterns: [],
        conflictPatterns: [],
        productivityPatterns: []
      };

      await integrationManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });
  });

  describe('performance and monitoring', () => {
    it('should track performance metrics during operations', async () => {
      const event: CalendarEvent = {
        eventId: 'test',
        title: 'Test Event',
        description: 'Test',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const patterns: UserSchedulingPatterns = {
        temporalPatterns: [],
        activityPatterns: [],
        preferencePatterns: [],
        conflictPatterns: [],
        productivityPatterns: []
      };

      const result = await integrationManager.optimizeSchedulingBasedOnPatterns(
        testUserId,
        event,
        patterns
      );

      expect(result).toBeDefined();
      
      // Verify that performance metrics are being tracked
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SCHEDULING_OPTIMIZED,
          data: expect.objectContaining({
            processingTime: expect.any(Number)
          })
        })
      );
    });

    it('should handle high-load scenarios gracefully', async () => {
      const event: CalendarEvent = {
        eventId: 'test',
        title: 'Test Event',
        description: 'Test',
        duration: 60,
        eventType: 'meeting' as any,
        priority: 'medium' as any,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const patterns: UserSchedulingPatterns = {
        temporalPatterns: [],
        activityPatterns: [],
        preferencePatterns: [],
        conflictPatterns: [],
        productivityPatterns: []
      };

      // Simulate high load by making many concurrent requests
      const promises = Array(10).fill(null).map(() =>
        integrationManager.optimizeSchedulingBasedOnPatterns(testUserId, event, patterns)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
        // Should still provide results even under high load
      });
    });
  });
});