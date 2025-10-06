// Learning Feedback Management

import { UserFeedback, FeedbackType, FeedbackSource, FeedbackContext } from './types';
import { LearningEventBus, LearningEventType } from './events';

export interface LearningFeedbackManager {
  collectFeedback(feedback: UserFeedback): Promise<void>;
  processFeedback(userId: string): Promise<FeedbackProcessingResult>;
  getFeedbackHistory(userId: string, timeRange?: TimeRange): Promise<UserFeedback[]>;
  getFeedbackInsights(userId: string): Promise<FeedbackInsights>;
  clearFeedback(userId: string): Promise<void>;
  
  // Enhanced feedback analysis methods
  analyzeFeedbackPatterns(userId: string): Promise<FeedbackPatternAnalysis>;
  generateAdaptiveLearningStrategy(userId: string): Promise<AdaptiveLearningStrategy>;
  updateLearningParameters(userId: string, feedback: UserFeedback): Promise<LearningParameterUpdate>;
  validateChildSafeFeedback(feedback: UserFeedback): Promise<boolean>;
  getPersonalizationEffectiveness(userId: string): Promise<PersonalizationMetrics>;
}

export class DefaultLearningFeedbackManager implements LearningFeedbackManager {
  private feedbackStore: Map<string, UserFeedback[]> = new Map();
  private eventBus: LearningEventBus;

  constructor(eventBus: LearningEventBus) {
    this.eventBus = eventBus;
  }

  public async collectFeedback(feedback: UserFeedback): Promise<void> {
    // Validate feedback
    this.validateFeedback(feedback);

    // Store feedback
    const userFeedback = this.feedbackStore.get(feedback.userId) || [];
    userFeedback.push(feedback);
    this.feedbackStore.set(feedback.userId, userFeedback);

    // Limit feedback history (keep last 1000 entries per user)
    if (userFeedback.length > 1000) {
      this.feedbackStore.set(feedback.userId, userFeedback.slice(-1000));
    }

    // Emit feedback received event
    await this.eventBus.emit({
      id: this.generateId(),
      type: LearningEventType.USER_FEEDBACK_RECEIVED,
      timestamp: new Date(),
      userId: feedback.userId,
      data: { feedback }
    });
  }

  public async processFeedback(userId: string): Promise<FeedbackProcessingResult> {
    const userFeedback = this.feedbackStore.get(userId) || [];
    
    if (userFeedback.length === 0) {
      return {
        processed: false,
        feedbackCount: 0,
        insights: {
          overallSatisfaction: 0,
          commonIssues: [],
          improvementAreas: [],
          positivePatterns: []
        },
        recommendations: []
      };
    }

    // Process feedback to extract insights
    const insights = this.extractFeedbackInsights(userFeedback);
    const recommendations = this.generateRecommendations(insights);

    return {
      processed: true,
      feedbackCount: userFeedback.length,
      insights,
      recommendations
    };
  }

  public async getFeedbackHistory(userId: string, timeRange?: TimeRange): Promise<UserFeedback[]> {
    const userFeedback = this.feedbackStore.get(userId) || [];
    
    if (!timeRange) {
      return [...userFeedback];
    }

    return userFeedback.filter(feedback => {
      const feedbackTime = feedback.timestamp.getTime();
      return feedbackTime >= timeRange.start.getTime() && 
             feedbackTime <= timeRange.end.getTime();
    });
  }

  public async getFeedbackInsights(userId: string): Promise<FeedbackInsights> {
    const userFeedback = this.feedbackStore.get(userId) || [];
    return this.extractFeedbackInsights(userFeedback);
  }

  public async clearFeedback(userId: string): Promise<void> {
    this.feedbackStore.delete(userId);
  }

  public async analyzeFeedbackPatterns(userId: string): Promise<FeedbackPatternAnalysis> {
    const userFeedback = this.feedbackStore.get(userId) || [];
    
    if (userFeedback.length === 0) {
      return this.createEmptyPatternAnalysis(userId);
    }

    const behavioralPatterns = this.analyzeBehavioralPatterns(userFeedback);
    const temporalPatterns = this.analyzeTemporalPatterns(userFeedback);
    const contextualPatterns = this.analyzeContextualPatterns(userFeedback);
    const satisfactionTrends = this.analyzeSatisfactionTrends(userFeedback);
    const learningEffectiveness = this.calculateLearningEffectiveness(userFeedback);

    return {
      userId,
      analysisTimestamp: new Date(),
      behavioralPatterns,
      temporalPatterns,
      contextualPatterns,
      satisfactionTrends,
      learningEffectiveness
    };
  }

