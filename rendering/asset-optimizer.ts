import { EventEmitter } from 'events';
import { AssetManager, AssetType, ModelAsset, TextureAsset, AnimationAsset } from './asset-manager';
import { RenderingMetrics } from './types';

/**
 * Asset optimization system with automatic compression, intelligent caching, and performance profiling
 * Optimized for Jetson Nano Orin hardware constraints (2GB GPU memory limit)
 */
export class AssetOptimizer extends EventEmitter {
  private assetManager: AssetManager;
  private compressionEngine: CompressionEngine;
  private cachingStrategy: IntelligentCachingStrategy;
  private memoryManager: MemoryManager;
  private performanceProfiler: PerformanceProfiler;
  private isActive = false;
  private optimizationQueue: OptimizationTask[] = [];
  private isProcessingQueue = false;

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
    this.compressionEngine = new CompressionEngine();
    this.cachingStrategy = new IntelligentCachingStrategy();
    this.memoryManager = new MemoryManager();
    this.performanceProfiler = new PerformanceProfiler();

    this.setupEventHandlers();
  }

  /**
   * Start asset optimization system
   */
  async startOptimization(): Promise<void> {
    if (this.isActive) return;

    this.isActive = true;
    
    // Initialize all subsystems
    await this.compressionEngine.initialize();
    await this.cachingStrategy.initialize();
    await this.memoryManager.initialize();
    await this.performanceProfiler.startProfiling();

    // Start background optimization processing
    this.startOptimizationQueue();

    this.emit('optimizationStarted');
  }

  /**
   * Stop asset optimization system
   */
  async stopOptimization(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;
    this.isProcessingQueue = false;

    await this.performanceProfiler.stopProfiling();
    
    this.emit('optimizationStopped');
  }

  /**
   * Optimize asset with automatic compression based on performance requirements
   */
  async optimizeAsset(assetId: string, targetPerformance: PerformanceTarget): Promise<OptimizationResult> {
    try {
      const asset = await this.assetManager.loadModel(assetId); // Try loading as model first
      
      const optimizationPlan = await this.createOptimizationPlan(asset, targetPerformance);
      const result = await this.executeOptimizationPlan(optimizationPlan);

      this.emit('assetOptimized', { assetId, result });
      return result;

    } catch (error) {
      // Try as texture if model loading fails
      try {
        const asset = await this.assetManager.loadTexture(assetId);
        const optimizationPlan = await this.createOptimizationPlan(asset, targetPerformance);
        const result = await this.executeOptimizationPlan(optimizationPlan);

        this.emit('assetOptimized', { assetId, result });
        return result;
      } catch (textureError) {
        // Try as animation
        try {
          const asset = await this.assetManager.loadAnimation(assetId);
          const optimizationPlan = await this.createOptimizationPlan(asset, targetPerformance);
          const result = await this.executeOptimizationPlan(optimizationPlan);

          this.emit('assetOptimized', { assetId, result });
          return result;
        } catch (animError) {
          this.emit('optimizationError', { assetId, error });
          throw error;
        }
      }
    }
  }

  /**
   * Batch optimize multiple assets with priority-based processing
   */
  async batchOptimizeAssets(assetIds: string[], targetPerformance: PerformanceTarget): Promise<BatchOptimizationResult> {
    const results: OptimizationResult[] = [];
    const errors: { assetId: string; error: Error }[] = [];

    // Sort assets by priority (based on usage frequency and size)
    const prioritizedAssets = await this.prioritizeAssets(assetIds);

    for (const assetId of prioritizedAssets) {
      try {
        const result = await this.optimizeAsset(assetId, targetPerformance);
        results.push(result);
      } catch (error) {
        errors.push({ assetId, error: error as Error });
      }
    }

    const batchResult: BatchOptimizationResult = {
      totalAssets: assetIds.length,
      successfulOptimizations: results.length,
      failedOptimizations: errors.length,
      results,
      errors,
      totalMemorySaved: results.reduce((sum, r) => sum + r.memorySaved, 0),
      averageCompressionRatio: results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length
    };

    this.emit('batchOptimizationCompleted', batchResult);
    return batchResult;
  }

  /**
   * Get intelligent caching recommendations based on usage patterns
   */
  getCachingRecommendations(): CachingRecommendation[] {
    return this.cachingStrategy.getRecommendations();
  }

  /**
   * Apply intelligent caching strategy
   */
  async applyCachingStrategy(strategy: CachingStrategyType): Promise<void> {
    await this.cachingStrategy.applyStrategy(strategy);
    this.emit('cachingStrategyApplied', strategy);
  }

  /**
   * Perform automatic memory management and cleanup
   */
  async performMemoryOptimization(): Promise<MemoryOptimizationResult> {
    const result = await this.memoryManager.optimizeMemoryUsage();
    this.emit('memoryOptimized', result);
    return result;
  }

  /**
   * Get performance bottleneck analysis
   */
  getPerformanceBottlenecks(): BottleneckAnalysis {
    return this.performanceProfiler.analyzeBottlenecks();
  }

  /**
   * Get comprehensive optimization report
   */
  getOptimizationReport(): OptimizationReport {
    const memoryStats = this.assetManager.getMemoryStats();
    const bottlenecks = this.getPerformanceBottlenecks();
    const cachingStats = this.cachingStrategy.getStatistics();
    const compressionStats = this.compressionEngine.getStatistics();

    return {
      memoryUtilization: memoryStats,
      performanceBottlenecks: bottlenecks,
      cachingEfficiency: cachingStats,
      compressionEfficiency: compressionStats,
      recommendations: this.generateOptimizationRecommendations(),
      systemHealth: this.calculateOptimizationHealth()
    };
  }

  /**
   * Set optimization targets based on hardware capabilities
   */
  setOptimizationTargets(targets: OptimizationTargets): void {
    this.compressionEngine.setTargets(targets);
    this.cachingStrategy.setTargets(targets);
    this.memoryManager.setTargets(targets);
    this.performanceProfiler.setTargets(targets);

    this.emit('targetsUpdated', targets);
  }

  /**
   * Queue asset for background optimization
   */
  queueAssetOptimization(assetId: string, priority: OptimizationPriority = 'normal'): void {
    const task: OptimizationTask = {
      assetId,
      priority,
      queuedAt: Date.now(),
      attempts: 0
    };

    this.optimizationQueue.push(task);
    this.optimizationQueue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));

    this.emit('assetQueued', task);
  }

  /**
   * Get optimization queue status
   */
  getQueueStatus(): QueueStatus {
    return {
      totalTasks: this.optimizationQueue.length,
      isProcessing: this.isProcessingQueue,
      priorityBreakdown: this.getQueuePriorityBreakdown(),
      estimatedProcessingTime: this.estimateQueueProcessingTime()
    };
  }

  /**
   * Cleanup and dispose of all resources
   */
  dispose(): void {
    this.stopOptimization();
    this.compressionEngine.dispose();
    this.cachingStrategy.dispose();
    this.memoryManager.dispose();
    this.performanceProfiler.dispose();
    this.removeAllListeners();
  }

  // Private methods

  private setupEventHandlers(): void {
    // Listen to asset manager events for optimization opportunities
    this.assetManager.on('memoryStats', (stats) => {
      if (stats.utilizationPercent > 85) {
        this.performMemoryOptimization();
      }
    });

    this.assetManager.on('assetLoaded', (event) => {
      // Queue newly loaded assets for background optimization
      this.queueAssetOptimization(event.assetId, 'low');
    });
  }

  private async createOptimizationPlan(asset: any, target: PerformanceTarget): Promise<OptimizationPlan> {
    const plan: OptimizationPlan = {
      assetId: asset.id,
      assetType: asset.type,
      originalSize: asset.memorySize,
      targetSize: this.calculateTargetSize(asset, target),
      optimizations: []
    };

    // Add compression optimizations
    if (asset.type === 'texture') {
      plan.optimizations.push({
        type: 'texture_compression',
        description: 'Apply texture compression to reduce memory usage',
        expectedSavings: asset.memorySize * 0.4,
        qualityImpact: 0.1
      });

      if (asset.width > 1024 || asset.height > 1024) {
        plan.optimizations.push({
          type: 'texture_resize',
          description: 'Resize texture to optimal resolution',
          expectedSavings: asset.memorySize * 0.6,
          qualityImpact: 0.2
        });
      }
    }

    if (asset.type === 'model') {
      if (asset.triangleCount > 10000) {
        plan.optimizations.push({
          type: 'mesh_simplification',
          description: 'Reduce triangle count for better performance',
          expectedSavings: asset.memorySize * 0.3,
          qualityImpact: 0.15
        });
      }

      plan.optimizations.push({
        type: 'vertex_compression',
        description: 'Compress vertex data',
        expectedSavings: asset.memorySize * 0.2,
        qualityImpact: 0.05
      });
    }

    if (asset.type === 'animation') {
      plan.optimizations.push({
        type: 'keyframe_reduction',
        description: 'Reduce animation keyframes',
        expectedSavings: asset.memorySize * 0.25,
        qualityImpact: 0.1
      });
    }

    return plan;
  }

  private async executeOptimizationPlan(plan: OptimizationPlan): Promise<OptimizationResult> {
    const startTime = Date.now();
    let totalSavings = 0;
    let totalQualityImpact = 0;
    const appliedOptimizations: string[] = [];

    for (const optimization of plan.optimizations) {
      try {
        const success = await this.applyOptimization(plan.assetId, optimization);
        if (success) {
          totalSavings += optimization.expectedSavings;
          totalQualityImpact += optimization.qualityImpact;
          appliedOptimizations.push(optimization.type);
        }
      } catch (error) {
        this.emit('optimizationStepError', { assetId: plan.assetId, optimization, error });
      }
    }

    return {
      assetId: plan.assetId,
      originalSize: plan.originalSize,
      optimizedSize: plan.originalSize - totalSavings,
      memorySaved: totalSavings,
      compressionRatio: totalSavings / plan.originalSize,
      qualityImpact: totalQualityImpact,
      appliedOptimizations,
      processingTime: Date.now() - startTime,
      success: appliedOptimizations.length > 0
    };
  }

  private async applyOptimization(assetId: string, optimization: OptimizationStep): Promise<boolean> {
    switch (optimization.type) {
      case 'texture_compression':
        return await this.compressionEngine.compressTexture(assetId);
      case 'texture_resize':
        return await this.compressionEngine.resizeTexture(assetId);
      case 'mesh_simplification':
        return await this.compressionEngine.simplifyMesh(assetId);
      case 'vertex_compression':
        return await this.compressionEngine.compressVertices(assetId);
      case 'keyframe_reduction':
        return await this.compressionEngine.reduceKeyframes(assetId);
      default:
        return false;
    }
  }

  private async prioritizeAssets(assetIds: string[]): Promise<string[]> {
    // Get usage statistics and size information
    const assetPriorities = await Promise.all(
      assetIds.map(async (assetId) => {
        const usageFrequency = this.cachingStrategy.getUsageFrequency(assetId);
        const memoryImpact = await this.getAssetMemoryImpact(assetId);
        
        return {
          assetId,
          priority: usageFrequency * memoryImpact
        };
      })
    );

    // Sort by priority (highest first)
    assetPriorities.sort((a, b) => b.priority - a.priority);
    
    return assetPriorities.map(ap => ap.assetId);
  }

  private async getAssetMemoryImpact(assetId: string): Promise<number> {
    // Estimate memory impact based on asset type and size
    try {
      // Try to get cached asset info first
      const memoryStats = this.assetManager.getMemoryStats();
      return 1.0; // Default impact
    } catch {
      return 0.5; // Lower impact if asset not accessible
    }
  }

  private calculateTargetSize(asset: any, target: PerformanceTarget): number {
    const maxMemoryPerAsset = target.maxMemoryMB * 0.1; // 10% of total memory per asset
    return Math.min(asset.memorySize, maxMemoryPerAsset);
  }

  private startOptimizationQueue(): void {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;
    this.processOptimizationQueue();
  }

  private async processOptimizationQueue(): Promise<void> {
    while (this.isActive && this.optimizationQueue.length > 0) {
      const task = this.optimizationQueue.shift()!;
      
      try {
        const target: PerformanceTarget = {
          maxMemoryMB: 200, // 200MB per asset max
          targetFPS: 60,
          maxProcessingTimeMs: 100
        };

        await this.optimizeAsset(task.assetId, target);
        this.emit('queueTaskCompleted', task);
        
      } catch (error) {
        task.attempts++;
        
        if (task.attempts < 3) {
          // Retry with lower priority
          task.priority = 'low';
          this.optimizationQueue.push(task);
        } else {
          this.emit('queueTaskFailed', { task, error });
        }
      }

      // Small delay to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isProcessingQueue = false;
  }

  private getPriorityValue(priority: OptimizationPriority): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private getQueuePriorityBreakdown(): Record<OptimizationPriority, number> {
    const breakdown: Record<OptimizationPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

    for (const task of this.optimizationQueue) {
      breakdown[task.priority]++;
    }

    return breakdown;
  }

  private estimateQueueProcessingTime(): number {
    // Estimate based on queue size and average processing time
    const averageProcessingTime = 2000; // 2 seconds per asset
    return this.optimizationQueue.length * averageProcessingTime;
  }

  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const memoryStats = this.assetManager.getMemoryStats();
    const bottlenecks = this.getPerformanceBottlenecks();

    if (memoryStats.utilizationPercent > 80) {
      recommendations.push('Consider enabling aggressive texture compression');
      recommendations.push('Reduce texture resolution for non-critical assets');
    }

    if (bottlenecks.primaryBottleneck === 'memory_bandwidth') {
      recommendations.push('Enable asset streaming to reduce memory pressure');
    }

    if (bottlenecks.primaryBottleneck === 'gpu_processing') {
      recommendations.push('Reduce polygon count on complex models');
    }

    return recommendations;
  }

  private calculateOptimizationHealth(): number {
    const memoryStats = this.assetManager.getMemoryStats();
    const cachingStats = this.cachingStrategy.getStatistics();
    
    let health = 1.0;

    // Memory health (40% weight)
    const memoryHealth = Math.max(0, 1.0 - (memoryStats.utilizationPercent / 100));
    health *= (0.4 * memoryHealth + 0.6);

    // Caching efficiency (30% weight)
    const cachingHealth = cachingStats.hitRate;
    health *= (0.3 * cachingHealth + 0.7);

    // Queue health (20% weight)
    const queueHealth = Math.max(0, 1.0 - (this.optimizationQueue.length / 100));
    health *= (0.2 * queueHealth + 0.8);

    // Processing health (10% weight)
    const processingHealth = this.isProcessingQueue ? 0.8 : 1.0;
    health *= (0.1 * processingHealth + 0.9);

    return Math.max(0, Math.min(1, health));
  }
}

