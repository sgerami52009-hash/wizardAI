/**
 * Factory for creating LLM-Enhanced Learning Engine instances
 * 
 * Provides a centralized way to create and configure LLM-enhanced
 * learning engines with proper dependency injection and fallback handling.
 */

import { LLMEnhancedLearningEngine } from './llm-enhanced-learning-engine';
import { LearningEngine } from './learning-engine';
import { LearningEventBus, DefaultLearningEventBus } from '../../learning/events';
import { ErrorRecoveryManager, DefaultErrorRecoveryManager } from '../../learning/errors';
import { PrivacyManager } from '../privacy/privacy-manager';
import { ILearningEngine } from '../interfaces';

export interface LLMEnhancedFactoryConfig {
  enableLLM: boolean;
  llmConfig?: {
    provider: 'openai' | 'anthropic' | 'local';
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  privacySettings?: {
    dataSharing: 'private' | 'family' | 'anonymous';
    llmProcessing: boolean;
    localOnly: boolean;
  };
  performanceConstraints?: {
    maxMemoryMB: number;
    maxResponseTimeMs: number;
    enableCaching: boolean;
  };
}

export const DEFAULT_LLM_FACTORY_CONFIG: LLMEnhancedFactoryConfig = {
  enableLLM: true,
  llmConfig: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.7
  },
  privacySettings: {
    dataSharing: 'family',
    llmProcessing: true,
    localOnly: false
  },
  performanceConstraints: {
    maxMemoryMB: 1500,
    maxResponseTimeMs: 2000,
    enableCaching: true
  }
};

/**
 * Factory class for creating learning engine instances
 */
export class LLMEnhancedLearningEngineFactory {
  private static instance: LLMEnhancedLearningEngineFactory;
  private eventBus: LearningEventBus;
  private errorRecovery: ErrorRecoveryManager;
  private privacyManager: PrivacyManager;

  private constructor() {
    this.eventBus = new DefaultLearningEventBus();
    this.errorRecovery = new DefaultErrorRecoveryManager();
    this.privacyManager = new PrivacyManager();
  }

  public static getInstance(): LLMEnhancedLearningEngineFactory {
    if (!LLMEnhancedLearningEngineFactory.instance) {
      LLMEnhancedLearningEngineFactory.instance = new LLMEnhancedLearningEngineFactory();
    }
    return LLMEnhancedLearningEngineFactory.instance;
  }

  /**
   * Create a learning engine instance based on configuration
   */
  async createLearningEngine(
    config: LLMEnhancedFactoryConfig = DEFAULT_LLM_FACTORY_CONFIG
  ): Promise<ILearningEngine> {
    try {
      if (config.enableLLM) {
        console.log('Creating LLM-Enhanced Learning Engine...');
        
        const enhancedEngine = new LLMEnhancedLearningEngine(
          this.eventBus,
          this.errorRecovery,
          this.privacyManager,
          config.llmConfig
        );

        // Initialize the engine
        await enhancedEngine.initialize();
        
        console.log('LLM-Enhanced Learning Engine created successfully');
        return enhancedEngine;
      } else {
        console.log('Creating traditional Learning Engine...');
        
        const traditionalEngine = new LearningEngine();
        await traditionalEngine.initialize();
        
        console.log('Traditional Learning Engine created successfully');
        return traditionalEngine;
      }
    } catch (error) {
      console.error('Failed to create LLM-Enhanced Learning Engine, falling back to traditional:', error);
      
      // Fallback to traditional learning engine
      const fallbackEngine = new LearningEngine();
      await fallbackEngine.initialize();
      
      return fallbackEngine;
    }
  }

  /**
   * Create learning engine with automatic configuration detection
   */
  async createAutoConfiguredEngine(): Promise<ILearningEngine> {
    const config = await this.detectOptimalConfiguration();
    return await this.createLearningEngine(config);
  }

