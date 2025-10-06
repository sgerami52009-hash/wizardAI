import { EventEmitter } from 'events';
import {
  ExtendedFaceConfiguration,
  ExtendedHairConfiguration,
  ExtendedClothingConfiguration,
  ExtendedAccessoryConfiguration,
  AssetInfo,
  PerformanceLevel,
  SafetyRating,
  AccessoryType,
  HairTexture,
  Vector3
} from './types';

/**
 * Face customization system with multiple variants and age-appropriate options
 * Provides modular face asset management with real-time preview capabilities
 */
export class FaceCustomizationSystem extends EventEmitter {
  private availableFaces: Map<string, FaceAsset> = new Map();
  private faceVariants: Map<string, FaceVariant[]> = new Map();

  constructor() {
    super();
    this.initializeFaceAssets();
  }

  /**
   * Gets available face variants filtered by age and safety rating
   * @param userAge - User's age for filtering
   * @param safetyLevel - Required safety level
   * @returns Array of appropriate face variants
   */
  getAvailableFaceVariants(userAge: number, safetyLevel: SafetyRating = SafetyRating.SAFE): FaceVariant[] {
    const allVariants: FaceVariant[] = [];
    
    for (const variants of this.faceVariants.values()) {
      const filteredVariants = variants.filter(variant => 
        this.isAgeAppropriate(variant, userAge) && 
        this.meetsSafetyRequirements(variant, safetyLevel)
      );
      allVariants.push(...filteredVariants);
    }

    return allVariants;
  }

  /**
   * Creates a face configuration with specified parameters
   * @param variantId - The face variant ID to use
   * @param customizations - Custom face parameters
   * @returns Complete face configuration
   */
  createFaceConfiguration(variantId: string, customizations: FaceCustomizations): ExtendedFaceConfiguration {
    const variant = this.getFaceVariant(variantId);
    if (!variant) {
      throw new Error(`Face variant not found: ${variantId}`);
    }

    const config: ExtendedFaceConfiguration = {
      meshId: variant.meshId,
      textureId: variant.textureId,
      eyeColor: customizations.eyeColor || variant.defaultEyeColor,
      skinTone: customizations.skinTone || variant.defaultSkinTone,
      features: {
        eyeSize: this.clampFeatureValue(customizations.eyeSize || 1.0),
        noseSize: this.clampFeatureValue(customizations.noseSize || 1.0),
        mouthSize: this.clampFeatureValue(customizations.mouthSize || 1.0),
        cheekbones: this.clampFeatureValue(customizations.cheekbones || 1.0)
      },
      detailLevel: customizations.detailLevel || PerformanceLevel.MEDIUM,
      textureQuality: customizations.textureQuality || 1.0,
      matureFeatures: customizations.matureFeatures || false
    };

    this.emit('faceConfigurationCreated', { variantId, config });
    return config;
  }

