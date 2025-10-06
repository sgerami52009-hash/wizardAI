import { EventEmitter } from 'events';
import { AvatarSafetyValidator } from './safety-validator';
import { Avatar3DRenderer } from '../rendering/renderer';
import { AssetManager } from '../rendering/asset-manager';
import { 
  AppearanceConfiguration, 
  AppearanceChange, 
  AssetCategory, 
  AssetCollection,
  RenderResult,
  SafetyResult,
  ExtendedFaceConfiguration,
  ExtendedHairConfiguration,
  ExtendedClothingConfiguration,
  ExtendedAccessoryConfiguration,
  ExtendedAnimationSet,
  PerformanceLevel
} from './types';

/**
 * Manages visual avatar customization with real-time preview and safety validation
 * Ensures child-appropriate content and optimal performance on Jetson Nano Orin
 */
export class AppearanceManager extends EventEmitter {
  private renderer: Avatar3DRenderer;
  private assetManager: AssetManager;
  private safetyValidator: AvatarSafetyValidator;
  private currentConfiguration: AppearanceConfiguration | null = null;
  private previewActive = false;
  private performanceOptimized = false;

  constructor(
    renderer: Avatar3DRenderer,
    assetManager: AssetManager,
    safetyValidator: AvatarSafetyValidator
  ) {
    super();
    this.renderer = renderer;
    this.assetManager = assetManager;
    this.safetyValidator = safetyValidator;
  }

  /**
   * Updates avatar appearance with real-time validation and rendering
   * @param change - The appearance change to apply
   * @returns Promise resolving to render result with performance metrics
   */
  async updateAppearance(change: AppearanceChange): Promise<RenderResult> {
    try {
      // Validate the appearance change for child safety
      const safetyResult = await this.validateAppearanceContent(change.newConfiguration);
      if (!safetyResult.isAllowed) {
        throw new Error(`Appearance change blocked: ${safetyResult.reason}`);
      }

      // Apply performance optimization if needed
      const optimizedConfig = this.optimizeForPerformance(change.newConfiguration);
      
      // Update current configuration
      this.currentConfiguration = optimizedConfig;
      
      // Render the updated appearance
      const renderResult = await this.renderAppearanceConfiguration(optimizedConfig);
      
      // Emit appearance change event
      this.emit('appearanceChanged', {
        change,
        renderResult,
        safetyResult
      });

      return renderResult;
    } catch (error) {
      this.emit('appearanceError', error);
      throw error;
    }
  }

  /**
   * Activates real-time preview mode for appearance changes
   * @param configuration - The appearance configuration to preview
   */
  async previewAppearance(configuration: AppearanceConfiguration): Promise<void> {
    try {
      // Validate preview configuration
      const safetyResult = await this.validateAppearanceContent(configuration);
      if (!safetyResult.isAllowed) {
        throw new Error(`Preview blocked: ${safetyResult.reason}`);
      }

      this.previewActive = true;
      
      // Optimize for preview performance
      const optimizedConfig = this.optimizeForPerformance(configuration);
      
      // Render preview
      await this.renderAppearanceConfiguration(optimizedConfig);
      
      this.emit('previewStarted', { configuration: optimizedConfig });
    } catch (error) {
      this.previewActive = false;
      this.emit('previewError', error);
      throw error;
    }
  }

  /**
   * Stops preview mode and returns to current configuration
   */
  async stopPreview(): Promise<void> {
    if (!this.previewActive) return;

    this.previewActive = false;
    
    if (this.currentConfiguration) {
      await this.renderAppearanceConfiguration(this.currentConfiguration);
    }
    
    this.emit('previewStopped');
  }

  /**
   * Validates appearance configuration for child safety and age appropriateness
   * @param configuration - The appearance configuration to validate
   * @returns Promise resolving to safety validation result
   */
  async validateAppearanceContent(configuration: AppearanceConfiguration): Promise<SafetyResult> {
    return await this.safetyValidator.validateAppearanceConfiguration(configuration);
  }

  /**
   * Gets available assets for a category filtered by user age
   * @param category - The asset category to retrieve
   * @param userAge - The user's age for filtering
   * @returns Promise resolving to filtered asset collection
   */
  async getAvailableAssets(category: AssetCategory, userAge: number): Promise<AssetCollection> {
    const allAssets = await this.assetManager.getAssetsByCategory(category);
    
    // Filter assets by age appropriateness
    const ageAppropriateAssets = allAssets.filter(asset => 
      this.isAgeAppropriate(asset.ageRestriction, userAge)
    );

    return {
      category,
      assets: ageAppropriateAssets,
      totalCount: ageAppropriateAssets.length,
      filteredByAge: allAssets.length - ageAppropriateAssets.length
    };
  }

