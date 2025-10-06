import { EventEmitter } from 'events';
import { AppearanceManager } from './appearance-manager';
import { 
  FaceCustomizationSystem, 
  HairStyleSystem, 
  ClothingAccessorySystem,
  type FaceCustomizations,
  type HairCustomizations,
  type ClothingSelections,
  type AccessorySelection,
  type ColorCustomizations
} from './asset-categories';
import {
  AppearanceConfiguration,
  AppearanceChange,
  ExtendedFaceConfiguration,
  ExtendedHairConfiguration,
  ExtendedClothingConfiguration,
  ExtendedAccessoryConfiguration,
  ExtendedAnimationSet,
  PerformanceLevel
} from './types';

/**
 * Integrates all appearance customization systems into a unified interface
 * Coordinates between face, hair, clothing, and accessory systems
 */
export class AppearanceIntegrationSystem extends EventEmitter {
  private faceSystem: FaceCustomizationSystem;
  private hairSystem: HairStyleSystem;
  private clothingSystem: ClothingAccessorySystem;
  private appearanceManager: AppearanceManager;

  constructor(appearanceManager: AppearanceManager) {
    super();
    this.appearanceManager = appearanceManager;
    this.faceSystem = new FaceCustomizationSystem();
    this.hairSystem = new HairStyleSystem();
    this.clothingSystem = new ClothingAccessorySystem();

    this.setupEventHandlers();
  }

  /**
   * Creates a complete appearance configuration from individual customizations
   * @param customizations - All appearance customization options
   * @param userAge - User's age for validation
   * @returns Complete appearance configuration
   */
  async createCompleteAppearance(customizations: CompleteAppearanceCustomizations, userAge: number): Promise<AppearanceConfiguration> {
    try {
      // Create face configuration
      const faceConfig = this.faceSystem.createFaceConfiguration(
        customizations.face.variantId,
        customizations.face.customizations
      );

      // Validate face configuration for age appropriateness
      const faceValidation = this.faceSystem.validateFaceCustomization(faceConfig, userAge);
      if (!faceValidation.isValid) {
        throw new Error(`Face customization invalid: ${faceValidation.issues.join(', ')}`);
      }

      // Create hair configuration
      const hairConfig = this.hairSystem.createHairConfiguration(
        customizations.hair.styleId,
        customizations.hair.customizations
      );

      // Create clothing configuration
      const clothingConfig = this.clothingSystem.createClothingConfiguration(customizations.clothing);

      // Apply color customizations if provided
      const finalClothingConfig = customizations.colorCustomizations
        ? this.clothingSystem.applyColorCustomization(clothingConfig, customizations.colorCustomizations)
        : clothingConfig;

      // Create accessory configurations
      const accessoryConfigs = customizations.accessories
        ? this.clothingSystem.createAccessoryConfiguration(customizations.accessories)
        : [];

      // Create default animation set
      const animationConfig = this.createDefaultAnimationSet();

      const completeConfig: AppearanceConfiguration = {
        face: faceConfig,
        hair: hairConfig,
        clothing: finalClothingConfig,
        accessories: accessoryConfigs,
        animations: animationConfig
      };

      this.emit('completeAppearanceCreated', { customizations, config: completeConfig, userAge });
      return completeConfig;

    } catch (error) {
      this.emit('appearanceCreationError', { error, customizations, userAge });
      throw error;
    }
  }

