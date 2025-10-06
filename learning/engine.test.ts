// Learning Algorithm Validation Tests - Comprehensive Testing for Model Training, Convergence, and Optimization

import { AdaptiveLearningEngine } from './engine';
import { DefaultLearningEventBus, LearningEventBus } from './events';
import { DefaultErrorRecoveryManager, ErrorRecoveryManager } from './errors';
import { 
  TrainingResult, 
  ModelUpdateResult, 
  ModelValidationResult, 
  OptimizationResult,
  ModelMetrics,
  UserFeedback,
  ResourceConstraints,
  IdentifiedPattern,
  PatternType,
  ConvergenceStatus,
  FeedbackType,
  FeedbackSource,
  TimeOfDay,
  DayOfWeek
} from './types';

describe('Learning Algorithm Validation Tests', () => {
  let learningEngine: AdaptiveLearningEngine;
  let eventBus: LearningEventBus;
  let errorRecovery: ErrorRecoveryManager;
  const testUserId = 'test-user-learning';

  beforeEach(async () => {
    eventBus = new DefaultLearningEventBus();
    errorRecovery = new DefaultErrorRecoveryManager();
    learningEngine = new AdaptiveLearningEngine(eventBus, errorRecovery);
    await learningEngine.initialize();
  });

  describe('Model Training Convergence Tests', () => {
    test('should achieve convergence with consistent training patterns', async () => {
      // Create consistent training patterns that should converge
      const consistentPatterns = createConsistentTrainingPatterns();
      
      const trainingResult = await learningEngine.trainUserModel(testUserId, consistentPatterns);
      
      // Verify successful training
      expect(trainingResult.success).toBe(true);
      expect(trainingResult.convergenceStatus).toBe(ConvergenceStatus.CONVERGED);
      expect(trainingResult.improvementMetrics.accuracy).toBeGreaterThan(0.7);
      expect(trainingResult.trainingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(trainingResult.memoryUsage).toBeLessThan(2048); // Under 2GB for Jetson Nano Orin
    });

    test('should detect divergence with conflicting patterns', async () => {
      // Create conflicting patterns that should cause divergence
      const conflictingPatterns = createConflictingTrainingPatterns();
      
      const trainingResult = await learningEngine.trainUserModel(testUserId, conflictingPatterns);
      
      // Should still complete but with divergence status
      expect(trainingResult.success).toBe(true);
      expect([ConvergenceStatus.DIVERGED, ConvergenceStatus.STALLED]).toContain(trainingResult.convergenceStatus);
      expect(trainingResult.improvementMetrics.accuracy).toBeLessThan(0.8);
    });

    test('should handle stalled convergence gracefully', async () => {
      // Create patterns that lead to slow convergence
      const slowConvergencePatterns = createSlowConvergencePatterns();
      
      const trainingResult = await learningEngine.trainUserModel(testUserId, slowConvergencePatterns);
      
      // Should detect stalled convergence
      expect(trainingResult.success).toBe(true);
      expect([ConvergenceStatus.CONVERGING, ConvergenceStatus.STALLED]).toContain(trainingResult.convergenceStatus);
      expect(trainingResult.trainingTime).toBeGreaterThan(1000); // Takes longer to train
    });

    test('should maintain convergence stability across multiple training sessions', async () => {
      const basePatterns = createConsistentTrainingPatterns();
      const convergenceResults: ConvergenceStatus[] = [];
      
      // Run multiple training sessions
      for (let i = 0; i < 5; i++) {
        // Add slight variations to patterns
        const variatedPatterns = addPatternVariations(basePatterns, i * 0.1);
        const result = await learningEngine.trainUserModel(testUserId, variatedPatterns);
        convergenceResults.push(result.convergenceStatus);
      }
      
      // Most sessions should converge
      const convergedCount = convergenceResults.filter(status => status === ConvergenceStatus.CONVERGED).length;
      expect(convergedCount).toBeGreaterThanOrEqual(3); // At least 60% convergence rate
    });

    test('should achieve convergence within resource constraints', async () => {
      const patterns = createLargePatternSet(500); // Large pattern set
      
      const trainingResult = await learningEngine.trainUserModel(testUserId, patterns);
      
      // Should converge within Jetson Nano Orin constraints
      expect(trainingResult.success).toBe(true);
      expect(trainingResult.memoryUsage).toBeLessThan(1536); // 1.5GB limit
      expect(trainingResult.trainingTime).toBeLessThan(60000); // 1 minute limit
      expect(trainingResult.convergenceStatus).not.toBe(ConvergenceStatus.DIVERGED);
    });

    test('should validate convergence metrics accuracy', async () => {
      const patterns = createValidationPatterns();
      
      const trainingResult = await learningEngine.trainUserModel(testUserId, patterns);
      
      // Verify convergence metrics are within expected ranges
      expect(trainingResult.improvementMetrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(trainingResult.improvementMetrics.accuracy).toBeLessThanOrEqual(1);
      expect(trainingResult.improvementMetrics.precision).toBeGreaterThanOrEqual(0);
      expect(trainingResult.improvementMetrics.precision).toBeLessThanOrEqual(1);
      expect(trainingResult.improvementMetrics.recall).toBeGreaterThanOrEqual(0);
      expect(trainingResult.improvementMetrics.recall).toBeLessThanOrEqual(1);
      expect(trainingResult.improvementMetrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(trainingResult.improvementMetrics.f1Score).toBeLessThanOrEqual(1);
      expect(trainingResult.improvementMetrics.latency).toBeGreaterThan(0);
      expect(trainingResult.improvementMetrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Incremental Learning with Various Data Patterns Tests', () => {
    test('should handle incremental learning with temporal patterns', async () => {
      // Initial training with morning patterns
      const morningPatterns = createTemporalPatterns(TimeOfDay.MORNING);
      await learningEngine.trainUserModel(testUserId, morningPatterns);
      
      // Incremental learning with evening patterns
      const eveningPatterns = createTemporalPatterns(TimeOfDay.EVENING);
      const feedback = createPositiveFeedback(testUserId);
      
      const updateResult = await learningEngine.updateModel(testUserId, feedback);
      
      expect(updateResult.updated).toBe(true);
      expect(updateResult.rollbackAvailable).toBe(true);
      expect(Math.abs(updateResult.performanceChange.accuracyChange)).toBeLessThan(0.2); // Stable learning
    });

    test('should handle incremental learning with behavioral patterns', async () => {
      // Initial training with routine behavioral patterns
      const routinePatterns = createBehavioralPatterns('routine');
      await learningEngine.trainUserModel(testUserId, routinePatterns);
      
      // Incremental learning with spontaneous behavioral patterns
      const spontaneousPatterns = createBehavioralPatterns('spontaneous');
      const feedback = createMixedFeedback(testUserId);
      
      const updateResult = await learningEngine.updateModel(testUserId, feedback);
      
      expect(updateResult.updated).toBe(true);
      expect(updateResult.performanceChange.memoryChange).toBeLessThan(100); // Minimal memory increase
    });

    test('should handle incremental learning with contextual patterns', async () => {
      // Initial training with home context patterns
      const homePatterns = createContextualPatterns('home');
      await learningEngine.trainUserModel(testUserId, homePatterns);
      
      // Incremental learning with work context patterns
      const workPatterns = createContextualPatterns('work');
      const feedback = createContextualFeedback(testUserId);
      
      const updateResult = await learningEngine.updateModel(testUserId, feedback);
      
      expect(updateResult.updated).toBe(true);
      expect(updateResult.performanceChange.latencyChange).toBeLessThan(50); // Minimal latency impact
    });

    test('should prevent catastrophic forgetting during incremental learning', async () => {
      // Train initial model with specific patterns
      const initialPatterns = createSpecificPatterns('initial_knowledge');
      const initialResult = await learningEngine.trainUserModel(testUserId, initialPatterns);
      const initialAccuracy = initialResult.improvementMetrics.accuracy;
      
      // Perform multiple incremental updates with different patterns
      for (let i = 0; i < 10; i++) {
        const newPatterns = createSpecificPatterns(`new_knowledge_${i}`);
        const feedback = createIncrementalFeedback(testUserId, i);
        await learningEngine.updateModel(testUserId, feedback);
      }
      
      // Validate that initial knowledge is retained
      const finalMetrics = await learningEngine.getModelMetrics(testUserId);
      const accuracyDrop = initialAccuracy - finalMetrics.accuracy;
      
      // Should not lose more than 10% of initial accuracy (catastrophic forgetting prevention)
      expect(accuracyDrop).toBeLessThan(0.1);
      expect(finalMetrics.accuracy).toBeGreaterThan(0.6); // Maintain reasonable accuracy
    });

    test('should adapt learning rate based on pattern complexity', async () => {
      // Test with simple patterns (should learn quickly)
      const simplePatterns = createSimplePatterns();
      const simpleResult = await learningEngine.trainUserModel(testUserId + '_simple', simplePatterns);
      
      // Test with complex patterns (should take more time but be more thorough)
      const complexPatterns = createComplexPatterns();
      const complexResult = await learningEngine.trainUserModel(testUserId + '_complex', complexPatterns);
      
      // Complex patterns should take longer to train but achieve good accuracy
      expect(complexResult.trainingTime).toBeGreaterThan(simpleResult.trainingTime);
      expect(complexResult.improvementMetrics.accuracy).toBeGreaterThan(0.7);
    });

    test('should handle mixed pattern types in incremental learning', async () => {
      // Initial training with mixed patterns
      const mixedPatterns = createMixedPatternTypes();
      await learningEngine.trainUserModel(testUserId, mixedPatterns);
      
      // Incremental updates with different pattern type distributions
      const updates = [
        createTemporalPatterns(TimeOfDay.AFTERNOON),
        createBehavioralPatterns('mixed'),
        createContextualPatterns('social')
      ];
      
      const updateResults: ModelUpdateResult[] = [];
      for (const patterns of updates) {
        const feedback = createPatternTypeFeedback(testUserId, patterns[0].type);
        const result = await learningEngine.updateModel(testUserId, feedback);
        updateResults.push(result);
      }
      
      // All updates should succeed
      updateResults.forEach(result => {
        expect(result.updated).toBe(true);
        expect(Math.abs(result.performanceChange.accuracyChange)).toBeLessThan(0.15);
      });
    });

    test('should maintain model stability during rapid incremental updates', async () => {
      // Initial training
      const basePatterns = createStabilityTestPatterns();
      await learningEngine.trainUserModel(testUserId, basePatterns);
      
      // Rapid incremental updates
      const rapidUpdates = Array.from({ length: 20 }, (_, i) => 
        createRapidUpdateFeedback(testUserId, i)
      );
      
      const updatePromises = rapidUpdates.map(feedback => 
        learningEngine.updateModel(testUserId, feedback)
      );
      
      const results = await Promise.all(updatePromises);
      
      // All updates should complete successfully
      results.forEach(result => {
        expect(result.updated).toBe(true);
      });
      
      // Final model should remain stable
      const finalMetrics = await learningEngine.getModelMetrics(testUserId);
      expect(finalMetrics.accuracy).toBeGreaterThan(0.5);
    });
  });

  describe('Model Optimization Under Resource Constraints Tests', () => {
    test('should optimize model within Jetson Nano Orin memory constraints', async () => {
      // Train a large model first
      const largePatterns = createLargePatternSet(1000);
      await learningEngine.trainUserModel(testUserId, largePatterns);
      
      // Define Jetson Nano Orin constraints
      const jetsonConstraints: ResourceConstraints = {
        maxMemoryMB: 1536, // 1.5GB limit
        maxLatencyMs: 100,  // 100ms inference limit
        targetAccuracy: 0.75,
        energyEfficient: true
      };
      
      const optimizationResult = await learningEngine.optimizeModel(testUserId, jetsonConstraints);
      
      expect(optimizationResult.optimized).toBe(true);
      expect(optimizationResult.memoryReduction).toBeGreaterThan(10); // At least 10% reduction
      expect(optimizationResult.performanceImprovement).toBeGreaterThan(5); // At least 5% improvement
    });

    test('should maintain accuracy while optimizing for latency', async () => {
      // Train model with accuracy focus
      const accuracyPatterns = createAccuracyFocusedPatterns();
      await learningEngine.trainUserModel(testUserId, accuracyPatterns);
      
      // Get baseline metrics
      const baselineMetrics = await learningEngine.getModelMetrics(testUserId);
      
      // Optimize for latency
      const latencyConstraints: ResourceConstraints = {
        maxMemoryMB: 2048,
        maxLatencyMs: 50, // Very aggressive latency target
        targetAccuracy: baselineMetrics.accuracy * 0.9, // Allow 10% accuracy drop
        energyEfficient: false
      };
      
      const optimizationResult = await learningEngine.optimizeModel(testUserId, latencyConstraints);
      
      expect(optimizationResult.optimized).toBe(true);
      expect(optimizationResult.performanceImprovement).toBeGreaterThan(15); // Significant latency improvement
      
      // Verify accuracy is maintained within acceptable bounds
      const optimizedMetrics = await learningEngine.getModelMetrics(testUserId);
      const accuracyLoss = baselineMetrics.accuracy - optimizedMetrics.accuracy;
      expect(accuracyLoss).toBeLessThan(0.15); // Less than 15% accuracy loss
    });

    test('should optimize for energy efficiency on Jetson platform', async () => {
      // Train energy-intensive model
      const energyIntensivePatterns = createEnergyIntensivePatterns();
      await learningEngine.trainUserModel(testUserId, energyIntensivePatterns);
      
      // Optimize for energy efficiency
      const energyConstraints: ResourceConstraints = {
        maxMemoryMB: 2048,
        maxLatencyMs: 200, // Allow higher latency for energy savings
        targetAccuracy: 0.7,
        energyEfficient: true
      };
      
      const optimizationResult = await learningEngine.optimizeModel(testUserId, energyConstraints);
      
      expect(optimizationResult.optimized).toBe(true);
      expect(optimizationResult.memoryReduction).toBeGreaterThan(20); // Significant memory reduction
      
      // Verify model still functions within constraints
      const metrics = await learningEngine.getModelMetrics(testUserId);
      expect(metrics.accuracy).toBeGreaterThan(0.65);
      expect(metrics.memoryUsage).toBeLessThan(energyConstraints.maxMemoryMB);
    });

    test('should handle optimization failures gracefully', async () => {
      // Train model
      const patterns = createOptimizationTestPatterns();
      await learningEngine.trainUserModel(testUserId, patterns);
      
      // Set impossible constraints
      const impossibleConstraints: ResourceConstraints = {
        maxMemoryMB: 10, // Impossibly low memory
        maxLatencyMs: 1,  // Impossibly low latency
        targetAccuracy: 0.99, // Impossibly high accuracy
        energyEfficient: true
      };
      
      // Should handle gracefully without crashing
      await expect(learningEngine.optimizeModel(testUserId, impossibleConstraints))
        .rejects.toThrow();
      
      // Model should still be functional after failed optimization
      const metrics = await learningEngine.getModelMetrics(testUserId);
      expect(metrics.accuracy).toBeGreaterThan(0);
    });

    test('should optimize multiple models concurrently', async () => {
      // Train multiple user models
      const userIds = ['user1', 'user2', 'user3'];
      const trainingPromises = userIds.map(async (userId) => {
        const patterns = createConcurrentOptimizationPatterns(userId);
        return learningEngine.trainUserModel(userId, patterns);
      });
      
      await Promise.all(trainingPromises);
      
      // Optimize all models concurrently
      const constraints: ResourceConstraints = {
        maxMemoryMB: 1024,
        maxLatencyMs: 100,
        targetAccuracy: 0.75,
        energyEfficient: true
      };
      
      const optimizationPromises = userIds.map(userId => 
        learningEngine.optimizeModel(userId, constraints)
      );
      
      const results = await Promise.all(optimizationPromises);
      
      // All optimizations should succeed
      results.forEach(result => {
        expect(result.optimized).toBe(true);
        expect(result.memoryReduction).toBeGreaterThan(0);
      });
    });

    test('should validate optimization results meet specified constraints', async () => {
      // Train model
      const patterns = createConstraintValidationPatterns();
      await learningEngine.trainUserModel(testUserId, patterns);
      
      // Define specific constraints
      const constraints: ResourceConstraints = {
        maxMemoryMB: 800,
        maxLatencyMs: 75,
        targetAccuracy: 0.8,
        energyEfficient: false
      };
      
      const optimizationResult = await learningEngine.optimizeModel(testUserId, constraints);
      
      expect(optimizationResult.optimized).toBe(true);
      
      // Validate constraints are met
      const metrics = await learningEngine.getModelMetrics(testUserId);
      expect(metrics.memoryUsage).toBeLessThanOrEqual(constraints.maxMemoryMB);
      expect(metrics.latency).toBeLessThanOrEqual(constraints.maxLatencyMs);
      expect(metrics.accuracy).toBeGreaterThanOrEqual(constraints.targetAccuracy * 0.95); // Allow 5% tolerance
    });

    test('should provide detailed optimization metrics', async () => {
      // Train model
      const patterns = createMetricsTestPatterns();
      await learningEngine.trainUserModel(testUserId, patterns);
      
      // Get baseline metrics
      const baselineMetrics = await learningEngine.getModelMetrics(testUserId);
      
      // Optimize model
      const constraints: ResourceConstraints = {
        maxMemoryMB: 1200,
        maxLatencyMs: 80,
        targetAccuracy: 0.75,
        energyEfficient: true
      };
      
      const optimizationResult = await learningEngine.optimizeModel(testUserId, constraints);
      
      // Verify detailed metrics are provided
      expect(optimizationResult.sizeBefore).toBeGreaterThan(0);
      expect(optimizationResult.sizeAfter).toBeGreaterThan(0);
      expect(optimizationResult.sizeAfter).toBeLessThan(optimizationResult.sizeBefore);
      expect(optimizationResult.performanceImprovement).toBeGreaterThan(0);
      expect(optimizationResult.memoryReduction).toBeGreaterThan(0);
      
      // Verify optimization actually improved metrics
      const optimizedMetrics = await learningEngine.getModelMetrics(testUserId);
      expect(optimizedMetrics.latency).toBeLessThanOrEqual(baselineMetrics.latency);
      expect(optimizedMetrics.memoryUsage).toBeLessThanOrEqual(baselineMetrics.memoryUsage);
    });
  });

  // Helper functions for creating test data
  function createConsistentTrainingPatterns(): IdentifiedPattern[] {
    return Array.from({ length: 50 }, (_, i) => ({
      id: `consistent_pattern_${i}`,
      type: PatternType.TEMPORAL,
      description: `Consistent morning routine pattern ${i}`,
      frequency: 5 + Math.floor(i / 10), // Gradually increasing frequency
      strength: 0.8 + (i % 5) * 0.04, // High strength with small variations
      context: {
        temporal: {
          timeOfDay: TimeOfDay.MORNING,
          dayOfWeek: DayOfWeek.MONDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'before_work' as any
        },
        environmental: {
          location: { room: 'kitchen', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 80, isNatural: true, colorTemperature: 5500 },
          noise: { level: 30, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: 'morning routine',
        outcome: 'successful',
        confidence: 0.9
      }],
      lastObserved: new Date()
    }));
  }

  function createConflictingTrainingPatterns(): IdentifiedPattern[] {
    return Array.from({ length: 30 }, (_, i) => ({
      id: `conflicting_pattern_${i}`,
      type: i % 2 === 0 ? PatternType.BEHAVIORAL : PatternType.CONTEXTUAL,
      description: `Conflicting pattern ${i}`,
      frequency: Math.random() * 10, // Random frequency
      strength: Math.random(), // Random strength
      context: {
        temporal: {
          timeOfDay: i % 2 === 0 ? TimeOfDay.MORNING : TimeOfDay.EVENING,
          dayOfWeek: Object.values(DayOfWeek)[i % 7] as DayOfWeek,
          season: 'spring' as any,
          isHoliday: Math.random() > 0.5,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'various', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'cloudy' as any, temperature: 20, humidity: 50, isRaining: false },
          lighting: { brightness: 50, isNatural: false, colorTemperature: 3000 },
          noise: { level: 50, type: 'conversation' as any, isDistracting: true },
          temperature: 20
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: 'conflicting behavior',
        outcome: 'mixed',
        confidence: 0.5
      }],
      lastObserved: new Date()
    }));
  }

  function createSlowConvergencePatterns(): IdentifiedPattern[] {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `slow_pattern_${i}`,
      type: PatternType.PREFERENCE,
      description: `Slow convergence pattern ${i}`,
      frequency: 1 + Math.random() * 2, // Low frequency
      strength: 0.3 + Math.random() * 0.4, // Medium strength with high variance
      context: {
        temporal: {
          timeOfDay: Object.values(TimeOfDay)[i % 8] as TimeOfDay,
          dayOfWeek: Object.values(DayOfWeek)[i % 7] as DayOfWeek,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 40, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: 'slow learning',
        outcome: 'gradual',
        confidence: 0.6
      }],
      lastObserved: new Date()
    }));
  }

  function addPatternVariations(basePatterns: IdentifiedPattern[], variation: number): IdentifiedPattern[] {
    return basePatterns.map(pattern => ({
      ...pattern,
      strength: Math.max(0, Math.min(1, pattern.strength + (Math.random() - 0.5) * variation)),
      frequency: Math.max(1, pattern.frequency + Math.floor((Math.random() - 0.5) * variation * 10))
    }));
  }

  function createLargePatternSet(count: number): IdentifiedPattern[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `large_pattern_${i}`,
      type: Object.values(PatternType)[i % 5] as PatternType,
      description: `Large dataset pattern ${i}`,
      frequency: 1 + Math.floor(Math.random() * 10),
      strength: Math.random(),
      context: {
        temporal: {
          timeOfDay: Object.values(TimeOfDay)[i % 8] as TimeOfDay,
          dayOfWeek: Object.values(DayOfWeek)[i % 7] as DayOfWeek,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'various', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `large dataset context ${i}`,
        outcome: 'success',
        confidence: 0.7
      }],
      lastObserved: new Date()
    }));
  }

  function createValidationPatterns(): IdentifiedPattern[] {
    return createConsistentTrainingPatterns().slice(0, 20);
  }

  function createTemporalPatterns(timeOfDay: TimeOfDay): IdentifiedPattern[] {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `temporal_${timeOfDay}_${i}`,
      type: PatternType.TEMPORAL,
      description: `Temporal pattern for ${timeOfDay}`,
      frequency: 3 + i,
      strength: 0.7 + i * 0.02,
      context: {
        temporal: {
          timeOfDay,
          dayOfWeek: DayOfWeek.MONDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `${timeOfDay} activity`,
        outcome: 'success',
        confidence: 0.8
      }],
      lastObserved: new Date()
    }));
  }

  function createBehavioralPatterns(behaviorType: string): IdentifiedPattern[] {
    return Array.from({ length: 15 }, (_, i) => ({
      id: `behavioral_${behaviorType}_${i}`,
      type: PatternType.BEHAVIORAL,
      description: `Behavioral pattern: ${behaviorType}`,
      frequency: behaviorType === 'routine' ? 8 + i : 2 + Math.random() * 5,
      strength: behaviorType === 'routine' ? 0.8 + i * 0.01 : 0.4 + Math.random() * 0.4,
      context: {
        temporal: {
          timeOfDay: TimeOfDay.AFTERNOON,
          dayOfWeek: DayOfWeek.WEDNESDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `${behaviorType} behavior`,
        outcome: 'success',
        confidence: 0.75
      }],
      lastObserved: new Date()
    }));
  }

  function createContextualPatterns(contextType: string): IdentifiedPattern[] {
    return Array.from({ length: 12 }, (_, i) => ({
      id: `contextual_${contextType}_${i}`,
      type: PatternType.CONTEXTUAL,
      description: `Contextual pattern: ${contextType}`,
      frequency: 4 + i,
      strength: 0.6 + i * 0.03,
      context: {
        temporal: {
          timeOfDay: TimeOfDay.EVENING,
          dayOfWeek: DayOfWeek.FRIDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: contextType === 'work' ? 'during_work' as any : 'free_time' as any
        },
        environmental: {
          location: { 
            room: contextType === 'work' ? 'office' : 'living_room', 
            building: contextType === 'work' ? 'office_building' : 'home', 
            city: 'test', 
            isHome: contextType !== 'work', 
            isWork: contextType === 'work', 
            isPublic: false 
          },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: contextType === 'work' ? 50 : 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: contextType === 'social',
          socialActivity: contextType === 'social' ? 'entertaining' as any : 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `${contextType} context`,
        outcome: 'success',
        confidence: 0.7
      }],
      lastObserved: new Date()
    }));
  }

  function createPositiveFeedback(userId: string): UserFeedback {
    return {
      feedbackId: `positive_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.EXPLICIT_USER,
      type: FeedbackType.POSITIVE_REINFORCEMENT,
      context: {
        interactionType: 'voice_command',
        systemComponent: 'learning_engine',
        userContext: 'home_evening',
        environmentalFactors: ['quiet', 'comfortable_lighting']
      },
      rating: {
        overall: 5,
        accuracy: 5,
        helpfulness: 5,
        appropriateness: 5
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.9, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: [] },
        timing: { wasTimely: true, preferredTiming: 'immediate', urgencyLevel: 'medium' as any },
        personalization: { wasPersonalized: true, preferencesMet: true, adaptationNeeded: [] },
        satisfaction: { satisfactionLevel: 5, emotionalResponse: 'very_positive' as any, wouldRecommend: true }
      },
      improvementSuggestions: []
    };
  }

  function createMixedFeedback(userId: string): UserFeedback {
    return {
      feedbackId: `mixed_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.IMPLICIT_BEHAVIOR,
      type: FeedbackType.PREFERENCE_CORRECTION,
      context: {
        interactionType: 'scheduling',
        systemComponent: 'learning_engine',
        userContext: 'work_morning',
        environmentalFactors: ['busy', 'multiple_tasks']
      },
      rating: {
        overall: 3,
        accuracy: 4,
        helpfulness: 3,
        appropriateness: 3
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.7, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: ['better_timing'] },
        timing: { wasTimely: false, preferredTiming: 'later', urgencyLevel: 'low' as any },
        personalization: { wasPersonalized: false, preferencesMet: false, adaptationNeeded: ['timing_preferences'] },
        satisfaction: { satisfactionLevel: 3, emotionalResponse: 'neutral' as any, wouldRecommend: true }
      },
      improvementSuggestions: ['Improve timing suggestions', 'Learn user schedule better']
    };
  }

  function createContextualFeedback(userId: string): UserFeedback {
    return {
      feedbackId: `contextual_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.SYSTEM_METRICS,
      type: FeedbackType.BEHAVIOR_ADJUSTMENT,
      context: {
        interactionType: 'context_adaptation',
        systemComponent: 'learning_engine',
        userContext: 'context_switch',
        environmentalFactors: ['location_change', 'social_context_change']
      },
      rating: {
        overall: 4,
        accuracy: 4,
        helpfulness: 4,
        appropriateness: 4
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.8, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: [] },
        timing: { wasTimely: true, preferredTiming: 'immediate', urgencyLevel: 'medium' as any },
        personalization: { wasPersonalized: true, preferencesMet: true, adaptationNeeded: [] },
        satisfaction: { satisfactionLevel: 4, emotionalResponse: 'positive' as any, wouldRecommend: true }
      },
      improvementSuggestions: []
    };
  }

  function createSpecificPatterns(knowledgeType: string): IdentifiedPattern[] {
    return Array.from({ length: 5 }, (_, i) => ({
      id: `${knowledgeType}_pattern_${i}`,
      type: PatternType.PREFERENCE,
      description: `Specific knowledge: ${knowledgeType}`,
      frequency: 5 + i,
      strength: 0.8 + i * 0.02,
      context: {
        temporal: {
          timeOfDay: TimeOfDay.MORNING,
          dayOfWeek: DayOfWeek.MONDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'before_work' as any
        },
        environmental: {
          location: { room: 'kitchen', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 80, isNatural: true, colorTemperature: 5500 },
          noise: { level: 30, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: knowledgeType,
        outcome: 'learned',
        confidence: 0.85
      }],
      lastObserved: new Date()
    }));
  }

  function createIncrementalFeedback(userId: string, iteration: number): UserFeedback {
    return {
      feedbackId: `incremental_${iteration}_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.IMPLICIT_BEHAVIOR,
      type: FeedbackType.BEHAVIOR_ADJUSTMENT,
      context: {
        interactionType: 'incremental_learning',
        systemComponent: 'learning_engine',
        userContext: `iteration_${iteration}`,
        environmentalFactors: ['learning_session']
      },
      rating: {
        overall: 3 + Math.floor(Math.random() * 3),
        accuracy: 3 + Math.floor(Math.random() * 3),
        helpfulness: 3 + Math.floor(Math.random() * 3),
        appropriateness: 4
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.7 + Math.random() * 0.2, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: [] },
        timing: { wasTimely: true, preferredTiming: 'immediate', urgencyLevel: 'medium' as any },
        personalization: { wasPersonalized: true, preferencesMet: true, adaptationNeeded: [] },
        satisfaction: { satisfactionLevel: 3 + Math.floor(Math.random() * 3), emotionalResponse: 'positive' as any, wouldRecommend: true }
      },
      improvementSuggestions: []
    };
  }

  function createSimplePatterns(): IdentifiedPattern[] {
    return Array.from({ length: 10 }, (_, i) => ({
      id: `simple_pattern_${i}`,
      type: PatternType.TEMPORAL,
      description: `Simple pattern ${i}`,
      frequency: 5,
      strength: 0.9,
      context: {
        temporal: {
          timeOfDay: TimeOfDay.MORNING,
          dayOfWeek: DayOfWeek.MONDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'before_work' as any
        },
        environmental: {
          location: { room: 'kitchen', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 80, isNatural: true, colorTemperature: 5500 },
          noise: { level: 30, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: 'simple',
        outcome: 'success',
        confidence: 0.95
      }],
      lastObserved: new Date()
    }));
  }

  function createComplexPatterns(): IdentifiedPattern[] {
    return Array.from({ length: 25 }, (_, i) => ({
      id: `complex_pattern_${i}`,
      type: Object.values(PatternType)[i % 5] as PatternType,
      description: `Complex multi-dimensional pattern ${i}`,
      frequency: 1 + Math.floor(Math.random() * 8),
      strength: 0.3 + Math.random() * 0.6,
      context: {
        temporal: {
          timeOfDay: Object.values(TimeOfDay)[i % 8] as TimeOfDay,
          dayOfWeek: Object.values(DayOfWeek)[i % 7] as DayOfWeek,
          season: ['spring', 'summer', 'fall', 'winter'][i % 4] as any,
          isHoliday: Math.random() > 0.8,
          timeZone: 'UTC',
          relativeToSchedule: ['before_work', 'during_work', 'after_work', 'weekend', 'free_time'][i % 5] as any
        },
        environmental: {
          location: { 
            room: ['kitchen', 'living_room', 'bedroom', 'office'][i % 4], 
            building: 'home', 
            city: 'test', 
            isHome: true, 
            isWork: false, 
            isPublic: false 
          },
          weather: { 
            condition: ['sunny', 'cloudy', 'rainy'][i % 3] as any, 
            temperature: 15 + Math.random() * 15, 
            humidity: 40 + Math.random() * 40, 
            isRaining: Math.random() > 0.7 
          },
          lighting: { 
            brightness: 30 + Math.random() * 70, 
            isNatural: Math.random() > 0.5, 
            colorTemperature: 2700 + Math.random() * 3800 
          },
          noise: { 
            level: 20 + Math.random() * 60, 
            type: ['quiet', 'conversation', 'music', 'tv'][i % 4] as any, 
            isDistracting: Math.random() > 0.6 
          },
          temperature: 18 + Math.random() * 10
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: Math.random() > 0.5 ? [{ 
            id: 'family1', 
            relationship: 'parent' as any, 
            ageGroup: 'adult' as any, 
            isPresent: true 
          }] : [],
          guestPresent: Math.random() > 0.8,
          socialActivity: ['alone', 'family_time', 'entertaining'][i % 3] as any
        },
        device: {
          deviceType: ['smart_display', 'mobile', 'tablet'][i % 3] as any,
          screenSize: ['small', 'medium', 'large'][i % 3] as any,
          inputMethod: ['voice', 'touch', 'keyboard'][i % 3] as any,
          connectivity: Math.random() > 0.1 ? 'online' as any : 'offline' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `complex_context_${i}`,
        outcome: Math.random() > 0.3 ? 'success' : 'partial',
        confidence: 0.4 + Math.random() * 0.5
      }],
      lastObserved: new Date()
    }));
  }

  function createMixedPatternTypes(): IdentifiedPattern[] {
    const types = Object.values(PatternType);
    return Array.from({ length: 20 }, (_, i) => ({
      id: `mixed_pattern_${i}`,
      type: types[i % types.length],
      description: `Mixed type pattern ${i}`,
      frequency: 2 + Math.floor(Math.random() * 6),
      strength: 0.5 + Math.random() * 0.4,
      context: {
        temporal: {
          timeOfDay: Object.values(TimeOfDay)[i % 8] as TimeOfDay,
          dayOfWeek: Object.values(DayOfWeek)[i % 7] as DayOfWeek,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: ['user1'],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `mixed_${types[i % types.length]}`,
        outcome: 'success',
        confidence: 0.7
      }],
      lastObserved: new Date()
    }));
  }

  function createPatternTypeFeedback(userId: string, patternType: PatternType): UserFeedback {
    return {
      feedbackId: `pattern_type_${patternType}_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.SYSTEM_METRICS,
      type: FeedbackType.BEHAVIOR_ADJUSTMENT,
      context: {
        interactionType: 'pattern_learning',
        systemComponent: 'learning_engine',
        userContext: `${patternType}_learning`,
        environmentalFactors: ['pattern_recognition']
      },
      rating: {
        overall: 4,
        accuracy: 4,
        helpfulness: 4,
        appropriateness: 4
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.8, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: [] },
        timing: { wasTimely: true, preferredTiming: 'immediate', urgencyLevel: 'medium' as any },
        personalization: { wasPersonalized: true, preferencesMet: true, adaptationNeeded: [] },
        satisfaction: { satisfactionLevel: 4, emotionalResponse: 'positive' as any, wouldRecommend: true }
      },
      improvementSuggestions: []
    };
  }

  function createStabilityTestPatterns(): IdentifiedPattern[] {
    return createConsistentTrainingPatterns().slice(0, 15);
  }

  function createRapidUpdateFeedback(userId: string, iteration: number): UserFeedback {
    return {
      feedbackId: `rapid_${iteration}_${Date.now()}`,
      userId,
      timestamp: new Date(),
      source: FeedbackSource.IMPLICIT_BEHAVIOR,
      type: FeedbackType.PREFERENCE_CORRECTION,
      context: {
        interactionType: 'rapid_update',
        systemComponent: 'learning_engine',
        userContext: `rapid_iteration_${iteration}`,
        environmentalFactors: ['high_frequency_updates']
      },
      rating: {
        overall: 3 + (iteration % 3),
        accuracy: 3 + (iteration % 3),
        helpfulness: 3 + (iteration % 3),
        appropriateness: 4
      },
      specificFeedback: {
        accuracy: { wasAccurate: true, confidence: 0.6 + (iteration % 4) * 0.1, corrections: [] },
        relevance: { wasRelevant: true, contextMismatch: false, suggestions: [] },
        timing: { wasTimely: true, preferredTiming: 'immediate', urgencyLevel: 'medium' as any },
        personalization: { wasPersonalized: true, preferencesMet: true, adaptationNeeded: [] },
        satisfaction: { satisfactionLevel: 3 + (iteration % 3), emotionalResponse: 'neutral' as any, wouldRecommend: true }
      },
      improvementSuggestions: []
    };
  }

  // Additional helper functions for optimization tests
  function createAccuracyFocusedPatterns(): IdentifiedPattern[] {
    return createConsistentTrainingPatterns().slice(0, 30);
  }

  function createEnergyIntensivePatterns(): IdentifiedPattern[] {
    return createComplexPatterns();
  }

  function createOptimizationTestPatterns(): IdentifiedPattern[] {
    return createLargePatternSet(200);
  }

  function createConcurrentOptimizationPatterns(userId: string): IdentifiedPattern[] {
    return Array.from({ length: 20 }, (_, i) => ({
      id: `concurrent_${userId}_${i}`,
      type: PatternType.BEHAVIORAL,
      description: `Concurrent optimization pattern for ${userId}`,
      frequency: 3 + i,
      strength: 0.6 + i * 0.02,
      context: {
        temporal: {
          timeOfDay: TimeOfDay.AFTERNOON,
          dayOfWeek: DayOfWeek.WEDNESDAY,
          season: 'spring' as any,
          isHoliday: false,
          timeZone: 'UTC',
          relativeToSchedule: 'free_time' as any
        },
        environmental: {
          location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
          weather: { condition: 'sunny' as any, temperature: 22, humidity: 60, isRaining: false },
          lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
          noise: { level: 35, type: 'quiet' as any, isDistracting: false },
          temperature: 22
        },
        social: {
          presentUsers: [userId],
          familyMembers: [],
          guestPresent: false,
          socialActivity: 'alone' as any
        },
        device: {
          deviceType: 'smart_display' as any,
          screenSize: 'medium' as any,
          inputMethod: 'voice' as any,
          connectivity: 'online' as any
        }
      },
      examples: [{
        timestamp: new Date(),
        context: `concurrent_${userId}`,
        outcome: 'success',
        confidence: 0.75
      }],
      lastObserved: new Date()
    }));
  }

  function createConstraintValidationPatterns(): IdentifiedPattern[] {
    return createLargePatternSet(100);
  }

  function createMetricsTestPatterns(): IdentifiedPattern[] {
    return createConsistentTrainingPatterns().slice(0, 25);
  }
});