/**
 * Resource monitoring system for voice pipeline
 * Safety: Prevents system overload that could affect child safety features
 * Performance: Monitors and optimizes resource usage on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  gpuPercent?: number;
  diskIOPS?: number;
  timestamp: Date;
}

export interface ResourceThresholds {
  memoryWarning: number; // MB
  memoryCritical: number; // MB
  cpuWarning: number; // Percent
  cpuCritical: number; // Percent
  gpuWarning?: number; // Percent
  gpuCritical?: number; // Percent
}

export interface ComponentResourceUsage {
  componentId: string;
  name: string;
  memoryMB: number;
  cpuPercent: number;
  lastUpdated: Date;
  isActive: boolean;
}

export interface ResourceAlert {
  alertId: string;
  type: 'warning' | 'critical';
  resource: 'memory' | 'cpu' | 'gpu' | 'disk';
  currentValue: number;
  threshold: number;
  timestamp: Date;
  component?: string;
  message: string;
}

export interface OptimizationTrigger {
  triggerId: string;
  condition: string;
  threshold: number;
  action: 'reduce_quality' | 'pause_component' | 'restart_component' | 'emergency_stop';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResourceProfile {
  profileId: string;
  name: string;
  thresholds: ResourceThresholds;
  optimizationTriggers: OptimizationTrigger[];
  adaptiveScaling: boolean;
  emergencyMode: boolean;
}

/**
 * Real-time resource monitoring system for voice pipeline components
 * Tracks memory, CPU, and GPU usage with adaptive optimization
 */
