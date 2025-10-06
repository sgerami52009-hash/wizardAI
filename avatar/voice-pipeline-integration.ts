// Voice Pipeline Integration Layer for Avatar System

import { 
  PersonalityTraits, 
  VoiceCharacteristics, 
  InteractionContext,
  ResponseStyle,
  EmotionType,
  AccentType,
  EmotionalTone,
  AvatarConfiguration
} from './types';

import { avatarEventBus } from './events';
import { personalityVoiceIntegration } from './personality-voice-integration';

// AudioBuffer interface for Node.js compatibility
interface AudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}

/**
 * Voice synthesis configuration for TTS integration
 */
export interface VoiceSynthesisConfig {
  voiceId?: string;
  pitch: number;
  speed: number;
  volume: number;
  accent: AccentType;
  emotionalTone: EmotionalTone;
  sampleRate?: number;
  bitRate?: number;
}

/**
 * Context for voice response generation
 */
export interface VoiceResponseContext {
  userId: string;
  conversationId: string;
  personality: PersonalityTraits;
  currentEmotion: EmotionType;
  recentHistory: string[];
  environmentalContext: {
    noiseLevel: number;
    privacyLevel: 'private' | 'semi-private' | 'public';
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  };
}

/**
 * Interface for external voice pipeline integration
 * This represents the voice pipeline system that handles TTS and response generation
 */
export interface ExternalVoicePipeline {
  // Text-to-Speech integration
  synthesizeSpeech(text: string, voiceConfig: VoiceSynthesisConfig): Promise<AudioBuffer>;
  updateTTSParameters(characteristics: VoiceCharacteristics): Promise<void>;
  
  // Response generation integration
  generateResponse(input: string, context: VoiceResponseContext): Promise<string>;
  setPersonalityContext(traits: PersonalityTraits): Promise<void>;
  
  // Real-time interaction support
  startSpeechSynthesis(): Promise<void>;
  stopSpeechSynthesis(): Promise<void>;
  pauseSpeechSynthesis(): Promise<void>;
  resumeSpeechSynthesis(): Promise<void>;
  
  // Voice pipeline status
  isConnected(): boolean;
  getStatus(): VoicePipelineStatus;
}

/**
 * Voice pipeline status information
 */
export interface VoicePipelineStatus {
  connected: boolean;
  ttsReady: boolean;
  responseGeneratorReady: boolean;
  currentLoad: number;
  lastError?: string;
  latency: number;
}

/**
 * Animation trigger data for voice interactions
 */
export interface VoiceAnimationTrigger {
  userId: string;
  animationType: 'listening' | 'thinking' | 'speaking' | 'idle';
  intensity: number;
  duration?: number;
  emotion?: EmotionType;
  timestamp: Date;
}

/**
 * Avatar state synchronization data
 */
export interface AvatarVoiceState {
  userId: string;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  currentEmotion: EmotionType;
  emotionIntensity: number;
  voiceCharacteristics: VoiceCharacteristics;
  lastInteraction: Date;
}

/**
 * Voice Pipeline Integration Layer
 * Coordinates between avatar system and voice pipeline for seamless interaction
 */
export class VoicePipelineIntegrationLayer {
  private voicePipeline?: ExternalVoicePipeline;
  private avatarStates: Map<string, AvatarVoiceState> = new Map();
  private animationQueue: VoiceAnimationTrigger[] = [];
  private isInitialized: boolean = false;
  private connectionRetryCount: number = 0;
  private maxRetries: number = 3;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Initialize the voice pipeline integration layer
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Initialize personality-voice integration
      await personalityVoiceIntegration.integrateWithVoicePipeline(this.createVoicePipelineInterface());
      
      this.isInitialized = true;
      
