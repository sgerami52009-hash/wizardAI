/**
 * Stress Testing Utilities for Recommendations Engine
 * 
 * Provides utilities for stress testing the recommendations engine
 * under extreme load conditions to validate hardware constraints
 * and performance optimization strategies.
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.6
 */

import { RecommendationController } from './controller';
import { PerformanceMonitor } from './performance-monitor';
import { UserContext, RecommendationType } from './types';

export interface StressTestConfig {
  maxUsers: number;
  requestsPerUser: number;
  concurrentBatches: number;
  testDurationMs: number;
  memoryThresholdMB: number;
  latencyThresholdMs: number;
}

export interface StressTestResults {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  p95Latency: number;
  p99Latency: number;
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  memoryLeakDetected: boolean;
  throughputPerSecond: number;
  errorRate: number;
  performanceScore: number;
}

export class RecommendationStressTester {
  private controller: RecommendationController;
  private performanceMonitor: PerformanceMonitor;
  private testResults: StressTestResults[] = [];

  constructor(controller: RecommendationController, performanceMonitor: PerformanceMonitor) {
    this.controller = controller;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Run comprehensive stress test suite
   */
  async runStressTestSuite(): Promise<StressTestResults[]> {
    console.log('Starting comprehensive stress test suite...');

    const testConfigs: StressTestConfig[] = [
      // Light load test
      {
        maxUsers: 5,
        requestsPerUser: 10,
        concurrentBatches: 2,
        testDurationMs: 30000,
        memoryThresholdMB: 1500,
        latencyThresholdMs: 2000
      },
      // Medium load test
      {
        maxUsers: 10,
        requestsPerUser: 20,
        concurrentBatches: 5,
        testDurationMs: 60000,
        memoryThresholdMB: 1500,
        latencyThresholdMs: 2000
      },
      // Heavy load test
      {
        maxUsers: 20,
        requestsPerUser: 50,
        concurrentBatches: 10,
        testDurationMs: 120000,
        memoryThresholdMB: 1500,
        latencyThresholdMs: 2000
      },
      // Extreme load test (stress test)
      {
        maxUsers: 50,
        requestsPerUser: 100,
        concurrentBatches: 20,
        testDurationMs: 180000,
        memoryThresholdMB: 1500,
        latencyThresholdMs: 3000 // Allow some degradation under extreme load
      }
    ];

    for (const config of testConfigs) {
      console.log(`Running stress test: ${config.maxUsers} users, ${config.requestsPerUser} requests/user`);
      const result = await this.runStressTest(config);
      this.testResults.push(result);
      
      // Allow system to recover between tests
      await this.waitForSystemRecovery();
    }

    return this.testResults;
  }

  /**
   * Run individual stress test with given configuration
   */
  async runStressTest(config: StressTestConfig): Promise<StressTestResults> {
    const startTime = Date.now();
    const latencies: number[] = [];
    const memoryReadings: number[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    // Initialize memory monitoring
    const memoryMonitorInterval = setInterval(() => {
      const memUsage = this.getMemoryUsage();
      memoryReadings.push(memUsage);
      this.performanceMonitor.trackMemoryUsage('stress_test', memUsage);
    }, 1000);

    try {
      // Generate test load
      const promises: Promise<void>[] = [];

      for (let batch = 0; batch < config.concurrentBatches; batch++) {
        const batchPromise = this.runBatch(
          config.maxUsers / config.concurrentBatches,
          config.requestsPerUser,
          latencies,
          () => successfulRequests++,
          () => failedRequests++
        );
        promises.push(batchPromise);
      }

      // Wait for all batches to complete or timeout
      await Promise.race([
        Promise.all(promises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), config.testDurationMs)
        )
      ]);

    } catch (error) {
      console.error('Stress test error:', error);
    } finally {
      clearInterval(memoryMonitorInterval);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    return this.calculateResults(
      config,
      latencies,
      memoryReadings,
      successfulRequests,
      failedRequests,
      totalTime
    );
  }

  /**
   * Run a batch of concurrent requests
   */
  private async runBatch(
    userCount: number,
    requestsPerUser: number,
    latencies: number[],
    onSuccess: () => void,
    onFailure: () => void
  ): Promise<void> {
    const batchPromises: Promise<void>[] = [];

    for (let userId = 0; userId < userCount; userId++) {
      const userPromise = this.runUserRequests(
        `stress_user_${userId}`,
        requestsPerUser,
        latencies,
        onSuccess,
        onFailure
      );
      batchPromises.push(userPromise);
    }

    await Promise.all(batchPromises);
  }

  /**
   * Run requests for a single user
   */
  private async runUserRequests(
    userId: string,
    requestCount: number,
    latencies: number[],
    onSuccess: () => void,
    onFailure: () => void
  ): Promise<void> {
    const recommendationTypes = [
      RecommendationType.ACTIVITY,
      RecommendationType.SCHEDULE,
      RecommendationType.EDUCATIONAL,
      RecommendationType.HOUSEHOLD
    ];

    for (let i = 0; i < requestCount; i++) {
      try {
        const context = this.createStressTestContext(userId);
        const type = recommendationTypes[i % recommendationTypes.length];
        
        const startTime = Date.now();
        await this.controller.getRecommendations(userId, context, type);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);
        this.performanceMonitor.trackRecommendationLatency('stress_test', latency);
        onSuccess();

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        console.error(`Request failed for user ${userId}:`, error);
        onFailure();
      }
    }
  }

