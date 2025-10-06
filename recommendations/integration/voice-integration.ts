/**
 * Voice Integration Layer for Personalized Recommendations
 * 
 * Implements voice-based recommendation requests and delivery with natural language
 * explanation of recommendations and voice feedback collection for improvement.
 */

import { 
  Recommendation, 
  IntegrationAction, 
  UserContext,
  UserFeedback,
  RecommendationMetadata 
} from '../types';
import { RecommendationType } from '../enums';
import { 
  PersonalityTraits, 
  ResponseStyle, 
  InteractionContext,
  VoiceCharacteristics,
  EmotionType
} from '../../avatar/types';
import { personalityManager } from '../../avatar/personality-manager';
import { voicePipelineIntegrationLayer } from '../../avatar/voice-pipeline-integration';

export interface IVoiceIntegration {
  integrateWithVoice(recommendation: Recommendation, userId: string): Promise<IntegrationAction[]>;
  generateNaturalLanguageExplanation(recommendation: Recommendation, personality: PersonalityTraits): Promise<string>;
  processVoiceRecommendationRequest(userId: string, voiceInput: string, context: UserContext): Promise<VoiceRecommendationResponse>;
  collectVoiceFeedback(recommendationId: string, userId: string, voiceInput: string): Promise<UserFeedback>;
  adaptToVoiceContext(recommendation: Recommendation, voiceContext: VoiceInteractionContext): Promise<VoiceAdaptedRecommendation>;
  validateChildSafeVoiceContent(content: string, userId: string): Promise<boolean>;
}

export interface VoiceRecommendationResponse {
  spokenResponse: string;
  recommendations: Recommendation[];
  voiceCharacteristics: VoiceCharacteristics;
  followUpPrompts: string[];
  interactionId: string;
  requiresConfirmation: boolean;
}

export interface VoiceInteractionContext {
  userId: string;
  sessionId: string;
  conversationHistory: VoiceConversationTurn[];
  currentEmotion: string;
  backgroundNoise: number;
  privacyLevel: 'private' | 'semi-private' | 'public';
  timeConstraints: {
    hasTimeLimit: boolean;
    maxDurationSeconds?: number;
    urgency: 'low' | 'medium' | 'high';
  };
  deviceContext: {
    deviceType: 'smart_speaker' | 'mobile' | 'desktop' | 'wearable';
    audioQuality: 'low' | 'medium' | 'high';
    isHandsFree: boolean;
  };
}

export interface VoiceConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  systemResponse: string;
  intent: string;
  confidence: number;
  emotion: string;
  duration: number;
}

export interface VoiceAdaptedRecommendation extends Recommendation {
  spokenTitle: string;
  spokenDescription: string;
  spokenExplanation: string;
  voicePrompts: VoicePrompt[];
  audioLength: number; // estimated seconds
  speechRate: number;
  pausePoints: number[]; // positions for natural pauses
}

export interface VoicePrompt {
  type: 'confirmation' | 'clarification' | 'feedback' | 'action';
  text: string;
  expectedResponses: string[];
  timeout: number; // seconds
  fallbackAction: string;
}

export interface VoiceFeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  specificFeedback: {
    liked: string[];
    disliked: string[];
    suggestions: string[];
  };
  emotionalResponse: string;
  engagementLevel: 'low' | 'medium' | 'high';
}

/**
 * Voice integration implementation for natural recommendation delivery
 */
export class VoiceIntegration implements IVoiceIntegration {
  private readonly MAX_SPOKEN_LENGTH = 300; // Maximum characters for spoken content
  private readonly CHILD_SAFE_VOCABULARY = [
    'fun', 'exciting', 'great', 'awesome', 'cool', 'interesting', 'helpful',
    'learn', 'discover', 'explore', 'create', 'play', 'enjoy', 'try'
  ];
  
  private readonly RESTRICTED_VOICE_CONTENT = [
    'private', 'secret', 'alone', 'without parents', 'don\'t tell',
    'mature', 'adult only', 'advanced', 'complicated'
  ];

  private conversationSessions: Map<string, VoiceInteractionContext> = new Map();

