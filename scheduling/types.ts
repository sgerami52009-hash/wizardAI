// Core scheduling system types and interfaces

export interface TimeRange {
  startTime: Date
  endTime: Date
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  isAvailable: boolean
  conflictLevel?: ConflictLevel
}

export enum ConflictLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface ScheduleConflict {
  id: string
  conflictType: ConflictType
  conflictingEvents: string[]
  severity: ConflictLevel
  suggestedResolutions: ConflictResolution[]
  detectedAt: Date
}

export enum ConflictType {
  TIME_OVERLAP = 'time_overlap',
  RESOURCE_CONFLICT = 'resource_conflict',
  FAMILY_CONFLICT = 'family_conflict',
  PRIORITY_CONFLICT = 'priority_conflict'
}

export interface ConflictResolution {
  id: string
  strategy: ResolutionStrategy
  description: string
  alternativeTimeSlots?: TimeSlot[]
  requiredActions: string[]
}

export enum ResolutionStrategy {
  RESCHEDULE = 'reschedule',
  PRIORITIZE = 'prioritize',
  SPLIT_EVENT = 'split_event',
  DELEGATE = 'delegate',
  CANCEL = 'cancel'
}

export interface SchedulingConstraints {
  preferredTimes: TimeRange[]
  blackoutTimes: TimeRange[]
  minimumDuration: number
  maximumDuration: number
  requiredAttendees: string[]
  optionalAttendees: string[]
  location?: string
  priority: Priority
}

export enum Priority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface Schedule {
  userId: string
  events: CalendarEvent[]
  reminders: Reminder[]
  availability: AvailabilitySchedule
  lastUpdated: Date
}

export interface AvailabilitySchedule {
  userId: string
  timeSlots: AvailabilitySlot[]
  defaultAvailability: AvailabilityStatus
  lastUpdated: Date
}

export interface AvailabilitySlot {
  startTime: Date
  endTime: Date
  status: AvailabilityStatus
  reason?: string
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  TENTATIVE = 'tentative',
  OUT_OF_OFFICE = 'out_of_office'
}

// Forward declarations for types defined in other modules
export interface CalendarEvent {
  id: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  // Additional properties defined in calendar/types.ts
}

export interface Reminder {
  id: string
  userId: string
  title: string
  triggerTime: Date
  // Additional properties defined in reminders/types.ts
}