/**
 * Contextual Trigger Detector
 * 
 * Implements pattern recognition for contextual events and trigger-based
 * recommendation activation with context validation and uncertainty handling.
 */

import {
  UserContext,
  ContextualTrigger,
  ContextData,
  BehaviorPattern,
  ContextPrediction,
  TimeRange
} from '../types';
import { ContextSource, RecommendationType } from '../enums';

interface TriggerPattern {
  id: string;
  name: string;
  conditions: TriggerCondition[];
  recommendationTypes: RecommendationType[];
  priority: 'low' | 'medium' | 'high';
  cooldownMinutes: number;
  confidence: number;
}

interface TriggerCondition {
  contextType: 'time' | 'location' | 'activity' | 'social' | 'environmental' | 'energy' | 'mood';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_equals' | 'in_range';
  value: any;
  weight: number; // 0-1 scale for condition importance
}

interface TriggerHistory {
  triggerId: string;
  timestamp: Date;
  context: UserContext;
  confidence: number;
  activated: boolean;
}

export class ContextualTriggerDetector {
  private triggerPatterns: TriggerPattern[] = [];
  private triggerHistory: Map<string, TriggerHistory[]> = new Map();
  private behaviorPatterns: Map<string, BehaviorPattern[]> = new Map();
  private uncertaintyThreshold = 0.3; // Minimum confidence required for trigger activation

  constructor() {
    this.initializeDefaultTriggerPatterns();
  }

  private initializeDefaultTriggerPatterns(): void {
    this.triggerPatterns = [
      // Morning routine trigger
      {
        id: 'morning_routine',
        name: 'Morning Routine Optimization',
        conditions: [
          { contextType: 'time', operator: 'in_range', value: [6, 9], weight: 0.8 },
          { contextType: 'location', operator: 'equals', value: 'home', weight: 0.6 },
          { contextType: 'energy', operator: 'equals', value: 'high', weight: 0.4 }
        ],
        recommendationTypes: [RecommendationType.SCHEDULE, RecommendationType.ACTIVITY],
        priority: 'high',
        cooldownMinutes: 60,
        confidence: 0.8
      },

      // Family bonding opportunity
      {
        id: 'family_bonding',
        name: 'Family Bonding Opportunity',
        conditions: [
          { contextType: 'social', operator: 'greater_than', value: 1, weight: 0.9 },
          { contextType: 'activity', operator: 'equals', value: 'interruptible', weight: 0.7 },
          { contextType: 'time', operator: 'in_range', value: [17, 21], weight: 0.5 }
        ],
        recommendationTypes: [RecommendationType.ACTIVITY, RecommendationType.EDUCATIONAL],
        priority: 'high',
        cooldownMinutes: 120,
        confidence: 0.9
      },

      // Learning opportunity
      {
        id: 'learning_opportunity',
        name: 'Educational Content Opportunity',
        conditions: [
          { contextType: 'activity', operator: 'equals', value: 'free_time', weight: 0.8 },
          { contextType: 'energy', operator: 'not_equals', value: 'low', weight: 0.6 },
          { contextType: 'time', operator: 'in_range', value: [9, 17], weight: 0.4 }
        ],
        recommendationTypes: [RecommendationType.EDUCATIONAL],
        priority: 'medium',
        cooldownMinutes: 90,
        confidence: 0.7
      },

      // Outdoor activity trigger
      {
        id: 'outdoor_activity',
        name: 'Outdoor Activity Opportunity',
        conditions: [
          { contextType: 'environmental', operator: 'equals', value: 'sunny', weight: 0.8 },
          { contextType: 'environmental', operator: 'greater_than', value: 15, weight: 0.6 },
          { contextType: 'location', operator: 'equals', value: 'outdoor', weight: 0.9 }
        ],
        recommendationTypes: [RecommendationType.ACTIVITY],
        priority: 'high',
        cooldownMinutes: 180,
        confidence: 0.8
      },

      // Household efficiency trigger
      {
        id: 'household_efficiency',
        name: 'Household Task Optimization',
        conditions: [
          { contextType: 'location', operator: 'equals', value: 'home', weight: 0.8 },
          { contextType: 'energy', operator: 'not_equals', value: 'low', weight: 0.6 },
          { contextType: 'activity', operator: 'equals', value: 'interruptible', weight: 0.7 }
        ],
        recommendationTypes: [RecommendationType.HOUSEHOLD],
        priority: 'medium',
        cooldownMinutes: 240,
        confidence: 0.6
      },

      // Stress reduction trigger
      {
        id: 'stress_reduction',
        name: 'Stress Reduction Opportunity',
        conditions: [
          { contextType: 'mood', operator: 'equals', value: 'stressed', weight: 0.9 },
          { contextType: 'activity', operator: 'equals', value: 'interruptible', weight: 0.7 },
          { contextType: 'energy', operator: 'equals', value: 'low', weight: 0.5 }
        ],
        recommendationTypes: [RecommendationType.ACTIVITY],
        priority: 'high',
        cooldownMinutes: 60,
        confidence: 0.8
      },

      // Weekend planning trigger
      {
        id: 'weekend_planning',
        name: 'Weekend Activity Planning',
        conditions: [
          { contextType: 'time', operator: 'contains', value: 'Friday', weight: 0.8 },
          { contextType: 'time', operator: 'greater_than', value: 15, weight: 0.6 },
          { contextType: 'activity', operator: 'equals', value: 'free_time', weight: 0.5 }
        ],
        recommendationTypes: [RecommendationType.ACTIVITY, RecommendationType.SCHEDULE],
        priority: 'medium',
        cooldownMinutes: 1440, // Once per day
        confidence: 0.7
      }
    ];
  }

