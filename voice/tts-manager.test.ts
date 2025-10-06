/**
 * Unit tests for TTS Manager
 * Safety: Validate integrated child-safe TTS functionality
 * Performance: Test complete TTS pipeline latency and quality
 */

import { TTSManager, TTSManagerConfig, SynthesisOptions } from './tts-manager';
import { EmotionType } from './emotional-tts-controller';
import { PersonalityProfile, VoiceProfile } from '../models/voice-models';

// Mock all dependencies
jest.mock('./text-to-speech-engine');
jest.mock('./ssml-processor');
jest.mock('./emotional-tts-controller');
jest.mock('./speech-interruption-handler');
jest.mock('./hardware-optimization');
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({
    isAllowed: true,
    sanitizedText: null
  })
}));

describe('TTSManager', () => {
  let manager: TTSManager;
  let config: TTSManagerConfig;

  beforeEach(() => {
    config = {
      engine: {
        modelPath: '/mock/models',
        voicesPath: '/mock/voices',
        maxConcurrentSynthesis: 3,
        enableSSML: true,
        hardwareAcceleration: true,
        memoryLimit: 1024
      },
      interruption: {
        enableVoiceInterruption: true,
        voiceThreshold: 0.1,
        gracePeriod: 1000,
        fadeOutDuration: 200,
        resumeCapability: true
      },
      enableSSML: true,
      enableEmotions: true,
      enableHardwareOptimization: true,
      defaultVoice: 'en-us-child-friendly',
      childSafeMode: true
    };

    manager = new TTSManager(config);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Initialization', () => {
    test('should initialize all components successfully', async () => {
      const initPromise = new Promise((resolve) => {
        manager.once('initialized', resolve);
      });

      await manager.initialize();

      return expect(initPromise).resolves.toBeUndefined();
    });

    test('should set default voice during initialization', async () => {
      await manager.initialize();
      
      // Verify default voice was set
      const mockEngine = manager['engine'];
      expect(mockEngine.setVoice).toHaveBeenCalledWith('en-us-child-friendly');
    });

    test('should handle initialization errors gracefully', async () => {
      const mockEngine = manager['engine'];
      mockEngine.initialize.mockRejectedValue(new Error('Engine init failed'));

      await expect(manager.initialize()).rejects.toThrow('TTS Manager initialization failed');
    });
  });

  describe('Text Synthesis', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should synthesize text with basic options', async () => {
      const mockAudioBuffer = {
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      };

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue(mockAudioBuffer);

      const result = await manager.synthesize('Hello world', {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      });

      expect(result).toBe(mockAudioBuffer);
      expect(mockEngine.synthesize).toHaveBeenCalled();
    });

    test('should validate content safety before synthesis', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        sanitizedText: null
      });

      await expect(manager.synthesize('Unsafe content')).rejects.toThrow('Content blocked by safety filter');
    });

    test('should use sanitized text when provided', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: true,
        sanitizedText: 'Safe version'
      });

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await manager.synthesize('Original text');

      expect(mockEngine.synthesize).toHaveBeenCalledWith(
        'Safe version',
        expect.any(Object)
      );
    });

    test('should meet latency requirements', async () => {
      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: new Float32Array(1024),
            sampleRate: 22050,
            channels: 1,
            timestamp: Date.now()
          }), 250) // 250ms - within 300ms requirement
        )
      );

      const startTime = Date.now();
      await manager.synthesize('Test message');
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(300);
    });

    test('should emit latency warning when exceeding target', async () => {
      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: new Float32Array(1024),
            sampleRate: 22050,
            channels: 1,
            timestamp: Date.now()
          }), 350) // Exceeds 300ms target
        )
      );

      const warningPromise = new Promise((resolve) => {
        manager.once('latencyWarning', resolve);
      });

      await manager.synthesize('Test message');

      return expect(warningPromise).resolves.toMatchObject({
        target: 300
      });
    });
  });

  describe('SSML Processing', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should process SSML when enabled', async () => {
      const mockSSMLProcessor = manager['ssmlProcessor'];
      mockSSMLProcessor.processSSML.mockReturnValue({
        text: 'Processed text',
        prosody: [],
        breaks: [],
        emphasis: [],
        emotions: []
      });

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await manager.synthesize('<speak>Hello <break time="500ms"/> world</speak>', {
        ssml: true
      });

      expect(mockSSMLProcessor.processSSML).toHaveBeenCalledWith(
        '<speak>Hello <break time="500ms"/> world</speak>',
        true // childSafeMode
      );
    });

    test('should validate SSML for child safety', () => {
      const mockSSMLProcessor = manager['ssmlProcessor'];
      mockSSMLProcessor.validateChildSafety.mockReturnValue(true);

      const isValid = manager.validateSSML('<speak><p>Safe content</p></speak>');

      expect(isValid).toBe(true);
      expect(mockSSMLProcessor.validateChildSafety).toHaveBeenCalled();
    });

    test('should reject unsafe SSML', () => {
      const mockSSMLProcessor = manager['ssmlProcessor'];
      mockSSMLProcessor.validateChildSafety.mockReturnValue(false);

      const isValid = manager.validateSSML('<speak><audio src="external.mp3">Unsafe</audio></speak>');

      expect(isValid).toBe(false);
    });
  });

  describe('Emotional Speech', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should apply emotions to speech synthesis', async () => {
      const mockEmotionalController = manager['emotionalController'];
      mockEmotionalController.applyEmotionalModifications.mockReturnValue({
        voiceId: 'test-voice',
        rate: 1.2,
        pitch: 1.1,
        volume: 1.0,
        emotion: 'happy'
      });

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      manager.setEmotion('happy', 0.7, 'child');
      await manager.synthesize('Happy message');

      expect(mockEmotionalController.applyEmotionalModifications).toHaveBeenCalled();
    });

    test('should suggest contextual emotions from text', async () => {
      const mockEmotionalController = manager['emotionalController'];
      mockEmotionalController.suggestEmotionFromText.mockReturnValue('excited');

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await manager.synthesize('Great job! That was awesome!', {
        contextualEmotion: true,
        ageGroup: 'child'
      });

      expect(mockEmotionalController.suggestEmotionFromText).toHaveBeenCalledWith(
        'Great job! That was awesome!',
        'child'
      );
    });

    test('should transition between emotions smoothly', () => {
      const mockEmotionalController = manager['emotionalController'];
      
      manager.transitionToEmotion('happy', 1000, 'child');

      expect(mockEmotionalController.transitionToEmotion).toHaveBeenCalledWith(
        'happy',
        1000,
        'child'
      );
    });

    test('should get available emotions for age group', () => {
      const mockEmotionalController = manager['emotionalController'];
      mockEmotionalController.getAvailableEmotions.mockReturnValue(['neutral', 'happy', 'encouraging']);

      const emotions = manager.getAvailableEmotions('child');

      expect(emotions).toEqual(['neutral', 'happy', 'encouraging']);
      expect(mockEmotionalController.getAvailableEmotions).toHaveBeenCalledWith('child');
    });
  });

  describe('Speech Interruption', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should support manual interruption', () => {
      const mockInterruptionHandler = manager['interruptionHandler'];
      mockInterruptionHandler.interrupt.mockReturnValue(true);

      const result = manager.interrupt('manual');

      expect(result).toBe(true);
      expect(mockInterruptionHandler.interrupt).toHaveBeenCalledWith('manual', 'tts_manager');
    });

    test('should support speech resume after interruption', () => {
      const mockInterruptionHandler = manager['interruptionHandler'];
      mockInterruptionHandler.resume.mockReturnValue({
        text: 'remaining text',
        position: 10
      });

      const resumeData = manager.resumeSpeech();

      expect(resumeData).toEqual({
        text: 'remaining text',
        position: 10
      });
    });

    test('should enable interruption monitoring for streaming', () => {
      const mockEngine = manager['engine'];
      const mockStream = { start: jest.fn(), stop: jest.fn() };
      mockEngine.startStreaming.mockReturnValue(mockStream);

      const mockInterruptionHandler = manager['interruptionHandler'];

      const stream = manager.startStreaming('Test message', {
        enableInterruption: true
      });

      expect(mockInterruptionHandler.startMonitoring).toHaveBeenCalledWith(
        mockStream,
        'Test message'
      );
    });
  });

  describe('Hardware Optimization', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should apply hardware optimizations to TTS options', async () => {
      const mockHardwareOptimizer = manager['hardwareOptimizer'];
      mockHardwareOptimizer.canHandleRequest.mockReturnValue(true);
      mockHardwareOptimizer.optimizeTTSOptions.mockReturnValue({
        voiceId: 'optimized-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        hardwareAcceleration: true
      });

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await manager.synthesize('Test message');

      expect(mockHardwareOptimizer.optimizeTTSOptions).toHaveBeenCalled();
    });

    test('should reject requests when resources insufficient', async () => {
      const mockHardwareOptimizer = manager['hardwareOptimizer'];
      mockHardwareOptimizer.canHandleRequest.mockReturnValue(false);

      await expect(manager.synthesize('Test message')).rejects.toThrow(
        'System resources insufficient for TTS request'
      );
    });

    test('should switch optimization profiles', () => {
      const mockHardwareOptimizer = manager['hardwareOptimizer'];
      mockHardwareOptimizer.applyProfile.mockReturnValue(true);

      const result = manager.setOptimizationProfile('performance');

      expect(result).toBe(true);
      expect(mockHardwareOptimizer.applyProfile).toHaveBeenCalledWith('performance');
    });

    test('should get performance metrics', () => {
      const mockMetrics = {
        cpuUsage: 45,
        memoryUsage: 60,
        temperature: 55,
        synthesisLatency: 200
      };

      const mockHardwareOptimizer = manager['hardwareOptimizer'];
      mockHardwareOptimizer.getMetrics.mockReturnValue(mockMetrics);

      const metrics = manager.getPerformanceMetrics();

      expect(metrics).toEqual(mockMetrics);
    });
  });

  describe('User Profiles', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should apply user voice profile to synthesis', async () => {
      const userProfile: VoiceProfile = {
        userId: 'user123',
        preferredLanguage: 'en-US',
        accentAdaptation: {
          region: 'US-West',
          confidence: 0.8,
          adaptationData: new Float32Array(100),
          phonemeMapping: {},
          lastTraining: new Date()
        },
        speechPatterns: [],
        safetyLevel: 'child',
        lastUpdated: new Date()
      };

      manager.setUserProfile('user123', userProfile);

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await manager.synthesize('Test message', { userId: 'user123' });

      // Verify profile was applied (would check voice selection based on language)
      expect(mockEngine.synthesize).toHaveBeenCalled();
    });

    test('should emit event when user profile is updated', () => {
      const profilePromise = new Promise((resolve) => {
        manager.once('userProfileUpdated', resolve);
      });

      const userProfile: VoiceProfile = {
        userId: 'user456',
        preferredLanguage: 'en-US',
        accentAdaptation: {
          region: 'US-East',
          confidence: 0.9,
          adaptationData: new Float32Array(100),
          phonemeMapping: {},
          lastTraining: new Date()
        },
        speechPatterns: [],
        safetyLevel: 'teen',
        lastUpdated: new Date()
      };

      manager.setUserProfile('user456', userProfile);

      return expect(profilePromise).resolves.toMatchObject({
        userId: 'user456',
        profile: userProfile
      });
    });
  });

  describe('Personality Integration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should apply personality to both emotional and voice characteristics', () => {
      const personality: PersonalityProfile = {
        id: 'friendly-helper',
        name: 'Friendly Helper',
        traits: [],
        responseStyle: {
          enthusiasm: 0.8,
          helpfulness: 0.9,
          patience: 0.7,
          humor: 0.5,
          formality: 0.3
        },
        voiceCharacteristics: {
          baseVoice: 'friendly-voice',
          pitchModification: 0.1,
          speedModification: 0.05,
          emotionalRange: ['happy', 'encouraging'],
          accentStrength: 0.2
        },
        ageAppropriate: true,
        safetyValidated: true
      };

      const mockEmotionalController = manager['emotionalController'];
      const mockEngine = manager['engine'];

      manager.setPersonality(personality);

      expect(mockEmotionalController.setPersonality).toHaveBeenCalledWith(personality);
      expect(mockEngine.applyPersonalityVoice).toHaveBeenCalledWith(personality);
    });
  });

  describe('Voice Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should set voice and update speech rate', () => {
      const mockEngine = manager['engine'];

      manager.setVoice('new-voice');
      manager.updateSpeechRate(1.5);

      expect(mockEngine.setVoice).toHaveBeenCalledWith('new-voice');
      expect(mockEngine.updateSpeechRate).toHaveBeenCalledWith(1.5);
    });

    test('should get available voices from engine', () => {
      const mockVoices = [
        { id: 'voice1', name: 'Voice 1', language: 'en-US', gender: 'female', ageGroup: 'adult' },
        { id: 'voice2', name: 'Voice 2', language: 'en-US', gender: 'male', ageGroup: 'child' }
      ];

      const mockEngine = manager['engine'];
      mockEngine.getAvailableVoices.mockReturnValue(mockVoices);

      const voices = manager.getAvailableVoices();

      expect(voices).toEqual(mockVoices);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should forward engine events', () => {
      const errorPromise = new Promise((resolve) => {
        manager.once('error', resolve);
      });

      const mockEngine = manager['engine'];
      mockEngine.emit('error', new Error('Engine error'));

      return expect(errorPromise).resolves.toBeInstanceOf(Error);
    });

    test('should forward emotional controller events', () => {
      const emotionPromise = new Promise((resolve) => {
        manager.once('emotionChanged', resolve);
      });

      const mockEmotionalController = manager['emotionalController'];
      mockEmotionalController.emit('emotionChanged', { from: 'neutral', to: 'happy' });

      return expect(emotionPromise).resolves.toMatchObject({
        from: 'neutral',
        to: 'happy'
      });
    });

    test('should forward interruption handler events', () => {
      const interruptedPromise = new Promise((resolve) => {
        manager.once('speechInterrupted', resolve);
      });

      const mockInterruptionHandler = manager['interruptionHandler'];
      mockInterruptionHandler.emit('speechInterrupted', { type: 'manual' });

      return expect(interruptedPromise).resolves.toMatchObject({
        type: 'manual'
      });
    });

    test('should forward hardware optimizer events', () => {
      const throttlingPromise = new Promise((resolve) => {
        manager.once('thermalThrottling', resolve);
      });

      const mockHardwareOptimizer = manager['hardwareOptimizer'];
      mockHardwareOptimizer.emit('thermalThrottling', { temperature: 85 });

      return expect(throttlingPromise).resolves.toMatchObject({
        temperature: 85
      });
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should stop all components when stopped', () => {
      const mockEngine = manager['engine'];
      const mockInterruptionHandler = manager['interruptionHandler'];

      manager.stop();

      expect(mockEngine.stop).toHaveBeenCalled();
      expect(mockInterruptionHandler.stopMonitoring).toHaveBeenCalled();
    });

    test('should clean up resources when destroyed', () => {
      const destroyedPromise = new Promise((resolve) => {
        manager.once('destroyed', resolve);
      });

      const mockHardwareOptimizer = manager['hardwareOptimizer'];

      manager.destroy();

      expect(mockHardwareOptimizer.destroy).toHaveBeenCalled();
      return expect(destroyedPromise).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should handle synthesis errors gracefully', async () => {
      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockRejectedValue(new Error('Synthesis failed'));

      await expect(manager.synthesize('Test message')).rejects.toThrow('Synthesis failed');
    });

    test('should emit synthesis error events', async () => {
      const errorPromise = new Promise((resolve) => {
        manager.once('synthesisError', resolve);
      });

      const mockEngine = manager['engine'];
      mockEngine.synthesize.mockRejectedValue(new Error('Test error'));

      try {
        await manager.synthesize('Test message');
      } catch (error) {
        // Expected to throw
      }

      return expect(errorPromise).resolves.toMatchObject({
        error: 'Test error'
      });
    });

    test('should handle component initialization failures', async () => {
      const failingManager = new TTSManager(config);
      const mockEngine = failingManager['engine'];
      mockEngine.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(failingManager.initialize()).rejects.toThrow('TTS Manager initialization failed');
    });
  });

  describe('Configuration Validation', () => {
    test('should handle disabled features gracefully', async () => {
      const minimalConfig: TTSManagerConfig = {
        ...config,
        enableSSML: false,
        enableEmotions: false,
        enableHardwareOptimization: false
      };

      const minimalManager = new TTSManager(minimalConfig);
      await minimalManager.initialize();

      // Should still work with basic synthesis
      const mockEngine = minimalManager['engine'];
      mockEngine.synthesize.mockResolvedValue({
        data: new Float32Array(1024),
        sampleRate: 22050,
        channels: 1,
        timestamp: Date.now()
      });

      await expect(minimalManager.synthesize('Test')).resolves.toBeDefined();

      minimalManager.destroy();
    });
  });
});