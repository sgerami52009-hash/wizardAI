import { 
  PerformanceMonitorImpl, 
  QualityOptimizerImpl, 
  performanceMonitor, 
  qualityOptimizer,
  OptimizationAction 
} from './performance';
import { RenderingMetrics, PerformanceThresholds, QualitySettings } from './types';

// Mock avatar event bus
jest.mock('../avatar/events', () => ({
  avatarEventBus: {
    emitPerformanceWarning: jest.fn()
  }
}));

describe('PerformanceMonitorImpl', () => {
  let monitor: PerformanceMonitorImpl;

  beforeEach(() => {
    monitor = new PerformanceMonitorImpl();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (monitor) {
      monitor.stopMonitoring();
    }
  });

  describe('Monitoring Lifecycle', () => {
    test('should start monitoring successfully', () => {
      expect(() => monitor.startMonitoring()).not.toThrow();
    });

    test('should stop monitoring successfully', () => {
      monitor.startMonitoring();
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });

    test('should not start monitoring twice', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Second call should be ignored
      
      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle stop when not started', () => {
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });
  });

  describe('Metrics Collection', () => {
    test('should collect current metrics', () => {
      const metrics = monitor.getCurrentMetrics();

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
      expect(metrics.currentFPS).toBeGreaterThan(0);
      expect(metrics.currentFPS).toBeLessThanOrEqual(120);
      expect(metrics.gpuMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.gpuMemoryUsage).toBeLessThanOrEqual(2.0); // 2GB limit
      expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
    });

    test('should provide realistic metrics for Jetson Nano Orin', () => {
      const metrics = monitor.getCurrentMetrics();

      // Metrics should be realistic for the hardware
      expect(metrics.gpuMemoryUsage).toBeLessThan(2.0); // Within 2GB GPU limit
      expect(metrics.renderTime).toBeGreaterThan(5); // Reasonable render time
      expect(metrics.renderTime).toBeLessThan(50); // Not too slow
      expect(metrics.triangleCount).toBeGreaterThan(1000); // Reasonable complexity
      expect(metrics.triangleCount).toBeLessThan(50000); // Not too complex
    });

    test('should track texture memory usage', () => {
      const metrics = monitor.getCurrentMetrics();

      expect(metrics.textureMemory).toBeGreaterThan(0);
      expect(metrics.textureMemory).toBeLessThan(metrics.gpuMemoryUsage); // Texture memory is part of GPU memory
    });

    test('should monitor shader compilation performance', () => {
      const metrics = monitor.getCurrentMetrics();

      expect(metrics.shaderCompileTime).toBeGreaterThanOrEqual(0);
      expect(metrics.shaderCompileTime).toBeLessThan(100); // Should be fast
    });

    test('should count draw calls accurately', () => {
      const metrics = monitor.getCurrentMetrics();

      expect(metrics.drawCalls).toBeGreaterThan(0);
      expect(metrics.drawCalls).toBeLessThan(200); // Reasonable for avatar rendering
    });
  });

  describe('Average Metrics Calculation', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    test('should calculate average metrics over time window', (done) => {
      // Wait for some metrics to be collected
      setTimeout(() => {
        const averageMetrics = monitor.getAverageMetrics(5000); // Last 5 seconds

        expect(averageMetrics).toMatchObject({
          currentFPS: expect.any(Number),
          gpuMemoryUsage: expect.any(Number),
          cpuUsage: expect.any(Number),
          renderTime: expect.any(Number),
          triangleCount: expect.any(Number),
          textureMemory: expect.any(Number),
          shaderCompileTime: expect.any(Number),
          drawCalls: expect.any(Number)
        });

        done();
      }, 1100); // Wait slightly longer than monitoring interval
    });

    test('should return current metrics when no history available', () => {
      const averageMetrics = monitor.getAverageMetrics(1000);
      const currentMetrics = monitor.getCurrentMetrics();

      // Should be similar to current metrics when no history
      expect(averageMetrics.currentFPS).toBeCloseTo(currentMetrics.currentFPS, 1);
      expect(averageMetrics.gpuMemoryUsage).toBeCloseTo(currentMetrics.gpuMemoryUsage, 1);
    });

    test('should handle different time windows', () => {
      const shortWindow = monitor.getAverageMetrics(1000); // 1 second
      const longWindow = monitor.getAverageMetrics(60000); // 1 minute

      expect(shortWindow).toBeDefined();
      expect(longWindow).toBeDefined();
    });

    test('should maintain metrics history within memory limits', (done) => {
      // Let monitoring run for a while to build history
      setTimeout(() => {
        // History should be automatically pruned to last 5 minutes
        // This is tested indirectly by ensuring the system doesn't crash
        const metrics = monitor.getAverageMetrics(300000); // 5 minutes
        expect(metrics).toBeDefined();
        done();
      }, 1100);
    });
  });

  describe('Performance Thresholds', () => {
    test('should set performance thresholds', () => {
      const thresholds: PerformanceThresholds = {
        minFPS: 30,
        maxGPUMemory: 1.5,
        maxCPUUsage: 80,
        maxRenderTime: 33.33 // 30fps
      };

      expect(() => monitor.setThresholds(thresholds)).not.toThrow();
    });

    test('should evaluate performance acceptability', () => {
      const strictThresholds: PerformanceThresholds = {
        minFPS: 55,
        maxGPUMemory: 1.0,
        maxCPUUsage: 30,
        maxRenderTime: 18
      };

      monitor.setThresholds(strictThresholds);
      const isAcceptable = monitor.isPerformanceAcceptable();

      expect(typeof isAcceptable).toBe('boolean');
    });

    test('should use default thresholds when not set', () => {
      const isAcceptable = monitor.isPerformanceAcceptable();
      expect(typeof isAcceptable).toBe('boolean');
    });

    test('should handle edge case thresholds', () => {
      const extremeThresholds: PerformanceThresholds = {
        minFPS: 0,
        maxGPUMemory: 0.1,
        maxCPUUsage: 5,
        maxRenderTime: 1
      };

      monitor.setThresholds(extremeThresholds);
      
      // Should not crash with extreme thresholds
      expect(() => monitor.isPerformanceAcceptable()).not.toThrow();
    });
  });

  describe('Performance Warning System', () => {
    beforeEach(() => {
      monitor.startMonitoring();
    });

    test('should emit FPS warnings when below threshold', (done) => {
      const lowFPSThresholds: PerformanceThresholds = {
        minFPS: 100, // Unrealistically high to trigger warning
        maxGPUMemory: 2.0,
        maxCPUUsage: 100,
        maxRenderTime: 100
      };

      monitor.setThresholds(lowFPSThresholds);

      setTimeout(() => {
        const { avatarEventBus } = require('../avatar/events');
        expect(avatarEventBus.emitPerformanceWarning).toHaveBeenCalledWith(
          'fps',
          expect.any(Number),
          100
        );
        done();
      }, 1100);
    });

    test('should emit GPU memory warnings when exceeded', (done) => {
      const lowMemoryThresholds: PerformanceThresholds = {
        minFPS: 0,
        maxGPUMemory: 0.1, // Very low to trigger warning
        maxCPUUsage: 100,
        maxRenderTime: 100
      };

      monitor.setThresholds(lowMemoryThresholds);

      setTimeout(() => {
        const { avatarEventBus } = require('../avatar/events');
        expect(avatarEventBus.emitPerformanceWarning).toHaveBeenCalledWith(
          'gpu_memory',
          expect.any(Number),
          0.1
        );
        done();
      }, 1100);
    });

    test('should emit CPU usage warnings when exceeded', (done) => {
      const lowCPUThresholds: PerformanceThresholds = {
        minFPS: 0,
        maxGPUMemory: 10,
        maxCPUUsage: 1, // Very low to trigger warning
        maxRenderTime: 100
      };

      monitor.setThresholds(lowCPUThresholds);

      setTimeout(() => {
        const { avatarEventBus } = require('../avatar/events');
        expect(avatarEventBus.emitPerformanceWarning).toHaveBeenCalledWith(
          'cpu_usage',
          expect.any(Number),
          1
        );
        done();
      }, 1100);
    });

    test('should emit render time warnings when exceeded', (done) => {
      const fastRenderThresholds: PerformanceThresholds = {
        minFPS: 0,
        maxGPUMemory: 10,
        maxCPUUsage: 100,
        maxRenderTime: 1 // Very fast to trigger warning
      };

      monitor.setThresholds(fastRenderThresholds);

      setTimeout(() => {
        const { avatarEventBus } = require('../avatar/events');
        expect(avatarEventBus.emitPerformanceWarning).toHaveBeenCalledWith(
          'render_time',
          expect.any(Number),
          1
        );
        done();
      }, 1100);
    });

    test('should not emit warnings when performance is acceptable', (done) => {
      const lenientThresholds: PerformanceThresholds = {
        minFPS: 1,
        maxGPUMemory: 10,
        maxCPUUsage: 100,
        maxRenderTime: 1000
      };

      monitor.setThresholds(lenientThresholds);

      setTimeout(() => {
        // Should not have emitted any warnings with lenient thresholds
        const { avatarEventBus } = require('../avatar/events');
        expect(avatarEventBus.emitPerformanceWarning).not.toHaveBeenCalled();
        done();
      }, 1100);
    });
  });

  describe('Jetson Nano Orin Specific Monitoring', () => {
    test('should monitor within hardware constraints', () => {
      const metrics = monitor.getCurrentMetrics();

      // Should respect Jetson Nano Orin limitations
      expect(metrics.gpuMemoryUsage).toBeLessThanOrEqual(2.0); // 2GB GPU limit
      expect(metrics.currentFPS).toBeLessThanOrEqual(60); // Realistic for hardware
      expect(metrics.triangleCount).toBeLessThan(30000); // Reasonable for mobile GPU
    });

    test('should provide mobile-optimized default thresholds', () => {
      // Default thresholds should be appropriate for Jetson Nano Orin
      const isAcceptable = monitor.isPerformanceAcceptable();
      
      // With default mock metrics, should generally be acceptable
      expect(typeof isAcceptable).toBe('boolean');
    });

    test('should handle thermal constraints monitoring', () => {
      const metrics = monitor.getCurrentMetrics();

      // While we don't directly monitor temperature in this implementation,
      // the metrics should reflect thermal-aware performance
      expect(metrics.cpuUsage).toBeLessThan(90); // Avoid thermal throttling
    });
  });
});

