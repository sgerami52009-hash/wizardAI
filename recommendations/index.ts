/**
 * Personalized Recommendations Engine
 * 
 * Main entry point for the recommendations system that provides intelligent,
 * contextual suggestions for family members based on preferences, behavior patterns,
 * schedule, and current context.
 */

export { RecommendationController } from './controller';
export { ActivityRecommender } from './engines/activity-recommender';
export { ScheduleOptimizer } from './engines/schedule-optimizer';
export { EducationalRecommender } from './engines/educational-recommender';
export { HouseholdEfficiencyEngine } from './engines/household-efficiency-engine';
export { ContextAnalyzer } from './analyzers/context-analyzer';
export { LearningEngine } from './learning/learning-engine';
export { PrivacyManager } from './privacy/privacy-manager';

// Export configuration and settings management
export { 
  SystemConfigManager, 
  SettingsManager, 
  PerformanceTuningManager,
  systemConfig,
  settingsManager,
  performanceTuningManager,
  initializeConfiguration
} from './config';

// Export monitoring and maintenance
export {
  HealthMonitor,
  MaintenanceManager,
  DiagnosticsManager,
  healthMonitor,
  maintenanceManager,
  diagnosticsManager,
  initializeMonitoring,
  stopMonitoring,
  getSystemStatus
} from './monitoring';

// Export main types and interfaces
export type {
  Recommendation,
  UserContext,
  UserPreferences,
  UserFeedback,
  RecommendationHistory,
  RecommendationSettings,
  TimeRange,
  SystemMetrics
} from './types';

export type {
  ActivityRecommendation,
  EducationalRecommendation,
  ScheduleOptimization,
  TaskOptimization
} from './interfaces';

export type {
  IRecommendationController,
  IActivityRecommender,
  IScheduleOptimizer,
  IEducationalRecommender,
  IHouseholdEfficiencyEngine,
  IContextAnalyzer,
  ILearningEngine,
  IPrivacyManager
} from './interfaces';

export {
  RecommendationType,
  InteractionType,
  ActivityCategory,
  DifficultyLevel,
  PrivacyLevel,
  Subject,
  SkillLevel,
  ErrorSeverity
} from './enums';