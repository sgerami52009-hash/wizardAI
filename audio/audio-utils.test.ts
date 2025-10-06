/**
 * Audio Utilities Unit Tests
 * Tests audio format conversion and processing utilities
 * Performance: Validates efficiency for Jetson Nano Orin constraints
 */

import { AudioUtilsImpl } from './audio-utils';

describe('AudioUtils', () => {
  let audioUtils: AudioUtilsImpl;
  let mockAudioBuffer: AudioBuffer;
  let audioContext: AudioContext;

  beforeEach(() => {
    audioUtils = new AudioUtilsImpl();
    audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    
    // Create mock audio buffer with test data
    mockAudioBuffer = audioContext.createBuffer(2, 1024, 44100);
    
    // Fill with test sine wave
    for (let channel = 0; channel < mockAudioBuffer.numberOfChannels; channel++) {
      const channelData = mockAudioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
      }
    }
  });

  describe('Sample Rate Conversion', () => {
    test('should return same buffer when target rate matches', () => {
      const result = audioUtils.convertSampleRate(mockAudioBuffer, 44100);
      
      expect(result).toBe(mockAudioBuffer);
    });

    test('should downsample to lower sample rate', () => {
      const targetRate = 22050;
      const result = audioUtils.convertSampleRate(mockAudioBuffer, targetRate);
      
      expect(result.sampleRate).toBe(targetRate);
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(Math.floor(mockAudioBuffer.length * targetRate / mockAudioBuffer.sampleRate));
    });

    test('should upsample to higher sample rate', () => {
      const targetRate = 48000;
      const result = audioUtils.convertSampleRate(mockAudioBuffer, targetRate);
      
      expect(result.sampleRate).toBe(targetRate);
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(Math.floor(mockAudioBuffer.length * targetRate / mockAudioBuffer.sampleRate));
    });

    test('should preserve audio content during conversion', () => {
      const result = audioUtils.convertSampleRate(mockAudioBuffer, 22050);
      
      // Check that the converted audio still contains the sine wave pattern
      const channelData = result.getChannelData(0);
      let hasSignal = false;
      
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > 0.1) {
          hasSignal = true;
          break;
        }
      }
      
      expect(hasSignal).toBe(true);
    });
  });

  describe('Channel Conversion', () => {
    test('should return same buffer when channel count matches', () => {
      const result = audioUtils.convertChannels(mockAudioBuffer, 2);
      
      expect(result.numberOfChannels).toBe(2);
    });

    test('should convert stereo to mono', () => {
      const result = audioUtils.convertChannels(mockAudioBuffer, 1);
      
      expect(result.numberOfChannels).toBe(1);
      expect(result.length).toBe(mockAudioBuffer.length);
      expect(result.sampleRate).toBe(mockAudioBuffer.sampleRate);
      
      // Verify mono data is average of stereo channels
      const monoData = result.getChannelData(0);
      const leftData = mockAudioBuffer.getChannelData(0);
      const rightData = mockAudioBuffer.getChannelData(1);
      
      for (let i = 0; i < 10; i++) { // Check first 10 samples
        const expectedValue = (leftData[i] + rightData[i]) * 0.5;
        expect(monoData[i]).toBeCloseTo(expectedValue, 5);
      }
    });

    test('should convert mono to stereo', () => {
      // Create mono buffer first
      const monoBuffer = audioContext.createBuffer(1, 1024, 44100);
      const monoData = monoBuffer.getChannelData(0);
      for (let i = 0; i < monoData.length; i++) {
        monoData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
      }
      
      const result = audioUtils.convertChannels(monoBuffer, 2);
      
      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(monoBuffer.length);
      
      // Verify both channels have same data
      const leftData = result.getChannelData(0);
      const rightData = result.getChannelData(1);
      
      for (let i = 0; i < 10; i++) {
        expect(leftData[i]).toBeCloseTo(rightData[i], 5);
        expect(leftData[i]).toBeCloseTo(monoData[i], 5);
      }
    });

    test('should handle complex channel configurations', () => {
      const result = audioUtils.convertChannels(mockAudioBuffer, 4);
      
      expect(result.numberOfChannels).toBe(4);
      expect(result.length).toBe(mockAudioBuffer.length);
    });
  });

  describe('Bit Depth Conversion', () => {
    test('should return same buffer for 32-bit target', () => {
      const result = audioUtils.convertBitDepth(mockAudioBuffer, 32);
      
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(mockAudioBuffer.length);
    });

    test('should quantize to 16-bit', () => {
      const result = audioUtils.convertBitDepth(mockAudioBuffer, 16);
      
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(mockAudioBuffer.length);
      
      // Verify quantization effect
      const originalData = mockAudioBuffer.getChannelData(0);
      const quantizedData = result.getChannelData(0);
      
      // Quantized data should be slightly different due to bit depth reduction
      let hasDifference = false;
      for (let i = 0; i < 100; i++) {
        if (Math.abs(originalData[i] - quantizedData[i]) > 0.0001) {
          hasDifference = true;
          break;
        }
      }
      
      expect(hasDifference).toBe(true);
    });

    test('should prevent clipping during quantization', () => {
      const result = audioUtils.convertBitDepth(mockAudioBuffer, 16);
      const channelData = result.getChannelData(0);
      
      for (let i = 0; i < channelData.length; i++) {
        expect(channelData[i]).toBeGreaterThanOrEqual(-1);
        expect(channelData[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Volume Normalization', () => {
    test('should normalize to target level', () => {
      const targetLevel = 0.8;
      const result = audioUtils.normalizeVolume(mockAudioBuffer, targetLevel);
      
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(mockAudioBuffer.length);
      
      // Find peak in normalized audio
      let peak = 0;
      for (let channel = 0; channel < result.numberOfChannels; channel++) {
        const channelData = result.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          peak = Math.max(peak, Math.abs(channelData[i]));
        }
      }
      
      expect(peak).toBeCloseTo(targetLevel, 2);
    });

    test('should handle silent audio', () => {
      const silentBuffer = audioContext.createBuffer(1, 1024, 44100);
      // Buffer is already silent (zeros)
      
      const result = audioUtils.normalizeVolume(silentBuffer, 0.8);
      
      expect(result).toBeDefined();
      expect(result.length).toBe(silentBuffer.length);
    });

    test('should prevent clipping', () => {
      const result = audioUtils.normalizeVolume(mockAudioBuffer, 0.9);
      
      for (let channel = 0; channel < result.numberOfChannels; channel++) {
        const channelData = result.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          expect(channelData[i]).toBeGreaterThanOrEqual(-1);
          expect(channelData[i]).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Silence Detection', () => {
    test('should detect silence in quiet audio', () => {
      const quietBuffer = audioContext.createBuffer(1, 1024, 44100);
      const channelData = quietBuffer.getChannelData(0);
      
      // Fill with very quiet noise
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = (Math.random() - 0.5) * 0.001; // Very quiet
      }
      
      const isSilent = audioUtils.detectSilence(quietBuffer, 0.01);
      expect(isSilent).toBe(true);
    });

    test('should detect non-silence in loud audio', () => {
      const isSilent = audioUtils.detectSilence(mockAudioBuffer, 0.01);
      expect(isSilent).toBe(false);
    });

    test('should handle different thresholds', () => {
      const lowThreshold = audioUtils.detectSilence(mockAudioBuffer, 0.001);
      const highThreshold = audioUtils.detectSilence(mockAudioBuffer, 0.9);
      
      expect(lowThreshold).toBe(false);
      expect(highThreshold).toBe(true);
    });
  });

  describe('RMS Calculation', () => {
    test('should calculate RMS for sine wave', () => {
      const rms = audioUtils.calculateRMS(mockAudioBuffer);
      
      expect(typeof rms).toBe('number');
      expect(rms).toBeGreaterThan(0);
      
      // For a sine wave with amplitude 0.5, RMS should be approximately 0.5/√2 ≈ 0.354
      expect(rms).toBeCloseTo(0.354, 1);
    });

    test('should return zero for silent audio', () => {
      const silentBuffer = audioContext.createBuffer(1, 1024, 44100);
      const rms = audioUtils.calculateRMS(silentBuffer);
      
      expect(rms).toBe(0);
    });

    test('should handle multi-channel audio', () => {
      const rms = audioUtils.calculateRMS(mockAudioBuffer);
      
      expect(typeof rms).toBe('number');
      expect(rms).toBeGreaterThan(0);
    });
  });

  describe('Fade Effects', () => {
    test('should apply fade-in effect', () => {
      const fadeDuration = 0.1; // 100ms
      const result = audioUtils.applyFadeIn(mockAudioBuffer, fadeDuration);
      
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(mockAudioBuffer.length);
      
      // Check that audio starts quiet and gets louder
      const channelData = result.getChannelData(0);
      const fadeLength = Math.floor(fadeDuration * result.sampleRate);
      
      expect(Math.abs(channelData[0])).toBeLessThan(Math.abs(channelData[fadeLength - 1]));
    });

    test('should apply fade-out effect', () => {
      const fadeDuration = 0.1; // 100ms
      const result = audioUtils.applyFadeOut(mockAudioBuffer, fadeDuration);
      
      expect(result.numberOfChannels).toBe(mockAudioBuffer.numberOfChannels);
      expect(result.length).toBe(mockAudioBuffer.length);
      
      // Check that audio gets quieter towards the end
      const channelData = result.getChannelData(0);
      const fadeLength = Math.floor(fadeDuration * result.sampleRate);
      const fadeStart = result.length - fadeLength;
      
      expect(Math.abs(channelData[fadeStart])).toBeGreaterThan(Math.abs(channelData[result.length - 1]));
    });

    test('should handle fade duration longer than audio', () => {
      const longFadeDuration = 10; // 10 seconds, longer than audio
      
      const fadeInResult = audioUtils.applyFadeIn(mockAudioBuffer, longFadeDuration);
      const fadeOutResult = audioUtils.applyFadeOut(mockAudioBuffer, longFadeDuration);
      
      expect(fadeInResult).toBeDefined();
      expect(fadeOutResult).toBeDefined();
      expect(fadeInResult.length).toBe(mockAudioBuffer.length);
      expect(fadeOutResult.length).toBe(mockAudioBuffer.length);
    });
  });

  describe('Performance Requirements', () => {
    test('should process audio efficiently for real-time constraints', () => {
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        audioUtils.convertSampleRate(mockAudioBuffer, 16000);
        audioUtils.convertChannels(mockAudioBuffer, 1);
        audioUtils.normalizeVolume(mockAudioBuffer, 0.8);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time for real-time processing
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 iterations
    });

    test('should handle large audio buffers efficiently', () => {
      const largeBuffer = audioContext.createBuffer(2, 44100 * 5, 44100); // 5 seconds
      
      // Fill with test data
      for (let channel = 0; channel < largeBuffer.numberOfChannels; channel++) {
        const channelData = largeBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
        }
      }
      
      const startTime = performance.now();
      
      const converted = audioUtils.convertSampleRate(largeBuffer, 16000);
      const normalized = audioUtils.normalizeVolume(converted, 0.8);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(normalized).toBeDefined();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});