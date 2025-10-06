import { ResourceMonitor, AlertType, AlertSeverity, ResourceThresholds } from './resource-monitor';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;
  let mockThresholds: ResourceThresholds;

  beforeEach(() => {
    mockThresholds = {
      maxGPUMemoryGB: 2.0,
      maxCPUUsage: 70,
      minFPS: 45,
      maxRenderTime: 22,
      criticalGPUMemoryGB: 1.8,
      criticalCPUUsage: 85,
      criticalFPS: 30,
      maxMemoryUsageGB: 6.0,
      maxGPUTemperature: 80,
      maxCPUTemperature: 85
    };
    
    monitor = new ResourceMonitor(mockThresholds);
  });

  afterEach(async () => {
    await monitor.stopMonitoring();
  });

  describe('Monitoring Lifecycle', () => {
    it('should start monitoring successfully', async () => {
      const startedSpy = jest.fn();
      monitor.on('monitoringStarted', startedSpy);

      await monitor.startMonitoring();
      
      expect(startedSpy).toHaveBeenCalled();
    });

    it('should stop monitoring successfully', async () => {
      const stoppedSpy = jest.fn();
      monitor.on('monitoringStopped', stoppedSpy);

      await monitor.startMonitoring();
      await monitor.stopMonitoring();
      
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start monitoring twice', async () => {
      const startedSpy = jest.fn();
      monitor.on('monitoringStarted', startedSpy);

      await monitor.startMonitoring();
      await monitor.startMonitoring(); // Second call should be ignored
      
      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle stop monitoring when not started', async () => {
      const stoppedSpy = jest.fn();
      monitor.on('monitoringStopped', stoppedSpy);

      await monitor.stopMonitoring();
      
      expect(stoppedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and store metrics', async () => {
      const metricsUpdateSpy = jest.fn();
      monitor.on('metricsUpdate', metricsUpdateSpy);

      await monitor.startMonitoring();
      
      // Wait for at least one metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(metricsUpdateSpy).toHaveBeenCalled();
      
      const currentMetrics = monitor.getCurrentMetrics();
      expect(currentMetrics).toBeTruthy();
      expect(currentMetrics?.gpu).toBeDefined();
      expect(currentMetrics?.cpu).toBeDefined();
      expect(currentMetrics?.memory).toBeDefined();
      expect(currentMetrics?.rendering).toBeDefined();
      expect(currentMetrics?.system).toBeDefined();
    });

    it('should return null for current metrics when no data collected', () => {
      const currentMetrics = monitor.getCurrentMetrics();
      expect(currentMetrics).toBeNull();
    });

    it('should calculate average metrics correctly', async () => {
      await monitor.startMonitoring();
      
      // Wait for multiple metrics collections
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      const avgMetrics = monitor.getAverageMetrics(2000);
      expect(avgMetrics).toBeTruthy();
      expect(avgMetrics?.gpu.memoryUsageGB).toBeGreaterThan(0);
      expect(avgMetrics?.cpu.usagePercent).toBeGreaterThan(0);
    });

    it('should return null for average metrics when no data in time window', () => {
      const avgMetrics = monitor.getAverageMetrics(1000);
      expect(avgMetrics).toBeNull();
    });
  });

  describe('Performance Thresholds', () => {
    it('should detect GPU memory threshold violations', async () => {
      const alertSpy = jest.fn();
      monitor.on('performanceAlert', alertSpy);

      // Create monitor with very low thresholds to trigger alerts
      const lowThresholds: ResourceThresholds = {
        ...mockThresholds,
        maxGPUMemoryGB: 0.1,
        criticalGPUMemoryGB: 0.05
      };
      
      const testMonitor = new ResourceMonitor(lowThresholds);
      testMonitor.on('performanceAlert', alertSpy);
      
      await testMonitor.startMonitoring();
      
      // Wait for metrics collection and threshold checking
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await testMonitor.stopMonitoring();
      
      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe(AlertType.GPU_MEMORY);
      expect(alert.severity).toBeOneOf([AlertSeverity.WARNING, AlertSeverity.CRITICAL]);
    });

    it('should detect CPU usage threshold violations', async () => {
      const alertSpy = jest.fn();
      
      // Create monitor with very low CPU thresholds
      const lowThresholds: ResourceThresholds = {
        ...mockThresholds,
        maxCPUUsage: 5,
        criticalCPUUsage: 10
      };
      
      const testMonitor = new ResourceMonitor(lowThresholds);
      testMonitor.on('performanceAlert', alertSpy);
      
      await testMonitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await testMonitor.stopMonitoring();
      
      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe(AlertType.CPU_USAGE);
    });

    it('should detect FPS threshold violations', async () => {
      const alertSpy = jest.fn();
      
      // Create monitor with very high FPS thresholds
      const highThresholds: ResourceThresholds = {
        ...mockThresholds,
        minFPS: 100,
        criticalFPS: 90
      };
      
      const testMonitor = new ResourceMonitor(highThresholds);
      testMonitor.on('performanceAlert', alertSpy);
      
      await testMonitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      await testMonitor.stopMonitoring();
      
      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe(AlertType.FPS_DROP);
    });

    it('should respect alert cooldown periods', async () => {
      const alertSpy = jest.fn();
      
      // Create monitor with very low thresholds to ensure alerts
      const lowThresholds: ResourceThresholds = {
        ...mockThresholds,
        maxGPUMemoryGB: 0.1
      };
      
      const testMonitor = new ResourceMonitor(lowThresholds);
      testMonitor.on('performanceAlert', alertSpy);
      
      await testMonitor.startMonitoring();
      
      // Wait for multiple metrics collections
      await new Promise(resolve => setTimeout(resolve, 3100));
      
      await testMonitor.stopMonitoring();
      
      // Should have received alerts, but not too many due to cooldown
      expect(alertSpy).toHaveBeenCalled();
      expect(alertSpy.mock.calls.length).toBeLessThan(5); // Cooldown should limit alerts
    });
  });

  describe('Performance Trends', () => {
    it('should calculate performance trends', async () => {
      await monitor.startMonitoring();
      
      // Wait for multiple metrics collections
      await new Promise(resolve => setTimeout(resolve, 3100));
      
      const trends = monitor.getPerformanceTrends(3000);
      expect(trends).toBeDefined();
      expect(Array.isArray(trends)).toBe(true);
      
      if (trends.length > 0) {
        expect(trends[0]).toHaveProperty('timestamp');
        expect(trends[0]).toHaveProperty('fps');
        expect(trends[0]).toHaveProperty('gpuMemory');
        expect(trends[0]).toHaveProperty('cpuUsage');
        expect(trends[0]).toHaveProperty('renderTime');
      }
    });

    it('should return empty trends for insufficient data', () => {
      const trends = monitor.getPerformanceTrends(1000);
      expect(trends).toEqual([]);
    });
  });

  describe('System Health Status', () => {
    it('should calculate system health status', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const healthStatus = monitor.getSystemHealthStatus();
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBeOneOf(['healthy', 'warning', 'critical', 'unknown']);
      expect(healthStatus.components).toBeDefined();
      expect(healthStatus.components.gpu).toBeDefined();
      expect(healthStatus.components.cpu).toBeDefined();
      expect(healthStatus.components.memory).toBeDefined();
      expect(healthStatus.components.rendering).toBeDefined();
      expect(healthStatus.score).toBeGreaterThanOrEqual(0);
      expect(healthStatus.score).toBeLessThanOrEqual(100);
    });

    it('should return unknown status when no metrics available', () => {
      const healthStatus = monitor.getSystemHealthStatus();
      expect(healthStatus.overall).toBe('unknown');
      expect(healthStatus.score).toBe(0);
    });
  });

  describe('Optimization Recommendations', () => {
    it('should generate optimization recommendations', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const recommendations = monitor.generateOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
      
      recommendations.forEach((rec: any) => {
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('action');
        expect(rec).toHaveProperty('expectedImprovement');
        expect(rec).toHaveProperty('implementationComplexity');
      });
    });

    it('should return empty recommendations when no metrics available', () => {
      const recommendations = monitor.generateOptimizationRecommendations();
      expect(recommendations).toEqual([]);
    });
  });

  describe('Threshold Management', () => {
    it('should update thresholds', () => {
      const thresholdsSpy = jest.fn();
      monitor.on('thresholdsUpdated', thresholdsSpy);

      const newThresholds = { maxGPUMemoryGB: 1.5, maxCPUUsage: 80 };
      monitor.updateThresholds(newThresholds);

      expect(thresholdsSpy).toHaveBeenCalledWith(expect.objectContaining(newThresholds));
      
      const currentThresholds = monitor.getThresholds();
      expect(currentThresholds.maxGPUMemoryGB).toBe(1.5);
      expect(currentThresholds.maxCPUUsage).toBe(80);
    });

    it('should get current thresholds', () => {
      const thresholds = monitor.getThresholds();
      expect(thresholds).toEqual(mockThresholds);
    });
  });

  describe('Data Management', () => {
    it('should clear metrics history', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(monitor.getCurrentMetrics()).toBeTruthy();
      
      const historyClearedSpy = jest.fn();
      monitor.on('historyCleared', historyClearedSpy);
      
      monitor.clearHistory();
      
      expect(historyClearedSpy).toHaveBeenCalled();
      expect(monitor.getCurrentMetrics()).toBeNull();
    });

    it('should export metrics data', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      const exportedMetrics = monitor.exportMetrics();
      expect(Array.isArray(exportedMetrics)).toBe(true);
      expect(exportedMetrics.length).toBeGreaterThan(0);
    });

    it('should export metrics data with time range filter', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      const now = Date.now();
      const timeRange = { start: now - 1000, end: now };
      const exportedMetrics = monitor.exportMetrics(timeRange);
      
      expect(Array.isArray(exportedMetrics)).toBe(true);
      exportedMetrics.forEach((metric: any) => {
        expect(metric.timestamp).toBeGreaterThanOrEqual(timeRange.start);
        expect(metric.timestamp).toBeLessThanOrEqual(timeRange.end);
      });
    });
  });

  describe('Error Handling', () => {
    it('should emit error events when metrics collection fails', async () => {
      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      // Mock a method to throw an error
      const originalCollectGPUMetrics = (monitor as any).collectGPUMetrics;
      (monitor as any).collectGPUMetrics = jest.fn().mockRejectedValue(new Error('GPU metrics failed'));

      await monitor.startMonitoring();
      
      // Wait for error to occur
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(errorSpy).toHaveBeenCalled();
      
      // Restore original method
      (monitor as any).collectGPUMetrics = originalCollectGPUMetrics;
    });
  });

  describe('Hardware-Specific Validation', () => {
    it('should validate Jetson Nano Orin constraints', async () => {
      await monitor.startMonitoring();
      
      // Wait for metrics collection
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const metrics = monitor.getCurrentMetrics();
      expect(metrics).toBeTruthy();
      
      if (metrics) {
        // Validate GPU memory constraints (2GB limit)
        expect(metrics.gpu.memoryUsageGB).toBeLessThanOrEqual(2.0);
        
        // Validate CPU core count (6 cores on Jetson Nano Orin)
        expect(metrics.cpu.coreCount).toBe(6);
        
        // Validate total memory (8GB on Jetson Nano Orin)
        expect(metrics.memory.totalGB).toBe(8.0);
        
        // Validate reasonable temperature ranges
        expect(metrics.gpu.temperature).toBeGreaterThan(20);
        expect(metrics.gpu.temperature).toBeLessThan(100);
        expect(metrics.cpu.temperature).toBeGreaterThan(20);
        expect(metrics.cpu.temperature).toBeLessThan(100);
      }
    });

    it('should enforce performance constraints for child safety', async () => {
      const thresholds = monitor.getThresholds();
      
      // Validate that thresholds ensure responsive system for child interactions
      expect(thresholds.minFPS).toBeGreaterThanOrEqual(30); // Minimum for smooth interaction
      expect(thresholds.maxRenderTime).toBeLessThanOrEqual(33); // Max for 30fps
      expect(thresholds.maxCPUUsage).toBeLessThanOrEqual(80); // Leave headroom for voice processing
      expect(thresholds.maxGPUMemoryGB).toBeLessThanOrEqual(2.0); // Hardware constraint
    });
  });

  describe('Real-time Performance Monitoring', () => {
    it('should provide consistent metrics updates', async () => {
      const metricsUpdates: any[] = [];
      monitor.on('metricsUpdate', (metrics: any) => {
        metricsUpdates.push(metrics);
      });

      await monitor.startMonitoring();
      
      // Wait for multiple updates
      await new Promise(resolve => setTimeout(resolve, 3100));
      
      expect(metricsUpdates.length).toBeGreaterThanOrEqual(2);
      
      // Validate metrics consistency
      metricsUpdates.forEach((metrics: any) => {
        expect(metrics.timestamp).toBeGreaterThan(0);
        expect(metrics.gpu.memoryUsageGB).toBeGreaterThan(0);
        expect(metrics.cpu.usagePercent).toBeGreaterThanOrEqual(0);
        expect(metrics.rendering.currentFPS).toBeGreaterThan(0);
      });
    });

    it('should maintain metrics history within limits', async () => {
      await monitor.startMonitoring();
      
      // Wait for many metrics collections (simulate long running)
      await new Promise(resolve => setTimeout(resolve, 5100));
      
      const exportedMetrics = monitor.exportMetrics();
      
      // Should not exceed history limit (300 entries)
      expect(exportedMetrics.length).toBeLessThanOrEqual(300);
    });
  });
});

// Custom Jest matchers
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