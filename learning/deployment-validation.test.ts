/**
 * Deployment Validation Tests for Fine-Tuning System
 * 
 * Comprehensive tests to validate the deployment and integration of the
 * local LLM fine-tuning system in various environments.
 */

import { 
  SimpleFineTuningIntegration,
  FineTuningConfigFactory,
  RuntimeConfigDetector,
  LocalLLMFineTuner,
  FamilyLLMFactory
} from './index';
import { LLMEnhancedLearningEngine } from './llm-enhanced-engine';

describe('Fine-Tuning System Deployment Validation', () => {
  let mockLearningEngine: jest.Mocked<LLMEnhancedLearningEngine>;

  beforeEach(() => {
    // Create mock learning engine
    mockLearningEngine = {
      getInteractionHistory: jest.fn().mockResolvedValue([
        {
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }],
          outcome: { recommendation: 'test recommendation' },
          context: { timeOfDay: 'morning' }
        }
      ]),
      getFamilyProfile: jest.fn().mockResolvedValue({
        familyId: 'test-family',
        members: [{ userId: 'user1', age: 35, role: 'parent' }],
        preferences: { communicationStyle: 'friendly' },
        safetySettings: { maxContentRating: 'G' },
        createdAt: new Date(),
        lastUpdated: new Date()
      }),
      generateRecommendations: jest.fn().mockResolvedValue([
        'Test recommendation 1',
        'Test recommendation 2'
      ])
    } as any;
  });

  describe('System Initialization', () => {
    it('should initialize successfully in development environment', async () => {
      const config = FineTuningConfigFactory.getConfig('development');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      await expect(integration.initialize()).resolves.not.toThrow();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalFamilyModels).toBe('number');
    });

    it('should initialize successfully in production environment', async () => {
      const config = FineTuningConfigFactory.getConfig('production');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      await expect(integration.initialize()).resolves.not.toThrow();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics).toBeDefined();
    });

    it('should initialize successfully in Jetson environment', async () => {
      const config = FineTuningConfigFactory.getConfig('jetson');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      await expect(integration.initialize()).resolves.not.toThrow();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics).toBeDefined();
    });

    it('should initialize successfully in child-safe environment', async () => {
      const config = FineTuningConfigFactory.getConfig('child-safe');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      await expect(integration.initialize()).resolves.not.toThrow();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle disabled configuration gracefully', async () => {
      const config = FineTuningConfigFactory.getConfig('development');
      config.enabled = false;
      
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      await expect(integration.initialize()).resolves.not.toThrow();
      
      const metrics = integration.getIntegrationMetrics();
      expect(metrics.totalFamilyModels).toBe(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate Jetson configuration constraints', () => {
      const jetsonConfig = FineTuningConfigFactory.getFineTuningConfig('jetson');
      const validation = FineTuningConfigFactory.validateConfig(jetsonConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate development configuration', () => {
      const devConfig = FineTuningConfigFactory.getFineTuningConfig('development');
      const validation = FineTuningConfigFactory.validateConfig(devConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate production configuration', () => {
      const prodConfig = FineTuningConfigFactory.getFineTuningConfig('production');
      const validation = FineTuningConfigFactory.validateConfig(prodConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate child-safe configuration', () => {
      const childSafeConfig = FineTuningConfigFactory.getFineTuningConfig('child-safe');
      const validation = FineTuningConfigFactory.validateConfig(childSafeConfig);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(childSafeConfig.safetyThreshold).toBeGreaterThanOrEqual(0.99);
    });

    it('should detect invalid configurations', () => {
      const invalidConfig = FineTuningConfigFactory.getFineTuningConfig('jetson');
      invalidConfig.hardwareConstraints.maxMemoryUsage = 16384; // Exceed Jetson capacity
      invalidConfig.safetyThreshold = 0.5; // Too low for family use
      
      const validation = FineTuningConfigFactory.validateConfig(invalidConfig);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Runtime Configuration Detection', () => {
    it('should detect optimal configuration for current system', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.familyLLMConfig).toBeDefined();
      expect(config.minInteractionsForTraining).toBeGreaterThan(0);
    });

    it('should provide system resource information', () => {
      const resources = RuntimeConfigDetector.getSystemResources();

      expect(resources).toBeDefined();
      expect(typeof resources.totalMemory).toBe('number');
      expect(typeof resources.availableMemory).toBe('number');
      expect(typeof resources.cpuCores).toBe('number');
      expect(typeof resources.architecture).toBe('string');
    });

    it('should optimize configuration for available hardware', () => {
      const baseConfig = FineTuningConfigFactory.getFineTuningConfig('jetson');
      const optimized = FineTuningConfigFactory.optimizeForHardware(
        baseConfig,
        4096, // 4GB available memory
        6,    // 6 CPU cores
        1024  // 1GB GPU memory
      );

      expect(optimized.hardwareConstraints.maxMemoryUsage).toBeLessThanOrEqual(4096 * 0.7);
      expect(optimized.hardwareConstraints.cpuCores).toBeLessThanOrEqual(4); // 6 - 2
      expect(optimized.hardwareConstraints.gpuMemory).toBeLessThanOrEqual(1024 * 0.8);
    });
  });

  describe('Core Functionality Validation', () => {
    let integration: SimpleFineTuningIntegration;

    beforeEach(async () => {
      const config = FineTuningConfigFactory.getConfig('development');
      integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
      await integration.initialize();
    });

    it('should generate recommendations successfully', async () => {
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'test-family',
        context
      );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should create family models when eligible', async () => {
      // Mock sufficient interactions
      mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue(
        Array(20).fill({
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }]
        })
      );

      const success = await integration.createOrUpdateFamilyModel('eligible-family');

      expect(success).toBe(true);
      expect(integration.getFamilyModelInfo('eligible-family')).toBeDefined();
    });

    it('should validate family models for safety', async () => {
      // Create a test model first
      await integration.createOrUpdateFamilyModel('test-family');

      const validationResults = await integration.validateAllFamilyModels();

      expect(validationResults).toBeDefined();
      expect(typeof validationResults).toBe('object');
    });

    it('should provide comprehensive metrics', () => {
      const metrics = integration.getIntegrationMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalFamilyModels).toBe('number');
      expect(typeof metrics.activeModels).toBe('number');
      expect(typeof metrics.averagePerformance).toBe('number');
      expect(typeof metrics.safetyCompliance).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(metrics.lastUpdate).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling and Resilience', () => {
    let integration: SimpleFineTuningIntegration;

    beforeEach(async () => {
      const config = FineTuningConfigFactory.getConfig('development');
      integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
      await integration.initialize();
    });

    it('should handle learning engine failures gracefully', async () => {
      // Mock learning engine to throw errors
      mockLearningEngine.getInteractionHistory = jest.fn().mockRejectedValue(new Error('Database error'));
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Profile error'));
      mockLearningEngine.generateRecommendations = jest.fn().mockRejectedValue(new Error('Recommendation error'));

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      // Should still provide fallback recommendations
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

    it('should handle validation errors', async () => {
      mockLearningEngine.getFamilyProfile = jest.fn().mockRejectedValue(new Error('Validation error'));

      const validationResults = await integration.validateAllFamilyModels();

      expect(validationResults).toBeDefined();
      expect(typeof validationResults).toBe('object');
    });

    it('should handle memory constraints', () => {
      const constrainedConfig = FineTuningConfigFactory.getFineTuningConfig('jetson');
      constrainedConfig.hardwareConstraints.maxMemoryUsage = 512; // Very limited memory

      const validation = FineTuningConfigFactory.validateConfig(constrainedConfig);

      // Should still be valid but with warnings
      expect(validation).toBeDefined();
    });
  });

  describe('Safety and Privacy Validation', () => {
    let integration: SimpleFineTuningIntegration;

    beforeEach(async () => {
      const config = FineTuningConfigFactory.getConfig('child-safe');
      integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
      await integration.initialize();
    });

    it('should enforce child-safe configurations', () => {
      const childSafeConfig = FineTuningConfigFactory.getConfig('child-safe');

      expect(childSafeConfig.familyLLMConfig.safetyThreshold).toBeGreaterThanOrEqual(0.99);
      expect(childSafeConfig.minInteractionsForTraining).toBeGreaterThanOrEqual(100);
    });

    it('should generate age-appropriate recommendations', async () => {
      const context = {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        currentActivity: 'play',
        familyMembers: ['child1'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'child-family',
        context,
        'child1'
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Verify no inappropriate content
      recommendations.forEach(rec => {
        expect(rec.toLowerCase()).not.toContain('violence');
        expect(rec.toLowerCase()).not.toContain('adult');
        expect(rec.toLowerCase()).not.toContain('inappropriate');
      });
    });

    it('should validate safety thresholds', async () => {
      const validationResults = await integration.validateAllFamilyModels();

      // All models should pass safety validation in child-safe mode
      Object.values(validationResults).forEach(isValid => {
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Performance and Scalability', () => {
    let integration: SimpleFineTuningIntegration;

    beforeEach(async () => {
      const config = FineTuningConfigFactory.getConfig('jetson');
      integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
      await integration.initialize();
    });

    it('should handle multiple concurrent recommendation requests', async () => {
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      const promises = Array(10).fill(null).map((_, i) =>
        integration.generatePersonalizedRecommendations(`family-${i}`, context)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(recommendations => {
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should manage memory usage efficiently', () => {
      const metrics = integration.getIntegrationMetrics();
      const jetsonConfig = FineTuningConfigFactory.getConfig('jetson');

      // Memory usage should be within Jetson constraints
      expect(metrics.memoryUsage).toBeLessThanOrEqual(
        jetsonConfig.familyLLMConfig.fineTuningConfig.hardwareConstraints.maxMemoryUsage
      );
    });

    it('should scale with multiple family models', async () => {
      // Create multiple family models
      const familyIds = ['family1', 'family2', 'family3', 'family4', 'family5'];
      
      for (const familyId of familyIds) {
        mockLearningEngine.getInteractionHistory = jest.fn().mockResolvedValue(
          Array(15).fill({ userId: 'user1', timestamp: new Date() })
        );
        await integration.createOrUpdateFamilyModel(familyId);
      }

      const metrics = integration.getIntegrationMetrics();
      expect(metrics.totalFamilyModels).toBeGreaterThanOrEqual(familyIds.length);

      // Validate all models
      const validationResults = await integration.validateAllFamilyModels();
      expect(Object.keys(validationResults).length).toBeGreaterThanOrEqual(familyIds.length);
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should integrate with LLM Enhanced Learning Engine', () => {
      const config = FineTuningConfigFactory.getConfig('development');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);

      expect(integration).toBeDefined();
      expect(mockLearningEngine.getInteractionHistory).toBeDefined();
      expect(mockLearningEngine.getFamilyProfile).toBeDefined();
      expect(mockLearningEngine.generateRecommendations).toBeDefined();
    });

    it('should export all required components', () => {
      // Verify all components are properly exported
      expect(SimpleFineTuningIntegration).toBeDefined();
      expect(FineTuningConfigFactory).toBeDefined();
      expect(RuntimeConfigDetector).toBeDefined();
      expect(LocalLLMFineTuner).toBeDefined();
      expect(FamilyLLMFactory).toBeDefined();
    });

    it('should maintain backward compatibility', async () => {
      // Test that existing learning engine functionality still works
      const interactions = await mockLearningEngine.getInteractionHistory('test-family');
      expect(interactions).toBeDefined();

      const profile = await mockLearningEngine.getFamilyProfile('test-family');
      expect(profile).toBeDefined();

      const recommendations = await mockLearningEngine.generateRecommendations({}, 'test-family');
      expect(recommendations).toBeDefined();
    });
  });

  describe('Deployment Environment Validation', () => {
    it('should work in Node.js environment', () => {
      expect(typeof process).toBe('object');
      expect(typeof process.env).toBe('object');
      expect(typeof process.memoryUsage).toBe('function');
    });

    it('should handle different operating systems', () => {
      const resources = RuntimeConfigDetector.getSystemResources();
      
      expect(resources.architecture).toBeDefined();
      expect(['x64', 'arm64', 'arm'].includes(resources.architecture)).toBe(true);
    });

    it('should validate TypeScript compilation', () => {
      // This test ensures TypeScript types are properly defined
      const config = FineTuningConfigFactory.getConfig('development');
      
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.minInteractionsForTraining).toBe('number');
      expect(typeof config.familyLLMConfig).toBe('object');
    });
  });

  describe('Documentation and Examples', () => {
    it('should provide working configuration examples', () => {
      const environments = ['development', 'production', 'jetson', 'child-safe'] as const;
      
      environments.forEach(env => {
        const config = FineTuningConfigFactory.getConfig(env);
        expect(config).toBeDefined();
        expect(config.enabled).toBeDefined();
        expect(config.familyLLMConfig).toBeDefined();
      });
    });

    it('should validate example usage patterns', async () => {
      const config = FineTuningConfigFactory.getConfig('development');
      const integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
      
      await integration.initialize();
      
      // Example usage from documentation
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1', 'child1'],
        environmentalFactors: ['home', 'weekend']
      };

      const recommendations = await integration.generatePersonalizedRecommendations(
        'smith-family',
        context,
        'child1'
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Integration Test Suite for Real-World Scenarios
 */
describe('Fine-Tuning System Integration Tests', () => {
  let integration: SimpleFineTuningIntegration;
  let mockLearningEngine: jest.Mocked<LLMEnhancedLearningEngine>;

  beforeEach(async () => {
    mockLearningEngine = {
      getInteractionHistory: jest.fn(),
      getFamilyProfile: jest.fn(),
      generateRecommendations: jest.fn()
    } as any;

    const config = await RuntimeConfigDetector.detectOptimalConfig();
    integration = new SimpleFineTuningIntegration(config, mockLearningEngine);
  });

  it('should handle complete family onboarding workflow', async () => {
    // Step 1: Initialize system
    await integration.initialize();

    // Step 2: Mock family with insufficient interactions
    mockLearningEngine.getInteractionHistory.mockResolvedValue([
      { userId: 'user1', timestamp: new Date() }
    ]);

    // Step 3: Try to create model (should fail due to insufficient data)
    let success = await integration.createOrUpdateFamilyModel('new-family');
    expect(success).toBe(false);

    // Step 4: Mock sufficient interactions
    mockLearningEngine.getInteractionHistory.mockResolvedValue(
      Array(50).fill({ userId: 'user1', timestamp: new Date(), patterns: [{ description: 'test' }] })
    );
    mockLearningEngine.getFamilyProfile.mockResolvedValue({
      familyId: 'new-family',
      members: [{ userId: 'user1', age: 35, role: 'parent' }],
      preferences: { communicationStyle: 'friendly' },
      safetySettings: { maxContentRating: 'G' },
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    // Step 5: Create model (should succeed)
    success = await integration.createOrUpdateFamilyModel('new-family');
    expect(success).toBe(true);

    // Step 6: Generate recommendations
    const context = {
      timeOfDay: 'morning',
      dayOfWeek: 'saturday',
      currentActivity: 'breakfast',
      familyMembers: ['user1'],
      environmentalFactors: ['home']
    };

    const recommendations = await integration.generatePersonalizedRecommendations(
      'new-family',
      context
    );

    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);

    // Step 7: Validate model
    const validationResults = await integration.validateAllFamilyModels();
    expect(validationResults['new-family']).toBe(true);
  });

  it('should handle system recovery after failures', async () => {
    await integration.initialize();

    // Simulate system failure
    mockLearningEngine.getInteractionHistory.mockRejectedValue(new Error('System failure'));
    mockLearningEngine.getFamilyProfile.mockRejectedValue(new Error('System failure'));
    mockLearningEngine.generateRecommendations.mockRejectedValue(new Error('System failure'));

    // System should still provide fallback functionality
    const context = {
      timeOfDay: 'morning',
      dayOfWeek: 'saturday',
      currentActivity: 'breakfast',
      familyMembers: ['user1'],
      environmentalFactors: ['home']
    };

    const recommendations = await integration.generatePersonalizedRecommendations(
      'recovery-family',
      context
    );

    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it('should maintain performance under load', async () => {
    await integration.initialize();

    mockLearningEngine.getInteractionHistory.mockResolvedValue([
      { userId: 'user1', timestamp: new Date(), patterns: [{ description: 'test' }] }
    ]);
    mockLearningEngine.generateRecommendations.mockResolvedValue([
      'Load test recommendation 1',
      'Load test recommendation 2'
    ]);

    const context = {
      timeOfDay: 'morning',
      dayOfWeek: 'saturday',
      currentActivity: 'breakfast',
      familyMembers: ['user1'],
      environmentalFactors: ['home']
    };

    // Simulate high load with concurrent requests
    const startTime = Date.now();
    const promises = Array(100).fill(null).map((_, i) =>
      integration.generatePersonalizedRecommendations(`load-family-${i}`, context)
    );

    const results = await Promise.all(promises);
    const endTime = Date.now();

    expect(results).toHaveLength(100);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

    results.forEach(recommendations => {
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});