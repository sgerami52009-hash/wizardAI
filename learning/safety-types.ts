// Child Safety and Parental Control Types

import { AgeGroup, FamilyRelationship } from './types';
import { PrivacyLevel, RiskLevel } from '../privacy/types';

export interface SafetyValidator {
  validateLearningContent(content: LearningContent, userId: string): Promise<SafetyValidationResult>;
  validateLearningAdaptation(adaptation: LearningAdaptation, userId: string): Promise<SafetyValidationResult>;
  requiresParentalApproval(adaptation: LearningAdaptation, userId: string): Promise<boolean>;
  logSafetyDecision(decision: SafetyDecision): Promise<void>;
  generateSafetyAuditLog(userId: string, timeRange: TimeRange): Promise<SafetyAuditLog>;
  validateChildSafeContent(content: string): Promise<ContentSafetyResult>;
}

export interface ParentalControlManager {
  configureLearningBoundaries(childId: string, boundaries: LearningBoundaries): Promise<void>;
  requestParentalApproval(request: ParentalApprovalRequest): Promise<ApprovalResult>;
  modifyLearningBehavior(childId: string, modification: BehaviorModification): Promise<void>;
  resetChildLearning(childId: string, resetScope: ResetScope): Promise<void>;
  generatePrivacyReport(familyId: string): Promise<FamilyPrivacyReport>;
  getLearningOversight(childId: string): Promise<LearningOversight>;
}

export interface LearningContent {
  contentId: string;
  type: ContentType;
  source: ContentSource;
  text?: string;
  patterns?: string[];
  context: ContentContext;
  targetAgeGroup: AgeGroup;
  safetyLevel: SafetyLevel;
}

export interface LearningAdaptation {
  adaptationId: string;
  userId: string;
  type: AdaptationType;
  description: string;
  impact: AdaptationImpact;
  confidence: number;
  proposedChanges: ProposedChange[];
  riskAssessment: RiskAssessment;
}

export interface SafetyValidationResult {
  isApproved: boolean;
  safetyLevel: SafetyLevel;
  violations: SafetyViolation[];
  recommendations: SafetyRecommendation[];
  requiresParentalApproval: boolean;
  auditTrail: AuditEntry[];
}

export interface SafetyDecision {
  decisionId: string;
  userId: string;
  timestamp: Date;
  decisionType: SafetyDecisionType;
  content: LearningContent | LearningAdaptation;
  result: SafetyValidationResult;
  parentalApprovalRequired: boolean;
  parentalApprovalReceived?: boolean;
  approvalTimestamp?: Date;
  approverUserId?: string;
}

export interface SafetyAuditLog {
  userId: string;
  generatedAt: Date;
  timeRange: TimeRange;
  totalDecisions: number;
  approvedDecisions: number;
  rejectedDecisions: number;
  parentalApprovalsRequired: number;
  parentalApprovalsReceived: number;
  safetyViolations: SafetyViolation[];
  decisions: SafetyDecision[];
}

export interface ContentSafetyResult {
  isSafe: boolean;
  safetyScore: number;
  detectedIssues: ContentIssue[];
  ageAppropriate: AgeAppropriatenessResult;
  recommendations: string[];
}

export interface LearningBoundaries {
  childId: string;
  ageGroup: AgeGroup;
  allowedContentTypes: ContentType[];
  blockedTopics: string[];
  maxLearningAdaptations: number;
  requireApprovalThreshold: number;
  privacyLevel: PrivacyLevel;
  learningRestrictions: LearningRestriction[];
}

export interface ParentalApprovalRequest {
  requestId: string;
  childId: string;
  parentId: string;
  timestamp: Date;
  adaptation: LearningAdaptation;
  justification: string;
  urgency: ApprovalUrgency;
  expiresAt: Date;
}

export interface ApprovalResult {
  requestId: string;
  approved: boolean;
  approverUserId: string;
  approvalTimestamp: Date;
  conditions?: ApprovalCondition[];
  feedback?: string;
  expiresAt?: Date;
}

export interface BehaviorModification {
  modificationId: string;
  type: ModificationType;
  targetBehavior: string;
  newBehavior: string;
  reason: string;
  effectiveDate: Date;
  expirationDate?: Date;
}

export interface FamilyPrivacyReport {
  familyId: string;
  generatedAt: Date;
  children: ChildPrivacySummary[];
  dataUsage: FamilyDataUsage;
  learningActivities: LearningActivitySummary[];
  safetyMetrics: FamilySafetyMetrics;
  recommendations: PrivacyRecommendation[];
}

export interface LearningOversight {
  childId: string;
  currentBoundaries: LearningBoundaries;
  recentAdaptations: LearningAdaptation[];
  pendingApprovals: ParentalApprovalRequest[];
  safetyMetrics: ChildSafetyMetrics;
  learningProgress: ChildLearningProgress;
}

export interface ContentContext {
  source: ContentSource;
  timestamp: Date;
  userAge: number;
  parentalControlsActive: boolean;
  supervisionLevel: SupervisionLevel;
  contentRating?: ContentRating;
}

