/**
 * Fine-Tuning System Usage Example
 * 
 * Demonstrates how to use the local LLM fine-tuning system for family-specific recommendations
 */

import { FineTuningIntegration } from './fine-tuning-integration';
import { FineTuningConfigFactory, RuntimeConfigDetector } from './fine-tuning-config';
import { LLMEnhancedLearningEngine } from './llm-enhanced-engine';
import { SafetyValidator } from '../safety/safety-validator';
import { PrivacyFilter } from '../privacy/filter';
import { FamilyProfile } from './local-llm-fine-tuner';

/**
 * Example: Setting up the fine-tuning system
 */
export async function setupFineTuningSystem(): Promise<FineTuningIntegration> {
  // Detect optimal configuration for current system
  const config = await RuntimeConfigDetector.detectOptimalConfig();
  
  // Initialize required components
  const safetyValidator = new SafetyValidator({
    strictMode: true,
    childSafetyEnabled: true,
    contentFilters: ['violence', 'adult_content', 'inappropriate_language']
  });

  const privacyFilter = new PrivacyFilter({
    privacyLevel: 'high',
    piiDetection: true,
    anonymization: true
  });

  const learningEngine = new LLMEnhancedLearningEngine(
    {
      provider: 'local',
      modelPath: '/opt/family-assistant/models/base-llm',
      safetyFiltering: true,
      privacyPreserving: true
    },
    safetyValidator,
    privacyFilter
  );

  // Create fine-tuning integration
  const fineTuningIntegration = new FineTuningIntegration(
    config,
    learningEngine,
    safetyValidator,
    privacyFilter
  );

  // Set up event listeners
  setupEventListeners(fineTuningIntegration);

  // Initialize the system
  await fineTuningIntegration.initialize();

  return fineTuningIntegration;
}

/**
 * Example: Creating a family profile and model
 */
export async function createFamilyModelExample(
  fineTuningIntegration: FineTuningIntegration
): Promise<void> {
  // Example family profile
  const familyProfile: FamilyProfile = {
    familyId: 'smith-family',
    members: [
      {
        userId: 'dad-john',
        age: 42,
        role: 'parent',
        preferences: {
          interests: ['technology', 'sports', 'cooking'],
          learningStyle: 'visual',
          difficultyLevel: 'advanced',
          preferredTopics: ['science', 'history', 'current_events'],
          avoidedTopics: ['violence', 'politics']
        },
        safetyLevel: 'moderate'
      },
      {
        userId: 'mom-sarah',
        age: 39,
        role: 'parent',
        preferences: {
          interests: ['reading', 'gardening', 'art'],
          learningStyle: 'auditory',
          difficultyLevel: 'advanced',
          preferredTopics: ['literature', 'nature', 'wellness'],
          avoidedTopics: ['violence', 'scary_content']
        },
        safetyLevel: 'moderate'
      },
      {
        userId: 'child-emma',
        age: 8,
        role: 'child',
        preferences: {
          interests: ['animals', 'drawing', 'music'],
          learningStyle: 'kinesthetic',
          difficultyLevel: 'beginner',
          preferredTopics: ['animals', 'art', 'simple_science'],
          avoidedTopics: ['scary_content', 'complex_topics']
        },
        safetyLevel: 'strict'
      },
      {
        userId: 'child-alex',
        age: 12,
        role: 'child',
        preferences: {
          interests: ['video_games', 'robotics', 'space'],
          learningStyle: 'visual',
          difficultyLevel: 'intermediate',
          preferredTopics: ['technology', 'space', 'engineering'],
          avoidedTopics: ['violence', 'adult_content']
        },
        safetyLevel: 'moderate'
      }
    ],
    preferences: {
      communicationStyle: 'friendly',
      contentCategories: ['educational', 'entertainment', 'family_activities'],
      languagePreferences: ['en'],
      culturalContext: ['western', 'suburban'],
      educationalFocus: ['stem', 'creativity', 'critical_thinking'],
      entertainmentTypes: ['games', 'movies', 'outdoor_activities']
    },
    safetySettings: {
      maxContentRating: 'PG',
      blockedTopics: ['violence', 'adult_content', 'inappropriate_language'],
      requiredApprovals: ['new_contacts', 'purchases', 'schedule_changes'],
      timeRestrictions: [
        {
          startTime: '21:00',
          endTime: '07:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          restrictedContent: ['entertainment', 'games']
        },
        {
          startTime: '08:00',
          endTime: '15:00',
          daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
          restrictedContent: ['entertainment'] // School hours
        }
      ],
      parentalOverride: true
    },
    createdAt: new Date(),
    lastUpdated: new Date()
  };

  try {
    // Create or update family model
    const success = await fineTuningIntegration.createOrUpdateFamilyModel('smith-family');
    
    if (success) {
      console.log('✅ Family model created successfully for Smith family');
    } else {
      console.log('⚠️ Family model creation skipped (insufficient data)');
    }
  } catch (error) {
    console.error('❌ Failed to create family model:', error.message);
  }
}

