// Learning Engine Event Bus Integration

import { EventEmitter } from 'events';

export interface LearningEventBus {
  emit(event: LearningEvent): Promise<void>;
  subscribe(eventType: LearningEventType, handler: EventHandler): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  getEventHistory(eventType?: LearningEventType, userId?: string): Promise<LearningEvent[]>;
  clearEventHistory(userId?: string): Promise<void>;
}

export class DefaultLearningEventBus implements LearningEventBus {
  private eventEmitter: EventEmitter;
  private eventHistory: LearningEvent[] = [];
  private subscriptions: Map<string, EventSubscription> = new Map();
  private maxHistorySize: number = 10000;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Allow many subscribers
  }

  public async emit(event: LearningEvent): Promise<void> {
    // Add timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Add to history
    this.eventHistory.push(event);
    
    // Limit history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Emit to subscribers
    this.eventEmitter.emit(event.type, event);
    this.eventEmitter.emit('*', event); // Wildcard listeners
  }

  public async subscribe(eventType: LearningEventType, handler: EventHandler): Promise<string> {
    const subscriptionId = this.generateSubscriptionId();
    
    const wrappedHandler = async (event: LearningEvent) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Event handler error for ${eventType}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Emit error event
        await this.emit({
          id: this.generateEventId(),
          type: LearningEventType.ERROR,
          timestamp: new Date(),
          data: {
            originalEvent: event,
            handlerError: errorMessage,
            subscriptionId
          }
        });
      }
    };

    this.eventEmitter.on(eventType, wrappedHandler);
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      eventType,
      handler: wrappedHandler,
      originalHandler: handler,
      createdAt: new Date()
    });

    return subscriptionId;
  }

  public async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.eventEmitter.removeListener(subscription.eventType, subscription.handler);
      this.subscriptions.delete(subscriptionId);
    }
  }

  public async getEventHistory(eventType?: LearningEventType, userId?: string): Promise<LearningEvent[]> {
    let filteredEvents = [...this.eventHistory];

    if (eventType) {
      filteredEvents = filteredEvents.filter(event => event.type === eventType);
    }

    if (userId) {
      filteredEvents = filteredEvents.filter(event => 
        event.userId === userId || 
        (event.data && event.data.userId === userId)
      );
    }

    return filteredEvents;
  }

  public async clearEventHistory(userId?: string): Promise<void> {
    if (userId) {
      this.eventHistory = this.eventHistory.filter(event => 
        event.userId !== userId && 
        (!event.data || event.data.userId !== userId)
      );
    } else {
      this.eventHistory = [];
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Event types and interfaces
export interface LearningEvent {
  id: string;
  type: LearningEventType;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  data: EventData;
  metadata?: EventMetadata;
}

export interface EventData {
  [key: string]: any;
}

export interface EventMetadata {
  source: string;
  version: string;
  priority: EventPriority;
  tags: string[];
  correlationId?: string;
}

export interface EventSubscription {
  id: string;
  eventType: LearningEventType;
  handler: (event: LearningEvent) => Promise<void>;
  originalHandler: EventHandler;
  createdAt: Date;
}

export type EventHandler = (event: LearningEvent) => Promise<void>;

export enum LearningEventType {
  // Model events
  MODEL_TRAINING_STARTED = 'model_training_started',
  MODEL_TRAINING_COMPLETED = 'model_training_completed',
  MODEL_TRAINING_FAILED = 'model_training_failed',
  MODEL_UPDATED = 'model_updated',
  MODEL_VALIDATED = 'model_validated',
  MODEL_OPTIMIZED = 'model_optimized',
  MODEL_BACKED_UP = 'model_backed_up',
  MODEL_RESTORED = 'model_restored',

  // Interaction events
  INTERACTION_CAPTURED = 'interaction_captured',
  INTERACTION_FILTERED = 'interaction_filtered',
  PATTERN_IDENTIFIED = 'pattern_identified',
  PREFERENCE_INFERRED = 'preference_inferred',
  HABIT_DETECTED = 'habit_detected',

  // Decision events
  DECISION_REQUESTED = 'decision_requested',
  DECISION_MADE = 'decision_made',
  RECOMMENDATION_GENERATED = 'recommendation_generated',
  PERSONALIZATION_APPLIED = 'personalization_applied',

  // Privacy events
  PRIVACY_FILTER_APPLIED = 'privacy_filter_applied',
  PRIVACY_VIOLATION_DETECTED = 'privacy_violation_detected',
  DATA_ANONYMIZED = 'data_anonymized',
  DATA_PURGED = 'data_purged',

  // Safety events
  SAFETY_CHECK_PERFORMED = 'safety_check_performed',
  SAFETY_VIOLATION_DETECTED = 'safety_violation_detected',
  PARENTAL_APPROVAL_REQUESTED = 'parental_approval_requested',
  PARENTAL_APPROVAL_RECEIVED = 'parental_approval_received',

  // Performance events
  PERFORMANCE_DEGRADATION_DETECTED = 'performance_degradation_detected',
  RESOURCE_EXHAUSTION_DETECTED = 'resource_exhaustion_detected',
  OPTIMIZATION_TRIGGERED = 'optimization_triggered',
  OPTIMIZATION_COMPLETED = 'optimization_completed',
  OPTIMIZATION_FAILED = 'optimization_failed',

  // Integration events
  SYSTEM_INTEGRATION_STARTED = 'system_integration_started',
  SYSTEM_INTEGRATION_COMPLETED = 'system_integration_completed',
  SYSTEM_INTEGRATION_FAILED = 'system_integration_failed',
  FALLBACK_MODE_ACTIVATED = 'fallback_mode_activated',

  // User events
  USER_FEEDBACK_RECEIVED = 'user_feedback_received',
  USER_PREFERENCE_CHANGED = 'user_preference_changed',
  USER_MODEL_RESET = 'user_model_reset',
  USER_DATA_EXPORTED = 'user_data_exported',

  // Progress events
  LEARNING_PROGRESS_UPDATED = 'learning_progress_updated',

  // System events
  SYSTEM_STARTED = 'system_started',
  SYSTEM_STOPPED = 'system_stopped',
  HEALTH_CHECK_PERFORMED = 'health_check_performed',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Event factory functions
export function createModelEvent(
  type: LearningEventType,
  userId: string,
  modelData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    userId,
    data: { modelData },
    metadata: {
      source: 'learning_engine',
      version: '1.0.0',
      priority: EventPriority.MEDIUM,
      tags: ['model'],
      ...metadata
    }
  };
}

export function createInteractionEvent(
  type: LearningEventType,
  userId: string,
  interactionData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    userId,
    data: { interactionData },
    metadata: {
      source: 'interaction_collector',
      version: '1.0.0',
      priority: EventPriority.MEDIUM,
      tags: ['interaction'],
      ...metadata
    }
  };
}

export function createDecisionEvent(
  type: LearningEventType,
  userId: string,
  decisionData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    userId,
    data: { decisionData },
    metadata: {
      source: 'decision_engine',
      version: '1.0.0',
      priority: EventPriority.HIGH,
      tags: ['decision'],
      ...metadata
    }
  };
}

