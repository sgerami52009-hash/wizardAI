/**
 * System configuration and settings management for the recommendations engine
 * Handles configuration loading, validation, and runtime settings management
 */

import { PrivacyLevel, RecommendationType, DifficultyLevel } from '../enums';
import { PerformanceThreshold, UserPreferences, RecommendationSettings } from '../types';

export interface SystemConfiguration {
  // Core system settings
  system: {
    version: string;
    environment: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    enableAuditLogging: boolean;
  };

  // Performance configuration
  performance: {
    thresholds: PerformanceThreshold;
    optimization: {
      enableModelCompression: boolean;
      enableCaching: boolean;
      cacheExpirationMinutes: number;
      maxConcurrentRecommendations: number;
      backgroundLearningEnabled: boolean;
    };
    hardware: {
      maxMemoryMB: number;
      targetCpuUsagePercent: number;
      enableGpuAcceleration: boolean;
      jetsonOptimizations: boolean;
    };
  };

  // Privacy and security settings
  privacy: {
    defaultPrivacyLevel: PrivacyLevel;
    encryptionEnabled: boolean;
    dataRetentionDays: number;
    anonymizationThreshold: number;
    auditLogRetentionDays: number;
    requireExplicitConsent: boolean;
  };

  // Child safety configuration
  childSafety: {
    strictModeEnabled: boolean;
    parentalApprovalRequired: boolean;
    contentFilteringLevel: 'strict' | 'moderate' | 'basic';
    ageVerificationRequired: boolean;
    safetyAuditFrequencyHours: number;
  };

  // Recommendation engine settings
  recommendations: {
    defaultSettings: RecommendationSettings;
    enabledEngines: string[];
    learningRates: {
      userPreferences: number;
      contextualFactors: number;
      familyDynamics: number;
    };
    qualityThresholds: {
      minConfidence: number;
      minRelevance: number;
      maxStalenessHours: number;
    };
  };

  // Integration settings
  integrations: {
    voice: {
      enabled: boolean;
      responseTimeoutMs: number;
      maxRetries: number;
    };
    avatar: {
      enabled: boolean;
      personalityIntegration: boolean;
      emotionAwareness: boolean;
    };
    scheduling: {
      enabled: boolean;
      autoCreateEvents: boolean;
      conflictResolution: 'ask' | 'auto' | 'skip';
    };
    smartHome: {
      enabled: boolean;
      autoDiscovery: boolean;
      safetyLimits: string[];
    };
  };
}

export interface UserInitializationConfig {
  userId: string;
  familyId?: string;
  ageGroup: 'child' | 'teen' | 'adult';
  initialPreferences?: Partial<UserPreferences>;
  parentalControls?: {
    enabled: boolean;
    parentId?: string;
    restrictions: string[];
  };
  privacySettings?: {
    dataSharing: PrivacyLevel;
    locationTracking: boolean;
    behaviorAnalysis: boolean;
  };
}

export interface FamilyInitializationConfig {
  familyId: string;
  members: UserInitializationConfig[];
  sharedSettings: {
    timezone: string;
    language: string;
    currency: string;
    location: {
      country: string;
      region: string;
      city?: string;
    };
  };
  familyPreferences: {
    activityTypes: string[];
    scheduleFlexibility: 'rigid' | 'moderate' | 'flexible';
    privacyLevel: PrivacyLevel;
    budgetConstraints: {
      monthly: number;
      categories: Record<string, number>;
    };
  };
}

/**
 * System configuration manager
 * Handles loading, validation, and runtime management of system settings
 */
export class SystemConfigManager {
  private config: SystemConfiguration;
  private configPath: string;
  private watchers: Map<string, (config: SystemConfiguration) => void> = new Map();

  constructor(configPath: string = './config/recommendations-config.json') {
    this.configPath = configPath;
    this.config = this.getDefaultConfiguration();
  }

