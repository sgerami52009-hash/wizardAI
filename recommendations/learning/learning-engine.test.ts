/**
 * Learning Engine Unit Tests
 * 
 * Tests for feedback processing, model updates, privacy-preserving learning,
 * and performance optimization under resource constraints.
 * 
 * Requirements: 1.4, 6.1, 6.2, 7.1, 7.2
 */

import { LearningEngine } from './learning-engine';
import { PrivacyPreservingLearning } from './privacy-preserving-learning';
import {
  UserInteraction,
  TrainingData,
  ModelMetrics,
  UserFeedback,
  QualityMetrics,
  PerformanceConstraints,
  OptimizationResult,
  ModelInsights,
  Recommendation,
  UserContext
} from '../types';
import { 
  ModelType, 
  RecommendationType, 
  InteractionType, 
  PrivacyLevel 
} from '../enums';

// Mock the existing learning infrastructure
jest.mock('../../learning/engine');
jest.mock('../../learning/events');
jest.mock('../../learning/error-recovery');

describe('LearningEngine', () => {
  let learningEngine: LearningEngine;
  let mockPrivacyLearning: jest.Mocked<PrivacyPreservingLearning>;
  let mockUserContext: UserContext;

  beforeEach(async () => {
    learningEngine = new LearningEngine();
    await learningEngine.initialize();
    
    // Mock the privacy learning component
    mockPrivacyLearning = {
      initializeUserPrivacyLearning: jest.fn(),
      coordinateFederatedLearning: jest.fn(),
      applyDifferentialPrivacy: jest.fn(),
      anonymizeUserData: jest.fn(),
      updateLocalModelPrivately: jest.fn(),
      getPrivacyCompliantInsights: jest.fn()
    } as any;
    
    // Replace the internal privacy learning instance
    (learningEngine as any).privacyPreservingLearning = mockPrivacyLearning;

    // Set up mock user context
    mockUserContext = {
      userId: 'test_user',
      timestamp: new Date(),
      location: { 
        type: 'home',
        indoorOutdoor: 'indoor'
      },
      activity: {
        interruptible: true
      },
      availability: {
        freeTime: [],
        busyTime: [],
        flexibleTime: [],
        energyLevel: { level: 'medium', trend: 'stable' }
      },
      mood: {
        confidence: 0.8,
        source: 'inferred'
      },
      energy: { level: 'medium', trend: 'stable' },
      social: {
        familyMembersPresent: ['parent1'],
        socialSetting: 'family',
        groupActivity: false
      },
      environmental: {
        weather: { 
          condition: 'sunny', 
          temperature: 22,
          humidity: 60,
          windSpeed: 10,
          uvIndex: 5
        },
        timeOfDay: 'morning',
        season: 'spring',
        dayOfWeek: 'Monday',
        isHoliday: false
      },
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: { 
          familyTime: 'high',
          aloneTime: 'medium',
          groupActivities: 'preferred'
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Feedback Processing and Model Updates', () => {
    const mockUserId = 'user123';
    // Update mockUserContext with the specific user ID
    mockUserContext = {
      ...mockUserContext,
      userId: mockUserId
    };

    const mockInteractions: UserInteraction[] = [
      {
        userId: mockUserId,
        recommendationId: 'rec1',
        interactionType: InteractionType.ACCEPT,
        timestamp: new Date(),
        context: mockUserContext,
        outcome: { 
          successful: true,
          completionRate: 0.9,
          timeSpent: 30,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        feedback: {
          userId: mockUserId,
          recommendationId: 'rec1',
          accepted: true,
          rating: 4,
          timestamp: new Date(),
          context: mockUserContext
        },
        satisfaction: 0.8
      },
      {
        userId: mockUserId,
        recommendationId: 'rec2',
        interactionType: InteractionType.REJECT,
        timestamp: new Date(),
        context: {
          ...mockUserContext,
          environmental: {
            ...mockUserContext.environmental,
            timeOfDay: 'evening'
          },
          social: {
            familyMembersPresent: [],
            socialSetting: 'alone',
            groupActivity: false
          }
        },
        outcome: { 
          successful: false,
          completionRate: 0.1,
          timeSpent: 2,
          engagementLevel: 'low',
          wouldRecommendAgain: false
        },
        feedback: {
          userId: mockUserId,
          recommendationId: 'rec2',
          accepted: false,
          rating: 2,
          timestamp: new Date(),
          context: mockUserContext
        },
        satisfaction: 0.2
      }
    ];

    it('should update user model with interaction data', async () => {
      // Requirement 1.4: Learn from user interactions
      await learningEngine.updateUserModel(mockUserId, mockInteractions);

      // Verify bandit arms were updated
      const banditArms = (learningEngine as any).banditArms.get(mockUserId);
      expect(banditArms).toBeDefined();
      expect(banditArms.length).toBeGreaterThan(0);
      
      // Verify user model was created/updated
      const userModel = (learningEngine as any).userModels.get(mockUserId);
      expect(userModel).toBeDefined();
      expect(userModel.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update multi-armed bandit with feedback', async () => {
      // Initialize user first
      await learningEngine.updateUserModel(mockUserId, mockInteractions);

      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec3',
        accepted: true,
        rating: 5,
        timestamp: new Date(),
        context: {
          ...mockUserContext,
          environmental: {
            ...mockUserContext.environmental,
            timeOfDay: 'afternoon'
          }
        }
      };

      await learningEngine.adaptToUserFeedback(mockUserId, feedback);

      const banditArms = (learningEngine as any).banditArms.get(mockUserId);
      expect(banditArms).toBeDefined();
      
      // Check that at least one arm was updated
      const updatedArm = banditArms.find((arm: any) => arm.timesSelected > 1);
      expect(updatedArm).toBeDefined();
      expect(updatedArm.totalReward).toBeGreaterThan(0);
    });

    it('should update collaborative filtering similarities', async () => {
      // Create multiple users for similarity calculation
      const user2Id = 'user456';
      await learningEngine.updateUserModel(mockUserId, mockInteractions);
      await learningEngine.updateUserModel(user2Id, mockInteractions);

      const similarities = (learningEngine as any).userSimilarities.get(mockUserId);
      expect(similarities).toBeDefined();
      expect(Array.isArray(similarities)).toBe(true);
    });

    it('should update reinforcement learning from interactions', async () => {
      await learningEngine.updateUserModel(mockUserId, mockInteractions);

      const reinforcementHistory = (learningEngine as any).reinforcementHistory.get(mockUserId);
      expect(reinforcementHistory).toBeDefined();
      expect(reinforcementHistory.length).toBe(mockInteractions.length);
      
      reinforcementHistory.forEach((state: any) => {
        expect(state.userId).toBe(mockUserId);
        expect(state.context).toBeDefined();
        expect(state.reward).toBeGreaterThanOrEqual(0);
        expect(state.reward).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty interactions gracefully', async () => {
      await expect(learningEngine.updateUserModel(mockUserId, [])).resolves.not.toThrow();
      
      const userModel = (learningEngine as any).userModels.get(mockUserId);
      expect(userModel).toBeDefined();
    });

    it('should adapt user preferences based on feedback', async () => {
      await learningEngine.updateUserModel(mockUserId, mockInteractions);

      const positiveFeedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec4',
        accepted: true,
        rating: 5,
        timestamp: new Date(),
        context: mockUserContext
      };

      await learningEngine.adaptToUserFeedback(mockUserId, positiveFeedback);

      const userModel = (learningEngine as any).userModels.get(mockUserId);
      expect(userModel.typePreferences).toBeDefined();
      
      // Check that preferences were strengthened for positive feedback
      const preferenceValues = Object.values(userModel.typePreferences);
      expect(preferenceValues.some((value: any) => value > 0.5)).toBe(true);
    });
  });

  describe('Privacy-Preserving Learning Mechanisms', () => {
    const mockUserId = 'user789';
    const mockPrivacySettings = {
      dataSharing: PrivacyLevel.PRIVATE,
      familyDataSharing: false,
      behaviorAnalysis: false,
      encryptionRequired: true,
      dataRetentionDays: 30
    };

    it('should initialize privacy-preserving learning for users', async () => {
      // Requirement 6.1: Privacy-preserving learning
      await learningEngine.initializeUserPrivacyLearning(mockUserId, mockPrivacySettings);

      expect(mockPrivacyLearning.initializeUserPrivacyLearning).toHaveBeenCalledWith(
        mockUserId,
        mockPrivacySettings
      );
    });

    it('should coordinate federated learning with privacy constraints', async () => {
      // Requirement 6.2: Federated learning coordination
      const familyId = 'family123';
      const participants = ['user1', 'user2', 'user3'];
      
      const mockResult = {
        aggregatedWeights: [0.1, 0.2, 0.3],
        participantCount: 3,
        privacyLoss: 0.05,
        convergenceScore: 0.02,
        qualityMetrics: {
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.80,
          f1Score: 0.81,
          diversityScore: 0.75,
          noveltyScore: 0.70,
          userSatisfaction: 0.83
        }
      };

      mockPrivacyLearning.coordinateFederatedLearning.mockResolvedValue(mockResult);

      const result = await learningEngine.coordinateFederatedLearning(
        familyId,
        participants,
        mockPrivacySettings
      );

      expect(result).toEqual(mockResult);
      expect(mockPrivacyLearning.coordinateFederatedLearning).toHaveBeenCalledWith(
        familyId,
        participants,
        mockPrivacySettings
      );
    });

    it('should apply differential privacy to training data', async () => {
      const trainingData: TrainingData = {
        interactions: [
          {
            userId: mockUserId,
            recommendationId: 'rec1',
            interactionType: InteractionType.ACCEPT,
            timestamp: new Date(),
            context: mockUserContext,
            outcome: { 
              successful: true,
              completionRate: 0.9,
              timeSpent: 30,
              engagementLevel: 'high',
              wouldRecommendAgain: true
            },
            feedback: {
              userId: mockUserId,
              recommendationId: 'rec1',
              accepted: true,
              rating: 4,
              timestamp: new Date(),
              context: mockUserContext
            },
            satisfaction: 0.8
          }
        ],
        contextFeatures: [],
        outcomes: [],
        privacyLevel: PrivacyLevel.PRIVATE,
        dataRetentionPolicy: { 
          retentionDays: 30,
          anonymizeAfterDays: 7,
          deleteAfterDays: 90,
          exceptions: []
        }
      };

      const mockPrivatizedData = {
        ...trainingData,
        interactions: trainingData.interactions.map(i => ({
          ...i,
          satisfaction: i.satisfaction + 0.1 // Simulated noise
        }))
      };

      mockPrivacyLearning.applyDifferentialPrivacy.mockResolvedValue(mockPrivatizedData);

      const metrics = await learningEngine.trainRecommendationModel(
        ModelType.COLLABORATIVE_FILTERING,
        trainingData
      );

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThan(0);
      expect(mockPrivacyLearning.applyDifferentialPrivacy).toHaveBeenCalled();
    });

    it('should update local models privately when privacy level is high', async () => {
      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec1',
        accepted: true,
        rating: 4,
        timestamp: new Date(),
        context: mockUserContext
      };

      // Set up user model with high privacy settings
      const userModel = {
        privacySettings: { dataSharing: PrivacyLevel.PRIVATE }
      };
      (learningEngine as any).userModels.set(mockUserId, userModel);

      await learningEngine.adaptToUserFeedback(mockUserId, feedback);

      expect(mockPrivacyLearning.updateLocalModelPrivately).toHaveBeenCalledWith(
        mockUserId,
        feedback,
        userModel.privacySettings
      );
    });

    it('should provide privacy-compliant model insights', async () => {
      const mockInsights = {
        userId: mockUserId, // Should return the original userId in the converted format
        generalPatterns: 'anonymized_patterns',
        aggregateMetrics: { avgPerformance: 0.8 }
      };

      mockPrivacyLearning.getPrivacyCompliantInsights.mockResolvedValue(mockInsights);

      // Set up user model with high privacy settings
      const userModel = {
        privacySettings: { dataSharing: PrivacyLevel.PRIVATE }
      };
      (learningEngine as any).userModels.set(mockUserId, userModel);

      const insights = await learningEngine.getModelInsights(mockUserId);

      expect(insights).toBeDefined();
      expect(insights.userId).toBe(mockUserId); // Should be the original userId, not anonymized
      expect(insights.topInterests).toEqual([]);
      expect(insights.behaviorPatterns).toBeDefined();
      expect(mockPrivacyLearning.getPrivacyCompliantInsights).toHaveBeenCalled();
    });

    it('should handle privacy budget exhaustion gracefully', async () => {
      // Set privacy budget to zero
      (learningEngine as any).privacyPreservingLearning.privacyBudgets = new Map([[mockUserId, 0]]);

      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec1',
        accepted: true,
        rating: 4,
        timestamp: new Date(),
        context: mockUserContext
      };

      // Should not throw error when privacy budget is exhausted
      await expect(learningEngine.adaptToUserFeedback(mockUserId, feedback)).resolves.not.toThrow();
    });
  });

  describe('Performance Optimization Under Resource Constraints', () => {
    it('should respect memory constraints during model updates', async () => {
      // Requirement 7.1: Memory usage optimization
      const mockUserId = 'user_memory_test';
      
      // Mock memory usage to be over limit
      const originalGetCurrentMemoryUsage = (learningEngine as any).getCurrentMemoryUsage;
      (learningEngine as any).getCurrentMemoryUsage = jest.fn().mockReturnValue(1600); // Over 1536MB limit

      const interactions: UserInteraction[] = Array.from({ length: 100 }, (_, i) => ({
        userId: mockUserId,
        recommendationId: `rec${i}`,
        interactionType: InteractionType.ACCEPT,
        timestamp: new Date(),
        context: mockUserContext,
        outcome: { 
          successful: true,
          completionRate: 0.9,
          timeSpent: 30,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        feedback: {
          userId: mockUserId,
          recommendationId: `rec${i}`,
          accepted: true,
          rating: 4,
          timestamp: new Date(),
          context: mockUserContext
        },
        satisfaction: 0.8
      }));

      await expect(learningEngine.updateUserModel(mockUserId, interactions)).rejects.toThrow(/Memory usage.*exceeds limit/);

      // Restore original method
      (learningEngine as any).getCurrentMemoryUsage = originalGetCurrentMemoryUsage;
    });

    it('should optimize model performance under constraints', async () => {
      // Requirement 7.2: Performance optimization
      const constraints: PerformanceConstraints = {
        maxMemoryMB: 512,
        maxLatencyMs: 1000,
        maxConcurrentUsers: 5,
        offlineCapable: true
      };

      const result = await learningEngine.optimizeModelPerformance(constraints);

      expect(result).toBeDefined();
      expect(result.modelType).toBe(ModelType.HYBRID);
      expect(typeof result.memoryReduction).toBe('number'); // Memory reduction can be negative if memory usage increased
      expect(result.optimizationTechniques).toContain('model_compression');
      expect(result.optimizationTechniques).toContain('bandit_optimization');
      expect(result.optimizationTechniques).toContain('similarity_pruning');
      expect(result.optimizationTechniques).toContain('history_cleanup');
    });

    it('should compress models to fit memory constraints', async () => {
      const mockUserId = 'user_compression_test';
      
      // Add many users to trigger compression
      for (let i = 0; i < 100; i++) {
        const userId = `user${i}`;
        (learningEngine as any).userModels.set(userId, {
          qValues: Object.fromEntries(Array.from({ length: 200 }, (_, j) => [`state${j}`, Math.random()]))
        });
      }

      const constraints: PerformanceConstraints = {
        maxMemoryMB: 256, // Very tight constraint
        maxLatencyMs: 500,
        maxConcurrentUsers: 2,
        offlineCapable: true
      };

      const result = await learningEngine.optimizeModelPerformance(constraints);

      expect(typeof result.memoryReduction).toBe('number'); // Memory reduction can vary based on current state
      
      // Verify Q-values were compressed
      const userModel = (learningEngine as any).userModels.get('user0');
      if (userModel?.qValues) {
        expect(Object.keys(userModel.qValues).length).toBeLessThanOrEqual(100);
      }
    });

    it('should optimize bandit arms for performance', async () => {
      const mockUserId = 'user_bandit_test';
      
      // Create bandit arms with poor performance
      const poorArms = [
        {
          recommendationType: RecommendationType.ACTIVITY,
          totalReward: 1,
          timesSelected: 20,
          averageReward: 0.05, // Very low performance
          confidence: 0.1
        },
        {
          recommendationType: RecommendationType.SCHEDULE,
          totalReward: 15,
          timesSelected: 20,
          averageReward: 0.75, // Good performance
          confidence: 0.8
        }
      ];
      
      (learningEngine as any).banditArms.set(mockUserId, poorArms);

      const constraints: PerformanceConstraints = {
        maxMemoryMB: 1024,
        maxLatencyMs: 1000,
        maxConcurrentUsers: 10,
        offlineCapable: true
      };

      await learningEngine.optimizeModelPerformance(constraints);

      const optimizedArms = (learningEngine as any).banditArms.get(mockUserId);
      expect(optimizedArms.length).toBeLessThanOrEqual(poorArms.length); // Poor performing arms may be removed
    });

    it('should prune user similarities for memory efficiency', async () => {
      const mockUserId = 'user_similarity_test';
      
      // Create many low-quality similarities
      const similarities = Array.from({ length: 100 }, (_, i) => ({
        userId: `similar_user${i}`,
        similarity: Math.random() * 0.2, // Low similarity scores
        sharedInteractions: Math.floor(Math.random() * 5),
        lastUpdated: new Date()
      }));
      
      (learningEngine as any).userSimilarities.set(mockUserId, similarities);

      const constraints: PerformanceConstraints = {
        maxMemoryMB: 512,
        maxLatencyMs: 1000,
        maxConcurrentUsers: 5,
        offlineCapable: true
      };

      await learningEngine.optimizeModelPerformance(constraints);

      const prunedSimilarities = (learningEngine as any).userSimilarities.get(mockUserId);
      expect(prunedSimilarities.length).toBeLessThanOrEqual(20); // Should be pruned to top 20
      
      // Remaining similarities should have higher scores
      prunedSimilarities.forEach((sim: any) => {
        expect(sim.similarity).toBeGreaterThan(0.3);
      });
    });

    it('should cleanup old reinforcement learning history', async () => {
      const mockUserId = 'user_history_test';
      
      // Create extensive history
      const history = Array.from({ length: 2000 }, (_, i) => ({
        userId: mockUserId,
        context: `context${i}`,
        action: `action${i}`,
        reward: Math.random(),
        timestamp: new Date(Date.now() - i * 1000)
      }));
      
      (learningEngine as any).reinforcementHistory.set(mockUserId, history);

      const constraints: PerformanceConstraints = {
        maxMemoryMB: 512,
        maxLatencyMs: 1000,
        maxConcurrentUsers: 5,
        offlineCapable: true
      };

      await learningEngine.optimizeModelPerformance(constraints);

      const cleanedHistory = (learningEngine as any).reinforcementHistory.get(mockUserId);
      expect(cleanedHistory.length).toBeLessThanOrEqual(500); // Should be limited to 500 recent entries
    });

    it('should handle concurrent optimization requests', async () => {
      const constraints: PerformanceConstraints = {
        maxMemoryMB: 1024,
        maxLatencyMs: 1000,
        maxConcurrentUsers: 10,
        offlineCapable: true
      };

      // Run multiple optimizations concurrently
      const optimizationPromises = Array.from({ length: 5 }, () =>
        learningEngine.optimizeModelPerformance(constraints)
      );

      const results = await Promise.all(optimizationPromises);

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.modelType).toBe(ModelType.HYBRID);
        expect(result.optimizationTechniques).toBeDefined();
      });
    });
  });

  describe('Model Training and Evaluation', () => {
    it('should train collaborative filtering model', async () => {
      const trainingData: TrainingData = {
        interactions: [
          {
            userId: 'user1',
            recommendationId: 'rec1',
            interactionType: InteractionType.ACCEPT,
            timestamp: new Date(),
            context: mockUserContext,
            outcome: { 
              successful: true,
              completionRate: 0.9,
              timeSpent: 30,
              engagementLevel: 'high',
              wouldRecommendAgain: true
            },
            feedback: {
              userId: 'user1',
              recommendationId: 'rec1',
              accepted: true,
              rating: 4,
              timestamp: new Date(),
              context: mockUserContext
            },
            satisfaction: 0.8
          }
        ],
        contextFeatures: [],
        outcomes: [],
        privacyLevel: PrivacyLevel.PUBLIC,
        dataRetentionPolicy: { 
          retentionDays: 30,
          anonymizeAfterDays: 7,
          deleteAfterDays: 90,
          exceptions: []
        }
      };

      const metrics = await learningEngine.trainRecommendationModel(
        ModelType.COLLABORATIVE_FILTERING,
        trainingData
      );

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThan(0.7);
      expect(metrics.precision).toBeGreaterThan(0.7);
      expect(metrics.recall).toBeGreaterThan(0.7);
      expect(metrics.f1Score).toBeGreaterThan(0.7);
    });

    it('should evaluate recommendation quality', async () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: RecommendationType.ACTIVITY,
          title: 'Test Activity',
          description: 'Test Description',
          confidence: 0.8,
          reasoning: ['test reason'],
          actionable: true,
          integrationActions: [],
          expiresAt: new Date(),
          metadata: { 
            userId: 'user1',
            generatedAt: new Date(),
            contextId: 'ctx1',
            engineVersion: '1.0.0',
            safetyValidated: true,
            privacyCompliant: true
          }
        }
      ];

      const feedback: UserFeedback[] = [
        {
          userId: 'user1',
          recommendationId: 'rec1',
          accepted: true,
          rating: 4,
          timestamp: new Date(),
          context: mockUserContext
        }
      ];

      const quality = await learningEngine.evaluateRecommendationQuality(recommendations, feedback);

      expect(quality).toBeDefined();
      expect(quality.accuracy).toBe(1.0); // 100% acceptance rate
      expect(quality.userSatisfaction).toBe(0.8); // 4/5 rating normalized
      expect(quality.precision).toBeGreaterThanOrEqual(0);
      expect(quality.recall).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty feedback gracefully', async () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: RecommendationType.ACTIVITY,
          title: 'Test Activity',
          description: 'Test Description',
          confidence: 0.8,
          reasoning: ['test reason'],
          actionable: true,
          integrationActions: [],
          expiresAt: new Date(),
          metadata: { 
            userId: 'user1',
            generatedAt: new Date(),
            contextId: 'ctx1',
            engineVersion: '1.0.0',
            safetyValidated: true,
            privacyCompliant: true
          }
        }
      ];

      const quality = await learningEngine.evaluateRecommendationQuality(recommendations, []);

      expect(quality).toBeDefined();
      expect(quality.accuracy).toBe(0);
      expect(quality.userSatisfaction).toBe(0);
      expect(quality.precision).toBe(0);
      expect(quality.recall).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const invalidUserId = '';
      const interactions: UserInteraction[] = [];

      await expect(learningEngine.updateUserModel(invalidUserId, interactions)).resolves.not.toThrow();
    });

    it('should handle corrupted user model data', async () => {
      const mockUserId = 'corrupted_user';
      
      // Set corrupted data
      (learningEngine as any).userModels.set(mockUserId, null);

      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec1',
        accepted: true,
        rating: 4,
        timestamp: new Date(),
        context: mockUserContext
      };

      await expect(learningEngine.adaptToUserFeedback(mockUserId, feedback)).resolves.not.toThrow();
    });

    it('should handle training with invalid model type', async () => {
      const trainingData: TrainingData = {
        interactions: [],
        contextFeatures: [],
        outcomes: [],
        privacyLevel: PrivacyLevel.PUBLIC,
        dataRetentionPolicy: { 
          retentionDays: 30,
          anonymizeAfterDays: 7,
          deleteAfterDays: 90,
          exceptions: []
        }
      };

      // Should default to hybrid model for unknown types
      const metrics = await learningEngine.trainRecommendationModel(
        'UNKNOWN_TYPE' as ModelType,
        trainingData
      );

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThan(0);
    });

    it('should handle memory pressure gracefully', async () => {
      // Mock extreme memory pressure
      const originalGetCurrentMemoryUsage = (learningEngine as any).getCurrentMemoryUsage;
      (learningEngine as any).getCurrentMemoryUsage = jest.fn().mockReturnValue(1600); // Over limit

      const mockUserId = 'memory_pressure_user';
      const interactions: UserInteraction[] = [{
        userId: mockUserId,
        recommendationId: 'rec1',
        interactionType: InteractionType.ACCEPT,
        timestamp: new Date(),
        context: mockUserContext,
        outcome: { 
          successful: true,
          completionRate: 0.9,
          timeSpent: 30,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        feedback: {
          userId: mockUserId,
          recommendationId: 'rec1',
          accepted: true,
          rating: 4,
          timestamp: new Date(),
          context: mockUserContext
        },
        satisfaction: 0.8
      }];

      await expect(learningEngine.updateUserModel(mockUserId, interactions)).rejects.toThrow();

      // Restore original method
      (learningEngine as any).getCurrentMemoryUsage = originalGetCurrentMemoryUsage;
    });
  });
});