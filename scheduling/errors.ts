// Base error handling and recovery mechanisms for scheduling operations

export abstract class SchedulingError extends Error {
  public readonly code: string
  public readonly component: string
  public readonly timestamp: Date
  public readonly userId?: string
  public readonly recoverable: boolean
  public readonly retryable: boolean

  constructor(
    message: string,
    code: string,
    component: string,
    options: {
      userId?: string
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.component = component
    this.timestamp = new Date()
    this.userId = options.userId
    this.recoverable = options.recoverable ?? true
    this.retryable = options.retryable ?? false
    
    if (options.cause) {
      this.cause = options.cause
    }
  }

  abstract getRecoveryActions(): RecoveryAction[]
  abstract getSeverity(): ErrorSeverity
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RecoveryAction {
  type: RecoveryActionType
  description: string
  automated: boolean
  priority: number
  estimatedTime?: number // seconds
  requiredPermissions?: string[]
}

export enum RecoveryActionType {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  MANUAL_INTERVENTION = 'manual_intervention',
  DATA_RECOVERY = 'data_recovery',
  SYSTEM_RESTART = 'system_restart',
  NOTIFICATION = 'notification',
  ESCALATION = 'escalation'
}

// Calendar-specific errors
export class CalendarError extends SchedulingError {
  constructor(
    message: string,
    code: string,
    options: {
      userId?: string
      eventId?: string
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, 'Calendar', options)
  }

  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case 'EVENT_CONFLICT':
        return [
          {
            type: RecoveryActionType.MANUAL_INTERVENTION,
            description: 'Resolve scheduling conflict by choosing alternative time',
            automated: false,
            priority: 1
          },
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Suggest alternative time slots',
            automated: true,
            priority: 2
          }
        ]
      case 'EVENT_VALIDATION_FAILED':
        return [
          {
            type: RecoveryActionType.NOTIFICATION,
            description: 'Notify user of validation issues',
            automated: true,
            priority: 1
          }
        ]
      default:
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry calendar operation',
            automated: true,
            priority: 1,
            estimatedTime: 5
          }
        ]
    }
  }

  getSeverity(): ErrorSeverity {
    switch (this.code) {
      case 'EVENT_CONFLICT':
        return ErrorSeverity.MEDIUM
      case 'EVENT_VALIDATION_FAILED':
        return ErrorSeverity.LOW
      case 'CALENDAR_CORRUPTION':
        return ErrorSeverity.HIGH
      default:
        return ErrorSeverity.MEDIUM
    }
  }
}

// Reminder-specific errors
export class ReminderError extends SchedulingError {
  constructor(
    message: string,
    code: string,
    options: {
      userId?: string
      reminderId?: string
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, 'Reminder', options)
  }

  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case 'DELIVERY_FAILED':
        return [
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Try alternative delivery method',
            automated: true,
            priority: 1,
            estimatedTime: 10
          },
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry original delivery method',
            automated: true,
            priority: 2,
            estimatedTime: 30
          }
        ]
      case 'CONTEXT_UNAVAILABLE':
        return [
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Use default context for reminder delivery',
            automated: true,
            priority: 1
          }
        ]
      default:
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry reminder operation',
            automated: true,
            priority: 1,
            estimatedTime: 15
          }
        ]
    }
  }

  getSeverity(): ErrorSeverity {
    switch (this.code) {
      case 'DELIVERY_FAILED':
        return ErrorSeverity.MEDIUM
      case 'CONTEXT_UNAVAILABLE':
        return ErrorSeverity.LOW
      case 'REMINDER_QUEUE_OVERFLOW':
        return ErrorSeverity.HIGH
      default:
        return ErrorSeverity.MEDIUM
    }
  }
}

// Sync-specific errors
export class SyncError extends SchedulingError {
  constructor(
    message: string,
    code: string,
    options: {
      userId?: string
      connectionId?: string
      providerId?: string
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, 'Sync', options)
  }

  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case 'AUTHENTICATION_FAILED':
        return [
          {
            type: RecoveryActionType.MANUAL_INTERVENTION,
            description: 'Re-authenticate with calendar provider',
            automated: false,
            priority: 1,
            requiredPermissions: ['calendar:auth']
          }
        ]
      case 'RATE_LIMIT_EXCEEDED':
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry sync after rate limit reset',
            automated: true,
            priority: 1,
            estimatedTime: 3600 // 1 hour
          }
        ]
      case 'NETWORK_ERROR':
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry sync when network is available',
            automated: true,
            priority: 1,
            estimatedTime: 300 // 5 minutes
          },
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Continue with offline mode',
            automated: true,
            priority: 2
          }
        ]
      default:
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry sync operation',
            automated: true,
            priority: 1,
            estimatedTime: 60
          }
        ]
    }
  }

  getSeverity(): ErrorSeverity {
    switch (this.code) {
      case 'AUTHENTICATION_FAILED':
        return ErrorSeverity.HIGH
      case 'RATE_LIMIT_EXCEEDED':
        return ErrorSeverity.MEDIUM
      case 'NETWORK_ERROR':
        return ErrorSeverity.LOW
      case 'DATA_CORRUPTION':
        return ErrorSeverity.CRITICAL
      default:
        return ErrorSeverity.MEDIUM
    }
  }
}

