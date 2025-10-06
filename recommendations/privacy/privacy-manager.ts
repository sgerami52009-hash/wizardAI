/**
 * Privacy Manager Implementation
 * Ensures privacy-preserving operation and manages user data protection
 * across all recommendation processes
 */

import * as crypto from 'crypto';
import { IPrivacyManager } from '../interfaces';
import {
  PrivacyDecision,
  DataOperation,
  AnonymizedData,
  DataUsageAudit,
  PrivacySettings,
  ValidationResult,
  UserData,
  TimeRange,
  DataOperationLog,
  ValidationIssue,
  DataRestriction
} from '../types';
import { PrivacyLevel } from '../enums';

/**
 * Privacy Manager class implementing comprehensive data protection
 * and privacy-preserving operations for the recommendations engine
 */
export class PrivacyManager implements IPrivacyManager {
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly auditLogs: Map<string, DataOperationLog[]> = new Map();
  private readonly userPrivacySettings: Map<string, PrivacySettings> = new Map();
  private readonly dataRetentionPolicies: Map<string, number> = new Map();

  constructor(encryptionKey?: string) {
    // Use provided key or generate a secure one
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : crypto.randomBytes(32);
    
    // Initialize default retention policies (in days)
    this.dataRetentionPolicies.set('interactions', 90);
    this.dataRetentionPolicies.set('preferences', 365);
    this.dataRetentionPolicies.set('context', 30);
    this.dataRetentionPolicies.set('recommendations', 60);
    this.dataRetentionPolicies.set('audit_logs', 1095); // 3 years for compliance
  }

  /**
   * Enforces privacy preferences for a given data operation
   */
  async enforcePrivacyPreferences(userId: string, operation: DataOperation): Promise<PrivacyDecision> {
    try {
      const userSettings = await this.getUserPrivacySettings(userId);
      const restrictions: DataRestriction[] = [];
      let allowed = true;
      let anonymizationRequired = false;
      let consentRequired = false;
      let auditRequired = true; // Always audit for compliance

      // Check data sharing preferences
      if (operation.type === 'share' || operation.type === 'export') {
        if (userSettings.dataSharing === PrivacyLevel.PRIVATE) {
          allowed = false;
          restrictions.push({
            type: 'data_sharing_blocked',
            description: 'User has disabled data sharing',
            scope: ['all']
          });
        } else if (userSettings.dataSharing === PrivacyLevel.ANONYMOUS) {
          anonymizationRequired = true;
          restrictions.push({
            type: 'anonymization_required',
            description: 'Data must be anonymized before sharing',
            scope: ['personal_identifiers', 'location_data', 'behavioral_patterns']
          });
        }
      }

      // Check location tracking preferences
      if (operation.dataTypes?.includes('location') && !userSettings.locationTracking) {
        if (operation.type === 'read' || operation.type === 'analyze') {
          allowed = false;
          restrictions.push({
            type: 'location_tracking_disabled',
            description: 'User has disabled location tracking',
            scope: ['location_data', 'geo_context']
          });
        }
      }

      // Check behavior analysis preferences
      if (operation.dataTypes?.includes('behavior') && !userSettings.behaviorAnalysis) {
        if (operation.type === 'analyze') {
          allowed = false;
          restrictions.push({
            type: 'behavior_analysis_disabled',
            description: 'User has disabled behavior analysis',
            scope: ['interaction_patterns', 'preference_learning']
          });
        }
      }

      // Check family data sharing
      if (operation.dataTypes?.includes('family') && !userSettings.familyDataSharing) {
        restrictions.push({
          type: 'family_data_restricted',
          description: 'Family data sharing is disabled',
          scope: ['family_preferences', 'shared_activities']
        });
        anonymizationRequired = true;
      }

      // Check external integrations
      if (operation.purpose.includes('integration') && !userSettings.externalIntegrations) {
        allowed = false;
        restrictions.push({
          type: 'external_integration_blocked',
          description: 'External integrations are disabled',
          scope: ['third_party_services', 'api_calls']
        });
      }

      // Require consent for sensitive operations
      if (operation.type === 'export' || operation.purpose.includes('research')) {
        consentRequired = true;
      }

      // Log the privacy decision
      await this.logDataOperation(userId, operation, allowed);

      return {
        allowed,
        restrictions,
        anonymizationRequired,
        consentRequired,
        auditRequired
      };
    } catch (error) {
      console.error('Error enforcing privacy preferences:', error);
      // Fail secure - deny access on error
      return {
        allowed: false,
        restrictions: [{
          type: 'system_error',
          description: 'Privacy enforcement system error',
          scope: ['all']
        }],
        anonymizationRequired: true,
        consentRequired: true,
        auditRequired: true
      };
    }
  }

