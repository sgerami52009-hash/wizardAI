/**
 * Context recovery mechanisms for sensor failures and data inconsistencies
 * Provides alternative context sources and validation
 */

import { UserContext, ContextData } from '../types';
import { ContextError } from './error-types';

export interface ContextRecoveryStrategy {
  canRecover(error: ContextError): boolean;
  recover(userId: string, failedContext: Partial<UserContext>): Promise<UserContext>;
  getConfidenceLevel(): number;
}

export interface ContextRecovery {
  context: UserContext;
  confidenceLevel: number;
  recoveryMethod: string;
  limitations: string[];
}

export class HistoricalContextRecovery implements ContextRecoveryStrategy {
  canRecover(error: ContextError): boolean {
    return error.sensorType !== 'all_sensors';
  }

  async recover(userId: string, failedContext: Partial<UserContext>): Promise<UserContext> {
    // Use historical context patterns when sensors fail
    const historicalContext = await this.getHistoricalContext(userId);
    const currentTime = new Date();
    
    return {
      userId,
      timestamp: currentTime,
      location: failedContext.location || historicalContext.location || {
        type: 'home',
        coordinates: undefined,
        indoorOutdoor: 'indoor'
      },
      activity: failedContext.activity || historicalContext.activity || {
        currentActivity: 'unknown',
        interruptible: true
      },
      availability: failedContext.availability || this.estimateAvailability(currentTime),
      mood: failedContext.mood || historicalContext.mood || {
        detected: 'calm',
        confidence: 0.3,
        source: 'inferred'
      },
      energy: failedContext.energy || historicalContext.energy || {
        level: 'medium',
        trend: 'stable'
      },
      social: failedContext.social || historicalContext.social || {
        familyMembersPresent: [],
        socialSetting: 'alone',
        groupActivity: false
      },
      environmental: failedContext.environmental || this.getDefaultEnvironmental(),
      preferences: failedContext.preferences || historicalContext.preferences || {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'medium',
          aloneTime: 'medium',
          groupActivities: 'acceptable'
        }
      }
    };
  }

  getConfidenceLevel(): number {
    return 0.6;
  }

  private async getHistoricalContext(userId: string): Promise<Partial<UserContext>> {
    // Simulate historical context lookup
    const currentHour = new Date().getHours();
    
    return {
      location: {
        type: 'home',
        coordinates: undefined,
        indoorOutdoor: 'indoor'
      },
      activity: {
        currentActivity: currentHour < 9 ? 'morning_routine' : 
                        currentHour < 17 ? 'work_study' : 'leisure',
        interruptible: true
      },
      mood: {
        detected: 'calm',
        confidence: 0.5,
        source: 'inferred'
      },
      energy: {
        level: currentHour < 12 ? 'high' : 'medium',
        trend: 'stable'
      },
      social: {
        familyMembersPresent: ['family'],
        socialSetting: 'family',
        groupActivity: false
      },
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'high',
          aloneTime: 'medium',
          groupActivities: 'preferred'
        }
      }
    };
  }

  private estimateAvailability(currentTime: Date) {
    const hour = currentTime.getHours();
    const isWeekend = [0, 6].includes(currentTime.getDay());
    
    return {
      freeTime: isWeekend || hour < 9 || hour > 17 ? 
        [{ start: currentTime, end: new Date(currentTime.getTime() + 4 * 60 * 60 * 1000) }] : [],
      busyTime: isWeekend ? [] : 
        [{ start: new Date(currentTime.getTime() + 60 * 60 * 1000), end: new Date(currentTime.getTime() + 8 * 60 * 60 * 1000) }],
      flexibleTime: [],
      energyLevel: {
        level: (hour < 12 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
        trend: 'stable' as const
      }
    };
  }

  private getDefaultEnvironmental() {
    const now = new Date();
    return {
      weather: {
        condition: 'sunny' as const,
        temperature: 20,
        humidity: 50,
        windSpeed: 5,
        uvIndex: 3
      },
      timeOfDay: now.getHours() < 12 ? 'morning' as const : 
                 now.getHours() < 17 ? 'afternoon' as const : 'evening' as const,
      season: 'summer' as const,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
      isHoliday: false
    };
  }
}

