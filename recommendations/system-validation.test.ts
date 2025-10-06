/**
 * System Validation and Acceptance Tests
 * 
 * Comprehensive tests for complete system functionality, performance requirements,
 * and user experience validation for the personalized recommendations engine.
 * 
 * Requirements Coverage:
 * - 1.1: Personalized activity recommendations
 * - 2.1: Schedule optimization and conflict resolution
 * - 3.1: Educational content recommendations
 * - 4.1: Contextual recommendation adaptation
 * - 5.1: Household efficiency improvements
 * - 6.1: Privacy-preserving recommendations
 * - 7.1: Hardware performance constraints
 * - 8.1: System integration capabilities
 */

import { RecommendationController } from './controller';
import { ContextAnalyzer } from './analyzers/context-analyzer';
import { UserPreferenceEngine } from './engines/user-preference-engine';
import { ActivityRecommender } from './engines/activity-recommender';
import { ScheduleOptimizer } from './engines/schedule-optimizer';
import { EducationalRecommender } from './engines/educational-recommender';
import { HouseholdEfficiencyEngine } from './engines/household-efficiency-engine';
import { PrivacyManager } from './privacy/privacy-manager';
import { PerformanceMonitor } from './performance-monitor';
import { IntegrationLayer } from './integration/integration-layer';
import { 
  RecommendationType, 
  UserContext, 
  UserPreferences,
  ActivityContext,
  LearningContext,
  SchedulingConstraints,
  PrivacyLevel,
  PerformanceConstraints
} from './types';