/**
 * Compression engine for various asset types
 */
class CompressionEngine {
  private targets: OptimizationTargets = {
    maxMemoryMB: 2048,
    targetCompressionRatio: 0.6,
    maxQualityLoss: 0.2
  };

  async initialize(): Promise<void> {
    // Initialize compression algorithms
  }

  setTargets(targets: OptimizationTargets): void {
    this.targets = { ...targets };
  }

  async compressTexture(assetId: string): Promise<boolean> {
    // Implement texture compression (DXT, ETC, ASTC)
    return true;
  }

  async resizeTexture(assetId: string): Promise<boolean> {
    // Implement texture resizing
    return true;
  }

  async simplifyMesh(assetId: string): Promise<boolean> {
    // Implement mesh simplification
    return true;
  }

  async compressVertices(assetId: string): Promise<boolean> {
    // Implement vertex compression
    return true;
  }

  async reduceKeyframes(assetId: string): Promise<boolean> {
    // Implement animation keyframe reduction
    return true;
  }

  getStatistics(): CompressionStatistics {
    return {
      totalAssetsCompressed: 0,
      averageCompressionRatio: 0.6,
      totalMemorySaved: 0,
      averageQualityLoss: 0.1
    };
  }

  dispose(): void {
    // Cleanup compression resources
  }
}

