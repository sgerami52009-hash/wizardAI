/**
 * Safety Audit Logger - Comprehensive logging for all safety decisions
 * Safety: Maintains audit trail for parental review and compliance
 * Performance: Efficient logging with automatic cleanup and encryption
 */

import { EventEmitter } from 'events';
import { 
  SafetyAuditLogger, 
  SafetyAuditEntry, 
  AuditFilters, 
  TimeRange, 
  SafetyReport
} from './interfaces';
import { 
  SafetyConfiguration, 
  ParentalReviewRequest, 
  ParentalResponse,
  SafetyException,
  SafetyMetrics
} from '../models/safety-models';

export class SafetyAuditLoggerEngine extends EventEmitter implements SafetyAuditLogger {
  private auditEntries: Map<string, SafetyAuditEntry> = new Map();
  private parentalReviews: Map<string, ParentalReviewRequest> = new Map();
  private safetyExceptions: Map<string, SafetyException> = new Map();
  private configuration: SafetyConfiguration;
  private metrics: SafetyMetrics;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(configuration: SafetyConfiguration) {
    super();
    this.configuration = configuration;
    this.metrics = this.initializeMetrics();
    this.startCleanupTimer();
  }

  /**
   * Cleanup resources and stop timers
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.removeAllListeners();
  }

  /**
   * Log a safety event with comprehensive audit trail
   * Safety: ALL safety decisions MUST be logged for parental review
   */
  async logSafetyEvent(event: SafetyAuditEntry): Promise<void> {
    try {
      if (!event) {
        throw new Error('Event cannot be null or undefined');
      }

      // Encrypt sensitive content if configured
      const processedEvent = this.configuration.auditSettings.encryptLogs 
        ? await this.encryptSensitiveData(event)
        : event;

      // Store the audit entry
      this.auditEntries.set(event.id, processedEvent);

      // Update metrics
      this.updateMetrics(event);

      // Check if parental review is required
      if (event.parentalReview) {
        await this.createParentalReviewRequest(event);
      }

      // Emit event for real-time monitoring
      this.emit('safety_event_logged', {
        eventId: event.id,
        userId: event.userId,
        eventType: event.eventType,
        riskLevel: event.riskLevel,
        requiresReview: event.parentalReview
      });

      // Auto-purge old entries if needed
      await this.checkAndPurgeOldEntries();

    } catch (error) {
      this.emit('logging_error', { event, error });
      throw new Error(`Failed to log safety event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve audit history with filtering
   */
  async getAuditHistory(filters: AuditFilters): Promise<SafetyAuditEntry[]> {
    try {
      let entries = Array.from(this.auditEntries.values());

      // Apply filters
      if (filters.userId) {
        entries = entries.filter(entry => entry.userId === filters.userId);
      }

      if (filters.eventType) {
        entries = entries.filter(entry => entry.eventType === filters.eventType);
      }

      if (filters.riskLevel) {
        entries = entries.filter(entry => entry.riskLevel === filters.riskLevel);
      }

      if (filters.reviewStatus) {
        entries = entries.filter(entry => entry.reviewStatus === filters.reviewStatus);
      }

      // Apply time range filter
      entries = entries.filter(entry => 
        entry.timestamp >= filters.timeRange.start && 
        entry.timestamp <= filters.timeRange.end
      );

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return entries;

    } catch (error) {
      this.emit('audit_retrieval_error', { filters, error });
      return [];
    }
  }

  /**
   * Generate comprehensive safety report
   */
  async generateReport(timeRange: TimeRange, userId?: string): Promise<SafetyReport> {
    try {
      const filters: AuditFilters = {
        timeRange,
        userId
      };

      const entries = await this.getAuditHistory(filters);

      const report: SafetyReport = {
        timeRange,
        totalEvents: entries.length,
        eventsByType: this.groupByEventType(entries),
        eventsByRisk: this.groupByRiskLevel(entries),
        topBlockedReasons: this.getTopBlockedReasons(entries),
        userActivity: this.getUserActivity(entries),
        pendingReviews: Array.from(this.parentalReviews.values())
          .filter(review => review.status === 'pending').length
      };

      this.emit('report_generated', { report, userId });
      return report;

    } catch (error) {
      this.emit('report_generation_error', { timeRange, userId, error });
      throw new Error(`Failed to generate safety report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Purge old log entries based on retention policy
   */
  async purgeOldLogs(olderThan: Date): Promise<number> {
    try {
      const entriesToRemove: string[] = [];

      for (const [id, entry] of this.auditEntries) {
        if (entry.timestamp < olderThan) {
          entriesToRemove.push(id);
        }
      }

      // Remove old entries
      for (const id of entriesToRemove) {
        this.auditEntries.delete(id);
      }

      const purgedCount = entriesToRemove.length;
      
      this.emit('logs_purged', { 
        purgedCount, 
        remainingCount: this.auditEntries.size,
        olderThan 
      });

      return purgedCount;

    } catch (error) {
      this.emit('purge_error', { olderThan, error });
      return 0;
    }
  }

  /**
   * Create parental review request for blocked content
   */
  private async createParentalReviewRequest(event: SafetyAuditEntry): Promise<void> {
    const reviewRequest: ParentalReviewRequest = {
      id: this.generateId('review'),
      userId: event.userId,
      childId: event.userId,
      content: event.originalContent,
      violations: [], // Would be populated from event metadata
      context: `Safety event: ${event.eventType}`,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + (this.configuration.parentalControls.reviewTimeout * 60 * 60 * 1000)),
      priority: this.determinePriority(event.riskLevel),
      status: 'pending'
    };

    this.parentalReviews.set(reviewRequest.id, reviewRequest);

    // Notify parents if configured
    if (this.configuration.parentalControls.notificationMethods.length > 0) {
      this.emit('parental_review_requested', reviewRequest);
    }
  }

  /**
   * Process parental decision on review request
   */
  async processParentalDecision(
    requestId: string, 
    decision: 'approve' | 'reject' | 'modify',
    reason: string,
    modifications?: string
  ): Promise<void> {
    try {
      const reviewRequest = this.parentalReviews.get(requestId);
      if (!reviewRequest) {
        throw new Error(`Review request not found: ${requestId}`);
      }

      const response: ParentalResponse = {
        decision,
        reason,
        modifications,
        createException: decision === 'approve',
        respondedAt: new Date(),
        respondedBy: 'parent' // In production, this would be the actual parent ID
      };

      reviewRequest.parentResponse = response;
      reviewRequest.status = decision === 'approve' ? 'approved' : 'rejected';

      // Create safety exception if approved
      if (decision === 'approve' && response.createException) {
        await this.createSafetyException(reviewRequest);
      }

      this.emit('parental_decision_processed', { requestId, decision, reason });

    } catch (error) {
      this.emit('parental_decision_error', { requestId, error });
      throw error;
    }
  }

  /**
   * Create safety exception based on parental approval
   */
  private async createSafetyException(reviewRequest: ParentalReviewRequest): Promise<void> {
    const exception: SafetyException = {
      id: this.generateId('exception'),
      userId: reviewRequest.userId,
      pattern: this.extractPattern(reviewRequest.content),
      reason: reviewRequest.parentResponse?.reason || 'Parental approval',
      approvedBy: reviewRequest.parentResponse?.respondedBy || 'parent',
      createdAt: new Date(),
      expiresAt: reviewRequest.parentResponse?.exceptionDuration 
        ? new Date(Date.now() + (reviewRequest.parentResponse.exceptionDuration * 60 * 60 * 1000))
        : undefined,
      usageCount: 0,
      maxUsage: 10, // Default limit
      contexts: ['voice_interaction']
    };

    this.safetyExceptions.set(exception.id, exception);
    this.emit('safety_exception_created', exception);
  }

  /**
   * Get current safety metrics
   */
  getMetrics(): SafetyMetrics {
    return { ...this.metrics };
  }

  /**
   * Update metrics based on new safety event
   */
  private updateMetrics(event: SafetyAuditEntry): void {
    this.metrics.totalValidations++;

    switch (event.eventType) {
      case 'content_blocked':
        this.metrics.blockedContent++;
        break;
      case 'content_sanitized':
        this.metrics.sanitizedContent++;
        break;
    }

    // Update violation counts
    if (event.blockedReasons.length > 0) {
      for (const reason of event.blockedReasons) {
        this.metrics.violationsByType[reason] = (this.metrics.violationsByType[reason] || 0) + 1;
      }
    }

    // Update parental review metrics
    if (event.parentalReview) {
      this.metrics.parentalReviews.totalRequests++;
    }
  }

  /**
   * Encrypt sensitive data in audit entries
   */
  private async encryptSensitiveData(event: SafetyAuditEntry): Promise<SafetyAuditEntry> {
    // In production, this would use proper encryption
    // For now, just redact sensitive content
    return {
      ...event,
      originalContent: event.originalContent.length > 0 ? '[ENCRYPTED]' : '',
      processedContent: event.processedContent ? '[ENCRYPTED]' : undefined
    };
  }

  /**
   * Group audit entries by event type
   */
  private groupByEventType(entries: SafetyAuditEntry[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const entry of entries) {
      groups[entry.eventType] = (groups[entry.eventType] || 0) + 1;
    }
    return groups;
  }

  /**
   * Group audit entries by risk level
   */
  private groupByRiskLevel(entries: SafetyAuditEntry[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const entry of entries) {
      groups[entry.riskLevel] = (groups[entry.riskLevel] || 0) + 1;
    }
    return groups;
  }

  /**
   * Get top blocked reasons
   */
  private getTopBlockedReasons(entries: SafetyAuditEntry[]): Array<{ reason: string; count: number }> {
    const reasonCounts: Record<string, number> = {};
    
    for (const entry of entries) {
      for (const reason of entry.blockedReasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }

    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get user activity summary
   */
  private getUserActivity(entries: SafetyAuditEntry[]): Array<{ userId: string; eventCount: number }> {
    const userCounts: Record<string, number> = {};
    
    for (const entry of entries) {
      userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
    }

    return Object.entries(userCounts)
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount);
  }

  /**
   * Determine priority level for parental review
   */
  private determinePriority(riskLevel: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' | 'urgent' {
    switch (riskLevel) {
      case 'high': return 'urgent';
      case 'medium': return 'high';
      case 'low': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Extract pattern from content for exception creation
   */
  private extractPattern(content: string): string {
    // Simple pattern extraction - in production, this would be more sophisticated
    const words = content.toLowerCase().split(/\s+/);
    return words.slice(0, 3).join(' '); // Use first 3 words as pattern
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    this.cleanupTimer = setInterval(async () => {
      const retentionDate = new Date(Date.now() - (this.configuration.auditSettings.retentionPeriod * 24 * 60 * 60 * 1000));
      await this.purgeOldLogs(retentionDate);
    }, cleanupInterval);
  }

  /**
   * Check and purge old entries if memory usage is high
   */
  private async checkAndPurgeOldEntries(): Promise<void> {
    const maxEntries = 10000; // Maximum entries to keep in memory
    
    if (this.auditEntries.size > maxEntries) {
      const entries = Array.from(this.auditEntries.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const entriesToRemove = entries.slice(0, entries.length - maxEntries);
      
      for (const [id] of entriesToRemove) {
        this.auditEntries.delete(id);
      }

      this.emit('memory_cleanup', { 
        removedCount: entriesToRemove.length,
        remainingCount: this.auditEntries.size 
      });
    }
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): SafetyMetrics {
    return {
      totalValidations: 0,
      blockedContent: 0,
      sanitizedContent: 0,
      falsePositives: 0,
      falseNegatives: 0,
      averageProcessingTime: 0,
      accuracyByAgeGroup: {
        child: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 },
        teen: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 },
        adult: { totalChecks: 0, correctBlocks: 0, incorrectBlocks: 0, correctAllows: 0, incorrectAllows: 0, accuracy: 0, precision: 0, recall: 0 }
      },
      violationsByType: {},
      parentalReviews: {
        totalRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        pendingRequests: 0,
        averageResponseTime: 0,
        exceptionsCreated: 0
      }
    };
  }

  /**
   * Generate unique ID with prefix
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}