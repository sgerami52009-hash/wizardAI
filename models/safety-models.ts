/**
 * Safety and content validation data models
 * Safety: Comprehensive safety validation with audit trails
 * Performance: Efficient safety checks with minimal latency impact
 */

export interface SafetyRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  action: 'block' | 'warn' | 'sanitize' | 'flag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ageGroups: AgeGroup[];
  contexts: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyRuleSet {
  id: string;
  name: string;
  version: string;
  rules: SafetyRule[];
  ageGroupSettings: Record<AgeGroup, AgeGroupSafetySettings>;
  lastUpdated: Date;
  checksum: string;
}

export interface AgeGroupSafetySettings {
  strictMode: boolean;
  allowedTopics: string[];
  blockedTopics: string[];
  vocabularyLevel: 'simple' | 'intermediate' | 'advanced';
  maxComplexity: number;
  requiresSupervision: boolean;
  customRules: SafetyRule[];
}

export type AgeGroup = 'child' | 'teen' | 'adult';

export interface ContentAnalysisResult {
  content: string;
  isAppropriate: boolean;
  riskScore: number; // 0.0 to 1.0
  violations: SafetyViolation[];
  suggestedAlternatives: string[];
  processingTime: number;
  confidence: number;
}

export interface SafetyViolation {
  ruleId: string;
  type: 'profanity' | 'inappropriate_topic' | 'harmful_instruction' | 'age_inappropriate' | 'privacy_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  position?: TextPosition;
  context: string;
  suggestedAction: 'block' | 'sanitize' | 'warn' | 'review';
}

export interface TextPosition {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

export interface SafetyAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  sessionId: string;
  eventType: SafetyEventType;
  originalContent: string;
  processedContent?: string;
  violations: SafetyViolation[];
  action: SafetyAction;
  reviewStatus: ReviewStatus;
  parentalNotification: boolean;
  metadata: Record<string, any>;
}

export type SafetyEventType = 
  | 'input_validation'
  | 'output_validation'
  | 'content_blocked'
  | 'content_sanitized'
  | 'parental_override'
  | 'emergency_bypass';

export type SafetyAction = 
  | 'allowed'
  | 'blocked'
  | 'sanitized'
  | 'flagged'
  | 'escalated';

export type ReviewStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'auto_approved'
  | 'expired';

export interface ParentalReviewRequest {
  id: string;
  userId: string;
  childId: string;
  content: string;
  violations: SafetyViolation[];
  context: string;
  requestedAt: Date;
  expiresAt: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: ReviewStatus;
  parentResponse?: ParentalResponse;
}

export interface ParentalResponse {
  decision: 'approve' | 'reject' | 'modify';
  reason: string;
  modifications?: string;
  createException: boolean;
  exceptionDuration?: number; // hours
  respondedAt: Date;
  respondedBy: string;
}

export interface SafetyException {
  id: string;
  userId: string;
  pattern: string;
  reason: string;
  approvedBy: string;
  createdAt: Date;
  expiresAt?: Date;
  usageCount: number;
  maxUsage?: number;
  contexts: string[];
}

export interface SafetyMetrics {
  totalValidations: number;
  blockedContent: number;
  sanitizedContent: number;
  falsePositives: number;
  falseNegatives: number;
  averageProcessingTime: number;
  accuracyByAgeGroup: Record<AgeGroup, SafetyAccuracyMetrics>;
  violationsByType: Record<string, number>;
  parentalReviews: ParentalReviewMetrics;
}

export interface SafetyAccuracyMetrics {
  totalChecks: number;
  correctBlocks: number;
  incorrectBlocks: number;
  correctAllows: number;
  incorrectAllows: number;
  accuracy: number;
  precision: number;
  recall: number;
}

export interface ParentalReviewMetrics {
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingRequests: number;
  averageResponseTime: number;
  exceptionsCreated: number;
}

export interface SafetyReport {
  timeRange: { start: Date; end: Date };
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByRisk: Record<string, number>;
  topBlockedReasons: Array<{ reason: string; count: number }>;
  userActivity: Array<{ userId: string; eventCount: number }>;
  pendingReviews: number;
}

export interface SafetyConfiguration {
  globalSettings: GlobalSafetySettings;
  ageGroupSettings: Record<AgeGroup, AgeGroupSafetySettings>;
  customRules: SafetyRule[];
  parentalControls: ParentalControlConfiguration;
  auditSettings: AuditConfiguration;
}

export interface GlobalSafetySettings {
  enabled: boolean;
  strictMode: boolean;
  defaultAction: SafetyAction;
  allowParentalOverrides: boolean;
  requireParentalApproval: string[];
  emergencyBypassEnabled: boolean;
  logAllInteractions: boolean;
}

export interface ParentalControlConfiguration {
  enabled: boolean;
  requireApprovalFor: string[];
  notificationMethods: string[];
  reviewTimeout: number; // hours
  autoApproveAfterTimeout: boolean;
  allowChildExceptions: boolean;
}

export interface AuditConfiguration {
  enabled: boolean;
  retentionPeriod: number; // days
  logLevel: 'minimal' | 'standard' | 'detailed' | 'verbose';
  includeContent: boolean;
  encryptLogs: boolean;
  autoReporting: boolean;
}