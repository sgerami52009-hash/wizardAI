/**
 * Offline Text-to-Speech Engine
 * Safety: Child-safe voice synthesis with content validation
 * Performance: <300ms synthesis latency, optimized for Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { TextToSpeechEngine, TTSOptions, VoiceInfo, AudioBuffer, AudioStream } from './interfaces';
import { VoiceProfile, PersonalityProfile } from '../models/voice-models';
import { validateChildSafeContent } from '../safety/content-safety-filter';
import { sanitizeForLog } from '../utils/privacy-utils';

export interface TTSEngineConfig {
  modelPath: string;
  voicesPath: string;
  maxConcurrentSynthesis: number;
  enableSSML: boolean;
  hardwareAcceleration: boolean;
  memoryLimit: number; // MB
}

export interface SynthesisRequest {
  id: string;
  text: string;
  options: TTSOptions;
  userId?: string;
  priority: 'low' | 'normal' | 'high';
  timestamp: Date;
}

export interface SynthesisResult {
  requestId: string;
  audioBuffer: AudioBuffer;
  processingTime: number;
  voiceUsed: string;
  success: boolean;
  error?: string;
}

export class OfflineTTSEngine extends EventEmitter implements TextToSpeechEngine {
  private config: TTSEngineConfig;
  private availableVoices: Map<string, VoiceInfo> = new Map();
  private currentVoice: string = '';
  private speechRate: number = 1.0;
  private isInitialized: boolean = false;
  private synthesisQueue: SynthesisRequest[] = [];
  private activeSynthesis: Map<string, AbortController> = new Map();
  private resourceMonitor: ResourceMonitor;

  constructor(config: TTSEngineConfig) {
    super();
    this.config = config;
    this.resourceMonitor = new ResourceMonitor();
  }

  async initialize(): Promise<void> {
    try {
      await this.loadVoiceModels();
      await this.initializeEngine();
      this.setupResourceMonitoring();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', new Error(`TTS initialization failed: ${errorMessage}`));
      throw error;
    }
  }

  async synthesize(text: string, options: TTSOptions): Promise<AudioBuffer> {
    if (!this.isInitialized) {
      throw new Error('TTS engine not initialized');
    }

    // Validate content safety
    const safetyResult = await validateChildSafeContent(text, (options as any).userId);
    if (!safetyResult.isAllowed) {
      throw new Error('Content blocked by safety filter');
    }

    const requestId = this.generateRequestId();
    const request: SynthesisRequest = {
      id: requestId,
      text: safetyResult.sanitizedText || text,
      options,
      priority: 'normal',
      timestamp: new Date()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cancelSynthesis(requestId);
        reject(new Error('TTS synthesis timeout'));
      }, 5000); // 5 second timeout

      this.processSynthesisRequest(request)
        .then(result => {
          clearTimeout(timeout);
          if (result.success) {
            resolve(result.audioBuffer);
          } else {
            reject(new Error(result.error || 'Synthesis failed'));
          }
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  startStreaming(text: string, options: TTSOptions): AudioStream {
    const stream = new TTSAudioStream(text, options, this);
    stream.start();
    return stream;
  }

  setVoice(voiceId: string): void {
    if (!this.availableVoices.has(voiceId)) {
      throw new Error(`Voice ${voiceId} not available`);
    }
    this.currentVoice = voiceId;
    this.emit('voiceChanged', voiceId);
  }

  updateSpeechRate(rate: number): void {
    if (rate < 0.5 || rate > 2.0) {
      throw new Error('Speech rate must be between 0.5 and 2.0');
    }
    this.speechRate = rate;
    this.emit('speechRateChanged', rate);
  }

  getAvailableVoices(): VoiceInfo[] {
    return Array.from(this.availableVoices.values());
  }

  stop(): void {
    // Cancel all active synthesis
    for (const [requestId, controller] of this.activeSynthesis) {
      controller.abort();
    }
    this.activeSynthesis.clear();
    this.synthesisQueue = [];
    this.emit('stopped');
  }

  // Voice characteristic consistency per avatar personality
  applyPersonalityVoice(personality: PersonalityProfile): void {
    const voiceChar = personality.voiceCharacteristics;
    
    // Select appropriate base voice
    if (voiceChar.baseVoice && this.availableVoices.has(voiceChar.baseVoice)) {
      this.setVoice(voiceChar.baseVoice);
    }

    // Apply personality-based modifications
    const modifiedRate = this.speechRate * (1 + voiceChar.speedModification);
    this.updateSpeechRate(Math.max(0.5, Math.min(2.0, modifiedRate)));

    this.emit('personalityApplied', personality.id);
  }

  private async loadVoiceModels(): Promise<void> {
    // Load available voice models from filesystem
    const voiceConfigs = await this.scanVoiceDirectory();
    
    for (const config of voiceConfigs) {
      const voiceInfo: VoiceInfo = {
        id: config.id,
        name: config.name,
        language: config.language,
        gender: config.gender,
        ageGroup: config.ageGroup
      };
      
      this.availableVoices.set(config.id, voiceInfo);
    }

    // Set default voice
    const defaultVoice = this.findDefaultVoice();
    if (defaultVoice) {
      this.currentVoice = defaultVoice.id;
    }
  }

  private async initializeEngine(): Promise<void> {
    // Initialize the offline TTS engine (e.g., espeak-ng, festival, or custom model)
    // This would integrate with the actual TTS library
    await this.loadTTSModel();
    await this.calibrateForHardware();
  }

  private async processSynthesisRequest(request: SynthesisRequest): Promise<SynthesisResult> {
    const startTime = Date.now();
    const abortController = new AbortController();
    this.activeSynthesis.set(request.id, abortController);

    try {
      // Check resource constraints
      if (!this.resourceMonitor.canProcessRequest()) {
        throw new Error('Insufficient resources for synthesis');
      }

      // Process SSML if enabled
      const processedText = this.config.enableSSML ? 
        this.processSSML(request.text) : request.text;

      // Generate audio
      const audioBuffer = await this.generateAudio(
        processedText, 
        request.options, 
        abortController.signal
      );

      const processingTime = Date.now() - startTime;
      
      // Validate latency requirement (300ms)
      if (processingTime > 300) {
        console.warn(`TTS synthesis exceeded latency target: ${processingTime}ms`);
      }

      this.activeSynthesis.delete(request.id);

      return {
        requestId: request.id,
        audioBuffer,
        processingTime,
        voiceUsed: this.currentVoice,
        success: true
      };

    } catch (error) {
      this.activeSynthesis.delete(request.id);
      
      return {
        requestId: request.id,
        audioBuffer: this.createSilentBuffer(),
        processingTime: Date.now() - startTime,
        voiceUsed: this.currentVoice,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async generateAudio(
    text: string, 
    options: TTSOptions, 
    signal: AbortSignal
  ): Promise<AudioBuffer> {
    // This would integrate with the actual TTS engine
    // For now, return a mock audio buffer
    
    const voice = this.availableVoices.get(options.voiceId || this.currentVoice);
    if (!voice) {
      throw new Error('Voice not found');
    }

    // Apply voice modifications based on options
    const synthesisParams = {
      text,
      voice: voice.id,
      rate: options.rate || this.speechRate,
      pitch: options.pitch || 1.0,
      volume: options.volume || 1.0,
      emotion: options.emotion || 'neutral'
    };

    // Simulate TTS processing (replace with actual TTS engine call)
    const audioData = await this.synthesizeWithEngine(synthesisParams, signal);
    
    return {
      data: audioData,
      sampleRate: 22050, // Standard TTS sample rate
      channels: 1,
      timestamp: Date.now()
    };
  }

  private async synthesizeWithEngine(
    params: any, 
    signal: AbortSignal
  ): Promise<Float32Array> {
    // Mock implementation - replace with actual TTS engine integration
    // This could be espeak-ng, festival, or a neural TTS model
    
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Synthesis aborted'));
        return;
      }

      // Simulate processing time
      const processingTime = Math.random() * 200 + 50; // 50-250ms
      
      setTimeout(() => {
        if (signal.aborted) {
          reject(new Error('Synthesis aborted'));
          return;
        }

        // Generate mock audio data
        const duration = params.text.length * 0.1; // ~100ms per character
        const sampleCount = Math.floor(duration * 22050);
        const audioData = new Float32Array(sampleCount);
        
        // Generate simple sine wave for testing
        for (let i = 0; i < sampleCount; i++) {
          audioData[i] = Math.sin(2 * Math.PI * 440 * i / 22050) * 0.1;
        }
        
        resolve(audioData);
      }, processingTime);
    });
  }

  private processSSML(text: string): string {
    // Basic SSML processing
    // Remove SSML tags for now, but preserve the text content
    return text.replace(/<[^>]*>/g, '');
  }

  private createSilentBuffer(): AudioBuffer {
    return {
      data: new Float32Array(1024), // Silent buffer
      sampleRate: 22050,
      channels: 1,
      timestamp: Date.now()
    };
  }

  private cancelSynthesis(requestId: string): void {
    const controller = this.activeSynthesis.get(requestId);
    if (controller) {
      controller.abort();
      this.activeSynthesis.delete(requestId);
    }
  }

  private generateRequestId(): string {
    return `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async scanVoiceDirectory(): Promise<any[]> {
    // Mock voice configurations - replace with actual file system scanning
    return [
      {
        id: 'en-us-female-adult',
        name: 'Sarah',
        language: 'en-US',
        gender: 'female',
        ageGroup: 'adult'
      },
      {
        id: 'en-us-male-adult',
        name: 'David',
        language: 'en-US',
        gender: 'male',
        ageGroup: 'adult'
      },
      {
        id: 'en-us-child-friendly',
        name: 'Alex',
        language: 'en-US',
        gender: 'neutral',
        ageGroup: 'child'
      }
    ];
  }

  private findDefaultVoice(): VoiceInfo | undefined {
    // Prefer child-friendly voices for family device
    for (const voice of this.availableVoices.values()) {
      if (voice.ageGroup === 'child') {
        return voice;
      }
    }
    return this.availableVoices.values().next().value;
  }

  private async loadTTSModel(): Promise<void> {
    // Load the actual TTS model files
    // This would depend on the chosen TTS engine
  }

  private async calibrateForHardware(): Promise<void> {
    // Optimize settings for Jetson Nano Orin
    // Adjust buffer sizes, threading, etc.
  }

  private setupResourceMonitoring(): void {
    this.resourceMonitor.on('resourceWarning', (usage) => {
      this.emit('resourceWarning', usage);
      // Implement adaptive quality reduction if needed
    });
  }
}

// Streaming TTS implementation
class TTSAudioStream extends EventEmitter implements AudioStream {
  private text: string;
  private options: TTSOptions;
  private engine: OfflineTTSEngine;
  private _isActive: boolean = false;
  private buffer: AudioBuffer[] = [];

  constructor(text: string, options: TTSOptions, engine: OfflineTTSEngine) {
    super();
    this.text = text;
    this.options = options;
    this.engine = engine;
  }

  async start(): Promise<void> {
    this._isActive = true;
    
    try {
      // Split text into chunks for streaming
      const chunks = this.splitTextForStreaming(this.text);
      
      for (const chunk of chunks) {
        if (!this._isActive) break;
        
        const audioBuffer = await this.engine.synthesize(chunk, this.options);
        this.buffer.push(audioBuffer);
        this.emit('data', audioBuffer);
      }
      
      this.emit('end');
    } catch (error) {
      this.emit('error', error);
    }
  }

  async stop(): Promise<void> {
    this._isActive = false;
    this.emit('stop');
  }

  write(buffer: AudioBuffer): void {
    // Not applicable for TTS output stream
    throw new Error('Cannot write to TTS output stream');
  }

  read(): AudioBuffer | null {
    return this.buffer.shift() || null;
  }

  isActive(): boolean {
    return this._isActive;
  }

  private splitTextForStreaming(text: string): string[] {
    // Split text into sentence-based chunks for streaming
    const sentences = text.match(/[^\.!?]+[\.!?]+/g) || [text];
    return sentences.map(s => s.trim()).filter(s => s.length > 0);
  }
}

// Resource monitoring for TTS operations
class ResourceMonitor extends EventEmitter {
  private memoryThreshold: number = 1024; // MB
  private cpuThreshold: number = 70; // %

  canProcessRequest(): boolean {
    const usage = this.getCurrentUsage();
    
    if (usage.memoryMB > this.memoryThreshold || usage.cpuPercent > this.cpuThreshold) {
      this.emit('resourceWarning', usage);
      return false;
    }
    
    return true;
  }

  private getCurrentUsage(): { memoryMB: number; cpuPercent: number } {
    // Mock implementation - replace with actual system monitoring
    return {
      memoryMB: Math.random() * 500 + 200,
      cpuPercent: Math.random() * 30 + 20
    };
  }
}