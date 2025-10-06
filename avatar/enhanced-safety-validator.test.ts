import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';
import { 
  AvatarCustomization, 
  AppearanceConfiguration, 
  PersonalityTraits, 
  VoiceCharacteristics, 
  EmotionalConfiguration,
  SafetyValidationResult,
  ParentalDecision,
  TimeRange,
  AccentType,
  EmotionalTone,
  EmotionType
} from './types';
import { ParentalControlManagerImpl } from '../learning/parental-control-manager';

describe('EnhancedAvatarSafetyValidator', () => {
  let validator: EnhancedAvatarSafetyValidator;
  let mockParentalControlManager: jest.Mocked<ParentalControlManagerImpl>;

  beforeEach(() => {
    mockParentalControlManager = {
      getLearningOversight: jest.fn(),
      requestParentalApproval: jest.fn(),
    } as any;

    validator = new EnhancedAvatarSafetyValidator(mockParentalControlManager);
  });

  describe('Multi-stage Content Validation', () => {
    it('should validate safe customization for appropriate age', async () => {
      const safeCustomization = createSafeCustomization();
      const result = await validator.validateCustomization(safeCustomization, 10, 'child-1');

      expect(result.isAllowed).toBe(true);
      expect(result.requiresApproval).toBe(true); // Under 13 always requires approval
      expect(result.blockedElements).toHaveLength(0);
      expect(result.riskAssessment).toBe('low');
    });

    it('should block inappropriate content for young children', async () => {
      const inappropriateCustomization = createInappropriateCustomization();
      const result = await validator.validateCustomization(inappropriateCustomization, 6, 'child-2');

      expect(result.isAllowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.blockedElements.length).toBeGreaterThan(0);
      expect(result.riskAssessment).toBe('high');
      expect(result.parentalMessage).toContain('not be appropriate');
    });

    it('should apply age-based filtering correctly', async () => {
      const customization = createMildlyInappropriateCustomization();
      
      // Should be blocked for toddler
      const toddlerResult = await validator.validateCustomization(customization, 4, 'toddler-1');
      expect(toddlerResult.isAllowed).toBe(false);
      
      // Should be allowed for teen with approval
      const teenResult = await validator.validateCustomization(customization, 16, 'teen-1');
      expect(teenResult.isAllowed).toBe(true);
    });

    it('should handle validation errors gracefully', async () => {
      const invalidCustomization = null as any;
      const result = await validator.validateCustomization(invalidCustomization, 10, 'child-3');

      expect(result.isAllowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.riskAssessment).toBe('high');
      expect(result.blockedElements).toContain('validation_error');
    });
  });

  describe('Age-based Filtering', () => {
    it('should enforce strict restrictions for toddlers', async () => {
      const customization = createCustomizationWithMatureFeatures();
      const result = await validator.performAgeBasedValidation(customization, 3);

      expect(result.violations).toContain('Mature facial features not appropriate for young children');
      expect(result.violations).toContain('Clothing style not appropriate for young children');
      expect(result.riskLevel).toBe('medium');
    });

    it('should allow more flexibility for teens', async () => {
      const customization = createTeenAppropriateCustomization();
      const result = await validator.performAgeBasedValidation(customization, 16);

      expect(result.violations).toHaveLength(0);
      expect(result.isAllowed).toBe(true);
      expect(result.riskLevel).toBe('low');
    });

    it('should validate personality traits for age appropriateness', async () => {
      const customization = createCustomizationWithInappropriatePersonality();
      const result = await validator.performAgeBasedValidation(customization, 7);

      expect(result.violations).toContain('High formality not appropriate for young children');
    });

    it('should validate voice characteristics for age', async () => {
      const customization = createCustomizationWithExtremeVoice();
      const result = await validator.performAgeBasedValidation(customization, 5);

      expect(result.violations).toContain('Extreme voice pitch not appropriate for young children');
      expect(result.violations).toContain('Extreme voice speed not appropriate for young children');
    });
  });

  describe('Risk Assessment', () => {
    it('should assess low risk for safe customizations', async () => {
      const safeCustomization = createSafeCustomization();
      const riskAssessment = await validator.performRiskAssessment(safeCustomization, 10);

      expect(riskAssessment.overallRisk).toBe('low');
      expect(riskAssessment.mitigationRequired).toBe(false);
      expect(riskAssessment.riskFactors).toHaveLength(0);
    });

    it('should assess high risk for inappropriate content', async () => {
      const riskyCustomization = createHighRiskCustomization();
      const riskAssessment = await validator.performRiskAssessment(riskyCustomization, 8);

      expect(riskAssessment.overallRisk).toBe('high');
      expect(riskAssessment.mitigationRequired).toBe(true);
      expect(riskAssessment.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('Parental Control Integration', () => {
    it('should require approval for users under 13', async () => {
      const customization = createSafeCustomization();
      const requiresApproval = await validator.determineParentalApprovalRequirement(
        [], 12, 'child-4', 'low'
      );

      expect(requiresApproval).toBe(true);
    });

    it('should require approval for high-risk content', async () => {
      const requiresApproval = await validator.determineParentalApprovalRequirement(
        [], 16, 'teen-1', 'high'
      );

      expect(requiresApproval).toBe(true);
    });

    it('should submit customization for parental review', async () => {
      const customization = createSafeCustomization();
      const validationResult: SafetyValidationResult = {
        isAllowed: false,
        requiresApproval: true,
        blockedElements: ['test-element'],
        riskAssessment: 'medium',
        parentalMessage: 'Test message'
      };

      mockParentalControlManager.requestParentalApproval.mockResolvedValue({
        requestId: 'test-request',
        approved: false,
        approverUserId: '',
        approvalTimestamp: new Date(),
        feedback: 'Pending review'
      });

      const reviewRequest = await validator.submitForParentalReview(
        customization, 'child-5', validationResult
      );

      expect(reviewRequest.reviewId).toBeDefined();
      expect(reviewRequest.userId).toBe('child-5');
      expect(reviewRequest.status).toBe('pending');
      expect(mockParentalControlManager.requestParentalApproval).toHaveBeenCalled();
    });

    it('should process parental decisions correctly', async () => {
      const decision: ParentalDecision = {
        reviewId: 'test-review',
        parentId: 'parent-1',
        approved: true,
        reason: 'Looks appropriate',
        timestamp: new Date()
      };

      await validator.processParentalDecision('test-review', decision);

      // Verify audit log entry was created
      const auditLog = await validator.getAuditLog('parent-1', {
        start: new Date(Date.now() - 1000),
        end: new Date()
      });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].action).toBe('parental_approval_granted');
      expect(auditLog[0].details.decision).toBe('approved');
    });
  });

  describe('Content Safety Integration', () => {
    it('should integrate with existing content safety systems', async () => {
      const customization = createSafeCustomization();
      const result = await validator.integrateWithContentSafety(customization, 'child-6');

      expect(result.isAllowed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.riskLevel).toBe('low');
    });

    it('should detect unsafe content through integration', async () => {
      const unsafeCustomization = createUnsafeCustomization();
      const result = await validator.integrateWithContentSafety(unsafeCustomization, 'child-7');

      expect(result.isAllowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('Audit Logging and Reporting', () => {
    it('should maintain comprehensive audit logs', async () => {
      const customization = createSafeCustomization();
      await validator.validateCustomization(customization, 10, 'child-8');

      const timeRange: TimeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const auditLog = await validator.getAuditLog('child-8', timeRange);
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].action).toBe('safety_validation_completed');
      expect(auditLog[0].userId).toBe('child-8');
    });

    it('should filter audit logs by user and time range', async () => {
      const timeRange: TimeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02')
      };

      const auditLog = await validator.getAuditLog('nonexistent-user', timeRange);
      expect(auditLog).toHaveLength(0);
    });

    it('should log validation errors appropriately', async () => {
      const invalidCustomization = null as any;
      await validator.validateCustomization(invalidCustomization, 10, 'child-9');

      const auditLog = await validator.getAuditLog('child-9', {
        start: new Date(Date.now() - 1000),
        end: new Date()
      });

      const errorEntry = auditLog.find(entry => entry.action === 'safety_validation_error');
      expect(errorEntry).toBeDefined();
      expect(errorEntry?.riskLevel).toBe('high');
    });
  });

  describe('Child Safety Compliance', () => {
    it('should enforce COPPA compliance for users under 13', async () => {
      const customization = createSafeCustomization();
      const result = await validator.validateCustomization(customization, 12, 'child-10');

      expect(result.requiresApproval).toBe(true);
    });

    it('should use child-friendly language in messages', async () => {
      const customization = createInappropriateCustomization();
      const result = await validator.validateCustomization(customization, 8, 'child-11');

      expect(result.parentalMessage).toBeDefined();
      expect(result.parentalMessage).toContain('your child');
      expect(result.parentalMessage).not.toContain('violation');
      expect(result.parentalMessage).not.toContain('error');
    });

    it('should sanitize data before logging', async () => {
      const customization = createCustomizationWithPII();
      await validator.validateCustomization(customization, 10, 'child-with-pii');

      const auditLog = await validator.getAuditLog('child-with-pii', {
        start: new Date(Date.now() - 1000),
        end: new Date()
      });

      const logEntry = auditLog[0];
      const logString = JSON.stringify(logEntry.details);
      expect(logString).toContain('[REDACTED]');
    });
  });

  // Helper functions to create test data
  function createSafeCustomization(): AvatarCustomization {
    return {
      appearance: {
        face: {
          meshId: 'friendly-face-1',
          textureId: 'child-appropriate-texture',
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
          styleId: 'child-friendly-hair',
          color: 'brown',
          length: 0.5,
          texture: 'straight' as any,
          physicsEnabled: false,
          strandCount: 1000,
          detailLevel: 'medium' as any
        },
        clothing: {
          topId: 'casual-shirt',
          bottomId: 'jeans',
          shoesId: 'sneakers',
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
          idle: 'friendly-idle',
          talking: 'animated-talking',
          listening: 'attentive-listening',
          thinking: 'thoughtful',
          expressions: {
            happy: 'big-smile',
            sad: 'gentle-frown',
            surprised: 'wide-eyes',
            confused: 'head-tilt',
            excited: 'bouncy'
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

  function createInappropriateCustomization(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.appearance.face.matureFeatures = true;
    customization.appearance.clothing.revealingLevel = 5;
    customization.voice.pitch = -2.0;
    return customization;
  }

  function createMildlyInappropriateCustomization(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.appearance.clothing.revealingLevel = 3;
    customization.personality.formality = 9;
    return customization;
  }

  function createCustomizationWithMatureFeatures(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.appearance.face.matureFeatures = true;
    customization.appearance.clothing.revealingLevel = 4;
    return customization;
  }

  function createTeenAppropriateCustomization(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.personality.formality = 6;
    customization.voice.pitch = 0.5;
    return customization;
  }

  function createCustomizationWithInappropriatePersonality(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.personality.formality = 10;
    return customization;
  }

  function createCustomizationWithExtremeVoice(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.voice.pitch = -1.5;
    customization.voice.speed = 0.3;
    return customization;
  }

  function createHighRiskCustomization(): AvatarCustomization {
    const customization = createSafeCustomization();
    customization.appearance.face.matureFeatures = true;
    customization.appearance.clothing.revealingLevel = 5;
    customization.voice.pitch = -2.0;
    customization.emotions.expressionIntensity = 1.0;
    return customization;
  }

  function createUnsafeCustomization(): AvatarCustomization {
    const customization = createSafeCustomization();
    // Add unsafe content that would be detected by content safety
    (customization as any).unsafeContent = 'inappropriate violent scary';
    return customization;
  }

  function createCustomizationWithPII(): AvatarCustomization {
    const customization = createSafeCustomization();
    (customization as any).personalId = 'user-123-personal-info';
    (customization as any).personalData = 'sensitive information';
    return customization;
  }
});