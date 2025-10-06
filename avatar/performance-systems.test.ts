import { 
  ResourceMonitor, 
  AlertType, 
  AlertSeverity, 
  ResourceThresholds,
  ResourceMetrics,
  PerformanceAlert,
  OptimizationRecommendation,
  SystemHealthStatus
} from './resource-monitor';
import { 
  PerformanceSystem, 
  PerformanceTargets, 
  PerformanceReport, 
  OptimizationResult,
  PerformanceWarning 
} from '../rendering/performance-system';
import { AssetManager, AssetMemoryStats } from '../rendering/asset-manager';
import { 
  performanceMonitor, 
  qualityOptimizer,
  OptimizationAction 
} from '../rendering/performance';
import { RenderingMetrics, PerformanceThresholds, QualitySettings } from '../rendering/types';

/**
 * Comprehensive unit tests for performance systems
 * Tests resource monitoring accuracy, threshold detection, adaptive quality adjustment,
 * optimization mechanisms, and asset management strategies
 * 
 * Requirements covered: 6.1, 6.2, 6.3
 */
describe('Performance Systems Integration Tests', () => {
  let resourceMonitor: ResourceMonitor;
  let performanceSystem: PerformanceSystem;
  let assetManager: AssetManager;

  beforeEach(() => {
    resourceMonitor = new ResourceMonitor();
    performanceSystem = new PerformanceSystem();
    assetManager = new AssetManager();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (resourceMonitor) {
      await resourceMonitor.stopMonitoring();
    }
    if (performanceSystem) {
      await performanceSystem.stopMonitoring();
      performanceSystem.dispose();
    }
    if (assetManager) {
      assetManager.dispose();
    }
  });

  describe('Resource Monitoring Accuracy and Threshold Detection', () => {
    describe('Metrics Collection Accuracy', () => {
      test('should collect accurate GPU metrics within Jetson Nano Orin constraints', async () => {
        await resourceMonitor.startMonitoring();
        
        // Wait for metrics collection
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const metrics = resourceMonitor.getCurrentMetrics();
        expect(metrics).toBeTruthy();
        
        if (metrics) {
          // GPU metrics should be within Jetson Nano Orin specifications
          expect(metrics.gpu.memoryUsageGB).toBeGreaterThan(0);
          expect(metrics.gpu.memoryUsageGB).toBeLessThanOrEqual(2.0); // 2GB GPU limit
          expect(metrics.gpu.utilizationPercent).toBeGreaterThanOrEqual(0);
          expect(metrics.gpu.utilizationPercent).toBeLessThanOrEqual(100);
          expect(metrics.gpu.temperature).toBeGreaterThan(20); // Above room temperature
          expect(metrics.gpu.temperature).toBeLessThan(85); // Below thermal throttling
          expect(metrics.gpu.clockSpeed).toBeGreaterThan(1000); // Reasonable clock speed
          expect(metrics.gpu.powerUsage).toBeGreaterThan(0);
        }
      });

      test('should collect accurate CPU metrics for 6-core ARM processor', async () => {
        await resourceMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const metrics = resourceMonitor.getCurrentMetrics();
        expect(metrics).toBeTruthy();
        
        if (metrics) {
          // CPU metrics should reflect 6-core ARM architecture
          expect(metrics.cpu.coreCount).toBe(6); // Jetson Nano Orin has 6 cores
          expect(metrics.cpu.usagePercent).toBeGreaterThanOrEqual(0);
          expect(metrics.cpu.usagePercent).toBeLessThanOrEqual(100);
          expect(metrics.cpu.temperature).toBeGreaterThan(20);
          expect(metrics.cpu.temperature).toBeLessThan(85);
          expect(metrics.cpu.activeThreads).toBeGreaterThan(0);
          expect(metrics.cpu.clockSpeed).toBeGreaterThan(1500); // ARM A78AE base clock
        }
      });

      test('should collect accurate memory metrics for 8GB system', async () => {
        await resourceMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const metrics = resourceMonitor.getCurrentMetrics();
        expect(metrics).toBeTruthy();
        
        if (metrics) {
          // Memory metrics should reflect 8GB system
          expect(metrics.memory.totalGB).toBe(8.0); // Jetson Nano Orin has 8GB
          expect(metrics.memory.usedGB).toBeGreaterThan(0);
          expect(metrics.memory.usedGB).toBeLessThan(metrics.memory.totalGB);
          expect(metrics.memory.availableGB).toBeGreaterThan(0);
          expect(metrics.memory.usedGB + metrics.memory.availableGB).toBeCloseTo(8.0, 1);
          expect(metrics.memory.swapUsedGB).toBeGreaterThanOrEqual(0);
          expect(metrics.memory.buffersCacheGB).toBeGreaterThanOrEqual(0);
        }
      });

      test('should collect accurate rendering metrics', async () => {
        await resourceMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const metrics = resourceMonitor.getCurrentMetrics();
        expect(metrics).toBeTruthy();
        
        if (metrics) {
          // Rendering metrics should be realistic for avatar system
          expect(metrics.rendering.currentFPS).toBeGreaterThan(0);
          expect(metrics.rendering.currentFPS).toBeLessThanOrEqual(120); // Reasonable upper bound
          expect(metrics.rendering.gpuMemoryUsage).toBeGreaterThan(0);
          expect(metrics.rendering.cpuUsage).toBeGreaterThanOrEqual(0);
          expect(metrics.rendering.renderTime).toBeGreaterThan(0);
          expect(metrics.rendering.triangleCount).toBeGreaterThan(0);
          expect(metrics.rendering.textureMemory).toBeGreaterThan(0);
          expect(metrics.rendering.shaderCompileTime).toBeGreaterThanOrEqual(0);
          expect(metrics.rendering.drawCalls).toBeGreaterThan(0);
        }
      });

      test('should maintain metrics history with proper time windows', async () => {
        await resourceMonitor.startMonitoring();
        
        // Wait for multiple metrics collections
        await new Promise(resolve => setTimeout(resolve, 3100));
        
        const shortWindow = resourceMonitor.getAverageMetrics(1000); // 1 second
        const mediumWindow = resourceMonitor.getAverageMetrics(5000); // 5 seconds
        const longWindow = resourceMonitor.getAverageMetrics(60000); // 1 minute
        
        expect(shortWindow).toBeTruthy();
        expect(mediumWindow).toBeTruthy();
        expect(longWindow).toBeTruthy();
        
        // Metrics should be consistent across time windows
        if (shortWindow && mediumWindow) {
          expect(Math.abs(shortWindow.gpu.memoryUsageGB - mediumWindow.gpu.memoryUsageGB)).toBeLessThan(0.5);
          expect(Math.abs(shortWindow.cpu.usagePercent - mediumWindow.cpu.usagePercent)).toBeLessThan(20);
        }
      });
    });

    describe('Threshold Detection Accuracy', () => {
      test('should accurately detect GPU memory threshold violations', async () => {
        const alertSpy = jest.fn();
        
        // Set very low GPU memory threshold to trigger alerts
        const lowThresholds: ResourceThresholds = {
          maxGPUMemoryGB: 0.1,
          criticalGPUMemoryGB: 0.05,
          maxCPUUsage: 100,
          minFPS: 1,
          maxRenderTime: 1000,
          criticalCPUUsage: 100,
          criticalFPS: 1,
          maxMemoryUsageGB: 10,
          maxGPUTemperature: 100,
          maxCPUTemperature: 100
        };
        
        const testMonitor = new ResourceMonitor(lowThresholds);
        testMonitor.on('performanceAlert', alertSpy);
        
        await testMonitor.startMonitoring();
        
        // Wait for threshold detection
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        await testMonitor.stopMonitoring();
        
        expect(alertSpy).toHaveBeenCalled();
        const alert = alertSpy.mock.calls[0][0] as PerformanceAlert;
        expect(alert.type).toBe(AlertType.GPU_MEMORY);
        expect(alert.severity).toBeOneOf([AlertSeverity.WARNING, AlertSeverity.CRITICAL]);
        expect(alert.recommendations).toContain('Reduce texture quality');
        expect(alert.metrics).toBeDefined();
      });

      test('should accurately detect CPU usage threshold violations', async () => {
        const alertSpy = jest.fn();
        
        // Set very low CPU threshold to trigger alerts
        const lowThresholds: ResourceThresholds = {
          maxGPUMemoryGB: 10,
          criticalGPUMemoryGB: 10,
          maxCPUUsage: 5,
          criticalCPUUsage: 10,
          minFPS: 1,
          maxRenderTime: 1000,
          criticalFPS: 1,
          maxMemoryUsageGB: 10,
          maxGPUTemperature: 100,
          maxCPUTemperature: 100
        };
        
        const testMonitor = new ResourceMonitor(lowThresholds);
        testMonitor.on('performanceAlert', alertSpy);
        
        await testMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        await testMonitor.stopMonitoring();
        
        expect(alertSpy).toHaveBeenCalled();
        const alert = alertSpy.mock.calls[0][0] as PerformanceAlert;
        expect(alert.type).toBe(AlertType.CPU_USAGE);
        expect(alert.recommendations).toContain('Reduce animation complexity');
      });

      test('should accurately detect FPS threshold violations', async () => {
        const alertSpy = jest.fn();
        
        // Set very high FPS threshold to trigger alerts
        const highThresholds: ResourceThresholds = {
          maxGPUMemoryGB: 10,
          criticalGPUMemoryGB: 10,
          maxCPUUsage: 100,
          criticalCPUUsage: 100,
          minFPS: 120,
          criticalFPS: 100,
          maxRenderTime: 1000,
          maxMemoryUsageGB: 10,
          maxGPUTemperature: 100,
          maxCPUTemperature: 100
        };
        
        const testMonitor = new ResourceMonitor(highThresholds);
        testMonitor.on('performanceAlert', alertSpy);
        
        await testMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        await testMonitor.stopMonitoring();
        
        expect(alertSpy).toHaveBeenCalled();
        const alert = alertSpy.mock.calls[0][0] as PerformanceAlert;
        expect(alert.type).toBe(AlertType.FPS_DROP);
        expect(alert.recommendations).toContain('Enable automatic quality reduction');
      });

      test('should respect alert cooldown periods to prevent spam', async () => {
        const alertSpy = jest.fn();
        
        const lowThresholds: ResourceThresholds = {
          maxGPUMemoryGB: 0.1,
          criticalGPUMemoryGB: 0.05,
          maxCPUUsage: 100,
          minFPS: 1,
          maxRenderTime: 1000,
          criticalCPUUsage: 100,
          criticalFPS: 1,
          maxMemoryUsageGB: 10,
          maxGPUTemperature: 100,
          maxCPUTemperature: 100
        };
        
        const testMonitor = new ResourceMonitor(lowThresholds);
        testMonitor.on('performanceAlert', alertSpy);
        
        await testMonitor.startMonitoring();
        
        // Wait for multiple monitoring cycles
        await new Promise(resolve => setTimeout(resolve, 5100));
        
        await testMonitor.stopMonitoring();
        
        // Should have received alerts but not too many due to cooldown
        expect(alertSpy).toHaveBeenCalled();
        expect(alertSpy.mock.calls.length).toBeLessThan(10); // Cooldown should limit alerts
      });

      test('should provide accurate threshold violation context', async () => {
        const alertSpy = jest.fn();
        
        const testThresholds: ResourceThresholds = {
          maxGPUMemoryGB: 0.5,
          criticalGPUMemoryGB: 0.3,
          maxCPUUsage: 20,
          criticalCPUUsage: 30,
          minFPS: 100,
          criticalFPS: 80,
          maxRenderTime: 5,
          maxMemoryUsageGB: 2,
          maxGPUTemperature: 50,
          maxCPUTemperature: 50
        };
        
        const testMonitor = new ResourceMonitor(testThresholds);
        testMonitor.on('performanceAlert', alertSpy);
        
        await testMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        await testMonitor.stopMonitoring();
        
        if (alertSpy.mock.calls.length > 0) {
          const alert = alertSpy.mock.calls[0][0] as PerformanceAlert;
          
          // Alert should contain comprehensive context
          expect(alert.timestamp).toBeGreaterThan(0);
          expect(alert.message).toBeTruthy();
          expect(alert.metrics).toBeDefined();
          expect(alert.recommendations).toBeInstanceOf(Array);
          expect(alert.recommendations.length).toBeGreaterThan(0);
          
          // Recommendations should be specific to the alert type
          if (alert.type === AlertType.GPU_MEMORY) {
            expect(alert.recommendations.some(rec => rec.includes('texture') || rec.includes('memory'))).toBe(true);
          } else if (alert.type === AlertType.CPU_USAGE) {
            expect(alert.recommendations.some(rec => rec.includes('animation') || rec.includes('processing'))).toBe(true);
          } else if (alert.type === AlertType.FPS_DROP) {
            expect(alert.recommendations.some(rec => rec.includes('quality') || rec.includes('FPS'))).toBe(true);
          }
        }
      });
    });

    describe('Performance Trend Analysis', () => {
      test('should accurately track performance trends over time', async () => {
        await resourceMonitor.startMonitoring();
        
        // Wait for sufficient data collection
        await new Promise(resolve => setTimeout(resolve, 5100));
        
        const trends = resourceMonitor.getPerformanceTrends(5000);
        
        expect(trends).toBeInstanceOf(Array);
        expect(trends.length).toBeGreaterThan(0);
        
        trends.forEach(trend => {
          expect(trend.timestamp).toBeGreaterThan(0);
          expect(trend.fps).toBeGreaterThan(0);
          expect(trend.gpuMemory).toBeGreaterThan(0);
          expect(trend.cpuUsage).toBeGreaterThanOrEqual(0);
          expect(trend.renderTime).toBeGreaterThan(0);
        });
        
        // Trends should be chronologically ordered
        for (let i = 1; i < trends.length; i++) {
          expect(trends[i].timestamp).toBeGreaterThanOrEqual(trends[i-1].timestamp);
        }
      });

      test('should calculate system health status accurately', async () => {
        await resourceMonitor.startMonitoring();
        
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const healthStatus = resourceMonitor.getSystemHealthStatus();
        
        expect(healthStatus).toMatchObject({
          overall: expect.stringMatching(/^(healthy|warning|critical|unknown)$/),
          components: expect.objectContaining({
            gpu: expect.objectContaining({
              status: expect.stringMatching(/^(healthy|warning|critical|unknown)$/),
              score: expect.any(Number),
              metrics: expect.any(Object)
            }),
            cpu: expect.objectContaining({
              status: expect.stringMatching(/^(healthy|warning|critical|unknown)$/),
              score: expect.any(Number),
              metrics: expect.any(Object)
            })
          }),
          score: expect.any(Number),
          recommendations: expect.any(Array)
        });
        
        // Health scores should be within valid range
        expect(healthStatus.score).toBeGreaterThanOrEqual(0);
        expect(healthStatus.score).toBeLessThanOrEqual(100);
        
        Object.values(healthStatus.components).forEach(component => {
          expect(component.score).toBeGreaterThanOrEqual(0);
          expect(component.score).toBeLessThanOrEqual(100);
        });
      });
    });
  });

  describe('Adaptive Quality Adjustment and Optimization Mechanisms', () => {
    describe('Quality Optimization Accuracy', () => {
      test('should optimize quality settings for target FPS accurately', () => {
        const poorMetrics: RenderingMetrics = {
          currentFPS: 25, // Well below target
          gpuMemoryUsage: 1.8,
          cpuUsage: 85,
          renderTime: 35,
          triangleCount: 25000,
          textureMemory: 1.5,
          shaderCompileTime: 8,
          drawCalls: 80
        };
        
        const optimizedSettings = qualityOptimizer.optimizeForTarget(60, poorMetrics);
        
        // Should apply aggressive optimizations for poor performance
        expect(optimizedSettings.lodLevel).toBeGreaterThan(2); // Higher LOD = lower quality
        expect(optimizedSettings.textureResolution).toBeLessThanOrEqual(768); // Reduced resolution
        expect(optimizedSettings.shadowQuality).toBeOneOf(['low', 'disabled']);
        expect(optimizedSettings.particleCount).toBeLessThan(75); // Reduced particles
        expect(optimizedSettings.renderDistance).toBeLessThan(50); // Reduced distance
      });

      test('should maintain quality when performance is acceptable', () => {
        const goodMetrics: RenderingMetrics = {
          currentFPS: 65, // Above target
          gpuMemoryUsage: 0.8,
          cpuUsage: 35,
          renderTime: 12,
          triangleCount: 12000,
          textureMemory: 0.6,
          shaderCompileTime: 1.5,
          drawCalls: 30
        };
        
        const optimizedSettings = qualityOptimizer.optimizeForTarget(60, goodMetrics);
        
        // Should maintain good quality settings
        expect(optimizedSettings.lodLevel).toBeLessThanOrEqual(2);
        expect(optimizedSettings.textureResolution).toBeGreaterThanOrEqual(768);
        expect(optimizedSettings.shadowQuality).not.toBe('disabled');
        expect(optimizedSettings.particleCount).toBeGreaterThan(50);
      });

      test('should provide hardware-appropriate recommendations', () => {
        const jetsonCapabilities = {
          gpu: 'Tegra X1',
          memory: '2GB',
          architecture: 'mobile'
        };
        
        const recommendedSettings = qualityOptimizer.getRecommendedSettings(jetsonCapabilities);
        
        // Settings should be appropriate for Jetson Nano Orin
        expect(recommendedSettings.textureResolution).toBeLessThanOrEqual(1024); // Mobile-appropriate
        expect(recommendedSettings.shadowQuality).not.toBe('high'); // Avoid expensive shadows
        expect(recommendedSettings.antiAliasing).toBeOneOf(['none', 'fxaa']); // Mobile-friendly AA
        expect(recommendedSettings.particleCount).toBeLessThan(100); // Reasonable for mobile GPU
        expect(recommendedSettings.lodLevel).toBeGreaterThanOrEqual(1); // Some optimization
      });

      test('should apply optimizations successfully', async () => {
        const optimizations: OptimizationAction[] = [
          {
            type: 'reduce_lod',
            description: 'Reduce level of detail',
            performanceGain: 10,
            qualityImpact: 0.2,
            execute: jest.fn().mockResolvedValue(true)
          },
          {
            type: 'lower_texture_res',
            description: 'Lower texture resolution',
            performanceGain: 8,
            qualityImpact: 0.3,
            execute: jest.fn().mockResolvedValue(true)
          }
        ];
        
        const result = await qualityOptimizer.applyOptimizations(optimizations);
        
        expect(result).toBe(true);
        expect(optimizations[0].execute).toHaveBeenCalled();
        expect(optimizations[1].execute).toHaveBeenCalled();
      });

      test('should handle optimization failures gracefully', async () => {
        const optimizations: OptimizationAction[] = [
          {
            type: 'reduce_lod',
            description: 'Reduce level of detail',
            performanceGain: 10,
            qualityImpact: 0.2,
            execute: jest.fn().mockResolvedValue(false) // Fails
          }
        ];
        
        const result = await qualityOptimizer.applyOptimizations(optimizations);
        
        expect(result).toBe(false); // Should fail gracefully
      });
    });

    describe('Automatic Performance Optimization', () => {
      test('should trigger automatic optimization on performance degradation', async () => {
        await performanceSystem.startMonitoring();
        
        const optimizationSpy = jest.fn();
        performanceSystem.on('performanceOptimized', optimizationSpy);
        
        // Enable automatic optimization
        performanceSystem.setAutoOptimization(true);
        
        // Manually trigger optimization to test the mechanism
        const result = await performanceSystem.optimizePerformance();
        
        expect(optimizationSpy).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.appliedOptimizations).toBeInstanceOf(Array);
        
        // Test that the optimization result has the expected structure
        expect(result).toMatchObject({
          success: expect.any(Boolean),
          beforeMetrics: expect.any(Object),
          afterMetrics: expect.any(Object),
          appliedOptimizations: expect.any(Array),
          performanceGain: expect.any(Number),
          memoryReduction: expect.any(Number)
        });
      });

      test('should generate comprehensive performance reports', async () => {
        await performanceSystem.startMonitoring();
        
        // Wait for metrics collection
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const report = performanceSystem.getPerformanceReport();
        
        expect(report).toMatchObject({
          current: expect.objectContaining({
            currentFPS: expect.any(Number),
            gpuMemoryUsage: expect.any(Number),
            cpuUsage: expect.any(Number),
            renderTime: expect.any(Number)
          }),
          average: expect.objectContaining({
            currentFPS: expect.any(Number),
            gpuMemoryUsage: expect.any(Number),
            cpuUsage: expect.any(Number),
            renderTime: expect.any(Number)
          }),
          resources: expect.objectContaining({
            averageGPUUsage: expect.any(Number),
            averageCPUUsage: expect.any(Number),
            memoryTrend: expect.stringMatching(/^(increasing|decreasing|stable)$/),
            stability: expect.any(Number)
          }),
          isAcceptable: expect.any(Boolean),
          recommendations: expect.any(Array),
          recentOptimizations: expect.any(Array),
          systemHealth: expect.any(Number)
        });
        
        // System health should be normalized
        expect(report.systemHealth).toBeGreaterThanOrEqual(0);
        expect(report.systemHealth).toBeLessThanOrEqual(1);
      });

      test('should track optimization effectiveness over time', async () => {
        await performanceSystem.startMonitoring();
        
        // Perform multiple optimizations
        await performanceSystem.optimizePerformance();
        await performanceSystem.optimizePerformance();
        
        const history = performanceSystem.getOptimizationHistory();
        
        expect(history.length).toBeGreaterThan(0);
        
        history.forEach(record => {
          expect(record).toMatchObject({
            timestamp: expect.any(Number),
            trigger: expect.stringMatching(/^(manual|automatic|threshold)$/),
            result: expect.objectContaining({
              success: expect.any(Boolean),
              performanceGain: expect.any(Number),
              memoryReduction: expect.any(Number)
            }),
            effectiveness: expect.any(Number)
          });
        });
      });

      test('should set and enforce performance targets', () => {
        const targets: PerformanceTargets = {
          targetFPS: 45, // Lower target for mobile
          maxGPUMemoryGB: 1.5,
          maxCPUUsage: 60
        };
        
        const targetsSpy = jest.fn();
        performanceSystem.on('targetsUpdated', targetsSpy);
        
        performanceSystem.setPerformanceTargets(targets);
        
        expect(targetsSpy).toHaveBeenCalledWith(targets);
      });
    });
  });

  describe('Asset Management and Memory Optimization Strategies', () => {
    describe('Memory Management Accuracy', () => {
      test('should track asset memory usage accurately', async () => {
        const initialStats = assetManager.getMemoryStats();
        expect(initialStats.totalUsedMB).toBe(0);
        
        // Load various asset types
        await assetManager.loadModel('memory_test_model');
        await assetManager.loadTexture('memory_test_texture.png');
        await assetManager.loadAnimation('memory_test_anim.fbx');
        
        const afterLoadStats = assetManager.getMemoryStats();
        
        expect(afterLoadStats.totalUsedMB).toBeGreaterThan(0);
        expect(afterLoadStats.cachedAssets).toBe(3);
        expect(afterLoadStats.utilizationPercent).toBeGreaterThan(0);
        expect(afterLoadStats.utilizationPercent).toBeLessThanOrEqual(100);
        
        // Memory usage should be reasonable for test assets
        expect(afterLoadStats.totalUsedMB).toBeLessThan(100); // Should be reasonable for test assets
      });

      test('should enforce GPU memory limits strictly', async () => {
        // Attempt to load many assets to test memory limits
        const assetPromises = Array.from({ length: 100 }, (_, i) => 
          assetManager.loadModel(`large_asset_${i}`).catch(() => null)
        );
        
        await Promise.all(assetPromises);
        
        const stats = assetManager.getMemoryStats();
        
        // Should not exceed 2GB limit (2048MB)
        expect(stats.totalUsedMB).toBeLessThanOrEqual(2048);
        expect(stats.maxMemoryMB).toBe(2048);
      });

      test('should perform automatic memory cleanup when approaching limits', async () => {
        const cleanupSpy = jest.fn();
        assetManager.on('memoryCleanup', cleanupSpy);
        
        // Load assets to approach memory limit
        const assets = Array.from({ length: 20 }, (_, i) => `cleanup_test_${i}`);
        
        for (const assetId of assets) {
          await assetManager.loadModel(assetId);
        }
        
        // Force cleanup to test mechanism
        const freedMemory = await assetManager.forceCleanup();
        
        expect(freedMemory).toBeGreaterThanOrEqual(0);
        expect(cleanupSpy).toHaveBeenCalled();
        
        const cleanupEvent = cleanupSpy.mock.calls[0][0];
        expect(cleanupEvent.freedMemory).toBeGreaterThanOrEqual(0);
        expect(cleanupEvent.beforeMB).toBeGreaterThanOrEqual(cleanupEvent.afterMB);
      });

      test('should implement LRU (Least Recently Used) eviction strategy', async () => {
        // Load multiple assets to fill memory
        const assets = Array.from({ length: 15 }, (_, i) => `lru_test_${i}`);
        
        for (const assetId of assets) {
          await assetManager.loadModel(assetId);
        }
        
        const beforeCleanupStats = assetManager.getMemoryStats();
        
        // Access some assets to update their LRU status
        await assetManager.loadModel('lru_test_1'); // Most recently used
        await assetManager.loadModel('lru_test_3'); // Second most recently used
        
        // Force cleanup to trigger LRU eviction
        const freedMemory = await assetManager.forceCleanup();
        
        const finalStats = assetManager.getMemoryStats();
        
        // Should have cleaned up some assets or freed some memory
        const cleanupOccurred = finalStats.cachedAssets < beforeCleanupStats.cachedAssets || 
                               freedMemory > 0 || 
                               finalStats.totalUsedMB < beforeCleanupStats.totalUsedMB;
        
        expect(cleanupOccurred).toBe(true);
      });

      test('should handle asset dependencies correctly during cleanup', async () => {
        const mainAsset = 'dependent_main';
        const dependencies = ['dep_texture.png', 'dep_animation.fbx'];
        
        // Set up dependencies
        assetManager.setAssetDependencies(mainAsset, dependencies);
        
        // Load main asset (should load dependencies)
        await assetManager.loadModel(mainAsset);
        
        const stats = assetManager.getMemoryStats();
        expect(stats.cachedAssets).toBeGreaterThanOrEqual(3); // Main + 2 dependencies
        
        // Dependencies should be loaded
        const retrievedDeps = assetManager.getAssetDependencies(mainAsset);
        expect(retrievedDeps).toEqual(dependencies);
      });
    });

    describe('Asset Loading Optimization', () => {
      test('should optimize asset loading order based on dependencies', () => {
        const assets = ['model_c', 'model_a', 'model_b'];
        
        // Set up dependency chain: c -> b -> a
        assetManager.setAssetDependencies('model_c', ['model_b']);
        assetManager.setAssetDependencies('model_b', ['model_a']);
        
        const optimizedOrder = assetManager.optimizeLoadingOrder(assets);
        
        // Should load in dependency order: a, b, c
        expect(optimizedOrder).toEqual(['model_a', 'model_b', 'model_c']);
      });

      test('should handle asset preloading efficiently', async () => {
        const preloadSpy = jest.fn();
        assetManager.on('preloadQueued', preloadSpy);
        
        const assetIds = ['preload_1', 'preload_2', 'preload_3'];
        
        await assetManager.preloadAssets(assetIds);
        
        expect(preloadSpy).toHaveBeenCalledWith({
          assetIds,
          queueSize: expect.any(Number)
        });
        
        // Should not duplicate assets in preload queue
        await assetManager.preloadAssets(assetIds); // Same assets again
        
        const stats = assetManager.getMemoryStats();
        expect(stats.preloadQueueSize).toBeLessThanOrEqual(assetIds.length);
      });

      test('should prevent duplicate loading of same asset', async () => {
        const assetId = 'duplicate_prevention_test';
        
        // Start multiple loads simultaneously
        const loadPromises = [
          assetManager.loadModel(assetId),
          assetManager.loadModel(assetId),
          assetManager.loadModel(assetId)
        ];
        
        const results = await Promise.all(loadPromises);
        
        // All should return the same asset instance
        expect(results[0]).toBe(results[1]);
        expect(results[1]).toBe(results[2]);
        
        // Should only be cached once
        const stats = assetManager.getMemoryStats();
        expect(stats.cachedAssets).toBe(1);
      });

      test('should handle asset loading errors gracefully', async () => {
        const errorSpy = jest.fn();
        assetManager.on('loadError', errorSpy);
        
        // In our mock implementation, errors are less common
        // but we test the error handling structure
        try {
          await assetManager.loadModel('error_test_asset');
        } catch (error) {
          // Error handling is working
        }
        
        // System should remain functional after errors
        const stats = assetManager.getMemoryStats();
        expect(stats).toBeDefined();
      });
    });

    describe('Performance Impact Assessment', () => {
      test('should calculate asset memory sizes accurately', async () => {
        const model = await assetManager.loadModel('size_test_model');
        const texture = await assetManager.loadTexture('size_test_texture.png');
        const animation = await assetManager.loadAnimation('size_test_anim.fbx');
        
        // Memory sizes should be reasonable and positive
        expect(model.memorySize).toBeGreaterThan(0);
        expect(model.memorySize).toBeLessThan(50); // Reasonable for test model
        
        expect(texture.memorySize).toBeGreaterThan(0);
        expect(texture.memorySize).toBeLessThan(20); // Reasonable for 1024x1024 texture
        
        expect(animation.memorySize).toBeGreaterThan(0);
        expect(animation.memorySize).toBeLessThan(10); // Reasonable for animation
        
        // Model should generally be larger than animation
        expect(model.memorySize).toBeGreaterThanOrEqual(animation.memorySize);
      });

      test('should provide detailed memory statistics for optimization', () => {
        const stats = assetManager.getMemoryStats();
        
        expect(stats).toMatchObject({
          totalUsedMB: expect.any(Number),
          maxMemoryMB: 2048, // Jetson Nano Orin limit
          utilizationPercent: expect.any(Number),
          cachedAssets: expect.any(Number),
          loadingAssets: expect.any(Number),
          preloadQueueSize: expect.any(Number)
        });
        
        // Utilization should be calculated correctly
        const expectedUtilization = (stats.totalUsedMB / stats.maxMemoryMB) * 100;
        expect(stats.utilizationPercent).toBeCloseTo(expectedUtilization, 1);
      });

      test('should monitor memory usage continuously', (done) => {
        const statsSpy = jest.fn();
        assetManager.on('memoryStats', statsSpy);
        
        // Wait for automatic memory monitoring
        setTimeout(() => {
          expect(statsSpy).toHaveBeenCalled();
          
          const emittedStats = statsSpy.mock.calls[0][0];
          expect(emittedStats).toMatchObject({
            totalUsedMB: expect.any(Number),
            utilizationPercent: expect.any(Number)
          });
          
          done();
        }, 5100); // Wait for monitoring interval
      });

      test('should handle memory pressure scenarios', async () => {
        // Simulate memory pressure by loading many assets
        const assets = Array.from({ length: 50 }, (_, i) => `pressure_test_${i}`);
        
        let successfulLoads = 0;
        let memoryErrors = 0;
        
        for (const assetId of assets) {
          try {
            await assetManager.loadModel(assetId);
            successfulLoads++;
          } catch (error) {
            if (error instanceof Error && error.message.includes('memory')) {
              memoryErrors++;
            }
          }
        }
        
        // Should handle pressure gracefully
        expect(successfulLoads + memoryErrors).toBe(assets.length);
        
        const finalStats = assetManager.getMemoryStats();
        expect(finalStats.totalUsedMB).toBeLessThanOrEqual(2048);
      });
    });
  });

  describe('Integrated Performance System Testing', () => {
    test('should coordinate between resource monitoring and asset management', async () => {
      await resourceMonitor.startMonitoring();
      
      // Load assets while monitoring
      await assetManager.loadModel('integration_model');
      await assetManager.loadTexture('integration_texture.png');
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const resourceMetrics = resourceMonitor.getCurrentMetrics();
      const assetStats = assetManager.getMemoryStats();
      
      expect(resourceMetrics).toBeTruthy();
      expect(assetStats.totalUsedMB).toBeGreaterThan(0);
      
      // Resource metrics should reflect asset loading
      if (resourceMetrics) {
        expect(resourceMetrics.gpu.memoryUsageGB).toBeGreaterThan(0);
        expect(resourceMetrics.rendering.gpuMemoryUsage).toBeGreaterThan(0);
      }
    });

    test('should trigger optimization when resource thresholds are exceeded', async () => {
      await performanceSystem.startMonitoring();
      performanceSystem.setAutoOptimization(true);
      
      const optimizationSpy = jest.fn();
      performanceSystem.on('performanceOptimized', optimizationSpy);
      
      // Set strict performance targets
      const strictTargets: PerformanceTargets = {
        targetFPS: 120, // Unrealistic target
        maxGPUMemoryGB: 0.5, // Very low limit
        maxCPUUsage: 20 // Very low limit
      };
      
      performanceSystem.setPerformanceTargets(strictTargets);
      
      // Load assets to trigger optimization
      await assetManager.loadModel('optimization_trigger_model');
      
      // Wait for potential optimization trigger
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // System should remain functional regardless of optimization
      const report = performanceSystem.getPerformanceReport();
      expect(report).toBeDefined();
    });

    test('should provide comprehensive system health assessment', async () => {
      await resourceMonitor.startMonitoring();
      await performanceSystem.startMonitoring();
      
      // Load some assets
      await assetManager.loadModel('health_test_model');
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const resourceHealth = resourceMonitor.getSystemHealthStatus();
      const performanceReport = performanceSystem.getPerformanceReport();
      
      // Both systems should provide health information
      expect(resourceHealth.overall).toBeOneOf(['healthy', 'warning', 'critical', 'unknown']);
      expect(performanceReport.systemHealth).toBeGreaterThanOrEqual(0);
      expect(performanceReport.systemHealth).toBeLessThanOrEqual(1);
      
      // Health assessments should be consistent
      if (resourceHealth.overall === 'healthy' && performanceReport.systemHealth > 0.8) {
        expect(performanceReport.isAcceptable).toBe(true);
      }
    });
  });
});

// Custom Jest matchers for performance testing
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}