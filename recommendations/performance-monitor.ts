/**
 * Performance Monitor for Recommendations Engine
 * 
 * Implements comprehensive performance monitoring and optimization
 * for the personalized recommendations system with hardware constraints
 * awareness and real-time metrics tracking.
 */

import { IPerformanceMonitor } from './interfaces';
import { SystemMetrics, PerformanceThreshold } from './types';

/**
 * Performance metrics tracking and optimization system
 * Designed for Jetson Nano Orin hardware constraints
 */
export class PerformanceMonitor implements IPerformanceMonitor {
  private latencyMetrics: Map<string, number[]> = new Map();
  private memoryMetrics: Map<string, number[]> = new Map();
  private userSatisfactionMetrics: Map<string, number[]> = new Map();
  private systemResourceMetrics: {
    cpuUsage: number[];
    memoryUsage: number[];
    diskUsage: number[];
    networkLatency: number[];
  } = {
    cpuUsage: [],
    memoryUsage: [],
    diskUsage: [],
    networkLatency: []
  };

  private performanceThresholds: PerformanceThreshold = {
    maxLatencyMs: 2000,
    maxMemoryMB: 1500,
    minSatisfactionScore: 0.7,
    maxCpuUsagePercent: 80,
    maxConcurrentRequests: 5
  };

  private alertCallbacks: ((metric: string, value: number, threshold: number) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_RETENTION_COUNT = 1000;
  private readonly MONITORING_INTERVAL_MS = 5000; // 5 seconds

  constructor() {
    this.startSystemMonitoring();
  }

  /**
   * Track recommendation generation latency
   */
  trackRecommendationLatency(operation: string, duration: number): void {
    const metrics = this.latencyMetrics.get(operation) || [];
    metrics.push(duration);
    
    // Keep only recent metrics for memory efficiency
    if (metrics.length > this.METRICS_RETENTION_COUNT) {
      metrics.shift();
    }
    
    this.latencyMetrics.set(operation, metrics);

    // Check threshold and alert if exceeded
    if (duration > this.performanceThresholds.maxLatencyMs) {
      this.triggerAlert('latency', duration, this.performanceThresholds.maxLatencyMs);
    }

    // Log performance warning for child safety compliance
    if (duration > this.performanceThresholds.maxLatencyMs) {
      console.warn(`Recommendation latency exceeded threshold: ${duration}ms for ${operation}`);
    }
  }

  /**
   * Track memory usage by component
   */
  trackMemoryUsage(component: string, usage: number): void {
    const metrics = this.memoryMetrics.get(component) || [];
    metrics.push(usage);
    
    // Keep only recent metrics
    if (metrics.length > this.METRICS_RETENTION_COUNT) {
      metrics.shift();
    }
    
    this.memoryMetrics.set(component, metrics);

    // Check memory threshold
    if (usage > this.performanceThresholds.maxMemoryMB) {
      this.triggerAlert('memory', usage, this.performanceThresholds.maxMemoryMB);
    }
  }

  /**
   * Track user satisfaction scores
   */
  trackUserSatisfaction(userId: string, satisfaction: number): void {
    const metrics = this.userSatisfactionMetrics.get(userId) || [];
    metrics.push(satisfaction);
    
    // Keep only recent metrics
    if (metrics.length > this.METRICS_RETENTION_COUNT) {
      metrics.shift();
    }
    
    this.userSatisfactionMetrics.set(userId, metrics);

    // Check satisfaction threshold
    if (satisfaction < this.performanceThresholds.minSatisfactionScore) {
      this.triggerAlert('satisfaction', satisfaction, this.performanceThresholds.minSatisfactionScore);
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<SystemMetrics> {
    const currentMemoryUsage = await this.getCurrentMemoryUsage();
    const currentCpuUsage = await this.getCurrentCpuUsage();

    return {
      timestamp: new Date(),
      latency: this.calculateLatencyMetrics(),
      memory: this.calculateMemoryMetrics(currentMemoryUsage),
      cpu: this.calculateCpuMetrics(currentCpuUsage),
      userSatisfaction: this.calculateSatisfactionMetrics(),
      recommendations: this.calculateRecommendationMetrics(),
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      thresholds: this.performanceThresholds,
      alerts: this.getRecentAlerts()
    };
  }

  /**
   * Set up performance threshold alerts
   */
  alertOnPerformanceIssues(threshold: PerformanceThreshold): void {
    this.performanceThresholds = { ...this.performanceThresholds, ...threshold };
  }

  /**
   * Add alert callback for performance issues
   */
  addAlertCallback(callback: (metric: string, value: number, threshold: number) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Start continuous system monitoring
   */
  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        // Monitor system resources
        const memoryUsage = await this.getCurrentMemoryUsage();
        const cpuUsage = await this.getCurrentCpuUsage();

        this.systemResourceMetrics.memoryUsage.push(memoryUsage);
        this.systemResourceMetrics.cpuUsage.push(cpuUsage);

        // Keep only recent metrics
        if (this.systemResourceMetrics.memoryUsage.length > this.METRICS_RETENTION_COUNT) {
          this.systemResourceMetrics.memoryUsage.shift();
          this.systemResourceMetrics.cpuUsage.shift();
        }

        // Check system thresholds
        if (memoryUsage > this.performanceThresholds.maxMemoryMB) {
          this.triggerAlert('system_memory', memoryUsage, this.performanceThresholds.maxMemoryMB);
        }

        if (cpuUsage > this.performanceThresholds.maxCpuUsagePercent) {
          this.triggerAlert('system_cpu', cpuUsage, this.performanceThresholds.maxCpuUsagePercent);
        }

      } catch (error) {
        console.error('Error in system monitoring:', error);
      }
    }, this.MONITORING_INTERVAL_MS);
  }

