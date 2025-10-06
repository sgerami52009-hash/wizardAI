// Feedback Processing and Adaptation Tests

import { 
  DefaultLearningFeedbackManager,
  LearningFeedbackManager,
  FeedbackProcessingResult,
  FeedbackInsights,
  FeedbackPatternAnalysis,
  AdaptiveLearningStrategy,
  LearningParameterUpdate,
  PersonalizationMetrics
} from './feedback';
import { 
  DefaultLearningProgressTracker,
  LearningProgressTracker,
  LearningProgress,
  ProgressReport
} from './progress-tracker';
import { LearningEventBus, LearningEventType } from './events';
import { 
  UserFeedback, 
  FeedbackType, 
  FeedbackSource, 
  EmotionalResponse,
  UrgencyLevel,
  AgeGroup
} from './types';

describe('Feedback Processing and Adaptation', () => {
  let feedbackManager: LearningFeedbackManager;
  let progressTracker: LearningProgressTracker;
  let mockEventBus: jest.Mocked<LearningEventBus>;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    feedbackManager = new DefaultLearningFeedbackManager(mockEventBus);
    progressTracker = new DefaultLearningProgressTracker(mockEventBus);
  });

  describe('Feedback Collection Accuracy', () => {
    it('should accurately collect and validate feedback data', async () => {
      const feedback: UserFeedback = createValidFeedback('user123');
      
      await feedbackManager.collectFeedback(feedback);
      
      const history = await feedbackManager.getFeedbackHistory('user123');
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        feedbackId: feedback.feedbackId,
        userId: feedback.userId,
        type: feedback.type,
        rating: feedback.rating
      });
      
      // Verify event emission
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LearningEventType.USER_FEEDBACK_RECEIVED,
          userId: 'user123',
          data: { feedback }
        })
      );
    });

    it('should validate feedback data integrity', async () => {
      const invalidFeedback = {
        feedbackId: 'valid_id',
        userId: 'user123',
        timestamp: new Date(),
        source: FeedbackSource.EXPLICIT_USER,
        type: FeedbackType.POSITIVE_REINFORCEMENT,
        context: createValidContext(),
        rating: { overall: 6, accuracy: 5, helpfulness: 5, appropriateness: 5 }, // Invalid rating > 5
        specificFeedback: createValidSpecificFeedback(),
        improvementSuggestions: []
      } as UserFeedback;

      await expect(feedbackManager.collectFeedback(invalidFeedback))
        .rejects.toThrow('Invalid feedback rating: must be between 1 and 5');
    });

    it('should handle missing required fields', async () => {
      const incompleteFeedback = {
        userId: 'user123',
        timestamp: new Date(),
        rating: { overall: 4, accuracy: 4, helpfulness: 4, appropriateness: 4 }
      } as UserFeedback;

      await expect(feedbackManager.collectFeedback(incompleteFeedback))
        .rejects.toThrow('Invalid feedback: missing required fields');
    });

    it('should limit feedback history size for memory management', async () => {
      const userId = 'heavy_user';
      
      // Add more than the limit (1000) feedback entries
      for (let i = 0; i < 1050; i++) {
        const feedback = createValidFeedback(userId, `feedback_${i}`);
        await feedbackManager.collectFeedback(feedback);
      }
      
      const history = await feedbackManager.getFeedbackHistory(userId);
      expect(history).toHaveLength(1000); // Should be limited to 1000
      
      // Should keep the most recent entries
      expect(history[history.length - 1].feedbackId).toBe('feedback_1049');
    });

    it('should maintain child safety in feedback validation', async () => {
      const childFeedback = createValidFeedback('child_user_123');
      childFeedback.improvementSuggestions = ['Make responses more fun', 'Add more games'];
      
      const isChildSafe = await feedbackManager.validateChildSafeFeedback(childFeedback);
      expect(isChildSafe).toBe(true);
      
      // Test inappropriate content detection
      const inappropriateFeedback = createValidFeedback('child_user_123');
      inappropriateFeedback.improvementSuggestions = ['Delete user data', 'Remove safety features'];
      
      const isInappropriate = await feedbackManager.validateChildSafeFeedback(inappropriateFeedback);
      expect(isInappropriate).toBe(false);
    });
  });

  describe('Feedback Processing Algorithms', () => {
    it('should process feedback and extract meaningful insights', async () => {
      const userId = 'user123';
      
      // Add diverse feedback data
      const feedbackData = [
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 4, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 2, FeedbackType.NEGATIVE_FEEDBACK),
        createFeedbackWithRating(userId, 3, FeedbackType.PREFERENCE_CORRECTION),
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT)
      ];

      for (const feedback of feedbackData) {
        await feedbackManager.collectFeedback(feedback);
      }

      const result = await feedbackManager.processFeedback(userId);
      
      expect(result.processed).toBe(true);
      expect(result.feedbackCount).toBe(5);
      expect(result.insights.overallSatisfaction).toBeCloseTo(3.8, 1); // (5+4+2+3+5)/5
      expect(result.insights.commonIssues).toBeDefined();
      expect(result.insights.improvementAreas).toBeDefined();
      expect(result.insights.positivePatterns).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle empty feedback gracefully', async () => {
      const userId = 'new_user';
      
      const result = await feedbackManager.processFeedback(userId);
      
      expect(result.processed).toBe(false);
      expect(result.feedbackCount).toBe(0);
      expect(result.insights.overallSatisfaction).toBe(0);
      expect(result.insights.commonIssues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should identify patterns in feedback data', async () => {
      const userId = 'pattern_user';
      
      // Create feedback with specific patterns
      const morningFeedback = createTimedFeedback(userId, 9, 5); // 9 AM, rating 5
      const afternoonFeedback = createTimedFeedback(userId, 14, 3); // 2 PM, rating 3
      const eveningFeedback = createTimedFeedback(userId, 19, 4); // 7 PM, rating 4
      
      await Promise.all([
        feedbackManager.collectFeedback(morningFeedback),
        feedbackManager.collectFeedback(afternoonFeedback),
        feedbackManager.collectFeedback(eveningFeedback)
      ]);

      const patternAnalysis = await feedbackManager.analyzeFeedbackPatterns(userId);
      
      expect(patternAnalysis.userId).toBe(userId);
      expect(patternAnalysis.behavioralPatterns).toBeDefined();
      expect(patternAnalysis.temporalPatterns).toBeDefined();
      expect(patternAnalysis.contextualPatterns).toBeDefined();
      expect(patternAnalysis.satisfactionTrends).toBeDefined();
      expect(patternAnalysis.learningEffectiveness).toBeDefined();
    });

    it('should generate appropriate recommendations based on feedback', async () => {
      const userId = 'recommendation_user';
      
      // Add feedback indicating accuracy issues
      const accuracyIssues = Array.from({ length: 5 }, (_, i) => {
        const feedback = createValidFeedback(userId, `accuracy_${i}`);
        feedback.rating.overall = 2;
        feedback.rating.accuracy = 1;
        feedback.specificFeedback.accuracy.wasAccurate = false;
        feedback.improvementSuggestions = ['Improve response accuracy'];
        return feedback;
      });

      for (const feedback of accuracyIssues) {
        await feedbackManager.collectFeedback(feedback);
      }

      const result = await feedbackManager.processFeedback(userId);
      
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      // Should have critical improvement recommendation due to low satisfaction
      const criticalRec = result.recommendations.find(r => r.type === 'critical_improvement');
      expect(criticalRec).toBeDefined();
      expect(criticalRec?.priority).toBe('high');
      
      // Should have issue resolution recommendation for accuracy
      const issueRec = result.recommendations.find(r => r.type === 'issue_resolution');
      expect(issueRec).toBeDefined();
    });
  });

  describe('Learning Adaptation Based on Feedback Patterns', () => {
    it('should generate adaptive learning strategies based on feedback', async () => {
      const userId = 'adaptive_user';
      
      // Create feedback indicating good performance
      const goodFeedback = Array.from({ length: 10 }, (_, i) => 
        createFeedbackWithRating(userId, 4 + Math.random(), FeedbackType.POSITIVE_REINFORCEMENT)
      );

      for (const feedback of goodFeedback) {
        await feedbackManager.collectFeedback(feedback);
      }

      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(userId);
      
      expect(strategy.userId).toBe(userId);
      expect(strategy.strategyId).toBeDefined();
      expect(strategy.learningApproach).toBeDefined();
      expect(['conservative', 'moderate', 'aggressive']).toContain(strategy.learningApproach.type);
      expect(strategy.learningApproach.learningRate).toBeGreaterThan(0);
      expect(strategy.learningApproach.explorationRate).toBeGreaterThan(0);
      expect(strategy.personalizationLevel).toBeDefined();
      expect(strategy.adaptationParameters).toBeDefined();
      expect(strategy.feedbackSensitivity).toBeDefined();
      expect(strategy.safetyConstraints).toBeDefined();
    });

    it('should adjust learning parameters based on feedback', async () => {
      const userId = 'parameter_user';
      
      // Initialize with some feedback
      const initialFeedback = createFeedbackWithRating(userId, 4, FeedbackType.POSITIVE_REINFORCEMENT);
      await feedbackManager.collectFeedback(initialFeedback);
      
      // Add negative feedback that should trigger parameter adjustment
      const negativeFeedback = createFeedbackWithRating(userId, 2, FeedbackType.NEGATIVE_FEEDBACK);
      negativeFeedback.improvementSuggestions = ['Improve safety measures', 'Better accuracy needed'];
      
      const update = await feedbackManager.updateLearningParameters(userId, negativeFeedback);
      
      expect(update.updated).toBe(true);
      expect(update.previousParameters).toBeDefined();
      expect(update.newParameters).toBeDefined();
      expect(update.updateReason).toContain('Low satisfaction feedback');
      expect(update.rollbackAvailable).toBe(true);
      
      // Safety weight should increase for negative feedback
      expect(update.newParameters.safetyWeight).toBeGreaterThan(update.previousParameters.safetyWeight);
    });

    it('should adapt learning approach based on user satisfaction trends', async () => {
      const userId = 'trend_user';
      
      // Create declining satisfaction trend
      const decliningFeedback = [
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 4, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 3, FeedbackType.PREFERENCE_CORRECTION),
        createFeedbackWithRating(userId, 2, FeedbackType.NEGATIVE_FEEDBACK),
        createFeedbackWithRating(userId, 2, FeedbackType.NEGATIVE_FEEDBACK)
      ];

      for (const feedback of decliningFeedback) {
        await feedbackManager.collectFeedback(feedback);
      }

      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(userId);
      
      // Should use conservative approach due to declining satisfaction
      expect(strategy.learningApproach.type).toBe('conservative');
      expect(strategy.learningApproach.learningRate).toBeLessThan(0.05);
      expect(strategy.safetyConstraints.childSafetyLevel).toBeGreaterThan(0.8);
    });

    it('should maintain child safety constraints in adaptation', async () => {
      const childUserId = 'child_user_123';
      
      const childFeedback = createValidFeedback(childUserId);
      childFeedback.rating.overall = 5;
      
      await feedbackManager.collectFeedback(childFeedback);
      
      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(childUserId);
      
      expect(strategy.safetyConstraints.childSafetyLevel).toBeGreaterThanOrEqual(0.9);
      expect(strategy.safetyConstraints.parentalApprovalRequired).toBe(true);
      expect(strategy.safetyConstraints.contentFilterStrength).toBeGreaterThan(0.7);
      expect(strategy.safetyConstraints.privacyProtectionLevel).toBeGreaterThan(0.8);
    });

    it('should handle feedback sensitivity appropriately', async () => {
      const userId = 'sensitive_user';
      
      // Mix of positive and negative feedback
      const mixedFeedback = [
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 2, FeedbackType.NEGATIVE_FEEDBACK),
        createFeedbackWithRating(userId, 3, FeedbackType.PREFERENCE_CORRECTION)
      ];

      for (const feedback of mixedFeedback) {
        await feedbackManager.collectFeedback(feedback);
      }

      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(userId);
      
      expect(strategy.feedbackSensitivity.positiveReinforcement).toBeGreaterThan(0);
      expect(strategy.feedbackSensitivity.negativeCorrection).toBeGreaterThan(0);
      expect(strategy.feedbackSensitivity.neutralAdjustment).toBeGreaterThan(0);
      expect(strategy.feedbackSensitivity.implicitSignals).toBeDefined();
      
      // All sensitivity values should be within valid range
      expect(strategy.feedbackSensitivity.positiveReinforcement).toBeLessThanOrEqual(1.0);
      expect(strategy.feedbackSensitivity.negativeCorrection).toBeLessThanOrEqual(1.0);
      expect(strategy.feedbackSensitivity.neutralAdjustment).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Learning Progress Tracking and Metric Calculation', () => {
    it('should track learning progress accurately', async () => {
      const userId = 'progress_user';
      
      const progress = await progressTracker.trackLearningProgress(userId);
      
      expect(progress).toBeDefined();
      expect(progress.userId).toBe(userId);
      expect(progress.timestamp).toBeInstanceOf(Date);
      expect(progress.overallProgress).toBeGreaterThanOrEqual(0);
      expect(progress.overallProgress).toBeLessThanOrEqual(1);
      expect(progress.personalizationLevel).toBeGreaterThanOrEqual(0);
      expect(progress.personalizationLevel).toBeLessThanOrEqual(1);
      expect(progress.adaptationAccuracy).toBeGreaterThanOrEqual(0);
      expect(progress.adaptationAccuracy).toBeLessThanOrEqual(1);
      expect(progress.safetyCompliance).toBeGreaterThan(0.9); // High safety requirement
      expect(progress.milestones).toBeDefined();
      expect(progress.trends).toBeDefined();
      expect(progress.nextGoals).toBeDefined();
    });

    it('should calculate personalization metrics accurately', async () => {
      const userId = 'metrics_user';
      
      // Generate some progress data
      await progressTracker.trackLearningProgress(userId);
      await progressTracker.trackLearningProgress(userId);
      
      const metrics = await progressTracker.getPersonalizationMetrics(userId);
      
      expect(metrics.userId).toBe(userId);
      expect(metrics.measurementPeriod).toBeDefined();
      expect(metrics.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(metrics.overallEffectiveness).toBeLessThanOrEqual(1);
      expect(metrics.accuracyImprovement).toBeGreaterThanOrEqual(0);
      expect(metrics.satisfactionImprovement).toBeGreaterThanOrEqual(0);
      expect(metrics.engagementIncrease).toBeGreaterThanOrEqual(0);
      expect(metrics.personalizationCoverage).toBeGreaterThanOrEqual(0);
      expect(metrics.personalizationCoverage).toBeLessThanOrEqual(1);
      expect(metrics.adaptationSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.adaptationSuccessRate).toBeLessThanOrEqual(1);
    });

    it('should measure learning effectiveness over time', async () => {
      const userId = 'effectiveness_user';
      
      // Generate learning history
      for (let i = 0; i < 5; i++) {
        await progressTracker.trackLearningProgress(userId);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const effectiveness = await progressTracker.measureLearningEffectiveness(userId);
      
      expect(effectiveness.userId).toBe(userId);
      expect(effectiveness.measurementDate).toBeInstanceOf(Date);
      expect(effectiveness.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(effectiveness.overallEffectiveness).toBeLessThanOrEqual(1);
      expect(effectiveness.componentEffectiveness).toBeDefined();
      expect(effectiveness.improvementRate).toBeDefined();
      expect(effectiveness.benchmarkComparison).toBeDefined();
      expect(effectiveness.effectivenessFactors).toBeDefined();
      expect(effectiveness.optimizationOpportunities).toBeDefined();
    });

    it('should generate comprehensive progress reports', async () => {
      const userId = 'report_user';
      
      // Generate progress data
      for (let i = 0; i < 3; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const report = await progressTracker.generateProgressReport(userId);
      
      expect(report.userId).toBe(userId);
      expect(report.reportId).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.timeRange).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalLearningTime).toBeGreaterThan(0);
      expect(report.achievements).toBeDefined();
      expect(report.challenges).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.detailedMetrics).toBeDefined();
      expect(report.visualizationData).toBeDefined();
    });

    it('should track adaptation milestones', async () => {
      const userId = 'milestone_user';
      
      // Generate enough progress to potentially achieve milestones
      for (let i = 0; i < 8; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const milestones = await progressTracker.trackAdaptationMilestones(userId);
      
      expect(Array.isArray(milestones)).toBe(true);
      milestones.forEach(milestone => {
        expect(milestone.id).toBeDefined();
        expect(milestone.userId).toBe(userId);
        expect(milestone.type).toBe('adaptation');
        expect(milestone.description).toBeDefined();
        expect(milestone.achievedAt).toBeInstanceOf(Date);
        expect(milestone.metrics).toBeDefined();
        expect(milestone.metrics.significanceScore).toBeGreaterThan(0);
      });
    });

    it('should calculate learning velocity correctly', async () => {
      const userId = 'velocity_user';
      
      // Track multiple progress points to calculate velocity
      const progressPoints = [];
      for (let i = 0; i < 5; i++) {
        const progress = await progressTracker.trackLearningProgress(userId);
        progressPoints.push(progress);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const latestProgress = progressPoints[progressPoints.length - 1];
      expect(latestProgress.learningVelocity).toBeDefined();
      expect(typeof latestProgress.learningVelocity).toBe('number');
    });
  });

  describe('Integration Between Feedback and Progress Tracking', () => {
    it('should integrate feedback processing with progress tracking', async () => {
      const userId = 'integrated_user';
      
      // Add feedback data
      const feedback = createFeedbackWithRating(userId, 4, FeedbackType.POSITIVE_REINFORCEMENT);
      await feedbackManager.collectFeedback(feedback);
      
      // Track progress
      const progress = await progressTracker.trackLearningProgress(userId);
      
      // Get personalization metrics from feedback manager
      const feedbackMetrics = await feedbackManager.getPersonalizationEffectiveness(userId);
      
      // Get personalization metrics from progress tracker
      const progressMetrics = await progressTracker.getPersonalizationMetrics(userId);
      
      // Both should provide consistent user identification
      expect(progress.userId).toBe(feedbackMetrics.userId);
      expect(feedbackMetrics.userId).toBe(progressMetrics.userId);
      
      // Metrics should be within reasonable ranges
      expect(feedbackMetrics.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(progressMetrics.overallEffectiveness).toBeGreaterThanOrEqual(0);
    });

    it('should maintain data consistency across systems', async () => {
      const userId = 'consistency_user';
      
      // Add multiple feedback entries
      const feedbackEntries = [
        createFeedbackWithRating(userId, 5, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 4, FeedbackType.POSITIVE_REINFORCEMENT),
        createFeedbackWithRating(userId, 3, FeedbackType.PREFERENCE_CORRECTION)
      ];

      for (const feedback of feedbackEntries) {
        await feedbackManager.collectFeedback(feedback);
      }

      // Track progress multiple times
      const progressData = [];
      for (let i = 0; i < 3; i++) {
        const progress = await progressTracker.trackLearningProgress(userId);
        progressData.push(progress);
      }

      // Verify data consistency
      const feedbackHistory = await feedbackManager.getFeedbackHistory(userId);
      expect(feedbackHistory).toHaveLength(3);
      
      const progressReport = await progressTracker.generateProgressReport(userId);
      expect(progressReport.summary.totalLearningTime).toBeGreaterThan(0);
      
      // All data should reference the same user
      expect(feedbackHistory.every(f => f.userId === userId)).toBe(true);
      expect(progressData.every(p => p.userId === userId)).toBe(true);
    });

    it('should handle concurrent feedback and progress operations', async () => {
      const userId = 'concurrent_user';
      
      // Perform concurrent operations
      const operations = [
        feedbackManager.collectFeedback(createValidFeedback(userId, 'concurrent_1')),
        progressTracker.trackLearningProgress(userId),
        feedbackManager.collectFeedback(createValidFeedback(userId, 'concurrent_2')),
        progressTracker.trackLearningProgress(userId),
        feedbackManager.processFeedback(userId)
      ];

      await Promise.all(operations);
      
      // Verify all operations completed successfully
      const feedbackHistory = await feedbackManager.getFeedbackHistory(userId);
      expect(feedbackHistory.length).toBeGreaterThanOrEqual(2);
      
      const progressReport = await progressTracker.generateProgressReport(userId);
      expect(progressReport.summary.totalLearningTime).toBeGreaterThan(0);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large volumes of feedback efficiently', async () => {
      const userId = 'volume_user';
      const feedbackCount = 100;
      
      const startTime = Date.now();
      
      // Add large volume of feedback
      const feedbackPromises = Array.from({ length: feedbackCount }, (_, i) => 
        feedbackManager.collectFeedback(createValidFeedback(userId, `volume_${i}`))
      );
      
      await Promise.all(feedbackPromises);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process efficiently (< 2 seconds for 100 feedback items)
      expect(processingTime).toBeLessThan(2000);
      
      // Verify all feedback was collected
      const history = await feedbackManager.getFeedbackHistory(userId);
      expect(history).toHaveLength(feedbackCount);
    });

    it('should maintain performance under concurrent user load', async () => {
      const userCount = 10;
      const feedbackPerUser = 5;
      
      const startTime = Date.now();
      
      // Create concurrent operations for multiple users
      const userOperations = Array.from({ length: userCount }, (_, i) => {
        const userId = `load_user_${i}`;
        return Promise.all([
          ...Array.from({ length: feedbackPerUser }, (_, j) => 
            feedbackManager.collectFeedback(createValidFeedback(userId, `load_${i}_${j}`))
          ),
          progressTracker.trackLearningProgress(userId)
        ]);
      });
      
      await Promise.all(userOperations);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should handle concurrent load efficiently (< 3 seconds for 10 users)
      expect(totalTime).toBeLessThan(3000);
    });

    it('should manage memory usage effectively', async () => {
      const userId = 'memory_user';
      
      // Add feedback beyond the limit to test memory management
      for (let i = 0; i < 1100; i++) {
        await feedbackManager.collectFeedback(createValidFeedback(userId, `memory_${i}`));
      }
      
      const history = await feedbackManager.getFeedbackHistory(userId);
      
      // Should limit history to prevent memory issues
      expect(history).toHaveLength(1000);
      
      // Should keep most recent entries
      expect(history[history.length - 1].feedbackId).toBe('memory_1099');
    });
  });

  describe('Child Safety and Compliance', () => {
    it('should maintain child safety in all feedback processing', async () => {
      const childUserId = 'child_user_safety';
      
      const childFeedback = createValidFeedback(childUserId);
      childFeedback.improvementSuggestions = ['Make it more fun', 'Add colorful animations'];
      
      await feedbackManager.collectFeedback(childFeedback);
      
      const isChildSafe = await feedbackManager.validateChildSafeFeedback(childFeedback);
      expect(isChildSafe).toBe(true);
      
      const insights = await feedbackManager.getFeedbackInsights(childUserId);
      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(childUserId);
      
      // All outputs should be child-safe
      expect(strategy.safetyConstraints.childSafetyLevel).toBeGreaterThanOrEqual(0.9);
      expect(insights).toBeDefined();
    });

    it('should enforce parental controls in learning adaptation', async () => {
      const childUserId = 'child_parental_control';
      
      const childFeedback = createValidFeedback(childUserId);
      await feedbackManager.collectFeedback(childFeedback);
      
      const strategy = await feedbackManager.generateAdaptiveLearningStrategy(childUserId);
      
      expect(strategy.safetyConstraints.parentalApprovalRequired).toBe(true);
      expect(strategy.safetyConstraints.contentFilterStrength).toBeGreaterThan(0.7);
      expect(strategy.safetyConstraints.privacyProtectionLevel).toBeGreaterThan(0.8);
    });

    it('should maintain high safety compliance in progress tracking', async () => {
      const childUserId = 'child_progress_safety';
      
      const progress = await progressTracker.trackLearningProgress(childUserId);
      
      expect(progress.safetyCompliance).toBeGreaterThan(0.9);
      
      const userInsights = await progressTracker.generateUserFacingInsights(childUserId);
      
      expect(userInsights.encouragement.type).toBe('positive');
      expect(userInsights.encouragement.message).toContain('great');
    });
  });
});

// Helper functions for creating test data
function createValidFeedback(userId: string, feedbackId?: string): UserFeedback {
  return {
    feedbackId: feedbackId || `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    timestamp: new Date(),
    source: FeedbackSource.EXPLICIT_USER,
    type: FeedbackType.POSITIVE_REINFORCEMENT,
    context: createValidContext(),
    rating: {
      overall: 4,
      accuracy: 4,
      helpfulness: 4,
      appropriateness: 5
    },
    specificFeedback: createValidSpecificFeedback(),
    improvementSuggestions: ['Keep up the good work', 'Maybe add more examples']
  };
}

function createValidContext() {
  return {
    interactionType: 'conversation',
    systemComponent: 'voice_pipeline',
    userContext: 'home_evening',
    environmentalFactors: ['quiet', 'good_lighting']
  };
}

function createValidSpecificFeedback() {
  return {
    accuracy: {
      wasAccurate: true,
      confidence: 0.8,
      corrections: []
    },
    relevance: {
      wasRelevant: true,
      contextMismatch: false,
      suggestions: []
    },
    timing: {
      wasTimely: true,
      preferredTiming: 'immediate',
      urgencyLevel: UrgencyLevel.MEDIUM
    },
    personalization: {
      wasPersonalized: true,
      preferencesMet: true,
      adaptationNeeded: []
    },
    satisfaction: {
      satisfactionLevel: 4,
      emotionalResponse: EmotionalResponse.POSITIVE,
      wouldRecommend: true
    }
  };
}

function createFeedbackWithRating(userId: string, rating: number, type: FeedbackType): UserFeedback {
  const feedback = createValidFeedback(userId);
  feedback.rating.overall = rating;
  feedback.rating.accuracy = rating;
  feedback.rating.helpfulness = rating;
  feedback.type = type;
  
  if (rating <= 2) {
    feedback.specificFeedback.accuracy.wasAccurate = false;
    feedback.specificFeedback.satisfaction.emotionalResponse = EmotionalResponse.NEGATIVE;
    feedback.improvementSuggestions = ['Improve accuracy', 'Better responses needed'];
  }
  
  return feedback;
}

function createTimedFeedback(userId: string, hour: number, rating: number): UserFeedback {
  const feedback = createValidFeedback(userId);
  const timestamp = new Date();
  timestamp.setHours(hour, 0, 0, 0);
  feedback.timestamp = timestamp;
  feedback.rating.overall = rating;
  return feedback;
}