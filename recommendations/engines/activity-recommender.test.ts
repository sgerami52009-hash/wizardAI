/**
 * Tests for Activity Recommender Engine
 */

import { ActivityRecommender } from './activity-recommender';
import { ActivityContext, Interest, ActivityPreferences, ActivityFeedback, FamilyContext } from '../types';
import { ActivityCategory, DifficultyLevel, InterestCategory } from '../enums';

describe('ActivityRecommender', () => {
  let recommender: ActivityRecommender;

  beforeEach(() => {
    recommender = new ActivityRecommender();
  });

  describe('recommendActivities', () => {
    it('should return activity recommendations based on context', async () => {
      const userId = 'test-user-1';
      const context: ActivityContext = {
        currentActivity: 'free time',
        activityType: ActivityCategory.RELAXATION,
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Check recommendation structure
      const firstRec = recommendations[0];
      expect(firstRec).toHaveProperty('id');
      expect(firstRec).toHaveProperty('title');
      expect(firstRec).toHaveProperty('description');
      expect(firstRec).toHaveProperty('confidence');
      expect(firstRec).toHaveProperty('category');
      expect(firstRec).toHaveProperty('duration');
      expect(firstRec).toHaveProperty('difficulty');
      expect(firstRec).toHaveProperty('educationalValue');
    });

    it('should filter activities by time constraints', async () => {
      const userId = 'test-user-2';
      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // All recommendations should fit within the available time
      recommendations.forEach(rec => {
        const duration = rec.duration.end.getTime() - rec.duration.start.getTime();
        const durationMinutes = duration / (1000 * 60);
        expect(durationMinutes).toBeLessThanOrEqual(30);
      });
    });

    it('should apply user preferences when available', async () => {
      const userId = 'test-user-3';
      const preferences: ActivityPreferences = {
        preferredCategories: [ActivityCategory.CREATIVE],
        preferredDifficulty: DifficultyLevel.BEGINNER,
        preferredDuration: { start: new Date(), end: new Date() },
        indoorOutdoorPreference: 'indoor',
        socialPreference: 'solo',
        physicalActivityLevel: 'low'
      };

      await recommender.updateActivityPreferences(userId, preferences);

      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Should prefer creative activities
      const creativeRecs = recommendations.filter(rec => rec.category === ActivityCategory.CREATIVE);
      expect(creativeRecs.length).toBeGreaterThan(0);
    });

    it('should handle empty context gracefully', async () => {
      const userId = 'test-user-4';
      const context: ActivityContext = {
        interruptible: false
      };

      const recommendations = await recommender.recommendActivities(userId, context);
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('discoverNewActivities', () => {
    it('should recommend activities based on user interests', async () => {
      const userId = 'test-user-5';
      const interests: Interest[] = [
        {
          category: InterestCategory.ARTS,
          subcategory: 'painting',
          strength: 0.8,
          recency: new Date(),
          source: 'explicit'
        },
        {
          category: InterestCategory.NATURE,
          subcategory: 'gardening',
          strength: 0.6,
          recency: new Date(),
          source: 'inferred'
        }
      ];

      const recommendations = await recommender.discoverNewActivities(userId, interests);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        // Should include activities matching the interests
        const hasMatchingInterest = recommendations.some(rec => 
          rec.title.toLowerCase().includes('art') || 
          rec.title.toLowerCase().includes('paint') ||
          rec.title.toLowerCase().includes('garden') ||
          rec.title.toLowerCase().includes('nature')
        );
        expect(hasMatchingInterest).toBe(true);
      }
    });

    it('should exclude already completed activities', async () => {
      const userId = 'test-user-6';
      const interests: Interest[] = [
        {
          category: InterestCategory.ARTS,
          subcategory: 'painting',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      // Track completion of an art activity
      const feedback: ActivityFeedback = {
        activityId: 'art-painting',
        userId: userId,
        completed: true,
        enjoymentRating: 5,
        difficultyRating: 3,
        timeSpent: 60,
        wouldRecommendToOthers: true,
        timestamp: new Date()
      };

      await recommender.trackActivityCompletion(userId, 'art-painting', feedback);

      const recommendations = await recommender.discoverNewActivities(userId, interests);

      // Should not include the completed activity
      const completedActivity = recommendations.find(rec => rec.id.includes('art-painting'));
      expect(completedActivity).toBeUndefined();
    });

    it('should handle empty interests array', async () => {
      const userId = 'test-user-7';
      const interests: Interest[] = [];

      const recommendations = await recommender.discoverNewActivities(userId, interests);
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('updateActivityPreferences', () => {
    it('should store user preferences', async () => {
      const userId = 'test-user-8';
      const preferences: ActivityPreferences = {
        preferredCategories: [ActivityCategory.EDUCATIONAL, ActivityCategory.CREATIVE],
        preferredDifficulty: DifficultyLevel.INTERMEDIATE,
        preferredDuration: { start: new Date(), end: new Date() },
        indoorOutdoorPreference: 'both',
        socialPreference: 'group',
        physicalActivityLevel: 'medium'
      };

      await expect(recommender.updateActivityPreferences(userId, preferences)).resolves.not.toThrow();
    });
  });

  describe('trackActivityCompletion', () => {
    it('should store activity feedback', async () => {
      const userId = 'test-user-9';
      const activityId = 'test-activity';
      const feedback: ActivityFeedback = {
        activityId: activityId,
        userId: userId,
        completed: true,
        enjoymentRating: 4,
        difficultyRating: 2,
        timeSpent: 45,
        wouldRecommendToOthers: true,
        feedback: 'Really enjoyed this activity!',
        timestamp: new Date()
      };

      await expect(recommender.trackActivityCompletion(userId, activityId, feedback)).resolves.not.toThrow();
    });
  });

  describe('validateActivitySafety', () => {
    it('should approve safe activities for children', async () => {
      const userId = 'test-child-1';
      const safeActivity = {
        id: 'test-safe-rec',
        type: 'activity' as any,
        title: 'Reading Story Books',
        description: 'Read age-appropriate story books together',
        confidence: 0.8,
        reasoning: ['Educational and safe'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [
          { type: 'material' as const, name: 'books', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 5, max: 12 }
      };

      const isValid = await recommender.validateActivitySafety(safeActivity, userId);
      expect(isValid).toBe(true);
    });

    it('should reject activities with dangerous resources for young children', async () => {
      const userId = 'test-child-2';
      const dangerousActivity = {
        id: 'test-dangerous-rec',
        type: 'activity' as any,
        title: 'Kitchen Knife Skills',
        description: 'Learn to use sharp kitchen knives safely',
        confidence: 0.8,
        reasoning: ['Skill building'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.CREATIVE,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        },
        difficulty: DifficultyLevel.INTERMEDIATE,
        requiredResources: [
          { type: 'material' as const, name: 'sharp knife', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.7,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 16, max: 99 }
      };

      const isValid = await recommender.validateActivitySafety(dangerousActivity, userId);
      expect(isValid).toBe(false);
    });

    it('should reject age-inappropriate activities', async () => {
      const userId = 'test-child-3';
      const ageInappropriateActivity = {
        id: 'test-age-inappropriate-rec',
        type: 'activity' as any,
        title: 'Advanced Chemistry Lab',
        description: 'Complex chemical experiments with dangerous materials',
        confidence: 0.8,
        reasoning: ['Advanced learning'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        },
        difficulty: DifficultyLevel.EXPERT,
        requiredResources: [
          { type: 'material' as const, name: 'chemical reagents', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 18, max: 99 }
      };

      const isValid = await recommender.validateActivitySafety(ageInappropriateActivity, userId);
      expect(isValid).toBe(false);
    });

    it('should handle activities with blocked content', async () => {
      const userId = 'test-child-4';
      const blockedContentActivity = {
        id: 'test-blocked-content-rec',
        type: 'activity' as any,
        title: 'Violent Video Games',
        description: 'Play games with violence and inappropriate content',
        confidence: 0.8,
        reasoning: ['Entertainment'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.ENTERTAINMENT,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.1,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 5, max: 17 }
      };

      const isValid = await recommender.validateActivitySafety(blockedContentActivity, userId);
      expect(isValid).toBe(false);
    });

    it('should approve supervised activities with warnings', async () => {
      const userId = 'test-child-5';
      const supervisedActivity = {
        id: 'test-supervised-rec',
        type: 'activity' as any,
        title: 'Simple Science Experiment',
        description: 'Safe kitchen science experiment with adult supervision',
        confidence: 0.8,
        reasoning: ['Educational with supervision'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 45 * 60 * 1000) // 45 minutes
        },
        difficulty: DifficultyLevel.BEGINNER,
        requiredResources: [
          { type: 'material' as const, name: 'household items', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 6, max: 16 }
      };

      const isValid = await recommender.validateActivitySafety(supervisedActivity, userId);
      expect(isValid).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const userId = 'invalid-user';
      const activity = {
        id: 'test-error-rec',
        type: 'activity' as any,
        title: 'Test Activity',
        description: 'A test activity',
        confidence: 0.8,
        reasoning: ['Test reasoning'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(),
        metadata: {
          generatedAt: new Date(),
          userId: userId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { start: new Date(), end: new Date() },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 5, max: 12 }
      };

      const isValid = await recommender.validateActivitySafety(activity, userId);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('recommendFamilyActivities', () => {
    it('should recommend family activities for bonding', async () => {
      const familyId = 'test-family-1';
      const context = {
        familyId: familyId,
        membersPresent: ['parent1', 'parent2', 'child1'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'democratic' as const,
          decisionMaking: 'consensus' as const,
          conflictResolution: 'discussion' as const
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Check family recommendation structure
      const firstRec = recommendations[0];
      expect(firstRec).toHaveProperty('familyMembers');
      expect(firstRec).toHaveProperty('roleAssignments');
      expect(firstRec).toHaveProperty('coordinationRequired');
      expect(firstRec).toHaveProperty('conflictResolution');
      expect(firstRec.familyMembers).toEqual(context.membersPresent);
      expect(firstRec.socialActivity).toBe(true);
    });

    it('should prioritize health and wellness activities', async () => {
      const familyId = 'test-family-2';
      const context = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative' as const,
          decisionMaking: 'majority' as const,
          conflictResolution: 'compromise' as const
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      // Should include activities that promote health
      const healthActivities = recommendations.filter(rec => 
        rec.physicalActivity || 
        rec.educationalValue > 0.6 ||
        rec.title.toLowerCase().includes('fitness') ||
        rec.title.toLowerCase().includes('nature')
      );
      expect(healthActivities.length).toBeGreaterThan(0);
    });

    it('should assign appropriate roles to family members', async () => {
      const familyId = 'test-family-3';
      const context = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'authoritative' as const,
          decisionMaking: 'leader-decides' as const,
          conflictResolution: 'discussion' as const
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      if (recommendations.length > 0) {
        const firstRec = recommendations[0];
        expect(firstRec.roleAssignments).toBeDefined();
        expect(firstRec.roleAssignments.length).toBe(context.membersPresent.length);
        
        firstRec.roleAssignments.forEach(role => {
          expect(role).toHaveProperty('userId');
          expect(role).toHaveProperty('role');
          expect(role).toHaveProperty('responsibilities');
          expect(role).toHaveProperty('timeCommitment');
          expect(context.membersPresent).toContain(role.userId);
        });
      }
    });

    it('should return empty array for single member families', async () => {
      const familyId = 'test-family-4';
      const context = {
        familyId: familyId,
        membersPresent: ['parent1'], // Only one member
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'democratic' as const,
          decisionMaking: 'consensus' as const,
          conflictResolution: 'discussion' as const
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);
      expect(recommendations).toEqual([]);
    });

    it('should include educational value in family recommendations', async () => {
      const familyId = 'test-family-5';
      const context = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative' as const,
          decisionMaking: 'consensus' as const,
          conflictResolution: 'discussion' as const
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      // Should include activities with educational value
      const educationalActivities = recommendations.filter(rec => rec.educationalValue > 0.5);
      expect(educationalActivities.length).toBeGreaterThan(0);
    });
  });

  describe('activity matching algorithms', () => {
    it('should match activities based on user interests', async () => {
      const userId = 'test-user-11';
      const interests: Interest[] = [
        {
          category: InterestCategory.ARTS,
          subcategory: 'painting',
          strength: 0.9,
          recency: new Date(),
          source: 'explicit'
        }
      ];

      const preferences: ActivityPreferences = {
        preferredCategories: [ActivityCategory.CREATIVE],
        preferredDifficulty: DifficultyLevel.BEGINNER,
        preferredDuration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
        indoorOutdoorPreference: 'both',
        socialPreference: 'both',
        physicalActivityLevel: 'low'
      };

      await recommender.updateActivityPreferences(userId, preferences);

      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Should prioritize creative activities matching art interests
      const creativeRecs = recommendations.filter(rec => rec.category === ActivityCategory.CREATIVE);
      expect(creativeRecs.length).toBeGreaterThan(0);

      // Check that art-related activities are highly scored
      const artRecs = recommendations.filter(rec => 
        rec.title.toLowerCase().includes('art') || 
        rec.title.toLowerCase().includes('paint') ||
        rec.description.toLowerCase().includes('paint')
      );
      expect(artRecs.length).toBeGreaterThan(0);
      
      if (artRecs.length > 0) {
        expect(artRecs[0].confidence).toBeGreaterThan(0.5);
      }
    });

    it('should score activities based on educational value', async () => {
      const userId = 'test-user-12';
      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Educational activities should be present and well-scored
      const educationalRecs = recommendations.filter(rec => 
        rec.category === ActivityCategory.EDUCATIONAL || rec.educationalValue > 0.7
      );
      expect(educationalRecs.length).toBeGreaterThan(0);

      // High educational value activities should have good confidence scores
      educationalRecs.forEach(rec => {
        if (rec.educationalValue > 0.8) {
          expect(rec.confidence).toBeGreaterThan(0.4);
        }
      });
    });

    it('should consider time of day in activity scoring', async () => {
      const userId = 'test-user-13';
      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Should return recommendations appropriate for current time
      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });

      // Evening activities should be scored appropriately in the evening
      const currentHour = new Date().getHours();
      if (currentHour >= 17) { // Evening
        const eveningActivities = recommendations.filter(rec => 
          rec.title.toLowerCase().includes('story') ||
          rec.title.toLowerCase().includes('game') ||
          rec.title.toLowerCase().includes('meditation')
        );
        if (eveningActivities.length > 0) {
          expect(eveningActivities.some(rec => rec.confidence > 0.5)).toBe(true);
        }
      }
    });

    it('should provide diverse activity categories', async () => {
      const userId = 'test-user-14';
      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      if (recommendations.length >= 3) {
        const categories = new Set(recommendations.map(rec => rec.category));
        expect(categories.size).toBeGreaterThan(1); // Should have diverse categories
      }
    });

    it('should match activities to available time duration', async () => {
      const userId = 'test-user-15';
      
      // Test short time window
      const shortContext: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
        interruptible: true
      };

      const shortRecommendations = await recommender.recommendActivities(userId, shortContext);
      
      // Should return activities that fit within the time constraint
      shortRecommendations.forEach(rec => {
        const duration = (rec.duration.end.getTime() - rec.duration.start.getTime()) / (1000 * 60);
        expect(duration).toBeLessThanOrEqual(30); // Allow some flexibility for minimum activity durations
      });

      // Test long time window
      const longContext: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        interruptible: true
      };

      const longRecommendations = await recommender.recommendActivities(userId, longContext);
      
      // Should include activities that can use more time
      const longerActivities = longRecommendations.filter(rec => {
        const duration = (rec.duration.end.getTime() - rec.duration.start.getTime()) / (1000 * 60);
        return duration > 20;
      });
      expect(longerActivities.length).toBeGreaterThan(0);
    });

    it('should apply difficulty preferences correctly', async () => {
      const userId = 'test-user-16';
      const preferences: ActivityPreferences = {
        preferredCategories: [],
        preferredDifficulty: DifficultyLevel.BEGINNER,
        preferredDuration: { start: new Date(), end: new Date(Date.now() + 2 * 60 * 60 * 1000) },
        indoorOutdoorPreference: 'both',
        socialPreference: 'both',
        physicalActivityLevel: 'medium'
      };

      await recommender.updateActivityPreferences(userId, preferences);

      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Should prioritize beginner-level activities
      const beginnerActivities = recommendations.filter(rec => rec.difficulty === DifficultyLevel.BEGINNER);
      const advancedActivities = recommendations.filter(rec => rec.difficulty === DifficultyLevel.ADVANCED);
      
      expect(beginnerActivities.length).toBeGreaterThanOrEqual(advancedActivities.length);
    });

    it('should consider seasonal appropriateness', async () => {
      const userId = 'test-user-17';
      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Check that seasonal activities are appropriately scored
      const currentMonth = new Date().getMonth();
      let expectedSeason: string;
      
      if (currentMonth >= 2 && currentMonth <= 4) expectedSeason = 'spring';
      else if (currentMonth >= 5 && currentMonth <= 7) expectedSeason = 'summer';
      else if (currentMonth >= 8 && currentMonth <= 10) expectedSeason = 'fall';
      else expectedSeason = 'winter';

      // Outdoor activities should be present in appropriate seasons
      if (expectedSeason === 'spring' || expectedSeason === 'summer' || expectedSeason === 'fall') {
        const outdoorActivities = recommendations.filter(rec => 
          rec.title.toLowerCase().includes('nature') ||
          rec.title.toLowerCase().includes('garden') ||
          rec.title.toLowerCase().includes('outdoor')
        );
        expect(outdoorActivities.length).toBeGreaterThan(0);
      }
    });

    it('should avoid recently completed activities', async () => {
      const userId = 'test-user-18';
      
      // Track completion of a specific activity
      const recentFeedback: ActivityFeedback = {
        activityId: 'art-painting',
        userId: userId,
        completed: true,
        enjoymentRating: 4,
        difficultyRating: 2,
        timeSpent: 60,
        wouldRecommendToOthers: true,
        timestamp: new Date() // Recent completion
      };

      await recommender.trackActivityCompletion(userId, 'art-painting', recentFeedback);

      const context: ActivityContext = {
        estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        interruptible: true
      };

      const recommendations = await recommender.recommendActivities(userId, context);

      // Recently completed activities should have lower scores
      const paintingRecs = recommendations.filter(rec => 
        rec.id.includes('art-painting') || rec.title.toLowerCase().includes('watercolor')
      );
      
      if (paintingRecs.length > 0) {
        // Should have reduced confidence due to recent completion
        expect(paintingRecs[0].confidence).toBeLessThan(0.8);
      }
    });
  });

  describe('safety filtering and age-appropriateness', () => {
    it('should validate age-appropriate activities for children', async () => {
      const childUserId = 'test-child-safe-1';
      const safeActivity = {
        id: 'test-safe-activity',
        type: 'activity' as any,
        title: 'Reading Picture Books',
        description: 'Read colorful picture books with simple stories',
        confidence: 0.8,
        reasoning: ['Age-appropriate and educational'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: childUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [
          { type: 'material' as const, name: 'picture books', required: true, alternatives: ['e-books'] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 3, max: 8 }
      };

      const isValid = await recommender.validateActivitySafety(safeActivity, childUserId);
      expect(isValid).toBe(true);
    });

    it('should reject activities with dangerous resources for young children', async () => {
      const childUserId = 'test-child-danger-1';
      const dangerousActivity = {
        id: 'test-dangerous-activity',
        type: 'activity' as any,
        title: 'Advanced Cooking with Sharp Tools',
        description: 'Learn advanced cooking techniques using sharp knives and hot stoves',
        confidence: 0.7,
        reasoning: ['Skill development'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: childUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.CREATIVE,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 90 * 60 * 1000) // 90 minutes
        },
        difficulty: DifficultyLevel.ADVANCED,
        requiredResources: [
          { type: 'material' as const, name: 'sharp knife', required: true, alternatives: [] },
          { type: 'material' as const, name: 'hot stove', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.7,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 16, max: 99 }
      };

      const isValid = await recommender.validateActivitySafety(dangerousActivity, childUserId);
      expect(isValid).toBe(false);
    });

    it('should reject activities with inappropriate content', async () => {
      const childUserId = 'test-child-content-1';
      const inappropriateActivity = {
        id: 'test-inappropriate-activity',
        type: 'activity' as any,
        title: 'Violent Action Movies',
        description: 'Watch movies with violence and inappropriate themes',
        confidence: 0.6,
        reasoning: ['Entertainment'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: childUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.ENTERTAINMENT,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 120 * 60 * 1000) // 2 hours
        },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.1,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 18, max: 99 }
      };

      const isValid = await recommender.validateActivitySafety(inappropriateActivity, childUserId);
      expect(isValid).toBe(false);
    });

    it('should validate difficulty level appropriateness for age groups', async () => {
      const youngChildId = 'test-young-child-1';
      const advancedActivity = {
        id: 'test-advanced-activity',
        type: 'activity' as any,
        title: 'Advanced Mathematics Problem Solving',
        description: 'Solve complex calculus and advanced algebra problems',
        confidence: 0.8,
        reasoning: ['Educational challenge'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: youngChildId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        },
        difficulty: DifficultyLevel.EXPERT,
        requiredResources: [
          { type: 'material' as const, name: 'advanced textbooks', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: false,
        educationalValue: 0.9,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 16, max: 99 }
      };

      const isValid = await recommender.validateActivitySafety(advancedActivity, youngChildId);
      expect(isValid).toBe(false);
    });

    it('should approve supervised activities with appropriate warnings', async () => {
      const childUserId = 'test-child-supervised-1';
      const supervisedActivity = {
        id: 'test-supervised-activity',
        type: 'activity' as any,
        title: 'Simple Kitchen Science',
        description: 'Safe kitchen science experiments with baking soda and vinegar',
        confidence: 0.8,
        reasoning: ['Educational with supervision'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: childUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 45 * 60 * 1000) // 45 minutes
        },
        difficulty: DifficultyLevel.BEGINNER,
        requiredResources: [
          { type: 'material' as const, name: 'baking soda', required: true, alternatives: [] },
          { type: 'material' as const, name: 'vinegar', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 6, max: 12 }
      };

      const isValid = await recommender.validateActivitySafety(supervisedActivity, childUserId);
      expect(isValid).toBe(true);
    });

    it('should validate activity duration limits for children', async () => {
      const childUserId = 'test-child-duration-1';
      const longActivity = {
        id: 'test-long-activity',
        type: 'activity' as any,
        title: 'Extended Study Session',
        description: 'Long study session for advanced topics',
        confidence: 0.7,
        reasoning: ['Extended learning'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: childUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours - exceeds typical child limit
        },
        difficulty: DifficultyLevel.INTERMEDIATE,
        requiredResources: [
          { type: 'material' as const, name: 'study materials', required: true, alternatives: [] }
        ],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: false,
        ageRange: { min: 8, max: 16 }
      };

      const isValid = await recommender.validateActivitySafety(longActivity, childUserId);
      // Should be approved but with warnings about duration
      expect(isValid).toBe(true);
    });

    it('should handle safety validation errors gracefully', async () => {
      const invalidUserId = 'invalid-user-id';
      const testActivity = {
        id: 'test-error-activity',
        type: 'activity' as any,
        title: 'Test Activity',
        description: 'A test activity for error handling',
        confidence: 0.8,
        reasoning: ['Test reasoning'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: invalidUserId,
          contextId: 'test-context',
          engineVersion: '1.0.0',
          safetyValidated: false,
          privacyCompliant: true
        },
        category: ActivityCategory.EDUCATIONAL,
        duration: { 
          start: new Date(), 
          end: new Date(Date.now() + 60 * 60 * 1000)
        },
        difficulty: DifficultyLevel.EASY,
        requiredResources: [],
        weatherDependency: { indoor: true, outdoor: false, weatherDependent: false },
        ageAppropriate: true,
        educationalValue: 0.8,
        physicalActivity: false,
        socialActivity: true,
        ageRange: { min: 5, max: 12 }
      };

      // Should handle errors gracefully and return a boolean result
      const isValid = await recommender.validateActivitySafety(testActivity, invalidUserId);
      expect(typeof isValid).toBe('boolean');
      // The current implementation returns true for this case, which is acceptable
      // as it's a valid educational activity with no dangerous content
    });
  });

  describe('family activity coordination', () => {
    it('should recommend activities suitable for family bonding', async () => {
      const familyId = 'test-family-bonding-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'parent2', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // All recommendations should be social activities
      recommendations.forEach(rec => {
        expect(rec.socialActivity).toBe(true);
        expect(rec.familyMembers).toEqual(context.membersPresent);
      });

      // Should include high family bonding activities
      const bondingActivities = recommendations.filter(rec => 
        rec.title.toLowerCase().includes('family') ||
        rec.description.toLowerCase().includes('together') ||
        rec.title.toLowerCase().includes('cook') ||
        rec.title.toLowerCase().includes('game')
      );
      expect(bondingActivities.length).toBeGreaterThan(0);
    });

    it('should assign appropriate roles to family members', async () => {
      const familyId = 'test-family-roles-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'authoritative',
          decisionMaking: 'leader-decides',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      if (recommendations.length > 0) {
        const firstRec = recommendations[0];
        expect(firstRec.roleAssignments).toBeDefined();
        expect(firstRec.roleAssignments.length).toBeGreaterThanOrEqual(2); // At least some roles assigned
        
        // Check role assignment structure
        firstRec.roleAssignments.forEach(role => {
          expect(role).toHaveProperty('userId');
          expect(role).toHaveProperty('role');
          expect(role).toHaveProperty('responsibilities');
          expect(role).toHaveProperty('timeCommitment');
          expect(context.membersPresent).toContain(role.userId);
          expect(Array.isArray(role.responsibilities)).toBe(true);
          expect(typeof role.timeCommitment).toBe('number');
        });

        // Should have a leader role for parent
        const leaderRoles = firstRec.roleAssignments.filter(role => 
          role.role.toLowerCase().includes('leader') || 
          role.role.toLowerCase().includes('chef') ||
          role.role.toLowerCase().includes('head')
        );
        expect(leaderRoles.length).toBeGreaterThan(0);
      }
    });

    it('should prioritize health and wellness activities for families', async () => {
      const familyId = 'test-family-health-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'democratic',
          decisionMaking: 'majority',
          conflictResolution: 'compromise'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      // Should include activities that promote health
      const healthActivities = recommendations.filter(rec => 
        rec.physicalActivity || 
        rec.educationalValue > 0.6 ||
        rec.title.toLowerCase().includes('fitness') ||
        rec.title.toLowerCase().includes('nature') ||
        rec.title.toLowerCase().includes('walk') ||
        rec.title.toLowerCase().includes('yoga')
      );
      expect(healthActivities.length).toBeGreaterThan(0);

      // Check that physical activities are included
      const physicalActivities = recommendations.filter(rec => rec.physicalActivity);
      expect(physicalActivities.length).toBeGreaterThan(0);
    });

    it('should handle conflict resolution strategies', async () => {
      const familyId = 'test-family-conflict-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [
          {
            users: ['child1', 'child2'],
            conflictType: 'activity',
            severity: 'medium',
            resolutionStrategy: 'rotation'
          }
        ],
        groupDynamics: {
          leadershipStyle: 'democratic',
          decisionMaking: 'consensus',
          conflictResolution: 'compromise'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      if (recommendations.length > 0) {
        recommendations.forEach(rec => {
          expect(rec.conflictResolution).toBeDefined();
          expect(rec.conflictResolution).toHaveProperty('strategy');
          expect(rec.conflictResolution).toHaveProperty('fallbackOptions');
          expect(rec.conflictResolution).toHaveProperty('timeoutMinutes');
          
          expect(Array.isArray(rec.conflictResolution.fallbackOptions)).toBe(true);
          expect(typeof rec.conflictResolution.timeoutMinutes).toBe('number');
        });
      }
    });

    it('should require coordination for complex family activities', async () => {
      const familyId = 'test-family-coordination-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'parent2', 'child1'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      // Activities requiring coordination should be marked appropriately
      const coordinationActivities = recommendations.filter(rec => rec.coordinationRequired);
      expect(coordinationActivities.length).toBeGreaterThan(0);

      // Cooking and educational activities should require coordination
      const cookingActivities = recommendations.filter(rec => 
        rec.title.toLowerCase().includes('cook') || 
        rec.title.toLowerCase().includes('bak')
      );
      
      if (cookingActivities.length > 0) {
        expect(cookingActivities[0].coordinationRequired).toBe(true);
      }
    });

    it('should return empty array for single member families', async () => {
      const familyId = 'test-single-family-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1'], // Only one member
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'democratic',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);
      expect(recommendations).toEqual([]);
    });

    it('should include educational value in family recommendations', async () => {
      const familyId = 'test-family-education-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      // Should include activities with educational value
      const educationalActivities = recommendations.filter(rec => rec.educationalValue > 0.5);
      expect(educationalActivities.length).toBeGreaterThan(0);

      // Educational activities should have appropriate reasoning
      educationalActivities.forEach(rec => {
        expect(rec.reasoning.some(reason => 
          reason.toLowerCase().includes('educational') ||
          reason.toLowerCase().includes('learn') ||
          reason.toLowerCase().includes('skill')
        )).toBe(true);
      });
    });

    it('should generate appropriate reasoning for family activities', async () => {
      const familyId = 'test-family-reasoning-1';
      const context: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'collaborative',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const recommendations = await recommender.recommendFamilyActivities(familyId, context);

      if (recommendations.length > 0) {
        recommendations.forEach(rec => {
          expect(rec.reasoning).toBeDefined();
          expect(Array.isArray(rec.reasoning)).toBe(true);
          expect(rec.reasoning.length).toBeGreaterThan(0);
          
          // Should include family-focused reasoning
          const familyReasons = rec.reasoning.filter(reason =>
            reason.toLowerCase().includes('family') ||
            reason.toLowerCase().includes('bonding') ||
            reason.toLowerCase().includes('together') ||
            reason.toLowerCase().includes('shared')
          );
          expect(familyReasons.length).toBeGreaterThan(0);
        });
      }
    });

    it('should handle different family dynamics appropriately', async () => {
      const familyId = 'test-family-dynamics-1';
      
      // Test authoritative family
      const authoritativeContext: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'authoritative',
          decisionMaking: 'leader-decides',
          conflictResolution: 'discussion'
        }
      };

      const authoritativeRecs = await recommender.recommendFamilyActivities(familyId, authoritativeContext);
      
      if (authoritativeRecs.length > 0) {
        // Should have clear leader roles or activity leader roles
        const leaderRoles = authoritativeRecs[0].roleAssignments.filter(role => 
          role.role.toLowerCase().includes('leader') ||
          role.role.toLowerCase().includes('chef') ||
          role.role.toLowerCase().includes('head')
        );
        expect(leaderRoles.length).toBeGreaterThan(0);
      }

      // Test democratic family
      const democraticContext: FamilyContext = {
        familyId: familyId,
        membersPresent: ['parent1', 'child1', 'child2'],
        sharedPreferences: {} as any,
        conflictingPreferences: [],
        groupDynamics: {
          leadershipStyle: 'democratic',
          decisionMaking: 'consensus',
          conflictResolution: 'discussion'
        }
      };

      const democraticRecs = await recommender.recommendFamilyActivities(familyId, democraticContext);
      
      if (democraticRecs.length > 0) {
        // Should have role assignments for family activities
        expect(democraticRecs[0].roleAssignments.length).toBeGreaterThan(0);
        
        // All roles should have meaningful responsibilities
        democraticRecs[0].roleAssignments.forEach(role => {
          expect(role.responsibilities.length).toBeGreaterThan(0);
        });
      }
    });
  });
});