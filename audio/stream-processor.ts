/**
 * Audio Stream Processor Implementation
 * Provides real-time audio streaming with preprocessing
 * Performance: Optimized for Jetson Nano Orin hardware constraints
 * Safety: Memory-efficient processing with error recovery
 */

import { EventEmitter } from 'events';
import { 
  AudioStreamProcessor, 
  AudioInputStream, 
  AudioOutputStream, 
  AudioConfig, 
  ProcessingConfig, 
  StreamMetrics 
} from './interfaces';
import { CircularAudioBufferImpl } from './circular-buffer';

export class AudioStreamProcessorImpl extends EventEmitter implements AudioStreamProcessor {
  private inputStreams: Map<string, AudioInputStreamImpl> = new Map();
  private outputStreams: Map<string, AudioOutputStreamImpl> = new Map();
  private processingLatency: number = 0;

  /**
   * Create a new audio input stream
   * Performance: Optimized buffer sizes for low-latency processing
   */
  async createInputStream(config: AudioConfig): Promise<AudioInputStream> {
    const streamId = this.generateStreamId();
    const stream = new AudioInputStreamImpl(streamId, config);
    
    this.inputStreams.set(streamId, stream);
    
    // Clean up when stream is destroyed
    stream.on('destroyed', () => {
      this.inputStreams.delete(streamId);
    });

    return stream;
  }

  /**
   * Create a new audio output stream
   * Performance: Optimized for real-time audio playback
   */
  async createOutputStream(config: AudioConfig): Promise<AudioOutputStream> {
    const streamId = this.generateStreamId();
    const stream = new AudioOutputStreamImpl(streamId, config);
    
    this.outputStreams.set(streamId, stream);
    
    // Clean up when stream is destroyed
    stream.on('destroyed', () => {
      this.outputStreams.delete(streamId);
    });

    return stream;
  }

  /**
   * Process audio buffer with configured preprocessing
   * Performance: Efficient in-place processing when possible
   */
  async processAudio(input: AudioBuffer, config: ProcessingConfig): Promise<AudioBuffer> {
    const startTime = performance.now();
    
    try {
      let processedBuffer = input;

      // Apply noise reduction
      if (config.noiseReduction.enabled) {
        processedBuffer = await this.applyNoiseReduction(processedBuffer, config.noiseReduction);
      }

      // Apply echo cancellation
      if (config.echoCancellation.enabled) {
        processedBuffer = await this.applyEchoCancellation(processedBuffer, config.echoCancellation);
      }

      // Apply gain control
      if (config.gainControl.enabled) {
        processedBuffer = await this.applyGainControl(processedBuffer, config.gainControl);
      }

      const endTime = performance.now();
      this.processingLatency = endTime - startTime;

      return processedBuffer;
    } catch (error) {
      console.error('Audio processing failed:', error);
      // Return original buffer as fallback
      return input;
    }
  }

  /**
   * Get current processing latency
   */
  getLatency(): number {
    return this.processingLatency;
  }

  /**
   * Generate unique stream identifier
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Apply noise reduction processing
   * Performance: Simplified algorithm for real-time processing
   */
  private async applyNoiseReduction(
    buffer: AudioBuffer, 
    config: { strength: number; adaptiveMode: boolean }
  ): Promise<AudioBuffer> {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const processedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      // Simple noise gate implementation
      const threshold = 0.01 * (1 - config.strength);
      
      for (let i = 0; i < inputData.length; i++) {
        if (Math.abs(inputData[i]) > threshold) {
          outputData[i] = inputData[i];
        } else {
          outputData[i] = inputData[i] * (1 - config.strength);
        }
      }
    }

    return processedBuffer;
  }

  /**
   * Apply echo cancellation processing
   * Performance: Basic implementation for Jetson Nano Orin constraints
   */
  private async applyEchoCancellation(
    buffer: AudioBuffer,
    config: { filterLength: number; adaptationRate: number }
  ): Promise<AudioBuffer> {
    // Simplified echo cancellation - in production would use more sophisticated algorithms
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const processedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      // Simple high-pass filter to reduce low-frequency echo
      let prevSample = 0;
      const alpha = 0.95; // High-pass filter coefficient
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = alpha * (outputData[i - 1] || 0) + alpha * (inputData[i] - prevSample);
        prevSample = inputData[i];
      }
    }

    return processedBuffer;
  }

  /**
   * Apply automatic gain control
   * Performance: Efficient dynamic range compression
   */
  private async applyGainControl(
    buffer: AudioBuffer,
    config: { targetLevel: number; maxGain: number; compressionRatio: number }
  ): Promise<AudioBuffer> {
    const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const processedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    // Calculate RMS level
    let rmsSum = 0;
    let sampleCount = 0;
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        rmsSum += channelData[i] * channelData[i];
        sampleCount++;
      }
    }
    
    const rmsLevel = Math.sqrt(rmsSum / sampleCount);
    const targetLinear = Math.pow(10, config.targetLevel / 20); // Convert dB to linear
    
    // Calculate gain
    let gain = 1;
    if (rmsLevel > 0) {
      gain = Math.min(targetLinear / rmsLevel, Math.pow(10, config.maxGain / 20));
    }

    // Apply gain with compression
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        let sample = inputData[i] * gain;
        
        // Apply compression if signal exceeds threshold
        if (Math.abs(sample) > targetLinear) {
          const excess = Math.abs(sample) - targetLinear;
          const compressedExcess = excess / config.compressionRatio;
          sample = Math.sign(sample) * (targetLinear + compressedExcess);
        }
        
        outputData[i] = Math.max(-1, Math.min(1, sample));
      }
    }

    return processedBuffer;
  }
}

