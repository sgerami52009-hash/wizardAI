/**
 * Reminder queue processing optimization system
 * Provides efficient reminder processing, batch operations, and resource-aware scheduling
 * Optimized for Jetson Nano Orin hardware constraints
 */

import { EventEmitter } from 'events';
import { Reminder } from './types';

export interface ReminderBatch {
  id: string;
  reminders: Reminder[];
  batchType: BatchType;
  priority: BatchPriority;
  estimatedProcessingTime: number;
  resourceRequirements: BatchResourceRequirements;
  createdAt: Date;
  scheduledAt?: Date;
}

export enum BatchType {
  TIME_BASED = 'time_based',
  USER_BASED = 'user_based',
  PRIORITY_BASED = 'priority_based',
  CONTEXT_BASED = 'context_based',
  EMERGENCY = 'emergency'
}

export enum BatchPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface BatchResourceRequirements {
  memoryMB: number;
  cpuIntensive: boolean;
  networkRequired: boolean;
  voicePipelineRequired: boolean;
  avatarSystemRequired: boolean;
}

export interface QueueOptimizationStats {
  totalReminders: number;
  batchesCreated: number;
  batchesProcessed: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  resourceEfficiency: number;
  lastOptimization: Date;
}

export interface OptimizationConfig {
  maxBatchSize: number;
  maxQueueSize: number;
  batchingWindowMs: number;
  resourceThresholds: ResourceThresholds;
  priorityWeights: PriorityWeights;
  gracefulDegradationEnabled: boolean;
}

export interface ResourceThresholds {
  maxMemoryUsageMB: number;
  maxCpuUsage: number;
  maxConcurrentBatches: number;
  maxVoiceOperations: number;
}

export interface PriorityWeights {
  emergency: number;
  timeConstraint: number;
  userContext: number;
  resourceAvailability: number;
}

export class ReminderQueueOptimizer extends EventEmitter {
  private reminderQueue: Reminder[] = [];
  private batchQueue: ReminderBatch[] = [];
  private activeBatches: Map<string, ReminderBatch> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private batchingInterval: NodeJS.Timeout | null = null;
  private stats: QueueOptimizationStats;
  private config: OptimizationConfig;
  private isProcessing = false;
  private resourceMonitor: QueueResourceMonitor;

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    
    this.config = {
      maxBatchSize: 10,
      maxQueueSize: 1000, // As per requirements
      batchingWindowMs: 2000, // 2 seconds batching window
      resourceThresholds: {
        maxMemoryUsageMB: 256, // Conservative for reminder processing
        maxCpuUsage: 60,
        maxConcurrentBatches: 3,
        maxVoiceOperations: 2 // Limit voice operations for latency
      },
      priorityWeights: {
        emergency: 1.0,
        timeConstraint: 0.8,
        userContext: 0.6,
        resourceAvailability: 0.4
      },
      gracefulDegradationEnabled: true,
      ...config
    };

    this.stats = {
      totalReminders: 0,
      batchesCreated: 0,
      batchesProcessed: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      resourceEfficiency: 0,
      lastOptimization: new Date()
    };

