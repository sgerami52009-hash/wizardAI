// Pattern Analysis Types

import { 
  FamilyRelationship,
  DeviceType,
  UrgencyLevel,
  SocialActivity,
  WeatherCondition,
  DayOfWeek,
  TimeOfDay,
  LocationContext,
  EnvironmentalContext,
  SocialContext,
  DeviceContext,
  TemporalContext,
  IdentifiedPattern
} from "../learning";

import { 
  ImpactLevel,
  InteractionType,
  PatternSummary,
  RecommendationPriority,
  RecommendationType,
  RetentionPolicy
} from "../privacy";

import { InteractionSource } from "../privacy";

import { UserInteraction } from "../privacy";

import { FilteredInteraction } from "../privacy";

export interface PatternAnalyzer {
  analyzePatterns(interactions: FilteredInteraction[]): Promise<PatternAnalysisResult>;
  identifyPreferences(userId: string, domain: PreferenceDomain): Promise<UserPreferences>;
  detectHabits(userId: string, timeWindow: TimeWindow): Promise<HabitPattern[]>;
  updatePatternWeights(userId: string, feedback: PatternFeedback): Promise<void>;
  getPatternInsights(userId: string): Promise<PatternInsights>;
}

export interface InteractionCollector {
  captureInteraction(interaction: UserInteraction): Promise<void>;
  registerInteractionSource(source: InteractionSource): Promise<void>;
  configureDataRetention(userId: string, policy: RetentionPolicy): Promise<void>;
  getInteractionSummary(userId: string, timeRange: TimeRange): Promise<InteractionSummary>;
  purgeUserData(userId: string): Promise<void>;
}

export interface ContextAggregator {
  getCurrentContext(userId: string): Promise<UserContext>;
  updateContext(userId: string, contextUpdate: ContextUpdate): Promise<void>;
  getContextHistory(userId: string, timeRange: TimeRange): Promise<ContextHistory>;
  registerContextSource(source: ContextSource): Promise<void>;
  predictContextChange(userId: string, timeHorizon: number): Promise<ContextPrediction>;
}

export interface PatternAnalysisResult {
  userId: string;
  patterns: IdentifiedPattern[];
  preferences: InferredPreference[];
  habits: DetectedHabit[];
  contextualFactors: ContextualFactor[];
  confidence: ConfidenceScore;
  analysisTimestamp: Date;
}

export interface UserPreferences {
  userId: string;
  domain: PreferenceDomain;
  preferences: Preference[];
  confidence: number;
  lastUpdated: Date;
  source: PreferenceSource;
}

export interface HabitPattern {
  habitId: string;
  userId: string;
  type: HabitType;
  description: string;
  frequency: FrequencyPattern;
  strength: number;
  context: HabitContext;
  triggers: HabitTrigger[];
  outcomes: HabitOutcome[];
  firstObserved: Date;
  lastObserved: Date;
}

export interface PatternFeedback {
  patternId: string;
  userId: string;
  feedbackType: PatternFeedbackType;
  accuracy: number;
  relevance: number;
  actionTaken: FeedbackAction;
  timestamp: Date;
}

export interface PatternInsights {
  userId: string;
  totalPatterns: number;
  strongPatterns: IdentifiedPattern[];
  emergingPatterns: IdentifiedPattern[];
  fadingPatterns: IdentifiedPattern[];
  recommendations: PatternRecommendation[];
  generatedAt: Date;
}

export interface InferredPreference {
  preferenceId: string;
  type: PreferenceType;
  value: any;
  confidence: number;
  evidence: PreferenceEvidence[];
  context: PreferenceContext;
  inferredAt: Date;
}

export interface DetectedHabit {
  habitId: string;
  type: HabitType;
  description: string;
  strength: number;
  frequency: number;
  context: HabitContext;
  predictability: number;
  lastOccurrence: Date;
}

export interface ContextualFactor {
  factorId: string;
  type: ContextualFactorType;
  influence: number;
  description: string;
  examples: string[];
  correlations: FactorCorrelation[];
}

export interface ConfidenceScore {
  overall: number;
  patternRecognition: number;
  preferenceInference: number;
  habitDetection: number;
  contextualAnalysis: number;
}

export interface Preference {
  key: string;
  value: any;
  type: PreferenceValueType;
  confidence: number;
  lastUpdated: Date;
  source: PreferenceSource;
}

