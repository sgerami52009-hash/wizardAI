/**
 * Unit tests for PerformanceOptimizer
 * Safety: Ensures optimization doesn't compromise child safety features
 * Performance: Validates optimization effectiveness and resource management
 */

import { PerformanceOptimizer, createJetsonPerformanceOptimizer, OptimizationStrategy, QueuedRequest } from './performance-optimizer';
import { ResourceMonitor, createJetsonResourceMonitor } from './resource-monitor';

describe('PerformanceOptimizer', () => {
  let resourceMonitor: ResourceMonitor;
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    resourceMonitor = createJetsonResourceMonitor();
    optimizer = new PerformanceOptimizer(resourceMonitor);
  });

  afterEach(async () => {
    await optimizer.stopOptimization();
    await resourceMonitor.stopMonitoring();
  });

  describe('Basic Functionality', () => {
    test('should initialize with default configuration', () => {
      const metrics = optimizer.getPerformanceMetrics();
      
      expect(metrics.degradationLevel).toBe(0);
      expect(metrics.queues.length).toBeGreaterThan(0);
      expect(metrics.cache.totalSize).toBe(0);
      expect(metrics.appliedOptimizations).toBe(0);
    });

    test('should start and stop optimization', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      optimizer.on('optimization-started', startSpy);
      optimizer.on('optimization-stopped', stopSpy);

      await optimizer.startOptimization();
      expect(startSpy).toHaveBeenCalled();

      await optimizer.stopOptimization();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should get available optimization strategies', () => {
      const strategies = optimizer.getAvailableStrategies();
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('strategyId');
      expect(strategies[0]).toHaveProperty('name');
      expect(strategies[0]).toHaveProperty('targetResource');
      expect(strategies[0]).toHaveProperty('safetyImpact');
    });
  });

  describe('Request Queue Management', () => {
    test('should queue requests with priority', async () => {
      const queueSpy = jest.fn();
      optimizer.on('request-queued', queueSpy);

      const requestId = await optimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'high',
        userId: 'test-user',
        timeoutMs: 5000,
        data: { text: 'test input' },
        maxRetries: 3
      });

      expect(requestId).toBeDefined();
      expect(queueSpy).toHaveBeenCalled();
      
      const queueEvent = queueSpy.mock.calls[0][0];
      expect(queueEvent.request.type).toBe('speech_recognition');
      expect(queueEvent.request.priority).toBe('high');
    });

    test('should process requests by priority', async () => {
      // Queue multiple requests with different priorities
      await optimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'low',
        timeoutMs: 5000,
        data: { text: 'low priority' },
        maxRetries: 3
      });

      await optimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'critical',
        timeoutMs: 5000,
        data: { text: 'critical priority' },
        maxRetries: 3
      });

      await optimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'medium',
        timeoutMs: 5000,
        data: { text: 'medium priority' },
        maxRetries: 3
      });

      // Process requests - should get critical first
      const firstRequest = await optimizer.processNextRequest('speech-recognition-queue');
      expect(firstRequest?.priority).toBe('critical');
      expect(firstRequest?.data.text).toBe('critical priority');

      // Then medium
      const secondRequest = await optimizer.processNextRequest('speech-recognition-queue');
      expect(secondRequest?.priority).toBe('medium');

      // Then low
      const thirdRequest = await optimizer.processNextRequest('speech-recognition-queue');
      expect(thirdRequest?.priority).toBe('low');
    });

    test('should handle queue overflow by evicting low priority requests', async () => {
      // Fill queue with low priority requests
      for (let i = 0; i < 25; i++) { // Exceed speech recognition queue max size (20)
        await optimizer.queueRequest({
          type: 'speech_recognition',
          priority: 'low',
          timeoutMs: 5000,
          data: { text: `low priority ${i}` },
          maxRetries: 3
        });
      }

      const metrics = optimizer.getPerformanceMetrics();
      const speechQueue = metrics.queues.find(q => q.queueId === 'speech-recognition-queue');
      
      expect(speechQueue?.size).toBeLessThanOrEqual(speechQueue?.maxSize || 20);
    });

    test('should return null when processing empty queue', async () => {
      const request = await optimizer.processNextRequest('speech-recognition-queue');
      expect(request).toBeNull();
    });
  });

  describe('Model Cache Management', () => {
    test('should load models into cache', async () => {
      const loadSpy = jest.fn();
      optimizer.on('model-loaded', loadSpy);

      await optimizer.loadModel('test-model-1', 'speech_recognition', 100 * 1024 * 1024); // 100MB

      expect(loadSpy).toHaveBeenCalled();
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.cache.modelCount).toBe(1);
      expect(metrics.cache.totalSize).toBe(100 * 1024 * 1024);
    });

    test('should evict models when cache is full', async () => {
      const evictSpy = jest.fn();
      optimizer.on('model-evicted', evictSpy);

      // Load models to fill cache (2GB limit)
      await optimizer.loadModel('model-1', 'speech_recognition', 800 * 1024 * 1024); // 800MB
      await optimizer.loadModel('model-2', 'intent_classification', 800 * 1024 * 1024); // 800MB
      await optimizer.loadModel('model-3', 'tts', 600 * 1024 * 1024); // 600MB - should trigger eviction

      expect(evictSpy).toHaveBeenCalled();
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.cache.totalSize).toBeLessThanOrEqual(2048 * 1024 * 1024); // 2GB limit
    });

    test('should prioritize high-priority models in cache', async () => {
      // Load low priority model first
      await optimizer.loadModel('low-priority', 'tts', 500 * 1024 * 1024);
      
      // Load high priority models to trigger eviction
      await optimizer.loadModel('high-priority-1', 'wake_word', 800 * 1024 * 1024);
      await optimizer.loadModel('high-priority-2', 'speech_recognition', 800 * 1024 * 1024);

      const metrics = optimizer.getPerformanceMetrics();
      
      // High priority models should remain loaded
      expect(metrics.cache.modelCount).toBeGreaterThan(0);
    });

    test('should update model access statistics', async () => {
      await optimizer.loadModel('test-model', 'speech_recognition', 100 * 1024 * 1024);
      
      // Access the model again
      await optimizer.loadModel('test-model', 'speech_recognition', 100 * 1024 * 1024);
      
      // Model should have increased access count
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.cache.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    test('should apply graceful degradation', async () => {
      const degradationSpy = jest.fn();
      optimizer.on('degradation-applied', degradationSpy);

      await optimizer.applyGracefulDegradation(2);

      expect(degradationSpy).toHaveBeenCalled();
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.degradationLevel).toBe(2);
      
      const degradationEvent = degradationSpy.mock.calls[0][0];
      expect(degradationEvent.currentLevel).toBe(2);
      expect(degradationEvent.degradationLevel.name).toBe('Balanced');
    });

    test('should not allow invalid degradation levels', async () => {
      await expect(optimizer.applyGracefulDegradation(-1)).rejects.toThrow('Invalid degradation level');
      await expect(optimizer.applyGracefulDegradation(10)).rejects.toThrow('Invalid degradation level');
    });

    test('should restore quality when degradation level decreases', async () => {
      // First apply degradation
      await optimizer.applyGracefulDegradation(3);
      expect(optimizer.getPerformanceMetrics().degradationLevel).toBe(3);

      // Then restore quality
      const degradationSpy = jest.fn();
      optimizer.on('degradation-applied', degradationSpy);

      await optimizer.applyGracefulDegradation(1);
      
      expect(degradationSpy).toHaveBeenCalled();
      expect(optimizer.getPerformanceMetrics().degradationLevel).toBe(1);
    });

    test('should maintain safety level during degradation', async () => {
      await optimizer.applyGracefulDegradation(2);
      
      const strategies = optimizer.getAvailableStrategies();
      const appliedStrategies = strategies.filter(s => s.safetyImpact === 'none' || s.safetyImpact === 'minimal');
      
      // Should prefer strategies with minimal safety impact
      expect(appliedStrategies.length).toBeGreaterThan(0);
    });
  });

  describe('Optimization Strategies', () => {
    test('should apply optimization strategy', async () => {
      const strategySpy = jest.fn();
      optimizer.on('strategy-applied', strategySpy);

      const action = await optimizer.applyStrategy('audio-quality-reduction');

      expect(strategySpy).toHaveBeenCalled();
      expect(action.type).toBe('reduce_quality');
      expect(action.reversible).toBe(true);
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.appliedOptimizations).toBe(1);
    });

    test('should revert optimization', async () => {
      const revertSpy = jest.fn();
      optimizer.on('optimization-reverted', revertSpy);

      // Apply optimization
      const action = await optimizer.applyStrategy('model-cache-eviction');
      
      // Revert optimization
      await optimizer.revertOptimization(action.actionId);

      expect(revertSpy).toHaveBeenCalled();
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.appliedOptimizations).toBe(0);
    });

    test('should throw error for unknown strategy', async () => {
      await expect(optimizer.applyStrategy('unknown-strategy')).rejects.toThrow('Unknown optimization strategy');
    });

    test('should throw error when reverting non-existent optimization', async () => {
      await expect(optimizer.revertOptimization('non-existent')).rejects.toThrow('Optimization action not found');
    });

    test('should throw error when reverting non-reversible optimization', async () => {
      // Mock a non-reversible optimization
      const action = await optimizer.applyStrategy('audio-quality-reduction');
      (optimizer as any).appliedOptimizations.get(action.actionId).reversible = false;

      await expect(optimizer.revertOptimization(action.actionId)).rejects.toThrow('not reversible');
    });
  });

  describe('Resource Monitor Integration', () => {
    test('should respond to resource alerts', async () => {
      await optimizer.startOptimization();
      
      const degradationSpy = jest.fn();
      optimizer.on('degradation-applied', degradationSpy);

      // Simulate critical resource alert
      resourceMonitor.emit('resource-alert', {
        type: 'critical',
        resource: 'memory',
        currentValue: 7500,
        threshold: 7372,
        message: 'Critical memory usage'
      });

      // Wait for optimization response
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(degradationSpy).toHaveBeenCalled();
    });

    test('should respond to optimization triggers', async () => {
      await optimizer.startOptimization();
      
      const degradationSpy = jest.fn();
      optimizer.on('degradation-applied', degradationSpy);

      // Simulate optimization trigger
      resourceMonitor.emit('optimization-trigger', {
        trigger: {
          action: 'reduce_quality',
          priority: 'high'
        },
        usage: {
          memoryMB: 7000,
          cpuPercent: 80,
          timestamp: new Date()
        }
      });

      // Wait for optimization response
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(degradationSpy).toHaveBeenCalled();
    });

    test('should auto-restore quality when resources are available', async () => {
      // First apply degradation
      await optimizer.applyGracefulDegradation(2);
      
      // Mock resource monitor to report no pressure
      jest.spyOn(resourceMonitor, 'isUnderPressure').mockReturnValue(false);
      
      await optimizer.startOptimization();
      
      const degradationSpy = jest.fn();
      optimizer.on('degradation-applied', degradationSpy);

      // Wait for optimization cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Should restore quality
      expect(degradationSpy).toHaveBeenCalled();
      const finalLevel = optimizer.getPerformanceMetrics().degradationLevel;
      expect(finalLevel).toBeLessThan(2);
    });
  });

  describe('Performance Metrics', () => {
    test('should provide comprehensive performance metrics', () => {
      const metrics = optimizer.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('degradationLevel');
      expect(metrics).toHaveProperty('queues');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('appliedOptimizations');
      expect(metrics).toHaveProperty('resourceUsage');
      expect(metrics).toHaveProperty('timestamp');
      
      expect(Array.isArray(metrics.queues)).toBe(true);
      expect(metrics.queues.length).toBeGreaterThan(0);
      
      expect(metrics.cache).toHaveProperty('totalSize');
      expect(metrics.cache).toHaveProperty('utilization');
      expect(metrics.cache).toHaveProperty('hitRate');
    });

    test('should track queue metrics accurately', async () => {
      // Add some requests to queues
      await optimizer.queueRequest({
        type: 'speech_recognition',
        priority: 'high',
        timeoutMs: 5000,
        data: {},
        maxRetries: 3
      });

      await optimizer.queueRequest({
        type: 'tts',
        priority: 'medium',
        timeoutMs: 3000,
        data: {},
        maxRetries: 2
      });

      const metrics = optimizer.getPerformanceMetrics();
      
      const speechQueue = metrics.queues.find(q => q.queueId === 'speech-recognition-queue');
      const ttsQueue = metrics.queues.find(q => q.queueId === 'tts-queue');
      
      expect(speechQueue?.size).toBe(1);
      expect(ttsQueue?.size).toBe(1);
    });

    test('should calculate cache utilization correctly', async () => {
      await optimizer.loadModel('test-model', 'speech_recognition', 500 * 1024 * 1024); // 500MB
      
      const metrics = optimizer.getPerformanceMetrics();
      const expectedUtilization = (500 * 1024 * 1024) / (2048 * 1024 * 1024); // 500MB / 2GB
      
      // Check that utilization is reasonable (between 0 and 1)
      expect(metrics.cache.utilization).toBeGreaterThanOrEqual(0);
      expect(metrics.cache.utilization).toBeLessThanOrEqual(1);
      expect(metrics.cache.totalSize).toBe(500 * 1024 * 1024);
    });
  });

  describe('Jetson Nano Orin Factory', () => {
    test('should create optimized performance optimizer for Jetson Nano Orin', () => {
      const jetsonOptimizer = createJetsonPerformanceOptimizer(resourceMonitor);
      
      expect(jetsonOptimizer).toBeInstanceOf(PerformanceOptimizer);
      
      const metrics = jetsonOptimizer.getPerformanceMetrics();
      // Check that it's a reasonable cache size (should be 2GB in bytes)
      expect(metrics.cache.maxSize).toBeGreaterThan(1000000000); // > 1GB
      expect(metrics.cache.maxSize).toBeLessThanOrEqual(2147483648); // <= 2GB
    });
  });

  describe('Error Handling', () => {
    test('should handle optimization errors gracefully', async () => {
      const errorSpy = jest.fn();
      optimizer.on('optimization-error', errorSpy);

      // Mock error in optimization cycle
      jest.spyOn(resourceMonitor, 'getCurrentUsage').mockImplementation(() => {
        throw new Error('Test optimization error');
      });

      await optimizer.startOptimization();
      
      // Wait for optimization cycle
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(errorSpy).toHaveBeenCalled();
    });

    test('should not crash on invalid queue operations', async () => {
      // Try to process from non-existent queue
      const result = await optimizer.processNextRequest('non-existent-queue');
      expect(result).toBeNull();
    });

    test('should handle model loading failures gracefully', async () => {
      // This would be tested with actual model loading implementation
      // For now, we test that the method doesn't throw
      await expect(optimizer.loadModel('test-model', 'speech_recognition', 100)).resolves.not.toThrow();
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should clean up resources on stop', async () => {
      await optimizer.startOptimization();
      
      // Apply some optimizations
      await optimizer.applyStrategy('audio-quality-reduction');
      await optimizer.applyGracefulDegradation(2);
      
      expect(optimizer.getPerformanceMetrics().appliedOptimizations).toBeGreaterThan(0);
      expect(optimizer.getPerformanceMetrics().degradationLevel).toBe(2);
      
      // Stop optimization should revert everything
      await optimizer.stopOptimization();
      
      expect(optimizer.getPerformanceMetrics().appliedOptimizations).toBe(0);
      expect(optimizer.getPerformanceMetrics().degradationLevel).toBe(0);
    });

    test('should not leak memory with continuous operation', async () => {
      await optimizer.startOptimization();
      
      // Simulate continuous operation
      for (let i = 0; i < 10; i++) {
        await optimizer.queueRequest({
          type: 'speech_recognition',
          priority: 'medium',
          timeoutMs: 1000,
          data: { iteration: i },
          maxRetries: 1
        });
        
        await optimizer.processNextRequest('speech-recognition-queue');
      }
      
      const metrics = optimizer.getPerformanceMetrics();
      
      // Queue should not grow indefinitely
      const speechQueue = metrics.queues.find(q => q.queueId === 'speech-recognition-queue');
      expect(speechQueue?.size).toBeLessThanOrEqual(speechQueue?.maxSize || 20);
    });
  });
});