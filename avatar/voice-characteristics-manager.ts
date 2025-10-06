// Voice Characteristics Manager for Avatar Customization

import { 
  VoiceCharacteristics, 
  AccentType, 
  EmotionalTone, 
  ValidationResult, 
  SafetyResult, 
  VoicePreset,
  AgeRange,
  RiskLevel
} from './types';

import { avatarEventBus } from './events';
import { avatarErrorHandler } from './errors';
import { personalityVoiceIntegration, VoicePipelineInterface } from './personality-voice-integration';

// AudioBuffer interface for Node.js compatibility
interface AudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

export interface VoiceCharacteristicsManager {
  updateVoiceCharacteristics(characteristics: VoiceCharacteristics): Promise<ValidationResult>;
  previewVoice(characteristics: VoiceCharacteristics, sampleText: string): Promise<AudioBuffer>;
  validateVoiceSettings(characteristics: VoiceCharacteristics, userAge: number): Promise<SafetyResult>;
  integrateWithTTS(characteristics: VoiceCharacteristics): Promise<void>;
  getVoicePresets(userAge: number): Promise<VoicePreset[]>;
}

export interface VoiceValidationRules {
  ageGroup: AgeRange;
  allowedPitchRange: { min: number; max: number };
  allowedSpeedRange: { min: number; max: number };
  allowedAccents: AccentType[];
  allowedTones: EmotionalTone[];
  maxVolumeLevel: number;
}

export interface VoiceSampleRequest {
  characteristics: VoiceCharacteristics;
  sampleText: string;
  userId: string;
  previewDuration: number; // in seconds
}

export interface VoicePreviewResult {
  audioBuffer: AudioBuffer;
  generationTime: number;
  quality: VoiceQuality;
  safetyChecked: boolean;
}

export interface VoiceQuality {
  clarity: number; // 0-1 scale
  naturalness: number; // 0-1 scale
  consistency: number; // 0-1 scale
  ageAppropriateness: number; // 0-1 scale
}

export interface TTSEngineInterface {
  synthesizeSpeech(text: string, characteristics: VoiceCharacteristics): Promise<AudioBuffer>;
  updateVoiceParameters(characteristics: VoiceCharacteristics): Promise<void>;
  getAvailableVoices(): Promise<VoiceOption[]>;
  validateVoiceSupport(characteristics: VoiceCharacteristics): Promise<boolean>;
}

export interface VoiceOption {
  id: string;
  name: string;
  accent: AccentType;
  gender: 'male' | 'female' | 'neutral';
  ageGroup: AgeRange;
  supportedTones: EmotionalTone[];
}

export class VoiceCharacteristicsManagerImpl implements VoiceCharacteristicsManager {
  private ttsEngine?: TTSEngineInterface;
  private voicePipeline?: VoicePipelineInterface;
  private validationRules: Map<AgeRange, VoiceValidationRules> = new Map();
  private voicePresets: Map<AgeRange, VoicePreset[]> = new Map();
  private activeVoiceSettings: Map<string, VoiceCharacteristics> = new Map();
  private previewCache: Map<string, VoicePreviewResult> = new Map();

  constructor() {
    this.initializeValidationRules();
    this.initializeVoicePresets();
    this.setupEventListeners();
  }