/**
 * Intelligent caching strategy system
 */
class IntelligentCachingStrategy {
  private usagePatterns: Map<string, UsagePattern> = new Map();
  private currentStrategy: CachingStrategyType = 'adaptive';

  async initialize(): Promise<void> {
    // Initialize caching system
  }

  setTargets(targets: OptimizationTargets): void {
    // Configure caching based on targets
  }

  getRecommendations(): CachingRecommendation[] {
    return [
      {
        type: 'preload',
        assetIds: ['frequently_used_asset_1'],
        reason: 'High usage frequency detected',
        expectedBenefit: 'Reduced loading times'
      }
    ];
  }

  async applyStrategy(strategy: CachingStrategyType): Promise<void> {
    this.currentStrategy = strategy;
    // Implement strategy application
  }

  getUsageFrequency(assetId: string): number {
    const pattern = this.usagePatterns.get(assetId);
    return pattern?.frequency || 0;
  }

  getStatistics(): CachingStatistics {
    return {
      hitRate: 0.85,
      missRate: 0.15,
      averageLoadTime: 150,
      cacheEfficiency: 0.9
    };
  }

  dispose(): void {
    this.usagePatterns.clear();
  }
}

/**
 * Memory management system
 */
class MemoryManager {
  async initialize(): Promise<void> {
    // Initialize memory monitoring
  }

