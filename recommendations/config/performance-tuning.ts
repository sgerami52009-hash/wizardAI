/**
 * Performance tuning and optimization configuration
 * Handles dynamic performance adjustments based on system state and hardware constraints
 */

import { SystemMetrics, PerformanceThreshold, PerformanceConstraints } from '../types';
import { SystemConfigManager } from './system-config';

export interface PerformanceTuningProfile {
  name: string;
  description: string;
  memoryOptimization: {
    enableModelCompression: boolean;
    cacheSize: number;
    batchSize: number;
    gcFrequency: number;
  };
  computeOptimization: {
    maxConcurrentRequests: number;
    threadPoolSize: number;
    enableGpuAcceleration: boolean;
    modelComplexity: 'minimal' | 'standard' | 'enhanced';
  };
  networkOptimization: {
    connectionPoolSize: number;
    requestTimeout: number;
    retryAttempts: number;
    enableCompression: boolean;
  };
  learningOptimization: {
    updateFrequency: 'realtime' | 'batched' | 'scheduled';
    batchSize: number;
    learningRate: number;
    enableIncrementalLearning: boolean;
  };
}

export interface AdaptiveSettings {
  currentProfile: string;
  autoTuningEnabled: boolean;
  thresholds: {
    memoryPressure: number; // 0-1 scale
    cpuPressure: number; // 0-1 scale
    latencyThreshold: number; // milliseconds
    errorRateThreshold: number; // 0-1 scale
  };
  adaptationRules: AdaptationRule[];
}

export interface AdaptationRule {
  condition: string;
  action: 'switch_profile' | 'adjust_setting' | 'disable_feature' | 'alert';
  parameters: Record<string, any>;
  priority: number;
}

export interface PerformanceOptimizationRecommendation {
  type: 'memory' | 'cpu' | 'latency' | 'throughput';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentValue: number;
  targetValue: number;
  actions: OptimizationAction[];
  estimatedImpact: {
    performanceGain: number; // percentage
    resourceSaving: number; // percentage
    implementationEffort: 'low' | 'medium' | 'high';
  };
}

export interface OptimizationAction {
  type: 'config_change' | 'feature_toggle' | 'resource_allocation' | 'algorithm_switch';
  description: string;
  parameters: Record<string, any>;
  reversible: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Performance tuning manager for dynamic optimization
 */
export class PerformanceTuningManager {
  private systemConfig: SystemConfigManager;
  private currentProfile: PerformanceTuningProfile;
  private adaptiveSettings: AdaptiveSettings;
  private performanceHistory: SystemMetrics[] = [];
  private optimizationCallbacks: Map<string, (profile: PerformanceTuningProfile) => void> = new Map();

  constructor(systemConfig: SystemConfigManager) {
    this.systemConfig = systemConfig;
    this.currentProfile = this.getDefaultProfile();
    this.adaptiveSettings = this.getDefaultAdaptiveSettings();
  }

  /**
   * Initialize performance tuning based on hardware detection
   */
  async initializePerformanceTuning(): Promise<void> {
    const systemInfo = await this.detectSystemCapabilities();
    const optimalProfile = this.selectOptimalProfile(systemInfo);
    
    await this.applyPerformanceProfile(optimalProfile);
    
    console.log(`Performance tuning initialized with profile: ${optimalProfile.name}`);
  }

  /**
   * Get current performance profile
   */
  getCurrentProfile(): PerformanceTuningProfile {
    return { ...this.currentProfile };
  }

  /**
   * Apply performance profile
   */
  async applyPerformanceProfile(profile: PerformanceTuningProfile): Promise<void> {
    console.log(`Applying performance profile: ${profile.name}`);
    
    // Update system configuration
    await this.systemConfig.updateConfiguration('performance', {
      optimization: {
        enableModelCompression: profile.memoryOptimization.enableModelCompression,
        enableCaching: profile.memoryOptimization.cacheSize > 0,
        maxConcurrentRecommendations: profile.computeOptimization.maxConcurrentRequests,
        backgroundLearningEnabled: profile.learningOptimization.updateFrequency !== 'scheduled'
      },
      hardware: {
        enableGpuAcceleration: profile.computeOptimization.enableGpuAcceleration
      }
    });

    this.currentProfile = profile;
    this.adaptiveSettings.currentProfile = profile.name;
    
    // Notify callbacks
    this.notifyOptimizationCallbacks(profile);
  }