export interface FrequencyPattern {
  type: FrequencyType;
  interval: number;
  timeUnit: TimeUnit;
  regularity: number;
  exceptions: FrequencyException[];
}

export interface HabitContext {
  temporal: TemporalContext;
  environmental: EnvironmentalContext;
  social: SocialContext;
  emotional: EmotionalContext;
  situational: SituationalContext;
}

export interface HabitTrigger {
  triggerId: string;
  type: TriggerType;
  description: string;
  strength: number;
  reliability: number;
  context: TriggerContext;
}

export interface HabitOutcome {
  outcomeId: string;
  type: OutcomeType;
  description: string;
  satisfaction: number;
  frequency: number;
  impact: OutcomeImpact;
}

export interface PatternRecommendation {
  recommendationId: string;
  type: RecommendationType;
  description: string;
  priority: RecommendationPriority;
  expectedBenefit: string;
  implementation: string[];
}

export interface PreferenceEvidence {
  evidenceId: string;
  type: EvidenceType;
  strength: number;
  description: string;
  timestamp: Date;
  context: EvidenceContext;
}

export interface PreferenceContext {
  domain: PreferenceDomain;
  scope: PreferenceScope;
  conditions: ContextCondition[];
  exceptions: PreferenceException[];
}

export interface FactorCorrelation {
  factorId: string;
  correlationType: CorrelationType;
  strength: number;
  significance: number;
  description: string;
}

export interface UserContext {
  userId: string;
  timestamp: Date;
  temporal: TemporalContext;
  spatial: SpatialContext;
  device: DeviceContext;
  activity: ActivityContext;
  social: SocialContext;
  environmental: EnvironmentalContext;
  historical: HistoricalContext;
}

export interface ContextUpdate {
  updateId: string;
  timestamp: Date;
  changes: ContextChange[];
  source: ContextSource;
  confidence: number;
}

export interface ContextHistory {
  userId: string;
  timeRange: TimeRange;
  contexts: HistoricalContext[];
  patterns: ContextPattern[];
  trends: ContextTrend[];
}

export interface ContextSource {
  sourceId: string;
  type: ContextSourceType;
  reliability: number;
  updateFrequency: number;
  dataTypes: ContextDataType[];
}

export interface ContextPrediction {
  predictionId: string;
  userId: string;
  timeHorizon: number;
  predictedContext: UserContext;
  confidence: number;
  factors: PredictionFactor[];
  alternatives: AlternativeContext[];
}

