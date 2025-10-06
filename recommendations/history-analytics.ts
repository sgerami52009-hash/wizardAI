/**
 * Recommendation History and Analytics System
 * 
 * Implements comprehensive tracking and analytics for recommendation
 * effectiveness, user satisfaction, and system performance with
 * privacy-preserving storage and child safety compliance.
 */

import { 
  Recommendation, 
  UserFeedback, 
  RecommendationHistory, 
  TimeRange, 
  UserInteraction,
  SystemMetrics,
  UserContext
} from './types';
import { RecommendationType, InteractionType, EngagementLevel } from './enums';
import { IPrivacyManager } from './interfaces';

/**
 * Recommendation history entry with analytics data
 */
export interface RecommendationHistoryEntry {
  id: string;
  userId: string;
  recommendation: Recommendation;
  timestamp: Date;
  userFeedback?: UserFeedback;
  interactions: UserInteraction[];
  outcome: RecommendationOutcome;
  analytics: RecommendationAnalytics;
}

/**
 * Recommendation outcome tracking
 */
export interface RecommendationOutcome {
  accepted: boolean;
  completed: boolean;
  completionRate: number; // 0-1 scale
  timeToAction: number; // milliseconds
  userSatisfaction: number; // 0-1 scale
  effectivenessScore: number; // 0-1 scale
}

/**
 * Analytics data for recommendations
 */
export interface RecommendationAnalytics {
  viewCount: number;
  clickCount: number;
  shareCount: number;
  contextAccuracy: number; // 0-1 scale
  relevanceScore: number; // 0-1 scale
  engagementLevel: EngagementLevel;
  conversionRate: number; // 0-1 scale
}

/**
 * Aggregated analytics report
 */
export interface AnalyticsReport {
  timeRange: TimeRange;
  totalRecommendations: number;
  userEngagement: {
    averageSatisfaction: number;
    totalUsers: number;
    activeUsers: number;
    engagementRate: number;
  };
  recommendationEffectiveness: {
    overallAcceptanceRate: number;
    completionRate: number;
    averageRelevanceScore: number;
    typeBreakdown: Record<RecommendationType, EffectivenessMetrics>;
  };
  systemPerformance: {
    averageLatency: number;
    errorRate: number;
    memoryUsage: number;
    throughput: number;
  };
  trends: {
    satisfactionTrend: number[]; // Daily averages
    usageTrend: number[]; // Daily counts
    performanceTrend: number[]; // Daily latency averages
  };
}

/**
 * Effectiveness metrics by recommendation type
 */
export interface EffectivenessMetrics {
  count: number;
  acceptanceRate: number;
  completionRate: number;
  averageSatisfaction: number;
  averageRelevance: number;
}

/**
 * History and analytics manager
 */
export class RecommendationHistoryAnalytics {
  private historyStorage: Map<string, RecommendationHistoryEntry[]> = new Map();
  private analyticsCache: Map<string, AnalyticsReport> = new Map();
  private privacyManager: IPrivacyManager;

  private readonly MAX_HISTORY_ENTRIES = 10000;
  private readonly ANALYTICS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly HISTORY_RETENTION_DAYS = 90;

  constructor(privacyManager: IPrivacyManager) {
    this.privacyManager = privacyManager;
    this.startCleanupScheduler();
  }

