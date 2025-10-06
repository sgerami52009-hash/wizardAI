// Performance Monitor for Learning Engine Resource Tracking

import { EventEmitter } from 'events';
import { LearningEventBus, LearningEventType, createPerformanceEvent } from './events';
import { PerformanceDegradationError, ResourceExhaustionError } from './errors';

export interface PerformanceMonitor {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  getResourceMetrics(): Promise<ResourceMetrics>;
  getLatencyMetrics(): Promise<LatencyMetrics>;
  getPerformanceReport(): Promise<PerformanceReport>;
  setThresholds(thresholds: PerformanceThresholds): Promise<void>;
  isPerformanceDegraded(): Promise<boolean>;
  getAlerts(): Promise<PerformanceAlert[]>;
  clearAlerts(): Promise<void>;
}

export class DefaultPerformanceMonitor implements PerformanceMonitor {
  private eventBus: LearningEventBus;
  private eventEmitter: EventEmitter;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private metricsHistory: PerformanceSnapshot[] = [];
  private latencyTracker: LatencyTracker;
  private resourceTracker: ResourceTracker;
  
  private readonly MONITORING_INTERVAL_MS = 1000; // 1 second
  private readonly MAX_HISTORY_SIZE = 3600; // 1 hour of data
  private readonly MAX_ALERTS = 100;

