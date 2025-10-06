/**
 * Offline Model Manager - Manages local AI models for offline operation
 * Handles model validation, integrity checking, updates, and fallback loading
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: 'wake-word' | 'speech-recognition' | 'text-to-speech' | 'intent-classification';
  filePath: string;
  fileSize: number;
  checksum: string;
  isLoaded: boolean;
  isValid: boolean;
  lastValidated: Date;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  hardwareOptimized: boolean;
  fallbackFor?: string; // ID of primary model this is a fallback for
}

export interface ModelValidationResult {
  modelId: string;
  isValid: boolean;
  issues: string[];
  checksumMatch: boolean;
  fileExists: boolean;
  fileSize: number;
  validationTime: number;
}

export interface ModelUpdateInfo {
  modelId: string;
  currentVersion: string;
  availableVersion: string;
  updateSize: number;
  isRequired: boolean;
  releaseNotes: string;
}

export interface ModelLoadResult {
  modelId: string;
  success: boolean;
  loadTime: number;
  memoryUsage: number;
  error?: string;
  fallbackUsed: boolean;
}

export interface ModelManagerConfig {
  modelsDirectory: string;
  enableAutoValidation: boolean;
  validationInterval: number; // milliseconds
  enableCompression: boolean;
  maxMemoryUsage: number; // bytes
  enableFallbacks: boolean;
  checksumAlgorithm: 'sha256' | 'md5';
}

export class OfflineModelManager extends EventEmitter {
  private models: Map<string, ModelInfo> = new Map();
  private loadedModels: Map<string, any> = new Map(); // Actual model instances
  private config: ModelManagerConfig;
  private validationInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config?: Partial<ModelManagerConfig>) {
    super();

    this.config = {
      modelsDirectory: './models',
      enableAutoValidation: true,
      validationInterval: 300000, // 5 minutes
      enableCompression: true,
      maxMemoryUsage: 2 * 1024 * 1024 * 1024, // 2GB
      enableFallbacks: true,
      checksumAlgorithm: 'sha256',
      ...config
    };
  }

  /**
   * Initialize the model manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('OfflineModelManager already initialized');
      return;
    }

    try {
      // Ensure models directory exists
      await this.ensureModelsDirectory();

      // Discover and register models
      await this.discoverModels();

      // Validate all models
      await this.validateAllModels();

      // Start auto-validation if enabled
      if (this.config.enableAutoValidation) {
        this.startAutoValidation();
      }

      this.isInitialized = true;
      this.emit('initialized', {
        totalModels: this.models.size,
        validModels: Array.from(this.models.values()).filter(m => m.isValid).length
      });

      console.log('OfflineModelManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineModelManager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the model manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop auto-validation
      if (this.validationInterval) {
        clearInterval(this.validationInterval);
        this.validationInterval = null;
      }

      // Unload all models
      await this.unloadAllModels();

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('OfflineModelManager shutdown complete');
    } catch (error) {
      console.error('Error during OfflineModelManager shutdown:', error);
    }
  }

  /**
   * Ensure models directory exists
   */
  private async ensureModelsDirectory(): Promise<void> {
    try {
      await fs.access(this.config.modelsDirectory);
    } catch {
      await fs.mkdir(this.config.modelsDirectory, { recursive: true });
    }
  }

  /**
   * Discover models in the models directory
   */
  private async discoverModels(): Promise<void> {
    try {
      const entries = await fs.readdir(this.config.modelsDirectory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && this.isModelFile(entry.name)) {
          await this.registerModel(entry.name);
        }
      }

      console.log(`Discovered ${this.models.size} models`);
    } catch (error) {
      console.error('Error discovering models:', error);
      throw error;
    }
  }

  /**
   * Check if file is a model file
   */
  private isModelFile(filename: string): boolean {
    const modelExtensions = ['.onnx', '.tflite', '.bin', '.model', '.pt', '.pth'];
    return modelExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  /**
   * Register a model from file
   */
  private async registerModel(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.config.modelsDirectory, filename);
      const stats = await fs.stat(filePath);
      
      // Parse model info from filename (convention: type_name_version.ext)
      const modelInfo = this.parseModelFilename(filename);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);

      const model: ModelInfo = {
        id: modelInfo.id,
        name: modelInfo.name,
        version: modelInfo.version,
        type: modelInfo.type,
        filePath,
        fileSize: stats.size,
        checksum,
        isLoaded: false,
        isValid: false, // Will be validated separately
        lastValidated: new Date(),
        compressionLevel: this.detectCompressionLevel(filename),
        hardwareOptimized: this.isHardwareOptimized(filename),
        fallbackFor: modelInfo.fallbackFor
      };

      this.models.set(model.id, model);
      console.log(`Registered model: ${model.id} (${model.type})`);
    } catch (error) {
      console.error(`Error registering model ${filename}:`, error);
    }
  }

  /**
   * Parse model information from filename
   */
  private parseModelFilename(filename: string): {
    id: string;
    name: string;
    version: string;
    type: ModelInfo['type'];
    fallbackFor?: string;
  } {
    // Expected format: type_name_version[_fallback].ext
    // Example: wake-word_hey-assistant_v1.2.0.onnx
    // Example: speech-recognition_whisper_v1.0.0_fallback.tflite
    
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const parts = nameWithoutExt.split('_');
    
    if (parts.length < 3) {
      throw new Error(`Invalid model filename format: ${filename}`);
    }

    const type = parts[0] as ModelInfo['type'];
    const name = parts[1];
    const version = parts[2];
    const isFallback = parts.includes('fallback');
    
    // Validate type
    const validTypes: ModelInfo['type'][] = ['wake-word', 'speech-recognition', 'text-to-speech', 'intent-classification'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid model type: ${type}`);
    }

    const id = `${type}_${name}_${version}${isFallback ? '_fallback' : ''}`;
    
    return {
      id,
      name,
      version,
      type,
      fallbackFor: isFallback ? `${type}_${name}_${version}` : undefined
    };
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash(this.config.checksumAlgorithm);
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error(`Error calculating checksum for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Detect compression level from filename
   */
  private detectCompressionLevel(filename: string): ModelInfo['compressionLevel'] {
    if (filename.includes('_compressed_high')) return 'high';
    if (filename.includes('_compressed_medium')) return 'medium';
    if (filename.includes('_compressed_low')) return 'low';
    return 'none';
  }

  /**
   * Check if model is hardware optimized
   */
  private isHardwareOptimized(filename: string): boolean {
    return filename.includes('_jetson') || filename.includes('_arm64') || filename.includes('_optimized');
  }

  /**
   * Validate all models
   */
  async validateAllModels(): Promise<ModelValidationResult[]> {
    const results: ModelValidationResult[] = [];
    
    for (const model of Array.from(this.models.values())) {
      const result = await this.validateModel(model.id);
      results.push(result);
    }

    const validCount = results.filter(r => r.isValid).length;
    console.log(`Model validation complete: ${validCount}/${results.length} models valid`);

    this.emit('validationComplete', {
      totalModels: results.length,
      validModels: validCount,
      results
    });

    return results;
  }

  /**
   * Validate a specific model
   */
  async validateModel(modelId: string): Promise<ModelValidationResult> {
    const startTime = Date.now();
    const model = this.models.get(modelId);
    
    if (!model) {
      return {
        modelId,
        isValid: false,
        issues: ['Model not found'],
        checksumMatch: false,
        fileExists: false,
        fileSize: 0,
        validationTime: Date.now() - startTime
      };
    }

    const issues: string[] = [];
    let fileExists = false;
    let fileSize = 0;
    let checksumMatch = false;

    try {
      // Check file existence
      const stats = await fs.stat(model.filePath);
      fileExists = true;
      fileSize = stats.size;

      // Validate file size
      if (fileSize !== model.fileSize) {
        issues.push(`File size mismatch: expected ${model.fileSize}, got ${fileSize}`);
      }

      // Validate checksum
      const currentChecksum = await this.calculateChecksum(model.filePath);
      checksumMatch = currentChecksum === model.checksum;
      
      if (!checksumMatch) {
        issues.push('Checksum mismatch - file may be corrupted');
      }

      // Validate model format (basic check)
      if (!await this.validateModelFormat(model)) {
        issues.push('Invalid model format or corrupted file');
      }

    } catch (error) {
      issues.push(`File access error: ${error.message}`);
    }

    const isValid = issues.length === 0;
    
    // Update model status
    model.isValid = isValid;
    model.lastValidated = new Date();

    const result: ModelValidationResult = {
      modelId,
      isValid,
      issues,
      checksumMatch,
      fileExists,
      fileSize,
      validationTime: Date.now() - startTime
    };

    if (!isValid) {
      this.emit('modelValidationFailed', { modelId, issues });
    }

    return result;
  }

  /**
   * Validate model file format
   */
  private async validateModelFormat(model: ModelInfo): Promise<boolean> {
    try {
      // Basic file header validation
      const buffer = Buffer.alloc(16);
      const file = await fs.open(model.filePath, 'r');
      await file.read(buffer, 0, 16, 0);
      await file.close();

      // Check for common model file signatures
      const header = buffer.toString('hex');
      
      // ONNX files start with specific bytes
      if (model.filePath.endsWith('.onnx')) {
        return header.startsWith('08') || buffer.toString('ascii', 0, 4) === 'ONNX';
      }
      
      // TensorFlow Lite files have specific magic bytes
      if (model.filePath.endsWith('.tflite')) {
        return header.includes('544c4954') || buffer.toString('ascii', 0, 8).includes('TFL3');
      }

      // For other formats, just check if file is readable and not empty
      return buffer.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Load a model into memory
   */
  async loadModel(modelId: string, useOptimization = true): Promise<ModelLoadResult> {
    const startTime = Date.now();
    const model = this.models.get(modelId);
    
    if (!model) {
      return {
        modelId,
        success: false,
        loadTime: Date.now() - startTime,
        memoryUsage: 0,
        error: 'Model not found',
        fallbackUsed: false
      };
    }

    if (!model.isValid) {
      // Try to load fallback model
      if (this.config.enableFallbacks) {
        const fallbackResult = await this.loadFallbackModel(modelId);
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }

      return {
        modelId,
        success: false,
        loadTime: Date.now() - startTime,
        memoryUsage: 0,
        error: 'Model is invalid and no fallback available',
        fallbackUsed: false
      };
    }

    try {
      // Check memory constraints
      const currentMemoryUsage = this.getCurrentMemoryUsage();
      if (currentMemoryUsage + model.fileSize > this.config.maxMemoryUsage) {
        throw new Error('Insufficient memory to load model');
      }

      // Simulate model loading (in real implementation, this would use actual ML libraries)
      const modelInstance = await this.loadModelFile(model, useOptimization);
      
      this.loadedModels.set(modelId, modelInstance);
      model.isLoaded = true;

      const loadTime = Date.now() - startTime;
      const memoryUsage = this.estimateModelMemoryUsage(model);

      this.emit('modelLoaded', {
        modelId,
        loadTime,
        memoryUsage,
        optimization: useOptimization
      });

      return {
        modelId,
        success: true,
        loadTime,
        memoryUsage,
        fallbackUsed: false
      };

    } catch (error) {
      // Try fallback if primary model fails
      if (this.config.enableFallbacks) {
        const fallbackResult = await this.loadFallbackModel(modelId);
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }

      return {
        modelId,
        success: false,
        loadTime: Date.now() - startTime,
        memoryUsage: 0,
        error: error.message,
        fallbackUsed: false
      };
    }
  }

  /**
   * Load fallback model
   */
  private async loadFallbackModel(primaryModelId: string): Promise<ModelLoadResult> {
    const fallbackModel = Array.from(this.models.values())
      .find(m => m.fallbackFor === primaryModelId && m.isValid);

    if (!fallbackModel) {
      return {
        modelId: primaryModelId,
        success: false,
        loadTime: 0,
        memoryUsage: 0,
        error: 'No valid fallback model available',
        fallbackUsed: false
      };
    }

    console.log(`Loading fallback model ${fallbackModel.id} for ${primaryModelId}`);
    
    const result = await this.loadModel(fallbackModel.id, false); // Don't use optimization for fallback
    result.fallbackUsed = true;
    result.modelId = primaryModelId; // Keep original model ID for caller

    return result;
  }

  /**
   * Load model file (simulated)
   */
  private async loadModelFile(model: ModelInfo, useOptimization: boolean): Promise<any> {
    // Simulate loading time based on file size and optimization
    const baseLoadTime = Math.min(model.fileSize / (1024 * 1024), 5000); // Max 5 seconds
    const optimizationFactor = useOptimization && model.hardwareOptimized ? 0.7 : 1.0;
    const loadTime = baseLoadTime * optimizationFactor;

    await new Promise(resolve => setTimeout(resolve, loadTime));

    // Return mock model instance
    return {
      id: model.id,
      type: model.type,
      version: model.version,
      loaded: true,
      optimized: useOptimization && model.hardwareOptimized
    };
  }

  /**
   * Unload a model from memory
   */
  async unloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    const modelInstance = this.loadedModels.get(modelId);

    if (model && modelInstance) {
      // Cleanup model instance
      this.loadedModels.delete(modelId);
      model.isLoaded = false;

      this.emit('modelUnloaded', { modelId });
      console.log(`Unloaded model: ${modelId}`);
    }
  }

  /**
   * Unload all models
   */
  async unloadAllModels(): Promise<void> {
    const loadedModelIds = Array.from(this.loadedModels.keys());
    
    for (const modelId of loadedModelIds) {
      await this.unloadModel(modelId);
    }

    console.log(`Unloaded ${loadedModelIds.length} models`);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    return Array.from(this.models.values())
      .filter(m => m.isLoaded)
      .reduce((total, model) => total + this.estimateModelMemoryUsage(model), 0);
  }

  /**
   * Estimate model memory usage
   */
  private estimateModelMemoryUsage(model: ModelInfo): number {
    // Rough estimation: file size * compression factor * runtime overhead
    const compressionFactors = {
      'none': 1.5,
      'low': 1.3,
      'medium': 1.1,
      'high': 0.9
    };

    return model.fileSize * compressionFactors[model.compressionLevel];
  }

  /**
   * Start auto-validation
   */
  private startAutoValidation(): void {
    this.validationInterval = setInterval(async () => {
      try {
        await this.validateAllModels();
      } catch (error) {
        console.error('Auto-validation failed:', error);
      }
    }, this.config.validationInterval);
  }

  /**
   * Get model information
   */
  getModelInfo(modelId: string): ModelInfo | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Get all models
   */
  getAllModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models by type
   */
  getModelsByType(type: ModelInfo['type']): ModelInfo[] {
    return Array.from(this.models.values()).filter(m => m.type === type);
  }

  /**
   * Get loaded models
   */
  getLoadedModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter(m => m.isLoaded);
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model ? model.isLoaded : false;
  }

  /**
   * Get model instance
   */
  getModelInstance(modelId: string): any | null {
    return this.loadedModels.get(modelId) || null;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalUsage: number;
    maxUsage: number;
    loadedModels: number;
    availableMemory: number;
    usagePercentage: number;
  } {
    const totalUsage = this.getCurrentMemoryUsage();
    const maxUsage = this.config.maxMemoryUsage;
    const loadedModels = this.getLoadedModels().length;
    const availableMemory = maxUsage - totalUsage;
    const usagePercentage = (totalUsage / maxUsage) * 100;

    return {
      totalUsage,
      maxUsage,
      loadedModels,
      availableMemory,
      usagePercentage
    };
  }

  /**
   * Optimize memory usage by unloading least recently used models
   */
  async optimizeMemoryUsage(): Promise<void> {
    const memoryStats = this.getMemoryStats();
    
    if (memoryStats.usagePercentage < 80) {
      return; // No optimization needed
    }

    console.log('Optimizing memory usage...');
    
    // Get loaded models sorted by last validation time (proxy for usage)
    const loadedModels = this.getLoadedModels()
      .sort((a, b) => a.lastValidated.getTime() - b.lastValidated.getTime());

    // Unload models until we're under 70% memory usage
    for (const model of loadedModels) {
      await this.unloadModel(model.id);
      
      const newStats = this.getMemoryStats();
      if (newStats.usagePercentage < 70) {
        break;
      }
    }

    this.emit('memoryOptimized', this.getMemoryStats());
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ModelManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-validation if interval changed
    if (newConfig.validationInterval && this.validationInterval) {
      clearInterval(this.validationInterval);
      this.startAutoValidation();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelManagerConfig {
    return { ...this.config };
  }
}