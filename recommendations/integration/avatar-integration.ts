/**
 * Avatar Integration Layer for Personalized Recommendations
 * 
 * Connects recommendations with avatar personality traits and provides
 * emotion-aware recommendation presentation with avatar-based explanations.
 */

import { 
  Recommendation, 
  IntegrationAction, 
  UserContext,
  RecommendationMetadata 
} from '../types';
import { RecommendationType } from '../enums';
import { 
  PersonalityTraits, 
  EmotionType, 
  ResponseStyle, 
  InteractionContext,
  AvatarConfiguration 
} from '../../avatar/types';
import { personalityManager } from '../../avatar/personality-manager';
import { avatarEventBus } from '../../avatar/events';

export interface IAvatarIntegration {
  integrateWithAvatar(recommendation: Recommendation, userId: string): Promise<IntegrationAction[]>;
  generatePersonalizedPresentation(recommendation: Recommendation, personality: PersonalityTraits, context: UserContext): Promise<AvatarRecommendationPresentation>;
  generateAvatarExplanation(recommendation: Recommendation, personality: PersonalityTraits): Promise<string>;
  adaptEmotionalTone(recommendation: Recommendation, userMood: string, personality: PersonalityTraits): Promise<EmotionType>;
  validateChildSafePresentation(presentation: AvatarRecommendationPresentation, userId: string): Promise<boolean>;
}

export interface AvatarRecommendationPresentation {
  title: string;
  description: string;
  explanation: string;
  emotionalTone: EmotionType;
  responseStyle: ResponseStyle;
  visualCues: AvatarVisualCue[];
  voiceCharacteristics: AvatarVoiceSettings;
  interactionPrompts: string[];
  childSafeContent: boolean;
}

export interface AvatarVisualCue {
  type: 'gesture' | 'expression' | 'animation' | 'highlight';
  trigger: 'start' | 'emphasis' | 'question' | 'completion';
  intensity: number; // 0-1 scale
  duration: number; // milliseconds
}

export interface AvatarVoiceSettings {
  pitch: number; // -2.0 to 2.0
  speed: number; // 0.5 to 2.0
  enthusiasm: number; // 0-1 scale
  formality: number; // 0-1 scale
  pausePattern: 'natural' | 'deliberate' | 'excited' | 'calm';
}

/**
 * Avatar integration implementation that personalizes recommendation delivery
 * based on avatar personality traits and user context
 */
export class AvatarIntegration implements IAvatarIntegration {
  private readonly CHILD_SAFETY_KEYWORDS = [
    'safe', 'fun', 'learning', 'family', 'together', 'explore', 'discover', 'create'
  ];
  
  private readonly RESTRICTED_KEYWORDS = [
    'alone', 'secret', 'private', 'adult', 'mature', 'advanced'
  ];

  /**
   * Generate avatar integration actions for seamless recommendation delivery
   */
  async integrateWithAvatar(recommendation: Recommendation, userId: string): Promise<IntegrationAction[]> {
    try {
      // Get user's avatar personality traits
      const personality = personalityManager.getActivePersonality(userId);
      if (!personality) {
        return this.createFallbackIntegrationActions(recommendation);
      }

      // Get current user context for personalization
      const context = await this.getCurrentUserContext(userId);
      
      // Generate personalized presentation
      const presentation = await this.generatePersonalizedPresentation(
        recommendation, 
        personality, 
        context
      );

      // Validate child safety for presentation
      const isSafe = await this.validateChildSafePresentation(presentation, userId);
      if (!isSafe) {
        return this.createSafetyFallbackActions(recommendation);
      }

      // Create integration actions for avatar system
      const integrationActions: IntegrationAction[] = [
        {
          system: 'avatar',
          action: 'updateEmotionalState',
          parameters: {
            emotion: presentation.emotionalTone,
            intensity: this.calculateEmotionIntensity(personality, recommendation),
            duration: 5000 // 5 seconds
          }
        },
        {
          system: 'avatar',
          action: 'setResponseStyle',
          parameters: {
            formality: presentation.responseStyle.formality,
            enthusiasm: presentation.responseStyle.enthusiasm,
            wordChoice: presentation.responseStyle.wordChoice,
            responseLength: presentation.responseStyle.responseLength
          }
        },
        {
          system: 'avatar',
          action: 'presentRecommendation',
          parameters: {
            title: presentation.title,
            description: presentation.description,
            explanation: presentation.explanation,
            visualCues: presentation.visualCues,
            voiceSettings: presentation.voiceCharacteristics,
            interactionPrompts: presentation.interactionPrompts
          }
        },
        {
          system: 'avatar',
          action: 'enableFeedbackCollection',
          parameters: {
            recommendationId: recommendation.id,
            feedbackPrompts: this.generateFeedbackPrompts(personality),
            timeoutMs: 30000 // 30 seconds
          }
        }
      ];

      // Emit integration event for monitoring
      avatarEventBus.emit('avatar:recommendation:integrated', {
        userId,
        recommendationId: recommendation.id,
        personalityTraits: personality,
        presentationStyle: presentation.responseStyle,
        timestamp: new Date()
      });

      return integrationActions;

    } catch (error) {
      console.error('Error integrating recommendation with avatar:', error);
      return this.createFallbackIntegrationActions(recommendation);
    }
  }

  /**
   * Generate personalized presentation based on avatar personality and context
   */
  async generatePersonalizedPresentation(
    recommendation: Recommendation, 
    personality: PersonalityTraits, 
    context: UserContext
  ): Promise<AvatarRecommendationPresentation> {
    try {
      // Generate response style based on personality
      const interactionContext: InteractionContext = {
        userId: context.userId,
        conversationId: `rec-${recommendation.id}`,
        emotionalState: context.mood.detected || 'neutral',
        recentTopics: this.extractTopicsFromRecommendation(recommendation)
      };

      const responseStyle = personalityManager.generateResponseStyle(personality, interactionContext);

      // Adapt recommendation content to personality
      const personalizedTitle = await this.personalizeTitle(recommendation.title, personality, responseStyle);
      const personalizedDescription = await this.personalizeDescription(
        recommendation.description, 
        personality, 
        responseStyle
      );

      // Generate avatar explanation
      const explanation = await this.generateAvatarExplanation(recommendation, personality);

      // Determine emotional tone
      const emotionalTone = await this.adaptEmotionalTone(
        recommendation, 
        context.mood.detected || 'neutral', 
        personality
      );

      // Generate visual cues based on personality
      const visualCues = this.generateVisualCues(recommendation, personality);

      // Configure voice characteristics
      const voiceCharacteristics = this.configureVoiceSettings(personality, responseStyle);

      // Generate interaction prompts
      const interactionPrompts = this.generateInteractionPrompts(recommendation, personality);

      return {
        title: personalizedTitle,
        description: personalizedDescription,
        explanation,
        emotionalTone,
        responseStyle,
        visualCues,
        voiceCharacteristics,
        interactionPrompts,
        childSafeContent: await this.validateChildSafeContent(personalizedTitle + ' ' + personalizedDescription)
      };

    } catch (error) {
      console.error('Error generating personalized presentation:', error);
      return this.createFallbackPresentation(recommendation);
    }
  }

  /**
   * Generate avatar-based explanation for recommendations
   */
  async generateAvatarExplanation(
    recommendation: Recommendation, 
    personality: PersonalityTraits
  ): Promise<string> {
    try {
      const baseExplanation = recommendation.reasoning.join('. ');
      
      // Adapt explanation style based on personality traits
      let explanation = baseExplanation;

      // High friendliness - add warm, welcoming language
      if (personality.friendliness >= 7) {
        explanation = `I'm excited to suggest this because ${explanation.toLowerCase()}`;
      }

      // High enthusiasm - add energetic language
      if (personality.enthusiasm >= 8) {
        explanation = explanation.replace(/\./g, '! ');
        explanation += ' This could be really amazing!';
      }

      // High supportiveness - add encouraging language
      if (personality.supportiveness >= 7) {
        explanation += ' I believe this would be perfect for you right now.';
      }

      // Low formality - make it more casual
      if (personality.formality <= 4) {
        explanation = explanation.replace(/because/g, 'cause');
        explanation = explanation.replace(/you would/g, "you'd");
        explanation = explanation.replace(/it is/g, "it's");
      }

      // High humor - add light humor if appropriate
      if (personality.humor >= 7 && recommendation.type === RecommendationType.ACTIVITY) {
        explanation += ' Plus, it sounds like it could be a lot of fun!';
      }

      // High patience - add reassuring language
      if (personality.patience >= 8) {
        explanation += ' Take your time thinking about it - there\'s no rush!';
      }

      return explanation;

    } catch (error) {
      console.error('Error generating avatar explanation:', error);
      return recommendation.reasoning.join('. ');
    }
  }