  /**
   * Track a recommendation in history
   */
  async trackRecommendation(
    userId: string, 
    recommendation: Recommendation, 
    context: UserContext
  ): Promise<void> {
    try {
      // Validate privacy permissions
      const privacyDecision = await this.privacyManager.enforcePrivacyPreferences(
        userId, 
        { type: 'write', purpose: 'history_tracking' }
      );

      if (!privacyDecision.allowed) {
        return; // Skip tracking if not allowed
      }

      const historyEntry: RecommendationHistoryEntry = {
        id: `${recommendation.id}-${Date.now()}`,
        userId,
        recommendation: privacyDecision.anonymizationRequired ? 
          await this.anonymizeRecommendation(recommendation, userId) : recommendation,
        timestamp: new Date(),
        interactions: [],
        outcome: {
          accepted: false,
          completed: false,
          completionRate: 0,
          timeToAction: 0,
          userSatisfaction: 0,
          effectivenessScore: 0
        },
        analytics: {
          viewCount: 1,
          clickCount: 0,
          shareCount: 0,
          contextAccuracy: this.calculateContextAccuracy(recommendation, context),
          relevanceScore: recommendation.confidence,
          engagementLevel: EngagementLevel.LOW,
          conversionRate: 0
        }
      };

      // Store in user's history
      const userHistory = this.historyStorage.get(userId) || [];
      userHistory.push(historyEntry);

      // Maintain history size limit
      if (userHistory.length > this.MAX_HISTORY_ENTRIES) {
        userHistory.shift();
      }

      this.historyStorage.set(userId, userHistory);

      // Invalidate analytics cache for this user
      this.invalidateAnalyticsCache(userId);

    } catch (error) {
      console.error('Error tracking recommendation:', error);
    }
  }

  /**
   * Update recommendation with user feedback
   */
  async updateRecommendationFeedback(
    userId: string, 
    recommendationId: string, 
    feedback: UserFeedback
  ): Promise<void> {
    try {
      const userHistory = this.historyStorage.get(userId) || [];
      const historyEntry = userHistory.find(entry => 
        entry.recommendation.id === recommendationId
      );

      if (!historyEntry) {
        console.warn(`Recommendation ${recommendationId} not found in history for user ${userId}`);
        return;
      }

      // Update with feedback
      historyEntry.userFeedback = feedback;
      historyEntry.outcome.userSatisfaction = feedback.rating / 5;
      historyEntry.outcome.accepted = feedback.rating >= 3;
      historyEntry.outcome.completed = feedback.completionRate >= 0.8;
      historyEntry.outcome.completionRate = feedback.completionRate;
      historyEntry.outcome.effectivenessScore = this.calculateEffectivenessScore(historyEntry);

      // Update analytics
      historyEntry.analytics.engagementLevel = this.mapRatingToEngagement(feedback.rating);
      historyEntry.analytics.conversionRate = feedback.completionRate;

      // Invalidate analytics cache
      this.invalidateAnalyticsCache(userId);

    } catch (error) {
      console.error('Error updating recommendation feedback:', error);
    }
  }