  /**
   * Updates a specific aspect of the appearance configuration
   * @param currentConfig - Current appearance configuration
   * @param updateType - Type of update to perform
   * @param updateData - Update-specific data
   * @param userAge - User's age for validation
   * @returns Updated appearance configuration
   */
  async updateAppearanceAspect(
    currentConfig: AppearanceConfiguration,
    updateType: AppearanceUpdateType,
    updateData: any,
    userAge: number
  ): Promise<AppearanceConfiguration> {
    let updatedConfig = { ...currentConfig };

    switch (updateType) {
      case 'face':
        updatedConfig.face = this.faceSystem.createFaceConfiguration(
          updateData.variantId,
          updateData.customizations
        );
        
        const faceValidation = this.faceSystem.validateFaceCustomization(updatedConfig.face, userAge);
        if (!faceValidation.isValid) {
          throw new Error(`Face update invalid: ${faceValidation.issues.join(', ')}`);
        }
        break;

      case 'hair':
        updatedConfig.hair = this.hairSystem.createHairConfiguration(
          updateData.styleId,
          updateData.customizations
        );
        break;

      case 'clothing':
        updatedConfig.clothing = this.clothingSystem.createClothingConfiguration(updateData);
        break;

      case 'accessories':
        updatedConfig.accessories = this.clothingSystem.createAccessoryConfiguration(updateData);
        break;

      case 'colors':
        updatedConfig.clothing = this.clothingSystem.applyColorCustomization(
          updatedConfig.clothing,
          updateData
        );
        break;

      default:
        throw new Error(`Unknown update type: ${updateType}`);
    }

    // Create appearance change record
    const appearanceChange: AppearanceChange = {
      changeId: this.generateChangeId(),
      type: updateType as any,
      oldConfiguration: currentConfig,
      newConfiguration: updatedConfig,
      timestamp: new Date(),
      userId: 'current_user' // In real implementation, this would come from context
    };

    // Apply the change through the appearance manager
    const renderResult = await this.appearanceManager.updateAppearance(appearanceChange);

    this.emit('appearanceAspectUpdated', { 
      updateType, 
      updateData, 
      oldConfig: currentConfig, 
      newConfig: updatedConfig,
      renderResult 
    });

    return updatedConfig;
  }

  /**
   * Gets all available customization options for a user
   * @param userAge - User's age for filtering
   * @param performanceLevel - Maximum performance level allowed
   * @returns All available customization options
   */
  async getAvailableCustomizations(userAge: number, performanceLevel: PerformanceLevel = PerformanceLevel.HIGH): Promise<AvailableCustomizations> {
    const [faceVariants, hairStyles, topClothing, bottomClothing, shoes, hats, glasses, jewelry, backpacks] = await Promise.all([
      this.faceSystem.getAvailableFaceVariants(userAge),
      this.hairSystem.getAvailableHairStyles(userAge, performanceLevel),
      this.clothingSystem.getAvailableClothing('top', userAge),
      this.clothingSystem.getAvailableClothing('bottom', userAge),
      this.clothingSystem.getAvailableClothing('shoes', userAge),
      this.clothingSystem.getAvailableAccessories('hat' as any, userAge),
      this.clothingSystem.getAvailableAccessories('glasses' as any, userAge),
      this.clothingSystem.getAvailableAccessories('jewelry' as any, userAge),
      this.clothingSystem.getAvailableAccessories('backpack' as any, userAge)
    ]);

    return {
      faces: faceVariants,
      hair: hairStyles,
      clothing: {
        tops: topClothing,
        bottoms: bottomClothing,
        shoes: shoes
      },
      accessories: {
        hats,
        glasses,
        jewelry,
        backpacks
      },
      colors: this.getAvailableColors(),
      performanceSettings: this.getPerformanceSettings()
    };
  }

  /**
   * Optimizes appearance configuration for performance
   * @param config - Appearance configuration to optimize
   * @returns Optimized appearance configuration
   */
  optimizeAppearanceForPerformance(config: AppearanceConfiguration): AppearanceConfiguration {
    return {
      face: config.face, // Face optimization handled by AppearanceManager
      hair: this.hairSystem.optimizeHairForPerformance(config.hair),
      clothing: config.clothing, // Clothing optimization handled by AppearanceManager
      accessories: config.accessories.slice(0, 3), // Limit accessories
      animations: {
        ...config.animations,
        frameRate: Math.min(config.animations.frameRate, 30),
        blendingEnabled: false
      }
    };
  }