  /**
   * Load configuration from file or environment
   */
  async loadConfiguration(): Promise<void> {
    try {
      // Try to load from file first
      const fileConfig = await this.loadFromFile();
      if (fileConfig) {
        this.config = this.mergeConfigurations(this.config, fileConfig);
      }

      // Override with environment variables
      this.applyEnvironmentOverrides();

      // Validate configuration
      await this.validateConfiguration();

      console.log('System configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      console.log('Using default configuration');
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SystemConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration section
   */
  async updateConfiguration(section: keyof SystemConfiguration, updates: any): Promise<void> {
    const newConfig = {
      ...this.config,
      [section]: {
        ...this.config[section],
        ...updates
      }
    };

    await this.validateConfiguration(newConfig);
    this.config = newConfig;
    
    // Notify watchers
    this.notifyWatchers();
    
    // Persist changes
    await this.saveConfiguration();
  }

  /**
   * Watch for configuration changes
   */
  watchConfiguration(key: string, callback: (config: SystemConfiguration) => void): void {
    this.watchers.set(key, callback);
  }

  /**
   * Stop watching configuration changes
   */
  unwatchConfiguration(key: string): void {
    this.watchers.delete(key);
  }

  /**
   * Initialize user preferences with safe defaults
   */
  initializeUserPreferences(config: UserInitializationConfig): UserPreferences {
    const now = new Date();
    
    return {
      userId: config.userId,
      interests: [],
      activityPreferences: {
        preferredCategories: [],
        preferredDifficulty: DifficultyLevel.MEDIUM,
        preferredDuration: { start: new Date(0, 0, 0, 0, 30), end: new Date(0, 0, 0, 2, 0) },
        indoorOutdoorPreference: 'both',
        socialPreference: 'both',
        physicalActivityLevel: 'medium'
      },
      schedulePreferences: {
        preferredWakeTime: config.ageGroup === 'child' ? '07:00' : '08:00',
        preferredBedTime: config.ageGroup === 'child' ? '20:00' : '22:00',
        workingHours: [],
        breakPreferences: [],
        flexibilityLevel: 'moderate'
      },
      learningPreferences: {
        learningStyle: 'mixed',
        preferredSubjects: [],
        difficultyPreference: 'moderate',
        sessionDuration: config.ageGroup === 'child' ? 15 : 30,
        gamificationLevel: config.ageGroup === 'child' ? 'high' : 'medium'
      },
      privacyPreferences: {
        dataSharing: config.privacySettings?.dataSharing || PrivacyLevel.MEDIUM,
        locationTracking: config.privacySettings?.locationTracking || false,
        behaviorAnalysis: config.privacySettings?.behaviorAnalysis || true,
        familyDataSharing: config.ageGroup === 'child',
        externalIntegrations: false,
        dataRetentionDays: this.config.privacy.dataRetentionDays
      },
      notificationPreferences: {
        enabled: true,
        quietHours: [
          { start: new Date(0, 0, 0, 22, 0), end: new Date(0, 0, 0, 7, 0) }
        ],
        urgencyThreshold: 'medium',
        channels: ['voice', 'visual']
      },
      lastUpdated: now,
      ...config.initialPreferences
    };
  }

  /**
   * Initialize family configuration
   */
  initializeFamilyConfiguration(config: FamilyInitializationConfig): void {
    // Store family configuration for shared preferences and coordination
    console.log(`Initializing family configuration for ${config.familyId}`);
    
    // This would typically be stored in a family configuration store
    // For now, we'll log the initialization
    console.log('Family members:', config.members.length);
    console.log('Shared settings:', config.sharedSettings);
    console.log('Family preferences:', config.familyPreferences);
  }

  /**
   * Get performance tuning settings based on current system state
   */
  getPerformanceTuningSettings(): {
    memoryOptimization: boolean;
    modelCompression: boolean;
    cachingStrategy: string;
    concurrencyLimits: number;
  } {
    const performance = this.config.performance;
    
    return {
      memoryOptimization: performance.hardware.maxMemoryMB < 2048,
      modelCompression: performance.optimization.enableModelCompression,
      cachingStrategy: performance.optimization.enableCaching ? 'aggressive' : 'minimal',
      concurrencyLimits: performance.optimization.maxConcurrentRecommendations
    };
  }

  /**
   * Get default system configuration
   */
  private getDefaultConfiguration(): SystemConfiguration {
    return {
      system: {
        version: '1.0.0',
        environment: 'production',
        logLevel: 'info',
        enableMetrics: true,
        enableAuditLogging: true
      },
      performance: {
        thresholds: {
          maxLatencyMs: 2000,
          maxMemoryMB: 1536, // 1.5GB for Jetson Nano Orin
          minSatisfactionScore: 0.7,
          maxCpuUsagePercent: 80,
          maxConcurrentRequests: 10
        },
        optimization: {
          enableModelCompression: true,
          enableCaching: true,
          cacheExpirationMinutes: 30,
          maxConcurrentRecommendations: 5,
          backgroundLearningEnabled: true
        },
        hardware: {
          maxMemoryMB: 1536,
          targetCpuUsagePercent: 60,
          enableGpuAcceleration: true,
          jetsonOptimizations: true
        }
      },
      privacy: {
        defaultPrivacyLevel: PrivacyLevel.MEDIUM,
        encryptionEnabled: true,
        dataRetentionDays: 90,
        anonymizationThreshold: 0.8,
        auditLogRetentionDays: 365,
        requireExplicitConsent: true
      },
      childSafety: {
        strictModeEnabled: true,
        parentalApprovalRequired: true,
        contentFilteringLevel: 'strict',
        ageVerificationRequired: true,
        safetyAuditFrequencyHours: 24
      },
      recommendations: {
        defaultSettings: {
          userId: '',
          enabledTypes: [
            RecommendationType.ACTIVITY,
            RecommendationType.SCHEDULE,
            RecommendationType.EDUCATIONAL,
            RecommendationType.HOUSEHOLD
          ],
          frequency: 'realtime',
          maxRecommendations: 5,
          privacyLevel: PrivacyLevel.MEDIUM,
          parentalControlsEnabled: false,
          contentFilteringStrict: true,
          notificationSettings: {
            enabled: true,
            quietHours: [],
            urgencyThreshold: 'medium',
            channels: ['voice', 'visual']
          },
          customFilters: []
        },
        enabledEngines: [
          'activity-recommender',
          'schedule-optimizer',
          'educational-recommender',
          'household-efficiency'
        ],
        learningRates: {
          userPreferences: 0.1,
          contextualFactors: 0.05,
          familyDynamics: 0.02
        },
        qualityThresholds: {
          minConfidence: 0.6,
          minRelevance: 0.7,
          maxStalenessHours: 24
        }
      },
      integrations: {
        voice: {
          enabled: true,
          responseTimeoutMs: 5000,
          maxRetries: 3
        },
        avatar: {
          enabled: true,
          personalityIntegration: true,
          emotionAwareness: true
        },
        scheduling: {
          enabled: true,
          autoCreateEvents: false,
          conflictResolution: 'ask'
        },
        smartHome: {
          enabled: true,
          autoDiscovery: false,
          safetyLimits: ['heating', 'security', 'locks']
        }
      }
    };
  }

  /**
   * Load configuration from file
   */
  private async loadFromFile(): Promise<Partial<SystemConfiguration> | null> {
    try {
      // In a real implementation, this would read from the file system
      // For now, return null to use defaults
      return null;
    } catch (error) {
      console.warn('Could not load configuration file:', error);
      return null;
    }
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvironmentOverrides(): void {
    // Override with environment variables if available
    if (process.env.RECOMMENDATIONS_LOG_LEVEL) {
      this.config.system.logLevel = process.env.RECOMMENDATIONS_LOG_LEVEL as any;
    }
    
    if (process.env.RECOMMENDATIONS_MAX_MEMORY_MB) {
      this.config.performance.hardware.maxMemoryMB = parseInt(process.env.RECOMMENDATIONS_MAX_MEMORY_MB);
    }
    
    if (process.env.RECOMMENDATIONS_PRIVACY_LEVEL) {
      this.config.privacy.defaultPrivacyLevel = process.env.RECOMMENDATIONS_PRIVACY_LEVEL as PrivacyLevel;
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(config: SystemConfiguration = this.config): Promise<void> {
    // Validate performance thresholds
    if (config.performance.thresholds.maxMemoryMB > 8192) {
      throw new Error('Memory limit exceeds Jetson Nano Orin capacity');
    }
    
    if (config.performance.thresholds.maxLatencyMs < 100) {
      throw new Error('Latency threshold too aggressive for hardware constraints');
    }
    
    // Validate privacy settings
    if (config.privacy.dataRetentionDays < 1) {
      throw new Error('Data retention period must be at least 1 day');
    }
    
    // Validate child safety settings
    if (config.childSafety.safetyAuditFrequencyHours < 1) {
      throw new Error('Safety audit frequency must be at least 1 hour');
    }
    
    console.log('Configuration validation passed');
  }

  /**
   * Merge configurations with deep merge
   */
  private mergeConfigurations(base: SystemConfiguration, override: Partial<SystemConfiguration>): SystemConfiguration {
    return {
      ...base,
      ...override,
      system: { ...base.system, ...override.system },
      performance: {
        ...base.performance,
        ...override.performance,
        thresholds: { ...base.performance.thresholds, ...override.performance?.thresholds },
        optimization: { ...base.performance.optimization, ...override.performance?.optimization },
        hardware: { ...base.performance.hardware, ...override.performance?.hardware }
      },
      privacy: { ...base.privacy, ...override.privacy },
      childSafety: { ...base.childSafety, ...override.childSafety },
      recommendations: {
        ...base.recommendations,
        ...override.recommendations,
        defaultSettings: { ...base.recommendations.defaultSettings, ...override.recommendations?.defaultSettings },
        learningRates: { ...base.recommendations.learningRates, ...override.recommendations?.learningRates },
        qualityThresholds: { ...base.recommendations.qualityThresholds, ...override.recommendations?.qualityThresholds }
      },
      integrations: {
        ...base.integrations,
        ...override.integrations,
        voice: { ...base.integrations.voice, ...override.integrations?.voice },
        avatar: { ...base.integrations.avatar, ...override.integrations?.avatar },
        scheduling: { ...base.integrations.scheduling, ...override.integrations?.scheduling },
        smartHome: { ...base.integrations.smartHome, ...override.integrations?.smartHome }
      }
    };
  }

  /**
   * Notify configuration watchers
   */
  private notifyWatchers(): void {
    for (const callback of this.watchers.values()) {
      try {
        callback(this.config);
      } catch (error) {
        console.error('Error notifying configuration watcher:', error);
      }
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfiguration(): Promise<void> {
    try {
      // In a real implementation, this would save to the file system
      console.log('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
}

// Export singleton instance
export const systemConfig = new SystemConfigManager();