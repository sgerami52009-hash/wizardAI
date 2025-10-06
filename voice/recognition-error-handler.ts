/**
 * Speech recognition error handling and recovery system
 * Safety: All error messages are child-friendly and encouraging
 * Performance: Implements graceful degradation for low-confidence recognition
 */

import { EventEmitter } from 'events';
import { RecognitionResult } from './interfaces';

export interface ErrorHandlingConfig {
  timeoutDuration: number; // seconds
  pauseDetectionThreshold: number; // seconds
  confidenceThreshold: number;
  maxRetries: number;
  clarificationTimeout: number; // seconds
  degradationThresholds: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface RecognitionError {
  type: 'timeout' | 'low_confidence' | 'audio_quality' | 'processing' | 'safety' | 'network';
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  suggestedAction: string;
  timestamp: Date;
  context?: any;
}

export interface RecoveryAction {
  type: 'retry' | 'clarify' | 'degrade' | 'fallback' | 'notify';
  message: string;
  parameters: Record<string, any>;
  timeout?: number;
}

export interface TimeoutContext {
  startTime: Date;
  lastActivity: Date;
  pauseCount: number;
  totalSilence: number;
  isListening: boolean;
}

export class RecognitionErrorHandler extends EventEmitter {
  private config: ErrorHandlingConfig;
  private timeoutContexts: Map<string, TimeoutContext> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private errorHistory: RecognitionError[] = [];
  private clarificationCallbacks: Map<string, Function> = new Map();

  constructor(config: ErrorHandlingConfig = {
    timeoutDuration: 30,
    pauseDetectionThreshold: 3,
    confidenceThreshold: 0.7,
    maxRetries: 3,
    clarificationTimeout: 10,
    degradationThresholds: {
      low: 0.3,
      medium: 0.5,
      high: 0.7
    }
  }) {
    super();
    this.config = config;
  }

  startTimeoutMonitoring(sessionId: string): void {
    const context: TimeoutContext = {
      startTime: new Date(),
      lastActivity: new Date(),
      pauseCount: 0,
      totalSilence: 0,
      isListening: true
    };

    this.timeoutContexts.set(sessionId, context);
    this.scheduleTimeoutCheck(sessionId);
  }

  updateActivity(sessionId: string, hasAudio: boolean): void {
    const context = this.timeoutContexts.get(sessionId);
    if (!context || !context.isListening) return;

    const now = new Date();
    const timeSinceLastActivity = (now.getTime() - context.lastActivity.getTime()) / 1000;

    if (hasAudio) {
      context.lastActivity = now;
      
      // Check for pause detection
      if (timeSinceLastActivity >= this.config.pauseDetectionThreshold) {
        context.pauseCount++;
        context.totalSilence += timeSinceLastActivity;
        
        this.emit('pause-detected', {
          sessionId,
          pauseDuration: timeSinceLastActivity,
          totalPauses: context.pauseCount
        });

        // Handle significant pause
        if (timeSinceLastActivity >= this.config.pauseDetectionThreshold) {
          this.handlePauseTimeout(sessionId, context);
        }
      }
    }
  }

  private scheduleTimeoutCheck(sessionId: string): void {
    setTimeout(() => {
      this.checkForTimeout(sessionId);
    }, this.config.timeoutDuration * 1000);
  }

  private checkForTimeout(sessionId: string): void {
    const context = this.timeoutContexts.get(sessionId);
    if (!context || !context.isListening) return;

    const now = new Date();
    const totalTime = (now.getTime() - context.startTime.getTime()) / 1000;
    const timeSinceActivity = (now.getTime() - context.lastActivity.getTime()) / 1000;

    if (timeSinceActivity >= this.config.timeoutDuration) {
      this.handleTimeout(sessionId, context, 'total_timeout');
    } else if (context.totalSilence > this.config.timeoutDuration * 0.8) {
      this.handleTimeout(sessionId, context, 'silence_timeout');
    }
  }

  private handlePauseTimeout(sessionId: string, context: TimeoutContext): void {
    const error: RecognitionError = {
      type: 'timeout',
      message: 'User paused during speech recognition',
      userMessage: "I noticed you paused. Should I process what you've said so far?",
      severity: 'low',
      recoverable: true,
      suggestedAction: 'process_partial',
      timestamp: new Date(),
      context: { sessionId, pauseCount: context.pauseCount }
    };

    this.recordError(error);
    
    const recoveryAction: RecoveryAction = {
      type: 'clarify',
      message: "Should I process what you've said so far, or would you like to continue?",
      parameters: { 
        sessionId,
        options: ['process', 'continue', 'start_over']
      },
      timeout: this.config.clarificationTimeout
    };

    this.emit('pause-timeout', { error, recoveryAction });
  }

