import { EventEmitter } from 'events';
import { RenderingMetrics, PerformanceThresholds } from '../rendering/types';

/**
 * Resource metrics interface for comprehensive system monitoring
 */
export interface ResourceMetrics {
  timestamp: number;
  gpu: GPUMetrics;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  rendering: RenderingMetrics;
  system: SystemMetrics;
}

export interface GPUMetrics {
  memoryUsageGB: number;
  utilizationPercent: number;
  temperature: number;
  powerUsage: number;
  clockSpeed: number;
}

export interface CPUMetrics {
  usagePercent: number;
  temperature: number;
  clockSpeed: number;
  coreCount: number;
  activeThreads: number;
}

export interface MemoryMetrics {
  totalGB: number;
  usedGB: number;
  availableGB: number;
  swapUsedGB: number;
  buffersCacheGB: number;
}

export interface SystemMetrics {
  uptime: number;
  loadAverage: number[];
  diskUsage: DiskMetrics;
  networkActivity: NetworkMetrics;
}

export interface DiskMetrics {
  totalGB: number;
  usedGB: number;
  availableGB: number;
  readSpeed: number;
  writeSpeed: number;
}

export interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
}

export interface ResourceThresholds {
  maxGPUMemoryGB: number;
  maxCPUUsage: number;
  minFPS: number;
  maxRenderTime: number;
  criticalGPUMemoryGB: number;
  criticalCPUUsage: number;
  criticalFPS: number;
  maxMemoryUsageGB: number;
  maxGPUTemperature: number;
  maxCPUTemperature: number;
}

export interface PerformanceAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  metrics: ResourceMetrics;
  recommendations: string[];
}

export enum AlertType {
  GPU_MEMORY = 'gpu_memory',
  CPU_USAGE = 'cpu_usage',
  FPS_DROP = 'fps_drop',
  RENDER_TIME = 'render_time',
  TEMPERATURE = 'temperature',
  MEMORY_USAGE = 'memory_usage'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface OptimizationRecommendation {
  category: 'rendering' | 'memory' | 'cpu' | 'gpu';
  priority: 'low' | 'medium' | 'high';
  description: string;
  action: string;
  expectedImprovement: string;
  implementationComplexity: 'easy' | 'moderate' | 'complex';
}

export interface PerformanceTrend {
  timestamp: number;
  fps: number;
  gpuMemory: number;
  cpuUsage: number;
  renderTime: number;
}

export interface SystemHealthStatus {
  overall: HealthStatus;
  components: Record<string, ComponentHealth>;
  score: number;
  recommendations: OptimizationRecommendation[];
}

export interface ComponentHealth {
  status: HealthStatus;
  score: number;
  metrics: Record<string, number>;
}

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';/**
 
* Comprehensive resource monitoring system for avatar customization
 * Monitors GPU, CPU, and memory usage with performance threshold detection
 * Provides adaptive quality adjustment and optimization recommendations
 */
export class ResourceMonitor extends EventEmitter {
  private isActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: ResourceMetrics[] = [];
  private thresholds: ResourceThresholds;
  private alertCooldowns = new Map<string, number>();
  private readonly HISTORY_LIMIT = 300; // 5 minutes at 1-second intervals
  private readonly COOLDOWN_DURATION = 30000; // 30 seconds between same alerts

  constructor(thresholds?: Partial<ResourceThresholds>) {
    super();
    this.thresholds = {
      maxGPUMemoryGB: 2.0,
      maxCPUUsage: 70,
      minFPS: 45,
      maxRenderTime: 22, // ~45fps = 22ms per frame
      criticalGPUMemoryGB: 1.8,
      criticalCPUUsage: 85,
      criticalFPS: 30,
      maxMemoryUsageGB: 6.0, // Leave 2GB for system on 8GB device
      maxGPUTemperature: 80,
      maxCPUTemperature: 85,
      ...thresholds
    };
  }

  async startMonitoring(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 1000);
    this.emit('monitoringStarted');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.emit('monitoringStopped');
  }

