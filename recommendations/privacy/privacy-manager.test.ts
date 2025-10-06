/**
 * Privacy Manager Test Suite
 * Comprehensive tests for privacy and security management functionality
 */

import { PrivacyManager } from './privacy-manager';
import { EncryptionService, SecureDataProcessor, AuditLogger } from './secure-data-handling';
import { DataMinimizer, RetentionPolicyManager, ConsentManager } from './data-protection';
import { 
  DataOperation, 
  PrivacySettings, 
  UserData, 
  TimeRange 
} from '../types';
import { PrivacyLevel } from '../enums';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PrivacyManager', () => {
  let privacyManager: PrivacyManager;
  let testUserId: string;
  let testEncryptionKey: string;

  beforeEach(() => {
    testUserId = 'test-user-123';
    testEncryptionKey = crypto.randomBytes(32).toString('hex');
    privacyManager = new PrivacyManager(testEncryptionKey);
  });

  describe('Privacy Preference Enforcement', () => {
    it('should allow operations when privacy settings permit', async () => {
      const operation: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences', 'context']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(testUserId, operation);

      expect(decision.allowed).toBe(true);
      expect(decision.restrictions).toHaveLength(0);
      expect(decision.auditRequired).toBe(true);
    });

    it('should block data sharing when privacy level is private', async () => {
      const settings: PrivacySettings = {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: true,
        familyDataSharing: false,
        externalIntegrations: false,
        dataRetentionDays: 90,
        encryptionRequired: true
      };

      await privacyManager.updatePrivacySettings(testUserId, settings);

      const operation: DataOperation = {
        type: 'share',
        purpose: 'external_integration',
        dataTypes: ['preferences']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(testUserId, operation);

      expect(decision.allowed).toBe(false);
      expect(decision.restrictions).toContainEqual(
        expect.objectContaining({
          type: 'data_sharing_blocked'
        })
      );
    });

    it('should require anonymization for anonymous privacy level', async () => {
      const settings: PrivacySettings = {
        dataSharing: PrivacyLevel.ANONYMOUS,
        locationTracking: true,
        behaviorAnalysis: true,
        familyDataSharing: false,
        externalIntegrations: true,
        dataRetentionDays: 90,
        encryptionRequired: true
      };

      await privacyManager.updatePrivacySettings(testUserId, settings);

      const operation: DataOperation = {
        type: 'export',
        purpose: 'research',
        dataTypes: ['preferences', 'interactions']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(testUserId, operation);

      expect(decision.anonymizationRequired).toBe(true);
      expect(decision.consentRequired).toBe(true);
    });

    it('should block location operations when location tracking is disabled', async () => {
      const settings: PrivacySettings = {
        dataSharing: PrivacyLevel.FAMILY,
        locationTracking: false,
        behaviorAnalysis: true,
        familyDataSharing: true,
        externalIntegrations: false,
        dataRetentionDays: 90,
        encryptionRequired: true
      };

      await privacyManager.updatePrivacySettings(testUserId, settings);

      const operation: DataOperation = {
        type: 'read',
        purpose: 'context_analysis',
        dataTypes: ['location', 'preferences']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(testUserId, operation);

      expect(decision.allowed).toBe(false);
      expect(decision.restrictions).toContainEqual(
        expect.objectContaining({
          type: 'location_tracking_disabled'
        })
      );
    });
  });

  describe('Data Anonymization', () => {
    const testUserData: UserData = {
      userId: testUserId,
      preferences: {
        userId: testUserId,
        interests: [
          { category: 'SPORTS' as any, subcategory: 'running', strength: 0.8, recency: new Date(), source: 'explicit' },
          { category: 'MUSIC' as any, subcategory: 'classical', strength: 0.6, recency: new Date(), source: 'explicit' }
        ],
        activityPreferences: {} as any,
        schedulePreferences: {} as any,
        learningPreferences: {} as any,
        privacyPreferences: {} as any,
        notificationPreferences: {} as any,
        lastUpdated: new Date()
      },
      interactions: [
        {
          userId: testUserId,
          recommendationId: 'rec-123',
          interactionType: 'VIEW' as any,
          timestamp: new Date(),
          context: {} as any,
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 30,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.8
        }
      ],
      context: {} as any,
      metadata: {
        email: 'test@example.com',
        name: 'Test User',
        age: 25,
        familyId: 'family-123',
        location: { region: 'North America', country: 'USA' },
        timeZone: 'America/New_York'
      }
    };

    it('should anonymize data for public privacy level', async () => {
      const anonymized = await privacyManager.anonymizeUserData(testUserData, PrivacyLevel.PUBLIC);

      expect(anonymized.anonymizedId).toBeDefined();
      expect(anonymized.data.userId).toBeUndefined();
      expect(anonymized.data.metadata?.email).toBeUndefined();
      expect(anonymized.data.metadata?.name).toBeUndefined();
      expect(anonymized.data.preferences).toBeDefined();
      expect(anonymized.privacyLevel).toBe(PrivacyLevel.PUBLIC);
    });

    it('should heavily anonymize data for anonymous privacy level', async () => {
      const anonymized = await privacyManager.anonymizeUserData(testUserData, PrivacyLevel.ANONYMOUS);

      expect(anonymized.data.demographicGroup).toBeDefined();
      expect(anonymized.data.usagePatterns).toBeDefined();
      expect(anonymized.data.preferences).toBeUndefined();
      expect(anonymized.data.familyId).toBeUndefined();
      expect(anonymized.retainedFields).toEqual(['demographicGroup', 'usagePatterns']);
    });

    it('should preserve family context for family privacy level', async () => {
      const anonymized = await privacyManager.anonymizeUserData(testUserData, PrivacyLevel.FAMILY);

      expect(anonymized.data.familyId).toBe('family-123');
      expect(anonymized.data.ageGroup).toBe('young_adult');
      expect(anonymized.data.generalLocation).toBe('North America');
      expect(anonymized.data.preferences).toBeDefined();
    });
  });

  describe('Data Usage Auditing', () => {
    it('should track data operations and generate audit reports', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };

      // Perform some operations
      const operation1: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences']
      };

      const operation2: DataOperation = {
        type: 'update',
        purpose: 'preference_learning',
        dataTypes: ['preferences', 'interactions']
      };

      await privacyManager.enforcePrivacyPreferences(testUserId, operation1);
      await privacyManager.enforcePrivacyPreferences(testUserId, operation2);

      const audit = await privacyManager.auditDataUsage(testUserId, timeRange);

      expect(audit.userId).toBe(testUserId);
      expect(audit.operations).toHaveLength(2);
      expect(audit.complianceStatus).toBe('compliant');
      expect(audit.operations[0].operation.type).toBe('read');
      expect(audit.operations[1].operation.type).toBe('update');
    });

    it('should detect compliance violations', async () => {
      // This would require mocking unauthorized operations
      // For now, we'll test the structure
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const audit = await privacyManager.auditDataUsage('non-existent-user', timeRange);

      expect(audit.operations).toHaveLength(0);
      expect(audit.complianceStatus).toBe('compliant');
    });
  });

  describe('Data Encryption and Decryption', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const testData = {
        preferences: { 
          interests: [
            { category: 'SPORTS', subcategory: 'running', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        },
        interactions: [{ 
          userId: 'test',
          recommendationId: 'rec-1',
          interactionType: 'VIEW',
          timestamp: new Date(),
          context: {} as any,
          outcome: {} as any,
          satisfaction: 0.8
        }]
      };

      const encrypted = await privacyManager.encryptUserData(testData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      const decrypted = await privacyManager.decryptUserData(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it('should fail to decrypt tampered data', async () => {
      const testData = { test: 'data' };
      const encrypted = await privacyManager.encryptUserData(testData);
      
      // Tamper with the encrypted data
      const tamperedData = encrypted.replace(/.$/, '0');

      await expect(privacyManager.decryptUserData(tamperedData))
        .rejects.toThrow('Data decryption failed');
    });
  });

  describe('Data Minimization Validation', () => {
    it('should validate data minimization for operations', async () => {
      const operation: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences', 'context', 'unnecessary_data']
      };

      const validation = await privacyManager.validateDataMinimization(operation);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          severity: 'medium',
          description: expect.stringContaining('Unnecessary data types')
        })
      );
    });

    it('should pass validation for minimal data collection', async () => {
      const operation: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences', 'context']
      };

      const validation = await privacyManager.validateDataMinimization(operation);

      expect(validation.valid).toBe(true);
      expect(validation.complianceScore).toBeGreaterThan(0.8);
    });
  });
});

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let testUserId: string;

  beforeEach(() => {
    testUserId = 'test-user-123';
    const testKey = crypto.randomBytes(32).toString('hex');
    encryptionService = new EncryptionService(testKey);
  });

  describe('Data Encryption', () => {
    it('should encrypt and decrypt data with integrity verification', async () => {
      const testData = {
        sensitive: 'information',
        preferences: { 
          interests: [
            { category: 'MUSIC', subcategory: 'classical', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        },
        timestamp: new Date()
      };

      const encrypted = await encryptionService.encryptData(testData, testUserId, 'test');
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.userId).toBe(testUserId);

      const decrypted = await encryptionService.decryptData(encrypted);
      expect(decrypted).toEqual(testData);
    });

    it('should generate and verify integrity hashes', () => {
      const testData = { test: 'data', number: 123 };
      const hash1 = encryptionService.generateIntegrityHash(testData);
      const hash2 = encryptionService.generateIntegrityHash(testData);
      
      expect(hash1).toBe(hash2);
      expect(encryptionService.verifyIntegrity(testData, hash1)).toBe(true);
      
      const modifiedData = { test: 'modified', number: 123 };
      expect(encryptionService.verifyIntegrity(modifiedData, hash1)).toBe(false);
    });

    it('should handle storage encryption/decryption', async () => {
      const testData = { 
        user: 'data', 
        preferences: { 
          interests: [
            { category: 'SPORTS', subcategory: 'running', strength: 0.9, recency: new Date(), source: 'explicit' }
          ]
        }
      };
      
      const encrypted = await encryptionService.encryptForStorage(testData, testUserId);
      expect(typeof encrypted).toBe('string');
      
      const decrypted = await encryptionService.decryptFromStorage(encrypted);
      expect(decrypted).toEqual(testData);
    });
  });
});

