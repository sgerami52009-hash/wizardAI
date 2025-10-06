// Avatar System Integration Test Runner
// Orchestrates and executes comprehensive integration tests with proper setup and teardown

import { avatarSystem } from './system';
import { avatarService } from './service';
import { avatarDeploymentManager } from './deployment';
import { systemMonitor } from './system-monitor';
import { avatarEventBus } from './events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestRunConfiguration {
  testSuites: string[];
  environment: 'development' | 'production' | 'ci';
  hardwareSimulation: {
    platform: 'jetson-nano-orin' | 'generic';
    gpuMemoryLimit: number;
    cpuCores: number;
    enableHardwareAcceleration: boolean;
  };
  testDataDirectory: string;
  cleanupAfterTests: boolean;
  generateReports: boolean;
  reportDirectory: string;
}

export interface TestResult {
  suiteName: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
    performanceScore: number;
  };
}

export interface TestRunReport {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  configuration: TestRunConfiguration;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    successRate: number;
  };
  systemMetrics: {
    peakMemoryUsage: number;
    averageCpuUsage: number;
    performanceIssues: string[];
  };
  recommendations: string[];
}

export class IntegrationTestRunner {
  private config: TestRunConfiguration;
  private results: TestResult[] = [];
  private startTime: Date = new Date();
  private systemMetricsHistory: any[] = [];

  constructor(config: TestRunConfiguration) {
    this.config = config;
  }

