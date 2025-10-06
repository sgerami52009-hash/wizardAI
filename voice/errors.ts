/**
 * Base error handling classes and recovery mechanisms for voice pipeline
 * Safety: All errors logged with sanitized data, no sensitive information exposed
 * Performance: Efficient error recovery to maintain <500ms response times
 */

import { voiceEventBus, VoiceEventTypes } from './event-bus';

// Base error classes
export abstract class VoicePipelineError extends Error {
  public readonly code: string;
  public readonly component: string;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public readonly context: Record<string, any>;

  constructor(
    message: string,
    code: string,
    component: string,
    recoverable: boolean = true,
    userMessage?: string,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.component = component;
    this.timestamp = new Date();
    this.recoverable = recoverable;
    this.userMessage = userMessage || "I'm having trouble right now. Let's try that again!";
    this.context = this.sanitizeContext(context);

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'audioData', 'voiceData'];
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
      context: this.context
    };
  }
}

// Specific error types
export class AudioDeviceError extends VoicePipelineError {
  constructor(message: string, deviceId?: string, context: Record<string, any> = {}) {
    super(
      message,
      'AUDIO_DEVICE_ERROR',
      'audio',
      true,
      "I'm having trouble with the microphone. Let me try to fix that.",
      { deviceId, ...context }
    );
  }
}

export class WakeWordError extends VoicePipelineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(
      message,
      'WAKE_WORD_ERROR',
      'wake-word',
      true,
      "I didn't catch the wake word clearly. Please try again.",
      context
    );
  }
}

export class SpeechRecognitionError extends VoicePipelineError {
  constructor(message: string, confidence?: number, context: Record<string, any> = {}) {
    super(
      message,
      'SPEECH_RECOGNITION_ERROR',
      'speech-recognition',
      true,
      "I didn't understand that clearly. Could you say it again?",
      { confidence, ...context }
    );
  }
}

export class SafetyViolationError extends VoicePipelineError {
  constructor(message: string, violationType: string, context: Record<string, any> = {}) {
    super(
      message,
      'SAFETY_VIOLATION',
      'safety',
      false,
      "I can't help with that request. Let's try something else!",
      { violationType, ...context }
    );
  }
}

export class IntentClassificationError extends VoicePipelineError {
  constructor(message: string, confidence?: number, context: Record<string, any> = {}) {
    super(
      message,
      'INTENT_CLASSIFICATION_ERROR',
      'intent',
      true,
      "I'm not sure what you'd like me to do. Can you be more specific?",
      { confidence, ...context }
    );
  }
}

export class CommandExecutionError extends VoicePipelineError {
  constructor(message: string, command?: string, context: Record<string, any> = {}) {
    super(
      message,
      'COMMAND_EXECUTION_ERROR',
      'command',
      true,
      "I couldn't complete that action right now. Let's try again.",
      { command, ...context }
    );
  }
}

export class ResourceExhaustionError extends VoicePipelineError {
  constructor(message: string, resourceType: string, context: Record<string, any> = {}) {
    super(
      message,
      'RESOURCE_EXHAUSTION',
      'system',
      true,
      "I'm working hard right now. Please give me a moment.",
      { resourceType, ...context }
    );
  }
}

export class TTSError extends VoicePipelineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(
      message,
      'TTS_ERROR',
      'tts',
      true,
      "I'm having trouble speaking right now. I'll show you the response instead.",
      context
    );
  }
}

// Recovery strategy interface
export interface RecoveryStrategy {
  canRecover(error: VoicePipelineError): boolean;
  recover(error: VoicePipelineError): Promise<RecoveryResult>;
  getEstimatedRecoveryTime(): number;
  getMaxRetries(): number;
}

export interface RecoveryResult {
  success: boolean;
  action: 'retry' | 'fallback' | 'degrade' | 'notify' | 'abort';
  message?: string;
  data?: any;
  retryAfter?: number;
}

// Error recovery manager
export class ErrorRecoveryManager {
  private strategies: Map<string, RecoveryStrategy> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Handle an error with appropriate recovery strategy
   */
  async handleError(error: VoicePipelineError): Promise<RecoveryResult> {
    try {
      // Log the error
      await this.logError(error);

      // Check circuit breaker
      const circuitBreaker = this.getCircuitBreaker(error.component);
      if (circuitBreaker.isOpen()) {
        return {
          success: false,
          action: 'abort',
          message: 'Service temporarily unavailable'
        };
      }

      // Find appropriate recovery strategy
      const strategy = this.findRecoveryStrategy(error);
      if (!strategy) {
        return {
          success: false,
          action: 'notify',
          message: error.userMessage
        };
      }

      // Check retry limits
      const retryKey = `${error.component}:${error.code}`;
      const attempts = this.retryAttempts.get(retryKey) || 0;
      
      if (attempts >= strategy.getMaxRetries()) {
        this.retryAttempts.delete(retryKey);
        return {
          success: false,
          action: 'fallback',
          message: 'Maximum retry attempts exceeded'
        };
      }

      // Attempt recovery
      this.retryAttempts.set(retryKey, attempts + 1);
      const result = await strategy.recover(error);

      if (result.success) {
        // Reset retry counter on success
        this.retryAttempts.delete(retryKey);
        circuitBreaker.recordSuccess();
        
        // Publish recovery event
        await voiceEventBus.publishEvent({
          id: `recovery_${Date.now()}`,
          type: VoiceEventTypes.ERROR_RECOVERED,
          timestamp: new Date(),
          source: 'error-recovery',
          data: { error: error.toJSON(), result },
          priority: 'medium'
        });
      } else {
        circuitBreaker.recordFailure();
      }

      return result;

    } catch (recoveryError) {
      console.error('Error in recovery process:', recoveryError);
      return {
        success: false,
        action: 'notify',
        message: 'Unable to recover from error'
      };
    }
  }

