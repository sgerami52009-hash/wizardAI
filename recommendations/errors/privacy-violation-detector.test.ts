/**
 * Tests for privacy violation detection and remediation
 */

import {
  PrivacyViolationDetector,
  ViolationType,
  DataOperation,
  PrivacySettings
} from './privacy-violation-detector';
import { PrivacyRemediationManager } from './privacy-remediation-manager';

describe('PrivacyViolationDetector', () => {
  let detector: PrivacyViolationDetector;
  let remediationManager: PrivacyRemediationManager;

  beforeEach(() => {
    detector = new PrivacyViolationDetector();
    remediationManager = new PrivacyRemediationManager(detector);
  });

  describe('Unauthorized Access Detection', () => {
    it('should detect unauthorized data access attempts', async () => {
      const operation: DataOperation = {
        operationType: 'read',
        userId: 'test-user',
        dataTypes: ['preferences', 'behavior'],
        purpose: 'recommendation_generation',
        requester: 'malicious-service',
        timestamp: new Date(),
        consentRequired: false
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.UNAUTHORIZED_DATA_ACCESS);
      expect(violation!.severity).toBe('high');
      expect(violation!.userId).toBe('test-user');
      expect(violation!.remediationActions).toHaveLength(2);
      expect(violation!.remediationActions[0].type).toBe('access_termination');
    });

    it('should allow authorized access', async () => {
      const operation: DataOperation = {
        operationType: 'read',
        userId: 'test-user',
        dataTypes: ['preferences'],
        purpose: 'recommendation_generation',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeNull();
    });
  });

  describe('Consent Violation Detection', () => {
    it('should detect operations without required consent', async () => {
      // Set up user with consent requirements
      await detector.updatePrivacySettings('test-user', {
        consentRequired: true
      });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'test-user',
        dataTypes: ['behavior', 'preferences'],
        purpose: 'personalization',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.CONSENT_VIOLATION);
      expect(violation!.severity).toBe('critical');
      expect(violation!.remediationActions).toContainEqual(
        expect.objectContaining({ type: 'consent_request' })
      );
    });

    it('should allow operations with proper consent', async () => {
      // Record consent first
      await detector.recordConsent('test-user', 'personalization');
      
      await detector.updatePrivacySettings('test-user', {
        consentRequired: true
      });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'test-user',
        dataTypes: ['behavior'],
        purpose: 'personalization',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeNull();
    });
  });

  describe('Data Retention Violation Detection', () => {
    it('should detect retention period violations', async () => {
      await detector.updatePrivacySettings('test-user', {
        retentionPeriod: 30 // 30 days
      });

      const operation: DataOperation = {
        operationType: 'store',
        userId: 'test-user',
        dataTypes: ['interaction_history'],
        purpose: 'learning',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false,
        retentionPeriod: 90 // Exceeds user limit
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.DATA_RETENTION_VIOLATION);
      expect(violation!.severity).toBe('medium');
      expect(violation!.description).toContain('90 days exceeds user limit of 30 days');
    });

    it('should allow operations within retention limits', async () => {
      await detector.updatePrivacySettings('test-user', {
        retentionPeriod: 60
      });

      const operation: DataOperation = {
        operationType: 'store',
        userId: 'test-user',
        dataTypes: ['preferences'],
        purpose: 'personalization',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false,
        retentionPeriod: 30 // Within limit
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeNull();
    });
  });

  describe('Cross-User Data Leak Detection', () => {
    it('should detect cross-user data access when not allowed', async () => {
      await detector.updatePrivacySettings('test-user', {
        allowCrossUserLearning: false
      });

      const operation: DataOperation = {
        operationType: 'read',
        userId: 'test-user',
        dataTypes: ['cross_user_patterns', 'family_preferences'],
        purpose: 'collaborative_filtering',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.CROSS_USER_DATA_LEAK);
      expect(violation!.severity).toBe('high');
    });

    it('should allow cross-user data when permitted', async () => {
      await detector.updatePrivacySettings('test-user', {
        allowCrossUserLearning: true
      });

      const operation: DataOperation = {
        operationType: 'read',
        userId: 'test-user',
        dataTypes: ['cross_user_patterns'],
        purpose: 'collaborative_filtering',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeNull();
    });
  });

  describe('External Data Sharing Detection', () => {
    it('should detect unauthorized external sharing', async () => {
      await detector.updatePrivacySettings('test-user', {
        allowExternalSharing: false
      });

      const operation: DataOperation = {
        operationType: 'share',
        userId: 'test-user',
        dataTypes: ['preferences', 'behavior'],
        purpose: 'analytics',
        requester: 'external-analytics-service',
        timestamp: new Date(),
        consentRequired: false
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.EXTERNAL_DATA_SHARING);
      expect(violation!.severity).toBe('critical');
    });
  });

  describe('Parental Consent Detection', () => {
    it('should detect missing parental consent for children', async () => {
      await detector.updatePrivacySettings('child-user', {
        requireParentalConsent: true
      });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'child-user',
        dataTypes: ['educational_progress'],
        purpose: 'learning_recommendations',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.PARENTAL_CONSENT_MISSING);
      expect(violation!.severity).toBe('critical');
    });

    it('should allow operations with parental consent', async () => {
      await detector.recordConsent('parent_child-user', 'learning_recommendations');
      await detector.updatePrivacySettings('child-user', {
        requireParentalConsent: true
      });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'child-user',
        dataTypes: ['educational_progress'],
        purpose: 'learning_recommendations',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);

      expect(violation).toBeNull();
    });
  });

  describe('Privacy Settings Management', () => {
    it('should create default privacy-first settings', async () => {
      const settings = await detector.getPrivacySettings('new-user');

      expect(settings.dataMinimization).toBe(true);
      expect(settings.consentRequired).toBe(true);
      expect(settings.allowCrossUserLearning).toBe(false);
      expect(settings.allowExternalSharing).toBe(false);
      expect(settings.anonymizationLevel).toBe('strong');
      expect(settings.auditingEnabled).toBe(true);
    });

    it('should update privacy settings correctly', async () => {
      await detector.updatePrivacySettings('test-user', {
        retentionPeriod: 90,
        allowCrossUserLearning: true
      });

      const settings = await detector.getPrivacySettings('test-user');

      expect(settings.retentionPeriod).toBe(90);
      expect(settings.allowCrossUserLearning).toBe(true);
      expect(settings.consentRequired).toBe(true); // Should preserve other settings
    });
  });

  describe('Consent Management', () => {
    it('should record and retrieve consent correctly', async () => {
      await detector.recordConsent('test-user', 'personalization');
      await detector.recordConsent('test-user', 'analytics');

      // Test that consent exists by trying an operation that requires it
      await detector.updatePrivacySettings('test-user', { consentRequired: true });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'test-user',
        dataTypes: ['preferences'],
        purpose: 'personalization',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);
      expect(violation).toBeNull();
    });

    it('should handle consent revocation', async () => {
      await detector.recordConsent('test-user', 'personalization');
      await detector.revokeConsent('test-user', 'personalization');
      await detector.updatePrivacySettings('test-user', { consentRequired: true });

      const operation: DataOperation = {
        operationType: 'process',
        userId: 'test-user',
        dataTypes: ['preferences'],
        purpose: 'personalization',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: true
      };

      const violation = await detector.detectViolation(operation);
      expect(violation).toBeTruthy();
      expect(violation!.type).toBe(ViolationType.CONSENT_VIOLATION);
    });
  });

  describe('Audit Trail', () => {
    it('should log legitimate operations', async () => {
      const operation: DataOperation = {
        operationType: 'read',
        userId: 'test-user',
        dataTypes: ['preferences'],
        purpose: 'recommendation_generation',
        requester: 'recommendation-engine',
        timestamp: new Date(),
        consentRequired: false
      };

      await detector.detectViolation(operation);

      const accessLog = detector.getDataAccessLog('test-user');
      expect(accessLog).toHaveLength(1);
      expect(accessLog[0].operation).toEqual(operation);
    });

    it('should retrieve violations by user', async () => {
      // Create violations for different users
      const operation1: DataOperation = {
        operationType: 'read',
        userId: 'user1',
        dataTypes: ['preferences'],
        purpose: 'test',
        requester: 'malicious-service',
        timestamp: new Date(),
        consentRequired: false
      };

      const operation2: DataOperation = {
        operationType: 'read',
        userId: 'user2',
        dataTypes: ['preferences'],
        purpose: 'test',
        requester: 'malicious-service',
        timestamp: new Date(),
        consentRequired: false
      };

      await detector.detectViolation(operation1);
      await detector.detectViolation(operation2);

      const user1Violations = detector.getViolations('user1');
      const user2Violations = detector.getViolations('user2');
      const allViolations = detector.getViolations();

      expect(user1Violations).toHaveLength(1);
      expect(user2Violations).toHaveLength(1);
      expect(allViolations).toHaveLength(2);
      expect(user1Violations[0].userId).toBe('user1');
      expect(user2Violations[0].userId).toBe('user2');
    });
  });
});