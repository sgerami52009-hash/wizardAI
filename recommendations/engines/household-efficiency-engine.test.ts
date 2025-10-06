/**
 * Tests for Household Efficiency Engine
 */

import { HouseholdEfficiencyEngine } from './household-efficiency-engine';
import { OptimizationType, DifficultyLevel } from '../enums';

describe('HouseholdEfficiencyEngine', () => {
  let engine: HouseholdEfficiencyEngine;

  beforeEach(() => {
    engine = new HouseholdEfficiencyEngine();
  });

  describe('analyzeHouseholdPatterns', () => {
    it('should analyze household patterns and return efficiency analysis', async () => {
      const familyId = 'test_family_123';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      expect(analysis).toBeDefined();
      expect(analysis.familyId).toBe(familyId);
      expect(analysis.analysisId).toContain('analysis_');
      expect(analysis.inefficiencies).toBeInstanceOf(Array);
      expect(analysis.opportunities).toBeInstanceOf(Array);
      expect(analysis.currentMetrics).toBeDefined();
      expect(analysis.projectedImprovements).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it('should identify inefficiencies in household patterns', async () => {
      const familyId = 'test_family_123';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      expect(analysis.inefficiencies.length).toBeGreaterThan(0);
      
      const inefficiency = analysis.inefficiencies[0];
      expect(inefficiency.type).toBeDefined();
      expect(inefficiency.description).toBeDefined();
      expect(inefficiency.impact).toBeDefined();
      expect(inefficiency.solutions).toBeInstanceOf(Array);
    });

    it('should identify optimization opportunities', async () => {
      const familyId = 'test_family_123';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      expect(analysis.opportunities.length).toBeGreaterThan(0);
      
      const opportunity = analysis.opportunities[0];
      expect(Object.values(OptimizationType)).toContain(opportunity.type);
      expect(opportunity.description).toBeDefined();
      expect(opportunity.potentialBenefit).toBeDefined();
      expect(Object.values(DifficultyLevel)).toContain(opportunity.implementationEffort);
    });
  });

  describe('recommendTaskOptimizations', () => {
    it('should recommend task optimizations', async () => {
      const familyId = 'test_family_123';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      expect(optimizations).toBeInstanceOf(Array);
      
      if (optimizations.length > 0) {
        const optimization = optimizations[0];
        expect(optimization.taskId).toBeDefined();
        expect(optimization.currentApproach).toBeDefined();
        expect(optimization.optimizedApproach).toBeDefined();
        expect(optimization.timeSavings).toBeGreaterThan(0);
        expect(optimization.familyImpact).toBeDefined();
      }
    });

    it('should sort optimizations by impact', async () => {
      const familyId = 'test_family_123';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      if (optimizations.length > 1) {
        for (let i = 0; i < optimizations.length - 1; i++) {
          const currentImpact = optimizations[i].timeSavings + optimizations[i].effortReduction;
          const nextImpact = optimizations[i + 1].timeSavings + optimizations[i + 1].effortReduction;
          expect(currentImpact).toBeGreaterThanOrEqual(nextImpact);
        }
      }
    });
  });

  describe('suggestAutomationOpportunities', () => {
    it('should suggest automation opportunities', async () => {
      const familyId = 'test_family_123';
      
      const suggestions = await engine.suggestAutomationOpportunities(familyId);
      
      expect(suggestions).toBeInstanceOf(Array);
      
      if (suggestions.length > 0) {
        const suggestion = suggestions[0];
        expect(suggestion.id).toBeDefined();
        expect(suggestion.title).toBeDefined();
        expect(suggestion.automationMethod).toBeDefined();
        expect(suggestion.monthlySavings).toBeGreaterThan(0);
        expect(Object.values(DifficultyLevel)).toContain(suggestion.setupComplexity);
      }
    });

    it('should sort suggestions by monthly savings', async () => {
      const familyId = 'test_family_123';
      
      const suggestions = await engine.suggestAutomationOpportunities(familyId);
      
      if (suggestions.length > 1) {
        for (let i = 0; i < suggestions.length - 1; i++) {
          expect(suggestions[i].monthlySavings).toBeGreaterThanOrEqual(suggestions[i + 1].monthlySavings);
        }
      }
    });
  });

  describe('trackHouseholdMetrics', () => {
    it('should track household metrics', async () => {
      const familyId = 'test_family_123';
      
      const metrics = await engine.trackHouseholdMetrics(familyId);
      
      expect(metrics).toBeDefined();
      expect(metrics.timeEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.timeEfficiency).toBeLessThanOrEqual(1);
      expect(metrics.stressLevel).toBeGreaterThanOrEqual(0);
      expect(metrics.stressLevel).toBeLessThanOrEqual(10);
      expect(metrics.taskCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.taskCompletionRate).toBeLessThanOrEqual(1);
      expect(metrics.resourceUtilization).toBeGreaterThanOrEqual(0);
      expect(metrics.resourceUtilization).toBeLessThanOrEqual(1);
      expect(metrics.familySatisfaction).toBeGreaterThanOrEqual(0);
      expect(metrics.familySatisfaction).toBeLessThanOrEqual(10);
      expect(metrics.automationLevel).toBeGreaterThanOrEqual(0);
      expect(metrics.automationLevel).toBeLessThanOrEqual(1);
    });
  });

  describe('stress reduction and time-saving features', () => {
    it('should assess stress impact', async () => {
      const familyId = 'test_family_123';
      
      // First analyze patterns to populate data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const stressAssessment = await engine.assessStressImpact(familyId, []);
      
      expect(stressAssessment).toBeDefined();
      expect(stressAssessment.stressLevel).toBeGreaterThanOrEqual(0);
      expect(stressAssessment.stressLevel).toBeLessThanOrEqual(10);
      expect(stressAssessment.stressFactors).toBeInstanceOf(Array);
      expect(stressAssessment.impactAreas).toBeInstanceOf(Array);
      expect(stressAssessment.mitigationStrategies).toBeInstanceOf(Array);
      expect(['low', 'medium', 'high', 'critical']).toContain(stressAssessment.urgency);
    });

    it('should identify time-saving opportunities', async () => {
      const familyId = 'test_family_123';
      
      // First analyze patterns to populate data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const opportunities = await engine.identifyTimeSavingOpportunities(familyId);
      
      expect(opportunities).toBeInstanceOf(Array);
      
      if (opportunities.length > 0) {
        const opportunity = opportunities[0];
        expect(opportunity.opportunityId).toBeDefined();
        expect(opportunity.description).toBeDefined();
        expect(opportunity.potentialTimeSaved).toBeGreaterThan(0);
        expect(Object.values(DifficultyLevel)).toContain(opportunity.implementationEffort);
        expect(opportunity.priority).toBeGreaterThan(0);
      }
    });

    it('should generate adaptive strategies', async () => {
      const familyId = 'test_family_123';
      
      // First analyze patterns to populate data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const strategies = await engine.generateAdaptiveStrategies(familyId);
      
      expect(strategies).toBeInstanceOf(Array);
      
      if (strategies.length > 0) {
        const strategy = strategies[0];
        expect(strategy.strategyId).toBeDefined();
        expect(strategy.triggerConditions).toBeInstanceOf(Array);
        expect(strategy.adaptations).toBeInstanceOf(Array);
        expect(strategy.effectiveness).toBeGreaterThanOrEqual(0);
        expect(strategy.effectiveness).toBeLessThanOrEqual(1);
      }
    });

    it('should prioritize stress reduction optimizations', async () => {
      const familyId = 'test_family_123';
      
      // First analyze patterns to populate data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const stressOptimizations = await engine.prioritizeStressReduction(familyId);
      
      expect(stressOptimizations).toBeInstanceOf(Array);
      
      // All optimizations should have positive family impact
      stressOptimizations.forEach(opt => {
        expect(opt.familyImpact.overallBenefit).toBeGreaterThan(0);
      });
    });

    it('should optimize for time efficiency', async () => {
      const familyId = 'test_family_123';
      
      // First analyze patterns to populate data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const routineChanges = await engine.optimizeForTimeEfficiency(familyId);
      
      expect(routineChanges).toBeInstanceOf(Array);
      
      if (routineChanges.length > 0) {
        const change = routineChanges[0];
        expect(change.routineId).toBeDefined();
        expect(change.changeType).toBeDefined();
        expect(change.description).toBeDefined();
        expect(change.impact.timeImpact).toBeGreaterThan(0);
      }
    });
  });

  describe('pattern analysis and inefficiency detection', () => {
    it('should detect time waste inefficiencies in low-efficiency patterns', async () => {
      const familyId = 'test_family_pattern_analysis';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Should identify time waste inefficiencies
      const timeWasteInefficiencies = analysis.inefficiencies.filter(i => i.type === 'time_waste');
      expect(timeWasteInefficiencies.length).toBeGreaterThan(0);
      
      const inefficiency = timeWasteInefficiencies[0];
      expect(inefficiency.description).toContain('low efficiency');
      expect(inefficiency.impact.timeImpact).toBeLessThan(0); // Negative impact (time wasted)
      expect(inefficiency.solutions).toContain('Optimize task sequence');
      expect(inefficiency.rootCause).toBeDefined();
    });

    it('should detect poor scheduling inefficiencies in high-stress patterns', async () => {
      const familyId = 'test_family_stress_analysis';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Should identify poor scheduling inefficiencies
      const schedulingInefficiencies = analysis.inefficiencies.filter(i => i.type === 'poor_scheduling');
      expect(schedulingInefficiencies.length).toBeGreaterThan(0);
      
      const inefficiency = schedulingInefficiencies[0];
      expect(inefficiency.description).toContain('high stress');
      expect(inefficiency.impact.stressImpact).toBeGreaterThan(0); // Positive stress impact
      expect(inefficiency.impact.familyImpact).toBeLessThan(0); // Negative family impact
      expect(inefficiency.solutions).toContain('Adjust timing');
      expect(inefficiency.rootCause).toContain('Time pressure');
    });

    it('should identify time-saving optimization opportunities', async () => {
      const familyId = 'test_family_optimization';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Should identify time-saving opportunities
      const timeSavingOpportunities = analysis.opportunities.filter(o => o.type === OptimizationType.TIME_SAVING);
      expect(timeSavingOpportunities.length).toBeGreaterThan(0);
      
      const opportunity = timeSavingOpportunities[0];
      expect(opportunity.description).toContain('better coordination');
      expect(opportunity.potentialBenefit.timeImpact).toBeGreaterThan(0); // Positive time impact
      expect(opportunity.potentialBenefit.stressImpact).toBeLessThan(0); // Negative stress impact (reduction)
      expect(opportunity.prerequisites).toContain('Family coordination');
      expect(opportunity.timeline).toBeGreaterThan(0);
    });

    it('should identify routine optimization opportunities for multi-participant patterns', async () => {
      const familyId = 'test_family_routine_opt';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Should identify routine optimization opportunities
      const routineOpportunities = analysis.opportunities.filter(o => o.type === OptimizationType.ROUTINE_OPTIMIZATION);
      expect(routineOpportunities.length).toBeGreaterThan(0);
      
      const opportunity = routineOpportunities[0];
      expect(opportunity.description).toContain('Parallelize tasks');
      expect(opportunity.potentialBenefit.timeImpact).toBeGreaterThan(0);
      expect(opportunity.implementationEffort).toBe(DifficultyLevel.EASY);
      expect(opportunity.prerequisites).toContain('Task coordination');
    });

    it('should calculate accurate current metrics from patterns', async () => {
      const familyId = 'test_family_metrics';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Verify metrics calculation
      expect(analysis.currentMetrics.timeEfficiency).toBeGreaterThan(0);
      expect(analysis.currentMetrics.timeEfficiency).toBeLessThanOrEqual(1);
      expect(analysis.currentMetrics.stressLevel).toBeGreaterThan(0);
      expect(analysis.currentMetrics.stressLevel).toBeLessThanOrEqual(10);
      expect(analysis.currentMetrics.taskCompletionRate).toBe(0.8);
      expect(analysis.currentMetrics.resourceUtilization).toBe(0.7);
      expect(analysis.currentMetrics.familySatisfaction).toBe(7);
      expect(analysis.currentMetrics.automationLevel).toBe(0.3);
    });

    it('should project realistic improvements from opportunities', async () => {
      const familyId = 'test_family_projections';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      // Verify projected improvements are realistic
      expect(analysis.projectedImprovements.timeEfficiency).toBeGreaterThan(analysis.currentMetrics.timeEfficiency);
      expect(analysis.projectedImprovements.timeEfficiency).toBeLessThanOrEqual(1);
      expect(analysis.projectedImprovements.stressLevel).toBeLessThan(analysis.currentMetrics.stressLevel);
      expect(analysis.projectedImprovements.stressLevel).toBeGreaterThanOrEqual(1);
      expect(analysis.projectedImprovements.taskCompletionRate).toBeGreaterThanOrEqual(analysis.currentMetrics.taskCompletionRate);
      expect(analysis.projectedImprovements.familySatisfaction).toBeGreaterThan(analysis.currentMetrics.familySatisfaction);
    });

    it('should generate contextual recommendations based on analysis', async () => {
      const familyId = 'test_family_recommendations';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      
      // Should include time waste recommendation
      expect(analysis.recommendations).toContain('Focus on eliminating time waste in daily routines');
      
      // Should include scheduling recommendation
      expect(analysis.recommendations).toContain('Improve scheduling to reduce stress and conflicts');
      
      // Should include optimization recommendation
      expect(analysis.recommendations).toContain('Implement time optimization strategies for high-impact routines');
      
      // Should include easy wins recommendation
      expect(analysis.recommendations).toContain('Start with easy-to-implement improvements for quick wins');
    });
  });

  describe('task optimization algorithms', () => {
    it('should create valid task optimizations for inefficient tasks', async () => {
      const familyId = 'test_family_task_opt';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      expect(optimizations.length).toBeGreaterThan(0);
      
      const optimization = optimizations[0];
      
      // Verify optimization structure
      expect(optimization.id).toContain('opt_');
      expect(optimization.title).toContain('Optimize');
      expect(optimization.description).toBeDefined();
      expect(optimization.confidence).toBeGreaterThan(0);
      expect(optimization.confidence).toBeLessThanOrEqual(1);
      expect(optimization.reasoning).toBeInstanceOf(Array);
      expect(optimization.reasoning.length).toBeGreaterThan(0);
      
      // Verify approaches comparison
      expect(optimization.currentApproach.method).toBeDefined();
      expect(optimization.optimizedApproach.method).toBeDefined();
      expect(optimization.optimizedApproach.timeRequired).toBeLessThan(optimization.currentApproach.timeRequired);
      expect(optimization.optimizedApproach.successRate).toBeGreaterThan(optimization.currentApproach.successRate);
      
      // Verify benefits
      expect(optimization.timeSavings).toBeGreaterThan(0);
      expect(optimization.effortReduction).toBeGreaterThan(0);
      expect(Object.values(DifficultyLevel)).toContain(optimization.implementationDifficulty);
      
      // Verify family impact assessment
      expect(optimization.familyImpact.affectedMembers).toBeInstanceOf(Array);
      expect(optimization.familyImpact.disruptionLevel).toBeDefined();
      expect(optimization.familyImpact.adaptationTime).toBeGreaterThan(0);
      expect(optimization.familyImpact.overallBenefit).toBeGreaterThan(0);
      expect(optimization.familyImpact.benefits).toBeInstanceOf(Array);
    });

    it('should prioritize optimizations by combined impact', async () => {
      const familyId = 'test_family_prioritization';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      if (optimizations.length > 1) {
        for (let i = 0; i < optimizations.length - 1; i++) {
          const currentCombinedImpact = optimizations[i].timeSavings + optimizations[i].effortReduction;
          const nextCombinedImpact = optimizations[i + 1].timeSavings + optimizations[i + 1].effortReduction;
          expect(currentCombinedImpact).toBeGreaterThanOrEqual(nextCombinedImpact);
        }
      }
    });

    it('should validate task optimization metadata', async () => {
      const familyId = 'test_family_metadata';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      if (optimizations.length > 0) {
        const optimization = optimizations[0];
        
        expect(optimization.metadata).toBeDefined();
        expect(optimization.metadata.generatedAt).toBeInstanceOf(Date);
        expect(optimization.metadata.userId).toBeDefined();
        expect(optimization.metadata.contextId).toContain('task_');
        expect(optimization.metadata.engineVersion).toBe('1.0.0');
        expect(optimization.metadata.safetyValidated).toBe(true);
        expect(optimization.metadata.privacyCompliant).toBe(true);
      }
    });

    it('should handle tasks with no bottlenecks gracefully', async () => {
      const familyId = 'test_family_no_bottlenecks';
      
      // This should not throw an error even if some tasks have no bottlenecks
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      
      expect(optimizations).toBeInstanceOf(Array);
      // May be empty if no tasks need optimization
    });
  });

  describe('adaptive strategy recommendations', () => {
    it('should generate adaptive strategies for common disruptions', async () => {
      const familyId = 'test_family_adaptive';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const strategies = await engine.generateAdaptiveStrategies(familyId);
      
      expect(strategies).toBeInstanceOf(Array);
      
      if (strategies.length > 0) {
        const strategy = strategies[0];
        
        // Verify strategy structure
        expect(strategy.strategyId).toBeDefined();
        expect(strategy.triggerConditions).toBeInstanceOf(Array);
        expect(strategy.triggerConditions.length).toBeGreaterThan(0);
        expect(strategy.adaptations).toBeInstanceOf(Array);
        expect(strategy.adaptations.length).toBeGreaterThan(0);
        expect(strategy.effectiveness).toBeGreaterThanOrEqual(0);
        expect(strategy.effectiveness).toBeLessThanOrEqual(1);
        expect(strategy.usageFrequency).toBeGreaterThanOrEqual(0);
        
        // Verify adaptation structure
        const adaptation = strategy.adaptations[0];
        expect(adaptation.situation).toBeDefined();
        expect(adaptation.modification).toBeDefined();
        expect(adaptation.expectedOutcome).toBeDefined();
        expect(adaptation.fallbackOptions).toBeInstanceOf(Array);
      }
    });

    it('should filter strategies by disruption type when specified', async () => {
      const familyId = 'test_family_filtered_strategies';
      const disruptionType = 'schedule_change';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const allStrategies = await engine.generateAdaptiveStrategies(familyId);
      const filteredStrategies = await engine.generateAdaptiveStrategies(familyId, disruptionType);
      
      expect(filteredStrategies).toBeInstanceOf(Array);
      expect(filteredStrategies.length).toBeLessThanOrEqual(allStrategies.length);
      
      // All filtered strategies should be relevant to the disruption type
      filteredStrategies.forEach(strategy => {
        const hasRelevantTrigger = strategy.triggerConditions.some(condition =>
          condition.toLowerCase().includes(disruptionType.toLowerCase())
        );
        expect(hasRelevantTrigger).toBe(true);
      });
    });

    it('should sort strategies by effectiveness', async () => {
      const familyId = 'test_family_strategy_sorting';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const strategies = await engine.generateAdaptiveStrategies(familyId);
      
      if (strategies.length > 1) {
        for (let i = 0; i < strategies.length - 1; i++) {
          expect(strategies[i].effectiveness).toBeGreaterThanOrEqual(strategies[i + 1].effectiveness);
        }
      }
    });

    it('should assess stress impact with detailed factors', async () => {
      const familyId = 'test_family_stress_detailed';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const stressAssessment = await engine.assessStressImpact(familyId, []);
      
      expect(stressAssessment).toBeDefined();
      expect(stressAssessment.stressLevel).toBeGreaterThanOrEqual(0);
      expect(stressAssessment.stressLevel).toBeLessThanOrEqual(10);
      expect(stressAssessment.stressFactors).toBeInstanceOf(Array);
      expect(stressAssessment.impactAreas).toBeInstanceOf(Array);
      expect(stressAssessment.mitigationStrategies).toBeInstanceOf(Array);
      expect(['low', 'medium', 'high', 'critical']).toContain(stressAssessment.urgency);
      
      // Verify stress factors structure
      if (stressAssessment.stressFactors.length > 0) {
        const factor = stressAssessment.stressFactors[0];
        expect(factor.factor).toBeDefined();
        expect(factor.severity).toBeGreaterThanOrEqual(0);
        expect(factor.severity).toBeLessThanOrEqual(10);
        expect(['rare', 'occasional', 'frequent', 'constant']).toContain(factor.frequency);
        expect(typeof factor.controllable).toBe('boolean');
        expect(factor.solutions).toBeInstanceOf(Array);
        expect(factor.solutions.length).toBeGreaterThan(0);
      }
    });

    it('should identify time-saving opportunities with proper prioritization', async () => {
      const familyId = 'test_family_time_saving';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const opportunities = await engine.identifyTimeSavingOpportunities(familyId);
      
      expect(opportunities).toBeInstanceOf(Array);
      
      if (opportunities.length > 0) {
        const opportunity = opportunities[0];
        
        // Verify opportunity structure
        expect(opportunity.opportunityId).toBeDefined();
        expect(opportunity.description).toBeDefined();
        expect(opportunity.currentTimeSpent).toBeGreaterThan(0);
        expect(opportunity.potentialTimeSaved).toBeGreaterThan(0);
        expect(Object.values(DifficultyLevel)).toContain(opportunity.implementationEffort);
        expect(opportunity.priority).toBeGreaterThan(0);
        expect(opportunity.priority).toBeLessThanOrEqual(10);
        expect(opportunity.prerequisites).toBeInstanceOf(Array);
        expect(opportunity.risks).toBeInstanceOf(Array);
      }
      
      // Verify prioritization (higher priority first)
      if (opportunities.length > 1) {
        for (let i = 0; i < opportunities.length - 1; i++) {
          expect(opportunities[i].priority).toBeGreaterThanOrEqual(opportunities[i + 1].priority);
        }
      }
    });

    it('should optimize routine changes for time efficiency', async () => {
      const familyId = 'test_family_routine_efficiency';
      
      // First populate pattern data
      await engine.analyzeHouseholdPatterns(familyId);
      
      const routineChanges = await engine.optimizeForTimeEfficiency(familyId);
      
      expect(routineChanges).toBeInstanceOf(Array);
      
      if (routineChanges.length > 0) {
        const change = routineChanges[0];
        
        // Verify routine change structure
        expect(change.routineId).toBeDefined();
        expect(change.changeType).toBeDefined();
        expect(change.description).toBeDefined();
        expect(change.rationale).toBeDefined();
        expect(change.implementation).toBeInstanceOf(Array);
        expect(change.impact).toBeDefined();
        expect(change.impact.timeImpact).toBeGreaterThan(0); // Should save time
        expect(change.adaptationPeriod).toBeGreaterThan(0);
        
        // Verify implementation steps
        if (change.implementation.length > 0) {
          const step = change.implementation[0];
          expect(step.order).toBeGreaterThan(0);
          expect(step.description).toBeDefined();
          expect(step.estimatedTime).toBeGreaterThan(0);
          expect(Object.values(DifficultyLevel)).toContain(step.difficulty);
          expect(step.dependencies).toBeInstanceOf(Array);
          expect(step.resources).toBeInstanceOf(Array);
        }
      }
      
      // Verify sorting by time impact (highest impact first)
      if (routineChanges.length > 1) {
        for (let i = 0; i < routineChanges.length - 1; i++) {
          expect(Math.abs(routineChanges[i].impact.timeImpact)).toBeGreaterThanOrEqual(
            Math.abs(routineChanges[i + 1].impact.timeImpact)
          );
        }
      }
    });
  });

  describe('error handling', () => {
    it('should handle empty family IDs gracefully in analyzeHouseholdPatterns', async () => {
      const familyId = '';
      
      const analysis = await engine.analyzeHouseholdPatterns(familyId);
      
      expect(analysis).toBeDefined();
      expect(analysis.familyId).toBe('');
      expect(analysis.analysisId).toContain('analysis_');
    });

    it('should handle empty family IDs gracefully in recommendation methods', async () => {
      const familyId = '';
      
      const optimizations = await engine.recommendTaskOptimizations(familyId);
      const suggestions = await engine.suggestAutomationOpportunities(familyId);
      const changes = await engine.recommendRoutineChanges(familyId);
      const timeSavingOps = await engine.identifyTimeSavingOpportunities(familyId);
      const strategies = await engine.generateAdaptiveStrategies(familyId);
      
      expect(optimizations).toBeInstanceOf(Array);
      expect(suggestions).toBeInstanceOf(Array);
      expect(changes).toBeInstanceOf(Array);
      expect(timeSavingOps).toBeInstanceOf(Array);
      expect(strategies).toBeInstanceOf(Array);
    });

    it('should return valid metrics for any family ID', async () => {
      const familyId = '';
      
      const metrics = await engine.trackHouseholdMetrics(familyId);
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.timeEfficiency).toBe('number');
      expect(typeof metrics.stressLevel).toBe('number');
      expect(typeof metrics.taskCompletionRate).toBe('number');
      expect(metrics.timeEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.timeEfficiency).toBeLessThanOrEqual(1);
    });

    it('should handle analysis errors gracefully', async () => {
      const familyId = 'test_family_error_handling';
      
      // Should not throw errors even with edge cases
      await expect(engine.analyzeHouseholdPatterns(familyId)).resolves.toBeDefined();
      await expect(engine.recommendTaskOptimizations(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.suggestAutomationOpportunities(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.optimizeSupplyManagement(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.recommendRoutineChanges(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.trackHouseholdMetrics(familyId)).resolves.toBeDefined();
    });

    it('should handle stress assessment errors gracefully', async () => {
      const familyId = 'test_family_stress_error';
      
      // Should not throw errors even with empty or invalid data
      await expect(engine.assessStressImpact(familyId, [])).resolves.toBeDefined();
      await expect(engine.identifyTimeSavingOpportunities(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.generateAdaptiveStrategies(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.prioritizeStressReduction(familyId)).resolves.toBeInstanceOf(Array);
      await expect(engine.optimizeForTimeEfficiency(familyId)).resolves.toBeInstanceOf(Array);
    });
  });
});