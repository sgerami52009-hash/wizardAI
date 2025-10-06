/**
 * Data Protection Utilities
 * Implements data minimization, retention policies, and consent management
 */

import { 
  UserData, 
  PrivacySettings, 
  DataOperation, 
  TimeRange,
  ValidationResult,
  ValidationIssue
} from '../types';
import { PrivacyLevel } from '../enums';

/**
 * Data minimization utility class
 * Ensures only necessary data is collected and processed
 */
export class DataMinimizer {
  private readonly purposeDataMap: Map<string, string[]> = new Map();
  private readonly sensitiveFields = [
    'email', 'phone', 'address', 'ssn', 'creditCard',
    'location.coordinates', 'biometric', 'medical'
  ];

  constructor() {
    this.initializePurposeDataMap();
  }

  /**
   * Minimizes data based on the specified purpose
   */
  minimizeForPurpose(data: any, purpose: string): any {
    const allowedFields = this.purposeDataMap.get(purpose) || [];
    const minimizedData: any = {};

    for (const field of allowedFields) {
      if (this.hasNestedField(data, field)) {
        this.setNestedField(minimizedData, field, this.getNestedField(data, field));
      }
    }

    return minimizedData;
  }

  /**
   * Removes sensitive fields from data
   */
  removeSensitiveFields(data: any): any {
    const cleanData = JSON.parse(JSON.stringify(data));
    
    for (const field of this.sensitiveFields) {
      this.deleteNestedField(cleanData, field);
    }

    return cleanData;
  }

  /**
   * Validates if data collection is minimal for the purpose
   */
  validateMinimization(data: any, purpose: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    const allowedFields = this.purposeDataMap.get(purpose) || [];
    const dataFields = this.getAllFields(data);
    
    // Check for unnecessary fields
    const unnecessaryFields = dataFields.filter(field => !allowedFields.includes(field));
    if (unnecessaryFields.length > 0) {
      issues.push({
        severity: 'medium',
        description: `Unnecessary fields detected: ${unnecessaryFields.join(', ')}`,
        field: 'dataFields',
        suggestedFix: `Remove unnecessary fields: ${unnecessaryFields.join(', ')}`
      });
    }

    // Check for sensitive fields
    const sensitiveFieldsPresent = dataFields.filter(field => 
      this.sensitiveFields.some(sensitive => field.includes(sensitive))
    );
    if (sensitiveFieldsPresent.length > 0) {
      issues.push({
        severity: 'high',
        description: `Sensitive fields detected: ${sensitiveFieldsPresent.join(', ')}`,
        field: 'sensitiveData',
        suggestedFix: 'Remove or encrypt sensitive fields'
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations: issues.map(i => i.suggestedFix),
      complianceScore: Math.max(0, 1 - (issues.length * 0.2))
    };
  }

  private initializePurposeDataMap(): void {
    this.purposeDataMap.set('activity_recommendation', [
      'userId', 'preferences.interests', 'preferences.activityPreferences',
      'context.availability', 'context.location.type', 'context.environmental.weather'
    ]);

    this.purposeDataMap.set('schedule_optimization', [
      'userId', 'preferences.schedulePreferences', 'context.availability',
      'calendar.events', 'context.location.type'
    ]);

    this.purposeDataMap.set('educational_content', [
      'userId', 'age', 'preferences.learningPreferences', 'learningProgress',
      'parentalPreferences', 'context.availability'
    ]);

    this.purposeDataMap.set('household_efficiency', [
      'familyId', 'preferences.householdPreferences', 'routines',
      'context.location.type', 'familyDynamics'
    ]);

    this.purposeDataMap.set('context_analysis', [
      'userId', 'context.location.type', 'context.activity', 
      'context.environmental', 'context.social'
    ]);

    this.purposeDataMap.set('learning_adaptation', [
      'userId', 'interactions', 'feedback', 'preferences',
      'modelMetrics', 'context.timestamp'
    ]);
  }

  private hasNestedField(obj: any, field: string): boolean {
    const parts = field.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        return false;
      }
      current = current[part];
    }
    
    return true;
  }