  /**
   * Analyze current performance and recommend optimizations
   */
  analyzePerformance(metrics: SystemMetrics): PerformanceOptimizationRecommendation[] {
    const recommendations: PerformanceOptimizationRecommendation[] = [];
    const config = this.systemConfig.getConfiguration();

    // Memory analysis
    if (metrics.memory.utilizationPercent > 85) {
      recommendations.push({
        type: 'memory',
        severity: metrics.memory.utilizationPercent > 95 ? 'critical' : 'high',
        description: 'High memory usage detected',
        currentValue: metrics.memory.utilizationPercent,
        targetValue: 75,
        actions: [
          {
            type: 'config_change',
            description: 'Enable aggressive model compression',
            parameters: { enableModelCompression: true, compressionRatio: 0.5 },
            reversible: true,
            riskLevel: 'low'
          },
          {
            type: 'feature_toggle',
            description: 'Reduce cache size',
            parameters: { cacheSize: Math.floor(this.currentProfile.memoryOptimization.cacheSize * 0.5) },
            reversible: true,
            riskLevel: 'medium'
          }
        ],
        estimatedImpact: {
          performanceGain: -10, // May reduce performance slightly
          resourceSaving: 25,
          implementationEffort: 'low'
        }
      });
    }

    // CPU analysis
    if (metrics.cpu.utilizationPercent > 80) {
      recommendations.push({
        type: 'cpu',
        severity: metrics.cpu.utilizationPercent > 90 ? 'high' : 'medium',
        description: 'High CPU usage detected',
        currentValue: metrics.cpu.utilizationPercent,
        targetValue: 70,
        actions: [
          {
            type: 'resource_allocation',
            description: 'Reduce concurrent request limit',
            parameters: { maxConcurrentRequests: Math.max(1, this.currentProfile.computeOptimization.maxConcurrentRequests - 2) },
            reversible: true,
            riskLevel: 'low'
          },
          {
            type: 'algorithm_switch',
            description: 'Switch to simpler recommendation algorithms',
            parameters: { modelComplexity: 'minimal' },
            reversible: true,
            riskLevel: 'medium'
          }
        ],
        estimatedImpact: {
          performanceGain: 15,
          resourceSaving: 20,
          implementationEffort: 'medium'
        }
      });
    }

    // Latency analysis
    if (metrics.latency.p95 > config.performance.thresholds.maxLatencyMs) {
      recommendations.push({
        type: 'latency',
        severity: metrics.latency.p95 > config.performance.thresholds.maxLatencyMs * 1.5 ? 'high' : 'medium',
        description: 'High response latency detected',
        currentValue: metrics.latency.p95,
        targetValue: config.performance.thresholds.maxLatencyMs,
        actions: [
          {
            type: 'config_change',
            description: 'Enable aggressive caching',
            parameters: { enableCaching: true, cacheSize: this.currentProfile.memoryOptimization.cacheSize * 1.5 },
            reversible: true,
            riskLevel: 'low'
          },
          {
            type: 'feature_toggle',
            description: 'Reduce recommendation complexity',
            parameters: { modelComplexity: 'standard' },
            reversible: true,
            riskLevel: 'medium'
          }
        ],
        estimatedImpact: {
          performanceGain: 30,
          resourceSaving: -10, // May use more memory for caching
          implementationEffort: 'low'
        }
      });
    }

    return recommendations;
  }

  /**
   * Apply adaptive performance adjustments
   */
  async applyAdaptiveAdjustments(metrics: SystemMetrics): Promise<void> {
    if (!this.adaptiveSettings.autoTuningEnabled) {
      return;
    }

    const memoryPressure = metrics.memory.utilizationPercent / 100;
    const cpuPressure = metrics.cpu.utilizationPercent / 100;
    const latencyPressure = metrics.latency.p95 / this.systemConfig.getConfiguration().performance.thresholds.maxLatencyMs;

    // Check adaptation rules
    for (const rule of this.adaptiveSettings.adaptationRules) {
      if (this.evaluateAdaptationRule(rule, { memoryPressure, cpuPressure, latencyPressure })) {
        await this.executeAdaptationAction(rule);
      }
    }
  }

