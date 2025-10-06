/**
 * Core interfaces for the personalized recommendations engine
 */

import {
  Recommendation,
  UserContext,
  UserPreferences,
  UserFeedback,
  UserInteraction,
  RecommendationConstraints,
  TimeRange,
  RecommendationError,
  PerformanceConstraints,
  SystemMetrics,
  FamilyContext,
  ActivityContext,

  ContextPrediction,
  FamilyDynamics,
  ContextualTrigger,
  ContextData,
  TrainingData,
  ModelMetrics,
  QualityMetrics,
  OptimizationResult,
  PrivacyDecision,
  DataOperation,
  AnonymizedData,
  DataUsageAudit,
  PrivacySettings,
  ValidationResult,
  RecommendationHistory,
  RecommendationSettings,
  IntegrationAction,
  Interest,
  ActivityPreferences,
  ActivityFeedback,
  RoutineRecommendation,
  ConflictPrediction,
  EfficiencyAnalysis,
  LearningActivity,
  LearningResults,
  LearningStyle,
  EducationalContent,
  AutomationSuggestion,
  SupplyOptimization,
  RoutineChange,
  HouseholdMetrics,
  ModelInsights,
  UserData,
  SafetyAudit,
  Resource,
  WeatherRequirement,
  RoleAssignment,
  ConflictResolution,
  LearningObjective,
  EducationalValue,
  AgeRange,
  ImpactAssessment,
  ImplementationStep,
  TaskApproach,
  FamilyImpactAssessment,
  ParentalPreferences,
  SchedulePreferences,
  RecoveryAction,
  ContextError,
  ContextRecovery,
  LearningError,
  ModelRecovery,
  PrivacyError,
  PrivacyRemediation,
  IntegrationError,
  IntegrationFallback,
  PerformanceThreshold
} from './types';

import {
  RecommendationType,
  ModelType,
  PrivacyLevel,
  Subject,
  SkillLevel,
  ActivityCategory,
  DifficultyLevel,
  OptimizationType,
  InteractivityLevel
} from './enums';

/**
 * Main recommendation controller interface
 * Orchestrates all recommendation operations and coordinates between different engines
 */
export interface IRecommendationController {
  getRecommendations(userId: string, context: UserContext, type?: RecommendationType): Promise<Recommendation[]>;
  submitFeedback(recommendationId: string, feedback: UserFeedback): Promise<void>;
  updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void>;
  getRecommendationHistory(userId: string, timeRange: TimeRange): Promise<RecommendationHistory>;
  refreshRecommendations(userId: string): Promise<void>;
  configureRecommendationSettings(userId: string, settings: RecommendationSettings): Promise<void>;
  handleError(error: RecommendationError): Promise<void>;
  getSystemMetrics(): Promise<SystemMetrics>;
}

/**
 * Activity recommendation engine interface
 * Generates personalized activity suggestions based on user interests and context
 */
export interface IActivityRecommender {
  recommendActivities(userId: string, context: ActivityContext): Promise<ActivityRecommendation[]>;
  discoverNewActivities(userId: string, interests: Interest[]): Promise<ActivityRecommendation[]>;
  recommendFamilyActivities(familyId: string, context: FamilyContext): Promise<FamilyActivityRecommendation[]>;
  updateActivityPreferences(userId: string, preferences: ActivityPreferences): Promise<void>;
  trackActivityCompletion(userId: string, activityId: string, feedback: ActivityFeedback): Promise<void>;
  validateActivitySafety(activity: ActivityRecommendation, userId: string): Promise<boolean>;
}

/**
 * Schedule optimization engine interface
 * Analyzes schedules and provides intelligent optimization suggestions
 */
export interface IScheduleOptimizer {
  optimizeSchedule(userId: string, timeRange: TimeRange): Promise<ScheduleOptimization[]>;
  suggestAlternativeTimes(event: CalendarEvent, constraints: SchedulingConstraints): Promise<TimeSlot[]>;
  recommendRoutineImprovements(userId: string): Promise<RoutineRecommendation[]>;
  identifyScheduleConflicts(userId: string, lookahead: number): Promise<ConflictPrediction[]>;
  suggestTimeBlocking(userId: string, activities: Activity[]): Promise<TimeBlockSuggestion[]>;
  analyzeScheduleEfficiency(userId: string): Promise<EfficiencyAnalysis>;
}

