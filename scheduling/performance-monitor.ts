/**
 * Performance monitoring system for scheduling operations
 * Tracks memory usage, operation latency, and resource optimization
 * Ensures compliance with Jetson Nano Orin hardware constraints
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  memoryUsage: MemoryMetrics;
  operationLatency: LatencyMetrics;
  resourceUtilization: ResourceMetrics;
  eventIndexing: IndexingMetrics;
  backgroundProcessing: ProcessingMetrics;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  peakMemoryUsage: number;
  memoryThreshold: number; // 1GB limit as per requirements
  isWithinLimits: boolean;
}

export interface LatencyMetrics {
  eventCreation: number;
  eventQuery: number;
  reminderProcessing: number;
  calendarSync: number;
  familyCoordination: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  diskIO: number;
  networkIO: number;
  activeConnections: number;
  queueDepth: number;
  backgroundTasks: number;
}

export interface IndexingMetrics {
  indexSize: number;
  queryEfficiency: number;
  indexHitRate: number;
  rebuildFrequency: number;
  optimizationLevel: number;
}

export interface ProcessingMetrics {
  syncOperations: number;
  reminderQueue: number;
  backgroundTasksCompleted: number;
  resourceOptimizationActions: number;
  gracefulDegradations: number;
}

export interface PerformanceAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metrics: Partial<PerformanceMetrics>;
  timestamp: Date;
  suggestedActions: string[];
}

export enum AlertType {
  MEMORY_THRESHOLD = 'memory_threshold',
  LATENCY_SPIKE = 'latency_spike',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  INDEX_DEGRADATION = 'index_degradation',
  BACKGROUND_OVERLOAD = 'background_overload'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PerformanceThresholds {
  memoryLimitMB: number; // 1GB = 1024MB
  maxLatencyMs: number;
  maxCpuUsage: number;
  maxQueueDepth: number;
  minIndexEfficiency: number;
}

export class SchedulingPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private operationTimings: Map<string, number[]> = new Map();
  private alertHistory: PerformanceAlert[] = [];
  private isMonitoring = false;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    
    this.thresholds = {
      memoryLimitMB: 1024, // 1GB limit for Jetson Nano Orin
      maxLatencyMs: 500, // Voice response requirement
      maxCpuUsage: 80,
      maxQueueDepth: 1000,
      minIndexEfficiency: 0.8,
      ...thresholds
    };

    this.metrics = this.initializeMetrics();
  }

  /**
   * Start performance monitoring with specified interval
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
    }, intervalMs);

    this.emit('monitoring_started');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.emit('monitoring_stopped');
  }

  /**
   * Record operation timing for latency tracking
   */
  public recordOperationTiming(operation: string, durationMs: number): void {
    if (!this.operationTimings.has(operation)) {
      this.operationTimings.set(operation, []);
    }
    
    const timings = this.operationTimings.get(operation)!;
    timings.push(durationMs);
    
    // Keep only last 100 measurements for efficiency
    if (timings.length > 100) {
      timings.shift();
    }

    // Update latency metrics
    this.updateLatencyMetrics();
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    this.collectMetrics();
    return { ...this.metrics };
  }

  /**
   * Get performance alerts from specified time range
   */
  public getAlerts(since?: Date): PerformanceAlert[] {
    if (!since) {
      return [...this.alertHistory];
    }
    
    return this.alertHistory.filter(alert => alert.timestamp >= since);
  }

  /**
   * Optimize memory usage by triggering garbage collection and cleanup
   */
  public optimizeMemory(): void {
    try {
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear old operation timings
      this.operationTimings.forEach((timings, operation) => {
        if (timings.length > 50) {
          this.operationTimings.set(operation, timings.slice(-50));
        }
      });

      // Limit alert history
      if (this.alertHistory.length > 100) {
        this.alertHistory = this.alertHistory.slice(-100);
      }

      this.emit('memory_optimized');
    } catch (error) {
      this.emit('optimization_error', error);
    }
  }

  /**
   * Check if system is within performance thresholds
   */
  public isPerformanceHealthy(): boolean {
    const metrics = this.getMetrics();
    
    return (
      metrics.memoryUsage.isWithinLimits &&
      metrics.operationLatency.averageResponseTime <= this.thresholds.maxLatencyMs &&
      metrics.resourceUtilization.cpuUsage <= this.thresholds.maxCpuUsage &&
      metrics.resourceUtilization.queueDepth <= this.thresholds.maxQueueDepth &&
      metrics.eventIndexing.queryEfficiency >= this.thresholds.minIndexEfficiency
    );
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        arrayBuffers: 0,
        peakMemoryUsage: 0,
        memoryThreshold: this.thresholds.memoryLimitMB * 1024 * 1024,
        isWithinLimits: true
      },
      operationLatency: {
        eventCreation: 0,
        eventQuery: 0,
        reminderProcessing: 0,
        calendarSync: 0,
        familyCoordination: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      resourceUtilization: {
        cpuUsage: 0,
        diskIO: 0,
        networkIO: 0,
        activeConnections: 0,
        queueDepth: 0,
        backgroundTasks: 0
      },
      eventIndexing: {
        indexSize: 0,
        queryEfficiency: 1.0,
        indexHitRate: 1.0,
        rebuildFrequency: 0,
        optimizationLevel: 1.0
      },
      backgroundProcessing: {
        syncOperations: 0,
        reminderQueue: 0,
        backgroundTasksCompleted: 0,
        resourceOptimizationActions: 0,
        gracefulDegradations: 0
      }
    };
  }

  private collectMetrics(): void {
    // Collect memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
      peakMemoryUsage: Math.max(this.metrics.memoryUsage.peakMemoryUsage, memUsage.rss),
      memoryThreshold: this.thresholds.memoryLimitMB * 1024 * 1024,
      isWithinLimits: memUsage.rss <= (this.thresholds.memoryLimitMB * 1024 * 1024)
    };

    // Collect CPU usage (simplified - in real implementation would use more sophisticated monitoring)
    this.metrics.resourceUtilization.cpuUsage = this.estimateCpuUsage();
    
    // Update latency metrics from recorded timings
    this.updateLatencyMetrics();
  }

  private updateLatencyMetrics(): void {
    const allTimings: number[] = [];
    
    // Collect all operation timings
    this.operationTimings.forEach((timings, operation) => {
      if (timings.length > 0) {
        allTimings.push(...timings);
        
        // Update specific operation metrics
        const avgTiming = timings.reduce((sum, time) => sum + time, 0) / timings.length;
        switch (operation) {
          case 'eventCreation':
            this.metrics.operationLatency.eventCreation = avgTiming;
            break;
          case 'eventQuery':
            this.metrics.operationLatency.eventQuery = avgTiming;
            break;
          case 'reminderProcessing':
            this.metrics.operationLatency.reminderProcessing = avgTiming;
            break;
          case 'calendarSync':
            this.metrics.operationLatency.calendarSync = avgTiming;
            break;
          case 'familyCoordination':
            this.metrics.operationLatency.familyCoordination = avgTiming;
            break;
        }
      }
    });

    if (allTimings.length > 0) {
      // Calculate percentiles
      const sortedTimings = allTimings.sort((a, b) => a - b);
      this.metrics.operationLatency.averageResponseTime = 
        allTimings.reduce((sum, time) => sum + time, 0) / allTimings.length;
      
      const p95Index = Math.floor(sortedTimings.length * 0.95);
      const p99Index = Math.floor(sortedTimings.length * 0.99);
      
      this.metrics.operationLatency.p95ResponseTime = sortedTimings[p95Index] || 0;
      this.metrics.operationLatency.p99ResponseTime = sortedTimings[p99Index] || 0;
    }
  }

  private estimateCpuUsage(): number {
    // Simplified CPU usage estimation
    // In a real implementation, this would use more sophisticated monitoring
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage approximation
  }

  private analyzePerformance(): void {
    const alerts: PerformanceAlert[] = [];

    // Check memory threshold
    if (!this.metrics.memoryUsage.isWithinLimits) {
      alerts.push({
        type: AlertType.MEMORY_THRESHOLD,
        severity: AlertSeverity.HIGH,
        message: `Memory usage exceeded threshold: ${Math.round(this.metrics.memoryUsage.rss / 1024 / 1024)}MB / ${this.thresholds.memoryLimitMB}MB`,
        metrics: { memoryUsage: this.metrics.memoryUsage },
        timestamp: new Date(),
        suggestedActions: [
          'Trigger garbage collection',
          'Clear operation timing cache',
          'Reduce background processing',
          'Implement graceful degradation'
        ]
      });
    }

    // Check latency spikes
    if (this.metrics.operationLatency.averageResponseTime > this.thresholds.maxLatencyMs) {
      alerts.push({
        type: AlertType.LATENCY_SPIKE,
        severity: AlertSeverity.MEDIUM,
        message: `Average response time exceeded threshold: ${Math.round(this.metrics.operationLatency.averageResponseTime)}ms / ${this.thresholds.maxLatencyMs}ms`,
        metrics: { operationLatency: this.metrics.operationLatency },
        timestamp: new Date(),
        suggestedActions: [
          'Optimize event indexing',
          'Reduce background sync frequency',
          'Implement query caching',
          'Defer non-critical operations'
        ]
      });
    }

    // Check resource utilization
    if (this.metrics.resourceUtilization.cpuUsage > this.thresholds.maxCpuUsage) {
      alerts.push({
        type: AlertType.RESOURCE_EXHAUSTION,
        severity: AlertSeverity.HIGH,
        message: `CPU usage exceeded threshold: ${Math.round(this.metrics.resourceUtilization.cpuUsage)}% / ${this.thresholds.maxCpuUsage}%`,
        metrics: { resourceUtilization: this.metrics.resourceUtilization },
        timestamp: new Date(),
        suggestedActions: [
          'Reduce concurrent operations',
          'Implement task prioritization',
          'Defer background processing',
          'Enable graceful degradation'
        ]
      });
    }

    // Emit alerts and store in history
    alerts.forEach(alert => {
      this.alertHistory.push(alert);
      this.emit('performance_alert', alert);
    });

    // Emit general performance update
    this.emit('metrics_updated', this.metrics);
  }
}

export default SchedulingPerformanceMonitor;