describe('System Validation and Acceptance Tests', () => {
  let controller: RecommendationController;
  let contextAnalyzer: ContextAnalyzer;
  let preferenceEngine: UserPreferenceEngine;
  let activityRecommender: ActivityRecommender;
  let scheduleOptimizer: ScheduleOptimizer;
  let educationalRecommender: EducationalRecommender;
  let householdEngine: HouseholdEfficiencyEngine;
  let privacyManager: PrivacyManager;
  let performanceMonitor: PerformanceMonitor;
  let integrationLayer: IntegrationLayer;

  beforeEach(async () => {
    // Initialize all system components
    contextAnalyzer = new ContextAnalyzer();
    preferenceEngine = new UserPreferenceEngine();
    activityRecommender = new ActivityRecommender();
    scheduleOptimizer = new ScheduleOptimizer();
    educationalRecommender = new EducationalRecommender();
    householdEngine = new HouseholdEfficiencyEngine();
    privacyManager = new PrivacyManager();
    performanceMonitor = new PerformanceMonitor();
    integrationLayer = new IntegrationLayer();

    controller = new RecommendationController({
      contextAnalyzer,
      preferenceEngine,
      activityRecommender,
      scheduleOptimizer,
      educationalRecommender,
      householdEngine,
      privacyManager,
      performanceMonitor,
      integrationLayer
    });

    await controller.initialize();
  });

  afterEach(async () => {
    await controller.shutdown();
  });

  describe('Complete System Functionality Tests', () => {
    describe('Requirement 1.1: Personalized Activity Recommendations', () => {
      it('should generate personalized activity recommendations based on user preferences', async () => {
        // Setup test user with specific preferences
        const userId = 'test-user-1';
        const userPreferences: UserPreferences = {
          userId,
          interests: [
            { category: 'sports', subcategory: 'hiking', strength: 0.9, recency: new Date(), source: 'explicit' },
            { category: 'arts', subcategory: 'photography', strength: 0.7, recency: new Date(), source: 'implicit' }
          ],
          activityPreferences: {
            preferredDuration: { min: 30, max: 120 },
            difficultyLevel: 'intermediate',
            socialPreference: 'small_group',
            indoorOutdoorPreference: 'outdoor'
          },
          schedulePreferences: {
            preferredTimes: ['morning', 'evening'],
            weekendAvailability: true,
            flexibilityLevel: 'moderate'
          },
          learningPreferences: {
            learningStyle: 'visual',
            pacePreference: 'self_paced',
            interactivityLevel: 'high'
          },
          privacyPreferences: {
            dataSharing: 'family_only',
            locationTracking: 'limited',
            behaviorAnalysis: 'enabled'
          },
          notificationPreferences: {
            frequency: 'daily',
            channels: ['voice', 'visual'],
            quietHours: { start: '22:00', end: '07:00' }
          },
          lastUpdated: new Date()
        };

        await preferenceEngine.updateUserPreferences(userId, userPreferences);

        // Create realistic context
        const context: UserContext = {
          userId,
          timestamp: new Date(),
          location: {
            type: 'home',
            coordinates: { lat: 40.7128, lng: -74.0060 },
            weather: { condition: 'sunny', temperature: 22, humidity: 0.6 }
          },
          activity: {
            current: 'free_time',
            energy: 0.8,
            availability: { start: new Date(), duration: 90 }
          },
          availability: {
            timeSlots: [{ start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }],
            constraints: []
          },
          mood: {
            energy: 0.8,
            social: 0.6,
            focus: 0.7
          },
          energy: 0.8,
          social: {
            familyPresent: ['spouse'],
            friendsAvailable: [],
            socialDesire: 0.6
          },
          environmental: {
            weather: { condition: 'sunny', temperature: 22 },
            timeOfDay: 'morning',
            season: 'spring',
            dayOfWeek: 'saturday'
          },
          preferences: {
            immediateGoals: ['exercise', 'relaxation'],
            avoidances: ['crowded_places'],
            priorities: ['health', 'family_time']
          }
        };

        // Get recommendations
        const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);

        // Validate recommendations
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations.length).toBeLessThanOrEqual(5);

        // Check recommendation quality
        const topRecommendation = recommendations[0];
        expect(topRecommendation.confidence).toBeGreaterThan(0.6);
        expect(topRecommendation.reasoning).toBeDefined();
        expect(topRecommendation.reasoning.length).toBeGreaterThan(0);

        // Verify personalization
        const hasPersonalizedContent = recommendations.some(rec => 
          rec.metadata.categories?.includes('hiking') || 
          rec.metadata.categories?.includes('photography')
        );
        expect(hasPersonalizedContent).toBe(true);

        // Verify contextual relevance
        const hasContextualRelevance = recommendations.some(rec =>
          rec.metadata.weatherSuitable === true &&
          rec.metadata.timeAppropriate === true
        );
        expect(hasContextualRelevance).toBe(true);
      });

      it('should learn from user feedback and improve recommendations', async () => {
        const userId = 'test-user-feedback';
        
        // Get initial recommendations
        const context: UserContext = createTestContext(userId);
        const initialRecommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        
        // Simulate user feedback
        for (const rec of initialRecommendations.slice(0, 3)) {
          await controller.submitFeedback(rec.id, {
            userId,
            recommendationId: rec.id,
            rating: rec.title.includes('hiking') ? 5 : 2,
            accepted: rec.title.includes('hiking'),
            completed: rec.title.includes('hiking'),
            feedback: rec.title.includes('hiking') ? 'loved_it' : 'not_interested',
            timestamp: new Date()
          });
        }

        // Wait for learning to process
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get new recommendations
        const improvedRecommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);

        // Verify improvement
        const hikingRecommendations = improvedRecommendations.filter(rec => 
          rec.title.toLowerCase().includes('hiking') || 
          rec.metadata.categories?.includes('hiking')
        );
        
        expect(hikingRecommendations.length).toBeGreaterThan(0);
        expect(hikingRecommendations[0].confidence).toBeGreaterThan(0.7);
      });
    });

    describe('Requirement 2.1: Schedule Optimization', () => {
      it('should optimize schedules and resolve conflicts intelligently', async () => {
        const userId = 'test-scheduler';
        
        // Create schedule with conflicts
        const constraints: SchedulingConstraints = {
          timeRange: {
            start: new Date(),
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
          },
          existingEvents: [
            {
              id: 'meeting1',
              title: 'Work Meeting',
              start: new Date(Date.now() + 2 * 60 * 60 * 1000),
              end: new Date(Date.now() + 3 * 60 * 60 * 1000),
              priority: 'high',
              flexibility: 'none'
            },
            {
              id: 'meeting2',
              title: 'Doctor Appointment',
              start: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
              end: new Date(Date.now() + 3.5 * 60 * 60 * 1000),
              priority: 'high',
              flexibility: 'low'
            }
          ],
          preferences: {
            workingHours: { start: '09:00', end: '17:00' },
            breakPreferences: { duration: 15, frequency: 120 },
            travelTime: { default: 30, bufferMultiplier: 1.2 }
          },
          constraints: [
            { type: 'no_back_to_back', severity: 'warning' },
            { type: 'travel_time_required', severity: 'error' }
          ]
        };

        const optimizations = await scheduleOptimizer.optimizeSchedule(userId, constraints.timeRange);

        expect(optimizations).toBeDefined();
        expect(optimizations.length).toBeGreaterThan(0);

        // Check conflict detection
        const conflictOptimization = optimizations.find(opt => 
          opt.type === 'conflict_resolution'
        );
        expect(conflictOptimization).toBeDefined();
        expect(conflictOptimization!.impact.timesSaved).toBeGreaterThan(0);

        // Verify alternative suggestions
        const alternatives = await scheduleOptimizer.suggestAlternativeTimes(
          constraints.existingEvents[1],
          constraints
        );
        
        expect(alternatives).toBeDefined();
        expect(alternatives.length).toBeGreaterThan(0);
        expect(alternatives[0].conflictFree).toBe(true);
      });

      it('should provide routine optimization suggestions', async () => {
        const userId = 'test-routine-optimizer';
        
        const routineRecommendations = await scheduleOptimizer.recommendRoutineImprovements(userId);

        expect(routineRecommendations).toBeDefined();
        expect(routineRecommendations.length).toBeGreaterThan(0);

        // Verify routine improvements
        const timeOptimization = routineRecommendations.find(rec =>
          rec.category === 'time_optimization'
        );
        expect(timeOptimization).toBeDefined();
        expect(timeOptimization!.estimatedTimeSavings).toBeGreaterThan(0);

        // Check stress reduction suggestions
        const stressReduction = routineRecommendations.find(rec =>
          rec.category === 'stress_reduction'
        );
        expect(stressReduction).toBeDefined();
        expect(stressReduction!.stressImpactReduction).toBeGreaterThan(0);
      });
    });

    describe('Requirement 3.1: Educational Content Recommendations', () => {
      it('should provide age-appropriate educational recommendations', async () => {
        const childId = 'test-child-8yo';
        
        const learningContext: LearningContext = {
          childId,
          age: 8,
          gradeLevel: 3,
          currentSubjects: ['math', 'reading', 'science'],
          learningGoals: [
            { subject: 'math', skill: 'multiplication', targetLevel: 'proficient' },
            { subject: 'reading', skill: 'comprehension', targetLevel: 'advanced' }
          ],
          learningStyle: 'visual',
          attentionSpan: 20,
          preferredDifficulty: 'grade_appropriate',
          recentPerformance: {
            math: { accuracy: 0.85, engagement: 0.9 },
            reading: { accuracy: 0.92, engagement: 0.8 }
          },
          availableTime: 30,
          deviceCapabilities: ['touch', 'audio', 'visual'],
          parentalSettings: {
            contentFiltering: 'strict',
            timeRestrictions: { maxDaily: 60, maxSession: 30 },
            approvalRequired: true
          }
        };

        const educationalRecs = await educationalRecommender.recommendEducationalContent(childId, learningContext);

        expect(educationalRecs).toBeDefined();
        expect(educationalRecs.length).toBeGreaterThan(0);

        // Verify age appropriateness
        educationalRecs.forEach(rec => {
          expect(rec.ageRange.min).toBeLessThanOrEqual(8);
          expect(rec.ageRange.max).toBeGreaterThanOrEqual(8);
          expect(rec.educationalValue.developmentallyAppropriate).toBe(true);
        });

        // Check learning objective alignment
        const mathRec = educationalRecs.find(rec => rec.subject === 'math');
        expect(mathRec).toBeDefined();
        expect(mathRec!.learningObjectives.some(obj => obj.skill === 'multiplication')).toBe(true);

        // Verify parental approval requirement
        const approvalRequired = educationalRecs.some(rec => rec.parentalApprovalRequired);
        expect(approvalRequired).toBe(true);
      });

      it('should adapt to learning progress and adjust difficulty', async () => {
        const childId = 'test-adaptive-learner';
        
        // Simulate learning progress
        const learningResults = {
          activityId: 'math-multiplication-1',
          childId,
          completionTime: 15,
          accuracy: 0.95,
          engagement: 0.9,
          difficultyRating: 'too_easy',
          helpRequested: false,
          timestamp: new Date()
        };

        await educationalRecommender.trackLearningProgress(childId, 'math-multiplication-1', learningResults);

        // Get new recommendations
        const context: LearningContext = createTestLearningContext(childId);
        const adaptedRecs = await educationalRecommender.recommendEducationalContent(childId, context);

        // Verify difficulty adaptation
        const mathRecs = adaptedRecs.filter(rec => rec.subject === 'math');
        expect(mathRecs.length).toBeGreaterThan(0);
        
        const hasIncreasedDifficulty = mathRecs.some(rec => 
          rec.skillLevel === 'advanced' || rec.skillLevel === 'challenging'
        );
        expect(hasIncreasedDifficulty).toBe(true);
      });
    });

    describe('Requirement 4.1: Contextual Adaptation', () => {
      it('should adapt recommendations based on changing context', async () => {
        const userId = 'test-contextual-user';
        
        // Morning context
        const morningContext: UserContext = {
          ...createTestContext(userId),
          environmental: {
            weather: { condition: 'sunny', temperature: 18 },
            timeOfDay: 'morning',
            season: 'spring',
            dayOfWeek: 'monday'
          },
          mood: { energy: 0.9, social: 0.5, focus: 0.8 }
        };

        const morningRecs = await controller.getRecommendations(userId, morningContext, RecommendationType.ACTIVITY);

        // Evening context
        const eveningContext: UserContext = {
          ...morningContext,
          environmental: {
            ...morningContext.environmental,
            timeOfDay: 'evening'
          },
          mood: { energy: 0.4, social: 0.8, focus: 0.5 }
        };

        const eveningRecs = await controller.getRecommendations(userId, eveningContext, RecommendationType.ACTIVITY);

        // Verify contextual differences
        expect(morningRecs).not.toEqual(eveningRecs);
        
        // Morning should have more energetic activities
        const morningEnergeticRecs = morningRecs.filter(rec => 
          rec.metadata.energyLevel === 'high' || rec.metadata.energyLevel === 'medium'
        );
        expect(morningEnergeticRecs.length).toBeGreaterThan(0);

        // Evening should have more relaxing activities
        const eveningRelaxingRecs = eveningRecs.filter(rec =>
          rec.metadata.energyLevel === 'low' || rec.metadata.categories?.includes('relaxation')
        );
        expect(eveningRelaxingRecs.length).toBeGreaterThan(0);
      });

      it('should detect and respond to contextual triggers', async () => {
        const userId = 'test-trigger-user';
        
        // Simulate weather change trigger
        const contextData = {
          userId,
          timestamp: new Date(),
          location: { lat: 40.7128, lng: -74.0060 },
          weather: { condition: 'rain', temperature: 15, humidity: 0.9 },
          activity: 'planning_outdoor_activity',
          mood: { energy: 0.7, social: 0.6, focus: 0.8 }
        };

        await contextAnalyzer.updateContextModel(userId, contextData);
        
        const triggers = await contextAnalyzer.detectContextualTriggers(userId);
        
        expect(triggers).toBeDefined();
        expect(triggers.length).toBeGreaterThan(0);

        // Should detect weather-based trigger
        const weatherTrigger = triggers.find(trigger => 
          trigger.type === 'weather_change' && trigger.severity === 'high'
        );
        expect(weatherTrigger).toBeDefined();

        // Get context-adapted recommendations
        const context = await contextAnalyzer.analyzeCurrentContext(userId);
        const adaptedRecs = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);

        // Should suggest indoor alternatives
        const indoorRecs = adaptedRecs.filter(rec => 
          rec.metadata.location === 'indoor' || rec.metadata.weatherIndependent === true
        );
        expect(indoorRecs.length).toBeGreaterThan(0);
      });
    });

    describe('Requirement 5.1: Household Efficiency', () => {
      it('should identify and recommend household efficiency improvements', async () => {
        const familyId = 'test-family-efficiency';
        
        const efficiencyAnalysis = await householdEngine.analyzeHouseholdPatterns(familyId);
        
        expect(efficiencyAnalysis).toBeDefined();
        expect(efficiencyAnalysis.inefficiencies).toBeDefined();
        expect(efficiencyAnalysis.inefficiencies.length).toBeGreaterThan(0);

        // Get optimization recommendations
        const optimizations = await householdEngine.recommendTaskOptimizations(familyId);
        
        expect(optimizations).toBeDefined();
        expect(optimizations.length).toBeGreaterThan(0);

        // Verify time savings
        const totalTimeSavings = optimizations.reduce((sum, opt) => sum + opt.timeSavings, 0);
        expect(totalTimeSavings).toBeGreaterThan(0);

        // Check automation opportunities
        const automationSuggestions = await householdEngine.suggestAutomationOpportunities(familyId);
        
        expect(automationSuggestions).toBeDefined();
        expect(automationSuggestions.length).toBeGreaterThan(0);

        // Verify automation feasibility
        const feasibleAutomations = automationSuggestions.filter(suggestion =>
          suggestion.feasibilityScore > 0.7
        );
        expect(feasibleAutomations.length).toBeGreaterThan(0);
      });

      it('should optimize supply management and resource tracking', async () => {
        const familyId = 'test-supply-family';
        
        const supplyOptimizations = await householdEngine.optimizeSupplyManagement(familyId);
        
        expect(supplyOptimizations).toBeDefined();
        expect(supplyOptimizations.length).toBeGreaterThan(0);

        // Verify supply predictions
        const supplyPredictions = supplyOptimizations.filter(opt =>
          opt.type === 'supply_prediction'
        );
        expect(supplyPredictions.length).toBeGreaterThan(0);

        // Check cost optimization
        const costOptimizations = supplyOptimizations.filter(opt =>
          opt.estimatedSavings > 0
        );
        expect(costOptimizations.length).toBeGreaterThan(0);
      });
    });

    describe('Requirement 6.1: Privacy Protection', () => {
      it('should enforce privacy preferences and protect user data', async () => {
        const userId = 'test-privacy-user';
        
        // Set strict privacy preferences
        const privacySettings = {
          userId,
          dataSharing: PrivacyLevel.NONE,
          locationTracking: PrivacyLevel.LIMITED,
          behaviorAnalysis: PrivacyLevel.ANONYMIZED,
          dataRetention: 30, // days
          consentRequired: true,
          auditLogging: true
        };

        await privacyManager.updatePrivacySettings(userId, privacySettings);

        // Test data operation
        const dataOperation = {
          type: 'recommendation_generation',
          userId,
          dataTypes: ['preferences', 'behavior', 'location'],
          purpose: 'personalization',
          retention: 90
        };

        const privacyDecision = await privacyManager.enforcePrivacyPreferences(userId, dataOperation);

        expect(privacyDecision).toBeDefined();
        expect(privacyDecision.allowed).toBe(true);
        expect(privacyDecision.restrictions).toBeDefined();
        expect(privacyDecision.anonymizationRequired).toBe(true);

        // Verify data anonymization
        const userData = {
          userId,
          preferences: { interests: ['hiking', 'photography'] },
          location: { lat: 40.7128, lng: -74.0060 },
          behavior: { clickPattern: 'morning_active' }
        };

        const anonymizedData = await privacyManager.anonymizeUserData(userData, PrivacyLevel.ANONYMIZED);
        
        expect(anonymizedData.userId).not.toBe(userId);
        expect(anonymizedData.location).toBeUndefined();
        expect(anonymizedData.preferences).toBeDefined();
      });

      it('should audit data usage and maintain compliance', async () => {
        const userId = 'test-audit-user';
        
        // Simulate data operations
        const operations = [
          { type: 'data_read', timestamp: new Date(), purpose: 'recommendation' },
          { type: 'data_process', timestamp: new Date(), purpose: 'learning' },
          { type: 'data_store', timestamp: new Date(), purpose: 'personalization' }
        ];

        // Get audit report
        const timeRange = {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        };

        const auditReport = await privacyManager.auditDataUsage(userId, timeRange);

        expect(auditReport).toBeDefined();
        expect(auditReport.operations).toBeDefined();
        expect(auditReport.complianceStatus).toBe('compliant');
        expect(auditReport.violations).toHaveLength(0);
      });
    });
  });

  describe('Performance Requirements Validation', () => {
    describe('Requirement 7.1: Hardware Performance Constraints', () => {
      it('should operate within memory constraints (< 1.5GB)', async () => {
        const userId = 'test-performance-user';
        
        // Monitor memory usage during operations
        const initialMemory = await performanceMonitor.getCurrentMemoryUsage();
        
        // Perform intensive operations
        const context = createTestContext(userId);
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
          promises.push(controller.getRecommendations(userId, context, RecommendationType.ACTIVITY));
          promises.push(controller.getRecommendations(userId, context, RecommendationType.SCHEDULE));
          promises.push(controller.getRecommendations(userId, context, RecommendationType.EDUCATIONAL));
        }

        await Promise.all(promises);
        
        const peakMemory = await performanceMonitor.getPeakMemoryUsage();
        const memoryIncrease = peakMemory - initialMemory;
        
        // Should not exceed 1.5GB (1536MB)
        expect(memoryIncrease).toBeLessThan(1536);
        
        // Verify memory cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        const finalMemory = await performanceMonitor.getCurrentMemoryUsage();
        expect(finalMemory).toBeLessThan(peakMemory);
      });

      it('should generate recommendations within 2 seconds', async () => {
        const userId = 'test-latency-user';
        const context = createTestContext(userId);
        
        const startTime = Date.now();
        const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        const endTime = Date.now();
        
        const latency = endTime - startTime;
        
        expect(latency).toBeLessThan(2000); // 2 seconds
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });

      it('should handle concurrent requests efficiently', async () => {
        const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
        const contexts = userIds.map(id => createTestContext(id));
        
        const startTime = Date.now();
        
        const promises = userIds.map((userId, index) =>
          controller.getRecommendations(userId, contexts[index], RecommendationType.ACTIVITY)
        );
        
        const results = await Promise.all(promises);
        const endTime = Date.now();
        
        const totalLatency = endTime - startTime;
        const averageLatency = totalLatency / userIds.length;
        
        // Average latency should still be reasonable
        expect(averageLatency).toBeLessThan(3000);
        
        // All requests should succeed
        results.forEach(recommendations => {
          expect(recommendations).toBeDefined();
          expect(recommendations.length).toBeGreaterThan(0);
        });
      });

      it('should maintain performance under resource constraints', async () => {
        const userId = 'test-constrained-user';
        
        // Simulate resource constraints
        const constraints: PerformanceConstraints = {
          maxMemoryMB: 512,
          maxCpuPercent: 50,
          maxLatencyMs: 1500,
          maxConcurrentRequests: 3
        };

        await performanceMonitor.setPerformanceConstraints(constraints);
        
        const context = createTestContext(userId);
        const startTime = Date.now();
        
        const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        expect(latency).toBeLessThan(constraints.maxLatencyMs);
        expect(recommendations).toBeDefined();
        
        // Verify resource usage
        const resourceUsage = await performanceMonitor.getCurrentResourceUsage();
        expect(resourceUsage.memoryMB).toBeLessThan(constraints.maxMemoryMB);
        expect(resourceUsage.cpuPercent).toBeLessThan(constraints.maxCpuPercent);
      });
    });
  });

  describe('User Experience and Recommendation Quality', () => {
    describe('Requirement 8.1: System Integration', () => {
      it('should integrate seamlessly with voice pipeline', async () => {
        const userId = 'test-voice-user';
        
        // Test voice-based recommendation request
        const voiceRequest = {
          userId,
          intent: 'get_activity_recommendation',
          entities: {
            timeAvailable: '30 minutes',
            mood: 'energetic',
            location: 'home'
          },
          confidence: 0.9
        };

        const voiceResponse = await integrationLayer.processVoiceRequest(voiceRequest);
        
        expect(voiceResponse).toBeDefined();
        expect(voiceResponse.success).toBe(true);
        expect(voiceResponse.recommendations).toBeDefined();
        expect(voiceResponse.naturalLanguageResponse).toBeDefined();
        
        // Verify natural language explanation
        expect(voiceResponse.naturalLanguageResponse.length).toBeGreaterThan(0);
        expect(voiceResponse.naturalLanguageResponse).toContain('recommend');
      });

      it('should integrate with avatar system for personalized delivery', async () => {
        const userId = 'test-avatar-user';
        const context = createTestContext(userId);
        
        const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        
        // Test avatar integration
        const avatarDelivery = await integrationLayer.prepareAvatarDelivery(userId, recommendations[0]);
        
        expect(avatarDelivery).toBeDefined();
        expect(avatarDelivery.personalityAdaptation).toBeDefined();
        expect(avatarDelivery.emotionalTone).toBeDefined();
        expect(avatarDelivery.visualPresentation).toBeDefined();
        
        // Verify personality-based adaptation
        expect(avatarDelivery.personalityAdaptation.enthusiasm).toBeGreaterThan(0);
        expect(avatarDelivery.personalityAdaptation.formality).toBeDefined();
      });

      it('should integrate with scheduling system for actionable suggestions', async () => {
        const userId = 'test-scheduling-user';
        const context = createTestContext(userId);
        
        const scheduleRecs = await controller.getRecommendations(userId, context, RecommendationType.SCHEDULE);
        
        // Test scheduling integration
        const schedulingActions = await integrationLayer.prepareSchedulingActions(userId, scheduleRecs[0]);
        
        expect(schedulingActions).toBeDefined();
        expect(schedulingActions.calendarEvents).toBeDefined();
        expect(schedulingActions.calendarEvents.length).toBeGreaterThan(0);
        
        // Verify calendar event creation
        const calendarEvent = schedulingActions.calendarEvents[0];
        expect(calendarEvent.title).toBeDefined();
        expect(calendarEvent.start).toBeDefined();
        expect(calendarEvent.end).toBeDefined();
        expect(calendarEvent.description).toBeDefined();
      });

      it('should coordinate with smart home devices', async () => {
        const userId = 'test-smarthome-user';
        const familyId = 'test-smarthome-family';
        
        const householdRecs = await householdEngine.recommendTaskOptimizations(familyId);
        
        // Test smart home integration
        const automationActions = await integrationLayer.prepareSmartHomeActions(householdRecs[0]);
        
        expect(automationActions).toBeDefined();
        expect(automationActions.deviceActions).toBeDefined();
        
        // Verify device coordination
        if (automationActions.deviceActions.length > 0) {
          const deviceAction = automationActions.deviceActions[0];
          expect(deviceAction.deviceId).toBeDefined();
          expect(deviceAction.action).toBeDefined();
          expect(deviceAction.parameters).toBeDefined();
        }
      });
    });

    it('should provide high-quality, relevant recommendations', async () => {
      const userId = 'test-quality-user';
      const context = createTestContext(userId);
      
      // Get recommendations across all types
      const activityRecs = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
      const scheduleRecs = await controller.getRecommendations(userId, context, RecommendationType.SCHEDULE);
      const educationalRecs = await controller.getRecommendations(userId, context, RecommendationType.EDUCATIONAL);
      
      // Verify recommendation quality metrics
      [activityRecs, scheduleRecs, educationalRecs].forEach(recommendations => {
        expect(recommendations.length).toBeGreaterThan(0);
        
        recommendations.forEach(rec => {
          // Quality thresholds
          expect(rec.confidence).toBeGreaterThan(0.5);
          expect(rec.reasoning).toBeDefined();
          expect(rec.reasoning.length).toBeGreaterThan(0);
          
          // Relevance indicators
          expect(rec.title).toBeDefined();
          expect(rec.description).toBeDefined();
          expect(rec.metadata).toBeDefined();
          
          // Actionability
          expect(rec.actionable).toBeDefined();
          if (rec.actionable) {
            expect(rec.integrationActions).toBeDefined();
            expect(rec.integrationActions.length).toBeGreaterThan(0);
          }
        });
      });
    });

    it('should maintain recommendation diversity and avoid filter bubbles', async () => {
      const userId = 'test-diversity-user';
      const context = createTestContext(userId);
      
      // Get multiple recommendation sets
      const recommendationSets = [];
      for (let i = 0; i < 5; i++) {
        const recs = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        recommendationSets.push(recs);
        
        // Small delay to allow for variation
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Analyze diversity
      const allRecommendations = recommendationSets.flat();
      const uniqueTitles = new Set(allRecommendations.map(rec => rec.title));
      const uniqueCategories = new Set(allRecommendations.map(rec => rec.metadata.primaryCategory));
      
      // Should have reasonable diversity
      const diversityRatio = uniqueTitles.size / allRecommendations.length;
      expect(diversityRatio).toBeGreaterThan(0.3); // At least 30% unique
      
      expect(uniqueCategories.size).toBeGreaterThan(1); // Multiple categories
    });
  });

  // Helper functions
  function createTestContext(userId: string): UserContext {
    return {
      userId,
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        weather: { condition: 'sunny', temperature: 22, humidity: 0.6 }
      },
      activity: {
        current: 'free_time',
        energy: 0.7,
        availability: { start: new Date(), duration: 60 }
      },
      availability: {
        timeSlots: [{ start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }],
        constraints: []
      },
      mood: {
        energy: 0.7,
        social: 0.6,
        focus: 0.7
      },
      energy: 0.7,
      social: {
        familyPresent: [],
        friendsAvailable: [],
        socialDesire: 0.5
      },
      environmental: {
        weather: { condition: 'sunny', temperature: 22 },
        timeOfDay: 'afternoon',
        season: 'spring',
        dayOfWeek: 'saturday'
      },
      preferences: {
        immediateGoals: ['relaxation'],
        avoidances: [],
        priorities: ['personal_time']
      }
    };
  }

  function createTestLearningContext(childId: string): LearningContext {
    return {
      childId,
      age: 8,
      gradeLevel: 3,
      currentSubjects: ['math', 'reading'],
      learningGoals: [
        { subject: 'math', skill: 'multiplication', targetLevel: 'proficient' }
      ],
      learningStyle: 'visual',
      attentionSpan: 20,
      preferredDifficulty: 'grade_appropriate',
      recentPerformance: {
        math: { accuracy: 0.85, engagement: 0.9 }
      },
      availableTime: 30,
      deviceCapabilities: ['touch', 'audio', 'visual'],
      parentalSettings: {
        contentFiltering: 'moderate',
        timeRestrictions: { maxDaily: 60, maxSession: 30 },
        approvalRequired: false
      }
    };
  }
});