/**
 * Audio Input Stream Implementation
 */
class AudioInputStreamImpl extends EventEmitter implements AudioInputStream {
  private config: AudioConfig;
  private isActive: boolean = false;
  private isPaused: boolean = false;
  private buffer: CircularAudioBufferImpl;
  private metrics: StreamMetrics;
  private streamId: string;

  constructor(streamId: string, config: AudioConfig) {
    super();
    this.streamId = streamId;
    this.config = config;
    this.buffer = new CircularAudioBufferImpl(config.bufferSize * 4); // 4x buffer for safety
    this.metrics = {
      bytesProcessed: 0,
      droppedFrames: 0,
      latency: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.isPaused = false;
    this.emit('started');
    
    // Start audio capture simulation
    this.startAudioCapture();
  }

  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.isPaused = false;
    this.emit('stopped');
  }

  pause(): void {
    if (this.isActive && !this.isPaused) {
      this.isPaused = true;
      this.emit('paused');
    }
  }

  resume(): void {
    if (this.isActive && this.isPaused) {
      this.isPaused = false;
      this.emit('resumed');
    }
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Simulate audio capture process
   * Performance: Optimized for real-time constraints
   */
  private startAudioCapture(): void {
    const captureInterval = (this.config.bufferSize / this.config.sampleRate) * 1000;
    
    const capture = () => {
      if (!this.isActive) {
        return;
      }

      if (!this.isPaused) {
        // Simulate audio data capture
        const audioData = new Float32Array(this.config.bufferSize);
        
        // Generate mock audio data (in real implementation, this would come from microphone)
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] = (Math.random() - 0.5) * 0.1; // Low-level noise simulation
        }

        // Try to write to buffer
        if (!this.buffer.write(audioData)) {
          this.metrics.droppedFrames++;
          this.emit('bufferOverflow');
        } else {
          this.metrics.bytesProcessed += audioData.length * 4; // 4 bytes per float32
          this.emit('audioData', audioData);
        }
      }

      setTimeout(capture, captureInterval);
    };

    capture();
  }
}

/**
 * Audio Output Stream Implementation
 */
class AudioOutputStreamImpl extends EventEmitter implements AudioOutputStream {
  private config: AudioConfig;
  private buffer: CircularAudioBufferImpl;
  private metrics: StreamMetrics;
  private streamId: string;
  private isPlaying: boolean = false;

  constructor(streamId: string, config: AudioConfig) {
    super();
    this.streamId = streamId;
    this.config = config;
    this.buffer = new CircularAudioBufferImpl(config.bufferSize * 4); // 4x buffer for safety
    this.metrics = {
      bytesProcessed: 0,
      droppedFrames: 0,
      latency: 0,
      cpuUsage: 0,
      memoryUsage: 0
    };
  }

  async write(buffer: AudioBuffer): Promise<void> {
    // Convert AudioBuffer to Float32Array for our circular buffer
    const channelData = buffer.getChannelData(0); // Use first channel for simplicity
    
    if (!this.buffer.write(channelData)) {
      this.metrics.droppedFrames++;
      throw new Error('Output buffer overflow');
    }

    this.metrics.bytesProcessed += channelData.length * 4;
    
    if (!this.isPlaying) {
      this.startPlayback();
    }
  }

  async flush(): Promise<void> {
    // Wait for buffer to empty
    while (this.buffer.getAvailableData() > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async stop(): Promise<void> {
    this.isPlaying = false;
    this.buffer.clear();
    this.emit('stopped');
  }

  getConfig(): AudioConfig {
    return { ...this.config };
  }

  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }

  /**
   * Simulate audio playback process
   */
  private startPlayback(): void {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    const playbackInterval = (this.config.bufferSize / this.config.sampleRate) * 1000;

    const playback = () => {
      if (!this.isPlaying) {
        return;
      }

      const audioData = this.buffer.read(this.config.bufferSize);
      if (audioData) {
        // Simulate audio playback (in real implementation, this would go to speakers)
        this.emit('audioPlayed', audioData);
      }

      if (this.buffer.getAvailableData() > 0) {
        setTimeout(playback, playbackInterval);
      } else {
        this.isPlaying = false;
        this.emit('playbackComplete');
      }
    };

    playback();
  }
}