  /**
   * Build VoiceCharacteristicsManager for voice parameter configuration
   */
  async updateVoiceCharacteristics(characteristics: VoiceCharacteristics): Promise<ValidationResult> {
    try {
      // Validate voice characteristics
      const validation = await this.validateVoiceCharacteristics(characteristics);
      if (!validation.isValid) {
        return validation;
      }

      // Update TTS engine with new characteristics
      if (this.ttsEngine) {
        await this.ttsEngine.updateVoiceParameters(characteristics);
      }

      // Update voice pipeline integration
      if (this.voicePipeline) {
        await this.voicePipeline.updateTTSParameters(characteristics);
      }

      // Emit success event
      avatarEventBus.emit('voice:characteristics:updated', characteristics);

      return {
        isValid: true,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      avatarEventBus.emitSystemError('voice-characteristics-manager', {
        code: 'VOICE_UPDATE_FAILED',
        message: `Failed to update voice characteristics: ${errorMessage}`,
        component: 'voice-characteristics-manager',
        severity: 'error',
        recoverable: true,
        context: { characteristics }
      });

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
   * Implement real-time voice preview with sample text generation
   */
  async previewVoice(characteristics: VoiceCharacteristics, sampleText: string): Promise<AudioBuffer> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(characteristics, sampleText);
      const cachedResult = this.previewCache.get(cacheKey);
      
      if (cachedResult && this.isCacheValid(cachedResult)) {
        return cachedResult.audioBuffer;
      }

      // Validate characteristics before preview
      const validation = await this.validateVoiceCharacteristics(characteristics);
      if (!validation.isValid) {
        throw new Error(`Invalid voice characteristics: ${validation.errors.join(', ')}`);
      }

      // Generate sample text if not provided
      const finalSampleText = sampleText || this.generateDefaultSampleText(characteristics);

      // Synthesize speech with TTS engine
      if (!this.ttsEngine) {
        throw new Error('TTS engine not available');
      }

      const startTime = performance.now();
      const audioBuffer = await this.ttsEngine.synthesizeSpeech(finalSampleText, characteristics);
      const generationTime = performance.now() - startTime;

      // Assess voice quality
      const quality = await this.assessVoiceQuality(audioBuffer, characteristics);

      // Cache the result
      const previewResult: VoicePreviewResult = {
        audioBuffer,
        generationTime,
        quality,
        safetyChecked: true
      };
      
      this.previewCache.set(cacheKey, previewResult);

      // Emit preview event
      avatarEventBus.emit('voice:preview:generated', {
        characteristics,
        sampleText: finalSampleText,
        quality,
        generationTime
      });

      return audioBuffer;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      avatarEventBus.emitSystemError('voice-characteristics-manager', {
        code: 'VOICE_PREVIEW_FAILED',
        message: `Failed to generate voice preview: ${errorMessage}`,
        component: 'voice-characteristics-manager',
        severity: 'warning',
        recoverable: true,
        context: { characteristics, sampleText }
      });

      // Return empty audio buffer as fallback
      return this.createEmptyAudioBuffer();
    }
  }

  /**
   * Create voice characteristic validation for age-appropriate settings
   */
  async validateVoiceSettings(characteristics: VoiceCharacteristics, userAge: number): Promise<SafetyResult> {
    try {
      const ageGroup = this.determineAgeGroup(userAge);
      const rules = this.validationRules.get(ageGroup);
      
      if (!rules) {
        return {
          isAllowed: false,
          violations: ['Age group validation rules not found'],
          riskLevel: 'high' as RiskLevel,
          reason: 'Unable to validate voice settings for age group',
          requiresParentalApproval: true,
          blockedContent: ['voice_characteristics'],
          recommendations: ['Use default voice settings for this age group']
        };
      }

      const violations: string[] = [];
      const blockedContent: string[] = [];
      const recommendations: string[] = [];

      // Validate pitch range
      if (characteristics.pitch < rules.allowedPitchRange.min || 
          characteristics.pitch > rules.allowedPitchRange.max) {
        violations.push(`Pitch ${characteristics.pitch} outside allowed range ${rules.allowedPitchRange.min}-${rules.allowedPitchRange.max}`);
        blockedContent.push('pitch');
        recommendations.push(`Adjust pitch to between ${rules.allowedPitchRange.min} and ${rules.allowedPitchRange.max}`);
      }

      // Validate speed range
      if (characteristics.speed < rules.allowedSpeedRange.min || 
          characteristics.speed > rules.allowedSpeedRange.max) {
        violations.push(`Speed ${characteristics.speed} outside allowed range ${rules.allowedSpeedRange.min}-${rules.allowedSpeedRange.max}`);
        blockedContent.push('speed');
        recommendations.push(`Adjust speed to between ${rules.allowedSpeedRange.min} and ${rules.allowedSpeedRange.max}`);
      }

      // Validate accent
      if (!rules.allowedAccents.includes(characteristics.accent)) {
        violations.push(`Accent ${characteristics.accent} not allowed for age group ${ageGroup}`);
        blockedContent.push('accent');
        recommendations.push(`Choose from allowed accents: ${rules.allowedAccents.join(', ')}`);
      }

      // Validate emotional tone
      if (!rules.allowedTones.includes(characteristics.emotionalTone)) {
        violations.push(`Emotional tone ${characteristics.emotionalTone} not allowed for age group ${ageGroup}`);
        blockedContent.push('emotionalTone');
        recommendations.push(`Choose from allowed tones: ${rules.allowedTones.join(', ')}`);
      }

      // Validate volume
      if (characteristics.volume > rules.maxVolumeLevel) {
        violations.push(`Volume ${characteristics.volume} exceeds maximum ${rules.maxVolumeLevel} for age group`);
        blockedContent.push('volume');
        recommendations.push(`Reduce volume to ${rules.maxVolumeLevel} or lower`);
      }

      // Determine risk level and approval requirements
      const riskLevel: RiskLevel = violations.length === 0 ? 'low' : 
                                   violations.length <= 2 ? 'medium' : 'high';
      
      const requiresParentalApproval = riskLevel === 'high' || 
                                       (riskLevel === 'medium' && userAge < 13);

      return {
        isAllowed: violations.length === 0,
        violations,
        riskLevel,
        reason: violations.length === 0 ? 'Voice settings are appropriate for age group' : 
                'Voice settings contain age-inappropriate elements',
        requiresParentalApproval,
        blockedContent,
        recommendations
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        isAllowed: false,
        violations: [errorMessage],
        riskLevel: 'high' as RiskLevel,
        reason: 'Error during voice settings validation',
        requiresParentalApproval: true,
        blockedContent: ['voice_characteristics'],
        recommendations: ['Contact support for assistance']
      };
    }
  }

  /**
   * Add integration with existing TTS engine from voice pipeline
   */
  async integrateWithTTS(characteristics: VoiceCharacteristics): Promise<void> {
    try {
      // Validate TTS engine support for characteristics
      if (this.ttsEngine) {
        const isSupported = await this.ttsEngine.validateVoiceSupport(characteristics);
        if (!isSupported) {
          throw new Error('TTS engine does not support the specified voice characteristics');
        }

        // Update TTS engine parameters
        await this.ttsEngine.updateVoiceParameters(characteristics);
      }

      // Integrate with personality-voice system
      if (this.voicePipeline) {
        await this.voicePipeline.updateTTSParameters(characteristics);
      }

      // Test integration with sample synthesis
      await this.testTTSIntegration(characteristics);

      avatarEventBus.emit('voice:tts:integrated', characteristics);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      avatarEventBus.emitSystemError('voice-characteristics-manager', {
        code: 'TTS_INTEGRATION_FAILED',
        message: `Failed to integrate with TTS engine: ${errorMessage}`,
        component: 'voice-characteristics-manager',
        severity: 'error',
        recoverable: true,
        context: { characteristics }
      });

      throw error;
    }
  }

  /**
   * Get voice presets for quick configuration based on age
   */
  async getVoicePresets(userAge: number): Promise<VoicePreset[]> {
    try {
      const ageGroup = this.determineAgeGroup(userAge);
      const presets = this.voicePresets.get(ageGroup) || [];

      // Filter presets based on current TTS engine capabilities
      const availablePresets: VoicePreset[] = [];
      
      for (const preset of presets) {
        try {
          // Validate preset with current safety rules
          const safetyResult = await this.validateVoiceSettings(preset.characteristics, userAge);
          
          if (safetyResult.isAllowed || !safetyResult.requiresParentalApproval) {
            availablePresets.push(preset);
          }
        } catch (error) {
          // Skip presets that fail validation
          continue;
        }
      }

      return availablePresets;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      avatarEventBus.emitSystemError('voice-characteristics-manager', {
        code: 'VOICE_PRESETS_FAILED',
        message: `Failed to get voice presets: ${errorMessage}`,
        component: 'voice-characteristics-manager',
        severity: 'warning',
        recoverable: true,
        context: { userAge }
      });

      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Set TTS engine for voice synthesis
   */
  setTTSEngine(engine: TTSEngineInterface): void {
    this.ttsEngine = engine;
  }

  /**
   * Set voice pipeline for integration
   */
  setVoicePipeline(pipeline: VoicePipelineInterface): void {
    this.voicePipeline = pipeline;
  }

  /**
   * Get active voice settings for a user
   */
  getActiveVoiceSettings(userId: string): VoiceCharacteristics | undefined {
    return this.activeVoiceSettings.get(userId);
  }

  /**
   * Store voice settings for a user
   */
  setActiveVoiceSettings(userId: string, characteristics: VoiceCharacteristics): void {
    this.activeVoiceSettings.set(userId, characteristics);
  }

  // Private helper methods

  private initializeValidationRules(): void {
    // Toddler rules (2-4 years)
    this.validationRules.set(AgeRange.TODDLER, {
      ageGroup: AgeRange.TODDLER,
      allowedPitchRange: { min: -0.5, max: 1.0 }, // Higher pitch for children
      allowedSpeedRange: { min: 0.7, max: 1.2 }, // Slower to moderate speed
      allowedAccents: [AccentType.NEUTRAL, AccentType.AMERICAN],
      allowedTones: [EmotionalTone.CHEERFUL, EmotionalTone.GENTLE, EmotionalTone.CALM],
      maxVolumeLevel: 0.8
    });

    // Child rules (5-12 years)
    this.validationRules.set(AgeRange.CHILD, {
      ageGroup: AgeRange.CHILD,
      allowedPitchRange: { min: -1.0, max: 1.5 },
      allowedSpeedRange: { min: 0.8, max: 1.4 },
      allowedAccents: [AccentType.NEUTRAL, AccentType.AMERICAN, AccentType.BRITISH],
      allowedTones: [EmotionalTone.CHEERFUL, EmotionalTone.GENTLE, EmotionalTone.CALM, EmotionalTone.ENERGETIC],
      maxVolumeLevel: 0.9
    });

    // Teen rules (13-17 years)
    this.validationRules.set(AgeRange.TEEN, {
      ageGroup: AgeRange.TEEN,
      allowedPitchRange: { min: -1.5, max: 1.5 },
      allowedSpeedRange: { min: 0.6, max: 1.8 },
      allowedAccents: Object.values(AccentType),
      allowedTones: Object.values(EmotionalTone),
      maxVolumeLevel: 1.0
    });

    // Adult rules (18+ years)
    this.validationRules.set(AgeRange.ADULT, {
      ageGroup: AgeRange.ADULT,
      allowedPitchRange: { min: -2.0, max: 2.0 },
      allowedSpeedRange: { min: 0.5, max: 2.0 },
      allowedAccents: Object.values(AccentType),
      allowedTones: Object.values(EmotionalTone),
      maxVolumeLevel: 1.0
    });
  }

  private initializeVoicePresets(): void {
    // Toddler presets
    this.voicePresets.set(AgeRange.TODDLER, [
      {
        id: 'toddler-friendly',
        name: 'Friendly Helper',
        description: 'A warm, gentle voice perfect for young children',
        characteristics: {
          pitch: 0.5,
          speed: 0.9,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CHEERFUL,
          volume: 0.7
        },
        ageAppropriate: [AgeRange.TODDLER]
      },
      {
        id: 'toddler-calm',
        name: 'Calm Companion',
        description: 'A soothing voice for bedtime and quiet activities',
        characteristics: {
          pitch: 0.2,
          speed: 0.8,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.GENTLE,
          volume: 0.6
        },
        ageAppropriate: [AgeRange.TODDLER]
      }
    ]);

    // Child presets
    this.voicePresets.set(AgeRange.CHILD, [
      {
        id: 'child-energetic',
        name: 'Energetic Friend',
        description: 'An enthusiastic voice for learning and play',
        characteristics: {
          pitch: 0.3,
          speed: 1.1,
          accent: AccentType.AMERICAN,
          emotionalTone: EmotionalTone.ENERGETIC,
          volume: 0.8
        },
        ageAppropriate: [AgeRange.CHILD]
      },
      {
        id: 'child-teacher',
        name: 'Helpful Teacher',
        description: 'A clear, patient voice for educational content',
        characteristics: {
          pitch: 0.1,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CALM,
          volume: 0.8
        },
        ageAppropriate: [AgeRange.CHILD]
      }
    ]);

    // Teen presets
    this.voicePresets.set(AgeRange.TEEN, [
      {
        id: 'teen-casual',
        name: 'Casual Buddy',
        description: 'A relaxed, friendly voice for everyday conversations',
        characteristics: {
          pitch: 0.0,
          speed: 1.2,
          accent: AccentType.AMERICAN,
          emotionalTone: EmotionalTone.CHEERFUL,
          volume: 0.9
        },
        ageAppropriate: [AgeRange.TEEN]
      },
      {
        id: 'teen-cool',
        name: 'Cool Assistant',
        description: 'A confident voice with a modern style',
        characteristics: {
          pitch: -0.2,
          speed: 1.1,
          accent: AccentType.BRITISH,
          emotionalTone: EmotionalTone.CALM,
          volume: 0.9
        },
        ageAppropriate: [AgeRange.TEEN]
      }
    ]);

    // Adult presets
    this.voicePresets.set(AgeRange.ADULT, [
      {
        id: 'adult-professional',
        name: 'Professional Assistant',
        description: 'A clear, professional voice for work and productivity',
        characteristics: {
          pitch: -0.1,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CALM,
          volume: 0.8
        },
        ageAppropriate: [AgeRange.ADULT]
      },
      {
        id: 'adult-warm',
        name: 'Warm Companion',
        description: 'A friendly, approachable voice for personal use',
        characteristics: {
          pitch: 0.1,
          speed: 0.9,
          accent: AccentType.AMERICAN,
          emotionalTone: EmotionalTone.CHEERFUL,
          volume: 0.8
        },
        ageAppropriate: [AgeRange.ADULT]
      }
    ]);
  }

  private setupEventListeners(): void {
    // Listen for safety violations
    avatarEventBus.onSafetyViolation((userId: string, violation: any) => {
      if (violation.type === 'voice_characteristics') {
        // Reset to safe defaults
        const safeCharacteristics = this.getSafeDefaultCharacteristics();
        this.setActiveVoiceSettings(userId, safeCharacteristics);
      }
    });
  }

  private async validateVoiceCharacteristics(characteristics: VoiceCharacteristics): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate pitch range
    if (characteristics.pitch < -2.0 || characteristics.pitch > 2.0) {
      errors.push(`Pitch ${characteristics.pitch} outside valid range -2.0 to 2.0`);
    }

    // Validate speed range
    if (characteristics.speed < 0.5 || characteristics.speed > 2.0) {
      errors.push(`Speed ${characteristics.speed} outside valid range 0.5 to 2.0`);
    }

    // Validate volume range
    if (characteristics.volume < 0.0 || characteristics.volume > 1.0) {
      errors.push(`Volume ${characteristics.volume} outside valid range 0.0 to 1.0`);
    }

    // Validate enum values
    if (!Object.values(AccentType).includes(characteristics.accent)) {
      errors.push(`Invalid accent type: ${characteristics.accent}`);
    }

    if (!Object.values(EmotionalTone).includes(characteristics.emotionalTone)) {
      errors.push(`Invalid emotional tone: ${characteristics.emotionalTone}`);
    }

    return {
      isValid: errors.length === 0,
      requiresParentalApproval: false,
      blockedElements: [],
      warnings,
      errors
    };
  }

  private determineAgeGroup(age: number): AgeRange {
    if (age >= 2 && age <= 4) return AgeRange.TODDLER;
    if (age >= 5 && age <= 12) return AgeRange.CHILD;
    if (age >= 13 && age <= 17) return AgeRange.TEEN;
    return AgeRange.ADULT;
  }

  private generateCacheKey(characteristics: VoiceCharacteristics, sampleText: string): string {
    return `${characteristics.pitch}_${characteristics.speed}_${characteristics.accent}_${characteristics.emotionalTone}_${characteristics.volume}_${sampleText.length}`;
  }

  private isCacheValid(result: VoicePreviewResult): boolean {
    // Cache is valid for 5 minutes
    return Date.now() - result.generationTime < 300000;
  }

  private generateDefaultSampleText(characteristics: VoiceCharacteristics): string {
    const sampleTexts = {
      [EmotionalTone.CHEERFUL]: "Hello! I'm excited to help you today. How can I assist you?",
      [EmotionalTone.CALM]: "Hello. I'm here to help you with whatever you need.",
      [EmotionalTone.ENERGETIC]: "Hey there! Ready to get started? Let's make something amazing!",
      [EmotionalTone.GENTLE]: "Hello, dear. I'm here to support you in any way I can."
    };

    return sampleTexts[characteristics.emotionalTone] || sampleTexts[EmotionalTone.CALM];
  }

  private async assessVoiceQuality(audioBuffer: AudioBuffer, characteristics: VoiceCharacteristics): Promise<VoiceQuality> {
    // Simplified quality assessment - in a real implementation, this would use audio analysis
    return {
      clarity: 0.9,
      naturalness: 0.85,
      consistency: 0.9,
      ageAppropriateness: 0.95
    };
  }

  private createEmptyAudioBuffer(): AudioBuffer {
    return {
      length: 0,
      duration: 0,
      sampleRate: 44100,
      numberOfChannels: 1
    };
  }

  private async testTTSIntegration(characteristics: VoiceCharacteristics): Promise<void> {
    if (!this.ttsEngine) {
      throw new Error('TTS engine not available for testing');
    }

    const testText = "Testing voice integration.";
    await this.ttsEngine.synthesizeSpeech(testText, characteristics);
  }

  private getSafeDefaultCharacteristics(): VoiceCharacteristics {
    return {
      pitch: 0.0,
      speed: 1.0,
      accent: AccentType.NEUTRAL,
      emotionalTone: EmotionalTone.CALM,
      volume: 0.8
    };
  }
}

// Export singleton instance
export const voiceCharacteristicsManager = new VoiceCharacteristicsManagerImpl();