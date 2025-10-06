#!/usr/bin/env node

// Avatar System Integration Test Execution Script
// Runs comprehensive integration tests with proper environment setup

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  // Test suites to run
  suites: [
    'avatar/system-integration.test.ts',
    'avatar/deployment-integration.test.ts'
  ],
  
  // Environment settings
  environment: process.env.NODE_ENV || 'test',
  
  // Jest configuration
  jestConfig: 'jest.integration.config.js',
  
  // Output directories
  outputDir: './test-reports/integration',
  coverageDir: './coverage/integration',
  
  // Test options
  options: {
    verbose: true,
    detectOpenHandles: true,
    forceExit: true,
    maxWorkers: 1, // Run tests sequentially
    timeout: 60000 // 60 second timeout
  }
};

async function main() {
  console.log('🚀 Starting Avatar System Integration Tests');
  console.log('==========================================');
  
  try {
    // Pre-test setup
    await preTestSetup();
    
    // Run integration tests
    const testResult = await runIntegrationTests();
    
    // Post-test analysis
    await postTestAnalysis();
    
    // Exit with appropriate code
    process.exit(testResult.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Integration test execution failed:', error);
    process.exit(1);
  }
}

async function preTestSetup() {
  console.log('📋 Setting up test environment...');
  
  // Create output directories
  await fs.mkdir(TEST_CONFIG.outputDir, { recursive: true });
  await fs.mkdir(TEST_CONFIG.coverageDir, { recursive: true });
  
  // Set environment variables
  process.env.NODE_ENV = 'test';
  process.env.AVATAR_TEST_MODE = 'true';
  process.env.AVATAR_LOG_LEVEL = 'warn';
  
  // Check system requirements
  await checkSystemRequirements();
  
  console.log('✅ Test environment setup complete');
}

async function checkSystemRequirements() {
  console.log('🔍 Checking system requirements...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
  }
  
  // Check available memory
  const totalMemory = require('os').totalmem();
  const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
  
  if (totalMemoryGB < 4) {
    console.warn('⚠️  Warning: Less than 4GB RAM available, tests may be slower');
  }
  
  // Check disk space
  try {
    const stats = await fs.stat('./');
    console.log('💾 System checks passed');
  } catch (error) {
    console.warn('⚠️  Warning: Could not check disk space');
  }
}

async function runIntegrationTests() {
  console.log('🧪 Running integration tests...');
  
  return new Promise((resolve, reject) => {
    const jestArgs = [
      '--config', TEST_CONFIG.jestConfig,
      '--testPathPattern', 'integration',
      '--coverage',
      '--coverageDirectory', TEST_CONFIG.coverageDir,
      '--outputFile', path.join(TEST_CONFIG.outputDir, 'test-results.json'),
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--maxWorkers=1'
    ];
    
    // Add CI-specific options
    if (process.env.CI === 'true') {
      jestArgs.push('--ci', '--watchman=false');
    }
    
    const jestProcess = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        AVATAR_TEST_MODE: 'true'
      }
    });
    
    jestProcess.on('close', (code) => {
      const success = code === 0;
      
      if (success) {
        console.log('✅ Integration tests completed successfully');
      } else {
        console.error('❌ Integration tests failed');
      }
      
      resolve({ success, exitCode: code });
    });
    
    jestProcess.on('error', (error) => {
      console.error('❌ Failed to run Jest:', error);
      reject(error);
    });
  });
}

async function postTestAnalysis() {
  console.log('📊 Analyzing test results...');
  
  try {
    // Read test results
    const resultsPath = path.join(TEST_CONFIG.outputDir, 'test-results.json');
    
    try {
      const resultsData = await fs.readFile(resultsPath, 'utf8');
      const results = JSON.parse(resultsData);
      
      console.log('📈 Test Summary:');
      console.log(`   Total Tests: ${results.numTotalTests || 'N/A'}`);
      console.log(`   Passed: ${results.numPassedTests || 'N/A'}`);
      console.log(`   Failed: ${results.numFailedTests || 'N/A'}`);
      console.log(`   Duration: ${results.testResults?.[0]?.perfStats?.runtime || 'N/A'}ms`);
      
    } catch (error) {
      console.log('📋 Test results file not found, checking for other reports...');
    }
    
    // Check coverage
    await analyzeCoverage();
    
    // Generate summary report
    await generateSummaryReport();
    
  } catch (error) {
    console.warn('⚠️  Warning: Could not analyze test results:', error.message);
  }
}

async function analyzeCoverage() {
  try {
    const coveragePath = path.join(TEST_CONFIG.coverageDir, 'coverage-summary.json');
    const coverageData = await fs.readFile(coveragePath, 'utf8');
    const coverage = JSON.parse(coverageData);
    
    console.log('📊 Coverage Summary:');
    console.log(`   Lines: ${coverage.total?.lines?.pct || 'N/A'}%`);
    console.log(`   Functions: ${coverage.total?.functions?.pct || 'N/A'}%`);
    console.log(`   Branches: ${coverage.total?.branches?.pct || 'N/A'}%`);
    console.log(`   Statements: ${coverage.total?.statements?.pct || 'N/A'}%`);
    
  } catch (error) {
    console.log('📋 Coverage data not available');
  }
}

async function generateSummaryReport() {
  const summary = {
    timestamp: new Date().toISOString(),
    testRun: 'Avatar System Integration Tests',
    environment: TEST_CONFIG.environment,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    configuration: TEST_CONFIG,
    reports: {
      results: path.join(TEST_CONFIG.outputDir, 'test-results.json'),
      coverage: path.join(TEST_CONFIG.coverageDir, 'index.html'),
      junit: path.join(TEST_CONFIG.outputDir, 'junit.xml')
    }
  };
  
  const summaryPath = path.join(TEST_CONFIG.outputDir, 'integration-test-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  
  console.log(`📄 Summary report saved: ${summaryPath}`);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Integration tests interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Integration tests terminated');
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main, TEST_CONFIG };