export class ResourceMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly updateIntervalMs: number = 1000; // 1 second
  private readonly historySize: number = 300; // 5 minutes at 1s intervals
  
  private resourceHistory: ResourceUsage[] = [];
  private componentUsage: Map<string, ComponentResourceUsage> = new Map();
  private activeAlerts: Map<string, ResourceAlert> = new Map();
  private currentProfile: ResourceProfile;
  
  // Jetson Nano Orin specific constraints
  private readonly maxMemoryMB: number = 8192; // 8GB RAM
  private readonly maxCpuCores: number = 6; // ARM Cortex-A78AE
  
  constructor(profile?: ResourceProfile) {
    super();
    
    // Default profile optimized for Jetson Nano Orin
    this.currentProfile = profile || {
      profileId: 'jetson-nano-orin-default',
      name: 'Jetson Nano Orin Default',
      thresholds: {
        memoryWarning: 6144, // 75% of 8GB
        memoryCritical: 7372, // 90% of 8GB
        cpuWarning: 70,
        cpuCritical: 85,
        gpuWarning: 80,
        gpuCritical: 95
      },
      optimizationTriggers: [
        {
          triggerId: 'memory-warning',
          condition: 'memory > warning',
          threshold: 6144,
          action: 'reduce_quality',
          priority: 'medium'
        },
        {
          triggerId: 'memory-critical',
          condition: 'memory > critical',
          threshold: 7372,
          action: 'emergency_stop',
          priority: 'critical'
        },
        {
          triggerId: 'cpu-critical',
          condition: 'cpu > critical',
          threshold: 85,
          action: 'pause_component',
          priority: 'high'
        }
      ],
      adaptiveScaling: true,
      emergencyMode: false
    };
  }

  /**
   * Start resource monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
    }, this.updateIntervalMs);

    this.emit('monitoring-started');
  }

  /**
   * Stop resource monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoring-stopped');
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceUsage {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = this.calculateCpuUsage();
    
    return {
      memoryMB: Math.round(memoryUsage.rss / 1024 / 1024),
      cpuPercent: cpuUsage,
      gpuPercent: this.getGpuUsage(),
      diskIOPS: this.getDiskIOPS(),
      timestamp: new Date()
    };
  }

  /**
   * Register a component for resource tracking
   */
  registerComponent(componentId: string, name: string): void {
    this.componentUsage.set(componentId, {
      componentId,
      name,
      memoryMB: 0,
      cpuPercent: 0,
      lastUpdated: new Date(),
      isActive: false
    });

    this.emit('component-registered', { componentId, name });
  }

  /**
   * Update resource usage for a specific component
   */
  updateComponentUsage(componentId: string, usage: Partial<ComponentResourceUsage>): void {
    const existing = this.componentUsage.get(componentId);
    if (!existing) {
      throw new Error(`Component ${componentId} not registered`);
    }

    const updated: ComponentResourceUsage = {
      ...existing,
      ...usage,
      lastUpdated: new Date()
    };

    this.componentUsage.set(componentId, updated);
    this.emit('component-usage-updated', { componentId, usage: updated });
  }

  /**
   * Get resource usage for all components
   */
  getComponentUsage(): ComponentResourceUsage[] {
    return Array.from(this.componentUsage.values());
  }

  /**
   * Get resource usage history
   */
  getResourceHistory(minutes?: number): ResourceUsage[] {
    if (!minutes) {
      return [...this.resourceHistory];
    }

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.resourceHistory.filter(usage => usage.timestamp >= cutoffTime);
  }

  /**
   * Get active resource alerts
   */
  getActiveAlerts(): ResourceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Update resource profile
   */
  updateProfile(profile: ResourceProfile): void {
    this.currentProfile = profile;
    this.emit('profile-updated', profile);
  }

  /**
   * Get current resource profile
   */
  getProfile(): ResourceProfile {
    return { ...this.currentProfile };
  }

  /**
   * Check if system is under resource pressure
   */
  isUnderPressure(): boolean {
    const current = this.getCurrentUsage();
    const thresholds = this.currentProfile.thresholds;

    return (
      current.memoryMB > thresholds.memoryWarning ||
      current.cpuPercent > thresholds.cpuWarning ||
      (current.gpuPercent !== undefined && thresholds.gpuWarning !== undefined && current.gpuPercent > thresholds.gpuWarning)
    );
  }

  /**
   * Get optimization recommendations based on current usage
   */
  getOptimizationRecommendations(): OptimizationRecommendation[] {
    const current = this.getCurrentUsage();
    const recommendations: OptimizationRecommendation[] = [];

    // Memory optimization
    if (current.memoryMB > this.currentProfile.thresholds.memoryWarning) {
      recommendations.push({
        type: 'memory',
        severity: current.memoryMB > this.currentProfile.thresholds.memoryCritical ? 'critical' : 'warning',
        action: 'Reduce audio buffer sizes and model cache',
        expectedSavingMB: Math.round(current.memoryMB * 0.15),
        priority: current.memoryMB > this.currentProfile.thresholds.memoryCritical ? 'high' : 'medium'
      });
    }

    // CPU optimization
    if (current.cpuPercent > this.currentProfile.thresholds.cpuWarning) {
      recommendations.push({
        type: 'cpu',
        severity: current.cpuPercent > this.currentProfile.thresholds.cpuCritical ? 'critical' : 'warning',
        action: 'Reduce processing quality or pause non-essential components',
        expectedSavingPercent: Math.round(current.cpuPercent * 0.2),
        priority: current.cpuPercent > this.currentProfile.thresholds.cpuCritical ? 'high' : 'medium'
      });
    }

    // Component-specific recommendations
    const heavyComponents = this.getComponentUsage()
      .filter(comp => comp.memoryMB > 500 || comp.cpuPercent > 20)
      .sort((a, b) => (b.memoryMB + b.cpuPercent) - (a.memoryMB + a.cpuPercent));

    if (heavyComponents.length > 0) {
      recommendations.push({
        type: 'component',
        severity: 'info',
        action: `Consider optimizing heavy components: ${heavyComponents.slice(0, 3).map(c => c.name).join(', ')}`,
        targetComponents: heavyComponents.slice(0, 3).map(c => c.componentId),
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Collect and process resource metrics
   */
  private collectResourceMetrics(): void {
    try {
      const usage = this.getCurrentUsage();
      
      // Add to history
      this.resourceHistory.push(usage);
      if (this.resourceHistory.length > this.historySize) {
        this.resourceHistory.shift();
      }

      // Check thresholds and generate alerts
      this.checkThresholds(usage);

      // Emit usage update
      this.emit('usage-updated', usage);

      // Trigger optimizations if needed
      if (this.currentProfile.adaptiveScaling) {
        this.checkOptimizationTriggers(usage);
      }

    } catch (error) {
      this.emit('monitoring-error', error);
    }
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get GPU usage (Jetson Nano Orin specific)
   */
  private getGpuUsage(): number | undefined {
    // On Jetson Nano Orin, GPU usage can be read from tegrastats
    // This is a simplified implementation - in production, you'd parse tegrastats output
    try {
      // Placeholder for actual GPU monitoring implementation
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get disk I/O operations per second
   */
  private getDiskIOPS(): number | undefined {
    // Simplified implementation - would need platform-specific monitoring
    return undefined;
  }

  /**
   * Check resource thresholds and generate alerts
   */
  private checkThresholds(usage: ResourceUsage): void {
    const thresholds = this.currentProfile.thresholds;

    // Memory alerts
    this.checkResourceThreshold('memory', usage.memoryMB, thresholds.memoryWarning, thresholds.memoryCritical, 'MB');

    // CPU alerts
    this.checkResourceThreshold('cpu', usage.cpuPercent, thresholds.cpuWarning, thresholds.cpuCritical, '%');

    // GPU alerts
    if (usage.gpuPercent && thresholds.gpuWarning && thresholds.gpuCritical) {
      this.checkResourceThreshold('gpu', usage.gpuPercent, thresholds.gpuWarning, thresholds.gpuCritical, '%');
    }
  }

  /**
   * Check individual resource threshold
   */
  private checkResourceThreshold(
    resource: 'memory' | 'cpu' | 'gpu',
    currentValue: number,
    warningThreshold: number,
    criticalThreshold: number,
    unit: string
  ): void {
    const alertKey = `${resource}-threshold`;
    const existingAlert = this.activeAlerts.get(alertKey);

    if (currentValue > criticalThreshold) {
      if (!existingAlert || existingAlert.type !== 'critical') {
        const alert: ResourceAlert = {
          alertId: `${alertKey}-${Date.now()}`,
          type: 'critical',
          resource,
          currentValue,
          threshold: criticalThreshold,
          timestamp: new Date(),
          message: `Critical ${resource} usage: ${currentValue}${unit} (threshold: ${criticalThreshold}${unit})`
        };
        
        this.activeAlerts.set(alertKey, alert);
        this.emit('resource-alert', alert);
      }
    } else if (currentValue > warningThreshold) {
      if (!existingAlert || existingAlert.type !== 'warning') {
        const alert: ResourceAlert = {
          alertId: `${alertKey}-${Date.now()}`,
          type: 'warning',
          resource,
          currentValue,
          threshold: warningThreshold,
          timestamp: new Date(),
          message: `High ${resource} usage: ${currentValue}${unit} (threshold: ${warningThreshold}${unit})`
        };
        
        this.activeAlerts.set(alertKey, alert);
        this.emit('resource-alert', alert);
      }
    } else {
      // Clear alert if usage is back to normal
      if (existingAlert) {
        this.activeAlerts.delete(alertKey);
        this.emit('resource-alert-cleared', { resource, alertId: existingAlert.alertId });
      }
    }
  }

  /**
   * Check optimization triggers and execute actions
   */
  private checkOptimizationTriggers(usage: ResourceUsage): void {
    for (const trigger of this.currentProfile.optimizationTriggers) {
      if (this.evaluateTriggerCondition(trigger, usage)) {
        this.emit('optimization-trigger', {
          trigger,
          usage,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Evaluate if a trigger condition is met
   */
  private evaluateTriggerCondition(trigger: OptimizationTrigger, usage: ResourceUsage): boolean {
    const { condition, threshold } = trigger;

    if (condition.includes('memory')) {
      return usage.memoryMB > threshold;
    } else if (condition.includes('cpu')) {
      return usage.cpuPercent > threshold;
    } else if (condition.includes('gpu') && usage.gpuPercent) {
      return usage.gpuPercent > threshold;
    }

    return false;
  }
}

export interface OptimizationRecommendation {
  type: 'memory' | 'cpu' | 'gpu' | 'component';
  severity: 'info' | 'warning' | 'critical';
  action: string;
  expectedSavingMB?: number;
  expectedSavingPercent?: number;
  targetComponents?: string[];
  priority: 'low' | 'medium' | 'high';
}

/**
 * Factory function to create ResourceMonitor with Jetson Nano Orin optimizations
 */
export function createJetsonResourceMonitor(): ResourceMonitor {
  const jetsonProfile: ResourceProfile = {
    profileId: 'jetson-nano-orin-optimized',
    name: 'Jetson Nano Orin Optimized',
    thresholds: {
      memoryWarning: 6144, // 75% of 8GB
      memoryCritical: 7372, // 90% of 8GB
      cpuWarning: 70,
      cpuCritical: 85,
      gpuWarning: 80,
      gpuCritical: 95
    },
    optimizationTriggers: [
      {
        triggerId: 'memory-adaptive',
        condition: 'memory > warning',
        threshold: 6144,
        action: 'reduce_quality',
        priority: 'medium'
      },
      {
        triggerId: 'memory-emergency',
        condition: 'memory > critical',
        threshold: 7372,
        action: 'emergency_stop',
        priority: 'critical'
      },
      {
        triggerId: 'cpu-high',
        condition: 'cpu > warning',
        threshold: 70,
        action: 'reduce_quality',
        priority: 'medium'
      },
      {
        triggerId: 'cpu-emergency',
        condition: 'cpu > critical',
        threshold: 85,
        action: 'pause_component',
        priority: 'critical'
      }
    ],
    adaptiveScaling: true,
    emergencyMode: false
  };

  return new ResourceMonitor(jetsonProfile);
}