// Calendar system types and interfaces

export enum Priority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Import types from scheduling
import { TimeRange, ScheduleConflict, ConflictType, ConflictLevel } from '../scheduling/types'

export interface CalendarEvent {
  id: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  allDay: boolean
  recurrence?: RecurrencePattern
  location?: LocationInfo
  attendees: Attendee[]
  category: EventCategory
  priority: Priority
  visibility: VisibilityLevel
  reminders: ReminderSettings[]
  metadata: EventMetadata
  createdAt: Date
  updatedAt: Date
  createdBy: string
  isPrivate: boolean
  externalEventId?: string
  providerId?: string
}

export interface RecurrencePattern {
  frequency: RecurrenceFrequency
  interval: number
  daysOfWeek?: DayOfWeek[]
  dayOfMonth?: number
  monthOfYear?: number
  endDate?: Date
  occurrenceCount?: number
  exceptions: Date[]
  timezone?: string
}

export enum RecurrenceFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

export interface LocationInfo {
  name: string
  address?: string
  coordinates?: {
    latitude: number
    longitude: number
  }
  type: LocationType
}

export enum LocationType {
  HOME = 'home',
  WORK = 'work',
  SCHOOL = 'school',
  OTHER = 'other'
}

export interface Attendee {
  id: string
  name: string
  email?: string
  role: AttendeeRole
  status: AttendeeStatus
  isRequired: boolean
}

export enum AttendeeRole {
  ORGANIZER = 'organizer',
  REQUIRED = 'required',
  OPTIONAL = 'optional',
  RESOURCE = 'resource'
}

export enum AttendeeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  TENTATIVE = 'tentative'
}

export enum EventCategory {
  WORK = 'work',
  PERSONAL = 'personal',
  FAMILY = 'family',
  EDUCATION = 'education',
  HEALTH = 'health',
  ENTERTAINMENT = 'entertainment',
  TRAVEL = 'travel',
  OTHER = 'other'
}

export enum VisibilityLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  FAMILY = 'family',
  CONFIDENTIAL = 'confidential'
}

export interface ReminderSettings {
  id: string
  type: ReminderType
  offsetMinutes: number
  method: NotificationMethod
  isEnabled: boolean
}

export enum ReminderType {
  POPUP = 'popup',
  EMAIL = 'email',
  VOICE = 'voice',
  AVATAR = 'avatar'
}

export enum NotificationMethod {
  VOICE = 'voice',
  VISUAL = 'visual',
  AVATAR = 'avatar',
  SOUND = 'sound',
  VIBRATION = 'vibration'
}

export interface EventMetadata {
  source: EventSource
  syncStatus: SyncStatus
  lastSyncTime?: Date
  conflictStatus: ConflictStatus
  safetyValidated: boolean
  safetyValidatedAt?: Date
  tags: string[]
  customFields: Record<string, any>
}

export enum EventSource {
  LOCAL = 'local',
  GOOGLE_CALENDAR = 'google_calendar',
  MICROSOFT_OUTLOOK = 'microsoft_outlook',
  APPLE_ICLOUD = 'apple_icloud',
  CALDAV = 'caldav',
  ICS_SUBSCRIPTION = 'ics_subscription'
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict',
  ERROR = 'error',
  NOT_SYNCED = 'not_synced'
}

export enum ConflictStatus {
  NONE = 'none',
  DETECTED = 'detected',
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved'
}

export interface EventFilter {
  userId?: string
  timeRange?: TimeRange
  categories?: EventCategory[]
  priorities?: Priority[]
  visibility?: VisibilityLevel[]
  searchText?: string
  includeRecurring?: boolean
  attendeeId?: string
}

export interface EventChanges {
  title?: string
  description?: string
  startTime?: Date
  endTime?: Date
  location?: LocationInfo
  attendees?: Attendee[]
  category?: EventCategory
  priority?: Priority
  visibility?: VisibilityLevel
  reminders?: ReminderSettings[]
  recurrence?: RecurrencePattern
}

export interface CalendarView {
  type: ViewType
  startDate: Date
  endDate: Date
  events: CalendarEvent[]
  conflicts: ScheduleConflict[]
}

export enum ViewType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  AGENDA = 'agenda'
}

// Re-export types and enums from scheduling for convenience
export type { TimeRange, ScheduleConflict }
export { ConflictType, ConflictLevel } from '../scheduling/types'