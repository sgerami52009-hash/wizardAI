import { EventEmitter } from 'events';

/**
 * Asset management system for 3D models, textures, and animations
 * Optimized for Jetson Nano Orin with 2GB GPU memory limit
 */
export class AssetManager extends EventEmitter {
  private assetCache: Map<string, CachedAsset> = new Map();
  private loadingQueue: Map<string, Promise<any>> = new Map();
  private memoryUsage = 0;
  private readonly maxMemoryMB = 2048; // 2GB GPU limit
  private readonly cacheThresholdMB = 1800; // Start cleanup at 1.8GB
  private dependencyGraph: Map<string, string[]> = new Map();
  private preloadQueue: string[] = [];
  private isProcessingQueue = false;

  constructor() {
    super();
    this.startMemoryMonitoring();
  }

  /**
   * Load a 3D model asset with caching and dependency resolution
   */
  async loadModel(assetId: string, priority: AssetPriority = 'normal'): Promise<ModelAsset> {
    try {
      // Check cache first
      const cached = this.assetCache.get(assetId);
      if (cached && cached.type === 'model') {
        this.updateAccessTime(assetId);
        return cached.data as ModelAsset;
      }

      // Check if already loading
      if (this.loadingQueue.has(assetId)) {
        return await this.loadingQueue.get(assetId)!;
      }

      // Start loading
      const loadPromise = this.performModelLoad(assetId, priority);
      this.loadingQueue.set(assetId, loadPromise);

      const model = await loadPromise;
      this.loadingQueue.delete(assetId);

      return model;
    } catch (error) {
      this.loadingQueue.delete(assetId);
      this.emit('loadError', { assetId, type: 'model', error });
      throw error;
    }
  }

  /**
   * Load texture asset with compression and mipmap generation
   */
  async loadTexture(assetId: string, priority: AssetPriority = 'normal'): Promise<TextureAsset> {
    try {
      const cached = this.assetCache.get(assetId);
      if (cached && cached.type === 'texture') {
        this.updateAccessTime(assetId);
        return cached.data as TextureAsset;
      }

      if (this.loadingQueue.has(assetId)) {
        return await this.loadingQueue.get(assetId)!;
      }

      const loadPromise = this.performTextureLoad(assetId, priority);
      this.loadingQueue.set(assetId, loadPromise);

      const texture = await loadPromise;
      this.loadingQueue.delete(assetId);

      return texture;
    } catch (error) {
      this.loadingQueue.delete(assetId);
      this.emit('loadError', { assetId, type: 'texture', error });
      throw error;
    }
  }

  /**
   * Load animation asset with compression
   */
  async loadAnimation(assetId: string, priority: AssetPriority = 'normal'): Promise<AnimationAsset> {
    try {
      const cached = this.assetCache.get(assetId);
      if (cached && cached.type === 'animation') {
        this.updateAccessTime(assetId);
        return cached.data as AnimationAsset;
      }

      if (this.loadingQueue.has(assetId)) {
        return await this.loadingQueue.get(assetId)!;
      }

      const loadPromise = this.performAnimationLoad(assetId, priority);
      this.loadingQueue.set(assetId, loadPromise);

      const animation = await loadPromise;
      this.loadingQueue.delete(assetId);

      return animation;
    } catch (error) {
      this.loadingQueue.delete(assetId);
      this.emit('loadError', { assetId, type: 'animation', error });
      throw error;
    }
  }

  /**
   * Preload assets for improved performance
   */
  async preloadAssets(assetIds: string[]): Promise<void> {
    // Add to preload queue
    for (const assetId of assetIds) {
      if (!this.preloadQueue.includes(assetId) && !this.assetCache.has(assetId)) {
        this.preloadQueue.push(assetId);
      }
    }

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processPreloadQueue();
    }

