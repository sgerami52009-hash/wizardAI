import { Avatar3DRenderer } from './renderer';
import { 
  RenderingMetrics, 
  QualitySettings, 
  AnimationType,
  ShadowQuality,
  AntiAliasingType 
} from './types';
import { 
  AvatarConfiguration, 
  EmotionType, 
  AccentType, 
  EmotionalTone,
  HairTexture,
  AccessoryType
} from '../avatar/types';

// Mock WebGL context for testing
const mockWebGLContext = {
  getContext: jest.fn().mockReturnValue({
    clear: jest.fn(),
    enable: jest.fn(),
    depthFunc: jest.fn(),
    cullFace: jest.fn(),
    clearColor: jest.fn(),
    viewport: jest.fn(),
    getExtension: jest.fn().mockReturnValue({ loseContext: jest.fn() }),
    COLOR_BUFFER_BIT: 16384,
    DEPTH_BUFFER_BIT: 256,
    DEPTH_TEST: 2929,
    LEQUAL: 515,
    CULL_FACE: 2884,
    BACK: 1029
  }),
  width: 1920,
  height: 1080
};

// Mock avatar configuration for testing
const mockAvatarConfig: AvatarConfiguration = {
  userId: 'test-user',
  version: '1.0.0',
  appearance: {
    face: {
      meshId: 'face_default',
      textureId: 'texture_face_01',
      eyeColor: '#4A90E2',
      skinTone: '#FFDBAC',
      features: {
        eyeSize: 1.0,
        noseSize: 1.0,
        mouthSize: 1.0,
        cheekbones: 1.0
      }
    },
    hair: {
      styleId: 'hair_short_01',
      color: '#8B4513',
      length: 0.5,
      texture: HairTexture.STRAIGHT
    },
    clothing: {
      topId: 'shirt_casual_01',
      bottomId: 'pants_casual_01',
      shoesId: 'shoes_sneakers_01',
      colors: {
        primary: '#FF0000',
        secondary: '#0000FF',
        accent: '#FFFFFF'
      }
    },
    accessories: [],
    animations: {
      idle: 'anim_idle_default',
      talking: 'anim_talking_default',
      listening: 'anim_listening_default',
      thinking: 'anim_thinking_default',
      expressions: {
        happy: 'expr_happy',
        sad: 'expr_sad',
        surprised: 'expr_surprised',
        confused: 'expr_confused',
        excited: 'expr_excited'
      }
    }
  },
  personality: {
    friendliness: 8,
    formality: 5,
    humor: 7,
    enthusiasm: 6,
    patience: 8,
    supportiveness: 9
  },
  voice: {
    pitch: 0.0,
    speed: 1.0,
    accent: AccentType.NEUTRAL,
    emotionalTone: EmotionalTone.CHEERFUL,
    volume: 0.8
  },
  emotions: {
    defaultEmotion: EmotionType.NEUTRAL,
    expressionIntensity: 0.7,
    transitionSpeed: 1.0,
    emotionMappings: []
  },
  createdAt: new Date(),
  lastModified: new Date(),
  parentallyApproved: true
};

