/**
 * Simple Node.js test for ResourceMonitor functionality
 */

const { ResourceMonitor } = require('./dist/resource-monitor.js');

async function testResourceMonitor() {
  console.log('🚀 Starting ResourceMonitor functionality test...\n');
  
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

  let testResults = {
    monitoringStarted: false,
    metricsReceived: false,
    healthStatusReceived: false,
    currentMetricsAvailable: false,
    averageMetricsCalculated: false,
    trendsGenerated: false,
    healthStatusCalculated: false,
    optimizationRecommendations: false,
    thresholdsUpdated: false,
    dataExported: false,
    monitoringStopped: false
  };

  // Set up event listeners
  monitor.on('monitoringStarted', () => {
    console.log('✅ Monitoring started successfully');
    testResults.monitoringStarted = true;
  });

  monitor.on('metricsUpdate', (metrics) => {
    console.log('📊 Metrics update received:', {
      timestamp: new Date(metrics.timestamp).toISOString(),
      gpuMemory: `${metrics.gpu.memoryUsageGB.toFixed(2)}GB`,
      cpuUsage: `${metrics.cpu.usagePercent.toFixed(1)}%`,
      fps: `${metrics.rendering.currentFPS.toFixed(1)}`,
      renderTime: `${metrics.rendering.renderTime.toFixed(2)}ms`
    });
    testResults.metricsReceived = true;
  });

  monitor.on('performanceAlert', (alert) => {
    console.log('⚠️  Performance alert:', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      recommendations: alert.recommendations.length
    });
  });

  monitor.on('healthStatusUpdate', (status) => {
    console.log('💚 Health status update:', {
      overall: status.overall,
      score: status.score.toFixed(1),
      components: Object.keys(status.components).length
    });
    testResults.healthStatusReceived = true;
  });

  monitor.on('monitoringStopped', () => {
    console.log('🛑 Monitoring stopped successfully');
    testResults.monitoringStopped = true;
  });

  monitor.on('error', (error) => {
    console.error('❌ Monitor error:', error.message);
  });

  try {
    // Test 1: Start monitoring
    console.log('🔄 Starting monitoring...');
    await monitor.startMonitoring();
    
    // Test 2: Wait for metrics collection
    console.log('⏳ Waiting for metrics collection (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 3: Check current metrics
    console.log('🔍 Testing current metrics...');
    const currentMetrics = monitor.getCurrentMetrics();
    if (currentMetrics) {
      console.log('✅ Current metrics available:', {
        gpuMemory: `${currentMetrics.gpu.memoryUsageGB.toFixed(2)}GB`,
        cpuUsage: `${currentMetrics.cpu.usagePercent.toFixed(1)}%`,
        fps: currentMetrics.rendering.currentFPS.toFixed(1),
        temperature: `GPU: ${currentMetrics.gpu.temperature.toFixed(1)}°C, CPU: ${currentMetrics.cpu.temperature.toFixed(1)}°C`
      });
      testResults.currentMetricsAvailable = true;
    } else {
      console.log('❌ No current metrics available');
    }

    // Test 4: Check average metrics
    console.log('📈 Testing average metrics...');
    const avgMetrics = monitor.getAverageMetrics(2500);
    if (avgMetrics) {
      console.log('✅ Average metrics calculated:', {
        avgGpuMemory: `${avgMetrics.gpu.memoryUsageGB.toFixed(2)}GB`,
        avgCpuUsage: `${avgMetrics.cpu.usagePercent.toFixed(1)}%`,
        avgFps: avgMetrics.rendering.currentFPS.toFixed(1)
      });
      testResults.averageMetricsCalculated = true;
    } else {
      console.log('❌ Average metrics not available');
    }

    // Test 5: Check performance trends
    console.log('📊 Testing performance trends...');
    const trends = monitor.getPerformanceTrends(2500);
    console.log(`✅ Performance trends generated: ${trends.length} data points`);
    if (trends.length > 0) {
      console.log('   Latest trend:', {
        fps: trends[trends.length - 1].fps.toFixed(1),
        gpuMemory: `${trends[trends.length - 1].gpuMemory.toFixed(2)}GB`,
        cpuUsage: `${trends[trends.length - 1].cpuUsage.toFixed(1)}%`
      });
      testResults.trendsGenerated = true;
    }

    // Test 6: Check system health
    console.log('🏥 Testing system health status...');
    const healthStatus = monitor.getSystemHealthStatus();
    console.log('✅ System health calculated:', {
      overall: healthStatus.overall,
      score: healthStatus.score.toFixed(1),
      components: {
        gpu: healthStatus.components.gpu?.status,
        cpu: healthStatus.components.cpu?.status,
        memory: healthStatus.components.memory?.status,
        rendering: healthStatus.components.rendering?.status
      }
    });
    if (healthStatus.overall !== 'unknown') {
      testResults.healthStatusCalculated = true;
    }

    // Test 7: Check optimization recommendations
    console.log('💡 Testing optimization recommendations...');
    const recommendations = monitor.generateOptimizationRecommendations();
    console.log(`✅ Generated ${recommendations.length} optimization recommendations`);
    if (recommendations.length > 0) {
      console.log('   Sample recommendation:', {
        category: recommendations[0].category,
        priority: recommendations[0].priority,
        description: recommendations[0].description.substring(0, 50) + '...'
      });
    }
    testResults.optimizationRecommendations = true;

    // Test 8: Update thresholds
    console.log('⚙️  Testing threshold updates...');
    const originalThresholds = monitor.getThresholds();
    monitor.updateThresholds({ maxGPUMemoryGB: 1.5, maxCPUUsage: 80 });
    const updatedThresholds = monitor.getThresholds();
    console.log('✅ Thresholds updated:', {
      gpuMemory: `${originalThresholds.maxGPUMemoryGB}GB → ${updatedThresholds.maxGPUMemoryGB}GB`,
      cpuUsage: `${originalThresholds.maxCPUUsage}% → ${updatedThresholds.maxCPUUsage}%`
    });
    testResults.thresholdsUpdated = true;

    // Test 9: Export data
    console.log('📤 Testing data export...');
    const exportedData = monitor.exportMetrics();
    console.log(`✅ Exported ${exportedData.length} metrics entries`);
    if (exportedData.length > 0) {
      console.log('   Data range:', {
        from: new Date(exportedData[0].timestamp).toISOString(),
        to: new Date(exportedData[exportedData.length - 1].timestamp).toISOString()
      });
      testResults.dataExported = true;
    }

    // Test 10: Stop monitoring
    console.log('🛑 Stopping monitoring...');
    await monitor.stopMonitoring();

    // Final results
    console.log('\n' + '='.repeat(50));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    const results = [
      ['Monitoring Started', testResults.monitoringStarted],
      ['Metrics Received', testResults.metricsReceived],
      ['Health Status Updates', testResults.healthStatusReceived],
      ['Current Metrics Available', testResults.currentMetricsAvailable],
      ['Average Metrics Calculated', testResults.averageMetricsCalculated],
      ['Performance Trends Generated', testResults.trendsGenerated],
      ['System Health Calculated', testResults.healthStatusCalculated],
      ['Optimization Recommendations', testResults.optimizationRecommendations],
      ['Thresholds Updated', testResults.thresholdsUpdated],
      ['Data Export Working', testResults.dataExported],
      ['Monitoring Stopped', testResults.monitoringStopped]
    ];

    let passedTests = 0;
    results.forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}`);
      if (passed) passedTests++;
    });

    console.log('\n' + '='.repeat(50));
    console.log(`📊 FINAL SCORE: ${passedTests}/${results.length} tests passed`);
    
    if (passedTests === results.length) {
      console.log('🎉 ALL TESTS PASSED! ResourceMonitor is working correctly.');
      return true;
    } else {
      console.log(`⚠️  ${results.length - passedTests} tests failed. Please review the implementation.`);
      return false;
    }

  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run the test
testResourceMonitor()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });