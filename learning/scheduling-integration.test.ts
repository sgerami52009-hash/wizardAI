// Tests for Scheduling System Integration

import {
  SchedulingSystemIntegrationImpl,
  CalendarEvent,
  EventType,
  EventPriority,
  FlexibilityLevel,
  ScheduleConflict,
  ConflictType,
  ConflictSeverity,
  Reminder,
  ReminderType,
  DeliveryMethod,
  ReminderPriority,
  FamilyEvent,
  FamilyEventType,
  ParticipationRole,
  CoordinationType,
  ResolutionStrategy,
  EventConstraintType,
  ConstraintPriority,
  AttentionLevel,
  InterruptibilityLevel,
  SlotQuality,
  ActivityType
} from './scheduling-integration';

import { LearningEventBus } from './events';
import { RealTimeDecisionEngine } from './decision';
import { TrainingError } from './errors';

describe('SchedulingSystemIntegration', () => {
  let schedulingIntegration: SchedulingSystemIntegrationImpl;
  let mockEventBus: jest.Mocked<LearningEventBus>;
  let mockDecisionEngine: jest.Mocked<RealTimeDecisionEngine>;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue('subscription-id'),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      getEventHistory: jest.fn().mockReturnValue([]),
      clearEventHistory: jest.fn().mockReturnValue(undefined)
    } as jest.Mocked<LearningEventBus>;

    mockDecisionEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      makeDecision: jest.fn(),
      getRecommendations: jest.fn(),
      adaptResponse: jest.fn(),
      predictUserIntent: jest.fn(),
      optimizeScheduling: jest.fn()
    } as unknown as jest.Mocked<RealTimeDecisionEngine>;

    schedulingIntegration = new SchedulingSystemIntegrationImpl(
      mockEventBus,
      mockDecisionEngine
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await schedulingIntegration.initialize();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_started',
          data: expect.objectContaining({
            component: 'SchedulingSystemIntegration'
          })
        })
      );
    });

    it('should not reinitialize if already initialized', async () => {
      await schedulingIntegration.initialize();
      await schedulingIntegration.initialize();
      
      // Should only emit once
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    });

    it('should throw error if initialization fails', async () => {
      mockEventBus.emit.mockRejectedValueOnce(new Error('Event bus error'));
      
      await expect(schedulingIntegration.initialize()).rejects.toThrow(TrainingError);
    });
  });

  describe('predictOptimalScheduling', () => {
    const mockEvent: CalendarEvent = {
      eventId: 'test-event-1',
      title: 'Team Meeting',
      description: 'Weekly team sync',
      duration: 60,
      eventType: EventType.MEETING,
      priority: EventPriority.HIGH,
      flexibility: FlexibilityLevel.MODERATE,
      participants: ['user1', 'user2'],
      requiredResources: ['conference_room'],
      preferredTimeWindows: [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T17:00:00Z'),
          preference: 0.8,
          flexibility: FlexibilityLevel.MODERATE,
          constraints: []
        }
      ],
      constraints: [
        {
          constraintType: EventConstraintType.TIME_WINDOW,
          value: { start: '09:00', end: '17:00' },
          flexibility: 0.7,
          priority: ConstraintPriority.HIGH,
          description: 'Business hours only'
        }
      ]
    };

    beforeEach(async () => {
      await schedulingIntegration.initialize();
      
      mockDecisionEngine.optimizeScheduling.mockResolvedValue({
        recommendedSlots: [
          {
            start: new Date('2024-01-15T10:00:00Z'),
            end: new Date('2024-01-15T11:00:00Z'),
            confidence: 0.9,
            quality: SlotQuality.EXCELLENT,
            conflicts: []
          }
        ],
        conflictResolution: [],
        optimizationFactors: [],
        confidence: 0.9,
        alternatives: []
      });
    });

    it('should predict optimal scheduling for an event', async () => {
      const result = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(result.recommendedSlots).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockDecisionEngine.optimizeScheduling).toHaveBeenCalled();
    });

    it('should emit optimization completed event', async () => {
      await schedulingIntegration.predictOptimalScheduling(mockEvent, 'user1');
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization_completed',
          userId: 'user1',
          data: expect.objectContaining({
            modelData: expect.objectContaining({
              eventType: EventType.MEETING
            })
          })
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockDecisionEngine.optimizeScheduling.mockRejectedValue(new Error('Optimization failed'));
      
      const result = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization_failed'
        })
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedIntegration = new SchedulingSystemIntegrationImpl(
        mockEventBus,
        mockDecisionEngine
      );
      
      await expect(
        uninitializedIntegration.predictOptimalScheduling(mockEvent, 'user1')
      ).rejects.toThrow(TrainingError);
    });
  });

  describe('personalizeConflictResolution', () => {
    const mockConflict: ScheduleConflict = {
      conflictId: 'conflict-1',
      conflictType: ConflictType.TIME_OVERLAP,
      primaryEvent: {
        eventId: 'event-1',
        title: 'Meeting A',
        duration: 60,
        eventType: EventType.MEETING,
        priority: EventPriority.HIGH,
        flexibility: FlexibilityLevel.LOW,
        participants: ['user1'],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      },
      conflictingEvent: {
        eventId: 'event-2',
        title: 'Meeting B',
        duration: 30,
        eventType: EventType.MEETING,
        priority: EventPriority.MEDIUM,
        flexibility: FlexibilityLevel.HIGH,
        participants: ['user1'],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      },
      overlapDuration: 30,
      severity: ConflictSeverity.MODERATE,
      affectedUsers: ['user1'],
      possibleResolutions: []
    };

    beforeEach(async () => {
      await schedulingIntegration.initialize();
    });

    it('should personalize conflict resolution strategy', async () => {
      const result = await schedulingIntegration.personalizeConflictResolution(
        mockConflict,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(Object.values(ResolutionStrategy)).toContain(result);
    });

    it('should emit personalization applied event', async () => {
      await schedulingIntegration.personalizeConflictResolution(mockConflict, 'user1');
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'personalization_applied',
          userId: 'user1',
          data: expect.objectContaining({
            modelData: expect.objectContaining({
              conflictType: ConflictType.TIME_OVERLAP,
              context: 'conflict_resolution'
            })
          })
        })
      );
    });

    it('should handle errors and return default strategy', async () => {
      // Mock an error in the conflict resolution process
      jest.spyOn(schedulingIntegration as any, 'loadConflictResolutionPatterns')
        .mockRejectedValue(new Error('Pattern loading failed'));
      
      const result = await schedulingIntegration.personalizeConflictResolution(
        mockConflict,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error'
        })
      );
    });
  });

  describe('optimizeReminderDelivery', () => {
    const mockReminder: Reminder = {
      reminderId: 'reminder-1',
      eventId: 'event-1',
      userId: 'user1',
      reminderType: ReminderType.ADVANCE_NOTICE,
      content: 'Meeting starts in 15 minutes',
      scheduledTime: new Date('2024-01-15T09:45:00Z'),
      deliveryMethods: [DeliveryMethod.VOICE_ANNOUNCEMENT, DeliveryMethod.VISUAL_NOTIFICATION],
      priority: ReminderPriority.HIGH,
      context: {
        userActivity: ActivityType.WORK,
        location: 'office',
        deviceAvailability: {
          availableDevices: ['smart_display', 'mobile'],
          preferredDevice: 'smart_display',
          connectivity: 'online',
          capabilities: []
        },
        attentionLevel: AttentionLevel.MODERATE,
        interruptibility: InterruptibilityLevel.NORMAL
      }
    };

    beforeEach(async () => {
      await schedulingIntegration.initialize();
    });

    it('should optimize reminder delivery', async () => {
      const result = await schedulingIntegration.optimizeReminderDelivery(
        mockReminder,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(result.optimalDeliveryTime).toBeInstanceOf(Date);
      expect(Object.values(DeliveryMethod)).toContain(result.deliveryMethod);
      expect(result.personalizedContent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should emit optimization completed event', async () => {
      await schedulingIntegration.optimizeReminderDelivery(mockReminder, 'user1');
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization_completed',
          userId: 'user1',
          data: expect.objectContaining({
            modelData: expect.objectContaining({
              reminderId: 'reminder-1',
              context: 'reminder_optimization'
            })
          })
        })
      );
    });

    it('should use cache for repeated requests', async () => {
      // First call
      const result1 = await schedulingIntegration.optimizeReminderDelivery(
        mockReminder,
        'user1'
      );
      
      // Second call should use cache
      const result2 = await schedulingIntegration.optimizeReminderDelivery(
        mockReminder,
        'user1'
      );
      
      expect(result1).toEqual(result2);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in reminder optimization
      jest.spyOn(schedulingIntegration as any, 'loadReminderPatterns')
        .mockRejectedValue(new Error('Pattern loading failed'));
      
      const result = await schedulingIntegration.optimizeReminderDelivery(
        mockReminder,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error'
        })
      );
    });
  });

  describe('enhanceFamilyCoordination', () => {
    const mockFamilyEvent: FamilyEvent = {
      eventId: 'family-event-1',
      title: 'Family Dinner',
      familyMembers: [
        {
          userId: 'parent1',
          role: ParticipationRole.ORGANIZER,
          availability: [],
          preferences: {
            preferredTimes: [],
            avoidTimes: [],
            bufferTime: 15,
            flexibility: FlexibilityLevel.MODERATE,
            workingHours: {
              start: '09:00',
              end: '17:00',
              timezone: 'UTC',
              flexibility: FlexibilityLevel.LOW
            }
          },
          constraints: []
        },
        {
          userId: 'child1',
          role: ParticipationRole.REQUIRED,
          availability: [],
          preferences: {
            preferredTimes: [],
            avoidTimes: [],
            bufferTime: 10,
            flexibility: FlexibilityLevel.HIGH,
            workingHours: {
              start: '08:00',
              end: '15:00',
              timezone: 'UTC',
              flexibility: FlexibilityLevel.MODERATE
            }
          },
          constraints: []
        }
      ],
      eventType: FamilyEventType.MEAL,
      coordinationRequirements: [],
      flexibilityConstraints: [],
      duration: 60,
      preferredTimeWindows: []
    };

    beforeEach(async () => {
      await schedulingIntegration.initialize();
    });

    it('should enhance family coordination', async () => {
      const result = await schedulingIntegration.enhanceFamilyCoordination(
        mockFamilyEvent,
        'family1'
      );
      
      expect(result).toBeDefined();
      expect(result.strategyId).toBeDefined();
      expect(Object.values(CoordinationType)).toContain(result.coordinationType);
      expect(result.participantOptimizations).toHaveLength(2);
      expect(result.successProbability).toBeGreaterThan(0);
    });

    it('should emit optimization completed event', async () => {
      await schedulingIntegration.enhanceFamilyCoordination(mockFamilyEvent, 'family1');
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization_completed',
          data: expect.objectContaining({
            component: 'family_coordination',
            familyId: 'family1',
            eventType: FamilyEventType.MEAL,
            context: 'family_coordination'
          })
        })
      );
    });

    it('should use cache for repeated requests', async () => {
      // First call
      const result1 = await schedulingIntegration.enhanceFamilyCoordination(
        mockFamilyEvent,
        'family1'
      );
      
      // Second call should use cache
      const result2 = await schedulingIntegration.enhanceFamilyCoordination(
        mockFamilyEvent,
        'family1'
      );
      
      expect(result1).toEqual(result2);
    });

    it('should handle errors gracefully', async () => {
      // Mock an error in family coordination
      jest.spyOn(schedulingIntegration as any, 'loadFamilyCoordinationPatterns')
        .mockRejectedValue(new Error('Pattern loading failed'));
      
      const result = await schedulingIntegration.enhanceFamilyCoordination(
        mockFamilyEvent,
        'family1'
      );
      
      expect(result).toBeDefined();
      expect(result.successProbability).toBeLessThan(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error'
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      await schedulingIntegration.initialize();
    });

    it('should handle invalid event data', async () => {
      const invalidEvent = {
        eventId: '',
        title: '',
        duration: -1,
        eventType: 'invalid' as EventType,
        priority: EventPriority.LOW,
        flexibility: FlexibilityLevel.RIGID,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };
      
      const result = await schedulingIntegration.predictOptimalScheduling(
        invalidEvent,
        'user1'
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle empty user preferences', async () => {
      const mockEvent: CalendarEvent = {
        eventId: 'test-event',
        title: 'Test Event',
        duration: 30,
        eventType: EventType.PERSONAL,
        priority: EventPriority.LOW,
        flexibility: FlexibilityLevel.HIGH,
        participants: [],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };
      
      const result = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        'new-user'
      );
      
      expect(result).toBeDefined();
      expect(result.recommendedSlots.length).toBeGreaterThan(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockEvent: CalendarEvent = {
        eventId: 'concurrent-test',
        title: 'Concurrent Test',
        duration: 45,
        eventType: EventType.MEETING,
        priority: EventPriority.MEDIUM,
        flexibility: FlexibilityLevel.MODERATE,
        participants: ['user1'],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };
      
      const promises = Array(5).fill(null).map(() =>
        schedulingIntegration.predictOptimalScheduling(mockEvent, 'user1')
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('performance requirements', () => {
    beforeEach(async () => {
      await schedulingIntegration.initialize();
    });

    it('should complete scheduling optimization within performance constraints', async () => {
      const mockEvent: CalendarEvent = {
        eventId: 'perf-test',
        title: 'Performance Test',
        duration: 60,
        eventType: EventType.MEETING,
        priority: EventPriority.HIGH,
        flexibility: FlexibilityLevel.LOW,
        participants: ['user1', 'user2', 'user3'],
        requiredResources: ['room1', 'projector'],
        preferredTimeWindows: [],
        constraints: []
      };
      
      const startTime = performance.now();
      const result = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        'user1'
      );
      const endTime = performance.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });

    it('should handle memory constraints efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        const mockEvent: CalendarEvent = {
          eventId: `memory-test-${i}`,
          title: `Memory Test ${i}`,
          duration: 30,
          eventType: EventType.TASK,
          priority: EventPriority.LOW,
          flexibility: FlexibilityLevel.HIGH,
          participants: [`user${i}`],
          requiredResources: [],
          preferredTimeWindows: [],
          constraints: []
        };
        
        await schedulingIntegration.predictOptimalScheduling(mockEvent, `user${i}`);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(50); // Should not increase memory by more than 50MB
    });
  });
});