/**
 * Event Coordination System for Voice Pipeline
 * Safety: All events logged with sanitized data for audit trail
 * Performance: Efficient event routing with minimal overhead
 */

import { EventEmitter } from 'events';
import { voiceEventBus, VoiceEventTypes, VoiceEvent } from './event-bus';
import { VoicePipelineError } from './errors';

export interface EventCoordinatorConfig {
  enableDebugLogging: boolean;
  enablePerformanceMonitoring: boolean;
  eventRetentionMs: number;
  maxEventQueueSize: number;
  enableEventReplay: boolean;
  debugFilters: {
    includeEventTypes?: string[];
    excludeEventTypes?: string[];
    includeComponents?: string[];
    excludeComponents?: string[];
  };
}

export interface EventMetrics {
  totalEventsProcessed: number;
  eventsByType: Record<string, number>;
  eventsByComponent: Record<string, number>;
  averageProcessingTime: number;
  errorCount: number;
  lastEventTime: Date | null;
}

export interface EventDebugInfo {
  event: VoiceEvent;
  processingTime: number;
  subscriberCount: number;
  errors: Array<{ subscriberId: string; error: string }>;
}

export interface PipelineConfiguration {
  components: {
    wakeWordDetector: ComponentConfig;
    speechRecognizer: ComponentConfig;
    intentClassifier: ComponentConfig;
    commandRouter: ComponentConfig;
    responseGenerator: ComponentConfig;
    textToSpeechEngine: ComponentConfig;
    contentSafetyFilter: ComponentConfig;
    resourceMonitor: ComponentConfig;
  };
  pipeline: {
    timeouts: Record<string, number>;
    retryPolicies: Record<string, RetryPolicy>;
    resourceLimits: ResourceLimits;
    safetySettings: SafetySettings;
  };
}

export interface ComponentConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  retryPolicy: RetryPolicy;
  resourceLimits: ResourceLimits;
  debugLevel: 'none' | 'basic' | 'detailed' | 'verbose';
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxGpuPercent?: number;
  maxProcessingTimeMs: number;
}

export interface SafetySettings {
  enableContentFiltering: boolean;
  safetyLevel: 'child' | 'teen' | 'adult';
  auditLogging: boolean;
  parentalNotifications: boolean;
}

export class EventCoordinator extends EventEmitter {
  private config: EventCoordinatorConfig;
  private pipelineConfig: PipelineConfiguration;
  private metrics: EventMetrics;
  private debugHistory: EventDebugInfo[] = [];
  private eventQueue: VoiceEvent[] = [];
  private isProcessing: boolean = false;
  private configUpdateHandlers: Map<string, (config: any) => Promise<void>> = new Map();
  private performanceMonitor: PerformanceMonitor;

  constructor(
    config: Partial<EventCoordinatorConfig> = {},
    pipelineConfig: PipelineConfiguration
  ) {
    super();
    
    this.config = {
      enableDebugLogging: false,
      enablePerformanceMonitoring: true,
      eventRetentionMs: 3600000, // 1 hour
      maxEventQueueSize: 10000,
      enableEventReplay: false,
      debugFilters: {},
      ...config
    };

    this.pipelineConfig = pipelineConfig;
    
    this.metrics = {
      totalEventsProcessed: 0,
      eventsByType: {},
      eventsByComponent: {},
      averageProcessingTime: 0,
      errorCount: 0,
      lastEventTime: null
    };

    this.performanceMonitor = new PerformanceMonitor();
    this.setupEventHandlers();
  }

