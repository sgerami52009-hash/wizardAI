/**
 * Voice processing data models and types
 * Safety: User voice profiles encrypted with user-specific keys
 * Performance: Optimized for memory efficiency on Jetson Nano Orin
 */

// User voice profile for personalized recognition
export interface VoiceProfile {
  userId: string;
  preferredLanguage: string;
  accentAdaptation: AccentModel;
  speechPatterns: SpeechPattern[];
  safetyLevel: 'child' | 'teen' | 'adult';
  lastUpdated: Date;
  encryptionKey?: string; // For secure storage
}

export interface AccentModel {
  region: string;
  confidence: number;
  adaptationData: Float32Array;
  phonemeMapping: Record<string, string>;
  lastTraining: Date;
}

export interface SpeechPattern {
  pattern: string;
  frequency: number;
  context: string[];
  confidence: number;
  lastSeen: Date;
}

// Conversation context and session management
export interface ConversationContext {
  sessionId: string;
  userId: string;
  startTime: Date;
  turns: ConversationTurn[];
  activeTopics: string[];
  pendingActions: PendingAction[];
  userPreferences: UserPreferences;
  safetyContext: SafetyContext;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  recognizedText: string;
  intent: IntentResult;
  response: string;
  executionResult: CommandResult;
  processingMetrics: ProcessingMetrics;
}

export interface PendingAction {
  id: string;
  type: string;
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
  expiresAt: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface ProcessingMetrics {
  recognitionTime: number;
  intentClassificationTime: number;
  safetyValidationTime: number;
  commandExecutionTime: number;
  responseGenerationTime: number;
  totalLatency: number;
}

// User preferences and personalization
export interface UserPreferences {
  userId: string;
  language: string;
  voiceSettings: VoiceSettings;
  interactionStyle: InteractionStyle;
  privacySettings: PrivacySettings;
  accessibilitySettings: AccessibilitySettings;
  parentalControls?: ParentalControlSettings;
}

export interface VoiceSettings {
  preferredVoice: string;
  speechRate: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0
  pitch: number; // 0.5 to 2.0
  emotionalTone: 'neutral' | 'friendly' | 'professional' | 'playful';
}

export interface InteractionStyle {
  verbosity: 'brief' | 'normal' | 'detailed';
  formality: 'casual' | 'polite' | 'formal';
  confirmationLevel: 'minimal' | 'standard' | 'verbose';
  errorHandling: 'retry' | 'clarify' | 'fallback';
}

export interface PrivacySettings {
  dataRetention: 'session' | 'short' | 'long' | 'permanent';
  shareWithFamily: boolean;
  allowPersonalization: boolean;
  voiceDataStorage: 'none' | 'encrypted' | 'anonymous';
}

export interface AccessibilitySettings {
  hearingImpaired: boolean;
  speechImpaired: boolean;
  visualFeedback: boolean;
  hapticFeedback: boolean;
  slowSpeech: boolean;
  repeatConfirmations: boolean;
}

export interface ParentalControlSettings {
  parentId: string;
  ageGroup: 'child' | 'teen';
  allowedHours: TimeSlot[];
  contentFiltering: ContentFilteringLevel;
  supervisionRequired: boolean;
  allowedCommands: string[];
  blockedCommands: string[];
}

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
  days: number[]; // 0-6, Sunday = 0
}

export type ContentFilteringLevel = 'strict' | 'moderate' | 'relaxed';

// Safety context for content validation
export interface SafetyContext {
  currentAgeGroup: 'child' | 'teen' | 'adult';
  parentalSupervision: boolean;
  contentHistory: string[];
  riskFactors: RiskFactor[];
  safetyOverrides: SafetyOverride[];
}

export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
}

export interface SafetyOverride {
  id: string;
  pattern: string;
  approved: boolean;
  authorizedBy: string;
  expiresAt?: Date;
}

// Personality and avatar integration
export interface PersonalityProfile {
  id: string;
  name: string;
  traits: PersonalityTrait[];
  responseStyle: ResponseStyle;
  voiceCharacteristics: VoiceCharacteristics;
  ageAppropriate: boolean;
  safetyValidated: boolean;
}

export interface PersonalityTrait {
  name: string;
  value: number; // -1.0 to 1.0
  description: string;
}

export interface ResponseStyle {
  enthusiasm: number; // 0.0 to 1.0
  helpfulness: number; // 0.0 to 1.0
  patience: number; // 0.0 to 1.0
  humor: number; // 0.0 to 1.0
  formality: number; // 0.0 to 1.0
}

export interface VoiceCharacteristics {
  baseVoice: string;
  pitchModification: number;
  speedModification: number;
  emotionalRange: string[];
  accentStrength: number;
}

// Import shared types from other modules
export interface IntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
  alternatives?: IntentResult[];
}

export interface CommandResult {
  success: boolean;
  response: string;
  data?: any;
  executionTime: number;
  requiresFollowUp?: boolean;
  nextActions?: string[];
}