// Parental control and approval system for child scheduling
// Manages parental oversight, approval workflows, and time restrictions

import { CalendarEvent, EventCategory } from '../calendar/types'
import { Reminder } from '../reminders/types'
import { SafetyValidationResult, SafetyAction, RiskLevel } from './safety-validator'

export interface ParentalControlConfig {
  userId: string
  parentId: string
  requireApprovalFor: ApprovalRequirement[]
  timeRestrictions: TimeRestriction[]
  allowedCategories: EventCategory[]
  maxDailyEvents: number
  maxEventDuration: number
  allowExternalCalendars: boolean
  externalCalendarControls: ExternalCalendarControls
  notificationSettings: ParentalNotificationSettings
  emergencyOverride: boolean
  childFriendlyMode: boolean
  familyVisibilitySettings: FamilyVisibilitySettings
}

export interface ApprovalRequirement {
  type: ApprovalType
  condition: ApprovalCondition
  autoApprove: boolean
  notifyParent: boolean
}

export enum ApprovalType {
  ALL_EVENTS = 'all_events',
  EXTERNAL_EVENTS = 'external_events',
  EVENING_EVENTS = 'evening_events',
  WEEKEND_EVENTS = 'weekend_events',
  LONG_EVENTS = 'long_events',
  EVENTS_WITH_OTHERS = 'events_with_others',
  LOCATION_BASED = 'location_based',
  CATEGORY_BASED = 'category_based'
}

export interface ApprovalCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range'
  value: any
}

export interface TimeRestriction {
  id: string
  name: string
  startTime: string // HH:MM format
  endTime: string   // HH:MM format
  daysOfWeek: number[] // 0-6, Sunday = 0
  restrictionType: RestrictionType
  isActive: boolean
}

export enum RestrictionType {
  NO_EVENTS = 'no_events',
  FAMILY_ONLY = 'family_only',
  SUPERVISED_ONLY = 'supervised_only',
  QUIET_TIME = 'quiet_time'
}

export interface ParentalNotificationSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  dailySummary: boolean
  immediateAlerts: boolean
  weeklyReport: boolean
  notificationMethods: NotificationMethod[]
}

export enum NotificationMethod {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  VOICE = 'voice',
  AVATAR = 'avatar'
}

export interface ExternalCalendarControls {
  allowGoogleCalendar: boolean
  allowMicrosoftOutlook: boolean
  allowAppleICloud: boolean
  allowCalDAV: boolean
  allowICSSubscriptions: boolean
  requireApprovalForNewConnections: boolean
  allowedDomains: string[]
  blockedDomains: string[]
  maxConnections: number
  dataShareRestrictions: DataShareRestriction[]
}

export interface DataShareRestriction {
  provider: string
  allowPersonalData: boolean
  allowLocationData: boolean
  allowAttendeeData: boolean
  allowAttachments: boolean
  maxDataRetention: number // days
}

export interface FamilyVisibilitySettings {
  showAllFamilyEvents: boolean
  showChildSchedulesToParents: boolean
  showParentSchedulesToChildren: boolean
  allowChildToViewSiblings: boolean
  hidePrivateEvents: boolean
  emergencyContactVisibility: boolean
}

export interface ApprovalRequest {
  id: string
  childUserId: string
  parentId: string
  requestType: RequestType
  content: CalendarEvent | Reminder
  safetyValidation: SafetyValidationResult
  requestedAt: Date
  status: ApprovalStatus
  parentResponse?: ParentResponse
  expiresAt: Date
  priority: RequestPriority
}

export enum RequestType {
  EVENT_CREATION = 'event_creation',
  EVENT_MODIFICATION = 'event_modification',
  REMINDER_CREATION = 'reminder_creation',
  EXTERNAL_CALENDAR_CONNECTION = 'external_calendar_connection',
  TIME_RESTRICTION_OVERRIDE = 'time_restriction_override',
  DATA_SHARING_PERMISSION = 'data_sharing_permission',
  CALENDAR_SUBSCRIPTION = 'calendar_subscription'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  AUTO_APPROVED = 'auto_approved'
}

export interface ParentResponse {
  decision: ApprovalStatus
  reason?: string
  conditions?: ApprovalCondition[]
  respondedAt: Date
  modifications?: Partial<CalendarEvent | Reminder>
}

export enum RequestPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4
}

export interface ParentalReviewInterface {
  pendingRequests: ApprovalRequest[]
  childActivity: ChildActivitySummary
  safetyAlerts: SafetyAlert[]
  weeklyReport: WeeklyActivityReport
}

export interface ChildActivitySummary {
  userId: string
  date: Date
  totalEvents: number
  eventsByCategory: Record<EventCategory, number>
  timeSpentScheduled: number // minutes
  safetyViolations: number
  parentalInterventions: number
}

export interface SafetyAlert {
  id: string
  userId: string
  alertType: AlertType
  severity: AlertSeverity
  description: string
  relatedContent: string
  timestamp: Date
  acknowledged: boolean
}

