/**
 * Test Setup for System Validation Tests
 * 
 * Global test configuration and utilities for system validation
 * and acceptance testing of the personalized recommendations engine.
 */

import { jest } from '@jest/globals';

// Extend Jest matchers for custom assertions
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeChildSafe(received: any) {
    const pass = received && 
                 received.ageAppropriate === true && 
                 received.containsViolence !== true &&
                 received.containsInappropriateLanguage !== true;
    
    if (pass) {
      return {
        message: () => `expected content not to be child safe`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected content to be child safe but found inappropriate content`,
        pass: false,
      };
    }
  },

  toMeetPerformanceRequirements(received: any) {
    const pass = received.responseTime < 2000 && 
                 received.memoryUsage < 1536 &&
                 received.errorRate < 0.05;
    
    if (pass) {
      return {
        message: () => `expected performance metrics not to meet requirements`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected performance metrics to meet requirements: responseTime < 2000ms, memoryUsage < 1536MB, errorRate < 5%`,
        pass: false,
      };
    }
  },

  toHaveValidRecommendationStructure(received: any) {
    const requiredFields = ['id', 'title', 'description', 'confidence', 'reasoning', 'metadata'];
    const hasAllFields = requiredFields.every(field => received.hasOwnProperty(field));
    
    const validConfidence = received.confidence >= 0 && received.confidence <= 1;
    const hasReasoning = Array.isArray(received.reasoning) && received.reasoning.length > 0;
    
    const pass = hasAllFields && validConfidence && hasReasoning;
    
    if (pass) {
      return {
        message: () => `expected recommendation not to have valid structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected recommendation to have valid structure with required fields, valid confidence (0-1), and reasoning array`,
        pass: false,
      };
    }
  }
});

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  process.env.DISABLE_EXTERNAL_APIS = 'true'; // Disable external API calls
  
  // Initialize test database or mock services
  console.log('🔧 Setting up system validation test environment...');
  
  // Mock external dependencies
  mockExternalServices();
  
  // Set up performance monitoring
  setupPerformanceMonitoring();
  
  console.log('✅ Test environment setup complete');
});

afterAll(async () => {
  // Cleanup test environment
  console.log('🧹 Cleaning up test environment...');
  
  // Clear any test data
  await cleanupTestData();
  
  // Reset mocks
  jest.clearAllMocks();
  
  console.log('✅ Test environment cleanup complete');
});

beforeEach(() => {
  // Reset performance counters
  resetPerformanceCounters();
  
  // Clear any cached data
  clearTestCaches();
});

afterEach(() => {
  // Log test performance metrics
  logTestMetrics();
});

// Mock external services to ensure tests are isolated
function mockExternalServices() {
  // Mock weather API
  jest.mock('../external/weather-service', () => ({
    getCurrentWeather: jest.fn().mockResolvedValue({
      condition: 'sunny',
      temperature: 22,
      humidity: 0.6
    })
  }));
  
  // Mock location services
  jest.mock('../external/location-service', () => ({
    getCurrentLocation: jest.fn().mockResolvedValue({
      lat: 40.7128,
      lng: -74.0060,
      accuracy: 10
    })
  }));
  
  // Mock external content APIs
  jest.mock('../external/content-service', () => ({
    validateContent: jest.fn().mockResolvedValue({
      isSafe: true,
      ageAppropriate: true,
      educationalValue: 0.8
    })
  }));
}

// Performance monitoring setup
let performanceCounters = {
  startTime: 0,
  memoryStart: 0,
  requestCount: 0
};

function setupPerformanceMonitoring() {
  // Override console methods to capture performance data
  const originalLog = console.log;
  console.log = (...args) => {
    if (args[0]?.includes?.('PERF:')) {
      // Capture performance logs
      capturePerformanceMetric(args.join(' '));
    }
    originalLog.apply(console, args);
  };
}

function resetPerformanceCounters() {
  performanceCounters = {
    startTime: Date.now(),
    memoryStart: process.memoryUsage().heapUsed,
    requestCount: 0
  };
}

function capturePerformanceMetric(logMessage: string) {
  // Parse and store performance metrics
  if (logMessage.includes('response_time')) {
    const match = logMessage.match(/response_time:(\d+)/);
    if (match) {
      const responseTime = parseInt(match[1]);
      expect(responseTime).toBeLessThan(2000); // Validate response time requirement
    }
  }
}

function logTestMetrics() {
  const currentMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (currentMemory - performanceCounters.memoryStart) / 1024 / 1024;
  const executionTime = Date.now() - performanceCounters.startTime;
  
  if (memoryIncrease > 100) { // More than 100MB increase
    console.warn(`⚠️  High memory usage detected: ${memoryIncrease.toFixed(2)}MB increase`);
  }
  
  if (executionTime > 5000) { // More than 5 seconds
    console.warn(`⚠️  Slow test execution: ${executionTime}ms`);
  }
}

function clearTestCaches() {
  // Clear any in-memory caches used by the recommendation system
  if (global.recommendationCache) {
    global.recommendationCache.clear();
  }
  
  if (global.contextCache) {
    global.contextCache.clear();
  }
}

async function cleanupTestData() {
  // Clean up any test data created during tests
  try {
    // Remove test user profiles
    // Clear test recommendation history
    // Reset test preferences
    console.log('Test data cleanup completed');
  } catch (error) {
    console.warn('Test data cleanup failed:', error.message);
  }
}

// Utility functions for tests
export const testUtils = {
  // Create test user with specific characteristics
  createTestUser: (overrides = {}) => ({
    id: `test-user-${Date.now()}`,
    age: 25,
    preferences: {
      interests: ['technology', 'fitness'],
      activityLevel: 'moderate',
      socialPreference: 'small_group'
    },
    ...overrides
  }),

  // Create test context with realistic data
  createTestContext: (userId: string, overrides = {}) => ({
    userId,
    timestamp: new Date(),
    location: {
      type: 'home',
      coordinates: { lat: 40.7128, lng: -74.0060 },
      weather: { condition: 'sunny', temperature: 22, humidity: 0.6 }
    },
    activity: {
      current: 'free_time',
      energy: 0.7,
      availability: { start: new Date(), duration: 60 }
    },
    mood: {
      energy: 0.7,
      social: 0.6,
      focus: 0.7
    },
    environmental: {
      weather: { condition: 'sunny', temperature: 22 },
      timeOfDay: 'afternoon',
      season: 'spring',
      dayOfWeek: 'saturday'
    },
    ...overrides
  }),

  // Wait for async operations to complete
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Measure execution time
  measureTime: async (fn: () => Promise<any>) => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  },

  // Generate test data
  generateTestRecommendations: (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-rec-${i}`,
      title: `Test Recommendation ${i + 1}`,
      description: `This is a test recommendation for validation purposes`,
      confidence: 0.8,
      reasoning: ['Based on user preferences', 'Contextually appropriate'],
      metadata: {
        category: 'test',
        ageAppropriate: true,
        educationalValue: 0.5
      }
    }));
  }
};

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeChildSafe(): R;
      toMeetPerformanceRequirements(): R;
      toHaveValidRecommendationStructure(): R;
    }
  }
}