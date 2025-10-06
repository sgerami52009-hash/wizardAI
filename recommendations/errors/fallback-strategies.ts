/**
 * Fallback strategies for recommendation system failures
 * Implements graceful degradation and alternative recommendation approaches
 */

import { Recommendation, UserContext } from '../types';
import { RecommendationType } from '../enums';
import { ErrorCategory, RecommendationError } from './error-types';

export interface FallbackStrategy {
  canHandle(error: RecommendationError): boolean;
  execute(userId: string, context: UserContext, originalRequest: any): Promise<Recommendation[]>;
  getQualityLevel(): QualityLevel;
}

export enum QualityLevel {
  FULL = 'full',
  REDUCED = 'reduced',
  MINIMAL = 'minimal',
  EMERGENCY = 'emergency'
}

export interface FallbackRecommendations {
  recommendations: Recommendation[];
  qualityLevel: QualityLevel;
  fallbackReason: string;
  limitationsMessage: string;
}

export class RuleBasedFallbackStrategy implements FallbackStrategy {
  canHandle(error: RecommendationError): boolean {
    return error.category === ErrorCategory.RECOMMENDATION_GENERATION ||
           error.category === ErrorCategory.LEARNING_SYSTEM;
  }

  async execute(userId: string, context: UserContext, originalRequest: any): Promise<Recommendation[]> {
    // Simple rule-based recommendations when ML models fail
    const recommendations: Recommendation[] = [];
    
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    // Time-based activity recommendations
    if (currentHour >= 6 && currentHour < 12) {
      recommendations.push({
        id: `fallback-morning-${Date.now()}`,
        type: RecommendationType.ACTIVITY,
        title: 'Morning Exercise',
        description: 'Start your day with some light physical activity',
        confidence: 0.6,
        reasoning: ['Morning time detected', 'Physical activity promotes wellness'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'fallback-context',
          engineVersion: '1.0.0-fallback',
          safetyValidated: true,
          privacyCompliant: true,
          fallback: true,
          qualityLevel: QualityLevel.REDUCED,
          category: 'health_wellness'
        } as any
      });
    }
    
    if (currentHour >= 12 && currentHour < 17) {
      recommendations.push({
        id: `fallback-afternoon-${Date.now()}`,
        type: RecommendationType.ACTIVITY,
        title: 'Learning Activity',
        description: 'Engage in educational content or skill development',
        confidence: 0.5,
        reasoning: ['Afternoon productivity time', 'Learning supports development'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'fallback-context',
          engineVersion: '1.0.0-fallback',
          safetyValidated: true,
          privacyCompliant: true,
          fallback: true,
          qualityLevel: QualityLevel.REDUCED,
          category: 'education'
        } as any
      });
    }
    
    if (isWeekend) {
      recommendations.push({
        id: `fallback-weekend-${Date.now()}`,
        type: RecommendationType.ACTIVITY,
        title: 'Family Time',
        description: 'Spend quality time with family members',
        confidence: 0.7,
        reasoning: ['Weekend detected', 'Family bonding is important'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'fallback-context',
          engineVersion: '1.0.0-fallback',
          safetyValidated: true,
          privacyCompliant: true,
          fallback: true,
          qualityLevel: QualityLevel.REDUCED,
          category: 'family'
        } as any
      });
    }
    
    return recommendations;
  }

  getQualityLevel(): QualityLevel {
    return QualityLevel.REDUCED;
  }
}

export class HistoricalFallbackStrategy implements FallbackStrategy {
  canHandle(error: RecommendationError): boolean {
    return error.category === ErrorCategory.CONTEXT_ANALYSIS ||
           error.category === ErrorCategory.RECOMMENDATION_GENERATION;
  }

