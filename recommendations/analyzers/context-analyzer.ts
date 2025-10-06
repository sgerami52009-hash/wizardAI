/**
 * Context Analyzer
 * 
 * Continuously analyzes user and environmental context to inform
 * recommendation generation with multi-modal sensing capabilities.
 */

import { IContextAnalyzer } from '../interfaces';
import {
  UserContext,
  ContextPrediction,
  FamilyDynamics,
  ContextualTrigger,
  ContextData,
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
  BehaviorPattern,
  ContextFeature
} from '../types';
import { ContextSource, RecommendationType } from '../enums';
import { ContextualTriggerDetector } from './contextual-trigger-detector';

interface ContextSensor {
  type: ContextSource;
  isAvailable(): boolean;
  getData(): Promise<any>;
  getReliability(): number;
}

interface WeatherService {
  getCurrentWeather(lat: number, lng: number): Promise<WeatherCondition>;
  getWeatherForecast(lat: number, lng: number, hours: number): Promise<WeatherCondition[]>;
}

interface LocationService {
  getCurrentLocation(userId: string): Promise<{ lat: number; lng: number } | null>;
  getLocationHistory(userId: string, timeRange: TimeRange): Promise<LocationContext[]>;
}

interface CalendarService {
  getCurrentActivity(userId: string): Promise<ActivityContext | null>;
  getUpcomingEvents(userId: string, hours: number): Promise<any[]>;
  getFreeTime(userId: string, timeRange: TimeRange): Promise<TimeRange[]>;
}

interface FamilyService {
  getFamilyMembers(userId: string): Promise<string[]>;
  getFamilyMembersPresent(userId: string): Promise<string[]>;
  getFamilyPreferences(familyId: string): Promise<any>;
}

export class ContextAnalyzer implements IContextAnalyzer {
  private contextHistory: Map<string, UserContext[]> = new Map();
  private behaviorPatterns: Map<string, BehaviorPattern[]> = new Map();
  private contextSensors: ContextSensor[] = [];
  private triggerDetector: ContextualTriggerDetector;
  private weatherService?: WeatherService;
  private locationService?: LocationService;
  private calendarService?: CalendarService;
  private familyService?: FamilyService;

  constructor(
    weatherService?: WeatherService,
    locationService?: LocationService,
    calendarService?: CalendarService,
    familyService?: FamilyService
  ) {
    this.weatherService = weatherService;
    this.locationService = locationService;
    this.calendarService = calendarService;
    this.familyService = familyService;
    this.triggerDetector = new ContextualTriggerDetector();
    this.initializeContextSensors();
  }

  private initializeContextSensors(): void {
    // Initialize available context sensors
    this.contextSensors = [
      {
        type: ContextSource.CALENDAR,
        isAvailable: () => !!this.calendarService,
        getData: () => this.calendarService?.getCurrentActivity('') || Promise.resolve(null),
        getReliability: () => 0.9
      },
      {
        type: ContextSource.LOCATION,
        isAvailable: () => !!this.locationService,
        getData: () => this.locationService?.getCurrentLocation('') || Promise.resolve(null),
        getReliability: () => 0.8
      },
      {
        type: ContextSource.WEATHER,
        isAvailable: () => !!this.weatherService,
        getData: () => Promise.resolve(null), // Will be called with location
        getReliability: () => 0.85
      }
    ];
  }

  async analyzeCurrentContext(userId: string): Promise<UserContext> {
    const timestamp = new Date();
    
    // Collect context from multiple sources
    const [
      locationContext,
      activityContext,
      availabilityContext,
      moodContext,
      energyLevel,
      socialContext,
      environmentalContext,
      contextualPreferences
    ] = await Promise.all([
      this.analyzeLocationContext(userId),
      this.analyzeActivityContext(userId),
      this.analyzeAvailabilityContext(userId),
      this.analyzeMoodContext(userId),
      this.analyzeEnergyLevel(userId),
      this.analyzeSocialContext(userId),
      this.analyzeEnvironmentalContext(userId),
      this.getContextualPreferences(userId)
    ]);

    const userContext: UserContext = {
      userId,
      timestamp,
      location: locationContext,
      activity: activityContext,
      availability: availabilityContext,
      mood: moodContext,
      energy: energyLevel,
      social: socialContext,
      environmental: environmentalContext,
      preferences: contextualPreferences
    };

    // Store context in history for pattern analysis
    this.storeContextHistory(userId, userContext);

    return userContext;
  }

