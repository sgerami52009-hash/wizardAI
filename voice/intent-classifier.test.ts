/**
 * Intent Classification System Tests
 * Safety: Validates child-safe content filtering and appropriate responses
 * Performance: Ensures classification speed meets <100ms requirement
 */

import { LocalIntentClassifier } from './intent-classifier';
import { LocalEntityExtractor } from './entity-extractor';
import { ConversationContext } from '../models/conversation-context';

// Mock the safety filter
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({
    isAllowed: true,
    riskLevel: 'low',
    blockedReasons: []
  })
}));

// Mock the user profiles sanitizer
jest.mock('../models/user-profiles', () => ({
  sanitizeForLog: jest.fn((text) => text.substring(0, 50) + '...')
}));

describe('LocalIntentClassifier', () => {
  let classifier: LocalIntentClassifier;
  let entityExtractor: LocalEntityExtractor;
  let mockContext: ConversationContext;

  beforeEach(() => {
    entityExtractor = new LocalEntityExtractor();
    classifier = new LocalIntentClassifier(entityExtractor);
    
    mockContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      turns: [],
      activeTopics: [],
      pendingActions: [],
      userPreferences: {
        language: 'en-US',
        voiceSettings: {},
        interactionStyle: {},
        privacySettings: {},
        accessibilitySettings: {}
      },
      safetyContext: {
        currentAgeGroup: 'child',
        parentalSupervision: false,
        contentHistory: [],
        riskFactors: [],
        safetyOverrides: []
      },
      environmentContext: {
        location: 'home',
        timeOfDay: 'afternoon',
        dayOfWeek: 'Monday',
        ambientNoise: 'quiet',
        otherUsers: [],
        deviceStatus: {
          networkConnected: true,
          resourceUsage: { memoryMB: 512, cpuPercent: 25 },
          temperature: 25,
          availableStorage: 1000
        }
      }
    };
  });

  describe('Intent Classification Accuracy', () => {
    test('should classify smart home light control intent correctly', async () => {
      const result = await classifier.classifyIntent('turn on the lights', mockContext);
      
      expect(result.intent).toBe('smart_home.lights.control');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.parameters.action).toBe('turn on');
    });

    test('should classify scheduling reminder intent correctly', async () => {
      const result = await classifier.classifyIntent('remind me to call mom at 3pm', mockContext);
      
      expect(result.intent).toBe('scheduling.create_reminder');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.parameters.task).toContain('call mom');
      expect(result.parameters.time).toContain('3pm');
    });

    test('should classify greeting intent correctly', async () => {
      const result = await classifier.classifyIntent('hello there', mockContext);
      
      expect(result.intent).toBe('conversation.greeting');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should classify weather information request correctly', async () => {
      const result = await classifier.classifyIntent('what\'s the weather like', mockContext);
      
      expect(result.intent).toBe('information.weather');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should handle unknown intents gracefully', async () => {
      const result = await classifier.classifyIntent('xyz random nonsense', mockContext);
      
      expect(result.intent).toBe('system.unknown');
      expect(result.confidence).toBeLessThan(0.7);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    test('should provide high confidence for exact pattern matches', async () => {
      const result = await classifier.classifyIntent('turn on the lights', mockContext);
      
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should provide lower confidence for partial matches', async () => {
      const result = await classifier.classifyIntent('lights please', mockContext);
      
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.9);
    });

    test('should provide alternatives for ambiguous intents', async () => {
      const result = await classifier.classifyIntent('set something for later', mockContext);
      
      if (result.alternatives) {
        expect(result.alternatives.length).toBeGreaterThan(0);
        expect(result.alternatives[0].confidence).toBeLessThan(result.confidence);
      }
    });
  });

  describe('Context Awareness', () => {
    test('should use conversation history for better classification', async () => {
      // Add previous turn about lights
      mockContext.turns.push({
        id: 'turn-1',
        timestamp: new Date(),
        userInput: 'turn on the lights',
        recognizedText: 'turn on the lights',
        intent: {
          intent: 'smart_home.lights.control',
          confidence: 0.9,
          parameters: { action: 'turn on' },
          requiresConfirmation: false
        },
        response: 'I\'ve turned on the lights',
        executionResult: {
          success: true,
          response: 'I\'ve turned on the lights',
          executionTime: 100
        },
        processingMetrics: {
          recognitionTime: 50,
          intentClassificationTime: 30,
          safetyValidationTime: 10,
          commandExecutionTime: 100,
          responseGenerationTime: 20,
          totalLatency: 210,
          memoryUsage: 512,
          cpuUsage: 25
        },
        safetyChecks: []
      });

      const result = await classifier.classifyIntent('turn them off', mockContext);
      
      expect(result.intent).toBe('smart_home.lights.control');
      expect(result.parameters.action).toBe('turn off');
    });

    test('should consider active topics for classification', async () => {
      mockContext.activeTopics = ['smart_home', 'device:lights'];
      
      const result = await classifier.classifyIntent('make them brighter', mockContext);
      
      expect(result.intent).toBe('smart_home.lights.control');
      expect(result.parameters.action).toBe('brighten');
    });

    test('should adapt to time of day context', async () => {
      mockContext.environmentContext.timeOfDay = 'morning';
      
      const result = await classifier.classifyIntent('good morning', mockContext);
      
      expect(result.intent).toBe('conversation.greeting');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Performance Requirements', () => {
    test('should classify intents within 100ms', async () => {
      const startTime = Date.now();
      
      await classifier.classifyIntent('turn on the lights', mockContext);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100);
    });

    test('should handle multiple concurrent classifications', async () => {
      const promises = [
        classifier.classifyIntent('turn on the lights', mockContext),
        classifier.classifyIntent('what\'s the weather', mockContext),
        classifier.classifyIntent('remind me to call', mockContext)
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Safety Integration', () => {
    test('should block unsafe content', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content']
      });

      const result = await classifier.classifyIntent('inappropriate content', mockContext);
      
      expect(result.intent).toBe('system.safety_blocked');
      expect(result.confidence).toBe(1.0);
    });

    test('should emit safety violation events', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content']
      });

      const safetyViolationSpy = jest.fn();
      classifier.on('safetyViolation', safetyViolationSpy);

      await classifier.classifyIntent('inappropriate content', mockContext);
      
      expect(safetyViolationSpy).toHaveBeenCalled();
    });
  });

  describe('Intent Registration', () => {
    test('should register new intents successfully', () => {
      const customIntent = {
        name: 'custom.test',
        patterns: ['test pattern'],
        parameters: [],
        requiredConfidence: 0.8,
        safetyLevel: 'child' as const
      };

      expect(() => classifier.registerIntent(customIntent)).not.toThrow();
      
      const registeredIntents = classifier.getRegisteredIntents();
      expect(registeredIntents.some(intent => intent.name === 'custom.test')).toBe(true);
    });

    test('should validate intent definitions', () => {
      const invalidIntent = {
        name: '',
        patterns: [],
        parameters: [],
        requiredConfidence: 1.5, // Invalid confidence
        safetyLevel: 'child' as const
      };

      expect(() => classifier.registerIntent(invalidIntent)).toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle entity extraction errors gracefully', async () => {
      jest.spyOn(entityExtractor, 'extractEntities').mockRejectedValueOnce(new Error('Extraction failed'));

      const result = await classifier.classifyIntent('turn on the lights', mockContext);
      
      expect(result.intent).toBe('system.error');
      expect(result.confidence).toBe(0.0);
    });

    test('should emit classification error events', async () => {
      jest.spyOn(entityExtractor, 'extractEntities').mockRejectedValueOnce(new Error('Extraction failed'));

      const errorSpy = jest.fn();
      classifier.on('classificationError', errorSpy);

      await classifier.classifyIntent('turn on the lights', mockContext);
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});