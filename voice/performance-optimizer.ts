/**
 * Performance optimization system for voice pipeline
 * Safety: Ensures optimization doesn't compromise child safety features
 * Performance: Adaptive quality reduction and resource management for Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { ResourceMonitor, ResourceUsage, OptimizationRecommendation } from './resource-monitor';

export interface OptimizationStrategy {
  strategyId: string;
  name: string;
  description: string;
  targetResource: 'memory' | 'cpu' | 'gpu' | 'all';
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  reversible: boolean;
  safetyImpact: 'none' | 'minimal' | 'moderate' | 'high';
  expectedSaving: OptimizationSaving;
}

export interface OptimizationSaving {
  memoryMB?: number;
  cpuPercent?: number;
  gpuPercent?: number;
  latencyMs?: number;
}

export interface QueuedRequest {
  requestId: string;
  type: 'wake_word' | 'speech_recognition' | 'intent_classification' | 'tts' | 'response_generation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  timestamp: Date;
  timeoutMs: number;
  data: any;
  retryCount: number;
  maxRetries: number;
}

export interface ProcessingQueue {
  queueId: string;
  name: string;
  maxSize: number;
  currentSize: number;
  processingRate: number; // requests per second
  averageLatency: number;
  requests: QueuedRequest[];
}

export interface ModelCache {
  modelId: string;
  modelType: 'wake_word' | 'speech_recognition' | 'intent_classification' | 'tts';
  sizeBytes: number;
  lastAccessed: Date;
  accessCount: number;
  loadTimeMs: number;
  isLoaded: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface OptimizationAction {
  actionId: string;
  type: 'reduce_quality' | 'pause_component' | 'restart_component' | 'clear_cache' | 'queue_throttle';
  target: string;
  parameters: Record<string, any>;
  appliedAt: Date;
  reversible: boolean;
  autoRevert?: Date;
}

export interface GracefulDegradationLevel {
  level: number; // 0-5, where 0 is full quality, 5 is minimal quality
  name: string;
  description: string;
  audioQuality: number; // 0.0-1.0
  processingSpeed: number; // 0.0-1.0
  modelComplexity: number; // 0.0-1.0
  cacheSize: number; // 0.0-1.0
  safetyLevel: 'maintained' | 'reduced' | 'minimal';
}

/**
 * Performance optimization system with adaptive quality reduction
 * and intelligent resource management
 */
export class PerformanceOptimizer extends EventEmitter {
  private resourceMonitor: ResourceMonitor;
  private isOptimizing: boolean = false;
  private optimizationInterval: NodeJS.Timeout | null = null;
  
  private processingQueues: Map<string, ProcessingQueue> = new Map();
  private modelCache: Map<string, ModelCache> = new Map();
  private appliedOptimizations: Map<string, OptimizationAction> = new Map();
  
  private currentDegradationLevel: number = 0;
  private maxDegradationLevel: number = 3; // Don't go below moderate quality
  private optimizationHistory: OptimizationAction[] = [];
  
  // Jetson Nano Orin specific configurations
  private readonly maxCacheSize: number = 2048; // 2GB for model cache
  private readonly maxQueueSize: number = 100;
  private readonly optimizationIntervalMs: number = 5000; // 5 seconds

  constructor(resourceMonitor: ResourceMonitor) {
    super();
    this.resourceMonitor = resourceMonitor;
    
    // Initialize default processing queues
    this.initializeQueues();
    
    // Initialize degradation levels
    this.initializeDegradationLevels();
    
    // Listen to resource monitor events
    this.setupResourceMonitorListeners();
  }

  /**
   * Start performance optimization
   */
  async startOptimization(): Promise<void> {
    if (this.isOptimizing) {
      return;
    }

    this.isOptimizing = true;
    this.optimizationInterval = setInterval(() => {
      this.performOptimizationCycle();
    }, this.optimizationIntervalMs);

    this.emit('optimization-started');
  }

  /**
   * Stop performance optimization
   */
  async stopOptimization(): Promise<void> {
    if (!this.isOptimizing) {
      return;
    }

    this.isOptimizing = false;
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    // Revert all optimizations
    await this.revertAllOptimizations();

    this.emit('optimization-stopped');
  }

