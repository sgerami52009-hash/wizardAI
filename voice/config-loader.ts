/**
 * Configuration Loader for Voice Interaction Pipeline
 * Handles environment-specific configuration loading and validation
 */

import ConfigManager, { VoicePipelineConfig } from './config-manager';
import * as path from 'path';
import { promises as fs } from 'fs';

export interface ConfigLoaderOptions {
  environment?: string;
  configDir?: string;
  fallbackToDefault?: boolean;
  validateOnLoad?: boolean;
}

export class ConfigLoader {
  private configManager: ConfigManager;
  private environment: string;
  private configDir: string;

  constructor(options: ConfigLoaderOptions = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.configDir = options.configDir || './config';
    
    const configPath = this.getConfigPath();
    this.configManager = new ConfigManager(configPath);
  }

  /**
   * Load configuration for current environment
   */
  async loadConfig(): Promise<VoicePipelineConfig> {
    try {
      return await this.configManager.loadConfig();
    } catch (error) {
      console.error(`Failed to load configuration for environment ${this.environment}:`, error);
      
      // Try to load default configuration
      if (this.environment !== 'development') {
        console.log('Attempting to load development configuration as fallback...');
        const fallbackLoader = new ConfigLoader({ 
          environment: 'development',
          configDir: this.configDir 
        });
        return await fallbackLoader.loadConfig();
      }
      
      throw error;
    }
  }

  /**
   * Get configuration manager instance
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if configuration file exists for current environment
   */
  async configExists(): Promise<boolean> {
    try {
      const configPath = this.getConfigPath();
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create default configuration file for current environment
   */
  async createDefaultConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    
    // Ensure config directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Load and save default configuration
    const defaultConfig = this.configManager['getDefaultConfig']();
    defaultConfig.environment = this.environment as any;
    
    await this.configManager.saveConfig(defaultConfig);
    console.log(`Created default configuration file: ${configPath}`);
  }

  /**
   * Get configuration file path for current environment
   */
  private getConfigPath(): string {
    return path.join(this.configDir, `voice-pipeline.${this.environment}.json`);
  }
}

/**
 * Global configuration instance
 */
let globalConfig: VoicePipelineConfig | null = null;
let globalConfigManager: ConfigManager | null = null;

/**
 * Initialize global configuration
 */
export async function initializeConfig(options?: ConfigLoaderOptions): Promise<VoicePipelineConfig> {
  const loader = new ConfigLoader(options);
  
  // Check if config file exists, create if not
  if (!(await loader.configExists())) {
    console.log(`Configuration file not found for environment ${loader.getEnvironment()}, creating default...`);
    await loader.createDefaultConfig();
  }
  
  globalConfig = await loader.loadConfig();
  globalConfigManager = loader.getConfigManager();
  
  // Set up configuration change listeners
  globalConfigManager.on('configUpdated', (event) => {
    globalConfig = event.newConfig;
    console.log('Configuration updated:', Object.keys(event.changes));
  });
  
  globalConfigManager.on('configError', (error) => {
    console.error('Configuration error:', error);
  });
  
  globalConfigManager.on('configWarning', (warning) => {
    console.warn('Configuration warning:', warning);
  });
  
  return globalConfig;
}

/**
 * Get global configuration instance
 */
export function getConfig(): VoicePipelineConfig {
  if (!globalConfig) {
    throw new Error('Configuration not initialized. Call initializeConfig() first.');
  }
  return globalConfig;
}

/**
 * Get global configuration manager instance
 */
export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    throw new Error('Configuration manager not initialized. Call initializeConfig() first.');
  }
  return globalConfigManager;
}

/**
 * Update global configuration
 */
export async function updateConfig(updates: Partial<VoicePipelineConfig>): Promise<void> {
  const manager = getConfigManager();
  await manager.updateConfig(updates);
}

/**
 * Get configuration for specific component
 */
export function getComponentConfig<T extends keyof VoicePipelineConfig>(
  component: T
): VoicePipelineConfig[T] {
  const config = getConfig();
  return config[component];
}

/**
 * Validate current configuration
 */
export function validateConfig() {
  const manager = getConfigManager();
  const config = getConfig();
  return manager.validateConfig(config);
}

export default ConfigLoader;