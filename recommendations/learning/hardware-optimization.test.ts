/**
 * Hardware Optimization Tests
 * 
 * Tests for memory-efficient model architectures, performance monitoring,
 * and Jetson Nano Orin optimization features.
 */

import { 
  HardwareOptimizedEngine, 
  type CompressionTechnique,
  type ModelArchitecture,
  type SystemResourceMetrics
} from './hardware-optimization';
import { ModelType } from '../enums';

describe('HardwareOptimizedEngine', () => {
  let engine: HardwareOptimizedEngine;

  beforeEach(() => {
    engine = new HardwareOptimizedEngine();
  });

  afterEach(() => {
    engine.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with Jetson Nano Orin constraints', () => {
      const metrics = engine.getCurrentMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should initialize model architectures for all model types', () => {
      const architectures = engine.getAvailableArchitectures();
      expect(architectures.size).toBeGreaterThan(0);
      expect(architectures.has(ModelType.COLLABORATIVE_FILTERING)).toBe(true);
      expect(architectures.has(ModelType.CONTENT_BASED)).toBe(true);
      expect(architectures.has(ModelType.CONTEXTUAL_BANDIT)).toBe(true);
    });

    it('should initialize compression techniques', () => {
      const techniques = engine.getCompressionTechniques();
      expect(techniques.length).toBeGreaterThan(0);
      
      const quantization = techniques.find((t: CompressionTechnique) => t.type === 'quantization');
      expect(quantization).toBeDefined();
      expect(quantization?.compressionRatio).toBeLessThan(1);
      expect(quantization?.memoryReduction).toBeGreaterThan(0);
    });
  });

  describe('Model Architecture Optimization', () => {
    it('should return optimal architecture for given model type', () => {
      const architecture = engine.getOptimalModelArchitecture(ModelType.COLLABORATIVE_FILTERING);
      expect(architecture).toBeDefined();
      expect(architecture?.memoryFootprintMB).toBeLessThan(1536); // Within Jetson constraints
      expect(architecture?.inferenceLatencyMs).toBeLessThan(2000);
    });

    it('should handle unknown model types gracefully', () => {
      const architecture = engine.getOptimalModelArchitecture('UNKNOWN' as ModelType);
      expect(architecture).toBeNull();
    });
  });

  describe('Model Compression', () => {
    it('should compress model using quantization', async () => {
      const techniques = engine.getCompressionTechniques();
      const quantization = techniques.find((t: CompressionTechnique) => t.type === 'quantization');
      expect(quantization).toBeDefined();

      const result = await engine.compressModel(ModelType.COLLABORATIVE_FILTERING, quantization!);
      
      expect(result.modelType).toBe(ModelType.COLLABORATIVE_FILTERING);
      expect(result.memoryReduction).toBeGreaterThan(0);
      expect(result.performanceGain).toBeGreaterThan(0);
      expect(result.optimizationTechniques).toContain(quantization!.name);
    });

    it('should compress model using pruning', async () => {
      const techniques = engine.getCompressionTechniques();
      const pruning = techniques.find((t: CompressionTechnique) => t.type === 'pruning');
      expect(pruning).toBeDefined();

      const result = await engine.compressModel(ModelType.CONTENT_BASED, pruning!);
      
      expect(result.modelType).toBe(ModelType.CONTENT_BASED);
      expect(result.performanceGain).toBeGreaterThan(0);
      expect(result.accuracyChange).toBeGreaterThan(-10); // Less than 10% accuracy loss
    });

    it('should handle compression of non-existent model type', async () => {
      const techniques = engine.getCompressionTechniques();
      const quantization = techniques[0];

      await expect(
        engine.compressModel('INVALID' as ModelType, quantization)
      ).rejects.toThrow('Model architecture not found');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track current system metrics', () => {
      const metrics = engine.getCurrentMetrics();
      
      expect(metrics.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(metrics.cpuUsagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.gpuUsageMB).toBeGreaterThanOrEqual(0);
      expect(metrics.temperatureCelsius).toBeGreaterThan(0);
      expect(metrics.powerConsumptionWatts).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain performance history', (done) => {
      // Wait for a few monitoring cycles
      setTimeout(() => {
        const history = engine.getPerformanceHistory();
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].timestamp).toBeInstanceOf(Date);
        done();
      }, 2100); // Wait for at least 2 monitoring cycles
    });

    it('should return limited performance history when requested', (done) => {
      setTimeout(() => {
        const limitedHistory = engine.getPerformanceHistory(5);
        expect(limitedHistory.length).toBeLessThanOrEqual(5);
        done();
      }, 1100);
    });
  });

  describe('Jetson Nano Orin Specific Optimizations', () => {
    it('should respect Jetson Nano Orin memory limits', () => {
      const architectures = engine.getAvailableArchitectures();
      
      architectures.forEach((arch: ModelArchitecture, modelType: ModelType) => {
        expect(arch.memoryFootprintMB).toBeLessThan(1536); // 1.5GB limit
      });
    });

    it('should respect Jetson Nano Orin latency requirements', () => {
      const architectures = engine.getAvailableArchitectures();
      
      architectures.forEach((arch: ModelArchitecture, modelType: ModelType) => {
        expect(arch.inferenceLatencyMs).toBeLessThan(2000); // 2 second limit
      });
    });

    it('should monitor thermal performance', () => {
      const metrics = engine.getCurrentMetrics();
      expect(metrics.temperatureCelsius).toBeGreaterThan(0);
      expect(metrics.temperatureCelsius).toBeLessThan(100); // Reasonable temperature range
    });

    it('should monitor power consumption', () => {
      const metrics = engine.getCurrentMetrics();
      expect(metrics.powerConsumptionWatts).toBeGreaterThan(0);
      expect(metrics.powerConsumptionWatts).toBeLessThan(20); // Jetson power range
    });
  });

  describe('Constraint-Based Optimization', () => {
    it('should optimize for memory constraints', async () => {
      const constraints = {
        maxMemoryMB: 512,
        maxLatencyMs: 2000,
        maxConcurrentUsers: 10,
        offlineCapable: true
      };

      const result = await engine.optimizeForConstraints(constraints);
      
      expect(result.modelType).toBeDefined();
      expect(result.performanceGain).toBeGreaterThanOrEqual(0);
      expect(result.memoryReduction).toBeGreaterThanOrEqual(0);
      expect(result.optimizationTechniques).toContain('constraint-based-optimization');
    });

    it('should optimize for latency constraints', async () => {
      const constraints = {
        maxMemoryMB: 1536,
        maxLatencyMs: 500, // Very strict latency requirement
        maxConcurrentUsers: 5,
        offlineCapable: true
      };

      const result = await engine.optimizeForConstraints(constraints);
      
      expect(result.modelType).toBeDefined();
      expect(result.performanceGain).toBeGreaterThanOrEqual(0);
      expect(result.accuracyChange).toBeGreaterThan(-10); // Less than 10% accuracy loss
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cleanup gracefully', () => {
      engine.cleanup();
      
      // Should still be able to get basic metrics after cleanup
      const metrics = engine.getCurrentMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle multiple constraint updates', () => {
      engine.updateConstraints({ maxMemoryMB: 1024 });
      engine.updateConstraints({ maxCpuUsage: 50 });
      engine.updateConstraints({ maxLatencyMs: 1000 });
      
      const architecture = engine.getOptimalModelArchitecture(ModelType.COLLABORATIVE_FILTERING);
      expect(architecture).toBeDefined();
    });
  });
});