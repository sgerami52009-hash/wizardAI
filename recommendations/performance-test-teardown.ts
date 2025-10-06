/**
 * Global Teardown for Performance Tests
 * 
 * Cleans up the test environment and generates final performance reports
 * after all performance tests have completed.
 */

import * as fs from 'fs';
import * as path from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Cleaning up performance test environment...\n');

  // Stop performance monitoring
  stopPerformanceMonitoring();

  // Generate final performance report
  await generateFinalReport();

  // Clean up resources
  await cleanupResources();

  // Log final system state
  logFinalSystemState();

  console.log('✅ Performance test cleanup complete\n');
}

function stopPerformanceMonitoring(): void {
  console.log('📊 Stopping performance monitoring...');

  const interval = (global as any).__PERFORMANCE_MONITORING_INTERVAL__;
  if (interval) {
    clearInterval(interval);
    console.log('   Performance monitoring stopped');
  }

  // Calculate total test duration
  const startTime = (global as any).__PERFORMANCE_TEST_START_TIME__;
  if (startTime) {
    const totalDuration = Date.now() - startTime;
    console.log(`   Total test duration: ${(totalDuration / 1000).toFixed(2)}s`);
  }
}

async function generateFinalReport(): Promise<void> {
  console.log('📝 Generating final performance report...');

  const metrics = (global as any).__PERFORMANCE_METRICS__;
  const initialMemory = (global as any).__PERFORMANCE_TEST_INITIAL_MEMORY__;
  const startTime = (global as any).__PERFORMANCE_TEST_START_TIME__;

  if (!metrics || !initialMemory || !startTime) {
    console.log('   No performance data available for report');
    return;
  }

  const finalMemory = process.memoryUsage();
  const totalDuration = Date.now() - startTime;

  // Calculate memory statistics
  const memoryStats = calculateMemoryStatistics(metrics.memoryReadings, initialMemory, finalMemory);

  // Generate report
  const report = generatePerformanceReport({
    duration: totalDuration,
    memoryStats,
    testCount: metrics.testLatencies.length,
    errorCount: metrics.errors.length
  });

  // Save report to file
  const reportsDir = path.join(process.cwd(), 'test-reports');
  const reportFile = path.join(reportsDir, `performance-summary-${Date.now()}.json`);

  try {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`   Performance report saved: ${reportFile}`);
  } catch (error) {
    console.error('   Failed to save performance report:', error);
  }

  // Log summary to console
  logPerformanceSummary(report);
}

function calculateMemoryStatistics(memoryReadings: any[], initialMemory: any, finalMemory: any) {
  if (memoryReadings.length === 0) {
    return {
      initial: Math.round(initialMemory.heapUsed / 1024 / 1024),
      final: Math.round(finalMemory.heapUsed / 1024 / 1024),
      peak: Math.round(finalMemory.heapUsed / 1024 / 1024),
      average: Math.round(finalMemory.heapUsed / 1024 / 1024),
      memoryLeak: false
    };
  }

  const memoryValues = memoryReadings.map(reading => reading.usage.heapUsed / 1024 / 1024);
  const peak = Math.max(...memoryValues);
  const average = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;

  // Detect potential memory leak
  const firstQuarter = memoryValues.slice(0, Math.floor(memoryValues.length / 4));
  const lastQuarter = memoryValues.slice(-Math.floor(memoryValues.length / 4));
  const firstAvg = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
  const lastAvg = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
  const memoryLeak = (lastAvg - firstAvg) > 100; // More than 100MB increase

  return {
    initial: Math.round(initialMemory.heapUsed / 1024 / 1024),
    final: Math.round(finalMemory.heapUsed / 1024 / 1024),
    peak: Math.round(peak),
    average: Math.round(average),
    memoryLeak
  };
}

function generatePerformanceReport(data: any) {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalDuration: data.duration,
      testCount: data.testCount,
      errorCount: data.errorCount,
      successRate: data.testCount > 0 ? ((data.testCount - data.errorCount) / data.testCount * 100).toFixed(2) : 0
    },
    memory: data.memoryStats,
    compliance: {
      memoryConstraint: data.memoryStats.peak <= 1500,
      memoryLeakDetected: data.memoryStats.memoryLeak,
      overallCompliance: data.memoryStats.peak <= 1500 && !data.memoryStats.memoryLeak
    },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCores: require('os').cpus().length,
      totalMemoryGB: (require('os').totalmem() / (1024 * 1024 * 1024)).toFixed(2)
    }
  };
}

function logPerformanceSummary(report: any): void {
  console.log('\n📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
  console.log(`Tests: ${report.summary.testCount}`);
  console.log(`Errors: ${report.summary.errorCount}`);
  console.log(`Success Rate: ${report.summary.successRate}%`);
  console.log('');
  console.log('Memory Usage:');
  console.log(`  Initial: ${report.memory.initial}MB`);
  console.log(`  Peak: ${report.memory.peak}MB`);
  console.log(`  Final: ${report.memory.final}MB`);
  console.log(`  Average: ${report.memory.average}MB`);
  console.log('');
  console.log('Compliance:');
  console.log(`  Memory Constraint (≤1500MB): ${report.compliance.memoryConstraint ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Memory Leak Detection: ${report.compliance.memoryLeakDetected ? '❌ DETECTED' : '✅ NONE'}`);
  console.log(`  Overall Compliance: ${report.compliance.overallCompliance ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(50));
}

async function cleanupResources(): Promise<void> {
  console.log('🧹 Cleaning up resources...');

  // Clear global performance data
  delete (global as any).__PERFORMANCE_METRICS__;
  delete (global as any).__PERFORMANCE_TEST_INITIAL_MEMORY__;
  delete (global as any).__PERFORMANCE_TEST_START_TIME__;
  delete (global as any).__PERFORMANCE_MONITORING_INTERVAL__;

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('   Garbage collection performed');
  }

  // Wait for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('   Resource cleanup complete');
}

function logFinalSystemState(): void {
  console.log('📊 Final System State:');
  
  const memUsage = process.memoryUsage();
  console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
  console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  
  const cpuUsage = process.cpuUsage();
  console.log(`   CPU User: ${cpuUsage.user}μs`);
  console.log(`   CPU System: ${cpuUsage.system}μs`);
  
  console.log(`   Uptime: ${process.uptime().toFixed(2)}s`);
}