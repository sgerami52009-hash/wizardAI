/**
 * Parental Review Interface - UI components for parental oversight
 * Safety: Provides parents with visibility and control over child interactions
 * Performance: Efficient interface with real-time updates and notifications
 */

import { EventEmitter } from 'events';
import { 
  ParentalReviewRequest, 
  ParentalResponse, 
  SafetyAuditEntry,
  SafetyReport,
  AgeGroup 
} from '../models/safety-models';
import { SafetyAuditLoggerEngine } from './safety-audit-logger';
import { ParentalControlManagerEngine } from './parental-control-manager';

export interface ParentalReviewInterface {
  getPendingReviews(): Promise<ParentalReviewRequest[]>;
  getReviewDetails(requestId: string): Promise<ParentalReviewRequest | null>;
  approveRequest(requestId: string, reason: string, createException?: boolean): Promise<void>;
  rejectRequest(requestId: string, reason: string): Promise<void>;
  modifyAndApprove(requestId: string, modifications: string, reason: string): Promise<void>;
  getChildActivity(childId: string, timeRange: { start: Date; end: Date }): Promise<SafetyReport>;
  getSystemOverview(): Promise<ParentalDashboardData>;
  updateChildSafetyLevel(childId: string, level: AgeGroup): Promise<void>;
}

export interface ParentalDashboardData {
  totalChildren: number;
  pendingReviews: number;
  todayBlocked: number;
  weeklyTrends: {
    date: string;
    blockedContent: number;
    sanitizedContent: number;
    totalInteractions: number;
  }[];
  topBlockedReasons: Array<{ reason: string; count: number }>;
  childrenActivity: Array<{
    childId: string;
    name: string;
    ageGroup: AgeGroup;
    todayInteractions: number;
    blockedToday: number;
    lastActive: Date;
  }>;
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface ParentalNotification {
  id: string;
  type: 'review_request' | 'high_risk_content' | 'system_alert' | 'weekly_report';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  childId?: string;
  requestId?: string;
  timestamp: Date;
  read: boolean;
  actionRequired: boolean;
}

export class ParentalReviewInterfaceEngine extends EventEmitter implements ParentalReviewInterface {
  private auditLogger: SafetyAuditLoggerEngine;
  private parentalControls: ParentalControlManagerEngine;
  private notifications: Map<string, ParentalNotification> = new Map();
  private childProfiles: Map<string, ChildProfile> = new Map();

  constructor(
    auditLogger: SafetyAuditLoggerEngine,
    parentalControls: ParentalControlManagerEngine
  ) {
    super();
    this.auditLogger = auditLogger;
    this.parentalControls = parentalControls;
    this.setupEventHandlers();
    this.initializeChildProfiles();
  }