export class MultiSourceContextRecovery implements ContextRecoveryStrategy {
  canRecover(error: ContextError): boolean {
    return true; // Can attempt recovery for any context error
  }

  async recover(userId: string, failedContext: Partial<UserContext>): Promise<UserContext> {
    // Combine multiple context sources for validation
    const sources = await this.gatherAlternativeSources(userId);
    const validatedContext = this.validateAndMerge(sources, failedContext);
    
    return validatedContext;
  }

  getConfidenceLevel(): number {
    return 0.7;
  }

  private async gatherAlternativeSources(userId: string) {
    // Gather context from multiple sources
    return {
      calendar: await this.getCalendarContext(userId),
      device: await this.getDeviceContext(userId),
      family: await this.getFamilyContext(userId),
      schedule: await this.getScheduleContext(userId)
    };
  }

  private validateAndMerge(sources: any, failedContext: Partial<UserContext>): UserContext {
    const currentTime = new Date();
    
    // Use consensus from multiple sources
    return {
      userId: failedContext.userId || 'unknown',
      timestamp: currentTime,
      location: this.selectBestLocation(sources, failedContext.location),
      activity: this.selectBestActivity(sources, failedContext.activity),
      availability: this.selectBestAvailability(sources, failedContext.availability),
      mood: failedContext.mood || this.estimateMood(sources),
      energy: failedContext.energy || this.estimateEnergy(sources),
      social: this.selectBestSocial(sources, failedContext.social),
      environmental: failedContext.environmental || this.getEnvironmentalFromSources(sources),
      preferences: failedContext.preferences || {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'medium',
          aloneTime: 'medium',
          groupActivities: 'acceptable'
        }
      }
    };
  }

  private selectBestLocation(sources: any, failedLocation?: any) {
    if (failedLocation && failedLocation.confidence > 0.5) {
      return failedLocation;
    }
    
    // Use calendar or schedule to infer location
    if (sources.calendar?.location) {
      return {
        type: sources.calendar.location.type,
        coordinates: sources.calendar.location.coordinates,
        address: sources.calendar.location.address,
        confidence: 0.6
      };
    }
    
    return {
      type: 'home',
      coordinates: null,
      address: 'Home (estimated)',
      confidence: 0.4
    };
  }

  private selectBestActivity(sources: any, failedActivity?: any) {
    if (failedActivity && failedActivity.confidence > 0.5) {
      return failedActivity;
    }
    
    // Infer from calendar or schedule
    if (sources.calendar?.currentEvent) {
      return {
        current: sources.calendar.currentEvent.type,
        duration: sources.calendar.currentEvent.duration,
        confidence: 0.6,
        type: 'scheduled'
      };
    }
    
    return {
      current: 'free_time',
      duration: 0,
      confidence: 0.3,
      type: 'passive'
    };
  }

  private selectBestAvailability(sources: any, failedAvailability?: any) {
    if (failedAvailability) {
      return failedAvailability;
    }
    
    const now = new Date();
    return {
      freeTime: !sources.calendar?.hasCurrentEvent ? 
        [{ start: now, end: new Date(now.getTime() + 2 * 60 * 60 * 1000) }] : [],
      busyTime: sources.calendar?.hasCurrentEvent ? 
        [{ start: now, end: sources.calendar?.nextEventStart || new Date(now.getTime() + 60 * 60 * 1000) }] : [],
      flexibleTime: [],
      energyLevel: {
        level: 'medium' as 'high' | 'medium' | 'low',
        trend: 'stable' as const
      }
    };
  }

  private estimateMood(sources: any) {
    // Simple mood estimation based on context
    const hour = new Date().getHours();
    
    return {
      detected: 'calm' as const,
      confidence: 0.4,
      source: 'inferred' as const
    };
  }

  private estimateEnergy(sources: any) {
    const hour = new Date().getHours();
    return {
      level: hour < 12 ? 'high' as const : hour < 18 ? 'medium' as const : 'low' as const,
      trend: 'stable' as const
    };
  }

  private selectBestSocial(sources: any, failedSocial?: any) {
    if (failedSocial) {
      return failedSocial;
    }
    
    return {
      familyMembersPresent: sources.family?.presentMembers || [],
      socialSetting: sources.family?.presentMembers?.length > 1 ? 'family' as const : 'alone' as const,
      groupActivity: sources.calendar?.isGroupEvent || false
    };
  }

  private getEnvironmentalFromSources(sources: any) {
    const now = new Date();
    return {
      weather: sources.device?.weather || {
        condition: 'sunny' as const,
        temperature: 20,
        humidity: 50,
        windSpeed: 5,
        uvIndex: 3
      },
      timeOfDay: now.getHours() < 12 ? 'morning' as const : 
                 now.getHours() < 17 ? 'afternoon' as const : 'evening' as const,
      season: 'summer' as const,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()],
      isHoliday: false
    };
  }

  private async getCalendarContext(userId: string) {
    // Simulate calendar context
    return {
      hasCurrentEvent: false,
      currentEvent: null,
      nextEventStart: null,
      upcomingEvents: [],
      hasUrgentEvents: false,
      location: null,
      isGroupEvent: false
    };
  }

  private async getDeviceContext(userId: string) {
    // Simulate device context
    return {
      weather: null,
      location: null,
      activity: null
    };
  }

  private async getFamilyContext(userId: string) {
    // Simulate family context
    return {
      presentMembers: ['user'],
      groupActivity: false
    };
  }

  private async getScheduleContext(userId: string) {
    // Simulate schedule context
    return {
      currentActivity: null,
      availability: null
    };
  }
}