export enum AlertType {
  SAFETY_VIOLATION = 'safety_violation',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  TIME_RESTRICTION_VIOLATION = 'time_restriction_violation',
  EXTERNAL_CONTENT_BLOCKED = 'external_content_blocked',
  REPEATED_VIOLATIONS = 'repeated_violations'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface WeeklyActivityReport {
  userId: string
  weekStartDate: Date
  totalEvents: number
  safetyScore: number // 0-100
  complianceRate: number // 0-100
  categoryBreakdown: Record<EventCategory, number>
  timeUsagePattern: TimeUsagePattern[]
  recommendations: string[]
}

export interface TimeUsagePattern {
  timeSlot: string
  averageEvents: number
  peakDay: string
  activityLevel: 'low' | 'medium' | 'high'
}

export interface ScheduleReviewInterface {
  childId: string
  childName: string
  upcomingEvents: CalendarEvent[]
  recentActivity: ChildActivitySummary[]
  pendingApprovals: ApprovalRequest[]
  safetyAlerts: SafetyAlert[]
  complianceMetrics: ComplianceMetrics
  recommendedActions: RecommendedAction[]
}

export interface ComplianceMetrics {
  timeRestrictionCompliance: number // percentage
  contentSafetyScore: number // 0-100
  approvalResponseRate: number // percentage
  averageResponseTime: number // hours
  violationTrends: ViolationTrend[]
}

export interface ViolationTrend {
  violationType: string
  count: number
  trend: 'increasing' | 'decreasing' | 'stable'
  lastOccurrence: Date
}

export interface RecommendedAction {
  type: 'time_restriction' | 'content_filter' | 'approval_setting' | 'notification'
  priority: 'low' | 'medium' | 'high'
  description: string
  suggestedChange: string
}

export interface TimeRestrictionResult {
  allowed: boolean
  reason?: string
  violatedRestriction?: string
  suggestedTimes?: TimeSlot[]
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  reason: string
}

export interface FamilyVisibilityResult {
  canView: boolean
  visibleEvents: CalendarEvent[]
  reason?: string
}

export interface ExternalCalendarApprovalRequest {
  id: string
  childUserId: string
  parentId: string
  provider: string
  accountEmail: string
  requestedPermissions: string[]
  dataAccessLevel: 'read_only' | 'read_write' | 'full_access'
  justification: string
  requestedAt: Date
  status: ApprovalStatus
}

export interface ChildFriendlyMessage {
  originalMessage: string
  childFriendlyVersion: string
  ageGroup: 'young_child' | 'older_child' | 'teen'
  tone: 'encouraging' | 'informative' | 'gentle_correction'
}

/**
 * Parental control system for managing child scheduling activities
 */
export class ParentalControlSystem {
  private configs: Map<string, ParentalControlConfig> = new Map()
  private approvalRequests: Map<string, ApprovalRequest> = new Map()
  private activityHistory: Map<string, ChildActivitySummary[]> = new Map()
  private safetyAlerts: Map<string, SafetyAlert[]> = new Map()
  private externalCalendarRequests: Map<string, ExternalCalendarApprovalRequest> = new Map()
  private scheduleReviews: Map<string, ScheduleReviewInterface> = new Map()

  /**
   * Sets up parental controls for a child user
   */
  async setupParentalControls(
    childUserId: string,
    parentId: string,
    config: Partial<ParentalControlConfig>
  ): Promise<void> {
    const defaultConfig: ParentalControlConfig = {
      userId: childUserId,
      parentId,
      requireApprovalFor: [
        {
          type: ApprovalType.EXTERNAL_EVENTS,
          condition: { field: 'source', operator: 'equals', value: 'external' },
          autoApprove: false,
          notifyParent: true
        },
        {
          type: ApprovalType.EVENING_EVENTS,
          condition: { field: 'startTime', operator: 'greater_than', value: '19:00' },
          autoApprove: false,
          notifyParent: true
        }
      ],
      timeRestrictions: [
        {
          id: 'sleep_time',
          name: 'Sleep Time',
          startTime: '21:00',
          endTime: '07:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          restrictionType: RestrictionType.NO_EVENTS,
          isActive: true
        },
        {
          id: 'school_hours',
          name: 'School Hours',
          startTime: '08:00',
          endTime: '15:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          restrictionType: RestrictionType.FAMILY_ONLY,
          isActive: true
        }
      ],
      allowedCategories: [
        EventCategory.EDUCATION,
        EventCategory.FAMILY,
        EventCategory.HEALTH,
        EventCategory.ENTERTAINMENT
      ],
      maxDailyEvents: 5,
      maxEventDuration: 4, // hours
      allowExternalCalendars: false,
      externalCalendarControls: {
        allowGoogleCalendar: false,
        allowMicrosoftOutlook: false,
        allowAppleICloud: false,
        allowCalDAV: false,
        allowICSSubscriptions: true, // Allow safe subscriptions like school calendars
        requireApprovalForNewConnections: true,
        allowedDomains: ['school.edu', 'library.org'],
        blockedDomains: ['adult-content.com'],
        maxConnections: 3,
        dataShareRestrictions: [
          {
            provider: 'google',
            allowPersonalData: false,
            allowLocationData: false,
            allowAttendeeData: false,
            allowAttachments: false,
            maxDataRetention: 30
          }
        ]
      },
      notificationSettings: {
        emailNotifications: true,
        pushNotifications: true,
        dailySummary: true,
        immediateAlerts: true,
        weeklyReport: true,
        notificationMethods: [NotificationMethod.EMAIL, NotificationMethod.PUSH]
      },
      emergencyOverride: false,
      childFriendlyMode: true,
      familyVisibilitySettings: {
        showAllFamilyEvents: true,
        showChildSchedulesToParents: true,
        showParentSchedulesToChildren: false,
        allowChildToViewSiblings: true,
        hidePrivateEvents: true,
        emergencyContactVisibility: true
      }
    }

    const finalConfig = { ...defaultConfig, ...config }
    this.configs.set(childUserId, finalConfig)
    
    console.log(`Parental controls set up for child ${childUserId} with parent ${parentId}`)
  }

