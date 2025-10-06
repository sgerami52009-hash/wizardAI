/**
 * Tests for comprehensive error handling and recovery mechanisms
 */

import {
  ErrorRecoveryManager,
  RecoveryResult
} from './error-recovery-manager';
import {
  GenerationError,
  ContextError,
  LearningError,
  IntegrationError,
  HardwareConstraintError,
  ErrorCategory,
  ErrorSeverity
} from './error-types';
import { UserContext } from '../types';
import { RecommendationType } from '../enums';

describe('ErrorRecoveryManager', () => {
  let errorRecoveryManager: ErrorRecoveryManager;
  let mockUserContext: UserContext;
  let mockOriginalRequest: any;

  beforeEach(() => {
    errorRecoveryManager = new ErrorRecoveryManager();
    
    mockUserContext = {
      userId: 'test-user',
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        weather: {
          temperature: 22,
          condition: 'sunny',
          humidity: 45,
          windSpeed: 10,
          uvIndex: 5
        },
        indoorOutdoor: 'indoor'
      },
      activity: {
        currentActivity: 'leisure',
        activityType: 'entertainment' as any,
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + 30 * 60 * 1000),
        interruptible: true
      },
      availability: {
        freeTime: [{ start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }],
        busyTime: [],
        flexibleTime: [],
        energyLevel: { level: 'high', trend: 'stable' }
      },
      mood: {
        detected: 'happy',
        confidence: 0.6,
        source: 'interaction'
      },
      energy: { level: 'high', trend: 'stable' },
      social: {
        familyMembersPresent: ['family'],
        socialSetting: 'family',
        groupActivity: false
      },
      environmental: {
        weather: {
          temperature: 22,
          condition: 'sunny',
          humidity: 45,
          windSpeed: 10,
          uvIndex: 5
        },
        timeOfDay: 'afternoon',
        season: 'summer',
        dayOfWeek: 'Monday',
        isHoliday: false
      },
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'high',
          aloneTime: 'medium',
          groupActivities: 'preferred'
        }
      }
    };

    mockOriginalRequest = {
      type: RecommendationType.ACTIVITY,
      userId: 'test-user',
      preferences: {}
    };
  });

  describe('Generation Error Handling', () => {
    it('should handle model failure with fallback recommendations', async () => {
      const error = new GenerationError(
        'ML model failed to generate recommendations',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { modelStatus: 'failed' }
        },
        'activity-model'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.length).toBeGreaterThan(0);
      expect(result.qualityLevel).toBe('reduced');
      expect(result.retryable).toBe(true);
    });

    it('should handle non-recoverable generation errors', async () => {
      const error = new GenerationError(
        'Critical model corruption',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { modelStatus: 'corrupted' }
        }
      );
      // Override fallback availability
      (error as any).fallbackAvailable = false;

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(false);
      expect(result.errorHandled).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.retryable).toBe(false);
    });
  });

  describe('Context Error Handling', () => {
    it('should recover context and provide recommendations', async () => {
      const error = new ContextError(
        'Location sensor failure',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { sensorStatus: 'failed' }
        },
        'location'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.retryable).toBe(true);
    });

    it('should handle complete sensor failure', async () => {
      const error = new ContextError(
        'All sensors offline',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { sensorStatus: 'all_offline' }
        },
        'all_sensors'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.limitations).toContain('Context analysis failed');
    });
  });

  describe('Learning Error Handling', () => {
    it('should handle learning system failure', async () => {
      const error = new LearningError(
        'Model training failed',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { learningStatus: 'failed' }
        },
        'user-preference-model'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.retryable).toBe(false); // Learning errors need intervention
      expect(result.limitations).toContain('Learning system unavailable');
    });
  });

  describe('Integration Error Handling', () => {
    it('should handle voice integration failure', async () => {
      const error = new IntegrationError(
        'Voice pipeline disconnected',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { voiceStatus: 'disconnected' }
        },
        'voice-pipeline'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.recommendations).toBeDefined();
      
      // Recommendations should be marked as non-actionable
      result.recommendations!.forEach(rec => {
        expect(rec.actionable).toBe(false);
        expect((rec.metadata as any).integrationLimited).toBe(true);
      });
      
      expect(result.limitations).toContain('Integration with voice-pipeline unavailable');
    });
  });

  describe('Hardware Constraint Error Handling', () => {
    it('should handle memory constraint errors', async () => {
      const error = new HardwareConstraintError(
        'Memory usage exceeded limit',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { memoryUsage: 1600 }, // MB
          memoryUsage: 1600
        },
        'memory'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.errorHandled).toBe(true);
      expect(result.qualityLevel).toBe('minimal');
      expect(result.recommendations!.length).toBeLessThanOrEqual(2); // Limited recommendations
      expect(result.retryable).toBe(false); // Hardware errors need intervention
      expect(result.limitations).toContain('Hardware constraint: memory');
    });

    it('should handle CPU constraint errors', async () => {
      const error = new HardwareConstraintError(
        'CPU usage too high',
        {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { cpuUsage: 95 }
        },
        'cpu'
      );

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        mockOriginalRequest
      );

      expect(result.success).toBe(true);
      expect(result.limitations).toContain('Hardware constraint: cpu');
    });
  });

  describe('Error Metrics', () => {
    it('should track error metrics correctly', async () => {
      const errors = [
        new GenerationError('Test error 1', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        }),
        new ContextError('Test error 2', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        }),
        new GenerationError('Test error 3', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        })
      ];

      for (const error of errors) {
        await errorRecoveryManager.handleError(
          error,
          'test-user',
          mockUserContext,
          mockOriginalRequest
        );
      }

      const metrics = errorRecoveryManager.getErrorMetrics();
      
      expect(metrics.errorCount).toBe(3);
      expect(metrics.errorsByCategory[ErrorCategory.RECOMMENDATION_GENERATION]).toBe(2);
      expect(metrics.errorsByCategory[ErrorCategory.CONTEXT_ANALYSIS]).toBe(1);
      expect(metrics.recoverySuccessRate).toBeGreaterThan(0);
      expect(metrics.averageRecoveryTime).toBeGreaterThan(0);
    });

    it('should clear metrics correctly', () => {
      errorRecoveryManager.clearMetrics();
      const metrics = errorRecoveryManager.getErrorMetrics();
      
      expect(metrics.errorCount).toBe(0);
      expect(metrics.recoverySuccessRate).toBe(0);
      expect(metrics.averageRecoveryTime).toBe(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide progressively simpler recommendations under multiple failures', async () => {
      // Simulate cascade of failures
      const errors = [
        new LearningError('Learning failed', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        }),
        new ContextError('Context failed', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        }),
        new HardwareConstraintError('Memory low', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: {}
        }, 'memory')
      ];

      const results: RecoveryResult[] = [];
      
      for (const error of errors) {
        const result = await errorRecoveryManager.handleError(
          error,
          'test-user',
          mockUserContext,
          mockOriginalRequest
        );
        results.push(result);
      }

      // Each failure should still provide some recommendations
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations!.length).toBeGreaterThan(0);
      });

      // Quality should degrade with hardware constraints
      const hardwareResult = results[2];
      expect(hardwareResult.qualityLevel).toBe('minimal');
      expect(hardwareResult.recommendations!.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Recovery Strategy Selection', () => {
    it('should select appropriate recovery strategy based on error type', async () => {
      const testCases = [
        {
          error: new GenerationError('Model failed', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          }),
          expectedFallback: true,
          expectedRetryable: true
        },
        {
          error: new LearningError('Training failed', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          }),
          expectedFallback: true,
          expectedRetryable: false
        },
        {
          error: new HardwareConstraintError('Memory exceeded', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          }),
          expectedFallback: true,
          expectedRetryable: false
        }
      ];

      for (const testCase of testCases) {
        const result = await errorRecoveryManager.handleError(
          testCase.error,
          'test-user',
          mockUserContext,
          mockOriginalRequest
        );

        expect(result.fallbackUsed).toBe(testCase.expectedFallback);
        expect(result.retryable).toBe(testCase.expectedRetryable);
      }
    });
  });
});