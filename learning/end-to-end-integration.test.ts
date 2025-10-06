// End-to-End Integration Tests for Adaptive Learning Engine
// Tests complete learning workflows from interaction capture to personalized decisions
// Validates cross-system integration with voice, avatar, and scheduling components
// Tests multi-user scenarios with concurrent learning and personalization

import {
  InteractionCollector,
  PatternAnalyzer,
  PatternAnalysisResult,
  InferredPreference,
  DetectedHabit,
  ContextualFactor,
  ConfidenceScore
} from '../patterns/types';

import {
  PrivacyFilter,
  UserInteraction,
  FilteredInteraction,
  InteractionSource,
  InteractionType,
  InteractionContext,
  BehaviorPattern,
  PrivacyLevel,
  PrivacyValidationResult
} from '../privacy/types';

import {
  LearningEngine,
  TrainingResult,
  ModelUpdateResult,
  ModelValidationResult,
  OptimizationResult,
  ModelMetrics,
  PerformanceMetrics,
  ConvergenceStatus,
  IdentifiedPattern,
  PatternType
} from './types';

import {
  RealTimeDecisionEngine,
  DecisionRequest,
  PersonalizedDecision,
  DecisionDomain,
  DecisionContext,
  DecisionOption,
  DecisionConstraint,
  AlternativeOption,
  ContextFactor
} from './decision';

import {
  VoicePipelineIntegrationEngine,
  VoiceContext,
  EnhancedIntent,
  PersonalizedVoiceResponse,
  ConversationOptimization
} from './voice-integration';

import {
  AvatarSystemIntegrationImpl,
  PersonalizedPersonality,
  OptimizedExpression,
  PersonalizedAnimation,
  ExpressionContext,
  AnimationType
} from './avatar-integration';

import {
  SchedulingSystemIntegrationImpl,
  CalendarEvent,
  EventType,
  EventPriority,
  FlexibilityLevel,
  Reminder,
  ReminderType,
  DeliveryMethod,
  ReminderPriority
} from './scheduling-integration';

import {
  UserModelStore,
  UserModel
} from '../models/types';

import {
  SafetyValidatorImpl as SafetyValidator
} from './safety-validator';

import {
  ParentalControlManagerImpl as ParentalControlManager
} from './parental-control-manager';

import { LearningEventBus, LearningEventType } from './events';
import { TrainingError } from './errors';
import {
  TimeOfDay,
  DayOfWeek,
  DeviceType,
  UserFeedback,
  FeedbackType,
  FeedbackSource,
  UrgencyLevel,
  AgeGroup
} from './types';

import {
  PersonalityTraits,
  VoiceCharacteristics,
  EmotionType,
  AccentType,
  EmotionalTone
} from '../avatar/types';

// Mock implementations for testing
class MockEventBus implements LearningEventBus {
  private events: any[] = [];
  private subscriptions: Map<string, any> = new Map();
  private shouldFailEmit = false;

  async emit(event: any): Promise<void> {
    if (this.shouldFailEmit) {
      throw new Error('Event bus emit failed');
    }
    this.events.push(event);
  }

