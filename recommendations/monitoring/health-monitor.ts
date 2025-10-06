/**
 * System health monitoring and alerting
 * Monitors recommendation engine health and performance metrics
 */

import { SystemMetrics, PerformanceThreshold, RecommendationError } from '../types';
import { ErrorSeverity } from '../enums';

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'down';
  components: ComponentHealth[];
  lastCheck: Date;
  uptime: number; // seconds
  alerts: HealthAlert[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'down';
  metrics: Record<string, number>;
  lastCheck: Date;
  issues: string[];
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  thresholds: HealthThresholds;
  enabledChecks: string[];
  alerting: AlertingConfig;
}

export interface HealthThresholds {
  memory: {
    warning: number; // percentage
    critical: number; // percentage
  };
  cpu: {
    warning: number; // percentage
    critical: number; // percentage
  };
  latency: {
    warning: number; // milliseconds
    critical: number; // milliseconds
  };
  errorRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  diskSpace: {
    warning: number; // percentage
    critical: number; // percentage
  };
}

export interface AlertingConfig {
  enabled: boolean;
  channels: ('console' | 'log' | 'callback')[];
  rateLimiting: {
    enabled: boolean;
    maxAlertsPerMinute: number;
  };
  escalation: {
    enabled: boolean;
    escalationTimeMinutes: number;
  };
}

/**
 * System health monitor
 * Continuously monitors system health and generates alerts
 */
export class HealthMonitor {
  private config: HealthCheckConfig;
  private healthStatus: HealthStatus;
  private monitoringInterval?: NodeJS.Timeout;
  private alertCallbacks: Map<string, (alert: HealthAlert) => void> = new Map();
  private metricsHistory: SystemMetrics[] = [];
  private startTime: Date;
  private alertRateLimiter: Map<string, number> = new Map();

  constructor(config?: Partial<HealthCheckConfig>) {
    this.startTime = new Date();
    this.config = this.mergeWithDefaults(config || {});
    this.healthStatus = this.initializeHealthStatus();
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.monitoringInterval) {
      console.warn('Health monitoring is already running');
      return;
    }

