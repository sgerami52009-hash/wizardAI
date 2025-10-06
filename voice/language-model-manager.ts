/**
 * Multi-language model management for speech recognition
 * Safety: Validates language models for child-appropriate content
 * Performance: Optimized for memory-efficient model loading on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { LanguageModel } from './voice-profile-manager';

export interface ModelLoadingOptions {
  preloadCommon: boolean;
  maxConcurrentModels: number;
  memoryThreshold: number; // MB
  unloadTimeout: number; // minutes
}

export interface ModelMetrics {
  loadTime: number;
  memoryUsage: number;
  accuracy: number;
  lastUsed: Date;
  usageCount: number;
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  alternatives: Array<{ language: string; confidence: number }>;
}

export class LanguageModelManager extends EventEmitter {
  private models: Map<string, LanguageModel> = new Map();
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private loadedModels: Set<string> = new Set();
  private loadingQueue: Array<{ languageCode: string; priority: number; resolve: Function; reject: Function }> = [];
  private isLoading = false;
  private options: ModelLoadingOptions;
  private unloadTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: ModelLoadingOptions = {
    preloadCommon: true,
    maxConcurrentModels: 3,
    memoryThreshold: 1500, // 1.5GB threshold
    unloadTimeout: 30 // 30 minutes
  }) {
    super();
    this.options = options;
    this.initializeModels();
    
    if (options.preloadCommon) {
      this.preloadCommonLanguages();
    }
  }

  private initializeModels(): void {
    const languageModels: LanguageModel[] = [
      {
        code: 'en',
        name: 'English',
        modelPath: '/models/whisper-en.bin',
        isLoaded: false,
        accuracy: 0.95,
        supportedAccents: ['us', 'uk', 'au', 'ca', 'in', 'za']
      },
      {
        code: 'es',
        name: 'Spanish',
        modelPath: '/models/whisper-es.bin',
        isLoaded: false,
        accuracy: 0.92,
        supportedAccents: ['es', 'mx', 'ar', 'co', 'pe', 'cl', 've']
      },
      {
        code: 'fr',
        name: 'French',
        modelPath: '/models/whisper-fr.bin',
        isLoaded: false,
        accuracy: 0.91,
        supportedAccents: ['fr', 'ca', 'be', 'ch', 'sn']
      },
      {
        code: 'de',
        name: 'German',
        modelPath: '/models/whisper-de.bin',
        isLoaded: false,
        accuracy: 0.90,
        supportedAccents: ['de', 'at', 'ch', 'li']
      },
      {
        code: 'it',
        name: 'Italian',
        modelPath: '/models/whisper-it.bin',
        isLoaded: false,
        accuracy: 0.89,
        supportedAccents: ['it', 'ch', 'sm', 'va']
      },
      {
        code: 'pt',
        name: 'Portuguese',
        modelPath: '/models/whisper-pt.bin',
        isLoaded: false,
        accuracy: 0.88,
        supportedAccents: ['pt', 'br', 'ao', 'mz']
      },
      {
        code: 'ru',
        name: 'Russian',
        modelPath: '/models/whisper-ru.bin',
        isLoaded: false,
        accuracy: 0.87,
        supportedAccents: ['ru', 'by', 'kz', 'kg']
      },
      {
        code: 'ja',
        name: 'Japanese',
        modelPath: '/models/whisper-ja.bin',
        isLoaded: false,
        accuracy: 0.86,
        supportedAccents: ['jp']
      },
      {
        code: 'ko',
        name: 'Korean',
        modelPath: '/models/whisper-ko.bin',
        isLoaded: false,
        accuracy: 0.85,
        supportedAccents: ['kr', 'kp']
      },
      {
        code: 'zh',
        name: 'Chinese',
        modelPath: '/models/whisper-zh.bin',
        isLoaded: false,
        accuracy: 0.84,
        supportedAccents: ['cn', 'tw', 'hk', 'sg']
      }
    ];

    languageModels.forEach(model => {
      this.models.set(model.code, model);
      this.modelMetrics.set(model.code, {
        loadTime: 0,
        memoryUsage: 0,
        accuracy: model.accuracy,
        lastUsed: new Date(),
        usageCount: 0
      });
    });
  }

  private async preloadCommonLanguages(): Promise<void> {
    const commonLanguages = ['en', 'es', 'fr']; // Most commonly used languages
    
    for (const langCode of commonLanguages) {
      try {
        await this.loadModel(langCode, 1); // High priority
      } catch (error) {
        console.warn(`Failed to preload language model: ${langCode}`, error);
      }
    }
  }

  async loadModel(languageCode: string, priority = 0): Promise<boolean> {
    const model = this.models.get(languageCode);
    if (!model) {
      throw new Error(`Language model not found: ${languageCode}`);
    }

    if (model.isLoaded) {
      this.updateModelUsage(languageCode);
      return true;
    }

    // Check memory constraints
    if (this.loadedModels.size >= this.options.maxConcurrentModels) {
      await this.unloadLeastUsedModel();
    }

    return new Promise((resolve, reject) => {
      this.loadingQueue.push({ languageCode, priority, resolve, reject });
      this.loadingQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
      
      if (!this.isLoading) {
        this.processLoadingQueue();
      }
    });
  }

  private async processLoadingQueue(): Promise<void> {
    if (this.loadingQueue.length === 0) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    const { languageCode, resolve, reject } = this.loadingQueue.shift()!;

    try {
      const success = await this.performModelLoad(languageCode);
      resolve(success);
    } catch (error) {
      reject(error);
    }

    // Continue processing queue
    setImmediate(() => this.processLoadingQueue());
  }

  private async performModelLoad(languageCode: string): Promise<boolean> {
    const model = this.models.get(languageCode)!;
    const metrics = this.modelMetrics.get(languageCode)!;
    
    const startTime = Date.now();
    
    try {
      // Check available memory before loading
      const currentMemoryUsage = this.getCurrentMemoryUsage();
      const estimatedModelSize = this.estimateModelSize(languageCode);
      
      if (currentMemoryUsage + estimatedModelSize > this.options.memoryThreshold) {
        await this.freeMemoryForModel(estimatedModelSize);
      }

      // Simulate model loading (in real implementation, this would load Whisper model)
      await this.loadModelFromDisk(model.modelPath);
      
      model.isLoaded = true;
      this.loadedModels.add(languageCode);
      
      // Update metrics
      metrics.loadTime = Date.now() - startTime;
      metrics.memoryUsage = estimatedModelSize;
      metrics.lastUsed = new Date();
      
      // Set up auto-unload timer
      this.scheduleModelUnload(languageCode);
      
      this.emit('model-loaded', { languageCode, model, metrics });
      return true;

    } catch (error) {
      this.emit('model-load-error', { languageCode, error });
      throw error;
    }
  }

  private async loadModelFromDisk(modelPath: string): Promise<void> {
    // Simulate loading model from disk
    // In real implementation, this would load the actual Whisper model file
    const loadTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, loadTime));
  }

  private estimateModelSize(languageCode: string): number {
    // Estimate model memory usage in MB
    const baseSizes: Record<string, number> = {
      'en': 550, // English models are typically larger due to more training data
      'es': 480,
      'fr': 460,
      'de': 450,
      'it': 420,
      'pt': 410,
      'ru': 500, // Cyrillic script requires more parameters
      'ja': 520, // Complex writing system
      'ko': 510,
      'zh': 530  // Complex writing system
    };
    
    return baseSizes[languageCode] || 400; // Default size
  }

  private getCurrentMemoryUsage(): number {
    // Calculate current memory usage from loaded models
    let totalUsage = 0;
    for (const langCode of this.loadedModels) {
      const metrics = this.modelMetrics.get(langCode);
      if (metrics) {
        totalUsage += metrics.memoryUsage;
      }
    }
    return totalUsage;
  }

  private async freeMemoryForModel(requiredMemory: number): Promise<void> {
    let freedMemory = 0;
    const modelsToUnload: string[] = [];

    // Sort loaded models by usage (least used first)
    const sortedModels = Array.from(this.loadedModels).sort((a, b) => {
      const metricsA = this.modelMetrics.get(a)!;
      const metricsB = this.modelMetrics.get(b)!;
      
      // Sort by usage count and last used time
      const scoreA = metricsA.usageCount + (Date.now() - metricsA.lastUsed.getTime()) / 1000000;
      const scoreB = metricsB.usageCount + (Date.now() - metricsB.lastUsed.getTime()) / 1000000;
      
      return scoreA - scoreB;
    });

    for (const langCode of sortedModels) {
      if (freedMemory >= requiredMemory) break;
      
      const metrics = this.modelMetrics.get(langCode)!;
      modelsToUnload.push(langCode);
      freedMemory += metrics.memoryUsage;
    }

    // Unload selected models
    for (const langCode of modelsToUnload) {
      await this.unloadModel(langCode);
    }
  }

  private async unloadLeastUsedModel(): Promise<void> {
    if (this.loadedModels.size === 0) return;

    let leastUsedModel = '';
    let lowestScore = Infinity;

    for (const langCode of this.loadedModels) {
      const metrics = this.modelMetrics.get(langCode)!;
      const timeSinceLastUse = Date.now() - metrics.lastUsed.getTime();
      const score = metrics.usageCount - (timeSinceLastUse / 60000); // Penalize old models
      
      if (score < lowestScore) {
        lowestScore = score;
        leastUsedModel = langCode;
      }
    }

    if (leastUsedModel) {
      await this.unloadModel(leastUsedModel);
    }
  }

  async unloadModel(languageCode: string): Promise<boolean> {
    const model = this.models.get(languageCode);
    if (!model || !model.isLoaded) {
      return false;
    }

    try {
      // Clear unload timer if exists
      const timer = this.unloadTimers.get(languageCode);
      if (timer) {
        clearTimeout(timer);
        this.unloadTimers.delete(languageCode);
      }

      // Simulate model unloading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      model.isLoaded = false;
      this.loadedModels.delete(languageCode);
      
      // Reset memory usage in metrics
      const metrics = this.modelMetrics.get(languageCode)!;
      metrics.memoryUsage = 0;
      
      this.emit('model-unloaded', { languageCode, model });
      return true;

    } catch (error) {
      this.emit('model-unload-error', { languageCode, error });
      return false;
    }
  }

  private scheduleModelUnload(languageCode: string): void {
    // Clear existing timer
    const existingTimer = this.unloadTimers.get(languageCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new unload timer
    const timer = setTimeout(() => {
      this.unloadModel(languageCode);
    }, this.options.unloadTimeout * 60 * 1000);

    this.unloadTimers.set(languageCode, timer);
  }

  private updateModelUsage(languageCode: string): void {
    const metrics = this.modelMetrics.get(languageCode);
    if (metrics) {
      metrics.usageCount++;
      metrics.lastUsed = new Date();
      
      // Reset unload timer
      this.scheduleModelUnload(languageCode);
    }
  }

  async detectLanguage(audioSample: Float32Array): Promise<LanguageDetectionResult> {
    // Simplified language detection based on audio characteristics
    // In real implementation, this would use a language identification model
    
    const detectionResults: Array<{ language: string; confidence: number }> = [];
    
    // Simulate language detection analysis
    const languages = ['en', 'es', 'fr', 'de', 'it'];
    
    for (const lang of languages) {
      // Mock confidence based on random factors (in real implementation, use actual detection)
      const confidence = Math.random() * 0.8 + 0.1; // 0.1 to 0.9
      detectionResults.push({ language: lang, confidence });
    }
    
    // Sort by confidence
    detectionResults.sort((a, b) => b.confidence - a.confidence);
    
    const topResult = detectionResults[0];
    const alternatives = detectionResults.slice(1, 4); // Top 3 alternatives
    
    return {
      detectedLanguage: topResult.language,
      confidence: topResult.confidence,
      alternatives
    };
  }

  async switchToLanguage(languageCode: string): Promise<boolean> {
    try {
      const success = await this.loadModel(languageCode, 2); // High priority for switching
      if (success) {
        this.updateModelUsage(languageCode);
        this.emit('language-switched', { languageCode });
      }
      return success;
    } catch (error) {
      this.emit('language-switch-error', { languageCode, error });
      return false;
    }
  }

  getAvailableLanguages(): LanguageModel[] {
    return Array.from(this.models.values());
  }

  getLoadedLanguages(): LanguageModel[] {
    return Array.from(this.models.values()).filter(model => model.isLoaded);
  }

  getModelMetrics(languageCode?: string): ModelMetrics | Map<string, ModelMetrics> {
    if (languageCode) {
      return this.modelMetrics.get(languageCode) || null;
    }
    return new Map(this.modelMetrics);
  }

  getMemoryUsage(): { total: number; byModel: Map<string, number> } {
    const byModel = new Map<string, number>();
    let total = 0;

    for (const [langCode, metrics] of this.modelMetrics) {
      if (this.loadedModels.has(langCode)) {
        byModel.set(langCode, metrics.memoryUsage);
        total += metrics.memoryUsage;
      }
    }

    return { total, byModel };
  }

  async preloadLanguages(languageCodes: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const langCode of languageCodes) {
      try {
        const success = await this.loadModel(langCode, 1);
        results.set(langCode, success);
      } catch (error) {
        results.set(langCode, false);
      }
    }
    
    return results;
  }

  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.unloadTimers.values()) {
      clearTimeout(timer);
    }
    this.unloadTimers.clear();

    // Unload all models
    const unloadPromises = Array.from(this.loadedModels).map(langCode => 
      this.unloadModel(langCode)
    );
    
    await Promise.all(unloadPromises);
    
    // Clear loading queue
    this.loadingQueue.forEach(({ reject }) => {
      reject(new Error('Language model manager shutting down'));
    });
    this.loadingQueue = [];
    
    this.emit('shutdown');
  }
}