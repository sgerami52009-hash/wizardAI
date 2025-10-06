// Parental Control Manager Tests

import { ParentalControlManagerImpl } from './parental-control-manager';
import {
  LearningBoundaries,
  ParentalApprovalRequest,
  BehaviorModification,
  ResetScope,
  ContentType,
  AdaptationType,
  ApprovalUrgency,
  ModificationType,
  LearningRestriction,
  RestrictionType,
  LearningAdaptation,
  BehaviorChangeLevel,
  PersonalityAdjustmentLevel,
  ResponseModificationLevel,
  LearningScope,
  ReversibilityLevel,
  ChangeType,
  ChangeImpact
} from './safety-types';
import { AgeGroup } from './types';
import { PrivacyLevel, RiskLevel } from '../privacy/types';

describe('ParentalControlManager', () => {
  let parentalControlManager: ParentalControlManagerImpl;

  beforeEach(() => {
    parentalControlManager = new ParentalControlManagerImpl();
  });

  describe('configureLearningBoundaries', () => {
    it('should configure appropriate boundaries for a child', async () => {
      const boundaries: LearningBoundaries = {
        childId: 'child-1',
        ageGroup: AgeGroup.CHILD,
        allowedContentTypes: [ContentType.CONVERSATION, ContentType.INTERACTION, ContentType.PREFERENCE],
        blockedTopics: ['violence', 'adult content'],
        maxLearningAdaptations: 3,
        requireApprovalThreshold: 0.85,
        privacyLevel: PrivacyLevel.ENHANCED,
        learningRestrictions: [{
          restrictionType: RestrictionType.TIME_BASED,
          description: 'No learning after 8 PM',
          isActive: true,
          exceptions: ['emergency'],
          effectiveDate: new Date(),
          expirationDate: undefined
        }]
      };

      await expect(parentalControlManager.configureLearningBoundaries('child-1', boundaries))
        .resolves.not.toThrow();
    });

    it('should reject inappropriate boundaries for toddlers', async () => {
      const boundaries: LearningBoundaries = {
        childId: 'toddler-1',
        ageGroup: AgeGroup.TODDLER,
        allowedContentTypes: [ContentType.CONVERSATION],
        blockedTopics: [],
        maxLearningAdaptations: 5, // Too many for toddler
        requireApprovalThreshold: 0.8, // Too low for toddler
        privacyLevel: PrivacyLevel.MAXIMUM,
        learningRestrictions: []
      };

      await expect(parentalControlManager.configureLearningBoundaries('toddler-1', boundaries))
        .rejects.toThrow('Too many learning adaptations allowed for toddler');
    });

    it('should reject low approval threshold for children', async () => {
      const boundaries: LearningBoundaries = {
        childId: 'child-1',
        ageGroup: AgeGroup.CHILD,
        allowedContentTypes: [ContentType.CONVERSATION],
        blockedTopics: [],
        maxLearningAdaptations: 3,
        requireApprovalThreshold: 0.7, // Too low for child
        privacyLevel: PrivacyLevel.ENHANCED,
        learningRestrictions: []
      };

      await expect(parentalControlManager.configureLearningBoundaries('child-1', boundaries))
        .rejects.toThrow('Approval threshold too low for child');
    });
  });

  describe('requestParentalApproval', () => {
    it('should process approval request for high-risk adaptation', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'adaptation-1',
        userId: 'child-1',
        type: AdaptationType.PERSONALITY_ADJUSTMENT,
        description: 'Adjust personality to be more outgoing',
        impact: {
          behaviorChange: BehaviorChangeLevel.SIGNIFICANT,
          personalityAdjustment: PersonalityAdjustmentLevel.SUBSTANTIAL,
          responseModification: ResponseModificationLevel.EXTENSIVE,
          learningScope: LearningScope.LONG_TERM_BEHAVIOR,
          reversibility: ReversibilityLevel.PARTIALLY_REVERSIBLE
        },
        confidence: 0.8,
        proposedChanges: [{
          changeType: ChangeType.BEHAVIOR_MODIFICATION,
          description: 'Increase social interaction patterns',
          beforeValue: 'reserved personality',
          afterValue: 'outgoing personality',
          confidence: 0.8,
          impact: ChangeImpact.HIGH
        }],
        riskAssessment: {
          overallRisk: RiskLevel.HIGH,
          privacyRisk: RiskLevel.MEDIUM,
          safetyRisk: RiskLevel.MEDIUM,
          developmentalRisk: RiskLevel.HIGH,
          mitigationStrategies: ['Monitor behavioral changes', 'Allow reversal if needed']
        }
      };

      const request: ParentalApprovalRequest = {
        requestId: 'request-1',
        childId: 'child-1',
        parentId: 'parent-1',
        timestamp: new Date(),
        adaptation,
        justification: 'Child shows signs of social anxiety, this adaptation may help',
        urgency: ApprovalUrgency.NORMAL,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      const result = await parentalControlManager.requestParentalApproval(request);

      expect(result.requestId).toBe('request-1');
      expect(result.feedback).toBeDefined();
    });

    it('should auto-approve low-risk adaptations for teens', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'adaptation-2',
        userId: 'teen-1',
        type: AdaptationType.RESPONSE_STYLE,
        description: 'Adjust response style to be more casual',
        impact: {
          behaviorChange: BehaviorChangeLevel.MINIMAL,
          personalityAdjustment: PersonalityAdjustmentLevel.SUBTLE,
          responseModification: ResponseModificationLevel.MINOR,
          learningScope: LearningScope.SESSION_BASED,
          reversibility: ReversibilityLevel.FULLY_REVERSIBLE
        },
        confidence: 0.95,
        proposedChanges: [{
          changeType: ChangeType.RESPONSE_PATTERN,
          description: 'Use more casual language',
          beforeValue: 'formal responses',
          afterValue: 'casual responses',
          confidence: 0.95,
          impact: ChangeImpact.LOW
        }],
        riskAssessment: {
          overallRisk: RiskLevel.LOW,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: []
        }
      };

      const request: ParentalApprovalRequest = {
        requestId: 'request-2',
        childId: 'teen-1',
        parentId: 'parent-1',
        timestamp: new Date(),
        adaptation,
        justification: 'Low-risk style adjustment',
        urgency: ApprovalUrgency.LOW,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      // Mock teen profile for auto-approval
      const originalGetChildProfile = (parentalControlManager as any).getChildProfile;
      (parentalControlManager as any).getChildProfile = async () => ({
        id: 'teen-1',
        ageGroup: AgeGroup.TEEN,
        parentalControlsEnabled: true
      });

      const result = await parentalControlManager.requestParentalApproval(request);

      expect(result.approved).toBe(true);
      expect(result.feedback).toContain('Auto-approved');

      // Restore original method
      (parentalControlManager as any).getChildProfile = originalGetChildProfile;
    });

    it('should reject expired approval requests', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'adaptation-3',
        userId: 'child-1',
        type: AdaptationType.CONTENT_PREFERENCE,
        description: 'Test adaptation',
        impact: {
          behaviorChange: BehaviorChangeLevel.MINIMAL,
          personalityAdjustment: PersonalityAdjustmentLevel.NONE,
          responseModification: ResponseModificationLevel.MINOR,
          learningScope: LearningScope.SESSION_BASED,
          reversibility: ReversibilityLevel.FULLY_REVERSIBLE
        },
        confidence: 0.8,
        proposedChanges: [],
        riskAssessment: {
          overallRisk: RiskLevel.LOW,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: []
        }
      };

      const expiredRequest: ParentalApprovalRequest = {
        requestId: 'request-3',
        childId: 'child-1',
        parentId: 'parent-1',
        timestamp: new Date(),
        adaptation,
        justification: 'Test request',
        urgency: ApprovalUrgency.NORMAL,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago (expired)
      };

      await expect(parentalControlManager.requestParentalApproval(expiredRequest))
        .rejects.toThrow('Approval request has expired');
    });
  });

  describe('modifyLearningBehavior', () => {
    it('should apply behavior modification for content filtering', async () => {
      const modification: BehaviorModification = {
        modificationId: 'mod-1',
        type: ModificationType.CONTENT_FILTER,
        targetBehavior: 'inappropriate content exposure',
        newBehavior: 'strict content filtering',
        reason: 'Parent requested stricter content controls',
        effectiveDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      await expect(parentalControlManager.modifyLearningBehavior('child-1', modification))
        .resolves.not.toThrow();
    });

    it('should apply interaction limits for excessive usage', async () => {
      const modification: BehaviorModification = {
        modificationId: 'mod-2',
        type: ModificationType.INTERACTION_LIMIT,
        targetBehavior: 'excessive daily interactions',
        newBehavior: 'limited to 2 hours per day',
        reason: 'Reduce screen time as requested by parent',
        effectiveDate: new Date(),
        expirationDate: undefined // Permanent until changed
      };

      await expect(parentalControlManager.modifyLearningBehavior('teen-1', modification))
        .resolves.not.toThrow();
    });

    it('should reset specific preferences when requested', async () => {
      const modification: BehaviorModification = {
        modificationId: 'mod-3',
        type: ModificationType.PREFERENCE_RESET,
        targetBehavior: 'learned music preferences',
        newBehavior: 'default age-appropriate preferences',
        reason: 'Child developed inappropriate music taste',
        effectiveDate: new Date()
      };

      await expect(parentalControlManager.modifyLearningBehavior('child-1', modification))
        .resolves.not.toThrow();
    });
  });

  describe('resetChildLearning', () => {
    it('should reset all learning data when requested', async () => {
      await expect(parentalControlManager.resetChildLearning('child-1', ResetScope.ALL_LEARNING))
        .resolves.not.toThrow();
    });

    it('should reset only recent adaptations', async () => {
      await expect(parentalControlManager.resetChildLearning('child-1', ResetScope.RECENT_ADAPTATIONS))
        .resolves.not.toThrow();
    });

    it('should reset specific behavior patterns', async () => {
      await expect(parentalControlManager.resetChildLearning('child-1', ResetScope.SPECIFIC_BEHAVIOR))
        .resolves.not.toThrow();
    });

    it('should reset safety violation history', async () => {
      await expect(parentalControlManager.resetChildLearning('child-1', ResetScope.SAFETY_VIOLATIONS))
        .resolves.not.toThrow();
    });
  });

  describe('generatePrivacyReport', () => {
    it('should generate comprehensive family privacy report', async () => {
      const report = await parentalControlManager.generatePrivacyReport('family-1');

      expect(report.familyId).toBe('family-1');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.children).toBeDefined();
      expect(report.children.length).toBeGreaterThan(0);
      expect(report.dataUsage).toBeDefined();
      expect(report.learningActivities).toBeDefined();
      expect(report.safetyMetrics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should include child-specific privacy summaries', async () => {
      const report = await parentalControlManager.generatePrivacyReport('family-1');

      const childSummary = report.children[0];
      expect(childSummary.childId).toBeDefined();
      expect(childSummary.ageGroup).toBeDefined();
      expect(childSummary.dataCollected).toBeDefined();
      expect(childSummary.dataCollected.interactionCount).toBeGreaterThan(0);
      expect(childSummary.learningActivities).toBeGreaterThanOrEqual(0);
      expect(childSummary.parentalApprovals).toBeGreaterThanOrEqual(0);
      expect(childSummary.safetyViolations).toBeGreaterThanOrEqual(0);
      expect(childSummary.privacyLevel).toBeDefined();
    });

    it('should include family safety metrics', async () => {
      const report = await parentalControlManager.generatePrivacyReport('family-1');

      expect(report.safetyMetrics.totalSafetyChecks).toBeGreaterThan(0);
      expect(report.safetyMetrics.averageSafetyScore).toBeGreaterThan(0);
      expect(report.safetyMetrics.averageSafetyScore).toBeLessThanOrEqual(1);
      expect(report.safetyMetrics.complianceRate).toBeGreaterThan(0);
      expect(report.safetyMetrics.complianceRate).toBeLessThanOrEqual(1);
    });
  });

  describe('getLearningOversight', () => {
    it('should provide comprehensive learning oversight for a child', async () => {
      // First configure boundaries
      const boundaries: LearningBoundaries = {
        childId: 'child-1',
        ageGroup: AgeGroup.CHILD,
        allowedContentTypes: [ContentType.CONVERSATION, ContentType.INTERACTION],
        blockedTopics: ['violence'],
        maxLearningAdaptations: 3,
        requireApprovalThreshold: 0.85,
        privacyLevel: PrivacyLevel.ENHANCED,
        learningRestrictions: []
      };

      await parentalControlManager.configureLearningBoundaries('child-1', boundaries);

      const oversight = await parentalControlManager.getLearningOversight('child-1');

      expect(oversight.childId).toBe('child-1');
      expect(oversight.currentBoundaries).toEqual(boundaries);
      expect(oversight.recentAdaptations).toBeDefined();
      expect(oversight.pendingApprovals).toBeDefined();
      expect(oversight.safetyMetrics).toBeDefined();
      expect(oversight.learningProgress).toBeDefined();
    });

    it('should include safety metrics in oversight', async () => {
      const boundaries: LearningBoundaries = {
        childId: 'child-2',
        ageGroup: AgeGroup.CHILD,
        allowedContentTypes: [ContentType.CONVERSATION],
        blockedTopics: [],
        maxLearningAdaptations: 2,
        requireApprovalThreshold: 0.9,
        privacyLevel: PrivacyLevel.MAXIMUM,
        learningRestrictions: []
      };

      await parentalControlManager.configureLearningBoundaries('child-2', boundaries);

      const oversight = await parentalControlManager.getLearningOversight('child-2');

      expect(oversight.safetyMetrics.safetyScore).toBeGreaterThan(0);
      expect(oversight.safetyMetrics.safetyScore).toBeLessThanOrEqual(1);
      expect(oversight.safetyMetrics.riskLevel).toBeDefined();
      expect(oversight.safetyMetrics.complianceRate).toBeGreaterThan(0);
    });

    it('should include learning progress metrics', async () => {
      const boundaries: LearningBoundaries = {
        childId: 'child-3',
        ageGroup: AgeGroup.CHILD,
        allowedContentTypes: [ContentType.CONVERSATION],
        blockedTopics: [],
        maxLearningAdaptations: 3,
        requireApprovalThreshold: 0.85,
        privacyLevel: PrivacyLevel.ENHANCED,
        learningRestrictions: []
      };

      await parentalControlManager.configureLearningBoundaries('child-3', boundaries);

      const oversight = await parentalControlManager.getLearningOversight('child-3');

      expect(oversight.learningProgress.adaptationsApplied).toBeGreaterThanOrEqual(0);
      expect(oversight.learningProgress.adaptationsRejected).toBeGreaterThanOrEqual(0);
      expect(oversight.learningProgress.learningEffectiveness).toBeGreaterThan(0);
      expect(oversight.learningProgress.learningEffectiveness).toBeLessThanOrEqual(1);
      expect(oversight.learningProgress.behaviorImprovements).toBeDefined();
      expect(oversight.learningProgress.parentalFeedback).toBeDefined();
    });

    it('should throw error for child without boundaries', async () => {
      await expect(parentalControlManager.getLearningOversight('unknown-child'))
        .rejects.toThrow('No learning boundaries found for child unknown-child');
    });
  });
});