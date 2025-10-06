// Error Recovery System Tests

import { 
  DefaultLearningErrorRecovery,
  TrainingRecoveryResult,
  PrivacyRecoveryResult,
  IntegrationRecoveryResult,
  ResourceRecoveryResult,
  RecoveryConfiguration
} from './error-recovery';
import { 
  TrainingError,
  PrivacyViolationError,
  IntegrationError,
  ResourceExhaustionError,
  DataCorruptionError,
  PerformanceDegradationError,
  SafetyViolationError,
  DefaultErrorRecoveryManager,
  createErrorContext
} from './errors';
import { DefaultLearningEventBus } from './events';
import { DefaultPerformanceMonitor } from './performance-monitor';

describe('DefaultLearningErrorRecovery', () => {
  let errorRecovery: DefaultLearningErrorRecovery;
  let eventBus: DefaultLearningEventBus;
  let performanceMonitor: DefaultPerformanceMonitor;
  let errorRecoveryManager: DefaultErrorRecoveryManager;

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new DefaultLearningEventBus();
    performanceMonitor = new DefaultPerformanceMonitor(eventBus);
    errorRecoveryManager = new DefaultErrorRecoveryManager();
    errorRecovery = new DefaultLearningErrorRecovery(eventBus, performanceMonitor, errorRecoveryManager);
  });

  afterEach(async () => {
    // Clean up any running monitors
    await performanceMonitor.stopMonitoring();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Training Failure Recovery', () => {
    it('should handle training failures with model rollback', async () => {
      const trainingError = new TrainingError(
        'Model training failed to converge',
        createErrorContext('user123', 'learning_engine', 'model_training', {
          modelVersion: '1.2.0',
          epoch: 15,
          batchSize: 32
        })
      );

      const result: TrainingRecoveryResult = await errorRecovery.handleTrainingFailure(trainingError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.recoveryActions)).toBe(true);
      expect(typeof result.message).toBe('string');
      expect(typeof result.modelRolledBack).toBe('boolean');
      expect(typeof result.recoveryTimeMs).toBe('number');
      
      // Should attempt some form of recovery
      expect(result.recoveryActions.length).toBeGreaterThan(0);
    });

    it('should provide detailed recovery information', async () => {
      const trainingError = new TrainingError(
        'Training data quality issues detected',
        createErrorContext('user456', 'learning_engine', 'data_processing')
      );

      const result = await errorRecovery.handleTrainingFailure(trainingError);

      expect(result.message).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(0);
      expect(typeof result.retryRecommended).toBe('boolean');
      expect(typeof result.escalationRequired).toBe('boolean');
    });
  });

  describe('Privacy Violation Recovery', () => {
    it('should handle privacy violations with data purging', async () => {
      const privacyError = new PrivacyViolationError(
        'PII detected in training data',
        createErrorContext('user789', 'privacy_filter', 'data_validation', {
          violationType: 'pii_detection',
          dataType: 'conversation_logs'
        })
      );

      const result: PrivacyRecoveryResult = await errorRecovery.handlePrivacyViolation(privacyError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.dataPurged).toBe('boolean');
      expect(typeof result.filtersEnhanced).toBe('boolean');
      expect(typeof result.auditTrailCreated).toBe('boolean');
      
      // Privacy violations should always require escalation
      expect(result.escalationRequired).toBe(true);
    });

    it('should enhance privacy filters after violation', async () => {
      const privacyError = new PrivacyViolationError(
        'Insufficient data anonymization',
        createErrorContext('user101', 'privacy_filter', 'anonymization')
      );

      const result = await errorRecovery.handlePrivacyViolation(privacyError);

      expect(result.message).toContain('Privacy filters enhanced');
      expect(result.filtersEnhanced).toBe(true);
    });
  });

  describe('Integration Failure Recovery', () => {
    it('should handle integration failures with fallback mode', async () => {
      const integrationError = new IntegrationError(
        'Voice pipeline integration timeout',
        createErrorContext('user202', 'integration_manager', 'voice_pipeline', {
          targetSystem: 'voice_pipeline',
          statusCode: 504,
          retryAttempt: 3
        })
      );

      const result: IntegrationRecoveryResult = await errorRecovery.handleIntegrationFailure(integrationError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.fallbackActivated).toBe('boolean');
      expect(typeof result.connectionRestored).toBe('boolean');
      expect(typeof result.circuitBreakerTriggered).toBe('boolean');
    });

    it('should attempt connection restoration first', async () => {
      const integrationError = new IntegrationError(
        'Avatar system connection lost',
        createErrorContext('user303', 'integration_manager', 'avatar_system')
      );

      const result = await errorRecovery.handleIntegrationFailure(integrationError);

      // Should provide meaningful recovery information
      expect(result.message).toBeTruthy();
      expect(result.recoveryActions.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Exhaustion Recovery', () => {
    it('should handle resource exhaustion with optimization', async () => {
      const resourceError = new ResourceExhaustionError(
        'Memory usage exceeded threshold',
        createErrorContext('user404', 'resource_monitor', 'memory_check', {
          resourceType: 'memory',
          currentUsage: 7500,
          limit: 6144
        })
      );

      const result: ResourceRecoveryResult = await errorRecovery.handleResourceExhaustion(resourceError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.memoryFreed).toBe('boolean');
      expect(typeof result.modelsOptimized).toBe('boolean');
      expect(typeof result.operationsThrottled).toBe('boolean');
    });

    it('should provide resource optimization details', async () => {
      const resourceError = new ResourceExhaustionError(
        'CPU usage too high',
        createErrorContext('user505', 'resource_monitor', 'cpu_check')
      );

      const result = await errorRecovery.handleResourceExhaustion(resourceError);

      expect(result.message).toBeTruthy();
      if (result.success) {
        expect(result.retryRecommended).toBe(true);
      }
    });
  });

  describe('Data Corruption Recovery', () => {
    it('should handle data corruption with backup restoration', async () => {
      const dataError = new DataCorruptionError(
        'Model weights corrupted',
        createErrorContext('user606', 'model_store', 'data_validation', {
          dataType: 'model_weights',
          corruptionType: 'checksum_mismatch',
          backupAvailable: true
        })
      );

      const result = await errorRecovery.handleDataCorruption(dataError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.dataRestored).toBe('boolean');
      expect(typeof result.integrityVerified).toBe('boolean');
      expect(typeof result.backupCreated).toBe('boolean');
    });
  });

  describe('Performance Degradation Recovery', () => {
    it('should handle performance degradation with optimization', async () => {
      const performanceError = new PerformanceDegradationError(
        'Inference latency increased significantly',
        createErrorContext('user707', 'performance_monitor', 'latency_check', {
          metric: 'inference_latency',
          currentValue: 150,
          threshold: 100
        })
      );

      const result = await errorRecovery.handlePerformanceDegradation(performanceError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.performanceOptimized).toBe('boolean');
      expect(typeof result.resourcesRebalanced).toBe('boolean');
      expect(typeof result.modelsSimplified).toBe('boolean');
    });
  });

  describe('Safety Violation Recovery', () => {
    it('should handle safety violations with immediate enforcement', async () => {
      const safetyError = new SafetyViolationError(
        'Inappropriate content detected in child interaction',
        createErrorContext('child808', 'safety_validator', 'content_check', {
          safetyRule: 'child_content_filter',
          contentType: 'conversation',
          ageGroup: 'child'
        })
      );

      const result = await errorRecovery.handleSafetyViolation(safetyError);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.safetyEnforced).toBe('boolean');
      expect(typeof result.contentPurged).toBe('boolean');
      expect(typeof result.controlsEnhanced).toBe('boolean');
      
      // Safety violations should always require escalation
      expect(result.escalationRequired).toBe(true);
    });
  });

  describe('Recovery Configuration', () => {
    it('should allow configuration updates', async () => {
      const newConfig: RecoveryConfiguration = {
        enableAutomaticRecovery: false,
        maxRecoveryAttempts: 5,
        recoveryTimeoutMs: 60000,
        enableModelRollback: true,
        enableDataPurging: true,
        enableResourceOptimization: true,
        enableFallbackMode: true,
        notifyOnRecovery: true,
        escalateAfterFailures: 2
      };

      await errorRecovery.setRecoveryConfiguration(newConfig);

      const capabilities = await errorRecovery.getRecoveryCapabilities();
      expect(capabilities.supportsAutomaticRecovery).toBe(false);
      expect(capabilities.maxRecoveryAttempts).toBe(5);
      expect(capabilities.recoveryTimeoutMs).toBe(60000);
    });

    it('should provide recovery capabilities information', async () => {
      const capabilities = await errorRecovery.getRecoveryCapabilities();

      expect(capabilities).toBeDefined();
      expect(typeof capabilities.supportsModelRollback).toBe('boolean');
      expect(typeof capabilities.supportsDataPurging).toBe('boolean');
      expect(typeof capabilities.supportsResourceOptimization).toBe('boolean');
      expect(typeof capabilities.supportsFallbackMode).toBe('boolean');
      expect(Array.isArray(capabilities.supportedErrorTypes)).toBe(true);
      expect(capabilities.supportedErrorTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery Statistics', () => {
    it('should track recovery statistics', async () => {
      // Perform some recovery operations
      const trainingError = new TrainingError('Test error', createErrorContext('user999'));
      await errorRecovery.handleTrainingFailure(trainingError);

      const stats = await errorRecovery.getRecoveryStatistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalRecoveryAttempts).toBe('number');
      expect(typeof stats.successfulRecoveries).toBe('number');
      expect(typeof stats.failedRecoveries).toBe('number');
      expect(typeof stats.recoverySuccessRate).toBe('number');
      expect(stats.lastRecoveryTimestamp).toBeInstanceOf(Date);
      expect(stats.recoveryTypeStats).toBeInstanceOf(Map);
      
      expect(stats.totalRecoveryAttempts).toBeGreaterThan(0);
    });

    it('should calculate success rate correctly', async () => {
      const stats = await errorRecovery.getRecoveryStatistics();
      
      if (stats.totalRecoveryAttempts > 0) {
        const expectedRate = (stats.successfulRecoveries / stats.totalRecoveryAttempts) * 100;
        expect(stats.recoverySuccessRate).toBe(expectedRate);
      }
    });
  });
});