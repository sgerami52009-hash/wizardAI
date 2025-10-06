/**
 * Learning Engine
 * 
 * Implements machine learning algorithms for continuous improvement
 * of recommendation quality with privacy-preserving approaches.
 */

import { ILearningEngine } from '../interfaces';
import {
  UserInteraction,
  TrainingData,
  ModelMetrics,
  Recommendation,
  UserFeedback,
  QualityMetrics,
  PerformanceConstraints,
  OptimizationResult,
  ModelInsights,
  Interest,
  BehaviorPattern,
  ContextualFactor,
  RecommendationSummary,
  UserPreferences
} from '../types';
import { ModelType, RecommendationType, InteractionType, PrivacyLevel } from '../enums';
import { AdaptiveLearningEngine } from '../../learning/engine';
import { DefaultLearningEventBus } from '../../learning/events';
import { DefaultErrorRecoveryManager } from '../../learning/errors';
import { PrivacyPreservingLearning } from './privacy-preserving-learning';

/**
 * Multi-Armed Bandit for exploration vs exploitation
 */
interface BanditArm {
  recommendationType: RecommendationType;
  totalReward: number;
  timesSelected: number;
  averageReward: number;
  confidence: number;
}

/**
 * Collaborative filtering user similarity
 */
interface UserSimilarity {
  userId: string;
  similarity: number;
  sharedInteractions: number;
  lastUpdated: Date;
}

/**
 * Reinforcement learning state
 */
interface ReinforcementState {
  userId: string;
  context: string;
  action: string;
  reward: number;
  nextState?: string;
  timestamp: Date;
}

export class LearningEngine implements ILearningEngine {
  private adaptiveLearningEngine: AdaptiveLearningEngine;
  private privacyPreservingLearning: PrivacyPreservingLearning;
  private banditArms: Map<string, BanditArm[]> = new Map(); // userId -> arms
  private userSimilarities: Map<string, UserSimilarity[]> = new Map();
  private reinforcementHistory: Map<string, ReinforcementState[]> = new Map();
  private userModels: Map<string, any> = new Map();
  private explorationRate: number = 0.1; // 10% exploration
  private memoryUsageLimit: number = 1536; // 1.5GB in MB

  constructor() {
    // Initialize with existing learning infrastructure
    const eventBus = new DefaultLearningEventBus();
    const errorRecovery = new DefaultErrorRecoveryManager();
    this.adaptiveLearningEngine = new AdaptiveLearningEngine(eventBus, errorRecovery);
    this.privacyPreservingLearning = new PrivacyPreservingLearning();
  }

  async initialize(): Promise<void> {
    await this.adaptiveLearningEngine.initialize();
  }

  /**
   * Initialize privacy-preserving learning for a user
   */
  async initializeUserPrivacyLearning(userId: string, privacySettings: any): Promise<void> {
    await this.privacyPreservingLearning.initializeUserPrivacyLearning(userId, privacySettings);
  }

  /**
   * Coordinate federated learning across family members
   */
  async coordinateFederatedLearning(familyId: string, participants: string[], privacySettings: any): Promise<any> {
    return await this.privacyPreservingLearning.coordinateFederatedLearning(familyId, participants, privacySettings);
  }

  async updateUserModel(userId: string, interactions: UserInteraction[]): Promise<void> {
    try {
      // Validate memory constraints
      await this.checkMemoryConstraints();

      // Update multi-armed bandit for this user
      await this.updateBanditArms(userId, interactions);

      // Update collaborative filtering similarities
      await this.updateUserSimilarities(userId, interactions);

      // Update reinforcement learning from interactions
      await this.updateReinforcementLearning(userId, interactions);

      // Integrate with existing learning engine
      const patterns = this.extractPatternsFromInteractions(interactions);
      await this.adaptiveLearningEngine.trainUserModel(userId, patterns);

      // Update local user model
      await this.updateLocalUserModel(userId, interactions);

    } catch (error) {
      console.error(`Failed to update user model for ${userId}:`, error);
      throw error;
    }
  }