  /**
   * Adapt emotional tone based on user mood and personality
   */
  async adaptEmotionalTone(
    recommendation: Recommendation, 
    userMood: string, 
    personality: PersonalityTraits
  ): Promise<EmotionType> {
    try {
      // Base emotion from recommendation type
      let baseEmotion: EmotionType = EmotionType.NEUTRAL;

      switch (recommendation.type) {
        case RecommendationType.ACTIVITY:
          baseEmotion = EmotionType.EXCITED;
          break;
        case RecommendationType.EDUCATIONAL:
          baseEmotion = EmotionType.THINKING;
          break;
        case RecommendationType.SCHEDULE:
          baseEmotion = EmotionType.NEUTRAL;
          break;
        case RecommendationType.HOUSEHOLD:
          baseEmotion = EmotionType.HAPPY;
          break;
      }

      // Adjust based on user mood
      switch (userMood) {
        case 'sad':
          if (personality.supportiveness >= 7) {
            return EmotionType.HAPPY; // Try to lift mood
          }
          break;
        case 'excited':
          if (personality.enthusiasm >= 6) {
            return EmotionType.EXCITED; // Match energy
          }
          break;
        case 'tired':
          if (personality.patience >= 7) {
            return EmotionType.NEUTRAL; // Be calm and gentle
          }
          break;
        case 'stressed':
          if (personality.supportiveness >= 6) {
            return EmotionType.HAPPY; // Provide comfort
          }
          break;
      }

      // Adjust based on personality traits
      if (personality.enthusiasm >= 8) {
        return EmotionType.EXCITED;
      } else if (personality.friendliness >= 8) {
        return EmotionType.HAPPY;
      }

      return baseEmotion;

    } catch (error) {
      console.error('Error adapting emotional tone:', error);
      return EmotionType.NEUTRAL;
    }
  }

  /**
   * Validate child-safe presentation content
   */
  async validateChildSafePresentation(
    presentation: AvatarRecommendationPresentation, 
    userId: string
  ): Promise<boolean> {
    try {
      // Check if user is a child (placeholder - would integrate with user profile system)
      const isChild = await this.isChildUser(userId);
      if (!isChild) {
        return true; // No additional restrictions for adults
      }

      // Validate content for child safety
      const contentToValidate = [
        presentation.title,
        presentation.description,
        presentation.explanation,
        ...presentation.interactionPrompts
      ].join(' ');

      return await this.validateChildSafeContent(contentToValidate);

    } catch (error) {
      console.error('Error validating child-safe presentation:', error);
      return false; // Fail safe - reject if validation fails
    }
  }

  // Private helper methods

