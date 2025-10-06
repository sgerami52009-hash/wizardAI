// Jest Configuration for Avatar System Integration Tests
// Optimized for comprehensive system testing with proper timeouts and setup

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/avatar/*integration*.test.ts',
    '**/avatar/system-integration.test.ts',
    '**/avatar/deployment-integration.test.ts'
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
    '^@avatar/(.*)$': '<rootDir>/avatar/$1',
    '^@rendering/(.*)$': '<rootDir>/rendering/$1',
    '^@learning/(.*)$': '<rootDir>/learning/$1',
    '^@packages/(.*)$': '<rootDir>/packages/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/avatar/integration-test-setup.ts'
  ],
  
  // Test timeouts (integration tests need more time)
  testTimeout: 60000, // 60 seconds for integration tests
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'avatar/**/*.ts',
    'rendering/**/*.ts',
    'packages/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/test-data/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Specific thresholds for critical components
    'avatar/system.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'avatar/service.ts': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
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
  coverageDirectory: '<rootDir>/coverage/integration',
  
  // Test results processors
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-reports/integration',
        filename: 'integration-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Avatar System Integration Tests'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-reports/integration',
        outputName: 'junit.xml',
        suiteName: 'Avatar System Integration Tests'
      }
    ]
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/avatar/integration-global-setup.ts',
  globalTeardown: '<rootDir>/avatar/integration-global-teardown.ts',
  
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
    '<rootDir>/avatar/integration-test-globals.ts'
  ]
};