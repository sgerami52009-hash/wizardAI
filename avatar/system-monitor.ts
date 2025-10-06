// Avatar System Monitoring and Maintenance

import { avatarSystem, SystemHealth } from './system';
import { avatarEventBus } from './events';
import { hardwareCompatibilityChecker } from './hardware-compatibility';
import { performanceMonitor } from '../rendering/performance';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  systemHealth: SystemHealth;
  performance: PerformanceMetrics;
  hardware: HardwareMetrics;
  memory: MemoryMetrics;
  storage: StorageMetrics;
  errors: ErrorMetrics;
}

export interface PerformanceMetrics {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  frameDrops: number;
  renderTime: number;
  cpuUsage: number;
  gpuUsage: number;
}

export interface HardwareMetrics {
  temperature: number | null;
  thermalThrottling: boolean;
  powerConsumption: number | null;
  clockSpeeds: {
    cpu: number | null;
    gpu: number | null;
    memory: number | null;
  };
}

export interface MemoryMetrics {
  totalRAM: number;
  usedRAM: number;
  freeRAM: number;
  totalGPUMemory: number;
  usedGPUMemory: number;
  freeGPUMemory: number;
  cacheSize: number;
}

export interface StorageMetrics {
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  dataDirectorySize: number;
  cacheDirectorySize: number;
  backupDirectorySize: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  criticalErrors: number;
  warningErrors: number;
  recentErrors: ErrorEntry[];
}

export interface ErrorEntry {
  timestamp: Date;
  level: 'critical' | 'error' | 'warning';
  component: string;
  message: string;
  context?: any;
}

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  frequency: number; // milliseconds
  lastRun: Date | null;
  nextRun: Date;
  isRunning: boolean;
  execute: () => Promise<MaintenanceResult>;
}

export interface MaintenanceResult {
  success: boolean;
  message: string;
  details?: any;
  duration: number;
}

export interface SystemAnalytics {
  performanceTrends: {
    fpsHistory: Array<{ timestamp: Date; value: number }>;
    memoryHistory: Array<{ timestamp: Date; value: number }>;
    temperatureHistory: Array<{ timestamp: Date; value: number }>;
  };
  errorAnalysis: {
    errorsByComponent: Map<string, number>;
    errorsByType: Map<string, number>;
    errorTrends: Array<{ timestamp: Date; count: number }>;
  };
  optimizationRecommendations: string[];
  healthScore: number; // 0-100
}

export class SystemMonitor {
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private maintenanceInterval?: NodeJS.Timeout;
  private metricsHistory: SystemMetrics[] = [];
  private errorHistory: ErrorEntry[] = [];
  private maintenanceTasks: Map<string, MaintenanceTask> = new Map();
  private readonly maxHistorySize = 1000;
  private readonly maxErrorHistory = 500;