  /**
   * Optimizes appearance configuration for performance constraints
   * @param configuration - The appearance configuration to optimize
   * @returns Optimized appearance configuration
   */
  optimizeForPerformance(configuration: AppearanceConfiguration): AppearanceConfiguration {
    const currentMetrics = this.renderer.getPerformanceMetrics();
    
    // If performance is good, return original configuration
    if (currentMetrics.currentFPS >= 45 && currentMetrics.gpuMemoryUsage < 1.5) {
      this.performanceOptimized = false;
      return configuration;
    }

    this.performanceOptimized = true;
    
    // Create optimized copy
    const optimized: AppearanceConfiguration = {
      ...configuration,
      face: this.optimizeFaceConfiguration(configuration.face),
      hair: this.optimizeHairConfiguration(configuration.hair),
      clothing: this.optimizeClothingConfiguration(configuration.clothing),
      accessories: this.optimizeAccessories(configuration.accessories),
      animations: this.optimizeAnimations(configuration.animations)
    };

    this.emit('performanceOptimized', {
      original: configuration,
      optimized,
      metrics: currentMetrics
    });

    return optimized;
  }

  /**
   * Gets the current appearance configuration
   */
  getCurrentConfiguration(): AppearanceConfiguration | null {
    return this.currentConfiguration;
  }

  /**
   * Checks if preview mode is currently active
   */
  isPreviewActive(): boolean {
    return this.previewActive;
  }

  /**
   * Checks if performance optimization is currently active
   */
  isPerformanceOptimized(): boolean {
    return this.performanceOptimized;
  }

  /**
   * Preloads assets for faster appearance changes
   * @param assetIds - Array of asset IDs to preload
   */
  async preloadAssets(assetIds: string[]): Promise<void> {
    await this.assetManager.preloadAssets(assetIds);
  }

  // Private helper methods

  private isAgeAppropriate(ageRestriction: { min: number; max: number }, userAge: number): boolean {
    return userAge >= ageRestriction.min && userAge <= ageRestriction.max;
  }

  private optimizeFaceConfiguration(face: ExtendedFaceConfiguration): ExtendedFaceConfiguration {
    return {
      ...face,
      detailLevel: this.reduceDetailLevel(face.detailLevel),
      textureQuality: this.reduceTextureQuality(face.textureQuality)
    };
  }

  private optimizeHairConfiguration(hair: ExtendedHairConfiguration): ExtendedHairConfiguration {
    return {
      ...hair,
      physicsEnabled: false, // Disable physics for performance
      strandCount: Math.min(hair.strandCount, 1000), // Reduce strand count
      detailLevel: this.reduceDetailLevel(hair.detailLevel)
    };
  }

  private optimizeClothingConfiguration(clothing: ExtendedClothingConfiguration): ExtendedClothingConfiguration {
    return {
      ...clothing,
      wrinkleSimulation: false, // Disable cloth simulation
      detailLevel: this.reduceDetailLevel(clothing.detailLevel),
      textureQuality: this.reduceTextureQuality(clothing.textureQuality)
    };
  }

  private optimizeAccessories(accessories: ExtendedAccessoryConfiguration[]): ExtendedAccessoryConfiguration[] {
    // Limit number of accessories for performance
    return accessories.slice(0, 3).map(accessory => ({
      ...accessory,
      detailLevel: this.reduceDetailLevel(accessory.detailLevel)
    }));
  }

  private optimizeAnimations(animations: ExtendedAnimationSet): ExtendedAnimationSet {
    return {
      ...animations,
      frameRate: Math.min(animations.frameRate, 30), // Reduce animation frame rate
      blendingEnabled: false // Disable complex blending
    };
  }

  private reduceDetailLevel(level: PerformanceLevel): PerformanceLevel {
    switch (level) {
      case PerformanceLevel.HIGH: return PerformanceLevel.MEDIUM;
      case PerformanceLevel.MEDIUM: return PerformanceLevel.LOW;
      case PerformanceLevel.LOW: return PerformanceLevel.LOW;
      default: return PerformanceLevel.LOW;
    }
  }

  private reduceTextureQuality(quality: number): number {
    return Math.max(0.5, quality * 0.7); // Reduce by 30%, minimum 50%
  }

  /**
   * Renders an appearance configuration by wrapping it in a minimal avatar configuration
   * @param appearanceConfig - The appearance configuration to render
   * @returns Promise resolving to render result
   */
  private async renderAppearanceConfiguration(appearanceConfig: AppearanceConfiguration): Promise<RenderResult> {
    // Create a minimal avatar configuration for rendering
    const avatarConfig = {
      userId: 'preview',
      version: '1.0.0',
      appearance: appearanceConfig,
      personality: {
        friendliness: 5,
        formality: 5,
        humor: 5,
        enthusiasm: 5,
        patience: 5,
        supportiveness: 5
      },
      voice: {
        pitch: 0,
        speed: 1,
        accent: 'neutral' as any,
        emotionalTone: 'cheerful' as any,
        volume: 0.8
      },
      emotions: {
        defaultEmotion: 'neutral' as any,
        expressionIntensity: 1.0,
        transitionSpeed: 1.0,
        emotionMappings: []
      },
      createdAt: new Date(),
      lastModified: new Date(),
      parentallyApproved: true
    };

    const renderFrame = await this.renderer.renderAvatar(avatarConfig);
    
    // Convert RenderFrame to RenderResult
    return {
      success: renderFrame.success,
      renderTime: renderFrame.renderTime,
      triangleCount: renderFrame.triangleCount,
      textureMemory: renderFrame.textureMemory
    };
  }
}