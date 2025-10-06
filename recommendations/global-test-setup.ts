/**
 * Global Test Setup for System Validation
 * 
 * Initializes the test environment before all tests run.
 * Sets up mock services, test databases, and performance monitoring.
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default async function globalSetup() {
  console.log('🚀 Starting global test setup for system validation...');
  
  try {
    // Create test directories
    setupTestDirectories();
    
    // Initialize test environment
    await initializeTestEnvironment();
    
    // Setup mock services
    await setupMockServices();
    
    // Initialize performance monitoring
    setupPerformanceMonitoring();
    
    // Validate system requirements
    await validateSystemRequirements();
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

function setupTestDirectories() {
  const testDirs = [
    'test-data/temp',
    'test-data/logs',
    'test-data/cache',
    'coverage/system-validation',
    'recommendations/validation-reports'
  ];
  
  testDirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Created test directory: ${dir}`);
    }
  });
}

async function initializeTestEnvironment() {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.DISABLE_EXTERNAL_APIS = 'true';
  process.env.TEST_MODE = 'system_validation';
  process.env.MOCK_SERVICES = 'true';
  
  // Set memory limits for testing
  process.env.MAX_MEMORY_MB = '1536'; // Jetson Nano Orin constraint
  process.env.MAX_RESPONSE_TIME_MS = '2000';
  
  console.log('🔧 Test environment variables configured');
}

async function setupMockServices() {
  // Initialize mock external services
  const mockServices = {
    weatherService: {
      baseUrl: 'http://localhost:3001/mock-weather',
      apiKey: 'test-key'
    },
    locationService: {
      baseUrl: 'http://localhost:3002/mock-location',
      apiKey: 'test-key'
    },
    contentValidationService: {
      baseUrl: 'http://localhost:3003/mock-content',
      apiKey: 'test-key'
    }
  };
  
  // Store mock service configuration
  global.mockServices = mockServices;
  
  console.log('🎭 Mock services configured');
}

function setupPerformanceMonitoring() {
  // Initialize performance tracking
  global.performanceTracker = {
    testStartTime: Date.now(),
    memoryBaseline: process.memoryUsage(),
    requestCounts: new Map(),
    responseTimes: [],
    memoryPeaks: [],
    errorCounts: new Map()
  };
  
  // Override process methods to track performance
  const originalNextTick = process.nextTick;
  process.nextTick = function(callback, ...args) {
    const start = Date.now();
    return originalNextTick.call(this, function() {
      const duration = Date.now() - start;
      if (global.performanceTracker) {
        global.performanceTracker.responseTimes.push(duration);
      }
      return callback.apply(this, args);
    });
  };
  
  // Monitor memory usage
  setInterval(() => {
    if (global.performanceTracker) {
      const memoryUsage = process.memoryUsage();
      global.performanceTracker.memoryPeaks.push(memoryUsage.heapUsed / 1024 / 1024);
    }
  }, 1000);
  
  console.log('📊 Performance monitoring initialized');
}

async function validateSystemRequirements() {
  console.log('🔍 Validating system requirements...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    throw new Error(`Node.js version ${nodeVersion} is not supported. Minimum version: 16.x`);
  }
  
  console.log(`✅ Node.js version: ${nodeVersion}`);
  
  // Check available memory
  const totalMemory = process.memoryUsage();
  const availableMemoryMB = (totalMemory.heapTotal / 1024 / 1024);
  
  console.log(`💾 Available memory: ${availableMemoryMB.toFixed(2)}MB`);
  
  // Check TypeScript compilation
  try {
    execSync('npx tsc --noEmit --project tsconfig.json', { 
      stdio: 'pipe',
      timeout: 30000 
    });
    console.log('✅ TypeScript compilation check passed');
  } catch (error) {
    console.warn('⚠️  TypeScript compilation issues detected');
    // Don't fail setup for TS issues, just warn
  }
  
  // Validate test dependencies
  const requiredPackages = [
    '@jest/globals',
    'ts-jest',
    '@types/jest'
  ];
  
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
      console.log(`✅ ${pkg} available`);
    } catch (error) {
      throw new Error(`Required test dependency not found: ${pkg}`);
    }
  }
  
  console.log('✅ System requirements validation completed');
}

// Global error handlers for test environment
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception in test setup:', error);
  // Log but don't exit during tests
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection in test setup:', reason);
  // Log but don't exit during tests
});

// Extend global types for test utilities
declare global {
  var mockServices: any;
  var performanceTracker: {
    testStartTime: number;
    memoryBaseline: NodeJS.MemoryUsage;
    requestCounts: Map<string, number>;
    responseTimes: number[];
    memoryPeaks: number[];
    errorCounts: Map<string, number>;
  };
}