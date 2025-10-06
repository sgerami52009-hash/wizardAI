// Voice Pipeline Integration Tests

import {
  VoicePipelineIntegrationEngine,
  VoiceContext,
  AudioContext,
  ConversationContext,
  EnvironmentalVoiceContext,
  EnhancedIntent,
  PersonalizedVoiceResponse,
  ConversationOptimization,
  SpeechAdaptation,
  VoiceCommunicationPreferences,
  EmotionType,
  EngagementLevel,
  ConversationGoal,
  AcousticEnvironment,
  PrivacyLevel,
  InterruptionLevel,
  FormalityLevel,
  VerbosityLevel,
  EmotionalTone,
  TechnicalLevel,
  SpeechRatePreference,
  InteractionStyle,
  VocabularyLevel,
  SentenceStructure
} from './voice-integration';

import { RealTimeDecisionEngine } from './decision';
import { LearningEventBus } from './events';
import {
  TimeOfDay,
  DayOfWeek,
  DeviceType
} from './types';
import { ActivityType } from '../patterns/types';

describe('VoicePipelineIntegrationEngine', () => {
  let voiceIntegration: VoicePipelineIntegrationEngine;
  let mockEventBus: jest.Mocked<LearningEventBus>;
  let mockDecisionEngine: jest.Mocked<RealTimeDecisionEngine>;

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
        selectedOption: { value: 'enhanced_intent' },
        confidence: 0.9,
        reasoning: ['Enhanced based on user patterns'],
        alternatives: [],
        contextFactors: [],
        fallbackUsed: false,
        processingTime: 50,
        modelVersion: '1.0.0'
      }),
      adaptResponse: jest.fn().mockImplementation((response) => Promise.resolve(response)),
      getRecommendations: jest.fn().mockResolvedValue([]),
      predictUserIntent: jest.fn().mockResolvedValue({
        predictedIntent: 'test_intent',
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

    voiceIntegration = new VoicePipelineIntegrationEngine(mockEventBus, mockDecisionEngine);
    await voiceIntegration.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newEngine = new VoicePipelineIntegrationEngine(mockEventBus, mockDecisionEngine);
      await expect(newEngine.initialize()).resolves.not.toThrow();
    });

    it('should emit system started event on initialization', async () => {
      const newEngine = new VoicePipelineIntegrationEngine(mockEventBus, mockDecisionEngine);
      await newEngine.initialize();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system_started',
          data: expect.objectContaining({
            component: 'VoicePipelineIntegrationEngine'
          })
        })
      );
    });
  });

  describe('enhanceIntentClassification', () => {
    it('should enhance intent classification with user patterns', async () => {
      const rawIntent = 'schedule_meeting';
      const confidence = 0.7;
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        context
      );

      expect(enhancedIntent).toMatchObject({
        originalIntent: rawIntent,
        enhancedIntent: expect.any(String),
        confidence: confidence,
        personalizedConfidence: expect.any(Number),
        contextFactors: expect.any(Array),
        alternativeIntents: expect.any(Array),
        userPatternMatch: expect.any(Object)
      });

      expect(enhancedIntent.personalizedConfidence).toBeGreaterThanOrEqual(confidence);
    });

    it('should handle low confidence intents gracefully', async () => {
      const rawIntent = 'unclear_intent';
      const confidence = 0.3;
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        context
      );

      expect(enhancedIntent).toBeDefined();
      expect(enhancedIntent.confidence).toBe(confidence);
      expect(enhancedIntent.personalizedConfidence).toBeGreaterThan(0);
    });

    it('should consider emotional context in intent enhancement', async () => {
      const rawIntent = 'help_request';
      const confidence = 0.8;
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);
      context.audioContext.emotion = {
        primary: EmotionType.FRUSTRATION,
        intensity: 0.8,
        confidence: 0.9
      };

      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        context
      );

      expect(enhancedIntent.contextFactors).toContainEqual(
        expect.objectContaining({
          factorType: 'emotional',
          description: expect.stringContaining('frustration')
        })
      );
    });

    it('should emit decision events', async () => {
      const rawIntent = 'test_intent';
      const confidence = 0.8;
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      await voiceIntegration.enhanceIntentClassification(rawIntent, confidence, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'decision_made',
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('personalizeResponse', () => {
    it('should personalize response based on user preferences', async () => {
      const baseResponse = 'Here is the information you requested.';
      const intent = 'information_request';
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const personalizedResponse = await voiceIntegration.personalizeResponse(
        baseResponse,
        intent,
        userId,
        context
      );

      expect(personalizedResponse).toMatchObject({
        originalResponse: baseResponse,
        personalizedResponse: expect.any(String),
        adaptations: expect.any(Array),
        confidence: expect.any(Number),
        estimatedSatisfaction: expect.any(Number),
        voiceCharacteristics: expect.any(Object)
      });

      expect(personalizedResponse.confidence).toBeGreaterThan(0);
      expect(personalizedResponse.estimatedSatisfaction).toBeGreaterThan(0);
    });

    it('should adapt voice characteristics based on context', async () => {
      const baseResponse = 'Good morning! How can I help you?';
      const intent = 'greeting';
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);
      context.audioContext.emotion = {
        primary: EmotionType.JOY,
        intensity: 0.7,
        confidence: 0.8
      };

      const personalizedResponse = await voiceIntegration.personalizeResponse(
        baseResponse,
        intent,
        userId,
        context
      );

      expect(personalizedResponse.voiceCharacteristics).toMatchObject({
        tone: expect.any(String),
        pace: expect.any(String),
        emphasis: expect.any(String),
        warmth: expect.any(String),
        professionalism: expect.any(String)
      });
    });

    it('should handle different formality levels', async () => {
      const baseResponse = 'Please provide the requested information.';
      const intent = 'information_request';
      const userId = 'formal-user-123';
      const context = createMockVoiceContext(userId);

      const personalizedResponse = await voiceIntegration.personalizeResponse(
        baseResponse,
        intent,
        userId,
        context
      );

      expect(personalizedResponse.voiceCharacteristics.professionalism).toBeDefined();
    });

    it('should emit personalization events', async () => {
      const baseResponse = 'Test response';
      const intent = 'test_intent';
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      await voiceIntegration.personalizeResponse(baseResponse, intent, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'personalization_applied',
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('optimizeConversationFlow', () => {
    it('should optimize conversation flow based on history', async () => {
      const conversationHistory = [
        createMockConversationTurn('user', 'Hello'),
        createMockConversationTurn('assistant', 'Hi! How can I help you?'),
        createMockConversationTurn('user', 'I need help with scheduling')
      ];
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const optimization = await voiceIntegration.optimizeConversationFlow(
        conversationHistory,
        userId,
        context
      );

      expect(optimization).toMatchObject({
        recommendedFlow: expect.any(Array),
        engagementStrategies: expect.any(Array),
        personalizedPrompts: expect.any(Array),
        timingOptimizations: expect.any(Array),
        contextualCues: expect.any(Array)
      });
    });

    it('should handle empty conversation history', async () => {
      const conversationHistory: any[] = [];
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const optimization = await voiceIntegration.optimizeConversationFlow(
        conversationHistory,
        userId,
        context
      );

      expect(optimization).toBeDefined();
      expect(optimization.recommendedFlow).toEqual([]);
    });

    it('should emit optimization events', async () => {
      const conversationHistory = [createMockConversationTurn('user', 'Test message')];
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      await voiceIntegration.optimizeConversationFlow(conversationHistory, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'optimization_completed',
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('adaptSpeechPatterns', () => {
    it('should adapt speech patterns based on preferences', async () => {
      const userId = 'test-user-123';
      const preferences: VoiceCommunicationPreferences = {
        preferredTone: EmotionalTone.WARM,
        formalityLevel: FormalityLevel.CASUAL,
        verbosity: VerbosityLevel.CONCISE,
        technicalLevel: TechnicalLevel.BASIC,
        speechRate: SpeechRatePreference.NORMAL,
        interactionStyle: InteractionStyle.CONVERSATIONAL
      };

      const adaptation = await voiceIntegration.adaptSpeechPatterns(userId, preferences);

      expect(adaptation).toMatchObject({
        speechRate: expect.any(Number),
        pauseDuration: expect.any(Number),
        emphasisPatterns: expect.any(Array),
        vocabularyLevel: expect.any(String),
        sentenceStructure: expect.any(String),
        culturalAdaptations: expect.any(Array)
      });

      expect(adaptation.speechRate).toBeGreaterThan(0);
      expect(adaptation.pauseDuration).toBeGreaterThan(0);
    });

    it('should map technical level to vocabulary level correctly', async () => {
      const userId = 'test-user-123';
      const preferences: VoiceCommunicationPreferences = {
        preferredTone: EmotionalTone.NEUTRAL,
        formalityLevel: FormalityLevel.NEUTRAL,
        verbosity: VerbosityLevel.MODERATE,
        technicalLevel: TechnicalLevel.ADVANCED,
        speechRate: SpeechRatePreference.NORMAL,
        interactionStyle: InteractionStyle.DIRECT
      };

      const adaptation = await voiceIntegration.adaptSpeechPatterns(userId, preferences);

      expect(adaptation.vocabularyLevel).toBe(VocabularyLevel.ADVANCED);
    });

    it('should map verbosity to sentence structure correctly', async () => {
      const userId = 'test-user-123';
      const preferences: VoiceCommunicationPreferences = {
        preferredTone: EmotionalTone.NEUTRAL,
        formalityLevel: FormalityLevel.NEUTRAL,
        verbosity: VerbosityLevel.VERBOSE,
        technicalLevel: TechnicalLevel.BASIC,
        speechRate: SpeechRatePreference.NORMAL,
        interactionStyle: InteractionStyle.DIRECT
      };

      const adaptation = await voiceIntegration.adaptSpeechPatterns(userId, preferences);

      expect(adaptation.sentenceStructure).toBe(SentenceStructure.VARIED);
    });

    it('should emit personalization events', async () => {
      const userId = 'test-user-123';
      const preferences: VoiceCommunicationPreferences = {
        preferredTone: EmotionalTone.WARM,
        formalityLevel: FormalityLevel.CASUAL,
        verbosity: VerbosityLevel.MODERATE,
        technicalLevel: TechnicalLevel.BASIC,
        speechRate: SpeechRatePreference.NORMAL,
        interactionStyle: InteractionStyle.CONVERSATIONAL
      };

      await voiceIntegration.adaptSpeechPatterns(userId, preferences);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'personalization_applied',
          userId: 'test-user-123'
        })
      );
    });
  });

  describe('performance and constraints', () => {
    it('should maintain performance under concurrent requests', async () => {
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);
      
      const requests = Array.from({ length: 5 }, (_, i) => 
        voiceIntegration.enhanceIntentClassification(
          `intent_${i}`,
          0.8,
          `user_${i}`,
          context
        )
      );

      const startTime = performance.now();
      const results = await Promise.all(requests);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(5);
      expect(totalTime).toBeLessThan(500); // Should complete within 500ms
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should handle memory constraints efficiently', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;
      
      // Perform multiple operations
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);
      
      for (let i = 0; i < 10; i++) {
        await voiceIntegration.enhanceIntentClassification(
          `intent_${i}`,
          0.8,
          userId,
          context
        );
      }
      
      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024; // MB
      
      // Should not increase memory usage significantly
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });

  describe('error handling', () => {
    it('should handle decision engine failures gracefully', async () => {
      // Mock decision engine to throw error
      mockDecisionEngine.makeDecision.mockRejectedValueOnce(new Error('Decision engine error'));
      
      const rawIntent = 'test_intent';
      const confidence = 0.8;
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        context
      );

      expect(enhancedIntent).toBeDefined();
      expect(enhancedIntent.originalIntent).toBe(rawIntent);
      expect(enhancedIntent.personalizedConfidence).toBeLessThan(confidence);
    });

    it('should provide fallback responses on personalization errors', async () => {
      // Mock decision engine to throw error
      mockDecisionEngine.adaptResponse.mockRejectedValueOnce(new Error('Adaptation error'));
      
      const baseResponse = 'Test response';
      const intent = 'test_intent';
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      const personalizedResponse = await voiceIntegration.personalizeResponse(
        baseResponse,
        intent,
        userId,
        context
      );

      expect(personalizedResponse).toBeDefined();
      expect(personalizedResponse.originalResponse).toBe(baseResponse);
      expect(personalizedResponse.personalizedResponse).toBe(baseResponse);
      expect(personalizedResponse.confidence).toBeGreaterThan(0);
    });

    it('should emit error events on failures', async () => {
      // Mock decision engine to throw error
      mockDecisionEngine.adaptResponse.mockRejectedValueOnce(new Error('Test error'));
      
      const baseResponse = 'Test response';
      const intent = 'test_intent';
      const userId = 'test-user-123';
      const context = createMockVoiceContext(userId);

      await voiceIntegration.personalizeResponse(baseResponse, intent, userId, context);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          userId: 'test-user-123'
        })
      );
    });
  });
});

// Helper functions for creating mock data
function createMockVoiceContext(userId: string): VoiceContext {
  return {
    userContext: createMockUserContext(userId),
    audioContext: createMockAudioContext(),
    conversationContext: createMockConversationContext(),
    environmentalContext: createMockEnvironmentalVoiceContext()
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

function createMockAudioContext(): AudioContext {
  return {
    volume: 0.7,
    clarity: 0.9,
    backgroundNoise: 0.2,
    speechRate: 1.0,
    pitch: 0.5,
    emotion: {
      primary: EmotionType.NEUTRAL,
      intensity: 0.5,
      confidence: 0.8
    }
  };
}

function createMockConversationContext(): ConversationContext {
  return {
    sessionId: 'session-123',
    turnCount: 3,
    lastInteraction: new Date(),
    conversationTopic: 'general',
    userEngagement: EngagementLevel.MODERATE,
    conversationGoal: ConversationGoal.INFORMATION_SEEKING
  };
}

function createMockEnvironmentalVoiceContext(): EnvironmentalVoiceContext {
  return {
    ambientNoise: 0.3,
    acoustics: AcousticEnvironment.QUIET_INDOOR,
    privacy: PrivacyLevel.PRIVATE,
    interruptions: InterruptionLevel.LOW
  };
}

function createMockConversationTurn(speaker: 'user' | 'assistant', content: string): any {
  return {
    turnId: `turn-${Date.now()}-${Math.random()}`,
    speaker,
    content,
    timestamp: new Date(),
    sentiment: {
      polarity: 0.1,
      subjectivity: 0.5,
      emotions: [],
      confidence: 0.8
    }
  };
}