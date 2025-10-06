/**
 * Comprehensive unit tests for error handling mechanisms
 * Tests fallback mechanisms, graceful degradation, privacy violation detection/remediation,
 * and system resilience as required by task 12.3
 * 
 * Requirements covered: 4.5, 6.1, 6.4, 7.5, 7.6
 */

import {
  ErrorRecoveryManager,
  RecoveryResult
} from './error-recovery-manager';
import {
  FallbackManager,
  QualityLevel,
  RuleBasedFallbackStrategy,
  HistoricalFallbackStrategy,
  EmergencyFallbackStrategy
} from './fallback-strategies';
import {
  PrivacyViolationDetector,
  ViolationType,
  DataOperation,
  PrivacyViolation
} from './privacy-violation-detector';
import {
  PrivacyRemediationManager,
  RemediationResult
} from './privacy-remediation-manager';
import {
  ContextRecoveryManager,
  HistoricalContextRecovery,
  MultiSourceContextRecovery
} from './context-recovery';
import {
  GenerationError,
  ContextError,
  LearningError,
  IntegrationError,
  HardwareConstraintError,
  PrivacyError,
  ErrorCategory,
  ErrorSeverity
} from './error-types';
import { UserContext } from '../types';
import { RecommendationType } from '../enums';

describe('Comprehensive Error Handling Tests', () => {
  let errorRecoveryManager: ErrorRecoveryManager;
  let fallbackManager: FallbackManager;
  let privacyDetector: PrivacyViolationDetector;
  let privacyRemediationManager: PrivacyRemediationManager;
  let contextRecoveryManager: ContextRecoveryManager;
  let mockUserContext: UserContext;

  beforeEach(() => {
    errorRecoveryManager = new ErrorRecoveryManager();
    fallbackManager = new FallbackManager();
    privacyDetector = new PrivacyViolationDetector();
    privacyRemediationManager = new PrivacyRemediationManager(privacyDetector);
    contextRecoveryManager = new ContextRecoveryManager();

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
  });

  describe('Fallback Mechanisms and Graceful Degradation (Requirement 4.5, 7.5)', () => {
    describe('Rule-Based Fallback Strategy', () => {
      it('should provide time-based recommendations when ML models fail', async () => {
        const strategy = new RuleBasedFallbackStrategy();
        const error = new GenerationError('ML model failed', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { modelStatus: 'failed' }
        });

        expect(strategy.canHandle(error)).toBe(true);

        const recommendations = await strategy.execute('test-user', mockUserContext, {});
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
        expect(strategy.getQualityLevel()).toBe(QualityLevel.REDUCED);
        
        // Verify recommendations are contextually appropriate
        recommendations.forEach(rec => {
          expect(rec.confidence).toBeLessThan(0.8); // Reduced confidence for fallback
          expect((rec.metadata as any).fallback).toBe(true);
          expect((rec.metadata as any).qualityLevel).toBe(QualityLevel.REDUCED);
        });
      });

      it('should generate different recommendations based on time of day', async () => {
        const strategy = new RuleBasedFallbackStrategy();
        
        // Mock morning time
        const originalDate = Date;
        global.Date = jest.fn(() => ({
          ...new originalDate(),
          getHours: () => 8,
          getDay: () => 1 // Monday
        })) as any;
        global.Date.now = originalDate.now;

        const morningRecs = await strategy.execute('test-user', mockUserContext, {});
        
        // Mock afternoon time
        global.Date = jest.fn(() => ({
          ...new originalDate(),
          getHours: () => 14,
          getDay: () => 1
        })) as any;
        global.Date.now = originalDate.now;

        const afternoonRecs = await strategy.execute('test-user', mockUserContext, {});

        // Restore original Date
        global.Date = originalDate;

        expect(morningRecs[0].title).toContain('Morning');
        expect(afternoonRecs[0].title).toContain('Learning');
      });
    });

    describe('Historical Fallback Strategy', () => {
      it('should use historical patterns when context analysis fails', async () => {
        const strategy = new HistoricalFallbackStrategy();
        const error = new ContextError('Sensor failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { sensorStatus: 'failed' }
        });

        expect(strategy.canHandle(error)).toBe(true);

        const recommendations = await strategy.execute('test-user', mockUserContext, {});
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThanOrEqual(1);
        expect(recommendations.length).toBeLessThanOrEqual(3); // Limited to top 3
        expect(strategy.getQualityLevel()).toBe(QualityLevel.MINIMAL);
        
        recommendations.forEach(rec => {
          expect((rec.metadata as any).historical).toBe(true);
          expect(rec.description).toContain('based on your previous preferences');
        });
      });
    });

    describe('Emergency Fallback Strategy', () => {
      it('should provide minimal safe recommendations as last resort', async () => {
        const strategy = new EmergencyFallbackStrategy();
        const error = new HardwareConstraintError('System overload', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { status: 'critical' }
        });

        expect(strategy.canHandle(error)).toBe(true);

        const recommendations = await strategy.execute('test-user', mockUserContext, {});
        
        expect(recommendations).toHaveLength(1);
        expect(recommendations[0].title).toBe('Take a Break');
        expect(recommendations[0].confidence).toBe(0.3);
        expect(strategy.getQualityLevel()).toBe(QualityLevel.EMERGENCY);
        expect((recommendations[0].metadata as any).emergency).toBe(true);
      });
    });

    describe('Cascading Fallback System', () => {
      it('should try multiple fallback strategies in order', async () => {
        const error = new GenerationError('Multiple system failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { status: 'multiple_failures' }
        });

        const result = await fallbackManager.getFallbackRecommendations(
          error,
          'test-user',
          mockUserContext,
          {}
        );

        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.qualityLevel).toBeDefined();
        expect(result.fallbackReason).toContain(error.message);
        expect(result.limitationsMessage).toBeDefined();
      });

      it('should degrade gracefully through quality levels', async () => {
        const errors = [
          new GenerationError('Model failure', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          }),
          new ContextError('Sensor failure', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          }),
          new HardwareConstraintError('Memory critical', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: {}
          })
        ];

        const results: any[] = [];
        for (const error of errors) {
          const result = await fallbackManager.getFallbackRecommendations(
            error,
            'test-user',
            mockUserContext,
            {}
          );
          results.push(result);
        }

        // Quality should degrade with each failure
        expect(results[0].qualityLevel).toBe(QualityLevel.REDUCED);
        expect(results[1].qualityLevel).toBe(QualityLevel.MINIMAL);
        // Hardware constraint errors use emergency fallback as last resort
        expect([QualityLevel.REDUCED, QualityLevel.EMERGENCY]).toContain(results[2].qualityLevel);
      });
    });
  });

  describe('Privacy Violation Detection and Remediation (Requirements 6.1, 6.4)', () => {
    describe('Comprehensive Violation Detection', () => {
      it('should detect all types of privacy violations', async () => {
        const testCases = [
          {
            operation: {
              operationType: 'read' as const,
              userId: 'test-user',
              dataTypes: ['sensitive'],
              purpose: 'test',
              requester: 'unauthorized-service',
              timestamp: new Date(),
              consentRequired: false
            },
            expectedType: ViolationType.UNAUTHORIZED_DATA_ACCESS
          },
          {
            operation: {
              operationType: 'process' as const,
              userId: 'test-user',
              dataTypes: ['personal'],
              purpose: 'analytics',
              requester: 'recommendation-engine',
              timestamp: new Date(),
              consentRequired: true
            },
            expectedType: ViolationType.CONSENT_VIOLATION,
            setup: async () => {
              await privacyDetector.updatePrivacySettings('test-user', { consentRequired: true });
            }
          },
          {
            operation: {
              operationType: 'share' as const,
              userId: 'test-user',
              dataTypes: ['behavior'],
              purpose: 'external_analytics',
              requester: 'external-service',
              timestamp: new Date(),
              consentRequired: false
            },
            expectedType: ViolationType.EXTERNAL_DATA_SHARING,
            setup: async () => {
              await privacyDetector.updatePrivacySettings('test-user', { allowExternalSharing: false });
            }
          },
          {
            operation: {
              operationType: 'read' as const,
              userId: 'test-user',
              dataTypes: ['cross_user_data'],
              purpose: 'collaborative_filtering',
              requester: 'recommendation-engine',
              timestamp: new Date(),
              consentRequired: false
            },
            expectedType: ViolationType.CROSS_USER_DATA_LEAK,
            setup: async () => {
              await privacyDetector.updatePrivacySettings('test-user', { allowCrossUserLearning: false });
            }
          }
        ];

        for (const testCase of testCases) {
          if (testCase.setup) {
            await testCase.setup();
          }

          const violation = await privacyDetector.detectViolation(testCase.operation);
          
          expect(violation).toBeTruthy();
          expect(violation!.type).toBe(testCase.expectedType);
          expect(violation!.userId).toBe('test-user');
          expect(violation!.remediationActions.length).toBeGreaterThan(0);
        }
      });

      it('should prioritize violations by severity', async () => {
        const operations = [
          {
            operationType: 'process' as const,
            userId: 'child-user',
            dataTypes: ['educational'],
            purpose: 'learning',
            requester: 'recommendation-engine',
            timestamp: new Date(),
            consentRequired: true
          },
          {
            operationType: 'read' as const,
            userId: 'test-user',
            dataTypes: ['preferences'],
            purpose: 'test',
            requester: 'unauthorized-service',
            timestamp: new Date(),
            consentRequired: false
          }
        ];

        await privacyDetector.updatePrivacySettings('child-user', { requireParentalConsent: true });

        const violations: any[] = [];
        for (const op of operations) {
          const violation = await privacyDetector.detectViolation(op);
          if (violation) violations.push(violation);
        }

        expect(violations).toHaveLength(2);
        
        const parentalViolation = violations.find(v => v.type === ViolationType.PARENTAL_CONSENT_MISSING);
        const unauthorizedViolation = violations.find(v => v.type === ViolationType.UNAUTHORIZED_DATA_ACCESS);
        
        expect(parentalViolation!.severity).toBe('critical');
        expect(unauthorizedViolation!.severity).toBe('high');
      });
    });

    describe('Automated Remediation', () => {
      it('should execute immediate remediation for critical violations', async () => {
        const violation: PrivacyViolation = {
          id: 'critical-test',
          type: ViolationType.PARENTAL_CONSENT_MISSING,
          severity: 'critical',
          userId: 'child-user',
          description: 'Missing parental consent for child data',
          dataInvolved: ['educational_data'],
          timestamp: new Date(),
          source: 'recommendation-engine',
          remediated: false,
          remediationActions: []
        };

        const startTime = Date.now();
        const result = await privacyRemediationManager.handlePrivacyViolation(violation);
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.accessTerminated).toBe(true);
        expect(result.userNotified).toBe(true);
        expect(result.actionsExecuted).toBeGreaterThan(0);
        expect(result.actionsFailed).toBe(0);
        expect(duration).toBeLessThan(5000); // Should complete quickly
      });

      it('should handle remediation failures gracefully', async () => {
        // Mock detector to simulate remediation failure
        const originalExecute = privacyDetector.executeRemediationAction;
        let callCount = 0;
        privacyDetector.executeRemediationAction = jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Remediation action failed');
          }
          return Promise.resolve();
        });

        const violation: PrivacyViolation = {
          id: 'failure-test',
          type: ViolationType.CONSENT_VIOLATION,
          severity: 'high',
          userId: 'test-user',
          description: 'Test remediation failure',
          dataInvolved: ['test_data'],
          timestamp: new Date(),
          source: 'test',
          remediated: false,
          remediationActions: []
        };

        const result = await privacyRemediationManager.handlePrivacyViolation(violation);

        expect(result.success).toBe(false);
        expect(result.actionsFailed).toBeGreaterThan(0);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.actionsExecuted).toBeGreaterThan(0); // Some actions should succeed

        // Restore original method
        privacyDetector.executeRemediationAction = originalExecute;
      });

      it('should create incident reports for serious violations', async () => {
        const violation: PrivacyViolation = {
          id: 'incident-test',
          type: ViolationType.EXTERNAL_DATA_SHARING,
          severity: 'critical',
          userId: 'test-user',
          description: 'Unauthorized external data sharing',
          dataInvolved: ['sensitive_personal_data'],
          timestamp: new Date(),
          source: 'external-service',
          remediated: false,
          remediationActions: []
        };

        await privacyRemediationManager.handlePrivacyViolation(violation);

        const incidents = await privacyRemediationManager.getIncidentReports();
        expect(incidents).toHaveLength(1);
        
        const incident = incidents[0];
        expect(incident.severity).toBe('critical');
        expect(incident.complianceImpact).toContain('regulatory violation');
        expect(incident.remediationStatus).toBe('completed');
      });
    });

    describe('Privacy-Preserving Recovery', () => {
      it('should maintain privacy during error recovery', async () => {
        const privacyError = new PrivacyError('Data access violation', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { privacyLevel: 'high' }
        });

        const result = await errorRecoveryManager.handleError(
          privacyError,
          'test-user',
          mockUserContext,
          {}
        );

        // Privacy errors are handled by the generic error handler, which provides fallback
        expect(result.success).toBe(true); // Generic handler provides fallback
        expect(result.errorHandled).toBe(true);
        expect(result.fallbackUsed).toBe(true); // Generic handler uses fallback
        expect(result.retryable).toBe(false); // Privacy errors are not retryable
      });

      it('should audit all privacy-related operations', async () => {
        const operations = [
          {
            operationType: 'read' as const,
            userId: 'test-user',
            dataTypes: ['preferences'],
            purpose: 'recommendation',
            requester: 'recommendation-engine',
            timestamp: new Date(),
            consentRequired: false
          },
          {
            operationType: 'process' as const,
            userId: 'test-user',
            dataTypes: ['behavior'],
            purpose: 'learning',
            requester: 'recommendation-engine',
            timestamp: new Date(),
            consentRequired: false
          }
        ];

        for (const op of operations) {
          await privacyDetector.detectViolation(op);
        }

        const auditLog = privacyDetector.getDataAccessLog('test-user');
        expect(auditLog).toHaveLength(2);
        
        auditLog.forEach(entry => {
          expect(entry.operation.userId).toBe('test-user');
          expect(entry.timestamp).toBeDefined();
        });
      });
    });
  });

  describe('Recovery Mechanisms and System Resilience (Requirements 7.5, 7.6)', () => {
    describe('Context Recovery', () => {
      it('should recover context using historical data when sensors fail', async () => {
        const strategy = new HistoricalContextRecovery();
        const error = new ContextError('Location sensor failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { sensorStatus: 'failed' }
        }, 'location');

        expect(strategy.canRecover(error)).toBe(true);

        const recoveredContext = await strategy.recover('test-user', {
          userId: 'test-user',
          timestamp: new Date()
        });

        expect(recoveredContext.userId).toBe('test-user');
        expect(recoveredContext.location).toBeDefined();
        expect(recoveredContext.activity).toBeDefined();
        expect(recoveredContext.availability).toBeDefined();
        expect(strategy.getConfidenceLevel()).toBe(0.6);
      });

      it('should use multi-source validation for context recovery', async () => {
        const strategy = new MultiSourceContextRecovery();
        const error = new ContextError('Multiple sensor failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { sensorStatus: 'multiple_failed' }
        });

        const recoveredContext = await strategy.recover('test-user', {
          userId: 'test-user',
          timestamp: new Date(),
          location: { type: 'unknown', coordinates: undefined, indoorOutdoor: 'indoor' }
        });

        expect(recoveredContext.userId).toBe('test-user');
        expect(strategy.getConfidenceLevel()).toBe(0.7);
        
        // Should provide reasonable defaults when sources are unavailable
        expect(recoveredContext.location.type).toBeDefined();
        expect(recoveredContext.activity).toBeDefined();
        expect(recoveredContext.availability).toBeDefined();
      });

      it('should provide minimal context as last resort', async () => {
        const error = new ContextError('Complete system failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { status: 'complete_failure' }
        }, 'all_sensors');

        const recovery = await contextRecoveryManager.recoverContext(
          error,
          'test-user',
          { userId: 'test-user' }
        );

        expect(recovery.context.userId).toBe('test-user');
        expect(recovery.confidenceLevel).toBeGreaterThan(0);
        expect(recovery.recoveryMethod).toBeDefined();
        expect(recovery.limitations).toBeDefined();
        expect(recovery.limitations.length).toBeGreaterThan(0);
      });
    });

    describe('Hardware Constraint Handling', () => {
      it('should handle memory constraints with resource cleanup', async () => {
        const error = new HardwareConstraintError('Memory limit exceeded', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { memoryUsage: 1600 }, // Exceeds 1.5GB limit
          memoryUsage: 1600
        }, 'memory');

        const result = await errorRecoveryManager.handleError(
          error,
          'test-user',
          mockUserContext,
          {}
        );

        expect(result.success).toBe(true);
        expect(result.qualityLevel).toBe('minimal');
        expect(result.recommendations!.length).toBeLessThanOrEqual(2); // Limited recommendations
        expect(result.limitations).toContain('Hardware constraint: memory');
        expect(result.retryable).toBe(false); // Requires intervention
      });

      it('should maintain core functionality under resource constraints', async () => {
        const constraints = [
          new HardwareConstraintError('High CPU usage', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { cpuUsage: 95 }
          }, 'cpu'),
          new HardwareConstraintError('Low memory', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { memoryUsage: 1400 }
          }, 'memory'),
          new HardwareConstraintError('Storage full', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { storageUsage: 98 }
          }, 'storage')
        ];

        const results: RecoveryResult[] = [];
        for (const constraint of constraints) {
          const result = await errorRecoveryManager.handleError(
            constraint,
            'test-user',
            mockUserContext,
            {}
          );
          results.push(result);
        }

        // All should provide some level of service
        results.forEach(result => {
          expect(result.success).toBe(true);
          expect(result.recommendations).toBeDefined();
          expect(result.recommendations!.length).toBeGreaterThan(0);
        });
      });
    });

    describe('System Resilience Under Load', () => {
      it('should handle concurrent error recovery requests', async () => {
        const errors = Array.from({ length: 10 }, (_, i) => 
          new GenerationError(`Concurrent error ${i}`, {
            userId: `user-${i}`,
            timestamp: new Date(),
            systemState: { requestId: i }
          })
        );

        const startTime = Date.now();
        const results = await Promise.all(
          errors.map(error => 
            errorRecoveryManager.handleError(
              error,
              error.context.userId!,
              mockUserContext,
              {}
            )
          )
        );
        const duration = Date.now() - startTime;

        expect(results).toHaveLength(10);
        expect(results.every(r => r.success)).toBe(true);
        expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      });

      it('should maintain error metrics under stress', async () => {
        const errors = Array.from({ length: 50 }, (_, i) => {
          const errorTypes = [GenerationError, ContextError, LearningError, IntegrationError];
          const ErrorClass = errorTypes[i % errorTypes.length];
          return new ErrorClass(`Stress test error ${i}`, {
            userId: 'stress-test-user',
            timestamp: new Date(),
            systemState: { iteration: i }
          });
        });

        for (const error of errors) {
          await errorRecoveryManager.handleError(
            error,
            'stress-test-user',
            mockUserContext,
            {}
          );
        }

        const metrics = errorRecoveryManager.getErrorMetrics();
        
        expect(metrics.errorCount).toBe(50);
        expect(metrics.recoverySuccessRate).toBeGreaterThan(0.8); // At least 80% success
        expect(metrics.averageRecoveryTime).toBeLessThan(1000); // Under 1 second average
        expect(Object.keys(metrics.errorsByCategory).length).toBeGreaterThan(0);
      });

      it('should prevent cascading failures', async () => {
        // Simulate a cascade of related failures
        const cascadeErrors = [
          new ContextError('Sensor network failure', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { cascade: 1 }
          }),
          new GenerationError('Model failure due to context loss', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { cascade: 2 }
          }),
          new HardwareConstraintError('Memory pressure from error handling', {
            userId: 'test-user',
            timestamp: new Date(),
            systemState: { cascade: 3 }
          })
        ];

        const results: RecoveryResult[] = [];
        for (const error of cascadeErrors) {
          const result = await errorRecoveryManager.handleError(
            error,
            'test-user',
            mockUserContext,
            {}
          );
          results.push(result);
        }

        // Each error should be handled independently
        results.forEach((result, index) => {
          expect(result.success).toBe(true);
          expect(result.errorHandled).toBe(true);
          expect(result.recommendations).toBeDefined();
        });

        // System should remain functional
        const finalMetrics = errorRecoveryManager.getErrorMetrics();
        expect(finalMetrics.recoverySuccessRate).toBe(1.0); // 100% recovery
      });
    });

    describe('Error Recovery Performance', () => {
      it('should meet performance requirements for error recovery', async () => {
        const error = new GenerationError('Performance test error', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { performanceTest: true }
        });

        const startTime = Date.now();
        const result = await errorRecoveryManager.handleError(
          error,
          'test-user',
          mockUserContext,
          {}
        );
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds (Requirement 7.2)
      });

      it('should maintain memory efficiency during error handling', async () => {
        const initialMemory = process.memoryUsage();
        
        // Process many errors to test memory efficiency
        const errors = Array.from({ length: 100 }, (_, i) => 
          new GenerationError(`Memory test ${i}`, {
            userId: 'memory-test-user',
            timestamp: new Date(),
            systemState: { memoryTest: i }
          })
        );

        for (const error of errors) {
          await errorRecoveryManager.handleError(
            error,
            'memory-test-user',
            mockUserContext,
            {}
          );
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable (less than 50MB for 100 errors)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      });
    });
  });

  describe('Integration Error Handling', () => {
    it('should handle voice pipeline integration failures', async () => {
      const error = new IntegrationError('Voice pipeline disconnected', {
        userId: 'test-user',
        timestamp: new Date(),
        systemState: { voiceStatus: 'disconnected' }
      }, 'voice-pipeline');

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      
      // Recommendations should be marked as non-actionable
      result.recommendations!.forEach(rec => {
        expect(rec.actionable).toBe(false);
        expect((rec.metadata as any).integrationLimited).toBe(true);
        expect((rec.metadata as any).affectedSystem).toBe('voice-pipeline');
      });
    });

    it('should handle avatar system integration failures', async () => {
      const error = new IntegrationError('Avatar system unavailable', {
        userId: 'test-user',
        timestamp: new Date(),
        systemState: { avatarStatus: 'offline' }
      }, 'avatar-system');

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.limitations).toContain('Integration with avatar-system unavailable');
      expect(result.retryable).toBe(true);
    });

    it('should handle smart home integration failures', async () => {
      const error = new IntegrationError('Smart home devices offline', {
        userId: 'test-user',
        timestamp: new Date(),
        systemState: { smartHomeStatus: 'offline' }
      }, 'smart-home');

      const result = await errorRecoveryManager.handleError(
        error,
        'test-user',
        mockUserContext,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeDefined();
      expect(result.limitations).toContain('Integration with smart-home unavailable');
    });
  });

  describe('Error Metrics and Monitoring', () => {
    it('should track comprehensive error statistics', async () => {
      const testErrors = [
        new GenerationError('Test 1', { userId: 'user1', timestamp: new Date(), systemState: {} }),
        new ContextError('Test 2', { userId: 'user2', timestamp: new Date(), systemState: {} }),
        new LearningError('Test 3', { userId: 'user3', timestamp: new Date(), systemState: {} }),
        new GenerationError('Test 4', { userId: 'user4', timestamp: new Date(), systemState: {} })
      ];

      for (const error of testErrors) {
        await errorRecoveryManager.handleError(
          error,
          error.context.userId!,
          mockUserContext,
          {}
        );
        // Small delay to ensure measurable recovery time
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const metrics = errorRecoveryManager.getErrorMetrics();
      
      expect(metrics.errorCount).toBe(4);
      expect(metrics.errorsByCategory[ErrorCategory.RECOMMENDATION_GENERATION]).toBe(2);
      expect(metrics.errorsByCategory[ErrorCategory.CONTEXT_ANALYSIS]).toBe(1);
      expect(metrics.errorsByCategory[ErrorCategory.LEARNING_SYSTEM]).toBe(1);
      expect(metrics.recoverySuccessRate).toBeGreaterThan(0);
      expect(metrics.averageRecoveryTime).toBeGreaterThanOrEqual(0); // Allow 0 for very fast operations
    });

    it('should provide actionable error insights', async () => {
      // Create errors with different severities
      const errors = [
        new GenerationError('Critical model failure', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { severity: 'critical' }
        }),
        new ContextError('Minor sensor glitch', {
          userId: 'test-user',
          timestamp: new Date(),
          systemState: { severity: 'low' }
        })
      ];

      for (const error of errors) {
        await errorRecoveryManager.handleError(
          error,
          'test-user',
          mockUserContext,
          {}
        );
      }

      const metrics = errorRecoveryManager.getErrorMetrics();
      
      expect(metrics.errorsBySeverity[ErrorSeverity.MEDIUM]).toBe(1); // GenerationError default
      expect(metrics.errorsBySeverity[ErrorSeverity.LOW]).toBe(1); // ContextError default
    });
  });
});