/**
 * Educational recommendation engine interface
 * Provides age-appropriate educational content and activity recommendations
 */
export interface IEducationalRecommender {
  recommendEducationalContent(childId: string, context: LearningContext): Promise<EducationalRecommendation[]>;
  suggestLearningActivities(childId: string, subject: Subject, skillLevel: SkillLevel): Promise<LearningActivity[]>;
  trackLearningProgress(childId: string, activityId: string, results: LearningResults): Promise<void>;
  adaptToLearningStyle(childId: string, learningStyle: LearningStyle): Promise<void>;
  requiresParentalApproval(recommendation: EducationalRecommendation): Promise<boolean>;
  validateEducationalContent(content: EducationalContent): Promise<boolean>;
}

/**
 * Household efficiency engine interface
 * Analyzes household patterns and recommends optimizations
 */
export interface IHouseholdEfficiencyEngine {
  analyzeHouseholdPatterns(familyId: string): Promise<EfficiencyAnalysis>;
  recommendTaskOptimizations(familyId: string): Promise<TaskOptimization[]>;
  suggestAutomationOpportunities(familyId: string): Promise<AutomationSuggestion[]>;
  optimizeSupplyManagement(familyId: string): Promise<SupplyOptimization[]>;
  recommendRoutineChanges(familyId: string): Promise<RoutineChange[]>;
  trackHouseholdMetrics(familyId: string): Promise<HouseholdMetrics>;
}

/**
 * Context analyzer interface
 * Continuously analyzes user and environmental context
 */
export interface IContextAnalyzer {
  analyzeCurrentContext(userId: string): Promise<UserContext>;
  predictContextChanges(userId: string, timeHorizon: number): Promise<ContextPrediction[]>;
  analyzeFamilyDynamics(familyId: string): Promise<FamilyDynamics>;
  detectContextualTriggers(userId: string): Promise<ContextualTrigger[]>;
  updateContextModel(userId: string, contextData: ContextData): Promise<void>;
  validateContextData(contextData: ContextData): Promise<boolean>;
}

/**
 * Learning engine interface
 * Implements machine learning algorithms for continuous improvement
 */
export interface ILearningEngine {
  updateUserModel(userId: string, interactions: UserInteraction[]): Promise<void>;
  trainRecommendationModel(modelType: ModelType, trainingData: TrainingData): Promise<ModelMetrics>;
  evaluateRecommendationQuality(recommendations: Recommendation[], feedback: UserFeedback[]): Promise<QualityMetrics>;
  adaptToUserFeedback(userId: string, feedback: UserFeedback): Promise<void>;
  optimizeModelPerformance(constraints: PerformanceConstraints): Promise<OptimizationResult>;
  getModelInsights(userId: string): Promise<ModelInsights>;
}

/**
 * Privacy manager interface
 * Ensures privacy-preserving operation and manages user data protection
 */
export interface IPrivacyManager {
  enforcePrivacyPreferences(userId: string, operation: DataOperation): Promise<PrivacyDecision>;
  anonymizeUserData(userData: UserData, privacyLevel: PrivacyLevel): Promise<AnonymizedData>;
  auditDataUsage(userId: string, timeRange: TimeRange): Promise<DataUsageAudit>;
  updatePrivacySettings(userId: string, settings: PrivacySettings): Promise<void>;
  validateDataMinimization(operation: DataOperation): Promise<ValidationResult>;
  encryptUserData(data: any): Promise<string>;
  decryptUserData(encryptedData: string): Promise<any>;
}

/**
 * Safety validator interface
 * Validates content and recommendations for child safety
 */
export interface ISafetyValidator {
  validateChildSafeContent(content: any, userId: string): Promise<boolean>;
  validateActivitySafety(activity: ActivityRecommendation, userId: string): Promise<boolean>;
  validateEducationalContent(content: EducationalContent, childId: string): Promise<boolean>;
  requiresParentalApproval(recommendation: Recommendation, userId: string): Promise<boolean>;
  auditSafetyDecisions(userId: string, timeRange: TimeRange): Promise<SafetyAudit>;
}

