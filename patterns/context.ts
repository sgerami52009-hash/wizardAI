// Enhanced Context Aggregator Implementation with Environmental Awareness

import { EventEmitter } from 'events';
import {
  ContextAggregator,
  UserContext,
  ContextUpdate,
  ContextHistory,
  ContextSource,
  ContextPrediction,
  TimeRange,
  ContextChange,
  ContextPattern,
  ContextTrend,
  HistoricalContext,
  PredictionFactor,
  AlternativeContext,
  ContextSourceType,
  ContextDataType,
  ChangeType,
  ChangeImpact,
  TrendType,
  TrendDirection,
  TimeFrame,
  PredictionFactorType
} from './types';
import {
  TemporalContext,
  EnvironmentalContext,
  SocialContext,
  DeviceContext,
  TimeOfDay,
  DayOfWeek,
  Season,
  ScheduleRelation,
  LocationContext,
  WeatherContext,
  LightingContext,
  NoiseContext,
  FamilyMember,
  WeatherCondition,
  NoiseType,
  SocialActivity,
  DeviceType,
  ScreenSize,
  InputMethod,
  ConnectivityStatus
} from '../learning/types';

/**
 * Enhanced ContextAggregator with multi-source context integration, real-time updates,
 * and smart home sensor integration for comprehensive environmental awareness.
 * Optimized for Jetson Nano Orin performance constraints.
 */
export class EnhancedContextAggregator implements ContextAggregator {
  private eventBus: EventEmitter;
  private contextCache: Map<string, UserContext> = new Map();
  private contextHistory: Map<string, HistoricalContext[]> = new Map();
  private contextSources: Map<string, ContextSource> = new Map();
  private contextPatterns: Map<string, ContextPattern[]> = new Map();
  private predictionCache: Map<string, ContextPrediction> = new Map();
  
  // Performance optimization settings
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly UPDATE_THROTTLE = 1000; // 1 second minimum between updates
  private readonly PREDICTION_CACHE_TTL = 600000; // 10 minutes
  
  // Context change detection thresholds
  private readonly SIGNIFICANT_CHANGE_THRESHOLD = 0.3;
  private readonly PATTERN_DETECTION_MIN_SAMPLES = 5;
  
  // Smart home integration
  private sensorManager: SmartHomeSensorManager;
  private lastUpdateTime: Map<string, number> = new Map();
  private changeDetector: ContextChangeDetector;

  constructor(eventBus?: EventEmitter) {
    this.eventBus = eventBus || new EventEmitter();
    this.sensorManager = new SmartHomeSensorManager(this.eventBus);
    this.changeDetector = new ContextChangeDetector();
    
    this.setupEventListeners();
    this.setupPeriodicTasks();
  }

