/**
 * Comprehensive error recovery manager for the recommendations system
 * Coordinates all error handling and recovery strategies
 */

import { 
  RecommendationError, 
  ErrorCategory, 
  ErrorSeverity,
  GenerationError,
  ContextError,
  LearningError,
  IntegrationError,
  HardwareConstraintError
} from './error-types';
import { FallbackManager, FallbackRecommendations } from './fallback-strategies';
import { ContextRecoveryManager, ContextRecovery } from './context-recovery';
import { Recommendation, UserContext } from '../types';

export interface RecoveryResult {
  success: boolean;
  recommendations?: Recommendation[];
  context?: UserContext;
  qualityLevel?: string;
  errorHandled: boolean;
  fallbackUsed: boolean;
  limitations: string[];
  retryable: boolean;
}

export interface ErrorMetrics {
  errorCount: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
}

export class ErrorRecoveryManager {
  private fallbackManager = new FallbackManager();
  private contextRecoveryManager = new ContextRecoveryManager();
  private errorMetrics: ErrorMetrics = {
    errorCount: 0,
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recoverySuccessRate: 0,
    averageRecoveryTime: 0
  };
  private recoveryAttempts: Array<{ timestamp: Date; success: boolean; duration: number }> = [];

  async handleError(
    error: RecommendationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    this.recordError(error);

    try {
      // Determine recovery strategy based on error type
      const recoveryResult = await this.executeRecovery(error, userId, context, originalRequest);
      
      const duration = Date.now() - startTime;
      this.recordRecoveryAttempt(true, duration);
      
      return recoveryResult;
    } catch (recoveryError) {
      const duration = Date.now() - startTime;
      this.recordRecoveryAttempt(false, duration);
      
      console.error('Error recovery failed:', recoveryError);
      
      return {
        success: false,
        errorHandled: false,
        fallbackUsed: false,
        limitations: ['Error recovery failed', 'System may be experiencing issues'],
        retryable: error.recoverable
      };
    }
  }

  private async executeRecovery(
    error: RecommendationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    switch (error.category) {
      case ErrorCategory.RECOMMENDATION_GENERATION:
        return this.handleGenerationError(error as GenerationError, userId, context, originalRequest);
      
      case ErrorCategory.CONTEXT_ANALYSIS:
        return this.handleContextError(error as ContextError, userId, context, originalRequest);
      
      case ErrorCategory.LEARNING_SYSTEM:
        return this.handleLearningError(error as LearningError, userId, context, originalRequest);
      
      case ErrorCategory.INTEGRATION:
        return this.handleIntegrationError(error as IntegrationError, userId, context, originalRequest);
      
      case ErrorCategory.HARDWARE_CONSTRAINT:
        return this.handleHardwareError(error as HardwareConstraintError, userId, context, originalRequest);
      
      default:
        return this.handleGenericError(error, userId, context, originalRequest);
    }
  }

  private async handleGenerationError(
    error: GenerationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    if (!error.fallbackAvailable) {
      return {
        success: false,
        errorHandled: true,
        fallbackUsed: false,
        limitations: ['No fallback available for this recommendation type'],
        retryable: false
      };
    }

    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    return {
      success: true,
      recommendations: fallbackResult.recommendations,
      qualityLevel: fallbackResult.qualityLevel,
      errorHandled: true,
      fallbackUsed: true,
      limitations: [fallbackResult.limitationsMessage],
      retryable: true
    };
  }

  private async handleContextError(
    error: ContextError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    // First try to recover context
    const contextRecovery = await this.contextRecoveryManager.recoverContext(
      error,
      userId,
      context
    );

    if (contextRecovery.confidenceLevel > 0.3) {
      // Context recovery successful, try recommendations again with recovered context
      try {
        // This would normally call the recommendation system again
        // For now, we'll use fallback with the recovered context
        const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
          error,
          userId,
          contextRecovery.context,
          originalRequest
        );

        return {
          success: true,
          recommendations: fallbackResult.recommendations,
          context: contextRecovery.context,
          qualityLevel: fallbackResult.qualityLevel,
          errorHandled: true,
          fallbackUsed: true,
          limitations: [...contextRecovery.limitations, fallbackResult.limitationsMessage],
          retryable: true
        };
      } catch (retryError) {
        // Fall through to fallback
      }
    }