  /**
   * Get all pending review requests sorted by priority
   */
  async getPendingReviews(): Promise<ParentalReviewRequest[]> {
    try {
      const pendingReviews = await this.parentalControls.getPendingApprovals();
      
      // Sort by priority and timestamp
      return pendingReviews.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return a.requestedAt.getTime() - b.requestedAt.getTime(); // Older first
      });

    } catch (error) {
      this.emit('error', { operation: 'getPendingReviews', error });
      return [];
    }
  }

  /**
   * Get detailed information about a specific review request
   */
  async getReviewDetails(requestId: string): Promise<ParentalReviewRequest | null> {
    try {
      const pendingReviews = await this.parentalControls.getPendingApprovals();
      return pendingReviews.find(review => review.id === requestId) || null;

    } catch (error) {
      this.emit('error', { operation: 'getReviewDetails', requestId, error });
      return null;
    }
  }

  /**
   * Approve a review request
   */
  async approveRequest(requestId: string, reason: string, createException: boolean = false): Promise<void> {
    try {
      await this.parentalControls.processParentalDecision(requestId, true, reason);
      
      // Create notification for approval
      await this.createNotification({
        type: 'review_request',
        priority: 'low',
        title: 'Content Approved',
        message: `Content request ${requestId} has been approved. ${reason}`,
        requestId,
        actionRequired: false
      });

      this.emit('request_approved', { requestId, reason, createException });

    } catch (error) {
      this.emit('error', { operation: 'approveRequest', requestId, reason, error });
      throw new Error(`Failed to approve request: ${error.message}`);
    }
  }

  /**
   * Reject a review request
   */
  async rejectRequest(requestId: string, reason: string): Promise<void> {
    try {
      await this.parentalControls.processParentalDecision(requestId, false, reason);
      
      // Create notification for rejection
      await this.createNotification({
        type: 'review_request',
        priority: 'low',
        title: 'Content Rejected',
        message: `Content request ${requestId} has been rejected. ${reason}`,
        requestId,
        actionRequired: false
      });

      this.emit('request_rejected', { requestId, reason });

    } catch (error) {
      this.emit('error', { operation: 'rejectRequest', requestId, reason, error });
      throw new Error(`Failed to reject request: ${error.message}`);
    }
  }

  /**
   * Modify content and approve request
   */
  async modifyAndApprove(requestId: string, modifications: string, reason: string): Promise<void> {
    try {
      // Process as approval with modifications
      await this.parentalControls.processParentalDecision(requestId, true, reason);
      
      // Create notification for modification
      await this.createNotification({
        type: 'review_request',
        priority: 'medium',
        title: 'Content Modified and Approved',
        message: `Content request ${requestId} has been modified and approved. Modifications: ${modifications}`,
        requestId,
        actionRequired: false
      });

      this.emit('request_modified_approved', { requestId, modifications, reason });

    } catch (error) {
      this.emit('error', { operation: 'modifyAndApprove', requestId, modifications, reason, error });
      throw new Error(`Failed to modify and approve request: ${error.message}`);
    }
  }

  /**
   * Get child activity report
   */
  async getChildActivity(childId: string, timeRange: { start: Date; end: Date }): Promise<SafetyReport> {
    try {
      const report = await this.auditLogger.generateReport(timeRange, childId);
      
      this.emit('activity_report_generated', { childId, timeRange, report });
      return report;

    } catch (error) {
      this.emit('error', { operation: 'getChildActivity', childId, timeRange, error });
      throw new Error(`Failed to get child activity: ${error.message}`);
    }
  }

  /**
   * Get comprehensive dashboard data for parents
   */
  async getSystemOverview(): Promise<ParentalDashboardData> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get today's activity
      const todayReport = await this.auditLogger.generateReport({
        start: todayStart,
        end: now
      });

      // Get weekly trends
      const weeklyTrends = await this.generateWeeklyTrends(weekStart, now);

      // Get children activity
      const childrenActivity = await this.getChildrenActivity(todayStart, now);

      // Get system health
      const systemHealth = await this.getSystemHealth();

      const dashboardData: ParentalDashboardData = {
        totalChildren: this.childProfiles.size,
        pendingReviews: todayReport.pendingReviews,
        todayBlocked: todayReport.eventsByType['content_blocked'] || 0,
        weeklyTrends,
        topBlockedReasons: todayReport.topBlockedReasons,
        childrenActivity,
        systemHealth
      };

      this.emit('dashboard_data_generated', dashboardData);
      return dashboardData;

    } catch (error) {
      this.emit('error', { operation: 'getSystemOverview', error });
      throw new Error(`Failed to get system overview: ${error.message}`);
    }
  }

  /**
   * Update child safety level
   */
  async updateChildSafetyLevel(childId: string, level: AgeGroup): Promise<void> {
    try {
      await this.parentalControls.setUserSafetyLevel(childId, level);
      
      // Update child profile
      const profile = this.childProfiles.get(childId);
      if (profile) {
        profile.ageGroup = level;
        profile.lastUpdated = new Date();
      }

      // Create notification
      await this.createNotification({
        type: 'system_alert',
        priority: 'medium',
        title: 'Safety Level Updated',
        message: `Safety level for child ${childId} has been updated to ${level}`,
        childId,
        actionRequired: false
      });

      this.emit('safety_level_updated', { childId, level });

    } catch (error) {
      this.emit('error', { operation: 'updateChildSafetyLevel', childId, level, error });
      throw new Error(`Failed to update child safety level: ${error.message}`);
    }
  }

  /**
   * Get all notifications for parents
   */
  async getNotifications(unreadOnly: boolean = false): Promise<ParentalNotification[]> {
    const notifications = Array.from(this.notifications.values());
    
    const filtered = unreadOnly 
      ? notifications.filter(n => !n.read)
      : notifications;

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      this.emit('notification_read', { notificationId });
    }
  }

  /**
   * Create a new notification
   */
  private async createNotification(notification: Omit<ParentalNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const fullNotification: ParentalNotification = {
      ...notification,
      id: this.generateId('notification'),
      timestamp: new Date(),
      read: false
    };

    this.notifications.set(fullNotification.id, fullNotification);

    // Limit notification history
    if (this.notifications.size > 100) {
      const oldest = Array.from(this.notifications.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0];
      this.notifications.delete(oldest[0]);
    }

    this.emit('notification_created', fullNotification);
  }

  /**
   * Generate weekly trends data
   */
  private async generateWeeklyTrends(startDate: Date, endDate: Date): Promise<ParentalDashboardData['weeklyTrends']> {
    const trends: ParentalDashboardData['weeklyTrends'] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    for (let date = new Date(startDate); date <= endDate; date = new Date(date.getTime() + dayMs)) {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + dayMs - 1);

      const dayReport = await this.auditLogger.generateReport({
        start: dayStart,
        end: dayEnd
      });

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        blockedContent: dayReport.eventsByType['content_blocked'] || 0,
        sanitizedContent: dayReport.eventsByType['content_sanitized'] || 0,
        totalInteractions: dayReport.totalEvents
      });
    }

    return trends;
  }

  /**
   * Get children activity summary
   */
  private async getChildrenActivity(startDate: Date, endDate: Date): Promise<ParentalDashboardData['childrenActivity']> {
    const activity: ParentalDashboardData['childrenActivity'] = [];

    for (const [childId, profile] of this.childProfiles) {
      const childReport = await this.auditLogger.generateReport({
        start: startDate,
        end: endDate
      }, childId);

      activity.push({
        childId,
        name: profile.name,
        ageGroup: profile.ageGroup,
        todayInteractions: childReport.totalEvents,
        blockedToday: childReport.eventsByType['content_blocked'] || 0,
        lastActive: profile.lastActive
      });
    }

    return activity.sort((a, b) => b.todayInteractions - a.todayInteractions);
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealth(): Promise<ParentalDashboardData['systemHealth']> {
    // In production, this would gather real system metrics
    return {
      status: 'healthy',
      uptime: Date.now() - (24 * 60 * 60 * 1000), // 24 hours
      averageResponseTime: 50, // ms
      errorRate: 0.01 // 1%
    };
  }

  /**
   * Setup event handlers for real-time updates
   */
  private setupEventHandlers(): void {
    this.auditLogger.on('safety_event_logged', (event) => {
      this.handleSafetyEvent(event);
    });

    this.parentalControls.on('approval_requested', (event) => {
      this.createNotification({
        type: 'review_request',
        priority: event.priority,
        title: 'Content Review Required',
        message: `Child ${event.userId} has requested approval for content that was blocked.`,
        childId: event.userId,
        requestId: event.requestId,
        actionRequired: true
      });
    });

    this.parentalControls.on('safety_exception_created', (event) => {
      this.createNotification({
        type: 'system_alert',
        priority: 'low',
        title: 'Safety Exception Created',
        message: `A safety exception has been created for child ${event.userId}.`,
        childId: event.userId,
        actionRequired: false
      });
    });
  }

  /**
   * Handle safety events for real-time notifications
   */
  private async handleSafetyEvent(event: any): Promise<void> {
    if (event.riskLevel === 'high') {
      await this.createNotification({
        type: 'high_risk_content',
        priority: 'high',
        title: 'High Risk Content Detected',
        message: `High risk content was detected and blocked for child ${event.userId}.`,
        childId: event.userId,
        actionRequired: false
      });
    }

    // Update child profile last active time
    const profile = this.childProfiles.get(event.userId);
    if (profile) {
      profile.lastActive = new Date();
    }
  }

  /**
   * Initialize child profiles (in production, this would load from database)
   */
  private initializeChildProfiles(): void {
    // Sample child profiles - in production, these would be loaded from user database
    this.childProfiles.set('child_user_1', {
      name: 'Child 1',
      ageGroup: 'child',
      lastActive: new Date(),
      lastUpdated: new Date(),
      createdAt: new Date(),
      parentId: 'parent_1'
    });

    this.childProfiles.set('teen_user_1', {
      name: 'Teen 1',
      ageGroup: 'teen',
      lastActive: new Date(),
      lastUpdated: new Date(),
      createdAt: new Date(),
      parentId: 'parent_1'
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface ChildProfile {
  name: string;
  ageGroup: AgeGroup;
  lastActive: Date;
  lastUpdated: Date;
  createdAt: Date;
  parentId: string;
}