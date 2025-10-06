// Global Setup for Avatar System Integration Tests
// Prepares the test environment before any tests run

import * as fs from 'fs/promises';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('Starting global setup for Avatar System integration tests...');
  
  try {
    // Create necessary test directories
    const testDirs = [
      './test-data',
      './test-data/integration',
      './test-data/deployment',
      './test-data/performance',
      './test-reports',
      './test-reports/integration',
      './coverage',
      './coverage/integration'
    ];
    
    for (const dir of testDirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Set global test environment variables
    process.env.NODE_ENV = 'test';
    process.env.AVATAR_TEST_MODE = 'true';
    process.env.AVATAR_LOG_LEVEL = 'warn'; // Reduce log noise during tests
    process.env.AVATAR_DISABLE_HARDWARE_CHECKS = 'true'; // Skip hardware validation in tests
    
    // Create test configuration files
    await createTestConfigurations();
    
    // Initialize test data
    await initializeTestData();
    
    console.log('Global setup completed successfully');
    
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}

async function createTestConfigurations(): Promise<void> {
  console.log('Creating test configuration files...');
  
  // Test deployment configuration
  const testDeploymentConfig = {
    hardware: {
      platform: 'jetson-nano-orin',
      gpuMemoryLimit: 2048,
      cpuCores: 6,
      enableHardwareAcceleration: true
    },
    installation: {
      dataDirectory: './test-data/integration/data',
      cacheDirectory: './test-data/integration/cache',
      logDirectory: './test-data/integration/logs',
      backupDirectory: './test-data/integration/backups'
    },
    defaultPackages: [
      'com.kiro.test-avatar-basic',
      'com.kiro.test-avatar-child'
    ],
    serviceConfig: {
      autoStart: false,
      restartOnFailure: false,
      maxRestartAttempts: 1,
      healthCheckInterval: 5000
    }
  };
  
  await fs.writeFile(
    './test-data/test-deployment-config.json',
    JSON.stringify(testDeploymentConfig, null, 2)
  );
  
  // Test system configuration
  const testSystemConfig = {
    performance: {
      targetFPS: 60,
      maxGPUMemory: 2048,
      maxCPUUsage: 50,
      enableAutoOptimization: true
    },
    safety: {
      enableParentalControls: true,
      defaultAgeRating: 'all-ages',
      auditLogging: false // Disable audit logging in tests
    },
    rendering: {
      enableHardwareAcceleration: false, // Use software rendering in tests
      lodEnabled: true,
      maxTextureResolution: 512 // Lower resolution for tests
    },
    storage: {
      encryptionEnabled: false, // Disable encryption for faster tests
      backupInterval: 3600000,
      maxBackups: 3
    },
    monitoring: {
      healthCheckInterval: 1000, // Fast health checks for tests
      performanceLogging: false,
      alertThresholds: {
        fps: 20, // Lower threshold for tests
        memory: 1800,
        cpu: 80
      }
    }
  };
  
  await fs.writeFile(
    './test-data/test-system-config.json',
    JSON.stringify(testSystemConfig, null, 2)
  );
}

async function initializeTestData(): Promise<void> {
  console.log('Initializing test data...');
  
  // Create test avatar configurations
  const testAvatars = [
    {
      userId: 'test-user-001',
      version: '1.0.0',
      appearance: {
        face: { style: 'friendly' },
        hair: { style: 'short', color: 'brown' },
        clothing: { style: 'casual', color: 'blue' },
        accessories: []
      },
      personality: {
        friendliness: 8,
        formality: 5,
        humor: 7,
        enthusiasm: 6,
        patience: 8,
        supportiveness: 9
      },
      voice: {
        pitch: 0,
        speed: 1,
        accent: 'neutral',
        emotionalTone: 'friendly',
        volume: 0.8
      },
      emotions: {
        defaultEmotion: 'neutral',
        expressiveness: 0.7
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      parentallyApproved: true
    },
    {
      userId: 'test-child-001',
      version: '1.0.0',
      appearance: {
        face: { style: 'child-friendly' },
        hair: { style: 'curly', color: 'blonde' },
        clothing: { style: 'colorful', color: 'rainbow' },
        accessories: [{ type: 'hat', style: 'fun' }]
      },
      personality: {
        friendliness: 10,
        formality: 3,
        humor: 9,
        enthusiasm: 10,
        patience: 10,
        supportiveness: 10
      },
      voice: {
        pitch: 0.5,
        speed: 0.9,
        accent: 'neutral',
        emotionalTone: 'cheerful',
        volume: 0.7
      },
      emotions: {
        defaultEmotion: 'happy',
        expressiveness: 0.9
      },
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      parentallyApproved: true
    }
  ];
  
  // Save test avatar configurations
  for (const avatar of testAvatars) {
    const avatarPath = path.join('./test-data/integration/data', `${avatar.userId}.json`);
    await fs.mkdir(path.dirname(avatarPath), { recursive: true });
    await fs.writeFile(avatarPath, JSON.stringify(avatar, null, 2));
  }
  
  // Create test character packages metadata
  const testPackages = [
    {
      packageId: 'com.kiro.test-avatar-basic',
      name: 'Basic Test Avatar',
      version: '1.0.0',
      description: 'Basic avatar for integration testing',
      ageRating: 'all-ages',
      size: 1024000, // 1MB
      assets: ['basic-model.glb', 'basic-texture.png']
    },
    {
      packageId: 'com.kiro.test-avatar-child',
      name: 'Child-Friendly Test Avatar',
      version: '1.0.0',
      description: 'Child-friendly avatar for integration testing',
      ageRating: 'child',
      size: 2048000, // 2MB
      assets: ['child-model.glb', 'child-texture.png', 'child-animations.fbx']
    }
  ];
  
  await fs.writeFile(
    './test-data/test-packages.json',
    JSON.stringify(testPackages, null, 2)
  );
  
  // Create test performance benchmarks
  const performanceBenchmarks = {
    jetsonNanoOrin: {
      minFPS: 30,
      maxMemoryUsage: 6000, // 6GB
      maxCPUUsage: 70,
      maxTemperature: 85,
      targetInitializationTime: 10000, // 10 seconds
      targetCustomizationTime: 2000 // 2 seconds
    },
    generic: {
      minFPS: 20,
      maxMemoryUsage: 4000, // 4GB
      maxCPUUsage: 80,
      maxTemperature: 90,
      targetInitializationTime: 15000, // 15 seconds
      targetCustomizationTime: 3000 // 3 seconds
    }
  };
  
  await fs.writeFile(
    './test-data/performance-benchmarks.json',
    JSON.stringify(performanceBenchmarks, null, 2)
  );
  
  console.log('Test data initialization completed');
}