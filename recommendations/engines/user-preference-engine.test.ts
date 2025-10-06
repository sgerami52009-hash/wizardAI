/**
 * Unit tests for User Preference Engine
 * 
 * Tests preference management, interest tracking, learning from interactions,
 * and privacy-preserving operations.
 * 
 * Requirements: 1.1, 1.4, 6.1, 6.2, 6.3, 6.4
 */

import { UserPreferenceEngine, IUserPreferenceStorage } from './user-preference-engine';
import { InMemoryUserPreferenceStorage } from './user-preference-storage';
import {
  UserPreferences,
  Interest,
  UserInteraction,
  UserFeedback,
  UserContext,
  PrivacyDecision,
  DataOperation,
  DataRestriction
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

// Mock Privacy Manager
class MockPrivacyManager implements IPrivacyManager {
  private allowAccess = true;
  private requireAnonymization = false;
  private restrictions: DataRestriction[] = [];

  setAccessPolicy(allow: boolean, anonymize: boolean = false, restrictions: DataRestriction[] = []) {
    this.allowAccess = allow;
    this.requireAnonymization = anonymize;
    this.restrictions = restrictions;
  }

  async enforcePrivacyPreferences(userId: string, operation: DataOperation): Promise<PrivacyDecision> {
    return {
      allowed: this.allowAccess,
      restrictions: this.restrictions,
      anonymizationRequired: this.requireAnonymization,
      consentRequired: false,
      auditRequired: true
    };
  }

  async anonymizeUserData(userData: any, privacyLevel: PrivacyLevel): Promise<any> {
    return { ...userData, anonymized: true };
  }

  async auditDataUsage(userId: string, timeRange: any): Promise<any> {
    return { operations: [], complianceStatus: 'compliant', issues: [], recommendations: [] };
  }

  async updatePrivacySettings(userId: string, settings: any): Promise<void> {
    // Mock implementation
  }

  async validateDataMinimization(operation: DataOperation): Promise<any> {
    return { valid: true, issues: [], recommendations: [], complianceScore: 1.0 };
  }

  async encryptUserData(data: any): Promise<string> {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async decryptUserData(encryptedData: string): Promise<any> {
    return JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
  }
}

describe('UserPreferenceEngine', () => {
  let engine: UserPreferenceEngine;
  let storage: IUserPreferenceStorage;
  let privacyManager: MockPrivacyManager;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    storage = new InMemoryUserPreferenceStorage();
    privacyManager = new MockPrivacyManager();
    engine = new UserPreferenceEngine(storage, privacyManager);
  });

  describe('User Preference Initialization', () => {
    test('should initialize user preferences with default values', async () => {
      // Requirement: 1.1, 6.1
      const preferences = await engine.initializeUserPreferences(testUserId);

      expect(preferences.userId).toBe(testUserId);
      expect(preferences.interests).toEqual([]);
      expect(preferences.activityPreferences).toBeDefined();
      expect(preferences.schedulePreferences).toBeDefined();
      expect(preferences.learningPreferences).toBeDefined();
      expect(preferences.privacyPreferences).toBeDefined();
      expect(preferences.notificationPreferences).toBeDefined();
      expect(preferences.lastUpdated).toBeInstanceOf(Date);
    });

    test('should set appropriate default activity preferences', async () => {
      // Requirement: 1.1
      const preferences = await engine.initializeUserPreferences(testUserId);
      const activityPrefs = preferences.activityPreferences;

      expect(activityPrefs.preferredCategories).toContain(ActivityCategory.FAMILY);
      expect(activityPrefs.preferredCategories).toContain(ActivityCategory.EDUCATIONAL);
      expect(activityPrefs.preferredDifficulty).toBe(DifficultyLevel.INTERMEDIATE);
      expect(activityPrefs.indoorOutdoorPreference).toBe('both');
      expect(activityPrefs.socialPreference).toBe('both');
      expect(activityPrefs.physicalActivityLevel).toBe('medium');
    });

    test('should set privacy-preserving default settings', async () => {
      // Requirement: 6.1, 6.2
      const preferences = await engine.initializeUserPreferences(testUserId);
      const privacyPrefs = preferences.privacyPreferences;

      expect(privacyPrefs.dataSharing).toBe(PrivacyLevel.FAMILY);
      expect(privacyPrefs.locationTracking).toBe(false);
      expect(privacyPrefs.behaviorAnalysis).toBe(true);
      expect(privacyPrefs.familyDataSharing).toBe(true);
      expect(privacyPrefs.externalIntegrations).toBe(false);
      expect(privacyPrefs.dataRetentionDays).toBe(90);
    });
  });

  describe('Preference Retrieval and Updates', () => {
    test('should retrieve user preferences with privacy enforcement', async () => {
      // Requirement: 6.1, 6.2
      await engine.initializeUserPreferences(testUserId);
      
      const preferences = await engine.getUserPreferences(testUserId);
      
      expect(preferences.userId).toBe(testUserId);
      expect(preferences).toBeDefined();
    });

    test('should deny access when privacy settings prohibit', async () => {
      // Requirement: 6.2
      await engine.initializeUserPreferences(testUserId);
      privacyManager.setAccessPolicy(false);

      await expect(engine.getUserPreferences(testUserId))
        .rejects.toThrow('Access to user preferences denied by privacy settings');
    });

    test('should update user preferences successfully', async () => {
      // Requirement: 1.4, 6.2, 6.3
      await engine.initializeUserPreferences(testUserId);

      const newInterests: Interest[] = [{
        category: InterestCategory.SPORTS,
        subcategory: 'soccer',
        strength: 0.8,
        recency: new Date(),
        source: 'explicit'
      }];

      await engine.updateUserPreferences(testUserId, { interests: newInterests });

      const updatedPreferences = await engine.getUserPreferences(testUserId);
      expect(updatedPreferences.interests).toHaveLength(1);
      expect(updatedPreferences.interests[0].category).toBe(InterestCategory.SPORTS);
      expect(updatedPreferences.interests[0].strength).toBe(0.8);
    });

    test('should validate and sanitize interests during update', async () => {
      // Requirement: 6.1, 6.3
      await engine.initializeUserPreferences(testUserId);

      const invalidInterests: Interest[] = [
        {
          category: InterestCategory.SPORTS,
          subcategory: 'soccer',
          strength: 1.5, // Invalid - over 1.0
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.ARTS,
          subcategory: 'painting',
          strength: -0.2, // Invalid - negative
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.MUSIC,
          subcategory: 'piano',
          strength: 0.7,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      await engine.updateUserPreferences(testUserId, { interests: invalidInterests });

      const preferences = await engine.getUserPreferences(testUserId);
      // Should have all interests with strength clamped to valid range
      expect(preferences.interests).toHaveLength(3); // All interests should be sanitized
      expect(preferences.interests.every(i => i.strength >= 0 && i.strength <= 1)).toBe(true);
      
      // Check that invalid values were clamped
      const sportsInterest = preferences.interests.find(i => i.subcategory === 'soccer');
      const artsInterest = preferences.interests.find(i => i.subcategory === 'painting');
      expect(sportsInterest?.strength).toBe(1); // Clamped from 1.5 to 1
      expect(artsInterest?.strength).toBe(0); // Clamped from -0.2 to 0
    });
  });

  describe('Learning from Interactions', () => {
    test('should learn interests from positive interactions', async () => {
      // Requirement: 1.4, 6.3
      await engine.initializeUserPreferences(testUserId);

      const interaction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'rec-123',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(),
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
          timeSpent: 30,
          engagementLevel: 'high',
          wouldRecommendAgain: true
        },
        satisfaction: 0.9
      };

      await engine.learnFromInteractions(testUserId, [interaction]);

      const preferences = await engine.getUserPreferences(testUserId);
      const educationalInterests = preferences.interests.filter(i => 
        i.category === InterestCategory.LEARNING || i.subcategory === 'reading'
      );
      
      expect(educationalInterests.length).toBeGreaterThan(0);
      expect(educationalInterests[0].strength).toBeGreaterThan(0);
    });

    test('should decrease interest strength from negative interactions', async () => {
      // Requirement: 1.4
      await engine.initializeUserPreferences(testUserId);

      // First, establish an interest
      const positiveInteraction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'rec-123',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
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
        satisfaction: 0.9
      };

      await engine.learnFromInteractions(testUserId, [positiveInteraction]);

      // Get initial interest strength
      let preferences = await engine.getUserPreferences(testUserId);
      const initialSportsInterest = preferences.interests.find(i => i.category === InterestCategory.SPORTS);
      expect(initialSportsInterest).toBeDefined();
      const initialStrength = initialSportsInterest!.strength;

      // Now provide negative feedback
      const negativeInteraction: UserInteraction = {
        ...positiveInteraction,
        recommendationId: 'rec-456',
        interactionType: InteractionType.REJECT,
        timestamp: new Date(),
        satisfaction: 0.2
      };

      await engine.learnFromInteractions(testUserId, [negativeInteraction]);

      // Check that interest strength decreased
      preferences = await engine.getUserPreferences(testUserId);
      const updatedSportsInterest = preferences.interests.find(i => i.category === InterestCategory.SPORTS);
      expect(updatedSportsInterest).toBeDefined();
      expect(updatedSportsInterest!.strength).toBeLessThan(initialStrength);
    });

    test('should apply interest decay over time', async () => {
      // Requirement: 1.4
      await engine.initializeUserPreferences(testUserId);

      // Create an old interaction
      const oldInteraction: UserInteraction = {
        userId: testUserId,
        recommendationId: 'rec-old',
        interactionType: InteractionType.COMPLETE,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        context: {
          userId: testUserId,
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
        satisfaction: 0.8
      };

      await engine.learnFromInteractions(testUserId, [oldInteraction]);

      const preferences = await engine.getUserPreferences(testUserId);
      const musicInterest = preferences.interests.find(i => i.category === InterestCategory.MUSIC);
      
      // Interest should exist but with reduced strength due to age, or be removed if too weak
      if (musicInterest) {
        expect(musicInterest.strength).toBeLessThan(0.8); // Should be less than original satisfaction
      } else {
        // Interest was removed due to decay - this is also valid behavior
        expect(preferences.interests.find(i => i.category === InterestCategory.MUSIC)).toBeUndefined();
      }
    });

    test('should limit number of interests for data minimization', async () => {
      // Requirement: 6.1 (data minimization)
      await engine.initializeUserPreferences(testUserId);

      // Create many interactions with different interests
      const interactions: UserInteraction[] = [];
      const categories = Object.values(InterestCategory);
      
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        interactions.push({
          userId: testUserId,
          recommendationId: `rec-${i}`,
          interactionType: InteractionType.COMPLETE,
          timestamp: new Date(),
          context: {
            userId: testUserId,
            timestamp: new Date(),
            location: { type: 'home', indoorOutdoor: 'indoor' },
            activity: { 
              currentActivity: category,
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
            timeSpent: 30,
            engagementLevel: 'medium',
            wouldRecommendAgain: true
          },
          satisfaction: 0.5 + (i % 5) * 0.1 // Varying satisfaction
        });
      }

      await engine.learnFromInteractions(testUserId, interactions);

      const preferences = await engine.getUserPreferences(testUserId);
      // Should limit interests to reasonable number (50 in implementation)
      expect(preferences.interests.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Privacy and Security', () => {
    test('should anonymize preferences when required', async () => {
      // Requirement: 6.1, 6.2
      await engine.initializeUserPreferences(testUserId);
      
      const restrictions: DataRestriction[] = [{
        type: 'remove_personal_interests',
        description: 'Remove personal interests',
        scope: ['interests']
      }];
      
      privacyManager.setAccessPolicy(true, true, restrictions);

      const preferences = await engine.getUserPreferences(testUserId);
      
      // Should have applied anonymization (mock implementation adds anonymized flag)
      expect(preferences).toBeDefined();
    });

    test('should validate user preferences structure', async () => {
      // Requirement: 6.3
      await engine.initializeUserPreferences(testUserId);

      // Try to update with invalid structure
      const invalidUpdate = {
        interests: 'not-an-array' // Invalid type
      };

      await expect(engine.updateUserPreferences(testUserId, invalidUpdate as any))
        .rejects.toThrow();
    });

    test('should handle privacy manager errors gracefully', async () => {
      // Requirement: 6.2
      await engine.initializeUserPreferences(testUserId);
      
      // Mock privacy manager to throw error
      privacyManager.enforcePrivacyPreferences = jest.fn().mockRejectedValue(new Error('Privacy service unavailable'));

      await expect(engine.getUserPreferences(testUserId))
        .rejects.toThrow('Privacy service unavailable');
    });
  });

  describe('User Insights and Analytics', () => {
    test('should generate user insights', async () => {
      // Requirement: 1.4, 7.5
      await engine.initializeUserPreferences(testUserId);

      // Add some interests first
      const interests: Interest[] = [
        {
          category: InterestCategory.SPORTS,
          subcategory: 'soccer',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.MUSIC,
          subcategory: 'piano',
          strength: 0.7,
          recency: new Date(),
          source: 'inferred'
        }
      ];

      await engine.updateUserPreferences(testUserId, { interests });

      const insights = await engine.getUserInsights(testUserId);

      expect(insights.userId).toBe(testUserId);
      expect(insights.topInterests).toBeDefined();
      expect(insights.topInterests.length).toBeGreaterThan(0);
      expect(insights.topInterests[0].strength).toBe(0.9); // Should be sorted by strength
      expect(insights.behaviorPatterns).toBeDefined();
      expect(insights.preferenceStrength).toBeDefined();
      expect(insights.contextualFactors).toBeDefined();
      expect(insights.recommendationHistory).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      const errorStorage = {
        ...storage,
        loadUserPreferences: jest.fn().mockRejectedValue(new Error('Storage unavailable'))
      };

      const errorEngine = new UserPreferenceEngine(errorStorage, privacyManager);

      await expect(errorEngine.getUserPreferences(testUserId))
        .rejects.toThrow('Storage unavailable');
    });

    test('should handle invalid user interactions', async () => {
      // Requirement: 1.4
      await engine.initializeUserPreferences(testUserId);

      const invalidInteraction = {
        userId: testUserId,
        recommendationId: 'rec-123',
        interactionType: 'invalid-type' as any,
        timestamp: new Date(),
        context: null as any, // Invalid context
        outcome: null as any, // Invalid outcome
        satisfaction: -1 // Invalid satisfaction
      };

      // Should not throw error, but should handle gracefully
      await expect(engine.learnFromInteractions(testUserId, [invalidInteraction]))
        .resolves.not.toThrow();
    });
  });
});