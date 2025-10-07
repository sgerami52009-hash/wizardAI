/**
 * Test Suite for LLM-Enhanced Learning Engine
 * 
 * Comprehensive tests for LLM integration, natural language processing,
 * enhanced recommendations, and fallback mechanisms.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LLMEnhancedLearningEngine } from './llm-enhanced-learning-engine';
import { LLMEnhancedLearningEngineFactory, createAutoConfiguredLearningEngine } from './llm-enhanced-factory';
import { LearningEventBus, DefaultLearningEventBus } from '../../learning/events';
import { ErrorRecoveryManager, DefaultErrorRecoveryManager } from '../../learning/errors';
import { PrivacyManager } from '../privacy/privacy-manager';
import { ModelType, RecommendationType, InteractionType, PrivacyLevel } from '../enums';
import {
  UserInteraction,
  UserFeedback,
  TrainingData,
  PerformanceConstraints
} from '../types';

// Mock implementations
jest.mock('../../learning/llm-integration');
jest.mock('../privacy/privacy-manager');

describe('LLMEnhancedLearningEngine', () => {
  let engine: LLMEnhancedLearningEngine;
  let eventBus: LearningEventBus;
  let errorRecovery: ErrorRecoveryManager;
  let privacyManager: PrivacyManager;

  const mockUserId = 'test-user-123';
  const mockFamilyId = 'test-family-456';

  beforeEach(async () => {
    // Create mock dependencies
    eventBus = new DefaultLearningEventBus();
    errorRecovery = new DefaultErrorRecoveryManager();
    privacyManager = new PrivacyManager();

    // Mock privacy manager methods
    jest.spyOn(privacyManager, 'getUserPrivacySettings').mockResolvedValue({
      dataSharing: PrivacyLevel.FAMILY,
      llmProcessing: true,
      localOnly: false
    });

    // Create engine instance
    engine = new LLMEnhancedLearningEngine(
      eventBus,
      errorRecovery,
      privacyManager,
      {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.7
      }
    );

    // Initialize engine
    await engine.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully with LLM integration', async () => {
      expect(engine).toBeDefined();
      
      const healthCheck = await engine.healthCheck();
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.components.baseLearningEngine).toBe('healthy');
    });

    test('should handle LLM initialization failure gracefully', async () => {
      // Create engine with invalid config to trigger fallback
      const fallbackEngine = new LLMEnhancedLearningEngine(
        eventBus,
        errorRecovery,
        privacyManager,
        {
          provider: 'invalid' as any,
          apiKey: 'invalid-key'
        }
      );

      await expect(fallbackEngine.initialize()).resolves.not.toThrow();
      
      const healthCheck = await fallbackEngine.healthCheck();
      expect(['healthy', 'degraded']).toContain(healthCheck.status);
    });
  });

  describe('Enhanced User Model Management', () => {
    test('should create enhanced user model on first interaction', async () => {
      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.9,
          context: { timeOfDay: 'morning' },
          textualFeedback: 'I love educational activities in the morning!'
        }
      ];

      await engine.updateUserModel(mockUserId, interactions);

      const insights = await engine.getModelInsights(mockUserId);
      expect(insights).toBeDefined();
      expect(insights.userId).toBe(mockUserId);
      expect(insights.naturalLanguageExplanation).toBeDefined();
    });

    test('should extract natural language insights from textual feedback', async () => {
      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.9,
          context: { timeOfDay: 'morning' },
          textualFeedback: 'We really enjoy science experiments and creative art projects'
        },
        {
          userId: mockUserId,
          recommendationId: 'rec-2',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.8,
          context: { timeOfDay: 'afternoon' },
          textualFeedback: 'Reading together is our favorite family activity'
        }
      ];

      await engine.updateUserModel(mockUserId, interactions);

      const insights = await engine.getModelInsights(mockUserId);
      expect(insights.llmEnhancedInsights).toBeDefined();
      expect(insights.llmEnhancedInsights.semanticInterests).toContain('science');
      expect(insights.llmEnhancedInsights.semanticInterests).toContain('reading');
    });

    test('should handle interactions without textual feedback', async () => {
      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.8,
          context: { timeOfDay: 'evening' }
        }
      ];

      await expect(engine.updateUserModel(mockUserId, interactions)).resolves.not.toThrow();
    });
  });

  describe('Enhanced Recommendation Generation', () => {
    test('should generate enhanced recommendations with LLM insights', async () => {
      // First, create a user model
      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.9,
          context: { timeOfDay: 'morning' },
          textualFeedback: 'We love educational activities'
        }
      ];

      await engine.updateUserModel(mockUserId, interactions);

      // Generate recommendations
      const context = {
        userId: mockUserId,
        conversationHistory: [],
        familyContext: { childrenAges: [6, 9] },
        emotionalState: { sentiment: 0.8, mood: 'positive' },
        semanticContext: { interests: ['education', 'science'] },
        traditionalContext: { recentInteractions: interactions }
      };

      const recommendations = await engine.generateRecommendations(mockUserId, context, 5);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      // Check for LLM enhancements
      const firstRec = recommendations[0];
      expect(firstRec.naturalLanguageExplanation).toBeDefined();
      expect(firstRec.source).toBe('llm-enhanced');
      expect(firstRec.safetyRating).toBeGreaterThanOrEqual(0.8);
    });

    test('should fallback to basic recommendations on LLM failure', async () => {
      // Mock LLM failure
      jest.spyOn(engine['llmIntegration'], 'generateEnhancedRecommendations')
        .mockRejectedValue(new Error('LLM service unavailable'));

      const context = {
        userId: mockUserId,
        conversationHistory: [],
        familyContext: {},
        emotionalState: {},
        semanticContext: {},
        traditionalContext: {}
      };

      const recommendations = await engine.generateRecommendations(mockUserId, context, 3);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].source).toBe('basic');
    });

    test('should apply safety filtering to all recommendations', async () => {
      const context = {
        userId: mockUserId,
        conversationHistory: [],
        familyContext: { childrenAges: [5, 8] },
        emotionalState: {},
        semanticContext: {},
        traditionalContext: {}
      };

      const recommendations = await engine.generateRecommendations(mockUserId, context, 10);

      // All recommendations should meet safety requirements
      recommendations.forEach(rec => {
        expect(rec.safetyRating).toBeGreaterThanOrEqual(0.8);
        expect(rec.ageRange[0]).toBeGreaterThanOrEqual(3);
        expect(rec.ageRange[1]).toBeLessThanOrEqual(17);
      });
    });
  });

  describe('Natural Language Processing', () => {
    test('should process natural language queries', async () => {
      const query = 'Can you suggest some fun science activities for my 8-year-old?';
      
      const result = await engine.processNaturalLanguageQuery(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('string');
      expect(result.response.length).toBeGreaterThan(0);
    });

    test('should maintain conversation history', async () => {
      const queries = [
        'What activities do you recommend for my family?',
        'Something more educational please',
        'How about science experiments?'
      ];

      for (const query of queries) {
        await engine.processNaturalLanguageQuery(mockUserId, query);
      }

      // Check that conversation history is maintained
      const conversationHistory = engine['conversationHistories'].get(mockUserId);
      expect(conversationHistory).toBeDefined();
      expect(conversationHistory!.length).toBeGreaterThan(0);
    });

    test('should analyze user preferences from natural language', async () => {
      const naturalLanguageInput = 'We enjoy creative activities like art and music, especially in the afternoon when the kids are most energetic';
      
      const preferences = await engine.analyzeUserPreferences(
        mockUserId,
        naturalLanguageInput,
        { childrenAges: [6, 9] }
      );

      expect(preferences).toBeDefined();
      expect(preferences.activityTypes).toContain('creative');
      expect(preferences.timePreferences.afternoon).toBeGreaterThan(0.5);
    });
  });

  describe('Enhanced Feedback Processing', () => {
    test('should adapt to user feedback with semantic analysis', async () => {
      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec-1',
        accepted: true,
        rating: 5,
        timestamp: new Date(),
        textualFeedback: 'This was perfect! My kids loved the hands-on science experiment.',
        context: { timeOfDay: 'afternoon' }
      };

      await expect(engine.adaptToUserFeedback(mockUserId, feedback)).resolves.not.toThrow();

      // Check that the feedback influenced the user model
      const insights = await engine.getModelInsights(mockUserId);
      expect(insights.llmEnhancedInsights.semanticInterests).toContain('science');
    });

    test('should handle feedback without textual content', async () => {
      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec-1',
        accepted: false,
        rating: 2,
        timestamp: new Date(),
        context: { timeOfDay: 'evening' }
      };

      await expect(engine.adaptToUserFeedback(mockUserId, feedback)).resolves.not.toThrow();
    });

    test('should extract emotional context from feedback', async () => {
      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: 'rec-1',
        accepted: true,
        rating: 5,
        timestamp: new Date(),
        textualFeedback: 'We were so excited about this activity! The kids were thrilled.',
        context: { timeOfDay: 'morning' }
      };

      await engine.adaptToUserFeedback(mockUserId, feedback);

      const enhancedModel = engine['enhancedUserModels'].get(mockUserId);
      expect(enhancedModel).toBeDefined();
      expect(enhancedModel!.llmInsights.emotionalContext.mood).toBe('positive');
    });
  });

  describe('Privacy and Safety', () => {
    test('should respect privacy settings for LLM processing', async () => {
      // Mock private privacy settings
      jest.spyOn(privacyManager, 'getUserPrivacySettings').mockResolvedValue({
        dataSharing: PrivacyLevel.PRIVATE,
        llmProcessing: false,
        localOnly: true
      });

      await engine.initializeUserPrivacyLearning(mockUserId, {
        dataSharing: PrivacyLevel.PRIVATE,
        llmProcessing: false
      });

      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.8,
          context: { timeOfDay: 'morning' }
        }
      ];

      await expect(engine.updateUserModel(mockUserId, interactions)).resolves.not.toThrow();
    });

    test('should validate child safety in all recommendations', async () => {
      const context = {
        userId: mockUserId,
        conversationHistory: [],
        familyContext: { childrenAges: [4, 7] },
        emotionalState: {},
        semanticContext: {},
        traditionalContext: {}
      };

      const recommendations = await engine.generateRecommendations(mockUserId, context, 5);

      recommendations.forEach(rec => {
        expect(rec.safetyRating).toBeGreaterThanOrEqual(0.8);
        expect(rec.ageRange[0]).toBeLessThanOrEqual(7); // Appropriate for youngest child
        expect(rec.ageRange[1]).toBeGreaterThanOrEqual(4); // Appropriate for oldest child
      });
    });
  });

  describe('Performance and Optimization', () => {
    test('should optimize model performance within constraints', async () => {
      const constraints: PerformanceConstraints = {
        maxMemoryUsageMB: 1000,
        maxResponseTimeMs: 2000,
        maxModelSize: 500,
        enableCaching: true
      };

      const result = await engine.optimizeModelPerformance(constraints);

      expect(result).toBeDefined();
      expect(result.optimizationTechniques).toContain('llm_cache_optimization');
      expect(result.memoryReduction).toBeGreaterThanOrEqual(0);
    });

    test('should provide performance metrics', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.llm).toBeDefined();
      expect(metrics.enhancedModels).toBeDefined();
      expect(metrics.conversationHistories).toBeDefined();
    });

    test('should handle memory constraints', async () => {
      // Create many user models to test memory management
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      
      for (const userId of userIds) {
        const interactions: UserInteraction[] = [
          {
            userId,
            recommendationId: 'rec-1',
            interactionType: InteractionType.ACCEPT,
            timestamp: new Date(),
            satisfaction: 0.8,
            context: { timeOfDay: 'morning' }
          }
        ];

        await engine.updateUserModel(userId, interactions);
      }

      // Optimize performance
      const constraints: PerformanceConstraints = {
        maxMemoryUsageMB: 500,
        maxResponseTimeMs: 1000,
        maxModelSize: 100,
        enableCaching: true
      };

      await expect(engine.optimizeModelPerformance(constraints)).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle LLM service unavailability', async () => {
      // Mock LLM service failure
      jest.spyOn(engine['llmIntegration'], 'processConversationalInput')
        .mockRejectedValue(new Error('Service unavailable'));

      const query = 'What activities do you recommend?';
      
      const result = await engine.processNaturalLanguageQuery(mockUserId, query);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.intent.primaryIntent).toBe('help');
    });

    test('should gracefully degrade when LLM features fail', async () => {
      // Mock multiple LLM failures
      jest.spyOn(engine['llmIntegration'], 'generateEnhancedRecommendations')
        .mockRejectedValue(new Error('LLM failure'));
      jest.spyOn(engine['llmIntegration'], 'getEnhancedInsights')
        .mockRejectedValue(new Error('LLM failure'));

      const interactions: UserInteraction[] = [
        {
          userId: mockUserId,
          recommendationId: 'rec-1',
          interactionType: InteractionType.ACCEPT,
          timestamp: new Date(),
          satisfaction: 0.8,
          context: { timeOfDay: 'morning' }
        }
      ];

      await expect(engine.updateUserModel(mockUserId, interactions)).resolves.not.toThrow();

      const insights = await engine.getModelInsights(mockUserId);
      expect(insights).toBeDefined();
      expect(insights.userId).toBe(mockUserId);
    });
  });

  describe('Integration with Traditional Learning Engine', () => {
    test('should delegate traditional learning methods', async () => {
      const trainingData: TrainingData = {
        interactions: [],
        modelType: ModelType.HYBRID,
        privacyLevel: PrivacyLevel.FAMILY,
        timestamp: new Date()
      };

      const metrics = await engine.trainRecommendationModel(ModelType.HYBRID, trainingData);

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBeGreaterThan(0);
      expect(metrics.precision).toBeGreaterThan(0);
    });

    test('should coordinate federated learning', async () => {
      const participants = ['user-1', 'user-2', 'user-3'];
      const privacySettings = { dataSharing: PrivacyLevel.FAMILY };

      const result = await engine.coordinateFederatedLearning(
        mockFamilyId,
        participants,
        privacySettings
      );

      expect(result).toBeDefined();
    });
  });
});

describe('LLMEnhancedLearningEngineFactory', () => {
  let factory: LLMEnhancedLearningEngineFactory;

  beforeEach(() => {
    factory = LLMEnhancedLearningEngineFactory.getInstance();
  });

  test('should create LLM-enhanced engine when enabled', async () => {
    const config = {
      enableLLM: true,
      llmConfig: {
        provider: 'openai' as const,
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.7
      }
    };

    const engine = await factory.createLearningEngine(config);
    expect(engine).toBeInstanceOf(LLMEnhancedLearningEngine);
  });

  test('should create traditional engine when LLM disabled', async () => {
    const config = {
      enableLLM: false
    };

    const engine = await factory.createLearningEngine(config);
    expect(engine).toBeDefined();
    // Should be traditional LearningEngine, not LLMEnhancedLearningEngine
  });

  test('should auto-configure based on system capabilities', async () => {
    const engine = await createAutoConfiguredLearningEngine();
    expect(engine).toBeDefined();
  });

  test('should provide health check for factory components', async () => {
    const healthCheck = await factory.healthCheck();
    
    expect(healthCheck).toBeDefined();
    expect(healthCheck.status).toBeDefined();
    expect(healthCheck.components).toBeDefined();
  });
});

describe('Integration Tests', () => {
  test('should handle complete recommendation workflow with LLM', async () => {
    const engine = await createAutoConfiguredLearningEngine();
    
    // Step 1: Process natural language query
    const query = 'I need some educational activities for my 7-year-old who loves science';
    const queryResult = await (engine as LLMEnhancedLearningEngine).processNaturalLanguageQuery(
      mockUserId,
      query
    );
    
    expect(queryResult.response).toBeDefined();
    
    // Step 2: Generate recommendations
    if (queryResult.recommendations) {
      expect(queryResult.recommendations.length).toBeGreaterThan(0);
      
      // Step 3: Simulate user feedback
      const feedback: UserFeedback = {
        userId: mockUserId,
        recommendationId: queryResult.recommendations[0].id,
        accepted: true,
        rating: 5,
        timestamp: new Date(),
        textualFeedback: 'Perfect! My child loved this science experiment.',
        context: { timeOfDay: 'afternoon' }
      };
      
      await engine.adaptToUserFeedback(mockUserId, feedback);
      
      // Step 4: Get insights
      const insights = await engine.getModelInsights(mockUserId);
      expect(insights).toBeDefined();
      expect(insights.naturalLanguageExplanation).toBeDefined();
    }
  });
});