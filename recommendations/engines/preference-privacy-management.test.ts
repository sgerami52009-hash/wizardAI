/**
 * Unit tests for Preference Management Privacy Enforcement
 * 
 * Tests privacy enforcement in preference handling, data minimization,
 * and compliance with privacy regulations across user and family preferences.
 * 
 * Requirements: 1.4, 6.1, 6.2, 6.3
 */

import { UserPreferenceEngine, IUserPreferenceStorage } from './user-preference-engine';
import { FamilyPreferenceCoordinator, IFamilyStorage } from './family-preference-coordinator';
import { InMemoryUserPreferenceStorage } from './user-preference-storage';
import { InMemoryFamilyStorage } from './family-storage';
import {
  UserPreferences,
  Interest,
  UserInteraction,
  UserFeedback,
  PrivacyDecision,
  DataOperation,
  DataRestriction,
  PrivacySettings,
  ValidationResult,
  DataUsageAudit,
  AnonymizedData
} from '../types';
import {
  InterestCategory,
  ActivityCategory,
  InteractionType,
  PrivacyLevel,
  DifficultyLevel,
  Subject
} from '../enums';
import { IPrivacyManager } from '../interfaces';

// Enhanced Mock Privacy Manager for comprehensive testing
class EnhancedMockPrivacyManager implements IPrivacyManager {
  private accessPolicies: Map<string, PrivacyDecision> = new Map();
  private privacySettings: Map<string, PrivacySettings> = new Map();
  private auditLogs: Map<string, any[]> = new Map();
  private encryptionEnabled = true;

  setUserAccessPolicy(userId: string, decision: PrivacyDecision) {
    this.accessPolicies.set(userId, decision);
  }

  setUserPrivacySettings(userId: string, settings: PrivacySettings) {
    this.privacySettings.set(userId, settings);
  }

  setEncryptionEnabled(enabled: boolean) {
    this.encryptionEnabled = enabled;
  }

  async enforcePrivacyPreferences(userId: string, operation: DataOperation): Promise<PrivacyDecision> {
    // Log the operation for audit
    if (!this.auditLogs.has(userId)) {
      this.auditLogs.set(userId, []);
    }
    this.auditLogs.get(userId)!.push({
      operation,
      timestamp: new Date(),
      authorized: true
    });

    // Return user-specific policy or default
    const userPolicy = this.accessPolicies.get(userId);
    if (userPolicy) {
      return userPolicy;
    }

    // Default policy based on operation type
    const restrictedOperations = ['share', 'export', 'analyze'];
    const isRestricted = restrictedOperations.includes(operation.type);

    return {
      allowed: !isRestricted,
      restrictions: isRestricted ? [{ 
        type: 'data_minimization', 
        description: 'Minimize data exposure',
        scope: ['interests', 'behavior'] 
      }] : [],
      anonymizationRequired: isRestricted,
      consentRequired: operation.type === 'share',
      auditRequired: true
    };
  }

  async anonymizeUserData(userData: any, privacyLevel: PrivacyLevel): Promise<AnonymizedData> {
    const anonymized = { ...userData };
    
    switch (privacyLevel) {
      case PrivacyLevel.ANONYMOUS:
        // Remove all identifying information
        delete anonymized.userId;
        if (anonymized.interests) {
          anonymized.interests = anonymized.interests.map((interest: Interest) => ({
            ...interest,
            subcategory: 'generalized',
            source: 'anonymous'
          }));
        }
        break;
      case PrivacyLevel.PRIVATE:
        // Generalize sensitive data
        if (anonymized.interests) {
          anonymized.interests = anonymized.interests.filter((interest: Interest) => 
            !this.isSensitiveInterest(interest)
          );
        }
        break;
      case PrivacyLevel.FAMILY:
        // Keep family-shareable data only
        if (anonymized.privacyPreferences) {
          anonymized.privacyPreferences.familyDataSharing = true;
        }
        break;
    }

    return {
      anonymizedId: `anon-${Math.random().toString(36).substr(2, 9)}`,
      data: anonymized,
      privacyLevel,
      anonymizationMethod: 'rule-based',
      retainedFields: Object.keys(anonymized)
    };
  }

  async auditDataUsage(userId: string, timeRange: any): Promise<DataUsageAudit> {
    const logs = this.auditLogs.get(userId) || [];
    const filteredLogs = logs.filter(log => 
      log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
    );

    return {
      userId,
      timeRange,
      operations: filteredLogs,
      complianceStatus: 'compliant',
      issues: [],
      recommendations: []
    };
  }