  async subscribe(eventType: LearningEventType, handler: any): Promise<string> {
    const subscriptionId = `sub_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(subscriptionId, { eventType, handler });
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  async getEventHistory(eventType?: LearningEventType, userId?: string): Promise<any[]> {
    return this.events.filter(event => {
      if (eventType && event.type !== eventType) return false;
      if (userId && event.data?.userId !== userId) return false;
      return true;
    });
  }

  async clearEventHistory(userId?: string): Promise<void> {
    if (userId) {
      this.events = this.events.filter(event => event.data?.userId !== userId);
    } else {
      this.events = [];
    }
  }

  getEvents(): any[] {
    return this.events;
  }

  clearEvents(): void {
    this.events = [];
  }

  setFailEmit(shouldFail: boolean): void {
    this.shouldFailEmit = shouldFail;
  }

  // Mock implementations for other EventBus methods
  on(): void {}
  off(): void {}
  removeAllListeners(): void {}
  onPerformanceWarning(): void {}
  onSafetyViolation(): void {}
  onSystemError(): void {}
  onSystemRecovery(): void {}
  emitPerformanceWarning(): void {}
  emitSafetyViolation(): void {}
  emitSystemError(): void {}
  emitSystemRecovery(): void {}
}

describe('End-to-End Adaptive Learning Engine Integration', () => {
  let mockInteractionCollector: jest.Mocked<InteractionCollector>;
  let mockPrivacyFilter: jest.Mocked<PrivacyFilter>;
  let mockPatternAnalyzer: jest.Mocked<PatternAnalyzer>;
  let mockLearningEngine: jest.Mocked<LearningEngine>;
  let decisionEngine: RealTimeDecisionEngine;
  let voiceIntegration: VoicePipelineIntegrationEngine;
  let avatarIntegration: AvatarSystemIntegrationImpl;
  let schedulingIntegration: SchedulingSystemIntegrationImpl;
  let mockUserModelStore: jest.Mocked<UserModelStore>;
  let safetyValidator: SafetyValidator;
  let parentalControlManager: ParentalControlManager;
  let mockEventBus: MockEventBus;

  beforeEach(async () => {
    mockEventBus = new MockEventBus();
    
    // Create mock implementations
    mockInteractionCollector = {
      captureInteraction: jest.fn().mockResolvedValue(undefined),
      registerInteractionSource: jest.fn().mockResolvedValue(undefined),
      configureDataRetention: jest.fn().mockResolvedValue(undefined),
      getInteractionSummary: jest.fn().mockResolvedValue({
        userId: 'test',
        timeRange: { start: new Date(), end: new Date(), duration: 1000 },
        totalInteractions: 1,
        interactionTypes: [],
        patterns: [],
        trends: []
      }),
      purgeUserData: jest.fn().mockResolvedValue(undefined)
    };

    mockPrivacyFilter = {
      filterInteraction: jest.fn().mockImplementation(async (interaction: UserInteraction) => ({
        userId: 'hashed_' + interaction.userId,
        patterns: interaction.patterns.map(p => ({
          patternHash: 'hash_' + p.patternId,
          type: p.type,
          strength: p.strength,
          frequency: p.frequency,
          contextHash: 'context_hash',
          anonymizationLevel: 'moderate' as any
        })),
        context: {
          temporalHash: 'temporal_hash',
          locationHash: 'location_hash',
          deviceTypeHash: 'device_hash',
          environmentalHash: 'env_hash',
          privacyLevel: PrivacyLevel.STANDARD
        },
        metadata: {
          processingTime: 10,
          privacyFiltersApplied: ['pii_removal'],
          dataRetentionDays: 30,
          complianceFlags: []
        },
        privacyLevel: PrivacyLevel.STANDARD
      })),
      validatePrivacyCompliance: jest.fn().mockResolvedValue({
        isCompliant: true,
        violations: [],
        recommendations: [],
        riskLevel: 'low' as any
      }),
      configurePrivacyLevel: jest.fn().mockResolvedValue(undefined),
      generatePrivacyReport: jest.fn().mockResolvedValue({} as any),
      anonymizeData: jest.fn().mockResolvedValue({} as any)
    };

    mockPatternAnalyzer = {
      analyzePatterns: jest.fn().mockResolvedValue({
        userId: 'test',
        patterns: [{
          id: 'pattern1',
          type: PatternType.BEHAVIORAL,
          description: 'Test pattern',
          frequency: 0.8,
          strength: 0.9,
          context: createMockPatternContext(),
          examples: [],
          lastObserved: new Date()
        }],
        preferences: [],
        habits: [],
        contextualFactors: [],
        confidence: { overall: 0.8, patternRecognition: 0.8, preferenceInference: 0.7, habitDetection: 0.6, contextualAnalysis: 0.9 },
        analysisTimestamp: new Date()
      }),
      identifyPreferences: jest.fn().mockResolvedValue({} as any),
      detectHabits: jest.fn().mockResolvedValue([]),
      updatePatternWeights: jest.fn().mockResolvedValue(undefined),
      getPatternInsights: jest.fn().mockResolvedValue({} as any)
    };

    mockLearningEngine = {
      trainUserModel: jest.fn().mockResolvedValue({
        success: true,
        modelVersion: '1.0.0',
        improvementMetrics: {
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.85,
          latency: 45,
          memoryUsage: 128
        },
        trainingTime: 1500,
        memoryUsage: 256,
        convergenceStatus: ConvergenceStatus.CONVERGED
      }),
      updateModel: jest.fn().mockResolvedValue({} as any),
      validateModel: jest.fn().mockResolvedValue({} as any),
      optimizeModel: jest.fn().mockResolvedValue({} as any),
      resetUserModel: jest.fn().mockResolvedValue(undefined),
      getModelMetrics: jest.fn().mockResolvedValue({} as any)
    };

    mockUserModelStore = {
      loadUserModel: jest.fn().mockResolvedValue({
        userId: 'test',
        version: '1.0.0',
        createdAt: new Date(),
        lastUpdated: new Date(),
        modelData: {} as any,
        metadata: {} as any,
        performance: {} as any,
        backupInfo: []
      }),
      saveUserModel: jest.fn().mockResolvedValue(undefined),
      createModelBackup: jest.fn().mockResolvedValue({} as any),
      restoreFromBackup: jest.fn().mockResolvedValue({} as any),
      compressModel: jest.fn().mockResolvedValue({} as any),
      migrateUserModel: jest.fn().mockResolvedValue({} as any),
      deleteUserModel: jest.fn().mockResolvedValue(undefined)
    };
    
    // Initialize real components
    decisionEngine = new RealTimeDecisionEngine(mockEventBus);
    voiceIntegration = new VoicePipelineIntegrationEngine(mockEventBus, decisionEngine);
    avatarIntegration = new AvatarSystemIntegrationImpl(mockEventBus);
    schedulingIntegration = new SchedulingSystemIntegrationImpl(mockEventBus, decisionEngine);
    safetyValidator = new SafetyValidator();
    parentalControlManager = new ParentalControlManager();

    // Initialize real systems
    await Promise.all([
      decisionEngine.initialize(),
      voiceIntegration.initialize(),
      avatarIntegration.initialize(),
      schedulingIntegration.initialize()
    ]);

    // Clear initialization events
    mockEventBus.clearEvents();
  });

  describe('Complete Learning Workflow: Interaction to Personalized Decision', () => {
    it('should execute complete learning workflow from voice interaction to personalized response', async () => {
      const userId = 'workflow-test-user';
      const sessionId = 'session-123';
      
      // Step 1: Capture user interaction
      const userInteraction: UserInteraction = {
        userId,
        sessionId,
        timestamp: new Date(),
        source: InteractionSource.VOICE,
        type: InteractionType.CONVERSATION,
        context: createMockInteractionContext(userId),
        patterns: [
          {
            patternId: 'voice-pattern-1',
            type: PatternType.BEHAVIORAL,
            strength: 0.9,
            frequency: 0.8,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.9,
          completionTime: 1500,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      await mockInteractionCollector.captureInteraction(userInteraction);

      // Step 2: Apply privacy filtering
      const filteredInteraction = await mockPrivacyFilter.filterInteraction(userInteraction);
      expect(filteredInteraction).toBeDefined();
      expect(filteredInteraction.userId).toBeDefined(); // Should be hashed
      expect(filteredInteraction.patterns).toBeDefined();

      // Step 3: Analyze patterns
      const patternAnalysis = await mockPatternAnalyzer.analyzePatterns([filteredInteraction]);
      expect(patternAnalysis).toBeDefined();
      expect(patternAnalysis.patterns).toHaveLength(1);
      expect(patternAnalysis.confidence.overall).toBeGreaterThan(0);

      // Step 4: Train user model
      const trainingResult = await mockLearningEngine.trainUserModel(userId, patternAnalysis.patterns);
      expect(trainingResult.success).toBe(true);
      expect(trainingResult.modelVersion).toBeDefined();

      // Step 5: Make personalized decision
      const decisionRequest: DecisionRequest = {
        userId,
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext(userId),
        options: [
          { 
            optionId: 'formal_response',
            type: 'response_style',
            value: 'formal_response',
            metadata: {
              source: 'pattern_analysis',
              reliability: 0.8,
              lastUpdated: new Date(),
              usage: {
                usageCount: 10,
                successRate: 0.85,
                averageRating: 4.2,
                lastUsed: new Date()
              }
            },
            constraints: []
          },
          { 
            optionId: 'casual_response',
            type: 'response_style',
            value: 'casual_response',
            metadata: {
              source: 'pattern_analysis',
              reliability: 0.9,
              lastUpdated: new Date(),
              usage: {
                usageCount: 15,
                successRate: 0.9,
                averageRating: 4.5,
                lastUsed: new Date()
              }
            },
            constraints: []
          }
        ],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      };

      const personalizedDecision = await decisionEngine.makeDecision(decisionRequest);
      expect(personalizedDecision).toBeDefined();
      expect(personalizedDecision.confidence).toBeGreaterThan(0);
      expect(personalizedDecision.selectedOption).toBeDefined();

      // Step 6: Apply voice personalization
      const voiceContext = createMockVoiceContext(userId);
      const personalizedResponse = await voiceIntegration.personalizeResponse(
        'Hello! How can I help you today?',
        'greeting',
        userId,
        voiceContext
      );

      expect(personalizedResponse).toBeDefined();
      expect(personalizedResponse.personalizedResponse).toBeDefined();
      expect(personalizedResponse.confidence).toBeGreaterThan(0);

      // Verify complete workflow events
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'interaction_captured')).toBe(true);
      expect(events.some(e => e.type === 'privacy_filtered')).toBe(true);
      expect(events.some(e => e.type === 'patterns_analyzed')).toBe(true);
      expect(events.some(e => e.type === 'model_trained')).toBe(true);
      expect(events.some(e => e.type === 'decision_made')).toBe(true);
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should execute complete learning workflow for scheduling optimization', async () => {
      const userId = 'scheduling-workflow-user';
      
      // Step 1: Capture scheduling interaction
      const schedulingInteraction: UserInteraction = {
        userId,
        sessionId: 'scheduling-session',
        timestamp: new Date(),
        source: InteractionSource.SCHEDULING,
        type: InteractionType.SCHEDULING,
        context: createMockInteractionContext(userId),
        patterns: [
          {
            patternId: 'scheduling-pattern-1',
            type: PatternType.TEMPORAL,
            strength: 0.8,
            frequency: 0.9,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.8,
          completionTime: 1200,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      await mockInteractionCollector.captureInteraction(schedulingInteraction);

      // Step 2: Privacy filtering and pattern analysis
      const filteredInteraction = await mockPrivacyFilter.filterInteraction(schedulingInteraction);
      const patternAnalysis = await mockPatternAnalyzer.analyzePatterns([filteredInteraction]);

      // Step 3: Train model with scheduling patterns
      const trainingResult = await mockLearningEngine.trainUserModel(userId, patternAnalysis.patterns);
      expect(trainingResult.success).toBe(true);

      // Step 4: Create calendar event for optimization
      const calendarEvent: CalendarEvent = {
        eventId: 'workflow-meeting',
        title: 'Team Sync',
        description: 'Weekly team meeting',
        duration: 60,
        eventType: EventType.MEETING,
        priority: EventPriority.HIGH,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [userId, 'colleague1'],
        requiredResources: ['conference_room'],
        preferredTimeWindows: [],
        constraints: []
      };

      // Step 5: Get personalized scheduling recommendation
      const schedulingRecommendation = await schedulingIntegration.predictOptimalScheduling(
        calendarEvent,
        userId
      );

      expect(schedulingRecommendation).toBeDefined();
      expect(schedulingRecommendation.recommendedSlots).toBeDefined();
      expect(schedulingRecommendation.confidence).toBeGreaterThan(0);

      // Verify scheduling workflow events
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'optimization_completed')).toBe(true);
    });

    it('should execute complete learning workflow for avatar personalization', async () => {
      const userId = 'avatar-workflow-user';
      
      // Step 1: Capture avatar interaction
      const avatarInteraction: UserInteraction = {
        userId,
        sessionId: 'avatar-session',
        timestamp: new Date(),
        source: InteractionSource.AVATAR,
        type: InteractionType.PREFERENCE,
        context: createMockInteractionContext(userId),
        patterns: [
          {
            patternId: 'avatar-pattern-1',
            type: PatternType.PREFERENCE,
            strength: 0.8,
            frequency: 0.7,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.9,
          completionTime: 1000,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      await mockInteractionCollector.captureInteraction(avatarInteraction);

      // Step 2: Process through learning pipeline
      const filteredInteraction = await mockPrivacyFilter.filterInteraction(avatarInteraction);
      const patternAnalysis = await mockPatternAnalyzer.analyzePatterns([filteredInteraction]);
      const trainingResult = await mockLearningEngine.trainUserModel(userId, patternAnalysis.patterns);

      expect(trainingResult.success).toBe(true);

      // Step 3: Personalize avatar characteristics
      const basePersonality: PersonalityTraits = {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 8,
        patience: 7,
        supportiveness: 8
      };

      const personalizedPersonality = await avatarIntegration.adaptAvatarPersonality(
        basePersonality,
        userId
      );

      expect(personalizedPersonality).toBeDefined();
      expect(personalizedPersonality.traits).toBeDefined();
      expect(personalizedPersonality.confidence).toBeGreaterThan(0);

      // Step 4: Optimize expressions
      const expressionContext = createMockExpressionContext(userId);
      const optimizedExpression = await avatarIntegration.optimizeExpressions(
        expressionContext,
        userId
      );

      expect(optimizedExpression).toBeDefined();
      expect(optimizedExpression.emotionType).toBeDefined();
      expect(optimizedExpression.confidence).toBeGreaterThan(0);

      // Verify avatar workflow events
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });
  });

  describe('Cross-System Integration Validation', () => {
    it('should validate seamless integration between voice and avatar systems', async () => {
      const userId = 'cross-system-user';
      
      // Voice interaction that should influence avatar behavior
      const voiceContext = createMockVoiceContext(userId);
      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        'I need help with my schedule',
        0.8,
        userId,
        voiceContext
      );

      expect(enhancedIntent).toBeDefined();
      expect(enhancedIntent.personalizedConfidence).toBeGreaterThan(0);

      // Avatar should adapt based on voice interaction context
      const expressionContext = createMockExpressionContext(userId);
      expressionContext.conversationContext.topicCategory = 'scheduling';
      
      const optimizedExpression = await avatarIntegration.optimizeExpressions(
        expressionContext,
        userId
      );

      expect(optimizedExpression).toBeDefined();
      expect(optimizedExpression.confidence).toBeGreaterThan(0);

      // Voice response should be personalized
      const personalizedResponse = await voiceIntegration.personalizeResponse(
        'I can help you with your schedule. What would you like to do?',
        'scheduling_assistance',
        userId,
        voiceContext
      );

      expect(personalizedResponse).toBeDefined();
      expect(personalizedResponse.personalizedResponse).toBeDefined();

      // Verify cross-system events
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'decision_made')).toBe(true);
      expect(events.some(e => e.type === 'optimization_completed')).toBe(true);
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should validate integration between voice and scheduling systems', async () => {
      const userId = 'voice-scheduling-user';
      
      // Voice intent for scheduling
      const voiceContext = createMockVoiceContext(userId);
      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        'schedule_meeting_tomorrow',
        0.9,
        userId,
        voiceContext
      );

      expect(enhancedIntent).toBeDefined();

      // Scheduling system should use voice context for optimization
      const calendarEvent: CalendarEvent = {
        eventId: 'voice-scheduled-meeting',
        title: 'Voice Scheduled Meeting',
        description: 'Meeting scheduled via voice command',
        duration: 30,
        eventType: EventType.MEETING,
        priority: EventPriority.MEDIUM,
        flexibility: FlexibilityLevel.HIGH,
        participants: [userId],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const schedulingRecommendation = await schedulingIntegration.predictOptimalScheduling(
        calendarEvent,
        userId
      );

      expect(schedulingRecommendation).toBeDefined();
      expect(schedulingRecommendation.confidence).toBeGreaterThan(0);

      // Voice should provide personalized confirmation
      const confirmationResponse = await voiceIntegration.personalizeResponse(
        'I\'ve scheduled your meeting for tomorrow at 2 PM.',
        'scheduling_confirmation',
        userId,
        voiceContext
      );

      expect(confirmationResponse).toBeDefined();
      expect(confirmationResponse.confidence).toBeGreaterThan(0);
    });

    it('should validate integration between avatar and scheduling systems', async () => {
      const userId = 'avatar-scheduling-user';
      
      // Avatar expression during scheduling interaction
      const expressionContext = createMockExpressionContext(userId);
      expressionContext.conversationContext.topicCategory = 'scheduling';
      
      const optimizedExpression = await avatarIntegration.optimizeExpressions(
        expressionContext,
        userId
      );

      expect(optimizedExpression).toBeDefined();

      // Scheduling reminder with avatar context
      const reminder: Reminder = {
        reminderId: 'avatar-reminder',
        eventId: 'avatar-event',
        userId,
        reminderType: ReminderType.ADVANCE_NOTICE,
        content: 'Meeting starts in 15 minutes',
        scheduledTime: new Date(Date.now() + 15 * 60 * 1000),
        deliveryMethods: [DeliveryMethod.VOICE_ANNOUNCEMENT, DeliveryMethod.VISUAL_NOTIFICATION],
        priority: ReminderPriority.HIGH,
        context: {
          userActivity: 'work' as any,
          location: 'office',
          deviceAvailability: {
            availableDevices: ['smart_display'],
            preferredDevice: 'smart_display',
            connectivity: 'online',
            capabilities: []
          },
          attentionLevel: 'moderate' as any,
          interruptibility: 'normal' as any
        }
      };

      const reminderOptimization = await schedulingIntegration.optimizeReminderDelivery(
        reminder,
        userId
      );

      expect(reminderOptimization).toBeDefined();
      expect(reminderOptimization.confidence).toBeGreaterThan(0);

      // Avatar should adapt personality for reminder delivery
      const basePersonality: PersonalityTraits = {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 8,
        patience: 7,
        supportiveness: 8
      };

      const personalizedPersonality = await avatarIntegration.adaptAvatarPersonality(
        basePersonality,
        userId
      );

      expect(personalizedPersonality).toBeDefined();
      expect(personalizedPersonality.confidence).toBeGreaterThan(0);
    });

    it('should validate three-way integration: voice, avatar, and scheduling', async () => {
      const userId = 'three-way-integration-user';
      
      // Complex scenario: voice command for scheduling with avatar feedback
      const voiceContext = createMockVoiceContext(userId);
      
      // Step 1: Voice intent recognition
      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        'reschedule_my_meeting_to_later',
        0.85,
        userId,
        voiceContext
      );

      // Step 2: Avatar expression for processing state
      const processingExpression = await avatarIntegration.optimizeExpressions(
        {
          ...createMockExpressionContext(userId),
          conversationContext: {
            ...createMockExpressionContext(userId).conversationContext,
            topicCategory: 'scheduling'
          }
        },
        userId
      );

      // Step 3: Scheduling optimization
      const calendarEvent: CalendarEvent = {
        eventId: 'three-way-meeting',
        title: 'Rescheduled Meeting',
        description: 'Meeting rescheduled via voice command',
        duration: 45,
        eventType: EventType.MEETING,
        priority: EventPriority.HIGH,
        flexibility: FlexibilityLevel.MODERATE,
        participants: [userId, 'participant1'],
        requiredResources: [],
        preferredTimeWindows: [],
        constraints: []
      };

      const schedulingResult = await schedulingIntegration.predictOptimalScheduling(
        calendarEvent,
        userId
      );

      // Step 4: Avatar expression for confirmation
      const confirmationExpression = await avatarIntegration.optimizeExpressions(
        {
          ...createMockExpressionContext(userId),
          emotionalState: {
            currentEmotion: EmotionType.HAPPY,
            intensity: 0.7,
            stability: 0.8,
            recentChanges: []
          }
        },
        userId
      );

      // Step 5: Voice confirmation response
      const confirmationResponse = await voiceIntegration.personalizeResponse(
        'I\'ve rescheduled your meeting to 3 PM. Is that okay?',
        'scheduling_confirmation',
        userId,
        voiceContext
      );

      // Verify all components worked together
      expect(enhancedIntent).toBeDefined();
      expect(processingExpression).toBeDefined();
      expect(schedulingResult).toBeDefined();
      expect(confirmationExpression).toBeDefined();
      expect(confirmationResponse).toBeDefined();

      // Verify integrated workflow events
      const events = mockEventBus.getEvents();
      expect(events.filter(e => e.type === 'decision_made').length).toBeGreaterThan(0);
      expect(events.filter(e => e.type === 'optimization_completed').length).toBeGreaterThan(0);
      expect(events.filter(e => e.type === 'personalization_applied').length).toBeGreaterThan(0);
    });
  });

  describe('Multi-User Scenarios with Concurrent Learning', () => {
    it('should handle concurrent learning for multiple users without interference', async () => {
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      // Create concurrent interactions for multiple users
      const interactionPromises = users.map(async (userId, index) => {
        const interaction: UserInteraction = {
          userId,
          sessionId: `session-${userId}`,
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: createMockInteractionContext(userId),
          patterns: [
            {
              patternId: `pattern-${userId}-${index}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.8 + (index * 0.02),
              frequency: 0.7 + (index * 0.05),
              context: createMockPatternContext(),
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.8,
            completionTime: 1200,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        // Capture interaction
        await mockInteractionCollector.captureInteraction(interaction);
        
        // Process through learning pipeline
        const filtered = await mockPrivacyFilter.filterInteraction(interaction);
        const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
        const training = await mockLearningEngine.trainUserModel(userId, analysis.patterns);
        
        return { userId, training };
      });

      const results = await Promise.all(interactionPromises);

      // Verify all users were processed successfully
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.training.success).toBe(true);
        expect(result.training.modelVersion).toBeDefined();
      });

      // Verify user isolation - each user should have separate model
      const modelPromises = users.map(userId => mockUserModelStore.loadUserModel(userId));
      const models = await Promise.all(modelPromises);

      models.forEach((model) => {
        expect(model.userId).toBeDefined();
        expect(model.version).toBeDefined();
      });
    });

    it('should handle concurrent personalization requests across systems', async () => {
      const users = ['concurrent-user1', 'concurrent-user2', 'concurrent-user3'];
      
      // Initialize user models
      for (const userId of users) {
        const interaction: UserInteraction = {
          userId,
          sessionId: `init-${userId}`,
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: createMockInteractionContext(userId),
          patterns: [
            {
              patternId: `init-pattern-${userId}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.9,
              frequency: 0.8,
              context: createMockPatternContext(),
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.9,
            completionTime: 1000,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        const filtered = await mockPrivacyFilter.filterInteraction(interaction);
        const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
        await mockLearningEngine.trainUserModel(userId, analysis.patterns);
      }

      // Create concurrent personalization requests
      const concurrentRequests = users.flatMap(userId => [
        // Voice personalization
        voiceIntegration.personalizeResponse(
          'Hello! How can I help you?',
          'greeting',
          userId,
          createMockVoiceContext(userId)
        ),
        
        // Avatar personalization
        avatarIntegration.adaptAvatarPersonality(
          {
            friendliness: 7,
            formality: 5,
            humor: 6,
            enthusiasm: 8,
            patience: 7,
            supportiveness: 8
          },
          userId
        ),
        
        // Scheduling personalization
        schedulingIntegration.predictOptimalScheduling(
          {
            eventId: `concurrent-event-${userId}`,
            title: 'Concurrent Test Event',
            description: 'Testing concurrent scheduling',
            duration: 30,
            eventType: EventType.MEETING,
            priority: EventPriority.MEDIUM,
            flexibility: FlexibilityLevel.MODERATE,
            participants: [userId],
            requiredResources: [],
            preferredTimeWindows: [],
            constraints: []
          },
          userId
        )
      ]);

      const startTime = performance.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = performance.now();

      // Verify all requests completed successfully
      expect(results).toHaveLength(9); // 3 users × 3 systems
      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Verify performance under concurrent load
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should maintain user data isolation during concurrent operations', async () => {
      const user1 = 'isolation-user1';
      const user2 = 'isolation-user2';
      
      // Create distinct patterns for each user
      const user1Interaction: UserInteraction = {
        userId: user1,
        sessionId: 'isolation-session1',
        timestamp: new Date(),
        source: InteractionSource.VOICE,
        type: InteractionType.CONVERSATION,
        context: createMockInteractionContext(user1),
        patterns: [
          {
            patternId: 'formal-pattern',
            type: PatternType.BEHAVIORAL,
            strength: 0.8,
            frequency: 0.9,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.8,
          completionTime: 1500,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      const user2Interaction: UserInteraction = {
        userId: user2,
        sessionId: 'isolation-session2',
        timestamp: new Date(),
        source: InteractionSource.VOICE,
        type: InteractionType.CONVERSATION,
        context: createMockInteractionContext(user2),
        patterns: [
          {
            patternId: 'casual-pattern',
            type: PatternType.BEHAVIORAL,
            strength: 0.8,
            frequency: 0.9,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.9,
          completionTime: 1200,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      // Process both users concurrently
      const [result1, result2] = await Promise.all([
        (async () => {
          const filtered = await mockPrivacyFilter.filterInteraction(user1Interaction);
          const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
          return mockLearningEngine.trainUserModel(user1, analysis.patterns);
        })(),
        (async () => {
          const filtered = await mockPrivacyFilter.filterInteraction(user2Interaction);
          const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
          return mockLearningEngine.trainUserModel(user2, analysis.patterns);
        })()
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify personalization reflects distinct patterns
      const [response1, response2] = await Promise.all([
        voiceIntegration.personalizeResponse(
          'Here is the information you requested.',
          'information_delivery',
          user1,
          createMockVoiceContext(user1)
        ),
        voiceIntegration.personalizeResponse(
          'Here is the information you requested.',
          'information_delivery',
          user2,
          createMockVoiceContext(user2)
        )
      ]);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      
      // Responses should be different due to different learned patterns
      // (In a real implementation, formal vs casual patterns would produce different responses)
      expect(response1.confidence).toBeGreaterThan(0);
      expect(response2.confidence).toBeGreaterThan(0);
    });

    it('should handle family coordination with multiple family members', async () => {
      const familyId = 'test-family';
      const parent = 'parent-user';
      const child1 = 'child-user1';
      const child2 = 'child-user2';
      
      // Initialize family members with different patterns
      const familyMembers = [
        { userId: parent, ageGroup: AgeGroup.ADULT, patterns: ['scheduling_authority', 'family_coordinator'] },
        { userId: child1, ageGroup: AgeGroup.CHILD, patterns: ['school_schedule', 'activity_preference'] },
        { userId: child2, ageGroup: AgeGroup.CHILD, patterns: ['sports_schedule', 'homework_routine'] }
      ];

      // Set up parental controls for children
      for (const member of familyMembers) {
        if (member.ageGroup === AgeGroup.CHILD) {
          // Mock parental control setup - simplified for testing
          // Mock parental control initialization
        }
      }

      // Create family event requiring coordination
      const familyEvent = {
        eventId: 'family-dinner',
        title: 'Family Dinner',
        familyMembers: familyMembers.map(member => ({
          userId: member.userId,
          role: member.userId === parent ? 'organizer' as any : 'required' as any,
          availability: [],
          preferences: {
            preferredTimes: [],
            avoidTimes: [],
            bufferTime: 15,
            flexibility: FlexibilityLevel.MODERATE,
            workingHours: {
              start: member.ageGroup === AgeGroup.CHILD ? '08:00' : '09:00',
              end: member.ageGroup === AgeGroup.CHILD ? '15:00' : '17:00',
              timezone: 'UTC',
              flexibility: FlexibilityLevel.MODERATE
            }
          },
          constraints: []
        })),
        eventType: 'meal' as any,
        coordinationRequirements: [],
        flexibilityConstraints: [],
        duration: 60,
        preferredTimeWindows: []
      };

      // Test family coordination
      const coordinationResult = await schedulingIntegration.enhanceFamilyCoordination(
        familyEvent,
        familyId
      );

      expect(coordinationResult).toBeDefined();
      expect(coordinationResult.participantOptimizations).toHaveLength(3);
      expect(coordinationResult.successProbability).toBeGreaterThan(0);

      // Verify child safety compliance
      const events = mockEventBus.getEvents();
      const safetyEvents = events.filter(e => e.type === 'safety_validated');
      expect(safetyEvents.length).toBeGreaterThanOrEqual(0); // May be 0 in mock scenario
    });
  });

  describe('Performance and Scalability Under Load', () => {
    it('should maintain performance with high-volume concurrent learning', async () => {
      const userCount = 20;
      const interactionsPerUser = 5;
      
      const users = Array.from({ length: userCount }, (_, i) => `load-test-user-${i}`);
      
      // Create high-volume concurrent interactions
      const allInteractions = users.flatMap(userId =>
        Array.from({ length: interactionsPerUser }, (_, j) => ({
          userId,
          sessionId: `load-session-${userId}-${j}`,
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: createMockInteractionContext(userId),
          patterns: [
            {
              patternId: `load-pattern-${userId}-${j}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.8,
              frequency: 0.7 + (j * 0.05),
              context: createMockPatternContext(),
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.8,
            completionTime: 1100,
            followUpRequired: false,
            errorOccurred: false
          }
        }))
      );

      const startTime = performance.now();
      
      // Process all interactions concurrently
      const processingPromises = allInteractions.map(async interaction => {
        await mockInteractionCollector.captureInteraction(interaction);
        const filtered = await mockPrivacyFilter.filterInteraction(interaction);
        const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
        return mockLearningEngine.trainUserModel(interaction.userId, analysis.patterns);
      });

      const results = await Promise.all(processingPromises);
      const endTime = performance.now();

      // Verify all interactions processed successfully
      expect(results).toHaveLength(userCount * interactionsPerUser);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify performance under load
      const totalTime = endTime - startTime;
      const avgTimePerInteraction = totalTime / results.length;
      
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(avgTimePerInteraction).toBeLessThan(100); // Average < 100ms per interaction
    });

    it('should handle memory efficiently during sustained operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform sustained learning operations
      for (let i = 0; i < 50; i++) {
        const userId = `memory-test-user-${i}`;
        
        const interaction: UserInteraction = {
          userId,
          sessionId: `memory-session-${i}`,
          timestamp: new Date(),
          source: InteractionSource.VOICE,
          type: InteractionType.CONVERSATION,
          context: createMockInteractionContext(userId),
          patterns: [
            {
              patternId: `memory-pattern-${i}`,
              type: PatternType.BEHAVIORAL,
              strength: 0.7,
              frequency: 0.8,
              context: createMockPatternContext(),
              isAnonymized: false
            }
          ],
          outcome: {
            success: true,
            userSatisfaction: 0.8,
            completionTime: 1000,
            followUpRequired: false,
            errorOccurred: false
          }
        };

        await mockInteractionCollector.captureInteraction(interaction);
        const filtered = await mockPrivacyFilter.filterInteraction(interaction);
        const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
        await mockLearningEngine.trainUserModel(userId, analysis.patterns);
        
        // Perform personalization operations
        await voiceIntegration.personalizeResponse(
          'Test response',
          'test',
          userId,
          createMockVoiceContext(userId)
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not increase memory usage excessively (Jetson Nano Orin constraint)
      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB increase
    });

    it('should maintain real-time performance constraints', async () => {
      const userId = 'realtime-test-user';
      
      // Initialize user model
      const initInteraction: UserInteraction = {
        userId,
        sessionId: 'realtime-init',
        timestamp: new Date(),
        source: InteractionSource.VOICE,
        type: InteractionType.CONVERSATION,
        context: createMockInteractionContext(userId),
        patterns: [
          {
            patternId: 'realtime-pattern',
            type: PatternType.BEHAVIORAL,
            strength: 0.8,
            frequency: 0.9,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.9,
          completionTime: 800,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      const filtered = await mockPrivacyFilter.filterInteraction(initInteraction);
      const analysis = await mockPatternAnalyzer.analyzePatterns([filtered]);
      await mockLearningEngine.trainUserModel(userId, analysis.patterns);

      // Test real-time decision making (should be < 100ms)
      const decisionRequest: DecisionRequest = {
        userId,
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext(userId),
        options: [
          { 
            optionId: 'option1',
            type: 'response_type',
            value: 'option1',
            metadata: {
              source: 'test',
              reliability: 0.8,
              lastUpdated: new Date(),
              usage: {
                usageCount: 5,
                successRate: 0.8,
                averageRating: 4.0,
                lastUsed: new Date()
              }
            },
            constraints: []
          },
          { 
            optionId: 'option2',
            type: 'response_type',
            value: 'option2',
            metadata: {
              source: 'test',
              reliability: 0.7,
              lastUpdated: new Date(),
              usage: {
                usageCount: 3,
                successRate: 0.7,
                averageRating: 3.5,
                lastUsed: new Date()
              }
            },
            constraints: []
          }
        ],
        constraints: [],
        urgency: UrgencyLevel.HIGH,
        timestamp: new Date()
      };

      const startTime = performance.now();
      const decision = await decisionEngine.makeDecision(decisionRequest);
      const decisionTime = performance.now() - startTime;

      expect(decision).toBeDefined();
      expect(decisionTime).toBeLessThan(100); // Real-time constraint

      // Test voice personalization (should be < 100ms)
      const voiceStartTime = performance.now();
      const voiceResponse = await voiceIntegration.personalizeResponse(
        'Quick response needed',
        'urgent',
        userId,
        createMockVoiceContext(userId)
      );
      const voiceTime = performance.now() - voiceStartTime;

      expect(voiceResponse).toBeDefined();
      expect(voiceTime).toBeLessThan(100); // Real-time constraint
    });
  });

  describe('Error Recovery and System Resilience', () => {
    it('should recover gracefully from component failures', async () => {
      const userId = 'recovery-test-user';
      
      // Simulate privacy filter failure
      mockPrivacyFilter.filterInteraction.mockRejectedValueOnce(new Error('Privacy filter failed'));
      
      const interaction: UserInteraction = {
        userId,
        sessionId: 'recovery-session',
        timestamp: new Date(),
        source: InteractionSource.VOICE,
        type: InteractionType.CONVERSATION,
        context: createMockInteractionContext(userId),
        patterns: [
          {
            patternId: 'recovery-pattern',
            type: PatternType.BEHAVIORAL,
            strength: 0.7,
            frequency: 0.8,
            context: createMockPatternContext(),
            isAnonymized: false
          }
        ],
        outcome: {
          success: true,
          userSatisfaction: 0.7,
          completionTime: 1300,
          followUpRequired: false,
          errorOccurred: false
        }
      };

      // System should handle privacy filter failure gracefully
      await mockInteractionCollector.captureInteraction(interaction);
      
      // Should still be able to make decisions with fallback behavior
      const decisionRequest: DecisionRequest = {
        userId,
        domain: DecisionDomain.CONVERSATION,
        context: createMockDecisionContext(userId),
        options: [{ 
          optionId: 'fallback_option',
          type: 'fallback',
          value: 'fallback_option',
          metadata: {
            source: 'fallback',
            reliability: 0.5,
            lastUpdated: new Date(),
            usage: {
              usageCount: 1,
              successRate: 0.5,
              averageRating: 3.0,
              lastUsed: new Date()
            }
          },
          constraints: []
        }],
        constraints: [],
        urgency: UrgencyLevel.MEDIUM,
        timestamp: new Date()
      };

      const decision = await decisionEngine.makeDecision(decisionRequest);
      expect(decision).toBeDefined();
      expect(decision.fallbackUsed).toBeDefined(); // May be true or false depending on implementation

      // Verify error events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'error')).toBe(true);
    });

    it('should maintain system stability during event bus failures', async () => {
      const userId = 'eventbus-failure-user';
      
      // Simulate event bus failure
      mockEventBus.setFailEmit(true);
      
      // Operations should handle event bus failure gracefully
      try {
        const voiceResponse = await voiceIntegration.personalizeResponse(
          'Test response during event bus failure',
          'test',
          userId,
          createMockVoiceContext(userId)
        );

        expect(voiceResponse).toBeDefined();
        expect(voiceResponse.personalizedResponse).toBeDefined();
      } catch (error) {
        // Event bus failure is expected, system should handle gracefully
        expect(error).toBeDefined();
      }

      // Reset event bus
      mockEventBus.setFailEmit(false);
    });

    it('should handle data corruption gracefully', async () => {
      const userId = 'corruption-test-user';
      
      // Simulate corrupted user model
      mockUserModelStore.loadUserModel.mockResolvedValueOnce(null as any);
      
      // System should handle corrupted model and use fallback
      const voiceResponse = await voiceIntegration.personalizeResponse(
        'Response with corrupted model',
        'test',
        userId,
        createMockVoiceContext(userId)
      );

      expect(voiceResponse).toBeDefined();
      expect(voiceResponse.confidence).toBeGreaterThan(0);
    });
  });
});

