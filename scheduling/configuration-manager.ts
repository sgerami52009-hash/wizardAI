// Configuration Manager for Scheduling System
// Handles system settings, user preferences, and runtime configuration

import { EventEmitter } from 'events'
import { scheduleEventBus } from './events'
import { CalendarError } from './errors'
import { SystemConfiguration } from './system-orchestrator'

export interface UserPreferences {
  userId: string
  
  // Notification preferences
  preferredNotificationMethods: NotificationMethod[]
  quietHours: QuietHoursConfig
  reminderAdvanceTime: number // minutes
  
  // Calendar preferences
  defaultCalendarView: CalendarView
  workingHours: WorkingHoursConfig
  timeZone: string
  
  // Family preferences
  familyVisibility: FamilyVisibilityLevel
  parentalControlLevel: ParentalControlLevel
  
  // Voice and avatar preferences
  voiceEnabled: boolean
  avatarEnabled: boolean
  voiceLanguage: string
  
  // Accessibility preferences
  highContrastMode: boolean
  largeText: boolean
  screenReaderSupport: boolean
  
  // Privacy preferences
  dataRetentionDays: number
  shareWithFamily: boolean
  allowExternalSync: boolean
}

export enum NotificationMethod {
  VOICE = 'voice',
  VISUAL = 'visual',
  AVATAR = 'avatar',
  SOUND = 'sound'
}

export enum CalendarView {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  AGENDA = 'agenda'
}

export enum FamilyVisibilityLevel {
  PRIVATE = 'private',
  FAMILY_ONLY = 'family_only',
  SHARED = 'shared'
}

export enum ParentalControlLevel {
  NONE = 'none',
  BASIC = 'basic',
  STRICT = 'strict'
}

export interface QuietHoursConfig {
  enabled: boolean
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  daysOfWeek: number[] // 0-6, Sunday = 0
  allowUrgentReminders: boolean
}

export interface WorkingHoursConfig {
  enabled: boolean
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  daysOfWeek: number[] // 0-6, Sunday = 0
  timeZone: string
}

export interface SystemSettings {
  // Hardware settings
  hardwareProfile: HardwareProfile
  performanceMode: PerformanceMode
  
  // Feature flags
  enabledFeatures: FeatureFlag[]
  experimentalFeatures: FeatureFlag[]
  
  // Security settings
  encryptionEnabled: boolean
  backupEnabled: boolean
  auditLoggingEnabled: boolean
  
  // Integration settings
  externalCalendarProviders: CalendarProviderConfig[]
  voicePipelineConfig: VoicePipelineConfig
  avatarSystemConfig: AvatarSystemConfig
  
  // Child safety settings
  contentFilteringLevel: ContentFilteringLevel
  parentalApprovalRequired: boolean
  ageVerificationEnabled: boolean
}

export enum HardwareProfile {
  JETSON_NANO_ORIN = 'jetson_nano_orin',
  DESKTOP = 'desktop',
  CLOUD = 'cloud'
}

export enum PerformanceMode {
  LOW_POWER = 'low_power',
  BALANCED = 'balanced',
  HIGH_PERFORMANCE = 'high_performance'
}

export enum FeatureFlag {
  VOICE_INTEGRATION = 'voice_integration',
  AVATAR_INTEGRATION = 'avatar_integration',
  EXTERNAL_SYNC = 'external_sync',
  FAMILY_COORDINATION = 'family_coordination',
  ADVANCED_REMINDERS = 'advanced_reminders',
  CONTEXT_AWARENESS = 'context_awareness',
  MACHINE_LEARNING = 'machine_learning'
}

export enum ContentFilteringLevel {
  NONE = 'none',
  BASIC = 'basic',
  MODERATE = 'moderate',
  STRICT = 'strict'
}

export interface CalendarProviderConfig {
  providerId: string
  enabled: boolean
  maxAccounts: number
  syncInterval: number // minutes
  rateLimitConfig: RateLimitConfig
}

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  backoffMultiplier: number
  maxRetries: number
}

export interface VoicePipelineConfig {
  enabled: boolean
  wakeWordEnabled: boolean
  languageModel: string
  responseTimeout: number // milliseconds
  maxProcessingTime: number // milliseconds
}

export interface AvatarSystemConfig {
  enabled: boolean
  expressionsEnabled: boolean
  animationsEnabled: boolean
  renderingQuality: RenderingQuality
  frameRate: number
}

export enum RenderingQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export class ConfigurationManager extends EventEmitter {
  private systemSettings: SystemSettings
  private userPreferences: Map<string, UserPreferences> = new Map()
  private configFilePath: string
  private preferencesFilePath: string
  
