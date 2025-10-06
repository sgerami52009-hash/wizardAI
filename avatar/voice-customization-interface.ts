// Voice Customization Interface Components

export {}; // Make this file a module

import { 
  VoiceCharacteristics, 
  AccentType, 
  EmotionalTone, 
  ValidationResult, 
  VoicePreset,
  SafetyResult,
  AgeRange
} from './types';

import { voiceCharacteristicsManager } from './voice-characteristics-manager';
import { avatarEventBus } from './events';
import { avatarErrorHandler, AvatarError } from './errors';

// AudioBuffer interface for Node.js compatibility
interface AudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

/**
 * Voice parameter controls (pitch, speed, accent, tone)
 */
export interface VoiceParameterControls {
  pitch: VoiceParameterControl;
  speed: VoiceParameterControl;
  accent: VoiceAccentControl;
  emotionalTone: VoiceEmotionalToneControl;
  volume: VoiceParameterControl;
}

export interface VoiceParameterControl {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  description: string;
  ageRestricted: boolean;
  onChange: (value: number) => void;
  onValidate: (value: number) => ValidationResult;
}

export interface VoiceAccentControl {
  value: AccentType;
  options: AccentOption[];
  label: string;
  description: string;
  onChange: (accent: AccentType) => void;
  onValidate: (accent: AccentType) => ValidationResult;
}

export interface VoiceEmotionalToneControl {
  value: EmotionalTone;
  options: EmotionalToneOption[];
  label: string;
  description: string;
  onChange: (tone: EmotionalTone) => void;
  onValidate: (tone: EmotionalTone) => ValidationResult;
}

export interface AccentOption {
  value: AccentType;
  label: string;
  description: string;
  ageAppropriate: AgeRange[];
  previewText: string;
}

export interface EmotionalToneOption {
  value: EmotionalTone;
  label: string;
  description: string;
  ageAppropriate: AgeRange[];
  previewText: string;
  colorTheme: string;
}

/**
 * Voice preset system for quick configuration
 */
export interface VoicePresetSystem {
  presets: VoicePreset[];
  currentPreset?: VoicePreset;
  customPresets: VoicePreset[];
  loadPreset: (presetId: string) => Promise<ValidationResult>;
  saveCustomPreset: (name: string, description: string) => Promise<VoicePreset>;
  deleteCustomPreset: (presetId: string) => Promise<void>;
  getPresetsForAge: (userAge: number) => Promise<VoicePreset[]>;
}

/**
 * Voice characteristic consistency validation
 */
export interface VoiceConsistencyValidator {
  validateCharacteristics: (characteristics: VoiceCharacteristics, userAge: number) => Promise<ConsistencyResult>;
  validatePresetCompatibility: (preset: VoicePreset, userAge: number) => Promise<ValidationResult>;
  checkParameterConflicts: (characteristics: VoiceCharacteristics) => ConflictResult[];
  suggestOptimalSettings: (userAge: number, preferences: VoicePreferences) => Promise<VoiceCharacteristics>;
}

export interface ConsistencyResult {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  suggestions: string[];
  overallScore: number; // 0-1 scale
}

export interface ConsistencyIssue {
  parameter: keyof VoiceCharacteristics;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedValue: any;
}

export interface ConflictResult {
  conflictType: 'parameter' | 'age' | 'safety';
  parameters: string[];
  description: string;
  resolution: string;
}

export interface VoicePreferences {
  preferredTone: EmotionalTone[];
  preferredAccent: AccentType[];
  speedPreference: 'slow' | 'normal' | 'fast';
  pitchPreference: 'low' | 'normal' | 'high';
}

/**
 * Voice sample generation for customization preview
 */
export interface VoiceSampleGenerator {
  generateSample: (characteristics: VoiceCharacteristics, sampleText?: string) => Promise<VoiceSample>;
  generateComparison: (characteristics1: VoiceCharacteristics, characteristics2: VoiceCharacteristics) => Promise<VoiceComparison>;
  getDefaultSampleTexts: (userAge: number) => string[];
  preloadSamples: (presets: VoicePreset[]) => Promise<void>;
  clearSampleCache: () => void;
}

export interface VoiceSample {
  audioBuffer: AudioBuffer;
  characteristics: VoiceCharacteristics;
  sampleText: string;
  generationTime: number;
  quality: VoiceQuality;
  cacheKey: string;
}

