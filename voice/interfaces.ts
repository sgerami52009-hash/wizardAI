/**
 * Core interfaces for voice pipeline components
 * Safety: All voice processing must validate child-safe content
 * Performance: Target <500ms response latency on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { ConversationContext } from '../models/conversation-context';

// Re-export for convenience
export { ConversationContext };

// Audio processing types
export interface AudioBuffer {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

export interface AudioStream extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  write(buffer: AudioBuffer): void;
  read(): AudioBuffer | null;
  isActive(): boolean;
}

// Wake word detection
export interface WakeWordDetector extends EventEmitter {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  updateSensitivity(level: number): void;
  addWakeWord(phrase: string, modelPath: string): Promise<void>;
  removeWakeWord(phrase: string): Promise<void>;
  getActiveWakeWords(): string[];
}

export interface WakeWordResult {
  phrase: string;
  confidence: number;
  timestamp: number;
  audioSegment?: AudioBuffer;
}

// Speech recognition
export interface SpeechRecognizer extends EventEmitter {
  recognize(audioStream: AudioStream, userId?: string): Promise<RecognitionResult>;
  startStreaming(userId?: string): StreamingRecognition;
  updateUserProfile(userId: string, profile: VoiceProfile): void;
  setLanguage(language: string): void;
  getAvailableLanguages(): string[];
}

export interface RecognitionResult {
  text: string;
  confidence: number;
  alternatives: string[];
  processingTime: number;
  language: string;
  userId?: string;
}

export interface StreamingRecognition extends EventEmitter {
  onPartialResult(callback: (text: string) => void): void;
  onFinalResult(callback: (result: RecognitionResult) => void): void;
  onError(callback: (error: Error) => void): void;
  stop(): void;
}

// Text-to-speech
export interface TextToSpeechEngine extends EventEmitter {
  synthesize(text: string, options: TTSOptions): Promise<AudioBuffer>;
  startStreaming(text: string, options: TTSOptions): AudioStream;
  setVoice(voiceId: string): void;
  updateSpeechRate(rate: number): void;
  getAvailableVoices(): VoiceInfo[];
  stop(): void;
}

export interface TTSOptions {
  voiceId: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0
  emotion?: 'neutral' | 'happy' | 'concerned' | 'excited';
  ssml?: boolean;
}

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  ageGroup: 'child' | 'adult';
}

// Intent processing
export interface IntentClassifier extends EventEmitter {
  classifyIntent(text: string, context: ConversationContext): Promise<IntentResult>;
  registerIntent(intent: IntentDefinition): void;
  updateContext(context: ConversationContext): void;
  getRegisteredIntents(): IntentDefinition[];
}

export interface IntentResult {
  intent: string;
  confidence: number;
  parameters: Record<string, any>;
  requiresConfirmation: boolean;
  alternatives?: IntentResult[];
}

export interface IntentDefinition {
  name: string;
  patterns: string[];
  parameters: ParameterDefinition[];
  requiredConfidence: number;
  safetyLevel: 'child' | 'teen' | 'adult';
}

export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'time' | 'entity';
  required: boolean;
  validation?: (value: any) => boolean;
}

// Command routing
export interface CommandRouter extends EventEmitter {
  routeCommand(intent: IntentResult, userId: string): Promise<CommandResult>;
  registerHandler(intent: string, handler: CommandHandler): void;
  executeCommand(command: Command): Promise<CommandResult>;
  getRegisteredHandlers(): Map<string, CommandHandler>;
}

export interface CommandHandler {
  canHandle(intent: string): boolean;
  execute(command: Command): Promise<CommandResult>;
  validate(command: Command): boolean;
  getRequiredPermissions(): string[];
}

export interface Command {
  intent: string;
  parameters: Record<string, any>;
  userId: string;
  sessionId: string;
  timestamp: Date;
  context: ConversationContext;
}

export interface CommandResult {
  success: boolean;
  response: string;
  data?: any;
  executionTime: number;
  requiresFollowUp?: boolean;
  nextActions?: string[];
}

// Response generation
export interface ResponseGenerator extends EventEmitter {
  generateResponse(result: CommandResult, context: ResponseContext): Promise<string>;
  setPersonality(personality: PersonalityProfile): void;
  addResponseTemplate(intent: string, template: ResponseTemplate): void;
  getAvailableTemplates(): Map<string, ResponseTemplate>;
}

export interface ResponseContext {
  userId: string;
  conversationHistory: ConversationTurn[];
  currentIntent: string;
  userPreferences: UserPreferences;
  safetyLevel: 'child' | 'teen' | 'adult';
}

export interface ResponseTemplate {
  patterns: string[];
  variables: string[];
  safetyValidated: boolean;
  personalityAdaptations: Record<string, string>;
}

// Pipeline orchestration
export interface VoicePipelineOrchestrator extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  processVoiceInput(audioStream: AudioStream, userId?: string): Promise<void>;
  getStatus(): PipelineStatus;
  getMetrics(): PipelineMetrics;
}

export interface PipelineStatus {
  isActive: boolean;
  currentStage: 'idle' | 'listening' | 'processing' | 'responding';
  activeUsers: string[];
  resourceUsage: ResourceUsage;
  lastActivity: Date;
}

export interface PipelineMetrics {
  totalInteractions: number;
  averageLatency: number;
  successRate: number;
  errorCounts: Record<string, number>;
  resourcePeaks: ResourceUsage;
}

export interface ResourceUsage {
  memoryMB: number;
  cpuPercent: number;
  gpuPercent?: number;
  diskIOPS?: number;
}