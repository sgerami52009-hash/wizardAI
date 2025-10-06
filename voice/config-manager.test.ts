/**
 * Unit tests for Configuration Management System
 */

import ConfigManager, { VoicePipelineConfig } from './config-manager';
import ConfigValidator from './config-validator';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testConfigPath: string;

  beforeEach(() => {
    testConfigPath = './test-config/voice-pipeline.json';
    configManager = new ConfigManager(testConfigPath);
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load and validate configuration from file', async () => {
      const mockConfig: Partial<VoicePipelineConfig> = {
        environment: 'development',
        audio: {
          sampleRate: 16000,
          channels: 1,
          bitDepth: 16,
          bufferSize: 1024,
          noiseReduction: true,
          echoCancellation: true,
          automaticGainControl: true,
          maxRecordingDuration: 30
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockConfig));

      const result = await configManager.loadConfig();

      expect(mockFs.readFile).toHaveBeenCalledWith(testConfigPath, 'utf-8');
      expect(result.environment).toBe('development');
      expect(result.audio.sampleRate).toBe(16000);
    });

    it('should return default configuration on file read error', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await configManager.loadConfig();

      expect(result.environment).toBe('development');
      expect(result.audio.sampleRate).toBe(16000);
    });

    it('should emit configError event on validation failure', async () => {
      const invalidConfig = {
        environment: 'invalid',
        audio: { sampleRate: -1 }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      const errorSpy = jest.fn();
      configManager.on('configError', errorSpy);

      await configManager.loadConfig();

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('saveConfig', () => {
    it('should save valid configuration to file', async () => {
      const config = configManager['getDefaultConfig']();
      
      await configManager.saveConfig(config);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.dirname(testConfigPath), 
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testConfigPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = {
        environment: 'invalid'
      } as VoicePipelineConfig;

      await expect(configManager.saveConfig(invalidConfig))
        .rejects.toThrow('Cannot save invalid configuration');
    });

    it('should emit configSaved event on successful save', async () => {
      const config = configManager['getDefaultConfig']();
      const savedSpy = jest.fn();
      configManager.on('configSaved', savedSpy);

      await configManager.saveConfig(config);

      expect(savedSpy).toHaveBeenCalledWith(config);
    });
  });

  describe('updateConfig', () => {
    beforeEach(async () => {
      // Load default config first
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await configManager.loadConfig();
    });

    it('should update configuration with partial changes', async () => {
      const updates = {
        audio: {
          sampleRate: 22050,
          channels: 2
        }
      };

      await configManager.updateConfig(updates);

      const config = configManager.getConfig();
      expect(config.audio.sampleRate).toBe(22050);
      expect(config.audio.channels).toBe(2);
      expect(config.audio.bitDepth).toBe(16); // Should preserve existing values
    });

    it('should emit configUpdated event', async () => {
      const updatedSpy = jest.fn();
      configManager.on('configUpdated', updatedSpy);

      const updates = { audio: { sampleRate: 22050 } };
      await configManager.updateConfig(updates);

      expect(updatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: updates,
          newConfig: expect.any(Object),
          oldConfig: expect.any(Object)
        })
      );
    });

    it('should reject invalid updates', async () => {
      const invalidUpdates = {
        audio: { sampleRate: -1 }
      };

      await expect(configManager.updateConfig(invalidUpdates))
        .rejects.toThrow('Configuration update validation failed');
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = configManager['getDefaultConfig']();
      const result = configManager.validateConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid environment', () => {
      const config = configManager['getDefaultConfig']();
      config.environment = 'invalid' as any;

      const result = configManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid environment specified');
    });

    it('should detect invalid audio sample rate', () => {
      const config = configManager['getDefaultConfig']();
      config.audio.sampleRate = 100000;

      const result = configManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Audio sample rate must be between 8000 and 48000 Hz');
    });

    it('should detect memory limit violations for Jetson Nano Orin', () => {
      const config = configManager['getDefaultConfig']();
      config.hardware.platform = 'jetson-nano-orin';
      config.performance.maxMemoryUsage = 10000;

      const result = configManager.validateConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Memory usage cannot exceed 8GB on Jetson Nano Orin');
    });

    it('should generate warnings for suboptimal settings', () => {
      const config = configManager['getDefaultConfig']();
      config.performance.responseTimeTarget = 1000;

      const result = configManager.validateConfig(config);

      expect(result.warnings).toContain('Response time target exceeds 500ms recommendation');
    });
  });

  describe('getComponentConfig', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await configManager.loadConfig();
    });

    it('should return specific component configuration', () => {
      const audioConfig = configManager.getComponentConfig('audio');

      expect(audioConfig).toHaveProperty('sampleRate');
      expect(audioConfig).toHaveProperty('channels');
      expect(audioConfig).toHaveProperty('bitDepth');
    });

    it('should return performance configuration', () => {
      const perfConfig = configManager.getComponentConfig('performance');

      expect(perfConfig).toHaveProperty('maxMemoryUsage');
      expect(perfConfig).toHaveProperty('maxCpuUsage');
      expect(perfConfig).toHaveProperty('responseTimeTarget');
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        environment: 'production' as const,
        audio: {
          sampleRate: 22050
        }
      };

      const merged = configManager['mergeWithDefaults'](partialConfig);

      expect(merged.environment).toBe('production');
      expect(merged.audio.sampleRate).toBe(22050);
      expect(merged.audio.channels).toBe(1); // From defaults
      expect(merged.wakeWord).toBeDefined(); // From defaults
    });

    it('should handle nested object merging', () => {
      const partialConfig = {
        performance: {
          maxMemoryUsage: 4096
        }
      };

      const merged = configManager['mergeWithDefaults'](partialConfig);

      expect(merged.performance.maxMemoryUsage).toBe(4096);
      expect(merged.performance.maxCpuUsage).toBe(70); // From defaults
      expect(merged.performance.responseTimeTarget).toBe(500); // From defaults
    });
  });
});

