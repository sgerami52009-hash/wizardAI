/**
 * Automatic maintenance tasks and optimization
 * Handles scheduled maintenance, cleanup, and system optimization
 */

import { SystemMetrics, UserPreferences, RecommendationHistory } from '../types';
import { HealthMonitor, HealthStatus } from './health-monitor';

export interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  schedule: MaintenanceSchedule;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // minutes
  lastRun?: Date;
  nextRun: Date;
  enabled: boolean;
  taskFunction: () => Promise<MaintenanceResult>;
}

export interface MaintenanceSchedule {
  type: 'interval' | 'cron' | 'condition';
  value: string | number; // interval in ms, cron expression, or condition
  timezone?: string;
}

export interface MaintenanceResult {
  success: boolean;
  duration: number; // milliseconds
  itemsProcessed: number;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
  nextRecommendedRun?: Date;
}

export interface MaintenanceConfig {
  enabled: boolean;
  maxConcurrentTasks: number;
  maintenanceWindow: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
  resourceLimits: {
    maxCpuUsage: number; // percentage
    maxMemoryUsage: number; // percentage
  };
  notifications: {
    enabled: boolean;
    channels: ('console' | 'log' | 'callback')[];
    notifyOnStart: boolean;
    notifyOnComplete: boolean;
    notifyOnError: boolean;
  };
}

export interface MaintenanceReport {
  period: { start: Date; end: Date };
  tasksExecuted: number;
  totalDuration: number; // minutes
  successRate: number; // percentage
  itemsProcessed: number;
  errors: string[];
  recommendations: string[];
  nextScheduledTasks: { task: string; scheduledTime: Date }[];
}

/**
 * Maintenance manager for automated system maintenance
 */
export class MaintenanceManager {
  private config: MaintenanceConfig;
  private tasks: Map<string, MaintenanceTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private maintenanceInterval?: NodeJS.Timeout;
  private healthMonitor?: HealthMonitor;
  private maintenanceHistory: MaintenanceResult[] = [];
  private notificationCallbacks: Map<string, (event: MaintenanceEvent) => void> = new Map();

  constructor(config?: Partial<MaintenanceConfig>, healthMonitor?: HealthMonitor) {
    this.config = this.mergeWithDefaults(config || {});
    this.healthMonitor = healthMonitor;
    this.initializeDefaultTasks();
  }

  /**
   * Start maintenance manager
   */
  start(): void {
    if (this.maintenanceInterval) {
      console.warn('Maintenance manager is already running');
      return;
    }

    console.log('Starting maintenance manager...');
    this.maintenanceInterval = setInterval(
      () => this.checkAndRunTasks(),
      60000 // Check every minute
    );

    // Run initial check
    this.checkAndRunTasks();
  }

