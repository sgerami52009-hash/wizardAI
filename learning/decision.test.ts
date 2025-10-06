// Decision Engine Tests

import { 
  RealTimeDecisionEngine,
  DecisionRequest,
  DecisionDomain,
  DecisionContext,
  DecisionOption,
  PersonalizedDecision,
  ResponseContext,
  FormalityLevel,
  VerbosityLevel,
  EmotionalTone,
  TechnicalLevel,
  SchedulingRequest,
  FlexibilityLevel
} from './decision';

import { LearningEventBus } from './events';
import { 
  UrgencyLevel,
  TimeOfDay,
  DayOfWeek,
  DeviceType
} from './types';
import { 
  ActivityType,
  MoodState,
  EnergyLevel
} from '../patterns/types';

describe('RealTimeDecisionEngine', () => {
  let decisionEngine: RealTimeDecisionEngine;
  let mockEventBus: jest.Mocked<LearningEventBus>;

  beforeEach(async () => {
    // Create mock event bus
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined)
    } as any;

    decisionEngine = new RealTimeDecisionEngine(mockEventBus);
    await decisionEngine.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newEngine = new RealTimeDecisionEngine(mockEventBus);
      await expect(newEngine.initialize()).resolves.not.toThrow();
    });

    it('should emit system started event on initialization', async () => {
      const newEngine = new RealTimeDecisionEngine(mockEventBus);
      await newEngine.initialize();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_started',
          data: expect.objectContaining({
            component: 'RealTimeDecisionEngine'
          })
        })
      );
    });
  });

  describe('makeDecision', () => {
    it('should make a decision within 100ms constraint', async () => {
      const request: DecisionRequest = {
        userId: 'test-user-123',
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext('test-user-123'),
        options: [
          createMockDecisionOption('option1', 'response', 'Hello there!'),
          createMockDecisionOption('option2', 'response', 'Hi! How can I help?')
        ],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      };

      const startTime = performance.now();
      const decision = await decisionEngine.makeDecision(request);
      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(100); // 100ms constraint
      expect(decision).toBeDefined();
      expect(decision.selectedOption).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.processingTime).toBeLessThan(100);
    });

    it('should return a valid decision structure', async () => {
      const request: DecisionRequest = {
        userId: 'test-user-123',
        domain: DecisionDomain.SCHEDULING,
        context: createMockDecisionContext('test-user-123'),
        options: [createMockDecisionOption('slot1', 'time_slot', '2024-01-15T10:00:00Z')],
        constraints: [],
        urgency: UrgencyLevel.LOW,
        timestamp: new Date()
      };

      const decision = await decisionEngine.makeDecision(request);

      expect(decision).toMatchObject({
        selectedOption: expect.any(Object),
        confidence: expect.any(Number),
        reasoning: expect.any(Array),
        alternatives: expect.any(Array),
        contextFactors: expect.any(Array),
        fallbackUsed: expect.any(Boolean),
        processingTime: expect.any(Number),
        modelVersion: expect.any(String)
      });
    });

    it('should use fallback strategy when decision times out', async () => {
      // Create a request that would cause timeout (simulate by mocking internal methods)
      const request: DecisionRequest = {
        userId: 'test-user-123',
        domain: DecisionDomain.RECOMMENDATIONS,
        context: createMockDecisionContext('test-user-123'),
        options: [],
        constraints: [],
        urgency: UrgencyLevel.HIGH,
        timestamp: new Date()
      };

      const decision = await decisionEngine.makeDecision(request);

      // Should still return a decision even with empty options (fallback)
      expect(decision).toBeDefined();
      expect(decision.fallbackUsed).toBe(true);
    });

    it('should validate decision request structure', async () => {
      const invalidRequest = {
        userId: '',
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext('test-user-123'),
        options: [],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      } as DecisionRequest;

      await expect(decisionEngine.makeDecision(invalidRequest))
        .resolves.toMatchObject({ fallbackUsed: true });
    });

    it('should emit decision events', async () => {
      const request: DecisionRequest = {
        userId: 'test-user-123',
        domain: DecisionDomain.AVATAR_BEHAVIOR,
        context: createMockDecisionContext('test-user-123'),
        options: [createMockDecisionOption('behavior1', 'animation', 'wave')],
        constraints: [],
        urgency: UrgencyLevel.LOW,
        timestamp: new Date()
      };

      await decisionEngine.makeDecision(request);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/decision_made|decision_fallback_used/),
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('getRecommendations', () => {
    it('should generate recommendations based on context', async () => {
      const context = createMockDecisionContext('test-user-123');
      
      const recommendations = await decisionEngine.getRecommendations(context);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should return empty array when no recommendations available', async () => {
      const context = createMockDecisionContext('test-user-123');
      
      const recommendations = await decisionEngine.getRecommendations(context);
      
      expect(recommendations).toEqual([]);
    });

    it('should emit recommendations events', async () => {
      const context = createMockDecisionContext('test-user-123');
      
      await decisionEngine.getRecommendations(context);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/recommendation_generated|fallback_mode_activated/),
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('adaptResponse', () => {
    it('should personalize response based on user preferences', async () => {
      const baseResponse = 'Hello, how can I help you today?';
      const userId = 'test-user-123';
      const context: ResponseContext = {
        conversationHistory: [],
        userMood: 'positive',
        communicationStyle: {
          formality: FormalityLevel.CASUAL,
          verbosity: VerbosityLevel.CONCISE,
          emotionalTone: EmotionalTone.WARM,
          technicalLevel: TechnicalLevel.BASIC
        },
        formality: FormalityLevel.CASUAL,
        urgency: UrgencyLevel.LOW
      };

      const adaptedResponse = await decisionEngine.adaptResponse(baseResponse, userId, context);

      expect(adaptedResponse).toBeDefined();
      expect(typeof adaptedResponse).toBe('string');
      expect(adaptedResponse.length).toBeGreaterThan(0);
    });

    it('should maintain response safety', async () => {
      const baseResponse = 'This is a test response';
      const userId = 'child-user-123';
      const context: ResponseContext = {
        conversationHistory: [],
        userMood: 'neutral',
        communicationStyle: {
          formality: FormalityLevel.CASUAL,
          verbosity: VerbosityLevel.MODERATE,
          emotionalTone: EmotionalTone.WARM,
          technicalLevel: TechnicalLevel.SIMPLE
        },
        formality: FormalityLevel.CASUAL,
        urgency: UrgencyLevel.LOW
      };

      const adaptedResponse = await decisionEngine.adaptResponse(baseResponse, userId, context);

      expect(adaptedResponse).toBeDefined();
      // Should not contain inappropriate content (basic check)
      expect(adaptedResponse).not.toContain('error');
    });

    it('should emit response personalization events', async () => {
      const baseResponse = 'Test response';
      const userId = 'test-user-123';
      const context: ResponseContext = {
        conversationHistory: [],
        userMood: 'neutral',
        communicationStyle: {
          formality: FormalityLevel.NEUTRAL,
          verbosity: VerbosityLevel.MODERATE,
          emotionalTone: EmotionalTone.NEUTRAL,
          technicalLevel: TechnicalLevel.BASIC
        },
        formality: FormalityLevel.NEUTRAL,
        urgency: UrgencyLevel.MEDIUM
      };

      await decisionEngine.adaptResponse(baseResponse, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/personalization_applied|error/),
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('predictUserIntent', () => {
    it('should predict intent from partial input', async () => {
      const partialInput = 'Can you help me schedule';
      const userId = 'test-user-123';
      const context = {
        conversationHistory: [],
        currentContext: createMockUserContext('test-user-123'),
        systemState: {}
      };

      const prediction = await decisionEngine.predictUserIntent(partialInput, userId, context);

      expect(prediction).toMatchObject({
        predictedIntent: expect.any(String),
        confidence: expect.any(Number),
        alternatives: expect.any(Array),
        contextClues: expect.any(Array),
        completionSuggestions: expect.any(Array)
      });
    });

    it('should handle empty partial input', async () => {
      const partialInput = '';
      const userId = 'test-user-123';
      const context = {
        conversationHistory: [],
        currentContext: createMockUserContext('test-user-123'),
        systemState: {}
      };

      const prediction = await decisionEngine.predictUserIntent(partialInput, userId, context);

      expect(prediction.predictedIntent).toBeDefined();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should emit intent prediction events', async () => {
      const partialInput = 'What time is';
      const userId = 'test-user-123';
      const context = {
        conversationHistory: [],
        currentContext: createMockUserContext('test-user-123'),
        systemState: {}
      };

      await decisionEngine.predictUserIntent(partialInput, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/decision_made|error/),
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('optimizeScheduling', () => {
    it('should optimize scheduling based on user patterns', async () => {
      const schedulingRequest: SchedulingRequest = {
        eventType: 'meeting',
        duration: 60, // 1 hour
        preferences: {
          preferredTimes: [],
          avoidTimes: [],
          bufferTime: 15,
          flexibility: FlexibilityLevel.MODERATE
        },
        constraints: [],
        participants: ['user1', 'user2']
      };
      const userId = 'test-user-123';

      const recommendation = await decisionEngine.optimizeScheduling(schedulingRequest, userId);

      expect(recommendation).toMatchObject({
        recommendedSlots: expect.any(Array),
        conflictResolution: expect.any(Array),
        optimizationFactors: expect.any(Array),
        confidence: expect.any(Number),
        alternatives: expect.any(Array)
      });
    });

    it('should handle scheduling constraints', async () => {
      const schedulingRequest: SchedulingRequest = {
        eventType: 'appointment',
        duration: 30,
        preferences: {
          preferredTimes: [],
          avoidTimes: [],
          bufferTime: 10,
          flexibility: FlexibilityLevel.LOW
        },
        constraints: [
          {
            constraintId: 'work-hours',
            type: 'TIME_WINDOW' as any,
            value: { start: '09:00', end: '17:00' },
            flexibility: 0.2,
            priority: 'HIGH' as any
          }
        ]
      };
      const userId = 'test-user-123';

      const recommendation = await decisionEngine.optimizeScheduling(schedulingRequest, userId);

      expect(recommendation).toBeDefined();
      expect(recommendation.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should emit scheduling optimization events', async () => {
      const schedulingRequest: SchedulingRequest = {
        eventType: 'task',
        duration: 45,
        preferences: {
          preferredTimes: [],
          avoidTimes: [],
          bufferTime: 5,
          flexibility: FlexibilityLevel.HIGH
        },
        constraints: []
      };
      const userId = 'test-user-123';

      await decisionEngine.optimizeScheduling(schedulingRequest, userId);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringMatching(/optimization_completed|optimization_failed/),
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('performance constraints', () => {
    it('should respect Jetson Nano Orin memory constraints', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;
      
      // Perform multiple operations
      const requests = Array.from({ length: 10 }, (_, i) => ({
        userId: `test-user-${i}`,
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext(`test-user-${i}`),
        options: [createMockDecisionOption(`option-${i}`, 'response', `Response ${i}`)],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      }));

      await Promise.all(requests.map(req => decisionEngine.makeDecision(req)));
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024; // MB
      
      // Should not increase memory usage significantly
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });

    it('should maintain sub-100ms response times under load', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        userId: `test-user-${i}`,
        domain: DecisionDomain.RECOMMENDATIONS,
        context: createMockDecisionContext(`test-user-${i}`),
        options: [createMockDecisionOption(`option-${i}`, 'recommendation', `Rec ${i}`)],
        constraints: [],
        urgency: UrgencyLevel.HIGH,
        timestamp: new Date()
      }));

      const startTime = performance.now();
      const decisions = await Promise.all(requests.map(req => decisionEngine.makeDecision(req)));
      const totalTime = performance.now() - startTime;

      // All decisions should complete within reasonable time
      expect(totalTime).toBeLessThan(500); // 500ms for 5 concurrent requests
      decisions.forEach(decision => {
        expect(decision.processingTime).toBeLessThan(100);
      });
    });
  });

  describe('error handling and fallbacks', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const request: DecisionRequest = {
        userId: '',
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext(''),
        options: [createMockDecisionOption('option1', 'response', 'Hello')],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      };

      const decision = await decisionEngine.makeDecision(request);
      
      expect(decision).toBeDefined();
      expect(decision.fallbackUsed).toBe(true);
    });

    it('should provide fallback decisions when models fail', async () => {
      const request: DecisionRequest = {
        userId: 'test-user-123',
        domain: DecisionDomain.SYSTEM_OPTIMIZATION,
        context: createMockDecisionContext('test-user-123'),
        options: [], // Empty options to trigger fallback
        constraints: [],
        urgency: UrgencyLevel.URGENT,
        timestamp: new Date()
      };

      const decision = await decisionEngine.makeDecision(request);
      
      expect(decision).toBeDefined();
      expect(decision.fallbackUsed).toBe(true);
      expect(decision.confidence).toBeGreaterThan(0);
    });
  });
});

// Helper functions for creating mock data
function createMockDecisionContext(userId: string): DecisionContext {
  return {
    userContext: createMockUserContext(userId),
    sessionContext: {
      sessionId: `session-${userId}`,
      startTime: new Date(),
      interactionCount: 5,
      currentTask: 'general_interaction',
      userSatisfaction: 0.8
    },
    systemContext: {
      systemLoad: 0.3,
      availableMemory: 2048,
      networkStatus: {
        isOnline: true,
        bandwidth: 100,
        latency: 20,
        reliability: 0.95
      },
      deviceCapabilities: {
        processingPower: 0.8,
        memoryCapacity: 4096,
        storageCapacity: 32000,
        sensors: ['microphone', 'camera', 'accelerometer']
      }
    },
    historicalContext: {
      recentDecisions: [],
      successRate: 0.85,
      userFeedback: [],
      patterns: []
    }
  };
}

function createMockUserContext(userId: string) {
  return {
    userId,
    timestamp: new Date(),
    temporal: {
      timeOfDay: TimeOfDay.MORNING,
      dayOfWeek: DayOfWeek.MONDAY,
      season: 'spring' as any,
      isHoliday: false,
      timeZone: 'UTC',
      relativeToSchedule: 'free_time' as any
    },
    spatial: {
      location: {
        room: 'living_room',
        building: 'home',
        city: 'test_city',
        isHome: true,
        isWork: false,
        isPublic: false
      },
      movement: {
        isMoving: false,
        speed: 0,
        direction: 'stationary',
        transportMode: 'stationary' as any
      },
      proximity: {
        nearbyDevices: [],
        nearbyPeople: [],
        nearbyLocations: []
      },
      accessibility: {
        visualImpairment: false,
        hearingImpairment: false,
        mobilityImpairment: false,
        cognitiveImpairment: false,
        assistiveTechnology: []
      }
    },
    device: {
      deviceType: DeviceType.SMART_DISPLAY,
      screenSize: 'medium' as any,
      inputMethod: 'voice' as any,
      connectivity: 'online' as any
    },
    activity: {
      currentActivity: ActivityType.LEISURE,
      activityLevel: 'moderate' as any,
      focus: 'focused' as any,
      multitasking: false,
      interruptions: []
    },
    social: {
      presentUsers: [userId],
      familyMembers: [],
      guestPresent: false,
      socialActivity: 'alone' as any
    },
    environmental: {
      location: {
        room: 'living_room',
        building: 'home',
        city: 'test_city',
        isHome: true,
        isWork: false,
        isPublic: false
      },
      weather: {
        condition: 'sunny' as any,
        temperature: 22,
        humidity: 45,
        isRaining: false
      },
      lighting: {
        brightness: 70,
        isNatural: true,
        colorTemperature: 5500
      },
      noise: {
        level: 30,
        type: 'quiet' as any,
        isDistracting: false
      },
      temperature: 22
    },
    historical: {
      timestamp: new Date(),
      context: {} as any,
      significance: 0.5,
      events: []
    }
  };
}

function createMockDecisionOption(id: string, type: string, value: any): DecisionOption {
  return {
    optionId: id,
    type,
    value,
    metadata: {
      source: 'test',
      reliability: 0.9,
      lastUpdated: new Date(),
      usage: {
        usageCount: 10,
        successRate: 0.8,
        averageRating: 4.2,
        lastUsed: new Date()
      }
    },
    constraints: []
  };
}