// Global Teardown for Avatar System Integration Tests
// Cleans up the test environment after all tests complete

import * as fs from 'fs/promises';

export default async function globalTeardown(): Promise<void> {
  console.log('Starting global teardown for Avatar System integration tests...');
  
  try {
    // Clean up test data directories (optional, based on environment)
    const shouldCleanup = process.env.AVATAR_CLEANUP_TEST_DATA !== 'false';
    
    if (shouldCleanup) {
      await cleanupTestData();
    } else {
      console.log('Skipping test data cleanup (AVATAR_CLEANUP_TEST_DATA=false)');
    }
    
    // Generate final test summary
    await generateTestSummary();
    
    // Clean up environment variables
    delete process.env.AVATAR_TEST_MODE;
    delete process.env.AVATAR_LOG_LEVEL;
    delete process.env.AVATAR_DISABLE_HARDWARE_CHECKS;
    
    console.log('Global teardown completed successfully');
    
  } catch (error) {
    console.error('Global teardown failed:', error);
    // Don't throw error to avoid masking test failures
  }
}

async function cleanupTestData(): Promise<void> {
  console.log('Cleaning up test data...');
  
  const testDirs = [
    './test-data/integration',
    './test-data/deployment',
    './test-data/performance'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`Cleaned up directory: ${dir}`);
    } catch (error) {
      console.warn(`Failed to clean up directory ${dir}:`, error);
    }
  }
  
  // Clean up test configuration files
  const testFiles = [
    './test-data/test-deployment-config.json',
    './test-data/test-system-config.json',
    './test-data/test-packages.json',
    './test-data/performance-benchmarks.json'
  ];
  
  for (const file of testFiles) {
    try {
      await fs.unlink(file);
      console.log(`Cleaned up file: ${file}`);
    } catch (error) {
      // Ignore file not found errors
      if ((error as any).code !== 'ENOENT') {
        console.warn(`Failed to clean up file ${file}:`, error);
      }
    }
  }
}

async function generateTestSummary(): Promise<void> {
  console.log('Generating test summary...');
  
  try {
    // Check if test reports exist
    const reportsDir = './test-reports/integration';
    
    try {
      await fs.access(reportsDir);
    } catch {
      console.log('No test reports found, skipping summary generation');
      return;
    }
    
    // Read test results if available
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.xml'));
    
    if (reportFiles.length === 0) {
      console.log('No test report files found');
      return;
    }
    
    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      testRun: 'Avatar System Integration Tests',
      environment: process.env.NODE_ENV || 'test',
      reportFiles: reportFiles,
      notes: [
        'Integration tests completed',
        'Check individual report files for detailed results',
        'Coverage reports available in ./coverage/integration/',
        'Test artifacts preserved in ./test-reports/integration/'
      ]
    };
    
    await fs.writeFile(
      './test-reports/integration/test-summary.json',
      JSON.stringify(summary, null, 2)
    );
    
    console.log('Test summary generated: ./test-reports/integration/test-summary.json');
    
  } catch (error) {
    console.warn('Failed to generate test summary:', error);
  }
}