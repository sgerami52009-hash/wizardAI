/**
 * User Preference Engine
 * 
 * Manages user preferences, interest tracking, and preference learning
 * from user interactions while maintaining privacy-preserving operations.
 * 
 * Requirements: 1.1, 1.4, 6.1, 6.2, 6.3, 6.4
 */

import {
  UserPreferences,
  Interest,
  UserInteraction,
  UserFeedback,
  ActivityPreferences,
  SchedulePreferences,
  LearningPreferences,
  PrivacyPreferences,
  NotificationPreferences,
  UserContext,
  RecommendationConstraints,
  ModelInsights,
  BehaviorPattern,
  ContextualFactor,
  RecommendationSummary
} from '../types';

import {
  InterestCategory,
  ActivityCategory,
  DifficultyLevel,
  Subject,
  PrivacyLevel,
  InteractionType,
  RecommendationType
} from '../enums';

import { IPrivacyManager } from '../interfaces';

/**
 * Interface for user preference storage operations
 */
export interface IUserPreferenceStorage {
  saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void>;
  loadUserPreferences(userId: string): Promise<UserPreferences | null>;
  updateInterests(userId: string, interests: Interest[]): Promise<void>;
  getInterestHistory(userId: string, timeRange: { start: Date; end: Date }): Promise<Interest[]>;
  deleteUserPreferences(userId: string): Promise<void>;
  encryptPreferences(preferences: UserPreferences): Promise<string>;
  decryptPreferences(encryptedData: string): Promise<UserPreferences>;
}

/**
 * User Preference Engine Implementation
 * 
 * Handles all aspects of user preference management including:
 * - Interest tracking and strength calculation
 * - Preference learning from interactions
 * - Privacy-preserving preference storage
 * - Behavioral pattern analysis
 */
export class UserPreferenceEngine {
  private storage: IUserPreferenceStorage;
  private privacyManager: IPrivacyManager;
  private interestDecayRate: number = 0.95; // Daily decay rate for interest strength
  private learningRate: number = 0.1; // Rate at which preferences adapt to feedback
  private minInterestStrength: number = 0.1; // Minimum strength to keep an interest
  private maxInterests: number = 50; // Maximum number of interests to track per user

  constructor(storage: IUserPreferenceStorage, privacyManager: IPrivacyManager) {
    this.storage = storage;
    this.privacyManager = privacyManager;
  }

  /**
   * Initialize user preferences with default values
   * Requirements: 1.1, 6.1
   */
  async initializeUserPreferences(userId: string): Promise<UserPreferences> {
    const defaultPreferences: UserPreferences = {
      userId,
      interests: [],
      activityPreferences: this.getDefaultActivityPreferences(),
      schedulePreferences: this.getDefaultSchedulePreferences(),
      learningPreferences: this.getDefaultLearningPreferences(),
      privacyPreferences: this.getDefaultPrivacyPreferences(),
      notificationPreferences: this.getDefaultNotificationPreferences(),
      lastUpdated: new Date()
    };

    // Encrypt and save preferences
    await this.storage.saveUserPreferences(userId, defaultPreferences);
    return defaultPreferences;
  }

  /**
   * Get user preferences with privacy enforcement
   * Requirements: 6.1, 6.2
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Check privacy permissions
    const privacyDecision = await this.privacyManager.enforcePrivacyPreferences(
      userId,
      { type: 'read', purpose: 'preference_retrieval' }
    );

    if (!privacyDecision.allowed) {
      throw new Error('Access to user preferences denied by privacy settings');
    }

    let preferences = await this.storage.loadUserPreferences(userId);
    
    if (!preferences) {
      preferences = await this.initializeUserPreferences(userId);
    }

    // Apply privacy restrictions if needed
    if (privacyDecision.anonymizationRequired) {
      return this.anonymizePreferences(preferences, privacyDecision.restrictions);
    }

    return preferences;
  }

  /**
   * Update user preferences with privacy validation
   * Requirements: 1.4, 6.2, 6.3
   */
  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    // Validate privacy compliance
    const privacyDecision = await this.privacyManager.enforcePrivacyPreferences(
      userId,
      { type: 'update', purpose: 'preference_update' }
    );

    if (!privacyDecision.allowed) {
      throw new Error('Preference update denied by privacy settings');
    }

