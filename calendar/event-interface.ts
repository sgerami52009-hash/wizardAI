// Event detail display and editing interfaces
// Implements Requirements: 1.4, 7.3

import { 
  CalendarEvent, 
  EventChanges, 
  EventCategory, 
  Priority, 
  VisibilityLevel,
  RecurrencePattern,
  RecurrenceFrequency,
  DayOfWeek,
  LocationInfo,
  Attendee,
  ReminderSettings,
  AttendeeRole,
  AttendeeStatus,
  ReminderType,
  NotificationMethod
} from './types'
import { CalendarManager } from './manager'
import { validateCalendarEvent, ValidationResult } from './data-models'

/**
 * Event detail display interface
 * Requirement 1.4: Event detail display interfaces
 */
export class EventDetailDisplay {
  private calendarManager: CalendarManager

  constructor(calendarManager: CalendarManager) {
    this.calendarManager = calendarManager
  }

  /**
   * Get formatted event details for display
   */
  async getEventDetails(eventId: string): Promise<EventDetailData | null> {
    const event = await this.calendarManager.getEvent(eventId)
    if (!event) return null

    return {
      event,
      formattedDetails: this.formatEventDetails(event),
      conflicts: await this.calendarManager.findConflicts(event, event.createdBy),
      canEdit: this.canEditEvent(event),
      canDelete: this.canDeleteEvent(event)
    }
  }

  /**
   * Format event details for display
   */
  private formatEventDetails(event: CalendarEvent): FormattedEventDetails {
    return {
      title: event.title,
      description: event.description || 'No description',
      dateTime: this.formatDateTime(event),
      duration: this.formatDuration(event),
      location: this.formatLocation(event.location),
      attendees: this.formatAttendees(event.attendees),
      category: this.formatCategory(event.category),
      priority: this.formatPriority(event.priority),
      visibility: this.formatVisibility(event.visibility),
      recurrence: this.formatRecurrence(event.recurrence),
      reminders: this.formatReminders(event.reminders),
      created: this.formatCreatedInfo(event),
      lastModified: event.updatedAt.toLocaleString()
    }
  }

  /**
   * Format date and time for display
   */
  private formatDateTime(event: CalendarEvent): string {
    if (event.allDay) {
      if (this.isSameDay(event.startTime, event.endTime)) {
        return `All day on ${event.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}`
      } else {
        return `All day from ${event.startTime.toLocaleDateString()} to ${event.endTime.toLocaleDateString()}`
      }
    }

    const startDateTime = event.startTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    const endDateTime = event.endTime.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    if (this.isSameDay(event.startTime, event.endTime)) {
      return `${startDateTime} - ${endDateTime}`
    } else {
      const endDate = event.endTime.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      return `${startDateTime} - ${endDate}`
    }
  }

  /**
   * Format event duration
   */
  private formatDuration(event: CalendarEvent): string {
    const durationMs = event.endTime.getTime() - event.startTime.getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours === 0) {
      return `${minutes} minutes`
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`
    }
  }

  /**
   * Format location information
   */
  private formatLocation(location?: LocationInfo): string {
    if (!location) return 'No location specified'
    
    let formatted = location.name
    if (location.address) {
      formatted += ` (${location.address})`
    }
    
    return formatted
  }

  /**
   * Format attendees list
   */
  private formatAttendees(attendees: Attendee[]): string {
    if (attendees.length === 0) return 'No attendees'
    
    const attendeeStrings = attendees.map(attendee => {
      let formatted = attendee.name
      if (attendee.email) {
        formatted += ` (${attendee.email})`
      }
      
      const roleText = attendee.role === AttendeeRole.ORGANIZER ? ' - Organizer' :
                      attendee.isRequired ? ' - Required' : ' - Optional'
      
      const statusText = attendee.status !== AttendeeStatus.PENDING ? 
                        ` [${attendee.status}]` : ''
      
      return formatted + roleText + statusText
    })
    
    return attendeeStrings.join(', ')
  }

  /**
   * Format event category
   */
  private formatCategory(category: EventCategory): string {
    return category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')
  }

  /**
   * Format event priority
   */
  private formatPriority(priority: Priority): string {
    const priorityNames: Record<Priority, string> = {
      [Priority.LOW]: 'Low',
      [Priority.MEDIUM]: 'Medium',
      [Priority.HIGH]: 'High',
      [Priority.CRITICAL]: 'Critical'
    }
    
    return priorityNames[priority] || 'Unknown'
  }

  /**
   * Format visibility level
   */
  private formatVisibility(visibility: VisibilityLevel): string {
    return visibility.charAt(0).toUpperCase() + visibility.slice(1)
  }

  /**
   * Format recurrence pattern
   */
  private formatRecurrence(recurrence?: RecurrencePattern): string {
    if (!recurrence) return 'Does not repeat'
    
    let formatted = `Repeats ${recurrence.frequency}`
    
    if (recurrence.interval > 1) {
      formatted += ` every ${recurrence.interval} ${recurrence.frequency}s`
    }
    
    if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
      const dayNames = recurrence.daysOfWeek.map(day => this.getDayName(day))
      formatted += ` on ${dayNames.join(', ')}`
    }
    
    if (recurrence.endDate) {
      formatted += ` until ${recurrence.endDate.toLocaleDateString()}`
    } else if (recurrence.occurrenceCount) {
      formatted += ` for ${recurrence.occurrenceCount} occurrences`
    }
    
    if (recurrence.exceptions.length > 0) {
      formatted += ` (${recurrence.exceptions.length} exception${recurrence.exceptions.length > 1 ? 's' : ''})`
    }
    
    return formatted
  }

  /**
   * Format reminders
   */
  private formatReminders(reminders: ReminderSettings[]): string {
    if (reminders.length === 0) return 'No reminders'
    
    const reminderStrings = reminders
      .filter(reminder => reminder.isEnabled)
      .map(reminder => {
        const timeText = this.formatReminderTime(reminder.offsetMinutes)
        const methodText = reminder.method.charAt(0).toUpperCase() + reminder.method.slice(1)
        return `${timeText} (${methodText})`
      })
    
    return reminderStrings.join(', ')
  }

  /**
   * Format reminder time offset
   */
  private formatReminderTime(offsetMinutes: number): string {
    if (offsetMinutes === 0) return 'At event time'
    
    const hours = Math.floor(offsetMinutes / 60)
    const minutes = offsetMinutes % 60
    
    if (hours === 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} before`
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} before`
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''} before`
    }
  }

  /**
   * Format created information
   */
  private formatCreatedInfo(event: CalendarEvent): string {
    return `Created by ${event.createdBy} on ${event.createdAt.toLocaleDateString()}`
  }

  /**
   * Get day name from DayOfWeek enum
   */
  private getDayName(day: DayOfWeek): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return dayNames[day] || 'Unknown'
  }

  /**
   * Check if two dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  /**
   * Check if user can edit event
   */
  private canEditEvent(event: CalendarEvent): boolean {
    // Basic permission check - can be extended with more complex logic
    return !event.isPrivate || event.createdBy === 'current-user' // Placeholder logic
  }

  /**
   * Check if user can delete event
   */
  private canDeleteEvent(event: CalendarEvent): boolean {
    // Basic permission check - can be extended with more complex logic
    return event.createdBy === 'current-user' // Placeholder logic
  }
}

