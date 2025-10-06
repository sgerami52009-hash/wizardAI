// Asset Management System Types

import { AgeRange, SafetyRating, PerformanceLevel } from '../avatar/types';

export interface AssetManager {
  loadAsset(assetId: string): Promise<Asset>;
  preloadAssets(assetIds: string[]): Promise<LoadResult[]>;
  unloadAsset(assetId: string): Promise<void>;
  getAssetInfo(assetId: string): Promise<AssetInfo>;
  getCachedAssets(): string[];
  clearCache(): Promise<void>;
  optimizeMemoryUsage(): Promise<MemoryOptimizationResult>;
}

export interface Asset {
  id: string;
  type: AssetType;
  data: ArrayBuffer | string | any;
  metadata: AssetMetadata;
  loadedAt: Date;
  lastAccessed: Date;
  memoryUsage: number; // bytes
}

export interface AssetInfo {
  id: string;
  name: string;
  type: AssetType;
  category: AssetCategory;
  fileSize: number;
  memoryUsage: number;
  ageRestriction: AgeRange;
  safetyRating: SafetyRating;
  performanceImpact: PerformanceLevel;
  dependencies: string[];
  tags: string[];
  version: string;
  checksum: string;
}

export interface AssetMetadata {
  name: string;
  description: string;
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  ageRestriction: AgeRange;
  safetyRating: SafetyRating;
  performanceImpact: PerformanceLevel;
  dependencies: string[];
  license: string;
  attribution?: string;
}

export interface LoadResult {
  assetId: string;
  success: boolean;
  loadTime: number;
  memoryUsage: number;
  error?: string;
}

export interface MemoryOptimizationResult {
  freedMemory: number; // bytes
  unloadedAssets: string[];
  optimizationActions: string[];
  newMemoryUsage: number;
}

export interface AssetCache {
  get(assetId: string): Asset | undefined;
  set(assetId: string, asset: Asset): void;
  has(assetId: string): boolean;
  delete(assetId: string): boolean;
  clear(): void;
  size(): number;
  getMemoryUsage(): number;
  getLeastRecentlyUsed(count: number): string[];
}

export interface AssetLoader {
  canLoad(assetType: AssetType): boolean;
  load(assetPath: string, metadata: AssetMetadata): Promise<Asset>;
  validate(asset: Asset): Promise<ValidationResult>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  safetyIssues: string[];
}

// Enums
export enum AssetType {
  MODEL_3D = 'model_3d',
  TEXTURE = 'texture',
  ANIMATION = 'animation',
  AUDIO = 'audio',
  SHADER = 'shader',
  MATERIAL = 'material',
  FONT = 'font',
  SCRIPT = 'script'
}

export enum AssetCategory {
  FACE = 'face',
  HAIR = 'hair',
  CLOTHING = 'clothing',
  ACCESSORIES = 'accessories',
  EXPRESSIONS = 'expressions',
  GESTURES = 'gestures',
  VOICE_SAMPLES = 'voice_samples',
  BACKGROUNDS = 'backgrounds',
  EFFECTS = 'effects'
}

export enum LoadPriority {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
  BACKGROUND = 'background'
}

export enum CacheStrategy {
  ALWAYS = 'always',        // Keep in cache until manually removed
  LRU = 'lru',             // Least Recently Used eviction
  TTL = 'ttl',             // Time To Live based eviction
  MEMORY_PRESSURE = 'memory_pressure' // Evict when memory is low
}