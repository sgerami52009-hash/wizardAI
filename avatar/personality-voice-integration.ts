// Personality-Voice Integration System

import { 
  PersonalityTraits, 
  VoiceCharacteristics, 
  InteractionContext,
  ResponseStyle,
  EmotionType,
  AccentType,
  EmotionalTone
} from './types';

// AudioBuffer interface for Node.js compatibility
interface AudioBuffer {
  length: number;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
}
import { avatarEventBus } from './events';
import { personalityManager } from './personality-manager';
import { emotionalExpressionSystem } from './emotional-expression';

export interface VoicePipelineInterface {
  updateTTSParameters(characteristics: VoiceCharacteristics): Promise<void>;
  generateSpeech(text: string, characteristics: VoiceCharacteristics): Promise<AudioBuffer>;
  setResponseStyle(style: ResponseStyle): Promise<void>;
  processPersonalizedResponse(input: string, style: ResponseStyle): Promise<string>;
}

export interface PersonalityVoiceMapping {
  personalityRange: {
    friendliness: { min: number; max: number };
    formality: { min: number; max: number };
    humor: { min: number; max: number };
    enthusiasm: { min: number; max: number };
  };
  voiceAdjustments: {
    pitchModifier: number;    // -0.5 to 0.5
    speedModifier: number;    // -0.3 to 0.3
    toneAdjustment: EmotionalTone;
    accentPreference?: AccentType;
  };
  responseStyleModifiers: {
    formalityBoost: number;   // -0.2 to 0.2
    enthusiasmBoost: number;  // -0.2 to 0.2
    wordComplexity: number;   // -0.3 to 0.3
    responseLength: number;   // -0.2 to 0.2
  };
}

export interface RealTimePersonalityExpression {
  userId: string;
  currentPersonality: PersonalityTraits;
  activeEmotion: EmotionType;
  voiceCharacteristics: VoiceCharacteristics;
  responseStyle: ResponseStyle;
  lastUpdated: Date;
}

export class PersonalityVoiceIntegration {
  private voicePipeline?: VoicePipelineInterface;
  private personalityMappings: PersonalityVoiceMapping[] = [];
  private activeExpressions: Map<string, RealTimePersonalityExpression> = new Map();
  private responseTemplates: Map<string, string[]> = new Map();

  constructor() {
    this.initializePersonalityMappings();
    this.initializeResponseTemplates();
    this.setupEventListeners();
  }

