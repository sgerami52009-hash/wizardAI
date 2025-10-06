// Avatar State Synchronization System for Voice Interactions

import { 
  EmotionType as AvatarEmotionType, 
  VoiceCharacteristics, 
  PersonalityTraits,
  AvatarConfiguration 
} from './types';
import { avatarEventBus } from './events';

/**
 * Voice interaction context for avatar state management
 */
export interface VoiceInteractionContext {
  userId: string;
  conversationId: string;
  sessionId: string;
  isActive: boolean;
  currentPhase: VoiceInteractionPhase;
  emotionalContext: EmotionalContext;
  conversationAnalysis: ConversationAnalysis;
  environmentalFactors: EnvironmentalFactors;
  timestamp: Date;
}

/**
 * Emotional context derived from conversation analysis
 */
export interface EmotionalContext {
  detectedEmotion: AvatarEmotionType;
  emotionConfidence: number;
  emotionIntensity: number;
  emotionTrend: EmotionTrend;
  contextualFactors: string[];
  previousEmotion?: AvatarEmotionType;
  transitionReason?: string;
}

/**
 * Conversation analysis data for avatar behavior
 */
export interface ConversationAnalysis {
  sentiment: SentimentAnalysis;
  topics: string[];
  userEngagement: EngagementLevel;
  conversationFlow: ConversationFlow;
  speechPatterns: SpeechPatterns;
  contextualCues: ContextualCue[];
}

/**
 * Environmental factors affecting avatar behavior
 */
export interface EnvironmentalFactors {
  noiseLevel: number;
  privacyLevel: PrivacyLevel;
  timeOfDay: TimeOfDay;
  userProximity: ProximityLevel;
  deviceOrientation: DeviceOrientation;
  ambientLighting: LightingCondition;
}

/**
 * Avatar state for voice interactions
 */
export interface AvatarVoiceInteractionState {
  userId: string;
  currentEmotion: AvatarEmotionType;
  emotionIntensity: number;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  isIdle: boolean;
  currentAnimation: string;
  animationQueue: AnimationRequest[];
  voiceCharacteristics: VoiceCharacteristics;
  personalityContext: PersonalityTraits;
  interactionContext: VoiceInteractionContext;
  lastStateChange: Date;
  stateHistory: StateHistoryEntry[];
}

/**
 * Animation request for voice-triggered animations
 */
export interface AnimationRequest {
  id: string;
  type: AnimationType;
  trigger: AnimationTrigger;
  emotion?: AvatarEmotionType;
  intensity: number;
  duration?: number;
  priority: AnimationPriority;
  blendMode: AnimationBlendMode;
  timestamp: Date;
}

/**
 * Speech synthesis coordination data
 */
export interface SpeechSynthesisCoordination {
  speechId: string;
  text: string;
  voiceCharacteristics: VoiceCharacteristics;
  emotionalExpression: AvatarEmotionType;
  animationSequence: AnimationSequence;
  timingMarkers: TimingMarker[];
  coordinationState: CoordinationState;
}

/**
 * Context-aware behavior configuration
 */
export interface ContextAwareBehavior {
  behaviorId: string;
  triggers: BehaviorTrigger[];
  conditions: BehaviorCondition[];
  actions: BehaviorAction[];
  priority: number;
  isActive: boolean;
  cooldownPeriod?: number;
  lastTriggered?: Date;
}

// Supporting interfaces and types

export interface SentimentAnalysis {
  polarity: number; // -1 to 1
  subjectivity: number; // 0 to 1
  confidence: number;
  keywords: string[];
}

export interface SpeechPatterns {
  speechRate: number;
  pauseFrequency: number;
  volumeVariation: number;
  pitchVariation: number;
  emotionalMarkers: string[];
}

export interface ContextualCue {
  type: CueType;
  content: string;
  confidence: number;
  relevance: number;
  timestamp: Date;
}

export interface StateHistoryEntry {
  timestamp: Date;
  previousState: Partial<AvatarVoiceInteractionState>;
  newState: Partial<AvatarVoiceInteractionState>;
  trigger: string;
  reason: string;
}

export interface AnimationSequence {
  sequences: AnimationStep[];
  totalDuration: number;
  syncPoints: SyncPoint[];
}

export interface AnimationStep {
  animationType: AnimationType;
  startTime: number;
  duration: number;
  intensity: number;
  blendWeight: number;
}

