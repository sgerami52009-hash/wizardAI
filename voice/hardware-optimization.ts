/**
 * Hardware Optimization for Jetson Nano Orin
 * Safety: Resource monitoring to prevent system overload
 * Performance: GPU acceleration and memory optimization
 */

import { EventEmitter } from 'events';
import { TTSOptions } from './interfaces';

export interface HardwareCapabilities {
  cpuCores: number;
  totalMemoryMB: number;
  availableMemoryMB: number;
  gpuAvailable: boolean;
  gpuMemoryMB?: number;
  maxConcurrentStreams: number;
  optimalBufferSize: number;
  supportedSampleRates: number[];
}

export interface OptimizationSettings {
  useGPUAcceleration: boolean;
  maxMemoryUsageMB: number;
  threadPoolSize: number;
  bufferSize: number;
  qualityLevel: 'low' | 'medium' | 'high';
  adaptiveQuality: boolean;
  powerMode: 'efficiency' | 'balanced' | 'performance';
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage?: number;
  temperature: number;
  powerConsumption: number;
  synthesisLatency: number;
  throughput: number; // characters per second
}

export interface OptimizationProfile {
  name: string;
  settings: OptimizationSettings;
  targetLatency: number;
  maxResourceUsage: number;
  description: string;
}

export class HardwareOptimizer extends EventEmitter {
  private capabilities: HardwareCapabilities;
  private currentSettings: OptimizationSettings;
  private metrics: PerformanceMetrics;
  private profiles: Map<string, OptimizationProfile>;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private adaptiveMode: boolean = true;

  constructor() {
    super();
    this.initializeProfiles();
    this.detectHardwareCapabilities();
    this.applyOptimalSettings();
    this.startPerformanceMonitoring();
  }

  /**
   * Detect Jetson Nano Orin hardware capabilities
   */
  private async detectHardwareCapabilities(): Promise<void> {
    // Mock implementation - in production, this would query actual hardware
    this.capabilities = {
      cpuCores: 6, // Jetson Nano Orin has 6-core ARM Cortex-A78AE
      totalMemoryMB: 8192, // 8GB RAM
      availableMemoryMB: 6144, // Available after system overhead
      gpuAvailable: true, // Integrated Ampere GPU
      gpuMemoryMB: 2048, // Shared GPU memory
      maxConcurrentStreams: 3,
      optimalBufferSize: 1024,
      supportedSampleRates: [16000, 22050, 44100, 48000]
    };

    this.emit('hardwareDetected', this.capabilities);
  }

  /**
   * Apply optimization settings based on hardware capabilities
   */
  private applyOptimalSettings(): void {
    // Start with balanced profile for Jetson Nano Orin
    const balancedProfile = this.profiles.get('balanced');
    if (balancedProfile) {
      this.currentSettings = { ...balancedProfile.settings };
    } else {
      // Fallback settings optimized for Jetson Nano Orin
      this.currentSettings = {
        useGPUAcceleration: this.capabilities.gpuAvailable,
        maxMemoryUsageMB: Math.floor(this.capabilities.availableMemoryMB * 0.3), // 30% of available
        threadPoolSize: Math.min(this.capabilities.cpuCores - 1, 4), // Leave one core for system
        bufferSize: this.capabilities.optimalBufferSize,
        qualityLevel: 'medium',
        adaptiveQuality: true,
        powerMode: 'balanced'
      };
    }

    this.emit('settingsApplied', this.currentSettings);
  }

  /**
   * Optimize TTS options for current hardware state
   */
  optimizeTTSOptions(baseOptions: TTSOptions): TTSOptions {
    const optimized = { ...baseOptions };

    // Adjust quality based on current system load
    if (this.adaptiveMode && this.metrics) {
      if (this.metrics.cpuUsage > 80 || this.metrics.memoryUsage > 85) {
        // Reduce quality to maintain performance
        optimized.rate = Math.min(optimized.rate || 1.0, 1.0);
        
        // Simplify voice processing for high load
        if (this.currentSettings.qualityLevel === 'high') {
          this.currentSettings.qualityLevel = 'medium';
          this.emit('qualityReduced', { reason: 'high_system_load', newLevel: 'medium' });
        }
      }
    }

    // Apply hardware-specific optimizations
    if (this.currentSettings.useGPUAcceleration && this.capabilities.gpuAvailable) {
      // GPU acceleration flags would be set here
      optimized.hardwareAcceleration = true;
    }

    return optimized;
  }

  /**
   * Get recommended buffer size for current conditions
   */
  getOptimalBufferSize(): number {
    const baseSize = this.capabilities.optimalBufferSize;
    
    // Adjust based on current load
    if (this.metrics && this.metrics.cpuUsage > 70) {
      return baseSize * 2; // Larger buffers for high CPU load
    }
    
    if (this.metrics && this.metrics.memoryUsage > 80) {
      return Math.floor(baseSize * 0.75); // Smaller buffers for high memory usage
    }
    
    return baseSize;
  }

  /**
   * Switch to a different optimization profile
   */
  applyProfile(profileName: string): boolean {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      return false;
    }

