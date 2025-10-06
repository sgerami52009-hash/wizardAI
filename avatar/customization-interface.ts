/**
 * Avatar Customization Interface Components
 * 
 * Provides intuitive UI components for appearance, personality, and voice customization
 * with real-time preview integration and age-appropriate design patterns.
 */

import { EventEmitter } from 'events';
import { AvatarConfiguration, AppearanceConfiguration, PersonalityTraits, VoiceCharacteristics } from './types';
import { Avatar3DRenderer } from '../rendering/renderer';
import { AvatarSafetyValidator } from './enhanced-safety-validator';
import { VoiceCharacteristicsManager } from './voice-characteristics-manager';

export interface CustomizationUIConfig {
  userAge: number;
  userId: string;
  accessibilityMode: boolean;
  parentalControlsEnabled: boolean;
  maxComplexity: 'low' | 'medium' | 'high';
}

export interface CustomizationChange {
  changeId: string;
  type: 'appearance' | 'personality' | 'voice';
  category: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  requiresApproval: boolean;
}

export interface PreviewState {
  isActive: boolean;
  changeId: string;
  renderingFPS: number;
  lastUpdateTime: Date;
}

/**
 * Main customization interface controller that orchestrates all UI components
 */
export class AvatarCustomizationInterface extends EventEmitter {
  private renderer: Avatar3DRenderer;
  private safetyValidator: AvatarSafetyValidator;
  private voiceManager: VoiceCharacteristicsManager;
  private config: CustomizationUIConfig;
  private currentConfiguration: AvatarConfiguration;
  private previewState: PreviewState;
  private pendingChanges: Map<string, CustomizationChange>;

  constructor(
    renderer: Avatar3DRenderer,
    safetyValidator: AvatarSafetyValidator,
    voiceManager: VoiceCharacteristicsManager,
    config: CustomizationUIConfig
  ) {
    super();
    this.renderer = renderer;
    this.safetyValidator = safetyValidator;
    this.voiceManager = voiceManager;
    this.config = config;
    this.pendingChanges = new Map();
    this.previewState = {
      isActive: false,
      changeId: '',
      renderingFPS: 0,
      lastUpdateTime: new Date()
    };
  }

