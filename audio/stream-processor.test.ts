/**
 * Audio Stream Processor Unit Tests
 * Tests real-time audio streaming and preprocessing functionality
 * Performance: Validates latency and resource usage requirements
 */

import { AudioStreamProcessorImpl } from './stream-processor';
import { AudioConfig, ProcessingConfig } from './interfaces';

describe('AudioStreamProcessor', () => {
  let processor: AudioStreamProcessorImpl;
  let mockAudioConfig: AudioConfig;
  let mockProcessingConfig: ProcessingConfig;

  beforeEach(() => {
    processor = new AudioStreamProcessorImpl();
    
    mockAudioConfig = {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      bufferSize: 1024,
      noiseReduction: true,
      echoCancellation: true,
      automaticGainControl: true,
      inputGain: 1.0,
      outputVolume: 0.8
    };

    mockProcessingConfig = {
      noiseReduction: {
        enabled: true,
        strength: 0.5,
        adaptiveMode: true
      },
      echoCancellation: {
        enabled: true,
        filterLength: 256,
        adaptationRate: 0.1
      },
      gainControl: {
        enabled: true,
        targetLevel: -20,
        maxGain: 20,
        compressionRatio: 4.0
      }
    };
  });

  describe('Input Stream Creation', () => {
    test('should create input stream with valid configuration', async () => {
      const stream = await processor.createInputStream(mockAudioConfig);
      
      expect(stream).toBeDefined();
      expect(stream.getConfig()).toEqual(mockAudioConfig);
    });

    test('should handle multiple input streams', async () => {
      const stream1 = await processor.createInputStream(mockAudioConfig);
      const stream2 = await processor.createInputStream({
        ...mockAudioConfig,
        sampleRate: 44100
      });
      
      expect(stream1).toBeDefined();
      expect(stream2).toBeDefined();
      expect(stream1).not.toBe(stream2);
    });
  });

  describe('Output Stream Creation', () => {
    test('should create output stream with valid configuration', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      expect(stream).toBeDefined();
      expect(stream.getConfig()).toEqual(mockAudioConfig);
    });

    test('should handle multiple output streams', async () => {
      const stream1 = await processor.createOutputStream(mockAudioConfig);
      const stream2 = await processor.createOutputStream({
        ...mockAudioConfig,
        channels: 2
      });
      
      expect(stream1).toBeDefined();
      expect(stream2).toBeDefined();
      expect(stream1).not.toBe(stream2);
    });
  });

  describe('Audio Processing', () => {
    let mockAudioBuffer: AudioBuffer;

    beforeEach(() => {
      // Create mock AudioBuffer
      const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      mockAudioBuffer = audioContext.createBuffer(1, 1024, 16000);
      
      // Fill with test data
      const channelData = mockAudioBuffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.5; // 440Hz tone
      }
    });

    test('should process audio with all effects enabled', async () => {
      const processedBuffer = await processor.processAudio(mockAudioBuffer, mockProcessingConfig);
      
      expect(processedBuffer).toBeDefined();
      expect(processedBuffer.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(processedBuffer.length).toBe(mockAudioBuffer.length);
      expect(processedBuffer.sampleRate).toBe(mockAudioBuffer.sampleRate);
    });

    test('should process audio with noise reduction only', async () => {
      const config = {
        ...mockProcessingConfig,
        echoCancellation: { ...mockProcessingConfig.echoCancellation, enabled: false },
        gainControl: { ...mockProcessingConfig.gainControl, enabled: false }
      };
      
      const processedBuffer = await processor.processAudio(mockAudioBuffer, config);
      
      expect(processedBuffer).toBeDefined();
      expect(processedBuffer.length).toBe(mockAudioBuffer.length);
    });

    test('should process audio with echo cancellation only', async () => {
      const config = {
        ...mockProcessingConfig,
        noiseReduction: { ...mockProcessingConfig.noiseReduction, enabled: false },
        gainControl: { ...mockProcessingConfig.gainControl, enabled: false }
      };
      
      const processedBuffer = await processor.processAudio(mockAudioBuffer, config);
      
      expect(processedBuffer).toBeDefined();
      expect(processedBuffer.length).toBe(mockAudioBuffer.length);
    });

    test('should process audio with gain control only', async () => {
      const config = {
        ...mockProcessingConfig,
        noiseReduction: { ...mockProcessingConfig.noiseReduction, enabled: false },
        echoCancellation: { ...mockProcessingConfig.echoCancellation, enabled: false }
      };
      
      const processedBuffer = await processor.processAudio(mockAudioBuffer, config);
      
      expect(processedBuffer).toBeDefined();
      expect(processedBuffer.length).toBe(mockAudioBuffer.length);
    });

    test('should handle processing errors gracefully', async () => {
      // Create invalid buffer to trigger error
      const invalidBuffer = null as any;
      
      const processedBuffer = await processor.processAudio(invalidBuffer, mockProcessingConfig);
      
      // Should return original buffer on error
      expect(processedBuffer).toBe(invalidBuffer);
    });

    test('should track processing latency', async () => {
      await processor.processAudio(mockAudioBuffer, mockProcessingConfig);
      
      const latency = processor.getLatency();
      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Input Stream Functionality', () => {
    test('should start and stop input stream', async () => {
      const stream = await processor.createInputStream(mockAudioConfig);
      
      let startedEventFired = false;
      let stoppedEventFired = false;
      
      stream.on('started', () => { startedEventFired = true; });
      stream.on('stopped', () => { stoppedEventFired = true; });
      
      await stream.start();
      expect(startedEventFired).toBe(true);
      
      await stream.stop();
      expect(stoppedEventFired).toBe(true);
    });

    test('should pause and resume input stream', async () => {
      const stream = await processor.createInputStream(mockAudioConfig);
      
      let pausedEventFired = false;
      let resumedEventFired = false;
      
      stream.on('paused', () => { pausedEventFired = true; });
      stream.on('resumed', () => { resumedEventFired = true; });
      
      await stream.start();
      
      stream.pause();
      expect(pausedEventFired).toBe(true);
      
      stream.resume();
      expect(resumedEventFired).toBe(true);
      
      await stream.stop();
    });

    test('should provide stream metrics', async () => {
      const stream = await processor.createInputStream(mockAudioConfig);
      
      const metrics = stream.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.bytesProcessed).toBe('number');
      expect(typeof metrics.droppedFrames).toBe('number');
      expect(typeof metrics.latency).toBe('number');
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });

    test('should emit audio data events', async () => {
      const stream = await processor.createInputStream(mockAudioConfig);
      
      const audioDataPromise = new Promise<Float32Array>((resolve) => {
        stream.once('audioData', resolve);
      });
      
      await stream.start();
      
      const audioData = await audioDataPromise;
      expect(audioData).toBeDefined();
      expect(audioData instanceof Float32Array).toBe(true);
      
      await stream.stop();
    });
  });

  describe('Output Stream Functionality', () => {
    let mockAudioBuffer: AudioBuffer;

    beforeEach(() => {
      const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      mockAudioBuffer = audioContext.createBuffer(1, 1024, 16000);
      
      const channelData = mockAudioBuffer.getChannelData(0);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / 16000) * 0.5;
      }
    });

    test('should write audio data to output stream', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      await expect(stream.write(mockAudioBuffer)).resolves.not.toThrow();
    });

    test('should flush output stream', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      await stream.write(mockAudioBuffer);
      await expect(stream.flush()).resolves.not.toThrow();
    });

    test('should stop output stream', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      let stoppedEventFired = false;
      stream.on('stopped', () => { stoppedEventFired = true; });
      
      await stream.write(mockAudioBuffer);
      await stream.stop();
      
      expect(stoppedEventFired).toBe(true);
    });

    test('should emit playback events', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      const playbackPromise = new Promise<Float32Array>((resolve) => {
        stream.once('audioPlayed', resolve);
      });
      
      await stream.write(mockAudioBuffer);
      
      const playedData = await playbackPromise;
      expect(playedData).toBeDefined();
      expect(playedData instanceof Float32Array).toBe(true);
    });

    test('should handle buffer overflow', async () => {
      const stream = await processor.createOutputStream(mockAudioConfig);
      
      // Fill buffer beyond capacity
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(stream.write(mockAudioBuffer).catch(e => e));
      }
      
      const results = await Promise.all(promises);
      
      // Some writes should fail due to buffer overflow
      const errors = results.filter(r => r instanceof Error);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('should meet latency requirements for Jetson Nano Orin', async () => {
      const mockAudioBuffer = new (globalThis.AudioContext || globalThis.webkitAudioContext)()
        .createBuffer(1, 1024, 16000);
      
      const startTime = performance.now();
      await processor.processAudio(mockAudioBuffer, mockProcessingConfig);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      // Should process audio within reasonable time for real-time constraints
      expect(processingTime).toBeLessThan(50); // 50ms max for 1024 samples at 16kHz
    });

    test('should handle concurrent processing requests', async () => {
      const mockAudioBuffer = new (globalThis.AudioContext || globalThis.webkitAudioContext)()
        .createBuffer(1, 512, 16000);
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(processor.processAudio(mockAudioBuffer, mockProcessingConfig));
      }
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.length).toBe(512);
      });
    });
  });
});