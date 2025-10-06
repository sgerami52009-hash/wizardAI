// Child Safety Validator Implementation

import {
  SafetyValidator,
  LearningContent,
  LearningAdaptation,
  SafetyValidationResult,
  SafetyDecision,
  SafetyAuditLog,
  ContentSafetyResult,
  SafetyLevel,
  SafetyViolation,
  SafetyRecommendation,
  AuditEntry,
  ContentIssue,
  AgeAppropriatenessResult,
  SafetyDecisionType,
  SafetyViolationType,
  ViolationSeverity,
  SafetyRecommendationType,
  RecommendationPriority,
  AuditAction,
  ContentIssueType,
  IssueSeverity,
  ContentType,
  AdaptationType,
  TimeRange,
  BehaviorChangeLevel
} from './safety-types';

import { AgeGroup } from './types';
import { RiskLevel } from '../privacy/types';

export class SafetyValidatorImpl implements SafetyValidator {
  private auditLog: SafetyDecision[] = [];
  private childSafetyRules: Map<AgeGroup, ChildSafetyRules> = new Map();
  private inappropriateContentPatterns: RegExp[] = [];
  private parentalApprovalThresholds: Map<AgeGroup, number> = new Map();

  constructor() {
    this.initializeChildSafetyRules();
    this.initializeContentPatterns();
    this.initializeApprovalThresholds();
  }

  async validateLearningContent(content: LearningContent, userId: string): Promise<SafetyValidationResult> {
    const userProfile = await this.getUserProfile(userId);
    const ageGroup = userProfile.ageGroup;
    const safetyRules = this.childSafetyRules.get(ageGroup);

    if (!safetyRules) {
      throw new Error(`No safety rules defined for age group: ${ageGroup}`);
    }

    const violations: SafetyViolation[] = [];
    const recommendations: SafetyRecommendation[] = [];
    const auditTrail: AuditEntry[] = [];

    // Validate content type is allowed for age group
    if (!safetyRules.allowedContentTypes.includes(content.type)) {
      violations.push({
        violationId: this.generateId(),
        type: SafetyViolationType.AGE_INAPPROPRIATE,
        severity: ViolationSeverity.HIGH,
        description: `Content type ${content.type} not allowed for age group ${ageGroup}`,
        detectedContent: content.type,
        ageGroup,
        recommendedAction: 'Block content and suggest age-appropriate alternatives',
        timestamp: new Date()
      });
    }

    // Validate text content if present
    if (content.text) {
      const contentSafetyResult = await this.validateChildSafeContent(content.text);
      if (!contentSafetyResult.isSafe) {
        violations.push(...contentSafetyResult.detectedIssues.map(issue => ({
          violationId: this.generateId(),
          type: this.mapContentIssueToViolationType(issue.issueType),
          severity: this.mapIssueSeverityToViolationSeverity(issue.severity),
          description: issue.description,
          detectedContent: issue.location,
          ageGroup,
          recommendedAction: issue.suggestion,
          timestamp: new Date()
        })));
      }
    }

    // Check safety level against age group requirements
    const requiredSafetyLevel = safetyRules.minimumSafetyLevel;
    if (this.getSafetyLevelRank(content.safetyLevel) < this.getSafetyLevelRank(requiredSafetyLevel)) {
      violations.push({
        violationId: this.generateId(),
        type: SafetyViolationType.INAPPROPRIATE_CONTENT,
        severity: ViolationSeverity.MEDIUM,
        description: `Content safety level ${content.safetyLevel} below required ${requiredSafetyLevel}`,
        detectedContent: content.contentId,
        ageGroup,
        recommendedAction: 'Increase content safety filtering',
        timestamp: new Date()
      });
    }

    // Generate recommendations based on violations
    if (violations.length > 0) {
      recommendations.push({
        type: SafetyRecommendationType.CONTENT_FILTER,
        priority: RecommendationPriority.HIGH,
        description: 'Apply stricter content filtering for this age group',
        implementation: 'Update content validation rules',
        targetAgeGroup: ageGroup
      });
    }

    // Add audit entry
    auditTrail.push({
      entryId: this.generateId(),
      timestamp: new Date(),
      action: AuditAction.CONTENT_VALIDATED,
      userId,
      details: `Validated content ${content.contentId} for user ${userId}`,
      result: violations.length === 0 ? 'APPROVED' : 'REJECTED'
    });

    const isApproved = violations.length === 0;
    const requiresParentalApproval = !isApproved && ageGroup !== AgeGroup.ADULT;

    return {
      isApproved,
      safetyLevel: this.determineSafetyLevel(violations),
      violations,
      recommendations,
      requiresParentalApproval,
      auditTrail
    };
  }

