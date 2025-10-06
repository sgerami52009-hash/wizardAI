/**
 * Child Safety and Compliance Tests for Personalized Recommendations Engine
 * 
 * Tests age-appropriate recommendation filtering across all categories,
 * validates educational recommendation safety and quality, and tests
 * parental control authorization and oversight mechanisms.
 * 
 * Requirements: 1.3, 3.2, 3.6
 */

import { RecommendationController } from './controller';
import { ActivityRecommender } from './engines/activity-recommender';
import { EducationalRecommender } from './engines/educational-recommender';
import { ParentalControlManager } from './engines/parental-control-manager';
import { ScheduleOptimizer } from './engines/schedule-optimizer';
import { HouseholdEfficiencyEngine } from './engines/household-efficiency-engine';
import {
  UserContext,
  ActivityContext,
  LearningContext,
  EducationalContent,
  ParentalPreferences,
  UserPreferences,
  AgeRange,
  TimeRange,
  LearningResults
} from './types';
import {
  RecommendationType,
  Subject,
  SkillLevel,
  ActivityCategory,
  DifficultyLevel,
  SafetyLevel,
  InteractivityLevel,
  EngagementLevel
} from './enums';

describe('Child Safety and Compliance Tests', () => {
  let recommendationController: RecommendationController;
  let activityRecommender: ActivityRecommender;
  let educationalRecommender: EducationalRecommender;
  let parentalControlManager: ParentalControlManager;
  let scheduleOptimizer: ScheduleOptimizer;
  let householdEfficiencyEngine: HouseholdEfficiencyEngine;

  beforeEach(() => {
    recommendationController = new RecommendationController(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );
    activityRecommender = new ActivityRecommender();
    educationalRecommender = new EducationalRecommender();
    parentalControlManager = new ParentalControlManager();
    scheduleOptimizer = new ScheduleOptimizer();
    householdEfficiencyEngine = new HouseholdEfficiencyEngine();
  });

  describe('Age-Appropriate Recommendation Filtering', () => {
    describe('Activity Recommendations', () => {
      it('should filter activities by age appropriateness for young children (5-7)', async () => {
        const childContext: ActivityContext = {
          currentActivity: 'free_time',
          estimatedEndTime: new Date(Date.now() + 60 * 60 * 1000),
          interruptible: true
        };

        const recommendations = await activityRecommender.recommendActivities('child_5_years', childContext);

        // All recommendations should be age-appropriate for 5-year-old
        recommendations.forEach(rec => {
          expect(rec.ageAppropriate).toBe(true);
          expect(rec.difficulty).toBeOneOf([DifficultyLevel.EASY, DifficultyLevel.BEGINNER]);
          expect(rec.duration.end.getTime() - rec.duration.start.getTime()).toBeLessThanOrEqual(30 * 60 * 1000);
        });

        // Should not contain activities requiring advanced skills
        const titles = recommendations.map(r => r.title.toLowerCase());
        expect(titles).not.toContain(expect.stringMatching(/advanced|complex|difficult/));
      });

      it('should filter activities by age appropriateness for teenagers (14-17)', async () => {
        const teenContext: ActivityContext = {
          currentActivity: 'homework',
          estimatedEndTime: new Date(Date.now() + 30 * 60 * 1000),
          interruptible: false
        };

        const recommendations = await activityRecommender.recommendActivities('teen_15_years', teenContext);

        // All recommendations should be age-appropriate for 15-year-old
        recommendations.forEach(rec => {
          expect(rec.ageAppropriate).toBe(true);
          expect(rec.difficulty).toBeOneOf([
            DifficultyLevel.INTERMEDIATE, 
            DifficultyLevel.ADVANCED, 
            DifficultyLevel.EXPERT
          ]);
        });

        // Should not contain overly childish activities
        const titles = recommendations.map(r => r.title.toLowerCase());
        expect(titles).not.toContain(expect.stringMatching(/baby|toddler|simple/));
      });

      it('should block inappropriate content for all child age groups', async () => {
        const contexts = [
          { userId: 'child_6_years', age: 6 },
          { userId: 'child_10_years', age: 10 },
          { userId: 'teen_14_years', age: 14 }
        ];

        for (const { userId, age } of contexts) {
          const context: ActivityContext = {
            currentActivity: 'free_time',
            estimatedEndTime: new Date(Date.now() + 60 * 60 * 1000),
            interruptible: true
          };

          const recommendations = await activityRecommender.recommendActivities(userId, context);

          // Should not contain any inappropriate content
          recommendations.forEach(rec => {
            expect(rec.title.toLowerCase()).not.toContain('violence');
            expect(rec.title.toLowerCase()).not.toContain('weapon');
            expect(rec.title.toLowerCase()).not.toContain('adult');
            expect(rec.description.toLowerCase()).not.toContain('dangerous');
            expect(rec.description.toLowerCase()).not.toContain('unsafe');
          });
        }
      });

      it('should validate resource safety for child activities', async () => {
        const childContext: ActivityContext = {
          currentActivity: 'craft_time',
          estimatedEndTime: new Date(Date.now() + 45 * 60 * 1000),
          interruptible: true
        };

        const recommendations = await activityRecommender.recommendActivities('child_8_years', childContext);

        recommendations.forEach(rec => {
          rec.requiredResources.forEach(resource => {
            // Should not require dangerous tools or materials
            expect(resource.name.toLowerCase()).not.toContain('knife');
            expect(resource.name.toLowerCase()).not.toContain('sharp');
            expect(resource.name.toLowerCase()).not.toContain('toxic');
            expect(resource.name.toLowerCase()).not.toContain('chemical');
            expect(resource.name.toLowerCase()).not.toContain('fire');
            expect(resource.name.toLowerCase()).not.toContain('heat');
            
            // Should have safe alternatives when needed
            if (resource.required && resource.name.includes('scissors')) {
              expect(resource.alternatives).toContain('safety scissors');
            }
          });
        });
      });
    });

    describe('Educational Recommendations', () => {
      it('should enforce strict age-appropriateness for educational content', async () => {
        const youngChildContext: LearningContext = {
          childId: 'child_6_years',
          currentSubject: Subject.MATHEMATICS,
          skillLevel: SkillLevel.BELOW_GRADE,
          learningGoals: [{
            id: 'basic_counting',
            description: 'Learn to count to 20',
            subject: Subject.MATHEMATICS,
            skillLevel: SkillLevel.BELOW_GRADE,
            measurable: true,
            timeframe: 7
          }],
          availableTime: {
            start: new Date(),
            end: new Date(Date.now() + 20 * 60 * 1000)
          },
          preferredStyle: {
            primary: 'visual',
            secondary: 'kinesthetic',
            preferences: {
              groupWork: false,
              quietEnvironment: true,
              handsonActivities: true,
              visualAids: true,
              repetition: true
            }
          },
          parentalPreferences: {
            allowedSubjects: [Subject.MATHEMATICS, Subject.ART],
            restrictedTopics: ['violence', 'scary', 'complex'],
            maxDailyScreenTime: 60,
            preferredLearningStyle: {
              primary: 'visual',
              secondary: 'kinesthetic',
              preferences: {
                groupWork: false,
                quietEnvironment: true,
                handsonActivities: true,
                visualAids: true,
                repetition: true
              }
            },
            supervisionRequired: true,
            approvalRequired: true
          }
        };

        const recommendations = await educationalRecommender.recommendEducationalContent('child_6_years', youngChildContext);

        recommendations.forEach(rec => {
          // Age range should be appropriate
          expect(rec.ageRange.min).toBeLessThanOrEqual(6);
          expect(rec.ageRange.max).toBeGreaterThanOrEqual(6);
          
          // Duration should be appropriate for attention span
          expect(rec.estimatedDuration).toBeLessThanOrEqual(20);
          
          // Skill level should not be too advanced
          expect(rec.skillLevel).toBeOneOf([SkillLevel.BELOW_GRADE, SkillLevel.AT_GRADE]);
          
          // Should require parental approval for young children
          expect(rec.parentalApprovalRequired).toBe(true);
          
          // Content should be simple and engaging
          expect(rec.interactivityLevel).toBeOneOf([InteractivityLevel.HIGH, InteractivityLevel.MEDIUM]);
        });
      });

      it('should validate educational content safety ratings', async () => {
        const testContent: EducationalContent = {
          id: 'test_unsafe_content',
          title: 'Unsafe Educational Content',
          description: 'Content with inappropriate safety rating',
          contentType: 'interactive',
          subject: Subject.SCIENCE,
          skillLevel: SkillLevel.AT_GRADE,
          ageRange: { min: 8, max: 12 },
          duration: 30,
          safetyRating: SafetyLevel.BLOCKED,
          educationalValue: {
            cognitiveLoad: 'medium',
            skillsTargeted: ['observation'],
            knowledgeAreas: [Subject.SCIENCE],
            developmentalBenefits: ['curiosity']
          },
          parentalGuidanceRequired: false
        };

        const isValid = await educationalRecommender.validateEducationalContent(testContent);
        expect(isValid).toBe(false);

        // Test with safe content
        const safeContent: EducationalContent = {
          ...testContent,
          id: 'test_safe_content',
          title: 'Safe Educational Content',
          safetyRating: SafetyLevel.SAFE
        };

        const isSafeValid = await educationalRecommender.validateEducationalContent(safeContent);
        expect(isSafeValid).toBe(true);
      });

      it('should block educational content with restricted topics', async () => {
        const restrictiveContext: LearningContext = {
          childId: 'child_8_years',
          currentSubject: Subject.SCIENCE,
          skillLevel: SkillLevel.AT_GRADE,
          learningGoals: [],
          availableTime: {
            start: new Date(),
            end: new Date(Date.now() + 30 * 60 * 1000)
          },
          preferredStyle: {
            primary: 'visual',
            secondary: 'auditory',
            preferences: {
              groupWork: true,
              quietEnvironment: false,
              handsonActivities: true,
              visualAids: true,
              repetition: false
            }
          },
          parentalPreferences: {
            allowedSubjects: [Subject.SCIENCE],
            restrictedTopics: ['violence', 'death', 'scary', 'dangerous'],
            maxDailyScreenTime: 60,
            preferredLearningStyle: {
              primary: 'visual',
              secondary: 'auditory',
              preferences: {
                groupWork: true,
                quietEnvironment: false,
                handsonActivities: true,
                visualAids: true,
                repetition: false
              }
            },
            supervisionRequired: false,
            approvalRequired: true
          }
        };

        const recommendations = await educationalRecommender.recommendEducationalContent('child_8_years', restrictiveContext);

        recommendations.forEach(rec => {
          const contentText = (rec.title + ' ' + rec.description).toLowerCase();
          
          // Should not contain restricted topics
          expect(contentText).not.toContain('violence');
          expect(contentText).not.toContain('death');
          expect(contentText).not.toContain('scary');
          expect(contentText).not.toContain('dangerous');
          expect(contentText).not.toContain('weapon');
          expect(contentText).not.toContain('fight');
        });
      });
    });

    describe('Schedule Recommendations', () => {
      it('should respect child bedtime and school hours in schedule optimization', async () => {
        const childUserId = 'child_10_years';
        const timeRange = {
          start: new Date('2024-01-15T06:00:00'),
          end: new Date('2024-01-15T22:00:00')
        };

        const optimizations = await scheduleOptimizer.optimizeSchedule(childUserId, timeRange);

        optimizations.forEach(opt => {
          // Should not suggest activities during typical school hours (8 AM - 3 PM on weekdays)
          const description = opt.description.toLowerCase();
          if (description.includes('school day')) {
            expect(opt.implementation.some(step => 
              step.description.includes('8:00') || 
              step.description.includes('15:00')
            )).toBe(false);
          }
          
          // Should not suggest activities past appropriate bedtime (9 PM for 10-year-old)
          expect(opt.implementation.every(step => 
            !step.description.includes('21:') && 
            !step.description.includes('22:') &&
            !step.description.includes('23:')
          )).toBe(true);
        });
      });

      it('should limit activity duration based on child age', async () => {
        const contexts = [
          { userId: 'child_6_years', maxDuration: 30 },
          { userId: 'child_10_years', maxDuration: 45 },
          { userId: 'teen_14_years', maxDuration: 90 }
        ];

        for (const { userId, maxDuration } of contexts) {
          const timeRange = {
            start: new Date(),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000)
          };

          const optimizations = await scheduleOptimizer.optimizeSchedule(userId, timeRange);

          optimizations.forEach(opt => {
            // Check that suggested time blocks don't exceed age-appropriate durations
            opt.implementation.forEach(step => {
              if (step.description.includes('duration')) {
                const durationMatch = step.description.match(/(\d+)\s*min/);
                if (durationMatch) {
                  const suggestedDuration = parseInt(durationMatch[1]);
                  expect(suggestedDuration).toBeLessThanOrEqual(maxDuration);
                }
              }
            });
          });
        }
      });
    });

    describe('Household Efficiency Recommendations', () => {
      it('should only suggest age-appropriate household tasks for children', async () => {
        const familyId = 'family_with_children';
        
        const analysis = await householdEfficiencyEngine.analyzeHouseholdPatterns(familyId);
        const taskOptimizations = await householdEfficiencyEngine.recommendTaskOptimizations(familyId);

        taskOptimizations.forEach(opt => {
          const taskDescription = opt.description.toLowerCase();
          
          // Should not suggest dangerous tasks for children
          expect(taskDescription).not.toContain('knife');
          expect(taskDescription).not.toContain('stove');
          expect(taskDescription).not.toContain('oven');
          expect(taskDescription).not.toContain('chemical');
          expect(taskDescription).not.toContain('cleaning product');
          expect(taskDescription).not.toContain('ladder');
          expect(taskDescription).not.toContain('heavy lifting');
          
          // Should suggest supervision for appropriate tasks
          if (taskDescription.includes('child') || taskDescription.includes('kid')) {
            expect(opt.description).toContain('supervision');
          }
        });
      });
    });
  });

  describe('Educational Recommendation Safety and Quality', () => {
    it('should validate educational value and learning objectives', async () => {
      const learningContext: LearningContext = {
        childId: 'child_9_years',
        currentSubject: Subject.MATHEMATICS,
        skillLevel: SkillLevel.AT_GRADE,
        learningGoals: [{
          id: 'multiplication_basics',
          description: 'Learn multiplication tables 1-10',
          subject: Subject.MATHEMATICS,
          skillLevel: SkillLevel.AT_GRADE,
          measurable: true,
          timeframe: 14
        }],
        availableTime: {
          start: new Date(),
          end: new Date(Date.now() + 30 * 60 * 1000)
        },
        preferredStyle: {
          primary: 'kinesthetic',
          secondary: 'visual',
          preferences: {
            groupWork: false,
            quietEnvironment: true,
            handsonActivities: true,
            visualAids: true,
            repetition: true
          }
        },
        parentalPreferences: {
          allowedSubjects: [Subject.MATHEMATICS, Subject.SCIENCE, Subject.LANGUAGE_ARTS],
          restrictedTopics: [],
          maxDailyScreenTime: 60,
          preferredLearningStyle: {
            primary: 'kinesthetic',
            secondary: 'visual',
            preferences: {
              groupWork: false,
              quietEnvironment: true,
              handsonActivities: true,
              visualAids: true,
              repetition: true
            }
          },
          supervisionRequired: false,
          approvalRequired: true
        }
      };

      const recommendations = await educationalRecommender.recommendEducationalContent('child_9_years', learningContext);

      recommendations.forEach(rec => {
        // Should have clear educational value
        expect(rec.educationalValue).toBeDefined();
        expect(rec.educationalValue.skillsTargeted.length).toBeGreaterThan(0);
        expect(rec.educationalValue.knowledgeAreas).toContain(Subject.MATHEMATICS);
        
        // Should align with learning objectives
        expect(rec.learningObjectives).toBeDefined();
        expect(rec.learningObjectives.length).toBeGreaterThan(0);
        
        // Should have appropriate skill level
        expect(rec.skillLevel).toBe(SkillLevel.AT_GRADE);
        
        // Should have measurable outcomes
        expect(rec.learningObjectives.every(obj => obj.measurable)).toBe(true);
      });
    });

    it('should ensure content accuracy and quality standards', async () => {
      const testContent: EducationalContent = {
        id: 'quality_test_content',
        title: 'High Quality Educational Content',
        description: 'Well-structured learning material with clear objectives',
        contentType: 'interactive',
        subject: Subject.SCIENCE,
        skillLevel: SkillLevel.AT_GRADE,
        ageRange: { min: 8, max: 12 },
        duration: 25,
        safetyRating: SafetyLevel.SAFE,
        educationalValue: {
          cognitiveLoad: 'medium',
          skillsTargeted: ['observation', 'hypothesis_formation', 'data_collection'],
          knowledgeAreas: [Subject.SCIENCE],
          developmentalBenefits: ['scientific_thinking', 'curiosity']
        },
        parentalGuidanceRequired: false
      };

      const isValid = await educationalRecommender.validateEducationalContent(testContent);
      expect(isValid).toBe(true);

      // Test content with poor educational value
      const poorContent: EducationalContent = {
        ...testContent,
        id: 'poor_quality_content',
        educationalValue: {
          cognitiveLoad: 'low',
          skillsTargeted: [],
          knowledgeAreas: [],
          developmentalBenefits: []
        }
      };

      const isPoorValid = await educationalRecommender.validateEducationalContent(poorContent);
      expect(isPoorValid).toBe(false);
    });
  });

  describe('Parental Control Authorization and Oversight', () => {
    it('should require parental approval for sensitive educational content', async () => {
      const sensitiveRecommendation = {
        id: 'sensitive_content_123',
        type: RecommendationType.EDUCATIONAL,
        title: 'Advanced Biology: Human Body Systems',
        description: 'Detailed study of human anatomy and physiology',
        confidence: 0.8,
        reasoning: ['Advanced content for gifted student'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: 'child_12_years',
          contextId: 'learning_biology',
          engineVersion: '1.0.0',
          safetyValidated: true,
          privacyCompliant: true
        },
        subject: Subject.SCIENCE,
        skillLevel: SkillLevel.ABOVE_GRADE,
        learningObjectives: [],
        estimatedDuration: 45,
        interactivityLevel: InteractivityLevel.MEDIUM,
        educationalValue: {
          cognitiveLoad: 'high' as const,
          skillsTargeted: ['anatomy', 'physiology'],
          knowledgeAreas: [Subject.SCIENCE],
          developmentalBenefits: ['scientific_understanding']
        },
        ageRange: { min: 12, max: 16 },
        parentalApprovalRequired: false // Will be determined by system
      };

      const requiresApproval = await educationalRecommender.requiresParentalApproval(sensitiveRecommendation);
      expect(requiresApproval).toBe(true);
    });

    it('should create approval requests for restricted content', async () => {
      const recommendation = {
        id: 'approval_test_content',
        type: RecommendationType.EDUCATIONAL,
        title: 'Advanced Chemistry Experiments',
        description: 'Hands-on chemistry experiments with supervision',
        confidence: 0.9,
        reasoning: ['Matches advanced science interests'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: 'child_13_years',
          contextId: 'science_learning',
          engineVersion: '1.0.0',
          safetyValidated: true,
          privacyCompliant: true
        },
        subject: Subject.SCIENCE,
        skillLevel: SkillLevel.ABOVE_GRADE,
        learningObjectives: [],
        estimatedDuration: 60,
        interactivityLevel: InteractivityLevel.HIGH,
        educationalValue: {
          cognitiveLoad: 'high' as const,
          skillsTargeted: ['chemistry', 'experimentation'],
          knowledgeAreas: [Subject.SCIENCE],
          developmentalBenefits: ['scientific_method']
        },
        ageRange: { min: 13, max: 17 },
        parentalApprovalRequired: true
      };

      const approvalRequest = await parentalControlManager.requestApproval(
        recommendation,
        'child_13_years',
        'parent_of_child_13_years'
      );

      expect(approvalRequest).toBeDefined();
      expect(approvalRequest.childId).toBe('child_13_years');
      expect(approvalRequest.parentId).toBe('parent_of_child_13_years');
      expect(approvalRequest.recommendation.id).toBe('approval_test_content');
      expect(approvalRequest.status).toBe('pending');
    });

    it('should process parental approval decisions correctly', async () => {
      // First create an approval request
      const recommendation = {
        id: 'decision_test_content',
        type: RecommendationType.EDUCATIONAL,
        title: 'Test Educational Content',
        description: 'Content requiring parental approval',
        confidence: 0.8,
        reasoning: ['Test content'],
        actionable: true,
        integrationActions: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          generatedAt: new Date(),
          userId: 'child_10_years',
          contextId: 'test_context',
          engineVersion: '1.0.0',
          safetyValidated: true,
          privacyCompliant: true
        },
        subject: Subject.MATHEMATICS,
        skillLevel: SkillLevel.AT_GRADE,
        learningObjectives: [],
        estimatedDuration: 30,
        interactivityLevel: InteractivityLevel.MEDIUM,
        educationalValue: {
          cognitiveLoad: 'medium' as const,
          skillsTargeted: ['problem_solving'],
          knowledgeAreas: [Subject.MATHEMATICS],
          developmentalBenefits: ['logical_thinking']
        },
        ageRange: { min: 8, max: 12 },
        parentalApprovalRequired: true
      };

      const approvalRequest = await parentalControlManager.requestApproval(
        recommendation,
        'child_10_years',
        'parent_of_child_10_years'
      );

      // Test approval
      await parentalControlManager.processApprovalDecision(
        approvalRequest.id,
        true,
        'Approved for educational value'
      );

      const pendingRequests = await parentalControlManager.getPendingApprovals('parent_of_child_10_years');
      expect(pendingRequests.find(req => req.id === approvalRequest.id)).toBeUndefined();
    });

    it('should enforce parental control settings', async () => {
      const parentId = 'strict_parent';
      const childId = 'supervised_child';

      // Set strict parental controls
      await parentalControlManager.updateParentalSettings(parentId, childId, {
        autoApprovalEnabled: false,
        requireApprovalForNewContent: true,
        requireApprovalForAdvancedContent: true,
        restrictedSubjects: [Subject.SOCIAL_STUDIES],
        allowedSubjects: [Subject.MATHEMATICS, Subject.LANGUAGE_ARTS, Subject.ART],
        maxDailyScreenTime: 60,
        maxSessionDuration: 20,
        contentFilteringLevel: 'strict',
        allowPeerInteraction: false
      });

      const settings = await parentalControlManager.getParentalSettings(parentId, childId);

      expect(settings.autoApprovalEnabled).toBe(false);
      expect(settings.requireApprovalForNewContent).toBe(true);
      expect(settings.restrictedSubjects).toContain(Subject.SOCIAL_STUDIES);
      expect(settings.allowedSubjects).not.toContain(Subject.SOCIAL_STUDIES);
      expect(settings.maxSessionDuration).toBe(20);
      expect(settings.contentFilteringLevel).toBe('strict');
    });

    it('should send appropriate parental notifications', async () => {
      const parentId = 'notification_parent';
      const childId = 'notification_child';

      // Send a test notification
      await parentalControlManager.sendParentalNotification({
        parentId,
        childId,
        type: 'safety_alert',
        title: 'Safety Alert Test',
        message: 'Test safety notification for child activity',
        priority: 'high',
        actionRequired: true
      });

      const notifications = await parentalControlManager.getParentalNotifications(parentId);
      expect(notifications.length).toBeGreaterThan(0);
      
      const testNotification = notifications.find(n => n.title === 'Safety Alert Test');
      expect(testNotification).toBeDefined();
      expect(testNotification!.type).toBe('safety_alert');
      expect(testNotification!.priority).toBe('high');
      expect(testNotification!.actionRequired).toBe(true);
      expect(testNotification!.read).toBe(false);
    });

    it('should track and report child progress to parents', async () => {
      const childId = 'progress_child';
      const parentId = 'progress_parent';

      // Simulate learning results
      const learningResults: LearningResults = {
        activityId: 'math_multiplication',
        childId: 'progress_child',
        timestamp: new Date(),
        completed: true,
        accuracyScore: 0.85,
        engagementLevel: EngagementLevel.HIGH,
        timeSpent: 25,
        struggledWith: ['division'],
        masteredSkills: ['multiplication_tables'],
        feedback: 'Great progress on multiplication!'
      };

      await parentalControlManager.trackChildProgress(childId, learningResults);

      // Generate progress report
      const report = await parentalControlManager.generateProgressReport(
        parentId,
        childId,
        {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      );

      expect(report.childId).toBe(childId);
      expect(report.parentId).toBe(parentId);
      expect(report.totalActivities).toBeGreaterThan(0);
      expect(report.averageAccuracy).toBeGreaterThan(0);
      expect(report.strugglingAreas).toContain('division');
      expect(report.achievements).toContain(expect.stringContaining('multiplication_tables'));
    });
  });

  describe('Cross-Engine Safety Validation', () => {
    it('should maintain safety standards across all recommendation engines', async () => {
      const childUserId = 'safety_test_child';
      const userContext: UserContext = {
        userId: childUserId,
        timestamp: new Date(),
        location: { 
          type: 'home', 
          coordinates: { lat: 0, lng: 0 },
          indoorOutdoor: 'indoor'
        },
        activity: { 
          currentActivity: 'free_time', 
          estimatedEndTime: new Date(Date.now() + 60 * 60 * 1000),
          interruptible: true
        },
        availability: { 
          freeTime: [{
            start: new Date(),
            end: new Date(Date.now() + 2 * 60 * 60 * 1000)
          }],
          busyTime: [],
          flexibleTime: [],
          energyLevel: { level: 'medium', trend: 'stable' }
        },
        mood: { detected: 'happy', confidence: 0.8, source: 'interaction' },
        energy: { level: 'medium', trend: 'stable' },
        social: { 
          familyMembersPresent: ['parent1', childUserId],
          socialSetting: 'family',
          groupActivity: false
        },
        environmental: {
          weather: { 
            condition: 'sunny', 
            temperature: 22,
            humidity: 50,
            windSpeed: 5,
            uvIndex: 3
          },
          timeOfDay: 'afternoon',
          season: 'spring',
          dayOfWeek: 'Saturday',
          isHoliday: false
        },
        preferences: {
          preferredActivities: [ActivityCategory.EDUCATIONAL, ActivityCategory.CREATIVE],
          avoidedActivities: [],
          timePreferences: [
            { timeOfDay: 'morning', preference: 'acceptable' },
            { timeOfDay: 'afternoon', preference: 'preferred' },
            { timeOfDay: 'evening', preference: 'acceptable' }
          ],
          socialPreferences: {
            familyTime: 'high',
            aloneTime: 'medium',
            groupActivities: 'preferred'
          }
        }
      };

      // Test all recommendation types
      const allRecommendations = await recommendationController.getRecommendations(
        childUserId,
        userContext,
        undefined // Get all types
      );

      allRecommendations.forEach(rec => {
        // All recommendations should be safety validated
        expect(rec.metadata.safetyValidated).toBe(true);
        
        // Should not contain inappropriate content
        const content = (rec.title + ' ' + rec.description).toLowerCase();
        expect(content).not.toContain('violence');
        expect(content).not.toContain('weapon');
        expect(content).not.toContain('dangerous');
        expect(content).not.toContain('unsafe');
        expect(content).not.toContain('adult');
        
        // Should have appropriate confidence levels (not suggesting risky content)
        if (rec.confidence < 0.3) {
          expect(rec.reasoning).toContain(expect.stringMatching(/safety|caution|supervision/));
        }
      });
    });

    it('should handle safety violations gracefully', async () => {
      // Test with potentially unsafe context
      const unsafeContext: UserContext = {
        userId: 'child_7_years',
        timestamp: new Date(),
        location: { 
          type: 'unknown', 
          coordinates: { lat: 0, lng: 0 },
          indoorOutdoor: 'outdoor'
        },
        activity: { 
          currentActivity: 'unsupervised', 
          estimatedEndTime: new Date(Date.now() + 30 * 60 * 1000),
          interruptible: true
        },
        availability: { 
          freeTime: [{
            start: new Date(),
            end: new Date(Date.now() + 60 * 60 * 1000)
          }],
          busyTime: [],
          flexibleTime: [],
          energyLevel: { level: 'high', trend: 'increasing' }
        },
        mood: { detected: 'excited', confidence: 0.7, source: 'inferred' },
        energy: { level: 'high', trend: 'increasing' },
        social: { 
          familyMembersPresent: ['child_7_years'], // No adults present
          socialSetting: 'alone',
          groupActivity: false
        },
        environmental: {
          weather: { 
            condition: 'stormy', 
            temperature: 10,
            humidity: 80,
            windSpeed: 25,
            uvIndex: 1
          },
          timeOfDay: 'evening',
          season: 'winter',
          dayOfWeek: 'Monday',
          isHoliday: false
        },
        preferences: {
          preferredActivities: [ActivityCategory.PHYSICAL, ActivityCategory.OUTDOOR],
          avoidedActivities: [],
          timePreferences: [
            { timeOfDay: 'morning', preference: 'avoided' },
            { timeOfDay: 'afternoon', preference: 'acceptable' },
            { timeOfDay: 'evening', preference: 'preferred' }
          ],
          socialPreferences: {
            familyTime: 'low',
            aloneTime: 'high',
            groupActivities: 'avoided'
          }
        }
      };

      const recommendations = await recommendationController.getRecommendations(
        'child_7_years',
        unsafeContext
      );

      // Should provide safe alternatives despite unsafe context
      recommendations.forEach(rec => {
        // Should suggest indoor activities due to stormy weather
        expect(rec.description.toLowerCase()).not.toContain('outdoor');
        
        // Should suggest supervised activities for young child
        if (rec.type === RecommendationType.ACTIVITY) {
          expect(rec.description.toLowerCase()).toContain(expect.stringMatching(/supervision|adult|parent/));
        }
        
        // Should not suggest high-energy activities late in evening for young child
        expect(rec.description.toLowerCase()).not.toContain(expect.stringMatching(/running|jumping|active/));
      });
    });
  });
});

// Helper function for test expectations
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}