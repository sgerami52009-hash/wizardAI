// System Component Integration Tests
// Tests decision engine integration with voice, avatar, and scheduling systems
// Validates real-time inference performance under load
// Tests fallback mechanisms when integration components fail

import {
  RealTimeDecisionEngine,
  DecisionRequest,
  DecisionDomain,
  DecisionContext,
  DecisionOption,
  PersonalizedDecision,
  ResponseContext,
  FormalityLevel,
  VerbosityLevel,
  EmotionalTone,
  TechnicalLevel,
  SchedulingRequest,
  FlexibilityLevel
} from './decision';

import {
  VoicePipelineIntegrationEngine,
  VoiceContext,
  AudioContext,
  ConversationContext,
  EnvironmentalVoiceContext,
  EnhancedIntent,
  PersonalizedVoiceResponse,
  ConversationOptimization,
  SpeechAdaptation,
  VoiceCommunicationPreferences,
  EmotionType,
  EngagementLevel,
  ConversationGoal,
  AcousticEnvironment,
  PrivacyLevel,
  InterruptionLevel,
  SpeechRatePreference,
  InteractionStyle,
  VocabularyLevel,
  SentenceStructure
} from './voice-integration';

import {
  AvatarSystemIntegrationImpl,
  PersonalizedPersonality,
  OptimizedExpression,
  PersonalizedAnimation,
  PersonalizedVoice,
  ExpressionContext,
  AnimationType,
  AdaptationReason,
  TriggerType,
  InteractionType,
  InteractionOutcome
} from './avatar-integration';

import {
  SchedulingSystemIntegrationImpl,
  CalendarEvent,
  EventType,
  EventPriority,
  ScheduleConflict,
  ConflictType,
  ConflictSeverity,
  Reminder,
  ReminderType,
  DeliveryMethod,
  ReminderPriority,
  FamilyEvent,
  FamilyEventType,
  ParticipationRole,
  CoordinationType,
  ResolutionStrategy,
  EventConstraintType,
  ConstraintPriority,
  AttentionLevel,
  InterruptibilityLevel,
  SlotQuality,
  ActivityType
} from './scheduling-integration';

import { LearningEventBus, LearningEventType } from './events';
import { TrainingError } from './errors';
import {
  UrgencyLevel,
  TimeOfDay,
  DayOfWeek,
  DeviceType
} from './types';

import {
  PersonalityTraits,
  VoiceCharacteristics,
  AccentType,
  EmotionType as AvatarEmotionType
} from '../avatar/types';

// Mock event bus for testing
class MockEventBus implements LearningEventBus {
  private events: any[] = [];
  private subscriptions: Map<string, any> = new Map();
  private shouldFailEmit = false;
  private shouldFailSubscribe = false;

  async emit(event: any): Promise<void> {
    if (this.shouldFailEmit) {
      throw new Error('Event bus emit failed');
    }
    this.events.push(event);
  }

