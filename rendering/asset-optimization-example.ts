/**
 * Example usage of the Asset Optimization System
 * Demonstrates how to use the system for avatar customization optimization
 */

import { AssetOptimizer, PerformanceTarget } from './asset-optimizer';
import { AssetManager } from './asset-manager';
import { assetOptimizationIntegration } from './asset-optimization-integration';

/**
 * Example: Basic asset optimization workflow
 */
export async function basicOptimizationExample(): Promise<void> {
  console.log('🚀 Starting Asset Optimization Example...');

  // Initialize the optimization integration
  await assetOptimizationIntegration.initialize();

  // Example avatar configuration
  const avatarConfig = {
    userId: 'user_123',
    appearance: {
      face: {
        meshId: 'face_model_01',
        textureId: 'face_texture_01'
      },
      hair: {
        styleId: 'hair_style_curly'
      },
      clothing: {
        topId: 'shirt_casual_01',
        bottomId: 'pants_jeans_01',
        shoesId: 'sneakers_01'
      },
      accessories: [
        { id: 'glasses_01' },
        { id: 'hat_baseball' }
      ],
      animations: {
        idle: 'idle_animation_01',
        talking: 'talking_animation_01'
      }
    }
  };

  try {
    // 1. Load and optimize individual assets
    console.log('📦 Loading optimized assets...');
    
    const faceModel = await assetOptimizationIntegration.loadOptimizedAsset(
      'face_model_01', 
      'model'
    );
    console.log(`✅ Face model loaded: ${faceModel.triangleCount} triangles`);

    const faceTexture = await assetOptimizationIntegration.loadOptimizedAsset(
      'face_texture_01', 
      'texture'
    );
    console.log(`✅ Face texture loaded: ${faceTexture.width}x${faceTexture.height}`);

    // 2. Batch optimize all avatar assets
    console.log('🔧 Optimizing avatar assets...');
    await assetOptimizationIntegration.optimizeAvatarAssets(avatarConfig);

    // 3. Check optimization status
    const status = assetOptimizationIntegration.getOptimizationStatus();
    console.log('📊 Optimization Status:');
    console.log(`   System Health: ${(status.systemHealth * 100).toFixed(1)}%`);
    console.log(`   Memory Usage: ${status.memoryUtilization.toFixed(1)}%`);
    console.log(`   Current FPS: ${status.currentFPS}`);
    console.log(`   Queue Size: ${status.queueSize}`);

    // 4. Get recommendations
    const recommendations = assetOptimizationIntegration.getOptimizationRecommendations();
    if (recommendations.length > 0) {
      console.log('💡 Optimization Recommendations:');
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.description}`);
        console.log(`      Expected: ${rec.expectedBenefit}`);
      });
    }

  } catch (error) {
    console.error('❌ Optimization failed:', error);
  }

  console.log('✨ Asset Optimization Example completed!');
}

/**
 * Example: Performance-based optimization
 */
export async function performanceOptimizationExample(): Promise<void> {
  console.log('⚡ Starting Performance Optimization Example...');

  const assetManager = new AssetManager();
  const assetOptimizer = new AssetOptimizer(assetManager);

  // Start optimization system
  await assetOptimizer.startOptimization();

  // Define performance targets for different scenarios
  const scenarios = [
    {
      name: 'High Quality (Good Hardware)',
      target: {
        maxMemoryMB: 300,
        targetFPS: 60,
        maxProcessingTimeMs: 16
      }
    },
    {
      name: 'Balanced (Standard Hardware)',
      target: {
        maxMemoryMB: 200,
        targetFPS: 45,
        maxProcessingTimeMs: 22
      }
    },
    {
      name: 'Performance Mode (Limited Hardware)',
      target: {
        maxMemoryMB: 100,
        targetFPS: 30,
        maxProcessingTimeMs: 33
      }
    }
  ];

  const testAssets = [
    'high_poly_character_model',
    'detailed_face_texture_4k',
    'complex_hair_animation'
  ];

  for (const scenario of scenarios) {
    console.log(`\n🎯 Testing: ${scenario.name}`);
    console.log(`   Target: ${scenario.target.targetFPS} FPS, ${scenario.target.maxMemoryMB}MB max`);

    try {
      // Batch optimize assets for this scenario
      const result = await assetOptimizer.batchOptimizeAssets(testAssets, scenario.target);
      
      console.log(`   ✅ Optimized ${result.successfulOptimizations}/${result.totalAssets} assets`);
      console.log(`   💾 Memory saved: ${result.totalMemorySaved.toFixed(1)}MB`);
      console.log(`   📊 Avg compression: ${(result.averageCompressionRatio * 100).toFixed(1)}%`);

      if (result.errors.length > 0) {
        console.log(`   ⚠️  ${result.errors.length} assets failed to optimize`);
      }

    } catch (error) {
      console.error(`   ❌ Scenario failed:`, error);
    }
  }

  // Cleanup
  await assetOptimizer.stopOptimization();
  assetOptimizer.dispose();

  console.log('\n✨ Performance Optimization Example completed!');
}

/**
 * Example: Memory management and caching
 */
export async function memoryManagementExample(): Promise<void> {
  console.log('🧠 Starting Memory Management Example...');

  const assetManager = new AssetManager();
  const assetOptimizer = new AssetOptimizer(assetManager);

  await assetOptimizer.startOptimization();

  // Simulate high memory usage scenario
  console.log('📈 Simulating high memory usage...');

  // Queue multiple assets for optimization
  const heavyAssets = [
    'character_model_ultra_detail',
    'environment_texture_8k',
    'facial_animation_mocap',
    'clothing_physics_sim',
    'hair_strand_simulation'
  ];

  heavyAssets.forEach((assetId, index) => {
    const priority = index < 2 ? 'high' : 'normal';
    assetOptimizer.queueAssetOptimization(assetId, priority as any);
  });

  // Check queue status
  let queueStatus = assetOptimizer.getQueueStatus();
  console.log(`📋 Queue Status: ${queueStatus.totalTasks} tasks`);
  console.log(`   High Priority: ${queueStatus.priorityBreakdown.high}`);
  console.log(`   Normal Priority: ${queueStatus.priorityBreakdown.normal}`);
  console.log(`   Estimated Time: ${(queueStatus.estimatedProcessingTime / 1000).toFixed(1)}s`);

  // Perform memory optimization
  console.log('🔧 Performing memory optimization...');
  const memoryResult = await assetOptimizer.performMemoryOptimization();
  
  console.log(`✅ Memory optimization completed:`);
  console.log(`   Memory freed: ${memoryResult.memoryFreed}MB`);
  console.log(`   Assets unloaded: ${memoryResult.assetsUnloaded}`);
  console.log(`   Fragmentation reduced: ${(memoryResult.fragmentationReduced * 100).toFixed(1)}%`);

  // Apply intelligent caching
  console.log('🎯 Applying intelligent caching...');
  
  const cachingStrategies = ['adaptive', 'memory_optimized', 'aggressive'] as const;
  
  for (const strategy of cachingStrategies) {
    console.log(`   Testing ${strategy} caching strategy...`);
    await assetOptimizer.applyCachingStrategy(strategy);
    
    const recommendations = assetOptimizer.getCachingRecommendations();
    console.log(`   Generated ${recommendations.length} caching recommendations`);
  }

  // Get final optimization report
  const report = assetOptimizer.getOptimizationReport();
  console.log('\n📊 Final Optimization Report:');
  console.log(`   System Health: ${(report.systemHealth * 100).toFixed(1)}%`);
  console.log(`   Cache Hit Rate: ${(report.cachingEfficiency.hitRate * 100).toFixed(1)}%`);
  console.log(`   Avg Compression: ${(report.compressionEfficiency.averageCompressionRatio * 100).toFixed(1)}%`);

  if (report.recommendations.length > 0) {
    console.log('   Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`     ${index + 1}. ${rec}`);
    });
  }

  // Cleanup
  await assetOptimizer.stopOptimization();
  assetOptimizer.dispose();

  console.log('\n✨ Memory Management Example completed!');
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🎮 Avatar Asset Optimization System Examples\n');
  console.log('=' .repeat(50));

  try {
    await basicOptimizationExample();
    console.log('\n' + '-'.repeat(50));
    
    await performanceOptimizationExample();
    console.log('\n' + '-'.repeat(50));
    
    await memoryManagementExample();
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  } finally {
    // Cleanup integration
    await assetOptimizationIntegration.dispose();
  }

  console.log('\n🎉 All examples completed successfully!');
}

// Export for easy testing
export default {
  basicOptimizationExample,
  performanceOptimizationExample,
  memoryManagementExample,
  runAllExamples
};