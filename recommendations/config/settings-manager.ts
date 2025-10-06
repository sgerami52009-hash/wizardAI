/**
 * Settings manager for user and family preferences
 * Handles initialization, updates, and persistence of user settings
 */

import { 
  UserPreferences, 
  RecommendationSettings, 
  FamilyContext,
  PrivacySettings,
  NotificationPreferences,
  ActivityPreferences,
  SchedulePreferences,
  LearningPreferences
} from '../types';
import { PrivacyLevel, RecommendationType, DifficultyLevel } from '../enums';
import { SystemConfigManager } from './system-config';

export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SettingsUpdateRequest {
  userId: string;
  section: keyof UserPreferences;
  updates: any;
  validateOnly?: boolean;
}

export interface FamilySettingsCoordination {
  familyId: string;
  conflictingPreferences: string[];
  resolutionStrategy: 'merge' | 'priority' | 'individual';
  coordinatedSettings: Partial<UserPreferences>;
}

/**
 * Settings manager for user preferences and family coordination
 */
export class SettingsManager {
  private userSettings: Map<string, UserPreferences> = new Map();
  private familySettings: Map<string, FamilyContext> = new Map();
  private systemConfig: SystemConfigManager;
  private settingsWatchers: Map<string, (settings: UserPreferences) => void> = new Map();

  constructor(systemConfig: SystemConfigManager) {
    this.systemConfig = systemConfig;
  }

  /**
   * Initialize user settings with safe defaults
   */
  async initializeUserSettings(
    userId: string, 
    ageGroup: 'child' | 'teen' | 'adult',
    familyId?: string,
    initialPreferences?: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const config = this.systemConfig.getConfiguration();
    const now = new Date();

    // Create age-appropriate default preferences
    const defaultPreferences: UserPreferences = {
      userId,
      interests: [],
      activityPreferences: this.getAgeAppropriateActivityPreferences(ageGroup),
      schedulePreferences: this.getAgeAppropriateSchedulePreferences(ageGroup),
      learningPreferences: this.getAgeAppropriateLearningPreferences(ageGroup),
      privacyPreferences: this.getAgeAppropriatePrivacyPreferences(ageGroup, config),
      notificationPreferences: this.getAgeAppropriateNotificationPreferences(ageGroup),
      lastUpdated: now
    };

    // Merge with any provided initial preferences
    const userPreferences = this.mergePreferences(defaultPreferences, initialPreferences || {});

    // Validate settings
    const validation = await this.validateUserSettings(userPreferences);
    if (!validation.valid) {
      throw new Error(`Invalid user settings: ${validation.errors.join(', ')}`);
    }

    // Store settings
    this.userSettings.set(userId, userPreferences);

    // If part of a family, coordinate with family settings
    if (familyId) {
      await this.coordinateFamilySettings(familyId, userId, userPreferences);
    }

    console.log(`User settings initialized for ${userId} (${ageGroup})`);
    return userPreferences;
  }