  /**
   * Gets current comprehensive context for user with real-time sensor integration
   */
  public async getCurrentContext(userId: string): Promise<UserContext> {
    try {
      // Check cache first
      const cached = this.contextCache.get(userId);
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached;
      }

      // Aggregate context from all sources
      const temporal = await this.aggregateTemporalContext();
      const spatial = await this.aggregateSpatialContext(userId);
      const device = await this.aggregateDeviceContext(userId);
      const activity = await this.aggregateActivityContext(userId);
      const social = await this.aggregateSocialContext(userId);
      const environmental = await this.aggregateEnvironmentalContext(userId);
      const historical = await this.aggregateHistoricalContext(userId);

      const context: UserContext = {
        userId,
        timestamp: new Date(),
        temporal,
        spatial,
        device,
        activity,
        social,
        environmental,
        historical
      };

      // Cache the context
      this.contextCache.set(userId, context);
      
      // Store in history
      await this.addToHistory(userId, context);
      
      // Emit context update event
      this.eventBus.emit('context:updated', {
        userId,
        context,
        timestamp: new Date()
      });

      return context;

    } catch (error) {
      this.eventBus.emit('context:error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Updates context with real-time change detection and validation
   */
  public async updateContext(userId: string, contextUpdate: ContextUpdate): Promise<void> {
    // Throttle updates to prevent overwhelming the system
    const lastUpdate = this.lastUpdateTime.get(userId) || 0;
    if (Date.now() - lastUpdate < this.UPDATE_THROTTLE) {
      return; // Skip update if too frequent
    }

    try {
      // Validate context update
      this.validateContextUpdate(contextUpdate);

      // Get current context for comparison
      const currentContext = await this.getCurrentContext(userId);
      
      // Detect significant changes
      const changes = await this.changeDetector.detectChanges(currentContext, contextUpdate);
      
      if (changes.length > 0) {
        // Apply changes to current context
        const updatedContext = await this.applyContextChanges(currentContext, changes);
        
        // Update cache
        this.contextCache.set(userId, updatedContext);
        
        // Store in history if significant
        const significantChanges = changes.filter(c => c.impact !== ChangeImpact.NONE);
        if (significantChanges.length > 0) {
          await this.addToHistory(userId, updatedContext);
        }
        
        // Update patterns
        await this.updateContextPatterns(userId, updatedContext, changes);
        
        // Emit change events
        this.emitContextChangeEvents(userId, changes, updatedContext);
        
        // Update prediction cache
        this.invalidatePredictionCache(userId);
      }

      this.lastUpdateTime.set(userId, Date.now());

    } catch (error) {
      this.eventBus.emit('context:update:error', {
        userId,
        updateId: contextUpdate.updateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Gets context history with pattern analysis
   */
  public async getContextHistory(userId: string, timeRange: TimeRange): Promise<ContextHistory> {
    const userHistory = this.contextHistory.get(userId) || [];
    
    // Filter by time range
    const filteredHistory = userHistory.filter(h => 
      h.timestamp >= timeRange.start && h.timestamp <= timeRange.end
    );

    // Analyze patterns in the history
    const patterns = await this.analyzeContextPatterns(filteredHistory);
    
    // Calculate trends
    const trends = await this.calculateContextTrends(filteredHistory, timeRange);

    return {
      userId,
      timeRange,
      contexts: filteredHistory,
      patterns,
      trends
    };
  }

  /**
   * Registers context source with validation and integration
   */
  public async registerContextSource(source: ContextSource): Promise<void> {
    // Validate source configuration
    this.validateContextSource(source);
    
    // Register source
    this.contextSources.set(source.sourceId, source);
    
    // Set up source-specific event listeners
    this.setupSourceEventListeners(source);
    
    // Initialize source if it's a sensor
    if (source.type === ContextSourceType.SENSOR) {
      await this.sensorManager.initializeSensor(source);
    }

    this.eventBus.emit('context:source:registered', {
      sourceId: source.sourceId,
      type: source.type,
      timestamp: new Date()
    });
  }

  /**
   * Predicts future context changes using machine learning algorithms
   */
  public async predictContextChange(userId: string, timeHorizon: number): Promise<ContextPrediction> {
    // Check prediction cache
    const cacheKey = `${userId}_${timeHorizon}`;
    const cached = this.predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.predictedContext.timestamp.getTime() < this.PREDICTION_CACHE_TTL) {
      return cached;
    }

    try {
      // Get historical context for prediction
      const history = this.contextHistory.get(userId) || [];
      if (history.length < 10) {
        throw new Error('Insufficient historical data for prediction');
      }

      // Analyze historical patterns
      const patterns = await this.analyzeContextPatterns(history);
      
      // Generate prediction factors
      const factors = await this.generatePredictionFactors(history, patterns, timeHorizon);
      
      // Predict future context
      const predictedContext = await this.generateContextPrediction(userId, factors, timeHorizon);
      
      // Calculate confidence based on pattern strength and historical accuracy
      const confidence = this.calculatePredictionConfidence(factors, patterns);
      
      // Generate alternative scenarios
      const alternatives = await this.generateAlternativeContexts(predictedContext, factors);

      const prediction: ContextPrediction = {
        predictionId: this.generatePredictionId(userId, timeHorizon),
        userId,
        timeHorizon,
        predictedContext,
        confidence,
        factors,
        alternatives
      };

      // Cache prediction
      this.predictionCache.set(cacheKey, prediction);

      return prediction;

    } catch (error) {
      this.eventBus.emit('context:prediction:error', {
        userId,
        timeHorizon,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Gets registered context sources
   */
  public getRegisteredSources(): ContextSource[] {
    return Array.from(this.contextSources.values());
  }

  /**
   * Gets context patterns for user
   */
  public async getContextPatterns(userId: string): Promise<ContextPattern[]> {
    return this.contextPatterns.get(userId) || [];
  }

  /**
   * Clears context data for user (privacy compliance)
   */
  public async clearUserContext(userId: string): Promise<void> {
    this.contextCache.delete(userId);
    this.contextHistory.delete(userId);
    this.contextPatterns.delete(userId);
    
    // Clear prediction cache for user
    const keysToDelete = Array.from(this.predictionCache.keys()).filter(key => key.startsWith(userId));
    keysToDelete.forEach(key => this.predictionCache.delete(key));

    this.eventBus.emit('context:cleared', {
      userId,
      timestamp: new Date()
    });
  }

  // Private implementation methods

  private setupEventListeners(): void {
    // Listen for sensor updates
    this.eventBus.on('sensor:update', async (data: any) => {
      await this.handleSensorUpdate(data);
    });

    // Listen for device state changes
    this.eventBus.on('device:state:changed', async (data: any) => {
      await this.handleDeviceStateChange(data);
    });

    // Listen for user activity changes
    this.eventBus.on('user:activity:changed', async (data: any) => {
      await this.handleActivityChange(data);
    });

    // Listen for system events
    this.eventBus.on('system:time:changed', async () => {
      await this.handleTimeChange();
    });
  }

  private setupPeriodicTasks(): void {
    // Periodic cache cleanup
    setInterval(() => {
      this.cleanupCaches();
    }, 300000); // Every 5 minutes

    // Periodic pattern analysis
    setInterval(() => {
      this.updateAllContextPatterns();
    }, 600000); // Every 10 minutes

    // Periodic sensor health check
    setInterval(() => {
      this.sensorManager.performHealthCheck();
    }, 900000); // Every 15 minutes
  }

  private async aggregateTemporalContext(): Promise<TemporalContext> {
    const now = new Date();
    
    return {
      timeOfDay: this.getTimeOfDay(now),
      dayOfWeek: this.getDayOfWeek(now),
      season: this.getSeason(now),
      isHoliday: await this.checkIfHoliday(now),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      relativeToSchedule: await this.getScheduleRelation(now)
    };
  }

  private async aggregateSpatialContext(userId: string): Promise<any> {
    // Get location from various sources
    const location = await this.sensorManager.getCurrentLocation(userId);
    const movement = await this.sensorManager.getMovementContext(userId);
    const proximity = await this.sensorManager.getProximityContext(userId);
    const accessibility = await this.getAccessibilityContext(userId);

    return {
      location,
      movement,
      proximity,
      accessibility
    };
  }

  private async aggregateDeviceContext(userId: string): Promise<DeviceContext> {
    // Get device information from system
    const deviceInfo = await this.getDeviceInformation(userId);
    
    return {
      deviceType: deviceInfo.type || DeviceType.SMART_DISPLAY,
      screenSize: deviceInfo.screenSize || ScreenSize.MEDIUM,
      inputMethod: deviceInfo.inputMethod || InputMethod.VOICE,
      connectivity: deviceInfo.connectivity || ConnectivityStatus.ONLINE
    };
  }

  private async aggregateActivityContext(userId: string): Promise<any> {
    // Infer activity from sensors and user behavior
    const currentActivity = await this.sensorManager.inferCurrentActivity(userId);
    const activityLevel = await this.sensorManager.getActivityLevel(userId);
    const focus = await this.inferFocusLevel(userId);
    const interruptions = await this.getRecentInterruptions(userId);

    return {
      currentActivity,
      activityLevel,
      focus,
      multitasking: interruptions.length > 1,
      interruptions
    };
  }

  private async aggregateSocialContext(userId: string): Promise<SocialContext> {
    // Get social context from presence sensors and user data
    const presentUsers = await this.sensorManager.getPresentUsers(userId);
    const familyMembers = await this.getFamilyMembersPresent(userId);
    const guestPresent = await this.sensorManager.detectGuests(userId);
    const socialActivity = await this.inferSocialActivity(presentUsers, familyMembers);

    return {
      presentUsers,
      familyMembers,
      guestPresent,
      socialActivity
    };
  }

  private async aggregateEnvironmentalContext(userId: string): Promise<EnvironmentalContext> {
    // Get environmental data from smart home sensors
    const location = await this.sensorManager.getCurrentLocation(userId);
    const weather = await this.sensorManager.getWeatherContext(userId);
    const lighting = await this.sensorManager.getLightingContext(userId);
    const noise = await this.sensorManager.getNoiseContext(userId);
    const temperature = await this.sensorManager.getTemperature(userId);

    return {
      location,
      weather,
      lighting,
      noise,
      temperature
    };
  }

  private async aggregateHistoricalContext(userId: string): Promise<any> {
    const history = this.contextHistory.get(userId) || [];
    const recentHistory = history.slice(-10); // Last 10 contexts
    
    return {
      recentContexts: recentHistory,
      patterns: await this.getContextPatterns(userId),
      trends: await this.getRecentTrends(userId)
    };
  }

  private isCacheValid(timestamp: Date): boolean {
    return Date.now() - timestamp.getTime() < this.CACHE_TTL;
  }

  private async addToHistory(userId: string, context: UserContext): Promise<void> {
    const history = this.contextHistory.get(userId) || [];
    
    const historicalContext: HistoricalContext = {
      timestamp: context.timestamp,
      context,
      significance: this.calculateContextSignificance(context),
      events: []
    };

    history.push(historicalContext);
    
    // Maintain history size limit
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    this.contextHistory.set(userId, history);
  }

  private validateContextUpdate(update: ContextUpdate): void {
    if (!update.updateId || !update.timestamp || !update.source) {
      throw new Error('Invalid context update: missing required fields');
    }
    
    if (!update.changes || update.changes.length === 0) {
      throw new Error('Invalid context update: no changes specified');
    }
    
    if (update.confidence < 0 || update.confidence > 1) {
      throw new Error('Invalid context update: confidence must be between 0 and 1');
    }
  }

  private async applyContextChanges(context: UserContext, changes: ContextChange[]): Promise<UserContext> {
    const updatedContext = { ...context };
    
    changes.forEach(change => {
      this.applyContextChange(updatedContext, change);
    });
    
    updatedContext.timestamp = new Date();
    return updatedContext;
  }

  private applyContextChange(context: UserContext, change: ContextChange): void {
    const path = change.contextType.split('.');
    let target: any = context;
    
    // Navigate to the target property
    for (let i = 0; i < path.length - 1; i++) {
      if (!target[path[i]]) {
        target[path[i]] = {};
      }
      target = target[path[i]];
    }
    
    // Apply the change
    const finalKey = path[path.length - 1];
    switch (change.changeType) {
      case ChangeType.ADDITION:
      case ChangeType.MODIFICATION:
      case ChangeType.REPLACEMENT:
        target[finalKey] = change.newValue;
        break;
      case ChangeType.REMOVAL:
        delete target[finalKey];
        break;
    }
  }

  private async updateContextPatterns(userId: string, context: UserContext, changes: ContextChange[]): Promise<void> {
    const patterns = this.contextPatterns.get(userId) || [];
    
    // Analyze new patterns from changes
    const newPatterns = await this.extractPatternsFromChanges(changes, context);
    
    // Merge with existing patterns
    const mergedPatterns = this.mergeContextPatterns(patterns, newPatterns);
    
    this.contextPatterns.set(userId, mergedPatterns);
  }

  private emitContextChangeEvents(userId: string, changes: ContextChange[], context: UserContext): void {
    changes.forEach(change => {
      this.eventBus.emit('context:change', {
        userId,
        change,
        context,
        timestamp: new Date()
      });
      
      // Emit specific change type events
      if (change.impact === ChangeImpact.HIGH || change.impact === ChangeImpact.CRITICAL) {
        this.eventBus.emit('context:significant:change', {
          userId,
          change,
          context,
          timestamp: new Date()
        });
      }
    });
  }

  private invalidatePredictionCache(userId: string): void {
    const keysToDelete = Array.from(this.predictionCache.keys()).filter(key => key.startsWith(userId));
    keysToDelete.forEach(key => this.predictionCache.delete(key));
  }

  // Helper methods for context aggregation

  private getTimeOfDay(date: Date): TimeOfDay {
    const hour = date.getHours();
    if (hour < 6) return TimeOfDay.LATE_NIGHT;
    if (hour < 9) return TimeOfDay.EARLY_MORNING;
    if (hour < 12) return TimeOfDay.MORNING;
    if (hour < 14) return TimeOfDay.EARLY_AFTERNOON;
    if (hour < 18) return TimeOfDay.AFTERNOON;
    if (hour < 22) return TimeOfDay.EVENING;
    return TimeOfDay.NIGHT;
  }

  private getDayOfWeek(date: Date): DayOfWeek {
    const days = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
    ];
    return days[date.getDay()];
  }

  private getSeason(date: Date): Season {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return Season.SPRING;
    if (month >= 5 && month <= 7) return Season.SUMMER;
    if (month >= 8 && month <= 10) return Season.FALL;
    return Season.WINTER;
  }

  private async checkIfHoliday(date: Date): Promise<boolean> {
    // Simple holiday check - in practice would use a holiday API
    const month = date.getMonth();
    const day = date.getDate();
    
    // Check for major holidays
    if (month === 11 && day === 25) return true; // Christmas
    if (month === 0 && day === 1) return true; // New Year
    if (month === 6 && day === 4) return true; // Independence Day
    
    return false;
  }

  private async getScheduleRelation(date: Date): Promise<ScheduleRelation> {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    
    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return ScheduleRelation.WEEKEND;
    }
    
    // Weekday schedule
    if (hour < 9) return ScheduleRelation.BEFORE_WORK;
    if (hour >= 9 && hour < 17) return ScheduleRelation.DURING_WORK;
    if (hour >= 17) return ScheduleRelation.AFTER_WORK;
    
    return ScheduleRelation.FREE_TIME;
  }

  private calculateContextSignificance(context: UserContext): number {
    // Calculate significance based on context uniqueness and importance
    let significance = 0.5; // Base significance
    
    // Increase significance for unusual times
    if (context.temporal.timeOfDay === TimeOfDay.LATE_NIGHT) {
      significance += 0.2;
    }
    
    // Increase significance for social contexts
    if (context.social.guestPresent || context.social.familyMembers.length > 2) {
      significance += 0.3;
    }
    
    return Math.min(significance, 1.0);
  }

  private cleanupCaches(): void {
    const now = Date.now();
    
    // Clean context cache
    for (const [userId, context] of this.contextCache) {
      if (now - context.timestamp.getTime() > this.CACHE_TTL) {
        this.contextCache.delete(userId);
      }
    }
    
    // Clean prediction cache
    for (const [key, prediction] of this.predictionCache) {
      if (now - prediction.predictedContext.timestamp.getTime() > this.PREDICTION_CACHE_TTL) {
        this.predictionCache.delete(key);
      }
    }
  }

  private generatePredictionId(userId: string, timeHorizon: number): string {
    return `pred_${userId}_${timeHorizon}_${Date.now()}`;
  }

  // Placeholder methods for full implementation
  private async handleSensorUpdate(data: any): Promise<void> {
    // Handle sensor updates
  }

  private async handleDeviceStateChange(data: any): Promise<void> {
    // Handle device state changes
  }

  private async handleActivityChange(data: any): Promise<void> {
    // Handle activity changes
  }

  private async handleTimeChange(): Promise<void> {
    // Handle time changes (e.g., daylight saving time)
  }

  private validateContextSource(source: ContextSource): void {
    if (!source.sourceId || !source.type) {
      throw new Error('Invalid context source: missing required fields');
    }
  }

  private setupSourceEventListeners(source: ContextSource): void {
    // Set up event listeners for the source
  }

  private async analyzeContextPatterns(history: HistoricalContext[]): Promise<ContextPattern[]> {
    // Analyze patterns in context history
    return [];
  }

  private async calculateContextTrends(history: HistoricalContext[], timeRange: TimeRange): Promise<ContextTrend[]> {
    // Calculate trends in context data
    return [];
  }

  private async generatePredictionFactors(history: HistoricalContext[], patterns: ContextPattern[], timeHorizon: number): Promise<PredictionFactor[]> {
    // Generate factors for context prediction
    return [];
  }

  private async generateContextPrediction(userId: string, factors: PredictionFactor[], timeHorizon: number): Promise<UserContext> {
    // Generate predicted context
    return await this.getCurrentContext(userId);
  }

  private calculatePredictionConfidence(factors: PredictionFactor[], patterns: ContextPattern[]): number {
    return 0.7; // Placeholder
  }

  private async generateAlternativeContexts(predictedContext: UserContext, factors: PredictionFactor[]): Promise<AlternativeContext[]> {
    // Generate alternative context scenarios
    return [];
  }

  private async updateAllContextPatterns(): Promise<void> {
    // Update patterns for all users
  }

  private async getAccessibilityContext(userId: string): Promise<any> {
    return {
      visualImpairment: false,
      hearingImpairment: false,
      mobilityImpairment: false,
      cognitiveImpairment: false,
      assistiveTechnology: []
    };
  }

  private async getDeviceInformation(userId: string): Promise<any> {
    return {
      type: DeviceType.SMART_DISPLAY,
      screenSize: ScreenSize.MEDIUM,
      inputMethod: InputMethod.VOICE,
      connectivity: ConnectivityStatus.ONLINE
    };
  }

  private async inferFocusLevel(userId: string): Promise<any> {
    return 'focused';
  }

  private async getRecentInterruptions(userId: string): Promise<any[]> {
    return [];
  }

  private async getFamilyMembersPresent(userId: string): Promise<FamilyMember[]> {
    return [];
  }

  private async inferSocialActivity(presentUsers: string[], familyMembers: FamilyMember[]): Promise<SocialActivity> {
    if (presentUsers.length === 0 && familyMembers.length === 0) {
      return SocialActivity.ALONE;
    }
    if (familyMembers.length > 0) {
      return SocialActivity.FAMILY_TIME;
    }
    return SocialActivity.ENTERTAINING;
  }

  private async getRecentTrends(userId: string): Promise<any[]> {
    return [];
  }

  private async extractPatternsFromChanges(changes: ContextChange[], context: UserContext): Promise<ContextPattern[]> {
    return [];
  }

  private mergeContextPatterns(existing: ContextPattern[], newPatterns: ContextPattern[]): ContextPattern[] {
    return [...existing, ...newPatterns];
  }
}

/**
 * Smart Home Sensor Manager for environmental context integration
 */
class SmartHomeSensorManager {
  private eventBus: EventEmitter;
  private sensors: Map<string, any> = new Map();

  constructor(eventBus: EventEmitter) {
    this.eventBus = eventBus;
  }

  async initializeSensor(source: ContextSource): Promise<void> {
    // Initialize sensor based on source configuration
    this.sensors.set(source.sourceId, {
      source,
      lastReading: null,
      isHealthy: true
    });
  }

  async getCurrentLocation(userId: string): Promise<LocationContext> {
    return {
      room: 'living_room',
      building: 'home',
      city: 'unknown',
      isHome: true,
      isWork: false,
      isPublic: false
    };
  }

  async getMovementContext(userId: string): Promise<any> {
    return {
      isMoving: false,
      speed: 0,
      direction: 'stationary',
      transportMode: 'stationary'
    };
  }

  async getProximityContext(userId: string): Promise<any> {
    return {
      nearbyDevices: [],
      nearbyPeople: [],
      nearbyLocations: []
    };
  }

  async inferCurrentActivity(userId: string): Promise<any> {
    return 'leisure';
  }

  async getActivityLevel(userId: string): Promise<any> {
    return 'moderate';
  }

  async getPresentUsers(userId: string): Promise<string[]> {
    return [userId];
  }

  async detectGuests(userId: string): Promise<boolean> {
    return false;
  }

  async getWeatherContext(userId: string): Promise<WeatherContext> {
    return {
      condition: WeatherCondition.SUNNY,
      temperature: 22,
      humidity: 50,
      isRaining: false
    };
  }

  async getLightingContext(userId: string): Promise<LightingContext> {
    return {
      brightness: 70,
      isNatural: true,
      colorTemperature: 5000
    };
  }

  async getNoiseContext(userId: string): Promise<NoiseContext> {
    return {
      level: 35,
      type: NoiseType.QUIET,
      isDistracting: false
    };
  }

  async getTemperature(userId: string): Promise<number> {
    return 22;
  }

  performHealthCheck(): void {
    // Check sensor health
    for (const [sensorId, sensor] of this.sensors) {
      // Perform health check logic
      this.eventBus.emit('sensor:health:checked', {
        sensorId,
        isHealthy: sensor.isHealthy,
        timestamp: new Date()
      });
    }
  }
}

/**
 * Context Change Detection utility
 */
class ContextChangeDetector {
  async detectChanges(currentContext: UserContext, update: ContextUpdate): Promise<ContextChange[]> {
    const changes: ContextChange[] = [];
    
    // Convert update changes to context changes
    update.changes.forEach(change => {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        contextType: change.contextType,
        previousValue: change.previousValue,
        newValue: change.newValue,
        changeType: change.changeType,
        impact: this.calculateChangeImpact(change)
      });
    });
    
    return changes;
  }

  private calculateChangeImpact(change: any): ChangeImpact {
    // Simple impact calculation - in practice would be more sophisticated
    if (change.contextType.includes('temporal')) {
      return ChangeImpact.MEDIUM;
    }
    if (change.contextType.includes('environmental')) {
      return ChangeImpact.LOW;
    }
    return ChangeImpact.LOW;
  }
}

// Export the enhanced context aggregator
export { EnhancedContextAggregator as DefaultContextAggregator };