  /**
   * Anonymizes user data according to specified privacy level
   */
  async anonymizeUserData(userData: UserData, privacyLevel: PrivacyLevel): Promise<AnonymizedData> {
    try {
      const anonymizedId = this.generateAnonymousId(userData.userId);
      const retainedFields: string[] = [];
      let anonymizedData: Record<string, any> = {};

      switch (privacyLevel) {
        case PrivacyLevel.PUBLIC:
          // Minimal anonymization - remove direct identifiers only
          anonymizedData = { ...userData };
          delete anonymizedData.userId;
          delete anonymizedData.email;
          delete anonymizedData.name;
          retainedFields.push('preferences', 'interactions', 'context');
          break;

        case PrivacyLevel.FAMILY:
          // Moderate anonymization - remove personal identifiers but keep family context
          anonymizedData = {
            preferences: userData.preferences,
            familyId: userData.metadata.familyId,
            ageGroup: this.getAgeGroup(userData.metadata.age),
            generalLocation: this.generalizeLocation(userData.metadata.location)
          };
          retainedFields.push('preferences', 'familyId', 'ageGroup', 'generalLocation');
          break;

        case PrivacyLevel.PRIVATE:
          // High anonymization - remove all identifiers and generalize data
          anonymizedData = {
            generalPreferences: this.generalizePreferences(userData.preferences),
            ageGroup: this.getAgeGroup(userData.metadata.age),
            timeZone: userData.metadata.timeZone
          };
          retainedFields.push('generalPreferences', 'ageGroup', 'timeZone');
          break;

        case PrivacyLevel.ANONYMOUS:
          // Maximum anonymization - only statistical aggregates
          anonymizedData = {
            demographicGroup: this.getDemographicGroup(userData),
            usagePatterns: this.getGeneralUsagePatterns(userData.interactions)
          };
          retainedFields.push('demographicGroup', 'usagePatterns');
          break;

        default:
          throw new Error(`Unsupported privacy level: ${privacyLevel}`);
      }

      return {
        anonymizedId,
        data: anonymizedData,
        privacyLevel,
        anonymizationMethod: `k-anonymity_${privacyLevel}`,
        retainedFields
      };
    } catch (error) {
      console.error('Error anonymizing user data:', error);
      throw new Error('Data anonymization failed');
    }
  }

  /**
   * Audits data usage for a specific user and time range
   */
  async auditDataUsage(userId: string, timeRange: TimeRange): Promise<DataUsageAudit> {
    try {
      const userLogs = this.auditLogs.get(userId) || [];
      const operations = userLogs.filter(log => 
        log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );

      const issues: string[] = [];
      const recommendations: string[] = [];
      let complianceStatus: 'compliant' | 'warning' | 'violation' = 'compliant';

      // Check for compliance issues
      const unauthorizedOperations = operations.filter(op => !op.authorized);
      if (unauthorizedOperations.length > 0) {
        complianceStatus = 'violation';
        issues.push(`${unauthorizedOperations.length} unauthorized data operations detected`);
        recommendations.push('Review and strengthen access controls');
      }

      // Check data retention compliance
      const retentionViolations = await this.checkRetentionCompliance(userId, operations);
      if (retentionViolations.length > 0) {
        complianceStatus = complianceStatus === 'violation' ? 'violation' : 'warning';
        issues.push(...retentionViolations);
        recommendations.push('Implement automated data purging');
      }

      // Check for excessive data collection
      const dataTypes = new Set(operations.flatMap(op => op.dataTypes));
      if (dataTypes.size > 10) {
        complianceStatus = complianceStatus === 'violation' ? 'violation' : 'warning';
        issues.push('Potentially excessive data collection detected');
        recommendations.push('Review data minimization practices');
      }

      return {
        userId,
        timeRange,
        operations,
        complianceStatus,
        issues,
        recommendations
      };
    } catch (error) {
      console.error('Error auditing data usage:', error);
      throw new Error('Data usage audit failed');
    }
  }

