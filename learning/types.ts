// Learning Engine Core Types
import { ModelHyperparameters } from '../models/types';

export interface LearningEngine {
  trainUserModel(userId: string, patterns: IdentifiedPattern[]): Promise<TrainingResult>;
  updateModel(userId: string, feedback: UserFeedback): Promise<ModelUpdateResult>;
  validateModel(userId: string): Promise<ModelValidationResult>;
  optimizeModel(userId: string, constraints: ResourceConstraints): Promise<OptimizationResult>;
  resetUserModel(userId: string): Promise<void>;
  getModelMetrics(userId: string): Promise<ModelMetrics>;
}

export interface TrainingResult {
  success: boolean;
  modelVersion: string;
  improvementMetrics: PerformanceMetrics;
  trainingTime: number;
  memoryUsage: number;
  convergenceStatus: ConvergenceStatus;
}

export interface ModelUpdateResult {
  updated: boolean;
  previousVersion: string;
  newVersion: string;
  performanceChange: PerformanceDelta;
  rollbackAvailable: boolean;
}

export interface ModelValidationResult {
  isValid: boolean;
  accuracy: number;
  confidence: number;
  issues: ValidationIssue[];
  recommendations: string[];
}

export interface OptimizationResult {
  optimized: boolean;
  sizeBefore: number;
  sizeAfter: number;
  performanceImprovement: number;
  memoryReduction: number;
  executionTime?: number;
  hardwareImpact?: any;
  optimizationSteps?: any[];
  jetsonSpecificMetrics?: any;
}

export interface ResourceConstraints {
  maxMemoryMB: number;
  maxLatencyMs: number;
  targetAccuracy: number;
  energyEfficient: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  latency: number;
  memoryUsage: number;
  trainingTime: number;
  lastUpdated: Date;
  version: string;
}

export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latency: number;
  memoryUsage: number;
}

export interface PerformanceDelta {
  accuracyChange: number;
  latencyChange: number;
  memoryChange: number;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: IssueSeverity;
  description: string;
  recommendation: string;
}

export enum ConvergenceStatus {
  CONVERGED = 'converged',
  CONVERGING = 'converging',
  DIVERGED = 'diverged',
  STALLED = 'stalled'
}