    const currentPreferences = await this.getUserPreferences(userId);
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...updates,
      lastUpdated: new Date()
    };

    // Validate and sanitize interests
    if (updates.interests) {
      updatedPreferences.interests = this.validateAndSanitizeInterests(updates.interests);
    }

    await this.storage.saveUserPreferences(userId, updatedPreferences);
  }

  /**
   * Learn preferences from user interactions
   * Requirements: 1.4, 6.3
   */
  async learnFromInteractions(userId: string, interactions: UserInteraction[]): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    let updatedInterests = [...preferences.interests];

    for (const interaction of interactions) {
      // Extract interests from interaction
      const extractedInterests = this.extractInterestsFromInteraction(interaction);
      
      // Update interest strengths based on interaction type and outcome
      for (const interest of extractedInterests) {
        updatedInterests = this.updateInterestStrength(
          updatedInterests,
          interest,
          interaction.interactionType,
          interaction.satisfaction
        );
      }

      // Update activity preferences based on feedback
      if (interaction.feedback) {
        await this.updateActivityPreferencesFromFeedback(userId, interaction.feedback);
      }
    }

    // Apply interest decay for aging
    updatedInterests = this.applyInterestDecay(updatedInterests);

    // Limit number of interests and remove weak ones
    updatedInterests = this.pruneInterests(updatedInterests);

    await this.updateUserPreferences(userId, { interests: updatedInterests });
  }

  /**
   * Calculate interest strength based on various factors
   * Requirements: 1.1, 1.4
   */
  private calculateInterestStrength(
    baseStrength: number,
    interactionType: InteractionType,
    satisfaction: number,
    recency: Date
  ): number {
    let strength = baseStrength;

    // Adjust based on interaction type
    const interactionMultipliers = {
      [InteractionType.ACCEPT]: 1.2,
      [InteractionType.COMPLETE]: 1.5,
      [InteractionType.SHARE]: 1.3,
      [InteractionType.SAVE]: 1.1,
      [InteractionType.REJECT]: 0.7,
      [InteractionType.ABANDON]: 0.8,
      [InteractionType.VIEW]: 1.0,
      [InteractionType.MODIFY]: 1.1
    };

    strength *= interactionMultipliers[interactionType] || 1.0;

    // Adjust based on satisfaction (0-1 scale)
    strength *= (0.5 + satisfaction * 0.5);

    // Apply recency boost (more recent = higher strength)
    const daysSinceInteraction = (Date.now() - recency.getTime()) / (1000 * 60 * 60 * 24);
    const recencyMultiplier = Math.exp(-daysSinceInteraction / 30); // 30-day half-life
    strength *= (0.8 + 0.2 * recencyMultiplier);

    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Extract interests from user interaction
   * Requirements: 1.1, 1.4
   */
  private extractInterestsFromInteraction(interaction: UserInteraction): Interest[] {
    const interests: Interest[] = [];

    // Extract from recommendation metadata if available
    if (interaction.context?.preferences?.preferredActivities) {
      for (const activity of interaction.context.preferences.preferredActivities) {
        const interestCategory = this.mapActivityToInterest(activity);
        if (interestCategory) {
          interests.push({
            category: interestCategory,
            subcategory: activity,
            strength: this.calculateInterestStrength(
              0.5, // Base strength for new interests
              interaction.interactionType,
              interaction.satisfaction,
              interaction.timestamp
            ),
            recency: interaction.timestamp,
            source: 'inferred'
          });
        }
      }
    }

    // Extract from context (location, time, activity)
    if (interaction.context?.activity?.activityType) {
      const interestCategory = this.mapActivityToInterest(interaction.context.activity.activityType);
      if (interestCategory) {
        interests.push({
          category: interestCategory,
          subcategory: interaction.context.activity.currentActivity || 'general',
          strength: this.calculateInterestStrength(
            0.3, // Lower base strength for contextual interests
            interaction.interactionType,
            interaction.satisfaction,
            interaction.timestamp
          ),
          recency: interaction.timestamp,
          source: 'inferred'
        });
      }
    }

    return interests;
  }

  /**
   * Update interest strength based on new interaction
   * Requirements: 1.4
   */
  private updateInterestStrength(
    interests: Interest[],
    newInterest: Interest,
    interactionType: InteractionType,
    satisfaction: number
  ): Interest[] {
    const existingIndex = interests.findIndex(
      i => i.category === newInterest.category && i.subcategory === newInterest.subcategory
    );

    if (existingIndex >= 0) {
      // Update existing interest
      const existing = interests[existingIndex];
      const updatedStrength = this.calculateInterestStrength(
        existing.strength,
        interactionType,
        satisfaction,
        newInterest.recency
      );

      interests[existingIndex] = {
        ...existing,
        strength: updatedStrength,
        recency: newInterest.recency
      };
    } else {
      // Add new interest
      interests.push(newInterest);
    }

    return interests;
  }

  /**
   * Apply time-based decay to interest strengths
   * Requirements: 1.4
   */
  private applyInterestDecay(interests: Interest[]): Interest[] {
    const now = new Date();
    
    return interests.map(interest => {
      const daysSinceUpdate = (now.getTime() - interest.recency.getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.pow(this.interestDecayRate, daysSinceUpdate);
      
      return {
        ...interest,
        strength: Math.max(this.minInterestStrength, interest.strength * decayFactor)
      };
    });
  }

  /**
   * Remove weak interests and limit total count
   * Requirements: 1.4, 6.1 (data minimization)
   */
  private pruneInterests(interests: Interest[]): Interest[] {
    // Remove interests below minimum strength
    const strongInterests = interests.filter(i => i.strength >= this.minInterestStrength);

    // Sort by strength and keep top interests
    strongInterests.sort((a, b) => b.strength - a.strength);
    
    return strongInterests.slice(0, this.maxInterests);
  }

  /**
   * Update activity preferences based on user feedback
   * Requirements: 1.4
   */
  private async updateActivityPreferencesFromFeedback(userId: string, feedback: UserFeedback): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    const activityPrefs = { ...preferences.activityPreferences };

    // Adjust preferences based on feedback rating
    if (feedback.rating >= 4) {
      // Positive feedback - strengthen preferences
      // This would be implemented based on the specific recommendation type
      // For now, we'll update based on general patterns
    } else if (feedback.rating <= 2) {
      // Negative feedback - weaken preferences
      // Similar implementation for negative adjustments
    }

    await this.updateUserPreferences(userId, { activityPreferences: activityPrefs });
  }

  /**
   * Get behavioral insights for a user
   * Requirements: 1.4, 7.5
   */
  async getUserInsights(userId: string): Promise<ModelInsights> {
    const preferences = await this.getUserPreferences(userId);
    
    // Get interaction history for analysis
    const interactions = await this.getRecentInteractions(userId, 30); // Last 30 days
    
    return {
      userId,
      topInterests: preferences.interests
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 10),
      behaviorPatterns: this.analyzeBehaviorPatterns(interactions),
      preferenceStrength: this.calculatePreferenceStrengths(preferences),
      contextualFactors: this.analyzeContextualFactors(interactions),
      recommendationHistory: this.summarizeRecommendationHistory(interactions)
    };
  }

  /**
   * Anonymize preferences for privacy compliance
   * Requirements: 6.1, 6.2
   */
  private anonymizePreferences(
    preferences: UserPreferences,
    restrictions: any[]
  ): UserPreferences {
    const anonymized = { ...preferences };
    
    // Remove or anonymize sensitive data based on restrictions
    for (const restriction of restrictions) {
      switch (restriction.type) {
        case 'remove_personal_interests':
          anonymized.interests = anonymized.interests.filter(i => 
            !this.isPersonalInterest(i)
          );
          break;
        case 'generalize_preferences':
          anonymized.interests = this.generalizeInterests(anonymized.interests);
          break;
      }
    }

    return anonymized;
  }

  /**
   * Validate and sanitize interests for safety and privacy
   * Requirements: 6.1, 6.3
   */
  private validateAndSanitizeInterests(interests: Interest[]): Interest[] {
    return interests
      .map(interest => this.sanitizeInterest(interest))
      .filter(interest => this.isValidInterest(interest))
      .slice(0, this.maxInterests);
  }

  /**
   * Map activity category to interest category
   */
  private mapActivityToInterest(activity: ActivityCategory): InterestCategory | null {
    const mapping: Record<ActivityCategory, InterestCategory> = {
      [ActivityCategory.PHYSICAL]: InterestCategory.SPORTS,
      [ActivityCategory.CREATIVE]: InterestCategory.ARTS,
      [ActivityCategory.EDUCATIONAL]: InterestCategory.LEARNING,
      [ActivityCategory.SOCIAL]: InterestCategory.SOCIAL,
      [ActivityCategory.ENTERTAINMENT]: InterestCategory.ENTERTAINMENT,
      [ActivityCategory.OUTDOOR]: InterestCategory.NATURE,
      [ActivityCategory.SKILL_BUILDING]: InterestCategory.LEARNING,
      [ActivityCategory.HEALTH]: InterestCategory.FITNESS,
      [ActivityCategory.CULTURAL]: InterestCategory.ARTS,
      // Add more mappings as needed
      [ActivityCategory.RELAXATION]: InterestCategory.ENTERTAINMENT,
      [ActivityCategory.HOUSEHOLD]: InterestCategory.LEARNING,
      [ActivityCategory.INDOOR]: InterestCategory.ENTERTAINMENT,
      [ActivityCategory.FAMILY]: InterestCategory.SOCIAL,
      [ActivityCategory.SOLO]: InterestCategory.ENTERTAINMENT,
      [ActivityCategory.VOLUNTEER]: InterestCategory.SOCIAL
    };

    return mapping[activity] || null;
  }

  // Helper methods for default preferences
  private getDefaultActivityPreferences(): ActivityPreferences {
    return {
      preferredCategories: [ActivityCategory.FAMILY, ActivityCategory.EDUCATIONAL],
      preferredDifficulty: DifficultyLevel.INTERMEDIATE,
      preferredDuration: { start: new Date(), end: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour
      indoorOutdoorPreference: 'both',
      socialPreference: 'both',
      physicalActivityLevel: 'medium'
    };
  }

  private getDefaultSchedulePreferences(): SchedulePreferences {
    return {
      preferredWakeTime: '07:00',
      preferredBedTime: '22:00',
      workingHours: [],
      breakPreferences: [],
      flexibilityLevel: 'moderate'
    };
  }

  private getDefaultLearningPreferences(): LearningPreferences {
    return {
      learningStyle: 'mixed',
      preferredSubjects: [Subject.SCIENCE, Subject.MATHEMATICS],
      difficultyPreference: 'moderate',
      sessionDuration: 30,
      gamificationLevel: 'medium'
    };
  }

  private getDefaultPrivacyPreferences(): PrivacyPreferences {
    return {
      dataSharing: PrivacyLevel.FAMILY,
      locationTracking: false,
      behaviorAnalysis: true,
      familyDataSharing: true,
      externalIntegrations: false,
      dataRetentionDays: 90
    };
  }

  private getDefaultNotificationPreferences(): NotificationPreferences {
    return {
      enabled: true,
      quietHours: [{ start: new Date(), end: new Date() }],
      urgencyThreshold: 'medium',
      channels: ['voice', 'visual']
    };
  }

  // Placeholder methods for complex analysis (to be implemented)
  private async getRecentInteractions(userId: string, days: number): Promise<UserInteraction[]> {
    // This would integrate with the interaction storage system
    return [];
  }

  private analyzeBehaviorPatterns(interactions: UserInteraction[]): BehaviorPattern[] {
    // Analyze patterns in user behavior
    return [];
  }

  private calculatePreferenceStrengths(preferences: UserPreferences): Record<string, number> {
    // Calculate overall preference strengths
    return {};
  }

  private analyzeContextualFactors(interactions: UserInteraction[]): ContextualFactor[] {
    // Analyze contextual influences on preferences
    return [];
  }

  private summarizeRecommendationHistory(interactions: UserInteraction[]): RecommendationSummary[] {
    // Summarize recommendation performance by type
    return [];
  }

  private isPersonalInterest(interest: Interest): boolean {
    // Determine if an interest is considered personal/sensitive
    return false;
  }

  private generalizeInterests(interests: Interest[]): Interest[] {
    // Generalize interests for privacy
    return interests;
  }

  private isValidInterest(interest: Interest): boolean {
    // Validate interest for safety and appropriateness
    return interest.strength >= 0 && interest.strength <= 1 && 
           !!interest.category && !!interest.subcategory;
  }

  private sanitizeInterest(interest: Interest): Interest {
    // Sanitize interest data
    return {
      ...interest,
      strength: Math.max(0, Math.min(1, interest.strength))
    };
  }
}