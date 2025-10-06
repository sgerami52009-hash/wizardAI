// Privacy Module Types

import { 
  TimeOfDay, 
  DayOfWeek, 
  LocationContext, 
  DeviceType, 
  EnvironmentalContext,
  PatternType,
  PatternContext,
  IssueSeverity
} from '../learning/types';

export interface PrivacyFilter {
  filterInteraction(interaction: UserInteraction): Promise<FilteredInteraction>;
  validatePrivacyCompliance(data: any, userId: string): Promise<PrivacyValidationResult>;
  configurePrivacyLevel(userId: string, level: PrivacyLevel): Promise<void>;
  generatePrivacyReport(userId: string): Promise<PrivacyReport>;
  anonymizeData(data: any): Promise<AnonymizedData>;
}

export interface UserInteraction {
  userId: string;
  sessionId: string;
  timestamp: Date;
  source: InteractionSource;
  type: InteractionType;
  context: InteractionContext;
  patterns: BehaviorPattern[];
  outcome: InteractionOutcome;
  // Note: No raw content stored, only extracted patterns
}

export interface FilteredInteraction {
  userId: string; // Hashed identifier
  patterns: AnonymizedPattern[];
  context: FilteredContext;
  metadata: InteractionMetadata;
  privacyLevel: PrivacyLevel;
}

export interface PrivacyValidationResult {
  isCompliant: boolean;
  violations: PrivacyViolation[];
  recommendations: PrivacyRecommendation[];
  riskLevel: RiskLevel;
}

export interface PrivacyReport {
  userId: string;
  generatedAt: Date;
  dataTypes: DataTypeUsage[];
  retentionPolicies: RetentionPolicy[];
  sharingActivities: SharingActivity[];
  userRights: UserRight[];
  complianceStatus: ComplianceStatus;
}

export interface AnonymizedData {
  dataId: string;
  anonymizedAt: Date;
  technique: AnonymizationTechnique;
  privacyLevel: PrivacyLevel;
  retainedPatterns: string[];
  removedElements: string[];
}

export interface InteractionContext {
  timeOfDay: TimeOfDay;
  dayOfWeek: DayOfWeek;
  location: LocationContext;
  deviceType: DeviceType;
  previousInteractions: PatternSummary[];
  environmentalFactors: EnvironmentalContext;
}

export interface BehaviorPattern {
  patternId: string;
  type: PatternType;
  strength: number;
  frequency: number;
  context: PatternContext;
  isAnonymized: boolean;
}

export interface InteractionOutcome {
  success: boolean;
  userSatisfaction: number;
  completionTime: number;
  followUpRequired: boolean;
  errorOccurred: boolean;
}

export interface AnonymizedPattern {
  patternHash: string;
  type: PatternType;
  strength: number;
  frequency: number;
  contextHash: string;
  anonymizationLevel: AnonymizationLevel;
}

export interface FilteredContext {
  temporalHash: string;
  locationHash: string;
  deviceTypeHash: string;
  environmentalHash: string;
  privacyLevel: PrivacyLevel;
}

export interface InteractionMetadata {
  processingTime: number;
  privacyFiltersApplied: string[];
  dataRetentionDays: number;
  complianceFlags: ComplianceFlag[];
  piiDetectionStages?: string[];
  noiseLevel?: number;
}

export interface PrivacyViolation {
  violationType: ViolationType;
  severity: ViolationSeverity;
  description: string;
  affectedData: string[];
  recommendedAction: string;
  detectedAt: Date;
}

export interface PrivacyRecommendation {
  type: RecommendationType;
  priority: RecommendationPriority;
  description: string;
  implementation: string;
  impact: PrivacyImpact;
}

export interface DataTypeUsage {
  dataType: DataType;
  purpose: DataPurpose;
  retentionDays: number;
  sharingScope: SharingScope;
  lastAccessed: Date;
}

export interface RetentionPolicy {
  dataType: DataType;
  retentionDays: number;
  autoDelete: boolean;
  archiveBeforeDelete: boolean;
  userNotification: boolean;
}

export interface SharingActivity {
  recipient: string;
  dataTypes: DataType[];
  purpose: string;
  consentGiven: boolean;
  sharingDate: Date;
  expirationDate?: Date;
}

export interface UserRight {
  rightType: UserRightType;
  isAvailable: boolean;
  description: string;
  exerciseMethod: string;
  responseTime: string;
}

