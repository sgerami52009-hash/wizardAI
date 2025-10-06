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
  AgeRange
} from './types';

/**
 * Validates avatar customizations for child safety and age appropriateness
 * Implements multi-stage content validation and parental control workflows
 */
export class AvatarSafetyValidator {
  private readonly ageBasedRestrictions: Map<number, string[]> = new Map();
  private readonly blockedContent: Set<string> = new Set();
  private readonly auditLog: SafetyAuditEntry[] = [];

  constructor() {
    this.initializeAgeRestrictions();
    this.initializeBlockedContent();
  }

  /**
   * Validates appearance configuration for safety and age appropriateness
   * @param configuration - The appearance configuration to validate
   * @param userAge - Optional user age for age-based validation
   * @returns Promise resolving to safety validation result
   */
  async validateAppearanceConfiguration(
    configuration: AppearanceConfiguration, 
    userAge?: number
  ): Promise<SafetyResult> {
    const violations: string[] = [];
    let riskLevel: RiskLevel = 'low';

    try {
      // Validate face configuration
      const faceViolations = this.validateFaceContent(configuration.face, userAge);
      violations.push(...faceViolations);

      // Validate hair configuration
      const hairViolations = this.validateHairContent(configuration.hair, userAge);
      violations.push(...hairViolations);

      // Validate clothing configuration
      const clothingViolations = this.validateClothingContent(configuration.clothing, userAge);
      violations.push(...clothingViolations);

      // Validate accessories
      const accessoryViolations = this.validateAccessories(configuration.accessories, userAge);
      violations.push(...accessoryViolations);

      // Determine risk level based on violations
      if (violations.length > 0) {
        riskLevel = violations.some(v => v.includes('inappropriate')) ? 'high' : 'medium';
      }

      const result: SafetyResult = {
        isAllowed: violations.length === 0,
        violations,
        riskLevel,
        reason: violations.length > 0 ? violations.join('; ') : 'Content approved',
        requiresParentalApproval: this.requiresParentalApproval(violations, userAge)
      };

      // Log the validation result
      this.logSafetyValidation(configuration, result, userAge);

      return result;
    } catch (error) {
      const errorResult: SafetyResult = {
        isAllowed: false,
        violations: ['Validation error occurred'],
        riskLevel: 'high',
        reason: `Safety validation failed: ${error.message}`,
        requiresParentalApproval: true
      };

      this.logSafetyValidation(configuration, errorResult, userAge);
      return errorResult;
    }
  }

  /**
   * Validates complete avatar customization including all components
   * @param customization - The complete avatar customization to validate
   * @param userAge - User's age for age-based validation
   * @returns Promise resolving to comprehensive safety validation result
   */
  async validateCustomization(
    customization: AvatarCustomization, 
    userAge: number
  ): Promise<SafetyValidationResult> {
    const appearanceResult = await this.validateAppearanceConfiguration(
      customization.appearance, 
      userAge
    );

    // Validate personality traits for appropriateness
    const personalityViolations = this.validatePersonalityTraits(
      customization.personality, 
      userAge
    );

    // Validate voice characteristics
    const voiceViolations = this.validateVoiceCharacteristics(
      customization.voice, 
      userAge
    );

    const allViolations = [
      ...appearanceResult.violations,
      ...personalityViolations,
      ...voiceViolations
    ];

    const blockedElements = allViolations.map(violation => 
      this.extractBlockedElement(violation)
    );

    const result: SafetyValidationResult = {
      isAllowed: allViolations.length === 0,
      requiresApproval: this.requiresParentalApproval(allViolations, userAge),
      blockedElements,
      riskAssessment: this.assessOverallRisk(allViolations),
      parentalMessage: this.generateParentalMessage(allViolations, userAge)
    };

    return result;
  }

