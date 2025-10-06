/**
 * Error handling and recovery system for recommendations engine
 * Exports all error handling components and utilities
 */

// Error types and base classes
export {
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  RecommendationError,
  GenerationError,
  ContextError,
  LearningError,
  PrivacyError,
  IntegrationError,
  HardwareConstraintError
} from './error-types';

// Fallback strategies and recovery
export {
  FallbackStrategy,
  QualityLevel,
  FallbackRecommendations,
  RuleBasedFallbackStrategy,
  HistoricalFallbackStrategy,
  EmergencyFallbackStrategy,
  FallbackManager
} from './fallback-strategies';

// Context recovery mechanisms
export {
  ContextRecoveryStrategy,
  ContextRecovery,
  HistoricalContextRecovery,
  MultiSourceContextRecovery,
  ContextRecoveryManager
} from './context-recovery';

// Main error recovery manager
export {
  RecoveryResult,
  ErrorMetrics,
  ErrorRecoveryManager
} from './error-recovery-manager';

// Privacy violation detection and remediation
export {
  ViolationType,
  PrivacyViolation,
  RemediationAction,
  DataOperation,
  PrivacySettings,
  PrivacyViolationDetector
} from './privacy-violation-detector';

export {
  RemediationPlan,
  RemediationResult,
  IncidentReport,
  PrivacyRemediationManager
} from './privacy-remediation-manager';