  async validateLearningAdaptation(adaptation: LearningAdaptation, userId: string): Promise<SafetyValidationResult> {
    const userProfile = await this.getUserProfile(userId);
    const ageGroup = userProfile.ageGroup;
    const safetyRules = this.childSafetyRules.get(ageGroup);

    if (!safetyRules) {
      throw new Error(`No safety rules defined for age group: ${ageGroup}`);
    }

    const violations: SafetyViolation[] = [];
    const recommendations: SafetyRecommendation[] = [];
    const auditTrail: AuditEntry[] = [];

    // Check if adaptation type is allowed
    if (!safetyRules.allowedAdaptationTypes.includes(adaptation.type)) {
      violations.push({
        violationId: this.generateId(),
        type: SafetyViolationType.BEHAVIORAL_CONCERN,
        severity: ViolationSeverity.HIGH,
        description: `Adaptation type ${adaptation.type} not allowed for age group ${ageGroup}`,
        detectedContent: adaptation.adaptationId,
        ageGroup,
        recommendedAction: 'Block adaptation and notify parent',
        timestamp: new Date()
      });
    }

    // Validate adaptation impact
    const impactRisk = this.assessAdaptationRisk(adaptation, ageGroup);
    if (impactRisk === RiskLevel.HIGH || impactRisk === RiskLevel.CRITICAL) {
      violations.push({
        violationId: this.generateId(),
        type: SafetyViolationType.BEHAVIORAL_CONCERN,
        severity: impactRisk === RiskLevel.CRITICAL ? ViolationSeverity.CRITICAL : ViolationSeverity.HIGH,
        description: `Adaptation has ${impactRisk} risk impact for child`,
        detectedContent: adaptation.description,
        ageGroup,
        recommendedAction: 'Require parental approval before applying',
        timestamp: new Date()
      });
    }

    // Check confidence threshold
    if (adaptation.confidence < safetyRules.minimumConfidenceThreshold) {
      violations.push({
        violationId: this.generateId(),
        type: SafetyViolationType.BEHAVIORAL_CONCERN,
        severity: ViolationSeverity.MEDIUM,
        description: `Adaptation confidence ${adaptation.confidence} below threshold ${safetyRules.minimumConfidenceThreshold}`,
        detectedContent: adaptation.adaptationId,
        ageGroup,
        recommendedAction: 'Increase confidence threshold or gather more data',
        timestamp: new Date()
      });
    }

    // Generate safety recommendations
    if (violations.length > 0) {
      recommendations.push({
        type: SafetyRecommendationType.PARENTAL_NOTIFICATION,
        priority: RecommendationPriority.HIGH,
        description: 'Notify parent of proposed learning adaptation',
        implementation: 'Send parental approval request',
        targetAgeGroup: ageGroup
      });
    }

    // Add audit entry
    auditTrail.push({
      entryId: this.generateId(),
      timestamp: new Date(),
      action: AuditAction.ADAPTATION_APPROVED,
      userId,
      details: `Validated adaptation ${adaptation.adaptationId} for user ${userId}`,
      result: violations.length === 0 ? 'APPROVED' : 'REJECTED'
    });

    const isApproved = violations.length === 0;
    const requiresParentalApproval = await this.requiresParentalApproval(adaptation, userId);

    return {
      isApproved,
      safetyLevel: this.determineSafetyLevel(violations),
      violations,
      recommendations,
      requiresParentalApproval,
      auditTrail
    };
  }