  private async analyzeLocationContext(userId: string): Promise<LocationContext> {
    try {
      const location = await this.locationService?.getCurrentLocation(userId);
      
      if (!location) {
        return {
          type: 'unknown',
          indoorOutdoor: 'indoor' // Default assumption
        };
      }

      // Determine location type based on coordinates and time
      const locationType = await this.determineLocationType(location, userId);
      const weather = await this.weatherService?.getCurrentWeather(location.lat, location.lng);

      return {
        type: locationType,
        coordinates: location,
        weather,
        indoorOutdoor: this.determineIndoorOutdoor(locationType, weather)
      };
    } catch (error) {
      console.error('Error analyzing location context:', error);
      return {
        type: 'unknown',
        indoorOutdoor: 'indoor'
      };
    }
  }

  private async determineLocationType(
    location: { lat: number; lng: number }, 
    userId: string
  ): Promise<LocationContext['type']> {
    // Simple heuristic - in a real implementation, this would use
    // reverse geocoding and user's known locations
    const now = new Date();
    const hour = now.getHours();
    
    // Business hours heuristic
    if (hour >= 9 && hour <= 17) {
      return 'work';
    } else if (hour >= 7 && hour <= 8) {
      return 'school'; // Could be school for children
    } else {
      return 'home';
    }
  }

  private determineIndoorOutdoor(
    locationType: LocationContext['type'], 
    weather?: WeatherCondition
  ): 'indoor' | 'outdoor' | 'mixed' {
    if (locationType === 'outdoor') return 'outdoor';
    if (locationType === 'travel') return 'mixed';
    
    // Consider weather for indoor/outdoor determination
    if (weather && (weather.condition === 'stormy' || weather.temperature < 0)) {
      return 'indoor';
    }
    
    return 'indoor'; // Default for home, work, school
  }

  private async analyzeActivityContext(userId: string): Promise<ActivityContext> {
    try {
      const currentActivity = await this.calendarService?.getCurrentActivity(userId);
      
      if (!currentActivity) {
        return {
          interruptible: true
        };
      }

      return currentActivity;
    } catch (error) {
      console.error('Error analyzing activity context:', error);
      return {
        interruptible: true
      };
    }
  }

  private async analyzeAvailabilityContext(userId: string): Promise<AvailabilityContext> {
    try {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      const timeRange: TimeRange = { start: now, end: endOfDay };
      const freeTime = await this.calendarService?.getFreeTime(userId, timeRange) || [];
      
      // Analyze energy patterns to determine busy/flexible time
      const energyLevel = await this.analyzeEnergyLevel(userId);
      
      return {
        freeTime,
        busyTime: [], // Would be calculated from calendar events
        flexibleTime: freeTime.filter(slot => 
          (slot.end.getTime() - slot.start.getTime()) > 30 * 60 * 1000 // > 30 minutes
        ),
        energyLevel
      };
    } catch (error) {
      console.error('Error analyzing availability context:', error);
      return {
        freeTime: [],
        busyTime: [],
        flexibleTime: [],
        energyLevel: { level: 'medium', trend: 'stable' }
      };
    }
  }

  private async analyzeMoodContext(userId: string): Promise<MoodContext> {
    // In a real implementation, this would analyze:
    // - Voice tone from recent interactions
    // - Interaction patterns
    // - Schedule stress indicators
    // - Recent feedback patterns
    
    const recentContext = this.getRecentContextHistory(userId, 2); // Last 2 hours
    
    if (recentContext.length === 0) {
      return {
        confidence: 0.3,
        source: 'inferred'
      };
    }

    // Simple heuristic based on schedule density
    const avgBusyTime = recentContext.reduce((sum, ctx) => 
      sum + ctx.availability.busyTime.length, 0) / recentContext.length;
    
    let detectedMood: MoodContext['detected'];
    if (avgBusyTime > 5) {
      detectedMood = 'stressed';
    } else if (avgBusyTime < 2) {
      detectedMood = 'calm';
    } else {
      detectedMood = 'happy';
    }

    return {
      detected: detectedMood,
      confidence: 0.6,
      source: 'inferred'
    };
  }

