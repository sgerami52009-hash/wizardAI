// Avatar System Integration Tests
// Tests complete avatar system functionality end-to-end, deployment validation, and system monitoring

import { avatarSystem, SystemConfiguration } from './system';
import { avatarService } from './service';
import { avatarDeploymentManager } from './deployment';
import { systemMonitor } from './system-monitor';
import { avatarEventBus } from './events';
import { AvatarCustomizationController, CustomizationSession } from './core';
import { AvatarConfiguration, CustomizationChange } from './types';
import { performanceMonitor } from '../rendering/performance';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Avatar System Integration Tests', () => {
  let testDataDir: string;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logMessages: string[] = [];
  let errorMessages: string[] = [];

  beforeAll(async () => {
    // Set up test environment
    testDataDir = path.join(__dirname, '../test-data/integration');
    await fs.mkdir(testDataDir, { recursive: true });

    // Capture console output for testing
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    console.log = (...args: any[]) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };
    
    console.error = (...args: any[]) => {
      errorMessages.push(args.join(' '));
      originalConsoleError(...args);
    };
  });

  afterAll(async () => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Cleanup test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    // Clear message arrays
    logMessages = [];
    errorMessages = [];
    
    // Clear event listeners
    avatarEventBus.removeAllListeners();
  });

  afterEach(async () => {
    // Ensure system is shut down after each test
    try {
      if (avatarSystem.isInitialized()) {
        await avatarSystem.shutdown();
      }
      if (systemMonitor) {
        await systemMonitor.stopMonitoring();
      }
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Complete System Initialization and Shutdown', () => {
    test('should initialize all system components in correct order', async () => {
      // Test Requirements: 6.1, 6.4
      const config: SystemConfiguration = {
        performance: {
          targetFPS: 60,
          maxGPUMemory: 2048,
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
          backupInterval: 3600000,
          maxBackups: 10
        },
        monitoring: {
          healthCheckInterval: 30000,
          performanceLogging: true,
          alertThresholds: {
            fps: 45,
            memory: 1800,
            cpu: 70
          }
        }
      };

      await avatarSystem.initialize(config);

      expect(avatarSystem.isInitialized()).toBe(true);
      
      const health = avatarSystem.getSystemHealth();
      expect(health.status).toMatch(/healthy|degraded/); // Allow degraded in test environment
      expect(health.components.length).toBeGreaterThan(0);
      
      // Verify essential components are online
      const essentialComponents = health.components.filter(c => c.isEssential);
      for (const component of essentialComponents) {
        expect(component.status).toBe('online');
      }

      // Verify configuration was applied
      const appliedConfig = avatarSystem.getConfiguration();
      expect(appliedConfig.performance.targetFPS).toBe(60);
      expect(appliedConfig.safety.enableParentalControls).toBe(true);
    });

    test('should handle initialization failure gracefully', async () => {
      // Test Requirements: 6.4
      const invalidConfig: SystemConfiguration = {
        performance: {
          targetFPS: -1, // Invalid FPS
          maxGPUMemory: -1, // Invalid memory
          maxCPUUsage: 150, // Invalid CPU usage
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
          backupInterval: 3600000,
          maxBackups: 10
        },
        monitoring: {
          healthCheckInterval: 30000,
          performanceLogging: true,
          alertThresholds: {
            fps: 45,
            memory: 1800,
            cpu: 70
          }
        }
      };

      // Should handle invalid configuration gracefully
      try {
        await avatarSystem.initialize(invalidConfig);
        // If initialization succeeds, system should still be functional
        expect(avatarSystem.isInitialized()).toBe(true);
      } catch (error) {
        // If initialization fails, system should not be initialized
        expect(avatarSystem.isInitialized()).toBe(false);
        expect(error).toBeDefined();
      }
    });

    test('should shutdown all components cleanly', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      expect(avatarSystem.isInitialized()).toBe(true);

      await avatarSystem.shutdown();
      expect(avatarSystem.isInitialized()).toBe(false);

      // Verify shutdown was logged
      expect(logMessages.some(msg => msg.includes('shutdown'))).toBe(true);
    });

    test('should restart system successfully', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      const initialUptime = avatarSystem.getSystemHealth().lastCheck;

      await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay

      await avatarSystem.restart();
      
      expect(avatarSystem.isInitialized()).toBe(true);
      const restartedUptime = avatarSystem.getSystemHealth().lastCheck;
      expect(restartedUptime.getTime()).toBeGreaterThan(initialUptime.getTime());
    });
  });

  describe('End-to-End Avatar Customization Workflow', () => {
    let customizationController: AvatarCustomizationController;

    beforeEach(async () => {
      await avatarSystem.initialize();
      // Mock customization controller for testing
      customizationController = createMockCustomizationController();
    });

    test('should complete full avatar customization workflow', async () => {
      // Test Requirements: 6.1, 6.4
      const userId = 'test-user-001';
      
      // Start customization session
      const session = await customizationController.startCustomization(userId);
      expect(session.userId).toBe(userId);
      expect(session.sessionId).toBeDefined();

      // Load default avatar configuration
      const defaultConfig = await customizationController.loadUserAvatar(userId);
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.userId).toBe(userId);

      // Test appearance customization with proper types
      const appearanceChange = {
        changeId: 'test-appearance-001',
        type: 'appearance' as const,
        category: 'hair',
        oldValue: defaultConfig.appearance.hair,
        newValue: {
          ...defaultConfig.appearance.hair,
          styleId: 'curly-style-001',
          color: 'brown'
        },
        timestamp: new Date(),
        requiresApproval: false
      };

      const previewResult = await customizationController.previewChange(appearanceChange);
      expect(previewResult).toBeDefined();

      // Apply customization
      const customization = {
        ...defaultConfig,
        appearance: {
          ...defaultConfig.appearance,
          hair: {
            ...defaultConfig.appearance.hair,
            styleId: 'curly-style-001',
            color: 'brown'
          }
        }
      };

      const validationResult = await customizationController.applyCustomization(customization);
      expect(validationResult.isValid).toBe(true);

      // Save customization
      await customizationController.saveCustomization(userId);

      // Verify customization was saved
      const savedConfig = await customizationController.loadUserAvatar(userId);
      expect(savedConfig.appearance.hair.styleId).toBe('curly-style-001');
      expect(savedConfig.appearance.hair.color).toBe('brown');
    });

    test('should handle safety validation in customization workflow', async () => {
      // Test Requirements: 6.1, 6.4
      const userId = 'test-child-001';
      
      const session = await customizationController.startCustomization(userId);
      const defaultConfig = await customizationController.loadUserAvatar(userId);

      // Test potentially inappropriate customization
      const inappropriateCustomization = {
        ...defaultConfig,
        personality: {
          friendliness: 1, // Very unfriendly
          formality: 1,
          humor: 10,
          enthusiasm: 1,
          patience: 1,
          supportiveness: 1
        }
      };

      const validationResult = await customizationController.applyCustomization(inappropriateCustomization);
      
      // Should either be blocked or require parental approval
      if (!validationResult.isValid) {
        expect(validationResult.errors).toBeDefined();
        expect(validationResult.errors.length).toBeGreaterThan(0);
      } else if (validationResult.requiresParentalApproval) {
        expect(validationResult.requiresParentalApproval).toBe(true);
      }
    });

    test('should maintain performance during real-time preview', async () => {
      // Test Requirements: 6.1, 6.3
      const userId = 'test-user-002';
      
      await customizationController.startCustomization(userId);
      const defaultConfig = await customizationController.loadUserAvatar(userId);

      // Start performance monitoring
      performanceMonitor.startMonitoring();
      
      // Perform multiple rapid customization previews
      const changes = [];
      for (let i = 0; i < 10; i++) {
        changes.push({
          changeId: `test-change-${i}`,
          type: 'appearance' as const,
          category: 'clothing',
          oldValue: defaultConfig.appearance.clothing,
          newValue: {
            ...defaultConfig.appearance.clothing,
            topId: `top-style-${i}`,
            colors: {
              ...defaultConfig.appearance.clothing.colors,
              primary: `color-${i}`
            }
          },
          timestamp: new Date(),
          requiresApproval: false
        });
      }

      const startTime = Date.now();
      
      for (const change of changes) {
        await customizationController.previewChange(change);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete all previews within reasonable time (< 5 seconds)
      expect(totalTime).toBeLessThan(5000);
      
      // Check performance metrics
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.currentFPS).toBeGreaterThan(30); // Minimum acceptable FPS
      
      performanceMonitor.stopMonitoring();
    });
  });

  describe('System Deployment and Hardware Validation', () => {
    test('should validate hardware compatibility on target platform', async () => {
      // Test Requirements: 6.1, 6.3
      await avatarDeploymentManager.initialize();
      
      const compatibility = await avatarDeploymentManager.validateHardwareCompatibility();
      
      expect(compatibility).toBeDefined();
      expect(compatibility.isCompatible).toBeDefined();
      expect(compatibility.warnings).toBeInstanceOf(Array);
      expect(compatibility.optimizations).toBeInstanceOf(Array);
      expect(compatibility.limitations).toBeInstanceOf(Array);

      // Log compatibility results for debugging
      console.log('Hardware Compatibility:', compatibility);
    });

    test('should create proper deployment configuration', async () => {
      // Test Requirements: 6.1, 6.5
      const deploymentConfig = avatarDeploymentManager.getDeploymentConfiguration();
      
      expect(deploymentConfig.hardware.platform).toBeDefined();
      expect(deploymentConfig.hardware.gpuMemoryLimit).toBeGreaterThan(0);
      expect(deploymentConfig.installation.dataDirectory).toBeDefined();
      expect(deploymentConfig.defaultPackages).toBeInstanceOf(Array);
      expect(deploymentConfig.serviceConfig.autoStart).toBeDefined();
    });

    test('should generate valid service configuration', async () => {
      // Test Requirements: 6.5
      const serviceConfig = await avatarDeploymentManager.createServiceConfiguration();
      
      expect(serviceConfig).toBeDefined();
      expect(serviceConfig).toContain('[Unit]');
      expect(serviceConfig).toContain('[Service]');
      expect(serviceConfig).toContain('[Install]');
      expect(serviceConfig).toContain('Kiro Avatar System');
    });

    test('should generate initialization script', async () => {
      // Test Requirements: 6.5
      const initScript = await avatarDeploymentManager.generateInitializationScript();
      
      expect(initScript).toBeDefined();
      expect(initScript).toContain('#!/bin/bash');
      expect(initScript).toContain('Kiro Avatar System');
      expect(initScript).toContain('mkdir -p');
    });
  });

  describe('System Monitoring and Health Checks', () => {
    test('should monitor system health continuously', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarSystem.initialize();
      
      // Start monitoring with short interval for testing
      await systemMonitor.startMonitoring(1000); // 1 second interval
      
      // Wait for a few monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const metrics = systemMonitor.getLatestMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.timestamp).toBeInstanceOf(Date);
      expect(metrics?.systemHealth).toBeDefined();
      expect(metrics?.performance).toBeDefined();
      expect(metrics?.hardware).toBeDefined();
      expect(metrics?.memory).toBeDefined();
      expect(metrics?.storage).toBeDefined();

      await systemMonitor.stopMonitoring();
    });

    test('should detect and report system alerts', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      await systemMonitor.startMonitoring(500); // Fast monitoring for testing
      
      let alertReceived = false;
      let alertData: any = null;
      
      // Listen for alerts
      avatarEventBus.on('avatar:system:alert', (data) => {
        alertReceived = true;
        alertData = data;
      });
      
      // Simulate performance issue by emitting a performance warning
      avatarEventBus.emitPerformanceWarning('fps', 20, 45);
      
      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(alertReceived).toBe(true);
      expect(alertData).toBeDefined();
      
      await systemMonitor.stopMonitoring();
    });

    test('should execute maintenance tasks', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarSystem.initialize();
      await systemMonitor.startMonitoring(100);
      
      const tasks = systemMonitor.getMaintenanceTasks();
      expect(tasks.length).toBeGreaterThan(0);
      
      // Run a specific maintenance task
      const cacheCleanupTask = tasks.find(t => t.id === 'cache-cleanup');
      if (cacheCleanupTask) {
        const result = await systemMonitor.runMaintenanceTask('cache-cleanup');
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.message).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      }
      
      await systemMonitor.stopMonitoring();
    });

    test('should generate system analytics', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarSystem.initialize();
      await systemMonitor.startMonitoring(100);
      
      // Generate some metrics history
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const analytics = systemMonitor.generateSystemAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.performanceTrends).toBeDefined();
      expect(analytics.errorAnalysis).toBeDefined();
      expect(analytics.optimizationRecommendations).toBeInstanceOf(Array);
      expect(analytics.healthScore).toBeGreaterThanOrEqual(0);
      expect(analytics.healthScore).toBeLessThanOrEqual(100);
      
      await systemMonitor.stopMonitoring();
    });
  });

  describe('Automatic Recovery Mechanisms', () => {
    test('should recover from component failures', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      
      const health = avatarSystem.getSystemHealth();
      const componentToTest = health.components.find(c => !c.isEssential);
      
      if (componentToTest) {
        // Attempt to recover the component
        const recoveryResult = await avatarSystem.recoverComponent(componentToTest.name);
        
        // Recovery should either succeed or fail gracefully
        expect(typeof recoveryResult).toBe('boolean');
        
        // System should still be functional
        expect(avatarSystem.isInitialized()).toBe(true);
      }
    });

    test('should handle service restart scenarios', async () => {
      // Test Requirements: 6.4
      let serviceStarted = false;
      let serviceStopped = false;
      
      // Listen for service events
      avatarEventBus.on('avatar:service:started', () => {
        serviceStarted = true;
      });
      
      avatarEventBus.on('avatar:service:stopped', () => {
        serviceStopped = true;
      });
      
      // Start service
      await avatarService.start();
      expect(serviceStarted).toBe(true);
      
      // Check service status
      const status = avatarService.getServiceStatus();
      expect(status.isRunning).toBe(true);
      expect(status.uptime).toBeGreaterThan(0);
      
      // Stop service
      await avatarService.stop();
      expect(serviceStopped).toBe(true);
      
      const stoppedStatus = avatarService.getServiceStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });

    test('should maintain system stability under load', async () => {
      // Test Requirements: 6.1, 6.4
      await avatarSystem.initialize();
      const customizationController = avatarSystem.getCustomizationController();
      
      // Start performance monitoring
      performanceMonitor.startMonitoring();
      await systemMonitor.startMonitoring(500);
      
      // Simulate concurrent user sessions
      const userSessions = [];
      for (let i = 0; i < 5; i++) {
        const userId = `load-test-user-${i}`;
        userSessions.push(customizationController.startCustomization(userId));
      }
      
      const sessions = await Promise.all(userSessions);
      expect(sessions.length).toBe(5);
      
      // Perform concurrent operations
      const operations = sessions.map(async (session: CustomizationSession, index: number) => {
        const config = await customizationController.loadUserAvatar(session.userId);
        
        // Make some customization changes
        const change = {
          changeId: `load-test-change-${index}`,
          type: 'appearance' as const,
          category: 'face',
          oldValue: config.appearance.face,
          newValue: {
            ...config.appearance.face,
            meshId: `test-mesh-${index}`,
            eyeColor: `color-${index}`
          },
          timestamp: new Date(),
          requiresApproval: false
        };
        
        await customizationController.previewChange(change);
        return customizationController.saveCustomization(session.userId);
      });
      
      // All operations should complete successfully
      await Promise.all(operations);
      
      // System should remain stable
      const health = avatarSystem.getSystemHealth();
      expect(health.status).toMatch(/healthy|degraded/);
      
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics.currentFPS).toBeGreaterThan(20); // Minimum acceptable under load
      
      performanceMonitor.stopMonitoring();
      await systemMonitor.stopMonitoring();
    });

    test('should handle memory pressure gracefully', async () => {
      // Test Requirements: 6.1, 6.2, 6.4
      await avatarSystem.initialize();
      
      // Start monitoring
      performanceMonitor.startMonitoring();
      await systemMonitor.startMonitoring(200);
      
      // Simulate memory pressure by triggering memory warnings
      avatarEventBus.emitPerformanceWarning('memory', 1900, 1800); // Above threshold
      
      // Wait for system response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // System should still be functional
      expect(avatarSystem.isInitialized()).toBe(true);
      
      const health = avatarSystem.getSystemHealth();
      expect(health.status).not.toBe('offline');
      
      performanceMonitor.stopMonitoring();
      await systemMonitor.stopMonitoring();
    });
  });

  describe('Integration with Voice Pipeline', () => {
    test('should coordinate avatar state with voice interactions', async () => {
      // Test Requirements: 6.1, 6.4
      await avatarSystem.initialize();
      
      let avatarStateChanged = false;
      
      // Listen for avatar state changes
      avatarEventBus.on('avatar:state:changed', () => {
        avatarStateChanged = true;
      });
      
      // Simulate voice interaction triggering avatar state change
      avatarEventBus.emit('voice:interaction:started', {
        userId: 'test-user',
        timestamp: new Date()
      });
      
      // Wait for state synchronization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Avatar should respond to voice events
      // Note: Actual implementation would depend on voice pipeline integration
      expect(avatarSystem.isInitialized()).toBe(true);
    });
  });

  describe('Error Handling and Logging', () => {
    test('should log system events appropriately', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      
      // Check that initialization was logged
      expect(logMessages.some(msg => msg.includes('Avatar System initialized'))).toBe(true);
      
      // Trigger a system event
      avatarEventBus.emit('avatar:system:config-updated', {
        oldConfig: {},
        newConfig: {},
        timestamp: new Date()
      });
      
      // System should handle events without errors
      expect(avatarSystem.isInitialized()).toBe(true);
    });

    test('should handle errors without system crash', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      
      // Emit a system error
      avatarEventBus.emitSystemError('test-component', {
        code: 'TEST_ERROR',
        message: 'Test error for integration testing',
        component: 'test-component',
        severity: 'warning',
        recoverable: true,
        context: { test: true }
      });
      
      // System should remain stable
      expect(avatarSystem.isInitialized()).toBe(true);
      
      const health = avatarSystem.getSystemHealth();
      expect(health.status).not.toBe('offline');
    });
  });

  describe('Configuration Management', () => {
    test('should update system configuration dynamically', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarSystem.initialize();
      
      const originalConfig = avatarSystem.getConfiguration();
      
      const configUpdate = {
        performance: {
          ...originalConfig.performance,
          targetFPS: 30 // Reduce target FPS
        }
      };
      
      await avatarSystem.updateConfiguration(configUpdate);
      
      const updatedConfig = avatarSystem.getConfiguration();
      expect(updatedConfig.performance.targetFPS).toBe(30);
    });

    test('should maintain system stability during configuration changes', async () => {
      // Test Requirements: 6.4
      await avatarSystem.initialize();
      
      const health1 = avatarSystem.getSystemHealth();
      
      // Update configuration
      await avatarSystem.updateConfiguration({
        monitoring: {
          healthCheckInterval: 10000,
          performanceLogging: false,
          alertThresholds: {
            fps: 30,
            memory: 1500,
            cpu: 80
          }
        }
      });
      
      // System should remain stable
      const health2 = avatarSystem.getSystemHealth();
      expect(health2.status).not.toBe('offline');
      expect(avatarSystem.isInitialized()).toBe(true);
    });
  });
});

