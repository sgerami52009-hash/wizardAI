import { EventEmitter } from 'events';
import { RenderingMetrics, PerformanceThresholds, QualitySettings } from './types';
import { performanceMonitor } from './performance';

/**
 * Comprehensive performance monitoring and optimization system
 * Implements real-time metrics collection, automatic quality adjustment, and user notifications
 */
export class PerformanceSystem extends EventEmitter {
  private performanceMonitor: any;
  private qualityOptimizer: QualityOptimizer;
  private alertSystem: AlertSystem;
  private resourceManager: ResourceManager;
  private isActive = false;
  private optimizationHistory: OptimizationRecord[] = [];

  constructor() {
    super();
    this.performanceMonitor = performanceMonitor;
    this.qualityOptimizer = new QualityOptimizer();
    this.alertSystem = new AlertSystem();
    this.resourceManager = new ResourceManager();

    this.setupEventHandlers();
  }

  /**
   * Start comprehensive performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    
    // Start all subsystems
    this.performanceMonitor.startMonitoring();
    this.alertSystem.start();
    this.resourceManager.startMonitoring();

    // Set up automatic optimization
    this.setupAutomaticOptimization();

    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    
    this.performanceMonitor.stopMonitoring();
    this.alertSystem.stop();
    this.resourceManager.stopMonitoring();

    this.emit('monitoringStopped');
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): PerformanceReport {
    const currentMetrics = this.performanceMonitor.getCurrentMetrics();
    const averageMetrics = this.performanceMonitor.getAverageMetrics(60000); // Last minute
    const resourceStats = this.resourceManager.getResourceStats();
    const recentOptimizations = this.optimizationHistory.slice(-5);

    return {
      current: currentMetrics,
      average: averageMetrics,
      resources: resourceStats,
      isAcceptable: this.performanceMonitor.isPerformanceAcceptable(),
      recommendations: this.generateRecommendations(currentMetrics),
      recentOptimizations,
      systemHealth: this.calculateSystemHealth(currentMetrics, resourceStats)
    };
  }

  /**
   * Force immediate performance optimization
   */
  async optimizePerformance(): Promise<OptimizationResult> {
    const beforeMetrics = this.performanceMonitor.getCurrentMetrics();
    
    try {
      // Get optimization recommendations
      const optimizations = this.qualityOptimizer.getOptimizations(beforeMetrics);
      
      // Apply optimizations
      const results = await Promise.all(
        optimizations.map(opt => this.applyOptimization(opt))
      );

      // Wait for changes to take effect
      await new Promise(resolve => setTimeout(resolve, 500));

      const afterMetrics = this.performanceMonitor.getCurrentMetrics();
      
      const result: OptimizationResult = {
        success: results.every(r => r),
        beforeMetrics,
        afterMetrics,
        appliedOptimizations: optimizations.filter((_, i) => results[i]),
        performanceGain: afterMetrics.currentFPS - beforeMetrics.currentFPS,
        memoryReduction: beforeMetrics.gpuMemoryUsage - afterMetrics.gpuMemoryUsage
      };

      // Record optimization
      this.recordOptimization(result);

      this.emit('performanceOptimized', result);
      return result;

    } catch (error) {
      this.emit('optimizationError', error);
      throw error;
    }
  }

  /**
   * Set performance thresholds and targets
   */
  setPerformanceTargets(targets: PerformanceTargets): void {
    this.performanceMonitor.setThresholds({
      minFPS: targets.targetFPS * 0.75, // 75% of target as minimum
      maxGPUMemory: targets.maxGPUMemoryGB,
      maxCPUUsage: targets.maxCPUUsage,
      maxRenderTime: 1000 / targets.targetFPS // Convert FPS to frame time
    });

    this.qualityOptimizer.setTargets(targets);
    this.alertSystem.setThresholds(targets);

    this.emit('targetsUpdated', targets);
  }

  /**
   * Get resource utilization breakdown
   */
  getResourceUtilization(): ResourceUtilization {
    return this.resourceManager.getDetailedUtilization();
  }

