import { AppearanceManager } from './appearance-manager';
import { FaceCustomizationSystem, HairStyleSystem, ClothingAccessorySystem } from './asset-categories';
import { AvatarSafetyValidator } from './safety-validator';
import { Avatar3DRenderer } from '../rendering/renderer';
import { AssetManager } from '../rendering/asset-manager';
import {
  AppearanceConfiguration,
  AppearanceChange,
  AssetCategory,
  PerformanceLevel,
  SafetyRating,
  ExtendedFaceConfiguration,
  ExtendedHairConfiguration,
  ExtendedClothingConfiguration,
  ExtendedAccessoryConfiguration,
  ExtendedAnimationSet,
  AccessoryType,
  HairTexture
} from './types';
import { RenderFrame, RenderingMetrics } from '../rendering/types';

// Mock dependencies
jest.mock('./safety-validator');
jest.mock('../rendering/renderer');
jest.mock('../rendering/asset-manager');

describe('Appearance System Integration Tests', () => {
  let appearanceManager: AppearanceManager;
  let faceSystem: FaceCustomizationSystem;
  let hairSystem: HairStyleSystem;
  let clothingSystem: ClothingAccessorySystem;
  let mockRenderer: jest.Mocked<Avatar3DRenderer>;
  let mockAssetManager: jest.Mocked<AssetManager>;
  let mockSafetyValidator: jest.Mocked<AvatarSafetyValidator>;

  const createMockRenderingMetrics = (fps = 60, gpuMemory = 1.0, cpu = 30): RenderingMetrics => ({
    currentFPS: fps,
    gpuMemoryUsage: gpuMemory,
    cpuUsage: cpu,
    renderTime: 1000 / fps,
    triangleCount: 10000,
    textureMemory: 0.5,
    shaderCompileTime: 2,
    drawCalls: 100
  });

  const createMockRenderFrame = (success = true): RenderFrame => ({
    frameId: 'frame_001',
    timestamp: Date.now(),
    renderTime: 16,
    triangleCount: 10000,
    textureMemory: 0.5,
    success
  });

  const createMockAppearanceConfig = (): AppearanceConfiguration => ({
    face: {
      meshId: 'face_001',
      textureId: 'texture_001',
      eyeColor: 'blue',
      skinTone: 'light',
      features: {
        eyeSize: 1.0,
        noseSize: 1.0,
        mouthSize: 1.0,
        cheekbones: 1.0
      },
      detailLevel: PerformanceLevel.HIGH,
      textureQuality: 1.0,
      matureFeatures: false
    } as ExtendedFaceConfiguration,
    hair: {
      styleId: 'hair_001',
      color: 'brown',
      length: 0.5,
      texture: HairTexture.STRAIGHT,
      physicsEnabled: true,
      strandCount: 2000,
      detailLevel: PerformanceLevel.HIGH
    } as ExtendedHairConfiguration,
    clothing: {
      topId: 'shirt_001',
      bottomId: 'pants_001',
      shoesId: 'shoes_001',
      colors: {
        primary: 'blue',
        secondary: 'white',
        accent: 'red'
      },
      wrinkleSimulation: true,
      detailLevel: PerformanceLevel.HIGH,
      textureQuality: 1.0,
      revealingLevel: 1
    } as ExtendedClothingConfiguration,
    accessories: [{
      id: 'hat_001',
      type: AccessoryType.HAT,
      position: { x: 0, y: 1, z: 0 },
      scale: 1.0,
      detailLevel: PerformanceLevel.HIGH
    }] as ExtendedAccessoryConfiguration[],
    animations: {
      idle: 'idle_001',
      talking: 'talk_001',
      listening: 'listen_001',
      thinking: 'think_001',
      expressions: {
        happy: 'happy_001',
        sad: 'sad_001',
        surprised: 'surprised_001',
        confused: 'confused_001',
        excited: 'excited_001'
      },
      frameRate: 60,
      blendingEnabled: true
    } as ExtendedAnimationSet
  });

  beforeEach(() => {
    // Create mocked instances
    mockRenderer = {
      renderAvatar: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      updateAnimation: jest.fn(),
      setEmotionalExpression: jest.fn(),
      optimizeRenderQuality: jest.fn(),
      preloadAssets: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn()
    } as any;

    mockAssetManager = {
      preloadAssets: jest.fn(),
      loadAsset: jest.fn(),
      unloadAsset: jest.fn(),
      getCacheStatus: jest.fn(),
      getAssetsByCategory: jest.fn()
    } as any;

    mockSafetyValidator = {
      validateAppearanceConfiguration: jest.fn(),
      validateCustomization: jest.fn(),
      requiresParentalApproval: jest.fn(),
      submitForParentalReview: jest.fn(),
      processParentalDecision: jest.fn(),
      getAuditLog: jest.fn()
    } as any;

    // Initialize systems
    appearanceManager = new AppearanceManager(mockRenderer, mockAssetManager, mockSafetyValidator);
    faceSystem = new FaceCustomizationSystem();
    hairSystem = new HairStyleSystem();
    clothingSystem = new ClothingAccessorySystem();

    // Setup default mock responses
    mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());
    mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());
    mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
      isAllowed: true,
      violations: [],
      riskLevel: 'low',
      reason: 'Content approved',
      requiresParentalApproval: false
    });
  });

  describe('Real-time Preview Functionality', () => {
    it('should start and stop preview mode correctly', async () => {
      const config = createMockAppearanceConfig();

      // Start preview
      await appearanceManager.previewAppearance(config);
      expect(appearanceManager.isPreviewActive()).toBe(true);

      // Stop preview
      await appearanceManager.stopPreview();
      expect(appearanceManager.isPreviewActive()).toBe(false);
    });

    it('should render preview with optimized settings for performance', async () => {
      const config = createMockAppearanceConfig();
      
      // Simulate poor performance
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      await appearanceManager.previewAppearance(config);

      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(
        expect.objectContaining({
          appearance: expect.objectContaining({
            hair: expect.objectContaining({
              physicsEnabled: false, // Should be disabled for performance
              strandCount: expect.any(Number)
            }),
            clothing: expect.objectContaining({
              wrinkleSimulation: false // Should be disabled for performance
            })
          })
        })
      );
    });

    it('should emit preview events correctly', async () => {
      const config = createMockAppearanceConfig();
      const previewStartedSpy = jest.fn();
      const previewStoppedSpy = jest.fn();

      appearanceManager.on('previewStarted', previewStartedSpy);
      appearanceManager.on('previewStopped', previewStoppedSpy);

      await appearanceManager.previewAppearance(config);
      expect(previewStartedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ configuration: expect.any(Object) })
      );

      await appearanceManager.stopPreview();
      expect(previewStoppedSpy).toHaveBeenCalled();
    });

    it('should handle preview errors gracefully', async () => {
      const config = createMockAppearanceConfig();
      const errorSpy = jest.fn();

      appearanceManager.on('previewError', errorSpy);

      // Mock safety validation failure
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: false,
        violations: ['Inappropriate content'],
        riskLevel: 'high',
        reason: 'Content blocked',
        requiresParentalApproval: true
      });

      await expect(appearanceManager.previewAppearance(config))
        .rejects.toThrow('Preview blocked: Content blocked');

      expect(errorSpy).toHaveBeenCalled();
      expect(appearanceManager.isPreviewActive()).toBe(false);
    });

    it('should maintain 60fps during real-time preview updates', async () => {
      const config = createMockAppearanceConfig();
      const performanceMetrics = createMockRenderingMetrics(60, 1.0, 25);
      
      mockRenderer.getPerformanceMetrics.mockReturnValue(performanceMetrics);

      await appearanceManager.previewAppearance(config);

      // Verify that no performance optimization was triggered
      expect(appearanceManager.isPerformanceOptimized()).toBe(false);
      
      // Verify render was called with original configuration
      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(
        expect.objectContaining({
          appearance: expect.objectContaining({
            hair: expect.objectContaining({
              physicsEnabled: true // Should remain enabled with good performance
            })
          })
        })
      );
    });
  });

  describe('Age-Appropriate Content Filtering', () => {
    it('should filter face variants by age appropriateness', () => {
      // Test child age filtering
      const childVariants = faceSystem.getAvailableFaceVariants(8, SafetyRating.SAFE);
      expect(childVariants.length).toBeGreaterThan(0);
      
      childVariants.forEach(variant => {
        expect(variant.minAge).toBeLessThanOrEqual(8);
        expect(variant.maxAge).toBeGreaterThanOrEqual(8);
        expect(variant.safetyRating).toBe(SafetyRating.SAFE);
      });

      // Test teen age filtering
      const teenVariants = faceSystem.getAvailableFaceVariants(15, SafetyRating.SAFE);
      expect(teenVariants.length).toBeGreaterThan(0);
      
      teenVariants.forEach(variant => {
        expect(variant.minAge).toBeLessThanOrEqual(15);
        expect(variant.maxAge).toBeGreaterThanOrEqual(15);
      });
    });

    it('should reject mature features for young users', () => {
      const config = faceSystem.createFaceConfiguration('child_face_01', { 
        matureFeatures: true 
      });
      
      const validation = faceSystem.validateFaceCustomization(config, 10);
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Mature facial features not appropriate for age');
    });

    it('should filter hair styles by age and performance requirements', () => {
      const childHairStyles = hairSystem.getAvailableHairStyles(8, PerformanceLevel.HIGH);
      
      expect(childHairStyles.length).toBeGreaterThan(0);
      childHairStyles.forEach(style => {
        expect(style.minAge).toBeLessThanOrEqual(8);
        expect(style.maxAge).toBeGreaterThanOrEqual(8);
      });

      // Test performance filtering
      const lowPerfStyles = hairSystem.getAvailableHairStyles(15, PerformanceLevel.LOW);
      const highPerfStyles = hairSystem.getAvailableHairStyles(15, PerformanceLevel.HIGH);
      
      expect(lowPerfStyles.length).toBeLessThanOrEqual(highPerfStyles.length);
    });

    it('should filter clothing items by age appropriateness', () => {
      const childClothing = clothingSystem.getAvailableClothing('top', 8);
      
      expect(childClothing.length).toBeGreaterThan(0);
      childClothing.forEach(item => {
        expect(item.minAge).toBeLessThanOrEqual(8);
        expect(item.maxAge).toBeGreaterThanOrEqual(8);
        expect(item.revealingLevel).toBeLessThanOrEqual(2); // Age-appropriate revealing level
      });
    });

    it('should filter accessories by age and safety rating', () => {
      const childAccessories = clothingSystem.getAvailableAccessories(AccessoryType.HAT, 8);
      
      expect(childAccessories.length).toBeGreaterThan(0);
      childAccessories.forEach(accessory => {
        expect(accessory.minAge).toBeLessThanOrEqual(8);
        expect(accessory.maxAge).toBeGreaterThanOrEqual(8);
        expect(accessory.safetyRating).toBe(SafetyRating.SAFE);
      });
    });

    it('should validate complete appearance configuration for age appropriateness', async () => {
      const config = createMockAppearanceConfig();
      
      // Test with child age
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Age-appropriate content',
        requiresParentalApproval: false
      });

      const result = await appearanceManager.validateAppearanceContent(config);
      
      expect(result.isAllowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(mockSafetyValidator.validateAppearanceConfiguration).toHaveBeenCalledWith(config);
    });

    it('should block inappropriate content and provide clear feedback', async () => {
      const config = createMockAppearanceConfig();
      
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: false,
        violations: ['Inappropriate clothing for age', 'Mature facial features'],
        riskLevel: 'high',
        reason: 'Content not suitable for user age',
        requiresParentalApproval: true
      });

      const result = await appearanceManager.validateAppearanceContent(config);
      
      expect(result.isAllowed).toBe(false);
      expect(result.violations).toContain('Inappropriate clothing for age');
      expect(result.violations).toContain('Mature facial features');
      expect(result.requiresParentalApproval).toBe(true);
    });
  });

  describe('Asset Loading and Rendering Performance', () => {
    it('should preload assets efficiently without blocking UI', async () => {
      const assetIds = ['face_001', 'hair_001', 'shirt_001', 'pants_001'];
      
      await appearanceManager.preloadAssets(assetIds);
      
      expect(mockAssetManager.preloadAssets).toHaveBeenCalledWith(assetIds);
    });

    it('should optimize appearance for performance when FPS drops', async () => {
      const config = createMockAppearanceConfig();
      
      // Simulate poor performance (30 FPS, high GPU usage)
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      const optimizedConfig = appearanceManager.optimizeForPerformance(config);

      // Verify performance optimizations were applied
      expect(optimizedConfig.hair.physicsEnabled).toBe(false);
      expect(optimizedConfig.hair.strandCount).toBeLessThanOrEqual(1000);
      expect(optimizedConfig.clothing.wrinkleSimulation).toBe(false);
      expect(optimizedConfig.animations.frameRate).toBeLessThanOrEqual(30);
      expect(optimizedConfig.animations.blendingEnabled).toBe(false);
      expect(optimizedConfig.accessories.length).toBeLessThanOrEqual(3);
    });

    it('should maintain quality when performance is good', () => {
      const config = createMockAppearanceConfig();
      
      // Simulate good performance (60 FPS, low GPU usage)
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(60, 1.0, 25));

      const optimizedConfig = appearanceManager.optimizeForPerformance(config);

      // Verify no optimization was applied
      expect(optimizedConfig).toEqual(config);
      expect(appearanceManager.isPerformanceOptimized()).toBe(false);
    });

    it('should handle asset loading failures gracefully', async () => {
      const config = createMockAppearanceConfig();
      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: config,
        newConfiguration: config,
        timestamp: new Date(),
        userId: 'user_001'
      };

      // Mock rendering failure
      mockRenderer.renderAvatar.mockRejectedValue(new Error('Asset loading failed'));

      const errorSpy = jest.fn();
      appearanceManager.on('appearanceError', errorSpy);

      await expect(appearanceManager.updateAppearance(change))
        .rejects.toThrow('Asset loading failed');

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should emit performance optimization events', () => {
      const config = createMockAppearanceConfig();
      const performanceOptimizedSpy = jest.fn();
      
      appearanceManager.on('performanceOptimized', performanceOptimizedSpy);
      
      // Simulate poor performance
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      appearanceManager.optimizeForPerformance(config);

      expect(performanceOptimizedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          original: config,
          optimized: expect.any(Object),
          metrics: expect.any(Object)
        })
      );
    });

    it('should measure and report rendering performance metrics', async () => {
      const config = createMockAppearanceConfig();
      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: config,
        newConfiguration: config,
        timestamp: new Date(),
        userId: 'user_001'
      };

      const result = await appearanceManager.updateAppearance(change);

      expect(result.success).toBe(true);
      expect(result.renderTime).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(0);
      expect(result.textureMemory).toBeGreaterThan(0);
    });

    it('should handle memory constraints on Jetson Nano Orin', async () => {
      const config = createMockAppearanceConfig();
      
      // Simulate high memory usage approaching 2GB limit
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(45, 1.9, 60));

      const optimizedConfig = appearanceManager.optimizeForPerformance(config);

      // Verify aggressive optimization for memory constraints
      expect(optimizedConfig.face.detailLevel).toBe(PerformanceLevel.MEDIUM);
      expect(optimizedConfig.face.textureQuality).toBeLessThan(1.0);
      expect(optimizedConfig.hair.detailLevel).toBe(PerformanceLevel.MEDIUM);
      expect(optimizedConfig.clothing.detailLevel).toBe(PerformanceLevel.MEDIUM);
    });
  });

  describe('Appearance Change Validation and Processing', () => {
    it('should validate and apply safe appearance changes', async () => {
      const oldConfig = createMockAppearanceConfig();
      const newConfig = {
        ...oldConfig,
        face: { ...oldConfig.face, eyeColor: 'green' }
      };

      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: oldConfig,
        newConfiguration: newConfig,
        timestamp: new Date(),
        userId: 'user_001'
      };

      const result = await appearanceManager.updateAppearance(change);

      expect(result.success).toBe(true);
      expect(mockSafetyValidator.validateAppearanceConfiguration).toHaveBeenCalledWith(newConfig);
      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(
        expect.objectContaining({ appearance: newConfig })
      );
    });

    it('should reject unsafe appearance changes', async () => {
      const oldConfig = createMockAppearanceConfig();
      const newConfig = createMockAppearanceConfig();

      const change: AppearanceChange = {
        changeId: 'change_002',
        type: 'clothing',
        oldConfiguration: oldConfig,
        newConfiguration: newConfig,
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: false,
        violations: ['Inappropriate clothing'],
        riskLevel: 'high',
        reason: 'Content blocked for safety',
        requiresParentalApproval: true
      });

      await expect(appearanceManager.updateAppearance(change))
        .rejects.toThrow('Appearance change blocked: Content blocked for safety');
    });

    it('should emit appearance change events with complete information', async () => {
      const config = createMockAppearanceConfig();
      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'hair',
        oldConfiguration: config,
        newConfiguration: config,
        timestamp: new Date(),
        userId: 'user_001'
      };

      const appearanceChangedSpy = jest.fn();
      appearanceManager.on('appearanceChanged', appearanceChangedSpy);

      await appearanceManager.updateAppearance(change);

      expect(appearanceChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          change,
          renderResult: expect.objectContaining({
            success: true,
            renderTime: expect.any(Number),
            triangleCount: expect.any(Number)
          }),
          safetyResult: expect.objectContaining({
            isAllowed: true,
            reason: 'Content approved'
          })
        })
      );
    });

    it('should maintain appearance configuration state correctly', async () => {
      const config = createMockAppearanceConfig();
      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: config,
        newConfiguration: config,
        timestamp: new Date(),
        userId: 'user_001'
      };

      expect(appearanceManager.getCurrentConfiguration()).toBeNull();

      await appearanceManager.updateAppearance(change);

      expect(appearanceManager.getCurrentConfiguration()).toEqual(config);
    });
  });

  describe('Integration with Asset Categories', () => {
    it('should integrate face customization system correctly', () => {
      const customizations = {
        eyeColor: 'blue',
        skinTone: 'medium',
        eyeSize: 1.2,
        noseSize: 0.9
      };

      const config = faceSystem.createFaceConfiguration('child_face_01', customizations);

      expect(config.eyeColor).toBe('blue');
      expect(config.skinTone).toBe('medium');
      expect(config.features.eyeSize).toBe(1.2);
      expect(config.features.noseSize).toBe(0.9);
      expect(config.matureFeatures).toBe(false);
    });

    it('should integrate hair style system with physics optimization', () => {
      const customizations = {
        color: 'red',
        length: 0.8,
        texture: HairTexture.CURLY,
        quality: PerformanceLevel.HIGH
      };

      const config = hairSystem.createHairConfiguration('long_wavy', customizations);

      expect(config.color).toBe('red');
      expect(config.length).toBe(0.8);
      expect(config.texture).toBe(HairTexture.CURLY);
      
      // Physics should be disabled for high strand counts
      if (config.strandCount > 1500) {
        expect(config.physicsEnabled).toBe(false);
      }
    });

    it('should integrate clothing and accessory system with layering', () => {
      const clothingSelections = {
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers',
        colors: { primary: 'red', secondary: 'blue', accent: 'white' }
      };

      const clothingConfig = clothingSystem.createClothingConfiguration(clothingSelections);

      expect(clothingConfig.topId).toBe('casual_tshirt');
      expect(clothingConfig.colors.primary).toBe('red');

      const accessorySelections = [
        { accessoryId: 'baseball_cap' },
        { accessoryId: 'glasses' }
      ];

      const accessoryConfigs = clothingSystem.createAccessoryConfiguration(accessorySelections);

      expect(accessoryConfigs).toHaveLength(2);
      expect(accessoryConfigs[0].type).toBe(AccessoryType.HAT);
      expect(accessoryConfigs[1].type).toBe(AccessoryType.GLASSES);
    });

    it('should handle asset category filtering correctly', async () => {
      const category: AssetCategory = {
        name: 'hair',
        type: 'hair',
        ageRestrictions: []
      };

      const mockAssets = [
        {
          id: 'hair_child_01',
          name: 'Child Hair',
          category,
          ageRestriction: { min: 5, max: 12 },
          performanceImpact: PerformanceLevel.LOW,
          safetyRating: SafetyRating.SAFE
        },
        {
          id: 'hair_teen_01',
          name: 'Teen Hair',
          category,
          ageRestriction: { min: 13, max: 17 },
          performanceImpact: PerformanceLevel.MEDIUM,
          safetyRating: SafetyRating.SAFE
        }
      ];

      mockAssetManager.getAssetsByCategory.mockResolvedValue(mockAssets);

      const result = await appearanceManager.getAvailableAssets(category, 10);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe('hair_child_01');
      expect(result.filteredByAge).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rendering errors gracefully', async () => {
      const config = createMockAppearanceConfig();
      const change: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: config,
        newConfiguration: config,
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockRenderer.renderAvatar.mockRejectedValue(new Error('Rendering failed'));

      const errorSpy = jest.fn();
      appearanceManager.on('appearanceError', errorSpy);

      await expect(appearanceManager.updateAppearance(change))
        .rejects.toThrow('Rendering failed');

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle invalid asset IDs in customization systems', () => {
      expect(() => {
        faceSystem.createFaceConfiguration('invalid_face', {});
      }).toThrow('Face variant not found: invalid_face');

      expect(() => {
        hairSystem.createHairConfiguration('invalid_hair', {});
      }).toThrow('Hair style not found: invalid_hair');

      expect(() => {
        clothingSystem.createClothingConfiguration({
          topId: 'invalid_top',
          bottomId: 'jeans',
          shoesId: 'sneakers'
        });
      }).toThrow('Invalid clothing item selection');
    });

    it('should handle extreme performance conditions', () => {
      const config = createMockAppearanceConfig();
      
      // Simulate extremely poor performance
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(15, 1.95, 90));

      const optimizedConfig = appearanceManager.optimizeForPerformance(config);

      // Verify aggressive optimization
      expect(optimizedConfig.hair.physicsEnabled).toBe(false);
      expect(optimizedConfig.hair.strandCount).toBeLessThanOrEqual(1000);
      expect(optimizedConfig.clothing.wrinkleSimulation).toBe(false);
      expect(optimizedConfig.animations.blendingEnabled).toBe(false);
      expect(optimizedConfig.accessories.length).toBeLessThanOrEqual(3);
    });

    it('should validate feature value ranges in face customization', () => {
      const customizations = {
        eyeSize: 10.0, // Too large
        noseSize: -1.0, // Too small
        mouthSize: 1.5 // Valid
      };

      const config = faceSystem.createFaceConfiguration('child_face_01', customizations);

      expect(config.features.eyeSize).toBe(2.0); // Clamped to max
      expect(config.features.noseSize).toBe(0.5); // Clamped to min
      expect(config.features.mouthSize).toBe(1.5); // Unchanged
    });

    it('should handle accessory position conflicts', () => {
      const selections = [
        { accessoryId: 'baseball_cap', position: { x: 0, y: 1, z: 0 } },
        { accessoryId: 'baseball_cap', position: { x: 0, y: 1, z: 0 } } // Same type and position
      ];

      expect(() => {
        clothingSystem.createAccessoryConfiguration(selections);
      }).toThrow('Conflicting accessory positions detected');
    });

    it('should limit accessory count for performance', () => {
      const selections = Array(6).fill(0).map((_, i) => ({
        accessoryId: 'baseball_cap',
        position: { x: i, y: 0, z: 0 } // Different positions
      }));

      expect(() => {
        clothingSystem.createAccessoryConfiguration(selections);
      }).toThrow('Too many accessories selected (maximum 5)');
    });
  });
});