  /**
   * Add request to processing queue with priority
   */
  async queueRequest(request: Omit<QueuedRequest, 'requestId' | 'timestamp' | 'retryCount'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      ...request,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0
    };

    const queueId = this.getQueueForRequestType(request.type);
    const queue = this.processingQueues.get(queueId);
    
    if (!queue) {
      throw new Error(`No queue found for request type: ${request.type}`);
    }

    // Check queue capacity
    if (queue.requests.length >= queue.maxSize) {
      // Remove lowest priority requests if queue is full
      this.evictLowPriorityRequests(queue);
    }

    // Insert request based on priority
    this.insertRequestByPriority(queue, queuedRequest);
    
    this.emit('request-queued', { queueId, request: queuedRequest });
    
    return queuedRequest.requestId;
  }

  /**
   * Process next request from queue
   */
  async processNextRequest(queueId: string): Promise<QueuedRequest | null> {
    const queue = this.processingQueues.get(queueId);
    if (!queue || queue.requests.length === 0) {
      return null;
    }

    const request = queue.requests.shift()!;
    queue.currentSize = queue.requests.length;
    
    this.emit('request-processing', { queueId, request });
    
    return request;
  }

  /**
   * Load model into cache with optimization
   */
  async loadModel(modelId: string, modelType: ModelCache['modelType'], sizeBytes: number): Promise<void> {
    // Check if model is already loaded
    const existing = this.modelCache.get(modelId);
    if (existing && existing.isLoaded) {
      existing.lastAccessed = new Date();
      existing.accessCount++;
      return;
    }

    // Check cache capacity
    const totalCacheSize = this.getTotalCacheSize();
    const maxCacheSizeBytes = this.maxCacheSize * 1024 * 1024; // Convert MB to bytes
    if (totalCacheSize + sizeBytes > maxCacheSizeBytes) {
      await this.evictCacheModels(sizeBytes);
    }

    const startTime = Date.now();
    
    // Simulate model loading (in real implementation, this would load the actual model)
    await new Promise(resolve => setTimeout(resolve, Math.min(sizeBytes / 1000000, 5000))); // Max 5s load time
    
    const loadTime = Date.now() - startTime;

    const modelCache: ModelCache = {
      modelId,
      modelType,
      sizeBytes,
      lastAccessed: new Date(),
      accessCount: 1,
      loadTimeMs: loadTime,
      isLoaded: true,
      priority: this.getModelPriority(modelType)
    };

    this.modelCache.set(modelId, modelCache);
    this.emit('model-loaded', { modelId, loadTime, cacheSize: this.getTotalCacheSize() });
  }

  /**
   * Apply graceful degradation based on resource pressure
   */
  async applyGracefulDegradation(targetLevel: number): Promise<void> {
    if (targetLevel < 0 || targetLevel > this.maxDegradationLevel) {
      throw new Error(`Invalid degradation level: ${targetLevel}`);
    }

    if (targetLevel === this.currentDegradationLevel) {
      return;
    }

    const degradationLevel = this.getDegradationLevel(targetLevel);
    const previousLevel = this.currentDegradationLevel;
    
    this.currentDegradationLevel = targetLevel;

    // Apply degradation optimizations
    const optimizations: OptimizationAction[] = [];

    if (targetLevel > previousLevel) {
      // Increasing degradation (reducing quality)
      optimizations.push(...await this.applyQualityReduction(degradationLevel));
    } else {
      // Decreasing degradation (improving quality)
      optimizations.push(...await this.restoreQuality(degradationLevel));
    }

    // Record optimizations
    optimizations.forEach(opt => {
      this.appliedOptimizations.set(opt.actionId, opt);
      this.optimizationHistory.push(opt);
    });

    this.emit('degradation-applied', {
      previousLevel,
      currentLevel: targetLevel,
      degradationLevel,
      optimizations
    });
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const queueMetrics = Array.from(this.processingQueues.values()).map(queue => ({
      queueId: queue.queueId,
      name: queue.name,
      size: queue.currentSize,
      maxSize: queue.maxSize,
      processingRate: queue.processingRate,
      averageLatency: queue.averageLatency
    }));

    const cacheMetrics = {
      totalSize: this.getTotalCacheSize(),
      maxSize: this.maxCacheSize * 1024 * 1024, // Convert MB to bytes for consistency
      utilization: this.getTotalCacheSize() / (this.maxCacheSize * 1024 * 1024),
      modelCount: this.modelCache.size,
      hitRate: this.calculateCacheHitRate()
    };

    return {
      degradationLevel: this.currentDegradationLevel,
      queues: queueMetrics,
      cache: cacheMetrics,
      appliedOptimizations: this.appliedOptimizations.size,
      resourceUsage: this.resourceMonitor.getCurrentUsage(),
      timestamp: new Date()
    };
  }

  /**
   * Get optimization strategies available
   */
  getAvailableStrategies(): OptimizationStrategy[] {
    return [
      {
        strategyId: 'audio-quality-reduction',
        name: 'Audio Quality Reduction',
        description: 'Reduce audio processing quality to save CPU and memory',
        targetResource: 'cpu',
        aggressiveness: 'moderate',
        reversible: true,
        safetyImpact: 'minimal',
        expectedSaving: { cpuPercent: 15, memoryMB: 100 }
      },
      {
        strategyId: 'model-cache-eviction',
        name: 'Model Cache Eviction',
        description: 'Remove unused models from memory cache',
        targetResource: 'memory',
        aggressiveness: 'conservative',
        reversible: true,
        safetyImpact: 'none',
        expectedSaving: { memoryMB: 500 }
      },
      {
        strategyId: 'queue-throttling',
        name: 'Request Queue Throttling',
        description: 'Limit concurrent request processing',
        targetResource: 'cpu',
        aggressiveness: 'moderate',
        reversible: true,
        safetyImpact: 'minimal',
        expectedSaving: { cpuPercent: 20 }
      },
      {
        strategyId: 'component-pause',
        name: 'Non-Essential Component Pause',
        description: 'Temporarily pause non-critical components',
        targetResource: 'all',
        aggressiveness: 'aggressive',
        reversible: true,
        safetyImpact: 'moderate',
        expectedSaving: { cpuPercent: 30, memoryMB: 300 }
      }
    ];
  }

  /**
   * Manually apply optimization strategy
   */
  async applyStrategy(strategyId: string, parameters?: Record<string, any>): Promise<OptimizationAction> {
    const strategy = this.getAvailableStrategies().find(s => s.strategyId === strategyId);
    if (!strategy) {
      throw new Error(`Unknown optimization strategy: ${strategyId}`);
    }

    const action: OptimizationAction = {
      actionId: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapStrategyToActionType(strategyId),
      target: strategyId,
      parameters: parameters || {},
      appliedAt: new Date(),
      reversible: strategy.reversible
    };

    // Apply the optimization
    await this.executeOptimizationAction(action);
    
    this.appliedOptimizations.set(action.actionId, action);
    this.optimizationHistory.push(action);
    
    this.emit('strategy-applied', { strategy, action });
    
    return action;
  }

  /**
   * Revert specific optimization
   */
  async revertOptimization(actionId: string): Promise<void> {
    const action = this.appliedOptimizations.get(actionId);
    if (!action) {
      throw new Error(`Optimization action not found: ${actionId}`);
    }

    if (!action.reversible) {
      throw new Error(`Optimization action is not reversible: ${actionId}`);
    }

    await this.revertOptimizationAction(action);
    
    this.appliedOptimizations.delete(actionId);
    this.emit('optimization-reverted', { actionId, action });
  }

  /**
   * Initialize default processing queues
   */
  private initializeQueues(): void {
    const queues: Omit<ProcessingQueue, 'requests' | 'currentSize'>[] = [
      {
        queueId: 'wake-word-queue',
        name: 'Wake Word Detection',
        maxSize: 10,
        processingRate: 100,
        averageLatency: 50
      },
      {
        queueId: 'speech-recognition-queue',
        name: 'Speech Recognition',
        maxSize: 20,
        processingRate: 10,
        averageLatency: 500
      },
      {
        queueId: 'intent-classification-queue',
        name: 'Intent Classification',
        maxSize: 30,
        processingRate: 50,
        averageLatency: 100
      },
      {
        queueId: 'tts-queue',
        name: 'Text-to-Speech',
        maxSize: 25,
        processingRate: 20,
        averageLatency: 300
      },
      {
        queueId: 'response-generation-queue',
        name: 'Response Generation',
        maxSize: 15,
        processingRate: 30,
        averageLatency: 200
      }
    ];

    queues.forEach(queueConfig => {
      const queue: ProcessingQueue = {
        ...queueConfig,
        requests: [],
        currentSize: 0
      };
      this.processingQueues.set(queue.queueId, queue);
    });
  }

  /**
   * Initialize degradation levels
   */
  private degradationLevels: GracefulDegradationLevel[] = [
    {
      level: 0,
      name: 'Full Quality',
      description: 'Maximum quality with all features enabled',
      audioQuality: 1.0,
      processingSpeed: 1.0,
      modelComplexity: 1.0,
      cacheSize: 1.0,
      safetyLevel: 'maintained'
    },
    {
      level: 1,
      name: 'High Quality',
      description: 'Slight quality reduction for better performance',
      audioQuality: 0.9,
      processingSpeed: 1.1,
      modelComplexity: 0.9,
      cacheSize: 0.9,
      safetyLevel: 'maintained'
    },
    {
      level: 2,
      name: 'Balanced',
      description: 'Balanced quality and performance',
      audioQuality: 0.8,
      processingSpeed: 1.2,
      modelComplexity: 0.8,
      cacheSize: 0.8,
      safetyLevel: 'maintained'
    },
    {
      level: 3,
      name: 'Performance',
      description: 'Prioritize performance over quality',
      audioQuality: 0.7,
      processingSpeed: 1.4,
      modelComplexity: 0.7,
      cacheSize: 0.7,
      safetyLevel: 'reduced'
    }
  ];

  private initializeDegradationLevels(): void {
    // Degradation levels are initialized in the class property
  }

  /**
   * Setup resource monitor event listeners
   */
  private setupResourceMonitorListeners(): void {
    this.resourceMonitor.on('resource-alert', (alert) => {
      this.handleResourceAlert(alert);
    });

    this.resourceMonitor.on('optimization-trigger', (trigger) => {
      this.handleOptimizationTrigger(trigger);
    });
  }

  /**
   * Handle resource alerts from monitor
   */
  private async handleResourceAlert(alert: any): Promise<void> {
    if (alert.type === 'critical') {
      // Apply aggressive optimization for critical alerts
      const targetLevel = Math.min(this.currentDegradationLevel + 2, this.maxDegradationLevel);
      await this.applyGracefulDegradation(targetLevel);
    } else if (alert.type === 'warning') {
      // Apply moderate optimization for warnings
      const targetLevel = Math.min(this.currentDegradationLevel + 1, this.maxDegradationLevel);
      await this.applyGracefulDegradation(targetLevel);
    }
  }

  /**
   * Handle optimization triggers from monitor
   */
  private async handleOptimizationTrigger(trigger: any): Promise<void> {
    const { action, priority } = trigger.trigger;
    
    switch (action) {
      case 'reduce_quality':
        await this.applyGracefulDegradation(Math.min(this.currentDegradationLevel + 1, this.maxDegradationLevel));
        break;
      case 'pause_component':
        await this.applyStrategy('component-pause');
        break;
      case 'emergency_stop':
        await this.applyGracefulDegradation(this.maxDegradationLevel);
        break;
    }
  }

  /**
   * Perform optimization cycle
   */
  private async performOptimizationCycle(): Promise<void> {
    try {
      const usage = this.resourceMonitor.getCurrentUsage();
      const recommendations = this.resourceMonitor.getOptimizationRecommendations();
      
      // Auto-revert optimizations if resources are available
      if (!this.resourceMonitor.isUnderPressure() && this.currentDegradationLevel > 0) {
        await this.applyGracefulDegradation(Math.max(this.currentDegradationLevel - 1, 0));
      }

      // Apply automatic optimizations based on recommendations
      for (const recommendation of recommendations) {
        if (recommendation.priority === 'high') {
          await this.applyRecommendation(recommendation);
        }
      }

      // Clean up expired optimizations
      await this.cleanupExpiredOptimizations();

      this.emit('optimization-cycle-completed', {
        usage,
        recommendations,
        degradationLevel: this.currentDegradationLevel
      });

    } catch (error) {
      this.emit('optimization-error', error);
    }
  }

  /**
   * Apply optimization recommendation
   */
  private async applyRecommendation(recommendation: OptimizationRecommendation): Promise<void> {
    switch (recommendation.type) {
      case 'memory':
        await this.applyStrategy('model-cache-eviction');
        break;
      case 'cpu':
        await this.applyStrategy('queue-throttling');
        break;
      case 'component':
        if (recommendation.targetComponents && recommendation.targetComponents.length > 0) {
          await this.applyStrategy('component-pause', { 
            components: recommendation.targetComponents 
          });
        }
        break;
    }
  }

  /**
   * Get queue for request type
   */
  private getQueueForRequestType(type: QueuedRequest['type']): string {
    const queueMap: Record<QueuedRequest['type'], string> = {
      'wake_word': 'wake-word-queue',
      'speech_recognition': 'speech-recognition-queue',
      'intent_classification': 'intent-classification-queue',
      'tts': 'tts-queue',
      'response_generation': 'response-generation-queue'
    };
    
    return queueMap[type];
  }

  /**
   * Insert request by priority
   */
  private insertRequestByPriority(queue: ProcessingQueue, request: QueuedRequest): void {
    const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    
    let insertIndex = queue.requests.length;
    for (let i = 0; i < queue.requests.length; i++) {
      if (priorityOrder[request.priority] < priorityOrder[queue.requests[i].priority]) {
        insertIndex = i;
        break;
      }
    }
    
    queue.requests.splice(insertIndex, 0, request);
    queue.currentSize = queue.requests.length;
  }

  /**
   * Evict low priority requests from queue
   */
  private evictLowPriorityRequests(queue: ProcessingQueue): void {
    // Remove oldest low priority requests
    const lowPriorityIndices = queue.requests
      .map((req, index) => ({ req, index }))
      .filter(({ req }) => req.priority === 'low')
      .map(({ index }) => index);
    
    if (lowPriorityIndices.length > 0) {
      queue.requests.splice(lowPriorityIndices[0], 1);
      queue.currentSize = queue.requests.length;
    }
  }

  /**
   * Get total cache size
   */
  private getTotalCacheSize(): number {
    return Array.from(this.modelCache.values())
      .filter(model => model.isLoaded)
      .reduce((total, model) => total + model.sizeBytes, 0);
  }

  /**
   * Evict models from cache to make space
   */
  private async evictCacheModels(requiredSpace: number): Promise<void> {
    const models = Array.from(this.modelCache.values())
      .filter(model => model.isLoaded)
      .sort((a, b) => {
        // Sort by priority (low first) and last accessed time
        const priorityOrder = { 'low': 0, 'medium': 1, 'high': 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.lastAccessed.getTime() - b.lastAccessed.getTime();
      });

    let freedSpace = 0;
    for (const model of models) {
      if (freedSpace >= requiredSpace) {
        break;
      }
      
      model.isLoaded = false;
      freedSpace += model.sizeBytes;
      
      this.emit('model-evicted', { 
        modelId: model.modelId, 
        size: model.sizeBytes, 
        reason: 'cache-full' 
      });
    }
  }

  /**
   * Get model priority based on type
   */
  private getModelPriority(modelType: ModelCache['modelType']): 'low' | 'medium' | 'high' {
    const priorityMap: Record<ModelCache['modelType'], 'low' | 'medium' | 'high'> = {
      'wake_word': 'high',      // Always keep wake word models loaded
      'speech_recognition': 'high', // Critical for voice interaction
      'intent_classification': 'medium',
      'tts': 'medium'
    };
    
    return priorityMap[modelType];
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const models = Array.from(this.modelCache.values());
    if (models.length === 0) return 0;
    
    const totalAccesses = models.reduce((sum, model) => sum + model.accessCount, 0);
    const loadedAccesses = models
      .filter(model => model.isLoaded)
      .reduce((sum, model) => sum + model.accessCount, 0);
    
    return totalAccesses > 0 ? loadedAccesses / totalAccesses : 0;
  }

  /**
   * Get degradation level configuration
   */
  private getDegradationLevel(level: number): GracefulDegradationLevel {
    return this.degradationLevels[level] || this.degradationLevels[0];
  }

  /**
   * Apply quality reduction optimizations
   */
  private async applyQualityReduction(degradationLevel: GracefulDegradationLevel): Promise<OptimizationAction[]> {
    const actions: OptimizationAction[] = [];
    
    // Reduce audio quality
    if (degradationLevel.audioQuality < 1.0) {
      actions.push({
        actionId: `audio_quality_${Date.now()}`,
        type: 'reduce_quality',
        target: 'audio-processor',
        parameters: { quality: degradationLevel.audioQuality },
        appliedAt: new Date(),
        reversible: true
      });
    }
    
    // Reduce cache size
    if (degradationLevel.cacheSize < 1.0) {
      const targetCacheSize = this.maxCacheSize * 1024 * 1024 * degradationLevel.cacheSize; // Convert to bytes
      const currentCacheSize = this.getTotalCacheSize();
      
      if (currentCacheSize > targetCacheSize) {
        await this.evictCacheModels(currentCacheSize - targetCacheSize);
        actions.push({
          actionId: `cache_reduction_${Date.now()}`,
          type: 'clear_cache',
          target: 'model-cache',
          parameters: { targetSize: targetCacheSize },
          appliedAt: new Date(),
          reversible: true
        });
      }
    }
    
    return actions;
  }

  /**
   * Restore quality optimizations
   */
  private async restoreQuality(degradationLevel: GracefulDegradationLevel): Promise<OptimizationAction[]> {
    const actions: OptimizationAction[] = [];
    
    // Restore audio quality
    actions.push({
      actionId: `audio_restore_${Date.now()}`,
      type: 'reduce_quality',
      target: 'audio-processor',
      parameters: { quality: degradationLevel.audioQuality },
      appliedAt: new Date(),
      reversible: true
    });
    
    return actions;
  }

  /**
   * Map strategy ID to action type
   */
  private mapStrategyToActionType(strategyId: string): OptimizationAction['type'] {
    const mapping: Record<string, OptimizationAction['type']> = {
      'audio-quality-reduction': 'reduce_quality',
      'model-cache-eviction': 'clear_cache',
      'queue-throttling': 'queue_throttle',
      'component-pause': 'pause_component'
    };
    
    return mapping[strategyId] || 'reduce_quality';
  }

  /**
   * Execute optimization action
   */
  private async executeOptimizationAction(action: OptimizationAction): Promise<void> {
    // Implementation would depend on the specific action type
    // This is a placeholder for the actual optimization logic
    
    switch (action.type) {
      case 'reduce_quality':
        // Reduce processing quality
        break;
      case 'clear_cache':
        // Clear model cache
        break;
      case 'queue_throttle':
        // Throttle request processing
        break;
      case 'pause_component':
        // Pause non-essential components
        break;
    }
  }

  /**
   * Revert optimization action
   */
  private async revertOptimizationAction(action: OptimizationAction): Promise<void> {
    // Implementation would depend on the specific action type
    // This is a placeholder for the actual reversion logic
  }

  /**
   * Revert all applied optimizations
   */
  private async revertAllOptimizations(): Promise<void> {
    const reversibleActions = Array.from(this.appliedOptimizations.values())
      .filter(action => action.reversible);
    
    for (const action of reversibleActions) {
      await this.revertOptimizationAction(action);
    }
    
    this.appliedOptimizations.clear();
    this.currentDegradationLevel = 0;
  }

  /**
   * Clean up expired optimizations
   */
  private async cleanupExpiredOptimizations(): Promise<void> {
    const now = new Date();
    const expiredActions = Array.from(this.appliedOptimizations.values())
      .filter(action => action.autoRevert && action.autoRevert <= now);
    
    for (const action of expiredActions) {
      await this.revertOptimization(action.actionId);
    }
  }
}

export interface PerformanceMetrics {
  degradationLevel: number;
  queues: Array<{
    queueId: string;
    name: string;
    size: number;
    maxSize: number;
    processingRate: number;
    averageLatency: number;
  }>;
  cache: {
    totalSize: number;
    maxSize: number;
    utilization: number;
    modelCount: number;
    hitRate: number;
  };
  appliedOptimizations: number;
  resourceUsage: ResourceUsage;
  timestamp: Date;
}

/**
 * Factory function to create PerformanceOptimizer with Jetson Nano Orin optimizations
 */
export function createJetsonPerformanceOptimizer(resourceMonitor: ResourceMonitor): PerformanceOptimizer {
  return new PerformanceOptimizer(resourceMonitor);
}