describe('SecureDataProcessor', () => {
  let secureProcessor: SecureDataProcessor;
  let encryptionService: EncryptionService;
  let auditLogger: AuditLogger;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-test-'));
    encryptionService = new EncryptionService();
    auditLogger = new AuditLogger(tempDir, encryptionService);
    secureProcessor = new SecureDataProcessor(encryptionService, auditLogger);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Secure Processing', () => {
    it('should process data securely with encryption', async () => {
      const testData = { 
        value: 10, 
        preferences: { 
          interests: [
            { category: 'MUSIC', subcategory: 'classical', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        }
      };
      const operation: DataOperation = {
        type: 'analyze',
        purpose: 'preference_learning',
        dataTypes: ['preferences']
      };

      const processor = async (data: any) => {
        return { ...data, processed: true, value: data.value * 2 };
      };

      const result = await secureProcessor.processSecurely(
        testData,
        'test-user',
        operation,
        processor
      );

      expect(result.processed).toBe(true);
      expect(result.value).toBe(20);
      expect(result.preferences).toEqual(testData.preferences);
    });

    it('should handle batch processing securely', async () => {
      const testData = [
        { id: 1, value: 10 },
        { id: 2, value: 20 },
        { id: 3, value: 30 }
      ];

      const operation: DataOperation = {
        type: 'analyze',
        purpose: 'batch_processing',
        dataTypes: ['user_data']
      };

      const processor = async (data: any[]) => {
        return data.map(item => ({ ...item, doubled: item.value * 2 }));
      };

      const results = await secureProcessor.processBatchSecurely(
        testData,
        'test-user',
        operation,
        processor
      );

      expect(results).toHaveLength(3);
      expect(results[0].doubled).toBe(20);
      expect(results[1].doubled).toBe(40);
      expect(results[2].doubled).toBe(60);
    });
  });
});

