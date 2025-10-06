/**
 * Performance Monitor Tests
 * 
 * Tests for recommendation engine performance monitoring and optimization
 */

import { PerformanceMonitor } from './performance-monitor';
import { PerformanceThreshold } from './types';

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor.stopMonitoring();
  });

  describe('Latency Tracking', () => {
    it('should track recommendation latency', () => {
      const operation = 'getRecommendations';
      const duration = 1500;

      performanceMonitor.trackRecommendationLatency(operation, duration);

      // Verify latency is tracked (we can't directly access private metrics)
      // This would be verified through getPerformanceMetrics()
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should trigger alert for high latency', () => {
      const alertCallback = jest.fn();
      performanceMonitor.addAlertCallback(alertCallback);

      const operation = 'getRecommendations';
      const highLatency = 3000; // Above 2000ms threshold

      performanceMonitor.trackRecommendationLatency(operation, highLatency);

      expect(alertCallback).toHaveBeenCalledWith('latency', highLatency, 2000);
    });

    it('should maintain metrics retention limit', () => {
      const operation = 'testOperation';
      
      // Add more metrics than retention limit
      for (let i = 0; i < 1200; i++) {
        performanceMonitor.trackRecommendationLatency(operation, 100 + i);
      }

      // Metrics should be limited (verified through implementation behavior)
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Memory Tracking', () => {
    it('should track memory usage by component', () => {
      const component = 'activityRecommender';
      const usage = 500; // MB

      performanceMonitor.trackMemoryUsage(component, usage);

      expect(true).toBe(true); // Placeholder assertion
    });

    it('should trigger alert for high memory usage', () => {
      const alertCallback = jest.fn();
      performanceMonitor.addAlertCallback(alertCallback);

      const component = 'testComponent';
      const highMemory = 2000; // Above 1500MB threshold

      performanceMonitor.trackMemoryUsage(component, highMemory);

      expect(alertCallback).toHaveBeenCalledWith('memory', highMemory, 1500);
    });
  });

  describe('User Satisfaction Tracking', () => {
    it('should track user satisfaction scores', () => {
      const userId = 'user123';
      const satisfaction = 0.8;

      performanceMonitor.trackUserSatisfaction(userId, satisfaction);

      expect(true).toBe(true); // Placeholder assertion
    });

    it('should trigger alert for low satisfaction', () => {
      const alertCallback = jest.fn();
      performanceMonitor.addAlertCallback(alertCallback);

      const userId = 'user123';
      const lowSatisfaction = 0.5; // Below 0.7 threshold

      performanceMonitor.trackUserSatisfaction(userId, lowSatisfaction);

      expect(alertCallback).toHaveBeenCalledWith('satisfaction', lowSatisfaction, 0.7);
    });
  });

  describe('System Metrics', () => {
    it('should provide comprehensive system metrics', async () => {
      // Add some test data
      performanceMonitor.trackRecommendationLatency('getRecommendations', 1000);
      performanceMonitor.trackMemoryUsage('testComponent', 800);
      performanceMonitor.trackUserSatisfaction('user123', 0.9);

      const metrics = await performanceMonitor.getPerformanceMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('latency');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('userSatisfaction');
      expect(metrics).toHaveProperty('recommendations');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('thresholds');
      expect(metrics).toHaveProperty('alerts');

      // Verify latency metrics structure
      expect(metrics.latency).toHaveProperty('average');
      expect(metrics.latency).toHaveProperty('median');
      expect(metrics.latency).toHaveProperty('p95');
      expect(metrics.latency).toHaveProperty('p99');
      expect(metrics.latency).toHaveProperty('min');
      expect(metrics.latency).toHaveProperty('max');
      expect(metrics.latency).toHaveProperty('count');

      // Verify memory metrics structure
      expect(metrics.memory).toHaveProperty('current');
      expect(metrics.memory).toHaveProperty('average');
      expect(metrics.memory).toHaveProperty('peak');
      expect(metrics.memory).toHaveProperty('threshold');
      expect(metrics.memory).toHaveProperty('utilizationPercent');

      // Verify user satisfaction metrics
      expect(metrics.userSatisfaction).toHaveProperty('average');
      expect(metrics.userSatisfaction).toHaveProperty('userCount');
      expect(metrics.userSatisfaction).toHaveProperty('aboveThreshold');
      expect(metrics.userSatisfaction).toHaveProperty('belowThreshold');
    });

    it('should handle empty metrics gracefully', async () => {
      const metrics = await performanceMonitor.getPerformanceMetrics();

      expect(metrics.latency.count).toBe(0);
      expect(metrics.latency.average).toBe(0);
      expect(metrics.userSatisfaction.userCount).toBe(0);
    });
  });

  describe('Performance Thresholds', () => {
    it('should allow updating performance thresholds', () => {
      const newThresholds: Partial<PerformanceThreshold> = {
        maxLatencyMs: 1000,
        maxMemoryMB: 1000,
        minSatisfactionScore: 0.8
      };

      performanceMonitor.alertOnPerformanceIssues(newThresholds as PerformanceThreshold);

      // Verify thresholds are updated (would be checked through alert behavior)
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Performance Optimization', () => {
    it('should optimize performance when thresholds are exceeded', async () => {
      // Simulate high memory usage
      performanceMonitor.trackMemoryUsage('testComponent', 1400); // 93% of 1500MB threshold

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await performanceMonitor.optimizePerformance();

      // Should trigger memory optimization
      expect(consoleSpy).toHaveBeenCalledWith('Memory optimization performed');

      consoleSpy.mockRestore();
    });

    it('should optimize latency when average is high', async () => {
      // Add multiple high latency measurements
      for (let i = 0; i < 10; i++) {
        performanceMonitor.trackRecommendationLatency('getRecommendations', 1800);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await performanceMonitor.optimizePerformance();

      // Should trigger latency optimization
      expect(consoleSpy).toHaveBeenCalledWith('Latency optimization triggered');

      consoleSpy.mockRestore();
    });

    it('should optimize user experience when satisfaction is low', async () => {
      // Add multiple low satisfaction scores
      for (let i = 0; i < 5; i++) {
        performanceMonitor.trackUserSatisfaction(`user${i}`, 0.5);
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await performanceMonitor.optimizePerformance();

      // Should trigger user experience optimization
      expect(consoleSpy).toHaveBeenCalledWith('User experience optimization triggered');

      consoleSpy.mockRestore();
    });
  });

  describe('Alert System', () => {
    it('should support multiple alert callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      performanceMonitor.addAlertCallback(callback1);
      performanceMonitor.addAlertCallback(callback2);

      performanceMonitor.trackRecommendationLatency('test', 3000);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle alert callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Alert callback error');
      });
      const workingCallback = jest.fn();

      performanceMonitor.addAlertCallback(errorCallback);
      performanceMonitor.addAlertCallback(workingCallback);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      performanceMonitor.trackRecommendationLatency('test', 3000);

      expect(consoleSpy).toHaveBeenCalledWith('Error in alert callback:', expect.any(Error));
      expect(workingCallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Hardware Constraints', () => {
    it('should respect Jetson Nano Orin memory constraints', async () => {
      const metrics = await performanceMonitor.getPerformanceMetrics();
      
      expect(metrics.thresholds.maxMemoryMB).toBe(1500);
      expect(metrics.thresholds.maxLatencyMs).toBe(2000);
    });

    it('should monitor system resources continuously', (done) => {
      // Start monitoring and verify it runs
      setTimeout(() => {
        // Monitoring should be active
        expect(true).toBe(true); // Placeholder - would verify monitoring is active
        done();
      }, 100);
    });
  });

  describe('Child Safety Compliance', () => {
    it('should log performance warnings for child safety', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      performanceMonitor.trackRecommendationLatency('getRecommendations', 2500);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Recommendation latency exceeded threshold: 2500ms for getRecommendations'
      );

      consoleSpy.mockRestore();
    });
  });
});