  /**
   * Creates integration layer with voice pipeline text-to-speech
   */
  async integrateWithVoicePipeline(voicePipeline: VoicePipelineInterface): Promise<void> {
    try {
      this.voicePipeline = voicePipeline;
      
      // Test the integration
      await this.testVoicePipelineConnection();
      
      avatarEventBus.emitSystemRecovery('personality-voice-integration', 'Voice pipeline connected successfully');
    } catch (error) {
      avatarEventBus.emitSystemError('personality-voice-integration', {
        code: 'VOICE_PIPELINE_CONNECTION_FAILED',
        message: `Failed to integrate with voice pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'personality-voice-integration',
        severity: 'error',
        recoverable: true
      });
      throw error;
    }
  }

  /**
   * Implements personality-driven response style generation
   */
  generatePersonalityDrivenResponseStyle(
    traits: PersonalityTraits, 
    context: InteractionContext
  ): ResponseStyle {
    try {
      // Get base response style from personality manager
      const baseStyle = personalityManager.generateResponseStyle(traits, context);
      
      // Apply personality-specific voice adjustments
      const mapping = this.findBestPersonalityMapping(traits);
      if (mapping) {
        return this.applyPersonalityMappingToStyle(baseStyle, mapping, context);
      }
      
      return baseStyle;
    } catch (error) {
      // Return safe default style on error
      return {
        formality: 0.5,
        enthusiasm: 0.6,
        wordChoice: 'simple',
        responseLength: 'moderate'
      };
    }
  }

  /**
   * Adds voice characteristic consistency with personality traits
   */
  ensureVoiceCharacteristicConsistency(
    traits: PersonalityTraits, 
    baseCharacteristics: VoiceCharacteristics
  ): VoiceCharacteristics {
    try {
      const consistentCharacteristics = { ...baseCharacteristics };
      
      // Adjust pitch based on friendliness and enthusiasm
      const friendlinessInfluence = (traits.friendliness - 5) * 0.1; // -0.5 to 0.5
      const enthusiasmInfluence = (traits.enthusiasm - 5) * 0.05;   // -0.25 to 0.25
      consistentCharacteristics.pitch += friendlinessInfluence + enthusiasmInfluence;
      
      // Adjust speed based on patience and formality
      const patienceInfluence = (traits.patience - 5) * -0.05;      // More patient = slower
      const formalityInfluence = (traits.formality - 5) * 0.03;     // More formal = slightly faster
      consistentCharacteristics.speed += patienceInfluence + formalityInfluence;
      
      // Adjust emotional tone based on personality
      consistentCharacteristics.emotionalTone = this.determineEmotionalTone(traits);
      
      // Ensure values stay within valid ranges
      consistentCharacteristics.pitch = Math.max(-2.0, Math.min(2.0, consistentCharacteristics.pitch));
      consistentCharacteristics.speed = Math.max(0.5, Math.min(2.0, consistentCharacteristics.speed));
      
      return consistentCharacteristics;
    } catch (error) {
      // Return original characteristics on error
      return baseCharacteristics;
    }
  }

  /**
   * Builds real-time personality expression in avatar interactions
   */
  async expressPersonalityInRealTime(
    userId: string, 
    traits: PersonalityTraits, 
    context: InteractionContext
  ): Promise<void> {
    try {
      // Get current emotion state from context or emotional expression system
      let currentEmotion = EmotionType.NEUTRAL;
      if (context.emotionalState && Object.values(EmotionType).includes(context.emotionalState as EmotionType)) {
        currentEmotion = context.emotionalState as EmotionType;
      } else {
        const emotionState = emotionalExpressionSystem.getCurrentEmotionState(userId);
        currentEmotion = emotionState?.currentEmotion || EmotionType.NEUTRAL;
      }
      
      // Generate response style
      const responseStyle = this.generatePersonalityDrivenResponseStyle(traits, context);
      
      // Get or create voice characteristics
      let voiceCharacteristics = this.getStoredVoiceCharacteristics(userId);
      if (!voiceCharacteristics) {
        voiceCharacteristics = this.generateDefaultVoiceCharacteristics(traits);
      }
      
      // Ensure consistency
      voiceCharacteristics = this.ensureVoiceCharacteristicConsistency(traits, voiceCharacteristics);
      
      // Update voice pipeline with new settings
      if (this.voicePipeline) {
        await this.voicePipeline.updateTTSParameters(voiceCharacteristics);
        await this.voicePipeline.setResponseStyle(responseStyle);
      }
      
      // Store active expression
      const expression: RealTimePersonalityExpression = {
        userId,
        currentPersonality: traits,
        activeEmotion: currentEmotion,
        voiceCharacteristics,
        responseStyle,
        lastUpdated: new Date()
      };
      
      this.activeExpressions.set(userId, expression);
      
      // Emit event for successful personality expression
      avatarEventBus.emit('personality:voice:expression_updated', userId, expression);
    } catch (error) {
      avatarEventBus.emitSystemError('personality-voice-integration', {
        code: 'REALTIME_EXPRESSION_FAILED',
        message: `Failed to express personality in real-time: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'personality-voice-integration',
        severity: 'warning',
        recoverable: true,
        context: { userId, traits }
      });
    }
  }

  /**
   * Generates personalized response based on personality and context
   */
  async generatePersonalizedResponse(
    input: string, 
    traits: PersonalityTraits, 
    context: InteractionContext
  ): Promise<string> {
    try {
      if (!this.voicePipeline) {
        throw new Error('Voice pipeline not connected');
      }
      
      // Generate response style
      const responseStyle = this.generatePersonalityDrivenResponseStyle(traits, context);
      
      // Get personalized response from voice pipeline
      const response = await this.voicePipeline.processPersonalizedResponse(input, responseStyle);
      
      // Apply personality-specific modifications
      const personalizedResponse = this.applyPersonalityToResponse(response, traits, context);
      
      return personalizedResponse;
    } catch (error) {
      // Return safe fallback response
      return this.generateFallbackResponse(input, traits);
    }
  }

  /**
   * Gets active personality expression for a user
   */
  getActivePersonalityExpression(userId: string): RealTimePersonalityExpression | undefined {
    return this.activeExpressions.get(userId);
  }

  /**
   * Updates personality expression when traits change
   */
  async updatePersonalityExpression(userId: string, newTraits: PersonalityTraits): Promise<void> {
    const existingExpression = this.activeExpressions.get(userId);
    if (existingExpression) {
      const context: InteractionContext = {
        userId,
        conversationId: 'current',
        emotionalState: existingExpression.activeEmotion,
        recentTopics: []
      };
      
      await this.expressPersonalityInRealTime(userId, newTraits, context);
    }
  }

  // Private helper methods

