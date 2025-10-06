// Core Avatar System Interfaces

import { AvatarConfiguration, PersonalityTraits, VoiceCharacteristics, AppearanceConfiguration, CustomizationChange } from './types';

export interface AvatarCustomizationController {
  startCustomization(userId: string): Promise<CustomizationSession>;
  previewChange(change: CustomizationChange): Promise<PreviewResult>;
  applyCustomization(customization: AvatarConfiguration): Promise<ValidationResult>;
  saveCustomization(userId: string): Promise<void>;
  loadUserAvatar(userId: string): Promise<AvatarConfiguration>;
  resetToDefaults(userId: string): Promise<void>;
}

export interface CustomizationSession {
  sessionId: string;
  userId: string;
  currentConfiguration: AvatarConfiguration;
  pendingChanges: CustomizationChange[];
  previewActive: boolean;
}

// CustomizationChange is now imported from types.ts

export interface PreviewResult {
  success: boolean;
  renderTime: number;
  performanceImpact: number;
  errors: string[];
}

export interface ValidationResult {
  isValid: boolean;
  requiresParentalApproval: boolean;
  blockedElements: string[];
  warnings: string[];
  errors: string[];
}

export interface AppearanceManager {
  updateAppearance(change: AppearanceChange): Promise<RenderResult>;
  previewAppearance(configuration: AppearanceConfiguration): Promise<void>;
  validateAppearanceContent(configuration: AppearanceConfiguration): Promise<SafetyResult>;
  getAvailableAssets(category: AssetCategory, userAge: number): Promise<AssetCollection>;
  optimizeForPerformance(configuration: AppearanceConfiguration): AppearanceConfiguration;
}

export interface PersonalityManager {
  updatePersonality(traits: PersonalityTraits): Promise<ValidationResult>;
  validatePersonalityTraits(traits: PersonalityTraits, userAge: number): Promise<SafetyResult>;
  generateResponseStyle(traits: PersonalityTraits, context: InteractionContext): ResponseStyle;
  getPersonalityPresets(userAge: number): Promise<PersonalityPreset[]>;
  integrateWithVoicePipeline(traits: PersonalityTraits): Promise<void>;
}

export interface VoiceCharacteristicsManager {
  updateVoiceCharacteristics(characteristics: VoiceCharacteristics): Promise<ValidationResult>;
  previewVoice(characteristics: VoiceCharacteristics, sampleText: string): Promise<AudioBuffer>;
  validateVoiceSettings(characteristics: VoiceCharacteristics, userAge: number): Promise<SafetyResult>;
  integrateWithTTS(characteristics: VoiceCharacteristics): Promise<void>;
  getVoicePresets(userAge: number): Promise<VoicePreset[]>;
}

export interface AvatarSafetyValidator {
  validateCustomization(customization: AvatarConfiguration, userAge: number): Promise<SafetyValidationResult>;
  requiresParentalApproval(customization: AvatarConfiguration, userId: string): Promise<boolean>;
  submitForParentalReview(customization: AvatarConfiguration, userId: string): Promise<ReviewRequest>;
  processParentalDecision(reviewId: string, decision: ParentalDecision): Promise<void>;
  getAuditLog(userId: string, timeRange: TimeRange): Promise<SafetyAuditEntry[]>;
}

export interface AvatarDataStore {
  saveAvatarConfiguration(userId: string, configuration: AvatarConfiguration): Promise<void>;
  loadAvatarConfiguration(userId: string): Promise<AvatarConfiguration>;
  createBackup(userId: string): Promise<BackupInfo>;
  restoreFromBackup(userId: string, backupId: string): Promise<void>;
  verifyDataIntegrity(userId: string): Promise<IntegrityResult>;
  migrateUserData(oldUserId: string, newUserId: string): Promise<void>;
}

// Supporting interfaces
export interface AppearanceChange {
  category: 'face' | 'hair' | 'clothing' | 'accessories';
  property: string;
  value: any;
  userId: string;
}

export interface RenderResult {
  success: boolean;
  frameTime: number;
  triangleCount: number;
  memoryUsage: number;
}

export interface SafetyResult {
  isAllowed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  blockedContent: string[];
  recommendations: string[];
}

export interface AssetCategory {
  id: string;
  name: string;
  ageRestrictions: string[];
  performanceImpact: number;
}

export interface AssetCollection {
  category: AssetCategory;
  assets: Asset[];
  totalCount: number;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  ageRating: string;
  performanceLevel: string;
  fileSize: number;
}

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

export interface SafetyValidationResult {
  isAllowed: boolean;
  requiresApproval: boolean;
  blockedElements: string[];
  riskAssessment: 'low' | 'medium' | 'high';
  parentalMessage?: string;
}

export interface ReviewRequest {
  id: string;
  userId: string;
  customization: AvatarConfiguration;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ParentalDecision {
  approved: boolean;
  reason?: string;
  restrictions?: string[];
  decidedAt: Date;
}

export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface SafetyAuditEntry {
  id: string;
  userId: string;
  action: string;
  result: string;
  timestamp: Date;
  details: any;
}

export interface BackupInfo {
  id: string;
  userId: string;
  createdAt: Date;
  size: number;
  checksum: string;
}

export interface IntegrityResult {
  isValid: boolean;
  corruptedFiles: string[];
  repairActions: string[];
}