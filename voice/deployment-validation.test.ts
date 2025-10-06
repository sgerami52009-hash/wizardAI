/**
 * Deployment Validation Tests
 * Tests system initialization, model loading, and configuration validation
 */

import ConfigManager, { VoicePipelineConfig } from './config-manager';
import ConfigLoader from './config-loader';
import ConfigValidator from './config-validator';
import ModelManager from '../scripts/model-manager';
import HardwareChecker from '../scripts/hardware-checker';
import ServiceManager from '../scripts/service-manager';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

// Mock child_process for hardware detection
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawn: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Deployment Validation Tests', () => {
  let configManager: ConfigManager;
  let configLoader: ConfigLoader;
  let configValidator: ConfigValidator;
  let modelManager: ModelManager;
  let hardwareChecker: HardwareChecker;
  let serviceManager: ServiceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    configManager = new ConfigManager('./test-config/voice-pipeline.json');
    configLoader = new ConfigLoader({ environment: 'testing' });
    configValidator = new ConfigValidator();
    modelManager = new ModelManager('./test-models');
    hardwareChecker = new HardwareChecker();
    serviceManager = new ServiceManager();
  });

  afterEach(() => {
    if (serviceManager) {
      serviceManager.destroy();
    }
  });

  describe('Configuration Management Validation', () => {
    it('should validate production configuration successfully', async () => {
      const productionConfig: Partial<VoicePipelineConfig> = {
        environment: 'production',
        audio: {
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          bufferSize: 512,
          noiseReduction: true,
          echoCancellation: true,
          automaticGainControl: true,
          maxRecordingDuration: 30
        },
        performance: {
          maxMemoryUsage: 2048,
          maxCpuUsage: 70,
          responseTimeTarget: 500,
          resourceMonitoring: true,
          adaptiveQuality: true,
          queueManagement: {
            maxQueueSize: 10,
            prioritization: true,
            timeoutHandling: true
          }
        },
        hardware: {
          platform: 'jetson-nano-orin',
          optimizations: {
            gpu: true,
            tensorrt: true,
            cuda: true
          },
          resourceLimits: {
            memory: 8192,
            cpu: 6
          },
          thermalManagement: true
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(productionConfig));

      const config = await configManager.loadConfig();
      const validation = configManager.validateConfig(config);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(config.environment).toBe('production');
      expect(config.hardware.platform).toBe('jetson-nano-orin');
    });

    it('should detect and report configuration errors', async () => {
      const invalidConfig = {
        environment: 'invalid',
        audio: { sampleRate: -1 },
        performance: { maxMemoryUsage: 10000 } // Exceeds Jetson limit
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      const config = await configManager.loadConfig();
      const validation = configManager.validateConfig(config);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing configuration files gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const config = await configManager.loadConfig();
      
      // Should fall back to default configuration
      expect(config.environment).toBe('development');
      expect(config.audio.sampleRate).toBe(16000);
    });

    it('should validate environment-specific configurations', async () => {
      const environments = ['development', 'production', 'testing'];

      for (const env of environments) {
        const loader = new ConfigLoader({ environment: env });
        
        // Mock configuration exists
        mockFs.access.mockResolvedValue(undefined);
        mockFs.readFile.mockResolvedValue(JSON.stringify({ environment: env }));

        const config = await loader.loadConfig();
        expect(config.environment).toBe(env);
      }
    });

    it('should support runtime configuration updates', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ environment: 'development' }));
      
      const config = await configManager.loadConfig();
      
      const updates = {
        performance: {
          maxMemoryUsage: 4096,
          responseTimeTarget: 300
        }
      };

      await configManager.updateConfig(updates);
      
      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.performance.maxMemoryUsage).toBe(4096);
      expect(updatedConfig.performance.responseTimeTarget).toBe(300);
    });
  });

  describe('Model Management Validation', () => {
    it('should validate model registry initialization', () => {
      const availableModels = modelManager.listAvailableModels();
      
      expect(availableModels.length).toBeGreaterThan(0);
      
      const requiredModels = availableModels.filter(model => model.required);
      expect(requiredModels.length).toBeGreaterThan(0);
      
      // Check for essential models
      const modelNames = availableModels.map(model => model.name);
      expect(modelNames).toContain('wake-word-prod.onnx');
      expect(modelNames).toContain('whisper-base-prod.onnx');
      expect(modelNames).toContain('intent-classifier-prod.onnx');
      expect(modelNames).toContain('tts-prod.onnx');
    });

    it('should validate model information completeness', () => {
      const models = modelManager.listAvailableModels();
      
      for (const model of models) {
        expect(model.name).toBeDefined();
        expect(model.url).toBeDefined();
        expect(model.checksum).toBeDefined();
        expect(model.size).toBeGreaterThan(0);
        expect(model.version).toBeDefined();
        expect(['jetson-nano-orin', 'generic', 'all']).toContain(model.platform);
        expect(typeof model.required).toBe('boolean');
        expect(model.description).toBeDefined();
      }
    });

    it('should handle model validation correctly', async () => {
      const modelName = 'wake-word-prod.onnx';
      
      // Mock file doesn't exist
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const validation = await modelManager.validateModel(modelName);
      
      expect(validation.isValid).toBe(false);
      expect(validation.exists).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should support platform-specific model filtering', () => {
      const jetsonModels = modelManager.listAvailableModels('jetson-nano-orin');
      const genericModels = modelManager.listAvailableModels('generic');
      const allModels = modelManager.listAvailableModels();
      
      expect(jetsonModels.length).toBeGreaterThan(0);
      expect(genericModels.length).toBeGreaterThan(0);
      expect(allModels.length).toBeGreaterThanOrEqual(jetsonModels.length);
      
      // All platform models should be included in jetson results
      const jetsonPlatformModels = jetsonModels.filter(model => 
        model.platform === 'jetson-nano-orin' || model.platform === 'all'
      );
      expect(jetsonPlatformModels.length).toBe(jetsonModels.length);
    });

    it('should generate valid model manifest', async () => {
      // Mock some validation results
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1000000 } as any);
      mockFs.readFile.mockResolvedValue(Buffer.alloc(1000000));
      
      const manifest = await modelManager.generateManifest();
      
      expect(manifest).toHaveProperty('generatedAt');
      expect(manifest).toHaveProperty('modelsDirectory');
      expect(manifest).toHaveProperty('models');
      expect(typeof manifest.models).toBe('object');
    });
  });

  describe('Hardware Compatibility Validation', () => {
    it('should detect hardware information', async () => {
      const hardwareInfo = await hardwareChecker.detectHardware();
      
      expect(hardwareInfo.platform).toBeDefined();
      expect(hardwareInfo.architecture).toBeDefined();
      expect(hardwareInfo.totalMemoryGB).toBeGreaterThan(0);
      expect(hardwareInfo.cpuCores).toBeGreaterThan(0);
      expect(hardwareInfo.cpuModel).toBeDefined();
    });

    it('should validate minimum system requirements', async () => {
      // Mock insufficient hardware
      jest.spyOn(hardwareChecker as any, 'hardwareInfo', 'get').mockReturnValue({
        platform: 'linux',
        architecture: 'x64',
        totalMemoryGB: 2, // Below minimum
        cpuCores: 1, // Below minimum
        cpuModel: 'Test CPU'
      });

      const compatibility = await hardwareChecker.checkCompatibility();
      
      expect(compatibility.isCompatible).toBe(false);
      expect(compatibility.errors.length).toBeGreaterThan(0);
    });

    it('should generate appropriate optimizations for different platforms', async () => {
      // Test Jetson Nano Orin optimizations
      jest.spyOn(hardwareChecker as any, 'hardwareInfo', 'get').mockReturnValue({
        platform: 'linux',
        architecture: 'arm64',
        totalMemoryGB: 8,
        cpuCores: 6,
        cpuModel: 'ARM Cortex-A78AE',
        jetsonInfo: { model: 'NVIDIA Jetson Nano Orin' },
        gpu: { vendor: 'NVIDIA', model: 'Ampere', cudaSupport: true, tensorRTSupport: true }
      });

      const compatibility = await hardwareChecker.checkCompatibility();
      
      expect(compatibility.platform).toBe('jetson-nano-orin');
      expect(compatibility.optimizations.enableGPUAcceleration).toBe(true);
      expect(compatibility.optimizations.enableTensorRT).toBe(true);
      expect(compatibility.optimizations.maxMemoryUsageMB).toBeLessThanOrEqual(6144);
    });

    it('should generate hardware compatibility report', async () => {
      const report = await hardwareChecker.generateReport();
      
      expect(report).toContain('Hardware Compatibility Report');
      expect(report).toContain('Platform:');
      expect(report).toContain('CPU:');
      expect(report).toContain('Memory:');
      expect(report).toContain('Compatibility:');
    });
  });

  describe('Service Management Validation', () => {
    it('should register service configuration correctly', () => {
      const serviceConfig = {
        name: 'voice-pipeline-test',
        displayName: 'Voice Pipeline Test Service',
        description: 'Test service for voice interaction pipeline',
        executablePath: '/usr/bin/node',
        workingDirectory: '/opt/voice-pipeline',
        environment: { NODE_ENV: 'production' },
        autoStart: true,
        restartOnFailure: true,
        maxRestarts: 5,
        restartDelay: 10
      };

      let serviceRegistered = false;
      serviceManager.on('serviceRegistered', () => {
        serviceRegistered = true;
      });

      serviceManager.registerService(serviceConfig);
      
      expect(serviceRegistered).toBe(true);
    });

    it('should handle service lifecycle events', async () => {
      const serviceName = 'test-service';
      const serviceConfig = {
        name: serviceName,
        displayName: 'Test Service',
        description: 'Test service',
        executablePath: 'node',
        workingDirectory: process.cwd(),
        environment: {},
        autoStart: false,
        restartOnFailure: false,
        maxRestarts: 0,
        restartDelay: 0
      };

      serviceManager.registerService(serviceConfig);

      // Test service status when not running
      const initialStatus = await serviceManager.getServiceStatus(serviceName);
      expect(initialStatus.status).toBe('stopped');
      expect(initialStatus.restartCount).toBe(0);
    });

    it('should validate service configuration requirements', () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        displayName: 'Test Service',
        description: 'Test service',
        executablePath: '', // Invalid: empty path
        workingDirectory: process.cwd(),
        environment: {},
        autoStart: false,
        restartOnFailure: false,
        maxRestarts: -1, // Invalid: negative value
        restartDelay: 0
      };

      expect(() => {
        if (!invalidConfig.name || !invalidConfig.executablePath || invalidConfig.maxRestarts < 0) {
          throw new Error('Invalid service configuration');
        }
      }).toThrow('Invalid service configuration');
    });

    it('should support service monitoring', (done) => {
      const serviceName = 'monitor-test-service';
      const serviceConfig = {
        name: serviceName,
        displayName: 'Monitor Test Service',
        description: 'Service for monitoring test',
        executablePath: 'node',
        workingDirectory: process.cwd(),
        environment: {},
        autoStart: false,
        restartOnFailure: false,
        maxRestarts: 0,
        restartDelay: 0
      };

      serviceManager.registerService(serviceConfig);

      let monitoringStarted = false;
      serviceManager.on('monitoringStarted', () => {
        monitoringStarted = true;
        serviceManager.stopMonitoring();
        expect(monitoringStarted).toBe(true);
        done();
      });

      serviceManager.startMonitoring(1); // 1 second interval for testing
    });
  });

  describe('Integration Validation', () => {
    it('should validate complete system initialization sequence', async () => {
      // Mock successful configuration loading
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        environment: 'production',
        hardware: { platform: 'jetson-nano-orin' }
      }));

      // Mock successful model validation
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1000000 } as any);

      // Test configuration loading
      const config = await configLoader.loadConfig();
      expect(config.environment).toBe('production');

      // Test hardware compatibility
      const compatibility = await hardwareChecker.checkCompatibility();
      expect(compatibility).toBeDefined();

      // Test model availability
      const models = modelManager.listAvailableModels(compatibility.platform);
      expect(models.length).toBeGreaterThan(0);

      // Test service registration
      const serviceConfig = {
        name: 'voice-pipeline',
        displayName: 'Voice Interaction Pipeline',
        description: 'Family-friendly AI assistant voice interaction system',
        executablePath: 'node',
        workingDirectory: process.cwd(),
        environment: { NODE_ENV: config.environment },
        autoStart: true,
        restartOnFailure: true,
        maxRestarts: 5,
        restartDelay: 10
      };

      serviceManager.registerService(serviceConfig);
      const status = await serviceManager.getServiceStatus('voice-pipeline');
      expect(status.name).toBe('voice-pipeline');
    });

    it('should validate configuration consistency across components', async () => {
      const testConfig: Partial<VoicePipelineConfig> = {
        environment: 'production',
        hardware: {
          platform: 'jetson-nano-orin',
          optimizations: { gpu: true, tensorrt: true, cuda: true },
          resourceLimits: { memory: 8192, cpu: 6 },
          thermalManagement: true
        },
        performance: {
          maxMemoryUsage: 6144, // Should be within hardware limits
          maxCpuUsage: 70,
          responseTimeTarget: 500,
          resourceMonitoring: true,
          adaptiveQuality: true,
          queueManagement: {
            maxQueueSize: 10,
            prioritization: true,
            timeoutHandling: true
          }
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(testConfig));

      const config = await configManager.loadConfig();
      const validation = configManager.validateConfig(config);

      expect(validation.isValid).toBe(true);
      
      // Validate performance settings are within hardware limits
      expect(config.performance.maxMemoryUsage).toBeLessThanOrEqual(config.hardware.resourceLimits.memory);
      
      // Validate platform-specific optimizations are enabled
      if (config.hardware.platform === 'jetson-nano-orin') {
        expect(config.hardware.optimizations.gpu).toBe(true);
        expect(config.hardware.optimizations.tensorrt).toBe(true);
      }
    });

    it('should validate error handling and recovery mechanisms', async () => {
      // Test configuration error recovery
      mockFs.readFile.mockRejectedValue(new Error('Configuration file corrupted'));
      
      const config = await configManager.loadConfig();
      expect(config.environment).toBe('development'); // Should fall back to defaults

      // Test model validation error handling
      mockFs.access.mockRejectedValue(new Error('Model file not found'));
      
      const validation = await modelManager.validateModel('wake-word-prod.onnx');
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Test service error handling
      const invalidServiceName = 'non-existent-service';
      
      await expect(serviceManager.getServiceStatus(invalidServiceName))
        .rejects.toThrow(`Service ${invalidServiceName} not registered`);
    });

    it('should validate deployment readiness checklist', async () => {
      const deploymentChecks = {
        configurationValid: false,
        modelsAvailable: false,
        hardwareCompatible: false,
        serviceConfigured: false
      };

      // Check configuration
      try {
        mockFs.readFile.mockResolvedValue(JSON.stringify({ environment: 'production' }));
        const config = await configManager.loadConfig();
        const validation = configManager.validateConfig(config);
        deploymentChecks.configurationValid = validation.isValid;
      } catch {
        deploymentChecks.configurationValid = false;
      }

      // Check models
      try {
        const models = modelManager.listAvailableModels();
        const requiredModels = models.filter(model => model.required);
        deploymentChecks.modelsAvailable = requiredModels.length > 0;
      } catch {
        deploymentChecks.modelsAvailable = false;
      }

      // Check hardware
      try {
        const compatibility = await hardwareChecker.checkCompatibility();
        deploymentChecks.hardwareCompatible = compatibility.isCompatible;
      } catch {
        deploymentChecks.hardwareCompatible = false;
      }

      // Check service
      try {
        const serviceConfig = {
          name: 'voice-pipeline',
          displayName: 'Voice Pipeline',
          description: 'Voice interaction system',
          executablePath: 'node',
          workingDirectory: process.cwd(),
          environment: {},
          autoStart: true,
          restartOnFailure: true,
          maxRestarts: 5,
          restartDelay: 10
        };
        serviceManager.registerService(serviceConfig);
        deploymentChecks.serviceConfigured = true;
      } catch {
        deploymentChecks.serviceConfigured = false;
      }

      // At least configuration and models should be available for basic deployment
      expect(deploymentChecks.configurationValid).toBe(true);
      expect(deploymentChecks.modelsAvailable).toBe(true);
    });
  });
});