  async runAllTests(): Promise<TestRunReport> {
    console.log('Starting Avatar System Integration Tests...');
    this.startTime = new Date();

    try {
      // Set up test environment
      await this.setupTestEnvironment();

      // Run test suites
      for (const suiteName of this.config.testSuites) {
        await this.runTestSuite(suiteName);
      }

      // Generate and return report
      const report = await this.generateReport();
      
      if (this.config.generateReports) {
        await this.saveReport(report);
      }

      return report;

    } finally {
      // Clean up test environment
      await this.cleanupTestEnvironment();
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('Setting up test environment...');

    // Create test data directory
    await fs.mkdir(this.config.testDataDirectory, { recursive: true });

    // Set up hardware simulation
    await this.setupHardwareSimulation();

    // Initialize monitoring for test metrics
    await this.setupTestMonitoring();

    console.log('Test environment setup complete');
  }

  private async setupHardwareSimulation(): Promise<void> {
    console.log('Setting up hardware simulation...');

    // Configure deployment manager for test hardware
    const deploymentConfig = {
      hardware: this.config.hardwareSimulation,
      installation: {
        dataDirectory: path.join(this.config.testDataDirectory, 'data'),
        cacheDirectory: path.join(this.config.testDataDirectory, 'cache'),
        logDirectory: path.join(this.config.testDataDirectory, 'logs'),
        backupDirectory: path.join(this.config.testDataDirectory, 'backups')
      },
      defaultPackages: [
        'com.kiro.test-avatar-basic',
        'com.kiro.test-avatar-child'
      ],
      serviceConfig: {
        autoStart: false, // Don't auto-start in tests
        restartOnFailure: false,
        maxRestartAttempts: 1,
        healthCheckInterval: 5000 // Faster for tests
      }
    };

    await avatarDeploymentManager.updateDeploymentConfiguration(deploymentConfig);
  }

  private async setupTestMonitoring(): Promise<void> {
    console.log('Setting up test monitoring...');

    // Start system monitoring with fast intervals for testing
    await systemMonitor.startMonitoring(1000); // 1 second intervals

    // Listen for metrics and store for analysis
    avatarEventBus.on('avatar:system:metrics-collected', (metrics) => {
      this.systemMetricsHistory.push({
        timestamp: new Date(),
        ...metrics
      });
    });
  }

  private async runTestSuite(suiteName: string): Promise<void> {
    console.log(`Running test suite: ${suiteName}`);

    try {
      // Import and run the test suite
      // Note: In a real implementation, this would use a test framework like Jest
      const testModule = await this.loadTestSuite(suiteName);
      await this.executeTestSuite(testModule, suiteName);

    } catch (error: any) {
      console.error(`Failed to run test suite ${suiteName}:`, error);
      
      this.results.push({
        suiteName,
        testName: 'Suite Execution',
        status: 'failed',
        duration: 0,
        error: error.message
      });
    }
  }

  private async loadTestSuite(suiteName: string): Promise<any> {
    // Simulate loading test suite
    // In real implementation, this would dynamically import test files
    return {
      name: suiteName,
      tests: [
        { name: 'System Initialization', execute: () => this.testSystemInitialization() },
        { name: 'Component Health Checks', execute: () => this.testComponentHealth() },
        { name: 'Performance Under Load', execute: () => this.testPerformanceUnderLoad() },
        { name: 'Error Recovery', execute: () => this.testErrorRecovery() },
        { name: 'Configuration Management', execute: () => this.testConfigurationManagement() }
      ]
    };
  }

  private async executeTestSuite(testModule: any, suiteName: string): Promise<void> {
    for (const test of testModule.tests) {
      const startTime = Date.now();
      
      try {
        console.log(`  Running test: ${test.name}`);
        
        // Execute the test
        await test.execute();
        
        const duration = Date.now() - startTime;
        
        this.results.push({
          suiteName,
          testName: test.name,
          status: 'passed',
          duration,
          metrics: await this.collectTestMetrics()
        });
        
        console.log(`  ✓ ${test.name} (${duration}ms)`);
        
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        this.results.push({
          suiteName,
          testName: test.name,
          status: 'failed',
          duration,
          error: error.message,
          metrics: await this.collectTestMetrics()
        });
        
        console.log(`  ✗ ${test.name} (${duration}ms): ${error.message}`);
      }
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async collectTestMetrics(): Promise<any> {
    const latestMetrics = systemMonitor.getLatestMetrics();
    
    if (!latestMetrics) {
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        performanceScore: 0
      };
    }

    return {
      memoryUsage: latestMetrics.memory.usedRAM,
      cpuUsage: latestMetrics.performance.cpuUsage,
      performanceScore: latestMetrics.performance.averageFPS
    };
  }

  // Sample test implementations
  private async testSystemInitialization(): Promise<void> {
    // Test Requirements: 6.1, 6.4
    if (avatarSystem.isInitialized()) {
      await avatarSystem.shutdown();
    }

    await avatarSystem.initialize();
    
    if (!avatarSystem.isInitialized()) {
      throw new Error('System failed to initialize');
    }

    const health = avatarSystem.getSystemHealth();
    if (health.status === 'offline') {
      throw new Error('System health is offline after initialization');
    }
  }

  private async testComponentHealth(): Promise<void> {
    // Test Requirements: 6.4
    if (!avatarSystem.isInitialized()) {
      await avatarSystem.initialize();
    }

    const health = avatarSystem.getSystemHealth();
    const essentialComponents = health.components.filter(c => c.isEssential);
    
    for (const component of essentialComponents) {
      if (component.status !== 'online') {
        throw new Error(`Essential component ${component.name} is not online: ${component.status}`);
      }
    }
  }

  private async testPerformanceUnderLoad(): Promise<void> {
    // Test Requirements: 6.1, 6.3
    if (!avatarSystem.isInitialized()) {
      await avatarSystem.initialize();
    }

    const customizationController = avatarSystem.getCustomizationController();
    
    // Create multiple concurrent sessions
    const sessions = [];
    for (let i = 0; i < 3; i++) {
      sessions.push(customizationController.startCustomization(`test-user-${i}`));
    }

    await Promise.all(sessions);

    // Check performance metrics
    const metrics = systemMonitor.getLatestMetrics();
    if (metrics && metrics.performance.averageFPS < 20) {
      throw new Error(`Performance degraded under load: ${metrics.performance.averageFPS} FPS`);
    }
  }

  private async testErrorRecovery(): Promise<void> {
    // Test Requirements: 6.4
    if (!avatarSystem.isInitialized()) {
      await avatarSystem.initialize();
    }

    // Simulate a system error
    avatarEventBus.emitSystemError('test-component', {
      code: 'TEST_ERROR',
      message: 'Simulated error for testing',
      component: 'test-component',
      severity: 'warning',
      recoverable: true,
      context: { test: true }
    });

    // Wait for error handling
    await new Promise(resolve => setTimeout(resolve, 1000));

    // System should still be functional
    if (!avatarSystem.isInitialized()) {
      throw new Error('System became uninitialized after error');
    }

    const health = avatarSystem.getSystemHealth();
    if (health.status === 'offline') {
      throw new Error('System went offline after recoverable error');
    }
  }

  private async testConfigurationManagement(): Promise<void> {
    // Test Requirements: 6.4, 6.5
    if (!avatarSystem.isInitialized()) {
      await avatarSystem.initialize();
    }

    const originalConfig = avatarSystem.getConfiguration();
    
    // Update configuration
    const configUpdate = {
      performance: {
        ...originalConfig.performance,
        targetFPS: 30
      }
    };

    await avatarSystem.updateConfiguration(configUpdate);

    const updatedConfig = avatarSystem.getConfiguration();
    if (updatedConfig.performance.targetFPS !== 30) {
      throw new Error('Configuration update failed');
    }

    // System should remain stable
    if (!avatarSystem.isInitialized()) {
      throw new Error('System became uninitialized after configuration update');
    }
  }

  private async generateReport(): Promise<TestRunReport> {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    // Calculate summary statistics
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    // Analyze system metrics
    const systemMetrics = this.analyzeSystemMetrics();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      startTime: this.startTime,
      endTime,
      totalDuration,
      configuration: this.config,
      results: this.results,
      summary: {
        total,
        passed,
        failed,
        skipped,
        successRate
      },
      systemMetrics,
      recommendations
    };
  }

  private analyzeSystemMetrics(): any {
    if (this.systemMetricsHistory.length === 0) {
      return {
        peakMemoryUsage: 0,
        averageCpuUsage: 0,
        performanceIssues: []
      };
    }

    const memoryUsages = this.systemMetricsHistory.map(m => m.memory?.usedRAM || 0);
    const cpuUsages = this.systemMetricsHistory.map(m => m.performance?.cpuUsage || 0);
    const fpsValues = this.systemMetricsHistory.map(m => m.performance?.averageFPS || 0);

    const peakMemoryUsage = Math.max(...memoryUsages);
    const averageCpuUsage = cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length;
    const minFps = Math.min(...fpsValues);

    const performanceIssues = [];
    if (peakMemoryUsage > 6000) { // > 6GB
      performanceIssues.push('High memory usage detected');
    }
    if (averageCpuUsage > 70) {
      performanceIssues.push('High CPU usage detected');
    }
    if (minFps < 30) {
      performanceIssues.push('Low FPS detected during tests');
    }

    return {
      peakMemoryUsage,
      averageCpuUsage,
      performanceIssues
    };
  }

  private generateRecommendations(): string[] {
    const recommendations = [];
    const failedTests = this.results.filter(r => r.status === 'failed');
    const systemMetrics = this.analyzeSystemMetrics();

    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed - review error messages and system logs`);
    }

    if (systemMetrics.peakMemoryUsage > 6000) {
      recommendations.push('Consider optimizing memory usage - peak usage exceeded 6GB');
    }

    if (systemMetrics.averageCpuUsage > 70) {
      recommendations.push('High CPU usage detected - consider performance optimizations');
    }

    if (systemMetrics.performanceIssues.length > 0) {
      recommendations.push('Performance issues detected - review system configuration');
    }

    const avgTestDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    if (avgTestDuration > 5000) { // > 5 seconds average
      recommendations.push('Tests are running slowly - consider optimizing test setup');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed successfully with good performance metrics');
    }

    return recommendations;
  }

  private async saveReport(report: TestRunReport): Promise<void> {
    await fs.mkdir(this.config.reportDirectory, { recursive: true });
    
    const reportPath = path.join(
      this.config.reportDirectory,
      `integration-test-report-${Date.now()}.json`
    );

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also save a human-readable summary
    const summaryPath = path.join(
      this.config.reportDirectory,
      `integration-test-summary-${Date.now()}.txt`
    );

    const summary = this.generateTextSummary(report);
    await fs.writeFile(summaryPath, summary);

    console.log(`Test report saved to: ${reportPath}`);
    console.log(`Test summary saved to: ${summaryPath}`);
  }

  private generateTextSummary(report: TestRunReport): string {
    const lines = [
      'Avatar System Integration Test Report',
      '=====================================',
      '',
      `Test Run: ${report.startTime.toISOString()} - ${report.endTime.toISOString()}`,
      `Duration: ${report.totalDuration}ms`,
      `Environment: ${report.configuration.environment}`,
      `Platform: ${report.configuration.hardwareSimulation.platform}`,
      '',
      'Summary:',
      `  Total Tests: ${report.summary.total}`,
      `  Passed: ${report.summary.passed}`,
      `  Failed: ${report.summary.failed}`,
      `  Skipped: ${report.summary.skipped}`,
      `  Success Rate: ${report.summary.successRate.toFixed(1)}%`,
      '',
      'System Metrics:',
      `  Peak Memory Usage: ${report.systemMetrics.peakMemoryUsage.toFixed(1)}MB`,
      `  Average CPU Usage: ${report.systemMetrics.averageCpuUsage.toFixed(1)}%`,
      `  Performance Issues: ${report.systemMetrics.performanceIssues.length}`,
      ''
    ];

    if (report.systemMetrics.performanceIssues.length > 0) {
      lines.push('Performance Issues:');
      report.systemMetrics.performanceIssues.forEach(issue => {
        lines.push(`  - ${issue}`);
      });
      lines.push('');
    }

    lines.push('Recommendations:');
    report.recommendations.forEach(rec => {
      lines.push(`  - ${rec}`);
    });
    lines.push('');

    const failedTests = report.results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      lines.push('Failed Tests:');
      failedTests.forEach(test => {
        lines.push(`  - ${test.suiteName}: ${test.testName}`);
        lines.push(`    Error: ${test.error}`);
        lines.push(`    Duration: ${test.duration}ms`);
      });
    }

    return lines.join('\n');
  }

  private async cleanupTestEnvironment(): Promise<void> {
    console.log('Cleaning up test environment...');

    try {
      // Stop monitoring
      await systemMonitor.stopMonitoring();

      // Shutdown system
      if (avatarSystem.isInitialized()) {
        await avatarSystem.shutdown();
      }

      // Clean up test data if requested
      if (this.config.cleanupAfterTests) {
        await fs.rm(this.config.testDataDirectory, { recursive: true, force: true });
      }

      // Clear event listeners
      avatarEventBus.removeAllListeners();

    } catch (error) {
      console.error('Error during test cleanup:', error);
    }

    console.log('Test environment cleanup complete');
  }
}

// Default test configuration
export const defaultTestConfig: TestRunConfiguration = {
  testSuites: [
    'system-integration',
    'deployment-integration',
    'performance-integration',
    'safety-integration'
  ],
  environment: 'ci',
  hardwareSimulation: {
    platform: 'jetson-nano-orin',
    gpuMemoryLimit: 2048,
    cpuCores: 6,
    enableHardwareAcceleration: true
  },
  testDataDirectory: './test-data/integration-runner',
  cleanupAfterTests: true,
  generateReports: true,
  reportDirectory: './test-reports'
};

// Export function to run tests with default configuration
export async function runIntegrationTests(config?: Partial<TestRunConfiguration>): Promise<TestRunReport> {
  const finalConfig = { ...defaultTestConfig, ...config };
  const runner = new IntegrationTestRunner(finalConfig);
  return await runner.runAllTests();
}

// CLI entry point
if (require.main === module) {
  runIntegrationTests()
    .then(report => {
      console.log('\nIntegration Test Results:');
      console.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
      console.log(`Total Duration: ${report.totalDuration}ms`);
      
      if (report.summary.failed > 0) {
        console.error(`${report.summary.failed} tests failed`);
        process.exit(1);
      } else {
        console.log('All tests passed successfully!');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('Integration test runner failed:', error);
      process.exit(1);
    });
}