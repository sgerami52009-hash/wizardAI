/**
 * Text-to-Speech Manager
 * Integrates all TTS components for complete speech synthesis
 * Safety: Child-safe content validation and parental controls
 * Performance: <300ms synthesis latency with hardware optimization
 */

import { EventEmitter } from 'events';
import { TextToSpeechEngine, TTSOptions, VoiceInfo, AudioBuffer, AudioStream } from './interfaces';
import { OfflineTTSEngine, TTSEngineConfig } from './text-to-speech-engine';
import { SSMLProcessor, ProcessedSSML } from './ssml-processor';
import { EmotionalTTSController, EmotionType } from './emotional-tts-controller';
import { SpeechInterruptionHandler, InterruptionConfig } from './speech-interruption-handler';
import { HardwareOptimizer } from './hardware-optimization';
import { VoiceProfile, PersonalityProfile, UserPreferences } from '../models/voice-models';
import { validateChildSafeContent } from '../safety/content-safety-filter';

export interface TTSManagerConfig {
  engine: TTSEngineConfig;
  interruption: InterruptionConfig;
  enableSSML: boolean;
  enableEmotions: boolean;
  enableHardwareOptimization: boolean;
  defaultVoice: string;
  childSafeMode: boolean;
}

export interface SynthesisOptions extends TTSOptions {
  userId?: string;
  ageGroup?: 'child' | 'teen' | 'adult';
  enableInterruption?: boolean;
  personality?: PersonalityProfile;
  contextualEmotion?: boolean;
}

export interface TTSResult {
  success: boolean;
  audioBuffer?: AudioBuffer;
  processingTime: number;
  voiceUsed: string;
  emotionApplied?: EmotionType;
  error?: string;
  interrupted?: boolean;
}

export class TTSManager extends EventEmitter implements TextToSpeechEngine {
  private engine: OfflineTTSEngine;
  private ssmlProcessor: SSMLProcessor;
  private emotionalController: EmotionalTTSController;
  private interruptionHandler: SpeechInterruptionHandler;
  private hardwareOptimizer: HardwareOptimizer;
  private config: TTSManagerConfig;
  private userProfiles: Map<string, VoiceProfile> = new Map();
  private isInitialized: boolean = false;

