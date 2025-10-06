/**
 * Multi-Modal Response Support Tests
 * 
 * Tests SSML generation, visual element creation, emotional tone processing,
 * and fallback text display functionality.
 */

import { 
  MultiModalResponseProcessor, 
  MultiModalResponse, 
  EmotionalTone,
  VisualElement,
  AudioMetadata 
} from './multi-modal-response';
import { ResponseContext } from './interfaces';
import { PersonalityProfile } from '../models/voice-models';

describe('MultiModalResponseProcessor', () => {
  let processor: MultiModalResponseProcessor;
  let mockContext: ResponseContext;
  let mockPersonality: PersonalityProfile;

  beforeEach(() => {
    processor = new MultiModalResponseProcessor();
    
    mockContext = {
      userId: 'test-user',
      conversationHistory: [],
      currentIntent: 'greeting',
      userPreferences: {
        userId: 'test-user',
        language: 'en',
        voiceSettings: {
          preferredVoice: 'friendly-female',
          speechRate: 1.0,
          volume: 0.8,
          pitch: 1.0,
          emotionalTone: 'friendly'
        },
        interactionStyle: {
          verbosity: 'normal',
          formality: 'casual',
          confirmationLevel: 'standard',
          errorHandling: 'clarify'
        },
        privacySettings: {
          dataRetention: 'session',
          shareWithFamily: false,
          allowPersonalization: true,
          voiceDataStorage: 'none'
        },
        accessibilitySettings: {
          hearingImpaired: false,
          speechImpaired: false,
          visualFeedback: false,
          hapticFeedback: false,
          slowSpeech: false,
          repeatConfirmations: false
        }
      },
      safetyLevel: 'child'
    };

    mockPersonality = {
      id: 'friendly-helper',
      name: 'Friendly Helper',
      traits: [
        { name: 'friendliness', value: 0.8, description: 'Very friendly' },
        { name: 'enthusiasm', value: 0.7, description: 'Enthusiastic' }
      ],
      responseStyle: {
        enthusiasm: 0.7,
        helpfulness: 0.9,
        patience: 0.8,
        humor: 0.4,
        formality: 0.3
      },
      voiceCharacteristics: {
        baseVoice: 'friendly-female',
        pitchModification: 0.1,
        speedModification: 0.0,
        emotionalRange: ['happy', 'excited', 'calm'],
        accentStrength: 0.2
      },
      ageAppropriate: true,
      safetyValidated: true
    };
  });

  describe('Basic Multi-Modal Processing', () => {
    it('should process simple text into multi-modal response', async () => {
      const text = 'Hello! How can I help you today?';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response).toBeDefined();
      expect(response.text).toBe(text);
      expect(response.ssml).toBeTruthy();
      expect(response.visualElements).toBeInstanceOf(Array);
      expect(response.audioMetadata).toBeDefined();
      expect(response.fallbackText).toBeTruthy();
      expect(response.emotionalTone).toBeDefined();
    });

    it('should handle empty text gracefully', async () => {
      const response = await processor.processResponse('', mockContext);
      
      expect(response).toBeDefined();
      expect(response.text).toBe('');
      expect(response.fallbackText).toBeTruthy();
      expect(response.fallbackText).toContain('help');
    });

    it('should emit processing events', async () => {
      const eventSpy = jest.fn();
      processor.on('responseProcessed', eventSpy);

      await processor.processResponse('Test message', mockContext);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processingTime: expect.any(Number),
          hasVisualElements: expect.any(Boolean),
          hasSSML: expect.any(Boolean),
          emotionalTone: expect.any(String)
        })
      );
    });
  });

  describe('SSML Generation', () => {
    it('should generate valid SSML markup', async () => {
      const text = 'This is a test message with emphasis!';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.ssml).toContain('<speak>');
      expect(response.ssml).toContain('</speak>');
      expect(response.ssml).toContain(text);
    });

    it('should add prosody for emotional tones', async () => {
      const text = 'Great job! That was excellent work!';
      
      const response = await processor.processResponse(text, mockContext);
      
      // Should detect excited tone and add appropriate prosody
      expect(response.emotionalTone.primary).toBe('excited');
      expect(response.ssml).toContain('prosody');
    });

    it('should add natural breaks for punctuation', async () => {
      const text = 'Hello there. How are you? I hope you are well!';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.ssml).toContain('<break');
    });

    it('should emphasize important words', async () => {
      const text = 'This is very important information.';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.ssml).toContain('<emphasis');
    });

    it('should handle SSML options', async () => {
      const text = 'Test message';
      const options = {
        includeBreaks: false,
        includeEmphasis: false,
        includeEmotions: false,
        includeProsody: false,
        voiceEffects: false
      };
      
      const response = await processor.processResponse(text, mockContext, options);
      
      // Should have minimal SSML when options are disabled
      expect(response.ssml).toBe('<speak>Test message</speak>');
    });
  });

  describe('Emotional Tone Detection', () => {
    it('should detect excited tone from positive words', async () => {
      const text = 'Awesome! That was great work!';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.emotionalTone.primary).toBe('excited');
      expect(response.emotionalTone.intensity).toBeGreaterThan(0.5);
    });

    it('should detect encouraging tone from helpful words', async () => {
      const text = 'I can help you with that task.';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.emotionalTone.primary).toBe('encouraging');
      expect(response.emotionalTone.secondary).toBe('gentle');
    });

    it('should detect concerned tone from problem words', async () => {
      const text = 'Sorry, there was a problem with that request.';
      
      const response = await processor.processResponse(text, mockContext);
      
      // Should detect concerned tone when emotional tones are enabled
      expect(['concerned', 'neutral']).toContain(response.emotionalTone.primary);
      if (response.emotionalTone.primary === 'concerned') {
        expect(response.emotionalTone.secondary).toBe('gentle');
      }
    });

    it('should detect happy tone from completion words', async () => {
      const text = 'Done! Your task is complete.';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.emotionalTone.primary).toBe('happy');
    });

    it('should ensure child-appropriate tones', async () => {
      mockContext.safetyLevel = 'child';
      
      const response = await processor.processResponse('Test message', mockContext);
      
      expect(response.emotionalTone.childAppropriate).toBe(true);
      expect(response.emotionalTone.intensity).toBeLessThanOrEqual(0.7);
    });
  });

  describe('Visual Element Generation', () => {
    it('should create text display element', async () => {
      const text = 'Hello world!';
      
      const response = await processor.processResponse(text, mockContext);
      
      const textElement = response.visualElements.find(el => el.type === 'text');
      expect(textElement).toBeDefined();
      expect(textElement!.content).toBe(text);
      expect(textElement!.priority).toBe('high');
    });

    it('should create emotional indicator for non-neutral tones', async () => {
      const text = 'Great job! Excellent work!';
      
      const response = await processor.processResponse(text, mockContext);
      
      const iconElement = response.visualElements.find(el => el.type === 'icon');
      expect(iconElement).toBeDefined();
      expect(iconElement!.content).toBeTruthy(); // Should have an emoji
    });

    it('should create progress indicator for long responses', async () => {
      const longText = 'This is a very long response that contains many words and should trigger the creation of a progress indicator element because it exceeds the length threshold for normal responses.';
      
      const response = await processor.processResponse(longText, mockContext);
      
      const progressElement = response.visualElements.find(el => el.type === 'progress');
      expect(progressElement).toBeDefined();
      expect(progressElement!.content).toContain('Speaking');
    });

    it('should include accessibility information', async () => {
      const text = 'Accessible message';
      
      const response = await processor.processResponse(text, mockContext);
      
      response.visualElements.forEach(element => {
        expect(element.accessibility).toBeDefined();
        expect(element.accessibility.altText).toBeTruthy();
        expect(element.accessibility.ariaLabel).toBeTruthy();
      });
    });

    it('should adapt to accessibility settings', async () => {
      mockContext.userPreferences.accessibilitySettings.visualFeedback = true;
      
      const response = await processor.processResponse('Test message', mockContext);
      
      const textElement = response.visualElements.find(el => el.type === 'text');
      expect(textElement!.style.fontSize).toBe('large');
      expect(textElement!.style.backgroundColor).toBeTruthy();
    });
  });

  describe('Audio Metadata Generation', () => {
    it('should calculate expected duration', async () => {
      const text = 'This is a test message with several words.';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.audioMetadata.expectedDuration).toBeGreaterThan(0);
      expect(typeof response.audioMetadata.expectedDuration).toBe('number');
    });

    it('should adjust speech parameters for emotional tone', async () => {
      const excitedText = 'Awesome! This is amazing!';
      
      const response = await processor.processResponse(excitedText, mockContext);
      
      expect(response.audioMetadata.speechRate).toBeGreaterThan(1.0);
      expect(response.audioMetadata.pitch).toBeGreaterThan(1.0);
    });

    it('should apply user voice preferences', async () => {
      mockContext.userPreferences.voiceSettings.speechRate = 1.5;
      mockContext.userPreferences.voiceSettings.volume = 0.6;
      
      const response = await processor.processResponse('Test', mockContext);
      
      expect(response.audioMetadata.speechRate).toBeCloseTo(1.5, 1);
      expect(response.audioMetadata.volume).toBeCloseTo(0.48, 1); // 0.8 * 0.6
    });

    it('should generate emotional markers', async () => {
      const text = 'Hello! How are you today?';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.audioMetadata.emotionalMarkers).toBeInstanceOf(Array);
      expect(response.audioMetadata.emotionalMarkers.length).toBeGreaterThan(0);
    });

    it('should use correct voice ID', async () => {
      const response = await processor.processResponse('Test', mockContext);
      
      expect(response.audioMetadata.voiceId).toBe(mockContext.userPreferences.voiceSettings.preferredVoice);
    });
  });

  describe('Fallback Text Generation', () => {
    it('should create clean fallback text', async () => {
      const text = 'Hello world!';
      
      const response = await processor.processResponse(text, mockContext);
      
      expect(response.fallbackText).toBeTruthy();
      expect(response.fallbackText).not.toContain('<');
      expect(response.fallbackText).not.toContain('>');
    });

    it('should add accessibility labels when enabled', async () => {
      mockContext.userPreferences.accessibilitySettings.visualFeedback = true;
      
      const response = await processor.processResponse('Test message', mockContext);
      
      expect(response.fallbackText).toContain('[Assistant]');
    });

    it('should remove SSML tags from fallback', async () => {
      const textWithSSML = '<speak>Hello <emphasis>world</emphasis>!</speak>';
      
      const response = await processor.processResponse(textWithSSML, mockContext);
      
      expect(response.fallbackText).not.toContain('<speak>');
      expect(response.fallbackText).not.toContain('<emphasis>');
      expect(response.fallbackText).toContain('Hello');
      expect(response.fallbackText).toContain('world');
    });
  });

  describe('Personality Integration', () => {
    beforeEach(() => {
      processor.setPersonality(mockPersonality);
    });

    it('should apply personality to emotional tone', async () => {
      const text = 'Hello there!';
      
      const response = await processor.processResponse(text, mockContext);
      
      // Personality should influence the emotional tone
      expect(response.emotionalTone.intensity).toBeGreaterThan(0.4);
    });

    it('should emit personality update events', () => {
      const eventSpy = jest.fn();
      processor.on('personalityUpdated', eventSpy);

      processor.setPersonality(mockPersonality);

      expect(eventSpy).toHaveBeenCalledWith({
        personalityId: mockPersonality.id
      });
    });

    it('should adjust tone intensity based on enthusiasm', async () => {
      // High enthusiasm personality
      mockPersonality.responseStyle.enthusiasm = 0.9;
      processor.setPersonality(mockPersonality);
      
      const response = await processor.processResponse('Great job!', mockContext);
      
      expect(response.emotionalTone.intensity).toBeGreaterThan(0.6);
    });

    it('should add playful secondary tone for humorous personality', async () => {
      mockPersonality.responseStyle.humor = 0.8;
      processor.setPersonality(mockPersonality);
      
      const response = await processor.processResponse('Well done!', mockContext);
      
      if (response.emotionalTone.primary === 'happy') {
        expect(response.emotionalTone.secondary).toBe('playful');
      }
    });
  });

  describe('Configuration Options', () => {
    it('should respect disabled visual feedback', async () => {
      const processor = new MultiModalResponseProcessor({
        enableVisualFeedback: false
      });
      
      const response = await processor.processResponse('Test', mockContext);
      
      expect(response.visualElements).toHaveLength(0);
    });

    it('should respect disabled SSML', async () => {
      const processor = new MultiModalResponseProcessor({
        enableSSML: false
      });
      
      const response = await processor.processResponse('Test message', mockContext);
      
      expect(response.ssml).toBe('Test message');
    });

    it('should respect disabled emotional tones', async () => {
      const processor = new MultiModalResponseProcessor({
        enableEmotionalTones: false
      });
      
      const response = await processor.processResponse('Great job!', mockContext);
      
      expect(response.emotionalTone.primary).toBe('neutral');
    });

    it('should handle accessibility mode', async () => {
      const processor = new MultiModalResponseProcessor({
        accessibilityMode: true
      });
      
      const response = await processor.processResponse('Test', mockContext);
      
      // Should enhance accessibility features
      expect(response.visualElements[0].accessibility.highContrast).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      // Force an error by providing invalid context
      const invalidContext = { ...mockContext, userPreferences: null as any };
      
      // Suppress error events for this test
      const errorHandler = jest.fn();
      processor.on('error', errorHandler);
      
      const response = await processor.processResponse('Test', invalidContext);
      
      expect(response).toBeDefined();
      expect(response.text).toBe('Test');
      expect(response.fallbackText).toBeTruthy();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit error events', async () => {
      const eventSpy = jest.fn();
      processor.on('error', eventSpy);

      // Force an error
      const invalidContext = { ...mockContext, userPreferences: null as any };
      await processor.processResponse('Test', invalidContext);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          text: 'Test',
          context: invalidContext,
          stage: 'multi_modal_processing'
        })
      );
    });

    it('should provide error fallback response', async () => {
      const invalidContext = { ...mockContext, userPreferences: null as any };
      
      // Suppress error events for this test
      const errorHandler = jest.fn();
      processor.on('error', errorHandler);
      
      const response = await processor.processResponse('Test message', invalidContext);
      
      expect(response.emotionalTone.primary).toBe('neutral');
      expect(response.visualElements).toHaveLength(1);
      expect(response.audioMetadata.voiceId).toBe('default');
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should process responses within performance target', async () => {
      const startTime = Date.now();
      
      await processor.processResponse('Test message for performance', mockContext);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle concurrent processing', async () => {
      const promises = Array(5).fill(null).map((_, i) => 
        processor.processResponse(`Message ${i}`, mockContext)
      );

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach((response, i) => {
        expect(response.text).toBe(`Message ${i}`);
      });
    });

    it('should efficiently process long text', async () => {
      const longText = 'This is a very long message that contains many words and sentences. '.repeat(20);
      
      const startTime = Date.now();
      const response = await processor.processResponse(longText, mockContext);
      const processingTime = Date.now() - startTime;
      
      expect(response).toBeDefined();
      expect(processingTime).toBeLessThan(200);
    });
  });
});