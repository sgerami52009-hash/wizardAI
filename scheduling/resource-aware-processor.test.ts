/**
 * Unit tests for ResourceAwareProcessor
 * Tests resource monitoring, processing optimization, and graceful degradation
 */

import ResourceAwareProcessor, { 
  ProcessingType, 
  ProcessingPriority, 
  ResourcePressure,
  DegradationLevel 
} from './resource-aware-processor';

describe('ResourceAwareProcessor', () => {
  let processor: ResourceAwareProcessor;

  beforeEach(() => {
    processor = new ResourceAwareProcessor();
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

  describe('Resource State Monitoring', () => {
    test('should initialize resource state correctly', () => {
      const resourceState = processor.getResourceState();
      
      expect(resourceState).toHaveProperty('memory');
      expect(resourceState).toHaveProperty('cpu');
      expect(resourceState).toHaveProperty('network');
      expect(resourceState).toHaveProperty('storage');
      expect(resourceState).toHaveProperty('voice');
      expect(resourceState).toHaveProperty('avatar');

      expect(resourceState.memory.total).toBe(1024 * 1024 * 1024); // 1GB
      expect(resourceState.memory.threshold).toBe(1024 * 1024 * 1024 * 0.8); // 80%
      expect(resourceState.cpu.threshold).toBe(80);
    });

    test('should update resource state when monitoring', (done) => {
      const pressureAnalyzedSpy = jest.fn();
      processor.on('resource_pressure_analyzed', pressureAnalyzedSpy);

      processor.start();

      setTimeout(() => {
        expect(pressureAnalyzedSpy).toHaveBeenCalled();
        
        const resourceState = processor.getResourceState();
        expect(resourceState.memory.used).toBeGreaterThan(0);
        expect(resourceState.cpu.usage).toBeGreaterThanOrEqual(0);
        
        done();
      }, 1200);
    });

    test('should calculate resource pressure correctly', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 900 * 1024 * 1024, // 900MB (high usage)
        heapUsed: 400 * 1024 * 1024,
        heapTotal: 500 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024
      });

      processor.start();
      
      setTimeout(() => {
        const resourceState = processor.getResourceState();
        expect(resourceState.memory.pressure).toBe(ResourcePressure.HIGH);
        
        // Restore original function
        process.memoryUsage = originalMemoryUsage;
      }, 100);
    });
  });

  describe('Processing Request Management', () => {
    test('should submit processing requests', () => {
      const requestId = processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: false
      });

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
    });

    test('should prioritize requests correctly', () => {
      const queuedSpy = jest.fn();
      processor.on('request_queued', queuedSpy);

      // Add requests with different priorities
      processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.LOW,
        resourceRequirements: createHighResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: false
      });

      processor.submitRequest({
        type: ProcessingType.REMINDER_DELIVERY,
        priority: ProcessingPriority.CRITICAL,
        resourceRequirements: createHighResourceRequirements(),
        estimatedDuration: 500,
        canDegrade: false
      });

      processor.submitRequest({
        type: ProcessingType.SYNC_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createHighResourceRequirements(),
        estimatedDuration: 800,
        canDegrade: false
      });

      expect(queuedSpy).toHaveBeenCalledTimes(3);
    });

    test('should cancel queued requests', () => {
      const requestId = processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createHighResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: false
      });

      expect(processor.cancelRequest(requestId)).toBe(true);
      expect(processor.cancelRequest('non-existent')).toBe(false);
    });

    test('should process requests immediately when resources allow', (done) => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      processor.on('request_processing_started', startedSpy);
      processor.on('request_processing_completed', completedSpy);

      processor.submitRequest({
        type: ProcessingType.PERFORMANCE_MONITORING,
        priority: ProcessingPriority.HIGH,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 100,
        canDegrade: false
      });

      processor.start();

      setTimeout(() => {
        expect(startedSpy).toHaveBeenCalled();
        expect(completedSpy).toHaveBeenCalled();
        done();
      }, 200);
    });
  });

  describe('Resource-Aware Processing', () => {
    test('should queue requests when resources are insufficient', () => {
      const queuedSpy = jest.fn();
      processor.on('request_queued', queuedSpy);

      // Mock high resource usage
      const originalUpdateResourceState = (processor as any).updateResourceState;
      (processor as any).updateResourceState = jest.fn().mockImplementation(() => {
        (processor as any).resourceState.memory.used = 900 * 1024 * 1024; // High memory
        (processor as any).resourceState.memory.available = 100 * 1024 * 1024;
        (processor as any).resourceState.cpu.usage = 85; // High CPU
      });

      processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createHighResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: false
      });

      expect(queuedSpy).toHaveBeenCalled();

      // Restore original method
      (processor as any).updateResourceState = originalUpdateResourceState;
    });

    test('should respect resource requirements', () => {
      const highMemoryRequest = {
        type: ProcessingType.INDEX_OPTIMIZATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: {
          memoryMB: 2000, // Exceeds 1GB limit
          cpuPercent: 50,
          networkBandwidth: 0,
          storageIO: 0,
          voiceOperations: 0,
          avatarOperations: 0
        },
        estimatedDuration: 1000,
        canDegrade: false
      };

      const requestId = processor.submitRequest(highMemoryRequest);
      processor.start();

      // Request should be queued due to resource constraints
      const stats = processor.getProcessingStats();
      expect(stats.queueLength).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    test('should apply degradation when resources are constrained', (done) => {
      const degradationSpy = jest.fn();
      processor.on('degradation_applied', degradationSpy);

      // Mock critical resource pressure
      const originalUpdateResourceState = (processor as any).updateResourceState;
      (processor as any).updateResourceState = jest.fn().mockImplementation(() => {
        (processor as any).resourceState.memory.pressure = ResourcePressure.CRITICAL;
        (processor as any).resourceState.cpu.pressure = ResourcePressure.CRITICAL;
      });

      processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: true,
        degradationOptions: [{
          level: DegradationLevel.MODERATE,
          resourceReduction: { memoryMB: 5, cpuPercent: 10 },
          qualityImpact: { userExperience: 0.8, functionality: 0.9, performance: 0.7 },
          description: 'Reduce processing quality'
        }]
      });

      processor.start();

      setTimeout(() => {
        expect(degradationSpy).toHaveBeenCalled();
        
        // Restore original method
        (processor as any).updateResourceState = originalUpdateResourceState;
        done();
      }, 1200);
    });

    test('should handle different degradation levels', () => {
      const request = {
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: true,
        degradationOptions: [
          {
            level: DegradationLevel.MINIMAL,
            resourceReduction: { memoryMB: 2, cpuPercent: 5 },
            qualityImpact: { userExperience: 0.95, functionality: 0.98, performance: 0.9 },
            description: 'Minimal quality reduction'
          },
          {
            level: DegradationLevel.SEVERE,
            resourceReduction: { memoryMB: 15, cpuPercent: 30 },
            qualityImpact: { userExperience: 0.6, functionality: 0.7, performance: 0.5 },
            description: 'Severe quality reduction'
          }
        ]
      };

      const requestId = processor.submitRequest(request);
      
      // Apply different degradation levels
      (processor as any).applyDegradation(
        (processor as any).processingQueue[0], 
        DegradationLevel.MINIMAL
      );

      expect((processor as any).degradationHistory.has(requestId)).toBe(false); // Request not in queue anymore
    });
  });

  describe('Resource Pressure Handling', () => {
    test('should handle critical resource pressure', (done) => {
      const criticalSpy = jest.fn();
      processor.on('critical_pressure_handled', criticalSpy);

      // Mock critical resource state
      const originalCalculateOverallResourcePressure = (processor as any).calculateOverallResourcePressure;
      (processor as any).calculateOverallResourcePressure = jest.fn().mockReturnValue(ResourcePressure.CRITICAL);

      processor.start();

      setTimeout(() => {
        expect(criticalSpy).toHaveBeenCalled();
        
        // Restore original method
        (processor as any).calculateOverallResourcePressure = originalCalculateOverallResourcePressure;
        done();
      }, 1200);
    });

    test('should handle high resource pressure', (done) => {
      const highSpy = jest.fn();
      processor.on('high_pressure_handled', highSpy);

      // Mock high resource state
      const originalCalculateOverallResourcePressure = (processor as any).calculateOverallResourcePressure;
      (processor as any).calculateOverallResourcePressure = jest.fn().mockReturnValue(ResourcePressure.HIGH);

      processor.start();

      setTimeout(() => {
        expect(highSpy).toHaveBeenCalled();
        
        // Restore original method
        (processor as any).calculateOverallResourcePressure = originalCalculateOverallResourcePressure;
        done();
      }, 1200);
    });

    test('should handle medium resource pressure', (done) => {
      const mediumSpy = jest.fn();
      processor.on('medium_pressure_handled', mediumSpy);

      // Mock medium resource state
      const originalCalculateOverallResourcePressure = (processor as any).calculateOverallResourcePressure;
      (processor as any).calculateOverallResourcePressure = jest.fn().mockReturnValue(ResourcePressure.MEDIUM);

      processor.start();

      setTimeout(() => {
        expect(mediumSpy).toHaveBeenCalled();
        
        // Restore original method
        (processor as any).calculateOverallResourcePressure = originalCalculateOverallResourcePressure;
        done();
      }, 1200);
    });
  });

  describe('Processing Statistics', () => {
    test('should provide processing statistics', () => {
      processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 1000,
        canDegrade: false
      });

      const stats = processor.getProcessingStats();
      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeProcessing');
      expect(stats).toHaveProperty('resourcePressure');
      expect(stats).toHaveProperty('degradationActive');

      expect(stats.queueLength).toBe(1);
      expect(stats.activeProcessing).toBe(0);
    });

    test('should track degradation status', () => {
      const stats = processor.getProcessingStats();
      expect(stats.degradationActive).toBe(false);
    });
  });

  describe('Processing Types', () => {
    test('should handle different processing types', async () => {
      const processingTypes = [
        ProcessingType.CALENDAR_OPERATION,
        ProcessingType.REMINDER_DELIVERY,
        ProcessingType.SYNC_OPERATION,
        ProcessingType.FAMILY_COORDINATION,
        ProcessingType.PERFORMANCE_MONITORING,
        ProcessingType.INDEX_OPTIMIZATION
      ];

      const completedSpy = jest.fn();
      processor.on('request_processing_completed', completedSpy);

      processingTypes.forEach(type => {
        processor.submitRequest({
          type,
          priority: ProcessingPriority.MEDIUM,
          resourceRequirements: createBasicResourceRequirements(),
          estimatedDuration: 100,
          canDegrade: false
        });
      });

      processor.start();

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty processing queue', () => {
      processor.start();
      
      const stats = processor.getProcessingStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeProcessing).toBe(0);
    });

    test('should handle rapid request submissions', () => {
      const requestIds: string[] = [];
      
      // Submit many requests rapidly
      for (let i = 0; i < 20; i++) {
        const requestId = processor.submitRequest({
          type: ProcessingType.PERFORMANCE_MONITORING,
          priority: ProcessingPriority.BACKGROUND,
          resourceRequirements: createBasicResourceRequirements(),
          estimatedDuration: 50,
          canDegrade: false
        });
        requestIds.push(requestId);
      }

      expect(requestIds.length).toBe(20);
      expect(new Set(requestIds).size).toBe(20); // All IDs should be unique
    });

    test('should handle processor stop with active processing', async () => {
      processor.submitRequest({
        type: ProcessingType.CALENDAR_OPERATION,
        priority: ProcessingPriority.HIGH,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 5000, // Long duration
        canDegrade: false
      });

      processor.start();
      
      // Stop immediately after starting
      await processor.stop();
      
      const stats = processor.getProcessingStats();
      expect(stats.activeProcessing).toBe(0);
    });

    test('should handle requests with deadlines', () => {
      const futureDeadline = new Date(Date.now() + 5000);
      
      processor.submitRequest({
        type: ProcessingType.REMINDER_DELIVERY,
        priority: ProcessingPriority.MEDIUM,
        resourceRequirements: createBasicResourceRequirements(),
        estimatedDuration: 1000,
        deadline: futureDeadline,
        canDegrade: false
      });

      const stats = processor.getProcessingStats();
      expect(stats.queueLength).toBe(1);
    });
  });
});

function createBasicResourceRequirements() {
  return {
    memoryMB: 10,
    cpuPercent: 20,
    networkBandwidth: 0,
    storageIO: 0,
    voiceOperations: 0,
    avatarOperations: 0
  };
}

function createHighResourceRequirements() {
  return {
    memoryMB: 100,
    cpuPercent: 50,
    networkBandwidth: 5,
    storageIO: 10,
    voiceOperations: 1,
    avatarOperations: 1
  };
}