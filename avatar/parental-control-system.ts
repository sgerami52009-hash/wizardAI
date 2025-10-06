import {
  AvatarCustomization,
  SafetyValidationResult,
  ParentalDecision,
  ReviewRequest,
  SafetyAuditEntry,
  TimeRange,
  RiskLevel,
  ParentalDashboard,
  ChildSafetyMetrics,
  ParentalRecommendation
} from './types';

import { ParentalControlManagerImpl } from '../learning/parental-control-manager';
import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';

/**
 * Avatar-specific parental control system
 * Manages parental approval workflows, customization review interface,
 * and decision processing for avatar customizations
 */
export class AvatarParentalControlSystem {
  private readonly parentalControlManager: ParentalControlManagerImpl;
  private readonly safetyValidator: EnhancedAvatarSafetyValidator;
  private readonly pendingReviews: Map<string, ReviewRequest> = new Map();
  private readonly approvalDecisions: Map<string, ParentalDecision> = new Map();
  private readonly auditLog: SafetyAuditEntry[] = [];
  private readonly notificationQueue: ParentalNotification[] = [];

  constructor(
    parentalControlManager?: ParentalControlManagerImpl,
    safetyValidator?: EnhancedAvatarSafetyValidator
  ) {
    this.parentalControlManager = parentalControlManager || new ParentalControlManagerImpl();
    this.safetyValidator = safetyValidator || new EnhancedAvatarSafetyValidator();
  }

  /**
   * Creates parental approval workflow for child customizations
   * Implements child-friendly notification system and parent dashboard integration
   */
  async createApprovalWorkflow(
    childId: string,
    customization: AvatarCustomization,
    validationResult: SafetyValidationResult
  ): Promise<ReviewRequest> {
    const reviewId = this.generateReviewId();
    const parentId = await this.getParentId(childId);
    const urgency = this.determineUrgency(validationResult);

    const reviewRequest: ReviewRequest = {
      reviewId,
      userId: childId,
      customization,
      submittedAt: new Date(),
      status: 'pending',
      safetyAssessment: validationResult
    };

    // Store pending review
    this.pendingReviews.set(reviewId, reviewRequest);

    // Create parental notification
    await this.createParentalNotification(parentId, reviewRequest, urgency);

    // Notify child about submission (child-friendly message)
    await this.notifyChildOfSubmission(childId, reviewId);

    // Log workflow creation
    await this.logWorkflowEvent('approval_workflow_created', childId, {
      reviewId,
      riskLevel: validationResult.riskAssessment,
      blockedElements: validationResult.blockedElements
    });

    return reviewRequest;
  }

  /**
   * Implements customization review interface for parents
   * Provides detailed safety assessment and recommendation system
   */
  async getCustomizationReviewInterface(reviewId: string, parentId: string): Promise<CustomizationReviewInterface> {
    const reviewRequest = this.pendingReviews.get(reviewId);
    if (!reviewRequest) {
      throw new Error(`Review request ${reviewId} not found`);
    }

    // Verify parental authority
    await this.verifyParentalAuthority(parentId, reviewRequest.userId);

    // Generate detailed safety analysis
    const safetyAnalysis = await this.generateSafetyAnalysis(reviewRequest.customization, reviewRequest.userId);

    // Get age-appropriate recommendations
    const recommendations = await this.generateParentalRecommendations(reviewRequest);

    // Create comparison with current avatar
    const currentAvatar = await this.getCurrentAvatarConfiguration(reviewRequest.userId);
    const changeComparison = this.generateChangeComparison(currentAvatar, reviewRequest.customization);

    return {
      reviewId,
      childId: reviewRequest.userId,
      submittedAt: reviewRequest.submittedAt,
      customization: reviewRequest.customization,
      safetyAssessment: reviewRequest.safetyAssessment,
      safetyAnalysis,
      recommendations,
      changeComparison,
      suggestedActions: this.generateSuggestedActions(reviewRequest.safetyAssessment),
      estimatedReviewTime: this.estimateReviewTime(reviewRequest.safetyAssessment)
    };
  }

