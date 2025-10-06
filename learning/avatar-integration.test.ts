// Avatar System Integration Tests

import {
  AvatarSystemIntegrationImpl,
  PersonalizedPersonality,
  OptimizedExpression,
  PersonalizedAnimation,
  PersonalizedVoice,
  ExpressionContext,
  AnimationType,
  AdaptationReason,
  TriggerType,
  InteractionType,
  InteractionOutcome
} from './avatar-integration';

import {
  PersonalityTraits,
  VoiceCharacteristics,
  EmotionType,
  EmotionalTone,
  AccentType
} from '../avatar/types';

import {
  UserFeedback,
  FeedbackType,
  EmotionalResponse,
  FeedbackSource
} from './types';

import { LearningEventBus, LearningEventType } from './events';
import { TrainingError } from './errors';

// Mock event bus for testing
class MockEventBus implements LearningEventBus {
  private events: any[] = [];
  private subscriptions: Map<string, any> = new Map();

  async emit(event: any): Promise<void> {
    this.events.push(event);
  }

  async subscribe(eventType: LearningEventType, handler: any): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(subscriptionId, { eventType, handler });
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  async getEventHistory(eventType?: LearningEventType, userId?: string): Promise<any[]> {
    return this.events.filter(event => {
      if (eventType && event.type !== eventType) return false;
      if (userId && event.data?.userId !== userId) return false;
      return true;
    });
  }

  async clearEventHistory(userId?: string): Promise<void> {
    if (userId) {
      this.events = this.events.filter(event => event.data?.userId !== userId);
    } else {
      this.events = [];
    }
  }

  getEvents(): any[] {
    return this.events;
  }

  clearEvents(): void {
    this.events = [];
  }

  // Mock implementations for other EventBus methods
  on(): void {}
  off(): void {}
  removeAllListeners(): void {}
  onPerformanceWarning(): void {}
  onSafetyViolation(): void {}
  onSystemError(): void {}
  onSystemRecovery(): void {}
  emitPerformanceWarning(): void {}
  emitSafetyViolation(): void {}
  emitSystemError(): void {}
  emitSystemRecovery(): void {}
}

