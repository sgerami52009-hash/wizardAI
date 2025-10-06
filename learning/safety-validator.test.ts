// Safety Validator Tests

import { SafetyValidatorImpl } from './safety-validator';
import {
  LearningContent,
  LearningAdaptation,
  ContentType,
  ContentSource,
  SafetyLevel,
  AdaptationType,
  SafetyViolationType,
  ViolationSeverity,
  BehaviorChangeLevel,
  PersonalityAdjustmentLevel,
  ResponseModificationLevel,
  LearningScope,
  ReversibilityLevel,
  ChangeType,
  ChangeImpact
} from './safety-types';
import { AgeGroup } from './types';
import { RiskLevel } from '../privacy/types';

describe('SafetyValidator', () => {
  let safetyValidator: SafetyValidatorImpl;

  beforeEach(() => {
    safetyValidator = new SafetyValidatorImpl();
  });

  describe('validateLearningContent', () => {
    it('should approve safe content for children', async () => {
      const content: LearningContent = {
        contentId: 'test-content-1',
        type: ContentType.CONVERSATION,
        source: ContentSource.VOICE_INTERACTION,
        text: 'Hello, how are you today?',
        context: {
          source: ContentSource.VOICE_INTERACTION,
          timestamp: new Date(),
          userAge: 8,
          parentalControlsActive: true,
          supervisionLevel: 'moderate' as any
        },
        targetAgeGroup: AgeGroup.CHILD,
        safetyLevel: SafetyLevel.SAFE
      };

      const result = await safetyValidator.validateLearningContent(content, 'child-user-1');

      expect(result.isApproved).toBe(true);
      expect(result.safetyLevel).toBe(SafetyLevel.SAFE);
      expect(result.violations).toHaveLength(0);
      expect(result.requiresParentalApproval).toBe(false);
    });

    it('should reject inappropriate content for children', async () => {
      const content: LearningContent = {
        contentId: 'test-content-2',
        type: ContentType.CONVERSATION,
        source: ContentSource.VOICE_INTERACTION,
        text: 'That was damn stupid!',
        context: {
          source: ContentSource.VOICE_INTERACTION,
          timestamp: new Date(),
          userAge: 8,
          parentalControlsActive: true,
          supervisionLevel: 'moderate' as any
        },
        targetAgeGroup: AgeGroup.CHILD,
        safetyLevel: SafetyLevel.SAFE
      };

      const result = await safetyValidator.validateLearningContent(content, 'child-user-1');

      expect(result.isApproved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe(SafetyViolationType.INAPPROPRIATE_CONTENT);
      expect(result.requiresParentalApproval).toBe(true);
    });

    it('should reject blocked content types for toddlers', async () => {
      const content: LearningContent = {
        contentId: 'test-content-3',
        type: ContentType.BEHAVIORAL_PATTERN,
        source: ContentSource.LEARNING_ENGINE,
        context: {
          source: ContentSource.LEARNING_ENGINE,
          timestamp: new Date(),
          userAge: 3,
          parentalControlsActive: true,
          supervisionLevel: 'constant' as any
        },
        targetAgeGroup: AgeGroup.TODDLER,
        safetyLevel: SafetyLevel.SAFE
      };

      const result = await safetyValidator.validateLearningContent(content, 'toddler-user-1');

      expect(result.isApproved).toBe(false);
      expect(result.violations[0].type).toBe(SafetyViolationType.AGE_INAPPROPRIATE);
      expect(result.requiresParentalApproval).toBe(true);
    });

    it('should validate safety level requirements', async () => {
      const content: LearningContent = {
        contentId: 'test-content-4',
        type: ContentType.INTERACTION,
        source: ContentSource.UI_INTERACTION,
        context: {
          source: ContentSource.UI_INTERACTION,
          timestamp: new Date(),
          userAge: 8,
          parentalControlsActive: true,
          supervisionLevel: 'moderate' as any
        },
        targetAgeGroup: AgeGroup.CHILD,
        safetyLevel: SafetyLevel.WARNING // Below required SAFE level for children
      };

      const result = await safetyValidator.validateLearningContent(content, 'child-user-1');

      expect(result.isApproved).toBe(false);
      expect(result.violations.some(v => v.type === SafetyViolationType.INAPPROPRIATE_CONTENT)).toBe(true);
    });
  });

  describe('validateLearningAdaptation', () => {
    it('should approve safe adaptations for children', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-1',
        userId: 'child-user-1',
        type: AdaptationType.RESPONSE_STYLE,
        description: 'Adjust response to be more encouraging',
        impact: {
          behaviorChange: BehaviorChangeLevel.MINIMAL,
          personalityAdjustment: PersonalityAdjustmentLevel.SUBTLE,
          responseModification: ResponseModificationLevel.MINOR,
          learningScope: LearningScope.SESSION_BASED,
          reversibility: ReversibilityLevel.FULLY_REVERSIBLE
        },
        confidence: 0.9,
        proposedChanges: [{
          changeType: ChangeType.RESPONSE_PATTERN,
          description: 'Use more positive language',
          beforeValue: 'neutral tone',
          afterValue: 'encouraging tone',
          confidence: 0.9,
          impact: ChangeImpact.LOW
        }],
        riskAssessment: {
          overallRisk: RiskLevel.LOW,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: ['Monitor for negative effects']
        }
      };

      const result = await safetyValidator.validateLearningAdaptation(adaptation, 'child-user-1');

      expect(result.isApproved).toBe(true);
      expect(result.safetyLevel).toBe(SafetyLevel.SAFE);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject high-risk adaptations for children', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-2',
        userId: 'child-user-1',
        type: AdaptationType.PERSONALITY_ADJUSTMENT,
        description: 'Major personality change',
        impact: {
          behaviorChange: BehaviorChangeLevel.MAJOR,
          personalityAdjustment: PersonalityAdjustmentLevel.SUBSTANTIAL,
          responseModification: ResponseModificationLevel.EXTENSIVE,
          learningScope: LearningScope.LONG_TERM_BEHAVIOR,
          reversibility: ReversibilityLevel.PARTIALLY_REVERSIBLE
        },
        confidence: 0.6,
        proposedChanges: [{
          changeType: ChangeType.BEHAVIOR_MODIFICATION,
          description: 'Change core personality traits',
          beforeValue: 'current personality',
          afterValue: 'modified personality',
          confidence: 0.6,
          impact: ChangeImpact.CRITICAL
        }],
        riskAssessment: {
          overallRisk: RiskLevel.HIGH,
          privacyRisk: RiskLevel.MEDIUM,
          safetyRisk: RiskLevel.HIGH,
          developmentalRisk: RiskLevel.HIGH,
          mitigationStrategies: ['Require parental approval', 'Monitor closely']
        }
      };

      const result = await safetyValidator.validateLearningAdaptation(adaptation, 'child-user-1');

      expect(result.isApproved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.type === SafetyViolationType.BEHAVIORAL_CONCERN)).toBe(true);
      expect(result.requiresParentalApproval).toBe(true);
    });

    it('should reject low-confidence adaptations for toddlers', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-3',
        userId: 'toddler-user-1',
        type: AdaptationType.RESPONSE_STYLE,
        description: 'Uncertain adaptation',
        impact: {
          behaviorChange: BehaviorChangeLevel.MINIMAL,
          personalityAdjustment: PersonalityAdjustmentLevel.NONE,
          responseModification: ResponseModificationLevel.MINOR,
          learningScope: LearningScope.SINGLE_INTERACTION,
          reversibility: ReversibilityLevel.FULLY_REVERSIBLE
        },
        confidence: 0.5, // Below 0.95 threshold for toddlers
        proposedChanges: [],
        riskAssessment: {
          overallRisk: RiskLevel.LOW,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: []
        }
      };

      const result = await safetyValidator.validateLearningAdaptation(adaptation, 'toddler-user-1');

      expect(result.isApproved).toBe(false);
      expect(result.violations.some(v => v.description.includes('confidence'))).toBe(true);
    });
  });

  describe('requiresParentalApproval', () => {
    it('should not require approval for adults', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-4',
        userId: 'adult-user-1',
        type: AdaptationType.PERSONALITY_ADJUSTMENT,
        description: 'Adult adaptation',
        impact: {
          behaviorChange: BehaviorChangeLevel.MODERATE,
          personalityAdjustment: PersonalityAdjustmentLevel.NOTICEABLE,
          responseModification: ResponseModificationLevel.MODERATE,
          learningScope: LearningScope.DAILY_PATTERN,
          reversibility: ReversibilityLevel.MOSTLY_REVERSIBLE
        },
        confidence: 0.8,
        proposedChanges: [],
        riskAssessment: {
          overallRisk: RiskLevel.MEDIUM,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: []
        }
      };

      // Mock adult user profile
      const originalGetUserProfile = (safetyValidator as any).getUserProfile;
      (safetyValidator as any).getUserProfile = async () => ({
        userId: 'adult-user-1',
        ageGroup: AgeGroup.ADULT,
        parentalControlsEnabled: false,
        supervisionLevel: 'none'
      });

      const requiresApproval = await safetyValidator.requiresParentalApproval(adaptation, 'adult-user-1');

      expect(requiresApproval).toBe(false);

      // Restore original method
      (safetyValidator as any).getUserProfile = originalGetUserProfile;
    });

    it('should require approval for high-risk child adaptations', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-5',
        userId: 'child-user-1',
        type: AdaptationType.PERSONALITY_ADJUSTMENT,
        description: 'High-risk child adaptation',
        impact: {
          behaviorChange: BehaviorChangeLevel.SIGNIFICANT,
          personalityAdjustment: PersonalityAdjustmentLevel.SUBSTANTIAL,
          responseModification: ResponseModificationLevel.EXTENSIVE,
          learningScope: LearningScope.LONG_TERM_BEHAVIOR,
          reversibility: ReversibilityLevel.PARTIALLY_REVERSIBLE
        },
        confidence: 0.9,
        proposedChanges: [],
        riskAssessment: {
          overallRisk: RiskLevel.HIGH,
          privacyRisk: RiskLevel.MEDIUM,
          safetyRisk: RiskLevel.HIGH,
          developmentalRisk: RiskLevel.HIGH,
          mitigationStrategies: ['Parental approval required']
        }
      };

      const requiresApproval = await safetyValidator.requiresParentalApproval(adaptation, 'child-user-1');

      expect(requiresApproval).toBe(true);
    });

    it('should require approval for low-confidence adaptations', async () => {
      const adaptation: LearningAdaptation = {
        adaptationId: 'test-adaptation-6',
        userId: 'child-user-1',
        type: AdaptationType.RESPONSE_STYLE,
        description: 'Low-confidence adaptation',
        impact: {
          behaviorChange: BehaviorChangeLevel.MINIMAL,
          personalityAdjustment: PersonalityAdjustmentLevel.NONE,
          responseModification: ResponseModificationLevel.MINOR,
          learningScope: LearningScope.SESSION_BASED,
          reversibility: ReversibilityLevel.FULLY_REVERSIBLE
        },
        confidence: 0.5, // Below threshold
        proposedChanges: [],
        riskAssessment: {
          overallRisk: RiskLevel.LOW,
          privacyRisk: RiskLevel.LOW,
          safetyRisk: RiskLevel.LOW,
          developmentalRisk: RiskLevel.LOW,
          mitigationStrategies: []
        }
      };

      const requiresApproval = await safetyValidator.requiresParentalApproval(adaptation, 'child-user-1');

      expect(requiresApproval).toBe(true);
    });
  });

  describe('validateChildSafeContent', () => {
    it('should approve safe content', async () => {
      const content = 'Hello! How can I help you today?';
      
      const result = await safetyValidator.validateChildSafeContent(content);

      expect(result.isSafe).toBe(true);
      expect(result.safetyScore).toBeGreaterThan(0.8);
      expect(result.detectedIssues).toHaveLength(0);
      expect(result.ageAppropriate.isAppropriate).toBe(true);
    });

    it('should detect inappropriate language', async () => {
      const content = 'That was damn stupid!';
      
      const result = await safetyValidator.validateChildSafeContent(content);

      expect(result.isSafe).toBe(false);
      expect(result.safetyScore).toBeLessThan(0.8);
      expect(result.detectedIssues.length).toBeGreaterThan(0);
      expect(result.detectedIssues[0].issueType).toBe('inappropriate_language');
    });

    it('should detect adult themes', async () => {
      const content = 'This contains violence and adult content';
      
      const result = await safetyValidator.validateChildSafeContent(content);

      expect(result.isSafe).toBe(false);
      expect(result.detectedIssues.some(issue => issue.issueType === 'adult_themes')).toBe(true);
      expect(result.ageAppropriate.isAppropriate).toBe(false);
      expect(result.ageAppropriate.recommendedMinAge).toBeGreaterThan(12);
    });

    it('should provide age-appropriate recommendations', async () => {
      const content = 'That was damn stupid!';
      
      const result = await safetyValidator.validateChildSafeContent(content);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.ageAppropriate.alternatives).toBeDefined();
    });
  });

  describe('generateSafetyAuditLog', () => {
    it('should generate comprehensive audit log', async () => {
      // First, log some safety decisions
      const decision1 = {
        decisionId: 'decision-1',
        userId: 'test-user',
        timestamp: new Date(),
        decisionType: 'content_validation' as any,
        content: {} as any,
        result: {
          isApproved: true,
          safetyLevel: SafetyLevel.SAFE,
          violations: [],
          recommendations: [],
          requiresParentalApproval: false,
          auditTrail: []
        },
        parentalApprovalRequired: false
      };

      const decision2 = {
        decisionId: 'decision-2',
        userId: 'test-user',
        timestamp: new Date(),
        decisionType: 'adaptation_approval' as any,
        content: {} as any,
        result: {
          isApproved: false,
          safetyLevel: SafetyLevel.WARNING,
          violations: [{
            violationId: 'violation-1',
            type: SafetyViolationType.INAPPROPRIATE_CONTENT,
            severity: ViolationSeverity.HIGH,
            description: 'Test violation',
            detectedContent: 'test',
            ageGroup: AgeGroup.CHILD,
            recommendedAction: 'Block content',
            timestamp: new Date()
          }],
          recommendations: [],
          requiresParentalApproval: true,
          auditTrail: []
        },
        parentalApprovalRequired: true,
        parentalApprovalReceived: false
      };

      await safetyValidator.logSafetyDecision(decision1);
      await safetyValidator.logSafetyDecision(decision2);

      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };

      const auditLog = await safetyValidator.generateSafetyAuditLog('test-user', timeRange);

      expect(auditLog.userId).toBe('test-user');
      expect(auditLog.totalDecisions).toBe(2);
      expect(auditLog.approvedDecisions).toBe(1);
      expect(auditLog.rejectedDecisions).toBe(1);
      expect(auditLog.parentalApprovalsRequired).toBe(1);
      expect(auditLog.parentalApprovalsReceived).toBe(0);
      expect(auditLog.safetyViolations).toHaveLength(1);
      expect(auditLog.decisions).toHaveLength(2);
    });
  });
});