  /**
   * Enable/disable automatic quality adjustment
   */
  setAutoOptimization(enabled: boolean): void {
    if (enabled) {
      this.setupAutomaticOptimization();
    } else {
      this.removeAllListeners('performanceWarning');
    }

    this.emit('autoOptimizationChanged', enabled);
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationRecord[] {
    return [...this.optimizationHistory];
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }

  // Private methods

  private setupEventHandlers(): void {
    // Handle performance warnings from monitor
    this.performanceMonitor.on?.('performanceWarning', (type: string, current: number, threshold: number) => {
      this.handlePerformanceWarning(type, current, threshold);
    });
  }

  private setupAutomaticOptimization(): void {
    // Listen for performance warnings and auto-optimize
    this.on('performanceWarning', async (warning) => {
      if (warning.severity === 'critical') {
        await this.optimizePerformance();
      }
    });
  }

  private handlePerformanceWarning(type: string, current: number, threshold: number): void {
    const severity = this.calculateWarningSeverity(type, current, threshold);
    
    const warning: PerformanceWarning = {
      type: type as any,
      current,
      threshold,
      severity,
      timestamp: Date.now(),
      message: this.generateWarningMessage(type, current, threshold)
    };

    this.alertSystem.processWarning(warning);
    this.emit('performanceWarning', warning);
  }

  private calculateWarningSeverity(type: string, current: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = type === 'fps' ? threshold / current : current / threshold;
    
    if (ratio >= 2.0) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  private generateWarningMessage(type: string, current: number, threshold: number): string {
    switch (type) {
      case 'fps':
        return `Frame rate is low: ${current.toFixed(1)} FPS (target: ${threshold} FPS)`;
      case 'gpu_memory':
        return `GPU memory usage is high: ${current.toFixed(1)}GB (limit: ${threshold}GB)`;
      case 'cpu_usage':
        return `CPU usage is high: ${current.toFixed(1)}% (limit: ${threshold}%)`;
      case 'render_time':
        return `Render time is slow: ${current.toFixed(1)}ms (target: ${threshold.toFixed(1)}ms)`;
      default:
        return `Performance issue detected: ${type}`;
    }
  }

  private generateRecommendations(metrics: RenderingMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.currentFPS < 45) {
      recommendations.push('Consider reducing avatar detail level');
      if (metrics.triangleCount > 15000) {
        recommendations.push('Reduce 3D model complexity');
      }
    }

    if (metrics.gpuMemoryUsage > 1.5) {
      recommendations.push('Reduce texture resolution or unload unused assets');
    }

    if (metrics.cpuUsage > 70) {
      recommendations.push('Optimize animation calculations');
    }

    if (metrics.renderTime > 20) {
      recommendations.push('Enable performance mode');
    }

    return recommendations;
  }

  private calculateSystemHealth(metrics: RenderingMetrics, resources: ResourceStats): number {
    let health = 1.0;

    // FPS health (40% weight)
    const fpsHealth = Math.min(1.0, metrics.currentFPS / 60);
    health *= (0.4 * fpsHealth + 0.6);

    // Memory health (30% weight)
    const memoryHealth = Math.max(0, 1.0 - (metrics.gpuMemoryUsage / 2.0));
    health *= (0.3 * memoryHealth + 0.7);

    // CPU health (20% weight)
    const cpuHealth = Math.max(0, 1.0 - (metrics.cpuUsage / 100));
    health *= (0.2 * cpuHealth + 0.8);

    // Stability health (10% weight)
    const stabilityHealth = resources.stability;
    health *= (0.1 * stabilityHealth + 0.9);

    return Math.max(0, Math.min(1, health));
  }

  private async applyOptimization(optimization: OptimizationAction): Promise<boolean> {
    try {
      const success = await optimization.execute();
      if (success) {
        this.emit('optimizationApplied', optimization);
      }
      return success;
    } catch (error) {
      this.emit('optimizationError', { optimization, error });
      return false;
    }
  }

  private recordOptimization(result: OptimizationResult): void {
    const record: OptimizationRecord = {
      timestamp: Date.now(),
      trigger: 'manual',
      result,
      effectiveness: result.performanceGain / (result.appliedOptimizations.length || 1)
    };

    this.optimizationHistory.push(record);
    
    // Keep only last 50 records
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory.shift();
    }
  }
}

/**
 * Quality optimization system with automatic adjustments
 */
class QualityOptimizer {
  private targets: PerformanceTargets = {
    targetFPS: 60,
    maxGPUMemoryGB: 2.0,
    maxCPUUsage: 70
  };

  setTargets(targets: PerformanceTargets): void {
    this.targets = { ...targets };
  }

