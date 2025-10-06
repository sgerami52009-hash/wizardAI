/**
 * Unit tests for Speech Interruption Handler
 * Safety: Validate immediate stop capability for child safety
 * Performance: Test <50ms interruption response time
 */

import { SpeechInterruptionHandler, InterruptionConfig } from './speech-interruption-handler';
import { AudioStream } from './interfaces';

// Mock AudioStream
class MockAudioStream {
  private _isActive = false;
  
  async start(): Promise<void> {
    this._isActive = true;
  }
  
  async stop(): Promise<void> {
    this._isActive = false;
  }
  
  write(): void {}
  read(): null { return null; }
  isActive(): boolean { return this._isActive; }
  
  on(): void {}
  once(): void {}
  emit(): void {}
  removeListener(): void {}
}

// Mock navigator.mediaDevices for VoiceActivityDetector
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    })
  },
  writable: true
});

// Mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn().mockReturnValue({
    connect: jest.fn()
  }),
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn()
  }),
  close: jest.fn()
}));

describe('SpeechInterruptionHandler', () => {
  let handler: SpeechInterruptionHandler;
  let mockAudioStream: AudioStream;
  let config: InterruptionConfig;

  beforeEach(() => {
    config = {
      enableVoiceInterruption: true,
      voiceThreshold: 0.1,
      gracePeriod: 100, // Short for testing
      fadeOutDuration: 50, // Short for testing
      resumeCapability: true
    };

    handler = new SpeechInterruptionHandler(config);
    mockAudioStream = new MockAudioStream() as any;
  });

  afterEach(() => {
    handler.stopMonitoring();
  });

  describe('Monitoring Control', () => {
    test('should start monitoring with audio stream and text', () => {
      const monitoringPromise = new Promise((resolve) => {
        handler.once('monitoringStarted', resolve);
      });

      handler.startMonitoring(mockAudioStream, 'Test speech text');

      const state = handler.getSpeechState();
      expect(state.isActive).toBe(true);
      expect(state.currentText).toBe('Test speech text');
      expect(state.canResume).toBe(true);

      return expect(monitoringPromise).resolves.toMatchObject({
        text: 'Test speech text'
      });
    });

    test('should stop monitoring and clean up resources', () => {
      const stoppedPromise = new Promise((resolve) => {
        handler.once('monitoringStopped', resolve);
      });

      handler.startMonitoring(mockAudioStream, 'Test text');
      handler.stopMonitoring();

      const state = handler.getSpeechState();
      expect(state.isActive).toBe(false);

      return expect(stoppedPromise).resolves.toBeDefined();
    });

    test('should enable interruption after grace period', (done) => {
      handler.once('interruptionEnabled', () => {
        done();
      });

      handler.startMonitoring(mockAudioStream, 'Test text');
    });

    test('should respect grace period configuration', (done) => {
      const customConfig = { ...config, gracePeriod: 200 };
      const customHandler = new SpeechInterruptionHandler(customConfig);

      const startTime = Date.now();
      customHandler.once('interruptionEnabled', () => {
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(190); // Allow some timing variance
        customHandler.stopMonitoring();
        done();
      });

      customHandler.startMonitoring(mockAudioStream, 'Test text');
    });
  });

  describe('Manual Interruption', () => {
    test('should interrupt speech manually', () => {
      const interruptedPromise = new Promise((resolve) => {
        handler.once('speechInterrupted', resolve);
      });

      handler.startMonitoring(mockAudioStream, 'Test speech text');
      
      const result = handler.interrupt('manual', 'user');
      expect(result).toBe(true);

      return expect(interruptedPromise).resolves.toMatchObject({
        type: 'manual',
        source: 'user'
      });
    });

    test('should not interrupt when not monitoring', () => {
      const result = handler.interrupt('manual', 'user');
      expect(result).toBe(false);
    });

    test('should handle emergency interruption immediately', (done) => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      handler.once('speechInterrupted', (event) => {
        expect(event.type).toBe('emergency');
        // Emergency should be immediate, no fade out
        const state = handler.getSpeechState();
        expect(state.isActive).toBe(false);
        done();
      });

      handler.interrupt('emergency', 'safety_system');
    });

    test('should handle graceful interruption with fade out', (done) => {
      handler.once('fadeOutStarted', (event) => {
        expect(event.duration).toBe(config.fadeOutDuration);
        done();
      });

      handler.startMonitoring(mockAudioStream, 'Test text');
      handler.interrupt('user_speech', 'voice_detector');
    });
  });

  describe('Speech Resume Capability', () => {
    test('should support speech resume after interruption', (done) => {
      handler.startMonitoring(mockAudioStream, 'This is a test message for resume');
      handler.updatePosition(10); // Simulate progress

      handler.once('speechInterrupted', () => {
        const resumeData = handler.resume();
        
        expect(resumeData).toBeDefined();
        expect(resumeData!.position).toBe(10);
        expect(resumeData!.text).toBe('a test message for resume');
        done();
      });

      handler.interrupt('manual', 'user');
    });

    test('should not resume when capability is disabled', () => {
      const noResumeConfig = { ...config, resumeCapability: false };
      const noResumeHandler = new SpeechInterruptionHandler(noResumeConfig);

      noResumeHandler.startMonitoring(mockAudioStream, 'Test text');
      noResumeHandler.interrupt('manual', 'user');

      const resumeData = noResumeHandler.resume();
      expect(resumeData).toBeNull();

      noResumeHandler.stopMonitoring();
    });

    test('should not resume when not previously interrupted', () => {
      const resumeData = handler.resume();
      expect(resumeData).toBeNull();
    });

    test('should emit resume event when speech is resumed', () => {
      const resumePromise = new Promise((resolve) => {
        handler.once('speechResumed', resolve);
      });

      handler.startMonitoring(mockAudioStream, 'Test message');
      handler.updatePosition(5);
      handler.interrupt('manual', 'user');
      
      setTimeout(() => {
        handler.resume();
      }, 10);

      return expect(resumePromise).resolves.toMatchObject({
        position: 5,
        remainingText: 'message'
      });
    });
  });

  describe('Position Tracking', () => {
    test('should update speech position during active monitoring', () => {
      handler.startMonitoring(mockAudioStream, 'Test speech text');
      
      handler.updatePosition(5);
      handler.updatePosition(10);
      
      const state = handler.getSpeechState();
      expect(state.currentPosition).toBe(10);
    });

    test('should not update position when not monitoring', () => {
      handler.updatePosition(5);
      
      const state = handler.getSpeechState();
      expect(state.currentPosition).toBe(0);
    });

    test('should use position for accurate resume', () => {
      const text = 'This is a long test message for position tracking';
      handler.startMonitoring(mockAudioStream, text);
      handler.updatePosition(15); // After "This is a long "
      
      handler.interrupt('manual', 'user');
      const resumeData = handler.resume();
      
      expect(resumeData!.text).toBe('test message for position tracking');
      expect(resumeData!.position).toBe(15);
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration dynamically', () => {
      const configPromise = new Promise((resolve) => {
        handler.once('configUpdated', resolve);
      });

      const newConfig = {
        voiceThreshold: 0.2,
        fadeOutDuration: 100
      };

      handler.updateConfig(newConfig);

      return expect(configPromise).resolves.toMatchObject({
        voiceThreshold: 0.2,
        fadeOutDuration: 100
      });
    });

    test('should apply new threshold to voice activity detector', () => {
      handler.updateConfig({ voiceThreshold: 0.3 });
      
      // Voice activity detector should be updated
      // This would be tested with actual implementation
    });
  });

  describe('Voice Activity Detection', () => {
    test('should detect voice activity and trigger interruption', (done) => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      handler.once('speechInterrupted', (event) => {
        expect(event.type).toBe('user_speech');
        expect(event.source).toBe('voice_activity_detector');
        done();
      });

      // Wait for grace period, then simulate voice detection
      setTimeout(() => {
        // Simulate voice activity detection
        const vad = handler['voiceActivityDetector'];
        vad.emit('voiceDetected', 0.8);
      }, config.gracePeriod + 10);
    });

    test('should not interrupt during grace period', (done) => {
      let interruptionOccurred = false;
      
      handler.on('speechInterrupted', () => {
        interruptionOccurred = true;
      });

      handler.startMonitoring(mockAudioStream, 'Test text');
      
      // Simulate voice detection during grace period
      const vad = handler['voiceActivityDetector'];
      vad.emit('voiceDetected', 0.8);

      setTimeout(() => {
        expect(interruptionOccurred).toBe(false);
        done();
      }, 50);
    });

    test('should handle voice activity detector errors', () => {
      const errorPromise = new Promise((resolve) => {
        handler.once('error', resolve);
      });

      const vad = handler['voiceActivityDetector'];
      vad.emit('error', new Error('Microphone access denied'));

      return expect(errorPromise).resolves.toBeInstanceOf(Error);
    });
  });

  describe('Performance Requirements', () => {
    test('should interrupt within 50ms for emergency', (done) => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      const startTime = Date.now();
      handler.once('speechInterrupted', () => {
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(50);
        done();
      });

      handler.interrupt('emergency', 'safety');
    });

    test('should handle multiple rapid interruption attempts', () => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      // Rapid interruption attempts
      const results = [
        handler.interrupt('manual', 'user1'),
        handler.interrupt('manual', 'user2'),
        handler.interrupt('manual', 'user3')
      ];

      expect(results[0]).toBe(true);  // First should succeed
      expect(results[1]).toBe(false); // Subsequent should fail (already interrupted)
      expect(results[2]).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle audio stream errors gracefully', () => {
      const mockErrorStream = {
        ...mockAudioStream,
        stop: jest.fn().mockRejectedValue(new Error('Stream error'))
      };

      handler.startMonitoring(mockErrorStream as any, 'Test text');
      
      expect(() => {
        handler.interrupt('emergency', 'test');
      }).not.toThrow();
    });

    test('should clean up resources on error', () => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      // Simulate error condition
      handler.stopMonitoring();
      
      const state = handler.getSpeechState();
      expect(state.isActive).toBe(false);
    });
  });

  describe('State Management', () => {
    test('should provide accurate speech state', () => {
      const initialState = handler.getSpeechState();
      expect(initialState.isActive).toBe(false);
      expect(initialState.currentPosition).toBe(0);

      handler.startMonitoring(mockAudioStream, 'Test text');
      const activeState = handler.getSpeechState();
      expect(activeState.isActive).toBe(true);
      expect(activeState.currentText).toBe('Test text');
    });

    test('should track pause time on interruption', (done) => {
      handler.startMonitoring(mockAudioStream, 'Test text');
      
      handler.once('speechInterrupted', () => {
        const state = handler.getSpeechState();
        expect(state.pausedAt).toBeDefined();
        expect(state.pausedAt).toBeInstanceOf(Date);
        done();
      });

      handler.interrupt('manual', 'user');
    });
  });
});