  async requiresParentalApproval(adaptation: LearningAdaptation, userId: string): Promise<boolean> {
    const userProfile = await this.getUserProfile(userId);
    const ageGroup = userProfile.ageGroup;

    // Adults don't need parental approval
    if (ageGroup === AgeGroup.ADULT || ageGroup === AgeGroup.SENIOR) {
      return false;
    }

    const threshold = this.parentalApprovalThresholds.get(ageGroup) || 0.8;
    
    // Require approval for high-impact adaptations
    if (adaptation.riskAssessment.overallRisk === RiskLevel.HIGH || 
        adaptation.riskAssessment.overallRisk === RiskLevel.CRITICAL) {
      return true;
    }

    // Require approval for low-confidence adaptations
    if (adaptation.confidence < threshold) {
      return true;
    }

    // Require approval for certain adaptation types for children
    const highRiskTypes = [AdaptationType.PERSONALITY_ADJUSTMENT, AdaptationType.INTERACTION_PATTERN];
    if (ageGroup === AgeGroup.CHILD && highRiskTypes.includes(adaptation.type)) {
      return true;
    }

    return false;
  }

  async logSafetyDecision(decision: SafetyDecision): Promise<void> {
    // Store decision in audit log
    this.auditLog.push(decision);

    // In a real implementation, this would persist to encrypted storage
    console.log(`Safety decision logged: ${decision.decisionId} for user ${decision.userId}`);

    // Trigger alerts for critical violations
    if (decision.result.violations.some(v => v.severity === ViolationSeverity.CRITICAL)) {
      await this.triggerCriticalSafetyAlert(decision);
    }
  }

  async generateSafetyAuditLog(userId: string, timeRange: TimeRange): Promise<SafetyAuditLog> {
    const userDecisions = this.auditLog.filter(decision => 
      decision.userId === userId &&
      decision.timestamp >= timeRange.start &&
      decision.timestamp <= timeRange.end
    );

    const totalDecisions = userDecisions.length;
    const approvedDecisions = userDecisions.filter(d => d.result.isApproved).length;
    const rejectedDecisions = totalDecisions - approvedDecisions;
    const parentalApprovalsRequired = userDecisions.filter(d => d.parentalApprovalRequired).length;
    const parentalApprovalsReceived = userDecisions.filter(d => d.parentalApprovalReceived).length;

    const allViolations = userDecisions.flatMap(d => d.result.violations);

    return {
      userId,
      generatedAt: new Date(),
      timeRange,
      totalDecisions,
      approvedDecisions,
      rejectedDecisions,
      parentalApprovalsRequired,
      parentalApprovalsReceived,
      safetyViolations: allViolations,
      decisions: userDecisions
    };
  }

  async validateChildSafeContent(content: string): Promise<ContentSafetyResult> {
    const detectedIssues: ContentIssue[] = [];
    let safetyScore = 1.0;

    // Check for inappropriate language patterns
    for (const pattern of this.inappropriateContentPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        detectedIssues.push({
          issueType: ContentIssueType.INAPPROPRIATE_LANGUAGE,
          severity: IssueSeverity.HIGH,
          description: 'Inappropriate language detected',
          location: matches[0],
          suggestion: 'Replace with child-friendly alternative'
        });
        safetyScore -= 0.3;
      }
    }

    // Check for adult themes
    const adultThemes = ['violence', 'adult content', 'inappropriate behavior'];
    for (const theme of adultThemes) {
      if (content.toLowerCase().includes(theme)) {
        detectedIssues.push({
          issueType: ContentIssueType.ADULT_THEMES,
          severity: IssueSeverity.CRITICAL,
          description: `Adult theme detected: ${theme}`,
          location: theme,
          suggestion: 'Remove or replace with age-appropriate content'
        });
        safetyScore -= 0.5;
      }
    }

    // Age appropriateness assessment
    const ageAppropriate: AgeAppropriatenessResult = {
      isAppropriate: safetyScore >= 0.7,
      recommendedMinAge: this.calculateMinAge(detectedIssues),
      recommendedMaxAge: 17,
      concerns: detectedIssues.map(issue => issue.description),
      alternatives: detectedIssues.length > 0 ? ['Use simpler language', 'Focus on positive themes'] : undefined
    };