  /**
   * Validates face customization for age appropriateness
   * @param config - Face configuration to validate
   * @param userAge - User's age
   * @returns Validation result with any issues
   */
  validateFaceCustomization(config: ExtendedFaceConfiguration, userAge: number): ValidationResult {
    const issues: string[] = [];

    // Check for mature features on young users
    if (userAge < 13 && config.matureFeatures) {
      issues.push('Mature facial features not appropriate for age');
    }

    // Check feature proportions for realism
    if (this.hasUnrealisticProportions(config.features)) {
      issues.push('Facial proportions are unrealistic');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  private getFaceVariant(variantId: string): FaceVariant | undefined {
    for (const variants of this.faceVariants.values()) {
      const variant = variants.find(v => v.id === variantId);
      if (variant) return variant;
    }
    return undefined;
  }

  private clampFeatureValue(value: number): number {
    return Math.max(0.5, Math.min(2.0, value));
  }

  private hasUnrealisticProportions(features: any): boolean {
    const total = features.eyeSize + features.noseSize + features.mouthSize + features.cheekbones;
    return total > 6.0 || total < 2.0; // Reasonable bounds for feature combinations
  }

  private isAgeAppropriate(variant: FaceVariant, userAge: number): boolean {
    return userAge >= variant.minAge && userAge <= variant.maxAge;
  }

  private meetsSafetyRequirements(variant: FaceVariant, requiredLevel: SafetyRating): boolean {
    const safetyLevels = [SafetyRating.SAFE, SafetyRating.CAUTION, SafetyRating.RESTRICTED, SafetyRating.BLOCKED];
    return safetyLevels.indexOf(variant.safetyRating) <= safetyLevels.indexOf(requiredLevel);
  }

  private initializeFaceAssets(): void {
    // Initialize default face variants for different age groups
    const childFaces: FaceVariant[] = [
      {
        id: 'child_face_01',
        name: 'Friendly Child',
        meshId: 'child_mesh_01',
        textureId: 'child_texture_01',
        defaultEyeColor: 'brown',
        defaultSkinTone: 'medium',
        minAge: 5,
        maxAge: 12,
        safetyRating: SafetyRating.SAFE,
        performanceImpact: PerformanceLevel.LOW
      },
      {
        id: 'child_face_02',
        name: 'Cheerful Child',
        meshId: 'child_mesh_02',
        textureId: 'child_texture_02',
        defaultEyeColor: 'blue',
        defaultSkinTone: 'light',
        minAge: 5,
        maxAge: 12,
        safetyRating: SafetyRating.SAFE,
        performanceImpact: PerformanceLevel.LOW
      }
    ];

    const teenFaces: FaceVariant[] = [
      {
        id: 'teen_face_01',
        name: 'Teen Style 1',
        meshId: 'teen_mesh_01',
        textureId: 'teen_texture_01',
        defaultEyeColor: 'green',
        defaultSkinTone: 'medium',
        minAge: 13,
        maxAge: 17,
        safetyRating: SafetyRating.SAFE,
        performanceImpact: PerformanceLevel.MEDIUM
      }
    ];

    this.faceVariants.set('child', childFaces);
    this.faceVariants.set('teen', teenFaces);
  }
}

/**
 * Hair style system with physics simulation and animation support
 * Manages hair assets with performance optimization for Jetson Nano Orin
 */
export class HairStyleSystem extends EventEmitter {
  private hairStyles: Map<string, HairStyle> = new Map();
  private physicsEnabled = true;

  constructor() {
    super();
    this.initializeHairStyles();
  }

  /**
   * Gets available hair styles filtered by age and performance requirements
   * @param userAge - User's age for filtering
   * @param maxPerformanceImpact - Maximum allowed performance impact
   * @returns Array of appropriate hair styles
   */
  getAvailableHairStyles(userAge: number, maxPerformanceImpact: PerformanceLevel = PerformanceLevel.HIGH): HairStyle[] {
    return Array.from(this.hairStyles.values()).filter(style =>
      this.isAgeAppropriate(style, userAge) &&
      this.meetsPerformanceRequirements(style, maxPerformanceImpact)
    );
  }

  /**
   * Creates hair configuration with physics and animation settings
   * @param styleId - Hair style ID
   * @param customizations - Hair customization parameters
   * @returns Complete hair configuration
   */
  createHairConfiguration(styleId: string, customizations: HairCustomizations): ExtendedHairConfiguration {
    const style = this.hairStyles.get(styleId);
    if (!style) {
      throw new Error(`Hair style not found: ${styleId}`);
    }

    const config: ExtendedHairConfiguration = {
      styleId: style.id,
      color: customizations.color || style.defaultColor,
      length: this.clampLength(customizations.length || style.defaultLength),
      texture: customizations.texture || style.defaultTexture,
      physicsEnabled: this.physicsEnabled && (customizations.physicsEnabled !== false),
      strandCount: this.calculateStrandCount(style, customizations.quality || PerformanceLevel.MEDIUM),
      detailLevel: customizations.detailLevel || PerformanceLevel.MEDIUM
    };

    // Adjust physics settings based on performance
    if (config.physicsEnabled && config.strandCount > 1500) {
      config.physicsEnabled = false; // Disable physics for high strand counts
      this.emit('physicsDisabled', { reason: 'performance', strandCount: config.strandCount });
    }

    this.emit('hairConfigurationCreated', { styleId, config });
    return config;
  }

  /**
   * Enables or disables hair physics globally
   * @param enabled - Whether to enable physics simulation
   */
  setPhysicsEnabled(enabled: boolean): void {
    this.physicsEnabled = enabled;
    this.emit('physicsSettingChanged', { enabled });
  }

  /**
   * Optimizes hair configuration for performance
   * @param config - Hair configuration to optimize
   * @returns Optimized hair configuration
   */
  optimizeHairForPerformance(config: ExtendedHairConfiguration): ExtendedHairConfiguration {
    return {
      ...config,
      physicsEnabled: false,
      strandCount: Math.min(config.strandCount, 800),
      detailLevel: PerformanceLevel.LOW
    };
  }

  private clampLength(length: number): number {
    return Math.max(0.1, Math.min(2.0, length));
  }

  private calculateStrandCount(style: HairStyle, quality: PerformanceLevel): number {
    const baseCount = style.baseStrandCount;
    switch (quality) {
      case PerformanceLevel.LOW: return Math.floor(baseCount * 0.5);
      case PerformanceLevel.MEDIUM: return baseCount;
      case PerformanceLevel.HIGH: return Math.floor(baseCount * 1.5);
      case PerformanceLevel.ULTRA: return baseCount * 2;
      default: return baseCount;
    }
  }

  private isAgeAppropriate(style: HairStyle, userAge: number): boolean {
    return userAge >= style.minAge && userAge <= style.maxAge;
  }

  private meetsPerformanceRequirements(style: HairStyle, maxImpact: PerformanceLevel): boolean {
    const impactLevels = [PerformanceLevel.LOW, PerformanceLevel.MEDIUM, PerformanceLevel.HIGH, PerformanceLevel.ULTRA];
    return impactLevels.indexOf(style.performanceImpact) <= impactLevels.indexOf(maxImpact);
  }

  private initializeHairStyles(): void {
    const hairStyles: HairStyle[] = [
      {
        id: 'short_straight',
        name: 'Short Straight',
        defaultColor: 'brown',
        defaultLength: 0.3,
        defaultTexture: HairTexture.STRAIGHT,
        baseStrandCount: 800,
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'long_wavy',
        name: 'Long Wavy',
        defaultColor: 'blonde',
        defaultLength: 0.8,
        defaultTexture: HairTexture.WAVY,
        baseStrandCount: 1200,
        minAge: 8,
        maxAge: 99,
        performanceImpact: PerformanceLevel.MEDIUM,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'curly_medium',
        name: 'Medium Curly',
        defaultColor: 'black',
        defaultLength: 0.5,
        defaultTexture: HairTexture.CURLY,
        baseStrandCount: 1000,
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.MEDIUM,
        safetyRating: SafetyRating.SAFE
      }
    ];

    hairStyles.forEach(style => this.hairStyles.set(style.id, style));
  }
}

/**
 * Clothing and accessory system with layering support
 * Manages clothing items with proper layering order and compatibility
 */
export class ClothingAccessorySystem extends EventEmitter {
  private clothingItems: Map<string, ClothingItem> = new Map();
  private accessories: Map<string, AccessoryItem> = new Map();
  private layerOrder: ClothingLayer[] = ['underwear', 'base', 'mid', 'outer', 'accessories'];

  constructor() {
    super();
    this.initializeClothingItems();
    this.initializeAccessories();
  }

  /**
   * Creates clothing configuration with proper layering
   * @param selections - Selected clothing items by category
   * @returns Complete clothing configuration
   */
  createClothingConfiguration(selections: ClothingSelections): ExtendedClothingConfiguration {
    const topItem = this.clothingItems.get(selections.topId);
    const bottomItem = this.clothingItems.get(selections.bottomId);
    const shoesItem = this.clothingItems.get(selections.shoesId);

    if (!topItem || !bottomItem || !shoesItem) {
      throw new Error('Invalid clothing item selection');
    }

    // Validate clothing compatibility
    this.validateClothingCompatibility([topItem, bottomItem, shoesItem]);

    const config: ExtendedClothingConfiguration = {
      topId: selections.topId,
      bottomId: selections.bottomId,
      shoesId: selections.shoesId,
      colors: selections.colors || {
        primary: topItem.defaultColors.primary,
        secondary: topItem.defaultColors.secondary,
        accent: topItem.defaultColors.accent
      },
      wrinkleSimulation: selections.wrinkleSimulation !== false,
      detailLevel: selections.detailLevel || PerformanceLevel.MEDIUM,
      textureQuality: selections.textureQuality || 1.0,
      revealingLevel: Math.max(topItem.revealingLevel, bottomItem.revealingLevel)
    };

    this.emit('clothingConfigurationCreated', { selections, config });
    return config;
  }

  /**
   * Creates accessory configuration with layering and positioning
   * @param accessorySelections - Selected accessories with positions
   * @returns Array of accessory configurations
   */
  createAccessoryConfiguration(accessorySelections: AccessorySelection[]): ExtendedAccessoryConfiguration[] {
    const configurations: ExtendedAccessoryConfiguration[] = [];

    for (const selection of accessorySelections) {
      const accessory = this.accessories.get(selection.accessoryId);
      if (!accessory) {
        throw new Error(`Accessory not found: ${selection.accessoryId}`);
      }

      const config: ExtendedAccessoryConfiguration = {
        id: accessory.id,
        type: accessory.type,
        position: selection.position || accessory.defaultPosition,
        scale: selection.scale || 1.0,
        detailLevel: selection.detailLevel || PerformanceLevel.MEDIUM
      };

      configurations.push(config);
    }

    // Validate accessory compatibility and layering
    this.validateAccessoryCompatibility(configurations);

    this.emit('accessoryConfigurationCreated', { configurations });
    return configurations;
  }

  /**
   * Gets available clothing items filtered by age and category
   * @param category - Clothing category
   * @param userAge - User's age for filtering
   * @returns Array of appropriate clothing items
   */
  getAvailableClothing(category: ClothingCategory, userAge: number): ClothingItem[] {
    return Array.from(this.clothingItems.values()).filter(item =>
      item.category === category &&
      this.isAgeAppropriate(item, userAge)
    );
  }

  /**
   * Gets available accessories filtered by type and age
   * @param type - Accessory type
   * @param userAge - User's age for filtering
   * @returns Array of appropriate accessories
   */
  getAvailableAccessories(type: AccessoryType, userAge: number): AccessoryItem[] {
    return Array.from(this.accessories.values()).filter(accessory =>
      accessory.type === type &&
      this.isAgeAppropriate(accessory, userAge)
    );
  }

  /**
   * Adds color and texture customization to clothing
   * @param config - Base clothing configuration
   * @param colorCustomizations - Color customization options
   * @returns Updated clothing configuration
   */
  applyColorCustomization(config: ExtendedClothingConfiguration, colorCustomizations: ColorCustomizations): ExtendedClothingConfiguration {
    return {
      ...config,
      colors: {
        primary: colorCustomizations.primary || config.colors.primary,
        secondary: colorCustomizations.secondary || config.colors.secondary,
        accent: colorCustomizations.accent || config.colors.accent
      }
    };
  }

  private validateClothingCompatibility(items: ClothingItem[]): void {
    // Check for conflicting clothing layers
    const layers = items.map(item => item.layer);
    const uniqueLayers = new Set(layers);
    
    if (layers.length !== uniqueLayers.size) {
      throw new Error('Conflicting clothing layers detected');
    }

    // Check for style compatibility
    const styles = items.map(item => item.style);
    const incompatibleStyles = this.findIncompatibleStyles(styles);
    
    if (incompatibleStyles.length > 0) {
      throw new Error(`Incompatible clothing styles: ${incompatibleStyles.join(', ')}`);
    }
  }

  private validateAccessoryCompatibility(accessories: ExtendedAccessoryConfiguration[]): void {
    // Check for conflicting accessory positions
    const positions = accessories.map(acc => `${acc.type}_${acc.position.x}_${acc.position.y}_${acc.position.z}`);
    const uniquePositions = new Set(positions);
    
    if (positions.length !== uniquePositions.size) {
      throw new Error('Conflicting accessory positions detected');
    }

    // Limit total number of accessories for performance
    if (accessories.length > 5) {
      throw new Error('Too many accessories selected (maximum 5)');
    }
  }

  private findIncompatibleStyles(styles: string[]): string[] {
    const incompatiblePairs = [
      ['formal', 'casual'],
      ['sporty', 'elegant']
    ];

    const conflicts: string[] = [];
    for (const pair of incompatiblePairs) {
      if (styles.includes(pair[0]) && styles.includes(pair[1])) {
        conflicts.push(`${pair[0]} + ${pair[1]}`);
      }
    }

    return conflicts;
  }

  private isAgeAppropriate(item: ClothingItem | AccessoryItem, userAge: number): boolean {
    return userAge >= item.minAge && userAge <= item.maxAge;
  }

  private initializeClothingItems(): void {
    const clothingItems: ClothingItem[] = [
      {
        id: 'casual_tshirt',
        name: 'Casual T-Shirt',
        category: 'top',
        layer: 'base',
        style: 'casual',
        defaultColors: { primary: 'blue', secondary: 'white', accent: 'red' },
        revealingLevel: 1,
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'jeans',
        name: 'Blue Jeans',
        category: 'bottom',
        layer: 'mid', // Different layer to avoid conflicts
        style: 'casual',
        defaultColors: { primary: 'blue', secondary: 'navy', accent: 'white' },
        revealingLevel: 1,
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'sneakers',
        name: 'Sneakers',
        category: 'shoes',
        layer: 'accessories',
        style: 'casual',
        defaultColors: { primary: 'white', secondary: 'black', accent: 'red' },
        revealingLevel: 1,
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      }
    ];

    clothingItems.forEach(item => this.clothingItems.set(item.id, item));
  }

  private initializeAccessories(): void {
    const accessories: AccessoryItem[] = [
      {
        id: 'baseball_cap',
        name: 'Baseball Cap',
        type: AccessoryType.HAT,
        defaultPosition: { x: 0, y: 1.2, z: 0 },
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'glasses',
        name: 'Glasses',
        type: AccessoryType.GLASSES,
        defaultPosition: { x: 0, y: 0.9, z: 0.1 },
        minAge: 5,
        maxAge: 99,
        performanceImpact: PerformanceLevel.LOW,
        safetyRating: SafetyRating.SAFE
      },
      {
        id: 'backpack',
        name: 'School Backpack',
        type: AccessoryType.BACKPACK,
        defaultPosition: { x: 0, y: 0.5, z: -0.3 },
        minAge: 5,
        maxAge: 18,
        performanceImpact: PerformanceLevel.MEDIUM,
        safetyRating: SafetyRating.SAFE
      }
    ];

    accessories.forEach(accessory => this.accessories.set(accessory.id, accessory));
  }
}

// Supporting interfaces and types

interface FaceVariant {
  id: string;
  name: string;
  meshId: string;
  textureId: string;
  defaultEyeColor: string;
  defaultSkinTone: string;
  minAge: number;
  maxAge: number;
  safetyRating: SafetyRating;
  performanceImpact: PerformanceLevel;
}

interface FaceAsset {
  id: string;
  name: string;
  variants: FaceVariant[];
}

interface FaceCustomizations {
  eyeColor?: string;
  skinTone?: string;
  eyeSize?: number;
  noseSize?: number;
  mouthSize?: number;
  cheekbones?: number;
  detailLevel?: PerformanceLevel;
  textureQuality?: number;
  matureFeatures?: boolean;
}

interface HairStyle {
  id: string;
  name: string;
  defaultColor: string;
  defaultLength: number;
  defaultTexture: HairTexture;
  baseStrandCount: number;
  minAge: number;
  maxAge: number;
  performanceImpact: PerformanceLevel;
  safetyRating: SafetyRating;
}

interface HairCustomizations {
  color?: string;
  length?: number;
  texture?: HairTexture;
  physicsEnabled?: boolean;
  quality?: PerformanceLevel;
  detailLevel?: PerformanceLevel;
}

interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  layer: ClothingLayer;
  style: string;
  defaultColors: { primary: string; secondary: string; accent: string };
  revealingLevel: number;
  minAge: number;
  maxAge: number;
  performanceImpact: PerformanceLevel;
  safetyRating: SafetyRating;
}

interface AccessoryItem {
  id: string;
  name: string;
  type: AccessoryType;
  defaultPosition: Vector3;
  minAge: number;
  maxAge: number;
  performanceImpact: PerformanceLevel;
  safetyRating: SafetyRating;
}

interface ClothingSelections {
  topId: string;
  bottomId: string;
  shoesId: string;
  colors?: { primary: string; secondary: string; accent: string };
  wrinkleSimulation?: boolean;
  detailLevel?: PerformanceLevel;
  textureQuality?: number;
}

interface AccessorySelection {
  accessoryId: string;
  position?: Vector3;
  scale?: number;
  detailLevel?: PerformanceLevel;
}

interface ColorCustomizations {
  primary?: string;
  secondary?: string;
  accent?: string;
}

interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

type ClothingCategory = 'top' | 'bottom' | 'shoes' | 'outerwear';
type ClothingLayer = 'underwear' | 'base' | 'mid' | 'outer' | 'accessories';

export type {
  FaceVariant,
  HairStyle,
  ClothingItem,
  AccessoryItem,
  FaceCustomizations,
  HairCustomizations,
  ClothingSelections,
  AccessorySelection,
  ColorCustomizations,
  ValidationResult
};