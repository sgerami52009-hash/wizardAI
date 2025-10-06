/**
 * Wake Word Management System
 * Handles multiple wake word models, training data validation, and runtime management
 * Safety: Validates all wake word phrases for child-appropriate content
 * Performance: Efficient model loading and memory management for Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { WakeWordDetectorImpl, WakeWordModel, WakeWordConfig } from './wake-word-detector';
import { voiceEventBus, VoiceEventTypes } from './event-bus';
import { ContentSafetyFilter } from '../safety/interfaces';

export interface WakeWordProfile {
  id: string;
  phrase: string;
  userId?: string; // Optional user-specific wake word
  isActive: boolean;
  priority: number; // Higher priority = processed first
  modelPath: string;
  trainingData?: TrainingDataSet;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  safetyValidated: boolean;
}

export interface TrainingDataSet {
  positiveExamples: AudioExample[];
  negativeExamples: AudioExample[];
  validationExamples: AudioExample[];
  metadata: TrainingMetadata;
}

export interface AudioExample {
  id: string;
  audioData: Float32Array;
  sampleRate: number;
  duration: number;
  speaker?: string;
  environment?: string;
  quality: 'high' | 'medium' | 'low';
}

export interface TrainingMetadata {
  totalExamples: number;
  speakerCount: number;
  environmentVariations: string[];
  qualityDistribution: Record<string, number>;
  validationAccuracy?: number;
  createdAt: Date;
}

export interface WakeWordManagerConfig {
  maxActiveWakeWords: number;
  modelStoragePath: string;
  trainingDataPath: string;
  autoValidation: boolean;
  safetyValidation: boolean;
  cacheModels: boolean;
  maxCacheSize: number;
}

export class WakeWordManager extends EventEmitter {
  private detector: WakeWordDetectorImpl;
  private profiles: Map<string, WakeWordProfile> = new Map();
  private config: WakeWordManagerConfig;
  private safetyFilter?: ContentSafetyFilter;
  private modelCache: Map<string, WakeWordModel> = new Map();
  private isInitialized: boolean = false;

  constructor(
    detector: WakeWordDetectorImpl,
    config: Partial<WakeWordManagerConfig> = {},
    safetyFilter?: ContentSafetyFilter
  ) {
    super();
    
    this.detector = detector;
    this.safetyFilter = safetyFilter;
    
    this.config = {
      maxActiveWakeWords: 3, // Conservative for Jetson Nano Orin
      modelStoragePath: './models/wake-words',
      trainingDataPath: './data/wake-words',
      autoValidation: true,
      safetyValidation: true,
      cacheModels: true,
      maxCacheSize: 5,
      ...config
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the wake word manager
   * Performance: Load existing profiles and validate models
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load existing wake word profiles
      await this.loadExistingProfiles();
      
      // Validate and activate default wake words
      await this.activateDefaultWakeWords();
      
      this.isInitialized = true;

      await voiceEventBus.publishEvent({
        id: this.generateEventId(),
        type: VoiceEventTypes.WAKE_WORD_MANAGER_INITIALIZED,
        timestamp: new Date(),
        source: 'WakeWordManager',
        data: {
          profileCount: this.profiles.size,
          activeCount: this.getActiveProfiles().length
        },
        priority: 'medium'
      });

      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Add a new wake word with validation
   * Safety: Validates phrase appropriateness and training data quality
   */
  async addWakeWord(
    phrase: string,
    options: {
      userId?: string;
      priority?: number;
      trainingData?: TrainingDataSet;
      modelPath?: string;
    } = {}
  ): Promise<string> {
    try {
      // Validate phrase safety
      if (this.config.safetyValidation && this.safetyFilter) {
        const safetyResult = await this.safetyFilter.validateInput(phrase, options.userId || 'system');
        if (!safetyResult.isAllowed) {
          throw new Error(`Wake word phrase rejected: ${safetyResult.blockedReasons.join(', ')}`);
        }
      }

      // Check if phrase already exists
      const existingProfile = Array.from(this.profiles.values())
        .find(p => p.phrase.toLowerCase() === phrase.toLowerCase());
      
      if (existingProfile) {
        throw new Error(`Wake word "${phrase}" already exists`);
      }

      // Check active wake word limit
      const activeCount = this.getActiveProfiles().length;
      if (activeCount >= this.config.maxActiveWakeWords) {
        throw new Error(`Maximum ${this.config.maxActiveWakeWords} active wake words allowed`);
      }

      // Validate training data if provided
      if (options.trainingData) {
        await this.validateTrainingData(options.trainingData);
      }

      // Create profile
      const profile: WakeWordProfile = {
        id: this.generateProfileId(),
        phrase,
        userId: options.userId,
        isActive: false,
        priority: options.priority || 1,
        modelPath: options.modelPath || await this.generateModelPath(phrase),
        trainingData: options.trainingData,
        createdAt: new Date(),
        usageCount: 0,
        safetyValidated: true
      };

      // Train model if training data provided
      if (options.trainingData) {
        await this.trainWakeWordModel(profile);
      }

      // Store profile
      this.profiles.set(profile.id, profile);

      // Activate if under limit
      if (activeCount < this.config.maxActiveWakeWords) {
        await this.activateWakeWord(profile.id);
      }

      await voiceEventBus.publishEvent({
        id: this.generateEventId(),
        type: VoiceEventTypes.WAKE_WORD_ADDED,
        timestamp: new Date(),
        source: 'WakeWordManager',
        data: {
          profileId: profile.id,
          phrase: profile.phrase,
          userId: profile.userId
        },
        priority: 'medium'
      });

      this.emit('wake-word-added', profile);
      return profile.id;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Remove a wake word
   * Safety: Secure cleanup of model data and training data
   */
  async removeWakeWord(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Wake word profile ${profileId} not found`);
    }

    try {
      // Deactivate if active
      if (profile.isActive) {
        await this.deactivateWakeWord(profileId);
      }

      // Remove from detector
      await this.detector.removeWakeWord(profile.phrase);

      // Cleanup model files and training data
      await this.cleanupWakeWordData(profile);

      // Remove from profiles
      this.profiles.delete(profileId);

      await voiceEventBus.publishEvent({
        id: this.generateEventId(),
        type: VoiceEventTypes.WAKE_WORD_REMOVED,
        timestamp: new Date(),
        source: 'WakeWordManager',
        data: {
          profileId,
          phrase: profile.phrase
        },
        priority: 'medium'
      });

      this.emit('wake-word-removed', profile);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Activate a wake word for detection
   * Performance: Load model into detector with caching
   */
  async activateWakeWord(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Wake word profile ${profileId} not found`);
    }

    if (profile.isActive) {
      return; // Already active
    }

    try {
      // Check active limit
      const activeCount = this.getActiveProfiles().length;
      if (activeCount >= this.config.maxActiveWakeWords) {
        throw new Error(`Maximum ${this.config.maxActiveWakeWords} active wake words reached`);
      }

      // Load model into detector
      await this.detector.addWakeWord(profile.phrase, profile.modelPath);

      // Update profile
      profile.isActive = true;
      profile.lastUsed = new Date();

      await voiceEventBus.publishEvent({
        id: this.generateEventId(),
        type: VoiceEventTypes.WAKE_WORD_ACTIVATED,
        timestamp: new Date(),
        source: 'WakeWordManager',
        data: {
          profileId,
          phrase: profile.phrase
        },
        priority: 'medium'
      });

      this.emit('wake-word-activated', profile);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Deactivate a wake word
   * Performance: Remove from detector and optionally cache model
   */
  async deactivateWakeWord(profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Wake word profile ${profileId} not found`);
    }

    if (!profile.isActive) {
      return; // Already inactive
    }

    try {
      // Remove from detector
      await this.detector.removeWakeWord(profile.phrase);

      // Update profile
      profile.isActive = false;

      await voiceEventBus.publishEvent({
        id: this.generateEventId(),
        type: VoiceEventTypes.WAKE_WORD_DEACTIVATED,
        timestamp: new Date(),
        source: 'WakeWordManager',
        data: {
          profileId,
          phrase: profile.phrase
        },
        priority: 'medium'
      });

      this.emit('wake-word-deactivated', profile);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update wake word priority
   * Performance: Reorder processing priority in detector
   */
  async updateWakeWordPriority(profileId: string, priority: number): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Wake word profile ${profileId} not found`);
    }

    profile.priority = priority;

    // If active, update detector order
    if (profile.isActive) {
      await this.reorderActiveWakeWords();
    }

    this.emit('wake-word-priority-updated', profile);
  }

  /**
   * Add training data to existing wake word
   * Safety: Validate training data quality and appropriateness
   */
  async addTrainingData(profileId: string, trainingData: TrainingDataSet): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Wake word profile ${profileId} not found`);
    }

    try {
      // Validate training data
      await this.validateTrainingData(trainingData);

      // Merge with existing training data
      if (profile.trainingData) {
        profile.trainingData = this.mergeTrainingData(profile.trainingData, trainingData);
      } else {
        profile.trainingData = trainingData;
      }

      // Retrain model if active
      if (profile.isActive) {
        await this.retrainWakeWordModel(profile);
      }

      this.emit('training-data-added', profile);

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get all wake word profiles
   */
  getAllProfiles(): WakeWordProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get active wake word profiles
   */
  getActiveProfiles(): WakeWordProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.isActive)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get wake word usage statistics
   */
  getUsageStatistics(): {
    totalProfiles: number;
    activeProfiles: number;
    mostUsed: WakeWordProfile[];
    recentlyUsed: WakeWordProfile[];
  } {
    const profiles = Array.from(this.profiles.values());
    
    return {
      totalProfiles: profiles.length,
      activeProfiles: profiles.filter(p => p.isActive).length,
      mostUsed: profiles
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5),
      recentlyUsed: profiles
        .filter(p => p.lastUsed)
        .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
        .slice(0, 5)
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    // Deactivate all wake words
    const activeProfiles = this.getActiveProfiles();
    for (const profile of activeProfiles) {
      await this.deactivateWakeWord(profile.id);
    }

    // Clear caches
    this.modelCache.clear();
    this.profiles.clear();

    this.removeAllListeners();
  }

  /**
   * Load existing wake word profiles from storage
   * Performance: Lazy loading with validation
   */
  private async loadExistingProfiles(): Promise<void> {
    try {
      // Mock implementation - real version would load from persistent storage
      const defaultProfiles: Partial<WakeWordProfile>[] = [
        {
          phrase: 'Hey Assistant',
          priority: 10,
          modelPath: './models/wake-words/hey-assistant.tflite',
          safetyValidated: true
        },
        {
          phrase: 'Hello Helper',
          priority: 5,
          modelPath: './models/wake-words/hello-helper.tflite',
          safetyValidated: true
        }
      ];

      for (const profileData of defaultProfiles) {
        const profile: WakeWordProfile = {
          id: this.generateProfileId(),
          phrase: profileData.phrase!,
          isActive: false,
          priority: profileData.priority || 1,
          modelPath: profileData.modelPath!,
          createdAt: new Date(),
          usageCount: 0,
          safetyValidated: profileData.safetyValidated || false
        };

        this.profiles.set(profile.id, profile);
      }

    } catch (error) {
      console.warn('Failed to load existing profiles:', error);
      // Continue with empty profiles - not critical
    }
  }

  /**
   * Activate default wake words on initialization
   */
  private async activateDefaultWakeWords(): Promise<void> {
    const profiles = Array.from(this.profiles.values())
      .sort((a, b) => b.priority - a.priority);

    let activated = 0;
    for (const profile of profiles) {
      if (activated >= this.config.maxActiveWakeWords) {
        break;
      }

      try {
        await this.activateWakeWord(profile.id);
        activated++;
      } catch (error) {
        console.warn(`Failed to activate wake word "${profile.phrase}":`, error);
      }
    }
  }

  /**
   * Validate training data quality and safety
   * Safety: Ensure training data is appropriate and high quality
   */
  private async validateTrainingData(trainingData: TrainingDataSet): Promise<void> {
    // Validate data structure
    if (!trainingData.positiveExamples || trainingData.positiveExamples.length === 0) {
      throw new Error('Training data must include positive examples');
    }

    if (!trainingData.negativeExamples || trainingData.negativeExamples.length === 0) {
      throw new Error('Training data must include negative examples');
    }

    // Validate example quality
    for (const example of trainingData.positiveExamples) {
      if (example.quality === 'low') {
        console.warn(`Low quality training example: ${example.id}`);
      }
      
      if (example.duration < 0.5 || example.duration > 3.0) {
        throw new Error(`Invalid example duration: ${example.duration}s`);
      }
    }

    // Validate data balance
    const positiveCount = trainingData.positiveExamples.length;
    const negativeCount = trainingData.negativeExamples.length;
    const ratio = positiveCount / negativeCount;
    
    if (ratio < 0.5 || ratio > 2.0) {
      console.warn(`Unbalanced training data: ${positiveCount} positive, ${negativeCount} negative`);
    }
  }

  /**
   * Train wake word model from training data
   * Performance: Optimized training for Jetson Nano Orin
   */
  private async trainWakeWordModel(profile: WakeWordProfile): Promise<void> {
    if (!profile.trainingData) {
      throw new Error('No training data available');
    }

    try {
      // Mock training process - real implementation would use TensorFlow Lite training
      console.log(`Training wake word model for "${profile.phrase}"...`);
      
      // Simulate training time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update metadata with mock accuracy
      profile.trainingData.metadata.validationAccuracy = 0.85 + Math.random() * 0.1;
      
      console.log(`Training completed for "${profile.phrase}" with accuracy: ${profile.trainingData.metadata.validationAccuracy}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Training failed: ${errorMessage}`);
    }
  }

  /**
   * Retrain existing model with new data
   */
  private async retrainWakeWordModel(profile: WakeWordProfile): Promise<void> {
    // Deactivate temporarily
    const wasActive = profile.isActive;
    if (wasActive) {
      await this.deactivateWakeWord(profile.id);
    }

    // Retrain
    await this.trainWakeWordModel(profile);

    // Reactivate if it was active
    if (wasActive) {
      await this.activateWakeWord(profile.id);
    }
  }

  /**
   * Merge training datasets
   */
  private mergeTrainingData(existing: TrainingDataSet, newData: TrainingDataSet): TrainingDataSet {
    return {
      positiveExamples: [...existing.positiveExamples, ...newData.positiveExamples],
      negativeExamples: [...existing.negativeExamples, ...newData.negativeExamples],
      validationExamples: [...existing.validationExamples, ...newData.validationExamples],
      metadata: {
        totalExamples: existing.metadata.totalExamples + newData.metadata.totalExamples,
        speakerCount: Math.max(existing.metadata.speakerCount, newData.metadata.speakerCount),
        environmentVariations: [...new Set([...existing.metadata.environmentVariations, ...newData.metadata.environmentVariations])],
        qualityDistribution: this.mergeQualityDistribution(existing.metadata.qualityDistribution, newData.metadata.qualityDistribution),
        createdAt: existing.metadata.createdAt
      }
    };
  }

  /**
   * Merge quality distribution statistics
   */
  private mergeQualityDistribution(existing: Record<string, number>, newData: Record<string, number>): Record<string, number> {
    const merged = { ...existing };
    
    for (const [quality, count] of Object.entries(newData)) {
      merged[quality] = (merged[quality] || 0) + count;
    }
    
    return merged;
  }

  /**
   * Reorder active wake words by priority
   */
  private async reorderActiveWakeWords(): Promise<void> {
    // Get active profiles sorted by priority
    const activeProfiles = this.getActiveProfiles();
    
    // Deactivate all
    for (const profile of activeProfiles) {
      await this.detector.removeWakeWord(profile.phrase);
    }

    // Reactivate in priority order
    for (const profile of activeProfiles) {
      await this.detector.addWakeWord(profile.phrase, profile.modelPath);
    }
  }

  /**
   * Cleanup wake word data files
   * Safety: Secure deletion of model and training data
   */
  private async cleanupWakeWordData(profile: WakeWordProfile): Promise<void> {
    try {
      // Mock cleanup - real implementation would delete files securely
      console.log(`Cleaning up data for wake word "${profile.phrase}"`);
      
      // Clear training data from memory
      if (profile.trainingData) {
        profile.trainingData.positiveExamples.forEach(example => {
          example.audioData.fill(0); // Clear audio data
        });
        profile.trainingData.negativeExamples.forEach(example => {
          example.audioData.fill(0); // Clear audio data
        });
      }

    } catch (error) {
      console.warn(`Failed to cleanup data for "${profile.phrase}":`, error);
    }
  }

  /**
   * Generate model file path
   */
  private async generateModelPath(phrase: string): Promise<string> {
    const sanitizedPhrase = phrase.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${this.config.modelStoragePath}/${sanitizedPhrase}.tflite`;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle wake word detections
    this.detector.on('wake-word-detected', (result) => {
      const profile = Array.from(this.profiles.values())
        .find(p => p.phrase === result.phrase);
      
      if (profile) {
        profile.usageCount++;
        profile.lastUsed = new Date();
        this.emit('wake-word-used', profile);
      }
    });
  }

  /**
   * Generate unique profile ID
   */
  private generateProfileId(): string {
    return `wwp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `wwm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}