  /**
   * Validates complete appearance configuration
   * @param config - Appearance configuration to validate
   * @param userAge - User's age for validation
   * @returns Validation result with any issues
   */
  validateCompleteAppearance(config: AppearanceConfiguration, userAge: number): AppearanceValidationResult {
    const issues: string[] = [];

    // Validate face
    const faceValidation = this.faceSystem.validateFaceCustomization(config.face, userAge);
    if (!faceValidation.isValid) {
      issues.push(...faceValidation.issues.map(issue => `Face: ${issue}`));
    }

    // Validate clothing appropriateness
    if (config.clothing.revealingLevel > this.getMaxRevealingLevel(userAge)) {
      issues.push('Clothing: Too revealing for age');
    }

    // Validate accessory count
    if (config.accessories.length > 5) {
      issues.push('Accessories: Too many accessories (maximum 5)');
    }

    // Validate performance impact
    const performanceIssues = this.validatePerformanceImpact(config);
    issues.push(...performanceIssues);

    return {
      isValid: issues.length === 0,
      issues,
      requiresOptimization: performanceIssues.length > 0
    };
  }

  /**
   * Creates a preset appearance configuration for quick selection
   * @param presetName - Name of the preset to create
   * @param userAge - User's age for appropriate defaults
   * @returns Preset appearance configuration
   */
  createPresetAppearance(presetName: string, userAge: number): AppearanceConfiguration {
    const presets = this.getAppearancePresets(userAge);
    const preset = presets.find(p => p.name === presetName);
    
    if (!preset) {
      throw new Error(`Preset not found: ${presetName}`);
    }

    return preset.configuration;
  }

  /**
   * Gets available appearance presets for a user age
   * @param userAge - User's age for filtering presets
   * @returns Array of available presets
   */
  getAppearancePresets(userAge: number): AppearancePreset[] {
    const presets: AppearancePreset[] = [];

    if (userAge >= 5 && userAge <= 12) {
      presets.push(
        {
          name: 'Friendly Kid',
          description: 'A cheerful and approachable appearance',
          configuration: this.createChildFriendlyPreset(),
          ageRange: { min: 5, max: 12 }
        },
        {
          name: 'Sporty Kid',
          description: 'Active and energetic appearance',
          configuration: this.createSportyPreset(),
          ageRange: { min: 5, max: 12 }
        }
      );
    }

    if (userAge >= 13 && userAge <= 17) {
      presets.push(
        {
          name: 'Cool Teen',
          description: 'Trendy and stylish appearance',
          configuration: this.createTeenPreset(),
          ageRange: { min: 13, max: 17 }
        }
      );
    }

    return presets;
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Forward events from subsystems
    this.faceSystem.on('faceConfigurationCreated', (data) => {
      this.emit('faceConfigurationCreated', data);
    });

    this.hairSystem.on('hairConfigurationCreated', (data) => {
      this.emit('hairConfigurationCreated', data);
    });

    this.hairSystem.on('physicsDisabled', (data) => {
      this.emit('hairPhysicsDisabled', data);
    });

    this.clothingSystem.on('clothingConfigurationCreated', (data) => {
      this.emit('clothingConfigurationCreated', data);
    });

    this.clothingSystem.on('accessoryConfigurationCreated', (data) => {
      this.emit('accessoryConfigurationCreated', data);
    });
  }

  private createDefaultAnimationSet(): ExtendedAnimationSet {
    return {
      idle: 'default_idle',
      talking: 'default_talking',
      listening: 'default_listening',
      thinking: 'default_thinking',
      expressions: {
        happy: 'default_happy',
        sad: 'default_sad',
        surprised: 'default_surprised',
        confused: 'default_confused',
        excited: 'default_excited'
      },
      frameRate: 60,
      blendingEnabled: true
    };
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getAvailableColors(): ColorPalette {
    return {
      hair: ['black', 'brown', 'blonde', 'red', 'gray'],
      eyes: ['brown', 'blue', 'green', 'hazel', 'gray'],
      skin: ['light', 'medium', 'dark', 'olive', 'tan'],
      clothing: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'gray']
    };
  }

  private getPerformanceSettings(): PerformanceSettings {
    return {
      detailLevels: [PerformanceLevel.LOW, PerformanceLevel.MEDIUM, PerformanceLevel.HIGH],
      physicsOptions: ['enabled', 'disabled', 'auto'],
      textureQualities: [0.5, 0.75, 1.0],
      maxAccessories: 5,
      maxHairStrands: 2000
    };
  }

