// Calendar event management system with comprehensive CRUD operations
// Implements Requirements: 1.1, 1.2, 1.5, 1.6

import { EventEmitter } from 'events'
import { 
  CalendarEvent, 
  EventFilter, 
  EventChanges, 
  RecurrencePattern, 
  RecurrenceFrequency,
  DayOfWeek,
  EventCategory,
  Priority,
  VisibilityLevel
} from './types'
import { 
  TimeRange, 
  ScheduleConflict, 
  TimeSlot, 
  SchedulingConstraints,
  ConflictLevel,
  ConflictType,
  ConflictResolution,
  ResolutionStrategy
} from '../scheduling/types'
import { EventStore } from './event-store'
import { 
  validateCalendarEvent, 
  conflictDetector, 
  eventCategorizer, 
  priorityManager 
} from './data-models'

/**
 * Calendar Manager for comprehensive event CRUD operations
 * Requirement 1.1: Event CRUD operations with recurring event support
 * Requirement 1.2: Recurring event pattern processing and expansion
 * Requirement 1.5: Event conflict detection and resolution suggestions
 * Requirement 1.6: Event categorization, filtering, and search capabilities
 */
export class CalendarManager extends EventEmitter {
  private eventStore: EventStore
  private isInitialized = false

  constructor(storePath: string, encryptionKey: string) {
    super()
    this.eventStore = new EventStore(storePath, encryptionKey)
  }

  /**
   * Initialize the calendar manager
   */
  async initialize(): Promise<void> {
    await this.eventStore.initialize()
    this.isInitialized = true
    this.emit('initialized')
  }