export interface AdaptationImpact {
  behaviorChange: BehaviorChangeLevel;
  personalityAdjustment: PersonalityAdjustmentLevel;
  responseModification: ResponseModificationLevel;
  learningScope: LearningScope;
  reversibility: ReversibilityLevel;
}

export interface ProposedChange {
  changeType: ChangeType;
  description: string;
  beforeValue: string;
  afterValue: string;
  confidence: number;
  impact: ChangeImpact;
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  privacyRisk: RiskLevel;
  safetyRisk: RiskLevel;
  developmentalRisk: RiskLevel;
  mitigationStrategies: string[];
}

export interface SafetyViolation {
  violationId: string;
  type: SafetyViolationType;
  severity: ViolationSeverity;
  description: string;
  detectedContent: string;
  ageGroup: AgeGroup;
  recommendedAction: string;
  timestamp: Date;
}

export interface SafetyRecommendation {
  type: SafetyRecommendationType;
  priority: RecommendationPriority;
  description: string;
  implementation: string;
  targetAgeGroup?: AgeGroup;
}

export interface AuditEntry {
  entryId: string;
  timestamp: Date;
  action: AuditAction;
  userId: string;
  details: string;
  result: string;
}

export interface ContentIssue {
  issueType: ContentIssueType;
  severity: IssueSeverity;
  description: string;
  location: string;
  suggestion: string;
}

export interface AgeAppropriatenessResult {
  isAppropriate: boolean;
  recommendedMinAge: number;
  recommendedMaxAge: number;
  concerns: string[];
  alternatives?: string[];
}

export interface LearningRestriction {
  restrictionType: RestrictionType;
  description: string;
  isActive: boolean;
  exceptions: string[];
  effectiveDate: Date;
  expirationDate?: Date;
}

export interface ApprovalCondition {
  conditionType: ConditionType;
  description: string;
  requirement: string;
  isRequired: boolean;
}

export interface ChildPrivacySummary {
  childId: string;
  ageGroup: AgeGroup;
  dataCollected: DataCollectionSummary;
  learningActivities: number;
  parentalApprovals: number;
  safetyViolations: number;
  privacyLevel: PrivacyLevel;
}

export interface FamilyDataUsage {
  totalDataPoints: number;
  dataByType: Record<string, number>;
  retentionPolicies: RetentionPolicySummary[];
  sharingActivities: number;
  deletionRequests: number;
}

export interface LearningActivitySummary {
  childId: string;
  activityType: ActivityType;
  frequency: number;
  lastActivity: Date;
  safetyScore: number;
  parentalOversight: boolean;
}

export interface FamilySafetyMetrics {
  totalSafetyChecks: number;
  safetyViolations: number;
  parentalInterventions: number;
  averageSafetyScore: number;
  complianceRate: number;
}

export interface ChildSafetyMetrics {
  safetyScore: number;
  violationCount: number;
  lastViolation?: Date;
  parentalInterventions: number;
  complianceRate: number;
  riskLevel: RiskLevel;
}

export interface ChildLearningProgress {
  adaptationsApplied: number;
  adaptationsRejected: number;
  learningEffectiveness: number;
  behaviorImprovements: string[];
  parentalFeedback: ParentalFeedback[];
}

export interface ParentalFeedback {
  feedbackId: string;
  parentId: string;
  timestamp: Date;
  rating: number;
  comments: string;
  concerns: string[];
  suggestions: string[];
}

export interface DataCollectionSummary {
  interactionCount: number;
  patternCount: number;
  lastCollection: Date;
  dataTypes: string[];
  privacyFiltersApplied: number;
}

export interface RetentionPolicySummary {
  dataType: string;
  retentionDays: number;
  itemCount: number;
  nextDeletion: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PrivacyRecommendation {
  type: string;
  priority: RecommendationPriority;
  description: string;
  targetChild?: string;
}

// Enums
export enum ContentType {
  CONVERSATION = 'conversation',
  BEHAVIORAL_PATTERN = 'behavioral_pattern',
  PREFERENCE = 'preference',
  SCHEDULING = 'scheduling',
  INTERACTION = 'interaction',
  FEEDBACK = 'feedback'
}

export enum ContentSource {
  VOICE_INTERACTION = 'voice_interaction',
  UI_INTERACTION = 'ui_interaction',
  AVATAR_INTERACTION = 'avatar_interaction',
  SCHEDULING_SYSTEM = 'scheduling_system',
  SMART_HOME = 'smart_home',
  LEARNING_ENGINE = 'learning_engine'
}

export enum SafetyLevel {
  SAFE = 'safe',
  CAUTION = 'caution',
  WARNING = 'warning',
  BLOCKED = 'blocked'
}

export enum AdaptationType {
  PERSONALITY_ADJUSTMENT = 'personality_adjustment',
  RESPONSE_STYLE = 'response_style',
  CONTENT_PREFERENCE = 'content_preference',
  INTERACTION_PATTERN = 'interaction_pattern',
  SCHEDULING_BEHAVIOR = 'scheduling_behavior'
}

export enum SafetyDecisionType {
  CONTENT_VALIDATION = 'content_validation',
  ADAPTATION_APPROVAL = 'adaptation_approval',
  PARENTAL_OVERRIDE = 'parental_override',
  SAFETY_INTERVENTION = 'safety_intervention'
}

export enum ResetScope {
  ALL_LEARNING = 'all_learning',
  RECENT_ADAPTATIONS = 'recent_adaptations',
  SPECIFIC_BEHAVIOR = 'specific_behavior',
  SAFETY_VIOLATIONS = 'safety_violations'
}

export enum ApprovalUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  IMMEDIATE = 'immediate'
}

