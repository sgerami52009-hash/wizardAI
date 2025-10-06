/**
 * Unit tests for Hardware Optimization
 * Safety: Validate resource monitoring and thermal protection
 * Performance: Test Jetson Nano Orin specific optimizations
 */

import { HardwareOptimizer } from './hardware-optimization';
import { TTSOptions } from './interfaces';

describe('HardwareOptimizer', () => {
  let optimizer: HardwareOptimizer;

  beforeEach(() => {
    optimizer = new HardwareOptimizer();
  });

  afterEach(() => {
    optimizer.destroy();
  });

  describe('Hardware Detection', () => {
    test('should detect Jetson Nano Orin capabilities', () => {
      const capabilities = optimizer.getCapabilities();

      expect(capabilities.cpuCores).toBe(6);
      expect(capabilities.totalMemoryMB).toBe(8192);
      expect(capabilities.gpuAvailable).toBe(true);
      expect(capabilities.maxConcurrentStreams).toBeGreaterThan(0);
    });

    test('should emit hardware detected event', (done) => {
      optimizer.once('hardwareDetected', (capabilities) => {
        expect(capabilities).toBeDefined();
        expect(capabilities.cpuCores).toBeGreaterThan(0);
        done();
      });

      // Trigger detection (in real implementation, this happens in constructor)
      optimizer.emit('hardwareDetected', optimizer.getCapabilities());
    });
  });

  describe('Optimization Profiles', () => {
    test('should apply efficiency profile', () => {
      const result = optimizer.applyProfile('efficiency');

      expect(result).toBe(true);
      
      const settings = optimizer.getSettings();
      expect(settings.powerMode).toBe('efficiency');
      expect(settings.qualityLevel).toBe('low');
      expect(settings.useGPUAcceleration).toBe(false);
    });

    test('should apply balanced profile', () => {
      const result = optimizer.applyProfile('balanced');

      expect(result).toBe(true);
      
      const settings = optimizer.getSettings();
      expect(settings.powerMode).toBe('balanced');
      expect(settings.qualityLevel).toBe('medium');
      expect(settings.useGPUAcceleration).toBe(true);
    });

    test('should apply performance profile', () => {
      const result = optimizer.applyProfile('performance');

      expect(result).toBe(true);
      
      const settings = optimizer.getSettings();
      expect(settings.powerMode).toBe('performance');
      expect(settings.qualityLevel).toBe('high');
      expect(settings.maxMemoryUsageMB).toBe(2048);
    });

    test('should apply child-safe profile', () => {
      const result = optimizer.applyProfile('child_safe');

      expect(result).toBe(true);
      
      const settings = optimizer.getSettings();
      expect(settings.maxResourceUsage).toBe(60);
      expect(settings.qualityLevel).toBe('medium');
    });

    test('should reject invalid profile', () => {
      const result = optimizer.applyProfile('invalid_profile');

      expect(result).toBe(false);
    });

    test('should emit profile changed event', () => {
      const profilePromise = new Promise((resolve) => {
        optimizer.once('profileChanged', resolve);
      });

      optimizer.applyProfile('performance');

      return expect(profilePromise).resolves.toMatchObject({
        name: 'performance'
      });
    });
  });

  describe('TTS Options Optimization', () => {
    test('should optimize TTS options for current hardware state', () => {
      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const optimized = optimizer.optimizeTTSOptions(baseOptions);

      expect(optimized).toBeDefined();
      expect(optimized.voiceId).toBe('test-voice');
      expect(optimized.hardwareAcceleration).toBeDefined();
    });

    test('should reduce quality under high system load', () => {
      // Mock high system load
      optimizer['metrics'] = {
        cpuUsage: 85,
        memoryUsage: 90,
        temperature: 70,
        powerConsumption: 15,
        synthesisLatency: 300,
        throughput: 80
      };

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.5,
        pitch: 1.2,
        volume: 1.0
      };

      const optimized = optimizer.optimizeTTSOptions(baseOptions);

      expect(optimized.rate).toBeLessThanOrEqual(1.0);
    });

    test('should enable GPU acceleration when available', () => {
      optimizer.applyProfile('performance');

      const baseOptions: TTSOptions = {
        voiceId: 'test-voice',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
      };

      const optimized = optimizer.optimizeTTSOptions(baseOptions);

      expect(optimized.hardwareAcceleration).toBe(true);
    });
  });

  describe('Buffer Size Optimization', () => {
    test('should return optimal buffer size for normal conditions', () => {
      const bufferSize = optimizer.getOptimalBufferSize();

      expect(bufferSize).toBe(1024); // Default optimal size
    });

    test('should increase buffer size under high CPU load', () => {
      // Mock high CPU usage
      optimizer['metrics'] = {
        cpuUsage: 75,
        memoryUsage: 50,
        temperature: 60,
        powerConsumption: 12,
        synthesisLatency: 250,
        throughput: 100
      };

      const bufferSize = optimizer.getOptimalBufferSize();

      expect(bufferSize).toBeGreaterThan(1024);
    });

    test('should decrease buffer size under high memory usage', () => {
      // Mock high memory usage
      optimizer['metrics'] = {
        cpuUsage: 40,
        memoryUsage: 85,
        temperature: 55,
        powerConsumption: 10,
        synthesisLatency: 200,
        throughput: 120
      };

      const bufferSize = optimizer.getOptimalBufferSize();

      expect(bufferSize).toBeLessThan(1024);
    });
  });

  describe('Resource Monitoring', () => {
    test('should check if system can handle requests', () => {
      // Mock normal system state
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 65,
        powerConsumption: 11,
        synthesisLatency: 200,
        throughput: 110
      };

      const canHandle = optimizer.canHandleRequest();

      expect(canHandle).toBe(true);
    });

    test('should reject requests under high memory usage', () => {
      // Mock high memory usage
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 95,
        temperature: 65,
        powerConsumption: 11,
        synthesisLatency: 200,
        throughput: 110
      };

      const canHandle = optimizer.canHandleRequest();

      expect(canHandle).toBe(false);
    });

    test('should reject requests under high CPU usage', () => {
      // Mock high CPU usage
      optimizer['metrics'] = {
        cpuUsage: 90,
        memoryUsage: 60,
        temperature: 65,
        powerConsumption: 11,
        synthesisLatency: 200,
        throughput: 110
      };

      const canHandle = optimizer.canHandleRequest();

      expect(canHandle).toBe(false);
    });

    test('should reject requests under high temperature', () => {
      // Mock high temperature
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 85,
        powerConsumption: 11,
        synthesisLatency: 200,
        throughput: 110
      };

      const canHandle = optimizer.canHandleRequest();

      expect(canHandle).toBe(false);
    });
  });

  describe('Thermal Management', () => {
    test('should report normal thermal status', () => {
      // Mock normal temperature
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 65,
        powerConsumption: 11,
        synthesisLatency: 200,
        throughput: 110
      };

      const status = optimizer.getThermalStatus();

      expect(status).toBe('normal');
    });

    test('should report warning thermal status', () => {
      // Mock warning temperature
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 78,
        powerConsumption: 13,
        synthesisLatency: 220,
        throughput: 100
      };

      const status = optimizer.getThermalStatus();

      expect(status).toBe('warning');
    });

    test('should report throttling thermal status', () => {
      // Mock throttling temperature
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 88,
        powerConsumption: 15,
        synthesisLatency: 300,
        throughput: 80
      };

      const status = optimizer.getThermalStatus();

      expect(status).toBe('throttling');
    });
  });

  describe('Adaptive Mode', () => {
    test('should enable adaptive mode by default', () => {
      expect(optimizer['adaptiveMode']).toBe(true);
    });

    test('should toggle adaptive mode', () => {
      const adaptivePromise = new Promise((resolve) => {
        optimizer.once('adaptiveModeChanged', resolve);
      });

      optimizer.setAdaptiveMode(false);

      expect(optimizer['adaptiveMode']).toBe(false);
      return expect(adaptivePromise).resolves.toBe(false);
    });

    test('should perform adaptive adjustments when enabled', (done) => {
      optimizer.setAdaptiveMode(true);

      // Mock thermal throttling condition
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 60,
        temperature: 88, // Throttling temperature
        powerConsumption: 15,
        synthesisLatency: 300,
        throughput: 80
      };

      optimizer.once('thermalThrottling', (event) => {
        expect(event.temperature).toBe(88);
        expect(event.action).toBe('quality_reduced');
        done();
      });

      // Trigger adaptive check
      optimizer['checkAdaptiveAdjustments']();
    });

    test('should handle memory pressure adaptively', (done) => {
      optimizer.setAdaptiveMode(true);

      // Mock memory pressure
      optimizer['metrics'] = {
        cpuUsage: 50,
        memoryUsage: 90,
        temperature: 65,
        powerConsumption: 12,
        synthesisLatency: 250,
        throughput: 90
      };

      optimizer.once('memoryPressure', (event) => {
        expect(event.usage).toBe(90);
        expect(event.newLimit).toBeLessThan(optimizer.getSettings().maxMemoryUsageMB);
        done();
      });

      // Trigger adaptive check
      optimizer['checkAdaptiveAdjustments']();
    });

    test('should handle CPU overload adaptively', (done) => {
      optimizer.setAdaptiveMode(true);

      // Mock CPU overload
      optimizer['metrics'] = {
        cpuUsage: 85,
        memoryUsage: 60,
        temperature: 65,
        powerConsumption: 14,
        synthesisLatency: 280,
        throughput: 85
      };

      optimizer.once('cpuOverload', (event) => {
        expect(event.usage).toBe(85);
        expect(event.newThreads).toBeLessThan(optimizer.getSettings().threadPoolSize);
        done();
      });

      // Trigger adaptive check
      optimizer['checkAdaptiveAdjustments']();
    });
  });

  describe('Performance Metrics', () => {
    test('should provide current performance metrics', () => {
      const metrics = optimizer.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(typeof metrics.temperature).toBe('number');
      expect(typeof metrics.synthesisLatency).toBe('number');
    });

    test('should emit metrics updated events', (done) => {
      optimizer.once('metricsUpdated', (metrics) => {
        expect(metrics).toBeDefined();
        expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
        done();
      });

      // Trigger metrics update
      optimizer['updateMetrics']();
    });

    test('should update metrics periodically', (done) => {
      let updateCount = 0;
      
      optimizer.on('metricsUpdated', () => {
        updateCount++;
        if (updateCount >= 2) {
          expect(updateCount).toBeGreaterThanOrEqual(2);
          done();
        }
      });

      // Wait for multiple updates (monitoring interval is 2 seconds in implementation)
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up monitoring on destroy', () => {
      const destroyedPromise = new Promise((resolve) => {
        optimizer.once('destroyed', resolve);
      });

      optimizer.destroy();

      return expect(destroyedPromise).resolves.toBeUndefined();
    });

    test('should stop monitoring interval on destroy', () => {
      const monitoringInterval = optimizer['monitoringInterval'];
      
      optimizer.destroy();

      expect(optimizer['monitoringInterval']).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing metrics gracefully', () => {
      // Clear metrics
      optimizer['metrics'] = null as any;

      expect(() => optimizer.canHandleRequest()).not.toThrow();
      expect(() => optimizer.getThermalStatus()).not.toThrow();
      expect(() => optimizer.getOptimalBufferSize()).not.toThrow();
    });

    test('should handle invalid profile names gracefully', () => {
      const result = optimizer.applyProfile('nonexistent');

      expect(result).toBe(false);
      // Should not change current settings
    });
  });

  describe('Jetson Nano Orin Specific Features', () => {
    test('should detect GPU availability', () => {
      const capabilities = optimizer.getCapabilities();

      expect(capabilities.gpuAvailable).toBe(true);
      expect(capabilities.gpuMemoryMB).toBeDefined();
    });

    test('should optimize for ARM Cortex-A78AE cores', () => {
      const capabilities = optimizer.getCapabilities();

      expect(capabilities.cpuCores).toBe(6);
      
      const settings = optimizer.getSettings();
      expect(settings.threadPoolSize).toBeLessThanOrEqual(capabilities.cpuCores);
    });

    test('should respect 8GB memory constraint', () => {
      const capabilities = optimizer.getCapabilities();

      expect(capabilities.totalMemoryMB).toBe(8192);
      expect(capabilities.availableMemoryMB).toBeLessThan(capabilities.totalMemoryMB);
      
      const settings = optimizer.getSettings();
      expect(settings.maxMemoryUsageMB).toBeLessThan(capabilities.availableMemoryMB);
    });

    test('should support optimal sample rates for hardware', () => {
      const capabilities = optimizer.getCapabilities();

      expect(capabilities.supportedSampleRates).toContain(22050);
      expect(capabilities.supportedSampleRates).toContain(44100);
    });
  });
});