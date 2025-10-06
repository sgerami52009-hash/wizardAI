// Rendering Performance Monitoring and Optimization

import { RenderingMetrics, PerformanceThresholds, QualitySettings } from './types';
import { avatarEventBus } from '../avatar/events';

export interface PerformanceMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  getCurrentMetrics(): RenderingMetrics;
  getAverageMetrics(timeWindowMs: number): RenderingMetrics;
  setThresholds(thresholds: PerformanceThresholds): void;
  isPerformanceAcceptable(): boolean;
}

export interface QualityOptimizer {
  optimizeForTarget(targetFPS: number, currentMetrics: RenderingMetrics): QualitySettings;
  getRecommendedSettings(hardwareCapabilities: any): QualitySettings;
  applyOptimizations(optimizations: OptimizationAction[]): Promise<boolean>;
}

export interface OptimizationAction {
  type: 'reduce_lod' | 'lower_texture_res' | 'disable_shadows' | 'reduce_particles' | 'simplify_animations';
  description: string;
  performanceGain: number; // Expected FPS improvement
  qualityImpact: number; // Visual quality reduction (0-1)
  execute: () => Promise<boolean>;
}

export class PerformanceMonitorImpl implements PerformanceMonitor {
  private monitoring = false;
  private metricsHistory: Array<{ timestamp: number; metrics: RenderingMetrics }> = [];
  private thresholds: PerformanceThresholds = {
    minFPS: 45,
    maxGPUMemory: 2.0, // 2GB for Jetson Nano Orin
    maxCPUUsage: 50,
    maxRenderTime: 16.67 // ~60fps
  };
  private monitoringInterval?: any;

  startMonitoring(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.recordMetrics(metrics);
      this.checkThresholds(metrics);
    }, 1000); // Check every second
  }

  stopMonitoring(): void {
    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  getCurrentMetrics(): RenderingMetrics {
    return this.collectMetrics();
  }

  getAverageMetrics(timeWindowMs: number): RenderingMetrics {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMetrics = this.metricsHistory
      .filter(entry => entry.timestamp >= cutoffTime)
      .map(entry => entry.metrics);

    if (recentMetrics.length === 0) {
      return this.getCurrentMetrics();
    }

    // Calculate averages
    const avgMetrics: RenderingMetrics = {
      currentFPS: recentMetrics.reduce((sum, m) => sum + m.currentFPS, 0) / recentMetrics.length,
      gpuMemoryUsage: recentMetrics.reduce((sum, m) => sum + m.gpuMemoryUsage, 0) / recentMetrics.length,
      cpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length,
      renderTime: recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length,
      triangleCount: recentMetrics.reduce((sum, m) => sum + m.triangleCount, 0) / recentMetrics.length,
      textureMemory: recentMetrics.reduce((sum, m) => sum + m.textureMemory, 0) / recentMetrics.length,
      shaderCompileTime: recentMetrics.reduce((sum, m) => sum + m.shaderCompileTime, 0) / recentMetrics.length,
      drawCalls: recentMetrics.reduce((sum, m) => sum + m.drawCalls, 0) / recentMetrics.length
    };

    return avgMetrics;
  }

  setThresholds(thresholds: PerformanceThresholds): void {
    this.thresholds = { ...thresholds };
  }

  isPerformanceAcceptable(): boolean {
    const metrics = this.getCurrentMetrics();
    return (
      metrics.currentFPS >= this.thresholds.minFPS &&
      metrics.gpuMemoryUsage <= this.thresholds.maxGPUMemory &&
      metrics.cpuUsage <= this.thresholds.maxCPUUsage &&
      metrics.renderTime <= this.thresholds.maxRenderTime
    );
  }

  private collectMetrics(): RenderingMetrics {
    // In a real implementation, this would collect actual metrics from the GPU/renderer
    // For now, return mock metrics that would be realistic for Jetson Nano Orin
    return {
      currentFPS: 60,
      gpuMemoryUsage: 1.2, // GB
      cpuUsage: 35, // %
      renderTime: 14.5, // ms
      triangleCount: 15000,
      textureMemory: 0.8, // GB
      shaderCompileTime: 2.1, // ms
      drawCalls: 45
    };
  }

  private recordMetrics(metrics: RenderingMetrics): void {
    this.metricsHistory.push({
      timestamp: Date.now(),
      metrics
    });

    // Keep only last 5 minutes of data
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    this.metricsHistory = this.metricsHistory.filter(entry => entry.timestamp >= fiveMinutesAgo);
  }

  private checkThresholds(metrics: RenderingMetrics): void {
    if (metrics.currentFPS < this.thresholds.minFPS) {
      avatarEventBus.emitPerformanceWarning('fps', metrics.currentFPS, this.thresholds.minFPS);
    }
    
    if (metrics.gpuMemoryUsage > this.thresholds.maxGPUMemory) {
      avatarEventBus.emitPerformanceWarning('gpu_memory', metrics.gpuMemoryUsage, this.thresholds.maxGPUMemory);
    }
    
    if (metrics.cpuUsage > this.thresholds.maxCPUUsage) {
      avatarEventBus.emitPerformanceWarning('cpu_usage', metrics.cpuUsage, this.thresholds.maxCPUUsage);
    }
    
    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      avatarEventBus.emitPerformanceWarning('render_time', metrics.renderTime, this.thresholds.maxRenderTime);
    }
  }
}

export class QualityOptimizerImpl implements QualityOptimizer {
  optimizeForTarget(targetFPS: number, currentMetrics: RenderingMetrics): QualitySettings {
    const currentFPS = currentMetrics.currentFPS;
    const fpsDeficit = targetFPS - currentFPS;
    
    // Base quality settings
    let settings: QualitySettings = {
      lodLevel: 1,
      textureResolution: 1024,
      shadowQuality: 'medium' as any,
      antiAliasing: 'fxaa' as any,
      particleCount: 100,
      animationQuality: 'medium' as any,
      renderDistance: 50
    };

    // Adjust based on performance deficit
    if (fpsDeficit > 15) {
      // Aggressive optimization needed
      settings = {
        lodLevel: 3,
        textureResolution: 512,
        shadowQuality: 'disabled' as any,
        antiAliasing: 'none' as any,
        particleCount: 25,
        animationQuality: 'low' as any,
        renderDistance: 30
      };
    } else if (fpsDeficit > 5) {
      // Moderate optimization
      settings = {
        lodLevel: 2,
        textureResolution: 768,
        shadowQuality: 'low' as any,
        antiAliasing: 'fxaa' as any,
        particleCount: 50,
        animationQuality: 'medium' as any,
        renderDistance: 40
      };
    }

    return settings;
  }

  getRecommendedSettings(hardwareCapabilities: any): QualitySettings {
    // Jetson Nano Orin optimized settings
    return {
      lodLevel: 1,
      textureResolution: 1024,
      shadowQuality: 'medium' as any,
      antiAliasing: 'fxaa' as any,
      particleCount: 75,
      animationQuality: 'medium' as any,
      renderDistance: 45
    };
  }

  async applyOptimizations(optimizations: OptimizationAction[]): Promise<boolean> {
    try {
      for (const optimization of optimizations) {
        const success = await optimization.execute();
        if (!success) {
          console.warn(`Failed to apply optimization: ${optimization.description}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error applying optimizations:', error);
      return false;
    }
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitorImpl();
export const qualityOptimizer = new QualityOptimizerImpl();