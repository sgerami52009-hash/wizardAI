/**
 * Integration Test Setup for Recommendations Engine
 * Configures test environment and utilities for comprehensive integration testing
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Extend Jest matchers for recommendations system testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidRecommendation(): R;
      toMeetPerformanceRequirements(maxLatency: number, maxMemory: number): R;
      toBeChildSafe(): R;
      toHaveIntegrationActions(actionType?: string): R;
      toRespectPrivacyPreferences(userId: string): R;
      toBeContextuallyRelevant(context: any): R;
    }
  }
}

// Custom Jest matchers for recommendations system testing
expect.extend({
  toBeValidRecommendation(received: any) {
    const requiredFields = ['id', 'type', 'title', 'description', 'confidence', 'reasoning', 'actionable'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Recommendation missing required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    const hasValidConfidence = received.confidence >= 0 && received.confidence <= 1;
    if (!hasValidConfidence) {
      return {
        message: () => `Recommendation confidence must be between 0 and 1, got ${received.confidence}`,
        pass: false
      };
    }

    const hasValidReasoning = Array.isArray(received.reasoning) && received.reasoning.length > 0;
    if (!hasValidReasoning) {
      return {
        message: () => 'Recommendation must have non-empty reasoning array',
        pass: false
      };
    }

    return {
      message: () => 'Expected recommendation to be invalid',
      pass: true
    };
  },

  async toMeetPerformanceRequirements(received: Promise<any>, maxLatency: number, maxMemory: number) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      await received;
      const latency = Date.now() - startTime;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024; // MB
      
      const meetsLatency = latency <= maxLatency;
      const meetsMemory = memoryUsed <= maxMemory;
      
      if (!meetsLatency && !meetsMemory) {
        return {
          message: () => `Performance requirements not met: latency ${latency}ms (max ${maxLatency}ms), memory ${memoryUsed}MB (max ${maxMemory}MB)`,
          pass: false
        };
      } else if (!meetsLatency) {
        return {
          message: () => `Latency requirement not met: ${latency}ms (max ${maxLatency}ms)`,
          pass: false
        };
      } else if (!meetsMemory) {
        return {
          message: () => `Memory requirement not met: ${memoryUsed}MB (max ${maxMemory}MB)`,
          pass: false
        };
      }
      
      return {
        message: () => `Performance requirements met: latency ${latency}ms, memory ${memoryUsed}MB`,
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Operation failed: ${error}`,
        pass: false
      };
    }
  },

  toBeChildSafe(received: any) {
    if (!received || !received.metadata) {
      return {
        message: () => 'Recommendation must have metadata to check child safety',
        pass: false
      };
    }

    const isChildSafe = received.metadata.childSafe === true;
    const isAgeAppropriate = received.metadata.ageAppropriate === true;
    
    if (!isChildSafe || !isAgeAppropriate) {
      return {
        message: () => `Recommendation not child safe: childSafe=${received.metadata.childSafe}, ageAppropriate=${received.metadata.ageAppropriate}`,
        pass: false
      };
    }

    return {
      message: () => 'Expected recommendation to not be child safe',
      pass: true
    };
  },

  toHaveIntegrationActions(received: any, actionType?: string) {
    if (!received || !received.integrationActions) {
      return {
        message: () => 'Recommendation must have integrationActions array',
        pass: false
      };
    }

    if (!Array.isArray(received.integrationActions)) {
      return {
        message: () => 'integrationActions must be an array',
        pass: false
      };
    }

    if (actionType) {
      const hasActionType = received.integrationActions.some((action: any) => action.type === actionType);
      if (!hasActionType) {
        return {
          message: () => `No integration action of type '${actionType}' found`,
          pass: false
        };
      }
    } else if (received.integrationActions.length === 0) {
      return {
        message: () => 'Recommendation should have at least one integration action',
        pass: false
      };
    }

    return {
      message: () => actionType 
        ? `Expected recommendation to not have integration action of type '${actionType}'`
        : 'Expected recommendation to not have integration actions',
      pass: true
    };
  },

  toRespectPrivacyPreferences(received: any, userId: string) {
    if (!received || !received.metadata) {
      return {
        message: () => 'Recommendation must have metadata to check privacy compliance',
        pass: false
      };
    }

    const isPrivacyCompliant = received.metadata.privacyCompliant === true;
    const isDataMinimized = received.metadata.dataMinimized !== false; // Default to true if not specified
    
    if (!isPrivacyCompliant) {
      return {
        message: () => `Recommendation not privacy compliant for user ${userId}`,
        pass: false
      };
    }

    return {
      message: () => `Expected recommendation to violate privacy preferences for user ${userId}`,
      pass: true
    };
  },

  toBeContextuallyRelevant(received: any, context: any) {
    if (!received || !received.metadata) {
      return {
        message: () => 'Recommendation must have metadata to check contextual relevance',
        pass: false
      };
    }

    // Check if recommendation matches context
    const hasContextMatch = received.metadata.contextMatch !== undefined;
    const contextScore = received.metadata.contextMatch || 0;
    
    if (!hasContextMatch || contextScore < 0.5) {
      return {
        message: () => `Recommendation not contextually relevant: context match score ${contextScore}`,
        pass: false
      };
    }

    return {
      message: () => `Expected recommendation to not be contextually relevant`,
      pass: true
    };
  }
});

// Test environment setup
beforeAll(async () => {
  console.log('Setting up recommendations integration test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.RECOMMENDATIONS_TEST_MODE = 'true';
  process.env.RECOMMENDATIONS_LOG_LEVEL = 'warn';
  process.env.RECOMMENDATIONS_DISABLE_EXTERNAL_APIS = 'true';
  
  // Create test data directories
  const testDataDir = path.join(__dirname, '../../test-data/recommendations-integration');
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Set up test logging
  setupTestLogging();
  
  console.log('Recommendations integration test environment setup complete');
});

// Test cleanup
afterAll(async () => {
  console.log('Cleaning up recommendations integration test environment...');
  
  try {
    // Clean up test data
    const testDataDir = path.join(__dirname, '../../test-data/recommendations-integration');
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
    
  } catch (error) {
    console.warn('Error during test cleanup:', error);
  }
  
  console.log('Recommendations integration test environment cleanup complete');
});

// Individual test setup
beforeEach(async () => {
  // Clear any cached data before each test
  if (global.gc) {
    global.gc(); // Force garbage collection if available
  }
});

// Individual test cleanup
afterEach(async () => {
  // Clean up after each test
  try {
    // Force garbage collection to prevent memory leaks
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.warn('Warning: Error during test cleanup:', error);
  }
});

// Test logging setup
function setupTestLogging(): void {
  // Capture and format console output for tests
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.log = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleLog(`[${timestamp}] [RECOMMENDATIONS-TEST] [LOG]`, ...args);
  };
  
  console.error = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleError(`[${timestamp}] [RECOMMENDATIONS-TEST] [ERROR]`, ...args);
  };
  
  console.warn = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleWarn(`[${timestamp}] [RECOMMENDATIONS-TEST] [WARN]`, ...args);
  };
}

// Test utilities
export class RecommendationsTestUtils {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 10000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await condition();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }
  
  static async measurePerformance<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number; memoryUsage: number }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await operation();
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      result,
      duration: endTime - startTime,
      memoryUsage: (endMemory - startMemory) / 1024 / 1024 // MB
    };
  }
  
  static createTestUserContext(userId: string, overrides: any = {}): any {
    return {
      userId,
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        weather: { condition: 'sunny', temperature: 22 },
        indoorOutdoor: 'indoor'
      },
      activity: {
        current: 'free_time',
        availableTime: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
        energyLevel: 'medium',
        mood: 'content'
      },
      availability: {
        status: 'available',
        until: new Date(Date.now() + 2 * 60 * 60 * 1000),
        constraints: []
      },
      mood: {
        primary: 'content',
        energy: 'medium',
        stress: 'low'
      },
      energy: 'medium',
      social: {
        familyPresent: [],
        preferredSocialLevel: 'individual',
        groupSize: 1
      },
      environmental: {
        location: 'home',
        weather: { condition: 'sunny', temperature: 22 },
        timeOfDay: 'afternoon',
        season: 'spring'
      },
      preferences: {
        activityTypes: ['general'],
        difficultyLevel: 'medium',
        duration: 'medium',
        socialLevel: 'individual'
      },
      ...overrides
    };
  }
  
  static createTestUserPreferences(userId: string, overrides: any = {}): any {
    return {
      userId,
      interests: [
        { category: 'general', subcategory: 'misc', strength: 0.5, recency: new Date(), source: 'default' }
      ],
      activityPreferences: {
        preferredCategories: ['general'],
        difficultyLevel: 'medium',
        durationPreference: 'medium',
        socialPreference: 'individual'
      },
      schedulePreferences: {
        preferredTimes: ['any'],
        flexibilityLevel: 'medium',
        priorityTypes: ['personal']
      },
      learningPreferences: {
        adaptationRate: 0.5,
        explorationRate: 0.3,
        feedbackSensitivity: 0.7
      },
      privacyPreferences: {
        dataMinimization: false,
        shareWithFamily: false,
        allowLearning: true,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        encryptionRequired: true
      },
      notificationPreferences: {
        enabled: true,
        frequency: 'moderate',
        channels: ['system'],
        quietHours: { start: '22:00', end: '07:00' }
      },
      lastUpdated: new Date(),
      ...overrides
    };
  }
  
  static async simulateSystemLoad(
    durationMs: number = 5000,
    intensity: 'light' | 'medium' | 'heavy' = 'medium'
  ): Promise<void> {
    const operations = [];
    const operationCount = intensity === 'light' ? 3 : intensity === 'medium' ? 6 : 12;
    
    for (let i = 0; i < operationCount; i++) {
      operations.push(this.simulateOperation(durationMs / operationCount));
    }
    
    await Promise.all(operations);
  }
  
  private static async simulateOperation(durationMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < durationMs) {
      // Simulate CPU work
      Math.random() * Math.random();
      
      // Yield control periodically
      if ((Date.now() - startTime) % 50 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }
  
  static validateRecommendationStructure(recommendation: any): boolean {
    const requiredFields = ['id', 'type', 'title', 'description', 'confidence', 'reasoning', 'actionable'];
    return requiredFields.every(field => field in recommendation);
  }
  
  static validateChildSafety(recommendation: any): boolean {
    return recommendation.metadata?.childSafe === true && 
           recommendation.metadata?.ageAppropriate === true;
  }
  
  static validatePrivacyCompliance(recommendation: any): boolean {
    return recommendation.metadata?.privacyCompliant === true;
  }
  
  static validatePerformanceMetrics(duration: number, memoryUsage: number): boolean {
    const MAX_LATENCY = 2000; // 2 seconds
    const MAX_MEMORY = 100; // 100MB per operation
    
    return duration <= MAX_LATENCY && memoryUsage <= MAX_MEMORY;
  }
}

// Export test utilities for use in tests
export { RecommendationsTestUtils as testUtils };

// Global test configuration
export const testConfig = {
  timeouts: {
    short: 5000,     // 5 seconds
    medium: 15000,   // 15 seconds
    long: 30000,     // 30 seconds
    extended: 120000 // 2 minutes
  },
  performance: {
    maxLatency: 2000,      // 2 seconds
    maxMemoryPerOp: 100,   // 100MB per operation
    maxTotalMemory: 1500,  // 1.5GB total
    maxConcurrentRequests: 5
  },
  safety: {
    requireChildSafetyValidation: true,
    requirePrivacyCompliance: true,
    requireParentalApproval: true
  },
  integration: {
    enableAvatarIntegration: true,
    enableVoiceIntegration: true,
    enableSchedulingIntegration: true,
    enableSmartHomeIntegration: true
  }
};