/**
 * Content safety and validation interfaces
 * Safety: Allowlist-only approach - block by default, approve explicitly
 * All user-facing content MUST pass validateChildSafeContent() validation
 */

import { EventEmitter } from 'events';

// Content safety filtering
export interface ContentSafetyFilter extends EventEmitter {
  validateInput(text: string, userId: string): Promise<SafetyResult>;
  validateOutput(text: string, userId: string): Promise<SafetyResult>;
  updateFilterRules(rules: SafetyRules): void;
  getAuditLog(timeRange: TimeRange): Promise<SafetyAuditEntry[]>;
  validateChildSafeContent(content: string, ageGroup: AgeGroup): Promise<boolean>;
}

export interface SafetyResult {
  isAllowed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  blockedReasons: string[];
  sanitizedText?: string;
  confidence: number;
  processingTime: number;
}

export interface SafetyRules {
  profanityFilter: {
    enabled: boolean;
    strictness: 'low' | 'medium' | 'high';
    customWords: string[];
    allowedExceptions: string[];
  };
  topicFilter: {
    enabled: boolean;
    blockedTopics: string[];
    ageRestrictedTopics: Record<AgeGroup, string[]>;
    contextualRules: ContextualRule[];
  };
  behaviorFilter: {
    enabled: boolean;
    blockedBehaviors: string[];
    harmfulInstructions: string[];
    manipulativeContent: string[];
  };
}

export interface ContextualRule {
  pattern: string;
  context: string[];
  action: 'block' | 'warn' | 'sanitize';
  ageGroups: AgeGroup[];
}

export type AgeGroup = 'child' | 'teen' | 'adult';

// Safety audit and logging
export interface SafetyAuditLogger extends EventEmitter {
  logSafetyEvent(event: SafetyAuditEntry): Promise<void>;
  getAuditHistory(filters: AuditFilters): Promise<SafetyAuditEntry[]>;
  generateReport(timeRange: TimeRange, userId?: string): Promise<SafetyReport>;
  purgeOldLogs(olderThan: Date): Promise<number>;
}

export interface SafetyAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  eventType: 'input_validation' | 'input_blocked' | 'output_sanitized' | 'content_blocked' | 'content_sanitized' | 'rule_violation' | 'parental_override';
  originalContent: string;
  processedContent?: string;
  riskLevel: 'low' | 'medium' | 'high';
  blockedReasons: string[];
  parentalReview: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

export interface AuditFilters {
  userId?: string;
  eventType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  timeRange: TimeRange;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface SafetyReport {
  timeRange: TimeRange;
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByRisk: Record<string, number>;
  topBlockedReasons: Array<{ reason: string; count: number }>;
  userActivity: Array<{ userId: string; eventCount: number }>;
  pendingReviews: number;
}

// Parental controls
export interface ParentalControlManager extends EventEmitter {
  setUserSafetyLevel(userId: string, level: AgeGroup): Promise<void>;
  getUserSafetyLevel(userId: string): Promise<AgeGroup>;
  requestParentalApproval(content: string, userId: string): Promise<string>;
  processParentalDecision(requestId: string, approved: boolean, reason?: string): Promise<void>;
  getParentalOverrides(userId: string): Promise<ParentalOverride[]>;
  createSafetyException(pattern: string, userId: string, reason: string): Promise<void>;
}

export interface ParentalOverride {
  id: string;
  userId: string;
  pattern: string;
  approved: boolean;
  reason: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
}

// Safety validation engine
export interface SafetyValidator extends EventEmitter {
  validateContent(content: string, context: ValidationContext): Promise<ValidationResult>;
  updateValidationRules(rules: ValidationRules): void;
  trainCustomFilter(examples: TrainingExample[]): Promise<void>;
  getValidationMetrics(): ValidationMetrics;
}

export interface ValidationContext {
  userId: string;
  ageGroup: AgeGroup;
  contentType: 'voice_input' | 'text_output' | 'command' | 'response';
  conversationHistory?: string[];
  parentalSettings: ParentalSettings;
}

export interface ValidationResult {
  isValid: boolean;
  violations: SafetyViolation[];
  suggestedAlternatives?: string[];
  requiresParentalReview: boolean;
  confidence: number;
}

export interface SafetyViolation {
  type: 'profanity' | 'inappropriate_topic' | 'harmful_instruction' | 'age_inappropriate';
  severity: 'low' | 'medium' | 'high';
  description: string;
  position?: { start: number; end: number };
}

export interface ValidationRules {
  allowlistMode: boolean;
  approvedPhrases: string[];
  blockedPhrases: string[];
  ageSpecificRules: Record<AgeGroup, AgeSpecificRules>;
  contextualValidation: boolean;
}

export interface AgeSpecificRules {
  maxComplexity: number;
  allowedTopics: string[];
  blockedTopics: string[];
  vocabularyLevel: 'simple' | 'intermediate' | 'advanced';
  requiresSupervision: boolean;
}

export interface TrainingExample {
  content: string;
  isAppropriate: boolean;
  ageGroup: AgeGroup;
  category: string;
  explanation?: string;
}

export interface ValidationMetrics {
  totalValidations: number;
  blockedContent: number;
  falsePositives: number;
  falseNegatives: number;
  averageProcessingTime: number;
  accuracyByAgeGroup: Record<AgeGroup, number>;
}

export interface ParentalSettings {
  strictMode: boolean;
  allowedHours: TimeSlot[];
  contentRestrictions: string[];
  supervisionRequired: boolean;
  notificationPreferences: NotificationPreferences;
}

export interface TimeSlot {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  days: number[]; // 0-6, Sunday = 0
}

export interface NotificationPreferences {
  emailAlerts: boolean;
  pushNotifications: boolean;
  weeklyReports: boolean;
  immediateAlerts: string[]; // Event types requiring immediate notification
}