export interface InteractionSummary {
  userId: string;
  timeRange: TimeRange;
  totalInteractions: number;
  interactionTypes: InteractionTypeSummary[];
  patterns: PatternSummary[];
  trends: InteractionTrend[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  duration?: number;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  duration: number;
  type: 'sliding' | 'fixed';
}

export interface ContextChange {
  changeId: string;
  contextType: ContextType;
  previousValue: any;
  newValue: any;
  changeType: ChangeType;
  impact: ChangeImpact;
}

export interface ContextPattern {
  patternId: string;
  type: ContextPatternType;
  description: string;
  frequency: number;
  strength: number;
  examples: ContextExample[];
}

export interface ContextTrend {
  trendId: string;
  type: TrendType;
  direction: TrendDirection;
  strength: number;
  timeframe: TimeFrame;
  description: string;
}

export interface HistoricalContext {
  timestamp: Date;
  context: UserContext;
  significance: number;
  events: ContextEvent[];
}

export interface PredictionFactor {
  factorId: string;
  type: PredictionFactorType;
  influence: number;
  description: string;
  confidence: number;
}

export interface AlternativeContext {
  context: UserContext;
  probability: number;
  conditions: ContextCondition[];
  description: string;
}

export interface InteractionTypeSummary {
  type: InteractionType;
  count: number;
  averageDuration: number;
  successRate: number;
  satisfaction: number;
}

export interface InteractionTrend {
  trendId: string;
  type: TrendType;
  direction: TrendDirection;
  strength: number;
  description: string;
  timeframe: TimeFrame;
}

export interface SpatialContext {
  location: LocationContext;
  movement: MovementContext;
  proximity: ProximityContext;
  accessibility: AccessibilityContext;
}

export interface ActivityContext {
  currentActivity: ActivityType;
  activityLevel: ActivityLevel;
  focus: FocusLevel;
  multitasking: boolean;
  interruptions: InterruptionContext[];
}

export interface EmotionalContext {
  mood: MoodState;
  energy: EnergyLevel;
  stress: StressLevel;
  engagement: EngagementLevel;
  satisfaction: SatisfactionLevel;
}

export interface SituationalContext {
  situation: SituationType;
  urgency: UrgencyLevel;
  complexity: ComplexityLevel;
  novelty: NoveltyLevel;
  constraints: SituationalConstraint[];
}

export interface TriggerContext {
  temporal: TemporalTrigger;
  environmental: EnvironmentalTrigger;
  social: SocialTrigger;
  emotional: EmotionalTrigger;
  situational: SituationalTrigger;
}

export interface OutcomeImpact {
  immediate: ImpactLevel;
  shortTerm: ImpactLevel;
  longTerm: ImpactLevel;
  domains: ImpactDomain[];
}

export interface EvidenceContext {
  source: EvidenceSource;
  reliability: number;
  recency: number;
  relevance: number;
  consistency: number;
}

export interface ContextCondition {
  conditionId: string;
  type: ConditionType;
  operator: ConditionOperator;
  value: any;
  weight: number;
}

export interface PreferenceException {
  exceptionId: string;
  condition: ContextCondition;
  alternativeValue: any;
  frequency: number;
  description: string;
}

export interface FrequencyException {
  exceptionId: string;
  condition: ContextCondition;
  alternativeFrequency: FrequencyPattern;
  description: string;
}

export interface ContextExample {
  exampleId: string;
  timestamp: Date;
  context: UserContext;
  outcome: string;
  significance: number;
}

export interface ContextEvent {
  eventId: string;
  type: ContextEventType;
  description: string;
  impact: EventImpact;
  timestamp: Date;
}

export interface MovementContext {
  isMoving: boolean;
  speed: number;
  direction: string;
  destination?: string;
  transportMode: TransportMode;
}

export interface ProximityContext {
  nearbyDevices: DeviceProximity[];
  nearbyPeople: PersonProximity[];
  nearbyLocations: LocationProximity[];
}

export interface AccessibilityContext {
  visualImpairment: boolean;
  hearingImpairment: boolean;
  mobilityImpairment: boolean;
  cognitiveImpairment: boolean;
  assistiveTechnology: string[];
}

export interface InterruptionContext {
  interruptionId: string;
  type: InterruptionType;
  severity: InterruptionSeverity;
  duration: number;
  source: string;
}

export interface SituationalConstraint {
  constraintId: string;
  type: ConstraintType;
  severity: ConstraintSeverity;
  description: string;
  workarounds: string[];
}

export interface TemporalTrigger {
  timeOfDay?: TimeOfDay;
  dayOfWeek?: DayOfWeek;
  datePattern?: string;
  duration?: number;
  frequency?: FrequencyPattern;
}

export interface EnvironmentalTrigger {
  location?: string;
  weather?: WeatherCondition;
  lighting?: LightingCondition;
  noise?: NoiseLevel;
  temperature?: TemperatureRange;
}

export interface SocialTrigger {
  peoplePresent?: string[];
  socialActivity?: SocialActivity;
  communication?: CommunicationType;
  groupSize?: number;
}

export interface EmotionalTrigger {
  mood?: MoodState;
  energy?: EnergyLevel;
  stress?: StressLevel;
  excitement?: ExcitementLevel;
}

export interface SituationalTrigger {
  situation?: SituationType;
  urgency?: UrgencyLevel;
  complexity?: ComplexityLevel;
  novelty?: NoveltyLevel;
}

export interface ImpactDomain {
  domain: string;
  impact: ImpactLevel;
  description: string;
}

export interface DeviceProximity {
  deviceId: string;
  deviceType: DeviceType;
  distance: number;
  connectionStrength: number;
}

export interface PersonProximity {
  personId: string;
  relationship: FamilyRelationship;
  distance: number;
  interactionLevel: InteractionLevel;
}

export interface LocationProximity {
  locationId: string;
  locationType: LocationType;
  distance: number;
  accessibility: number;
}

export interface TemperatureRange {
  min: number;
  max: number;
  optimal: number;
}

// Enums
export enum PreferenceDomain {
  COMMUNICATION = 'communication',
  SCHEDULING = 'scheduling',
  CONTENT = 'content',
  INTERACTION = 'interaction',
  PRIVACY = 'privacy',
  ACCESSIBILITY = 'accessibility'
}

export enum HabitType {
  ROUTINE = 'routine',
  BEHAVIORAL = 'behavioral',
  COMMUNICATION = 'communication',
  SCHEDULING = 'scheduling',
  PREFERENCE = 'preference'
}

export enum PatternFeedbackType {
  CONFIRMATION = 'confirmation',
  CORRECTION = 'correction',
  ENHANCEMENT = 'enhancement',
  REJECTION = 'rejection'
}

export enum FeedbackAction {
  ACCEPTED = 'accepted',
  MODIFIED = 'modified',
  REJECTED = 'rejected',
  DEFERRED = 'deferred'
}

export enum PreferenceType {
  BOOLEAN = 'boolean',
  NUMERIC = 'numeric',
  CATEGORICAL = 'categorical',
  TEMPORAL = 'temporal',
  CONTEXTUAL = 'contextual'
}

export enum PreferenceSource {
  EXPLICIT = 'explicit',
  INFERRED = 'inferred',
  LEARNED = 'learned',
  DEFAULT = 'default'
}

export enum PreferenceValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object'
}

