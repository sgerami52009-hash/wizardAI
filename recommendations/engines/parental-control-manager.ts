/**
 * Parental Control Manager
 * 
 * Manages parental oversight, approval workflows, and control mechanisms
 * for educational recommendations with strict child safety compliance.
 */

import { EducationalRecommendation } from '../interfaces';
import {
  ParentalPreferences,
  UserPreferences,
  EducationalContent,
  LearningResults,
  AgeRange,
  NotificationPreferences
} from '../types';
import { Subject, SafetyLevel, SkillLevel } from '../enums';

export interface ParentalApprovalRequest {
  id: string;
  childId: string;
  parentId: string;
  recommendation: EducationalRecommendation;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  parentNotes?: string;
  autoApprovalReason?: string;
}

export interface ParentalNotification {
  id: string;
  parentId: string;
  childId: string;
  type: 'approval_request' | 'progress_update' | 'safety_alert' | 'achievement';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  read: boolean;
  actionRequired: boolean;
  relatedRecommendationId?: string;
}

export interface ParentalControlSettings {
  parentId: string;
  childId: string;
  autoApprovalEnabled: boolean;
  autoApprovalCriteria: AutoApprovalCriteria;
  restrictedSubjects: Subject[];
  allowedSubjects: Subject[];
  maxDailyScreenTime: number; // minutes
  maxSessionDuration: number; // minutes
  requireApprovalForNewContent: boolean;
  requireApprovalForAdvancedContent: boolean;
  allowPeerInteraction: boolean;
  contentFilteringLevel: 'strict' | 'moderate' | 'relaxed';
  notificationPreferences: ParentalNotificationPreferences;
  emergencyContacts: string[];
}

export interface AutoApprovalCriteria {
  trustedContentSources: string[];
  maxDifficultyLevel: SkillLevel;
  allowedContentTypes: string[];
  maxDuration: number; // minutes
  safetyLevelThreshold: SafetyLevel;
  subjectRestrictions: Subject[];
}

export interface ParentalNotificationPreferences {
  immediateNotification: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  achievementAlerts: boolean;
  safetyAlerts: boolean;
  progressUpdates: boolean;
  channels: ('email' | 'voice' | 'avatar' | 'app')[];
  quietHours: { start: string; end: string };
}

export interface ParentalReviewSession {
  id: string;
  parentId: string;
  childId: string;
  startTime: Date;
  endTime?: Date;
  reviewedRecommendations: string[];
  approvedCount: number;
  rejectedCount: number;
  notes: string[];
  followUpRequired: boolean;
}

export class ParentalControlManager {
  private approvalRequests: Map<string, ParentalApprovalRequest> = new Map();
  private notifications: Map<string, ParentalNotification[]> = new Map();
  private controlSettings: Map<string, ParentalControlSettings> = new Map();
  private reviewSessions: Map<string, ParentalReviewSession[]> = new Map();
  private childProgressTracking: Map<string, LearningResults[]> = new Map();

  constructor() {
    this.initializeDefaultSettings();
    this.startNotificationScheduler();
  }

  /**
   * Request parental approval for an educational recommendation
   */
  async requestApproval(recommendation: EducationalRecommendation, childId: string, parentId: string): Promise<ParentalApprovalRequest> {
    try {
      const settings = this.controlSettings.get(`${parentId}_${childId}`);
      
      // Check if auto-approval is possible
      if (settings?.autoApprovalEnabled && await this.canAutoApprove(recommendation, settings)) {
        return this.createAutoApprovedRequest(recommendation, childId, parentId, settings);
      }
      
      // Create approval request
      const request: ParentalApprovalRequest = {
        id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        childId,
        parentId,
        recommendation,
        requestedAt: new Date(),
        status: 'pending'
      };
      
      this.approvalRequests.set(request.id, request);
      
      // Send notification to parent
      await this.sendApprovalNotification(request);
      
      // Set expiration timer
      this.setApprovalExpiration(request.id);
      
      return request;
      
    } catch (error) {
      console.error('Error requesting parental approval:', error);
      throw new Error('Failed to request parental approval');
    }
  }

