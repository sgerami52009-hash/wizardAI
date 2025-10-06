/**
 * Unit tests for SchedulingPerformanceMonitor
 * Tests performance monitoring, memory optimization, and alert generation
 */

import { SchedulingPerformanceMonitor, AlertType, AlertSeverity } from './performance-monitor';

describe('SchedulingPerformanceMonitor', () => {
  let monitor: SchedulingPerformanceMonitor;

  beforeEach(() => {
    monitor = new SchedulingPerformanceMonitor({
      memoryLimitMB: 512, // Lower limit for testing
      maxLatencyMs: 200,
      maxCpuUsage: 70,
      maxQueueDepth: 100,
      minIndexEfficiency: 0.8
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Monitoring Lifecycle', () => {
    test('should start and stop monitoring correctly', () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      monitor.on('monitoring_started', startSpy);
      monitor.on('monitoring_stopped', stopSpy);

      monitor.startMonitoring(100);
      expect(startSpy).toHaveBeenCalled();

      monitor.stopMonitoring();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should not start monitoring if already running', () => {
      const startSpy = jest.fn();
      monitor.on('monitoring_started', startSpy);

      monitor.startMonitoring(100);
      monitor.startMonitoring(100); // Second call should be ignored

      expect(startSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Operation Timing', () => {
    test('should record operation timings correctly', () => {
      monitor.recordOperationTiming('eventCreation', 150);
      monitor.recordOperationTiming('eventCreation', 200);
      monitor.recordOperationTiming('eventQuery', 50);

      const metrics = monitor.getMetrics();
      expect(metrics.operationLatency.eventCreation).toBe(175); // Average of 150 and 200
      expect(metrics.operationLatency.eventQuery).toBe(50);
    });

    test('should calculate percentiles correctly', () => {
      // Record multiple timings to test percentile calculation
      const timings = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      timings.forEach(timing => {
        monitor.recordOperationTiming('eventCreation', timing);
      });

      const metrics = monitor.getMetrics();
      expect(metrics.operationLatency.averageResponseTime).toBe(55); // Average
      expect(metrics.operationLatency.p95ResponseTime).toBeGreaterThan(80);
      expect(metrics.operationLatency.p99ResponseTime).toBeGreaterThan(90);
    });

    test('should limit stored timings for memory efficiency', () => {
      // Record more than 100 timings to test limit
      for (let i = 0; i < 150; i++) {
        monitor.recordOperationTiming('eventCreation', i);
      }

      // Should only keep last 100 measurements
      const metrics = monitor.getMetrics();
      expect(metrics.operationLatency.eventCreation).toBeGreaterThan(100); // Should be from recent measurements
    });
  });

  describe('Memory Monitoring', () => {
    test('should track memory usage correctly', () => {
      const metrics = monitor.getMetrics();
      
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(metrics.memoryUsage.rss).toBeGreaterThan(0);
      expect(metrics.memoryUsage.memoryThreshold).toBe(512 * 1024 * 1024);
    });

    test('should detect memory threshold violations', (done) => {
      const alertSpy = jest.fn();
      monitor.on('performance_alert', alertSpy);

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 600 * 1024 * 1024, // 600MB > 512MB threshold
        heapUsed: 400 * 1024 * 1024,
        heapTotal: 500 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      });

      monitor.startMonitoring(50);

      setTimeout(() => {
        expect(alertSpy).toHaveBeenCalled();
        const alert = alertSpy.mock.calls[0][0];
        expect(alert.type).toBe(AlertType.MEMORY_THRESHOLD);
        expect(alert.severity).toBe(AlertSeverity.HIGH);
        
        // Restore original function
        process.memoryUsage = originalMemoryUsage;
        done();
      }, 100);
    });
  });

  describe('Performance Health', () => {
    test('should report healthy performance when within thresholds', () => {
      // Record good performance metrics
      monitor.recordOperationTiming('eventCreation', 100);
      monitor.recordOperationTiming('eventQuery', 50);

      expect(monitor.isPerformanceHealthy()).toBe(true);
    });

    test('should report unhealthy performance when exceeding thresholds', () => {
      // Record poor performance metrics
      monitor.recordOperationTiming('eventCreation', 500); // Exceeds 200ms threshold
      monitor.recordOperationTiming('eventQuery', 300);

      expect(monitor.isPerformanceHealthy()).toBe(false);
    });
  });

  describe('Memory Optimization', () => {
    test('should optimize memory usage', () => {
      const optimizationSpy = jest.fn();
      monitor.on('memory_optimized', optimizationSpy);

      // Add some operation timings to create data to clean up
      for (let i = 0; i < 60; i++) {
        monitor.recordOperationTiming('eventCreation', i);
      }

      monitor.optimizeMemory();
      expect(optimizationSpy).toHaveBeenCalled();
    });

    test('should handle optimization errors gracefully', () => {
      const errorSpy = jest.fn();
      monitor.on('optimization_error', errorSpy);

      // Mock global.gc to throw an error
      const originalGc = global.gc;
      global.gc = jest.fn().mockImplementation(() => {
        throw new Error('GC failed');
      });

      monitor.optimizeMemory();
      expect(errorSpy).toHaveBeenCalled();

      // Restore
      global.gc = originalGc;
    });
  });

  describe('Alert Management', () => {
    test('should generate latency alerts', (done) => {
      const alertSpy = jest.fn();
      monitor.on('performance_alert', alertSpy);

      monitor.startMonitoring(50);
      
      // Record high latency
      monitor.recordOperationTiming('eventCreation', 400); // Exceeds 200ms threshold

      setTimeout(() => {
        expect(alertSpy).toHaveBeenCalled();
        const alert = alertSpy.mock.calls[0][0];
        expect(alert.type).toBe(AlertType.LATENCY_SPIKE);
        expect(alert.severity).toBe(AlertSeverity.MEDIUM);
        expect(alert.suggestedActions).toContain('Optimize event indexing');
        done();
      }, 100);
    });

    test('should retrieve alerts by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);

      // Manually add some alerts to history
      const alert1 = {
        type: AlertType.MEMORY_THRESHOLD,
        severity: AlertSeverity.HIGH,
        message: 'Test alert 1',
        metrics: {},
        timestamp: oneHourAgo,
        suggestedActions: []
      };

      const alert2 = {
        type: AlertType.LATENCY_SPIKE,
        severity: AlertSeverity.MEDIUM,
        message: 'Test alert 2',
        metrics: {},
        timestamp: now,
        suggestedActions: []
      };

      // Access private alertHistory for testing
      (monitor as any).alertHistory = [alert1, alert2];

      const recentAlerts = monitor.getAlerts(new Date(now.getTime() - 1800000)); // 30 minutes ago
      expect(recentAlerts).toHaveLength(1);
      expect(recentAlerts[0].message).toBe('Test alert 2');

      const allAlerts = monitor.getAlerts();
      expect(allAlerts).toHaveLength(2);
    });
  });

  describe('Metrics Collection', () => {
    test('should provide comprehensive metrics', () => {
      monitor.recordOperationTiming('eventCreation', 100);
      monitor.recordOperationTiming('reminderProcessing', 150);

      const metrics = monitor.getMetrics();

      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('operationLatency');
      expect(metrics).toHaveProperty('resourceUtilization');
      expect(metrics).toHaveProperty('eventIndexing');
      expect(metrics).toHaveProperty('backgroundProcessing');

      expect(metrics.memoryUsage.isWithinLimits).toBeDefined();
      expect(metrics.operationLatency.averageResponseTime).toBeGreaterThan(0);
    });

    test('should update metrics when monitoring is active', (done) => {
      const metricsSpy = jest.fn();
      monitor.on('metrics_updated', metricsSpy);

      monitor.startMonitoring(50);

      setTimeout(() => {
        expect(metricsSpy).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Resource Utilization', () => {
    test('should track CPU usage estimation', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.resourceUtilization.cpuUsage).toBeGreaterThanOrEqual(0);
    });

    test('should handle queue depth monitoring', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.resourceUtilization.queueDepth).toBeDefined();
      expect(metrics.resourceUtilization.backgroundTasks).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty operation timings', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.operationLatency.averageResponseTime).toBe(0);
      expect(metrics.operationLatency.p95ResponseTime).toBe(0);
      expect(metrics.operationLatency.p99ResponseTime).toBe(0);
    });

    test('should handle single operation timing', () => {
      monitor.recordOperationTiming('eventCreation', 100);
      const metrics = monitor.getMetrics();
      
      expect(metrics.operationLatency.eventCreation).toBe(100);
      expect(metrics.operationLatency.averageResponseTime).toBe(100);
    });

    test('should maintain peak memory usage', () => {
      const initialMetrics = monitor.getMetrics();
      const initialPeak = initialMetrics.memoryUsage.peakMemoryUsage;

      // Simulate memory usage increase
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: initialPeak + 1000000, // 1MB more
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      });

      const updatedMetrics = monitor.getMetrics();
      expect(updatedMetrics.memoryUsage.peakMemoryUsage).toBeGreaterThan(initialPeak);

      // Restore
      process.memoryUsage = originalMemoryUsage;
    });
  });
});