  private getNestedField(obj: any, field: string): any {
    const parts = field.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  private setNestedField(obj: any, field: string, value: any): void {
    const parts = field.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private deleteNestedField(obj: any, field: string): void {
    const parts = field.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        return;
      }
      current = current[part];
    }
    
    delete current[parts[parts.length - 1]];
  }

  private getAllFields(obj: any, prefix = ''): string[] {
    const fields: string[] = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        fields.push(fullKey);
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          fields.push(...this.getAllFields(obj[key], fullKey));
        }
      }
    }
    
    return fields;
  }
}

/**
 * Data retention policy manager
 * Handles automatic data purging based on retention policies
 */
export class RetentionPolicyManager {
  private readonly retentionPolicies: Map<string, number> = new Map();
  private readonly purgeSchedule: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Sets retention policy for a data type
   */
  setRetentionPolicy(dataType: string, retentionDays: number): void {
    this.retentionPolicies.set(dataType, retentionDays);
    this.schedulePurge(dataType);
  }

  /**
   * Gets retention policy for a data type
   */
  getRetentionPolicy(dataType: string): number {
    return this.retentionPolicies.get(dataType) || 90; // Default 90 days
  }

  /**
   * Checks if data should be purged based on retention policy
   */
  shouldPurge(dataType: string, dataTimestamp: Date): boolean {
    const retentionDays = this.getRetentionPolicy(dataType);
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    return dataTimestamp < cutoffDate;
  }

  /**
   * Purges expired data for a specific data type
   */
  async purgeExpiredData(dataType: string, dataStore: Map<string, any>): Promise<number> {
    let purgedCount = 0;
    const cutoffDate = new Date(Date.now() - (this.getRetentionPolicy(dataType) * 24 * 60 * 60 * 1000));

    for (const [key, data] of dataStore.entries()) {
      if (data.timestamp && data.timestamp < cutoffDate) {
        dataStore.delete(key);
        purgedCount++;
      }
    }

    console.log(`Purged ${purgedCount} expired ${dataType} records`);
    return purgedCount;
  }

  /**
   * Gets all data types that have expired data
   */
  getExpiredDataTypes(): string[] {
    const expiredTypes: string[] = [];
    const now = new Date();

    for (const [dataType, retentionDays] of this.retentionPolicies.entries()) {
      // This would typically check actual data stores
      // For now, we return all types that have retention policies
      expiredTypes.push(dataType);
    }

    return expiredTypes;
  }

  private initializeDefaultPolicies(): void {
    // Set default retention policies (in days)
    this.retentionPolicies.set('user_interactions', 90);
    this.retentionPolicies.set('user_preferences', 365);
    this.retentionPolicies.set('context_data', 30);
    this.retentionPolicies.set('recommendations', 60);
    this.retentionPolicies.set('audit_logs', 1095); // 3 years for compliance
    this.retentionPolicies.set('feedback_data', 180);
    this.retentionPolicies.set('learning_data', 365);
    this.retentionPolicies.set('error_logs', 30);
  }

  private schedulePurge(dataType: string): void {
    // Clear existing schedule
    const existingSchedule = this.purgeSchedule.get(dataType);
    if (existingSchedule) {
      clearInterval(existingSchedule);
    }

    // Schedule daily purge check
    const schedule = setInterval(() => {
      console.log(`Checking for expired ${dataType} data...`);
      // This would trigger actual purge operations
    }, 24 * 60 * 60 * 1000); // Daily

    this.purgeSchedule.set(dataType, schedule);
  }
}

/**
 * User consent manager
 * Handles consent collection and validation for data operations
 */
export class ConsentManager {
  private readonly userConsents: Map<string, Map<string, ConsentRecord>> = new Map();

