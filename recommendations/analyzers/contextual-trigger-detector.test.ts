/**
 * Unit tests for Contextual Trigger Detector
 * 
 * Tests contextual trigger identification, pattern recognition, and trigger validation
 * as specified in requirements 4.1, 4.2, 4.3, 4.4
 */

import { ContextualTriggerDetector } from './contextual-trigger-detector';
import {
  UserContext,
  ContextualTrigger,
  BehaviorPattern,
  TimeRange,
  LocationContext,
  ActivityContext,
  AvailabilityContext,
  MoodContext,
  EnergyLevel,
  SocialContext,
  EnvironmentalContext,
  ContextualPreferences,
  WeatherCondition
} from '../types';
import { RecommendationType } from '../enums';

describe('ContextualTriggerDetector', () => {
  let triggerDetector: ContextualTriggerDetector;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    triggerDetector = new ContextualTriggerDetector();
  });

  // Helper function to create a mock user context
  const createMockContext = (overrides: Partial<UserContext> = {}): UserContext => {
    const baseContext: UserContext = {
      userId: testUserId,
      timestamp: new Date('2024-01-15T10:00:00Z'),
      location: {
        type: 'home',
        indoorOutdoor: 'indoor'
      } as LocationContext,
      activity: {
        interruptible: true
      } as ActivityContext,
      availability: {
        freeTime: [{ start: new Date(), end: new Date() }],
        busyTime: [],
        flexibleTime: [],
        energyLevel: { level: 'medium', trend: 'stable' }
      } as AvailabilityContext,
      mood: {
        detected: 'happy',
        confidence: 0.7,
        source: 'inferred'
      } as MoodContext,
      energy: {
        level: 'medium',
        trend: 'stable'
      } as EnergyLevel,
      social: {
        familyMembersPresent: [],
        socialSetting: 'alone',
        groupActivity: false
      } as SocialContext,
      environmental: {
        weather: {
          temperature: 20,
          condition: 'cloudy',
          humidity: 60,
          windSpeed: 10,
          uvIndex: 3
        } as WeatherCondition,
        timeOfDay: 'morning',
        season: 'spring',
        dayOfWeek: 'Monday',
        isHoliday: false
      } as EnvironmentalContext,
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'medium',
          aloneTime: 'medium',
          groupActivities: 'acceptable'
        }
      } as ContextualPreferences
    };

    return { ...baseContext, ...overrides };
  };

  describe('Morning Routine Trigger Detection (Requirement 4.1)', () => {
    it('should detect morning routine trigger during optimal hours', async () => {
      // Arrange
      const morningContext = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'), // 8 AM
        location: { type: 'home', indoorOutdoor: 'indoor' } as LocationContext,
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, morningContext);

      // Assert
      const morningTrigger = triggers.find(t => t.triggerId === 'morning_routine');
      expect(morningTrigger).toBeDefined();
      expect(morningTrigger?.triggerType).toBe('time');
      expect(morningTrigger?.confidence).toBeGreaterThan(0.5);
      expect(morningTrigger?.recommendationTypes).toContain(RecommendationType.SCHEDULE);
      expect(morningTrigger?.priority).toBe('high');
    });

    it('should not detect morning routine trigger outside optimal hours', async () => {
      // Arrange
      const afternoonContext = createMockContext({
        timestamp: new Date('2024-01-15T15:00:00Z'), // 3 PM
        location: { type: 'home', indoorOutdoor: 'indoor' } as LocationContext,
        energy: { level: 'medium', trend: 'stable' } as EnergyLevel
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, afternoonContext);

      // Assert
      const morningTrigger = triggers.find(t => t.triggerId === 'morning_routine');
      expect(morningTrigger).toBeUndefined();
    });
  });

  describe('Family Bonding Trigger Detection (Requirement 4.2)', () => {
    it('should detect family bonding trigger when multiple family members are present', async () => {
      // Arrange
      const familyContext = createMockContext({
        timestamp: new Date('2024-01-15T18:30:00Z'), // 6:30 PM
        social: {
          familyMembersPresent: ['user1', 'user2', 'user3'],
          socialSetting: 'family',
          groupActivity: true
        } as SocialContext,
        activity: { interruptible: true } as ActivityContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, familyContext);

      // Assert
      const familyTrigger = triggers.find(t => t.triggerId === 'family_bonding');
      expect(familyTrigger).toBeDefined();
      expect(familyTrigger?.triggerType).toBe('social');
      expect(familyTrigger?.confidence).toBeGreaterThan(0.7);
      expect(familyTrigger?.recommendationTypes).toContain(RecommendationType.ACTIVITY);
      expect(familyTrigger?.priority).toBe('high');
    });

    it('should not detect family bonding trigger when alone', async () => {
      // Arrange
      const aloneContext = createMockContext({
        social: {
          familyMembersPresent: [],
          socialSetting: 'alone',
          groupActivity: false
        } as SocialContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, aloneContext);

      // Assert
      const familyTrigger = triggers.find(t => t.triggerId === 'family_bonding');
      expect(familyTrigger).toBeUndefined();
    });
  });

  describe('Learning Opportunity Trigger Detection (Requirement 4.3)', () => {
    it('should detect learning opportunity during free time with good energy', async () => {
      // Arrange
      const learningContext = createMockContext({
        timestamp: new Date('2024-01-15T14:00:00Z'), // 2 PM
        activity: { interruptible: true } as ActivityContext,
        availability: {
          freeTime: [{ start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }],
          busyTime: [],
          flexibleTime: [],
          energyLevel: { level: 'high', trend: 'stable' }
        } as AvailabilityContext,
        energy: { level: 'high', trend: 'stable' } as EnergyLevel
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, learningContext);

      // Assert
      const learningTrigger = triggers.find(t => t.triggerId === 'learning_opportunity');
      expect(learningTrigger).toBeDefined();
      expect(learningTrigger?.triggerType).toBe('activity');
      expect(learningTrigger?.recommendationTypes).toContain(RecommendationType.EDUCATIONAL);
      expect(learningTrigger?.priority).toBe('medium');
    });

    it('should not detect learning opportunity when energy is low', async () => {
      // Arrange
      const lowEnergyContext = createMockContext({
        activity: { interruptible: true } as ActivityContext,
        energy: { level: 'low', trend: 'decreasing' } as EnergyLevel
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, lowEnergyContext);

      // Assert
      const learningTrigger = triggers.find(t => t.triggerId === 'learning_opportunity');
      expect(learningTrigger).toBeUndefined();
    });
  });

  describe('Outdoor Activity Trigger Detection (Requirement 4.4)', () => {
    it('should detect outdoor activity trigger with good weather conditions', async () => {
      // Arrange
      const outdoorContext = createMockContext({
        location: { type: 'outdoor', indoorOutdoor: 'outdoor' } as LocationContext,
        environmental: {
          weather: {
            temperature: 25,
            condition: 'sunny',
            humidity: 50,
            windSpeed: 8,
            uvIndex: 6
          } as WeatherCondition,
          timeOfDay: 'afternoon',
          season: 'summer',
          dayOfWeek: 'Saturday',
          isHoliday: false
        } as EnvironmentalContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, outdoorContext);

      // Assert
      const outdoorTrigger = triggers.find(t => t.triggerId === 'outdoor_activity');
      expect(outdoorTrigger).toBeDefined();
      expect(outdoorTrigger?.triggerType).toBe('location');
      expect(outdoorTrigger?.confidence).toBeGreaterThan(0.6);
      expect(outdoorTrigger?.recommendationTypes).toContain(RecommendationType.ACTIVITY);
    });

    it('should not detect outdoor activity trigger in bad weather', async () => {
      // Arrange
      const badWeatherContext = createMockContext({
        environmental: {
          weather: {
            temperature: 5,
            condition: 'stormy',
            humidity: 90,
            windSpeed: 30,
            uvIndex: 1
          } as WeatherCondition,
          timeOfDay: 'afternoon',
          season: 'winter',
          dayOfWeek: 'Saturday',
          isHoliday: false
        } as EnvironmentalContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, badWeatherContext);

      // Assert
      const outdoorTrigger = triggers.find(t => t.triggerId === 'outdoor_activity');
      expect(outdoorTrigger).toBeUndefined();
    });
  });

  describe('Stress Reduction Trigger Detection', () => {
    it('should detect stress reduction trigger when user is stressed', async () => {
      // Arrange
      const stressedContext = createMockContext({
        mood: {
          detected: 'stressed',
          confidence: 0.8,
          source: 'inferred'
        } as MoodContext,
        activity: { interruptible: true } as ActivityContext,
        energy: { level: 'low', trend: 'decreasing' } as EnergyLevel
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, stressedContext);

      // Assert
      const stressTrigger = triggers.find(t => t.triggerId === 'stress_reduction');
      expect(stressTrigger).toBeDefined();
      expect(stressTrigger?.triggerType).toBe('mood');
      expect(stressTrigger?.confidence).toBeGreaterThan(0.6);
      expect(stressTrigger?.priority).toBe('high');
    });
  });

  describe('Weekend Planning Trigger Detection', () => {
    it('should detect weekend planning trigger on Friday afternoon', async () => {
      // Arrange
      const fridayContext = createMockContext({
        timestamp: new Date('2024-01-19T16:00:00Z'), // Friday 4 PM
        environmental: {
          ...createMockContext().environmental,
          dayOfWeek: 'Friday'
        } as EnvironmentalContext,
        activity: { interruptible: true } as ActivityContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, fridayContext);

      // Assert
      const weekendTrigger = triggers.find(t => t.triggerId === 'weekend_planning');
      expect(weekendTrigger).toBeDefined();
      expect(weekendTrigger?.triggerType).toBe('time');
      expect(weekendTrigger?.recommendationTypes).toContain(RecommendationType.SCHEDULE);
    });
  });

  describe('Trigger Cooldown Management', () => {
    it('should respect cooldown periods for triggers', async () => {
      // Arrange
      const context = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'),
        location: { type: 'home', indoorOutdoor: 'indoor' } as LocationContext,
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act - Trigger detection twice in quick succession
      const firstTriggers = await triggerDetector.detectContextualTriggers(testUserId, context);
      const secondTriggers = await triggerDetector.detectContextualTriggers(testUserId, context);

      // Assert - Second call should have fewer triggers due to cooldown
      const firstMorningTrigger = firstTriggers.find(t => t.triggerId === 'morning_routine');
      const secondMorningTrigger = secondTriggers.find(t => t.triggerId === 'morning_routine');
      
      expect(firstMorningTrigger).toBeDefined();
      expect(secondMorningTrigger).toBeUndefined(); // Should be in cooldown
    });
  });

  describe('Trigger Pattern Enhancement', () => {
    it('should enhance trigger confidence based on behavior patterns', async () => {
      // Arrange
      const behaviorPatterns: BehaviorPattern[] = [
        {
          pattern: 'morning_exercise_routine',
          frequency: 10,
          confidence: 0.9,
          timeframe: 'daily',
          triggers: ['time', 'energy']
        }
      ];

      const context = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'),
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act
      triggerDetector.updateBehaviorPatterns(testUserId, behaviorPatterns);
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, context);

      // Assert - Confidence should be enhanced by behavior patterns
      const morningTrigger = triggers.find(t => t.triggerId === 'morning_routine');
      expect(morningTrigger).toBeDefined();
      expect(morningTrigger?.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Trigger Validation', () => {
    it('should validate contextual triggers correctly', async () => {
      // Arrange
      const validTrigger: ContextualTrigger = {
        triggerId: 'morning_routine',
        triggerType: 'time',
        condition: 'Morning Routine Optimization',
        confidence: 0.8,
        recommendationTypes: [RecommendationType.SCHEDULE],
        priority: 'high'
      };

      const context = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'),
        location: { type: 'home', indoorOutdoor: 'indoor' } as LocationContext,
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act
      const isValid = await triggerDetector.validateContextualTrigger(validTrigger, context);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject invalid triggers', async () => {
      // Arrange
      const invalidTrigger: ContextualTrigger = {
        triggerId: 'nonexistent_trigger',
        triggerType: 'time',
        condition: 'Invalid Trigger',
        confidence: 1.5, // Invalid confidence > 1
        recommendationTypes: [RecommendationType.SCHEDULE],
        priority: 'high'
      };

      const context = createMockContext();

      // Act
      const isValid = await triggerDetector.validateContextualTrigger(invalidTrigger, context);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Trigger History and Statistics', () => {
    it('should track trigger history correctly', async () => {
      // Arrange
      const context = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'),
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act
      await triggerDetector.detectContextualTriggers(testUserId, context);
      const history = triggerDetector.getTriggerHistory(testUserId);

      // Assert
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(history[0].context).toBeDefined();
    });

    it('should provide trigger statistics', async () => {
      // Arrange
      const context = createMockContext({
        timestamp: new Date('2024-01-15T08:00:00Z'),
        energy: { level: 'high', trend: 'increasing' } as EnergyLevel
      });

      // Act
      await triggerDetector.detectContextualTriggers(testUserId, context);
      const stats = triggerDetector.getTriggerStatistics(testUserId);

      // Assert
      expect(stats).toBeDefined();
      expect(stats.totalTriggers).toBeGreaterThanOrEqual(0);
      expect(stats.activatedTriggers).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.topTriggers)).toBe(true);
    });

    it('should filter trigger history by time range', async () => {
      // Arrange
      const context = createMockContext();
      const timeRange: TimeRange = {
        start: new Date('2024-01-15T00:00:00Z'),
        end: new Date('2024-01-15T23:59:59Z')
      };

      // Act
      await triggerDetector.detectContextualTriggers(testUserId, context);
      const filteredHistory = triggerDetector.getTriggerHistory(testUserId, timeRange);

      // Assert
      expect(Array.isArray(filteredHistory)).toBe(true);
      filteredHistory.forEach(record => {
        expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(timeRange.start.getTime());
        expect(record.timestamp.getTime()).toBeLessThanOrEqual(timeRange.end.getTime());
      });
    });
  });

  describe('Condition Evaluation Edge Cases', () => {
    it('should handle missing context data gracefully', async () => {
      // Arrange - Context with minimal data
      const minimalContext = createMockContext({
        mood: {
          confidence: 0.1,
          source: 'inferred'
        } as MoodContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, minimalContext);

      // Assert - Should not crash and return some results
      expect(Array.isArray(triggers)).toBe(true);
    });

    it('should handle uncertainty in context evaluation', async () => {
      // Arrange - Context with high uncertainty
      const uncertainContext = createMockContext({
        mood: {
          detected: 'happy',
          confidence: 0.2, // Low confidence
          source: 'inferred'
        } as MoodContext
      });

      // Act
      const triggers = await triggerDetector.detectContextualTriggers(testUserId, uncertainContext);

      // Assert - Triggers should have lower confidence due to uncertainty
      triggers.forEach(trigger => {
        expect(trigger.confidence).toBeLessThan(1.0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle evaluation errors gracefully', async () => {
      // Arrange - Create a context that might cause evaluation issues
      const problematicContext = createMockContext({
        timestamp: new Date('invalid-date') // This will create an invalid date
      });

      // Act & Assert - Should not throw an error
      await expect(triggerDetector.detectContextualTriggers(testUserId, problematicContext))
        .resolves.toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      const invalidTrigger = {
        triggerId: '',
        triggerType: 'invalid',
        condition: '',
        confidence: -1,
        recommendationTypes: [],
        priority: 'invalid'
      } as any;

      const context = createMockContext();

      // Act & Assert - Should not throw an error
      await expect(triggerDetector.validateContextualTrigger(invalidTrigger, context))
        .resolves.toBe(false);
    });
  });
});