export enum ValidationIssueType {
  ACCURACY_DEGRADATION = 'accuracy_degradation',
  OVERFITTING = 'overfitting',
  UNDERFITTING = 'underfitting',
  DATA_DRIFT = 'data_drift',
  PERFORMANCE_REGRESSION = 'performance_regression'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface UserFeedback {
  feedbackId: string;
  userId: string;
  timestamp: Date;
  source: FeedbackSource;
  type: FeedbackType;
  context: FeedbackContext;
  rating: FeedbackRating;
  specificFeedback: SpecificFeedback;
  improvementSuggestions: string[];
}

export interface SpecificFeedback {
  accuracy: AccuracyFeedback;
  relevance: RelevanceFeedback;
  timing: TimingFeedback;
  personalization: PersonalizationFeedback;
  satisfaction: SatisfactionFeedback;
}

export interface FeedbackContext {
  interactionType: string;
  systemComponent: string;
  userContext: string;
  environmentalFactors: string[];
}

export enum FeedbackSource {
  EXPLICIT_USER = 'explicit_user',
  IMPLICIT_BEHAVIOR = 'implicit_behavior',
  SYSTEM_METRICS = 'system_metrics',
  PARENTAL_CONTROL = 'parental_control'
}

export enum FeedbackType {
  POSITIVE_REINFORCEMENT = 'positive_reinforcement',
  NEGATIVE_FEEDBACK = 'negative_feedback',
  PREFERENCE_CORRECTION = 'preference_correction',
  BEHAVIOR_ADJUSTMENT = 'behavior_adjustment',
  FEATURE_REQUEST = 'feature_request'
}

export interface FeedbackRating {
  overall: number; // 1-5 scale
  accuracy: number;
  helpfulness: number;
  appropriateness: number;
}

export interface AccuracyFeedback {
  wasAccurate: boolean;
  confidence: number;
  corrections: string[];
}

export interface RelevanceFeedback {
  wasRelevant: boolean;
  contextMismatch: boolean;
  suggestions: string[];
}

export interface TimingFeedback {
  wasTimely: boolean;
  preferredTiming: string;
  urgencyLevel: UrgencyLevel;
}

export interface PersonalizationFeedback {
  wasPersonalized: boolean;
  preferencesMet: boolean;
  adaptationNeeded: string[];
}

export interface SatisfactionFeedback {
  satisfactionLevel: number; // 1-5 scale
  emotionalResponse: EmotionalResponse;
  wouldRecommend: boolean;
}

export enum UrgencyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum EmotionalResponse {
  VERY_NEGATIVE = 'very_negative',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  POSITIVE = 'positive',
  VERY_POSITIVE = 'very_positive'
}

export interface IdentifiedPattern {
  id: string;
  type: PatternType;
  description: string;
  frequency: number;
  strength: number;
  context: PatternContext;
  examples: PatternExample[];
  lastObserved: Date;
}

export interface PatternContext {
  temporal: TemporalContext;
  environmental: EnvironmentalContext;
  social: SocialContext;
  device: DeviceContext;
}

export interface PatternExample {
  timestamp: Date;
  context: string;
  outcome: string;
  confidence: number;
}

export enum PatternType {
  BEHAVIORAL = 'behavioral',
  TEMPORAL = 'temporal',
  CONTEXTUAL = 'contextual',
  PREFERENCE = 'preference',
  HABIT = 'habit'
}

export interface TemporalContext {
  timeOfDay: TimeOfDay;
  dayOfWeek: DayOfWeek;
  season: Season;
  isHoliday: boolean;
  timeZone: string;
  relativeToSchedule: ScheduleRelation;
}

export interface EnvironmentalContext {
  location: LocationContext;
  weather: WeatherContext;
  lighting: LightingContext;
  noise: NoiseContext;
  temperature: number;
}

export interface SocialContext {
  presentUsers: string[];
  familyMembers: FamilyMember[];
  guestPresent: boolean;
  socialActivity: SocialActivity;
}

export interface DeviceContext {
  deviceType: DeviceType;
  screenSize: ScreenSize;
  inputMethod: InputMethod;
  connectivity: ConnectivityStatus;
}

export enum TimeOfDay {
  EARLY_MORNING = 'early_morning',
  MORNING = 'morning',
  LATE_MORNING = 'late_morning',
  EARLY_AFTERNOON = 'early_afternoon',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  NIGHT = 'night',
  LATE_NIGHT = 'late_night'
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  FALL = 'fall',
  WINTER = 'winter'
}

export enum ScheduleRelation {
  BEFORE_WORK = 'before_work',
  DURING_WORK = 'during_work',
  AFTER_WORK = 'after_work',
  WEEKEND = 'weekend',
  VACATION = 'vacation',
  FREE_TIME = 'free_time'
}

export interface LocationContext {
  room: string;
  building: string;
  city: string;
  isHome: boolean;
  isWork: boolean;
  isPublic: boolean;
}

export interface WeatherContext {
  condition: WeatherCondition;
  temperature: number;
  humidity: number;
  isRaining: boolean;
}

export interface LightingContext {
  brightness: number;
  isNatural: boolean;
  colorTemperature: number;
}

export interface NoiseContext {
  level: number;
  type: NoiseType;
  isDistracting: boolean;
}

export interface FamilyMember {
  id: string;
  relationship: FamilyRelationship;
  ageGroup: AgeGroup;
  isPresent: boolean;
}

export enum WeatherCondition {
  SUNNY = 'sunny',
  CLOUDY = 'cloudy',
  RAINY = 'rainy',
  SNOWY = 'snowy',
  STORMY = 'stormy'
}

export enum NoiseType {
  QUIET = 'quiet',
  CONVERSATION = 'conversation',
  MUSIC = 'music',
  TV = 'tv',
  TRAFFIC = 'traffic',
  CONSTRUCTION = 'construction'
}

export enum SocialActivity {
  ALONE = 'alone',
  FAMILY_TIME = 'family_time',
  ENTERTAINING = 'entertaining',
  MEETING = 'meeting',
  PARTY = 'party'
}

export enum DeviceType {
  SMART_DISPLAY = 'smart_display',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  VOICE_ONLY = 'voice_only'
}

export enum ScreenSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTRA_LARGE = 'extra_large'
}

