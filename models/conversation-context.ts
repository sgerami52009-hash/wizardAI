/**
 * Conversation context and session management
 * Safety: Context data sanitized, no persistent voice data storage
 * Performance: Efficient context switching and memory management
 */

export interface ConversationSession {
  id: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'ended';
  context: ConversationContext;
  metrics: SessionMetrics;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  turns: ConversationTurn[];
  activeTopics: string[];
  pendingActions: PendingAction[];
  userPreferences: UserPreferences;
  safetyContext: SafetyContext;
  environmentContext: EnvironmentContext;
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
  safetyChecks: SafetyCheckResult[];
}

export interface PendingAction {
  id: string;
  type: string;
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
  expiresAt: Date;
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
}

export interface ProcessingMetrics {
  recognitionTime: number;
  intentClassificationTime: number;
  safetyValidationTime: number;
  commandExecutionTime: number;
  responseGenerationTime: number;
  totalLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface SafetyCheckResult {
  checkType: string;
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  details: string;
  timestamp: Date;
}

export interface EnvironmentContext {
  location: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  ambientNoise: 'quiet' | 'moderate' | 'noisy';
  otherUsers: string[];
  deviceStatus: DeviceStatus;
}

export interface DeviceStatus {
  batteryLevel?: number;
  networkConnected: boolean;
  resourceUsage: ResourceUsage;
  temperature: number;
  availableStorage: number;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  gpuPercent?: number;
  diskIOPS?: number;
}

export interface SessionMetrics {
  totalTurns: number;
  averageLatency: number;
  successfulCommands: number;
  failedCommands: number;
  safetyViolations: number;
  userSatisfaction?: number;
  duration: number;
}

// Import shared types
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

export interface UserPreferences {
  language: string;
  voiceSettings: any;
  interactionStyle: any;
  privacySettings: any;
  accessibilitySettings: any;
}

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