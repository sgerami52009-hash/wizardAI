// Avatar System Deployment Integration Tests
// Tests deployment scenarios, hardware validation, and platform-specific functionality

import { avatarDeploymentManager, DeploymentConfiguration, HardwareCompatibility } from './deployment';
import { avatarSystem } from './system';
import { systemMonitor } from './system-monitor';
import { avatarEventBus } from './events';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Avatar Deployment Integration Tests', () => {
  let testDeploymentDir: string;
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let logMessages: string[] = [];
  let warnMessages: string[] = [];

  beforeAll(async () => {
    // Set up test deployment environment
    testDeploymentDir = path.join(__dirname, '../test-data/deployment');
    await fs.mkdir(testDeploymentDir, { recursive: true });

    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    
    console.log = (...args: any[]) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };
    
    console.warn = (...args: any[]) => {
      warnMessages.push(args.join(' '));
      originalConsoleWarn(...args);
    };
  });

  afterAll(async () => {
    // Restore console
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;

    // Cleanup test deployment
    try {
      await fs.rm(testDeploymentDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    logMessages = [];
    warnMessages = [];
    avatarEventBus.removeAllListeners();
  });

  afterEach(async () => {
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

  describe('Jetson Nano Orin Deployment', () => {
    test('should validate Jetson Nano Orin hardware compatibility', async () => {
      // Test Requirements: 6.1, 6.3
      const compatibility = await avatarDeploymentManager.validateHardwareCompatibility();
      
      expect(compatibility).toBeDefined();
      expect(compatibility.isCompatible).toBe(true);
      expect(compatibility.warnings).toBeInstanceOf(Array);
      expect(compatibility.optimizations).toBeInstanceOf(Array);
      expect(compatibility.limitations).toBeInstanceOf(Array);

      // Should include Jetson-specific optimizations
      const hasJetsonOptimizations = compatibility.optimizations.some(opt => 
        opt.includes('CUDA') || opt.includes('hardware-accelerated') || opt.includes('NVENC')
      );
      expect(hasJetsonOptimizations).toBe(true);
    });

    test('should configure system for Jetson Nano Orin constraints', async () => {
      // Test Requirements: 6.1, 6.2, 6.3
      await avatarDeploymentManager.initialize();
      
      const deploymentConfig = avatarDeploymentManager.getDeploymentConfiguration();
      
      // Should respect Jetson Nano Orin hardware limits
      expect(deploymentConfig.hardware.platform).toBe('jetson-nano-orin');
      expect(deploymentConfig.hardware.gpuMemoryLimit).toBeLessThanOrEqual(2048); // 2GB GPU memory
      expect(deploymentConfig.hardware.cpuCores).toBeLessThanOrEqual(6); // 6 CPU cores
      expect(deploymentConfig.hardware.enableHardwareAcceleration).toBe(true);
    });

    test('should generate Jetson-optimized initialization script', async () => {
      // Test Requirements: 6.1, 6.5
      const initScript = await avatarDeploymentManager.generateInitializationScript();
      
      expect(initScript).toContain('#!/bin/bash');
      expect(initScript).toContain('nv_tegra_release'); // Jetson detection
      expect(initScript).toContain('nvpmodel'); // Performance mode
      expect(initScript).toContain('jetson_clocks'); // Clock optimization
      expect(initScript).toContain('emc/rate'); // Memory frequency
    });

    test('should handle thermal throttling scenarios', async () => {
      // Test Requirements: 6.1, 6.3, 6.4
      await avatarDeploymentManager.initialize();
      await systemMonitor.startMonitoring(500);
      
      let thermalAlertReceived = false;
      
      // Listen for thermal alerts
      avatarEventBus.on('avatar:system:alert', (alert) => {
        if (alert.message.includes('temperature')) {
          thermalAlertReceived = true;
        }
      });
      
      // Simulate high temperature condition
      // Note: In real implementation, this would come from hardware sensors
      avatarEventBus.emit('avatar:hardware:temperature-warning', {
        temperature: 85,
        threshold: 80,
        timestamp: new Date()
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // System should detect and respond to thermal conditions
      const analytics = systemMonitor.generateSystemAnalytics();
      expect(analytics.optimizationRecommendations).toContain(
        expect.stringMatching(/cooling|thermal|temperature/i)
      );
      
      await systemMonitor.stopMonitoring();
    });
  });

  describe('Resource Constraint Handling', () => {
    test('should adapt to limited GPU memory', async () => {
      // Test Requirements: 6.1, 6.2
      const limitedMemoryConfig: Partial<DeploymentConfiguration> = {
        hardware: {
          platform: 'jetson-nano-orin',
          gpuMemoryLimit: 1024, // Reduced to 1GB
          cpuCores: 6,
          enableHardwareAcceleration: true
        }
      };
      
      await avatarDeploymentManager.updateDeploymentConfiguration(limitedMemoryConfig);
      const compatibility = await avatarDeploymentManager.validateHardwareCompatibility();
      
      // Should suggest memory optimizations
      expect(compatibility.optimizations).toContain(
        expect.stringMatching(/texture|compression|asset/i)
      );
      
      await avatarDeploymentManager.initialize();
      
      // System configuration should reflect memory constraints
      const systemConfig = avatarSystem.getConfiguration();
      expect(systemConfig.rendering.maxTextureResolution).toBeLessThanOrEqual(512);
    });

    test('should handle CPU core limitations', async () => {
      // Test Requirements: 6.1, 6.3
      const limitedCPUConfig: Partial<DeploymentConfiguration> = {
        hardware: {
          platform: 'jetson-nano-orin',
          gpuMemoryLimit: 2048,
          cpuCores: 4, // Reduced CPU cores
          enableHardwareAcceleration: true
        }
      };
      
      await avatarDeploymentManager.updateDeploymentConfiguration(limitedCPUConfig);
      const compatibility = await avatarDeploymentManager.validateHardwareCompatibility();
      
      // Should suggest CPU optimizations
      expect(compatibility.optimizations).toContain(
        expect.stringMatching(/thread|processing|background/i)
      );
    });

    test('should fallback gracefully without hardware acceleration', async () => {
      // Test Requirements: 6.1, 6.3
      const softwareOnlyConfig: Partial<DeploymentConfiguration> = {
        hardware: {
          platform: 'generic',
          gpuMemoryLimit: 512, // Very limited
          cpuCores: 2,
          enableHardwareAcceleration: false
        }
      };
      
      await avatarDeploymentManager.updateDeploymentConfiguration(softwareOnlyConfig);
      const compatibility = await avatarDeploymentManager.validateHardwareCompatibility();
      
      // Should still be compatible but with limitations
      expect(compatibility.isCompatible).toBe(true);
      expect(compatibility.limitations).toContain(
        expect.stringMatching(/performance|rendering/i)
      );
      expect(compatibility.optimizations).toContain(
        expect.stringMatching(/LOD|aggressive/i)
      );
    });
  });

  describe('Service Configuration and Management', () => {
    test('should generate valid systemd service configuration', async () => {
      // Test Requirements: 6.5
      const serviceConfig = await avatarDeploymentManager.createServiceConfiguration();
      
      // Validate systemd service structure
      expect(serviceConfig).toContain('[Unit]');
      expect(serviceConfig).toContain('Description=Kiro Avatar System');
      expect(serviceConfig).toContain('After=network.target');
      
      expect(serviceConfig).toContain('[Service]');
      expect(serviceConfig).toContain('Type=simple');
      expect(serviceConfig).toContain('ExecStart=node avatar/service.js');
      expect(serviceConfig).toContain('Restart=on-failure');
      
      expect(serviceConfig).toContain('[Install]');
      expect(serviceConfig).toContain('WantedBy=multi-user.target');
      
      // Should include resource limits for Jetson
      expect(serviceConfig).toContain('MemoryMax=6G');
      expect(serviceConfig).toContain('CPUQuota=400%');
      
      // Should include security settings
      expect(serviceConfig).toContain('NoNewPrivileges=true');
      expect(serviceConfig).toContain('ProtectSystem=strict');
    });

    test('should handle service restart scenarios', async () => {
      // Test Requirements: 6.4, 6.5
      const deploymentConfig = avatarDeploymentManager.getDeploymentConfiguration();
      
      expect(deploymentConfig.serviceConfig.restartOnFailure).toBe(true);
      expect(deploymentConfig.serviceConfig.maxRestartAttempts).toBeGreaterThan(0);
      expect(deploymentConfig.serviceConfig.healthCheckInterval).toBeGreaterThan(0);
    });

    test('should create proper directory structure', async () => {
      // Test Requirements: 6.5
      await avatarDeploymentManager.initialize();
      
      const config = avatarDeploymentManager.getDeploymentConfiguration();
      
      // Directories should be created during initialization
      expect(logMessages.some(msg => msg.includes('Creating directories'))).toBe(true);
      expect(logMessages.some(msg => msg.includes(config.installation.dataDirectory))).toBe(true);
    });
  });

  describe('Default Package Installation', () => {
    test('should install default character packages', async () => {
      // Test Requirements: 6.5
      await avatarDeploymentManager.initialize();
      
      const config = avatarDeploymentManager.getDeploymentConfiguration();
      
      // Should attempt to install default packages
      expect(config.defaultPackages.length).toBeGreaterThan(0);
      expect(logMessages.some(msg => msg.includes('Installing default character packages'))).toBe(true);
      
      // Should log installation attempts
      for (const packageId of config.defaultPackages) {
        expect(logMessages.some(msg => msg.includes(packageId))).toBe(true);
      }
    });

    test('should handle package installation failures gracefully', async () => {
      // Test Requirements: 6.5
      const configWithInvalidPackages: Partial<DeploymentConfiguration> = {
        defaultPackages: [
          'com.invalid.package-1',
          'com.invalid.package-2'
        ]
      };
      
      await avatarDeploymentManager.updateDeploymentConfiguration(configWithInvalidPackages);
      
      // Should not fail initialization due to package installation failures
      await expect(avatarDeploymentManager.initialize()).resolves.not.toThrow();
      
      // Should log warnings about failed packages
      expect(warnMessages.some(msg => msg.includes('Failed to install package'))).toBe(true);
    });
  });

  describe('Performance Optimization for Target Hardware', () => {
    test('should optimize rendering settings for Jetson Nano Orin', async () => {
      // Test Requirements: 6.1, 6.3
      await avatarDeploymentManager.initialize();
      
      const systemConfig = avatarSystem.getConfiguration();
      
      // Should enable hardware-specific optimizations
      expect(systemConfig.rendering.enableHardwareAcceleration).toBe(true);
      expect(systemConfig.rendering.lodEnabled).toBe(true);
      expect(systemConfig.performance.enableAutoOptimization).toBe(true);
      
      // Should set appropriate performance targets
      expect(systemConfig.performance.targetFPS).toBe(60);
      expect(systemConfig.performance.maxGPUMemory).toBeLessThanOrEqual(2048);
      expect(systemConfig.performance.maxCPUUsage).toBeLessThanOrEqual(50);
    });

    test('should monitor and adapt to performance constraints', async () => {
      // Test Requirements: 6.1, 6.3, 6.4
      await avatarDeploymentManager.initialize();
      await systemMonitor.startMonitoring(200);
      
      // Simulate performance degradation
      avatarEventBus.emitPerformanceWarning('fps', 25, 45);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // System should detect performance issues
      const analytics = systemMonitor.generateSystemAnalytics();
      expect(analytics.healthScore).toBeLessThan(100);
      expect(analytics.optimizationRecommendations.length).toBeGreaterThan(0);
      
      await systemMonitor.stopMonitoring();
    });
  });

  describe('Storage and Backup Configuration', () => {
    test('should configure encrypted storage properly', async () => {
      // Test Requirements: 6.5
      await avatarDeploymentManager.initialize();
      
      const systemConfig = avatarSystem.getConfiguration();
      
      expect(systemConfig.storage.encryptionEnabled).toBe(true);
      expect(systemConfig.storage.backupInterval).toBeGreaterThan(0);
      expect(systemConfig.storage.maxBackups).toBeGreaterThan(0);
    });

    test('should handle storage space constraints', async () => {
      // Test Requirements: 6.5
      await avatarDeploymentManager.initialize();
      await systemMonitor.startMonitoring(200);
      
      // Simulate low storage space
      avatarEventBus.emit('avatar:system:alert', {
        timestamp: new Date(),
        level: 'warning',
        component: 'storage',
        message: 'Low storage space',
        context: { freeSpace: 500 } // 500MB free
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // System should detect storage issues
      const errorHistory = systemMonitor.getErrorHistory(10);
      expect(errorHistory.some(error => error.component === 'storage')).toBe(true);
      
      await systemMonitor.stopMonitoring();
    });
  });

  describe('Security and Safety Configuration', () => {
    test('should enable security features by default', async () => {
      // Test Requirements: 6.5
      await avatarDeploymentManager.initialize();
      
      const systemConfig = avatarSystem.getConfiguration();
      
      expect(systemConfig.safety.enableParentalControls).toBe(true);
      expect(systemConfig.safety.auditLogging).toBe(true);
      expect(systemConfig.safety.defaultAgeRating).toBe('all-ages');
    });

    test('should configure proper file permissions', async () => {
      // Test Requirements: 6.5
      const initScript = await avatarDeploymentManager.generateInitializationScript();
      
      // Should set proper permissions
      expect(initScript).toContain('chmod 755');
      
      // Should create directories with proper permissions
      expect(initScript).toContain('mkdir -p');
    });
  });

  describe('Environment-Specific Configuration', () => {
    test('should adapt configuration for production environment', async () => {
      // Test Requirements: 6.5
      const serviceConfig = await avatarDeploymentManager.createServiceConfiguration();
      
      // Should set production environment
      expect(serviceConfig).toContain('Environment=NODE_ENV=production');
      
      // Should include proper environment variables
      expect(serviceConfig).toContain('Environment=AVATAR_DATA_DIR=');
      expect(serviceConfig).toContain('Environment=AVATAR_CACHE_DIR=');
      expect(serviceConfig).toContain('Environment=AVATAR_LOG_DIR=');
    });

    test('should handle development vs production differences', async () => {
      // Test Requirements: 6.5
      const deploymentConfig = avatarDeploymentManager.getDeploymentConfiguration();
      
      // Should have appropriate settings for production deployment
      expect(deploymentConfig.serviceConfig.autoStart).toBe(true);
      expect(deploymentConfig.serviceConfig.restartOnFailure).toBe(true);
      
      // Should have reasonable health check intervals
      expect(deploymentConfig.serviceConfig.healthCheckInterval).toBeGreaterThanOrEqual(30000);
    });
  });

  describe('Integration with System Monitoring', () => {
    test('should integrate deployment monitoring with system monitoring', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarDeploymentManager.initialize();
      await systemMonitor.startMonitoring(300);
      
      // Wait for monitoring to collect metrics
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const metrics = systemMonitor.getLatestMetrics();
      expect(metrics).toBeDefined();
      
      // Should monitor deployment-specific metrics
      expect(metrics?.hardware).toBeDefined();
      expect(metrics?.storage).toBeDefined();
      expect(metrics?.performance).toBeDefined();
      
      await systemMonitor.stopMonitoring();
    });

    test('should provide deployment health information', async () => {
      // Test Requirements: 6.4, 6.5
      await avatarDeploymentManager.initialize();
      
      const health = avatarSystem.getSystemHealth();
      
      expect(health.status).toMatch(/healthy|degraded/);
      expect(health.components.length).toBeGreaterThan(0);
      expect(health.performance).toBeDefined();
      expect(health.lastCheck).toBeInstanceOf(Date);
    });
  });
});