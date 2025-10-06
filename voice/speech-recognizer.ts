/**
 * Offline speech recognition engine using Whisper.cpp
 * Safety: All recognition results validated for child-safe content
 * Performance: Optimized for <500ms latency on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { 
  SpeechRecognizer, 
  RecognitionResult, 
  StreamingRecognition,
  AudioStream,
  AudioBuffer 
} from './interfaces';
import { VoiceProfile } from '../models/voice-models';
import { validateChildSafeContent } from '../safety/interfaces';

export interface WhisperConfig {
  modelPath: string;
  language: string;
  maxTokens: number;
  temperature: number;
  beamSize: number;
  enableVAD: boolean; // Voice Activity Detection
  vadThreshold: number;
}

export interface RecognitionOptions {
  userId?: string;
  language?: string;
  enableStreaming: boolean;
  confidenceThreshold: number;
  maxDuration: number; // seconds
  enablePreprocessing: boolean;
}

export class OfflineSpeechRecognizer extends EventEmitter implements SpeechRecognizer {
  private whisperConfig: WhisperConfig;
  private userProfiles: Map<string, VoiceProfile> = new Map();
  private activeStreams: Map<string, StreamingRecognition> = new Map();
  private isInitialized = false;
  private processingQueue: Array<{ audioStream: AudioStream; options: RecognitionOptions; resolve: Function; reject: Function }> = [];
  private isProcessing = false;

  constructor(config: WhisperConfig) {
    super();
    this.whisperConfig = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Whisper.cpp model
      await this.loadWhisperModel();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', new Error(`Failed to initialize speech recognizer: ${error.message}`));
      throw error;
    }
  }

  private async loadWhisperModel(): Promise<void> {
    // Simulate Whisper.cpp model loading
    // In real implementation, this would load the actual Whisper model
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Loading Whisper model from ${this.whisperConfig.modelPath}`);
        resolve();
      }, 100);
    });
  }

  async recognize(audioStream: AudioStream, userId?: string): Promise<RecognitionResult> {
    if (!this.isInitialized) {
      throw new Error('Speech recognizer not initialized');
    }

    const options: RecognitionOptions = {
      userId,
      language: this.getUserLanguage(userId),
      enableStreaming: false,
      confidenceThreshold: 0.7,
      maxDuration: 30,
      enablePreprocessing: true
    };

    return new Promise((resolve, reject) => {
      this.processingQueue.push({ audioStream, options, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { audioStream, options, resolve, reject } = this.processingQueue.shift()!;

    try {
      const result = await this.performRecognition(audioStream, options);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      // Process next item in queue
      if (this.processingQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  private async performRecognition(audioStream: AudioStream, options: RecognitionOptions): Promise<RecognitionResult> {
    const startTime = Date.now();
    
    try {
      // Collect audio data
      const audioData = await this.collectAudioData(audioStream, options.maxDuration);
      
      // Preprocess audio if enabled
      const processedAudio = options.enablePreprocessing 
        ? await this.preprocessAudio(audioData, options.userId)
        : audioData;

      // Perform speech recognition
      const recognitionResult = await this.runWhisperRecognition(processedAudio, options);
      
      // Validate content safety
      const safetyResult = await validateChildSafeContent(
        recognitionResult.text, 
        options.userId || 'anonymous'
      );
      
      if (!safetyResult.isAllowed) {
        throw new Error('Content blocked by safety filter');
      }

      const processingTime = Date.now() - startTime;
      
      const result: RecognitionResult = {
        text: safetyResult.sanitizedText || recognitionResult.text,
        confidence: recognitionResult.confidence,
        alternatives: recognitionResult.alternatives,
        processingTime,
        language: options.language || this.whisperConfig.language,
        userId: options.userId
      };

      this.emit('recognition-complete', result);
      return result;

    } catch (error) {
      this.emit('recognition-error', error);
      throw error;
    }
  }

  private async collectAudioData(audioStream: AudioStream, maxDuration: number): Promise<AudioBuffer[]> {
    return new Promise((resolve, reject) => {
      const audioBuffers: AudioBuffer[] = [];
      const timeout = setTimeout(() => {
        audioStream.removeAllListeners();
        resolve(audioBuffers);
      }, maxDuration * 1000);

      audioStream.on('data', (buffer: AudioBuffer) => {
        audioBuffers.push(buffer);
      });

      audioStream.on('end', () => {
        clearTimeout(timeout);
        audioStream.removeAllListeners();
        resolve(audioBuffers);
      });

      audioStream.on('error', (error) => {
        clearTimeout(timeout);
        audioStream.removeAllListeners();
        reject(error);
      });
    });
  }

  private async preprocessAudio(audioData: AudioBuffer[], userId?: string): Promise<AudioBuffer[]> {
    // Apply user-specific preprocessing based on voice profile
    const profile = userId ? this.userProfiles.get(userId) : null;
    
    // Simulate audio preprocessing (noise reduction, normalization, etc.)
    return audioData.map(buffer => ({
      ...buffer,
      data: this.applyNoiseReduction(buffer.data, profile?.accentAdaptation)
    }));
  }

  private applyNoiseReduction(audioData: Float32Array, accentModel?: any): Float32Array {
    // Simulate noise reduction processing
    // In real implementation, this would apply actual noise reduction algorithms
    return audioData;
  }

  private async runWhisperRecognition(audioData: AudioBuffer[], options: RecognitionOptions): Promise<{
    text: string;
    confidence: number;
    alternatives: string[];
  }> {
    // Simulate Whisper.cpp recognition
    // In real implementation, this would call the actual Whisper.cpp library
    
    // Mock recognition result based on audio length
    const totalDuration = audioData.reduce((sum, buffer) => sum + (buffer.data.length / buffer.sampleRate), 0);
    
    if (totalDuration < 0.5) {
      return {
        text: "",
        confidence: 0.0,
        alternatives: []
      };
    }

    // Simulate processing delay based on audio length
    await new Promise(resolve => setTimeout(resolve, Math.min(totalDuration * 100, 500)));

    return {
      text: "Hello, how can I help you today?", // Mock recognition result
      confidence: 0.85,
      alternatives: [
        "Hello, how can I help you?",
        "Hi, how can I help you today?"
      ]
    };
  }

  startStreaming(userId?: string): StreamingRecognition {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const streaming = new StreamingRecognitionImpl(streamId, this, userId);
    this.activeStreams.set(streamId, streaming);
    
    streaming.on('end', () => {
      this.activeStreams.delete(streamId);
    });

    return streaming;
  }

  updateUserProfile(userId: string, profile: VoiceProfile): void {
    this.userProfiles.set(userId, profile);
    this.emit('profile-updated', { userId, profile });
  }

  setLanguage(language: string): void {
    this.whisperConfig.language = language;
    this.emit('language-changed', language);
  }

  getAvailableLanguages(): string[] {
    // Return supported languages for Whisper
    return [
      'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
      'ar', 'hi', 'tr', 'pl', 'nl', 'sv', 'da', 'no', 'fi'
    ];
  }

  private getUserLanguage(userId?: string): string {
    if (userId && this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!.preferredLanguage;
    }
    return this.whisperConfig.language;
  }

  async shutdown(): Promise<void> {
    // Stop all active streams
    for (const [streamId, stream] of this.activeStreams) {
      stream.stop();
    }
    this.activeStreams.clear();
    
    // Clear processing queue
    this.processingQueue.forEach(({ reject }) => {
      reject(new Error('Speech recognizer shutting down'));
    });
    this.processingQueue = [];
    
    this.isInitialized = false;
    this.emit('shutdown');
  }
}

class StreamingRecognitionImpl extends EventEmitter implements StreamingRecognition {
  private streamId: string;
  private recognizer: OfflineSpeechRecognizer;
  private userId?: string;
  private isActive = false;
  private audioBuffers: AudioBuffer[] = [];
  private processingTimer?: NodeJS.Timeout;

  constructor(streamId: string, recognizer: OfflineSpeechRecognizer, userId?: string) {
    super();
    this.streamId = streamId;
    this.recognizer = recognizer;
    this.userId = userId;
  }

  onPartialResult(callback: (text: string) => void): void {
    this.on('partial-result', callback);
  }

  onFinalResult(callback: (result: RecognitionResult) => void): void {
    this.on('final-result', callback);
  }

  onError(callback: (error: Error) => void): void {
    this.on('error', callback);
  }

  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startProcessingLoop();
    this.emit('started');
  }

  private startProcessingLoop(): void {
    this.processingTimer = setInterval(async () => {
      if (this.audioBuffers.length > 0) {
        try {
          await this.processBufferedAudio();
        } catch (error) {
          this.emit('error', error);
        }
      }
    }, 500); // Process every 500ms for streaming
  }

  private async processBufferedAudio(): Promise<void> {
    if (this.audioBuffers.length === 0) return;

    const audioData = [...this.audioBuffers];
    this.audioBuffers = [];

    // Simulate streaming recognition processing
    const partialText = "Processing..."; // Mock partial result
    this.emit('partial-result', partialText);

    // Simulate final result after processing
    setTimeout(() => {
      const result: RecognitionResult = {
        text: "Streaming recognition result",
        confidence: 0.8,
        alternatives: [],
        processingTime: 200,
        language: 'en',
        userId: this.userId
      };
      this.emit('final-result', result);
    }, 200);
  }

  addAudioData(buffer: AudioBuffer): void {
    if (this.isActive) {
      this.audioBuffers.push(buffer);
    }
  }

  stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
    
    this.emit('end');
  }
}