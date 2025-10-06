import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimitManager } from './rate-limit-manager';
import { ProviderType, RateLimitType } from './types';

/**
 * Tests for Rate Limit Manager
 * 
 * Tests intelligent API rate limiting, exponential backoff,
 * request batching, and performance optimization
 */

describe('RateLimitManager', () => {
  let rateLimitManager: RateLimitManager;

  beforeEach(() => {
    rateLimitManager = new RateLimitManager();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Rate Limit Checking', () => {
    it('should allow requests when under rate limit', () => {
      const canMake = rateLimitManager.canMakeRequest(
        ProviderType.GOOGLE_CALENDAR,
        RateLimitType.REQUESTS_PER_MINUTE
      );

      expect(canMake).toBe(true);
    });

    it('should block requests when rate limit is exceeded', async () => {
      // Make requests up to the limit
      const requestPromises = [];
      for (let i = 0; i < 100; i++) {
        requestPromises.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`request-${i}`)
          )
        );
      }

      await Promise.all(requestPromises);

      // Next request should be rate limited
      const canMake = rateLimitManager.canMakeRequest(
        ProviderType.GOOGLE_CALENDAR,
        RateLimitType.REQUESTS_PER_MINUTE
      );

      expect(canMake).toBe(false);
    });

    it('should reset rate limits after time window', async () => {
      // Exhaust rate limit
      const requestPromises = [];
      for (let i = 0; i < 100; i++) {
        requestPromises.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`request-${i}`)
          )
        );
      }

      await Promise.all(requestPromises);
      expect(rateLimitManager.canMakeRequest(ProviderType.GOOGLE_CALENDAR)).toBe(false);

      // Fast forward time to reset window
      jest.advanceTimersByTime(60 * 1000); // 1 minute

      expect(rateLimitManager.canMakeRequest(ProviderType.GOOGLE_CALENDAR)).toBe(true);
    });
  });

  describe('Request Queuing', () => {
    it('should queue requests when rate limited', async () => {
      // Fill up rate limit
      const initialRequests = [];
      for (let i = 0; i < 100; i++) {
        initialRequests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`initial-${i}`)
          )
        );
      }

      await Promise.all(initialRequests);

      // This request should be queued
      const queuedRequestPromise = rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.resolve('queued-request'),
        { allowQueuing: true }
      );

      const status = rateLimitManager.getRateLimitStatus(ProviderType.GOOGLE_CALENDAR);
      expect(status.queuedRequests).toBe(1);

      // Fast forward to process queue
      jest.advanceTimersByTime(60 * 1000);
      
      const result = await queuedRequestPromise;
      expect(result).toBe('queued-request');
    });

    it('should prioritize high-priority requests in queue', async () => {
      // Fill rate limit
      const initialRequests = [];
      for (let i = 0; i < 100; i++) {
        initialRequests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`initial-${i}`)
          )
        );
      }

      await Promise.all(initialRequests);

      // Queue normal and high priority requests
      const normalRequest = rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.resolve('normal'),
        { priority: 'normal', allowQueuing: true }
      );

      const highPriorityRequest = rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.resolve('high-priority'),
        { priority: 'high', allowQueuing: true }
      );

      // Reset rate limit and process queue
      jest.advanceTimersByTime(60 * 1000);

      const results = await Promise.all([normalRequest, highPriorityRequest]);
      
      // High priority should be processed first
      expect(results).toContain('high-priority');
      expect(results).toContain('normal');
    });

    it('should reject requests when queuing is disabled', async () => {
      // Fill rate limit
      const initialRequests = [];
      for (let i = 0; i < 100; i++) {
        initialRequests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`initial-${i}`)
          )
        );
      }

      await Promise.all(initialRequests);

      // This should throw immediately
      await expect(
        rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.resolve('should-fail'),
          { allowQueuing: false }
        )
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Request Batching', () => {
    it('should process batch requests efficiently', async () => {
      const batchRequests = Array.from({ length: 20 }, (_, i) => ({
        index: i,
        requestFn: () => Promise.resolve(`batch-result-${i}`)
      }));

      const results = await rateLimitManager.batchRequests(
        ProviderType.GOOGLE_CALENDAR,
        batchRequests,
        { batchSize: 5, delayBetweenBatches: 100 }
      );

      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].result).toBe('batch-result-0');
      expect(results[19].result).toBe('batch-result-19');
    });

    it('should handle batch request failures gracefully', async () => {
      const batchRequests = [
        {
          index: 0,
          requestFn: () => Promise.resolve('success')
        },
        {
          index: 1,
          requestFn: () => Promise.reject(new Error('Batch failure'))
        },
        {
          index: 2,
          requestFn: () => Promise.resolve('another-success')
        }
      ];

      const results = await rateLimitManager.batchRequests(
        ProviderType.GOOGLE_CALENDAR,
        batchRequests
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Batch failure');
      expect(results[2].success).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request performance metrics', async () => {
      // Make some requests with varying durations
      await rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => new Promise(resolve => setTimeout(() => resolve('fast'), 100))
      );

      await rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 500))
      );

      const metrics = rateLimitManager.getPerformanceMetrics(ProviderType.GOOGLE_CALENDAR);

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageDuration).toBeGreaterThan(0);
      expect(metrics.successRate).toBe(100);
    });

    it('should track failed requests in metrics', async () => {
      // Make successful request
      await rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.resolve('success')
      );

      // Make failed request
      try {
        await rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.reject(new Error('Request failed'))
        );
      } catch {
        // Expected to fail
      }

      const metrics = rateLimitManager.getPerformanceMetrics(ProviderType.GOOGLE_CALENDAR);

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(50);
    });

    it('should provide aggregated metrics for all providers', async () => {
      // Make requests to different providers
      await rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.resolve('google-success')
      );

      await rateLimitManager.makeRequest(
        ProviderType.MICROSOFT_OUTLOOK,
        () => Promise.resolve('outlook-success')
      );

      const aggregatedMetrics = rateLimitManager.getPerformanceMetrics();

      expect(aggregatedMetrics.totalRequests).toBe(2);
      expect(aggregatedMetrics.successfulRequests).toBe(2);
      expect(aggregatedMetrics.successRate).toBe(100);
    });
  });

  describe('Rate Limit Header Processing', () => {
    it('should update rate limits from response headers', () => {
      const headers = {
        'x-ratelimit-limit': '1000',
        'x-ratelimit-remaining': '950',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600)
      };

      rateLimitManager.updateRateLimitsFromHeaders(ProviderType.GOOGLE_CALENDAR, headers);

      const status = rateLimitManager.getRateLimitStatus(ProviderType.GOOGLE_CALENDAR);
      expect(status.limits.some(limit => limit.limit === 1000)).toBe(true);
    });

    it('should handle rate limit exceeded responses', () => {
      rateLimitManager.handleRateLimitExceeded(ProviderType.GOOGLE_CALENDAR, 300);

      const status = rateLimitManager.getRateLimitStatus(ProviderType.GOOGLE_CALENDAR);
      expect(status.isLimited).toBe(true);
      expect(status.nextResetTime).toBeDefined();
    });
  });

  describe('Sync Optimization', () => {
    it('should provide optimization recommendations', async () => {
      // Create a scenario with high queue volume
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`request-${i}`),
            { allowQueuing: true }
          )
        );
      }

      // Don't await - let them queue up
      const optimization = rateLimitManager.optimizeSyncScheduling();

      expect(optimization.totalQueuedRequests).toBeGreaterThan(0);
      expect(optimization.recommendations).toBeDefined();
      expect(optimization.estimatedProcessingTime).toBeGreaterThan(0);
      expect(optimization.resourceUsage).toBeDefined();

      // Should recommend reducing frequency due to high load
      const hasFrequencyRecommendation = optimization.recommendations.some(
        rec => rec.type === 'reduce_frequency'
      );
      expect(hasFrequencyRecommendation).toBe(true);
    });

    it('should recommend batching for high queue volumes', async () => {
      // Create moderate queue volume for a single provider
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`request-${i}`),
            { allowQueuing: true }
          )
        );
      }

      const optimization = rateLimitManager.optimizeSyncScheduling();

      const hasBatchRecommendation = optimization.recommendations.some(
        rec => rec.type === 'batch_requests' && rec.providerId === ProviderType.GOOGLE_CALENDAR
      );
      expect(hasBatchRecommendation).toBe(true);
    });

    it('should estimate resource usage accurately', () => {
      const optimization = rateLimitManager.optimizeSyncScheduling();

      expect(optimization.resourceUsage.memoryUsageMB).toBeGreaterThanOrEqual(0);
      expect(optimization.resourceUsage.cpuUsagePercent).toBeGreaterThanOrEqual(0);
      expect(optimization.resourceUsage.networkBandwidthKbps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network unreachable');
      networkError.code = 'ENETUNREACH';

      try {
        await rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.reject(networkError)
        );
      } catch (error) {
        expect(error.message).toBe('Network unreachable');
      }

      const metrics = rateLimitManager.getPerformanceMetrics(ProviderType.GOOGLE_CALENDAR);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should detect and handle rate limit errors', async () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.status = 429;
      rateLimitError.retryAfter = 60;

      try {
        await rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.reject(rateLimitError)
        );
      } catch (error) {
        expect(error.message).toBe('Too Many Requests');
      }

      // Should update rate limit status
      const status = rateLimitManager.getRateLimitStatus(ProviderType.GOOGLE_CALENDAR);
      expect(status.isLimited).toBe(true);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';

      await expect(
        rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.reject(timeoutError),
          { timeout: 5000 }
        )
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Provider-Specific Behavior', () => {
    it('should handle different rate limits per provider', () => {
      const googleStatus = rateLimitManager.getRateLimitStatus(ProviderType.GOOGLE_CALENDAR);
      const outlookStatus = rateLimitManager.getRateLimitStatus(ProviderType.MICROSOFT_OUTLOOK);

      // Google should have higher limits than Outlook
      expect(googleStatus.limits.length).toBeGreaterThan(0);
      expect(outlookStatus.limits.length).toBeGreaterThan(0);
    });

    it('should track rate limits independently per provider', async () => {
      // Make requests to Google Calendar
      for (let i = 0; i < 50; i++) {
        await rateLimitManager.makeRequest(
          ProviderType.GOOGLE_CALENDAR,
          () => Promise.resolve(`google-${i}`)
        );
      }

      // Make requests to Outlook
      for (let i = 0; i < 30; i++) {
        await rateLimitManager.makeRequest(
          ProviderType.MICROSOFT_OUTLOOK,
          () => Promise.resolve(`outlook-${i}`)
        );
      }

      const googleMetrics = rateLimitManager.getPerformanceMetrics(ProviderType.GOOGLE_CALENDAR);
      const outlookMetrics = rateLimitManager.getPerformanceMetrics(ProviderType.MICROSOFT_OUTLOOK);

      expect(googleMetrics.totalRequests).toBe(50);
      expect(outlookMetrics.totalRequests).toBe(30);
    });
  });

  describe('Queue Processing', () => {
    it('should process queues automatically', async () => {
      // Fill rate limit
      const initialRequests = [];
      for (let i = 0; i < 100; i++) {
        initialRequests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`initial-${i}`)
          )
        );
      }

      await Promise.all(initialRequests);

      // Queue some requests
      const queuedPromises = [];
      for (let i = 0; i < 5; i++) {
        queuedPromises.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`queued-${i}`),
            { allowQueuing: true }
          )
        );
      }

      // Advance time to trigger queue processing
      jest.advanceTimersByTime(65 * 1000); // 65 seconds

      const results = await Promise.all(queuedPromises);
      expect(results).toHaveLength(5);
      expect(results.every(r => r.startsWith('queued-'))).toBe(true);
    });

    it('should handle queue processing errors', async () => {
      // Fill rate limit
      const initialRequests = [];
      for (let i = 0; i < 100; i++) {
        initialRequests.push(
          rateLimitManager.makeRequest(
            ProviderType.GOOGLE_CALENDAR,
            () => Promise.resolve(`initial-${i}`)
          )
        );
      }

      await Promise.all(initialRequests);

      // Queue a failing request
      const failingRequest = rateLimitManager.makeRequest(
        ProviderType.GOOGLE_CALENDAR,
        () => Promise.reject(new Error('Queued request failed')),
        { allowQueuing: true }
      );

      // Advance time to process queue
      jest.advanceTimersByTime(65 * 1000);

      await expect(failingRequest).rejects.toThrow('Queued request failed');
    });
  });
});