  /**
   * Start the event coordination system
   */
  async start(): Promise<void> {
    try {
      // Subscribe to all pipeline events
      this.subscribeToAllEvents();

      // Start performance monitoring if enabled
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.start();
      }

      // Start event queue processing
      this.startEventProcessing();

      // Publish coordinator started event
      await voiceEventBus.publishEvent({
        id: `coordinator_start_${Date.now()}`,
        type: 'event-coordinator-started',
        timestamp: new Date(),
        source: 'event-coordinator',
        data: { config: this.config },
        priority: 'medium'
      });

      this.emit('started');

    } catch (error) {
      throw new VoicePipelineError(
        `Failed to start event coordinator: ${error.message}`,
        'EVENT_COORDINATOR_START_FAILED',
        'event-coordinator',
        true
      );
    }
  }

  /**
   * Stop the event coordination system
   */
  async stop(): Promise<void> {
    try {
      this.isProcessing = false;
      
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor.stop();
      }

      // Publish coordinator stopped event
      await voiceEventBus.publishEvent({
        id: `coordinator_stop_${Date.now()}`,
        type: 'event-coordinator-stopped',
        timestamp: new Date(),
        source: 'event-coordinator',
        data: { finalMetrics: this.metrics },
        priority: 'medium'
      });

      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping event coordinator:', error);
    }
  }

  /**
   * Get current event metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get debug information for troubleshooting
   */
  getDebugInfo(filter?: {
    eventType?: string;
    component?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  }): EventDebugInfo[] {
    let filtered = this.debugHistory;

    if (filter) {
      if (filter.eventType) {
        filtered = filtered.filter(info => info.event.type === filter.eventType);
      }
      
      if (filter.component) {
        filtered = filtered.filter(info => info.event.source === filter.component);
      }
      
      if (filter.timeRange) {
        filtered = filtered.filter(info => 
          info.event.timestamp >= filter.timeRange!.start && 
          info.event.timestamp <= filter.timeRange!.end
        );
      }
    }

    const limit = filter?.limit || 100;
    return filtered.slice(-limit);
  }

  /**
   * Update pipeline configuration at runtime
   */
  async updateConfiguration(updates: Partial<PipelineConfiguration>): Promise<void> {
    try {
      // Merge configuration updates
      this.pipelineConfig = this.mergeConfiguration(this.pipelineConfig, updates);

      // Notify components of configuration changes
      for (const [component, handler] of this.configUpdateHandlers.entries()) {
        try {
          const componentConfig = this.pipelineConfig.components[component as keyof typeof this.pipelineConfig.components];
          if (componentConfig) {
            await handler(componentConfig);
          }
        } catch (error) {
          console.error(`Error updating configuration for ${component}:`, error);
        }
      }

      // Publish configuration update event
      await voiceEventBus.publishEvent({
        id: `config_update_${Date.now()}`,
        type: 'configuration-updated',
        timestamp: new Date(),
        source: 'event-coordinator',
        data: { updates },
        priority: 'medium'
      });

      this.emit('configuration-updated', this.pipelineConfig);

    } catch (error) {
      throw new VoicePipelineError(
        `Failed to update configuration: ${error.message}`,
        'CONFIGURATION_UPDATE_FAILED',
        'event-coordinator',
        true
      );
    }
  }

  /**
   * Register a component configuration update handler
   */
  registerConfigurationHandler(
    component: string, 
    handler: (config: any) => Promise<void>
  ): void {
    this.configUpdateHandlers.set(component, handler);
  }

  /**
   * Get current pipeline configuration
   */
  getConfiguration(): PipelineConfiguration {
    return JSON.parse(JSON.stringify(this.pipelineConfig));
  }

  /**
   * Enable or disable debug logging
   */
  setDebugLogging(enabled: boolean, filters?: EventCoordinatorConfig['debugFilters']): void {
    this.config.enableDebugLogging = enabled;
    if (filters) {
      this.config.debugFilters = filters;
    }
  }

  /**
   * Replay events for debugging (if enabled)
   */
  async replayEvents(
    events: VoiceEvent[],
    options: { 
      delayMs?: number; 
      skipSafetyValidation?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.config.enableEventReplay) {
      throw new VoicePipelineError(
        'Event replay is not enabled',
        'EVENT_REPLAY_DISABLED',
        'event-coordinator',
        false
      );
    }

    const delayMs = options.delayMs || 100;

    for (const event of events) {
      if (options.dryRun) {
        console.log('Would replay event:', event.type, event.timestamp);
      } else {
        // Create a new event with updated timestamp
        const replayEvent: VoiceEvent = {
          ...event,
          id: `replay_${event.id}_${Date.now()}`,
          timestamp: new Date()
        };

        await voiceEventBus.publishEvent(replayEvent);
        
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
  }

  /**
   * Get performance metrics for the pipeline
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Trigger manual garbage collection and cleanup
   */
  async performMaintenance(): Promise<void> {
    try {
      // Clean up old debug history
      const cutoffTime = Date.now() - this.config.eventRetentionMs;
      this.debugHistory = this.debugHistory.filter(
        info => info.event.timestamp.getTime() > cutoffTime
      );

      // Clean up old events from queue
      this.eventQueue = this.eventQueue.filter(
        event => event.timestamp.getTime() > cutoffTime
      );

      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Publish maintenance event
      await voiceEventBus.publishEvent({
        id: `maintenance_${Date.now()}`,
        type: 'maintenance-completed',
        timestamp: new Date(),
        source: 'event-coordinator',
        data: { 
          debugHistorySize: this.debugHistory.length,
          eventQueueSize: this.eventQueue.length
        },
        priority: 'low'
      });

    } catch (error) {
      console.error('Error during maintenance:', error);
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    // Handle event bus errors
    voiceEventBus.on('subscriber-error', (errorInfo) => {
      this.metrics.errorCount++;
      
      if (this.config.enableDebugLogging) {
        console.error('Event subscriber error:', errorInfo);
      }
    });

    voiceEventBus.on('publish-error', (errorInfo) => {
      this.metrics.errorCount++;
      
      if (this.config.enableDebugLogging) {
        console.error('Event publish error:', errorInfo);
      }
    });
  }

  private subscribeToAllEvents(): void {
    // Subscribe to all event types for monitoring and debugging
    const allEventTypes = Object.values(VoiceEventTypes);
    
    for (const eventType of allEventTypes) {
      voiceEventBus.subscribe(
        eventType,
        (event) => this.handleEvent(event),
        { priority: -1000 } // Low priority to run after other handlers
      );
    }

    // Also subscribe to generic events
    voiceEventBus.on('event-published', (event) => {
      this.handleEvent(event);
    });
  }

  private async handleEvent(event: VoiceEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if event should be processed based on filters
      if (!this.shouldProcessEvent(event)) {
        return;
      }

      // Add to event queue if enabled
      if (this.config.enableEventReplay) {
        this.addToEventQueue(event);
      }

      // Update metrics
      this.updateMetrics(event, startTime);

      // Create debug info if enabled
      if (this.config.enableDebugLogging) {
        const debugInfo: EventDebugInfo = {
          event,
          processingTime: Date.now() - startTime,
          subscriberCount: this.getSubscriberCount(event.type),
          errors: []
        };

        this.addToDebugHistory(debugInfo);
      }

      // Emit coordination event
      this.emit('event-processed', event);

    } catch (error) {
      this.metrics.errorCount++;
      console.error('Error handling event:', error);
    }
  }

  private shouldProcessEvent(event: VoiceEvent): boolean {
    const filters = this.config.debugFilters;

    // Check include filters
    if (filters.includeEventTypes && !filters.includeEventTypes.includes(event.type)) {
      return false;
    }

    if (filters.includeComponents && !filters.includeComponents.includes(event.source)) {
      return false;
    }

    // Check exclude filters
    if (filters.excludeEventTypes && filters.excludeEventTypes.includes(event.type)) {
      return false;
    }

    if (filters.excludeComponents && filters.excludeComponents.includes(event.source)) {
      return false;
    }

    return true;
  }

  private addToEventQueue(event: VoiceEvent): void {
    this.eventQueue.push(event);

    // Maintain queue size limit
    if (this.eventQueue.length > this.config.maxEventQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.config.maxEventQueueSize);
    }
  }

  private updateMetrics(event: VoiceEvent, startTime: number): void {
    this.metrics.totalEventsProcessed++;
    this.metrics.lastEventTime = event.timestamp;

    // Update event type counts
    this.metrics.eventsByType[event.type] = (this.metrics.eventsByType[event.type] || 0) + 1;

    // Update component counts
    this.metrics.eventsByComponent[event.source] = (this.metrics.eventsByComponent[event.source] || 0) + 1;

    // Update average processing time
    const processingTime = Date.now() - startTime;
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalEventsProcessed - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalEventsProcessed;
  }

  private addToDebugHistory(debugInfo: EventDebugInfo): void {
    this.debugHistory.push(debugInfo);

    // Maintain history size based on retention time
    const cutoffTime = Date.now() - this.config.eventRetentionMs;
    this.debugHistory = this.debugHistory.filter(
      info => info.event.timestamp.getTime() > cutoffTime
    );
  }

  private getSubscriberCount(eventType: string): number {
    const subscriptions = voiceEventBus.getSubscriptions();
    return subscriptions.get(eventType)?.length || 0;
  }

  private startEventProcessing(): void {
    this.isProcessing = true;
    // Event processing is handled by the event handlers
    // This method is for future expansion if needed
  }

  private mergeConfiguration(
    current: PipelineConfiguration, 
    updates: Partial<PipelineConfiguration>
  ): PipelineConfiguration {
    // Deep merge configuration objects
    const merged = JSON.parse(JSON.stringify(current));
    
    if (updates.components) {
      for (const [component, config] of Object.entries(updates.components)) {
        if (merged.components[component as keyof typeof merged.components]) {
          Object.assign(merged.components[component as keyof typeof merged.components], config);
        }
      }
    }

    if (updates.pipeline) {
      Object.assign(merged.pipeline, updates.pipeline);
    }

    return merged;
  }
}