  /**
   * Initialize the customization interface with current avatar configuration
   */
  async initialize(configuration: AvatarConfiguration): Promise<void> {
    try {
      this.currentConfiguration = { ...configuration };
      
      // Validate configuration for user's age
      const validationResult = await this.safetyValidator.validateCustomization(
        configuration,
        this.config.userAge
      );

      if (!validationResult.isAllowed) {
        throw new Error('Current configuration not appropriate for user age');
      }

      // Initialize renderer with current configuration
      await this.renderer.renderAvatar(configuration);
      
      this.emit('initialized', { configuration, validationResult });
    } catch (error) {
      this.emit('error', { type: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Start real-time preview for a customization change
   */
  async startPreview(change: CustomizationChange): Promise<void> {
    try {
      // Validate the change first
      const tempConfig = this.applyChangeToConfiguration(change);
      const validationResult = await this.safetyValidator.validateCustomization(
        tempConfig,
        this.config.userAge
      );

      if (!validationResult.isAllowed) {
        this.emit('previewBlocked', { 
          change, 
          reason: validationResult.blockedElements.join(', '),
          parentalMessage: validationResult.parentalMessage 
        });
        return;
      }

      // Apply preview
      this.previewState = {
        isActive: true,
        changeId: change.changeId,
        renderingFPS: 0,
        lastUpdateTime: new Date()
      };

      if (change.type === 'appearance') {
        await this.renderer.renderAvatar(tempConfig);
      } else if (change.type === 'voice') {
        await this.voiceManager.previewVoice(
          tempConfig.voice,
          this.getAgeAppropriatePreviewText()
        );
      }

      // Monitor performance
      const metrics = this.renderer.getPerformanceMetrics();
      this.previewState.renderingFPS = metrics.currentFPS;

      this.emit('previewStarted', { change, metrics });
    } catch (error) {
      this.emit('error', { type: 'preview', error: error.message });
    }
  }

  /**
   * Stop current preview and revert to original configuration
   */
  async stopPreview(): Promise<void> {
    if (!this.previewState.isActive) return;

    try {
      await this.renderer.renderAvatar(this.currentConfiguration);
      this.previewState.isActive = false;
      this.emit('previewStopped');
    } catch (error) {
      this.emit('error', { type: 'preview', error: error.message });
    }
  }

  /**
   * Apply a customization change permanently
   */
  async applyChange(change: CustomizationChange): Promise<void> {
    try {
      const newConfig = this.applyChangeToConfiguration(change);
      
      // Final validation
      const validationResult = await this.safetyValidator.validateCustomization(
        newConfig,
        this.config.userAge
      );

      if (!validationResult.isAllowed) {
        throw new Error(`Change blocked: ${validationResult.blockedElements.join(', ')}`);
      }

      if (validationResult.requiresApproval && this.config.parentalControlsEnabled) {
        this.pendingChanges.set(change.changeId, change);
        this.emit('approvalRequired', { change, validationResult });
        return;
      }

      // Apply the change
      this.currentConfiguration = newConfig;
      await this.renderer.renderAvatar(this.currentConfiguration);
      
      this.emit('changeApplied', { change, configuration: this.currentConfiguration });
    } catch (error) {
      this.emit('error', { type: 'apply', error: error.message });
      throw error;
    }
  }

  /**
   * Get available customization options filtered by age and safety
   */
  async getAvailableOptions(category: string): Promise<any[]> {
    // This would integrate with asset management to get age-appropriate options
    // For now, return mock data structure
    const baseOptions = await this.getBaseOptionsForCategory(category);
    
    // Filter by age appropriateness
    return baseOptions.filter(option => 
      option.minAge <= this.config.userAge && 
      option.maxAge >= this.config.userAge &&
      option.safetyLevel <= this.getSafetyLevelForAge(this.config.userAge)
    );
  }

  private applyChangeToConfiguration(change: CustomizationChange): AvatarConfiguration {
    const newConfig = { ...this.currentConfiguration };
    
    switch (change.type) {
      case 'appearance':
        newConfig.appearance = { 
          ...newConfig.appearance, 
          [change.category]: change.newValue 
        };
        break;
      case 'personality':
        newConfig.personality = { 
          ...newConfig.personality, 
          [change.category]: change.newValue 
        };
        break;
      case 'voice':
        newConfig.voice = { 
          ...newConfig.voice, 
          [change.category]: change.newValue 
        };
        break;
    }
    
    return newConfig;
  }

  private getAgeAppropriatePreviewText(): string {
    if (this.config.userAge < 8) {
      return "Hi! I'm your friendly helper!";
    } else if (this.config.userAge < 13) {
      return "Hello! I'm here to help you learn and have fun!";
    } else {
      return "Hello! I'm your AI assistant, ready to help with your questions.";
    }
  }

  private async getBaseOptionsForCategory(category: string): Promise<any[]> {
    // Mock implementation - would integrate with actual asset system
    return [];
  }

  private getSafetyLevelForAge(age: number): number {
    if (age < 8) return 1; // Most restrictive
    if (age < 13) return 2;
    if (age < 16) return 3;
    return 4; // Least restrictive for teens
  }
}

/**
 * Appearance customization component
 */
export class AppearanceCustomizationPanel extends EventEmitter {
  private interface: AvatarCustomizationInterface;
  private categories: string[];
  private selectedCategory: string;

  constructor(customizationInterface: AvatarCustomizationInterface) {
    super();
    this.interface = customizationInterface;
    this.categories = ['face', 'hair', 'clothing', 'accessories'];
    this.selectedCategory = 'face';
  }

  async selectCategory(category: string): Promise<void> {
    if (!this.categories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    this.selectedCategory = category;
    const options = await this.interface.getAvailableOptions(category);
    this.emit('categorySelected', { category, options });
  }

  async selectOption(optionId: string): Promise<void> {
    const change: CustomizationChange = {
      changeId: `appearance-${Date.now()}`,
      type: 'appearance',
      category: this.selectedCategory,
      oldValue: this.getCurrentValue(),
      newValue: optionId,
      timestamp: new Date(),
      requiresApproval: false
    };

    await this.interface.startPreview(change);
    this.emit('optionSelected', { change });
  }

  private getCurrentValue(): any {
    // Get current value for the selected category
    return null; // Mock implementation
  }
}

/**
 * Personality customization component
 */
export class PersonalityCustomizationPanel extends EventEmitter {
  private interface: AvatarCustomizationInterface;
  private traits: (keyof PersonalityTraits)[];

  constructor(customizationInterface: AvatarCustomizationInterface) {
    super();
    this.interface = customizationInterface;
    this.traits = ['friendliness', 'formality', 'humor', 'enthusiasm', 'patience', 'supportiveness'];
  }

  async updateTrait(trait: keyof PersonalityTraits, value: number): Promise<void> {
    // Validate value range (1-10)
    if (value < 1 || value > 10) {
      throw new Error('Trait value must be between 1 and 10');
    }

    const change: CustomizationChange = {
      changeId: `personality-${trait}-${Date.now()}`,
      type: 'personality',
      category: trait,
      oldValue: this.getCurrentTraitValue(trait),
      newValue: value,
      timestamp: new Date(),
      requiresApproval: true // Personality changes often require approval
    };

    await this.interface.startPreview(change);
    this.emit('traitUpdated', { trait, value, change });
  }

  getTraitDescription(trait: keyof PersonalityTraits): string {
    const descriptions = {
      friendliness: "How warm and welcoming your assistant is",
      formality: "How casual or formal your assistant speaks",
      humor: "How often your assistant uses jokes and fun",
      enthusiasm: "How excited your assistant gets about things",
      patience: "How calm your assistant stays when helping",
      supportiveness: "How encouraging your assistant is"
    };

    return descriptions[trait] || "Personality trait";
  }

  private getCurrentTraitValue(trait: keyof PersonalityTraits): number {
    // Get current trait value
    return 5; // Mock implementation
  }
}

/**
 * Voice customization component
 */
export class VoiceCustomizationPanel extends EventEmitter {
  private interface: AvatarCustomizationInterface;
  private voiceManager: VoiceCharacteristicsManager;

  constructor(
    customizationInterface: AvatarCustomizationInterface,
    voiceManager: VoiceCharacteristicsManager
  ) {
    super();
    this.interface = customizationInterface;
    this.voiceManager = voiceManager;
  }

  async updateVoiceParameter(parameter: keyof VoiceCharacteristics, value: number): Promise<void> {
    // Validate parameter ranges
    this.validateParameterValue(parameter, value);

    const change: CustomizationChange = {
      changeId: `voice-${parameter}-${Date.now()}`,
      type: 'voice',
      category: parameter,
      oldValue: this.getCurrentParameterValue(parameter),
      newValue: value,
      timestamp: new Date(),
      requiresApproval: false
    };

    await this.interface.startPreview(change);
    this.emit('voiceParameterUpdated', { parameter, value, change });
  }

  async playVoicePreview(): Promise<void> {
    try {
      const previewText = "This is how your assistant will sound with these settings.";
      // Voice preview would be handled by the interface
      this.emit('voicePreviewPlayed');
    } catch (error) {
      this.emit('error', { type: 'voicePreview', error: error.message });
    }
  }

  private validateParameterValue(parameter: keyof VoiceCharacteristics, value: number): void {
    const ranges = {
      pitch: { min: -2.0, max: 2.0 },
      speed: { min: 0.5, max: 2.0 },
      volume: { min: 0.0, max: 1.0 }
    };

    const range = ranges[parameter as keyof typeof ranges];
    if (range && (value < range.min || value > range.max)) {
      throw new Error(`${parameter} must be between ${range.min} and ${range.max}`);
    }
  }

  private getCurrentParameterValue(parameter: keyof VoiceCharacteristics): number {
    // Get current parameter value
    return 1.0; // Mock implementation
  }
}