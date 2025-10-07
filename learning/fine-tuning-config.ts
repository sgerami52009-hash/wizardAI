/**
 * Fine-Tuning Configuration
 * 
 * Configuration settings for the local LLM fine-tuning system
 * Optimized for Jetson Nano Orin hardware constraints and family safety requirements
 */

import { FineTuningIntegrationConfig } from './fine-tuning-integration';
import { FamilyLLMConfig } from './family-llm-factory';
import { FineTuningConfig } from './local-llm-fine-tuner';

/**
 * Default configuration for Jetson Nano Orin (8GB RAM)
 */
export const DEFAULT_JETSON_CONFIG: FineTuningConfig = {
  modelPath: '/opt/family-assistant/models/base-llm',
  outputPath: '/opt/family-assistant/models/family-models',
  learningRate: 0.0001, // Conservative learning rate for stability
  batchSize: 4, // Small batch size for memory constraints
  epochs: 2, // Limited epochs to prevent overfitting with small datasets
  validationSplit: 0.15, // Smaller validation split due to limited data
  safetyThreshold: 0.95, // High safety threshold for family use
  privacyLevel: 'high',
  hardwareConstraints: {
    maxMemoryUsage: 1536, // MB - Leave room for other system processes
    maxTrainingTime: 30, // minutes - Reasonable training time
    cpuCores: 4, // Jetson Nano Orin has 6 cores, use 4 for training
    gpuMemory: 512, // MB - Conservative GPU memory usage
    storageLimit: 2048 // MB - Limit model storage
  }
};

/**
 * Development configuration for testing (less restrictive)
 */
export const DEVELOPMENT_CONFIG: FineTuningConfig = {
  modelPath: './models/base-llm',
  outputPath: './models/family-models',
  learningRate: 0.001,
  batchSize: 8,
  epochs: 3,
  validationSplit: 0.2,
  safetyThreshold: 0.8,
  privacyLevel: 'high',
  hardwareConstraints: {
    maxMemoryUsage: 4096, // MB
    maxTrainingTime: 60, // minutes
    cpuCores: 8,
    gpuMemory: 1024, // MB
    storageLimit: 8192 // MB
  }
};

/**
 * Production configuration for cloud deployment (more resources)
 */
export const PRODUCTION_CONFIG: FineTuningConfig = {
  modelPath: '/app/models/base-llm',
  outputPath: '/app/models/family-models',
  learningRate: 0.0005,
  batchSize: 16,
  epochs: 5,
  validationSplit: 0.2,
  safetyThreshold: 0.98, // Even higher safety threshold for production
  privacyLevel: 'high',
  hardwareConstraints: {
    maxMemoryUsage: 8192, // MB
    maxTrainingTime: 120, // minutes
    cpuCores: 16,
    gpuMemory: 4096, // MB
    storageLimit: 16384 // MB
  }
};

/**
 * Family LLM Factory configuration
 */
export const DEFAULT_FAMILY_LLM_CONFIG: FamilyLLMConfig = {
  modelsDirectory: '/opt/family-assistant/models/family-models',
  maxModelsPerFamily: 3, // Keep only 3 versions per family
  fineTuningConfig: DEFAULT_JETSON_CONFIG,
  updateInterval: 24, // hours
  performanceThreshold: 0.8,
  safetyThreshold: 0.95
};

export const DEVELOPMENT_FAMILY_LLM_CONFIG: FamilyLLMConfig = {
  modelsDirectory: './models/family-models',
  maxModelsPerFamily: 5,
  fineTuningConfig: DEVELOPMENT_CONFIG,
  updateInterval: 1, // hours - more frequent updates for testing
  performanceThreshold: 0.7,
  safetyThreshold: 0.8
};

export const PRODUCTION_FAMILY_LLM_CONFIG: FamilyLLMConfig = {
  modelsDirectory: '/app/models/family-models',
  maxModelsPerFamily: 5,
  fineTuningConfig: PRODUCTION_CONFIG,
  updateInterval: 48, // hours - less frequent updates in production
  performanceThreshold: 0.85,
  safetyThreshold: 0.98
};

/**
 * Integration configuration
 */
