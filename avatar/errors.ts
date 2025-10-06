// Avatar System Error Handling and Recovery

import { avatarEventBus, AvatarSystemError } from './events';

export class AvatarError extends Error {
  public readonly code: string;
  public readonly component: string;
  public readonly severity: 'warning' | 'error' | 'critical';
  public readonly recoverable: boolean;
  public readonly context?: any;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    component: string,
    severity: 'warning' | 'error' | 'critical' = 'error',
    recoverable: boolean = true,
    context?: any
  ) {
    super(message);
    this.name = 'AvatarError';
    this.code = code;
    this.component = component;
    this.severity = severity;
    this.recoverable = recoverable;
    this.context = context;
    this.timestamp = new Date();
  }
}

export class RenderingError extends AvatarError {
  constructor(message: string, context?: any) {
    super('RENDERING_ERROR', message, 'renderer', 'error', true, context);
  }
}

export class PerformanceError extends AvatarError {
  constructor(message: string, context?: any) {
    super('PERFORMANCE_ERROR', message, 'performance', 'warning', true, context);
  }
}

export class SafetyViolationError extends AvatarError {
  constructor(message: string, context?: any) {
    super('SAFETY_VIOLATION', message, 'safety', 'critical', false, context);
  }
}

export class DataCorruptionError extends AvatarError {
  constructor(message: string, context?: any) {
    super('DATA_CORRUPTION', message, 'storage', 'critical', true, context);
  }
}

export class IntegrationError extends AvatarError {
  constructor(message: string, component: string, context?: any) {
    super('INTEGRATION_ERROR', message, component, 'error', true, context);
  }
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'reset' | 'notify' | 'disable';
  description: string;
  execute: () => Promise<boolean>;
  maxAttempts?: number;
  backoffMs?: number;
}

export interface AvatarErrorRecovery {
  handleRenderingError(error: RenderingError): Promise<RecoveryAction>;
  handlePerformanceIssue(metrics: PerformanceMetrics): Promise<OptimizationAction>;
  handleSafetyViolation(violation: SafetyViolationError): Promise<RecoveryAction>;
  handleDataCorruption(corruption: DataCorruptionError): Promise<RecoveryAction>;
  handleIntegrationError(error: IntegrationError): Promise<RecoveryAction>;
}

export interface PerformanceMetrics {
  currentFPS: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
  renderTime: number;
  triangleCount: number;
}

export interface OptimizationAction {
  type: 'reduce_quality' | 'unload_assets' | 'disable_features' | 'restart_renderer';
  description: string;
  execute: () => Promise<boolean>;
  performanceGain: number;
}

export interface SafetyAction {
  type: 'block_content' | 'revert_changes' | 'notify_parent' | 'audit_log';
  description: string;
  execute: () => Promise<boolean>;
  requiresParentalNotification: boolean;
}

export class AvatarErrorHandler implements AvatarErrorRecovery {
  private recoveryAttempts: Map<string, number> = new Map();
  private readonly maxRetries = 3;
  private readonly backoffBase = 1000; // 1 second

  constructor() {
    // Listen for system errors and handle them
    avatarEventBus.onSystemError(this.handleSystemError.bind(this));
  }

  private async handleSystemError(component: string, error: AvatarSystemError): Promise<void> {
    try {
      let recoveryAction: RecoveryAction;

      switch (error.code) {
        case 'RENDERING_ERROR':
          recoveryAction = await this.handleRenderingError(error as any);
          break;
        case 'PERFORMANCE_ERROR':
          // Handle performance issues with metrics
          recoveryAction = await this.createPerformanceRecovery(error);
          break;
        case 'SAFETY_VIOLATION':
          recoveryAction = await this.handleSafetyViolation(error as any);
          break;
        case 'DATA_CORRUPTION':
          recoveryAction = await this.handleDataCorruption(error as any);
          break;
        case 'INTEGRATION_ERROR':
          recoveryAction = await this.handleIntegrationError(error as any);
          break;
        default:
          recoveryAction = await this.createDefaultRecovery(error);
      }

      const success = await this.executeRecovery(recoveryAction, error.code);
      if (success) {
        avatarEventBus.emitSystemRecovery(component, recoveryAction.description);
        this.recoveryAttempts.delete(error.code);
      }
    } catch (recoveryError) {
      console.error('Failed to recover from avatar system error:', recoveryError);
      // Emit critical system failure if recovery fails
      avatarEventBus.emitSystemError(component, {
        code: 'RECOVERY_FAILED',
        message: 'System recovery failed',
        component,
        severity: 'critical',
        recoverable: false,
        context: { originalError: error, recoveryError }
      });
    }
  }