      avatarEventBus.emitSystemRecovery(
        'voice-pipeline-integration', 
        'Voice pipeline integration layer initialized successfully'
      );
    } catch (error) {
      avatarEventBus.emitSystemError('voice-pipeline-integration', {
        code: 'INITIALIZATION_FAILED',
        message: `Failed to initialize voice pipeline integration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'voice-pipeline-integration',
        severity: 'error',
        recoverable: true
      });
      throw error;
    }
  }

  /**
   * Connect to external voice pipeline
   */
  async connectToVoicePipeline(voicePipeline: ExternalVoicePipeline): Promise<void> {
    try {
      this.voicePipeline = voicePipeline;
      
      // Test connection
      if (!voicePipeline.isConnected()) {
        throw new Error('Voice pipeline is not connected');
      }
      
      const status = voicePipeline.getStatus();
      if (!status.ttsReady || !status.responseGeneratorReady) {
        throw new Error('Voice pipeline components not ready');
      }
      
      // Reset retry count on successful connection
      this.connectionRetryCount = 0;
      
      avatarEventBus.emitSystemRecovery(
        'voice-pipeline-integration', 
        'Successfully connected to voice pipeline'
      );
    } catch (error) {
      this.connectionRetryCount++;
      
      if (this.connectionRetryCount <= this.maxRetries) {
        // Retry connection after delay
        setTimeout(() => {
          this.connectToVoicePipeline(voicePipeline);
        }, 1000 * this.connectionRetryCount);
      } else {
        avatarEventBus.emitSystemError('voice-pipeline-integration', {
          code: 'CONNECTION_FAILED',
          message: `Failed to connect to voice pipeline after ${this.maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          component: 'voice-pipeline-integration',
          severity: 'error',
          recoverable: false
        });
      }
      throw error;
    }
  }

  /**
   * Coordinate personality-driven response generation with voice pipeline
   */
  async generatePersonalityDrivenResponse(
    userId: string,
    input: string,
    personality: PersonalityTraits,
    context: InteractionContext
  ): Promise<string> {
    try {
      if (!this.voicePipeline) {
        throw new Error('Voice pipeline not connected');
      }

      // Update avatar state to thinking
      await this.updateAvatarState(userId, {
        isThinking: true,
        isSpeaking: false,
        isListening: false
      });

      // Trigger thinking animation
      await this.triggerVoiceAnimation(userId, 'thinking', 0.7);

      // Create voice response context
      const voiceContext: VoiceResponseContext = {
        userId,
        conversationId: context.conversationId,
        personality,
        currentEmotion: context.emotionalState as EmotionType || EmotionType.NEUTRAL,
        recentHistory: context.recentTopics,
        environmentalContext: {
          noiseLevel: 0.3, // Default moderate noise level
          privacyLevel: 'private', // Default to private
          timeOfDay: this.getCurrentTimeOfDay()
        }
      };

      // Set personality context in voice pipeline
      await this.voicePipeline.setPersonalityContext(personality);

      // Generate response using voice pipeline
      const response = await this.voicePipeline.generateResponse(input, voiceContext);

      // Update avatar state to speaking
      await this.updateAvatarState(userId, {
        isThinking: false,
        isSpeaking: true,
        isListening: false
      });

      return response;
    } catch (error) {
      // Reset avatar state on error
      await this.updateAvatarState(userId, {
        isThinking: false,
        isSpeaking: false,
        isListening: true
      });

      avatarEventBus.emitSystemError('voice-pipeline-integration', {
        code: 'RESPONSE_GENERATION_FAILED',
        message: `Failed to generate personality-driven response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'voice-pipeline-integration',
        severity: 'warning',
        recoverable: true,
        context: { userId, input }
      });

      // Return fallback response
      return this.generateFallbackResponse(personality);
    }
  }

  /**
   * Trigger real-time avatar animation from voice interactions
   */
  async triggerVoiceAnimation(
    userId: string,
    animationType: 'listening' | 'thinking' | 'speaking' | 'idle',
    intensity: number = 1.0,
    duration?: number,
    emotion?: EmotionType
  ): Promise<void> {
    try {
      const trigger: VoiceAnimationTrigger = {
        userId,
        animationType,
        intensity: Math.max(0, Math.min(1, intensity)),
        duration,
        emotion,
        timestamp: new Date()
      };

      // Add to animation queue
      this.animationQueue.push(trigger);

      // Emit animation event
      avatarEventBus.emitAnimationTriggered(userId, animationType, intensity);

      // If emotion is specified, also trigger emotion change
      if (emotion) {
        avatarEventBus.emitEmotionChanged(userId, emotion, intensity);
      }
    } catch (error) {
      avatarEventBus.emitSystemError('voice-pipeline-integration', {
        code: 'ANIMATION_TRIGGER_FAILED',
        message: `Failed to trigger voice animation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'voice-pipeline-integration',
        severity: 'warning',
        recoverable: true,
        context: { userId, animationType, intensity }
      });
    }
  }

  /**
   * Synchronize voice characteristics with avatar personality
   */
  async synchronizeVoiceCharacteristics(
    userId: string,
    personality: PersonalityTraits,
    baseCharacteristics: VoiceCharacteristics
  ): Promise<VoiceCharacteristics> {
    try {
      // Use personality-voice integration to ensure consistency
      const synchronizedCharacteristics = personalityVoiceIntegration.ensureVoiceCharacteristicConsistency(
        personality,
        baseCharacteristics
      );

      // Update voice pipeline with synchronized characteristics
      if (this.voicePipeline) {
        await this.voicePipeline.updateTTSParameters(synchronizedCharacteristics);
      }

      // Update avatar state
      const currentState = this.avatarStates.get(userId);
      if (currentState) {
        currentState.voiceCharacteristics = synchronizedCharacteristics;
        this.avatarStates.set(userId, currentState);
      }

      // Emit voice characteristics changed event
      avatarEventBus.emitVoiceCharacteristicsChanged(userId, synchronizedCharacteristics);

      return synchronizedCharacteristics;
    } catch (error) {
      avatarEventBus.emitSystemError('voice-pipeline-integration', {
        code: 'VOICE_SYNC_FAILED',
        message: `Failed to synchronize voice characteristics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'voice-pipeline-integration',
        severity: 'warning',
        recoverable: true,
        context: { userId }
      });

      // Return original characteristics on error
      return baseCharacteristics;
    }
  }

  /**
   * Get current avatar voice state
   */
  getAvatarVoiceState(userId: string): AvatarVoiceState | undefined {
    return this.avatarStates.get(userId);
  }

  /**
   * Update avatar state for voice interactions
   */
  async updateAvatarState(
    userId: string,
    stateUpdate: Partial<AvatarVoiceState>
  ): Promise<void> {
    try {
      let currentState = this.avatarStates.get(userId);
      
      if (!currentState) {
        // Create default state
        currentState = {
          userId,
          isListening: false,
          isSpeaking: false,
          isThinking: false,
          currentEmotion: EmotionType.NEUTRAL,
          emotionIntensity: 0.5,
          voiceCharacteristics: {
            pitch: 0,
            speed: 1,
            accent: AccentType.NEUTRAL,
            emotionalTone: EmotionalTone.CALM,
            volume: 0.8
          },
          lastInteraction: new Date()
        };
      }

      // Update state
      const updatedState = {
        ...currentState,
        ...stateUpdate,
        lastInteraction: new Date()
      };

      this.avatarStates.set(userId, updatedState);

      // Emit appropriate events based on state changes
      if (stateUpdate.currentEmotion && stateUpdate.currentEmotion !== currentState.currentEmotion) {
        avatarEventBus.emitEmotionChanged(
          userId, 
          stateUpdate.currentEmotion, 
          stateUpdate.emotionIntensity || currentState.emotionIntensity
        );
      }
    } catch (error) {
      avatarEventBus.emitSystemError('voice-pipeline-integration', {
        code: 'STATE_UPDATE_FAILED',
        message: `Failed to update avatar state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'voice-pipeline-integration',
        severity: 'warning',
        recoverable: true,
        context: { userId, stateUpdate }
      });
    }
  }

  /**
   * Process animation queue and execute animations
   */
  async processAnimationQueue(): Promise<void> {
    while (this.animationQueue.length > 0) {
      const trigger = this.animationQueue.shift();
      if (trigger) {
        try {
          // Process animation trigger
          await this.executeAnimation(trigger);
        } catch (error) {
          // Log error but continue processing queue
          console.error('Failed to execute animation:', error);
        }
      }
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for avatar configuration changes
    avatarEventBus.onAvatarConfigurationChanged(async (userId, config) => {
      await this.handleAvatarConfigurationChange(userId, config);
    });

    // Listen for voice characteristics changes
    avatarEventBus.onVoiceCharacteristicsChanged(async (userId, characteristics) => {
      await this.handleVoiceCharacteristicsChange(userId, characteristics);
    });

    // Listen for emotion changes
    avatarEventBus.onEmotionChanged(async (userId, emotion, intensity) => {
      await this.handleEmotionChange(userId, emotion, intensity);
    });
  }

  private async handleAvatarConfigurationChange(
    userId: string,
    config: AvatarConfiguration
  ): Promise<void> {
    try {
      // Synchronize voice characteristics with new personality
      await this.synchronizeVoiceCharacteristics(
        userId,
        config.personality,
        config.voice
      );

      // Update personality context in voice pipeline
      if (this.voicePipeline) {
        await this.voicePipeline.setPersonalityContext(config.personality);
      }
    } catch (error) {
      console.error('Failed to handle avatar configuration change:', error);
    }
  }

  private async handleVoiceCharacteristicsChange(
    userId: string,
    characteristics: VoiceCharacteristics
  ): Promise<void> {
    try {
      // Update voice pipeline with new characteristics
      if (this.voicePipeline) {
        await this.voicePipeline.updateTTSParameters(characteristics);
      }

      // Update avatar state
      await this.updateAvatarState(userId, {
        voiceCharacteristics: characteristics
      });
    } catch (error) {
      console.error('Failed to handle voice characteristics change:', error);
    }
  }

  private async handleEmotionChange(
    userId: string,
    emotion: EmotionType,
    intensity: number
  ): Promise<void> {
    try {
      // Update avatar state with new emotion
      await this.updateAvatarState(userId, {
        currentEmotion: emotion,
        emotionIntensity: intensity
      });

      // Trigger appropriate animation based on emotion
      await this.triggerVoiceAnimation(userId, 'idle', intensity, undefined, emotion);
    } catch (error) {
      console.error('Failed to handle emotion change:', error);
    }
  }

  private async executeAnimation(trigger: VoiceAnimationTrigger): Promise<void> {
    // This would integrate with the actual animation system
    // For now, just emit the animation event
    avatarEventBus.emitAnimationTriggered(
      trigger.userId,
      trigger.animationType,
      trigger.intensity
    );
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  private generateFallbackResponse(personality: PersonalityTraits): string {
    const responses = [
      "I'd be happy to help with that!",
      "Let me think about that for a moment.",
      "That's an interesting question!",
      "I'm here to assist you."
    ];

    // Select response based on personality
    if (personality.enthusiasm > 7) {
      return "That's exciting! Let me help you with that!";
    } else if (personality.formality > 7) {
      return "I shall be pleased to assist you with that matter.";
    } else {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }

  private createVoicePipelineInterface(): any {
    // Create a mock interface for personality-voice integration
    return {
      updateTTSParameters: async (characteristics: VoiceCharacteristics) => {
        if (this.voicePipeline) {
          await this.voicePipeline.updateTTSParameters(characteristics);
        }
      },
      generateSpeech: async (text: string, characteristics: VoiceCharacteristics) => {
        if (this.voicePipeline) {
          const config: VoiceSynthesisConfig = {
            pitch: characteristics.pitch,
            speed: characteristics.speed,
            volume: characteristics.volume,
            accent: characteristics.accent,
            emotionalTone: characteristics.emotionalTone
          };
          return await this.voicePipeline.synthesizeSpeech(text, config);
        }
        throw new Error('Voice pipeline not connected');
      },
      setResponseStyle: async (style: ResponseStyle) => {
        // This would be implemented based on the actual voice pipeline interface
      },
      processPersonalizedResponse: async (input: string, style: ResponseStyle) => {
        // This would be implemented based on the actual voice pipeline interface
        return input; // Fallback
      }
    };
  }
}

// Export singleton instance
export const voicePipelineIntegrationLayer = new VoicePipelineIntegrationLayer();