  async execute(userId: string, context: UserContext, originalRequest: any): Promise<Recommendation[]> {
    // Use historical successful recommendations when context analysis fails
    const recommendations: Recommendation[] = [];
    
    // Simulate historical data lookup (would be from actual storage)
    const historicalPatterns = this.getHistoricalPatterns(userId);
    
    for (const pattern of historicalPatterns) {
      recommendations.push({
        id: `historical-${pattern.type}-${Date.now()}`,
        type: pattern.type,
        title: pattern.title,
        description: `${pattern.description} (based on your previous preferences)`,
        confidence: Math.max(0.3, pattern.confidence * 0.7), // Reduced confidence
        reasoning: ['Based on historical preferences', 'Context analysis unavailable'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'fallback-context',
          engineVersion: '1.0.0-fallback',
          safetyValidated: true,
          privacyCompliant: true,
          fallback: true,
          qualityLevel: QualityLevel.MINIMAL,
          historical: true,
          originalPattern: pattern.id
        } as any
      });
    }
    
    return recommendations.slice(0, 3); // Limit to top 3 historical recommendations
  }

  getQualityLevel(): QualityLevel {
    return QualityLevel.MINIMAL;
  }

  private getHistoricalPatterns(userId: string) {
    // Simplified historical patterns - would be retrieved from storage
    return [
      {
        id: 'hist-1',
        type: RecommendationType.ACTIVITY,
        title: 'Reading Time',
        description: 'Enjoy some quiet reading',
        confidence: 0.8
      },
      {
        id: 'hist-2',
        type: RecommendationType.SCHEDULE,
        title: 'Meal Planning',
        description: 'Plan your meals for the week',
        confidence: 0.7
      }
    ];
  }
}

export class EmergencyFallbackStrategy implements FallbackStrategy {
  canHandle(error: RecommendationError): boolean {
    return true; // Can handle any error as last resort
  }

  async execute(userId: string, context: UserContext, originalRequest: any): Promise<Recommendation[]> {
    // Minimal safe recommendations when all else fails
    return [
      {
        id: `emergency-${Date.now()}`,
        type: RecommendationType.ACTIVITY,
        title: 'Take a Break',
        description: 'Take a moment to relax and recharge',
        confidence: 0.3,
        reasoning: ['System experiencing difficulties', 'Basic wellness recommendation'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'fallback-context',
          engineVersion: '1.0.0-fallback',
          safetyValidated: true,
          privacyCompliant: true,
          fallback: true,
          qualityLevel: QualityLevel.EMERGENCY,
          emergency: true
        } as any
      }
    ];
  }

  getQualityLevel(): QualityLevel {
    return QualityLevel.EMERGENCY;
  }
}

export class FallbackManager {
  private strategies: FallbackStrategy[] = [
    new RuleBasedFallbackStrategy(),
    new HistoricalFallbackStrategy(),
    new EmergencyFallbackStrategy()
  ];

  async getFallbackRecommendations(
    error: RecommendationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<FallbackRecommendations> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(error)) {
        try {
          const recommendations = await strategy.execute(userId, context, originalRequest);
          
          return {
            recommendations,
            qualityLevel: strategy.getQualityLevel(),
            fallbackReason: `${error.category} error: ${error.message}`,
            limitationsMessage: this.getLimitationsMessage(strategy.getQualityLevel())
          };
        } catch (fallbackError) {
          console.warn(`Fallback strategy failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          continue;
        }
      }
    }

    // If all strategies fail, return emergency fallback
    const emergencyStrategy = new EmergencyFallbackStrategy();
    const recommendations = await emergencyStrategy.execute(userId, context, originalRequest);
    
    return {
      recommendations,
      qualityLevel: QualityLevel.EMERGENCY,
      fallbackReason: 'All recommendation systems unavailable',
      limitationsMessage: 'Limited recommendations available due to system issues'
    };
  }

  private getLimitationsMessage(qualityLevel: QualityLevel): string {
    switch (qualityLevel) {
      case QualityLevel.REDUCED:
        return 'Recommendations may be less personalized than usual';
      case QualityLevel.MINIMAL:
        return 'Using basic recommendations based on general patterns';
      case QualityLevel.EMERGENCY:
        return 'Only basic recommendations available due to system issues';
      default:
        return '';
    }
  }
}