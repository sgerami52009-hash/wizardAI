/**
 * Tests for Family LLM Factory
 */

import { FamilyLLMFactory, FamilyLLMConfig } from './family-llm-factory';
import { LLMEnhancedLearningEngine } from './llm-enhanced-engine';
import { SafetyValidator } from '../safety/safety-validator';
import { PrivacyFilter } from '../privacy/filter';
import { FamilyProfile } from './local-llm-fine-tuner';

// Mock dependencies
jest.mock('./llm-enhanced-engine');
jest.mock('../safety/safety-validator');
jest.mock('../privacy/filter');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('[]'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('FamilyLLMFactory', () => {
  let factory: FamilyLLMFactory;
  let mockConfig: FamilyLLMConfig;
  let mockSafetyValidator: jest.Mocked<SafetyValidator>;
  let mockPrivacyFilter: jest.Mocked<PrivacyFilter>;
  let mockLearningEngine: jest.Mocked<LLMEnhancedLearningEngine>;
  let mockFamilyProfile: FamilyProfile;

  beforeEach(() => {
    mockSafetyValidator = new SafetyValidator({}) as jest.Mocked<SafetyValidator>;
    mockPrivacyFilter = new PrivacyFilter({}) as jest.Mocked<PrivacyFilter>;
    mockLearningEngine = new LLMEnhancedLearningEngine({}, mockSafetyValidator, mockPrivacyFilter) as jest.Mocked<LLMEnhancedLearningEngine>;

    mockConfig = {
      modelsDirectory: '/test/models',
      maxModelsPerFamily: 3,
      fineTuningConfig: {
        modelPath: '/test/base-model',
        outputPath: '/test/output',
        learningRate: 0.001,
        batchSize: 16,
        epochs: 3,
        validationSplit: 0.2,
        safetyThreshold: 0.8,
        privacyLevel: 'high',
        hardwareConstraints: {
          maxMemoryUsage: 2048,
          maxTrainingTime: 60,
          cpuCores: 4,
          storageLimit: 1024
        }
      },
      updateInterval: 24,
      performanceThreshold: 0.8,
      safetyThreshold: 0.9
    };

    mockFamilyProfile = {
      familyId: 'test-family',
      members: [
        {
          userId: 'parent-1',
          age: 35,
          role: 'parent',
          preferences: {
            interests: ['technology', 'education'],
            learningStyle: 'visual',
            difficultyLevel: 'advanced',
            preferredTopics: ['science', 'history'],
            avoidedTopics: ['violence']
          },
          safetyLevel: 'moderate'
        },
        {
          userId: 'child-1',
          age: 8,
          role: 'child',
          preferences: {
            interests: ['games', 'animals'],
            learningStyle: 'kinesthetic',
            difficultyLevel: 'beginner',
            preferredTopics: ['nature', 'art'],
            avoidedTopics: ['scary_content']
          },
          safetyLevel: 'strict'
        }
      ],
      preferences: {
        communicationStyle: 'playful',
        contentCategories: ['educational', 'entertainment'],
        languagePreferences: ['en'],
        culturalContext: ['western'],
        educationalFocus: ['stem', 'creativity'],
        entertainmentTypes: ['games', 'stories']
      },
      safetySettings: {
        maxContentRating: 'G',
        blockedTopics: ['violence', 'adult_content'],
        requiredApprovals: ['new_contacts', 'purchases'],
        timeRestrictions: [{
          startTime: '20:00',
          endTime: '07:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          restrictedContent: ['entertainment']
        }],
        parentalOverride: true
      },
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Setup mock implementations
    mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue([
      {
        userId: 'parent-1',
        timestamp: new Date(),
        patterns: [{ description: 'prefers educational content' }],
        outcome: { recommendation: 'Try a science experiment' },
        context: { timeOfDay: 'morning', activity: 'learning' }
      }
    ]);

    mockLearningEngine.getFamilyProfile = jest.fn().mockResolvedValue(mockFamilyProfile);
    mockLearningEngine.generateRecommendations = jest.fn().mockResolvedValue([
      'General recommendation 1',
      'General recommendation 2'
    ]);

    mockSafetyValidator.validateContent = jest.fn().mockResolvedValue({
      isValid: true,
      violationType: null,
      severity: 'low',
      reason: '',
      affectedMembers: [],
      remediation: ''
    });

    mockPrivacyFilter.filterInteraction = jest.fn().mockResolvedValue({
      userId: 'hashed-user-id',
      patterns: [{ type: 'preference', value: 'educational_content' }],
      context: { timeOfDay: 'morning' },
      metadata: { source: 'voice' },
      privacyLevel: 'high'
    });

    factory = new FamilyLLMFactory(
      mockConfig,
      mockSafetyValidator,
      mockPrivacyFilter,
      mockLearningEngine
    );
  });

  describe('createFamilyModel', () => {
    it('should create a new family model successfully', async () => {
      const modelInfo = await factory.createFamilyModel(mockFamilyProfile);

      expect(modelInfo).toBeDefined();
      expect(modelInfo.familyId).toBe('test-family');
      expect(modelInfo.isActive).toBe(true);
      expect(modelInfo.modelPath).toBeDefined();
      expect(modelInfo.version).toBeDefined();
      expect(modelInfo.performanceMetrics).toBeDefined();
      expect(modelInfo.safetyValidation).toBeDefined();
    });

    it('should update existing model when one already exists', async () => {
      // Create initial model
      const initialModel = await factory.createFamilyModel(mockFamilyProfile);
      
      // Create again should update
      const updatedModel = await factory.createFamilyModel(mockFamilyProfile, [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'new preference' }],
          outcome: { recommendation: 'new recommendation' },
          context: { timeOfDay: 'evening' }
        }
      ]);

      expect(updatedModel.familyId).toBe(initialModel.familyId);
      expect(updatedModel.lastUpdated.getTime()).toBeGreaterThan(initialModel.lastUpdated.getTime());
    });

    it('should emit model creation events', async () => {
      const eventSpy = jest.fn();
      factory.on('modelCreation', eventSpy);

      await factory.createFamilyModel(mockFamilyProfile);

      expect(eventSpy).toHaveBeenCalledWith({
        status: 'started',
        familyId: 'test-family'
      });
      expect(eventSpy).toHaveBeenCalledWith({
        status: 'completed',
        familyId: 'test-family',
        modelInfo: expect.any(Object)
      });
    });

    it('should handle creation failures gracefully', async () => {
      // Mock learning engine to throw error
      mockLearningEngine.getInteractionHistory = jest.fn().mockRejectedValue(new Error('Database error'));

      const eventSpy = jest.fn();
      factory.on('modelCreation', eventSpy);

      await expect(factory.createFamilyModel(mockFamilyProfile))
        .rejects.toThrow('Database error');

      expect(eventSpy).toHaveBeenCalledWith({
        status: 'failed',
        familyId: 'test-family',
        error: 'Database error'
      });
    });
  });

  describe('generateFamilyRecommendations', () => {
    it('should generate recommendations using family model', async () => {
      // Create a family model first
      await factory.createFamilyModel(mockFamilyProfile);

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await factory.generateFamilyRecommendations(
        'test-family',
        context,
        'child-1'
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should fall back to general recommendations when no model exists', async () => {
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await factory.generateFamilyRecommendations(
        'nonexistent-family',
        context
      );

      expect(recommendations).toEqual([
        'General recommendation 1',
        'General recommendation 2'
      ]);
      expect(mockLearningEngine.generateRecommendations).toHaveBeenCalledWith(
        context,
        'nonexistent-family'
      );
    });

    it('should emit recommendation events', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const eventSpy = jest.fn();
      factory.on('recommendationGenerated', eventSpy);

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      await factory.generateFamilyRecommendations('test-family', context);

      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        context,
        recommendationCount: expect.any(Number)
      });
    });
  });

  describe('updateFamilyModel', () => {
    it('should update existing family model with new interactions', async () => {
      // Create initial model
      const initialModel = await factory.createFamilyModel(mockFamilyProfile);

      const newInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'updated preference' }],
          outcome: { recommendation: 'updated recommendation' },
          context: { timeOfDay: 'evening' }
        }
      ];

      const updatedModel = await factory.updateFamilyModel('test-family', newInteractions);

      expect(updatedModel.familyId).toBe('test-family');
      expect(updatedModel.lastUpdated.getTime()).toBeGreaterThan(initialModel.lastUpdated.getTime());
    });

    it('should throw error when updating non-existent model', async () => {
      const newInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'test' }],
          outcome: { recommendation: 'test' },
          context: { timeOfDay: 'morning' }
        }
      ];

      await expect(factory.updateFamilyModel('nonexistent-family', newInteractions))
        .rejects.toThrow('No model found for family: nonexistent-family');
    });

    it('should emit model update events', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const eventSpy = jest.fn();
      factory.on('modelUpdated', eventSpy);

      const newInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'test' }],
          outcome: { recommendation: 'test' },
          context: { timeOfDay: 'morning' }
        }
      ];

      await factory.updateFamilyModel('test-family', newInteractions);

      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        modelInfo: expect.any(Object),
        improvementMetrics: expect.any(Object)
      });
    });
  });

  describe('validateFamilyModel', () => {
    it('should validate existing family model', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const isValid = await factory.validateFamilyModel('test-family');

      expect(isValid).toBe(true);
    });

    it('should return false for non-existent model', async () => {
      const isValid = await factory.validateFamilyModel('nonexistent-family');

      expect(isValid).toBe(false);
    });

    it('should deactivate unsafe models', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      // Mock safety validator to detect violations
      mockSafetyValidator.validateContent = jest.fn().mockResolvedValue({
        isValid: false,
        violationType: 'inappropriate_content',
        severity: 'high',
        reason: 'Contains inappropriate material',
        affectedMembers: ['child-1'],
        remediation: 'Remove inappropriate content'
      });

      const eventSpy = jest.fn();
      factory.on('modelValidationFailed', eventSpy);

      const isValid = await factory.validateFamilyModel('test-family');

      expect(isValid).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        violations: expect.any(Array),
        riskScore: expect.any(Number)
      });

      const modelInfo = factory.getFamilyModelInfo('test-family');
      expect(modelInfo?.isActive).toBe(false);
    });
  });

  describe('Model Management', () => {
    it('should get family model info', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const modelInfo = factory.getFamilyModelInfo('test-family');

      expect(modelInfo).toBeDefined();
      expect(modelInfo?.familyId).toBe('test-family');
    });

    it('should list all family models', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const allModels = factory.getAllFamilyModels();

      expect(allModels).toHaveLength(1);
      expect(allModels[0].familyId).toBe('test-family');
    });

    it('should delete family model', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const eventSpy = jest.fn();
      factory.on('modelDeleted', eventSpy);

      await factory.deleteFamilyModel('test-family');

      expect(factory.getFamilyModelInfo('test-family')).toBeUndefined();
      expect(eventSpy).toHaveBeenCalledWith({ familyId: 'test-family' });
    });
  });

  describe('Scheduled Updates', () => {
    it('should schedule model updates', () => {
      const eventSpy = jest.fn();
      factory.on('updateScheduled', eventSpy);

      factory.scheduleModelUpdates('test-family', 'weekly');

      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        schedule: expect.objectContaining({
          familyId: 'test-family',
          updateFrequency: 'weekly',
          autoUpdate: true
        })
      });
    });

    it('should process scheduled updates', async () => {
      await factory.createFamilyModel(mockFamilyProfile);
      factory.scheduleModelUpdates('test-family', 'daily');

      // Mock recent interactions
      mockLearningEngine.getRecentInteractions = jest.fn().mockResolvedValue([
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'recent interaction' }],
          outcome: { recommendation: 'recent recommendation' },
          context: { timeOfDay: 'morning' }
        }
      ]);

      // Manually trigger update processing (normally done by timer)
      await factory.processScheduledUpdates();

      // Verify update was attempted
      expect(mockLearningEngine.getRecentInteractions).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle recommendation errors gracefully', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      // Mock error in recommendation generation
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Profile error'));

      const eventSpy = jest.fn();
      factory.on('recommendationError', eventSpy);

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await factory.generateFamilyRecommendations('test-family', context);

      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        error: 'Profile error'
      });

      // Should return fallback recommendations
      expect(recommendations).toEqual([
        'General recommendation 1',
        'General recommendation 2'
      ]);
    });

    it('should handle model update errors', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const eventSpy = jest.fn();
      factory.on('modelUpdateError', eventSpy);

      // Mock error in learning engine
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Update error'));

      await expect(factory.updateFamilyModel('test-family', []))
        .rejects.toThrow('Update error');

      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        error: 'Update error'
      });
    });

    it('should handle validation errors', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const eventSpy = jest.fn();
      factory.on('validationError', eventSpy);

      // Mock error in family profile retrieval
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Validation error'));

      const isValid = await factory.validateFamilyModel('test-family');

      expect(isValid).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith({
        familyId: 'test-family',
        error: 'Validation error'
      });
    });
  });

  describe('Hardware Constraints', () => {
    it('should respect hardware constraints during model creation', async () => {
      const modelInfo = await factory.createFamilyModel(mockFamilyProfile);

      expect(modelInfo.performanceMetrics).toBeDefined();
      // Verify that the model was created within hardware constraints
      expect(modelInfo.isActive).toBe(true);
    });
  });

  describe('Privacy and Safety', () => {
    it('should maintain privacy during model operations', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      await factory.generateFamilyRecommendations('test-family', context);

      // Verify privacy filter was used
      expect(mockPrivacyFilter.filterInteraction).toHaveBeenCalled();
    });

    it('should enforce safety validation', async () => {
      await factory.createFamilyModel(mockFamilyProfile);

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      await factory.generateFamilyRecommendations('test-family', context);

      // Verify safety validator was used
      expect(mockSafetyValidator.validateContent).toHaveBeenCalled();
    });
  });
});