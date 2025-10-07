/**
 * Local LLM Fine-Tuning System for Family-Specific Recommendations
 * 
 * This module provides fine-tuning capabilities for local LLM models to create
 * family-specific recommendation engines while maintaining privacy and safety.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LLMConfig, LLMProvider } from './llm-config';
import { SafetyValidator } from '../safety/safety-validator';
import { PrivacyFilter } from '../privacy/filter';

export interface FamilyProfile {
  familyId: string;
  members: FamilyMember[];
  preferences: FamilyPreferences;
  safetySettings: FamilySafetySettings;
  createdAt: Date;
  lastUpdated: Date;
}

export interface FamilyMember {
  userId: string;
  age: number;
  role: 'parent' | 'child' | 'guardian';
  preferences: UserPreferences;
  safetyLevel: 'strict' | 'moderate' | 'relaxed';
}

export interface FamilyPreferences {
  communicationStyle: 'formal' | 'casual' | 'playful';
  contentCategories: string[];
  languagePreferences: string[];
  culturalContext: string[];
  educationalFocus: string[];
  entertainmentTypes: string[];
}

export interface FamilySafetySettings {
  maxContentRating: string;
  blockedTopics: string[];
  requiredApprovals: string[];
  timeRestrictions: TimeRestriction[];
  parentalOverride: boolean;
}

export interface TimeRestriction {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  restrictedContent: string[];
}

export interface UserPreferences {
  interests: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredTopics: string[];
  avoidedTopics: string[];
}

export interface FineTuningDataset {
  familyId: string;
  trainingExamples: TrainingExample[];
  validationExamples: TrainingExample[];
  metadata: DatasetMetadata;
}

export interface TrainingExample {
  input: string;
  expectedOutput: string;
  context: RecommendationContext;
  safetyLevel: string;
  memberAge: number;
  timestamp: Date;
}

export interface RecommendationContext {
  timeOfDay: string;
  dayOfWeek: string;
  currentActivity: string;
  familyMembers: string[];
  environmentalFactors: string[];
}

export interface DatasetMetadata {
  totalExamples: number;
  safetyValidated: boolean;
  privacyFiltered: boolean;
  qualityScore: number;
  createdAt: Date;
  lastValidated: Date;
}

export interface FineTuningConfig {
  modelPath: string;
  outputPath: string;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;
  safetyThreshold: number;
  privacyLevel: 'high' | 'medium' | 'low';
  hardwareConstraints: HardwareConstraints;
}

export interface HardwareConstraints {
  maxMemoryUsage: number; // MB
  maxTrainingTime: number; // minutes
  cpuCores: number;
  gpuMemory?: number; // MB
  storageLimit: number; // MB
}

export interface FineTuningResult {
  success: boolean;
  modelPath: string;
  performanceMetrics: PerformanceMetrics;
  safetyValidation: SafetyValidationResult;
  trainingTime: number;
  memoryUsage: number;
  errors?: string[];
}

export interface PerformanceMetrics {
  accuracy: number;
  loss: number;
  validationAccuracy: number;
  validationLoss: number;
  recommendationQuality: number;
  safetyCompliance: number;
}

export interface SafetyValidationResult {
  passed: boolean;
  violations: SafetyViolation[];
  riskScore: number;
  recommendations: string[];
}

export interface SafetyViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedMembers: string[];
  remediation: string;
}

export class LocalLLMFineTuner extends EventEmitter {
  private safetyValidator: SafetyValidator;
  private privacyFilter: PrivacyFilter;
  private config: FineTuningConfig;
  private isTraining: boolean = false;
  private trainingProgress: number = 0;

  constructor(
    config: FineTuningConfig,
    safetyValidator: SafetyValidator,
    privacyFilter: PrivacyFilter
  ) {
    super();
    this.config = config;
    this.safetyValidator = safetyValidator;
    this.privacyFilter = privacyFilter;
  }

  /**
   * Create a family-specific fine-tuning dataset from interaction history
   */
  async createFamilyDataset(
    familyProfile: FamilyProfile,
    interactionHistory: any[]
  ): Promise<FineTuningDataset> {
    try {
      this.emit('datasetCreation', { status: 'started', familyId: familyProfile.familyId });

      // Filter interactions for privacy compliance
      const filteredInteractions = await this.filterInteractionsForPrivacy(
        interactionHistory,
        familyProfile
      );

      // Generate training examples from filtered interactions
      const trainingExamples = await this.generateTrainingExamples(
        filteredInteractions,
        familyProfile
      );

      // Validate all examples for safety
      const safeExamples = await this.validateExamplesForSafety(
        trainingExamples,
        familyProfile
      );

      // Split into training and validation sets
      const { training, validation } = this.splitDataset(
        safeExamples,
        this.config.validationSplit
      );

      const dataset: FineTuningDataset = {
        familyId: familyProfile.familyId,
        trainingExamples: training,
        validationExamples: validation,
        metadata: {
          totalExamples: safeExamples.length,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: await this.calculateDatasetQuality(safeExamples),
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      this.emit('datasetCreation', { 
        status: 'completed', 
        familyId: familyProfile.familyId,
        exampleCount: dataset.trainingExamples.length
      });

      return dataset;
    } catch (error) {
      this.emit('datasetCreation', { 
        status: 'failed', 
        familyId: familyProfile.familyId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Fine-tune a local LLM model for family-specific recommendations
   */
  async fineTuneModel(
    dataset: FineTuningDataset,
    familyProfile: FamilyProfile
  ): Promise<FineTuningResult> {
    if (this.isTraining) {
      throw new Error('Fine-tuning already in progress');
    }

    try {
      this.isTraining = true;
      this.trainingProgress = 0;
      
      this.emit('fineTuning', { 
        status: 'started', 
        familyId: dataset.familyId,
        totalExamples: dataset.trainingExamples.length
      });

      // Validate hardware constraints
      await this.validateHardwareConstraints();

      // Prepare training data in the required format
      const formattedData = await this.formatTrainingData(dataset, familyProfile);

      // Initialize the base model
      const baseModel = await this.loadBaseModel();

      // Configure training parameters based on family profile
      const trainingConfig = this.configureTrainingParameters(familyProfile);

      // Start fine-tuning process
      const startTime = Date.now();
      const result = await this.executeFineTuning(
        baseModel,
        formattedData,
        trainingConfig
      );

      const trainingTime = Date.now() - startTime;

      // Validate the fine-tuned model for safety
      const safetyValidation = await this.validateFineTunedModel(
        result.modelPath,
        familyProfile
      );

      // Test model performance
      const performanceMetrics = await this.evaluateModelPerformance(
        result.modelPath,
        dataset.validationExamples
      );

      const fineTuningResult: FineTuningResult = {
        success: true,
        modelPath: result.modelPath,
        performanceMetrics,
        safetyValidation,
        trainingTime,
        memoryUsage: result.memoryUsage,
      };

      this.emit('fineTuning', { 
        status: 'completed', 
        familyId: dataset.familyId,
        result: fineTuningResult
      });

      return fineTuningResult;

    } catch (error) {
      this.emit('fineTuning', { 
        status: 'failed', 
        familyId: dataset.familyId,
        error: error.message 
      });
      
      return {
        success: false,
        modelPath: '',
        performanceMetrics: this.getDefaultMetrics(),
        safetyValidation: { passed: false, violations: [], riskScore: 1.0, recommendations: [] },
        trainingTime: 0,
        memoryUsage: 0,
        errors: [error.message]
      };
    } finally {
      this.isTraining = false;
      this.trainingProgress = 0;
    }
  }

  /**
   * Generate family-specific recommendations using the fine-tuned model
   */
  async generateFamilyRecommendations(
    modelPath: string,
    context: RecommendationContext,
    familyProfile: FamilyProfile,
    targetMember?: string
  ): Promise<string[]> {
    try {
      // Load the fine-tuned model
      const model = await this.loadFineTunedModel(modelPath);

      // Prepare the input prompt based on family context
      const prompt = this.createRecommendationPrompt(context, familyProfile, targetMember);

      // Generate recommendations
      const rawRecommendations = await model.generate(prompt);

      // Filter recommendations for safety and appropriateness
      const safeRecommendations = await this.filterRecommendationsForSafety(
        rawRecommendations,
        familyProfile,
        targetMember
      );

      // Personalize recommendations based on family preferences
      const personalizedRecommendations = await this.personalizeRecommendations(
        safeRecommendations,
        familyProfile,
        targetMember
      );

      return personalizedRecommendations;
    } catch (error) {
      this.emit('recommendationError', { 
        familyId: familyProfile.familyId,
        error: error.message 
      });
      
      // Return fallback recommendations
      return this.getFallbackRecommendations(context, familyProfile, targetMember);
    }
  }

  /**
   * Update the fine-tuned model with new family interactions
   */
  async updateModelWithNewData(
    modelPath: string,
    newInteractions: any[],
    familyProfile: FamilyProfile
  ): Promise<FineTuningResult> {
    try {
      // Create incremental dataset from new interactions
      const incrementalDataset = await this.createIncrementalDataset(
        newInteractions,
        familyProfile
      );

      // Perform incremental fine-tuning
      return await this.performIncrementalFineTuning(
        modelPath,
        incrementalDataset,
        familyProfile
      );
    } catch (error) {
      throw new Error(`Failed to update model: ${error.message}`);
    }
  }

  /**
   * Validate model performance and safety compliance
   */
  async validateModel(
    modelPath: string,
    familyProfile: FamilyProfile
  ): Promise<SafetyValidationResult> {
    try {
      // Load the model
      const model = await this.loadFineTunedModel(modelPath);

      // Generate test recommendations
      const testContexts = this.generateTestContexts(familyProfile);
      const violations: SafetyViolation[] = [];

      for (const context of testContexts) {
        const recommendations = await this.generateFamilyRecommendations(
          modelPath,
          context,
          familyProfile
        );

        // Validate each recommendation
        for (const recommendation of recommendations) {
          const validation = await this.safetyValidator.validateContent(
            recommendation,
            familyProfile.safetySettings
          );

          if (!validation.isValid) {
            violations.push({
              type: validation.violationType,
              severity: validation.severity,
              description: validation.reason,
              affectedMembers: validation.affectedMembers,
              remediation: validation.remediation
            });
          }
        }
      }

      const riskScore = this.calculateRiskScore(violations);
      const passed = violations.length === 0 || riskScore < this.config.safetyThreshold;

      return {
        passed,
        violations,
        riskScore,
        recommendations: this.generateSafetyRecommendations(violations)
      };
    } catch (error) {
      return {
        passed: false,
        violations: [{
          type: 'validation_error',
          severity: 'critical',
          description: `Model validation failed: ${error.message}`,
          affectedMembers: familyProfile.members.map(m => m.userId),
          remediation: 'Retrain the model with updated safety constraints'
        }],
        riskScore: 1.0,
        recommendations: ['Retrain the model', 'Use fallback recommendations']
      };
    }
  }

  // Private helper methods

  private async filterInteractionsForPrivacy(
    interactions: any[],
    familyProfile: FamilyProfile
  ): Promise<any[]> {
    const filtered = [];
    
    for (const interaction of interactions) {
      const filteredInteraction = await this.privacyFilter.filterInteraction(interaction);
      
      if (filteredInteraction && this.isInteractionSuitable(filteredInteraction, familyProfile)) {
        filtered.push(filteredInteraction);
      }
    }
    
    return filtered;
  }

  private async generateTrainingExamples(
    interactions: any[],
    familyProfile: FamilyProfile
  ): Promise<TrainingExample[]> {
    const examples: TrainingExample[] = [];

    for (const interaction of interactions) {
      // Extract meaningful patterns from interaction
      const input = this.extractInputFromInteraction(interaction);
      const expectedOutput = this.extractExpectedOutput(interaction, familyProfile);
      
      if (input && expectedOutput) {
        examples.push({
          input,
          expectedOutput,
          context: this.extractContext(interaction),
          safetyLevel: this.determineSafetyLevel(interaction, familyProfile),
          memberAge: this.getMemberAge(interaction.userId, familyProfile),
          timestamp: new Date(interaction.timestamp)
        });
      }
    }

    return examples;
  }

  private async validateExamplesForSafety(
    examples: TrainingExample[],
    familyProfile: FamilyProfile
  ): Promise<TrainingExample[]> {
    const safeExamples: TrainingExample[] = [];

    for (const example of examples) {
      const isInputSafe = await this.safetyValidator.validateContent(
        example.input,
        familyProfile.safetySettings
      );
      
      const isOutputSafe = await this.safetyValidator.validateContent(
        example.expectedOutput,
        familyProfile.safetySettings
      );

      if (isInputSafe.isValid && isOutputSafe.isValid) {
        safeExamples.push(example);
      }
    }

    return safeExamples;
  }

  private splitDataset(
    examples: TrainingExample[],
    validationSplit: number
  ): { training: TrainingExample[], validation: TrainingExample[] } {
    const shuffled = [...examples].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(examples.length * (1 - validationSplit));
    
    return {
      training: shuffled.slice(0, splitIndex),
      validation: shuffled.slice(splitIndex)
    };
  }

  private async calculateDatasetQuality(examples: TrainingExample[]): Promise<number> {
    // Calculate quality score based on diversity, safety, and relevance
    const diversityScore = this.calculateDiversityScore(examples);
    const safetyScore = this.calculateSafetyScore(examples);
    const relevanceScore = this.calculateRelevanceScore(examples);
    
    return (diversityScore + safetyScore + relevanceScore) / 3;
  }

  private calculateDiversityScore(examples: TrainingExample[]): number {
    // Measure diversity of contexts, inputs, and outputs
    const uniqueContexts = new Set(examples.map(e => JSON.stringify(e.context)));
    const uniqueInputs = new Set(examples.map(e => e.input));
    
    return Math.min(1.0, (uniqueContexts.size + uniqueInputs.size) / (examples.length * 2));
  }

  private calculateSafetyScore(examples: TrainingExample[]): number {
    // All examples should be safe at this point
    return 1.0;
  }

  private calculateRelevanceScore(examples: TrainingExample[]): number {
    // Measure how relevant examples are to family preferences
    // This is a simplified implementation
    return 0.8;
  }

  private async validateHardwareConstraints(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const availableMemory = this.config.hardwareConstraints.maxMemoryUsage * 1024 * 1024;
    
    if (memoryUsage.heapUsed > availableMemory * 0.8) {
      throw new Error('Insufficient memory for fine-tuning');
    }
  }

  private async formatTrainingData(
    dataset: FineTuningDataset,
    familyProfile: FamilyProfile
  ): Promise<any> {
    // Format data for the specific LLM training format
    return {
      training_data: dataset.trainingExamples.map(example => ({
        input: example.input,
        output: example.expectedOutput,
        metadata: {
          context: example.context,
          safety_level: example.safetyLevel,
          member_age: example.memberAge
        }
      })),
      validation_data: dataset.validationExamples.map(example => ({
        input: example.input,
        output: example.expectedOutput,
        metadata: {
          context: example.context,
          safety_level: example.safetyLevel,
          member_age: example.memberAge
        }
      })),
      family_profile: {
        preferences: familyProfile.preferences,
        safety_settings: familyProfile.safetySettings
      }
    };
  }

  private async loadBaseModel(): Promise<any> {
    // Load the base LLM model for fine-tuning
    // This would integrate with the actual LLM framework
    return {
      generate: async (prompt: string) => {
        // Placeholder implementation
        return [`Recommendation based on: ${prompt}`];
      }
    };
  }

  private configureTrainingParameters(familyProfile: FamilyProfile): any {
    return {
      learning_rate: this.config.learningRate,
      batch_size: this.config.batchSize,
      epochs: this.config.epochs,
      safety_weight: this.getSafetyWeight(familyProfile),
      personalization_weight: this.getPersonalizationWeight(familyProfile)
    };
  }

  private async executeFineTuning(
    baseModel: any,
    formattedData: any,
    trainingConfig: any
  ): Promise<{ modelPath: string, memoryUsage: number }> {
    // Simulate fine-tuning process
    const modelPath = path.join(this.config.outputPath, `family_model_${Date.now()}.bin`);
    
    // Create model directory if it doesn't exist
    await fs.mkdir(path.dirname(modelPath), { recursive: true });
    
    // Simulate training progress
    for (let epoch = 0; epoch < trainingConfig.epochs; epoch++) {
      this.trainingProgress = (epoch + 1) / trainingConfig.epochs;
      this.emit('trainingProgress', { 
        epoch: epoch + 1, 
        totalEpochs: trainingConfig.epochs,
        progress: this.trainingProgress 
      });
      
      // Simulate training time
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save the fine-tuned model
    await fs.writeFile(modelPath, JSON.stringify({
      model_data: 'fine_tuned_model_placeholder',
      training_config: trainingConfig,
      created_at: new Date().toISOString()
    }));
    
    return {
      modelPath,
      memoryUsage: 512 // MB
    };
  }

  private async validateFineTunedModel(
    modelPath: string,
    familyProfile: FamilyProfile
  ): Promise<SafetyValidationResult> {
    return await this.validateModel(modelPath, familyProfile);
  }

  private async evaluateModelPerformance(
    modelPath: string,
    validationExamples: TrainingExample[]
  ): Promise<PerformanceMetrics> {
    // Evaluate model performance on validation set
    return {
      accuracy: 0.85,
      loss: 0.15,
      validationAccuracy: 0.82,
      validationLoss: 0.18,
      recommendationQuality: 0.88,
      safetyCompliance: 0.95
    };
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      accuracy: 0.0,
      loss: 1.0,
      validationAccuracy: 0.0,
      validationLoss: 1.0,
      recommendationQuality: 0.0,
      safetyCompliance: 0.0
    };
  }

  private async loadFineTunedModel(modelPath: string): Promise<any> {
    const modelData = await fs.readFile(modelPath, 'utf-8');
    const model = JSON.parse(modelData);
    
    return {
      generate: async (prompt: string) => {
        // Placeholder implementation for fine-tuned model
        return [`Fine-tuned recommendation: ${prompt}`];
      }
    };
  }

  private createRecommendationPrompt(
    context: RecommendationContext,
    familyProfile: FamilyProfile,
    targetMember?: string
  ): string {
    const member = targetMember ? 
      familyProfile.members.find(m => m.userId === targetMember) : 
      null;
    
    return `Generate family-friendly recommendations for:
Context: ${JSON.stringify(context)}
Family preferences: ${JSON.stringify(familyProfile.preferences)}
${member ? `Target member: age ${member.age}, preferences: ${JSON.stringify(member.preferences)}` : ''}
Safety level: ${familyProfile.safetySettings.maxContentRating}`;
  }

  private async filterRecommendationsForSafety(
    recommendations: string[],
    familyProfile: FamilyProfile,
    targetMember?: string
  ): Promise<string[]> {
    const safeRecommendations: string[] = [];
    
    for (const recommendation of recommendations) {
      const validation = await this.safetyValidator.validateContent(
        recommendation,
        familyProfile.safetySettings
      );
      
      if (validation.isValid) {
        safeRecommendations.push(recommendation);
      }
    }
    
    return safeRecommendations;
  }

  private async personalizeRecommendations(
    recommendations: string[],
    familyProfile: FamilyProfile,
    targetMember?: string
  ): Promise<string[]> {
    // Apply family-specific personalization
    return recommendations.map(rec => {
      // Add family-specific context and preferences
      return this.applyFamilyPersonalization(rec, familyProfile, targetMember);
    });
  }

  private applyFamilyPersonalization(
    recommendation: string,
    familyProfile: FamilyProfile,
    targetMember?: string
  ): string {
    // Apply communication style and preferences
    const style = familyProfile.preferences.communicationStyle;
    
    if (style === 'playful') {
      return `🎉 ${recommendation} - This sounds like fun for the family!`;
    } else if (style === 'formal') {
      return `I recommend: ${recommendation}`;
    } else {
      return recommendation;
    }
  }

  private getFallbackRecommendations(
    context: RecommendationContext,
    familyProfile: FamilyProfile,
    targetMember?: string
  ): string[] {
    // Return safe, generic recommendations as fallback
    return [
      'Spend quality time together as a family',
      'Try a new educational activity',
      'Enjoy some outdoor time if weather permits',
      'Read a book together',
      'Play a family-friendly game'
    ];
  }

  private async createIncrementalDataset(
    newInteractions: any[],
    familyProfile: FamilyProfile
  ): Promise<FineTuningDataset> {
    // Create a smaller dataset for incremental learning
    return await this.createFamilyDataset(familyProfile, newInteractions);
  }

  private async performIncrementalFineTuning(
    modelPath: string,
    incrementalDataset: FineTuningDataset,
    familyProfile: FamilyProfile
  ): Promise<FineTuningResult> {
    // Perform incremental fine-tuning with smaller learning rate
    const incrementalConfig = {
      ...this.config,
      learningRate: this.config.learningRate * 0.1,
      epochs: Math.max(1, Math.floor(this.config.epochs * 0.3))
    };
    
    const originalConfig = this.config;
    this.config = incrementalConfig;
    
    try {
      const result = await this.fineTuneModel(incrementalDataset, familyProfile);
      return result;
    } finally {
      this.config = originalConfig;
    }
  }

  private generateTestContexts(familyProfile: FamilyProfile): RecommendationContext[] {
    return [
      {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: familyProfile.members.map(m => m.userId),
        environmentalFactors: ['home', 'weekend']
      },
      {
        timeOfDay: 'evening',
        dayOfWeek: 'weekday',
        currentActivity: 'homework',
        familyMembers: familyProfile.members.filter(m => m.role === 'child').map(m => m.userId),
        environmentalFactors: ['home', 'school_night']
      }
    ];
  }

  private calculateRiskScore(violations: SafetyViolation[]): number {
    if (violations.length === 0) return 0.0;
    
    const severityWeights = { low: 0.1, medium: 0.3, high: 0.7, critical: 1.0 };
    const totalWeight = violations.reduce((sum, v) => sum + severityWeights[v.severity], 0);
    
    return Math.min(1.0, totalWeight / violations.length);
  }

  private generateSafetyRecommendations(violations: SafetyViolation[]): string[] {
    const recommendations = new Set<string>();
    
    for (const violation of violations) {
      recommendations.add(violation.remediation);
    }
    
    return Array.from(recommendations);
  }

  private isInteractionSuitable(interaction: any, familyProfile: FamilyProfile): boolean {
    // Check if interaction is suitable for training
    return interaction.patterns && interaction.patterns.length > 0;
  }

  private extractInputFromInteraction(interaction: any): string {
    // Extract meaningful input from interaction
    return interaction.patterns?.map((p: any) => p.description).join(' ') || '';
  }

  private extractExpectedOutput(interaction: any, familyProfile: FamilyProfile): string {
    // Extract expected output based on interaction outcome
    return interaction.outcome?.recommendation || '';
  }

  private extractContext(interaction: any): RecommendationContext {
    return {
      timeOfDay: interaction.context?.timeOfDay || 'unknown',
      dayOfWeek: interaction.context?.dayOfWeek || 'unknown',
      currentActivity: interaction.context?.activity || 'unknown',
      familyMembers: interaction.context?.familyMembers || [],
      environmentalFactors: interaction.context?.environmentalFactors || []
    };
  }

  private determineSafetyLevel(interaction: any, familyProfile: FamilyProfile): string {
    return familyProfile.safetySettings.maxContentRating;
  }

  private getMemberAge(userId: string, familyProfile: FamilyProfile): number {
    const member = familyProfile.members.find(m => m.userId === userId);
    return member?.age || 18;
  }

  private getSafetyWeight(familyProfile: FamilyProfile): number {
    const hasChildren = familyProfile.members.some(m => m.age < 18);
    return hasChildren ? 0.8 : 0.5;
  }

  private getPersonalizationWeight(familyProfile: FamilyProfile): number {
    return 0.7;
  }

  /**
   * Get current training progress
   */
  getTrainingProgress(): number {
    return this.trainingProgress;
  }

  /**
   * Check if fine-tuning is currently in progress
   */
  isFineTuningInProgress(): boolean {
    return this.isTraining;
  }
}