  /**
   * Stop maintenance manager
   */
  stop(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
      console.log('Maintenance manager stopped');
    }
  }

  /**
   * Add maintenance task
   */
  addTask(task: Omit<MaintenanceTask, 'id' | 'nextRun'>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const maintenanceTask: MaintenanceTask = {
      ...task,
      id,
      nextRun: this.calculateNextRun(task.schedule)
    };

    this.tasks.set(id, maintenanceTask);
    console.log(`Added maintenance task: ${task.name} (${id})`);
    return id;
  }

  /**
   * Remove maintenance task
   */
  removeTask(taskId: string): boolean {
    if (this.runningTasks.has(taskId)) {
      console.warn(`Cannot remove running task: ${taskId}`);
      return false;
    }

    const removed = this.tasks.delete(taskId);
    if (removed) {
      console.log(`Removed maintenance task: ${taskId}`);
    }
    return removed;
  }

  /**
   * Enable/disable task
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.enabled = enabled;
    console.log(`Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Get all tasks
   */
  getTasks(): MaintenanceTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): {
    task: MaintenanceTask | null;
    isRunning: boolean;
    lastResult?: MaintenanceResult;
  } {
    const task = this.tasks.get(taskId) || null;
    const isRunning = this.runningTasks.has(taskId);
    const lastResult = this.maintenanceHistory
      .filter(r => r.metrics.taskId === taskId)
      .pop();

    return { task, isRunning, lastResult };
  }

  /**
   * Run task manually
   */
  async runTask(taskId: string, force: boolean = false): Promise<MaintenanceResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!force && this.runningTasks.has(taskId)) {
      throw new Error(`Task already running: ${taskId}`);
    }

    if (!force && !this.canRunTask(task)) {
      throw new Error(`Task cannot run due to system constraints: ${taskId}`);
    }

    return await this.executeTask(task);
  }

  /**
   * Get maintenance report
   */
  getMaintenanceReport(hours: number = 24): MaintenanceReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);
    
    const periodResults = this.maintenanceHistory.filter(
      r => r.metrics.startTime >= startTime.getTime() && r.metrics.startTime <= endTime.getTime()
    );

    const successfulTasks = periodResults.filter(r => r.success);
    const totalDuration = periodResults.reduce((sum, r) => sum + r.duration, 0);
    const totalItemsProcessed = periodResults.reduce((sum, r) => sum + r.itemsProcessed, 0);
    const allErrors = periodResults.flatMap(r => r.errors);

    return {
      period: { start: startTime, end: endTime },
      tasksExecuted: periodResults.length,
      totalDuration: totalDuration / (1000 * 60), // Convert to minutes
      successRate: periodResults.length > 0 ? (successfulTasks.length / periodResults.length) * 100 : 0,
      itemsProcessed: totalItemsProcessed,
      errors: allErrors,
      recommendations: this.generateMaintenanceRecommendations(periodResults),
      nextScheduledTasks: this.getNextScheduledTasks(10)
    };
  }

  /**
   * Register notification callback
   */
  onMaintenanceEvent(key: string, callback: (event: MaintenanceEvent) => void): void {
    this.notificationCallbacks.set(key, callback);
  }

  /**
   * Unregister notification callback
   */
  offMaintenanceEvent(key: string): void {
    this.notificationCallbacks.delete(key);
  }

  /**
   * Check and run scheduled tasks
   */
  private async checkAndRunTasks(): Promise<void> {
    const now = new Date();
    
    // Check if we're in maintenance window
    if (!this.isInMaintenanceWindow(now)) {
      return;
    }

    // Get tasks that need to run
    const tasksToRun = Array.from(this.tasks.values())
      .filter(task => 
        task.enabled && 
        task.nextRun <= now && 
        !this.runningTasks.has(task.id) &&
        this.canRunTask(task)
      )
      .sort((a, b) => {
        // Sort by priority, then by how overdue they are
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return a.nextRun.getTime() - b.nextRun.getTime();
      });

    // Run tasks up to concurrent limit
    const availableSlots = this.config.maxConcurrentTasks - this.runningTasks.size;
    const tasksToExecute = tasksToRun.slice(0, availableSlots);

    for (const task of tasksToExecute) {
      this.executeTask(task).catch(error => {
        console.error(`Error executing task ${task.id}:`, error);
      });
    }
  }

  /**
   * Execute maintenance task
   */
  private async executeTask(task: MaintenanceTask): Promise<MaintenanceResult> {
    const startTime = Date.now();
    this.runningTasks.add(task.id);
    
    this.notifyMaintenanceEvent({
      type: 'task_started',
      taskId: task.id,
      taskName: task.name,
      timestamp: new Date()
    });

    try {
      console.log(`Starting maintenance task: ${task.name} (${task.id})`);
      
      const result = await task.taskFunction();
      result.metrics = {
        ...result.metrics,
        taskId: task.id,
        startTime,
        endTime: Date.now()
      };

      // Update task schedule
      task.lastRun = new Date();
      task.nextRun = this.calculateNextRun(task.schedule, task.lastRun);

      // Store result
      this.maintenanceHistory.push(result);
      
      // Trim history (keep last 1000 results)
      if (this.maintenanceHistory.length > 1000) {
        this.maintenanceHistory = this.maintenanceHistory.slice(-1000);
      }

      this.notifyMaintenanceEvent({
        type: 'task_completed',
        taskId: task.id,
        taskName: task.name,
        timestamp: new Date(),
        success: result.success,
        duration: result.duration,
        errors: result.errors
      });

      console.log(`Completed maintenance task: ${task.name} (${result.success ? 'SUCCESS' : 'FAILED'})`);
      return result;

    } catch (error) {
      const result: MaintenanceResult = {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed: 0,
        errors: [error.message],
        warnings: [],
        metrics: {
          taskId: task.id,
          startTime,
          endTime: Date.now()
        }
      };

      this.maintenanceHistory.push(result);

      this.notifyMaintenanceEvent({
        type: 'task_failed',
        taskId: task.id,
        taskName: task.name,
        timestamp: new Date(),
        error: error.message
      });

      console.error(`Failed maintenance task: ${task.name}:`, error);
      return result;

    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Check if task can run based on system constraints
   */
  private canRunTask(task: MaintenanceTask): boolean {
    // Check if health monitor indicates system stress
    if (this.healthMonitor) {
      const health = this.healthMonitor.getHealthStatus();
      if (health.overall === 'critical' && task.priority !== 'critical') {
        return false;
      }
    }

    // Check resource limits (simplified)
    // In a real implementation, this would check actual system resources
    return true;
  }

  /**
   * Check if current time is in maintenance window
   */
  private isInMaintenanceWindow(time: Date): boolean {
    const timeStr = time.toTimeString().substr(0, 5); // HH:MM format
    return timeStr >= this.config.maintenanceWindow.start && 
           timeStr <= this.config.maintenanceWindow.end;
  }

  /**
   * Calculate next run time for task
   */
  private calculateNextRun(schedule: MaintenanceSchedule, from?: Date): Date {
    const baseTime = from || new Date();
    
    switch (schedule.type) {
      case 'interval':
        return new Date(baseTime.getTime() + (schedule.value as number));
      
      case 'cron':
        // Simplified cron parsing - in a real implementation, use a cron library
        return new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // Daily default
      
      case 'condition':
        // Condition-based scheduling - return next check time
        return new Date(baseTime.getTime() + 60 * 60 * 1000); // Check hourly
      
      default:
        return new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // Daily default
    }
  }

  /**
   * Initialize default maintenance tasks
   */
  private initializeDefaultTasks(): void {
    // Memory cleanup task
    this.addTask({
      name: 'Memory Cleanup',
      description: 'Clean up unused memory and optimize garbage collection',
      schedule: { type: 'interval', value: 2 * 60 * 60 * 1000 }, // Every 2 hours
      priority: 'medium',
      estimatedDuration: 5,
      enabled: true,
      taskFunction: async () => this.performMemoryCleanup()
    });

    // Cache optimization task
    this.addTask({
      name: 'Cache Optimization',
      description: 'Optimize recommendation caches and remove stale entries',
      schedule: { type: 'interval', value: 4 * 60 * 60 * 1000 }, // Every 4 hours
      priority: 'medium',
      estimatedDuration: 10,
      enabled: true,
      taskFunction: async () => this.performCacheOptimization()
    });

    // Data cleanup task
    this.addTask({
      name: 'Data Cleanup',
      description: 'Clean up old logs, expired data, and temporary files',
      schedule: { type: 'interval', value: 24 * 60 * 60 * 1000 }, // Daily
      priority: 'low',
      estimatedDuration: 15,
      enabled: true,
      taskFunction: async () => this.performDataCleanup()
    });

    // Model optimization task
    this.addTask({
      name: 'Model Optimization',
      description: 'Optimize recommendation models and update parameters',
      schedule: { type: 'interval', value: 7 * 24 * 60 * 60 * 1000 }, // Weekly
      priority: 'high',
      estimatedDuration: 30,
      enabled: true,
      taskFunction: async () => this.performModelOptimization()
    });

    // Health check task
    this.addTask({
      name: 'System Health Check',
      description: 'Comprehensive system health and performance check',
      schedule: { type: 'interval', value: 60 * 60 * 1000 }, // Hourly
      priority: 'high',
      estimatedDuration: 5,
      enabled: true,
      taskFunction: async () => this.performHealthCheck()
    });
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        itemsProcessed++;
      } else {
        warnings.push('Garbage collection not available');
      }

      // Clear internal caches (simplified)
      itemsProcessed += 5; // Simulated cache clearing

      return {
        success: true,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {
          memoryFreed: 50 * 1024 * 1024, // 50MB simulated
          cacheEntriesCleared: itemsProcessed
        }
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {}
      };
    }
  }

  /**
   * Perform cache optimization
   */
  private async performCacheOptimization(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Simulate cache optimization
      itemsProcessed = 25; // Simulated cache entries optimized

      return {
        success: true,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {
          cacheHitRateImprovement: 5, // 5% improvement
          staleEntriesRemoved: itemsProcessed
        }
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {}
      };
    }
  }

  /**
   * Perform data cleanup
   */
  private async performDataCleanup(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Simulate data cleanup
      itemsProcessed = 100; // Simulated files/records cleaned

      return {
        success: true,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {
          diskSpaceFreed: 100 * 1024 * 1024, // 100MB simulated
          oldRecordsRemoved: itemsProcessed
        }
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {}
      };
    }
  }

  /**
   * Perform model optimization
   */
  private async performModelOptimization(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Simulate model optimization
      itemsProcessed = 5; // Number of models optimized

      return {
        success: true,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {
          accuracyImprovement: 2, // 2% improvement
          modelSizeReduction: 10, // 10% size reduction
          modelsOptimized: itemsProcessed
        }
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {}
      };
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (this.healthMonitor) {
        const health = await this.healthMonitor.checkHealth();
        itemsProcessed = health.components.length;
        
        // Add warnings for unhealthy components
        health.components.forEach(component => {
          if (component.status === 'warning' || component.status === 'critical') {
            warnings.push(`${component.name}: ${component.issues.join(', ')}`);
          }
        });
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {
          componentsChecked: itemsProcessed,
          healthyComponents: itemsProcessed - warnings.length
        }
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        duration: Date.now() - startTime,
        itemsProcessed,
        errors,
        warnings,
        metrics: {}
      };
    }
  }

  /**
   * Generate maintenance recommendations
   */
  private generateMaintenanceRecommendations(results: MaintenanceResult[]): string[] {
    const recommendations: string[] = [];
    
    const failureRate = results.length > 0 ? 
      (results.filter(r => !r.success).length / results.length) * 100 : 0;
    
    if (failureRate > 20) {
      recommendations.push('High maintenance task failure rate detected - review system health');
    }
    
    const avgDuration = results.length > 0 ?
      results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0;
    
    if (avgDuration > 10 * 60 * 1000) { // 10 minutes
      recommendations.push('Maintenance tasks taking longer than expected - consider optimization');
    }
    
    return recommendations;
  }

  /**
   * Get next scheduled tasks
   */
  private getNextScheduledTasks(limit: number): { task: string; scheduledTime: Date }[] {
    return Array.from(this.tasks.values())
      .filter(task => task.enabled)
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, limit)
      .map(task => ({
        task: task.name,
        scheduledTime: task.nextRun
      }));
  }

  /**
   * Notify maintenance event
   */
  private notifyMaintenanceEvent(event: MaintenanceEvent): void {
    for (const callback of this.notificationCallbacks.values()) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error notifying maintenance event callback:', error);
      }
    }
  }

  /**
   * Merge config with defaults
   */
  private mergeWithDefaults(config: Partial<MaintenanceConfig>): MaintenanceConfig {
    return {
      enabled: config.enabled !== false,
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      maintenanceWindow: {
        start: '02:00',
        end: '06:00',
        timezone: 'UTC',
        ...config.maintenanceWindow
      },
      resourceLimits: {
        maxCpuUsage: 70,
        maxMemoryUsage: 80,
        ...config.resourceLimits
      },
      notifications: {
        enabled: true,
        channels: ['console', 'log'],
        notifyOnStart: false,
        notifyOnComplete: true,
        notifyOnError: true,
        ...config.notifications
      }
    };
  }
}

// Maintenance event types
export interface MaintenanceEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'maintenance_window_started' | 'maintenance_window_ended';
  taskId?: string;
  taskName?: string;
  timestamp: Date;
  success?: boolean;
  duration?: number;
  errors?: string[];
  error?: string;
}