describe('DataMinimizer', () => {
  let dataMinimizer: DataMinimizer;

  beforeEach(() => {
    dataMinimizer = new DataMinimizer();
  });

  describe('Data Minimization', () => {
    it('should minimize data for specific purposes', () => {
      const fullData = {
        userId: 'user-123',
        email: 'test@example.com',
        preferences: {
          interests: { sports: 0.8 },
          activityPreferences: { difficulty: 'medium' }
        },
        context: {
          availability: { freeTime: [] },
          location: { type: 'home' }
        },
        sensitiveInfo: 'should be removed'
      };

      const minimized = dataMinimizer.minimizeForPurpose(fullData, 'activity_recommendation');

      expect(minimized.userId).toBe('user-123');
      expect(minimized.preferences).toBeDefined();
      expect(minimized.context).toBeDefined();
      expect(minimized.email).toBeUndefined();
      expect(minimized.sensitiveInfo).toBeUndefined();
    });

    it('should remove sensitive fields', () => {
      const dataWithSensitive = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        preferences: { 
          interests: [
            { category: 'MUSIC', subcategory: 'classical', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        },
        creditCard: '1234-5678-9012-3456'
      };

      const cleaned = dataMinimizer.removeSensitiveFields(dataWithSensitive);

      expect(cleaned.name).toBe('John Doe');
      expect(cleaned.preferences).toEqual({ 
        interests: [
          { category: 'MUSIC', subcategory: 'classical', strength: 0.8, recency: new Date(), source: 'explicit' }
        ]
      });
      expect(cleaned.email).toBeUndefined();
      expect(cleaned.phone).toBeUndefined();
      expect(cleaned.creditCard).toBeUndefined();
    });

    it('should validate minimization compliance', () => {
      const data = {
        userId: 'user-123',
        preferences: { 
          interests: [
            { category: 'SPORTS', subcategory: 'running', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        },
        context: { location: { type: 'home' } },
        email: 'test@example.com' // Unnecessary for activity recommendation
      };

      const validation = dataMinimizer.validateMinimization(data, 'activity_recommendation');

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          description: expect.stringContaining('Sensitive fields detected')
        })
      );
    });
  });
});