  /**
   * Get performance tuning recommendations for Jetson Nano Orin
   */
  getJetsonOptimizationRecommendations(): PerformanceOptimizationRecommendation[] {
    return [
      {
        type: 'memory',
        severity: 'medium',
        description: 'Optimize for Jetson Nano Orin memory constraints',
        currentValue: 0,
        targetValue: 1536, // 1.5GB target
        actions: [
          {
            type: 'config_change',
            description: 'Enable Jetson-specific optimizations',
            parameters: { 
              jetsonOptimizations: true,
              enableModelCompression: true,
              maxMemoryMB: 1536
            },
            reversible: true,
            riskLevel: 'low'
          },
          {
            type: 'algorithm_switch',
            description: 'Use memory-efficient algorithms',
            parameters: { 
              modelComplexity: 'standard',
              batchSize: 8,
              enableIncrementalLearning: true
            },
            reversible: true,
            riskLevel: 'low'
          }
        ],
        estimatedImpact: {
          performanceGain: 20,
          resourceSaving: 35,
          implementationEffort: 'medium'
        }
      },
      {
        type: 'cpu',
        severity: 'low',
        description: 'Optimize CPU usage for ARM architecture',
        currentValue: 0,
        targetValue: 60,
        actions: [
          {
            type: 'resource_allocation',
            description: 'Optimize thread pool for ARM cores',
            parameters: { 
              threadPoolSize: 4,
              maxConcurrentRequests: 3
            },
            reversible: true,
            riskLevel: 'low'
          },
          {
            type: 'feature_toggle',
            description: 'Enable GPU acceleration where available',
            parameters: { 
              enableGpuAcceleration: true
            },
            reversible: true,
            riskLevel: 'low'
          }
        ],
        estimatedImpact: {
          performanceGain: 25,
          resourceSaving: 15,
          implementationEffort: 'low'
        }
      }
    ];
  }

  /**
   * Watch for performance optimization changes
   */
  watchOptimizations(key: string, callback: (profile: PerformanceTuningProfile) => void): void {
    this.optimizationCallbacks.set(key, callback);
  }

  /**
   * Stop watching optimization changes
   */
  unwatchOptimizations(key: string): void {
    this.optimizationCallbacks.delete(key);
  }

  /**
   * Get available performance profiles
   */
  getAvailableProfiles(): PerformanceTuningProfile[] {
    return [
      this.getMinimalProfile(),
      this.getBalancedProfile(),
      this.getPerformanceProfile(),
      this.getJetsonOptimizedProfile()
    ];
  }

  /**
   * Get default performance profile
   */
  private getDefaultProfile(): PerformanceTuningProfile {
    return this.getBalancedProfile();
  }

  /**
   * Get minimal performance profile (maximum resource conservation)
   */
  private getMinimalProfile(): PerformanceTuningProfile {
    return {
      name: 'minimal',
      description: 'Minimal resource usage, basic functionality',
      memoryOptimization: {
        enableModelCompression: true,
        cacheSize: 50, // MB
        batchSize: 4,
        gcFrequency: 30000 // 30 seconds
      },
      computeOptimization: {
        maxConcurrentRequests: 2,
        threadPoolSize: 2,
        enableGpuAcceleration: false,
        modelComplexity: 'minimal'
      },
      networkOptimization: {
        connectionPoolSize: 5,
        requestTimeout: 10000,
        retryAttempts: 1,
        enableCompression: true
      },
      learningOptimization: {
        updateFrequency: 'scheduled',
        batchSize: 10,
        learningRate: 0.01,
        enableIncrementalLearning: true
      }
    };
  }

  /**
   * Get balanced performance profile
   */
  private getBalancedProfile(): PerformanceTuningProfile {
    return {
      name: 'balanced',
      description: 'Balanced performance and resource usage',
      memoryOptimization: {
        enableModelCompression: true,
        cacheSize: 128, // MB
        batchSize: 8,
        gcFrequency: 60000 // 1 minute
      },
      computeOptimization: {
        maxConcurrentRequests: 5,
        threadPoolSize: 4,
        enableGpuAcceleration: true,
        modelComplexity: 'standard'
      },
      networkOptimization: {
        connectionPoolSize: 10,
        requestTimeout: 5000,
        retryAttempts: 2,
        enableCompression: true
      },
      learningOptimization: {
        updateFrequency: 'batched',
        batchSize: 20,
        learningRate: 0.05,
        enableIncrementalLearning: true
      }
    };
  }

  /**
   * Get performance-focused profile
   */
  private getPerformanceProfile(): PerformanceTuningProfile {
    return {
      name: 'performance',
      description: 'Maximum performance, higher resource usage',
      memoryOptimization: {
        enableModelCompression: false,
        cacheSize: 256, // MB
        batchSize: 16,
        gcFrequency: 120000 // 2 minutes
      },
      computeOptimization: {
        maxConcurrentRequests: 10,
        threadPoolSize: 6,
        enableGpuAcceleration: true,
        modelComplexity: 'enhanced'
      },
      networkOptimization: {
        connectionPoolSize: 20,
        requestTimeout: 3000,
        retryAttempts: 3,
        enableCompression: false
      },
      learningOptimization: {
        updateFrequency: 'realtime',
        batchSize: 50,
        learningRate: 0.1,
        enableIncrementalLearning: false
      }
    };
  }

