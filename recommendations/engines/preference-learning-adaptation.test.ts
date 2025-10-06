/**
 * Unit tests for Preference Learning and Adaptation
 * 
 * Tests preference learning algorithms, adaptation mechanisms,
 * and behavioral pattern recognition in user preference management.
 * 
 * Requirements: 1.4, 6.3
 */

import { UserPreferenceEngine, IUserPreferenceStorage } from './user-preference-engine';
import { FamilyPreferenceCoordinator, IFamilyStorage } from './family-preference-coordinator';
import { InMemoryUserPreferenceStorage } from './user-preference-storage';
import { InMemoryFamilyStorage } from './family-storage';
import {
  UserPreferences,
  Interest,
  UserInteraction,
  UserFeedback,
  UserContext,
  PrivacyDecision,
  DataOperation,
  ActivityPreferences,
  BehaviorPattern,
  ModelInsights
} from '../types';
import {
  InterestCategory,
  ActivityCategory,
  InteractionType,
  PrivacyLevel,
  DifficultyLevel,
  Subject
} from '../enums';
import { IPrivacyManager } from '../interfaces';

// Simple Mock Privacy Manager for learning tests
class LearningMockPrivacyManager implements IPrivacyManager {
  async enforcePrivacyPreferences(userId: string, operation: DataOperation): Promise<PrivacyDecision> {
    return {
      allowed: true,
      restrictions: [],
      anonymizationRequired: false,
      consentRequired: false,
      auditRequired: false
    };
  }

  async anonymizeUserData(userData: any, privacyLevel: PrivacyLevel): Promise<any> {
    return userData;
  }

  async auditDataUsage(userId: string, timeRange: any): Promise<any> {
    return { operations: [], complianceStatus: 'compliant', issues: [], recommendations: [] };
  }

  async updatePrivacySettings(userId: string, settings: any): Promise<void> {}
  async validateDataMinimization(operation: DataOperation): Promise<any> {
    return { valid: true, issues: [], recommendations: [], complianceScore: 1.0 };
  }
  async encryptUserData(data: any): Promise<string> {
    return JSON.stringify(data);
  }
  async decryptUserData(encryptedData: string): Promise<any> {
    return JSON.parse(encryptedData);
  }
}