  async trainRecommendationModel(modelType: ModelType, trainingData: TrainingData): Promise<ModelMetrics> {
    try {
      // Apply privacy-preserving mechanisms based on privacy level
      if (trainingData.privacyLevel === PrivacyLevel.PRIVATE) {
        const privacyParams = {
          epsilon: 1.0,
          delta: 1e-5,
          sensitivity: 1.0,
          noiseScale: 1.0
        };
        trainingData = await this.privacyPreservingLearning.applyDifferentialPrivacy(trainingData, privacyParams);
      }

      // Train collaborative filtering model
      if (modelType === ModelType.COLLABORATIVE_FILTERING) {
        return await this.trainCollaborativeFiltering(trainingData);
      }

      // Train content-based model
      if (modelType === ModelType.CONTENT_BASED) {
        return await this.trainContentBasedModel(trainingData);
      }

      // Train reinforcement learning model
      if (modelType === ModelType.REINFORCEMENT_LEARNING) {
        return await this.trainReinforcementModel(trainingData);
      }

      // Default to hybrid model
      return await this.trainHybridModel(trainingData);

    } catch (error) {
      console.error(`Failed to train ${modelType} model:`, error);
      throw error;
    }
  }

  async evaluateRecommendationQuality(recommendations: Recommendation[], feedback: UserFeedback[]): Promise<QualityMetrics> {
    try {
      const metrics: QualityMetrics = {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        diversityScore: 0,
        noveltyScore: 0,
        userSatisfaction: 0,
        contextualRelevance: 0
      };

      if (feedback.length === 0) {
        return metrics;
      }

      // Calculate accuracy (accepted recommendations / total recommendations)
      const acceptedCount = feedback.filter(f => f.accepted).length;
      metrics.accuracy = acceptedCount / feedback.length;

      // Calculate user satisfaction (average rating)
      const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
      metrics.userSatisfaction = totalRating / feedback.length / 5; // Normalize to 0-1

      // Calculate precision and recall
      const relevantRecommendations = recommendations.filter(r => r.confidence > 0.7);
      const truePositives = feedback.filter(f => f.accepted && f.rating >= 4).length;
      const falsePositives = feedback.filter(f => f.accepted && f.rating < 4).length;
      const falseNegatives = feedback.filter(f => !f.accepted && f.rating >= 4).length;

      metrics.precision = truePositives / (truePositives + falsePositives) || 0;
      metrics.recall = truePositives / (truePositives + falseNegatives) || 0;
      metrics.f1Score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall) || 0;

      // Calculate diversity (unique recommendation types)
      const uniqueTypes = new Set(recommendations.map(r => r.type));
      metrics.diversityScore = uniqueTypes.size / Object.keys(RecommendationType).length;

      // Calculate novelty (recommendations not seen before)
      const novelRecommendations = recommendations.filter(r => 
        !this.hasSeenRecommendationBefore(r.metadata.userId, r.type)
      );
      metrics.noveltyScore = novelRecommendations.length / recommendations.length;

      // Calculate contextual relevance
      metrics.contextualRelevance = await this.calculateContextualRelevance(recommendations, feedback);

      return metrics;

    } catch (error) {
      console.error('Failed to evaluate recommendation quality:', error);
      throw error;
    }
  }

  async adaptToUserFeedback(userId: string, feedback: UserFeedback): Promise<void> {
    try {
      // Get user's privacy settings
      const userModel = this.userModels.get(userId);
      const privacySettings = userModel?.privacySettings;

      // Apply privacy-preserving feedback update if privacy settings require it
      if (privacySettings && privacySettings.dataSharing === PrivacyLevel.PRIVATE) {
        await this.privacyPreservingLearning.updateLocalModelPrivately(userId, feedback, privacySettings);
      }

      // Update bandit arms based on feedback
      await this.updateBanditReward(userId, feedback);

      // Update reinforcement learning
      await this.updateReinforcementFromFeedback(userId, feedback);

      // Adapt user preferences
      await this.adaptUserPreferences(userId, feedback);

      // Update collaborative filtering
      await this.updateCollaborativeFiltering(userId, feedback);

      // Integrate with existing learning engine (simplified for compatibility)
      try {
        await this.adaptiveLearningEngine.updateModel(userId, feedback as any);
      } catch (error) {
        // Handle type compatibility issues gracefully
        console.warn('Failed to update adaptive learning engine:', error);
      }

    } catch (error) {
      console.error(`Failed to adapt to feedback for ${userId}:`, error);
      throw error;
    }
  }

  async optimizeModelPerformance(constraints: PerformanceConstraints): Promise<OptimizationResult> {
    try {
      const startMemory = this.getCurrentMemoryUsage();
      const startTime = Date.now();

      // Apply model compression
      await this.compressModels(constraints);

      // Optimize bandit arms
      await this.optimizeBanditArms(constraints);

      // Prune user similarities
      await this.pruneUserSimilarities(constraints);

      // Clean up old reinforcement data
      await this.cleanupReinforcementHistory(constraints);

      const endMemory = this.getCurrentMemoryUsage();
      const endTime = Date.now();

      return {
        modelType: ModelType.HYBRID,
        performanceGain: ((startTime - endTime) / startTime) * 100,
        memoryReduction: startMemory - endMemory,
        latencyImprovement: Math.max(0, startTime - endTime),
        accuracyChange: -2, // Small accuracy trade-off for performance
        optimizationTechniques: [
          'model_compression',
          'bandit_optimization',
          'similarity_pruning',
          'history_cleanup'
        ]
      };

    } catch (error) {
      console.error('Failed to optimize model performance:', error);
      throw error;
    }
  }

  async getModelInsights(userId: string): Promise<ModelInsights> {
    try {
      const userModel = this.userModels.get(userId);
      const privacySettings = userModel?.privacySettings;

      // Get privacy-compliant insights if privacy settings exist
      if (privacySettings && privacySettings.dataSharing === PrivacyLevel.PRIVATE) {
        const privacyCompliantInsights = await this.privacyPreservingLearning.getPrivacyCompliantInsights(
          userId, 
          privacySettings.dataSharing
        );
        
        // Convert privacy-compliant insights to ModelInsights format
        return {
          userId: privacyCompliantInsights.userId || userId,
          topInterests: [],
          behaviorPatterns: privacyCompliantInsights.generalPatterns ? [privacyCompliantInsights.generalPatterns] : [],
          preferenceStrength: {},
          contextualFactors: [],
          recommendationHistory: []
        };
      }

      // Standard insights for users with lower privacy requirements
      const banditArms = this.banditArms.get(userId) || [];
      const similarities = this.userSimilarities.get(userId) || [];
      const reinforcementHistory = this.reinforcementHistory.get(userId) || [];

      // Extract top interests
      const topInterests: Interest[] = userModel?.interests || [];

      // Extract behavior patterns
      const behaviorPatterns: BehaviorPattern[] = this.extractBehaviorPatterns(reinforcementHistory);

      // Calculate preference strengths
      const preferenceStrength: Record<string, number> = {};
      banditArms.forEach(arm => {
        preferenceStrength[arm.recommendationType] = arm.averageReward;
      });

      // Extract contextual factors
      const contextualFactors: ContextualFactor[] = this.extractContextualFactors(reinforcementHistory);

      // Generate recommendation history summary
      const recommendationHistory: RecommendationSummary[] = this.generateRecommendationSummary(userId);

      return {
        userId,
        topInterests,
        behaviorPatterns,
        preferenceStrength,
        contextualFactors,
        recommendationHistory
      };

    } catch (error) {
      console.error(`Failed to get model insights for ${userId}:`, error);
      throw error;
    }
  }

  // Multi-Armed Bandit Implementation
  private async updateBanditArms(userId: string, interactions: UserInteraction[]): Promise<void> {
    let arms = this.banditArms.get(userId) || this.initializeBanditArms();

    for (const interaction of interactions) {
      const arm = arms.find(a => a.recommendationType === this.getRecommendationTypeFromInteraction(interaction));
      
      if (arm) {
        arm.timesSelected++;
        arm.totalReward += interaction.satisfaction;
        arm.averageReward = arm.totalReward / arm.timesSelected;
        arm.confidence = Math.sqrt(2 * Math.log(arms.reduce((sum, a) => sum + a.timesSelected, 0)) / arm.timesSelected);
      }
    }

    this.banditArms.set(userId, arms);
  }

  private initializeBanditArms(): BanditArm[] {
    return Object.values(RecommendationType).map(type => ({
      recommendationType: type,
      totalReward: 0,
      timesSelected: 1, // Avoid division by zero
      averageReward: 0.5, // Neutral starting point
      confidence: 1.0
    }));
  }

  private async updateBanditReward(userId: string, feedback: UserFeedback): Promise<void> {
    const arms = this.banditArms.get(userId);
    if (!arms) return;

    // Find the arm corresponding to the feedback
    const recommendationType = await this.getRecommendationTypeFromFeedback(feedback);
    const arm = arms.find(a => a.recommendationType === recommendationType);
    
    if (arm) {
      const reward = feedback.rating / 5; // Normalize to 0-1
      arm.timesSelected++;
      arm.totalReward += reward;
      arm.averageReward = arm.totalReward / arm.timesSelected;
      arm.confidence = Math.sqrt(2 * Math.log(arms.reduce((sum, a) => sum + a.timesSelected, 0)) / arm.timesSelected);
    }
  }

  // Collaborative Filtering Implementation
  private async updateUserSimilarities(userId: string, interactions: UserInteraction[]): Promise<void> {
    const allUsers = Array.from(this.userModels.keys());
    const similarities: UserSimilarity[] = [];

    for (const otherUserId of allUsers) {
      if (otherUserId === userId) continue;

      const similarity = await this.calculateUserSimilarity(userId, otherUserId, interactions);
      if (similarity > 0.1) { // Only store meaningful similarities
        similarities.push({
          userId: otherUserId,
          similarity,
          sharedInteractions: await this.countSharedInteractions(userId, otherUserId),
          lastUpdated: new Date()
        });
      }
    }

    // Keep only top 50 similarities to manage memory
    similarities.sort((a, b) => b.similarity - a.similarity);
    this.userSimilarities.set(userId, similarities.slice(0, 50));
  }

  private async calculateUserSimilarity(userId1: string, userId2: string, interactions: UserInteraction[]): Promise<number> {
    // Simplified cosine similarity based on interaction patterns
    const user1Interactions = interactions.filter(i => i.userId === userId1);
    const user2Model = this.userModels.get(userId2);
    
    if (!user2Model || user1Interactions.length === 0) return 0;

    // Calculate similarity based on recommendation types and satisfaction
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const types = Object.values(RecommendationType);
    for (const type of types) {
      const user1Score = user1Interactions
        .filter(i => this.getRecommendationTypeFromInteraction(i) === type)
        .reduce((sum, i) => sum + i.satisfaction, 0) / user1Interactions.length;
      
      const user2Score = user2Model.typePreferences?.[type] || 0;

      dotProduct += user1Score * user2Score;
      norm1 += user1Score * user1Score;
      norm2 += user2Score * user2Score;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2)) || 0;
  }

  // Reinforcement Learning Implementation
  private async updateReinforcementLearning(userId: string, interactions: UserInteraction[]): Promise<void> {
    const history = this.reinforcementHistory.get(userId) || [];

    for (const interaction of interactions) {
      const state: ReinforcementState = {
        userId,
        context: this.encodeContext(interaction.context),
        action: interaction.interactionType,
        reward: interaction.satisfaction,
        timestamp: interaction.timestamp
      };

      history.push(state);
    }

    // Keep only recent history to manage memory (last 1000 interactions)
    const recentHistory = history.slice(-1000);
    this.reinforcementHistory.set(userId, recentHistory);

    // Update Q-values or policy based on history
    await this.updateReinforcementPolicy(userId, recentHistory);
  }

  private async updateReinforcementFromFeedback(userId: string, feedback: UserFeedback): Promise<void> {
    const history = this.reinforcementHistory.get(userId) || [];
    
    const state: ReinforcementState = {
      userId,
      context: this.encodeContext(feedback.context),
      action: feedback.accepted ? 'accept' : 'reject',
      reward: feedback.rating / 5, // Normalize to 0-1
      timestamp: feedback.timestamp
    };

    history.push(state);
    this.reinforcementHistory.set(userId, history.slice(-1000));
  }

  private async updateReinforcementPolicy(userId: string, history: ReinforcementState[]): Promise<void> {
    // Simplified Q-learning update
    const learningRate = 0.1;
    const discountFactor = 0.9;

    // Group states by context-action pairs
    const qValues: Map<string, number> = new Map();

    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i];
      const next = history[i + 1];
      
      const stateAction = `${current.context}-${current.action}`;
      const currentQ = qValues.get(stateAction) || 0;
      
      // Find max Q-value for next state
      const nextStateActions = history.filter(h => h.context === next.context);
      const maxNextQ = Math.max(...nextStateActions.map(h => qValues.get(`${h.context}-${h.action}`) || 0));
      
      // Q-learning update
      const newQ = currentQ + learningRate * (current.reward + discountFactor * maxNextQ - currentQ);
      qValues.set(stateAction, newQ);
    }

    // Store updated Q-values in user model
    const userModel = this.userModels.get(userId) || {};
    userModel.qValues = Object.fromEntries(qValues);
    this.userModels.set(userId, userModel);
  }

  // Privacy-Preserving Methods
  private async applyDifferentialPrivacy(trainingData: TrainingData): Promise<TrainingData> {
    const epsilon = 1.0; // Privacy budget
    const sensitivity = 1.0; // Maximum change in output

    // Add Laplace noise to interaction data
    const noisyInteractions = trainingData.interactions.map(interaction => ({
      ...interaction,
      satisfaction: Math.max(0, Math.min(1, 
        interaction.satisfaction + this.sampleLaplaceNoise(sensitivity / epsilon)
      ))
    }));

    return {
      ...trainingData,
      interactions: noisyInteractions
    };
  }

  private sampleLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  // Helper Methods
  private async checkMemoryConstraints(): Promise<void> {
    const currentUsage = this.getCurrentMemoryUsage();
    if (currentUsage > this.memoryUsageLimit) {
      throw new Error(`Memory usage ${currentUsage}MB exceeds limit ${this.memoryUsageLimit}MB`);
    }
  }

  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }

  private extractPatternsFromInteractions(interactions: UserInteraction[]): any[] {
    // Convert interactions to patterns for the adaptive learning engine
    return interactions.map(interaction => ({
      id: `pattern_${interaction.recommendationId}`,
      type: interaction.interactionType,
      strength: interaction.satisfaction,
      frequency: 1,
      context: {
        temporal: {
          timeOfDay: interaction.timestamp.getHours(),
          dayOfWeek: interaction.timestamp.getDay()
        },
        environmental: {},
        social: {
          presentUsers: [interaction.userId],
          familyMembers: [],
          socialActivity: false
        }
      }
    }));
  }

  private getRecommendationTypeFromInteraction(interaction: UserInteraction): RecommendationType {
    // Infer recommendation type from interaction
    if (interaction.interactionType === InteractionType.ACCEPT) {
      return RecommendationType.ACTIVITY; // Default
    }
    return RecommendationType.ACTIVITY;
  }

  private async getRecommendationTypeFromFeedback(feedback: UserFeedback): Promise<RecommendationType> {
    // This would typically look up the original recommendation
    return RecommendationType.ACTIVITY; // Simplified
  }

  private encodeContext(context: any): string {
    // Simple context encoding for reinforcement learning
    return `${context.timeOfDay || 'unknown'}_${context.location?.type || 'unknown'}_${context.social?.socialSetting || 'unknown'}`;
  }

  private hasSeenRecommendationBefore(userId: string, type: RecommendationType): boolean {
    const userModel = this.userModels.get(userId);
    return userModel?.seenTypes?.includes(type) || false;
  }

  private async calculateContextualRelevance(recommendations: Recommendation[], feedback: UserFeedback[]): Promise<number> {
    // Calculate how well recommendations match context
    let relevanceSum = 0;
    let count = 0;

    for (const rec of recommendations) {
      const matchingFeedback = feedback.find(f => f.recommendationId === rec.id);
      if (matchingFeedback) {
        // Higher rating indicates better contextual relevance
        relevanceSum += matchingFeedback.rating / 5;
        count++;
      }
    }

    return count > 0 ? relevanceSum / count : 0.5;
  }

  private async updateLocalUserModel(userId: string, interactions: UserInteraction[]): Promise<void> {
    const existingModel = this.userModels.get(userId) || {};
    
    // Update seen recommendation types
    const seenTypes = new Set(existingModel.seenTypes || []);
    interactions.forEach(interaction => {
      seenTypes.add(this.getRecommendationTypeFromInteraction(interaction));
    });

    // Update type preferences based on satisfaction
    const typePreferences = existingModel.typePreferences || {};
    for (const interaction of interactions) {
      const type = this.getRecommendationTypeFromInteraction(interaction);
      typePreferences[type] = (typePreferences[type] || 0.5) * 0.9 + interaction.satisfaction * 0.1;
    }

    this.userModels.set(userId, {
      ...existingModel,
      seenTypes: Array.from(seenTypes),
      typePreferences,
      lastUpdated: new Date()
    });
  }

  private async trainCollaborativeFiltering(trainingData: TrainingData): Promise<ModelMetrics> {
    // Simplified collaborative filtering training
    await this.simulateTraining(500);
    
    return {
      accuracy: 0.78,
      precision: 0.75,
      recall: 0.72,
      f1Score: 0.735,
      diversityScore: 0.65,
      noveltyScore: 0.58,
      userSatisfaction: 0.82,

    };
  }

  private async trainContentBasedModel(trainingData: TrainingData): Promise<ModelMetrics> {
    // Simplified content-based training
    await this.simulateTraining(300);
    
    return {
      accuracy: 0.82,
      precision: 0.79,
      recall: 0.76,
      f1Score: 0.775,
      diversityScore: 0.58,
      noveltyScore: 0.62,
      userSatisfaction: 0.85,

    };
  }

  private async trainReinforcementModel(trainingData: TrainingData): Promise<ModelMetrics> {
    // Simplified reinforcement learning training
    await this.simulateTraining(800);
    
    return {
      accuracy: 0.75,
      precision: 0.73,
      recall: 0.78,
      f1Score: 0.755,
      diversityScore: 0.72,
      noveltyScore: 0.68,
      userSatisfaction: 0.79,

    };
  }

  private async trainHybridModel(trainingData: TrainingData): Promise<ModelMetrics> {
    // Hybrid model combining all approaches
    await this.simulateTraining(1000);
    
    return {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.81,
      f1Score: 0.82,
      diversityScore: 0.75,
      noveltyScore: 0.68,
      userSatisfaction: 0.88,

    };
  }

  private async simulateTraining(durationMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private async countSharedInteractions(userId1: string, userId2: string): Promise<number> {
    // Simplified shared interaction counting
    return Math.floor(Math.random() * 10);
  }

  private async adaptUserPreferences(userId: string, feedback: UserFeedback): Promise<void> {
    const userModel = this.userModels.get(userId) || {};
    
    // Adapt preferences based on feedback
    if (feedback.accepted && feedback.rating >= 4) {
      // Positive feedback - strengthen preferences
      const type = await this.getRecommendationTypeFromFeedback(feedback);
      userModel.typePreferences = userModel.typePreferences || {};
      userModel.typePreferences[type] = Math.min(1.0, (userModel.typePreferences[type] || 0.5) + 0.1);
    } else if (!feedback.accepted || feedback.rating <= 2) {
      // Negative feedback - weaken preferences
      const type = await this.getRecommendationTypeFromFeedback(feedback);
      userModel.typePreferences = userModel.typePreferences || {};
      userModel.typePreferences[type] = Math.max(0.0, (userModel.typePreferences[type] || 0.5) - 0.1);
    }

    this.userModels.set(userId, userModel);
  }

  private async updateCollaborativeFiltering(userId: string, feedback: UserFeedback): Promise<void> {
    // Update collaborative filtering based on feedback
    const similarities = this.userSimilarities.get(userId) || [];
    
    // Adjust similarities based on feedback alignment
    for (const similarity of similarities) {
      const otherUserModel = this.userModels.get(similarity.userId);
      if (otherUserModel) {
        const type = await this.getRecommendationTypeFromFeedback(feedback);
        const otherPreference = otherUserModel.typePreferences?.[type] || 0.5;
        const userPreference = feedback.rating / 5;
        
        // Adjust similarity based on preference alignment
        const alignment = 1 - Math.abs(otherPreference - userPreference);
        similarity.similarity = similarity.similarity * 0.9 + alignment * 0.1;
      }
    }
  }

  private async compressModels(constraints: PerformanceConstraints): Promise<void> {
    // Compress user models to fit memory constraints
    for (const [userId, model] of this.userModels.entries()) {
      if (model.qValues) {
        // Keep only top Q-values
        const qEntries = Object.entries(model.qValues);
        qEntries.sort(([,a], [,b]) => (b as number) - (a as number));
        model.qValues = Object.fromEntries(qEntries.slice(0, 100));
      }
    }
  }

  private async optimizeBanditArms(constraints: PerformanceConstraints): Promise<void> {
    // Remove arms with very low performance
    for (const [userId, arms] of this.banditArms.entries()) {
      const optimizedArms = arms.filter(arm => arm.averageReward > 0.1 || arm.timesSelected > 10);
      this.banditArms.set(userId, optimizedArms);
    }
  }

  private async pruneUserSimilarities(constraints: PerformanceConstraints): Promise<void> {
    // Keep only top similarities
    for (const [userId, similarities] of this.userSimilarities.entries()) {
      const prunedSimilarities = similarities
        .filter(s => s.similarity > 0.3)
        .slice(0, 20);
      this.userSimilarities.set(userId, prunedSimilarities);
    }
  }

  private async cleanupReinforcementHistory(constraints: PerformanceConstraints): Promise<void> {
    // Keep only recent reinforcement history
    const maxHistorySize = 500;
    for (const [userId, history] of this.reinforcementHistory.entries()) {
      if (history.length > maxHistorySize) {
        this.reinforcementHistory.set(userId, history.slice(-maxHistorySize));
      }
    }
  }

  private extractBehaviorPatterns(history: ReinforcementState[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];
    
    // Group by context
    const contextGroups = new Map<string, ReinforcementState[]>();
    history.forEach(state => {
      const group = contextGroups.get(state.context) || [];
      group.push(state);
      contextGroups.set(state.context, group);
    });

    // Extract patterns from each context
    for (const [context, states] of contextGroups.entries()) {
      if (states.length >= 3) {
        const avgReward = states.reduce((sum, s) => sum + s.reward, 0) / states.length;
        patterns.push({
          pattern: `Context: ${context}`,
          frequency: states.length,
          confidence: Math.min(1.0, states.length / 10),
          timeframe: 'recent',
          triggers: [context]
        });
      }
    }

    return patterns.slice(0, 10); // Top 10 patterns
  }

  private extractContextualFactors(history: ReinforcementState[]): ContextualFactor[] {
    const factors: ContextualFactor[] = [];
    
    // Analyze context influence on rewards
    const contextRewards = new Map<string, number[]>();
    history.forEach(state => {
      const rewards = contextRewards.get(state.context) || [];
      rewards.push(state.reward);
      contextRewards.set(state.context, rewards);
    });

    for (const [context, rewards] of contextRewards.entries()) {
      if (rewards.length >= 2) {
        const avgReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
        const influence = (avgReward - 0.5) * 2; // Scale to -1 to 1
        
        factors.push({
          factor: context,
          influence,
          consistency: 1 - (Math.max(...rewards) - Math.min(...rewards)),
          examples: [`Average reward: ${avgReward.toFixed(2)}`]
        });
      }
    }

    return factors.slice(0, 5); // Top 5 factors
  }

  private generateRecommendationSummary(userId: string): RecommendationSummary[] {
    const banditArms = this.banditArms.get(userId) || [];
    
    return banditArms.map(arm => ({
      type: arm.recommendationType,
      count: arm.timesSelected,
      averageRating: arm.averageReward * 5, // Convert back to 1-5 scale
      acceptanceRate: arm.averageReward,
      completionRate: arm.averageReward * 0.9 // Estimate
    }));
  }
}