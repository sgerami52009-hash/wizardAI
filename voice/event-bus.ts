/**
 * Event bus system for voice pipeline component communication
 * Safety: All events logged for audit trail, sensitive data sanitized
 * Performance: Efficient event routing with minimal memory overhead
 */

import { EventEmitter } from 'events';

export interface VoiceEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  target?: string;
  data: any;
  userId?: string;
  sessionId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EventSubscription {
  id: string;
  eventType: string;
  callback: (event: VoiceEvent) => void | Promise<void>;
  filter?: (event: VoiceEvent) => boolean;
  priority: number;
}

export class VoiceEventBus extends EventEmitter {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private eventHistory: VoiceEvent[] = [];
  private maxHistorySize: number = 1000;
  private isLoggingEnabled: boolean = true;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many components to listen
  }

  /**
   * Publish an event to all subscribers
   * @param event The event to publish
   */
  async publishEvent(event: VoiceEvent): Promise<void> {
    try {
      // Sanitize sensitive data before logging
      const sanitizedEvent = this.sanitizeEvent(event);
      
      // Add to history for debugging
      if (this.isLoggingEnabled) {
        this.addToHistory(sanitizedEvent);
      }

      // Get subscribers for this event type
      const subscribers = this.subscriptions.get(event.type) || [];
      
      // Sort by priority (higher number = higher priority)
      const sortedSubscribers = subscribers.sort((a, b) => b.priority - a.priority);

      // Execute callbacks based on priority
      for (const subscription of sortedSubscribers) {
        try {
          // Apply filter if present
          if (subscription.filter && !subscription.filter(event)) {
            continue;
          }

          // Execute callback
          const result = subscription.callback(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          console.error(`Error in event subscriber ${subscription.id}:`, error);
          this.emit('subscriber-error', { subscription, error, event });
        }
      }

      // Emit on EventEmitter for legacy compatibility
      this.emit(event.type, event);
      this.emit('event-published', event);

    } catch (error) {
      console.error('Error publishing event:', error);
      this.emit('publish-error', { event, error });
    }
  }

  /**
   * Subscribe to events of a specific type
   * @param eventType The type of events to subscribe to
   * @param callback The callback function to execute
   * @param options Subscription options
   */
  subscribe(
    eventType: string,
    callback: (event: VoiceEvent) => void | Promise<void>,
    options: {
      filter?: (event: VoiceEvent) => boolean;
      priority?: number;
      id?: string;
    } = {}
  ): string {
    const subscription: EventSubscription = {
      id: options.id || this.generateSubscriptionId(),
      eventType,
      callback,
      filter: options.filter,
      priority: options.priority || 0
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);
    
    this.emit('subscription-added', subscription);
    return subscription.id;
  }

  /**
   * Unsubscribe from events
   * @param subscriptionId The ID of the subscription to remove
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subscribers] of this.subscriptions.entries()) {
      const index = subscribers.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        const removed = subscribers.splice(index, 1)[0];
        this.emit('subscription-removed', removed);
        return true;
      }
    }
    return false;
  }

  /**
   * Get event history for debugging
   * @param filter Optional filter function
   * @param limit Maximum number of events to return
   */
  getEventHistory(
    filter?: (event: VoiceEvent) => boolean,
    limit: number = 100
  ): VoiceEvent[] {
    let events = this.eventHistory;
    
    if (filter) {
      events = events.filter(filter);
    }

    return events.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.emit('history-cleared');
  }

  /**
   * Get current subscriptions for debugging
   */
  getSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.subscriptions);
  }

  /**
   * Enable or disable event logging
   * @param enabled Whether to enable logging
   */
  setLogging(enabled: boolean): void {
    this.isLoggingEnabled = enabled;
  }

  /**
   * Create a scoped event publisher for a specific component
   * @param componentName The name of the component
   */
  createPublisher(componentName: string) {
    return {
      publish: (type: string, data: any, options: Partial<VoiceEvent> = {}) => {
        const event: VoiceEvent = {
          id: this.generateEventId(),
          type,
          timestamp: new Date(),
          source: componentName,
          data,
          priority: 'medium',
          ...options
        };
        return this.publishEvent(event);
      }
    };
  }

  private sanitizeEvent(event: VoiceEvent): VoiceEvent {
    // Create a copy to avoid modifying the original
    const sanitized = { ...event };
    
    // Remove or mask sensitive data
    if (sanitized.data) {
      sanitized.data = this.sanitizeData(sanitized.data);
    }

    return sanitized;
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'audioData', 'voiceData'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      }
    }

    return sanitized;
  }

  private addToHistory(event: VoiceEvent): void {
    this.eventHistory.push(event);
    
    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Event type constants for type safety
export const VoiceEventTypes = {
  // Wake word events
  WAKE_WORD_DETECTED: 'wake-word-detected',
  WAKE_WORD_TIMEOUT: 'wake-word-timeout',
  WAKE_WORD_DETECTOR_STARTED: 'wake-word-detector-started',
  WAKE_WORD_DETECTOR_STOPPED: 'wake-word-detector-stopped',
  WAKE_WORD_MODEL_ADDED: 'wake-word-model-added',
  WAKE_WORD_MODEL_REMOVED: 'wake-word-model-removed',
  WAKE_WORD_MANAGER_INITIALIZED: 'wake-word-manager-initialized',
  WAKE_WORD_ADDED: 'wake-word-added',
  WAKE_WORD_REMOVED: 'wake-word-removed',
  WAKE_WORD_ACTIVATED: 'wake-word-activated',
  WAKE_WORD_DEACTIVATED: 'wake-word-deactivated',
  
  // Speech recognition events
  SPEECH_RECOGNITION_STARTED: 'speech-recognition-started',
  SPEECH_RECOGNITION_PARTIAL: 'speech-recognition-partial',
  SPEECH_RECOGNITION_COMPLETE: 'speech-recognition-complete',
  SPEECH_RECOGNITION_ERROR: 'speech-recognition-error',
  
  // Intent processing events
  INTENT_CLASSIFIED: 'intent-classified',
  INTENT_AMBIGUOUS: 'intent-ambiguous',
  INTENT_UNKNOWN: 'intent-unknown',
  
  // Command execution events
  COMMAND_STARTED: 'command-started',
  COMMAND_COMPLETED: 'command-completed',
  COMMAND_FAILED: 'command-failed',
  
  // Response generation events
  RESPONSE_GENERATED: 'response-generated',
  RESPONSE_SANITIZED: 'response-sanitized',
  
  // TTS events
  TTS_STARTED: 'tts-started',
  TTS_COMPLETED: 'tts-completed',
  TTS_ERROR: 'tts-error',
  
  // Safety events
  CONTENT_BLOCKED: 'content-blocked',
  SAFETY_VIOLATION: 'safety-violation',
  PARENTAL_REVIEW_REQUIRED: 'parental-review-required',
  
  // System events
  PIPELINE_STARTED: 'pipeline-started',
  PIPELINE_STOPPED: 'pipeline-stopped',
  RESOURCE_WARNING: 'resource-warning',
  ERROR_RECOVERED: 'error-recovered',
  
  // User events
  USER_SESSION_STARTED: 'user-session-started',
  USER_SESSION_ENDED: 'user-session-ended',
  USER_PROFILE_UPDATED: 'user-profile-updated'
} as const;

// Create singleton instance
export const voiceEventBus = new VoiceEventBus();