export enum ContextualFactorType {
  TEMPORAL = 'temporal',
  ENVIRONMENTAL = 'environmental',
  SOCIAL = 'social',
  EMOTIONAL = 'emotional',
  SITUATIONAL = 'situational'
}

export enum FrequencyType {
  REGULAR = 'regular',
  IRREGULAR = 'irregular',
  SEASONAL = 'seasonal',
  SPORADIC = 'sporadic'
}

export enum TimeUnit {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

export enum TriggerType {
  TEMPORAL = 'temporal',
  ENVIRONMENTAL = 'environmental',
  SOCIAL = 'social',
  EMOTIONAL = 'emotional',
  SITUATIONAL = 'situational'
}

export enum OutcomeType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed'
}

export enum EvidenceType {
  BEHAVIORAL = 'behavioral',
  EXPLICIT = 'explicit',
  CONTEXTUAL = 'contextual',
  HISTORICAL = 'historical'
}

export enum EvidenceSource {
  PATTERN_ANALYSIS = 'pattern_analysis',
  USER_FEEDBACK = 'user_feedback',
  SYSTEM_OBSERVATION = 'system_observation',
  EXTERNAL_DATA = 'external_data',
  INFERENCE_ENGINE = 'inference_engine'
}

export enum PreferenceScope {
  GLOBAL = 'global',
  CONTEXTUAL = 'contextual',
  TEMPORAL = 'temporal',
  SITUATIONAL = 'situational'
}

export enum CorrelationType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  COMPLEX = 'complex'
}

export enum ContextSourceType {
  SENSOR = 'sensor',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
  EXTERNAL_API = 'external_api',
  INFERRED = 'inferred'
}

export enum ContextDataType {
  TEMPORAL = 'temporal',
  SPATIAL = 'spatial',
  ENVIRONMENTAL = 'environmental',
  SOCIAL = 'social',
  DEVICE = 'device',
  ACTIVITY = 'activity'
}

export enum ContextType {
  TEMPORAL = 'temporal',
  SPATIAL = 'spatial',
  ENVIRONMENTAL = 'environmental',
  SOCIAL = 'social',
  DEVICE = 'device',
  ACTIVITY = 'activity'
}

export enum ChangeType {
  ADDITION = 'addition',
  MODIFICATION = 'modification',
  REMOVAL = 'removal',
  REPLACEMENT = 'replacement'
}