  private async analyzeEnergyLevel(userId: string): Promise<EnergyLevel> {
    const now = new Date();
    const hour = now.getHours();
    
    // Simple circadian rhythm model
    let level: EnergyLevel['level'];
    let trend: EnergyLevel['trend'];
    let predictedPeak: Date | undefined;

    if (hour >= 6 && hour <= 10) {
      level = 'high';
      trend = 'increasing';
    } else if (hour >= 11 && hour <= 14) {
      level = 'high';
      trend = 'stable';
    } else if (hour >= 15 && hour <= 17) {
      level = 'medium';
      trend = 'decreasing';
    } else if (hour >= 18 && hour <= 21) {
      level = 'medium';
      trend = 'stable';
    } else {
      level = 'low';
      trend = 'decreasing';
    }

    // Predict next energy peak (typically morning)
    if (hour > 10) {
      predictedPeak = new Date(now);
      predictedPeak.setDate(predictedPeak.getDate() + 1);
      predictedPeak.setHours(9, 0, 0, 0);
    }

    return { level, trend, predictedPeak };
  }

  private async analyzeSocialContext(userId: string): Promise<SocialContext> {
    try {
      const familyMembers = await this.familyService?.getFamilyMembers(userId) || [];
      const membersPresent = await this.familyService?.getFamilyMembersPresent(userId) || [];
      
      let socialSetting: SocialContext['socialSetting'];
      if (membersPresent.length === 0) {
        socialSetting = 'alone';
      } else if (membersPresent.every(id => familyMembers.includes(id))) {
        socialSetting = 'family';
      } else {
        socialSetting = 'public';
      }

      return {
        familyMembersPresent: membersPresent,
        socialSetting,
        groupActivity: membersPresent.length > 1
      };
    } catch (error) {
      console.error('Error analyzing social context:', error);
      return {
        familyMembersPresent: [],
        socialSetting: 'alone',
        groupActivity: false
      };
    }
  }

  private async analyzeEnvironmentalContext(userId: string): Promise<EnvironmentalContext> {
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Determine time of day
    let timeOfDay: EnvironmentalContext['timeOfDay'];
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Determine season (Northern Hemisphere)
    let season: EnvironmentalContext['season'];
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';

    // Simple holiday detection (would be more sophisticated in real implementation)
    const isHoliday = this.isHoliday(now);

    // Get weather from location context
    const locationContext = await this.analyzeLocationContext(userId);
    const weather = locationContext.weather || {
      temperature: 20,
      condition: 'cloudy' as const,
      humidity: 50,
      windSpeed: 10,
      uvIndex: 3
    };

    return {
      weather,
      timeOfDay,
      season,
      dayOfWeek,
      isHoliday
    };
  }

  private isHoliday(date: Date): boolean {
    // Simple holiday detection - would use a proper holiday API in production
    const month = date.getMonth();
    const day = date.getDate();
    
    // Major US holidays
    if (month === 11 && day === 25) return true; // Christmas
    if (month === 0 && day === 1) return true; // New Year's
    if (month === 6 && day === 4) return true; // Independence Day
    
    return false;
  }

  private async getContextualPreferences(userId: string): Promise<ContextualPreferences> {
    // In a real implementation, this would load user's contextual preferences
    // For now, return defaults
    return {
      preferredActivities: [],
      avoidedActivities: [],
      timePreferences: [],
      socialPreferences: {
        familyTime: 'medium',
        aloneTime: 'medium',
        groupActivities: 'acceptable'
      }
    };
  }

  private storeContextHistory(userId: string, context: UserContext): void {
    if (!this.contextHistory.has(userId)) {
      this.contextHistory.set(userId, []);
    }
    
    const history = this.contextHistory.get(userId)!;
    history.push(context);
    
    // Keep only last 24 hours of context
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(ctx => ctx.timestamp > oneDayAgo);
    this.contextHistory.set(userId, filteredHistory);
  }

  private getRecentContextHistory(userId: string, hours: number): UserContext[] {
    const history = this.contextHistory.get(userId) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return history.filter(ctx => ctx.timestamp > cutoff);
  }

