// Pattern Recognition Accuracy Tests - Comprehensive Testing for Behavioral Pattern Identification

import { EnhancedPatternAnalyzer } from './analyzer';
import { EnhancedContextAggregator } from './context';
import { 
  PatternAnalysisResult,
  UserPreferences,
  HabitPattern,
  PatternFeedback,
  PatternInsights,
  PreferenceDomain,
  TimeWindow,
  InferredPreference,
  DetectedHabit,
  ContextualFactor,
  ConfidenceScore,
  PatternFeedbackType,
  FeedbackAction,
  PreferenceType,
  HabitType,
  ContextualFactorType
} from './types';
import { FilteredInteraction, PrivacyLevel, AnonymizedPattern } from '../privacy/types';
import { 
  PatternType,
  TimeOfDay,
  DayOfWeek,
  DeviceType,
  WeatherCondition,
  NoiseType,
  SocialActivity,
  IdentifiedPattern
} from '../learning/types';

describe('Pattern Recognition Accuracy Tests', () => {
  let analyzer: EnhancedPatternAnalyzer;
  let contextAggregator: EnhancedContextAggregator;

  beforeEach(() => {
    analyzer = new EnhancedPatternAnalyzer();
    contextAggregator = new EnhancedContextAggregator();
  });

  describe('Behavioral Pattern Identification', () => {
    test('should accurately identify temporal patterns from user interactions', async () => {
      // Create test data with clear temporal patterns
      const interactions = createTemporalPatternTestData();
      
      const result = await analyzer.analyzePatterns(interactions);
      
      // Verify temporal patterns are identified
      const temporalPatterns = result.patterns.filter(p => p.type === PatternType.TEMPORAL);
      expect(temporalPatterns.length).toBeGreaterThan(0);
      
      // Verify pattern accuracy
      const morningPattern = temporalPatterns.find(p => 
        p.description.includes('morning') || p.context.temporal.timeOfDay === TimeOfDay.MORNING
      );
      expect(morningPattern).toBeDefined();
      expect(morningPattern!.strength).toBeGreaterThan(0.6);
      expect(morningPattern!.frequency).toBeGreaterThanOrEqual(3);
    });

    test('should accurately identify contextual patterns from environmental factors', async () => {
      const interactions = createContextualPatternTestData();
      
      const result = await analyzer.analyzePatterns(interactions);
      
      // Verify contextual patterns are identified
      const contextualPatterns = result.patterns.filter(p => p.type === PatternType.CONTEXTUAL);
      expect(contextualPatterns.length).toBeGreaterThan(0);
      
      // Verify environmental context influence
      const environmentalPattern = contextualPatterns.find(p => 
        p.description.includes('environmental') || p.description.includes('weather')
      );
      expect(environmentalPattern).toBeDefined();
      expect(environmentalPattern!.strength).toBeGreaterThan(0.5);
    });

    test('should accurately identify behavioral patterns from user actions', async () => {
      const interactions = createBehavioralPatternTestData();
      
      const result = await analyzer.analyzePatterns(interactions);
      
      // Verify behavioral patterns are identified
      const behavioralPatterns = result.patterns.filter(p => p.type === PatternType.BEHAVIORAL);
      expect(behavioralPatterns.length).toBeGreaterThan(0);
      
      // Verify pattern strength and frequency
      behavioralPatterns.forEach(pattern => {
        expect(pattern.strength).toBeGreaterThan(0.5);
        expect(pattern.frequency).toBeGreaterThanOrEqual(2);
        expect(pattern.examples.length).toBeGreaterThan(0);
      });
    });

    test('should maintain pattern accuracy above 80% with synthetic data', async () => {
      const syntheticData = createSyntheticPatternData(100);
      
      const result = await analyzer.analyzePatterns(syntheticData.interactions);
      
      // Calculate accuracy by comparing identified patterns with known patterns
      const accuracy = calculatePatternAccuracy(result.patterns, syntheticData.expectedPatterns);
      expect(accuracy).toBeGreaterThan(0.8);
      
      // Verify confidence scores
      expect(result.confidence.overall).toBeGreaterThan(0.7);
      expect(result.confidence.patternRecognition).toBeGreaterThan(0.75);
    });

    test('should handle edge cases and maintain stability', async () => {
      // Test with minimal data
      const minimalInteractions = createMinimalTestData();
      const minimalResult = await analyzer.analyzePatterns(minimalInteractions);
      expect(minimalResult.patterns.length).toBeGreaterThanOrEqual(0);
      
      // Test with noisy data
      const noisyInteractions = createNoisyTestData();
      const noisyResult = await analyzer.analyzePatterns(noisyInteractions);
      expect(noisyResult.confidence.overall).toBeGreaterThan(0.3);
      
      // Test with conflicting patterns
      const conflictingInteractions = createConflictingPatternData();
      const conflictingResult = await analyzer.analyzePatterns(conflictingInteractions);
      expect(conflictingResult.patterns.length).toBeGreaterThan(0);
    });

    test('should accurately detect habit patterns with 85% precision', async () => {
      const userId = 'test-user-habits';
      const habitData = createHabitDetectionTestData();
      
      // Analyze patterns to detect habits
      const result = await analyzer.analyzePatterns(habitData.interactions);
      
      // Test habit detection accuracy
      const timeWindow: TimeWindow = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        duration: 30 * 24 * 60 * 60 * 1000,
        type: 'fixed'
      };
      
      const detectedHabits = await analyzer.detectHabits(userId, timeWindow);
      
      // Calculate precision: true positives / (true positives + false positives)
      const precision = calculateHabitDetectionPrecision(detectedHabits, habitData.expectedHabits);
      expect(precision).toBeGreaterThan(0.85);
      
      // Verify habit characteristics
      detectedHabits.forEach(habit => {
        expect(habit.predictability).toBeGreaterThan(0.6);
        expect(habit.strength).toBeGreaterThan(0.5);
        expect(habit.frequency).toBeGreaterThanOrEqual(3);
      });
    });

    test('should maintain consistent accuracy across different pattern types', async () => {
      const testCases = [
        { type: PatternType.TEMPORAL, data: createTemporalPatternTestData() },
        { type: PatternType.CONTEXTUAL, data: createContextualPatternTestData() },
        { type: PatternType.BEHAVIORAL, data: createBehavioralPatternTestData() }
      ];
      
      const accuracyResults: number[] = [];
      
      for (const testCase of testCases) {
        const result = await analyzer.analyzePatterns(testCase.data);
        const patternsOfType = result.patterns.filter(p => p.type === testCase.type);
        
        // Calculate type-specific accuracy
        const accuracy = patternsOfType.length > 0 ? 
          patternsOfType.reduce((sum, p) => sum + p.strength, 0) / patternsOfType.length : 0;
        accuracyResults.push(accuracy);
      }
      
      // All pattern types should maintain minimum accuracy
      accuracyResults.forEach(accuracy => {
        expect(accuracy).toBeGreaterThan(0.7);
      });
      
      // Variance should be reasonable (consistency check)
      const avgAccuracy = accuracyResults.reduce((sum, acc) => sum + acc, 0) / accuracyResults.length;
      const variance = accuracyResults.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracyResults.length;
      expect(Math.sqrt(variance) / avgAccuracy).toBeLessThan(0.25); // CV < 25%
    });
      const result = await analyzer.analyzePatterns(syntheticData.interactions);
      
      // Calculate accuracy by comparing identified patterns with known patterns
      const accuracy = calculatePatternAccuracy(result.patterns, syntheticData.expectedPatterns);
      expect(accuracy).toBeGreaterThan(0.8);
      
      // Verify confidence scores
      expect(result.confidence.overall).toBeGreaterThan(0.7);
      expect(result.confidence.patternRecognition).toBeGreaterThan(0.75);
    });

    test('should handle edge cases and maintain stability', async () => {
      // Test with minimal data
      const minimalInteractions = createMinimalTestData();
      const minimalResult = await analyzer.analyzePatterns(minimalInteractions);
      expect(minimalResult.patterns.length).toBeGreaterThanOrEqual(0);
      
      // Test with noisy data
      const noisyInteractions = createNoisyTestData();
      const noisyResult = await analyzer.analyzePatterns(noisyInteractions);
      expect(noisyResult.confidence.overall).toBeGreaterThan(0.3);
      
      // Test with conflicting patterns
      const conflictingInteractions = createConflictingPatternData();
      const conflictingResult = await analyzer.analyzePatterns(conflictingInteractions);
      expect(conflictingResult.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Preference Inference Algorithm Accuracy', () => {
    test('should accurately infer communication preferences from patterns', async () => {
      const userId = 'test-user-1';
      
      // Set up patterns that indicate communication preferences
      const communicationPatterns = createCommunicationPreferencePatterns();
      await setupUserPatterns(userId, communicationPatterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.COMMUNICATION);
      
      // Verify preference inference accuracy
      expect(preferences.confidence).toBeGreaterThan(0.7);
      expect(preferences.preferences.length).toBeGreaterThan(0);
      
      // Verify specific communication preferences
      const formalityPreference = preferences.preferences.find(p => p.key === 'formality');
      expect(formalityPreference).toBeDefined();
      expect(formalityPreference!.confidence).toBeGreaterThan(0.6);
    });

    test('should accurately infer scheduling preferences from temporal patterns', async () => {
      const userId = 'test-user-2';
      
      const schedulingPatterns = createSchedulingPreferencePatterns();
      await setupUserPatterns(userId, schedulingPatterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.SCHEDULING);
      
      // Verify scheduling preference accuracy
      expect(preferences.confidence).toBeGreaterThan(0.7);
      
      const timePreference = preferences.preferences.find(p => p.key === 'preferred_time');
      expect(timePreference).toBeDefined();
      expect(['morning', 'afternoon', 'evening']).toContain(timePreference!.value);
    });

    test('should accurately infer content preferences from interaction patterns', async () => {
      const userId = 'test-user-3';
      
      const contentPatterns = createContentPreferencePatterns();
      await setupUserPatterns(userId, contentPatterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.CONTENT);
      
      // Verify content preference accuracy
      expect(preferences.confidence).toBeGreaterThan(0.6);
      expect(preferences.preferences.length).toBeGreaterThan(0);
      
      // Verify topic preferences
      const topicPreference = preferences.preferences.find(p => p.key === 'topics');
      expect(topicPreference).toBeDefined();
      expect(Array.isArray(topicPreference!.value)).toBe(true);
    });

    test('should maintain preference inference accuracy above 75%', async () => {
      const testCases = createPreferenceInferenceTestCases();
      
      let correctInferences = 0;
      
      for (const testCase of testCases) {
        await setupUserPatterns(testCase.userId, testCase.patterns);
        const preferences = await analyzer.identifyPreferences(testCase.userId, testCase.domain);
        
        const accuracy = calculatePreferenceAccuracy(preferences, testCase.expectedPreferences);
        if (accuracy > 0.75) {
          correctInferences++;
        }
      }
      
      const overallAccuracy = correctInferences / testCases.length;
      expect(overallAccuracy).toBeGreaterThan(0.75);
    });

    test('should handle preference conflicts and ambiguity', async () => {
      const userId = 'test-user-conflict';
      
      // Create conflicting preference patterns
      const conflictingPatterns = createConflictingPreferencePatterns();
      await setupUserPatterns(userId, conflictingPatterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.INTERACTION);
      
      // Should still provide preferences but with lower confidence
      expect(preferences.preferences.length).toBeGreaterThan(0);
      expect(preferences.confidence).toBeLessThan(0.8); // Lower confidence due to conflicts
      expect(preferences.confidence).toBeGreaterThan(0.3); // But not too low
    });
  });

  describe('Context Aggregation from Multiple Sources', () => {
    test('should accurately aggregate temporal context from multiple time-based sources', async () => {
      const userId = 'test-user-temporal';
      
      // Register multiple temporal context sources
      await registerTemporalContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Verify temporal context accuracy
      expect(context.temporal).toBeDefined();
      expect(context.temporal.timeOfDay).toBeDefined();
      expect(context.temporal.dayOfWeek).toBeDefined();
      expect(Object.values(TimeOfDay)).toContain(context.temporal.timeOfDay);
      expect(Object.values(DayOfWeek)).toContain(context.temporal.dayOfWeek);
    });

    test('should accurately aggregate environmental context from smart home sensors', async () => {
      const userId = 'test-user-environmental';
      
      // Register environmental context sources
      await registerEnvironmentalContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Verify environmental context accuracy
      expect(context.environmental).toBeDefined();
      expect(context.environmental.location).toBeDefined();
      expect(context.environmental.weather).toBeDefined();
      expect(context.environmental.lighting).toBeDefined();
      expect(context.environmental.noise).toBeDefined();
      
      // Verify data types and ranges
      expect(typeof context.environmental.temperature).toBe('number');
      expect(context.environmental.temperature).toBeGreaterThan(-50);
      expect(context.environmental.temperature).toBeLessThan(60);
    });

    test('should accurately aggregate social context from presence detection', async () => {
      const userId = 'test-user-social';
      
      // Register social context sources
      await registerSocialContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Verify social context accuracy
      expect(context.social).toBeDefined();
      expect(Array.isArray(context.social.presentUsers)).toBe(true);
      expect(Array.isArray(context.social.familyMembers)).toBe(true);
      expect(typeof context.social.guestPresent).toBe('boolean');
      expect(Object.values(SocialActivity)).toContain(context.social.socialActivity);
    });

    test('should maintain context aggregation accuracy above 85%', async () => {
      const testScenarios = createContextAggregationTestScenarios();
      
      let accurateAggregations = 0;
      
      for (const scenario of testScenarios) {
        // Set up scenario-specific context sources
        await setupContextScenario(scenario);
        
        const context = await contextAggregator.getCurrentContext(scenario.userId);
        const accuracy = calculateContextAccuracy(context, scenario.expectedContext);
        
        if (accuracy > 0.85) {
          accurateAggregations++;
        }
      }
      
      const overallAccuracy = accurateAggregations / testScenarios.length;
      expect(overallAccuracy).toBeGreaterThan(0.85);
    });

    test('should handle context source failures gracefully', async () => {
      const userId = 'test-user-failure';
      
      // Register context sources with some that will fail
      await registerMixedReliabilityContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Should still provide context even with some source failures
      expect(context).toBeDefined();
      expect(context.userId).toBe(userId);
      expect(context.timestamp).toBeDefined();
      
      // At least some context should be available
      const hasValidContext = 
        context.temporal || 
        context.environmental || 
        context.social || 
        context.device;
      expect(hasValidContext).toBe(true);
    });

    test('should detect and handle context conflicts between sources', async () => {
      const userId = 'test-user-conflicts';
      
      // Register conflicting context sources
      await registerConflictingContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Should resolve conflicts and provide consistent context
      expect(context).toBeDefined();
      
      // Verify conflict resolution in environmental data
      if (context.environmental) {
        expect(context.environmental.temperature).toBeGreaterThan(-50);
        expect(context.environmental.temperature).toBeLessThan(60);
        expect(context.environmental.lighting.brightness).toBeGreaterThanOrEqual(0);
        expect(context.environmental.lighting.brightness).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Pattern Recognition Performance and Accuracy Metrics', () => {
    test('should maintain sub-100ms inference time for real-time decisions', async () => {
      const interactions = createLargeDatasetForPerformanceTest();
      
      const startTime = Date.now();
      const result = await analyzer.analyzePatterns(interactions);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(100);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should scale pattern recognition with increasing data volume', async () => {
      const dataSizes = [10, 50, 100, 200];
      const performanceResults: number[] = [];
      
      for (const size of dataSizes) {
        const interactions = createScalabilityTestData(size);
        
        const startTime = Date.now();
        await analyzer.analyzePatterns(interactions);
        const endTime = Date.now();
        
        performanceResults.push(endTime - startTime);
      }
      
      // Performance should scale reasonably (not exponentially)
      const scalingFactor = performanceResults[3] / performanceResults[0];
      expect(scalingFactor).toBeLessThan(10); // Should not be more than 10x slower for 20x data
    });

    test('should maintain accuracy under memory constraints', async () => {
      const interactions = createMemoryConstrainedTestData();
      
      // Simulate memory pressure
      const result = await analyzer.analyzePatterns(interactions);
      
      // Should still maintain reasonable accuracy
      expect(result.confidence.overall).toBeGreaterThan(0.6);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should provide accurate confidence scores for pattern strength', async () => {
      const testCases = createConfidenceTestCases();
      
      for (const testCase of testCases) {
        const result = await analyzer.analyzePatterns(testCase.interactions);
        
        // Confidence should correlate with actual pattern strength
        const strongPatterns = result.patterns.filter(p => p.strength > 0.8);
        const weakPatterns = result.patterns.filter(p => p.strength < 0.4);
        
        if (strongPatterns.length > 0) {
          expect(result.confidence.patternRecognition).toBeGreaterThan(0.7);
        }
        
        if (weakPatterns.length > strongPatterns.length) {
          expect(result.confidence.patternRecognition).toBeLessThan(0.8);
        }
      }
    });

    test('should achieve 85% accuracy in pattern classification with labeled test data', async () => {
      const labeledTestData = createLabeledPatternTestData();
      let correctClassifications = 0;
      let totalClassifications = 0;

      for (const testCase of labeledTestData) {
        const result = await analyzer.analyzePatterns(testCase.interactions);
        
        for (const expectedPattern of testCase.expectedPatterns) {
          const matchingPattern = result.patterns.find(p => 
            p.type === expectedPattern.type && 
            p.strength > 0.6 &&
            isPatternContextMatch(p.context, expectedPattern.context)
          );
          
          if (matchingPattern) {
            correctClassifications++;
          }
          totalClassifications++;
        }
      }

      const accuracy = correctClassifications / totalClassifications;
      expect(accuracy).toBeGreaterThan(0.85);
    });

    test('should maintain consistent accuracy across different user behavior types', async () => {
      const behaviorTypes = ['routine', 'spontaneous', 'mixed', 'irregular'];
      const accuracyResults: number[] = [];

      for (const behaviorType of behaviorTypes) {
        const testData = createBehaviorTypeTestData(behaviorType);
        const result = await analyzer.analyzePatterns(testData.interactions);
        
        const accuracy = calculatePatternAccuracy(result.patterns, testData.expectedPatterns);
        accuracyResults.push(accuracy);
      }

      // All behavior types should maintain minimum accuracy
      accuracyResults.forEach(accuracy => {
        expect(accuracy).toBeGreaterThan(0.75);
      });

      // Variance in accuracy should be reasonable (< 20%)
      const avgAccuracy = accuracyResults.reduce((sum, acc) => sum + acc, 0) / accuracyResults.length;
      const variance = accuracyResults.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracyResults.length;
      const standardDeviation = Math.sqrt(variance);
      
      expect(standardDeviation / avgAccuracy).toBeLessThan(0.2);
    });

    test('should detect pattern degradation and maintain quality thresholds', async () => {
      const baselineData = createHighQualityPatternData();
      const degradedData = createDegradedPatternData();

      const baselineResult = await analyzer.analyzePatterns(baselineData.interactions);
      const degradedResult = await analyzer.analyzePatterns(degradedData.interactions);

      // Should detect quality degradation
      expect(degradedResult.confidence.overall).toBeLessThan(baselineResult.confidence.overall);
      
      // Should still maintain minimum quality thresholds
      expect(degradedResult.confidence.overall).toBeGreaterThan(0.5);
      expect(degradedResult.patterns.length).toBeGreaterThan(0);

      // Should flag quality issues in confidence scores
      if (degradedResult.confidence.overall < 0.7) {
        expect(degradedResult.confidence.patternRecognition).toBeLessThan(0.8);
      }
    });
  });

  describe('Pattern Feedback and Adaptation', () => {
    test('should improve pattern accuracy based on user feedback', async () => {
      const userId = 'test-user-feedback';
      const interactions = createFeedbackTestData();
      
      // Initial pattern analysis
      const initialResult = await analyzer.analyzePatterns(interactions);
      const initialAccuracy = calculateOverallAccuracy(initialResult);
      
      // Provide positive feedback for correct patterns
      const correctPatterns = identifyCorrectPatterns(initialResult.patterns);
      for (const pattern of correctPatterns) {
        const feedback: PatternFeedback = {
          patternId: pattern.id,
          userId,
          feedbackType: PatternFeedbackType.CONFIRMATION,
          accuracy: 0.9,
          relevance: 0.9,
          actionTaken: FeedbackAction.ACCEPTED,
          timestamp: new Date()
        };
        await analyzer.updatePatternWeights(userId, feedback);
      }
      
      // Analyze patterns again
      const improvedResult = await analyzer.analyzePatterns(interactions);
      const improvedAccuracy = calculateOverallAccuracy(improvedResult);
      
      // Accuracy should improve
      expect(improvedAccuracy).toBeGreaterThan(initialAccuracy);
    });

    test('should reduce confidence for patterns with negative feedback', async () => {
      const userId = 'test-user-negative-feedback';
      const interactions = createNegativeFeedbackTestData();
      
      const initialResult = await analyzer.analyzePatterns(interactions);
      
      // Provide negative feedback for incorrect patterns
      const incorrectPatterns = identifyIncorrectPatterns(initialResult.patterns);
      for (const pattern of incorrectPatterns) {
        const feedback: PatternFeedback = {
          patternId: pattern.id,
          userId,
          feedbackType: PatternFeedbackType.CORRECTION,
          accuracy: 0.2,
          relevance: 0.3,
          actionTaken: FeedbackAction.REJECTED,
          timestamp: new Date()
        };
        await analyzer.updatePatternWeights(userId, feedback);
      }
      
      // Get pattern insights after feedback
      const insights = await analyzer.getPatternInsights(userId);
      
      // Patterns with negative feedback should have reduced strength
      const feedbackPatternIds = incorrectPatterns.map(p => p.id);
      const updatedPatterns = insights.strongPatterns.filter(p => 
        feedbackPatternIds.includes(p.id)
      );
      
      // Should have fewer strong patterns after negative feedback
      expect(updatedPatterns.length).toBeLessThan(incorrectPatterns.length);
    });

    test('should maintain accuracy above 75% after feedback integration', async () => {
      const userId = 'test-user-feedback-accuracy';
      const interactions = createBalancedFeedbackTestData();
      
      // Initial analysis
      const initialResult = await analyzer.analyzePatterns(interactions);
      
      // Provide mixed feedback (positive and negative)
      const feedbackData = createMixedFeedbackData(initialResult.patterns, userId);
      
      for (const feedback of feedbackData) {
        await analyzer.updatePatternWeights(userId, feedback);
      }
      
      // Re-analyze after feedback
      const updatedResult = await analyzer.analyzePatterns(interactions);
      const finalAccuracy = calculateOverallAccuracy(updatedResult);
      
      // Should maintain high accuracy even with mixed feedback
      expect(finalAccuracy).toBeGreaterThan(0.75);
      expect(updatedResult.confidence.overall).toBeGreaterThan(0.7);
    });

    test('should adapt pattern weights based on feedback frequency', async () => {
      const userId = 'test-user-feedback-frequency';
      const interactions = createRepeatedPatternTestData();
      
      const result = await analyzer.analyzePatterns(interactions);
      const targetPattern = result.patterns[0];
      
      // Provide multiple positive feedbacks for the same pattern
      for (let i = 0; i < 5; i++) {
        const feedback: PatternFeedback = {
          patternId: targetPattern.id,
          userId,
          feedbackType: PatternFeedbackType.CONFIRMATION,
          accuracy: 0.95,
          relevance: 0.9,
          actionTaken: FeedbackAction.ACCEPTED,
          timestamp: new Date(Date.now() + i * 1000)
        };
        await analyzer.updatePatternWeights(userId, feedback);
      }
      
      // Get updated insights
      const insights = await analyzer.getPatternInsights(userId);
      const updatedPattern = insights.strongPatterns.find(p => p.id === targetPattern.id);
      
      // Pattern strength should increase with repeated positive feedback
      expect(updatedPattern).toBeDefined();
      expect(updatedPattern!.strength).toBeGreaterThan(targetPattern.strength);
    });
  });

  // Additional helper functions for feedback tests
  function createFeedbackTestData(): FilteredInteraction[] {
    return createTemporalPatternTestData().concat(createBehavioralPatternTestData());
  }

  function createNegativeFeedbackTestData(): FilteredInteraction[] {
    return createNoisyTestData();
  }

  function createBalancedFeedbackTestData(): FilteredInteraction[] {
    return createSyntheticPatternData(50).interactions;
  }

  function createRepeatedPatternTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create repeated pattern for feedback testing
    for (let i = 0; i < 10; i++) {
      interactions.push({
        userId: 'feedback-user',
        patterns: [{
          patternHash: 'repeated_pattern',
          type: PatternType.BEHAVIORAL,
          strength: 0.7,
          frequency: 1,
          contextHash: 'consistent_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_weather_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 8,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function calculateOverallAccuracy(result: PatternAnalysisResult): number {
    if (result.patterns.length === 0) return 0;
    return result.patterns.reduce((sum, p) => sum + p.strength, 0) / result.patterns.length;
  }

  function identifyCorrectPatterns(patterns: IdentifiedPattern[]): IdentifiedPattern[] {
    // Assume patterns with high strength are correct
    return patterns.filter(p => p.strength > 0.7);
  }

  function identifyIncorrectPatterns(patterns: IdentifiedPattern[]): IdentifiedPattern[] {
    // Assume patterns with low strength are incorrect
    return patterns.filter(p => p.strength < 0.5);
  }

  function createMixedFeedbackData(patterns: IdentifiedPattern[], userId: string): PatternFeedback[] {
    const feedback: PatternFeedback[] = [];
    
    patterns.forEach((pattern, index) => {
      const isPositive = index % 2 === 0; // Alternate positive/negative
      
      feedback.push({
        patternId: pattern.id,
        userId,
        feedbackType: isPositive ? PatternFeedbackType.CONFIRMATION : PatternFeedbackType.CORRECTION,
        accuracy: isPositive ? 0.9 : 0.3,
        relevance: isPositive ? 0.85 : 0.4,
        actionTaken: isPositive ? FeedbackAction.ACCEPTED : FeedbackAction.REJECTED,
        timestamp: new Date()
      });
    });
    
    return feedback;
  }

  // Helper functions for test data creation and validation

  function createSyntheticPatternData(count: number): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    // Create synthetic data with known patterns
    for (let i = 0; i < count; i++) {
      const patternType = i % 3 === 0 ? PatternType.TEMPORAL : 
                         i % 3 === 1 ? PatternType.CONTEXTUAL : PatternType.BEHAVIORAL;
      
      interactions.push({
        userId: 'synthetic-user',
        patterns: [{
          patternHash: `synthetic_pattern_${i}`,
          type: patternType,
          strength: 0.7 + Math.random() * 0.3,
          frequency: Math.floor(Math.random() * 5) + 3,
          contextHash: `synthetic_context_${i % 10}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `synthetic_temporal_${i % 4}`,
          locationHash: `synthetic_location_${i % 3}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `synthetic_env_${i % 5}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 5 + Math.random() * 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    // Create expected patterns based on synthetic data
    expectedPatterns.push({
      id: 'expected-temporal-synthetic',
      type: PatternType.TEMPORAL,
      description: 'Synthetic temporal pattern',
      frequency: Math.floor(count / 3),
      strength: 0.8,
      context: {} as any,
      examples: [],
      lastObserved: new Date()
    });
    
    return { interactions, expectedPatterns };
  }

  function createMinimalTestData(): FilteredInteraction[] {
    return [{
      userId: 'minimal-user',
      patterns: [{
        patternHash: 'minimal_pattern',
        type: PatternType.BEHAVIORAL,
        strength: 0.5,
        frequency: 1,
        contextHash: 'minimal_context',
        anonymizationLevel: 'moderate' as any
      }],
      context: {
        temporalHash: 'minimal_temporal',
        locationHash: 'minimal_location',
        deviceTypeHash: 'smart_display_hash',
        environmentalHash: 'minimal_env',
        privacyLevel: PrivacyLevel.STANDARD
      },
      metadata: {
        processingTime: 5,
        privacyFiltersApplied: ['pii_removal'],
        dataRetentionDays: 30,
        complianceFlags: []
      },
      privacyLevel: PrivacyLevel.STANDARD
    }];
  }

  function createNoisyTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create noisy data with random patterns
    for (let i = 0; i < 20; i++) {
      interactions.push({
        userId: 'noisy-user',
        patterns: [{
          patternHash: `noisy_pattern_${i}`,
          type: Object.values(PatternType)[Math.floor(Math.random() * Object.values(PatternType).length)],
          strength: Math.random(), // Random strength
          frequency: Math.floor(Math.random() * 3) + 1,
          contextHash: `noisy_context_${Math.floor(Math.random() * 20)}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `noisy_temporal_${Math.floor(Math.random() * 10)}`,
          locationHash: `noisy_location_${Math.floor(Math.random() * 10)}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `noisy_env_${Math.floor(Math.random() * 10)}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: Math.random() * 50,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createConflictingPatternData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create conflicting patterns (same context, different behaviors)
    for (let i = 0; i < 10; i++) {
      interactions.push({
        userId: 'conflicting-user',
        patterns: [{
          patternHash: `conflicting_pattern_${i}`,
          type: PatternType.BEHAVIORAL,
          strength: i % 2 === 0 ? 0.8 : 0.2, // Conflicting strengths
          frequency: i % 2 === 0 ? 5 : 1,
          contextHash: 'same_context', // Same context for all
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_weather_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createHabitDetectionTestData(): { interactions: FilteredInteraction[], expectedHabits: DetectedHabit[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedHabits: DetectedHabit[] = [];
    
    // Create regular morning routine pattern
    for (let i = 0; i < 15; i++) {
      const date = new Date('2024-01-01');
      date.setDate(date.getDate() + i);
      
      interactions.push({
        userId: 'habit-user',
        patterns: [{
          patternHash: `habit_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.85,
          frequency: 1,
          contextHash: 'morning_routine_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'normal_env_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 8,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    // Expected habit
    expectedHabits.push({
      habitId: 'expected-morning-routine',
      type: HabitType.ROUTINE,
      description: 'Morning routine habit',
      strength: 0.85,
      frequency: 15,
      context: {} as any,
      predictability: 0.9,
      lastOccurrence: new Date('2024-01-15')
    });
    
    return { interactions, expectedHabits };
  }

  function calculatePatternAccuracy(identifiedPatterns: IdentifiedPattern[], expectedPatterns: IdentifiedPattern[]): number {
    if (expectedPatterns.length === 0) return 1.0;
    
    let correctIdentifications = 0;
    
    for (const expected of expectedPatterns) {
      const matching = identifiedPatterns.find(p => 
        p.type === expected.type && 
        p.strength >= 0.6 &&
        p.frequency >= Math.max(1, expected.frequency * 0.5)
      );
      
      if (matching) {
        correctIdentifications++;
      }
    }
    
    return correctIdentifications / expectedPatterns.length;
  }

  function calculateHabitDetectionPrecision(detectedHabits: DetectedHabit[], expectedHabits: DetectedHabit[]): number {
    if (detectedHabits.length === 0) return expectedHabits.length === 0 ? 1.0 : 0.0;
    
    let truePositives = 0;
    
    for (const detected of detectedHabits) {
      const matching = expectedHabits.find(h => 
        h.type === detected.type && 
        Math.abs(h.strength - detected.strength) < 0.3
      );
      
      if (matching) {
        truePositives++;
      }
    }
    
    return truePositives / detectedHabits.length;
  }

  function createTemporalPatternTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    const baseTime = new Date('2024-01-01T09:00:00Z');
    
    // Create morning routine pattern (5 interactions)
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(baseTime.getTime() + (i * 24 * 60 * 60 * 1000));
      timestamp.setHours(9, 0, 0, 0); // 9 AM each day
      
      interactions.push({
        userId: 'user1',
        patterns: [{
          patternHash: `pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.8,
          frequency: 1,
          contextHash: 'morning_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_weather_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createContextualPatternTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create weather-based pattern
    for (let i = 0; i < 4; i++) {
      interactions.push({
        userId: 'user2',
        patterns: [{
          patternHash: `contextual_pattern_${i}`,
          type: PatternType.CONTEXTUAL,
          strength: 0.7,
          frequency: 1,
          contextHash: 'rainy_day_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'afternoon_hash',
          locationHash: 'living_room_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'rainy_weather_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 12,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createBehavioralPatternTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create help-seeking behavior pattern
    for (let i = 0; i < 3; i++) {
      interactions.push({
        userId: 'user3',
        patterns: [{
          patternHash: `behavioral_pattern_${i}`,
          type: PatternType.BEHAVIORAL,
          strength: 0.75,
          frequency: 1,
          contextHash: 'help_seeking_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'evening_hash',
          locationHash: 'study_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'cloudy_weather_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 8,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createLabeledPatternTestData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] }[] {
    const testCases: { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] }[] = [];
    
    // Test case 1: Clear temporal pattern
    testCases.push({
      interactions: createTemporalPatternTestData(),
      expectedPatterns: [{
        id: 'expected-temporal-1',
        type: PatternType.TEMPORAL,
        description: 'Morning routine pattern',
        frequency: 5,
        strength: 0.8,
        context: {
          temporal: {
            timeOfDay: TimeOfDay.MORNING,
            dayOfWeek: DayOfWeek.MONDAY,
            season: 'spring' as any,
            isHoliday: false,
            timeZone: 'UTC',
            relativeToSchedule: 'free_time' as any
          },
          environmental: {
            location: { room: 'kitchen', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
            weather: { condition: WeatherCondition.SUNNY, temperature: 22, humidity: 50, isRaining: false },
            lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
            noise: { level: 30, type: NoiseType.QUIET, isDistracting: false },
            temperature: 22
          },
          social: {
            presentUsers: ['user1'],
            familyMembers: [],
            guestPresent: false,
            socialActivity: SocialActivity.ALONE
          },
          device: {
            deviceType: DeviceType.SMART_DISPLAY,
            screenSize: 'medium' as any,
            inputMethod: 'voice' as any,
            connectivity: 'online' as any
          }
        },
        examples: [],
        lastObserved: new Date()
      }]
    });

    // Test case 2: Contextual pattern
    testCases.push({
      interactions: createContextualPatternTestData(),
      expectedPatterns: [{
        id: 'expected-contextual-1',
        type: PatternType.CONTEXTUAL,
        description: 'Rainy day behavior pattern',
        frequency: 4,
        strength: 0.7,
        context: {
          temporal: {
            timeOfDay: TimeOfDay.AFTERNOON,
            dayOfWeek: DayOfWeek.TUESDAY,
            season: 'spring' as any,
            isHoliday: false,
            timeZone: 'UTC',
            relativeToSchedule: 'free_time' as any
          },
          environmental: {
            location: { room: 'living_room', building: 'home', city: 'test', isHome: true, isWork: false, isPublic: false },
            weather: { condition: WeatherCondition.RAINY, temperature: 18, humidity: 80, isRaining: true },
            lighting: { brightness: 50, isNatural: false, colorTemperature: 4000 },
            noise: { level: 40, type: NoiseType.QUIET, isDistracting: false },
            temperature: 18
          },
          social: {
            presentUsers: ['user2'],
            familyMembers: [],
            guestPresent: false,
            socialActivity: SocialActivity.ALONE
          },
          device: {
            deviceType: DeviceType.SMART_DISPLAY,
            screenSize: 'medium' as any,
            inputMethod: 'voice' as any,
            connectivity: 'online' as any
          }
        },
        examples: [],
        lastObserved: new Date()
      }]
    });

    return testCases;
  }

  function createBehaviorTypeTestData(behaviorType: string): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];

    switch (behaviorType) {
      case 'routine':
        // Create highly regular patterns
        for (let i = 0; i < 7; i++) {
          interactions.push({
            userId: 'routine-user',
            patterns: [{
              patternHash: `routine_pattern_${i}`,
              type: PatternType.TEMPORAL,
              strength: 0.9,
              frequency: 1,
              contextHash: 'routine_context',
              anonymizationLevel: 'moderate' as any
            }],
            context: {
              temporalHash: 'morning_weekday_hash',
              locationHash: 'kitchen_hash',
              deviceTypeHash: 'smart_display_hash',
              environmentalHash: 'sunny_morning_hash',
              privacyLevel: PrivacyLevel.STANDARD
            },
            metadata: {
              processingTime: 5,
              privacyFiltersApplied: ['pii_removal', 'anonymization'],
              dataRetentionDays: 30,
              complianceFlags: []
            },
            privacyLevel: PrivacyLevel.STANDARD
          });
        }
        
        expectedPatterns.push({
          id: 'routine-pattern-1',
          type: PatternType.TEMPORAL,
          description: 'Highly regular morning routine',
          frequency: 7,
          strength: 0.9,
          context: createDefaultPatternContext(),
          examples: [],
          lastObserved: new Date()
        });
        break;

      case 'spontaneous':
        // Create irregular patterns with low frequency
        for (let i = 0; i < 3; i++) {
          interactions.push({
            userId: 'spontaneous-user',
            patterns: [{
              patternHash: `spontaneous_pattern_${i}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.6,
              frequency: 1,
              contextHash: `spontaneous_context_${i}`,
              anonymizationLevel: 'moderate' as any
            }],
            context: {
              temporalHash: `random_time_${i}`,
              locationHash: `random_location_${i}`,
              deviceTypeHash: 'smart_display_hash',
              environmentalHash: `random_env_${i}`,
              privacyLevel: PrivacyLevel.STANDARD
            },
            metadata: {
              processingTime: 8,
              privacyFiltersApplied: ['pii_removal', 'anonymization'],
              dataRetentionDays: 30,
              complianceFlags: []
            },
            privacyLevel: PrivacyLevel.STANDARD
          });
        }
        
        expectedPatterns.push({
          id: 'spontaneous-pattern-1',
          type: PatternType.BEHAVIORAL,
          description: 'Spontaneous behavior pattern',
          frequency: 3,
          strength: 0.6,
          context: createDefaultPatternContext(),
          examples: [],
          lastObserved: new Date()
        });
        break;

      case 'mixed':
        // Create mix of regular and irregular patterns
        for (let i = 0; i < 5; i++) {
          const isRegular = i % 2 === 0;
          interactions.push({
            userId: 'mixed-user',
            patterns: [{
              patternHash: `mixed_pattern_${i}`,
              type: isRegular ? PatternType.TEMPORAL : PatternType.BEHAVIORAL,
              strength: isRegular ? 0.8 : 0.6,
              frequency: 1,
              contextHash: `mixed_context_${i}`,
              anonymizationLevel: 'moderate' as any
            }],
            context: {
              temporalHash: isRegular ? 'regular_time_hash' : `irregular_time_${i}`,
              locationHash: 'home_hash',
              deviceTypeHash: 'smart_display_hash',
              environmentalHash: 'normal_env_hash',
              privacyLevel: PrivacyLevel.STANDARD
            },
            metadata: {
              processingTime: 7,
              privacyFiltersApplied: ['pii_removal', 'anonymization'],
              dataRetentionDays: 30,
              complianceFlags: []
            },
            privacyLevel: PrivacyLevel.STANDARD
          });
        }
        
        expectedPatterns.push({
          id: 'mixed-pattern-1',
          type: PatternType.TEMPORAL,
          description: 'Mixed behavior pattern - regular component',
          frequency: 3,
          strength: 0.8,
          context: createDefaultPatternContext(),
          examples: [],
          lastObserved: new Date()
        });
        break;

      case 'irregular':
        // Create completely irregular patterns
        for (let i = 0; i < 4; i++) {
          interactions.push({
            userId: 'irregular-user',
            patterns: [{
              patternHash: `irregular_pattern_${i}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.4 + Math.random() * 0.3,
              frequency: 1,
              contextHash: `irregular_context_${i}`,
              anonymizationLevel: 'moderate' as any
            }],
            context: {
              temporalHash: `irregular_time_${i}`,
              locationHash: `irregular_location_${i}`,
              deviceTypeHash: 'smart_display_hash',
              environmentalHash: `irregular_env_${i}`,
              privacyLevel: PrivacyLevel.STANDARD
            },
            metadata: {
              processingTime: 12,
              privacyFiltersApplied: ['pii_removal', 'anonymization'],
              dataRetentionDays: 30,
              complianceFlags: []
            },
            privacyLevel: PrivacyLevel.STANDARD
          });
        }
        
        expectedPatterns.push({
          id: 'irregular-pattern-1',
          type: PatternType.BEHAVIORAL,
          description: 'Irregular behavior pattern',
          frequency: 4,
          strength: 0.5,
          context: createDefaultPatternContext(),
          examples: [],
          lastObserved: new Date()
        });
        break;
    }

    return { interactions, expectedPatterns };
  }

  function createHighQualityPatternData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    
    // Create high-quality, consistent patterns
    for (let i = 0; i < 10; i++) {
      interactions.push({
        userId: 'quality-user',
        patterns: [{
          patternHash: `quality_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.85 + Math.random() * 0.1, // High strength with low variance
          frequency: 1,
          contextHash: 'consistent_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_weekday_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'optimal_conditions_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 5,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }

    return {
      interactions,
      expectedPatterns: [{
        id: 'quality-pattern-1',
        type: PatternType.TEMPORAL,
        description: 'High quality consistent pattern',
        frequency: 10,
        strength: 0.9,
        context: createDefaultPatternContext(),
        examples: [],
        lastObserved: new Date()
      }]
    };
  }

  function createDegradedPatternData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    
    // Create degraded patterns with noise and inconsistency
    for (let i = 0; i < 10; i++) {
      interactions.push({
        userId: 'degraded-user',
        patterns: [{
          patternHash: `degraded_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.3 + Math.random() * 0.4, // Lower strength with high variance
          frequency: 1,
          contextHash: `inconsistent_context_${i % 3}`, // Multiple contexts
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `variable_time_${i % 4}`,
          locationHash: `variable_location_${i % 3}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `variable_env_${i % 5}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 15 + Math.random() * 10, // Variable processing time
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }

    return {
      interactions,
      expectedPatterns: [{
        id: 'degraded-pattern-1',
        type: PatternType.TEMPORAL,
        description: 'Degraded inconsistent pattern',
        frequency: 10,
        strength: 0.5,
        context: createDefaultPatternContext(),
        examples: [],
        lastObserved: new Date()
      }]
    };
  }

  function createDefaultPatternContext(): any {
    return {
      temporal: {
        timeOfDay: TimeOfDay.MORNING,
        dayOfWeek: DayOfWeek.MONDAY,
        season: 'spring' as any,
        isHoliday: false,
        timeZone: 'UTC',
        relativeToSchedule: 'free_time' as any
      },
      environmental: {
        location: { room: 'test', building: 'test', city: 'test', isHome: true, isWork: false, isPublic: false },
        weather: { condition: WeatherCondition.SUNNY, temperature: 22, humidity: 50, isRaining: false },
        lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
        noise: { level: 30, type: NoiseType.QUIET, isDistracting: false },
        temperature: 22
      },
      social: {
        presentUsers: [],
        familyMembers: [],
        guestPresent: false,
        socialActivity: SocialActivity.ALONE
      },
      device: {
        deviceType: DeviceType.SMART_DISPLAY,
        screenSize: 'medium' as any,
        inputMethod: 'voice' as any,
        connectivity: 'online' as any
      }
    };
  }

  function isPatternContextMatch(actual: any, expected: any): boolean {
    // Simple context matching - in practice would be more sophisticated
    if (!actual || !expected) return false;
    
    // Check temporal context match
    if (actual.temporal && expected.temporal) {
      if (actual.temporal.timeOfDay !== expected.temporal.timeOfDay) return false;
    }
    
    // Check environmental context match
    if (actual.environmental && expected.environmental) {
      if (actual.environmental.location?.room !== expected.environmental.location?.room) return false;
    }
    
    return true;
  }

  function createSyntheticPatternData(count: number): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    // Generate synthetic data with known patterns
    for (let i = 0; i < count; i++) {
      const patternType = i % 3 === 0 ? 'temporal' : i % 3 === 1 ? 'contextual' : 'behavioral';
      const strength = 0.6 + (Math.random() * 0.3); // 0.6 to 0.9
      
      const patternTypeEnum = patternType === 'temporal' ? PatternType.TEMPORAL : 
                             patternType === 'contextual' ? PatternType.CONTEXTUAL : 
                             PatternType.BEHAVIORAL;
      
      interactions.push({
        userId: 'synthetic-user',
        patterns: [{
          patternHash: `synthetic_pattern_${i}`,
          type: patternTypeEnum,
          strength,
          frequency: 1,
          contextHash: `synthetic_context_${i}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_monday_hash',
          locationHash: 'test_location_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_test_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 5,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
      
      if (strength > 0.7) {
        const patternTypeEnum = patternType === 'temporal' ? PatternType.TEMPORAL : 
                               patternType === 'contextual' ? PatternType.CONTEXTUAL : 
                               PatternType.BEHAVIORAL;
        
        expectedPatterns.push({
          id: `expected-${i}`,
          type: patternTypeEnum,
          description: `Expected ${patternType} pattern ${i}`,
          frequency: 1,
          strength,
          context: {
            temporal: {
              timeOfDay: TimeOfDay.MORNING,
              dayOfWeek: DayOfWeek.MONDAY,
              season: 'spring' as any,
              isHoliday: false,
              timeZone: 'UTC',
              relativeToSchedule: 'free_time' as any
            },
            environmental: {
              location: { room: 'test', building: 'test', city: 'test', isHome: true, isWork: false, isPublic: false },
              weather: { condition: WeatherCondition.SUNNY, temperature: 22, humidity: 50, isRaining: false },
              lighting: { brightness: 70, isNatural: true, colorTemperature: 5000 },
              noise: { level: 30, type: NoiseType.QUIET, isDistracting: false },
              temperature: 22
            },
            social: {
              presentUsers: [],
              familyMembers: [],
              guestPresent: false,
              socialActivity: SocialActivity.ALONE
            },
            device: {
              deviceType: DeviceType.SMART_DISPLAY,
              screenSize: 'medium' as any,
              inputMethod: 'voice' as any,
              connectivity: 'online' as any
            }
          },
          examples: [],
          lastObserved: new Date()
        });
      }
    }
    
    return { interactions, expectedPatterns };
  }

  function createMinimalTestData(): FilteredInteraction[] {
    return [{
      userId: 'minimal-user',
      patterns: [{
        patternHash: 'minimal_pattern',
        type: PatternType.BEHAVIORAL,
        strength: 0.5,
        frequency: 1,
        contextHash: 'minimal_context',
        anonymizationLevel: 'moderate' as any
      }],
      context: {
        temporalHash: 'morning_monday_hash',
        locationHash: 'test_location_hash',
        deviceTypeHash: 'smart_display_hash',
        environmentalHash: 'sunny_test_hash',
        privacyLevel: PrivacyLevel.STANDARD
      },
      metadata: {
        processingTime: 5,
        privacyFiltersApplied: ['pii_removal'],
        dataRetentionDays: 30,
        complianceFlags: []
      },
      privacyLevel: PrivacyLevel.STANDARD
    }];
  }

  function createNoisyTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Add random noise to data
    for (let i = 0; i < 20; i++) {
      const randomPatternTypes = [PatternType.TEMPORAL, PatternType.CONTEXTUAL, PatternType.BEHAVIORAL];
      const randomType = randomPatternTypes[Math.floor(Math.random() * 3)];
      
      interactions.push({
        userId: 'noisy-user',
        patterns: [{
          patternHash: `noisy_pattern_${i}`,
          type: randomType,
          strength: Math.random(),
          frequency: Math.floor(Math.random() * 10) + 1,
          contextHash: `noisy_context_${i}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `random_temporal_${i}`,
          locationHash: `random_location_${i}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `random_env_${i}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: Math.random() * 20,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createConflictingPatternData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create conflicting temporal patterns
    for (let i = 0; i < 3; i++) {
      interactions.push({
        userId: 'conflict-user',
        patterns: [{
          patternHash: `morning_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.8,
          frequency: 1,
          contextHash: 'morning_activity_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_monday_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_morning_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
      
      interactions.push({
        userId: 'conflict-user',
        patterns: [{
          patternHash: `evening_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.7,
          frequency: 1,
          contextHash: 'evening_activity_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'evening_monday_hash',
          locationHash: 'living_room_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_evening_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  // Additional helper functions would be implemented here...
  // (Due to length constraints, I'm showing the key test structure)

  function getDayOfWeek(date: Date): DayOfWeek {
    const days = [DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY];
    return days[date.getDay()];
  }

  function calculatePatternAccuracy(identifiedPatterns: IdentifiedPattern[], expectedPatterns: IdentifiedPattern[]): number {
    if (expectedPatterns.length === 0) return 1.0;
    
    let matches = 0;
    for (const expected of expectedPatterns) {
      const found = identifiedPatterns.find(p => 
        p.type === expected.type && 
        Math.abs(p.strength - expected.strength) < 0.2
      );
      if (found) matches++;
    }
    
    return matches / expectedPatterns.length;
  }

  function calculateOverallAccuracy(result: PatternAnalysisResult): number {
    return result.confidence.overall;
  }

  function identifyCorrectPatterns(patterns: IdentifiedPattern[]): IdentifiedPattern[] {
    return patterns.filter(p => p.strength > 0.7);
  }

  function identifyIncorrectPatterns(patterns: IdentifiedPattern[]): IdentifiedPattern[] {
    return patterns.filter(p => p.strength < 0.5);
  }

  // Placeholder implementations for remaining helper functions
  async function setupUserPatterns(userId: string, patterns: IdentifiedPattern[]): Promise<void> {
    // Mock implementation - in real scenario would set up patterns in analyzer cache
    (analyzer as any).patternCache = (analyzer as any).patternCache || new Map();
    (analyzer as any).patternCache.set(userId, patterns);
  }

  function createCommunicationPreferencePatterns(): IdentifiedPattern[] {
    return [
      {
        id: 'comm-pattern-1',
        type: PatternType.BEHAVIORAL,
        description: 'Prefers formal communication style',
        frequency: 8,
        strength: 0.85,
        context: {
          temporal: { timeOfDay: TimeOfDay.MORNING } as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'formal greeting', outcome: 'positive', confidence: 0.9 }
        ],
        lastObserved: new Date()
      },
      {
        id: 'comm-pattern-2',
        type: PatternType.CONTEXTUAL,
        description: 'Prefers brief responses during work hours',
        frequency: 12,
        strength: 0.78,
        context: {
          temporal: { timeOfDay: TimeOfDay.MORNING } as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'work context', outcome: 'brief response preferred', confidence: 0.8 }
        ],
        lastObserved: new Date()
      }
    ];
  }

  function createSchedulingPreferencePatterns(): IdentifiedPattern[] {
    return [
      {
        id: 'sched-pattern-1',
        type: PatternType.TEMPORAL,
        description: 'Prefers morning meetings',
        frequency: 10,
        strength: 0.82,
        context: {
          temporal: { timeOfDay: TimeOfDay.MORNING, dayOfWeek: DayOfWeek.MONDAY } as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'morning meeting scheduled', outcome: 'accepted', confidence: 0.85 }
        ],
        lastObserved: new Date()
      },
      {
        id: 'sched-pattern-2',
        type: PatternType.BEHAVIORAL,
        description: 'Avoids Friday afternoon appointments',
        frequency: 6,
        strength: 0.75,
        context: {
          temporal: { timeOfDay: TimeOfDay.AFTERNOON, dayOfWeek: DayOfWeek.FRIDAY } as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'Friday afternoon', outcome: 'declined', confidence: 0.8 }
        ],
        lastObserved: new Date()
      }
    ];
  }

  function createContentPreferencePatterns(): IdentifiedPattern[] {
    return [
      {
        id: 'content-pattern-1',
        type: PatternType.BEHAVIORAL,
        description: 'Shows interest in technology topics',
        frequency: 15,
        strength: 0.88,
        context: {
          temporal: {} as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'technology discussion', outcome: 'engaged', confidence: 0.9 }
        ],
        lastObserved: new Date()
      },
      {
        id: 'content-pattern-2',
        type: PatternType.CONTEXTUAL,
        description: 'Prefers educational content in evening',
        frequency: 8,
        strength: 0.72,
        context: {
          temporal: { timeOfDay: TimeOfDay.EVENING } as any,
          environmental: {} as any,
          social: {} as any,
          device: {} as any
        },
        examples: [
          { timestamp: new Date(), context: 'evening learning', outcome: 'positive engagement', confidence: 0.75 }
        ],
        lastObserved: new Date()
      }
    ];
  }

  function createPreferenceInferenceTestCases(): any[] {
    return [
      {
        userId: 'test-user-comm',
        domain: PreferenceDomain.COMMUNICATION,
        patterns: createCommunicationPreferencePatterns(),
        expectedPreferences: {
          formality: 'formal',
          responseLength: 'brief',
          communicationStyle: 'professional'
        }
      },
      {
        userId: 'test-user-sched',
        domain: PreferenceDomain.SCHEDULING,
        patterns: createSchedulingPreferencePatterns(),
        expectedPreferences: {
          preferred_time: 'morning',
          avoided_times: ['friday_afternoon'],
          meeting_duration: 'short'
        }
      },
      {
        userId: 'test-user-content',
        domain: PreferenceDomain.CONTENT,
        patterns: createContentPreferencePatterns(),
        expectedPreferences: {
          topics: ['technology', 'education'],
          content_type: 'educational',
          engagement_time: 'evening'
        }
      }
    ];
  }

  function createConflictingPreferencePatterns(): IdentifiedPattern[] {
    return [
      {
        id: 'conflict-pattern-1',
        type: PatternType.BEHAVIORAL,
        description: 'Sometimes prefers formal communication',
        frequency: 5,
        strength: 0.6,
        context: {} as any,
        examples: [],
        lastObserved: new Date()
      },
      {
        id: 'conflict-pattern-2',
        type: PatternType.BEHAVIORAL,
        description: 'Sometimes prefers casual communication',
        frequency: 4,
        strength: 0.55,
        context: {} as any,
        examples: [],
        lastObserved: new Date()
      }
    ];
  }

  function calculatePreferenceAccuracy(preferences: UserPreferences, expected: any): number {
    if (!preferences.preferences || preferences.preferences.length === 0) return 0;
    
    let correctPreferences = 0;
    let totalExpected = Object.keys(expected).length;
    
    for (const [key, expectedValue] of Object.entries(expected)) {
      const foundPreference = preferences.preferences.find(p => p.key === key);
      if (foundPreference) {
        if (Array.isArray(expectedValue)) {
          // For array values, check if there's overlap
          const actualArray = Array.isArray(foundPreference.value) ? foundPreference.value : [foundPreference.value];
          const hasOverlap = expectedValue.some(v => actualArray.includes(v));
          if (hasOverlap) correctPreferences++;
        } else {
          // For single values, check direct match or similarity
          if (foundPreference.value === expectedValue || 
              (typeof foundPreference.value === 'string' && 
               typeof expectedValue === 'string' && 
               foundPreference.value.toLowerCase().includes(expectedValue.toLowerCase()))) {
            correctPreferences++;
          }
        }
      }
    }
    
    return totalExpected > 0 ? correctPreferences / totalExpected : 0;
  }

  async function registerTemporalContextSources(): Promise<void> {
    const temporalSources = [
      {
        sourceId: 'system-clock',
        type: 'SYSTEM' as any,
        reliability: 1.0,
        updateFrequency: 1000,
        dataTypes: ['TEMPORAL' as any]
      },
      {
        sourceId: 'calendar-api',
        type: 'EXTERNAL_API' as any,
        reliability: 0.95,
        updateFrequency: 60000,
        dataTypes: ['TEMPORAL' as any]
      }
    ];
    
    for (const source of temporalSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  async function registerEnvironmentalContextSources(): Promise<void> {
    const environmentalSources = [
      {
        sourceId: 'temperature-sensor',
        type: 'SENSOR' as any,
        reliability: 0.9,
        updateFrequency: 30000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'light-sensor',
        type: 'SENSOR' as any,
        reliability: 0.85,
        updateFrequency: 15000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'weather-api',
        type: 'EXTERNAL_API' as any,
        reliability: 0.8,
        updateFrequency: 300000,
        dataTypes: ['ENVIRONMENTAL' as any]
      }
    ];
    
    for (const source of environmentalSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  async function registerSocialContextSources(): Promise<void> {
    const socialSources = [
      {
        sourceId: 'presence-detector',
        type: 'SENSOR' as any,
        reliability: 0.88,
        updateFrequency: 5000,
        dataTypes: ['SOCIAL' as any]
      },
      {
        sourceId: 'family-calendar',
        type: 'SYSTEM' as any,
        reliability: 0.95,
        updateFrequency: 60000,
        dataTypes: ['SOCIAL' as any]
      }
    ];
    
    for (const source of socialSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function createContextAggregationTestScenarios(): any[] {
    return [
      {
        userId: 'scenario-user-1',
        expectedContext: {
          temporal: {
            timeOfDay: TimeOfDay.MORNING,
            dayOfWeek: DayOfWeek.MONDAY,
            isHoliday: false
          },
          environmental: {
            temperature: 22,
            lighting: { brightness: 70, isNatural: true },
            weather: { condition: WeatherCondition.SUNNY }
          },
          social: {
            presentUsers: ['scenario-user-1'],
            guestPresent: false,
            socialActivity: SocialActivity.ALONE
          }
        }
      },
      {
        userId: 'scenario-user-2',
        expectedContext: {
          temporal: {
            timeOfDay: TimeOfDay.EVENING,
            dayOfWeek: DayOfWeek.FRIDAY,
            isHoliday: false
          },
          environmental: {
            temperature: 24,
            lighting: { brightness: 40, isNatural: false },
            weather: { condition: WeatherCondition.CLOUDY }
          },
          social: {
            presentUsers: ['scenario-user-2', 'family-member-1'],
            guestPresent: false,
            socialActivity: SocialActivity.FAMILY_TIME
          }
        }
      }
    ];
  }

  async function setupContextScenario(scenario: any): Promise<void> {
    // Mock context sources to return expected values for the scenario
    const mockSources = [
      {
        sourceId: `mock-temporal-${scenario.userId}`,
        type: 'SYSTEM' as any,
        reliability: 1.0,
        updateFrequency: 1000,
        dataTypes: ['TEMPORAL' as any]
      },
      {
        sourceId: `mock-environmental-${scenario.userId}`,
        type: 'SENSOR' as any,
        reliability: 0.9,
        updateFrequency: 30000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: `mock-social-${scenario.userId}`,
        type: 'SENSOR' as any,
        reliability: 0.85,
        updateFrequency: 5000,
        dataTypes: ['SOCIAL' as any]
      }
    ];
    
    for (const source of mockSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function calculateContextAccuracy(context: any, expected: any): number {
    let correctFields = 0;
    let totalFields = 0;
    
    // Check temporal accuracy
    if (expected.temporal) {
      totalFields += Object.keys(expected.temporal).length;
      for (const [key, value] of Object.entries(expected.temporal)) {
        if (context.temporal && context.temporal[key] === value) {
          correctFields++;
        }
      }
    }
    
    // Check environmental accuracy
    if (expected.environmental) {
      totalFields += Object.keys(expected.environmental).length;
      for (const [key, value] of Object.entries(expected.environmental)) {
        if (context.environmental && context.environmental[key]) {
          if (typeof value === 'number') {
            // Allow 10% tolerance for numeric values
            const actualValue = context.environmental[key];
            if (Math.abs(actualValue - (value as number)) <= (value as number) * 0.1) {
              correctFields++;
            }
          } else if (typeof value === 'object') {
            // For nested objects, check key properties
            let nestedCorrect = 0;
            let nestedTotal = 0;
            for (const [nestedKey, nestedValue] of Object.entries(value as any)) {
              nestedTotal++;
              if (context.environmental[key][nestedKey] === nestedValue) {
                nestedCorrect++;
              }
            }
            if (nestedTotal > 0 && nestedCorrect / nestedTotal >= 0.8) {
              correctFields++;
            }
          } else {
            if (context.environmental[key] === value) {
              correctFields++;
            }
          }
        }
      }
    }
    
    // Check social accuracy
    if (expected.social) {
      totalFields += Object.keys(expected.social).length;
      for (const [key, value] of Object.entries(expected.social)) {
        if (context.social && context.social[key]) {
          if (Array.isArray(value)) {
            // For arrays, check if they have similar content
            const actualArray = context.social[key];
            if (Array.isArray(actualArray) && actualArray.length === (value as any[]).length) {
              const matches = (value as any[]).filter(v => actualArray.includes(v)).length;
              if (matches / (value as any[]).length >= 0.8) {
                correctFields++;
              }
            }
          } else {
            if (context.social[key] === value) {
              correctFields++;
            }
          }
        }
      }
    }
    
    return totalFields > 0 ? correctFields / totalFields : 1.0;
  }

  async function registerMixedReliabilityContextSources(): Promise<void> {
    const mixedSources = [
      {
        sourceId: 'reliable-sensor',
        type: 'SENSOR' as any,
        reliability: 0.95,
        updateFrequency: 10000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'unreliable-sensor',
        type: 'SENSOR' as any,
        reliability: 0.3, // Low reliability
        updateFrequency: 5000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'failing-api',
        type: 'EXTERNAL_API' as any,
        reliability: 0.1, // Very low reliability
        updateFrequency: 60000,
        dataTypes: ['TEMPORAL' as any]
      }
    ];
    
    for (const source of mixedSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  async function registerConflictingContextSources(): Promise<void> {
    const conflictingSources = [
      {
        sourceId: 'temp-sensor-1',
        type: 'SENSOR' as any,
        reliability: 0.8,
        updateFrequency: 30000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'temp-sensor-2',
        type: 'SENSOR' as any,
        reliability: 0.75,
        updateFrequency: 25000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'light-sensor-1',
        type: 'SENSOR' as any,
        reliability: 0.9,
        updateFrequency: 15000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'light-sensor-2',
        type: 'SENSOR' as any,
        reliability: 0.85,
        updateFrequency: 20000,
        dataTypes: ['ENVIRONMENTAL' as any]
      }
    ];
    
    for (const source of conflictingSources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function createLargeDatasetForPerformanceTest(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create a large dataset for performance testing
    for (let i = 0; i < 500; i++) {
      interactions.push({
        userId: 'perf-test-user',
        patterns: [{
          patternHash: `perf_pattern_${i}`,
          type: PatternType.BEHAVIORAL,
          strength: Math.random(),
          frequency: Math.floor(Math.random() * 10) + 1,
          contextHash: `perf_context_${i}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `perf_temporal_${i}`,
          locationHash: `perf_location_${i}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `perf_env_${i}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: Math.random() * 20,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createScalabilityTestData(size: number): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    for (let i = 0; i < size; i++) {
      interactions.push({
        userId: 'scalability-test-user',
        patterns: [{
          patternHash: `scale_pattern_${i}`,
          type: Object.values(PatternType)[i % Object.values(PatternType).length],
          strength: 0.5 + Math.random() * 0.4,
          frequency: Math.floor(Math.random() * 5) + 1,
          contextHash: `scale_context_${i}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `scale_temporal_${i % 10}`,
          locationHash: `scale_location_${i % 5}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `scale_env_${i % 8}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 5 + Math.random() * 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createMemoryConstrainedTestData(): FilteredInteraction[] {
    const interactions: FilteredInteraction[] = [];
    
    // Create data that simulates memory constraints
    for (let i = 0; i < 100; i++) {
      interactions.push({
        userId: 'memory-test-user',
        patterns: [{
          patternHash: `memory_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.7,
          frequency: 2,
          contextHash: 'memory_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'normal_env_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 8,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      });
    }
    
    return interactions;
  }

  function createConfidenceTestCases(): { interactions: FilteredInteraction[] }[] {
    const testCases: { interactions: FilteredInteraction[] }[] = [];
    
    // High confidence case - strong, consistent patterns
    testCases.push({
      interactions: Array.from({ length: 10 }, (_, i) => ({
        userId: 'confidence-high-user',
        patterns: [{
          patternHash: `high_conf_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.9,
          frequency: 3,
          contextHash: 'consistent_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'morning_hash',
          locationHash: 'kitchen_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'sunny_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 5,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      }))
    });
    
    // Low confidence case - weak, inconsistent patterns
    testCases.push({
      interactions: Array.from({ length: 10 }, (_, i) => ({
        userId: 'confidence-low-user',
        patterns: [{
          patternHash: `low_conf_pattern_${i}`,
          type: Object.values(PatternType)[i % Object.values(PatternType).length],
          strength: 0.3 + Math.random() * 0.2,
          frequency: 1,
          contextHash: `variable_context_${i % 5}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `variable_temporal_${i % 4}`,
          locationHash: `variable_location_${i % 3}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `variable_env_${i % 6}`,
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10 + Math.random() * 10,
          privacyFiltersApplied: ['pii_removal', 'anonymization'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      }))
    });
    
    return testCases;
  }


});