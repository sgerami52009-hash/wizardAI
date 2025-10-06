// Global Test Utilities and Constants
// Provides shared utilities and constants for integration tests

// Global test constants
export const TEST_CONSTANTS = {
  TIMEOUTS: {
    SHORT: 5000,
    MEDIUM: 15000,
    LONG: 30000,
    EXTENDED: 60000
  },
  
  PERFORMANCE: {
    MIN_FPS: 30,
    MAX_MEMORY_MB: 6000,
    MAX_CPU_PERCENT: 70,
    MAX_TEMPERATURE_C: 85
  },
  
  HARDWARE: {
    JETSON_NANO_ORIN: {
      GPU_MEMORY_MB: 2048,
      CPU_CORES: 6,
      PLATFORM: 'jetson-nano-orin'
    },
    GENERIC: {
      GPU_MEMORY_MB: 1024,
      CPU_CORES: 4,
      PLATFORM: 'generic'
    }
  },
  
  TEST_USERS: {
    ADULT: 'test-user-001',
    CHILD: 'test-child-001',
    TEEN: 'test-teen-001'
  }
};

// Global test utilities
export const TEST_UTILS = {
  // Async delay utility
  delay: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate unique test ID
  generateTestId: (): string => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Check if running in CI environment
  isCI: (): boolean => process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
  
  // Get test timeout based on environment
  getTimeout: (baseTimeout: number): number => {
    const multiplier = TEST_UTILS.isCI() ? 2 : 1; // Double timeout in CI
    return baseTimeout * multiplier;
  },
  
  // Memory usage helper
  getMemoryUsage: (): NodeJS.MemoryUsage => process.memoryUsage(),
  
  // Format memory usage for display
  formatMemoryUsage: (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }
};

// Set global test environment
if (typeof global !== 'undefined') {
  (global as any).TEST_CONSTANTS = TEST_CONSTANTS;
  (global as any).TEST_UTILS = TEST_UTILS;
}

// Console override for test environment
if (process.env.NODE_ENV === 'test') {
  const originalConsole = { ...console };
  
  // Override console methods to include test context
  console.log = (...args: any[]) => {
    if (process.env.AVATAR_LOG_LEVEL !== 'silent') {
      originalConsole.log('[TEST]', ...args);
    }
  };
  
  console.warn = (...args: any[]) => {
    if (process.env.AVATAR_LOG_LEVEL !== 'silent') {
      originalConsole.warn('[TEST:WARN]', ...args);
    }
  };
  
  console.error = (...args: any[]) => {
    originalConsole.error('[TEST:ERROR]', ...args);
  };
}