export interface VoiceComparison {
  sample1: VoiceSample;
  sample2: VoiceSample;
  differences: VoiceDifference[];
  recommendation: string;
}

export interface VoiceDifference {
  parameter: keyof VoiceCharacteristics;
  value1: any;
  value2: any;
  impact: 'subtle' | 'noticeable' | 'significant';
  description: string;
}

export interface VoiceQuality {
  clarity: number; // 0-1 scale
  naturalness: number; // 0-1 scale
  consistency: number; // 0-1 scale
  ageAppropriateness: number; // 0-1 scale
}

/**
 * Main Voice Customization Interface
 */
export interface VoiceCustomizationInterface {
  // Core functionality
  initialize: (userId: string, userAge: number) => Promise<void>;
  getCurrentCharacteristics: () => VoiceCharacteristics;
  updateCharacteristics: (characteristics: Partial<VoiceCharacteristics>) => Promise<ValidationResult>;
  resetToDefaults: () => Promise<void>;
  
  // Parameter controls
  getParameterControls: () => VoiceParameterControls;
  updateParameter: (parameter: keyof VoiceCharacteristics, value: any) => Promise<ValidationResult>;
  
  // Preset system
  getPresetSystem: () => VoicePresetSystem;
  
  // Validation and consistency
  getConsistencyValidator: () => VoiceConsistencyValidator;
  
  // Sample generation
  getSampleGenerator: () => VoiceSampleGenerator;
  
  // Event handling
  onCharacteristicsChanged: (callback: (characteristics: VoiceCharacteristics) => void) => void;
  onValidationError: (callback: (error: ValidationResult) => void) => void;
  onSampleGenerated: (callback: (sample: VoiceSample) => void) => void;
}

/**
 * Voice Customization Interface Implementation
 */
export class VoiceCustomizationInterfaceImpl implements VoiceCustomizationInterface {
  private userId: string = '';
  private userAge: number = 0;
  private currentCharacteristics: VoiceCharacteristics;
  private parameterControls: VoiceParameterControls;
  private presetSystem: VoicePresetSystem;
  private consistencyValidator: VoiceConsistencyValidator;
  private sampleGenerator: VoiceSampleGenerator;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor() {
    this.currentCharacteristics = this.getDefaultCharacteristics();
    this.parameterControls = this.createParameterControls();
    this.presetSystem = this.createPresetSystem();
    this.consistencyValidator = this.createConsistencyValidator();
    this.sampleGenerator = this.createSampleGenerator();
    this.setupEventListeners();
  }

  /**
   * Initialize the voice customization interface for a specific user
   */
  async initialize(userId: string, userAge: number): Promise<void> {
    try {
      this.userId = userId;
      this.userAge = userAge;

      // Load existing voice settings for user
      const existingSettings = voiceCharacteristicsManager.getActiveVoiceSettings(userId);
      if (existingSettings) {
        this.currentCharacteristics = existingSettings;
      } else {
        // Set age-appropriate defaults
        this.currentCharacteristics = await this.getAgeAppropriateDefaults(userAge);
      }

      // Update parameter controls with age restrictions
      await this.updateParameterControlsForAge(userAge);

      // Load age-appropriate presets
      await this.loadPresetsForAge(userAge);

      avatarEventBus.emit('voice:interface:initialized', { userId, userAge });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const avatarError = new AvatarError(
        'VOICE_INTERFACE_INIT_FAILED',
        `Failed to initialize voice customization interface: ${errorMessage}`,
        'voice-customization-interface',
        'error',
        true,
        { userId, userAge }
      );
      
      avatarEventBus.emitSystemError('voice-customization-interface', {
        code: avatarError.code,
        message: avatarError.message,
        component: avatarError.component,
        severity: avatarError.severity,
        recoverable: avatarError.recoverable,
        context: avatarError.context
      });

      throw error;
    }
  }

  /**
   * Get current voice characteristics
   */
  getCurrentCharacteristics(): VoiceCharacteristics {
    return { ...this.currentCharacteristics };
  }

