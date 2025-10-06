/**
 * Privacy-Preserving Learning Mechanisms
 * 
 * Implements differential privacy, federated learning, and local model training
 * to ensure user privacy while maintaining recommendation quality.
 */

import {
  TrainingData,
  UserInteraction,
  UserFeedback,
  ModelMetrics,
  PrivacySettings,
  UserData,
  AnonymizedData
} from '../types';
import { PrivacyLevel } from '../enums';

/**
 * Differential Privacy parameters
 */
interface DifferentialPrivacyParams {
  epsilon: number; // Privacy budget
  delta: number; // Failure probability
  sensitivity: number; // Maximum change in output
  noiseScale: number; // Scale of noise to add
}

/**
 * Federated Learning session
 */
interface FederatedLearningSession {
  sessionId: string;
  participants: string[];
  globalModel: any;
  localModels: Map<string, any>;
  aggregationRound: number;
  privacyBudget: number;
  convergenceThreshold: number;
}

/**
 * Local model update
 */
interface LocalModelUpdate {
  userId: string;
  modelWeights: number[];
  gradients: number[];
  privacyNoise: number[];
  updateSize: number;
  timestamp: Date;
}

/**
 * Secure aggregation result
 */
interface SecureAggregationResult {
  aggregatedWeights: number[];
  participantCount: number;
  privacyLoss: number;
  convergenceScore: number;
  qualityMetrics: ModelMetrics;
}

export class PrivacyPreservingLearning {
  private privacyBudgets: Map<string, number> = new Map();
  private localModels: Map<string, any> = new Map();
  private federatedSessions: Map<string, FederatedLearningSession> = new Map();
  private encryptionKey: string = this.generateEncryptionKey();
  private maxPrivacyBudget: number = 10.0; // Total privacy budget per user
  private minPrivacyBudget: number = 0.1; // Minimum budget to continue learning