  public async generateAdaptiveLearningStrategy(userId: string): Promise<AdaptiveLearningStrategy> {
    const patternAnalysis = await this.analyzeFeedbackPatterns(userId);
    const userFeedback = this.feedbackStore.get(userId) || [];
    
    // Determine learning approach based on feedback patterns
    const learningApproach = this.determineLearningApproach(patternAnalysis, userFeedback);
    const personalizationLevel = this.calculatePersonalizationLevel(patternAnalysis);
    const adaptationParameters = this.calculateAdaptationParameters(patternAnalysis);
    const feedbackSensitivity = this.calculateFeedbackSensitivity(userFeedback);
    const safetyConstraints = this.determineSafetyConstraints(userId, userFeedback);

    return {
      userId,
      strategyId: this.generateId(),
      createdAt: new Date(),
      learningApproach,
      personalizationLevel,
      adaptationParameters,
      feedbackSensitivity,
      safetyConstraints
    };
  }

  public async updateLearningParameters(userId: string, feedback: UserFeedback): Promise<LearningParameterUpdate> {
    const currentStrategy = await this.generateAdaptiveLearningStrategy(userId);
    const previousParameters = { ...currentStrategy.adaptationParameters };
    
    // Adjust parameters based on feedback
    const newParameters = this.adjustParametersBasedOnFeedback(
      currentStrategy.adaptationParameters,
      feedback
    );

    const updateReason = this.determineUpdateReason(feedback);
    
    return {
      updated: true,
      previousParameters,
      newParameters,
      updateReason,
      effectiveDate: new Date(),
      rollbackAvailable: true
    };
  }

  public async validateChildSafeFeedback(feedback: UserFeedback): Promise<boolean> {
    // Check if feedback contains inappropriate content
    if (this.containsInappropriateContent(feedback)) {
      return false;
    }

    // Validate feedback context is appropriate for children
    if (!this.isContextChildSafe(feedback.context)) {
      return false;
    }

    // Check if feedback type is appropriate
    if (!this.isFeedbackTypeChildSafe(feedback.type)) {
      return false;
    }

    // Validate improvement suggestions are child-appropriate
    if (!this.areImprovementSuggestionsChildSafe(feedback.improvementSuggestions)) {
      return false;
    }

    return true;
  }

  public async getPersonalizationEffectiveness(userId: string): Promise<PersonalizationMetrics> {
    const userFeedback = this.feedbackStore.get(userId) || [];
    
    if (userFeedback.length === 0) {
      return this.createEmptyPersonalizationMetrics(userId);
    }

    const measurementPeriod = this.calculateMeasurementPeriod(userFeedback);
    const overallEffectiveness = this.calculateOverallEffectiveness(userFeedback);
    const accuracyImprovement = this.calculateAccuracyImprovement(userFeedback);
    const satisfactionImprovement = this.calculateSatisfactionImprovement(userFeedback);
    const engagementIncrease = this.calculateEngagementIncrease(userFeedback);
    const personalizationCoverage = this.calculatePersonalizationCoverage(userFeedback);
    const adaptationSuccessRate = this.calculateAdaptationSuccessRate(userFeedback);

    return {
      userId,
      measurementPeriod,
      overallEffectiveness,
      accuracyImprovement,
      satisfactionImprovement,
      engagementIncrease,
      personalizationCoverage,
      adaptationSuccessRate
    };
  }

  private validateFeedback(feedback: UserFeedback): void {
    if (!feedback.feedbackId || !feedback.userId || !feedback.type) {
      throw new Error('Invalid feedback: missing required fields');
    }

    if (!feedback.timestamp) {
      feedback.timestamp = new Date();
    }

    if (feedback.rating.overall < 1 || feedback.rating.overall > 5) {
      throw new Error('Invalid feedback rating: must be between 1 and 5');
    }
  }