  constructor(
    configFilePath: string = './config/system-settings.json',
    preferencesFilePath: string = './config/user-preferences.json'
  ) {
    super()
    
    this.configFilePath = configFilePath
    this.preferencesFilePath = preferencesFilePath
    this.systemSettings = this.getDefaultSystemSettings()
  }

  /**
   * Initialize configuration manager and load settings
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSystemSettings()
      await this.loadUserPreferences()
      
      // Validate configuration
      await this.validateConfiguration()
      
      // Apply hardware-specific optimizations
      await this.applyHardwareOptimizations()
      
      scheduleEventBus.emit('configuration:loaded', {
        systemSettings: this.systemSettings,
        userCount: this.userPreferences.size,
        timestamp: new Date()
      })
      
    } catch (error) {
      throw new CalendarError(
        'Failed to initialize configuration manager',
        'CONFIG_INITIALIZATION_FAILED',
        { cause: error as Error }
      )
    }
  }

  /**
   * Get system configuration for orchestrator
   */
  getSystemConfiguration(): SystemConfiguration {
    const settings = this.systemSettings
    
    return {
      // Memory and performance limits based on hardware profile
      maxMemoryUsage: this.getMemoryLimitForProfile(settings.hardwareProfile),
      maxActiveReminders: this.getReminderLimitForProfile(settings.hardwareProfile),
      maxSyncConnections: settings.externalCalendarProviders.length,
      
      // Child safety settings
      enableContentValidation: settings.contentFilteringLevel !== ContentFilteringLevel.NONE,
      parentalControlsEnabled: settings.parentalApprovalRequired,
      ageAppropriateMode: settings.ageVerificationEnabled,
      
      // Feature toggles
      enableVoiceIntegration: settings.enabledFeatures.includes(FeatureFlag.VOICE_INTEGRATION),
      enableAvatarIntegration: settings.enabledFeatures.includes(FeatureFlag.AVATAR_INTEGRATION),
      enableExternalSync: settings.enabledFeatures.includes(FeatureFlag.EXTERNAL_SYNC),
      enableFamilyCoordination: settings.enabledFeatures.includes(FeatureFlag.FAMILY_COORDINATION),
      
      // Performance settings based on hardware and mode
      reminderProcessingInterval: this.getReminderIntervalForMode(settings.performanceMode),
      syncInterval: this.getSyncIntervalForMode(settings.performanceMode),
      healthCheckInterval: this.getHealthCheckIntervalForMode(settings.performanceMode),
      
      // Hardware optimization
      jetsonNanoOptimizations: settings.hardwareProfile === HardwareProfile.JETSON_NANO_ORIN,
      lowPowerMode: settings.performanceMode === PerformanceMode.LOW_POWER,
      backgroundProcessingEnabled: settings.performanceMode !== PerformanceMode.LOW_POWER
    }
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string): UserPreferences {
    const preferences = this.userPreferences.get(userId)
    if (!preferences) {
      return this.getDefaultUserPreferences(userId)
    }
    return { ...preferences }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    try {
      const currentPreferences = this.getUserPreferences(userId)
      const updatedPreferences = { ...currentPreferences, ...updates, userId }
      
      // Validate preferences
      await this.validateUserPreferences(updatedPreferences)
      
      this.userPreferences.set(userId, updatedPreferences)
      
      // Save to file
      await this.saveUserPreferences()
      
      this.emit('userPreferencesUpdated', { userId, preferences: updatedPreferences })
      
      scheduleEventBus.emit('configuration:user:updated', {
        userId,
        preferences: updatedPreferences,
        timestamp: new Date()
      })
      
    } catch (error) {
      throw new CalendarError(
        'Failed to update user preferences',
        'USER_PREFERENCES_UPDATE_FAILED',
        { userId, cause: error as Error }
      )
    }
  }

  /**
   * Update system settings
   */
  async updateSystemSettings(updates: Partial<SystemSettings>): Promise<void> {
    try {
      const previousSettings = { ...this.systemSettings }
      this.systemSettings = { ...this.systemSettings, ...updates }
      
      // Validate updated settings
      await this.validateSystemSettings(this.systemSettings)
      
      // Save to file
      await this.saveSystemSettings()
      
      this.emit('systemSettingsUpdated', { 
        previousSettings, 
        newSettings: this.systemSettings 
      })
      
      scheduleEventBus.emit('configuration:system:updated', {
        previousSettings,
        newSettings: this.systemSettings,
        timestamp: new Date()
      })
      
    } catch (error) {
      // Rollback on error
      this.systemSettings = previousSettings
      
      throw new CalendarError(
        'Failed to update system settings',
        'SYSTEM_SETTINGS_UPDATE_FAILED',
        { cause: error as Error }
      )
    }
  }

