/**
 * Error types and classes for the recommendations system
 * Provides comprehensive error categorization and handling
 */

export enum ErrorCategory {
  RECOMMENDATION_GENERATION = 'recommendation_generation',
  CONTEXT_ANALYSIS = 'context_analysis',
  LEARNING_SYSTEM = 'learning_system',
  PRIVACY_VIOLATION = 'privacy_violation',
  INTEGRATION = 'integration',
  HARDWARE_CONSTRAINT = 'hardware_constraint'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string;
  recommendationType?: string;
  timestamp: Date;
  systemState: Record<string, any>;
  memoryUsage?: number;
  requestId?: string;
}

export abstract class RecommendationError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;
  public readonly fallbackAvailable: boolean;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext,
    recoverable: boolean = true,
    fallbackAvailable: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.severity = severity;
    this.context = context;
    this.recoverable = recoverable;
    this.fallbackAvailable = fallbackAvailable;
  }
}

export class GenerationError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly modelType?: string) {
    super(
      message,
      ErrorCategory.RECOMMENDATION_GENERATION,
      ErrorSeverity.MEDIUM,
      context,
      true,
      true
    );
  }
}

export class ContextError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly sensorType?: string) {
    super(
      message,
      ErrorCategory.CONTEXT_ANALYSIS,
      ErrorSeverity.LOW,
      context,
      true,
      true
    );
  }
}

export class LearningError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly modelId?: string) {
    super(
      message,
      ErrorCategory.LEARNING_SYSTEM,
      ErrorSeverity.HIGH,
      context,
      true,
      false
    );
  }
}

export class PrivacyError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly violationType?: string) {
    super(
      message,
      ErrorCategory.PRIVACY_VIOLATION,
      ErrorSeverity.CRITICAL,
      context,
      false,
      false
    );
  }
}

export class IntegrationError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly systemName?: string) {
    super(
      message,
      ErrorCategory.INTEGRATION,
      ErrorSeverity.MEDIUM,
      context,
      true,
      true
    );
  }
}

export class HardwareConstraintError extends RecommendationError {
  constructor(message: string, context: ErrorContext, public readonly resourceType?: string) {
    super(
      message,
      ErrorCategory.HARDWARE_CONSTRAINT,
      ErrorSeverity.HIGH,
      context,
      true,
      true
    );
  }
}