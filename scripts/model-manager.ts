/**
 * AI Model Management Utility
 * Handles downloading, validation, and optimization of AI models for voice pipeline
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface ModelInfo {
  name: string;
  url: string;
  checksum: string;
  size: number;
  version: string;
  platform: 'jetson-nano-orin' | 'generic' | 'all';
  required: boolean;
  description: string;
}

export interface ModelValidationResult {
  isValid: boolean;
  exists: boolean;
  checksumMatch: boolean;
  sizeMatch: boolean;
  errors: string[];
}

export interface DownloadProgress {
  modelName: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
}

export class ModelManager extends EventEmitter {
  private modelsDir: string;
  private modelRegistry: Map<string, ModelInfo> = new Map();
  private downloadQueue: ModelInfo[] = [];
  private isDownloading: boolean = false;

  constructor(modelsDir: string = './models') {
    super();
    this.modelsDir = modelsDir;
    this.initializeModelRegistry();
  }

  /**
   * Initialize the model registry with available models
   */
  private initializeModelRegistry(): void {
    const models: ModelInfo[] = [
      {
        name: 'wake-word-prod.onnx',
        url: 'https://models.voicepipeline.ai/wake-word/v1.2/jetson-nano-orin.onnx',
        checksum: 'sha256:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        size: 15728640, // 15MB
        version: '1.2.0',
        platform: 'jetson-nano-orin',
        required: true,
        description: 'Optimized wake word detection model for Jetson Nano Orin'
      },
      {
        name: 'whisper-base-prod.onnx',
        url: 'https://models.voicepipeline.ai/whisper/base/v2.1/jetson-optimized.onnx',
        checksum: 'sha256:b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
        size: 147456000, // 140MB
        version: '2.1.0',
        platform: 'jetson-nano-orin',
        required: true,
        description: 'Whisper base model optimized for Jetson hardware'
      },
      {
        name: 'intent-classifier-prod.onnx',
        url: 'https://models.voicepipeline.ai/intent/v1.5/family-safe.onnx',
        checksum: 'sha256:c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2',
        size: 52428800, // 50MB
        version: '1.5.0',
        platform: 'all',
        required: true,
        description: 'Family-safe intent classification model'
      },
      {
        name: 'tts-prod.onnx',
        url: 'https://models.voicepipeline.ai/tts/v1.8/neural-voice.onnx',
        checksum: 'sha256:d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3',
        size: 89128960, // 85MB
        version: '1.8.0',
        platform: 'jetson-nano-orin',
        required: true,
        description: 'Neural text-to-speech model with natural voice'
      },
      // Fallback models for offline operation
      {
        name: 'wake-word-lite.onnx',
        url: 'https://models.voicepipeline.ai/wake-word/lite/v1.0/generic.onnx',
        checksum: 'sha256:e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3d4',
        size: 5242880, // 5MB
        version: '1.0.0',
        platform: 'all',
        required: false,
        description: 'Lightweight wake word model for fallback operation'
      },
      {
        name: 'whisper-tiny.onnx',
        url: 'https://models.voicepipeline.ai/whisper/tiny/v1.0/generic.onnx',
        checksum: 'sha256:f6789012345678901234567890abcdef1234567890abcdef1234567ab2c3d4e5',
        size: 39845888, // 38MB
        version: '1.0.0',
        platform: 'all',
        required: false,
        description: 'Tiny Whisper model for resource-constrained operation'
      }
    ];

    models.forEach(model => {
      this.modelRegistry.set(model.name, model);
    });
  }

  /**
   * Ensure models directory exists
   */
  async ensureModelsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create models directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate a specific model
   */
  async validateModel(modelName: string): Promise<ModelValidationResult> {
    const modelInfo = this.modelRegistry.get(modelName);
    if (!modelInfo) {
      return {
        isValid: false,
        exists: false,
        checksumMatch: false,
        sizeMatch: false,
        errors: [`Model ${modelName} not found in registry`]
      };
    }

    const modelPath = path.join(this.modelsDir, modelName);
    const errors: string[] = [];

    // Check if file exists
    let exists = false;
    try {
      await fs.access(modelPath);
      exists = true;
    } catch {
      errors.push(`Model file does not exist: ${modelPath}`);
    }

    let checksumMatch = false;
    let sizeMatch = false;

    if (exists) {
      try {
        // Check file size
        const stats = await fs.stat(modelPath);
        sizeMatch = stats.size === modelInfo.size;
        if (!sizeMatch) {
          errors.push(`Size mismatch: expected ${modelInfo.size}, got ${stats.size}`);
        }

        // Check checksum
        const fileBuffer = await fs.readFile(modelPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const expectedHash = modelInfo.checksum.replace('sha256:', '');
        checksumMatch = hash === expectedHash;
        if (!checksumMatch) {
          errors.push(`Checksum mismatch: expected ${expectedHash}, got ${hash}`);
        }
      } catch (error) {
        errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: exists && checksumMatch && sizeMatch,
      exists,
      checksumMatch,
      sizeMatch,
      errors
    };
  }

  /**
   * Validate all models
   */
  async validateAllModels(): Promise<Map<string, ModelValidationResult>> {
    const results = new Map<string, ModelValidationResult>();
    
    for (const [modelName] of this.modelRegistry) {
      const result = await this.validateModel(modelName);
      results.set(modelName, result);
    }

    return results;
  }

  /**
   * Download a specific model
   */
  async downloadModel(modelName: string, force: boolean = false): Promise<void> {
    const modelInfo = this.modelRegistry.get(modelName);
    if (!modelInfo) {
      throw new Error(`Model ${modelName} not found in registry`);
    }

    const modelPath = path.join(this.modelsDir, modelName);

    // Check if model already exists and is valid (unless force is true)
    if (!force) {
      const validation = await this.validateModel(modelName);
      if (validation.isValid) {
        this.emit('modelSkipped', { modelName, reason: 'Already valid' });
        return;
      }
    }

    await this.ensureModelsDirectory();

    try {
      this.emit('downloadStarted', { modelName, url: modelInfo.url, size: modelInfo.size });

      // In a real implementation, this would use a proper HTTP client with progress tracking
      // For now, we'll simulate the download process
      await this.simulateDownload(modelInfo, modelPath);

      // Validate the downloaded model
      const validation = await this.validateModel(modelName);
      if (!validation.isValid) {
        throw new Error(`Downloaded model failed validation: ${validation.errors.join(', ')}`);
      }

      this.emit('downloadCompleted', { modelName, path: modelPath });
    } catch (error) {
      this.emit('downloadFailed', { modelName, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Download all required models
   */
  async downloadAllModels(platform: string = 'jetson-nano-orin', includeOptional: boolean = false): Promise<void> {
    const modelsToDownload = Array.from(this.modelRegistry.values()).filter(model => {
      const platformMatch = model.platform === 'all' || model.platform === platform;
      const shouldInclude = model.required || includeOptional;
      return platformMatch && shouldInclude;
    });

    this.downloadQueue = [...modelsToDownload];
    this.isDownloading = true;

    try {
      for (const model of modelsToDownload) {
        await this.downloadModel(model.name);
      }
      
      this.emit('allDownloadsCompleted', { count: modelsToDownload.length });
    } catch (error) {
      this.emit('downloadError', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      this.isDownloading = false;
      this.downloadQueue = [];
    }
  }

  /**
   * Get model information
   */
  getModelInfo(modelName: string): ModelInfo | undefined {
    return this.modelRegistry.get(modelName);
  }

  /**
   * List all available models
   */
  listAvailableModels(platform?: string): ModelInfo[] {
    const models = Array.from(this.modelRegistry.values());
    if (platform) {
      return models.filter(model => model.platform === 'all' || model.platform === platform);
    }
    return models;
  }

  /**
   * Get download progress
   */
  getDownloadProgress(): { isDownloading: boolean; queueLength: number; currentModel?: string } {
    return {
      isDownloading: this.isDownloading,
      queueLength: this.downloadQueue.length,
      currentModel: this.downloadQueue[0]?.name
    };
  }

  /**
   * Clean up invalid or corrupted models
   */
  async cleanupInvalidModels(): Promise<string[]> {
    const validationResults = await this.validateAllModels();
    const removedModels: string[] = [];

    for (const [modelName, result] of validationResults) {
      if (result.exists && !result.isValid) {
        try {
          const modelPath = path.join(this.modelsDir, modelName);
          await fs.unlink(modelPath);
          removedModels.push(modelName);
          this.emit('modelRemoved', { modelName, reason: 'Invalid or corrupted' });
        } catch (error) {
          this.emit('cleanupError', { 
            modelName, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
    }

    return removedModels;
  }

  /**
   * Generate model manifest for deployment
   */
  async generateManifest(): Promise<object> {
    const validationResults = await this.validateAllModels();
    const manifest = {
      generatedAt: new Date().toISOString(),
      modelsDirectory: this.modelsDir,
      models: {} as Record<string, any>
    };

    for (const [modelName, result] of validationResults) {
      const modelInfo = this.modelRegistry.get(modelName);
      if (modelInfo) {
        manifest.models[modelName] = {
          ...modelInfo,
          validation: result,
          path: path.join(this.modelsDir, modelName)
        };
      }
    }

    return manifest;
  }

  /**
   * Simulate model download (replace with actual HTTP download in production)
   */
  private async simulateDownload(modelInfo: ModelInfo, outputPath: string): Promise<void> {
    const chunkSize = 1024 * 1024; // 1MB chunks
    let downloadedBytes = 0;
    const startTime = Date.now();

    // Create a placeholder file with the expected size
    const buffer = Buffer.alloc(modelInfo.size);
    
    // Simulate progressive download with events
    while (downloadedBytes < modelInfo.size) {
      const remainingBytes = modelInfo.size - downloadedBytes;
      const currentChunkSize = Math.min(chunkSize, remainingBytes);
      
      downloadedBytes += currentChunkSize;
      const percentage = (downloadedBytes / modelInfo.size) * 100;
      const elapsedTime = (Date.now() - startTime) / 1000;
      const speed = downloadedBytes / elapsedTime;

      this.emit('downloadProgress', {
        modelName: modelInfo.name,
        bytesDownloaded: downloadedBytes,
        totalBytes: modelInfo.size,
        percentage,
        speed
      } as DownloadProgress);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Write the file
    await fs.writeFile(outputPath, buffer);
  }
}

export default ModelManager;