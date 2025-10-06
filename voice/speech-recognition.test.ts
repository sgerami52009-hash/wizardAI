/**
 * Unit tests for speech recognition engine
 * Tests: Recognition accuracy, streaming performance, error handling
 * Safety: Validates child-safe content processing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { OfflineSpeechRecognizer, WhisperConfig } from './speech-recognizer';
import { SpeechRecognitionService } from './speech-recognition-service';
import { VoiceProfileManager } from './voice-profile-manager';
import { RecognitionErrorHandler } from './recognition-error-handler';
import { AudioBuffer, AudioStream } from './interfaces';
import { VoiceProfile } from '../models/voice-models';

// Mock audio stream for testing
class MockAudioStream extends EventEmitter implements AudioStream {
  private buffers: AudioBuffer[] = [];
  private isStreamActive = false;

  constructor(testAudio?: AudioBuffer[]) {
    super();
    if (testAudio) {
      this.buffers = testAudio;
    }
  }

  async start(): Promise<void> {
    this.isStreamActive = true;
    // Emit test audio data
    setTimeout(() => {
      this.buffers.forEach((buffer, index) => {
        setTimeout(() => {
          if (this.isStreamActive) {
            this.emit('data', buffer);
          }
        }, index * 10);
      });
      
      setTimeout(() => {
        if (this.isStreamActive) {
          this.emit('end');
        }
      }, this.buffers.length * 10 + 50);
    }, 10);
  }

  async stop(): Promise<void> {
    this.isStreamActive = false;
  }

  write(buffer: AudioBuffer): void {
    if (this.isStreamActive) {
      this.emit('data', buffer);
    }
  }

  read(): AudioBuffer | null {
    return this.buffers.shift() || null;
  }

  isActive(): boolean {
    return this.isStreamActive;
  }

  addTestAudio(buffer: AudioBuffer): void {
    this.buffers.push(buffer);
  }
}

// Test audio data generator
function generateTestAudio(
  duration: number = 1.0, 
  sampleRate: number = 16000, 
  frequency: number = 440
): AudioBuffer {
  const samples = Math.floor(duration * sampleRate);
  const data = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    // Generate sine wave with some noise
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * frequency * t) * 0.5 + (Math.random() - 0.5) * 0.1;
  }
  
  return {
    data,
    sampleRate,
    channels: 1,
    timestamp: Date.now()
  };
}

describe('OfflineSpeechRecognizer', () => {
  let recognizer: OfflineSpeechRecognizer;
  let mockConfig: WhisperConfig;

  beforeEach(async () => {
    mockConfig = {
      modelPath: '/test/models/whisper-en.bin',
      language: 'en',
      maxTokens: 256,
      temperature: 0.0,
      beamSize: 5,
      enableVAD: true,
      vadThreshold: 0.5
    };

    recognizer = new OfflineSpeechRecognizer(mockConfig);
    await recognizer.initialize();
  });

  afterEach(async () => {
    await recognizer.shutdown();
  });

  test('should initialize successfully', async () => {
    expect(recognizer).toBeDefined();
  });

  test('should recognize speech from audio stream', async () => {
    const testAudio = generateTestAudio(2.0); // 2 second audio
    const audioStream = new MockAudioStream([testAudio]);
    
    const result = await recognizer.recognize(audioStream);
    
    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.processingTime).toBeGreaterThan(0);
    expect(result.language).toBe('en');
  });

  test('should handle multiple languages', async () => {
    const languages = ['en', 'es', 'fr'];
    
    for (const lang of languages) {
      recognizer.setLanguage(lang);
      const availableLanguages = recognizer.getAvailableLanguages();
      expect(availableLanguages).toContain(lang);
    }
  });

  test('should update user profiles', async () => {
    const userId = 'test-user-123';
    const profile: VoiceProfile = {
      userId,
      preferredLanguage: 'en',
      accentAdaptation: {
        region: 'us',
        confidence: 0.8,
        adaptationData: new Float32Array(128),
        phonemeMapping: {},
        lastTraining: new Date()
      },
      speechPatterns: [],
      safetyLevel: 'child',
      lastUpdated: new Date()
    };

    recognizer.updateUserProfile(userId, profile);
    
    // Test recognition with user profile
    const testAudio = generateTestAudio(1.5);
    const audioStream = new MockAudioStream([testAudio]);
    
    const result = await recognizer.recognize(audioStream, userId);
    expect(result.userId).toBe(userId);
  });

  test('should provide confidence scores and alternatives', async () => {
    const testAudio = generateTestAudio(1.0);
    const audioStream = new MockAudioStream([testAudio]);
    
    const result = await recognizer.recognize(audioStream);
    
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.alternatives).toBeDefined();
    expect(Array.isArray(result.alternatives)).toBe(true);
  });

  test('should handle empty audio gracefully', async () => {
    const emptyAudio = generateTestAudio(0.1); // Very short audio
    const audioStream = new MockAudioStream([emptyAudio]);
    
    const result = await recognizer.recognize(audioStream);
    
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  test('should process streaming recognition', async () => {
    const streaming = recognizer.startStreaming('test-user');
    
    let partialResults: string[] = [];
    let finalResult: any = null;
    
    streaming.onPartialResult((text) => {
      partialResults.push(text);
    });
    
    streaming.onFinalResult((result) => {
      finalResult = result;
    });
    
    // Simulate streaming audio
    const testAudio = generateTestAudio(0.5);
    streaming.addAudioData(testAudio);
    
    streaming.start();
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    streaming.stop();
    
    expect(partialResults.length).toBeGreaterThan(0);
    expect(finalResult).toBeDefined();
  });
});

describe('SpeechRecognitionService', () => {
  let service: SpeechRecognitionService;
  let mockConfig: any;

  beforeEach(async () => {
    mockConfig = {
      whisper: {
        modelPath: '/test/models/whisper-en.bin',
        language: 'en',
        maxTokens: 256,
        temperature: 0.0,
        beamSize: 5,
        enableVAD: true,
        vadThreshold: 0.5
      },
      preprocessing: {
        noiseReduction: { enabled: true, strength: 0.5, adaptiveMode: true },
        normalization: { enabled: true, targetLevel: -20, maxGain: 20 },
        filtering: { enabled: true, highPassCutoff: 80, lowPassCutoff: 8000 },
        enhancement: { enabled: true, speechClarity: 0.7, dynamicRange: 0.5 }
      },
      confidence: {
        minConfidenceThreshold: 0.7,
        maxAlternatives: 3,
        contextWeight: 0.3,
        acousticWeight: 0.4,
        languageWeight: 0.2,
        pronunciationWeight: 0.1
      },
      errorHandling: {
        timeoutDuration: 30,
        pauseDetectionThreshold: 3,
        confidenceThreshold: 0.7,
        maxRetries: 3,
        clarificationTimeout: 10,
        degradationThresholds: { low: 0.3, medium: 0.5, high: 0.7 }
      },
      performance: {
        maxLatency: 500,
        memoryThreshold: 1500,
        cpuThreshold: 70
      }
    };

    service = new SpeechRecognitionService(mockConfig);
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  test('should initialize all components', async () => {
    expect(service).toBeDefined();
  });

  test('should meet latency requirements', async () => {
    const testAudio = generateTestAudio(1.0);
    const audioStream = new MockAudioStream([testAudio]);
    
    const startTime = Date.now();
    const result = await service.recognize(audioStream);
    const latency = Date.now() - startTime;
    
    expect(latency).toBeLessThan(mockConfig.performance.maxLatency);
    expect(result.processingTime).toBeLessThan(mockConfig.performance.maxLatency);
  });

  test('should handle different languages and accents', async () => {
    const languages = ['en', 'es', 'fr'];
    const testResults: any[] = [];
    
    for (const lang of languages) {
      service.setLanguage(lang);
      
      const testAudio = generateTestAudio(1.0);
      const audioStream = new MockAudioStream([testAudio]);
      
      const result = await service.recognize(audioStream);
      testResults.push({ language: lang, result });
      
      expect(result.language).toBe(lang);
    }
    
    expect(testResults.length).toBe(languages.length);
  });

  test('should validate streaming performance', async () => {
    const streaming = service.startStreaming('test-user');
    
    const partialResults: string[] = [];
    const processingTimes: number[] = [];
    
    streaming.onPartialResult((text) => {
      partialResults.push(text);
    });
    
    streaming.onFinalResult((result) => {
      processingTimes.push(result.processingTime);
    });
    
    streaming.start();
    
    // Simulate real-time audio chunks
    for (let i = 0; i < 5; i++) {
      const chunk = generateTestAudio(0.2); // 200ms chunks
      streaming.addAudioData(chunk);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    streaming.stop();
    
    // Validate streaming performance
    expect(partialResults.length).toBeGreaterThan(0);
    processingTimes.forEach(time => {
      expect(time).toBeLessThan(mockConfig.performance.maxLatency);
    });
  });

  test('should handle user profiles correctly', async () => {
    const userId = 'test-user-456';
    const profile: VoiceProfile = {
      userId,
      preferredLanguage: 'es',
      accentAdaptation: {
        region: 'mx',
        confidence: 0.9,
        adaptationData: new Float32Array(128),
        phonemeMapping: { 'r': 'rr' },
        lastTraining: new Date()
      },
      speechPatterns: [
        {
          pattern: 'hola',
          frequency: 10,
          context: ['buenos', 'días'],
          confidence: 0.95,
          lastSeen: new Date()
        }
      ],
      safetyLevel: 'teen',
      lastUpdated: new Date()
    };

    service.updateUserProfile(userId, profile);
    
    const testAudio = generateTestAudio(1.0);
    const audioStream = new MockAudioStream([testAudio]);
    
    const result = await service.recognize(audioStream, userId);
    
    expect(result.userId).toBe(userId);
    expect(result.language).toBe('es');
  });
});

describe('RecognitionErrorHandler', () => {
  let errorHandler: RecognitionErrorHandler;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      timeoutDuration: 30,
      pauseDetectionThreshold: 3,
      confidenceThreshold: 0.7,
      maxRetries: 3,
      clarificationTimeout: 10,
      degradationThresholds: { low: 0.3, medium: 0.5, high: 0.7 }
    };

    errorHandler = new RecognitionErrorHandler(mockConfig);
  });

  test('should handle timeout scenarios', (done) => {
    const sessionId = 'test-session-123';
    
    errorHandler.on('timeout', ({ error, recoveryAction }) => {
      expect(error.type).toBe('timeout');
      expect(error.userMessage).toContain('try again');
      expect(recoveryAction.type).toBe('retry');
      done();
    });

    errorHandler.startTimeoutMonitoring(sessionId);
    
    // Simulate no activity for timeout duration
    setTimeout(() => {
      // Timeout should trigger
    }, 100);
  });

  test('should handle low confidence recognition', () => {
    const sessionId = 'test-session-456';
    const lowConfidenceResult = {
      text: 'unclear speech',
      confidence: 0.2,
      alternatives: ['unclear speech', 'nuclear speech'],
      processingTime: 200,
      language: 'en'
    };

    const recoveryAction = errorHandler.handleLowConfidence(sessionId, lowConfidenceResult);
    
    expect(recoveryAction.type).toBe('clarify');
    expect(recoveryAction.message).toContain('repeat');
    expect(recoveryAction.parameters.possibleTexts).toContain('unclear speech');
  });

  test('should implement graceful degradation', () => {
    const sessionId = 'test-session-789';
    const mediumConfidenceResult = {
      text: 'somewhat clear speech',
      confidence: 0.4,
      alternatives: ['somewhat clear speech'],
      processingTime: 150,
      language: 'en'
    };

    const { degradedResult, warnings } = errorHandler.implementGracefulDegradation(
      sessionId,
      mediumConfidenceResult,
      0.7
    );

    expect(degradedResult.text).toContain('[uncertain]');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings).toContain('Uncertainty marker added');
  });

  test('should handle processing errors', () => {
    const sessionId = 'test-session-error';
    const processingError = new Error('Model loading failed');

    const recoveryAction = errorHandler.handleProcessingError(sessionId, processingError);

    expect(recoveryAction.type).toBe('retry');
    expect(recoveryAction.message).toContain('try again');
    expect(recoveryAction.parameters.resetAudio).toBe(true);
  });

  test('should handle audio quality issues', () => {
    const sessionId = 'test-session-quality';
    const poorQualityMetrics = {
      volume: 0.05, // Very low volume
      noiseLevel: 0.8, // High noise
      clarity: 0.2 // Poor clarity
    };

    const recoveryAction = errorHandler.handleAudioQualityError(sessionId, poorQualityMetrics);

    expect(recoveryAction.type).toBe('retry');
    expect(recoveryAction.message).toContain('louder');
    expect(recoveryAction.parameters.adjustAudioSettings).toBe(true);
  });

  test('should track error statistics', () => {
    const sessionId = 'test-session-stats';
    
    // Generate various errors
    errorHandler.handleProcessingError(sessionId, new Error('Test error 1'));
    errorHandler.handleLowConfidence(sessionId, {
      text: 'test',
      confidence: 0.1,
      alternatives: [],
      processingTime: 100,
      language: 'en'
    });
    
    const stats = errorHandler.getErrorStats();
    
    expect(stats.totalErrors).toBe(2);
    expect(stats.errorsByType.processing).toBe(1);
    expect(stats.errorsByType.low_confidence).toBe(1);
    expect(stats.recoverySuccessRate).toBeGreaterThan(0);
  });

  test('should handle pause detection', (done) => {
    const sessionId = 'test-session-pause';
    
    errorHandler.on('pause-detected', ({ sessionId: sid, pauseDuration }) => {
      expect(sid).toBe(sessionId);
      expect(pauseDuration).toBeGreaterThanOrEqual(3);
      done();
    });

    errorHandler.startTimeoutMonitoring(sessionId);
    
    // Simulate audio activity followed by pause
    errorHandler.updateActivity(sessionId, true);
    
    setTimeout(() => {
      errorHandler.updateActivity(sessionId, false);
    }, 50);
  });
});

describe('VoiceProfileManager', () => {
  let profileManager: VoiceProfileManager;

  beforeEach(() => {
    profileManager = new VoiceProfileManager();
  });

  test('should create and manage user profiles', async () => {
    const userId = 'test-user-profile';
    const initialSettings = {
      preferredLanguage: 'fr',
      safetyLevel: 'teen' as const
    };

    const profile = await profileManager.createProfile(userId, initialSettings);

    expect(profile.userId).toBe(userId);
    expect(profile.preferredLanguage).toBe('fr');
    expect(profile.safetyLevel).toBe('teen');
    expect(profile.encryptionKey).toBeDefined();
  });

  test('should adapt profiles based on recognition results', async () => {
    const userId = 'test-user-adaptation';
    await profileManager.createProfile(userId, {});

    const recognitionResult = {
      text: 'hello world test pattern',
      confidence: 0.85,
      alternatives: [],
      processingTime: 200,
      language: 'en'
    };

    const audioMetrics = {
      formants: new Array(64).fill(0).map(() => Math.random()),
      pitch: { mean: 150, variance: 20 }
    };

    await profileManager.adaptProfile(userId, recognitionResult, audioMetrics);

    const metrics = profileManager.getProfileMetrics(userId);
    expect(metrics).toBeDefined();
    expect(metrics!.totalInteractions).toBeGreaterThan(0);
  });

  test('should handle multiple languages', async () => {
    const userId = 'test-user-multilang';
    await profileManager.createProfile(userId, { preferredLanguage: 'en' });

    const success = await profileManager.switchLanguage(userId, 'es');
    expect(success).toBe(true);

    const profile = await profileManager.loadProfile(userId);
    expect(profile!.preferredLanguage).toBe('es');
  });

  test('should validate safety levels', async () => {
    const userId = 'test-user-safety';
    
    // Test invalid safety level defaults to 'child'
    const profile = await profileManager.createProfile(userId, {
      safetyLevel: 'invalid' as any
    });

    expect(profile.safetyLevel).toBe('child');
  });

  test('should encrypt and secure profiles', async () => {
    const userId = 'test-user-security';
    const profile = await profileManager.createProfile(userId, {});

    expect(profile.encryptionKey).toBeDefined();
    expect(profile.encryptionKey!.length).toBe(64); // 32 bytes in hex
  });
});

describe('Integration Tests', () => {
  let service: SpeechRecognitionService;

  beforeEach(async () => {
    const config = {
      whisper: {
        modelPath: '/test/models/whisper-en.bin',
        language: 'en',
        maxTokens: 256,
        temperature: 0.0,
        beamSize: 5,
        enableVAD: true,
        vadThreshold: 0.5
      },
      preprocessing: {
        noiseReduction: { enabled: true, strength: 0.5, adaptiveMode: true },
        normalization: { enabled: true, targetLevel: -20, maxGain: 20 },
        filtering: { enabled: true, highPassCutoff: 80, lowPassCutoff: 8000 },
        enhancement: { enabled: true, speechClarity: 0.7, dynamicRange: 0.5 }
      },
      confidence: {
        minConfidenceThreshold: 0.7,
        maxAlternatives: 3,
        contextWeight: 0.3,
        acousticWeight: 0.4,
        languageWeight: 0.2,
        pronunciationWeight: 0.1
      },
      errorHandling: {
        timeoutDuration: 30,
        pauseDetectionThreshold: 3,
        confidenceThreshold: 0.7,
        maxRetries: 3,
        clarificationTimeout: 10,
        degradationThresholds: { low: 0.3, medium: 0.5, high: 0.7 }
      },
      performance: {
        maxLatency: 500,
        memoryThreshold: 1500,
        cpuThreshold: 70
      }
    };

    service = new SpeechRecognitionService(config);
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  test('should handle complete recognition workflow', async () => {
    const userId = 'integration-test-user';
    
    // Create user profile
    const profile: VoiceProfile = {
      userId,
      preferredLanguage: 'en',
      accentAdaptation: {
        region: 'us',
        confidence: 0.8,
        adaptationData: new Float32Array(128),
        phonemeMapping: {},
        lastTraining: new Date()
      },
      speechPatterns: [],
      safetyLevel: 'child',
      lastUpdated: new Date()
    };

    service.updateUserProfile(userId, profile);

    // Test recognition with preprocessing and error handling
    const testAudio = generateTestAudio(2.0, 16000, 440);
    const audioStream = new MockAudioStream([testAudio]);

    const result = await service.recognize(audioStream, userId);

    expect(result).toBeDefined();
    expect(result.userId).toBe(userId);
    expect(result.processingTime).toBeLessThan(500);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('should handle error recovery scenarios', async () => {
    const userId = 'error-recovery-user';
    
    // Test with very poor quality audio
    const noisyAudio = generateTestAudio(0.1, 8000, 50); // Short, low quality
    const audioStream = new MockAudioStream([noisyAudio]);

    let errorHandled = false;
    service.on('recognition-error', () => {
      errorHandled = true;
    });

    try {
      await service.recognize(audioStream, userId);
    } catch (error) {
      expect(error).toBeDefined();
      expect(errorHandled).toBe(true);
    }
  });

  test('should maintain performance under load', async () => {
    const concurrentRequests = 5;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      const testAudio = generateTestAudio(1.0);
      const audioStream = new MockAudioStream([testAudio]);
      promises.push(service.recognize(audioStream, `user-${i}`));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    expect(results.length).toBe(concurrentRequests);
    expect(totalTime).toBeLessThan(2000); // Should handle 5 requests in under 2 seconds
    
    results.forEach(result => {
      expect(result.processingTime).toBeLessThan(500);
    });
  });
});