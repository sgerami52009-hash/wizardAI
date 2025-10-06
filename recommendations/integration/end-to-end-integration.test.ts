/**
 * End-to-End Integration Tests for Personalized Recommendations Engine
 * 
 * Tests complete recommendation workflows from context to delivery,
 * validates multi-user family recommendation scenarios, and tests
 * system integration with voice, avatar, and scheduling systems.
 * 
 * Requirements: 1.1, 4.1, 8.1, 8.3, 8.5
 */

import { RecommendationController } from '../controller';
import { ActivityRecommender } from '../engines/activity-recommender';
import { ScheduleOptimizer } from '../engines/schedule-optimizer';
import { EducationalRecommender } from '../engines/educational-recommender';
import { HouseholdEfficiencyEngine } from '../engines/household-efficiency-engine';
import { ContextAnalyzer } from '../analyzers/context-analyzer';
import { LearningEngine } from '../learning/learning-engine';
import { PrivacyManager } from '../privacy/privacy-manager';
import { IntegrationLayer } from './integration-layer';
import { ErrorRecoveryManager } from '../errors/error-recovery-manager';
import { PerformanceMonitor } from '../performance-monitor';
import { EnhancedSafetyValidator } from '../../avatar/enhanced-safety-validator';

import {
  UserContext,
  UserPreferences,
  UserFeedback,
  Recommendation,
  RecommendationHistory,
  TimeRange,
  SystemMetrics
} from '../types';

import {
  RecommendationType,
  InteractionType,
  ActivityCategory,
  DifficultyLevel,
  PrivacyLevel,
  Subject,
  SkillLevel
} from '../enums';

// Mock external system integrations for testing
jest.mock('../../avatar/system', () => ({
  avatarSystem: {
    isInitialized: jest.fn(() => true),
    getPersonalityTraits: jest.fn(() => ({
      friendliness: 8,
      formality: 5,
      humor: 7,
      enthusiasm: 6
    })),
    updateEmotionalState: jest.fn(),
    deliverRecommendation: jest.fn()
  }
}));

jest.mock('../../learning/voice-integration', () => ({
  voiceIntegration: {
    isAvailable: jest.fn(() => true),
    deliverVoiceRecommendation: jest.fn(),
    collectVoiceFeedback: jest.fn(),
    processNaturalLanguageRequest: jest.fn()
  }
}));

jest.mock('../../learning/scheduling-integration', () => ({
  schedulingIntegration: {
    isAvailable: jest.fn(() => true),
    getCalendarEvents: jest.fn(() => []),
    createCalendarEvent: jest.fn(),
    checkScheduleConflicts: jest.fn(() => [])
  }
}));

