// Family coordination types and interfaces

import { 
  TimeRange, 
  TimeSlot, 
  ScheduleConflict, 
  ConflictResolution, 
  Priority,
  AvailabilityStatus 
} from './types'
import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { Reminder } from '../reminders/types'

export interface FamilyMember {
  userId: string
  familyId: string
  displayName: string
  role: FamilyRole
  permissions: MemberPermissions
  visibility: VisibilitySettings
  availability: AvailabilitySchedule
  preferences: MemberPreferences
  isActive: boolean
  joinedAt: Date
  lastActiveAt: Date
}

export enum FamilyRole {
  PARENT = 'parent',
  GUARDIAN = 'guardian',
  CHILD = 'child',
  TEEN = 'teen',
  ADULT_CHILD = 'adult_child',
  CAREGIVER = 'caregiver'
}

export interface MemberPermissions {
  canCreateFamilyEvents: boolean
  canModifyFamilyEvents: boolean
  canDeleteFamilyEvents: boolean
  canViewOtherSchedules: boolean
  canModifyOtherSchedules: boolean
  requiresApproval: boolean
  approvalRequired: ApprovalType[]
  timeRestrictions: TimeRestriction[]
  maxEventDuration: number // minutes
  allowedCategories: EventCategory[]
}

export enum ApprovalType {
  EVENT_CREATION = 'event_creation',
  EVENT_MODIFICATION = 'event_modification',
  EVENT_DELETION = 'event_deletion',
  REMINDER_CREATION = 'reminder_creation',
  SCHEDULE_SHARING = 'schedule_sharing',
  EXTERNAL_CALENDAR_SYNC = 'external_calendar_sync'
}

export interface TimeRestriction {
  type: RestrictionType
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  daysOfWeek: number[] // 0-6, Sunday = 0
  isActive: boolean
  reason: string
}

export enum RestrictionType {
  BEDTIME = 'bedtime',
  SCHOOL_HOURS = 'school_hours',
  STUDY_TIME = 'study_time',
  FAMILY_TIME = 'family_time',
  SCREEN_TIME_LIMIT = 'screen_time_limit',
  CUSTOM = 'custom'
}

export interface VisibilitySettings {
  defaultVisibility: VisibilityLevel
  shareWithFamily: boolean
  shareCalendarDetails: boolean
  shareLocationInfo: boolean
  shareAvailability: boolean
  hiddenCategories: EventCategory[]
  privateKeywords: string[]
}

export interface AvailabilitySchedule {
  userId: string
  timeSlots: AvailabilitySlot[]
  defaultAvailability: AvailabilityStatus
  workingHours?: WorkingHours
  recurringUnavailability: RecurringUnavailability[]
  lastUpdated: Date
}

export interface AvailabilitySlot {
  startTime: Date
  endTime: Date
  status: AvailabilityStatus
  reason?: string
  isRecurring: boolean
  priority: Priority
}

export interface WorkingHours {
  monday?: DaySchedule
  tuesday?: DaySchedule
  wednesday?: DaySchedule
  thursday?: DaySchedule
  friday?: DaySchedule
  saturday?: DaySchedule
  sunday?: DaySchedule
  timezone: string
}

export interface DaySchedule {
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  breaks: TimeBreak[]
  isWorkingDay: boolean
}

export interface TimeBreak {
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  type: BreakType
  description?: string
}

export enum BreakType {
  LUNCH = 'lunch',
  MEETING = 'meeting',
  PERSONAL = 'personal',
  COMMUTE = 'commute'
}

export interface RecurringUnavailability {
  id: string
  title: string
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  daysOfWeek: number[]
  startDate: Date
  endDate?: Date
  reason: string
  priority: Priority
}

export interface MemberPreferences {
  preferredMeetingTimes: TimeRange[]
  blackoutTimes: TimeRange[]
  notificationPreferences: FamilyNotificationPreferences
  schedulingPreferences: SchedulingPreferences
  privacyPreferences: PrivacyPreferences
}

export interface FamilyNotificationPreferences {
  enableFamilyNotifications: boolean
  notifyOnFamilyEvents: boolean
  notifyOnConflicts: boolean
  notifyOnInvitations: boolean
  preferredNotificationMethods: NotificationMethod[]
  quietHours: TimeRange[]
}

export enum NotificationMethod {
  VOICE = 'voice',
  VISUAL = 'visual',
  AVATAR = 'avatar',
  SOUND = 'sound'
}

export interface SchedulingPreferences {
  autoAcceptFamilyEvents: boolean
  suggestAlternativeTimes: boolean
  bufferTimeMinutes: number
  preferredEventDuration: number
  maxDailyEvents: number
  preferredDaysOff: number[]
}

export interface PrivacyPreferences {
  shareDetailedSchedule: boolean
  shareAvailabilityOnly: boolean
  allowFamilyModifications: boolean
  requireConfirmationForChanges: boolean
  hidePersonalEvents: boolean
}

