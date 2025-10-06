/**
 * Background processing optimization system
 * Manages sync operations, reminder processing, and resource-aware task scheduling
 * Optimized for Jetson Nano Orin hardware constraints
 */

import { EventEmitter } from 'events';

export interface BackgroundTask {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  payload: any;
  createdAt: Date;
  scheduledAt?: Date;
  maxRetries: number;
  retryCount: number;
  timeout: number;
  resourceRequirements: ResourceRequirements;
}

export enum TaskType {
  CALENDAR_SYNC = 'calendar_sync',
  REMINDER_PROCESSING = 'reminder_processing',
  INDEX_OPTIMIZATION = 'index_optimization',
  DATA_CLEANUP = 'data_cleanup',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  FAMILY_COORDINATION = 'family_coordination'
}

export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface ResourceRequirements {
  memoryMB: number;
  cpuIntensive: boolean;
  networkRequired: boolean;
  diskIO: boolean;
  estimatedDurationMs: number;
}

export interface ProcessingStats {
  tasksProcessed: number;
  tasksQueued: number;
  tasksFailed: number;
  averageProcessingTime: number;
  resourceUtilization: number;
  lastOptimization: Date;
}

export interface ProcessorConfig {
  maxConcurrentTasks: number;
  maxQueueSize: number;
  processingIntervalMs: number;
  resourceThresholds: ResourceThresholds;
  gracefulDegradationEnabled: boolean;
}

export interface ResourceThresholds {
  maxMemoryUsageMB: number;
  maxCpuUsage: number;
  maxNetworkConnections: number;
  maxDiskIORate: number;
}

export class BackgroundProcessor extends EventEmitter {
  private taskQueue: BackgroundTask[] = [];
  private activeTasks: Map<string, BackgroundTask> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private stats: ProcessingStats;
  private config: ProcessorConfig;
  private isProcessing = false;
  private resourceMonitor: ResourceMonitor;

  constructor(config?: Partial<ProcessorConfig>) {
    super();
    
    this.config = {
      maxConcurrentTasks: 3, // Conservative for Jetson Nano Orin
      maxQueueSize: 100,
      processingIntervalMs: 1000,
      resourceThresholds: {
        maxMemoryUsageMB: 512, // Half of 1GB limit
        maxCpuUsage: 70,
        maxNetworkConnections: 5,
        maxDiskIORate: 10 // MB/s
      },
      gracefulDegradationEnabled: true,
      ...config
    };

    this.stats = {
      tasksProcessed: 0,
      tasksQueued: 0,
      tasksFailed: 0,
      averageProcessingTime: 0,
      resourceUtilization: 0,
      lastOptimization: new Date()
    };

    this.resourceMonitor = new ResourceMonitor();
  }

  /**
   * Start background processing
   */
  public start(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.processingIntervalMs);

