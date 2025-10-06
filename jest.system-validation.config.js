/**
 * Jest Configuration for System Validation Tests
 * 
 * Specialized configuration for running comprehensive system validation
 * and acceptance tests for the personalized recommendations engine.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/recommendations/system-validation.test.ts',
    '**/recommendations/acceptance-tests.test.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/recommendations/test-setup.ts'
  ],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage/system-validation',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'recommendations/**/*.ts',
    '!recommendations/**/*.test.ts',
    '!recommendations/**/*.d.ts',
    '!recommendations/test-*.ts',
    '!recommendations/run-*.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test timeout (5 minutes for comprehensive tests)
  testTimeout: 300000,
  
  // Verbose output for detailed reporting
  verbose: true,
  
  // Detect open handles to prevent hanging
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Maximum worker processes
  maxWorkers: 4,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/recommendations/global-test-setup.ts',
  globalTeardown: '<rootDir>/recommendations/global-test-teardown.ts',
  
  // Module name mapping for absolute imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@recommendations/(.*)$': '<rootDir>/recommendations/$1',
    '^@avatar/(.*)$': '<rootDir>/avatar/$1',
    '^@learning/(.*)$': '<rootDir>/learning/$1'
  },
  
  // Test result processor for custom reporting
  testResultsProcessor: '<rootDir>/recommendations/test-results-processor.js',
  
  // Reporters for different output formats
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/system-validation/html-report',
      filename: 'system-validation-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'System Validation Test Report'
    }],
    ['jest-junit', {
      outputDirectory: './coverage/system-validation',
      outputName: 'junit-system-validation.xml',
      suiteName: 'System Validation Tests'
    }]
  ],
  
  // Performance monitoring
  logHeapUsage: true,
  
  // Error handling
  bail: false, // Continue running tests even if some fail
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache/system-validation',
  
  // Watch mode configuration (for development)
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],
  
  // Environment variables for tests
  setupFiles: ['<rootDir>/recommendations/test-env-setup.js']
};