// Performance Monitor Tests

import { DefaultPerformanceMonitor, PerformanceThresholds, AlertType, AlertSeverity } from './performance-monitor';
import { DefaultLearningEventBus } from './events';

describe('DefaultPerformanceMonitor', () => {
  let performanceMonitor: DefaultPerformanceMonitor;
  let eventBus: DefaultLearningEventBus;

  beforeEach(async () => {
    jest.useFakeTimers();
    eventBus = new DefaultLearningEventBus();
    performanceMonitor = new DefaultPerformanceMonitor(eventBus);
  });

  afterEach(async () => {
    await performanceMonitor.stopMonitoring();
    // Clear any remaining timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Resource Monitoring', () => {
    it('should start and stop monitoring successfully', async () => {
      await performanceMonitor.startMonitoring();
      
      // Advance timers to trigger monitoring
      jest.advanceTimersByTime(100);
      
      await performanceMonitor.stopMonitoring();
    });

    it('should collect resource metrics', async () => {
      await performanceMonitor.startMonitoring();
      
      // Advance timers to ensure initialization
      jest.advanceTimersByTime(100);
      
      const metrics = await performanceMonitor.getResourceMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.memoryUsageMB).toBe('number');
      expect(typeof metrics.cpuUsagePercent).toBe('number');
      expect(typeof metrics.availableMemoryMB).toBe('number');
      expect(metrics.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should collect latency metrics', async () => {
      await performanceMonitor.startMonitoring();
      
      // Track some inference operations
      await performanceMonitor.trackInferenceLatency('test_operation', 50);
      await performanceMonitor.trackInferenceLatency('test_operation', 75);
      await performanceMonitor.trackTrainingLatency('training_operation', 2000);
      
      const metrics = await performanceMonitor.getLatencyMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalInferenceOperations).toBe(2);
      expect(metrics.totalTrainingOperations).toBe(1);
      expect(metrics.averageInferenceLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('Threshold Management', () => {
    it('should set and use custom thresholds', async () => {
      await performanceMonitor.startMonitoring();
      jest.advanceTimersByTime(100);
      
      const customThresholds: PerformanceThresholds = {
        maxMemoryUsageMB: 4096,
        maxCpuUsagePercent: 75,
        maxInferenceLatencyMs: 50,
        maxTrainingLatencyMs: 5000,
        minAvailableMemoryMB: 1024,
        maxGpuUsagePercent: 90,
        maxGpuMemoryUsageMB: 4096,
        maxDiskUsagePercent: 85,
        maxNetworkLatencyMs: 1000,
        performanceDegradationThreshold: 0.2
      };

      await performanceMonitor.setThresholds(customThresholds);
      
      const report = await performanceMonitor.getPerformanceReport();
      expect(report.thresholds.maxMemoryUsageMB).toBe(4096);
      expect(report.thresholds.maxCpuUsagePercent).toBe(75);
      expect(report.thresholds.maxInferenceLatencyMs).toBe(50);
    });

    it('should detect performance degradation', async () => {
      await performanceMonitor.startMonitoring();
      jest.advanceTimersByTime(100);
      
      // Set very low thresholds to trigger degradation
      await performanceMonitor.setThresholds({
        maxMemoryUsageMB: 1, // Very low threshold
        maxCpuUsagePercent: 1,
        maxInferenceLatencyMs: 1,
        maxTrainingLatencyMs: 1,
        minAvailableMemoryMB: 10000, // Very high threshold
        maxGpuUsagePercent: 1,
        maxGpuMemoryUsageMB: 1,
        maxDiskUsagePercent: 1,
        maxNetworkLatencyMs: 1,
        performanceDegradationThreshold: 0.1
      });
      
      // Advance timers to trigger monitoring cycles
      jest.advanceTimersByTime(1500);
      
      const isDegraded = await performanceMonitor.isPerformanceDegraded();
      expect(isDegraded).toBe(true);
    });
  });

  describe('Alert System', () => {
    it('should generate alerts for threshold violations', async () => {
      await performanceMonitor.startMonitoring();
      
      // Track high latency to trigger alert
      await performanceMonitor.trackInferenceLatency('slow_operation', 200);
      
      const alerts = await performanceMonitor.getAlerts();
      const latencyAlerts = alerts.filter(alert => alert.type === AlertType.LATENCY_THRESHOLD_EXCEEDED);
      
      expect(latencyAlerts.length).toBeGreaterThan(0);
      expect(latencyAlerts[0].severity).toBe(AlertSeverity.HIGH);
    });

    it('should clear alerts', async () => {
      await performanceMonitor.startMonitoring();
      
      // Generate some alerts
      await performanceMonitor.trackInferenceLatency('slow_operation', 200);
      
      let alerts = await performanceMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      await performanceMonitor.clearAlerts();
      alerts = await performanceMonitor.getAlerts();
      expect(alerts.length).toBe(0);
    });
  });

  describe('Performance Reporting', () => {
    it('should generate comprehensive performance report', async () => {
      await performanceMonitor.startMonitoring();
      jest.advanceTimersByTime(100);
      
      // Generate some activity
      await performanceMonitor.trackInferenceLatency('test_op', 25);
      await performanceMonitor.trackTrainingLatency('train_op', 1500);
      
      // Advance timers to collect monitoring data
      jest.advanceTimersByTime(1100);
      
      const report = await performanceMonitor.getPerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.resourceMetrics).toBeDefined();
      expect(report.latencyMetrics).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.thresholds).toBeDefined();
      expect(report.overallHealth).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide health status assessment', async () => {
      await performanceMonitor.startMonitoring();
      jest.advanceTimersByTime(100);
      
      const report = await performanceMonitor.getPerformanceReport();
      
      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(report.overallHealth);
    });

    it('should provide performance recommendations', async () => {
      await performanceMonitor.startMonitoring();
      jest.advanceTimersByTime(100);
      
      // Set thresholds that will trigger recommendations
      await performanceMonitor.setThresholds({
        maxMemoryUsageMB: 100, // Low threshold to trigger recommendations
        maxCpuUsagePercent: 10,
        maxInferenceLatencyMs: 10,
        maxTrainingLatencyMs: 100,
        minAvailableMemoryMB: 10000,
        maxGpuUsagePercent: 10,
        maxGpuMemoryUsageMB: 100,
        maxDiskUsagePercent: 10,
        maxNetworkLatencyMs: 1,
        performanceDegradationThreshold: 0.1
      });
      
      // Advance timers to collect monitoring data
      jest.advanceTimersByTime(1100);
      
      const report = await performanceMonitor.getPerformanceReport();
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      // Should have recommendations due to low thresholds
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});