  /**
   * Updates privacy settings for a user
   */
  async updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<void> {
    try {
      // Validate settings
      const validation = await this.validatePrivacySettings(settings);
      if (!validation.valid) {
        throw new Error(`Invalid privacy settings: ${validation.issues.map(i => i.description).join(', ')}`);
      }

      // Store encrypted settings
      const encryptedSettings = await this.encryptUserData(settings);
      this.userPrivacySettings.set(userId, settings);

      // Log the settings update
      await this.logDataOperation(userId, {
        type: 'update',
        purpose: 'privacy_settings_update',
        dataTypes: ['privacy_preferences']
      }, true);

      // Apply data retention policy changes
      if (settings.dataRetentionDays !== undefined) {
        await this.updateRetentionPolicy(userId, settings.dataRetentionDays);
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new Error('Privacy settings update failed');
    }
  }

  /**
   * Validates data minimization for an operation
   */
  async validateDataMinimization(operation: DataOperation): Promise<ValidationResult> {
    try {
      const issues: ValidationIssue[] = [];
      let complianceScore = 1.0;

      // Check if data types are necessary for the purpose
      const necessaryDataTypes = this.getNecessaryDataTypes(operation.purpose);
      const unnecessaryTypes = operation.dataTypes?.filter(type => 
        !necessaryDataTypes.includes(type)
      ) || [];

      if (unnecessaryTypes.length > 0) {
        issues.push({
          severity: 'medium',
          description: `Unnecessary data types requested: ${unnecessaryTypes.join(', ')}`,
          field: 'dataTypes',
          suggestedFix: `Remove unnecessary data types: ${unnecessaryTypes.join(', ')}`
        });
        complianceScore -= 0.3;
      }

      // Check for overly broad data collection
      if (operation.dataTypes?.includes('all') || (operation.dataTypes && operation.dataTypes.length > 5)) {
        issues.push({
          severity: 'high',
          description: 'Overly broad data collection detected',
          field: 'dataTypes',
          suggestedFix: 'Specify only necessary data types'
        });
        complianceScore -= 0.5;
      }

      // Check purpose specificity
      if (!operation.purpose || operation.purpose.length < 10) {
        issues.push({
          severity: 'medium',
          description: 'Purpose description is too vague',
          field: 'purpose',
          suggestedFix: 'Provide specific, detailed purpose description'
        });
        complianceScore -= 0.2;
      }

      return {
        valid: issues.length === 0 || issues.every(i => i.severity !== 'critical'),
        issues,
        recommendations: issues.map(i => i.suggestedFix),
        complianceScore: Math.max(0, complianceScore)
      };
    } catch (error) {
      console.error('Error validating data minimization:', error);
      return {
        valid: false,
        issues: [{
          severity: 'critical',
          description: 'Data minimization validation failed',
          suggestedFix: 'Review data collection practices'
        }],
        recommendations: ['Review data collection practices'],
        complianceScore: 0
      };
    }
  }

  /**
   * Encrypts user data using AES-256-GCM
   */
  async encryptUserData(data: any): Promise<string> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('recommendations-engine'));

