/**
 * Tests for privacy remediation management
 */

import {
  PrivacyRemediationManager,
  RemediationResult,
  IncidentReport
} from './privacy-remediation-manager';
import {
  PrivacyViolationDetector,
  PrivacyViolation,
  ViolationType
} from './privacy-violation-detector';

describe('PrivacyRemediationManager', () => {
  let detector: PrivacyViolationDetector;
  let remediationManager: PrivacyRemediationManager;

  beforeEach(() => {
    detector = new PrivacyViolationDetector();
    remediationManager = new PrivacyRemediationManager(detector);
  });

  describe('Remediation Plan Creation', () => {
    it('should create appropriate remediation plan for unauthorized access', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-1',
        type: ViolationType.UNAUTHORIZED_DATA_ACCESS,
        severity: 'high',
        userId: 'test-user',
        description: 'Unauthorized access attempt',
        dataInvolved: ['preferences', 'behavior'],
        timestamp: new Date(),
        source: 'malicious-service',
        remediated: false,
        remediationActions: []
      };

      const result = await remediationManager.handlePrivacyViolation(violation);

      expect(result.success).toBe(true);
      expect(result.accessTerminated).toBe(true);
      expect(result.userNotified).toBe(true);
      expect(result.actionsExecuted).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should create remediation plan for consent violations', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-2',
        type: ViolationType.CONSENT_VIOLATION,
        severity: 'critical',
        userId: 'test-user',
        description: 'Operation without consent',
        dataInvolved: ['personal_data'],
        timestamp: new Date(),
        source: 'recommendation-engine',
        remediated: false,
        remediationActions: []
      };

      const result = await remediationManager.handlePrivacyViolation(violation);

      expect(result.success).toBe(true);
      expect(result.dataRemoved).toBe(true);
      expect(result.userNotified).toBe(true);
      expect(result.actionsExecuted).toBeGreaterThan(0);
    });

    it('should create remediation plan for parental consent violations', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-3',
        type: ViolationType.PARENTAL_CONSENT_MISSING,
        severity: 'critical',
        userId: 'child-user',
        description: 'Missing parental consent',
        dataInvolved: ['educational_data'],
        timestamp: new Date(),
        source: 'recommendation-engine',
        remediated: false,
        remediationActions: []
      };

      const result = await remediationManager.handlePrivacyViolation(violation);

      expect(result.success).toBe(true);
      expect(result.accessTerminated).toBe(true);
      expect(result.userNotified).toBe(true);
    });
  });

  describe('Incident Report Creation', () => {
    it('should create incident reports for high severity violations', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-4',
        type: ViolationType.EXTERNAL_DATA_SHARING,
        severity: 'critical',
        userId: 'test-user',
        description: 'Unauthorized external sharing',
        dataInvolved: ['sensitive_data'],
        timestamp: new Date(),
        source: 'external-service',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation);

      const incidents = await remediationManager.getIncidentReports();
      expect(incidents).toHaveLength(1);
      
      const incident = incidents[0];
      expect(incident.violationId).toBe(violation.id);
      expect(incident.severity).toBe('critical');
      expect(incident.affectedUsers).toContain('test-user');
      expect(incident.complianceImpact).toContain('regulatory violation');
    });

    it('should not create incident reports for low severity violations', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-5',
        type: ViolationType.DATA_RETENTION_VIOLATION,
        severity: 'low',
        userId: 'test-user',
        description: 'Minor retention issue',
        dataInvolved: ['cache_data'],
        timestamp: new Date(),
        source: 'system',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation);

      const incidents = await remediationManager.getIncidentReports();
      expect(incidents).toHaveLength(0);
    });
  });

  describe('Remediation Execution', () => {
    it('should execute all remediation actions successfully', async () => {
      const violation: PrivacyViolation = {
        id: 'test-violation-6',
        type: ViolationType.UNAUTHORIZED_DATA_ACCESS,
        severity: 'high',
        userId: 'test-user',
        description: 'Test violation',
        dataInvolved: ['test_data'],
        timestamp: new Date(),
        source: 'test-source',
        remediated: false,
        remediationActions: []
      };

      const result = await remediationManager.handlePrivacyViolation(violation);

      expect(result.success).toBe(true);
      expect(result.actionsFailed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle remediation failures gracefully', async () => {
      // Mock a failure in the detector
      const originalExecute = detector.executeRemediationAction;
      detector.executeRemediationAction = jest.fn().mockRejectedValue(new Error('Remediation failed'));

      const violation: PrivacyViolation = {
        id: 'test-violation-7',
        type: ViolationType.CONSENT_VIOLATION,
        severity: 'medium',
        userId: 'test-user',
        description: 'Test violation with failure',
        dataInvolved: ['test_data'],
        timestamp: new Date(),
        source: 'test-source',
        remediated: false,
        remediationActions: []
      };

      const result = await remediationManager.handlePrivacyViolation(violation);

      expect(result.success).toBe(false);
      expect(result.actionsFailed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);

      // Restore original method
      detector.executeRemediationAction = originalExecute;
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate comprehensive compliance reports', async () => {
      // Create multiple violations of different types
      const violations = [
        {
          id: 'v1',
          type: ViolationType.UNAUTHORIZED_DATA_ACCESS,
          severity: 'high' as const,
          userId: 'user1',
          description: 'Test 1',
          dataInvolved: ['data1'],
          timestamp: new Date(),
          source: 'source1',
          remediated: false,
          remediationActions: []
        },
        {
          id: 'v2',
          type: ViolationType.CONSENT_VIOLATION,
          severity: 'critical' as const,
          userId: 'user2',
          description: 'Test 2',
          dataInvolved: ['data2'],
          timestamp: new Date(),
          source: 'source2',
          remediated: false,
          remediationActions: []
        },
        {
          id: 'v3',
          type: ViolationType.UNAUTHORIZED_DATA_ACCESS,
          severity: 'medium' as const,
          userId: 'user3',
          description: 'Test 3',
          dataInvolved: ['data3'],
          timestamp: new Date(),
          source: 'source3',
          remediated: false,
          remediationActions: []
        }
      ];

      // Process all violations
      for (const violation of violations) {
        await remediationManager.handlePrivacyViolation(violation);
      }

      const report = await remediationManager.generateComplianceReport();

      expect(report.totalViolations).toBe(3);
      expect(report.violationsByType[ViolationType.UNAUTHORIZED_DATA_ACCESS]).toBe(2);
      expect(report.violationsByType[ViolationType.CONSENT_VIOLATION]).toBe(1);
      expect(report.remediationSuccessRate).toBeGreaterThan(0);
      expect(report.averageRemediationTime).toBeGreaterThan(0);
      expect(report.criticalIncidents).toBe(1); // One critical violation
    });

    it('should track remediation success rates', async () => {
      // Create successful remediation
      const violation1: PrivacyViolation = {
        id: 'success-violation',
        type: ViolationType.DATA_RETENTION_VIOLATION,
        severity: 'medium',
        userId: 'test-user',
        description: 'Successful remediation test',
        dataInvolved: ['test_data'],
        timestamp: new Date(),
        source: 'test',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation1);

      const report = await remediationManager.generateComplianceReport();
      expect(report.remediationSuccessRate).toBe(1.0); // 100% success
    });
  });

  describe('History Management', () => {
    it('should retrieve remediation history by violation ID', async () => {
      const violation: PrivacyViolation = {
        id: 'history-test-violation',
        type: ViolationType.CROSS_USER_DATA_LEAK,
        severity: 'high',
        userId: 'test-user',
        description: 'History test',
        dataInvolved: ['test_data'],
        timestamp: new Date(),
        source: 'test',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation);

      const history = await remediationManager.getRemediationHistory('history-test-violation');
      expect(history).toHaveLength(1);
      expect(history[0].violationId).toBe('history-test-violation');
    });

    it('should retrieve incident reports by user', async () => {
      const violation: PrivacyViolation = {
        id: 'user-incident-test',
        type: ViolationType.EXTERNAL_DATA_SHARING,
        severity: 'critical',
        userId: 'specific-user',
        description: 'User-specific incident',
        dataInvolved: ['user_data'],
        timestamp: new Date(),
        source: 'test',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation);

      const userIncidents = await remediationManager.getIncidentReports('specific-user');
      const allIncidents = await remediationManager.getIncidentReports();

      expect(userIncidents).toHaveLength(1);
      expect(userIncidents[0].affectedUsers).toContain('specific-user');
      expect(allIncidents.length).toBeGreaterThanOrEqual(1);
    });

    it('should clear history correctly', async () => {
      const violation: PrivacyViolation = {
        id: 'clear-test-violation',
        type: ViolationType.CONSENT_VIOLATION,
        severity: 'medium',
        userId: 'test-user',
        description: 'Clear test',
        dataInvolved: ['test_data'],
        timestamp: new Date(),
        source: 'test',
        remediated: false,
        remediationActions: []
      };

      await remediationManager.handlePrivacyViolation(violation);

      // Verify data exists
      let history = await remediationManager.getRemediationHistory();
      expect(history.length).toBeGreaterThan(0);

      // Clear and verify
      await remediationManager.clearHistory();
      history = await remediationManager.getRemediationHistory();
      const incidents = await remediationManager.getIncidentReports();

      expect(history).toHaveLength(0);
      expect(incidents).toHaveLength(0);
    });
  });

  describe('Priority and Timing', () => {
    it('should prioritize critical violations for immediate remediation', async () => {
      const criticalViolation: PrivacyViolation = {
        id: 'critical-priority-test',
        type: ViolationType.PARENTAL_CONSENT_MISSING,
        severity: 'critical',
        userId: 'child-user',
        description: 'Critical priority test',
        dataInvolved: ['child_data'],
        timestamp: new Date(),
        source: 'test',
        remediated: false,
        remediationActions: []
      };

      const startTime = Date.now();
      const result = await remediationManager.handlePrivacyViolation(criticalViolation);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(endTime - startTime + 100); // Allow some margin
      expect(result.accessTerminated).toBe(true); // Should terminate access immediately
    });

    it('should handle multiple violations efficiently', async () => {
      const violations = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-violation-${i}`,
        type: ViolationType.DATA_RETENTION_VIOLATION,
        severity: 'medium' as const,
        userId: `user-${i}`,
        description: `Batch test ${i}`,
        dataInvolved: [`data-${i}`],
        timestamp: new Date(),
        source: 'batch-test',
        remediated: false,
        remediationActions: []
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        violations.map(v => remediationManager.handlePrivacyViolation(v))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});