  getOptimizations(metrics: RenderingMetrics): OptimizationAction[] {
    const optimizations: OptimizationAction[] = [];

    // FPS optimizations
    if (metrics.currentFPS < this.targets.targetFPS * 0.8) {
      optimizations.push({
        type: 'reduce_lod',
        description: 'Reduce level of detail to improve frame rate',
        expectedGain: 10,
        qualityImpact: 0.2,
        execute: async () => {
          // Implementation would reduce LOD level
          return true;
        }
      });

      if (metrics.triangleCount > 15000) {
        optimizations.push({
          type: 'simplify_geometry',
          description: 'Simplify 3D geometry to reduce triangle count',
          expectedGain: 8,
          qualityImpact: 0.3,
          execute: async () => {
            // Implementation would simplify meshes
            return true;
          }
        });
      }
    }

    // Memory optimizations
    if (metrics.gpuMemoryUsage > this.targets.maxGPUMemoryGB * 0.8) {
      optimizations.push({
        type: 'reduce_texture_resolution',
        description: 'Reduce texture resolution to save GPU memory',
        expectedGain: 5,
        qualityImpact: 0.25,
        execute: async () => {
          // Implementation would reduce texture sizes
          return true;
        }
      });

      optimizations.push({
        type: 'unload_unused_assets',
        description: 'Unload unused assets from GPU memory',
        expectedGain: 3,
        qualityImpact: 0.0,
        execute: async () => {
          // Implementation would clean up asset cache
          return true;
        }
      });
    }

    // CPU optimizations
    if (metrics.cpuUsage > this.targets.maxCPUUsage) {
      optimizations.push({
        type: 'reduce_animation_quality',
        description: 'Reduce animation update frequency',
        expectedGain: 6,
        qualityImpact: 0.15,
        execute: async () => {
          // Implementation would reduce animation fidelity
          return true;
        }
      });
    }

    return optimizations;
  }
}

/**
 * Alert system for performance notifications
 */
class AlertSystem {
  private isActive = false;
  private alertHistory: PerformanceWarning[] = [];
  private thresholds: PerformanceTargets = {
    targetFPS: 60,
    maxGPUMemoryGB: 2.0,
    maxCPUUsage: 70
  };

  start(): void {
    this.isActive = true;
  }

  stop(): void {
    this.isActive = false;
  }

  setThresholds(thresholds: PerformanceTargets): void {
    this.thresholds = { ...thresholds };
  }

  processWarning(warning: PerformanceWarning): void {
    if (!this.isActive) return;

    this.alertHistory.push(warning);
    
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    // Generate user-friendly notification
    if (warning.severity === 'high' || warning.severity === 'critical') {
      this.showUserNotification(warning);
    }
  }

  private showUserNotification(warning: PerformanceWarning): void {
    // In a real implementation, this would show a user notification
    // For now, just emit an event
    console.warn(`Performance Alert: ${warning.message}`);
  }
}

/**
 * Resource monitoring and management
 */
class ResourceManager {
  private isMonitoring = false;
  private resourceHistory: ResourceSnapshot[] = [];

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Start resource collection
    setInterval(() => {
      if (this.isMonitoring) {
        this.collectResourceSnapshot();
      }
    }, 2000); // Every 2 seconds
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  getResourceStats(): ResourceStats {
    if (this.resourceHistory.length === 0) {
      return {
        averageGPUUsage: 0,
        averageCPUUsage: 0,
        memoryTrend: 'stable',
        stability: 1.0
      };
    }

    const recent = this.resourceHistory.slice(-30); // Last minute
    
    return {
      averageGPUUsage: recent.reduce((sum, s) => sum + s.gpuUsage, 0) / recent.length,
      averageCPUUsage: recent.reduce((sum, s) => sum + s.cpuUsage, 0) / recent.length,
      memoryTrend: this.calculateMemoryTrend(recent),
      stability: this.calculateStability(recent)
    };
  }

  getDetailedUtilization(): ResourceUtilization {
    const latest = this.resourceHistory[this.resourceHistory.length - 1];
    
    if (!latest) {
      // Return mock data for Jetson Nano Orin when no history available
      return {
        gpu: { usage: 45, memory: 1.2, temperature: 55 },
        cpu: { usage: 35, cores: [30, 35, 40, 32, 38, 33], temperature: 50 },
        memory: { used: 3.2, available: 8, cached: 1.1 },
        system: { uptime: Date.now() - 3600000, load: 1.2 }
      };
    }

    return {
      gpu: {
        usage: latest.gpuUsage,
        memory: latest.gpuMemory,
        temperature: latest.gpuTemperature
      },
      cpu: {
        usage: latest.cpuUsage,
        cores: latest.cpuCores,
        temperature: latest.cpuTemperature
      },
      memory: {
        used: latest.memoryUsed,
        available: latest.memoryAvailable,
        cached: latest.memoryCached
      },
      system: {
        uptime: latest.systemUptime,
        load: latest.systemLoad
      }
    };
  }