    this.resourceMonitor = new QueueResourceMonitor();
  }

  /**
   * Start reminder queue processing
   */
  public start(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    // Start batch creation interval
    this.batchingInterval = setInterval(() => {
      this.createOptimalBatches();
    }, this.config.batchingWindowMs);

    // Start batch processing interval
    this.processingInterval = setInterval(() => {
      this.processBatches();
    }, 500); // Process batches every 500ms

    this.emit('queue_optimizer_started');
  }

  /**
   * Stop reminder queue processing
   */
  public async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.batchingInterval) {
      clearInterval(this.batchingInterval);
      this.batchingInterval = null;
    }

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active batches to complete
    while (this.activeBatches.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('queue_optimizer_stopped');
  }

  /**
   * Add reminder to processing queue
   */
  public addReminder(reminder: Reminder): void {
    if (this.reminderQueue.length >= this.config.maxQueueSize) {
      this.handleQueueOverflow();
    }

    // Insert reminder in priority order
    this.insertReminderByPriority(reminder);
    this.stats.totalReminders++;

    this.emit('reminder_queued', reminder);

    // Check if immediate processing is needed for critical reminders
    if (this.isCriticalReminder(reminder)) {
      this.createEmergencyBatch(reminder);
    }
  }

  /**
   * Remove reminder from queue
   */
  public removeReminder(reminderId: string): boolean {
    const index = this.reminderQueue.findIndex(r => r.id === reminderId);
    if (index !== -1) {
      const removed = this.reminderQueue.splice(index, 1)[0];
      this.emit('reminder_removed', removed);
      return true;
    }
    return false;
  }

  /**
   * Get current queue statistics
   */
  public getStats(): QueueOptimizationStats {
    return { ...this.stats };
  }

  /**
   * Get current queue status
   */
  public getQueueStatus(): {
    remindersQueued: number;
    batchesQueued: number;
    activeBatches: number;
    capacity: number;
  } {
    return {
      remindersQueued: this.reminderQueue.length,
      batchesQueued: this.batchQueue.length,
      activeBatches: this.activeBatches.size,
      capacity: this.config.maxQueueSize
    };
  }

  /**
   * Optimize queue processing based on current system state
   */
  public optimize(): void {
    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    
    // Adjust batch size based on resource availability
    if (resourceUsage.memoryUsageMB > this.config.resourceThresholds.maxMemoryUsageMB * 0.8) {
      this.config.maxBatchSize = Math.max(3, this.config.maxBatchSize - 2);
      this.emit('optimization_applied', 'reduced_batch_size_memory');
    } else if (resourceUsage.cpuUsage > this.config.resourceThresholds.maxCpuUsage * 0.8) {
      this.config.resourceThresholds.maxConcurrentBatches = Math.max(1, this.config.resourceThresholds.maxConcurrentBatches - 1);
      this.emit('optimization_applied', 'reduced_concurrency_cpu');
    } else if (resourceUsage.memoryUsageMB < this.config.resourceThresholds.maxMemoryUsageMB * 0.5) {
      this.config.maxBatchSize = Math.min(15, this.config.maxBatchSize + 1);
      this.emit('optimization_applied', 'increased_batch_size');
    }

    // Implement graceful degradation if needed
    if (this.config.gracefulDegradationEnabled && this.shouldDegrade(resourceUsage)) {
      this.implementGracefulDegradation();
    }

    this.stats.lastOptimization = new Date();
  }

  private createOptimalBatches(): void {
    if (this.reminderQueue.length === 0) {
      return;
    }

    const batches = this.groupRemindersIntoBatches();
    
    batches.forEach(batch => {
      this.batchQueue.push(batch);
      this.stats.batchesCreated++;
    });

    // Sort batch queue by priority
    this.batchQueue.sort((a, b) => a.priority - b.priority);

    this.emit('batches_created', batches.length);
  }

  private groupRemindersIntoBatches(): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const processed = new Set<string>();

    // Create time-based batches for reminders due at similar times
    const timeBatches = this.createTimeBatches(processed);
    batches.push(...timeBatches);

    // Create user-based batches for same user reminders
    const userBatches = this.createUserBatches(processed);
    batches.push(...userBatches);

    // Create priority-based batches for high-priority reminders
    const priorityBatches = this.createPriorityBatches(processed);
    batches.push(...priorityBatches);

    // Create context-based batches for similar contexts
    const contextBatches = this.createContextBatches(processed);
    batches.push(...contextBatches);

    // Handle remaining reminders
    const remainingBatches = this.createRemainingBatches(processed);
    batches.push(...remainingBatches);

    return batches;
  }

  private createTimeBatches(processed: Set<string>): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const timeGroups = new Map<string, Reminder[]>();
    const timeWindow = 60000; // 1 minute window

    this.reminderQueue.forEach(reminder => {
      if (processed.has(reminder.id)) return;

      const timeKey = Math.floor(reminder.triggerTime.getTime() / timeWindow).toString();
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, []);
      }
      timeGroups.get(timeKey)!.push(reminder);
    });

    timeGroups.forEach(reminders => {
      if (reminders.length >= 2) {
        const batch = this.createBatch(reminders, BatchType.TIME_BASED);
        batches.push(batch);
        reminders.forEach(r => processed.add(r.id));
      }
    });

    return batches;
  }

  private createUserBatches(processed: Set<string>): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const userGroups = new Map<string, Reminder[]>();

    this.reminderQueue.forEach(reminder => {
      if (processed.has(reminder.id)) return;

      if (!userGroups.has(reminder.userId)) {
        userGroups.set(reminder.userId, []);
      }
      userGroups.get(reminder.userId)!.push(reminder);
    });

    userGroups.forEach(reminders => {
      if (reminders.length >= 2) {
        // Split into smaller batches if needed
        while (reminders.length > 0) {
          const batchReminders = reminders.splice(0, this.config.maxBatchSize);
          const batch = this.createBatch(batchReminders, BatchType.USER_BASED);
          batches.push(batch);
          batchReminders.forEach(r => processed.add(r.id));
        }
      }
    });

    return batches;
  }

  private createPriorityBatches(processed: Set<string>): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const highPriorityReminders = this.reminderQueue.filter(
      reminder => !processed.has(reminder.id) && this.isHighPriority(reminder)
    );

    if (highPriorityReminders.length > 0) {
      while (highPriorityReminders.length > 0) {
        const batchReminders = highPriorityReminders.splice(0, this.config.maxBatchSize);
        const batch = this.createBatch(batchReminders, BatchType.PRIORITY_BASED);
        batch.priority = BatchPriority.HIGH;
        batches.push(batch);
        batchReminders.forEach(r => processed.add(r.id));
      }
    }

    return batches;
  }

  private createContextBatches(processed: Set<string>): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const contextGroups = new Map<string, Reminder[]>();

    this.reminderQueue.forEach(reminder => {
      if (processed.has(reminder.id)) return;

      // Group by delivery method and context constraints
      const contextKey = this.getContextKey(reminder);
      if (!contextGroups.has(contextKey)) {
        contextGroups.set(contextKey, []);
      }
      contextGroups.get(contextKey)!.push(reminder);
    });

    contextGroups.forEach(reminders => {
      if (reminders.length >= 2) {
        while (reminders.length > 0) {
          const batchReminders = reminders.splice(0, this.config.maxBatchSize);
          const batch = this.createBatch(batchReminders, BatchType.CONTEXT_BASED);
          batches.push(batch);
          batchReminders.forEach(r => processed.add(r.id));
        }
      }
    });

    return batches;
  }

  private createRemainingBatches(processed: Set<string>): ReminderBatch[] {
    const batches: ReminderBatch[] = [];
    const remaining = this.reminderQueue.filter(reminder => !processed.has(reminder.id));

    while (remaining.length > 0) {
      const batchReminders = remaining.splice(0, this.config.maxBatchSize);
      const batch = this.createBatch(batchReminders, BatchType.TIME_BASED);
      batches.push(batch);
      batchReminders.forEach(r => processed.add(r.id));
    }

    // Remove processed reminders from main queue
    this.reminderQueue = this.reminderQueue.filter(reminder => !processed.has(reminder.id));

    return batches;
  }

  private createBatch(reminders: Reminder[], type: BatchType): ReminderBatch {
    const batch: ReminderBatch = {
      id: this.generateBatchId(),
      reminders: [...reminders],
      batchType: type,
      priority: this.calculateBatchPriority(reminders, type),
      estimatedProcessingTime: this.estimateProcessingTime(reminders),
      resourceRequirements: this.calculateResourceRequirements(reminders),
      createdAt: new Date()
    };

    return batch;
  }

  private createEmergencyBatch(reminder: Reminder): void {
    const batch: ReminderBatch = {
      id: this.generateBatchId(),
      reminders: [reminder],
      batchType: BatchType.EMERGENCY,
      priority: BatchPriority.CRITICAL,
      estimatedProcessingTime: this.estimateProcessingTime([reminder]),
      resourceRequirements: this.calculateResourceRequirements([reminder]),
      createdAt: new Date()
    };

    // Insert at front of batch queue
    this.batchQueue.unshift(batch);
    this.stats.batchesCreated++;

    // Remove from main queue
    const index = this.reminderQueue.findIndex(r => r.id === reminder.id);
    if (index !== -1) {
      this.reminderQueue.splice(index, 1);
    }

    this.emit('emergency_batch_created', batch);
  }

  private async processBatches(): Promise<void> {
    if (!this.isProcessing || this.batchQueue.length === 0) {
      return;
    }

    const resourceUsage = this.resourceMonitor.getCurrentUsage();
    
    // Check if we can process more batches
    if (this.activeBatches.size >= this.config.resourceThresholds.maxConcurrentBatches) {
      return;
    }

    // Process batches in priority order
    while (
      this.activeBatches.size < this.config.resourceThresholds.maxConcurrentBatches &&
      this.batchQueue.length > 0
    ) {
      const batch = this.batchQueue.shift()!;
      
      if (this.canProcessBatch(batch, resourceUsage)) {
        this.processBatch(batch);
      } else {
        // Put batch back and wait for resources
        this.batchQueue.unshift(batch);
        break;
      }
    }
  }

  private async processBatch(batch: ReminderBatch): Promise<void> {
    const startTime = performance.now();
    this.activeBatches.set(batch.id, batch);

    try {
      this.emit('batch_processing_started', batch);
      
      // Process reminders in batch
      await this.executeBatch(batch);
      
      // Batch completed successfully
      this.activeBatches.delete(batch.id);
      this.stats.batchesProcessed++;
      
      const duration = performance.now() - startTime;
      this.updateBatchStats(batch, duration);
      
      this.emit('batch_processing_completed', batch, duration);

    } catch (error) {
      this.activeBatches.delete(batch.id);
      this.emit('batch_processing_failed', batch, error);
      
      // Retry individual reminders if batch fails
      this.retryIndividualReminders(batch);
    }
  }

  private async executeBatch(batch: ReminderBatch): Promise<void> {
    // Group reminders by delivery method for efficient processing
    const deliveryGroups = this.groupByDeliveryMethod(batch.reminders);
    
    // Process each delivery group
    for (const entry of Array.from(deliveryGroups.entries())) {
      const [method, reminders] = entry;
      await this.processDeliveryGroup(method, reminders);
    }
  }

  private groupByDeliveryMethod(reminders: Reminder[]): Map<string, Reminder[]> {
    const groups = new Map<string, Reminder[]>();
    
    reminders.forEach(reminder => {
      reminder.deliveryMethods.forEach(method => {
        const key = method.toString();
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(reminder);
      });
    });
    
    return groups;
  }

  private async processDeliveryGroup(method: string, reminders: Reminder[]): Promise<void> {
    // Placeholder for actual delivery processing
    // This would integrate with the notification dispatcher
    await new Promise(resolve => setTimeout(resolve, 50 * reminders.length));
  }

  private retryIndividualReminders(batch: ReminderBatch): void {
    batch.reminders.forEach(reminder => {
      // Add back to queue for individual processing
      this.insertReminderByPriority(reminder);
    });
  }

  private insertReminderByPriority(reminder: Reminder): void {
    let insertIndex = 0;
    
    for (let i = 0; i < this.reminderQueue.length; i++) {
      if (this.getReminderPriority(reminder) < this.getReminderPriority(this.reminderQueue[i])) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    this.reminderQueue.splice(insertIndex, 0, reminder);
  }

  private calculateBatchPriority(reminders: Reminder[], type: BatchType): BatchPriority {
    if (type === BatchType.EMERGENCY) {
      return BatchPriority.CRITICAL;
    }

    const avgPriority = reminders.reduce((sum, r) => sum + this.getReminderPriority(r), 0) / reminders.length;
    
    if (avgPriority <= 1) return BatchPriority.HIGH;
    if (avgPriority <= 2) return BatchPriority.MEDIUM;
    if (avgPriority <= 3) return BatchPriority.LOW;
    return BatchPriority.BACKGROUND;
  }

  private estimateProcessingTime(reminders: Reminder[]): number {
    // Base time per reminder + overhead for batch processing
    const baseTimePerReminder = 100; // ms
    const batchOverhead = 50; // ms
    
    return (reminders.length * baseTimePerReminder) + batchOverhead;
  }

  private calculateResourceRequirements(reminders: Reminder[]): BatchResourceRequirements {
    const memoryPerReminder = 2; // MB
    const hasVoiceReminders = reminders.some(r => 
      r.deliveryMethods.some(m => m.toString().includes('voice'))
    );
    const hasAvatarReminders = reminders.some(r => 
      r.deliveryMethods.some(m => m.toString().includes('avatar'))
    );

    return {
      memoryMB: reminders.length * memoryPerReminder,
      cpuIntensive: reminders.length > 5,
      networkRequired: false, // Most reminders are local
      voicePipelineRequired: hasVoiceReminders,
      avatarSystemRequired: hasAvatarReminders
    };
  }

  private getReminderPriority(reminder: Reminder): number {
    // Convert reminder priority to numeric value
    if (typeof reminder.priority === 'number') return reminder.priority;
    if (typeof reminder.priority === 'string') {
      const priorityStr = String(reminder.priority).toLowerCase();
      switch (priorityStr) {
        case 'critical': return 0;
        case 'high': return 1;
        case 'medium': return 2;
        case 'low': return 3;
        default: return 4;
      }
    }
    return 4;
  }

  private isCriticalReminder(reminder: Reminder): boolean {
    return this.getReminderPriority(reminder) === 0;
  }

  private isHighPriority(reminder: Reminder): boolean {
    return this.getReminderPriority(reminder) <= 1;
  }

  private getContextKey(reminder: Reminder): string {
    const methods = reminder.deliveryMethods.map(m => m.toString()).sort().join(',');
    const constraints = reminder.contextConstraints?.map(c => c.toString()).sort().join(',') || '';
    return `${methods}:${constraints}`;
  }

  private canProcessBatch(batch: ReminderBatch, resourceUsage: QueueResourceUsage): boolean {
    const projectedMemory = resourceUsage.memoryUsageMB + batch.resourceRequirements.memoryMB;
    
    return (
      projectedMemory <= this.config.resourceThresholds.maxMemoryUsageMB &&
      resourceUsage.cpuUsage <= this.config.resourceThresholds.maxCpuUsage &&
      (!batch.resourceRequirements.voicePipelineRequired || resourceUsage.activeVoiceOperations < this.config.resourceThresholds.maxVoiceOperations)
    );
  }

  private shouldDegrade(resourceUsage: QueueResourceUsage): boolean {
    return (
      resourceUsage.memoryUsageMB > this.config.resourceThresholds.maxMemoryUsageMB * 0.9 ||
      resourceUsage.cpuUsage > this.config.resourceThresholds.maxCpuUsage * 0.9
    );
  }

  private implementGracefulDegradation(): void {
    // Reduce batch sizes
    this.config.maxBatchSize = Math.max(3, Math.floor(this.config.maxBatchSize * 0.7));
    
    // Reduce concurrent batches
    this.config.resourceThresholds.maxConcurrentBatches = Math.max(1, this.config.resourceThresholds.maxConcurrentBatches - 1);
    
    // Defer low-priority reminders
    this.deferLowPriorityReminders();
    
    this.emit('graceful_degradation_applied');
  }

  private deferLowPriorityReminders(): void {
    const deferralTime = 60000; // 1 minute
    const now = new Date();
    
    this.reminderQueue.forEach(reminder => {
      if (this.getReminderPriority(reminder) >= 3) {
        reminder.triggerTime = new Date(Math.max(
          reminder.triggerTime.getTime(),
          now.getTime() + deferralTime
        ));
      }
    });
  }

  private handleQueueOverflow(): void {
    // Remove lowest priority reminders
    const lowPriorityCount = this.reminderQueue.filter(r => this.getReminderPriority(r) >= 3).length;
    
    if (lowPriorityCount > 0) {
      this.reminderQueue = this.reminderQueue.filter(r => this.getReminderPriority(r) < 3);
      this.emit('queue_overflow_handled', lowPriorityCount);
    }
  }

  private updateBatchStats(batch: ReminderBatch, duration: number): void {
    this.stats.averageBatchSize = (this.stats.averageBatchSize + batch.reminders.length) / 2;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime + duration) / 2;
    
    // Calculate resource efficiency
    const expectedTime = batch.estimatedProcessingTime;
    const efficiency = expectedTime > 0 ? Math.min(1, expectedTime / duration) : 1;
    this.stats.resourceEfficiency = (this.stats.resourceEfficiency + efficiency) / 2;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface QueueResourceUsage {
  memoryUsageMB: number;
  cpuUsage: number;
  activeVoiceOperations: number;
  activeAvatarOperations: number;
}

class QueueResourceMonitor {
  getCurrentUsage(): QueueResourceUsage {
    const memUsage = process.memoryUsage();
    
    return {
      memoryUsageMB: memUsage.rss / 1024 / 1024,
      cpuUsage: this.estimateCpuUsage(),
      activeVoiceOperations: 0, // Would need actual implementation
      activeAvatarOperations: 0 // Would need actual implementation
    };
  }

  private estimateCpuUsage(): number {
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 10000;
  }
}

export default ReminderQueueOptimizer;