  async detectContextualTriggers(userId: string, context: UserContext): Promise<ContextualTrigger[]> {
    const activeTriggers: ContextualTrigger[] = [];

    for (const pattern of this.triggerPatterns) {
      // Check if trigger is in cooldown
      if (this.isInCooldown(userId, pattern.id, pattern.cooldownMinutes)) {
        continue;
      }

      // Evaluate trigger conditions
      const evaluation = await this.evaluateTriggerPattern(pattern, context);
      
      if (evaluation.shouldActivate) {
        const trigger: ContextualTrigger = {
          triggerId: pattern.id,
          triggerType: this.determinePrimaryTriggerType(pattern),
          condition: pattern.name,
          confidence: evaluation.confidence,
          recommendationTypes: pattern.recommendationTypes,
          priority: pattern.priority
        };

        activeTriggers.push(trigger);

        // Record trigger activation
        this.recordTriggerActivation(userId, pattern.id, context, evaluation.confidence, true);
      } else {
        // Record trigger evaluation (not activated)
        this.recordTriggerActivation(userId, pattern.id, context, evaluation.confidence, false);
      }
    }

    // Apply pattern recognition to improve trigger detection
    const enhancedTriggers = await this.enhanceTriggersWithPatterns(userId, activeTriggers, context);

    return enhancedTriggers;
  }

  private async evaluateTriggerPattern(
    pattern: TriggerPattern, 
    context: UserContext
  ): Promise<{ shouldActivate: boolean; confidence: number; uncertainty: number }> {
    let totalWeight = 0;
    let matchedWeight = 0;
    let uncertaintyFactors: number[] = [];

    for (const condition of pattern.conditions) {
      totalWeight += condition.weight;
      
      const evaluation = this.evaluateCondition(condition, context);
      if (evaluation.matches) {
        matchedWeight += condition.weight;
      }
      
      uncertaintyFactors.push(evaluation.uncertainty);
    }

    // Calculate confidence based on matched conditions
    const conditionConfidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    
    // Calculate overall uncertainty
    const avgUncertainty = uncertaintyFactors.reduce((sum, u) => sum + u, 0) / uncertaintyFactors.length;
    
    // Combine pattern confidence with condition matching
    const overallConfidence = (pattern.confidence * conditionConfidence) * (1 - avgUncertainty);
    
    // Trigger activates if confidence is above threshold and uncertainty is acceptable
    const shouldActivate = overallConfidence >= 0.6 && avgUncertainty <= this.uncertaintyThreshold;

    return {
      shouldActivate,
      confidence: overallConfidence,
      uncertainty: avgUncertainty
    };
  }

  private evaluateCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    let matches = false;
    let uncertainty = 0;