    this.emit('preloadQueued', { assetIds, queueSize: this.preloadQueue.length });
  }

  /**
   * Set asset dependencies for automatic loading
   */
  setAssetDependencies(assetId: string, dependencies: string[]): void {
    this.dependencyGraph.set(assetId, dependencies);
    this.emit('dependenciesSet', { assetId, dependencies });
  }

  /**
   * Get asset dependencies
   */
  getAssetDependencies(assetId: string): string[] {
    return this.dependencyGraph.get(assetId) || [];
  }

  /**
   * Unload asset from cache to free memory
   */
  unloadAsset(assetId: string): boolean {
    const cached = this.assetCache.get(assetId);
    if (!cached) {
      return false;
    }

    // Check if asset is currently being used
    if (cached.refCount > 0) {
      this.emit('unloadBlocked', { assetId, refCount: cached.refCount });
      return false;
    }

    // Remove from cache and update memory usage
    this.memoryUsage -= cached.memorySize;
    this.assetCache.delete(assetId);

    this.emit('assetUnloaded', { assetId, memoryFreed: cached.memorySize });
    return true;
  }

  /**
   * Force cleanup of unused assets when memory is low
   */
  async forceCleanup(): Promise<number> {
    const freedMemory = this.performMemoryCleanup(true);
    this.emit('forceCleanupCompleted', { freedMemory });
    return freedMemory;
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): AssetMemoryStats {
    return {
      totalUsedMB: this.memoryUsage,
      maxMemoryMB: this.maxMemoryMB,
      utilizationPercent: (this.memoryUsage / this.maxMemoryMB) * 100,
      cachedAssets: this.assetCache.size,
      loadingAssets: this.loadingQueue.size,
      preloadQueueSize: this.preloadQueue.length
    };
  }

  /**
   * Optimize asset loading order based on dependencies
   */
  optimizeLoadingOrder(assetIds: string[]): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (assetId: string) => {
      if (visited.has(assetId)) return;
      visited.add(assetId);

      // Load dependencies first
      const deps = this.getAssetDependencies(assetId);
      for (const dep of deps) {
        visit(dep);
      }

      result.push(assetId);
    };

    for (const assetId of assetIds) {
      visit(assetId);
    }

    return result;
  }

  /**
   * Get assets by category for appearance customization
   */
  async getAssetsByCategory(category: any): Promise<any[]> {
    // This would typically query a database or asset registry
    // For now, return mock data based on category
    const mockAssets = [
      {
        id: 'asset_001',
        name: 'Default Asset',
        category,
        ageRestriction: { min: 5, max: 99 },
        performanceImpact: 'low',
        safetyRating: 'safe'
      }
    ];
    
    return mockAssets;
  }

  /**
   * Cleanup and dispose of all resources
   */
  dispose(): void {
    // Cancel all loading operations
    this.loadingQueue.clear();
    
    // Clear all cached assets
    for (const [assetId] of this.assetCache) {
      this.unloadAsset(assetId);
    }

    this.assetCache.clear();
    this.dependencyGraph.clear();
    this.preloadQueue.length = 0;
    this.memoryUsage = 0;

    this.emit('disposed');
    this.removeAllListeners();
  }

  // Private methods

  private async performModelLoad(assetId: string, priority: AssetPriority): Promise<ModelAsset> {
    // Ensure memory availability
    await this.ensureMemoryAvailable(50); // Reserve 50MB for model

    // Load dependencies first
    await this.loadDependencies(assetId);

    // Simulate model loading (would integrate with actual 3D loader)
    const modelData = await this.simulateAssetLoad(assetId, 'model');
    
    const model: ModelAsset = {
      id: assetId,
      type: 'model',
      vertices: modelData.vertices || new Float32Array(0),
      indices: modelData.indices || new Uint16Array(0),
      materials: modelData.materials || [],
      boundingBox: modelData.boundingBox || { min: [0,0,0], max: [1,1,1] },
      triangleCount: (modelData.indices?.length || 0) / 3,
      memorySize: this.calculateModelMemorySize(modelData)
    };

    // Cache the asset
    this.cacheAsset(assetId, model, 'model');

    this.emit('modelLoaded', { assetId, triangleCount: model.triangleCount });
    return model;
  }

  private async performTextureLoad(assetId: string, priority: AssetPriority): Promise<TextureAsset> {
    await this.ensureMemoryAvailable(20); // Reserve 20MB for texture

    await this.loadDependencies(assetId);

    const textureData = await this.simulateAssetLoad(assetId, 'texture');
    
    const texture: TextureAsset = {
      id: assetId,
      type: 'texture',
      width: textureData.width || 1024,
      height: textureData.height || 1024,
      format: textureData.format || 'RGBA',
      data: textureData.data || new Uint8Array(1024 * 1024 * 4),
      mipmaps: textureData.mipmaps || false,
      memorySize: this.calculateTextureMemorySize(textureData)
    };

    this.cacheAsset(assetId, texture, 'texture');

    this.emit('textureLoaded', { assetId, resolution: `${texture.width}x${texture.height}` });
    return texture;
  }

  private async performAnimationLoad(assetId: string, priority: AssetPriority): Promise<AnimationAsset> {
    await this.ensureMemoryAvailable(10); // Reserve 10MB for animation

    await this.loadDependencies(assetId);

    const animationData = await this.simulateAssetLoad(assetId, 'animation');
    
    const animation: AnimationAsset = {
      id: assetId,
      type: 'animation',
      duration: animationData.duration || 1.0,
      frameRate: animationData.frameRate || 30,
      tracks: animationData.tracks || [],
      compressed: animationData.compressed || false,
      memorySize: this.calculateAnimationMemorySize(animationData)
    };

    this.cacheAsset(assetId, animation, 'animation');

    this.emit('animationLoaded', { assetId, duration: animation.duration });
    return animation;
  }

  private async loadDependencies(assetId: string): Promise<void> {
    const dependencies = this.getAssetDependencies(assetId);
    
    for (const depId of dependencies) {
      if (!this.assetCache.has(depId)) {
        // Determine asset type and load accordingly
        const assetType = this.getAssetType(depId);
        switch (assetType) {
          case 'model':
            await this.loadModel(depId, 'high');
            break;
          case 'texture':
            await this.loadTexture(depId, 'high');
            break;
          case 'animation':
            await this.loadAnimation(depId, 'high');
            break;
        }
      }
    }
  }

  private async ensureMemoryAvailable(requiredMB: number): Promise<void> {
    if (this.memoryUsage + requiredMB > this.maxMemoryMB) {
      const freedMemory = this.performMemoryCleanup(false);
      
      if (this.memoryUsage + requiredMB > this.maxMemoryMB) {
        throw new Error(`Insufficient GPU memory: need ${requiredMB}MB, available ${this.maxMemoryMB - this.memoryUsage}MB`);
      }
    }
  }

  private performMemoryCleanup(force: boolean): number {
    const initialMemory = this.memoryUsage;
    const assets = Array.from(this.assetCache.entries());
    
    // Sort by last access time (LRU)
    assets.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedMemory = 0;
    const targetMemory = force ? this.maxMemoryMB * 0.5 : this.cacheThresholdMB;
    
    for (const [assetId, cached] of assets) {
      if (this.memoryUsage <= targetMemory) break;
      
      if (cached.refCount === 0 || force) {
        if (this.unloadAsset(assetId)) {
          freedMemory += cached.memorySize;
        }
      }
    }

    this.emit('memoryCleanup', { 
      freedMemory, 
      beforeMB: initialMemory, 
      afterMB: this.memoryUsage 
    });

    return freedMemory;
  }

  private cacheAsset(assetId: string, asset: any, type: AssetType): void {
    const cached: CachedAsset = {
      id: assetId,
      type,
      data: asset,
      memorySize: asset.memorySize,
      lastAccessed: Date.now(),
      refCount: 0,
      priority: 'normal'
    };

    this.assetCache.set(assetId, cached);
    this.memoryUsage += asset.memorySize;

    // Trigger cleanup if approaching memory limit
    if (this.memoryUsage > this.cacheThresholdMB) {
      this.performMemoryCleanup(false);
    }
  }

  private updateAccessTime(assetId: string): void {
    const cached = this.assetCache.get(assetId);
    if (cached) {
      cached.lastAccessed = Date.now();
    }
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.isProcessingQueue || this.preloadQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.preloadQueue.length > 0) {
        const assetId = this.preloadQueue.shift()!;
        
        // Skip if already cached
        if (this.assetCache.has(assetId)) {
          continue;
        }

        // Check memory availability
        if (this.memoryUsage > this.cacheThresholdMB) {
          this.preloadQueue.unshift(assetId); // Put back in queue
          break;
        }

        try {
          const assetType = this.getAssetType(assetId);
          switch (assetType) {
            case 'model':
              await this.loadModel(assetId, 'low');
              break;
            case 'texture':
              await this.loadTexture(assetId, 'low');
              break;
            case 'animation':
              await this.loadAnimation(assetId, 'low');
              break;
          }
        } catch (error) {
          this.emit('preloadError', { assetId, error });
        }

        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const stats = this.getMemoryStats();
      this.emit('memoryStats', stats);

      // Auto-cleanup if memory usage is high
      if (stats.utilizationPercent > 90) {
        this.performMemoryCleanup(false);
      }
    }, 5000); // Check every 5 seconds
  }

  private simulateAssetLoad(assetId: string, type: AssetType): Promise<any> {
    // Simulate network/disk loading delay
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          // Simulated asset data based on type
          ...(type === 'model' && {
            vertices: new Float32Array(1000),
            indices: new Uint16Array(500),
            materials: []
          }),
          ...(type === 'texture' && {
            width: 1024,
            height: 1024,
            format: 'RGBA',
            data: new Uint8Array(1024 * 1024 * 4)
          }),
          ...(type === 'animation' && {
            duration: 2.0,
            frameRate: 30,
            tracks: []
          })
        });
      }, Math.random() * 100 + 50); // 50-150ms load time
    });
  }

  private getAssetType(assetId: string): AssetType {
    // Simple heuristic based on asset ID
    if (assetId.includes('model') || assetId.endsWith('.glb') || assetId.endsWith('.gltf')) {
      return 'model';
    } else if (assetId.includes('texture') || assetId.endsWith('.png') || assetId.endsWith('.jpg')) {
      return 'texture';
    } else if (assetId.includes('anim') || assetId.endsWith('.fbx')) {
      return 'animation';
    }
    return 'model'; // Default
  }

  private calculateModelMemorySize(modelData: any): number {
    const vertexSize = (modelData.vertices?.byteLength || 0);
    const indexSize = (modelData.indices?.byteLength || 0);
    const materialSize = (modelData.materials?.length || 0) * 1024; // Estimate
    return Math.ceil((vertexSize + indexSize + materialSize) / (1024 * 1024)); // Convert to MB
  }

  private calculateTextureMemorySize(textureData: any): number {
    const width = textureData.width || 1024;
    const height = textureData.height || 1024;
    const bytesPerPixel = 4; // RGBA
    return Math.ceil((width * height * bytesPerPixel) / (1024 * 1024)); // Convert to MB
  }

  private calculateAnimationMemorySize(animationData: any): number {
    const trackCount = animationData.tracks?.length || 5; // Default track count
    const duration = animationData.duration || 1.0;
    const frameRate = animationData.frameRate || 30;
    const estimatedSize = trackCount * duration * frameRate * 32; // 32 bytes per keyframe estimate
    return Math.max(1, Math.ceil(estimatedSize / (1024 * 1024))); // Convert to MB, minimum 1MB
  }
}

// Types and interfaces

export type AssetType = 'model' | 'texture' | 'animation';
export type AssetPriority = 'low' | 'normal' | 'high';

export interface CachedAsset {
  id: string;
  type: AssetType;
  data: any;
  memorySize: number; // in MB
  lastAccessed: number;
  refCount: number;
  priority: AssetPriority;
}

export interface ModelAsset {
  id: string;
  type: 'model';
  vertices: Float32Array;
  indices: Uint16Array;
  materials: any[];
  boundingBox: { min: number[]; max: number[] };
  triangleCount: number;
  memorySize: number;
}

export interface TextureAsset {
  id: string;
  type: 'texture';
  width: number;
  height: number;
  format: string;
  data: Uint8Array;
  mipmaps: boolean;
  memorySize: number;
}

export interface AnimationAsset {
  id: string;
  type: 'animation';
  duration: number;
  frameRate: number;
  tracks: any[];
  compressed: boolean;
  memorySize: number;
}

export interface AssetMemoryStats {
  totalUsedMB: number;
  maxMemoryMB: number;
  utilizationPercent: number;
  cachedAssets: number;
  loadingAssets: number;
  preloadQueueSize: number;
}