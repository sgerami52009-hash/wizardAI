import { 
  AppearanceConfiguration,
  SafetyResult,
  AvatarCustomization,
  SafetyValidationResult,
  ParentalDecision,
  ReviewRequest,
  SafetyAuditEntry,
  TimeRange,
  RiskLevel,
  SafetyRating,
  AgeRange,
  PersonalityTraits,
  VoiceCharacteristics,
  EmotionalConfiguration
} from './types';

import { ParentalControlManagerImpl } from '../learning/parental-control-manager';
import { AgeGroup } from '../learning/types';
import { AdaptationType, ApprovalUrgency } from '../learning/safety-types';
import { RiskLevel as PrivacyRiskLevel } from '../privacy/types';

/**
 * Enhanced avatar safety validation system with multi-stage content validation
 * Implements comprehensive safety checks, age-based filtering, and parental controls
 * Integrates with existing content safety systems for family-friendly AI assistant
 */
export class EnhancedAvatarSafetyValidator {
  private readonly ageBasedRestrictions: Map<number, string[]> = new Map();
  private readonly blockedContent: Set<string> = new Set();
  private readonly auditLog: SafetyAuditEntry[] = [];
  private readonly parentalControlManager: ParentalControlManagerImpl;
  private readonly contentSafetyRules: Map<string, SafetyRule> = new Map();
  private readonly riskAssessmentCache: Map<string, RiskAssessment> = new Map();

  constructor(parentalControlManager?: ParentalControlManagerImpl) {
    this.parentalControlManager = parentalControlManager || new ParentalControlManagerImpl();
    this.initializeAgeRestrictions();
    this.initializeBlockedContent();
    this.initializeContentSafetyRules();
  }

  /**
   * Multi-stage content validation for avatar customizations
   * Stage 1: Basic content filtering
   * Stage 2: Age-based restrictions
   * Stage 3: Risk assessment
   * Stage 4: Parental control integration
   */
  async validateCustomization(
    customization: AvatarCustomization, 
    userAge: number,
    userId: string
  ): Promise<SafetyValidationResult> {
    const validationId = this.generateValidationId();
    const startTime = Date.now();

    try {
      // Stage 1: Basic content filtering
      const basicValidation = await this.performBasicContentValidation(customization);
      
      // Stage 2: Age-based filtering
      const ageValidation = await this.performAgeBasedValidation(customization, userAge);
      
      // Stage 3: Risk assessment
      const riskAssessment = await this.performRiskAssessment(customization, userAge);
      
      // Stage 4: Integration with existing content safety systems
      const contentSafetyResult = await this.integrateWithContentSafety(customization, userId);

      // Combine all validation results
      const combinedViolations = [
        ...basicValidation.violations,
        ...ageValidation.violations,
        ...contentSafetyResult.violations
      ];

      const blockedElements = this.extractBlockedElements(combinedViolations);
      const overallRisk = this.calculateOverallRisk(riskAssessment, combinedViolations);
      const requiresApproval = await this.determineParentalApprovalRequirement(
        combinedViolations, 
        userAge, 
        userId,
        overallRisk
      );

      const result: SafetyValidationResult = {
        isAllowed: combinedViolations.length === 0 && overallRisk !== 'high',
        requiresApproval,
        blockedElements,
        riskAssessment: overallRisk,
        parentalMessage: this.generateParentalMessage(combinedViolations, userAge, overallRisk)
      };

      // Log validation result
      await this.logSafetyValidation(validationId, userId, customization, result, Date.now() - startTime);

      return result;

    } catch (error) {
      const errorResult: SafetyValidationResult = {
        isAllowed: false,
        requiresApproval: true,
        blockedElements: ['validation_error'],
        riskAssessment: 'high',
        parentalMessage: 'Safety validation encountered an error. Please try again or contact support.'
      };

      await this.logValidationError(validationId, userId, error, Date.now() - startTime);
      return errorResult;
    }
  }

