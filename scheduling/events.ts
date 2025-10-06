// Event bus integration for scheduling system state changes and notifications

import { EventEmitter } from 'events'
import { CalendarEvent } from '../calendar/types'
import { Reminder } from '../reminders/types'
import { SyncResult, SyncConflict } from '../sync/types'
import { ScheduleConflict } from './types'

export interface ScheduleEventBus extends EventEmitter {
  // Calendar events
  emit(event: 'calendar:event:created', data: CalendarEventCreatedData): boolean
  emit(event: 'calendar:event:updated', data: CalendarEventUpdatedData): boolean
  emit(event: 'calendar:event:deleted', data: CalendarEventDeletedData): boolean
  emit(event: 'calendar:conflict:detected', data: ConflictDetectedData): boolean
  emit(event: 'calendar:conflict:resolved', data: ConflictResolvedData): boolean

  // Reminder events
  emit(event: 'reminder:created', data: ReminderCreatedData): boolean
  emit(event: 'reminder:triggered', data: ReminderTriggeredData): boolean
  emit(event: 'reminder:delivered', data: ReminderDeliveredData): boolean
  emit(event: 'reminder:completed', data: ReminderCompletedData): boolean
  emit(event: 'reminder:snoozed', data: ReminderSnoozedData): boolean
  emit(event: 'reminder:failed', data: ReminderFailedData): boolean

  // Sync events
  emit(event: 'sync:started', data: SyncStartedData): boolean
  emit(event: 'sync:completed', data: SyncCompletedData): boolean
  emit(event: 'sync:failed', data: SyncFailedData): boolean
  emit(event: 'sync:conflict', data: SyncConflictData): boolean

  // Family coordination events
  emit(event: 'family:event:created', data: FamilyEventCreatedData): boolean
  emit(event: 'family:availability:changed', data: AvailabilityChangedData): boolean
  emit(event: 'family:conflict:detected', data: FamilyConflictDetectedData): boolean

  // System events
  emit(event: 'system:performance:warning', data: PerformanceWarningData): boolean
  emit(event: 'system:error', data: SystemErrorData): boolean
  emit(event: 'system:health:check', data: HealthCheckData): boolean

  // Event listeners
  on(event: 'calendar:event:created', listener: (data: CalendarEventCreatedData) => void): this
  on(event: 'calendar:event:updated', listener: (data: CalendarEventUpdatedData) => void): this
  on(event: 'calendar:event:deleted', listener: (data: CalendarEventDeletedData) => void): this
  on(event: 'calendar:conflict:detected', listener: (data: ConflictDetectedData) => void): this
  on(event: 'calendar:conflict:resolved', listener: (data: ConflictResolvedData) => void): this

  on(event: 'reminder:created', listener: (data: ReminderCreatedData) => void): this
  on(event: 'reminder:triggered', listener: (data: ReminderTriggeredData) => void): this
  on(event: 'reminder:delivered', listener: (data: ReminderDeliveredData) => void): this
  on(event: 'reminder:completed', listener: (data: ReminderCompletedData) => void): this
  on(event: 'reminder:snoozed', listener: (data: ReminderSnoozedData) => void): this
  on(event: 'reminder:failed', listener: (data: ReminderFailedData) => void): this

  on(event: 'sync:started', listener: (data: SyncStartedData) => void): this
  on(event: 'sync:completed', listener: (data: SyncCompletedData) => void): this
  on(event: 'sync:failed', listener: (data: SyncFailedData) => void): this
  on(event: 'sync:conflict', listener: (data: SyncConflictData) => void): this

  on(event: 'family:event:created', listener: (data: FamilyEventCreatedData) => void): this
  on(event: 'family:availability:changed', listener: (data: AvailabilityChangedData) => void): this
  on(event: 'family:conflict:detected', listener: (data: FamilyConflictDetectedData) => void): this

  on(event: 'system:performance:warning', listener: (data: PerformanceWarningData) => void): this
  on(event: 'system:error', listener: (data: SystemErrorData) => void): this
  on(event: 'system:health:check', listener: (data: HealthCheckData) => void): this
}

// Event data interfaces
export interface CalendarEventCreatedData {
  event: CalendarEvent
  userId: string
  timestamp: Date
  source: string
}