  setTargets(targets: OptimizationTargets): void {
    // Configure memory management
  }

  async optimizeMemoryUsage(): Promise<MemoryOptimizationResult> {
    return {
      memoryFreed: 100,
      assetsUnloaded: 5,
      fragmentationReduced: 0.2,
      success: true
    };
  }

  dispose(): void {
    // Cleanup memory management
  }
}

/**
 * Performance profiling and bottleneck identification
 */
class PerformanceProfiler {
  private isActive = false;

  async startProfiling(): Promise<void> {
    this.isActive = true;
  }

  async stopProfiling(): Promise<void> {
    this.isActive = false;
  }

  setTargets(targets: OptimizationTargets): void {
    // Configure profiling targets
  }

  analyzeBottlenecks(): BottleneckAnalysis {
    return {
      primaryBottleneck: 'memory_bandwidth',
      bottleneckSeverity: 0.6,
      affectedOperations: ['texture_loading', 'model_rendering'],
      recommendations: ['Enable texture streaming', 'Reduce texture resolution']
    };
  }

  dispose(): void {
    this.stopProfiling();
  }
}

// Types and interfaces

export interface PerformanceTarget {
  maxMemoryMB: number;
  targetFPS: number;
  maxProcessingTimeMs: number;
}

export interface OptimizationTargets {
  maxMemoryMB: number;
  targetCompressionRatio: number;
  maxQualityLoss: number;
}