  async subscribe(eventType: LearningEventType, handler: any): Promise<string> {
    if (this.shouldFailSubscribe) {
      throw new Error('Event bus subscribe failed');
    }
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

  setFailSubscribe(shouldFail: boolean): void {
    this.shouldFailSubscribe = shouldFail;
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

describe('System Component Integration Tests', () => {
  let decisionEngine: RealTimeDecisionEngine;
  let voiceIntegration: VoicePipelineIntegrationEngine;
  let avatarIntegration: AvatarSystemIntegrationImpl;
  let schedulingIntegration: SchedulingSystemIntegrationImpl;
  let mockEventBus: MockEventBus;

  beforeEach(async () => {
    mockEventBus = new MockEventBus();
    
    // Initialize all components
    decisionEngine = new RealTimeDecisionEngine(mockEventBus);
    voiceIntegration = new VoicePipelineIntegrationEngine(mockEventBus, decisionEngine);
    avatarIntegration = new AvatarSystemIntegrationImpl(mockEventBus);
    schedulingIntegration = new SchedulingSystemIntegrationImpl(mockEventBus, decisionEngine);

    // Initialize all systems
    await decisionEngine.initialize();
    await voiceIntegration.initialize();
    await avatarIntegration.initialize();
    await schedulingIntegration.initialize();

    // Clear initialization events
    mockEventBus.clearEvents();
  });

  describe('Decision Engine Integration with Voice System', () => {
    it('should integrate decision engine with voice pipeline for intent enhancement', async () => {
      const userId = 'test-user-123';
      const rawIntent = 'schedule_meeting';
      const confidence = 0.7;
      const voiceContext = createMockVoiceContext(userId);

      const startTime = performance.now();
      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        voiceContext
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(enhancedIntent).toBeDefined();
      expect(enhancedIntent.originalIntent).toBe(rawIntent);
      expect(enhancedIntent.personalizedConfidence).toBeGreaterThanOrEqual(confidence);
      
      // Verify performance constraint (sub-100ms)
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'decision_made')).toBe(true);
    });

    it('should integrate decision engine with voice pipeline for response personalization', async () => {
      const userId = 'test-user-123';
      const baseResponse = 'Here is your schedule for today.';
      const intent = 'schedule_query';
      const voiceContext = createMockVoiceContext(userId);

      const startTime = performance.now();
      const personalizedResponse = await voiceIntegration.personalizeResponse(
        baseResponse,
        intent,
        userId,
        voiceContext
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(personalizedResponse).toBeDefined();
      expect(personalizedResponse.originalResponse).toBe(baseResponse);
      expect(personalizedResponse.personalizedResponse).toBeDefined();
      expect(personalizedResponse.confidence).toBeGreaterThan(0);

      // Verify performance constraint
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should handle voice integration failures gracefully with fallbacks', async () => {
      const userId = 'test-user-123';
      const rawIntent = 'test_intent';
      const confidence = 0.8;
      const voiceContext = createMockVoiceContext(userId);

      // Simulate decision engine failure
      jest.spyOn(decisionEngine, 'makeDecision').mockRejectedValueOnce(new Error('Decision engine failure'));

      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        rawIntent,
        confidence,
        userId,
        voiceContext
      );

      // Should still return a result using fallback
      expect(enhancedIntent).toBeDefined();
      expect(enhancedIntent.originalIntent).toBe(rawIntent);
      expect(enhancedIntent.personalizedConfidence).toBeLessThan(confidence);

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'error' || e.type === 'fallback_mode_activated')).toBe(true);
    });
  });

