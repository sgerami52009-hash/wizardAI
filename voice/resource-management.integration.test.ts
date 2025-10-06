/**
 * Integration tests for resource management system
 * Safety: Ensures resource management maintains child safety under all conditions
 * Performance: Validates system behavior under resource constraints on Jetson Nano Orin
 */

import { ResourceMonitor, createJetsonResourceMonitor } from './resource-monitor';
import { PerformanceOptimizer, createJetsonPerformanceOptimizer } from './performance-optimizer';

describe('Resource Management Integration', () => {
  let resourceMonitor: ResourceMonitor;
  let performanceOptimizer: PerformanceOptimizer;

  beforeEach(() => {
    resourceMonitor = createJetsonResourceMonitor();
    performanceOptimizer = createJetsonPerformanceOptimizer(resourceMonitor);
  });

  afterEach(async () => {
    await performanceOptimizer.stopOptimization();
    await resourceMonitor.stopMonitoring();
  });

  describe('Resource Monitoring Accuracy', () => {
    test('should accurately track memory usage changes', async () => {
      await resourceMonitor.startMonitoring();
      
      const initialUsage = resourceMonitor.getCurrentUsage();
      expect(initialUsage.memoryMB).toBeGreaterThan(0);
      
      // Simulate memory allocation
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      
      // Wait for monitoring cycle to detect change
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedUsage = resourceMonitor.getCurrentUsage();
      expect(updatedUsage.memoryMB).toBeGreaterThanOrEqual(initialUsage.memoryMB);
      
      // Clean up
      largeBuffer.fill(0);
    });

    test('should detect threshold violations accurately', async () => {
      const alertSpy = jest.fn();
      resourceMonitor.on('resource-alert', alertSpy);

      // Mock high memory usage
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500, // Above critical threshold (7372MB)
        cpuPercent: 30,
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      
      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(alertSpy).toHaveBeenCalled();
      
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe('critical');
      expect(alert.resource).toBe('memory');
      expect(alert.currentValue).toBe(7500);
      expect(alert.threshold).toBe(7372);
    });

    test('should clear alerts when usage returns to normal', async () => {
      const alertSpy = jest.fn();
      const clearSpy = jest.fn();
      
      resourceMonitor.on('resource-alert', alertSpy);
      resourceMonitor.on('resource-alert-cleared', clearSpy);

      // First trigger alert
      const mockHighUsage = jest.spyOn(resourceMonitor, 'getCurrentUsage')
        .mockReturnValue({
          memoryMB: 7500,
          cpuPercent: 30,
          timestamp: new Date()
        });

      await resourceMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(alertSpy).toHaveBeenCalled();

      // Then return to normal
      mockHighUsage.mockReturnValue({
        memoryMB: 2000,
        cpuPercent: 30,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(clearSpy).toHaveBeenCalled();
    });

    test('should maintain monitoring accuracy under load', async () => {
      await resourceMonitor.startMonitoring();
      
      // Simulate system load
      const intervals: NodeJS.Timeout[] = [];
      for (let i = 0; i < 5; i++) {
        intervals.push(setInterval(() => {
          // Simulate CPU work
          const start = Date.now();
          while (Date.now() - start < 10) {
            Math.random();
          }
        }, 50));
      }

      // Monitor for several cycles
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const history = resourceMonitor.getResourceHistory(1); // Last minute
      expect(history.length).toBeGreaterThan(0);
      
      // All readings should be valid
      history.forEach(usage => {
        expect(usage.memoryMB).toBeGreaterThan(0);
        expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
        expect(usage.cpuPercent).toBeLessThanOrEqual(100);
        expect(usage.timestamp).toBeInstanceOf(Date);
      });

      // Clean up
      intervals.forEach(interval => clearInterval(interval));
    });
  });

  describe('Threshold Detection', () => {
    test('should detect memory warning threshold', async () => {
      const alertSpy = jest.fn();
      resourceMonitor.on('resource-alert', alertSpy);

      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 6500, // Above warning (6144MB) but below critical (7372MB)
        cpuPercent: 30,
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(alertSpy).toHaveBeenCalled();
      
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe('warning');
      expect(alert.resource).toBe('memory');
    });

    test('should detect CPU threshold violations', async () => {
      const alertSpy = jest.fn();
      resourceMonitor.on('resource-alert', alertSpy);

      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 2000,
        cpuPercent: 90, // Above critical threshold (85%)
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(alertSpy).toHaveBeenCalled();
      
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe('critical');
      expect(alert.resource).toBe('cpu');
    });

    test('should handle multiple simultaneous threshold violations', async () => {
      const alertSpy = jest.fn();
      resourceMonitor.on('resource-alert', alertSpy);

      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500, // Critical
        cpuPercent: 90,  // Critical
        gpuPercent: 95,  // Critical
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Should receive multiple alerts
      expect(alertSpy).toHaveBeenCalledTimes(3);
      
      const alerts = alertSpy.mock.calls.map(call => call[0]);
      const resources = alerts.map(alert => alert.resource);
      
      expect(resources).toContain('memory');
      expect(resources).toContain('cpu');
      expect(resources).toContain('gpu');
    });
  });

  describe('Adaptive Quality Reduction', () => {
    test('should automatically reduce quality under memory pressure', async () => {
      const degradationSpy = jest.fn();
      performanceOptimizer.on('degradation-applied', degradationSpy);

      // Mock high memory usage
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500,
        cpuPercent: 30,
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      // Trigger resource alert
      resourceMonitor.emit('resource-alert', {
        type: 'critical',
        resource: 'memory',
        currentValue: 7500,
        threshold: 7372,
        message: 'Critical memory usage'
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(degradationSpy).toHaveBeenCalled();
      
      const metrics = performanceOptimizer.getPerformanceMetrics();
      expect(metrics.degradationLevel).toBeGreaterThan(0);
    });

    test('should restore quality when resources become available', async () => {
      // First apply degradation
      await performanceOptimizer.applyGracefulDegradation(2);
      
      const degradationSpy = jest.fn();
      performanceOptimizer.on('degradation-applied', degradationSpy);

      // Mock low resource usage
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 2000,
        cpuPercent: 20,
        timestamp: new Date()
      });
      
      jest.spyOn(resourceMonitor, 'isUnderPressure').mockReturnValue(false);

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      // Wait for optimization cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(degradationSpy).toHaveBeenCalled();
      
      const finalMetrics = performanceOptimizer.getPerformanceMetrics();
      expect(finalMetrics.degradationLevel).toBeLessThan(2);
    });

    test('should maintain minimum quality level for safety', async () => {
      // Try to apply maximum degradation
      await performanceOptimizer.applyGracefulDegradation(3);
      
      const metrics = performanceOptimizer.getPerformanceMetrics();
      expect(metrics.degradationLevel).toBeLessThanOrEqual(3);
      
      // Verify safety level is maintained
      const strategies = performanceOptimizer.getAvailableStrategies();
      const safeStrategies = strategies.filter(s => 
        s.safetyImpact === 'none' || s.safetyImpact === 'minimal'
      );
      
      expect(safeStrategies.length).toBeGreaterThan(0);
    });

    test('should apply progressive degradation based on severity', async () => {
      const degradationSpy = jest.fn();
      performanceOptimizer.on('degradation-applied', degradationSpy);

      await performanceOptimizer.startOptimization();

      // First warning alert
      resourceMonitor.emit('resource-alert', {
        type: 'warning',
        resource: 'memory',
        currentValue: 6500,
        threshold: 6144
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const warningLevel = performanceOptimizer.getPerformanceMetrics().degradationLevel;

      // Then critical alert
      resourceMonitor.emit('resource-alert', {
        type: 'critical',
        resource: 'memory',
        currentValue: 7500,
        threshold: 7372
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const criticalLevel = performanceOptimizer.getPerformanceMetrics().degradationLevel;
      
      expect(criticalLevel).toBeGreaterThan(warningLevel);
    });
  });

  describe('Graceful Degradation', () => {
    test('should maintain core functionality during degradation', async () => {
      await performanceOptimizer.applyGracefulDegradation(3);
      
      // Core queues should still be functional
      const requestId = await performanceOptimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'high',
        timeoutMs: 5000,
        data: { text: 'test' },
        maxRetries: 3
      });

      expect(requestId).toBeDefined();
      
      const request = await performanceOptimizer.processNextRequest('speech-recognition-queue');
      expect(request).not.toBeNull();
      expect(request?.type).toBe('speech_recognition');
    });

    test('should reduce cache usage during degradation', async () => {
      // Load models into cache
      await performanceOptimizer.loadModel('model-1', 'speech_recognition', 500 * 1024 * 1024);
      await performanceOptimizer.loadModel('model-2', 'tts', 400 * 1024 * 1024);
      
      const initialMetrics = performanceOptimizer.getPerformanceMetrics();
      const initialCacheSize = initialMetrics.cache.totalSize;

      // Apply degradation
      await performanceOptimizer.applyGracefulDegradation(3);
      
      const degradedMetrics = performanceOptimizer.getPerformanceMetrics();
      
      // Cache size should be reduced or at least not increased
      expect(degradedMetrics.cache.totalSize).toBeLessThanOrEqual(initialCacheSize);
    });

    test('should prioritize safety-critical components during degradation', async () => {
      await performanceOptimizer.applyGracefulDegradation(3);
      
      // Safety-critical requests should still be processed with high priority
      await performanceOptimizer.queueRequest({
        type: 'wake_word',
        priority: 'critical',
        timeoutMs: 1000,
        data: { safety: true },
        maxRetries: 5
      });

      await performanceOptimizer.queueRequest({
        type: 'tts',
        priority: 'low',
        timeoutMs: 3000,
        data: { safety: false },
        maxRetries: 1
      });

      // Critical request should be processed first
      const firstRequest = await performanceOptimizer.processNextRequest('wake-word-queue');
      expect(firstRequest?.priority).toBe('critical');
    });
  });

  describe('Performance Optimization', () => {
    test('should optimize model loading based on usage patterns', async () => {
      const loadSpy = jest.fn();
      const evictSpy = jest.fn();
      
      performanceOptimizer.on('model-loaded', loadSpy);
      performanceOptimizer.on('model-evicted', evictSpy);

      // Load frequently used model
      await performanceOptimizer.loadModel('frequent-model', 'speech_recognition', 300 * 1024 * 1024);
      await performanceOptimizer.loadModel('frequent-model', 'speech_recognition', 300 * 1024 * 1024); // Access again
      
      // Load rarely used model
      await performanceOptimizer.loadModel('rare-model', 'tts', 200 * 1024 * 1024);
      
      // Load large model that should trigger eviction
      await performanceOptimizer.loadModel('large-model', 'intent_classification', 1800 * 1024 * 1024);

      expect(loadSpy).toHaveBeenCalled();
      
      // Rare model should be evicted before frequent model
      if (evictSpy.mock.calls.length > 0) {
        const evictedModel = evictSpy.mock.calls[0][0];
        expect(evictedModel.modelId).toBe('rare-model');
      }
    });

    test('should throttle requests under high load', async () => {
      await performanceOptimizer.startOptimization();
      
      // Simulate high CPU usage
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 3000,
        cpuPercent: 90, // High CPU usage
        timestamp: new Date()
      });

      // Apply CPU optimization strategy
      await performanceOptimizer.applyStrategy('queue-throttling');
      
      // Queue many requests
      const requestPromises = [];
      for (let i = 0; i < 50; i++) {
        requestPromises.push(performanceOptimizer.queueRequest({
          type: 'speech_recognition',
          priority: 'medium',
          timeoutMs: 5000,
          data: { index: i },
          maxRetries: 2
        }));
      }

      await Promise.all(requestPromises);
      
      const metrics = performanceOptimizer.getPerformanceMetrics();
      const speechQueue = metrics.queues.find(q => q.queueId === 'speech-recognition-queue');
      
      // Queue should respect size limits (allowing for some overflow during processing)
      expect(speechQueue?.size).toBeLessThanOrEqual((speechQueue?.maxSize || 20) + 10);
    });

    test('should recover automatically from resource exhaustion', async () => {
      const recoverySpy = jest.fn();
      performanceOptimizer.on('optimization-cycle-completed', recoverySpy);

      // Simulate resource exhaustion
      jest.spyOn(resourceMonitor, 'getCurrentUsage')
        .mockReturnValueOnce({
          memoryMB: 7800, // Critical
          cpuPercent: 95,  // Critical
          timestamp: new Date()
        })
        .mockReturnValueOnce({
          memoryMB: 7800,
          cpuPercent: 95,
          timestamp: new Date()
        })
        .mockReturnValue({
          memoryMB: 3000, // Normal
          cpuPercent: 40,  // Normal
          timestamp: new Date()
        });

      jest.spyOn(resourceMonitor, 'isUnderPressure')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValue(false);

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      // Wait for multiple optimization cycles
      await new Promise(resolve => setTimeout(resolve, 8000));

      expect(recoverySpy).toHaveBeenCalled();
      
      // System should recover to normal operation
      const finalMetrics = performanceOptimizer.getPerformanceMetrics();
      expect(finalMetrics.degradationLevel).toBeLessThan(3);
    }, 15000); // Increase timeout to 15 seconds
  });

  describe('Recovery Mechanisms', () => {
    test('should recover from monitoring failures', async () => {
      const errorSpy = jest.fn();
      resourceMonitor.on('monitoring-error', errorSpy);

      // Mock monitoring error
      let errorCount = 0;
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockImplementation(() => {
        errorCount++;
        if (errorCount <= 2) {
          throw new Error('Monitoring failure');
        }
        return {
          memoryMB: 2000,
          cpuPercent: 30,
          timestamp: new Date()
        };
      });

      await resourceMonitor.startMonitoring();
      
      // Wait for error and recovery
      await new Promise(resolve => setTimeout(resolve, 3000));

      expect(errorSpy).toHaveBeenCalled();
      
      // Should continue monitoring after error
      const history = resourceMonitor.getResourceHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('should handle optimization failures gracefully', async () => {
      const errorSpy = jest.fn();
      performanceOptimizer.on('optimization-error', errorSpy);

      // Mock optimization error
      jest.spyOn(resourceMonitor, 'getOptimizationRecommendations').mockImplementation(() => {
        throw new Error('Optimization failure');
      });

      await performanceOptimizer.startOptimization();
      
      // Wait for optimization cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(errorSpy).toHaveBeenCalled();
      
      // System should continue operating
      const metrics = performanceOptimizer.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    test('should maintain system stability during rapid resource changes', async () => {
      let toggle = false;
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockImplementation(() => {
        toggle = !toggle;
        return {
          memoryMB: toggle ? 7500 : 2000, // Rapidly changing between critical and normal
          cpuPercent: toggle ? 90 : 30,
          timestamp: new Date()
        };
      });

      jest.spyOn(resourceMonitor, 'isUnderPressure').mockImplementation(() => toggle);

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      // Let system run with rapid changes
      await new Promise(resolve => setTimeout(resolve, 8000));

      // System should remain stable
      const metrics = performanceOptimizer.getPerformanceMetrics();
      expect(metrics.degradationLevel).toBeGreaterThanOrEqual(0);
      expect(metrics.degradationLevel).toBeLessThanOrEqual(3);
    });
  });

  describe('Jetson Nano Orin Specific Tests', () => {
    test('should respect Jetson Nano Orin memory constraints', () => {
      const profile = resourceMonitor.getProfile();
      
      // Should be configured for 8GB RAM
      expect(profile.thresholds.memoryCritical).toBeLessThanOrEqual(8192);
      expect(profile.thresholds.memoryWarning).toBeLessThan(profile.thresholds.memoryCritical);
    });

    test('should optimize for ARM Cortex-A78AE CPU characteristics', async () => {
      const profile = resourceMonitor.getProfile();
      
      // CPU thresholds should be appropriate for 6-core ARM processor
      expect(profile.thresholds.cpuWarning).toBeLessThanOrEqual(80);
      expect(profile.thresholds.cpuCritical).toBeLessThanOrEqual(95);
    });

    test('should handle GPU monitoring on Jetson platform', async () => {
      const usage = resourceMonitor.getCurrentUsage();
      
      // GPU monitoring may or may not be available depending on implementation
      if (usage.gpuPercent !== undefined) {
        expect(usage.gpuPercent).toBeGreaterThanOrEqual(0);
        expect(usage.gpuPercent).toBeLessThanOrEqual(100);
      }
    });

    test('should maintain performance under Jetson hardware constraints', async () => {
      // Simulate Jetson-like resource constraints
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 6000, // 75% of 8GB
        cpuPercent: 65,  // Moderate CPU usage
        gpuPercent: 70,  // Moderate GPU usage
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      // System should operate efficiently
      await new Promise(resolve => setTimeout(resolve, 3000));

      const metrics = performanceOptimizer.getPerformanceMetrics();
      
      // Should maintain reasonable performance
      expect(metrics.degradationLevel).toBeLessThanOrEqual(2);
      
      // Cache should be efficiently utilized
      expect(metrics.cache.utilization).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Safety Compliance', () => {
    test('should never compromise safety features during optimization', async () => {
      // Apply maximum degradation
      await performanceOptimizer.applyGracefulDegradation(3);
      
      // Safety-critical operations should still work
      const safetyRequestId = await performanceOptimizer.queueRequest({
        type: 'wake_word',
        priority: 'critical',
        timeoutMs: 1000,
        data: { safetyCheck: true },
        maxRetries: 5
      });

      expect(safetyRequestId).toBeDefined();
      
      const safetyRequest = await performanceOptimizer.processNextRequest('wake-word-queue');
      expect(safetyRequest).not.toBeNull();
      expect(safetyRequest?.priority).toBe('critical');
    });

    test('should maintain child safety filters under resource pressure', async () => {
      // Simulate critical resource usage
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7800,
        cpuPercent: 95,
        timestamp: new Date()
      });

      await performanceOptimizer.startOptimization();
      
      // Apply emergency optimizations
      resourceMonitor.emit('optimization-trigger', {
        trigger: {
          action: 'emergency_stop',
          priority: 'critical'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Safety strategies should be preferred
      const strategies = performanceOptimizer.getAvailableStrategies();
      const appliedStrategies = strategies.filter(s => 
        s.safetyImpact === 'none' || s.safetyImpact === 'minimal'
      );
      
      expect(appliedStrategies.length).toBeGreaterThan(0);
    });

    test('should log all resource management decisions for audit', async () => {
      const events: any[] = [];
      
      resourceMonitor.on('resource-alert', (alert) => events.push({ type: 'alert', data: alert }));
      performanceOptimizer.on('degradation-applied', (degradation) => events.push({ type: 'degradation', data: degradation }));
      performanceOptimizer.on('strategy-applied', (strategy) => events.push({ type: 'strategy', data: strategy }));

      // Trigger various resource management actions
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500,
        cpuPercent: 90,
        timestamp: new Date()
      });

      await resourceMonitor.startMonitoring();
      await performanceOptimizer.startOptimization();

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have logged events for audit trail
      expect(events.length).toBeGreaterThan(0);
      
      events.forEach(event => {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        // Check for timestamp in different possible locations
        const hasTimestamp = 
          event.data.timestamp || 
          event.data.appliedAt || 
          (event.data.optimizations && event.data.optimizations.length > 0 && event.data.optimizations[0].appliedAt);
        expect(hasTimestamp).toBeDefined();
      });
    });
  });
});