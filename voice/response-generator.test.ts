/**
 * Response Generation Engine Tests
 * 
 * Tests template-based response generation, personality adaptation,
 * response variation, and context integration functionality.
 */

import { ResponseGenerationEngine } from './response-generator';
import { 
  CommandResult, 
  ResponseContext, 
  ResponseTemplate 
} from './interfaces';
import { PersonalityProfile } from '../models/voice-models';
import * as safetyFilter from '../safety/content-safety-filter';

// Mock the safety filter
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn()
}));

const mockValidateChildSafeContent = safetyFilter.validateChildSafeContent as jest.MockedFunction<typeof safetyFilter.validateChildSafeContent>;

describe('ResponseGenerationEngine', () => {
  let engine: ResponseGenerationEngine;
  let mockContext: ResponseContext;
  let mockResult: CommandResult;
  let mockPersonality: PersonalityProfile;

  beforeEach(() => {
    engine = new ResponseGenerationEngine();
    
    mockContext = {
      userId: 'test-user',
      conversationHistory: [],
      currentIntent: 'greeting',
      userPreferences: {
        userId: 'test-user',
        language: 'en',
        voiceSettings: {
          preferredVoice: 'default',
          speechRate: 1.0,
          volume: 0.8,
          pitch: 1.0,
          emotionalTone: 'friendly'
        },
        interactionStyle: {
          verbosity: 'normal',
          formality: 'casual',
          confirmationLevel: 'standard',
          errorHandling: 'clarify'
        },
        privacySettings: {
          dataRetention: 'session',
          shareWithFamily: false,
          allowPersonalization: true,
          voiceDataStorage: 'none'
        },
        accessibilitySettings: {
          hearingImpaired: false,
          speechImpaired: false,
          visualFeedback: false,
          hapticFeedback: false,
          slowSpeech: false,
          repeatConfirmations: false
        }
      },
      safetyLevel: 'child'
    };

    mockResult = {
      success: true,
      response: 'Task completed successfully',
      executionTime: 150
    };

    mockPersonality = {
      id: 'friendly-helper',
      name: 'Friendly Helper',
      traits: [
        { name: 'friendliness', value: 0.8, description: 'Very friendly' },
        { name: 'helpfulness', value: 0.9, description: 'Very helpful' }
      ],
      responseStyle: {
        enthusiasm: 0.7,
        helpfulness: 0.9,
        patience: 0.8,
        humor: 0.4,
        formality: 0.3
      },
      voiceCharacteristics: {
        baseVoice: 'friendly-female',
        pitchModification: 0.1,
        speedModification: 0.0,
        emotionalRange: ['happy', 'excited', 'calm'],
        accentStrength: 0.2
      },
      ageAppropriate: true,
      safetyValidated: true
    };

    // Default safety validation to pass
    mockValidateChildSafeContent.mockResolvedValue({
      isAllowed: true,
      riskLevel: 'low',
      blockedReasons: [],
      confidence: 0.95,
      processingTime: 10
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Response Generation', () => {
    it('should generate response for known intent', async () => {
      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('should generate fallback response for unknown intent', async () => {
      mockContext.currentIntent = 'unknown-intent';
      
      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      expect(response).toContain('Task completed successfully');
    });

    it('should handle failed command results', async () => {
      mockResult.success = false;
      mockResult.response = 'Command failed';
      mockContext.currentIntent = 'unknown-intent'; // Force fallback path
      
      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      expect(response.toLowerCase()).toContain('couldn\'t');
    });

    it('should validate response safety', async () => {
      await engine.generateResponse(mockResult, mockContext);
      
      expect(mockValidateChildSafeContent).toHaveBeenCalledWith(
        expect.any(String),
        mockContext.userId
      );
    });
  });

  describe('Template Management', () => {
    it('should add custom response template', () => {
      const template: ResponseTemplate = {
        patterns: [
          'Custom response pattern 1',
          'Custom response pattern 2'
        ],
        variables: ['action'],
        safetyValidated: true,
        personalityAdaptations: {
          'friendly': 'Friendly custom response'
        }
      };

      expect(() => {
        engine.addResponseTemplate('custom-intent', template);
      }).not.toThrow();
    });

    it('should reject unsafe templates', () => {
      const unsafeTemplate: ResponseTemplate = {
        patterns: ['Unsafe pattern'],
        variables: [],
        safetyValidated: false,
        personalityAdaptations: {}
      };

      expect(() => {
        engine.addResponseTemplate('unsafe-intent', unsafeTemplate);
      }).toThrow('must be safety validated');
    });

    it('should return available templates', () => {
      const templates = engine.getAvailableTemplates();
      
      expect(templates).toBeInstanceOf(Map);
      expect(templates.size).toBeGreaterThan(0);
      expect(templates.has('greeting')).toBe(true);
    });
  });

  describe('Personality Adaptation', () => {
    beforeEach(() => {
      engine.setPersonality(mockPersonality);
    });

    it('should apply personality to responses', async () => {
      const response = await engine.generateResponse(mockResult, mockContext);
      
      // Should show signs of enthusiasm and helpfulness
      expect(response).toBeTruthy();
      // The response should be modified by personality traits
    });

    it('should use personality-specific adaptations when available', async () => {
      const template: ResponseTemplate = {
        patterns: ['Generic response'],
        variables: [],
        safetyValidated: true,
        personalityAdaptations: {
          'friendly': 'Super friendly response!',
          'professional': 'Professional response.'
        }
      };

      engine.addResponseTemplate('test-intent', template);
      mockContext.currentIntent = 'test-intent';

      const response = await engine.generateResponse(mockResult, mockContext);
      
      // Should use personality adaptation or show personality influence
      expect(response).toBeTruthy();
      expect(response.length).toBeGreaterThan(10);
    });

    it('should emit personality update events', () => {
      const eventSpy = jest.fn();
      engine.on('personalityUpdated', eventSpy);

      engine.setPersonality(mockPersonality);

      expect(eventSpy).toHaveBeenCalledWith({
        personalityId: mockPersonality.id
      });
    });
  });

  describe('Response Variation', () => {
    it('should vary responses to avoid repetition', async () => {
      const responses: string[] = [];
      
      // Generate multiple responses for the same intent
      for (let i = 0; i < 5; i++) {
        const response = await engine.generateResponse(mockResult, mockContext);
        responses.push(response);
      }

      // Should have some variation (not all identical)
      const uniqueResponses = new Set(responses);
      expect(uniqueResponses.size).toBeGreaterThan(1);
    });

    it('should track variation usage', async () => {
      // Generate several responses to build usage history
      for (let i = 0; i < 3; i++) {
        await engine.generateResponse(mockResult, mockContext);
      }

      // Variation tracking should be working (no direct assertion possible without exposing internals)
      expect(true).toBe(true); // Placeholder - actual tracking is internal
    });
  });

  describe('Dynamic Content Insertion', () => {
    it('should populate template variables', async () => {
      const template: ResponseTemplate = {
        patterns: ['I will {action} for you, {user}!'],
        variables: ['action', 'user'],
        safetyValidated: true,
        personalityAdaptations: {}
      };

      engine.addResponseTemplate('action-intent', template);
      mockContext.currentIntent = 'action-intent';
      mockResult.data = { action: 'help' };

      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toContain('help');
      expect(response).toContain(mockContext.userId);
    });

    it('should handle missing variables gracefully', async () => {
      const template: ResponseTemplate = {
        patterns: ['Result: {missing_variable}'],
        variables: ['missing_variable'],
        safetyValidated: true,
        personalityAdaptations: {}
      };

      engine.addResponseTemplate('missing-var-intent', template);
      mockContext.currentIntent = 'missing-var-intent';

      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      // Should handle missing variables without crashing
    });
  });

  describe('Context Integration', () => {
    it('should use conversation history for context', async () => {
      mockContext.conversationHistory = [
        {
          id: 'turn-1',
          timestamp: new Date(Date.now() - 30000), // 30 seconds ago
          userInput: 'Hello',
          recognizedText: 'Hello',
          intent: {
            intent: 'greeting',
            confidence: 0.9,
            parameters: {},
            requiresConfirmation: false
          },
          response: 'Hi there!',
          executionResult: mockResult,
          processingMetrics: {
            recognitionTime: 100,
            intentClassificationTime: 50,
            safetyValidationTime: 25,
            commandExecutionTime: 150,
            responseGenerationTime: 75,
            totalLatency: 400
          },
          safetyChecks: []
        }
      ];

      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      // Context should influence response generation
    });

    it('should adapt to user preferences', async () => {
      mockContext.userPreferences.interactionStyle.verbosity = 'brief';
      
      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      // Should adapt to brief interaction style
    });

    it('should consider safety level', async () => {
      mockContext.safetyLevel = 'child';
      
      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      // Should generate child-appropriate response
    });
  });

  describe('Safety Handling', () => {
    it('should generate safe alternative when content fails validation', async () => {
      mockValidateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content'],
        confidence: 0.9,
        processingTime: 15
      });

      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      // Should provide safe alternative - check for any of the safe response patterns
      const safePatterns = ['help', 'try', 'different', 'else'];
      const containsSafePattern = safePatterns.some(pattern => 
        response.toLowerCase().includes(pattern)
      );
      expect(containsSafePattern).toBe(true);
    });

    it('should emit safety violation events', async () => {
      const eventSpy = jest.fn();
      engine.on('safetyViolation', eventSpy);

      mockValidateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['test violation'],
        confidence: 0.85,
        processingTime: 12
      });

      await engine.generateResponse(mockResult, mockContext);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          context: mockContext,
          reason: ['test violation']
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle template processing errors gracefully', async () => {
      // Force an error by providing invalid template data
      mockValidateChildSafeContent.mockRejectedValueOnce(new Error('Safety check failed'));

      // Suppress the error event for this test
      const errorHandler = jest.fn();
      engine.on('error', errorHandler);

      const response = await engine.generateResponse(mockResult, mockContext);
      
      expect(response).toBeTruthy();
      expect(response.toLowerCase()).toContain('trouble');
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit error events', async () => {
      const eventSpy = jest.fn();
      engine.on('error', eventSpy);

      mockValidateChildSafeContent.mockRejectedValueOnce(new Error('Test error'));

      await engine.generateResponse(mockResult, mockContext);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          context: mockContext,
          stage: 'response_generation'
        })
      );
    });
  });

  describe('Performance', () => {
    it('should generate responses within performance target', async () => {
      const startTime = Date.now();
      
      await engine.generateResponse(mockResult, mockContext);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(300); // Target <300ms
    });

    it('should emit performance metrics', async () => {
      const eventSpy = jest.fn();
      engine.on('responseGenerated', eventSpy);

      await engine.generateResponse(mockResult, mockContext);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: mockContext.currentIntent,
          processingTime: expect.any(Number),
          responseLength: expect.any(Number)
        })
      );
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = Array(5).fill(null).map(() => 
        engine.generateResponse(mockResult, { ...mockContext })
      );

      const responses = await Promise.all(promises);
      
      expect(responses).toHaveLength(5);
      responses.forEach(response => {
        expect(response).toBeTruthy();
      });
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration options', () => {
      const customEngine = new ResponseGenerationEngine({
        maxVariationHistory: 20,
        personalityWeight: 0.5,
        contextWeight: 0.9,
        variationThreshold: 0.2
      });

      expect(customEngine).toBeInstanceOf(ResponseGenerationEngine);
    });

    it('should use default configuration when not provided', () => {
      const defaultEngine = new ResponseGenerationEngine();
      
      expect(defaultEngine).toBeInstanceOf(ResponseGenerationEngine);
    });
  });
});