  private async getCurrentUserContext(userId: string): Promise<UserContext> {
    // Placeholder - would integrate with context analyzer
    return {
      userId,
      timestamp: new Date(),
      location: { type: 'home', indoorOutdoor: 'indoor' },
      activity: { interruptible: true },
      availability: { 
        freeTime: [], 
        busyTime: [], 
        flexibleTime: [], 
        energyLevel: { level: 'medium', trend: 'stable' } 
      },
      mood: { detected: 'calm', confidence: 0.5, source: 'inferred' },
      energy: { level: 'medium', trend: 'stable' },
      social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
      environmental: { 
        weather: { temperature: 20, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
        timeOfDay: 'afternoon',
        season: 'spring',
        dayOfWeek: 'Monday',
        isHoliday: false
      },
      preferences: { 
        preferredActivities: [], 
        avoidedActivities: [], 
        timePreferences: [], 
        socialPreferences: { familyTime: 'medium', aloneTime: 'medium', groupActivities: 'acceptable' } 
      }
    };
  }

  private createFallbackIntegrationActions(recommendation: Recommendation): IntegrationAction[] {
    return [
      {
        system: 'avatar',
        action: 'presentRecommendation',
        parameters: {
          title: recommendation.title,
          description: recommendation.description,
          explanation: recommendation.reasoning.join('. '),
          emotionalTone: EmotionType.NEUTRAL,
          voiceSettings: {
            pitch: 0,
            speed: 1.0,
            enthusiasm: 0.5,
            formality: 0.5,
            pausePattern: 'natural'
          }
        }
      }
    ];
  }

  private createSafetyFallbackActions(recommendation: Recommendation): IntegrationAction[] {
    return [
      {
        system: 'avatar',
        action: 'presentSafeRecommendation',
        parameters: {
          title: 'I have a suggestion for you',
          description: 'Let me share something that might be helpful.',
          explanation: 'This recommendation has been reviewed for safety.',
          emotionalTone: EmotionType.HAPPY,
          childSafeMode: true
        }
      }
    ];
  }

  private calculateEmotionIntensity(personality: PersonalityTraits, recommendation: Recommendation): number {
    // Calculate emotion intensity based on personality and recommendation confidence
    const baseIntensity = recommendation.confidence;
    const personalityFactor = (personality.enthusiasm + personality.friendliness) / 20;
    return Math.min(1.0, baseIntensity * personalityFactor);
  }

  private extractTopicsFromRecommendation(recommendation: Recommendation): string[] {
    const topics: string[] = [];
    
    // Extract topics from title and description
    const text = `${recommendation.title} ${recommendation.description}`.toLowerCase();
    
    // Simple keyword extraction (in real implementation, would use NLP)
    const keywords = ['activity', 'schedule', 'learning', 'family', 'fun', 'work', 'exercise', 'creative'];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        topics.push(keyword);
      }
    }
    
