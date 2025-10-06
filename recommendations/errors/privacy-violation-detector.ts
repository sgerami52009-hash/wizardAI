/**
 * Privacy violation detection and remediation system
 * Monitors and enforces privacy preferences across the recommendations system
 */

import { PrivacyError } from './error-types';
import { UserContext, UserPreferences } from '../types';

export enum ViolationType {
  UNAUTHORIZED_DATA_ACCESS = 'unauthorized_data_access',
  CONSENT_VIOLATION = 'consent_violation',
  DATA_RETENTION_VIOLATION = 'data_retention_violation',
  CROSS_USER_DATA_LEAK = 'cross_user_data_leak',
  EXTERNAL_DATA_SHARING = 'external_data_sharing',
  INSUFFICIENT_ANONYMIZATION = 'insufficient_anonymization',
  PARENTAL_CONSENT_MISSING = 'parental_consent_missing'
}

export interface PrivacyViolation {
  id: string;
  type: ViolationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  description: string;
  dataInvolved: string[];
  timestamp: Date;
  source: string;
  remediated: boolean;
  remediationActions: RemediationAction[];
}

export interface RemediationAction {
  type: 'data_purge' | 'access_termination' | 'consent_request' | 'notification' | 'audit_log';
  description: string;
  executed: boolean;
  timestamp?: Date;
  result?: string;
}

export interface DataOperation {
  operationType: 'read' | 'write' | 'process' | 'share' | 'store' | 'delete';
  userId: string;
  dataTypes: string[];
  purpose: string;
  requester: string;
  timestamp: Date;
  consentRequired: boolean;
  retentionPeriod?: number;
}

export interface PrivacySettings {
  userId: string;
  dataMinimization: boolean;
  consentRequired: boolean;
  retentionPeriod: number; // days
  allowCrossUserLearning: boolean;
  allowExternalSharing: boolean;
  requireParentalConsent: boolean;
  anonymizationLevel: 'none' | 'basic' | 'strong' | 'differential';
  auditingEnabled: boolean;
}

export class PrivacyViolationDetector {
  private violations: Map<string, PrivacyViolation> = new Map();
  private privacySettings: Map<string, PrivacySettings> = new Map();
  private consentRecords: Map<string, Map<string, Date>> = new Map(); // userId -> purpose -> consentDate
  private dataAccessLog: Array<{ operation: DataOperation; timestamp: Date }> = [];

  async detectViolation(operation: DataOperation): Promise<PrivacyViolation | null> {
    const userSettings = await this.getPrivacySettings(operation.userId);
    
    // Check for violations in priority order (most specific first)
    let violation: PrivacyViolation | null = null;
    
    // Check parental consent first (most specific for children)
    violation = await this.checkParentalConsent(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }
    
    // Check external sharing
    violation = await this.checkExternalSharing(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }
    
    // Check unauthorized access
    violation = await this.checkUnauthorizedAccess(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }
    
    // Check consent violations
    violation = await this.checkConsentViolation(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }
    
    // Check cross-user data leaks
    violation = await this.checkCrossUserLeak(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }
    
    // Check retention violations
    violation = await this.checkRetentionViolation(operation, userSettings);
    if (violation) {
      await this.recordViolation(violation);
      return violation;
    }

    // Log legitimate operation
    this.logDataOperation(operation);
    return null;
  }

