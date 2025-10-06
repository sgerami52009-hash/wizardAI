import { AppearanceManager } from './appearance-manager';
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

describe('AppearanceManager', () => {
  let appearanceManager: AppearanceManager;
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

  const mockAppearanceConfig: AppearanceConfiguration = {
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
  };

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

    appearanceManager = new AppearanceManager(
      mockRenderer,
      mockAssetManager,
      mockSafetyValidator
    );
  });

  describe('updateAppearance', () => {
    it('should successfully update appearance when content is safe', async () => {
      // Arrange
      const appearanceChange: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: mockAppearanceConfig,
        newConfiguration: { ...mockAppearanceConfig, face: { ...mockAppearanceConfig.face, eyeColor: 'green' } },
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Content approved',
        requiresParentalApproval: false
      });

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());
      mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());

      // Act
      const result = await appearanceManager.updateAppearance(appearanceChange);

      // Assert
      expect(mockSafetyValidator.validateAppearanceConfiguration).toHaveBeenCalledWith(
        appearanceChange.newConfiguration
      );
      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(expect.objectContaining({
        appearance: appearanceChange.newConfiguration
      }));
      expect(result.success).toBe(true);
    });

    it('should reject appearance update when content is unsafe', async () => {
      // Arrange
      const appearanceChange: AppearanceChange = {
        changeId: 'change_002',
        type: 'clothing',
        oldConfiguration: mockAppearanceConfig,
        newConfiguration: mockAppearanceConfig,
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: false,
        violations: ['Inappropriate clothing for age'],
        riskLevel: 'high',
        reason: 'Content blocked',
        requiresParentalApproval: true
      });

      // Act & Assert
      await expect(appearanceManager.updateAppearance(appearanceChange))
        .rejects.toThrow('Appearance change blocked: Content blocked');
    });

    it('should optimize appearance for performance when needed', async () => {
      // Arrange
      const appearanceChange: AppearanceChange = {
        changeId: 'change_003',
        type: 'hair',
        oldConfiguration: mockAppearanceConfig,
        newConfiguration: mockAppearanceConfig,
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Content approved',
        requiresParentalApproval: false
      });

      // Simulate poor performance
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));
      mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());

      // Act
      const result = await appearanceManager.updateAppearance(appearanceChange);

      // Assert
      expect(result.success).toBe(true);
      expect(appearanceManager.isPerformanceOptimized()).toBe(true);
    });
  });

  describe('previewAppearance', () => {
    it('should start preview mode with safe content', async () => {
      // Arrange
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Content approved',
        requiresParentalApproval: false
      });

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());
      mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());

      // Act
      await appearanceManager.previewAppearance(mockAppearanceConfig);

      // Assert
      expect(appearanceManager.isPreviewActive()).toBe(true);
      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(expect.objectContaining({
        appearance: mockAppearanceConfig
      }));
    });

    it('should reject preview with unsafe content', async () => {
      // Arrange
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: false,
        violations: ['Inappropriate content'],
        riskLevel: 'high',
        reason: 'Content blocked',
        requiresParentalApproval: true
      });

      // Act & Assert
      await expect(appearanceManager.previewAppearance(mockAppearanceConfig))
        .rejects.toThrow('Preview blocked: Content blocked');
      expect(appearanceManager.isPreviewActive()).toBe(false);
    });
  });

  describe('getAvailableAssets', () => {
    it('should return age-appropriate assets', async () => {
      // Arrange
      const mockAssets = [
        {
          id: 'asset_001',
          name: 'Child Hair Style',
          category: { name: 'hair', type: 'hair' as const, ageRestrictions: [] },
          ageRestriction: { min: 5, max: 12 },
          performanceImpact: PerformanceLevel.LOW,
          safetyRating: SafetyRating.SAFE
        },
        {
          id: 'asset_002',
          name: 'Teen Hair Style',
          category: { name: 'hair', type: 'hair' as const, ageRestrictions: [] },
          ageRestriction: { min: 13, max: 17 },
          performanceImpact: PerformanceLevel.MEDIUM,
          safetyRating: SafetyRating.SAFE
        }
      ];

      const category: AssetCategory = {
        name: 'hair',
        type: 'hair',
        ageRestrictions: []
      };

      mockAssetManager.getAssetsByCategory.mockResolvedValue(mockAssets);

      // Act
      const result = await appearanceManager.getAvailableAssets(category, 10);

      // Assert
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe('asset_001');
      expect(result.filteredByAge).toBe(1);
    });
  });

  describe('optimizeForPerformance', () => {
    it('should not optimize when performance is good', () => {
      // Arrange
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());

      // Act
      const result = appearanceManager.optimizeForPerformance(mockAppearanceConfig);

      // Assert
      expect(result).toEqual(mockAppearanceConfig);
      expect(appearanceManager.isPerformanceOptimized()).toBe(false);
    });

    it('should optimize when performance is poor', () => {
      // Arrange
      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      // Act
      const result = appearanceManager.optimizeForPerformance(mockAppearanceConfig);

      // Assert
      expect(result.hair.physicsEnabled).toBe(false);
      expect(result.hair.strandCount).toBeLessThanOrEqual(1000);
      expect(result.clothing.wrinkleSimulation).toBe(false);
      expect(result.animations.frameRate).toBeLessThanOrEqual(30);
      expect(result.animations.blendingEnabled).toBe(false);
      expect(appearanceManager.isPerformanceOptimized()).toBe(true);
    });

    it('should limit accessories for performance', () => {
      // Arrange
      const configWithManyAccessories = {
        ...mockAppearanceConfig,
        accessories: [
          { id: 'acc1', type: AccessoryType.HAT, position: { x: 0, y: 0, z: 0 }, scale: 1, detailLevel: PerformanceLevel.HIGH },
          { id: 'acc2', type: AccessoryType.GLASSES, position: { x: 0, y: 0, z: 0 }, scale: 1, detailLevel: PerformanceLevel.HIGH },
          { id: 'acc3', type: AccessoryType.JEWELRY, position: { x: 0, y: 0, z: 0 }, scale: 1, detailLevel: PerformanceLevel.HIGH },
          { id: 'acc4', type: AccessoryType.BACKPACK, position: { x: 0, y: 0, z: 0 }, scale: 1, detailLevel: PerformanceLevel.HIGH },
          { id: 'acc5', type: AccessoryType.HAT, position: { x: 0, y: 0, z: 0 }, scale: 1, detailLevel: PerformanceLevel.HIGH }
        ] as ExtendedAccessoryConfiguration[]
      };

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      // Act
      const result = appearanceManager.optimizeForPerformance(configWithManyAccessories);

      // Assert
      expect(result.accessories).toHaveLength(3); // Limited to 3 accessories
    });
  });

  describe('stopPreview', () => {
    it('should stop preview and return to current configuration', async () => {
      // Arrange
      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Content approved',
        requiresParentalApproval: false
      });

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());
      mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());

      // Start preview first
      await appearanceManager.previewAppearance(mockAppearanceConfig);
      expect(appearanceManager.isPreviewActive()).toBe(true);

      // Act
      await appearanceManager.stopPreview();

      // Assert
      expect(appearanceManager.isPreviewActive()).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit appearanceChanged event on successful update', async () => {
      // Arrange
      const eventSpy = jest.fn();
      appearanceManager.on('appearanceChanged', eventSpy);

      const appearanceChange: AppearanceChange = {
        changeId: 'change_001',
        type: 'face',
        oldConfiguration: mockAppearanceConfig,
        newConfiguration: mockAppearanceConfig,
        timestamp: new Date(),
        userId: 'user_001'
      };

      mockSafetyValidator.validateAppearanceConfiguration.mockResolvedValue({
        isAllowed: true,
        violations: [],
        riskLevel: 'low',
        reason: 'Content approved',
        requiresParentalApproval: false
      });

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics());
      mockRenderer.renderAvatar.mockResolvedValue(createMockRenderFrame());

      // Act
      await appearanceManager.updateAppearance(appearanceChange);

      // Assert
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        change: appearanceChange
      }));
    });

    it('should emit performanceOptimized event when optimization occurs', () => {
      // Arrange
      const eventSpy = jest.fn();
      appearanceManager.on('performanceOptimized', eventSpy);

      mockRenderer.getPerformanceMetrics.mockReturnValue(createMockRenderingMetrics(30, 1.8, 70));

      // Act
      appearanceManager.optimizeForPerformance(mockAppearanceConfig);

      // Assert
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        original: mockAppearanceConfig,
        optimized: expect.any(Object)
      }));
    });
  });
});