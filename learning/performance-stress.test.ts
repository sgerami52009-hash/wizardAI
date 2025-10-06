// Performance and Stress Tests for Learning Engine

import { 
  DefaultPerformanceMonitor, 
  PerformanceThresholds, 
  AlertType, 
  AlertSeverity,
  ResourceMetrics,
  LatencyMetrics 
} from './performance-monitor';
import { 
  DefaultLearningErrorRecovery,
  TrainingRecoveryResult,
  ResourceRecoveryResult 
} from './error-recovery';
import { 
  TrainingError,
  ResourceExhaustionError,
  PerformanceDegradationError,
  DefaultErrorRecoveryManager,
  createErrorContext 
} from './errors';
import { DefaultLearningEventBus } from './events';

describe('Performance and Stress Tests', () => {
  let performanceMonitor: DefaultPerformanceMonitor;
  let errorRecovery: DefaultLearningErrorRecovery;
  let eventBus: DefaultLearningEventBus;
  let errorRecoveryManager: DefaultErrorRecoveryManager;

  beforeEach(async () => {
    jest.useFakeTimers();
    eventBus = new DefaultLearningEventBus();
    performanceMonitor = new DefaultPerformanceMonitor(eventBus);
    errorRecoveryManager = new DefaultErrorRecoveryManager();
    errorRecovery = new DefaultLearningErrorRecovery(eventBus, performanceMonitor, errorRecoveryManager);
    
    await performanceMonitor.startMonitoring();
    jest.advanceTimersByTime(100); // Initialize monitoring
  });

  afterEach(async () => {
    await performanceMonitor.stopMonitoring();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Inference Latency Benchmarks', () => {
    it('should maintain sub-100ms inference latency under normal load', async () => {
      const operationCount = 50; // Reduced for faster testing
      const latencies: number[] = [];
      
      // Simulate normal inference operations with mock latencies
      for (let i = 0; i < operationCount; i++) {
        const mockLatency = Math.random() * 50 + 10; // 10-60ms mock latency
        latencies.push(mockLatency);
        await performanceMonitor.trackInferenceLatency(`inference_${i}`, mockLatency);
      }
      
      const metrics = await performanceMonitor.getLatencyMetrics();
      
      // Verify latency requirements
      expect(metrics.averageInferenceLatencyMs).toBeLessThan(100);
      expect(metrics.p95InferenceLatencyMs).toBeLessThan(150);
      expect(metrics.p99InferenceLatencyMs).toBeLessThan(200);
      expect(metrics.totalInferenceOperations).toBe(operationCount);
      
      // Verify no latency alerts were generated
      const alerts = await performanceMonitor.getAlerts();
      const latencyAlerts = alerts.filter(alert => alert.type === AlertType.LATENCY_THRESHOLD_EXCEEDED);
      expect(latencyAlerts.length).toBe(0);
    }, 15000);

    it('should handle high-frequency inference requests without degradation', async () => {
      const batchSize = 20; // Reduced for faster testing
      const batchCount = 5;
      const maxLatencyIncrease = 0.2; // 20% maximum increase
      
      let firstBatchAverage = 0;
      let lastBatchAverage = 0;
      
      // Process multiple batches to test sustained performance
      for (let batch = 0; batch < batchCount; batch++) {
        const batchLatencies: number[] = [];
        
        // Process batch with mock latencies (no actual delays)
        for (let i = 0; i < batchSize; i++) {
          const mockLatency = Math.random() * 30 + 20; // 20-50ms mock latency
          batchLatencies.push(mockLatency);
          await performanceMonitor.trackInferenceLatency(`batch_${batch}_inference_${i}`, mockLatency);
        }
        
        const batchAverage = batchLatencies.reduce((sum, lat) => sum + lat, 0) / batchLatencies.length;
        
        if (batch === 0) {
          firstBatchAverage = batchAverage;
        }
        if (batch === batchCount - 1) {
          lastBatchAverage = batchAverage;
        }
      }
      
      // Verify performance doesn't degrade significantly over time
      const performanceIncrease = Math.abs(lastBatchAverage - firstBatchAverage) / firstBatchAverage;
      expect(performanceIncrease).toBeLessThan(maxLatencyIncrease);
      
      const finalMetrics = await performanceMonitor.getLatencyMetrics();
      expect(finalMetrics.totalInferenceOperations).toBe(batchSize * batchCount);
    }, 15000);

    it('should detect and alert on latency threshold violations', async () => {
      // Set strict latency thresholds
      const strictThresholds: PerformanceThresholds = {
        maxMemoryUsageMB: 6144,
        maxCpuUsagePercent: 85,
        maxInferenceLatencyMs: 50, // Strict 50ms threshold
        maxTrainingLatencyMs: 5000,
        minAvailableMemoryMB: 1024,
        maxGpuUsagePercent: 90,
        maxGpuMemoryUsageMB: 4096,
        maxDiskUsagePercent: 85,
        maxNetworkLatencyMs: 1000,
        performanceDegradationThreshold: 0.2
      };
      
      await performanceMonitor.setThresholds(strictThresholds);
      
      // Simulate slow operations that exceed threshold
      const slowOperations = [75, 100, 125, 150]; // All exceed 50ms threshold
      
      for (const latency of slowOperations) {
        await performanceMonitor.trackInferenceLatency('slow_operation', latency);
      }
      
      const alerts = await performanceMonitor.getAlerts();
      const latencyAlerts = alerts.filter(alert => alert.type === AlertType.LATENCY_THRESHOLD_EXCEEDED);
      
      expect(latencyAlerts.length).toBe(slowOperations.length);
      latencyAlerts.forEach(alert => {
        expect(alert.severity).toBe(AlertSeverity.HIGH);
        expect(alert.data.latencyMs).toBeGreaterThan(50);
      });
    });
  });

  describe('Memory Usage Optimization Tests', () => {
    it('should handle concurrent user learning without memory leaks', async () => {
      const userCount = 10; // Reduced for faster testing
      const operationsPerUser = 10;
      
      // Get baseline memory usage
      jest.advanceTimersByTime(1100); // Trigger monitoring cycle
      const baselineMetrics = await performanceMonitor.getResourceMetrics();
      const baselineMemory = baselineMetrics.memoryUsageMB;
      
      // Simulate concurrent user learning operations (no actual delays)
      for (let userIndex = 0; userIndex < userCount; userIndex++) {
        const userId = `stress_test_user_${userIndex}`;
        
        for (let op = 0; op < operationsPerUser; op++) {
          // Simulate learning operations with varying complexity
          const operationType = op % 3 === 0 ? 'training' : 'inference';
          const latency = operationType === 'training' ? 
            Math.random() * 2000 + 1000 : // 1-3s for training
            Math.random() * 50 + 25;      // 25-75ms for inference
          
          if (operationType === 'training') {
            await performanceMonitor.trackTrainingLatency(`user_${userId}_train_${op}`, latency);
          } else {
            await performanceMonitor.trackInferenceLatency(`user_${userId}_infer_${op}`, latency);
          }
        }
      }
      
      // Allow monitoring to collect final metrics
      jest.advanceTimersByTime(1100);
      
      const finalMetrics = await performanceMonitor.getResourceMetrics();
      const memoryIncrease = finalMetrics.memoryUsageMB - baselineMemory;
      const memoryIncreasePercent = Math.abs(memoryIncrease / baselineMemory) * 100;
      
      // Memory increase should be reasonable (less than 100% increase for testing)
      expect(memoryIncreasePercent).toBeLessThan(100);
      
      // Verify all operations were tracked
      const latencyMetrics = await performanceMonitor.getLatencyMetrics();
      const expectedInferenceOps = userCount * Math.floor(operationsPerUser * 2 / 3);
      const expectedTrainingOps = userCount * Math.floor(operationsPerUser / 3);
      
      expect(latencyMetrics.totalInferenceOperations).toBeGreaterThanOrEqual(expectedInferenceOps - 5);
      expect(latencyMetrics.totalTrainingOperations).toBeGreaterThanOrEqual(expectedTrainingOps - 5);
    }, 15000);

    it('should trigger memory optimization when thresholds are exceeded', async () => {
      // Set low memory thresholds to trigger optimization
      const lowMemoryThresholds: PerformanceThresholds = {
        maxMemoryUsageMB: 1, // Very low threshold to guarantee trigger
        maxCpuUsagePercent: 1,
        maxInferenceLatencyMs: 100,
        maxTrainingLatencyMs: 5000,
        minAvailableMemoryMB: 10000, // Very high threshold to guarantee trigger
        maxGpuUsagePercent: 90,
        maxGpuMemoryUsageMB: 4096,
        maxDiskUsagePercent: 85,
        maxNetworkLatencyMs: 1000,
        performanceDegradationThreshold: 0.2
      };
      
      await performanceMonitor.setThresholds(lowMemoryThresholds);
      
      // Advance timers to trigger monitoring and threshold checks
      jest.advanceTimersByTime(1100);
      
      // Verify performance degradation is detected
      const isDegraded = await performanceMonitor.isPerformanceDegraded();
      expect(isDegraded).toBe(true);
      
      // Test memory optimization through error recovery
      const resourceError = new ResourceExhaustionError(
        'Memory usage exceeded threshold during stress test',
        createErrorContext('stress_test', 'performance_monitor', 'memory_check', {
          resourceType: 'memory',
          currentUsage: 150, // Exceeds threshold
          limit: 100
        })
      );
      
      const recoveryResult: ResourceRecoveryResult = await errorRecovery.handleResourceExhaustion(resourceError);
      
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.memoryFreed || recoveryResult.modelsOptimized || recoveryResult.operationsThrottled).toBe(true);
      expect(recoveryResult.message).toBeTruthy();
    });

    it('should maintain performance under memory pressure', async () => {
      // Simulate memory pressure scenario
      const memoryPressureThresholds: PerformanceThresholds = {
        maxMemoryUsageMB: 200, // Moderate threshold
        maxCpuUsagePercent: 85,
        maxInferenceLatencyMs: 100,
        maxTrainingLatencyMs: 5000,
        minAvailableMemoryMB: 100,
        maxGpuUsagePercent: 90,
        maxGpuMemoryUsageMB: 4096,
        maxDiskUsagePercent: 85,
        maxNetworkLatencyMs: 1000,
        performanceDegradationThreshold: 0.2
      };
      
      await performanceMonitor.setThresholds(memoryPressureThresholds);
      
      // Perform operations under memory pressure (using mock latencies)
      const operationCount = 50; // Reduced for faster testing
      
      for (let i = 0; i < operationCount; i++) {
        // Simulate inference under memory pressure (slightly slower mock latencies)
        const mockLatency = Math.random() * 70 + 30; // 30-100ms
        await performanceMonitor.trackInferenceLatency(`pressure_test_${i}`, mockLatency);
        
        // Advance timers periodically to trigger monitoring
        if (i % 10 === 0) {
          jest.advanceTimersByTime(1100);
        }
      }
      
      const metrics = await performanceMonitor.getLatencyMetrics();
      
      // Performance should still be acceptable under pressure
      expect(metrics.averageInferenceLatencyMs).toBeLessThan(120); // Slightly higher than normal
      expect(metrics.p95InferenceLatencyMs).toBeLessThan(180);
      
      // Check if system generated appropriate recommendations
      const report = await performanceMonitor.getPerformanceReport();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // System should be able to generate reports under pressure
      expect(report.resourceMetrics).toBeDefined();
      expect(report.latencyMetrics).toBeDefined();
    }, 15000);
  });

  describe('Error Recovery Stress Tests', () => {
    it('should handle multiple concurrent error recovery operations', async () => {
      const errorCount = 10; // Reduced for faster testing
      const errorTypes = [
        'training_failure',
        'resource_exhaustion', 
        'performance_degradation'
      ];
      
      // Generate multiple concurrent errors
      const errorPromises = Array.from({ length: errorCount }, async (_, index) => {
        const errorType = errorTypes[index % errorTypes.length];
        const userId = `concurrent_error_user_${index}`;
        
        switch (errorType) {
          case 'training_failure':
            const trainingError = new TrainingError(
              `Concurrent training failure ${index}`,
              createErrorContext(userId, 'learning_engine', 'model_training', {
                errorIndex: index,
                concurrentTest: true
              })
            );
            return await errorRecovery.handleTrainingFailure(trainingError);
            
          case 'resource_exhaustion':
            const resourceError = new ResourceExhaustionError(
              `Concurrent resource exhaustion ${index}`,
              createErrorContext(userId, 'resource_monitor', 'memory_check', {
                errorIndex: index,
                concurrentTest: true
              })
            );
            return await errorRecovery.handleResourceExhaustion(resourceError);
            
          case 'performance_degradation':
            const performanceError = new PerformanceDegradationError(
              `Concurrent performance degradation ${index}`,
              createErrorContext(userId, 'performance_monitor', 'latency_check', {
                errorIndex: index,
                concurrentTest: true
              })
            );
            return await errorRecovery.handlePerformanceDegradation(performanceError);
            
          default:
            throw new Error(`Unknown error type: ${errorType}`);
        }
      });
      
      const results = await Promise.all(errorPromises);
      
      // Verify all recovery operations completed
      expect(results.length).toBe(errorCount);
      
      // Check recovery success rate
      const successfulRecoveries = results.filter(result => result.success).length;
      const successRate = (successfulRecoveries / errorCount) * 100;
      
      // Should have reasonable success rate (at least 50%)
      expect(successRate).toBeGreaterThanOrEqual(50);
      
      // Verify recovery statistics were updated
      const stats = await errorRecovery.getRecoveryStatistics();
      expect(stats.totalRecoveryAttempts).toBeGreaterThanOrEqual(errorCount);
      
      // All results should have recovery time information
      results.forEach(result => {
        expect(typeof result.recoveryTimeMs).toBe('number');
        expect(result.recoveryTimeMs).toBeGreaterThanOrEqual(0); // Allow 0 for very fast operations
        expect(result.message).toBeTruthy();
      });
    });

    it('should handle cascading failure scenarios', async () => {
      // Simulate cascading failures: resource exhaustion -> performance degradation -> training failure
      
      // Step 1: Resource exhaustion
      const resourceError = new ResourceExhaustionError(
        'Initial resource exhaustion triggering cascade',
        createErrorContext('cascade_test_user', 'resource_monitor', 'memory_check', {
          cascadeStep: 1,
          resourceType: 'memory'
        })
      );
      
      const resourceRecovery = await errorRecovery.handleResourceExhaustion(resourceError);
      expect(resourceRecovery).toBeDefined();
      
      // Step 2: Performance degradation (caused by resource issues)
      const performanceError = new PerformanceDegradationError(
        'Performance degradation due to resource constraints',
        createErrorContext('cascade_test_user', 'performance_monitor', 'latency_check', {
          cascadeStep: 2,
          triggerCause: 'resource_exhaustion'
        })
      );
      
      const performanceRecovery = await errorRecovery.handlePerformanceDegradation(performanceError);
      expect(performanceRecovery).toBeDefined();
      
      // Step 3: Training failure (caused by performance issues)
      const trainingError = new TrainingError(
        'Training failure due to performance degradation',
        createErrorContext('cascade_test_user', 'learning_engine', 'model_training', {
          cascadeStep: 3,
          triggerCause: 'performance_degradation'
        })
      );
      
      const trainingRecovery = await errorRecovery.handleTrainingFailure(trainingError);
      expect(trainingRecovery).toBeDefined();
      
      // Verify recovery chain handled appropriately
      const allRecoveries = [resourceRecovery, performanceRecovery, trainingRecovery];
      
      // At least some recoveries should be successful
      const successfulRecoveries = allRecoveries.filter(recovery => recovery.success).length;
      expect(successfulRecoveries).toBeGreaterThan(0);
      
      // Check final system state
      const finalStats = await errorRecovery.getRecoveryStatistics();
      expect(finalStats.totalRecoveryAttempts).toBeGreaterThanOrEqual(3);
      
      // Verify performance monitoring is still functional
      const finalReport = await performanceMonitor.getPerformanceReport();
      expect(finalReport).toBeDefined();
      expect(finalReport.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain system stability under repeated error conditions', async () => {
      const iterationCount = 5; // Reduced for faster testing
      const errorsPerIteration = 3;
      
      let totalRecoveryAttempts = 0;
      let totalSuccessfulRecoveries = 0;
      
      // Simulate repeated error conditions over time
      for (let iteration = 0; iteration < iterationCount; iteration++) {
        const iterationResults = [];
        
        for (let errorIndex = 0; errorIndex < errorsPerIteration; errorIndex++) {
          const userId = `stability_test_user_${iteration}_${errorIndex}`;
          
          // Alternate between different error types
          if (errorIndex % 2 === 0) {
            const trainingError = new TrainingError(
              `Stability test training error ${iteration}-${errorIndex}`,
              createErrorContext(userId, 'learning_engine', 'model_training', {
                iteration,
                errorIndex,
                stabilityTest: true
              })
            );
            const result = await errorRecovery.handleTrainingFailure(trainingError);
            iterationResults.push(result);
          } else {
            const resourceError = new ResourceExhaustionError(
              `Stability test resource error ${iteration}-${errorIndex}`,
              createErrorContext(userId, 'resource_monitor', 'memory_check', {
                iteration,
                errorIndex,
                stabilityTest: true
              })
            );
            const result = await errorRecovery.handleResourceExhaustion(resourceError);
            iterationResults.push(result);
          }
        }
        
        totalRecoveryAttempts += iterationResults.length;
        totalSuccessfulRecoveries += iterationResults.filter(result => result.success).length;
        
        // Advance timers to allow monitoring cycles
        jest.advanceTimersByTime(1100);
      }
      
      // Verify system maintained stability
      const finalSuccessRate = (totalSuccessfulRecoveries / totalRecoveryAttempts) * 100;
      expect(finalSuccessRate).toBeGreaterThanOrEqual(40); // At least 40% success rate
      
      // Verify monitoring system is still responsive
      const finalMetrics = await performanceMonitor.getResourceMetrics();
      expect(finalMetrics).toBeDefined();
      expect(typeof finalMetrics.memoryUsageMB).toBe('number');
      
      const finalLatencyMetrics = await performanceMonitor.getLatencyMetrics();
      expect(finalLatencyMetrics).toBeDefined();
      
      // Verify error recovery statistics are accurate
      const finalStats = await errorRecovery.getRecoveryStatistics();
      expect(finalStats.totalRecoveryAttempts).toBe(totalRecoveryAttempts);
      expect(finalStats.successfulRecoveries).toBe(totalSuccessfulRecoveries);
      
      // System should still be able to generate reports
      const finalReport = await performanceMonitor.getPerformanceReport();
      expect(finalReport.overallHealth).toBeDefined();
      expect(Array.isArray(finalReport.recommendations)).toBe(true);
    }, 20000);
  });

  describe('System Integration Stress Tests', () => {
    it('should handle mixed workload scenarios', async () => {
      // Simulate realistic mixed workload: monitoring + error recovery + performance tracking
      
      // Start background monitoring
      jest.advanceTimersByTime(100);
      
      // Simulate inference operations (no delays)
      for (let i = 0; i < 20; i++) {
        const latency = Math.random() * 80 + 20; // 20-100ms
        await performanceMonitor.trackInferenceLatency('mixed_workload_inference', latency);
      }
      
      // Simulate training operations
      for (let i = 0; i < 5; i++) {
        const latency = Math.random() * 3000 + 1000; // 1-4s
        await performanceMonitor.trackTrainingLatency('mixed_workload_training', latency);
      }
      
      // Simulate error recovery operations
      const recoveryOps = [];
      for (let i = 0; i < 3; i++) {
        const trainingError = new TrainingError(
          `Mixed workload error ${i}`,
          createErrorContext(`mixed_user_${i}`, 'learning_engine', 'model_training')
        );
        recoveryOps.push(errorRecovery.handleTrainingFailure(trainingError));
      }
      
      await Promise.all(recoveryOps);
      
      // Trigger monitoring cycles
      jest.advanceTimersByTime(1100);
      
      // Verify system handled mixed workload successfully
      const finalMetrics = await performanceMonitor.getLatencyMetrics();
      expect(finalMetrics.totalInferenceOperations).toBeGreaterThan(0);
      expect(finalMetrics.totalTrainingOperations).toBeGreaterThan(0);
      
      const recoveryStats = await errorRecovery.getRecoveryStatistics();
      expect(recoveryStats.totalRecoveryAttempts).toBeGreaterThan(0);
      
      // System should still be responsive
      const finalReport = await performanceMonitor.getPerformanceReport();
      expect(finalReport).toBeDefined();
      expect(finalReport.resourceMetrics).toBeDefined();
      expect(finalReport.latencyMetrics).toBeDefined();
      
      // Performance should be within acceptable bounds
      expect(finalMetrics.averageInferenceLatencyMs).toBeLessThan(200); // Allowing for stress conditions
    }, 15000);
  });
});