  /**
   * Get Jetson Nano Orin optimized profile
   */
  private getJetsonOptimizedProfile(): PerformanceTuningProfile {
    return {
      name: 'jetson-optimized',
      description: 'Optimized for Jetson Nano Orin hardware',
      memoryOptimization: {
        enableModelCompression: true,
        cacheSize: 96, // MB
        batchSize: 6,
        gcFrequency: 45000 // 45 seconds
      },
      computeOptimization: {
        maxConcurrentRequests: 3,
        threadPoolSize: 4, // Match ARM core count
        enableGpuAcceleration: true,
        modelComplexity: 'standard'
      },
      networkOptimization: {
        connectionPoolSize: 8,
        requestTimeout: 4000,
        retryAttempts: 2,
        enableCompression: true
      },
      learningOptimization: {
        updateFrequency: 'batched',
        batchSize: 15,
        learningRate: 0.03,
        enableIncrementalLearning: true
      }
    };
  }

  /**
   * Get default adaptive settings
   */
  private getDefaultAdaptiveSettings(): AdaptiveSettings {
    return {
      currentProfile: 'balanced',
      autoTuningEnabled: true,
      thresholds: {
        memoryPressure: 0.85,
        cpuPressure: 0.80,
        latencyThreshold: 2000,
        errorRateThreshold: 0.05
      },
      adaptationRules: [
        {
          condition: 'memoryPressure > 0.90',
          action: 'switch_profile',
          parameters: { profile: 'minimal' },
          priority: 1
        },
        {
          condition: 'cpuPressure > 0.85',
          action: 'adjust_setting',
          parameters: { setting: 'maxConcurrentRequests', value: 2 },
          priority: 2
        },
        {
          condition: 'latencyThreshold > 3000',
          action: 'switch_profile',
          parameters: { profile: 'minimal' },
          priority: 3
        }
      ]
    };
  }

  /**
   * Detect system capabilities
   */
  private async detectSystemCapabilities(): Promise<any> {
    // In a real implementation, this would detect actual hardware
    return {
      totalMemory: 8192, // MB
      cpuCores: 6,
      architecture: 'arm64',
      gpuAvailable: true,
      isJetson: true
    };
  }

  /**
   * Select optimal profile based on system info
   */
  private selectOptimalProfile(systemInfo: any): PerformanceTuningProfile {
    if (systemInfo.isJetson) {
      return this.getJetsonOptimizedProfile();
    }
    
    if (systemInfo.totalMemory < 4096) {
      return this.getMinimalProfile();
    }
    
    return this.getBalancedProfile();
  }

  /**
   * Evaluate adaptation rule
   */
  private evaluateAdaptationRule(rule: AdaptationRule, metrics: any): boolean {
    // Simple condition evaluation - in a real implementation, this would be more sophisticated
    try {
      return eval(rule.condition.replace(/memoryPressure/g, metrics.memoryPressure.toString())
                                .replace(/cpuPressure/g, metrics.cpuPressure.toString())
                                .replace(/latencyPressure/g, metrics.latencyPressure.toString()));
    } catch (error) {
      console.error('Error evaluating adaptation rule:', error);
      return false;
    }
  }

  /**
   * Execute adaptation action
   */
  private async executeAdaptationAction(rule: AdaptationRule): Promise<void> {
    console.log(`Executing adaptation action: ${rule.action}`);
    
    switch (rule.action) {
      case 'switch_profile':
        const profile = this.getAvailableProfiles().find(p => p.name === rule.parameters.profile);
        if (profile) {
          await this.applyPerformanceProfile(profile);
        }
        break;
      case 'adjust_setting':
        // Adjust specific setting
        console.log(`Adjusting ${rule.parameters.setting} to ${rule.parameters.value}`);
        break;
      case 'disable_feature':
        console.log(`Disabling feature: ${rule.parameters.feature}`);
        break;
      case 'alert':
        console.warn(`Performance alert: ${rule.parameters.message}`);
        break;
    }
  }

  /**
   * Notify optimization callbacks
   */
  private notifyOptimizationCallbacks(profile: PerformanceTuningProfile): void {
    for (const callback of this.optimizationCallbacks.values()) {
      try {
        callback(profile);
      } catch (error) {
        console.error('Error notifying optimization callback:', error);
      }
    }
  }
}