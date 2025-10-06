/**
 * Jest Configuration for Performance Tests
 * 
 * Specialized configuration for running performance and load tests
 * with appropriate timeouts and resource monitoring.
 */

module.exports = {
  // Base configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Performance test specific settings
  testMatch: [
    '**/recommendations/performance-load.test.ts',
    '**/recommendations/stress-test.ts'
  ],
  
  // Extended timeouts for performance tests
  testTimeout: 900000, // 15 minutes
  
  // Single worker for consistent performance measurement
  maxWorkers: 1,
  
  // Disable cache for accurate performance measurement
  cache: false,
  
  // Force exit to prevent hanging processes
  forceExit: true,
  
  // Detect open handles that might affect performance
  detectOpenHandles: true,
  
  // Setup and teardown
  globalSetup: '<rootDir>/recommendations/performance-test-setup.ts',
  globalTeardown: '<rootDir>/recommendations/performance-test-teardown.ts',
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Coverage configuration (disabled for performance tests)
  collectCoverage: false,
  
  // Verbose output for detailed performance metrics
  verbose: true,
  
  // Environment variables for performance testing
  setupFilesAfterEnv: ['<rootDir>/recommendations/performance-test-env.ts'],
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-reports',
      outputName: 'performance-test-results.xml',
      suiteName: 'Performance Tests'
    }]
  ],
  
  // Memory and resource limits
  workerIdleMemoryLimit: '1GB',
  
  // Test result processor for performance metrics
  testResultsProcessor: '<rootDir>/recommendations/performance-results-processor.js'
};