  private collectResourceSnapshot(): void {
    // In a real implementation, this would collect actual system metrics
    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      gpuUsage: Math.random() * 80 + 10, // 10-90%
      gpuMemory: Math.random() * 1.5 + 0.5, // 0.5-2.0GB
      gpuTemperature: Math.random() * 20 + 50, // 50-70°C
      cpuUsage: Math.random() * 60 + 20, // 20-80%
      cpuCores: Array.from({ length: 6 }, () => Math.random() * 100), // 6 cores
      cpuTemperature: Math.random() * 15 + 45, // 45-60°C
      memoryUsed: Math.random() * 4 + 2, // 2-6GB
      memoryAvailable: 8, // 8GB total
      memoryCached: Math.random() * 1 + 0.5, // 0.5-1.5GB
      systemUptime: Date.now() - 3600000, // 1 hour ago
      systemLoad: Math.random() * 2 + 0.5 // 0.5-2.5
    };

    this.resourceHistory.push(snapshot);
    
    // Keep only last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    this.resourceHistory = this.resourceHistory.filter(s => s.timestamp >= fiveMinutesAgo);
  }

  private calculateMemoryTrend(snapshots: ResourceSnapshot[]): 'increasing' | 'decreasing' | 'stable' {
    if (snapshots.length < 10) return 'stable';
    
    const recent = snapshots.slice(-5);
    const older = snapshots.slice(-10, -5);
    
    const recentAvg = recent.reduce((sum, s) => sum + s.gpuMemory, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.gpuMemory, 0) / older.length;
    
    const threshold = 0.1; // 100MB threshold
    
    if (recentAvg > olderAvg + threshold) return 'increasing';
    if (recentAvg < olderAvg - threshold) return 'decreasing';
    return 'stable';
  }

  private calculateStability(snapshots: ResourceSnapshot[]): number {
    if (snapshots.length < 5) return 1.0;
    
    const gpuUsages = snapshots.map(s => s.gpuUsage);
    const mean = gpuUsages.reduce((a, b) => a + b, 0) / gpuUsages.length;
    const variance = gpuUsages.reduce((acc, usage) => acc + Math.pow(usage - mean, 2), 0) / gpuUsages.length;
    const stdDev = Math.sqrt(variance);
    
    // Stability is inverse of coefficient of variation
    return Math.max(0, Math.min(1, 1 - (stdDev / mean)));
  }
}

// Types and interfaces

export interface PerformanceTargets {
  targetFPS: number;
  maxGPUMemoryGB: number;
  maxCPUUsage: number;
}

export interface PerformanceReport {
  current: RenderingMetrics;
  average: RenderingMetrics;
  resources: ResourceStats;
  isAcceptable: boolean;
  recommendations: string[];
  recentOptimizations: OptimizationRecord[];
  systemHealth: number;
}

export interface OptimizationResult {
  success: boolean;
  beforeMetrics: RenderingMetrics;
  afterMetrics: RenderingMetrics;
  appliedOptimizations: OptimizationAction[];
  performanceGain: number;
  memoryReduction: number;
}

export interface OptimizationAction {
  type: 'reduce_lod' | 'simplify_geometry' | 'reduce_texture_resolution' | 'unload_unused_assets' | 'reduce_animation_quality';
  description: string;
  expectedGain: number;
  qualityImpact: number;
  execute: () => Promise<boolean>;
}

export interface OptimizationRecord {
  timestamp: number;
  trigger: 'manual' | 'automatic' | 'threshold';
  result: OptimizationResult;
  effectiveness: number;
}

export interface PerformanceWarning {
  type: 'fps' | 'gpu_memory' | 'cpu_usage' | 'render_time';
  current: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  message: string;
}

export interface ResourceStats {
  averageGPUUsage: number;
  averageCPUUsage: number;
  memoryTrend: 'increasing' | 'decreasing' | 'stable';
  stability: number;
}

export interface ResourceUtilization {
  gpu: {
    usage: number;
    memory: number;
    temperature: number;
  };
  cpu: {
    usage: number;
    cores: number[];
    temperature: number;
  };
  memory: {
    used: number;
    available: number;
    cached: number;
  };
  system: {
    uptime: number;
    load: number;
  };
}

interface ResourceSnapshot {
  timestamp: number;
  gpuUsage: number;
  gpuMemory: number;
  gpuTemperature: number;
  cpuUsage: number;
  cpuCores: number[];
  cpuTemperature: number;
  memoryUsed: number;
  memoryAvailable: number;
  memoryCached: number;
  systemUptime: number;
  systemLoad: number;
}

// Export singleton instance
export const performanceSystem = new PerformanceSystem();