  /**
   * Generate voice integration actions for seamless recommendation delivery
   */
  async integrateWithVoice(recommendation: Recommendation, userId: string): Promise<IntegrationAction[]> {
    try {
      // Get user's personality for voice adaptation
      const personality = personalityManager.getActivePersonality(userId);
      if (!personality) {
        return this.createFallbackVoiceActions(recommendation);
      }

      // Generate natural language explanation
      const naturalExplanation = await this.generateNaturalLanguageExplanation(
        recommendation, 
        personality
      );

      // Create voice-adapted version of recommendation
      const voiceContext = await this.getCurrentVoiceContext(userId);
      const adaptedRecommendation = await this.adaptToVoiceContext(
        recommendation, 
        voiceContext
      );

      // Validate child safety for voice content
      const voiceContent = `${adaptedRecommendation.spokenTitle} ${adaptedRecommendation.spokenDescription} ${naturalExplanation}`;
      const isSafe = await this.validateChildSafeVoiceContent(voiceContent, userId);
      
      if (!isSafe) {
        return this.createSafeVoiceActions(recommendation);
      }

      // Generate voice characteristics based on personality
      const voiceCharacteristics = this.generateVoiceCharacteristics(personality, recommendation);

      // Create integration actions for voice system
      const integrationActions: IntegrationAction[] = [
        {
          system: 'voice',
          action: 'setVoiceCharacteristics',
          parameters: {
            characteristics: voiceCharacteristics,
            userId,
            sessionId: voiceContext.sessionId
          }
        },
        {
          system: 'voice',
          action: 'speakRecommendation',
          parameters: {
            title: adaptedRecommendation.spokenTitle,
            description: adaptedRecommendation.spokenDescription,
            explanation: naturalExplanation,
            voicePrompts: adaptedRecommendation.voicePrompts,
            pausePoints: adaptedRecommendation.pausePoints,
            speechRate: adaptedRecommendation.speechRate,
            estimatedDuration: adaptedRecommendation.audioLength
          }
        },
        {
          system: 'voice',
          action: 'enableVoiceFeedback',
          parameters: {
            recommendationId: recommendation.id,
            userId,
            feedbackPrompts: this.generateVoiceFeedbackPrompts(personality),
            timeoutSeconds: 30,
            fallbackAction: 'continue'
          }
        },
        {
          system: 'voice',
          action: 'setFollowUpPrompts',
          parameters: {
            prompts: this.generateFollowUpPrompts(recommendation, personality),
            maxWaitTime: 15000, // 15 seconds
            repeatPrompt: true
          }
        }
      ];

      // Add confirmation action for important recommendations
      if (this.requiresVoiceConfirmation(recommendation)) {
        integrationActions.push({
          system: 'voice',
          action: 'requestConfirmation',
          parameters: {
            confirmationText: this.generateConfirmationPrompt(recommendation, personality),
            expectedResponses: ['yes', 'no', 'maybe', 'later'],
            timeout: 20000, // 20 seconds
            fallbackResponse: 'I\'ll save this suggestion for later.'
          }
        });
      }

      return integrationActions;

    } catch (error) {
      console.error('Error integrating recommendation with voice:', error);
      return this.createFallbackVoiceActions(recommendation);
    }
  }

  /**
   * Generate natural language explanation for voice delivery
   */
  async generateNaturalLanguageExplanation(
    recommendation: Recommendation, 
    personality: PersonalityTraits
  ): Promise<string> {
    try {
      let explanation = recommendation.reasoning.join('. ');

      // Adapt explanation style based on personality
      explanation = this.adaptExplanationToPersonality(explanation, personality);

      // Ensure child-safe language
      explanation = await this.ensureChildSafeLanguage(explanation);

      // Optimize for voice delivery
      explanation = this.optimizeForVoiceDelivery(explanation);

      // Limit length for voice delivery
      if (explanation.length > this.MAX_SPOKEN_LENGTH) {
        explanation = this.truncateForVoice(explanation);
      }

      return explanation;

    } catch (error) {
      console.error('Error generating natural language explanation:', error);
      return 'I think this would be a good suggestion for you.';
    }
  }