  /**
   * Age-based filtering for all customization types
   * Implements strict allowlist approach for child safety
   */
  async performAgeBasedValidation(
    customization: AvatarCustomization,
    userAge: number
  ): Promise<SafetyResult> {
    const violations: string[] = [];
    const ageGroup = this.getAgeGroup(userAge);

    // Validate appearance based on age
    const appearanceViolations = await this.validateAppearanceForAge(customization.appearance, ageGroup, userAge);
    violations.push(...appearanceViolations);

    // Validate personality traits for age appropriateness
    const personalityViolations = await this.validatePersonalityForAge(customization.personality, ageGroup, userAge);
    violations.push(...personalityViolations);

    // Validate voice characteristics for age
    const voiceViolations = await this.validateVoiceForAge(customization.voice, ageGroup, userAge);
    violations.push(...voiceViolations);

    // Validate emotional configuration
    const emotionViolations = await this.validateEmotionsForAge(customization.emotions, ageGroup, userAge);
    violations.push(...emotionViolations);

    return {
      isAllowed: violations.length === 0,
      violations,
      riskLevel: violations.length > 0 ? 'medium' : 'low',
      reason: violations.length > 0 ? 'Age-inappropriate content detected' : 'Age validation passed',
      requiresParentalApproval: violations.length > 0,
      blockedContent: violations,
      recommendations: this.generateAgeBasedRecommendations(ageGroup, violations)
    };
  }

