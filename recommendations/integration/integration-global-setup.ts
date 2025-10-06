/**
 * Global Setup for Recommendations Engine Integration Tests
 * Prepares the test environment before any tests run
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('Starting global setup for Recommendations Engine integration tests...');
  
  try {
    // Create necessary test directories
    const testDirs = [
      './test-data',
      './test-data/recommendations-integration',
      './test-data/recommendations-integration/users',
      './test-data/recommendations-integration/contexts',
      './test-data/recommendations-integration/feedback',
      './test-reports',
      './test-reports/recommendations-integration',
      './coverage',
      './coverage/recommendations-integration'
    ];
    
    for (const dir of testDirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Set global test environment variables
    process.env.NODE_ENV = 'test';
    process.env.RECOMMENDATIONS_TEST_MODE = 'true';
    process.env.RECOMMENDATIONS_LOG_LEVEL = 'warn';
    process.env.RECOMMENDATIONS_DISABLE_EXTERNAL_APIS = 'true';
    process.env.RECOMMENDATIONS_DISABLE_ENCRYPTION = 'true'; // Faster tests
    process.env.RECOMMENDATIONS_MOCK_INTEGRATIONS = 'true';
    
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
  
  // Test recommendations engine configuration
  const testRecommendationsConfig = {
    performance: {
      maxLatency: 2000,
      maxMemoryUsage: 1500,
      maxConcurrentRequests: 5,
      cacheTimeout: 300000, // 5 minutes
      batchSize: 10
    },
    safety: {
      enableChildSafetyValidation: true,
      enableParentalControls: true,
      defaultAgeRating: 'all-ages',
      auditLogging: false // Disable in tests
    },
    privacy: {
      encryptionEnabled: false, // Disable for faster tests
      dataMinimization: true,
      retentionPeriod: 86400000, // 24 hours for tests
      anonymizationLevel: 'medium'
    },
    learning: {
      enableOnlineLearning: true,
      adaptationRate: 0.1, // Faster adaptation for tests
      explorationRate: 0.3,
      feedbackSensitivity: 0.8
    },
    integration: {
      avatar: {
        enabled: true,
        mockMode: true,
        responseTimeout: 1000
      },
      voice: {
        enabled: true,
        mockMode: true,
        responseTimeout: 1000
      },
      scheduling: {
        enabled: true,
        mockMode: true,
        responseTimeout: 1000
      },
      smartHome: {
        enabled: true,
        mockMode: true,
        responseTimeout: 1000
      }
    }
  };
  
  await fs.writeFile(
    './test-data/test-recommendations-config.json',
    JSON.stringify(testRecommendationsConfig, null, 2)
  );
  
  // Test user profiles configuration
  const testUserProfilesConfig = {
    defaultPreferences: {
      activityPreferences: {
        preferredCategories: ['general'],
        difficultyLevel: 'medium',
        durationPreference: 'medium',
        socialPreference: 'individual'
      },
      privacyPreferences: {
        dataMinimization: false,
        shareWithFamily: false,
        allowLearning: true,
        retentionPeriod: 86400000, // 24 hours
        encryptionRequired: false // Disabled for tests
      },
      learningPreferences: {
        adaptationRate: 0.5,
        explorationRate: 0.3,
        feedbackSensitivity: 0.7
      }
    },
    childSafetyDefaults: {
      maxScreenTime: 3600, // 1 hour
      parentalApprovalRequired: true,
      restrictedCategories: ['adult', 'violent', 'inappropriate'],
      allowedTimeSlots: ['09:00-12:00', '14:00-17:00', '19:00-20:00']
    }
  };
  
  await fs.writeFile(
    './test-data/test-user-profiles-config.json',
    JSON.stringify(testUserProfilesConfig, null, 2)
  );
}

async function initializeTestData(): Promise<void> {
  console.log('Initializing test data...');
  
  // Create test user profiles
  const testUsers = [
    {
      userId: 'test-parent-001',
      userType: 'parent',
      age: 35,
      preferences: {
        interests: [
          { category: 'education', subcategory: 'science', strength: 0.8, recency: new Date(), source: 'explicit' },
          { category: 'family', subcategory: 'bonding', strength: 0.9, recency: new Date(), source: 'behavior' },
          { category: 'health', subcategory: 'fitness', strength: 0.7, recency: new Date(), source: 'explicit' }
        ],
        activityPreferences: {
          preferredCategories: ['educational', 'family', 'health'],
          difficultyLevel: 'medium',
          durationPreference: 'medium',
          socialPreference: 'family'
        },
        schedulePreferences: {
          preferredTimes: ['morning', 'evening'],
          flexibilityLevel: 'medium',
          priorityTypes: ['family', 'work', 'personal']
        }
      },
      familyId: 'test-family-001',
      children: ['test-child-001', 'test-teen-001']
    },
    {
      userId: 'test-child-001',
      userType: 'child',
      age: 8,
      preferences: {
        interests: [
          { category: 'games', subcategory: 'educational', strength: 0.9, recency: new Date(), source: 'behavior' },
          { category: 'creative', subcategory: 'art', strength: 0.8, recency: new Date(), source: 'explicit' },
          { category: 'science', subcategory: 'experiments', strength: 0.7, recency: new Date(), source: 'behavior' }
        ],
        activityPreferences: {
          preferredCategories: ['educational', 'creative', 'games'],
          difficultyLevel: 'easy',
          durationPreference: 'short',
          socialPreference: 'family'
        },
        schedulePreferences: {
          preferredTimes: ['morning', 'afternoon'],
          flexibilityLevel: 'high',
          priorityTypes: ['learning', 'play', 'family']
        }
      },
      familyId: 'test-family-001',
      parentId: 'test-parent-001',
      safetySettings: {
        parentalApprovalRequired: true,
        maxScreenTime: 3600,
        allowedCategories: ['educational', 'creative', 'games'],
        restrictedCategories: ['adult', 'violent']
      }
    },
    {
      userId: 'test-teen-001',
      userType: 'teen',
      age: 15,
      preferences: {
        interests: [
          { category: 'technology', subcategory: 'programming', strength: 0.9, recency: new Date(), source: 'explicit' },
          { category: 'social', subcategory: 'friends', strength: 0.8, recency: new Date(), source: 'behavior' },
          { category: 'creative', subcategory: 'music', strength: 0.7, recency: new Date(), source: 'explicit' }
        ],
        activityPreferences: {
          preferredCategories: ['technology', 'social', 'creative'],
          difficultyLevel: 'medium',
          durationPreference: 'long',
          socialPreference: 'peer'
        },
        schedulePreferences: {
          preferredTimes: ['afternoon', 'evening'],
          flexibilityLevel: 'low',
          priorityTypes: ['social', 'learning', 'personal']
        }
      },
      familyId: 'test-family-001',
      parentId: 'test-parent-001',
      safetySettings: {
        parentalApprovalRequired: false,
        maxScreenTime: 7200, // 2 hours
        allowedCategories: ['technology', 'social', 'creative', 'educational'],
        restrictedCategories: ['adult', 'violent']
      }
    }
  ];
  
  // Save test user profiles
  for (const user of testUsers) {
    const userPath = path.join('./test-data/recommendations-integration/users', `${user.userId}.json`);
    await fs.writeFile(userPath, JSON.stringify(user, null, 2));
  }
  
  // Create test context scenarios
  const testContexts = [
    {
      scenarioId: 'family-weekend-morning',
      description: 'Family together on weekend morning',
      context: {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        weather: { condition: 'sunny', temperature: 22 },
        location: 'home',
        familyPresent: ['test-parent-001', 'test-child-001', 'test-teen-001'],
        availableTime: 3 * 60 * 60 * 1000, // 3 hours
        energyLevel: 'high',
        mood: 'relaxed'
      }
    },
    {
      scenarioId: 'child-learning-time',
      description: 'Child focused learning session',
      context: {
        timeOfDay: 'morning',
        dayOfWeek: 'tuesday',
        weather: { condition: 'cloudy', temperature: 18 },
        location: 'home',
        familyPresent: ['test-child-001'],
        availableTime: 60 * 60 * 1000, // 1 hour
        energyLevel: 'high',
        mood: 'focused'
      }
    },
    {
      scenarioId: 'parent-evening-planning',
      description: 'Parent planning time in evening',
      context: {
        timeOfDay: 'evening',
        dayOfWeek: 'sunday',
        weather: { condition: 'rainy', temperature: 15 },
        location: 'home',
        familyPresent: ['test-parent-001'],
        availableTime: 2 * 60 * 60 * 1000, // 2 hours
        energyLevel: 'medium',
        mood: 'organized'
      }
    },
    {
      scenarioId: 'household-efficiency-focus',
      description: 'Family working on household tasks',
      context: {
        timeOfDay: 'afternoon',
        dayOfWeek: 'saturday',
        weather: { condition: 'overcast', temperature: 20 },
        location: 'home',
        familyPresent: ['test-parent-001', 'test-child-001', 'test-teen-001'],
        availableTime: 4 * 60 * 60 * 1000, // 4 hours
        energyLevel: 'medium',
        mood: 'productive'
      }
    }
  ];
  
  // Save test contexts
  for (const context of testContexts) {
    const contextPath = path.join('./test-data/recommendations-integration/contexts', `${context.scenarioId}.json`);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));
  }
  
  // Create test activity database
  const testActivities = [
    {
      id: 'activity-001',
      title: 'Family Science Experiment',
      description: 'Simple kitchen science experiments for the whole family',
      category: 'educational',
      subcategory: 'science',
      ageRange: { min: 5, max: 99 },
      duration: { min: 30, max: 60 },
      difficulty: 'easy',
      socialLevel: 'family',
      materials: ['kitchen items', 'common household materials'],
      safetyRating: 'child-safe',
      educationalValue: 0.9,
      familyBonding: true
    },
    {
      id: 'activity-002',
      title: 'Creative Art Project',
      description: 'Drawing and painting activities for creative expression',
      category: 'creative',
      subcategory: 'art',
      ageRange: { min: 3, max: 18 },
      duration: { min: 45, max: 120 },
      difficulty: 'easy',
      socialLevel: 'individual',
      materials: ['paper', 'colors', 'brushes'],
      safetyRating: 'child-safe',
      educationalValue: 0.7,
      familyBonding: false
    },
    {
      id: 'activity-003',
      title: 'Household Organization Challenge',
      description: 'Fun way to organize and clean household spaces',
      category: 'household',
      subcategory: 'organization',
      ageRange: { min: 8, max: 99 },
      duration: { min: 60, max: 180 },
      difficulty: 'medium',
      socialLevel: 'family',
      materials: ['storage containers', 'labels'],
      safetyRating: 'child-safe',
      educationalValue: 0.6,
      familyBonding: true,
      efficiencyGain: 0.8
    }
  ];
  
  await fs.writeFile(
    './test-data/test-activities.json',
    JSON.stringify(testActivities, null, 2)
  );
  
  // Create test performance benchmarks
  const performanceBenchmarks = {
    recommendations: {
      maxLatency: 2000, // 2 seconds
      maxMemoryUsage: 1500, // 1.5GB
      maxConcurrentRequests: 5,
      targetAccuracy: 0.8,
      targetUserSatisfaction: 0.75
    },
    integration: {
      avatar: {
        maxResponseTime: 1000,
        targetDeliverySuccess: 0.95
      },
      voice: {
        maxResponseTime: 1000,
        targetNaturalness: 0.8
      },
      scheduling: {
        maxResponseTime: 1000,
        targetConflictResolution: 0.9
      },
      smartHome: {
        maxResponseTime: 1000,
        targetAutomationSuccess: 0.85
      }
    }
  };
  
  await fs.writeFile(
    './test-data/performance-benchmarks.json',
    JSON.stringify(performanceBenchmarks, null, 2)
  );
  
  console.log('Test data initialization completed');
}