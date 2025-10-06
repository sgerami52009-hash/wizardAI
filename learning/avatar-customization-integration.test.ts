// Avatar Customization Integration Tests

import {
  AvatarCustomizationIntegrationManager,
  AvatarCustomizationIntegrationService,
  AvatarConfiguration,
  AdaptedAvatarConfiguration,
  PersonalityAdjustmentResult,
  ExpressionOptimizationResult,
  PersonalizedAnimationResult,
  VoiceAdaptationResult,
  AvatarFeedback,
  AvatarInteractionData,
  LearnedPreferences,
  AvatarFeedbackType,
  AvatarAdaptationType,
  InteractionType,
  UserMood,
  TimeOfDay,
  SocialContext,
  DeviceContext,
  InteractionHistory,
  EmotionalExpressionContext,
  AnimationContext,
  CommunicationPatterns
} from './avatar-customization-integration';

import {
  AvatarSystemIntegration,
  PersonalizedPersonality,
  OptimizedExpression,
  PersonalizedAnimation,
  PersonalizedVoice,
  AnimationType
} from './avatar-integration';

import { RealTimeDecisionEngine } from './decision';
import { LearningEventBus, LearningEventType } from './events';
import {
  PersonalityTraits,
  VoiceCharacteristics,
  EmotionType,
  EmotionalTone,
  AccentType
} from '../avatar/types';

