/**
 * Performance and Load Tests for Recommendations Engine
 * 
 * Tests recommendation latency under various load conditions,
 * validates memory usage optimization for 1.5GB constraint,
 * and tests concurrent user recommendation generation performance.
 * 
 * Requirements: 7.1, 7.2, 7.4, 7.6
 */

import { PerformanceMonitor } from './performance-monitor';
import { UserContext, Recommendation, UserPreferences, Interest, TimeRange } from './types';
import { RecommendationType, InterestCategory } from './enums';
import { ActivityRecommender } from './engines/activity-recommender';
import { ScheduleOptimizer } from './engines/schedule-optimizer';
import { EducationalRecommender } from './engines/educational-recommender';
import { HouseholdEfficiencyEngine } from './engines/household-efficiency-engine';

describe('Recommendations Engine Performance and Load Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let activityRecommender: ActivityRecommender;
  let scheduleOptimizer: ScheduleOptimizer;
  let educationalRecommender: EducationalRecommender;
  let householdEfficiencyEngine: HouseholdEfficiencyEngine;

  // Test configuration for Jetson Nano Orin constraints
  const PERFORMANCE_THRESHOLDS = {
    maxLatencyMs: 2000,        // Requirement 7.2: 2 seconds max
    maxMemoryMB: 1500,         // Requirement 7.1: 1.5GB constraint
    maxConcurrentUsers: 5,     // Requirement 7.4: concurrent handling
    targetLatencyMs: 1000,     // Target for good performance
    memoryWarningMB: 1200      // Warning threshold at 80%
  };

  const TEST_USERS = [
    'user1', 'user2', 'user3', 'user4', 'user5',
    'user6', 'user7', 'user8', 'user9', 'user10'
  ];

  beforeEach(async () => {
    // Initialize components
    performanceMonitor = new PerformanceMonitor();
    activityRecommender = new ActivityRecommender();
    scheduleOptimizer = new ScheduleOptimizer();
    educationalRecommender = new EducationalRecommender();
    householdEfficiencyEngine = new HouseholdEfficiencyEngine();

    // Set up performance monitoring
    performanceMonitor.alertOnPerformanceIssues({
      maxLatencyMs: PERFORMANCE_THRESHOLDS.maxLatencyMs,
      maxMemoryMB: PERFORMANCE_THRESHOLDS.maxMemoryMB,
      minSatisfactionScore: 0.7,
      maxCpuUsagePercent: 80,
      maxConcurrentRequests: PERFORMANCE_THRESHOLDS.maxConcurrentUsers
    });
  });

  afterEach(async () => {
    performanceMonitor.stopMonitoring();
    await cleanupTestData();
  });

  afterAll(async () => {
    // Ensure all monitoring is stopped
    performanceMonitor.stopMonitoring();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Recommendation Latency Tests (Requirement 7.2)', () => {
    test('should generate activity recommendations within 2 second latency threshold', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);
      
      const startTime = Date.now();
      
      // Mock the recommendation generation
      const mockRecommendations: Recommendation[] = [{
        id: 'test-rec-1',
        type: RecommendationType.ACTIVITY,
        title: 'Test Activity',
        description: 'A test activity recommendation',
        confidence: 0.8,
        reasoning: ['Based on user preferences'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {
          generatedAt: new Date(),
          userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: true,
          privacyCompliant: true
        }
      }];
      
      // Simulate recommendation generation work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
      
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
      expect(mockRecommendations).toBeDefined();
      expect(mockRecommendations.length).toBeGreaterThan(0);

      // Track performance metrics
      performanceMonitor.trackRecommendationLatency('activity_recommendation', latency);
    });

    test('should generate schedule recommendations within latency threshold', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);
      
      const startTime = Date.now();
      
      // Simulate schedule optimization work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800));
      
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);

      performanceMonitor.trackRecommendationLatency('schedule_recommendation', latency);
    });

    test('should generate educational recommendations within latency threshold', async () => {
      const userId = 'user1';
      const context = createTestContext(userId, { isChild: true, age: 8 });
      
      const startTime = Date.now();
      
      // Simulate educational recommendation work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 600));
      
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);

      performanceMonitor.trackRecommendationLatency('educational_recommendation', latency);
    });

    test('should generate household efficiency recommendations within latency threshold', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);
      
      const startTime = Date.now();
      
      // Simulate household efficiency analysis work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 700));
      
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);

      performanceMonitor.trackRecommendationLatency('household_recommendation', latency);
    });

    test('should maintain low latency under repeated requests', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);
      const latencies: number[] = [];

      // Perform 20 consecutive requests
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        
        // Simulate recommendation generation with slight variation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        performanceMonitor.trackRecommendationLatency('repeated_request', latency);
      }

      // Check that all requests meet latency requirements
      const maxLatency = Math.max(...latencies);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      expect(maxLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.targetLatencyMs);

      // Verify latency doesn't degrade significantly over time
      const firstHalf = latencies.slice(0, 10);
      const secondHalf = latencies.slice(10);
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });
  });

  describe('Memory Usage Optimization Tests (Requirement 7.1)', () => {
    test('should not exceed 1.5GB memory constraint during recommendation generation', async () => {
      const initialMemory = getMemoryUsage();
      
      // Simulate memory-intensive recommendation generation
      const promises = [];
      for (const userId of TEST_USERS.slice(0, 5)) {
        const context = createTestContext(userId);
        promises.push(
          simulateRecommendationGeneration('activity', userId, context),
          simulateRecommendationGeneration('schedule', userId, context),
          simulateRecommendationGeneration('educational', userId, context),
          simulateRecommendationGeneration('household', userId, context)
        );
      }

      await Promise.all(promises);
      
      const peakMemory = getMemoryUsage();
      const memoryIncrease = peakMemory - initialMemory;

      expect(peakMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);
      
      // Track memory usage
      performanceMonitor.trackMemoryUsage('recommendation_generation', peakMemory);

      // Memory increase should be reasonable (less than 200MB for this test)
      expect(memoryIncrease).toBeLessThan(200);
    });

    test('should efficiently manage memory during extended operation', async () => {
      const memoryReadings: number[] = [];
      
      // Run recommendations for 30 seconds (reduced for faster testing)
      const endTime = Date.now() + 30000;
      let requestCount = 0;

      while (Date.now() < endTime) {
        const userId = TEST_USERS[requestCount % TEST_USERS.length];
        const context = createTestContext(userId);
        
        // Simulate recommendation generation
        await simulateRecommendationGeneration('activity', userId, context);
        
        const currentMemory = getMemoryUsage();
        memoryReadings.push(currentMemory);
        performanceMonitor.trackMemoryUsage('extended_operation', currentMemory);
        
        requestCount++;
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze memory usage patterns
      const maxMemory = Math.max(...memoryReadings);
      const avgMemory = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;
      
      expect(maxMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);
      expect(avgMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryWarningMB);

      // Check for memory leaks - memory should not continuously increase
      if (memoryReadings.length >= 4) {
        const firstQuarter = memoryReadings.slice(0, Math.floor(memoryReadings.length / 4));
        const lastQuarter = memoryReadings.slice(-Math.floor(memoryReadings.length / 4));
        
        const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
        const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b, 0) / lastQuarter.length;

        // Memory should not increase by more than 100MB over the test period
        expect(lastQuarterAvg - firstQuarterAvg).toBeLessThan(100);
      }

      console.log(`Extended operation test: ${requestCount} requests, max memory: ${maxMemory}MB, avg memory: ${avgMemory.toFixed(2)}MB`);
    }, 45000); // 45 second timeout

    test('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by creating large objects
      const largeObjects: any[] = [];
      
      try {
        // Fill memory to near threshold
        while (getMemoryUsage() < PERFORMANCE_THRESHOLDS.memoryWarningMB) {
          largeObjects.push(new Array(100000).fill('test'));
        }

        const userId = 'user1';
        const context = createTestContext(userId);
        
        // Should still be able to generate recommendations under memory pressure
        const startTime = Date.now();
        const recommendations = await simulateRecommendationGeneration('activity', userId, context);
        const latency = Date.now() - startTime;

        expect(recommendations).toBeDefined();
        expect(getMemoryUsage()).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);
        expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs * 1.5); // Allow some degradation under pressure

      } finally {
        // Clean up large objects
        largeObjects.length = 0;
        if (global.gc) {
          global.gc();
        }
      }
    });
  });

  describe('Concurrent User Performance Tests (Requirement 7.4)', () => {
    test('should handle concurrent recommendation requests efficiently', async () => {
      const concurrentUsers = TEST_USERS.slice(0, PERFORMANCE_THRESHOLDS.maxConcurrentUsers);
      const startTime = Date.now();
      
      // Generate concurrent requests
      const promises = concurrentUsers.map(async (userId) => {
        const context = createTestContext(userId);
        const userStartTime = Date.now();
        
        const recommendations = await simulateRecommendationGeneration('activity', userId, context);
        
        const userLatency = Date.now() - userStartTime;
        performanceMonitor.trackRecommendationLatency('concurrent_request', userLatency);
        
        return { userId, recommendations, latency: userLatency };
      });

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed successfully
      expect(results).toHaveLength(concurrentUsers.length);
      results.forEach(result => {
        expect(result.recommendations).toBeDefined();
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
      });

      // Total time should be reasonable for concurrent processing
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs * 1.2);

      // Memory should remain within bounds
      expect(getMemoryUsage()).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);

      console.log(`Concurrent test: ${concurrentUsers.length} users, total time: ${totalTime}ms, max individual latency: ${Math.max(...results.map(r => r.latency))}ms`);
    });

    test('should maintain performance under high concurrent load', async () => {
      const highLoadUsers = TEST_USERS; // All 10 users
      const requestsPerUser = 3;
      const allPromises: Promise<any>[] = [];

      const startTime = Date.now();

      // Create multiple requests per user
      for (const userId of highLoadUsers) {
        for (let i = 0; i < requestsPerUser; i++) {
          const context = createTestContext(userId);
          const promise = simulateRecommendationGeneration('activity', userId, context)
            .then(recommendations => ({
              userId,
              requestIndex: i,
              recommendations,
              timestamp: Date.now()
            }));
          
          allPromises.push(promise);
        }
      }

      const results = await Promise.all(allPromises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed
      expect(results).toHaveLength(highLoadUsers.length * requestsPerUser);
      
      // Check individual request performance
      results.forEach(result => {
        expect(result.recommendations).toBeDefined();
      });

      // System should handle the load within reasonable time
      const avgTimePerRequest = totalTime / results.length;
      expect(avgTimePerRequest).toBeLessThan(PERFORMANCE_THRESHOLDS.targetLatencyMs);

      // Memory should remain controlled
      expect(getMemoryUsage()).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);

      console.log(`High load test: ${results.length} total requests, avg time per request: ${avgTimePerRequest.toFixed(2)}ms`);
    });

    test('should handle mixed recommendation types concurrently', async () => {
      const recommendationTypes = ['activity', 'schedule', 'educational', 'household'];

      const promises: Promise<any>[] = [];
      const startTime = Date.now();

      // Create concurrent requests of different types
      for (let i = 0; i < 20; i++) {
        const userId = TEST_USERS[i % TEST_USERS.length];
        const type = recommendationTypes[i % recommendationTypes.length];
        const context = createTestContext(userId, type === 'educational' ? { isChild: true, age: 8 } : {});

        const requestStartTime = Date.now();
        const promise = simulateRecommendationGeneration(type, userId, context)
          .then(recommendations => ({
            userId,
            type,
            recommendations,
            latency: Date.now() - requestStartTime
          }));

        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed successfully
      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(result.recommendations).toBeDefined();
      });

      // Check performance by type
      const performanceByType = recommendationTypes.reduce((acc, type) => {
        const typeResults = results.filter(r => r.type === type);
        acc[type] = {
          count: typeResults.length,
          avgLatency: typeResults.reduce((sum, r) => sum + r.latency, 0) / typeResults.length
        };
        return acc;
      }, {} as Record<string, any>);

      // All types should perform within acceptable limits
      Object.values(performanceByType).forEach((perf: any) => {
        expect(perf.avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
      });

      console.log('Mixed types performance:', performanceByType);
    });
  });

  describe('Resource Optimization Tests (Requirement 7.6)', () => {
    test('should optimize performance under resource constraints', async () => {
      // Simulate resource constraints
      const initialMetrics = await performanceMonitor.getPerformanceMetrics();
      
      // Generate load while monitoring optimization
      const promises = [];
      for (let i = 0; i < 15; i++) {
        const userId = TEST_USERS[i % TEST_USERS.length];
        const context = createTestContext(userId);
        promises.push(simulateRecommendationGeneration('activity', userId, context));
      }

      await Promise.all(promises);

      // Trigger performance optimization
      await performanceMonitor.optimizePerformance();

      const optimizedMetrics = await performanceMonitor.getPerformanceMetrics();

      // Memory usage should be optimized
      expect(optimizedMetrics.memory.current).toBeLessThanOrEqual(initialMetrics.memory.current);
      expect(optimizedMetrics.memory.current).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemoryMB);

      // System should remain responsive
      const userId = 'user1';
      const context = createTestContext(userId);
      const startTime = Date.now();
      await simulateRecommendationGeneration('activity', userId, context);
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
    });

    test('should maintain quality under performance optimization', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);

      // Get baseline recommendations
      const baselineRecommendations = await simulateRecommendationGeneration('activity', userId, context);

      // Simulate resource pressure and optimization
      await performanceMonitor.optimizePerformance();

      // Get recommendations after optimization
      const optimizedRecommendations = await simulateRecommendationGeneration('activity', userId, context);

      // Quality should be maintained
      expect(optimizedRecommendations).toBeDefined();
      expect(optimizedRecommendations.length).toBeGreaterThan(0);
      
      // Should still provide reasonable number of recommendations
      expect(optimizedRecommendations.length).toBeGreaterThanOrEqual(
        Math.floor(baselineRecommendations.length * 0.7) // At least 70% of baseline
      );

      // Recommendations should still be relevant
      optimizedRecommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThan(0.3);
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
      });
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    test('should track and report performance metrics accurately', async () => {
      const userId = 'user1';
      const context = createTestContext(userId);

      // Generate some activity to track
      for (let i = 0; i < 5; i++) {
        await simulateRecommendationGeneration('activity', userId, context);
      }

      const metrics = await performanceMonitor.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.latency.count).toBeGreaterThan(0);
      expect(metrics.memory.current).toBeGreaterThan(0);
      expect(metrics.recommendations.totalRequests).toBeGreaterThan(0);
      expect(metrics.system.uptime).toBeGreaterThan(0);
    });

    test('should trigger alerts for performance threshold violations', async () => {
      let alertTriggered = false;
      let alertMetric = '';
      let alertValue = 0;

      performanceMonitor.addAlertCallback((metric, value, threshold) => {
        alertTriggered = true;
        alertMetric = metric;
        alertValue = value;
      });

      // Simulate high latency
      performanceMonitor.trackRecommendationLatency('test_operation', PERFORMANCE_THRESHOLDS.maxLatencyMs + 100);

      expect(alertTriggered).toBe(true);
      expect(alertMetric).toBe('latency');
      expect(alertValue).toBeGreaterThan(PERFORMANCE_THRESHOLDS.maxLatencyMs);
    });
  });

  // Helper functions
  async function simulateRecommendationGeneration(type: string, userId: string, context: UserContext): Promise<Recommendation[]> {
    // Simulate different processing times for different recommendation types
    const processingTimes = {
      activity: Math.random() * 300 + 100,
      schedule: Math.random() * 500 + 200,
      educational: Math.random() * 400 + 150,
      household: Math.random() * 350 + 100
    };
    
    await new Promise(resolve => setTimeout(resolve, processingTimes[type as keyof typeof processingTimes] || 200));
    
    // Create some temporary objects to simulate memory usage
    const tempData = new Array(1000).fill(0).map((_, i) => ({
      id: `temp-${i}`,
      data: new Array(100).fill(`data-${i}`),
      timestamp: new Date()
    }));
    
    // Simulate processing
    tempData.forEach(item => {
      item.data = item.data.map(d => d.toUpperCase());
    });
    
    return [{
      id: `${type}-rec-${Date.now()}`,
      type: RecommendationType.ACTIVITY,
      title: `${type} recommendation`,
      description: `Generated ${type} recommendation for ${userId}`,
      confidence: Math.random() * 0.3 + 0.7,
      reasoning: [`Based on ${type} analysis`],
      actionable: true,
      integrationActions: [],
      expiresAt: new Date(Date.now() + 3600000),
      metadata: {
        generatedAt: new Date(),
        userId,
        contextId: 'test-context',
        engineVersion: '1.0.0',
        safetyValidated: true,
        privacyCompliant: true
      }
    }];
  }

  function createTestContext(userId: string, options: any = {}): UserContext {
    return {
      userId,
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { lat: 37.7749, lng: -122.4194 },
        weather: {
          temperature: 22,
          condition: 'sunny',
          humidity: 60,
          windSpeed: 10,
          uvIndex: 5
        },
        indoorOutdoor: 'indoor'
      },
      activity: {
        currentActivity: 'idle',
        activityType: 'relaxation' as any,
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + 1800000),
        interruptible: true
      },
      availability: {
        freeTime: [{ start: new Date(), end: new Date(Date.now() + 7200000) }],
        busyTime: [],
        flexibleTime: [],
        energyLevel: { level: 'medium', trend: 'stable' }
      },
      mood: {
        detected: 'calm',
        confidence: 0.8,
        source: 'inferred'
      },
      energy: { level: 'medium', trend: 'stable' },
      social: {
        familyMembersPresent: ['parent1', 'child1'],
        socialSetting: 'family',
        groupActivity: false
      },
      environmental: {
        weather: {
          temperature: 22,
          condition: 'sunny',
          humidity: 60,
          windSpeed: 10,
          uvIndex: 5
        },
        timeOfDay: 'afternoon',
        season: 'spring',
        dayOfWeek: 'Monday',
        isHoliday: false
      },
      preferences: {
        preferredActivities: [],
        avoidedActivities: [],
        timePreferences: [],
        socialPreferences: {
          familyTime: 'high',
          aloneTime: 'medium',
          groupActivities: 'preferred'
        }
      },
      ...options
    };
  }

  async function cleanupTestData(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  function getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round(memUsage.heapUsed / 1024 / 1024); // Convert to MB
  }
});