import { EventEmitter } from 'events';
import { ProviderType, RateLimit, RateLimitType } from './types';
import { providerRegistry } from './provider-registry';

/**
 * Rate Limit Manager
 * 
 * Implements intelligent API rate limit handling with exponential backoff
 * Manages sync operation batching and queue management
 * Provides provider-specific rate limit tracking and adaptation
 * 
 * Safety: Prevents API abuse while maintaining child-safe operation
 * Performance: Optimized for Jetson Nano Orin with efficient queue management
 */
export class RateLimitManager extends EventEmitter {
  private rateLimiters: Map<string, ProviderRateLimiter> = new Map();
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private batchProcessors: Map<string, BatchProcessor> = new Map();
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    super();
    this.performanceMonitor = new PerformanceMonitor();
    this.initializeProviderLimiters();
    this.startQueueProcessing();
  }

  /**
   * Check if a request can be made immediately
   */
  canMakeRequest(providerId: ProviderType, requestType: RateLimitType = RateLimitType.REQUESTS_PER_MINUTE): boolean {
    const limiter = this.rateLimiters.get(providerId);
    if (!limiter) {
      return true; // No limiter configured, allow request
    }

    return limiter.canMakeRequest(requestType);
  }

  /**
   * Make a rate-limited request
   */
  async makeRequest<T>(
    providerId: ProviderType,
    requestFn: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const limiter = this.rateLimiters.get(providerId);
    if (!limiter) {
      // No rate limiting, execute immediately
      return this.executeWithMonitoring(providerId, requestFn, options);
    }

    // Check if we can make the request immediately
    if (limiter.canMakeRequest(options.requestType)) {
      return this.executeRequest(providerId, requestFn, options);
    }

    // Queue the request if immediate execution is not possible
    if (options.allowQueuing !== false) {
      return this.queueRequest(providerId, requestFn, options);
    }

    // Throw rate limit error if queuing is not allowed
    const resetTime = limiter.getNextResetTime(options.requestType);
    throw new RateLimitError(
      `Rate limit exceeded for ${providerId}`,
      resetTime,
      limiter.getCurrentUsage(options.requestType)
    );
  }

  /**
   * Batch multiple requests for efficient processing
   */
  async batchRequests<T>(
    providerId: ProviderType,
    requests: BatchRequest<T>[],
    options: BatchOptions = {}
  ): Promise<BatchResult<T>[]> {
    const processor = this.getBatchProcessor(providerId);
    return processor.processBatch(requests, options);
  }

  /**
   * Get current rate limit status for a provider
   */
  getRateLimitStatus(providerId: ProviderType): RateLimitStatus {
    const limiter = this.rateLimiters.get(providerId);
    if (!limiter) {
      return {
        providerId,
        limits: [],
        isLimited: false,
        nextResetTime: null,
        queuedRequests: 0
      };
    }

    const limits = limiter.getAllLimits();
    const queuedRequests = this.requestQueues.get(providerId)?.length || 0;
    const isLimited = limits.some(limit => limit.currentUsage >= limit.limit);
    const nextResetTime = limiter.getEarliestResetTime();

    return {
      providerId,
      limits,
      isLimited,
      nextResetTime,
      queuedRequests
    };
  }

  /**
   * Get performance metrics for sync operations
   */
  getPerformanceMetrics(providerId?: ProviderType): PerformanceMetrics {
    return this.performanceMonitor.getMetrics(providerId);
  }

  /**
   * Update rate limits based on provider response headers
   */
  updateRateLimitsFromHeaders(
    providerId: ProviderType,
    headers: Record<string, string>
  ): void {
    const limiter = this.rateLimiters.get(providerId);
    if (!limiter) {
      return;
    }

    // Parse common rate limit headers
    const remaining = this.parseHeader(headers['x-ratelimit-remaining'] || headers['x-rate-limit-remaining']);
    const limit = this.parseHeader(headers['x-ratelimit-limit'] || headers['x-rate-limit-limit']);
    const reset = this.parseHeader(headers['x-ratelimit-reset'] || headers['x-rate-limit-reset']);
    const retryAfter = this.parseHeader(headers['retry-after']);

    if (remaining !== null && limit !== null) {
      limiter.updateFromHeaders(limit, remaining, reset, retryAfter);
    }

    this.emit('rateLimitUpdated', { providerId, remaining, limit, reset });
  }

  /**
   * Handle rate limit exceeded response
   */
  handleRateLimitExceeded(
    providerId: ProviderType,
    retryAfter?: number
  ): void {
    const limiter = this.rateLimiters.get(providerId);
    if (limiter) {
      limiter.handleRateLimitExceeded(retryAfter);
    }

    this.emit('rateLimitExceeded', { providerId, retryAfter });
  }

  /**
   * Optimize sync scheduling to minimize resource usage
   */
  optimizeSyncScheduling(): SyncOptimization {
    const allStatuses = Array.from(this.rateLimiters.keys())
      .map(providerId => this.getRateLimitStatus(providerId));

    const recommendations: OptimizationRecommendation[] = [];
    let totalQueuedRequests = 0;

    for (const status of allStatuses) {
      totalQueuedRequests += status.queuedRequests;

      if (status.isLimited) {
        recommendations.push({
          providerId: status.providerId,
          type: 'delay_sync',
          reason: 'Rate limit exceeded',
          suggestedDelay: this.calculateOptimalDelay(status),
          priority: 'high'
        });
      } else if (status.queuedRequests > 10) {
        recommendations.push({
          providerId: status.providerId,
          type: 'batch_requests',
          reason: 'High queue volume',
          suggestedBatchSize: Math.min(status.queuedRequests, 50),
          priority: 'medium'
        });
      }
    }

    // System-wide recommendations
    if (totalQueuedRequests > 100) {
      recommendations.push({
        providerId: 'system' as ProviderType,
        type: 'reduce_frequency',
        reason: 'High system load',
        suggestedFrequency: 30, // minutes
        priority: 'high'
      });
    }

    return {
      totalQueuedRequests,
      recommendations,
      estimatedProcessingTime: this.estimateProcessingTime(totalQueuedRequests),
      resourceUsage: this.estimateResourceUsage()
    };
  }

  // Private methods

  private initializeProviderLimiters(): void {
    const providers = providerRegistry.getAllProviders();
    
    for (const provider of providers) {
      const limiter = new ProviderRateLimiter(provider.type, provider.rateLimits);
      this.rateLimiters.set(provider.type, limiter);
      this.requestQueues.set(provider.type, []);
      this.batchProcessors.set(provider.type, new BatchProcessor(provider.type));
    }
  }

  private async executeRequest<T>(
    providerId: ProviderType,
    requestFn: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    const limiter = this.rateLimiters.get(providerId)!;
    
    // Record request
    limiter.recordRequest(options.requestType);
    
    // Execute with monitoring
    return this.executeWithMonitoring(providerId, requestFn, options);
  }

  private async executeWithMonitoring<T>(
    providerId: ProviderType,
    requestFn: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await requestFn();
      
      // Record successful request
      this.performanceMonitor.recordRequest(providerId, {
        duration: Date.now() - startTime,
        success: true,
        requestType: options.requestType || RateLimitType.REQUESTS_PER_MINUTE
      });
      
      return result;
    } catch (error) {
      // Record failed request
      this.performanceMonitor.recordRequest(providerId, {
        duration: Date.now() - startTime,
        success: false,
        error: error.message,
        requestType: options.requestType || RateLimitType.REQUESTS_PER_MINUTE
      });
      
      // Handle rate limit errors
      if (this.isRateLimitError(error)) {
        this.handleRateLimitExceeded(providerId, this.extractRetryAfter(error));
      }
      
      throw error;
    }
  }

  private async queueRequest<T>(
    providerId: ProviderType,
    requestFn: () => Promise<T>,
    options: RequestOptions
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: this.generateRequestId(),
        providerId,
        requestFn,
        options,
        resolve,
        reject,
        queuedAt: new Date(),
        priority: options.priority || 'normal'
      };

      const queue = this.requestQueues.get(providerId)!;
      
      // Insert based on priority
      if (options.priority === 'high') {
        queue.unshift(queuedRequest);
      } else {
        queue.push(queuedRequest);
      }

      this.emit('requestQueued', { providerId, queueSize: queue.length });
    });
  }

  private startQueueProcessing(): void {
    // Process queues every 5 seconds
    setInterval(() => {
      this.processQueues();
    }, 5000);
  }

  private async processQueues(): Promise<void> {
    for (const [providerId, queue] of this.requestQueues.entries()) {
      if (queue.length === 0) {
        continue;
      }

      const limiter = this.rateLimiters.get(providerId);
      if (!limiter) {
        continue;
      }

      // Process as many requests as rate limits allow
      while (queue.length > 0 && limiter.canMakeRequest()) {
        const request = queue.shift()!;
        
        try {
          const result = await this.executeRequest(
            request.providerId,
            request.requestFn,
            request.options
          );
          request.resolve(result);
        } catch (error) {
          request.reject(error);
        }
      }
    }
  }

  private getBatchProcessor(providerId: ProviderType): BatchProcessor {
    let processor = this.batchProcessors.get(providerId);
    if (!processor) {
      processor = new BatchProcessor(providerId);
      this.batchProcessors.set(providerId, processor);
    }
    return processor;
  }

  private parseHeader(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  private isRateLimitError(error: any): boolean {
    return error.status === 429 || 
           error.message?.toLowerCase().includes('rate limit') ||
           error.message?.toLowerCase().includes('too many requests');
  }

  private extractRetryAfter(error: any): number | undefined {
    // Try to extract retry-after from error response
    return error.retryAfter || error.headers?.['retry-after'];
  }

  private calculateOptimalDelay(status: RateLimitStatus): number {
    if (!status.nextResetTime) {
      return 60; // Default 1 minute
    }
    
    const delayMs = status.nextResetTime.getTime() - Date.now();
    return Math.max(60, Math.ceil(delayMs / 1000)); // At least 1 minute
  }

  private estimateProcessingTime(queuedRequests: number): number {
    // Estimate based on average request time and rate limits
    const averageRequestTime = 2000; // 2 seconds
    const maxConcurrentRequests = 5; // Conservative estimate
    
    return Math.ceil((queuedRequests * averageRequestTime) / maxConcurrentRequests / 1000);
  }

  private estimateResourceUsage(): ResourceUsage {
    const totalQueued = Array.from(this.requestQueues.values())
      .reduce((sum, queue) => sum + queue.length, 0);
    
    return {
      memoryUsageMB: Math.max(1, totalQueued * 0.1), // 0.1MB per queued request
      cpuUsagePercent: Math.min(10, totalQueued * 0.05), // 0.05% per request
      networkBandwidthKbps: totalQueued * 2 // 2 Kbps per request
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Provider-specific rate limiter
 */
class ProviderRateLimiter {
  private limits: Map<RateLimitType, RateLimit> = new Map();
  private providerId: ProviderType;

  constructor(providerId: ProviderType, rateLimits: RateLimit[]) {
    this.providerId = providerId;
    
    for (const limit of rateLimits) {
      this.limits.set(limit.type, { ...limit });
    }
  }

  canMakeRequest(requestType: RateLimitType = RateLimitType.REQUESTS_PER_MINUTE): boolean {
    const limit = this.limits.get(requestType);
    if (!limit) {
      return true; // No limit configured
    }

    // Check if window has reset
    if (Date.now() >= limit.resetTime.getTime()) {
      this.resetLimit(requestType);
    }

    return limit.currentUsage < limit.limit;
  }

  recordRequest(requestType: RateLimitType = RateLimitType.REQUESTS_PER_MINUTE): void {
    const limit = this.limits.get(requestType);
    if (limit) {
      limit.currentUsage++;
    }
  }

  updateFromHeaders(
    limitValue: number,
    remaining: number,
    reset?: number | null,
    retryAfter?: number | null
  ): void {
    const requestLimit = this.limits.get(RateLimitType.REQUESTS_PER_MINUTE);
    if (requestLimit) {
      requestLimit.limit = limitValue;
      requestLimit.currentUsage = limitValue - remaining;
      
      if (reset) {
        requestLimit.resetTime = new Date(reset * 1000);
      }
    }
  }

  handleRateLimitExceeded(retryAfter?: number): void {
    // Mark all limits as exceeded
    for (const limit of this.limits.values()) {
      limit.currentUsage = limit.limit;
      
      if (retryAfter) {
        limit.resetTime = new Date(Date.now() + retryAfter * 1000);
      }
    }
  }

  getCurrentUsage(requestType: RateLimitType): number {
    const limit = this.limits.get(requestType);
    return limit?.currentUsage || 0;
  }

  getNextResetTime(requestType: RateLimitType): Date | null {
    const limit = this.limits.get(requestType);
    return limit?.resetTime || null;
  }

  getEarliestResetTime(): Date | null {
    let earliest: Date | null = null;
    
    for (const limit of this.limits.values()) {
      if (limit.currentUsage >= limit.limit) {
        if (!earliest || limit.resetTime < earliest) {
          earliest = limit.resetTime;
        }
      }
    }
    
    return earliest;
  }

  getAllLimits(): RateLimit[] {
    return Array.from(this.limits.values());
  }

  private resetLimit(requestType: RateLimitType): void {
    const limit = this.limits.get(requestType);
    if (limit) {
      limit.currentUsage = 0;
      limit.resetTime = new Date(Date.now() + limit.windowSeconds * 1000);
    }
  }
}

/**
 * Batch processor for efficient request handling
 */
class BatchProcessor {
  private providerId: ProviderType;

  constructor(providerId: ProviderType) {
    this.providerId = providerId;
  }

  async processBatch<T>(
    requests: BatchRequest<T>[],
    options: BatchOptions
  ): Promise<BatchResult<T>[]> {
    const batchSize = options.batchSize || 10;
    const results: BatchResult<T>[] = [];
    
    // Process requests in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await this.processSingleBatch(batch, options);
      results.push(...batchResults);
      
      // Add delay between batches if specified
      if (options.delayBetweenBatches && i + batchSize < requests.length) {
        await this.delay(options.delayBetweenBatches);
      }
    }
    
    return results;
  }

  private async processSingleBatch<T>(
    batch: BatchRequest<T>[],
    options: BatchOptions
  ): Promise<BatchResult<T>[]> {
    const promises = batch.map(async (request, index) => {
      try {
        const result = await request.requestFn();
        return {
          index: request.index || index,
          success: true,
          result,
          error: null
        };
      } catch (error) {
        return {
          index: request.index || index,
          success: false,
          result: null,
          error: error.message
        };
      }
    });

    return Promise.all(promises);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Performance monitoring for sync operations
 */
class PerformanceMonitor {
  private metrics: Map<ProviderType, ProviderMetrics> = new Map();

  recordRequest(providerId: ProviderType, request: RequestMetric): void {
    let metrics = this.metrics.get(providerId);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        averageDuration: 0,
        requestsByType: new Map(),
        lastUpdated: new Date()
      };
      this.metrics.set(providerId, metrics);
    }

    // Update metrics
    metrics.totalRequests++;
    metrics.totalDuration += request.duration;
    metrics.averageDuration = metrics.totalDuration / metrics.totalRequests;
    
    if (request.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update by request type
    const typeMetrics = metrics.requestsByType.get(request.requestType) || {
      count: 0,
      totalDuration: 0,
      averageDuration: 0
    };
    
    typeMetrics.count++;
    typeMetrics.totalDuration += request.duration;
    typeMetrics.averageDuration = typeMetrics.totalDuration / typeMetrics.count;
    
    metrics.requestsByType.set(request.requestType, typeMetrics);
    metrics.lastUpdated = new Date();
  }

  getMetrics(providerId?: ProviderType): PerformanceMetrics {
    if (providerId) {
      const metrics = this.metrics.get(providerId);
      return {
        providerId,
        ...metrics,
        successRate: metrics ? (metrics.successfulRequests / metrics.totalRequests) * 100 : 0
      };
    }

    // Aggregate metrics for all providers
    const allMetrics = Array.from(this.metrics.values());
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const successfulRequests = allMetrics.reduce((sum, m) => sum + m.successfulRequests, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.totalDuration, 0);

    return {
      providerId: 'all' as ProviderType,
      totalRequests,
      successfulRequests,
      failedRequests: totalRequests - successfulRequests,
      totalDuration,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      requestsByType: new Map(),
      lastUpdated: new Date()
    };
  }
}

// Custom error class
class RateLimitError extends Error {
  constructor(
    message: string,
    public resetTime: Date | null,
    public currentUsage: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Type definitions
interface RequestOptions {
  requestType?: RateLimitType;
  priority?: 'low' | 'normal' | 'high';
  allowQueuing?: boolean;
  timeout?: number;
}

interface QueuedRequest {
  id: string;
  providerId: ProviderType;
  requestFn: () => Promise<any>;
  options: RequestOptions;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  queuedAt: Date;
  priority: 'low' | 'normal' | 'high';
}

interface BatchRequest<T> {
  index?: number;
  requestFn: () => Promise<T>;
}

interface BatchOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  maxConcurrency?: number;
}

interface BatchResult<T> {
  index: number;
  success: boolean;
  result: T | null;
  error: string | null;
}

interface RateLimitStatus {
  providerId: ProviderType;
  limits: RateLimit[];
  isLimited: boolean;
  nextResetTime: Date | null;
  queuedRequests: number;
}

interface RequestMetric {
  duration: number;
  success: boolean;
  error?: string;
  requestType: RateLimitType;
}

interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  averageDuration: number;
  requestsByType: Map<RateLimitType, TypeMetrics>;
  lastUpdated: Date;
}

interface TypeMetrics {
  count: number;
  totalDuration: number;
  averageDuration: number;
}

interface PerformanceMetrics extends ProviderMetrics {
  providerId: ProviderType;
  successRate: number;
}

interface SyncOptimization {
  totalQueuedRequests: number;
  recommendations: OptimizationRecommendation[];
  estimatedProcessingTime: number;
  resourceUsage: ResourceUsage;
}

interface OptimizationRecommendation {
  providerId: ProviderType;
  type: 'delay_sync' | 'batch_requests' | 'reduce_frequency';
  reason: string;
  priority: 'low' | 'medium' | 'high';
  suggestedDelay?: number;
  suggestedBatchSize?: number;
  suggestedFrequency?: number;
}

interface ResourceUsage {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkBandwidthKbps: number;
}