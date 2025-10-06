import { AssetOptimizer, PerformanceTarget, OptimizationTargets } from './asset-optimizer';
import { AssetManager } from './asset-manager';

describe('AssetOptimizer', () => {
  let assetOptimizer: AssetOptimizer;
  let mockAssetManager: jest.Mocked<AssetManager>;

  beforeEach(() => {
    // Create mock asset manager
    mockAssetManager = {
      loadModel: jest.fn(),
      loadTexture: jest.fn(),
      loadAnimation: jest.fn(),
      getMemoryStats: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    assetOptimizer = new AssetOptimizer(mockAssetManager);
  });

  afterEach(() => {
    assetOptimizer.dispose();
  });

  describe('Asset Compression and Optimization', () => {
    it('should optimize texture assets with compression', async () => {
      // Arrange
      const mockTexture = {
        id: 'test_texture',
        type: 'texture' as const,
        width: 2048,
        height: 2048,
        format: 'RGBA',
        data: new Uint8Array(2048 * 2048 * 4),
        mipmaps: false,
        memorySize: 16 // 16MB
      };

      mockAssetManager.loadTexture.mockResolvedValue(mockTexture);

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.optimizeAsset('test_texture', target);

      // Assert
      expect(result.success).toBe(true);
      expect(result.assetId).toBe('test_texture');
      expect(result.memorySaved).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.appliedOptimizations).toContain('texture_compression');
      expect(mockAssetManager.loadTexture).toHaveBeenCalledWith('test_texture');
    });

    it('should optimize model assets with mesh simplification', async () => {
      // Arrange
      const mockModel = {
        id: 'test_model',
        type: 'model' as const,
        vertices: new Float32Array(15000 * 3), // High poly model
        indices: new Uint16Array(15000),
        materials: [],
        boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
        triangleCount: 15000,
        memorySize: 50 // 50MB
      };

      mockAssetManager.loadModel.mockResolvedValue(mockModel);

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.optimizeAsset('test_model', target);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedOptimizations).toContain('mesh_simplification');
      expect(result.appliedOptimizations).toContain('vertex_compression');
      expect(result.memorySaved).toBeGreaterThan(0);
    });

    it('should optimize animation assets with keyframe reduction', async () => {
      // Arrange
      const mockAnimation = {
        id: 'test_animation',
        type: 'animation' as const,
        duration: 5.0,
        frameRate: 60,
        tracks: new Array(10),
        compressed: false,
        memorySize: 25 // 25MB
      };

      // Mock the loading sequence: model fails, texture fails, animation succeeds
      mockAssetManager.loadModel.mockRejectedValue(new Error('Not a model'));
      mockAssetManager.loadTexture.mockRejectedValue(new Error('Not a texture'));
      mockAssetManager.loadAnimation.mockResolvedValue(mockAnimation);

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.optimizeAsset('test_animation', target);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedOptimizations).toContain('keyframe_reduction');
      expect(result.memorySaved).toBeGreaterThan(0);
    });

    it('should handle optimization failures gracefully', async () => {
      // Arrange
      mockAssetManager.loadModel.mockRejectedValue(new Error('Asset not found'));
      mockAssetManager.loadTexture.mockRejectedValue(new Error('Asset not found'));
      mockAssetManager.loadAnimation.mockRejectedValue(new Error('Asset not found'));

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act & Assert
      await expect(assetOptimizer.optimizeAsset('nonexistent_asset', target))
        .rejects.toThrow('Asset not found');
    });
  });

  describe('Batch Optimization', () => {
    it('should batch optimize multiple assets with priority handling', async () => {
      // Arrange
      const mockAssets = [
        {
          id: 'texture_1',
          type: 'texture' as const,
          width: 1024,
          height: 1024,
          format: 'RGBA',
          data: new Uint8Array(1024 * 1024 * 4),
          mipmaps: false,
          memorySize: 4
        },
        {
          id: 'model_1',
          type: 'model' as const,
          vertices: new Float32Array(5000 * 3),
          indices: new Uint16Array(5000),
          materials: [],
          boundingBox: { min: [0, 0, 0], max: [1, 1, 1] },
          triangleCount: 5000,
          memorySize: 20
        }
      ];

      mockAssetManager.loadTexture.mockResolvedValue(mockAssets[0] as any);
      mockAssetManager.loadModel.mockResolvedValue(mockAssets[1] as any);

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.batchOptimizeAssets(['texture_1', 'model_1'], target);

      // Assert
      expect(result.totalAssets).toBe(2);
      expect(result.successfulOptimizations).toBe(2);
      expect(result.failedOptimizations).toBe(0);
      expect(result.totalMemorySaved).toBeGreaterThan(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const mockTexture = {
        id: 'texture_1',
        type: 'texture' as const,
        width: 1024,
        height: 1024,
        format: 'RGBA',
        data: new Uint8Array(1024 * 1024 * 4),
        mipmaps: false,
        memorySize: 4
      };

      // Mock successful texture load for texture_1
      mockAssetManager.loadTexture.mockImplementation((assetId: string) => {
        if (assetId === 'texture_1') {
          return Promise.resolve(mockTexture);
        }
        return Promise.reject(new Error('Texture load failed'));
      });

      // Mock failed model and animation loads for model_1
      mockAssetManager.loadModel.mockImplementation((assetId: string) => {
        if (assetId === 'model_1') {
          return Promise.reject(new Error('Model load failed'));
        }
        return Promise.reject(new Error('Model load failed'));
      });

      mockAssetManager.loadAnimation.mockImplementation((assetId: string) => {
        if (assetId === 'model_1') {
          return Promise.reject(new Error('Animation load failed'));
        }
        return Promise.reject(new Error('Animation load failed'));
      });

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.batchOptimizeAssets(['texture_1', 'model_1'], target);

      // Assert
      expect(result.totalAssets).toBe(2);
      expect(result.successfulOptimizations).toBe(1);
      expect(result.failedOptimizations).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].assetId).toBe('model_1');
    });
  });

  describe('Intelligent Caching', () => {
    it('should provide caching recommendations based on usage patterns', () => {
      // Act
      const recommendations = assetOptimizer.getCachingRecommendations();

      // Assert
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
      
      if (recommendations.length > 0) {
        expect(recommendations[0]).toHaveProperty('type');
        expect(recommendations[0]).toHaveProperty('assetIds');
        expect(recommendations[0]).toHaveProperty('reason');
        expect(recommendations[0]).toHaveProperty('expectedBenefit');
      }
    });

    it('should apply different caching strategies', async () => {
      // Arrange
      const strategies = ['aggressive', 'adaptive', 'conservative', 'memory_optimized'] as const;

      // Act & Assert
      for (const strategy of strategies) {
        await expect(assetOptimizer.applyCachingStrategy(strategy))
          .resolves.not.toThrow();
      }
    });
  });

  describe('Memory Management', () => {
    it('should perform automatic memory optimization', async () => {
      // Act
      const result = await assetOptimizer.performMemoryOptimization();

      // Assert
      expect(result).toHaveProperty('memoryFreed');
      expect(result).toHaveProperty('assetsUnloaded');
      expect(result).toHaveProperty('fragmentationReduced');
      expect(result).toHaveProperty('success');
      expect(typeof result.memoryFreed).toBe('number');
      expect(typeof result.assetsUnloaded).toBe('number');
      expect(typeof result.success).toBe('boolean');
    });

    it('should trigger memory optimization when memory usage is high', async () => {
      // Arrange
      const highMemoryStats = {
        totalUsedMB: 1800,
        maxMemoryMB: 2048,
        utilizationPercent: 87.9,
        cachedAssets: 50,
        loadingAssets: 2,
        preloadQueueSize: 5
      };

      mockAssetManager.getMemoryStats.mockReturnValue(highMemoryStats);

      // Simulate memory stats event
      const memoryOptimizationSpy = jest.spyOn(assetOptimizer, 'performMemoryOptimization');

      // Act
      mockAssetManager.on.mock.calls.find(call => call[0] === 'memoryStats')?.[1](highMemoryStats);

      // Assert
      expect(memoryOptimizationSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Profiling and Bottleneck Analysis', () => {
    it('should identify performance bottlenecks', () => {
      // Act
      const bottlenecks = assetOptimizer.getPerformanceBottlenecks();

      // Assert
      expect(bottlenecks).toHaveProperty('primaryBottleneck');
      expect(bottlenecks).toHaveProperty('bottleneckSeverity');
      expect(bottlenecks).toHaveProperty('affectedOperations');
      expect(bottlenecks).toHaveProperty('recommendations');
      expect(Array.isArray(bottlenecks.affectedOperations)).toBe(true);
      expect(Array.isArray(bottlenecks.recommendations)).toBe(true);
      expect(typeof bottlenecks.bottleneckSeverity).toBe('number');
    });

    it('should generate comprehensive optimization report', () => {
      // Arrange
      mockAssetManager.getMemoryStats.mockReturnValue({
        totalUsedMB: 1200,
        maxMemoryMB: 2048,
        utilizationPercent: 58.6,
        cachedAssets: 25,
        loadingAssets: 1,
        preloadQueueSize: 3
      });

      // Act
      const report = assetOptimizer.getOptimizationReport();

      // Assert
      expect(report).toHaveProperty('memoryUtilization');
      expect(report).toHaveProperty('performanceBottlenecks');
      expect(report).toHaveProperty('cachingEfficiency');
      expect(report).toHaveProperty('compressionEfficiency');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('systemHealth');
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(typeof report.systemHealth).toBe('number');
      expect(report.systemHealth).toBeGreaterThanOrEqual(0);
      expect(report.systemHealth).toBeLessThanOrEqual(1);
    });
  });

  describe('Optimization Queue Management', () => {
    it('should queue assets for background optimization', () => {
      // Act
      assetOptimizer.queueAssetOptimization('test_asset_1', 'high');
      assetOptimizer.queueAssetOptimization('test_asset_2', 'normal');
      assetOptimizer.queueAssetOptimization('test_asset_3', 'low');

      const status = assetOptimizer.getQueueStatus();

      // Assert
      expect(status.totalTasks).toBe(3);
      expect(status.priorityBreakdown.high).toBe(1);
      expect(status.priorityBreakdown.normal).toBe(1);
      expect(status.priorityBreakdown.low).toBe(1);
      expect(typeof status.estimatedProcessingTime).toBe('number');
    });

    it('should prioritize high-priority assets in queue', () => {
      // Arrange
      assetOptimizer.queueAssetOptimization('low_priority', 'low');
      assetOptimizer.queueAssetOptimization('high_priority', 'critical');
      assetOptimizer.queueAssetOptimization('normal_priority', 'normal');

      // Act
      const status = assetOptimizer.getQueueStatus();

      // Assert
      expect(status.totalTasks).toBe(3);
      expect(status.priorityBreakdown.critical).toBe(1);
      expect(status.priorityBreakdown.normal).toBe(1);
      expect(status.priorityBreakdown.low).toBe(1);
    });
  });

  describe('Optimization Targets and Configuration', () => {
    it('should set and apply optimization targets', () => {
      // Arrange
      const targets: OptimizationTargets = {
        maxMemoryMB: 1500,
        targetCompressionRatio: 0.7,
        maxQualityLoss: 0.15
      };

      // Act & Assert
      expect(() => assetOptimizer.setOptimizationTargets(targets))
        .not.toThrow();
    });

    it('should generate appropriate recommendations based on memory usage', () => {
      // Arrange
      mockAssetManager.getMemoryStats.mockReturnValue({
        totalUsedMB: 1700,
        maxMemoryMB: 2048,
        utilizationPercent: 83.0,
        cachedAssets: 40,
        loadingAssets: 3,
        preloadQueueSize: 8
      });

      // Act
      const report = assetOptimizer.getOptimizationReport();

      // Assert
      expect(report.recommendations).toContain('Consider enabling aggressive texture compression');
      expect(report.recommendations).toContain('Reduce texture resolution for non-critical assets');
    });
  });

  describe('System Lifecycle Management', () => {
    it('should start and stop optimization system', async () => {
      // Act & Assert
      await expect(assetOptimizer.startOptimization()).resolves.not.toThrow();
      await expect(assetOptimizer.stopOptimization()).resolves.not.toThrow();
    });

    it('should handle multiple start/stop calls gracefully', async () => {
      // Act & Assert
      await assetOptimizer.startOptimization();
      await assetOptimizer.startOptimization(); // Should not throw
      
      await assetOptimizer.stopOptimization();
      await assetOptimizer.stopOptimization(); // Should not throw
    });

    it('should dispose of all resources properly', () => {
      // Act & Assert
      expect(() => assetOptimizer.dispose()).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    it('should emit optimization events', async () => {
      // Arrange
      const mockTexture = {
        id: 'test_texture',
        type: 'texture' as const,
        width: 1024,
        height: 1024,
        format: 'RGBA',
        data: new Uint8Array(1024 * 1024 * 4),
        mipmaps: false,
        memorySize: 4
      };

      mockAssetManager.loadTexture.mockResolvedValue(mockTexture);

      const optimizedSpy = jest.fn();
      assetOptimizer.on('assetOptimized', optimizedSpy);

      const target: PerformanceTarget = {
        maxMemoryMB: 200,
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      await assetOptimizer.optimizeAsset('test_texture', target);

      // Assert
      expect(optimizedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: 'test_texture',
          result: expect.objectContaining({
            success: true,
            assetId: 'test_texture'
          })
        })
      );
    });

    it('should handle asset manager events for automatic optimization', () => {
      // Arrange
      const queueSpy = jest.spyOn(assetOptimizer, 'queueAssetOptimization');

      // Act
      const assetLoadedHandler = mockAssetManager.on.mock.calls
        .find(call => call[0] === 'assetLoaded')?.[1];
      
      if (assetLoadedHandler) {
        assetLoadedHandler({ assetId: 'new_asset' });
      }

      // Assert
      expect(queueSpy).toHaveBeenCalledWith('new_asset', 'low');
    });
  });

  describe('Hardware-Specific Optimizations (Jetson Nano Orin)', () => {
    it('should respect 2GB GPU memory limit in optimization targets', async () => {
      // Arrange
      const largeTexture = {
        id: 'large_texture',
        type: 'texture' as const,
        width: 4096,
        height: 4096,
        format: 'RGBA',
        data: new Uint8Array(4096 * 4096 * 4),
        mipmaps: false,
        memorySize: 64 // 64MB texture
      };

      mockAssetManager.loadTexture.mockResolvedValue(largeTexture);

      const jetsonTarget: PerformanceTarget = {
        maxMemoryMB: 2048, // 2GB limit
        targetFPS: 60,
        maxProcessingTimeMs: 100
      };

      // Act
      const result = await assetOptimizer.optimizeAsset('large_texture', jetsonTarget);

      // Assert
      expect(result.success).toBe(true);
      expect(result.appliedOptimizations).toContain('texture_resize');
      expect(result.memorySaved).toBeGreaterThan(0);
    });

    it('should optimize for 60fps target on Jetson hardware', () => {
      // Arrange
      const bottlenecks = assetOptimizer.getPerformanceBottlenecks();

      // Assert
      expect(bottlenecks.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/texture|polygon|memory/i)
        ])
      );
    });
  });
});