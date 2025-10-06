// Unit Tests for Avatar State Synchronization System

import {
  AvatarStateSynchronizationManager,
  VoiceInteractionContext,
  VoiceInteractionPhase,
  EmotionalContext,
  ConversationAnalysis,
  EnvironmentalFactors,
  EmotionTrend,
  EngagementLevel,
  ConversationFlow,
  PrivacyLevel,
  TimeOfDay,
  ProximityLevel,
  DeviceOrientation,
  LightingCondition,
  AnimationType,
  AnimationTrigger,
  AnimationPriority,
  AnimationBlendMode,
  ContextAwareBehavior,
  TriggerType,
  ConditionType,
  ActionType,
  ComparisonOperator
} from './avatar-state-synchronization';

import { EmotionType, VoiceCharacteristics } from './types';

describe('AvatarStateSynchronizationManager', () => {
  let manager: AvatarStateSynchronizationManager;
  let mockUserId: string;
  let mockContext: VoiceInteractionContext;

  beforeEach(async () => {
    manager = new AvatarStateSynchronizationManager();
    await manager.initialize();
    
    mockUserId = 'test-user-123';
    mockContext = createMockVoiceInteractionContext();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newManager = new AvatarStateSynchronizationManager();
      await expect(newManager.initialize()).resolves.not.toThrow();
      await newManager.cleanup();
    });

    it('should not reinitialize if already initialized', async () => {
      // Manager is already initialized in beforeEach
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Avatar State Management for Voice Context', () => {
    it('should create default avatar state for new user', async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
      
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state).toBeDefined();
      expect(state?.userId).toBe(mockUserId);
      expect(state?.currentEmotion).toBe(EmotionType.NEUTRAL);
      expect(state?.isIdle).toBe(true);
    });

    it('should update avatar state based on voice interaction phase', async () => {
      // Initial state
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
      
      // Update to listening phase
      const listeningContext = {
        ...mockContext,
        currentPhase: VoiceInteractionPhase.LISTENING
      };
      
      await manager.updateAvatarStateForVoiceContext(mockUserId, listeningContext);
      
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.isListening).toBe(true);
      expect(state?.isIdle).toBe(false);
    });

    it('should update avatar state based on emotional context changes', async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
      
      // Update with happy emotion
      const happyContext = {
        ...mockContext,
        emotionalContext: {
          ...mockContext.emotionalContext,
          detectedEmotion: EmotionType.HAPPY,
          emotionIntensity: 0.8
        }
      };
      
      await manager.updateAvatarStateForVoiceContext(mockUserId, happyContext);
      
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.currentEmotion).toBe(EmotionType.HAPPY);
      expect(state?.emotionIntensity).toBe(0.8);
    });

    it('should maintain state history', async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
      
      // Make multiple state changes
      const contexts = [
        { ...mockContext, currentPhase: VoiceInteractionPhase.LISTENING },
        { ...mockContext, currentPhase: VoiceInteractionPhase.PROCESSING },
        { ...mockContext, currentPhase: VoiceInteractionPhase.RESPONDING }
      ];
      
      for (const context of contexts) {
        await manager.updateAvatarStateForVoiceContext(mockUserId, context);
      }
      
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.stateHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Emotional Expression Triggers', () => {
    beforeEach(async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
    });

    it('should trigger emotional expression based on conversation analysis', async () => {
      const conversationAnalysis: ConversationAnalysis = createMockConversationAnalysis();
      const emotionalContext: EmotionalContext = {
        detectedEmotion: EmotionType.EXCITED,
        emotionConfidence: 0.9,
        emotionIntensity: 0.8,
        emotionTrend: EmotionTrend.INCREASING,
        contextualFactors: ['positive_feedback']
      };

      await manager.triggerEmotionalExpression(
        mockUserId,
        conversationAnalysis,
        emotionalContext
      );

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.currentEmotion).toBe(EmotionType.EXCITED);
      expect(state?.emotionIntensity).toBe(0.8);
      expect(state?.animationQueue.length).toBeGreaterThan(0);
    });

    it('should adjust emotion based on personality traits', async () => {
      // Set high supportiveness personality
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      if (state) {
        state.personalityContext.supportiveness = 9;
      }

      const conversationAnalysis: ConversationAnalysis = createMockConversationAnalysis();
      const emotionalContext: EmotionalContext = {
        detectedEmotion: EmotionType.SAD,
        emotionConfidence: 0.8,
        emotionIntensity: 0.7,
        emotionTrend: EmotionTrend.STABLE,
        contextualFactors: ['user_distress']
      };

      await manager.triggerEmotionalExpression(
        mockUserId,
        conversationAnalysis,
        emotionalContext
      );

      const updatedState = manager.getAvatarVoiceInteractionState(mockUserId);
      // High supportiveness should maintain neutral supportive emotion
      expect(updatedState?.currentEmotion).toBe(EmotionType.NEUTRAL);
    });

    it('should handle emotion transition calculations', async () => {
      const conversationAnalysis: ConversationAnalysis = createMockConversationAnalysis();
      const emotionalContext: EmotionalContext = {
        detectedEmotion: EmotionType.HAPPY,
        emotionConfidence: 0.9,
        emotionIntensity: 1.0, // High intensity
        emotionTrend: EmotionTrend.INCREASING,
        contextualFactors: ['celebration']
      };

      await manager.triggerEmotionalExpression(
        mockUserId,
        conversationAnalysis,
        emotionalContext
      );

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      const animation = state?.animationQueue.find(a => a.type === AnimationType.EMOTIONAL_EXPRESSION);
      
      expect(animation).toBeDefined();
      expect(animation?.intensity).toBe(1.0);
      expect(animation?.priority).toBe(AnimationPriority.HIGH);
    });
  });

  describe('Speech Synthesis Coordination', () => {
    beforeEach(async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
    });

    it('should coordinate avatar animation with speech synthesis', async () => {
      const speechData = {
        text: 'Hello there! How are you doing today?',
        voiceCharacteristics: createMockVoiceCharacteristics(),
        emotion: EmotionType.HAPPY,
        duration: 3000
      };

      const speechId = await manager.coordinateWithSpeechSynthesis(mockUserId, speechData);

      expect(speechId).toBeDefined();
      expect(speechId).toMatch(/^speech_/);

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.isSpeaking).toBe(true);
      expect(state?.animationQueue.length).toBeGreaterThan(0);
      
      const speakingAnimation = state?.animationQueue.find(a => a.type === AnimationType.SPEAKING);
      expect(speakingAnimation).toBeDefined();
    });

    it('should generate appropriate animation sequence for speech', async () => {
      const speechData = {
        text: 'This is a longer sentence with multiple words that should generate emphasis points.',
        voiceCharacteristics: createMockVoiceCharacteristics(),
        emotion: EmotionType.EXCITED,
        duration: 5000
      };

      const speechId = await manager.coordinateWithSpeechSynthesis(mockUserId, speechData);

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      const animations = state?.animationQueue || [];
      
      // Should have speaking animation
      expect(animations.some(a => a.type === AnimationType.SPEAKING)).toBe(true);
      
      // Should have emotional expression for excited emotion
      expect(animations.some(a => a.type === AnimationType.EMOTIONAL_EXPRESSION)).toBe(true);
      
      // Should have gesture animations for emphasis
      expect(animations.some(a => a.type === AnimationType.GESTURE)).toBe(true);
    });

    it('should handle speech coordination errors gracefully', async () => {
      const speechData = {
        text: '',
        voiceCharacteristics: createMockVoiceCharacteristics(),
        emotion: EmotionType.NEUTRAL,
        duration: 0
      };

      await expect(
        manager.coordinateWithSpeechSynthesis(mockUserId, speechData)
      ).rejects.toThrow();
    });
  });

  describe('Context-Aware Behavior', () => {
    beforeEach(async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
    });

    it('should register and apply context-aware behavior', async () => {
      const behavior: ContextAwareBehavior = {
        behaviorId: 'test-behavior',
        triggers: [{
          type: TriggerType.EMOTION_CHANGE,
          condition: 'emotion_not_neutral'
        }],
        conditions: [{
          type: ConditionType.EMOTION_LEVEL,
          parameter: 'intensity',
          operator: ComparisonOperator.GREATER_THAN,
          value: 0.5
        }],
        actions: [{
          type: ActionType.TRIGGER_ANIMATION,
          parameters: {
            animationType: AnimationType.GESTURE,
            intensity: 0.7
          }
        }],
        priority: 1,
        isActive: true
      };

      await manager.registerContextAwareBehavior(mockUserId, behavior);

      // Trigger the behavior by changing emotion
      const emotionalContext: EmotionalContext = {
        detectedEmotion: EmotionType.HAPPY,
        emotionConfidence: 0.9,
        emotionIntensity: 0.8,
        emotionTrend: EmotionTrend.STABLE,
        contextualFactors: []
      };

      const conversationAnalysis = createMockConversationAnalysis();
      await manager.triggerEmotionalExpression(mockUserId, conversationAnalysis, emotionalContext);

      // Apply context-aware behavior
      await manager.applyContextAwareBehavior(mockUserId, mockContext);

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.animationQueue.length).toBeGreaterThan(0);
    });

    it('should validate behavior configuration', async () => {
      const invalidBehavior: ContextAwareBehavior = {
        behaviorId: '', // Invalid empty ID
        triggers: [],
        conditions: [],
        actions: [],
        priority: 1,
        isActive: true
      };

      await expect(
        manager.registerContextAwareBehavior(mockUserId, invalidBehavior)
      ).rejects.toThrow('Behavior must have a valid ID');
    });

    it('should respect behavior cooldown periods', async () => {
      const behavior: ContextAwareBehavior = {
        behaviorId: 'cooldown-behavior',
        triggers: [{
          type: TriggerType.EMOTION_CHANGE,
          condition: 'any'
        }],
        conditions: [],
        actions: [{
          type: ActionType.CHANGE_EMOTION,
          parameters: {
            emotion: EmotionType.HAPPY,
            intensity: 0.5
          }
        }],
        priority: 1,
        isActive: true,
        cooldownPeriod: 5000, // 5 seconds
        lastTriggered: new Date() // Just triggered
      };

      await manager.registerContextAwareBehavior(mockUserId, behavior);
      await manager.applyContextAwareBehavior(mockUserId, mockContext);

      // Should not trigger due to cooldown
      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.currentEmotion).not.toBe(EmotionType.HAPPY);
    });
  });

  describe('Animation Queue Management', () => {
    beforeEach(async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
    });

    it('should process animation queue with priority ordering', async () => {
      const speechData = {
        text: 'Test speech',
        voiceCharacteristics: createMockVoiceCharacteristics(),
        emotion: EmotionType.HAPPY,
        duration: 2000
      };

      await manager.coordinateWithSpeechSynthesis(mockUserId, speechData);

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      const animations = state?.animationQueue || [];
      
      // Animations should be sorted by priority (highest first)
      for (let i = 0; i < animations.length - 1; i++) {
        expect(animations[i].priority).toBeGreaterThanOrEqual(animations[i + 1].priority);
      }
    });

    it('should limit animation queue size', async () => {
      // Add many animations to test queue limit
      for (let i = 0; i < 15; i++) {
        const speechData = {
          text: `Test speech ${i}`,
          voiceCharacteristics: createMockVoiceCharacteristics(),
          emotion: EmotionType.NEUTRAL,
          duration: 1000
        };
        await manager.coordinateWithSpeechSynthesis(mockUserId, speechData);
      }

      const state = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(state?.animationQueue.length).toBeLessThanOrEqual(10);
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should handle missing user state gracefully', () => {
      const nonExistentUserId = 'non-existent-user';
      const state = manager.getAvatarVoiceInteractionState(nonExistentUserId);
      expect(state).toBeUndefined();
    });

    it('should maintain state consistency across updates', async () => {
      await manager.updateAvatarStateForVoiceContext(mockUserId, mockContext);
      
      const initialState = manager.getAvatarVoiceInteractionState(mockUserId);
      const initialTimestamp = initialState?.lastStateChange;

      // Wait a bit and update again
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedContext = {
        ...mockContext,
        currentPhase: VoiceInteractionPhase.LISTENING
      };
      
      await manager.updateAvatarStateForVoiceContext(mockUserId, updatedContext);
      
      const updatedState = manager.getAvatarVoiceInteractionState(mockUserId);
      expect(updatedState?.lastStateChange.getTime()).toBeGreaterThan(initialTimestamp?.getTime() || 0);
      expect(updatedState?.userId).toBe(mockUserId);
    });
  });

  describe('Error Handling', () => {
    it('should handle emotional expression trigger errors', async () => {
      const invalidUserId = 'invalid-user';
      const conversationAnalysis = createMockConversationAnalysis();
      const emotionalContext: EmotionalContext = {
        detectedEmotion: EmotionType.HAPPY,
        emotionConfidence: 0.8,
        emotionIntensity: 0.7,
        emotionTrend: EmotionTrend.STABLE,
        contextualFactors: []
      };

      // Should not throw but should handle gracefully
      await expect(
        manager.triggerEmotionalExpression(invalidUserId, conversationAnalysis, emotionalContext)
      ).resolves.not.toThrow();
    });

    it('should handle speech coordination errors', async () => {
      const invalidUserId = 'invalid-user';
      const speechData = {
        text: 'Test',
        voiceCharacteristics: createMockVoiceCharacteristics(),
        emotion: EmotionType.NEUTRAL,
        duration: 1000
      };

      await expect(
        manager.coordinateWithSpeechSynthesis(invalidUserId, speechData)
      ).rejects.toThrow();
    });
  });

  // Helper functions
  function createMockVoiceInteractionContext(): VoiceInteractionContext {
    return {
      userId: mockUserId,
      conversationId: 'conv-123',
      sessionId: 'session-123',
      isActive: true,
      currentPhase: VoiceInteractionPhase.IDLE,
      emotionalContext: {
        detectedEmotion: EmotionType.NEUTRAL,
        emotionConfidence: 0.8,
        emotionIntensity: 0.5,
        emotionTrend: EmotionTrend.STABLE,
        contextualFactors: []
      },
      conversationAnalysis: createMockConversationAnalysis(),
      environmentalFactors: {
        noiseLevel: 0.3,
        privacyLevel: PrivacyLevel.PRIVATE,
        timeOfDay: TimeOfDay.AFTERNOON,
        userProximity: ProximityLevel.MODERATE,
        deviceOrientation: DeviceOrientation.PORTRAIT,
        ambientLighting: LightingCondition.NORMAL
      },
      timestamp: new Date()
    };
  }

  function createMockConversationAnalysis(): ConversationAnalysis {
    return {
      sentiment: {
        polarity: 0.2,
        subjectivity: 0.5,
        confidence: 0.8,
        keywords: ['hello', 'good', 'day']
      },
      topics: ['greeting', 'weather'],
      userEngagement: EngagementLevel.MODERATE,
      conversationFlow: ConversationFlow.NATURAL,
      speechPatterns: {
        speechRate: 1.0,
        pauseFrequency: 0.3,
        volumeVariation: 0.2,
        pitchVariation: 0.4,
        emotionalMarkers: ['enthusiasm']
      },
      contextualCues: []
    };
  }

  function createMockVoiceCharacteristics(): VoiceCharacteristics {
    return {
      pitch: 0.1,
      speed: 1.0,
      accent: 'neutral' as any,
      emotionalTone: 'calm' as any,
      volume: 0.8
    };
  }
});