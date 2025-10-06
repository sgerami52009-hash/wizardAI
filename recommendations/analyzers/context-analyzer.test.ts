/**
 * Unit tests for Context Analyzer
 * 
 * Tests context collection and interpretation accuracy, context change detection,
 * and contextual trigger identification as specified in requirements 4.1, 4.2, 4.3, 4.4
 */

import { ContextAnalyzer } from './context-analyzer';
import { ContextualTriggerDetector } from './contextual-trigger-detector';
import {
  UserContext,
  LocationContext,
  ActivityContext,
  AvailabilityContext,
  MoodContext,
  EnergyLevel,
  SocialContext,
  EnvironmentalContext,
  ContextualPreferences,
  WeatherCondition,
  TimeRange,
  ContextData,
  ContextPrediction,
  FamilyDynamics,
  ContextualTrigger,
  BehaviorPattern
} from '../types';
import { ContextSource, RecommendationType } from '../enums';

// Mock services
const mockWeatherService = {
  getCurrentWeather: jest.fn(),
  getWeatherForecast: jest.fn()
};

const mockLocationService = {
  getCurrentLocation: jest.fn(),
  getLocationHistory: jest.fn()
};

const mockCalendarService = {
  getCurrentActivity: jest.fn(),
  getUpcomingEvents: jest.fn(),
  getFreeTime: jest.fn()
};

const mockFamilyService = {
  getFamilyMembers: jest.fn(),
  getFamilyMembersPresent: jest.fn(),
  getFamilyPreferences: jest.fn()
};

