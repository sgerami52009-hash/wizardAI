/**
 * Global Setup for Performance Tests
 * 
 * Initializes the test environment for performance testing
 * with proper resource monitoring and system preparation.
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Setting up performance test environment...\n');

  // Log system information
  logSystemInformation();

  // Prepare test environment
  await prepareTestEnvironment();

  // Initialize performance monitoring
  initializePerformanceMonitoring();

  // Warm up the system
  await warmUpSystem();

  console.log('✅ Performance test environment ready\n');
}

function logSystemInformation(): void {
  console.log('📊 System Information:');
  console.log(`   Platform: ${os.platform()}`);
  console.log(`   Architecture: ${os.arch()}`);
  console.log(`   CPU Cores: ${os.cpus().length}`);
  console.log(`   Total Memory: ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)}GB`);
  console.log(`   Free Memory: ${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)}GB`);
  console.log(`   Node.js Version: ${process.version}`);
  console.log(`   Process PID: ${process.pid}`);
  console.log('');
}

async function prepareTestEnvironment(): Promise<void> {
  console.log('🔧 Preparing test environment...');

  // Create test reports directory
  const reportsDir = path.join(process.cwd(), 'test-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log('   Created test reports directory');
  }

  // Set environment variables for performance testing
  process.env.NODE_ENV = 'test';
  process.env.PERFORMANCE_TEST = 'true';
  process.env.LOG_LEVEL = 'error'; // Reduce logging noise during tests

  // Increase memory limits if possible
  if (process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS += ' --max-old-space-size=4096';
  } else {
    process.env.NODE_OPTIONS = '--max-old-space-size=4096';
  }

  console.log('   Environment variables configured');
}

function initializePerformanceMonitoring(): void {
  console.log('📈 Initializing performance monitoring...');

  // Store initial memory usage
  const initialMemory = process.memoryUsage();
  (global as any).__PERFORMANCE_TEST_INITIAL_MEMORY__ = initialMemory;

  // Store initial time
  (global as any).__PERFORMANCE_TEST_START_TIME__ = Date.now();

  // Initialize performance metrics collection
  (global as any).__PERFORMANCE_METRICS__ = {
    memoryReadings: [],
    cpuReadings: [],
    testLatencies: [],
    errors: []
  };

  // Start system monitoring
  const monitoringInterval = setInterval(() => {
    const metrics = (global as any).__PERFORMANCE_METRICS__;
    if (metrics) {
      metrics.memoryReadings.push({
        timestamp: Date.now(),
        usage: process.memoryUsage()
      });
    }
  }, 5000); // Every 5 seconds

  (global as any).__PERFORMANCE_MONITORING_INTERVAL__ = monitoringInterval;

  console.log('   Performance monitoring started');
}

async function warmUpSystem(): Promise<void> {
  console.log('🔥 Warming up system...');

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    console.log('   Garbage collection performed');
  }

  // Warm up V8 engine with some operations
  const warmupOperations = 1000;
  const startTime = Date.now();
  
  for (let i = 0; i < warmupOperations; i++) {
    // Perform various operations to warm up the engine
    const obj = { id: i, data: new Array(100).fill(i) };
    JSON.stringify(obj);
    JSON.parse(JSON.stringify(obj));
  }

  const warmupTime = Date.now() - startTime;
  console.log(`   System warmed up in ${warmupTime}ms`);

  // Wait a moment for system to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Handle cleanup on process exit
process.on('exit', () => {
  const interval = (global as any).__PERFORMANCE_MONITORING_INTERVAL__;
  if (interval) {
    clearInterval(interval);
  }
});

process.on('SIGINT', () => {
  const interval = (global as any).__PERFORMANCE_MONITORING_INTERVAL__;
  if (interval) {
    clearInterval(interval);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  const interval = (global as any).__PERFORMANCE_MONITORING_INTERVAL__;
  if (interval) {
    clearInterval(interval);
  }
  process.exit(1);
});