  constructor(eventBus: LearningEventBus) {
    this.eventBus = eventBus;
    this.eventEmitter = new EventEmitter();
    this.latencyTracker = new LatencyTracker();
    this.resourceTracker = new ResourceTracker();
    
    // Default thresholds based on Jetson Nano Orin constraints
    this.thresholds = {
      maxMemoryUsageMB: 6144, // 6GB out of 8GB total
      maxCpuUsagePercent: 85,
      maxInferenceLatencyMs: 100,
      maxTrainingLatencyMs: 5000,
      minAvailableMemoryMB: 1024, // Keep 1GB free
      maxGpuUsagePercent: 90,
      maxGpuMemoryUsageMB: 4096,
      maxDiskUsagePercent: 85,
      maxNetworkLatencyMs: 1000,
      performanceDegradationThreshold: 0.2 // 20% degradation
    };
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Initialize resource tracking
    await this.resourceTracker.initialize();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting performance metrics:', error);
      }
    }, this.MONITORING_INTERVAL_MS);
    
    // Use unref() to prevent the timer from keeping the process alive
    this.monitoringInterval.unref();

    // Emit monitoring started event
    await this.eventBus.emit(createPerformanceEvent(
      LearningEventType.SYSTEM_STARTED,
      { component: 'performance_monitor', status: 'started' }
    ));
  }

  public async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Emit monitoring stopped event
    await this.eventBus.emit(createPerformanceEvent(
      LearningEventType.SYSTEM_STOPPED,
      { component: 'performance_monitor', status: 'stopped' }
    ));
  }

  public async getResourceMetrics(): Promise<ResourceMetrics> {
    return await this.resourceTracker.getCurrentMetrics();
  }

  public async getLatencyMetrics(): Promise<LatencyMetrics> {
    return this.latencyTracker.getMetrics();
  }

  public async getPerformanceReport(): Promise<PerformanceReport> {
    const resourceMetrics = await this.getResourceMetrics();
    const latencyMetrics = await this.getLatencyMetrics();
    const currentTime = new Date();
    
    // Calculate trends from history
    const trends = this.calculateTrends();
    
    // Get recent alerts
    const recentAlerts = this.alerts.filter(alert => 
      currentTime.getTime() - alert.timestamp.getTime() < 3600000 // Last hour
    );

    return {
      timestamp: currentTime,
      resourceMetrics,
      latencyMetrics,
      trends,
      alerts: recentAlerts,
      thresholds: this.thresholds,
      overallHealth: this.calculateOverallHealth(resourceMetrics, latencyMetrics),
      recommendations: this.generateRecommendations(resourceMetrics, latencyMetrics, trends)
    };
  }

  public async setThresholds(thresholds: PerformanceThresholds): Promise<void> {
    this.thresholds = { ...this.thresholds, ...thresholds };
    
    // Emit threshold update event
    await this.eventBus.emit(createPerformanceEvent(
      LearningEventType.INFO,
      { 
        component: 'performance_monitor', 
        action: 'thresholds_updated',
        thresholds: this.thresholds
      }
    ));
  }

  public async isPerformanceDegraded(): Promise<boolean> {
    const resourceMetrics = await this.getResourceMetrics();
    const latencyMetrics = await this.getLatencyMetrics();
    
    // Check if any critical thresholds are exceeded
    return (
      resourceMetrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB ||
      resourceMetrics.cpuUsagePercent > this.thresholds.maxCpuUsagePercent ||
      latencyMetrics.averageInferenceLatencyMs > this.thresholds.maxInferenceLatencyMs ||
      resourceMetrics.availableMemoryMB < this.thresholds.minAvailableMemoryMB
    );
  }

  public async getAlerts(): Promise<PerformanceAlert[]> {
    return [...this.alerts];
  }

  public async clearAlerts(): Promise<void> {
    this.alerts = [];
  }

  // Method to track inference latency
  public async trackInferenceLatency(operation: string, latencyMs: number): Promise<void> {
    this.latencyTracker.recordInference(operation, latencyMs);
    
    // Check for latency threshold violations
    if (latencyMs > this.thresholds.maxInferenceLatencyMs) {
      await this.createAlert(
        AlertType.LATENCY_THRESHOLD_EXCEEDED,
        AlertSeverity.HIGH,
        `Inference latency exceeded threshold: ${latencyMs}ms > ${this.thresholds.maxInferenceLatencyMs}ms`,
        { operation, latencyMs, threshold: this.thresholds.maxInferenceLatencyMs }
      );
    }
  }

  // Method to track training latency
  public async trackTrainingLatency(operation: string, latencyMs: number): Promise<void> {
    this.latencyTracker.recordTraining(operation, latencyMs);
    
    // Check for training latency threshold violations
    if (latencyMs > this.thresholds.maxTrainingLatencyMs) {
      await this.createAlert(
        AlertType.TRAINING_LATENCY_HIGH,
        AlertSeverity.MEDIUM,
        `Training latency high: ${latencyMs}ms > ${this.thresholds.maxTrainingLatencyMs}ms`,
        { operation, latencyMs, threshold: this.thresholds.maxTrainingLatencyMs }
      );
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const resourceMetrics = await this.resourceTracker.getCurrentMetrics();
      const latencyMetrics = this.latencyTracker.getMetrics();
      
      const snapshot: PerformanceSnapshot = {
        timestamp: new Date(),
        resourceMetrics,
        latencyMetrics
      };

      // Add to history
      this.metricsHistory.push(snapshot);
      
      // Limit history size
      if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) {
        this.metricsHistory = this.metricsHistory.slice(-this.MAX_HISTORY_SIZE);
      }

      // Check thresholds and create alerts
      await this.checkThresholds(resourceMetrics, latencyMetrics);
      
    } catch (error) {
      console.error('Error in collectMetrics:', error);
    }
  }

  private async checkThresholds(
    resourceMetrics: ResourceMetrics, 
    latencyMetrics: LatencyMetrics
  ): Promise<void> {
    // Memory usage check
    if (resourceMetrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB) {
      await this.createAlert(
        AlertType.MEMORY_THRESHOLD_EXCEEDED,
        AlertSeverity.HIGH,
        `Memory usage exceeded threshold: ${resourceMetrics.memoryUsageMB}MB > ${this.thresholds.maxMemoryUsageMB}MB`,
        { current: resourceMetrics.memoryUsageMB, threshold: this.thresholds.maxMemoryUsageMB }
      );
    }

    // CPU usage check
    if (resourceMetrics.cpuUsagePercent > this.thresholds.maxCpuUsagePercent) {
      await this.createAlert(
        AlertType.CPU_THRESHOLD_EXCEEDED,
        AlertSeverity.MEDIUM,
        `CPU usage exceeded threshold: ${resourceMetrics.cpuUsagePercent}% > ${this.thresholds.maxCpuUsagePercent}%`,
        { current: resourceMetrics.cpuUsagePercent, threshold: this.thresholds.maxCpuUsagePercent }
      );
    }

    // Available memory check
    if (resourceMetrics.availableMemoryMB < this.thresholds.minAvailableMemoryMB) {
      await this.createAlert(
        AlertType.LOW_AVAILABLE_MEMORY,
        AlertSeverity.CRITICAL,
        `Available memory below threshold: ${resourceMetrics.availableMemoryMB}MB < ${this.thresholds.minAvailableMemoryMB}MB`,
        { current: resourceMetrics.availableMemoryMB, threshold: this.thresholds.minAvailableMemoryMB }
      );
    }

    // GPU usage check (if available)
    if (resourceMetrics.gpuUsagePercent !== undefined && 
        resourceMetrics.gpuUsagePercent > this.thresholds.maxGpuUsagePercent) {
      await this.createAlert(
        AlertType.GPU_THRESHOLD_EXCEEDED,
        AlertSeverity.MEDIUM,
        `GPU usage exceeded threshold: ${resourceMetrics.gpuUsagePercent}% > ${this.thresholds.maxGpuUsagePercent}%`,
        { current: resourceMetrics.gpuUsagePercent, threshold: this.thresholds.maxGpuUsagePercent }
      );
    }

    // Inference latency check
    if (latencyMetrics.averageInferenceLatencyMs > this.thresholds.maxInferenceLatencyMs) {
      await this.createAlert(
        AlertType.LATENCY_THRESHOLD_EXCEEDED,
        AlertSeverity.HIGH,
        `Average inference latency exceeded threshold: ${latencyMetrics.averageInferenceLatencyMs}ms > ${this.thresholds.maxInferenceLatencyMs}ms`,
        { current: latencyMetrics.averageInferenceLatencyMs, threshold: this.thresholds.maxInferenceLatencyMs }
      );
    }
  }

  private async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    data: Record<string, any>
  ): Promise<void> {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      timestamp: new Date(),
      data,
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Limit alerts size
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS);
    }

    // Emit alert event
    await this.eventBus.emit(createPerformanceEvent(
      severity === AlertSeverity.CRITICAL ? 
        LearningEventType.PERFORMANCE_DEGRADATION_DETECTED :
        LearningEventType.WARNING,
      { alert }
    ));

    // Emit to local event emitter for immediate handling
    this.eventEmitter.emit('alert', alert);
  }

  private calculateTrends(): PerformanceTrends {
    if (this.metricsHistory.length < 2) {
      return {
        memoryTrend: TrendDirection.STABLE,
        cpuTrend: TrendDirection.STABLE,
        latencyTrend: TrendDirection.STABLE,
        overallTrend: TrendDirection.STABLE
      };
    }

    const recent = this.metricsHistory.slice(-60); // Last minute
    const older = this.metricsHistory.slice(-120, -60); // Previous minute
    
    if (older.length === 0) {
      return {
        memoryTrend: TrendDirection.STABLE,
        cpuTrend: TrendDirection.STABLE,
        latencyTrend: TrendDirection.STABLE,
        overallTrend: TrendDirection.STABLE
      };
    }

    const recentAvg = this.calculateAverageMetrics(recent);
    const olderAvg = this.calculateAverageMetrics(older);

    return {
      memoryTrend: this.calculateTrendDirection(
        olderAvg.resourceMetrics.memoryUsageMB,
        recentAvg.resourceMetrics.memoryUsageMB
      ),
      cpuTrend: this.calculateTrendDirection(
        olderAvg.resourceMetrics.cpuUsagePercent,
        recentAvg.resourceMetrics.cpuUsagePercent
      ),
      latencyTrend: this.calculateTrendDirection(
        olderAvg.latencyMetrics.averageInferenceLatencyMs,
        recentAvg.latencyMetrics.averageInferenceLatencyMs
      ),
      overallTrend: TrendDirection.STABLE // Will be calculated based on other trends
    };
  }

  private calculateAverageMetrics(snapshots: PerformanceSnapshot[]): PerformanceSnapshot {
    if (snapshots.length === 0) {
      throw new Error('Cannot calculate average of empty snapshots array');
    }

    const sum = snapshots.reduce((acc, snapshot) => ({
      resourceMetrics: {
        memoryUsageMB: acc.resourceMetrics.memoryUsageMB + snapshot.resourceMetrics.memoryUsageMB,
        cpuUsagePercent: acc.resourceMetrics.cpuUsagePercent + snapshot.resourceMetrics.cpuUsagePercent,
        availableMemoryMB: acc.resourceMetrics.availableMemoryMB + snapshot.resourceMetrics.availableMemoryMB,
        diskUsagePercent: acc.resourceMetrics.diskUsagePercent + snapshot.resourceMetrics.diskUsagePercent,
        networkLatencyMs: acc.resourceMetrics.networkLatencyMs + snapshot.resourceMetrics.networkLatencyMs,
        gpuUsagePercent: (acc.resourceMetrics.gpuUsagePercent || 0) + (snapshot.resourceMetrics.gpuUsagePercent || 0),
        gpuMemoryUsageMB: (acc.resourceMetrics.gpuMemoryUsageMB || 0) + (snapshot.resourceMetrics.gpuMemoryUsageMB || 0),
        temperature: acc.resourceMetrics.temperature + snapshot.resourceMetrics.temperature
      },
      latencyMetrics: {
        averageInferenceLatencyMs: acc.latencyMetrics.averageInferenceLatencyMs + snapshot.latencyMetrics.averageInferenceLatencyMs,
        maxInferenceLatencyMs: Math.max(acc.latencyMetrics.maxInferenceLatencyMs, snapshot.latencyMetrics.maxInferenceLatencyMs),
        minInferenceLatencyMs: Math.min(acc.latencyMetrics.minInferenceLatencyMs, snapshot.latencyMetrics.minInferenceLatencyMs),
        averageTrainingLatencyMs: acc.latencyMetrics.averageTrainingLatencyMs + snapshot.latencyMetrics.averageTrainingLatencyMs,
        maxTrainingLatencyMs: Math.max(acc.latencyMetrics.maxTrainingLatencyMs, snapshot.latencyMetrics.maxTrainingLatencyMs),
        minTrainingLatencyMs: Math.min(acc.latencyMetrics.minTrainingLatencyMs, snapshot.latencyMetrics.minTrainingLatencyMs),
        p95InferenceLatencyMs: acc.latencyMetrics.p95InferenceLatencyMs + snapshot.latencyMetrics.p95InferenceLatencyMs,
        p99InferenceLatencyMs: acc.latencyMetrics.p99InferenceLatencyMs + snapshot.latencyMetrics.p99InferenceLatencyMs,
        totalInferenceOperations: acc.latencyMetrics.totalInferenceOperations + snapshot.latencyMetrics.totalInferenceOperations,
        totalTrainingOperations: acc.latencyMetrics.totalTrainingOperations + snapshot.latencyMetrics.totalTrainingOperations
      }
    }), {
      resourceMetrics: {
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        availableMemoryMB: 0,
        diskUsagePercent: 0,
        networkLatencyMs: 0,
        gpuUsagePercent: 0,
        gpuMemoryUsageMB: 0,
        temperature: 0
      },
      latencyMetrics: {
        averageInferenceLatencyMs: 0,
        maxInferenceLatencyMs: 0,
        minInferenceLatencyMs: Infinity,
        averageTrainingLatencyMs: 0,
        maxTrainingLatencyMs: 0,
        minTrainingLatencyMs: Infinity,
        p95InferenceLatencyMs: 0,
        p99InferenceLatencyMs: 0,
        totalInferenceOperations: 0,
        totalTrainingOperations: 0
      }
    });

    const count = snapshots.length;
    return {
      timestamp: new Date(),
      resourceMetrics: {
        memoryUsageMB: sum.resourceMetrics.memoryUsageMB / count,
        cpuUsagePercent: sum.resourceMetrics.cpuUsagePercent / count,
        availableMemoryMB: sum.resourceMetrics.availableMemoryMB / count,
        diskUsagePercent: sum.resourceMetrics.diskUsagePercent / count,
        networkLatencyMs: sum.resourceMetrics.networkLatencyMs / count,
        gpuUsagePercent: sum.resourceMetrics.gpuUsagePercent / count,
        gpuMemoryUsageMB: sum.resourceMetrics.gpuMemoryUsageMB / count,
        temperature: sum.resourceMetrics.temperature / count
      },
      latencyMetrics: {
        averageInferenceLatencyMs: sum.latencyMetrics.averageInferenceLatencyMs / count,
        maxInferenceLatencyMs: sum.latencyMetrics.maxInferenceLatencyMs,
        minInferenceLatencyMs: sum.latencyMetrics.minInferenceLatencyMs === Infinity ? 0 : sum.latencyMetrics.minInferenceLatencyMs,
        averageTrainingLatencyMs: sum.latencyMetrics.averageTrainingLatencyMs / count,
        maxTrainingLatencyMs: sum.latencyMetrics.maxTrainingLatencyMs,
        minTrainingLatencyMs: sum.latencyMetrics.minTrainingLatencyMs === Infinity ? 0 : sum.latencyMetrics.minTrainingLatencyMs,
        p95InferenceLatencyMs: sum.latencyMetrics.p95InferenceLatencyMs / count,
        p99InferenceLatencyMs: sum.latencyMetrics.p99InferenceLatencyMs / count,
        totalInferenceOperations: sum.latencyMetrics.totalInferenceOperations,
        totalTrainingOperations: sum.latencyMetrics.totalTrainingOperations
      }
    };
  }

  private calculateTrendDirection(oldValue: number, newValue: number): TrendDirection {
    const changePercent = Math.abs((newValue - oldValue) / oldValue);
    
    if (changePercent < 0.05) { // Less than 5% change
      return TrendDirection.STABLE;
    }
    
    return newValue > oldValue ? TrendDirection.INCREASING : TrendDirection.DECREASING;
  }

  private calculateOverallHealth(
    resourceMetrics: ResourceMetrics,
    latencyMetrics: LatencyMetrics
  ): HealthStatus {
    let score = 100;
    
    // Memory health (30% weight)
    const memoryUsageRatio = resourceMetrics.memoryUsageMB / this.thresholds.maxMemoryUsageMB;
    score -= Math.max(0, (memoryUsageRatio - 0.7) * 30 * 10); // Penalty starts at 70% usage
    
    // CPU health (25% weight)
    const cpuUsageRatio = resourceMetrics.cpuUsagePercent / this.thresholds.maxCpuUsagePercent;
    score -= Math.max(0, (cpuUsageRatio - 0.7) * 25 * 10);
    
    // Latency health (25% weight)
    const latencyRatio = latencyMetrics.averageInferenceLatencyMs / this.thresholds.maxInferenceLatencyMs;
    score -= Math.max(0, (latencyRatio - 0.7) * 25 * 10);
    
    // Available memory health (20% weight)
    const availableMemoryRatio = resourceMetrics.availableMemoryMB / this.thresholds.minAvailableMemoryMB;
    if (availableMemoryRatio < 1) {
      score -= (1 - availableMemoryRatio) * 20 * 10;
    }
    
    score = Math.max(0, Math.min(100, score));
    
    if (score >= 80) return HealthStatus.EXCELLENT;
    if (score >= 60) return HealthStatus.GOOD;
    if (score >= 40) return HealthStatus.FAIR;
    if (score >= 20) return HealthStatus.POOR;
    return HealthStatus.CRITICAL;
  }

  private generateRecommendations(
    resourceMetrics: ResourceMetrics,
    latencyMetrics: LatencyMetrics,
    trends: PerformanceTrends
  ): string[] {
    const recommendations: string[] = [];
    
    // Memory recommendations
    if (resourceMetrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB * 0.8) {
      recommendations.push('Consider optimizing model size or implementing model pruning');
    }
    
    if (resourceMetrics.availableMemoryMB < this.thresholds.minAvailableMemoryMB * 1.5) {
      recommendations.push('Free up memory by clearing unused models or reducing batch sizes');
    }
    
    // CPU recommendations
    if (resourceMetrics.cpuUsagePercent > this.thresholds.maxCpuUsagePercent * 0.8) {
      recommendations.push('Consider reducing concurrent operations or optimizing algorithms');
    }
    
    // Latency recommendations
    if (latencyMetrics.averageInferenceLatencyMs > this.thresholds.maxInferenceLatencyMs * 0.8) {
      recommendations.push('Consider model quantization or hardware acceleration');
    }
    
    // Trend-based recommendations
    if (trends.memoryTrend === TrendDirection.INCREASING) {
      recommendations.push('Memory usage is trending upward - monitor for potential memory leaks');
    }
    
    if (trends.latencyTrend === TrendDirection.INCREASING) {
      recommendations.push('Latency is increasing - consider performance optimization');
    }
    
    return recommendations;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Resource Tracker Class
class ResourceTracker {
  private initialized: boolean = false;

  public async initialize(): Promise<void> {
    this.initialized = true;
  }

  public async getCurrentMetrics(): Promise<ResourceMetrics> {
    if (!this.initialized) {
      throw new Error('ResourceTracker not initialized');
    }

    // Get system metrics (simplified implementation for cross-platform compatibility)
    const memoryUsage = process.memoryUsage();
    const cpuUsage = await this.getCpuUsage();
    
    return {
      memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      cpuUsagePercent: cpuUsage,
      availableMemoryMB: Math.round((memoryUsage.external + memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024),
      diskUsagePercent: await this.getDiskUsage(),
      networkLatencyMs: await this.getNetworkLatency(),
      gpuUsagePercent: await this.getGpuUsage(),
      gpuMemoryUsageMB: await this.getGpuMemoryUsage(),
      temperature: await this.getSystemTemperature()
    };
  }

  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation - return mock value for testing
    // In production, this would use actual system metrics
    return Math.random() * 50 + 10; // Mock CPU usage between 10-60%
  }

  private async getDiskUsage(): Promise<number> {
    // Placeholder - would use platform-specific disk usage APIs
    return 45; // Mock 45% disk usage
  }

  private async getNetworkLatency(): Promise<number> {
    // Placeholder - would ping a local endpoint
    return 5; // Mock 5ms network latency
  }

  private async getGpuUsage(): Promise<number | undefined> {
    // Placeholder - would use nvidia-ml-py or similar for Jetson
    return 30; // Mock 30% GPU usage
  }

  private async getGpuMemoryUsage(): Promise<number | undefined> {
    // Placeholder - would use nvidia-ml-py or similar for Jetson
    return 1024; // Mock 1GB GPU memory usage
  }

  private async getSystemTemperature(): Promise<number> {
    // Placeholder - would read from /sys/class/thermal on Linux
    return 45; // Mock 45°C temperature
  }
}

// Latency Tracker Class
class LatencyTracker {
  private inferenceLatencies: number[] = [];
  private trainingLatencies: number[] = [];
  private operationCounts: Map<string, number> = new Map();
  private readonly MAX_SAMPLES = 1000;

  public recordInference(operation: string, latencyMs: number): void {
    this.inferenceLatencies.push(latencyMs);
    
    // Limit sample size
    if (this.inferenceLatencies.length > this.MAX_SAMPLES) {
      this.inferenceLatencies = this.inferenceLatencies.slice(-this.MAX_SAMPLES);
    }
    
    // Track operation counts
    const currentCount = this.operationCounts.get(`inference_${operation}`) || 0;
    this.operationCounts.set(`inference_${operation}`, currentCount + 1);
  }

  public recordTraining(operation: string, latencyMs: number): void {
    this.trainingLatencies.push(latencyMs);
    
    // Limit sample size
    if (this.trainingLatencies.length > this.MAX_SAMPLES) {
      this.trainingLatencies = this.trainingLatencies.slice(-this.MAX_SAMPLES);
    }
    
    // Track operation counts
    const currentCount = this.operationCounts.get(`training_${operation}`) || 0;
    this.operationCounts.set(`training_${operation}`, currentCount + 1);
  }

  public getMetrics(): LatencyMetrics {
    return {
      averageInferenceLatencyMs: this.calculateAverage(this.inferenceLatencies),
      maxInferenceLatencyMs: Math.max(...this.inferenceLatencies, 0),
      minInferenceLatencyMs: Math.min(...this.inferenceLatencies, 0),
      averageTrainingLatencyMs: this.calculateAverage(this.trainingLatencies),
      maxTrainingLatencyMs: Math.max(...this.trainingLatencies, 0),
      minTrainingLatencyMs: Math.min(...this.trainingLatencies, 0),
      p95InferenceLatencyMs: this.calculatePercentile(this.inferenceLatencies, 95),
      p99InferenceLatencyMs: this.calculatePercentile(this.inferenceLatencies, 99),
      totalInferenceOperations: Array.from(this.operationCounts.entries())
        .filter(([key]) => key.startsWith('inference_'))
        .reduce((sum, [, count]) => sum + count, 0),
      totalTrainingOperations: Array.from(this.operationCounts.entries())
        .filter(([key]) => key.startsWith('training_'))
        .reduce((sum, [, count]) => sum + count, 0)
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Type definitions
export interface ResourceMetrics {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  availableMemoryMB: number;
  diskUsagePercent: number;
  networkLatencyMs: number;
  gpuUsagePercent?: number;
  gpuMemoryUsageMB?: number;
  temperature: number;
}

export interface LatencyMetrics {
  averageInferenceLatencyMs: number;
  maxInferenceLatencyMs: number;
  minInferenceLatencyMs: number;
  averageTrainingLatencyMs: number;
  maxTrainingLatencyMs: number;
  minTrainingLatencyMs: number;
  p95InferenceLatencyMs: number;
  p99InferenceLatencyMs: number;
  totalInferenceOperations: number;
  totalTrainingOperations: number;
}

export interface PerformanceThresholds {
  maxMemoryUsageMB: number;
  maxCpuUsagePercent: number;
  maxInferenceLatencyMs: number;
  maxTrainingLatencyMs: number;
  minAvailableMemoryMB: number;
  maxGpuUsagePercent: number;
  maxGpuMemoryUsageMB: number;
  maxDiskUsagePercent: number;
  maxNetworkLatencyMs: number;
  performanceDegradationThreshold: number;
}

export interface PerformanceReport {
  timestamp: Date;
  resourceMetrics: ResourceMetrics;
  latencyMetrics: LatencyMetrics;
  trends: PerformanceTrends;
  alerts: PerformanceAlert[];
  thresholds: PerformanceThresholds;
  overallHealth: HealthStatus;
  recommendations: string[];
}

export interface PerformanceSnapshot {
  timestamp: Date;
  resourceMetrics: ResourceMetrics;
  latencyMetrics: LatencyMetrics;
}

export interface PerformanceTrends {
  memoryTrend: TrendDirection;
  cpuTrend: TrendDirection;
  latencyTrend: TrendDirection;
  overallTrend: TrendDirection;
}

export interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  data: Record<string, any>;
  acknowledged: boolean;
}

export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable'
}

export enum HealthStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export enum AlertType {
  MEMORY_THRESHOLD_EXCEEDED = 'memory_threshold_exceeded',
  CPU_THRESHOLD_EXCEEDED = 'cpu_threshold_exceeded',
  LATENCY_THRESHOLD_EXCEEDED = 'latency_threshold_exceeded',
  GPU_THRESHOLD_EXCEEDED = 'gpu_threshold_exceeded',
  LOW_AVAILABLE_MEMORY = 'low_available_memory',
  TRAINING_LATENCY_HIGH = 'training_latency_high',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  RESOURCE_EXHAUSTION = 'resource_exhaustion'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}