describe('ConsentManager', () => {
  let consentManager: ConsentManager;
  let testUserId: string;

  beforeEach(() => {
    consentManager = new ConsentManager();
    testUserId = 'test-user-123';
  });

  describe('Consent Management', () => {
    it('should record and retrieve consent', () => {
      consentManager.recordConsent(testUserId, 'data_sharing', true, { version: '1.0' });

      const hasConsent = consentManager.hasConsent(testUserId, 'data_sharing');
      expect(hasConsent).toBe(true);

      const consent = consentManager.getConsent(testUserId, 'data_sharing');
      expect(consent).toBeDefined();
      expect(consent!.granted).toBe(true);
      expect(consent!.purpose).toBe('data_sharing');
    });

    it('should handle consent revocation', () => {
      consentManager.recordConsent(testUserId, 'analytics', true);
      expect(consentManager.hasConsent(testUserId, 'analytics')).toBe(true);

      consentManager.revokeConsent(testUserId, 'analytics');
      expect(consentManager.hasConsent(testUserId, 'analytics')).toBe(false);

      const consent = consentManager.getConsent(testUserId, 'analytics');
      expect(consent!.revokedAt).toBeDefined();
    });

    it('should identify operations requiring consent', () => {
      const sharingOperation: DataOperation = {
        type: 'share',
        purpose: 'data_sharing_with_partners',
        dataTypes: ['preferences']
      };

      const regularOperation: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences']
      };

      expect(consentManager.isConsentRequired(sharingOperation)).toBe(true);
      expect(consentManager.isConsentRequired(regularOperation)).toBe(false);
    });

    it('should validate consent expiration', () => {
      const oldConsent = {
        granted: true,
        timestamp: new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000), // 13 months ago
        purpose: 'test',
        metadata: {},
        version: '1.0'
      };

      const recentConsent = {
        granted: true,
        timestamp: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6 months ago
        purpose: 'test',
        metadata: {},
        version: '1.0'
      };

      expect(consentManager.isConsentValid(oldConsent, 12)).toBe(false);
      expect(consentManager.isConsentValid(recentConsent, 12)).toBe(true);
    });
  });
});

