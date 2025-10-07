/**
 * Tests for Local LLM Fine-Tuner
 */

import { LocalLLMFineTuner, FamilyProfile, FineTuningConfig } from './local-llm-fine-tuner';
import { SafetyValidator } from '../safety/safety-validator';
import { PrivacyFilter } from '../privacy/filter';

// Mock dependencies
jest.mock('../safety/safety-validator');
jest.mock('../privacy/filter');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{"model_data": "test"}'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('LocalLLMFineTuner', () => {
  let fineTuner: LocalLLMFineTuner;
  let mockSafetyValidator: jest.Mocked<SafetyValidator>;
  let mockPrivacyFilter: jest.Mocked<PrivacyFilter>;
  let mockConfig: FineTuningConfig;
  let mockFamilyProfile: FamilyProfile;

  beforeEach(() => {
    mockSafetyValidator = new SafetyValidator({}) as jest.Mocked<SafetyValidator>;
    mockPrivacyFilter = new PrivacyFilter({}) as jest.Mocked<PrivacyFilter>;
    
    mockConfig = {
      modelPath: '/test/model',
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

    fineTuner = new LocalLLMFineTuner(mockConfig, mockSafetyValidator, mockPrivacyFilter);

    // Setup mock implementations
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
  });

  describe('createFamilyDataset', () => {
    it('should create a valid family dataset from interactions', async () => {
      const mockInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'prefers educational content' }],
          outcome: { recommendation: 'Try a science experiment' },
          context: { timeOfDay: 'morning', activity: 'learning' }
        },
        {
          userId: 'child-1',
          timestamp: new Date(),
          patterns: [{ description: 'enjoys animal stories' }],
          outcome: { recommendation: 'Read about zoo animals' },
          context: { timeOfDay: 'afternoon', activity: 'reading' }
        }
      ];

      const dataset = await fineTuner.createFamilyDataset(mockFamilyProfile, mockInteractions);

      expect(dataset).toBeDefined();
      expect(dataset.familyId).toBe('test-family');
      expect(dataset.trainingExamples).toHaveLength(2);
      expect(dataset.validationExamples).toHaveLength(0); // Small dataset
      expect(dataset.metadata.safetyValidated).toBe(true);
      expect(dataset.metadata.privacyFiltered).toBe(true);
    });

    it('should filter out unsafe interactions', async () => {
      const mockInteractions = [
        {
          userId: 'child-1',
          timestamp: new Date(),
          patterns: [{ description: 'inappropriate content request' }],
          outcome: { recommendation: 'Violent game suggestion' },
          context: { timeOfDay: 'evening' }
        }
      ];

      // Mock safety validator to reject unsafe content
      mockSafetyValidator.validateContent = jest.fn()
        .mockResolvedValueOnce({ isValid: true, violationType: null, severity: 'low', reason: '', affectedMembers: [], remediation: '' })
        .mockResolvedValueOnce({ isValid: false, violationType: 'inappropriate', severity: 'high', reason: 'Violent content', affectedMembers: ['child-1'], remediation: 'Remove content' });

      const dataset = await fineTuner.createFamilyDataset(mockFamilyProfile, mockInteractions);

      expect(dataset.trainingExamples).toHaveLength(0);
      expect(dataset.validationExamples).toHaveLength(0);
    });

    it('should emit progress events during dataset creation', async () => {
      const progressSpy = jest.fn();
      fineTuner.on('datasetCreation', progressSpy);

      const mockInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }],
          outcome: { recommendation: 'test recommendation' },
          context: { timeOfDay: 'morning' }
        }
      ];

      await fineTuner.createFamilyDataset(mockFamilyProfile, mockInteractions);

      expect(progressSpy).toHaveBeenCalledWith({
        status: 'started',
        familyId: 'test-family'
      });
      expect(progressSpy).toHaveBeenCalledWith({
        status: 'completed',
        familyId: 'test-family',
        exampleCount: 1
      });
    });
  });

  describe('fineTuneModel', () => {
    it('should successfully fine-tune a model', async () => {
      const mockDataset = {
        familyId: 'test-family',
        trainingExamples: [
          {
            input: 'What should we do for learning?',
            expectedOutput: 'Try a science experiment',
            context: {
              timeOfDay: 'morning',
              dayOfWeek: 'saturday',
              currentActivity: 'learning',
              familyMembers: ['parent-1', 'child-1'],
              environmentalFactors: ['home']
            },
            safetyLevel: 'G',
            memberAge: 8,
            timestamp: new Date()
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 1,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: 0.8,
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      const result = await fineTuner.fineTuneModel(mockDataset, mockFamilyProfile);

      expect(result.success).toBe(true);
      expect(result.modelPath).toBeDefined();
      expect(result.performanceMetrics).toBeDefined();
      expect(result.safetyValidation).toBeDefined();
      expect(result.trainingTime).toBeGreaterThan(0);
    });

    it('should handle training failures gracefully', async () => {
      const mockDataset = {
        familyId: 'test-family',
        trainingExamples: [],
        validationExamples: [],
        metadata: {
          totalExamples: 0,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: 0.0,
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      // Mock hardware constraint failure
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: mockConfig.hardwareConstraints.maxMemoryUsage * 1024 * 1024 * 2, // Exceed limit
        external: 0,
        arrayBuffers: 0
      });

      const result = await fineTuner.fineTuneModel(mockDataset, mockFamilyProfile);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Insufficient memory');
    });

    it('should emit training progress events', async () => {
      const progressSpy = jest.fn();
      fineTuner.on('trainingProgress', progressSpy);

      const mockDataset = {
        familyId: 'test-family',
        trainingExamples: [
          {
            input: 'test input',
            expectedOutput: 'test output',
            context: {
              timeOfDay: 'morning',
              dayOfWeek: 'saturday',
              currentActivity: 'test',
              familyMembers: ['parent-1'],
              environmentalFactors: ['home']
            },
            safetyLevel: 'G',
            memberAge: 35,
            timestamp: new Date()
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 1,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: 0.8,
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      await fineTuner.fineTuneModel(mockDataset, mockFamilyProfile);

      expect(progressSpy).toHaveBeenCalled();
      const lastCall = progressSpy.mock.calls[progressSpy.mock.calls.length - 1][0];
      expect(lastCall.epoch).toBe(mockConfig.epochs);
      expect(lastCall.progress).toBe(1);
    });
  });

  describe('generateFamilyRecommendations', () => {
    it('should generate safe family recommendations', async () => {
      const mockContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await fineTuner.generateFamilyRecommendations(
        '/test/model/path',
        mockContext,
        mockFamilyProfile,
        'child-1'
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should return fallback recommendations on error', async () => {
      const mockContext = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent-1', 'child-1'],
        environmentalFactors: ['home', 'weekend']
      };

      // Mock file read error
      const fs = require('fs');
      fs.promises.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const recommendations = await fineTuner.generateFamilyRecommendations(
        '/invalid/model/path',
        mockContext,
        mockFamilyProfile
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('family');
    });
  });

  describe('validateModel', () => {
    it('should validate model safety and performance', async () => {
      const validation = await fineTuner.validateModel('/test/model/path', mockFamilyProfile);

      expect(validation).toBeDefined();
      expect(validation.passed).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.riskScore).toBeLessThan(mockConfig.safetyThreshold);
    });

    it('should detect safety violations', async () => {
      // Mock safety validator to detect violations
      mockSafetyValidator.validateContent = jest.fn().mockResolvedValue({
        isValid: false,
        violationType: 'inappropriate_content',
        severity: 'high',
        reason: 'Contains inappropriate material',
        affectedMembers: ['child-1'],
        remediation: 'Remove inappropriate content'
      });

      const validation = await fineTuner.validateModel('/test/model/path', mockFamilyProfile);

      expect(validation.passed).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(validation.riskScore).toBeGreaterThan(0);
    });
  });

  describe('updateModelWithNewData', () => {
    it('should perform incremental model updates', async () => {
      const newInteractions = [
        {
          userId: 'parent-1',
          timestamp: new Date(),
          patterns: [{ description: 'new learning preference' }],
          outcome: { recommendation: 'Try new activity' },
          context: { timeOfDay: 'evening' }
        }
      ];

      const result = await fineTuner.updateModelWithNewData(
        '/test/model/path',
        newInteractions,
        mockFamilyProfile
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Hardware Constraints', () => {
    it('should respect memory constraints during training', async () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: mockConfig.hardwareConstraints.maxMemoryUsage * 1024 * 1024 * 0.9,
        external: 0,
        arrayBuffers: 0
      });

      const mockDataset = {
        familyId: 'test-family',
        trainingExamples: [
          {
            input: 'test',
            expectedOutput: 'test',
            context: {
              timeOfDay: 'morning',
              dayOfWeek: 'saturday',
              currentActivity: 'test',
              familyMembers: ['parent-1'],
              environmentalFactors: ['home']
            },
            safetyLevel: 'G',
            memberAge: 35,
            timestamp: new Date()
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 1,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: 0.8,
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      const result = await fineTuner.fineTuneModel(mockDataset, mockFamilyProfile);
      
      // Should still succeed with memory optimization
      expect(result.success).toBe(true);
      expect(result.memoryUsage).toBeLessThanOrEqual(mockConfig.hardwareConstraints.maxMemoryUsage);
    });
  });

  describe('Privacy Protection', () => {
    it('should maintain privacy during fine-tuning', async () => {
      const mockInteractions = [
        {
          userId: 'parent-1',
          personalInfo: 'John Doe, 123 Main St',
          timestamp: new Date(),
          patterns: [{ description: 'prefers morning activities' }],
          outcome: { recommendation: 'Morning exercise' },
          context: { timeOfDay: 'morning' }
        }
      ];

      const dataset = await fineTuner.createFamilyDataset(mockFamilyProfile, mockInteractions);

      expect(mockPrivacyFilter.filterInteraction).toHaveBeenCalled();
      expect(dataset.metadata.privacyFiltered).toBe(true);
      
      // Verify no PII in training examples
      for (const example of dataset.trainingExamples) {
        expect(example.input).not.toContain('John Doe');
        expect(example.input).not.toContain('123 Main St');
      }
    });
  });

  describe('Child Safety', () => {
    it('should enforce stricter safety for child users', async () => {
      const childContext = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child-1'],
        environmentalFactors: ['home']
      };

      const recommendations = await fineTuner.generateFamilyRecommendations(
        '/test/model/path',
        childContext,
        mockFamilyProfile,
        'child-1'
      );

      expect(mockSafetyValidator.validateContent).toHaveBeenCalled();
      expect(recommendations).toBeDefined();
      
      // All recommendations should be child-appropriate
      for (const rec of recommendations) {
        expect(rec).not.toContain('violence');
        expect(rec).not.toContain('adult');
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should track training progress', () => {
      expect(fineTuner.getTrainingProgress()).toBe(0);
      expect(fineTuner.isFineTuningInProgress()).toBe(false);
    });

    it('should prevent concurrent fine-tuning', async () => {
      const mockDataset = {
        familyId: 'test-family',
        trainingExamples: [],
        validationExamples: [],
        metadata: {
          totalExamples: 0,
          safetyValidated: true,
          privacyFiltered: true,
          qualityScore: 0.8,
          createdAt: new Date(),
          lastValidated: new Date()
        }
      };

      // Start first fine-tuning
      const promise1 = fineTuner.fineTuneModel(mockDataset, mockFamilyProfile);
      
      // Try to start second fine-tuning
      await expect(fineTuner.fineTuneModel(mockDataset, mockFamilyProfile))
        .rejects.toThrow('Fine-tuning already in progress');

      await promise1;
    });
  });
});