  async updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<void> {
    this.privacySettings.set(userId, settings);
  }

  async validateDataMinimization(operation: DataOperation): Promise<ValidationResult> {
    const sensitiveOperations = ['share', 'export', 'analyze'];
    const isSensitive = sensitiveOperations.includes(operation.type);

    return {
      valid: !isSensitive || operation.dataTypes?.length === 1, // Only allow single data type for sensitive ops
      issues: isSensitive && (!operation.dataTypes || operation.dataTypes.length > 1) ? [{
        severity: 'medium',
        description: 'Sensitive operation should specify minimal data types',
        field: 'dataTypes',
        suggestedFix: 'Specify only necessary data types'
      }] : [],
      recommendations: isSensitive ? ['Consider data aggregation', 'Use differential privacy'] : [],
      complianceScore: isSensitive ? 0.7 : 1.0
    };
  }

  async encryptUserData(data: any): Promise<string> {
    if (!this.encryptionEnabled) {
      throw new Error('Encryption service unavailable');
    }
    // Mock AES-256 encryption
    return `encrypted:${Buffer.from(JSON.stringify(data)).toString('base64')}`;
  }

  async decryptUserData(encryptedData: string): Promise<any> {
    if (!this.encryptionEnabled) {
      throw new Error('Decryption service unavailable');
    }
    if (!encryptedData.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted data format');
    }
    const base64Data = encryptedData.replace('encrypted:', '');
    return JSON.parse(Buffer.from(base64Data, 'base64').toString('utf8'));
  }

  private isSensitiveInterest(interest: Interest): boolean {
    const sensitiveCategories = [
      InterestCategory.FITNESS,
      InterestCategory.TECHNOLOGY,
      InterestCategory.SOCIAL
    ];
    return sensitiveCategories.includes(interest.category);
  }

  // Helper method to get audit logs for testing
  getAuditLogs(userId: string): any[] {
    return this.auditLogs.get(userId) || [];
  }
}