/**
 * Example: Generating personalized recommendations
 */
export async function generateRecommendationsExample(
  fineTuningIntegration: FineTuningIntegration
): Promise<void> {
  // Example contexts for different scenarios
  const contexts = [
    {
      name: 'Weekend Morning Family Time',
      context: {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['dad-john', 'mom-sarah', 'child-emma', 'child-alex'],
        environmentalFactors: ['home', 'weekend', 'relaxed']
      }
    },
    {
      name: 'After School Learning Time',
      context: {
        timeOfDay: 'afternoon',
        dayOfWeek: 'tuesday',
        currentActivity: 'homework',
        familyMembers: ['child-emma', 'child-alex'],
        environmentalFactors: ['home', 'school_day', 'focused']
      }
    },
    {
      name: 'Evening Family Entertainment',
      context: {
        timeOfDay: 'evening',
        dayOfWeek: 'friday',
        currentActivity: 'family_time',
        familyMembers: ['dad-john', 'mom-sarah', 'child-emma', 'child-alex'],
        environmentalFactors: ['home', 'weekend_start', 'relaxed']
      }
    }
  ];

  for (const scenario of contexts) {
    console.log(`\n🎯 Generating recommendations for: ${scenario.name}`);
    
    try {
      // Generate general family recommendations
      const familyRecommendations = await fineTuningIntegration.generatePersonalizedRecommendations(
        'smith-family',
        scenario.context
      );

      console.log('👨‍👩‍👧‍👦 Family recommendations:');
      familyRecommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });

      // Generate child-specific recommendations
      const emmaRecommendations = await fineTuningIntegration.generatePersonalizedRecommendations(
        'smith-family',
        scenario.context,
        'child-emma'
      );

      console.log('👧 Emma-specific recommendations:');
      emmaRecommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });

      const alexRecommendations = await fineTuningIntegration.generatePersonalizedRecommendations(
        'smith-family',
        scenario.context,
        'child-alex'
      );

      console.log('👦 Alex-specific recommendations:');
      alexRecommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });

    } catch (error) {
      console.error(`❌ Failed to generate recommendations for ${scenario.name}:`, error.message);
    }
  }
}

/**
 * Example: Monitoring system performance
 */