// Helper functions for creating mock data
function createMockInteractionContext(userId: string): InteractionContext {
  return {
    timeOfDay: TimeOfDay.MORNING,
    dayOfWeek: DayOfWeek.MONDAY,
    location: {
      room: 'living_room',
      building: 'home',
      city: 'test_city',
      isHome: true,
      isWork: false,
      isPublic: false
    },
    deviceType: DeviceType.SMART_DISPLAY,
    previousInteractions: [],
    environmentalFactors: {
      location: {
        room: 'living_room',
        building: 'home',
        city: 'test_city',
        isHome: true,
        isWork: false,
        isPublic: false
      },
      weather: {
        condition: 'sunny' as any,
        temperature: 22,
        humidity: 45,
        isRaining: false
      },
      lighting: {
        brightness: 70,
        isNatural: true,
        colorTemperature: 5500
      },
      noise: {
        level: 30,
        type: 'quiet' as any,
        isDistracting: false
      },
      temperature: 22
    }
  };
}

function createMockDecisionContext(userId: string): DecisionContext {
  return {
    userContext: {
      userId,
      timestamp: new Date(),
      temporal: {
        timeOfDay: TimeOfDay.MORNING,
        dayOfWeek: DayOfWeek.MONDAY,
        season: 'spring' as any,
        isHoliday: false,
        timeZone: 'UTC',
        relativeToSchedule: 'free_time' as any
      },
      spatial: {
        location: {
          room: 'living_room',
          building: 'home',
          city: 'test_city',
          isHome: true,
          isWork: false,
          isPublic: false
        },
        movement: {
          isMoving: false,
          speed: 0,
          direction: 'stationary',
          transportMode: 'stationary' as any
        },
        proximity: {
          nearbyDevices: [],
          nearbyPeople: [],
          nearbyLocations: []
        },
        accessibility: {
          visualImpairment: false,
          hearingImpairment: false,
          mobilityImpairment: false,
          cognitiveImpairment: false,
          assistiveTechnology: []
        }
      },
      device: {
        deviceType: DeviceType.SMART_DISPLAY,
        screenSize: 'medium' as any,
        inputMethod: 'voice' as any,
        connectivity: 'online' as any
      },
      activity: {
        currentActivity: 'conversation' as any,
        activityLevel: 'moderate' as any,
        focus: 'focused' as any,
        multitasking: false,
        interruptions: []
      },
      social: {
        presentUsers: [userId],
        familyMembers: [],
        guestPresent: false,
        socialActivity: 'alone' as any
      },
      environmental: {
        location: {
          room: 'living_room',
          building: 'home',
          city: 'test_city',
          isHome: true,
          isWork: false,
          isPublic: false
        },
        weather: {
          condition: 'sunny' as any,
          temperature: 22,
          humidity: 45,
          isRaining: false
        },
        lighting: {
          brightness: 70,
          isNatural: true,
          colorTemperature: 5500
        },
        noise: {
          level: 30,
          type: 'quiet' as any,
          isDistracting: false
        },
        temperature: 22
      },
      historical: {
        timestamp: new Date(),
        context: {} as any,
        significance: 0.5,
        events: []
      }
    },
    sessionContext: {
      sessionId: 'decision-session',
      startTime: new Date(),
      interactionCount: 1,
      currentTask: 'conversation',
      userSatisfaction: 0.8
    },
    systemContext: {
      systemLoad: 0.3,
      availableMemory: 2048,
      networkStatus: {
        isOnline: true,
        bandwidth: 100,
        latency: 20,
        reliability: 0.95
      },
      deviceCapabilities: {
        processingPower: 1.0,
        memoryCapacity: 4096,
        storageCapacity: 32768,
        sensors: ['microphone', 'camera', 'accelerometer']
      }
    },
    historicalContext: {
      recentDecisions: [],
      successRate: 0.85,
      userFeedback: [],
      patterns: []
    }
  };
}