  /**
   * Initialize privacy-preserving learning for a user
   */
  async initializeUserPrivacyLearning(userId: string, privacySettings: PrivacySettings): Promise<void> {
    try {
      // Set initial privacy budget
      this.privacyBudgets.set(userId, this.maxPrivacyBudget);

      // Initialize local model
      const localModel = await this.createLocalModel(userId, privacySettings);
      this.localModels.set(userId, localModel);

      // Apply privacy settings
      await this.applyPrivacySettings(userId, privacySettings);

    } catch (error) {
      console.error(`Failed to initialize privacy learning for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Train local model with differential privacy
   */
  async trainLocalModelWithPrivacy(
    userId: string, 
    trainingData: TrainingData,
    privacyParams: DifferentialPrivacyParams
  ): Promise<ModelMetrics> {
    try {
      // Check privacy budget
      const remainingBudget = this.privacyBudgets.get(userId) || 0;
      if (remainingBudget < privacyParams.epsilon) {
        throw new Error(`Insufficient privacy budget for user ${userId}`);
      }

      // Apply differential privacy to training data
      const privatizedData = await this.applyDifferentialPrivacy(trainingData, privacyParams);

      // Train local model
      const localModel = this.localModels.get(userId);
      if (!localModel) {
        throw new Error(`No local model found for user ${userId}`);
      }

      const metrics = await this.trainLocalModel(userId, localModel, privatizedData);

      // Update privacy budget
      this.privacyBudgets.set(userId, remainingBudget - privacyParams.epsilon);

      return metrics;

    } catch (error) {
      console.error(`Failed to train local model for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Apply differential privacy to training data
   */
  async applyDifferentialPrivacy(
    trainingData: TrainingData,
    params: DifferentialPrivacyParams
  ): Promise<TrainingData> {
    try {
      const privatizedInteractions = trainingData.interactions.map(interaction => ({
        ...interaction,
        satisfaction: this.addLaplaceNoise(interaction.satisfaction, params.noiseScale),
        // Anonymize context
        context: this.anonymizeContext(interaction.context),
        // Add noise to timestamp (temporal privacy)
        timestamp: this.addTemporalNoise(interaction.timestamp, params.noiseScale * 3600000) // 1 hour scale
      }));

      // Apply k-anonymity to context features
      const anonymizedFeatures = await this.applyKAnonymity(trainingData.contextFeatures, 5);

      return {
        ...trainingData,
        interactions: privatizedInteractions,
        contextFeatures: anonymizedFeatures,
        privacyLevel: PrivacyLevel.PRIVATE
      };

    } catch (error) {
      console.error('Failed to apply differential privacy:', error);
      throw error;
    }
  }

  /**
   * Coordinate federated learning across family members
   */
  async coordinateFederatedLearning(
    familyId: string,
    participants: string[],
    privacySettings: PrivacySettings
  ): Promise<SecureAggregationResult> {
    try {
      // Create federated learning session
      const session = await this.createFederatedSession(familyId, participants);

      // Collect local model updates with privacy
      const localUpdates: LocalModelUpdate[] = [];
      for (const userId of participants) {
        const update = await this.getPrivateLocalUpdate(userId, session);
        if (update) {
          localUpdates.push(update);
        }
      }

      // Perform secure aggregation
      const aggregationResult = await this.performSecureAggregation(localUpdates, session);

      // Update global model
      await this.updateGlobalModel(session, aggregationResult);

      // Distribute updated model to participants
      await this.distributeGlobalModel(session, participants);

      return aggregationResult;

    } catch (error) {
      console.error(`Failed to coordinate federated learning for family ${familyId}:`, error);
      throw error;
    }
  }

  /**
   * Anonymize user data for learning
   */
  async anonymizeUserData(userData: UserData, privacyLevel: PrivacyLevel): Promise<AnonymizedData> {
    try {
      const anonymizedId = this.generateAnonymousId(userData.userId);
      let anonymizedData: Record<string, any> = {};
      let retainedFields: string[] = [];

      switch (privacyLevel) {
        case PrivacyLevel.PRIVATE:
          // Only keep essential patterns, remove all identifiers
          anonymizedData = {
            interactionPatterns: this.extractAnonymousPatterns(userData.interactions),
            generalPreferences: this.generalizePreferences(userData.preferences),
            temporalPatterns: this.anonymizeTemporalPatterns(userData.context)
          };
          retainedFields = ['patterns', 'general_preferences', 'temporal'];
          break;

        case PrivacyLevel.FAMILY:
          // Keep more data but anonymize identifiers
          anonymizedData = {
            ...this.anonymizeContext(userData.context),
            preferences: this.partiallyAnonymizePreferences(userData.preferences),
            interactions: userData.interactions.map(i => ({
              type: i.interactionType,
              satisfaction: i.satisfaction,
              timestamp: this.roundTimestamp(i.timestamp, 3600000) // Round to hour
            }))
          };
          retainedFields = ['context', 'preferences', 'interactions'];
          break;

        case PrivacyLevel.PUBLIC:
          // Keep most data, only remove direct identifiers
          anonymizedData = {
            ...userData,
            userId: anonymizedId,
            preferences: {
              ...userData.preferences,
              userId: anonymizedId
            }
          };
          retainedFields = Object.keys(userData);
          break;

        default:
          throw new Error(`Unsupported privacy level: ${privacyLevel}`);
      }

      return {
        anonymizedId,
        data: anonymizedData,
        privacyLevel,
        anonymizationMethod: 'differential_privacy_k_anonymity',
        retainedFields
      };

    } catch (error) {
      console.error('Failed to anonymize user data:', error);
      throw error;
    }
  }

  /**
   * Update local model with privacy constraints
   */
  async updateLocalModelPrivately(
    userId: string,
    feedback: UserFeedback,
    privacyConstraints: PrivacySettings
  ): Promise<void> {
    try {
      const localModel = this.localModels.get(userId);
      if (!localModel) {
        throw new Error(`No local model found for user ${userId}`);
      }

      // Check privacy budget
      const remainingBudget = this.privacyBudgets.get(userId) || 0;
      if (remainingBudget < this.minPrivacyBudget) {
        console.warn(`Privacy budget exhausted for user ${userId}, skipping update`);
        return;
      }

      // Apply privacy-preserving update
      const privateFeedback = await this.privatizeFeedback(feedback, privacyConstraints);
      await this.updateModelWithPrivateFeedback(userId, localModel, privateFeedback);

      // Consume privacy budget
      const budgetUsed = 0.1; // Small budget for feedback updates
      this.privacyBudgets.set(userId, remainingBudget - budgetUsed);

    } catch (error) {
      console.error(`Failed to update local model privately for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get privacy-compliant model insights
   */
  async getPrivacyCompliantInsights(userId: string, privacyLevel: PrivacyLevel): Promise<any> {
    try {
      const localModel = this.localModels.get(userId);
      if (!localModel) {
        return null;
      }

      switch (privacyLevel) {
        case PrivacyLevel.PRIVATE:
          // Only general patterns, no specific data
          return {
            generalPatterns: this.extractGeneralPatterns(localModel),
            aggregateMetrics: this.getAggregateMetrics(localModel),
            privacyLevel: PrivacyLevel.PRIVATE
          };

        case PrivacyLevel.FAMILY:
          // Some specific insights with anonymization
          return {
            ...this.extractGeneralPatterns(localModel),
            anonymizedPreferences: this.anonymizePreferences(localModel.preferences),
            privacyLevel: PrivacyLevel.FAMILY
          };

        case PrivacyLevel.PUBLIC:
          // Most insights available
          return {
            ...localModel,
            userId: this.generateAnonymousId(userId),
            privacyLevel: PrivacyLevel.PUBLIC
          };

        default:
          throw new Error(`Unsupported privacy level: ${privacyLevel}`);
      }

    } catch (error) {
      console.error(`Failed to get privacy-compliant insights for ${userId}:`, error);
      throw error;
    }
  }

  // Private helper methods

  private async createLocalModel(userId: string, privacySettings: PrivacySettings): Promise<any> {
    return {
      userId,
      modelId: this.generateModelId(),
      createdAt: new Date(),
      lastUpdated: new Date(),
      privacySettings,
      weights: this.initializeModelWeights(),
      preferences: {},
      patterns: [],
      privacyBudgetUsed: 0
    };
  }

  private async applyPrivacySettings(userId: string, settings: PrivacySettings): Promise<void> {
    const localModel = this.localModels.get(userId);
    if (localModel) {
      localModel.privacySettings = settings;
      
      // Apply encryption if required
      if (settings.encryptionRequired) {
        localModel.encrypted = true;
        localModel.encryptionKey = this.generateEncryptionKey();
      }

      // Set data retention policy
      localModel.dataRetentionDays = settings.dataRetentionDays;
      localModel.autoDeleteAt = new Date(Date.now() + settings.dataRetentionDays * 24 * 60 * 60 * 1000);
    }
  }

  private addLaplaceNoise(value: number, scale: number): number {
    const u = Math.random() - 0.5;
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
    return Math.max(0, Math.min(1, value + noise)); // Clamp to [0, 1]
  }

  private addTemporalNoise(timestamp: Date, scaleMs: number): Date {
    const noise = this.addLaplaceNoise(0, scaleMs / 1000) * 1000;
    return new Date(timestamp.getTime() + noise);
  }

  private anonymizeContext(context: any): any {
    return {
      timeOfDay: this.generalizeTimeOfDay(context.timestamp),
      dayType: this.generalizeDayType(context.timestamp),
      activityType: context.activity?.activityType || 'unknown',
      socialSetting: context.social?.socialSetting || 'unknown',
      // Remove specific location, weather, etc.
      generalLocation: context.location?.type || 'unknown'
    };
  }

  private async applyKAnonymity(features: any[], k: number): Promise<any[]> {
    // Simplified k-anonymity implementation
    // Group similar features and generalize them
    const groups = new Map<string, any[]>();
    
    features.forEach(feature => {
      const key = this.generateFeatureKey(feature);
      const group = groups.get(key) || [];
      group.push(feature);
      groups.set(key, group);
    });

    const anonymizedFeatures: any[] = [];
    for (const [key, group] of groups.entries()) {
      if (group.length >= k) {
        // Group is k-anonymous, add generalized version
        anonymizedFeatures.push(this.generalizeFeatureGroup(group));
      }
      // Skip groups smaller than k for privacy
    }

    return anonymizedFeatures;
  }

  private async createFederatedSession(familyId: string, participants: string[]): Promise<FederatedLearningSession> {
    const sessionId = this.generateSessionId();
    const session: FederatedLearningSession = {
      sessionId,
      participants,
      globalModel: this.initializeGlobalModel(),
      localModels: new Map(),
      aggregationRound: 0,
      privacyBudget: Math.min(...participants.map(p => this.privacyBudgets.get(p) || 0)),
      convergenceThreshold: 0.01
    };

    this.federatedSessions.set(sessionId, session);
    return session;
  }

  private async getPrivateLocalUpdate(userId: string, session: FederatedLearningSession): Promise<LocalModelUpdate | null> {
    const localModel = this.localModels.get(userId);
    if (!localModel) return null;

    const remainingBudget = this.privacyBudgets.get(userId) || 0;
    if (remainingBudget < 0.5) return null; // Need minimum budget for federated learning

    // Compute gradients with differential privacy
    const gradients = await this.computePrivateGradients(localModel, session.globalModel);
    const privacyNoise = gradients.map(g => this.addLaplaceNoise(0, 0.1));
    const noisyGradients = gradients.map((g, i) => g + privacyNoise[i]);

    return {
      userId,
      modelWeights: localModel.weights,
      gradients: noisyGradients,
      privacyNoise,
      updateSize: gradients.length,
      timestamp: new Date()
    };
  }

  private async performSecureAggregation(
    updates: LocalModelUpdate[],
    session: FederatedLearningSession
  ): Promise<SecureAggregationResult> {
    if (updates.length === 0) {
      throw new Error('No updates available for aggregation');
    }

    // Aggregate gradients with secure multi-party computation simulation
    const aggregatedWeights = this.aggregateWeights(updates);
    const privacyLoss = this.calculatePrivacyLoss(updates);
    const convergenceScore = this.calculateConvergenceScore(updates);

    // Simulate quality metrics
    const qualityMetrics: ModelMetrics = {
      accuracy: 0.82 - privacyLoss * 0.1, // Privacy-accuracy tradeoff
      precision: 0.79 - privacyLoss * 0.08,
      recall: 0.76 - privacyLoss * 0.06,
      f1Score: 0.775 - privacyLoss * 0.07,
      diversityScore: 0.68,
      noveltyScore: 0.62,
      userSatisfaction: 0.85 - privacyLoss * 0.05,

    };

    return {
      aggregatedWeights,
      participantCount: updates.length,
      privacyLoss,
      convergenceScore,
      qualityMetrics
    };
  }

  private async updateGlobalModel(session: FederatedLearningSession, result: SecureAggregationResult): Promise<void> {
    session.globalModel.weights = result.aggregatedWeights;
    session.globalModel.lastUpdated = new Date();
    session.globalModel.round = session.aggregationRound + 1;
    session.aggregationRound++;
  }

  private async distributeGlobalModel(session: FederatedLearningSession, participants: string[]): Promise<void> {
    for (const userId of participants) {
      const localModel = this.localModels.get(userId);
      if (localModel) {
        // Update local model with global knowledge while preserving privacy
        localModel.globalKnowledge = this.extractPrivateGlobalKnowledge(session.globalModel);
        localModel.lastGlobalUpdate = new Date();
      }
    }
  }

  private async trainLocalModel(userId: string, localModel: any, trainingData: TrainingData): Promise<ModelMetrics> {
    // Simulate local training with privacy constraints
    await this.simulateTraining(300);

    // Update model weights
    localModel.weights = this.updateWeights(localModel.weights, trainingData);
    localModel.lastUpdated = new Date();

    return {
      accuracy: 0.78 + Math.random() * 0.1,
      precision: 0.75 + Math.random() * 0.1,
      recall: 0.72 + Math.random() * 0.1,
      f1Score: 0.735 + Math.random() * 0.1,
      diversityScore: 0.65 + Math.random() * 0.1,
      noveltyScore: 0.58 + Math.random() * 0.1,
      userSatisfaction: 0.82 + Math.random() * 0.1,

    };
  }

  private async privatizeFeedback(feedback: UserFeedback, constraints: PrivacySettings): Promise<UserFeedback> {
    return {
      ...feedback,
      userId: constraints.familyDataSharing ? feedback.userId : this.generateAnonymousId(feedback.userId),
      rating: this.addLaplaceNoise(feedback.rating / 5, 0.1) * 5, // Add noise and scale back
      context: this.anonymizeContext(feedback.context),
      feedback: constraints.behaviorAnalysis ? feedback.feedback : undefined
    };
  }

  private async updateModelWithPrivateFeedback(userId: string, localModel: any, feedback: UserFeedback): Promise<void> {
    // Update model with privacy-preserving feedback
    const learningRate = 0.01;
    const feedbackSignal = feedback.rating / 5; // Normalize to 0-1

    // Simple gradient update simulation
    localModel.weights = localModel.weights.map((w: number) => 
      w + learningRate * (feedbackSignal - 0.5) * (Math.random() - 0.5)
    );

    localModel.lastUpdated = new Date();
  }

  // Utility methods

  private generateEncryptionKey(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  private generateAnonymousId(userId: string): string {
    // Generate consistent anonymous ID for the same user
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `fed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeModelWeights(): number[] {
    return Array.from({ length: 100 }, () => Math.random() * 0.1 - 0.05);
  }

  private initializeGlobalModel(): any {
    return {
      weights: this.initializeModelWeights(),
      version: 1,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  private generalizeTimeOfDay(timestamp: Date): string {
    const hour = timestamp.getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  private generalizeDayType(timestamp: Date): string {
    const day = timestamp.getDay();
    return (day === 0 || day === 6) ? 'weekend' : 'weekday';
  }

  private generateFeatureKey(feature: any): string {
    // Generate key for grouping similar features
    return `${feature.name}_${typeof feature.value}_${Math.floor(feature.importance * 10)}`;
  }

  private generalizeFeatureGroup(group: any[]): any {
    // Create generalized feature from group
    return {
      name: group[0].name,
      value: 'generalized',
      importance: group.reduce((sum, f) => sum + f.importance, 0) / group.length,
      source: 'anonymized',
      timestamp: new Date(),
      groupSize: group.length
    };
  }

  private async computePrivateGradients(localModel: any, globalModel: any): Promise<number[]> {
    // Compute gradients between local and global model
    return localModel.weights.map((w: number, i: number) => w - globalModel.weights[i]);
  }

  private aggregateWeights(updates: LocalModelUpdate[]): number[] {
    if (updates.length === 0) return [];

    const weightCount = updates[0].gradients.length;
    const aggregated = new Array(weightCount).fill(0);

    // Average the gradients
    updates.forEach(update => {
      update.gradients.forEach((gradient, i) => {
        aggregated[i] += gradient / updates.length;
      });
    });

    return aggregated;
  }

  private calculatePrivacyLoss(updates: LocalModelUpdate[]): number {
    // Calculate total privacy loss from updates
    return updates.reduce((total, update) => {
      const noiseLevel = update.privacyNoise.reduce((sum, noise) => sum + Math.abs(noise), 0);
      return total + (1 / (1 + noiseLevel)); // Higher noise = lower privacy loss
    }, 0) / updates.length;
  }

  private calculateConvergenceScore(updates: LocalModelUpdate[]): number {
    // Calculate convergence based on gradient magnitudes
    const avgGradientMagnitude = updates.reduce((total, update) => {
      const magnitude = Math.sqrt(update.gradients.reduce((sum, g) => sum + g * g, 0));
      return total + magnitude;
    }, 0) / updates.length;

    return avgGradientMagnitude;
  }

  private extractPrivateGlobalKnowledge(globalModel: any): any {
    // Extract privacy-safe global knowledge
    return {
      generalTrends: 'anonymized',
      aggregatePatterns: 'generalized',
      modelVersion: globalModel.version,
      lastUpdated: globalModel.lastUpdated
    };
  }

  private updateWeights(weights: number[], trainingData: TrainingData): number[] {
    // Simple weight update simulation
    const learningRate = 0.01;
    return weights.map(w => w + learningRate * (Math.random() - 0.5) * 0.1);
  }

  private async simulateTraining(durationMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private extractAnonymousPatterns(interactions: UserInteraction[]): any {
    return {
      totalInteractions: interactions.length,
      avgSatisfaction: interactions.reduce((sum, i) => sum + i.satisfaction, 0) / interactions.length,
      commonTimePatterns: this.extractTimePatterns(interactions),
      generalPreferences: this.extractGeneralPreferences(interactions)
    };
  }

  private generalizePreferences(preferences: any): any {
    return {
      hasStrongPreferences: Object.keys(preferences.interests || {}).length > 5,
      prefersGroupActivities: preferences.activityPreferences?.socialPreference === 'group',
      prefersIndoorActivities: preferences.activityPreferences?.indoorOutdoorPreference === 'indoor',
      learningOriented: (preferences.learningPreferences?.preferredSubjects || []).length > 0
    };
  }

  private partiallyAnonymizePreferences(preferences: any): any {
    return {
      ...preferences,
      userId: this.generateAnonymousId(preferences.userId),
      interests: preferences.interests?.map((interest: any) => ({
        category: interest.category,
        strength: Math.round(interest.strength * 10) / 10, // Round to 1 decimal
        source: 'anonymized'
      }))
    };
  }

  private anonymizeTemporalPatterns(context: any): any {
    return {
      preferredTimeOfDay: this.generalizeTimeOfDay(context.timestamp || new Date()),
      preferredDayType: this.generalizeDayType(context.timestamp || new Date()),
      activityFrequency: 'regular' // Generalized frequency
    };
  }

  private roundTimestamp(timestamp: Date, intervalMs: number): Date {
    const rounded = Math.floor(timestamp.getTime() / intervalMs) * intervalMs;
    return new Date(rounded);
  }

  private extractGeneralPatterns(localModel: any): any {
    return {
      hasLearningPatterns: localModel.patterns?.length > 0,
      modelMaturity: localModel.weights?.length > 50,
      lastActiveDate: localModel.lastUpdated,
      privacyLevel: localModel.privacySettings?.dataSharing || PrivacyLevel.FAMILY
    };
  }

  private getAggregateMetrics(localModel: any): any {
    return {
      totalUpdates: localModel.updateCount || 0,
      avgPerformance: 0.75 + Math.random() * 0.2,
      privacyBudgetUsed: localModel.privacyBudgetUsed || 0,
      dataRetentionDays: localModel.dataRetentionDays || 30
    };
  }

  private anonymizePreferences(preferences: any): any {
    if (!preferences) return {};
    
    return {
      generalCategories: Object.keys(preferences).length,
      hasSpecificInterests: Object.keys(preferences).length > 3,
      diversityScore: Math.random() * 0.5 + 0.5
    };
  }

  private extractTimePatterns(interactions: UserInteraction[]): any {
    const hourCounts = new Array(24).fill(0);
    interactions.forEach(interaction => {
      const hour = interaction.timestamp.getHours();
      hourCounts[hour]++;
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    return {
      peakActivityHour: this.generalizeTimeOfDay(new Date(0, 0, 0, peakHour)),
      totalActiveHours: hourCounts.filter(count => count > 0).length
    };
  }

  private extractGeneralPreferences(interactions: UserInteraction[]): any {
    const satisfactionLevels = interactions.map(i => i.satisfaction);
    return {
      avgSatisfaction: satisfactionLevels.reduce((sum, s) => sum + s, 0) / satisfactionLevels.length,
      consistencyScore: 1 - (Math.max(...satisfactionLevels) - Math.min(...satisfactionLevels)),
      engagementLevel: interactions.filter(i => i.satisfaction > 0.7).length / interactions.length
    };
  }
}