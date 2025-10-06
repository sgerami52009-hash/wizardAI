/**
 * Acceptance Tests for Personalized Recommendations Engine
 * 
 * User acceptance criteria validation and end-to-end system testing
 * focusing on real-world usage scenarios and child safety compliance.
 * 
 * Requirements Coverage:
 * - Child safety and content validation across all recommendation types
 * - Family coordination and multi-user scenarios
 * - System reliability and error recovery
 * - Performance under realistic load conditions
 */

import { RecommendationController } from './controller';
import { ChildSafetyValidator } from '../avatar/enhanced-safety-validator';
import { ParentalControlSystem } from '../avatar/parental-control-system';
import { validateChildSafeContent } from '../avatar/safety-validator';
import { 
  RecommendationType, 
  UserContext, 
  FamilyContext,
  ChildProfile,
  ParentProfile,
  SafetyLevel,
  ContentCategory
} from './types';

describe('Acceptance Tests - Real World Scenarios', () => {
  let controller: RecommendationController;
  let safetyValidator: ChildSafetyValidator;
  let parentalControls: ParentalControlSystem;

  beforeEach(async () => {
    controller = new RecommendationController();
    safetyValidator = new ChildSafetyValidator();
    parentalControls = new ParentalControlSystem();
    
    await controller.initialize();
    await safetyValidator.initialize();
    await parentalControls.initialize();
  });

  afterEach(async () => {
    await controller.shutdown();
    await safetyValidator.shutdown();
    await parentalControls.shutdown();
  });

  describe('Child Safety Compliance Tests', () => {
    it('should validate all child recommendations through safety filters', async () => {
      // Test with different age groups
      const childProfiles: ChildProfile[] = [
        { id: 'child-5yo', age: 5, gradeLevel: 'kindergarten', safetyLevel: SafetyLevel.STRICT },
        { id: 'child-8yo', age: 8, gradeLevel: 3, safetyLevel: SafetyLevel.MODERATE },
        { id: 'child-12yo', age: 12, gradeLevel: 7, safetyLevel: SafetyLevel.STANDARD },
        { id: 'child-16yo', age: 16, gradeLevel: 11, safetyLevel: SafetyLevel.RELAXED }
      ];

      for (const child of childProfiles) {
        const context = createChildContext(child);
        
        // Get all types of recommendations
        const activityRecs = await controller.getRecommendations(child.id, context, RecommendationType.ACTIVITY);
        const educationalRecs = await controller.getRecommendations(child.id, context, RecommendationType.EDUCATIONAL);
        const scheduleRecs = await controller.getRecommendations(child.id, context, RecommendationType.SCHEDULE);

        // Validate each recommendation through safety filters
        const allRecommendations = [...activityRecs, ...educationalRecs, ...scheduleRecs];
        
        for (const rec of allRecommendations) {
          // Core safety validation
          const safetyResult = await validateChildSafeContent(rec.title, rec.description, child.age);
          expect(safetyResult.isSafe).toBe(true);
          expect(safetyResult.ageAppropriate).toBe(true);
          
          // Enhanced safety validation
          const enhancedSafety = await safetyValidator.validateRecommendation(rec, child);
          expect(enhancedSafety.approved).toBe(true);
          expect(enhancedSafety.riskLevel).toBeLessThanOrEqual(child.safetyLevel);
          
          // Content category validation
          if (rec.metadata.contentCategories) {
            for (const category of rec.metadata.contentCategories) {
              expect(isAgeAppropriateCategory(category, child.age)).toBe(true);
            }
          }
          
          // No inappropriate content markers
          expect(rec.metadata.containsViolence).toBeFalsy();
          expect(rec.metadata.containsInappropriateLanguage).toBeFalsy();
          expect(rec.metadata.requiresSupervision).toBeDefined();
        }
      }
    });

    it('should enforce parental controls and approval workflows', async () => {
      const childId = 'test-child-supervised';
      const parentId = 'test-parent-supervisor';
      
      // Set up strict parental controls
      await parentalControls.setParentalSettings(childId, {
        parentId,
        approvalRequired: true,
        contentFiltering: SafetyLevel.STRICT,
        timeRestrictions: {
          maxDailyScreen: 60, // minutes
          maxSessionLength: 30,
          allowedHours: { start: '08:00', end: '18:00' },
          blockedDays: []
        },
        activityRestrictions: {
          requireSupervisionFor: ['outdoor_activities', 'social_activities'],
          blockedCategories: ['mature_content', 'unsupervised_online'],
          allowedLocations: ['home', 'school', 'family_approved']
        },
        educationalSettings: {
          autoApproveEducational: true,
          maxDifficultyLevel: 'grade_appropriate',
          requiredSubjects: ['math', 'reading', 'science']
        }
      });

      const context = createChildContext({ id: childId, age: 7, gradeLevel: 2, safetyLevel: SafetyLevel.STRICT });
      
      // Get recommendations that should require approval
      const recommendations = await controller.getRecommendations(childId, context, RecommendationType.ACTIVITY);
      
      // Check approval requirements
      const requiresApproval = recommendations.filter(rec => rec.metadata.requiresParentalApproval);
      expect(requiresApproval.length).toBeGreaterThan(0);
      
      // Test approval workflow
      for (const rec of requiresApproval) {
        const approvalRequest = await parentalControls.requestApproval(childId, rec);
        expect(approvalRequest.status).toBe('pending');
        expect(approvalRequest.parentId).toBe(parentId);
        
        // Simulate parent approval
        const approvalResult = await parentalControls.processApproval(approvalRequest.id, parentId, {
          approved: true,
          conditions: ['supervision_required'],
          notes: 'Approved with supervision'
        });
        
        expect(approvalResult.approved).toBe(true);
        expect(approvalResult.conditions).toContain('supervision_required');
      }
    });

    it('should block inappropriate content and provide safe alternatives', async () => {
      const childId = 'test-child-content-filter';
      const context = createChildContext({ id: childId, age: 6, gradeLevel: 1, safetyLevel: SafetyLevel.STRICT });
      
      // Simulate request that might generate inappropriate content
      context.preferences.immediateGoals = ['adventure', 'excitement'];
      
      const recommendations = await controller.getRecommendations(childId, context, RecommendationType.ACTIVITY);
      
      // Verify all recommendations are child-safe
      for (const rec of recommendations) {
        // No violent or scary content
        expect(rec.title.toLowerCase()).not.toMatch(/fight|battle|war|scary|horror/);
        expect(rec.description.toLowerCase()).not.toMatch(/dangerous|risky|unsupervised/);
        
        // Age-appropriate alternatives should be provided
        expect(rec.metadata.ageRange.min).toBeLessThanOrEqual(6);
        expect(rec.metadata.ageRange.max).toBeGreaterThanOrEqual(6);
        
        // Should have positive, encouraging language
        expect(rec.description).toMatch(/fun|learn|explore|discover|create/i);
      }
      
      // Should provide educational alternatives
      const educationalAlternatives = recommendations.filter(rec => 
        rec.metadata.educationalValue > 0.5
      );
      expect(educationalAlternatives.length).toBeGreaterThan(0);
    });
  });

  describe('Family Coordination Scenarios', () => {
    it('should coordinate recommendations for multiple family members', async () => {
      const familyId = 'test-coordination-family';
      const familyMembers = [
        { id: 'parent1', role: 'parent', age: 35 },
        { id: 'parent2', role: 'parent', age: 33 },
        { id: 'child1', role: 'child', age: 8 },
        { id: 'child2', role: 'child', age: 5 }
      ];

      // Create family context
      const familyContext: FamilyContext = {
        familyId,
        members: familyMembers,
        currentActivity: 'family_time',
        location: 'home',
        timeAvailable: 120, // 2 hours
        preferences: {
          prioritizeFamily: true,
          includeEducational: true,
          energyLevel: 'moderate'
        },
        constraints: {
          budget: 'low',
          supervision: 'available',
          equipment: ['basic_household_items']
        }
      };

      // Get family recommendations
      const familyRecs = await controller.getFamilyRecommendations(familyId, familyContext);
      
      expect(familyRecs).toBeDefined();
      expect(familyRecs.length).toBeGreaterThan(0);
      
      // Verify family-appropriate activities
      familyRecs.forEach(rec => {
        expect(rec.metadata.familyFriendly).toBe(true);
        expect(rec.metadata.ageRange.min).toBeLessThanOrEqual(5); // Youngest child
        expect(rec.metadata.ageRange.max).toBeGreaterThanOrEqual(35); // Oldest parent
        
        // Should accommodate all family members
        expect(rec.metadata.participantCount.min).toBeLessThanOrEqual(4);
        expect(rec.metadata.participantCount.max).toBeGreaterThanOrEqual(4);
      });
    });

    it('should handle conflicting preferences within families', async () => {
      const familyId = 'test-conflict-family';
      
      // Set up conflicting preferences
      await controller.updateUserPreferences('parent_outdoor', {
        userId: 'parent_outdoor',
        interests: [{ category: 'outdoor', subcategory: 'hiking', strength: 0.9, recency: new Date(), source: 'explicit' }],
        activityPreferences: { indoorOutdoorPreference: 'outdoor' }
      });
      
      await controller.updateUserPreferences('child_indoor', {
        userId: 'child_indoor',
        interests: [{ category: 'games', subcategory: 'video_games', strength: 0.8, recency: new Date(), source: 'explicit' }],
        activityPreferences: { indoorOutdoorPreference: 'indoor' }
      });

      const familyContext: FamilyContext = {
        familyId,
        members: [
          { id: 'parent_outdoor', role: 'parent', age: 40 },
          { id: 'child_indoor', role: 'child', age: 10 }
        ],
        currentActivity: 'deciding_activity',
        location: 'home',
        timeAvailable: 90,
        preferences: { prioritizeFamily: true },
        constraints: {}
      };

      const recommendations = await controller.getFamilyRecommendations(familyId, familyContext);
      
      // Should provide compromise solutions
      const compromiseRecs = recommendations.filter(rec => 
        rec.metadata.compromiseSolution === true
      );
      expect(compromiseRecs.length).toBeGreaterThan(0);
      
      // Should explain conflict resolution
      compromiseRecs.forEach(rec => {
        expect(rec.reasoning).toContain('compromise');
        expect(rec.metadata.satisfiesAllMembers).toBe(true);
      });
    });

    it('should respect individual privacy within family recommendations', async () => {
      const familyId = 'test-privacy-family';
      const privateUserId = 'privacy-conscious-teen';
      
      // Set strict privacy preferences for one family member
      await controller.updateUserPreferences(privateUserId, {
        userId: privateUserId,
        privacyPreferences: {
          dataSharing: 'none',
          familyVisibility: 'limited',
          recommendationSharing: false
        }
      });

      const familyContext: FamilyContext = {
        familyId,
        members: [
          { id: 'parent', role: 'parent', age: 45 },
          { id: privateUserId, role: 'teen', age: 15 }
        ],
        currentActivity: 'family_planning',
        location: 'home',
        timeAvailable: 60,
        preferences: { prioritizeFamily: true },
        constraints: {}
      };

      const familyRecs = await controller.getFamilyRecommendations(familyId, familyContext);
      
      // Verify privacy protection
      familyRecs.forEach(rec => {
        // Should not expose private user's specific interests
        expect(rec.reasoning).not.toContain(privateUserId);
        expect(rec.metadata.exposesPrivateData).toBeFalsy();
        
        // Should still provide family-appropriate suggestions
        expect(rec.metadata.familyFriendly).toBe(true);
      });
    });
  });

  describe('System Reliability and Error Recovery', () => {
    it('should gracefully handle service failures and provide fallbacks', async () => {
      const userId = 'test-resilience-user';
      const context = createTestContext(userId);
      
      // Simulate various failure scenarios
      const failureScenarios = [
        'context_analyzer_failure',
        'preference_engine_failure',
        'learning_engine_failure',
        'external_api_failure'
      ];

      for (const scenario of failureScenarios) {
        // Inject failure
        await controller.simulateFailure(scenario);
        
        // Should still provide recommendations
        const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
        
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
        
        // Should indicate degraded service
        expect(recommendations[0].metadata.serviceLevel).toBe('degraded');
        expect(recommendations[0].reasoning).toContain('limited');
        
        // Clear failure simulation
        await controller.clearFailureSimulation(scenario);
      }
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const userId = 'test-consistency-user';
      const context = createTestContext(userId);
      
      // Perform concurrent operations
      const operations = [
        controller.getRecommendations(userId, context, RecommendationType.ACTIVITY),
        controller.updateUserPreferences(userId, { interests: [{ category: 'music', strength: 0.8 }] }),
        controller.submitFeedback('rec-1', { rating: 5, accepted: true }),
        controller.getRecommendations(userId, context, RecommendationType.SCHEDULE),
        controller.refreshRecommendations(userId)
      ];

      // All operations should complete successfully
      const results = await Promise.allSettled(operations);
      
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Operation ${index} failed:`, result.reason);
        }
        expect(result.status).toBe('fulfilled');
      });
      
      // Final state should be consistent
      const finalRecommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
      expect(finalRecommendations).toBeDefined();
      expect(finalRecommendations.length).toBeGreaterThan(0);
    });

    it('should recover from memory pressure and resource constraints', async () => {
      const userId = 'test-memory-pressure';
      
      // Simulate memory pressure
      await controller.simulateMemoryPressure(0.9); // 90% memory usage
      
      const context = createTestContext(userId);
      const recommendations = await controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
      
      // Should still function but with reduced features
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have activated memory optimization
      const memoryUsage = await controller.getCurrentMemoryUsage();
      expect(memoryUsage.optimizationActive).toBe(true);
      expect(memoryUsage.reducedFeatures).toBeDefined();
      
      // Clear memory pressure
      await controller.clearMemoryPressure();
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with realistic user load', async () => {
      const userCount = 20;
      const requestsPerUser = 5;
      
      // Create multiple users with different profiles
      const users = Array.from({ length: userCount }, (_, i) => ({
        id: `load-test-user-${i}`,
        context: createTestContext(`load-test-user-${i}`)
      }));

      const startTime = Date.now();
      const allPromises = [];

      // Generate concurrent requests
      for (const user of users) {
        for (let i = 0; i < requestsPerUser; i++) {
          const requestType = [RecommendationType.ACTIVITY, RecommendationType.SCHEDULE, RecommendationType.EDUCATIONAL][i % 3];
          allPromises.push(
            controller.getRecommendations(user.id, user.context, requestType)
          );
        }
      }

      const results = await Promise.all(allPromises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const averageLatency = totalTime / allPromises.length;
      
      // Performance expectations
      expect(averageLatency).toBeLessThan(3000); // 3 seconds average
      expect(results.length).toBe(userCount * requestsPerUser);
      
      // All requests should succeed
      results.forEach(recommendations => {
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });
      
      // System should remain stable
      const finalMemoryUsage = await controller.getCurrentMemoryUsage();
      expect(finalMemoryUsage.memoryMB).toBeLessThan(1536); // Under 1.5GB
    });

    it('should handle peak usage scenarios', async () => {
      // Simulate peak usage (e.g., morning routine time)
      const peakScenario = {
        simultaneousUsers: 50,
        requestBurst: true,
        complexContexts: true,
        learningActive: true
      };

      const users = Array.from({ length: peakScenario.simultaneousUsers }, (_, i) => 
        `peak-user-${i}`
      );

      const startTime = Date.now();
      
      // Burst of requests
      const burstPromises = users.map(userId => {
        const context = createComplexContext(userId);
        return controller.getRecommendations(userId, context, RecommendationType.ACTIVITY);
      });

      const burstResults = await Promise.all(burstPromises);
      const burstTime = Date.now() - startTime;
      
      // Should handle burst within reasonable time
      expect(burstTime).toBeLessThan(10000); // 10 seconds for 50 users
      
      // All requests should succeed
      expect(burstResults.length).toBe(peakScenario.simultaneousUsers);
      burstResults.forEach(recommendations => {
        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      });
      
      // System should remain responsive for new requests
      const postBurstStart = Date.now();
      const newRecommendations = await controller.getRecommendations(
        'post-burst-user', 
        createTestContext('post-burst-user'), 
        RecommendationType.ACTIVITY
      );
      const postBurstTime = Date.now() - postBurstStart;
      
      expect(postBurstTime).toBeLessThan(2000); // Still responsive
      expect(newRecommendations).toBeDefined();
    });
  });

  // Helper functions
  function createChildContext(child: ChildProfile): UserContext {
    return {
      userId: child.id,
      timestamp: new Date(),
      location: {
        type: 'home',
        coordinates: { lat: 40.7128, lng: -74.0060 },
        weather: { condition: 'sunny', temperature: 22, humidity: 0.6 }
      },
      activity: {
        current: 'free_time',
        energy: 0.8,
        availability: { start: new Date(), duration: 60 }
      },
      availability: {
        timeSlots: [{ start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }],
        constraints: [`supervision_level_${child.safetyLevel}`]
      },
      mood: {
        energy: 0.8,
        social: 0.7,
        focus: 0.6
      },
      energy: 0.8,
      social: {
        familyPresent: ['parent'],
        friendsAvailable: [],
        socialDesire: 0.6
      },
      environmental: {
        weather: { condition: 'sunny', temperature: 22 },
        timeOfDay: 'afternoon',
        season: 'spring',
        dayOfWeek: 'saturday'
      },
      preferences: {
        immediateGoals: ['fun', 'learning'],
        avoidances: ['scary_content', 'inappropriate_content'],
        priorities: ['safety', 'education', 'enjoyment']
      }
    };
  }

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

  function createComplexContext(userId: string): UserContext {
    return {
      ...createTestContext(userId),
      activity: {
        current: 'multitasking',
        energy: 0.6,
        availability: { start: new Date(), duration: 45 }
      },
      social: {
        familyPresent: ['spouse', 'child1', 'child2'],
        friendsAvailable: ['friend1'],
        socialDesire: 0.8
      },
      preferences: {
        immediateGoals: ['family_time', 'productivity', 'exercise'],
        avoidances: ['loud_activities', 'messy_activities'],
        priorities: ['family_harmony', 'efficiency', 'health']
      }
    };
  }

  function isAgeAppropriateCategory(category: ContentCategory, age: number): boolean {
    const ageRestrictions = {
      'mature_themes': 13,
      'complex_strategy': 10,
      'advanced_academics': 12,
      'social_media': 13,
      'unsupervised_online': 16,
      'physical_risk': 8,
      'emotional_intensity': 10
    };

    return !ageRestrictions[category] || age >= ageRestrictions[category];
  }
});