  private handleTimeout(sessionId: string, context: TimeoutContext, timeoutType: string): void {
    const error: RecognitionError = {
      type: 'timeout',
      message: `Speech recognition timeout: ${timeoutType}`,
      userMessage: "I didn't hear anything for a while. Let's try again!",
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'retry',
      timestamp: new Date(),
      context: { sessionId, timeoutType, totalTime: context.totalSilence }
    };

    this.recordError(error);
    this.stopTimeoutMonitoring(sessionId);

    const recoveryAction: RecoveryAction = {
      type: 'retry',
      message: "Let's try again! I'm listening.",
      parameters: { sessionId, resetSession: true }
    };

    this.emit('timeout', { error, recoveryAction });
  }

  stopTimeoutMonitoring(sessionId: string): void {
    const context = this.timeoutContexts.get(sessionId);
    if (context) {
      context.isListening = false;
    }
  }

  handleLowConfidence(
    sessionId: string, 
    result: RecognitionResult, 
    userId?: string
  ): RecoveryAction {
    const confidence = result.confidence;
    const retryCount = this.retryCounters.get(sessionId) || 0;

    // Determine confidence level and appropriate response
    let confidenceLevel: 'low' | 'medium' | 'high';
    if (confidence < this.config.degradationThresholds.low) {
      confidenceLevel = 'low';
    } else if (confidence < this.config.degradationThresholds.medium) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'high';
    }

    const error: RecognitionError = {
      type: 'low_confidence',
      message: `Low confidence recognition: ${confidence}`,
      userMessage: this.getConfidenceErrorMessage(confidenceLevel, retryCount),
      severity: confidenceLevel === 'low' ? 'high' : 'medium',
      recoverable: retryCount < this.config.maxRetries,
      suggestedAction: this.getSuggestedAction(confidenceLevel, retryCount),
      timestamp: new Date(),
      context: { sessionId, confidence, retryCount, recognizedText: result.text }
    };

    this.recordError(error);

    // Increment retry counter
    this.retryCounters.set(sessionId, retryCount + 1);

    return this.createRecoveryAction(error, result);
  }

  private getConfidenceErrorMessage(level: 'low' | 'medium' | 'high', retryCount: number): string {
    const messages = {
      low: [
        "I didn't catch that clearly. Could you try again?",
        "I'm having trouble understanding. Could you speak a bit louder?",
        "Let's try once more. Please speak clearly and slowly."
      ],
      medium: [
        "I think I heard you, but I'm not sure. Could you repeat that?",
        "I want to make sure I got that right. Could you say it again?",
        "Just to be sure, could you repeat what you said?"
      ],
      high: [
        "I almost got that. Could you try again?",
        "I heard most of it. Could you repeat the last part?",
        "One more time, please?"
      ]
    };

    const levelMessages = messages[level];
    const messageIndex = Math.min(retryCount, levelMessages.length - 1);
    return levelMessages[messageIndex];
  }

  private getSuggestedAction(level: 'low' | 'medium' | 'high', retryCount: number): string {
    if (retryCount >= this.config.maxRetries) {
      return 'fallback';
    }

    switch (level) {
      case 'low':
        return retryCount === 0 ? 'retry' : 'clarify';
      case 'medium':
        return 'clarify';
      case 'high':
        return 'retry';
      default:
        return 'retry';
    }
  }

  private createRecoveryAction(error: RecognitionError, result: RecognitionResult): RecoveryAction {
    switch (error.suggestedAction) {
      case 'retry':
        return {
          type: 'retry',
          message: error.userMessage,
          parameters: { 
            sessionId: error.context?.sessionId,
            improveAudio: true 
          }
        };

      case 'clarify':
        return {
          type: 'clarify',
          message: this.createClarificationMessage(result),
          parameters: {
            sessionId: error.context?.sessionId,
            possibleTexts: result.alternatives || [result.text],
            confidence: result.confidence
          },
          timeout: this.config.clarificationTimeout
        };

      case 'degrade':
        return {
          type: 'degrade',
          message: "I'll do my best with what I heard.",
          parameters: {
            sessionId: error.context?.sessionId,
            degradedResult: result,
            warningShown: true
          }
        };

      case 'fallback':
        return {
          type: 'fallback',
          message: "Let's try a different way. You can type your message or try speaking again later.",
          parameters: {
            sessionId: error.context?.sessionId,
            enableTextInput: true,
            suggestAlternatives: true
          }
        };

      default:
        return {
          type: 'notify',
          message: error.userMessage,
          parameters: { sessionId: error.context?.sessionId }
        };
    }
  }

  private createClarificationMessage(result: RecognitionResult): string {
    if (result.alternatives && result.alternatives.length > 0) {
      const topAlternatives = result.alternatives.slice(0, 2);
      return `Did you say "${result.text}" or "${topAlternatives[0]}"?`;
    } else {
      return `Did you say "${result.text}"?`;
    }
  }