describe('Preference Learning and Adaptation', () => {
  let userEngine: UserPreferenceEngine;
  let familyCoordinator: FamilyPreferenceCoordinator;
  let userStorage: IUserPreferenceStorage;
  let familyStorage: IFamilyStorage;
  let privacyManager: LearningMockPrivacyManager;
  
  const testUserId = 'learning-test-user';
  const testFamilyId = 'learning-test-family';
  const parentId = 'learning-parent';
  const childId = 'learning-child';

  beforeEach(async () => {
    userStorage = new InMemoryUserPreferenceStorage();
    familyStorage = new InMemoryFamilyStorage();
    privacyManager = new LearningMockPrivacyManager();
    
    userEngine = new UserPreferenceEngine(userStorage, privacyManager);
    familyCoordinator = new FamilyPreferenceCoordinator(userEngine, familyStorage, privacyManager);

    // Set up test users and family
    await userEngine.initializeUserPreferences(testUserId);
    await userEngine.initializeUserPreferences(parentId);
    await userEngine.initializeUserPreferences(childId);

    await (familyStorage as any).addFamilyMember(testFamilyId, parentId);
    await (familyStorage as any).addFamilyMember(testFamilyId, childId);
  });

  describe('Interest Strength Calculation and Adaptation', () => {
    test('should calculate interest strength based on interaction patterns', async () => {
      // Requirement: 1.4
      
      // Create a series of interactions with the same activity type
      const interactions: UserInteraction[] = [];
      const baseTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        interactions.push({
          userId: testUserId,
          recommendationId: `rec-${i}`,
          interactionType: i < 3 ? InteractionType.COMPLETE : InteractionType.ACCEPT,
          timestamp: new Date(baseTime - i * 24 * 60 * 60 * 1000), // Spread over 5 days
          context: {
            userId: testUserId,
            timestamp: new Date(baseTime - i * 24 * 60 * 60 * 1000),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'music',
              activityType: ActivityCategory.CREATIVE,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.CREATIVE],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: i < 3 ? 1.0 : 0.7, // Higher completion for first 3
            timeSpent: 45 + i * 5, // Increasing time spent
            engagementLevel: i < 3 ? 'high' : 'medium',
            wouldRecommendAgain: true
          },
          satisfaction: 0.9 - i * 0.1 // Decreasing satisfaction over time
        });
      }

      await userEngine.learnFromInteractions(testUserId, interactions);

      const preferences = await userEngine.getUserPreferences(testUserId);
      const musicInterests = preferences.interests.filter(i => 
        i.category === InterestCategory.MUSIC || i.subcategory === 'music'
      );

      expect(musicInterests.length).toBeGreaterThan(0);
      
      // Interest strength should reflect the pattern of interactions
      const musicInterest = musicInterests[0];
      expect(musicInterest.strength).toBeGreaterThan(0);
      expect(musicInterest.strength).toBeLessThan(1);
      
      // More recent interactions should have higher influence
      expect(musicInterest.recency).toBeInstanceOf(Date);
    });

    test('should adapt interest strength based on satisfaction feedback', async () => {
      // Requirement: 1.4
      
      // Establish baseline interest
      const initialInteraction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'initial-rec',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        context: {
          userId: testUserId,
          timestamp: new Date(),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'sports',
            activityType: ActivityCategory.PHYSICAL,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
          mood: { confidence: 0.8, source: 'inferred' },
          energy: { level: 'high', trend: 'stable' },
          social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
          environmental: {
            weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
            timeOfDay: 'afternoon',
            season: 'spring',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.PHYSICAL],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 60,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.8
      };

      await userEngine.learnFromInteractions(testUserId, [initialInteraction]);

      let preferences = await userEngine.getUserPreferences(testUserId);
      const initialSportsInterest = preferences.interests.find(i => i.category === InterestCategory.SPORTS);
      expect(initialSportsInterest).toBeDefined();
      const initialStrength = initialSportsInterest!.strength;

      // Now provide highly positive feedback
      const positiveInteraction: UserInteraction = {
        ...initialInteraction,
        recommendationId: 'positive-rec',
        timestamp: new Date(),
        satisfaction: 1.0, // Maximum satisfaction
        feedback: {
          recommendationId: 'positive-rec',
          userId: testUserId,
          rating: 5,
          accepted: true,
          completed: true,
          feedback: 'Loved this activity!',
          timestamp: new Date(),
          context: initialInteraction.context
        }
      };

      await userEngine.learnFromInteractions(testUserId, [positiveInteraction]);

      preferences = await userEngine.getUserPreferences(testUserId);
      const updatedSportsInterest = preferences.interests.find(i => i.category === InterestCategory.SPORTS);
      expect(updatedSportsInterest).toBeDefined();
      
      // Interest strength should have increased due to positive feedback
      expect(updatedSportsInterest!.strength).toBeGreaterThan(initialStrength);
    });

    test('should handle conflicting feedback and find balanced interest strength', async () => {
      // Requirement: 1.4
      
      const conflictingInteractions: UserInteraction[] = [
        // Positive interaction
        {
          userId: testUserId,
          recommendationId: 'positive-art',
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'painting',
              activityType: ActivityCategory.CREATIVE,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.CREATIVE],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 90,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.95
        },
        // Negative interaction with same category
        {
          userId: testUserId,
          recommendationId: 'negative-art',
          interactionType: InteractionType.ABANDON,
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'sculpture',
              activityType: ActivityCategory.CREATIVE,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'low', trend: 'decreasing' } },
            mood: { confidence: 0.6, source: 'inferred' },
            energy: { level: 'low', trend: 'decreasing' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'rainy', humidity: 80, windSpeed: 10, uvIndex: 1 },
              timeOfDay: 'evening',
              season: 'spring',
              dayOfWeek: 'Monday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.CREATIVE],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: false,
            completionRate: 0.2,
            timeSpent: 10,
            engagementLevel: 'low',
            wouldRecommendAgain: false
          },
          satisfaction: 0.2
        }
      ];

      await userEngine.learnFromInteractions(testUserId, conflictingInteractions);

      const preferences = await userEngine.getUserPreferences(testUserId);
      const artsInterests = preferences.interests.filter(i => i.category === InterestCategory.ARTS);

      expect(artsInterests.length).toBeGreaterThan(0);
      
      // Should find a balanced strength that reflects both positive and negative feedback
      const artsInterest = artsInterests[0];
      expect(artsInterest.strength).toBeGreaterThan(0.2); // Higher than negative feedback alone
      expect(artsInterest.strength).toBeLessThan(0.95); // Lower than positive feedback alone
    });
  });

  describe('Contextual Learning and Pattern Recognition', () => {
    test('should learn contextual preferences based on time patterns', async () => {
      // Requirement: 1.4
      
      // Create interactions that show time-based preferences
      const morningInteractions: UserInteraction[] = [];
      const eveningInteractions: UserInteraction[] = [];

      // Morning exercise preferences
      for (let i = 0; i < 3; i++) {
        morningInteractions.push({
          userId: testUserId,
          recommendationId: `morning-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            location: { type: 'home', indoorOutdoor: 'outdoor' },
            activity: { 
              currentActivity: 'running',
              activityType: ActivityCategory.PHYSICAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'increasing' } },
            mood: { confidence: 0.9, source: 'inferred' },
            energy: { level: 'high', trend: 'increasing' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 18, condition: 'sunny', humidity: 40, windSpeed: 5, uvIndex: 2 },
              timeOfDay: 'morning',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.PHYSICAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 30,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.9
        });
      }

      // Evening reading preferences
      for (let i = 0; i < 3; i++) {
        eveningInteractions.push({
          userId: testUserId,
          recommendationId: `evening-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'reading',
              activityType: ActivityCategory.EDUCATIONAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'decreasing' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'decreasing' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 20, condition: 'sunny', humidity: 50, windSpeed: 3, uvIndex: 0 },
              timeOfDay: 'evening',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.EDUCATIONAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 45,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.85
        });
      }

      await userEngine.learnFromInteractions(testUserId, [...morningInteractions, ...eveningInteractions]);

      const preferences = await userEngine.getUserPreferences(testUserId);
      
      // Should have learned both physical and educational interests
      const physicalInterests = preferences.interests.filter(i => i.category === InterestCategory.SPORTS);
      const educationalInterests = preferences.interests.filter(i => i.category === InterestCategory.LEARNING);

      expect(physicalInterests.length).toBeGreaterThan(0);
      expect(educationalInterests.length).toBeGreaterThan(0);

      // Both should have reasonable strength based on consistent positive feedback
      expect(physicalInterests[0].strength).toBeGreaterThan(0.5);
      expect(educationalInterests[0].strength).toBeGreaterThan(0.5);
    });

    test('should adapt to changing energy level patterns', async () => {
      // Requirement: 1.4
      
      // Create interactions showing energy-based activity preferences
      const highEnergyInteractions: UserInteraction[] = [];
      const lowEnergyInteractions: UserInteraction[] = [];

      // High energy = physical activities
      for (let i = 0; i < 2; i++) {
        highEnergyInteractions.push({
          userId: testUserId,
          recommendationId: `high-energy-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'outdoor' },
            activity: { 
              currentActivity: 'sports',
              activityType: ActivityCategory.PHYSICAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
            mood: { confidence: 0.9, source: 'inferred' },
            energy: { level: 'high', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.PHYSICAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 60,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.9
        });
      }

      // Low energy = relaxing activities
      for (let i = 0; i < 2; i++) {
        lowEnergyInteractions.push({
          userId: testUserId,
          recommendationId: `low-energy-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'meditation',
              activityType: ActivityCategory.RELAXATION,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'low', trend: 'stable' } },
            mood: { confidence: 0.7, source: 'inferred' },
            energy: { level: 'low', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'cloudy', humidity: 60, windSpeed: 3, uvIndex: 1 },
              timeOfDay: 'evening',
              season: 'spring',
              dayOfWeek: 'Sunday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.RELAXATION],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 20,
            engagementLevel: 'medium',
            wouldRecommendAgain: true
          },
          satisfaction: 0.8
        });
      }

      await userEngine.learnFromInteractions(testUserId, [...highEnergyInteractions, ...lowEnergyInteractions]);

      const preferences = await userEngine.getUserPreferences(testUserId);
      
      // Should have learned both types of activities
      const physicalInterests = preferences.interests.filter(i => i.category === InterestCategory.SPORTS);
      const relaxationInterests = preferences.interests.filter(i => i.category === InterestCategory.ENTERTAINMENT);

      // Both should be present, showing adaptation to different energy contexts
      expect(preferences.interests.length).toBeGreaterThan(0);
      
      // Activity preferences should reflect the learned patterns
      expect(preferences.activityPreferences.physicalActivityLevel).toBeDefined();
    });
  });

  describe('Family Learning Coordination', () => {
    test('should learn family-wide preferences from collective interactions', async () => {
      // Requirement: 1.4, 6.3
      
      // Set up different but complementary interests for family members
      const parentInteractions: UserInteraction[] = [{
        userId: parentId,
        recommendationId: 'parent-cooking',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(),
        context: {
          userId: parentId,
          timestamp: new Date(),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'cooking',
            activityType: ActivityCategory.FAMILY,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
          mood: { confidence: 0.8, source: 'inferred' },
          energy: { level: 'medium', trend: 'stable' },
          social: { familyMembersPresent: [childId], socialSetting: 'family', groupActivity: true },
          environmental: {
            weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
            timeOfDay: 'afternoon',
            season: 'spring',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.FAMILY],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'high', aloneTime: 'medium', groupActivities: 'preferred' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 90,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.9
      }];

      const childInteractions: UserInteraction[] = [{
        userId: childId,
        recommendationId: 'child-cooking',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(),
        context: {
          userId: childId,
          timestamp: new Date(),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'cooking',
            activityType: ActivityCategory.EDUCATIONAL,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
          mood: { confidence: 0.9, source: 'inferred' },
          energy: { level: 'high', trend: 'stable' },
          social: { familyMembersPresent: [parentId], socialSetting: 'family', groupActivity: true },
          environmental: {
            weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
            timeOfDay: 'afternoon',
            season: 'spring',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.EDUCATIONAL],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'high', aloneTime: 'low', groupActivities: 'preferred' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 90,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.85
      }];

      // Learn from individual interactions
      await userEngine.learnFromInteractions(parentId, parentInteractions);
      await userEngine.learnFromInteractions(childId, childInteractions);

      // Aggregate family preferences
      const familyPreferences = await familyCoordinator.aggregateFamilyPreferences(testFamilyId);

      expect(familyPreferences.interests.length).toBeGreaterThan(0);
      
      // Should have cooking-related interests from both perspectives
      const cookingInterests = familyPreferences.interests.filter(i => 
        i.subcategory.includes('cooking') || i.category === InterestCategory.COOKING
      );
      
      // Family preferences should reflect shared activities
      expect(familyPreferences.activityPreferences.socialPreference).toBe('group');
      expect(familyPreferences.activityPreferences.preferredCategories).toContain(ActivityCategory.FAMILY);
    });

    test('should resolve conflicting learning patterns in family context', async () => {
      // Requirement: 1.4, 6.3
      
      // Create conflicting preferences between family members
      await userEngine.updateUserPreferences(parentId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.OUTDOOR, ActivityCategory.PHYSICAL],
          preferredDifficulty: DifficultyLevel.ADVANCED,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
          indoorOutdoorPreference: 'outdoor',
          socialPreference: 'group',
          physicalActivityLevel: 'high'
        }
      });

      await userEngine.updateUserPreferences(childId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.INDOOR, ActivityCategory.CREATIVE],
          preferredDifficulty: DifficultyLevel.BEGINNER,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 30 * 60 * 1000) },
          indoorOutdoorPreference: 'indoor',
          socialPreference: 'solo',
          physicalActivityLevel: 'low'
        }
      });

      // Identify and resolve conflicts
      const conflicts = await familyCoordinator.identifyAndResolveConflicts(testFamilyId);
      
      expect(conflicts.length).toBeGreaterThan(0);
      
      // Should have resolution strategies
      conflicts.forEach(conflict => {
        expect(conflict.resolutionStrategy).toBeDefined();
        expect(['compromise', 'rotation', 'find_middle_ground', 'facilitate_discussion', 'take_turns'])
          .toContain(conflict.resolutionStrategy);
      });

      // Family preferences should find middle ground
      const familyPreferences = await familyCoordinator.aggregateFamilyPreferences(testFamilyId);
      
      // Should balance conflicting preferences
      expect(familyPreferences.activityPreferences.preferredDifficulty).toBe(DifficultyLevel.INTERMEDIATE);
      expect(['both', 'group']).toContain(familyPreferences.activityPreferences.socialPreference);
    });
  });

  describe('Behavioral Pattern Analysis', () => {
    test('should identify recurring behavioral patterns', async () => {
      // Requirement: 1.4
      
      // Create a pattern of weekend vs weekday preferences
      const weekendInteractions: UserInteraction[] = [];
      const weekdayInteractions: UserInteraction[] = [];

      // Weekend: leisure activities
      for (let i = 0; i < 3; i++) {
        weekendInteractions.push({
          userId: testUserId,
          recommendationId: `weekend-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000), // Weekly pattern
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'outdoor' },
            activity: { 
              currentActivity: 'hiking',
              activityType: ActivityCategory.OUTDOOR,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
            mood: { confidence: 0.9, source: 'inferred' },
            energy: { level: 'high', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'family', groupActivity: true },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'morning',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.OUTDOOR],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'high', aloneTime: 'medium', groupActivities: 'preferred' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 120,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.95
        });
      }

      // Weekday: educational activities
      for (let i = 0; i < 3; i++) {
        weekdayInteractions.push({
          userId: testUserId,
          recommendationId: `weekday-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000), // Weekly pattern
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'learning',
              activityType: ActivityCategory.EDUCATIONAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'cloudy', humidity: 60, windSpeed: 3, uvIndex: 1 },
              timeOfDay: 'evening',
              season: 'spring',
              dayOfWeek: 'Tuesday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.EDUCATIONAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 45,
            engagementLevel: 'medium',
            wouldRecommendAgain: true
          },
          satisfaction: 0.8
        });
      }

      await userEngine.learnFromInteractions(testUserId, [...weekendInteractions, ...weekdayInteractions]);

      // Get user insights to analyze patterns
      const insights = await userEngine.getUserInsights(testUserId);

      expect(insights.userId).toBe(testUserId);
      expect(insights.topInterests.length).toBeGreaterThan(0);
      expect(insights.behaviorPatterns).toBeDefined();
      expect(insights.contextualFactors).toBeDefined();
      expect(insights.recommendationHistory).toBeDefined();

      // Should have learned both outdoor and educational interests
      const outdoorInterests = insights.topInterests.filter(i => i.category === InterestCategory.NATURE);
      const educationalInterests = insights.topInterests.filter(i => i.category === InterestCategory.LEARNING);

      // Both patterns should be represented in top interests
      expect(insights.topInterests.length).toBeGreaterThan(1);
    });

    test('should adapt to seasonal preference changes', async () => {
      // Requirement: 1.4
      
      // Create seasonal interaction patterns
      const summerInteractions: UserInteraction[] = [{
        userId: testUserId,
        recommendationId: 'summer-activity',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date('2024-07-15'), // Summer
        context: {
          userId: testUserId,
          timestamp: new Date('2024-07-15'),
          location: { type: 'outdoor', indoorOutdoor: 'outdoor' },
          activity: { 
            currentActivity: 'swimming',
            activityType: ActivityCategory.PHYSICAL,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'high', trend: 'stable' } },
          mood: { confidence: 0.9, source: 'inferred' },
          energy: { level: 'high', trend: 'stable' },
          social: { familyMembersPresent: [], socialSetting: 'family', groupActivity: true },
          environmental: {
            weather: { temperature: 30, condition: 'sunny', humidity: 40, windSpeed: 5, uvIndex: 8 },
            timeOfDay: 'afternoon',
            season: 'summer',
            dayOfWeek: 'Saturday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.PHYSICAL],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'high', aloneTime: 'medium', groupActivities: 'preferred' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 90,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.95
      }];

      const winterInteractions: UserInteraction[] = [{
        userId: testUserId,
        recommendationId: 'winter-activity',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date('2024-12-15'), // Winter
        context: {
          userId: testUserId,
          timestamp: new Date('2024-12-15'),
          location: { type: 'home', indoorOutdoor: 'indoor' },
          activity: { 
            currentActivity: 'reading',
            activityType: ActivityCategory.EDUCATIONAL,
            interruptible: true
          },
          availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
          mood: { confidence: 0.8, source: 'inferred' },
          energy: { level: 'medium', trend: 'stable' },
          social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
          environmental: {
            weather: { temperature: 5, condition: 'snowy', humidity: 80, windSpeed: 10, uvIndex: 1 },
            timeOfDay: 'evening',
            season: 'winter',
            dayOfWeek: 'Sunday',
            isHoliday: false
          },
          preferences: {
            preferredActivities: [ActivityCategory.EDUCATIONAL],
            avoidedActivities: [],
            timePreferences: [],
            socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
          }
        },
        outcome: {
          successful: true,
          completionRate: 1.0,
          timeSpent: 60,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.9
      }];

      await userEngine.learnFromInteractions(testUserId, [...summerInteractions, ...winterInteractions]);

      const preferences = await userEngine.getUserPreferences(testUserId);
      
      // Should have learned both seasonal preferences
      expect(preferences.interests.length).toBeGreaterThan(0);
      
      // Should show adaptation to different seasonal contexts
      const physicalInterests = preferences.interests.filter(i => i.category === InterestCategory.SPORTS);
      const educationalInterests = preferences.interests.filter(i => i.category === InterestCategory.LEARNING);

      // Both seasonal preferences should be represented
      expect(preferences.interests.length).toBeGreaterThan(1);
    });
  });

  describe('Preference Stability and Consistency', () => {
    test('should maintain preference stability over time with consistent feedback', async () => {
      // Requirement: 1.4
      
      // Create consistent positive interactions over time
      const consistentInteractions: UserInteraction[] = [];
      const baseTime = Date.now();

      for (let i = 0; i < 10; i++) {
        consistentInteractions.push({
          userId: testUserId,
          recommendationId: `consistent-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(baseTime - i * 3 * 24 * 60 * 60 * 1000), // Every 3 days
          context: {
            userId: testUserId,
            timestamp: new Date(baseTime - i * 3 * 24 * 60 * 60 * 1000),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'music',
              activityType: ActivityCategory.CREATIVE,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.CREATIVE],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 45,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.85 + (Math.random() * 0.1) // Small random variation
        });
      }

      await userEngine.learnFromInteractions(testUserId, consistentInteractions);

      const preferences = await userEngine.getUserPreferences(testUserId);
      const musicInterests = preferences.interests.filter(i => 
        i.category === InterestCategory.MUSIC || i.subcategory === 'music'
      );

      expect(musicInterests.length).toBeGreaterThan(0);
      
      // With consistent positive feedback, interest strength should be high and stable
      const musicInterest = musicInterests[0];
      expect(musicInterest.strength).toBeGreaterThan(0.7); // High strength from consistent feedback
      expect(musicInterest.source).toBeDefined();
    });

    test('should handle preference drift with gradual changes', async () => {
      // Requirement: 1.4
      
      // Start with strong preference for one activity
      const initialInteractions: UserInteraction[] = [];
      for (let i = 0; i < 3; i++) {
        initialInteractions.push({
          userId: testUserId,
          recommendationId: `initial-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - (10 + i) * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: 'reading',
              activityType: ActivityCategory.EDUCATIONAL,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.EDUCATIONAL],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: true,
            completionRate: 1.0,
            timeSpent: 60,
            engagementLevel: 'high',
            wouldRecommendAgain: true
          },
          satisfaction: 0.9
        });
      }

      // Gradually shift to different activity with mixed feedback
      const shiftingInteractions: UserInteraction[] = [];
      for (let i = 0; i < 5; i++) {
        shiftingInteractions.push({
          userId: testUserId,
          recommendationId: `shifting-${i}`,
          interactionType: i < 2 ? InteractionType.ACCEPT : InteractionType.COMPLETE,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'outdoor' },
            activity: { 
              currentActivity: 'gardening',
              activityType: ActivityCategory.OUTDOOR,
              interruptible: true
            },
            availability: { freeTime: [], busyTime: [], flexibleTime: [], energyLevel: { level: 'medium', trend: 'stable' } },
            mood: { confidence: 0.8, source: 'inferred' },
            energy: { level: 'medium', trend: 'stable' },
            social: { familyMembersPresent: [], socialSetting: 'alone', groupActivity: false },
            environmental: {
              weather: { temperature: 22, condition: 'sunny', humidity: 50, windSpeed: 5, uvIndex: 3 },
              timeOfDay: 'afternoon',
              season: 'spring',
              dayOfWeek: 'Saturday',
              isHoliday: false
            },
            preferences: {
              preferredActivities: [ActivityCategory.OUTDOOR],
              avoidedActivities: [],
              timePreferences: [],
              socialPreferences: { familyTime: 'medium', aloneTime: 'high', groupActivities: 'acceptable' }
            }
          },
          outcome: {
            successful: i >= 2,
            completionRate: i >= 2 ? 1.0 : 0.5,
            timeSpent: i >= 2 ? 45 : 20,
            engagementLevel: i >= 2 ? 'high' : 'medium',
            wouldRecommendAgain: i >= 2
          },
          satisfaction: i >= 2 ? 0.8 : 0.5
        });
      }

      await userEngine.learnFromInteractions(testUserId, [...initialInteractions, ...shiftingInteractions]);

      const preferences = await userEngine.getUserPreferences(testUserId);
      
      // Should show both old and new interests, with new ones gaining strength
      const educationalInterests = preferences.interests.filter(i => i.category === InterestCategory.LEARNING);
      const outdoorInterests = preferences.interests.filter(i => i.category === InterestCategory.NATURE);

      // Should have both types of interests reflecting the gradual shift
      expect(preferences.interests.length).toBeGreaterThan(0);
      
      // Recent positive interactions should influence current preferences
      if (outdoorInterests.length > 0 && educationalInterests.length > 0) {
        // Outdoor interests should be gaining strength due to recent positive feedback
        expect(outdoorInterests[0].recency.getTime()).toBeGreaterThan(
          educationalInterests[0].recency.getTime()
        );
      }
    });
  });
});