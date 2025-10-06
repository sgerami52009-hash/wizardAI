import { AssetManager } from './asset-manager';
import { AssetOptimizer, PerformanceTarget, OptimizationTargets } from './asset-optimizer';
import { performanceSystem } from './performance-system';
import { EventEmitter } from 'events';

/**
 * Integration layer between AssetManager and AssetOptimizer
 * Provides seamless asset optimization for the avatar customization system
 */
export class AssetOptimizationIntegration extends EventEmitter {
  private assetManager: AssetManager;
  private assetOptimizer: AssetOptimizer;
  private isAutoOptimizationEnabled = true;
  private optimizationTargets: OptimizationTargets;

  constructor(assetManager: AssetManager) {
    super();
    this.assetManager = assetManager;
    this.assetOptimizer = new AssetOptimizer(assetManager);
    
    // Default optimization targets for Jetson Nano Orin
    this.optimizationTargets = {
      maxMemoryMB: 2048, // 2GB GPU memory limit
      targetCompressionRatio: 0.6, // 60% compression target
      maxQualityLoss: 0.2 // Maximum 20% quality loss
    };

    this.setupIntegration();
  }

  /**
   * Initialize the optimization integration system
   */
  async initialize(): Promise<void> {
    // Set optimization targets
    this.assetOptimizer.setOptimizationTargets(this.optimizationTargets);
    
    // Start optimization system
    await this.assetOptimizer.startOptimization();
    
    // Start performance monitoring integration
    await performanceSystem.startMonitoring();
    
    this.emit('integrationInitialized');
  }

  /**
   * Load and automatically optimize asset based on current performance
   */
  async loadOptimizedAsset(assetId: string, assetType: 'model' | 'texture' | 'animation'): Promise<any> {
    try {
      // Load the asset first
      let asset: any;
      switch (assetType) {
        case 'model':
          asset = await this.assetManager.loadModel(assetId);
          break;
        case 'texture':
          asset = await this.assetManager.loadTexture(assetId);
          break;
        case 'animation':
          asset = await this.assetManager.loadAnimation(assetId);
          break;
        default:
          throw new Error(`Unsupported asset type: ${assetType}`);
      }

      // Check if optimization is needed
      if (this.isAutoOptimizationEnabled && this.shouldOptimizeAsset(asset)) {
        const performanceTarget = this.getCurrentPerformanceTarget();
        await this.assetOptimizer.optimizeAsset(assetId, performanceTarget);
      }

      this.emit('assetLoadedAndOptimized', { assetId, assetType });
      return asset;

    } catch (error) {
      this.emit('assetLoadError', { assetId, assetType, error });
      throw error;
    }
  }

  /**
   * Batch optimize assets for avatar customization
   */
  async optimizeAvatarAssets(avatarConfiguration: any): Promise<void> {
    const assetIds = this.extractAssetIds(avatarConfiguration);
    
    if (assetIds.length === 0) return;

    const performanceTarget = this.getCurrentPerformanceTarget();
    const result = await this.assetOptimizer.batchOptimizeAssets(assetIds, performanceTarget);

    this.emit('avatarAssetsOptimized', {
      avatarId: avatarConfiguration.userId,
      optimizationResult: result
    });
  }

  /**
   * Enable or disable automatic optimization
   */
  setAutoOptimization(enabled: boolean): void {
    this.isAutoOptimizationEnabled = enabled;
    this.emit('autoOptimizationChanged', enabled);
  }

  /**
   * Update optimization targets based on hardware performance
   */
  updateOptimizationTargets(targets: Partial<OptimizationTargets>): void {
    this.optimizationTargets = { ...this.optimizationTargets, ...targets };
    this.assetOptimizer.setOptimizationTargets(this.optimizationTargets);
    this.emit('optimizationTargetsUpdated', this.optimizationTargets);
  }

  /**
   * Get comprehensive optimization status
   */
  getOptimizationStatus(): OptimizationStatus {
    const report = this.assetOptimizer.getOptimizationReport();
    const queueStatus = this.assetOptimizer.getQueueStatus();
    const performanceReport = performanceSystem.getPerformanceReport();

    return {
      isActive: this.isAutoOptimizationEnabled,
      systemHealth: report.systemHealth,
      memoryUtilization: report.memoryUtilization.utilizationPercent,
      queueSize: queueStatus.totalTasks,
      currentFPS: performanceReport.current.currentFPS,
      recommendations: report.recommendations,
      lastOptimization: Date.now() // Would track actual last optimization time
    };
  }

  /**
   * Perform emergency optimization when performance is critical
   */
  async performEmergencyOptimization(): Promise<void> {
    // Force memory cleanup
    await this.assetOptimizer.performMemoryOptimization();
    
    // Force performance optimization
    await performanceSystem.optimizePerformance();
    
    // Apply aggressive caching strategy
    await this.assetOptimizer.applyCachingStrategy('memory_optimized');

    this.emit('emergencyOptimizationCompleted');
  }