  async predictContextChanges(userId: string, timeHorizon: number): Promise<ContextPrediction[]> {
    const predictions: ContextPrediction[] = [];
    const now = new Date();
    const endTime = new Date(now.getTime() + timeHorizon * 60 * 60 * 1000);
    
    // Predict energy level changes
    const energyPrediction = this.predictEnergyChanges(userId, now, endTime);
    if (energyPrediction) {
      predictions.push(energyPrediction);
    }

    // Predict location changes based on calendar
    const locationPredictions = await this.predictLocationChanges(userId, now, endTime);
    predictions.push(...locationPredictions);

    // Predict social context changes
    const socialPredictions = await this.predictSocialChanges(userId, now, endTime);
    predictions.push(...socialPredictions);

    return predictions;
  }

  private predictEnergyChanges(userId: string, start: Date, end: Date): ContextPrediction | null {
    const currentHour = start.getHours();
    const endHour = end.getHours();
    
    // Predict energy dip in afternoon
    if (currentHour < 15 && endHour >= 15) {
      return {
        contextType: 'energy',
        predictedValue: { level: 'low', trend: 'decreasing' },
        confidence: 0.7,
        timeframe: { 
          start: new Date(start.getTime() + (15 - currentHour) * 60 * 60 * 1000), 
          end 
        },
        factors: ['circadian_rhythm', 'afternoon_dip'],
        uncertainty: 0.3
      };
    }

    return null;
  }

  private async predictLocationChanges(userId: string, start: Date, end: Date): Promise<ContextPrediction[]> {
    try {
      const upcomingEvents = await this.calendarService?.getUpcomingEvents(userId, 
        (end.getTime() - start.getTime()) / (1000 * 60 * 60)) || [];
      
      return upcomingEvents
        .filter(event => event.location)
        .map(event => ({
          contextType: 'location',
          predictedValue: { type: 'travel', location: event.location },
          confidence: 0.8,
          timeframe: { start: new Date(event.start), end: new Date(event.end) },
          factors: ['calendar_event'],
          uncertainty: 0.2
        }));
    } catch (error) {
      console.error('Error predicting location changes:', error);
      return [];
    }
  }

  private async predictSocialChanges(userId: string, start: Date, end: Date): Promise<ContextPrediction[]> {
    // Simple prediction based on typical family patterns
    const predictions: ContextPrediction[] = [];
    const hour = start.getHours();
    
    // Predict family gathering times
    if (hour < 18 && end.getHours() >= 18) {
      predictions.push({
        contextType: 'social',
        predictedValue: { socialSetting: 'family', groupActivity: true },
        confidence: 0.6,
        timeframe: { 
          start: new Date(start.getTime() + (18 - hour) * 60 * 60 * 1000), 
          end 
        },
        factors: ['dinner_time', 'family_routine'],
        uncertainty: 0.4
      });
    }

    return predictions;
  }

  async analyzeFamilyDynamics(familyId: string): Promise<FamilyDynamics> {
    try {
      // In a real implementation, this would analyze:
      // - Family interaction patterns
      // - Decision-making history
      // - Conflict resolution patterns
      // - Communication preferences
      
      const familyPreferences = await this.familyService?.getFamilyPreferences(familyId);
      
      // Default family dynamics based on common patterns
      return {
        leadershipStyle: 'collaborative',
        decisionMaking: 'consensus',
        conflictResolution: 'discussion',
        communicationPatterns: ['direct', 'supportive', 'inclusive'],
        sharedValues: ['family_time', 'learning', 'health', 'fun']
      };
    } catch (error) {
      console.error('Error analyzing family dynamics:', error);
      return {
        leadershipStyle: 'collaborative',
        decisionMaking: 'consensus',
        conflictResolution: 'discussion',
        communicationPatterns: ['supportive'],
        sharedValues: ['family_time']
      };
    }
  }

  async detectContextualTriggers(userId: string): Promise<ContextualTrigger[]> {
    const currentContext = await this.analyzeCurrentContext(userId);
    
    // Use the dedicated trigger detector for pattern recognition
    const triggers = await this.triggerDetector.detectContextualTriggers(userId, currentContext);
    
    // Update trigger detector with current behavior patterns
    const userPatterns = this.behaviorPatterns.get(userId) || [];
    this.triggerDetector.updateBehaviorPatterns(userId, userPatterns);
    
    return triggers;
  }