describe('End-to-End Recommendations Integration Tests', () => {
  let recommendationController: RecommendationController;
  let activityRecommender: ActivityRecommender;
  let scheduleOptimizer: ScheduleOptimizer;
  let educationalRecommender: EducationalRecommender;
  let householdEfficiencyEngine: HouseholdEfficiencyEngine;
  let contextAnalyzer: ContextAnalyzer;
  let learningEngine: LearningEngine;
  let privacyManager: PrivacyManager;
  let integrationLayer: IntegrationLayer;
  let errorRecoveryManager: ErrorRecoveryManager;
  let performanceMonitor: PerformanceMonitor;
  let safetyValidator: EnhancedSafetyValidator;

  // Test users for multi-user scenarios
  const testUsers = {
    parent: 'test-parent-001',
    child: 'test-child-001',
    teen: 'test-teen-001',
    family: 'test-family-001'
  };

  beforeAll(async () => {
    // Initialize all system components
    privacyManager = new PrivacyManager();
    safetyValidator = new EnhancedSafetyValidator();
    performanceMonitor = new PerformanceMonitor();
    errorRecoveryManager = new ErrorRecoveryManager(privacyManager);
    
    contextAnalyzer = new ContextAnalyzer(privacyManager);
    learningEngine = new LearningEngine(privacyManager, performanceMonitor);
    
    activityRecommender = new ActivityRecommender(
      contextAnalyzer,
      learningEngine,
      safetyValidator,
      privacyManager
    );
    
    scheduleOptimizer = new ScheduleOptimizer(
      contextAnalyzer,
      learningEngine,
      privacyManager
    );
    
    educationalRecommender = new EducationalRecommender(
      contextAnalyzer,
      learningEngine,
      safetyValidator,
      privacyManager
    );
    
    householdEfficiencyEngine = new HouseholdEfficiencyEngine(
      contextAnalyzer,
      learningEngine,
      privacyManager
    );
    
    integrationLayer = new IntegrationLayer();
    
    recommendationController = new RecommendationController(
      activityRecommender,
      scheduleOptimizer,
      educationalRecommender,
      householdEfficiencyEngine,
      contextAnalyzer,
      learningEngine,
      privacyManager,
      safetyValidator,
      errorRecoveryManager,
      performanceMonitor,
      integrationLayer
    );

    // Initialize test user profiles
    await initializeTestUserProfiles();
  });

  afterAll(async () => {
    // Clean up test data and shut down systems
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Reset system state before each test
    jest.clearAllMocks();
    await resetSystemState();
  });

  describe('Complete Recommendation Workflows', () => {
    /**
     * Test complete recommendation workflow from context analysis to delivery
     * Requirements: 1.1, 4.1
     */
    test('should complete full recommendation workflow for activity suggestions', async () => {
      // Arrange: Create realistic user context
      const userContext: UserContext = {
        userId: testUsers.parent,
        timestamp: new Date(),
        location: {
          type: 'home',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          weather: { condition: 'sunny', temperature: 22 },
          indoorOutdoor: 'indoor'
        },
        activity: {
          current: 'free_time',
          availableTime: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
          energyLevel: 'medium',
          mood: 'relaxed'
        },
        availability: {
          status: 'available',
          until: new Date(Date.now() + 2 * 60 * 60 * 1000),
          constraints: []
        },
        mood: {
          primary: 'content',
          energy: 'medium',
          stress: 'low'
        },
        energy: 'medium',
        social: {
          familyPresent: ['test-child-001'],
          preferredSocialLevel: 'family',
          groupSize: 2
        },
        environmental: {
          location: 'home',
          weather: { condition: 'sunny', temperature: 22 },
          timeOfDay: 'afternoon',
          season: 'spring'
        },
        preferences: {
          activityTypes: ['creative', 'educational'],
          difficultyLevel: 'medium',
          duration: 'medium',
          socialLevel: 'family'
        }
      };

      // Act: Request recommendations
      const startTime = Date.now();
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.ACTIVITY
      );
      const responseTime = Date.now() - startTime;

      // Assert: Verify complete workflow
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(10);
      expect(responseTime).toBeLessThan(2000); // Performance requirement

      // Verify recommendation quality
      for (const recommendation of recommendations) {
        expect(recommendation).toHaveProperty('id');
        expect(recommendation).toHaveProperty('type');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('confidence');
        expect(recommendation).toHaveProperty('reasoning');
        expect(recommendation).toHaveProperty('actionable');
        expect(recommendation).toHaveProperty('integrationActions');
        
        // Verify child safety validation
        expect(recommendation.metadata?.childSafe).toBe(true);
        
        // Verify contextual relevance
        expect(recommendation.confidence).toBeGreaterThan(0.5);
      }

      // Verify integration actions are present
      const hasIntegrationActions = recommendations.some(r => 
        r.integrationActions && r.integrationActions.length > 0
      );
      expect(hasIntegrationActions).toBe(true);
    });

    /**
     * Test educational recommendation workflow with parental controls
     * Requirements: 1.1, 3.2, 3.6
     */
    test('should complete educational recommendation workflow with safety validation', async () => {
      // Arrange: Create child user context
      const childContext: UserContext = {
        userId: testUsers.child,
        timestamp: new Date(),
        location: {
          type: 'home',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          weather: { condition: 'sunny', temperature: 22 },
          indoorOutdoor: 'indoor'
        },
        activity: {
          current: 'learning_time',
          availableTime: { start: new Date(), end: new Date(Date.now() + 60 * 60 * 1000) },
          energyLevel: 'high',
          mood: 'curious'
        },
        availability: {
          status: 'available',
          until: new Date(Date.now() + 60 * 60 * 1000),
          constraints: []
        },
        mood: {
          primary: 'curious',
          energy: 'high',
          stress: 'none'
        },
        energy: 'high',
        social: {
          familyPresent: [testUsers.parent],
          preferredSocialLevel: 'supervised',
          groupSize: 1
        },
        environmental: {
          location: 'home',
          weather: { condition: 'sunny', temperature: 22 },
          timeOfDay: 'morning',
          season: 'spring'
        },
        preferences: {
          activityTypes: ['educational', 'creative'],
          difficultyLevel: 'age_appropriate',
          duration: 'short',
          socialLevel: 'individual'
        }
      };

      // Act: Request educational recommendations
      const recommendations = await recommendationController.getRecommendations(
        testUsers.child,
        childContext,
        RecommendationType.EDUCATIONAL
      );

      // Assert: Verify educational workflow
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify all recommendations are child-safe and educational
      for (const recommendation of recommendations) {
        expect(recommendation.type).toBe(RecommendationType.EDUCATIONAL);
        expect(recommendation.metadata?.childSafe).toBe(true);
        expect(recommendation.metadata?.ageAppropriate).toBe(true);
        expect(recommendation.metadata?.parentalApprovalRequired).toBeDefined();
        expect(recommendation.metadata?.educationalValue).toBeGreaterThan(0.7);
      }

      // Verify parental oversight integration
      const parentalApprovalRequired = recommendations.some(r => 
        r.metadata?.parentalApprovalRequired === true
      );
      expect(parentalApprovalRequired).toBe(true);
    });

    /**
     * Test schedule optimization workflow with calendar integration
     * Requirements: 2.1, 8.1, 8.4
     */
    test('should complete schedule optimization workflow with calendar integration', async () => {
      // Arrange: Create context with scheduling needs
      const userContext: UserContext = {
        userId: testUsers.parent,
        timestamp: new Date(),
        location: {
          type: 'home',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          weather: { condition: 'cloudy', temperature: 18 },
          indoorOutdoor: 'indoor'
        },
        activity: {
          current: 'planning',
          availableTime: { start: new Date(), end: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          energyLevel: 'medium',
          mood: 'focused'
        },
        availability: {
          status: 'available',
          until: new Date(Date.now() + 24 * 60 * 60 * 1000),
          constraints: ['work_hours', 'family_time']
        },
        mood: {
          primary: 'focused',
          energy: 'medium',
          stress: 'medium'
        },
        energy: 'medium',
        social: {
          familyPresent: [testUsers.child],
          preferredSocialLevel: 'family',
          groupSize: 2
        },
        environmental: {
          location: 'home',
          weather: { condition: 'cloudy', temperature: 18 },
          timeOfDay: 'evening',
          season: 'spring'
        },
        preferences: {
          activityTypes: ['productivity', 'family'],
          difficultyLevel: 'medium',
          duration: 'flexible',
          socialLevel: 'family'
        }
      };

      // Act: Request schedule optimization
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.SCHEDULE
      );

      // Assert: Verify schedule optimization workflow
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify schedule-specific properties
      for (const recommendation of recommendations) {
        expect(recommendation.type).toBe(RecommendationType.SCHEDULE);
        expect(recommendation.metadata?.timeSlot).toBeDefined();
        expect(recommendation.metadata?.duration).toBeDefined();
        expect(recommendation.metadata?.priority).toBeDefined();
      }

      // Verify calendar integration actions
      const hasCalendarActions = recommendations.some(r =>
        r.integrationActions?.some(action => action.type === 'calendar')
      );
      expect(hasCalendarActions).toBe(true);
    });
  });

  describe('Multi-User Family Recommendation Scenarios', () => {
    /**
     * Test family activity coordination across multiple users
     * Requirements: 1.2, 4.3
     */
    test('should coordinate family activity recommendations across multiple users', async () => {
      // Arrange: Create family context with multiple members
      const familyMembers = [testUsers.parent, testUsers.child, testUsers.teen];
      const familyRecommendations: Map<string, Recommendation[]> = new Map();

      // Act: Get recommendations for each family member
      for (const userId of familyMembers) {
        const userContext = createFamilyMemberContext(userId);
        const recommendations = await recommendationController.getRecommendations(
          userId,
          userContext,
          RecommendationType.ACTIVITY
        );
        familyRecommendations.set(userId, recommendations);
      }

      // Assert: Verify family coordination
      expect(familyRecommendations.size).toBe(3);

      // Check for family-compatible activities
      const parentRecs = familyRecommendations.get(testUsers.parent) || [];
      const childRecs = familyRecommendations.get(testUsers.child) || [];
      const teenRecs = familyRecommendations.get(testUsers.teen) || [];

      // Verify family bonding activities are suggested
      const hasFamilyActivities = [parentRecs, childRecs, teenRecs].some(recs =>
        recs.some(rec => 
          rec.metadata?.socialLevel === 'family' || 
          rec.metadata?.familyBonding === true
        )
      );
      expect(hasFamilyActivities).toBe(true);

      // Verify age-appropriate filtering for child
      for (const rec of childRecs) {
        expect(rec.metadata?.childSafe).toBe(true);
        expect(rec.metadata?.ageAppropriate).toBe(true);
      }
    });

    /**
     * Test family preference coordination and conflict resolution
     * Requirements: 1.2, 6.3
     */
    test('should handle family preference conflicts and find compromise activities', async () => {
      // Arrange: Create conflicting preferences
      const parentContext = createFamilyMemberContext(testUsers.parent);
      parentContext.preferences = {
        activityTypes: ['educational', 'quiet'],
        difficultyLevel: 'high',
        duration: 'long',
        socialLevel: 'family'
      };

      const childContext = createFamilyMemberContext(testUsers.child);
      childContext.preferences = {
        activityTypes: ['active', 'fun'],
        difficultyLevel: 'easy',
        duration: 'short',
        socialLevel: 'family'
      };

      // Act: Get family recommendations
      const parentRecs = await recommendationController.getRecommendations(
        testUsers.parent,
        parentContext,
        RecommendationType.ACTIVITY
      );

      const childRecs = await recommendationController.getRecommendations(
        testUsers.child,
        childContext,
        RecommendationType.ACTIVITY
      );

      // Assert: Verify compromise solutions
      expect(parentRecs.length).toBeGreaterThan(0);
      expect(childRecs.length).toBeGreaterThan(0);

      // Look for compromise activities that balance preferences
      const compromiseActivities = parentRecs.filter(rec =>
        rec.metadata?.familyBonding === true &&
        rec.metadata?.balancesPreferences === true
      );

      expect(compromiseActivities.length).toBeGreaterThan(0);

      // Verify compromise activities meet safety requirements
      for (const activity of compromiseActivities) {
        expect(activity.metadata?.childSafe).toBe(true);
        expect(activity.confidence).toBeGreaterThan(0.6);
      }
    });

    /**
     * Test household efficiency recommendations for family coordination
     * Requirements: 5.1, 5.2, 5.3
     */
    test('should provide household efficiency recommendations for family coordination', async () => {
      // Arrange: Create household context
      const familyContext: UserContext = {
        userId: testUsers.family,
        timestamp: new Date(),
        location: {
          type: 'home',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          weather: { condition: 'rainy', temperature: 15 },
          indoorOutdoor: 'indoor'
        },
        activity: {
          current: 'household_management',
          availableTime: { start: new Date(), end: new Date(Date.now() + 4 * 60 * 60 * 1000) },
          energyLevel: 'medium',
          mood: 'organized'
        },
        availability: {
          status: 'available',
          until: new Date(Date.now() + 4 * 60 * 60 * 1000),
          constraints: []
        },
        mood: {
          primary: 'organized',
          energy: 'medium',
          stress: 'medium'
        },
        energy: 'medium',
        social: {
          familyPresent: [testUsers.parent, testUsers.child, testUsers.teen],
          preferredSocialLevel: 'family',
          groupSize: 3
        },
        environmental: {
          location: 'home',
          weather: { condition: 'rainy', temperature: 15 },
          timeOfDay: 'weekend_morning',
          season: 'spring'
        },
        preferences: {
          activityTypes: ['household', 'efficiency'],
          difficultyLevel: 'medium',
          duration: 'flexible',
          socialLevel: 'family'
        }
      };

      // Act: Get household efficiency recommendations
      const recommendations = await recommendationController.getRecommendations(
        testUsers.family,
        familyContext,
        RecommendationType.HOUSEHOLD
      );

      // Assert: Verify household efficiency recommendations
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify household-specific properties
      for (const recommendation of recommendations) {
        expect(recommendation.type).toBe(RecommendationType.HOUSEHOLD);
        expect(recommendation.metadata?.efficiencyGain).toBeDefined();
        expect(recommendation.metadata?.timesSaved).toBeGreaterThan(0);
        expect(recommendation.metadata?.stressReduction).toBeDefined();
      }

      // Verify family coordination aspects
      const familyCoordinatedTasks = recommendations.filter(rec =>
        rec.metadata?.requiresFamilyCoordination === true
      );
      expect(familyCoordinatedTasks.length).toBeGreaterThan(0);
    });
  });

  describe('System Integration Tests', () => {
    /**
     * Test avatar system integration for personalized delivery
     * Requirements: 8.3
     */
    test('should integrate with avatar system for personalized recommendation delivery', async () => {
      // Arrange: Create user context with avatar preferences
      const userContext = createFamilyMemberContext(testUsers.child);
      
      // Act: Get recommendations with avatar integration
      const recommendations = await recommendationController.getRecommendations(
        testUsers.child,
        userContext,
        RecommendationType.ACTIVITY
      );

      // Assert: Verify avatar integration
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify avatar-specific delivery actions
      const hasAvatarActions = recommendations.some(rec =>
        rec.integrationActions?.some(action => action.type === 'avatar')
      );
      expect(hasAvatarActions).toBe(true);

      // Verify personality-aware presentation
      for (const recommendation of recommendations) {
        expect(recommendation.metadata?.presentationStyle).toBeDefined();
        expect(recommendation.metadata?.emotionalTone).toBeDefined();
      }

      // Test avatar delivery simulation
      const avatarAction = recommendations[0].integrationActions?.find(
        action => action.type === 'avatar'
      );
      expect(avatarAction).toBeDefined();
      expect(avatarAction?.parameters).toHaveProperty('emotionalState');
      expect(avatarAction?.parameters).toHaveProperty('deliveryStyle');
    });

    /**
     * Test voice pipeline integration for natural interaction
     * Requirements: 8.5
     */
    test('should integrate with voice pipeline for natural recommendation interaction', async () => {
      // Arrange: Create voice-initiated context
      const userContext = createFamilyMemberContext(testUsers.parent);
      userContext.activity.current = 'voice_interaction';

      // Act: Get recommendations with voice integration
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext
      );

      // Assert: Verify voice integration
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify voice-specific delivery actions
      const hasVoiceActions = recommendations.some(rec =>
        rec.integrationActions?.some(action => action.type === 'voice')
      );
      expect(hasVoiceActions).toBe(true);

      // Verify natural language explanations
      for (const recommendation of recommendations) {
        expect(recommendation.reasoning).toBeDefined();
        expect(recommendation.reasoning.length).toBeGreaterThan(0);
        expect(recommendation.metadata?.voiceExplanation).toBeDefined();
      }

      // Test voice feedback collection
      const voiceAction = recommendations[0].integrationActions?.find(
        action => action.type === 'voice'
      );
      expect(voiceAction).toBeDefined();
      expect(voiceAction?.parameters).toHaveProperty('naturalLanguageResponse');
      expect(voiceAction?.parameters).toHaveProperty('feedbackPrompt');
    });

    /**
     * Test scheduling system integration for actionable suggestions
     * Requirements: 8.1, 8.4
     */
    test('should integrate with scheduling system for actionable recommendations', async () => {
      // Arrange: Create scheduling context
      const userContext = createFamilyMemberContext(testUsers.parent);
      userContext.activity.current = 'schedule_planning';

      // Act: Get schedule recommendations
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.SCHEDULE
      );

      // Assert: Verify scheduling integration
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify scheduling-specific actions
      const hasSchedulingActions = recommendations.some(rec =>
        rec.integrationActions?.some(action => action.type === 'calendar')
      );
      expect(hasSchedulingActions).toBe(true);

      // Verify actionable scheduling suggestions
      for (const recommendation of recommendations) {
        if (recommendation.type === RecommendationType.SCHEDULE) {
          expect(recommendation.actionable).toBe(true);
          expect(recommendation.metadata?.timeSlot).toBeDefined();
          expect(recommendation.metadata?.duration).toBeDefined();
        }
      }

      // Test calendar event creation
      const calendarAction = recommendations[0].integrationActions?.find(
        action => action.type === 'calendar'
      );
      expect(calendarAction).toBeDefined();
      expect(calendarAction?.parameters).toHaveProperty('eventDetails');
      expect(calendarAction?.parameters).toHaveProperty('timeSlot');
    });

    /**
     * Test smart home integration for automation suggestions
     * Requirements: 8.2, 8.6
     */
    test('should integrate with smart home systems for automation recommendations', async () => {
      // Arrange: Create smart home context
      const userContext = createFamilyMemberContext(testUsers.parent);
      userContext.environmental.smartDevices = [
        { type: 'lights', status: 'on', controllable: true },
        { type: 'thermostat', status: 'auto', controllable: true },
        { type: 'music_system', status: 'off', controllable: true }
      ];

      // Act: Get household recommendations with smart home integration
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.HOUSEHOLD
      );

      // Assert: Verify smart home integration
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify smart home automation actions
      const hasSmartHomeActions = recommendations.some(rec =>
        rec.integrationActions?.some(action => action.type === 'smart_home')
      );
      expect(hasSmartHomeActions).toBe(true);

      // Verify automation suggestions
      const automationRecs = recommendations.filter(rec =>
        rec.metadata?.automationOpportunity === true
      );
      expect(automationRecs.length).toBeGreaterThan(0);

      // Test device coordination
      const smartHomeAction = recommendations[0].integrationActions?.find(
        action => action.type === 'smart_home'
      );
      if (smartHomeAction) {
        expect(smartHomeAction.parameters).toHaveProperty('deviceActions');
        expect(smartHomeAction.parameters).toHaveProperty('automationTrigger');
      }
    });
  });

  describe('Performance and Error Handling', () => {
    /**
     * Test system performance under load
     * Requirements: 7.1, 7.2, 7.4
     */
    test('should maintain performance under concurrent recommendation requests', async () => {
      // Arrange: Create multiple concurrent requests
      const concurrentRequests = 5;
      const userContexts = Array.from({ length: concurrentRequests }, (_, i) => 
        createFamilyMemberContext(`test-user-${i}`)
      );

      // Act: Execute concurrent requests
      const startTime = Date.now();
      const promises = userContexts.map((context, i) =>
        recommendationController.getRecommendations(
          `test-user-${i}`,
          context
        )
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert: Verify performance requirements
      expect(results.length).toBe(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all requests succeeded
      for (const recommendations of results) {
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      }

      // Check memory usage
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      expect(memoryUsage).toBeLessThan(1500); // 1.5GB limit
    });

    /**
     * Test error recovery and fallback mechanisms
     * Requirements: 4.5, 7.5, 7.6
     */
    test('should handle errors gracefully with fallback recommendations', async () => {
      // Arrange: Create context that might trigger errors
      const userContext = createFamilyMemberContext(testUsers.parent);
      
      // Mock engine failure
      const originalMethod = activityRecommender.recommendActivities;
      activityRecommender.recommendActivities = jest.fn().mockRejectedValue(
        new Error('Engine failure')
      );

      // Act: Request recommendations despite engine failure
      const recommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.ACTIVITY
      );

      // Assert: Verify fallback behavior
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify fallback recommendations are marked appropriately
      const hasFallbackRecs = recommendations.some(rec =>
        rec.metadata?.isFallback === true
      );
      expect(hasFallbackRecs).toBe(true);

      // Restore original method
      activityRecommender.recommendActivities = originalMethod;
    });

    /**
     * Test privacy violation detection and remediation
     * Requirements: 6.1, 6.4, 6.5, 6.6
     */
    test('should detect and remediate privacy violations', async () => {
      // Arrange: Create context with privacy restrictions
      const userContext = createFamilyMemberContext(testUsers.child);
      
      // Set strict privacy preferences
      await privacyManager.updatePrivacySettings(testUsers.child, {
        dataMinimization: true,
        shareWithFamily: false,
        allowLearning: false,
        retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
        encryptionRequired: true
      });

      // Act: Request recommendations with privacy constraints
      const recommendations = await recommendationController.getRecommendations(
        testUsers.child,
        userContext
      );

      // Assert: Verify privacy compliance
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify privacy-preserving processing
      for (const recommendation of recommendations) {
        expect(recommendation.metadata?.privacyCompliant).toBe(true);
        expect(recommendation.metadata?.dataMinimized).toBe(true);
      }

      // Verify no unauthorized data sharing
      const hasDataSharing = recommendations.some(rec =>
        rec.metadata?.sharesPersonalData === true
      );
      expect(hasDataSharing).toBe(false);
    });
  });

  describe('Feedback and Learning Integration', () => {
    /**
     * Test end-to-end feedback processing and learning adaptation
     * Requirements: 1.4, 7.3, 7.5
     */
    test('should process feedback and adapt recommendations over time', async () => {
      // Arrange: Get initial recommendations
      const userContext = createFamilyMemberContext(testUsers.parent);
      const initialRecommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.ACTIVITY
      );

      expect(initialRecommendations.length).toBeGreaterThan(0);

      // Act: Submit positive feedback for some recommendations
      const positiveRec = initialRecommendations[0];
      const positiveFeedback: UserFeedback = {
        userId: testUsers.parent,
        recommendationId: positiveRec.id,
        rating: 5,
        completionRate: 1.0,
        timeSpent: 3600, // 1 hour
        contextAccuracy: 0.9,
        timestamp: new Date(),
        comments: 'Great suggestion!'
      };

      await recommendationController.submitFeedback(positiveRec.id, positiveFeedback);

      // Submit negative feedback for another recommendation
      if (initialRecommendations.length > 1) {
        const negativeRec = initialRecommendations[1];
        const negativeFeedback: UserFeedback = {
          userId: testUsers.parent,
          recommendationId: negativeRec.id,
          rating: 2,
          completionRate: 0.2,
          timeSpent: 300, // 5 minutes
          contextAccuracy: 0.4,
          timestamp: new Date(),
          comments: 'Not relevant'
        };

        await recommendationController.submitFeedback(negativeRec.id, negativeFeedback);
      }

      // Wait for learning adaptation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get new recommendations after feedback
      const adaptedRecommendations = await recommendationController.getRecommendations(
        testUsers.parent,
        userContext,
        RecommendationType.ACTIVITY
      );

      // Assert: Verify learning adaptation
      expect(adaptedRecommendations).toBeDefined();
      expect(adaptedRecommendations.length).toBeGreaterThan(0);

      // Verify recommendations have adapted based on feedback
      const hasImprovedRecommendations = adaptedRecommendations.some(rec =>
        rec.confidence > positiveRec.confidence
      );
      expect(hasImprovedRecommendations).toBe(true);

      // Verify feedback is reflected in recommendation history
      const history = await recommendationController.getRecommendationHistory(
        testUsers.parent,
        { start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() }
      );

      expect(history.recommendations.length).toBeGreaterThan(0);
      const feedbackRec = history.recommendations.find(r => r.id === positiveRec.id);
      expect(feedbackRec?.feedback).toBeDefined();
    });
  });

  // Helper functions for test setup

  async function initializeTestUserProfiles(): Promise<void> {
    // Initialize user preferences for test users
    const parentPreferences: UserPreferences = {
      userId: testUsers.parent,
      interests: [
        { category: 'education', subcategory: 'science', strength: 0.8, recency: new Date(), source: 'explicit' },
        { category: 'family', subcategory: 'bonding', strength: 0.9, recency: new Date(), source: 'behavior' }
      ],
      activityPreferences: {
        preferredCategories: [ActivityCategory.EDUCATIONAL, ActivityCategory.FAMILY],
        difficultyLevel: DifficultyLevel.MEDIUM,
        durationPreference: 'medium',
        socialPreference: 'family'
      },
      schedulePreferences: {
        preferredTimes: ['morning', 'evening'],
        flexibilityLevel: 'medium',
        priorityTypes: ['family', 'work', 'personal']
      },
      learningPreferences: {
        adaptationRate: 0.7,
        explorationRate: 0.3,
        feedbackSensitivity: 0.8
      },
      privacyPreferences: {
        dataMinimization: false,
        shareWithFamily: true,
        allowLearning: true,
        retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
        encryptionRequired: true
      },
      notificationPreferences: {
        enabled: true,
        frequency: 'moderate',
        channels: ['voice', 'avatar'],
        quietHours: { start: '22:00', end: '07:00' }
      },
      lastUpdated: new Date()
    };

    const childPreferences: UserPreferences = {
      userId: testUsers.child,
      interests: [
        { category: 'games', subcategory: 'educational', strength: 0.9, recency: new Date(), source: 'behavior' },
        { category: 'creative', subcategory: 'art', strength: 0.7, recency: new Date(), source: 'explicit' }
      ],
      activityPreferences: {
        preferredCategories: [ActivityCategory.EDUCATIONAL, ActivityCategory.CREATIVE],
        difficultyLevel: DifficultyLevel.EASY,
        durationPreference: 'short',
        socialPreference: 'family'
      },
      schedulePreferences: {
        preferredTimes: ['morning', 'afternoon'],
        flexibilityLevel: 'high',
        priorityTypes: ['learning', 'play', 'family']
      },
      learningPreferences: {
        adaptationRate: 0.8,
        explorationRate: 0.5,
        feedbackSensitivity: 0.9
      },
      privacyPreferences: {
        dataMinimization: true,
        shareWithFamily: true,
        allowLearning: true,
        retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
        encryptionRequired: true
      },
      notificationPreferences: {
        enabled: true,
        frequency: 'low',
        channels: ['avatar'],
        quietHours: { start: '20:00', end: '08:00' }
      },
      lastUpdated: new Date()
    };

    // Store preferences (would normally go through proper storage layer)
    await recommendationController.updateUserPreferences(testUsers.parent, parentPreferences);
    await recommendationController.updateUserPreferences(testUsers.child, childPreferences);
  }

  function createFamilyMemberContext(userId: string): UserContext {
    const baseContext: UserContext = {
      userId,
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        weather: { condition: 'sunny', temperature: 22 },
        indoorOutdoor: 'indoor'
      },
      activity: {
        current: 'free_time',
        availableTime: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
        energyLevel: 'medium',
        mood: 'content'
      },
      availability: {
        status: 'available',
        until: new Date(Date.now() + 2 * 60 * 60 * 1000),
        constraints: []
      },
      mood: {
        primary: 'content',
        energy: 'medium',
        stress: 'low'
      },
      energy: 'medium',
      social: {
        familyPresent: [testUsers.parent, testUsers.child],
        preferredSocialLevel: 'family',
        groupSize: 2
      },
      environmental: {
        location: 'home',
        weather: { condition: 'sunny', temperature: 22 },
        timeOfDay: 'afternoon',
        season: 'spring'
      },
      preferences: {
        activityTypes: ['family', 'educational'],
        difficultyLevel: 'medium',
        duration: 'medium',
        socialLevel: 'family'
      }
    };

    // Customize context based on user type
    if (userId === testUsers.child) {
      baseContext.activity.energyLevel = 'high';
      baseContext.mood.primary = 'curious';
      baseContext.preferences.difficultyLevel = 'easy';
      baseContext.preferences.duration = 'short';
    } else if (userId === testUsers.teen) {
      baseContext.activity.energyLevel = 'high';
      baseContext.mood.primary = 'social';
      baseContext.preferences.activityTypes = ['social', 'creative'];
      baseContext.preferences.socialLevel = 'peer';
    }

    return baseContext;
  }

  async function resetSystemState(): Promise<void> {
    // Clear any cached data or state between tests
    // This would typically involve clearing caches, resetting counters, etc.
  }

  async function cleanupTestData(): Promise<void> {
    // Clean up any test data created during tests
    // This would typically involve removing test user data, clearing databases, etc.
  }
});