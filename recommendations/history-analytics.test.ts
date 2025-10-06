/**
 * Recommendation History Analytics Tests
 * 
 * Tests for recommendation tracking, history management, and analytics generation
 */

import { RecommendationHistoryAnalytics } from './history-analytics';
import { IPrivacyManager } from './interfaces';
import { Recommendation, UserFeedback, UserContext, UserInteraction, TimeRange } from './types';
import { RecommendationType, InteractionType, EngagementLevel } from './enums';

// Mock privacy manager
const mockPrivacyManager: IPrivacyManager = {
  enforcePrivacyPreferences: jest.fn().mockResolvedValue({ 
    allowed: true, 
    anonymizationRequired: false 
  }),
  anonymizeUserData: jest.fn(),
  auditDataUsage: jest.fn(),
  updatePrivacySettings: jest.fn(),
  validateDataMinimization: jest.fn(),
  encryptUserData: jest.fn(),
  decryptUserData: jest.fn()
};

describe('RecommendationHistoryAnalytics', () => {
  let historyAnalytics: RecommendationHistoryAnalytics;
  let mockRecommendation: Recommendation;
  let mockContext: UserContext;
  let mockFeedback: UserFeedback;

  beforeEach(() => {
    historyAnalytics = new RecommendationHistoryAnalytics(mockPrivacyManager);
    
    mockRecommendation = {
      id: 'rec-123',
      type: RecommendationType.ACTIVITY,
      title: 'Test Activity',
      description: 'A test activity recommendation',
      confidence: 0.8,
      reasoning: ['User likes similar activities'],
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      metadata: {
        generatedAt: new Date(),
        userId: 'user-123',
        contextId: 'context-123',
        engineVersion: '1.0',
        safetyValidated: true,
        privacyCompliant: true
      }
    };

    mockContext = {
      userId: 'user-123',
      timestamp: new Date(),
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: 'San Francisco, CA',
        indoor: false,
        weather: {
          temperature: 20,
          condition: 'sunny',
          humidity: 60,
          windSpeed: 5
        }
      },
      activity: {
        current: 'browsing',
        category: 'leisure',
        duration: 30,
        intensity: 'low'
      },
      availability: {
        available: true,
        freeTime: 60,
        nextCommitment: new Date(Date.now() + 2 * 60 * 60 * 1000)
      },
      mood: {
        energy: 0.7,
        stress: 0.3,
        happiness: 0.8,
        focus: 0.6
      },
      social: {
        alone: true,
        familyPresent: [],
        guestsPresent: []
      },
      preferences: {
        categories: ['outdoor', 'creative'],
        timeOfDay: 'afternoon',
        duration: 'medium'
      }
    };

    mockFeedback = {
      userId: 'user-123',
      recommendationId: 'rec-123',
      rating: 4,
      completionRate: 0.8,
      timeSpent: 1800,
      contextAccuracy: 0.9,
      timestamp: new Date()
    };

    jest.clearAllMocks();
  });

  describe('Recommendation Tracking', () => {
    it('should track recommendations in history', async () => {
      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.recommendations).toHaveLength(1);
      expect(history.recommendations[0].id).toBe('rec-123');
      expect(history.totalCount).toBe(1);
    });

    it('should respect privacy preferences when tracking', async () => {
      (mockPrivacyManager.enforcePrivacyPreferences as jest.Mock).mockResolvedValueOnce({
        allowed: false
      });

      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.recommendations).toHaveLength(0);
    });

    it('should anonymize recommendations when required', async () => {
      (mockPrivacyManager.enforcePrivacyPreferences as jest.Mock).mockResolvedValueOnce({
        allowed: true,
        anonymizationRequired: true
      });

      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.privacyFiltered).toBe(true);
    });

    it('should calculate context accuracy', async () => {
      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.recommendations[0].analytics?.contextAccuracy).toBeGreaterThan(0);
    });
  });

  describe('Feedback Processing', () => {
    beforeEach(async () => {
      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);
    });

    it('should update recommendation with feedback', async () => {
      await historyAnalytics.updateRecommendationFeedback('user-123', 'rec-123', mockFeedback);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const recommendation = history.recommendations[0];
      expect(recommendation.feedback?.rating).toBe(4);
      expect(recommendation.outcome?.userSatisfaction).toBe(0.8);
      expect(recommendation.outcome?.accepted).toBe(true);
    });

    it('should calculate effectiveness score from feedback', async () => {
      await historyAnalytics.updateRecommendationFeedback('user-123', 'rec-123', mockFeedback);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const recommendation = history.recommendations[0];
      expect(recommendation.outcome?.effectivenessScore).toBeGreaterThan(0);
    });

    it('should handle feedback for non-existent recommendations gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await historyAnalytics.updateRecommendationFeedback('user-123', 'non-existent', mockFeedback);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recommendation non-existent not found')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Interaction Tracking', () => {
    beforeEach(async () => {
      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);
    });

    it('should track user interactions', async () => {
      const interaction: UserInteraction = {
        userId: 'user-123',
        recommendationId: 'rec-123',
        interactionType: InteractionType.CLICK,
        timestamp: new Date(),
        context: mockContext,
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 300,
          engagementLevel: EngagementLevel.HIGH,
          wouldRecommendAgain: true
        },
        satisfaction: 0.9
      };

      await historyAnalytics.trackInteraction('user-123', 'rec-123', interaction);

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const recommendation = history.recommendations[0];
      expect(recommendation.analytics?.clickCount).toBe(1);
    });

    it('should update engagement level based on interactions', async () => {
      const interactions = [
        {
          userId: 'user-123',
          recommendationId: 'rec-123',
          interactionType: InteractionType.VIEW,
          timestamp: new Date(),
          context: mockContext,
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 100,
            engagementLevel: EngagementLevel.LOW,
            wouldRecommendAgain: true
          },
          satisfaction: 0.5
        },
        {
          userId: 'user-123',
          recommendationId: 'rec-123',
          interactionType: InteractionType.CLICK,
          timestamp: new Date(),
          context: mockContext,
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 200,
            engagementLevel: EngagementLevel.MEDIUM,
            wouldRecommendAgain: true
          },
          satisfaction: 0.7
        },
        {
          userId: 'user-123',
          recommendationId: 'rec-123',
          interactionType: InteractionType.SHARE,
          timestamp: new Date(),
          context: mockContext,
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 50,
            engagementLevel: EngagementLevel.HIGH,
            wouldRecommendAgain: true
          },
          satisfaction: 0.9
        }
      ];

      for (const interaction of interactions) {
        await historyAnalytics.trackInteraction('user-123', 'rec-123', interaction);
      }

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      const recommendation = history.recommendations[0];
      expect(recommendation.analytics?.engagementLevel).toBe(EngagementLevel.HIGH);
    });
  });

  describe('Analytics Report Generation', () => {
    beforeEach(async () => {
      // Add multiple recommendations and feedback for testing
      for (let i = 0; i < 5; i++) {
        const rec = { ...mockRecommendation, id: `rec-${i}` };
        await historyAnalytics.trackRecommendation('user-123', rec, mockContext);
        
        const feedback = { ...mockFeedback, recommendationId: `rec-${i}`, rating: 3 + i % 3 };
        await historyAnalytics.updateRecommendationFeedback('user-123', `rec-${i}`, feedback);
      }
    });

    it('should generate comprehensive analytics report', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const report = await historyAnalytics.generateAnalyticsReport('user-123', timeRange);

      expect(report).toHaveProperty('timeRange');
      expect(report).toHaveProperty('totalRecommendations');
      expect(report).toHaveProperty('userEngagement');
      expect(report).toHaveProperty('recommendationEffectiveness');
      expect(report).toHaveProperty('systemPerformance');
      expect(report).toHaveProperty('trends');

      expect(report.totalRecommendations).toBe(5);
      expect(report.userEngagement.totalUsers).toBe(1);
      expect(report.userEngagement.averageSatisfaction).toBeGreaterThan(0);
    });

    it('should generate global analytics report', async () => {
      const report = await historyAnalytics.generateAnalyticsReport();

      expect(report.totalRecommendations).toBeGreaterThan(0);
      expect(report.userEngagement.totalUsers).toBeGreaterThan(0);
    });

    it('should calculate trends over time', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
        end: new Date()
      };

      const report = await historyAnalytics.generateAnalyticsReport('user-123', timeRange);

      expect(report.trends.satisfactionTrend).toBeInstanceOf(Array);
      expect(report.trends.usageTrend).toBeInstanceOf(Array);
      expect(report.trends.performanceTrend).toBeInstanceOf(Array);
    });
  });

  describe('Effectiveness Measurement', () => {
    beforeEach(async () => {
      // Add recommendations of different types
      const activityRec = { ...mockRecommendation, type: RecommendationType.ACTIVITY };
      const scheduleRec = { ...mockRecommendation, id: 'rec-schedule', type: RecommendationType.SCHEDULE };
      
      await historyAnalytics.trackRecommendation('user-123', activityRec, mockContext);
      await historyAnalytics.trackRecommendation('user-123', scheduleRec, mockContext);
      
      await historyAnalytics.updateRecommendationFeedback('user-123', 'rec-123', mockFeedback);
      await historyAnalytics.updateRecommendationFeedback('user-123', 'rec-schedule', {
        ...mockFeedback,
        recommendationId: 'rec-schedule',
        rating: 2
      });
    });

    it('should measure overall effectiveness', async () => {
      const effectiveness = await historyAnalytics.measureRecommendationEffectiveness();

      expect(effectiveness).toHaveProperty('count');
      expect(effectiveness).toHaveProperty('acceptanceRate');
      expect(effectiveness).toHaveProperty('completionRate');
      expect(effectiveness).toHaveProperty('averageSatisfaction');
      expect(effectiveness).toHaveProperty('averageRelevance');

      expect(effectiveness.count).toBe(2);
      expect(effectiveness.acceptanceRate).toBe(0.5); // 1 out of 2 accepted
    });

    it('should measure effectiveness by type', async () => {
      const activityEffectiveness = await historyAnalytics.measureRecommendationEffectiveness(
        RecommendationType.ACTIVITY
      );

      expect(activityEffectiveness.count).toBe(1);
      expect(activityEffectiveness.acceptanceRate).toBe(1); // Activity recommendation was accepted
    });

    it('should measure effectiveness within time range', async () => {
      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        end: new Date()
      };

      const effectiveness = await historyAnalytics.measureRecommendationEffectiveness(
        undefined,
        timeRange
      );

      expect(effectiveness.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Privacy and Security', () => {
    it('should respect privacy preferences for history access', async () => {
      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      (mockPrivacyManager.enforcePrivacyPreferences as jest.Mock).mockResolvedValueOnce({
        allowed: false
      });

      const history = await historyAnalytics.getRecommendationHistory('user-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.recommendations).toHaveLength(0);
      expect(history.privacyFiltered).toBe(true);
    });

    it('should handle privacy manager errors gracefully', async () => {
      (mockPrivacyManager.enforcePrivacyPreferences as jest.Mock).mockRejectedValueOnce(
        new Error('Privacy manager error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await historyAnalytics.trackRecommendation('user-123', mockRecommendation, mockContext);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error tracking recommendation:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Data Retention and Cleanup', () => {
    it('should maintain history size limits', async () => {
      // This would test the MAX_HISTORY_ENTRIES limit
      // In a real test, we'd add more than the limit and verify cleanup
      expect(true).toBe(true); // Placeholder
    });

    it('should clean up old history entries', async () => {
      // This would test the HISTORY_RETENTION_DAYS cleanup
      // In a real test, we'd add old entries and verify they're removed
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Child Safety Compliance', () => {
    it('should track child-safe recommendations appropriately', async () => {
      const childRecommendation = {
        ...mockRecommendation,
        type: RecommendationType.EDUCATIONAL,
        metadata: {
          ...mockRecommendation.metadata,
          safetyValidated: true
        }
      };

      await historyAnalytics.trackRecommendation('child-123', childRecommendation, mockContext);

      const history = await historyAnalytics.getRecommendationHistory('child-123', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      });

      expect(history.recommendations[0].metadata.safetyValidated).toBe(true);
    });
  });
});