/**
 * Event editing interface
 * Requirement 1.4: Event editing interfaces
 */
export class EventEditor {
  private calendarManager: CalendarManager

  constructor(calendarManager: CalendarManager) {
    this.calendarManager = calendarManager
  }

  /**
   * Create new event with form data
   */
  async createEvent(formData: EventFormData): Promise<EventEditResult> {
    const validation = this.validateFormData(formData)
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      }
    }

    try {
      const event = this.formDataToEvent(formData)
      const eventId = await this.calendarManager.addEvent(event)
      
      return {
        success: true,
        eventId,
        errors: [],
        warnings: validation.warnings
      }
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        warnings: []
      }
    }
  }

  /**
   * Update existing event with form data
   */
  async updateEvent(eventId: string, formData: EventFormData): Promise<EventEditResult> {
    const validation = this.validateFormData(formData)
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      }
    }

    try {
      const changes = this.formDataToChanges(formData)
      await this.calendarManager.updateEvent(eventId, changes)
      
      return {
        success: true,
        eventId,
        errors: [],
        warnings: validation.warnings
      }
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        warnings: []
      }
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: string): Promise<EventEditResult> {
    try {
      await this.calendarManager.removeEvent(eventId)
      
      return {
        success: true,
        eventId,
        errors: [],
        warnings: []
      }
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
        warnings: []
      }
    }
  }

  /**
   * Get event form data for editing
   */
  async getEventFormData(eventId: string): Promise<EventFormData | null> {
    const event = await this.calendarManager.getEvent(eventId)
    if (!event) return null

    return this.eventToFormData(event)
  }

  /**
   * Validate form data
   */
  private validateFormData(formData: EventFormData): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required field validation
    if (!formData.title?.trim()) {
      errors.push('Event title is required')
    }

    if (!formData.startDate || !formData.startTime) {
      errors.push('Start date and time are required')
    }

    if (!formData.endDate || !formData.endTime) {
      errors.push('End date and time are required')
    }

    // Date/time validation
    if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
      const startDateTime = this.combineDateAndTime(formData.startDate, formData.startTime)
      const endDateTime = this.combineDateAndTime(formData.endDate, formData.endTime)

      if (startDateTime >= endDateTime) {
        errors.push('End time must be after start time')
      }

      // Check for very long events
      const durationHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)
      if (durationHours > 24) {
        warnings.push('Event duration exceeds 24 hours')
      }
    }

    // Attendee validation
    if (formData.attendees) {
      for (const attendee of formData.attendees) {
        if (!attendee.name?.trim()) {
          errors.push('All attendees must have a name')
        }
        if (attendee.email && !this.isValidEmail(attendee.email)) {
          errors.push(`Invalid email address: ${attendee.email}`)
        }
      }
    }

    // Recurrence validation
    if (formData.recurrence && formData.recurrence.frequency !== 'none') {
      if ((formData.recurrence.interval || 0) < 1) {
        errors.push('Recurrence interval must be at least 1')
      }
      
      if (formData.recurrence.frequency === RecurrenceFrequency.WEEKLY && 
          (!formData.recurrence.daysOfWeek || formData.recurrence.daysOfWeek.length === 0)) {
        errors.push('Weekly recurrence requires at least one day of the week')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Convert form data to calendar event
   */
  private formDataToEvent(formData: EventFormData): Partial<CalendarEvent> {
    const startDateTime = this.combineDateAndTime(formData.startDate!, formData.startTime!)
    const endDateTime = this.combineDateAndTime(formData.endDate!, formData.endTime!)

    const event: Partial<CalendarEvent> = {
      title: formData.title!,
      description: formData.description || '',
      startTime: startDateTime,
      endTime: endDateTime,
      allDay: formData.allDay || false,
      category: formData.category || EventCategory.OTHER,
      priority: formData.priority || Priority.MEDIUM,
      visibility: formData.visibility || VisibilityLevel.PRIVATE,
      isPrivate: formData.isPrivate || false,
      attendees: formData.attendees || [],
      reminders: formData.reminders || [],
      createdBy: formData.createdBy || 'current-user'
    }

    if (formData.location) {
      event.location = {
        name: formData.location.name,
        address: formData.location.address,
        coordinates: formData.location.coordinates,
        type: formData.location.type || 'other' as any
      }
    }

    if (formData.recurrence && formData.recurrence.frequency !== 'none') {
      event.recurrence = {
        frequency: formData.recurrence.frequency as RecurrenceFrequency,
        interval: formData.recurrence.interval || 1,
        daysOfWeek: formData.recurrence.daysOfWeek,
        dayOfMonth: formData.recurrence.dayOfMonth,
        monthOfYear: formData.recurrence.monthOfYear,
        endDate: formData.recurrence.endDate,
        occurrenceCount: formData.recurrence.occurrenceCount,
        exceptions: formData.recurrence.exceptions || []
      }
    }

    return event
  }

  /**
   * Convert form data to event changes
   */
  private formDataToChanges(formData: EventFormData): EventChanges {
    const event = this.formDataToEvent(formData)
    return event as EventChanges
  }

  /**
   * Convert calendar event to form data
   */
  private eventToFormData(event: CalendarEvent): EventFormData {
    // Format time in HH:MM format from ISO string
    const startTimeStr = event.startTime.toISOString().split('T')[1].slice(0, 5)
    const endTimeStr = event.endTime.toISOString().split('T')[1].slice(0, 5)
    
    return {
      title: event.title,
      description: event.description,
      startDate: event.startTime.toISOString().split('T')[0],
      startTime: startTimeStr,
      endDate: event.endTime.toISOString().split('T')[0],
      endTime: endTimeStr,
      allDay: event.allDay,
      category: event.category,
      priority: event.priority,
      visibility: event.visibility,
      isPrivate: event.isPrivate,
      location: event.location ? {
        name: event.location.name,
        address: event.location.address,
        coordinates: event.location.coordinates,
        type: event.location.type
      } : undefined,
      attendees: event.attendees,
      reminders: event.reminders,
      recurrence: event.recurrence ? {
        frequency: event.recurrence.frequency,
        interval: event.recurrence.interval,
        daysOfWeek: event.recurrence.daysOfWeek,
        dayOfMonth: event.recurrence.dayOfMonth,
        monthOfYear: event.recurrence.monthOfYear,
        endDate: event.recurrence.endDate,
        occurrenceCount: event.recurrence.occurrenceCount,
        exceptions: event.recurrence.exceptions
      } : { frequency: 'none' as any },
      createdBy: event.createdBy
    }
  }

  /**
   * Combine date and time strings into Date object
   */
  private combineDateAndTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`)
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// Interfaces for event display and editing
export interface EventDetailData {
  event: CalendarEvent
  formattedDetails: FormattedEventDetails
  conflicts: any[]
  canEdit: boolean
  canDelete: boolean
}

export interface FormattedEventDetails {
  title: string
  description: string
  dateTime: string
  duration: string
  location: string
  attendees: string
  category: string
  priority: string
  visibility: string
  recurrence: string
  reminders: string
  created: string
  lastModified: string
}

export interface EventFormData {
  title?: string
  description?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  allDay?: boolean
  category?: EventCategory
  priority?: Priority
  visibility?: VisibilityLevel
  isPrivate?: boolean
  location?: {
    name: string
    address?: string
    coordinates?: {
      latitude: number
      longitude: number
    }
    type?: string
  }
  attendees?: Attendee[]
  reminders?: ReminderSettings[]
  recurrence?: {
    frequency: string
    interval?: number
    daysOfWeek?: DayOfWeek[]
    dayOfMonth?: number
    monthOfYear?: number
    endDate?: Date
    occurrenceCount?: number
    exceptions?: Date[]
  }
  createdBy?: string
}

export interface EventEditResult {
  success: boolean
  eventId?: string
  errors: string[]
  warnings: string[]
}