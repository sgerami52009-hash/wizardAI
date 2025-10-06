/**
 * Configuration module exports
 * Provides centralized access to all configuration and settings management
 */

export { 
  SystemConfigManager, 
  SystemConfiguration, 
  UserInitializationConfig, 
  FamilyInitializationConfig,
  systemConfig 
} from './system-config';

export { 
  SettingsManager, 
  SettingsValidationResult, 
  SettingsUpdateRequest, 
  FamilySettingsCoordination 
} from './settings-manager';

export { 
  PerformanceTuningManager, 
  PerformanceTuningProfile, 
  AdaptiveSettings, 
  PerformanceOptimizationRecommendation, 
  OptimizationAction 
} from './performance-tuning';

// Create and export configured instances
import { systemConfig } from './system-config';
import { SettingsManager } from './settings-manager';
import { PerformanceTuningManager } from './performance-tuning';

export const settingsManager = new SettingsManager(systemConfig);
export const performanceTuningManager = new PerformanceTuningManager(systemConfig);

/**
 * Initialize all configuration systems
 */
export async function initializeConfiguration(): Promise<void> {
  console.log('Initializing recommendation engine configuration...');
  
  try {
    // Load system configuration
    await systemConfig.loadConfiguration();
    
    // Initialize performance tuning
    await performanceTuningManager.initializePerformanceTuning();
    
    console.log('Configuration initialization completed successfully');
  } catch (error) {
    console.error('Failed to initialize configuration:', error);
    throw error;
  }
}

/**
 * Get configuration summary for diagnostics
 */
export function getConfigurationSummary(): {
  system: any;
  performance: any;
  settings: any;
} {
  const systemConfig = systemConfig.getConfiguration();
  const performanceProfile = performanceTuningManager.getCurrentProfile();
  
  return {
    system: {
      version: systemConfig.system.version,
      environment: systemConfig.system.environment,
      logLevel: systemConfig.system.logLevel
    },
    performance: {
      profile: performanceProfile.name,
      memoryLimit: systemConfig.performance.hardware.maxMemoryMB,
      maxLatency: systemConfig.performance.thresholds.maxLatencyMs,
      jetsonOptimized: systemConfig.performance.hardware.jetsonOptimizations
    },
    settings: {
      privacyLevel: systemConfig.privacy.defaultPrivacyLevel,
      childSafetyEnabled: systemConfig.childSafety.strictModeEnabled,
      enabledEngines: systemConfig.recommendations.enabledEngines
    }
  };
}