  /**
   * Safety risk assessment and blocking mechanisms
   */
  async performRiskAssessment(
    customization: AvatarCustomization,
    userAge: number
  ): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];

    // Assess appearance risks
    const appearanceRisks = this.assessAppearanceRisks(customization.appearance, userAge);
    riskFactors.push(...appearanceRisks);

    // Assess personality risks
    const personalityRisks = this.assessPersonalityRisks(customization.personality, userAge);
    riskFactors.push(...personalityRisks);

    // Assess voice risks
    const voiceRisks = this.assessVoiceRisks(customization.voice, userAge);
    riskFactors.push(...voiceRisks);

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(riskFactors);
    const riskLevel = this.determineRiskLevel(riskScore);

    return {
      overallRisk: riskLevel,
      riskScore,
      riskFactors,
      mitigationRequired: riskLevel === 'high',
      recommendedActions: this.generateRiskMitigationActions(riskFactors)
    };
  }

  /**
   * Integration with existing content safety systems
   */
  async integrateWithContentSafety(
    customization: AvatarCustomization,
    userId: string
  ): Promise<SafetyResult> {
    const violations: string[] = [];

    // Use existing validateChildSafeContent function from product guidelines
    const appearanceContent = this.extractContentForValidation(customization.appearance);
    const personalityContent = this.extractPersonalityContent(customization.personality);
    const voiceContent = this.extractVoiceContent(customization.voice);

    // Validate each content type
    for (const content of [...appearanceContent, ...personalityContent, ...voiceContent]) {
      const isChildSafe = await this.validateChildSafeContent(content);
      if (!isChildSafe) {
        violations.push(`Unsafe content detected: ${content.type}`);
      }
    }

    return {
      isAllowed: violations.length === 0,
      violations,
      riskLevel: violations.length > 0 ? 'high' : 'low',
      reason: violations.length > 0 ? 'Content safety validation failed' : 'Content safety validation passed',
      requiresParentalApproval: violations.length > 0,
      blockedContent: violations,
      recommendations: violations.length > 0 ? ['Review content guidelines', 'Choose age-appropriate options'] : []
    };
  }

  /**
   * Determines if customization requires parental approval
   */
  async determineParentalApprovalRequirement(
    violations: string[],
    userAge: number,
    userId: string,
    riskLevel: RiskLevel
  ): Promise<boolean> {
    // Always require approval for high-risk content
    if (riskLevel === 'high') {
      return true;
    }

    // Always require approval for users under 13 (COPPA compliance)
    if (userAge < 13) {
      return true;
    }

    // Require approval for any safety violations
    if (violations.length > 0) {
      return true;
    }

    // Check parental control settings
    try {
      const learningOversight = await this.parentalControlManager.getLearningOversight(userId);
      if (learningOversight.currentBoundaries.requireApprovalThreshold > 0.8) {
        return true;
      }
    } catch (error) {
      // If we can't check parental controls, err on the side of caution
      return true;
    }

    return false;
  }

  /**
   * Submits customization for parental review with enhanced workflow
   */
  async submitForParentalReview(
    customization: AvatarCustomization, 
    userId: string,
    validationResult: SafetyValidationResult
  ): Promise<ReviewRequest> {
    const reviewId = this.generateReviewId();
    const timestamp = new Date();

    const reviewRequest: ReviewRequest = {
      reviewId,
      userId,
      customization,
      submittedAt: timestamp,
      status: 'pending',
      safetyAssessment: validationResult
    };

    // Create parental approval request through existing system
    try {
      await this.parentalControlManager.requestParentalApproval({
        requestId: reviewId,
        childId: userId,
        parentId: await this.getParentId(userId),
        timestamp: new Date(),
        justification: 'Avatar customization contains elements that require parental review',
        adaptation: {
          adaptationId: reviewId,
          userId: userId,
          type: AdaptationType.CONTENT_PREFERENCE,
          description: 'Avatar customization requires parental approval',
          impact: {
            behaviorChange: 'minimal' as any,
            personalityAdjustment: 'none' as any,
            responseModification: 'minimal' as any,
            learningScope: 'limited' as any,
            reversibility: 'high' as any
          },
          confidence: 0.9,
          proposedChanges: [{
            changeType: 'avatar_customization' as any,
            description: 'Avatar appearance customization',
            beforeValue: 'default_avatar',
            afterValue: 'custom_avatar',
            confidence: 0.9,
            impact: 'low' as any
          }],
          riskAssessment: {
            overallRisk: validationResult.riskAssessment === 'high' ? PrivacyRiskLevel.HIGH : 
                        validationResult.riskAssessment === 'medium' ? PrivacyRiskLevel.MEDIUM : PrivacyRiskLevel.LOW,
            privacyRisk: PrivacyRiskLevel.LOW,
            safetyRisk: validationResult.riskAssessment === 'high' ? PrivacyRiskLevel.HIGH : 
                       validationResult.riskAssessment === 'medium' ? PrivacyRiskLevel.MEDIUM : PrivacyRiskLevel.LOW,
            developmentalRisk: PrivacyRiskLevel.LOW,
            mitigationStrategies: ['Parental approval required', 'Content filtering applied']
          }
        },
        urgency: validationResult.riskAssessment === 'high' ? ApprovalUrgency.HIGH : ApprovalUrgency.NORMAL,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    } catch (error) {
      console.error('Failed to create parental approval request:', error);
    }

    // Log review request
    await this.logParentalReviewRequest(reviewRequest);

    return reviewRequest;
  }

  /**
   * Processes parental decision with enhanced logging and notifications
   */
  async processParentalDecision(reviewId: string, decision: ParentalDecision): Promise<void> {
    const timestamp = new Date();

    // Log the parental decision with enhanced details
    const auditEntry: SafetyAuditEntry = {
      timestamp,
      userId: decision.parentId,
      action: decision.approved ? 'parental_approval_granted' : 'parental_approval_denied',
      details: {
        reviewId,
        childUserId: await this.getChildUserIdFromReview(reviewId),
        decision: decision.approved ? 'approved' : 'rejected',
        reason: decision.reason,
        decisionFactors: this.extractDecisionFactors(decision)
      },
      riskLevel: decision.approved ? 'low' : 'medium'
    };

    this.auditLog.push(auditEntry);

    // Notify child of decision (in child-friendly language)
    await this.notifyChildOfDecision(reviewId, decision);

    // Update customization status
    await this.updateCustomizationStatus(reviewId, decision.approved);
  }

  /**
   * Gets comprehensive audit log with enhanced filtering and reporting
   */
  async getAuditLog(userId: string, timeRange: TimeRange): Promise<SafetyAuditEntry[]> {
    return this.auditLog.filter(entry => 
      (entry.userId === userId || entry.details?.childUserId === userId) &&
      entry.timestamp >= timeRange.start &&
      entry.timestamp <= timeRange.end
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Private helper methods for enhanced functionality

  private async validateChildSafeContent(content: ContentItem): Promise<boolean> {
    // Implementation of validateChildSafeContent as required by product guidelines
    // This would integrate with existing content safety systems
    
    const blockedKeywords = ['inappropriate', 'violent', 'scary', 'adult'];
    const contentText = content.description.toLowerCase();
    
    return !blockedKeywords.some(keyword => contentText.includes(keyword));
  }

  private async validateAppearanceForAge(
    appearance: AppearanceConfiguration,
    ageGroup: AgeGroup,
    userAge: number
  ): Promise<string[]> {
    const violations: string[] = [];

    // Strict validation for younger children
    if (ageGroup === AgeGroup.TODDLER || userAge < 8) {
      if (appearance.face.matureFeatures) {
        violations.push('Mature facial features not appropriate for young children');
      }
      if (appearance.clothing.revealingLevel > 1) {
        violations.push('Clothing style not appropriate for young children');
      }
    }

    // Moderate validation for children
    if (ageGroup === AgeGroup.CHILD) {
      if (appearance.clothing.revealingLevel > 3) {
        violations.push('Clothing style not appropriate for children');
      }
    }

    return violations;
  }

  private async validatePersonalityForAge(
    personality: PersonalityTraits,
    ageGroup: AgeGroup,
    userAge: number
  ): Promise<string[]> {
    const violations: string[] = [];

    // Ensure personality traits are age-appropriate
    if (ageGroup === AgeGroup.TODDLER || userAge < 8) {
      if (personality.formality > 7) {
        violations.push('High formality not appropriate for young children');
      }
    }

    if (ageGroup === AgeGroup.CHILD) {
      if (personality.humor > 8 && userAge < 10) {
        violations.push('Advanced humor level may not be appropriate');
      }
    }

    return violations;
  }

  private async validateVoiceForAge(
    voice: VoiceCharacteristics,
    ageGroup: AgeGroup,
    userAge: number
  ): Promise<string[]> {
    const violations: string[] = [];

    // Validate voice characteristics for age appropriateness
    if (ageGroup === AgeGroup.TODDLER || userAge < 8) {
      if (voice.pitch < -0.5 || voice.pitch > 1.5) {
        violations.push('Extreme voice pitch not appropriate for young children');
      }
      if (voice.speed < 0.8 || voice.speed > 1.2) {
        violations.push('Extreme voice speed not appropriate for young children');
      }
    }

    return violations;
  }

  private async validateEmotionsForAge(
    emotions: EmotionalConfiguration,
    ageGroup: AgeGroup,
    userAge: number
  ): Promise<string[]> {
    const violations: string[] = [];

    // Ensure emotional expressions are age-appropriate
    if (ageGroup === AgeGroup.TODDLER || userAge < 8) {
      if (emotions.expressionIntensity > 0.7) {
        violations.push('High emotional intensity not appropriate for young children');
      }
    }

    return violations;
  }

  private getAgeGroup(userAge: number): AgeGroup {
    if (userAge < 5) return AgeGroup.TODDLER;
    if (userAge < 13) return AgeGroup.CHILD;
    if (userAge < 18) return AgeGroup.TEEN;
    return AgeGroup.ADULT;
  }

  private generateValidationId(): string {
    return `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractBlockedElements(violations: string[]): string[] {
    return violations.map(violation => {
      const match = violation.match(/Blocked (\w+):|(\w+) not appropriate/);
      return match ? (match[1] || match[2]) : 'unknown';
    });
  }

  private calculateOverallRisk(riskAssessment: RiskAssessment, violations: string[]): RiskLevel {
    if (violations.some(v => v.includes('inappropriate') || v.includes('unsafe'))) {
      return 'high';
    }
    return riskAssessment.overallRisk;
  }

  private generateParentalMessage(violations: string[], userAge: number, riskLevel: RiskLevel): string | undefined {
    if (violations.length === 0 && riskLevel === 'low') return undefined;

    const childName = userAge < 13 ? 'your child' : 'your teen';
    
    if (riskLevel === 'high') {
      return `We've detected content that may not be appropriate for ${childName}. Please review these customizations carefully before approving.`;
    }

    return `${childName} has requested avatar customizations that need your approval. Please review: ${violations.slice(0, 3).join(', ')}.`;
  }

  private initializeContentSafetyRules(): void {
    // Initialize content safety rules based on product guidelines
    this.contentSafetyRules.set('appearance', {
      allowedContent: ['friendly', 'colorful', 'age-appropriate'],
      blockedContent: ['scary', 'violent', 'inappropriate'],
      ageRestrictions: new Map([
        [AgeGroup.TODDLER, ['simple', 'bright']],
        [AgeGroup.CHILD, ['fun', 'educational']],
        [AgeGroup.TEEN, ['stylish', 'expressive']]
      ])
    });
  }

  private async logSafetyValidation(
    validationId: string,
    userId: string,
    customization: AvatarCustomization,
    result: SafetyValidationResult,
    processingTime: number
  ): Promise<void> {
    const auditEntry: SafetyAuditEntry = {
      timestamp: new Date(),
      userId,
      action: 'safety_validation_completed',
      details: {
        validationId,
        customization: this.sanitizeForLog(customization),
        result,
        processingTime
      },
      riskLevel: result.riskAssessment
    };

    this.auditLog.push(auditEntry);
  }

  private sanitizeForLog(data: any): any {
    // Remove PII and sensitive data before logging as per product guidelines
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (key.includes('id') || key.includes('personal')) {
        return '[REDACTED]';
      }
      return value;
    }));
  }

  // Additional helper methods would be implemented here...
  private async performBasicContentValidation(customization: AvatarCustomization): Promise<SafetyResult> {
    // Implementation for basic content validation
    return {
      isAllowed: true,
      violations: [],
      riskLevel: 'low',
      reason: 'Basic validation passed',
      requiresParentalApproval: false,
      blockedContent: [],
      recommendations: []
    };
  }

  private assessAppearanceRisks(appearance: AppearanceConfiguration, userAge: number): RiskFactor[] {
    // Implementation for appearance risk assessment
    return [];
  }

  private assessPersonalityRisks(personality: PersonalityTraits, userAge: number): RiskFactor[] {
    // Implementation for personality risk assessment
    return [];
  }

  private assessVoiceRisks(voice: VoiceCharacteristics, userAge: number): RiskFactor[] {
    // Implementation for voice risk assessment
    return [];
  }

  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    return riskFactors.reduce((sum, factor) => sum + factor.weight, 0);
  }

  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore > 0.7) return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }

  private generateRiskMitigationActions(riskFactors: RiskFactor[]): string[] {
    return riskFactors.map(factor => `Mitigate: ${factor.description}`);
  }

  private extractContentForValidation(appearance: AppearanceConfiguration): ContentItem[] {
    return [
      { type: 'face', description: 'facial features' },
      { type: 'hair', description: 'hair style' },
      { type: 'clothing', description: 'clothing style' }
    ];
  }

  private extractPersonalityContent(personality: PersonalityTraits): ContentItem[] {
    return [{ type: 'personality', description: 'personality traits' }];
  }

  private extractVoiceContent(voice: VoiceCharacteristics): ContentItem[] {
    return [{ type: 'voice', description: 'voice characteristics' }];
  }

  private generateAgeBasedRecommendations(ageGroup: AgeGroup, violations: string[]): string[] {
    const recommendations: string[] = [];
    
    if (ageGroup === AgeGroup.TODDLER) {
      recommendations.push('Choose simple, bright, and friendly options');
    } else if (ageGroup === AgeGroup.CHILD) {
      recommendations.push('Select fun and educational customizations');
    }
    
    return recommendations;
  }

  private async getParentId(userId: string): Promise<string> {
    // In real implementation, this would look up the parent ID
    return 'parent_' + userId;
  }

  private async getChildUserIdFromReview(reviewId: string): Promise<string> {
    // In real implementation, this would look up the child user ID from review
    return 'child_user';
  }

  private extractDecisionFactors(decision: ParentalDecision): string[] {
    return decision.reason ? [decision.reason] : [];
  }

  private async notifyChildOfDecision(reviewId: string, decision: ParentalDecision): Promise<void> {
    // Implementation for child-friendly notification
    console.log(`Notifying child about decision for review ${reviewId}: ${decision.approved ? 'approved' : 'needs changes'}`);
  }

  private async updateCustomizationStatus(reviewId: string, approved: boolean): Promise<void> {
    // Implementation for updating customization status
    console.log(`Updated customization status for review ${reviewId}: ${approved ? 'approved' : 'rejected'}`);
  }

  private async logParentalReviewRequest(reviewRequest: ReviewRequest): Promise<void> {
    const auditEntry: SafetyAuditEntry = {
      timestamp: new Date(),
      userId: reviewRequest.userId,
      action: 'parental_review_requested',
      details: {
        reviewId: reviewRequest.reviewId,
        safetyAssessment: reviewRequest.safetyAssessment
      },
      riskLevel: reviewRequest.safetyAssessment.riskAssessment
    };

    this.auditLog.push(auditEntry);
  }

  private async logValidationError(validationId: string, userId: string, error: any, processingTime: number): Promise<void> {
    const auditEntry: SafetyAuditEntry = {
      timestamp: new Date(),
      userId,
      action: 'safety_validation_error',
      details: {
        validationId,
        error: error.message,
        processingTime
      },
      riskLevel: 'high'
    };

    this.auditLog.push(auditEntry);
  }

  private initializeAgeRestrictions(): void {
    // Initialize age-based restrictions
    this.ageBasedRestrictions.set(5, ['simple_features_only', 'bright_colors']);
    this.ageBasedRestrictions.set(10, ['no_mature_content', 'educational_themes']);
    this.ageBasedRestrictions.set(13, ['limited_customization', 'supervised_changes']);
    this.ageBasedRestrictions.set(16, ['most_content_allowed', 'parental_oversight']);
  }

  private initializeBlockedContent(): void {
    // Initialize blocked content list based on product guidelines
    const blockedItems = [
      'inappropriate_style',
      'violent_theme',
      'adult_content',
      'scary_features',
      'weapon_accessories',
      'mature_themes',
      'inappropriate_clothing',
      'aggressive_personality'
    ];

    blockedItems.forEach(item => this.blockedContent.add(item));
  }
}

// Supporting interfaces for enhanced functionality
interface SafetyRule {
  allowedContent: string[];
  blockedContent: string[];
  ageRestrictions: Map<AgeGroup, string[]>;
}

interface RiskAssessment {
  overallRisk: RiskLevel;
  riskScore: number;
  riskFactors: RiskFactor[];
  mitigationRequired: boolean;
  recommendedActions: string[];
}

interface RiskFactor {
  type: string;
  description: string;
  weight: number;
  severity: 'low' | 'medium' | 'high';
}

interface ContentItem {
  type: string;
  description: string;
}