  private async checkUnauthorizedAccess(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    // Check if the requester has permission to access this user's data
    const authorizedRequesters = ['recommendation-engine', 'user-interface', 'privacy-manager'];
    
    if (!authorizedRequesters.includes(operation.requester)) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.UNAUTHORIZED_DATA_ACCESS,
        severity: 'high',
        userId: operation.userId,
        description: `Unauthorized access attempt by ${operation.requester}`,
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'access_termination',
            description: 'Terminate unauthorized access immediately',
            executed: false
          },
          {
            type: 'audit_log',
            description: 'Log security incident for review',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async checkConsentViolation(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    if (!settings.consentRequired || !operation.consentRequired) {
      return null;
    }

    const userConsents = this.consentRecords.get(operation.userId);
    const hasConsent = userConsents?.has(operation.purpose);

    if (!hasConsent) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.CONSENT_VIOLATION,
        severity: 'critical',
        userId: operation.userId,
        description: `Operation ${operation.operationType} performed without required consent for ${operation.purpose}`,
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'data_purge',
            description: 'Remove data processed without consent',
            executed: false
          },
          {
            type: 'consent_request',
            description: 'Request proper consent from user',
            executed: false
          },
          {
            type: 'notification',
            description: 'Notify user of consent violation',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async checkRetentionViolation(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    if (operation.operationType !== 'store' && operation.operationType !== 'read') {
      return null;
    }

    // Check if data being accessed is beyond retention period
    const retentionLimit = new Date();
    retentionLimit.setDate(retentionLimit.getDate() - settings.retentionPeriod);

    // This would normally check against actual data timestamps
    // For now, we'll check if the operation specifies a retention period that exceeds settings
    if (operation.retentionPeriod && operation.retentionPeriod > settings.retentionPeriod) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.DATA_RETENTION_VIOLATION,
        severity: 'medium',
        userId: operation.userId,
        description: `Data retention period ${operation.retentionPeriod} days exceeds user limit of ${settings.retentionPeriod} days`,
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'data_purge',
            description: 'Remove data exceeding retention period',
            executed: false
          },
          {
            type: 'notification',
            description: 'Notify user of retention policy enforcement',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async checkCrossUserLeak(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    if (settings.allowCrossUserLearning) {
      return null;
    }

    // Check if operation involves data from multiple users when not allowed
    if (operation.dataTypes.some(type => type.includes('cross_user') || type.includes('family'))) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.CROSS_USER_DATA_LEAK,
        severity: 'high',
        userId: operation.userId,
        description: 'Cross-user data access attempted when not permitted',
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'access_termination',
            description: 'Terminate cross-user data access',
            executed: false
          },
          {
            type: 'data_purge',
            description: 'Remove any cross-user data already accessed',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async checkExternalSharing(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    if (settings.allowExternalSharing) {
      return null;
    }

    // Check if operation involves sharing data externally
    if (operation.operationType === 'share' || operation.requester.includes('external')) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.EXTERNAL_DATA_SHARING,
        severity: 'critical',
        userId: operation.userId,
        description: 'External data sharing attempted when not permitted',
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'access_termination',
            description: 'Prevent external data sharing',
            executed: false
          },
          {
            type: 'notification',
            description: 'Alert user of attempted external sharing',
            executed: false
          },
          {
            type: 'audit_log',
            description: 'Log external sharing attempt',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async checkParentalConsent(
    operation: DataOperation,
    settings: PrivacySettings
  ): Promise<PrivacyViolation | null> {
    if (!settings.requireParentalConsent || !operation.consentRequired) {
      return null;
    }

    // Check if parental consent is required but missing
    const parentalConsents = this.consentRecords.get(`parent_${operation.userId}`);
    const hasParentalConsent = parentalConsents?.has(operation.purpose);

    if (!hasParentalConsent) {
      return {
        id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: ViolationType.PARENTAL_CONSENT_MISSING,
        severity: 'critical',
        userId: operation.userId,
        description: 'Parental consent required but not obtained',
        dataInvolved: operation.dataTypes,
        timestamp: new Date(),
        source: operation.requester,
        remediated: false,
        remediationActions: [
          {
            type: 'access_termination',
            description: 'Terminate operation until parental consent obtained',
            executed: false
          },
          {
            type: 'consent_request',
            description: 'Request parental consent',
            executed: false
          },
          {
            type: 'notification',
            description: 'Notify parent of consent requirement',
            executed: false
          }
        ]
      };
    }

    return null;
  }

  private async recordViolation(violation: PrivacyViolation): Promise<void> {
    this.violations.set(violation.id, violation);
    
    // Log the violation
    console.error(`Privacy violation detected: ${violation.type} for user ${violation.userId}`);
    
    // Trigger immediate remediation for critical violations
    if (violation.severity === 'critical') {
      await this.executeImmediateRemediation(violation);
    }
  }

  private logDataOperation(operation: DataOperation): void {
    this.dataAccessLog.push({
      operation,
      timestamp: new Date()
    });

    // Keep only last 1000 operations
    if (this.dataAccessLog.length > 1000) {
      this.dataAccessLog = this.dataAccessLog.slice(-1000);
    }
  }

  private async executeImmediateRemediation(violation: PrivacyViolation): Promise<void> {
    for (const action of violation.remediationActions) {
      try {
        await this.executeRemediationAction(violation, action);
      } catch (error) {
        console.error(`Failed to execute remediation action ${action.type}:`, error);
      }
    }
  }

  async executeRemediationAction(
    violation: PrivacyViolation,
    action: RemediationAction
  ): Promise<void> {
    const startTime = new Date();
    
    try {
      switch (action.type) {
        case 'access_termination':
          await this.terminateDataAccess(violation);
          break;
        case 'data_purge':
          await this.purgeViolatedData(violation);
          break;
        case 'consent_request':
          await this.requestConsent(violation);
          break;
        case 'notification':
          await this.notifyUser(violation);
          break;
        case 'audit_log':
          await this.auditLog(violation);
          break;
      }

      action.executed = true;
      action.timestamp = startTime;
      action.result = 'success';
      
    } catch (error) {
      action.executed = false;
      action.timestamp = startTime;
      action.result = `failed: ${error instanceof Error ? error.message : String(error)}`;
      throw error;
    }
  }

  private async terminateDataAccess(violation: PrivacyViolation): Promise<void> {
    // Immediately terminate any ongoing data access
    console.log(`Terminating data access for violation ${violation.id}`);
    
    // In a real implementation, this would:
    // - Cancel ongoing operations
    // - Revoke access tokens
    // - Clear in-memory data
    // - Block further access attempts
  }

  private async purgeViolatedData(violation: PrivacyViolation): Promise<void> {
    // Remove data that was accessed in violation of privacy settings
    console.log(`Purging violated data for violation ${violation.id}`);
    
    // In a real implementation, this would:
    // - Identify and delete specific data
    // - Clear caches and temporary storage
    // - Update data indexes
    // - Verify complete removal
  }

  private async requestConsent(violation: PrivacyViolation): Promise<void> {
    // Request proper consent from user or parent
    console.log(`Requesting consent for violation ${violation.id}`);
    
    // In a real implementation, this would:
    // - Generate consent request
    // - Send notification to user/parent
    // - Track consent request status
    // - Update consent records when received
  }

  private async notifyUser(violation: PrivacyViolation): Promise<void> {
    // Notify user of privacy violation and remediation
    console.log(`Notifying user of violation ${violation.id}`);
    
    // In a real implementation, this would:
    // - Send user notification
    // - Log notification delivery
    // - Provide violation details
    // - Offer privacy control options
  }

  private async auditLog(violation: PrivacyViolation): Promise<void> {
    // Create detailed audit log entry
    console.log(`Creating audit log for violation ${violation.id}`);
    
    // In a real implementation, this would:
    // - Create detailed log entry
    // - Include all relevant context
    // - Store in secure audit system
    // - Trigger compliance reporting
  }

  async getPrivacySettings(userId: string): Promise<PrivacySettings> {
    let settings = this.privacySettings.get(userId);
    
    if (!settings) {
      // Default privacy settings (privacy-first approach)
      settings = {
        userId,
        dataMinimization: true,
        consentRequired: true,
        retentionPeriod: 30, // 30 days default
        allowCrossUserLearning: false,
        allowExternalSharing: false,
        requireParentalConsent: false, // Would be determined by age
        anonymizationLevel: 'strong',
        auditingEnabled: true
      };
      
      this.privacySettings.set(userId, settings);
    }
    
    return settings;
  }

  async updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<void> {
    const currentSettings = await this.getPrivacySettings(userId);
    const updatedSettings = { ...currentSettings, ...settings };
    this.privacySettings.set(userId, updatedSettings);
  }

  async recordConsent(userId: string, purpose: string): Promise<void> {
    if (!this.consentRecords.has(userId)) {
      this.consentRecords.set(userId, new Map());
    }
    
    this.consentRecords.get(userId)!.set(purpose, new Date());
  }

  async revokeConsent(userId: string, purpose: string): Promise<void> {
    const userConsents = this.consentRecords.get(userId);
    if (userConsents) {
      userConsents.delete(purpose);
    }
  }

  getViolations(userId?: string): PrivacyViolation[] {
    const allViolations = Array.from(this.violations.values());
    
    if (userId) {
      return allViolations.filter(v => v.userId === userId);
    }
    
    return allViolations;
  }

  getDataAccessLog(userId?: string): Array<{ operation: DataOperation; timestamp: Date }> {
    if (userId) {
      return this.dataAccessLog.filter(entry => entry.operation.userId === userId);
    }
    
    return [...this.dataAccessLog];
  }

  async clearViolationHistory(): Promise<void> {
    this.violations.clear();
    this.dataAccessLog.length = 0;
  }
}