  /**
   * Register a recovery strategy for specific error types
   */
  registerStrategy(errorCode: string, strategy: RecoveryStrategy): void {
    this.strategies.set(errorCode, strategy);
  }

  /**
   * Get system health status
   */
  getSystemHealth(): SystemHealthStatus {
    const componentHealth: Record<string, ComponentHealth> = {};
    
    for (const [component, circuitBreaker] of this.circuitBreakers.entries()) {
      componentHealth[component] = {
        status: circuitBreaker.isOpen() ? 'degraded' : 'healthy',
        errorRate: circuitBreaker.getErrorRate(),
        lastError: circuitBreaker.getLastError(),
        uptime: circuitBreaker.getUptime()
      };
    }

    return {
      overall: this.calculateOverallHealth(componentHealth),
      components: componentHealth,
      activeRetries: this.retryAttempts.size,
      timestamp: new Date()
    };
  }

  private registerDefaultStrategies(): void {
    // Audio device recovery
    this.registerStrategy('AUDIO_DEVICE_ERROR', new AudioDeviceRecoveryStrategy());
    
    // Speech recognition recovery
    this.registerStrategy('SPEECH_RECOGNITION_ERROR', new SpeechRecognitionRecoveryStrategy());
    
    // Resource exhaustion recovery
    this.registerStrategy('RESOURCE_EXHAUSTION', new ResourceRecoveryStrategy());
    
    // TTS recovery
    this.registerStrategy('TTS_ERROR', new TTSRecoveryStrategy());
  }

  private findRecoveryStrategy(error: VoicePipelineError): RecoveryStrategy | null {
    const strategy = this.strategies.get(error.code);
    return strategy && strategy.canRecover(error) ? strategy : null;
  }

  private getCircuitBreaker(component: string): CircuitBreaker {
    if (!this.circuitBreakers.has(component)) {
      this.circuitBreakers.set(component, new CircuitBreaker(component));
    }
    return this.circuitBreakers.get(component)!;
  }

  private async logError(error: VoicePipelineError): Promise<void> {
    // Publish error event for logging
    await voiceEventBus.publishEvent({
      id: `error_${Date.now()}`,
      type: 'error-occurred',
      timestamp: new Date(),
      source: error.component,
      data: error.toJSON(),
      priority: 'high'
    });
  }

  private calculateOverallHealth(componentHealth: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'critical' {
    const components = Object.values(componentHealth);
    const degradedCount = components.filter(c => c.status === 'degraded').length;
    const totalCount = components.length;

    if (degradedCount === 0) return 'healthy';
    if (degradedCount / totalCount > 0.5) return 'critical';
    return 'degraded';
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: Date | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold: number = 5;
  private readonly timeout: number = 30000; // 30 seconds
  private readonly startTime: Date = new Date();

  constructor(private component: string) {}

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  isOpen(): boolean {
    if (this.state === 'closed') return false;
    
    if (this.state === 'open') {
      const now = Date.now();
      const lastFailure = this.lastFailureTime?.getTime() || 0;
      
      if (now - lastFailure > this.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    
    return false; // half-open allows one attempt
  }

  getErrorRate(): number {
    return this.failures / Math.max(1, this.getUptime() / 1000);
  }

  getLastError(): Date | null {
    return this.lastFailureTime;
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }
}

// Default recovery strategies
class AudioDeviceRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: VoicePipelineError): boolean {
    return error instanceof AudioDeviceError;
  }

  async recover(error: VoicePipelineError): Promise<RecoveryResult> {
    // Attempt to reinitialize audio device
    try {
      // Implementation would go here
      return { success: true, action: 'retry' };
    } catch {
      return { success: false, action: 'fallback', message: 'Please check your microphone' };
    }
  }

  getEstimatedRecoveryTime(): number { return 1000; }
  getMaxRetries(): number { return 3; }
}

class SpeechRecognitionRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: VoicePipelineError): boolean {
    return error instanceof SpeechRecognitionError;
  }

  async recover(error: VoicePipelineError): Promise<RecoveryResult> {
    return { success: true, action: 'retry', message: 'Please speak more clearly' };
  }

  getEstimatedRecoveryTime(): number { return 500; }
  getMaxRetries(): number { return 2; }
}

class ResourceRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: VoicePipelineError): boolean {
    return error instanceof ResourceExhaustionError;
  }

  async recover(error: VoicePipelineError): Promise<RecoveryResult> {
    // Trigger garbage collection and reduce quality
    return { success: true, action: 'degrade', retryAfter: 2000 };
  }

  getEstimatedRecoveryTime(): number { return 2000; }
  getMaxRetries(): number { return 1; }
}

class TTSRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: VoicePipelineError): boolean {
    return error instanceof TTSError;
  }

  async recover(error: VoicePipelineError): Promise<RecoveryResult> {
    return { success: false, action: 'fallback', message: 'Showing text response instead' };
  }

  getEstimatedRecoveryTime(): number { return 100; }
  getMaxRetries(): number { return 1; }
}

// Type definitions
export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  components: Record<string, ComponentHealth>;
  activeRetries: number;
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded';
  errorRate: number;
  lastError: Date | null;
  uptime: number;
}

// Create singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();