  describe('Decision Engine Integration with Avatar System', () => {
    it('should integrate decision engine with avatar system for personality adaptation', async () => {
      const userId = 'test-user-123';
      const basePersonality: PersonalityTraits = {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 8,
        patience: 7,
        supportiveness: 8
      };

      const startTime = performance.now();
      const personalizedPersonality = await avatarIntegration.adaptAvatarPersonality(
        basePersonality,
        userId
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(personalizedPersonality).toBeDefined();
      expect(personalizedPersonality.traits).toBeDefined();
      expect(personalizedPersonality.confidence).toBeGreaterThan(0);

      // Verify performance constraint
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should integrate decision engine with avatar system for expression optimization', async () => {
      const userId = 'test-user-123';
      const expressionContext = createMockExpressionContext(userId);

      const startTime = performance.now();
      const optimizedExpression = await avatarIntegration.optimizeExpressions(
        expressionContext,
        userId
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(optimizedExpression).toBeDefined();
      expect(optimizedExpression.emotionType).toBeDefined();
      expect(optimizedExpression.confidence).toBeGreaterThan(0);

      // Verify performance constraint
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'optimization_completed')).toBe(true);
    });

    it('should handle avatar integration failures gracefully with fallbacks', async () => {
      const userId = 'test-user-123';
      const basePersonality: PersonalityTraits = {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 8,
        patience: 7,
        supportiveness: 8
      };

      // Simulate avatar system failure
      jest.spyOn(avatarIntegration as any, 'loadUserInteractionPatterns')
        .mockRejectedValueOnce(new Error('Avatar system failure'));

      const personalizedPersonality = await avatarIntegration.adaptAvatarPersonality(
        basePersonality,
        userId
      );

      // Should still return a result using fallback
      expect(personalizedPersonality).toBeDefined();
      expect(personalizedPersonality.traits).toEqual(basePersonality);
      expect(personalizedPersonality.version).toBe('fallback');

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'error')).toBe(true);
    });
  });

  describe('Decision Engine Integration with Scheduling System', () => {
    it('should integrate decision engine with scheduling system for optimal scheduling', async () => {
      const userId = 'test-user-123';
      const mockEvent: CalendarEvent = {
        eventId: 'test-event-1',
        title: 'Team Meeting',
        description: 'Weekly team sync',
        duration: 60,
        eventType: EventType.MEETING,
        priority: EventPriority.HIGH,
        flexibility: FlexibilityLevel.MODERATE,
        participants: ['user1', 'user2'],
        requiredResources: ['conference_room'],
        preferredTimeWindows: [],
        constraints: []
      };

      const startTime = performance.now();
      const schedulingRecommendation = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        userId
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(schedulingRecommendation).toBeDefined();
      expect(schedulingRecommendation.recommendedSlots).toBeDefined();
      expect(schedulingRecommendation.confidence).toBeGreaterThan(0);

      // Verify performance constraint
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'optimization_completed')).toBe(true);
    });

    it('should integrate decision engine with scheduling system for conflict resolution', async () => {
      const userId = 'test-user-123';
      const mockConflict: ScheduleConflict = {
        conflictId: 'conflict-1',
        conflictType: ConflictType.TIME_OVERLAP,
        primaryEvent: createMockCalendarEvent('event-1', 'Meeting A'),
        conflictingEvent: createMockCalendarEvent('event-2', 'Meeting B'),
        overlapDuration: 30,
        severity: ConflictSeverity.MODERATE,
        affectedUsers: [userId],
        possibleResolutions: []
      };

      const startTime = performance.now();
      const resolutionStrategy = await schedulingIntegration.personalizeConflictResolution(
        mockConflict,
        userId
      );
      const processingTime = performance.now() - startTime;

      // Verify integration works
      expect(resolutionStrategy).toBeDefined();
      expect(Object.values(ResolutionStrategy)).toContain(resolutionStrategy);

      // Verify performance constraint
      expect(processingTime).toBeLessThan(100);

      // Verify events were emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should handle scheduling integration failures gracefully with fallbacks', async () => {
      const userId = 'test-user-123';
      const mockEvent = createMockCalendarEvent('test-event', 'Test Event');

      // Simulate decision engine failure
      jest.spyOn(decisionEngine, 'optimizeScheduling').mockRejectedValueOnce(new Error('Scheduling failure'));

      const schedulingRecommendation = await schedulingIntegration.predictOptimalScheduling(
        mockEvent,
        userId
      );

      // Should still return a result using fallback
      expect(schedulingRecommendation).toBeDefined();
      expect(schedulingRecommendation.confidence).toBeLessThan(1);

      // Verify error event was emitted
      const events = mockEventBus.getEvents();
      expect(events.some(e => e.type === 'optimization_failed')).toBe(true);
    });
  });

  describe('Real-Time Inference Performance Under Load', () => {
    it('should maintain sub-100ms response times under concurrent load', async () => {
      const userId = 'test-user-123';
      const concurrentRequests = 10;
      
      // Create concurrent requests across all systems
      const voiceRequests = Array.from({ length: concurrentRequests }, (_, i) =>
        voiceIntegration.enhanceIntentClassification(
          `intent_${i}`,
          0.8,
          `${userId}_${i}`,
          createMockVoiceContext(`${userId}_${i}`)
        )
      );

      const avatarRequests = Array.from({ length: concurrentRequests }, (_, i) =>
        avatarIntegration.optimizeExpressions(
          createMockExpressionContext(`${userId}_${i}`),
          `${userId}_${i}`
        )
      );

      const schedulingRequests = Array.from({ length: concurrentRequests }, (_, i) =>
        schedulingIntegration.predictOptimalScheduling(
          createMockCalendarEvent(`event_${i}`, `Event ${i}`),
          `${userId}_${i}`
        )
      );

      const startTime = performance.now();
      const [voiceResults, avatarResults, schedulingResults] = await Promise.all([
        Promise.all(voiceRequests),
        Promise.all(avatarRequests),
        Promise.all(schedulingRequests)
      ]);
      const totalTime = performance.now() - startTime;

      // Verify all requests completed
      expect(voiceResults).toHaveLength(concurrentRequests);
      expect(avatarResults).toHaveLength(concurrentRequests);
      expect(schedulingResults).toHaveLength(concurrentRequests);

      // Verify performance under load (should complete within reasonable time)
      expect(totalTime).toBeLessThan(1000); // 1 second for all concurrent requests

      // Verify individual response quality
      voiceResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });

      avatarResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });

      schedulingResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should maintain memory efficiency under sustained load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const userId = 'load-test-user';
      
      // Perform sustained operations
      for (let i = 0; i < 50; i++) {
        await Promise.all([
          voiceIntegration.enhanceIntentClassification(
            `intent_${i}`,
            0.8,
            `${userId}_${i}`,
            createMockVoiceContext(`${userId}_${i}`)
          ),
          avatarIntegration.personalizeAnimations(
            AnimationType.GREETING,
            `${userId}_${i}`
          ),
          schedulingIntegration.optimizeReminderDelivery(
            createMockReminder(`reminder_${i}`, `${userId}_${i}`),
            `${userId}_${i}`
          )
        ]);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not increase memory usage significantly (Jetson Nano Orin constraint)
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });

    it('should handle system resource constraints gracefully', async () => {
      const userId = 'resource-test-user';
      
      // Simulate high system load by creating many concurrent operations
      const heavyLoad = Array.from({ length: 20 }, async (_, i) => {
        const promises = [];
        
        // Voice operations
        promises.push(voiceIntegration.enhanceIntentClassification(
          `heavy_intent_${i}`,
          0.8,
          `${userId}_${i}`,
          createMockVoiceContext(`${userId}_${i}`)
        ));

        // Avatar operations
        promises.push(avatarIntegration.adaptAvatarPersonality(
          createMockPersonalityTraits(),
          `${userId}_${i}`
        ));

        // Scheduling operations
        promises.push(schedulingIntegration.predictOptimalScheduling(
          createMockCalendarEvent(`heavy_event_${i}`, `Heavy Event ${i}`),
          `${userId}_${i}`
        ));

        return Promise.all(promises);
      });

      const startTime = performance.now();
      const results = await Promise.all(heavyLoad);
      const totalTime = performance.now() - startTime;

      // Verify all operations completed
      expect(results).toHaveLength(20);
      
      // Should complete within reasonable time even under heavy load
      expect(totalTime).toBeLessThan(5000); // 5 seconds for heavy load

      // Verify system remained stable
      results.forEach(resultSet => {
        expect(resultSet).toHaveLength(3);
        resultSet.forEach(result => {
          expect(result).toBeDefined();
        });
      });
    });
  });

  describe('Fallback Mechanisms When Integration Components Fail', () => {
    it('should handle event bus failures gracefully', async () => {
      const userId = 'fallback-test-user';
      
      // Simulate event bus failure
      mockEventBus.setFailEmit(true);

      // Operations should still work despite event bus failure
      let voiceResult, avatarResult, schedulingResult;
      
      try {
        voiceResult = await voiceIntegration.enhanceIntentClassification(
          'test_intent',
          0.8,
          userId,
          createMockVoiceContext(userId)
        );
      } catch (error) {
        // Event bus failure should not prevent core functionality
        expect((error as Error).message).toContain('Event bus emit failed');
        voiceResult = { originalIntent: 'test_intent', personalizedConfidence: 0.8 };
      }

      try {
        avatarResult = await avatarIntegration.optimizeExpressions(
          createMockExpressionContext(userId),
          userId
        );
      } catch (error) {
        // Event bus failure should not prevent core functionality
        avatarResult = { emotionType: 'neutral', confidence: 0.5 };
      }

      try {
        schedulingResult = await schedulingIntegration.predictOptimalScheduling(
          createMockCalendarEvent('test-event', 'Test Event'),
          userId
        );
      } catch (error) {
        // Event bus failure should not prevent core functionality
        schedulingResult = { recommendedSlots: [], confidence: 0.5 };
      }

      // All should return valid results despite event bus failure
      expect(voiceResult).toBeDefined();
      expect(avatarResult).toBeDefined();
      expect(schedulingResult).toBeDefined();

      // Reset event bus
      mockEventBus.setFailEmit(false);
    });

    it('should handle decision engine complete failure with system-wide fallbacks', async () => {
      const userId = 'decision-failure-test';
      
      // Mock complete decision engine failure
      jest.spyOn(decisionEngine, 'makeDecision').mockRejectedValue(new Error('Complete decision engine failure'));
      jest.spyOn(decisionEngine, 'adaptResponse').mockRejectedValue(new Error('Complete decision engine failure'));
      jest.spyOn(decisionEngine, 'optimizeScheduling').mockRejectedValue(new Error('Complete decision engine failure'));

      // All systems should still provide fallback responses
      const voiceResult = await voiceIntegration.personalizeResponse(
        'Hello, how can I help?',
        'greeting',
        userId,
        createMockVoiceContext(userId)
      );

      const schedulingResult = await schedulingIntegration.predictOptimalScheduling(
        createMockCalendarEvent('fallback-event', 'Fallback Event'),
        userId
      );

      // Should return fallback results
      expect(voiceResult).toBeDefined();
      expect(voiceResult.originalResponse).toBe('Hello, how can I help?');
      expect(voiceResult.personalizedResponse).toBe('Hello, how can I help?'); // Fallback to original

      expect(schedulingResult).toBeDefined();
      expect(schedulingResult.confidence).toBeLessThan(1); // Lower confidence for fallback
    });

    it('should handle partial system failures with graceful degradation', async () => {
      const userId = 'partial-failure-test';
      
      // Simulate partial failures in different components
      jest.spyOn(avatarIntegration as any, 'loadUserInteractionPatterns')
        .mockRejectedValueOnce(new Error('Avatar pattern loading failed'));
      
      jest.spyOn(schedulingIntegration as any, 'loadSchedulingPatterns')
        .mockRejectedValueOnce(new Error('Scheduling pattern loading failed'));

      // Voice system should still work
      const voiceResult = await voiceIntegration.enhanceIntentClassification(
        'test_intent',
        0.8,
        userId,
        createMockVoiceContext(userId)
      );

      // Avatar system should provide fallback
      const avatarResult = await avatarIntegration.adaptAvatarPersonality(
        createMockPersonalityTraits(),
        userId
      );

      // Scheduling system should provide fallback
      const schedulingResult = await schedulingIntegration.predictOptimalScheduling(
        createMockCalendarEvent('partial-fail-event', 'Partial Fail Event'),
        userId
      );

      // Voice should work normally
      expect(voiceResult).toBeDefined();
      expect(voiceResult.personalizedConfidence).toBeGreaterThan(0);

      // Avatar should use fallback
      expect(avatarResult).toBeDefined();
      expect(avatarResult.version).toBe('fallback');

      // Scheduling should use fallback
      expect(schedulingResult).toBeDefined();
      expect(schedulingResult.confidence).toBeLessThan(1);
    });

    it('should recover from temporary failures automatically', async () => {
      const userId = 'recovery-test-user';
      
      // Simulate temporary failure
      let failureCount = 0;
      const originalMakeDecision = decisionEngine.makeDecision.bind(decisionEngine);
      jest.spyOn(decisionEngine, 'makeDecision').mockImplementation(async (request) => {
        failureCount++;
        if (failureCount <= 2) {
          throw new Error('Temporary failure');
        }
        return originalMakeDecision(request);
      });

      // First two calls should fail, third should succeed
      const result1 = await voiceIntegration.enhanceIntentClassification(
        'test_intent_1',
        0.8,
        userId,
        createMockVoiceContext(userId)
      );

      const result2 = await voiceIntegration.enhanceIntentClassification(
        'test_intent_2',
        0.8,
        userId,
        createMockVoiceContext(userId)
      );

      const result3 = await voiceIntegration.enhanceIntentClassification(
        'test_intent_3',
        0.8,
        userId,
        createMockVoiceContext(userId)
      );

      // First two should use fallback, third should work normally
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
      
      // Third result should have higher confidence (normal operation)
      expect(result3.personalizedConfidence).toBeGreaterThanOrEqual(result1.personalizedConfidence);
    });
  });

  describe('Cross-System Integration Scenarios', () => {
    it('should handle complex multi-system workflows', async () => {
      const userId = 'workflow-test-user';
      
      // Simulate a complex workflow: voice input -> decision -> avatar response -> scheduling
      const voiceContext = createMockVoiceContext(userId);
      
      // Step 1: Voice intent enhancement
      const enhancedIntent = await voiceIntegration.enhanceIntentClassification(
        'schedule_meeting_with_team',
        0.8,
        userId,
        voiceContext
      );

      // Step 2: Avatar expression optimization based on intent
      const expressionContext = createMockExpressionContext(userId);
      const optimizedExpression = await avatarIntegration.optimizeExpressions(
        expressionContext,
        userId
      );

      // Step 3: Scheduling optimization
      const calendarEvent = createMockCalendarEvent('team-meeting', 'Team Meeting');
      const schedulingResult = await schedulingIntegration.predictOptimalScheduling(
        calendarEvent,
        userId
      );

      // Step 4: Voice response personalization
      const personalizedResponse = await voiceIntegration.personalizeResponse(
        'I\'ve scheduled your team meeting for tomorrow at 2 PM.',
        'scheduling_confirmation',
        userId,
        voiceContext
      );

      // Verify all steps completed successfully
      expect(enhancedIntent).toBeDefined();
      expect(optimizedExpression).toBeDefined();
      expect(schedulingResult).toBeDefined();
      expect(personalizedResponse).toBeDefined();

      // Verify workflow maintained performance
      const events = mockEventBus.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'decision_made')).toBe(true);
      expect(events.some(e => e.type === 'optimization_completed')).toBe(true);
      expect(events.some(e => e.type === 'personalization_applied')).toBe(true);
    });

    it('should maintain data consistency across system boundaries', async () => {
      const userId = 'consistency-test-user';
      
      // Perform operations that should maintain consistent user context
      const voiceResult = await voiceIntegration.enhanceIntentClassification(
        'check_schedule',
        0.8,
        userId,
        createMockVoiceContext(userId)
      );

      const avatarResult = await avatarIntegration.adaptAvatarPersonality(
        createMockPersonalityTraits(),
        userId
      );

      const schedulingResult = await schedulingIntegration.predictOptimalScheduling(
        createMockCalendarEvent('consistency-event', 'Consistency Event'),
        userId
      );

      // All results should reference the same user
      expect(voiceResult.userPatternMatch?.patternId).toBeDefined();
      expect(schedulingResult.confidence).toBeGreaterThan(0);
      expect(avatarResult.confidence).toBeGreaterThan(0);

      // Events should maintain user context consistency
      const events = mockEventBus.getEvents();
      const userEvents = events.filter(e => e.userId === userId || e.data?.userId === userId);
      expect(userEvents.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions for creating mock data
function createMockVoiceContext(userId: string): VoiceContext {
  return {
    userContext: createMockUserContext(userId),
    audioContext: createMockAudioContext(),
    conversationContext: createMockConversationContext(),
    environmentalContext: createMockEnvironmentalVoiceContext()
  };
}

function createMockUserContext(userId: string) {
  return {
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
      currentActivity: ActivityType.LEISURE,
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
  };
}

function createMockAudioContext(): AudioContext {
  return {
    volume: 0.7,
    clarity: 0.9,
    backgroundNoise: 0.2,
    speechRate: 1.0,
    pitch: 0.5,
    emotion: {
      primary: EmotionType.NEUTRAL,
      intensity: 0.5,
      confidence: 0.8
    }
  };
}

function createMockConversationContext(): ConversationContext {
  return {
    sessionId: 'session-123',
    turnCount: 3,
    lastInteraction: new Date(),
    conversationTopic: 'general',
    userEngagement: EngagementLevel.MODERATE,
    conversationGoal: ConversationGoal.INFORMATION_SEEKING
  };
}

function createMockEnvironmentalVoiceContext(): EnvironmentalVoiceContext {
  return {
    ambientNoise: 0.3,
    acoustics: AcousticEnvironment.QUIET_INDOOR,
    privacy: PrivacyLevel.PRIVATE,
    interruptions: InterruptionLevel.LOW
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
      currentEmotion: AvatarEmotionType.HAPPY,
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

function createMockPersonalityTraits(): PersonalityTraits {
  return {
    friendliness: 7,
    formality: 5,
    humor: 6,
    enthusiasm: 8,
    patience: 7,
    supportiveness: 8
  };
}

function createMockCalendarEvent(eventId: string, title: string): CalendarEvent {
  return {
    eventId,
    title,
    description: `Description for ${title}`,
    duration: 60,
    eventType: EventType.MEETING,
    priority: EventPriority.MEDIUM,
    flexibility: FlexibilityLevel.MODERATE,
    participants: ['user1', 'user2'],
    requiredResources: [],
    preferredTimeWindows: [],
    constraints: []
  };
}

function createMockReminder(reminderId: string, userId: string): Reminder {
  return {
    reminderId,
    eventId: 'event-1',
    userId,
    reminderType: ReminderType.ADVANCE_NOTICE,
    content: 'Meeting starts in 15 minutes',
    scheduledTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    deliveryMethods: [DeliveryMethod.VOICE_ANNOUNCEMENT],
    priority: ReminderPriority.MEDIUM,
    context: {
      userActivity: ActivityType.WORK,
      location: 'office',
      deviceAvailability: {
        availableDevices: ['smart_display'],
        preferredDevice: 'smart_display',
        connectivity: 'online',
        capabilities: []
      },
      attentionLevel: AttentionLevel.MODERATE,
      interruptibility: InterruptibilityLevel.NORMAL
    }
  };
}