    try {
      switch (condition.contextType) {
        case 'time':
          const result = this.evaluateTimeCondition(condition, context);
          matches = result.matches;
          uncertainty = result.uncertainty;
          break;

        case 'location':
          const locationResult = this.evaluateLocationCondition(condition, context);
          matches = locationResult.matches;
          uncertainty = locationResult.uncertainty;
          break;

        case 'activity':
          const activityResult = this.evaluateActivityCondition(condition, context);
          matches = activityResult.matches;
          uncertainty = activityResult.uncertainty;
          break;

        case 'social':
          const socialResult = this.evaluateSocialCondition(condition, context);
          matches = socialResult.matches;
          uncertainty = socialResult.uncertainty;
          break;

        case 'environmental':
          const envResult = this.evaluateEnvironmentalCondition(condition, context);
          matches = envResult.matches;
          uncertainty = envResult.uncertainty;
          break;

        case 'energy':
          const energyResult = this.evaluateEnergyCondition(condition, context);
          matches = energyResult.matches;
          uncertainty = energyResult.uncertainty;
          break;

        case 'mood':
          const moodResult = this.evaluateMoodCondition(condition, context);
          matches = moodResult.matches;
          uncertainty = moodResult.uncertainty;
          break;

        default:
          uncertainty = 1.0; // Unknown condition type
      }
    } catch (error) {
      console.error('Error evaluating condition:', error);
      uncertainty = 1.0;
    }