  /**
   * Process voice-based recommendation requests
   */
  async processVoiceRecommendationRequest(
    userId: string, 
    voiceInput: string, 
    context: UserContext
  ): Promise<VoiceRecommendationResponse> {
    try {
      // Analyze voice input to understand request
      const requestAnalysis = await this.analyzeVoiceRequest(voiceInput, userId);
      
      // Get user personality for response adaptation
      const personality = personalityManager.getActivePersonality(userId) || this.getDefaultPersonality();

      // Generate appropriate recommendations based on voice request
      const recommendations = await this.generateRecommendationsFromVoiceRequest(
        requestAnalysis, 
        userId, 
        context
      );

      // Create spoken response
      const spokenResponse = await this.generateSpokenResponse(
        requestAnalysis, 
        recommendations, 
        personality
      );

      // Generate voice characteristics
      const voiceCharacteristics = this.generateVoiceCharacteristics(personality, recommendations[0]);

      // Create follow-up prompts
      const followUpPrompts = this.generateFollowUpPrompts(recommendations[0], personality);

      // Generate unique interaction ID
      const interactionId = this.generateInteractionId(userId);

      return {
        spokenResponse,
        recommendations,
        voiceCharacteristics,
        followUpPrompts,
        interactionId,
        requiresConfirmation: this.requiresVoiceConfirmation(recommendations[0])
      };

    } catch (error) {
      console.error('Error processing voice recommendation request:', error);
      return this.createFallbackVoiceResponse(userId);
    }
  }

  /**
   * Collect and analyze voice feedback for recommendations
   */
  async collectVoiceFeedback(
    recommendationId: string, 
    userId: string, 
    voiceInput: string
  ): Promise<UserFeedback> {
    try {
      // Analyze voice feedback
      const feedbackAnalysis = await this.analyzeVoiceFeedback(voiceInput);

      // Convert to structured feedback
      const feedback: UserFeedback = {
        recommendationId,
        userId,
        rating: this.convertSentimentToRating(feedbackAnalysis.sentiment),
        accepted: feedbackAnalysis.sentiment === 'positive',
        completed: false, // Will be updated later
        feedback: voiceInput,
        timestamp: new Date(),
        context: await this.getCurrentUserContext(userId)
      };

      // Store feedback for learning
      await this.storeFeedbackForLearning(feedback, feedbackAnalysis);

      return feedback;

    } catch (error) {
      console.error('Error collecting voice feedback:', error);
      // Return neutral feedback on error
      return {
        recommendationId,
        userId,
        rating: 3,
        accepted: false,
        feedback: voiceInput,
        timestamp: new Date(),
        context: await this.getCurrentUserContext(userId)
      };
    }
  }

  /**
   * Adapt recommendation for voice context
   */
  async adaptToVoiceContext(
    recommendation: Recommendation, 
    voiceContext: VoiceInteractionContext
  ): Promise<VoiceAdaptedRecommendation> {
    try {
      // Adapt title for voice delivery
      const spokenTitle = this.adaptTitleForVoice(recommendation.title, voiceContext);

      // Adapt description for voice delivery
      const spokenDescription = this.adaptDescriptionForVoice(
        recommendation.description, 
        voiceContext
      );

      // Generate spoken explanation
      const spokenExplanation = await this.generateSpokenExplanation(
        recommendation, 
        voiceContext
      );

      // Generate voice prompts
      const voicePrompts = this.generateVoicePrompts(recommendation, voiceContext);

      // Calculate speech parameters
      const speechRate = this.calculateOptimalSpeechRate(voiceContext);
      const pausePoints = this.calculatePausePoints(spokenDescription + ' ' + spokenExplanation);
      const audioLength = this.estimateAudioLength(
        spokenTitle + ' ' + spokenDescription + ' ' + spokenExplanation,
        speechRate
      );

      return {
        ...recommendation,
        spokenTitle,
        spokenDescription,
        spokenExplanation,
        voicePrompts,
        audioLength,
        speechRate,
        pausePoints
      };

    } catch (error) {
      console.error('Error adapting recommendation to voice context:', error);
      return this.createFallbackVoiceAdaptation(recommendation);
    }
  }

