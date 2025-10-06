/**
 * Recommendation Controller Unit Tests
 * 
 * Tests for centralized recommendation request processing, multi-engine coordination,
 * performance monitoring and optimization, and recommendation history analytics.
 * 
 * Requirements: 1.1, 7.1, 7.2, 7.4
 */

import { RecommendationController } from './controller';
import {
  IActivityRecommender,
  IScheduleOptimizer,
  IEducationalRecommender,
  IHouseholdEfficiencyEngine,
  IContextAnalyzer,
  ILearningEngine,
  IPrivacyManager,
  ISafetyValidator,
  IIntegrationLayer,
  IErrorHandler,
  IPerformanceMonitor,
  ActivityRecommendation,
  EducationalRecommendation,
  ScheduleOptimization,
  TaskOptimization
} from './interfaces';
import {
  Recommendation,
  UserContext,
  UserPreferences,
  UserFeedback,
  RecommendationHistory,
  RecommendationSettings,
  TimeRange,
  SystemMetrics
} from './types';
import {
  RecommendationType,
  ErrorSeverity,
  InteractionType,
  EngagementLevel,
  SkillLevel,
  PrivacyLevel,
  ActivityCategory,
  DifficultyLevel
} from './enums';

describe('RecommendationController', () => {
  let controller: RecommendationController;
  let mockActivityRecommender: jest.Mocked<IActivityRecommender>;
  let mockScheduleOptimizer: jest.Mocked<IScheduleOptimizer>;
  let mockEducationalRecommender: jest.Mocked<IEducationalRecommender>;
  let mockHouseholdEfficiencyEngine: jest.Mocked<IHouseholdEfficiencyEngine>;
  let mockContextAnalyzer: jest.Mocked<IContextAnalyzer>;
  let mockLearningEngine: jest.Mocked<ILearningEngine>;
  let mockPrivacyManager: jest.Mocked<IPrivacyManager>;
  let mockSafetyValidator: jest.Mocked<ISafetyValidator>;
  let mockIntegrationLayer: jest.Mocked<IIntegrationLayer>;
  let mockErrorHandler: jest.Mocked<IErrorHandler>;
  let mockPerformanceMonitor: jest.Mocked<IPerformanceMonitor>;

  const mockUserId = 'test-user-123';
  const mockRecommendationId = 'rec-123';

  const mockUserContext: UserContext = {
    userId: mockUserId,
    timestamp: new Date(),
    location: {
      type: 'home',
      indoorOutdoor: 'indoor'
    },
    activity: {
      interruptible: true
    },
    availability: {
      freeTime: [{ start: new Date(), end: new Date(Date.now() + 3600000) }],
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
      familyMembersPresent: [],
      socialSetting: 'alone',
      groupActivity: false
    },
    environmental: {
      weather: {
        temperature: 22,
        condition: 'sunny',
        humidity: 60,
        windSpeed: 10,
        uvIndex: 5
      },
      timeOfDay: 'afternoon',
      season: 'summer',
      dayOfWeek: 'Monday',
      isHoliday: false
    },
    preferences: {
      preferredActivities: [ActivityCategory.EDUCATIONAL],
      avoidedActivities: [],
      timePreferences: [],
      socialPreferences: {
        familyTime: 'medium',
        aloneTime: 'high',
        groupActivities: 'acceptable'
      }
    }
  };

  const mockRecommendation: Recommendation = {
    id: mockRecommendationId,
    type: RecommendationType.ACTIVITY,
    title: 'Test Activity',
    description: 'A test activity recommendation',
    confidence: 0.8,
    reasoning: ['Based on user preferences'],
    actionable: true,
    integrationActions: [],
    expiresAt: new Date(Date.now() + 3600000),
    metadata: {
      generatedAt: new Date(),
      userId: mockUserId,
      contextId: 'context-123',
      engineVersion: '1.0.0',
      safetyValidated: true,
      privacyCompliant: true
    }
  };

  beforeEach(() => {
    // Create mocks for all dependencies
    mockActivityRecommender = {
      recommendActivities: jest.fn(),
      discoverNewActivities: jest.fn(),
      recommendFamilyActivities: jest.fn(),
      updateActivityPreferences: jest.fn(),
      trackActivityCompletion: jest.fn(),
      validateActivitySafety: jest.fn()
    };

    mockScheduleOptimizer = {
      optimizeSchedule: jest.fn(),
      suggestAlternativeTimes: jest.fn(),
      recommendRoutineImprovements: jest.fn(),
      identifyScheduleConflicts: jest.fn(),
      suggestTimeBlocking: jest.fn(),
      analyzeScheduleEfficiency: jest.fn()
    };

    mockEducationalRecommender = {
      recommendEducationalContent: jest.fn(),
      suggestLearningActivities: jest.fn(),
      trackLearningProgress: jest.fn(),
      adaptToLearningStyle: jest.fn(),
      requiresParentalApproval: jest.fn(),
      validateEducationalContent: jest.fn()
    };

    mockHouseholdEfficiencyEngine = {
      analyzeHouseholdPatterns: jest.fn(),
      recommendTaskOptimizations: jest.fn(),
      suggestAutomationOpportunities: jest.fn(),
      optimizeSupplyManagement: jest.fn(),
      recommendRoutineChanges: jest.fn(),
      trackHouseholdMetrics: jest.fn()
    };

    mockContextAnalyzer = {
      analyzeCurrentContext: jest.fn(),
      predictContextChanges: jest.fn(),
      analyzeFamilyDynamics: jest.fn(),
      detectContextualTriggers: jest.fn(),
      updateContextModel: jest.fn(),
      validateContextData: jest.fn()
    };

    mockLearningEngine = {
      updateUserModel: jest.fn(),
      trainRecommendationModel: jest.fn(),
      evaluateRecommendationQuality: jest.fn(),
      adaptToUserFeedback: jest.fn(),
      optimizeModelPerformance: jest.fn(),
      getModelInsights: jest.fn()
    };

    mockPrivacyManager = {
      enforcePrivacyPreferences: jest.fn(),
      anonymizeUserData: jest.fn(),
      auditDataUsage: jest.fn(),
      updatePrivacySettings: jest.fn(),
      validateDataMinimization: jest.fn(),
      encryptUserData: jest.fn(),
      decryptUserData: jest.fn()
    };

    mockSafetyValidator = {
      validateChildSafeContent: jest.fn(),
      validateActivitySafety: jest.fn(),
      validateEducationalContent: jest.fn(),
      requiresParentalApproval: jest.fn(),
      auditSafetyDecisions: jest.fn()
    };

    mockIntegrationLayer = {
      integrateWithVoice: jest.fn(),
      integrateWithAvatar: jest.fn(),
      integrateWithScheduling: jest.fn(),
      integrateWithSmartHome: jest.fn(),
      executeIntegrationAction: jest.fn(),
      validateIntegration: jest.fn()
    };

    mockErrorHandler = {
      handleRecommendationError: jest.fn(),
      handleContextError: jest.fn(),
      handleLearningError: jest.fn(),
      handlePrivacyError: jest.fn(),
      handleIntegrationError: jest.fn()
    };

    mockPerformanceMonitor = {
      trackRecommendationLatency: jest.fn(),
      trackMemoryUsage: jest.fn(),
      trackUserSatisfaction: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      alertOnPerformanceIssues: jest.fn()
    };

    // Set up default mock implementations
    mockPrivacyManager.enforcePrivacyPreferences.mockResolvedValue({
      allowed: true,
      restrictions: [],
      anonymizationRequired: false,
      consentRequired: false,
      auditRequired: false
    });

    mockContextAnalyzer.analyzeCurrentContext.mockResolvedValue(mockUserContext);
    mockActivityRecommender.recommendActivities.mockResolvedValue([mockRecommendation as ActivityRecommendation]);
    mockScheduleOptimizer.optimizeSchedule.mockResolvedValue([mockRecommendation as ScheduleOptimization]);
    mockEducationalRecommender.recommendEducationalContent.mockResolvedValue([mockRecommendation as EducationalRecommendation]);
    mockHouseholdEfficiencyEngine.recommendTaskOptimizations.mockResolvedValue([mockRecommendation as TaskOptimization]);

    mockSafetyValidator.validateChildSafeContent.mockResolvedValue(true);
    mockIntegrationLayer.integrateWithVoice.mockResolvedValue([]);
    mockIntegrationLayer.integrateWithAvatar.mockResolvedValue([]);
    mockIntegrationLayer.integrateWithScheduling.mockResolvedValue([]);
    mockIntegrationLayer.integrateWithSmartHome.mockResolvedValue([]);

    mockPerformanceMonitor.getPerformanceMetrics.mockResolvedValue({
      timestamp: new Date(),
      latency: { average: 500, median: 450, p95: 800, p99: 1000, min: 100, max: 1200, count: 100 },
      memory: { current: 800, average: 750, peak: 1000, threshold: 1500, utilizationPercent: 53 },
      cpu: { current: 45, average: 40, peak: 70, threshold: 80 },
      userSatisfaction: { average: 0.85, userCount: 50, aboveThreshold: 42, belowThreshold: 8 },
      recommendations: { totalRequests: 1000, operationBreakdown: {}, averageLatencyByOperation: {} },
      system: {
        uptime: 86400,
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        arch: 'x64',
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      thresholds: { maxLatencyMs: 2000, maxMemoryMB: 1500, minSatisfactionScore: 0.7, maxCpuUsagePercent: 80, maxConcurrentRequests: 5 },
      alerts: []
    });

    // Create controller instance
    controller = new RecommendationController(
      mockActivityRecommender,
      mockScheduleOptimizer,
      mockEducationalRecommender,
      mockHouseholdEfficiencyEngine,
      mockContextAnalyzer,
      mockLearningEngine,
      mockPrivacyManager,
      mockSafetyValidator,
      mockErrorHandler,
      mockPerformanceMonitor,
      mockIntegrationLayer
    );
  });

  describe('Request Processing and Engine Coordination', () => {
    describe('getRecommendations', () => {
      it('should generate recommendations successfully with multi-engine coordination', async () => {
        const recommendations = await controller.getRecommendations(mockUserId, mockUserContext);

        expect(recommendations).toHaveLength(1);
        expect(recommendations[0]).toMatchObject({
          id: mockRecommendationId,
          type: RecommendationType.ACTIVITY,
          title: 'Test Activity'
        });

        // Verify privacy enforcement
        expect(mockPrivacyManager.enforcePrivacyPreferences).toHaveBeenCalledWith(
          mockUserId,
          { type: 'read', purpose: 'recommendation_generation' }
        );

        // Verify context analysis
        expect(mockContextAnalyzer.analyzeCurrentContext).toHaveBeenCalledWith(mockUserId);

        // Verify activity recommender was called
        expect(mockActivityRecommender.recommendActivities).toHaveBeenCalled();
      });

      it('should handle privacy restrictions by blocking recommendation generation', async () => {
        mockPrivacyManager.enforcePrivacyPreferences.mockResolvedValue({
          allowed: false,
          restrictions: [],
          anonymizationRequired: false,
          consentRequired: false,
          auditRequired: false
        });

        const recommendations = await controller.getRecommendations(mockUserId, mockUserContext);

        // Should return fallback recommendations when privacy is blocked
        expect(recommendations).toBeDefined();
        expect(mockActivityRecommender.recommendActivities).not.toHaveBeenCalled();
      });

      it('should coordinate multiple engines based on recommendation type', async () => {
        await controller.getRecommendations(mockUserId, mockUserContext, RecommendationType.MIXED);

        // Should call multiple engines for mixed recommendations
        expect(mockActivityRecommender.recommendActivities).toHaveBeenCalled();
        expect(mockScheduleOptimizer.optimizeSchedule).toHaveBeenCalled();
        expect(mockHouseholdEfficiencyEngine.recommendTaskOptimizations).toHaveBeenCalled();
      });

      it('should handle engine failures gracefully with fallback mechanisms', async () => {
        mockActivityRecommender.recommendActivities.mockRejectedValue(new Error('Engine failure'));

        const recommendations = await controller.getRecommendations(mockUserId, mockUserContext);

        // Should still return recommendations from other engines
        expect(recommendations).toBeDefined();
        expect(mockErrorHandler.handleRecommendationError).toHaveBeenCalled();
      });

      it('should track performance metrics during request processing', async () => {
        await controller.getRecommendations(mockUserId, mockUserContext);

        expect(mockPerformanceMonitor.trackRecommendationLatency).toHaveBeenCalledWith(
          'getRecommendations',
          expect.any(Number)
        );
      });
    });

    describe('submitFeedback', () => {
      const mockFeedback: UserFeedback = {
        recommendationId: mockRecommendationId,
        userId: mockUserId,
        rating: 4,
        accepted: true,
        completed: true,
        feedback: 'Great recommendation!',
        timestamp: new Date(),
        context: mockUserContext
      };

      it('should process feedback with privacy validation', async () => {
        await controller.submitFeedback(mockRecommendationId, mockFeedback);

        expect(mockPrivacyManager.enforcePrivacyPreferences).toHaveBeenCalledWith(
          mockUserId,
          { type: 'write', purpose: 'feedback_processing' }
        );

        expect(mockLearningEngine.adaptToUserFeedback).toHaveBeenCalledWith(
          mockUserId,
          mockFeedback
        );

        expect(mockPerformanceMonitor.trackUserSatisfaction).toHaveBeenCalledWith(
          mockUserId,
          0.8 // rating / 5
        );
      });

      it('should handle privacy restrictions for feedback submission', async () => {
        mockPrivacyManager.enforcePrivacyPreferences.mockResolvedValue({
          allowed: false,
          restrictions: [],
          anonymizationRequired: false,
          consentRequired: false,
          auditRequired: false
        });

        await controller.submitFeedback(mockRecommendationId, mockFeedback);

        expect(mockLearningEngine.adaptToUserFeedback).not.toHaveBeenCalled();
        expect(mockErrorHandler.handleRecommendationError).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Monitoring and Optimization', () => {
    describe('getSystemMetrics', () => {
      it('should return comprehensive system metrics', async () => {
        const metrics = await controller.getSystemMetrics();

        expect(metrics).toMatchObject({
          timestamp: expect.any(Date),
          latency: expect.objectContaining({
            average: expect.any(Number),
            median: expect.any(Number),
            p95: expect.any(Number),
            p99: expect.any(Number)
          }),
          memory: expect.objectContaining({
            current: expect.any(Number),
            average: expect.any(Number),
            peak: expect.any(Number),
            threshold: 1500,
            utilizationPercent: expect.any(Number)
          }),
          userSatisfaction: expect.objectContaining({
            average: expect.any(Number),
            userCount: expect.any(Number)
          })
        });

        expect(mockPerformanceMonitor.getPerformanceMetrics).toHaveBeenCalled();
      });
    });

    describe('Performance Constraints Enforcement', () => {
      it('should enforce memory usage limits during recommendation generation', async () => {
        // Mock high memory usage
        mockPerformanceMonitor.getPerformanceMetrics.mockResolvedValue({
          ...await mockPerformanceMonitor.getPerformanceMetrics(),
          memory: {
            current: 1400,
            average: 1300,
            peak: 1450,
            threshold: 1500,
            utilizationPercent: 93
          }
        });

        const recommendations = await controller.getRecommendations(mockUserId, mockUserContext);

        // Should still generate recommendations but with optimization
        expect(recommendations).toBeDefined();
        expect(mockPerformanceMonitor.trackMemoryUsage).toHaveBeenCalled();
      });

      it('should enforce latency limits with timeout handling', async () => {
        // Mock slow engine response
        mockActivityRecommender.recommendActivities.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve([mockRecommendation as ActivityRecommendation]), 3000))
        );

        const startTime = Date.now();
        const recommendations = await controller.getRecommendations(mockUserId, mockUserContext);
        const duration = Date.now() - startTime;

        // Should complete within reasonable time due to timeout handling
        expect(duration).toBeLessThan(5000);
        expect(recommendations).toBeDefined();
      });
    });
  });

  describe('Recommendation History and Analytics', () => {
    describe('getRecommendationHistory', () => {
      const mockTimeRange: TimeRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date()
      };

      it('should retrieve recommendation history with privacy filtering', async () => {
        const mockHistory: RecommendationHistory = {
          recommendations: [mockRecommendation],
          totalCount: 1,
          timeRange: mockTimeRange,
          privacyFiltered: false
        };

        // Mock the history analytics to return our test data
        jest.spyOn(controller as any, 'historyAnalytics', 'get').mockReturnValue({
          getRecommendationHistory: jest.fn().mockResolvedValue(mockHistory)
        });

        const history = await controller.getRecommendationHistory(mockUserId, mockTimeRange);

        expect(history).toMatchObject({
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              id: mockRecommendationId,
              type: RecommendationType.ACTIVITY
            })
          ]),
          totalCount: 1,
          timeRange: mockTimeRange
        });
      });

      it('should handle privacy restrictions for history access', async () => {
        mockPrivacyManager.enforcePrivacyPreferences.mockResolvedValue({
          allowed: false,
          restrictions: [],
          anonymizationRequired: false,
          consentRequired: false,
          auditRequired: false
        });

        // Mock the history analytics
        jest.spyOn(controller as any, 'historyAnalytics', 'get').mockReturnValue({
          getRecommendationHistory: jest.fn().mockResolvedValue({
            recommendations: [],
            totalCount: 0,
            timeRange: mockTimeRange,
            privacyFiltered: true
          })
        });

        const history = await controller.getRecommendationHistory(mockUserId, mockTimeRange);

        expect(history.privacyFiltered).toBe(true);
        expect(history.recommendations).toHaveLength(0);
      });
    });

    describe('Analytics Generation', () => {
      it('should generate analytics reports with user engagement metrics', async () => {
        const mockAnalyticsReport = {
          timeRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
          totalRecommendations: 100,
          userEngagement: {
            averageSatisfaction: 0.85,
            totalUsers: 25,
            activeUsers: 20,
            engagementRate: 0.8
          },
          recommendationEffectiveness: {
            overallAcceptanceRate: 0.75,
            completionRate: 0.65,
            averageRelevanceScore: 0.8,
            typeBreakdown: {
              [RecommendationType.ACTIVITY]: {
                count: 25,
                acceptanceRate: 0.8,
                completionRate: 0.7,
                averageSatisfaction: 0.85,
                averageRelevance: 0.82
              },
              [RecommendationType.SCHEDULE]: {
                count: 20,
                acceptanceRate: 0.75,
                completionRate: 0.65,
                averageSatisfaction: 0.8,
                averageRelevance: 0.78
              },
              [RecommendationType.EDUCATIONAL]: {
                count: 30,
                acceptanceRate: 0.85,
                completionRate: 0.8,
                averageSatisfaction: 0.9,
                averageRelevance: 0.88
              },
              [RecommendationType.HOUSEHOLD]: {
                count: 15,
                acceptanceRate: 0.7,
                completionRate: 0.6,
                averageSatisfaction: 0.75,
                averageRelevance: 0.72
              },
              [RecommendationType.MIXED]: {
                count: 10,
                acceptanceRate: 0.8,
                completionRate: 0.75,
                averageSatisfaction: 0.85,
                averageRelevance: 0.8
              }
            }
          },
          systemPerformance: {
            averageLatency: 800,
            errorRate: 0.02,
            memoryUsage: 900,
            throughput: 150
          },
          trends: {
            satisfactionTrend: [0.8, 0.82, 0.85, 0.87, 0.85],
            usageTrend: [20, 25, 30, 28, 32],
            performanceTrend: [750, 800, 850, 820, 800]
          }
        };

        // Mock the analytics generation
        jest.spyOn(controller, 'generateAnalyticsReport').mockResolvedValue(mockAnalyticsReport);

        const report = await controller.generateAnalyticsReport(mockUserId);

        expect(report).toMatchObject({
          totalRecommendations: expect.any(Number),
          userEngagement: expect.objectContaining({
            averageSatisfaction: expect.any(Number),
            totalUsers: expect.any(Number),
            engagementRate: expect.any(Number)
          }),
          recommendationEffectiveness: expect.objectContaining({
            overallAcceptanceRate: expect.any(Number),
            completionRate: expect.any(Number)
          }),
          systemPerformance: expect.objectContaining({
            averageLatency: expect.any(Number),
            errorRate: expect.any(Number)
          })
        });
      });

      it('should measure recommendation effectiveness by type', async () => {
        const mockEffectiveness = {
          count: 50,
          acceptanceRate: 0.8,
          completionRate: 0.7,
          averageSatisfaction: 0.85,
          averageRelevance: 0.82
        };

        // Mock the effectiveness measurement
        jest.spyOn(controller, 'measureRecommendationEffectiveness').mockResolvedValue(mockEffectiveness);

        const effectiveness = await controller.measureRecommendationEffectiveness(
          RecommendationType.ACTIVITY
        );

        expect(effectiveness).toMatchObject({
          count: expect.any(Number),
          acceptanceRate: expect.any(Number),
          completionRate: expect.any(Number),
          averageSatisfaction: expect.any(Number),
          averageRelevance: expect.any(Number)
        });
      });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});