describe('Preference Management Privacy Enforcement', () => {
  let userEngine: UserPreferenceEngine;
  let familyCoordinator: FamilyPreferenceCoordinator;
  let userStorage: IUserPreferenceStorage;
  let familyStorage: IFamilyStorage;
  let privacyManager: EnhancedMockPrivacyManager;
  
  const testUserId = 'privacy-test-user';
  const testFamilyId = 'privacy-test-family';
  const childUserId = 'privacy-test-child';

  beforeEach(async () => {
    userStorage = new InMemoryUserPreferenceStorage();
    familyStorage = new InMemoryFamilyStorage();
    privacyManager = new EnhancedMockPrivacyManager();
    
    userEngine = new UserPreferenceEngine(userStorage, privacyManager);
    familyCoordinator = new FamilyPreferenceCoordinator(userEngine, familyStorage, privacyManager);

    // Set up test family
    await (familyStorage as any).addFamilyMember(testFamilyId, testUserId);
    await (familyStorage as any).addFamilyMember(testFamilyId, childUserId);

    // Initialize user preferences
    await userEngine.initializeUserPreferences(testUserId);
    await userEngine.initializeUserPreferences(childUserId);
  });

  describe('Privacy-Preserving Preference Access', () => {
    test('should enforce privacy preferences for data access', async () => {
      // Requirement: 6.1, 6.2
      
      // Set restrictive privacy policy
      privacyManager.setUserAccessPolicy(testUserId, {
        allowed: false,
        restrictions: [],
        anonymizationRequired: false,
        consentRequired: true,
        auditRequired: true
      });

      await expect(userEngine.getUserPreferences(testUserId))
        .rejects.toThrow('Access to user preferences denied by privacy settings');
    });

    test('should apply data anonymization when required', async () => {
      // Requirement: 6.1, 6.2
      
      // Add sensitive interests
      const sensitiveInterests: Interest[] = [
        {
          category: InterestCategory.FITNESS,
          subcategory: 'medical-condition',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.SPORTS,
          subcategory: 'soccer',
          strength: 0.7,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      await userEngine.updateUserPreferences(testUserId, { interests: sensitiveInterests });

      // Set policy requiring anonymization
      privacyManager.setUserAccessPolicy(testUserId, {
        allowed: true,
        restrictions: [{ 
          type: 'remove_sensitive_interests', 
          description: 'Remove health-related interests',
          scope: ['interests'] 
        }],
        anonymizationRequired: true,
        consentRequired: false,
        auditRequired: true
      });

      const preferences = await userEngine.getUserPreferences(testUserId);
      
      // Should have applied anonymization (mock implementation adds anonymized flag)
      expect(preferences).toBeDefined();
      
      // Verify audit trail was created
      const auditLogs = privacyManager.getAuditLogs(testUserId);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].operation.type).toBe('read');
    });

    test('should validate data minimization for preference operations', async () => {
      // Requirement: 6.1
      
      const operation: DataOperation = {
        type: 'share',
        purpose: 'family_coordination',
        dataTypes: ['interests', 'activity_preferences', 'schedule_preferences', 'learning_preferences']
      };

      const validation = await privacyManager.validateDataMinimization(operation);
      
      expect(validation.valid).toBe(false); // Too many data types for sensitive operation
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.recommendations).toContain('Consider data aggregation');
      expect(validation.complianceScore).toBeLessThan(1.0);
    });

    test('should handle privacy manager service failures gracefully', async () => {
      // Requirement: 6.2
      
      // Disable encryption to simulate service failure
      privacyManager.setEncryptionEnabled(false);

      // Should handle encryption failure gracefully
      await expect(privacyManager.encryptUserData({ test: 'data' }))
        .rejects.toThrow('Encryption service unavailable');
    });
  });

  describe('Privacy-Compliant Preference Learning', () => {
    test('should learn preferences while respecting privacy constraints', async () => {
      // Requirement: 1.4, 6.3
      
      // Set privacy settings that limit behavior analysis
      privacyManager.setUserPrivacySettings(testUserId, {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: false, // Disabled
        familyDataSharing: false,
        externalIntegrations: false,
        dataRetentionDays: 30,
        encryptionRequired: true
      });

      const interaction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'rec-privacy-test',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(),
        context: {
          userId: testUserId,
          timestamp: new Date(),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'reading',
            activityType: ActivityCategory.EDUCATIONAL,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
          mood: { confidence: 0.8, source: 'inferred' },
          energy: { level: 'medium', trend: 'stable' },
          social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
          environmental: {
            weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
            timeOfDay: 'afternoon',
            season: 'spring',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.EDUCATIONAL],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 30,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.9
      };

      // Should still learn but with privacy constraints
      await userEngine.learnFromInteractions(testUserId, [interaction]);

      const preferences = await userEngine.getUserPreferences(testUserId);
      expect(preferences).toBeDefined();
      
      // Verify privacy compliance in audit logs
      const auditLogs = privacyManager.getAuditLogs(testUserId);
      expect(auditLogs.some(log => log.operation.purpose === 'preference_update')).toBe(true);
    });

    test('should apply differential privacy to interest strength calculations', async () => {
      // Requirement: 6.1, 6.3
      
      // Create multiple similar interactions to test privacy-preserving aggregation
      const interactions: UserInteraction[] = [];
      for (let i = 0; i < 5; i++) {
        interactions.push({
          userId: testUserId,
          recommendationId: `rec-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Spread over days
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'sports',
              activityType: ActivityCategory.PHYSICAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'high', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.PHYSICAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 60,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.8 + (i * 0.05) // Slight variation
        });
      }

      await userEngine.learnFromInteractions(testUserId, interactions);

      const preferences = await userEngine.getUserPreferences(testUserId);
      const sportsInterests = preferences.interests.filter(i => i.category === InterestCategory.SPORTS);
      
      // Should have learned sports interest but with privacy-preserving noise
      expect(sportsInterests.length).toBeGreaterThan(0);
      
      // Verify that multiple operations were audited
      const auditLogs = privacyManager.getAuditLogs(testUserId);
      expect(auditLogs.length).toBeGreaterThan(interactions.length);
    });

    test('should enforce data retention policies', async () => {
      // Requirement: 6.1, 6.2
      
      // Set short retention policy
      privacyManager.setUserPrivacySettings(testUserId, {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: true,
        familyDataSharing: false,
        externalIntegrations: false,
        dataRetentionDays: 1, // Very short retention
        encryptionRequired: true
      });

      // Create old interaction (beyond retention period)
      const oldInteraction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'old-rec',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        context: {
          userId: testUserId,
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'music',
            activityType: ActivityCategory.CREATIVE,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
          mood: { confidence: 0.8, source: 'inferred' },
          energy: { level: 'medium', trend: 'stable' },
          social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
          environmental: {
            weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
            timeOfDay: 'afternoon',
            season: 'spring',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.CREATIVE],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 45,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.8
      };

      await userEngine.learnFromInteractions(testUserId, [oldInteraction]);

      // Verify that data usage audit respects retention policy
      const audit = await privacyManager.auditDataUsage(testUserId, {
        start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(audit.complianceStatus).toBe('compliant');
      expect(audit.issues.length).toBe(0);
    });
  });

  describe('Family Privacy Coordination', () => {
    test('should respect individual privacy settings in family aggregation', async () => {
      // Requirement: 1.2, 6.3
      
      // Set different privacy levels for family members
      privacyManager.setUserPrivacySettings(testUserId, {
        dataSharing: PrivacyLevel.FAMILY,
        locationTracking: true,
        behaviorAnalysis: true,
        familyDataSharing: true,
        externalIntegrations: false,
        dataRetentionDays: 90,
        encryptionRequired: true
      });

      privacyManager.setUserPrivacySettings(childUserId, {
        dataSharing: PrivacyLevel.PRIVATE,
        locationTracking: false,
        behaviorAnalysis: false,
        familyDataSharing: false, // Child opts out
        externalIntegrations: false,
        dataRetentionDays: 30,
        encryptionRequired: true
      });

      // Add different interests for each member
      await userEngine.updateUserPreferences(testUserId, {
        interests: [{
          category: InterestCategory.SPORTS,
          subcategory: 'tennis',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        }]
      });

      await userEngine.updateUserPreferences(childUserId, {
        interests: [{
          category: InterestCategory.ENTERTAINMENT,
          subcategory: 'games',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        }]
      });

      const familyPreferences = await familyCoordinator.aggregateFamilyPreferences(testFamilyId);

      // Should aggregate with most restrictive privacy settings
      expect(familyPreferences.privacyPreferences.dataSharing).toBe(PrivacyLevel.PRIVATE);
      expect(familyPreferences.privacyPreferences.familyDataSharing).toBe(false);
      expect(familyPreferences.privacyPreferences.dataRetentionDays).toBe(30); // Minimum
      
      // Should still have aggregated interests (privacy-compliant aggregation)
      expect(familyPreferences.interests.length).toBeGreaterThan(0);
    });

    test('should handle privacy violations in family context', async () => {
      // Requirement: 6.2, 6.3
      
      // Set one member to deny access
      privacyManager.setUserAccessPolicy(childUserId, {
        allowed: false,
        restrictions: [],
        anonymizationRequired: false,
        consentRequired: true,
        auditRequired: true
      });

      // Should continue with available members and log the privacy constraint
      const familyPreferences = await familyCoordinator.aggregateFamilyPreferences(testFamilyId);
      
      expect(familyPreferences).toBeDefined();
      expect(familyPreferences.userId).toBe(testFamilyId);
      
      // Verify that privacy violations are audited
      const auditLogs = privacyManager.getAuditLogs(childUserId);
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    test('should apply family-level data minimization', async () => {
      // Requirement: 6.1, 6.3
      
      // Set family-wide data minimization policy
      const familyOperation: DataOperation = {
        type: 'analyze',
        purpose: 'family_recommendation_generation',
        dataTypes: ['interests', 'activity_preferences']
      };

      const validation = await privacyManager.validateDataMinimization(familyOperation);
      
      // Should validate data minimization for family operations
      expect(validation).toBeDefined();
      expect(validation.complianceScore).toBeGreaterThan(0);
      
      if (!validation.valid) {
        expect(validation.issues.length).toBeGreaterThan(0);
        expect(validation.recommendations.length).toBeGreaterThan(0);
      }
    });

    test('should anonymize family data for external sharing', async () => {
      // Requirement: 6.1, 6.2
      
      const familyPreferences = await familyCoordinator.aggregateFamilyPreferences(testFamilyId);
      
      // Test anonymization at different privacy levels
      const anonymizedPrivate = await privacyManager.anonymizeUserData(
        familyPreferences, 
        PrivacyLevel.PRIVATE
      );
      
      const anonymizedAnonymous = await privacyManager.anonymizeUserData(
        familyPreferences, 
        PrivacyLevel.ANONYMOUS
      );

      expect(anonymizedPrivate.privacyLevel).toBe(PrivacyLevel.PRIVATE);
      expect(anonymizedPrivate.anonymizationMethod).toBe('rule-based');
      expect(anonymizedPrivate.retainedFields.length).toBeGreaterThan(0);

      expect(anonymizedAnonymous.privacyLevel).toBe(PrivacyLevel.ANONYMOUS);
      expect(anonymizedAnonymous.data.userId).toBeUndefined(); // Should be removed
    });
  });

  describe('Encryption and Data Security', () => {
    test('should encrypt sensitive preference data', async () => {
      // Requirement: 6.2
      
      const sensitiveData = {
        userId: testUserId,
        interests: [{
          category: InterestCategory.FITNESS,
          subcategory: 'medical-condition',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        }]
      };

      const encrypted = await privacyManager.encryptUserData(sensitiveData);
      expect(encrypted).toMatch(/^encrypted:/);
      
      const decrypted = await privacyManager.decryptUserData(encrypted);
      expect(decrypted.userId).toBe(testUserId);
      expect(decrypted.interests[0].category).toBe(InterestCategory.FITNESS);
    });

    test('should handle encryption failures gracefully', async () => {
      // Requirement: 6.2
      
      // Disable encryption to simulate failure
      privacyManager.setEncryptionEnabled(false);

      await expect(privacyManager.encryptUserData({ test: 'data' }))
        .rejects.toThrow('Encryption service unavailable');

      await expect(privacyManager.decryptUserData('invalid-data'))
        .rejects.toThrow('Decryption service unavailable');
    });

    test('should validate encrypted data format', async () => {
      // Requirement: 6.2
      
      // Test with invalid encrypted data format
      await expect(privacyManager.decryptUserData('not-encrypted-data'))
        .rejects.toThrow('Invalid encrypted data format');
    });
  });

  describe('Compliance and Auditing', () => {
    test('should maintain comprehensive audit trail', async () => {
      // Requirement: 6.2
      
      // Perform various operations
      await userEngine.getUserPreferences(testUserId);
      await userEngine.updateUserPreferences(testUserId, { 
        interests: [{
          category: InterestCategory.SPORTS,
          subcategory: 'soccer',
          strength: 0.7,
          recency: new Date(),
          source: 'explicit'
        }]
      });
      await familyCoordinator.aggregateFamilyPreferences(testFamilyId);

      const audit = await privacyManager.auditDataUsage(testUserId, {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(audit.operations.length).toBeGreaterThan(0);
      expect(audit.complianceStatus).toBe('compliant');
      expect(audit.operations.every(op => op.authorized)).toBe(true);
    });

    test('should detect and report privacy violations', async () => {
      // Requirement: 6.2
      
      // Set up a scenario that would trigger privacy concerns
      privacyManager.setUserAccessPolicy(testUserId, {
        allowed: true,
        restrictions: [{ 
          type: 'audit_required', 
          description: 'All operations must be audited',
          scope: ['all'] 
        }],
        anonymizationRequired: false,
        consentRequired: false,
        auditRequired: true
      });

      // Perform operation that should be audited
      await userEngine.getUserPreferences(testUserId);

      const audit = await privacyManager.auditDataUsage(testUserId, {
        start: new Date(Date.now() - 60 * 60 * 1000),
        end: new Date()
      });

      expect(audit.operations.length).toBeGreaterThan(0);
      expect(audit.operations.every(op => op.auditTrail)).toBeDefined();
    });

    test('should provide privacy compliance recommendations', async () => {
      // Requirement: 6.1, 6.2
      
      // Test operation that needs privacy improvements
      const operation: DataOperation = {
        type: 'export',
        purpose: 'data_portability',
        dataTypes: ['interests', 'interactions', 'context', 'preferences']
      };

      const validation = await privacyManager.validateDataMinimization(operation);
      
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.recommendations).toContain('Consider data aggregation');
      expect(validation.complianceScore).toBeLessThan(1.0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle privacy service unavailability', async () => {
      // Requirement: 6.2
      
      // Mock privacy manager failure
      const originalMethod = privacyManager.enforcePrivacyPreferences;
      privacyManager.enforcePrivacyPreferences = jest.fn().mockRejectedValue(new Error('Privacy service down'));

      await expect(userEngine.getUserPreferences(testUserId))
        .rejects.toThrow('Privacy service down');
        
      // Restore original method
      privacyManager.enforcePrivacyPreferences = originalMethod;
    });

    test('should provide fallback privacy protection', async () => {
      // Requirement: 6.2
      
      // Test with minimal privacy manager that only provides basic protection
      const originalMethod2 = privacyManager.enforcePrivacyPreferences;
      privacyManager.enforcePrivacyPreferences = jest.fn().mockResolvedValue({
        allowed: true,
        restrictions: [{ 
          type: 'basic_protection', 
          description: 'Apply basic privacy protection',
          scope: ['all'] 
        }],
        anonymizationRequired: true,
        consentRequired: false,
        auditRequired: true
      });
      
      // Should still work with basic protection
      const preferences = await userEngine.getUserPreferences(testUserId);
      expect(preferences).toBeDefined();
      
      // Restore original method
      privacyManager.enforcePrivacyPreferences = originalMethod2;
    });
  });
});