export const DEFAULT_INTEGRATION_CONFIG: FineTuningIntegrationConfig = {
  enabled: true,
  familyLLMConfig: DEFAULT_FAMILY_LLM_CONFIG,
  minInteractionsForTraining: 50, // Minimum interactions before creating family model
  retrainingThreshold: 20, // New interactions needed to trigger retraining
  performanceMonitoringInterval: 60, // minutes
  autoUpdateEnabled: true,
  fallbackToGeneral: true
};

export const DEVELOPMENT_INTEGRATION_CONFIG: FineTuningIntegrationConfig = {
  enabled: true,
  familyLLMConfig: DEVELOPMENT_FAMILY_LLM_CONFIG,
  minInteractionsForTraining: 10, // Lower threshold for testing
  retrainingThreshold: 5,
  performanceMonitoringInterval: 15, // minutes
  autoUpdateEnabled: true,
  fallbackToGeneral: true
};

export const PRODUCTION_INTEGRATION_CONFIG: FineTuningIntegrationConfig = {
  enabled: true,
  familyLLMConfig: PRODUCTION_FAMILY_LLM_CONFIG,
  minInteractionsForTraining: 100, // Higher threshold for production quality
  retrainingThreshold: 50,
  performanceMonitoringInterval: 120, // minutes
  autoUpdateEnabled: true,
  fallbackToGeneral: true
};

/**
 * Safety-focused configuration for families with young children
 */
export const CHILD_SAFE_CONFIG: FineTuningConfig = {
  ...DEFAULT_JETSON_CONFIG,
  safetyThreshold: 0.99, // Maximum safety threshold
  privacyLevel: 'high',
  epochs: 1, // Single epoch to minimize risk of learning inappropriate patterns
  learningRate: 0.00005 // Very conservative learning rate
};

export const CHILD_SAFE_INTEGRATION_CONFIG: FineTuningIntegrationConfig = {
  ...DEFAULT_INTEGRATION_CONFIG,
  familyLLMConfig: {
    ...DEFAULT_FAMILY_LLM_CONFIG,
    fineTuningConfig: CHILD_SAFE_CONFIG,
    safetyThreshold: 0.99
  },
  minInteractionsForTraining: 100, // Higher threshold for child safety
  retrainingThreshold: 30
};

/**
 * Configuration factory based on environment
 */
export class FineTuningConfigFactory {
  static getConfig(environment: 'development' | 'production' | 'jetson' | 'child-safe'): FineTuningIntegrationConfig {
    switch (environment) {
      case 'development':
        return DEVELOPMENT_INTEGRATION_CONFIG;
      case 'production':
        return PRODUCTION_INTEGRATION_CONFIG;
      case 'jetson':
        return DEFAULT_INTEGRATION_CONFIG;
      case 'child-safe':
        return CHILD_SAFE_INTEGRATION_CONFIG;
      default:
        return DEFAULT_INTEGRATION_CONFIG;
    }
  }

  static getFineTuningConfig(environment: 'development' | 'production' | 'jetson' | 'child-safe'): FineTuningConfig {
    switch (environment) {
      case 'development':
        return DEVELOPMENT_CONFIG;
      case 'production':
        return PRODUCTION_CONFIG;
      case 'jetson':
        return DEFAULT_JETSON_CONFIG;
      case 'child-safe':
        return CHILD_SAFE_CONFIG;
      default:
        return DEFAULT_JETSON_CONFIG;
    }
  }

  static getFamilyLLMConfig(environment: 'development' | 'production' | 'jetson' | 'child-safe'): FamilyLLMConfig {
    switch (environment) {
      case 'development':
        return DEVELOPMENT_FAMILY_LLM_CONFIG;
      case 'production':
        return PRODUCTION_FAMILY_LLM_CONFIG;
      case 'jetson':
        return DEFAULT_FAMILY_LLM_CONFIG;
      case 'child-safe':
        return {
          ...DEFAULT_FAMILY_LLM_CONFIG,
          fineTuningConfig: CHILD_SAFE_CONFIG,
          safetyThreshold: 0.99
        };
      default:
        return DEFAULT_FAMILY_LLM_CONFIG;
    }
  }