  /**
   * Track user interaction with recommendation
   */
  async trackInteraction(
    userId: string, 
    recommendationId: string, 
    interaction: UserInteraction
  ): Promise<void> {
    try {
      const userHistory = this.historyStorage.get(userId) || [];
      const historyEntry = userHistory.find(entry => 
        entry.recommendation.id === recommendationId
      );

      if (!historyEntry) {
        return;
      }

      // Add interaction
      historyEntry.interactions.push(interaction);

      // Update analytics based on interaction type
      switch (interaction.interactionType) {
        case InteractionType.VIEW:
          historyEntry.analytics.viewCount++;
          break;
        case InteractionType.CLICK:
          historyEntry.analytics.clickCount++;
          break;
        case InteractionType.SHARE:
          historyEntry.analytics.shareCount++;
          break;
        case InteractionType.ACCEPT:
          historyEntry.outcome.accepted = true;
          historyEntry.outcome.timeToAction = Date.now() - historyEntry.timestamp.getTime();
          break;
      }

      // Update engagement level based on interactions
      historyEntry.analytics.engagementLevel = this.calculateEngagementLevel(historyEntry);

      // Invalidate analytics cache
      this.invalidateAnalyticsCache(userId);

    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  /**
   * Get recommendation history for user
   */
  async getRecommendationHistory(
    userId: string, 
    timeRange: TimeRange
  ): Promise<RecommendationHistory> {
    try {
      // Validate privacy permissions
      const privacyDecision = await this.privacyManager.enforcePrivacyPreferences(
        userId, 
        { type: 'read', purpose: 'history_access' }
      );

      if (!privacyDecision.allowed) {
        return {
          recommendations: [],
          totalCount: 0,
          timeRange,
          privacyFiltered: true
        };
      }

      const userHistory = this.historyStorage.get(userId) || [];
      
      // Filter by time range
      const filteredHistory = userHistory.filter(entry => 
        entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
      );

      // Convert to recommendation history format
      const recommendations = filteredHistory.map(entry => ({
        ...entry.recommendation,
        feedback: entry.userFeedback,
        outcome: entry.outcome,
        analytics: entry.analytics
      }));

      return {
        recommendations,
        totalCount: filteredHistory.length,
        timeRange,
        privacyFiltered: privacyDecision.anonymizationRequired
      };

    } catch (error) {
      console.error('Error getting recommendation history:', error);
      return {
        recommendations: [],
        totalCount: 0,
        timeRange
      };
    }
  }

  /**
   * Generate analytics report
   */
  async generateAnalyticsReport(
    userId?: string, 
    timeRange?: TimeRange
  ): Promise<AnalyticsReport> {
    try {
      const cacheKey = `${userId || 'global'}-${timeRange?.start.getTime() || 'all'}-${timeRange?.end.getTime() || 'all'}`;
      
      // Check cache first
      const cached = this.analyticsCache.get(cacheKey);
      if (cached && this.isCacheValid(cacheKey)) {
        return cached;
      }

      // Generate fresh report
      const report = await this.generateFreshAnalyticsReport(userId, timeRange);
      
      // Cache the report
      this.analyticsCache.set(cacheKey, report);
      
      return report;

    } catch (error) {
      console.error('Error generating analytics report:', error);
      return this.getEmptyAnalyticsReport(timeRange);
    }
  }

  /**
   * Measure recommendation effectiveness
   */
  async measureRecommendationEffectiveness(
    type?: RecommendationType,
    timeRange?: TimeRange
  ): Promise<EffectivenessMetrics> {
    const allEntries = this.getAllHistoryEntries();
    
    let filteredEntries = allEntries;
    
    // Filter by type if specified
    if (type) {
      filteredEntries = filteredEntries.filter(entry => entry.recommendation.type === type);
    }
    
    // Filter by time range if specified
    if (timeRange) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end
      );
    }

    if (filteredEntries.length === 0) {
      return {
        count: 0,
        acceptanceRate: 0,
        completionRate: 0,
        averageSatisfaction: 0,
        averageRelevance: 0
      };
    }

    const acceptedCount = filteredEntries.filter(entry => entry.outcome.accepted).length;
    const completedCount = filteredEntries.filter(entry => entry.outcome.completed).length;
    const totalSatisfaction = filteredEntries.reduce((sum, entry) => sum + entry.outcome.userSatisfaction, 0);
    const totalRelevance = filteredEntries.reduce((sum, entry) => sum + entry.analytics.relevanceScore, 0);

    return {
      count: filteredEntries.length,
      acceptanceRate: acceptedCount / filteredEntries.length,
      completionRate: completedCount / filteredEntries.length,
      averageSatisfaction: totalSatisfaction / filteredEntries.length,
      averageRelevance: totalRelevance / filteredEntries.length
    };
  }

  // Private helper methods

  private async anonymizeRecommendation(recommendation: Recommendation, userId: string): Promise<Recommendation> {
    // Create anonymized version of recommendation
    return {
      ...recommendation,
      title: 'Personalized Recommendation',
      description: 'Content filtered for privacy',
      reasoning: ['Privacy-filtered reasoning'],
      metadata: {
        ...recommendation.metadata,
        privacyCompliant: true
      }
    };
  }

  private calculateContextAccuracy(recommendation: Recommendation, context: UserContext): number {
    // Simple heuristic for context accuracy
    let accuracy = 0.5; // Base accuracy

    // Check time relevance
    if (recommendation.expiresAt && recommendation.expiresAt > new Date()) {
      accuracy += 0.2;
    }

    // Check activity context match
    if (context.activity && recommendation.type === RecommendationType.ACTIVITY) {
      accuracy += 0.2;
    }

    // Check availability match
    if (context.availability && context.availability.available) {
      accuracy += 0.1;
    }

    return Math.min(1.0, accuracy);
  }