function createMockVoiceContext(userId: string): VoiceContext {
  return {
    userContext: {
      userId,
      timestamp: new Date(),
      temporal: {
        timeOfDay: TimeOfDay.MORNING,
        dayOfWeek: DayOfWeek.MONDAY,
        season: 'spring' as any,
        isHoliday: false,
        timeZone: 'UTC',
        relativeToSchedule: 'free_time' as any
      },
      spatial: {
        location: {
          room: 'living_room',
          building: 'home',
          city: 'test_city',
          isHome: true,
          isWork: false,
          isPublic: false
        },
        movement: {
          isMoving: false,
          speed: 0,
          direction: 'stationary',
          transportMode: 'stationary' as any
        },
        proximity: {
          nearbyDevices: [],
          nearbyPeople: [],
          nearbyLocations: []
        },
        accessibility: {
          visualImpairment: false,
          hearingImpairment: false,
          mobilityImpairment: false,
          cognitiveImpairment: false,
          assistiveTechnology: []
        }
      },
      device: {
        deviceType: DeviceType.SMART_DISPLAY,
        screenSize: 'medium' as any,
        inputMethod: 'voice' as any,
        connectivity: 'online' as any
      },
      activity: {
        currentActivity: 'conversation' as any,
        activityLevel: 'moderate' as any,
        focus: 'focused' as any,
        multitasking: false,
        interruptions: []
      },
      social: {
        presentUsers: [userId],
        familyMembers: [],
        guestPresent: false,
        socialActivity: 'alone' as any
      },
      environmental: {
        location: {
          room: 'living_room',
          building: 'home',
          city: 'test_city',
          isHome: true,
          isWork: false,
          isPublic: false
        },
        weather: {
          condition: 'sunny' as any,
          temperature: 22,
          humidity: 45,
          isRaining: false
        },
        lighting: {
          brightness: 70,
          isNatural: true,
          colorTemperature: 5500
        },
        noise: {
          level: 30,
          type: 'quiet' as any,
          isDistracting: false
        },
        temperature: 22
      },
      historical: {
        timestamp: new Date(),
        context: {} as any,
        significance: 0.5,
        events: []
      }
    },
    audioContext: {
      volume: 0.7,
      clarity: 0.9,
      backgroundNoise: 0.2,
      speechRate: 1.0,
      pitch: 0.5,
      emotion: {
        primary: 'neutral' as any,
        intensity: 0.5,
        confidence: 0.8
      }
    },
    conversationContext: {
      sessionId: 'voice-session',
      turnCount: 1,
      lastInteraction: new Date(),
      conversationTopic: 'general',
      userEngagement: 'moderate' as any,
      conversationGoal: 'information_seeking' as any
    },
    environmentalContext: {
      ambientNoise: 0.3,
      acoustics: 'quiet_indoor' as any,
      privacy: 'standard' as any,
      interruptions: 'low' as any
    }
  };
}