  /**
   * Get optimization recommendations for current system state
   */
  getOptimizationRecommendations(): OptimizationRecommendation[] {
    const report = this.assetOptimizer.getOptimizationReport();
    const performanceReport = performanceSystem.getPerformanceReport();
    
    const recommendations: OptimizationRecommendation[] = [];

    // Memory-based recommendations
    if (report.memoryUtilization.utilizationPercent > 85) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        description: 'GPU memory usage is high. Consider reducing texture quality.',
        action: 'reduce_texture_quality',
        expectedBenefit: 'Reduce memory usage by 20-30%'
      });
    }

    // Performance-based recommendations
    if (performanceReport.current.currentFPS < 45) {
      recommendations.push({
        type: 'performance',
        priority: 'critical',
        description: 'Frame rate is below target. Reduce avatar complexity.',
        action: 'reduce_avatar_complexity',
        expectedBenefit: 'Improve FPS by 15-25%'
      });
    }

    // Caching recommendations
    const cachingRecommendations = this.assetOptimizer.getCachingRecommendations();
    recommendations.push(...cachingRecommendations.map(cr => ({
      type: 'caching' as const,
      priority: 'medium' as const,
      description: cr.reason,
      action: cr.type,
      expectedBenefit: cr.expectedBenefit
    })));

    return recommendations;
  }

  /**
   * Cleanup and dispose of all resources
   */
  async dispose(): Promise<void> {
    await this.assetOptimizer.stopOptimization();
    await performanceSystem.stopMonitoring();
    this.assetOptimizer.dispose();
    this.removeAllListeners();
  }

  // Private methods

  private setupIntegration(): void {
    // Listen to asset manager events
    this.assetManager.on('memoryStats', (stats) => {
      if (stats.utilizationPercent > 90) {
        this.performEmergencyOptimization();
      }
    });

    // Listen to performance system events
    performanceSystem.on('performanceWarning', (warning) => {
      if (warning.severity === 'critical') {
        this.performEmergencyOptimization();
      }
    });

    // Listen to asset optimizer events
    this.assetOptimizer.on('assetOptimized', (event) => {
      this.emit('assetOptimized', event);
    });

    this.assetOptimizer.on('batchOptimizationCompleted', (result) => {
      this.emit('batchOptimizationCompleted', result);
    });
  }

  private shouldOptimizeAsset(asset: any): boolean {
    // Check if asset needs optimization based on size and current performance
    const memoryStats = this.assetManager.getMemoryStats();
    const performanceReport = performanceSystem.getPerformanceReport();

    // Optimize if memory usage is high or performance is poor
    return (
      memoryStats.utilizationPercent > 75 ||
      performanceReport.current.currentFPS < 50 ||
      asset.memorySize > 20 // Assets larger than 20MB
    );
  }

  private getCurrentPerformanceTarget(): PerformanceTarget {
    const performanceReport = performanceSystem.getPerformanceReport();
    
    // Adjust targets based on current performance
    let targetFPS = 60;
    let maxMemoryMB = 200;
    
    if (performanceReport.current.currentFPS < 45) {
      targetFPS = 45; // Lower target for struggling systems
      maxMemoryMB = 150; // More aggressive memory limits
    }

    return {
      maxMemoryMB,
      targetFPS,
      maxProcessingTimeMs: 1000 / targetFPS
    };
  }

  private extractAssetIds(avatarConfiguration: any): string[] {
    const assetIds: string[] = [];
    
    // Extract asset IDs from avatar configuration
    if (avatarConfiguration.appearance) {
      const appearance = avatarConfiguration.appearance;
      
      // Face assets
      if (appearance.face?.meshId) assetIds.push(appearance.face.meshId);
      if (appearance.face?.textureId) assetIds.push(appearance.face.textureId);
      
      // Hair assets
      if (appearance.hair?.styleId) assetIds.push(appearance.hair.styleId);
      
      // Clothing assets
      if (appearance.clothing?.topId) assetIds.push(appearance.clothing.topId);
      if (appearance.clothing?.bottomId) assetIds.push(appearance.clothing.bottomId);
      if (appearance.clothing?.shoesId) assetIds.push(appearance.clothing.shoesId);
      
      // Accessory assets
      if (appearance.accessories) {
        appearance.accessories.forEach((accessory: any) => {
          if (accessory.id) assetIds.push(accessory.id);
        });
      }
      
      // Animation assets
      if (appearance.animations) {
        Object.values(appearance.animations).forEach((animId: any) => {
          if (typeof animId === 'string') assetIds.push(animId);
        });
      }
    }

    return assetIds.filter((id, index, array) => array.indexOf(id) === index); // Remove duplicates
  }
}

// Types and interfaces

export interface OptimizationStatus {
  isActive: boolean;
  systemHealth: number;
  memoryUtilization: number;
  queueSize: number;
  currentFPS: number;
  recommendations: string[];
  lastOptimization: number;
}

export interface OptimizationRecommendation {
  type: 'memory' | 'performance' | 'caching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: string;
  expectedBenefit: string;
}

// Export singleton instance for easy use
export const assetOptimizationIntegration = new AssetOptimizationIntegration(new AssetManager());