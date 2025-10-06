/**
 * Safety Audit Logger Tests
 * Safety: Comprehensive testing of audit logging and parental review systems
 */

import { SafetyAuditLoggerEngine } from './safety-audit-logger';
import { SafetyConfiguration } from '../models/safety-models';
import { SafetyAuditEntry } from './interfaces';

describe('SafetyAuditLoggerEngine', () => {
  let auditLogger: SafetyAuditLoggerEngine;
  let mockConfiguration: SafetyConfiguration;

  beforeEach(() => {
    mockConfiguration = {
      globalSettings: {
        enabled: true,
        strictMode: true,
        defaultAction: 'blocked',
        allowParentalOverrides: true,
        requireParentalApproval: ['high_risk_content'],
        emergencyBypassEnabled: false,
        logAllInteractions: true
      },
      ageGroupSettings: {
        child: {
          strictMode: true,
          allowedTopics: ['education', 'games', 'family'],
          blockedTopics: ['violence', 'adult_content', 'scary_content'],
          vocabularyLevel: 'simple',
          maxComplexity: 30,
          requiresSupervision: true,
          customRules: []
        },
        teen: {
          strictMode: false,
          allowedTopics: ['education', 'games', 'family', 'technology', 'sports'],
          blockedTopics: ['adult_content', 'extreme_violence'],
          vocabularyLevel: 'intermediate',
          maxComplexity: 60,
          requiresSupervision: false,
          customRules: []
        },
        adult: {
          strictMode: false,
          allowedTopics: [],
          blockedTopics: ['illegal_content'],
          vocabularyLevel: 'advanced',
          maxComplexity: 100,
          requiresSupervision: false,
          customRules: []
        }
      },
      customRules: [],
      parentalControls: {
        enabled: true,
        requireApprovalFor: ['blocked_content'],
        notificationMethods: ['push', 'email'],
        reviewTimeout: 24,
        autoApproveAfterTimeout: false,
        allowChildExceptions: false
      },
      auditSettings: {
        enabled: true,
        retentionPeriod: 30,
        logLevel: 'standard',
        includeContent: false,
        encryptLogs: true,
        autoReporting: true
      }
    };

    auditLogger = new SafetyAuditLoggerEngine(mockConfiguration);
  });

  afterEach(() => {
    // Clean up any timers or listeners to prevent Jest hanging
    if (auditLogger && typeof auditLogger.destroy === 'function') {
      auditLogger.destroy();
    }
  });

  describe('logSafetyEvent', () => {
    it('should log safety events successfully', async () => {
      const testEvent: SafetyAuditEntry = {
        id: 'test_event_1',
        timestamp: new Date(),
        userId: 'child_user',
        eventType: 'content_blocked',
        originalContent: 'Inappropriate test content',
        riskLevel: 'high',
        blockedReasons: ['Profanity detected'],
        parentalReview: true
      };

      await expect(auditLogger.logSafetyEvent(testEvent)).resolves.not.toThrow();
    });

    it('should emit safety_event_logged event', async () => {
      const testEvent: SafetyAuditEntry = {
        id: 'test_event_2',
        timestamp: new Date(),
        userId: 'child_user',
        eventType: 'content_blocked',
        originalContent: 'Test content',
        riskLevel: 'medium',
        blockedReasons: ['Test reason'],
        parentalReview: false
      };

      const eventPromise = new Promise((resolve) => {
        auditLogger.once('safety_event_logged', (event) => {
          expect(event.eventId).toBe(testEvent.id);
          expect(event.userId).toBe(testEvent.userId);
          expect(event.eventType).toBe(testEvent.eventType);
          resolve(event);
        });
      });

      await auditLogger.logSafetyEvent(testEvent);
      await eventPromise;
    });

    it('should create parental review request for events requiring review', async () => {
      const testEvent: SafetyAuditEntry = {
        id: 'test_event_3',
        timestamp: new Date(),
        userId: 'child_user',
        eventType: 'content_blocked',
        originalContent: 'Content requiring parental review',
        riskLevel: 'high',
        blockedReasons: ['High risk content'],
        parentalReview: true
      };

      const reviewPromise = new Promise((resolve) => {
        auditLogger.once('parental_review_requested', () => {
          resolve(true);
        });
      });

      await auditLogger.logSafetyEvent(testEvent);
      const reviewRequested = await reviewPromise;
      expect(reviewRequested).toBe(true);
    });

    it('should handle logging errors gracefully', async () => {
      const invalidEvent = null as any;
      
      await expect(auditLogger.logSafetyEvent(invalidEvent)).rejects.toThrow('Failed to log safety event');
    });
  });

  describe('getAuditHistory', () => {
    beforeEach(async () => {
      // Add some test events
      const events: SafetyAuditEntry[] = [
        {
          id: 'event_1',
          timestamp: new Date(Date.now() - 60000), // 1 minute ago
          userId: 'user_1',
          eventType: 'content_blocked',
          originalContent: 'Test content 1',
          riskLevel: 'high',
          blockedReasons: ['Test reason 1'],
          parentalReview: true
        },
        {
          id: 'event_2',
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
          userId: 'user_2',
          eventType: 'content_sanitized',
          originalContent: 'Test content 2',
          riskLevel: 'medium',
          blockedReasons: ['Test reason 2'],
          parentalReview: false
        }
      ];

      for (const event of events) {
        await auditLogger.logSafetyEvent(event);
      }
    });

    it('should return audit history within time range', async () => {
      const filters = {
        timeRange: {
          start: new Date(Date.now() - 120000), // 2 minutes ago
          end: new Date()
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should filter by user ID', async () => {
      const filters = {
        userId: 'user_1',
        timeRange: {
          start: new Date(Date.now() - 120000),
          end: new Date()
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      expect(history.every(entry => entry.userId === 'user_1')).toBe(true);
    });

    it('should filter by event type', async () => {
      const filters = {
        eventType: 'content_blocked',
        timeRange: {
          start: new Date(Date.now() - 120000),
          end: new Date()
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      expect(history.every(entry => entry.eventType === 'content_blocked')).toBe(true);
    });

    it('should filter by risk level', async () => {
      const filters = {
        riskLevel: 'high' as const,
        timeRange: {
          start: new Date(Date.now() - 120000),
          end: new Date()
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      expect(history.every(entry => entry.riskLevel === 'high')).toBe(true);
    });

    it('should return empty array for future time range', async () => {
      const filters = {
        timeRange: {
          start: new Date(Date.now() + 60000), // 1 minute in future
          end: new Date(Date.now() + 120000)   // 2 minutes in future
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      expect(history).toHaveLength(0);
    });

    it('should sort results by timestamp (newest first)', async () => {
      const filters = {
        timeRange: {
          start: new Date(Date.now() - 120000),
          end: new Date()
        }
      };

      const history = await auditLogger.getAuditHistory(filters);
      
      if (history.length > 1) {
        for (let i = 1; i < history.length; i++) {
          expect(history[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
            history[i].timestamp.getTime()
          );
        }
      }
    });
  });

  describe('generateReport', () => {
    beforeEach(async () => {
      // Add test events for reporting
      const events: SafetyAuditEntry[] = [
        {
          id: 'report_event_1',
          timestamp: new Date(),
          userId: 'user_1',
          eventType: 'content_blocked',
          originalContent: 'Test content',
          riskLevel: 'high',
          blockedReasons: ['Profanity'],
          parentalReview: true
        },
        {
          id: 'report_event_2',
          timestamp: new Date(),
          userId: 'user_2',
          eventType: 'content_sanitized',
          originalContent: 'Test content',
          riskLevel: 'medium',
          blockedReasons: ['Inappropriate topic'],
          parentalReview: false
        }
      ];

      for (const event of events) {
        await auditLogger.logSafetyEvent(event);
      }
    });

    it('should generate comprehensive safety report', async () => {
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const report = await auditLogger.generateReport(timeRange);

      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('totalEvents');
      expect(report).toHaveProperty('eventsByType');
      expect(report).toHaveProperty('eventsByRisk');
      expect(report).toHaveProperty('topBlockedReasons');
      expect(report).toHaveProperty('userActivity');
      expect(report).toHaveProperty('pendingReviews');
      
      expect(typeof report.totalEvents).toBe('number');
      expect(typeof report.eventsByType).toBe('object');
      expect(typeof report.eventsByRisk).toBe('object');
      expect(Array.isArray(report.topBlockedReasons)).toBe(true);
      expect(Array.isArray(report.userActivity)).toBe(true);
    });

    it('should generate user-specific report', async () => {
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const report = await auditLogger.generateReport(timeRange, 'user_1');

      expect(report.userActivity.length).toBeLessThanOrEqual(1);
      if (report.userActivity.length > 0) {
        expect(report.userActivity[0].userId).toBe('user_1');
      }
    });

    it('should emit report_generated event', async () => {
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const reportPromise = new Promise((resolve) => {
        auditLogger.once('report_generated', (event) => {
          expect(event.report).toBeDefined();
          expect(event.userId).toBeUndefined();
          resolve(event);
        });
      });

      await auditLogger.generateReport(timeRange);
      await reportPromise;
    });
  });

  describe('purgeOldLogs', () => {
    beforeEach(async () => {
      // Add old events
      const oldEvents: SafetyAuditEntry[] = [
        {
          id: 'old_event_1',
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
          userId: 'user_1',
          eventType: 'content_blocked',
          originalContent: 'Old content',
          riskLevel: 'medium',
          blockedReasons: ['Old reason'],
          parentalReview: false
        },
        {
          id: 'recent_event_1',
          timestamp: new Date(), // Now
          userId: 'user_2',
          eventType: 'content_sanitized',
          originalContent: 'Recent content',
          riskLevel: 'low',
          blockedReasons: ['Recent reason'],
          parentalReview: false
        }
      ];

      for (const event of oldEvents) {
        await auditLogger.logSafetyEvent(event);
      }
    });

    it('should purge logs older than specified date', async () => {
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const purgedCount = await auditLogger.purgeOldLogs(cutoffDate);
      expect(purgedCount).toBeGreaterThan(0);
    });

    it('should emit logs_purged event', async () => {
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const purgePromise = new Promise((resolve) => {
        auditLogger.once('logs_purged', (event) => {
          expect(event.purgedCount).toBeGreaterThanOrEqual(0);
          expect(event.remainingCount).toBeGreaterThanOrEqual(0);
          expect(event.olderThan).toEqual(cutoffDate);
          resolve(event);
        });
      });

      await auditLogger.purgeOldLogs(cutoffDate);
      await purgePromise;
    });

    it('should not purge recent logs', async () => {
      const cutoffDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      
      await auditLogger.purgeOldLogs(cutoffDate);
      
      const recentLogs = await auditLogger.getAuditHistory({
        timeRange: {
          start: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          end: new Date()
        }
      });

      expect(recentLogs.length).toBeGreaterThan(0);
    });
  });

  describe('processParentalDecision', () => {
    let reviewRequestId: string;

    beforeEach(async () => {
      // Create a parental review request
      const testEvent: SafetyAuditEntry = {
        id: 'parental_test_event',
        timestamp: new Date(),
        userId: 'child_user',
        eventType: 'content_blocked',
        originalContent: 'Content requiring review',
        riskLevel: 'high',
        blockedReasons: ['High risk content'],
        parentalReview: true
      };

      // Listen for the parental review request to get the actual ID
      const reviewPromise = new Promise<string>((resolve) => {
        auditLogger.once('parental_review_requested', (request) => {
          resolve(request.id);
        });
      });

      await auditLogger.logSafetyEvent(testEvent);
      reviewRequestId = await reviewPromise;
    });

    it('should process parental approval decision', async () => {
      await expect(
        auditLogger.processParentalDecision(reviewRequestId, 'approve', 'Parent approved content')
      ).resolves.not.toThrow();
    });

    it('should process parental rejection decision', async () => {
      await expect(
        auditLogger.processParentalDecision(reviewRequestId, 'reject', 'Parent rejected content')
      ).resolves.not.toThrow();
    });

    it('should emit parental_decision_processed event', async () => {
      const decisionPromise = new Promise((resolve) => {
        auditLogger.once('parental_decision_processed', (event) => {
          expect(event.requestId).toBe(reviewRequestId);
          expect(event.decision).toBe('approve');
          expect(event.reason).toBe('Test approval');
          resolve(event);
        });
      });

      await auditLogger.processParentalDecision(reviewRequestId, 'approve', 'Test approval');
      await decisionPromise;
    });

    it('should handle invalid request ID', async () => {
      await expect(
        auditLogger.processParentalDecision('invalid_id', 'approve', 'Test')
      ).rejects.toThrow('Review request not found');
    });
  });

  describe('memory management', () => {
    it('should limit memory usage by auto-purging old entries', async () => {
      // Generate many audit entries
      for (let i = 0; i < 10100; i++) {
        const event: SafetyAuditEntry = {
          id: `memory_test_${i}`,
          timestamp: new Date(Date.now() - i * 1000), // Spread over time
          userId: `user_${i % 10}`,
          eventType: 'content_blocked',
          originalContent: `Test content ${i}`,
          riskLevel: 'low',
          blockedReasons: ['Test'],
          parentalReview: false
        };

        await auditLogger.logSafetyEvent(event);
      }

      // Check that memory cleanup occurred
      const allLogs = await auditLogger.getAuditHistory({
        timeRange: {
          start: new Date(0),
          end: new Date()
        }
      });

      expect(allLogs.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('error handling', () => {
    it('should handle audit retrieval errors gracefully', async () => {
      // Mock an error condition
      const originalMethod = auditLogger['auditEntries'];
      auditLogger['auditEntries'] = null as any;

      const result = await auditLogger.getAuditHistory({
        timeRange: { start: new Date(), end: new Date() }
      });

      expect(result).toEqual([]);
      
      // Restore
      auditLogger['auditEntries'] = originalMethod;
    });

    it('should emit error events for logging failures', async () => {
      const errorPromise = new Promise((resolve) => {
        auditLogger.once('logging_error', (event) => {
          expect(event.error).toBeDefined();
          resolve(event);
        });
      });

      // Trigger an error by passing invalid event
      try {
        await auditLogger.logSafetyEvent(null as any);
      } catch (error) {
        // Expected to throw
      }
      
      await errorPromise;
    });
  });
});