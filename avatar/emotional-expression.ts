// Emotional Expression System for Avatar

import { 
  EmotionType, 
  PersonalityTraits, 
  EmotionalConfiguration,
  EmotionMapping,
  InteractionContext,
  AgeRange
} from './types';
import { avatarEventBus } from './events';
// Note: validateChildSafeContent will be implemented in safety-validator.ts

export interface EmotionState {
  currentEmotion: EmotionType;
  intensity: number; // 0.0 to 1.0
  duration: number; // milliseconds
  startTime: number; // timestamp
  blendingFrom?: EmotionType;
  blendProgress?: number; // 0.0 to 1.0 for smooth transitions
}

export interface AnimationMapping {
  emotion: EmotionType;
  animationId: string;
  intensityLevels: {
    low: string;    // 0.0 - 0.33
    medium: string; // 0.34 - 0.66
    high: string;   // 0.67 - 1.0
  };
  facialExpressions: FacialExpressionSet;
  bodyLanguage: BodyLanguageSet;
}

export interface FacialExpressionSet {
  eyebrows: number; // -1.0 to 1.0 (down to up)
  eyes: number;     // 0.0 to 1.0 (closed to wide open)
  mouth: number;    // -1.0 to 1.0 (frown to smile)
  cheeks: number;   // 0.0 to 1.0 (neutral to raised)
}

export interface BodyLanguageSet {
  posture: number;    // 0.0 to 1.0 (slouched to upright)
  armPosition: number; // 0.0 to 1.0 (down to raised)
  headTilt: number;   // -1.0 to 1.0 (left to right)
  energy: number;     // 0.0 to 1.0 (calm to energetic)
}

export interface EmotionTrigger {
  contextKeywords: string[];
  emotionResponse: EmotionType;
  intensityModifier: number;
  durationMs: number;
  personalityInfluence: boolean;
}

export interface EmotionValidationResult {
  isAllowed: boolean;
  blockedEmotions: EmotionType[];
  reason: string;
  alternativeEmotion?: EmotionType;
}

export class EmotionalExpressionSystem {
  private currentState: Map<string, EmotionState> = new Map(); // userId -> EmotionState
  private animationMappings: Map<EmotionType, AnimationMapping> = new Map();
  private emotionTriggers: EmotionTrigger[] = [];
  private transitionSpeed: number = 1000; // Default 1 second transitions
  private activePersonalities: Map<string, PersonalityTraits> = new Map();

  constructor() {
    this.initializeAnimationMappings();
    this.initializeEmotionTriggers();
  }

  /**
   * Creates emotion-to-animation mapping system
   */
  createEmotionAnimationMapping(emotion: EmotionType, mapping: AnimationMapping): void {
    this.animationMappings.set(emotion, mapping);
  }

  /**
   * Implements contextual facial expression generation
   */
  generateContextualExpression(
    userId: string, 
    context: InteractionContext, 
    personality: PersonalityTraits
  ): FacialExpressionSet {
    try {
      // Store personality for this user
      this.activePersonalities.set(userId, personality);

      // Analyze context to determine appropriate emotion
      const triggeredEmotion = this.analyzeContextForEmotion(context, personality);
      
      // Get current emotion state or default to neutral
      const currentState = this.currentState.get(userId) || this.createDefaultEmotionState();
      
      // Generate facial expression based on emotion and personality
      const baseExpression = this.getBaseFacialExpression(triggeredEmotion);
      const personalizedExpression = this.personalizeExpression(baseExpression, personality);
      
      // Validate expression is age-appropriate
      const validatedExpression = this.validateExpressionForAge(personalizedExpression, context);
      
      return validatedExpression;
    } catch (error) {
      // Return neutral expression on error
      return this.getNeutralExpression();
    }
  }