describe('ConfigValidator', () => {
  let validator: ConfigValidator;
  let defaultConfig: VoicePipelineConfig;

  beforeEach(() => {
    validator = new ConfigValidator();
    const configManager = new ConfigManager();
    defaultConfig = configManager['getDefaultConfig']();
  });

  describe('validateDetailed', () => {
    it('should provide detailed validation results', () => {
      const result = validator.validateDetailed(defaultConfig);

      expect(result).toHaveProperty('validationDetails');
      expect(result.validationDetails).toBeInstanceOf(Array);
      expect(result.validationDetails.length).toBeGreaterThan(0);
    });

    it('should identify specific validation failures', () => {
      const invalidConfig = { ...defaultConfig };
      invalidConfig.audio.sampleRate = -1;

      const result = validator.validateDetailed(invalidConfig);

      const sampleRateDetail = result.validationDetails.find(
        detail => detail.path === 'audio.sampleRate'
      );

      expect(sampleRateDetail).toBeDefined();
      expect(sampleRateDetail?.severity).toBe('error');
      expect(sampleRateDetail?.message).toContain('Sample rate must be between');
    });
  });

  describe('getValidationReport', () => {
    it('should generate formatted validation report', () => {
      const report = validator.getValidationReport(defaultConfig);

      expect(report).toContain('Configuration Validation Report');
      expect(report).toContain('Overall Status');
      expect(report).toContain('Detailed Validation Results');
    });

    it('should show errors in validation report', () => {
      const invalidConfig = { ...defaultConfig };
      invalidConfig.environment = 'invalid' as any;

      const report = validator.getValidationReport(invalidConfig);

      expect(report).toContain('ERRORS:');
      expect(report).toContain('❌');
      expect(report).toContain('Environment must be one of');
    });
  });

  describe('addRule and removeRule', () => {
    it('should allow adding custom validation rules', () => {
      const customRule = {
        path: 'custom.field',
        validator: (value: any) => value === 'expected',
        errorMessage: 'Custom field must be "expected"',
        severity: 'error' as const
      };

      validator.addRule(customRule);

      const configWithCustomField = {
        ...defaultConfig,
        custom: { field: 'wrong' }
      } as any;

      const result = validator.validate(configWithCustomField);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('custom.field: Custom field must be "expected"');
    });

    it('should allow removing validation rules', () => {
      validator.removeRule('environment');

      const invalidConfig = { ...defaultConfig };
      invalidConfig.environment = 'invalid' as any;

      const result = validator.validate(invalidConfig);

      // Should not fail on environment validation since rule was removed
      const environmentError = result.errors.find(error => 
        error.includes('Environment must be one of')
      );
      expect(environmentError).toBeUndefined();
    });
  });
});