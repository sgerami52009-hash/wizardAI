// Comprehensive Tests for Personality and Emotional Expression System

import { 
  PersonalityTraits, 
  EmotionType, 
  InteractionContext, 
  ResponseStyle,
  VoiceCharacteristics,
  AccentType,
  EmotionalTone,
  AgeRange
} from './types';
import { PersonalityManagerImpl } from './personality-manager';
import { EmotionalExpressionSystem } from './emotional-expression';
import { PersonalityVoiceIntegration } from './personality-voice-integration';

describe('Personality Management System', () => {
  let personalityManager: PersonalityManagerImpl;
  let emotionalSystem: EmotionalExpressionSystem;
  let voiceIntegration: PersonalityVoiceIntegration;

  beforeEach(() => {
    personalityManager = new PersonalityManagerImpl();
    emotionalSystem = new EmotionalExpressionSystem();
    voiceIntegration = new PersonalityVoiceIntegration();
  });

  describe('PersonalityManager', () => {
    describe('updatePersonality', () => {
      it('should validate and accept valid personality traits', async () => {
        const validTraits: PersonalityTraits = {
          friendliness: 8,
          formality: 3,
          humor: 7,
          enthusiasm: 9,
          patience: 6,
          supportiveness: 8
        };

        const result = await personalityManager.updatePersonality(validTraits);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject personality traits with invalid values', async () => {
        const invalidTraits: PersonalityTraits = {
          friendliness: 15, // Invalid: > 10
          formality: -2,    // Invalid: < 1
          humor: 5,
          enthusiasm: 7,
          patience: 8,
          supportiveness: 6
        };

        const result = await personalityManager.updatePersonality(invalidTraits);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should normalize personality traits to valid ranges', async () => {
        const traits: PersonalityTraits = {
          friendliness: 10.7, // Should be normalized to 10
          formality: 0.3,     // Should be normalized to 1
          humor: 5.8,         // Should be normalized to 6
          enthusiasm: 7,
          patience: 8,
          supportiveness: 9
        };

        const result = await personalityManager.updatePersonality(traits);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validatePersonalityTraits', () => {
      it('should allow appropriate traits for children', async () => {
        const childTraits: PersonalityTraits = {
          friendliness: 9,
          formality: 2,
          humor: 8,
          enthusiasm: 9,
          patience: 8,
          supportiveness: 10
        };

        const result = await personalityManager.validatePersonalityTraits(childTraits, 8);
        
        // Debug output
        if (!result.isAllowed) {
          console.log('Validation failed:', result);
        }
        
        expect(result.isAllowed).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.riskLevel).toBe('low');
      });

      it('should flag inappropriate traits for children', async () => {
        const inappropriateTraits: PersonalityTraits = {
          friendliness: 3, // Too low for children
          formality: 9,    // Too high for children
          humor: 1,        // Too low for children
          enthusiasm: 4,   // Too low for children
          patience: 5,     // Too low for children
          supportiveness: 4 // Too low for children
        };

        const result = await personalityManager.validatePersonalityTraits(inappropriateTraits, 7);
        
        expect(result.isAllowed).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.requiresParentalApproval).toBe(true);
      });

      it('should allow more flexibility for adults', async () => {
        const adultTraits: PersonalityTraits = {
          friendliness: 3,
          formality: 9,
          humor: 2,
          enthusiasm: 4,
          patience: 5,
          supportiveness: 6
        };

        const result = await personalityManager.validatePersonalityTraits(adultTraits, 25);
        
        expect(result.isAllowed).toBe(true);
        expect(result.violations).toHaveLength(0);
      });
    });

    describe('generateResponseStyle', () => {
      it('should generate appropriate response style for friendly personality', () => {
        const friendlyTraits: PersonalityTraits = {
          friendliness: 9,
          formality: 2,
          humor: 8,
          enthusiasm: 8,
          patience: 7,
          supportiveness: 9
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'happy',
          recentTopics: ['play', 'games']
        };

        const style = personalityManager.generateResponseStyle(friendlyTraits, context);
        
        expect(style.formality).toBeLessThan(0.5); // Should be informal
        expect(style.enthusiasm).toBeGreaterThan(0.6); // Should be enthusiastic
        expect(style.wordChoice).toBe('simple'); // Should use simple words
      });

      it('should generate formal response style for professional personality', () => {
        const professionalTraits: PersonalityTraits = {
          friendliness: 6,
          formality: 9,
          humor: 3,
          enthusiasm: 5,
          patience: 8,
          supportiveness: 7
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'neutral',
          recentTopics: ['work', 'business']
        };

        const style = personalityManager.generateResponseStyle(professionalTraits, context);
        
        expect(style.formality).toBeGreaterThan(0.7); // Should be formal
        expect(style.wordChoice).toBe('advanced'); // Should use advanced vocabulary
      });
    });

    describe('getPersonalityPresets', () => {
      it('should return age-appropriate presets for children', async () => {
        const presets = await personalityManager.getPersonalityPresets(8);
        
        expect(presets.length).toBeGreaterThan(0);
        presets.forEach(preset => {
          expect(preset.ageAppropriate).toContain(AgeRange.CHILD);
          expect(preset.traits.friendliness).toBeGreaterThanOrEqual(6);
          expect(preset.traits.supportiveness).toBeGreaterThanOrEqual(8);
        });
      });

      it('should return different presets for adults', async () => {
        const childPresets = await personalityManager.getPersonalityPresets(8);
        const adultPresets = await personalityManager.getPersonalityPresets(25);
        
        expect(adultPresets.length).toBeGreaterThanOrEqual(childPresets.length);
        
        const adultOnlyPresets = adultPresets.filter(preset => 
          !preset.ageAppropriate.includes(AgeRange.CHILD)
        );
        expect(adultOnlyPresets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('EmotionalExpressionSystem', () => {
    describe('generateContextualExpression', () => {
      it('should generate appropriate facial expression for happy context', () => {
        const happyPersonality: PersonalityTraits = {
          friendliness: 9,
          formality: 3,
          humor: 8,
          enthusiasm: 9,
          patience: 7,
          supportiveness: 8
        };

        const happyContext: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'happy',
          recentTopics: ['great', 'wonderful', 'amazing']
        };

        const expression = emotionalSystem.generateContextualExpression(
          'test-user', 
          happyContext, 
          happyPersonality
        );
        
        expect(expression.mouth).toBeGreaterThan(0); // Should be smiling
        expect(expression.eyes).toBeGreaterThan(0.5); // Eyes should be open/bright
        expect(expression.cheeks).toBeGreaterThan(0); // Cheeks should be raised
      });

      it('should generate subdued expression for sad context', () => {
        const neutralPersonality: PersonalityTraits = {
          friendliness: 6,
          formality: 5,
          humor: 5,
          enthusiasm: 5,
          patience: 7,
          supportiveness: 8
        };

        const sadContext: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'sad',
          recentTopics: ['sad', 'disappointed', 'upset']
        };

        const expression = emotionalSystem.generateContextualExpression(
          'test-user', 
          sadContext, 
          neutralPersonality
        );
        
        expect(expression.mouth).toBeLessThan(0); // Should be frowning
        expect(expression.eyebrows).toBeLessThan(0); // Eyebrows should be down
      });

      it('should personalize expressions based on personality traits', () => {
        const enthusiasticPersonality: PersonalityTraits = {
          friendliness: 10,
          formality: 2,
          humor: 9,
          enthusiasm: 10,
          patience: 6,
          supportiveness: 9
        };

        const reservedPersonality: PersonalityTraits = {
          friendliness: 5,
          formality: 8,
          humor: 3,
          enthusiasm: 4,
          patience: 9,
          supportiveness: 6
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'happy',
          recentTopics: ['good news']
        };

        const enthusiasticExpression = emotionalSystem.generateContextualExpression(
          'test-user-1', 
          context, 
          enthusiasticPersonality
        );

        const reservedExpression = emotionalSystem.generateContextualExpression(
          'test-user-2', 
          context, 
          reservedPersonality
        );
        
        // Enthusiastic personality should have more expressive features
        expect(enthusiasticExpression.mouth).toBeGreaterThan(reservedExpression.mouth);
        expect(enthusiasticExpression.cheeks).toBeGreaterThan(reservedExpression.cheeks);
      });
    });

    describe('transitionToEmotion', () => {
      it('should smoothly transition between emotions', async () => {
        const userId = 'test-user';
        
        // Set initial emotion
        await emotionalSystem.transitionToEmotion(userId, EmotionType.NEUTRAL, 0.5, 1000);
        let state = emotionalSystem.getCurrentEmotionState(userId);
        expect(state?.currentEmotion).toBe(EmotionType.NEUTRAL);
        
        // Transition to happy
        await emotionalSystem.transitionToEmotion(userId, EmotionType.HAPPY, 0.8, 1000);
        state = emotionalSystem.getCurrentEmotionState(userId);
        expect(state?.currentEmotion).toBe(EmotionType.HAPPY);
        expect(state?.intensity).toBe(0.8);
      });

      it('should validate emotion intensity ranges', async () => {
        const userId = 'test-user';
        
        // Test with out-of-range intensity
        await emotionalSystem.transitionToEmotion(userId, EmotionType.HAPPY, 1.5, 1000);
        const state = emotionalSystem.getCurrentEmotionState(userId);
        
        expect(state?.intensity).toBeLessThanOrEqual(1.0);
        expect(state?.intensity).toBeGreaterThanOrEqual(0.0);
      });
    });

    describe('processEmotionTriggers', () => {
      it('should trigger appropriate emotions from context keywords', () => {
        const personality: PersonalityTraits = {
          friendliness: 7,
          formality: 5,
          humor: 6,
          enthusiasm: 7,
          patience: 6,
          supportiveness: 7
        };

        const happyContext: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'neutral',
          recentTopics: ['great news', 'fantastic day']
        };

        const triggeredEmotion = emotionalSystem.processEmotionTriggers(happyContext, personality);
        expect(triggeredEmotion).toBe(EmotionType.HAPPY);

        const sadContext: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'neutral',
          recentTopics: ['feeling sad', 'disappointed']
        };

        const sadEmotion = emotionalSystem.processEmotionTriggers(sadContext, personality);
        expect(sadEmotion).toBe(EmotionType.SAD);
      });
    });
  });

  describe('PersonalityVoiceIntegration', () => {
    describe('generatePersonalityDrivenResponseStyle', () => {
      it('should generate consistent response style based on personality', () => {
        const enthusiasticTraits: PersonalityTraits = {
          friendliness: 9,
          formality: 2,
          humor: 8,
          enthusiasm: 10,
          patience: 6,
          supportiveness: 8
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'excited',
          recentTopics: ['fun', 'games']
        };

        const style = voiceIntegration.generatePersonalityDrivenResponseStyle(enthusiasticTraits, context);
        
        expect(style.enthusiasm).toBeGreaterThan(0.7);
        expect(style.formality).toBeLessThan(0.4);
        expect(style.wordChoice).toBe('simple');
      });
    });

    describe('ensureVoiceCharacteristicConsistency', () => {
      it('should adjust voice characteristics based on personality', () => {
        const friendlyTraits: PersonalityTraits = {
          friendliness: 9,
          formality: 3,
          humor: 7,
          enthusiasm: 8,
          patience: 7,
          supportiveness: 8
        };

        const baseCharacteristics: VoiceCharacteristics = {
          pitch: 0,
          speed: 1,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CALM,
          volume: 0.8
        };

        const adjustedCharacteristics = voiceIntegration.ensureVoiceCharacteristicConsistency(
          friendlyTraits, 
          baseCharacteristics
        );
        
        expect(adjustedCharacteristics.pitch).toBeGreaterThan(baseCharacteristics.pitch);
        expect(adjustedCharacteristics.emotionalTone).toBe(EmotionalTone.CHEERFUL);
      });

      it('should keep voice characteristics within valid ranges', () => {
        const extremeTraits: PersonalityTraits = {
          friendliness: 10,
          formality: 1,
          humor: 10,
          enthusiasm: 10,
          patience: 1,
          supportiveness: 10
        };

        const baseCharacteristics: VoiceCharacteristics = {
          pitch: 1.5, // Already high
          speed: 1.8,  // Already fast
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CALM,
          volume: 0.8
        };

        const adjustedCharacteristics = voiceIntegration.ensureVoiceCharacteristicConsistency(
          extremeTraits, 
          baseCharacteristics
        );
        
        expect(adjustedCharacteristics.pitch).toBeLessThanOrEqual(2.0);
        expect(adjustedCharacteristics.pitch).toBeGreaterThanOrEqual(-2.0);
        expect(adjustedCharacteristics.speed).toBeLessThanOrEqual(2.0);
        expect(adjustedCharacteristics.speed).toBeGreaterThanOrEqual(0.5);
      });
    });

    describe('expressPersonalityInRealTime', () => {
      it('should create and store personality expression', async () => {
        const traits: PersonalityTraits = {
          friendliness: 8,
          formality: 4,
          humor: 7,
          enthusiasm: 7,
          patience: 6,
          supportiveness: 8
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'happy',
          recentTopics: ['learning', 'progress']
        };

        await voiceIntegration.expressPersonalityInRealTime('test-user', traits, context);
        
        const expression = voiceIntegration.getActivePersonalityExpression('test-user');
        expect(expression).toBeDefined();
        expect(expression?.userId).toBe('test-user');
        expect(expression?.currentPersonality).toEqual(traits);
      });
    });

    describe('generatePersonalizedResponse', () => {
      it('should handle missing voice pipeline gracefully', async () => {
        const traits: PersonalityTraits = {
          friendliness: 7,
          formality: 5,
          humor: 6,
          enthusiasm: 6,
          patience: 7,
          supportiveness: 7
        };

        const context: InteractionContext = {
          userId: 'test-user',
          conversationId: 'test-conv',
          emotionalState: 'neutral',
          recentTopics: ['question']
        };

        const response = await voiceIntegration.generatePersonalizedResponse(
          'Hello, how are you?', 
          traits, 
          context
        );
        
        expect(response).toBeDefined();
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate personality, emotion, and voice systems', async () => {
      const userId = 'integration-test-user';
      const traits: PersonalityTraits = {
        friendliness: 9,
        formality: 2,
        humor: 8,
        enthusiasm: 9,
        patience: 7,
        supportiveness: 9
      };

      const context: InteractionContext = {
        userId,
        conversationId: 'integration-test',
        emotionalState: 'excited',
        recentTopics: ['great news', 'celebration']
      };

      // Test personality validation
      const validation = await personalityManager.validatePersonalityTraits(traits, 10);
      expect(validation.isAllowed).toBe(true);

      // Test emotion generation
      const expression = emotionalSystem.generateContextualExpression(userId, context, traits);
      expect(expression.mouth).toBeGreaterThan(0); // Should be positive expression

      // Test emotion transition
      await emotionalSystem.transitionToEmotion(userId, EmotionType.EXCITED, 0.8, 1000);
      const emotionState = emotionalSystem.getCurrentEmotionState(userId);
      expect(emotionState?.currentEmotion).toBe(EmotionType.EXCITED);

      // Test voice integration
      await voiceIntegration.expressPersonalityInRealTime(userId, traits, context);
      const personalityExpression = voiceIntegration.getActivePersonalityExpression(userId);
      expect(personalityExpression?.activeEmotion).toBe(EmotionType.EXCITED);

      // Test response style generation
      const responseStyle = voiceIntegration.generatePersonalityDrivenResponseStyle(traits, context);
      expect(responseStyle.enthusiasm).toBeGreaterThan(0.7);
      expect(responseStyle.formality).toBeLessThan(0.4);
    });

    it('should handle child safety validation across all systems', async () => {
      const childUserId = 'child-user';
      const childAge = 8;
      
      // Test with child-appropriate traits
      const childTraits: PersonalityTraits = {
        friendliness: 9,
        formality: 2,
        humor: 8,
        enthusiasm: 9,
        patience: 8,
        supportiveness: 10
      };

      const validation = await personalityManager.validatePersonalityTraits(childTraits, childAge);
      expect(validation.isAllowed).toBe(true);
      expect(validation.requiresParentalApproval).toBe(false);

      // Test with inappropriate traits for children
      const inappropriateTraits: PersonalityTraits = {
        friendliness: 2,
        formality: 9,
        humor: 1,
        enthusiasm: 3,
        patience: 4,
        supportiveness: 3
      };

      const inappropriateValidation = await personalityManager.validatePersonalityTraits(inappropriateTraits, childAge);
      expect(inappropriateValidation.isAllowed).toBe(false);
      expect(inappropriateValidation.requiresParentalApproval).toBe(true);
    });
  });
});