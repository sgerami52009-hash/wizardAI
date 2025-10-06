/**
 * Performance Test Results Processor
 * 
 * Processes Jest test results to extract and format performance metrics
 * for reporting and analysis.
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  console.log('\n📊 Processing performance test results...\n');

  const performanceReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      testSuites: results.numTotalTestSuites,
      duration: results.testResults.reduce((sum, suite) => sum + (suite.perfStats?.end - suite.perfStats?.start || 0), 0)
    },
    testSuites: [],
    performance: {
      memoryUsage: [],
      latencyMetrics: [],
      complianceStatus: {}
    }
  };

  // Process each test suite
  results.testResults.forEach(testSuite => {
    const suiteReport = {
      name: testSuite.testFilePath,
      status: testSuite.numFailingTests === 0 ? 'PASSED' : 'FAILED',
      duration: testSuite.perfStats ? testSuite.perfStats.end - testSuite.perfStats.start : 0,
      tests: testSuite.testResults.length,
      passed: testSuite.testResults.filter(t => t.status === 'passed').length,
      failed: testSuite.testResults.filter(t => t.status === 'failed').length,
      performanceMetrics: extractPerformanceMetrics(testSuite)
    };

    performanceReport.testSuites.push(suiteReport);

    // Extract performance data
    if (suiteReport.performanceMetrics) {
      performanceReport.performance.memoryUsage.push(...suiteReport.performanceMetrics.memory || []);
      performanceReport.performance.latencyMetrics.push(...suiteReport.performanceMetrics.latency || []);
    }
  });

  // Analyze compliance
  performanceReport.performance.complianceStatus = analyzeCompliance(performanceReport);

  // Save detailed report
  savePerformanceReport(performanceReport);

  // Log summary
  logPerformanceSummary(performanceReport);

  return results;
};

function extractPerformanceMetrics(testSuite) {
  const metrics = {
    memory: [],
    latency: [],
    errors: []
  };

  // Extract metrics from console output
  if (testSuite.console) {
    testSuite.console.forEach(log => {
      const message = log.message;
      
      // Extract memory metrics
      if (message.includes('memory:') || message.includes('Memory:')) {
        const memoryMatch = message.match(/(\d+(?:\.\d+)?)MB/);
        if (memoryMatch) {
          metrics.memory.push({
            timestamp: log.timestamp || Date.now(),
            value: parseFloat(memoryMatch[1]),
            context: message
          });
        }
      }

      // Extract latency metrics
      if (message.includes('latency:') || message.includes('Latency:') || message.includes('ms')) {
        const latencyMatch = message.match(/(\d+(?:\.\d+)?)ms/);
        if (latencyMatch) {
          metrics.latency.push({
            timestamp: log.timestamp || Date.now(),
            value: parseFloat(latencyMatch[1]),
            context: message
          });
        }
      }

      // Extract error information
      if (log.type === 'error' || message.includes('Error:') || message.includes('FAIL')) {
        metrics.errors.push({
          timestamp: log.timestamp || Date.now(),
          message: message,
          type: log.type || 'error'
        });
      }
    });
  }

  // Extract metrics from test results
  testSuite.testResults.forEach(test => {
    if (test.failureMessages && test.failureMessages.length > 0) {
      test.failureMessages.forEach(failure => {
        // Look for performance-related failures
        if (failure.includes('latency') || failure.includes('memory') || failure.includes('performance')) {
          metrics.errors.push({
            timestamp: Date.now(),
            message: failure,
            testName: test.fullName,
            type: 'performance_failure'
          });
        }
      });
    }
  });

  return metrics;
}

function analyzeCompliance(report) {
  const compliance = {
    memoryCompliance: true,
    latencyCompliance: true,
    errorRateCompliance: true,
    overallCompliance: true,
    details: {}
  };

  // Memory compliance (≤ 1500MB)
  const memoryValues = report.performance.memoryUsage.map(m => m.value);
  if (memoryValues.length > 0) {
    const maxMemory = Math.max(...memoryValues);
    const avgMemory = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;
    
    compliance.details.memory = {
      max: maxMemory,
      average: avgMemory,
      threshold: 1500,
      compliant: maxMemory <= 1500
    };
    
    compliance.memoryCompliance = maxMemory <= 1500;
  }

  // Latency compliance (≤ 2000ms)
  const latencyValues = report.performance.latencyMetrics.map(l => l.value);
  if (latencyValues.length > 0) {
    const maxLatency = Math.max(...latencyValues);
    const avgLatency = latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length;
    const p95Latency = calculatePercentile(latencyValues, 95);
    
    compliance.details.latency = {
      max: maxLatency,
      average: avgLatency,
      p95: p95Latency,
      threshold: 2000,
      compliant: avgLatency <= 2000 && p95Latency <= 2000
    };
    
    compliance.latencyCompliance = avgLatency <= 2000 && p95Latency <= 2000;
  }

  // Error rate compliance (≤ 5%)
  const totalTests = report.summary.totalTests;
  const failedTests = report.summary.failedTests;
  const errorRate = totalTests > 0 ? (failedTests / totalTests) * 100 : 0;
  
  compliance.details.errorRate = {
    rate: errorRate,
    threshold: 5,
    compliant: errorRate <= 5
  };
  
  compliance.errorRateCompliance = errorRate <= 5;

  // Overall compliance
  compliance.overallCompliance = compliance.memoryCompliance && 
                                compliance.latencyCompliance && 
                                compliance.errorRateCompliance;

  return compliance;
}

function calculatePercentile(values, percentile) {
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.floor((percentile / 100) * sorted.length);
  return sorted[index] || 0;
}

function savePerformanceReport(report) {
  try {
    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `performance-detailed-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Detailed performance report saved: ${reportFile}`);

    // Also save a CSV summary for easy analysis
    const csvFile = path.join(reportsDir, `performance-summary-${Date.now()}.csv`);
    const csvContent = generateCSVSummary(report);
    fs.writeFileSync(csvFile, csvContent);
    
    console.log(`📊 CSV performance summary saved: ${csvFile}`);

  } catch (error) {
    console.error('❌ Failed to save performance report:', error);
  }
}

function generateCSVSummary(report) {
  let csv = 'Metric,Value,Threshold,Status\n';
  
  const compliance = report.performance.complianceStatus;
  
  if (compliance.details.memory) {
    csv += `Max Memory (MB),${compliance.details.memory.max},${compliance.details.memory.threshold},${compliance.details.memory.compliant ? 'PASS' : 'FAIL'}\n`;
    csv += `Avg Memory (MB),${compliance.details.memory.average.toFixed(2)},${compliance.details.memory.threshold},${compliance.details.memory.compliant ? 'PASS' : 'FAIL'}\n`;
  }
  
  if (compliance.details.latency) {
    csv += `Max Latency (ms),${compliance.details.latency.max},${compliance.details.latency.threshold},${compliance.details.latency.compliant ? 'PASS' : 'FAIL'}\n`;
    csv += `Avg Latency (ms),${compliance.details.latency.average.toFixed(2)},${compliance.details.latency.threshold},${compliance.details.latency.compliant ? 'PASS' : 'FAIL'}\n`;
    csv += `P95 Latency (ms),${compliance.details.latency.p95},${compliance.details.latency.threshold},${compliance.details.latency.compliant ? 'PASS' : 'FAIL'}\n`;
  }
  
  if (compliance.details.errorRate) {
    csv += `Error Rate (%),${compliance.details.errorRate.rate.toFixed(2)},${compliance.details.errorRate.threshold},${compliance.details.errorRate.compliant ? 'PASS' : 'FAIL'}\n`;
  }
  
  csv += `Overall Compliance,${compliance.overallCompliance ? 'PASS' : 'FAIL'},PASS,${compliance.overallCompliance ? 'PASS' : 'FAIL'}\n`;
  
  return csv;
}

function logPerformanceSummary(report) {
  console.log('📊 PERFORMANCE TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Passed: ${report.summary.passedTests}`);
  console.log(`Failed: ${report.summary.failedTests}`);
  console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
  console.log('');

  const compliance = report.performance.complianceStatus;
  
  console.log('COMPLIANCE STATUS:');
  console.log(`Memory Compliance: ${compliance.memoryCompliance ? '✅ PASS' : '❌ FAIL'}`);
  if (compliance.details.memory) {
    console.log(`  Max Memory: ${compliance.details.memory.max}MB (limit: ${compliance.details.memory.threshold}MB)`);
  }
  
  console.log(`Latency Compliance: ${compliance.latencyCompliance ? '✅ PASS' : '❌ FAIL'}`);
  if (compliance.details.latency) {
    console.log(`  Avg Latency: ${compliance.details.latency.average.toFixed(2)}ms (limit: ${compliance.details.latency.threshold}ms)`);
  }
  
  console.log(`Error Rate Compliance: ${compliance.errorRateCompliance ? '✅ PASS' : '❌ FAIL'}`);
  if (compliance.details.errorRate) {
    console.log(`  Error Rate: ${compliance.details.errorRate.rate.toFixed(2)}% (limit: ${compliance.details.errorRate.threshold}%)`);
  }
  
  console.log('');
  console.log(`OVERALL: ${compliance.overallCompliance ? '✅ ALL REQUIREMENTS MET' : '❌ REQUIREMENTS NOT MET'}`);
  console.log('='.repeat(60));
}