  private extractFeedbackInsights(feedbackList: UserFeedback[]): FeedbackInsights {
    if (feedbackList.length === 0) {
      return {
        overallSatisfaction: 0,
        commonIssues: [],
        improvementAreas: [],
        positivePatterns: []
      };
    }

    // Calculate overall satisfaction
    const totalSatisfaction = feedbackList.reduce((sum, feedback) => 
      sum + feedback.rating.overall, 0);
    const overallSatisfaction = totalSatisfaction / feedbackList.length;

    // Identify common issues
    const issueMap = new Map<string, number>();
    const improvementMap = new Map<string, number>();
    const positiveMap = new Map<string, number>();

    feedbackList.forEach(feedback => {
      // Process negative feedback for issues
      if (feedback.rating.overall <= 2) {
        if (feedback.specificFeedback.accuracy && !feedback.specificFeedback.accuracy.wasAccurate) {
          issueMap.set('accuracy', (issueMap.get('accuracy') || 0) + 1);
        }
        if (feedback.specificFeedback.relevance && !feedback.specificFeedback.relevance.wasRelevant) {
          issueMap.set('relevance', (issueMap.get('relevance') || 0) + 1);
        }
        if (feedback.specificFeedback.timing && !feedback.specificFeedback.timing.wasTimely) {
          issueMap.set('timing', (issueMap.get('timing') || 0) + 1);
        }
        if (feedback.specificFeedback.personalization && !feedback.specificFeedback.personalization.wasPersonalized) {
          issueMap.set('personalization', (issueMap.get('personalization') || 0) + 1);
        }
      }

      // Process improvement suggestions
      feedback.improvementSuggestions.forEach(suggestion => {
        improvementMap.set(suggestion, (improvementMap.get(suggestion) || 0) + 1);
      });

      // Process positive feedback
      if (feedback.rating.overall >= 4) {
        if (feedback.specificFeedback.accuracy?.wasAccurate) {
          positiveMap.set('accurate_responses', (positiveMap.get('accurate_responses') || 0) + 1);
        }
        if (feedback.specificFeedback.relevance?.wasRelevant) {
          positiveMap.set('relevant_content', (positiveMap.get('relevant_content') || 0) + 1);
        }
        if (feedback.specificFeedback.timing?.wasTimely) {
          positiveMap.set('good_timing', (positiveMap.get('good_timing') || 0) + 1);
        }
        if (feedback.specificFeedback.personalization?.wasPersonalized) {
          positiveMap.set('personalized_experience', (positiveMap.get('personalized_experience') || 0) + 1);
        }
      }
    });

    // Convert maps to sorted arrays
    const commonIssues = Array.from(issueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, frequency: count }));

    const improvementAreas = Array.from(improvementMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([area, count]) => ({ area, frequency: count }));

    const positivePatterns = Array.from(positiveMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, frequency: count }));

    return {
      overallSatisfaction,
      commonIssues,
      improvementAreas,
      positivePatterns
    };
  }

  private generateRecommendations(insights: FeedbackInsights): FeedbackRecommendation[] {
    const recommendations: FeedbackRecommendation[] = [];

    // Recommendations based on satisfaction level
    if (insights.overallSatisfaction < 3) {
      recommendations.push({
        type: 'critical_improvement',
        priority: 'high',
        description: 'Overall satisfaction is low, immediate attention required',
        actions: ['Review recent changes', 'Analyze common issues', 'Implement quick fixes']
      });
    } else if (insights.overallSatisfaction < 4) {
      recommendations.push({
        type: 'moderate_improvement',
        priority: 'medium',
        description: 'Satisfaction is below optimal, consider improvements',
        actions: ['Address top issues', 'Enhance personalization', 'Improve response accuracy']
      });
    }

    // Recommendations based on common issues
    insights.commonIssues.forEach(issue => {
      if (issue.frequency > 3) {
        recommendations.push({
          type: 'issue_resolution',
          priority: 'high',
          description: `Frequent issue with ${issue.issue}`,
          actions: [`Improve ${issue.issue} algorithms`, `Add validation for ${issue.issue}`, `Monitor ${issue.issue} metrics`]
        });
      }
    });

    // Recommendations based on improvement areas
    insights.improvementAreas.slice(0, 3).forEach(area => {
      recommendations.push({
        type: 'enhancement',
        priority: 'medium',
        description: `Users frequently suggest improvements in ${area.area}`,
        actions: [`Research ${area.area} enhancements`, `Prototype ${area.area} improvements`, `Test ${area.area} changes`]
      });
    });

    // Recommendations based on positive patterns
    if (insights.positivePatterns.length > 0) {
      recommendations.push({
        type: 'amplify_success',
        priority: 'low',
        description: 'Amplify successful patterns',
        actions: insights.positivePatterns.map(pattern => `Enhance ${pattern.pattern} capabilities`)
      });
    }

    return recommendations;
  }

  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Enhanced analysis methods
  private createEmptyPatternAnalysis(userId: string): FeedbackPatternAnalysis {
    return {
      userId,
      analysisTimestamp: new Date(),
      behavioralPatterns: [],
      temporalPatterns: [],
      contextualPatterns: [],
      satisfactionTrends: [],
      learningEffectiveness: {
        overallEffectiveness: 0,
        personalizationAccuracy: 0,
        adaptationSpeed: 0,
        userEngagement: 0,
        retentionRate: 0
      }
    };
  }

  private analyzeBehavioralPatterns(feedbackList: UserFeedback[]): BehavioralFeedbackPattern[] {
    const patterns = new Map<string, {
      count: number;
      totalSatisfaction: number;
      contexts: Set<string>;
      improvements: Set<string>;
    }>();

    feedbackList.forEach(feedback => {
      const patternKey = `${feedback.type}_${feedback.source}`;
      const existing = patterns.get(patternKey) || {
        count: 0,
        totalSatisfaction: 0,
        contexts: new Set(),
        improvements: new Set()
      };

      existing.count++;
      existing.totalSatisfaction += feedback.rating.overall;
      existing.contexts.add(feedback.context.interactionType);
      feedback.improvementSuggestions.forEach(suggestion => 
        existing.improvements.add(suggestion)
      );

      patterns.set(patternKey, existing);
    });

    return Array.from(patterns.entries()).map(([patternType, data]) => ({
      patternType,
      frequency: data.count,
      averageSatisfaction: data.totalSatisfaction / data.count,
      commonContexts: Array.from(data.contexts).slice(0, 5),
      improvementOpportunities: Array.from(data.improvements).slice(0, 3)
    }));
  }

  private analyzeTemporalPatterns(feedbackList: UserFeedback[]): TemporalFeedbackPattern[] {
    const temporalMap = new Map<string, {
      count: number;
      totalSatisfaction: number;
      issues: Set<string>;
    }>();

    feedbackList.forEach(feedback => {
      const hour = feedback.timestamp.getHours();
      const dayOfWeek = feedback.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      const timeOfDay = this.getTimeOfDayCategory(hour);
      const key = `${timeOfDay}_${dayOfWeek}`;

      const existing = temporalMap.get(key) || {
        count: 0,
        totalSatisfaction: 0,
        issues: new Set()
      };

      existing.count++;
      existing.totalSatisfaction += feedback.rating.overall;
      
      if (feedback.rating.overall <= 2) {
        feedback.improvementSuggestions.forEach(issue => existing.issues.add(issue));
      }

      temporalMap.set(key, existing);
    });

    return Array.from(temporalMap.entries()).map(([key, data]) => {
      const [timeOfDay, dayOfWeek] = key.split('_');
      return {
        timeOfDay,
        dayOfWeek,
        averageSatisfaction: data.totalSatisfaction / data.count,
        feedbackVolume: data.count,
        commonIssues: Array.from(data.issues).slice(0, 3)
      };
    });
  }

  private analyzeContextualPatterns(feedbackList: UserFeedback[]): ContextualFeedbackPattern[] {
    const contextMap = new Map<string, {
      count: number;
      totalSatisfaction: number;
      successFactors: Set<string>;
      challenges: Set<string>;
    }>();

    feedbackList.forEach(feedback => {
      const context = feedback.context.systemComponent;
      const existing = contextMap.get(context) || {
        count: 0,
        totalSatisfaction: 0,
        successFactors: new Set(),
        challenges: new Set()
      };

      existing.count++;
      existing.totalSatisfaction += feedback.rating.overall;

      if (feedback.rating.overall >= 4) {
        if (feedback.specificFeedback.accuracy?.wasAccurate) {
          existing.successFactors.add('accurate_responses');
        }
        if (feedback.specificFeedback.personalization?.wasPersonalized) {
          existing.successFactors.add('good_personalization');
        }
      } else if (feedback.rating.overall <= 2) {
        feedback.improvementSuggestions.forEach(challenge => 
          existing.challenges.add(challenge)
        );
      }

      contextMap.set(context, existing);
    });

    return Array.from(contextMap.entries()).map(([context, data]) => ({
      context,
      satisfactionLevel: data.totalSatisfaction / data.count,
      feedbackCount: data.count,
      successFactors: Array.from(data.successFactors).slice(0, 3),
      challengeAreas: Array.from(data.challenges).slice(0, 3)
    }));
  }

  private analyzeSatisfactionTrends(feedbackList: UserFeedback[]): SatisfactionTrend[] {
    const trends = analyzeFeedbackTrends(feedbackList);
    return trends.map(trend => ({
      metric: trend.metric,
      trend: trend.direction,
      changeRate: trend.magnitude,
      confidence: this.calculateTrendConfidence(feedbackList.length),
      timeframe: trend.timeframe
    }));
  }

  private calculateLearningEffectiveness(feedbackList: UserFeedback[]): LearningEffectivenessMetrics {
    if (feedbackList.length === 0) {
      return {
        overallEffectiveness: 0,
        personalizationAccuracy: 0,
        adaptationSpeed: 0,
        userEngagement: 0,
        retentionRate: 0
      };
    }

    const recentFeedback = feedbackList.slice(-20); // Last 20 feedback items
    const overallSatisfaction = recentFeedback.reduce((sum, f) => sum + f.rating.overall, 0) / recentFeedback.length;
    
    const personalizationAccuracy = recentFeedback
      .filter(f => f.specificFeedback.personalization)
      .reduce((sum, f) => sum + (f.specificFeedback.personalization!.wasPersonalized ? 1 : 0), 0) / recentFeedback.length;

    const adaptationSpeed = this.calculateAdaptationSpeed(feedbackList);
    const userEngagement = this.calculateUserEngagement(feedbackList);
    const retentionRate = this.calculateRetentionRate(feedbackList);

    return {
      overallEffectiveness: overallSatisfaction / 5, // Normalize to 0-1
      personalizationAccuracy,
      adaptationSpeed,
      userEngagement,
      retentionRate
    };
  }

  private determineLearningApproach(analysis: FeedbackPatternAnalysis, feedbackList: UserFeedback[]): LearningApproach {
    const avgSatisfaction = feedbackList.reduce((sum, f) => sum + f.rating.overall, 0) / feedbackList.length;
    const feedbackVolume = feedbackList.length;
    
    let type: 'conservative' | 'moderate' | 'aggressive';
    let learningRate: number;
    let explorationRate: number;

    if (avgSatisfaction >= 4 && feedbackVolume > 50) {
      type = 'aggressive';
      learningRate = 0.1;
      explorationRate = 0.3;
    } else if (avgSatisfaction >= 3 && feedbackVolume > 20) {
      type = 'moderate';
      learningRate = 0.05;
      explorationRate = 0.2;
    } else {
      type = 'conservative';
      learningRate = 0.02;
      explorationRate = 0.1;
    }

    return {
      type,
      learningRate,
      explorationRate,
      memoryRetention: 0.9,
      adaptationThreshold: 0.7
    };
  }

  private calculatePersonalizationLevel(analysis: FeedbackPatternAnalysis): PersonalizationLevel {
    const effectiveness = analysis.learningEffectiveness;
    
    return {
      conversational: Math.min(effectiveness.personalizationAccuracy * 1.2, 1.0),
      behavioral: Math.min(effectiveness.adaptationSpeed * 1.1, 1.0),
      contextual: Math.min(effectiveness.userEngagement * 1.0, 1.0),
      temporal: Math.min(effectiveness.retentionRate * 0.9, 1.0),
      overall: effectiveness.overallEffectiveness
    };
  }

  private calculateAdaptationParameters(analysis: FeedbackPatternAnalysis): AdaptationParameters {
    const effectiveness = analysis.learningEffectiveness;
    
    return {
      responseTimeWeight: 0.2,
      accuracyWeight: 0.3 + (effectiveness.personalizationAccuracy * 0.2),
      satisfactionWeight: 0.3 + (effectiveness.overallEffectiveness * 0.1),
      engagementWeight: 0.15 + (effectiveness.userEngagement * 0.1),
      safetyWeight: 0.05 // Always maintain minimum safety weight
    };
  }

  private calculateFeedbackSensitivity(feedbackList: UserFeedback[]): FeedbackSensitivity {
    const positiveFeedback = feedbackList.filter(f => f.rating.overall >= 4).length;
    const negativeFeedback = feedbackList.filter(f => f.rating.overall <= 2).length;
    const neutralFeedback = feedbackList.filter(f => f.rating.overall === 3).length;
    const total = feedbackList.length || 1;

    return {
      positiveReinforcement: Math.min(positiveFeedback / total + 0.3, 1.0),
      negativeCorrection: Math.min(negativeFeedback / total + 0.5, 1.0),
      neutralAdjustment: Math.min(neutralFeedback / total + 0.2, 1.0),
      implicitSignals: 0.4
    };
  }

  private determineSafetyConstraints(userId: string, feedbackList: UserFeedback[]): SafetyConstraints {
    // This would typically check user profile for age, but for now use conservative defaults
    return {
      childSafetyLevel: 0.9, // High safety level
      parentalApprovalRequired: true,
      contentFilterStrength: 0.8,
      privacyProtectionLevel: 0.9
    };
  }

  private adjustParametersBasedOnFeedback(
    currentParams: AdaptationParameters,
    feedback: UserFeedback
  ): AdaptationParameters {
    const adjustment = 0.05; // Small adjustment factor
    const newParams = { ...currentParams };

    if (feedback.rating.overall <= 2) {
      // Negative feedback - increase safety and accuracy weights
      newParams.safetyWeight = Math.min(newParams.safetyWeight + adjustment, 0.3);
      newParams.accuracyWeight = Math.min(newParams.accuracyWeight + adjustment, 0.5);
    } else if (feedback.rating.overall >= 4) {
      // Positive feedback - can slightly increase engagement weight
      newParams.engagementWeight = Math.min(newParams.engagementWeight + adjustment * 0.5, 0.3);
    }

    // Normalize weights to sum to 1
    const total = Object.values(newParams).reduce((sum, val) => sum + val, 0);
    Object.keys(newParams).forEach(key => {
      (newParams as any)[key] = (newParams as any)[key] / total;
    });

    return newParams;
  }

  private determineUpdateReason(feedback: UserFeedback): string {
    if (feedback.rating.overall <= 2) {
      return `Low satisfaction feedback (${feedback.rating.overall}/5) - adjusting for safety and accuracy`;
    } else if (feedback.rating.overall >= 4) {
      return `Positive feedback (${feedback.rating.overall}/5) - optimizing for engagement`;
    } else {
      return `Neutral feedback (${feedback.rating.overall}/5) - minor parameter adjustment`;
    }
  }

  // Child safety validation methods
  private containsInappropriateContent(feedback: UserFeedback): boolean {
    const inappropriateKeywords = ['violence', 'adult', 'inappropriate', 'unsafe'];
    const feedbackText = JSON.stringify(feedback).toLowerCase();
    return inappropriateKeywords.some(keyword => feedbackText.includes(keyword));
  }

  private isContextChildSafe(context: FeedbackContext): boolean {
    // Check if interaction type is appropriate for children
    const childSafeInteractions = ['conversation', 'learning', 'game', 'story', 'help'];
    return childSafeInteractions.includes(context.interactionType.toLowerCase());
  }

  private isFeedbackTypeChildSafe(type: FeedbackType): boolean {
    // All current feedback types are considered child-safe
    return true;
  }

  private areImprovementSuggestionsChildSafe(suggestions: string[]): boolean {
    const inappropriateTerms = ['delete', 'remove', 'disable', 'adult'];
    return !suggestions.some(suggestion => 
      inappropriateTerms.some(term => suggestion.toLowerCase().includes(term))
    );
  }

  // Metrics calculation methods
  private createEmptyPersonalizationMetrics(userId: string): PersonalizationMetrics {
    const now = new Date();
    return {
      userId,
      measurementPeriod: { start: now, end: now },
      overallEffectiveness: 0,
      accuracyImprovement: 0,
      satisfactionImprovement: 0,
      engagementIncrease: 0,
      personalizationCoverage: 0,
      adaptationSuccessRate: 0
    };
  }

  private calculateMeasurementPeriod(feedbackList: UserFeedback[]): TimeRange {
    const timestamps = feedbackList.map(f => f.timestamp);
    return {
      start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      end: new Date(Math.max(...timestamps.map(t => t.getTime())))
    };
  }

  private calculateOverallEffectiveness(feedbackList: UserFeedback[]): number {
    const recentFeedback = feedbackList.slice(-20);
    const avgSatisfaction = recentFeedback.reduce((sum, f) => sum + f.rating.overall, 0) / recentFeedback.length;
    return avgSatisfaction / 5; // Normalize to 0-1
  }

  private calculateAccuracyImprovement(feedbackList: UserFeedback[]): number {
    if (feedbackList.length < 10) return 0;
    
    const early = feedbackList.slice(0, Math.floor(feedbackList.length / 2));
    const recent = feedbackList.slice(Math.floor(feedbackList.length / 2));
    
    const earlyAccuracy = early.reduce((sum, f) => sum + f.rating.accuracy, 0) / early.length;
    const recentAccuracy = recent.reduce((sum, f) => sum + f.rating.accuracy, 0) / recent.length;
    
    return Math.max(0, (recentAccuracy - earlyAccuracy) / 5); // Normalize improvement
  }

  private calculateSatisfactionImprovement(feedbackList: UserFeedback[]): number {
    if (feedbackList.length < 10) return 0;
    
    const early = feedbackList.slice(0, Math.floor(feedbackList.length / 2));
    const recent = feedbackList.slice(Math.floor(feedbackList.length / 2));
    
    const earlySatisfaction = early.reduce((sum, f) => sum + f.rating.overall, 0) / early.length;
    const recentSatisfaction = recent.reduce((sum, f) => sum + f.rating.overall, 0) / recent.length;
    
    return Math.max(0, (recentSatisfaction - earlySatisfaction) / 5);
  }

  private calculateEngagementIncrease(feedbackList: UserFeedback[]): number {
    // Calculate based on feedback frequency and helpfulness ratings
    const recentFeedback = feedbackList.slice(-10);
    const avgHelpfulness = recentFeedback.reduce((sum, f) => sum + f.rating.helpfulness, 0) / recentFeedback.length;
    return avgHelpfulness / 5; // Normalize to 0-1
  }

  private calculatePersonalizationCoverage(feedbackList: UserFeedback[]): number {
    const personalizedFeedback = feedbackList.filter(f => 
      f.specificFeedback.personalization?.wasPersonalized
    );
    return personalizedFeedback.length / feedbackList.length;
  }

  private calculateAdaptationSuccessRate(feedbackList: UserFeedback[]): number {
    const adaptationFeedback = feedbackList.filter(f => 
      f.type === FeedbackType.BEHAVIOR_ADJUSTMENT || f.type === FeedbackType.PREFERENCE_CORRECTION
    );
    const successfulAdaptations = adaptationFeedback.filter(f => f.rating.overall >= 4);
    return adaptationFeedback.length > 0 ? successfulAdaptations.length / adaptationFeedback.length : 0;
  }

  // Utility methods
  private getTimeOfDayCategory(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private calculateTrendConfidence(sampleSize: number): number {
    if (sampleSize < 5) return 0.2;
    if (sampleSize < 10) return 0.5;
    if (sampleSize < 20) return 0.7;
    return 0.9;
  }

  private calculateAdaptationSpeed(feedbackList: UserFeedback[]): number {
    // Measure how quickly the system adapts based on feedback frequency and improvement
    const recentFeedback = feedbackList.slice(-10);
    const feedbackFrequency = recentFeedback.length / 10; // Normalize to expected frequency
    return Math.min(feedbackFrequency, 1.0);
  }

  private calculateUserEngagement(feedbackList: UserFeedback[]): number {
    // Calculate engagement based on feedback volume and detail
    const detailedFeedback = feedbackList.filter(f => 
      f.improvementSuggestions.length > 0 || 
      f.specificFeedback.satisfaction.satisfactionLevel >= 4
    );
    return detailedFeedback.length / feedbackList.length;
  }

  private calculateRetentionRate(feedbackList: UserFeedback[]): number {
    // Calculate retention based on consistent feedback over time
    if (feedbackList.length < 5) return 0;
    
    const timeSpan = feedbackList[feedbackList.length - 1].timestamp.getTime() - 
                    feedbackList[0].timestamp.getTime();
    const days = timeSpan / (1000 * 60 * 60 * 24);
    const expectedFeedback = Math.max(1, days / 7); // Expected weekly feedback
    
    return Math.min(feedbackList.length / expectedFeedback, 1.0);
  }
}