    // Context recovery failed or insufficient, use fallback
    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    return {
      success: true,
      recommendations: fallbackResult.recommendations,
      qualityLevel: fallbackResult.qualityLevel,
      errorHandled: true,
      fallbackUsed: true,
      limitations: ['Context analysis failed', fallbackResult.limitationsMessage],
      retryable: true
    };
  }

  private async handleLearningError(
    error: LearningError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    // Learning errors typically don't prevent recommendations, just reduce quality
    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    return {
      success: true,
      recommendations: fallbackResult.recommendations,
      qualityLevel: fallbackResult.qualityLevel,
      errorHandled: true,
      fallbackUsed: true,
      limitations: [
        'Learning system unavailable',
        'Recommendations may not improve over time',
        fallbackResult.limitationsMessage
      ],
      retryable: false // Learning errors usually require system intervention
    };
  }

  private async handleIntegrationError(
    error: IntegrationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    // Integration errors affect actionability but not recommendation generation
    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    // Mark recommendations as non-actionable due to integration failure
    const limitedRecommendations = fallbackResult.recommendations.map(rec => ({
      ...rec,
      actionable: false,
      integrationActions: [],
      metadata: {
        ...rec.metadata,
        integrationLimited: true,
        affectedSystem: error.systemName
      }
    }));

    return {
      success: true,
      recommendations: limitedRecommendations,
      qualityLevel: fallbackResult.qualityLevel,
      errorHandled: true,
      fallbackUsed: true,
      limitations: [
        `Integration with ${error.systemName} unavailable`,
        'Recommendations may not be actionable',
        fallbackResult.limitationsMessage
      ],
      retryable: true
    };
  }

  private async handleHardwareError(
    error: HardwareConstraintError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    // Hardware errors require immediate resource management
    if (error.resourceType === 'memory') {
      // Trigger memory cleanup and use minimal recommendations
      await this.performMemoryCleanup();
    }

    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    // Limit recommendations to reduce resource usage
    const limitedRecommendations = fallbackResult.recommendations.slice(0, 2);

    return {
      success: true,
      recommendations: limitedRecommendations,
      qualityLevel: 'minimal',
      errorHandled: true,
      fallbackUsed: true,
      limitations: [
        `Hardware constraint: ${error.resourceType}`,
        'Limited recommendations to preserve system performance',
        fallbackResult.limitationsMessage
      ],
      retryable: false // Hardware errors usually require system intervention
    };
  }

  private async handleGenericError(
    error: RecommendationError,
    userId: string,
    context: UserContext,
    originalRequest: any
  ): Promise<RecoveryResult> {
    const fallbackResult = await this.fallbackManager.getFallbackRecommendations(
      error,
      userId,
      context,
      originalRequest
    );

    return {
      success: true,
      recommendations: fallbackResult.recommendations,
      qualityLevel: fallbackResult.qualityLevel,
      errorHandled: true,
      fallbackUsed: true,
      limitations: ['Unexpected error occurred', fallbackResult.limitationsMessage],
      retryable: error.recoverable
    };
  }

  private async performMemoryCleanup(): Promise<void> {
    // Simulate memory cleanup operations
    console.log('Performing memory cleanup due to hardware constraints');
    
    // In a real implementation, this would:
    // - Clear caches
    // - Reduce model complexity
    // - Limit concurrent operations
    // - Trigger garbage collection
  }

  private recordError(error: RecommendationError): void {
    this.errorMetrics.errorCount++;
    
    if (!this.errorMetrics.errorsByCategory[error.category]) {
      this.errorMetrics.errorsByCategory[error.category] = 0;
    }
    this.errorMetrics.errorsByCategory[error.category]++;
    
    if (!this.errorMetrics.errorsBySeverity[error.severity]) {
      this.errorMetrics.errorsBySeverity[error.severity] = 0;
    }
    this.errorMetrics.errorsBySeverity[error.severity]++;
  }

  private recordRecoveryAttempt(success: boolean, duration: number): void {
    this.recoveryAttempts.push({
      timestamp: new Date(),
      success,
      duration
    });

    // Keep only last 100 attempts
    if (this.recoveryAttempts.length > 100) {
      this.recoveryAttempts = this.recoveryAttempts.slice(-100);
    }

    // Update metrics
    const successfulAttempts = this.recoveryAttempts.filter(a => a.success).length;
    this.errorMetrics.recoverySuccessRate = successfulAttempts / this.recoveryAttempts.length;
    
    const totalDuration = this.recoveryAttempts.reduce((sum, a) => sum + a.duration, 0);
    this.errorMetrics.averageRecoveryTime = totalDuration / this.recoveryAttempts.length;
  }

  getErrorMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  clearMetrics(): void {
    this.errorMetrics = {
      errorCount: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0
    };
    this.recoveryAttempts = [];
  }
}