  private initializePersonalityMappings(): void {
    // Friendly and enthusiastic personality mapping
    this.personalityMappings.push({
      personalityRange: {
        friendliness: { min: 7, max: 10 },
        formality: { min: 1, max: 5 },
        humor: { min: 6, max: 10 },
        enthusiasm: { min: 7, max: 10 }
      },
      voiceAdjustments: {
        pitchModifier: 0.2,
        speedModifier: 0.1,
        toneAdjustment: EmotionalTone.CHEERFUL,
        accentPreference: AccentType.AMERICAN
      },
      responseStyleModifiers: {
        formalityBoost: -0.2,
        enthusiasmBoost: 0.2,
        wordComplexity: -0.1,
        responseLength: 0.1
      }
    });

    // Formal and professional personality mapping
    this.personalityMappings.push({
      personalityRange: {
        friendliness: { min: 4, max: 8 },
        formality: { min: 7, max: 10 },
        humor: { min: 1, max: 5 },
        enthusiasm: { min: 3, max: 7 }
      },
      voiceAdjustments: {
        pitchModifier: -0.1,
        speedModifier: -0.05,
        toneAdjustment: EmotionalTone.CALM,
        accentPreference: AccentType.BRITISH
      },
      responseStyleModifiers: {
        formalityBoost: 0.2,
        enthusiasmBoost: -0.1,
        wordComplexity: 0.2,
        responseLength: 0.15
      }
    });

    // Energetic and playful personality mapping
    this.personalityMappings.push({
      personalityRange: {
        friendliness: { min: 6, max: 10 },
        formality: { min: 1, max: 4 },
        humor: { min: 8, max: 10 },
        enthusiasm: { min: 8, max: 10 }
      },
      voiceAdjustments: {
        pitchModifier: 0.3,
        speedModifier: 0.2,
        toneAdjustment: EmotionalTone.ENERGETIC,
        accentPreference: AccentType.AUSTRALIAN
      },
      responseStyleModifiers: {
        formalityBoost: -0.3,
        enthusiasmBoost: 0.3,
        wordComplexity: -0.2,
        responseLength: -0.1
      }
    });

    // Calm and supportive personality mapping
    this.personalityMappings.push({
      personalityRange: {
        friendliness: { min: 6, max: 9 },
        formality: { min: 4, max: 7 },
        humor: { min: 3, max: 7 },
        enthusiasm: { min: 4, max: 7 }
      },
      voiceAdjustments: {
        pitchModifier: -0.05,
        speedModifier: -0.1,
        toneAdjustment: EmotionalTone.GENTLE,
        accentPreference: AccentType.NEUTRAL
      },
      responseStyleModifiers: {
        formalityBoost: 0.05,
        enthusiasmBoost: 0.0,
        wordComplexity: 0.0,
        responseLength: 0.1
      }
    });
  }

  private initializeResponseTemplates(): void {
    // Enthusiastic response templates
    this.responseTemplates.set('enthusiastic', [
      "That's fantastic! {response}",
      "How exciting! {response}",
      "Wonderful! {response}",
      "Amazing! {response}"
    ]);

    // Formal response templates
    this.responseTemplates.set('formal', [
      "I understand. {response}",
      "Certainly. {response}",
      "Indeed. {response}",
      "I see. {response}"
    ]);

    // Friendly response templates
    this.responseTemplates.set('friendly', [
      "Oh, that's great! {response}",
      "I'm so glad to hear that! {response}",
      "That sounds wonderful! {response}",
      "How nice! {response}"
    ]);

    // Supportive response templates
    this.responseTemplates.set('supportive', [
      "I'm here to help. {response}",
      "Let's work through this together. {response}",
      "You're doing great! {response}",
      "I believe in you. {response}"
    ]);
  }

  private setupEventListeners(): void {
    // Listen for emotion changes to update voice expression
    avatarEventBus.onEmotionChanged((userId, emotion, intensity) => {
      const expression = this.activeExpressions.get(userId);
      if (expression) {
        expression.activeEmotion = emotion;
        expression.lastUpdated = new Date();
        this.activeExpressions.set(userId, expression);
      }
    });
  }

  private async testVoicePipelineConnection(): Promise<void> {
    if (!this.voicePipeline) {
      throw new Error('Voice pipeline not set');
    }

    // Test with default characteristics
    const testCharacteristics: VoiceCharacteristics = {
      pitch: 0,
      speed: 1,
      accent: AccentType.NEUTRAL,
      emotionalTone: EmotionalTone.CALM,
      volume: 0.8
    };

    await this.voicePipeline.updateTTSParameters(testCharacteristics);
  }

  private findBestPersonalityMapping(traits: PersonalityTraits): PersonalityVoiceMapping | undefined {
    for (const mapping of this.personalityMappings) {
      if (this.traitsMatchMapping(traits, mapping)) {
        return mapping;
      }
    }
    return undefined;
  }