  /**
   * Add a new calendar event with validation and conflict detection
   * Requirement 1.1: Comprehensive event CRUD operations
   */
  async addEvent(event: Partial<CalendarEvent>): Promise<string> {
    this.ensureInitialized()

    // Generate ID if not provided
    const eventId = event.id || this.generateEventId()
    
    // Create complete event object with defaults
    const completeEvent: CalendarEvent = {
      id: eventId,
      title: event.title || '',
      description: event.description || '',
      startTime: event.startTime || new Date(),
      endTime: event.endTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
      allDay: event.allDay || false,
      recurrence: event.recurrence,
      location: event.location,
      attendees: event.attendees || [],
      category: event.category || eventCategorizer.suggestCategory(event.title || '', event.description),
      priority: event.priority || priorityManager.suggestPriority(event),
      visibility: event.visibility || VisibilityLevel.PRIVATE,
      reminders: event.reminders || [],
      metadata: {
        source: event.metadata?.source || 'local' as any,
        syncStatus: 'not_synced' as any,
        conflictStatus: 'none' as any,
        safetyValidated: false,
        tags: event.metadata?.tags || [],
        customFields: event.metadata?.customFields || {}
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: event.createdBy || 'system',
      isPrivate: event.isPrivate || false,
      externalEventId: event.externalEventId,
      providerId: event.providerId
    }

    // Validate event
    const validation = validateCalendarEvent(completeEvent)
    if (!validation.isValid) {
      throw new CalendarManagerError(`Event validation failed: ${validation.errors.join(', ')}`)
    }

    // Check for conflicts
    const conflicts = await this.findConflicts(completeEvent, completeEvent.createdBy)
    if (conflicts.length > 0) {
      // Emit conflict event but still allow creation
      this.emit('conflictDetected', { event: completeEvent, conflicts })
    }

    // Store the event
    await this.eventStore.storeEvent(completeEvent)

    // If recurring, create recurring instances
    if (completeEvent.recurrence) {
      await this.createRecurringInstances(completeEvent)
    }

    this.emit('eventAdded', completeEvent)
    return eventId
  }

  /**
   * Update an existing calendar event
   * Requirement 1.1: Event modification with conflict checking
   */
  async updateEvent(eventId: string, changes: EventChanges): Promise<void> {
    this.ensureInitialized()

    const existingEvent = await this.eventStore.getEvent(eventId)
    if (!existingEvent) {
      throw new CalendarManagerError(`Event not found: ${eventId}`)
    }

    // Apply changes to create updated event
    const updatedEvent: CalendarEvent = {
      ...existingEvent,
      ...changes,
      id: eventId, // Ensure ID doesn't change
      updatedAt: new Date()
    }

    // Re-categorize if title or description changed
    if (changes.title || changes.description) {
      updatedEvent.category = changes.category || 
        eventCategorizer.suggestCategory(updatedEvent.title, updatedEvent.description)
    }

    // Re-prioritize if content changed
    if (changes.title || changes.description || changes.startTime) {
      updatedEvent.priority = changes.priority || 
        priorityManager.suggestPriority(updatedEvent)
    }

    // Validate updated event
    const validation = validateCalendarEvent(updatedEvent)
    if (!validation.isValid) {
      throw new CalendarManagerError(`Event validation failed: ${validation.errors.join(', ')}`)
    }

    // Check for new conflicts
    const conflicts = await this.findConflicts(updatedEvent, updatedEvent.createdBy)
    if (conflicts.length > 0) {
      this.emit('conflictDetected', { event: updatedEvent, conflicts })
    }

    // Update the event
    await this.eventStore.updateEvent(eventId, updatedEvent)

    // Handle recurring event updates
    if (updatedEvent.recurrence && 
        (changes.recurrence || changes.startTime || changes.endTime)) {
      await this.updateRecurringInstances(updatedEvent)
    }

    this.emit('eventUpdated', { previous: existingEvent, updated: updatedEvent })
  }

  /**
   * Remove a calendar event
   * Requirement 1.1: Event deletion with cleanup
   */
  async removeEvent(eventId: string): Promise<void> {
    this.ensureInitialized()

    const event = await this.eventStore.getEvent(eventId)
    if (!event) {
      return // Event doesn't exist, nothing to remove
    }

    // Remove recurring instances if this is a recurring event
    if (event.recurrence) {
      await this.removeRecurringInstances(eventId)
    }

    await this.eventStore.deleteEvent(eventId)
    this.emit('eventRemoved', event)
  }

  /**
   * Get events with filtering and search capabilities
   * Requirement 1.6: Event filtering and search capabilities
   */
  async getEvents(filter: EventFilter): Promise<CalendarEvent[]> {
    this.ensureInitialized()
    return await this.eventStore.queryEvents(filter)
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    this.ensureInitialized()
    return await this.eventStore.getEvent(eventId)
  }

  /**
   * Find conflicts for a given event
   * Requirement 1.5: Event conflict detection algorithms
   */
  async findConflicts(event: CalendarEvent, userId: string): Promise<ScheduleConflict[]> {
    this.ensureInitialized()

    // Get existing events in the same time range
    const timeRange: TimeRange = {
      startTime: new Date(event.startTime.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      endTime: new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000) // 1 day after
    }

    const existingEvents = await this.eventStore.queryEvents({
      userId,
      timeRange,
      includeRecurring: true
    })

    // Filter out the event itself if it already exists
    const otherEvents = existingEvents.filter(e => e.id !== event.id)

    // Detect time conflicts
    const timeConflicts = conflictDetector.detectTimeConflicts(event, otherEvents)
    
    // Detect resource conflicts
    const resourceConflicts = conflictDetector.detectResourceConflicts(event, otherEvents)

    // Combine and enhance conflicts with resolution suggestions
    const allConflicts = [...timeConflicts, ...resourceConflicts]
    
    for (const conflict of allConflicts) {
      conflict.suggestedResolutions = await this.generateResolutionSuggestions(event, conflict)
    }

    return allConflicts
  }

  /**
   * Expand recurring events within a time range
   * Requirement 1.2: Recurring event pattern processing and expansion
   */
  async expandRecurringEvents(pattern: RecurrencePattern, baseEvent: CalendarEvent, range: TimeRange): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    const instances: CalendarEvent[] = []
    const eventDuration = baseEvent.endTime.getTime() - baseEvent.startTime.getTime()

    let currentDate = new Date(baseEvent.startTime)
    let occurrenceCount = 0

    while (currentDate <= range.endTime && 
           (!pattern.endDate || currentDate <= pattern.endDate) &&
           (!pattern.occurrenceCount || occurrenceCount < pattern.occurrenceCount)) {

      // Check if this occurrence is within the requested range
      if (currentDate >= range.startTime) {
        // Check if this date is not in exceptions
        const isException = pattern.exceptions.some(exception => 
          this.isSameDay(currentDate, exception)
        )

        if (!isException) {
          const instanceStartTime = new Date(currentDate)
          const instanceEndTime = new Date(currentDate.getTime() + eventDuration)

          const instanceId = `${baseEvent.id}_${instanceStartTime.toISOString().replace(/[:.]/g, '-')}`
          const instance: CalendarEvent = {
            ...baseEvent,
            id: instanceId,
            startTime: instanceStartTime,
            endTime: instanceEndTime,
            metadata: {
              ...baseEvent.metadata,
              tags: [...baseEvent.metadata.tags, 'recurring-instance'],
              customFields: {
                ...baseEvent.metadata.customFields,
                parentEventId: baseEvent.id,
                occurrenceIndex: occurrenceCount
              }
            }
          }

          instances.push(instance)
        }
      }

      // Move to next occurrence
      currentDate = this.getNextOccurrence(currentDate, pattern)
      occurrenceCount++

      // Safety check to prevent infinite loops
      if (occurrenceCount > 1000) {
        console.warn('Recurring event expansion exceeded 1000 occurrences, stopping')
        break
      }
    }

    return instances
  }

