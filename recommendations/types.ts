/**
 * Core type definitions for the personalized recommendations engine
 */

import { types } from 'util';
import { 
  RecommendationType, 
  InteractionType, 
  InterestCategory, 
  ActivityCategory,
  DifficultyLevel,
  PrivacyLevel,
  OptimizationType,
  Subject,
  SkillLevel,
  InteractivityLevel,
  EngagementLevel,
  SafetyLevel,
  ContextSource,
  ModelType,
  ErrorSeverity
} from './enums';

// Base recommendation structure
export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  confidence: number; // 0-1 scale
  reasoning: string[];
  actionable: boolean;
  integrationActions: IntegrationAction[];
  expiresAt: Date;
  metadata: RecommendationMetadata;
}

export interface RecommendationMetadata {
  generatedAt: Date;
  userId: string;
  contextId: string;
  engineVersion: string;
  safetyValidated: boolean;
  privacyCompliant: boolean;
}

export interface IntegrationAction {
  system: string; // 'voice', 'avatar', 'scheduling', 'smart-home'
  action: string;
  parameters: Record<string, any>;
}

// User context and preferences
export interface UserContext {
  userId: string;
  timestamp: Date;
  location: LocationContext;
  activity: ActivityContext;
  availability: AvailabilityContext;
  mood: MoodContext;
  energy: EnergyLevel;
  social: SocialContext;
  environmental: EnvironmentalContext;
  preferences: ContextualPreferences;
}

export interface LocationContext {
  type: 'home' | 'work' | 'school' | 'outdoor' | 'travel' | 'unknown';
  coordinates?: { lat: number; lng: number };
  weather?: WeatherCondition;
  indoorOutdoor: 'indoor' | 'outdoor' | 'mixed';
}

export interface ActivityContext {
  currentActivity?: string;
  activityType?: ActivityCategory;
  startTime?: Date;
  estimatedEndTime?: Date;
  interruptible: boolean;
}

export interface AvailabilityContext {
  freeTime: TimeRange[];
  busyTime: TimeRange[];
  flexibleTime: TimeRange[];
  energyLevel: EnergyLevel;
}

export interface MoodContext {
  detected?: 'happy' | 'sad' | 'excited' | 'calm' | 'stressed' | 'tired';
  confidence: number;
  source: 'voice' | 'interaction' | 'schedule' | 'inferred';
}

export interface EnergyLevel {
  level: 'high' | 'medium' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
  predictedPeak?: Date;
}

export interface SocialContext {
  familyMembersPresent: string[];
  socialSetting: 'alone' | 'family' | 'friends' | 'public';
  groupActivity: boolean;
}

export interface EnvironmentalContext {
  weather: WeatherCondition;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  season: 'spring' | 'summer' | 'fall' | 'winter';
  dayOfWeek: string;
  isHoliday: boolean;
}

export interface ContextualPreferences {
  preferredActivities: ActivityCategory[];
  avoidedActivities: ActivityCategory[];
  timePreferences: TimePreference[];
  socialPreferences: SocialPreference;
}

// User preferences and profiles
export interface UserPreferences {
  userId: string;
  interests: Interest[];
  activityPreferences: ActivityPreferences;
  schedulePreferences: SchedulePreferences;
  learningPreferences: LearningPreferences;
  privacyPreferences: PrivacyPreferences;
  notificationPreferences: NotificationPreferences;
  lastUpdated: Date;
}

export interface Interest {
  category: InterestCategory;
  subcategory: string;
  strength: number; // 0-1 scale
  recency: Date;
  source: 'explicit' | 'inferred' | 'social';
}

export interface ActivityPreferences {
  preferredCategories: ActivityCategory[];
  preferredDifficulty: DifficultyLevel;
  preferredDuration: TimeRange;
  indoorOutdoorPreference: 'indoor' | 'outdoor' | 'both';
  socialPreference: 'solo' | 'group' | 'both';
  physicalActivityLevel: 'low' | 'medium' | 'high';
}

export interface SchedulePreferences {
  preferredWakeTime: string; // HH:MM format
  preferredBedTime: string;
  workingHours: TimeRange[];
  breakPreferences: BreakPreference[];
  flexibilityLevel: 'rigid' | 'moderate' | 'flexible';
}