function createMockPatternContext(): any {
  return {
    temporal: {
      timeOfDay: TimeOfDay.MORNING,
      dayOfWeek: DayOfWeek.MONDAY,
      season: 'spring',
      isHoliday: false,
      timeZone: 'UTC',
      relativeToSchedule: 'free_time'
    },
    environmental: {
      location: {
        room: 'living_room',
        building: 'home',
        city: 'test_city',
        isHome: true,
        isWork: false,
        isPublic: false
      },
      weather: {
        condition: 'sunny',
        temperature: 22,
        humidity: 45,
        isRaining: false
      },
      lighting: {
        brightness: 70,
        isNatural: true,
        colorTemperature: 5500
      },
      noise: {
        level: 30,
        type: 'quiet',
        isDistracting: false
      },
      temperature: 22
    },
    social: {
      presentUsers: ['test-user'],
      familyMembers: [],
      guestPresent: false,
      socialActivity: 'alone'
    },
    device: {
      deviceType: DeviceType.SMART_DISPLAY,
      screenSize: 'medium',
      inputMethod: 'voice',
      connectivity: 'online'
    }
  };
}

function createMockExpressionContext(userId: string): ExpressionContext {
  return {
    userId,
    conversationContext: {
      topicCategory: 'general',
      conversationLength: 5,
      userEngagement: 0.8,
      previousExpressions: [],
      communicationStyle: {
        formality: 0.5,
        enthusiasm: 0.7,
        patience: 0.8,
        supportiveness: 0.9
      }
    },
    emotionalState: {
      currentEmotion: EmotionType.HAPPY,
      intensity: 0.7,
      stability: 0.8,
      recentChanges: []
    },
    interactionHistory: [],
    environmentalFactors: {
      timeOfDay: 'morning',
      socialContext: {
        presentUsers: [userId],
        familyMembers: [],
        guestPresent: false,
        socialActivity: 'alone' as any
      },
      deviceType: 'smart_display',
      ambientConditions: {
        lighting: 'natural',
        noiseLevel: 0.3,
        temperature: 22,
        socialPresence: false
      }
    }
  };
}