  /**
   * Checks if an event requires parental approval
   */
  async requiresApproval(
    event: CalendarEvent,
    userId: string,
    safetyValidation: SafetyValidationResult
  ): Promise<boolean> {
    const config = this.configs.get(userId)
    if (!config) return false

    // Always require approval for high-risk content
    if (safetyValidation.riskLevel === RiskLevel.HIGH_RISK || 
        safetyValidation.riskLevel === RiskLevel.BLOCKED) {
      return true
    }

    // Check approval requirements
    for (const requirement of config.requireApprovalFor) {
      if (this.matchesApprovalCondition(event, requirement)) {
        return !requirement.autoApprove
      }
    }

    // Check time restrictions
    if (this.violatesTimeRestrictions(event, config.timeRestrictions)) {
      return true
    }

    // Check daily limits
    const todayEvents = await this.getTodayEventCount(userId)
    if (todayEvents >= config.maxDailyEvents) {
      return true
    }

    // Check event duration
    const duration = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60)
    if (duration > config.maxEventDuration) {
      return true
    }

    return false
  }

  /**
   * Submits an approval request to parent
   */
  async submitApprovalRequest(
    childUserId: string,
    requestType: RequestType,
    content: CalendarEvent | Reminder,
    safetyValidation: SafetyValidationResult
  ): Promise<string> {
    const config = this.configs.get(childUserId)
    if (!config) {
      throw new Error('Parental controls not configured for user')
    }

    const requestId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const request: ApprovalRequest = {
      id: requestId,
      childUserId,
      parentId: config.parentId,
      requestType,
      content,
      safetyValidation,
      requestedAt: new Date(),
      status: ApprovalStatus.PENDING,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      priority: this.determinePriority(safetyValidation, requestType)
    }

    this.approvalRequests.set(requestId, request)

    // Send notification to parent
    await this.notifyParent(config.parentId, request)

    console.log(`Approval request ${requestId} submitted for ${requestType}`)
    return requestId
  }

  /**
   * Parent responds to approval request
   */
  async respondToRequest(
    requestId: string,
    parentId: string,
    decision: ApprovalStatus,
    reason?: string,
    modifications?: Partial<CalendarEvent | Reminder>
  ): Promise<void> {
    const request = this.approvalRequests.get(requestId)
    if (!request) {
      throw new Error('Approval request not found')
    }

    if (request.parentId !== parentId) {
      throw new Error('Unauthorized: Not the assigned parent')
    }

    if (request.status !== ApprovalStatus.PENDING) {
      throw new Error('Request already processed')
    }

    const response: ParentResponse = {
      decision,
      reason,
      modifications,
      respondedAt: new Date()
    }

    request.status = decision
    request.parentResponse = response

    // Log the decision
    await this.logParentalDecision(request, response)

    // Notify child of decision
    await this.notifyChild(request.childUserId, request, response)

    console.log(`Approval request ${requestId} ${decision} by parent ${parentId}`)
  }

  /**
   * Checks if event violates time restrictions
   */
  private violatesTimeRestrictions(
    event: CalendarEvent,
    restrictions: TimeRestriction[]
  ): boolean {
    const eventStart = event.startTime
    const eventDay = eventStart.getDay()
    const eventTime = `${eventStart.getHours().toString().padStart(2, '0')}:${eventStart.getMinutes().toString().padStart(2, '0')}`

    for (const restriction of restrictions) {
      if (!restriction.isActive) continue
      
      if (restriction.daysOfWeek.includes(eventDay)) {
        if (this.isTimeInRange(eventTime, restriction.startTime, restriction.endTime)) {
          // Check restriction type
          switch (restriction.restrictionType) {
            case RestrictionType.NO_EVENTS:
              return true
            case RestrictionType.FAMILY_ONLY:
              if (event.category !== EventCategory.FAMILY) {
                return true
              }
              break
            case RestrictionType.SUPERVISED_ONLY:
              // Check if event has parent/guardian attendee
              const hasSupervision = event.attendees.some(attendee => 
                attendee.role === 'organizer' || attendee.name.toLowerCase().includes('parent')
              )
              if (!hasSupervision) {
                return true
              }
              break
          }
        }
      }
    }

    return false
  }