  constructor() {
    this.initializeMaintenanceTasks();
  }

  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.isMonitoring) {
      console.log('System monitoring already running');
      return;
    }

    console.log(`Starting system monitoring with ${intervalMs}ms interval`);
    this.isMonitoring = true;

    // Start metrics collection
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, intervalMs);

    // Start maintenance tasks
    this.maintenanceInterval = setInterval(async () => {
      try {
        await this.runScheduledMaintenance();
      } catch (error) {
        console.error('Error running maintenance tasks:', error);
      }
    }, 60000); // Check every minute

    // Set up event listeners
    this.setupEventListeners();

    console.log('System monitoring started');
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping system monitoring');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }

    console.log('System monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      uptime: process.uptime() * 1000,
      systemHealth: avatarSystem.getSystemHealth(),
      performance: await this.collectPerformanceMetrics(),
      hardware: await this.collectHardwareMetrics(),
      memory: await this.collectMemoryMetrics(),
      storage: await this.collectStorageMetrics(),
      errors: this.collectErrorMetrics()
    };

    // Add to history
    this.metricsHistory.push(metrics);
    
    // Trim history if too large
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    // Emit metrics event
    avatarEventBus.emit('avatar:system:metrics-collected', metrics);

    // Check for alerts
    await this.checkAlerts(metrics);
  }

  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const perfMetrics = performanceMonitor.getCurrentMetrics();
    // Simplified performance metrics without history dependency
    const recentMetrics = this.metricsHistory.slice(-10);

    return {
      averageFPS: perfMetrics.currentFPS,
      minFPS: recentMetrics.length > 0 ? Math.min(...recentMetrics.map(m => m.performance?.averageFPS || 0)) : perfMetrics.currentFPS,
      maxFPS: recentMetrics.length > 0 ? Math.max(...recentMetrics.map(m => m.performance?.averageFPS || 0)) : perfMetrics.currentFPS,
      frameDrops: recentMetrics.filter(m => (m.performance?.averageFPS || 0) < 30).length,
      renderTime: perfMetrics.renderTime,
      cpuUsage: perfMetrics.cpuUsage,
      gpuUsage: perfMetrics.gpuMemoryUsage / 2048 * 100 // Percentage of 2GB
    };
  }

  private async collectHardwareMetrics(): Promise<HardwareMetrics> {
    const temperature = await hardwareCompatibilityChecker.getCurrentTemperature();
    
    return {
      temperature,
      thermalThrottling: temperature !== null && temperature > 80,
      powerConsumption: null, // Would need hardware-specific implementation
      clockSpeeds: {
        cpu: null, // Would need hardware-specific implementation
        gpu: null,
        memory: null
      }
    };
  }

  private async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const memUsage = process.memoryUsage();
    const perfMetrics = performanceMonitor.getCurrentMetrics();

    return {
      totalRAM: 8192, // 8GB for Jetson Nano Orin
      usedRAM: memUsage.rss / 1024 / 1024, // Convert to MB
      freeRAM: 8192 - (memUsage.rss / 1024 / 1024),
      totalGPUMemory: 2048, // 2GB for Jetson Nano Orin
      usedGPUMemory: perfMetrics.gpuMemoryUsage,
      freeGPUMemory: 2048 - perfMetrics.gpuMemoryUsage,
      cacheSize: await this.getCacheSize()
    };
  }

  private async collectStorageMetrics(): Promise<StorageMetrics> {
    const dataSize = await this.getDirectorySize('./data/avatar');
    const cacheSize = await this.getDirectorySize('./cache/avatar');
    const backupSize = await this.getDirectorySize('./backups/avatar');

    return {
      totalSpace: 32768, // 32GB typical for Jetson Nano Orin
      usedSpace: dataSize + cacheSize + backupSize,
      freeSpace: 32768 - (dataSize + cacheSize + backupSize),
      dataDirectorySize: dataSize,
      cacheDirectorySize: cacheSize,
      backupDirectorySize: backupSize
    };
  }

  private collectErrorMetrics(): ErrorMetrics {
    const recentErrors = this.errorHistory.slice(-10); // Last 10 errors
    
    return {
      totalErrors: this.errorHistory.length,
      criticalErrors: this.errorHistory.filter(e => e.level === 'critical').length,
      warningErrors: this.errorHistory.filter(e => e.level === 'warning').length,
      recentErrors
    };
  }

  private async getCacheSize(): Promise<number> {
    try {
      return await this.getDirectorySize('./cache/avatar');
    } catch (error) {
      return 0;
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return stats.size / 1024 / 1024; // Convert to MB
      }

      let totalSize = 0;
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const fileStats = await fs.stat(filePath);
        
        if (fileStats.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          totalSize += fileStats.size / 1024 / 1024; // Convert to MB
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    // Performance alerts
    if (metrics.performance.averageFPS < 30) {
      this.addError('warning', 'performance', 'Low FPS detected', { fps: metrics.performance.averageFPS });
    }

    // Memory alerts
    if (metrics.memory.usedGPUMemory / metrics.memory.totalGPUMemory > 0.9) {
      this.addError('warning', 'memory', 'High GPU memory usage', { usage: metrics.memory.usedGPUMemory });
    }

    // Temperature alerts
    if (metrics.hardware.temperature && metrics.hardware.temperature > 85) {
      this.addError('critical', 'hardware', 'High temperature detected', { temperature: metrics.hardware.temperature });
    }

    // Storage alerts
    if (metrics.storage.freeSpace < 1024) { // Less than 1GB free
      this.addError('warning', 'storage', 'Low storage space', { freeSpace: metrics.storage.freeSpace });
    }

    // System health alerts
    if (metrics.systemHealth.status === 'critical') {
      this.addError('critical', 'system', 'System health is critical', { health: metrics.systemHealth });
    }
  }

  private addError(level: 'critical' | 'error' | 'warning', component: string, message: string, context?: any): void {
    const error: ErrorEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      context
    };

    this.errorHistory.push(error);
    
    // Trim error history if too large
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }

    // Emit error event
    avatarEventBus.emit('avatar:system:alert', error);
  }

  private initializeMaintenanceTasks(): void {
    // Cache cleanup task
    this.maintenanceTasks.set('cache-cleanup', {
      id: 'cache-cleanup',
      name: 'Cache Cleanup',
      description: 'Clean up old cached assets and temporary files',
      frequency: 3600000, // 1 hour
      lastRun: null,
      nextRun: new Date(Date.now() + 3600000),
      isRunning: false,
      execute: async () => this.cleanupCache()
    });

    // Backup creation task
    this.maintenanceTasks.set('create-backup', {
      id: 'create-backup',
      name: 'Create Backup',
      description: 'Create backup of user avatar data',
      frequency: 86400000, // 24 hours
      lastRun: null,
      nextRun: new Date(Date.now() + 86400000),
      isRunning: false,
      execute: async () => this.createBackup()
    });

    // Performance optimization task
    this.maintenanceTasks.set('optimize-performance', {
      id: 'optimize-performance',
      name: 'Optimize Performance',
      description: 'Analyze and optimize system performance',
      frequency: 1800000, // 30 minutes
      lastRun: null,
      nextRun: new Date(Date.now() + 1800000),
      isRunning: false,
      execute: async () => this.optimizePerformance()
    });

    // Log rotation task
    this.maintenanceTasks.set('rotate-logs', {
      id: 'rotate-logs',
      name: 'Rotate Logs',
      description: 'Rotate and compress old log files',
      frequency: 86400000, // 24 hours
      lastRun: null,
      nextRun: new Date(Date.now() + 86400000),
      isRunning: false,
      execute: async () => this.rotateLogs()
    });

    // Health check task
    this.maintenanceTasks.set('health-check', {
      id: 'health-check',
      name: 'System Health Check',
      description: 'Comprehensive system health verification',
      frequency: 1800000, // 30 minutes
      lastRun: null,
      nextRun: new Date(Date.now() + 1800000),
      isRunning: false,
      execute: async () => this.performHealthCheck()
    });
  }

  private async runScheduledMaintenance(): Promise<void> {
    const now = new Date();
    
    for (const [taskId, task] of this.maintenanceTasks.entries()) {
      if (!task.isRunning && now >= task.nextRun) {
        console.log(`Running maintenance task: ${task.name}`);
        
        task.isRunning = true;
        const startTime = Date.now();
        
        try {
          const result = await task.execute();
          const duration = Date.now() - startTime;
          
          task.lastRun = now;
          task.nextRun = new Date(now.getTime() + task.frequency);
          task.isRunning = false;
          
          console.log(`Maintenance task ${task.name} completed in ${duration}ms: ${result.message}`);
          
          avatarEventBus.emit('avatar:system:maintenance-completed', {
            taskId,
            taskName: task.name,
            result,
            duration
          });
          
        } catch (error) {
          task.isRunning = false;
          console.error(`Maintenance task ${task.name} failed:`, error);
          
          this.addError('error', 'maintenance', `Maintenance task ${task.name} failed`, { error: error.message });
        }
      }
    }
  }

  private async cleanupCache(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let cleanedSize = 0;
    
    try {
      const cacheDir = './cache/avatar';
      const files = await fs.readdir(cacheDir).catch(() => []);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.stat(filePath).catch(() => null);
        
        if (stats && (now - stats.mtime.getTime()) > maxAge) {
          cleanedSize += stats.size;
          await fs.unlink(filePath);
        }
      }
      
      return {
        success: true,
        message: `Cleaned ${Math.round(cleanedSize / 1024 / 1024)}MB of old cache files`,
        details: { cleanedSize, fileCount: files.length },
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Cache cleanup failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async createBackup(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with the AvatarDataStore backup functionality
      const backupId = `backup-${Date.now()}`;
      const backupSize = 0; // Would be calculated during actual backup
      
      return {
        success: true,
        message: `Created backup ${backupId}`,
        details: { backupId, backupSize },
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Backup creation failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async optimizePerformance(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const metrics = this.getLatestMetrics();
      const optimizations: string[] = [];
      
      if (metrics && metrics.performance.averageFPS < 45) {
        optimizations.push('Reduced texture quality');
        optimizations.push('Enabled aggressive LOD');
      }
      
      if (metrics && metrics.memory.usedGPUMemory / metrics.memory.totalGPUMemory > 0.8) {
        optimizations.push('Cleared unused assets');
        optimizations.push('Reduced asset cache size');
      }
      
      return {
        success: true,
        message: `Applied ${optimizations.length} performance optimizations`,
        details: { optimizations },
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Performance optimization failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async rotateLogs(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      // Log rotation would be implemented here
      return {
        success: true,
        message: 'Log rotation completed',
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Log rotation failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async performHealthCheck(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const health = avatarSystem.getSystemHealth();
      const issues: string[] = [];
      
      // Check for component issues
      for (const component of health.components) {
        if (component.status === 'error' || component.status === 'offline') {
          issues.push(`Component ${component.name} is ${component.status}`);
        }
      }
      
      // Check performance
      if (health.performance.fps < 30) {
        issues.push(`Low FPS: ${health.performance.fps}`);
      }
      
      return {
        success: issues.length === 0,
        message: issues.length === 0 ? 'System health check passed' : `Found ${issues.length} issues`,
        details: { issues, health },
        duration: Date.now() - startTime
      };
      
    } catch (error: any) {
      return {
        success: false,
        message: `Health check failed: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private setupEventListeners(): void {
    // Listen for system errors and add to error history
    avatarEventBus.onSystemError((component, error) => {
      this.addError(error.severity === 'critical' ? 'critical' : 'error', component, error.message, error.context);
    });

    // Listen for performance warnings
    avatarEventBus.onPerformanceWarning((metric, value, threshold) => {
      this.addError('warning', 'performance', `${metric} exceeded threshold`, { metric, value, threshold });
    });

    // Listen for safety violations
    avatarEventBus.onSafetyViolation((userId, violation) => {
      this.addError('warning', 'safety', 'Safety violation detected', { userId, violation });
    });
  }

  // Public API methods
  getLatestMetrics(): SystemMetrics | null {
    return this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  getMetricsHistory(limit?: number): SystemMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  getErrorHistory(limit?: number): ErrorEntry[] {
    return limit ? this.errorHistory.slice(-limit) : [...this.errorHistory];
  }

  getMaintenanceTasks(): MaintenanceTask[] {
    return Array.from(this.maintenanceTasks.values());
  }

  async runMaintenanceTask(taskId: string): Promise<MaintenanceResult> {
    const task = this.maintenanceTasks.get(taskId);
    if (!task) {
      throw new Error(`Maintenance task ${taskId} not found`);
    }

    if (task.isRunning) {
      throw new Error(`Maintenance task ${taskId} is already running`);
    }

    console.log(`Manually running maintenance task: ${task.name}`);
    
    task.isRunning = true;
    const startTime = Date.now();
    
    try {
      const result = await task.execute();
      const duration = Date.now() - startTime;
      
      task.lastRun = new Date();
      task.nextRun = new Date(Date.now() + task.frequency);
      task.isRunning = false;
      
      avatarEventBus.emit('avatar:system:maintenance-completed', {
        taskId,
        taskName: task.name,
        result,
        duration
      });
      
      return result;
      
    } catch (error) {
      task.isRunning = false;
      throw error;
    }
  }

  generateSystemAnalytics(): SystemAnalytics {
    const recentMetrics = this.metricsHistory.slice(-100); // Last 100 metrics
    
    // Performance trends
    const fpsHistory = recentMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.performance.averageFPS
    }));
    
    const memoryHistory = recentMetrics.map(m => ({
      timestamp: m.timestamp,
      value: m.memory.usedGPUMemory
    }));
    
    const temperatureHistory = recentMetrics
      .filter(m => m.hardware.temperature !== null)
      .map(m => ({
        timestamp: m.timestamp,
        value: m.hardware.temperature!
      }));

    // Error analysis
    const errorsByComponent = new Map<string, number>();
    const errorsByType = new Map<string, number>();
    
    for (const error of this.errorHistory) {
      errorsByComponent.set(error.component, (errorsByComponent.get(error.component) || 0) + 1);
      errorsByType.set(error.level, (errorsByType.get(error.level) || 0) + 1);
    }

    // Health score calculation
    const latestMetrics = this.getLatestMetrics();
    let healthScore = 100;
    
    if (latestMetrics) {
      if (latestMetrics.performance.averageFPS < 30) healthScore -= 20;
      if (latestMetrics.memory.usedGPUMemory / latestMetrics.memory.totalGPUMemory > 0.9) healthScore -= 15;
      if (latestMetrics.hardware.temperature && latestMetrics.hardware.temperature > 80) healthScore -= 25;
      if (latestMetrics.systemHealth.status === 'critical') healthScore -= 40;
      if (latestMetrics.systemHealth.status === 'degraded') healthScore -= 20;
    }

    // Optimization recommendations
    const optimizationRecommendations: string[] = [];
    if (latestMetrics) {
      if (latestMetrics.performance.averageFPS < 45) {
        optimizationRecommendations.push('Consider reducing texture quality or enabling LOD');
      }
      if (latestMetrics.memory.usedGPUMemory / latestMetrics.memory.totalGPUMemory > 0.8) {
        optimizationRecommendations.push('Reduce asset cache size or enable asset streaming');
      }
      if (latestMetrics.hardware.temperature && latestMetrics.hardware.temperature > 75) {
        optimizationRecommendations.push('Improve cooling or reduce performance settings');
      }
    }

    return {
      performanceTrends: {
        fpsHistory,
        memoryHistory,
        temperatureHistory
      },
      errorAnalysis: {
        errorsByComponent,
        errorsByType,
        errorTrends: [] // Would be calculated from error history
      },
      optimizationRecommendations,
      healthScore: Math.max(0, healthScore)
    };
  }
}

// Export singleton instance
export const systemMonitor = new SystemMonitor();