  /**
   * Stop system monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current memory usage in MB
   */
  private async getCurrentMemoryUsage(): Promise<number> {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // Convert to MB
  }

  /**
   * Get current CPU usage percentage
   */
  private async getCurrentCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000; // microseconds
        const totalCpuTime = currentUsage.user + currentUsage.system; // microseconds
        
        const cpuPercent = (totalCpuTime / totalTime) * 100;
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  /**
   * Calculate latency metrics summary
   */
  private calculateLatencyMetrics() {
    const allLatencies: number[] = [];
    for (const metrics of this.latencyMetrics.values()) {
      allLatencies.push(...metrics);
    }

    if (allLatencies.length === 0) {
      return {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        count: 0
      };
    }

    const sorted = allLatencies.sort((a, b) => a - b);
    return {
      average: allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count: allLatencies.length
    };
  }

  /**
   * Calculate memory metrics summary
   */
  private calculateMemoryMetrics(currentUsage: number) {
    const allMemoryUsage: number[] = [];
    for (const metrics of this.memoryMetrics.values()) {
      allMemoryUsage.push(...metrics);
    }

    return {
      current: currentUsage,
      average: allMemoryUsage.length > 0 ? 
        allMemoryUsage.reduce((a, b) => a + b, 0) / allMemoryUsage.length : 0,
      peak: allMemoryUsage.length > 0 ? Math.max(...allMemoryUsage) : 0,
      threshold: this.performanceThresholds.maxMemoryMB,
      utilizationPercent: (currentUsage / this.performanceThresholds.maxMemoryMB) * 100
    };
  }

  /**
   * Calculate CPU metrics summary
   */
  private calculateCpuMetrics(currentUsage: number) {
    const cpuMetrics = this.systemResourceMetrics.cpuUsage;
    
    return {
      current: currentUsage,
      average: cpuMetrics.length > 0 ? 
        cpuMetrics.reduce((a, b) => a + b, 0) / cpuMetrics.length : 0,
      peak: cpuMetrics.length > 0 ? Math.max(...cpuMetrics) : 0,
      threshold: this.performanceThresholds.maxCpuUsagePercent
    };
  }

  /**
   * Calculate user satisfaction metrics
   */
  private calculateSatisfactionMetrics() {
    const allSatisfaction: number[] = [];
    for (const metrics of this.userSatisfactionMetrics.values()) {
      allSatisfaction.push(...metrics);
    }

    if (allSatisfaction.length === 0) {
      return {
        average: 0,
        userCount: 0,
        aboveThreshold: 0,
        belowThreshold: 0
      };
    }

    const aboveThreshold = allSatisfaction.filter(s => s >= this.performanceThresholds.minSatisfactionScore).length;
    
    return {
      average: allSatisfaction.reduce((a, b) => a + b, 0) / allSatisfaction.length,
      userCount: this.userSatisfactionMetrics.size,
      aboveThreshold,
      belowThreshold: allSatisfaction.length - aboveThreshold
    };
  }

  /**
   * Calculate recommendation-specific metrics
   */
  private calculateRecommendationMetrics() {
    const operationCounts = new Map<string, number>();
    for (const [operation, metrics] of this.latencyMetrics.entries()) {
      operationCounts.set(operation, metrics.length);
    }

    return {
      totalRequests: Array.from(this.latencyMetrics.values()).reduce((sum, metrics) => sum + metrics.length, 0),
      operationBreakdown: Object.fromEntries(operationCounts),
      averageLatencyByOperation: Object.fromEntries(
        Array.from(this.latencyMetrics.entries()).map(([op, metrics]) => [
          op,
          metrics.length > 0 ? metrics.reduce((a, b) => a + b, 0) / metrics.length : 0
        ])
      )
    };
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(metric: string, value: number, threshold: number): void {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(metric, value, threshold);
      } catch (error) {
        console.error('Error in alert callback:', error);
      }
    });
  }

  /**
   * Get recent alerts (placeholder for alert history)
   */
  private getRecentAlerts(): any[] {
    // This would be implemented with actual alert storage
    return [];
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<void> {
    const metrics = await this.getPerformanceMetrics();

    // Memory optimization
    if (metrics.memory.utilizationPercent > 80) {
      this.optimizeMemoryUsage();
    }

    // Latency optimization
    if (metrics.latency.average > this.performanceThresholds.maxLatencyMs * 0.8) {
      this.optimizeLatency();
    }

    // User satisfaction optimization
    if (metrics.userSatisfaction.average < this.performanceThresholds.minSatisfactionScore) {
      this.optimizeUserExperience();
    }
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemoryUsage(): void {
    // Clear old metrics
    for (const [key, metrics] of this.latencyMetrics.entries()) {
      if (metrics.length > this.METRICS_RETENTION_COUNT / 2) {
        this.latencyMetrics.set(key, metrics.slice(-this.METRICS_RETENTION_COUNT / 2));
      }
    }

    for (const [key, metrics] of this.memoryMetrics.entries()) {
      if (metrics.length > this.METRICS_RETENTION_COUNT / 2) {
        this.memoryMetrics.set(key, metrics.slice(-this.METRICS_RETENTION_COUNT / 2));
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    console.log('Memory optimization performed');
  }

  /**
   * Optimize latency performance
   */
  private optimizeLatency(): void {
    // This would implement latency optimization strategies
    console.log('Latency optimization triggered');
  }

  /**
   * Optimize user experience based on satisfaction metrics
   */
  private optimizeUserExperience(): void {
    // This would implement user experience optimization
    console.log('User experience optimization triggered');
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();