  /**
   * Get user settings
   */
  getUserSettings(userId: string): UserPreferences | null {
    return this.userSettings.get(userId) || null;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(request: SettingsUpdateRequest): Promise<UserPreferences> {
    const currentSettings = this.userSettings.get(request.userId);
    if (!currentSettings) {
      throw new Error(`User settings not found for ${request.userId}`);
    }

    // Create updated settings
    const updatedSettings: UserPreferences = {
      ...currentSettings,
      [request.section]: {
        ...currentSettings[request.section],
        ...request.updates
      },
      lastUpdated: new Date()
    };

    // Validate updates
    const validation = await this.validateUserSettings(updatedSettings);
    if (!validation.valid) {
      throw new Error(`Invalid settings update: ${validation.errors.join(', ')}`);
    }

    if (request.validateOnly) {
      return updatedSettings;
    }

    // Apply updates
    this.userSettings.set(request.userId, updatedSettings);

    // Notify watchers
    this.notifySettingsWatchers(request.userId, updatedSettings);

    // Persist changes
    await this.persistUserSettings(request.userId, updatedSettings);

    console.log(`User settings updated for ${request.userId}, section: ${request.section}`);
    return updatedSettings;
  }

  /**
   * Initialize family settings coordination
   */
  async initializeFamilySettings(
    familyId: string,
    memberIds: string[],
    sharedPreferences?: Partial<UserPreferences>
  ): Promise<FamilyContext> {
    const familyContext: FamilyContext = {
      familyId,
      membersPresent: memberIds,
      sharedPreferences: sharedPreferences || this.createDefaultFamilyPreferences(),
      conflictingPreferences: [],
      groupDynamics: {
        leadershipStyle: 'collaborative',
        decisionMaking: 'consensus',
        conflictResolution: 'discussion'
      }
    };

    // Analyze existing member preferences for conflicts
    await this.analyzeFamilyPreferenceConflicts(familyContext);

    // Store family settings
    this.familySettings.set(familyId, familyContext);

    console.log(`Family settings initialized for ${familyId} with ${memberIds.length} members`);
    return familyContext;
  }

  /**
   * Get family settings
   */
  getFamilySettings(familyId: string): FamilyContext | null {
    return this.familySettings.get(familyId) || null;
  }

  /**
   * Create recommendation settings from user preferences
   */
  createRecommendationSettings(userId: string): RecommendationSettings {
    const userPreferences = this.getUserSettings(userId);
    if (!userPreferences) {
      throw new Error(`User preferences not found for ${userId}`);
    }

    const config = this.systemConfig.getConfiguration();
    
    return {
      userId,
      enabledTypes: this.determineEnabledRecommendationTypes(userPreferences),
      frequency: this.determineRecommendationFrequency(userPreferences),
      maxRecommendations: config.recommendations.qualityThresholds.minConfidence > 0.8 ? 3 : 5,
      privacyLevel: userPreferences.privacyPreferences.dataSharing,
      parentalControlsEnabled: this.isChildUser(userId),
      contentFilteringStrict: userPreferences.privacyPreferences.dataSharing === PrivacyLevel.HIGH,
      notificationSettings: userPreferences.notificationPreferences,
      customFilters: []
    };
  }

  /**
   * Watch for settings changes
   */
  watchUserSettings(userId: string, callback: (settings: UserPreferences) => void): void {
    this.settingsWatchers.set(`${userId}`, callback);
  }

  /**
   * Stop watching settings changes
   */
  unwatchUserSettings(userId: string): void {
    this.settingsWatchers.delete(`${userId}`);
  }

  /**
   * Validate user settings
   */
  async validateUserSettings(settings: UserPreferences): Promise<SettingsValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate privacy settings
    if (settings.privacyPreferences.dataRetentionDays < 1) {
      errors.push('Data retention period must be at least 1 day');
    }

    // Validate schedule preferences
    if (settings.schedulePreferences.preferredWakeTime >= settings.schedulePreferences.preferredBedTime) {
      warnings.push('Wake time should be before bed time');
    }

    // Validate learning preferences for children
    if (this.isChildUser(settings.userId)) {
      if (settings.learningPreferences.sessionDuration > 60) {
        warnings.push('Learning sessions over 60 minutes may be too long for children');
      }
    }

    // Validate notification settings
    if (settings.notificationPreferences.enabled && settings.notificationPreferences.channels.length === 0) {
      errors.push('At least one notification channel must be enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get performance optimization settings for user
   */
  getPerformanceOptimizationSettings(userId: string): {
    enableCaching: boolean;
    modelComplexity: 'simple' | 'standard' | 'complex';
    updateFrequency: 'realtime' | 'batched' | 'scheduled';
  } {
    const userPreferences = this.getUserSettings(userId);
    const systemConfig = this.systemConfig.getConfiguration();
    
    if (!userPreferences) {
      return {
        enableCaching: true,
        modelComplexity: 'simple',
        updateFrequency: 'scheduled'
      };
    }

    return {
      enableCaching: systemConfig.performance.optimization.enableCaching,
      modelComplexity: userPreferences.privacyPreferences.dataSharing === PrivacyLevel.HIGH ? 'simple' : 'standard',
      updateFrequency: userPreferences.notificationPreferences.enabled ? 'realtime' : 'batched'
    };
  }

  /**
   * Get age-appropriate activity preferences
   */
  private getAgeAppropriateActivityPreferences(ageGroup: 'child' | 'teen' | 'adult'): ActivityPreferences {
    const basePreferences: ActivityPreferences = {
      preferredCategories: [],
      preferredDifficulty: DifficultyLevel.MEDIUM,
      preferredDuration: { start: new Date(0, 0, 0, 0, 30), end: new Date(0, 0, 0, 2, 0) },
      indoorOutdoorPreference: 'both',
      socialPreference: 'both',
      physicalActivityLevel: 'medium'
    };

    switch (ageGroup) {
      case 'child':
        return {
          ...basePreferences,
          preferredDifficulty: DifficultyLevel.EASY,
          preferredDuration: { start: new Date(0, 0, 0, 0, 15), end: new Date(0, 0, 0, 1, 0) },
          socialPreference: 'group',
          physicalActivityLevel: 'high'
        };
      case 'teen':
        return {
          ...basePreferences,
          preferredDuration: { start: new Date(0, 0, 0, 0, 45), end: new Date(0, 0, 0, 3, 0) },
          socialPreference: 'group'
        };
      default:
        return basePreferences;
    }
  }

  /**
   * Get age-appropriate schedule preferences
   */
  private getAgeAppropriateSchedulePreferences(ageGroup: 'child' | 'teen' | 'adult'): SchedulePreferences {
    switch (ageGroup) {
      case 'child':
        return {
          preferredWakeTime: '07:00',
          preferredBedTime: '20:00',
          workingHours: [],
          breakPreferences: [
            { duration: 15, frequency: 3, preferredTimes: ['10:00', '14:00', '16:00'] }
          ],
          flexibilityLevel: 'moderate'
        };
      case 'teen':
        return {
          preferredWakeTime: '07:30',
          preferredBedTime: '22:00',
          workingHours: [],
          breakPreferences: [
            { duration: 20, frequency: 2, preferredTimes: ['12:00', '15:30'] }
          ],
          flexibilityLevel: 'flexible'
        };
      default:
        return {
          preferredWakeTime: '08:00',
          preferredBedTime: '23:00',
          workingHours: [
            { start: new Date(0, 0, 0, 9, 0), end: new Date(0, 0, 0, 17, 0) }
          ],
          breakPreferences: [
            { duration: 30, frequency: 2, preferredTimes: ['12:00', '15:00'] }
          ],
          flexibilityLevel: 'moderate'
        };
    }
  }

  /**
   * Get age-appropriate learning preferences
   */
  private getAgeAppropriateLearningPreferences(ageGroup: 'child' | 'teen' | 'adult'): LearningPreferences {
    switch (ageGroup) {
      case 'child':
        return {
          learningStyle: 'mixed',
          preferredSubjects: [],
          difficultyPreference: 'moderate',
          sessionDuration: 15,
          gamificationLevel: 'high'
        };
      case 'teen':
        return {
          learningStyle: 'mixed',
          preferredSubjects: [],
          difficultyPreference: 'challenging',
          sessionDuration: 30,
          gamificationLevel: 'medium'
        };
      default:
        return {
          learningStyle: 'mixed',
          preferredSubjects: [],
          difficultyPreference: 'moderate',
          sessionDuration: 45,
          gamificationLevel: 'low'
        };
    }
  }

  /**
   * Get age-appropriate privacy preferences
   */
  private getAgeAppropriatePrivacyPreferences(ageGroup: 'child' | 'teen' | 'adult', config: any): PrivacySettings {
    switch (ageGroup) {
      case 'child':
        return {
          dataSharing: PrivacyLevel.HIGH,
          locationTracking: false,
          behaviorAnalysis: true,
          familyDataSharing: true,
          externalIntegrations: false,
          dataRetentionDays: config.privacy.dataRetentionDays,
          encryptionRequired: true
        };
      case 'teen':
        return {
          dataSharing: PrivacyLevel.MEDIUM,
          locationTracking: false,
          behaviorAnalysis: true,
          familyDataSharing: true,
          externalIntegrations: false,
          dataRetentionDays: config.privacy.dataRetentionDays,
          encryptionRequired: true
        };
      default:
        return {
          dataSharing: PrivacyLevel.MEDIUM,
          locationTracking: true,
          behaviorAnalysis: true,
          familyDataSharing: false,
          externalIntegrations: true,
          dataRetentionDays: config.privacy.dataRetentionDays,
          encryptionRequired: true
        };
    }
  }

  /**
   * Get age-appropriate notification preferences
   */
  private getAgeAppropriateNotificationPreferences(ageGroup: 'child' | 'teen' | 'adult'): NotificationPreferences {
    const basePreferences: NotificationPreferences = {
      enabled: true,
      quietHours: [
        { start: new Date(0, 0, 0, 22, 0), end: new Date(0, 0, 0, 7, 0) }
      ],
      urgencyThreshold: 'medium',
      channels: ['voice', 'visual']
    };

    switch (ageGroup) {
      case 'child':
        return {
          ...basePreferences,
          quietHours: [
            { start: new Date(0, 0, 0, 20, 0), end: new Date(0, 0, 0, 7, 0) }
          ],
          channels: ['visual', 'avatar']
        };
      case 'teen':
        return {
          ...basePreferences,
          quietHours: [
            { start: new Date(0, 0, 0, 21, 0), end: new Date(0, 0, 0, 7, 30) }
          ]
        };
      default:
        return basePreferences;
    }
  }

  /**
   * Merge user preferences with deep merge
   */
  private mergePreferences(base: UserPreferences, override: Partial<UserPreferences>): UserPreferences {
    return {
      ...base,
      ...override,
      activityPreferences: { ...base.activityPreferences, ...override.activityPreferences },
      schedulePreferences: { ...base.schedulePreferences, ...override.schedulePreferences },
      learningPreferences: { ...base.learningPreferences, ...override.learningPreferences },
      privacyPreferences: { ...base.privacyPreferences, ...override.privacyPreferences },
      notificationPreferences: { ...base.notificationPreferences, ...override.notificationPreferences }
    };
  }

  /**
   * Coordinate family settings
   */
  private async coordinateFamilySettings(
    familyId: string, 
    userId: string, 
    userPreferences: UserPreferences
  ): Promise<void> {
    const familyContext = this.familySettings.get(familyId);
    if (!familyContext) {
      console.warn(`Family context not found for ${familyId}`);
      return;
    }

    // Add user to family if not already present
    if (!familyContext.membersPresent.includes(userId)) {
      familyContext.membersPresent.push(userId);
    }

    // Update family context
    this.familySettings.set(familyId, familyContext);
  }

  /**
   * Analyze family preference conflicts
   */
  private async analyzeFamilyPreferenceConflicts(familyContext: FamilyContext): Promise<void> {
    // This would analyze preferences across family members to identify conflicts
    // For now, we'll just initialize empty conflicts
    familyContext.conflictingPreferences = [];
  }

  /**
   * Create default family preferences
   */
  private createDefaultFamilyPreferences(): UserPreferences {
    const now = new Date();
    return {
      userId: 'family-shared',
      interests: [],
      activityPreferences: {
        preferredCategories: [],
        preferredDifficulty: DifficultyLevel.MEDIUM,
        preferredDuration: { start: new Date(0, 0, 0, 1, 0), end: new Date(0, 0, 0, 3, 0) },
        indoorOutdoorPreference: 'both',
        socialPreference: 'group',
        physicalActivityLevel: 'medium'
      },
      schedulePreferences: {
        preferredWakeTime: '08:00',
        preferredBedTime: '22:00',
        workingHours: [],
        breakPreferences: [],
        flexibilityLevel: 'flexible'
      },
      learningPreferences: {
        learningStyle: 'mixed',
        preferredSubjects: [],
        difficultyPreference: 'moderate',
        sessionDuration: 30,
        gamificationLevel: 'medium'
      },
      privacyPreferences: {
        dataSharing: PrivacyLevel.MEDIUM,
        locationTracking: false,
        behaviorAnalysis: true,
        familyDataSharing: true,
        externalIntegrations: false,
        dataRetentionDays: 90,
        encryptionRequired: true
      },
      notificationPreferences: {
        enabled: true,
        quietHours: [
          { start: new Date(0, 0, 0, 22, 0), end: new Date(0, 0, 0, 7, 0) }
        ],
        urgencyThreshold: 'medium',
        channels: ['voice', 'visual']
      },
      lastUpdated: now
    };
  }

  /**
   * Determine enabled recommendation types based on preferences
   */
  private determineEnabledRecommendationTypes(preferences: UserPreferences): RecommendationType[] {
    const types: RecommendationType[] = [RecommendationType.ACTIVITY];
    
    // Add schedule recommendations if user has flexible schedule
    if (preferences.schedulePreferences.flexibilityLevel !== 'rigid') {
      types.push(RecommendationType.SCHEDULE);
    }
    
    // Add educational recommendations for learning-oriented users
    if (preferences.learningPreferences.gamificationLevel !== 'none') {
      types.push(RecommendationType.EDUCATIONAL);
    }
    
    // Add household recommendations for family users
    if (preferences.privacyPreferences.familyDataSharing) {
      types.push(RecommendationType.HOUSEHOLD);
    }
    
    return types;
  }

  /**
   * Determine recommendation frequency based on preferences
   */
  private determineRecommendationFrequency(preferences: UserPreferences): 'realtime' | 'hourly' | 'daily' | 'weekly' {
    if (!preferences.notificationPreferences.enabled) {
      return 'daily';
    }
    
    if (preferences.notificationPreferences.urgencyThreshold === 'high') {
      return 'realtime';
    }
    
    return 'hourly';
  }

  /**
   * Check if user is a child (for parental controls)
   */
  private isChildUser(userId: string): boolean {
    // This would check user age/role in a real implementation
    // For now, return false as default
    return false;
  }

  /**
   * Notify settings watchers
   */
  private notifySettingsWatchers(userId: string, settings: UserPreferences): void {
    const callback = this.settingsWatchers.get(`${userId}`);
    if (callback) {
      try {
        callback(settings);
      } catch (error) {
        console.error('Error notifying settings watcher:', error);
      }
    }
  }

  /**
   * Persist user settings
   */
  private async persistUserSettings(userId: string, settings: UserPreferences): Promise<void> {
    try {
      // In a real implementation, this would save to persistent storage
      console.log(`Settings persisted for user ${userId}`);
    } catch (error) {
      console.error('Failed to persist user settings:', error);
    }
  }
}