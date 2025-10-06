// Jest Configuration for Recommendations Engine Integration Tests
// Optimized for comprehensive end-to-end testing with proper timeouts and setup

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns - specifically for recommendations integration tests
  testMatch: [
    '**/recommendations/integration/*integration*.test.ts',
    '**/recommendations/**/end-to-end*.test.ts'
  ],
  
  // TypeScript support
  preset: 'ts-jest',
  
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@recommendations/(.*)$': '<rootDir>/recommendations/$1',
    '^@avatar/(.*)$': '<rootDir>/avatar/$1',
    '^@learning/(.*)$': '<rootDir>/learning/$1',
    '^@patterns/(.*)$': '<rootDir>/patterns/$1',
    '^@privacy/(.*)$': '<rootDir>/privacy/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/recommendations/integration/integration-test-setup.ts'
  ],
  
  // Test timeouts (integration tests need more time)
  testTimeout: 120000, // 2 minutes for comprehensive integration tests
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'recommendations/**/*.ts',
    'learning/**/*.ts',
    'patterns/**/*.ts',
    'privacy/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/test-data/**',
    '!**/dist/**'
  ],
  
  // Coverage thresholds for recommendations system
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    // Specific thresholds for critical components
    'recommendations/controller.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'recommendations/engines/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'recommendations/privacy/privacy-manager.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Coverage directory
  coverageDirectory: '<rootDir>/coverage/recommendations-integration',
  
  // Test results processors
  reporters: [
    'default'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/recommendations/integration/integration-global-setup.ts',
  globalTeardown: '<rootDir>/recommendations/integration/integration-global-teardown.ts',
  
  // Test sequencing (run integration tests sequentially to avoid conflicts)
  maxWorkers: 1,
  
  // Verbose output for debugging
  verbose: true,
  
  // Detect open handles (useful for debugging async issues)
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test result caching
  cache: false, // Disable cache for integration tests to ensure fresh runs
  
  // Watch mode configuration (for development)
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/test-reports/',
    '<rootDir>/test-data/'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/test-data/'
  ],
  
  // Module path ignore patterns
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/test-data/'
  ],
  
  // Custom test environment options
  testEnvironmentOptions: {
    // Node.js specific options
    NODE_ENV: 'test'
  },
  
  // Globals available in tests
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          // Enable source maps for better debugging
          sourceMap: true,
          inlineSourceMap: false,
          // Allow synthetic default imports
          allowSyntheticDefaultImports: true,
          // Enable experimental decorators if needed
          experimentalDecorators: true,
          // Emit decorator metadata
          emitDecoratorMetadata: true,
          // Target ES2020 for better async/await support
          target: 'ES2020',
          // Use Node.js module resolution
          moduleResolution: 'node',
          // Allow importing JSON files
          resolveJsonModule: true,
          // Skip type checking for faster compilation
          transpileOnly: true
        }
      }
    }
  },
  
  // Custom matchers and utilities
  setupFiles: [
    '<rootDir>/recommendations/integration/integration-test-globals.ts'
  ],
  
  // Memory management for large integration tests
  workerIdleMemoryLimit: '1GB',
  
  // Retry configuration removed - not supported in this Jest version
  
  // Bail configuration - stop after first failure in CI
  bail: process.env.CI ? 1 : 0,
  
  // Notification configuration
  notify: false, // Disable notifications for integration tests
  
  // Performance optimization
  haste: {
    computeSha1: true,
    throwOnModuleCollision: false
  }
};