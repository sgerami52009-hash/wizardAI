// Learning Progress Tracker Tests

import { 
  DefaultLearningProgressTracker, 
  LearningProgress, 
  ProgressReport,
  LearningInsights,
  BehaviorSummary,
  EffectivenessReport,
  AdaptationMilestone,
  UserFacingInsights
} from './progress-tracker';
import { LearningEventBus } from './events';
import { PersonalizationMetrics } from './feedback';

describe('DefaultLearningProgressTracker', () => {
  let progressTracker: DefaultLearningProgressTracker;
  let mockEventBus: jest.Mocked<LearningEventBus>;

  beforeEach(() => {
    mockEventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    progressTracker = new DefaultLearningProgressTracker(mockEventBus);
  });

  describe('trackLearningProgress', () => {
    it('should track progress for a new user', async () => {
      const userId = 'user123';
      
      const progress = await progressTracker.trackLearningProgress(userId);
      
      expect(progress).toBeDefined();
      expect(progress.userId).toBe(userId);
      expect(progress.timestamp).toBeInstanceOf(Date);
      expect(progress.overallProgress).toBeGreaterThanOrEqual(0);
      expect(progress.overallProgress).toBeLessThanOrEqual(1);
      expect(progress.safetyCompliance).toBeGreaterThan(0.9); // High safety compliance required
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'learning_progress_updated',
          userId
        })
      );
    });

    it('should maintain progress history', async () => {
      const userId = 'user123';
      
      const progress1 = await progressTracker.trackLearningProgress(userId);
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const progress2 = await progressTracker.trackLearningProgress(userId);
      
      expect(progress2.timestamp.getTime()).toBeGreaterThanOrEqual(progress1.timestamp.getTime());
      expect(mockEventBus.emit).toHaveBeenCalledTimes(2);
    });

    it('should calculate learning velocity correctly', async () => {
      const userId = 'user123';
      
      // Track multiple progress points
      await progressTracker.trackLearningProgress(userId);
      await progressTracker.trackLearningProgress(userId);
      const progress = await progressTracker.trackLearningProgress(userId);
      
      expect(progress.learningVelocity).toBeDefined();
      expect(typeof progress.learningVelocity).toBe('number');
    });

    it('should include safety compliance metrics', async () => {
      const userId = 'child_user_123';
      
      const progress = await progressTracker.trackLearningProgress(userId);
      
      expect(progress.safetyCompliance).toBeGreaterThan(0.9);
      expect(progress.safetyCompliance).toBeLessThanOrEqual(1.0);
    });
  });

  describe('generateProgressReport', () => {
    it('should generate empty report for new user', async () => {
      const userId = 'new_user';
      
      const report = await progressTracker.generateProgressReport(userId);
      
      expect(report).toBeDefined();
      expect(report.userId).toBe(userId);
      expect(report.reportId).toBeDefined();
      expect(report.summary.milestonesAchieved).toBe(0);
      expect(report.achievements).toHaveLength(0);
      expect(report.challenges).toHaveLength(0);
    });

    it('should generate comprehensive report for active user', async () => {
      const userId = 'active_user';
      
      // Generate some progress history
      await progressTracker.trackLearningProgress(userId);
      await progressTracker.trackLearningProgress(userId);
      await progressTracker.trackLearningProgress(userId);
      
      const report = await progressTracker.generateProgressReport(userId);
      
      expect(report.summary).toBeDefined();
      expect(report.summary.totalLearningTime).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.achievements)).toBe(true);
      expect(Array.isArray(report.challenges)).toBe(true);
    });

    it('should filter report by time range', async () => {
      const userId = 'user123';
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      await progressTracker.trackLearningProgress(userId);
      
      const report = await progressTracker.generateProgressReport(userId, {
        start: yesterday,
        end: now
      });
      
      expect(report.timeRange.start).toEqual(yesterday);
      expect(report.timeRange.end).toEqual(now);
    });

    it('should include child-safe content in reports', async () => {
      const userId = 'child_user';
      
      await progressTracker.trackLearningProgress(userId);
      const report = await progressTracker.generateProgressReport(userId);
      
      // Ensure report content is appropriate for children
      expect(report.summary).toBeDefined();
      expect(report.achievements).toBeDefined();
      // No inappropriate content should be present
      const reportString = JSON.stringify(report);
      expect(reportString).not.toMatch(/delete|remove|disable|fail/i);
    });
  });

  describe('getLearningInsights', () => {
    it('should provide empty insights for new user', async () => {
      const userId = 'new_user';
      
      const insights = await progressTracker.getLearningInsights(userId);
      
      expect(insights).toBeDefined();
      expect(insights.userId).toBe(userId);
      expect(insights.learningPatterns).toHaveLength(0);
      expect(insights.strengthAreas).toHaveLength(0);
      expect(insights.improvementAreas).toHaveLength(0);
      expect(insights.confidenceLevel).toBeLessThan(0.5); // Low confidence for new users
    });

    it('should provide meaningful insights for experienced user', async () => {
      const userId = 'experienced_user';
      
      // Generate sufficient progress history
      for (let i = 0; i < 10; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const insights = await progressTracker.getLearningInsights(userId);
      
      expect(insights.confidenceLevel).toBeGreaterThan(0.5);
      expect(insights.nextAnalysisDate).toBeInstanceOf(Date);
      expect(insights.nextAnalysisDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should maintain child safety in insights', async () => {
      const userId = 'child_user';
      
      await progressTracker.trackLearningProgress(userId);
      const insights = await progressTracker.getLearningInsights(userId);
      
      // Ensure insights are child-appropriate
      expect(insights).toBeDefined();
      expect(insights.personalizedRecommendations).toBeDefined();
    });
  });

  describe('getBehaviorSummary', () => {
    it('should provide empty summary for new user', async () => {
      const userId = 'new_user';
      
      const summary = await progressTracker.getBehaviorSummary(userId);
      
      expect(summary).toBeDefined();
      expect(summary.userId).toBe(userId);
      expect(summary.behaviorPatterns).toHaveLength(0);
      expect(summary.behaviorStability).toBeDefined();
      expect(summary.adaptationReadiness).toBeDefined();
    });

    it('should analyze behavior patterns for active user', async () => {
      const userId = 'active_user';
      
      // Generate behavior data
      for (let i = 0; i < 5; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const summary = await progressTracker.getBehaviorSummary(userId);
      
      expect(summary.summaryDate).toBeInstanceOf(Date);
      expect(summary.behaviorStability).toBeGreaterThanOrEqual(0);
      expect(summary.behaviorStability).toBeLessThanOrEqual(1);
      expect(summary.adaptationReadiness).toBeGreaterThanOrEqual(0);
      expect(summary.adaptationReadiness).toBeLessThanOrEqual(1);
    });
  });

  describe('measureLearningEffectiveness', () => {
    it('should provide empty effectiveness report for new user', async () => {
      const userId = 'new_user';
      
      const report = await progressTracker.measureLearningEffectiveness(userId);
      
      expect(report).toBeDefined();
      expect(report.userId).toBe(userId);
      expect(report.overallEffectiveness).toBe(0);
      expect(report.improvementRate).toBe(0);
      expect(report.effectivenessFactors).toHaveLength(0);
    });

    it('should measure effectiveness for active user', async () => {
      const userId = 'active_user';
      
      // Generate learning data
      for (let i = 0; i < 8; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const report = await progressTracker.measureLearningEffectiveness(userId);
      
      expect(report.measurementDate).toBeInstanceOf(Date);
      expect(report.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(report.overallEffectiveness).toBeLessThanOrEqual(1);
      expect(report.componentEffectiveness).toBeDefined();
      expect(report.optimizationOpportunities).toBeDefined();
    });
  });

  describe('getPersonalizationMetrics', () => {
    it('should provide empty metrics for new user', async () => {
      const userId = 'new_user';
      
      const metrics = await progressTracker.getPersonalizationMetrics(userId);
      
      expect(metrics).toBeDefined();
      expect(metrics.userId).toBe(userId);
      expect(metrics.overallEffectiveness).toBe(0);
      expect(metrics.accuracyImprovement).toBe(0);
      expect(metrics.satisfactionImprovement).toBe(0);
      expect(metrics.measurementPeriod).toBeDefined();
    });

    it('should calculate personalization metrics for active user', async () => {
      const userId = 'active_user';
      
      // Generate personalization data
      for (let i = 0; i < 6; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const metrics = await progressTracker.getPersonalizationMetrics(userId);
      
      expect(metrics.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(metrics.overallEffectiveness).toBeLessThanOrEqual(1);
      expect(metrics.personalizationCoverage).toBeGreaterThanOrEqual(0);
      expect(metrics.personalizationCoverage).toBeLessThanOrEqual(1);
      expect(metrics.adaptationSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.adaptationSuccessRate).toBeLessThanOrEqual(1);
    });
  });

  describe('trackAdaptationMilestones', () => {
    it('should return empty array for new user', async () => {
      const userId = 'new_user';
      
      const milestones = await progressTracker.trackAdaptationMilestones(userId);
      
      expect(milestones).toHaveLength(0);
    });

    it('should track adaptation milestones for progressing user', async () => {
      const userId = 'progressing_user';
      
      // Generate progress to potentially achieve milestones
      for (let i = 0; i < 10; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const milestones = await progressTracker.trackAdaptationMilestones(userId);
      
      expect(Array.isArray(milestones)).toBe(true);
      // Milestones should be adaptation-specific
      milestones.forEach(milestone => {
        expect(milestone.type).toBe('adaptation');
        expect(milestone.userId).toBe(userId);
      });
    });
  });

  describe('generateUserFacingInsights', () => {
    it('should generate child-friendly insights', async () => {
      const userId = 'child_user';
      
      await progressTracker.trackLearningProgress(userId);
      const insights = await progressTracker.generateUserFacingInsights(userId);
      
      expect(insights).toBeDefined();
      expect(insights.userId).toBe(userId);
      expect(insights.achievements).toBeDefined();
      expect(insights.learningHighlights).toBeDefined();
      expect(insights.personalizedTips).toBeDefined();
      expect(insights.encouragement).toBeDefined();
      expect(insights.encouragement.type).toBe('positive');
      expect(insights.progressVisualization).toBeDefined();
      expect(insights.nextSteps).toBeDefined();
    });

    it('should provide encouraging messages', async () => {
      const userId = 'user123';
      
      await progressTracker.trackLearningProgress(userId);
      const insights = await progressTracker.generateUserFacingInsights(userId);
      
      expect(insights.encouragement.message).toContain('great');
      expect(insights.encouragement.type).toBe('positive');
    });

    it('should suggest appropriate next steps', async () => {
      const userId = 'user123';
      
      // Generate some progress
      for (let i = 0; i < 3; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const insights = await progressTracker.generateUserFacingInsights(userId);
      
      expect(insights.nextSteps).toBeDefined();
      expect(Array.isArray(insights.nextSteps)).toBe(true);
    });
  });

  describe('Child Safety Compliance', () => {
    it('should maintain high safety compliance for all users', async () => {
      const userIds = ['child_user', 'teen_user', 'adult_user'];
      
      for (const userId of userIds) {
        const progress = await progressTracker.trackLearningProgress(userId);
        expect(progress.safetyCompliance).toBeGreaterThan(0.9);
      }
    });

    it('should generate child-appropriate content in all outputs', async () => {
      const userId = 'child_user';
      
      await progressTracker.trackLearningProgress(userId);
      
      const [report, insights, summary, userInsights] = await Promise.all([
        progressTracker.generateProgressReport(userId),
        progressTracker.getLearningInsights(userId),
        progressTracker.getBehaviorSummary(userId),
        progressTracker.generateUserFacingInsights(userId)
      ]);

      // Check that all outputs are child-safe
      const allContent = JSON.stringify([report, insights, summary, userInsights]);
      expect(allContent).not.toMatch(/inappropriate|unsafe|adult|violence/i);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle multiple users efficiently', async () => {
      const userIds = Array.from({ length: 10 }, (_, i) => `user_${i}`);
      
      const startTime = Date.now();
      
      // Track progress for multiple users
      await Promise.all(
        userIds.map(userId => progressTracker.trackLearningProgress(userId))
      );
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (< 1 second for 10 users)
      expect(executionTime).toBeLessThan(1000);
    });

    it('should limit memory usage by maintaining reasonable history size', async () => {
      const userId = 'heavy_user';
      
      // Generate extensive progress history
      for (let i = 0; i < 50; i++) {
        await progressTracker.trackLearningProgress(userId);
      }
      
      const report = await progressTracker.generateProgressReport(userId);
      
      // Should still function correctly with large history
      expect(report).toBeDefined();
      expect(report.summary.totalLearningTime).toBeGreaterThan(0);
    });
  });

  describe('Integration with Learning System', () => {
    it('should emit appropriate events during progress tracking', async () => {
      const userId = 'user123';
      
      await progressTracker.trackLearningProgress(userId);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'learning_progress_updated',
          userId,
          data: expect.objectContaining({
            progress: expect.any(Object)
          })
        })
      );
    });

    it('should handle event bus failures gracefully', async () => {
      const userId = 'user123';
      mockEventBus.emit.mockRejectedValue(new Error('Event bus error'));
      
      // Should not throw error even if event emission fails
      await expect(progressTracker.trackLearningProgress(userId)).resolves.toBeDefined();
    });
  });
});

// Integration tests with other learning components
describe('LearningProgressTracker Integration', () => {
  let progressTracker: DefaultLearningProgressTracker;
  let eventBus: LearningEventBus;

  beforeEach(() => {
    eventBus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    } as any;

    progressTracker = new DefaultLearningProgressTracker(eventBus);
  });

  it('should integrate with feedback system for comprehensive tracking', async () => {
    const userId = 'integrated_user';
    
    // Simulate learning progress with feedback integration
    const progress = await progressTracker.trackLearningProgress(userId);
    const metrics = await progressTracker.getPersonalizationMetrics(userId);
    
    expect(progress).toBeDefined();
    expect(metrics).toBeDefined();
    expect(progress.userId).toBe(metrics.userId);
  });

  it('should provide consistent data across different tracking methods', async () => {
    const userId = 'consistent_user';
    
    const [progress, insights, summary] = await Promise.all([
      progressTracker.trackLearningProgress(userId),
      progressTracker.getLearningInsights(userId),
      progressTracker.getBehaviorSummary(userId)
    ]);

    expect(progress.userId).toBe(insights.userId);
    expect(insights.userId).toBe(summary.userId);
    expect(progress.timestamp.getTime()).toBeCloseTo(insights.analysisDate.getTime(), -3);
  });
});