  /**
   * Adds smooth emotion transitions and animation blending
   */
  async transitionToEmotion(
    userId: string, 
    targetEmotion: EmotionType, 
    intensity: number = 0.7,
    duration: number = 2000
  ): Promise<void> {
    try {
      // Validate emotion is appropriate
      const validation = await this.validateEmotionForUser(userId, targetEmotion);
      if (!validation.isAllowed) {
        if (validation.alternativeEmotion) {
          targetEmotion = validation.alternativeEmotion;
        } else {
          return; // Block inappropriate emotion
        }
      }

      const currentState = this.currentState.get(userId) || this.createDefaultEmotionState();
      const startTime = Date.now();

      // Create new emotion state with blending information
      const newState: EmotionState = {
        currentEmotion: targetEmotion,
        intensity: Math.max(0, Math.min(1, intensity)),
        duration,
        startTime,
        blendingFrom: currentState.currentEmotion,
        blendProgress: 0
      };

      this.currentState.set(userId, newState);

      // Start smooth transition animation
      await this.animateEmotionTransition(userId, newState);

      // Emit emotion change event
      avatarEventBus.emitEmotionChanged(userId, targetEmotion, intensity);
    } catch (error) {
      avatarEventBus.emitSystemError('emotional-expression', {
        code: 'EMOTION_TRANSITION_FAILED',
        message: `Failed to transition emotion: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'emotional-expression',
        severity: 'warning',
        recoverable: true,
        context: { userId, targetEmotion, intensity }
      });
    }
  }

  /**
   * Creates emotional state management with personality integration
   */
  manageEmotionalState(userId: string, personality: PersonalityTraits): EmotionState {
    const currentState = this.currentState.get(userId);
    
    if (!currentState) {
      // Create initial state based on personality
      const initialEmotion = this.getPersonalityBasedDefaultEmotion(personality);
      const newState = this.createEmotionState(initialEmotion, 0.5, 0);
      this.currentState.set(userId, newState);
      return newState;
    }

    // Update existing state with personality influence
    const updatedState = this.applyPersonalityInfluence(currentState, personality);
    this.currentState.set(userId, updatedState);
    
    return updatedState;
  }

  /**
   * Gets current emotion state for a user
   */
  getCurrentEmotionState(userId: string): EmotionState | undefined {
    return this.currentState.get(userId);
  }

  /**
   * Processes emotion triggers from interaction context
   */
  processEmotionTriggers(context: InteractionContext, personality: PersonalityTraits): EmotionType {
    for (const trigger of this.emotionTriggers) {
      // Check if any context keywords match trigger
      const hasMatchingKeyword = trigger.contextKeywords.some(keyword =>
        context.recentTopics.some(topic => 
          topic.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      if (hasMatchingKeyword) {
        // Apply personality influence if enabled
        if (trigger.personalityInfluence) {
          return this.applyPersonalityToEmotion(trigger.emotionResponse, personality);
        }
        return trigger.emotionResponse;
      }
    }

    // Default to neutral if no triggers match
    return EmotionType.NEUTRAL;
  }

  /**
   * Updates transition speed for emotion changes
   */
  setTransitionSpeed(speedMs: number): void {
    this.transitionSpeed = Math.max(100, Math.min(5000, speedMs)); // 100ms to 5s range
  }

  // Private helper methods

  private initializeAnimationMappings(): void {
    // Happy emotion mapping
    this.animationMappings.set(EmotionType.HAPPY, {
      emotion: EmotionType.HAPPY,
      animationId: 'happy_base',
      intensityLevels: {
        low: 'happy_subtle',
        medium: 'happy_moderate',
        high: 'happy_excited'
      },
      facialExpressions: {
        eyebrows: 0.3,
        eyes: 0.8,
        mouth: 0.8,
        cheeks: 0.7
      },
      bodyLanguage: {
        posture: 0.8,
        armPosition: 0.6,
        headTilt: 0.1,
        energy: 0.8
      }
    });

    // Sad emotion mapping
    this.animationMappings.set(EmotionType.SAD, {
      emotion: EmotionType.SAD,
      animationId: 'sad_base',
      intensityLevels: {
        low: 'sad_subtle',
        medium: 'sad_moderate',
        high: 'sad_deep'
      },
      facialExpressions: {
        eyebrows: -0.5,
        eyes: 0.3,
        mouth: -0.6,
        cheeks: 0.1
      },
      bodyLanguage: {
        posture: 0.3,
        armPosition: 0.2,
        headTilt: -0.2,
        energy: 0.2
      }
    });

    // Excited emotion mapping
    this.animationMappings.set(EmotionType.EXCITED, {
      emotion: EmotionType.EXCITED,
      animationId: 'excited_base',
      intensityLevels: {
        low: 'excited_mild',
        medium: 'excited_moderate',
        high: 'excited_high'
      },
      facialExpressions: {
        eyebrows: 0.6,
        eyes: 1.0,
        mouth: 0.9,
        cheeks: 0.8
      },
      bodyLanguage: {
        posture: 1.0,
        armPosition: 0.8,
        headTilt: 0.0,
        energy: 1.0
      }
    });

    // Surprised emotion mapping
    this.animationMappings.set(EmotionType.SURPRISED, {
      emotion: EmotionType.SURPRISED,
      animationId: 'surprised_base',
      intensityLevels: {
        low: 'surprised_mild',
        medium: 'surprised_moderate',
        high: 'surprised_shocked'
      },
      facialExpressions: {
        eyebrows: 0.8,
        eyes: 1.0,
        mouth: 0.3,
        cheeks: 0.2
      },
      bodyLanguage: {
        posture: 0.9,
        armPosition: 0.4,
        headTilt: 0.0,
        energy: 0.7
      }
    });

    // Confused emotion mapping
    this.animationMappings.set(EmotionType.CONFUSED, {
      emotion: EmotionType.CONFUSED,
      animationId: 'confused_base',
      intensityLevels: {
        low: 'confused_slight',
        medium: 'confused_moderate',
        high: 'confused_very'
      },
      facialExpressions: {
        eyebrows: -0.2,
        eyes: 0.6,
        mouth: 0.1,
        cheeks: 0.0
      },
      bodyLanguage: {
        posture: 0.6,
        armPosition: 0.3,
        headTilt: 0.3,
        energy: 0.4
      }
    });

    // Thinking emotion mapping
    this.animationMappings.set(EmotionType.THINKING, {
      emotion: EmotionType.THINKING,
      animationId: 'thinking_base',
      intensityLevels: {
        low: 'thinking_light',
        medium: 'thinking_moderate',
        high: 'thinking_deep'
      },
      facialExpressions: {
        eyebrows: 0.1,
        eyes: 0.5,
        mouth: 0.0,
        cheeks: 0.0
      },
      bodyLanguage: {
        posture: 0.7,
        armPosition: 0.4,
        headTilt: 0.2,
        energy: 0.3
      }
    });

    // Neutral emotion mapping
    this.animationMappings.set(EmotionType.NEUTRAL, {
      emotion: EmotionType.NEUTRAL,
      animationId: 'neutral_base',
      intensityLevels: {
        low: 'neutral_relaxed',
        medium: 'neutral_attentive',
        high: 'neutral_alert'
      },
      facialExpressions: {
        eyebrows: 0.0,
        eyes: 0.6,
        mouth: 0.1,
        cheeks: 0.0
      },
      bodyLanguage: {
        posture: 0.7,
        armPosition: 0.5,
        headTilt: 0.0,
        energy: 0.5
      }
    });
  }

  private initializeEmotionTriggers(): void {
    this.emotionTriggers = [
      {
        contextKeywords: ['great', 'awesome', 'wonderful', 'amazing', 'fantastic'],
        emotionResponse: EmotionType.HAPPY,
        intensityModifier: 0.8,
        durationMs: 3000,
        personalityInfluence: true
      },
      {
        contextKeywords: ['sad', 'upset', 'disappointed', 'hurt', 'crying'],
        emotionResponse: EmotionType.SAD,
        intensityModifier: 0.6,
        durationMs: 4000,
        personalityInfluence: true
      },
      {
        contextKeywords: ['excited', 'thrilled', 'can\'t wait', 'amazing news'],
        emotionResponse: EmotionType.EXCITED,
        intensityModifier: 0.9,
        durationMs: 5000,
        personalityInfluence: true
      },
      {
        contextKeywords: ['wow', 'really', 'no way', 'incredible'],
        emotionResponse: EmotionType.SURPRISED,
        intensityModifier: 0.7,
        durationMs: 2000,
        personalityInfluence: false
      },
      {
        contextKeywords: ['confused', 'don\'t understand', 'what', 'huh'],
        emotionResponse: EmotionType.CONFUSED,
        intensityModifier: 0.6,
        durationMs: 3000,
        personalityInfluence: true
      },
      {
        contextKeywords: ['thinking', 'let me think', 'hmm', 'considering'],
        emotionResponse: EmotionType.THINKING,
        intensityModifier: 0.5,
        durationMs: 4000,
        personalityInfluence: false
      }
    ];
  }

  private createDefaultEmotionState(): EmotionState {
    return {
      currentEmotion: EmotionType.NEUTRAL,
      intensity: 0.5,
      duration: 0,
      startTime: Date.now()
    };
  }

  private createEmotionState(emotion: EmotionType, intensity: number, duration: number): EmotionState {
    return {
      currentEmotion: emotion,
      intensity: Math.max(0, Math.min(1, intensity)),
      duration,
      startTime: Date.now()
    };
  }

  private analyzeContextForEmotion(context: InteractionContext, personality: PersonalityTraits): EmotionType {
    // Use emotion triggers to analyze context
    const triggeredEmotion = this.processEmotionTriggers(context, personality);
    
    // If no specific trigger, use emotional state from context
    if (triggeredEmotion === EmotionType.NEUTRAL && context.emotionalState) {
      return context.emotionalState as EmotionType;
    }
    
    return triggeredEmotion;
  }

  private getBaseFacialExpression(emotion: EmotionType): FacialExpressionSet {
    const mapping = this.animationMappings.get(emotion);
    return mapping ? mapping.facialExpressions : this.getNeutralExpression();
  }

  private personalizeExpression(expression: FacialExpressionSet, personality: PersonalityTraits): FacialExpressionSet {
    const personalizedExpression = { ...expression };
    
    // Adjust expression based on personality traits
    const enthusiasmFactor = personality.enthusiasm / 10;
    const friendlinessFactor = personality.friendliness / 10;
    
    // More enthusiastic personalities have more expressive features
    personalizedExpression.eyebrows *= (0.7 + enthusiasmFactor * 0.3);
    personalizedExpression.mouth *= (0.7 + friendlinessFactor * 0.3);
    personalizedExpression.cheeks *= (0.8 + enthusiasmFactor * 0.2);
    
    // Ensure values stay within valid ranges
    personalizedExpression.eyebrows = Math.max(-1, Math.min(1, personalizedExpression.eyebrows));
    personalizedExpression.eyes = Math.max(0, Math.min(1, personalizedExpression.eyes));
    personalizedExpression.mouth = Math.max(-1, Math.min(1, personalizedExpression.mouth));
    personalizedExpression.cheeks = Math.max(0, Math.min(1, personalizedExpression.cheeks));
    
    return personalizedExpression;
  }

  private validateExpressionForAge(expression: FacialExpressionSet, context: InteractionContext): FacialExpressionSet {
    // For now, return expression as-is since facial expressions are generally age-appropriate
    // In a full implementation, this would check for any inappropriate expressions
    return expression;
  }

  private getNeutralExpression(): FacialExpressionSet {
    return {
      eyebrows: 0.0,
      eyes: 0.6,
      mouth: 0.1,
      cheeks: 0.0
    };
  }

  private async validateEmotionForUser(userId: string, emotion: EmotionType): Promise<EmotionValidationResult> {
    // Basic validation - in a full implementation this would check user age and safety rules
    const blockedEmotions: EmotionType[] = [];
    
    // For children, we might want to avoid certain intense emotions
    // This is a simplified check
    return {
      isAllowed: true,
      blockedEmotions,
      reason: 'Emotion validated successfully'
    };
  }

  private async animateEmotionTransition(userId: string, newState: EmotionState): Promise<void> {
    const transitionDuration = this.transitionSpeed;
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / transitionDuration);
        
        // Update blend progress
        newState.blendProgress = progress;
        this.currentState.set(userId, newState);
        
        // Emit animation trigger event
        avatarEventBus.emitAnimationTriggered(userId, newState.currentEmotion, newState.intensity);
        
        if (progress < 1) {
          // Use setTimeout for Node.js compatibility instead of requestAnimationFrame
          setTimeout(animate, 16); // ~60fps
        } else {
          // Transition complete
          newState.blendingFrom = undefined;
          newState.blendProgress = undefined;
          this.currentState.set(userId, newState);
          resolve();
        }
      };
      
      animate();
    });
  }

  private getPersonalityBasedDefaultEmotion(personality: PersonalityTraits): EmotionType {
    // Determine default emotion based on personality traits
    if (personality.enthusiasm > 7 && personality.friendliness > 7) {
      return EmotionType.HAPPY;
    } else if (personality.enthusiasm > 8) {
      return EmotionType.EXCITED;
    } else {
      return EmotionType.NEUTRAL;
    }
  }

  private applyPersonalityInfluence(state: EmotionState, personality: PersonalityTraits): EmotionState {
    const updatedState = { ...state };
    
    // Personality affects emotion intensity and duration
    const enthusiasmFactor = personality.enthusiasm / 10;
    const patienceFactor = personality.patience / 10;
    
    // More enthusiastic personalities have more intense emotions
    updatedState.intensity *= (0.7 + enthusiasmFactor * 0.3);
    
    // More patient personalities have longer-lasting emotions
    updatedState.duration *= (0.8 + patienceFactor * 0.4);
    
    // Ensure values stay within valid ranges
    updatedState.intensity = Math.max(0, Math.min(1, updatedState.intensity));
    
    return updatedState;
  }

  private applyPersonalityToEmotion(emotion: EmotionType, personality: PersonalityTraits): EmotionType {
    // Personality can modify triggered emotions
    switch (emotion) {
      case EmotionType.HAPPY:
        // High enthusiasm personalities might escalate to excited
        if (personality.enthusiasm > 8) {
          return EmotionType.EXCITED;
        }
        break;
      case EmotionType.SAD:
        // High supportiveness personalities might moderate sadness
        if (personality.supportiveness > 8) {
          return EmotionType.NEUTRAL;
        }
        break;
      default:
        break;
    }
    
    return emotion;
  }
}

// Export singleton instance
export const emotionalExpressionSystem = new EmotionalExpressionSystem();