#!/usr/bin/env node

/**
 * Fine-Tuning System Deployment Validation Script
 * 
 * This script validates that the fine-tuning system is properly deployed
 * and functioning correctly in the target environment.
 */

import { 
  SimpleFineTuningIntegration,
  FineTuningConfigFactory,
  RuntimeConfigDetector,
  LLMEnhancedLearningEngine
} from '../learning';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  duration?: number;
  details?: any;
}

class DeploymentValidator {
  private results: ValidationResult[] = [];
  private mockLearningEngine: any;

  constructor() {
    this.setupMockLearningEngine();
  }

  private setupMockLearningEngine() {
    this.mockLearningEngine = {
      getInteractionHistory: async (familyId: string) => [
        {
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'prefers educational content' }],
          outcome: { recommendation: 'Try a science experiment' },
          context: { timeOfDay: 'morning', activity: 'learning' }
        }
      ],
      getFamilyProfile: async (familyId: string) => ({
        familyId,
        members: [
          { userId: 'user1', age: 35, role: 'parent' },
          { userId: 'user2', age: 8, role: 'child' }
        ],
        preferences: { communicationStyle: 'friendly' },
        safetySettings: { maxContentRating: 'G' },
        createdAt: new Date(),
        lastUpdated: new Date()
      }),
      generateRecommendations: async (context: any, familyId: string) => [
        'Spend quality time together as a family',
        'Try a new educational activity',
        'Enjoy some outdoor time if weather permits'
      ]
    };
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        test: testName,
        status: 'PASS',
        message: 'Test completed successfully',
        duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        test: testName,
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration,
        details: error
      });
    }
  }

  async validateSystemRequirements(): Promise<void> {
    await this.runTest('System Requirements Check', async () => {
      // Check Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      if (majorVersion < 18) {
        throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum version: 18.0.0`);
      }

      // Check available memory
      const memoryUsage = process.memoryUsage();
      const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
      
      if (totalMemoryMB < 512) {
        throw new Error(`Insufficient memory: ${totalMemoryMB.toFixed(1)}MB available. Minimum: 512MB`);
      }

      // Check system resources
      const resources = RuntimeConfigDetector.getSystemResources();
      
      if (resources.cpuCores < 2) {
        throw new Error(`Insufficient CPU cores: ${resources.cpuCores}. Minimum: 2`);
      }

      console.log(`✓ Node.js version: ${nodeVersion}`);
      console.log(`✓ Available memory: ${totalMemoryMB.toFixed(1)}MB`);
      console.log(`✓ CPU cores: ${resources.cpuCores}`);
      console.log(`✓ Architecture: ${resources.architecture}`);
    });
  }

  async validateConfiguration(): Promise<void> {
    await this.runTest('Configuration Validation', async () => {
      const environments = ['development', 'production', 'jetson', 'child-safe'] as const;
      
      for (const env of environments) {
        const config = FineTuningConfigFactory.getConfig(env);
        const fineTuningConfig = FineTuningConfigFactory.getFineTuningConfig(env);
        
        // Validate configuration structure
        if (!config.familyLLMConfig || !config.familyLLMConfig.fineTuningConfig) {
          throw new Error(`Invalid configuration structure for environment: ${env}`);
        }

        // Validate configuration constraints
        const validation = FineTuningConfigFactory.validateConfig(fineTuningConfig);
        
        if (!validation.valid) {
          console.warn(`⚠️ Configuration warnings for ${env}:`, validation.errors);
        }

        console.log(`✓ ${env} configuration validated`);
      }

      // Test runtime configuration detection
      const runtimeConfig = await RuntimeConfigDetector.detectOptimalConfig();
      
      if (!runtimeConfig || !runtimeConfig.familyLLMConfig) {
        throw new Error('Failed to detect runtime configuration');
      }

      console.log(`✓ Runtime configuration detected: ${runtimeConfig.enabled ? 'enabled' : 'disabled'}`);
    });
  }

  async validateSystemInitialization(): Promise<void> {
    await this.runTest('System Initialization', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();
      const integration = new SimpleFineTuningIntegration(config, this.mockLearningEngine);

      await integration.initialize();

      const metrics = integration.getIntegrationMetrics();
      
      if (!metrics || typeof metrics.totalFamilyModels !== 'number') {
        throw new Error('Failed to get integration metrics');
      }

      console.log(`✓ System initialized successfully`);
      console.log(`✓ Integration metrics available`);
      console.log(`  - Total family models: ${metrics.totalFamilyModels}`);
      console.log(`  - Active models: ${metrics.activeModels}`);
      console.log(`  - Memory usage: ${metrics.memoryUsage.toFixed(1)}MB`);
    });
  }

  async validateRecommendationGeneration(): Promise<void> {
    await this.runTest('Recommendation Generation', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();
      const integration = new SimpleFineTuningIntegration(config, this.mockLearningEngine);

      await integration.initialize();

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

      if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Failed to generate recommendations');
      }

      console.log(`✓ Generated ${recommendations.length} recommendations`);
      console.log(`✓ Sample recommendation: "${recommendations[0]}"`);

      // Test with target member
      const memberRecommendations = await integration.generatePersonalizedRecommendations(
        'test-family',
        context,
        'child1'
      );

      if (!memberRecommendations || memberRecommendations.length === 0) {
        throw new Error('Failed to generate member-specific recommendations');
      }

      console.log(`✓ Generated ${memberRecommendations.length} member-specific recommendations`);
    });
  }

  async validateFamilyModelManagement(): Promise<void> {
    await this.runTest('Family Model Management', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();
      const integration = new SimpleFineTuningIntegration(config, this.mockLearningEngine);

      await integration.initialize();

      // Test model creation with insufficient data
      let success = await integration.createOrUpdateFamilyModel('insufficient-family');
      
      if (success) {
        console.warn('⚠️ Model created with insufficient data - this may indicate a configuration issue');
      } else {
        console.log('✓ Correctly rejected model creation with insufficient data');
      }

      // Mock sufficient interactions for model creation
      this.mockLearningEngine.getInteractionHistory = async () => 
        Array(50).fill({
          userId: 'user1',
          timestamp: new Date(),
          patterns: [{ description: 'test interaction' }]
        });

      // Test model creation with sufficient data
      success = await integration.createOrUpdateFamilyModel('sufficient-family');
      
      if (!success) {
        throw new Error('Failed to create model with sufficient data');
      }

      console.log('✓ Successfully created family model');

      // Test model info retrieval
      const modelInfo = integration.getFamilyModelInfo('sufficient-family');
      
      if (!modelInfo) {
        throw new Error('Failed to retrieve model information');
      }

      console.log(`✓ Retrieved model info: version ${modelInfo.version}`);

      // Test model validation
      const validationResults = await integration.validateAllFamilyModels();
      
      if (!validationResults || typeof validationResults !== 'object') {
        throw new Error('Failed to validate family models');
      }

      console.log(`✓ Validated ${Object.keys(validationResults).length} family models`);

      // Test model deletion
      await integration.deleteFamilyModel('sufficient-family');
      
      const deletedModelInfo = integration.getFamilyModelInfo('sufficient-family');
      
      if (deletedModelInfo) {
        throw new Error('Model was not properly deleted');
      }

      console.log('✓ Successfully deleted family model');
    });
  }

  async validateSafetyAndPrivacy(): Promise<void> {
    await this.runTest('Safety and Privacy Validation', async () => {
      const childSafeConfig = FineTuningConfigFactory.getConfig('child-safe');
      const integration = new SimpleFineTuningIntegration(childSafeConfig, this.mockLearningEngine);

      await integration.initialize();

      // Verify child-safe configuration
      if (childSafeConfig.familyLLMConfig.safetyThreshold < 0.99) {
        throw new Error('Child-safe configuration does not meet safety requirements');
      }

      console.log(`✓ Child-safe configuration validated (safety threshold: ${childSafeConfig.familyLLMConfig.safetyThreshold})`);

      // Test age-appropriate recommendations
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

      // Verify no inappropriate content
      const inappropriateTerms = ['violence', 'adult', 'inappropriate', 'scary'];
      
      for (const rec of recommendations) {
        for (const term of inappropriateTerms) {
          if (rec.toLowerCase().includes(term)) {
            throw new Error(`Inappropriate content detected in recommendation: "${rec}"`);
          }
        }
      }

      console.log(`✓ Generated ${recommendations.length} age-appropriate recommendations`);
      console.log('✓ No inappropriate content detected');
    });
  }

  async validatePerformance(): Promise<void> {
    await this.runTest('Performance Validation', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();
      const integration = new SimpleFineTuningIntegration(config, this.mockLearningEngine);

      await integration.initialize();

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      // Test concurrent recommendation generation
      const startTime = Date.now();
      const promises = Array(10).fill(null).map((_, i) =>
        integration.generatePersonalizedRecommendations(`perf-family-${i}`, context)
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      if (results.length !== 10) {
        throw new Error(`Expected 10 results, got ${results.length}`);
      }

      if (duration > 5000) {
        console.warn(`⚠️ Performance warning: ${duration}ms for 10 concurrent requests (expected < 5000ms)`);
      } else {
        console.log(`✓ Performance test passed: ${duration}ms for 10 concurrent requests`);
      }

      // Test memory usage
      const metrics = integration.getIntegrationMetrics();
      const memoryLimit = config.familyLLMConfig.fineTuningConfig.hardwareConstraints.maxMemoryUsage;

      if (metrics.memoryUsage > memoryLimit) {
        console.warn(`⚠️ Memory usage warning: ${metrics.memoryUsage.toFixed(1)}MB (limit: ${memoryLimit}MB)`);
      } else {
        console.log(`✓ Memory usage within limits: ${metrics.memoryUsage.toFixed(1)}MB`);
      }
    });
  }

  async validateErrorHandling(): Promise<void> {
    await this.runTest('Error Handling Validation', async () => {
      const config = await RuntimeConfigDetector.detectOptimalConfig();
      const integration = new SimpleFineTuningIntegration(config, this.mockLearningEngine);

      await integration.initialize();

      // Test with failing learning engine
      const failingEngine = {
        getInteractionHistory: async () => { throw new Error('Database error'); },
        getFamilyProfile: async () => { throw new Error('Profile error'); },
        generateRecommendations: async () => { throw new Error('Recommendation error'); }
      };

      const failingIntegration = new SimpleFineTuningIntegration(config, failingEngine);
      await failingIntegration.initialize();

      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['parent1'],
        environmentalFactors: ['home']
      };

      // Should still provide fallback recommendations
      const recommendations = await failingIntegration.generatePersonalizedRecommendations(
        'error-family',
        context
      );

      if (!recommendations || recommendations.length === 0) {
        throw new Error('System did not provide fallback recommendations during error conditions');
      }

      console.log(`✓ Error handling validated: provided ${recommendations.length} fallback recommendations`);

      // Test model creation failure handling
      const success = await failingIntegration.createOrUpdateFamilyModel('error-family');
      
      if (success) {
        throw new Error('Model creation should have failed with error conditions');
      }

      console.log('✓ Model creation properly failed under error conditions');
    });
  }

  async validateIntegration(): Promise<void> {
    await this.runTest('Integration Validation', async () => {
      // Test that all components are properly exported
      const components = [
        'SimpleFineTuningIntegration',
        'FineTuningConfigFactory',
        'RuntimeConfigDetector',
        'LLMEnhancedLearningEngine'
      ];

      for (const component of components) {
        const imported = await import('../learning');
        
        if (!imported[component]) {
          throw new Error(`Component ${component} is not properly exported`);
        }
      }

      console.log(`✓ All ${components.length} components properly exported`);

      // Test configuration factory methods
      const factoryMethods = ['getConfig', 'getFineTuningConfig', 'getFamilyLLMConfig', 'validateConfig'];
      
      for (const method of factoryMethods) {
        if (typeof FineTuningConfigFactory[method as keyof typeof FineTuningConfigFactory] !== 'function') {
          throw new Error(`FineTuningConfigFactory.${method} is not available`);
        }
      }

      console.log(`✓ All ${factoryMethods.length} factory methods available`);

      // Test runtime detector methods
      const detectorMethods = ['detectOptimalConfig', 'getSystemResources'];
      
      for (const method of detectorMethods) {
        if (typeof RuntimeConfigDetector[method as keyof typeof RuntimeConfigDetector] !== 'function') {
          throw new Error(`RuntimeConfigDetector.${method} is not available`);
        }
      }

      console.log(`✓ All ${detectorMethods.length} detector methods available`);
    });
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('FINE-TUNING SYSTEM DEPLOYMENT VALIDATION RESULTS');
    console.log('='.repeat(80));

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    for (const result of this.results) {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      
      console.log(`${statusIcon} ${result.test}${duration}`);
      
      if (result.status !== 'PASS') {
        console.log(`   ${result.message}`);
      }

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`SUMMARY: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
    
    if (failCount === 0) {
      console.log('🎉 All validation tests passed! The fine-tuning system is ready for deployment.');
    } else {
      console.log('❌ Some validation tests failed. Please review the errors above.');
    }
    
    console.log('-'.repeat(80));
  }

  async runAllValidations(): Promise<boolean> {
    console.log('🚀 Starting Fine-Tuning System Deployment Validation...\n');

    await this.validateSystemRequirements();
    await this.validateConfiguration();
    await this.validateSystemInitialization();
    await this.validateRecommendationGeneration();
    await this.validateFamilyModelManagement();
    await this.validateSafetyAndPrivacy();
    await this.validatePerformance();
    await this.validateErrorHandling();
    await this.validateIntegration();

    this.printResults();

    return this.results.every(result => result.status !== 'FAIL');
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  
  validator.runAllValidations()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation script failed:', error);
      process.exit(1);
    });
}

export { DeploymentValidator };