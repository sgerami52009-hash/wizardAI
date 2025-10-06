/**
 * Performance Test Environment Setup
 * 
 * Configures the Jest environment for performance testing
 * with appropriate timeouts and resource monitoring.
 */

// Extend Jest timeout for performance tests
jest.setTimeout(900000); // 15 minutes

// Configure console output for performance tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Track performance metrics during tests
beforeAll(() => {
  // Initialize test-specific performance tracking
  (global as any).__TEST_PERFORMANCE_METRICS__ = {
    testStartTime: Date.now(),
    memorySnapshots: [],
    testLatencies: new Map()
  };

  // Override console methods to capture performance logs
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('latency:') || message.includes('memory:') || message.includes('performance:')) {
      const metrics = (global as any).__TEST_PERFORMANCE_METRICS__;
      if (metrics) {
        metrics.performanceLogs = metrics.performanceLogs || [];
        metrics.performanceLogs.push({
          timestamp: Date.now(),
          message
        });
      }
    }
    originalConsoleLog(...args);
  };
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;

  // Log final performance metrics
  const metrics = (global as any).__TEST_PERFORMANCE_METRICS__;
  if (metrics) {
    const testDuration = Date.now() - metrics.testStartTime;
    originalConsoleLog(`\n📊 Test Suite Performance Summary:`);
    originalConsoleLog(`   Duration: ${testDuration}ms`);
    originalConsoleLog(`   Memory Snapshots: ${metrics.memorySnapshots.length}`);
    originalConsoleLog(`   Performance Logs: ${(metrics.performanceLogs || []).length}`);
  }
});

// Helper function to track test performance
(global as any).trackTestPerformance = (testName: string, startTime: number) => {
  const metrics = (global as any).__TEST_PERFORMANCE_METRICS__;
  if (metrics) {
    const latency = Date.now() - startTime;
    metrics.testLatencies.set(testName, latency);
    
    // Take memory snapshot
    const memUsage = process.memoryUsage();
    metrics.memorySnapshots.push({
      testName,
      timestamp: Date.now(),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    });
  }
};

// Helper function to assert performance requirements
(global as any).assertPerformanceRequirements = (testName: string, requirements: {
  maxLatencyMs?: number;
  maxMemoryMB?: number;
}) => {
  const metrics = (global as any).__TEST_PERFORMANCE_METRICS__;
  if (!metrics) return;

  const latency = metrics.testLatencies.get(testName);
  const memorySnapshot = metrics.memorySnapshots
    .filter((s: any) => s.testName === testName)
    .pop();

  if (requirements.maxLatencyMs && latency) {
    expect(latency).toBeLessThan(requirements.maxLatencyMs);
  }

  if (requirements.maxMemoryMB && memorySnapshot) {
    expect(memorySnapshot.heapUsed).toBeLessThan(requirements.maxMemoryMB);
  }
};

// Global error handler for performance tests
process.on('unhandledRejection', (reason, promise) => {
  originalConsoleError('Unhandled Rejection at:', promise, 'reason:', reason);
  
  const metrics = (global as any).__PERFORMANCE_METRICS__;
  if (metrics) {
    metrics.errors = metrics.errors || [];
    metrics.errors.push({
      type: 'unhandledRejection',
      reason: reason?.toString(),
      timestamp: Date.now()
    });
  }
});

process.on('uncaughtException', (error) => {
  originalConsoleError('Uncaught Exception:', error);
  
  const metrics = (global as any).__PERFORMANCE_METRICS__;
  if (metrics) {
    metrics.errors = metrics.errors || [];
    metrics.errors.push({
      type: 'uncaughtException',
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });
  }
});

// Export performance testing utilities
export const PerformanceTestUtils = {
  /**
   * Measure execution time of an async function
   */
  async measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    return { result, duration };
  },

  /**
   * Measure execution time of a sync function
   */
  measure<T>(fn: () => T): { result: T; duration: number } {
    const startTime = Date.now();
    const result = fn();
    const duration = Date.now() - startTime;
    return { result, duration };
  },

  /**
   * Get current memory usage in MB
   */
  getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024);
  },

  /**
   * Wait for memory to stabilize
   */
  async waitForMemoryStabilization(maxWaitMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    let stableCount = 0;
    let lastMemory = this.getMemoryUsage();

    while (Date.now() - startTime < maxWaitMs && stableCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const currentMemory = this.getMemoryUsage();
      
      if (Math.abs(currentMemory - lastMemory) < 5) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      
      lastMemory = currentMemory;
    }
  },

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }
};