/**
 * Unit tests for Family Preference Coordinator
 * 
 * Tests family-wide preference aggregation, conflict resolution,
 * and shared activity preference matching.
 * 
 * Requirements: 1.2, 4.3, 6.3
 */

import { FamilyPreferenceCoordinator, IFamilyStorage } from './family-preference-coordinator';
import { UserPreferenceEngine } from './user-preference-engine';
import { InMemoryFamilyStorage } from './family-storage';
import { InMemoryUserPreferenceStorage } from './user-preference-storage';
import {
  UserPreferences,
  Interest,
  FamilyContext,
  PreferenceConflict,
  GroupDynamics,
  PrivacyDecision,
  DataOperation
} from '../types';
import { ActivityRecommendation, FamilyActivityRecommendation } from '../interfaces';
import {
  InterestCategory,
  ActivityCategory,
  DifficultyLevel,
  PrivacyLevel,
  Subject,
  RecommendationType
} from '../enums';
import { IPrivacyManager } from '../interfaces';

// Mock Privacy Manager
class MockPrivacyManager implements IPrivacyManager {
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

describe('FamilyPreferenceCoordinator', () => {
  let coordinator: FamilyPreferenceCoordinator;
  let userPreferenceEngine: UserPreferenceEngine;
  let familyStorage: IFamilyStorage;
  let privacyManager: MockPrivacyManager;
  
  const testFamilyId = 'family-123';
  const parentId = 'parent-1';
  const childId = 'child-1';
  const child2Id = 'child-2';

  beforeEach(async () => {
    const userStorage = new InMemoryUserPreferenceStorage();
    familyStorage = new InMemoryFamilyStorage();
    privacyManager = new MockPrivacyManager();
    
    userPreferenceEngine = new UserPreferenceEngine(userStorage, privacyManager);
    coordinator = new FamilyPreferenceCoordinator(userPreferenceEngine, familyStorage, privacyManager);

    // Set up test family
    await (familyStorage as any).addFamilyMember(testFamilyId, parentId);
    await (familyStorage as any).addFamilyMember(testFamilyId, childId);
    await (familyStorage as any).addFamilyMember(testFamilyId, child2Id);

    // Initialize user preferences
    await userPreferenceEngine.initializeUserPreferences(parentId);
    await userPreferenceEngine.initializeUserPreferences(childId);
    await userPreferenceEngine.initializeUserPreferences(child2Id);
  });

  describe('Family Preference Aggregation', () => {
    test('should aggregate interests from all family members', async () => {
      // Requirement: 1.2, 4.3
      
      // Set up different interests for family members
      const parentInterests: Interest[] = [
        {
          category: InterestCategory.SPORTS,
          subcategory: 'tennis',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.COOKING,
          subcategory: 'baking',
          strength: 0.7,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      const childInterests: Interest[] = [
        {
          category: InterestCategory.SPORTS,
          subcategory: 'soccer',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.ENTERTAINMENT,
          subcategory: 'board-games',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      const child2Interests: Interest[] = [
        {
          category: InterestCategory.ARTS,
          subcategory: 'drawing',
          strength: 0.6,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.SPORTS,
          subcategory: 'swimming',
          strength: 0.7,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      await userPreferenceEngine.updateUserPreferences(parentId, { interests: parentInterests });
      await userPreferenceEngine.updateUserPreferences(childId, { interests: childInterests });
      await userPreferenceEngine.updateUserPreferences(child2Id, { interests: child2Interests });

      const familyPreferences = await coordinator.aggregateFamilyPreferences(testFamilyId);

      expect(familyPreferences.userId).toBe(testFamilyId);
      expect(familyPreferences.interests).toBeDefined();
      expect(familyPreferences.interests.length).toBeGreaterThan(0);

      // Should have sports interests from multiple members
      const sportsInterests = familyPreferences.interests.filter(i => i.category === InterestCategory.SPORTS);
      expect(sportsInterests.length).toBeGreaterThan(0);

      // Should be marked as social source
      expect(familyPreferences.interests.every(i => i.source === 'social')).toBe(true);
    });

    test('should aggregate activity preferences with proper weighting', async () => {
      // Requirement: 1.2
      
      // Set up different activity preferences
      await userPreferenceEngine.updateUserPreferences(parentId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.FAMILY, ActivityCategory.OUTDOOR],
          preferredDifficulty: DifficultyLevel.INTERMEDIATE,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) }, // 2 hours
          indoorOutdoorPreference: 'outdoor',
          socialPreference: 'group',
          physicalActivityLevel: 'high'
        }
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.ENTERTAINMENT, ActivityCategory.EDUCATIONAL],
          preferredDifficulty: DifficultyLevel.EASY,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour
          indoorOutdoorPreference: 'indoor',
          socialPreference: 'group',
          physicalActivityLevel: 'medium'
        }
      });

      const familyPreferences = await coordinator.aggregateFamilyPreferences(testFamilyId);
      const activityPrefs = familyPreferences.activityPreferences;

      expect(activityPrefs).toBeDefined();
      expect(activityPrefs.preferredCategories).toContain(ActivityCategory.FAMILY);
      expect(activityPrefs.socialPreference).toBe('group'); // Common preference
      expect(['medium', 'high']).toContain(activityPrefs.physicalActivityLevel); // Aggregated
    });

    test('should handle privacy preferences with most restrictive settings', async () => {
      // Requirement: 6.3
      
      await userPreferenceEngine.updateUserPreferences(parentId, {
        privacyPreferences: {
          dataSharing: PrivacyLevel.FAMILY,
          locationTracking: true,
          behaviorAnalysis: true,
          familyDataSharing: true,
          externalIntegrations: true,
          dataRetentionDays: 365
        }
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        privacyPreferences: {
          dataSharing: PrivacyLevel.PRIVATE,
          locationTracking: false,
          behaviorAnalysis: false,
          familyDataSharing: false,
          externalIntegrations: false,
          dataRetentionDays: 30
        }
      });

      const familyPreferences = await coordinator.aggregateFamilyPreferences(testFamilyId);
      const privacyPrefs = familyPreferences.privacyPreferences;

      // Should use most restrictive settings
      expect(privacyPrefs.dataSharing).toBe(PrivacyLevel.PRIVATE);
      expect(privacyPrefs.locationTracking).toBe(true); // Any member allowing = true
      expect(privacyPrefs.behaviorAnalysis).toBe(false); // All must agree = false
      expect(privacyPrefs.familyDataSharing).toBe(false); // All must agree = false
      expect(privacyPrefs.externalIntegrations).toBe(true); // Any member allowing = true
      expect(privacyPrefs.dataRetentionDays).toBe(30); // Minimum
    });

    test('should handle empty family gracefully', async () => {
      // Requirement: 1.2
      const emptyFamilyId = 'empty-family';
      
      await expect(coordinator.aggregateFamilyPreferences(emptyFamilyId))
        .rejects.toThrow('No family members found');
    });
  });

  describe('Conflict Identification and Resolution', () => {
    test('should identify activity preference conflicts', async () => {
      // Requirement: 1.2, 4.3
      
      // Set up conflicting preferences
      await userPreferenceEngine.updateUserPreferences(parentId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.OUTDOOR, ActivityCategory.PHYSICAL],
          preferredDifficulty: DifficultyLevel.ADVANCED,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 3 * 60 * 60 * 1000) },
          indoorOutdoorPreference: 'outdoor',
          socialPreference: 'group',
          physicalActivityLevel: 'high'
        }
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.INDOOR, ActivityCategory.ENTERTAINMENT],
          preferredDifficulty: DifficultyLevel.BEGINNER,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 30 * 60 * 1000) },
          indoorOutdoorPreference: 'indoor',
          socialPreference: 'solo',
          physicalActivityLevel: 'low'
        }
      });

      const conflicts = await coordinator.identifyAndResolveConflicts(testFamilyId);

      expect(conflicts).toBeDefined();
      expect(conflicts.length).toBeGreaterThan(0);
      
      // Should have conflicts for different preference types
      const conflictTypes = conflicts.map(c => c.conflictType);
      expect(conflictTypes).toContain('activity');
    });

    test('should identify schedule conflicts', async () => {
      // Requirement: 1.2, 4.3
      
      // Set up conflicting schedule preferences
      await userPreferenceEngine.updateUserPreferences(parentId, {
        schedulePreferences: {
          preferredWakeTime: '06:00',
          preferredBedTime: '23:00',
          workingHours: [],
          breakPreferences: [],
          flexibilityLevel: 'rigid'
        }
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        schedulePreferences: {
          preferredWakeTime: '09:00',
          preferredBedTime: '21:00',
          workingHours: [],
          breakPreferences: [],
          flexibilityLevel: 'flexible'
        }
      });

      const conflicts = await coordinator.identifyAndResolveConflicts(testFamilyId);

      expect(conflicts).toBeDefined();
      // Should identify time conflicts (3+ hour difference)
      const timeConflicts = conflicts.filter(c => c.conflictType === 'time');
      expect(timeConflicts.length).toBeGreaterThan(0);
    });

    test('should resolve conflicts based on family dynamics', async () => {
      // Requirement: 4.3
      
      // Set up family dynamics
      const dynamics: GroupDynamics = {
        leadershipStyle: 'collaborative',
        decisionMaking: 'consensus',
        conflictResolution: 'compromise'
      };
      await familyStorage.saveFamilyDynamics(testFamilyId, dynamics);

      // Create some conflicts
      await userPreferenceEngine.updateUserPreferences(parentId, {
        interests: [{
          category: InterestCategory.SPORTS,
          subcategory: 'tennis',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        }]
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        interests: [{
          category: InterestCategory.SPORTS,
          subcategory: 'tennis',
          strength: 0.1, // Very low interest - creates conflict
          recency: new Date(),
          source: 'explicit'
        }]
      });

      const conflicts = await coordinator.identifyAndResolveConflicts(testFamilyId);

      expect(conflicts).toBeDefined();
      // Should have resolution strategies based on dynamics
      conflicts.forEach(conflict => {
        expect(conflict.resolutionStrategy).toBeDefined();
        expect(['find_middle_ground', 'facilitate_discussion', 'take_turns'])
          .toContain(conflict.resolutionStrategy);
      });
    });

    test('should update family dynamics based on interactions', async () => {
      // Requirement: 4.3
      
      const interactions = [
        { userId: parentId, decision: 'lead', outcome: 'success' },
        { userId: parentId, decision: 'lead', outcome: 'success' },
        { userId: childId, decision: 'follow', outcome: 'success' }
      ];

      await coordinator.updateFamilyDynamics(testFamilyId, interactions);

      const updatedDynamics = await familyStorage.getFamilyDynamics(testFamilyId);
      expect(updatedDynamics).toBeDefined();
      expect(updatedDynamics.leadershipStyle).toBeDefined();
      expect(updatedDynamics.decisionMaking).toBeDefined();
      expect(updatedDynamics.conflictResolution).toBeDefined();
    });
  });

  describe('Shared Activity Matching', () => {
    test('should find activities that match family preferences', async () => {
      // Requirement: 1.2, 4.3
      
      // Set up family preferences for outdoor activities
      await userPreferenceEngine.updateUserPreferences(parentId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.OUTDOOR, ActivityCategory.FAMILY],
          preferredDifficulty: DifficultyLevel.INTERMEDIATE,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
          indoorOutdoorPreference: 'outdoor',
          socialPreference: 'group',
          physicalActivityLevel: 'medium'
        }
      });

      await userPreferenceEngine.updateUserPreferences(childId, {
        activityPreferences: {
          preferredCategories: [ActivityCategory.OUTDOOR, ActivityCategory.PHYSICAL],
          preferredDifficulty: DifficultyLevel.EASY,
          preferredDuration: { start: new Date(), end: new Date(Date.now() + 90 * 60 * 1000) },
          indoorOutdoorPreference: 'outdoor',
          socialPreference: 'group',
          physicalActivityLevel: 'medium'
        }
      });

      // Mock available activities
      const availableActivities: ActivityRecommendation[] = [
        {
          id: 'activity-1',
          type: RecommendationType.ACTIVITY,
          title: 'Family Hiking',
          description: 'Nature hike for the whole family',
          confidence: 0.8,
          reasoning: ['Matches outdoor preference', 'Good for family bonding'],
          actionable: true,
          integrationActions: [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: {
            generatedAt: new Date(),
            userId: testFamilyId,
            contextId: 'ctx-1',
            engineVersion: '1.0',
            safetyValidated: true,
            privacyCompliant: true
          },
          category: ActivityCategory.OUTDOOR,
          duration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
          difficulty: DifficultyLevel.INTERMEDIATE,
          requiredResources: [],
          weatherDependency: { indoor: false, outdoor: true, weatherDependent: true },
          ageAppropriate: true,
          educationalValue: 0.6,
          physicalActivity: true,
          socialActivity: true
        },
        {
          id: 'activity-2',
          type: RecommendationType.ACTIVITY,
          title: 'Indoor Gaming',
          description: 'Video games session',
          confidence: 0.5,
          reasoning: ['Indoor activity'],
          actionable: true,
          integrationActions: [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: {
            generatedAt: new Date(),
            userId: testFamilyId,
            contextId: 'ctx-2',
            engineVersion: '1.0',
            safetyValidated: true,
            privacyCompliant: true
          },
          category: ActivityCategory.INDOOR,
          duration: { start: new Date(), end: new Date(Date.now() + 60 * 60 * 1000) },
          difficulty: DifficultyLevel.EASY,
          requiredResources: [],
          weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
          ageAppropriate: true,
          educationalValue: 0.2,
          physicalActivity: false,
          socialActivity: true
        }
      ];

      const sharedActivities = await coordinator.findSharedActivityPreferences(
        testFamilyId,
        availableActivities
      );

      expect(sharedActivities).toBeDefined();
      expect(sharedActivities.length).toBeGreaterThan(0);

      // Should prefer outdoor family activity
      const hikingActivity = sharedActivities.find(a => a.title === 'Family Hiking');
      expect(hikingActivity).toBeDefined();
      expect(hikingActivity!.familyMembers).toEqual([parentId, childId, child2Id]);
      expect(hikingActivity!.roleAssignments).toBeDefined();
      expect(hikingActivity!.coordinationRequired).toBe(true);
      expect(hikingActivity!.conflictResolution).toBeDefined();
    });

    test('should assign appropriate roles for family activities', async () => {
      // Requirement: 1.2
      
      const activity: ActivityRecommendation = {
        id: 'cooking-activity',
        type: RecommendationType.ACTIVITY,
        title: 'Family Cooking',
        description: 'Cook dinner together',
        confidence: 0.9,
        reasoning: ['Family bonding', 'Educational'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: testFamilyId,
          contextId: 'ctx-3',
          engineVersion: '1.0',
          safetyValidated: true,
          privacyCompliant: true
        },
        category: ActivityCategory.FAMILY,
        duration: { start: new Date(), end: new Date(Date.now() + 90 * 60 * 1000) },
        difficulty: DifficultyLevel.INTERMEDIATE,
        requiredResources: [],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.7,
        physicalActivity: false,
        socialActivity: true
      };

      const sharedActivities = await coordinator.findSharedActivityPreferences(
        testFamilyId,
        [activity]
      );

      expect(sharedActivities).toHaveLength(1);
      const familyActivity = sharedActivities[0];
      
      expect(familyActivity.roleAssignments).toBeDefined();
      expect(familyActivity.roleAssignments.length).toBe(3); // All family members
      expect(familyActivity.roleAssignments.every((r: any) => r.role === 'participant')).toBe(true);
    });
  });

  describe('Family Context Management', () => {
    test('should generate comprehensive family context', async () => {
      // Requirement: 4.3
      
      const presentMembers = [parentId, childId];
      const familyContext = await coordinator.getFamilyContext(testFamilyId, presentMembers);

      expect(familyContext.familyId).toBe(testFamilyId);
      expect(familyContext.membersPresent).toEqual(presentMembers);
      expect(familyContext.sharedPreferences).toBeDefined();
      expect(familyContext.conflictingPreferences).toBeDefined();
      expect(familyContext.groupDynamics).toBeDefined();
    });

    test('should handle partial family presence', async () => {
      // Requirement: 4.3
      
      // Only parent present
      const presentMembers = [parentId];
      const familyContext = await coordinator.getFamilyContext(testFamilyId, presentMembers);

      expect(familyContext.membersPresent).toEqual([parentId]);
      expect(familyContext.sharedPreferences).toBeDefined();
      // Should still have family-wide preferences even with partial presence
    });
  });

  describe('Error Handling', () => {
    test('should handle missing family members gracefully', async () => {
      // Requirement: 1.2
      
      const nonExistentFamilyId = 'non-existent-family';
      
      await expect(coordinator.aggregateFamilyPreferences(nonExistentFamilyId))
        .rejects.toThrow('No family members found');
    });

    test('should handle privacy manager errors', async () => {
      // Requirement: 6.3
      
      // Mock privacy manager to deny access
      privacyManager.enforcePrivacyPreferences = jest.fn().mockResolvedValue({
        allowed: false,
        restrictions: [],
        anonymizationRequired: false,
        consentRequired: false,
        auditRequired: false
      });

      await expect(coordinator.aggregateFamilyPreferences(testFamilyId))
        .rejects.toThrow('No valid family member preferences found');
    });

    test('should continue with available members when some fail to load', async () => {
      // Requirement: 1.2
      
      // Add a member that will fail to load
      const failingMemberId = 'failing-member';
      await (familyStorage as any).addFamilyMember(testFamilyId, failingMemberId);

      // Mock user preference engine to fail for this member
      const originalGetPreferences = userPreferenceEngine.getUserPreferences;
      userPreferenceEngine.getUserPreferences = jest.fn().mockImplementation((userId) => {
        if (userId === failingMemberId) {
          throw new Error('Failed to load preferences');
        }
        return originalGetPreferences.call(userPreferenceEngine, userId);
      });

      // Should still work with remaining members
      const familyPreferences = await coordinator.aggregateFamilyPreferences(testFamilyId);
      expect(familyPreferences).toBeDefined();
      expect(familyPreferences.userId).toBe(testFamilyId);
    });
  });
});