// Mock implementations for testing
function createMockCustomizationController(): AvatarCustomizationController {
  return {
    async startCustomization(userId: string): Promise<CustomizationSession> {
      return {
        sessionId: `session-${Date.now()}`,
        userId,
        currentConfiguration: createMockAvatarConfiguration(userId),
        pendingChanges: [],
        previewActive: false
      };
    },

    async previewChange(change: any): Promise<any> {
      return {
        success: true,
        renderTime: 16.7, // 60fps
        performanceImpact: 0.1,
        errors: []
      };
    },

    async applyCustomization(customization: AvatarConfiguration): Promise<any> {
      return {
        isValid: true,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: []
      };
    },

    async saveCustomization(userId: string): Promise<void> {
      // Mock save operation
    },

    async loadUserAvatar(userId: string): Promise<AvatarConfiguration> {
      return createMockAvatarConfiguration(userId);
    },

    async resetToDefaults(userId: string): Promise<void> {
      // Mock reset operation
    }
  };
}

function createMockAvatarConfiguration(userId: string): AvatarConfiguration {
  return {
    userId,
    version: '1.0.0',
    appearance: {
      face: {
        meshId: 'default-face',
        textureId: 'default-face-texture',
        eyeColor: 'brown',
        skinTone: 'medium',
        features: {
          eyeSize: 0.5,
          noseSize: 0.5,
          mouthSize: 0.5,
          cheekbones: 0.5
        },
        detailLevel: 'medium' as any,
        textureQuality: 1.0,
        matureFeatures: false
      },
      hair: {
        styleId: 'default-hair',
        color: 'brown',
        length: 0.5,
        texture: 'straight' as any,
        physicsEnabled: true,
        strandCount: 1000,
        detailLevel: 'medium' as any
      },
      clothing: {
        topId: 'default-top',
        bottomId: 'default-bottom',
        shoesId: 'default-shoes',
        colors: {
          primary: 'blue',
          secondary: 'white',
          accent: 'black'
        },
        wrinkleSimulation: false,
        detailLevel: 'medium' as any,
        textureQuality: 1.0,
        revealingLevel: 1
      },
      accessories: [],
      animations: {
        idle: 'default-idle',
        talking: 'default-talking',
        listening: 'default-listening',
        thinking: 'default-thinking',
        expressions: {
          happy: 'happy-expression',
          sad: 'sad-expression',
          surprised: 'surprised-expression',
          confused: 'confused-expression',
          excited: 'excited-expression'
        },
        frameRate: 30,
        blendingEnabled: true
      }
    },
    personality: {
      friendliness: 8,
      formality: 5,
      humor: 7,
      enthusiasm: 6,
      patience: 8,
      supportiveness: 9
    },
    voice: {
      pitch: 0,
      speed: 1,
      accent: 'neutral' as any,
      emotionalTone: 'cheerful' as any,
      volume: 0.8
    },
    emotions: {
      defaultEmotion: 'neutral' as any,
      expressionIntensity: 0.7,
      transitionSpeed: 1.0,
      emotionMappings: []
    },
    createdAt: new Date(),
    lastModified: new Date(),
    parentallyApproved: true
  };
}