  /**
   * Suggest alternative times for scheduling conflicts
   * Requirement 1.5: Resolution suggestion algorithms
   */
  async suggestAlternativeTimes(event: CalendarEvent, constraints: SchedulingConstraints): Promise<TimeSlot[]> {
    this.ensureInitialized()

    const suggestions: TimeSlot[] = []
    const eventDuration = event.endTime.getTime() - event.startTime.getTime()

    // Get user's existing events for conflict checking
    const existingEvents = await this.eventStore.queryEvents({
      userId: event.createdBy,
      timeRange: {
        startTime: constraints.preferredTimes[0]?.startTime || event.startTime,
        endTime: constraints.preferredTimes[0]?.endTime || 
          new Date(event.startTime.getTime() + 7 * 24 * 60 * 60 * 1000) // 1 week
      }
    })

    // Check each preferred time range
    for (const preferredRange of constraints.preferredTimes) {
      let currentTime = new Date(preferredRange.startTime)
      
      while (currentTime.getTime() + eventDuration <= preferredRange.endTime.getTime()) {
        const proposedEndTime = new Date(currentTime.getTime() + eventDuration)
        
        // Check if this time slot is available
        const hasConflict = existingEvents.some(existingEvent => 
          this.timeRangesOverlap(
            { startTime: currentTime, endTime: proposedEndTime },
            { startTime: existingEvent.startTime, endTime: existingEvent.endTime }
          )
        )

        // Check against blackout times
        const isBlackedOut = constraints.blackoutTimes.some(blackout =>
          this.timeRangesOverlap(
            { startTime: currentTime, endTime: proposedEndTime },
            blackout
          )
        )

        if (!hasConflict && !isBlackedOut) {
          suggestions.push({
            startTime: new Date(currentTime),
            endTime: new Date(proposedEndTime),
            isAvailable: true,
            conflictLevel: ConflictLevel.NONE
          })
        }

        // Move to next 30-minute slot
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000)
      }
    }

    // Sort suggestions by preference (earlier times first)
    suggestions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

