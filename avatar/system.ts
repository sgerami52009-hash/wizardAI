// Avatar System Main Orchestrator

import { AvatarConfiguration } from './types';
import { AvatarCustomizationController } from './core';
import { avatarEventBus } from './events';
import { avatarErrorHandler } from './errors';
import { performanceMonitor } from '../rendering/performance';
import { AppearanceManager } from './appearance-manager';
import { personalityManager } from './personality-manager';
import { voiceCharacteristicsManager } from './voice-characteristics-manager';
import { avatarSafetyValidator } from './enhanced-safety-validator';
import { AvatarDataStore } from './storage';
import { Avatar3DRenderer } from '../rendering/renderer';
import { AssetManager } from '../rendering/asset-manager';
import { CharacterPackageManager } from '../packages/package-manager';

export interface AvatarSystem {
  initialize(config?: SystemConfiguration): Promise<void>;
  shutdown(): Promise<void>;
  restart(): Promise<void>;
  getCustomizationController(): AvatarCustomizationController;
  isInitialized(): boolean;
  getSystemHealth(): SystemHealth;
  updateConfiguration(config: Partial<SystemConfiguration>): Promise<void>;
  getConfiguration(): SystemConfiguration;
  recoverComponent(componentName: string): Promise<boolean>;
  enableMaintenanceMode(): Promise<void>;
  disableMaintenanceMode(): Promise<void>;
  isMaintenanceMode(): boolean;
}

export interface SystemConfiguration {
  performance: {
    targetFPS: number;
    maxGPUMemory: number;
    maxCPUUsage: number;
    enableAutoOptimization: boolean;
  };
  safety: {
    enableParentalControls: boolean;
    defaultAgeRating: string;
    auditLogging: boolean;
  };
  rendering: {
    enableHardwareAcceleration: boolean;
    lodEnabled: boolean;
    maxTextureResolution: number;
  };
  storage: {
    encryptionEnabled: boolean;
    backupInterval: number;
    maxBackups: number;
  };
  monitoring: {
    healthCheckInterval: number;
    performanceLogging: boolean;
    alertThresholds: {
      fps: number;
      memory: number;
      cpu: number;
    };
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  components: ComponentHealth[];
  performance: PerformanceStatus;
  lastCheck: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'online' | 'offline' | 'error' | 'recovering';
  lastError?: string;
  uptime: number;
  lastHealthCheck: Date;
  recoveryAttempts: number;
  isEssential: boolean;
}

export interface PerformanceStatus {
  fps: number;
  memoryUsage: number;
  cpuUsage: number;
  isOptimal: boolean;
}

interface ComponentInstance {
  instance: any;
  name: string;
  isEssential: boolean;
  healthCheck: () => Promise<boolean>;
  recover: () => Promise<boolean>;
  lastHealthCheck: Date;
  recoveryAttempts: number;
  status: 'online' | 'offline' | 'error' | 'recovering';
  startTime: number;
}

export class AvatarSystemImpl implements AvatarSystem {
  private initialized = false;
  private maintenanceMode = false;
  private configuration: SystemConfiguration;
  private customizationController?: AvatarCustomizationController;
  private components: Map<string, ComponentInstance> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();

  constructor() {
    this.configuration = this.getDefaultConfiguration();
  }

  private getDefaultConfiguration(): SystemConfiguration {
    return {
      performance: {
        targetFPS: 60,
        maxGPUMemory: 2048, // 2GB in MB
        maxCPUUsage: 50,
        enableAutoOptimization: true
      },
      safety: {
        enableParentalControls: true,
        defaultAgeRating: 'all-ages',
        auditLogging: true
      },
      rendering: {
        enableHardwareAcceleration: true,
        lodEnabled: true,
        maxTextureResolution: 1024
      },
      storage: {
        encryptionEnabled: true,
        backupInterval: 3600000, // 1 hour in ms
        maxBackups: 10
      },
      monitoring: {
        healthCheckInterval: 30000, // 30 seconds
        performanceLogging: true,
        alertThresholds: {
          fps: 45,
          memory: 1800, // 90% of 2GB
          cpu: 70
        }
      }
    };
  }