  private calculateEffectivenessScore(entry: RecommendationHistoryEntry): number {
    const weights = {
      satisfaction: 0.4,
      completion: 0.3,
      relevance: 0.2,
      engagement: 0.1
    };

    const satisfactionScore = entry.outcome.userSatisfaction;
    const completionScore = entry.outcome.completionRate;
    const relevanceScore = entry.analytics.relevanceScore;
    const engagementScore = this.mapEngagementToScore(entry.analytics.engagementLevel);

    return (
      satisfactionScore * weights.satisfaction +
      completionScore * weights.completion +
      relevanceScore * weights.relevance +
      engagementScore * weights.engagement
    );
  }

  private mapRatingToEngagement(rating: number): EngagementLevel {
    if (rating >= 4) return EngagementLevel.HIGH;
    if (rating >= 3) return EngagementLevel.MEDIUM;
    return EngagementLevel.LOW;
  }

  private calculateEngagementLevel(entry: RecommendationHistoryEntry): EngagementLevel {
    const totalInteractions = entry.analytics.viewCount + entry.analytics.clickCount + entry.analytics.shareCount;
    
    if (totalInteractions >= 5 || entry.analytics.shareCount > 0) {
      return EngagementLevel.HIGH;
    } else if (totalInteractions >= 2 || entry.analytics.clickCount > 0) {
      return EngagementLevel.MEDIUM;
    }
    
    return EngagementLevel.LOW;
  }

  private mapEngagementToScore(engagement: EngagementLevel): number {
    switch (engagement) {
      case EngagementLevel.HIGH: return 1.0;
      case EngagementLevel.MEDIUM: return 0.6;
      case EngagementLevel.LOW: return 0.2;
      default: return 0.0;
    }
  }

  private getAllHistoryEntries(): RecommendationHistoryEntry[] {
    const allEntries: RecommendationHistoryEntry[] = [];
    for (const userHistory of this.historyStorage.values()) {
      allEntries.push(...userHistory);
    }
    return allEntries;
  }

  private async generateFreshAnalyticsReport(userId?: string, timeRange?: TimeRange): Promise<AnalyticsReport> {
    const entries = userId ? 
      (this.historyStorage.get(userId) || []) : 
      this.getAllHistoryEntries();

    const filteredEntries = timeRange ? 
      entries.filter(entry => entry.timestamp >= timeRange.start && entry.timestamp <= timeRange.end) :
      entries;

    const effectiveTimeRange = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };

    return {
      timeRange: effectiveTimeRange,
      totalRecommendations: filteredEntries.length,
      userEngagement: this.calculateUserEngagement(filteredEntries),
      recommendationEffectiveness: await this.calculateRecommendationEffectiveness(filteredEntries),
      systemPerformance: await this.calculateSystemPerformance(),
      trends: this.calculateTrends(filteredEntries, effectiveTimeRange)
    };
  }

  private calculateUserEngagement(entries: RecommendationHistoryEntry[]) {
    const uniqueUsers = new Set(entries.map(entry => entry.userId));
    const activeUsers = new Set(entries.filter(entry => 
      entry.interactions.length > 0 || entry.outcome.accepted
    ).map(entry => entry.userId));

    const totalSatisfaction = entries.reduce((sum, entry) => sum + entry.outcome.userSatisfaction, 0);
    const engagedEntries = entries.filter(entry => entry.analytics.engagementLevel !== EngagementLevel.LOW);

    return {
      averageSatisfaction: entries.length > 0 ? totalSatisfaction / entries.length : 0,
      totalUsers: uniqueUsers.size,
      activeUsers: activeUsers.size,
      engagementRate: entries.length > 0 ? engagedEntries.length / entries.length : 0
    };
  }

  private async calculateRecommendationEffectiveness(entries: RecommendationHistoryEntry[]) {
    const acceptedCount = entries.filter(entry => entry.outcome.accepted).length;
    const completedCount = entries.filter(entry => entry.outcome.completed).length;
    const totalRelevance = entries.reduce((sum, entry) => sum + entry.analytics.relevanceScore, 0);

    // Calculate type breakdown
    const typeBreakdown: Record<RecommendationType, EffectivenessMetrics> = {} as any;
    for (const type of Object.values(RecommendationType)) {
      const typeEntries = entries.filter(entry => entry.recommendation.type === type);
      if (typeEntries.length > 0) {
        typeBreakdown[type] = await this.measureRecommendationEffectiveness(type);
      }
    }

    return {
      overallAcceptanceRate: entries.length > 0 ? acceptedCount / entries.length : 0,
      completionRate: entries.length > 0 ? completedCount / entries.length : 0,
      averageRelevanceScore: entries.length > 0 ? totalRelevance / entries.length : 0,
      typeBreakdown
    };
  }

  private async calculateSystemPerformance() {
    // This would integrate with the performance monitor
    return {
      averageLatency: 1000, // Placeholder
      errorRate: 0.01,
      memoryUsage: 800,
      throughput: 100
    };
  }

  private calculateTrends(entries: RecommendationHistoryEntry[], timeRange: TimeRange) {
    // Calculate daily trends
    const days = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000));
    const satisfactionTrend: number[] = [];
    const usageTrend: number[] = [];
    const performanceTrend: number[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(timeRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayEntries = entries.filter(entry => 
        entry.timestamp >= dayStart && entry.timestamp < dayEnd
      );

      // Satisfaction trend
      const daySatisfaction = dayEntries.length > 0 ? 
        dayEntries.reduce((sum, entry) => sum + entry.outcome.userSatisfaction, 0) / dayEntries.length : 0;
      satisfactionTrend.push(daySatisfaction);

      // Usage trend
      usageTrend.push(dayEntries.length);

      // Performance trend (placeholder)
      performanceTrend.push(1000 + Math.random() * 500);
    }

    return {
      satisfactionTrend,
      usageTrend,
      performanceTrend
    };
  }

  private getEmptyAnalyticsReport(timeRange?: TimeRange): AnalyticsReport {
    const effectiveTimeRange = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    };

    return {
      timeRange: effectiveTimeRange,
      totalRecommendations: 0,
      userEngagement: {
        averageSatisfaction: 0,
        totalUsers: 0,
        activeUsers: 0,
        engagementRate: 0
      },
      recommendationEffectiveness: {
        overallAcceptanceRate: 0,
        completionRate: 0,
        averageRelevanceScore: 0,
        typeBreakdown: {} as any
      },
      systemPerformance: {
        averageLatency: 0,
        errorRate: 0,
        memoryUsage: 0,
        throughput: 0
      },
      trends: {
        satisfactionTrend: [],
        usageTrend: [],
        performanceTrend: []
      }
    };
  }

  private invalidateAnalyticsCache(userId: string): void {
    // Remove cache entries for this user
    for (const key of this.analyticsCache.keys()) {
      if (key.startsWith(userId) || key.startsWith('global')) {
        this.analyticsCache.delete(key);
      }
    }
  }

  private isCacheValid(cacheKey: string): boolean {
    // Simple cache validation - in real implementation would track cache timestamps
    return this.analyticsCache.has(cacheKey);
  }

  private startCleanupScheduler(): void {
    // Clean up old history entries periodically
    setInterval(() => {
      const cutoffDate = new Date(Date.now() - this.HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      
      for (const [userId, history] of this.historyStorage.entries()) {
        const filteredHistory = history.filter(entry => entry.timestamp > cutoffDate);
        if (filteredHistory.length !== history.length) {
          this.historyStorage.set(userId, filteredHistory);
        }
      }

      // Clean up analytics cache
      this.analyticsCache.clear();
      
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
}

// Export singleton instance (would be properly injected in real implementation)
export const recommendationHistoryAnalytics = new RecommendationHistoryAnalytics(
  {} as IPrivacyManager // Placeholder - would be properly injected
);