export function createPrivacyEvent(
  type: LearningEventType,
  userId: string,
  privacyData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    userId,
    data: { privacyData },
    metadata: {
      source: 'privacy_filter',
      version: '1.0.0',
      priority: EventPriority.HIGH,
      tags: ['privacy'],
      ...metadata
    }
  };
}

export function createSafetyEvent(
  type: LearningEventType,
  userId: string,
  safetyData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    userId,
    data: { safetyData },
    metadata: {
      source: 'safety_validator',
      version: '1.0.0',
      priority: EventPriority.CRITICAL,
      tags: ['safety'],
      ...metadata
    }
  };
}

export function createPerformanceEvent(
  type: LearningEventType,
  performanceData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    data: { performanceData },
    metadata: {
      source: 'performance_monitor',
      version: '1.0.0',
      priority: EventPriority.HIGH,
      tags: ['performance'],
      ...metadata
    }
  };
}

export function createSystemEvent(
  type: LearningEventType,
  systemData: any,
  metadata?: Partial<EventMetadata>
): LearningEvent {
  return {
    id: generateEventId(),
    type,
    timestamp: new Date(),
    data: { systemData },
    metadata: {
      source: 'system',
      version: '1.0.0',
      priority: EventPriority.MEDIUM,
      tags: ['system'],
      ...metadata
    }
  };
}

// Event filtering and querying utilities
export interface EventFilter {
  eventTypes?: LearningEventType[];
  userIds?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  priority?: EventPriority;
  source?: string;
}

export function filterEvents(events: LearningEvent[], filter: EventFilter): LearningEvent[] {
  return events.filter(event => {
    // Filter by event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }

    // Filter by user IDs
    if (filter.userIds && event.userId && !filter.userIds.includes(event.userId)) {
      return false;
    }

    // Filter by time range
    if (filter.timeRange) {
      const eventTime = event.timestamp.getTime();
      const startTime = filter.timeRange.start.getTime();
      const endTime = filter.timeRange.end.getTime();
      if (eventTime < startTime || eventTime > endTime) {
        return false;
      }
    }

    // Filter by tags
    if (filter.tags && event.metadata?.tags) {
      const hasMatchingTag = filter.tags.some(tag => 
        event.metadata!.tags.includes(tag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    // Filter by priority
    if (filter.priority && event.metadata?.priority !== filter.priority) {
      return false;
    }

    // Filter by source
    if (filter.source && event.metadata?.source !== filter.source) {
      return false;
    }

    return true;
  });
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Event aggregation utilities
export interface EventAggregation {
  eventType: LearningEventType;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  userIds: string[];
}

export function aggregateEvents(events: LearningEvent[]): EventAggregation[] {
  const aggregationMap = new Map<LearningEventType, EventAggregation>();

  events.forEach(event => {
    const existing = aggregationMap.get(event.type);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date(Math.max(
        existing.lastOccurrence.getTime(),
        event.timestamp.getTime()
      ));
      if (event.userId && !existing.userIds.includes(event.userId)) {
        existing.userIds.push(event.userId);
      }
    } else {
      aggregationMap.set(event.type, {
        eventType: event.type,
        count: 1,
        firstOccurrence: event.timestamp,
        lastOccurrence: event.timestamp,
        userIds: event.userId ? [event.userId] : []
      });
    }
  });

  return Array.from(aggregationMap.values());
}