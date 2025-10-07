/**
 * Family LLM Factory
 * 
 * Factory for creating and managing family-specific fine-tuned LLM models
 * Integrates with the existing learning engine and recommendation systems
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { 
  LocalLLMFineTuner, 
  FamilyProfile, 
  FineTuningConfig, 
  FineTuningResult,
  RecommendationContext 
} from './local-llm-fine-tuner';
import { LLMEnhancedLearningEngine } from './llm-enhanced-engine';
import { SafetyValidator } from '../safety/safety-validator';
import { PrivacyFilter } from '../privacy/filter';

export interface FamilyLLMConfig {
  modelsDirectory: string;
  maxModelsPerFamily: number;
  fineTuningConfig: FineTuningConfig;
  updateInterval: number; // hours
  performanceThreshold: number;
  safetyThreshold: number;
}

export interface FamilyModelInfo {
  familyId: string;
  modelPath: string;
  version: string;
  createdAt: Date;
  lastUpdated: Date;
  performanceMetrics: any;
  safetyValidation: any;
  isActive: boolean;
}

export interface ModelUpdateSchedule {
  familyId: string;
  nextUpdate: Date;
  updateFrequency: 'daily' | 'weekly' | 'monthly';
  autoUpdate: boolean;
  lastUpdate?: Date;
}

export class FamilyLLMFactory extends EventEmitter {
  private config: FamilyLLMConfig;
  private safetyValidator: SafetyValidator;
  private privacyFilter: PrivacyFilter;
  private activeTuners: Map<string, LocalLLMFineTuner> = new Map();
  private familyModels: Map<string, FamilyModelInfo> = new Map();
  private updateSchedules: Map<string, ModelUpdateSchedule> = new Map();
  private learningEngine: LLMEnhancedLearningEngine;

  constructor(
    config: FamilyLLMConfig,
    safetyValidator: SafetyValidator,
    privacyFilter: PrivacyFilter,
    learningEngine: LLMEnhancedLearningEngine
  ) {
    super();
    this.config = config;
    this.safetyValidator = safetyValidator;
    this.privacyFilter = privacyFilter;
    this.learningEngine = learningEngine;
    
    this.initializeFactory();
  }

  /**
   * Create or update a family-specific LLM model
   */
  async createFamilyModel(
    familyProfile: FamilyProfile,
    interactionHistory?: any[]
  ): Promise<FamilyModelInfo> {
    try {
      this.emit('modelCreation', { 
        status: 'started', 
        familyId: familyProfile.familyId 
      });

      // Check if family already has a model
      const existingModel = this.familyModels.get(familyProfile.familyId);
      if (existingModel && existingModel.isActive) {
        return await this.updateExistingModel(familyProfile, interactionHistory);
      }

      // Create new fine-tuner for this family
      const fineTuner = new LocalLLMFineTuner(
        this.config.fineTuningConfig,
        this.safetyValidator,
        this.privacyFilter
      );

      this.activeTuners.set(familyProfile.familyId, fineTuner);

      // Set up event listeners
      this.setupFineTunerEvents(fineTuner, familyProfile.familyId);

      // Get interaction history if not provided
      if (!interactionHistory) {
        interactionHistory = await this.getInteractionHistory(familyProfile.familyId);
      }

      // Create training dataset
      const dataset = await fineTuner.createFamilyDataset(
        familyProfile,
        interactionHistory
      );

      // Fine-tune the model
      const result = await fineTuner.fineTuneModel(dataset, familyProfile);

      if (!result.success) {
        throw new Error(`Fine-tuning failed: ${result.errors?.join(', ')}`);
      }

      // Create model info
      const modelInfo: FamilyModelInfo = {
        familyId: familyProfile.familyId,
        modelPath: result.modelPath,
        version: this.generateModelVersion(),
        createdAt: new Date(),
        lastUpdated: new Date(),
        performanceMetrics: result.performanceMetrics,
        safetyValidation: result.safetyValidation,
        isActive: true
      };

      // Store model info
      this.familyModels.set(familyProfile.familyId, modelInfo);
      await this.persistModelInfo(modelInfo);

      // Schedule regular updates
      this.scheduleModelUpdates(familyProfile.familyId);

      // Clean up tuner
      this.activeTuners.delete(familyProfile.familyId);

      this.emit('modelCreation', { 
        status: 'completed', 
        familyId: familyProfile.familyId,
        modelInfo 
      });

      return modelInfo;

    } catch (error) {
      this.emit('modelCreation', { 
        status: 'failed', 
        familyId: familyProfile.familyId,
        error: error.message 
      });
      
      // Clean up on failure
      this.activeTuners.delete(familyProfile.familyId);
      throw error;
    }
  }

  /**
   * Generate recommendations using family-specific model
   */
  async generateFamilyRecommendations(
    familyId: string,
    context: RecommendationContext,
    targetMember?: string
  ): Promise<string[]> {
    try {
      const modelInfo = this.familyModels.get(familyId);
      if (!modelInfo || !modelInfo.isActive) {
        // Fall back to general recommendations
        return await this.generateFallbackRecommendations(context, familyId);
      }

      // Get family profile
      const familyProfile = await this.getFamilyProfile(familyId);
      if (!familyProfile) {
        throw new Error(`Family profile not found: ${familyId}`);
      }

      // Create fine-tuner instance for inference
      const fineTuner = new LocalLLMFineTuner(
        this.config.fineTuningConfig,
        this.safetyValidator,
        this.privacyFilter
      );

      // Generate recommendations
      const recommendations = await fineTuner.generateFamilyRecommendations(
        modelInfo.modelPath,
        context,
        familyProfile,
        targetMember
      );

      // Log successful recommendation generation
      this.emit('recommendationGenerated', {
        familyId,
        context,
        recommendationCount: recommendations.length
      });

      return recommendations;

    } catch (error) {
      this.emit('recommendationError', {
        familyId,
        error: error.message
      });

      // Return fallback recommendations
      return await this.generateFallbackRecommendations(context, familyId);
    }
  }

  /**
   * Update existing family model with new interactions
   */
  async updateFamilyModel(
    familyId: string,
    newInteractions: any[]
  ): Promise<FamilyModelInfo> {
    try {
      const modelInfo = this.familyModels.get(familyId);
      if (!modelInfo) {
        throw new Error(`No model found for family: ${familyId}`);
      }

      const familyProfile = await this.getFamilyProfile(familyId);
      if (!familyProfile) {
        throw new Error(`Family profile not found: ${familyId}`);
      }

      // Create fine-tuner for updates
      const fineTuner = new LocalLLMFineTuner(
        this.config.fineTuningConfig,
        this.safetyValidator,
        this.privacyFilter
      );

      // Update model with new data
      const result = await fineTuner.updateModelWithNewData(
        modelInfo.modelPath,
        newInteractions,
        familyProfile
      );

      if (result.success) {
        // Update model info
        modelInfo.modelPath = result.modelPath;
        modelInfo.lastUpdated = new Date();
        modelInfo.performanceMetrics = result.performanceMetrics;
        modelInfo.safetyValidation = result.safetyValidation;

        // Persist updated info
        await this.persistModelInfo(modelInfo);

        this.emit('modelUpdated', {
          familyId,
          modelInfo,
          improvementMetrics: result.performanceMetrics
        });
      }

      return modelInfo;

    } catch (error) {
      this.emit('modelUpdateError', {
        familyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate family model safety and performance
   */
  async validateFamilyModel(familyId: string): Promise<boolean> {
    try {
      const modelInfo = this.familyModels.get(familyId);
      if (!modelInfo) {
        return false;
      }

      const familyProfile = await this.getFamilyProfile(familyId);
      if (!familyProfile) {
        return false;
      }

      const fineTuner = new LocalLLMFineTuner(
        this.config.fineTuningConfig,
        this.safetyValidator,
        this.privacyFilter
      );

      const validation = await fineTuner.validateModel(
        modelInfo.modelPath,
        familyProfile
      );

      // Update validation results
      modelInfo.safetyValidation = validation;
      await this.persistModelInfo(modelInfo);

      const isValid = validation.passed && 
        validation.riskScore < this.config.safetyThreshold;

      if (!isValid) {
        this.emit('modelValidationFailed', {
          familyId,
          violations: validation.violations,
          riskScore: validation.riskScore
        });

        // Deactivate unsafe model
        modelInfo.isActive = false;
        await this.persistModelInfo(modelInfo);
      }

      return isValid;

    } catch (error) {
      this.emit('validationError', {
        familyId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get family model information
   */
  getFamilyModelInfo(familyId: string): FamilyModelInfo | undefined {
    return this.familyModels.get(familyId);
  }

  /**
   * List all family models
   */
  getAllFamilyModels(): FamilyModelInfo[] {
    return Array.from(this.familyModels.values());
  }

  /**
   * Delete family model
   */
  async deleteFamilyModel(familyId: string): Promise<void> {
    try {
      const modelInfo = this.familyModels.get(familyId);
      if (modelInfo) {
        // Delete model file
        await fs.unlink(modelInfo.modelPath).catch(() => {
          // Ignore file not found errors
        });

        // Remove from memory
        this.familyModels.delete(familyId);
        this.updateSchedules.delete(familyId);

        // Delete persisted info
        await this.deletePersistedModelInfo(familyId);

        this.emit('modelDeleted', { familyId });
      }
    } catch (error) {
      this.emit('modelDeletionError', {
        familyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Schedule automatic model updates
   */
  scheduleModelUpdates(familyId: string, frequency: 'daily' | 'weekly' | 'monthly' = 'weekly'): void {
    const schedule: ModelUpdateSchedule = {
      familyId,
      nextUpdate: this.calculateNextUpdate(frequency),
      updateFrequency: frequency,
      autoUpdate: true
    };

    this.updateSchedules.set(familyId, schedule);
    this.emit('updateScheduled', { familyId, schedule });
  }

  /**
   * Process scheduled updates
   */
  async processScheduledUpdates(): Promise<void> {
    const now = new Date();
    
    for (const [familyId, schedule] of this.updateSchedules) {
      if (schedule.autoUpdate && schedule.nextUpdate <= now) {
        try {
          // Get recent interactions
          const recentInteractions = await this.getRecentInteractions(
            familyId,
            schedule.lastUpdate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          );

          if (recentInteractions.length > 0) {
            await this.updateFamilyModel(familyId, recentInteractions);
            
            // Update schedule
            schedule.lastUpdate = now;
            schedule.nextUpdate = this.calculateNextUpdate(schedule.updateFrequency);
          }
        } catch (error) {
          this.emit('scheduledUpdateError', {
            familyId,
            error: error.message
          });
        }
      }
    }
  }

  // Private helper methods

  private async initializeFactory(): Promise<void> {
    try {
      // Create models directory
      await fs.mkdir(this.config.modelsDirectory, { recursive: true });

      // Load existing model info
      await this.loadExistingModels();

      // Start update scheduler
      this.startUpdateScheduler();

      this.emit('factoryInitialized');
    } catch (error) {
      this.emit('initializationError', { error: error.message });
    }
  }

  private async loadExistingModels(): Promise<void> {
    try {
      const modelInfoPath = path.join(this.config.modelsDirectory, 'models.json');
      const data = await fs.readFile(modelInfoPath, 'utf-8');
      const modelsData = JSON.parse(data);

      for (const modelData of modelsData) {
        const modelInfo: FamilyModelInfo = {
          ...modelData,
          createdAt: new Date(modelData.createdAt),
          lastUpdated: new Date(modelData.lastUpdated)
        };
        this.familyModels.set(modelInfo.familyId, modelInfo);
      }
    } catch (error) {
      // No existing models file, start fresh
    }
  }

  private async persistModelInfo(modelInfo: FamilyModelInfo): Promise<void> {
    const modelInfoPath = path.join(this.config.modelsDirectory, 'models.json');
    const allModels = Array.from(this.familyModels.values());
    await fs.writeFile(modelInfoPath, JSON.stringify(allModels, null, 2));
  }

  private async deletePersistedModelInfo(familyId: string): Promise<void> {
    const modelInfoPath = path.join(this.config.modelsDirectory, 'models.json');
    const allModels = Array.from(this.familyModels.values());
    await fs.writeFile(modelInfoPath, JSON.stringify(allModels, null, 2));
  }

  private setupFineTunerEvents(fineTuner: LocalLLMFineTuner, familyId: string): void {
    fineTuner.on('datasetCreation', (event) => {
      this.emit('familyDatasetCreation', { familyId, ...event });
    });

    fineTuner.on('fineTuning', (event) => {
      this.emit('familyFineTuning', { familyId, ...event });
    });

    fineTuner.on('trainingProgress', (event) => {
      this.emit('familyTrainingProgress', { familyId, ...event });
    });
  }

  private async updateExistingModel(
    familyProfile: FamilyProfile,
    interactionHistory?: any[]
  ): Promise<FamilyModelInfo> {
    if (!interactionHistory) {
      interactionHistory = await this.getRecentInteractions(familyProfile.familyId);
    }

    return await this.updateFamilyModel(familyProfile.familyId, interactionHistory);
  }

  private generateModelVersion(): string {
    return `v${Date.now()}`;
  }

  private async getInteractionHistory(familyId: string): Promise<any[]> {
    // Get interaction history from learning engine
    return await this.learningEngine.getInteractionHistory(familyId);
  }

  private async getRecentInteractions(
    familyId: string,
    since?: Date
  ): Promise<any[]> {
    const sinceDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return await this.learningEngine.getInteractionHistory(familyId, sinceDate);
  }

  private async getFamilyProfile(familyId: string): Promise<any> {
    // Get family profile from learning engine or user management system
    return await this.learningEngine.getFamilyProfile(familyId);
  }

  private async generateFallbackRecommendations(
    context: RecommendationContext,
    familyId: string
  ): Promise<string[]> {
    // Use the general learning engine for fallback recommendations
    return await this.learningEngine.generateRecommendations(context, familyId);
  }

  private calculateNextUpdate(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  private startUpdateScheduler(): void {
    // Run update check every hour
    setInterval(() => {
      this.processScheduledUpdates().catch(error => {
        this.emit('schedulerError', { error: error.message });
      });
    }, this.config.updateInterval * 60 * 60 * 1000);
  }
}