export enum InputMethod {
  VOICE = 'voice',
  TOUCH = 'touch',
  KEYBOARD = 'keyboard',
  GESTURE = 'gesture'
}

export enum ConnectivityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  LIMITED = 'limited'
}

export enum FamilyRelationship {
  PARENT = 'parent',
  CHILD = 'child',
  SIBLING = 'sibling',
  GRANDPARENT = 'grandparent',
  GUARDIAN = 'guardian',
  OTHER = 'other'
}

export enum AgeGroup {
  TODDLER = 'toddler',      // 2-4
  CHILD = 'child',          // 5-12
  TEEN = 'teen',            // 13-17
  ADULT = 'adult',          // 18-64
  SENIOR = 'senior'         // 65+
}

// Federated Learning Types
export interface FederatedSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  localModel: LocalModel;
  privacyBudget: number;
  learningRate: number;
  regularizationStrength: number;
  catastrophicForgettingPrevention: boolean;
  privacyParams?: PrivacyParameters;
}

export interface PrivacyParameters {
  epsilon: number;  // Privacy budget
  delta: number;    // Failure probability
  sensitivity: number;
  noiseScale: number;
}

export interface LocalModel {
  userId: string;
  modelId: string;
  createdAt: Date;
  lastUpdated: Date;
  weights: ModelWeights;
  architecture: ModelArchitecture;
  hyperparameters: ModelHyperparameters;
}

export interface ModelWeights {
  layers: LayerWeights[];
  totalParameters: number;
  memoryFootprint: number; // in MB
}

export interface LayerWeights {
  weights: number[][] | number[];
  biases: number[];
  layerType: string;
  size: number;
}

export interface ModelArchitecture {
  inputDimension: number;
  outputDimension: number;
  hiddenLayers: number[];
  activationFunction: string;
  outputActivation: string;
}

export interface PrivatizedPattern {
  id: string;
  type: PatternType;
  strength: number;
  frequency: number;
  context: AnonymizedContext;
  privacyLevel: string;
  noiseAdded: number;
}

export interface AnonymizedContext {
  temporal: {
    timeOfDay: TimeOfDay;
    dayOfWeek: DayOfWeek;
    isWeekend: boolean;
  };
  environmental: {
    hasNaturalLight: boolean;
    noiseLevel: number;
    isQuiet: boolean;
  };
  social: {
    isAlone: boolean;
    familyPresent: boolean;
    socialActivity: SocialActivity;
  };
}

export interface IncrementalLearningResult {
  weightsUpdated: boolean;
  memoryUsage: number;
  convergenceScore: number;
  metrics: PerformanceMetrics;
  ewcLoss: number;
}

export interface EWCWeights {
  fisherMatrix: number[][];
  optimalWeights: ModelWeights;
  importance: number[];
}

export interface Gradients {
  layerGradients: LayerGradients[];
  totalNorm: number;
  maxGradient: number;
}

export interface LayerGradients {
  weights: number[][];
  biases: number[];
}

export interface OptimizedModel {
  weights: ModelWeights;
  memoryUsage: number;
  metrics: PerformanceMetrics;
}

export enum OptimizerType {
  SGD = 'sgd',
  ADAM = 'adam',
  RMSPROP = 'rmsprop',
  ADAGRAD = 'adagrad',
  ADAMW = 'adamw'
}

export enum ActivationFunction {
  RELU = 'relu',
  SIGMOID = 'sigmoid',
  TANH = 'tanh',
  SOFTMAX = 'softmax',
  GELU = 'gelu'
}