  async updateContextModel(userId: string, contextData: ContextData): Promise<void> {
    try {
      // Validate the context data first
      const isValid = await this.validateContextData(contextData);
      if (!isValid) {
        console.warn('Invalid context data received:', contextData);
        return;
      }

      // Update behavior patterns based on new context data
      await this.updateBehaviorPatterns(userId, contextData);
      
      // Update context features for learning
      await this.updateContextFeatures(userId, contextData);
      
      console.log(`Context model updated for user ${userId}`);
    } catch (error) {
      console.error('Error updating context model:', error);
    }
  }

  private async updateBehaviorPatterns(userId: string, contextData: ContextData): Promise<void> {
    if (!this.behaviorPatterns.has(userId)) {
      this.behaviorPatterns.set(userId, []);
    }

    const patterns = this.behaviorPatterns.get(userId)!;
    
    // Simple pattern recognition - in a real implementation, this would be more sophisticated
    const patternKey = `${contextData.source}_${JSON.stringify(contextData.data)}`;
    const existingPattern = patterns.find(p => p.pattern === patternKey);
    
    if (existingPattern) {
      existingPattern.frequency += 1;
      existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1.0);
    } else {
      patterns.push({
        pattern: patternKey,
        frequency: 1,
        confidence: 0.5,
        timeframe: 'daily',
        triggers: [contextData.source]
      });
    }

    // Keep only the most relevant patterns (top 50)
    patterns.sort((a, b) => b.frequency * b.confidence - a.frequency * a.confidence);
    if (patterns.length > 50) {
      patterns.splice(50);
    }

    this.behaviorPatterns.set(userId, patterns);
  }

  private async updateContextFeatures(userId: string, contextData: ContextData): Promise<void> {
    // Extract features from context data for machine learning
    const features: ContextFeature[] = [];
    
    Object.entries(contextData.data).forEach(([key, value]) => {
      features.push({
        name: key,
        value,
        importance: contextData.reliability,
        source: contextData.source,
        timestamp: contextData.timestamp
      });
    });

    // In a real implementation, these features would be sent to the learning engine
    console.log(`Extracted ${features.length} context features for user ${userId}`);
  }

  async validateContextData(contextData: ContextData): Promise<boolean> {
    try {
      // Basic validation checks
      if (!contextData.source || !contextData.timestamp || !contextData.data) {
        return false;
      }

      // Check if timestamp is reasonable (not too old or in the future)
      const now = new Date();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      const maxFuture = 60 * 60 * 1000; // 1 hour
      
      if (contextData.timestamp.getTime() < now.getTime() - maxAge ||
          contextData.timestamp.getTime() > now.getTime() + maxFuture) {
        return false;
      }

      // Check reliability score
      if (contextData.reliability < 0 || contextData.reliability > 1) {
        return false;
      }

      // Validate data structure based on source
      return this.validateContextDataBySource(contextData);
    } catch (error) {
      console.error('Error validating context data:', error);
      return false;
    }
  }

  private validateContextDataBySource(contextData: ContextData): boolean {
    switch (contextData.source) {
      case ContextSource.LOCATION:
        return this.validateLocationData(contextData.data);
      case ContextSource.CALENDAR:
        return this.validateCalendarData(contextData.data);
      case ContextSource.WEATHER:
        return this.validateWeatherData(contextData.data);
      case ContextSource.SENSOR:
        return this.validateSensorData(contextData.data);
      default:
        return true; // Allow unknown sources with basic validation
    }
  }

  private validateLocationData(data: any): boolean {
    return data.lat !== undefined && data.lng !== undefined &&
           typeof data.lat === 'number' && typeof data.lng === 'number' &&
           data.lat >= -90 && data.lat <= 90 &&
           data.lng >= -180 && data.lng <= 180;
  }

  private validateCalendarData(data: any): boolean {
    return data.title !== undefined && data.start !== undefined && data.end !== undefined;
  }

  private validateWeatherData(data: any): boolean {
    return data.temperature !== undefined && data.condition !== undefined &&
           typeof data.temperature === 'number' && typeof data.condition === 'string';
  }

  private validateSensorData(data: any): boolean {
    // Basic validation for sensor data
    return data !== null && typeof data === 'object';
  }
}