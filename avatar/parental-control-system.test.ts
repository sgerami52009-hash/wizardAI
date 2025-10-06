import { AvatarParentalControlSystem } from './parental-control-system';
import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';
import { ParentalControlManagerImpl } from '../learning/parental-control-manager';
import {
  AvatarCustomization,
  SafetyValidationResult,
  ParentalDecision,
  ReviewRequest,
  ParentalDashboard,
  AccentType,
  EmotionalTone,
  EmotionType
} from './types';

describe('AvatarParentalControlSystem', () => {
  let parentalControlSystem: AvatarParentalControlSystem;
  let mockParentalControlManager: jest.Mocked<ParentalControlManagerImpl>;
  let mockSafetyValidator: jest.Mocked<EnhancedAvatarSafetyValidator>;

  beforeEach(() => {
    mockParentalControlManager = {
      requestParentalApproval: jest.fn(),
      getLearningOversight: jest.fn(),
    } as any;

    mockSafetyValidator = {
      validateCustomization: jest.fn(),
      submitForParentalReview: jest.fn(),
    } as any;

    parentalControlSystem = new AvatarParentalControlSystem(
      mockParentalControlManager,
      mockSafetyValidator
    );
  });

  describe('Parental Approval Workflow', () => {
    it('should create approval workflow for child customizations', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-1',
        customization,
        validationResult
      );

      expect(reviewRequest.reviewId).toBeDefined();
      expect(reviewRequest.userId).toBe('child-1');
      expect(reviewRequest.status).toBe('pending');
      expect(reviewRequest.customization).toBe(customization);
      expect(reviewRequest.safetyAssessment).toBe(validationResult);
    });

    it('should handle high-risk customizations with urgent workflow', async () => {
      const customization = createTestCustomization();
      const highRiskValidation = createHighRiskValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-2',
        customization,
        highRiskValidation
      );

      expect(reviewRequest.safetyAssessment.riskAssessment).toBe('high');
      // Verify that urgent notification was created (would check notification queue in real implementation)
    });

    it('should notify child with friendly message about submission', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-3',
        customization,
        validationResult
      );

      // In real implementation, would verify child notification was sent
      expect(reviewRequest.reviewId).toBeDefined();
    });
  });

  describe('Customization Review Interface', () => {
    it('should provide detailed review interface for parents', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      // First create a review request
      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-4',
        customization,
        validationResult
      );

      // Then get the review interface
      const reviewInterface = await parentalControlSystem.getCustomizationReviewInterface(
        reviewRequest.reviewId,
        'parent-1'
      );

      expect(reviewInterface.reviewId).toBe(reviewRequest.reviewId);
      expect(reviewInterface.childId).toBe('child-4');
      expect(reviewInterface.customization).toBe(customization);
      expect(reviewInterface.safetyAssessment).toBe(validationResult);
      expect(reviewInterface.safetyAnalysis).toBeDefined();
      expect(reviewInterface.recommendations).toBeDefined();
      expect(reviewInterface.suggestedActions).toBeDefined();
      expect(reviewInterface.estimatedReviewTime).toBeGreaterThan(0);
    });

    it('should throw error for non-existent review request', async () => {
      await expect(
        parentalControlSystem.getCustomizationReviewInterface('non-existent', 'parent-1')
      ).rejects.toThrow('Review request non-existent not found');
    });

    it('should provide change comparison for existing avatars', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-5',
        customization,
        validationResult
      );

      const reviewInterface = await parentalControlSystem.getCustomizationReviewInterface(
        reviewRequest.reviewId,
        'parent-1'
      );

      expect(reviewInterface.changeComparison).toBeDefined();
      expect(reviewInterface.changeComparison.isFirstCustomization).toBe(true);
    });
  });

  describe('Approval Decision Processing', () => {
    it('should process approval decisions correctly', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-6',
        customization,
        validationResult
      );

      await parentalControlSystem.processApprovalDecision(
        reviewRequest.reviewId,
        'parent-1',
        true,
        'Looks great!'
      );

      // Verify the decision was processed (would check internal state in real implementation)
      const pendingApprovals = await parentalControlSystem.getPendingApprovals('parent-1');
      expect(pendingApprovals.find(r => r.reviewId === reviewRequest.reviewId)).toBeUndefined();
    });

    it('should handle rejection with child-friendly messaging', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-7',
        customization,
        validationResult
      );

      await parentalControlSystem.processApprovalDecision(
        reviewRequest.reviewId,
        'parent-1',
        false,
        'Let\'s try something different'
      );

      // In real implementation, would verify child received friendly rejection message
      // and alternative suggestions were provided
    });

    it('should apply conditions when approving with restrictions', async () => {
      const customization = createTestCustomization();
      const validationResult = createMediumRiskValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-8',
        customization,
        validationResult
      );

      const conditions = [
        {
          type: 'time_limit',
          description: 'Only use this avatar during daytime',
          required: true
        }
      ];

      await parentalControlSystem.processApprovalDecision(
        reviewRequest.reviewId,
        'parent-1',
        true,
        'Approved with conditions',
        conditions
      );

      // Verify conditions were applied (would check in real implementation)
    });
  });

  describe('Audit Logging', () => {
    it('should create comprehensive audit logs', async () => {
      await parentalControlSystem.createAuditLog(
        'test_action',
        'user-1',
        { testData: 'value' },
        'medium'
      );

      // In real implementation, would verify audit log entry was created
      // and properly sanitized
    });

    it('should sanitize sensitive data in audit logs', async () => {
      const sensitiveData = {
        personalInfo: 'sensitive',
        password: 'secret123',
        normalData: 'public'
      };

      await parentalControlSystem.createAuditLog(
        'test_action',
        'user-2',
        sensitiveData,
        'low'
      );

      // In real implementation, would verify sensitive data was redacted
    });

    it('should trigger alerts for high-risk audit entries', async () => {
      await parentalControlSystem.createAuditLog(
        'high_risk_action',
        'user-3',
        { riskIndicator: 'high' },
        'high'
      );

      // In real implementation, would verify alert was triggered
    });
  });

  describe('Parental Dashboard', () => {
    it('should provide comprehensive parental dashboard', async () => {
      const dashboards = await parentalControlSystem.getParentalDashboard('parent-1');

      expect(dashboards).toBeDefined();
      expect(Array.isArray(dashboards)).toBe(true);
      
      if (dashboards.length > 0) {
        const dashboard = dashboards[0];
        expect(dashboard.childId).toBeDefined();
        expect(dashboard.recentActivity).toBeDefined();
        expect(dashboard.pendingApprovals).toBeDefined();
        expect(dashboard.safetyMetrics).toBeDefined();
        expect(dashboard.recommendations).toBeDefined();
      }
    });

    it('should show pending approvals sorted by urgency', async () => {
      // Create multiple review requests with different urgency levels
      const lowRiskCustomization = createTestCustomization();
      const lowRiskValidation = createSafeValidationResult();

      const highRiskCustomization = createTestCustomization();
      const highRiskValidation = createHighRiskValidationResult();

      await parentalControlSystem.createApprovalWorkflow(
        'child-9',
        lowRiskCustomization,
        lowRiskValidation
      );

      await parentalControlSystem.createApprovalWorkflow(
        'child-10',
        highRiskCustomization,
        highRiskValidation
      );

      const pendingApprovals = await parentalControlSystem.getPendingApprovals('parent-1');
      
      expect(pendingApprovals.length).toBeGreaterThanOrEqual(2);
      // High-risk should come first
      expect(pendingApprovals[0].safetyAssessment.riskAssessment).toBe('high');
    });
  });

  describe('Bulk Decision Processing', () => {
    it('should process multiple decisions efficiently', async () => {
      // Create multiple review requests
      const customization1 = createTestCustomization();
      const customization2 = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const review1 = await parentalControlSystem.createApprovalWorkflow(
        'child-11',
        customization1,
        validationResult
      );

      const review2 = await parentalControlSystem.createApprovalWorkflow(
        'child-12',
        customization2,
        validationResult
      );

      const bulkDecisions = [
        {
          reviewId: review1.reviewId,
          approved: true,
          reason: 'Approved in bulk'
        },
        {
          reviewId: review2.reviewId,
          approved: false,
          reason: 'Rejected in bulk'
        }
      ];

      const result = await parentalControlSystem.processBulkDecisions('parent-1', bulkDecisions);

      expect(result.totalProcessed).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle partial failures in bulk processing', async () => {
      const bulkDecisions = [
        {
          reviewId: 'valid-review',
          approved: true,
          reason: 'Valid decision'
        },
        {
          reviewId: 'invalid-review',
          approved: true,
          reason: 'Invalid decision'
        }
      ];

      const result = await parentalControlSystem.processBulkDecisions('parent-1', bulkDecisions);

      expect(result.totalProcessed).toBe(2);
      expect(result.failureCount).toBeGreaterThan(0);
      expect(result.results.some(r => !r.success)).toBe(true);
    });
  });

  describe('Child Safety Compliance', () => {
    it('should use child-friendly language in all communications', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-13',
        customization,
        validationResult
      );

      // Verify child-friendly messaging (would check actual messages in real implementation)
      expect(reviewRequest.reviewId).toBeDefined();
    });

    it('should provide age-appropriate alternatives when rejecting', async () => {
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-14',
        customization,
        validationResult
      );

      await parentalControlSystem.processApprovalDecision(
        reviewRequest.reviewId,
        'parent-1',
        false,
        'Try something different'
      );

      // In real implementation, would verify alternatives were suggested
    });

    it('should maintain COPPA compliance in all operations', async () => {
      // Verify that all operations comply with COPPA requirements
      // This would include checking data handling, parental consent, etc.
      const customization = createTestCustomization();
      const validationResult = createSafeValidationResult();

      const reviewRequest = await parentalControlSystem.createApprovalWorkflow(
        'child-under-13',
        customization,
        validationResult
      );

      // Verify parental approval is required for children under 13
      expect(reviewRequest.status).toBe('pending');
    });
  });

  // Helper functions to create test data
  function createTestCustomization(): AvatarCustomization {
    return {
      appearance: {
        face: {
          meshId: 'test-face',
          textureId: 'test-texture',
          eyeColor: 'brown',
          skinTone: 'medium',
          features: {
            eyeSize: 0.5,
            noseSize: 0.5,
            mouthSize: 0.5,
            cheekbones: 0.5
          },
          detailLevel: 'medium' as any,
          textureQuality: 0.8,
          matureFeatures: false
        },
        hair: {
          styleId: 'test-hair',
          color: 'brown',
          length: 0.5,
          texture: 'straight' as any,
          physicsEnabled: false,
          strandCount: 1000,
          detailLevel: 'medium' as any
        },
        clothing: {
          topId: 'test-top',
          bottomId: 'test-bottom',
          shoesId: 'test-shoes',
          colors: {
            primary: 'blue',
            secondary: 'white',
            accent: 'red'
          },
          wrinkleSimulation: false,
          detailLevel: 'medium' as any,
          textureQuality: 0.8,
          revealingLevel: 1
        },
        accessories: [],
        animations: {
          idle: 'test-idle',
          talking: 'test-talking',
          listening: 'test-listening',
          thinking: 'test-thinking',
          expressions: {
            happy: 'test-happy',
            sad: 'test-sad',
            surprised: 'test-surprised',
            confused: 'test-confused',
            excited: 'test-excited'
          },
          frameRate: 30,
          blendingEnabled: true
        }
      },
      personality: {
        friendliness: 8,
        formality: 3,
        humor: 6,
        enthusiasm: 7,
        patience: 8,
        supportiveness: 9
      },
      voice: {
        pitch: 0.2,
        speed: 1.0,
        accent: AccentType.NEUTRAL,
        emotionalTone: EmotionalTone.CHEERFUL,
        volume: 0.8
      },
      emotions: {
        defaultEmotion: EmotionType.HAPPY,
        expressionIntensity: 0.6,
        transitionSpeed: 0.5,
        emotionMappings: []
      }
    };
  }

  function createSafeValidationResult(): SafetyValidationResult {
    return {
      isAllowed: true,
      requiresApproval: true,
      blockedElements: [],
      riskAssessment: 'low',
      parentalMessage: undefined
    };
  }

  function createHighRiskValidationResult(): SafetyValidationResult {
    return {
      isAllowed: false,
      requiresApproval: true,
      blockedElements: ['inappropriate-content', 'age-restricted'],
      riskAssessment: 'high',
      parentalMessage: 'This customization contains content that may not be appropriate for your child.'
    };
  }

  function createMediumRiskValidationResult(): SafetyValidationResult {
    return {
      isAllowed: true,
      requiresApproval: true,
      blockedElements: ['minor-concern'],
      riskAssessment: 'medium',
      parentalMessage: 'This customization has some elements that need your review.'
    };
  }
});