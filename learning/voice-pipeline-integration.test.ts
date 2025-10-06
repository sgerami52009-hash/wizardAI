// Voice Pipeline Integration Tests

import {
  VoicePipelineIntegrationManager,
  VoicePipelineIntegrationService,
  VoiceProcessingContext,
  VoiceResponseContext,
  ConversationState,
  VoiceFeedback,
  VoiceUserPreferences,
  EnhancedVoiceProcessing,
  PersonalizedVoiceOutput,
  ConversationFlowOptimization,
  VoiceFeedbackType,
  ResponseType,
  PrivacyLevel,
  InterruptionLevel,
  MoodState,
  EnergyLevel,
  EngagementLevel,
  StressLevel,
  AvailabilityLevel,
  ConversationGoal,
  UrgencyLevel,
  EmotionalTrend,
  FormalityLevel,
  VerbosityLevel,
  EmotionalTone,
  TechnicalLevel,
  SpeechRatePreference,
  InteractionStyle,
  CulturalAdaptationLevel,
  EmphasisStyle,
  FeedbackFrequency,
  ConfirmationLevel,
  ErrorHandlingStyle,
  DataRetentionLevel,
  PersonalizationLevel,
  AuditLevel
} from './voice-pipeline-integration';

import {
  VoicePipelineIntegrationEngine,
  EnhancedIntent,
  PersonalizedVoiceResponse,
  ConversationOptimization,
  SpeechAdaptation
} from './voice-integration';

import { RealTimeDecisionEngine } from './decision';
import { LearningEventBus, LearningEventType } from './events';