export interface CalendarEventUpdatedData {
  eventId: string
  previousEvent: CalendarEvent
  updatedEvent: CalendarEvent
  userId: string
  timestamp: Date
  changes: string[]
}

export interface CalendarEventDeletedData {
  eventId: string
  deletedEvent: CalendarEvent
  userId: string
  timestamp: Date
  reason?: string
}

export interface ConflictDetectedData {
  conflict: ScheduleConflict
  affectedEvents: CalendarEvent[]
  userId: string
  timestamp: Date
}

export interface ConflictResolvedData {
  conflictId: string
  resolution: string
  userId: string
  timestamp: Date
  resolvedBy: string
}

export interface ReminderCreatedData {
  reminder: Reminder
  userId: string
  timestamp: Date
  source: string
}

export interface ReminderTriggeredData {
  reminder: Reminder
  triggerTime: Date
  context: UserContext
  timestamp: Date
}

export interface ReminderDeliveredData {
  reminderId: string
  deliveryMethod: string
  deliveryTime: Date
  success: boolean
  userResponse?: string
}

export interface ReminderCompletedData {
  reminderId: string
  completionTime: Date
  completionMethod: string
  userId: string
}

export interface ReminderSnoozedData {
  reminderId: string
  snoozeTime: Date
  snoozeDuration: number
  newTriggerTime: Date
  userId: string
}

export interface ReminderFailedData {
  reminderId: string
  failureTime: Date
  errorType: string
  errorMessage: string
  retryCount: number
  canRetry: boolean
}

export interface SyncStartedData {
  connectionId: string
  providerId: string
  syncType: string
  timestamp: Date
}

export interface SyncCompletedData {
  result: SyncResult
  timestamp: Date
}

export interface SyncFailedData {
  connectionId: string
  providerId: string
  errorType: string
  errorMessage: string
  timestamp: Date
  retryScheduled: boolean
}

export interface SyncConflictData {
  conflict: SyncConflict
  connectionId: string
  timestamp: Date
}

export interface FamilyEventCreatedData {
  event: CalendarEvent
  familyId: string
  organizerId: string
  requiredAttendees: string[]
  timestamp: Date
}

export interface AvailabilityChangedData {
  userId: string
  previousAvailability: string
  newAvailability: string
  timeRange: {
    startTime: Date
    endTime: Date
  }
  timestamp: Date
}

export interface FamilyConflictDetectedData {
  conflict: ScheduleConflict
  familyId: string
  affectedMembers: string[]
  timestamp: Date
}

export interface PerformanceWarningData {
  component: string
  metric: string
  currentValue: number
  threshold: number
  severity: 'low' | 'medium' | 'high'
  timestamp: Date
}

export interface SystemErrorData {
  component: string
  errorType: string
  errorMessage: string
  stackTrace?: string
  timestamp: Date
  userId?: string
}

export interface HealthCheckData {
  component: string
  status: 'healthy' | 'warning' | 'error'
  metrics: Record<string, number>
  timestamp: Date
}

// Import user context from reminders
import { UserContext } from '../reminders/types'

// Event bus singleton instance
class ScheduleEventBusImpl extends EventEmitter implements ScheduleEventBus {
  constructor() {
    super()
    this.setMaxListeners(100) // Allow many listeners for different components
  }

  // Enhanced emit with error handling and logging
  emit(event: string | symbol, ...args: any[]): boolean {
    try {
      return super.emit(event, ...args)
    } catch (error) {
      console.error(`Error emitting event ${String(event)}:`, error)
      // Emit system error event for monitoring
      super.emit('system:error', {
        component: 'EventBus',
        errorType: 'EventEmissionError',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      })
      return false
    }
  }

  // Enhanced on with error handling
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    const wrappedListener = (...args: any[]) => {
      try {
        listener(...args)
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error)
        // Emit system error event for monitoring
        this.emit('system:error', {
          component: 'EventBus',
          errorType: 'EventListenerError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        })
      }
    }
    
    return super.on(event, wrappedListener)
  }
}

// Export singleton instance
export const scheduleEventBus: ScheduleEventBus = new ScheduleEventBusImpl()

// Event bus factory for testing
export function createScheduleEventBus(): ScheduleEventBus {
  return new ScheduleEventBusImpl()
}