export interface TimingMarker {
  time: number;
  type: MarkerType;
  data: any;
}

export interface SyncPoint {
  time: number;
  speechPosition: number;
  animationFrame: number;
  emotionIntensity: number;
}

export interface BehaviorTrigger {
  type: TriggerType;
  condition: string;
  threshold?: number;
  duration?: number;
}

export interface BehaviorCondition {
  type: ConditionType;
  parameter: string;
  operator: ComparisonOperator;
  value: any;
}

export interface BehaviorAction {
  type: ActionType;
  parameters: Record<string, any>;
  delay?: number;
  duration?: number;
}

// Enums

export enum VoiceInteractionPhase {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  RESPONDING = 'responding',
  WAITING = 'waiting'
}

export enum EmotionTrend {
  STABLE = 'stable',
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  FLUCTUATING = 'fluctuating'
}

export enum EngagementLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum ConversationFlow {
  NATURAL = 'natural',
  STRUCTURED = 'structured',
  INTERRUPTED = 'interrupted',
  CONFUSED = 'confused'
}

export enum PrivacyLevel {
  PRIVATE = 'private',
  SEMI_PRIVATE = 'semi_private',
  PUBLIC = 'public'
}

export enum TimeOfDay {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  NIGHT = 'night'
}

export enum ProximityLevel {
  VERY_CLOSE = 'very_close',
  CLOSE = 'close',
  MODERATE = 'moderate',
  FAR = 'far'
}

export enum DeviceOrientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
  TILTED = 'tilted'
}

export enum LightingCondition {
  BRIGHT = 'bright',
  NORMAL = 'normal',
  DIM = 'dim',
  DARK = 'dark'
}

export enum AnimationType {
  IDLE = 'idle',
  LISTENING = 'listening',
  THINKING = 'thinking',
  SPEAKING = 'speaking',
  EMOTIONAL_EXPRESSION = 'emotional_expression',
  GESTURE = 'gesture',
  TRANSITION = 'transition'
}

export enum AnimationTrigger {
  VOICE_START = 'voice_start',
  VOICE_END = 'voice_end',
  EMOTION_CHANGE = 'emotion_change',
  CONVERSATION_ANALYSIS = 'conversation_analysis',
  CONTEXT_CHANGE = 'context_change',
  MANUAL = 'manual'
}

export enum AnimationPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum AnimationBlendMode {
  REPLACE = 'replace',
  ADDITIVE = 'additive',
  OVERLAY = 'overlay',
  MULTIPLY = 'multiply'
}

export enum CoordinationState {
  PREPARING = 'preparing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum CueType {
  VERBAL = 'verbal',
  EMOTIONAL = 'emotional',
  CONTEXTUAL = 'contextual',
  BEHAVIORAL = 'behavioral'
}

export enum MarkerType {
  WORD_BOUNDARY = 'word_boundary',
  SENTENCE_BOUNDARY = 'sentence_boundary',
  EMOTION_PEAK = 'emotion_peak',
  EMPHASIS = 'emphasis'
}

export enum TriggerType {
  EMOTION_CHANGE = 'emotion_change',
  CONVERSATION_STATE = 'conversation_state',
  TIME_BASED = 'time_based',
  CONTEXT_CHANGE = 'context_change'
}

export enum ConditionType {
  EMOTION_LEVEL = 'emotion_level',
  ENGAGEMENT_LEVEL = 'engagement_level',
  TIME_CONDITION = 'time_condition',
  CONTEXT_CONDITION = 'context_condition'
}

export enum ComparisonOperator {
  EQUALS = 'equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains'
}

export enum ActionType {
  CHANGE_EMOTION = 'change_emotion',
  TRIGGER_ANIMATION = 'trigger_animation',
  ADJUST_VOICE = 'adjust_voice',
  UPDATE_BEHAVIOR = 'update_behavior'
}

/**
 * Avatar State Synchronization Manager
 * Manages avatar state during voice interactions with context awareness
 */
export class AvatarStateSynchronizationManager {
  private avatarStates: Map<string, AvatarVoiceInteractionState> = new Map();
  private contextAwareBehaviors: Map<string, ContextAwareBehavior[]> = new Map();
  private speechCoordination: Map<string, SpeechSynthesisCoordination> = new Map();
  private isInitialized: boolean = false;
  private stateUpdateInterval?: NodeJS.Timeout;
  private readonly STATE_UPDATE_FREQUENCY = 100; // 100ms for smooth updates

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the avatar state synchronization system
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Start state update loop
      this.startStateUpdateLoop();
      
