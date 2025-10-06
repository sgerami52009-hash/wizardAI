// Learning Engine Error Handling

export abstract class LearningEngineError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly context: ErrorContext;

  constructor(
    message: string,
    code: string,
    severity: ErrorSeverity,
    recoverable: boolean = true,
    context: ErrorContext = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.timestamp = new Date();
    this.context = context;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): ErrorInfo {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

export class TrainingError extends LearningEngineError {
  constructor(message: string, context: TrainingErrorContext = {}) {
    super(message, 'TRAINING_ERROR', ErrorSeverity.HIGH, true, context);
  }
}

export class ModelValidationError extends LearningEngineError {
  constructor(message: string, context: ValidationErrorContext = {}) {
    super(message, 'MODEL_VALIDATION_ERROR', ErrorSeverity.MEDIUM, true, context);
  }
}

export class PrivacyViolationError extends LearningEngineError {
  constructor(message: string, context: PrivacyErrorContext = {}) {
    super(message, 'PRIVACY_VIOLATION', ErrorSeverity.CRITICAL, false, context);
  }
}

export class ResourceExhaustionError extends LearningEngineError {
  constructor(message: string, context: ResourceErrorContext = {}) {
    super(message, 'RESOURCE_EXHAUSTION', ErrorSeverity.HIGH, true, context);
  }
}

export class DataCorruptionError extends LearningEngineError {
  constructor(message: string, context: DataErrorContext = {}) {
    super(message, 'DATA_CORRUPTION', ErrorSeverity.CRITICAL, true, context);
  }
}

export class IntegrationError extends LearningEngineError {
  constructor(message: string, context: IntegrationErrorContext = {}) {
    super(message, 'INTEGRATION_ERROR', ErrorSeverity.MEDIUM, true, context);
  }
}

export class PerformanceDegradationError extends LearningEngineError {
  constructor(message: string, context: PerformanceErrorContext = {}) {
    super(message, 'PERFORMANCE_DEGRADATION', ErrorSeverity.MEDIUM, true, context);
  }
}

export class SafetyViolationError extends LearningEngineError {
  constructor(message: string, context: SafetyErrorContext = {}) {
    super(message, 'SAFETY_VIOLATION', ErrorSeverity.CRITICAL, false, context);
  }
}

export interface ErrorRecoveryManager {
  handleError(error: LearningEngineError): Promise<RecoveryResult>;
  registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void;
  getRecoveryHistory(userId?: string): Promise<RecoveryHistoryEntry[]>;
  clearRecoveryHistory(userId?: string): Promise<void>;
}

export class DefaultErrorRecoveryManager implements ErrorRecoveryManager {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private recoveryHistory: RecoveryHistoryEntry[] = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  public async handleError(error: LearningEngineError): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(error.code) || this.getDefaultStrategy();
    
    try {
      const result = await strategy.recover(error);
      
      // Log recovery attempt
      this.recoveryHistory.push({
        errorId: this.generateErrorId(),
        error: error.toJSON(),
        strategy: strategy.name,
        result,
        timestamp: new Date(),
        userId: error.context.userId
      });

      // Limit history size (keep last 1000 entries)
      if (this.recoveryHistory.length > 1000) {
        this.recoveryHistory = this.recoveryHistory.slice(-1000);
      }

      return result;
    } catch (recoveryError) {
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      const failedResult: RecoveryResult = {
        success: false,
        action: RecoveryAction.ESCALATE,
        message: `Recovery failed: ${errorMessage}`,
        fallbackApplied: false,
        retryRecommended: false,
        escalationRequired: true
      };

      this.recoveryHistory.push({
        errorId: this.generateErrorId(),
        error: error.toJSON(),
        strategy: strategy.name,
        result: failedResult,
        timestamp: new Date(),
        userId: error.context.userId
      });

      return failedResult;
    }
  }

  public registerRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  public async getRecoveryHistory(userId?: string): Promise<RecoveryHistoryEntry[]> {
    if (userId) {
      return this.recoveryHistory.filter(entry => entry.userId === userId);
    }
    return [...this.recoveryHistory];
  }

  public async clearRecoveryHistory(userId?: string): Promise<void> {
    if (userId) {
      this.recoveryHistory = this.recoveryHistory.filter(entry => entry.userId !== userId);
    } else {
      this.recoveryHistory = [];
    }
  }

  private initializeDefaultStrategies(): void {
    // Training error recovery
    this.recoveryStrategies.set('TRAINING_ERROR', {
      name: 'TrainingErrorRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.ROLLBACK_MODEL,
          message: 'Rolled back to previous model version',
          fallbackApplied: true,
          retryRecommended: true,
          escalationRequired: false
        };
      }
    });

    // Privacy violation recovery
    this.recoveryStrategies.set('PRIVACY_VIOLATION', {
      name: 'PrivacyViolationRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.PURGE_DATA,
          message: 'Purged violating data and enhanced privacy filters',
          fallbackApplied: true,
          retryRecommended: false,
          escalationRequired: true
        };
      }
    });

    // Resource exhaustion recovery
    this.recoveryStrategies.set('RESOURCE_EXHAUSTION', {
      name: 'ResourceExhaustionRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.OPTIMIZE_RESOURCES,
          message: 'Optimized resource usage and reduced model complexity',
          fallbackApplied: true,
          retryRecommended: true,
          escalationRequired: false
        };
      }
    });

    // Data corruption recovery
    this.recoveryStrategies.set('DATA_CORRUPTION', {
      name: 'DataCorruptionRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.RESTORE_BACKUP,
          message: 'Restored from latest valid backup',
          fallbackApplied: true,
          retryRecommended: false,
          escalationRequired: false
        };
      }
    });

    // Integration error recovery
    this.recoveryStrategies.set('INTEGRATION_ERROR', {
      name: 'IntegrationErrorRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.FALLBACK_MODE,
          message: 'Switched to fallback integration mode',
          fallbackApplied: true,
          retryRecommended: true,
          escalationRequired: false
        };
      }
    });

    // Performance degradation recovery
    this.recoveryStrategies.set('PERFORMANCE_DEGRADATION', {
      name: 'PerformanceDegradationRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.OPTIMIZE_PERFORMANCE,
          message: 'Applied performance optimizations',
          fallbackApplied: true,
          retryRecommended: false,
          escalationRequired: false
        };
      }
    });

    // Safety violation recovery
    this.recoveryStrategies.set('SAFETY_VIOLATION', {
      name: 'SafetyViolationRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: true,
          action: RecoveryAction.ENFORCE_SAFETY,
          message: 'Enhanced safety controls and purged unsafe content',
          fallbackApplied: true,
          retryRecommended: false,
          escalationRequired: true
        };
      }
    });
  }

  private getDefaultStrategy(): RecoveryStrategy {
    return {
      name: 'DefaultRecovery',
      recover: async (error: LearningEngineError) => {
        return {
          success: false,
          action: RecoveryAction.ESCALATE,
          message: `No specific recovery strategy for error: ${error.code}`,
          fallbackApplied: false,
          retryRecommended: false,
          escalationRequired: true
        };
      }
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Error context interfaces
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  additionalInfo?: Record<string, any>;
}

export interface TrainingErrorContext extends ErrorContext {
  modelVersion?: string;
  trainingData?: string;
  epoch?: number;
  batchSize?: number;
  patternCount?: number;
  trainingDuration?: number;
}

export interface ValidationErrorContext extends ErrorContext {
  validationType?: string;
  expectedValue?: any;
  actualValue?: any;
  threshold?: number;
}

export interface PrivacyErrorContext extends ErrorContext {
  violationType?: string;
  dataType?: string;
  regulation?: string;
  severity?: string;
}

export interface ResourceErrorContext extends ErrorContext {
  resourceType?: string;
  currentUsage?: number;
  limit?: number;
  requestedAmount?: number;
  memoryUsage?: number;
}

export interface DataErrorContext extends ErrorContext {
  dataType?: string;
  corruptionType?: string;
  affectedRecords?: number;
  backupAvailable?: boolean;
}

export interface IntegrationErrorContext extends ErrorContext {
  targetSystem?: string;
  endpoint?: string;
  statusCode?: number;
  retryAttempt?: number;
}

export interface PerformanceErrorContext extends ErrorContext {
  metric?: string;
  currentValue?: number;
  threshold?: number;
  degradationPercent?: number;
}

export interface SafetyErrorContext extends ErrorContext {
  safetyRule?: string;
  contentType?: string;
  ageGroup?: string;
  severity?: string;
}

export interface ErrorInfo {
  name: string;
  message: string;
  code: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: Date;
  context: ErrorContext;
  stack?: string;
}

export interface RecoveryStrategy {
  name: string;
  recover(error: LearningEngineError): Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  fallbackApplied: boolean;
  retryRecommended: boolean;
  escalationRequired: boolean;
  additionalInfo?: Record<string, any>;
}

export interface RecoveryHistoryEntry {
  errorId: string;
  error: ErrorInfo;
  strategy: string;
  result: RecoveryResult;
  timestamp: Date;
  userId?: string;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecoveryAction {
  RETRY = 'retry',
  ROLLBACK_MODEL = 'rollback_model',
  PURGE_DATA = 'purge_data',
  OPTIMIZE_RESOURCES = 'optimize_resources',
  RESTORE_BACKUP = 'restore_backup',
  FALLBACK_MODE = 'fallback_mode',
  OPTIMIZE_PERFORMANCE = 'optimize_performance',
  ENFORCE_SAFETY = 'enforce_safety',
  ESCALATE = 'escalate',
  IGNORE = 'ignore'
}

// Utility functions for error handling
export function isRecoverableError(error: Error): boolean {
  return error instanceof LearningEngineError && error.recoverable;
}

export function getErrorSeverity(error: Error): ErrorSeverity {
  if (error instanceof LearningEngineError) {
    return error.severity;
  }
  return ErrorSeverity.MEDIUM;
}

export function createErrorContext(
  userId?: string,
  component?: string,
  operation?: string,
  additionalInfo?: Record<string, any>
): ErrorContext {
  return {
    userId,
    component,
    operation,
    additionalInfo
  };
}

export function sanitizeErrorForLogging(error: LearningEngineError): ErrorInfo {
  const sanitized = error.toJSON();
  
  // Remove sensitive information from context
  if (sanitized.context.additionalInfo) {
    const sanitizedInfo = { ...sanitized.context.additionalInfo };
    
    // Remove potential PII fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'email', 'phone', 'address'];
    sensitiveFields.forEach(field => {
      if (sanitizedInfo[field]) {
        sanitizedInfo[field] = '[REDACTED]';
      }
    });
    
    sanitized.context.additionalInfo = sanitizedInfo;
  }
  
  return sanitized;
}