    return topics;
  }

  private async personalizeTitle(title: string, personality: PersonalityTraits, style: ResponseStyle): Promise<string> {
    let personalizedTitle = title;

    // High enthusiasm - add excitement
    if (personality.enthusiasm >= 8) {
      personalizedTitle = `🌟 ${personalizedTitle}`;
    }

    // High friendliness - add warm language
    if (personality.friendliness >= 7) {
      personalizedTitle = `${personalizedTitle} - just for you!`;
    }

    // Low formality - make it casual
    if (personality.formality <= 4) {
      personalizedTitle = personalizedTitle.replace(/Recommendation/g, 'Idea');
      personalizedTitle = personalizedTitle.replace(/Suggestion/g, 'Thought');
    }

    return personalizedTitle;
  }

  private async personalizeDescription(
    description: string, 
    personality: PersonalityTraits, 
    style: ResponseStyle
  ): Promise<string> {
    let personalizedDescription = description;

    // Adjust length based on response style
    if (style.responseLength === 'brief') {
      // Shorten description
      const sentences = personalizedDescription.split('. ');
      personalizedDescription = sentences.slice(0, 2).join('. ');
      if (!personalizedDescription.endsWith('.')) {
        personalizedDescription += '.';
      }
    } else if (style.responseLength === 'detailed') {
      // Add more context
      personalizedDescription += ' I think this would be perfect for you based on your preferences.';
    }

    // High supportiveness - add encouraging language
    if (personality.supportiveness >= 7) {
      personalizedDescription += ' I\'m here to help if you need any guidance!';
    }

    return personalizedDescription;
  }

  private generateVisualCues(recommendation: Recommendation, personality: PersonalityTraits): AvatarVisualCue[] {
    const cues: AvatarVisualCue[] = [];

    // Start with welcoming gesture
    cues.push({
      type: 'gesture',
      trigger: 'start',
      intensity: Math.min(1.0, personality.friendliness / 10),
      duration: 2000
    });

    // Add expression based on recommendation type
    let expressionIntensity = 0.5;
    if (personality.enthusiasm >= 7) {
      expressionIntensity = 0.8;
    }

    cues.push({
      type: 'expression',
      trigger: 'emphasis',
      intensity: expressionIntensity,
      duration: 3000
    });

    // High humor - add playful animation
    if (personality.humor >= 7) {
      cues.push({
        type: 'animation',
        trigger: 'emphasis',
        intensity: 0.6,
        duration: 1500
      });
    }

    return cues;
  }

  private configureVoiceSettings(personality: PersonalityTraits, style: ResponseStyle): AvatarVoiceSettings {
    return {
      pitch: this.calculateVoicePitch(personality),
      speed: this.calculateVoiceSpeed(personality, style),
      enthusiasm: style.enthusiasm,
      formality: style.formality,
      pausePattern: this.determinePausePattern(personality)
    };
  }

  private calculateVoicePitch(personality: PersonalityTraits): number {
    // Higher enthusiasm and friendliness = slightly higher pitch
    const pitchFactor = (personality.enthusiasm + personality.friendliness) / 20;
    return Math.max(-1.0, Math.min(1.0, (pitchFactor - 0.5) * 0.5));
  }

  private calculateVoiceSpeed(personality: PersonalityTraits, style: ResponseStyle): number {
    let baseSpeed = 1.0;

    // High enthusiasm = faster speech
    if (personality.enthusiasm >= 8) {
      baseSpeed = 1.2;
    }

    // High patience = slower, more deliberate speech
    if (personality.patience >= 8) {
      baseSpeed = 0.9;
    }

    // Adjust for response style
    if (style.responseLength === 'brief') {
      baseSpeed *= 1.1; // Slightly faster for brief responses
    }

    return Math.max(0.7, Math.min(1.5, baseSpeed));
  }

  private determinePausePattern(personality: PersonalityTraits): 'natural' | 'deliberate' | 'excited' | 'calm' {
    if (personality.enthusiasm >= 8) {
      return 'excited';
    } else if (personality.patience >= 8) {
      return 'deliberate';
    } else if (personality.friendliness >= 8) {
      return 'calm';
    }
    return 'natural';
  }

  private generateInteractionPrompts(recommendation: Recommendation, personality: PersonalityTraits): string[] {
    const prompts: string[] = [];

    // Base prompts
    prompts.push('What do you think about this suggestion?');
    prompts.push('Would you like to try this?');

    // Personality-based prompts
    if (personality.supportiveness >= 7) {
      prompts.push('I\'m here if you have any questions!');
    }

    if (personality.enthusiasm >= 7) {
      prompts.push('This sounds exciting, doesn\'t it?');
    }

    if (personality.patience >= 8) {
      prompts.push('Take your time to think about it.');
    }

    return prompts;
  }

  private generateFeedbackPrompts(personality: PersonalityTraits): string[] {
    const prompts: string[] = [];

    if (personality.friendliness >= 7) {
      prompts.push('How did that feel?');
      prompts.push('I\'d love to hear your thoughts!');
    } else {
      prompts.push('Please rate this suggestion.');
      prompts.push('Any feedback?');
    }

    return prompts;
  }

  private createFallbackPresentation(recommendation: Recommendation): AvatarRecommendationPresentation {
    return {
      title: recommendation.title,
      description: recommendation.description,
      explanation: recommendation.reasoning.join('. '),
      emotionalTone: EmotionType.NEUTRAL,
      responseStyle: {
        formality: 0.5,
        enthusiasm: 0.5,
        wordChoice: 'simple',
        responseLength: 'moderate'
      },
      visualCues: [],
      voiceCharacteristics: {
        pitch: 0,
        speed: 1.0,
        enthusiasm: 0.5,
        formality: 0.5,
        pausePattern: 'natural'
      },
      interactionPrompts: ['What do you think?'],
      childSafeContent: true
    };
  }

  private async validateChildSafeContent(content: string): Promise<boolean> {
    try {
      const lowerContent = content.toLowerCase();

      // Check for restricted keywords
      for (const keyword of this.RESTRICTED_KEYWORDS) {
        if (lowerContent.includes(keyword)) {
          return false;
        }
      }

      // Ensure presence of child-safe keywords for child users
      const hasChildSafeKeywords = this.CHILD_SAFETY_KEYWORDS.some(keyword => 
        lowerContent.includes(keyword)
      );

      // For now, return true if no restricted content found
      // In real implementation, would integrate with content safety validator
      return !this.RESTRICTED_KEYWORDS.some(keyword => lowerContent.includes(keyword));

    } catch (error) {
      console.error('Error validating child-safe content:', error);
      return false; // Fail safe
    }
  }

  private async isChildUser(userId: string): Promise<boolean> {
    // Placeholder - would integrate with user profile system
    // For now, assume all users need child-safe content
    return true;
  }
}

// Export singleton instance
export const avatarIntegration = new AvatarIntegration();