  getCurrentMetrics(): ResourceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  getAverageMetrics(timeWindowMs: number = 60000): ResourceMetrics | null {
    const cutoffTime = Date.now() - timeWindowMs;
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    if (relevantMetrics.length === 0) return null;

    return {
      timestamp: Date.now(),
      gpu: {
        memoryUsageGB: this.average(relevantMetrics.map(m => m.gpu.memoryUsageGB)),
        utilizationPercent: this.average(relevantMetrics.map(m => m.gpu.utilizationPercent)),
        temperature: this.average(relevantMetrics.map(m => m.gpu.temperature)),
        powerUsage: this.average(relevantMetrics.map(m => m.gpu.powerUsage)),
        clockSpeed: this.average(relevantMetrics.map(m => m.gpu.clockSpeed))
      },
      cpu: {
        usagePercent: this.average(relevantMetrics.map(m => m.cpu.usagePercent)),
        temperature: this.average(relevantMetrics.map(m => m.cpu.temperature)),
        clockSpeed: this.average(relevantMetrics.map(m => m.cpu.clockSpeed)),
        coreCount: relevantMetrics[0].cpu.coreCount,
        activeThreads: this.average(relevantMetrics.map(m => m.cpu.activeThreads))
      },
      memory: {
        totalGB: relevantMetrics[0].memory.totalGB,
        usedGB: this.average(relevantMetrics.map(m => m.memory.usedGB)),
        availableGB: this.average(relevantMetrics.map(m => m.memory.availableGB)),
        swapUsedGB: this.average(relevantMetrics.map(m => m.memory.swapUsedGB)),
        buffersCacheGB: this.average(relevantMetrics.map(m => m.memory.buffersCacheGB))
      },
      rendering: {
        currentFPS: this.average(relevantMetrics.map(m => m.rendering.currentFPS)),
        gpuMemoryUsage: this.average(relevantMetrics.map(m => m.rendering.gpuMemoryUsage)),
        cpuUsage: this.average(relevantMetrics.map(m => m.rendering.cpuUsage)),
        renderTime: this.average(relevantMetrics.map(m => m.rendering.renderTime)),
        triangleCount: this.average(relevantMetrics.map(m => m.rendering.triangleCount)),
        textureMemory: this.average(relevantMetrics.map(m => m.rendering.textureMemory)),
        shaderCompileTime: this.average(relevantMetrics.map(m => m.rendering.shaderCompileTime)),
        drawCalls: this.average(relevantMetrics.map(m => m.rendering.drawCalls))
      },
      system: {
        uptime: relevantMetrics[relevantMetrics.length - 1].system.uptime,
        loadAverage: relevantMetrics[relevantMetrics.length - 1].system.loadAverage,
        diskUsage: relevantMetrics[relevantMetrics.length - 1].system.diskUsage,
        networkActivity: relevantMetrics[relevantMetrics.length - 1].system.networkActivity
      }
    };
  }

  getPerformanceTrends(timeWindowMs: number = 300000): PerformanceTrend[] {
    const cutoffTime = Date.now() - timeWindowMs;
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    if (relevantMetrics.length < 2) return [];

    const trends: PerformanceTrend[] = [];
    const windowSize = Math.max(1, Math.floor(relevantMetrics.length / 10));

    for (let i = 0; i < relevantMetrics.length - windowSize; i += windowSize) {
      const window = relevantMetrics.slice(i, i + windowSize);
      const avgMetrics = this.calculateWindowAverage(window);
      trends.push({
        timestamp: window[Math.floor(window.length / 2)].timestamp,
        fps: avgMetrics.rendering.currentFPS,
        gpuMemory: avgMetrics.gpu.memoryUsageGB,
        cpuUsage: avgMetrics.cpu.usagePercent,
        renderTime: avgMetrics.rendering.renderTime
      });
    }
    return trends;
  }

  checkThresholds(metrics: ResourceMetrics): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const now = Date.now();

    if (metrics.gpu.memoryUsageGB >= this.thresholds.criticalGPUMemoryGB) {
      if (this.shouldAlert(AlertType.GPU_MEMORY, now)) {
        alerts.push({
          type: AlertType.GPU_MEMORY,
          severity: AlertSeverity.CRITICAL,
          message: `Critical GPU memory usage: ${metrics.gpu.memoryUsageGB.toFixed(2)}GB / ${this.thresholds.maxGPUMemoryGB}GB`,
          timestamp: now,
          metrics,
          recommendations: ['Reduce texture quality', 'Lower model detail level', 'Disable advanced visual effects', 'Unload unused assets']
        });
      }
    }

    if (metrics.cpu.usagePercent >= this.thresholds.criticalCPUUsage) {
      if (this.shouldAlert(AlertType.CPU_USAGE, now)) {
        alerts.push({
          type: AlertType.CPU_USAGE,
          severity: AlertSeverity.CRITICAL,
          message: `Critical CPU usage: ${metrics.cpu.usagePercent.toFixed(1)}%`,
          timestamp: now,
          metrics,
          recommendations: ['Reduce animation complexity', 'Lower physics simulation quality', 'Disable background processing']
        });
      }
    }