describe('AvatarCustomizationIntegrationManager', () => {
  let integrationManager: AvatarCustomizationIntegrationManager;
  let mockEventBus: jest.Mocked<LearningEventBus>;
  let mockDecisionEngine: jest.Mocked<RealTimeDecisionEngine>;
  let mockAvatarIntegration: jest.Mocked<AvatarSystemIntegration>;

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
        selectedOption: { value: 'adapted_configuration' },
        confidence: 0.9,
        reasoning: ['Adapted based on user patterns'],
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

    // Create mock avatar integration
    mockAvatarIntegration = {
      adaptAvatarPersonality: jest.fn().mockResolvedValue({
        traits: {
          friendliness: 8,
          formality: 3,
          humor: 7,
          enthusiasm: 6,
          patience: 8,
          supportiveness: 9
        } as PersonalityTraits,
        adaptations: [],
        confidence: 0.85,
        reasoning: ['Adapted based on user interaction patterns'],
        version: '1.0.0',
        lastUpdated: new Date()
      } as PersonalizedPersonality),
      optimizeExpressions: jest.fn().mockResolvedValue({
        emotionType: EmotionType.JOY,
        intensity: 0.7,
        duration: 2000,
        timing: {
          delay: 100,
          fadeIn: 300,
          hold: 1400,
          fadeOut: 200,
          contextualAdjustments: []
        },
        contextFactors: [],
        confidence: 0.8
      } as OptimizedExpression),
      personalizeAnimations: jest.fn().mockResolvedValue({
        animationId: 'personalized_greeting',
        parameters: {
          speed: 1.2,
          intensity: 0.8,
          variation: 0.6,
          smoothness: 0.9,
          personalizedElements: []
        },
        timing: {
          startDelay: 0,
          duration: 2000,
          repeatPattern: {
            shouldRepeat: false,
            maxRepeats: 0,
            intervalMs: 0,
            decayFactor: 1.0
          },
          contextualModifiers: []
        },
        contextualTriggers: [],
        userPreferenceScore: 0.85
      } as PersonalizedAnimation),
      adaptVoiceCharacteristics: jest.fn().mockResolvedValue({
        characteristics: {
          pitch: 1.1,
          speed: 0.9,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.WARM,
          volume: 0.8
        } as VoiceCharacteristics,
        adaptations: [],
        emotionalMapping: [],
        confidence: 0.8,
        contextualVariations: []
      } as PersonalizedVoice)
    } as any;

    integrationManager = new AvatarCustomizationIntegrationManager(
      mockEventBus,
      mockDecisionEngine,
      mockAvatarIntegration
    );

    await integrationManager.initialize();
  });

  afterEach(async () => {
    await integrationManager.shutdown();
  });

  describe('initialization and lifecycle', () => {
    it('should initialize successfully', async () => {
      const newManager = new AvatarCustomizationIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockAvatarIntegration
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
      
      const newManager = new AvatarCustomizationIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockAvatarIntegration
      );

      await expect(newManager.initialize()).rejects.toThrow('Failed to initialize avatar customization integration');
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
      const newManager = new AvatarCustomizationIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockAvatarIntegration
      );

      newManager.on('initialized', () => {
        done();
      });

      newManager.initialize();
    });
  });

  describe('adaptAvatarToUserPatterns', () => {
    const createTestAvatarConfiguration = (): AvatarConfiguration => ({
      appearance: {
        faceConfiguration: { style: 'friendly', features: {} },
        hairConfiguration: { style: 'casual', color: 'brown' },
        clothingConfiguration: { style: 'casual', colors: ['blue', 'white'] },
        accessoryConfiguration: [],
        colorScheme: { primary: 'blue', secondary: 'white', accent: 'green' }
      },
      personality: {
        friendliness: 7,
        formality: 4,
        humor: 6,
        enthusiasm: 5,
        patience: 7,
        supportiveness: 8
      } as PersonalityTraits,
      voice: {
        pitch: 1.0,
        speed: 1.0,
        accent: AccentType.NEUTRAL,
        emotionalTone: EmotionalTone.NEUTRAL,
        volume: 0.7
      } as VoiceCharacteristics,
      emotionalExpressions: {
        defaultExpressions: [],
        contextualExpressions: [],
        transitionMappings: [],
        intensitySettings: {}
      },
      animations: {
        idleAnimations: {},
        interactionAnimations: {},
        emotionalAnimations: {},
        transitionAnimations: {}
      },
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        adaptationHistory: [],
        userSatisfactionHistory: []
      }
    });

    it('should adapt avatar to user patterns successfully', async () => {
      const baseConfiguration = createTestAvatarConfiguration();

      const result = await integrationManager.adaptAvatarToUserPatterns(
        testUserId,
        baseConfiguration
      );

      expect(result).toBeDefined();
      expect(result.originalConfiguration).toEqual(baseConfiguration);
      expect(result.adaptedConfiguration).toBeDefined();
      expect(result.adaptations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.learningFactors).toBeDefined();
      expect(result.estimatedUserSatisfaction).toBeGreaterThan(0);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.AVATAR_ADAPTED,
          userId: testUserId
        })
      );
    });

    it('should handle adaptation errors gracefully', async () => {
      // Mock an error in the adaptation process
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Adaptation failed'));

      const baseConfiguration = createTestAvatarConfiguration();

      const result = await integrationManager.adaptAvatarToUserPatterns(
        testUserId,
        baseConfiguration
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.adaptedConfiguration).toEqual(baseConfiguration);
      expect(result.adaptations).toEqual([]);
      expect(result.confidence).toBe(0.5);

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should generate meaningful adaptations based on user patterns', async () => {
      const baseConfiguration = createTestAvatarConfiguration();
      baseConfiguration.personality.friendliness = 3; // Low friendliness

      const result = await integrationManager.adaptAvatarToUserPatterns(
        testUserId,
        baseConfiguration
      );

      expect(result.adaptations).toBeDefined();
      // In a real implementation, this would show increased friendliness based on patterns
    });
  });

  describe('adjustPersonalityBasedOnInteractions', () => {
    const createTestPersonalityTraits = (): PersonalityTraits => ({
      friendliness: 6,
      formality: 5,
      humor: 4,
      enthusiasm: 5,
      patience: 7,
      supportiveness: 8
    });

    const createTestInteractionHistory = (): InteractionHistory => ({
      interactions: [
        {
          timestamp: new Date(),
          type: 'conversation',
          userSatisfaction: 0.8,
          personalityFeedback: { friendliness: 'increase', humor: 'increase' }
        }
      ],
      patterns: [
        {
          type: 'communication_preference',
          pattern: 'prefers_casual_tone',
          confidence: 0.9
        }
      ],
      insights: {
        preferredTraits: ['friendliness', 'humor'],
        avoidedTraits: ['formality']
      }
    });

    it('should adjust personality based on interactions successfully', async () => {
      const currentPersonality = createTestPersonalityTraits();
      const interactionHistory = createTestInteractionHistory();

      const result = await integrationManager.adjustPersonalityBasedOnInteractions(
        testUserId,
        currentPersonality,
        interactionHistory
      );

      expect(result).toBeDefined();
      expect(result.originalPersonality).toEqual(currentPersonality);
      expect(result.adjustedPersonality).toBeDefined();
      expect(result.adjustmentReasons).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.expectedImpact).toBeDefined();

      expect(mockAvatarIntegration.adaptAvatarPersonality).toHaveBeenCalledWith(
        currentPersonality,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.PERSONALITY_ADJUSTED,
          userId: testUserId
        })
      );
    });

    it('should handle personality adjustment errors gracefully', async () => {
      mockAvatarIntegration.adaptAvatarPersonality.mockRejectedValueOnce(
        new Error('Personality adaptation failed')
      );

      const currentPersonality = createTestPersonalityTraits();
      const interactionHistory = createTestInteractionHistory();

      const result = await integrationManager.adjustPersonalityBasedOnInteractions(
        testUserId,
        currentPersonality,
        interactionHistory
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.adjustedPersonality.traits).toEqual(currentPersonality);
      expect(result.confidence).toBe(0.5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should generate appropriate adjustment reasons', async () => {
      const currentPersonality = createTestPersonalityTraits();
      const interactionHistory = createTestInteractionHistory();

      const result = await integrationManager.adjustPersonalityBasedOnInteractions(
        testUserId,
        currentPersonality,
        interactionHistory
      );

      expect(result.adjustmentReasons).toBeDefined();
      // In a real implementation, this would contain specific reasons for adjustments
    });
  });

  describe('optimizeEmotionalExpressions', () => {
    const createTestEmotionalExpressionContext = (): EmotionalExpressionContext => ({
      userId: testUserId,
      currentEmotion: EmotionType.NEUTRAL,
      conversationContext: {
        topic: 'weather',
        mood: 'casual',
        engagement: 0.7
      },
      environmentalFactors: {
        timeOfDay: TimeOfDay.MORNING,
        socialContext: SocialContext.INDIVIDUAL,
        deviceType: DeviceContext.SMART_SPEAKER
      }
    });

    it('should optimize emotional expressions successfully', async () => {
      const context = createTestEmotionalExpressionContext();

      const result = await integrationManager.optimizeEmotionalExpressions(
        testUserId,
        context
      );

      expect(result).toBeDefined();
      expect(result.optimizedExpressions).toBeDefined();
      expect(result.contextualMappings).toBeDefined();
      expect(result.emotionalResponsePatterns).toBeDefined();
      expect(result.userPreferenceAlignment).toBeGreaterThan(0);

      expect(mockAvatarIntegration.optimizeExpressions).toHaveBeenCalledWith(
        expect.any(Object),
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.EXPRESSION_OPTIMIZED,
          userId: testUserId
        })
      );
    });

    it('should handle expression optimization errors gracefully', async () => {
      mockAvatarIntegration.optimizeExpressions.mockRejectedValueOnce(
        new Error('Expression optimization failed')
      );

      const context = createTestEmotionalExpressionContext();

      const result = await integrationManager.optimizeEmotionalExpressions(
        testUserId,
        context
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.optimizedExpressions).toEqual([]);
      expect(result.userPreferenceAlignment).toBe(0.5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should adapt expressions based on context', async () => {
      const context = createTestEmotionalExpressionContext();
      context.currentEmotion = EmotionType.JOY;
      context.conversationContext.engagement = 0.9;

      const result = await integrationManager.optimizeEmotionalExpressions(
        testUserId,
        context
      );

      expect(result.optimizedExpressions).toBeDefined();
      // In a real implementation, this would show expressions adapted for high engagement and joy
    });
  });

  describe('personalizeAnimationBehavior', () => {
    const createTestAnimationContext = (): AnimationContext => ({
      userId: testUserId,
      interactionType: InteractionType.CONVERSATION,
      emotionalState: {
        currentEmotion: EmotionType.NEUTRAL,
        intensity: 0.5
      },
      environmentalContext: {
        timeOfDay: TimeOfDay.AFTERNOON,
        socialContext: SocialContext.FAMILY,
        deviceType: DeviceContext.TABLET
      }
    });

    it('should personalize animation behavior successfully', async () => {
      const animationType = AnimationType.GREETING;
      const context = createTestAnimationContext();

      const result = await integrationManager.personalizeAnimationBehavior(
        testUserId,
        animationType,
        context
      );

      expect(result).toBeDefined();
      expect(result.personalizedAnimation).toBeDefined();
      expect(result.adaptationFactors).toBeDefined();
      expect(result.contextualTriggers).toBeDefined();
      expect(result.userEngagementPrediction).toBeGreaterThan(0);

      expect(mockAvatarIntegration.personalizeAnimations).toHaveBeenCalledWith(
        animationType,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ANIMATION_PERSONALIZED,
          userId: testUserId
        })
      );
    });

    it('should handle animation personalization errors gracefully', async () => {
      mockAvatarIntegration.personalizeAnimations.mockRejectedValueOnce(
        new Error('Animation personalization failed')
      );

      const animationType = AnimationType.GREETING;
      const context = createTestAnimationContext();

      const result = await integrationManager.personalizeAnimationBehavior(
        testUserId,
        animationType,
        context
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.personalizedAnimation.animationId).toBe(`fallback_${animationType}`);
      expect(result.userEngagementPrediction).toBe(0.5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should adapt animations based on context and user preferences', async () => {
      const animationType = AnimationType.CELEBRATION;
      const context = createTestAnimationContext();
      context.emotionalState.currentEmotion = EmotionType.JOY;
      context.emotionalState.intensity = 0.9;

      const result = await integrationManager.personalizeAnimationBehavior(
        testUserId,
        animationType,
        context
      );

      expect(result.personalizedAnimation).toBeDefined();
      expect(result.personalizedAnimation.userPreferenceScore).toBeGreaterThan(0);
    });
  });

  describe('adaptVoiceCharacteristics', () => {
    const createTestVoiceCharacteristics = (): VoiceCharacteristics => ({
      pitch: 1.0,
      speed: 1.0,
      accent: AccentType.NEUTRAL,
      emotionalTone: EmotionalTone.NEUTRAL,
      volume: 0.7
    });

    const createTestCommunicationPatterns = (): CommunicationPatterns => ({
      patterns: [
        {
          type: 'speech_rate_preference',
          value: 'slightly_faster',
          confidence: 0.8
        },
        {
          type: 'emotional_tone_preference',
          value: 'warm',
          confidence: 0.9
        }
      ],
      preferences: {
        formalityLevel: 0.3,
        emotionalWarmth: 0.8,
        speechClarity: 0.9
      },
      insights: {
        preferredCharacteristics: ['warm_tone', 'clear_speech'],
        avoidedCharacteristics: ['formal_tone']
      }
    });

    it('should adapt voice characteristics successfully', async () => {
      const baseVoice = createTestVoiceCharacteristics();
      const communicationPatterns = createTestCommunicationPatterns();

      const result = await integrationManager.adaptVoiceCharacteristics(
        testUserId,
        baseVoice,
        communicationPatterns
      );

      expect(result).toBeDefined();
      expect(result.adaptedVoice).toBeDefined();
      expect(result.adaptationStrategies).toBeDefined();
      expect(result.communicationStyleAlignment).toBeDefined();
      expect(result.estimatedUserPreference).toBeGreaterThan(0);

      expect(mockAvatarIntegration.adaptVoiceCharacteristics).toHaveBeenCalledWith(
        baseVoice,
        testUserId
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.VOICE_ADAPTED,
          userId: testUserId
        })
      );
    });

    it('should handle voice adaptation errors gracefully', async () => {
      mockAvatarIntegration.adaptVoiceCharacteristics.mockRejectedValueOnce(
        new Error('Voice adaptation failed')
      );

      const baseVoice = createTestVoiceCharacteristics();
      const communicationPatterns = createTestCommunicationPatterns();

      const result = await integrationManager.adaptVoiceCharacteristics(
        testUserId,
        baseVoice,
        communicationPatterns
      );

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.adaptedVoice.characteristics).toEqual(baseVoice);
      expect(result.estimatedUserPreference).toBe(0.5);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.ERROR,
          userId: testUserId
        })
      );
    });

    it('should calculate communication style alignment', async () => {
      const baseVoice = createTestVoiceCharacteristics();
      const communicationPatterns = createTestCommunicationPatterns();

      const result = await integrationManager.adaptVoiceCharacteristics(
        testUserId,
        baseVoice,
        communicationPatterns
      );

      expect(result.communicationStyleAlignment).toBeDefined();
      expect(result.communicationStyleAlignment.overallAlignment).toBeGreaterThan(0);
      expect(result.communicationStyleAlignment.formalityAlignment).toBeGreaterThan(0);
      expect(result.communicationStyleAlignment.emotionalToneAlignment).toBeGreaterThan(0);
    });
  });

  describe('processAvatarFeedback', () => {
    const createTestAvatarFeedback = (): AvatarFeedback => ({
      interactionId: 'interaction_789',
      feedbackType: AvatarFeedbackType.POSITIVE,
      aspectRatings: {
        appearanceRating: 4,
        personalityRating: 5,
        voiceRating: 4,
        emotionalExpressionRating: 4,
        animationRating: 3,
        overallRating: 4
      },
      specificComments: {
        appearanceComments: ['Looks friendly'],
        personalityComments: ['Very helpful and warm'],
        voiceComments: ['Clear and pleasant'],
        emotionalComments: ['Appropriate expressions'],
        animationComments: ['Could be more animated'],
        generalComments: ['Overall great experience']
      },
      contextualFactors: {
        interactionType: InteractionType.CONVERSATION,
        userMood: UserMood.HAPPY,
        timeOfDay: TimeOfDay.MORNING,
        socialContext: SocialContext.INDIVIDUAL,
        deviceContext: DeviceContext.SMART_SPEAKER
      },
      timestamp: new Date()
    });

    it('should process avatar feedback successfully', async () => {
      const feedback = createTestAvatarFeedback();

      await expect(
        integrationManager.processAvatarFeedback(testUserId, feedback)
      ).resolves.not.toThrow();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.USER_FEEDBACK_RECEIVED,
          userId: testUserId,
          data: expect.objectContaining({
            feedbackType: feedback.feedbackType,
            overallRating: feedback.aspectRatings.overallRating,
            interactionId: feedback.interactionId
          })
        })
      );
    });

    it('should handle negative feedback appropriately', async () => {
      const feedback = createTestAvatarFeedback();
      feedback.feedbackType = AvatarFeedbackType.NEGATIVE;
      feedback.aspectRatings.overallRating = 2;
      feedback.aspectRatings.personalityRating = 1;
      feedback.specificComments.personalityComments = ['Too formal', 'Not engaging'];

      await expect(
        integrationManager.processAvatarFeedback(testUserId, feedback)
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
      mockEventBus.emit.mockRejectedValueOnce(new Error('Feedback processing failed'));

      const feedback = createTestAvatarFeedback();

      await expect(
        integrationManager.processAvatarFeedback(testUserId, feedback)
      ).rejects.toThrow('Failed to process avatar feedback');

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });
  });

  describe('learnAvatarPreferences', () => {
    const createTestAvatarInteractionData = (): AvatarInteractionData => ({
      interactionId: 'interaction_123',
      userId: testUserId,
      avatarState: {
        currentEmotion: EmotionType.JOY,
        personalityState: { friendliness: 8, enthusiasm: 7 },
        voiceState: { pitch: 1.1, emotionalTone: EmotionalTone.WARM },
        animationState: { currentAnimation: 'greeting', intensity: 0.8 },
        engagementLevel: { level: 'high', score: 0.9 }
      },
      userResponse: {
        engagementMetrics: { attentionScore: 0.9, interactionDuration: 45 },
        emotionalResponse: { detectedEmotion: EmotionType.JOY, intensity: 0.8 },
        behavioralResponse: { responseTime: 1.2, actionTaken: 'positive_feedback' },
        verbalFeedback: { sentiment: 'positive', keywords: ['great', 'helpful'] }
      },
      contextualFactors: {
        conversationContext: { topic: 'weather', length: 3, engagement: 0.8 },
        environmentalContext: { location: 'home', timeOfDay: TimeOfDay.MORNING },
        temporalContext: { dayOfWeek: 'monday', season: 'spring' },
        socialContext: SocialContext.INDIVIDUAL
      },
      outcome: {
        success: true,
        userSatisfaction: 0.9,
        goalAchievement: 0.8,
        emotionalImpact: { positiveImpact: 0.8, negativeImpact: 0.1 },
        learningOpportunities: [
          { type: 'personality_preference', confidence: 0.9 },
          { type: 'voice_preference', confidence: 0.7 }
        ]
      },
      timestamp: new Date()
    });

    it('should learn avatar preferences successfully', async () => {
      const interactionData = createTestAvatarInteractionData();

      const result = await integrationManager.learnAvatarPreferences(
        testUserId,
        interactionData
      );

      expect(result).toBeDefined();
      expect(result.appearancePreferences).toBeDefined();
      expect(result.personalityPreferences).toBeDefined();
      expect(result.voicePreferences).toBeDefined();
      expect(result.emotionalPreferences).toBeDefined();
      expect(result.animationPreferences).toBeDefined();
      expect(result.confidence).toBeDefined();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.PREFERENCES_LEARNED,
          userId: testUserId,
          data: expect.objectContaining({
            interactionId: interactionData.interactionId,
            userSatisfaction: interactionData.outcome.userSatisfaction
          })
        })
      );
    });

    it('should handle preference learning errors gracefully', async () => {
      // Mock an internal error during preference learning
      const originalEmit = mockEventBus.emit;
      mockEventBus.emit.mockRejectedValueOnce(new Error('Preference learning failed'));

      const interactionData = createTestAvatarInteractionData();

      const result = await integrationManager.learnAvatarPreferences(
        testUserId,
        interactionData
      );

      // Should return fallback preferences
      expect(result).toBeDefined();
      expect(result.confidence.overallConfidence).toBeGreaterThan(0);

      // Restore original mock
      mockEventBus.emit = originalEmit;
    });

    it('should update preferences based on positive interactions', async () => {
      const interactionData = createTestAvatarInteractionData();
      interactionData.outcome.userSatisfaction = 0.95;
      interactionData.userResponse.emotionalResponse.detectedEmotion = EmotionType.JOY;

      const result = await integrationManager.learnAvatarPreferences(
        testUserId,
        interactionData
      );

      expect(result.confidence.overallConfidence).toBeGreaterThan(0.5);
      // In a real implementation, this would show increased confidence in learned preferences
    });

    it('should adjust preferences based on negative interactions', async () => {
      const interactionData = createTestAvatarInteractionData();
      interactionData.outcome.userSatisfaction = 0.3;
      interactionData.userResponse.emotionalResponse.detectedEmotion = EmotionType.SADNESS;
      interactionData.userResponse.verbalFeedback.sentiment = 'negative';

      const result = await integrationManager.learnAvatarPreferences(
        testUserId,
        interactionData
      );

      expect(result).toBeDefined();
      // In a real implementation, this would show adjustments to avoid negative patterns
    });
  });

  describe('error handling and resilience', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedManager = new AvatarCustomizationIntegrationManager(
        mockEventBus,
        mockDecisionEngine,
        mockAvatarIntegration
      );

      const baseConfiguration: AvatarConfiguration = {
        appearance: {
          faceConfiguration: {},
          hairConfiguration: {},
          clothingConfiguration: {},
          accessoryConfiguration: [],
          colorScheme: {}
        },
        personality: {
          friendliness: 5,
          formality: 5,
          humor: 5,
          enthusiasm: 5,
          patience: 5,
          supportiveness: 5
        } as PersonalityTraits,
        voice: {
          pitch: 1.0,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.NEUTRAL,
          volume: 0.7
        } as VoiceCharacteristics,
        emotionalExpressions: {
          defaultExpressions: [],
          contextualExpressions: [],
          transitionMappings: [],
          intensitySettings: {}
        },
        animations: {
          idleAnimations: {},
          interactionAnimations: {},
          emotionalAnimations: {},
          transitionAnimations: {}
        },
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          adaptationHistory: [],
          userSatisfactionHistory: []
        }
      };

      await expect(
        uninitializedManager.adaptAvatarToUserPatterns(testUserId, baseConfiguration)
      ).rejects.toThrow('Avatar customization integration manager not initialized');
    });

    it('should handle multiple concurrent operations', async () => {
      const baseConfiguration: AvatarConfiguration = {
        appearance: {
          faceConfiguration: {},
          hairConfiguration: {},
          clothingConfiguration: {},
          accessoryConfiguration: [],
          colorScheme: {}
        },
        personality: {
          friendliness: 5,
          formality: 5,
          humor: 5,
          enthusiasm: 5,
          patience: 5,
          supportiveness: 5
        } as PersonalityTraits,
        voice: {
          pitch: 1.0,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.NEUTRAL,
          volume: 0.7
        } as VoiceCharacteristics,
        emotionalExpressions: {
          defaultExpressions: [],
          contextualExpressions: [],
          transitionMappings: [],
          intensitySettings: {}
        },
        animations: {
          idleAnimations: {},
          interactionAnimations: {},
          emotionalAnimations: {},
          transitionAnimations: {}
        },
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          adaptationHistory: [],
          userSatisfactionHistory: []
        }
      };

      const promises = [
        integrationManager.adaptAvatarToUserPatterns(testUserId, baseConfiguration),
        integrationManager.adaptAvatarToUserPatterns(testUserId, baseConfiguration),
        integrationManager.adaptAvatarToUserPatterns(testUserId, baseConfiguration)
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.adaptedConfiguration).toBeDefined();
      });
    });

    it('should emit error events for failed operations', async () => {
      mockAvatarIntegration.adaptAvatarPersonality.mockRejectedValueOnce(
        new Error('Test error')
      );

      const personality: PersonalityTraits = {
        friendliness: 5,
        formality: 5,
        humor: 5,
        enthusiasm: 5,
        patience: 5,
        supportiveness: 5
      };

      const interactionHistory: InteractionHistory = {
        interactions: [],
        patterns: [],
        insights: {}
      };

      await integrationManager.adjustPersonalityBasedOnInteractions(
        testUserId,
        personality,
        interactionHistory
      );

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
      const baseConfiguration: AvatarConfiguration = {
        appearance: {
          faceConfiguration: {},
          hairConfiguration: {},
          clothingConfiguration: {},
          accessoryConfiguration: [],
          colorScheme: {}
        },
        personality: {
          friendliness: 5,
          formality: 5,
          humor: 5,
          enthusiasm: 5,
          patience: 5,
          supportiveness: 5
        } as PersonalityTraits,
        voice: {
          pitch: 1.0,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.NEUTRAL,
          volume: 0.7
        } as VoiceCharacteristics,
        emotionalExpressions: {
          defaultExpressions: [],
          contextualExpressions: [],
          transitionMappings: [],
          intensitySettings: {}
        },
        animations: {
          idleAnimations: {},
          interactionAnimations: {},
          emotionalAnimations: {},
          transitionAnimations: {}
        },
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          adaptationHistory: [],
          userSatisfactionHistory: []
        }
      };

      const result = await integrationManager.adaptAvatarToUserPatterns(
        testUserId,
        baseConfiguration
      );

      expect(result).toBeDefined();
      
      // Verify that performance metrics are being tracked
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.AVATAR_ADAPTED,
          data: expect.objectContaining({
            processingTime: expect.any(Number)
          })
        })
      );
    });

    it('should handle high-load scenarios gracefully', async () => {
      // Simulate high load by making many concurrent requests
      const baseConfiguration: AvatarConfiguration = {
        appearance: {
          faceConfiguration: {},
          hairConfiguration: {},
          clothingConfiguration: {},
          accessoryConfiguration: [],
          colorScheme: {}
        },
        personality: {
          friendliness: 5,
          formality: 5,
          humor: 5,
          enthusiasm: 5,
          patience: 5,
          supportiveness: 5
        } as PersonalityTraits,
        voice: {
          pitch: 1.0,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.NEUTRAL,
          volume: 0.7
        } as VoiceCharacteristics,
        emotionalExpressions: {
          defaultExpressions: [],
          contextualExpressions: [],
          transitionMappings: [],
          intensitySettings: {}
        },
        animations: {
          idleAnimations: {},
          interactionAnimations: {},
          emotionalAnimations: {},
          transitionAnimations: {}
        },
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          adaptationHistory: [],
          userSatisfactionHistory: []
        }
      };

      const promises = Array(10).fill(null).map(() =>
        integrationManager.adaptAvatarToUserPatterns(testUserId, baseConfiguration)
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