// Core Avatar System Types and Interfaces

export interface AvatarConfiguration {
  userId: string;
  version: string;
  appearance: AppearanceConfiguration;
  personality: PersonalityTraits;
  voice: VoiceCharacteristics;
  emotions: EmotionalConfiguration;
  createdAt: Date;
  lastModified: Date;
  parentallyApproved: boolean;
}

export interface AppearanceConfiguration {
  face: ExtendedFaceConfiguration;
  hair: ExtendedHairConfiguration;
  clothing: ExtendedClothingConfiguration;
  accessories: ExtendedAccessoryConfiguration[];
  animations: ExtendedAnimationSet;
}

export interface FaceConfiguration {
  meshId: string;
  textureId: string;
  eyeColor: string;
  skinTone: string;
  features: FacialFeatures;
}

export interface HairConfiguration {
  styleId: string;
  color: string;
  length: number;
  texture: HairTexture;
}

export interface ClothingConfiguration {
  topId: string;
  bottomId: string;
  shoesId: string;
  colors: ClothingColors;
}

export interface AccessoryConfiguration {
  id: string;
  type: AccessoryType;
  position: Vector3;
  scale: number;
}

export interface PersonalityTraits {
  friendliness: number; // 1-10 scale
  formality: number; // 1-10 scale
  humor: number; // 1-10 scale
  enthusiasm: number; // 1-10 scale
  patience: number; // 1-10 scale
  supportiveness: number; // 1-10 scale
}

export interface VoiceCharacteristics {
  pitch: number; // -2.0 to 2.0
  speed: number; // 0.5 to 2.0
  accent: AccentType;
  emotionalTone: EmotionalTone;
  volume: number; // 0.0 to 1.0
}

export interface EmotionalConfiguration {
  defaultEmotion: EmotionType;
  expressionIntensity: number;
  transitionSpeed: number;
  emotionMappings: EmotionMapping[];
}

export interface CustomizationChange {
  changeId: string;
  type: 'appearance' | 'personality' | 'voice' | 'emotion';
  category: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  requiresApproval: boolean;
}

// Supporting Types
export interface FacialFeatures {
  eyeSize: number;
  noseSize: number;
  mouthSize: number;
  cheekbones: number;
}

export interface AnimationSet {
  idle: string;
  talking: string;
  listening: string;
  thinking: string;
  expressions: ExpressionAnimations;
}

export interface ExpressionAnimations {
  happy: string;
  sad: string;
  surprised: string;
  confused: string;
  excited: string;
}

export interface ClothingColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface EmotionMapping {
  trigger: string;
  emotion: EmotionType;
  intensity: number;
  duration: number;
}

// Enums
export enum AccessoryType {
  HAT = 'hat',
  GLASSES = 'glasses',
  JEWELRY = 'jewelry',
  BACKPACK = 'backpack'
}

export enum AccentType {
  NEUTRAL = 'neutral',
  BRITISH = 'british',
  AMERICAN = 'american',
  AUSTRALIAN = 'australian'
}

export enum EmotionalTone {
  CHEERFUL = 'cheerful',
  CALM = 'calm',
  ENERGETIC = 'energetic',
  GENTLE = 'gentle'
}

export enum EmotionType {
  NEUTRAL = 'neutral',
  HAPPY = 'happy',
  SAD = 'sad',
  EXCITED = 'excited',
  SURPRISED = 'surprised',
  CONFUSED = 'confused',
  THINKING = 'thinking'
}

export enum HairTexture {
  STRAIGHT = 'straight',
  WAVY = 'wavy',
  CURLY = 'curly',
  COILY = 'coily'
}

export enum AgeRange {
  TODDLER = '2-4',
  CHILD = '5-12',
  TEEN = '13-17',
  ADULT = '18+'
}

export enum SafetyRating {
  SAFE = 'safe',
  CAUTION = 'caution',
  RESTRICTED = 'restricted',
  BLOCKED = 'blocked'
}

export enum PerformanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

// Additional types for AppearanceManager

export interface AppearanceChange {
  changeId: string;
  type: 'face' | 'hair' | 'clothing' | 'accessory';
  oldConfiguration: AppearanceConfiguration;
  newConfiguration: AppearanceConfiguration;
  timestamp: Date;
  userId: string;
}

export interface RenderResult {
  success: boolean;
  renderTime: number;
  triangleCount: number;
  textureMemory: number;
  errors?: string[];
}

export interface SafetyResult {
  isAllowed: boolean;
  violations: string[];
  riskLevel: RiskLevel;
  reason: string;
  requiresParentalApproval: boolean;
  blockedContent: string[];
  recommendations: string[];
}

export interface AssetCategory {
  name: string;
  type: 'face' | 'hair' | 'clothing' | 'accessory' | 'animation';
  ageRestrictions: AgeRange[];
}

export interface AssetCollection {
  category: AssetCategory;
  assets: AssetInfo[];
  totalCount: number;
  filteredByAge: number;
}

export interface AssetInfo {
  id: string;
  name: string;
  category: AssetCategory;
  ageRestriction: { min: number; max: number };
  performanceImpact: PerformanceLevel;
  safetyRating: SafetyRating;
  thumbnailUrl?: string;
}

