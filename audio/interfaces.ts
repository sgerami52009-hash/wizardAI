/**
 * Audio processing and device management interfaces
 * Safety: No persistent audio storage - memory processing only
 * Performance: Optimized for Jetson Nano Orin hardware constraints
 */

import { EventEmitter } from 'events';

// Audio device management
export interface AudioDevice {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
  isAvailable: boolean;
  capabilities: AudioCapabilities;
}

export interface AudioCapabilities {
  sampleRates: number[];
  channels: number[];
  bitDepths: number[];
  maxLatency: number;
  supportsRealTime: boolean;
}

export interface AudioDeviceManager extends EventEmitter {
  getAvailableDevices(): Promise<AudioDevice[]>;
  getDefaultDevice(type: 'input' | 'output'): Promise<AudioDevice>;
  selectDevice(deviceId: string): Promise<void>;
  testDevice(deviceId: string): Promise<boolean>;
  onDeviceChange(callback: (devices: AudioDevice[]) => void): void;
}

// Audio configuration
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
  noiseReduction: boolean;
  echoCancellation: boolean;
  automaticGainControl: boolean;
  inputGain: number;
  outputVolume: number;
}

// Audio streaming
export interface AudioStreamProcessor extends EventEmitter {
  createInputStream(config: AudioConfig): Promise<AudioInputStream>;
  createOutputStream(config: AudioConfig): Promise<AudioOutputStream>;
  processAudio(input: AudioBuffer, config: ProcessingConfig): Promise<AudioBuffer>;
  getLatency(): number;
}

export interface AudioInputStream extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  getConfig(): AudioConfig;
  getMetrics(): StreamMetrics;
}

export interface AudioOutputStream extends EventEmitter {
  write(buffer: AudioBuffer): Promise<void>;
  flush(): Promise<void>;
  stop(): Promise<void>;
  getConfig(): AudioConfig;
  getMetrics(): StreamMetrics;
}

export interface StreamMetrics {
  bytesProcessed: number;
  droppedFrames: number;
  latency: number;
  cpuUsage: number;
  memoryUsage: number;
}

// Audio processing
export interface ProcessingConfig {
  noiseReduction: {
    enabled: boolean;
    strength: number; // 0.0 to 1.0
    adaptiveMode: boolean;
  };
  echoCancellation: {
    enabled: boolean;
    filterLength: number;
    adaptationRate: number;
  };
  gainControl: {
    enabled: boolean;
    targetLevel: number; // dB
    maxGain: number; // dB
    compressionRatio: number;
  };
}

// Audio utilities
export interface AudioUtils {
  convertSampleRate(buffer: AudioBuffer, targetRate: number): AudioBuffer;
  convertChannels(buffer: AudioBuffer, targetChannels: number): AudioBuffer;
  convertBitDepth(buffer: AudioBuffer, targetDepth: number): AudioBuffer;
  normalizeVolume(buffer: AudioBuffer, targetLevel: number): AudioBuffer;
  detectSilence(buffer: AudioBuffer, threshold: number): boolean;
  calculateRMS(buffer: AudioBuffer): number;
  applyFadeIn(buffer: AudioBuffer, duration: number): AudioBuffer;
  applyFadeOut(buffer: AudioBuffer, duration: number): AudioBuffer;
}

// Circular buffer for real-time processing
export interface CircularAudioBuffer {
  write(data: Float32Array): boolean;
  read(length: number): Float32Array | null;
  peek(length: number): Float32Array | null;
  getAvailableData(): number;
  getAvailableSpace(): number;
  clear(): void;
  resize(newSize: number): void;
}