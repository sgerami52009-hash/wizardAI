/**
 * Unit tests for Emotional TTS Controller
 * Safety: Validate child-appropriate emotional expressions
 * Performance: Test emotion processing efficiency
 */

import { EmotionalTTSController, EmotionType } from './emotional-tts-controller';
import { TTSOptions } from './interfaces';
import { PersonalityProfile } from '../models/voice-models';

describe('EmotionalTTSController', () => {
  let controller: EmotionalTTSController;

  beforeEach(() => {
    controller = new EmotionalTTSController();
  });

  describe('Emotion Management', () => {
    test('should set emotion with valid parameters', () => {
      const emotionChangedPromise = new Promise((resolve) => {
        controller.once('emotionChanged', resolve);
      });

      controller.setEmotion('happy', 0.8, 'child');

      const currentEmotion = controller.getCurrentEmotion();
      expect(currentEmotion.primary).toBe('happy');
      expect(currentEmotion.intensity).toBe(0.8);

      return expect(emotionChangedPromise).resolves.toMatchObject({
        to: 'happy',
        intensity: 0.8
      });
    });

    test('should limit emotion intensity for children', () => {
      controller.setEmotion('excited', 1.0, 'child');

      const currentEmotion = controller.getCurrentEmotion();
      expect(currentEmotion.intensity).toBeLessThanOrEqual(0.8);
    });

    test('should fallback to neutral for inappropriate emotions', () => {
      // Mock an inappropriate emotion by temporarily removing it
      const originalMappings = controller['emotionMappings'];
      controller['emotionMappings'] = new Map([
        ['neutral', originalMappings.get('neutral')!]
      ]);

      controller.setEmotion('excited', 0.7, 'child');

      const currentEmotion = controller.getCurrentEmotion();
      expect(currentEmotion.primary).toBe('neutral');
    });

    test('should clamp intensity to valid range', () => {
      controller.setEmotion('happy', -0.5, 'child');
      expect(controller.getCurrentEmotion().intensity).toBe(0.0);

      controller.setEmotion('happy', 1.5, 'child');
      expect(controller.getCurrentEmotion().intensity).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Emotion Transitions', () => {
    test('should transition between emotions smoothly', (done) => {
      controller.once('transitionComplete', (transition) => {
        expect(transition.from).toBe('neutral');
        expect(transition.to).toBe('happy');
        expect(controller.getCurrentEmotion().primary).toBe('happy');
        done();
      });

      controller.transitionToEmotion('happy', 100, 'child'); // Short duration for test
    });

    test('should cancel previous transition when starting new one', () => {
      const cancelledPromise = new Promise((resolve) => {
        controller.once('transitionCancelled', resolve);
      });

      controller.transitionToEmotion('happy', 1000, 'child');
      controller.transitionToEmotion('excited', 1000, 'child');

      return expect(cancelledPromise).resolves.toBeDefined();
    });

    test('should validate target emotion for age group', () => {
      // Should fallback to neutral for invalid emotion
      controller.transitionToEmotion('invalid' as EmotionType, 100, 'child');
      
      setTimeout(() => {
        expect(controller.getCurrentEmotion().primary).toBe('neutral');
      }, 150);
    });
  });

  describe('TTS Options Modification', () => {
    test('should apply emotional modifications to TTS options', () => {
      controller.setEmotion('happy', 0.7, 'child');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const modifiedOptions = controller.applyEmotionalModifications(baseOptions, 'child');

      expect(modifiedOptions.pitch).toBeGreaterThan(baseOptions.pitch!);
      expect(modifiedOptions.rate).toBeGreaterThan(baseOptions.rate!);
      expect(modifiedOptions.emotion).toBe('happy');
    });

    test('should apply child-safe limits to voice modifications', () => {
      controller.setEmotion('excited', 1.0, 'child');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const modifiedOptions = controller.applyEmotionalModifications(baseOptions, 'child');

      // Child-safe limits
      expect(modifiedOptions.pitch).toBeGreaterThanOrEqual(0.8);
      expect(modifiedOptions.pitch).toBeLessThanOrEqual(1.3);
      expect(modifiedOptions.rate).toBeGreaterThanOrEqual(0.8);
      expect(modifiedOptions.rate).toBeLessThanOrEqual(1.2);
    });

    test('should allow wider range for adults', () => {
      controller.setEmotion('excited', 1.0, 'adult');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const modifiedOptions = controller.applyEmotionalModifications(baseOptions, 'adult');

      // Adult limits are wider
      expect(modifiedOptions.pitch).toBeGreaterThanOrEqual(0.5);
      expect(modifiedOptions.pitch).toBeLessThanOrEqual(2.0);
    });

    test('should handle missing base options gracefully', () => {
      controller.setEmotion('happy', 0.5, 'child');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice'
        // Missing rate, pitch, volume
      };

      const modifiedOptions = controller.applyEmotionalModifications(baseOptions, 'child');

      expect(modifiedOptions.pitch).toBeDefined();
      expect(modifiedOptions.rate).toBeDefined();
      expect(modifiedOptions.volume).toBeDefined();
    });
  });

  describe('Personality Integration', () => {
    test('should apply personality profile to emotional expression', () => {
      const personality: PersonalityProfile = {
        id: 'enthusiastic-helper',
        name: 'Enthusiastic Helper',
        traits: [
          { name: 'enthusiasm', value: 0.9, description: 'Very enthusiastic' }
        ],
        responseStyle: {
          enthusiasm: 0.9,
          helpfulness: 0.8,
          patience: 0.6,
          humor: 0.7,
          formality: 0.2
        },
        voiceCharacteristics: {
          baseVoice: 'friendly-voice',
          pitchModification: 0.1,
          speedModification: 0.05,
          emotionalRange: ['happy', 'excited'],
          accentStrength: 0.3
        },
        ageAppropriate: true,
        safetyValidated: true
      };

      const personalityPromise = new Promise((resolve) => {
        controller.once('personalitySet', resolve);
      });

      controller.setPersonality(personality);

      return expect(personalityPromise).resolves.toBe(personality.id);
    });

    test('should adjust emotional intensity based on personality', () => {
      const calmPersonality: PersonalityProfile = {
        id: 'calm-helper',
        name: 'Calm Helper',
        traits: [],
        responseStyle: {
          enthusiasm: 0.2,
          helpfulness: 0.9,
          patience: 0.9,
          humor: 0.3,
          formality: 0.7
        },
        voiceCharacteristics: {
          baseVoice: 'calm-voice',
          pitchModification: -0.1,
          speedModification: -0.1,
          emotionalRange: ['neutral', 'calm'],
          accentStrength: 0.1
        },
        ageAppropriate: true,
        safetyValidated: true
      };

      controller.setPersonality(calmPersonality);
      controller.setEmotion('happy', 0.8, 'child');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const modifiedOptions = controller.applyEmotionalModifications(baseOptions, 'child');

      // Should be less intense due to low enthusiasm personality
      expect(modifiedOptions.pitch).toBeLessThan(1.2); // Less excited than normal
    });
  });

  describe('Age Appropriateness', () => {
    test('should return appropriate emotions for children', () => {
      const childEmotions = controller.getAvailableEmotions('child');

      expect(childEmotions).toContain('neutral');
      expect(childEmotions).toContain('happy');
      expect(childEmotions).toContain('encouraging');
      
      // All returned emotions should be child-safe
      childEmotions.forEach(emotion => {
        expect(controller.isEmotionAppropriate(emotion, 'child')).toBe(true);
      });
    });

    test('should validate emotion appropriateness for age groups', () => {
      expect(controller.isEmotionAppropriate('neutral', 'child')).toBe(true);
      expect(controller.isEmotionAppropriate('happy', 'child')).toBe(true);
      expect(controller.isEmotionAppropriate('concerned', 'child')).toBe(true);
    });

    test('should have consistent emotion availability across age groups', () => {
      const childEmotions = controller.getAvailableEmotions('child');
      const teenEmotions = controller.getAvailableEmotions('teen');
      const adultEmotions = controller.getAvailableEmotions('adult');

      // Children should have subset of teen emotions
      childEmotions.forEach(emotion => {
        expect(teenEmotions).toContain(emotion);
      });

      // Teens should have subset of adult emotions
      teenEmotions.forEach(emotion => {
        expect(adultEmotions).toContain(emotion);
      });
    });
  });

  describe('Text Analysis', () => {
    test('should suggest appropriate emotions from text content', () => {
      const testCases = [
        { text: 'Great job! That was awesome!', expected: 'excited' },
        { text: 'Good work today', expected: 'happy' },
        { text: 'Be careful with that', expected: 'concerned' },
        { text: 'You can do it! Try again', expected: 'encouraging' },
        { text: 'Hello there', expected: 'neutral' }
      ];

      testCases.forEach(({ text, expected }) => {
        const suggested = controller.suggestEmotionFromText(text, 'child');
        expect(suggested).toBe(expected);
      });
    });

    test('should fallback to neutral for ambiguous text', () => {
      const ambiguousTexts = [
        'The weather is nice',
        'Processing your request',
        'Information updated',
        ''
      ];

      ambiguousTexts.forEach(text => {
        const suggested = controller.suggestEmotionFromText(text, 'child');
        expect(suggested).toBe('neutral');
      });
    });

    test('should consider age group when suggesting emotions', () => {
      const excitingText = 'This is absolutely amazing and wonderful!';
      
      const childSuggestion = controller.suggestEmotionFromText(excitingText, 'child');
      const adultSuggestion = controller.suggestEmotionFromText(excitingText, 'adult');

      // Both should be appropriate for their age groups
      expect(controller.isEmotionAppropriate(childSuggestion, 'child')).toBe(true);
      expect(controller.isEmotionAppropriate(adultSuggestion, 'adult')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid emotion gracefully', () => {
      expect(() => {
        controller.setEmotion('invalid' as EmotionType, 0.5, 'child');
      }).not.toThrow();

      // Should fallback to neutral
      expect(controller.getCurrentEmotion().primary).toBe('neutral');
    });

    test('should handle missing personality gracefully', () => {
      // Without personality set
      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      expect(() => {
        controller.applyEmotionalModifications(baseOptions, 'child');
      }).not.toThrow();
    });

    test('should handle transition interruption gracefully', () => {
      controller.transitionToEmotion('happy', 1000, 'child');
      
      // Immediately set new emotion (should cancel transition)
      expect(() => {
        controller.setEmotion('excited', 0.5, 'child');
      }).not.toThrow();
    });
  });
});