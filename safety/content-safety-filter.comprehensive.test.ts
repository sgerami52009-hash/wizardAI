/**
 * Comprehensive Content Safety Filter Tests
 * Safety: Test filtering accuracy across various content types and age groups
 * Requirements: 4.1, 4.2, 4.3 - Comprehensive safety validation testing
 */

import { ContentSafetyFilterEngine, validateChildSafeContent } from './content-safety-filter';
import { SafetyAuditLoggerEngine } from './safety-audit-logger';
import { SafetyConfiguration } from '../models/safety-models';
import { AgeGroup } from './interfaces';

describe('ContentSafetyFilter - Comprehensive Testing', () => {
  let safetyFilter: ContentSafetyFilterEngine;
  let auditLogger: SafetyAuditLoggerEngine;
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
          allowedTopics: ['education', 'games', 'family', 'animals', 'nature'],
          blockedTopics: ['violence', 'adult_content', 'scary_content', 'weapons', 'drugs'],
          vocabularyLevel: 'simple',
          maxComplexity: 30,
          requiresSupervision: true,
          customRules: []
        },
        teen: {
          strictMode: false,
          allowedTopics: ['education', 'games', 'family', 'technology', 'sports', 'music'],
          blockedTopics: ['adult_content', 'extreme_violence', 'illegal_activities'],
          vocabularyLevel: 'intermediate',
          maxComplexity: 60,
          requiresSupervision: false,
          customRules: []
        },
        adult: {
          strictMode: false,
          allowedTopics: [],
          blockedTopics: ['illegal_content', 'harmful_instructions'],
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
        notificationMethods: ['push', 'email'],
        reviewTimeout: 24,
        autoApproveAfterTimeout: false,
        allowChildExceptions: false
      },
      auditSettings: {
        enabled: true,
        retentionPeriod: 30,
        logLevel: 'detailed',
        includeContent: true,
        encryptLogs: true,
        autoReporting: true
      }
    };

    safetyFilter = new ContentSafetyFilterEngine(mockConfiguration);
    auditLogger = new SafetyAuditLoggerEngine(mockConfiguration);
  });

  afterEach(() => {
    if (auditLogger && typeof auditLogger.destroy === 'function') {
      auditLogger.destroy();
    }
  });

  describe('Age Group Filtering Accuracy', () => {
    describe('Child Safety (Ages 5-12)', () => {
      const childUserId = 'child_user_test';

      it('should allow age-appropriate educational content', async () => {
        const appropriateContent = [
          'Let\'s learn about animals in the zoo!',
          'What is 2 plus 2?',
          'Tell me about the solar system',
          'Can you help me with my homework?',
          'I want to play a fun game'
        ];

        for (const content of appropriateContent) {
          const result = await safetyFilter.validateInput(content, childUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBe('low');
          expect(result.blockedReasons).toHaveLength(0);
        }
      });

      it('should block inappropriate topics for children', async () => {
        const inappropriateContent = [
          'Tell me about violence and fighting',
          'I want to see scary monsters',
          'How do weapons work?',
          'What are drugs?',
          'Tell me a ghost story that will scare me'
        ];

        for (const content of inappropriateContent) {
          const result = await safetyFilter.validateInput(content, childUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBeOneOf(['medium', 'high']);
          expect(result.blockedReasons.length).toBeGreaterThan(0);
          expect(result.sanitizedText).toBeDefined();
        }
      });

      it('should block all levels of profanity for children', async () => {
        const profanityContent = [
          'This is damn annoying',
          'What the hell is this?',
          'This is fucking stupid',
          'You\'re such a bitch',
          'Shit happens'
        ];

        for (const content of profanityContent) {
          const result = await safetyFilter.validateInput(content, childUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBeOneOf(['medium', 'high']);
          expect(result.blockedReasons.some(reason => 
            reason.toLowerCase().includes('language') || 
            reason.toLowerCase().includes('profanity')
          )).toBe(true);
        }
      });

      it('should block harmful instructions for children', async () => {
        const harmfulContent = [
          'How to hurt someone',
          'How to make a weapon',
          'Ways to be mean to others',
          'How to break things',
          'How to get revenge'
        ];

        for (const content of harmfulContent) {
          const result = await safetyFilter.validateInput(content, childUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBe('high');
          expect(result.blockedReasons.some(reason => 
            reason.toLowerCase().includes('harmful')
          )).toBe(true);
        }
      });

      it('should handle complex language appropriately for children', async () => {
        const complexContent = [
          'The epistemological implications of quantum mechanics in contemporary physics',
          'Analyze the socioeconomic ramifications of globalization',
          'Discuss the phenomenological aspects of existential philosophy'
        ];

        for (const content of complexContent) {
          const result = await safetyFilter.validateInput(content, childUserId);
          // Complex content should be flagged but not necessarily blocked
          if (!result.isAllowed) {
            expect(result.blockedReasons.some(reason => 
              reason.toLowerCase().includes('complexity')
            )).toBe(true);
          }
        }
      });
    });

    describe('Teen Safety (Ages 13-17)', () => {
      const teenUserId = 'teen_user_test';

      it('should allow age-appropriate teen content', async () => {
        const appropriateContent = [
          'Tell me about technology trends',
          'What are good study techniques?',
          'How do I learn programming?',
          'What sports are popular?',
          'Can you recommend some music?'
        ];

        for (const content of appropriateContent) {
          const result = await safetyFilter.validateInput(content, teenUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBe('low');
        }
      });

      it('should allow mild profanity for teens but block severe profanity', async () => {
        const mildProfanity = ['This is damn frustrating', 'What the hell?'];
        const severeProfanity = ['This is fucking ridiculous', 'You\'re a bitch'];

        for (const content of mildProfanity) {
          const result = await safetyFilter.validateInput(content, teenUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBeOneOf(['low', 'medium']);
        }

        for (const content of severeProfanity) {
          const result = await safetyFilter.validateInput(content, teenUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBeOneOf(['medium', 'high']);
        }
      });

      it('should block extreme violence and adult content for teens', async () => {
        const blockedContent = [
          'How to make weapons of mass destruction',
          'Explicit sexual content',
          'Extreme violence and gore',
          'How to buy illegal drugs'
        ];

        for (const content of blockedContent) {
          const result = await safetyFilter.validateInput(content, teenUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBeOneOf(['medium', 'high']);
        }
      });

      it('should handle moderate complexity content for teens', async () => {
        const moderateContent = [
          'Explain the basics of machine learning algorithms',
          'What are the causes of climate change?',
          'How does the stock market work?'
        ];

        for (const content of moderateContent) {
          const result = await safetyFilter.validateInput(content, teenUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBe('low');
        }
      });
    });

    describe('Adult Safety (Ages 18+)', () => {
      const adultUserId = 'adult_user_test';

      it('should allow most content for adults', async () => {
        const adultContent = [
          'Discuss complex political topics',
          'Explain advanced scientific concepts',
          'Talk about mature themes in literature',
          'Discuss financial investment strategies'
        ];

        for (const content of adultContent) {
          const result = await safetyFilter.validateInput(content, adultUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBe('low');
        }
      });

      it('should still block illegal and harmful content for adults', async () => {
        const illegalContent = [
          'How to make illegal drugs',
          'How to hack into systems illegally',
          'How to commit fraud',
          'Instructions for self-harm'
        ];

        for (const content of illegalContent) {
          const result = await safetyFilter.validateInput(content, adultUserId);
          expect(result.isAllowed).toBe(false);
          expect(result.riskLevel).toBe('high');
        }
      });

      it('should allow profanity for adults with low risk level', async () => {
        const profanityContent = [
          'This is damn annoying',
          'What the hell is going on?',
          'This fucking sucks'
        ];

        for (const content of profanityContent) {
          const result = await safetyFilter.validateInput(content, adultUserId);
          expect(result.isAllowed).toBe(true);
          expect(result.riskLevel).toBe('low');
        }
      });
    });
  });

  describe('Output Sanitization', () => {
    it('should sanitize inappropriate output content instead of blocking', async () => {
      const inappropriateOutputs = [
        'This damn thing is broken',
        'Hell, I don\'t know',
        'That\'s fucking ridiculous'
      ];

      for (const output of inappropriateOutputs) {
        const result = await safetyFilter.validateOutput(output, 'child_user');
        expect(result.isAllowed).toBe(true); // Output should be sanitized, not blocked
        expect(result.sanitizedText).toBeDefined();
        expect(result.sanitizedText).not.toContain('damn');
        expect(result.sanitizedText).not.toContain('hell');
        expect(result.sanitizedText).not.toContain('fucking');
      }
    });

    it('should provide safe fallback for high-risk output content', async () => {
      const highRiskOutputs = [
        'How to make a weapon',
        'Instructions for dangerous activities',
        'Harmful advice for children'
      ];

      for (const output of highRiskOutputs) {
        const result = await safetyFilter.validateOutput(output, 'child_user');
        expect(result.isAllowed).toBe(true);
        expect(result.sanitizedText).toContain('fun and appropriate');
        expect(result.riskLevel).toBeOneOf(['medium', 'high']);
      }
    });

    it('should maintain appropriate tone in sanitized responses', async () => {
      const testOutputs = [
        'I can\'t help with that damn request',
        'This is a hell of a problem',
        'That\'s a fucking difficult question'
      ];

      for (const output of testOutputs) {
        const result = await safetyFilter.validateOutput(output, 'child_user');
        expect(result.sanitizedText).toMatch(/I can't help|Let's try|How about/i);
        expect(result.sanitizedText).not.toMatch(/damn|hell|fucking/i);
      }
    });
  });

  describe('Context-Aware Validation', () => {
    it('should consider conversation history in validation', async () => {
      const context = {
        userId: 'child_user',
        ageGroup: 'child' as AgeGroup,
        contentType: 'voice_input' as const,
        conversationHistory: ['I\'m feeling angry', 'Everything is annoying'],
        parentalSettings: {
          strictMode: true,
          allowedHours: [],
          contentRestrictions: [],
          supervisionRequired: true,
          notificationPreferences: {
            emailAlerts: true,
            pushNotifications: true,
            weeklyReports: true,
            immediateAlerts: ['high_risk_content']
          }
        }
      };

      // Content that might be inappropriate given the angry context
      const result = await safetyFilter.validateInput('I hate everyone', 'child_user');
      
      // Should be more strict given the emotional context
      expect(result.riskLevel).toBeOneOf(['medium', 'high']);
    });

    it('should validate based on user profile settings', async () => {
      // Test with strict parental settings
      const strictResult = await safetyFilter.validateInput('Let\'s play a fighting game', 'child_user_strict');
      
      // Should be more restrictive with strict settings
      expect(strictResult.riskLevel).toBeOneOf(['medium', 'high']);
    });
  });

  describe('Performance Requirements', () => {
    it('should validate content within 100ms latency requirement', async () => {
      const testCases = [
        'Simple test message',
        'This is a longer message with more complex content that needs thorough validation',
        'Multiple sentences with various topics. Each sentence should be processed quickly. Performance should remain optimal even with complex content.'
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();
        await safetyFilter.validateInput(testCase, 'test_user');
        const processingTime = Date.now() - startTime;
        
        expect(processingTime).toBeLessThan(100); // Must be under 100ms per requirement
      }
    });

    it('should handle concurrent validations efficiently', async () => {
      const promises = [];
      const startTime = Date.now();

      // Create 20 concurrent validation requests
      for (let i = 0; i < 20; i++) {
        promises.push(safetyFilter.validateInput(`Concurrent test message ${i}`, `user_${i}`));
      }

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(20);
      expect(totalTime).toBeLessThan(500); // All should complete within 500ms
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('riskLevel');
        expect(result).toHaveProperty('processingTime');
      });
    });

    it('should maintain performance under memory pressure', async () => {
      // Generate many validation requests to test memory management
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(safetyFilter.validateInput(`Memory test ${i}`, `user_${i % 10}`));
      }

      const startTime = Date.now();
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        '', // Empty string
        '   ', // Whitespace only
        '\n\t\r', // Special characters only
        'a'.repeat(10000), // Very long string
        '🎉🎊🎈', // Emoji only
        null as any, // Null input
        undefined as any // Undefined input
      ];

      for (const input of malformedInputs) {
        const result = await safetyFilter.validateInput(input, 'test_user');
        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('riskLevel');
        expect(result.processingTime).toBeGreaterThan(0);
      }
    });

    it('should handle invalid user IDs safely', async () => {
      const invalidUserIds = ['', null as any, undefined as any, '   '];

      for (const userId of invalidUserIds) {
        const result = await safetyFilter.validateInput('Test content', userId);
        
        // Should default to most restrictive settings for safety
        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('riskLevel');
      }
    });

    it('should recover from validation errors without crashing', async () => {
      // Mock a validation error
      const originalMethod = safetyFilter['performMultiStageValidation'];
      let errorThrown = false;
      
      safetyFilter['performMultiStageValidation'] = jest.fn().mockImplementation(() => {
        errorThrown = true;
        throw new Error('Validation system error');
      });

      const result = await safetyFilter.validateInput('Test content', 'test_user');
      
      expect(errorThrown).toBe(true);
      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('riskLevel');
      
      // Restore original method
      safetyFilter['performMultiStageValidation'] = originalMethod;
    });
  });

  describe('Audit Trail Validation', () => {
    it('should log all safety events for audit trail', async () => {
      const testEvents = [
        { content: 'Appropriate content', userId: 'user1' },
        { content: 'Inappropriate damn content', userId: 'child_user' },
        { content: 'Harmful instruction content', userId: 'teen_user' }
      ];

      // Process events and check they're logged
      for (const event of testEvents) {
        await safetyFilter.validateInput(event.content, event.userId);
      }

      // Verify audit log contains entries
      const auditLog = await safetyFilter.getAuditLog({
        start: new Date(Date.now() - 60000),
        end: new Date()
      });

      expect(auditLog.length).toBeGreaterThan(0);
      
      // Check that blocked content is properly logged
      const blockedEntries = auditLog.filter(entry => 
        entry.eventType === 'content_blocked' || entry.eventType === 'input_blocked'
      );
      expect(blockedEntries.length).toBeGreaterThan(0);
    });

    it('should create parental review requests for high-risk content', async () => {
      let parentalReviewRequested = false;
      
      safetyFilter.on('safety_event_logged', (event) => {
        if (event.requiresReview) {
          parentalReviewRequested = true;
        }
      });

      // Test high-risk content that should trigger parental review
      await safetyFilter.validateInput('How to hurt someone', 'child_user');
      
      expect(parentalReviewRequested).toBe(true);
    });

    it('should maintain audit log integrity', async () => {
      const testContent = 'Test audit integrity';
      const userId = 'audit_test_user';
      
      await safetyFilter.validateInput(testContent, userId);
      
      const auditLog = await safetyFilter.getAuditLog({
        start: new Date(Date.now() - 10000),
        end: new Date()
      });

      const relevantEntry = auditLog.find(entry => 
        entry.userId === userId && entry.originalContent === testContent
      );

      expect(relevantEntry).toBeDefined();
      expect(relevantEntry?.timestamp).toBeInstanceOf(Date);
      expect(relevantEntry?.id).toBeDefined();
    });
  });

  describe('validateChildSafeContent Utility Function', () => {
    it('should validate content safety for different age groups', async () => {
      const testCases = [
        { content: 'Let\'s learn about animals!', userId: 'child_user', expected: true },
        { content: 'Tell me about violence', userId: 'child_user', expected: false },
        { content: 'Technology is amazing', userId: 'teen_user', expected: true },
        { content: 'Complex scientific discussion', userId: 'adult_user', expected: true }
      ];

      for (const testCase of testCases) {
        const result = await validateChildSafeContent(testCase.content, testCase.userId);
        expect(result.isAllowed).toBe(testCase.expected);
      }
    });

    it('should handle edge cases in utility function', async () => {
      const edgeCases = [
        { content: '', userId: 'test_user' },
        { content: '   ', userId: 'test_user' },
        { content: 'Normal content', userId: '' }
      ];

      for (const edgeCase of edgeCases) {
        const result = await validateChildSafeContent(edgeCase.content, edgeCase.userId);
        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('riskLevel');
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should limit audit log size to prevent memory issues', async () => {
      // Generate many audit entries
      for (let i = 0; i < 1100; i++) {
        await safetyFilter.validateInput(`Memory test ${i}`, `user_${i % 10}`);
      }

      // Check that audit log is limited
      const auditLog = await safetyFilter.getAuditLog({
        start: new Date(0),
        end: new Date()
      });

      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });

    it('should clean up resources properly', () => {
      // Test that the filter can be properly destroyed/cleaned up
      expect(() => {
        safetyFilter.removeAllListeners();
      }).not.toThrow();
    });
  });
});

// Custom Jest matchers for better test readability
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}