      const dataString = JSON.stringify(data);
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        encrypted,
        authTag: authTag.toString('hex')
      });
    } catch (error) {
      console.error('Error encrypting user data:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypts user data using AES-256-GCM
   */
  async decryptUserData(encryptedData: string): Promise<any> {
    try {
      const { iv, encrypted, authTag } = JSON.parse(encryptedData);
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('recommendations-engine'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error decrypting user data:', error);
      throw new Error('Data decryption failed');
    }
  }

  // Private helper methods

  private async getUserPrivacySettings(userId: string): Promise<PrivacySettings> {
    const settings = this.userPrivacySettings.get(userId);
    if (settings) {
      return settings;
    }

    // Return default privacy settings
    return {
      dataSharing: PrivacyLevel.PRIVATE,
      locationTracking: false,
      behaviorAnalysis: true,
      familyDataSharing: false,
      externalIntegrations: false,
      dataRetentionDays: 90,
      encryptionRequired: true
    };
  }

  private generateAnonymousId(userId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(userId + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  }

  private getAgeGroup(age?: number): string {
    if (!age) return 'unknown';
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age < 35) return 'young_adult';
    if (age < 55) return 'adult';
    return 'senior';
  }

  private generalizeLocation(location?: any): string {
    if (!location) return 'unknown';
    // Return general region instead of specific coordinates
    return location.region || location.country || 'unknown';
  }

  private generalizePreferences(preferences: any): any {
    // Remove specific preferences and keep only general categories
    return {
      categories: Object.keys(preferences.interests || {}),
      activityLevel: preferences.activityLevel || 'medium',
      timePreferences: preferences.timePreferences?.map((p: any) => p.timeOfDay) || []
    };
  }

  private getDemographicGroup(userData: UserData): string {
    const ageGroup = this.getAgeGroup(userData.metadata.age);
    const location = this.generalizeLocation(userData.metadata.location);
    return `${ageGroup}_${location}`;
  }

  private getGeneralUsagePatterns(interactions?: any[]): any {
    if (!interactions || interactions.length === 0) {
      return { frequency: 'low', patterns: [] };
    }

    return {
      frequency: interactions.length > 50 ? 'high' : interactions.length > 20 ? 'medium' : 'low',
      patterns: ['general_usage'] // Highly generalized patterns
    };
  }

  private async logDataOperation(userId: string, operation: DataOperation, authorized: boolean): Promise<void> {
    const log: DataOperationLog = {
      operation,
      timestamp: new Date(),
      purpose: operation.purpose,
      dataTypes: operation.dataTypes || [],
      authorized,
      auditTrail: `${operation.type}_${operation.purpose}_${authorized ? 'authorized' : 'denied'}`
    };

    const userLogs = this.auditLogs.get(userId) || [];
    userLogs.push(log);
    this.auditLogs.set(userId, userLogs);

    // Cleanup old logs based on retention policy
    await this.cleanupOldLogs(userId);
  }

  private async checkRetentionCompliance(userId: string, operations: DataOperationLog[]): Promise<string[]> {
    const violations: string[] = [];
    const now = new Date();

    for (const [dataType, retentionDays] of this.dataRetentionPolicies.entries()) {
      const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
      const oldOperations = operations.filter(op => 
        op.dataTypes.includes(dataType) && op.timestamp < cutoffDate
      );

      if (oldOperations.length > 0) {
        violations.push(`${oldOperations.length} ${dataType} operations exceed retention policy`);
      }
    }

    return violations;
  }

  private getNecessaryDataTypes(purpose: string): string[] {
    const purposeDataMap: Record<string, string[]> = {
      'activity_recommendation': ['preferences', 'context', 'availability'],
      'schedule_optimization': ['calendar', 'preferences', 'context'],
      'educational_content': ['age', 'learning_preferences', 'progress'],
      'household_efficiency': ['family_data', 'routines', 'preferences'],
      'privacy_settings_update': ['privacy_preferences'],
      'user_feedback': ['interactions', 'preferences'],
      'context_analysis': ['location', 'activity', 'environment'],
      'learning_adaptation': ['interactions', 'feedback', 'preferences']
    };

    return purposeDataMap[purpose] || [];
  }

  private async validatePrivacySettings(settings: PrivacySettings): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    if (settings.dataRetentionDays < 1 || settings.dataRetentionDays > 3650) {
      issues.push({
        severity: 'high',
        description: 'Data retention days must be between 1 and 3650',
        field: 'dataRetentionDays',
        suggestedFix: 'Set retention period between 1 and 3650 days'
      });
    }

    if (!Object.values(PrivacyLevel).includes(settings.dataSharing)) {
      issues.push({
        severity: 'critical',
        description: 'Invalid privacy level for data sharing',
        field: 'dataSharing',
        suggestedFix: 'Use valid privacy level from enum'
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations: issues.map(i => i.suggestedFix),
      complianceScore: issues.length === 0 ? 1.0 : 0.5
    };
  }

  private async updateRetentionPolicy(userId: string, retentionDays: number): Promise<void> {
    // Update user-specific retention policy
    this.dataRetentionPolicies.set(`user_${userId}`, retentionDays);
    
    // Trigger cleanup of old data
    await this.cleanupOldLogs(userId);
  }

  private async cleanupOldLogs(userId: string): Promise<void> {
    const userLogs = this.auditLogs.get(userId) || [];
    const retentionDays = this.dataRetentionPolicies.get('audit_logs') || 1095;
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    const filteredLogs = userLogs.filter(log => log.timestamp >= cutoffDate);
    this.auditLogs.set(userId, filteredLogs);
  }
}