  /**
   * Records user consent for a specific purpose
   */
  recordConsent(userId: string, purpose: string, granted: boolean, metadata?: any): void {
    if (!this.userConsents.has(userId)) {
      this.userConsents.set(userId, new Map());
    }

    const userConsents = this.userConsents.get(userId)!;
    userConsents.set(purpose, {
      granted,
      timestamp: new Date(),
      purpose,
      metadata: metadata || {},
      version: '1.0'
    });
  }

  /**
   * Checks if user has granted consent for a purpose
   */
  hasConsent(userId: string, purpose: string): boolean {
    const userConsents = this.userConsents.get(userId);
    if (!userConsents) {
      return false;
    }

    const consent = userConsents.get(purpose);
    return consent ? consent.granted : false;
  }

  /**
   * Gets consent record for a user and purpose
   */
  getConsent(userId: string, purpose: string): ConsentRecord | null {
    const userConsents = this.userConsents.get(userId);
    if (!userConsents) {
      return null;
    }

    return userConsents.get(purpose) || null;
  }

  /**
   * Revokes consent for a specific purpose
   */
  revokeConsent(userId: string, purpose: string): void {
    const userConsents = this.userConsents.get(userId);
    if (userConsents && userConsents.has(purpose)) {
      const consent = userConsents.get(purpose)!;
      consent.granted = false;
      consent.revokedAt = new Date();
    }
  }

  /**
   * Gets all consents for a user
   */
  getUserConsents(userId: string): ConsentRecord[] {
    const userConsents = this.userConsents.get(userId);
    if (!userConsents) {
      return [];
    }

    return Array.from(userConsents.values());
  }

  /**
   * Validates if consent is required for an operation
   */
  isConsentRequired(operation: DataOperation): boolean {
    const consentRequiredPurposes = [
      'data_sharing',
      'external_integration',
      'research',
      'marketing',
      'analytics',
      'third_party_access'
    ];

    return consentRequiredPurposes.some(purpose => 
      operation.purpose.toLowerCase().includes(purpose)
    );
  }

  /**
   * Checks if consent is still valid (not expired)
   */
  isConsentValid(consent: ConsentRecord, maxAgeMonths: number = 12): boolean {
    if (!consent.granted || consent.revokedAt) {
      return false;
    }

    const maxAge = maxAgeMonths * 30 * 24 * 60 * 60 * 1000; // Convert to milliseconds
    const age = Date.now() - consent.timestamp.getTime();
    
    return age <= maxAge;
  }
}

/**
 * Privacy-preserving analytics utility
 * Provides analytics while maintaining user privacy
 */
export class PrivacyPreservingAnalytics {
  private readonly k = 5; // k-anonymity parameter
  private readonly epsilon = 1.0; // Differential privacy parameter

  /**
   * Generates privacy-preserving usage statistics
   */
  generateUsageStats(userData: UserData[], privacyLevel: PrivacyLevel): any {
    switch (privacyLevel) {
      case PrivacyLevel.PUBLIC:
        return this.generatePublicStats(userData);
      case PrivacyLevel.FAMILY:
        return this.generateFamilyStats(userData);
      case PrivacyLevel.PRIVATE:
        return this.generatePrivateStats(userData);
      case PrivacyLevel.ANONYMOUS:
        return this.generateAnonymousStats(userData);
      default:
        return this.generateAnonymousStats(userData);
    }
  }

  /**
   * Applies differential privacy noise to numerical data
   */
  addDifferentialPrivacyNoise(value: number, sensitivity: number = 1): number {
    const scale = sensitivity / this.epsilon;
    const noise = this.generateLaplaceNoise(scale);
    return Math.max(0, value + noise);
  }

  /**
   * Ensures k-anonymity for grouped data
   */
  ensureKAnonymity(groups: any[]): any[] {
    return groups.filter(group => group.count >= this.k);
  }

