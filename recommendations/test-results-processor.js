/**
 * Test Results Processor for System Validation
 * 
 * Processes Jest test results and generates custom reports
 * for system validation and acceptance testing.
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  console.log('\n📊 Processing test results...');
  
  try {
    // Process and enhance test results
    const processedResults = processTestResults(results);
    
    // Generate custom reports
    generateCustomReports(processedResults);
    
    // Log summary
    logTestSummary(processedResults);
    
    console.log('✅ Test results processing completed');
    
    return results; // Return original results for Jest
    
  } catch (error) {
    console.error('❌ Test results processing failed:', error);
    return results; // Return original results even if processing fails
  }
};

function processTestResults(results) {
  const processed = {
    summary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      skippedTests: results.numPendingTests,
      totalTime: results.testResults.reduce((sum, test) => sum + (test.perfStats?.end - test.perfStats?.start || 0), 0),
      success: results.success
    },
    testSuites: [],
    performance: {
      slowestTests: [],
      memoryUsage: [],
      failurePatterns: []
    },
    compliance: {
      childSafety: { passed: 0, failed: 0, total: 0 },
      performance: { passed: 0, failed: 0, total: 0 },
      privacy: { passed: 0, failed: 0, total: 0 },
      integration: { passed: 0, failed: 0, total: 0 }
    }
  };
  
  // Process each test suite
  results.testResults.forEach(testResult => {
    const suite = {
      name: path.basename(testResult.testFilePath),
      path: testResult.testFilePath,
      duration: testResult.perfStats?.end - testResult.perfStats?.start || 0,
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
    
    // Process individual tests
    testResult.assertionResults.forEach(assertion => {
      const test = {
        name: assertion.title,
        status: assertion.status,
        duration: assertion.duration || 0,
        failureMessages: assertion.failureMessages || [],
        location: assertion.location
      };
      
      suite.tests.push(test);
      
      // Update suite summary
      if (assertion.status === 'passed') {
        suite.summary.passed++;
      } else if (assertion.status === 'failed') {
        suite.summary.failed++;
      } else {
        suite.summary.skipped++;
      }
      
      // Categorize tests for compliance tracking
      categorizeTest(test, processed.compliance);
      
      // Track performance issues
      if (test.duration > 5000) { // Tests taking more than 5 seconds
        processed.performance.slowestTests.push({
          name: test.name,
          suite: suite.name,
          duration: test.duration
        });
      }
    });
    
    processed.testSuites.push(suite);
  });
  
  // Sort slowest tests
  processed.performance.slowestTests.sort((a, b) => b.duration - a.duration);
  
  return processed;
}

function categorizeTest(test, compliance) {
  const testName = test.name.toLowerCase();
  
  // Child safety tests
  if (testName.includes('child') || testName.includes('safety') || testName.includes('age')) {
    compliance.childSafety.total++;
    if (test.status === 'passed') {
      compliance.childSafety.passed++;
    } else if (test.status === 'failed') {
      compliance.childSafety.failed++;
    }
  }
  
  // Performance tests
  if (testName.includes('performance') || testName.includes('memory') || testName.includes('response time')) {
    compliance.performance.total++;
    if (test.status === 'passed') {
      compliance.performance.passed++;
    } else if (test.status === 'failed') {
      compliance.performance.failed++;
    }
  }
  
  // Privacy tests
  if (testName.includes('privacy') || testName.includes('data protection') || testName.includes('encryption')) {
    compliance.privacy.total++;
    if (test.status === 'passed') {
      compliance.privacy.passed++;
    } else if (test.status === 'failed') {
      compliance.privacy.failed++;
    }
  }
  
  // Integration tests
  if (testName.includes('integration') || testName.includes('voice') || testName.includes('avatar') || testName.includes('scheduling')) {
    compliance.integration.total++;
    if (test.status === 'passed') {
      compliance.integration.passed++;
    } else if (test.status === 'failed') {
      compliance.integration.failed++;
    }
  }
}

function generateCustomReports(processedResults) {
  const reportsDir = 'recommendations/validation-reports';
  
  // Ensure reports directory exists
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Generate detailed JSON report
  const detailedReportPath = path.join(reportsDir, 'detailed-test-results.json');
  fs.writeFileSync(detailedReportPath, JSON.stringify(processedResults, null, 2));
  
  // Generate compliance report
  const complianceReportPath = path.join(reportsDir, 'compliance-report.json');
  fs.writeFileSync(complianceReportPath, JSON.stringify(processedResults.compliance, null, 2));
  
  // Generate markdown summary
  const markdownSummary = generateMarkdownSummary(processedResults);
  const summaryPath = path.join(reportsDir, 'test-results-summary.md');
  fs.writeFileSync(summaryPath, markdownSummary);
  
  // Generate performance report
  if (processedResults.performance.slowestTests.length > 0) {
    const performanceReportPath = path.join(reportsDir, 'performance-issues.json');
    fs.writeFileSync(performanceReportPath, JSON.stringify(processedResults.performance, null, 2));
  }
  
  console.log(`📄 Reports generated in: ${reportsDir}`);
}

function generateMarkdownSummary(results) {
  const statusEmoji = results.summary.success ? '✅' : '❌';
  const timestamp = new Date().toISOString();
  
  return `# System Validation Test Results

${statusEmoji} **Overall Status**: ${results.summary.success ? 'PASSED' : 'FAILED'}

*Generated on ${timestamp}*

## Summary
- **Total Tests**: ${results.summary.totalTests}
- **Passed**: ${results.summary.passedTests} (${((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)}%)
- **Failed**: ${results.summary.failedTests} (${((results.summary.failedTests / results.summary.totalTests) * 100).toFixed(1)}%)
- **Skipped**: ${results.summary.skippedTests}
- **Total Execution Time**: ${(results.summary.totalTime / 1000).toFixed(2)}s

## Compliance Status

### Child Safety ${getComplianceEmoji(results.compliance.childSafety)}
- **Passed**: ${results.compliance.childSafety.passed}/${results.compliance.childSafety.total}
- **Success Rate**: ${getSuccessRate(results.compliance.childSafety)}%

### Performance Requirements ${getComplianceEmoji(results.compliance.performance)}
- **Passed**: ${results.compliance.performance.passed}/${results.compliance.performance.total}
- **Success Rate**: ${getSuccessRate(results.compliance.performance)}%

### Privacy Protection ${getComplianceEmoji(results.compliance.privacy)}
- **Passed**: ${results.compliance.privacy.passed}/${results.compliance.privacy.total}
- **Success Rate**: ${getSuccessRate(results.compliance.privacy)}%

### System Integration ${getComplianceEmoji(results.compliance.integration)}
- **Passed**: ${results.compliance.integration.passed}/${results.compliance.integration.total}
- **Success Rate**: ${getSuccessRate(results.compliance.integration)}%

## Test Suites

${results.testSuites.map(suite => `### ${suite.name}
- **Duration**: ${(suite.duration / 1000).toFixed(2)}s
- **Tests**: ${suite.tests.length}
- **Passed**: ${suite.summary.passed}
- **Failed**: ${suite.summary.failed}
- **Skipped**: ${suite.summary.skipped}`).join('\n\n')}

${results.performance.slowestTests.length > 0 ? `## Performance Issues

### Slowest Tests
${results.performance.slowestTests.slice(0, 10).map(test => 
  `- **${test.name}** (${test.suite}): ${(test.duration / 1000).toFixed(2)}s`
).join('\n')}` : ''}

${results.summary.failedTests > 0 ? `## Failed Tests
${results.testSuites.flatMap(suite => 
  suite.tests.filter(test => test.status === 'failed')
    .map(test => `- **${test.name}** (${suite.name})`)
).join('\n')}` : ''}

---
*System Validation Report - Personalized Recommendations Engine*
`;
}

function getComplianceEmoji(compliance) {
  if (compliance.total === 0) return '⚪';
  const successRate = (compliance.passed / compliance.total) * 100;
  if (successRate === 100) return '✅';
  if (successRate >= 80) return '⚠️';
  return '❌';
}

function getSuccessRate(compliance) {
  if (compliance.total === 0) return 0;
  return ((compliance.passed / compliance.total) * 100).toFixed(1);
}

function logTestSummary(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYSTEM VALIDATION TEST SUMMARY');
  console.log('='.repeat(60));
  
  const statusEmoji = results.summary.success ? '✅' : '❌';
  console.log(`${statusEmoji} Overall Status: ${results.summary.success ? 'PASSED' : 'FAILED'}`);
  console.log(`📈 Tests: ${results.summary.passedTests}/${results.summary.totalTests} passed`);
  console.log(`⏱️  Total Time: ${(results.summary.totalTime / 1000).toFixed(2)}s`);
  
  // Log compliance summary
  console.log('\n🛡️  Compliance Summary:');
  console.log(`   Child Safety: ${results.compliance.childSafety.passed}/${results.compliance.childSafety.total} ${getComplianceEmoji(results.compliance.childSafety)}`);
  console.log(`   Performance: ${results.compliance.performance.passed}/${results.compliance.performance.total} ${getComplianceEmoji(results.compliance.performance)}`);
  console.log(`   Privacy: ${results.compliance.privacy.passed}/${results.compliance.privacy.total} ${getComplianceEmoji(results.compliance.privacy)}`);
  console.log(`   Integration: ${results.compliance.integration.passed}/${results.compliance.integration.total} ${getComplianceEmoji(results.compliance.integration)}`);
  
  if (results.performance.slowestTests.length > 0) {
    console.log('\n⚠️  Performance Warnings:');
    results.performance.slowestTests.slice(0, 3).forEach(test => {
      console.log(`   - ${test.name}: ${(test.duration / 1000).toFixed(2)}s`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
}