    // Limit to top 10 suggestions
    return suggestions.slice(0, 10)
  }

  /**
   * Search events by text content
   * Requirement 1.6: Event search capabilities
   */
  async searchEvents(searchText: string, userId?: string): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    return await this.eventStore.queryEvents({
      searchText,
      userId
    })
  }

  /**
   * Get events by category
   * Requirement 1.6: Event categorization and filtering
   */
  async getEventsByCategory(category: EventCategory, userId?: string): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    return await this.eventStore.queryEvents({
      categories: [category],
      userId
    })
  }

  /**
   * Get events by priority
   * Requirement 1.6: Priority-based filtering
   */
  async getEventsByPriority(priority: Priority, userId?: string): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    return await this.eventStore.queryEvents({
      priorities: [priority],
      userId
    })
  }

  /**
   * Get events in a specific time range
   */
  async getEventsInRange(timeRange: TimeRange, userId?: string): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    return await this.eventStore.queryEvents({
      timeRange,
      userId,
      includeRecurring: true
    })
  }

  // Private helper methods

  /**
   * Create recurring event instances
   */
  private async createRecurringInstances(baseEvent: CalendarEvent): Promise<void> {
    if (!baseEvent.recurrence) return

    // Create instances for the next 2 years or until end date
    const endDate = baseEvent.recurrence.endDate || 
      new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)

    const range: TimeRange = {
      startTime: baseEvent.startTime,
      endTime: endDate
    }

    const instances = await this.expandRecurringEvents(baseEvent.recurrence, baseEvent, range)
    
    // Store each instance (skip the first one as it's the base event)
    for (const instance of instances.slice(1)) {
      await this.eventStore.storeEvent(instance)
    }
  }

  /**
   * Update recurring event instances when pattern changes
   */
  private async updateRecurringInstances(updatedEvent: CalendarEvent): Promise<void> {
    // Remove existing instances
    await this.removeRecurringInstances(updatedEvent.id)
    
    // Create new instances with updated pattern
    await this.createRecurringInstances(updatedEvent)
  }

  /**
   * Remove all instances of a recurring event
   */
  private async removeRecurringInstances(baseEventId: string): Promise<void> {
    // Find all instances of this recurring event
    const allEvents = await this.eventStore.queryEvents({})
    const instances = allEvents.filter(event => 
      event.metadata.customFields?.parentEventId === baseEventId
    )

    // Remove each instance
    for (const instance of instances) {
      await this.eventStore.deleteEvent(instance.id)
    }
  }

  /**
   * Generate resolution suggestions for conflicts
   */
  private async generateResolutionSuggestions(event: CalendarEvent, conflict: ScheduleConflict): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = []

    // Reschedule suggestion
    const alternativeTimes = await this.suggestAlternativeTimes(event, {
      preferredTimes: [{
        startTime: new Date(event.startTime.getTime() - 24 * 60 * 60 * 1000),
        endTime: new Date(event.endTime.getTime() + 24 * 60 * 60 * 1000)
      }],
      blackoutTimes: [],
      minimumDuration: event.endTime.getTime() - event.startTime.getTime(),
      maximumDuration: event.endTime.getTime() - event.startTime.getTime(),
      requiredAttendees: (event.attendees || []).filter(a => a.isRequired).map(a => a.id),
      optionalAttendees: (event.attendees || []).filter(a => !a.isRequired).map(a => a.id),
      priority: event.priority
    })

    if (alternativeTimes.length > 0) {
      resolutions.push({
        id: `reschedule_${conflict.id}`,
        strategy: ResolutionStrategy.RESCHEDULE,
        description: 'Reschedule to an available time slot',
        alternativeTimeSlots: alternativeTimes.slice(0, 3),
        requiredActions: ['Select new time', 'Notify attendees']
      })
    }

    // Priority-based resolution
    if (conflict.severity === ConflictLevel.LOW) {
      resolutions.push({
        id: `prioritize_${conflict.id}`,
        strategy: ResolutionStrategy.PRIORITIZE,
        description: 'Keep higher priority event, reschedule lower priority',
        requiredActions: ['Compare event priorities', 'Reschedule lower priority event']
      })
    }

    return resolutions
  }

  /**
   * Get next occurrence date for recurring pattern
   */
  private getNextOccurrence(currentDate: Date, pattern: RecurrencePattern): Date {
    const nextDate = new Date(currentDate)

    switch (pattern.frequency) {
      case RecurrenceFrequency.DAILY:
        nextDate.setDate(nextDate.getDate() + pattern.interval)
        break

      case RecurrenceFrequency.WEEKLY:
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          // Find next occurrence on specified days of week
          let daysToAdd = 1
          while (daysToAdd <= 7 * pattern.interval) {
            const testDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
            if (pattern.daysOfWeek.includes(testDate.getDay() as DayOfWeek)) {
              return testDate
            }
            daysToAdd++
          }
        } else {
          nextDate.setDate(nextDate.getDate() + 7 * pattern.interval)
        }
        break

      case RecurrenceFrequency.MONTHLY:
        if (pattern.dayOfMonth) {
          nextDate.setMonth(nextDate.getMonth() + pattern.interval)
          nextDate.setDate(pattern.dayOfMonth)
        } else {
          nextDate.setMonth(nextDate.getMonth() + pattern.interval)
        }
        break

      case RecurrenceFrequency.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + pattern.interval)
        if (pattern.monthOfYear) {
          nextDate.setMonth(pattern.monthOfYear - 1) // Month is 0-indexed
        }
        if (pattern.dayOfMonth) {
          nextDate.setDate(pattern.dayOfMonth)
        }
        break
    }

    return nextDate
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
   * Check if two time ranges overlap
   */
  private timeRangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return range1.startTime < range2.endTime && range2.startTime < range1.endTime
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new CalendarManagerError('Calendar manager not initialized. Call initialize() first.')
    }
  }
}

export class CalendarManagerError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'CalendarManagerError'
  }
}