export interface AvatarCustomization {
  appearance: AppearanceConfiguration;
  personality: PersonalityTraits;
  voice: VoiceCharacteristics;
  emotions: EmotionalConfiguration;
}

export interface SafetyValidationResult {
  isAllowed: boolean;
  requiresApproval: boolean;
  blockedElements: string[];
  riskAssessment: RiskLevel;
  parentalMessage?: string;
}

export interface ReviewRequest {
  reviewId: string;
  userId: string;
  customization: AvatarCustomization;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  safetyAssessment: SafetyValidationResult;
}

export interface ParentalDecision {
  reviewId: string;
  parentId: string;
  approved: boolean;
  reason?: string;
  timestamp: Date;
}

export interface SafetyAuditEntry {
  timestamp: Date;
  userId: string;
  action: string;
  details: any;
  riskLevel: RiskLevel;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export type RiskLevel = 'low' | 'medium' | 'high';

// Enhanced safety validation types
export interface ContentSafetyIntegration {
  validateContent(content: any): Promise<boolean>;
  getContentRating(content: any): Promise<SafetyRating>;
  reportViolation(violation: SafetyViolation): Promise<void>;
}

export interface SafetyViolation {
  type: string;
  severity: RiskLevel;
  description: string;
  userId: string;
  timestamp: Date;
}

export interface ParentalApprovalWorkflow {
  submitForApproval(request: ApprovalRequest): Promise<string>;
  checkApprovalStatus(requestId: string): Promise<ApprovalStatus>;
  processDecision(requestId: string, decision: boolean, reason?: string): Promise<void>;
}

export interface ApprovalRequest {
  userId: string;
  parentId: string;
  customization: AvatarCustomization;
  riskLevel: RiskLevel;
  urgency: 'low' | 'medium' | 'high';
  expiresAt: Date;
}

export interface ApprovalStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedAt?: Date;
  reason?: string;
}

export interface SafetyAuditReport {
  userId: string;
  timeRange: TimeRange;
  totalValidations: number;
  violationsDetected: number;
  parentalApprovals: number;
  riskDistribution: Record<RiskLevel, number>;
  commonViolations: string[];
  complianceScore?: number;
  safetyTrends?: SafetyTrend[];
  recommendations?: string[];
  generatedAt?: Date;
  reportType?: string;
  detailedEntries?: SafetyAuditEntry[];
  violationDetails?: any[];
  complianceDetails?: ComplianceDetails;
}

interface SafetyTrend {
  date: Date;
  safetyScore: number;
  violationCount: number;
  riskLevel: RiskLevel;
}

interface ComplianceDetails {
  copaCompliance: boolean;
  dataRetentionCompliance: boolean;
  parentalConsentCompliance: boolean;
  auditTrailCompliance: boolean;
  issues: string[];
}

export interface ParentalDashboard {
  childId: string;
  recentActivity: SafetyAuditEntry[];
  pendingApprovals: ReviewRequest[];
  safetyMetrics: ChildSafetyMetrics;
  recommendations: ParentalRecommendation[];
}

export interface ChildSafetyMetrics {
  safetyScore: number;
  violationCount: number;
  lastViolation?: Date;
  parentalInterventions: number;
  complianceRate: number;
  riskLevel: RiskLevel;
}

export interface ParentalRecommendation {
  type: 'safety' | 'privacy' | 'content' | 'behavior';
  priority: 'low' | 'medium' | 'high';
  description: string;
  actionRequired: boolean;
  targetChild?: string;
}

// Additional interfaces for personality and voice integration
export interface InteractionContext {
  userId: string;
  conversationId: string;
  emotionalState: string;
  recentTopics: string[];
}

export interface ResponseStyle {
  formality: number;
  enthusiasm: number;
  wordChoice: 'simple' | 'moderate' | 'advanced';
  responseLength: 'brief' | 'moderate' | 'detailed';
}

export interface PersonalityPreset {
  id: string;
  name: string;
  description: string;
  traits: PersonalityTraits;
  ageAppropriate: string[];
}

export interface VoicePreset {
  id: string;
  name: string;
  description: string;
  characteristics: VoiceCharacteristics;
  ageAppropriate: string[];
}

export interface ValidationResult {
  isValid: boolean;
  requiresParentalApproval: boolean;
  blockedElements: string[];
  warnings: string[];
  errors: string[];
}

// Extended face configuration with detail levels
export interface ExtendedFaceConfiguration extends FaceConfiguration {
  detailLevel: PerformanceLevel;
  textureQuality: number;
  matureFeatures?: boolean;
}

// Extended hair configuration with physics
export interface ExtendedHairConfiguration extends HairConfiguration {
  physicsEnabled: boolean;
  strandCount: number;
  detailLevel: PerformanceLevel;
}

// Extended clothing configuration with simulation
export interface ExtendedClothingConfiguration extends ClothingConfiguration {
  wrinkleSimulation: boolean;
  detailLevel: PerformanceLevel;
  textureQuality: number;
  revealingLevel: number; // 1-5 scale for age appropriateness
}

// Extended accessory configuration
export interface ExtendedAccessoryConfiguration extends AccessoryConfiguration {
  detailLevel: PerformanceLevel;
}

// Extended animation set with performance settings
export interface ExtendedAnimationSet extends AnimationSet {
  frameRate: number;
  blendingEnabled: boolean;
}