describe('VoicePipelineIntegrationManager', () => {
  let integrationManager: VoicePipelineIntegrationManager;
  let mockEventBus: jest.Mocked<LearningEventBus>;
  let mockDecisionEngine: jest.Mocked<RealTimeDecisionEngine>;
  let mockVoiceIntegration: jest.Mocked<VoicePipelineIntegrationEngine>;

  const testUserId = 'test-user-123';
  const testSessionId = 'session-456';

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

    // Create mock voice integration engine
    mockVoiceIntegration = {
      initialize: jest.fn().mockResolvedValue(undefined),
      enhanceIntentClassification: jest.fn().mockResolvedValue({
        originalIntent: 'test_intent',
        enhancedIntent: 'enhanced_test_intent',
        confidence: 0.8,
        personalizedConfidence: 0.9,
        contextFactors: [],
        alternativeIntents: [],
        userPatternMatch: {
          patternId: 'pattern_123',
          matchStrength: 0.8,
          historicalSuccess: 0.85,
          contextRelevance: 0.9
        }
      } as EnhancedIntent),
      personalizeResponse: jest.fn().mockResolvedValue({
        originalResponse: 'Hello',
        personalizedResponse: 'Hey there!',
        adaptations: [],
        confidence: 0.9,
        estimatedSatisfaction: 0.85,
        voiceCharacteristics: {
          tone: EmotionalTone.WARM,
          pace: 'normal' as any,
          emphasis: 'moderate' as any,
          warmth: 'warm' as any,
          professionalism: 'casual' as any
        }
      } as PersonalizedVoiceResponse),
      optimizeConversationFlow: jest.fn().mockResolvedValue({
        recommendedFlow: [],
        engagementStrategies: [],
        personalizedPrompts: [],
        timingOptimizations: [],
        contextualCues: []
      } as ConversationOptimization),
      adaptSpeechPatterns: jest.fn().mockResolvedValue({
        speechRate: 1.0,
        pauseDuration: 0.5,
        emphasisPatterns: [],
        vocabularyLevel: 'basic' as any,
        sentenceStructure: 'simple' as any,
        culturalAdaptations: []
      } as SpeechAdaptation)
    } as any;

    integrationManager = new VoicePipelineIntegrationManager(
      mockEventBus,
      mockDecisionEngine,
      mockVoiceIntegration
    );

    await integrationManager.initialize();
  });

  afterEach(async () => {
    await integrationManager.shutdown();
  });

  describe('initialization and lifecycle', () => {
    it('should initialize successfully', async () => {
      const newManager = new VoicePipelineIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockVoiceIntegration
      );

      await expect(newManager.initialize()).resolves.not.toThrow();
      expect(mockVoiceIntegration.initialize).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.SYSTEM_STARTED
        })
      );

      await newManager.shutdown();
    });

    it('should handle initialization errors gracefully', async () => {
      mockVoiceIntegration.initialize.mockRejectedValueOnce(new Error('Init failed'));
      
      const newManager = new VoicePipelineIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockVoiceIntegration
      );

      await expect(newManager.initialize()).rejects.toThrow('Failed to initialize voice pipeline integration');
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
      const newManager = new VoicePipelineIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockVoiceIntegration
      );

      newManager.on('initialized', () => {
        done();
      });

      newManager.initialize();
    });
  });

  describe('enhanceVoiceProcessing', () => {
    const createTestVoiceProcessingContext = (): VoiceProcessingContext => ({
      audioQuality: {
        clarity: 0.8,
        volume: 0.7,
        backgroundNoise: 0.2,
        speechRate: 1.0,
        emotionalTone: EmotionalTone.NEUTRAL
      },
      environmentalContext: {
        location: 'living_room',
        timeOfDay: 'morning',
        ambientNoise: 0.3,
        privacy: PrivacyLevel.PRIVATE,
        interruptions: InterruptionLevel.LOW
      },
      conversationHistory: [
        {
          timestamp: new Date(),
          userInput: 'Hello',
          systemResponse: 'Hi there!',
          intent: 'greeting',
          satisfaction: 0.8,
          duration: 2000
        }
      ],
      userState: {
        mood: MoodState.HAPPY,
        energy: EnergyLevel.HIGH,
        engagement: EngagementLevel.HIGH,
        stress: StressLevel.NORMAL,
        availability: AvailabilityLevel.AVAILABLE
      },
      deviceContext: {
        deviceType: 'smart_speaker',
        capabilities: {
          audioProcessing: true,
          speechRecognition: true,
          textToSpeech: true,
          noiseReduction: true
        },
        performance: {
          cpuUsage: 0.3,
          memoryUsage: 512,
          latency: 50,
          throughput: 100
        },
        connectivity: {
          isOnline: true,
          bandwidth: 100,
          latency: 20,
          reliability: 0.95
        }
      }
    });

    it('should enhance voice processing successfully', async () => {
      const context = createTestVoiceProcessingContext();
      const rawInput = 'What time is it?';

      const result = await integrationManager.enhanceVoiceProcessing(
        testUserId,
        rawInput,
        context
      );

      expect(result).toBeDefined();
      expect(result.enhancedIntent).toBeDefined();
      expect(result.enhancedIntent.enhancedIntent).toBe('enhanced_test_intent');
      expect(result.confidenceBoost).toBeGreaterThanOrEqual(0);
      expect(result.processingOptimizations).toBeDefined();
      expect(result.personalizedParameters).toBeDefined();

      expect(mockVoiceIntegration.enhanceIntentClassification).toHaveBeenCalledWith(
        rawInput,
        0.8,
        testUserId,
        expect.any(Object)
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.VOICE_PROCESSING_ENHANCED,
          userId: testUserId
        })
      );
    });

    it('should handle voice processing enhancement errors gracefully', async () => {
      mockVoiceIntegration.enhanceIntentClassification.mockRejectedValueOnce(
        new Error('Enhancement failed')
      );

      const context = createTestVoiceProcessingContext();
      const rawInput = 'What time is it?';

      const result = await integrationManager.enhanceVoiceProcessing(
        testUserId,
        rawInput,
        context
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.enhancedIntent.enhancedIntent).toBe(rawInput);
      expect(result.confidenceBoost).toBe(0);
      expect(result.processingOptimizations).toEqual([]);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should generate personalized parameters based on context', async () => {
      const context = createTestVoiceProcessingContext();
      context.userState.engagement = EngagementLevel.LOW;
      context.audioQuality.backgroundNoise = 0.8;

      const result = await integrationManager.enhanceVoiceProcessing(
        testUserId,
        'Turn on the lights',
        context
      );

      expect(result.personalizedParameters).toBeDefined();
      expect(result.personalizedParameters.speechRecognitionSettings).toBeDefined();
      expect(result.personalizedParameters.intentClassificationWeights).toBeDefined();
      expect(result.personalizedParameters.responseGenerationParameters).toBeDefined();
    });
  });

  describe('personalizeVoiceResponse', () => {
    const createTestVoiceResponseContext = (): VoiceResponseContext => ({
      intent: 'get_weather',
      confidence: 0.9,
      conversationContext: {
        sessionId: testSessionId,
        turnCount: 3,
        topic: 'weather',
        goal: ConversationGoal.INFORMATION,
        urgency: UrgencyLevel.LOW
      },
      userEmotionalState: {
        primary: EmotionalTone.NEUTRAL,
        intensity: 0.5,
        stability: 0.8,
        trend: EmotionalTrend.STABLE
      },
      responseType: ResponseType.INFORMATIONAL
    });

    it('should personalize voice response successfully', async () => {
      const context = createTestVoiceResponseContext();
      const baseResponse = 'The weather is sunny today.';

      const result = await integrationManager.personalizeVoiceResponse(
        testUserId,
        baseResponse,
        context
      );

      expect(result).toBeDefined();
      expect(result.personalizedResponse).toBeDefined();
      expect(result.personalizedResponse.personalizedResponse).toBe('Hey there!');
      expect(result.speechAdaptations).toBeDefined();
      expect(result.deliveryOptimizations).toBeDefined();
      expect(result.estimatedUserSatisfaction).toBeGreaterThan(0);

      expect(mockVoiceIntegration.personalizeResponse).toHaveBeenCalledWith(
        baseResponse,
        context.intent,
        testUserId,
        expect.any(Object)
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.VOICE_RESPONSE_PERSONALIZED,
          userId: testUserId
        })
      );
    });

    it('should handle response personalization errors gracefully', async () => {
      mockVoiceIntegration.personalizeResponse.mockRejectedValueOnce(
        new Error('Personalization failed')
      );

      const context = createTestVoiceResponseContext();
      const baseResponse = 'The weather is sunny today.';

      const result = await integrationManager.personalizeVoiceResponse(
        testUserId,
        baseResponse,
        context
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.personalizedResponse.personalizedResponse).toBe(baseResponse);
      expect(result.estimatedUserSatisfaction).toBe(0.6);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should adapt speech characteristics based on user preferences', async () => {
      const context = createTestVoiceResponseContext();
      context.userEmotionalState.primary = EmotionalTone.EXCITED;
      context.userEmotionalState.intensity = 0.9;

      const result = await integrationManager.personalizeVoiceResponse(
        testUserId,
        'Great news!',
        context
      );

      expect(result.speechAdaptations).toBeDefined();
      expect(mockVoiceIntegration.adaptSpeechPatterns).toHaveBeenCalledWith(
        testUserId,
        expect.any(Object)
      );
    });
  });

  describe('optimizeConversationFlow', () => {
    const createTestConversationState = (): ConversationState => ({
      sessionId: testSessionId,
      userId: testUserId,
      startTime: new Date(Date.now() - 300000), // 5 minutes ago
      lastActivity: new Date(),
      turnCount: 5,
      currentTopic: 'weather_planning',
      conversationGoal: ConversationGoal.TASK_COMPLETION,
      userEngagement: EngagementLevel.MODERATE,
      conversationHistory: [
        {
          timestamp: new Date(),
          userInput: 'What\'s the weather like?',
          systemResponse: 'It\'s sunny and 75 degrees.',
          intent: 'get_weather',
          satisfaction: 0.8,
          duration: 3000
        },
        {
          timestamp: new Date(),
          userInput: 'Should I go for a walk?',
          systemResponse: 'It\'s perfect weather for a walk!',
          intent: 'get_recommendation',
          satisfaction: 0.9,
          duration: 2500
        }
      ],
      contextualFactors: [
        {
          factorType: 'temporal',
          value: 'morning',
          confidence: 0.9,
          relevance: 0.8
        }
      ]
    });

    it('should optimize conversation flow successfully', async () => {
      const conversationState = createTestConversationState();

      const result = await integrationManager.optimizeConversationFlow(
        testUserId,
        conversationState
      );

      expect(result).toBeDefined();
      expect(result.optimizedFlow).toBeDefined();
      expect(result.engagementStrategies).toBeDefined();
      expect(result.personalizedPrompts).toBeDefined();
      expect(result.timingRecommendations).toBeDefined();

      expect(mockVoiceIntegration.optimizeConversationFlow).toHaveBeenCalledWith(
        expect.any(Array),
        testUserId,
        expect.any(Object)
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.CONVERSATION_FLOW_OPTIMIZED,
          userId: testUserId
        })
      );
    });

    it('should handle conversation flow optimization errors gracefully', async () => {
      mockVoiceIntegration.optimizeConversationFlow.mockRejectedValueOnce(
        new Error('Optimization failed')
      );

      const conversationState = createTestConversationState();

      const result = await integrationManager.optimizeConversationFlow(
        testUserId,
        conversationState
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.optimizedFlow.recommendedFlow).toEqual([]);
      expect(result.engagementStrategies).toEqual([]);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should generate engagement strategies based on user engagement level', async () => {
      const conversationState = createTestConversationState();
      conversationState.userEngagement = EngagementLevel.LOW;

      const result = await integrationManager.optimizeConversationFlow(
        testUserId,
        conversationState
      );

      expect(result.engagementStrategies).toBeDefined();
      // In a real implementation, this would contain specific strategies for low engagement
    });
  });

  describe('processVoiceFeedback', () => {
    const createTestVoiceFeedback = (): VoiceFeedback => ({
      interactionId: 'interaction_789',
      feedbackType: VoiceFeedbackType.POSITIVE,
      rating: 4,
      specificFeedback: {
        speechClarity: 4,
        responseRelevance: 5,
        conversationFlow: 4,
        personalizedAccuracy: 4,
        overallSatisfaction: 4
      },
      timestamp: new Date()
    });

    it('should process voice feedback successfully', async () => {
      const feedback = createTestVoiceFeedback();

      await expect(
        integrationManager.processVoiceFeedback(testUserId, feedback)
      ).resolves.not.toThrow();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.USER_FEEDBACK_RECEIVED,
          userId: testUserId,
          data: expect.objectContaining({
            feedbackType: feedback.feedbackType,
            rating: feedback.rating,
            interactionId: feedback.interactionId
          })
        })
      );
    });

    it('should handle negative feedback appropriately', async () => {
      const feedback = createTestVoiceFeedback();
      feedback.feedbackType = VoiceFeedbackType.NEGATIVE;
      feedback.rating = 2;
      feedback.specificFeedback.speechClarity = 2;
      feedback.specificFeedback.responseRelevance = 1;

      await expect(
        integrationManager.processVoiceFeedback(testUserId, feedback)
      ).resolves.not.toThrow();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.USER_FEEDBACK_RECEIVED,
          userId: testUserId
        })
      );
    });

    it('should handle feedback processing errors', async () => {
      // Mock an internal error during feedback processing
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Event emission failed'));

      const feedback = createTestVoiceFeedback();

      await expect(
        integrationManager.processVoiceFeedback(testUserId, feedback)
      ).rejects.toThrow('Failed to process voice feedback');

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });
  });

  describe('updateVoicePreferences', () => {
    const createTestVoicePreferences = (): VoiceUserPreferences => ({
      communicationStyle: {
        formality: FormalityLevel.CASUAL,
        verbosity: VerbosityLevel.MODERATE,
        emotionalTone: EmotionalTone.WARM,
        technicalLevel: TechnicalLevel.BASIC,
        culturalAdaptation: CulturalAdaptationLevel.BASIC
      },
      speechCharacteristics: {
        speechRate: SpeechRatePreference.NORMAL,
        pauseDuration: 0.5,
        emphasisStyle: EmphasisStyle.MODERATE,
        voiceCharacteristics: {
          pitch: 1.0,
          tone: 'warm',
          warmth: 0.7,
          clarity: 0.9
        }
      },
      interactionPreferences: {
        interactionStyle: InteractionStyle.CONVERSATIONAL,
        feedbackFrequency: FeedbackFrequency.OCCASIONAL,
        confirmationLevel: ConfirmationLevel.STANDARD,
        errorHandlingStyle: ErrorHandlingStyle.SUPPORTIVE
      },
      privacySettings: {
        dataRetention: DataRetentionLevel.STANDARD,
        personalizationLevel: PersonalizationLevel.MODERATE,
        sharingPreferences: {
          allowAnalytics: true,
          allowImprovement: true,
          allowResearch: false
        },
        auditLevel: AuditLevel.BASIC
      }
    });

    it('should update voice preferences successfully', async () => {
      const preferences = createTestVoicePreferences();

      await expect(
        integrationManager.updateVoicePreferences(testUserId, preferences)
      ).resolves.not.toThrow();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.USER_PREFERENCES_UPDATED,
          userId: testUserId
        })
      );
    });

    it('should handle preference update errors', async () => {
      const preferences = createTestVoicePreferences();
      
      // Mock an internal error during preference update
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Preference update failed'));

      await expect(
        integrationManager.updateVoicePreferences(testUserId, preferences)
      ).rejects.toThrow('Failed to update voice preferences');

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should apply different communication styles correctly', async () => {
      const preferences = createTestVoicePreferences();
      preferences.communicationStyle.formality = FormalityLevel.FORMAL;
      preferences.communicationStyle.verbosity = VerbosityLevel.DETAILED;
      preferences.communicationStyle.technicalLevel = TechnicalLevel.ADVANCED;

      await expect(
        integrationManager.updateVoicePreferences(testUserId, preferences)
      ).resolves.not.toThrow();
    });
  });

  describe('error handling and resilience', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedManager = new VoicePipelineIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockVoiceIntegration
      );

      const context: VoiceProcessingContext = {
        audioQuality: {
          clarity: 0.8,
          volume: 0.7,
          backgroundNoise: 0.2,
          speechRate: 1.0,
          emotionalTone: EmotionalTone.NEUTRAL
        },
        environmentalContext: {
          location: 'home',
          timeOfDay: 'morning',
          ambientNoise: 0.2,
          privacy: PrivacyLevel.PRIVATE,
          interruptions: InterruptionLevel.LOW
        },
        conversationHistory: [],
        userState: {
          mood: MoodState.NEUTRAL,
          energy: EnergyLevel.MODERATE,
          engagement: EngagementLevel.MODERATE,
          stress: StressLevel.NORMAL,
          availability: AvailabilityLevel.AVAILABLE
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          capabilities: {
            audioProcessing: true,
            speechRecognition: true,
            textToSpeech: true,
            noiseReduction: true
          },
          performance: {
            cpuUsage: 0.3,
            memoryUsage: 512,
            latency: 50,
            throughput: 100
          },
          connectivity: {
            isOnline: true,
            bandwidth: 100,
            latency: 20,
            reliability: 0.95
          }
        }
      };

      await expect(
        uninitializedManager.enhanceVoiceProcessing(testUserId, 'test', context)
      ).rejects.toThrow('Voice pipeline integration manager not initialized');
    });

    it('should handle multiple concurrent operations', async () => {
      const context: VoiceProcessingContext = {
        audioQuality: {
          clarity: 0.8,
          volume: 0.7,
          backgroundNoise: 0.2,
          speechRate: 1.0,
          emotionalTone: EmotionalTone.NEUTRAL
        },
        environmentalContext: {
          location: 'home',
          timeOfDay: 'morning',
          ambientNoise: 0.2,
          privacy: PrivacyLevel.PRIVATE,
          interruptions: InterruptionLevel.LOW
        },
        conversationHistory: [],
        userState: {
          mood: MoodState.NEUTRAL,
          energy: EnergyLevel.MODERATE,
          engagement: EngagementLevel.MODERATE,
          stress: StressLevel.NORMAL,
          availability: AvailabilityLevel.AVAILABLE
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          capabilities: {
            audioProcessing: true,
            speechRecognition: true,
            textToSpeech: true,
            noiseReduction: true
          },
          performance: {
            cpuUsage: 0.3,
            memoryUsage: 512,
            latency: 50,
            throughput: 100
          },
          connectivity: {
            isOnline: true,
            bandwidth: 100,
            latency: 20,
            reliability: 0.95
          }
        }
      };

      const promises = [
        integrationManager.enhanceVoiceProcessing(testUserId, 'test1', context),
        integrationManager.enhanceVoiceProcessing(testUserId, 'test2', context),
        integrationManager.enhanceVoiceProcessing(testUserId, 'test3', context)
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.enhancedIntent).toBeDefined();
      });
    });

    it('should emit error events for failed operations', async () => {
      mockVoiceIntegration.enhanceIntentClassification.mockRejectedValueOnce(
        new Error('Test error')
      );

      const context: VoiceProcessingContext = {
        audioQuality: {
          clarity: 0.8,
          volume: 0.7,
          backgroundNoise: 0.2,
          speechRate: 1.0,
          emotionalTone: EmotionalTone.NEUTRAL
        },
        environmentalContext: {
          location: 'home',
          timeOfDay: 'morning',
          ambientNoise: 0.2,
          privacy: PrivacyLevel.PRIVATE,
          interruptions: InterruptionLevel.LOW
        },
        conversationHistory: [],
        userState: {
          mood: MoodState.NEUTRAL,
          energy: EnergyLevel.MODERATE,
          engagement: EngagementLevel.MODERATE,
          stress: StressLevel.NORMAL,
          availability: AvailabilityLevel.AVAILABLE
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          capabilities: {
            audioProcessing: true,
            speechRecognition: true,
            textToSpeech: true,
            noiseReduction: true
          },
          performance: {
            cpuUsage: 0.3,
            memoryUsage: 512,
            latency: 50,
            throughput: 100
          },
          connectivity: {
            isOnline: true,
            bandwidth: 100,
            latency: 20,
            reliability: 0.95
          }
        }
      };

      await integrationManager.enhanceVoiceProcessing(testUserId, 'test', context);

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
      const context: VoiceProcessingContext = {
        audioQuality: {
          clarity: 0.8,
          volume: 0.7,
          backgroundNoise: 0.2,
          speechRate: 1.0,
          emotionalTone: EmotionalTone.NEUTRAL
        },
        environmentalContext: {
          location: 'home',
          timeOfDay: 'morning',
          ambientNoise: 0.2,
          privacy: PrivacyLevel.PRIVATE,
          interruptions: InterruptionLevel.LOW
        },
        conversationHistory: [],
        userState: {
          mood: MoodState.NEUTRAL,
          energy: EnergyLevel.MODERATE,
          engagement: EngagementLevel.MODERATE,
          stress: StressLevel.NORMAL,
          availability: AvailabilityLevel.AVAILABLE
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          capabilities: {
            audioProcessing: true,
            speechRecognition: true,
            textToSpeech: true,
            noiseReduction: true
          },
          performance: {
            cpuUsage: 0.3,
            memoryUsage: 512,
            latency: 50,
            throughput: 100
          },
          connectivity: {
            isOnline: true,
            bandwidth: 100,
            latency: 20,
            reliability: 0.95
          }
        }
      };

      const result = await integrationManager.enhanceVoiceProcessing(
        testUserId,
        'test input',
        context
      );

      expect(result).toBeDefined();
      
      // Verify that performance metrics are being tracked
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.VOICE_PROCESSING_ENHANCED,
          data: expect.objectContaining({
            processingTime: expect.any(Number)
          })
        })
      );
    });

    it('should handle high-load scenarios gracefully', async () => {
      const context: VoiceProcessingContext = {
        audioQuality: {
          clarity: 0.8,
          volume: 0.7,
          backgroundNoise: 0.2,
          speechRate: 1.0,
          emotionalTone: EmotionalTone.NEUTRAL
        },
        environmentalContext: {
          location: 'home',
          timeOfDay: 'morning',
          ambientNoise: 0.2,
          privacy: PrivacyLevel.PRIVATE,
          interruptions: InterruptionLevel.LOW
        },
        conversationHistory: [],
        userState: {
          mood: MoodState.NEUTRAL,
          energy: EnergyLevel.MODERATE,
          engagement: EngagementLevel.MODERATE,
          stress: StressLevel.NORMAL,
          availability: AvailabilityLevel.AVAILABLE
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          capabilities: {
            audioProcessing: true,
            speechRecognition: true,
            textToSpeech: true,
            noiseReduction: true
          },
          performance: {
            cpuUsage: 0.9, // High CPU usage
            memoryUsage: 7000, // High memory usage
            latency: 200, // High latency
            throughput: 10 // Low throughput
          },
          connectivity: {
            isOnline: true,
            bandwidth: 10, // Low bandwidth
            latency: 100, // High network latency
            reliability: 0.7 // Lower reliability
          }
        }
      };

      const result = await integrationManager.enhanceVoiceProcessing(
        testUserId,
        'test under load',
        context
      );

      expect(result).toBeDefined();
      // Should still provide a result even under high load conditions
    });
  });
});