export interface FamilyEvent {
  id: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  location?: string
  category: EventCategory
  priority: Priority
  organizerId: string
  requiredAttendees: string[]
  optionalAttendees: string[]
  attendeeResponses: Map<string, AttendeeResponse>
  rsvpRequired: boolean
  rsvpDeadline?: Date
  isRecurring: boolean
  recurrence?: RecurrencePattern
  familyId: string
  visibility: VisibilityLevel
  approvalStatus: ApprovalStatus
  approvedBy?: string[]
  createdAt: Date
  updatedAt: Date
  metadata: FamilyEventMetadata
}

export interface AttendeeResponse {
  userId: string
  response: ResponseType
  responseTime: Date
  note?: string
  delegatedTo?: string
}

export enum ResponseType {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TENTATIVE = 'tentative',
  DELEGATED = 'delegated'
}

export interface RecurrencePattern {
  frequency: RecurrenceFrequency
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  monthOfYear?: number
  endDate?: Date
  occurrenceCount?: number
  exceptions: Date[]
}

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_APPROVAL = 'requires_approval',
  AUTO_APPROVED = 'auto_approved'
}

export interface FamilyEventMetadata {
  createdBy: string
  lastModifiedBy: string
  approvalHistory: ApprovalRecord[]
  conflictHistory: ConflictRecord[]
  notificationsSent: NotificationRecord[]
  attendanceTracking: AttendanceRecord[]
}

export interface ApprovalRecord {
  approverId: string
  action: ApprovalAction
  timestamp: Date
  reason?: string
  conditions?: string[]
}

export enum ApprovalAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUESTED_CHANGES = 'requested_changes',
  DELEGATED = 'delegated'
}

export interface ConflictRecord {
  conflictId: string
  conflictType: ConflictType
  detectedAt: Date
  resolvedAt?: Date
  resolution?: ConflictResolution
  affectedMembers: string[]
}

export enum ConflictType {
  TIME_OVERLAP = 'time_overlap',
  RESOURCE_CONFLICT = 'resource_conflict',
  PERMISSION_CONFLICT = 'permission_conflict',
  APPROVAL_CONFLICT = 'approval_conflict'
}

export interface NotificationRecord {
  notificationId: string
  recipientId: string
  notificationType: FamilyNotificationType
  sentAt: Date
  deliveryMethod: NotificationMethod
  acknowledged: boolean
  acknowledgedAt?: Date
}

export enum FamilyNotificationType {
  EVENT_INVITATION = 'event_invitation',
  EVENT_REMINDER = 'event_reminder',
  EVENT_CANCELLED = 'event_cancelled',
  EVENT_MODIFIED = 'event_modified',
  CONFLICT_DETECTED = 'conflict_detected',
  APPROVAL_REQUIRED = 'approval_required',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_DENIED = 'approval_denied'
}

export interface AttendanceRecord {
  userId: string
  eventId: string
  expectedAttendance: boolean
  actualAttendance?: boolean
  checkInTime?: Date
  checkOutTime?: Date
  notes?: string
}

export interface FamilySchedule {
  familyId: string
  members: FamilyMember[]
  sharedEvents: FamilyEvent[]
  memberSchedules: Map<string, MemberSchedule>
  conflictResolutions: ConflictResolution[]
  permissions: FamilyPermissions
  preferences: FamilyPreferences
  lastUpdated: Date
}

export interface MemberSchedule {
  userId: string
  events: CalendarEvent[]
  reminders: Reminder[]
  availability: AvailabilitySchedule
  conflicts: ScheduleConflict[]
  lastSyncTime: Date
}

export interface FamilyPermissions {
  familyId: string
  defaultMemberPermissions: MemberPermissions
  roleBasedPermissions: Map<FamilyRole, MemberPermissions>
  customPermissions: Map<string, MemberPermissions>
  parentalControls: ParentalControls
  lastUpdated: Date
}

export interface ParentalControls {
  enabled: boolean
  requireApprovalForChildren: boolean
  timeRestrictions: Map<string, TimeRestriction[]>
  contentFiltering: ContentFiltering
  supervisionSettings: SupervisionSettings
}

export interface ContentFiltering {
  enabled: boolean
  blockedKeywords: string[]
  allowedCategories: EventCategory[]
  requireApprovalForExternal: boolean
  safetyValidationRequired: boolean
}

export interface SupervisionSettings {
  trackAttendance: boolean
  requireCheckIn: boolean
  locationTracking: boolean
  notifyOnMissedEvents: boolean
  escalationRules: EscalationRule[]
}

export interface EscalationRule {
  condition: EscalationCondition
  action: EscalationAction
  delayMinutes: number
  recipients: string[]
}

export enum EscalationCondition {
  MISSED_EVENT = 'missed_event',
  LATE_ARRIVAL = 'late_arrival',
  NO_CHECK_IN = 'no_check_in',
  UNAUTHORIZED_CHANGE = 'unauthorized_change'
}

export enum EscalationAction {
  NOTIFY_PARENTS = 'notify_parents',
  SEND_REMINDER = 'send_reminder',
  RESTRICT_PERMISSIONS = 'restrict_permissions',
  REQUIRE_APPROVAL = 'require_approval'
}

