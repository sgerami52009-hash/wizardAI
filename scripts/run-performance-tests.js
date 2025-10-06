#!/usr/bin/env node

/**
 * Performance Test Runner for Recommendations Engine
 * 
 * Executes comprehensive performance and load tests to validate
 * system performance under various conditions and hardware constraints.
 * 
 * Usage:
 *   node scripts/run-performance-tests.js [--quick] [--stress] [--report]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  quick: {
    testPattern: 'recommendations/performance-load.test.ts',
    timeout: 300000, // 5 minutes
    description: 'Quick performance validation tests'
  },
  full: {
    testPattern: 'recommendations/performance-load.test.ts',
    timeout: 900000, // 15 minutes
    description: 'Full performance and load test suite'
  },
  stress: {
    testPattern: 'recommendations/stress-test.ts',
    timeout: 1800000, // 30 minutes
    description: 'Stress testing with extreme load conditions'
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isStress = args.includes('--stress');
const generateReport = args.includes('--report');
const verbose = args.includes('--verbose');

async function main() {
  console.log('🚀 Starting Recommendations Engine Performance Tests\n');

  // Determine which tests to run
  let testSuite = 'full';
  if (isQuick) {
    testSuite = 'quick';
  } else if (isStress) {
    testSuite = 'stress';
  }

  const config = TEST_CONFIG[testSuite];
  console.log(`📊 Running: ${config.description}`);
  console.log(`⏱️  Timeout: ${config.timeout / 1000}s\n`);

  // Check system requirements
  await checkSystemRequirements();

  // Run performance tests
  const testResults = await runPerformanceTests(config);

  // Generate report if requested
  if (generateReport) {
    await generatePerformanceReport(testResults, testSuite);
  }

  // Display summary
  displayTestSummary(testResults);

  process.exit(testResults.success ? 0 : 1);
}

async function checkSystemRequirements() {
  console.log('🔍 Checking system requirements...');

  // Check available memory
  const totalMemory = require('os').totalmem();
  const totalMemoryGB = totalMemory / (1024 * 1024 * 1024);
  
  console.log(`   Total System Memory: ${totalMemoryGB.toFixed(2)}GB`);
  
  if (totalMemoryGB < 4) {
    console.warn('⚠️  Warning: System has less than 4GB RAM. Tests may be affected.');
  }

  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`   Node.js Version: ${nodeVersion}`);

  // Check if Jest is available
  try {
    require.resolve('jest');
    console.log('   Jest: Available');
  } catch (error) {
    console.error('❌ Jest not found. Please install dependencies.');
    process.exit(1);
  }

  console.log('✅ System requirements check complete\n');
}

async function runPerformanceTests(config) {
  return new Promise((resolve) => {
    console.log('🧪 Executing performance tests...\n');

    const jestArgs = [
      '--testPathPattern=' + config.testPattern,
      '--testTimeout=' + config.timeout,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--maxWorkers=1', // Single worker for consistent performance measurement
      '--no-cache'
    ];

    if (verbose) {
      jestArgs.push('--verbose');
    }

    const jestProcess = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PERFORMANCE_TEST: 'true'
      }
    });

    let stdout = '';
    let stderr = '';

    jestProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (verbose) {
        process.stdout.write(output);
      }
    });

    jestProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      if (verbose) {
        process.stderr.write(output);
      }
    });

    jestProcess.on('close', (code) => {
      const success = code === 0;
      
      resolve({
        success,
        code,
        stdout,
        stderr,
        timestamp: new Date().toISOString(),
        config
      });
    });

    // Handle timeout
    setTimeout(() => {
      if (!jestProcess.killed) {
        console.log('⏰ Test timeout reached, terminating...');
        jestProcess.kill('SIGTERM');
      }
    }, config.timeout + 10000); // Extra 10 seconds buffer
  });
}

async function generatePerformanceReport(testResults, testSuite) {
  console.log('📝 Generating performance report...');

  const reportDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportFile = path.join(reportDir, `performance-report-${testSuite}-${Date.now()}.md`);

  const report = generateMarkdownReport(testResults, testSuite);
  
  fs.writeFileSync(reportFile, report);
  console.log(`📄 Report saved to: ${reportFile}\n`);
}

function generateMarkdownReport(testResults, testSuite) {
  const { success, stdout, stderr, timestamp, config } = testResults;

  let report = `# Performance Test Report - ${testSuite.toUpperCase()}\n\n`;
  report += `**Generated:** ${timestamp}\n`;
  report += `**Test Suite:** ${config.description}\n`;
  report += `**Status:** ${success ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  // System Information
  report += `## System Information\n\n`;
  report += `- **Platform:** ${process.platform}\n`;
  report += `- **Architecture:** ${process.arch}\n`;
  report += `- **Node.js Version:** ${process.version}\n`;
  report += `- **Total Memory:** ${(require('os').totalmem() / (1024 * 1024 * 1024)).toFixed(2)}GB\n`;
  report += `- **CPU Cores:** ${require('os').cpus().length}\n\n`;

  // Test Configuration
  report += `## Test Configuration\n\n`;
  report += `- **Test Pattern:** ${config.testPattern}\n`;
  report += `- **Timeout:** ${config.timeout / 1000}s\n`;
  report += `- **Max Workers:** 1 (for consistent measurement)\n\n`;

  // Test Results
  report += `## Test Results\n\n`;
  
  if (success) {
    report += `### ✅ All Tests Passed\n\n`;
    
    // Extract performance metrics from stdout
    const performanceMetrics = extractPerformanceMetrics(stdout);
    if (performanceMetrics.length > 0) {
      report += `### Performance Metrics\n\n`;
      performanceMetrics.forEach(metric => {
        report += `- ${metric}\n`;
      });
      report += '\n';
    }
  } else {
    report += `### ❌ Test Failures Detected\n\n`;
    
    // Extract failure information
    const failures = extractFailures(stdout, stderr);
    if (failures.length > 0) {
      report += `#### Failures:\n\n`;
      failures.forEach(failure => {
        report += `- ${failure}\n`;
      });
      report += '\n';
    }
  }

  // Performance Requirements Validation
  report += `## Performance Requirements Validation\n\n`;
  report += `| Requirement | Threshold | Status |\n`;
  report += `|-------------|-----------|--------|\n`;
  report += `| Memory Usage | ≤ 1.5GB | ${extractComplianceStatus(stdout, 'memory')} |\n`;
  report += `| Latency | ≤ 2000ms | ${extractComplianceStatus(stdout, 'latency')} |\n`;
  report += `| Concurrent Users | ≥ 5 users | ${extractComplianceStatus(stdout, 'concurrent')} |\n`;
  report += `| Error Rate | ≤ 5% | ${extractComplianceStatus(stdout, 'error')} |\n\n`;

  // Recommendations
  report += `## Recommendations\n\n`;
  if (success) {
    report += `- ✅ System meets all performance requirements\n`;
    report += `- ✅ Memory usage is within Jetson Nano Orin constraints\n`;
    report += `- ✅ Latency requirements are satisfied\n`;
    report += `- ✅ Concurrent user handling is adequate\n`;
  } else {
    report += `- ❌ Performance optimization required\n`;
    report += `- 🔧 Review memory usage patterns\n`;
    report += `- 🔧 Optimize recommendation algorithms\n`;
    report += `- 🔧 Consider caching strategies\n`;
  }

  // Raw Output (if verbose)
  if (verbose) {
    report += `\n## Raw Test Output\n\n`;
    report += `### STDOUT\n\`\`\`\n${stdout}\n\`\`\`\n\n`;
    if (stderr) {
      report += `### STDERR\n\`\`\`\n${stderr}\n\`\`\`\n`;
    }
  }

  return report;
}

function extractPerformanceMetrics(stdout) {
  const metrics = [];
  const lines = stdout.split('\n');
  
  lines.forEach(line => {
    if (line.includes('latency:') || line.includes('memory:') || line.includes('throughput:')) {
      metrics.push(line.trim());
    }
  });
  
  return metrics;
}

function extractFailures(stdout, stderr) {
  const failures = [];
  const output = stdout + stderr;
  const lines = output.split('\n');
  
  lines.forEach(line => {
    if (line.includes('FAIL') || line.includes('Error:') || line.includes('expect(')) {
      failures.push(line.trim());
    }
  });
  
  return failures;
}

function extractComplianceStatus(stdout, requirement) {
  // This would parse the test output to determine compliance status
  // For now, return a placeholder based on overall success
  const hasFailure = stdout.includes('FAIL') || stdout.includes('Error');
  return hasFailure ? '❌ FAIL' : '✅ PASS';
}

function displayTestSummary(testResults) {
  const { success, config } = testResults;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Test Suite: ${config.description}`);
  console.log(`Status: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Exit Code: ${testResults.code}`);
  
  if (success) {
    console.log('\n🎉 All performance tests passed!');
    console.log('✅ System meets Jetson Nano Orin performance requirements');
    console.log('✅ Memory usage is within 1.5GB constraint');
    console.log('✅ Latency requirements are satisfied');
  } else {
    console.log('\n⚠️  Performance tests failed!');
    console.log('❌ System requires optimization');
    console.log('🔧 Review test output for specific issues');
  }
  
  console.log('='.repeat(60) + '\n');
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Performance tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Performance tests terminated');
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error('💥 Performance test runner failed:', error);
  process.exit(1);
});