    this.emit('processor_started');
  }

  /**
   * Stop background processing
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.isProcessing = false;
      
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      // Wait for active tasks to complete or timeout
      const checkActiveTasks = () => {
        if (this.activeTasks.size === 0) {
          this.emit('processor_stopped');
          resolve();
        } else {
          setTimeout(checkActiveTasks, 100);
        }
      };

      checkActiveTasks();
    });
  }

  /**
   * Add task to processing queue
   */
  public addTask(task: Omit<BackgroundTask, 'id' | 'createdAt' | 'retryCount'>): string {
    if (this.taskQueue.length >= this.config.maxQueueSize) {
      // Remove lowest priority tasks if queue is full
      this.evictLowPriorityTasks();
    }

    const backgroundTask: BackgroundTask = {
      id: this.generateTaskId(),
      createdAt: new Date(),
      retryCount: 0,
      ...task
    };

    // Insert task in priority order
    this.insertTaskByPriority(backgroundTask);
    this.stats.tasksQueued++;

    this.emit('task_queued', backgroundTask);
    return backgroundTask.id;
  }

  /**
   * Cancel a queued task
   */
  public cancelTask(taskId: string): boolean {
    const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue.splice(queueIndex, 1)[0];
      this.emit('task_cancelled', task);
      return true;
    }

    // Check if task is currently active
    if (this.activeTasks.has(taskId)) {
      // Mark for cancellation (actual cancellation depends on task implementation)
      this.emit('task_cancellation_requested', taskId);
      return true;
    }

    return false;
  }

  /**
   * Get current processing statistics
   */
  public getStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Get current queue status
   */
  public getQueueStatus(): { queued: number; active: number; capacity: number } {
    return {
      queued: this.taskQueue.length,
      active: this.activeTasks.size,
      capacity: this.config.maxQueueSize
    };
  }

  /**
   * Optimize processing based on current system state
   */
  public optimize(): void {
    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    
    // Adjust concurrent task limit based on resource usage
    if (resourceUsage.memoryUsageMB > this.config.resourceThresholds.maxMemoryUsageMB) {
      this.config.maxConcurrentTasks = Math.max(1, this.config.maxConcurrentTasks - 1);
      this.emit('optimization_applied', 'reduced_concurrency_memory');
    } else if (resourceUsage.cpuUsage > this.config.resourceThresholds.maxCpuUsage) {
      this.config.maxConcurrentTasks = Math.max(1, this.config.maxConcurrentTasks - 1);
      this.emit('optimization_applied', 'reduced_concurrency_cpu');
    } else if (resourceUsage.memoryUsageMB < this.config.resourceThresholds.maxMemoryUsageMB * 0.5) {
      this.config.maxConcurrentTasks = Math.min(5, this.config.maxConcurrentTasks + 1);
      this.emit('optimization_applied', 'increased_concurrency');
    }

    // Defer low-priority tasks if resources are constrained
    if (this.shouldDeferLowPriorityTasks(resourceUsage)) {
      this.deferLowPriorityTasks();
    }

    this.stats.lastOptimization = new Date();
  }

  private processQueue(): void {
    if (!this.isProcessing) {
      return;
    }

    // Check resource availability
    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    if (!this.canProcessMoreTasks(resourceUsage)) {
      return;
    }

    // Process tasks up to concurrent limit
    while (
      this.activeTasks.size < this.config.maxConcurrentTasks &&
      this.taskQueue.length > 0
    ) {
      const task = this.taskQueue.shift()!;
      
      // Check if task can be processed with current resources
      if (this.canProcessTask(task, resourceUsage)) {
        this.processTask(task);
      } else {
        // Put task back at front of queue
        this.taskQueue.unshift(task);
        break;
      }
    }

    // Update resource utilization stats
    this.stats.resourceUtilization = this.calculateResourceUtilization(resourceUsage);
  }

  private async processTask(task: BackgroundTask): Promise<void> {
    const startTime = performance.now();
    this.activeTasks.set(task.id, task);

    try {
      this.emit('task_started', task);
      
      // Process task based on type
      await this.executeTask(task);
      
      // Task completed successfully
      this.activeTasks.delete(task.id);
      this.stats.tasksProcessed++;
      
      const duration = performance.now() - startTime;
      this.updateProcessingStats(duration);
      
      this.emit('task_completed', task, duration);

    } catch (error) {
      this.activeTasks.delete(task.id);
      
      // Handle task failure
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        task.scheduledAt = new Date(Date.now() + this.calculateRetryDelay(task.retryCount));
        this.insertTaskByPriority(task);
        this.emit('task_retry_scheduled', task, error);
      } else {
        this.stats.tasksFailed++;
        this.emit('task_failed', task, error);
      }
    }
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${task.timeout}ms`));
      }, task.timeout);

      try {
        switch (task.type) {
          case TaskType.CALENDAR_SYNC:
            this.executeCalendarSync(task).then(resolve).catch(reject);
            break;
          case TaskType.REMINDER_PROCESSING:
            this.executeReminderProcessing(task).then(resolve).catch(reject);
            break;
          case TaskType.INDEX_OPTIMIZATION:
            this.executeIndexOptimization(task).then(resolve).catch(reject);
            break;
          case TaskType.DATA_CLEANUP:
            this.executeDataCleanup(task).then(resolve).catch(reject);
            break;
          case TaskType.PERFORMANCE_MONITORING:
            this.executePerformanceMonitoring(task).then(resolve).catch(reject);
            break;
          case TaskType.FAMILY_COORDINATION:
            this.executeFamilyCoordination(task).then(resolve).catch(reject);
            break;
          default:
            reject(new Error(`Unknown task type: ${task.type}`));
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private async executeCalendarSync(task: BackgroundTask): Promise<void> {
    // Placeholder for calendar sync implementation
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async executeReminderProcessing(task: BackgroundTask): Promise<void> {
    // Placeholder for reminder processing implementation
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async executeIndexOptimization(task: BackgroundTask): Promise<void> {
    // Placeholder for index optimization implementation
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async executeDataCleanup(task: BackgroundTask): Promise<void> {
    // Placeholder for data cleanup implementation
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  private async executePerformanceMonitoring(task: BackgroundTask): Promise<void> {
    // Placeholder for performance monitoring implementation
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  private async executeFamilyCoordination(task: BackgroundTask): Promise<void> {
    // Placeholder for family coordination implementation
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  private insertTaskByPriority(task: BackgroundTask): void {
    let insertIndex = 0;
    
    // Find insertion point based on priority and scheduled time
    for (let i = 0; i < this.taskQueue.length; i++) {
      const existingTask = this.taskQueue[i];
      
      if (task.priority < existingTask.priority) {
        insertIndex = i;
        break;
      } else if (task.priority === existingTask.priority) {
        // Same priority, check scheduled time
        const taskTime = task.scheduledAt || task.createdAt;
        const existingTime = existingTask.scheduledAt || existingTask.createdAt;
        
        if (taskTime < existingTime) {
          insertIndex = i;
          break;
        }
      }
      
      insertIndex = i + 1;
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  private evictLowPriorityTasks(): void {
    // Remove background priority tasks first
    for (let i = this.taskQueue.length - 1; i >= 0; i--) {
      if (this.taskQueue[i].priority === TaskPriority.BACKGROUND) {
        const evicted = this.taskQueue.splice(i, 1)[0];
        this.emit('task_evicted', evicted);
        return;
      }
    }
    
    // If no background tasks, remove lowest priority
    if (this.taskQueue.length > 0) {
      const evicted = this.taskQueue.pop()!;
      this.emit('task_evicted', evicted);
    }
  }

  private canProcessMoreTasks(resourceUsage: ResourceUsage): boolean {
    return (
      resourceUsage.memoryUsageMB < this.config.resourceThresholds.maxMemoryUsageMB &&
      resourceUsage.cpuUsage < this.config.resourceThresholds.maxCpuUsage &&
      resourceUsage.networkConnections < this.config.resourceThresholds.maxNetworkConnections
    );
  }

  private canProcessTask(task: BackgroundTask, resourceUsage: ResourceUsage): boolean {
    const projectedMemory = resourceUsage.memoryUsageMB + task.resourceRequirements.memoryMB;
    
    return (
      projectedMemory <= this.config.resourceThresholds.maxMemoryUsageMB &&
      (!task.resourceRequirements.cpuIntensive || resourceUsage.cpuUsage < this.config.resourceThresholds.maxCpuUsage * 0.8) &&
      (!task.resourceRequirements.networkRequired || resourceUsage.networkConnections < this.config.resourceThresholds.maxNetworkConnections)
    );
  }

  private shouldDeferLowPriorityTasks(resourceUsage: ResourceUsage): boolean {
    return (
      resourceUsage.memoryUsageMB > this.config.resourceThresholds.maxMemoryUsageMB * 0.8 ||
      resourceUsage.cpuUsage > this.config.resourceThresholds.maxCpuUsage * 0.8
    );
  }

  private deferLowPriorityTasks(): void {
    const now = new Date();
    const deferralTime = 30000; // 30 seconds
    
    this.taskQueue.forEach(task => {
      if (task.priority >= TaskPriority.LOW && !task.scheduledAt) {
        task.scheduledAt = new Date(now.getTime() + deferralTime);
      }
    });
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay;
    
    return delay + jitter;
  }

  private calculateResourceUtilization(resourceUsage: ResourceUsage): number {
    const memoryUtil = resourceUsage.memoryUsageMB / this.config.resourceThresholds.maxMemoryUsageMB;
    const cpuUtil = resourceUsage.cpuUsage / this.config.resourceThresholds.maxCpuUsage;
    const networkUtil = resourceUsage.networkConnections / this.config.resourceThresholds.maxNetworkConnections;
    
    return Math.max(memoryUtil, cpuUtil, networkUtil);
  }

  private updateProcessingStats(duration: number): void {
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime + duration) / 2;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface ResourceUsage {
  memoryUsageMB: number;
  cpuUsage: number;
  networkConnections: number;
  diskIORate: number;
}

class ResourceMonitor {
  getCurrentUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    
    return {
      memoryUsageMB: memUsage.rss / 1024 / 1024,
      cpuUsage: this.estimateCpuUsage(),
      networkConnections: 0, // Would need actual implementation
      diskIORate: 0 // Would need actual implementation
    };
  }

  private estimateCpuUsage(): number {
    // Simplified CPU usage estimation
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 10000; // Rough percentage
  }
}

export default BackgroundProcessor;