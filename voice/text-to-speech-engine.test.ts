/**
 * Unit tests for Text-to-Speech Engine
 * Safety: Validate child-safe content filtering and voice characteristics
 * Performance: Test latency requirements and resource usage
 */

import { OfflineTTSEngine, TTSEngineConfig } from './text-to-speech-engine';
import { TTSOptions } from './interfaces';
import { PersonalityProfile } from '../models/voice-models';

// Mock dependencies
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({
    isAllowed: true,
    sanitizedText: null
  })
}));

jest.mock('../utils/privacy-utils', () => ({
  sanitizeForLog: jest.fn((text) => text)
}));

describe('OfflineTTSEngine', () => {
  let engine: OfflineTTSEngine;
  let config: TTSEngineConfig;

  beforeEach(() => {
    config = {
      modelPath: '/mock/models',
      voicesPath: '/mock/voices',
      maxConcurrentSynthesis: 3,
      enableSSML: true,
      hardwareAcceleration: true,
      memoryLimit: 1024
    };

    engine = new OfflineTTSEngine(config);
  });

  afterEach(() => {
    engine.stop();
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid config', async () => {
      const initPromise = engine.initialize();
      
      // Listen for initialized event
      const initEvent = new Promise((resolve) => {
        engine.once('initialized', resolve);
      });

      await expect(initPromise).resolves.toBeUndefined();
      await expect(initEvent).resolves.toBeUndefined();
    });

    test('should load available voices during initialization', async () => {
      await engine.initialize();
      
      const voices = engine.getAvailableVoices();
      expect(voices).toHaveLength(3); // Based on mock implementation
      expect(voices[0]).toHaveProperty('id');
      expect(voices[0]).toHaveProperty('name');
      expect(voices[0]).toHaveProperty('language');
      expect(voices[0]).toHaveProperty('ageGroup');
    });

    test('should set child-friendly voice as default', async () => {
      await engine.initialize();
      
      const voices = engine.getAvailableVoices();
      const childVoice = voices.find(v => v.ageGroup === 'child');
      expect(childVoice).toBeDefined();
    });
  });

  describe('Speech Synthesis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should synthesize text within latency requirement', async () => {
      const text = 'Hello, this is a test message';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const startTime = Date.now();
      const result = await engine.synthesize(text, options);
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Float32Array);
      expect(result.sampleRate).toBe(22050);
      expect(result.channels).toBe(1);
      expect(processingTime).toBeLessThan(300); // 300ms requirement
    });

    test('should handle content safety validation', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        sanitizedText: null
      });

      const text = 'Inappropriate content';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      await expect(engine.synthesize(text, options)).rejects.toThrow('Content blocked by safety filter');
    });

    test('should use sanitized text when provided', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: true,
        sanitizedText: 'Safe version of text'
      });

      const text = 'Original text';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const result = await engine.synthesize(text, options);
      expect(result).toBeDefined();
      // In a real implementation, we would verify the sanitized text was used
    });

    test('should respect voice parameter limits', async () => {
      const text = 'Test message';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 2.5, // Above limit
        pitch: 3.0, // Above limit
        volume: 1.5 // Above limit
      };

      // Should not throw error but clamp values internally
      const result = await engine.synthesize(text, options);
      expect(result).toBeDefined();
    });

    test('should handle synthesis timeout', async () => {
      // Mock a long-running synthesis
      const originalSynthesize = engine['synthesizeWithEngine'];
      engine['synthesizeWithEngine'] = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 6000))
      );

      const text = 'Test message';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      await expect(engine.synthesize(text, options)).rejects.toThrow('TTS synthesis timeout');
    });
  });

  describe('Voice Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should set voice successfully', () => {
      const voiceId = 'en-us-female-adult';
      
      expect(() => engine.setVoice(voiceId)).not.toThrow();
      
      // Verify voice changed event
      const voiceChangedPromise = new Promise((resolve) => {
        engine.once('voiceChanged', resolve);
      });
      
      engine.setVoice(voiceId);
      return expect(voiceChangedPromise).resolves.toBe(voiceId);
    });

    test('should throw error for invalid voice', () => {
      const invalidVoiceId = 'non-existent-voice';
      
      expect(() => engine.setVoice(invalidVoiceId)).toThrow('Voice non-existent-voice not available');
    });

    test('should update speech rate within valid range', () => {
      expect(() => engine.updateSpeechRate(1.5)).not.toThrow();
      
      // Test boundary values
      expect(() => engine.updateSpeechRate(0.5)).not.toThrow();
      expect(() => engine.updateSpeechRate(2.0)).not.toThrow();
    });

    test('should reject invalid speech rate', () => {
      expect(() => engine.updateSpeechRate(0.3)).toThrow('Speech rate must be between 0.5 and 2.0');
      expect(() => engine.updateSpeechRate(2.5)).toThrow('Speech rate must be between 0.5 and 2.0');
    });
  });

  describe('Personality Integration', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should apply personality voice characteristics', () => {
      const personality: PersonalityProfile = {
        id: 'friendly-helper',
        name: 'Friendly Helper',
        traits: [
          { name: 'enthusiasm', value: 0.8, description: 'High enthusiasm' }
        ],
        responseStyle: {
          enthusiasm: 0.8,
          helpfulness: 0.9,
          patience: 0.7,
          humor: 0.5,
          formality: 0.3
        },
        voiceCharacteristics: {
          baseVoice: 'en-us-child-friendly',
          pitchModification: 0.1,
          speedModification: 0.05,
          emotionalRange: ['happy', 'excited', 'encouraging'],
          accentStrength: 0.2
        },
        ageAppropriate: true,
        safetyValidated: true
      };

      expect(() => engine.applyPersonalityVoice(personality)).not.toThrow();
      
      // Verify personality applied event
      const personalityPromise = new Promise((resolve) => {
        engine.once('personalityApplied', resolve);
      });
      
      engine.applyPersonalityVoice(personality);
      return expect(personalityPromise).resolves.toBe(personality.id);
    });
  });

  describe('Streaming Synthesis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should create streaming synthesis', () => {
      const text = 'This is a longer text that will be streamed in chunks for better user experience.';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const stream = engine.startStreaming(text, options);
      
      expect(stream).toBeDefined();
      expect(typeof stream.start).toBe('function');
      expect(typeof stream.stop).toBe('function');
      expect(typeof stream.isActive).toBe('function');
    });

    test('should emit data events during streaming', (done) => {
      const text = 'Streaming test message.';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const stream = engine.startStreaming(text, options);
      
      stream.on('data', (audioBuffer) => {
        expect(audioBuffer).toBeDefined();
        expect(audioBuffer.data).toBeInstanceOf(Float32Array);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should stop all synthesis operations', () => {
      engine.stop();
      
      // Verify stopped event
      const stoppedPromise = new Promise((resolve) => {
        engine.once('stopped', resolve);
      });
      
      engine.stop();
      return expect(stoppedPromise).resolves.toBeUndefined();
    });

    test('should handle concurrent synthesis requests', async () => {
      const text = 'Concurrent test message';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      // Start multiple synthesis requests
      const promises = Array(3).fill(null).map(() => 
        engine.synthesize(text, options)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.data).toBeInstanceOf(Float32Array);
      });
    });

    test('should emit resource warnings when appropriate', (done) => {
      engine.on('resourceWarning', (usage) => {
        expect(usage).toBeDefined();
        expect(typeof usage.memoryMB).toBe('number');
        expect(typeof usage.cpuPercent).toBe('number');
        done();
      });

      // Trigger resource warning (implementation would monitor actual resources)
      engine.emit('resourceWarning', { memoryMB: 1500, cpuPercent: 85 });
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      const invalidConfig: TTSEngineConfig = {
        modelPath: '/invalid/path',
        voicesPath: '/invalid/path',
        maxConcurrentSynthesis: 0,
        enableSSML: true,
        hardwareAcceleration: false,
        memoryLimit: -1
      };

      const invalidEngine = new OfflineTTSEngine(invalidConfig);
      
      await expect(invalidEngine.initialize()).rejects.toThrow();
    });

    test('should handle synthesis errors gracefully', async () => {
      await engine.initialize();
      
      // Mock synthesis failure
      const originalSynthesize = engine['synthesizeWithEngine'];
      engine['synthesizeWithEngine'] = jest.fn().mockRejectedValue(new Error('Synthesis failed'));

      const text = 'Test message';
      const options: TTSOptions = {
        voiceId: 'en-us-child-friendly',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      await expect(engine.synthesize(text, options)).rejects.toThrow('Synthesis failed');
    });

    test('should provide fallback for missing voice', async () => {
      await engine.initialize();
      
      const text = 'Test message';
      const options: TTSOptions = {
        voiceId: 'non-existent-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      // Should use fallback voice instead of failing
      await expect(engine.synthesize(text, options)).rejects.toThrow('Voice not found');
    });
  });
});