    if (metrics.rendering.currentFPS <= this.thresholds.criticalFPS) {
      if (this.shouldAlert(AlertType.FPS_DROP, now)) {
        alerts.push({
          type: AlertType.FPS_DROP,
          severity: AlertSeverity.CRITICAL,
          message: `Critical FPS drop: ${metrics.rendering.currentFPS.toFixed(1)} FPS`,
          timestamp: now,
          metrics,
          recommendations: ['Enable automatic quality reduction', 'Reduce render complexity', 'Lower resolution']
        });
      }
    }

    alerts.forEach(alert => {
      this.emit('performanceAlert', alert);
      this.alertCooldowns.set(alert.type, now);
    });

    return alerts;
  }

  generateOptimizationRecommendations(): OptimizationRecommendation[] {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) return [];

    const recommendations: OptimizationRecommendation[] = [];
    const avgMetrics = this.getAverageMetrics(60000);
    if (!avgMetrics) return recommendations;

    if (avgMetrics.gpu.memoryUsageGB > this.thresholds.maxGPUMemoryGB * 0.8) {
      recommendations.push({
        category: 'gpu',
        priority: 'high',
        description: 'GPU memory usage is approaching limits',
        action: 'Implement texture compression and asset streaming',
        expectedImprovement: '20-30% memory reduction',
        implementationComplexity: 'moderate'
      });
    }

    if (avgMetrics.cpu.usagePercent > this.thresholds.maxCPUUsage * 0.8) {
      recommendations.push({
        category: 'cpu',
        priority: 'high',
        description: 'CPU usage is consistently high',
        action: 'Optimize animation processing and reduce concurrent operations',
        expectedImprovement: '15-25% CPU reduction',
        implementationComplexity: 'moderate'
      });
    }

    if (avgMetrics.rendering.currentFPS < this.thresholds.minFPS * 1.2) {
      recommendations.push({
        category: 'rendering',
        priority: 'high',
        description: 'Frame rate is below optimal levels',
        action: 'Enable adaptive quality system and LOD optimization',
        expectedImprovement: '10-20 FPS increase',
        implementationComplexity: 'complex'
      });
    }

    return recommendations;
  }

  getSystemHealthStatus(): SystemHealthStatus {
    const currentMetrics = this.getCurrentMetrics();
    if (!currentMetrics) {
      return {
        overall: 'unknown',
        components: {},
        score: 0,
        recommendations: []
      };
    }

    const components: Record<string, ComponentHealth> = {};
    let totalScore = 0;
    let componentCount = 0;

    const gpuScore = this.calculateGPUHealth(currentMetrics.gpu);
    components.gpu = {
      status: gpuScore > 80 ? 'healthy' : gpuScore > 60 ? 'warning' : 'critical',
      score: gpuScore,
      metrics: {
        memoryUsage: currentMetrics.gpu.memoryUsageGB,
        utilization: currentMetrics.gpu.utilizationPercent,
        temperature: currentMetrics.gpu.temperature
      }
    };
    totalScore += gpuScore;
    componentCount++;

    const cpuScore = this.calculateCPUHealth(currentMetrics.cpu);
    components.cpu = {
      status: cpuScore > 80 ? 'healthy' : cpuScore > 60 ? 'warning' : 'critical',
      score: cpuScore,
      metrics: {
        usage: currentMetrics.cpu.usagePercent,
        temperature: currentMetrics.cpu.temperature,
        clockSpeed: currentMetrics.cpu.clockSpeed
      }
    };
    totalScore += cpuScore;
    componentCount++;

    const memoryScore = this.calculateMemoryHealth(currentMetrics.memory);
    components.memory = {
      status: memoryScore > 80 ? 'healthy' : memoryScore > 60 ? 'warning' : 'critical',
      score: memoryScore,
      metrics: {
        usedGB: currentMetrics.memory.usedGB,
        totalGB: currentMetrics.memory.totalGB,
        utilizationPercent: (currentMetrics.memory.usedGB / currentMetrics.memory.totalGB) * 100
      }
    };
    totalScore += memoryScore;
    componentCount++;

    const renderingScore = this.calculateRenderingHealth(currentMetrics.rendering);
    components.rendering = {
      status: renderingScore > 80 ? 'healthy' : renderingScore > 60 ? 'warning' : 'critical',
      score: renderingScore,
      metrics: {
        fps: currentMetrics.rendering.currentFPS,
        renderTime: currentMetrics.rendering.renderTime,
        gpuMemoryUsage: currentMetrics.rendering.gpuMemoryUsage
      }
    };
    totalScore += renderingScore;
    componentCount++;

    const overallScore = totalScore / componentCount;
    const overallStatus: HealthStatus = overallScore > 80 ? 'healthy' : overallScore > 60 ? 'warning' : 'critical';

    return {
      overall: overallStatus,
      components,
      score: overallScore,
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics: ResourceMetrics = {
        timestamp: Date.now(),
        gpu: await this.collectGPUMetrics(),
        cpu: await this.collectCPUMetrics(),
        memory: await this.collectMemoryMetrics(),
        rendering: await this.collectRenderingMetrics(),
        system: await this.collectSystemMetrics()
      };

      this.metricsHistory.push(metrics);

      if (this.metricsHistory.length > this.HISTORY_LIMIT) {
        this.metricsHistory = this.metricsHistory.slice(-this.HISTORY_LIMIT);
      }

      const alerts = this.checkThresholds(metrics);
      this.emit('metricsUpdate', metrics);

      const healthStatus = this.getSystemHealthStatus();
      this.emit('healthStatusUpdate', healthStatus);

    } catch (error) {
      this.emit('error', new Error(`Failed to collect metrics: ${error}`));
    }
  }

  private async collectGPUMetrics(): Promise<GPUMetrics> {
    return {
      memoryUsageGB: Math.random() * 1.5 + 0.3,
      utilizationPercent: Math.random() * 60 + 20,
      temperature: Math.random() * 20 + 45,
      powerUsage: Math.random() * 10 + 5,
      clockSpeed: 1300 + Math.random() * 200
    };
  }

  private async collectCPUMetrics(): Promise<CPUMetrics> {
    return {
      usagePercent: Math.random() * 50 + 10,
      temperature: Math.random() * 25 + 40,
      clockSpeed: 1900 + Math.random() * 100,
      coreCount: 6,
      activeThreads: Math.floor(Math.random() * 20 + 5)
    };
  }

  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const totalGB = 8.0;
    const usedGB = Math.random() * 4 + 2;
    return {
      totalGB,
      usedGB,
      availableGB: totalGB - usedGB,
      swapUsedGB: Math.random() * 0.5,
      buffersCacheGB: Math.random() * 1 + 0.5
    };
  }

  private async collectRenderingMetrics(): Promise<RenderingMetrics> {
    return {
      currentFPS: Math.random() * 30 + 45,
      gpuMemoryUsage: Math.random() * 1000 + 300,
      cpuUsage: Math.random() * 30 + 10,
      renderTime: Math.random() * 10 + 12,
      triangleCount: Math.floor(Math.random() * 10000 + 5000),
      textureMemory: Math.random() * 500 + 200,
      shaderCompileTime: Math.random() * 5 + 1,
      drawCalls: Math.floor(Math.random() * 50 + 20)
    };
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    return {
      uptime: Date.now() - (Math.random() * 86400000),
      loadAverage: [Math.random() * 2 + 0.5, Math.random() * 2 + 0.5, Math.random() * 2 + 0.5],
      diskUsage: {
        totalGB: 64,
        usedGB: Math.random() * 30 + 10,
        availableGB: 64 - (Math.random() * 30 + 10),
        readSpeed: Math.random() * 100 + 50,
        writeSpeed: Math.random() * 80 + 30
      },
      networkActivity: {
        bytesReceived: Math.floor(Math.random() * 1000000),
        bytesSent: Math.floor(Math.random() * 500000),
        packetsReceived: Math.floor(Math.random() * 10000),
        packetsSent: Math.floor(Math.random() * 5000)
      }
    };
  }

  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateWindowAverage(window: ResourceMetrics[]): ResourceMetrics {
    if (window.length === 0) throw new Error('Empty window for average calculation');
    
    return {
      timestamp: window[Math.floor(window.length / 2)].timestamp,
      gpu: {
        memoryUsageGB: this.average(window.map(m => m.gpu.memoryUsageGB)),
        utilizationPercent: this.average(window.map(m => m.gpu.utilizationPercent)),
        temperature: this.average(window.map(m => m.gpu.temperature)),
        powerUsage: this.average(window.map(m => m.gpu.powerUsage)),
        clockSpeed: this.average(window.map(m => m.gpu.clockSpeed))
      },
      cpu: {
        usagePercent: this.average(window.map(m => m.cpu.usagePercent)),
        temperature: this.average(window.map(m => m.cpu.temperature)),
        clockSpeed: this.average(window.map(m => m.cpu.clockSpeed)),
        coreCount: window[0].cpu.coreCount,
        activeThreads: this.average(window.map(m => m.cpu.activeThreads))
      },
      memory: {
        totalGB: window[0].memory.totalGB,
        usedGB: this.average(window.map(m => m.memory.usedGB)),
        availableGB: this.average(window.map(m => m.memory.availableGB)),
        swapUsedGB: this.average(window.map(m => m.memory.swapUsedGB)),
        buffersCacheGB: this.average(window.map(m => m.memory.buffersCacheGB))
      },
      rendering: {
        currentFPS: this.average(window.map(m => m.rendering.currentFPS)),
        gpuMemoryUsage: this.average(window.map(m => m.rendering.gpuMemoryUsage)),
        cpuUsage: this.average(window.map(m => m.rendering.cpuUsage)),
        renderTime: this.average(window.map(m => m.rendering.renderTime)),
        triangleCount: this.average(window.map(m => m.rendering.triangleCount)),
        textureMemory: this.average(window.map(m => m.rendering.textureMemory)),
        shaderCompileTime: this.average(window.map(m => m.rendering.shaderCompileTime)),
        drawCalls: this.average(window.map(m => m.rendering.drawCalls))
      },
      system: window[window.length - 1].system
    };
  }

  private shouldAlert(alertType: AlertType, currentTime: number): boolean {
    const lastAlert = this.alertCooldowns.get(alertType);
    return !lastAlert || (currentTime - lastAlert) >= this.COOLDOWN_DURATION;
  }

  private calculateGPUHealth(gpu: GPUMetrics): number {
    let score = 100;
    const memoryUsageRatio = gpu.memoryUsageGB / this.thresholds.maxGPUMemoryGB;
    if (memoryUsageRatio > 0.9) score -= 30;
    else if (memoryUsageRatio > 0.8) score -= 20;
    else if (memoryUsageRatio > 0.7) score -= 10;
    
    if (gpu.temperature > this.thresholds.maxGPUTemperature) score -= 25;
    else if (gpu.temperature > this.thresholds.maxGPUTemperature * 0.9) score -= 15;
    
    if (gpu.utilizationPercent > 95) score -= 5;
    return Math.max(0, score);
  }

  private calculateCPUHealth(cpu: CPUMetrics): number {
    let score = 100;
    if (cpu.usagePercent > this.thresholds.criticalCPUUsage) score -= 30;
    else if (cpu.usagePercent > this.thresholds.maxCPUUsage) score -= 20;
    else if (cpu.usagePercent > this.thresholds.maxCPUUsage * 0.8) score -= 10;
    
    if (cpu.temperature > this.thresholds.maxCPUTemperature) score -= 25;
    else if (cpu.temperature > this.thresholds.maxCPUTemperature * 0.9) score -= 15;
    
    return Math.max(0, score);
  }

  private calculateMemoryHealth(memory: MemoryMetrics): number {
    let score = 100;
    const memoryUsageRatio = memory.usedGB / memory.totalGB;
    if (memoryUsageRatio > 0.9) score -= 30;
    else if (memoryUsageRatio > 0.8) score -= 20;
    else if (memoryUsageRatio > 0.7) score -= 10;
    
    if (memory.swapUsedGB > 1.0) score -= 15; // Swap usage indicates memory pressure
    
    return Math.max(0, score);
  }

  private calculateRenderingHealth(rendering: RenderingMetrics): number {
    let score = 100;
    if (rendering.currentFPS < this.thresholds.criticalFPS) score -= 30;
    else if (rendering.currentFPS < this.thresholds.minFPS) score -= 20;
    else if (rendering.currentFPS < this.thresholds.minFPS * 1.2) score -= 10;
    
    if (rendering.renderTime > this.thresholds.maxRenderTime) score -= 20;
    
    if (rendering.gpuMemoryUsage > this.thresholds.maxGPUMemoryGB * 1024 * 0.9) score -= 15;
    
    return Math.max(0, score);
  }

  updateThresholds(newThresholds: Partial<ResourceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.emit('thresholdsUpdated', this.thresholds);
  }

  getThresholds(): ResourceThresholds {
    return { ...this.thresholds };
  }

  clearHistory(): void {
    this.metricsHistory = [];
    this.emit('historyCleared');
  }

  exportMetrics(timeRange?: { start: number; end: number }): ResourceMetrics[] {
    if (!timeRange) return [...this.metricsHistory];
    return this.metricsHistory.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }
}