// Performance monitoring helper class
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    eventThroughput: 0,
    averageLatency: 0,
    errorRate: 0,
    uptime: 0
  };
  
  private startTime: Date = new Date();
  private monitoringInterval: NodeJS.Timeout | null = null;

  start(): void {
    this.startTime = new Date();
    
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update every 5 seconds
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    // Update uptime
    this.metrics.uptime = Date.now() - this.startTime.getTime();

    // Update memory usage (if available)
    if (process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    }

    // CPU usage would require additional monitoring
    // This is a placeholder for actual CPU monitoring implementation
  }
}

// Type definitions
export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  eventThroughput: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}

// Default configuration
export const defaultPipelineConfiguration: PipelineConfiguration = {
  components: {
    wakeWordDetector: {
      enabled: true,
      priority: 10,
      timeout: 5000,
      retryPolicy: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableErrors: ['AUDIO_DEVICE_ERROR', 'WAKE_WORD_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 100,
        maxCpuPercent: 20,
        maxProcessingTimeMs: 200
      },
      debugLevel: 'basic'
    },
    speechRecognizer: {
      enabled: true,
      priority: 9,
      timeout: 10000,
      retryPolicy: {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        retryableErrors: ['SPEECH_RECOGNITION_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 500,
        maxCpuPercent: 50,
        maxProcessingTimeMs: 500
      },
      debugLevel: 'basic'
    },
    intentClassifier: {
      enabled: true,
      priority: 8,
      timeout: 3000,
      retryPolicy: {
        maxRetries: 2,
        baseDelayMs: 200,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['INTENT_CLASSIFICATION_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 200,
        maxCpuPercent: 30,
        maxProcessingTimeMs: 100
      },
      debugLevel: 'basic'
    },
    commandRouter: {
      enabled: true,
      priority: 7,
      timeout: 15000,
      retryPolicy: {
        maxRetries: 1,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
        retryableErrors: ['COMMAND_EXECUTION_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 300,
        maxCpuPercent: 40,
        maxProcessingTimeMs: 5000
      },
      debugLevel: 'basic'
    },
    responseGenerator: {
      enabled: true,
      priority: 6,
      timeout: 5000,
      retryPolicy: {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        retryableErrors: ['RESPONSE_GENERATION_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 200,
        maxCpuPercent: 30,
        maxProcessingTimeMs: 1000
      },
      debugLevel: 'basic'
    },
    textToSpeechEngine: {
      enabled: true,
      priority: 5,
      timeout: 8000,
      retryPolicy: {
        maxRetries: 1,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
        retryableErrors: ['TTS_ERROR']
      },
      resourceLimits: {
        maxMemoryMB: 400,
        maxCpuPercent: 40,
        maxProcessingTimeMs: 300
      },
      debugLevel: 'basic'
    },
    contentSafetyFilter: {
      enabled: true,
      priority: 10,
      timeout: 2000,
      retryPolicy: {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        retryableErrors: []
      },
      resourceLimits: {
        maxMemoryMB: 100,
        maxCpuPercent: 20,
        maxProcessingTimeMs: 100
      },
      debugLevel: 'detailed'
    },
    resourceMonitor: {
      enabled: true,
      priority: 1,
      timeout: 1000,
      retryPolicy: {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        retryableErrors: []
      },
      resourceLimits: {
        maxMemoryMB: 50,
        maxCpuPercent: 10,
        maxProcessingTimeMs: 100
      },
      debugLevel: 'basic'
    }
  },
  pipeline: {
    timeouts: {
      wakeWordDetection: 5000,
      speechRecognition: 10000,
      intentClassification: 3000,
      commandExecution: 15000,
      responseGeneration: 5000,
      textToSpeech: 8000,
      safetyValidation: 2000
    },
    retryPolicies: {},
    resourceLimits: {
      maxMemoryMB: 2000,
      maxCpuPercent: 70,
      maxProcessingTimeMs: 500
    },
    safetySettings: {
      enableContentFiltering: true,
      safetyLevel: 'child',
      auditLogging: true,
      parentalNotifications: true
    }
  }
};