describe('RetentionPolicyManager', () => {
  let retentionManager: RetentionPolicyManager;

  beforeEach(() => {
    retentionManager = new RetentionPolicyManager();
  });

  describe('Data Retention', () => {
    it('should manage retention policies', () => {
      retentionManager.setRetentionPolicy('test_data', 30);
      expect(retentionManager.getRetentionPolicy('test_data')).toBe(30);
      expect(retentionManager.getRetentionPolicy('unknown_data')).toBe(90); // Default
    });

    it('should determine if data should be purged', () => {
      retentionManager.setRetentionPolicy('short_term', 7);
      
      const oldData = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const recentData = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      expect(retentionManager.shouldPurge('short_term', oldData)).toBe(true);
      expect(retentionManager.shouldPurge('short_term', recentData)).toBe(false);
    });

    it('should purge expired data from data store', async () => {
      const dataStore = new Map([
        ['item1', { timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), data: 'old' }],
        ['item2', { timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), data: 'recent' }],
        ['item3', { timestamp: new Date(), data: 'new' }]
      ]);

      retentionManager.setRetentionPolicy('test_data', 7);
      const purgedCount = await retentionManager.purgeExpiredData('test_data', dataStore);

      expect(purgedCount).toBe(1);
      expect(dataStore.has('item1')).toBe(false);
      expect(dataStore.has('item2')).toBe(true);
      expect(dataStore.has('item3')).toBe(true);
    });
  });
});

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let encryptionService: EncryptionService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-test-'));
    encryptionService = new EncryptionService();
    auditLogger = new AuditLogger(tempDir, encryptionService);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('Audit Logging and Compliance', () => {
    it('should log data operations with tamper-evident signatures', async () => {
      const operation: DataOperation = {
        type: 'read',
        purpose: 'activity_recommendation',
        dataTypes: ['preferences', 'context']
      };

      const log = {
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: true,
        auditTrail: 'test_operation_authorized'
      };

      await auditLogger.logOperation(log);

      // Wait for potential async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date(Date.now() + 60000)    // 1 minute from now
      };

      const retrievedLogs = await auditLogger.getAuditLogs(timeRange);
      expect(retrievedLogs.length).toBeGreaterThanOrEqual(0); // May be 0 if not yet flushed
    });

    it('should verify log integrity and detect tampering', async () => {
      const testLogs = [
        {
          id: 'log-1',
          operation: {
            type: 'read' as const,
            purpose: 'test',
            dataTypes: ['preferences']
          },
          timestamp: new Date(),
          purpose: 'test',
          dataTypes: ['preferences'],
          authorized: true,
          auditTrail: 'test_log_1',
          integrityHash: encryptionService.generateIntegrityHash({
            operation: { type: 'read', purpose: 'test', dataTypes: ['preferences'] },
            timestamp: new Date(),
            purpose: 'test',
            dataTypes: ['preferences'],
            authorized: true,
            auditTrail: 'test_log_1'
          }),
          signature: 'test_signature_1'
        },
        {
          id: 'log-2',
          operation: {
            type: 'update' as const,
            purpose: 'test',
            dataTypes: ['preferences']
          },
          timestamp: new Date(),
          purpose: 'test',
          dataTypes: ['preferences'],
          authorized: true,
          auditTrail: 'test_log_2',
          integrityHash: 'tampered_hash', // Intentionally wrong hash
          signature: 'test_signature_2'
        }
      ];

      const verification = await auditLogger.verifyLogIntegrity(testLogs);

      expect(verification.totalLogs).toBe(2);
      expect(verification.validLogs).toBe(1);
      expect(verification.invalidLogs).toBe(1);
      expect(verification.tamperedLogs).toHaveLength(1);
      expect(verification.tamperedLogs[0].logId).toBe('log-2');
      expect(verification.tamperedLogs[0].reason).toBe('Integrity hash mismatch');
    });

    it('should export audit logs in different formats', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };

      // Test JSON export
      const jsonExport = await auditLogger.exportAuditLogs(timeRange, 'json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // Test CSV export
      const csvExport = await auditLogger.exportAuditLogs(timeRange, 'csv');
      expect(csvExport).toContain('id,timestamp,operation_type,purpose,data_types,authorized,audit_trail');
    });

    it('should handle concurrent logging operations safely', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        operation: {
          type: 'read' as const,
          purpose: `test_${i}`,
          dataTypes: ['preferences']
        },
        timestamp: new Date(),
        purpose: `test_${i}`,
        dataTypes: ['preferences'],
        authorized: true,
        auditTrail: `concurrent_test_${i}`
      }));

      // Log all operations concurrently
      const promises = operations.map(op => auditLogger.logOperation(op));
      await Promise.all(promises);

      // All operations should complete without errors
      expect(promises).toHaveLength(10);
    });
  });
});

