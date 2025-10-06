// Integration Test Setup
// Configures test environment and utilities for avatar system integration tests

import { avatarSystem } from './system';
import { avatarService } from './service';
import { systemMonitor } from './system-monitor';
import { avatarEventBus } from './events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Extend Jest matchers for avatar system testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeHealthySystem(): R;
      toHaveComponentStatus(componentName: string, status: string): R;
      toMeetPerformanceThreshold(metric: string, threshold: number): R;
      toCompleteWithinTimeout(timeoutMs: number): R;
    }
  }
}

// Custom Jest matchers for avatar system testing
expect.extend({
  toBeHealthySystem(received: any) {
    if (!received || typeof received.getSystemHealth !== 'function') {
      return {
        message: () => 'Expected object to be an avatar system with getSystemHealth method',
        pass: false
      };
    }

    const health = received.getSystemHealth();
    const isHealthy = health.status === 'healthy' || health.status === 'degraded';
    
    return {
      message: () => 
        isHealthy 
          ? `Expected system to not be healthy, but status was ${health.status}`
          : `Expected system to be healthy, but status was ${health.status}`,
      pass: isHealthy
    };
  },

  toHaveComponentStatus(received: any, componentName: string, expectedStatus: string) {
    if (!received || !received.components) {
      return {
        message: () => 'Expected object to have components array',
        pass: false
      };
    }

    const component = received.components.find((c: any) => c.name === componentName);
    if (!component) {
      return {
        message: () => `Component ${componentName} not found`,
        pass: false
      };
    }

    const hasExpectedStatus = component.status === expectedStatus;
    
    return {
      message: () =>
        hasExpectedStatus
          ? `Expected component ${componentName} to not have status ${expectedStatus}`
          : `Expected component ${componentName} to have status ${expectedStatus}, but was ${component.status}`,
      pass: hasExpectedStatus
    };
  },

  toMeetPerformanceThreshold(received: any, metric: string, threshold: number) {
    if (!received || !received.performance) {
      return {
        message: () => 'Expected object to have performance metrics',
        pass: false
      };
    }

    const value = received.performance[metric];
    if (value === undefined) {
      return {
        message: () => `Performance metric ${metric} not found`,
        pass: false
      };
    }

    const meetsThreshold = value >= threshold;
    
    return {
      message: () =>
        meetsThreshold
          ? `Expected ${metric} (${value}) to be below threshold ${threshold}`
          : `Expected ${metric} (${value}) to meet threshold ${threshold}`,
      pass: meetsThreshold
    };
  },

  async toCompleteWithinTimeout(received: Promise<any>, timeoutMs: number) {
    const startTime = Date.now();
    
    try {
      await received;
      const duration = Date.now() - startTime;
      const completedInTime = duration <= timeoutMs;
      
      return {
        message: () =>
          completedInTime
            ? `Expected operation to take longer than ${timeoutMs}ms, but completed in ${duration}ms`
            : `Expected operation to complete within ${timeoutMs}ms, but took ${duration}ms`,
        pass: completedInTime
      };
    } catch (error) {
      return {
        message: () => `Operation failed with error: ${error}`,
        pass: false
      };
    }
  }
});

// Test environment setup
beforeAll(async () => {
  console.log('Setting up integration test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AVATAR_TEST_MODE = 'true';
  
  // Create test data directories
  const testDataDir = path.join(__dirname, '../test-data/integration');
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Set up test logging
  setupTestLogging();
  
  console.log('Integration test environment setup complete');
});

// Test cleanup
afterAll(async () => {
  console.log('Cleaning up integration test environment...');
  
  try {
    // Ensure all systems are shut down
    if (systemMonitor) {
      await systemMonitor.stopMonitoring();
    }
    
    if (avatarSystem.isInitialized()) {
      await avatarSystem.shutdown();
    }
    
    // Clear all event listeners
    avatarEventBus.removeAllListeners();
    
    // Clean up test data
    const testDataDir = path.join(__dirname, '../test-data/integration');
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup errors
    });
    
  } catch (error) {
    console.warn('Error during test cleanup:', error);
  }
  
  console.log('Integration test environment cleanup complete');
});

// Individual test setup
beforeEach(async () => {
  // Clear event listeners before each test
  avatarEventBus.removeAllListeners();
  
  // Ensure clean state
  if (avatarSystem.isInitialized()) {
    await avatarSystem.shutdown();
  }
  
  if (systemMonitor) {
    await systemMonitor.stopMonitoring();
  }
});

// Individual test cleanup
afterEach(async () => {
  // Ensure systems are shut down after each test
  try {
    if (systemMonitor) {
      await systemMonitor.stopMonitoring();
    }
    
    if (avatarSystem.isInitialized()) {
      await avatarSystem.shutdown();
    }
  } catch (error) {
    // Log but don't fail tests due to cleanup errors
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
    originalConsoleLog(`[${timestamp}] [LOG]`, ...args);
  };
  
  console.error = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleError(`[${timestamp}] [ERROR]`, ...args);
  };
  
  console.warn = (...args: any[]) => {
    const timestamp = new Date().toISOString();
    originalConsoleWarn(`[${timestamp}] [WARN]`, ...args);
  };
}

// Test utilities
export class TestUtils {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
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
  
  static async waitForSystemHealth(
    expectedStatus: 'healthy' | 'degraded' | 'critical' | 'offline',
    timeoutMs: number = 10000
  ): Promise<void> {
    await this.waitForCondition(
      () => {
        if (!avatarSystem.isInitialized()) {
          return expectedStatus === 'offline';
        }
        const health = avatarSystem.getSystemHealth();
        return health.status === expectedStatus;
      },
      timeoutMs
    );
  }
  
  static async waitForComponentStatus(
    componentName: string,
    expectedStatus: 'online' | 'offline' | 'error' | 'recovering',
    timeoutMs: number = 10000
  ): Promise<void> {
    await this.waitForCondition(
      () => {
        if (!avatarSystem.isInitialized()) {
          return false;
        }
        const health = avatarSystem.getSystemHealth();
        const component = health.components.find(c => c.name === componentName);
        return component?.status === expectedStatus;
      },
      timeoutMs
    );
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
      memoryUsage: endMemory - startMemory
    };
  }
  
  static createTestAvatarConfiguration(userId: string): any {
    return {
      userId,
      version: '1.0.0',
      appearance: {
        face: { style: 'default' },
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
      createdAt: new Date(),
      lastModified: new Date(),
      parentallyApproved: true
    };
  }
  
  static async simulateSystemLoad(
    durationMs: number = 5000,
    intensity: 'light' | 'medium' | 'heavy' = 'medium'
  ): Promise<void> {
    const operations = [];
    const operationCount = intensity === 'light' ? 5 : intensity === 'medium' ? 10 : 20;
    
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
      if ((Date.now() - startTime) % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }
}

// Export test utilities for use in tests
export { TestUtils as testUtils };

// Global test configuration
export const testConfig = {
  timeouts: {
    short: 5000,    // 5 seconds
    medium: 15000,  // 15 seconds
    long: 30000,    // 30 seconds
    extended: 60000 // 60 seconds
  },
  performance: {
    minFPS: 30,
    maxMemoryUsage: 6000, // 6GB in MB
    maxCPUUsage: 70
  },
  hardware: {
    jetsonNanoOrin: {
      gpuMemoryLimit: 2048,
      cpuCores: 6,
      maxTemperature: 85
    }
  }
};