    return { matches, uncertainty };
  }

  private evaluateTimeCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const hour = context.timestamp.getHours();
    const dayOfWeek = context.environmental.dayOfWeek;
    
    switch (condition.operator) {
      case 'in_range':
        const [start, end] = condition.value as [number, number];
        return {
          matches: hour >= start && hour <= end,
          uncertainty: 0.1 // Time is generally reliable
        };

      case 'equals':
        return {
          matches: hour === condition.value,
          uncertainty: 0.1
        };

      case 'contains':
        return {
          matches: dayOfWeek.toLowerCase().includes(condition.value.toLowerCase()),
          uncertainty: 0.05 // Day of week is very reliable
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateLocationCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const locationType = context.location.type;
    const indoorOutdoor = context.location.indoorOutdoor;
    
    // Location uncertainty depends on GPS accuracy and inference quality
    const baseUncertainty = context.location.coordinates ? 0.15 : 0.4;

    switch (condition.operator) {
      case 'equals':
        if (condition.value === 'outdoor') {
          return {
            matches: indoorOutdoor === 'outdoor',
            uncertainty: baseUncertainty
          };
        }
        return {
          matches: locationType === condition.value,
          uncertainty: baseUncertainty
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateActivityCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const isInterruptible = context.activity.interruptible;
    const hasFreeTime = context.availability.freeTime.length > 0;
    
    // Activity context has moderate uncertainty
    const baseUncertainty = 0.25;

    switch (condition.operator) {
      case 'equals':
        if (condition.value === 'interruptible') {
          return {
            matches: isInterruptible,
            uncertainty: baseUncertainty
          };
        }
        if (condition.value === 'free_time') {
          return {
            matches: hasFreeTime && isInterruptible,
            uncertainty: baseUncertainty
          };
        }
        return { matches: false, uncertainty: 1.0 };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateSocialCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const familyMembersCount = context.social.familyMembersPresent.length;
    
    // Social context has moderate uncertainty
    const baseUncertainty = 0.2;

    switch (condition.operator) {
      case 'greater_than':
        return {
          matches: familyMembersCount > condition.value,
          uncertainty: baseUncertainty
        };

      case 'equals':
        return {
          matches: familyMembersCount === condition.value,
          uncertainty: baseUncertainty
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateEnvironmentalCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const weather = context.environmental.weather;
    
    // Weather data uncertainty
    const baseUncertainty = 0.15;

    switch (condition.operator) {
      case 'equals':
        return {
          matches: weather.condition === condition.value,
          uncertainty: baseUncertainty
        };

      case 'greater_than':
        return {
          matches: weather.temperature > condition.value,
          uncertainty: baseUncertainty
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateEnergyCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const energyLevel = context.energy.level;
    
    // Energy level has higher uncertainty as it's inferred
    const baseUncertainty = 0.35;

    switch (condition.operator) {
      case 'equals':
        return {
          matches: energyLevel === condition.value,
          uncertainty: baseUncertainty
        };

      case 'not_equals':
        return {
          matches: energyLevel !== condition.value,
          uncertainty: baseUncertainty
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private evaluateMoodCondition(
    condition: TriggerCondition, 
    context: UserContext
  ): { matches: boolean; uncertainty: number } {
    const detectedMood = context.mood.detected;
    const moodConfidence = context.mood.confidence;
    
    // Mood has high uncertainty as it's inferred
    const baseUncertainty = Math.max(0.4, 1 - moodConfidence);

    switch (condition.operator) {
      case 'equals':
        return {
          matches: detectedMood === condition.value,
          uncertainty: baseUncertainty
        };

      default:
        return { matches: false, uncertainty: 1.0 };
    }
  }

  private determinePrimaryTriggerType(pattern: TriggerPattern): ContextualTrigger['triggerType'] {
    // Find the condition with the highest weight to determine primary trigger type
    const primaryCondition = pattern.conditions.reduce((max, condition) => 
      condition.weight > max.weight ? condition : max
    );

    switch (primaryCondition.contextType) {
      case 'time': return 'time';
      case 'location': return 'location';
      case 'activity': return 'activity';
      case 'social': return 'social';
      case 'environmental': return 'environmental';
      default: return 'time'; // Default fallback
    }
  }

  private isInCooldown(userId: string, triggerId: string, cooldownMinutes: number): boolean {
    const history = this.triggerHistory.get(userId) || [];
    const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    
    return history.some(record => 
      record.triggerId === triggerId && 
      record.activated && 
      record.timestamp > cutoff
    );
  }

  private recordTriggerActivation(
    userId: string, 
    triggerId: string, 
    context: UserContext, 
    confidence: number, 
    activated: boolean
  ): void {
    if (!this.triggerHistory.has(userId)) {
      this.triggerHistory.set(userId, []);
    }

    const history = this.triggerHistory.get(userId)!;
    history.push({
      triggerId,
      timestamp: new Date(),
      context,
      confidence,
      activated
    });

    // Keep only last 7 days of history
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(record => record.timestamp > sevenDaysAgo);
    this.triggerHistory.set(userId, filteredHistory);
  }

  private async enhanceTriggersWithPatterns(
    userId: string, 
    triggers: ContextualTrigger[], 
    context: UserContext
  ): Promise<ContextualTrigger[]> {
    const userPatterns = this.behaviorPatterns.get(userId) || [];
    
    // Enhance trigger confidence based on user behavior patterns
    return triggers.map(trigger => {
      const relevantPatterns = userPatterns.filter(pattern => 
        pattern.triggers.some(t => t.includes(trigger.triggerType))
      );

      if (relevantPatterns.length > 0) {
        const avgPatternConfidence = relevantPatterns.reduce((sum, p) => sum + p.confidence, 0) / relevantPatterns.length;
        const enhancedConfidence = Math.min(trigger.confidence * (1 + avgPatternConfidence * 0.2), 1.0);
        
        return {
          ...trigger,
          confidence: enhancedConfidence
        };
      }

      return trigger;
    });
  }

  async validateContextualTrigger(trigger: ContextualTrigger, context: UserContext): Promise<boolean> {
    try {
      // Basic validation
      if (!trigger.triggerId || !trigger.triggerType || trigger.confidence < 0 || trigger.confidence > 1) {
        return false;
      }

      // Validate that the trigger makes sense in the current context
      const pattern = this.triggerPatterns.find(p => p.id === trigger.triggerId);
      if (!pattern) {
        return false;
      }

      // Re-evaluate the trigger to ensure it's still valid
      const evaluation = await this.evaluateTriggerPattern(pattern, context);
      
      // Trigger is valid if it would still activate and uncertainty is acceptable
      return evaluation.shouldActivate && evaluation.uncertainty <= this.uncertaintyThreshold;
    } catch (error) {
      console.error('Error validating contextual trigger:', error);
      return false;
    }
  }

  updateBehaviorPatterns(userId: string, patterns: BehaviorPattern[]): void {
    this.behaviorPatterns.set(userId, patterns);
  }

  getTriggerHistory(userId: string, timeRange?: TimeRange): TriggerHistory[] {
    const history = this.triggerHistory.get(userId) || [];
    
    if (!timeRange) {
      return history;
    }

    return history.filter(record => 
      record.timestamp >= timeRange.start && record.timestamp <= timeRange.end
    );
  }

  getTriggerStatistics(userId: string): {
    totalTriggers: number;
    activatedTriggers: number;
    averageConfidence: number;
    topTriggers: { triggerId: string; count: number }[];
  } {
    const history = this.triggerHistory.get(userId) || [];
    const activatedHistory = history.filter(h => h.activated);
    
    const triggerCounts = new Map<string, number>();
    activatedHistory.forEach(record => {
      const count = triggerCounts.get(record.triggerId) || 0;
      triggerCounts.set(record.triggerId, count + 1);
    });

    const topTriggers = Array.from(triggerCounts.entries())
      .map(([triggerId, count]) => ({ triggerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const averageConfidence = activatedHistory.length > 0 
      ? activatedHistory.reduce((sum, h) => sum + h.confidence, 0) / activatedHistory.length 
      : 0;

    return {
      totalTriggers: history.length,
      activatedTriggers: activatedHistory.length,
      averageConfidence,
      topTriggers
    };
  }
}