    return {
      isSafe: detectedIssues.length === 0 && safetyScore >= 0.8,
      safetyScore: Math.max(0, safetyScore),
      detectedIssues,
      ageAppropriate,
      recommendations: detectedIssues.map(issue => issue.suggestion)
    };
  }

  private initializeChildSafetyRules(): void {
    // Toddler safety rules (2-4 years)
    this.childSafetyRules.set(AgeGroup.TODDLER, {
      allowedContentTypes: [ContentType.INTERACTION, ContentType.PREFERENCE],
      allowedAdaptationTypes: [AdaptationType.RESPONSE_STYLE],
      minimumSafetyLevel: SafetyLevel.SAFE,
      minimumConfidenceThreshold: 0.95,
      maxDailyAdaptations: 1,
      requiresConstantSupervision: true
    });

    // Child safety rules (5-12 years)
    this.childSafetyRules.set(AgeGroup.CHILD, {
      allowedContentTypes: [ContentType.CONVERSATION, ContentType.INTERACTION, ContentType.PREFERENCE, ContentType.SCHEDULING],
      allowedAdaptationTypes: [AdaptationType.RESPONSE_STYLE, AdaptationType.CONTENT_PREFERENCE],
      minimumSafetyLevel: SafetyLevel.SAFE,
      minimumConfidenceThreshold: 0.85,
      maxDailyAdaptations: 3,
      requiresConstantSupervision: false
    });

    // Teen safety rules (13-17 years)
    this.childSafetyRules.set(AgeGroup.TEEN, {
      allowedContentTypes: Object.values(ContentType),
      allowedAdaptationTypes: [AdaptationType.RESPONSE_STYLE, AdaptationType.CONTENT_PREFERENCE, AdaptationType.INTERACTION_PATTERN],
      minimumSafetyLevel: SafetyLevel.CAUTION,
      minimumConfidenceThreshold: 0.75,
      maxDailyAdaptations: 5,
      requiresConstantSupervision: false
    });

    // Adult safety rules (18+ years)
    this.childSafetyRules.set(AgeGroup.ADULT, {
      allowedContentTypes: Object.values(ContentType),
      allowedAdaptationTypes: Object.values(AdaptationType),
      minimumSafetyLevel: SafetyLevel.CAUTION,
      minimumConfidenceThreshold: 0.6,
      maxDailyAdaptations: 10,
      requiresConstantSupervision: false
    });
  }

  private initializeContentPatterns(): void {
    // Initialize patterns for inappropriate content detection
    this.inappropriateContentPatterns = [
      /\b(damn|hell|crap)\b/gi,
      /\b(stupid|dumb|idiot)\b/gi,
      /\b(hate|kill|die)\b/gi
    ];
  }

  private initializeApprovalThresholds(): void {
    this.parentalApprovalThresholds.set(AgeGroup.TODDLER, 0.95);
    this.parentalApprovalThresholds.set(AgeGroup.CHILD, 0.85);
    this.parentalApprovalThresholds.set(AgeGroup.TEEN, 0.75);
  }

  private async getUserProfile(userId: string): Promise<UserProfile> {
    // In a real implementation, this would fetch from user store
    // For now, return a mock profile
    return {
      userId,
      ageGroup: AgeGroup.CHILD, // Default for safety
      parentalControlsEnabled: true,
      supervisionLevel: 'moderate'
    };
  }

  private getSafetyLevelRank(level: SafetyLevel): number {
    const ranks = {
      [SafetyLevel.BLOCKED]: 0,
      [SafetyLevel.WARNING]: 1,
      [SafetyLevel.CAUTION]: 2,
      [SafetyLevel.SAFE]: 3
    };
    return ranks[level] || 0;
  }

  private determineSafetyLevel(violations: SafetyViolation[]): SafetyLevel {
    if (violations.length === 0) return SafetyLevel.SAFE;
    
    const maxSeverity = Math.max(...violations.map(v => this.getSeverityRank(v.severity)));
    
    if (maxSeverity >= 3) return SafetyLevel.BLOCKED;
    if (maxSeverity >= 2) return SafetyLevel.WARNING;
    return SafetyLevel.CAUTION;
  }

  private getSeverityRank(severity: ViolationSeverity): number {
    const ranks = {
      [ViolationSeverity.LOW]: 0,
      [ViolationSeverity.MEDIUM]: 1,
      [ViolationSeverity.HIGH]: 2,
      [ViolationSeverity.CRITICAL]: 3
    };
    return ranks[severity] || 0;
  }

  private mapContentIssueToViolationType(issueType: ContentIssueType): SafetyViolationType {
    const mapping = {
      [ContentIssueType.INAPPROPRIATE_LANGUAGE]: SafetyViolationType.INAPPROPRIATE_CONTENT,
      [ContentIssueType.VIOLENT_CONTENT]: SafetyViolationType.INAPPROPRIATE_CONTENT,
      [ContentIssueType.ADULT_THEMES]: SafetyViolationType.AGE_INAPPROPRIATE,
      [ContentIssueType.PRIVACY_CONCERN]: SafetyViolationType.PRIVACY_VIOLATION,
      [ContentIssueType.BEHAVIORAL_INFLUENCE]: SafetyViolationType.BEHAVIORAL_CONCERN
    };
    return mapping[issueType] || SafetyViolationType.INAPPROPRIATE_CONTENT;
  }

  private mapIssueSeverityToViolationSeverity(severity: IssueSeverity): ViolationSeverity {
    const mapping = {
      [IssueSeverity.LOW]: ViolationSeverity.LOW,
      [IssueSeverity.MEDIUM]: ViolationSeverity.MEDIUM,
      [IssueSeverity.HIGH]: ViolationSeverity.HIGH,
      [IssueSeverity.CRITICAL]: ViolationSeverity.CRITICAL
    };
    return mapping[severity] || ViolationSeverity.MEDIUM;
  }

  private assessAdaptationRisk(adaptation: LearningAdaptation, ageGroup: AgeGroup): RiskLevel {
    // Simple risk assessment based on adaptation type and age group
    const riskFactors = [];

    if (adaptation.type === AdaptationType.PERSONALITY_ADJUSTMENT && ageGroup === AgeGroup.CHILD) {
      riskFactors.push('personality_change_child');
    }

    if (adaptation.confidence < 0.7) {
      riskFactors.push('low_confidence');
    }

    if (adaptation.impact.behaviorChange === BehaviorChangeLevel.MAJOR) {
      riskFactors.push('major_behavior_change');
    }

    if (riskFactors.length >= 3) return RiskLevel.CRITICAL;
    if (riskFactors.length >= 2) return RiskLevel.HIGH;
    if (riskFactors.length >= 1) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private calculateMinAge(issues: ContentIssue[]): number {
    let minAge = 5; // Default minimum age

    for (const issue of issues) {
      switch (issue.issueType) {
        case ContentIssueType.INAPPROPRIATE_LANGUAGE:
          minAge = Math.max(minAge, 13);
          break;
        case ContentIssueType.ADULT_THEMES:
          minAge = Math.max(minAge, 18);
          break;
        case ContentIssueType.VIOLENT_CONTENT:
          minAge = Math.max(minAge, 16);
          break;
      }
    }

    return minAge;
  }

  private async triggerCriticalSafetyAlert(decision: SafetyDecision): Promise<void> {
    // In a real implementation, this would send alerts to parents/guardians
    console.warn(`CRITICAL SAFETY ALERT: ${decision.decisionId} for user ${decision.userId}`);
    
    // Log critical violation for immediate review
    const criticalViolations = decision.result.violations.filter(v => v.severity === ViolationSeverity.CRITICAL);
    for (const violation of criticalViolations) {
      console.error(`Critical violation: ${violation.description}`);
    }
  }

  private generateId(): string {
    return `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper interfaces
interface ChildSafetyRules {
  allowedContentTypes: ContentType[];
  allowedAdaptationTypes: AdaptationType[];
  minimumSafetyLevel: SafetyLevel;
  minimumConfidenceThreshold: number;
  maxDailyAdaptations: number;
  requiresConstantSupervision: boolean;
}

interface UserProfile {
  userId: string;
  ageGroup: AgeGroup;
  parentalControlsEnabled: boolean;
  supervisionLevel: string;
}