/**
 * Configuration Validation and Error Reporting System
 * Provides comprehensive validation rules and detailed error reporting
 */

import { VoicePipelineConfig, ConfigValidationResult } from './config-manager';

export interface ValidationRule {
  path: string;
  validator: (value: any, config: VoicePipelineConfig) => boolean;
  errorMessage: string;
  warningMessage?: string;
  severity: 'error' | 'warning';
}

export interface DetailedValidationResult extends ConfigValidationResult {
  validationDetails: ValidationDetail[];
}

export interface ValidationDetail {
  path: string;
  value: any;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export class ConfigValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.setupDefaultRules();
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove validation rule by path
   */
  removeRule(path: string): void {
    this.rules = this.rules.filter(rule => rule.path !== path);
  }

  /**
   * Validate configuration with detailed reporting
   */
  validateDetailed(config: VoicePipelineConfig): DetailedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validationDetails: ValidationDetail[] = [];

    for (const rule of this.rules) {
      try {
        const value = this.getValueByPath(config, rule.path);
        const isValid = rule.validator(value, config);

        const detail: ValidationDetail = {
          path: rule.path,
          value,
          rule: rule.validator.name || 'anonymous',
          severity: rule.severity,
          message: isValid ? 'Valid' : (rule.severity === 'error' ? rule.errorMessage : rule.warningMessage || rule.errorMessage)
        };

        validationDetails.push(detail);

        if (!isValid) {
          if (rule.severity === 'error') {
            errors.push(`${rule.path}: ${rule.errorMessage}`);
          } else {
            warnings.push(`${rule.path}: ${rule.warningMessage || rule.errorMessage}`);
          }
        }
      } catch (error) {
        const errorMsg = `Validation error for ${rule.path}: ${error.message}`;
        errors.push(errorMsg);
        
        validationDetails.push({
          path: rule.path,
          value: undefined,
          rule: 'validation-error',
          severity: 'error',
          message: errorMsg
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validationDetails
    };
  }

  /**
   * Validate configuration (basic)
   */
  validate(config: VoicePipelineConfig): ConfigValidationResult {
    const detailed = this.validateDetailed(config);
    return {
      isValid: detailed.isValid,
      errors: detailed.errors,
      warnings: detailed.warnings
    };
  }

  /**
   * Get validation report as formatted string
   */
  getValidationReport(config: VoicePipelineConfig): string {
    const result = this.validateDetailed(config);
    const lines: string[] = [];

    lines.push('=== Configuration Validation Report ===');
    lines.push(`Environment: ${config.environment}`);
    lines.push(`Overall Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('ERRORS:');
      result.errors.forEach(error => lines.push(`  ❌ ${error}`));
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      result.warnings.forEach(warning => lines.push(`  ⚠️  ${warning}`));
      lines.push('');
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      lines.push('✅ All validation checks passed!');
    }

    lines.push('=== Detailed Validation Results ===');
    result.validationDetails.forEach(detail => {
      const icon = detail.severity === 'error' ? '❌' : detail.message === 'Valid' ? '✅' : '⚠️';
      lines.push(`${icon} ${detail.path}: ${detail.message}`);
    });

    return lines.join('\n');
  }

  /**
   * Setup default validation rules
   */
  private setupDefaultRules(): void {
    // Environment validation
    this.addRule({
      path: 'environment',
      validator: (value) => ['development', 'production', 'testing'].includes(value),
      errorMessage: 'Environment must be one of: development, production, testing',
      severity: 'error'
    });

    // Audio configuration validation
    this.addRule({
      path: 'audio.sampleRate',
      validator: (value) => typeof value === 'number' && value >= 8000 && value <= 48000,
      errorMessage: 'Sample rate must be between 8000 and 48000 Hz',
      severity: 'error'
    });

    this.addRule({
      path: 'audio.channels',
      validator: (value) => [1, 2].includes(value),
      errorMessage: 'Audio channels must be 1 (mono) or 2 (stereo)',
      severity: 'error'
    });

    this.addRule({
      path: 'audio.bitDepth',
      validator: (value) => [16, 24, 32].includes(value),
      errorMessage: 'Bit depth must be 16, 24, or 32 bits',
      severity: 'error'
    });

    this.addRule({
      path: 'audio.bufferSize',
      validator: (value) => typeof value === 'number' && value > 0 && (value & (value - 1)) === 0,
      errorMessage: 'Buffer size must be a positive power of 2',
      severity: 'error'
    });

    // Performance validation for Jetson Nano Orin
    this.addRule({
      path: 'performance.maxMemoryUsage',
      validator: (value, config) => {
        if (config.hardware.platform === 'jetson-nano-orin') {
          return value <= 8192;
        }
        return value > 0;
      },
      errorMessage: 'Memory usage cannot exceed 8GB on Jetson Nano Orin',
      severity: 'error'
    });

    this.addRule({
      path: 'performance.maxCpuUsage',
      validator: (value) => typeof value === 'number' && value > 0 && value <= 100,
      errorMessage: 'CPU usage must be between 1 and 100 percent',
      severity: 'error'
    });

    this.addRule({
      path: 'performance.responseTimeTarget',
      validator: (value) => typeof value === 'number' && value > 0,
      errorMessage: 'Response time target must be positive',
      severity: 'error'
    });

    this.addRule({
      path: 'performance.responseTimeTarget',
      validator: (value) => value <= 500,
      errorMessage: 'Response time target exceeds 500ms recommendation for optimal user experience',
      warningMessage: 'Consider reducing response time target to 500ms or less',
      severity: 'warning'
    });

    // Safety validation
    this.addRule({
      path: 'safety.enabled',
      validator: (value) => typeof value === 'boolean',
      errorMessage: 'Safety enabled flag must be boolean',
      severity: 'error'
    });

    this.addRule({
      path: 'safety.auditLogging',
      validator: (value, config) => {
        if (config.safety.enabled && !value) {
          return false;
        }
        return true;
      },
      errorMessage: 'Audit logging should be enabled when safety is enabled',
      warningMessage: 'Consider enabling audit logging for safety compliance',
      severity: 'warning'
    });

    this.addRule({
      path: 'safety.defaultAgeGroup',
      validator: (value) => ['child', 'teen', 'adult'].includes(value),
      errorMessage: 'Default age group must be: child, teen, or adult',
      severity: 'error'
    });

    // Wake word validation
    this.addRule({
      path: 'wakeWord.sensitivity',
      validator: (value) => typeof value === 'number' && value >= 0.0 && value <= 1.0,
      errorMessage: 'Wake word sensitivity must be between 0.0 and 1.0',
      severity: 'error'
    });

    this.addRule({
      path: 'wakeWord.confidenceThreshold',
      validator: (value) => typeof value === 'number' && value >= 0.0 && value <= 1.0,
      errorMessage: 'Wake word confidence threshold must be between 0.0 and 1.0',
      severity: 'error'
    });

    this.addRule({
      path: 'wakeWord.phrases',
      validator: (value) => Array.isArray(value) && value.length > 0,
      errorMessage: 'At least one wake word phrase must be configured',
      severity: 'error'
    });

    // Speech recognition validation
    this.addRule({
      path: 'speechRecognition.confidenceThreshold',
      validator: (value) => typeof value === 'number' && value >= 0.0 && value <= 1.0,
      errorMessage: 'Speech recognition confidence threshold must be between 0.0 and 1.0',
      severity: 'error'
    });

    this.addRule({
      path: 'speechRecognition.timeoutDuration',
      validator: (value) => typeof value === 'number' && value > 0 && value <= 30,
      errorMessage: 'Speech recognition timeout must be between 1 and 30 seconds',
      severity: 'error'
    });

    // TTS validation
    this.addRule({
      path: 'tts.rate',
      validator: (value) => typeof value === 'number' && value >= 0.5 && value <= 2.0,
      errorMessage: 'TTS rate must be between 0.5 and 2.0',
      severity: 'error'
    });

    this.addRule({
      path: 'tts.pitch',
      validator: (value) => typeof value === 'number' && value >= 0.5 && value <= 2.0,
      errorMessage: 'TTS pitch must be between 0.5 and 2.0',
      severity: 'error'
    });

    this.addRule({
      path: 'tts.volume',
      validator: (value) => typeof value === 'number' && value >= 0.0 && value <= 1.0,
      errorMessage: 'TTS volume must be between 0.0 and 1.0',
      severity: 'error'
    });

    // Hardware validation
    this.addRule({
      path: 'hardware.platform',
      validator: (value) => ['jetson-nano-orin', 'generic'].includes(value),
      errorMessage: 'Hardware platform must be: jetson-nano-orin or generic',
      severity: 'error'
    });

    this.addRule({
      path: 'hardware.resourceLimits.memory',
      validator: (value, config) => {
        if (config.hardware.platform === 'jetson-nano-orin') {
          return value <= 8192;
        }
        return value > 0;
      },
      errorMessage: 'Memory limit cannot exceed 8GB on Jetson Nano Orin',
      severity: 'error'
    });

    // Logging validation
    this.addRule({
      path: 'logging.level',
      validator: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
      errorMessage: 'Logging level must be: debug, info, warn, or error',
      severity: 'error'
    });

    this.addRule({
      path: 'logging.maxFileSize',
      validator: (value) => typeof value === 'number' && value > 0,
      errorMessage: 'Log file size must be positive',
      severity: 'error'
    });

    // Model path validation
    this.addRule({
      path: 'wakeWord.modelPath',
      validator: (value) => typeof value === 'string' && value.length > 0,
      errorMessage: 'Wake word model path cannot be empty',
      severity: 'error'
    });

    this.addRule({
      path: 'speechRecognition.modelPath',
      validator: (value) => typeof value === 'string' && value.length > 0,
      errorMessage: 'Speech recognition model path cannot be empty',
      severity: 'error'
    });

    this.addRule({
      path: 'intent.modelPath',
      validator: (value) => typeof value === 'string' && value.length > 0,
      errorMessage: 'Intent classification model path cannot be empty',
      severity: 'error'
    });
  }

  /**
   * Get value from configuration by dot notation path
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
}

export default ConfigValidator;