export enum ChangeImpact {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ContextPatternType {
  TEMPORAL = 'temporal',
  SPATIAL = 'spatial',
  BEHAVIORAL = 'behavioral',
  SOCIAL = 'social',
  ENVIRONMENTAL = 'environmental'
}

export enum TrendType {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
  CYCLICAL = 'cyclical',
  VOLATILE = 'volatile'
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
  OSCILLATING = 'oscillating'
}

export enum TimeFrame {
  SHORT_TERM = 'short_term',
  MEDIUM_TERM = 'medium_term',
  LONG_TERM = 'long_term'
}

export enum PredictionFactorType {
  HISTORICAL = 'historical',
  CONTEXTUAL = 'contextual',
  BEHAVIORAL = 'behavioral',
  ENVIRONMENTAL = 'environmental'
}

export enum ActivityType {
  WORK = 'work',
  LEISURE = 'leisure',
  EXERCISE = 'exercise',
  SOCIAL = 'social',
  LEARNING = 'learning',
  MAINTENANCE = 'maintenance'
}

export enum ActivityLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum FocusLevel {
  DISTRACTED = 'distracted',
  UNFOCUSED = 'unfocused',
  FOCUSED = 'focused',
  HIGHLY_FOCUSED = 'highly_focused',
  DEEP_FOCUS = 'deep_focus'
}

export enum MoodState {
  VERY_NEGATIVE = 'very_negative',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  POSITIVE = 'positive',
  VERY_POSITIVE = 'very_positive'
}

export enum EnergyLevel {
  EXHAUSTED = 'exhausted',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  ENERGETIC = 'energetic'
}

export enum StressLevel {
  RELAXED = 'relaxed',
  CALM = 'calm',
  MODERATE = 'moderate',
  STRESSED = 'stressed',
  OVERWHELMED = 'overwhelmed'
}

export enum EngagementLevel {
  DISENGAGED = 'disengaged',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  FULLY_ENGAGED = 'fully_engaged'
}

export enum SatisfactionLevel {
  VERY_DISSATISFIED = 'very_dissatisfied',
  DISSATISFIED = 'dissatisfied',
  NEUTRAL = 'neutral',
  SATISFIED = 'satisfied',
  VERY_SATISFIED = 'very_satisfied'
}

export enum SituationType {
  ROUTINE = 'routine',
  PLANNED = 'planned',
  UNEXPECTED = 'unexpected',
  EMERGENCY = 'emergency',
  SOCIAL = 'social'
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

export enum NoveltyLevel {
  FAMILIAR = 'familiar',
  SOMEWHAT_NEW = 'somewhat_new',
  NEW = 'new',
  COMPLETELY_NEW = 'completely_new'
}

export enum ConditionType {
  TEMPORAL = 'temporal',
  CONTEXTUAL = 'contextual',
  BEHAVIORAL = 'behavioral',
  ENVIRONMENTAL = 'environmental'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  IN_RANGE = 'in_range'
}

export enum ContextEventType {
  STATE_CHANGE = 'state_change',
  INTERACTION = 'interaction',
  SYSTEM_EVENT = 'system_event',
  USER_ACTION = 'user_action'
}

export enum EventImpact {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum TransportMode {
  WALKING = 'walking',
  DRIVING = 'driving',
  PUBLIC_TRANSPORT = 'public_transport',
  CYCLING = 'cycling',
  STATIONARY = 'stationary'
}

export enum InterruptionType {
  NOTIFICATION = 'notification',
  CALL = 'call',
  PERSON = 'person',
  NOISE = 'noise',
  SYSTEM = 'system'
}

export enum InterruptionSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export enum ConstraintType {
  TIME = 'time',
  RESOURCE = 'resource',
  PHYSICAL = 'physical',
  SOCIAL = 'social',
  TECHNICAL = 'technical'
}

export enum ConstraintSeverity {
  SOFT = 'soft',
  MODERATE = 'moderate',
  HARD = 'hard',
  ABSOLUTE = 'absolute'
}

export enum LightingCondition {
  DARK = 'dark',
  DIM = 'dim',
  MODERATE = 'moderate',
  BRIGHT = 'bright',
  VERY_BRIGHT = 'very_bright'
}

export enum NoiseLevel {
  SILENT = 'silent',
  QUIET = 'quiet',
  MODERATE = 'moderate',
  LOUD = 'loud',
  VERY_LOUD = 'very_loud'
}

export enum CommunicationType {
  VERBAL = 'verbal',
  NON_VERBAL = 'non_verbal',
  DIGITAL = 'digital',
  WRITTEN = 'written'
}

export enum ExcitementLevel {
  BORED = 'bored',
  CALM = 'calm',
  INTERESTED = 'interested',
  EXCITED = 'excited',
  THRILLED = 'thrilled'
}

export enum InteractionLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  HIGH = 'high',
  INTENSE = 'intense'
}

export enum LocationType {
  HOME = 'home',
  WORK = 'work',
  SCHOOL = 'school',
  STORE = 'store',
  RESTAURANT = 'restaurant',
  PARK = 'park',
  TRANSPORT = 'transport'
}