  /**
   * Calculate comprehensive test results
   */
  private calculateResults(
    config: StressTestConfig,
    latencies: number[],
    memoryReadings: number[],
    successfulRequests: number,
    failedRequests: number,
    totalTime: number
  ): StressTestResults {
    const totalRequests = successfulRequests + failedRequests;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    
    const averageLatency = latencies.length > 0 ? 
      latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    
    const peakMemoryUsage = memoryReadings.length > 0 ? Math.max(...memoryReadings) : 0;
    const averageMemoryUsage = memoryReadings.length > 0 ? 
      memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length : 0;

    // Detect memory leaks
    const memoryLeakDetected = this.detectMemoryLeak(memoryReadings);

    // Calculate throughput
    const throughputPerSecond = (successfulRequests / totalTime) * 1000;

    // Calculate error rate
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Calculate performance score (0-100)
    const performanceScore = this.calculatePerformanceScore(
      config,
      averageLatency,
      peakMemoryUsage,
      errorRate,
      throughputPerSecond
    );

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency,
      maxLatency: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
      minLatency: sortedLatencies.length > 0 ? sortedLatencies[0] : 0,
      p95Latency: sortedLatencies.length > 0 ? sortedLatencies[p95Index] : 0,
      p99Latency: sortedLatencies.length > 0 ? sortedLatencies[p99Index] : 0,
      peakMemoryUsage,
      averageMemoryUsage,
      memoryLeakDetected,
      throughputPerSecond,
      errorRate,
      performanceScore
    };
  }

  /**
   * Detect memory leaks by analyzing memory usage trend
   */
  private detectMemoryLeak(memoryReadings: number[]): boolean {
    if (memoryReadings.length < 10) return false;

    const firstQuarter = memoryReadings.slice(0, Math.floor(memoryReadings.length / 4));
    const lastQuarter = memoryReadings.slice(-Math.floor(memoryReadings.length / 4));

    const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
    const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

    // Consider it a leak if memory increased by more than 200MB
    return (lastQuarterAvg - firstQuarterAvg) > 200;
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(
    config: StressTestConfig,
    averageLatency: number,
    peakMemoryUsage: number,
    errorRate: number,
    throughputPerSecond: number
  ): number {
    let score = 100;

    // Latency penalty
    if (averageLatency > config.latencyThresholdMs) {
      score -= Math.min(30, (averageLatency - config.latencyThresholdMs) / 100);
    }

    // Memory penalty
    if (peakMemoryUsage > config.memoryThresholdMB) {
      score -= Math.min(25, (peakMemoryUsage - config.memoryThresholdMB) / 50);
    }

    // Error rate penalty
    score -= Math.min(25, errorRate);

    // Throughput bonus/penalty
    const expectedThroughput = 5; // requests per second
    if (throughputPerSecond < expectedThroughput) {
      score -= Math.min(20, (expectedThroughput - throughputPerSecond) * 4);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Create test context for stress testing
   */
  private createStressTestContext(userId: string): UserContext {
    return {
      userId,
      timestamp: new Date(),
      location: {
        latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
        longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
        address: 'Test Location',
        type: 'home'
      },
      activity: {
        current: 'idle',
        recent: ['reading', 'cooking'],
        duration: Math.floor(Math.random() * 60) + 15
      },
      availability: {
        freeTime: Math.floor(Math.random() * 180) + 30,
        nextCommitment: new Date(Date.now() + Math.random() * 7200000),
        energyLevel: Math.random()
      },
      mood: {
        current: 'neutral',
        confidence: 0.8
      },
      energy: Math.random(),
      social: {
        familyPresent: ['parent1'],
        guestsPresent: [],
        preferredSocialLevel: 'family'
      },
      environmental: {
        weather: 'sunny',
        temperature: 70 + Math.random() * 10,
        timeOfDay: 'afternoon',
        season: 'spring'
      },
      preferences: {
        activityTypes: ['outdoor', 'educational'],
        difficultyLevel: 'medium',
        duration: 'medium'
      }
    };
  }

  /**
   * Wait for system to recover between tests
   */
  private async waitForSystemRecovery(): Promise<void> {
    console.log('Waiting for system recovery...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Wait for memory to stabilize
    let stableCount = 0;
    let lastMemory = this.getMemoryUsage();

    while (stableCount < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const currentMemory = this.getMemoryUsage();
      
      if (Math.abs(currentMemory - lastMemory) < 10) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      lastMemory = currentMemory;
    }

    console.log('System recovery complete');
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  /**
   * Generate stress test report
   */
  generateReport(): string {
    if (this.testResults.length === 0) {
      return 'No stress test results available';
    }

    let report = '\n=== RECOMMENDATIONS ENGINE STRESS TEST REPORT ===\n\n';

    this.testResults.forEach((result, index) => {
      report += `Test ${index + 1} Results:\n`;
      report += `  Total Requests: ${result.totalRequests}\n`;
      report += `  Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%\n`;
      report += `  Average Latency: ${result.averageLatency.toFixed(2)}ms\n`;
      report += `  P95 Latency: ${result.p95Latency.toFixed(2)}ms\n`;
      report += `  P99 Latency: ${result.p99Latency.toFixed(2)}ms\n`;
      report += `  Peak Memory: ${result.peakMemoryUsage}MB\n`;
      report += `  Average Memory: ${result.averageMemoryUsage.toFixed(2)}MB\n`;
      report += `  Memory Leak Detected: ${result.memoryLeakDetected ? 'YES' : 'NO'}\n`;
      report += `  Throughput: ${result.throughputPerSecond.toFixed(2)} req/sec\n`;
      report += `  Error Rate: ${result.errorRate.toFixed(2)}%\n`;
      report += `  Performance Score: ${result.performanceScore}/100\n`;
      report += '\n';
    });

    // Overall assessment
    const avgPerformanceScore = this.testResults.reduce((sum, r) => sum + r.performanceScore, 0) / this.testResults.length;
    const maxMemoryUsage = Math.max(...this.testResults.map(r => r.peakMemoryUsage));
    const avgLatency = this.testResults.reduce((sum, r) => sum + r.averageLatency, 0) / this.testResults.length;

    report += '=== OVERALL ASSESSMENT ===\n';
    report += `Average Performance Score: ${avgPerformanceScore.toFixed(2)}/100\n`;
    report += `Maximum Memory Usage: ${maxMemoryUsage}MB (Limit: 1500MB)\n`;
    report += `Average Latency: ${avgLatency.toFixed(2)}ms (Limit: 2000ms)\n`;
    report += `Memory Constraint Compliance: ${maxMemoryUsage <= 1500 ? 'PASS' : 'FAIL'}\n`;
    report += `Latency Requirement Compliance: ${avgLatency <= 2000 ? 'PASS' : 'FAIL'}\n`;

    if (avgPerformanceScore >= 80) {
      report += 'Overall Assessment: EXCELLENT\n';
    } else if (avgPerformanceScore >= 60) {
      report += 'Overall Assessment: GOOD\n';
    } else if (avgPerformanceScore >= 40) {
      report += 'Overall Assessment: ACCEPTABLE\n';
    } else {
      report += 'Overall Assessment: NEEDS IMPROVEMENT\n';
    }

    return report;
  }
}

/**
 * Utility function to run quick performance validation
 */
export async function runQuickPerformanceValidation(
  controller: RecommendationController,
  performanceMonitor: PerformanceMonitor
): Promise<boolean> {
  const tester = new RecommendationStressTester(controller, performanceMonitor);
  
  const quickConfig: StressTestConfig = {
    maxUsers: 5,
    requestsPerUser: 5,
    concurrentBatches: 2,
    testDurationMs: 15000,
    memoryThresholdMB: 1500,
    latencyThresholdMs: 2000
  };

  const result = await tester.runStressTest(quickConfig);
  
  return result.performanceScore >= 70 && 
         result.peakMemoryUsage <= 1500 && 
         result.averageLatency <= 2000 &&
         result.errorRate <= 5;
}