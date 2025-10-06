/**
 * Content Safety Filter Tests
 * Safety: Comprehensive testing of content validation and filtering
 */

import { ContentSafetyFilterEngine } from './content-safety-filter';
import { SafetyConfiguration } from '../models/safety-models';

describe('ContentSafetyFilterEngine', () => {
  let safetyFilter: ContentSafetyFilterEngine;
  let mockConfiguration: SafetyConfiguration;

  beforeEach(() => {
    mockConfiguration = {
      globalSettings: {
        enabled: true,
        strictMode: true,
        defaultAction: 'blocked',
        allowParentalOverrides: true,
        requireParentalApproval: ['high_risk_content'],
        emergencyBypassEnabled: false,
        logAllInteractions: true
      },
      ageGroupSettings: {
        child: {
          strictMode: true,
          allowedTopics: ['education', 'games', 'family'],
          blockedTopics: ['violence', 'adult_content', 'scary_content'],
          vocabularyLevel: 'simple',
          maxComplexity: 30,
          requiresSupervision: true,
          customRules: []
        },
        teen: {
          strictMode: false,
          allowedTopics: ['education', 'games', 'family', 'technology', 'sports'],
          blockedTopics: ['adult_content', 'extreme_violence'],
          vocabularyLevel: 'intermediate',
          maxComplexity: 60,
          requiresSupervision: false,
          customRules: []
        },
        adult: {
          strictMode: false,
          allowedTopics: [],
          blockedTopics: ['illegal_content'],
          vocabularyLevel: 'advanced',
          maxComplexity: 100,
          requiresSupervision: false,
          customRules: []
        }
      },
      customRules: [],
      parentalControls: {
        enabled: true,
        requireApprovalFor: ['blocked_content'],
        notificationMethods: ['push'],
        reviewTimeout: 24,
        autoApproveAfterTimeout: false,
        allowChildExceptions: false
      },
      auditSettings: {
        enabled: true,
        retentionPeriod: 30,
        logLevel: 'standard',
        includeContent: false,
        encryptLogs: true,
        autoReporting: true
      }
    };

    safetyFilter = new ContentSafetyFilterEngine(mockConfiguration);
  });

  describe('validateInput', () => {
    it('should allow appropriate content for children', async () => {
      const result = await safetyFilter.validateInput('Let\'s play a fun game!', 'child_user');
      
      expect(result.isAllowed).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.blockedReasons).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should block profanity for children', async () => {
      const result = await safetyFilter.validateInput('This is damn annoying', 'child_user');
      
      expect(result.isAllowed).toBe(false);
      expect(result.riskLevel).toBe('medium');
      expect(result.blockedReasons.length).toBeGreaterThan(0);
      expect(result.sanitizedText).toBeDefined();
    });

    it('should block inappropriate topics for children', async () => {
      const result = await safetyFilter.validateInput('Tell me about violence and fighting', 'child_user');
      
      expect(result.isAllowed).toBe(false);
      expect(result.riskLevel).toBe('medium');
      expect(result.blockedReasons.some(reason => reason.includes('Topic'))).toBe(true);
    });

    it('should block harmful instructions', async () => {
      const result = await safetyFilter.validateInput('How to hurt someone', 'child_user');
      
      expect(result.isAllowed).toBe(false);
      expect(result.riskLevel).toBe('high');
      expect(result.blockedReasons.some(reason => reason.includes('harmful'))).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      // Simulate error by passing invalid user ID
      const result = await safetyFilter.validateInput('Test content', '');
      
      // Empty user ID should default to child safety level and block if needed
      expect(result.isAllowed).toBe(true); // Simple test content should be allowed
      expect(result.riskLevel).toBe('low');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should process content within performance requirements', async () => {
      const startTime = Date.now();
      await safetyFilter.validateInput('This is a test message for performance', 'test_user');
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(100); // Should be under 100ms
    });
  });

  describe('validateOutput', () => {
    it('should allow safe output content', async () => {
      const result = await safetyFilter.validateOutput('Here\'s a fun activity for you!', 'child_user');
      
      expect(result.isAllowed).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    it('should sanitize inappropriate output content', async () => {
      const result = await safetyFilter.validateOutput('This damn thing is broken', 'child_user');
      
      expect(result.isAllowed).toBe(true); // Output is sanitized, not blocked
      expect(result.sanitizedText).toBeDefined();
      expect(result.sanitizedText).not.toContain('damn');
    });

    it('should provide safe fallback for high-risk content', async () => {
      const result = await safetyFilter.validateOutput('How to make a weapon', 'child_user');
      
      expect(result.isAllowed).toBe(true);
      expect(result.sanitizedText).toContain('fun and appropriate');
    });
  });

  describe('validateChildSafeContent', () => {
    it('should validate content for different age groups', async () => {
      const childResult = await safetyFilter.validateChildSafeContent('Let\'s learn about science!', 'child');
      const teenResult = await safetyFilter.validateChildSafeContent('Technology is amazing', 'teen');
      const adultResult = await safetyFilter.validateChildSafeContent('Complex technical discussion', 'adult');
      
      expect(childResult).toBe(true);
      expect(teenResult).toBe(true);
      expect(adultResult).toBe(true);
    });

    it('should reject inappropriate content for children', async () => {
      const result = await safetyFilter.validateChildSafeContent('Scary ghost story', 'child');
      expect(result).toBe(false);
    });

    it('should handle validation errors by rejecting content', async () => {
      // Test with null/undefined content
      const result = await safetyFilter.validateChildSafeContent('', 'child');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('updateFilterRules', () => {
    it('should update filter rules and emit event', (done) => {
      const newRules = {
        profanityFilter: {
          enabled: true,
          strictness: 'medium' as const,
          customWords: ['badword'],
          allowedExceptions: []
        },
        topicFilter: {
          enabled: true,
          blockedTopics: ['new_blocked_topic'],
          ageRestrictedTopics: {
            child: ['restricted_topic'],
            teen: [],
            adult: []
          },
          contextualRules: []
        },
        behaviorFilter: {
          enabled: true,
          blockedBehaviors: ['bullying'],
          harmfulInstructions: ['dangerous_activity'],
          manipulativeContent: []
        }
      };

      safetyFilter.on('rules_updated', (rules) => {
        expect(rules).toEqual(newRules);
        done();
      });

      safetyFilter.updateFilterRules(newRules);
    });
  });

  describe('getAuditLog', () => {
    it('should return audit entries within time range', async () => {
      // First, create some audit entries by validating content
      await safetyFilter.validateInput('Test content 1', 'user1');
      await safetyFilter.validateInput('Test content 2', 'user2');

      const timeRange = {
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date()
      };

      const auditLog = await safetyFilter.getAuditLog(timeRange);
      expect(Array.isArray(auditLog)).toBe(true);
    });

    it('should return empty array for future time range', async () => {
      const timeRange = {
        start: new Date(Date.now() + 60000), // 1 minute in future
        end: new Date(Date.now() + 120000)   // 2 minutes in future
      };

      const auditLog = await safetyFilter.getAuditLog(timeRange);
      expect(auditLog).toHaveLength(0);
    });
  });

  describe('event emission', () => {
    it('should emit validation_complete event on successful validation', (done) => {
      safetyFilter.on('validation_complete', (event) => {
        expect(event.userId).toBe('test_user');
        expect(event.result).toBeDefined();
        done();
      });

      safetyFilter.validateInput('Test content', 'test_user');
    });

    it('should emit output_validated event on output validation', (done) => {
      safetyFilter.on('output_validated', (event) => {
        expect(event.userId).toBe('test_user');
        expect(event.result).toBeDefined();
        done();
      });

      safetyFilter.validateOutput('Test output', 'test_user');
    });

    it('should emit validation_error event on validation failure', (done) => {
      // Mock a validation error by overriding a method
      const originalMethod = safetyFilter['performMultiStageValidation'];
      safetyFilter['performMultiStageValidation'] = jest.fn().mockRejectedValue(new Error('Test error'));

      safetyFilter.on('validation_error', (event) => {
        expect(event.error).toBeDefined();
        expect(event.text).toBe('Test content');
        
        // Restore original method
        safetyFilter['performMultiStageValidation'] = originalMethod;
        done();
      });

      safetyFilter.validateInput('Test content', 'test_user');
    });
  });

  describe('performance requirements', () => {
    it('should validate content within latency requirements', async () => {
      const testCases = [
        'Simple test message',
        'This is a longer message with more complex content that needs validation',
        'Multiple sentences. Each sentence should be processed. Performance should remain good.'
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();
        await safetyFilter.validateInput(testCase, 'test_user');
        const processingTime = Date.now() - startTime;
        
        expect(processingTime).toBeLessThan(100); // Should be under 100ms
      }
    });

    it('should handle concurrent validations efficiently', async () => {
      const promises = [];
      const startTime = Date.now();

      // Create 10 concurrent validation requests
      for (let i = 0; i < 10; i++) {
        promises.push(safetyFilter.validateInput(`Test message ${i}`, `user_${i}`));
      }

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(500); // All 10 should complete within 500ms
    });
  });

  describe('memory management', () => {
    it('should limit audit log size to prevent memory issues', async () => {
      // Generate many audit entries
      for (let i = 0; i < 1100; i++) {
        await safetyFilter.validateInput(`Test message ${i}`, `user_${i % 10}`);
      }

      // Check that audit log is limited
      const auditLog = await safetyFilter.getAuditLog({
        start: new Date(0),
        end: new Date()
      });

      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });
  });
});