      // Load default context-aware behaviors
      await this.loadDefaultBehaviors();
      
      this.isInitialized = true;
      
      avatarEventBus.emitSystemRecovery(
        'avatar-state-synchronization',
        'Avatar state synchronization system initialized successfully'
      );
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'INITIALIZATION_FAILED',
        message: `Failed to initialize avatar state synchronization: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'error',
        recoverable: true
      });
      throw error;
    }
  }

  /**
   * Create or update avatar state for voice interaction context
   */
  async updateAvatarStateForVoiceContext(
    userId: string,
    context: VoiceInteractionContext
  ): Promise<void> {
    try {
      let currentState = this.avatarStates.get(userId);
      
      if (!currentState) {
        currentState = await this.createDefaultAvatarState(userId, context);
      }

      // Analyze context changes and update state accordingly
      const stateChanges = await this.analyzeContextChanges(currentState, context);
      
      // Apply state changes
      const updatedState = await this.applyStateChanges(currentState, stateChanges, context);
      
      // Update state history
      this.updateStateHistory(currentState, updatedState, 'voice_context_update');
      
      // Store updated state
      this.avatarStates.set(userId, updatedState);
      
      // Emit state change event
      avatarEventBus.emitAvatarConfigurationChanged(userId, {
        userId,
        version: '1.0.0',
        appearance: {} as any,
        personality: updatedState.personalityContext,
        voice: updatedState.voiceCharacteristics,
        emotions: {
          defaultEmotion: updatedState.currentEmotion,
          expressionIntensity: updatedState.emotionIntensity,
          transitionSpeed: 1.0,
          emotionMappings: []
        },
        createdAt: new Date(),
        lastModified: new Date(),
        parentallyApproved: true
      });
      
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'STATE_UPDATE_FAILED',
        message: `Failed to update avatar state for voice context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'warning',
        recoverable: true,
        context: { userId }
      });
    }
  }

  /**
   * Trigger emotional expression based on conversation analysis
   */
  async triggerEmotionalExpression(
    userId: string,
    conversationAnalysis: ConversationAnalysis,
    emotionalContext: EmotionalContext
  ): Promise<void> {
    try {
      const currentState = this.avatarStates.get(userId);
      if (!currentState) {
        throw new Error(`No avatar state found for user ${userId}`);
      }

      // Determine appropriate emotional expression
      const targetEmotion = await this.determineTargetEmotion(
        conversationAnalysis,
        emotionalContext,
        currentState
      );

      // Calculate emotion transition parameters
      const transitionParams = await this.calculateEmotionTransition(
        currentState.currentEmotion,
        targetEmotion,
        emotionalContext
      );

      // Create animation request for emotional expression
      const animationRequest: AnimationRequest = {
        id: `emotion_${Date.now()}`,
        type: AnimationType.EMOTIONAL_EXPRESSION,
        trigger: AnimationTrigger.CONVERSATION_ANALYSIS,
        emotion: targetEmotion,
        intensity: emotionalContext.emotionIntensity,
        duration: transitionParams.duration,
        priority: AnimationPriority.HIGH,
        blendMode: AnimationBlendMode.OVERLAY,
        timestamp: new Date()
      };

      // Queue animation
      await this.queueAnimation(userId, animationRequest);

      // Update emotional state
      await this.updateEmotionalState(userId, targetEmotion, emotionalContext);

      // Emit emotion change event
      avatarEventBus.emitEmotionChanged(userId, targetEmotion, emotionalContext.emotionIntensity);
      
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'EMOTION_TRIGGER_FAILED',
        message: `Failed to trigger emotional expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'warning',
        recoverable: true,
        context: { userId }
      });
    }
  }

  /**
   * Coordinate avatar animation with speech synthesis
   */
  async coordinateWithSpeechSynthesis(
    userId: string,
    speechData: {
      text: string;
      voiceCharacteristics: VoiceCharacteristics;
      emotion: AvatarEmotionType;
      duration: number;
    }
  ): Promise<string> {
    try {
      // Validate inputs
      if (!speechData.text || speechData.text.trim() === '') {
        throw new Error('Speech text cannot be empty');
      }
      
      if (speechData.duration <= 0) {
        throw new Error('Speech duration must be positive');
      }
      
      const currentState = this.avatarStates.get(userId);
      if (!currentState) {
        throw new Error(`No avatar state found for user ${userId}`);
      }

      const speechId = `speech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate animation sequence for speech
      const animationSequence = await this.generateSpeechAnimationSequence(
        speechData.text,
        speechData.emotion,
        speechData.duration
      );

      // Create timing markers for synchronization
      const timingMarkers = await this.generateTimingMarkers(
        speechData.text,
        animationSequence
      );

      // Create speech synthesis coordination
      const coordination: SpeechSynthesisCoordination = {
        speechId,
        text: speechData.text,
        voiceCharacteristics: speechData.voiceCharacteristics,
        emotionalExpression: speechData.emotion,
        animationSequence,
        timingMarkers,
        coordinationState: CoordinationState.PREPARING
      };

      // Store coordination data
      this.speechCoordination.set(speechId, coordination);

      // Update avatar state to speaking
      await this.updateVoiceInteractionPhase(userId, VoiceInteractionPhase.RESPONDING);

      // Start animation coordination
      await this.startAnimationCoordination(userId, coordination);

      // Queue additional animations from the sequence
      for (const step of animationSequence.sequences) {
        if (step.animationType !== AnimationType.SPEAKING) {
          await this.queueAnimation(userId, {
            id: `${speechId}_${step.animationType}`,
            type: step.animationType,
            trigger: AnimationTrigger.VOICE_START,
            emotion: speechData.emotion,
            intensity: step.intensity,
            duration: step.duration,
            priority: AnimationPriority.NORMAL,
            blendMode: AnimationBlendMode.ADDITIVE,
            timestamp: new Date()
          });
        }
      }

      return speechId;
      
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'SPEECH_COORDINATION_FAILED',
        message: `Failed to coordinate with speech synthesis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'warning',
        recoverable: true,
        context: { userId }
      });
      throw error;
    }
  }

  /**
   * Apply context-aware behavior based on interaction context
   */
  async applyContextAwareBehavior(
    userId: string,
    context: VoiceInteractionContext
  ): Promise<void> {
    try {
      const userBehaviors = this.contextAwareBehaviors.get(userId) || [];
      const currentState = this.avatarStates.get(userId);
      
      if (!currentState) {
        return;
      }

      // Evaluate behavior triggers
      for (const behavior of userBehaviors) {
        if (!behavior.isActive) continue;

        const shouldTrigger = await this.evaluateBehaviorTriggers(
          behavior,
          context,
          currentState
        );

        if (shouldTrigger && this.canTriggerBehavior(behavior)) {
          await this.executeBehaviorActions(userId, behavior, context);
          behavior.lastTriggered = new Date();
        }
      }
      
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'CONTEXT_BEHAVIOR_FAILED',
        message: `Failed to apply context-aware behavior: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'warning',
        recoverable: true,
        context: { userId }
      });
    }
  }

  /**
   * Get current avatar state for voice interactions
   */
  getAvatarVoiceInteractionState(userId: string): AvatarVoiceInteractionState | undefined {
    return this.avatarStates.get(userId);
  }

  /**
   * Register context-aware behavior for a user
   */
  async registerContextAwareBehavior(
    userId: string,
    behavior: ContextAwareBehavior
  ): Promise<void> {
    try {
      let userBehaviors = this.contextAwareBehaviors.get(userId);
      if (!userBehaviors) {
        userBehaviors = [];
        this.contextAwareBehaviors.set(userId, userBehaviors);
      }

      // Validate behavior configuration
      await this.validateBehaviorConfiguration(behavior);

      // Add behavior
      userBehaviors.push(behavior);
      
    } catch (error) {
      avatarEventBus.emitSystemError('avatar-state-synchronization', {
        code: 'BEHAVIOR_REGISTRATION_FAILED',
        message: `Failed to register context-aware behavior: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'avatar-state-synchronization',
        severity: 'warning',
        recoverable: true,
        context: { userId, behaviorId: behavior.behaviorId }
      });
      throw error;
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for avatar configuration changes
    avatarEventBus.onAvatarConfigurationChanged(async (userId, config) => {
      await this.handleAvatarConfigurationChange(userId, config);
    });

    // Listen for emotion changes
    avatarEventBus.onEmotionChanged(async (userId, emotion, intensity) => {
      await this.handleEmotionChange(userId, emotion, intensity);
    });

    // Listen for voice characteristics changes
    avatarEventBus.onVoiceCharacteristicsChanged(async (userId, characteristics) => {
      await this.handleVoiceCharacteristicsChange(userId, characteristics);
    });
  }

  private startStateUpdateLoop(): void {
    this.stateUpdateInterval = setInterval(async () => {
      await this.updateAllAvatarStates();
    }, this.STATE_UPDATE_FREQUENCY);
  }

  private async updateAllAvatarStates(): Promise<void> {
    for (const [userId, state] of this.avatarStates) {
      try {
        await this.processAnimationQueue(userId, state);
        await this.updateStateTimers(userId, state);
      } catch (error) {
        // Log error but continue processing other states
        console.error(`Failed to update state for user ${userId}:`, error);
      }
    }
  }

  private async createDefaultAvatarState(
    userId: string,
    context: VoiceInteractionContext
  ): Promise<AvatarVoiceInteractionState> {
    return {
      userId,
      currentEmotion: AvatarEmotionType.NEUTRAL,
      emotionIntensity: 0.5,
      isListening: false,
      isSpeaking: false,
      isThinking: false,
      isIdle: true,
      currentAnimation: 'idle',
      animationQueue: [],
      voiceCharacteristics: {
        pitch: 0,
        speed: 1,
        accent: 'neutral' as any,
        emotionalTone: 'calm' as any,
        volume: 0.8
      },
      personalityContext: {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 6,
        patience: 8,
        supportiveness: 8
      },
      interactionContext: context,
      lastStateChange: new Date(),
      stateHistory: []
    };
  }

  private async analyzeContextChanges(
    currentState: AvatarVoiceInteractionState,
    newContext: VoiceInteractionContext
  ): Promise<Record<string, any>> {
    const changes: Record<string, any> = {};

    // Check for phase changes
    if (currentState.interactionContext.currentPhase !== newContext.currentPhase) {
      changes.phase = newContext.currentPhase;
    }

    // Check for emotional context changes
    if (currentState.interactionContext.emotionalContext.detectedEmotion !== newContext.emotionalContext.detectedEmotion) {
      changes.emotion = newContext.emotionalContext.detectedEmotion;
      changes.emotionIntensity = newContext.emotionalContext.emotionIntensity;
    }

    // Check for engagement level changes
    if (currentState.interactionContext.conversationAnalysis.userEngagement !== newContext.conversationAnalysis.userEngagement) {
      changes.engagement = newContext.conversationAnalysis.userEngagement;
    }

    return changes;
  }

  private async applyStateChanges(
    currentState: AvatarVoiceInteractionState,
    changes: Record<string, any>,
    context: VoiceInteractionContext
  ): Promise<AvatarVoiceInteractionState> {
    const updatedState = { ...currentState };

    // Apply phase changes
    if (changes.phase) {
      updatedState.isListening = changes.phase === VoiceInteractionPhase.LISTENING;
      updatedState.isSpeaking = changes.phase === VoiceInteractionPhase.RESPONDING;
      updatedState.isThinking = changes.phase === VoiceInteractionPhase.PROCESSING;
      updatedState.isIdle = changes.phase === VoiceInteractionPhase.IDLE;
    }

    // Apply emotional changes
    if (changes.emotion) {
      updatedState.currentEmotion = changes.emotion;
      updatedState.emotionIntensity = changes.emotionIntensity || 0.5;
    }

    // Update interaction context
    updatedState.interactionContext = context;
    updatedState.lastStateChange = new Date();

    return updatedState;
  }

  private updateStateHistory(
    previousState: AvatarVoiceInteractionState,
    newState: AvatarVoiceInteractionState,
    trigger: string
  ): void {
    const historyEntry: StateHistoryEntry = {
      timestamp: new Date(),
      previousState: {
        currentEmotion: previousState.currentEmotion,
        isListening: previousState.isListening,
        isSpeaking: previousState.isSpeaking,
        isThinking: previousState.isThinking
      },
      newState: {
        currentEmotion: newState.currentEmotion,
        isListening: newState.isListening,
        isSpeaking: newState.isSpeaking,
        isThinking: newState.isThinking
      },
      trigger,
      reason: 'State synchronization update'
    };

    newState.stateHistory.push(historyEntry);

    // Keep only last 50 entries
    if (newState.stateHistory.length > 50) {
      newState.stateHistory = newState.stateHistory.slice(-50);
    }
  }

  private async determineTargetEmotion(
    conversationAnalysis: ConversationAnalysis,
    emotionalContext: EmotionalContext,
    currentState: AvatarVoiceInteractionState
  ): Promise<AvatarEmotionType> {
    // Use detected emotion from conversation analysis
    let targetEmotion = emotionalContext.detectedEmotion;

    // Apply personality-based adjustments
    const personality = currentState.personalityContext;
    
    // High enthusiasm personality amplifies positive emotions
    if (personality.enthusiasm > 7 && (targetEmotion === AvatarEmotionType.HAPPY || targetEmotion === AvatarEmotionType.EXCITED)) {
      targetEmotion = AvatarEmotionType.EXCITED;
    }

    // High supportiveness maintains calm during negative emotions
    if (personality.supportiveness > 7 && (targetEmotion === AvatarEmotionType.SAD || targetEmotion === AvatarEmotionType.CONFUSED)) {
      // Stay supportive but acknowledge the emotion
      return AvatarEmotionType.NEUTRAL; // Supportive neutral
    }

    return targetEmotion;
  }

  private async calculateEmotionTransition(
    currentEmotion: AvatarEmotionType,
    targetEmotion: AvatarEmotionType,
    emotionalContext: EmotionalContext
  ): Promise<{ duration: number; intensity: number }> {
    // Base transition duration
    let duration = 1000; // 1 second default

    // Adjust based on emotion intensity
    duration *= (1 + emotionalContext.emotionIntensity);

    // Adjust based on emotion distance
    const emotionDistance = this.calculateEmotionDistance(currentEmotion, targetEmotion);
    duration *= (1 + emotionDistance * 0.5);

    return {
      duration: Math.min(duration, 3000), // Max 3 seconds
      intensity: emotionalContext.emotionIntensity
    };
  }

  private calculateEmotionDistance(emotion1: AvatarEmotionType, emotion2: AvatarEmotionType): number {
    // Simple emotion distance calculation
    const emotionValues: Record<AvatarEmotionType, number> = {
      [AvatarEmotionType.SAD]: -2,
      [AvatarEmotionType.CONFUSED]: -1,
      [AvatarEmotionType.NEUTRAL]: 0,
      [AvatarEmotionType.THINKING]: 0,
      [AvatarEmotionType.HAPPY]: 1,
      [AvatarEmotionType.EXCITED]: 2,
      [AvatarEmotionType.SURPRISED]: 1
    };

    const value1 = emotionValues[emotion1] || 0;
    const value2 = emotionValues[emotion2] || 0;
    
    return Math.abs(value1 - value2) / 4; // Normalize to 0-1
  }

  private async queueAnimation(userId: string, animationRequest: AnimationRequest): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (!state) return;

    // Add to animation queue with priority sorting
    state.animationQueue.push(animationRequest);
    state.animationQueue.sort((a, b) => b.priority - a.priority);

    // Limit queue size
    if (state.animationQueue.length > 10) {
      state.animationQueue = state.animationQueue.slice(0, 10);
    }
  }

  private async updateEmotionalState(
    userId: string,
    emotion: AvatarEmotionType,
    emotionalContext: EmotionalContext
  ): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (!state) return;

    state.currentEmotion = emotion;
    state.emotionIntensity = emotionalContext.emotionIntensity;
    state.lastStateChange = new Date();
  }

  private async generateSpeechAnimationSequence(
    text: string,
    emotion: AvatarEmotionType,
    duration: number
  ): Promise<AnimationSequence> {
    const sequences: AnimationStep[] = [];
    
    // Base speaking animation
    sequences.push({
      animationType: AnimationType.SPEAKING,
      startTime: 0,
      duration: duration,
      intensity: 0.8,
      blendWeight: 1.0
    });

    // Add emotional overlay
    if (emotion !== AvatarEmotionType.NEUTRAL) {
      sequences.push({
        animationType: AnimationType.EMOTIONAL_EXPRESSION,
        startTime: 0,
        duration: duration,
        intensity: 0.6,
        blendWeight: 0.5
      });
    }

    // Add emphasis points (simplified - would analyze text for emphasis)
    const wordCount = text.split(' ').length;
    const emphasisPoints = Math.min(3, Math.floor(wordCount / 10));
    
    for (let i = 0; i < emphasisPoints; i++) {
      const startTime = (duration / emphasisPoints) * i + (duration / emphasisPoints) * 0.3;
      sequences.push({
        animationType: AnimationType.GESTURE,
        startTime,
        duration: 500,
        intensity: 0.4,
        blendWeight: 0.3
      });
    }

    return {
      sequences,
      totalDuration: duration,
      syncPoints: []
    };
  }

  private async generateTimingMarkers(
    text: string,
    animationSequence: AnimationSequence
  ): Promise<TimingMarker[]> {
    const markers: TimingMarker[] = [];
    
    // Add word boundary markers (simplified)
    const words = text.split(' ');
    const wordDuration = animationSequence.totalDuration / words.length;
    
    words.forEach((word, index) => {
      markers.push({
        time: index * wordDuration,
        type: MarkerType.WORD_BOUNDARY,
        data: { word, index }
      });
    });

    // Add sentence boundary markers
    const sentences = text.split(/[.!?]+/);
    const sentenceDuration = animationSequence.totalDuration / sentences.length;
    
    sentences.forEach((sentence, index) => {
      if (sentence.trim()) {
        markers.push({
          time: index * sentenceDuration,
          type: MarkerType.SENTENCE_BOUNDARY,
          data: { sentence: sentence.trim(), index }
        });
      }
    });

    return markers;
  }

  private async updateVoiceInteractionPhase(
    userId: string,
    phase: VoiceInteractionPhase
  ): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (!state) return;

    state.interactionContext.currentPhase = phase;
    
    // Update corresponding boolean flags
    state.isListening = phase === VoiceInteractionPhase.LISTENING;
    state.isSpeaking = phase === VoiceInteractionPhase.RESPONDING;
    state.isThinking = phase === VoiceInteractionPhase.PROCESSING;
    state.isIdle = phase === VoiceInteractionPhase.IDLE;
    
    state.lastStateChange = new Date();
  }

  private async startAnimationCoordination(
    userId: string,
    coordination: SpeechSynthesisCoordination
  ): Promise<void> {
    coordination.coordinationState = CoordinationState.ACTIVE;
    
    // Trigger speaking animation
    await this.queueAnimation(userId, {
      id: `speech_${coordination.speechId}`,
      type: AnimationType.SPEAKING,
      trigger: AnimationTrigger.VOICE_START,
      emotion: coordination.emotionalExpression,
      intensity: 0.8,
      duration: coordination.animationSequence.totalDuration,
      priority: AnimationPriority.HIGH,
      blendMode: AnimationBlendMode.REPLACE,
      timestamp: new Date()
    });

    // Emit animation triggered event
    avatarEventBus.emitAnimationTriggered(userId, 'speaking', 0.8);
  }

  private async processAnimationQueue(
    userId: string,
    state: AvatarVoiceInteractionState
  ): Promise<void> {
    if (state.animationQueue.length === 0) return;

    const currentTime = Date.now();
    
    // Process animations that should be active
    for (let i = state.animationQueue.length - 1; i >= 0; i--) {
      const animation = state.animationQueue[i];
      const animationAge = currentTime - animation.timestamp.getTime();
      
      // Remove expired animations
      if (animation.duration && animationAge > animation.duration) {
        state.animationQueue.splice(i, 1);
        continue;
      }

      // Update current animation if this is the highest priority active animation
      if (i === 0) {
        state.currentAnimation = animation.type;
      }
    }
  }

  private async updateStateTimers(
    userId: string,
    state: AvatarVoiceInteractionState
  ): Promise<void> {
    const currentTime = Date.now();
    const timeSinceLastChange = currentTime - state.lastStateChange.getTime();
    
    // Auto-transition to idle after period of inactivity
    if (timeSinceLastChange > 30000 && !state.isIdle) { // 30 seconds
      await this.updateVoiceInteractionPhase(userId, VoiceInteractionPhase.IDLE);
    }
  }

  private async loadDefaultBehaviors(): Promise<void> {
    // Load default context-aware behaviors
    // This would typically load from configuration or database
  }

  private async evaluateBehaviorTriggers(
    behavior: ContextAwareBehavior,
    context: VoiceInteractionContext,
    state: AvatarVoiceInteractionState
  ): Promise<boolean> {
    // Evaluate all triggers for the behavior
    for (const trigger of behavior.triggers) {
      const result = await this.evaluateSingleTrigger(trigger, context, state);
      if (!result) return false; // All triggers must be true
    }
    
    // Evaluate all conditions
    for (const condition of behavior.conditions) {
      const result = await this.evaluateCondition(condition, context, state);
      if (!result) return false; // All conditions must be true
    }
    
    return true;
  }

  private async evaluateSingleTrigger(
    trigger: BehaviorTrigger,
    context: VoiceInteractionContext,
    state: AvatarVoiceInteractionState
  ): Promise<boolean> {
    switch (trigger.type) {
      case TriggerType.EMOTION_CHANGE:
        return state.currentEmotion !== AvatarEmotionType.NEUTRAL;
      case TriggerType.CONVERSATION_STATE:
        return context.conversationAnalysis.userEngagement !== EngagementLevel.VERY_LOW;
      case TriggerType.CONTEXT_CHANGE:
        return true; // Simplified - would check for actual context changes
      default:
        return false;
    }
  }

  private async evaluateCondition(
    condition: BehaviorCondition,
    context: VoiceInteractionContext,
    state: AvatarVoiceInteractionState
  ): Promise<boolean> {
    // Simplified condition evaluation
    return true;
  }

  private canTriggerBehavior(behavior: ContextAwareBehavior): boolean {
    if (!behavior.cooldownPeriod || !behavior.lastTriggered) {
      return true;
    }
    
    const timeSinceLastTrigger = Date.now() - behavior.lastTriggered.getTime();
    return timeSinceLastTrigger >= behavior.cooldownPeriod;
  }

  private async executeBehaviorActions(
    userId: string,
    behavior: ContextAwareBehavior,
    context: VoiceInteractionContext
  ): Promise<void> {
    for (const action of behavior.actions) {
      await this.executeBehaviorAction(userId, action, context);
    }
  }

  private async executeBehaviorAction(
    userId: string,
    action: BehaviorAction,
    context: VoiceInteractionContext
  ): Promise<void> {
    switch (action.type) {
      case ActionType.CHANGE_EMOTION:
        const emotion = action.parameters.emotion as AvatarEmotionType;
        const intensity = action.parameters.intensity as number || 0.5;
        await this.updateEmotionalState(userId, emotion, {
          detectedEmotion: emotion,
          emotionConfidence: 0.8,
          emotionIntensity: intensity,
          emotionTrend: EmotionTrend.STABLE,
          contextualFactors: ['behavior_action']
        });
        break;
        
      case ActionType.TRIGGER_ANIMATION:
        const animationType = action.parameters.animationType as AnimationType;
        await this.queueAnimation(userId, {
          id: `behavior_${Date.now()}`,
          type: animationType,
          trigger: AnimationTrigger.CONTEXT_CHANGE,
          intensity: action.parameters.intensity || 0.5,
          duration: action.duration,
          priority: AnimationPriority.NORMAL,
          blendMode: AnimationBlendMode.ADDITIVE,
          timestamp: new Date()
        });
        break;
    }
  }

  private async validateBehaviorConfiguration(behavior: ContextAwareBehavior): Promise<void> {
    if (!behavior.behaviorId || behavior.behaviorId.trim() === '') {
      throw new Error('Behavior must have a valid ID');
    }
    
    if (behavior.triggers.length === 0) {
      throw new Error('Behavior must have at least one trigger');
    }
    
    if (behavior.actions.length === 0) {
      throw new Error('Behavior must have at least one action');
    }
  }

  private async handleAvatarConfigurationChange(
    userId: string,
    config: AvatarConfiguration
  ): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (state) {
      state.personalityContext = config.personality;
      state.voiceCharacteristics = config.voice;
      state.lastStateChange = new Date();
    }
  }

  private async handleEmotionChange(
    userId: string,
    emotion: AvatarEmotionType,
    intensity: number
  ): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (state) {
      state.currentEmotion = emotion;
      state.emotionIntensity = intensity;
      state.lastStateChange = new Date();
    }
  }

  private async handleVoiceCharacteristicsChange(
    userId: string,
    characteristics: VoiceCharacteristics
  ): Promise<void> {
    const state = this.avatarStates.get(userId);
    if (state) {
      state.voiceCharacteristics = characteristics;
      state.lastStateChange = new Date();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = undefined;
    }
    
    this.avatarStates.clear();
    this.contextAwareBehaviors.clear();
    this.speechCoordination.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const avatarStateSynchronizationManager = new AvatarStateSynchronizationManager();