export interface LearningPreferences {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  preferredSubjects: Subject[];
  difficultyPreference: 'challenging' | 'moderate' | 'easy';
  sessionDuration: number; // minutes
  gamificationLevel: 'high' | 'medium' | 'low' | 'none';
}

export interface PrivacyPreferences {
  dataSharing: PrivacyLevel;
  locationTracking: boolean;
  behaviorAnalysis: boolean;
  familyDataSharing: boolean;
  externalIntegrations: boolean;
  dataRetentionDays: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  quietHours: TimeRange[];
  urgencyThreshold: 'low' | 'medium' | 'high';
  channels: ('voice' | 'visual' | 'avatar')[];
}

// Time and scheduling types
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  flexibility: number; // 0-1 scale
  conflicts: string[];
}

export interface TimePreference {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  preference: 'preferred' | 'acceptable' | 'avoided';
}

export interface BreakPreference {
  duration: number; // minutes
  frequency: number; // per day
  preferredTimes: string[]; // HH:MM format
}

export interface SocialPreference {
  familyTime: 'high' | 'medium' | 'low';
  aloneTime: 'high' | 'medium' | 'low';
  groupActivities: 'preferred' | 'acceptable' | 'avoided';
}

// Weather and environmental types
export interface WeatherCondition {
  temperature: number; // Celsius
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy';
  humidity: number; // percentage
  windSpeed: number; // km/h
  uvIndex: number;
}

export interface WeatherRequirement {
  indoor: boolean;
  outdoor: boolean;
  weatherDependent: boolean;
  preferredConditions?: string[];
  avoidedConditions?: string[];
}

// Feedback and learning types
export interface UserFeedback {
  recommendationId: string;
  userId: string;
  rating: number; // 1-5 scale
  accepted: boolean;
  completed?: boolean;
  feedback?: string;
  timestamp: Date;
  context: UserContext;
}

export interface UserInteraction {
  userId: string;
  recommendationId: string;
  interactionType: InteractionType;
  timestamp: Date;
  context: UserContext;
  outcome: InteractionOutcome;
  feedback?: UserFeedback;
  satisfaction: number; // 0-1 scale
}

export interface InteractionOutcome {
  successful: boolean;
  completionRate: number; // 0-1 scale
  timeSpent: number; // minutes
  engagementLevel: 'high' | 'medium' | 'low';
  wouldRecommendAgain: boolean;
}

// Family and multi-user types
export interface FamilyContext {
  familyId: string;
  membersPresent: string[];
  sharedPreferences: UserPreferences;
  conflictingPreferences: PreferenceConflict[];
  groupDynamics: GroupDynamics;
}

export interface PreferenceConflict {
  users: string[];
  conflictType: 'activity' | 'time' | 'location' | 'difficulty';
  severity: 'low' | 'medium' | 'high';
  resolutionStrategy: string;
}

export interface GroupDynamics {
  leadershipStyle: 'democratic' | 'authoritative' | 'collaborative';
  decisionMaking: 'consensus' | 'majority' | 'leader-decides';
  conflictResolution: 'discussion' | 'compromise' | 'rotation';
}

// Resource and constraint types
export interface Resource {
  type: 'material' | 'digital' | 'location' | 'person' | 'time';
  name: string;
  required: boolean;
  alternatives?: string[];
  cost?: number;
  availability?: AvailabilityWindow[];
}

export interface AvailabilityWindow {
  start: Date;
  end: Date;
  probability: number; // 0-1 scale
}

export interface RecommendationConstraints {
  timeAvailable: TimeRange;
  locationConstraints: LocationConstraint[];
  resourceConstraints: ResourceConstraint[];
  socialConstraints: SocialConstraint[];
  budgetConstraints: BudgetConstraint;
  safetyConstraints: SafetyConstraint[];
}

export interface LocationConstraint {
  type: 'required' | 'preferred' | 'avoided';
  location: string;
  radius?: number; // meters
}

export interface ResourceConstraint {
  resourceType: string;
  availability: 'available' | 'limited' | 'unavailable';
  quantity?: number;
}

export interface SocialConstraint {
  minParticipants?: number;
  maxParticipants?: number;
  requiredParticipants?: string[];
  excludedParticipants?: string[];
}

export interface BudgetConstraint {
  maxCost: number;
  currency: string;
  category?: 'entertainment' | 'education' | 'household' | 'health';
}