    this.currentSettings = { ...profile.settings };
    this.emit('profileChanged', { name: profileName, settings: this.currentSettings });
    return true;
  }

  /**
   * Enable or disable adaptive quality adjustment
   */
  setAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled;
    this.emit('adaptiveModeChanged', enabled);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get hardware capabilities
   */
  getCapabilities(): HardwareCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Get current optimization settings
   */
  getSettings(): OptimizationSettings {
    return { ...this.currentSettings };
  }

  /**
   * Check if system can handle additional TTS request
   */
  canHandleRequest(): boolean {
    if (!this.metrics) return true;

    const memoryOk = this.metrics.memoryUsage < 90;
    const cpuOk = this.metrics.cpuUsage < 85;
    const temperatureOk = this.metrics.temperature < 80; // Celsius

    return memoryOk && cpuOk && temperatureOk;
  }

  /**
   * Get thermal throttling status
   */
  getThermalStatus(): 'normal' | 'warning' | 'throttling' {
    if (!this.metrics) return 'normal';

    if (this.metrics.temperature > 85) return 'throttling';
    if (this.metrics.temperature > 75) return 'warning';
    return 'normal';
  }

  private initializeProfiles(): void {
    this.profiles = new Map([
      ['efficiency', {
        name: 'Efficiency',
        settings: {
          useGPUAcceleration: false,
          maxMemoryUsageMB: 512,
          threadPoolSize: 2,
          bufferSize: 512,
          qualityLevel: 'low',
          adaptiveQuality: true,
          powerMode: 'efficiency'
        },
        targetLatency: 400,
        maxResourceUsage: 50,
        description: 'Optimized for battery life and minimal resource usage'
      }],
      
      ['balanced', {
        name: 'Balanced',
        settings: {
          useGPUAcceleration: true,
          maxMemoryUsageMB: 1024,
          threadPoolSize: 3,
          bufferSize: 1024,
          qualityLevel: 'medium',
          adaptiveQuality: true,
          powerMode: 'balanced'
        },
        targetLatency: 300,
        maxResourceUsage: 70,
        description: 'Balance between performance and resource usage'
      }],
      
      ['performance', {
        name: 'Performance',
        settings: {
          useGPUAcceleration: true,
          maxMemoryUsageMB: 2048,
          threadPoolSize: 4,
          bufferSize: 2048,
          qualityLevel: 'high',
          adaptiveQuality: false,
          powerMode: 'performance'
        },
        targetLatency: 200,
        maxResourceUsage: 85,
        description: 'Maximum performance for best quality and speed'
      }],
      
      ['child_safe', {
        name: 'Child Safe',
        settings: {
          useGPUAcceleration: true,
          maxMemoryUsageMB: 768,
          threadPoolSize: 2,
          bufferSize: 1024,
          qualityLevel: 'medium',
          adaptiveQuality: true,
          powerMode: 'balanced'
        },
        targetLatency: 250,
        maxResourceUsage: 60,
        description: 'Optimized for child safety with conservative resource usage'
      }]
    ]);
  }

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.checkAdaptiveAdjustments();
    }, 2000); // Update every 2 seconds
  }

  private updateMetrics(): void {
    // Mock implementation - in production, this would read actual system metrics
    this.metrics = {
      cpuUsage: Math.random() * 40 + 20, // 20-60%
      memoryUsage: Math.random() * 30 + 40, // 40-70%
      gpuUsage: this.capabilities.gpuAvailable ? Math.random() * 20 + 10 : undefined,
      temperature: Math.random() * 15 + 45, // 45-60°C
      powerConsumption: Math.random() * 5 + 10, // 10-15W
      synthesisLatency: Math.random() * 100 + 150, // 150-250ms
      throughput: Math.random() * 50 + 100 // 100-150 chars/sec
    };

    this.emit('metricsUpdated', this.metrics);
  }

  private checkAdaptiveAdjustments(): void {
    if (!this.adaptiveMode || !this.metrics) return;

    const thermalStatus = this.getThermalStatus();
    
    // Thermal throttling
    if (thermalStatus === 'throttling') {
      if (this.currentSettings.qualityLevel !== 'low') {
        this.currentSettings.qualityLevel = 'low';
        this.currentSettings.powerMode = 'efficiency';
        this.emit('thermalThrottling', { 
          temperature: this.metrics.temperature,
          action: 'quality_reduced'
        });
      }
    }
    
    // Memory pressure
    if (this.metrics.memoryUsage > 85) {
      const newMemoryLimit = Math.floor(this.currentSettings.maxMemoryUsageMB * 0.8);
      if (newMemoryLimit !== this.currentSettings.maxMemoryUsageMB) {
        this.currentSettings.maxMemoryUsageMB = newMemoryLimit;
        this.emit('memoryPressure', {
          usage: this.metrics.memoryUsage,
          newLimit: newMemoryLimit
        });
      }
    }
    
    // CPU overload
    if (this.metrics.cpuUsage > 80) {
      if (this.currentSettings.threadPoolSize > 1) {
        this.currentSettings.threadPoolSize = Math.max(1, this.currentSettings.threadPoolSize - 1);
        this.emit('cpuOverload', {
          usage: this.metrics.cpuUsage,
          newThreads: this.currentSettings.threadPoolSize
        });
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.emit('destroyed');
  }
}