  private traitsMatchMapping(traits: PersonalityTraits, mapping: PersonalityVoiceMapping): boolean {
    const ranges = mapping.personalityRange;
    
    return (
      traits.friendliness >= ranges.friendliness.min && traits.friendliness <= ranges.friendliness.max &&
      traits.formality >= ranges.formality.min && traits.formality <= ranges.formality.max &&
      traits.humor >= ranges.humor.min && traits.humor <= ranges.humor.max &&
      traits.enthusiasm >= ranges.enthusiasm.min && traits.enthusiasm <= ranges.enthusiasm.max
    );
  }

  private applyPersonalityMappingToStyle(
    baseStyle: ResponseStyle, 
    mapping: PersonalityVoiceMapping, 
    context: InteractionContext
  ): ResponseStyle {
    const modifiers = mapping.responseStyleModifiers;
    
    return {
      formality: Math.max(0, Math.min(1, baseStyle.formality + modifiers.formalityBoost)),
      enthusiasm: Math.max(0, Math.min(1, baseStyle.enthusiasm + modifiers.enthusiasmBoost)),
      wordChoice: this.adjustWordChoice(baseStyle.wordChoice, modifiers.wordComplexity),
      responseLength: this.adjustResponseLength(baseStyle.responseLength, modifiers.responseLength)
    };
  }

  private adjustWordChoice(current: 'simple' | 'moderate' | 'advanced', modifier: number): 'simple' | 'moderate' | 'advanced' {
    const levels = ['simple', 'moderate', 'advanced'];
    const currentIndex = levels.indexOf(current);
    const newIndex = Math.max(0, Math.min(2, Math.round(currentIndex + modifier * 2)));
    return levels[newIndex] as 'simple' | 'moderate' | 'advanced';
  }

  private adjustResponseLength(current: 'brief' | 'moderate' | 'detailed', modifier: number): 'brief' | 'moderate' | 'detailed' {
    const levels = ['brief', 'moderate', 'detailed'];
    const currentIndex = levels.indexOf(current);
    const newIndex = Math.max(0, Math.min(2, Math.round(currentIndex + modifier * 2)));
    return levels[newIndex] as 'brief' | 'moderate' | 'detailed';
  }

  private determineEmotionalTone(traits: PersonalityTraits): EmotionalTone {
    if (traits.enthusiasm > 8) {
      return EmotionalTone.ENERGETIC;
    } else if (traits.friendliness > 8 && traits.humor > 6) {
      return EmotionalTone.CHEERFUL;
    } else if (traits.patience > 7 && traits.supportiveness > 7) {
      return EmotionalTone.GENTLE;
    } else {
      return EmotionalTone.CALM;
    }
  }

  private getStoredVoiceCharacteristics(userId: string): VoiceCharacteristics | undefined {
    const expression = this.activeExpressions.get(userId);
    return expression?.voiceCharacteristics;
  }

  private generateDefaultVoiceCharacteristics(traits: PersonalityTraits): VoiceCharacteristics {
    return {
      pitch: (traits.friendliness - 5) * 0.2, // -1.0 to 1.0
      speed: 0.8 + (traits.enthusiasm / 20),  // 0.8 to 1.3
      accent: AccentType.NEUTRAL,
      emotionalTone: this.determineEmotionalTone(traits),
      volume: 0.8
    };
  }

  private applyPersonalityToResponse(
    response: string, 
    traits: PersonalityTraits, 
    context: InteractionContext
  ): string {
    // Determine response template category based on personality
    let templateCategory = 'friendly';
    
    if (traits.enthusiasm > 8) {
      templateCategory = 'enthusiastic';
    } else if (traits.formality > 7) {
      templateCategory = 'formal';
    } else if (traits.supportiveness > 8) {
      templateCategory = 'supportive';
    }
    
    // Get templates for the category
    const templates = this.responseTemplates.get(templateCategory) || [];
    
    if (templates.length > 0 && Math.random() < 0.3) { // 30% chance to use template
      const template = templates[Math.floor(Math.random() * templates.length)];
      return template.replace('{response}', response);
    }
    
    return response;
  }

  private generateFallbackResponse(input: string, traits: PersonalityTraits): string {
    const friendlyResponses = [
      "I'd be happy to help with that!",
      "Let me think about that for you.",
      "That's an interesting question!",
      "I'm here to assist you with that."
    ];
    
    const formalResponses = [
      "I understand your inquiry.",
      "Allow me to address that matter.",
      "I shall consider your request.",
      "I will provide assistance with that."
    ];
    
    const responses = traits.formality > 6 ? formalResponses : friendlyResponses;
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

// Export singleton instance
export const personalityVoiceIntegration = new PersonalityVoiceIntegration();