  /**
   * Process parental approval or rejection
   */
  async processApprovalDecision(requestId: string, approved: boolean, parentNotes?: string): Promise<void> {
    try {
      const request = this.approvalRequests.get(requestId);
      if (!request) {
        throw new Error('Approval request not found');
      }
      
      if (request.status !== 'pending') {
        throw new Error('Approval request is no longer pending');
      }
      
      // Update request status
      request.status = approved ? 'approved' : 'rejected';
      request.parentNotes = parentNotes;
      
      // Log the decision for audit purposes
      await this.logApprovalDecision(request, approved, parentNotes);
      
      // Send confirmation notification
      await this.sendDecisionConfirmation(request, approved);
      
      // Update child's learning profile if approved
      if (approved) {
        await this.updateChildLearningProfile(request.childId, request.recommendation);
      }
      
    } catch (error) {
      console.error('Error processing approval decision:', error);
      throw new Error('Failed to process approval decision');
    }
  }

  /**
   * Get pending approval requests for a parent
   */
  async getPendingApprovals(parentId: string): Promise<ParentalApprovalRequest[]> {
    const pendingRequests: ParentalApprovalRequest[] = [];
    
    for (const request of this.approvalRequests.values()) {
      if (request.parentId === parentId && request.status === 'pending') {
        pendingRequests.push(request);
      }
    }
    
    return pendingRequests.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  /**
   * Create or update parental control settings
   */
  async updateParentalSettings(parentId: string, childId: string, settings: Partial<ParentalControlSettings>): Promise<void> {
    try {
      const key = `${parentId}_${childId}`;
      const existingSettings = this.controlSettings.get(key) || this.getDefaultSettings(parentId, childId);
      
      const updatedSettings: ParentalControlSettings = {
        ...existingSettings,
        ...settings
      };
      
      this.controlSettings.set(key, updatedSettings);
      
      // Validate settings for safety
      await this.validateParentalSettings(updatedSettings);
      
      // Send confirmation notification
      await this.sendSettingsUpdateNotification(parentId, childId);
      
    } catch (error) {
      console.error('Error updating parental settings:', error);
      throw new Error('Failed to update parental settings');
    }
  }

  /**
   * Get parental control settings
   */
  async getParentalSettings(parentId: string, childId: string): Promise<ParentalControlSettings> {
    const key = `${parentId}_${childId}`;
    return this.controlSettings.get(key) || this.getDefaultSettings(parentId, childId);
  }

  /**
   * Send notification to parent
   */
  async sendParentalNotification(notification: Omit<ParentalNotification, 'id' | 'createdAt' | 'read'>): Promise<void> {
    try {
      const fullNotification: ParentalNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        read: false
      };
      
      if (!this.notifications.has(notification.parentId)) {
        this.notifications.set(notification.parentId, []);
      }
      
      this.notifications.get(notification.parentId)!.push(fullNotification);
      
      // Send immediate notification if required
      const settings = await this.getParentalSettings(notification.parentId, notification.childId);
      if (settings.notificationPreferences.immediateNotification && 
          (notification.priority === 'high' || notification.priority === 'urgent')) {
        await this.sendImmediateNotification(fullNotification, settings);
      }
      
    } catch (error) {
      console.error('Error sending parental notification:', error);
    }
  }

