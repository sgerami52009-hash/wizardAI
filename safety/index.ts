/**
 * Safety System - Content validation and parental controls
 * Safety: Comprehensive child-safe content filtering with audit trails
 * Performance: Optimized for real-time validation on Jetson Nano Orin
 */

// Export interfaces
export * from './interfaces';

// Export implementations
export { ContentSafetyFilterEngine } from './content-safety-filter';
export { SafetyAuditLoggerEngine } from './safety-audit-logger';
export { ParentalControlManagerEngine } from './parental-control-manager';
export { SafetyValidatorEngine } from './safety-validator';

// Export models
export * from '../models/safety-models';

/**
 * Main safety validation function - REQUIRED for all user-facing content
 * Safety: This function MUST be called before presenting any content to users
 */
export async function validateChildSafeContent(
  content: string, 
  ageGroup: 'child' | 'teen' | 'adult' = 'child'
): Promise<boolean> {
  const { SafetyValidatorEngine } = await import('./safety-validator');
  const { SafetyConfiguration } = await import('../models/safety-models');
  
  // Create default configuration for validation
  const defaultConfig: SafetyConfiguration = {
    globalSettings: {
      enabled: true,
      strictMode: true,
      defaultAction: 'blocked',
      allowParentalOverrides: true,
      requireParentalApproval: ['high_risk_content'],
      emergencyBypassEnabled: false,
      logAllInteractions: true
    },
    ageGroupSettings: {
      child: {
        strictMode: true,
        allowedTopics: ['education', 'games', 'family'],
        blockedTopics: ['violence', 'adult_content', 'scary_content'],
        vocabularyLevel: 'simple',
        maxComplexity: 30,
        requiresSupervision: true,
        customRules: []
      },
      teen: {
        strictMode: false,
        allowedTopics: ['education', 'games', 'family', 'technology', 'sports'],
        blockedTopics: ['adult_content', 'extreme_violence'],
        vocabularyLevel: 'intermediate',
        maxComplexity: 60,
        requiresSupervision: false,
        customRules: []
      },
      adult: {
        strictMode: false,
        allowedTopics: [],
        blockedTopics: ['illegal_content'],
        vocabularyLevel: 'advanced',
        maxComplexity: 100,
        requiresSupervision: false,
        customRules: []
      }
    },
    customRules: [],
    parentalControls: {
      enabled: true,
      requireApprovalFor: ['blocked_content'],
      notificationMethods: ['push'],
      reviewTimeout: 24,
      autoApproveAfterTimeout: false,
      allowChildExceptions: false
    },
    auditSettings: {
      enabled: true,
      retentionPeriod: 30,
      logLevel: 'standard',
      includeContent: false,
      encryptLogs: true,
      autoReporting: true
    }
  };

  const validator = new SafetyValidatorEngine(defaultConfig);
  return await validator.validateChildSafeContent(content, ageGroup);
}

/**
 * Sanitize content for safe display
 * Safety: Removes or replaces inappropriate content with safe alternatives
 */
export function sanitizeForLog(content: string): string {
  // Remove potential PII and sensitive information
  return content
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE]')
    .substring(0, 200); // Limit length for logging
}