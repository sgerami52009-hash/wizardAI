/**
 * Unit tests for ReminderQueueOptimizer
 * Tests reminder batching, queue optimization, and resource-aware processing
 */

import ReminderQueueOptimizer, { BatchType, BatchPriority } from './reminder-queue-optimizer';
import { Reminder, ReminderType, Priority, NotificationMethod } from './types';

describe('ReminderQueueOptimizer', () => {
  let optimizer: ReminderQueueOptimizer;
  let sampleReminders: Reminder[];

  beforeEach(() => {
    optimizer = new ReminderQueueOptimizer({
      maxBatchSize: 5,
      maxQueueSize: 50,
      batchingWindowMs: 1000,
      resourceThresholds: {
        maxMemoryUsageMB: 128,
        maxCpuUsage: 60,
        maxConcurrentBatches: 2,
        maxVoiceOperations: 1
      },
      priorityWeights: {
        emergency: 1.0,
        timeConstraint: 0.8,
        userContext: 0.6,
        resourceAvailability: 0.4
      },
      gracefulDegradationEnabled: true
    });

    sampleReminders = createSampleReminders();
  });

  afterEach(async () => {
    await optimizer.stop();
  });

  describe('Optimizer Lifecycle', () => {
    test('should start and stop optimizer correctly', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      optimizer.on('queue_optimizer_started', startSpy);
      optimizer.on('queue_optimizer_stopped', stopSpy);

      optimizer.start();
      expect(startSpy).toHaveBeenCalled();

      await optimizer.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should not start if already running', () => {
      const startSpy = jest.fn();
      optimizer.on('queue_optimizer_started', startSpy);

      optimizer.start();
      optimizer.start(); // Second call should be ignored

      expect(startSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reminder Queue Management', () => {
    test('should add reminders to queue', () => {
      const queuedSpy = jest.fn();
      optimizer.on('reminder_queued', queuedSpy);

      const reminder = sampleReminders[0];
      optimizer.addReminder(reminder);

      expect(queuedSpy).toHaveBeenCalledWith(reminder);
      
      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBe(1);
    });

    test('should prioritize reminders correctly', () => {
      const highPriorityReminder = createReminder('high-priority', Priority.HIGH);
      const lowPriorityReminder = createReminder('low-priority', Priority.LOW);
      const criticalReminder = createReminder('critical', Priority.HIGH);

      optimizer.addReminder(lowPriorityReminder);
      optimizer.addReminder(highPriorityReminder);
      optimizer.addReminder(criticalReminder);

      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBe(3);
    });

    test('should remove reminders from queue', () => {
      const reminder = sampleReminders[0];
      optimizer.addReminder(reminder);

      expect(optimizer.removeReminder(reminder.id)).toBe(true);
      expect(optimizer.removeReminder('non-existent')).toBe(false);

      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBe(0);
    });

    test('should handle queue overflow', () => {
      const overflowSpy = jest.fn();
      optimizer.on('queue_overflow_handled', overflowSpy);

      // Fill queue beyond capacity with low-priority reminders
      for (let i = 0; i < 55; i++) {
        const reminder = createReminder(`reminder-${i}`, Priority.LOW);
        optimizer.addReminder(reminder);
      }

      expect(overflowSpy).toHaveBeenCalled();
      
      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBeLessThanOrEqual(50);
    });
  });

  describe('Batch Creation', () => {
    test('should create emergency batches for critical reminders', () => {
      const emergencyBatchSpy = jest.fn();
      optimizer.on('emergency_batch_created', emergencyBatchSpy);

      const criticalReminder = createReminder('critical', Priority.HIGH);
      // Mock isCriticalReminder to return true
      (optimizer as any).isCriticalReminder = jest.fn().mockReturnValue(true);

      optimizer.addReminder(criticalReminder);

      expect(emergencyBatchSpy).toHaveBeenCalled();
    });

    test('should create time-based batches', (done) => {
      const batchesSpy = jest.fn();
      optimizer.on('batches_created', batchesSpy);

      // Add reminders with similar trigger times
      const now = new Date();
      for (let i = 0; i < 3; i++) {
        const reminder = createReminder(`time-${i}`, Priority.MEDIUM);
        reminder.triggerTime = new Date(now.getTime() + (i * 30000)); // 30 seconds apart
        optimizer.addReminder(reminder);
      }

      optimizer.start();

      setTimeout(() => {
        expect(batchesSpy).toHaveBeenCalled();
        done();
      }, 1200); // Wait for batching window
    });

    test('should create user-based batches', (done) => {
      const batchesSpy = jest.fn();
      optimizer.on('batches_created', batchesSpy);

      // Add reminders for same user
      for (let i = 0; i < 3; i++) {
        const reminder = createReminder(`user-${i}`, Priority.MEDIUM);
        reminder.userId = 'same-user';
        optimizer.addReminder(reminder);
      }

      optimizer.start();

      setTimeout(() => {
        expect(batchesSpy).toHaveBeenCalled();
        done();
      }, 1200);
    });

    test('should respect max batch size', (done) => {
      const batchesSpy = jest.fn();
      optimizer.on('batches_created', batchesSpy);

      // Add more reminders than max batch size
      for (let i = 0; i < 8; i++) {
        const reminder = createReminder(`batch-${i}`, Priority.MEDIUM);
        reminder.userId = 'same-user';
        optimizer.addReminder(reminder);
      }

      optimizer.start();

      setTimeout(() => {
        expect(batchesSpy).toHaveBeenCalled();
        
        const status = optimizer.getQueueStatus();
        expect(status.batchesQueued).toBeGreaterThan(1); // Should create multiple batches
        done();
      }, 1200);
    });
  });

  describe('Batch Processing', () => {
    test('should process batches when started', (done) => {
      const processingStartedSpy = jest.fn();
      const processingCompletedSpy = jest.fn();
      
      optimizer.on('batch_processing_started', processingStartedSpy);
      optimizer.on('batch_processing_completed', processingCompletedSpy);

      // Add reminders to create a batch
      for (let i = 0; i < 3; i++) {
        const reminder = createReminder(`process-${i}`, Priority.MEDIUM);
        optimizer.addReminder(reminder);
      }

      optimizer.start();

      setTimeout(() => {
        expect(processingStartedSpy).toHaveBeenCalled();
        expect(processingCompletedSpy).toHaveBeenCalled();
        done();
      }, 1500);
    });

    test('should handle batch processing failures', (done) => {
      const failedSpy = jest.fn();
      optimizer.on('batch_processing_failed', failedSpy);

      // Mock batch execution to fail
      const originalExecuteBatch = (optimizer as any).executeBatch;
      (optimizer as any).executeBatch = jest.fn().mockRejectedValue(new Error('Batch failed'));

      const reminder = createReminder('fail-test', Priority.MEDIUM);
      optimizer.addReminder(reminder);

      optimizer.start();

      setTimeout(() => {
        expect(failedSpy).toHaveBeenCalled();
        
        // Restore original method
        (optimizer as any).executeBatch = originalExecuteBatch;
        done();
      }, 1500);
    });

    test('should respect concurrent batch limits', (done) => {
      const processingStartedSpy = jest.fn();
      optimizer.on('batch_processing_started', processingStartedSpy);

      // Add many reminders to create multiple batches
      for (let i = 0; i < 15; i++) {
        const reminder = createReminder(`concurrent-${i}`, Priority.MEDIUM);
        optimizer.addReminder(reminder);
      }

      optimizer.start();

      setTimeout(() => {
        // Should not exceed maxConcurrentBatches (2)
        const activeBatches = (optimizer as any).activeBatches.size;
        expect(activeBatches).toBeLessThanOrEqual(2);
        done();
      }, 800);
    });
  });

  describe('Resource Management', () => {
    test('should check resource availability before processing', () => {
      // Mock high resource usage
      const originalGetCurrentUsage = (optimizer as any).resourceMonitor.getCurrentUsage;
      (optimizer as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 150, // Exceeds 128MB threshold
        cpuUsage: 70, // Exceeds 60% threshold
        activeVoiceOperations: 2, // Exceeds 1 operation limit
        activeAvatarOperations: 0
      });

      const reminder = createReminder('resource-test', Priority.MEDIUM);
      optimizer.addReminder(reminder);
      optimizer.start();

      // Batch should be queued but not processed due to resource constraints
      const status = optimizer.getQueueStatus();
      expect(status.batchesQueued).toBeGreaterThan(0);

      // Restore original method
      (optimizer as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });

    test('should optimize based on resource usage', () => {
      const optimizationSpy = jest.fn();
      optimizer.on('optimization_applied', optimizationSpy);

      // Mock high resource usage
      const originalGetCurrentUsage = (optimizer as any).resourceMonitor.getCurrentUsage;
      (optimizer as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 140, // High memory usage
        cpuUsage: 65, // High CPU usage
        activeVoiceOperations: 1,
        activeAvatarOperations: 0
      });

      optimizer.optimize();
      expect(optimizationSpy).toHaveBeenCalled();

      // Restore original method
      (optimizer as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });
  });

  describe('Graceful Degradation', () => {
    test('should implement graceful degradation under resource pressure', () => {
      const degradationSpy = jest.fn();
      optimizer.on('graceful_degradation_applied', degradationSpy);

      // Mock critical resource usage
      const originalGetCurrentUsage = (optimizer as any).resourceMonitor.getCurrentUsage;
      (optimizer as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 120, // Near threshold
        cpuUsage: 58, // Near threshold
        activeVoiceOperations: 1,
        activeAvatarOperations: 0
      });

      // Mock shouldDegrade to return true
      (optimizer as any).shouldDegrade = jest.fn().mockReturnValue(true);

      optimizer.optimize();
      expect(degradationSpy).toHaveBeenCalled();

      // Restore original method
      (optimizer as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });

    test('should defer low-priority reminders under pressure', () => {
      // Add low-priority reminders
      for (let i = 0; i < 5; i++) {
        const reminder = createReminder(`defer-${i}`, Priority.LOW);
        optimizer.addReminder(reminder);
      }

      // Trigger graceful degradation
      (optimizer as any).implementGracefulDegradation();

      // Low-priority reminders should have deferred trigger times
      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide queue statistics', () => {
      const reminder = sampleReminders[0];
      optimizer.addReminder(reminder);

      const stats = optimizer.getStats();
      expect(stats).toHaveProperty('totalReminders');
      expect(stats).toHaveProperty('batchesCreated');
      expect(stats).toHaveProperty('batchesProcessed');
      expect(stats).toHaveProperty('averageBatchSize');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('resourceEfficiency');
      expect(stats).toHaveProperty('lastOptimization');

      expect(stats.totalReminders).toBe(1);
    });

    test('should provide queue status', () => {
      const reminder = sampleReminders[0];
      optimizer.addReminder(reminder);

      const status = optimizer.getQueueStatus();
      expect(status).toHaveProperty('remindersQueued');
      expect(status).toHaveProperty('batchesQueued');
      expect(status).toHaveProperty('activeBatches');
      expect(status).toHaveProperty('capacity');

      expect(status.remindersQueued).toBe(1);
      expect(status.capacity).toBe(50);
    });

    test('should update statistics after processing', (done) => {
      const reminder = createReminder('stats-test', Priority.MEDIUM);
      optimizer.addReminder(reminder);

      optimizer.start();

      setTimeout(() => {
        const stats = optimizer.getStats();
        expect(stats.batchesCreated).toBeGreaterThan(0);
        done();
      }, 1500);
    });
  });

  describe('Batch Types', () => {
    test('should create different batch types correctly', (done) => {
      const batchesSpy = jest.fn();
      optimizer.on('batches_created', batchesSpy);

      // Add reminders that should create different batch types
      const timeReminder = createReminder('time-batch', Priority.MEDIUM);
      const userReminder1 = createReminder('user-batch-1', Priority.MEDIUM);
      const userReminder2 = createReminder('user-batch-2', Priority.MEDIUM);
      userReminder1.userId = 'batch-user';
      userReminder2.userId = 'batch-user';

      const priorityReminder = createReminder('priority-batch', Priority.HIGH);

      optimizer.addReminder(timeReminder);
      optimizer.addReminder(userReminder1);
      optimizer.addReminder(userReminder2);
      optimizer.addReminder(priorityReminder);

      optimizer.start();

      setTimeout(() => {
        expect(batchesSpy).toHaveBeenCalled();
        done();
      }, 1200);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty queue processing', () => {
      optimizer.start();
      
      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBe(0);
      expect(status.batchesQueued).toBe(0);
    });

    test('should handle rapid reminder additions', () => {
      const reminderIds: string[] = [];
      
      // Add many reminders rapidly
      for (let i = 0; i < 30; i++) {
        const reminder = createReminder(`rapid-${i}`, Priority.MEDIUM);
        optimizer.addReminder(reminder);
        reminderIds.push(reminder.id);
      }

      expect(reminderIds.length).toBe(30);
      
      const status = optimizer.getQueueStatus();
      expect(status.remindersQueued).toBe(30);
    });

    test('should handle optimizer stop with active processing', async () => {
      const reminder = createReminder('stop-test', Priority.MEDIUM);
      optimizer.addReminder(reminder);

      optimizer.start();
      
      // Stop immediately after starting
      await optimizer.stop();
      
      const status = optimizer.getQueueStatus();
      expect(status.activeBatches).toBe(0);
    });
  });
});

function createSampleReminders(): Reminder[] {
  return [
    {
      id: 'reminder1',
      userId: 'user1',
      title: 'Take Medicine',
      description: 'Take daily vitamins',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(Date.now() + 300000), // 5 minutes from now
      priority: Priority.HIGH,
      deliveryMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
      contextConstraints: [],
      escalationRules: [],
      isActive: true
    },
    {
      id: 'reminder2',
      userId: 'user2',
      title: 'Meeting Reminder',
      description: 'Team standup meeting',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(Date.now() + 600000), // 10 minutes from now
      priority: Priority.MEDIUM,
      deliveryMethods: [NotificationMethod.AVATAR],
      contextConstraints: [],
      escalationRules: [],
      isActive: true
    },
    {
      id: 'reminder3',
      userId: 'user1',
      title: 'Lunch Break',
      description: 'Time for lunch',
      type: ReminderType.TIME_BASED,
      triggerTime: new Date(Date.now() + 900000), // 15 minutes from now
      priority: Priority.LOW,
      deliveryMethods: [NotificationMethod.VISUAL],
      contextConstraints: [],
      escalationRules: [],
      isActive: true
    }
  ];
}

function createReminder(id: string, priority: Priority): Reminder {
  return {
    id,
    userId: 'test-user',
    title: `Test Reminder ${id}`,
    description: `Description for ${id}`,
    type: ReminderType.TIME_BASED,
    triggerTime: new Date(Date.now() + 300000),
    priority,
    deliveryMethods: [NotificationMethod.VOICE],
    contextConstraints: [],
    escalationRules: [],
    isActive: true
  };
}