  async initialize(config?: SystemConfiguration): Promise<void> {
    try {
      console.log('Initializing Avatar System...');
      
      if (config) {
        this.configuration = { ...this.configuration, ...config };
      }

      // Initialize core components in dependency order
      await this.initializeComponents();
      
      // Register system event listeners
      this.registerEventListeners();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.initialized = true;
      this.startTime = Date.now();
      
      console.log('Avatar System initialized successfully');
      
      // Emit system ready event
      avatarEventBus.emit('avatar:system:ready', {
        timestamp: new Date(),
        configuration: this.configuration
      });
      
    } catch (error) {
      console.error('Failed to initialize Avatar System:', error);
      await this.handleInitializationFailure(error);
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const componentInitializers = [
      {
        name: 'EventBus',
        initialize: async () => avatarEventBus,
        healthCheck: async () => true,
        recover: async () => true,
        isEssential: true
      },
      {
        name: 'ErrorHandler',
        initialize: async () => avatarErrorHandler,
        healthCheck: async () => true,
        recover: async () => true,
        isEssential: true
      },
      {
        name: 'PerformanceMonitor',
        initialize: async () => {
          performanceMonitor.startMonitoring();
          return performanceMonitor;
        },
        healthCheck: async () => performanceMonitor.isPerformanceAcceptable(),
        recover: async () => {
          try {
            performanceMonitor.stopMonitoring();
            performanceMonitor.startMonitoring();
            return true;
          } catch {
            return false;
          }
        },
        isEssential: true
      },
      {
        name: 'DataStore',
        initialize: async () => {
          const dataStore = new AvatarDataStore();
          return dataStore;
        },
        healthCheck: async () => {
          const dataStore = this.components.get('DataStore')?.instance;
          return dataStore ? await dataStore.healthCheck() : false;
        },
        recover: async () => {
          try {
            const dataStore = this.components.get('DataStore')?.instance;
            if (dataStore) {
              await dataStore.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: true
      },
      {
        name: 'SafetyValidator',
        initialize: async () => {
          return avatarSafetyValidator;
        },
        healthCheck: async () => {
          const validator = this.components.get('SafetyValidator')?.instance;
          return validator ? await validator.healthCheck() : false;
        },
        recover: async () => {
          try {
            const validator = this.components.get('SafetyValidator')?.instance;
            if (validator) {
              await validator.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: true
      },
      {
        name: 'Renderer',
        initialize: async () => {
          const renderer = new Avatar3DRenderer();
          await renderer.initialize(this.configuration.rendering);
          return renderer;
        },
        healthCheck: async () => {
          const renderer = this.components.get('Renderer')?.instance;
          return renderer ? await renderer.healthCheck() : false;
        },
        recover: async () => {
          try {
            const renderer = this.components.get('Renderer')?.instance;
            if (renderer) {
              await renderer.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: true
      },
      {
        name: 'AssetManager',
        initialize: async () => {
          const assetManager = new AssetManager();
          return assetManager;
        },
        healthCheck: async () => {
          const assetManager = this.components.get('AssetManager')?.instance;
          return assetManager ? await assetManager.healthCheck() : false;
        },
        recover: async () => {
          try {
            const assetManager = this.components.get('AssetManager')?.instance;
            if (assetManager) {
              await assetManager.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: false
      },
      {
        name: 'AppearanceManager',
        initialize: async () => {
          const appearanceManager = new AppearanceManager();
          return appearanceManager;
        },
        healthCheck: async () => {
          const appearanceManager = this.components.get('AppearanceManager')?.instance;
          return appearanceManager ? await appearanceManager.healthCheck() : false;
        },
        recover: async () => {
          try {
            const appearanceManager = this.components.get('AppearanceManager')?.instance;
            if (appearanceManager) {
              await appearanceManager.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: false
      },
      {
        name: 'PersonalityManager',
        initialize: async () => {
          return personalityManager;
        },
        healthCheck: async () => {
          const personalityManager = this.components.get('PersonalityManager')?.instance;
          return personalityManager ? await personalityManager.healthCheck() : false;
        },
        recover: async () => {
          try {
            const personalityManager = this.components.get('PersonalityManager')?.instance;
            if (personalityManager) {
              await personalityManager.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: false
      },
      {
        name: 'VoiceCharacteristicsManager',
        initialize: async () => {
          return voiceCharacteristicsManager;
        },
        healthCheck: async () => {
          const voiceManager = this.components.get('VoiceCharacteristicsManager')?.instance;
          return voiceManager ? await voiceManager.healthCheck() : false;
        },
        recover: async () => {
          try {
            const voiceManager = this.components.get('VoiceCharacteristicsManager')?.instance;
            if (voiceManager) {
              await voiceManager.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: false
      },
      {
        name: 'CharacterPackageManager',
        initialize: async () => {
          const packageManager = new CharacterPackageManager();
          return packageManager;
        },
        healthCheck: async () => {
          const packageManager = this.components.get('CharacterPackageManager')?.instance;
          return packageManager ? await packageManager.healthCheck() : false;
        },
        recover: async () => {
          try {
            const packageManager = this.components.get('CharacterPackageManager')?.instance;
            if (packageManager) {
              await packageManager.recover();
              return true;
            }
            return false;
          } catch {
            return false;
          }
        },
        isEssential: false
      }
    ];

    for (const componentInit of componentInitializers) {
      try {
        console.log(`Initializing ${componentInit.name}...`);
        const instance = await componentInit.initialize();
        
        this.components.set(componentInit.name, {
          instance,
          name: componentInit.name,
          isEssential: componentInit.isEssential,
          healthCheck: componentInit.healthCheck,
          recover: componentInit.recover,
          lastHealthCheck: new Date(),
          recoveryAttempts: 0,
          status: 'online',
          startTime: Date.now()
        });
        
        console.log(`${componentInit.name} initialized successfully`);
      } catch (error) {
        console.error(`Failed to initialize ${componentInit.name}:`, error);
        
        if (componentInit.isEssential) {
          throw new Error(`Essential component ${componentInit.name} failed to initialize: ${error}`);
        } else {
          console.warn(`Non-essential component ${componentInit.name} failed to initialize, continuing...`);
          this.components.set(componentInit.name, {
            instance: null,
            name: componentInit.name,
            isEssential: componentInit.isEssential,
            healthCheck: componentInit.healthCheck,
            recover: componentInit.recover,
            lastHealthCheck: new Date(),
            recoveryAttempts: 0,
            status: 'error',
            startTime: Date.now()
          });
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down Avatar System...');
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      
      // Shutdown components in reverse order
      const componentNames = Array.from(this.components.keys()).reverse();
      for (const componentName of componentNames) {
        const component = this.components.get(componentName);
        if (component?.instance && typeof component.instance.shutdown === 'function') {
          try {
            console.log(`Shutting down ${componentName}...`);
            await component.instance.shutdown();
          } catch (error) {
            console.error(`Error shutting down ${componentName}:`, error);
          }
        }
      }
      
      // Stop performance monitoring
      performanceMonitor.stopMonitoring();
      
      // Cleanup components
      this.components.clear();
      
      // Remove event listeners
      avatarEventBus.removeAllListeners();
      
      this.initialized = false;
      this.maintenanceMode = false;
      
      console.log('Avatar System shutdown complete');
      
      // Emit shutdown event
      avatarEventBus.emit('avatar:system:shutdown', {
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error during Avatar System shutdown:', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    console.log('Restarting Avatar System...');
    await this.shutdown();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    await this.initialize(this.configuration);
    console.log('Avatar System restart complete');
  }

  getCustomizationController(): AvatarCustomizationController {
    if (!this.initialized) {
      throw new Error('Avatar System not initialized');
    }
    // Return a mock controller for now - in real implementation this would be initialized
    return {
      async startCustomization(userId: string) {
        return {
          sessionId: `session-${Date.now()}`,
          userId,
          currentConfiguration: {} as any,
          pendingChanges: [],
          previewActive: false
        };
      },
      async previewChange(change: any) {
        return { success: true, renderTime: 16.7, performanceImpact: 0.1, errors: [] };
      },
      async applyCustomization(customization: any) {
        return { isValid: true, requiresParentalApproval: false, blockedElements: [], warnings: [], errors: [] };
      },
      async saveCustomization(userId: string) {},
      async loadUserAvatar(userId: string) {
        return {} as any;
      },
      async resetToDefaults(userId: string) {}
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getSystemHealth(): SystemHealth {
    if (!this.initialized) {
      return {
        status: 'offline',
        components: [],
        performance: {
          fps: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          isOptimal: false
        },
        lastCheck: new Date()
      };
    }

    const performanceMetrics = performanceMonitor.getCurrentMetrics();
    const components: ComponentHealth[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'critical' | 'offline' = 'healthy';
    let criticalComponentsDown = 0;
    let degradedComponents = 0;

    // Check each component
    for (const [name, component] of this.components.entries()) {
      const componentHealth: ComponentHealth = {
        name,
        status: component.status,
        lastError: component.status === 'error' ? 'Component health check failed' : undefined,
        uptime: Date.now() - component.startTime,
        lastHealthCheck: component.lastHealthCheck,
        recoveryAttempts: component.recoveryAttempts,
        isEssential: component.isEssential
      };
      
      components.push(componentHealth);

      if (component.status === 'error' || component.status === 'offline') {
        if (component.isEssential) {
          criticalComponentsDown++;
        } else {
          degradedComponents++;
        }
      }
    }

    // Determine overall system status
    if (criticalComponentsDown > 0) {
      overallStatus = 'critical';
    } else if (degradedComponents > 0 || !performanceMetrics.isOptimal) {
      overallStatus = 'degraded';
    } else if (this.maintenanceMode) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      components,
      performance: {
        fps: performanceMetrics.currentFPS,
        memoryUsage: performanceMetrics.gpuMemoryUsage,
        cpuUsage: performanceMetrics.cpuUsage,
        isOptimal: performanceMonitor.isPerformanceAcceptable()
      },
      lastCheck: new Date()
    };
  }

  async updateConfiguration(config: Partial<SystemConfiguration>): Promise<void> {
    console.log('Updating system configuration...');
    
    const oldConfig = { ...this.configuration };
    this.configuration = { ...this.configuration, ...config };
    
    try {
      // Apply configuration changes to components
      await this.applyConfigurationChanges(oldConfig, this.configuration);
      
      avatarEventBus.emit('avatar:system:config-updated', {
        oldConfig,
        newConfig: this.configuration,
        timestamp: new Date()
      });
      
      console.log('System configuration updated successfully');
    } catch (error) {
      console.error('Failed to update configuration:', error);
      // Rollback configuration
      this.configuration = oldConfig;
      throw error;
    }
  }

  getConfiguration(): SystemConfiguration {
    return { ...this.configuration };
  }

  async recoverComponent(componentName: string): Promise<boolean> {
    const component = this.components.get(componentName);
    if (!component) {
      console.error(`Component ${componentName} not found`);
      return false;
    }

    if (component.status === 'recovering') {
      console.log(`Component ${componentName} is already recovering`);
      return false;
    }

    console.log(`Attempting to recover component ${componentName}...`);
    component.status = 'recovering';
    component.recoveryAttempts++;

    try {
      const recovered = await component.recover();
      if (recovered) {
        component.status = 'online';
        component.lastHealthCheck = new Date();
        console.log(`Component ${componentName} recovered successfully`);
        
        avatarEventBus.emit('avatar:system:component-recovered', {
          componentName,
          recoveryAttempts: component.recoveryAttempts,
          timestamp: new Date()
        });
        
        return true;
      } else {
        component.status = 'error';
        console.error(`Failed to recover component ${componentName}`);
        return false;
      }
    } catch (error) {
      component.status = 'error';
      console.error(`Error during recovery of component ${componentName}:`, error);
      return false;
    }
  }

  async enableMaintenanceMode(): Promise<void> {
    console.log('Enabling maintenance mode...');
    this.maintenanceMode = true;
    
    // Pause non-essential operations
    for (const [name, component] of this.components.entries()) {
      if (!component.isEssential && component.instance && typeof component.instance.pauseOperations === 'function') {
        try {
          await component.instance.pauseOperations();
        } catch (error) {
          console.warn(`Failed to pause operations for ${name}:`, error);
        }
      }
    }
    
    avatarEventBus.emit('avatar:system:maintenance-enabled', {
      timestamp: new Date()
    });
    
    console.log('Maintenance mode enabled');
  }

  async disableMaintenanceMode(): Promise<void> {
    console.log('Disabling maintenance mode...');
    
    // Resume non-essential operations
    for (const [name, component] of this.components.entries()) {
      if (!component.isEssential && component.instance && typeof component.instance.resumeOperations === 'function') {
        try {
          await component.instance.resumeOperations();
        } catch (error) {
          console.warn(`Failed to resume operations for ${name}:`, error);
        }
      }
    }
    
    this.maintenanceMode = false;
    
    avatarEventBus.emit('avatar:system:maintenance-disabled', {
      timestamp: new Date()
    });
    
    console.log('Maintenance mode disabled');
  }

  isMaintenanceMode(): boolean {
    return this.maintenanceMode;
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.initialized || this.maintenanceMode) {
        return;
      }

      await this.performHealthChecks();
    }, this.configuration.monitoring.healthCheckInterval);

    console.log(`Health monitoring started with ${this.configuration.monitoring.healthCheckInterval}ms interval`);
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises: Promise<void>[] = [];

    for (const [name, component] of this.components.entries()) {
      healthPromises.push(this.checkComponentHealth(name, component));
    }

    await Promise.allSettled(healthPromises);

    // Check overall system performance
    const performanceMetrics = performanceMonitor.getCurrentMetrics();
    const thresholds = this.configuration.monitoring.alertThresholds;

    if (performanceMetrics.currentFPS < thresholds.fps) {
      avatarEventBus.emitPerformanceWarning('fps', performanceMetrics.currentFPS, thresholds.fps);
      
      if (this.configuration.performance.enableAutoOptimization) {
        await this.optimizePerformance();
      }
    }

    if (performanceMetrics.gpuMemoryUsage > thresholds.memory) {
      avatarEventBus.emitPerformanceWarning('memory', performanceMetrics.gpuMemoryUsage, thresholds.memory);
      
      if (this.configuration.performance.enableAutoOptimization) {
        await this.optimizeMemoryUsage();
      }
    }

    if (performanceMetrics.cpuUsage > thresholds.cpu) {
      avatarEventBus.emitPerformanceWarning('cpu', performanceMetrics.cpuUsage, thresholds.cpu);
    }
  }

  private async checkComponentHealth(name: string, component: ComponentInstance): Promise<void> {
    try {
      const isHealthy = await component.healthCheck();
      const previousStatus = component.status;
      
      component.lastHealthCheck = new Date();
      
      if (isHealthy && component.status !== 'online') {
        component.status = 'online';
        component.recoveryAttempts = 0;
        
        if (previousStatus === 'error' || previousStatus === 'offline') {
          console.log(`Component ${name} recovered automatically`);
          avatarEventBus.emit('avatar:system:component-recovered', {
            componentName: name,
            recoveryAttempts: component.recoveryAttempts,
            timestamp: new Date()
          });
        }
      } else if (!isHealthy && component.status === 'online') {
        component.status = 'error';
        console.warn(`Component ${name} health check failed`);
        
        // Attempt automatic recovery for non-essential components
        if (!component.isEssential && component.recoveryAttempts < 3) {
          setTimeout(() => {
            this.recoverComponent(name);
          }, 5000); // Wait 5 seconds before recovery attempt
        }
        
        avatarEventBus.emitSystemError(name, {
          code: 'HEALTH_CHECK_FAILED',
          message: `Component ${name} failed health check`,
          component: name,
          severity: component.isEssential ? 'critical' : 'warning',
          recoverable: true,
          context: { recoveryAttempts: component.recoveryAttempts }
        });
      }
    } catch (error) {
      console.error(`Error during health check for ${name}:`, error);
      component.status = 'error';
      component.lastHealthCheck = new Date();
    }
  }

  private async optimizePerformance(): Promise<void> {
    console.log('Optimizing system performance...');
    
    // Reduce rendering quality
    const renderer = this.components.get('Renderer')?.instance;
    if (renderer && typeof renderer.optimizeForPerformance === 'function') {
      await renderer.optimizeForPerformance(this.configuration.performance.targetFPS);
    }
    
    // Optimize asset management
    const assetManager = this.components.get('AssetManager')?.instance;
    if (assetManager && typeof assetManager.optimizeMemoryUsage === 'function') {
      await assetManager.optimizeMemoryUsage();
    }
  }

  private async optimizeMemoryUsage(): Promise<void> {
    console.log('Optimizing memory usage...');
    
    // Unload unused assets
    const assetManager = this.components.get('AssetManager')?.instance;
    if (assetManager && typeof assetManager.unloadUnusedAssets === 'function') {
      await assetManager.unloadUnusedAssets();
    }
    
    // Reduce texture quality
    const renderer = this.components.get('Renderer')?.instance;
    if (renderer && typeof renderer.reduceTextureQuality === 'function') {
      await renderer.reduceTextureQuality();
    }
  }

  private async applyConfigurationChanges(oldConfig: SystemConfiguration, newConfig: SystemConfiguration): Promise<void> {
    // Apply performance configuration changes
    if (oldConfig.performance.targetFPS !== newConfig.performance.targetFPS) {
      const renderer = this.components.get('Renderer')?.instance;
      if (renderer && typeof renderer.setTargetFPS === 'function') {
        await renderer.setTargetFPS(newConfig.performance.targetFPS);
      }
    }

    // Apply monitoring configuration changes
    if (oldConfig.monitoring.healthCheckInterval !== newConfig.monitoring.healthCheckInterval) {
      this.startHealthMonitoring(); // Restart with new interval
    }

    // Apply rendering configuration changes
    if (JSON.stringify(oldConfig.rendering) !== JSON.stringify(newConfig.rendering)) {
      const renderer = this.components.get('Renderer')?.instance;
      if (renderer && typeof renderer.updateConfiguration === 'function') {
        await renderer.updateConfiguration(newConfig.rendering);
      }
    }

    // Apply storage configuration changes
    if (JSON.stringify(oldConfig.storage) !== JSON.stringify(newConfig.storage)) {
      const dataStore = this.components.get('DataStore')?.instance;
      if (dataStore && typeof dataStore.updateConfiguration === 'function') {
        await dataStore.updateConfiguration(newConfig.storage);
      }
    }
  }

  private async handleInitializationFailure(error: any): Promise<void> {
    console.error('Avatar System initialization failed:', error);
    
    // Attempt to cleanup any partially initialized components
    for (const [name, component] of this.components.entries()) {
      if (component.instance && typeof component.instance.shutdown === 'function') {
        try {
          await component.instance.shutdown();
        } catch (cleanupError) {
          console.error(`Error cleaning up ${name} during initialization failure:`, cleanupError);
        }
      }
    }
    
    this.components.clear();
    this.initialized = false;
    
    avatarEventBus.emitSystemError('system', {
      code: 'INITIALIZATION_FAILED',
      message: 'Avatar system initialization failed',
      component: 'system',
      severity: 'critical',
      recoverable: false,
      context: { error }
    });
  }

  private registerEventListeners(): void {
    // Listen for performance warnings and take action
    avatarEventBus.onPerformanceWarning((metric, value, threshold) => {
      console.warn(`Performance warning: ${metric} = ${value} (threshold: ${threshold})`);
      
      if (this.configuration.performance.enableAutoOptimization) {
        if (metric === 'fps') {
          this.optimizePerformance();
        } else if (metric === 'memory') {
          this.optimizeMemoryUsage();
        }
      }
    });

    // Listen for safety violations
    avatarEventBus.onSafetyViolation((userId, violation) => {
      console.warn(`Safety violation for user ${userId}:`, violation);
      // Safety violations are handled by the safety validator component
    });

    // Listen for system errors and attempt recovery
    avatarEventBus.onSystemError((component, error) => {
      console.error(`System error in ${component}:`, error);
      
      // Attempt automatic recovery for recoverable errors
      if (error.recoverable && error.severity !== 'critical') {
        setTimeout(() => {
          this.recoverComponent(component);
        }, 10000); // Wait 10 seconds before recovery attempt
      }
    });

    // Listen for system recovery
    avatarEventBus.onSystemRecovery((component, recoveryAction) => {
      console.log(`System recovery in ${component}: ${recoveryAction}`);
    });

    // Listen for component-specific events
    avatarEventBus.on('avatar:component:restart-requested', async (data: { componentName: string }) => {
      console.log(`Restart requested for component: ${data.componentName}`);
      await this.recoverComponent(data.componentName);
    });

    avatarEventBus.on('avatar:system:maintenance-requested', async () => {
      console.log('Maintenance mode requested');
      await this.enableMaintenanceMode();
    });
  }
}

// Export singleton instance
export const avatarSystem = new AvatarSystemImpl();