  /**
   * Update voice characteristics with validation
   */
  async updateCharacteristics(characteristics: Partial<VoiceCharacteristics>): Promise<ValidationResult> {
    try {
      const newCharacteristics = { ...this.currentCharacteristics, ...characteristics };

      // Validate new characteristics
      const validation = await voiceCharacteristicsManager.validateVoiceSettings(newCharacteristics, this.userAge);
      
      if (!validation.isAllowed) {
        this.triggerCallback('validationError', {
          isValid: false,
          requiresParentalApproval: validation.requiresParentalApproval,
          blockedElements: validation.blockedContent,
          warnings: [],
          errors: validation.violations
        });

        return {
          isValid: false,
          requiresParentalApproval: validation.requiresParentalApproval,
          blockedElements: validation.blockedContent,
          warnings: [],
          errors: validation.violations
        };
      }

      // Update characteristics
      const updateResult = await voiceCharacteristicsManager.updateVoiceCharacteristics(newCharacteristics);
      
      if (updateResult.isValid) {
        this.currentCharacteristics = newCharacteristics;
        voiceCharacteristicsManager.setActiveVoiceSettings(this.userId, newCharacteristics);
        this.triggerCallback('characteristicsChanged', newCharacteristics);
      }

      return updateResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isValid: false,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: [errorMessage]
      };
    }
  }

  /**
   * Reset voice characteristics to age-appropriate defaults
   */
  async resetToDefaults(): Promise<void> {
    const defaults = await this.getAgeAppropriateDefaults(this.userAge);
    await this.updateCharacteristics(defaults);
  }

  /**
   * Get parameter controls interface
   */
  getParameterControls(): VoiceParameterControls {
    return this.parameterControls;
  }

  /**
   * Update a specific voice parameter
   */
  async updateParameter(parameter: keyof VoiceCharacteristics, value: any): Promise<ValidationResult> {
    const update = { [parameter]: value } as Partial<VoiceCharacteristics>;
    return await this.updateCharacteristics(update);
  }

  /**
   * Get preset system interface
   */
  getPresetSystem(): VoicePresetSystem {
    return this.presetSystem;
  }

  /**
   * Get consistency validator interface
   */
  getConsistencyValidator(): VoiceConsistencyValidator {
    return this.consistencyValidator;
  }

  /**
   * Get sample generator interface
   */
  getSampleGenerator(): VoiceSampleGenerator {
    return this.sampleGenerator;
  }

  /**
   * Register callback for characteristics changes
   */
  onCharacteristicsChanged(callback: (characteristics: VoiceCharacteristics) => void): void {
    this.addCallback('characteristicsChanged', callback);
  }

  /**
   * Register callback for validation errors
   */
  onValidationError(callback: (error: ValidationResult) => void): void {
    this.addCallback('validationError', callback);
  }

  /**
   * Register callback for sample generation
   */
  onSampleGenerated(callback: (sample: VoiceSample) => void): void {
    this.addCallback('sampleGenerated', callback);
  }

  // Private helper methods

  private getDefaultCharacteristics(): VoiceCharacteristics {
    return {
      pitch: 0.0,
      speed: 1.0,
      accent: AccentType.NEUTRAL,
      emotionalTone: EmotionalTone.CALM,
      volume: 0.8
    };
  }

  private async getAgeAppropriateDefaults(userAge: number): Promise<VoiceCharacteristics> {
    const presets = await voiceCharacteristicsManager.getVoicePresets(userAge);
    
    if (presets.length > 0) {
      // Return the first age-appropriate preset as default
      return presets[0].characteristics;
    }

    // Fallback to safe defaults
    return this.getDefaultCharacteristics();
  }

  private createParameterControls(): VoiceParameterControls {
    return {
      pitch: {
        value: this.currentCharacteristics.pitch,
        min: -2.0,
        max: 2.0,
        step: 0.1,
        label: 'Voice Pitch',
        description: 'How high or low the voice sounds',
        ageRestricted: false,
        onChange: (value: number) => this.updateParameter('pitch', value),
        onValidate: (value: number) => this.validateParameter('pitch', value)
      },
      speed: {
        value: this.currentCharacteristics.speed,
        min: 0.5,
        max: 2.0,
        step: 0.1,
        label: 'Speaking Speed',
        description: 'How fast or slow the voice speaks',
        ageRestricted: false,
        onChange: (value: number) => this.updateParameter('speed', value),
        onValidate: (value: number) => this.validateParameter('speed', value)
      },
      accent: {
        value: this.currentCharacteristics.accent,
        options: this.getAccentOptions(),
        label: 'Voice Accent',
        description: 'The accent or regional style of speech',
        onChange: (accent: AccentType) => this.updateParameter('accent', accent),
        onValidate: (accent: AccentType) => this.validateParameter('accent', accent)
      },
      emotionalTone: {
        value: this.currentCharacteristics.emotionalTone,
        options: this.getEmotionalToneOptions(),
        label: 'Emotional Tone',
        description: 'The emotional feeling of the voice',
        onChange: (tone: EmotionalTone) => this.updateParameter('emotionalTone', tone),
        onValidate: (tone: EmotionalTone) => this.validateParameter('emotionalTone', tone)
      },
      volume: {
        value: this.currentCharacteristics.volume,
        min: 0.0,
        max: 1.0,
        step: 0.05,
        label: 'Voice Volume',
        description: 'How loud or quiet the voice is',
        ageRestricted: true,
        onChange: (value: number) => this.updateParameter('volume', value),
        onValidate: (value: number) => this.validateParameter('volume', value)
      }
    };
  }

  private getAccentOptions(): AccentOption[] {
    return [
      {
        value: AccentType.NEUTRAL,
        label: 'Neutral',
        description: 'Clear, standard pronunciation',
        ageAppropriate: [AgeRange.TODDLER, AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'Hello, how can I help you today?'
      },
      {
        value: AccentType.AMERICAN,
        label: 'American',
        description: 'American English accent',
        ageAppropriate: [AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'Hey there! What would you like to do?'
      },
      {
        value: AccentType.BRITISH,
        label: 'British',
        description: 'British English accent',
        ageAppropriate: [AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'Good day! How may I assist you?'
      },
      {
        value: AccentType.AUSTRALIAN,
        label: 'Australian',
        description: 'Australian English accent',
        ageAppropriate: [AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'G\'day! What can I do for you?'
      }
    ];
  }

  private getEmotionalToneOptions(): EmotionalToneOption[] {
    return [
      {
        value: EmotionalTone.CHEERFUL,
        label: 'Cheerful',
        description: 'Happy and upbeat voice',
        ageAppropriate: [AgeRange.TODDLER, AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'I\'m so excited to help you today!',
        colorTheme: '#FFD700'
      },
      {
        value: EmotionalTone.CALM,
        label: 'Calm',
        description: 'Peaceful and relaxed voice',
        ageAppropriate: [AgeRange.TODDLER, AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'I\'m here to help you in any way I can.',
        colorTheme: '#87CEEB'
      },
      {
        value: EmotionalTone.ENERGETIC,
        label: 'Energetic',
        description: 'Lively and enthusiastic voice',
        ageAppropriate: [AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'Let\'s get started and make something amazing!',
        colorTheme: '#FF6347'
      },
      {
        value: EmotionalTone.GENTLE,
        label: 'Gentle',
        description: 'Soft and caring voice',
        ageAppropriate: [AgeRange.TODDLER, AgeRange.CHILD, AgeRange.TEEN, AgeRange.ADULT],
        previewText: 'I\'m here to support you every step of the way.',
        colorTheme: '#DDA0DD'
      }
    ];
  }

  private createPresetSystem(): VoicePresetSystem {
    return {
      presets: [],
      customPresets: [],
      loadPreset: async (presetId: string) => {
        const preset = [...this.presetSystem.presets, ...this.presetSystem.customPresets]
          .find(p => p.id === presetId);
        
        if (!preset) {
          return {
            isValid: false,
            requiresParentalApproval: false,
            blockedElements: [],
            warnings: [],
            errors: ['Preset not found']
          };
        }

        return await this.updateCharacteristics(preset.characteristics);
      },
      saveCustomPreset: async (name: string, description: string) => {
        const customPreset: VoicePreset = {
          id: `custom-${Date.now()}`,
          name,
          description,
          characteristics: { ...this.currentCharacteristics },
          ageAppropriate: [this.determineAgeGroup(this.userAge)]
        };

        this.presetSystem.customPresets.push(customPreset);
        return customPreset;
      },
      deleteCustomPreset: async (presetId: string) => {
        const index = this.presetSystem.customPresets.findIndex(p => p.id === presetId);
        if (index >= 0) {
          this.presetSystem.customPresets.splice(index, 1);
        }
      },
      getPresetsForAge: async (userAge: number) => {
        return await voiceCharacteristicsManager.getVoicePresets(userAge);
      }
    };
  }

  private createConsistencyValidator(): VoiceConsistencyValidator {
    return {
      validateCharacteristics: async (characteristics: VoiceCharacteristics, userAge: number) => {
        const issues: ConsistencyIssue[] = [];
        let overallScore = 1.0;

        // Check for parameter conflicts
        if (characteristics.pitch > 1.0 && characteristics.emotionalTone === EmotionalTone.CALM) {
          issues.push({
            parameter: 'pitch',
            severity: 'medium',
            description: 'High pitch may not match calm emotional tone',
            suggestedValue: 0.0
          });
          overallScore -= 0.2;
        }

        if (characteristics.speed > 1.5 && characteristics.emotionalTone === EmotionalTone.GENTLE) {
          issues.push({
            parameter: 'speed',
            severity: 'medium',
            description: 'Fast speed may not match gentle emotional tone',
            suggestedValue: 1.0
          });
          overallScore -= 0.2;
        }

        return {
          isConsistent: issues.length === 0,
          issues,
          suggestions: issues.map(issue => `Consider adjusting ${issue.parameter}: ${issue.description}`),
          overallScore: Math.max(0, overallScore)
        };
      },
      validatePresetCompatibility: async (preset: VoicePreset, userAge: number) => {
        const ageGroup = this.determineAgeGroup(userAge);
        const isAgeAppropriate = preset.ageAppropriate.includes(ageGroup);

        if (!isAgeAppropriate) {
          return {
            isValid: false,
            requiresParentalApproval: true,
            blockedElements: ['preset'],
            warnings: [],
            errors: ['Preset not appropriate for user age']
          };
        }

        const safetyResult = await voiceCharacteristicsManager.validateVoiceSettings(preset.characteristics, userAge);
        
        // Convert SafetyResult to ValidationResult
        return {
          isValid: safetyResult.isAllowed,
          requiresParentalApproval: safetyResult.requiresParentalApproval,
          blockedElements: safetyResult.blockedContent,
          warnings: [],
          errors: safetyResult.violations
        };
      },
      checkParameterConflicts: (characteristics: VoiceCharacteristics) => {
        const conflicts: ConflictResult[] = [];

        // Example conflict checks
        if (characteristics.pitch < -1.0 && characteristics.emotionalTone === EmotionalTone.CHEERFUL) {
          conflicts.push({
            conflictType: 'parameter',
            parameters: ['pitch', 'emotionalTone'],
            description: 'Very low pitch conflicts with cheerful tone',
            resolution: 'Increase pitch or choose a calmer tone'
          });
        }

        return conflicts;
      },
      suggestOptimalSettings: async (userAge: number, preferences: VoicePreferences) => {
        // Get age-appropriate defaults
        const defaults = await this.getAgeAppropriateDefaults(userAge);
        
        // Apply preferences
        const optimal: VoiceCharacteristics = { ...defaults };

        if (preferences.preferredTone.length > 0) {
          optimal.emotionalTone = preferences.preferredTone[0];
        }

        if (preferences.preferredAccent.length > 0) {
          optimal.accent = preferences.preferredAccent[0];
        }

        // Adjust speed based on preference
        switch (preferences.speedPreference) {
          case 'slow':
            optimal.speed = Math.max(0.7, optimal.speed - 0.2);
            break;
          case 'fast':
            optimal.speed = Math.min(1.5, optimal.speed + 0.2);
            break;
        }

        // Adjust pitch based on preference
        switch (preferences.pitchPreference) {
          case 'low':
            optimal.pitch = Math.max(-1.0, optimal.pitch - 0.3);
            break;
          case 'high':
            optimal.pitch = Math.min(1.0, optimal.pitch + 0.3);
            break;
        }

        return optimal;
      }
    };
  }

  private createSampleGenerator(): VoiceSampleGenerator {
    const sampleCache = new Map<string, VoiceSample>();

    return {
      generateSample: async (characteristics: VoiceCharacteristics, sampleText?: string) => {
        try {
          const text = sampleText || this.getDefaultSampleText(characteristics.emotionalTone);
          const audioBuffer = await voiceCharacteristicsManager.previewVoice(characteristics, text);

          const sample: VoiceSample = {
            audioBuffer,
            characteristics: { ...characteristics },
            sampleText: text,
            generationTime: Date.now(),
            quality: {
              clarity: 0.9,
              naturalness: 0.85,
              consistency: 0.9,
              ageAppropriateness: 0.95
            },
            cacheKey: this.generateSampleCacheKey(characteristics, text)
          };

          sampleCache.set(sample.cacheKey, sample);
          this.triggerCallback('sampleGenerated', sample);

          return sample;

        } catch (error) {
          throw new Error(`Failed to generate voice sample: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      generateComparison: async (characteristics1: VoiceCharacteristics, characteristics2: VoiceCharacteristics) => {
        const sampleText = 'This is a comparison of two different voice settings.';
        
        const [sample1, sample2] = await Promise.all([
          this.sampleGenerator.generateSample(characteristics1, sampleText),
          this.sampleGenerator.generateSample(characteristics2, sampleText)
        ]);

        const differences: VoiceDifference[] = [];

        // Compare parameters
        if (characteristics1.pitch !== characteristics2.pitch) {
          differences.push({
            parameter: 'pitch',
            value1: characteristics1.pitch,
            value2: characteristics2.pitch,
            impact: Math.abs(characteristics1.pitch - characteristics2.pitch) > 0.5 ? 'significant' : 'noticeable',
            description: `Pitch difference: ${characteristics1.pitch} vs ${characteristics2.pitch}`
          });
        }

        if (characteristics1.speed !== characteristics2.speed) {
          differences.push({
            parameter: 'speed',
            value1: characteristics1.speed,
            value2: characteristics2.speed,
            impact: Math.abs(characteristics1.speed - characteristics2.speed) > 0.3 ? 'significant' : 'noticeable',
            description: `Speed difference: ${characteristics1.speed} vs ${characteristics2.speed}`
          });
        }

        return {
          sample1,
          sample2,
          differences,
          recommendation: differences.length > 2 ? 'Significant differences detected' : 'Subtle differences'
        };
      },
      getDefaultSampleTexts: (userAge: number) => {
        const ageGroup = this.determineAgeGroup(userAge);
        
        switch (ageGroup) {
          case AgeRange.TODDLER:
            return [
              'Hello! Let\'s have fun together!',
              'Would you like to play a game?',
              'I\'m here to help you learn new things!'
            ];
          case AgeRange.CHILD:
            return [
              'Hi there! What would you like to explore today?',
              'I can help you with your homework or we can play!',
              'Let\'s discover something amazing together!'
            ];
          case AgeRange.TEEN:
            return [
              'Hey! What\'s up? How can I help you today?',
              'Ready to tackle some challenges together?',
              'I\'m here whenever you need assistance or just want to chat.'
            ];
          default:
            return [
              'Hello! How may I assist you today?',
              'I\'m ready to help with whatever you need.',
              'What can I do for you this morning?'
            ];
        }
      },
      preloadSamples: async (presets: VoicePreset[]) => {
        const preloadPromises = presets.map(preset => 
          this.sampleGenerator.generateSample(preset.characteristics)
        );
        
        await Promise.allSettled(preloadPromises);
      },
      clearSampleCache: () => {
        sampleCache.clear();
      }
    };
  }

  private async updateParameterControlsForAge(userAge: number): Promise<void> {
    const ageGroup = this.determineAgeGroup(userAge);
    
    // Update parameter ranges based on age
    switch (ageGroup) {
      case AgeRange.TODDLER:
        this.parameterControls.pitch.min = -0.5;
        this.parameterControls.pitch.max = 1.0;
        this.parameterControls.speed.min = 0.7;
        this.parameterControls.speed.max = 1.2;
        this.parameterControls.volume.max = 0.8;
        break;
      case AgeRange.CHILD:
        this.parameterControls.pitch.min = -1.0;
        this.parameterControls.pitch.max = 1.5;
        this.parameterControls.speed.min = 0.8;
        this.parameterControls.speed.max = 1.4;
        this.parameterControls.volume.max = 0.9;
        break;
      case AgeRange.TEEN:
        this.parameterControls.pitch.min = -1.5;
        this.parameterControls.pitch.max = 1.5;
        this.parameterControls.speed.min = 0.6;
        this.parameterControls.speed.max = 1.8;
        this.parameterControls.volume.max = 1.0;
        break;
      default: // Adult
        this.parameterControls.pitch.min = -2.0;
        this.parameterControls.pitch.max = 2.0;
        this.parameterControls.speed.min = 0.5;
        this.parameterControls.speed.max = 2.0;
        this.parameterControls.volume.max = 1.0;
        break;
    }

    // Update accent and tone options based on age
    const accentOptions = this.getAccentOptions().filter(option => 
      option.ageAppropriate.includes(ageGroup)
    );
    this.parameterControls.accent.options = accentOptions;

    const toneOptions = this.getEmotionalToneOptions().filter(option => 
      option.ageAppropriate.includes(ageGroup)
    );
    this.parameterControls.emotionalTone.options = toneOptions;
  }

  private async loadPresetsForAge(userAge: number): Promise<void> {
    try {
      const presets = await voiceCharacteristicsManager.getVoicePresets(userAge);
      this.presetSystem.presets = presets;
    } catch (error) {
      // Use empty presets if loading fails
      this.presetSystem.presets = [];
    }
  }

  private validateParameter(parameter: keyof VoiceCharacteristics, value: any): ValidationResult {
    const errors: string[] = [];

    switch (parameter) {
      case 'pitch':
        if (typeof value !== 'number' || value < -2.0 || value > 2.0) {
          errors.push('Pitch must be between -2.0 and 2.0');
        }
        break;
      case 'speed':
        if (typeof value !== 'number' || value < 0.5 || value > 2.0) {
          errors.push('Speed must be between 0.5 and 2.0');
        }
        break;
      case 'volume':
        if (typeof value !== 'number' || value < 0.0 || value > 1.0) {
          errors.push('Volume must be between 0.0 and 1.0');
        }
        break;
      case 'accent':
        if (!Object.values(AccentType).includes(value)) {
          errors.push('Invalid accent type');
        }
        break;
      case 'emotionalTone':
        if (!Object.values(EmotionalTone).includes(value)) {
          errors.push('Invalid emotional tone');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      requiresParentalApproval: false,
      blockedElements: [],
      warnings: [],
      errors
    };
  }

  private determineAgeGroup(age: number): AgeRange {
    if (age >= 2 && age <= 4) return AgeRange.TODDLER;
    if (age >= 5 && age <= 12) return AgeRange.CHILD;
    if (age >= 13 && age <= 17) return AgeRange.TEEN;
    return AgeRange.ADULT;
  }

  private getDefaultSampleText(tone: EmotionalTone): string {
    const sampleTexts = {
      [EmotionalTone.CHEERFUL]: "Hello! I'm excited to help you today. How can I assist you?",
      [EmotionalTone.CALM]: "Hello. I'm here to help you with whatever you need.",
      [EmotionalTone.ENERGETIC]: "Hey there! Ready to get started? Let's make something amazing!",
      [EmotionalTone.GENTLE]: "Hello, dear. I'm here to support you in any way I can."
    };

    return sampleTexts[tone] || sampleTexts[EmotionalTone.CALM];
  }

  private generateSampleCacheKey(characteristics: VoiceCharacteristics, text: string): string {
    return `${characteristics.pitch}_${characteristics.speed}_${characteristics.accent}_${characteristics.emotionalTone}_${characteristics.volume}_${text.length}`;
  }

  private setupEventListeners(): void {
    // Listen for voice characteristic updates from the manager
    avatarEventBus.on('voice:characteristics:updated', (characteristics: VoiceCharacteristics) => {
      this.currentCharacteristics = characteristics;
      this.updateParameterControlValues();
    });
  }

  private updateParameterControlValues(): void {
    this.parameterControls.pitch.value = this.currentCharacteristics.pitch;
    this.parameterControls.speed.value = this.currentCharacteristics.speed;
    this.parameterControls.accent.value = this.currentCharacteristics.accent;
    this.parameterControls.emotionalTone.value = this.currentCharacteristics.emotionalTone;
    this.parameterControls.volume.value = this.currentCharacteristics.volume;
  }

  private addCallback(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  private triggerCallback(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const voiceCustomizationInterface = new VoiceCustomizationInterfaceImpl();