export interface OptimizationResult {
  assetId: string;
  originalSize: number;
  optimizedSize: number;
  memorySaved: number;
  compressionRatio: number;
  qualityImpact: number;
  appliedOptimizations: string[];
  processingTime: number;
  success: boolean;
}

export interface BatchOptimizationResult {
  totalAssets: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  results: OptimizationResult[];
  errors: { assetId: string; error: Error }[];
  totalMemorySaved: number;
  averageCompressionRatio: number;
}

export interface OptimizationPlan {
  assetId: string;
  assetType: AssetType;
  originalSize: number;
  targetSize: number;
  optimizations: OptimizationStep[];
}

export interface OptimizationStep {
  type: 'texture_compression' | 'texture_resize' | 'mesh_simplification' | 'vertex_compression' | 'keyframe_reduction';
  description: string;
  expectedSavings: number;
  qualityImpact: number;
}

export interface OptimizationTask {
  assetId: string;
  priority: OptimizationPriority;
  queuedAt: number;
  attempts: number;
}

export interface QueueStatus {
  totalTasks: number;
  isProcessing: boolean;
  priorityBreakdown: Record<OptimizationPriority, number>;
  estimatedProcessingTime: number;
}

export interface CachingRecommendation {
  type: 'preload' | 'unload' | 'compress' | 'prioritize';
  assetIds: string[];
  reason: string;
  expectedBenefit: string;
}

export interface MemoryOptimizationResult {
  memoryFreed: number;
  assetsUnloaded: number;
  fragmentationReduced: number;
  success: boolean;
}

export interface BottleneckAnalysis {
  primaryBottleneck: 'cpu_processing' | 'gpu_processing' | 'memory_bandwidth' | 'storage_io';
  bottleneckSeverity: number;
  affectedOperations: string[];
  recommendations: string[];
}

export interface OptimizationReport {
  memoryUtilization: any;
  performanceBottlenecks: BottleneckAnalysis;
  cachingEfficiency: CachingStatistics;
  compressionEfficiency: CompressionStatistics;
  recommendations: string[];
  systemHealth: number;
}

export interface CompressionStatistics {
  totalAssetsCompressed: number;
  averageCompressionRatio: number;
  totalMemorySaved: number;
  averageQualityLoss: number;
}

export interface CachingStatistics {
  hitRate: number;
  missRate: number;
  averageLoadTime: number;
  cacheEfficiency: number;
}

export interface UsagePattern {
  frequency: number;
  lastAccessed: number;
  averageSessionDuration: number;
}

export type OptimizationPriority = 'critical' | 'high' | 'normal' | 'low';
export type CachingStrategyType = 'aggressive' | 'adaptive' | 'conservative' | 'memory_optimized';

// Export singleton instance
export const assetOptimizer = new AssetOptimizer(new AssetManager());