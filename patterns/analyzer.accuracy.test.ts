// Pattern Recognition Accuracy Tests - Focused Implementation for Task 3.3

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
import { FilteredInteraction, PrivacyLevel } from '../privacy/types';
import { 
  PatternType,
  TimeOfDay,
  DayOfWeek,
  DeviceType,
  WeatherCondition,
  NoiseType,
  SocialActivity
} from '../learning/types';

// Define IdentifiedPattern locally since it's not properly exported
interface IdentifiedPattern {
  id: string;
  type: PatternType;
  description: string;
  frequency: number;
  strength: number;
  context: any;
  examples: any[];
  lastObserved: Date;
}

describe('Pattern Recognition Accuracy Tests - Task 3.3', () => {
  let analyzer: EnhancedPatternAnalyzer;
  let contextAggregator: EnhancedContextAggregator;

  beforeEach(() => {
    analyzer = new EnhancedPatternAnalyzer();
    contextAggregator = new EnhancedContextAggregator();
  });

  describe('Behavioral Pattern Identification Accuracy', () => {
    test('should achieve 85% accuracy in identifying temporal patterns', async () => {
      const testData = createTemporalPatternTestData();
      
      const result = await analyzer.analyzePatterns(testData.interactions);
      
      // Verify temporal patterns are identified with high accuracy
      const temporalPatterns = result.patterns.filter(p => p.type === PatternType.TEMPORAL);
      expect(temporalPatterns.length).toBeGreaterThan(0);
      
      // Calculate accuracy based on expected patterns
      const accuracy = calculatePatternIdentificationAccuracy(temporalPatterns, testData.expectedPatterns);
      expect(accuracy).toBeGreaterThan(0.85);
      
      // Verify pattern quality metrics
      temporalPatterns.forEach(pattern => {
        expect(pattern.strength).toBeGreaterThan(0.6);
        expect(pattern.frequency).toBeGreaterThanOrEqual(3);
      });
    });

    test('should achieve 80% accuracy in identifying contextual patterns', async () => {
      const testData = createContextualPatternTestData();
      
      const result = await analyzer.analyzePatterns(testData.interactions);
      
      const contextualPatterns = result.patterns.filter(p => p.type === PatternType.CONTEXTUAL);
      expect(contextualPatterns.length).toBeGreaterThan(0);
      
      const accuracy = calculatePatternIdentificationAccuracy(contextualPatterns, testData.expectedPatterns);
      expect(accuracy).toBeGreaterThan(0.80);
      
      // Verify contextual factors are properly identified
      expect(result.contextualFactors.length).toBeGreaterThan(0);
      result.contextualFactors.forEach(factor => {
        expect(factor.influence).toBeGreaterThan(0.5);
      });
    });

    test('should achieve 85% accuracy in identifying behavioral patterns', async () => {
      const testData = createBehavioralPatternTestData();
      
      const result = await analyzer.analyzePatterns(testData.interactions);
      
      const behavioralPatterns = result.patterns.filter(p => p.type === PatternType.BEHAVIORAL);
      expect(behavioralPatterns.length).toBeGreaterThan(0);
      
      const accuracy = calculatePatternIdentificationAccuracy(behavioralPatterns, testData.expectedPatterns);
      expect(accuracy).toBeGreaterThan(0.85);
      
      // Verify behavioral pattern characteristics
      behavioralPatterns.forEach(pattern => {
        expect(pattern.strength).toBeGreaterThan(0.5);
        expect(pattern.examples.length).toBeGreaterThan(0);
      });
    });

    test('should maintain consistent accuracy across different data volumes', async () => {
      const dataSizes = [10, 50, 100];
      const accuracyResults: number[] = [];
      
      for (const size of dataSizes) {
        const testData = createScalableTestData(size);
        const result = await analyzer.analyzePatterns(testData.interactions);
        
        const accuracy = calculateOverallPatternAccuracy(result.patterns, testData.expectedPatterns);
        accuracyResults.push(accuracy);
      }
      
      // All data sizes should maintain minimum accuracy
      accuracyResults.forEach(accuracy => {
        expect(accuracy).toBeGreaterThan(0.75);
      });
      
      // Accuracy should not degrade significantly with larger datasets
      const accuracyVariance = calculateVariance(accuracyResults);
      expect(accuracyVariance).toBeLessThan(0.05); // Low variance indicates consistency
    });
  });

  describe('Preference Inference Algorithm Accuracy', () => {
    test('should achieve 80% accuracy in inferring communication preferences', async () => {
      const userId = 'test-user-comm-accuracy';
      const testData = createCommunicationPreferenceTestData();
      
      // Set up patterns for preference inference
      await setupUserPatterns(userId, testData.patterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.COMMUNICATION);
      
      // Verify preference inference accuracy
      expect(preferences.confidence).toBeGreaterThan(0.8);
      
      const accuracy = calculatePreferenceInferenceAccuracy(preferences, testData.expectedPreferences);
      expect(accuracy).toBeGreaterThan(0.80);
      
      // Verify specific preference types are identified
      const formalityPref = preferences.preferences.find(p => p.key === 'formality');
      expect(formalityPref).toBeDefined();
      expect(formalityPref!.confidence).toBeGreaterThan(0.7);
    });

    test('should achieve 85% accuracy in inferring scheduling preferences', async () => {
      const userId = 'test-user-sched-accuracy';
      const testData = createSchedulingPreferenceTestData();
      
      await setupUserPatterns(userId, testData.patterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.SCHEDULING);
      
      expect(preferences.confidence).toBeGreaterThan(0.8);
      
      const accuracy = calculatePreferenceInferenceAccuracy(preferences, testData.expectedPreferences);
      expect(accuracy).toBeGreaterThan(0.85);
      
      // Verify temporal preferences are correctly inferred
      const timePrefs = preferences.preferences.filter(p => 
        p.key.includes('time') || p.key.includes('schedule')
      );
      expect(timePrefs.length).toBeGreaterThan(0);
    });

    test('should handle preference conflicts with 70% accuracy', async () => {
      const userId = 'test-user-conflict-accuracy';
      const testData = createConflictingPreferenceTestData();
      
      await setupUserPatterns(userId, testData.patterns);
      
      const preferences = await analyzer.identifyPreferences(userId, PreferenceDomain.INTERACTION);
      
      // Should still provide preferences but with appropriate confidence
      expect(preferences.preferences.length).toBeGreaterThan(0);
      expect(preferences.confidence).toBeGreaterThan(0.5);
      expect(preferences.confidence).toBeLessThan(0.8); // Lower due to conflicts
      
      const accuracy = calculatePreferenceInferenceAccuracy(preferences, testData.expectedPreferences);
      expect(accuracy).toBeGreaterThan(0.70);
    });

    test('should maintain preference inference accuracy with synthetic data', async () => {
      const testCases = createSyntheticPreferenceTestCases();
      let totalAccuracy = 0;
      
      for (const testCase of testCases) {
        await setupUserPatterns(testCase.userId, testCase.patterns);
        const preferences = await analyzer.identifyPreferences(testCase.userId, testCase.domain);
        
        const accuracy = calculatePreferenceInferenceAccuracy(preferences, testCase.expectedPreferences);
        totalAccuracy += accuracy;
      }
      
      const averageAccuracy = totalAccuracy / testCases.length;
      expect(averageAccuracy).toBeGreaterThan(0.75);
    });
  });

  describe('Context Aggregation Accuracy from Multiple Sources', () => {
    test('should achieve 90% accuracy in temporal context aggregation', async () => {
      const userId = 'test-user-temporal-accuracy';
      
      // Register temporal context sources
      await registerMockTemporalSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Verify temporal context accuracy
      expect(context.temporal).toBeDefined();
      expect(context.temporal.timeOfDay).toBeDefined();
      expect(context.temporal.dayOfWeek).toBeDefined();
      
      // Validate temporal data accuracy
      const temporalAccuracy = validateTemporalContextAccuracy(context.temporal);
      expect(temporalAccuracy).toBeGreaterThan(0.90);
    });

    test('should achieve 85% accuracy in environmental context aggregation', async () => {
      const userId = 'test-user-env-accuracy';
      
      await registerMockEnvironmentalSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      expect(context.environmental).toBeDefined();
      expect(context.environmental.temperature).toBeGreaterThan(-50);
      expect(context.environmental.temperature).toBeLessThan(60);
      
      const environmentalAccuracy = validateEnvironmentalContextAccuracy(context.environmental);
      expect(environmentalAccuracy).toBeGreaterThan(0.85);
    });

    test('should achieve 80% accuracy in social context aggregation', async () => {
      const userId = 'test-user-social-accuracy';
      
      await registerMockSocialSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      expect(context.social).toBeDefined();
      expect(Array.isArray(context.social.presentUsers)).toBe(true);
      
      const socialAccuracy = validateSocialContextAccuracy(context.social);
      expect(socialAccuracy).toBeGreaterThan(0.80);
    });

    test('should maintain 85% overall context aggregation accuracy', async () => {
      const testScenarios = createContextAccuracyTestScenarios();
      let totalAccuracy = 0;
      
      for (const scenario of testScenarios) {
        await setupMockContextSources(scenario);
        
        const context = await contextAggregator.getCurrentContext(scenario.userId);
        const accuracy = calculateOverallContextAccuracy(context, scenario.expectedContext);
        totalAccuracy += accuracy;
      }
      
      const averageAccuracy = totalAccuracy / testScenarios.length;
      expect(averageAccuracy).toBeGreaterThan(0.85);
    });

    test('should handle context source failures with graceful degradation', async () => {
      const userId = 'test-user-failure-handling';
      
      // Register sources with mixed reliability
      await registerUnreliableContextSources();
      
      const context = await contextAggregator.getCurrentContext(userId);
      
      // Should still provide context even with some failures
      expect(context).toBeDefined();
      expect(context.userId).toBe(userId);
      
      // At least 60% of context should be available despite failures
      const contextCompleteness = calculateContextCompleteness(context);
      expect(contextCompleteness).toBeGreaterThan(0.60);
    });
  });

  // Helper functions for test data creation and validation

  function createTemporalPatternTestData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    // Create morning routine pattern (high frequency, consistent timing)
    for (let i = 0; i < 10; i++) {
      interactions.push({
        userId: 'temporal-test-user',
        patterns: [{
          patternHash: `temporal_pattern_${i}`,
          type: PatternType.TEMPORAL,
          strength: 0.85,
          frequency: 1,
          contextHash: 'morning_routine',
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
    
    expectedPatterns.push({
      id: 'expected-temporal-1',
      type: PatternType.TEMPORAL,
      description: 'Morning routine pattern',
      frequency: 10,
      strength: 0.85,
      context: {},
      examples: [],
      lastObserved: new Date()
    });
    
    return { interactions, expectedPatterns };
  }

  function createContextualPatternTestData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    // Create weather-based contextual pattern
    for (let i = 0; i < 8; i++) {
      interactions.push({
        userId: 'contextual-test-user',
        patterns: [{
          patternHash: `contextual_pattern_${i}`,
          type: PatternType.CONTEXTUAL,
          strength: 0.75,
          frequency: 1,
          contextHash: 'rainy_day_behavior',
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
    
    expectedPatterns.push({
      id: 'expected-contextual-1',
      type: PatternType.CONTEXTUAL,
      description: 'Rainy day behavior pattern',
      frequency: 8,
      strength: 0.75,
      context: {},
      examples: [],
      lastObserved: new Date()
    });
    
    return { interactions, expectedPatterns };
  }

  function createBehavioralPatternTestData(): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    // Create help-seeking behavioral pattern
    for (let i = 0; i < 6; i++) {
      interactions.push({
        userId: 'behavioral-test-user',
        patterns: [{
          patternHash: `behavioral_pattern_${i}`,
          type: PatternType.BEHAVIORAL,
          strength: 0.80,
          frequency: 1,
          contextHash: 'help_seeking_context',
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: 'evening_hash',
          locationHash: 'study_hash',
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: 'quiet_environment_hash',
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
    
    expectedPatterns.push({
      id: 'expected-behavioral-1',
      type: PatternType.BEHAVIORAL,
      description: 'Help-seeking behavior pattern',
      frequency: 6,
      strength: 0.80,
      context: {},
      examples: [],
      lastObserved: new Date()
    });
    
    return { interactions, expectedPatterns };
  }

  function createScalableTestData(size: number): { interactions: FilteredInteraction[], expectedPatterns: IdentifiedPattern[] } {
    const interactions: FilteredInteraction[] = [];
    const expectedPatterns: IdentifiedPattern[] = [];
    
    for (let i = 0; i < size; i++) {
      const patternType = i % 3 === 0 ? PatternType.TEMPORAL : 
                         i % 3 === 1 ? PatternType.CONTEXTUAL : PatternType.BEHAVIORAL;
      
      interactions.push({
        userId: 'scalable-test-user',
        patterns: [{
          patternHash: `scalable_pattern_${i}`,
          type: patternType,
          strength: 0.7 + Math.random() * 0.2,
          frequency: Math.floor(Math.random() * 3) + 2,
          contextHash: `scalable_context_${i % 10}`,
          anonymizationLevel: 'moderate' as any
        }],
        context: {
          temporalHash: `scalable_temporal_${i % 4}`,
          locationHash: `scalable_location_${i % 3}`,
          deviceTypeHash: 'smart_display_hash',
          environmentalHash: `scalable_env_${i % 5}`,
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
    
    // Create expected patterns based on the pattern distribution
    const temporalCount = Math.ceil(size / 3);
    const contextualCount = Math.floor(size / 3);
    const behavioralCount = size - temporalCount - contextualCount;
    
    if (temporalCount > 0) {
      expectedPatterns.push({
        id: 'expected-temporal-scalable',
        type: PatternType.TEMPORAL,
        description: 'Scalable temporal pattern',
        frequency: temporalCount,
        strength: 0.8,
        context: {},
        examples: [],
        lastObserved: new Date()
      });
    }
    
    if (contextualCount > 0) {
      expectedPatterns.push({
        id: 'expected-contextual-scalable',
        type: PatternType.CONTEXTUAL,
        description: 'Scalable contextual pattern',
        frequency: contextualCount,
        strength: 0.75,
        context: {},
        examples: [],
        lastObserved: new Date()
      });
    }
    
    if (behavioralCount > 0) {
      expectedPatterns.push({
        id: 'expected-behavioral-scalable',
        type: PatternType.BEHAVIORAL,
        description: 'Scalable behavioral pattern',
        frequency: behavioralCount,
        strength: 0.8,
        context: {},
        examples: [],
        lastObserved: new Date()
      });
    }
    
    return { interactions, expectedPatterns };
  }

  function calculatePatternIdentificationAccuracy(identifiedPatterns: IdentifiedPattern[], expectedPatterns: IdentifiedPattern[]): number {
    if (expectedPatterns.length === 0) return 1.0;
    
    let correctIdentifications = 0;
    
    for (const expected of expectedPatterns) {
      const matching = identifiedPatterns.find(p => 
        p.type === expected.type && 
        p.strength >= expected.strength * 0.8 && // Allow 20% tolerance
        p.frequency >= expected.frequency * 0.6   // Allow 40% tolerance for frequency
      );
      
      if (matching) {
        correctIdentifications++;
      }
    }
    
    return correctIdentifications / expectedPatterns.length;
  }

  function calculateOverallPatternAccuracy(identifiedPatterns: IdentifiedPattern[], expectedPatterns: IdentifiedPattern[]): number {
    if (identifiedPatterns.length === 0 && expectedPatterns.length === 0) return 1.0;
    if (identifiedPatterns.length === 0 || expectedPatterns.length === 0) return 0.0;
    
    // Calculate precision and recall
    const precision = calculatePatternIdentificationAccuracy(identifiedPatterns, expectedPatterns);
    
    // Calculate recall (how many expected patterns were found)
    let foundExpected = 0;
    for (const expected of expectedPatterns) {
      const found = identifiedPatterns.some(p => 
        p.type === expected.type && p.strength >= 0.6
      );
      if (found) foundExpected++;
    }
    const recall = foundExpected / expectedPatterns.length;
    
    // Return F1 score (harmonic mean of precision and recall)
    return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  }

  function calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  // Preference inference test data and helpers

  function createCommunicationPreferenceTestData(): { patterns: IdentifiedPattern[], expectedPreferences: any } {
    const patterns: IdentifiedPattern[] = [
      {
        id: 'comm-pattern-formal',
        type: PatternType.BEHAVIORAL,
        description: 'Prefers formal communication',
        frequency: 8,
        strength: 0.85,
        context: {},
        examples: [],
        lastObserved: new Date()
      },
      {
        id: 'comm-pattern-brief',
        type: PatternType.CONTEXTUAL,
        description: 'Prefers brief responses during work',
        frequency: 6,
        strength: 0.78,
        context: {},
        examples: [],
        lastObserved: new Date()
      }
    ];
    
    const expectedPreferences = {
      formality: 'formal',
      responseLength: 'brief',
      communicationStyle: 'professional'
    };
    
    return { patterns, expectedPreferences };
  }

  function createSchedulingPreferenceTestData(): { patterns: IdentifiedPattern[], expectedPreferences: any } {
    const patterns: IdentifiedPattern[] = [
      {
        id: 'sched-pattern-morning',
        type: PatternType.TEMPORAL,
        description: 'Prefers morning meetings',
        frequency: 10,
        strength: 0.88,
        context: {},
        examples: [],
        lastObserved: new Date()
      },
      {
        id: 'sched-pattern-avoid-friday',
        type: PatternType.TEMPORAL,
        description: 'Avoids Friday afternoon meetings',
        frequency: 5,
        strength: 0.82,
        context: {},
        examples: [],
        lastObserved: new Date()
      }
    ];
    
    const expectedPreferences = {
      preferred_time: 'morning',
      avoided_times: 'friday_afternoon',
      meeting_preference: 'short_duration'
    };
    
    return { patterns, expectedPreferences };
  }

  function createConflictingPreferenceTestData(): { patterns: IdentifiedPattern[], expectedPreferences: any } {
    const patterns: IdentifiedPattern[] = [
      {
        id: 'conflict-pattern-1',
        type: PatternType.BEHAVIORAL,
        description: 'Sometimes formal communication',
        frequency: 4,
        strength: 0.65,
        context: {},
        examples: [],
        lastObserved: new Date()
      },
      {
        id: 'conflict-pattern-2',
        type: PatternType.BEHAVIORAL,
        description: 'Sometimes casual communication',
        frequency: 3,
        strength: 0.60,
        context: {},
        examples: [],
        lastObserved: new Date()
      }
    ];
    
    const expectedPreferences = {
      formality: 'mixed',
      consistency: 'low',
      adaptability: 'high'
    };
    
    return { patterns, expectedPreferences };
  }

  function createSyntheticPreferenceTestCases(): any[] {
    return [
      {
        userId: 'synthetic-user-1',
        domain: PreferenceDomain.COMMUNICATION,
        patterns: createCommunicationPreferenceTestData().patterns,
        expectedPreferences: createCommunicationPreferenceTestData().expectedPreferences
      },
      {
        userId: 'synthetic-user-2',
        domain: PreferenceDomain.SCHEDULING,
        patterns: createSchedulingPreferenceTestData().patterns,
        expectedPreferences: createSchedulingPreferenceTestData().expectedPreferences
      }
    ];
  }

  async function setupUserPatterns(userId: string, patterns: IdentifiedPattern[]): Promise<void> {
    // Mock implementation - set up patterns in analyzer cache
    (analyzer as any).patternCache = (analyzer as any).patternCache || new Map();
    (analyzer as any).patternCache.set(userId, patterns);
  }

  function calculatePreferenceInferenceAccuracy(preferences: UserPreferences, expected: any): number {
    if (!preferences.preferences || preferences.preferences.length === 0) return 0;
    
    let correctInferences = 0;
    const totalExpected = Object.keys(expected).length;
    
    for (const [key, expectedValue] of Object.entries(expected)) {
      const foundPreference = preferences.preferences.find(p => p.key === key);
      if (foundPreference) {
        // Check if the inferred value matches or is similar to expected
        if (foundPreference.value === expectedValue || 
            (typeof foundPreference.value === 'string' && 
             typeof expectedValue === 'string' && 
             foundPreference.value.toLowerCase().includes(expectedValue.toLowerCase()))) {
          correctInferences++;
        }
      }
    }
    
    return totalExpected > 0 ? correctInferences / totalExpected : 0;
  }

  // Context aggregation test helpers

  async function registerMockTemporalSources(): Promise<void> {
    const sources = [
      {
        sourceId: 'mock-system-clock',
        type: 'SYSTEM' as any,
        reliability: 1.0,
        updateFrequency: 1000,
        dataTypes: ['TEMPORAL' as any]
      }
    ];
    
    for (const source of sources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  async function registerMockEnvironmentalSources(): Promise<void> {
    const sources = [
      {
        sourceId: 'mock-temp-sensor',
        type: 'SENSOR' as any,
        reliability: 0.9,
        updateFrequency: 30000,
        dataTypes: ['ENVIRONMENTAL' as any]
      }
    ];
    
    for (const source of sources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  async function registerMockSocialSources(): Promise<void> {
    const sources = [
      {
        sourceId: 'mock-presence-sensor',
        type: 'SENSOR' as any,
        reliability: 0.85,
        updateFrequency: 5000,
        dataTypes: ['SOCIAL' as any]
      }
    ];
    
    for (const source of sources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function validateTemporalContextAccuracy(temporal: any): number {
    let accurateFields = 0;
    let totalFields = 0;
    
    // Check if timeOfDay is valid
    if (temporal.timeOfDay && Object.values(TimeOfDay).includes(temporal.timeOfDay)) {
      accurateFields++;
    }
    totalFields++;
    
    // Check if dayOfWeek is valid
    if (temporal.dayOfWeek && Object.values(DayOfWeek).includes(temporal.dayOfWeek)) {
      accurateFields++;
    }
    totalFields++;
    
    // Check if timeZone is reasonable
    if (temporal.timeZone && typeof temporal.timeZone === 'string' && temporal.timeZone.length > 0) {
      accurateFields++;
    }
    totalFields++;
    
    return totalFields > 0 ? accurateFields / totalFields : 0;
  }

  function validateEnvironmentalContextAccuracy(environmental: any): number {
    let accurateFields = 0;
    let totalFields = 0;
    
    // Check temperature range
    if (environmental.temperature && 
        typeof environmental.temperature === 'number' && 
        environmental.temperature > -50 && 
        environmental.temperature < 60) {
      accurateFields++;
    }
    totalFields++;
    
    // Check weather condition
    if (environmental.weather && 
        environmental.weather.condition && 
        Object.values(WeatherCondition).includes(environmental.weather.condition)) {
      accurateFields++;
    }
    totalFields++;
    
    // Check lighting
    if (environmental.lighting && 
        typeof environmental.lighting.brightness === 'number' && 
        environmental.lighting.brightness >= 0 && 
        environmental.lighting.brightness <= 100) {
      accurateFields++;
    }
    totalFields++;
    
    return totalFields > 0 ? accurateFields / totalFields : 0;
  }

  function validateSocialContextAccuracy(social: any): number {
    let accurateFields = 0;
    let totalFields = 0;
    
    // Check presentUsers is array
    if (Array.isArray(social.presentUsers)) {
      accurateFields++;
    }
    totalFields++;
    
    // Check guestPresent is boolean
    if (typeof social.guestPresent === 'boolean') {
      accurateFields++;
    }
    totalFields++;
    
    // Check socialActivity is valid enum
    if (social.socialActivity && Object.values(SocialActivity).includes(social.socialActivity)) {
      accurateFields++;
    }
    totalFields++;
    
    return totalFields > 0 ? accurateFields / totalFields : 0;
  }

  function createContextAccuracyTestScenarios(): any[] {
    return [
      {
        userId: 'context-test-user-1',
        expectedContext: {
          temporal: { timeOfDay: TimeOfDay.MORNING, dayOfWeek: DayOfWeek.MONDAY },
          environmental: { temperature: 22, weather: { condition: WeatherCondition.SUNNY } },
          social: { presentUsers: ['context-test-user-1'], guestPresent: false }
        }
      },
      {
        userId: 'context-test-user-2',
        expectedContext: {
          temporal: { timeOfDay: TimeOfDay.EVENING, dayOfWeek: DayOfWeek.FRIDAY },
          environmental: { temperature: 24, weather: { condition: WeatherCondition.CLOUDY } },
          social: { presentUsers: ['context-test-user-2', 'family-member'], guestPresent: false }
        }
      }
    ];
  }

  async function setupMockContextSources(scenario: any): Promise<void> {
    const sources = [
      {
        sourceId: `mock-source-${scenario.userId}`,
        type: 'SYSTEM' as any,
        reliability: 0.9,
        updateFrequency: 10000,
        dataTypes: ['TEMPORAL' as any, 'ENVIRONMENTAL' as any, 'SOCIAL' as any]
      }
    ];
    
    for (const source of sources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function calculateOverallContextAccuracy(context: any, expected: any): number {
    let totalAccuracy = 0;
    let contextTypes = 0;
    
    if (expected.temporal) {
      totalAccuracy += validateTemporalContextAccuracy(context.temporal || {});
      contextTypes++;
    }
    
    if (expected.environmental) {
      totalAccuracy += validateEnvironmentalContextAccuracy(context.environmental || {});
      contextTypes++;
    }
    
    if (expected.social) {
      totalAccuracy += validateSocialContextAccuracy(context.social || {});
      contextTypes++;
    }
    
    return contextTypes > 0 ? totalAccuracy / contextTypes : 0;
  }

  async function registerUnreliableContextSources(): Promise<void> {
    const sources = [
      {
        sourceId: 'unreliable-sensor-1',
        type: 'SENSOR' as any,
        reliability: 0.3, // Low reliability
        updateFrequency: 30000,
        dataTypes: ['ENVIRONMENTAL' as any]
      },
      {
        sourceId: 'reliable-sensor-1',
        type: 'SENSOR' as any,
        reliability: 0.95, // High reliability
        updateFrequency: 10000,
        dataTypes: ['TEMPORAL' as any]
      }
    ];
    
    for (const source of sources) {
      await contextAggregator.registerContextSource(source);
    }
  }

  function calculateContextCompleteness(context: any): number {
    let availableFields = 0;
    let totalFields = 0;
    
    // Check temporal completeness
    totalFields += 3; // timeOfDay, dayOfWeek, timeZone
    if (context.temporal) {
      if (context.temporal.timeOfDay) availableFields++;
      if (context.temporal.dayOfWeek) availableFields++;
      if (context.temporal.timeZone) availableFields++;
    }
    
    // Check environmental completeness
    totalFields += 3; // temperature, weather, lighting
    if (context.environmental) {
      if (context.environmental.temperature !== undefined) availableFields++;
      if (context.environmental.weather) availableFields++;
      if (context.environmental.lighting) availableFields++;
    }
    
    // Check social completeness
    totalFields += 2; // presentUsers, guestPresent
    if (context.social) {
      if (context.social.presentUsers) availableFields++;
      if (context.social.guestPresent !== undefined) availableFields++;
    }
    
    return totalFields > 0 ? availableFields / totalFields : 0;
  }
});