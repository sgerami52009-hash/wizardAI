/**
 * Parental Control Manager - Manages parental oversight and approval systems
 * Safety: Provides parents with control and visibility over child interactions
 * Performance: Efficient approval workflows with timeout handling
 */

import { EventEmitter } from 'events';
import { 
  ParentalControlManager, 
  ParentalOverride, 
  AgeGroup 
} from './interfaces';
import { 
  ParentalReviewRequest, 
  ParentalResponse, 
  SafetyException,
  ParentalControlConfiguration 
} from '../models/safety-models';

export class ParentalControlManagerEngine extends EventEmitter implements ParentalControlManager {
  private userAgeGroups: Map<string, AgeGroup> = new Map();
  private parentalOverrides: Map<string, ParentalOverride> = new Map();
  private pendingApprovals: Map<string, ParentalReviewRequest> = new Map();
  private safetyExceptions: Map<string, SafetyException> = new Map();
  private configuration: ParentalControlConfiguration;

  constructor(configuration: ParentalControlConfiguration) {
    super();
    this.configuration = configuration;
    this.startApprovalTimeoutMonitor();
  }

  /**
   * Set user safety level (age group)
   * Safety: Only authorized parents can modify child safety levels
   */
  async setUserSafetyLevel(userId: string, level: AgeGroup): Promise<void> {
    try {
      const previousLevel = this.userAgeGroups.get(userId);
      this.userAgeGroups.set(userId, level);

      // Log the change for audit purposes
      this.emit('safety_level_changed', {
        userId,
        previousLevel,
        newLevel: level,
        timestamp: new Date()
      });

      // If changing to more restrictive level, review existing exceptions
      if (this.isMoreRestrictive(level, previousLevel)) {
        await this.reviewExistingExceptions(userId, level);
      }

    } catch (error) {
      this.emit('safety_level_error', { userId, level, error });
      throw new Error(`Failed to set safety level for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Get user safety level
   */
  async getUserSafetyLevel(userId: string): Promise<AgeGroup> {
    return this.userAgeGroups.get(userId) || 'child'; // Default to most restrictive
  }

  /**
   * Request parental approval for blocked content
   * Safety: All high-risk content requires explicit parental approval
   */
  async requestParentalApproval(content: string, userId: string): Promise<string> {
    try {
      const requestId = this.generateId('approval');
      const userAgeGroup = await this.getUserSafetyLevel(userId);

      const reviewRequest: ParentalReviewRequest = {
        id: requestId,
        userId,
        childId: userId,
        content,
        violations: [], // Would be populated by calling system
        context: 'Content approval request',
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + (this.configuration.reviewTimeout * 60 * 60 * 1000)),
        priority: this.determinePriority(content, userAgeGroup),
        status: 'pending'
      };

      this.pendingApprovals.set(requestId, reviewRequest);

      // Notify parents through configured channels
      await this.notifyParents(reviewRequest);

      this.emit('approval_requested', {
        requestId,
        userId,
        content: content.substring(0, 100), // Truncate for logging
        priority: reviewRequest.priority
      });

      return requestId;

    } catch (error) {
      this.emit('approval_request_error', { userId, content, error });
      throw new Error(`Failed to request parental approval: ${error.message}`);
    }
  }

  /**
   * Process parental decision on approval request
   */
  async processParentalDecision(
    requestId: string, 
    approved: boolean, 
    reason?: string
  ): Promise<void> {
    try {
      const request = this.pendingApprovals.get(requestId);
      if (!request) {
        throw new Error(`Approval request not found: ${requestId}`);
      }

      const response: ParentalResponse = {
        decision: approved ? 'approve' : 'reject',
        reason: reason || (approved ? 'Approved by parent' : 'Rejected by parent'),
        respondedAt: new Date(),
        respondedBy: 'parent', // In production, this would be the actual parent ID
        createException: approved
      };

      request.parentResponse = response;
      request.status = approved ? 'approved' : 'rejected';

      // Create safety exception if approved
      if (approved) {
        await this.createSafetyExceptionFromRequest(request);
      }

      // Remove from pending approvals
      this.pendingApprovals.delete(requestId);

      this.emit('parental_decision', {
        requestId,
        approved,
        reason,
        userId: request.userId
      });

    } catch (error) {
      this.emit('parental_decision_error', { requestId, approved, reason, error });
      throw error;
    }
  }

  /**
   * Get parental overrides for a user
   */
  async getParentalOverrides(userId: string): Promise<ParentalOverride[]> {
    const overrides = Array.from(this.parentalOverrides.values())
      .filter(override => override.userId === userId);

    // Filter out expired overrides
    const now = new Date();
    return overrides.filter(override => 
      !override.expiresAt || override.expiresAt > now
    );
  }

  /**
   * Create safety exception for approved content
   */
  async createSafetyException(pattern: string, userId: string, reason: string): Promise<void> {
    try {
      const exception: SafetyException = {
        id: this.generateId('exception'),
        userId,
        pattern,
        reason,
        approvedBy: 'parent',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days default
        usageCount: 0,
        maxUsage: 10,
        contexts: ['voice_interaction']
      };

      this.safetyExceptions.set(exception.id, exception);

      this.emit('safety_exception_created', {
        exceptionId: exception.id,
        userId,
        pattern,
        reason
      });

    } catch (error) {
      this.emit('safety_exception_error', { pattern, userId, reason, error });
      throw error;
    }
  }

  /**
   * Check if content matches any existing safety exceptions
   */
  async checkSafetyExceptions(content: string, userId: string): Promise<SafetyException | null> {
    const userExceptions = Array.from(this.safetyExceptions.values())
      .filter(exception => exception.userId === userId);

    for (const exception of userExceptions) {
      // Check if exception is still valid
      if (exception.expiresAt && exception.expiresAt < new Date()) {
        continue;
      }

      if (exception.maxUsage && exception.usageCount >= exception.maxUsage) {
        continue;
      }

      // Simple pattern matching - in production, this would be more sophisticated
      if (content.toLowerCase().includes(exception.pattern.toLowerCase())) {
        // Increment usage count
        exception.usageCount++;
        return exception;
      }
    }

    return null;
  }

  /**
   * Get pending approval requests for parents
   */
  async getPendingApprovals(parentId?: string): Promise<ParentalReviewRequest[]> {
    const pending = Array.from(this.pendingApprovals.values())
      .filter(request => request.status === 'pending');

    // Sort by priority and timestamp
    return pending.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return a.requestedAt.getTime() - b.requestedAt.getTime(); // Older first
    });
  }

  /**
   * Auto-approve requests after timeout if configured
   */
  private async handleApprovalTimeout(requestId: string): Promise<void> {
    const request = this.pendingApprovals.get(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }

    if (this.configuration.autoApproveAfterTimeout) {
      await this.processParentalDecision(requestId, true, 'Auto-approved after timeout');
      this.emit('auto_approved', { requestId, userId: request.userId });
    } else {
      await this.processParentalDecision(requestId, false, 'Rejected due to timeout');
      this.emit('timeout_rejected', { requestId, userId: request.userId });
    }
  }

  /**
   * Create safety exception from approved request
   */
  private async createSafetyExceptionFromRequest(request: ParentalReviewRequest): Promise<void> {
    const pattern = this.extractPattern(request.content);
    const duration = request.parentResponse?.exceptionDuration || 24; // Default 24 hours

    const exception: SafetyException = {
      id: this.generateId('exception'),
      userId: request.userId,
      pattern,
      reason: request.parentResponse?.reason || 'Parental approval',
      approvedBy: request.parentResponse?.respondedBy || 'parent',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (duration * 60 * 60 * 1000)),
      usageCount: 0,
      maxUsage: 5, // Conservative limit for exceptions
      contexts: ['voice_interaction']
    };

    this.safetyExceptions.set(exception.id, exception);

    this.emit('safety_exception_created', {
      exceptionId: exception.id,
      userId: request.userId,
      pattern,
      duration
    });
  }

  /**
   * Notify parents of approval requests
   */
  private async notifyParents(request: ParentalReviewRequest): Promise<void> {
    // In production, this would send actual notifications
    // For now, just emit events that can be handled by notification systems
    
    for (const method of this.configuration.notificationMethods) {
      this.emit('parent_notification', {
        method,
        requestId: request.id,
        userId: request.userId,
        priority: request.priority,
        content: request.content.substring(0, 100) // Truncate for notification
      });
    }
  }

  /**
   * Determine priority based on content and user age
   */
  private determinePriority(content: string, ageGroup: AgeGroup): 'low' | 'medium' | 'high' | 'urgent' {
    // Simple priority determination - in production, this would be more sophisticated
    const urgentKeywords = ['danger', 'harm', 'weapon', 'drug'];
    const highKeywords = ['adult', 'mature', 'violence'];
    
    const lowerContent = content.toLowerCase();
    
    if (urgentKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'urgent';
    }
    
    if (highKeywords.some(keyword => lowerContent.includes(keyword))) {
      return ageGroup === 'child' ? 'high' : 'medium';
    }
    
    return ageGroup === 'child' ? 'medium' : 'low';
  }

  /**
   * Check if new age group is more restrictive than previous
   */
  private isMoreRestrictive(newLevel: AgeGroup, previousLevel?: AgeGroup): boolean {
    if (!previousLevel) return false;
    
    const restrictionLevels = { child: 3, teen: 2, adult: 1 };
    return restrictionLevels[newLevel] > restrictionLevels[previousLevel];
  }

  /**
   * Review existing exceptions when safety level becomes more restrictive
   */
  private async reviewExistingExceptions(userId: string, newLevel: AgeGroup): Promise<void> {
    const userExceptions = Array.from(this.safetyExceptions.values())
      .filter(exception => exception.userId === userId);

    for (const exception of userExceptions) {
      // For child level, remove all exceptions for review
      if (newLevel === 'child') {
        this.safetyExceptions.delete(exception.id);
        this.emit('exception_revoked', {
          exceptionId: exception.id,
          userId,
          reason: 'Safety level changed to child'
        });
      }
    }
  }

  /**
   * Extract pattern from content for exception creation
   */
  private extractPattern(content: string): string {
    // Simple pattern extraction - in production, this would be more sophisticated
    const words = content.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    return words.slice(0, 2).join(' '); // Use first 2 meaningful words
  }

  /**
   * Start monitoring for approval timeouts
   */
  private startApprovalTimeoutMonitor(): void {
    const checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    
    setInterval(() => {
      const now = new Date();
      
      for (const [requestId, request] of this.pendingApprovals) {
        if (request.status === 'pending' && request.expiresAt < now) {
          this.handleApprovalTimeout(requestId);
        }
      }
    }, checkInterval);
  }

  /**
   * Generate unique ID with prefix
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics for monitoring
   */
  getSystemStats(): {
    totalUsers: number;
    pendingApprovals: number;
    activeExceptions: number;
    usersByAgeGroup: Record<AgeGroup, number>;
  } {
    const usersByAgeGroup: Record<AgeGroup, number> = { child: 0, teen: 0, adult: 0 };
    
    for (const ageGroup of this.userAgeGroups.values()) {
      usersByAgeGroup[ageGroup]++;
    }

    return {
      totalUsers: this.userAgeGroups.size,
      pendingApprovals: this.pendingApprovals.size,
      activeExceptions: this.safetyExceptions.size,
      usersByAgeGroup
    };
  }
}