/**
 * Audio Format Conversion Utilities
 * Provides sample rate, channel, and bit depth conversion
 * Performance: Optimized for Jetson Nano Orin hardware constraints
 * Safety: Memory-efficient processing with bounds checking
 */

import { AudioUtils } from './interfaces';

export class AudioUtilsImpl implements AudioUtils {
  
  /**
   * Convert audio buffer to different sample rate
   * Performance: Uses linear interpolation for efficiency on Jetson Nano Orin
   */
  convertSampleRate(buffer: AudioBuffer, targetRate: number): AudioBuffer {
    if (buffer.sampleRate === targetRate) {
      return buffer;
    }

    const ratio = targetRate / buffer.sampleRate;
    const targetLength = Math.floor(buffer.length * ratio);
    
    // Create new buffer with target sample rate
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      targetLength,
      targetRate
    );

    // Convert each channel
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      this.resampleChannel(inputData, outputData, ratio);
    }

    return newBuffer;
  }

  /**
   * Convert number of audio channels (mono/stereo conversion)
   * Safety: Handles all common channel configurations
   */
  convertChannels(buffer: AudioBuffer, targetChannels: number): AudioBuffer {
    if (buffer.numberOfChannels === targetChannels) {
      return buffer;
    }

    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      targetChannels,
      buffer.length,
      buffer.sampleRate
    );

    if (targetChannels === 1 && buffer.numberOfChannels === 2) {
      // Stereo to mono: average left and right channels
      const leftData = buffer.getChannelData(0);
      const rightData = buffer.getChannelData(1);
      const monoData = newBuffer.getChannelData(0);
      
      for (let i = 0; i < buffer.length; i++) {
        monoData[i] = (leftData[i] + rightData[i]) * 0.5;
      }
    } else if (targetChannels === 2 && buffer.numberOfChannels === 1) {
      // Mono to stereo: duplicate mono channel
      const monoData = buffer.getChannelData(0);
      const leftData = newBuffer.getChannelData(0);
      const rightData = newBuffer.getChannelData(1);
      
      for (let i = 0; i < buffer.length; i++) {
        leftData[i] = monoData[i];
        rightData[i] = monoData[i];
      }
    } else {
      // Handle other channel configurations
      this.convertMultiChannel(buffer, newBuffer, targetChannels);
    }

    return newBuffer;
  }

  /**
   * Convert bit depth (quantization)
   * Performance: Optimized for common bit depths (16, 24, 32)
   */
  convertBitDepth(buffer: AudioBuffer, targetDepth: number): AudioBuffer {
    // Note: Web Audio API uses 32-bit float internally
    // This method would be more relevant in native implementations
    // For now, we'll return the buffer as-is since Web Audio handles this
    
    if (targetDepth === 32) {
      return buffer; // Already 32-bit float
    }

    // In a real implementation, this would quantize to target bit depth
    // For demonstration, we'll simulate the quantization effect
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const quantizationLevels = Math.pow(2, targetDepth - 1);
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        // Quantize to target bit depth
        const quantized = Math.round(inputData[i] * quantizationLevels) / quantizationLevels;
        outputData[i] = Math.max(-1, Math.min(1, quantized));
      }
    }

    return newBuffer;
  }

  /**
   * Normalize audio volume to target level
   * Safety: Prevents clipping and maintains audio quality
   */
  normalizeVolume(buffer: AudioBuffer, targetLevel: number): AudioBuffer {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    // Find peak amplitude across all channels
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        peak = Math.max(peak, Math.abs(channelData[i]));
      }
    }

    if (peak === 0) {
      // Silent audio, return as-is
      return buffer;
    }

    // Calculate gain to reach target level
    const gain = targetLevel / peak;
    
    // Apply gain to all channels
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        outputData[i] = Math.max(-1, Math.min(1, inputData[i] * gain));
      }
    }

    return newBuffer;
  }

  /**
   * Detect silence in audio buffer
   * Performance: Fast threshold-based detection
   */
  detectSilence(buffer: AudioBuffer, threshold: number): boolean {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > threshold) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Calculate RMS (Root Mean Square) level
   * Performance: Efficient power calculation for level monitoring
   */
  calculateRMS(buffer: AudioBuffer): number {
    let sumSquares = 0;
    let sampleCount = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        sumSquares += channelData[i] * channelData[i];
        sampleCount++;
      }
    }

    return sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  }

  /**
   * Apply fade-in effect
   * Safety: Smooth transitions to prevent audio pops
   */
  applyFadeIn(buffer: AudioBuffer, duration: number): AudioBuffer {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const fadeSamples = Math.min(
      Math.floor(duration * buffer.sampleRate),
      buffer.length
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        let gain = 1;
        if (i < fadeSamples) {
          gain = i / fadeSamples; // Linear fade-in
        }
        outputData[i] = inputData[i] * gain;
      }
    }

    return newBuffer;
  }

  /**
   * Apply fade-out effect
   * Safety: Smooth transitions to prevent audio pops
   */
  applyFadeOut(buffer: AudioBuffer, duration: number): AudioBuffer {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const newBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    const fadeSamples = Math.min(
      Math.floor(duration * buffer.sampleRate),
      buffer.length
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        let gain = 1;
        if (i >= buffer.length - fadeSamples) {
          const fadePosition = buffer.length - i;
          gain = fadePosition / fadeSamples; // Linear fade-out
        }
        outputData[i] = inputData[i] * gain;
      }
    }

    return newBuffer;
  }

  /**
   * Resample a single channel using linear interpolation
   * Performance: Optimized for real-time processing
   */
  private resampleChannel(input: Float32Array, output: Float32Array, ratio: number): void {
    for (let i = 0; i < output.length; i++) {
      const sourceIndex = i / ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;
      
      if (index >= input.length - 1) {
        output[i] = input[input.length - 1];
      } else {
        // Linear interpolation
        output[i] = input[index] * (1 - fraction) + input[index + 1] * fraction;
      }
    }
  }

  /**
   * Handle complex multi-channel conversions
   * Safety: Graceful handling of unusual channel configurations
   */
  private convertMultiChannel(source: AudioBuffer, target: AudioBuffer, targetChannels: number): void {
    const sourceChannels = source.numberOfChannels;
    
    for (let targetChannel = 0; targetChannel < targetChannels; targetChannel++) {
      const targetData = target.getChannelData(targetChannel);
      
      if (targetChannel < sourceChannels) {
        // Direct copy if source channel exists
        const sourceData = source.getChannelData(targetChannel);
        targetData.set(sourceData);
      } else {
        // Use first channel as fallback
        const sourceData = source.getChannelData(0);
        targetData.set(sourceData);
      }
    }
  }
}

// Export singleton instance
export const audioUtils = new AudioUtilsImpl();