export interface SafetyConstraint {
  ageRestrictions: AgeRange;
  supervisionRequired: boolean;
  safetyLevel: 'low' | 'medium' | 'high';
  parentalApprovalRequired: boolean;
}

export interface AgeRange {
  min: number;
  max: number;
}

// Performance and system types
export interface PerformanceConstraints {
  maxMemoryMB: number;
  maxLatencyMs: number;
  maxConcurrentUsers: number;
  offlineCapable: boolean;
}

export interface SystemMetrics {
  timestamp: Date;
  latency: {
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    count: number;
  };
  memory: {
    current: number;
    average: number;
    peak: number;
    threshold: number;
    utilizationPercent: number;
  };
  cpu: {
    current: number;
    average: number;
    peak: number;
    threshold: number;
  };
  userSatisfaction: {
    average: number;
    userCount: number;
    aboveThreshold: number;
    belowThreshold: number;
  };
  recommendations: {
    totalRequests: number;
    operationBreakdown: Record<string, number>;
    averageLatencyByOperation: Record<string, number>;
  };
  system: {
    uptime: number;
    nodeVersion: string;
    platform: string;
    arch: string;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  thresholds: PerformanceThreshold;
  alerts: any[];
}

// Error and recovery types
export interface RecommendationError {
  type: 'generation' | 'context' | 'learning' | 'privacy' | 'integration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  context?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface RecoveryStrategy {
  errorType: string;
  strategy: 'retry' | 'fallback' | 'degrade' | 'skip';
  maxAttempts: number;
  fallbackOptions: string[];
}

// Data operation type
export interface DataOperation {
  type: 'read' | 'write' | 'update' | 'delete' | 'analyze' | 'share' | 'export';
  purpose: string;
  dataTypes?: string[];
}

// Core missing types
export interface LearningContext {
  childId: string;
  currentSubject?: Subject;
  skillLevel: SkillLevel;
  learningGoals: LearningObjective[];
  availableTime: TimeRange;
  preferredStyle: LearningStyle;
  parentalPreferences: ParentalPreferences;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: string[];
  flexible: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface SchedulingConstraints {
  fixedEvents: CalendarEvent[];
  preferences: SchedulePreferences;
  constraints: RecommendationConstraints;
  flexibility: number;
}

export interface FamilyDynamics {
  leadershipStyle: 'democratic' | 'authoritative' | 'collaborative';
  decisionMaking: 'consensus' | 'majority' | 'leader-decides';
  conflictResolution: 'discussion' | 'compromise' | 'rotation';
  communicationPatterns: string[];
  sharedValues: string[];
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  diversityScore: number;
  noveltyScore: number;
  userSatisfaction: number;
}

export interface PrivacyDecision {
  allowed: boolean;
  restrictions: DataRestriction[];
  anonymizationRequired: boolean;
  consentRequired: boolean;
  auditRequired: boolean;
}

export interface DataRestriction {
  type: string;
  description: string;
  scope: string[];
}

export interface PrivacySettings {
  dataSharing: PrivacyLevel;
  locationTracking: boolean;
  behaviorAnalysis: boolean;
  familyDataSharing: boolean;
  externalIntegrations: boolean;
  dataRetentionDays: number;
  encryptionRequired: boolean;
}

export interface RecoveryAction {
  action: 'retry' | 'fallback' | 'degrade' | 'skip' | 'alert' | 'shutdown';
  parameters: Record<string, any>;
  timeout: number;
  maxAttempts: number;
}

// Additional types referenced in interfaces

export interface ActivityFeedback {
  activityId: string;
  userId: string;
  completed: boolean;
  enjoymentRating: number; // 1-5 scale
  difficultyRating: number; // 1-5 scale
  timeSpent: number; // minutes
  wouldRecommendToOthers: boolean;
  feedback?: string;
  timestamp: Date;
}

export interface RoleAssignment {
  userId: string;
  role: string;
  responsibilities: string[];
  timeCommitment: number; // minutes
}

export interface ConflictResolution {
  strategy: 'compromise' | 'rotation' | 'voting' | 'leader_decides';
  fallbackOptions: string[];
  timeoutMinutes: number;
}

export interface LearningObjective {
  id: string;
  description: string;
  subject: Subject;
  skillLevel: SkillLevel;
  measurable: boolean;
  timeframe: number; // days
}

export interface EducationalValue {
  cognitiveLoad: 'low' | 'medium' | 'high';
  skillsTargeted: string[];
  knowledgeAreas: Subject[];
  developmentalBenefits: string[];
}

export interface ImpactAssessment {
  timeImpact: number; // minutes saved/lost
  stressImpact: number; // -5 to +5 scale
  costImpact: number; // currency units
  familyImpact: number; // -5 to +5 scale
  healthImpact: number; // -5 to +5 scale
  qualityImpact: number; // -1 to 1 scale (positive = quality improvement)
}

export interface ImplementationStep {
  order: number;
  description: string;
  estimatedTime: number; // minutes
  difficulty: DifficultyLevel;
  dependencies: string[];
  resources: Resource[];
}

export interface TaskApproach {
  method: string;
  tools: string[];
  timeRequired: number; // minutes
  effortLevel: DifficultyLevel;
  successRate: number; // 0-1 scale
}

export interface FamilyImpactAssessment {
  affectedMembers: string[];
  disruptionLevel: 'low' | 'medium' | 'high';
  adaptationTime: number; // days
  overallBenefit: number; // -5 to +5 scale
  benefits: string[];
}

export interface LearningActivity {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  skillLevel: SkillLevel;
  duration: number; // minutes
  interactivityLevel: InteractivityLevel;
  materials: Resource[];
  learningObjectives: LearningObjective[];
  assessmentMethod: string;
  ageRange: AgeRange;
}

export interface LearningResults {
  activityId: string;
  childId: string;
  completed: boolean;
  timeSpent: number; // minutes
  accuracyScore: number; // 0-1 scale
  engagementLevel: EngagementLevel;
  struggledWith: string[];
  masteredSkills: string[];
  feedback: string;
  timestamp: Date;
}

export interface LearningStyle {
  primary: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  secondary?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  preferences: {
    groupWork: boolean;
    quietEnvironment: boolean;
    handsonActivities: boolean;
    visualAids: boolean;
    repetition: boolean;
  };
}

export interface EducationalContent {
  id: string;
  title: string;
  description: string;
  contentType: 'video' | 'interactive' | 'reading' | 'game' | 'exercise';
  subject: Subject;
  skillLevel: SkillLevel;
  ageRange: AgeRange;
  duration: number; // minutes
  safetyRating: SafetyLevel;
  educationalValue: EducationalValue;
  parentalGuidanceRequired: boolean;
}

export interface ParentalPreferences {
  allowedSubjects: Subject[];
  restrictedTopics: string[];
  maxDailyScreenTime: number; // minutes
  preferredLearningStyle: LearningStyle;
  supervisionRequired: boolean;
  approvalRequired: boolean;
}

export interface RoutineRecommendation {
  id: string;
  title: string;
  description: string;
  currentRoutine: RoutineStep[];
  optimizedRoutine: RoutineStep[];
  benefits: string[];
  timeSavings: number; // minutes
  implementationDifficulty: DifficultyLevel;
  familyImpact: FamilyImpactAssessment;
}

export interface RoutineStep {
  order: number;
  activity: string;
  duration: number; // minutes
  location?: string;
  dependencies: string[];
  flexibility: number; // 0-1 scale
}

export interface ConflictPrediction {
  conflictId: string;
  type: 'scheduling' | 'resource' | 'preference' | 'location';
  severity: 'low' | 'medium' | 'high';
  probability: number; // 0-1 scale
  predictedTime: Date;
  affectedUsers: string[];
  suggestedResolutions: string[];
  preventionStrategies: string[];
}

export interface EfficiencyAnalysis {
  analysisId: string;
  familyId: string;
  timeframe: TimeRange;
  inefficiencies: Inefficiency[];
  opportunities: OptimizationOpportunity[];
  currentMetrics: HouseholdMetrics;
  projectedImprovements: HouseholdMetrics;
  recommendations: string[];
}

export interface Inefficiency {
  type: 'time_waste' | 'resource_waste' | 'duplication' | 'poor_scheduling';
  description: string;
  impact: ImpactAssessment;
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  rootCause: string;
  solutions: string[];
}

export interface OptimizationOpportunity {
  type: OptimizationType;
  description: string;
  potentialBenefit: ImpactAssessment;
  implementationEffort: DifficultyLevel;
  prerequisites: string[];
  timeline: number; // days
}

export interface HouseholdMetrics {
  timeEfficiency: number; // 0-1 scale
  stressLevel: number; // 0-10 scale
  taskCompletionRate: number; // 0-1 scale
  resourceUtilization: number; // 0-1 scale
  familySatisfaction: number; // 0-10 scale
  automationLevel: number; // 0-1 scale
}

export interface AutomationSuggestion {
  id: string;
  title: string;
  description: string;
  taskType: string;
  automationMethod: 'smart_device' | 'scheduling' | 'workflow' | 'integration';
  requiredDevices: string[];
  setupComplexity: DifficultyLevel;
  monthlySavings: number; // minutes
  costEstimate: number;
  safetyConsiderations: string[];
}

export interface SupplyOptimization {
  category: string;
  currentApproach: string;
  optimizedApproach: string;
  benefits: string[];
  implementation: ImplementationStep[];
  costImpact: number;
  timeImpact: number; // minutes per week
}

export interface RoutineChange {
  routineId: string;
  changeType: 'timing' | 'sequence' | 'method' | 'automation';
  description: string;
  rationale: string;
  implementation: ImplementationStep[];
  impact: ImpactAssessment;
  adaptationPeriod: number; // days
}

export interface ContextPrediction {
  contextType: string;
  predictedValue: any;
  confidence: number; // 0-1 scale
  timeframe: TimeRange;
  factors: string[];
  uncertainty: number; // 0-1 scale
}

export interface ContextualTrigger {
  triggerId: string;
  triggerType: 'time' | 'location' | 'activity' | 'social' | 'environmental';
  condition: string;
  confidence: number; // 0-1 scale
  recommendationTypes: RecommendationType[];
  priority: 'low' | 'medium' | 'high';
}

export interface ContextData {
  source: ContextSource;
  timestamp: Date;
  data: Record<string, any>;
  reliability: number; // 0-1 scale
  expiresAt?: Date;
}

export interface TrainingData {
  interactions: UserInteraction[];
  contextFeatures: ContextFeature[];
  outcomes: OutcomeData[];
  privacyLevel: PrivacyLevel;
  dataRetentionPolicy: RetentionPolicy;
}

export interface ContextFeature {
  name: string;
  value: any;
  importance: number; // 0-1 scale
  source: ContextSource;
  timestamp: Date;
}

export interface OutcomeData {
  interactionId: string;
  success: boolean;
  satisfaction: number; // 0-1 scale
  completionTime: number; // minutes
  feedback?: string;
}

export interface RetentionPolicy {
  retentionDays: number;
  anonymizeAfterDays: number;
  deleteAfterDays: number;
  exceptions: string[];
}

export interface QualityMetrics {
  accuracy: number; // 0-1 scale
  precision: number; // 0-1 scale
  recall: number; // 0-1 scale
  f1Score: number; // 0-1 scale
  diversityScore: number; // 0-1 scale
  noveltyScore: number; // 0-1 scale
  userSatisfaction: number; // 0-1 scale
  contextualRelevance: number; // 0-1 scale
}

export interface OptimizationResult {
  modelType: ModelType;
  performanceGain: number; // percentage
  memoryReduction: number; // MB
  latencyImprovement: number; // milliseconds
  accuracyChange: number; // percentage
  optimizationTechniques: string[];
}

export interface ModelInsights {
  userId: string;
  topInterests: Interest[];
  behaviorPatterns: BehaviorPattern[];
  preferenceStrength: Record<string, number>;
  contextualFactors: ContextualFactor[];
  recommendationHistory: RecommendationSummary[];
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  confidence: number; // 0-1 scale
  timeframe: string;
  triggers: string[];
}

export interface ContextualFactor {
  factor: string;
  influence: number; // -1 to 1 scale
  consistency: number; // 0-1 scale
  examples: string[];
}

export interface RecommendationSummary {
  type: RecommendationType;
  count: number;
  averageRating: number;
  acceptanceRate: number; // 0-1 scale
  completionRate: number; // 0-1 scale
}

export interface UserData {
  userId: string;
  preferences: UserPreferences;
  interactions: UserInteraction[];
  context: UserContext;
  metadata: Record<string, any>;
}

export interface AnonymizedData {
  anonymizedId: string;
  data: Record<string, any>;
  privacyLevel: PrivacyLevel;
  anonymizationMethod: string;
  retainedFields: string[];
}

export interface DataUsageAudit {
  userId: string;
  timeRange: TimeRange;
  operations: DataOperationLog[];
  complianceStatus: 'compliant' | 'warning' | 'violation';
  issues: string[];
  recommendations: string[];
}

export interface DataOperationLog {
  operation: DataOperation;
  timestamp: Date;
  purpose: string;
  dataTypes: string[];
  authorized: boolean;
  auditTrail: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  recommendations: string[];
  complianceScore: number; // 0-1 scale
}

export interface ValidationIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  field?: string;
  suggestedFix: string;
}

export interface RecommendationHistory {
  recommendations: Recommendation[];
  totalCount: number;
  timeRange: TimeRange;
  privacyFiltered?: boolean;
  summary?: RecommendationHistorySummary;
}

export interface RecommendationHistorySummary {
  totalRecommendations: number;
  acceptedRecommendations: number;
  completedRecommendations: number;
  averageRating: number;
  topCategories: { category: string; count: number }[];
}

export interface RecommendationSettings {
  userId: string;
  enabledTypes: RecommendationType[];
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  maxRecommendations: number;
  privacyLevel: PrivacyLevel;
  parentalControlsEnabled?: boolean;
  contentFilteringStrict?: boolean;
  notificationSettings: NotificationPreferences;
  customFilters: RecommendationFilter[];
}

export interface RecommendationFilter {
  name: string;
  type: 'include' | 'exclude';
  criteria: FilterCriteria;
  active: boolean;
}

export interface FilterCriteria {
  categories?: ActivityCategory[];
  difficulty?: DifficultyLevel[];
  duration?: { min: number; max: number };
  keywords?: string[];
  ageRange?: AgeRange;
}

// Error types

export interface ContextError extends RecommendationError {
  contextType: string;
  sensorData?: any;
}

export interface LearningError extends RecommendationError {
  modelType: ModelType;
  trainingData?: any;
}

export interface PrivacyError extends RecommendationError {
  privacyViolationType: string;
  affectedData: string[];
}

export interface IntegrationError extends RecommendationError {
  system: string;
  action: string;
}

// Recovery types

export interface ContextRecovery {
  fallbackContext: UserContext;
  confidence: number; // 0-1 scale
  limitations: string[];
}

export interface ModelRecovery {
  fallbackModel: ModelType;
  performanceImpact: number; // percentage
  temporaryFix: boolean;
}

export interface PrivacyRemediation {
  actions: string[];
  dataAffected: string[];
  userNotificationRequired: boolean;
  complianceRestored: boolean;
}

export interface IntegrationFallback {
  alternativeSystem?: string;
  degradedFunctionality: string[];
  userImpact: string;
}

// Performance types

export interface PerformanceThreshold {
  maxLatencyMs: number;
  maxMemoryMB: number;
  minSatisfactionScore: number;
  maxCpuUsagePercent: number;
  maxConcurrentRequests: number;
}

// Safety types

export interface SafetyAudit {
  userId: string;
  timeRange: TimeRange;
  decisions: SafetyDecision[];
  violations: SafetyViolation[];
  complianceScore: number; // 0-1 scale
}

export interface SafetyDecision {
  contentId: string;
  decision: 'approved' | 'rejected' | 'flagged';
  reasoning: string[];
  confidence: number; // 0-1 scale
  timestamp: Date;
}

export interface SafetyViolation {
  violationType: string;
  severity: ErrorSeverity;
  description: string;
  contentId: string;
  timestamp: Date;
  resolved: boolean;
}

// Schedule optimization types

export interface ScheduleOptimization extends Recommendation {
  optimizationType: OptimizationType;
  impact: ImpactAssessment;
  implementation: ImplementationStep[];
  timesSaved: number;
  stressReduction: number;
  feasibilityScore: number;
}

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  duration: number;
  requirements: Resource[];
  difficulty: DifficultyLevel;
}

export interface TimeBlockSuggestion {
  activity: Activity;
  suggestedTime: TimeSlot;
  reasoning: string[];
  alternatives: TimeSlot[];
}