    console.log('Starting health monitoring...');
    this.monitoringInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.interval
    );

    // Perform initial health check
    this.performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Health monitoring stopped');
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get health metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Register alert callback
   */
  onAlert(key: string, callback: (alert: HealthAlert) => void): void {
    this.alertCallbacks.set(key, callback);
  }

  /**
   * Unregister alert callback
   */
  offAlert(key: string): void {
    this.alertCallbacks.delete(key);
  }

  /**
   * Manually trigger health check
   */
  async checkHealth(): Promise<HealthStatus> {
    await this.performHealthCheck();
    return this.getHealthStatus();
  }

  /**
   * Add custom health check
   */
  addCustomCheck(name: string, checkFn: () => Promise<ComponentHealth>): void {
    // Store custom check function for execution during health checks
    console.log(`Added custom health check: ${name}`);
  }

  /**
   * Update health thresholds
   */
  updateThresholds(thresholds: Partial<HealthThresholds>): void {
    this.config.thresholds = {
      ...this.config.thresholds,
      ...thresholds
    };
    console.log('Health thresholds updated');
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.healthStatus.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`Alert resolved: ${alertId}`);
    }
  }

  /**
   * Get system diagnostics
   */
  getDiagnostics(): {
    health: HealthStatus;
    performance: SystemMetrics | null;
    recommendations: string[];
  } {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1] || null;
    
    return {
      health: this.getHealthStatus(),
      performance: latestMetrics,
      recommendations: this.generateHealthRecommendations()
    };
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const checkStartTime = new Date();
    
    try {
      // Collect system metrics
      const metrics = await this.collectSystemMetrics();
      this.metricsHistory.push(metrics);
      
      // Trim history to last 24 hours
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoff);

      // Check component health
      const componentHealths = await this.checkAllComponents(metrics);
      
      // Update health status
      this.updateHealthStatus(componentHealths, checkStartTime);
      
      // Generate alerts if needed
      this.checkForAlerts(componentHealths, metrics);
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.generateAlert('critical', 'health-monitor', 'Health check failed', { error: error.message });
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const now = new Date();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = 8 * 1024 * 1024 * 1024; // 8GB in bytes (Jetson Nano Orin)
    
    // Get CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: now,
      latency: {
        average: 0, // Would be calculated from actual request metrics
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        count: 0
      },
      memory: {
        current: memoryUsage.heapUsed,
        average: memoryUsage.heapUsed,
        peak: memoryUsage.heapTotal,
        threshold: totalMemory * 0.8, // 80% threshold
        utilizationPercent: (memoryUsage.heapUsed / totalMemory) * 100
      },
      cpu: {
        current: 0, // Would be calculated from actual CPU metrics
        average: 0,
        peak: 0,
        threshold: 80,
        utilizationPercent: 0
      },
      userSatisfaction: {
        average: 0,
        userCount: 0,
        aboveThreshold: 0,
        belowThreshold: 0
      },
      recommendations: {
        totalRequests: 0,
        operationBreakdown: {},
        averageLatencyByOperation: {}
      },
      system: {
        uptime: (now.getTime() - this.startTime.getTime()) / 1000,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryUsage: memoryUsage,
        cpuUsage: cpuUsage
      },
      thresholds: {
        maxLatencyMs: 2000,
        maxMemoryMB: 1536,
        minSatisfactionScore: 0.7,
        maxCpuUsagePercent: 80,
        maxConcurrentRequests: 10
      },
      alerts: []
    };
  }

  /**
   * Check all system components
   */
  private async checkAllComponents(metrics: SystemMetrics): Promise<ComponentHealth[]> {
    const components: ComponentHealth[] = [];
    
    // Memory component
    components.push(this.checkMemoryHealth(metrics));
    
    // CPU component
    components.push(this.checkCpuHealth(metrics));
    
    // Recommendation engine component
    components.push(this.checkRecommendationEngineHealth(metrics));
    
    // Storage component
    components.push(await this.checkStorageHealth());
    
    // Network component
    components.push(await this.checkNetworkHealth());
    
    return components;
  }

  /**
   * Check memory health
   */
  private checkMemoryHealth(metrics: SystemMetrics): ComponentHealth {
    const memoryPercent = metrics.memory.utilizationPercent;
    const issues: string[] = [];
    
    let status: ComponentHealth['status'] = 'healthy';
    
    if (memoryPercent >= this.config.thresholds.memory.critical) {
      status = 'critical';
      issues.push(`Memory usage critical: ${memoryPercent.toFixed(1)}%`);
    } else if (memoryPercent >= this.config.thresholds.memory.warning) {
      status = 'warning';
      issues.push(`Memory usage high: ${memoryPercent.toFixed(1)}%`);
    }
    
    return {
      name: 'memory',
      status,
      metrics: {
        utilizationPercent: memoryPercent,
        currentMB: metrics.memory.current / (1024 * 1024),
        peakMB: metrics.memory.peak / (1024 * 1024)
      },
      lastCheck: new Date(),
      issues
    };
  }

  /**
   * Check CPU health
   */
  private checkCpuHealth(metrics: SystemMetrics): ComponentHealth {
    const cpuPercent = metrics.cpu.utilizationPercent;
    const issues: string[] = [];
    
    let status: ComponentHealth['status'] = 'healthy';
    
    if (cpuPercent >= this.config.thresholds.cpu.critical) {
      status = 'critical';
      issues.push(`CPU usage critical: ${cpuPercent.toFixed(1)}%`);
    } else if (cpuPercent >= this.config.thresholds.cpu.warning) {
      status = 'warning';
      issues.push(`CPU usage high: ${cpuPercent.toFixed(1)}%`);
    }
    
    return {
      name: 'cpu',
      status,
      metrics: {
        utilizationPercent: cpuPercent,
        current: metrics.cpu.current,
        average: metrics.cpu.average
      },
      lastCheck: new Date(),
      issues
    };
  }

  /**
   * Check recommendation engine health
   */
  private checkRecommendationEngineHealth(metrics: SystemMetrics): ComponentHealth {
    const avgLatency = metrics.latency.average;
    const issues: string[] = [];
    
    let status: ComponentHealth['status'] = 'healthy';
    
    if (avgLatency >= this.config.thresholds.latency.critical) {
      status = 'critical';
      issues.push(`Response latency critical: ${avgLatency}ms`);
    } else if (avgLatency >= this.config.thresholds.latency.warning) {
      status = 'warning';
      issues.push(`Response latency high: ${avgLatency}ms`);
    }
    
    return {
      name: 'recommendation-engine',
      status,
      metrics: {
        averageLatency: avgLatency,
        p95Latency: metrics.latency.p95,
        requestCount: metrics.latency.count
      },
      lastCheck: new Date(),
      issues
    };
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<ComponentHealth> {
    // Simplified storage check
    return {
      name: 'storage',
      status: 'healthy',
      metrics: {
        diskUsagePercent: 45, // Would be calculated from actual disk usage
        availableGB: 100
      },
      lastCheck: new Date(),
      issues: []
    };
  }

  /**
   * Check network health
   */
  private async checkNetworkHealth(): Promise<ComponentHealth> {
    // Simplified network check
    return {
      name: 'network',
      status: 'healthy',
      metrics: {
        connectivity: 1,
        latency: 50
      },
      lastCheck: new Date(),
      issues: []
    };
  }

  /**
   * Update overall health status
   */
  private updateHealthStatus(components: ComponentHealth[], checkTime: Date): void {
    // Determine overall status
    let overallStatus: HealthStatus['overall'] = 'healthy';
    
    const criticalComponents = components.filter(c => c.status === 'critical');
    const warningComponents = components.filter(c => c.status === 'warning');
    const downComponents = components.filter(c => c.status === 'down');
    
    if (downComponents.length > 0) {
      overallStatus = 'down';
    } else if (criticalComponents.length > 0) {
      overallStatus = 'critical';
    } else if (warningComponents.length > 0) {
      overallStatus = 'warning';
    }
    
    this.healthStatus = {
      overall: overallStatus,
      components,
      lastCheck: checkTime,
      uptime: (checkTime.getTime() - this.startTime.getTime()) / 1000,
      alerts: this.healthStatus.alerts // Preserve existing alerts
    };
  }

  /**
   * Check for new alerts
   */
  private checkForAlerts(components: ComponentHealth[], metrics: SystemMetrics): void {
    for (const component of components) {
      if (component.status === 'critical') {
        this.generateAlert('critical', component.name, `Component critical: ${component.issues.join(', ')}`, {
          metrics: component.metrics
        });
      } else if (component.status === 'warning') {
        this.generateAlert('warning', component.name, `Component warning: ${component.issues.join(', ')}`, {
          metrics: component.metrics
        });
      }
    }
  }

  /**
   * Generate alert
   */
  private generateAlert(
    severity: HealthAlert['severity'], 
    component: string, 
    message: string, 
    metadata: Record<string, any> = {}
  ): void {
    // Check rate limiting
    if (this.isRateLimited(component, severity)) {
      return;
    }
    
    const alert: HealthAlert = {
      id: `${component}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      component,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };
    
    this.healthStatus.alerts.push(alert);
    
    // Trim old alerts (keep last 100)
    if (this.healthStatus.alerts.length > 100) {
      this.healthStatus.alerts = this.healthStatus.alerts.slice(-100);
    }
    
    // Notify callbacks
    this.notifyAlertCallbacks(alert);
    
    // Log alert
    this.logAlert(alert);
  }

  /**
   * Check if alert is rate limited
   */
  private isRateLimited(component: string, severity: string): boolean {
    if (!this.config.alerting.rateLimiting.enabled) {
      return false;
    }
    
    const key = `${component}-${severity}`;
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const rateLimitKey = `${key}-${minute}`;
    
    const count = this.alertRateLimiter.get(rateLimitKey) || 0;
    if (count >= this.config.alerting.rateLimiting.maxAlertsPerMinute) {
      return true;
    }
    
    this.alertRateLimiter.set(rateLimitKey, count + 1);
    
    // Clean up old rate limit entries
    for (const [k] of this.alertRateLimiter) {
      const keyMinute = parseInt(k.split('-').pop() || '0');
      if (minute - keyMinute > 5) { // Keep last 5 minutes
        this.alertRateLimiter.delete(k);
      }
    }
    
    return false;
  }

  /**
   * Notify alert callbacks
   */
  private notifyAlertCallbacks(alert: HealthAlert): void {
    for (const callback of this.alertCallbacks.values()) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error notifying alert callback:', error);
      }
    }
  }

  /**
   * Log alert
   */
  private logAlert(alert: HealthAlert): void {
    const logLevel = alert.severity === 'critical' ? 'error' : 
                    alert.severity === 'error' ? 'error' :
                    alert.severity === 'warning' ? 'warn' : 'info';
    
    console[logLevel](`[HEALTH ALERT] ${alert.component}: ${alert.message}`);
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(): string[] {
    const recommendations: string[] = [];
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    
    if (!latestMetrics) {
      return recommendations;
    }
    
    if (latestMetrics.memory.utilizationPercent > 80) {
      recommendations.push('Consider enabling memory optimization or reducing cache size');
    }
    
    if (latestMetrics.cpu.utilizationPercent > 75) {
      recommendations.push('Consider reducing concurrent request limits or switching to a lighter performance profile');
    }
    
    if (latestMetrics.latency.p95 > 2000) {
      recommendations.push('Consider enabling caching or optimizing recommendation algorithms');
    }
    
    return recommendations;
  }

  /**
   * Initialize health status
   */
  private initializeHealthStatus(): HealthStatus {
    return {
      overall: 'healthy',
      components: [],
      lastCheck: new Date(),
      uptime: 0,
      alerts: []
    };
  }

  /**
   * Merge config with defaults
   */
  private mergeWithDefaults(config: Partial<HealthCheckConfig>): HealthCheckConfig {
    return {
      interval: config.interval || 30000, // 30 seconds
      timeout: config.timeout || 5000, // 5 seconds
      retries: config.retries || 3,
      thresholds: {
        memory: {
          warning: 75,
          critical: 90,
          ...config.thresholds?.memory
        },
        cpu: {
          warning: 70,
          critical: 85,
          ...config.thresholds?.cpu
        },
        latency: {
          warning: 1500,
          critical: 3000,
          ...config.thresholds?.latency
        },
        errorRate: {
          warning: 5,
          critical: 10,
          ...config.thresholds?.errorRate
        },
        diskSpace: {
          warning: 80,
          critical: 95,
          ...config.thresholds?.diskSpace
        },
        ...config.thresholds
      },
      enabledChecks: config.enabledChecks || ['memory', 'cpu', 'latency', 'storage', 'network'],
      alerting: {
        enabled: true,
        channels: ['console', 'log'],
        rateLimiting: {
          enabled: true,
          maxAlertsPerMinute: 5
        },
        escalation: {
          enabled: false,
          escalationTimeMinutes: 15
        },
        ...config.alerting
      }
    };
  }
}