  /**
   * Get notifications for a parent
   */
  async getParentalNotifications(parentId: string, unreadOnly: boolean = false): Promise<ParentalNotification[]> {
    const notifications = this.notifications.get(parentId) || [];
    
    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }
    
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(parentId: string, notificationId: string): Promise<void> {
    const notifications = this.notifications.get(parentId) || [];
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
    }
  }

  /**
   * Track child's learning progress for parental oversight
   */
  async trackChildProgress(childId: string, results: LearningResults): Promise<void> {
    try {
      if (!this.childProgressTracking.has(childId)) {
        this.childProgressTracking.set(childId, []);
      }
      
      this.childProgressTracking.get(childId)!.push(results);
      
      // Analyze progress and send notifications if needed
      await this.analyzeProgressForParents(childId, results);
      
    } catch (error) {
      console.error('Error tracking child progress:', error);
    }
  }

  /**
   * Generate parental progress report
   */
  async generateProgressReport(parentId: string, childId: string, timeRange: { start: Date; end: Date }): Promise<ParentalProgressReport> {
    try {
      const progress = this.childProgressTracking.get(childId) || [];
      const relevantProgress = progress.filter(p => 
        p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
      );
      
      return {
        childId,
        parentId,
        timeRange,
        totalActivities: relevantProgress.length,
        completedActivities: relevantProgress.filter(p => p.completed).length,
        averageAccuracy: this.calculateAverageAccuracy(relevantProgress),
        averageEngagement: this.calculateAverageEngagement(relevantProgress),
        subjectBreakdown: this.calculateSubjectBreakdown(relevantProgress),
        strugglingAreas: this.identifyStrugglingAreas(relevantProgress),
        achievements: this.identifyAchievements(relevantProgress),
        recommendations: this.generateParentalRecommendations(relevantProgress),
        generatedAt: new Date()
      };
      
    } catch (error) {
      console.error('Error generating progress report:', error);
      throw new Error('Failed to generate progress report');
    }
  }

  /**
   * Validate educational content against parental settings
   */
  async validateContentAgainstParentalSettings(content: EducationalContent, parentId: string, childId: string): Promise<boolean> {
    try {
      const settings = await this.getParentalSettings(parentId, childId);
      
      // Check subject restrictions
      if (settings.restrictedSubjects.includes(content.subject)) {
        return false;
      }
      
      // Check allowed subjects (if specified)
      if (settings.allowedSubjects.length > 0 && !settings.allowedSubjects.includes(content.subject)) {
        return false;
      }
      
      // Check duration limits
      if (content.duration > settings.maxSessionDuration) {
        return false;
      }
      
      // Check safety level
      if (content.safetyRating === SafetyLevel.BLOCKED || 
          (settings.contentFilteringLevel === 'strict' && content.safetyRating === SafetyLevel.RESTRICTED)) {
        return false;
      }
      
      // Check if parental guidance is required
      if (content.parentalGuidanceRequired && !settings.allowPeerInteraction) {
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error validating content against parental settings:', error);
      return false; // Default to rejecting content if validation fails
    }
  }

  // Private helper methods

  private async canAutoApprove(recommendation: EducationalRecommendation, settings: ParentalControlSettings): Promise<boolean> {
    const criteria = settings.autoApprovalCriteria;
    
    // Check duration
    if (recommendation.estimatedDuration > criteria.maxDuration) {
      return false;
    }
    
    // Check difficulty level
    const difficultyOrder = [SkillLevel.BELOW_GRADE, SkillLevel.AT_GRADE, SkillLevel.ABOVE_GRADE, SkillLevel.GIFTED];
    const maxIndex = difficultyOrder.indexOf(criteria.maxDifficultyLevel);
    const recIndex = difficultyOrder.indexOf(recommendation.skillLevel);
    
    if (recIndex > maxIndex) {
      return false;
    }
    
    // Check subject restrictions
    if (criteria.subjectRestrictions.includes(recommendation.subject)) {
      return false;
    }
    
    // Check if new content requires approval
    if (settings.requireApprovalForNewContent) {
      return false;
    }
    
    return true;
  }

  private createAutoApprovedRequest(recommendation: EducationalRecommendation, childId: string, parentId: string, settings: ParentalControlSettings): ParentalApprovalRequest {
    const request: ParentalApprovalRequest = {
      id: `auto_approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      childId,
      parentId,
      recommendation,
      requestedAt: new Date(),
      status: 'approved',
      autoApprovalReason: 'Content meets auto-approval criteria'
    };
    
    this.approvalRequests.set(request.id, request);
    
    // Send notification about auto-approval
    this.sendParentalNotification({
      parentId,
      childId,
      type: 'approval_request',
      title: 'Content Auto-Approved',
      message: `Educational content "${recommendation.title}" was automatically approved based on your settings.`,
      priority: 'low',
      actionRequired: false,
      relatedRecommendationId: recommendation.id
    });
    
    return request;
  }

  private async sendApprovalNotification(request: ParentalApprovalRequest): Promise<void> {
    await this.sendParentalNotification({
      parentId: request.parentId,
      childId: request.childId,
      type: 'approval_request',
      title: 'Educational Content Approval Required',
      message: `Your child wants to access "${request.recommendation.title}". Please review and approve or reject this content.`,
      priority: 'medium',
      actionRequired: true,
      relatedRecommendationId: request.recommendation.id
    });
  }

  private setApprovalExpiration(requestId: string): void {
    // Set 24-hour expiration for approval requests
    setTimeout(() => {
      const request = this.approvalRequests.get(requestId);
      if (request && request.status === 'pending') {
        request.status = 'expired';
        
        // Send expiration notification
        this.sendParentalNotification({
          parentId: request.parentId,
          childId: request.childId,
          type: 'approval_request',
          title: 'Approval Request Expired',
          message: `The approval request for "${request.recommendation.title}" has expired.`,
          priority: 'low',
          actionRequired: false,
          relatedRecommendationId: request.recommendation.id
        });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private async logApprovalDecision(request: ParentalApprovalRequest, approved: boolean, notes?: string): Promise<void> {
    // Log decision for audit trail
    console.log(`Parental approval decision: ${approved ? 'APPROVED' : 'REJECTED'} for ${request.recommendation.title} by parent ${request.parentId}`);
    if (notes) {
      console.log(`Parent notes: ${notes}`);
    }
  }

  private async sendDecisionConfirmation(request: ParentalApprovalRequest, approved: boolean): Promise<void> {
    await this.sendParentalNotification({
      parentId: request.parentId,
      childId: request.childId,
      type: 'approval_request',
      title: `Content ${approved ? 'Approved' : 'Rejected'}`,
      message: `You have ${approved ? 'approved' : 'rejected'} "${request.recommendation.title}" for your child.`,
      priority: 'low',
      actionRequired: false,
      relatedRecommendationId: request.recommendation.id
    });
  }

  private async updateChildLearningProfile(childId: string, recommendation: EducationalRecommendation): Promise<void> {
    // Update child's learning profile with approved content
    console.log(`Updating learning profile for child ${childId} with approved content: ${recommendation.title}`);
  }

  private getDefaultSettings(parentId: string, childId: string): ParentalControlSettings {
    return {
      parentId,
      childId,
      autoApprovalEnabled: false,
      autoApprovalCriteria: {
        trustedContentSources: [],
        maxDifficultyLevel: SkillLevel.AT_GRADE,
        allowedContentTypes: ['interactive', 'reading', 'exercise'],
        maxDuration: 30,
        safetyLevelThreshold: SafetyLevel.SAFE,
        subjectRestrictions: []
      },
      restrictedSubjects: [],
      allowedSubjects: Object.values(Subject),
      maxDailyScreenTime: 120, // 2 hours
      maxSessionDuration: 30,
      requireApprovalForNewContent: true,
      requireApprovalForAdvancedContent: true,
      allowPeerInteraction: false,
      contentFilteringLevel: 'strict',
      notificationPreferences: {
        immediateNotification: true,
        dailySummary: true,
        weeklyReport: true,
        achievementAlerts: true,
        safetyAlerts: true,
        progressUpdates: true,
        channels: ['voice', 'avatar'],
        quietHours: { start: '21:00', end: '07:00' }
      },
      emergencyContacts: []
    };
  }

  private async validateParentalSettings(settings: ParentalControlSettings): Promise<void> {
    // Validate settings for safety and consistency
    if (settings.maxDailyScreenTime < 0 || settings.maxDailyScreenTime > 480) { // Max 8 hours
      throw new Error('Invalid daily screen time limit');
    }
    
    if (settings.maxSessionDuration < 5 || settings.maxSessionDuration > 120) { // 5 min to 2 hours
      throw new Error('Invalid session duration limit');
    }
  }

  private async sendSettingsUpdateNotification(parentId: string, childId: string): Promise<void> {
    await this.sendParentalNotification({
      parentId,
      childId,
      type: 'progress_update',
      title: 'Parental Settings Updated',
      message: 'Your parental control settings have been successfully updated.',
      priority: 'low',
      actionRequired: false
    });
  }

  private async sendImmediateNotification(notification: ParentalNotification, settings: ParentalControlSettings): Promise<void> {
    // Check quiet hours
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if (this.isInQuietHours(currentTime, settings.notificationPreferences.quietHours)) {
      return; // Don't send immediate notifications during quiet hours
    }
    
    // Send through preferred channels
    for (const channel of settings.notificationPreferences.channels) {
      await this.sendNotificationThroughChannel(notification, channel);
    }
  }

  private isInQuietHours(currentTime: string, quietHours: { start: string; end: string }): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(quietHours.start);
    const end = this.timeToMinutes(quietHours.end);
    
    if (start <= end) {
      return current >= start && current <= end;
    } else {
      // Quiet hours span midnight
      return current >= start || current <= end;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async sendNotificationThroughChannel(notification: ParentalNotification, channel: string): Promise<void> {
    // In a real implementation, this would integrate with the actual notification systems
    console.log(`Sending notification through ${channel}: ${notification.title}`);
  }

  private async analyzeProgressForParents(childId: string, results: LearningResults): Promise<void> {
    // Analyze if parents should be notified about progress
    if (results.accuracyScore < 0.5) {
      // Child is struggling - notify parents
      const parentIds = await this.getParentIdsForChild(childId);
      for (const parentId of parentIds) {
        await this.sendParentalNotification({
          parentId,
          childId,
          type: 'progress_update',
          title: 'Learning Support Needed',
          message: `Your child may need additional support with ${results.activityId}. Consider reviewing together.`,
          priority: 'medium',
          actionRequired: true
        });
      }
    } else if (results.accuracyScore > 0.9 && results.engagementLevel === 'high') {
      // Child is excelling - celebrate achievement
      const parentIds = await this.getParentIdsForChild(childId);
      for (const parentId of parentIds) {
        await this.sendParentalNotification({
          parentId,
          childId,
          type: 'achievement',
          title: 'Great Progress!',
          message: `Your child excelled at ${results.activityId} with ${Math.round(results.accuracyScore * 100)}% accuracy!`,
          priority: 'low',
          actionRequired: false
        });
      }
    }
  }

  private async getParentIdsForChild(childId: string): Promise<string[]> {
    // In a real implementation, this would query the family relationship database
    // For now, return a mock parent ID
    return [`parent_of_${childId}`];
  }

  private calculateAverageAccuracy(progress: LearningResults[]): number {
    if (progress.length === 0) return 0;
    return progress.reduce((sum, p) => sum + p.accuracyScore, 0) / progress.length;
  }

  private calculateAverageEngagement(progress: LearningResults[]): number {
    if (progress.length === 0) return 0;
    const engagementScores = progress.map(p => {
      switch (p.engagementLevel) {
        case 'high': return 1;
        case 'medium': return 0.5;
        case 'low': return 0;
        default: return 0;
      }
    });
    return engagementScores.reduce((sum: number, score: number) => sum + score, 0) / engagementScores.length;
  }

  private calculateSubjectBreakdown(progress: LearningResults[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    progress.forEach(p => {
      // Extract subject from activity ID (simplified)
      const subject = p.activityId.split('_')[0] || 'unknown';
      breakdown[subject] = (breakdown[subject] || 0) + 1;
    });
    return breakdown;
  }

  private identifyStrugglingAreas(progress: LearningResults[]): string[] {
    const strugglingAreas = new Set<string>();
    progress.forEach(p => {
      if (p.accuracyScore < 0.6) {
        p.struggledWith.forEach(area => strugglingAreas.add(area));
      }
    });
    return Array.from(strugglingAreas);
  }

  private identifyAchievements(progress: LearningResults[]): string[] {
    const achievements: string[] = [];
    progress.forEach(p => {
      if (p.accuracyScore > 0.9) {
        achievements.push(`Mastered: ${p.masteredSkills.join(', ')}`);
      }
    });
    return achievements;
  }

  private generateParentalRecommendations(progress: LearningResults[]): string[] {
    const recommendations: string[] = [];
    
    const avgAccuracy = this.calculateAverageAccuracy(progress);
    if (avgAccuracy < 0.6) {
      recommendations.push('Consider providing additional support or reducing difficulty level');
    } else if (avgAccuracy > 0.9) {
      recommendations.push('Child is ready for more challenging content');
    }
    
    const strugglingAreas = this.identifyStrugglingAreas(progress);
    if (strugglingAreas.length > 0) {
      recommendations.push(`Focus on reinforcing: ${strugglingAreas.join(', ')}`);
    }
    
    return recommendations;
  }

  private initializeDefaultSettings(): void {
    // Initialize any default settings or configurations
    console.log('Parental Control Manager initialized');
  }

  private startNotificationScheduler(): void {
    // Start background scheduler for daily/weekly reports
    setInterval(() => {
      this.processDailySummaries();
    }, 24 * 60 * 60 * 1000); // Daily
    
    setInterval(() => {
      this.processWeeklyReports();
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  private async processDailySummaries(): Promise<void> {
    // Process daily summaries for parents who have enabled them
    for (const [key, settings] of this.controlSettings.entries()) {
      if (settings.notificationPreferences.dailySummary) {
        await this.sendDailySummary(settings.parentId, settings.childId);
      }
    }
  }

  private async processWeeklyReports(): Promise<void> {
    // Process weekly reports for parents who have enabled them
    for (const [key, settings] of this.controlSettings.entries()) {
      if (settings.notificationPreferences.weeklyReport) {
        await this.sendWeeklyReport(settings.parentId, settings.childId);
      }
    }
  }

  private async sendDailySummary(parentId: string, childId: string): Promise<void> {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    const report = await this.generateProgressReport(parentId, childId, {
      start: yesterday,
      end: today
    });
    
    await this.sendParentalNotification({
      parentId,
      childId,
      type: 'progress_update',
      title: 'Daily Learning Summary',
      message: `Your child completed ${report.completedActivities} activities with ${Math.round(report.averageAccuracy * 100)}% average accuracy.`,
      priority: 'low',
      actionRequired: false
    });
  }

  private async sendWeeklyReport(parentId: string, childId: string): Promise<void> {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const report = await this.generateProgressReport(parentId, childId, {
      start: weekAgo,
      end: today
    });
    
    await this.sendParentalNotification({
      parentId,
      childId,
      type: 'progress_update',
      title: 'Weekly Learning Report',
      message: `This week: ${report.completedActivities} activities completed, ${Math.round(report.averageAccuracy * 100)}% accuracy, ${report.achievements.length} achievements unlocked.`,
      priority: 'low',
      actionRequired: false
    });
  }
}

// Supporting interface for progress reports
export interface ParentalProgressReport {
  childId: string;
  parentId: string;
  timeRange: { start: Date; end: Date };
  totalActivities: number;
  completedActivities: number;
  averageAccuracy: number;
  averageEngagement: number;
  subjectBreakdown: Record<string, number>;
  strugglingAreas: string[];
  achievements: string[];
  recommendations: string[];
  generatedAt: Date;
}