  /**
   * Processes approval decisions with comprehensive notification system
   */
  async processApprovalDecision(
    reviewId: string,
    parentId: string,
    approved: boolean,
    reason?: string,
    conditions?: ApprovalCondition[]
  ): Promise<void> {
    const reviewRequest = this.pendingReviews.get(reviewId);
    if (!reviewRequest) {
      throw new Error(`Review request ${reviewId} not found`);
    }

    // Verify parental authority
    await this.verifyParentalAuthority(parentId, reviewRequest.userId);

    const decision: ParentalDecision = {
      reviewId,
      parentId,
      approved,
      reason,
      timestamp: new Date()
    };

    // Store decision
    this.approvalDecisions.set(reviewId, decision);

    // Update review status
    reviewRequest.status = approved ? 'approved' : 'rejected';
    this.pendingReviews.set(reviewId, reviewRequest);

    // Process the decision
    if (approved) {
      await this.applyApprovedCustomization(reviewRequest, conditions);
      await this.notifyChildOfApproval(reviewRequest.userId, reviewId, reason);
    } else {
      await this.notifyChildOfRejection(reviewRequest.userId, reviewId, reason);
      await this.suggestAlternatives(reviewRequest.userId, reviewRequest.customization);
    }

    // Log decision
    await this.logApprovalDecision(decision, reviewRequest);

    // Update parental dashboard
    await this.updateParentalDashboard(parentId, reviewRequest.userId);

    // Send confirmation to parent
    await this.sendParentalConfirmation(parentId, decision);
  }

  /**
   * Creates comprehensive audit logging for all safety decisions and parental actions
   */
  async createAuditLog(
    action: string,
    userId: string,
    details: any,
    riskLevel: RiskLevel = 'low'
  ): Promise<void> {
    const auditEntry: SafetyAuditEntry = {
      timestamp: new Date(),
      userId,
      action,
      details: this.sanitizeAuditData(details),
      riskLevel
    };

    this.auditLog.push(auditEntry);

    // Store in persistent storage (in real implementation)
    await this.persistAuditEntry(auditEntry);

    // Check for audit alerts
    await this.checkAuditAlerts(auditEntry);
  }

  /**
   * Gets parental dashboard with child activity overview
   */
  async getParentalDashboard(parentId: string): Promise<ParentalDashboard[]> {
    const children = await this.getChildrenForParent(parentId);
    const dashboards: ParentalDashboard[] = [];

    for (const childId of children) {
      const recentActivity = await this.getRecentActivity(childId);
      const pendingApprovals = await this.getPendingApprovalsForChild(childId);
      const safetyMetrics = await this.getChildSafetyMetrics(childId);
      const recommendations = await this.getParentalRecommendations(childId);

      dashboards.push({
        childId,
        recentActivity,
        pendingApprovals,
        safetyMetrics,
        recommendations
      });
    }

    return dashboards;
  }

  /**
   * Gets pending approval requests for a parent
   */
  async getPendingApprovals(parentId: string): Promise<ReviewRequest[]> {
    const children = await this.getChildrenForParent(parentId);
    const pendingApprovals: ReviewRequest[] = [];

    for (const [reviewId, request] of this.pendingReviews.entries()) {
      if (children.includes(request.userId) && request.status === 'pending') {
        pendingApprovals.push(request);
      }
    }

    // Sort by urgency and submission time
    return pendingApprovals.sort((a, b) => {
      const urgencyA = this.determineUrgency(a.safetyAssessment);
      const urgencyB = this.determineUrgency(b.safetyAssessment);
      
      if (urgencyA !== urgencyB) {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[urgencyB] - urgencyOrder[urgencyA];
      }
      
      return b.submittedAt.getTime() - a.submittedAt.getTime();
    });
  }

  /**
   * Bulk approval/rejection for multiple requests
   */
  async processBulkDecisions(
    parentId: string,
    decisions: BulkDecision[]
  ): Promise<BulkDecisionResult> {
    const results: DecisionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const decision of decisions) {
      try {
        await this.processApprovalDecision(
          decision.reviewId,
          parentId,
          decision.approved,
          decision.reason,
          decision.conditions
        );
        
        results.push({
          reviewId: decision.reviewId,
          success: true,
          message: 'Decision processed successfully'
        });
        successCount++;
      } catch (error) {
        results.push({
          reviewId: decision.reviewId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        });
        failureCount++;
      }
    }