  /**
   * Determines if customization requires parental approval
   * @param customization - The avatar customization to check
   * @param userId - The user ID making the customization
   * @returns Promise resolving to boolean indicating if approval is needed
   */
  async requiresParentalApproval(
    violations: string[], 
    userAge?: number
  ): Promise<boolean> {
    // Always require approval for users under 13
    if (userAge && userAge < 13) {
      return true;
    }

    // Require approval for any safety violations
    if (violations.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Submits customization for parental review
   * @param customization - The avatar customization to review
   * @param userId - The user ID requesting the customization
   * @returns Promise resolving to review request details
   */
  async submitForParentalReview(
    customization: AvatarCustomization, 
    userId: string
  ): Promise<ReviewRequest> {
    const reviewId = this.generateReviewId();
    const timestamp = new Date();

    const reviewRequest: ReviewRequest = {
      reviewId,
      userId,
      customization,
      submittedAt: timestamp,
      status: 'pending',
      safetyAssessment: await this.validateCustomization(customization, 0) // Use age 0 for strictest validation
    };

    // Store review request (in real implementation, this would go to a database)
    this.auditLog.push({
      timestamp,
      userId,
      action: 'parental_review_requested',
      details: { reviewId, customization },
      riskLevel: reviewRequest.safetyAssessment.riskAssessment
    });

    return reviewRequest;
  }

  /**
   * Processes parental decision on customization review
   * @param reviewId - The review request ID
   * @param decision - The parental decision (approve/reject)
   */
  async processParentalDecision(reviewId: string, decision: ParentalDecision): Promise<void> {
    const timestamp = new Date();

    // Log the parental decision
    this.auditLog.push({
      timestamp,
      userId: decision.parentId,
      action: 'parental_decision',
      details: { reviewId, decision: decision.approved ? 'approved' : 'rejected', reason: decision.reason },
      riskLevel: 'low'
    });

    // In real implementation, this would update the review status and notify the child
  }

  /**
   * Gets audit log entries for a user within a time range
   * @param userId - The user ID to get audit log for
   * @param timeRange - The time range to filter entries
   * @returns Promise resolving to array of audit entries
   */
  async getAuditLog(userId: string, timeRange: TimeRange): Promise<SafetyAuditEntry[]> {
    return this.auditLog.filter(entry => 
      entry.userId === userId &&
      entry.timestamp >= timeRange.start &&
      entry.timestamp <= timeRange.end
    );
  }

  // Private validation methods

  private validateFaceContent(face: any, userAge?: number): string[] {
    const violations: string[] = [];

    // Check for age-inappropriate facial features
    if (userAge && userAge < 13) {
      if (face.matureFeatures) {
        violations.push('Mature facial features not appropriate for age');
      }
    }

    // Check for blocked content
    if (this.blockedContent.has(face.style)) {
      violations.push(`Blocked facial style: ${face.style}`);
    }

    return violations;
  }

  private validateHairContent(hair: any, userAge?: number): string[] {
    const violations: string[] = [];

    // Check for inappropriate hair styles
    if (this.blockedContent.has(hair.style)) {
      violations.push(`Blocked hair style: ${hair.style}`);
    }

    return violations;
  }

  private validateClothingContent(clothing: any, userAge?: number): string[] {
    const violations: string[] = [];

    // Check for age-inappropriate clothing
    if (userAge && userAge < 16) {
      if (clothing.revealingLevel > 2) {
        violations.push('Clothing too revealing for age');
      }
    }

    // Check for blocked clothing items
    if (this.blockedContent.has(clothing.type)) {
      violations.push(`Blocked clothing type: ${clothing.type}`);
    }

    return violations;
  }

  private validateAccessories(accessories: any[], userAge?: number): string[] {
    const violations: string[] = [];

    accessories.forEach(accessory => {
      if (this.blockedContent.has(accessory.type)) {
        violations.push(`Blocked accessory: ${accessory.type}`);
      }
    });

    return violations;
  }

  private validatePersonalityTraits(personality: any, userAge: number): string[] {
    const violations: string[] = [];

    // Ensure personality traits are age-appropriate
    if (userAge < 13) {
      if (personality.aggressiveness > 3) {
        violations.push('Aggressive personality traits not appropriate for age');
      }
    }

    return violations;
  }

  private validateVoiceCharacteristics(voice: any, userAge: number): string[] {
    const violations: string[] = [];

    // Validate voice characteristics for age appropriateness
    if (userAge < 16) {
      if (voice.pitch < -1.0 || voice.pitch > 1.0) {
        violations.push('Extreme voice pitch not appropriate for age');
      }
    }

    return violations;
  }

  private assessOverallRisk(violations: string[]): RiskLevel {
    if (violations.length === 0) return 'low';
    if (violations.some(v => v.includes('inappropriate') || v.includes('blocked'))) return 'high';
    return 'medium';
  }

  private generateParentalMessage(violations: string[], userAge?: number): string | undefined {
    if (violations.length === 0) return undefined;

    return `The following customizations need review: ${violations.join(', ')}. ` +
           `Please approve or modify these settings for your child.`;
  }

  private extractBlockedElement(violation: string): string {
    // Extract the specific element that was blocked from the violation message
    const match = violation.match(/Blocked (\w+):/);
    return match ? match[1] : 'unknown';
  }

  private logSafetyValidation(
    configuration: AppearanceConfiguration, 
    result: SafetyResult, 
    userAge?: number
  ): void {
    this.auditLog.push({
      timestamp: new Date(),
      userId: 'system', // In real implementation, this would be the actual user ID
      action: 'appearance_validation',
      details: { configuration, result, userAge },
      riskLevel: result.riskLevel
    });
  }

  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAgeRestrictions(): void {
    // Define age-based restrictions
    this.ageBasedRestrictions.set(5, ['simple_features_only']);
    this.ageBasedRestrictions.set(10, ['no_mature_content']);
    this.ageBasedRestrictions.set(13, ['limited_customization']);
    this.ageBasedRestrictions.set(16, ['most_content_allowed']);
  }

  private initializeBlockedContent(): void {
    // Initialize blocked content list
    const blockedItems = [
      'inappropriate_style',
      'violent_theme',
      'adult_content',
      'scary_features',
      'weapon_accessories'
    ];

    blockedItems.forEach(item => this.blockedContent.add(item));
  }
}