  private generatePublicStats(userData: UserData[]): any {
    return {
      totalUsers: this.addDifferentialPrivacyNoise(userData.length),
      averageAge: this.addDifferentialPrivacyNoise(
        userData.reduce((sum, user) => sum + (user.metadata.age || 0), 0) / userData.length
      ),
      topInterests: this.getTopInterests(userData, 5),
      usagePatterns: this.getGeneralUsagePatterns(userData)
    };
  }

  private generateFamilyStats(userData: UserData[]): any {
    const familyGroups = this.groupByFamily(userData);
    const anonymizedGroups = this.ensureKAnonymity(familyGroups);

    return {
      familyCount: this.addDifferentialPrivacyNoise(anonymizedGroups.length),
      averageFamilySize: this.addDifferentialPrivacyNoise(
        anonymizedGroups.reduce((sum, family) => sum + family.size, 0) / anonymizedGroups.length
      ),
      commonPreferences: this.getCommonFamilyPreferences(anonymizedGroups)
    };
  }

  private generatePrivateStats(userData: UserData[]): any {
    return {
      userCount: this.addDifferentialPrivacyNoise(userData.length),
      generalDemographics: this.getGeneralDemographics(userData),
      aggregatedPreferences: this.getAggregatedPreferences(userData)
    };
  }

  private generateAnonymousStats(userData: UserData[]): any {
    return {
      totalSessions: this.addDifferentialPrivacyNoise(userData.length * 10), // Rough estimate
      generalUsage: 'active',
      systemHealth: 'operational'
    };
  }

  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  private getTopInterests(userData: UserData[], limit: number): string[] {
    const interestCounts: Map<string, number> = new Map();
    
    userData.forEach(user => {
      if (user.preferences?.interests) {
        user.preferences.interests.forEach(interest => {
          interestCounts.set(interest.category, (interestCounts.get(interest.category) || 0) + 1);
        });
      }
    });

    return Array.from(interestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([interest]) => interest);
  }

  private getGeneralUsagePatterns(userData: UserData[]): any {
    return {
      activeUsers: this.addDifferentialPrivacyNoise(userData.length * 0.7),
      peakUsageHours: ['morning', 'evening'],
      commonActivities: ['learning', 'entertainment', 'household']
    };
  }

  private groupByFamily(userData: UserData[]): any[] {
    const familyMap: Map<string, UserData[]> = new Map();
    
    userData.forEach(user => {
      const familyId = user.metadata.familyId || 'single';
      if (!familyMap.has(familyId)) {
        familyMap.set(familyId, []);
      }
      familyMap.get(familyId)!.push(user);
    });

    return Array.from(familyMap.entries()).map(([familyId, members]) => ({
      familyId,
      size: members.length,
      count: 1
    }));
  }

  private getCommonFamilyPreferences(familyGroups: any[]): string[] {
    // Return generalized family preferences
    return ['family_activities', 'educational_content', 'household_efficiency'];
  }

  private getGeneralDemographics(userData: UserData[]): any {
    const ageGroups = userData.reduce((groups: any, user) => {
      const ageGroup = this.getAgeGroup(user.metadata.age);
      groups[ageGroup] = (groups[ageGroup] || 0) + 1;
      return groups;
    }, {});

    // Apply differential privacy to each group
    Object.keys(ageGroups).forEach(group => {
      ageGroups[group] = this.addDifferentialPrivacyNoise(ageGroups[group]);
    });

    return ageGroups;
  }

  private getAggregatedPreferences(userData: UserData[]): any {
    return {
      preferenceCategories: ['activities', 'learning', 'scheduling'],
      commonPatterns: ['morning_activities', 'evening_learning', 'weekend_family_time']
    };
  }

  private getAgeGroup(age?: number): string {
    if (!age) return 'unknown';
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    if (age < 35) return 'young_adult';
    if (age < 55) return 'adult';
    return 'senior';
  }
}

// Supporting interfaces
interface ConsentRecord {
  granted: boolean;
  timestamp: Date;
  purpose: string;
  metadata: any;
  version: string;
  revokedAt?: Date;
}