describe('AvatarSystemIntegration', () => {
  let avatarIntegration: AvatarSystemIntegrationImpl;
  let mockEventBus: MockEventBus;

  const mockBasePersonality: PersonalityTraits = {
    friendliness: 7,
    formality: 5,
    humor: 6,
    enthusiasm: 8,
    patience: 7,
    supportiveness: 8
  };

  const mockBaseVoice: VoiceCharacteristics = {
    pitch: 0.0,
    speed: 1.0,
    accent: AccentType.NEUTRAL,
    emotionalTone: EmotionalTone.CHEERFUL,
    volume: 0.8
  };

  const mockExpressionContext: ExpressionContext = {
    userId: 'test-user-123',
    conversationContext: {
      topicCategory: 'general',
      conversationLength: 5,
      userEngagement: 0.8,
      previousExpressions: [],
      communicationStyle: {
        formality: 0.5,
        enthusiasm: 0.7,
        patience: 0.8,
        supportiveness: 0.9
      }
    },
    emotionalState: {
      currentEmotion: EmotionType.HAPPY,
      intensity: 0.7,
      stability: 0.8,
      recentChanges: []
    },
    interactionHistory: [],
    environmentalFactors: {
      timeOfDay: 'morning',
      socialContext: {
        presentUsers: ['test-user-123'],
        familyMembers: [],
        guestPresent: false,
        socialActivity: 'alone' as any
      },
      deviceType: 'smart_display',
      ambientConditions: {
        lighting: 'natural',
        noiseLevel: 0.3,
        temperature: 22,
        socialPresence: false
      }
    }
  };

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    avatarIntegration = new AvatarSystemIntegrationImpl(mockEventBus);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await avatarIntegration.initialize();
      
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.SYSTEM_STARTED);
      expect(events[0].data.component).toBe('AvatarSystemIntegration');
    });

    it('should not initialize twice', async () => {
      await avatarIntegration.initialize();
      await avatarIntegration.initialize(); // Second call should not emit event
      
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
    });

    it('should throw error if initialization fails', async () => {
      // Mock a failure scenario by overriding a method
      const originalMethod = (avatarIntegration as any).loadCachedAdaptations;
      (avatarIntegration as any).loadCachedAdaptations = jest.fn().mockRejectedValue(new Error('Cache load failed'));

      await expect(avatarIntegration.initialize()).rejects.toThrow(TrainingError);
      
      // Restore original method
      (avatarIntegration as any).loadCachedAdaptations = originalMethod;
    });
  });

  describe('Personality Adaptation', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should adapt personality based on user patterns', async () => {
      const result = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.traits).toBeDefined();
      expect(result.adaptations).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeInstanceOf(Array);
      expect(result.version).toBeDefined();
      expect(result.lastUpdated).toBeInstanceOf(Date);

      // Verify event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.PERSONALIZATION_APPLIED);
      expect(events[0].data.component).toBe('personality_adaptation');
    });

    it('should return cached personality if valid', async () => {
      // First call
      const result1 = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');
      mockEventBus.clearEvents();

      // Second call should use cache
      const result2 = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');

      expect(result1.version).toBe(result2.version);
      expect(result1.lastUpdated).toEqual(result2.lastUpdated);

      // Should not emit new personalization event for cached result
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(0);
    });

    it('should handle errors gracefully and return fallback personality', async () => {
      // Mock an error in pattern loading
      const originalMethod = (avatarIntegration as any).loadUserInteractionPatterns;
      (avatarIntegration as any).loadUserInteractionPatterns = jest.fn().mockRejectedValue(new Error('Pattern load failed'));

      const result = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');

      expect(result.traits).toEqual(mockBasePersonality);
      expect(result.adaptations).toHaveLength(0);
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('Using base personality due to adaptation error');
      expect(result.version).toBe('fallback');

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.ERROR);

      // Restore original method
      (avatarIntegration as any).loadUserInteractionPatterns = originalMethod;
    });

    it('should throw error if not initialized', async () => {
      const uninitializedIntegration = new AvatarSystemIntegrationImpl(mockEventBus);

      await expect(
        uninitializedIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123')
      ).rejects.toThrow(TrainingError);
    });
  });

  describe('Expression Optimization', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should optimize expressions based on context', async () => {
      const result = await avatarIntegration.optimizeExpressions(mockExpressionContext, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.emotionType).toBeDefined();
      expect(Object.values(EmotionType)).toContain(result.emotionType);
      expect(result.intensity).toBeGreaterThanOrEqual(0);
      expect(result.intensity).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timing).toBeDefined();
      expect(result.timing.delay).toBeGreaterThanOrEqual(0);
      expect(result.timing.fadeIn).toBeGreaterThan(0);
      expect(result.timing.hold).toBeGreaterThan(0);
      expect(result.timing.fadeOut).toBeGreaterThan(0);
      expect(result.contextFactors).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Verify event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.OPTIMIZATION_COMPLETED);
      expect(events[0].data.component).toBe('expression_optimization');
    });

    it('should handle different emotional contexts appropriately', async () => {
      const sadContext = {
        ...mockExpressionContext,
        emotionalState: {
          ...mockExpressionContext.emotionalState,
          currentEmotion: EmotionType.SAD,
          intensity: 0.8
        }
      };

      const result = await avatarIntegration.optimizeExpressions(sadContext, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.emotionType).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return fallback expression on error', async () => {
      // Mock an error in expression pattern loading
      const originalMethod = (avatarIntegration as any).loadExpressionPatterns;
      (avatarIntegration as any).loadExpressionPatterns = jest.fn().mockRejectedValue(new Error('Expression load failed'));

      const result = await avatarIntegration.optimizeExpressions(mockExpressionContext, 'test-user-123');

      expect(result.emotionType).toBe(EmotionType.NEUTRAL);
      expect(result.intensity).toBe(0.5);
      expect(result.duration).toBe(2000);
      expect(result.confidence).toBe(0.3);

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.ERROR);

      // Restore original method
      (avatarIntegration as any).loadExpressionPatterns = originalMethod;
    });
  });

  describe('Animation Personalization', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should personalize animations based on user preferences', async () => {
      const result = await avatarIntegration.personalizeAnimations(AnimationType.GREETING, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.animationId).toBeDefined();
      expect(result.animationId).toContain('greeting');
      expect(result.animationId).toContain('test-user-123');
      expect(result.parameters).toBeDefined();
      expect(result.parameters.speed).toBeGreaterThan(0);
      expect(result.parameters.intensity).toBeGreaterThanOrEqual(0);
      expect(result.parameters.intensity).toBeLessThanOrEqual(1);
      expect(result.parameters.variation).toBeGreaterThanOrEqual(0);
      expect(result.parameters.variation).toBeLessThanOrEqual(1);
      expect(result.parameters.smoothness).toBeGreaterThanOrEqual(0);
      expect(result.parameters.smoothness).toBeLessThanOrEqual(1);
      expect(result.timing).toBeDefined();
      expect(result.timing.duration).toBeGreaterThan(0);
      expect(result.contextualTriggers).toBeInstanceOf(Array);
      expect(result.userPreferenceScore).toBeGreaterThanOrEqual(0);
      expect(result.userPreferenceScore).toBeLessThanOrEqual(1);

      // Verify event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.PERSONALIZATION_APPLIED);
      expect(events[0].data.component).toBe('animation_personalization');
    });

    it('should handle different animation types', async () => {
      const animationTypes = [
        AnimationType.IDLE,
        AnimationType.TALKING,
        AnimationType.LISTENING,
        AnimationType.THINKING,
        AnimationType.CELEBRATION
      ];

      for (const animationType of animationTypes) {
        const result = await avatarIntegration.personalizeAnimations(animationType, 'test-user-123');
        expect(result.animationId).toContain(animationType);
        expect(result.parameters).toBeDefined();
        expect(result.timing).toBeDefined();
      }
    });

    it('should return cached animation if valid', async () => {
      // First call
      const result1 = await avatarIntegration.personalizeAnimations(AnimationType.GREETING, 'test-user-123');
      mockEventBus.clearEvents();

      // Second call should use cache
      const result2 = await avatarIntegration.personalizeAnimations(AnimationType.GREETING, 'test-user-123');

      expect(result1.animationId).toBe(result2.animationId);
      expect(result1.parameters).toEqual(result2.parameters);

      // Should not emit new personalization event for cached result
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(0);
    });

    it('should return fallback animation on error', async () => {
      // Mock an error in animation pattern loading
      const originalMethod = (avatarIntegration as any).loadAnimationPatterns;
      (avatarIntegration as any).loadAnimationPatterns = jest.fn().mockRejectedValue(new Error('Animation load failed'));

      const result = await avatarIntegration.personalizeAnimations(AnimationType.GREETING, 'test-user-123');

      expect(result.animationId).toContain('fallback');
      expect(result.parameters.speed).toBe(1.0);
      expect(result.parameters.intensity).toBe(0.7);
      expect(result.userPreferenceScore).toBe(0.5);

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.ERROR);

      // Restore original method
      (avatarIntegration as any).loadAnimationPatterns = originalMethod;
    });
  });

  describe('Voice Characteristics Adaptation', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should adapt voice characteristics based on user feedback', async () => {
      const result = await avatarIntegration.adaptVoiceCharacteristics(mockBaseVoice, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.characteristics).toBeDefined();
      expect(result.characteristics.pitch).toBeGreaterThanOrEqual(-2.0);
      expect(result.characteristics.pitch).toBeLessThanOrEqual(2.0);
      expect(result.characteristics.speed).toBeGreaterThanOrEqual(0.5);
      expect(result.characteristics.speed).toBeLessThanOrEqual(2.0);
      expect(result.characteristics.volume).toBeGreaterThanOrEqual(0.0);
      expect(result.characteristics.volume).toBeLessThanOrEqual(1.0);
      expect(Object.values(AccentType)).toContain(result.characteristics.accent);
      expect(Object.values(EmotionalTone)).toContain(result.characteristics.emotionalTone);
      expect(result.adaptations).toBeInstanceOf(Array);
      expect(result.emotionalMapping).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.contextualVariations).toBeInstanceOf(Array);

      // Verify event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.PERSONALIZATION_APPLIED);
      expect(events[0].data.component).toBe('voice_adaptation');
    });

    it('should preserve voice characteristics within safe ranges', async () => {
      const extremeVoice: VoiceCharacteristics = {
        pitch: 2.0,
        speed: 2.0,
        accent: AccentType.BRITISH,
        emotionalTone: EmotionalTone.ENERGETIC,
        volume: 1.0
      };

      const result = await avatarIntegration.adaptVoiceCharacteristics(extremeVoice, 'test-user-123');

      // Should maintain safe ranges
      expect(result.characteristics.pitch).toBeGreaterThanOrEqual(-2.0);
      expect(result.characteristics.pitch).toBeLessThanOrEqual(2.0);
      expect(result.characteristics.speed).toBeGreaterThanOrEqual(0.5);
      expect(result.characteristics.speed).toBeLessThanOrEqual(2.0);
      expect(result.characteristics.volume).toBeGreaterThanOrEqual(0.0);
      expect(result.characteristics.volume).toBeLessThanOrEqual(1.0);
    });

    it('should return cached voice adaptation if valid', async () => {
      // First call
      const result1 = await avatarIntegration.adaptVoiceCharacteristics(mockBaseVoice, 'test-user-123');
      mockEventBus.clearEvents();

      // Second call should use cache
      const result2 = await avatarIntegration.adaptVoiceCharacteristics(mockBaseVoice, 'test-user-123');

      expect(result1.characteristics).toEqual(result2.characteristics);
      expect(result1.confidence).toBe(result2.confidence);

      // Should not emit new personalization event for cached result
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(0);
    });

    it('should return fallback voice on error', async () => {
      // Mock an error in voice pattern loading
      const originalMethod = (avatarIntegration as any).loadVoicePatterns;
      (avatarIntegration as any).loadVoicePatterns = jest.fn().mockRejectedValue(new Error('Voice load failed'));

      const result = await avatarIntegration.adaptVoiceCharacteristics(mockBaseVoice, 'test-user-123');

      expect(result.characteristics).toEqual(mockBaseVoice);
      expect(result.adaptations).toHaveLength(0);
      expect(result.emotionalMapping).toHaveLength(0);
      expect(result.confidence).toBe(0.5);
      expect(result.contextualVariations).toHaveLength(0);

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(LearningEventType.ERROR);

      // Restore original method
      (avatarIntegration as any).loadVoicePatterns = originalMethod;
    });
  });

  describe('Child Safety Validation', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should validate child safety for personality adaptations', async () => {
      // Test with a child user ID (simulated)
      const childUserId = 'child-user-456';
      
      const result = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, childUserId);

      expect(result).toBeDefined();
      expect(result.traits.friendliness).toBeGreaterThanOrEqual(5); // Should maintain high friendliness for children
      expect(result.traits.supportiveness).toBeGreaterThanOrEqual(5); // Should maintain high supportiveness for children
    });

    it('should validate child safety for voice adaptations', async () => {
      const childUserId = 'child-user-456';
      
      const result = await avatarIntegration.adaptVoiceCharacteristics(mockBaseVoice, childUserId);

      expect(result).toBeDefined();
      expect(result.characteristics.volume).toBeLessThanOrEqual(0.9); // Should not be too loud for children
      expect(result.characteristics.speed).toBeLessThanOrEqual(1.5); // Should not be too fast for children
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should complete personality adaptation within performance constraints', async () => {
      const startTime = performance.now();
      
      await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms for real-time constraints)
      expect(processingTime).toBeLessThan(100);
    });

    it('should complete expression optimization within performance constraints', async () => {
      const startTime = performance.now();
      
      await avatarIntegration.optimizeExpressions(mockExpressionContext, 'test-user-123');
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(100);
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const promises = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(avatarIntegration.adaptAvatarPersonality(mockBasePersonality, `user-${i}`));
        promises.push(avatarIntegration.optimizeExpressions(mockExpressionContext, `user-${i}`));
        promises.push(avatarIntegration.personalizeAnimations(AnimationType.GREETING, `user-${i}`));
      }
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      expect(results).toHaveLength(15); // 5 users × 3 operations each
      expect(endTime - startTime).toBeLessThan(500); // Should handle concurrent requests efficiently
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await avatarIntegration.initialize();
      mockEventBus.clearEvents();
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock a timeout scenario
      const originalMethod = (avatarIntegration as any).loadUserPreferences;
      (avatarIntegration as any).loadUserPreferences = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 50))
      );

      const result = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.version).toBe('fallback');

      // Restore original method
      (avatarIntegration as any).loadUserPreferences = originalMethod;
    });

    it('should handle corrupted data gracefully', async () => {
      // Mock corrupted data scenario
      const originalMethod = (avatarIntegration as any).loadUserInteractionPatterns;
      (avatarIntegration as any).loadUserInteractionPatterns = jest.fn().mockResolvedValue(null);

      const result = await avatarIntegration.adaptAvatarPersonality(mockBasePersonality, 'test-user-123');

      expect(result).toBeDefined();
      expect(result.traits).toEqual(mockBasePersonality);

      // Restore original method
      (avatarIntegration as any).loadUserInteractionPatterns = originalMethod;
    });

    it('should maintain system stability under memory pressure', async () => {
      // Simulate memory pressure by creating many cache entries
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(avatarIntegration.adaptAvatarPersonality(mockBasePersonality, `stress-user-${i}`));
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.traits).toBeDefined();
      });
    });
  });
});