export async function monitorSystemExample(
  fineTuningIntegration: FineTuningIntegration
): Promise<void> {
  console.log('\n📊 System Performance Monitoring');

  try {
    // Get integration metrics
    const metrics = await fineTuningIntegration.getIntegrationMetrics();
    
    console.log('📈 Integration Metrics:');
    console.log(`  Total Family Models: ${metrics.totalFamilyModels}`);
    console.log(`  Active Models: ${metrics.activeModels}`);
    console.log(`  Average Performance: ${(metrics.averagePerformance * 100).toFixed(1)}%`);
    console.log(`  Safety Compliance: ${(metrics.safetyCompliance * 100).toFixed(1)}%`);
    console.log(`  Memory Usage: ${metrics.memoryUsage.toFixed(1)} MB`);
    console.log(`  Last Update: ${metrics.lastUpdate.toLocaleString()}`);

    // Get family model statuses
    const statuses = await fineTuningIntegration.getFamilyModelStatuses();
    
    console.log('\n👨‍👩‍👧‍👦 Family Model Statuses:');
    statuses.forEach(status => {
      console.log(`  Family: ${status.familyId}`);
      console.log(`    Has Model: ${status.hasModel ? '✅' : '❌'}`);
      console.log(`    Active: ${status.isActive ? '✅' : '❌'}`);
      console.log(`    Performance: ${(status.performanceScore * 100).toFixed(1)}%`);
      console.log(`    Safety: ${(status.safetyScore * 100).toFixed(1)}%`);
      console.log(`    Interactions: ${status.interactionCount}`);
      console.log(`    Last Trained: ${status.lastTrained?.toLocaleString() || 'Never'}`);
      console.log(`    Next Update: ${status.nextScheduledUpdate?.toLocaleString() || 'Not scheduled'}`);
      console.log('');
    });

    // Validate all models
    const validationResults = await fineTuningIntegration.validateAllFamilyModels();
    
    console.log('🔍 Model Validation Results:');
    Object.entries(validationResults).forEach(([familyId, isValid]) => {
      console.log(`  ${familyId}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });

  } catch (error) {
    console.error('❌ Failed to get system metrics:', error.message);
  }
}

/**
 * Example: Handling system events
 */
function setupEventListeners(fineTuningIntegration: FineTuningIntegration): void {
  // Model creation events
  fineTuningIntegration.on('modelCreated', (event) => {
    console.log(`🎉 New family model created for ${event.familyId}`);
  });

  fineTuningIntegration.on('modelUpdated', (event) => {
    console.log(`🔄 Family model updated for ${event.familyId}`);
  });

  // Recommendation events
  fineTuningIntegration.on('personalizedRecommendation', (event) => {
    console.log(`💡 Generated ${event.recommendationCount} recommendations for ${event.familyId} (${event.source})`);
  });

  // Performance monitoring events
  fineTuningIntegration.on('performanceMetrics', (metrics) => {
    if (metrics.averagePerformance < 0.7) {
      console.warn(`⚠️ Low system performance detected: ${(metrics.averagePerformance * 100).toFixed(1)}%`);
    }
  });

  fineTuningIntegration.on('performanceAlert', (alert) => {
    console.warn(`🚨 Performance Alert: ${alert.type} = ${alert.value} (threshold: ${alert.threshold})`);
  });

  // Safety events
  fineTuningIntegration.on('modelValidationFailed', (event) => {
    console.error(`🛡️ Safety validation failed for ${event.familyId} model ${event.modelVersion}`);
  });

  // Error events
  fineTuningIntegration.on('recommendationError', (event) => {
    console.error(`❌ Recommendation error for ${event.familyId}: ${event.error}`);
  });

  fineTuningIntegration.on('modelCreationError', (event) => {
    console.error(`❌ Model creation error for ${event.familyId}: ${event.error}`);
  });

  // System events
  fineTuningIntegration.on('initialization', (event) => {
    if (event.status === 'completed') {
      console.log('🚀 Fine-tuning system initialized successfully');
    } else if (event.status === 'failed') {
      console.error(`❌ Fine-tuning system initialization failed: ${event.error}`);
    }
  });

  fineTuningIntegration.on('enabledChanged', (event) => {
    console.log(`🔧 Fine-tuning system ${event.enabled ? 'enabled' : 'disabled'}`);
  });
}

/**
 * Example: Configuration management
 */
export function configurationExample(): void {
  console.log('\n⚙️ Configuration Examples');

  // Get configuration for different environments
  const developmentConfig = FineTuningConfigFactory.getConfig('development');
  const productionConfig = FineTuningConfigFactory.getConfig('production');
  const jetsonConfig = FineTuningConfigFactory.getConfig('jetson');
  const childSafeConfig = FineTuningConfigFactory.getConfig('child-safe');

  console.log('Development Config:', {
    enabled: developmentConfig.enabled,
    minInteractions: developmentConfig.minInteractionsForTraining,
    retrainingThreshold: developmentConfig.retrainingThreshold,
    safetyThreshold: developmentConfig.familyLLMConfig.safetyThreshold
  });

  console.log('Jetson Config:', {
    enabled: jetsonConfig.enabled,
    maxMemory: jetsonConfig.familyLLMConfig.fineTuningConfig.hardwareConstraints.maxMemoryUsage,
    batchSize: jetsonConfig.familyLLMConfig.fineTuningConfig.batchSize,
    epochs: jetsonConfig.familyLLMConfig.fineTuningConfig.epochs
  });

  console.log('Child-Safe Config:', {
    safetyThreshold: childSafeConfig.familyLLMConfig.safetyThreshold,
    epochs: childSafeConfig.familyLLMConfig.fineTuningConfig.epochs,
    learningRate: childSafeConfig.familyLLMConfig.fineTuningConfig.learningRate
  });

  // Validate configurations
  const jetsonValidation = FineTuningConfigFactory.validateConfig(jetsonConfig.familyLLMConfig.fineTuningConfig);
  console.log('Jetson Config Validation:', jetsonValidation);

  // Get system resources
  const systemResources = RuntimeConfigDetector.getSystemResources();
  console.log('System Resources:', systemResources);

  // Optimize configuration for current hardware
  const optimizedConfig = FineTuningConfigFactory.optimizeForHardware(
    jetsonConfig.familyLLMConfig.fineTuningConfig,
    systemResources.availableMemory,
    systemResources.cpuCores
  );
  console.log('Optimized Config:', {
    maxMemory: optimizedConfig.hardwareConstraints.maxMemoryUsage,
    batchSize: optimizedConfig.batchSize,
    cpuCores: optimizedConfig.hardwareConstraints.cpuCores
  });
}

/**
 * Complete example usage
 */
export async function runCompleteExample(): Promise<void> {
  console.log('🚀 Starting Fine-Tuning System Example\n');

  try {
    // Show configuration examples
    configurationExample();

    // Setup the fine-tuning system
    const fineTuningIntegration = await setupFineTuningSystem();

    // Create a family model
    await createFamilyModelExample(fineTuningIntegration);

    // Generate recommendations
    await generateRecommendationsExample(fineTuningIntegration);

    // Monitor system performance
    await monitorSystemExample(fineTuningIntegration);

    console.log('\n✅ Fine-tuning system example completed successfully');

  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCompleteExample().catch(console.error);
}