  /**
   * Validate child-safe voice content
   */
  async validateChildSafeVoiceContent(content: string, userId: string): Promise<boolean> {
    try {
      const lowerContent = content.toLowerCase();

      // Check for restricted content
      for (const restricted of this.RESTRICTED_VOICE_CONTENT) {
        if (lowerContent.includes(restricted)) {
          return false;
        }
      }

      // Ensure appropriate vocabulary for children
      const isChild = await this.isChildUser(userId);
      if (isChild) {
        // Check for presence of child-appropriate vocabulary
        const hasChildSafeWords = this.CHILD_SAFE_VOCABULARY.some(word => 
          lowerContent.includes(word)
        );
        
        // Require child-safe vocabulary for child users
        if (!hasChildSafeWords && content.length > 50) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Error validating child-safe voice content:', error);
      return false; // Fail safe
    }
  }

  // Private helper methods

  private async getCurrentVoiceContext(userId: string): Promise<VoiceInteractionContext> {
    let context = this.conversationSessions.get(userId);
    
    if (!context) {
      context = {
        userId,
        sessionId: this.generateSessionId(userId),
        conversationHistory: [],
        currentEmotion: 'neutral',
        backgroundNoise: 0.3,
        privacyLevel: 'private',
        timeConstraints: {
          hasTimeLimit: false,
          urgency: 'medium'
        },
        deviceContext: {
          deviceType: 'smart_speaker',
          audioQuality: 'high',
          isHandsFree: true
        }
      };
      
      this.conversationSessions.set(userId, context);
    }
    
    return context;
  }

  private createFallbackVoiceActions(recommendation: Recommendation): IntegrationAction[] {
    return [
      {
        system: 'voice',
        action: 'speakRecommendation',
        parameters: {
          title: recommendation.title,
          description: recommendation.description,
          explanation: 'I think this would be helpful for you.',
          speechRate: 1.0,
          estimatedDuration: 10
        }
      }
    ];
  }

  private createSafeVoiceActions(recommendation: Recommendation): IntegrationAction[] {
    return [
      {
        system: 'voice',
        action: 'speakSafeRecommendation',
        parameters: {
          title: 'I have a suggestion',
          description: 'Let me share something that might be fun and helpful.',
          explanation: 'This has been checked to make sure it\'s appropriate.',
          childSafeMode: true,
          speechRate: 0.9,
          estimatedDuration: 8
        }
      }
    ];
  }

  private generateVoiceCharacteristics(
    personality: PersonalityTraits, 
    recommendation?: Recommendation
  ): VoiceCharacteristics {
    return {
      pitch: this.calculateVoicePitch(personality),
      speed: this.calculateVoiceSpeed(personality),
      accent: 'neutral' as any, // Use neutral accent by default
      emotionalTone: this.determineEmotionalTone(personality, recommendation),
      volume: 0.8 // Standard volume
    };
  }

  private calculateVoicePitch(personality: PersonalityTraits): number {
    // Higher enthusiasm and friendliness = slightly higher pitch
    const pitchFactor = (personality.enthusiasm + personality.friendliness) / 20;
    return Math.max(-1.0, Math.min(1.0, (pitchFactor - 0.5) * 0.4));
  }

  private calculateVoiceSpeed(personality: PersonalityTraits): number {
    let baseSpeed = 1.0;

    // High enthusiasm = faster speech
    if (personality.enthusiasm >= 8) {
      baseSpeed = 1.15;
    }

    // High patience = slower, more deliberate speech
    if (personality.patience >= 8) {
      baseSpeed = 0.9;
    }

    return Math.max(0.7, Math.min(1.3, baseSpeed));
  }

  private determineEmotionalTone(
    personality: PersonalityTraits, 
    recommendation?: Recommendation
  ): any {
    if (personality.enthusiasm >= 8) {
      return 'energetic';
    } else if (personality.friendliness >= 8) {
      return 'cheerful';
    } else if (personality.supportiveness >= 8) {
      return 'gentle';
    }
    return 'calm';
  }

  private adaptExplanationToPersonality(explanation: string, personality: PersonalityTraits): string {
    let adapted = explanation;

    // High friendliness - add warm language
    if (personality.friendliness >= 7) {
      adapted = `I'd love to suggest this because ${adapted.toLowerCase()}`;
    }

    // High enthusiasm - add excitement
    if (personality.enthusiasm >= 8) {
      adapted = adapted.replace(/\./g, '!');
      adapted += ' This sounds really exciting!';
    }

    // High supportiveness - add encouraging language
    if (personality.supportiveness >= 7) {
      adapted += ' I believe this would be perfect for you.';
    }

    // Low formality - make it casual
    if (personality.formality <= 4) {
      adapted = adapted.replace(/because/g, 'cause');
      adapted = adapted.replace(/you would/g, "you'd");
    }

    return adapted;
  }

  private async ensureChildSafeLanguage(explanation: string): Promise<string> {
    // Replace potentially inappropriate words with child-friendly alternatives
    let safe = explanation;
    
    // Simple word replacements for child safety
    safe = safe.replace(/difficult/g, 'challenging');
    safe = safe.replace(/problem/g, 'puzzle');
    safe = safe.replace(/failure/g, 'learning opportunity');
    safe = safe.replace(/mistake/g, 'chance to improve');
    
    return safe;
  }

  private optimizeForVoiceDelivery(explanation: string): string {
    // Add natural pauses and emphasis for voice delivery
    let optimized = explanation;
    
    // Add pauses after important phrases
    optimized = optimized.replace(/\. /g, '. <pause> ');
    optimized = optimized.replace(/because/g, '<pause> because');
    optimized = optimized.replace(/however/g, '<pause> however');
    
    return optimized;
  }

  private truncateForVoice(explanation: string): string {
    if (explanation.length <= this.MAX_SPOKEN_LENGTH) {
      return explanation;
    }

    // Find the last complete sentence within the limit
    const truncated = explanation.substring(0, this.MAX_SPOKEN_LENGTH);
    const lastPeriod = truncated.lastIndexOf('.');
    
    if (lastPeriod > this.MAX_SPOKEN_LENGTH * 0.7) {
      return truncated.substring(0, lastPeriod + 1);
    }
    
    return truncated.substring(0, this.MAX_SPOKEN_LENGTH - 3) + '...';
  }

  private async analyzeVoiceRequest(voiceInput: string, userId: string): Promise<any> {
    // Simple intent analysis - in real implementation would use NLP
    const lowerInput = voiceInput.toLowerCase();
    
    let intent = 'general';
    let confidence = 0.5;
    
    if (lowerInput.includes('activity') || lowerInput.includes('do')) {
      intent = 'activity_request';
      confidence = 0.8;
    } else if (lowerInput.includes('schedule') || lowerInput.includes('time')) {
      intent = 'schedule_request';
      confidence = 0.8;
    } else if (lowerInput.includes('learn') || lowerInput.includes('study')) {
      intent = 'educational_request';
      confidence = 0.8;
    }
    
    return {
      intent,
      confidence,
      originalInput: voiceInput,
      extractedEntities: [],
      sentiment: 'neutral'
    };
  }

  private async generateRecommendationsFromVoiceRequest(
    analysis: any, 
    userId: string, 
    context: UserContext
  ): Promise<Recommendation[]> {
    // Placeholder - would integrate with recommendation controller
    return [{
      id: `voice-rec-${Date.now()}`,
      type: RecommendationType.ACTIVITY,
      title: 'Voice-requested activity',
      description: 'An activity based on your voice request',
      confidence: analysis.confidence,
      reasoning: ['Generated from voice request'],
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      metadata: {
        generatedAt: new Date(),
        userId,
        contextId: context.userId,
        engineVersion: 'voice-1.0',
        safetyValidated: true,
        privacyCompliant: true
      }
    }];
  }

  private async generateSpokenResponse(
    analysis: any, 
    recommendations: Recommendation[], 
    personality: PersonalityTraits
  ): Promise<string> {
    if (recommendations.length === 0) {
      return this.generateNoRecommendationsResponse(personality);
    }

    const rec = recommendations[0];
    let response = '';

    // Greeting based on personality
    if (personality.friendliness >= 7) {
      response = 'I\'d love to help! ';
    } else if (personality.formality >= 7) {
      response = 'Certainly, I can assist with that. ';
    } else {
      response = 'Sure! ';
    }

    // Add recommendation
    response += `I suggest ${rec.title.toLowerCase()}. ${rec.description}`;

    // Add enthusiasm if appropriate
    if (personality.enthusiasm >= 7) {
      response += ' This sounds really great!';
    }

    return response;
  }

  private generateNoRecommendationsResponse(personality: PersonalityTraits): string {
    if (personality.supportiveness >= 7) {
      return 'I\'m sorry, I don\'t have any specific suggestions right now, but I\'m here to help if you\'d like to try asking in a different way.';
    } else {
      return 'I don\'t have any recommendations at the moment. Please try again later.';
    }
  }

  private generateFollowUpPrompts(recommendation: Recommendation, personality: PersonalityTraits): string[] {
    const prompts: string[] = [];

    if (personality.supportiveness >= 7) {
      prompts.push('Would you like me to explain more about this?');
      prompts.push('Do you have any questions?');
    }

    if (personality.enthusiasm >= 7) {
      prompts.push('What do you think? Sounds exciting, right?');
    }

    prompts.push('Should I help you get started with this?');
    prompts.push('Would you like to hear other options?');

    return prompts;
  }

  private requiresVoiceConfirmation(recommendation: Recommendation): boolean {
    // Require confirmation for certain types of recommendations
    return recommendation.type === RecommendationType.SCHEDULE || 
           recommendation.confidence < 0.7;
  }

  private generateConfirmationPrompt(recommendation: Recommendation, personality: PersonalityTraits): string {
    if (personality.patience >= 7) {
      return `Would you like me to go ahead with ${recommendation.title.toLowerCase()}? Take your time to think about it.`;
    } else {
      return `Should I proceed with ${recommendation.title.toLowerCase()}?`;
    }
  }

  private generateVoiceFeedbackPrompts(personality: PersonalityTraits): string[] {
    const prompts: string[] = [];

    if (personality.friendliness >= 7) {
      prompts.push('How did that sound to you?');
      prompts.push('I\'d love to hear what you think!');
    } else {
      prompts.push('Please let me know your thoughts.');
      prompts.push('Any feedback?');
    }

    return prompts;
  }

  private createFallbackVoiceResponse(userId: string): VoiceRecommendationResponse {
    return {
      spokenResponse: 'I\'m here to help, but I\'m having trouble understanding your request right now. Could you try asking again?',
      recommendations: [],
      voiceCharacteristics: {
        pitch: 0,
        speed: 1.0,
        accent: 'neutral' as any,
        emotionalTone: 'calm' as any,
        volume: 0.8
      },
      followUpPrompts: ['What would you like help with?'],
      interactionId: this.generateInteractionId(userId),
      requiresConfirmation: false
    };
  }

  private async analyzeVoiceFeedback(voiceInput: string): Promise<VoiceFeedbackAnalysis> {
    const lowerInput = voiceInput.toLowerCase();
    
    // Simple sentiment analysis
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 0.5;
    
    const positiveWords = ['good', 'great', 'love', 'like', 'awesome', 'perfect', 'yes'];
    const negativeWords = ['bad', 'hate', 'dislike', 'terrible', 'awful', 'no', 'wrong'];
    
    const positiveCount = positiveWords.filter(word => lowerInput.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerInput.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = Math.min(0.9, 0.5 + (positiveCount * 0.1));
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = Math.min(0.9, 0.5 + (negativeCount * 0.1));
    }
    
    return {
      sentiment,
      confidence,
      specificFeedback: {
        liked: positiveWords.filter(word => lowerInput.includes(word)),
        disliked: negativeWords.filter(word => lowerInput.includes(word)),
        suggestions: []
      },
      emotionalResponse: sentiment === 'positive' ? 'happy' : sentiment === 'negative' ? 'disappointed' : 'neutral',
      engagementLevel: voiceInput.length > 20 ? 'high' : voiceInput.length > 5 ? 'medium' : 'low'
    };
  }

  private convertSentimentToRating(sentiment: 'positive' | 'negative' | 'neutral'): number {
    switch (sentiment) {
      case 'positive': return 4;
      case 'negative': return 2;
      default: return 3;
    }
  }

  private async storeFeedbackForLearning(feedback: UserFeedback, analysis: VoiceFeedbackAnalysis): Promise<void> {
    // Store feedback for learning system - placeholder implementation
    console.log('Storing voice feedback for learning:', { feedback, analysis });
  }

  private async getCurrentUserContext(userId: string): Promise<UserContext> {
    // Placeholder - would get actual user context
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

  private adaptTitleForVoice(title: string, context: VoiceInteractionContext): string {
    // Make title more conversational for voice
    let adapted = title;
    
    // Remove formal language for casual contexts
    if (context.privacyLevel === 'private') {
      adapted = adapted.replace(/Recommendation:/g, '');
      adapted = adapted.replace(/Suggestion:/g, '');
    }
    
    return adapted.trim();
  }

  private adaptDescriptionForVoice(description: string, context: VoiceInteractionContext): string {
    let adapted = description;
    
    // Shorten for time-constrained contexts
    if (context.timeConstraints.hasTimeLimit && context.timeConstraints.maxDurationSeconds && context.timeConstraints.maxDurationSeconds < 30) {
      adapted = this.truncateForVoice(adapted);
    }
    
    // Simplify for noisy environments
    if (context.backgroundNoise > 0.7) {
      adapted = this.simplifyForNoisyEnvironment(adapted);
    }
    
    return adapted;
  }

  private async generateSpokenExplanation(
    recommendation: Recommendation, 
    context: VoiceInteractionContext
  ): Promise<string> {
    let explanation = recommendation.reasoning.join('. ');
    
    // Adapt for device context
    if (context.deviceContext.deviceType === 'wearable') {
      explanation = this.truncateForVoice(explanation);
    }
    
    return explanation;
  }

  private generateVoicePrompts(recommendation: Recommendation, context: VoiceInteractionContext): VoicePrompt[] {
    const prompts: VoicePrompt[] = [];
    
    // Confirmation prompt
    prompts.push({
      type: 'confirmation',
      text: 'Would you like to try this?',
      expectedResponses: ['yes', 'no', 'maybe', 'later'],
      timeout: 15,
      fallbackAction: 'save_for_later'
    });
    
    // Feedback prompt
    prompts.push({
      type: 'feedback',
      text: 'What do you think about this suggestion?',
      expectedResponses: ['good', 'bad', 'okay', 'great', 'not interested'],
      timeout: 20,
      fallbackAction: 'continue'
    });
    
    return prompts;
  }

  private calculateOptimalSpeechRate(context: VoiceInteractionContext): number {
    let rate = 1.0;
    
    // Slower for noisy environments
    if (context.backgroundNoise > 0.6) {
      rate *= 0.9;
    }
    
    // Faster for urgent contexts
    if (context.timeConstraints.urgency === 'high') {
      rate *= 1.1;
    }
    
    // Adjust for device type
    if (context.deviceContext.deviceType === 'wearable') {
      rate *= 0.95; // Slightly slower for small devices
    }
    
    return Math.max(0.7, Math.min(1.3, rate));
  }

  private calculatePausePoints(text: string): number[] {
    const points: number[] = [];
    
    // Add pause points at natural breaks
    const sentences = text.split('. ');
    let position = 0;
    
    for (let i = 0; i < sentences.length - 1; i++) {
      position += sentences[i].length + 2; // +2 for '. '
      points.push(position);
    }
    
    return points;
  }

  private estimateAudioLength(text: string, speechRate: number): number {
    // Rough estimate: average 150 words per minute at normal rate
    const wordsPerMinute = 150 * speechRate;
    const wordCount = text.split(' ').length;
    return Math.ceil((wordCount / wordsPerMinute) * 60); // Convert to seconds
  }

  private createFallbackVoiceAdaptation(recommendation: Recommendation): VoiceAdaptedRecommendation {
    return {
      ...recommendation,
      spokenTitle: recommendation.title,
      spokenDescription: recommendation.description,
      spokenExplanation: recommendation.reasoning.join('. '),
      voicePrompts: [],
      audioLength: 15,
      speechRate: 1.0,
      pausePoints: []
    };
  }

  private simplifyForNoisyEnvironment(text: string): string {
    // Simplify language for better clarity in noisy environments
    let simplified = text;
    
    simplified = simplified.replace(/however/g, 'but');
    simplified = simplified.replace(/therefore/g, 'so');
    simplified = simplified.replace(/additionally/g, 'also');
    
    return simplified;
  }

  private generateSessionId(userId: string): string {
    return `voice-session-${userId}-${Date.now()}`;
  }

  private generateInteractionId(userId: string): string {
    return `voice-interaction-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultPersonality(): PersonalityTraits {
    return {
      friendliness: 7,
      formality: 4,
      humor: 5,
      enthusiasm: 6,
      patience: 7,
      supportiveness: 8
    };
  }

  private async isChildUser(userId: string): Promise<boolean> {
    // Placeholder - would integrate with user profile system
    return true; // Assume child-safe by default
  }
}

// Export singleton instance
export const voiceIntegration = new VoiceIntegration();