export interface ComplianceStatus {
  regulation: PrivacyRegulation;
  isCompliant: boolean;
  lastAudit: Date;
  issues: ComplianceIssue[];
  certifications: string[];
}

export interface PatternSummary {
  patternCount: number;
  dominantTypes: PatternType[];
  averageStrength: number;
  timeRange: TimeRange;
}

export interface TimeRange {
  start: Date;
  end: Date;
  duration: number;
}

export interface ComplianceFlag {
  regulation: PrivacyRegulation;
  requirement: string;
  status: ComplianceStatus;
  lastChecked: Date;
}

export interface ComplianceIssue {
  issueType: ComplianceIssueType;
  severity: IssueSeverity;
  description: string;
  remediation: string;
  deadline?: Date;
}

export interface PrivacyImpact {
  userExperience: ImpactLevel;
  dataUtility: ImpactLevel;
  systemPerformance: ImpactLevel;
  complianceRisk: RiskLevel;
}

export enum InteractionSource {
  VOICE = 'voice',
  UI = 'ui',
  SCHEDULING = 'scheduling',
  SMART_HOME = 'smart_home',
  AVATAR = 'avatar',
  SYSTEM = 'system'
}

export enum InteractionType {
  CONVERSATION = 'conversation',
  COMMAND = 'command',
  QUERY = 'query',
  SCHEDULING = 'scheduling',
  PREFERENCE = 'preference',
  FEEDBACK = 'feedback'
}

export enum PrivacyLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  ENHANCED = 'enhanced',
  MAXIMUM = 'maximum'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AnonymizationTechnique {
  HASHING = 'hashing',
  TOKENIZATION = 'tokenization',
  DIFFERENTIAL_PRIVACY = 'differential_privacy',
  K_ANONYMITY = 'k_anonymity',
  PATTERN_EXTRACTION = 'pattern_extraction'
}

export enum AnonymizationLevel {
  LIGHT = 'light',
  MODERATE = 'moderate',
  STRONG = 'strong',
  COMPLETE = 'complete'
}

export enum ViolationType {
  PII_EXPOSURE = 'pii_exposure',
  POTENTIAL_PII_EXPOSURE = 'potential_pii_exposure',
  PRIVACY_LEVEL_VIOLATION = 'privacy_level_violation',
  DIFFERENTIAL_PRIVACY_VIOLATION = 'differential_privacy_violation',
  CONSENT_VIOLATION = 'consent_violation',
  RETENTION_VIOLATION = 'retention_violation',
  SHARING_VIOLATION = 'sharing_violation',
  ACCESS_VIOLATION = 'access_violation'
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecommendationType {
  POLICY_UPDATE = 'policy_update',
  TECHNICAL_CONTROL = 'technical_control',
  PROCESS_IMPROVEMENT = 'process_improvement',
  USER_EDUCATION = 'user_education',
  COMPLIANCE_ACTION = 'compliance_action'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum DataType {
  INTERACTION_PATTERNS = 'interaction_patterns',
  BEHAVIORAL_DATA = 'behavioral_data',
  PREFERENCE_DATA = 'preference_data',
  CONTEXTUAL_DATA = 'contextual_data',
  USAGE_ANALYTICS = 'usage_analytics',
  PERFORMANCE_METRICS = 'performance_metrics'
}

export enum DataPurpose {
  PERSONALIZATION = 'personalization',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  SAFETY_MONITORING = 'safety_monitoring',
  ANALYTICS = 'analytics',
  SYSTEM_IMPROVEMENT = 'system_improvement'
}

export enum SharingScope {
  NONE = 'none',
  INTERNAL = 'internal',
  THIRD_PARTY = 'third_party',
  PUBLIC = 'public'
}

export enum UserRightType {
  ACCESS = 'access',
  RECTIFICATION = 'rectification',
  ERASURE = 'erasure',
  PORTABILITY = 'portability',
  OBJECTION = 'objection',
  RESTRICTION = 'restriction'
}

export enum PrivacyRegulation {
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  COPPA = 'coppa',
  PIPEDA = 'pipeda',
  LGPD = 'lgpd'
}

export enum ComplianceIssueType {
  MISSING_CONSENT = 'missing_consent',
  EXCESSIVE_RETENTION = 'excessive_retention',
  UNAUTHORIZED_SHARING = 'unauthorized_sharing',
  INADEQUATE_SECURITY = 'inadequate_security',
  MISSING_DOCUMENTATION = 'missing_documentation'
}

export enum ImpactLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  SEVERE = 'severe'
}