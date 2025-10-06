/**
 * Wake Word Detection Engine Unit Tests
 * Tests wake word detection accuracy, resource usage, and error handling
 * Safety: Validates content filtering and resource constraints
 * Performance: Tests <200ms activation latency requirements
 */

import { WakeWordDetectorImpl, WakeWordConfig } from './wake-word-detector';
import { WakeWordResult, AudioBuffer } from './interfaces';
import { voiceEventBus, VoiceEventTypes } from './event-bus';
import { CircularAudioBufferImpl } from '../audio/circular-buffer';
import { CircularAudioBuffer } from '../audio/interfaces';

// Mock CircularAudioBuffer
jest.mock('../audio/circular-buffer');

describe('WakeWordDetector', () => {
  let detector: WakeWordDetectorImpl;
  let mockAudioBuffer: jest.Mocked<CircularAudioBuffer>;
  let config: WakeWordConfig;

  beforeEach(() => {
    config = {
      sensitivity: 0.7,
      bufferDurationMs: 2000,
      sampleRate: 16000,
      channels: 1,
      confidenceThreshold: 0.8,
      temporalValidationMs: 500,
      maxConcurrentModels: 3
    };

    // Create a proper mock
    mockAudioBuffer = {
      write: jest.fn().mockReturnValue(true),
      read: jest.fn().mockReturnValue(null),
      peek: jest.fn().mockReturnValue(new Float32Array(1000)),
      getAvailableData: jest.fn().mockReturnValue(0),
      getAvailableSpace: jest.fn().mockReturnValue(1000),
      clear: jest.fn(),
      resize: jest.fn()
    };

    detector = new WakeWordDetectorImpl(config);
    
    // Replace the internal buffer with our mock
    (detector as any).audioBuffer = mockAudioBuffer;
  });

  afterEach(() => {
    detector.destroy();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultDetector = new WakeWordDetectorImpl();
      expect(defaultDetector).toBeDefined();
      
      const status = defaultDetector.getStatus();
      expect(status.isListening).toBe(false);
      expect(status.activeModels).toBe(0);
      expect(status.sensitivity).toBe(0.7); // Default sensitivity
      
      defaultDetector.destroy();
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        sensitivity: 0.9,
        confidenceThreshold: 0.85,
        maxConcurrentModels: 2
      };
      
      const customDetector = new WakeWordDetectorImpl(customConfig);
      const status = customDetector.getStatus();
      
      expect(status.sensitivity).toBe(0.9);
      customDetector.destroy();
    });
  });

  describe('Wake Word Management', () => {
    test('should add wake word successfully', async () => {
      const phrase = 'Hey Assistant';
      const modelPath = './models/hey-assistant.tflite';
      
      await expect(detector.addWakeWord(phrase, modelPath)).resolves.not.toThrow();
      
      const activeWakeWords = detector.getActiveWakeWords();
      expect(activeWakeWords).toContain(phrase);
    });

    test('should reject invalid wake word phrases', async () => {
      const invalidPhrases = [
        '', // Empty
        'a', // Too short
        'this is a very long wake word phrase that exceeds limits', // Too long
        'hey123', // Contains numbers
        'hey!', // Contains special characters
      ];

      for (const phrase of invalidPhrases) {
        await expect(detector.addWakeWord(phrase, './model.tflite'))
          .rejects.toThrow('Invalid wake word phrase');
      }
    });

    test('should reject duplicate wake words', async () => {
      const phrase = 'Hello Helper';
      const modelPath = './models/hello-helper.tflite';
      
      await detector.addWakeWord(phrase, modelPath);
      
      await expect(detector.addWakeWord(phrase, modelPath))
        .rejects.toThrow(`Wake word "${phrase}" already exists`);
    });

    test('should enforce maximum concurrent models limit', async () => {
      const phrases = ['Wake One', 'Wake Two', 'Wake Three', 'Wake Four'];
      
      // Add up to the limit
      for (let i = 0; i < config.maxConcurrentModels; i++) {
        await detector.addWakeWord(phrases[i], `./model${i}.tflite`);
      }
      
      // Adding one more should fail
      await expect(detector.addWakeWord(phrases[3], './model3.tflite'))
        .rejects.toThrow(`Maximum ${config.maxConcurrentModels} wake word models allowed`);
    });

    test('should remove wake word successfully', async () => {
      const phrase = 'Test Wake Word';
      await detector.addWakeWord(phrase, './test-model.tflite');
      
      expect(detector.getActiveWakeWords()).toContain(phrase);
      
      await detector.removeWakeWord(phrase);
      
      expect(detector.getActiveWakeWords()).not.toContain(phrase);
    });

    test('should handle removal of non-existent wake word', async () => {
      await expect(detector.removeWakeWord('Non Existent'))
        .rejects.toThrow('Wake word "Non Existent" not found');
    });
  });

  describe('Sensitivity Control', () => {
    test('should update sensitivity within valid range', () => {
      const validSensitivities = [0.0, 0.5, 1.0];
      
      validSensitivities.forEach(sensitivity => {
        expect(() => detector.updateSensitivity(sensitivity)).not.toThrow();
        expect(detector.getStatus().sensitivity).toBe(sensitivity);
      });
    });

    test('should reject invalid sensitivity values', () => {
      const invalidSensitivities = [-0.1, 1.1, NaN, Infinity];
      
      invalidSensitivities.forEach(sensitivity => {
        expect(() => detector.updateSensitivity(sensitivity))
          .toThrow('Sensitivity must be between 0.0 and 1.0');
      });
    });

    test('should emit sensitivity update events', () => {
      const eventSpy = jest.fn();
      detector.on('sensitivity-updated', eventSpy);
      
      detector.updateSensitivity(0.8);
      
      expect(eventSpy).toHaveBeenCalledWith(0.8);
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      // Add a test wake word
      await detector.addWakeWord('Test Wake', './test-model.tflite');
    });

    test('should process audio data when listening', async () => {
      mockAudioBuffer.write.mockReturnValue(true);
      mockAudioBuffer.getAvailableData.mockReturnValue(8000); // 500ms at 16kHz
      
      await detector.startListening();
      
      const audioData: AudioBuffer = {
        data: new Float32Array(1024),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now()
      };
      
      expect(() => detector.processAudioData(audioData)).not.toThrow();
      expect(mockAudioBuffer.write).toHaveBeenCalledWith(audioData.data);
    });

    test('should ignore audio data when not listening', () => {
      const audioData: AudioBuffer = {
        data: new Float32Array(1024),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now()
      };
      
      detector.processAudioData(audioData);
      
      expect(mockAudioBuffer.write).not.toHaveBeenCalled();
    });

    test('should handle audio processing errors gracefully', async () => {
      mockAudioBuffer.write.mockImplementation(() => {
        throw new Error('Buffer overflow');
      });
      
      await detector.startListening();
      
      const errorSpy = jest.fn();
      detector.on('error', errorSpy);
      
      const audioData: AudioBuffer = {
        data: new Float32Array(1024),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now()
      };
      
      detector.processAudioData(audioData);
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Wake Word Detection', () => {
    beforeEach(async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      mockAudioBuffer.getAvailableData.mockReturnValue(16000); // 1 second at 16kHz
      mockAudioBuffer.peek.mockReturnValue(new Float32Array(16000));
    });

    test('should detect wake word with sufficient confidence', async () => {
      await detector.startListening();
      
      const detectionPromise = new Promise<WakeWordResult>((resolve) => {
        detector.once('wake-word-detected', resolve);
      });
      
      // Mock high confidence detection
      jest.spyOn(detector as any, 'runModelInference').mockReturnValue(0.9);
      
      // Trigger processing
      (detector as any).processWakeWordDetection();
      
      const result = await detectionPromise;
      expect(result.phrase).toBe('Test Wake');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('should not detect wake word with low confidence', async () => {
      await detector.startListening();
      
      const detectionSpy = jest.fn();
      detector.on('wake-word-detected', detectionSpy);
      
      // Mock low confidence detection
      jest.spyOn(detector as any, 'runModelInference').mockReturnValue(0.5);
      
      // Trigger processing
      (detector as any).processWakeWordDetection();
      
      // Wait a bit to ensure no detection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(detectionSpy).not.toHaveBeenCalled();
    });

    test('should prevent rapid false positives with temporal validation', async () => {
      await detector.startListening();
      
      const detectionSpy = jest.fn();
      detector.on('wake-word-detected', detectionSpy);
      
      // Mock high confidence detection
      jest.spyOn(detector as any, 'runModelInference').mockReturnValue(0.9);
      
      // Trigger multiple rapid detections
      (detector as any).processWakeWordDetection();
      (detector as any).processWakeWordDetection();
      (detector as any).processWakeWordDetection();
      
      // Should only detect once due to temporal validation
      expect(detectionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Listening Control', () => {
    test('should start listening successfully', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      
      await expect(detector.startListening()).resolves.not.toThrow();
      
      const status = detector.getStatus();
      expect(status.isListening).toBe(true);
    });

    test('should fail to start listening without wake words', async () => {
      await expect(detector.startListening())
        .rejects.toThrow('No wake word models loaded');
    });

    test('should stop listening successfully', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      await expect(detector.stopListening()).resolves.not.toThrow();
      
      const status = detector.getStatus();
      expect(status.isListening).toBe(false);
    });

    test('should clear audio buffer on stop for privacy', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      await detector.stopListening();
      
      expect(mockAudioBuffer.clear).toHaveBeenCalled();
    });

    test('should emit listening state events', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      detector.on('listening-started', startSpy);
      detector.on('listening-stopped', stopSpy);
      
      await detector.startListening();
      expect(startSpy).toHaveBeenCalled();
      
      await detector.stopListening();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Event Bus Integration', () => {
    test('should publish wake word detection events', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      const eventSpy = jest.spyOn(voiceEventBus, 'publishEvent');
      
      // Mock detection
      jest.spyOn(detector as any, 'runModelInference').mockReturnValue(0.9);
      mockAudioBuffer.getAvailableData.mockReturnValue(16000);
      mockAudioBuffer.peek.mockReturnValue(new Float32Array(16000));
      
      (detector as any).processWakeWordDetection();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: VoiceEventTypes.WAKE_WORD_DETECTED,
          source: 'WakeWordDetector'
        })
      );
    });

    test('should publish lifecycle events', async () => {
      const eventSpy = jest.spyOn(voiceEventBus, 'publishEvent');
      
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: VoiceEventTypes.WAKE_WORD_DETECTOR_STARTED
        })
      );
      
      await detector.stopListening();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: VoiceEventTypes.WAKE_WORD_DETECTOR_STOPPED
        })
      );
    });
  });

  describe('Resource Monitoring', () => {
    test('should monitor resource usage', () => {
      const status = detector.getStatus();
      
      expect(status.resourceUsage).toBeDefined();
      expect(typeof status.resourceUsage.memoryMB).toBe('number');
    });

    test('should handle resource warnings', async () => {
      const warningSpy = jest.fn();
      detector.on('resource-warning', warningSpy);
      
      // Simulate resource warning
      const resourceMonitor = (detector as any).resourceMonitor;
      resourceMonitor.emit('resource-warning', { type: 'memory', usage: 1300 });
      
      expect(warningSpy).toHaveBeenCalled();
    });

    test('should stop on critical resource usage', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      const errorSpy = jest.fn();
      detector.on('error', errorSpy);
      
      // Simulate critical resource usage
      const resourceMonitor = (detector as any).resourceMonitor;
      resourceMonitor.emit('resource-critical');
      
      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(detector.getStatus().isListening).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    test('should process wake word detection within latency requirements', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      mockAudioBuffer.getAvailableData.mockReturnValue(16000);
      mockAudioBuffer.peek.mockReturnValue(new Float32Array(16000));
      
      const startTime = Date.now();
      (detector as any).processWakeWordDetection();
      const endTime = Date.now();
      
      // Should complete within 200ms requirement
      expect(endTime - startTime).toBeLessThan(200);
    });

    test('should maintain efficient memory usage', () => {
      const status = detector.getStatus();
      
      // Should use less than 100MB for wake word detection
      expect(status.resourceUsage.memoryMB).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle model loading failures gracefully', async () => {
      // Mock model loading failure
      jest.spyOn(detector as any, 'loadModelFile').mockRejectedValue(new Error('Model not found'));
      
      await expect(detector.addWakeWord('Test Wake', './invalid-model.tflite'))
        .rejects.toThrow('Failed to load wake word model');
    });

    test('should emit errors for invalid operations', async () => {
      const errorSpy = jest.fn();
      detector.on('error', errorSpy);
      
      try {
        await detector.addWakeWord('', './model.tflite');
      } catch (error) {
        // Expected to throw
      }
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Destruction', () => {
    test('should cleanup resources on destroy', () => {
      const clearSpy = jest.spyOn(mockAudioBuffer, 'clear');
      const removeListenersSpy = jest.spyOn(detector, 'removeAllListeners');
      
      detector.destroy();
      
      expect(clearSpy).toHaveBeenCalled();
      expect(removeListenersSpy).toHaveBeenCalled();
    });

    test('should stop listening on destroy', async () => {
      await detector.addWakeWord('Test Wake', './test-model.tflite');
      await detector.startListening();
      
      expect(detector.getStatus().isListening).toBe(true);
      
      detector.destroy();
      
      expect(detector.getStatus().isListening).toBe(false);
    });
  });
});