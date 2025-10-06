#!/usr/bin/env node

/**
 * Performance Test Validation Script
 * 
 * Validates that the performance tests can run successfully
 * and meet the basic requirements.
 */

const { spawn } = require('child_process');
const path = require('path');

async function validatePerformanceTests() {
  console.log('🧪 Validating Performance Tests...\n');

  try {
    // Run a single performance test to validate it works
    const result = await runJestTest('recommendations/performance-load.test.ts', [
      '--testNamePattern=should generate activity recommendations within 2 second latency threshold',
      '--testTimeout=30000',
      '--maxWorkers=1',
      '--detectOpenHandles',
      '--forceExit'
    ]);

    if (result.success) {
      console.log('✅ Performance test validation successful!');
      console.log('📊 Performance test infrastructure is working correctly');
      console.log('🚀 Ready for comprehensive performance testing');
      
      // Display test capabilities
      console.log('\n📋 Available Performance Tests:');
      console.log('  • Latency Tests (Requirement 7.2)');
      console.log('    - Activity recommendations < 2s');
      console.log('    - Schedule optimization < 2s');
      console.log('    - Educational content < 2s');
      console.log('    - Household efficiency < 2s');
      console.log('    - Repeated request stability');
      
      console.log('  • Memory Tests (Requirement 7.1)');
      console.log('    - Memory usage < 1.5GB constraint');
      console.log('    - Extended operation memory management');
      console.log('    - Memory leak detection');
      
      console.log('  • Concurrent Tests (Requirement 7.4)');
      console.log('    - 5+ concurrent users');
      console.log('    - High load handling (30+ requests)');
      console.log('    - Mixed recommendation types');
      
      console.log('  • Resource Optimization (Requirement 7.6)');
      console.log('    - Performance under constraints');
      console.log('    - Quality maintenance during optimization');
      
      console.log('\n🔧 Usage:');
      console.log('  npm run test:performance        # Run all performance tests');
      console.log('  node scripts/run-performance-tests.js --quick  # Quick validation');
      console.log('  node scripts/run-performance-tests.js --stress # Stress testing');
      
      return true;
    } else {
      console.log('❌ Performance test validation failed');
      console.log('📝 Check the test output above for details');
      return false;
    }
  } catch (error) {
    console.error('💥 Validation error:', error.message);
    return false;
  }
}

async function runJestTest(testFile, additionalArgs = []) {
  return new Promise((resolve) => {
    const args = [
      'jest',
      testFile,
      '--verbose',
      '--no-cache',
      ...additionalArgs
    ];

    console.log(`Running: npx ${args.join(' ')}`);
    
    const jestProcess = spawn('npx', args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    jestProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    jestProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    jestProcess.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        stdout,
        stderr
      });
    });

    // Timeout after 45 seconds
    setTimeout(() => {
      if (!jestProcess.killed) {
        console.log('\n⏰ Test timeout, terminating...');
        jestProcess.kill('SIGTERM');
      }
    }, 45000);
  });
}

// Run validation
validatePerformanceTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  });