  /**
   * Checks if time is within restriction range
   */
  private isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time)
    const startMinutes = this.timeToMinutes(startTime)
    const endMinutes = this.timeToMinutes(endTime)

    if (startMinutes <= endMinutes) {
      // Same day range
      return timeMinutes >= startMinutes && timeMinutes <= endMinutes
    } else {
      // Overnight range (e.g., 21:00 to 07:00)
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes
    }
  }

  /**
   * Converts time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  /**
   * Checks if event matches approval condition
   */
  private matchesApprovalCondition(
    event: CalendarEvent,
    requirement: ApprovalRequirement
  ): boolean {
    const { condition } = requirement
    const eventValue = this.getEventFieldValue(event, condition.field)

    switch (condition.operator) {
      case 'equals':
        return eventValue === condition.value
      case 'contains':
        return String(eventValue).toLowerCase().includes(String(condition.value).toLowerCase())
      case 'greater_than':
        return eventValue > condition.value
      case 'less_than':
        return eventValue < condition.value
      case 'in_range':
        return Array.isArray(condition.value) && 
               eventValue >= condition.value[0] && 
               eventValue <= condition.value[1]
      default:
        return false
    }
  }

  /**
   * Gets field value from event object
   */
  private getEventFieldValue(event: CalendarEvent, field: string): any {
    switch (field) {
      case 'category':
        return event.category
      case 'startTime':
        return `${event.startTime.getHours().toString().padStart(2, '0')}:${event.startTime.getMinutes().toString().padStart(2, '0')}`
      case 'duration':
        return (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60)
      case 'attendeeCount':
        return event.attendees.length
      case 'source':
        return event.metadata?.source || 'local'
      case 'location':
        return event.location?.name || ''
      default:
        return (event as any)[field]
    }
  }

  /**
   * Gets today's event count for user
   */
  private async getTodayEventCount(userId: string): Promise<number> {
    // In production, query actual event store
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const activity = this.activityHistory.get(userId) || []
    const todayActivity = activity.find(a => 
      a.date.toDateString() === today.toDateString()
    )
    
    return todayActivity?.totalEvents || 0
  }

  /**
   * Determines request priority based on safety validation and type
   */
  private determinePriority(
    safetyValidation: SafetyValidationResult,
    requestType: RequestType
  ): RequestPriority {
    if (safetyValidation.riskLevel === RiskLevel.BLOCKED) {
      return RequestPriority.URGENT
    }
    
    if (safetyValidation.riskLevel === RiskLevel.HIGH_RISK) {
      return RequestPriority.HIGH
    }
    
    if (requestType === RequestType.EXTERNAL_CALENDAR_CONNECTION) {
      return RequestPriority.HIGH
    }
    
    return RequestPriority.NORMAL
  }

  /**
   * Sends notification to parent about approval request
   */
  private async notifyParent(parentId: string, request: ApprovalRequest): Promise<void> {
    const config = this.configs.get(request.childUserId)
    if (!config) return

    const notification = {
      to: parentId,
      subject: `Approval Required: ${request.requestType}`,
      message: this.generateParentNotificationMessage(request),
      priority: request.priority,
      methods: config.notificationSettings.notificationMethods
    }

    // In production, send through notification system
    console.log(`Parent notification sent to ${parentId}:`, notification.subject)
  }

  /**
   * Generates notification message for parent
   */
  private generateParentNotificationMessage(request: ApprovalRequest): string {
    const content = request.content as CalendarEvent
    const riskLevel = request.safetyValidation.riskLevel
    
    let message = `Your child has requested approval for: ${content.title}\n`
    message += `Time: ${content.startTime.toLocaleString()}\n`
    message += `Safety Level: ${riskLevel}\n`
    
    if (request.safetyValidation.violations.length > 0) {
      message += `Safety Concerns: ${request.safetyValidation.violations.length} issues detected\n`
    }
    
    message += `Please review and respond within 24 hours.`
    
    return message
  }

  /**
   * Notifies child of parent's decision
   */
  private async notifyChild(
    childUserId: string,
    request: ApprovalRequest,
    response: ParentResponse
  ): Promise<void> {
    const message = this.generateChildNotificationMessage(request, response)
    
    // In production, send through child-friendly notification system
    console.log(`Child notification sent to ${childUserId}:`, message)
  }

  /**
   * Generates child-friendly notification message
   */
  private generateChildNotificationMessage(
    request: ApprovalRequest,
    response: ParentResponse
  ): string {
    const content = request.content as CalendarEvent
    
    if (response.decision === ApprovalStatus.APPROVED) {
      return `Great news! Your event "${content.title}" has been approved by your parent. You're all set!`
    } else {
      const reason = response.reason || 'to keep you safe'
      return `Your parent reviewed your event "${content.title}" and decided not to approve it ${reason}. You can talk to them about it or try scheduling something different.`
    }
  }

  /**
   * Logs parental decision for audit trail
   */
  private async logParentalDecision(
    request: ApprovalRequest,
    response: ParentResponse
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      requestId: request.id,
      childUserId: request.childUserId,
      parentId: request.parentId,
      decision: response.decision,
      reason: response.reason,
      safetyRiskLevel: request.safetyValidation.riskLevel
    }
    
    // In production, persist to secure audit log
    console.log('Parental decision logged:', logEntry)
  }

  /**
   * Gets parental review interface for parent dashboard
   */
  async getParentalReviewInterface(parentId: string): Promise<ParentalReviewInterface> {
    const pendingRequests = Array.from(this.approvalRequests.values())
      .filter(req => req.parentId === parentId && req.status === ApprovalStatus.PENDING)
      .sort((a, b) => b.priority - a.priority)

    // Get child activity summaries
    const childUserIds = Array.from(this.configs.values())
      .filter(config => config.parentId === parentId)
      .map(config => config.userId)

    const childActivity = childUserIds.map(userId => 
      this.generateChildActivitySummary(userId)
    )[0] // Simplified for single child

    const safetyAlerts = this.getSafetyAlerts(parentId)
    const weeklyReport = await this.generateWeeklyReport(childUserIds[0])

    return {
      pendingRequests,
      childActivity,
      safetyAlerts,
      weeklyReport
    }
  }

  /**
   * Generates child activity summary
   */
  private generateChildActivitySummary(userId: string): ChildActivitySummary {
    const today = new Date()
    
    return {
      userId,
      date: today,
      totalEvents: 3, // Mock data
      eventsByCategory: {
        [EventCategory.EDUCATION]: 2,
        [EventCategory.FAMILY]: 1,
        [EventCategory.HEALTH]: 0,
        [EventCategory.ENTERTAINMENT]: 0,
        [EventCategory.WORK]: 0,
        [EventCategory.PERSONAL]: 0,
        [EventCategory.TRAVEL]: 0,
        [EventCategory.OTHER]: 0
      },
      timeSpentScheduled: 180, // 3 hours
      safetyViolations: 0,
      parentalInterventions: 1
    }
  }

  /**
   * Gets safety alerts for parent
   */
  private getSafetyAlerts(parentId: string): SafetyAlert[] {
    // Mock implementation - in production, query actual alerts
    return []
  }

  /**
   * Generates weekly activity report
   */
  private async generateWeeklyReport(userId: string): Promise<WeeklyActivityReport> {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week
    
    return {
      userId,
      weekStartDate: weekStart,
      totalEvents: 15,
      safetyScore: 95,
      complianceRate: 98,
      categoryBreakdown: {
        [EventCategory.EDUCATION]: 8,
        [EventCategory.FAMILY]: 4,
        [EventCategory.HEALTH]: 2,
        [EventCategory.ENTERTAINMENT]: 1,
        [EventCategory.WORK]: 0,
        [EventCategory.PERSONAL]: 0,
        [EventCategory.TRAVEL]: 0,
        [EventCategory.OTHER]: 0
      },
      timeUsagePattern: [
        {
          timeSlot: 'Morning (6-12)',
          averageEvents: 2,
          peakDay: 'Monday',
          activityLevel: 'medium'
        },
        {
          timeSlot: 'Afternoon (12-18)',
          averageEvents: 1,
          peakDay: 'Wednesday',
          activityLevel: 'low'
        }
      ],
      recommendations: [
        'Great job maintaining a healthy schedule!',
        'Consider adding more physical activity events',
        'Schedule looks well-balanced for the week'
      ]
    }
  }

  /**
   * Updates parental control configuration
   */
  async updateParentalControls(
    childUserId: string,
    parentId: string,
    updates: Partial<ParentalControlConfig>
  ): Promise<void> {
    const config = this.configs.get(childUserId)
    if (!config) {
      throw new Error('Parental controls not found')
    }

    if (config.parentId !== parentId) {
      throw new Error('Unauthorized: Not the assigned parent')
    }

    const updatedConfig = { ...config, ...updates }
    this.configs.set(childUserId, updatedConfig)
    
    console.log(`Parental controls updated for child ${childUserId}`)
  }

  /**
   * Gets parental control configuration
   */
  getParentalControls(childUserId: string): ParentalControlConfig | undefined {
    return this.configs.get(childUserId)
  }

  /**
   * Creates a safety alert for parental notification
   */
  async createSafetyAlert(
    userId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    description: string,
    relatedContent: string
  ): Promise<SafetyAlert> {
    const alert: SafetyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      alertType,
      severity,
      description,
      relatedContent,
      timestamp: new Date(),
      acknowledged: false
    }

    if (!this.safetyAlerts.has(userId)) {
      this.safetyAlerts.set(userId, [])
    }
    
    this.safetyAlerts.get(userId)!.push(alert)
    
    // Notify parent if child has parental controls
    const config = this.configs.get(userId)
    if (config) {
      await this.notifyParentOfSafetyAlert(config.parentId, alert)
    }

    console.log(`Safety alert created: ${alertType} for user ${userId}`)
    return alert
  }

  /**
   * Processes expired approval requests
   */
  async processExpiredRequests(): Promise<void> {
    const now = new Date()
    
    for (const [requestId, request] of this.approvalRequests.entries()) {
      if (request.status === ApprovalStatus.PENDING && request.expiresAt < now) {
        request.status = ApprovalStatus.EXPIRED
        
        // Notify child that request expired
        await this.notifyChild(request.childUserId, request, {
          decision: ApprovalStatus.EXPIRED,
          respondedAt: now
        })
        
        console.log(`Approval request ${requestId} expired`)
      }
    }
  }



  /**
   * Transforms message for young children (5-8 years)
   */
  private transformForYoungChild(message: string, tone: string): string {
    let transformed = message
      .replace(/cannot/gi, 'can\'t right now')
      .replace(/inappropriate/gi, 'not quite right')
      .replace(/failed/gi, 'didn\'t work')
      .replace(/error/gi, 'oops')
      .replace(/denied/gi, 'not this time')

    switch (tone) {
      case 'encouraging':
        return `Great job trying! ${transformed} Let's try something else together! 🌟`
      case 'gentle_correction':
        return `Almost there! ${transformed} Let's make it even better! 😊`
      default:
        return `Hey there! ${transformed} 🎈`
    }
  }

  /**
   * Transforms message for older children (9-12 years)
   */
  private transformForOlderChild(message: string, tone: string): string {
    let transformed = message
      .replace(/inappropriate/gi, 'not quite suitable')
      .replace(/failed/gi, 'didn\'t go through')
      .replace(/violation/gi, 'issue')
      .replace(/blocked/gi, 'stopped')

    switch (tone) {
      case 'encouraging':
        return `Nice try! ${transformed} You're learning great planning skills!`
      case 'gentle_correction':
        return `Almost there! ${transformed} Let's adjust this together.`
      default:
        return `Hi! ${transformed}`
    }
  }

  /**
   * Transforms message for teenagers (13-17 years)
   */
  private transformForTeen(message: string, tone: string): string {
    let transformed = message
      .replace(/failed/gi, 'didn\'t work out')
      .replace(/violation/gi, 'concern')
      .replace(/blocked/gi, 'not approved')

    switch (tone) {
      case 'encouraging':
        return `Hey! ${transformed} You're getting good at planning ahead!`
      case 'gentle_correction':
        return `Hey! ${transformed} Let's figure out a better approach.`
      default:
        return `Hey! ${transformed}`
    }
  }

  /**
   * Generates alternative time suggestions
   */
  private generateAlternativeTimes(
    event: CalendarEvent,
    restrictions: TimeRestriction[]
  ): TimeSlot[] {
    const suggestions: TimeSlot[] = []
    const eventDuration = event.endTime.getTime() - event.startTime.getTime()
    
    // Generate suggestions for the next few days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const suggestedDate = new Date(event.startTime)
      suggestedDate.setDate(suggestedDate.getDate() + dayOffset)
      
      // Try different times throughout the day
      for (let hour = 8; hour <= 18; hour++) {
        const suggestedStart = new Date(suggestedDate)
        suggestedStart.setHours(hour, 0, 0, 0)
        
        const suggestedEnd = new Date(suggestedStart.getTime() + eventDuration)
        
        // Check if this time slot violates any restrictions
        const testEvent = { ...event, startTime: suggestedStart, endTime: suggestedEnd }
        if (!this.violatesTimeRestrictions(testEvent, restrictions)) {
          suggestions.push({
            startTime: suggestedStart,
            endTime: suggestedEnd,
            reason: 'Available time slot'
          })
          
          if (suggestions.length >= 5) break // Limit suggestions
        }
      }
      
      if (suggestions.length >= 5) break
    }
    
    return suggestions
  }

  /**
   * Notifies parent of safety alert
   */
  private async notifyParentOfSafetyAlert(parentId: string, alert: SafetyAlert): Promise<void> {
    const notification = {
      to: parentId,
      subject: `Safety Alert: ${alert.alertType}`,
      message: `Safety alert for your child: ${alert.description}`,
      severity: alert.severity,
      timestamp: alert.timestamp
    }

    // In production, send through notification system
    console.log(`Safety alert notification sent to parent ${parentId}:`, notification.subject)
  }

  /**
   * Removes parental controls (when child becomes adult)
   */
  async removeParentalControls(childUserId: string, parentId: string): Promise<void> {
    const config = this.configs.get(childUserId)
    if (!config) return

    if (config.parentId !== parentId) {
      throw new Error('Unauthorized: Not the assigned parent')
    }

    this.configs.delete(childUserId)
    
    // Clean up related data
    this.approvalRequests.forEach((request, id) => {
      if (request.childUserId === childUserId) {
        this.approvalRequests.delete(id)
      }
    })
    
    console.log(`Parental controls removed for user ${childUserId}`)
  }

  /**
   * Requests approval for external calendar connection
   */
  async requestExternalCalendarApproval(
    childUserId: string,
    provider: string,
    accountEmail: string,
    requestedPermissions: string[],
    dataAccessLevel: 'read_only' | 'read_write' | 'full_access',
    justification: string
  ): Promise<string> {
    const config = this.configs.get(childUserId)
    if (!config) {
      throw new Error('Parental controls not configured for user')
    }

    // Check if provider is allowed
    const controls = config.externalCalendarControls
    const providerAllowed = this.isProviderAllowed(provider, controls)
    
    if (!providerAllowed) {
      throw new Error(`External calendar provider ${provider} is not allowed`)
    }

    // Check domain restrictions
    const domain = accountEmail.split('@')[1]
    if (controls.blockedDomains.includes(domain)) {
      throw new Error(`Domain ${domain} is blocked`)
    }

    const requestId = `ext_cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const request: ExternalCalendarApprovalRequest = {
      id: requestId,
      childUserId,
      parentId: config.parentId,
      provider,
      accountEmail,
      requestedPermissions,
      dataAccessLevel,
      justification,
      requestedAt: new Date(),
      status: ApprovalStatus.PENDING
    }

    this.externalCalendarRequests.set(requestId, request)

    // Send notification to parent
    await this.notifyParentExternalCalendar(config.parentId, request)

    console.log(`External calendar approval request ${requestId} submitted for ${provider}`)
    return requestId
  }

  /**
   * Approves or denies external calendar connection
   */
  async respondToExternalCalendarRequest(
    requestId: string,
    parentId: string,
    decision: ApprovalStatus,
    reason?: string,
    restrictions?: Partial<DataShareRestriction>
  ): Promise<void> {
    const request = this.externalCalendarRequests.get(requestId)
    if (!request) {
      throw new Error('External calendar request not found')
    }

    if (request.parentId !== parentId) {
      throw new Error('Unauthorized: Not the assigned parent')
    }

    request.status = decision

    if (decision === ApprovalStatus.APPROVED && restrictions) {
      // Apply additional restrictions
      const config = this.configs.get(request.childUserId)
      if (config) {
        const existingRestriction = config.externalCalendarControls.dataShareRestrictions
          .find(r => r.provider === request.provider)
        
        if (existingRestriction) {
          Object.assign(existingRestriction, restrictions)
        } else {
          config.externalCalendarControls.dataShareRestrictions.push({
            provider: request.provider,
            allowPersonalData: false,
            allowLocationData: false,
            allowAttendeeData: false,
            allowAttachments: false,
            maxDataRetention: 30,
            ...restrictions
          })
        }
      }
    }

    // Notify child of decision
    await this.notifyChildExternalCalendarDecision(request.childUserId, request, decision, reason)

    console.log(`External calendar request ${requestId} ${decision} by parent ${parentId}`)
  }

  /**
   * Gets comprehensive schedule review interface for parents
   */
  async getScheduleReviewInterface(parentId: string, childUserId: string): Promise<ScheduleReviewInterface> {
    const config = this.configs.get(childUserId)
    if (!config || config.parentId !== parentId) {
      throw new Error('Unauthorized or child not found')
    }

    const upcomingEvents: CalendarEvent[] = [] // In production, fetch from calendar store
    const recentActivity = this.activityHistory.get(childUserId) || []
    const pendingApprovals = Array.from(this.approvalRequests.values())
      .filter(req => req.childUserId === childUserId && req.status === ApprovalStatus.PENDING)
    const safetyAlerts = this.safetyAlerts.get(childUserId) || []

    const complianceMetrics: ComplianceMetrics = {
      timeRestrictionCompliance: 95,
      contentSafetyScore: 98,
      approvalResponseRate: 100,
      averageResponseTime: 2.5,
      violationTrends: []
    }

    const recommendedActions: RecommendedAction[] = [
      {
        type: 'content_filter',
        priority: 'low',
        description: 'Consider updating content filters',
        suggestedChange: 'Add new blocked keywords based on recent trends'
      }
    ]

    return {
      childId: childUserId,
      childName: 'Child User', // In production, fetch from user profile
      upcomingEvents,
      recentActivity,
      pendingApprovals,
      safetyAlerts,
      complianceMetrics,
      recommendedActions
    }
  }

  /**
   * Enforces time restrictions for child schedules
   */
  async enforceTimeRestrictions(
    event: CalendarEvent,
    userId: string
  ): Promise<TimeRestrictionResult> {
    const config = this.configs.get(userId)
    if (!config) {
      return { allowed: true }
    }

    const violations = this.violatesTimeRestrictions(event, config.timeRestrictions)
    
    if (!violations) {
      return { allowed: true }
    }

    // Find the violated restriction
    const violatedRestriction = config.timeRestrictions.find(restriction => {
      if (!restriction.isActive) return false
      
      const eventDay = event.startTime.getDay()
      const eventTime = `${event.startTime.getHours().toString().padStart(2, '0')}:${event.startTime.getMinutes().toString().padStart(2, '0')}`
      
      return restriction.daysOfWeek.includes(eventDay) &&
             this.isTimeInRange(eventTime, restriction.startTime, restriction.endTime)
    })

    const suggestedTimes = this.generateAlternativeTimes(event, config.timeRestrictions)

    return {
      allowed: false,
      reason: `Event conflicts with ${violatedRestriction?.name || 'time restriction'}`,
      violatedRestriction: violatedRestriction?.name,
      suggestedTimes
    }
  }

  /**
   * Generates child-friendly messages
   */
  generateChildFriendlyMessage(
    originalMessage: string,
    ageGroup: 'young_child' | 'older_child' | 'teen',
    tone: 'encouraging' | 'informative' | 'gentle_correction'
  ): ChildFriendlyMessage {
    let childFriendlyVersion = originalMessage

    // Apply age-appropriate language transformations
    switch (ageGroup) {
      case 'young_child':
        childFriendlyVersion = this.transformForYoungChild(originalMessage, tone)
        break
      case 'older_child':
        childFriendlyVersion = this.transformForOlderChild(originalMessage, tone)
        break
      case 'teen':
        childFriendlyVersion = this.transformForTeen(originalMessage, tone)
        break
    }

    return {
      originalMessage,
      childFriendlyVersion,
      ageGroup,
      tone
    }
  }

  /**
   * Provides family visibility controls
   */
  async getFamilyVisibility(
    requestingUserId: string,
    targetUserId: string
  ): Promise<FamilyVisibilityResult> {
    const targetConfig = this.configs.get(targetUserId)
    
    // If target user has no parental controls, allow access
    if (!targetConfig) {
      return {
        canView: true,
        visibleEvents: [],
        reason: undefined
      }
    }

    const settings = targetConfig.familyVisibilitySettings
    
    // Check if requesting user is the parent
    if (requestingUserId === targetConfig.parentId) {
      if (settings.showChildSchedulesToParents) {
        return {
          canView: true,
          visibleEvents: [],
          reason: undefined
        }
      }
    }

    // Check if requesting user is the child viewing parent
    const requestingConfig = this.configs.get(requestingUserId)
    if (requestingConfig && requestingConfig.parentId === targetUserId) {
      if (settings.showParentSchedulesToChildren) {
        return {
          canView: true,
          visibleEvents: [],
          reason: undefined
        }
      } else {
        return {
          canView: false,
          visibleEvents: [],
          reason: 'Family visibility settings prevent viewing parent schedules'
        }
      }
    }

    // Default to no access for other users
    return {
      canView: false,
      visibleEvents: [],
      reason: 'No permission to view this user\'s schedule'
    }
  }

  // Private helper methods

  private isProviderAllowed(provider: string, controls: ExternalCalendarControls): boolean {
    switch (provider.toLowerCase()) {
      case 'google':
        return controls.allowGoogleCalendar
      case 'microsoft':
      case 'outlook':
        return controls.allowMicrosoftOutlook
      case 'apple':
      case 'icloud':
        return controls.allowAppleICloud
      case 'caldav':
        return controls.allowCalDAV
      case 'ics':
        return controls.allowICSSubscriptions
      default:
        return false
    }
  }

  /**
   * Notifies parent about external calendar request
   */
  private async notifyParentExternalCalendar(parentId: string, request: ExternalCalendarApprovalRequest): Promise<void> {
    const notification = {
      to: parentId,
      subject: `External Calendar Request: ${request.provider}`,
      message: `Your child has requested to connect ${request.provider} calendar (${request.accountEmail})`,
      requestId: request.id
    }

    // In production, send through notification system
    console.log(`External calendar notification sent to parent ${parentId}:`, notification.subject)
  }

  /**
   * Notifies child about external calendar decision
   */
  private async notifyChildExternalCalendarDecision(
    childUserId: string,
    request: ExternalCalendarApprovalRequest,
    decision: ApprovalStatus,
    reason?: string
  ): Promise<void> {
    const message = decision === ApprovalStatus.APPROVED
      ? `Great! Your ${request.provider} calendar connection has been approved.`
      : `Your ${request.provider} calendar connection request was not approved. ${reason || ''}`

    // In production, send through child-friendly notification system
    console.log(`External calendar decision sent to child ${childUserId}:`, message)
  }
}