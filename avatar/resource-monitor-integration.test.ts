/**
 * Integration test for ResourceMonitor
 * Tests the core functionality without complex Jest setup
 */

import { ResourceMonitor } from './resource-monitor';

async function testResourceMonitor() {
  console.log('Starting ResourceMonitor integration test...');
  
  const monitor = new ResourceMonitor({
    maxGPUMemoryGB: 2.0,
    maxCPUUsage: 70,
    minFPS: 45,
    maxRenderTime: 22,
    criticalGPUMemoryGB: 1.8,
    criticalCPUUsage: 85,
    criticalFPS: 30,
    maxMemoryUsageGB: 6.0,
    maxGPUTemperature: 80,
    maxCPUTemperature: 85
  });

  let metricsReceived = false;
  let alertsReceived = false;
  let healthStatusReceived = false;

  // Set up event listeners
  monitor.on('monitoringStarted', () => {
    console.log('✓ Monitoring started successfully');
  });

  monitor.on('metricsUpdate', (metrics) => {
    console.log('✓ Metrics update received:', {
      timestamp: new Date(metrics.timestamp).toISOString(),
      gpuMemory: `${metrics.gpu.memoryUsageGB.toFixed(2)}GB`,
      cpuUsage: `${metrics.cpu.usagePercent.toFixed(1)}%`,
      fps: `${metrics.rendering.currentFPS.toFixed(1)}`,
      renderTime: `${metrics.rendering.renderTime.toFixed(2)}ms`
    });
    metricsReceived = true;
  });

  monitor.on('performanceAlert', (alert) => {
    console.log('✓ Performance alert received:', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message
    });
    alertsReceived = true;
  });

  monitor.on('healthStatusUpdate', (status) => {
    console.log('✓ Health status update:', {
      overall: status.overall,
      score: status.score.toFixed(1),
      componentCount: Object.keys(status.components).length
    });
    healthStatusReceived = true;
  });

  monitor.on('error', (error) => {
    console.error('✗ Monitor error:', error.message);
  });

  try {
    // Start monitoring
    await monitor.startMonitoring();
    
    // Wait for metrics collection
    console.log('Waiting for metrics collection...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Test current metrics
    const currentMetrics = monitor.getCurrentMetrics();
    if (currentMetrics) {
      console.log('✓ Current metrics available');
      console.log('  GPU Memory:', `${currentMetrics.gpu.memoryUsageGB.toFixed(2)}GB`);
      console.log('  CPU Usage:', `${currentMetrics.cpu.usagePercent.toFixed(1)}%`);
      console.log('  FPS:', currentMetrics.rendering.currentFPS.toFixed(1));
    } else {
      console.log('✗ No current metrics available');
    }

    // Test average metrics
    const avgMetrics = monitor.getAverageMetrics(2000);
    if (avgMetrics) {
      console.log('✓ Average metrics calculated');
    } else {
      console.log('✗ Average metrics not available');
    }

    // Test performance trends
    const trends = monitor.getPerformanceTrends(2000);
    console.log('✓ Performance trends:', trends.length, 'data points');

    // Test system health
    const healthStatus = monitor.getSystemHealthStatus();
    console.log('✓ System health status:', healthStatus.overall, `(${healthStatus.score.toFixed(1)})`);

    // Test optimization recommendations
    const recommendations = monitor.generateOptimizationRecommendations();
    console.log('✓ Optimization recommendations:', recommendations.length, 'items');

    // Test threshold updates
    monitor.updateThresholds({ maxGPUMemoryGB: 1.5 });
    const updatedThresholds = monitor.getThresholds();
    console.log('✓ Thresholds updated:', updatedThresholds.maxGPUMemoryGB, 'GB');

    // Test data export
    const exportedData = monitor.exportMetrics();
    console.log('✓ Data export:', exportedData.length, 'metrics entries');

    // Stop monitoring
    await monitor.stopMonitoring();
    console.log('✓ Monitoring stopped successfully');

    // Validate test results
    console.log('\n=== Test Results ===');
    console.log('Metrics received:', metricsReceived ? '✓' : '✗');
    console.log('Health status received:', healthStatusReceived ? '✓' : '✗');
    console.log('Current metrics available:', currentMetrics ? '✓' : '✗');
    console.log('Average metrics calculated:', avgMetrics ? '✓' : '✗');
    console.log('Performance trends available:', trends.length > 0 ? '✓' : '✗');
    console.log('System health calculated:', healthStatus.overall !== 'unknown' ? '✓' : '✗');
    console.log('Data export working:', exportedData.length > 0 ? '✓' : '✗');

    const allTestsPassed = metricsReceived && healthStatusReceived && 
                          currentMetrics && avgMetrics && 
                          trends.length > 0 && healthStatus.overall !== 'unknown' && 
                          exportedData.length > 0;

    if (allTestsPassed) {
      console.log('\n🎉 All ResourceMonitor integration tests passed!');
      return true;
    } else {
      console.log('\n❌ Some ResourceMonitor tests failed');
      return false;
    }

  } catch (error) {
    console.error('✗ Integration test failed:', error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testResourceMonitor()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testResourceMonitor };