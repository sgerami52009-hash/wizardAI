/**
 * Privacy and Security Management Module
 * Exports all privacy-related components for the recommendations engine
 */

export { PrivacyManager } from './privacy-manager';
export { 
  DataMinimizer, 
  RetentionPolicyManager, 
  ConsentManager, 
  PrivacyPreservingAnalytics 
} from './data-protection';
export { 
  EncryptionService, 
  SecureDataProcessor, 
  AuditLogger 
} from './secure-data-handling';

// Re-export privacy-related types and interfaces
export type {
  PrivacyDecision,
  DataOperation,
  AnonymizedData,
  DataUsageAudit,
  PrivacySettings,
  ValidationResult,
  DataOperationLog,
  DataRestriction
} from '../types';

export { PrivacyLevel } from '../enums';