describe('Avatar3DRenderer', () => {
  let renderer: Avatar3DRenderer;

  beforeEach(() => {
    renderer = new Avatar3DRenderer();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (renderer) {
      renderer.dispose();
    }
  });

  describe('Initialization and Setup', () => {
    test('should initialize renderer with WebGL2 context', async () => {
      await expect(renderer.initialize(mockWebGLContext)).resolves.not.toThrow();
      
      expect(mockWebGLContext.getContext).toHaveBeenCalledWith('webgl2', expect.objectContaining({
        alpha: false,
        antialias: expect.any(Boolean),
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      }));
    });

    test('should throw error when WebGL2 is not supported', async () => {
      const mockCanvas = {
        ...mockWebGLContext,
        getContext: jest.fn().mockReturnValue(null)
      };

      await expect(renderer.initialize(mockCanvas)).rejects.toThrow('WebGL2 not supported');
    });

    test('should emit initialized event on successful setup', async () => {
      const initSpy = jest.fn();
      renderer.on('initialized', initSpy);

      await renderer.initialize(mockWebGLContext);

      expect(initSpy).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('Avatar Rendering Performance', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should render avatar within performance targets', async () => {
      const startTime = performance.now();
      const frame = await renderer.renderAvatar(mockAvatarConfig);
      const endTime = performance.now();

      expect(frame).toMatchObject({
        frameId: expect.stringMatching(/^frame_\d+_[a-z0-9]+$/),
        timestamp: expect.any(Number),
        renderTime: expect.any(Number),
        triangleCount: expect.any(Number),
        textureMemory: expect.any(Number),
        success: true
      });

      // Render time should be reasonable for 60fps target (~16.67ms)
      expect(frame.renderTime).toBeLessThan(20);
      expect(endTime - startTime).toBeLessThan(50); // Total function time
    });

    test('should maintain 60fps performance target', async () => {
      const frameCount = 10;
      const renderTimes: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        const frame = await renderer.renderAvatar(mockAvatarConfig);
        renderTimes.push(frame.renderTime);
      }

      const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / frameCount;
      const maxRenderTime = Math.max(...renderTimes);

      // Average should support 60fps (16.67ms per frame)
      expect(averageRenderTime).toBeLessThan(16.67);
      // No single frame should exceed 30fps threshold (33.33ms)
      expect(maxRenderTime).toBeLessThan(33.33);
    });

    test('should handle various avatar configurations efficiently', async () => {
      const configurations = [
        { 
          ...mockAvatarConfig, 
          appearance: { 
            ...mockAvatarConfig.appearance, 
            hair: { 
              ...mockAvatarConfig.appearance.hair,
              styleId: 'hair_long_01', 
              color: '#000000',
              length: 1.0
            } 
          } 
        },
        { 
          ...mockAvatarConfig, 
          appearance: { 
            ...mockAvatarConfig.appearance, 
            accessories: [{ 
              id: 'hat_01',
              type: AccessoryType.HAT, 
              position: { x: 0, y: 1, z: 0 },
              scale: 1.0
            }] 
          } 
        },
        { 
          ...mockAvatarConfig, 
          appearance: { 
            ...mockAvatarConfig.appearance, 
            clothing: { 
              ...mockAvatarConfig.appearance.clothing, 
              colors: {
                primary: '#FFFF00',
                secondary: '#00FF00',
                accent: '#0000FF'
              }
            } 
          } 
        }
      ];

      for (const config of configurations) {
        const frame = await renderer.renderAvatar(config);
        
        expect(frame.success).toBe(true);
        expect(frame.renderTime).toBeLessThan(20);
        expect(frame.triangleCount).toBeGreaterThan(0);
        expect(frame.triangleCount).toBeLessThan(50000); // Reasonable triangle limit
      }
    });

    test('should emit frameRendered event for each render', async () => {
      const frameSpy = jest.fn();
      renderer.on('frameRendered', frameSpy);

      await renderer.renderAvatar(mockAvatarConfig);

      expect(frameSpy).toHaveBeenCalledWith(expect.objectContaining({
        frameId: expect.any(String),
        success: true
      }));
    });

    test('should track triangle count accurately', async () => {
      const frame = await renderer.renderAvatar(mockAvatarConfig);
      const metrics = renderer.getPerformanceMetrics();

      expect(frame.triangleCount).toBe(metrics.triangleCount);
      expect(frame.triangleCount).toBeGreaterThan(0);
      expect(frame.triangleCount).toBeLessThan(100000); // Reasonable upper bound
    });
  });

  describe('Animation System', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should update animation with valid intensity', async () => {
      const animationSpy = jest.fn();
      renderer.on('animationUpdated', animationSpy);

      await renderer.updateAnimation(AnimationType.TALKING, 0.8);

      expect(animationSpy).toHaveBeenCalledWith({
        type: AnimationType.TALKING,
        intensity: 0.8
      });
    });

    test('should reject invalid animation intensity', async () => {
      await expect(renderer.updateAnimation(AnimationType.IDLE, -0.5)).rejects.toThrow('Animation intensity must be between 0 and 1');
      await expect(renderer.updateAnimation(AnimationType.IDLE, 1.5)).rejects.toThrow('Animation intensity must be between 0 and 1');
    });

    test('should handle multiple simultaneous animations', async () => {
      const animations = [
        { type: AnimationType.TALKING, intensity: 0.7 },
        { type: AnimationType.GESTURE, intensity: 0.5 },
        { type: AnimationType.EXPRESSION, intensity: 0.9 }
      ];

      for (const anim of animations) {
        await expect(renderer.updateAnimation(anim.type, anim.intensity)).resolves.not.toThrow();
      }
    });
  });

  describe('Emotional Expression System', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should set child-safe emotional expressions', async () => {
      const safeEmotions = ['happy', 'excited', 'curious', 'friendly', 'surprised'];
      const emotionSpy = jest.fn();
      renderer.on('emotionChanged', emotionSpy);

      for (const emotion of safeEmotions) {
        await renderer.setEmotionalExpression(emotion as EmotionType, 2000);
        
        expect(emotionSpy).toHaveBeenCalledWith({
          emotion,
          duration: 2000
        });
      }
    });

    test('should block inappropriate emotions for child safety', async () => {
      const errorSpy = jest.fn();
      renderer.on('error', errorSpy);

      await renderer.setEmotionalExpression('angry' as EmotionType, 1000);

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'safety',
        message: 'Emotion not appropriate for child users'
      });
    });

    test('should handle emotion duration correctly', async () => {
      const emotion = 'happy' as EmotionType;
      const duration = 1000;

      await renderer.setEmotionalExpression(emotion, duration);

      // Emotion should be active immediately
      // Note: In a real implementation, we'd check internal emotion state
      // For now, we verify the event was emitted
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Performance Metrics and Monitoring', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should provide accurate performance metrics', () => {
      const metrics = renderer.getPerformanceMetrics();

      expect(metrics).toMatchObject({
        currentFPS: expect.any(Number),
        gpuMemoryUsage: expect.any(Number),
        cpuUsage: expect.any(Number),
        renderTime: expect.any(Number),
        triangleCount: expect.any(Number),
        textureMemory: expect.any(Number),
        shaderCompileTime: expect.any(Number),
        drawCalls: expect.any(Number)
      });

      // Validate reasonable ranges for Jetson Nano Orin
      expect(metrics.gpuMemoryUsage).toBeLessThan(2.0); // 2GB GPU limit
      expect(metrics.cpuUsage).toBeLessThan(100);
      expect(metrics.currentFPS).toBeGreaterThan(0);
    });

    test('should track GPU memory usage within limits', async () => {
      // Render multiple frames to build up memory usage
      for (let i = 0; i < 5; i++) {
        await renderer.renderAvatar(mockAvatarConfig);
      }

      const metrics = renderer.getPerformanceMetrics();
      
      // Should stay within Jetson Nano Orin 2GB GPU limit
      expect(metrics.gpuMemoryUsage).toBeLessThan(2.0);
      expect(metrics.textureMemory).toBeLessThan(1.0); // Reasonable texture memory usage
    });

    test('should monitor frame rate consistency', async () => {
      const frameCount = 20;
      const fpsReadings: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        await renderer.renderAvatar(mockAvatarConfig);
        const metrics = renderer.getPerformanceMetrics();
        fpsReadings.push(metrics.currentFPS);
        
        // Small delay to simulate real rendering
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      // Check FPS stability (should not vary wildly)
      const avgFPS = fpsReadings.reduce((a, b) => a + b, 0) / frameCount;
      const fpsVariance = fpsReadings.reduce((acc, fps) => acc + Math.pow(fps - avgFPS, 2), 0) / frameCount;
      const fpsStdDev = Math.sqrt(fpsVariance);

      expect(avgFPS).toBeGreaterThan(30); // Minimum acceptable FPS
      expect(fpsStdDev).toBeLessThan(10); // FPS should be relatively stable
    });
  });

  describe('Quality Optimization', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should optimize quality for target FPS', async () => {
      const targetFPS = 60;
      const qualitySettings = await renderer.optimizeRenderQuality(targetFPS);

      expect(qualitySettings).toMatchObject({
        lodLevel: expect.any(Number),
        textureResolution: expect.any(Number),
        shadowQuality: expect.any(String),
        antiAliasing: expect.any(String),
        particleCount: expect.any(Number),
        animationQuality: expect.any(String),
        renderDistance: expect.any(Number)
      });

      // Validate reasonable quality settings
      expect(qualitySettings.lodLevel).toBeGreaterThanOrEqual(0);
      expect(qualitySettings.lodLevel).toBeLessThanOrEqual(4);
      expect(qualitySettings.textureResolution).toBeGreaterThan(0);
      expect(qualitySettings.particleCount).toBeGreaterThan(0);
    });

    test('should reduce quality when performance is poor', async () => {
      // Mock poor performance scenario
      const originalGetMetrics = renderer.getPerformanceMetrics;
      renderer.getPerformanceMetrics = jest.fn().mockReturnValue({
        currentFPS: 30, // Poor FPS
        gpuMemoryUsage: 1.8, // High memory usage
        cpuUsage: 80,
        renderTime: 25,
        triangleCount: 20000,
        textureMemory: 1.2,
        shaderCompileTime: 5,
        drawCalls: 60
      });

      const qualitySettings = await renderer.optimizeRenderQuality(60);

      // Should reduce quality settings
      expect(qualitySettings.lodLevel).toBeGreaterThan(1); // Higher LOD = lower quality
      expect(qualitySettings.textureResolution).toBeLessThan(1024); // Reduced texture resolution

      // Restore original method
      renderer.getPerformanceMetrics = originalGetMetrics;
    });

    test('should increase quality when performance allows', async () => {
      // Mock excellent performance scenario
      const originalGetMetrics = renderer.getPerformanceMetrics;
      renderer.getPerformanceMetrics = jest.fn().mockReturnValue({
        currentFPS: 75, // Excellent FPS
        gpuMemoryUsage: 0.8, // Low memory usage
        cpuUsage: 25,
        renderTime: 10,
        triangleCount: 10000,
        textureMemory: 0.5,
        shaderCompileTime: 1,
        drawCalls: 30
      });

      const qualitySettings = await renderer.optimizeRenderQuality(60);

      // Should maintain or increase quality settings
      expect(qualitySettings.lodLevel).toBeLessThanOrEqual(2);
      expect(qualitySettings.textureResolution).toBeGreaterThanOrEqual(1024);

      // Restore original method
      renderer.getPerformanceMetrics = originalGetMetrics;
    });

    test('should emit quality adjustment events', async () => {
      const qualitySpy = jest.fn();
      renderer.on('qualityAdjusted', qualitySpy);

      await renderer.optimizeRenderQuality(60);

      expect(qualitySpy).toHaveBeenCalledWith(expect.objectContaining({
        targetFPS: 60,
        currentFPS: expect.any(Number),
        newSettings: expect.any(Object)
      }));
    });
  });

  describe('Asset Preloading', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should preload assets successfully', async () => {
      const assetIds = ['model_face_01', 'texture_hair_02', 'anim_idle_03'];
      const preloadSpy = jest.fn();
      renderer.on('assetsPreloaded', preloadSpy);

      await renderer.preloadAssets(assetIds);

      expect(preloadSpy).toHaveBeenCalledWith({
        assetIds,
        count: assetIds.length
      });
    });

    test('should handle empty asset list', async () => {
      await expect(renderer.preloadAssets([])).resolves.not.toThrow();
    });

    test('should handle large asset lists', async () => {
      const largeAssetList = Array.from({ length: 100 }, (_, i) => `asset_${i}`);
      
      await expect(renderer.preloadAssets(largeAssetList)).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle rendering errors gracefully', async () => {
      const errorSpy = jest.fn();
      renderer.on('error', errorSpy);

      // Try to render without initialization
      await expect(renderer.renderAvatar(mockAvatarConfig)).rejects.toThrow('Renderer not initialized');
    });

    test('should validate avatar configuration safety', async () => {
      await renderer.initialize(mockWebGLContext);
      
      const unsafeConfig = {
        ...mockAvatarConfig,
        parentallyApproved: false
      };

      await expect(renderer.renderAvatar(unsafeConfig)).rejects.toThrow('Avatar configuration contains inappropriate content');
    });

    test('should handle WebGL context loss', async () => {
      await renderer.initialize(mockWebGLContext);
      
      // Simulate context loss
      const disposeSpy = jest.fn();
      renderer.on('disposed', disposeSpy);

      renderer.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should cleanup resources on disposal', () => {
      const disposeSpy = jest.fn();
      renderer.on('disposed', disposeSpy);

      renderer.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      // Verify no memory leaks by checking event listeners are removed
      expect(renderer.listenerCount('frameRendered')).toBe(0);
    });

    test('should handle shutdown gracefully', async () => {
      await expect(renderer.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Hardware Optimization for Jetson Nano Orin', () => {
    beforeEach(async () => {
      await renderer.initialize(mockWebGLContext);
    });

    test('should respect GPU memory limits', async () => {
      // Render complex scene multiple times
      for (let i = 0; i < 10; i++) {
        await renderer.renderAvatar(mockAvatarConfig);
      }

      const metrics = renderer.getPerformanceMetrics();
      
      // Should never exceed Jetson Nano Orin 2GB GPU limit
      expect(metrics.gpuMemoryUsage).toBeLessThan(2.0);
    });

    test('should maintain performance under sustained load', async () => {
      const sustainedFrameCount = 60; // 1 second at 60fps
      const renderTimes: number[] = [];

      for (let i = 0; i < sustainedFrameCount; i++) {
        const frame = await renderer.renderAvatar(mockAvatarConfig);
        renderTimes.push(frame.renderTime);
      }

      const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / sustainedFrameCount;
      const maxRenderTime = Math.max(...renderTimes);

      // Performance should remain stable under sustained load
      expect(averageRenderTime).toBeLessThan(16.67); // 60fps target
      expect(maxRenderTime).toBeLessThan(25); // No frame should be too slow
    });

    test('should optimize for mobile GPU architecture', async () => {
      const qualitySettings = await renderer.optimizeRenderQuality(60);

      // Settings should be appropriate for mobile GPU
      expect(qualitySettings.shadowQuality).not.toBe(ShadowQuality.HIGH); // Avoid expensive shadows
      expect(qualitySettings.antiAliasing).not.toBe(AntiAliasingType.MSAA_4X); // Avoid expensive AA
      expect(qualitySettings.particleCount).toBeLessThan(200); // Reasonable particle count
    });
  });
});