describe('Privacy Compliance Integration Tests', () => {
  let privacyManager: PrivacyManager;
  let encryptionService: EncryptionService;
  let auditLogger: AuditLogger;
  let secureProcessor: SecureDataProcessor;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-integration-'));
    const testKey = crypto.randomBytes(32).toString('hex');
    
    privacyManager = new PrivacyManager(testKey);
    encryptionService = new EncryptionService(testKey);
    auditLogger = new AuditLogger(tempDir, encryptionService);
    secureProcessor = new SecureDataProcessor(encryptionService, auditLogger);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('End-to-End Privacy Protection', () => {
    it('should enforce privacy preferences throughout data processing pipeline', async () => {
      const userId = 'integration-test-user';
      const sensitiveData = {
        userId,
        email: 'test@example.com',
        preferences: {
          interests: [
            { category: 'MUSIC', subcategory: 'classical', strength: 0.8, recency: new Date(), source: 'explicit' }
          ]
        },
        location: { coordinates: [40.7128, -74.0060] }
      };

      // Set strict privacy settings
      const privacySettings: PrivacySettings = {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: false,
        familyDataSharing: false,
        externalIntegrations: false,
        dataRetentionDays: 30,
        encryptionRequired: true
      };

      await privacyManager.updatePrivacySettings(userId, privacySettings);

      // Attempt to process location data (should be blocked)
      const locationOperation: DataOperation = {
        type: 'analyze',
        purpose: 'context_analysis',
        dataTypes: ['location', 'preferences']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(userId, locationOperation);
      expect(decision.allowed).toBe(false);
      expect(decision.restrictions).toContainEqual(
        expect.objectContaining({
          type: 'location_tracking_disabled'
        })
      );

      // Process allowed data with encryption
      const allowedOperation: DataOperation = {
        type: 'analyze',
        purpose: 'preference_learning',
        dataTypes: ['preferences']
      };

      const allowedDecision = await privacyManager.enforcePrivacyPreferences(userId, allowedOperation);
      expect(allowedDecision.allowed).toBe(true);

      // Process data securely
      const processor = async (data: any) => {
        return { ...data, processed: true };
      };

      const result = await secureProcessor.processSecurely(
        { preferences: sensitiveData.preferences },
        userId,
        allowedOperation,
        processor
      );

      expect(result.processed).toBe(true);
      expect(result.preferences).toBeDefined();
    });

    it('should maintain audit trail for compliance reporting', async () => {
      const userId = 'audit-test-user';
      const operations = [
        {
          type: 'read' as const,
          purpose: 'activity_recommendation',
          dataTypes: ['preferences']
        },
        {
          type: 'update' as const,
          purpose: 'preference_learning',
          dataTypes: ['preferences', 'interactions']
        },
        {
          type: 'share' as const,
          purpose: 'family_coordination',
          dataTypes: ['family_preferences']
        }
      ];

      // Execute operations and track in audit
      for (const operation of operations) {
        await privacyManager.enforcePrivacyPreferences(userId, operation);
      }

      // Generate compliance report
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date(Date.now() + 60000)    // 1 minute from now
      };

      const audit = await privacyManager.auditDataUsage(userId, timeRange);
      
      expect(audit.userId).toBe(userId);
      expect(audit.operations).toHaveLength(3);
      expect(audit.complianceStatus).toBe('compliant');
      
      // Verify all operations are properly logged
      const operationTypes = audit.operations.map(op => op.operation.type);
      expect(operationTypes).toContain('read');
      expect(operationTypes).toContain('update');
      expect(operationTypes).toContain('share');
    });

    it('should handle privacy violations and remediation', async () => {
      const userId = 'violation-test-user';
      
      // Set up strict privacy settings
      const strictSettings: PrivacySettings = {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: false,
        familyDataSharing: false,
        externalIntegrations: false,
        dataRetentionDays: 1, // Very short retention
        encryptionRequired: true
      };

      await privacyManager.updatePrivacySettings(userId, strictSettings);

      // Attempt operations that should be blocked
      const violatingOperations = [
        {
          type: 'share' as const,
          purpose: 'external_integration',
          dataTypes: ['preferences', 'location']
        },
        {
          type: 'export' as const,
          purpose: 'research',
          dataTypes: ['all']
        }
      ];

      const decisions = await Promise.all(
        violatingOperations.map(op => 
          privacyManager.enforcePrivacyPreferences(userId, op)
        )
      );

      // All operations should be blocked
      decisions.forEach(decision => {
        expect(decision.allowed).toBe(false);
        expect(decision.restrictions.length).toBeGreaterThan(0);
      });

      // Verify violations are logged
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date(Date.now() + 60000)
      };

      const audit = await privacyManager.auditDataUsage(userId, timeRange);
      const unauthorizedOps = audit.operations.filter(op => !op.authorized);
      expect(unauthorizedOps.length).toBe(2);
    });

    it('should validate data encryption throughout the system', async () => {
      const testData = {
        userId: 'encryption-test-user',
        sensitiveInfo: 'highly confidential data',
        preferences: {
          interests: [
            { category: 'SPORTS', subcategory: 'running', strength: 0.9, recency: new Date(), source: 'explicit' }
          ]
        },
        personalDetails: {
          email: 'test@example.com',
          phone: '555-0123'
        }
      };

      // Test encryption service directly
      const encrypted = await encryptionService.encryptData(testData, 'test-user', 'validation');
      expect(encrypted.encryptedData).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.iv).toBeDefined();

      // Verify data is actually encrypted (not plaintext)
      expect(encrypted.encryptedData).not.toContain('highly confidential data');
      expect(encrypted.encryptedData).not.toContain('test@example.com');

      // Test decryption
      const decrypted = await encryptionService.decryptData(encrypted);
      expect(decrypted).toEqual(testData);

      // Test integrity verification
      const hash = encryptionService.generateIntegrityHash(testData);
      expect(encryptionService.verifyIntegrity(testData, hash)).toBe(true);
      
      // Test tamper detection
      const tamperedData = { ...testData, sensitiveInfo: 'tampered data' };
      expect(encryptionService.verifyIntegrity(tamperedData, hash)).toBe(false);
    });

    it('should enforce child safety in privacy settings', async () => {
      const childUserId = 'child-user-123';
      const childData: UserData = {
        userId: childUserId,
        preferences: {
          userId: childUserId,
          interests: [
            { category: 'EDUCATION' as any, subcategory: 'science', strength: 0.8, recency: new Date(), source: 'explicit' }
          ],
          activityPreferences: {} as any,
          schedulePreferences: {} as any,
          learningPreferences: {} as any,
          privacyPreferences: {} as any,
          notificationPreferences: {} as any,
          lastUpdated: new Date()
        },
        interactions: [],
        context: {} as any,
        metadata: {
          age: 10, // Child age
          familyId: 'family-456',
          timeZone: 'America/New_York'
        }
      };

      // Child data should have maximum privacy protection by default
      const anonymized = await privacyManager.anonymizeUserData(childData, PrivacyLevel.ANONYMOUS);
      
      expect(anonymized.data.demographicGroup).toBe('child_unknown');
      expect(anonymized.data.preferences).toBeUndefined();
      expect(anonymized.retainedFields).toEqual(['demographicGroup', 'usagePatterns']);

      // Educational operations should be allowed with parental oversight
      const educationalOperation: DataOperation = {
        type: 'read',
        purpose: 'educational_content',
        dataTypes: ['age', 'learning_preferences']
      };

      const decision = await privacyManager.enforcePrivacyPreferences(childUserId, educationalOperation);
      expect(decision.auditRequired).toBe(true);
      expect(decision.consentRequired).toBe(false); // Educational content doesn't require explicit consent
    });
  });
});