/**
 * User profile management and data structures
 * Safety: All user data encrypted with AES-256, PII sanitized in logs
 * Performance: Efficient profile loading and caching for quick access
 */

export interface UserProfile {
  id: string;
  name: string;
  ageGroup: 'child' | 'teen' | 'adult';
  createdAt: Date;
  lastActive: Date;
  preferences: UserPreferences;
  voiceProfile: VoiceProfile;
  safetySettings: SafetySettings;
  parentalControls?: ParentalControls;
  encryptionKey: string;
}

export interface UserPreferences {
  language: string;
  voiceSettings: VoiceSettings;
  interactionStyle: InteractionStyle;
  privacySettings: PrivacySettings;
  accessibilitySettings: AccessibilitySettings;
  notificationSettings: NotificationSettings;
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

export interface NotificationSettings {
  enableAudio: boolean;
  enableVisual: boolean;
  enableHaptic: boolean;
  quietHours: TimeSlot[];
  urgencyLevels: string[];
}

export interface SafetySettings {
  contentFilterLevel: 'strict' | 'moderate' | 'relaxed';
  allowedTopics: string[];
  blockedTopics: string[];
  requireSupervision: boolean;
  auditLogging: boolean;
}

export interface ParentalControls {
  parentId: string;
  allowedHours: TimeSlot[];
  allowedCommands: string[];
  blockedCommands: string[];
  supervisionRequired: boolean;
  approvalRequired: string[];
  emergencyOverride: boolean;
}

export interface TimeSlot {
  start: string; // HH:MM
  end: string;   // HH:MM
  days: number[]; // 0-6, Sunday = 0
}

// Re-export from voice-models for consistency
export { VoiceProfile, AccentModel, SpeechPattern } from './voice-models';/**

 * Sanitizes text for logging by removing PII and limiting length
 * Safety: Ensures no sensitive information is logged
 */
export function sanitizeForLog(text: string): string {
  if (!text) return '';
  
  // Remove potential PII patterns
  let sanitized = text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // SSN
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]') // Phone numbers
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[CARD]') // Credit card
    .replace(/\b\d{1,5}\s[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi, '[ADDRESS]'); // Addresses

  // Limit length for logs
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 97) + '...';
  }

  return sanitized;
}