  async handleRenderingError(error: RenderingError): Promise<RecoveryAction> {
    return {
      type: 'fallback',
      description: 'Reduce rendering quality and retry',
      execute: async () => {
        try {
          // Implement quality reduction logic
          console.log('Reducing rendering quality due to error:', error.message);
          // This would integrate with the actual renderer
          return true;
        } catch {
          return false;
        }
      },
      maxAttempts: 3,
      backoffMs: 2000
    };
  }

  async handlePerformanceIssue(metrics: PerformanceMetrics): Promise<OptimizationAction> {
    let optimizationType: OptimizationAction['type'] = 'reduce_quality';
    let performanceGain = 0.2;

    if (metrics.gpuMemoryUsage > 0.9) {
      optimizationType = 'unload_assets';
      performanceGain = 0.3;
    } else if (metrics.currentFPS < 30) {
      optimizationType = 'disable_features';
      performanceGain = 0.4;
    }

    return {
      type: optimizationType,
      description: `Optimize performance: ${optimizationType.replace('_', ' ')}`,
      execute: async () => {
        try {
          console.log(`Executing performance optimization: ${optimizationType}`);
          // Implement actual optimization logic
          return true;
        } catch {
          return false;
        }
      },
      performanceGain
    };
  }

  async handleSafetyViolation(violation: SafetyViolationError): Promise<RecoveryAction> {
    return {
      type: 'reset',
      description: 'Block unsafe content and revert to safe defaults',
      execute: async () => {
        try {
          console.log('Blocking unsafe content:', violation.message);
          // Implement content blocking and reversion logic
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  async handleDataCorruption(corruption: DataCorruptionError): Promise<RecoveryAction> {
    return {
      type: 'reset',
      description: 'Restore from backup and verify integrity',
      execute: async () => {
        try {
          console.log('Restoring from backup due to corruption:', corruption.message);
          // Implement backup restoration logic
          return true;
        } catch {
          return false;
        }
      },
      maxAttempts: 2,
      backoffMs: 5000
    };
  }

  async handleIntegrationError(error: IntegrationError): Promise<RecoveryAction> {
    return {
      type: 'retry',
      description: 'Retry integration with exponential backoff',
      execute: async () => {
        try {
          console.log('Retrying integration:', error.component);
          // Implement integration retry logic
          return true;
        } catch {
          return false;
        }
      },
      maxAttempts: 5,
      backoffMs: 1000
    };
  }

  private async createPerformanceRecovery(error: AvatarSystemError): Promise<RecoveryAction> {
    return {
      type: 'fallback',
      description: 'Optimize system performance',
      execute: async () => {
        try {
          console.log('Optimizing performance due to error:', error.message);
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  private async createDefaultRecovery(error: AvatarSystemError): Promise<RecoveryAction> {
    return {
      type: 'notify',
      description: 'Log error and continue with degraded functionality',
      execute: async () => {
        console.warn('Unhandled avatar system error:', error);
        return true;
      }
    };
  }

  private async executeRecovery(action: RecoveryAction, errorCode: string): Promise<boolean> {
    const attempts = this.recoveryAttempts.get(errorCode) || 0;
    const maxAttempts = action.maxAttempts || this.maxRetries;

    if (attempts >= maxAttempts) {
      console.error(`Max recovery attempts reached for error: ${errorCode}`);
      return false;
    }

    this.recoveryAttempts.set(errorCode, attempts + 1);

    // Apply exponential backoff if specified
    if (action.backoffMs && attempts > 0) {
      const delay = action.backoffMs * Math.pow(2, attempts - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      return await action.execute();
    } catch (error) {
      console.error('Recovery action failed:', error);
      return false;
    }
  }
}

// Utility functions for error handling
export function sanitizeForLog(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };
  
  // Remove sensitive information
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential'];
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

export function createChildFriendlyErrorMessage(error: AvatarError): string {
  switch (error.code) {
    case 'RENDERING_ERROR':
      return "I'm having trouble showing your avatar right now. Let's try again!";
    case 'PERFORMANCE_ERROR':
      return "Your avatar is working hard! I'm making it run smoother.";
    case 'SAFETY_VIOLATION':
      return "That choice isn't quite right for you. Let's pick something else!";
    case 'DATA_CORRUPTION':
      return "I need to fix something with your avatar. This will just take a moment.";
    case 'INTEGRATION_ERROR':
      return "I'm having trouble connecting some parts. Let me try again.";
    default:
      return "Something unexpected happened, but I'm working on fixing it!";
  }
}

// Export singleton error handler
export const avatarErrorHandler = new AvatarErrorHandler();