export class ContextRecoveryManager {
  private strategies: ContextRecoveryStrategy[] = [
    new MultiSourceContextRecovery(),
    new HistoricalContextRecovery()
  ];

  async recoverContext(
    error: ContextError,
    userId: string,
    failedContext: Partial<UserContext>
  ): Promise<ContextRecovery> {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error)) {
        try {
          const recoveredContext = await strategy.recover(userId, failedContext);
          
          return {
            context: recoveredContext,
            confidenceLevel: strategy.getConfidenceLevel(),
            recoveryMethod: strategy.constructor.name,
            limitations: this.getLimitations(strategy.getConfidenceLevel())
          };
        } catch (recoveryError) {
          console.warn(`Context recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
          continue;
        }
      }
    }

    // Fallback to minimal context
    return {
      context: this.createMinimalContext(userId, failedContext),
      confidenceLevel: 0.2,
      recoveryMethod: 'MinimalFallback',
      limitations: ['Very limited context information', 'Recommendations may be generic']
    };
  }

  private createMinimalContext(userId: string, failedContext: Partial<UserContext>): UserContext {
    const now = new Date();
    return {
      userId,
      timestamp: now,
      location: {
        type: 'unknown',
        coordinates: undefined,
        indoorOutdoor: 'indoor'
      },
      activity: {
        currentActivity: 'unknown',
        interruptible: true
      },
      availability: {
        freeTime: [{ start: now, end: new Date(now.getTime() + 60 * 60 * 1000) }],
        busyTime: [],
        flexibleTime: [],
        energyLevel: {
          level: 'medium' as 'high' | 'medium' | 'low',
          trend: 'stable' as const
        }
      },
      mood: {
        detected: 'calm',
        confidence: 0.1,
        source: 'inferred'
      },
      energy: {
        level: 'medium',
        trend: 'stable'
      },
      social: {
        familyMembersPresent: [],
        socialSetting: 'alone',
        groupActivity: false
      },
      environmental: {
        weather: {
          condition: 'sunny',
          temperature: 20,
          humidity: 50,
          windSpeed: 5,
          uvIndex: 3
        },
        timeOfDay: 'afternoon',
        season: 'summer',
        dayOfWeek: 'Monday',
        isHoliday: false
      },
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'medium',
          aloneTime: 'medium',
          groupActivities: 'acceptable'
        }
      }
    };
  }

  private getLimitations(confidenceLevel: number): string[] {
    if (confidenceLevel > 0.7) {
      return ['Some context information may be estimated'];
    } else if (confidenceLevel > 0.5) {
      return ['Context partially recovered', 'Some recommendations may be less accurate'];
    } else {
      return ['Limited context recovery', 'Recommendations may be generic', 'Manual context verification recommended'];
    }
  }
}