/**
 * Integration layer interface
 * Manages coordination with other home assistant systems
 */
export interface IIntegrationLayer {
  integrateWithVoice(recommendation: Recommendation): Promise<IntegrationAction[]>;
  integrateWithAvatar(recommendation: Recommendation): Promise<IntegrationAction[]>;
  integrateWithScheduling(recommendation: Recommendation): Promise<IntegrationAction[]>;
  integrateWithSmartHome(recommendation: Recommendation): Promise<IntegrationAction[]>;
  executeIntegrationAction(action: IntegrationAction): Promise<boolean>;
  validateIntegration(system: string): Promise<boolean>;
}

// Supporting interfaces for specific recommendation types

export interface ActivityRecommendation extends Recommendation {
  category: ActivityCategory;
  duration: TimeRange;
  difficulty: DifficultyLevel;
  requiredResources: Resource[];
  weatherDependency: WeatherRequirement;
  ageAppropriate: boolean;
  educationalValue: number;
  physicalActivity: boolean;
  socialActivity: boolean;
}

export interface FamilyActivityRecommendation extends ActivityRecommendation {
  familyMembers: string[];
  roleAssignments: RoleAssignment[];
  coordinationRequired: boolean;
  conflictResolution: ConflictResolution;
}

export interface EducationalRecommendation extends Recommendation {
  subject: Subject;
  skillLevel: SkillLevel;
  learningObjectives: LearningObjective[];
  estimatedDuration: number;
  interactivityLevel: InteractivityLevel;
  educationalValue: EducationalValue;
  ageRange: AgeRange;
  parentalApprovalRequired: boolean;
}

export interface ScheduleOptimization extends Recommendation {
  optimizationType: OptimizationType;
  impact: ImpactAssessment;
  implementation: ImplementationStep[];
  timesSaved: number;
  stressReduction: number;
  feasibilityScore: number;
}

export interface TaskOptimization extends Recommendation {
  taskId: string;
  currentApproach: TaskApproach;
  optimizedApproach: TaskApproach;
  timeSavings: number;
  effortReduction: number;
  implementationDifficulty: DifficultyLevel;
  familyImpact: FamilyImpactAssessment;
}

// Additional supporting types that need interfaces

export interface LearningContext {
  childId: string;
  currentSubject?: Subject;
  skillLevel: SkillLevel;
  learningGoals: LearningObjective[];
  availableTime: TimeRange;
  preferredStyle: LearningStyle;
  parentalPreferences: ParentalPreferences;
}

export interface SchedulingConstraints {
  fixedEvents: CalendarEvent[];
  preferences: SchedulePreferences;
  constraints: RecommendationConstraints;
  flexibility: number;
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

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  duration: number;
  requirements: Resource[];
  difficulty: DifficultyLevel;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  flexibility: number;
  conflicts: string[];
}

export interface TimeBlockSuggestion {
  activity: Activity;
  suggestedTime: TimeSlot;
  reasoning: string[];
  alternatives: TimeSlot[];
}

// Error handling and recovery interfaces

export interface IErrorHandler {
  handleRecommendationError(error: RecommendationError): Promise<RecoveryAction>;
  handleContextError(error: ContextError): Promise<ContextRecovery>;
  handleLearningError(error: LearningError): Promise<ModelRecovery>;
  handlePrivacyError(error: PrivacyError): Promise<PrivacyRemediation>;
  handleIntegrationError(error: IntegrationError): Promise<IntegrationFallback>;
}

// Performance monitoring interface

export interface IPerformanceMonitor {
  trackRecommendationLatency(operation: string, duration: number): void;
  trackMemoryUsage(component: string, usage: number): void;
  trackUserSatisfaction(userId: string, satisfaction: number): void;
  getPerformanceMetrics(): Promise<SystemMetrics>;
  alertOnPerformanceIssues(threshold: PerformanceThreshold): void;
}