  constructor(config: TTSManagerConfig) {
    super();
    this.config = config;
    
    // Initialize components
    this.engine = new OfflineTTSEngine(config.engine);
    this.ssmlProcessor = new SSMLProcessor();
    this.emotionalController = new EmotionalTTSController();
    this.interruptionHandler = new SpeechInterruptionHandler(config.interruption);
    this.hardwareOptimizer = new HardwareOptimizer();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the TTS manager and all components
   */
  async initialize(): Promise<void> {
    try {
      await this.engine.initialize();
      
      // Set default voice if specified
      if (this.config.defaultVoice) {
        this.setVoice(this.config.defaultVoice);
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', new Error(`TTS Manager initialization failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Synthesize text to speech with full feature support
   */
  async synthesize(text: string, options: SynthesisOptions = {}): Promise<AudioBuffer> {
    if (!this.isInitialized) {
      throw new Error('TTS Manager not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Validate content safety
      const ageGroup = options.ageGroup || 'child';
      const safetyResult = await validateChildSafeContent(text, options.userId);
      
      if (!safetyResult.isAllowed) {
        throw new Error('Content blocked by safety filter');
      }

      const safeText = safetyResult.sanitizedText || text;
      
      // Process SSML if enabled
      let processedText = safeText;
      let ssmlData: ProcessedSSML | null = null;
      
      if (this.config.enableSSML && options.ssml) {
        ssmlData = this.ssmlProcessor.processSSML(safeText, this.config.childSafeMode);
        processedText = ssmlData.text;
      }

      // Apply emotional processing if enabled
      let finalOptions = { ...options };
      
      if (this.config.enableEmotions) {
        // Auto-detect emotion from text if contextual emotion is enabled
        if (options.contextualEmotion) {
          const suggestedEmotion = this.emotionalController.suggestEmotionFromText(
            processedText, 
            ageGroup
          );
          this.emotionalController.setEmotion(suggestedEmotion, 0.7, ageGroup);
        }
        
        // Apply personality if provided
        if (options.personality) {
          this.emotionalController.setPersonality(options.personality);
        }
        
        // Apply emotional modifications to TTS options
        finalOptions = this.emotionalController.applyEmotionalModifications(finalOptions, ageGroup);
      }

      // Apply hardware optimizations
      if (this.config.enableHardwareOptimization) {
        finalOptions = this.hardwareOptimizer.optimizeTTSOptions(finalOptions);
        
        // Check if system can handle the request
        if (!this.hardwareOptimizer.canHandleRequest()) {
          throw new Error('System resources insufficient for TTS request');
        }
      }

      // Load user voice profile if available
      if (options.userId) {
        const profile = this.userProfiles.get(options.userId);
        if (profile) {
          this.applyUserProfile(profile, finalOptions);
        }
      }

      // Synthesize audio
      const audioBuffer = await this.engine.synthesize(processedText, finalOptions);
      
      const processingTime = Date.now() - startTime;
      
      // Validate latency requirement (300ms)
      if (processingTime > 300) {
        console.warn(`TTS synthesis exceeded latency target: ${processingTime}ms`);
        this.emit('latencyWarning', { processingTime, target: 300 });
      }

      this.emit('synthesisComplete', {
        text: processedText,
        processingTime,
        voiceUsed: finalOptions.voiceId || 'default',
        emotion: finalOptions.emotion
      });

      return audioBuffer;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.emit('synthesisError', { error: error.message, processingTime });
      throw error;
    }
  }

  /**
   * Start streaming synthesis with interruption support
   */
  startStreaming(text: string, options: SynthesisOptions = {}): AudioStream {
    if (!this.isInitialized) {
      throw new Error('TTS Manager not initialized');
    }

    const stream = this.engine.startStreaming(text, options);
    
    // Enable interruption monitoring if requested
    if (options.enableInterruption !== false) {
      this.interruptionHandler.startMonitoring(stream, text);
    }

    return stream;
  }

  /**
   * Set the active voice
   */
  setVoice(voiceId: string): void {
    this.engine.setVoice(voiceId);
  }

  /**
   * Update speech rate
   */
  updateSpeechRate(rate: number): void {
    this.engine.updateSpeechRate(rate);
  }

  /**
   * Get available voices
   */
  getAvailableVoices(): VoiceInfo[] {
    return this.engine.getAvailableVoices();
  }

  /**
   * Stop all synthesis and clean up
   */
  stop(): void {
    this.engine.stop();
    this.interruptionHandler.stopMonitoring();
  }

  /**
   * Set emotion for speech synthesis
   */
  setEmotion(emotion: EmotionType, intensity: number = 0.7, ageGroup: string = 'child'): void {
    if (this.config.enableEmotions) {
      this.emotionalController.setEmotion(emotion, intensity, ageGroup);
    }
  }

  /**
   * Transition to a different emotion
   */
  transitionToEmotion(emotion: EmotionType, duration: number = 1000, ageGroup: string = 'child'): void {
    if (this.config.enableEmotions) {
      this.emotionalController.transitionToEmotion(emotion, duration, ageGroup);
    }
  }

  /**
   * Interrupt current speech
   */
  interrupt(type: 'user_speech' | 'wake_word' | 'manual' | 'emergency' = 'manual'): boolean {
    return this.interruptionHandler.interrupt(type, 'tts_manager');
  }

  /**
   * Resume interrupted speech
   */
  resumeSpeech(): { text: string; position: number } | null {
    return this.interruptionHandler.resume();
  }

  /**
   * Add or update user voice profile
   */
  setUserProfile(userId: string, profile: VoiceProfile): void {
    this.userProfiles.set(userId, profile);
    this.emit('userProfileUpdated', { userId, profile });
  }

  /**
   * Apply personality profile for speech characteristics
   */
  setPersonality(personality: PersonalityProfile): void {
    if (this.config.enableEmotions) {
      this.emotionalController.setPersonality(personality);
    }
    
    // Apply personality to voice engine
    this.engine.applyPersonalityVoice(personality);
  }

  /**
   * Get current system performance metrics
   */
  getPerformanceMetrics(): any {
    if (this.config.enableHardwareOptimization) {
      return this.hardwareOptimizer.getMetrics();
    }
    return null;
  }

  /**
   * Switch hardware optimization profile
   */
  setOptimizationProfile(profileName: string): boolean {
    if (this.config.enableHardwareOptimization) {
      return this.hardwareOptimizer.applyProfile(profileName);
    }
    return false;
  }

  /**
   * Validate SSML content for child safety
   */
  validateSSML(ssmlText: string): boolean {
    return this.ssmlProcessor.validateChildSafety(ssmlText);
  }

  /**
   * Get available emotions for age group
   */
  getAvailableEmotions(ageGroup: string = 'child'): EmotionType[] {
    if (this.config.enableEmotions) {
      return this.emotionalController.getAvailableEmotions(ageGroup);
    }
    return ['neutral'];
  }

  private setupEventHandlers(): void {
    // Engine events
    this.engine.on('error', (error) => this.emit('error', error));
    this.engine.on('voiceChanged', (voiceId) => this.emit('voiceChanged', voiceId));
    
    // Emotional controller events
    this.emotionalController.on('emotionChanged', (event) => 
      this.emit('emotionChanged', event));
    
    // Interruption handler events
    this.interruptionHandler.on('speechInterrupted', (event) => 
      this.emit('speechInterrupted', event));
    this.interruptionHandler.on('speechResumed', (event) => 
      this.emit('speechResumed', event));
    
    // Hardware optimizer events
    this.hardwareOptimizer.on('thermalThrottling', (event) => 
      this.emit('thermalThrottling', event));
    this.hardwareOptimizer.on('memoryPressure', (event) => 
      this.emit('memoryPressure', event));
  }

  private applyUserProfile(profile: VoiceProfile, options: SynthesisOptions): void {
    // Apply user preferences to TTS options
    if (profile.preferredLanguage) {
      // Set language-specific voice if available
      const voices = this.getAvailableVoices();
      const languageVoice = voices.find(v => v.language === profile.preferredLanguage);
      if (languageVoice) {
        options.voiceId = languageVoice.id;
      }
    }
    
    // Apply safety level
    if (profile.safetyLevel) {
      options.ageGroup = profile.safetyLevel;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.hardwareOptimizer.destroy();
    this.isInitialized = false;
    this.emit('destroyed');
  }
}