    return {
      totalProcessed: decisions.length,
      successCount,
      failureCount,
      results
    };
  }

  // Private helper methods

  private async createParentalNotification(
    parentId: string,
    reviewRequest: ReviewRequest,
    urgency: 'low' | 'medium' | 'high'
  ): Promise<void> {
    const notification: ParentalNotification = {
      id: this.generateNotificationId(),
      parentId,
      type: 'avatar_approval_request',
      title: 'Avatar Customization Approval Needed',
      message: this.generateParentalNotificationMessage(reviewRequest),
      urgency,
      reviewId: reviewRequest.reviewId,
      childId: reviewRequest.userId,
      createdAt: new Date(),
      read: false
    };

    this.notificationQueue.push(notification);

    // Send notification through various channels
    await this.sendPushNotification(notification);
    await this.sendEmailNotification(notification);
    await this.updateParentDashboard(parentId);
  }

  private async notifyChildOfSubmission(childId: string, reviewId: string): Promise<void> {
    const childFriendlyMessage = "Great job customizing your avatar! " +
      "We've sent your choices to your parent for approval. " +
      "You'll hear back soon!";

    await this.sendChildNotification(childId, {
      type: 'info',
      title: 'Avatar Sent for Approval',
      message: childFriendlyMessage,
      reviewId
    });
  }

  private async notifyChildOfApproval(childId: string, reviewId: string, reason?: string): Promise<void> {
    const childFriendlyMessage = "Awesome! Your parent approved your avatar customization. " +
      "Your new avatar is ready to use!";

    await this.sendChildNotification(childId, {
      type: 'success',
      title: 'Avatar Approved!',
      message: childFriendlyMessage,
      reviewId
    });
  }

  private async notifyChildOfRejection(childId: string, reviewId: string, reason?: string): Promise<void> {
    const childFriendlyMessage = "Your parent would like you to try different avatar options. " +
      "Don't worry - let's find something even better together!";

    await this.sendChildNotification(childId, {
      type: 'info',
      title: 'Let\'s Try Again',
      message: childFriendlyMessage,
      reviewId,
      actionButton: 'Try New Options'
    });
  }

  private async suggestAlternatives(childId: string, rejectedCustomization: AvatarCustomization): Promise<void> {
    // Generate age-appropriate alternatives based on what was rejected
    const alternatives = await this.generateAlternativeCustomizations(childId, rejectedCustomization);
    
    await this.sendChildNotification(childId, {
      type: 'suggestion',
      title: 'Here are some fun alternatives!',
      message: 'We found some great options you might like even more!',
      alternatives
    });
  }

  private determineUrgency(validationResult: SafetyValidationResult): 'low' | 'medium' | 'high' {
    if (validationResult.riskAssessment === 'high') return 'high';
    if (validationResult.blockedElements.length > 3) return 'medium';
    return 'low';
  }

  private generateParentalNotificationMessage(reviewRequest: ReviewRequest): string {
    const childAge = this.getChildAge(reviewRequest.userId);
    const riskLevel = reviewRequest.safetyAssessment.riskAssessment;
    
    if (riskLevel === 'high') {
      return `Your child has requested avatar changes that need careful review. ` +
             `Some content may not be age-appropriate.`;
    }
    
    return `Your child has customized their avatar and is waiting for your approval. ` +
           `The changes look good but need your OK to proceed.`;
  }

  private async generateSafetyAnalysis(customization: AvatarCustomization, childId: string): Promise<SafetyAnalysis> {
    const childAge = this.getChildAge(childId);
    const currentAvatar = await this.getCurrentAvatarConfiguration(childId);
    
    return {
      overallSafety: 'safe', // This would be calculated based on validation
      ageAppropriateness: 'appropriate',
      contentConcerns: [],
      positiveAspects: ['Creative expression', 'Age-appropriate choices'],
      comparisonWithCurrent: 'Similar safety level',
      recommendedAction: 'approve'
    };
  }

  private async generateParentalRecommendations(reviewRequest: ReviewRequest): Promise<ParentalRecommendation[]> {
    const recommendations: ParentalRecommendation[] = [];
    
    if (reviewRequest.safetyAssessment.riskAssessment === 'low') {
      recommendations.push({
        type: 'safety',
        priority: 'low',
        description: 'This customization appears safe and age-appropriate',
        actionRequired: false
      });
    }
    
    return recommendations;
  }

  private generateChangeComparison(current: AvatarCustomization | null, proposed: AvatarCustomization): ChangeComparison {
    if (!current) {
      return {
        isFirstCustomization: true,
        changedAspects: ['appearance', 'personality', 'voice'],
        significantChanges: [],
        minorChanges: ['Initial avatar setup']
      };
    }

    // Compare configurations and identify changes
    const changedAspects: string[] = [];
    const significantChanges: string[] = [];
    const minorChanges: string[] = [];

    // This would contain detailed comparison logic
    return {
      isFirstCustomization: false,
      changedAspects,
      significantChanges,
      minorChanges
    };
  }

  private generateSuggestedActions(safetyAssessment: SafetyValidationResult): SuggestedAction[] {
    const actions: SuggestedAction[] = [];
    
    if (safetyAssessment.riskAssessment === 'low') {
      actions.push({
        action: 'approve',
        description: 'Approve this safe customization',
        priority: 'high',
        reasoning: 'No safety concerns detected'
      });
    } else {
      actions.push({
        action: 'review_carefully',
        description: 'Review blocked elements carefully',
        priority: 'high',
        reasoning: 'Some content may need adjustment'
      });
    }
    
    return actions;
  }

  private estimateReviewTime(safetyAssessment: SafetyValidationResult): number {
    // Return estimated review time in minutes
    if (safetyAssessment.riskAssessment === 'high') return 10;
    if (safetyAssessment.riskAssessment === 'medium') return 5;
    return 2;
  }

  private async applyApprovedCustomization(reviewRequest: ReviewRequest, conditions?: ApprovalCondition[]): Promise<void> {
    // Apply the approved customization to the child's avatar
    console.log(`Applying approved customization for child ${reviewRequest.userId}`);
    
    if (conditions && conditions.length > 0) {
      console.log(`Applying conditions: ${conditions.map(c => c.description).join(', ')}`);
    }
  }

  private async logWorkflowEvent(action: string, userId: string, details: any): Promise<void> {
    await this.createAuditLog(action, userId, details);
  }

  private async logApprovalDecision(decision: ParentalDecision, reviewRequest: ReviewRequest): Promise<void> {
    await this.createAuditLog(
      decision.approved ? 'parental_approval_granted' : 'parental_approval_denied',
      decision.parentId,
      {
        reviewId: decision.reviewId,
        childId: reviewRequest.userId,
        reason: decision.reason,
        riskLevel: reviewRequest.safetyAssessment.riskAssessment
      },
      decision.approved ? 'low' : 'medium'
    );
  }

  private sanitizeAuditData(data: any): any {
    // Remove PII and sensitive information before logging
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('personal')) {
        return '[REDACTED]';
      }
      return value;
    }));
  }

  private async persistAuditEntry(entry: SafetyAuditEntry): Promise<void> {
    // In real implementation, this would persist to encrypted storage
    console.log(`Persisting audit entry: ${entry.action} for user ${entry.userId}`);
  }

  private async checkAuditAlerts(entry: SafetyAuditEntry): Promise<void> {
    // Check for patterns that require immediate attention
    if (entry.riskLevel === 'high') {
      console.log(`High-risk audit entry detected: ${entry.action}`);
    }
  }

  // Additional helper methods...
  private generateReviewId(): string {
    return `avatar_review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getParentId(childId: string): Promise<string> {
    // In real implementation, this would look up the parent ID
    return `parent_of_${childId}`;
  }

  private async verifyParentalAuthority(parentId: string, childId: string): Promise<void> {
    // In real implementation, this would verify the parent-child relationship
    console.log(`Verifying parental authority: ${parentId} for child ${childId}`);
  }

  private async getCurrentAvatarConfiguration(userId: string): Promise<AvatarCustomization | null> {
    // In real implementation, this would fetch current avatar configuration
    return null;
  }

  private getChildAge(childId: string): number {
    // In real implementation, this would look up the child's age
    return 10; // Mock age
  }

  private async getChildrenForParent(parentId: string): Promise<string[]> {
    // In real implementation, this would look up children for the parent
    return [`child_of_${parentId}`];
  }

  private async getRecentActivity(childId: string): Promise<SafetyAuditEntry[]> {
    const timeRange: TimeRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: new Date()
    };
    
    return this.auditLog.filter(entry => 
      entry.userId === childId &&
      entry.timestamp >= timeRange.start &&
      entry.timestamp <= timeRange.end
    );
  }

  private async getPendingApprovalsForChild(childId: string): Promise<ReviewRequest[]> {
    return Array.from(this.pendingReviews.values())
      .filter(request => request.userId === childId && request.status === 'pending');
  }

  private async getChildSafetyMetrics(childId: string): Promise<ChildSafetyMetrics> {
    // In real implementation, this would calculate actual metrics
    return {
      safetyScore: 0.95,
      violationCount: 0,
      parentalInterventions: 1,
      complianceRate: 0.98,
      riskLevel: 'low'
    };
  }

  private async getParentalRecommendations(childId: string): Promise<ParentalRecommendation[]> {
    return [
      {
        type: 'safety',
        priority: 'low',
        description: 'Consider reviewing avatar customization settings',
        actionRequired: false,
        targetChild: childId
      }
    ];
  }

  private async sendPushNotification(notification: ParentalNotification): Promise<void> {
    console.log(`Sending push notification to parent ${notification.parentId}: ${notification.title}`);
  }

  private async sendEmailNotification(notification: ParentalNotification): Promise<void> {
    console.log(`Sending email notification to parent ${notification.parentId}: ${notification.title}`);
  }

  private async updateParentDashboard(parentId: string): Promise<void> {
    console.log(`Updating parent dashboard for ${parentId}`);
  }

  private async sendChildNotification(childId: string, notification: ChildNotification): Promise<void> {
    console.log(`Sending child notification to ${childId}: ${notification.title}`);
  }

  private async generateAlternativeCustomizations(childId: string, rejectedCustomization: AvatarCustomization): Promise<AvatarCustomization[]> {
    // In real implementation, this would generate safe alternatives
    return [];
  }

  private async sendParentalConfirmation(parentId: string, decision: ParentalDecision): Promise<void> {
    const message = decision.approved ? 
      'Your approval has been processed and your child has been notified.' :
      'Your feedback has been sent to your child with suggestions for alternatives.';
    
    console.log(`Sending confirmation to parent ${parentId}: ${message}`);
  }

  private async updateParentalDashboard(parentId: string, childId: string): Promise<void> {
    console.log(`Updating parental dashboard for ${parentId} regarding child ${childId}`);
  }
}

// Supporting interfaces for the parental control system
interface CustomizationReviewInterface {
  reviewId: string;
  childId: string;
  submittedAt: Date;
  customization: AvatarCustomization;
  safetyAssessment: SafetyValidationResult;
  safetyAnalysis: SafetyAnalysis;
  recommendations: ParentalRecommendation[];
  changeComparison: ChangeComparison;
  suggestedActions: SuggestedAction[];
  estimatedReviewTime: number;
}

interface SafetyAnalysis {
  overallSafety: 'safe' | 'caution' | 'unsafe';
  ageAppropriateness: 'appropriate' | 'questionable' | 'inappropriate';
  contentConcerns: string[];
  positiveAspects: string[];
  comparisonWithCurrent: string;
  recommendedAction: 'approve' | 'modify' | 'reject';
}

interface ChangeComparison {
  isFirstCustomization: boolean;
  changedAspects: string[];
  significantChanges: string[];
  minorChanges: string[];
}

interface SuggestedAction {
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  reasoning: string;
}

interface ApprovalCondition {
  type: string;
  description: string;
  required: boolean;
}

interface ParentalNotification {
  id: string;
  parentId: string;
  type: string;
  title: string;
  message: string;
  urgency: 'low' | 'medium' | 'high';
  reviewId: string;
  childId: string;
  createdAt: Date;
  read: boolean;
}

interface ChildNotification {
  type: 'info' | 'success' | 'warning' | 'suggestion';
  title: string;
  message: string;
  reviewId?: string;
  actionButton?: string;
  alternatives?: AvatarCustomization[];
}

interface BulkDecision {
  reviewId: string;
  approved: boolean;
  reason?: string;
  conditions?: ApprovalCondition[];
}

interface BulkDecisionResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: DecisionResult[];
}

interface DecisionResult {
  reviewId: string;
  success: boolean;
  message: string;
}