  /**
   * Validate configuration for hardware constraints
   */
  static validateConfig(config: FineTuningConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check memory constraints
    if (config.hardwareConstraints.maxMemoryUsage > 8192) {
      errors.push('Memory usage exceeds Jetson Nano Orin capacity (8GB)');
    }

    // Check batch size vs memory
    if (config.batchSize > 16 && config.hardwareConstraints.maxMemoryUsage < 2048) {
      errors.push('Batch size too large for available memory');
    }

    // Check safety threshold
    if (config.safetyThreshold < 0.8) {
      errors.push('Safety threshold too low for family use');
    }

    // Check training time
    if (config.hardwareConstraints.maxTrainingTime > 180) {
      errors.push('Training time too long for real-time system');
    }

    // Check learning rate
    if (config.learningRate > 0.01) {
      errors.push('Learning rate too high, may cause instability');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Optimize configuration for specific hardware
   */
  static optimizeForHardware(
    baseConfig: FineTuningConfig,
    availableMemory: number, // MB
    cpuCores: number,
    gpuMemory?: number // MB
  ): FineTuningConfig {
    const optimized = { ...baseConfig };

    // Adjust memory usage
    optimized.hardwareConstraints.maxMemoryUsage = Math.min(
      availableMemory * 0.7, // Use 70% of available memory
      baseConfig.hardwareConstraints.maxMemoryUsage
    );

    // Adjust batch size based on memory
    if (optimized.hardwareConstraints.maxMemoryUsage < 1024) {
      optimized.batchSize = Math.min(2, optimized.batchSize);
    } else if (optimized.hardwareConstraints.maxMemoryUsage < 2048) {
      optimized.batchSize = Math.min(4, optimized.batchSize);
    }

    // Adjust CPU cores
    optimized.hardwareConstraints.cpuCores = Math.min(
      cpuCores - 2, // Leave 2 cores for system
      baseConfig.hardwareConstraints.cpuCores
    );

    // Adjust GPU memory if available
    if (gpuMemory) {
      optimized.hardwareConstraints.gpuMemory = Math.min(
        gpuMemory * 0.8, // Use 80% of GPU memory
        baseConfig.hardwareConstraints.gpuMemory || 512
      );
    }

    return optimized;
  }

  /**
   * Create child-safe configuration variant
   */
  static createChildSafeVariant(baseConfig: FineTuningConfig): FineTuningConfig {
    return {
      ...baseConfig,
      safetyThreshold: Math.max(0.99, baseConfig.safetyThreshold),
      epochs: Math.min(1, baseConfig.epochs),
      learningRate: Math.min(0.00005, baseConfig.learningRate),
      privacyLevel: 'high'
    };
  }
}

/**
 * Runtime configuration detection
 */
export class RuntimeConfigDetector {
  /**
   * Detect optimal configuration based on system resources
   */
  static async detectOptimalConfig(): Promise<FineTuningIntegrationConfig> {
    const memoryInfo = process.memoryUsage();
    const totalMemory = memoryInfo.heapTotal / 1024 / 1024; // MB
    
    // Detect if running on Jetson (simplified detection)
    const isJetson = process.arch === 'arm64' && totalMemory < 8192;
    
    // Detect if in development mode
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Detect if child safety mode is required
    const isChildSafeMode = process.env.CHILD_SAFE_MODE === 'true';

    if (isChildSafeMode) {
      return FineTuningConfigFactory.getConfig('child-safe');
    } else if (isDevelopment) {
      return FineTuningConfigFactory.getConfig('development');
    } else if (isJetson) {
      return FineTuningConfigFactory.getConfig('jetson');
    } else {
      return FineTuningConfigFactory.getConfig('production');
    }
  }

  /**
   * Get system resource information
   */
  static getSystemResources(): {
    totalMemory: number;
    availableMemory: number;
    cpuCores: number;
    architecture: string;
  } {
    const memoryInfo = process.memoryUsage();
    
    return {
      totalMemory: memoryInfo.heapTotal / 1024 / 1024, // MB
      availableMemory: (memoryInfo.heapTotal - memoryInfo.heapUsed) / 1024 / 1024, // MB
      cpuCores: require('os').cpus().length,
      architecture: process.arch
    };
  }
}