export enum ModificationType {
  BEHAVIOR_CORRECTION = 'behavior_correction',
  PREFERENCE_RESET = 'preference_reset',
  INTERACTION_LIMIT = 'interaction_limit',
  CONTENT_FILTER = 'content_filter'
}

export enum SupervisionLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  STRICT = 'strict',
  CONSTANT = 'constant'
}

export enum ContentRating {
  ALL_AGES = 'all_ages',
  CHILD_FRIENDLY = 'child_friendly',
  TEEN_APPROPRIATE = 'teen_appropriate',
  ADULT_SUPERVISION = 'adult_supervision',
  ADULT_ONLY = 'adult_only'
}

export enum BehaviorChangeLevel {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  MAJOR = 'major'
}

export enum PersonalityAdjustmentLevel {
  NONE = 'none',
  SUBTLE = 'subtle',
  NOTICEABLE = 'noticeable',
  SUBSTANTIAL = 'substantial'
}

export enum ResponseModificationLevel {
  NONE = 'none',
  MINOR = 'minor',
  MODERATE = 'moderate',
  EXTENSIVE = 'extensive'
}

export enum LearningScope {
  SINGLE_INTERACTION = 'single_interaction',
  SESSION_BASED = 'session_based',
  DAILY_PATTERN = 'daily_pattern',
  LONG_TERM_BEHAVIOR = 'long_term_behavior'
}

export enum ReversibilityLevel {
  FULLY_REVERSIBLE = 'fully_reversible',
  MOSTLY_REVERSIBLE = 'mostly_reversible',
  PARTIALLY_REVERSIBLE = 'partially_reversible',
  IRREVERSIBLE = 'irreversible'
}

export enum ChangeType {
  PARAMETER_ADJUSTMENT = 'parameter_adjustment',
  BEHAVIOR_MODIFICATION = 'behavior_modification',
  PREFERENCE_UPDATE = 'preference_update',
  RESPONSE_PATTERN = 'response_pattern'
}

export enum ChangeImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SafetyViolationType {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  AGE_INAPPROPRIATE = 'age_inappropriate',
  PRIVACY_VIOLATION = 'privacy_violation',
  BEHAVIORAL_CONCERN = 'behavioral_concern',
  PARENTAL_CONTROL_BYPASS = 'parental_control_bypass'
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SafetyRecommendationType {
  CONTENT_FILTER = 'content_filter',
  PARENTAL_NOTIFICATION = 'parental_notification',
  LEARNING_RESTRICTION = 'learning_restriction',
  BEHAVIOR_MODIFICATION = 'behavior_modification',
  SYSTEM_ADJUSTMENT = 'system_adjustment'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum AuditAction {
  CONTENT_VALIDATED = 'content_validated',
  ADAPTATION_APPROVED = 'adaptation_approved',
  ADAPTATION_REJECTED = 'adaptation_rejected',
  PARENTAL_APPROVAL_REQUESTED = 'parental_approval_requested',
  PARENTAL_APPROVAL_RECEIVED = 'parental_approval_received',
  SAFETY_VIOLATION_DETECTED = 'safety_violation_detected'
}

export enum ContentIssueType {
  INAPPROPRIATE_LANGUAGE = 'inappropriate_language',
  VIOLENT_CONTENT = 'violent_content',
  ADULT_THEMES = 'adult_themes',
  PRIVACY_CONCERN = 'privacy_concern',
  BEHAVIORAL_INFLUENCE = 'behavioral_influence'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RestrictionType {
  CONTENT_TYPE = 'content_type',
  TIME_BASED = 'time_based',
  INTERACTION_LIMIT = 'interaction_limit',
  LEARNING_RATE = 'learning_rate',
  ADAPTATION_SCOPE = 'adaptation_scope'
}

export enum ConditionType {
  TIME_LIMIT = 'time_limit',
  SUPERVISION_REQUIRED = 'supervision_required',
  CONTENT_REVIEW = 'content_review',
  BEHAVIOR_MONITORING = 'behavior_monitoring'
}

export enum ActivityType {
  VOICE_INTERACTION = 'voice_interaction',
  AVATAR_CUSTOMIZATION = 'avatar_customization',
  SCHEDULING_ACTIVITY = 'scheduling_activity',
  LEARNING_ADAPTATION = 'learning_adaptation',
  CONTENT_CONSUMPTION = 'content_consumption'
}