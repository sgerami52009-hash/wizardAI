/**
 * Tests for Simplified Fine-Tuning Integration
 */

import { SimpleFineTuningIntegration, SimpleFineTuningConfig } from './fine-tuning-integration-simple';
import { LLMEnhancedLearningEngine } from './llm-enhanced-engine';
import { RecommendationContext } from './local-llm-fine-tuner';

// Mock the LLMEnhancedLearningEngine
jest.mock('./llm-enhanced-engine');

describe('SimpleFineTuningIntegration', () => {
  let integration: SimpleFineTuningIntegration;
  let mockLearningEngine: jest.Mocked<LLMEnhancedLearningEngine>;
  let mockConfig: SimpleFineTuningConfig;

  beforeEach(() => {
    mockLearningEngine = new LLMEnhancedLearningEngine({}, {} as any, {} as any) as jest.Mocked<LLMEnhancedLearningEngine>;
    
    mockConfig = {
      enabled: true,
      minInteractionsForTraining: 10,
      retrainingThreshold: 5,
      maxMemoryUsage: 1024,
      safetyThreshold: 0.9,
      fallbackToGeneral: true
    };

    // Setup mock implementations
    mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue([
      {
        userId: 'user1',
        timestamp: new Date(),
        patterns: [{ description: 'prefers educational content' }],
        outcome: { recommendation: 'Try a science experiment' },
        context: { timeOfDay: 'morning', activity: 'learning' }
      }
    ]);

    mockLearningEngine.getFamilyProfile = jest.fn().mockResolvedValue({
      familyId: 'test-family',
      members: [
        { userId: 'parent1', age: 35, role: 'parent' },
        { userId: 'child1', age: 8, role: 'child' }
      ],
      preferences: { communicationStyle: 'friendly' },
      safetySettings: { maxContentRating: 'G' },
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    mockLearningEngine.generateRecommendations = jest.fn().mockResolvedValue([
      'General recommendation 1',
      'General recommendation 2',
      'General recommendation 3'
    ]);

    integration = new SimpleFineTuningIntegration(mockConfig, mockLearningEngine);
  });

  describe('Initialization', () => {
    it('should initialize successfully when enabled', async () => {
      await integration.initialize();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics.totalFamilyModels).toBeGreaterThan(0);
    });

    it('should skip initialization when disabled', async () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      const disabledIntegration = new SimpleFineTuningIntegration(disabledConfig, mockLearningEngine);
      
      await disabledIntegration.initialize();
      
      const metrics = disabledIntegration.getIntegrationMetrics();
      expect(metrics.totalFamilyModels).toBe(0);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock an error during initialization
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      // Force an error by making getFamilyProfile throw
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(integration.initialize()).rejects.toThrow('Database error');
      
      console.error = originalConsoleError;
    });
  });

  describe('Recommendation Generation', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should generate family-specific recommendations when model exists', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'sample-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should contain family-specific personalization
      expect(recommendations.some(rec => rec.includes('🌅 Morning activity'))).toBe(true);
    });

    it('should generate fallback recommendations when no model exists', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'tuesday',
        currentActivity: 'homework',
        familyMembers: ['child1'],
        environmentalFactors: ['home', 'school_day']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(mockLearningEngine.generateRecommendations).toHaveBeenCalledWith(context, 'nonexistent-family');
    });

    it('should handle recommendation errors gracefully', async () => {
      // Mock an error in the learning engine
      mockLearningEngine.generateRecommendations = jest.fn().mockRejectedValue(new Error('Service error'));
      
      const context: RecommendationContext = {
        timeOfDay: 'evening',
        dayOfWeek: 'friday',
        currentActivity: 'family_time',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'test-family',
        context
      );

      // Should still return some recommendations (fallback)
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should add target member specific recommendations', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'sample-family',
        context,
        'child1'
      );

      expect(recommendations.some(rec => rec.includes('👤 Special activity for child1'))).toBe(true);
    });
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should create a new family model when eligible', async () => {
      // Mock sufficient interactions
      mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue(
        Array(15).fill({
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }]
        })
      );

      const success = await integration.createOrUpdateFamilyModel('new-family');

      expect(success).toBe(true);
      expect(mockLearningEngine.getFamilyProfile).toHaveBeenCalledWith('new-family');
      
      const modelInfo = integration.getFamilyModelInfo('new-family');
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.familyId).toBe('new-family');
    });

    it('should update existing family model', async () => {
      // Mock sufficient interactions
      mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue(
        Array(15).fill({
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }]
        })
      );

      const originalModel = integration.getFamilyModelInfo('sample-family');
      const originalVersion = originalModel?.version;

      const success = await integration.createOrUpdateFamilyModel('sample-family');

      expect(success).toBe(true);
      
      const updatedModel = integration.getFamilyModelInfo('sample-family');
      expect(updatedModel?.version).not.toBe(originalVersion);
      expect(updatedModel?.lastUpdated.getTime()).toBeGreaterThan(originalModel!.lastUpdated.getTime());
    });

    it('should not create model when insufficient interactions', async () => {
      // Mock insufficient interactions
      mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue([
        { userId: 'user1', timestamp: new Date() }
      ]);

      const success = await integration.createOrUpdateFamilyModel('insufficient-family');

      expect(success).toBe(false);
      expect(integration.getFamilyModelInfo('insufficient-family')).toBeUndefined();
    });

    it('should handle model creation errors', async () => {
      // Mock error in family profile retrieval
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Profile error'));
      
      // Mock sufficient interactions
      mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue(
        Array(15).fill({ userId: 'user1', timestamp: new Date() })
      );

      const success = await integration.createOrUpdateFamilyModel('error-family');

      expect(success).toBe(false);
    });
  });

  describe('Model Validation', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should validate all family models', async () => {
      const results = await integration.validateAllFamilyModels();

      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(results['sample-family']).toBe(true); // Sample model should be valid
    });

    it('should mark models as invalid when safety threshold not met', async () => {
      // Create a model with low safety score
      await integration.createOrUpdateFamilyModel('unsafe-family');
      const unsafeModel = integration.getFamilyModelInfo('unsafe-family');
      if (unsafeModel) {
        unsafeModel.safetyScore = 0.5; // Below threshold
      }

      const results = await integration.validateAllFamilyModels();

      expect(results['unsafe-family']).toBe(false);
      expect(integration.getFamilyModelInfo('unsafe-family')?.isActive).toBe(false);
    });
  });

  describe('Model Information', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should get family model info', () => {
      const modelInfo = integration.getFamilyModelInfo('sample-family');

      expect(modelInfo).toBeDefined();
      expect(modelInfo?.familyId).toBe('sample-family');
      expect(modelInfo?.isActive).toBe(true);
    });

    it('should return undefined for non-existent model', () => {
      const modelInfo = integration.getFamilyModelInfo('nonexistent-family');

      expect(modelInfo).toBeUndefined();
    });

    it('should list all family models', () => {
      const allModels = integration.getAllFamilyModels();

      expect(Array.isArray(allModels)).toBe(true);
      expect(allModels.length).toBeGreaterThan(0);
      expect(allModels.some(m => m.familyId === 'sample-family')).toBe(true);
    });

    it('should delete family model', async () => {
      await integration.deleteFamilyModel('sample-family');

      const modelInfo = integration.getFamilyModelInfo('sample-family');
      expect(modelInfo).toBeUndefined();
    });
  });

  describe('Integration Metrics', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should provide integration metrics', () => {
      const metrics = integration.getIntegrationMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalFamilyModels).toBe('number');
      expect(typeof metrics.activeModels).toBe('number');
      expect(typeof metrics.averagePerformance).toBe('number');
      expect(typeof metrics.safetyCompliance).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(metrics.lastUpdate).toBeInstanceOf(Date);
    });

    it('should calculate correct metrics', () => {
      const metrics = integration.getIntegrationMetrics();

      expect(metrics.totalFamilyModels).toBe(1); // Sample family
      expect(metrics.activeModels).toBe(1);
      expect(metrics.averagePerformance).toBeGreaterThan(0);
      expect(metrics.safetyCompliance).toBeGreaterThan(0.9);
    });
  });

  describe('Configuration Management', () => {
    it('should enable/disable fine-tuning', () => {
      integration.setEnabled(false);
      // Test that operations are skipped when disabled
      
      integration.setEnabled(true);
      // Test that operations work when enabled
    });

    it('should handle disabled state correctly', async () => {
      integration.setEnabled(false);

      const context: RecommendationContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'test-family',
        context
      );

      // Should still return recommendations (fallback)
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Time-based Recommendations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should provide morning-specific recommendations', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations.some(rec => rec.toLowerCase().includes('morning'))).toBe(true);
    });

    it('should provide evening-specific recommendations', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'evening',
        dayOfWeek: 'friday',
        currentActivity: 'family_time',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations.some(rec => rec.toLowerCase().includes('evening') || rec.toLowerCase().includes('bedtime'))).toBe(true);
    });
  });

  describe('Activity-based Recommendations', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should provide homework-specific recommendations', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'tuesday',
        currentActivity: 'homework',
        familyMembers: ['child1'],
        environmentalFactors: ['home', 'school_day']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations.some(rec => 
        rec.toLowerCase().includes('study') || 
        rec.toLowerCase().includes('homework') ||
        rec.toLowerCase().includes('focus')
      )).toBe(true);
    });

    it('should provide play-specific recommendations', async () => {
      const context: RecommendationContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations.some(rec => 
        rec.toLowerCase().includes('play') || 
        rec.toLowerCase().includes('game') ||
        rec.toLowerCase().includes('creative')
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    it('should handle learning engine errors gracefully', async () => {
      // Mock all learning engine methods to throw errors
      mockLearningEngine.getInteractionHistory = jest.fn().mockRejectedValue(new Error('DB Error'));
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Profile Error'));
      mockLearningEngine.generateRecommendations = jest.fn().mockRejectedValue(new Error('Recommendation Error'));

      const context: RecommendationContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      // Should still work with fallback mechanisms
      const recommendations = await integration.generatePersonalizedRecommendations(
        'error-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should handle model creation failures', async () => {
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Profile not found'));

      const success = await integration.createOrUpdateFamilyModel('error-family');

      expect(success).toBe(false);
    });
  });
});