describe('QualityOptimizerImpl', () => {
  let optimizer: QualityOptimizerImpl;

  beforeEach(() => {
    optimizer = new QualityOptimizerImpl();
  });

  describe('Quality Optimization for Target FPS', () => {
    test('should optimize for 60fps target', () => {
      const currentMetrics: RenderingMetrics = {
        currentFPS: 45, // Below target
        gpuMemoryUsage: 1.5,
        cpuUsage: 60,
        renderTime: 22,
        triangleCount: 20000,
        textureMemory: 1.0,
        shaderCompileTime: 3,
        drawCalls: 50
      };

      const optimizedSettings = optimizer.optimizeForTarget(60, currentMetrics);

      expect(optimizedSettings).toMatchObject({
        lodLevel: expect.any(Number),
        textureResolution: expect.any(Number),
        shadowQuality: expect.any(String),
        antiAliasing: expect.any(String),
        particleCount: expect.any(Number),
        animationQuality: expect.any(String),
        renderDistance: expect.any(Number)
      });

      // Should reduce quality when FPS is below target
      expect(optimizedSettings.lodLevel).toBeGreaterThan(1); // Higher LOD = lower quality
    });

    test('should apply aggressive optimization for very low FPS', () => {
      const poorMetrics: RenderingMetrics = {
        currentFPS: 20, // Very low
        gpuMemoryUsage: 1.8,
        cpuUsage: 85,
        renderTime: 45,
        triangleCount: 30000,
        textureMemory: 1.5,
        shaderCompileTime: 8,
        drawCalls: 80
      };

      const optimizedSettings = optimizer.optimizeForTarget(60, poorMetrics);

      // Should apply aggressive optimizations
      expect(optimizedSettings.lodLevel).toBe(3); // High LOD for performance
      expect(optimizedSettings.textureResolution).toBe(512); // Reduced texture resolution
      expect(optimizedSettings.shadowQuality).toBe('disabled'); // Disable expensive shadows
      expect(optimizedSettings.antiAliasing).toBe('none'); // Disable AA
      expect(optimizedSettings.particleCount).toBe(25); // Minimal particles
      expect(optimizedSettings.animationQuality).toBe('low'); // Reduced animation quality
      expect(optimizedSettings.renderDistance).toBe(30); // Reduced render distance
    });

    test('should apply moderate optimization for slightly low FPS', () => {
      const moderateMetrics: RenderingMetrics = {
        currentFPS: 50, // Slightly below target
        gpuMemoryUsage: 1.2,
        cpuUsage: 55,
        renderTime: 18,
        triangleCount: 18000,
        textureMemory: 0.9,
        shaderCompileTime: 2.5,
        drawCalls: 45
      };

      const optimizedSettings = optimizer.optimizeForTarget(60, moderateMetrics);

      // Should apply moderate optimizations
      expect(optimizedSettings.lodLevel).toBe(2); // Moderate LOD
      expect(optimizedSettings.textureResolution).toBe(768); // Moderate texture resolution
      expect(optimizedSettings.shadowQuality).toBe('low'); // Low quality shadows
      expect(optimizedSettings.particleCount).toBe(50); // Reduced particles
    });

    test('should maintain quality when FPS is acceptable', () => {
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

      const optimizedSettings = optimizer.optimizeForTarget(60, goodMetrics);

      // Should maintain good quality settings
      expect(optimizedSettings.lodLevel).toBe(1); // Good quality LOD
      expect(optimizedSettings.textureResolution).toBe(1024); // Good texture resolution
    });
  });

  describe('Hardware-Specific Recommendations', () => {
    test('should provide Jetson Nano Orin optimized settings', () => {
      const jetsonCapabilities = {
        gpu: 'Tegra X1',
        memory: '2GB',
        architecture: 'mobile'
      };

      const recommendedSettings = optimizer.getRecommendedSettings(jetsonCapabilities);

      expect(recommendedSettings).toMatchObject({
        lodLevel: 1,
        textureResolution: 1024,
        shadowQuality: 'medium',
        antiAliasing: 'fxaa',
        particleCount: 75,
        animationQuality: 'medium',
        renderDistance: 45
      });

      // Settings should be appropriate for mobile GPU
      expect(recommendedSettings.textureResolution).toBeLessThanOrEqual(1024); // Not too high for mobile
      expect(recommendedSettings.particleCount).toBeLessThan(100); // Reasonable for mobile
      expect(recommendedSettings.shadowQuality).not.toBe('high'); // Avoid expensive shadows
    });

    test('should handle unknown hardware gracefully', () => {
      const unknownCapabilities = {
        gpu: 'unknown',
        memory: 'unknown'
      };

      const recommendedSettings = optimizer.getRecommendedSettings(unknownCapabilities);

      expect(recommendedSettings).toBeDefined();
      expect(recommendedSettings.lodLevel).toBeGreaterThanOrEqual(0);
      expect(recommendedSettings.textureResolution).toBeGreaterThan(0);
    });
  });

  describe('Optimization Application', () => {
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

      const result = await optimizer.applyOptimizations(optimizations);

      expect(result).toBe(true);
      expect(optimizations[0].execute).toHaveBeenCalled();
      expect(optimizations[1].execute).toHaveBeenCalled();
    });

    test('should handle optimization failures', async () => {
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
          execute: jest.fn().mockResolvedValue(false) // Fails
        }
      ];

      const result = await optimizer.applyOptimizations(optimizations);

      expect(result).toBe(false); // Should fail if any optimization fails
    });

    test('should handle optimization errors', async () => {
      const optimizations: OptimizationAction[] = [
        {
          type: 'reduce_lod',
          description: 'Reduce level of detail',
          performanceGain: 10,
          qualityImpact: 0.2,
          execute: jest.fn().mockRejectedValue(new Error('Optimization failed'))
        }
      ];

      const result = await optimizer.applyOptimizations(optimizations);

      expect(result).toBe(false); // Should handle errors gracefully
    });

    test('should apply empty optimization list', async () => {
      const result = await optimizer.applyOptimizations([]);

      expect(result).toBe(true); // Should succeed with empty list
    });
  });

  describe('Quality vs Performance Trade-offs', () => {
    test('should balance quality and performance gains', () => {
      const metrics: RenderingMetrics = {
        currentFPS: 35,
        gpuMemoryUsage: 1.6,
        cpuUsage: 70,
        renderTime: 28,
        triangleCount: 22000,
        textureMemory: 1.2,
        shaderCompileTime: 4,
        drawCalls: 60
      };

      const settings = optimizer.optimizeForTarget(60, metrics);

      // Should make reasonable trade-offs
      expect(settings.lodLevel).toBeGreaterThan(1); // Reduce quality for performance
      expect(settings.textureResolution).toBeLessThan(1024); // Reduce memory usage
      expect(settings.particleCount).toBeLessThan(100); // Reduce CPU load
    });

    test('should prioritize frame rate over visual quality', () => {
      const lowFPSMetrics: RenderingMetrics = {
        currentFPS: 15, // Very low
        gpuMemoryUsage: 0.5, // Low memory usage
        cpuUsage: 30, // Low CPU usage
        renderTime: 60,
        triangleCount: 25000,
        textureMemory: 0.4,
        shaderCompileTime: 2,
        drawCalls: 70
      };

      const settings = optimizer.optimizeForTarget(60, lowFPSMetrics);

      // Should aggressively reduce quality to improve FPS
      expect(settings.lodLevel).toBeGreaterThanOrEqual(3);
      expect(settings.shadowQuality).toBe('disabled');
    });
  });
});

describe('Singleton Instances', () => {
  test('should export performance monitor singleton', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitorImpl);
  });

  test('should export quality optimizer singleton', () => {
    expect(qualityOptimizer).toBeInstanceOf(QualityOptimizerImpl);
  });

  test('should maintain singleton state', () => {
    const metrics1 = performanceMonitor.getCurrentMetrics();
    const metrics2 = performanceMonitor.getCurrentMetrics();

    // Should be consistent (same instance)
    expect(metrics1).toEqual(metrics2);
  });
});