  handleProcessingError(sessionId: string, error: Error, context?: any): RecoveryAction {
    const recognitionError: RecognitionError = {
      type: 'processing',
      message: `Processing error: ${error.message}`,
      userMessage: "Something went wrong while I was listening. Let's try again!",
      severity: 'high',
      recoverable: true,
      suggestedAction: 'retry',
      timestamp: new Date(),
      context: { sessionId, originalError: error.message, ...context }
    };

    this.recordError(recognitionError);

    return {
      type: 'retry',
      message: recognitionError.userMessage,
      parameters: { 
        sessionId,
        resetAudio: true,
        clearBuffer: true
      }
    };
  }

  handleAudioQualityError(sessionId: string, qualityMetrics: any): RecoveryAction {
    const error: RecognitionError = {
      type: 'audio_quality',
      message: 'Poor audio quality detected',
      userMessage: this.getAudioQualityMessage(qualityMetrics),
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'retry',
      timestamp: new Date(),
      context: { sessionId, qualityMetrics }
    };

    this.recordError(error);

    return {
      type: 'retry',
      message: error.userMessage,
      parameters: {
        sessionId,
        adjustAudioSettings: true,
        qualityMetrics
      }
    };
  }

  private getAudioQualityMessage(qualityMetrics: any): string {
    if (qualityMetrics.volume && qualityMetrics.volume < 0.1) {
      return "I can barely hear you. Could you speak a bit louder?";
    }
    
    if (qualityMetrics.noiseLevel && qualityMetrics.noiseLevel > 0.7) {
      return "There's a lot of background noise. Could you try speaking in a quieter place?";
    }
    
    if (qualityMetrics.clarity && qualityMetrics.clarity < 0.3) {
      return "The audio isn't very clear. Could you speak closer to the microphone?";
    }
    
    return "I'm having trouble with the audio quality. Could you try speaking more clearly?";
  }

  handleSafetyError(sessionId: string, blockedContent: string, reason: string): RecoveryAction {
    const error: RecognitionError = {
      type: 'safety',
      message: `Content blocked: ${reason}`,
      userMessage: "Let's talk about something else. What would you like to know?",
      severity: 'high',
      recoverable: true,
      suggestedAction: 'clarify',
      timestamp: new Date(),
      context: { sessionId, blockedContent, reason }
    };

    this.recordError(error);

    return {
      type: 'clarify',
      message: error.userMessage,
      parameters: {
        sessionId,
        suggestTopics: true,
        blockReason: 'safety'
      }
    };
  }

  implementGracefulDegradation(
    sessionId: string, 
    result: RecognitionResult, 
    targetConfidence: number
  ): { degradedResult: RecognitionResult; warnings: string[] } {
    const warnings: string[] = [];
    const degradedResult = { ...result };

    // Apply confidence-based degradation
    if (result.confidence < targetConfidence) {
      // Reduce alternative suggestions for low confidence
      if (result.confidence < this.config.degradationThresholds.low) {
        degradedResult.alternatives = [];
        warnings.push("Low confidence - alternatives removed");
      } else if (result.confidence < this.config.degradationThresholds.medium) {
        degradedResult.alternatives = result.alternatives?.slice(0, 1) || [];
        warnings.push("Medium confidence - limited alternatives");
      }

      // Add uncertainty markers to text
      if (result.confidence < this.config.degradationThresholds.medium) {
        degradedResult.text = `[uncertain] ${result.text}`;
        warnings.push("Uncertainty marker added");
      }
    }

    // Log degradation event
    const error: RecognitionError = {
      type: 'low_confidence',
      message: 'Graceful degradation applied',
      userMessage: 'I processed your request with lower confidence',
      severity: 'low',
      recoverable: false,
      suggestedAction: 'degrade',
      timestamp: new Date(),
      context: { 
        sessionId, 
        originalConfidence: result.confidence, 
        targetConfidence,
        warnings 
      }
    };

    this.recordError(error);

    return { degradedResult, warnings };
  }

  private recordError(error: RecognitionError): void {
    this.errorHistory.push(error);
    
    // Keep only recent errors (last 100)
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-100);
    }

    this.emit('error-recorded', error);
  }

  getErrorHistory(sessionId?: string): RecognitionError[] {
    if (sessionId) {
      return this.errorHistory.filter(error => 
        error.context?.sessionId === sessionId
      );
    }
    return [...this.errorHistory];
  }

  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
  } {
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let recoverableErrors = 0;

    for (const error of this.errorHistory) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      
      if (error.recoverable) {
        recoverableErrors++;
      }
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recoverySuccessRate: this.errorHistory.length > 0 ? recoverableErrors / this.errorHistory.length : 1
    };
  }

  clearSession(sessionId: string): void {
    this.timeoutContexts.delete(sessionId);
    this.retryCounters.delete(sessionId);
    this.clarificationCallbacks.delete(sessionId);
  }

  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  getConfig(): ErrorHandlingConfig {
    return { ...this.config };
  }
}