// Supporting interfaces
export interface FeedbackProcessingResult {
  processed: boolean;
  feedbackCount: number;
  insights: FeedbackInsights;
  recommendations: FeedbackRecommendation[];
}

export interface FeedbackInsights {
  overallSatisfaction: number;
  commonIssues: FeedbackIssue[];
  improvementAreas: ImprovementArea[];
  positivePatterns: PositivePattern[];
}

export interface FeedbackIssue {
  issue: string;
  frequency: number;
}

export interface ImprovementArea {
  area: string;
  frequency: number;
}

export interface PositivePattern {
  pattern: string;
  frequency: number;
}

export interface FeedbackRecommendation {
  type: string;
  priority: 'low' | 'medium' | 'high';
  description: string;
  actions: string[];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// Enhanced feedback analysis interfaces
export interface FeedbackPatternAnalysis {
  userId: string;
  analysisTimestamp: Date;
  behavioralPatterns: BehavioralFeedbackPattern[];
  temporalPatterns: TemporalFeedbackPattern[];
  contextualPatterns: ContextualFeedbackPattern[];
  satisfactionTrends: SatisfactionTrend[];
  learningEffectiveness: LearningEffectivenessMetrics;
}

export interface BehavioralFeedbackPattern {
  patternType: string;
  frequency: number;
  averageSatisfaction: number;
  commonContexts: string[];
  improvementOpportunities: string[];
}

export interface TemporalFeedbackPattern {
  timeOfDay: string;
  dayOfWeek: string;
  averageSatisfaction: number;
  feedbackVolume: number;
  commonIssues: string[];
}

export interface ContextualFeedbackPattern {
  context: string;
  satisfactionLevel: number;
  feedbackCount: number;
  successFactors: string[];
  challengeAreas: string[];
}

export interface SatisfactionTrend {
  metric: string;
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number;
  confidence: number;
  timeframe: string;
}

export interface LearningEffectivenessMetrics {
  overallEffectiveness: number;
  personalizationAccuracy: number;
  adaptationSpeed: number;
  userEngagement: number;
  retentionRate: number;
}

export interface AdaptiveLearningStrategy {
  userId: string;
  strategyId: string;
  createdAt: Date;
  learningApproach: LearningApproach;
  personalizationLevel: PersonalizationLevel;
  adaptationParameters: AdaptationParameters;
  feedbackSensitivity: FeedbackSensitivity;
  safetyConstraints: SafetyConstraints;
}

export interface LearningApproach {
  type: 'conservative' | 'moderate' | 'aggressive';
  learningRate: number;
  explorationRate: number;
  memoryRetention: number;
  adaptationThreshold: number;
}

export interface PersonalizationLevel {
  conversational: number; // 0-1 scale
  behavioral: number;
  contextual: number;
  temporal: number;
  overall: number;
}

export interface AdaptationParameters {
  responseTimeWeight: number;
  accuracyWeight: number;
  satisfactionWeight: number;
  engagementWeight: number;
  safetyWeight: number;
}

export interface FeedbackSensitivity {
  positiveReinforcement: number;
  negativeCorrection: number;
  neutralAdjustment: number;
  implicitSignals: number;
}

export interface SafetyConstraints {
  childSafetyLevel: number;
  parentalApprovalRequired: boolean;
  contentFilterStrength: number;
  privacyProtectionLevel: number;
}

export interface LearningParameterUpdate {
  updated: boolean;
  previousParameters: AdaptationParameters;
  newParameters: AdaptationParameters;
  updateReason: string;
  effectiveDate: Date;
  rollbackAvailable: boolean;
}

export interface PersonalizationMetrics {
  userId: string;
  measurementPeriod: TimeRange;
  overallEffectiveness: number;
  accuracyImprovement: number;
  satisfactionImprovement: number;
  engagementIncrease: number;
  personalizationCoverage: number;
  adaptationSuccessRate: number;
}

// Feedback analysis utilities
export function analyzeFeedbackTrends(feedbackHistory: UserFeedback[]): FeedbackTrend[] {
  if (feedbackHistory.length < 2) {
    return [];
  }

  // Sort by timestamp
  const sortedFeedback = [...feedbackHistory].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  const trends: FeedbackTrend[] = [];

  // Analyze satisfaction trend
  const satisfactionTrend = calculateTrend(
    sortedFeedback.map(f => f.rating.overall)
  );
  
  trends.push({
    metric: 'overall_satisfaction',
    direction: satisfactionTrend > 0 ? 'improving' : satisfactionTrend < 0 ? 'declining' : 'stable',
    magnitude: Math.abs(satisfactionTrend),
    timeframe: 'recent'
  });

  // Analyze accuracy trend
  const accuracyTrend = calculateTrend(
    sortedFeedback.map(f => f.rating.accuracy)
  );
  
  trends.push({
    metric: 'accuracy',
    direction: accuracyTrend > 0 ? 'improving' : accuracyTrend < 0 ? 'declining' : 'stable',
    magnitude: Math.abs(accuracyTrend),
    timeframe: 'recent'
  });

  // Analyze helpfulness trend
  const helpfulnessTrend = calculateTrend(
    sortedFeedback.map(f => f.rating.helpfulness)
  );
  
  trends.push({
    metric: 'helpfulness',
    direction: helpfulnessTrend > 0 ? 'improving' : helpfulnessTrend < 0 ? 'declining' : 'stable',
    magnitude: Math.abs(helpfulnessTrend),
    timeframe: 'recent'
  });

  return trends;
}

export interface FeedbackTrend {
  metric: string;
  direction: 'improving' | 'declining' | 'stable';
  magnitude: number;
  timeframe: string;
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = values.reduce((sum, val, index) => sum + (index * val), 0);
  const sumX2 = values.reduce((sum, _, index) => sum + (index * index), 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}

// Feedback aggregation utilities
export function aggregateFeedbackByType(feedbackList: UserFeedback[]): Map<FeedbackType, UserFeedback[]> {
  const aggregation = new Map<FeedbackType, UserFeedback[]>();

  feedbackList.forEach(feedback => {
    const existing = aggregation.get(feedback.type) || [];
    existing.push(feedback);
    aggregation.set(feedback.type, existing);
  });

  return aggregation;
}

export function aggregateFeedbackBySource(feedbackList: UserFeedback[]): Map<FeedbackSource, UserFeedback[]> {
  const aggregation = new Map<FeedbackSource, UserFeedback[]>();

  feedbackList.forEach(feedback => {
    const existing = aggregation.get(feedback.source) || [];
    existing.push(feedback);
    aggregation.set(feedback.source, existing);
  });

  return aggregation;
}