export interface FamilyPreferences {
  familyId: string
  coordinationSettings: CoordinationSettings
  notificationSettings: FamilyNotificationSettings
  privacySettings: FamilyPrivacySettings
  schedulingDefaults: SchedulingDefaults
}

export interface CoordinationSettings {
  autoResolveConflicts: boolean
  suggestMeetingTimes: boolean
  enableFamilyCalendar: boolean
  shareAvailability: boolean
  requireRSVP: boolean
  defaultRSVPDeadlineHours: number
}

export interface FamilyNotificationSettings {
  enableFamilyNotifications: boolean
  notificationMethods: NotificationMethod[]
  quietHours: TimeRange[]
  urgentNotificationOverride: boolean
  batchNotifications: boolean
  maxNotificationsPerHour: number
}

export interface FamilyPrivacySettings {
  defaultEventVisibility: VisibilityLevel
  allowMemberVisibilityOverride: boolean
  shareLocationData: boolean
  shareAttendanceData: boolean
  externalSharingAllowed: boolean
  dataRetentionDays: number
}

export interface SchedulingDefaults {
  defaultEventDuration: number
  defaultBufferTime: number
  defaultPriority: Priority
  defaultCategory: EventCategory
  autoAcceptFamilyEvents: boolean
  suggestOptimalTimes: boolean
}

export interface FamilyAvailability {
  familyId: string
  timeRange: TimeRange
  memberAvailability: Map<string, TimeSlot[]>
  commonAvailableSlots: TimeSlot[]
  conflicts: ScheduleConflict[]
  suggestedMeetingTimes: TimeSlot[]
  lastCalculated: Date
}

export interface CoordinationResult {
  success: boolean
  eventId: string
  confirmedAttendees: string[]
  pendingAttendees: string[]
  declinedAttendees: string[]
  conflicts: ScheduleConflict[]
  suggestedAlternatives: TimeSlot[]
  approvalRequired: boolean
  approvalRequiredFrom: string[]
  notifications: NotificationRecord[]
}

export interface FamilyMeetingTimeRequest {
  familyId: string
  organizerId: string
  requiredAttendees: string[]
  optionalAttendees: string[]
  duration: number // minutes
  preferredTimeRanges: TimeRange[]
  blackoutTimes: TimeRange[]
  priority: Priority
  category: EventCategory
  constraints: MeetingConstraints
}

export interface MeetingConstraints {
  minAttendees: number
  maxAttendees: number
  requireAllRequired: boolean
  allowPartialAvailability: boolean
  bufferTimeMinutes: number
  preferredDaysOfWeek: number[]
  avoidWeekends: boolean
  workingHoursOnly: boolean
}

export interface FamilyConflictResolution {
  conflictId: string
  familyId: string
  conflictType: ConflictType
  affectedMembers: string[]
  conflictingEvents: string[]
  detectedAt: Date
  severity: ConflictSeverity
  resolutionOptions: ResolutionOption[]
  selectedResolution?: ResolutionOption
  resolvedAt?: Date
  resolvedBy?: string
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ResolutionOption {
  id: string
  strategy: ResolutionStrategy
  description: string
  impact: ResolutionImpact
  alternativeTimeSlots?: TimeSlot[]
  requiredActions: RequiredAction[]
  affectedMembers: string[]
  estimatedEffort: EffortLevel
}

export enum ResolutionStrategy {
  RESCHEDULE_EVENT = 'reschedule_event',
  SPLIT_ATTENDEES = 'split_attendees',
  PRIORITIZE_EVENT = 'prioritize_event',
  DELEGATE_ATTENDANCE = 'delegate_attendance',
  CANCEL_CONFLICTING = 'cancel_conflicting',
  MODIFY_DURATION = 'modify_duration',
  CHANGE_LOCATION = 'change_location'
}

export interface ResolutionImpact {
  affectedEvents: number
  affectedMembers: number
  timeChanges: number
  cancellations: number
  newConflicts: number
  memberSatisfaction: number // 0-1 scale
}

export interface RequiredAction {
  type: ActionType
  description: string
  assignedTo: string
  dueDate?: Date
  priority: Priority
  completed: boolean
}

export enum ActionType {
  NOTIFY_MEMBER = 'notify_member',
  RESCHEDULE_EVENT = 'reschedule_event',
  UPDATE_AVAILABILITY = 'update_availability',
  SEND_INVITATION = 'send_invitation',
  CANCEL_EVENT = 'cancel_event',
  MODIFY_PERMISSIONS = 'modify_permissions'
}

export enum EffortLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// Family coordination events
export interface FamilyCoordinationEvent {
  type: FamilyEventType
  familyId: string
  userId?: string
  eventId?: string
  timestamp: Date
  data: any
}

export enum FamilyEventType {
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  PERMISSIONS_UPDATED = 'permissions_updated',
  FAMILY_EVENT_CREATED = 'family_event_created',
  FAMILY_EVENT_UPDATED = 'family_event_updated',
  FAMILY_EVENT_CANCELLED = 'family_event_cancelled',
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_DENIED = 'approval_denied',
  RSVP_RECEIVED = 'rsvp_received',
  ATTENDANCE_RECORDED = 'attendance_recorded'
}