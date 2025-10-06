/**
 * Unit tests for BackgroundProcessor
 * Tests task queuing, processing optimization, and resource management
 */

import BackgroundProcessor, { TaskType, TaskPriority, ResourceRequirements } from './background-processor';

describe('BackgroundProcessor', () => {
  let processor: BackgroundProcessor;

  beforeEach(() => {
    processor = new BackgroundProcessor({
      maxConcurrentTasks: 2,
      maxQueueSize: 10,
      processingIntervalMs: 100,
      resourceThresholds: {
        maxMemoryUsageMB: 256,
        maxCpuUsage: 70,
        maxNetworkConnections: 5,
        maxDiskIORate: 10
      },
      gracefulDegradationEnabled: true
    });
  });

  afterEach(async () => {
    await processor.stop();
  });

  describe('Processor Lifecycle', () => {
    test('should start and stop processor correctly', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      processor.on('processor_started', startSpy);
      processor.on('processor_stopped', stopSpy);

      processor.start();
      expect(startSpy).toHaveBeenCalled();

      await processor.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should not start if already running', () => {
      const startSpy = jest.fn();
      processor.on('processor_started', startSpy);

      processor.start();
      processor.start(); // Second call should be ignored

      expect(startSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Management', () => {
    test('should add tasks to queue', () => {
      const taskId = processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.MEDIUM,
        payload: { syncData: 'test' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      const status = processor.getQueueStatus();
      expect(status.queued).toBe(1);
    });

    test('should prioritize tasks correctly', () => {
      const queuedSpy = jest.fn();
      processor.on('task_queued', queuedSpy);

      // Add tasks with different priorities
      processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.LOW,
        payload: { order: 3 },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.addTask({
        type: TaskType.REMINDER_PROCESSING,
        priority: TaskPriority.HIGH,
        payload: { order: 1 },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.addTask({
        type: TaskType.INDEX_OPTIMIZATION,
        priority: TaskPriority.MEDIUM,
        payload: { order: 2 },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      expect(queuedSpy).toHaveBeenCalledTimes(3);
      
      const status = processor.getQueueStatus();
      expect(status.queued).toBe(3);
    });

    test('should cancel queued tasks', () => {
      const taskId = processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.MEDIUM,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      expect(processor.cancelTask(taskId)).toBe(true);
      expect(processor.cancelTask('non-existent')).toBe(false);

      const status = processor.getQueueStatus();
      expect(status.queued).toBe(0);
    });

    test('should handle queue overflow', () => {
      const evictedSpy = jest.fn();
      processor.on('task_evicted', evictedSpy);

      // Fill queue beyond capacity
      for (let i = 0; i < 12; i++) {
        processor.addTask({
          type: TaskType.CALENDAR_SYNC,
          priority: i < 6 ? TaskPriority.BACKGROUND : TaskPriority.HIGH,
          payload: { index: i },
          maxRetries: 3,
          timeout: 5000,
          resourceRequirements: createBasicResourceRequirements()
        });
      }

      expect(evictedSpy).toHaveBeenCalled();
      
      const status = processor.getQueueStatus();
      expect(status.queued).toBeLessThanOrEqual(10);
    });
  });

  describe('Task Processing', () => {
    test('should process tasks when started', (done) => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      processor.on('task_started', startedSpy);
      processor.on('task_completed', completedSpy);

      processor.addTask({
        type: TaskType.PERFORMANCE_MONITORING,
        priority: TaskPriority.HIGH,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.start();

      setTimeout(() => {
        expect(startedSpy).toHaveBeenCalled();
        expect(completedSpy).toHaveBeenCalled();
        done();
      }, 200);
    });

    test('should retry failed tasks', (done) => {
      const retrySpy = jest.fn();
      const failedSpy = jest.fn();
      
      processor.on('task_retry_scheduled', retrySpy);
      processor.on('task_failed', failedSpy);

      // Mock task execution to fail
      const originalExecuteTask = (processor as any).executeTask;
      (processor as any).executeTask = jest.fn().mockRejectedValue(new Error('Task failed'));

      processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.HIGH,
        payload: { test: 'data' },
        maxRetries: 2,
        timeout: 1000,
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.start();

      setTimeout(() => {
        expect(retrySpy).toHaveBeenCalled();
        
        // Wait for final failure
        setTimeout(() => {
          expect(failedSpy).toHaveBeenCalled();
          
          // Restore original method
          (processor as any).executeTask = originalExecuteTask;
          done();
        }, 300);
      }, 200);
    });

    test('should handle task timeouts', (done) => {
      const failedSpy = jest.fn();
      processor.on('task_failed', failedSpy);

      // Mock task execution to take longer than timeout
      const originalExecuteTask = (processor as any).executeTask;
      (processor as any).executeTask = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.HIGH,
        payload: { test: 'data' },
        maxRetries: 0,
        timeout: 100, // Very short timeout
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.start();

      setTimeout(() => {
        expect(failedSpy).toHaveBeenCalled();
        
        // Restore original method
        (processor as any).executeTask = originalExecuteTask;
        done();
      }, 300);
    });
  });

  describe('Resource Management', () => {
    test('should respect concurrent task limits', (done) => {
      const startedSpy = jest.fn();
      processor.on('task_started', startedSpy);

      // Add more tasks than concurrent limit
      for (let i = 0; i < 5; i++) {
        processor.addTask({
          type: TaskType.CALENDAR_SYNC,
          priority: TaskPriority.HIGH,
          payload: { index: i },
          maxRetries: 3,
          timeout: 5000,
          resourceRequirements: createBasicResourceRequirements()
        });
      }

      processor.start();

      setTimeout(() => {
        // Should not exceed maxConcurrentTasks (2)
        expect(startedSpy.mock.calls.length).toBeLessThanOrEqual(2);
        done();
      }, 150);
    });

    test('should check resource requirements before processing', () => {
      const highResourceTask = {
        type: TaskType.INDEX_OPTIMIZATION,
        priority: TaskPriority.HIGH,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: {
          memoryMB: 1000, // Exceeds threshold
          cpuIntensive: true,
          networkRequired: false,
          diskIO: false,
          estimatedDurationMs: 1000
        }
      };

      processor.addTask(highResourceTask);
      processor.start();

      // Task should be queued but not processed due to resource constraints
      const status = processor.getQueueStatus();
      expect(status.queued).toBeGreaterThan(0);
    });
  });

  describe('Optimization', () => {
    test('should optimize processing based on resource usage', () => {
      const optimizationSpy = jest.fn();
      processor.on('optimization_applied', optimizationSpy);

      // Mock high resource usage
      const originalGetCurrentUsage = (processor as any).resourceMonitor.getCurrentUsage;
      (processor as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 300, // Exceeds 256MB threshold
        cpuUsage: 80, // Exceeds 70% threshold
        networkConnections: 3,
        diskIORate: 5
      });

      processor.optimize();
      expect(optimizationSpy).toHaveBeenCalled();

      // Restore original method
      (processor as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });

    test('should provide processing statistics', () => {
      processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.MEDIUM,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      const stats = processor.getStats();
      expect(stats).toHaveProperty('tasksProcessed');
      expect(stats).toHaveProperty('tasksQueued');
      expect(stats).toHaveProperty('tasksFailed');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('resourceUtilization');
      expect(stats).toHaveProperty('lastOptimization');
    });
  });

  describe('Graceful Degradation', () => {
    test('should defer low-priority tasks under resource pressure', () => {
      // Mock high resource usage
      const originalGetCurrentUsage = (processor as any).resourceMonitor.getCurrentUsage;
      (processor as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 300, // High memory usage
        cpuUsage: 85, // High CPU usage
        networkConnections: 4,
        diskIORate: 8
      });

      // Add low-priority tasks
      processor.addTask({
        type: TaskType.DATA_CLEANUP,
        priority: TaskPriority.LOW,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 5000,
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.optimize();

      // Restore original method
      (processor as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });

    test('should handle resource exhaustion gracefully', () => {
      const optimizationSpy = jest.fn();
      processor.on('optimization_applied', optimizationSpy);

      // Simulate critical resource usage
      const originalGetCurrentUsage = (processor as any).resourceMonitor.getCurrentUsage;
      (processor as any).resourceMonitor.getCurrentUsage = jest.fn().mockReturnValue({
        memoryUsageMB: 400, // Critical memory usage
        cpuUsage: 95, // Critical CPU usage
        networkConnections: 6, // Exceeds limit
        diskIORate: 15 // Exceeds limit
      });

      processor.optimize();
      expect(optimizationSpy).toHaveBeenCalled();

      // Restore original method
      (processor as any).resourceMonitor.getCurrentUsage = originalGetCurrentUsage;
    });
  });

  describe('Task Types', () => {
    test('should handle different task types', async () => {
      const taskTypes = [
        TaskType.CALENDAR_SYNC,
        TaskType.REMINDER_PROCESSING,
        TaskType.INDEX_OPTIMIZATION,
        TaskType.DATA_CLEANUP,
        TaskType.PERFORMANCE_MONITORING,
        TaskType.FAMILY_COORDINATION
      ];

      const completedSpy = jest.fn();
      processor.on('task_completed', completedSpy);

      taskTypes.forEach(type => {
        processor.addTask({
          type,
          priority: TaskPriority.MEDIUM,
          payload: { taskType: type },
          maxRetries: 3,
          timeout: 5000,
          resourceRequirements: createBasicResourceRequirements()
        });
      });

      processor.start();

      // Wait for tasks to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty queue processing', () => {
      processor.start();
      
      const status = processor.getQueueStatus();
      expect(status.queued).toBe(0);
      expect(status.active).toBe(0);
    });

    test('should handle rapid task additions', () => {
      const taskIds: string[] = [];
      
      // Add many tasks rapidly
      for (let i = 0; i < 50; i++) {
        const taskId = processor.addTask({
          type: TaskType.PERFORMANCE_MONITORING,
          priority: TaskPriority.BACKGROUND,
          payload: { index: i },
          maxRetries: 1,
          timeout: 1000,
          resourceRequirements: createBasicResourceRequirements()
        });
        taskIds.push(taskId);
      }

      expect(taskIds.length).toBe(50);
      expect(new Set(taskIds).size).toBe(50); // All IDs should be unique
    });

    test('should handle processor stop with active tasks', async () => {
      processor.addTask({
        type: TaskType.CALENDAR_SYNC,
        priority: TaskPriority.HIGH,
        payload: { test: 'data' },
        maxRetries: 3,
        timeout: 10000, // Long timeout
        resourceRequirements: createBasicResourceRequirements()
      });

      processor.start();
      
      // Stop immediately after starting
      await processor.stop();
      
      const status = processor.getQueueStatus();
      expect(status.active).toBe(0);
    });
  });
});

function createBasicResourceRequirements(): ResourceRequirements {
  return {
    memoryMB: 10,
    cpuIntensive: false,
    networkRequired: false,
    diskIO: false,
    estimatedDurationMs: 100
  };
}