// Family coordination errors
export class FamilyCoordinationError extends SchedulingError {
  constructor(
    message: string,
    code: string,
    options: {
      userId?: string
      familyId?: string
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, 'FamilyCoordination', options)
  }

  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case 'PERMISSION_DENIED':
        return [
          {
            type: RecoveryActionType.NOTIFICATION,
            description: 'Notify user of insufficient permissions',
            automated: true,
            priority: 1
          },
          {
            type: RecoveryActionType.ESCALATION,
            description: 'Request permission from family administrator',
            automated: true,
            priority: 2
          }
        ]
      case 'FAMILY_CONFLICT':
        return [
          {
            type: RecoveryActionType.MANUAL_INTERVENTION,
            description: 'Resolve family scheduling conflict',
            automated: false,
            priority: 1
          },
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Suggest alternative family meeting times',
            automated: true,
            priority: 2
          }
        ]
      default:
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry family coordination operation',
            automated: true,
            priority: 1,
            estimatedTime: 30
          }
        ]
    }
  }

  getSeverity(): ErrorSeverity {
    switch (this.code) {
      case 'PERMISSION_DENIED':
        return ErrorSeverity.MEDIUM
      case 'FAMILY_CONFLICT':
        return ErrorSeverity.MEDIUM
      default:
        return ErrorSeverity.LOW
    }
  }
}

// Performance-related errors
export class PerformanceError extends SchedulingError {
  constructor(
    message: string,
    code: string,
    options: {
      userId?: string
      metric?: string
      currentValue?: number
      threshold?: number
      recoverable?: boolean
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message, code, 'Performance', options)
  }

  getRecoveryActions(): RecoveryAction[] {
    switch (this.code) {
      case 'MEMORY_LIMIT_EXCEEDED':
        return [
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Reduce memory usage by clearing caches',
            automated: true,
            priority: 1,
            estimatedTime: 10
          },
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Disable non-essential features',
            automated: true,
            priority: 2
          }
        ]
      case 'PROCESSING_TIMEOUT':
        return [
          {
            type: RecoveryActionType.RETRY,
            description: 'Retry with increased timeout',
            automated: true,
            priority: 1,
            estimatedTime: 60
          },
          {
            type: RecoveryActionType.FALLBACK,
            description: 'Use simplified processing',
            automated: true,
            priority: 2
          }
        ]
      default:
        return [
          {
            type: RecoveryActionType.NOTIFICATION,
            description: 'Monitor performance metrics',
            automated: true,
            priority: 1
          }
        ]
    }
  }

  getSeverity(): ErrorSeverity {
    switch (this.code) {
      case 'MEMORY_LIMIT_EXCEEDED':
        return ErrorSeverity.HIGH
      case 'PROCESSING_TIMEOUT':
        return ErrorSeverity.MEDIUM
      default:
        return ErrorSeverity.LOW
    }
  }
}

// Error recovery manager
export interface ErrorRecoveryManager {
  handleError(error: SchedulingError): Promise<RecoveryResult>
  executeRecoveryAction(action: RecoveryAction, context: RecoveryContext): Promise<boolean>
  getErrorHistory(userId?: string, timeRange?: { start: Date; end: Date }): Promise<ErrorRecord[]>
  getRecoveryStatistics(): Promise<RecoveryStatistics>
}

export interface RecoveryResult {
  success: boolean
  actionsExecuted: RecoveryAction[]
  remainingActions: RecoveryAction[]
  errorResolved: boolean
  requiresManualIntervention: boolean
  nextRetryTime?: Date
}

export interface RecoveryContext {
  userId?: string
  component: string
  timestamp: Date
  systemState: Record<string, any>
  availableResources: string[]
}

export interface ErrorRecord {
  error: SchedulingError
  recoveryResult: RecoveryResult
  timestamp: Date
  resolved: boolean
  resolutionTime?: Date
}

export interface RecoveryStatistics {
  totalErrors: number
  resolvedErrors: number
  averageResolutionTime: number
  mostCommonErrors: Array<{ code: string; count: number }>
  recoverySuccessRate: number
  manualInterventionRate: number
}

// Utility functions for error handling
export function isRetryableError(error: SchedulingError): boolean {
  return error.retryable && error.recoverable
}

export function shouldEscalateError(error: SchedulingError): boolean {
  return error.getSeverity() === ErrorSeverity.HIGH || error.getSeverity() === ErrorSeverity.CRITICAL
}

export function getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay
  return Math.min(exponentialDelay + jitter, 300000) // Max 5 minutes
}

export function sanitizeErrorForLogging(error: SchedulingError): Record<string, any> {
  return {
    name: error.name,
    code: error.code,
    component: error.component,
    message: error.message,
    timestamp: error.timestamp,
    severity: error.getSeverity(),
    recoverable: error.recoverable,
    retryable: error.retryable,
    // Exclude sensitive data like userId from logs
    hasSensitiveData: !!error.userId
  }
}