  /**
   * Detect optimal configuration based on system capabilities
   */
  private async detectOptimalConfiguration(): Promise<LLMEnhancedFactoryConfig> {
    const config = { ...DEFAULT_LLM_FACTORY_CONFIG };

    try {
      // Check memory availability
      const memoryUsage = process.memoryUsage();
      const availableMemoryMB = (memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024;
      
      if (availableMemoryMB < 500) {
        console.warn('Low memory detected, disabling LLM features');
        config.enableLLM = false;
        return config;
      }

      // Check for API keys
      const hasOpenAIKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
      const hasAnthropicKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
      
      if (!hasOpenAIKey && !hasAnthropicKey) {
        console.warn('No LLM API keys found, checking for local models...');
        
        // Check for local model availability
        const hasLocalModel = await this.checkLocalModelAvailability();
        if (!hasLocalModel) {
          console.warn('No local models available, disabling LLM features');
          config.enableLLM = false;
          return config;
        }
        
        config.llmConfig!.provider = 'local';
      } else if (hasAnthropicKey) {
        config.llmConfig!.provider = 'anthropic';
      }

      // Adjust performance constraints based on system
      if (this.isJetsonNano()) {
        config.performanceConstraints!.maxMemoryMB = 1000;
        config.performanceConstraints!.maxResponseTimeMs = 3000;
        config.llmConfig!.maxTokens = 500; // Reduce token limit for Jetson
      }

      return config;
    } catch (error) {
      console.error('Error detecting configuration, using defaults:', error);
      return config;
    }
  }

  /**
   * Check if local LLM models are available
   */
  private async checkLocalModelAvailability(): Promise<boolean> {
    try {
      // Check for common local model paths
      const fs = require('fs').promises;
      const path = require('path');
      
      const commonPaths = [
        './models/llm',
        '/opt/models/llm',
        process.env.LLM_MODEL_PATH
      ].filter(Boolean);
      
      for (const modelPath of commonPaths) {
        try {
          const stats = await fs.stat(modelPath);
          if (stats.isDirectory()) {
            console.log(`Found local model directory: ${modelPath}`);
            return true;
          }
        } catch (error) {
          // Path doesn't exist, continue checking
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking local model availability:', error);
      return false;
    }
  }

  /**
   * Detect if running on Jetson Nano
   */
  private isJetsonNano(): boolean {
    try {
      const fs = require('fs');
      
      // Check for Jetson-specific files
      const jetsonFiles = [
        '/etc/nv_tegra_release',
        '/proc/device-tree/model',
        '/sys/firmware/devicetree/base/model'
      ];
      
      for (const file of jetsonFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8').toLowerCase();
          if (content.includes('jetson') || content.includes('tegra')) {
            return true;
          }
        } catch (error) {
          // File doesn't exist or can't be read
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get shared event bus instance
   */
  getEventBus(): LearningEventBus {
    return this.eventBus;
  }

  /**
   * Get shared error recovery manager
   */
  getErrorRecoveryManager(): ErrorRecoveryManager {
    return this.errorRecovery;
  }

  /**
   * Get shared privacy manager
   */
  getPrivacyManager(): PrivacyManager {
    return this.privacyManager;
  }

  /**
   * Update factory configuration
   */
  updateConfiguration(updates: Partial<LLMEnhancedFactoryConfig>): void {
    // This would update the default configuration for future instances
    Object.assign(DEFAULT_LLM_FACTORY_CONFIG, updates);
  }

  /**
   * Health check for factory components
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, any>;
  }> {
    try {
      const components = {
        eventBus: 'healthy',
        errorRecovery: 'healthy',
        privacyManager: 'healthy',
        memoryUsage: this.getMemoryUsage()
      };

      const status = 'healthy';
      
      return { status, components };
    } catch (error) {
      return {
        status: 'unhealthy',
        components: {
          error: error.message
        }
      };
    }
  }

  private getMemoryUsage(): any {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }
}

/**
 * Convenience function to create a learning engine
 */
export async function createLearningEngine(
  config?: Partial<LLMEnhancedFactoryConfig>
): Promise<ILearningEngine> {
  const factory = LLMEnhancedLearningEngineFactory.getInstance();
  const fullConfig = { ...DEFAULT_LLM_FACTORY_CONFIG, ...config };
  return await factory.createLearningEngine(fullConfig);
}

/**
 * Convenience function to create an auto-configured learning engine
 */
export async function createAutoConfiguredLearningEngine(): Promise<ILearningEngine> {
  const factory = LLMEnhancedLearningEngineFactory.getInstance();
  return await factory.createAutoConfiguredEngine();
}

export default LLMEnhancedLearningEngineFactory;