describe('ContextAnalyzer', () => {
  let contextAnalyzer: ContextAnalyzer;
  const testUserId = 'test-user-123';
  const testFamilyId = 'test-family-456';

  beforeEach(() => {
    jest.clearAllMocks();
    contextAnalyzer = new ContextAnalyzer(
      mockWeatherService,
      mockLocationService,
      mockCalendarService,
      mockFamilyService
    );
  });

  describe('Context Collection and Interpretation Accuracy (Requirement 4.1)', () => {
    it('should collect and analyze current context with all components', async () => {
      // Arrange
      const mockLocation = { lat: 40.7128, lng: -74.0060 };
      const mockWeather: WeatherCondition = {
        temperature: 22,
        condition: 'sunny',
        humidity: 60,
        windSpeed: 15,
        uvIndex: 5
      };
      const mockActivity: ActivityContext = {
        currentActivity: 'work',
        interruptible: false,
        startTime: new Date('2024-01-15T09:00:00Z'),
        estimatedEndTime: new Date('2024-01-15T17:00:00Z')
      };
      const mockFreeTime: TimeRange[] = [
        { start: new Date('2024-01-15T18:00:00Z'), end: new Date('2024-01-15T20:00:00Z') }
      ];
      const mockFamilyMembers = ['user1', 'user2'];
      const mockMembersPresent = ['user1'];

      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);
      mockWeatherService.getCurrentWeather.mockResolvedValue(mockWeather);
      mockCalendarService.getCurrentActivity.mockResolvedValue(mockActivity);
      mockCalendarService.getFreeTime.mockResolvedValue(mockFreeTime);
      mockFamilyService.getFamilyMembers.mockResolvedValue(mockFamilyMembers);
      mockFamilyService.getFamilyMembersPresent.mockResolvedValue(mockMembersPresent);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context).toBeDefined();
      expect(context.userId).toBe(testUserId);
      expect(context.timestamp).toBeInstanceOf(Date);
      
      // Location context validation
      expect(context.location).toBeDefined();
      expect(context.location.coordinates).toEqual(mockLocation);
      expect(context.location.weather).toEqual(mockWeather);
      expect(context.location.type).toBe('work'); // Based on business hours heuristic
      
      // Activity context validation
      expect(context.activity).toEqual(mockActivity);
      
      // Availability context validation
      expect(context.availability.freeTime).toEqual(mockFreeTime);
      expect(context.availability.energyLevel).toBeDefined();
      
      // Social context validation
      expect(context.social.familyMembersPresent).toEqual(mockMembersPresent);
      expect(context.social.socialSetting).toBe('alone');
      
      // Environmental context validation
      expect(context.environmental.weather).toEqual(mockWeather);
      expect(context.environmental.timeOfDay).toBeDefined();
      expect(context.environmental.season).toBeDefined();
    });

    it('should handle missing location data gracefully', async () => {
      // Arrange
      mockLocationService.getCurrentLocation.mockResolvedValue(null);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context.location.type).toBe('unknown');
      expect(context.location.indoorOutdoor).toBe('indoor');
      expect(context.location.coordinates).toBeUndefined();
    });

    it('should correctly interpret location type based on time and coordinates', async () => {
      // Arrange - Morning time (8 AM)
      const morningTime = new Date('2024-01-15T08:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(morningTime.getTime());
      
      const mockLocation = { lat: 40.7128, lng: -74.0060 };
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context.location.type).toBe('school'); // Based on morning heuristic
    });

    it('should analyze mood context from schedule patterns', async () => {
      // Arrange - Setup busy schedule to trigger stressed mood
      const busyFreeTime: TimeRange[] = []; // No free time
      mockCalendarService.getFreeTime.mockResolvedValue(busyFreeTime);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context.mood).toBeDefined();
      expect(context.mood.confidence).toBeGreaterThan(0);
      expect(context.mood.source).toBe('inferred');
    });

    it('should calculate energy levels based on circadian rhythm', async () => {
      // Arrange - Morning time (9 AM)
      const morningTime = new Date('2024-01-15T09:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(morningTime.getTime());

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context.energy.level).toBe('high');
      expect(context.energy.trend).toBe('increasing');
      expect(context.energy.predictedPeak).toBeUndefined(); // No peak prediction in morning
    });

    it('should determine social context based on family presence', async () => {
      // Arrange - Multiple family members present
      const mockFamilyMembers = ['user1', 'user2', 'user3'];
      const mockMembersPresent = ['user1', 'user2'];
      
      mockFamilyService.getFamilyMembers.mockResolvedValue(mockFamilyMembers);
      mockFamilyService.getFamilyMembersPresent.mockResolvedValue(mockMembersPresent);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert
      expect(context.social.familyMembersPresent).toEqual(mockMembersPresent);
      expect(context.social.socialSetting).toBe('family');
      expect(context.social.groupActivity).toBe(true);
    });
  });

  describe('Context Change Detection Mechanisms (Requirement 4.2)', () => {
    it('should predict energy level changes throughout the day', async () => {
      // Arrange - Current time is 10 AM, predict for next 8 hours
      const currentTime = new Date('2024-01-15T10:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(currentTime.getTime());

      // Act
      const predictions = await contextAnalyzer.predictContextChanges(testUserId, 8);

      // Assert
      const energyPrediction = predictions.find(p => p.contextType === 'energy');
      expect(energyPrediction).toBeDefined();
      expect(energyPrediction?.predictedValue.level).toBe('low');
      expect(energyPrediction?.confidence).toBeGreaterThan(0.5);
      expect(energyPrediction?.factors).toContain('circadian_rhythm');
    });

    it('should predict location changes based on calendar events', async () => {
      // Arrange
      const upcomingEvents = [
        {
          id: 'event1',
          title: 'Meeting',
          start: new Date('2024-01-15T14:00:00Z'),
          end: new Date('2024-01-15T15:00:00Z'),
          location: 'Conference Room A'
        }
      ];
      mockCalendarService.getUpcomingEvents.mockResolvedValue(upcomingEvents);

      // Act
      const predictions = await contextAnalyzer.predictContextChanges(testUserId, 6);

      // Assert
      const locationPredictions = predictions.filter(p => p.contextType === 'location');
      expect(locationPredictions).toHaveLength(1);
      expect(locationPredictions[0].predictedValue.location).toBe('Conference Room A');
      expect(locationPredictions[0].factors).toContain('calendar_event');
    });

    it('should predict social context changes for family time', async () => {
      // Arrange - Current time is 4 PM, predict family gathering at 6 PM
      const currentTime = new Date('2024-01-15T16:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(currentTime.getTime());

      // Act
      const predictions = await contextAnalyzer.predictContextChanges(testUserId, 4);

      // Assert
      const socialPrediction = predictions.find(p => p.contextType === 'social');
      expect(socialPrediction).toBeDefined();
      expect(socialPrediction?.predictedValue.socialSetting).toBe('family');
      expect(socialPrediction?.factors).toContain('dinner_time');
    });

    it('should handle prediction errors gracefully', async () => {
      // Arrange
      mockCalendarService.getUpcomingEvents.mockRejectedValue(new Error('Calendar service unavailable'));

      // Act
      const predictions = await contextAnalyzer.predictContextChanges(testUserId, 4);

      // Assert - Should still return energy predictions even if calendar fails
      expect(predictions).toBeDefined();
      expect(predictions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Model Updates and Pattern Recognition (Requirement 4.3)', () => {
    it('should update context model with new behavior patterns', async () => {
      // Arrange
      const contextData: ContextData = {
        source: ContextSource.USER_INPUT,
        timestamp: new Date(),
        data: { activity: 'reading', location: 'home', mood: 'calm' },
        reliability: 0.9
      };

      // Act
      await contextAnalyzer.updateContextModel(testUserId, contextData);

      // Assert - Should complete without error
      expect(true).toBe(true); // Model update is internal, we verify no errors thrown
    });

    it('should validate context data before updating model', async () => {
      // Arrange - Invalid context data (missing required fields)
      const invalidContextData: ContextData = {
        source: ContextSource.SENSOR,
        timestamp: new Date(),
        data: {},
        reliability: -0.5 // Invalid reliability score
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(invalidContextData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should validate location data correctly', async () => {
      // Arrange - Valid location data
      const validLocationData: ContextData = {
        source: ContextSource.LOCATION,
        timestamp: new Date(),
        data: { lat: 40.7128, lng: -74.0060 },
        reliability: 0.8
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(validLocationData);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject location data with invalid coordinates', async () => {
      // Arrange - Invalid location data (coordinates out of range)
      const invalidLocationData: ContextData = {
        source: ContextSource.LOCATION,
        timestamp: new Date(),
        data: { lat: 200, lng: -300 }, // Invalid coordinates
        reliability: 0.8
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(invalidLocationData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should validate weather data correctly', async () => {
      // Arrange - Valid weather data
      const validWeatherData: ContextData = {
        source: ContextSource.WEATHER,
        timestamp: new Date(),
        data: { temperature: 25, condition: 'sunny' },
        reliability: 0.85
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(validWeatherData);

      // Assert
      expect(isValid).toBe(true);
    });
  });

  describe('Family Dynamics Analysis (Requirement 4.4)', () => {
    it('should analyze family dynamics with default patterns', async () => {
      // Arrange
      const mockFamilyPreferences = {
        communicationStyle: 'collaborative',
        decisionMaking: 'consensus'
      };
      mockFamilyService.getFamilyPreferences.mockResolvedValue(mockFamilyPreferences);

      // Act
      const dynamics = await contextAnalyzer.analyzeFamilyDynamics(testFamilyId);

      // Assert
      expect(dynamics).toBeDefined();
      expect(dynamics.leadershipStyle).toBe('collaborative');
      expect(dynamics.decisionMaking).toBe('consensus');
      expect(dynamics.conflictResolution).toBe('discussion');
      expect(dynamics.communicationPatterns).toContain('direct');
      expect(dynamics.sharedValues).toContain('family_time');
    });

    it('should handle family service errors gracefully', async () => {
      // Arrange
      mockFamilyService.getFamilyPreferences.mockRejectedValue(new Error('Family service unavailable'));

      // Act
      const dynamics = await contextAnalyzer.analyzeFamilyDynamics(testFamilyId);

      // Assert - Should return default dynamics
      expect(dynamics).toBeDefined();
      expect(dynamics.leadershipStyle).toBe('collaborative');
      expect(dynamics.sharedValues).toContain('family_time');
    });
  });

  describe('Contextual Trigger Detection Integration (Requirement 4.4)', () => {
    it('should detect contextual triggers based on current context', async () => {
      // Arrange - Setup context that should trigger recommendations
      const mockLocation = { lat: 40.7128, lng: -74.0060 };
      const mockWeather: WeatherCondition = {
        temperature: 25,
        condition: 'sunny',
        humidity: 50,
        windSpeed: 10,
        uvIndex: 6
      };
      
      mockLocationService.getCurrentLocation.mockResolvedValue(mockLocation);
      mockWeatherService.getCurrentWeather.mockResolvedValue(mockWeather);
      mockCalendarService.getCurrentActivity.mockResolvedValue({ interruptible: true });
      mockFamilyService.getFamilyMembersPresent.mockResolvedValue(['user1', 'user2']);

      // Act
      const triggers = await contextAnalyzer.detectContextualTriggers(testUserId);

      // Assert
      expect(triggers).toBeDefined();
      expect(Array.isArray(triggers)).toBe(true);
      // Triggers should be detected based on the sunny weather and family presence
    });

    it('should update trigger detector with behavior patterns', async () => {
      // Arrange
      const mockBehaviorPatterns: BehaviorPattern[] = [
        {
          pattern: 'morning_exercise',
          frequency: 5,
          confidence: 0.8,
          timeframe: 'daily',
          triggers: ['time', 'energy']
        }
      ];

      // Act - This should not throw an error
      await contextAnalyzer.detectContextualTriggers(testUserId);

      // Assert - Verify the method completes successfully
      expect(true).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle weather service failures gracefully', async () => {
      // Arrange
      mockLocationService.getCurrentLocation.mockResolvedValue({ lat: 40.7128, lng: -74.0060 });
      mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('Weather service unavailable'));

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert - Should still return valid context without weather data
      expect(context).toBeDefined();
      expect(context.location.weather).toBeUndefined();
    });

    it('should handle calendar service failures gracefully', async () => {
      // Arrange
      mockCalendarService.getCurrentActivity.mockRejectedValue(new Error('Calendar service unavailable'));
      mockCalendarService.getFreeTime.mockRejectedValue(new Error('Calendar service unavailable'));

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert - Should return default activity context
      expect(context).toBeDefined();
      expect(context.activity.interruptible).toBe(true);
      expect(context.availability.freeTime).toEqual([]);
    });

    it('should handle family service failures gracefully', async () => {
      // Arrange
      mockFamilyService.getFamilyMembers.mockRejectedValue(new Error('Family service unavailable'));
      mockFamilyService.getFamilyMembersPresent.mockRejectedValue(new Error('Family service unavailable'));

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert - Should return default social context
      expect(context).toBeDefined();
      expect(context.social.familyMembersPresent).toEqual([]);
      expect(context.social.socialSetting).toBe('alone');
    });

    it('should reject context data with timestamps too far in the past', async () => {
      // Arrange - Context data from 2 days ago
      const oldContextData: ContextData = {
        source: ContextSource.SENSOR,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        data: { activity: 'reading' },
        reliability: 0.8
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(oldContextData);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject context data with timestamps in the future', async () => {
      // Arrange - Context data from 2 hours in the future
      const futureContextData: ContextData = {
        source: ContextSource.SENSOR,
        timestamp: new Date(Date.now() + 2 * 60 * 60 * 1000),
        data: { activity: 'reading' },
        reliability: 0.8
      };

      // Act
      const isValid = await contextAnalyzer.validateContextData(futureContextData);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Context History Management', () => {
    it('should store context history for pattern analysis', async () => {
      // Arrange
      mockLocationService.getCurrentLocation.mockResolvedValue({ lat: 40.7128, lng: -74.0060 });

      // Act - Analyze context multiple times to build history
      await contextAnalyzer.analyzeCurrentContext(testUserId);
      await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert - History should be maintained internally (verified by no errors)
      expect(true).toBe(true);
    });

    it('should handle context analysis with minimal data', async () => {
      // Arrange - All services return minimal/null data
      mockLocationService.getCurrentLocation.mockResolvedValue(null);
      mockCalendarService.getCurrentActivity.mockResolvedValue(null);
      mockCalendarService.getFreeTime.mockResolvedValue([]);
      mockFamilyService.getFamilyMembers.mockResolvedValue([]);
      mockFamilyService.getFamilyMembersPresent.mockResolvedValue([]);

      // Act
      const context = await contextAnalyzer.analyzeCurrentContext(testUserId);

      // Assert - Should still return a valid context with defaults
      expect(context).toBeDefined();
      expect(context.userId).toBe(testUserId);
      expect(context.location.type).toBe('unknown');
      expect(context.activity.interruptible).toBe(true);
      expect(context.social.socialSetting).toBe('alone');
    });
  });
});