  private getMaxRevealingLevel(userAge: number): number {
    if (userAge < 13) return 1;
    if (userAge < 16) return 2;
    return 3;
  }

  private validatePerformanceImpact(config: AppearanceConfiguration): string[] {
    const issues: string[] = [];

    // Check hair strand count
    if (config.hair.strandCount > 2000) {
      issues.push('Performance: Hair strand count too high');
    }

    // Check accessory count
    if (config.accessories.length > 5) {
      issues.push('Performance: Too many accessories');
    }

    // Check animation frame rate
    if (config.animations.frameRate > 60) {
      issues.push('Performance: Animation frame rate too high');
    }

    return issues;
  }

  private createChildFriendlyPreset(): AppearanceConfiguration {
    return {
      face: this.faceSystem.createFaceConfiguration('child_face_01', {
        eyeColor: 'brown',
        skinTone: 'medium'
      }),
      hair: this.hairSystem.createHairConfiguration('short_straight', {
        color: 'brown',
        length: 0.4
      }),
      clothing: this.clothingSystem.createClothingConfiguration({
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      }),
      accessories: [],
      animations: this.createDefaultAnimationSet()
    };
  }

  private createSportyPreset(): AppearanceConfiguration {
    return {
      face: this.faceSystem.createFaceConfiguration('child_face_02', {
        eyeColor: 'blue',
        skinTone: 'light'
      }),
      hair: this.hairSystem.createHairConfiguration('short_straight', {
        color: 'blonde',
        length: 0.3
      }),
      clothing: this.clothingSystem.createClothingConfiguration({
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      }),
      accessories: [
        this.clothingSystem.createAccessoryConfiguration([
          { accessoryId: 'baseball_cap' }
        ])[0]
      ],
      animations: this.createDefaultAnimationSet()
    };
  }

  private createTeenPreset(): AppearanceConfiguration {
    return {
      face: this.faceSystem.createFaceConfiguration('teen_face_01', {
        eyeColor: 'green',
        skinTone: 'medium'
      }),
      hair: this.hairSystem.createHairConfiguration('long_wavy', {
        color: 'black',
        length: 0.7
      }),
      clothing: this.clothingSystem.createClothingConfiguration({
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      }),
      accessories: [
        this.clothingSystem.createAccessoryConfiguration([
          { accessoryId: 'glasses' }
        ])[0]
      ],
      animations: this.createDefaultAnimationSet()
    };
  }
}

// Supporting interfaces and types

interface CompleteAppearanceCustomizations {
  face: {
    variantId: string;
    customizations: FaceCustomizations;
  };
  hair: {
    styleId: string;
    customizations: HairCustomizations;
  };
  clothing: ClothingSelections;
  accessories?: AccessorySelection[];
  colorCustomizations?: ColorCustomizations;
}

interface AvailableCustomizations {
  faces: any[];
  hair: any[];
  clothing: {
    tops: any[];
    bottoms: any[];
    shoes: any[];
  };
  accessories: {
    hats: any[];
    glasses: any[];
    jewelry: any[];
    backpacks: any[];
  };
  colors: ColorPalette;
  performanceSettings: PerformanceSettings;
}

interface ColorPalette {
  hair: string[];
  eyes: string[];
  skin: string[];
  clothing: string[];
}

interface PerformanceSettings {
  detailLevels: PerformanceLevel[];
  physicsOptions: string[];
  textureQualities: number[];
  maxAccessories: number;
  maxHairStrands: number;
}

interface AppearanceValidationResult {
  isValid: boolean;
  issues: string[];
  requiresOptimization: boolean;
}

interface AppearancePreset {
  name: string;
  description: string;
  configuration: AppearanceConfiguration;
  ageRange: { min: number; max: number };
}

type AppearanceUpdateType = 'face' | 'hair' | 'clothing' | 'accessories' | 'colors';

export {
  AppearanceIntegrationSystem,
  type CompleteAppearanceCustomizations,
  type AvailableCustomizations,
  type AppearanceValidationResult,
  type AppearancePreset,
  type AppearanceUpdateType
};