  /**
   * Get child-safe configuration for a user
   */
  getChildSafeConfiguration(userId: string): Partial<UserPreferences> {
    const preferences = this.getUserPreferences(userId)
    
    // Apply child safety filters
    return {
      ...preferences,
      parentalControlLevel: ParentalControlLevel.STRICT,
      familyVisibility: FamilyVisibilityLevel.FAMILY_ONLY,
      allowExternalSync: false,
      dataRetentionDays: Math.min(preferences.dataRetentionDays, 30),
      shareWithFamily: true
    }
  }

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(userId: string): Promise<void> {
    const defaultPreferences = this.getDefaultUserPreferences(userId)
    await this.updateUserPreferences(userId, defaultPreferences)
  }

  /**
   * Reset system settings to defaults
   */
  async resetSystemSettings(): Promise<void> {
    const defaultSettings = this.getDefaultSystemSettings()
    await this.updateSystemSettings(defaultSettings)
  }

  private async loadSystemSettings(): Promise<void> {
    try {
      // In a real implementation, this would load from file
      // For now, use defaults
      this.systemSettings = this.getDefaultSystemSettings()
    } catch (error) {
      console.warn('Could not load system settings, using defaults:', error)
      this.systemSettings = this.getDefaultSystemSettings()
    }
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      // In a real implementation, this would load from file
      // For now, start with empty preferences
      this.userPreferences.clear()
    } catch (error) {
      console.warn('Could not load user preferences:', error)
      this.userPreferences.clear()
    }
  }

  private async saveSystemSettings(): Promise<void> {
    try {
      // In a real implementation, this would save to file
      console.log('System settings saved (mock)')
    } catch (error) {
      throw new CalendarError(
        'Failed to save system settings',
        'SETTINGS_SAVE_FAILED',
        { cause: error as Error }
      )
    }
  }

  private async saveUserPreferences(): Promise<void> {
    try {
      // In a real implementation, this would save to file
      console.log('User preferences saved (mock)')
    } catch (error) {
      throw new CalendarError(
        'Failed to save user preferences',
        'PREFERENCES_SAVE_FAILED',
        { cause: error as Error }
      )
    }
  }

  private async validateConfiguration(): Promise<void> {
    await this.validateSystemSettings(this.systemSettings)
    
    for (const [userId, preferences] of this.userPreferences) {
      await this.validateUserPreferences(preferences)
    }
  }

  private async validateSystemSettings(settings: SystemSettings): Promise<void> {
    // Validate hardware profile compatibility
    if (settings.hardwareProfile === HardwareProfile.JETSON_NANO_ORIN) {
      if (settings.performanceMode === PerformanceMode.HIGH_PERFORMANCE) {
        console.warn('High performance mode may not be suitable for Jetson Nano Orin')
      }
    }
    
    // Validate feature dependencies
    if (settings.enabledFeatures.includes(FeatureFlag.AVATAR_INTEGRATION) && 
        !settings.enabledFeatures.includes(FeatureFlag.VOICE_INTEGRATION)) {
      console.warn('Avatar integration works best with voice integration enabled')
    }
    
    // Validate child safety settings
    if (settings.contentFilteringLevel === ContentFilteringLevel.NONE && 
        settings.parentalApprovalRequired) {
      throw new CalendarError(
        'Parental approval requires content filtering to be enabled',
        'INVALID_CHILD_SAFETY_CONFIG'
      )
    }
  }

  private async validateUserPreferences(preferences: UserPreferences): Promise<void> {
    // Validate notification methods
    if (preferences.preferredNotificationMethods.length === 0) {
      throw new CalendarError(
        'At least one notification method must be enabled',
        'INVALID_NOTIFICATION_CONFIG',
        { userId: preferences.userId }
      )
    }
    
    // Validate time formats
    if (!this.isValidTimeFormat(preferences.quietHours.startTime) ||
        !this.isValidTimeFormat(preferences.quietHours.endTime)) {
      throw new CalendarError(
        'Invalid quiet hours time format',
        'INVALID_TIME_FORMAT',
        { userId: preferences.userId }
      )
    }
    
    // Validate data retention
    if (preferences.dataRetentionDays < 1 || preferences.dataRetentionDays > 365) {
      throw new CalendarError(
        'Data retention must be between 1 and 365 days',
        'INVALID_DATA_RETENTION',
        { userId: preferences.userId }
      )
    }
  }

  private async applyHardwareOptimizations(): Promise<void> {
    if (this.systemSettings.hardwareProfile === HardwareProfile.JETSON_NANO_ORIN) {
      // Apply Jetson Nano Orin specific optimizations
      this.systemSettings.avatarSystemConfig.renderingQuality = RenderingQuality.MEDIUM
      this.systemSettings.avatarSystemConfig.frameRate = Math.min(
        this.systemSettings.avatarSystemConfig.frameRate, 
        30
      )
      
      // Reduce sync frequency for power efficiency
      this.systemSettings.externalCalendarProviders.forEach(provider => {
        provider.syncInterval = Math.max(provider.syncInterval, 15)
      })
    }
  }

  private getDefaultSystemSettings(): SystemSettings {
    return {
      hardwareProfile: HardwareProfile.JETSON_NANO_ORIN,
      performanceMode: PerformanceMode.BALANCED,
      
      enabledFeatures: [
        FeatureFlag.VOICE_INTEGRATION,
        FeatureFlag.AVATAR_INTEGRATION,
        FeatureFlag.EXTERNAL_SYNC,
        FeatureFlag.FAMILY_COORDINATION,
        FeatureFlag.ADVANCED_REMINDERS,
        FeatureFlag.CONTEXT_AWARENESS
      ],
      experimentalFeatures: [],
      
      encryptionEnabled: true,
      backupEnabled: true,
      auditLoggingEnabled: true,
      
      externalCalendarProviders: [
        {
          providerId: 'google_calendar',
          enabled: true,
          maxAccounts: 3,
          syncInterval: 15,
          rateLimitConfig: {
            requestsPerMinute: 100,
            requestsPerHour: 1000,
            backoffMultiplier: 2,
            maxRetries: 3
          }
        }
      ],
      
      voicePipelineConfig: {
        enabled: true,
        wakeWordEnabled: true,
        languageModel: 'en-US',
        responseTimeout: 5000,
        maxProcessingTime: 500
      },
      
      avatarSystemConfig: {
        enabled: true,
        expressionsEnabled: true,
        animationsEnabled: true,
        renderingQuality: RenderingQuality.MEDIUM,
        frameRate: 30
      },
      
      contentFilteringLevel: ContentFilteringLevel.MODERATE,
      parentalApprovalRequired: true,
      ageVerificationEnabled: true
    }
  }

  private getDefaultUserPreferences(userId: string): UserPreferences {
    return {
      userId,
      
      preferredNotificationMethods: [
        NotificationMethod.VOICE,
        NotificationMethod.VISUAL,
        NotificationMethod.AVATAR
      ],
      
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '07:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        allowUrgentReminders: true
      },
      
      reminderAdvanceTime: 15,
      
      defaultCalendarView: CalendarView.WEEK,
      
      workingHours: {
        enabled: true,
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        timeZone: 'America/New_York'
      },
      
      timeZone: 'America/New_York',
      
      familyVisibility: FamilyVisibilityLevel.FAMILY_ONLY,
      parentalControlLevel: ParentalControlLevel.BASIC,
      
      voiceEnabled: true,
      avatarEnabled: true,
      voiceLanguage: 'en-US',
      
      highContrastMode: false,
      largeText: false,
      screenReaderSupport: false,
      
      dataRetentionDays: 90,
      shareWithFamily: true,
      allowExternalSync: true
    }
  }

  private getMemoryLimitForProfile(profile: HardwareProfile): number {
    switch (profile) {
      case HardwareProfile.JETSON_NANO_ORIN:
        return 1024 // 1GB
      case HardwareProfile.DESKTOP:
        return 2048 // 2GB
      case HardwareProfile.CLOUD:
        return 4096 // 4GB
      default:
        return 1024
    }
  }

  private getReminderLimitForProfile(profile: HardwareProfile): number {
    switch (profile) {
      case HardwareProfile.JETSON_NANO_ORIN:
        return 1000
      case HardwareProfile.DESKTOP:
        return 5000
      case HardwareProfile.CLOUD:
        return 10000
      default:
        return 1000
    }
  }

  private getReminderIntervalForMode(mode: PerformanceMode): number {
    switch (mode) {
      case PerformanceMode.LOW_POWER:
        return 10000 // 10 seconds
      case PerformanceMode.BALANCED:
        return 5000 // 5 seconds
      case PerformanceMode.HIGH_PERFORMANCE:
        return 2000 // 2 seconds
      default:
        return 5000
    }
  }

  private getSyncIntervalForMode(mode: PerformanceMode): number {
    switch (mode) {
      case PerformanceMode.LOW_POWER:
        return 30 // 30 minutes
      case PerformanceMode.BALANCED:
        return 15 // 15 minutes
      case PerformanceMode.HIGH_PERFORMANCE:
        return 5 // 5 minutes
      default:
        return 15
    }
  }

  private getHealthCheckIntervalForMode(mode: PerformanceMode): number {
    switch (mode) {
      case PerformanceMode.LOW_POWER:
        return 60 // 60 seconds
      case PerformanceMode.BALANCED:
        return 30 // 30 seconds
      case PerformanceMode.HIGH_PERFORMANCE:
        return 15 // 15 seconds
      default:
        return 30
    }
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }
}