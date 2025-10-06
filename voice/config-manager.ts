/**
 * Configuration Management System for Voice Interaction Pipeline
 * Handles comprehensive configuration for all pipeline components with
 * environment-specific settings and runtime updates
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface VoicePipelineConfig {
  environment: 'development' | 'production' | 'testing';
  audio: AudioConfig;
  wakeWord: WakeWordConfig;
  speechRecognition: SpeechRecognitionConfig;
  safety: SafetyConfig;
  intent: IntentConfig;
  response: ResponseConfig;
  tts: TTSConfig;
  performance: PerformanceConfig;
  offline: OfflineConfig;
  logging: LoggingConfig;
  hardware: HardwareConfig;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize: number;
  noiseReduction: boolean;
  echoCancellation: boolean;
  automaticGainControl: boolean;
  inputDevice?: string;
  outputDevice?: string;
  maxRecordingDuration: number; // seconds
}

export interface WakeWordConfig {
  enabled: boolean;
  sensitivity: number; // 0.0 to 1.0
  modelPath: string;
  phrases: string[];
  continuousListening: boolean;
  powerSaveMode: boolean;
  confidenceThreshold: number;
  temporalValidationWindow: number; // ms
}

export interface SpeechRecognitionConfig {
  modelPath: string;
  language: string;
  supportedLanguages: string[];
  streamingEnabled: boolean;
  confidenceThreshold: number;
  timeoutDuration: number; // seconds
  maxAlternatives: number;
  noiseReduction: boolean;
  userProfilesEnabled: boolean;
}

export interface SafetyConfig {
  enabled: boolean;
  strictMode: boolean;
  ageBasedFiltering: boolean;
  defaultAgeGroup: 'child' | 'teen' | 'adult';
  auditLogging: boolean;
  parentalOverride: boolean;
  contentFilters: {
    profanity: boolean;
    inappropriateTopics: boolean;
    harmfulInstructions: boolean;
  };
  riskLevels: {
    low: string[];
    medium: string[];
    high: string[];
  };
}

export interface IntentConfig {
  modelPath: string;
  confidenceThreshold: number;
  contextWindowSize: number;
  maxConversationTurns: number;
  disambiguationEnabled: boolean;
  customIntents: Record<string, IntentDefinition>;
}

export interface IntentDefinition {
  name: string;
  patterns: string[];
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
}

export interface ResponseConfig {
  personalityEnabled: boolean;
  variationEnabled: boolean;
  contextAware: boolean;
  maxResponseLength: number;
  templatePath: string;
  multiModalEnabled: boolean;
  emotionalTone: boolean;
}

export interface TTSConfig {
  engine: string;
  voiceId: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0
  ssmlEnabled: boolean;
  streamingEnabled: boolean;
  emotionalTones: string[];
  voiceCharacteristics: {
    consistency: boolean;
    avatarSync: boolean;
  };
}

export interface PerformanceConfig {
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
  responseTimeTarget: number; // ms
  resourceMonitoring: boolean;
  adaptiveQuality: boolean;
  queueManagement: {
    maxQueueSize: number;
    prioritization: boolean;
    timeoutHandling: boolean;
  };
}

export interface OfflineConfig {
  enabled: boolean;
  fallbackModels: {
    wakeWord: string;
    speechRecognition: string;
    intent: string;
    tts: string;
  };
  connectivityCheck: {
    interval: number; // seconds
    timeout: number; // seconds
    retryAttempts: number;
  };
  featureAvailability: Record<string, boolean>;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableConsole: boolean;
  enableFile: boolean;
  filePath: string;
  maxFileSize: number; // MB
  maxFiles: number;
  auditTrail: boolean;
  performanceMetrics: boolean;
  sanitizePII: boolean;
}

export interface HardwareConfig {
  platform: 'jetson-nano-orin' | 'generic';
  optimizations: {
    gpu: boolean;
    tensorrt: boolean;
    cuda: boolean;
  };
  resourceLimits: {
    memory: number; // MB
    cpu: number; // cores
  };
  thermalManagement: boolean;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigManager extends EventEmitter {
  private config: VoicePipelineConfig;
  private configPath: string;
  private watchEnabled: boolean = false;
  private validationRules: Map<string, (value: any) => boolean> = new Map();

  constructor(configPath: string = './config/voice-pipeline.json') {
    super();
    this.configPath = configPath;
    this.setupValidationRules();
  }

  /**
   * Load configuration from file with validation
   */
  async loadConfig(): Promise<VoicePipelineConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Merge with defaults
      this.config = this.mergeWithDefaults(parsedConfig);
      
      // Validate configuration
      const validation = this.validateConfig(this.config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Emit warnings if any
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          this.emit('configWarning', warning);
        });
      }

      this.emit('configLoaded', this.config);
      return this.config;
    } catch (error) {
      const defaultConfig = this.getDefaultConfig();
      this.emit('configError', error);
      this.emit('configFallback', defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfig(config?: VoicePipelineConfig): Promise<void> {
    const configToSave = config || this.config;
    
    // Validate before saving
    const validation = this.validateConfig(configToSave);
    if (!validation.isValid) {
      throw new Error(`Cannot save invalid configuration: ${validation.errors.join(', ')}`);
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      
      // Save with pretty formatting
      await fs.writeFile(
        this.configPath, 
        JSON.stringify(configToSave, null, 2), 
        'utf-8'
      );
      
      this.config = configToSave;
      this.emit('configSaved', configToSave);
    } catch (error) {
      this.emit('configError', error);
      throw error;
    }
  }

  /**
   * Update configuration at runtime without restart
   */
  async updateConfig(updates: Partial<VoicePipelineConfig>): Promise<void> {
    const newConfig = { ...this.config, ...updates };
    
    // Deep merge for nested objects
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && updates[key] !== null) {
        newConfig[key] = { ...this.config[key], ...updates[key] };
      }
    });

    // Validate updated configuration
    const validation = this.validateConfig(newConfig);
    if (!validation.isValid) {
      throw new Error(`Configuration update validation failed: ${validation.errors.join(', ')}`);
    }

    const oldConfig = { ...this.config };
    this.config = newConfig;
    
    this.emit('configUpdated', {
      oldConfig,
      newConfig: this.config,
      changes: updates
    });

    // Auto-save if enabled
    if (this.shouldAutoSave()) {
      await this.saveConfig();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): VoicePipelineConfig {
    return { ...this.config };
  }

  /**
   * Get configuration for specific component
   */
  getComponentConfig<T extends keyof VoicePipelineConfig>(
    component: T
  ): VoicePipelineConfig[T] {
    return this.config[component];
  }

  /**
   * Validate configuration against rules
   */
  validateConfig(config: VoicePipelineConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Environment validation
      if (!['development', 'production', 'testing'].includes(config.environment)) {
        errors.push('Invalid environment specified');
      }

      // Audio configuration validation
      if (config.audio.sampleRate < 8000 || config.audio.sampleRate > 48000) {
        errors.push('Audio sample rate must be between 8000 and 48000 Hz');
      }

      if (config.audio.channels < 1 || config.audio.channels > 2) {
        errors.push('Audio channels must be 1 (mono) or 2 (stereo)');
      }

      // Performance validation for Jetson Nano Orin
      if (config.performance.maxMemoryUsage > 8192) {
        errors.push('Memory usage cannot exceed 8GB on Jetson Nano Orin');
      }

      if (config.performance.responseTimeTarget > 500) {
        warnings.push('Response time target exceeds 500ms recommendation');
      }

      // Safety validation
      if (config.safety.enabled && !config.safety.auditLogging) {
        warnings.push('Safety enabled without audit logging - consider enabling for compliance');
      }

      // Hardware-specific validation
      if (config.hardware.platform === 'jetson-nano-orin') {
        if (config.hardware.resourceLimits.memory > 8192) {
          errors.push('Jetson Nano Orin memory limit cannot exceed 8GB');
        }
      }

      // TTS validation
      if (config.tts.rate < 0.5 || config.tts.rate > 2.0) {
        errors.push('TTS rate must be between 0.5 and 2.0');
      }

      // Wake word validation
      if (config.wakeWord.sensitivity < 0.0 || config.wakeWord.sensitivity > 1.0) {
        errors.push('Wake word sensitivity must be between 0.0 and 1.0');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Configuration validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Enable configuration file watching for hot reloading
   */
  enableConfigWatch(): void {
    if (this.watchEnabled) return;

    // Note: In a real implementation, you would use fs.watch or chokidar
    // This is a simplified version for demonstration
    this.watchEnabled = true;
    this.emit('watchEnabled');
  }

  /**
   * Disable configuration file watching
   */
  disableConfigWatch(): void {
    this.watchEnabled = false;
    this.emit('watchDisabled');
  }

  /**
   * Get default configuration for the system
   */
  private getDefaultConfig(): VoicePipelineConfig {
    return {
      environment: 'development',
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitDepth: 16,
        bufferSize: 1024,
        noiseReduction: true,
        echoCancellation: true,
        automaticGainControl: true,
        maxRecordingDuration: 30
      },
      wakeWord: {
        enabled: true,
        sensitivity: 0.7,
        modelPath: './models/wake-word.onnx',
        phrases: ['hey assistant'],
        continuousListening: true,
        powerSaveMode: true,
        confidenceThreshold: 0.8,
        temporalValidationWindow: 500
      },
      speechRecognition: {
        modelPath: './models/whisper-base.onnx',
        language: 'en-US',
        supportedLanguages: ['en-US', 'es-ES', 'fr-FR'],
        streamingEnabled: true,
        confidenceThreshold: 0.8,
        timeoutDuration: 3,
        maxAlternatives: 3,
        noiseReduction: true,
        userProfilesEnabled: true
      },
      safety: {
        enabled: true,
        strictMode: true,
        ageBasedFiltering: true,
        defaultAgeGroup: 'child',
        auditLogging: true,
        parentalOverride: true,
        contentFilters: {
          profanity: true,
          inappropriateTopics: true,
          harmfulInstructions: true
        },
        riskLevels: {
          low: ['mild language'],
          medium: ['complex topics'],
          high: ['harmful content', 'inappropriate requests']
        }
      },
      intent: {
        modelPath: './models/intent-classifier.onnx',
        confidenceThreshold: 0.7,
        contextWindowSize: 5,
        maxConversationTurns: 10,
        disambiguationEnabled: true,
        customIntents: {}
      },
      response: {
        personalityEnabled: true,
        variationEnabled: true,
        contextAware: true,
        maxResponseLength: 500,
        templatePath: './templates/responses',
        multiModalEnabled: true,
        emotionalTone: true
      },
      tts: {
        engine: 'offline-tts',
        voiceId: 'default',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        ssmlEnabled: true,
        streamingEnabled: true,
        emotionalTones: ['neutral', 'happy', 'concerned', 'excited'],
        voiceCharacteristics: {
          consistency: true,
          avatarSync: true
        }
      },
      performance: {
        maxMemoryUsage: 2048, // 2GB
        maxCpuUsage: 70,
        responseTimeTarget: 500,
        resourceMonitoring: true,
        adaptiveQuality: true,
        queueManagement: {
          maxQueueSize: 10,
          prioritization: true,
          timeoutHandling: true
        }
      },
      offline: {
        enabled: true,
        fallbackModels: {
          wakeWord: './models/wake-word-lite.onnx',
          speechRecognition: './models/whisper-tiny.onnx',
          intent: './models/intent-lite.onnx',
          tts: './models/tts-lite.onnx'
        },
        connectivityCheck: {
          interval: 30,
          timeout: 5,
          retryAttempts: 3
        },
        featureAvailability: {
          basicVoiceCommands: true,
          smartHomeControl: true,
          weatherUpdates: false,
          onlineSearch: false
        }
      },
      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: true,
        filePath: './logs/voice-pipeline.log',
        maxFileSize: 10,
        maxFiles: 5,
        auditTrail: true,
        performanceMetrics: true,
        sanitizePII: true
      },
      hardware: {
        platform: 'jetson-nano-orin',
        optimizations: {
          gpu: true,
          tensorrt: true,
          cuda: true
        },
        resourceLimits: {
          memory: 8192,
          cpu: 6
        },
        thermalManagement: true
      }
    };
  }

  /**
   * Merge user configuration with defaults
   */
  private mergeWithDefaults(userConfig: Partial<VoicePipelineConfig>): VoicePipelineConfig {
    const defaults = this.getDefaultConfig();
    
    // Deep merge function
    const deepMerge = (target: any, source: any): any => {
      const result = { ...target };
      
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
      
      return result;
    };

    return deepMerge(defaults, userConfig);
  }

  /**
   * Setup validation rules for configuration values
   */
  private setupValidationRules(): void {
    this.validationRules.set('audio.sampleRate', (value: number) => 
      value >= 8000 && value <= 48000
    );
    
    this.validationRules.set('performance.maxMemoryUsage', (value: number) => 
      value > 0 && value <= 8192
    );
    
    this.validationRules.set('tts.rate', (value: number) => 
      value >= 0.5 && value <= 2.0
    );
    
    this.validationRules.set('wakeWord.sensitivity', (value: number) => 
      value >= 0.0 && value <= 1.0
    );
  }

  /**
   * Check if configuration should be auto-saved
   */
  private shouldAutoSave(): boolean {
    return this.config.environment !== 'production';
  }
}

export default ConfigManager;