// Reminder system types and interfaces

import { Priority, RecurrencePattern, NotificationMethod } from '../calendar/types'

export interface Reminder {
  id: string
  userId: string
  eventId?: string
  title: string
  description: string
  type: ReminderType
  triggerTime: Date
  recurrence?: RecurrencePattern
  priority: Priority
  deliveryMethods: NotificationMethod[]
  contextConstraints: ContextConstraint[]
  escalationRules: EscalationRule[]
  completionStatus: CompletionStatus
  snoozeHistory: SnoozeRecord[]
  userFeedback: ReminderFeedback[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export enum ReminderType {
  TIME_BASED = 'time_based',
  LOCATION_BASED = 'location_based',
  CONTEXT_BASED = 'context_based',
  EVENT_REMINDER = 'event_reminder',
  TASK_REMINDER = 'task_reminder'
}

export interface ContextConstraint {
  type: ContextType
  condition: ContextCondition
  value: any
  priority: Priority
}

export enum ContextType {
  LOCATION = 'location',
  ACTIVITY = 'activity',
  AVAILABILITY = 'availability',
  TIME_OF_DAY = 'time_of_day',
  DEVICE_PROXIMITY = 'device_proximity',
  FAMILY_PRESENCE = 'family_presence'
}

export enum ContextCondition {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  IN_RANGE = 'in_range'
}

export interface EscalationRule {
  id: string
  delayMinutes: number
  escalationMethod: NotificationMethod
  maxEscalations: number
  escalationMessage?: string
  isEnabled: boolean
}

export enum CompletionStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
  COMPLETED = 'completed',
  SNOOZED = 'snoozed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export interface SnoozeRecord {
  snoozeTime: Date
  snoozeDuration: number
  reason?: string
  newTriggerTime: Date
}

export interface ReminderFeedback {
  feedbackTime: Date
  feedbackType: FeedbackType
  rating?: number
  comment?: string
  wasHelpful: boolean
}

export enum FeedbackType {
  TIMING = 'timing',
  DELIVERY_METHOD = 'delivery_method',
  CONTENT = 'content',
  FREQUENCY = 'frequency',
  GENERAL = 'general'
}

export interface ReminderBatch {
  id: string
  reminders: Reminder[]
  batchTime: Date
  deliveryMethod: NotificationMethod
  priority: Priority
  estimatedDeliveryTime: Date
}

export interface ReminderProcessingResult {
  processedCount: number
  deliveredCount: number
  failedCount: number
  snoozedCount: number
  errors: ReminderError[]
  nextProcessingTime: Date
}

export interface ReminderError {
  reminderId: string
  errorType: ReminderErrorType
  errorMessage: string
  timestamp: Date
  retryCount: number
  canRetry: boolean
}

export enum ReminderErrorType {
  DELIVERY_FAILED = 'delivery_failed',
  CONTEXT_UNAVAILABLE = 'context_unavailable',
  USER_UNAVAILABLE = 'user_unavailable',
  SYSTEM_ERROR = 'system_error',
  VALIDATION_ERROR = 'validation_error'
}

export interface UserContext {
  userId: string
  currentActivity: ActivityType
  location: LocationInfo
  availability: AvailabilityStatus
  interruptibility: InterruptibilityLevel
  deviceProximity: DeviceProximity
  timeOfDay: TimeContext
  historicalPatterns: BehaviorPattern[]
  lastUpdated: Date
}

export enum ActivityType {
  SLEEPING = 'sleeping',
  WORKING = 'working',
  EATING = 'eating',
  EXERCISING = 'exercising',
  COMMUTING = 'commuting',
  RELAXING = 'relaxing',
  SOCIALIZING = 'socializing',
  UNKNOWN = 'unknown'
}

export interface LocationInfo {
  name: string
  coordinates?: {
    latitude: number
    longitude: number
  }
  type: LocationType
  confidence: number
}

export enum LocationType {
  HOME = 'home',
  WORK = 'work',
  SCHOOL = 'school',
  COMMUTE = 'commute',
  OTHER = 'other'
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  DO_NOT_DISTURB = 'do_not_disturb',
  AWAY = 'away'
}

export enum InterruptibilityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none'
}

export interface DeviceProximity {
  isNearby: boolean
  distance?: number
  lastSeen: Date
  deviceType: string
}

export interface TimeContext {
  hour: number
  dayOfWeek: number
  isWeekend: boolean
  isHoliday: boolean
  timeZone: string
}

export interface BehaviorPattern {
  patternType: PatternType
  frequency: number
  confidence: number
  lastObserved: Date
  metadata: Record<string, any>
}

export enum PatternType {
  WAKE_TIME = 'wake_time',
  SLEEP_TIME = 'sleep_time',
  WORK_HOURS = 'work_hours',
  MEAL_TIMES = 'meal_times',
  EXERCISE_TIME = 'exercise_time',
  RESPONSE_PREFERENCE = 'response_preference'
}

export interface DeferralDecision {
  shouldDefer: boolean
  deferUntil?: Date
  reason: string
  confidence: number
  alternativeDeliveryMethods?: NotificationMethod[]
}

export interface ContextFeedback {
  userId: string
  contextTime: Date
  actualContext: UserContext
  predictedContext: UserContext
  accuracy: number
  corrections: ContextCorrection[]
}

export interface ContextCorrection {
  field: string
  actualValue: any
  predictedValue: any
  importance: number
}