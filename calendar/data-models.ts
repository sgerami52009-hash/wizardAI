// Calendar event data models with validation and serialization
// Implements Requirements: 1.1, 1.2, 1.5

import { 
  CalendarEvent, 
  RecurrencePattern, 
  EventMetadata, 
  EventCategory, 
  Priority, 
  VisibilityLevel,
  ReminderSettings,
  LocationInfo,
  Attendee,
  EventFilter,
  ScheduleConflict,
  ConflictType,
  ConflictLevel,
  TimeRange
} from './types'

/**
 * Validates calendar event data for child-appropriateness and data integrity
 * Requirement 1.3: Content validation for child-appropriateness
 */
export function validateCalendarEvent(event: Partial<CalendarEvent>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required field validation
  if (!event.title?.trim()) {
    errors.push('Event title is required')
  }

  if (!event.startTime) {
    errors.push('Event start time is required')
  }

  if (!event.endTime) {
    errors.push('Event end time is required')
  }

  if (event.startTime && event.endTime && event.startTime >= event.endTime) {
    errors.push('Event start time must be before end time')
  }

  // Child safety content validation
  if (event.title && !validateChildSafeContent(event.title)) {
    errors.push('Event title contains inappropriate content')
  }

  if (event.description && !validateChildSafeContent(event.description)) {
    errors.push('Event description contains inappropriate content')
  }

  // Duration validation (max 24 hours for single event)
  if (event.startTime && event.endTime) {
    const durationMs = event.endTime.getTime() - event.startTime.getTime()
    const maxDurationMs = 24 * 60 * 60 * 1000 // 24 hours
    if (durationMs > maxDurationMs) {
      warnings.push('Event duration exceeds 24 hours')
    }
  }

  // Recurrence pattern validation
  if (event.recurrence) {
    const recurrenceValidation = validateRecurrencePattern(event.recurrence)
    errors.push(...recurrenceValidation.errors)
    warnings.push(...recurrenceValidation.warnings)
  }

  // Attendee validation
  if (event.attendees) {
    for (const attendee of event.attendees) {
      if (!attendee.name?.trim()) {
        errors.push(`Attendee missing name: ${attendee.id}`)
      }
      if (attendee.email && !isValidEmail(attendee.email)) {
        errors.push(`Invalid email for attendee: ${attendee.name}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates recurrence pattern for logical consistency
 */
export function validateRecurrencePattern(pattern: RecurrencePattern): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (pattern.interval < 1) {
    errors.push('Recurrence interval must be at least 1')
  }

  if (pattern.interval > 999) {
    warnings.push('Very high recurrence interval may cause performance issues')
  }

  // Validate end conditions
  const hasEndDate = !!pattern.endDate
  const hasOccurrenceCount = !!pattern.occurrenceCount
  
  if (!hasEndDate && !hasOccurrenceCount) {
    warnings.push('Infinite recurrence pattern - consider adding end date or occurrence count')
  }

  if (hasEndDate && hasOccurrenceCount) {
    warnings.push('Both end date and occurrence count specified - end date will take precedence')
  }

  // Validate monthly recurrence
  if (pattern.frequency === 'monthly' && pattern.dayOfMonth) {
    if (pattern.dayOfMonth < 1 || pattern.dayOfMonth > 31) {
      errors.push('Day of month must be between 1 and 31')
    }
  }

  // Validate yearly recurrence
  if (pattern.frequency === 'yearly' && pattern.monthOfYear) {
    if (pattern.monthOfYear < 1 || pattern.monthOfYear > 12) {
      errors.push('Month of year must be between 1 and 12')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Child-safe content validation using allowlist approach
 * Requirement 1.3: Age-appropriate content filtering
 */
export function validateChildSafeContent(content: string): boolean {
  if (!content?.trim()) return true

  const lowercaseContent = content.toLowerCase()
  
  // Block inappropriate keywords (basic implementation)
  const blockedKeywords = [
    'inappropriate', 'adult', 'mature', 'violence', 'weapon',
    'drug', 'alcohol', 'gambling', 'dating', 'romance'
  ]

  for (const keyword of blockedKeywords) {
    if (lowercaseContent.includes(keyword)) {
      return false
    }
  }

  // Additional validation could include:
  // - External content filtering API
  // - Machine learning content classifier
  // - Parental review queue for borderline content

  return true
}

/**
 * Serializes calendar event to JSON with proper date handling
 */
export function serializeCalendarEvent(event: CalendarEvent): string {
  const serializable = {
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    recurrence: event.recurrence ? {
      ...event.recurrence,
      endDate: event.recurrence.endDate?.toISOString(),
      exceptions: event.recurrence.exceptions.map(date => date.toISOString())
    } : undefined,
    metadata: {
      ...event.metadata,
      lastSyncTime: event.metadata.lastSyncTime?.toISOString(),
      safetyValidatedAt: event.metadata.safetyValidatedAt?.toISOString()
    }
  }

  return JSON.stringify(serializable, null, 2)
}

/**
 * Deserializes calendar event from JSON with proper date parsing
 */
export function deserializeCalendarEvent(json: string): CalendarEvent {
  const parsed = JSON.parse(json)
  
  return {
    ...parsed,
    startTime: new Date(parsed.startTime),
    endTime: new Date(parsed.endTime),
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    recurrence: parsed.recurrence ? {
      ...parsed.recurrence,
      endDate: parsed.recurrence.endDate ? new Date(parsed.recurrence.endDate) : undefined,
      exceptions: parsed.recurrence.exceptions.map((dateStr: string) => new Date(dateStr))
    } : undefined,
    metadata: {
      ...parsed.metadata,
      lastSyncTime: parsed.metadata.lastSyncTime ? new Date(parsed.metadata.lastSyncTime) : undefined,
      safetyValidatedAt: parsed.metadata.safetyValidatedAt ? new Date(parsed.metadata.safetyValidatedAt) : undefined
    }
  }
}

/**
 * Event categorization system with automatic category suggestion
 * Requirement 1.1: Event categorization and priority management
 */
export class EventCategorizer {
  private categoryKeywords: Map<EventCategory, string[]> = new Map([
    [EventCategory.WORK, ['meeting', 'conference', 'deadline', 'project', 'office', 'business']],
    [EventCategory.EDUCATION, ['class', 'school', 'homework', 'study', 'exam', 'lesson', 'tutorial']],
    [EventCategory.HEALTH, ['doctor', 'appointment', 'medical', 'dentist', 'therapy', 'checkup']],
    [EventCategory.FAMILY, ['family', 'dinner', 'birthday', 'anniversary', 'reunion', 'visit']],
    [EventCategory.ENTERTAINMENT, ['movie', 'concert', 'game', 'party', 'show', 'festival']],
    [EventCategory.TRAVEL, ['flight', 'trip', 'vacation', 'hotel', 'travel', 'journey']],
    [EventCategory.PERSONAL, ['personal', 'self', 'hobby', 'exercise', 'workout']]
  ])

  /**
   * Suggests event category based on title and description
   */
  suggestCategory(title: string, description?: string): EventCategory {
    const content = `${title} ${description || ''}`.toLowerCase()
    
    let bestMatch: EventCategory = EventCategory.OTHER
    let maxMatches = 0

    for (const [category, keywords] of this.categoryKeywords) {
      const matches = keywords.filter(keyword => content.includes(keyword)).length
      if (matches > maxMatches) {
        maxMatches = matches
        bestMatch = category
      }
    }

    return bestMatch
  }

  /**
   * Gets category confidence score (0-1)
   */
  getCategoryConfidence(title: string, description: string, category: EventCategory): number {
    const content = `${title} ${description}`.toLowerCase()
    const keywords = this.categoryKeywords.get(category) || []
    const matches = keywords.filter(keyword => content.includes(keyword)).length
    
    return Math.min(matches / keywords.length, 1.0)
  }
}

/**
 * Priority management system with automatic priority suggestion
 * Requirement 1.1: Priority management systems
 */
export class PriorityManager {
  private priorityKeywords: Map<Priority, string[]> = new Map([
    [Priority.CRITICAL, ['urgent', 'critical', 'emergency', 'asap', 'deadline', 'important']],
    [Priority.HIGH, ['high', 'priority', 'soon', 'quickly', 'rush']],
    [Priority.MEDIUM, ['medium', 'normal', 'regular', 'standard']],
    [Priority.LOW, ['low', 'later', 'whenever', 'optional', 'nice to have']]
  ])

  /**
   * Suggests priority based on event content and timing
   */
  suggestPriority(event: Partial<CalendarEvent>): Priority {
    const content = `${event.title || ''} ${event.description || ''}`.toLowerCase()
    
    // Check for explicit priority keywords
    for (const [priority, keywords] of this.priorityKeywords) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return priority
      }
    }

    // Time-based priority logic
    if (event.startTime) {
      const now = new Date()
      const timeUntilEvent = event.startTime.getTime() - now.getTime()
      const hoursUntilEvent = timeUntilEvent / (1000 * 60 * 60)

      if (hoursUntilEvent < 1) return Priority.CRITICAL
      if (hoursUntilEvent < 24) return Priority.HIGH
      if (hoursUntilEvent < 168) return Priority.MEDIUM // 1 week
    }

    return Priority.LOW
  }

  /**
   * Adjusts priority based on conflicts and family coordination
   */
  adjustPriorityForConflicts(basePriority: Priority, conflicts: ScheduleConflict[]): Priority {
    if (conflicts.length === 0) return basePriority

    const hasHighSeverityConflict = conflicts.some(c => 
      c.severity === ConflictLevel.HIGH || c.severity === ConflictLevel.MEDIUM
    )

    if (hasHighSeverityConflict && basePriority < Priority.HIGH) {
      return Priority.HIGH
    }

    return basePriority
  }
}

/**
 * Event conflict detection algorithms
 * Requirement 1.5: Event conflict detection and resolution
 */
export class ConflictDetector {
  /**
   * Detects time-based conflicts between events
   */
  detectTimeConflicts(newEvent: CalendarEvent, existingEvents: CalendarEvent[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = []

    for (const existingEvent of existingEvents) {
      if (this.eventsOverlap(newEvent, existingEvent)) {
        const conflict: ScheduleConflict = {
          id: `conflict_${newEvent.id}_${existingEvent.id}`,
          conflictType: ConflictType.TIME_OVERLAP,
          conflictingEvents: [newEvent.id, existingEvent.id],
          severity: this.calculateConflictSeverity(newEvent, existingEvent),
          suggestedResolutions: this.generateResolutionSuggestions(newEvent, existingEvent),
          detectedAt: new Date()
        }
        conflicts.push(conflict)
      }
    }

    return conflicts
  }

  /**
   * Detects resource conflicts (location, attendees)
   */
  detectResourceConflicts(newEvent: CalendarEvent, existingEvents: CalendarEvent[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = []

    for (const existingEvent of existingEvents) {
      if (this.eventsOverlap(newEvent, existingEvent)) {
        // Location conflict
        if (this.hasLocationConflict(newEvent, existingEvent)) {
          conflicts.push({
            id: `location_conflict_${newEvent.id}_${existingEvent.id}`,
            conflictType: ConflictType.RESOURCE_CONFLICT,
            conflictingEvents: [newEvent.id, existingEvent.id],
            severity: ConflictLevel.MEDIUM,
            suggestedResolutions: [],
            detectedAt: new Date()
          })
        }

        // Attendee conflict
        if (this.hasAttendeeConflict(newEvent, existingEvent)) {
          conflicts.push({
            id: `attendee_conflict_${newEvent.id}_${existingEvent.id}`,
            conflictType: ConflictType.RESOURCE_CONFLICT,
            conflictingEvents: [newEvent.id, existingEvent.id],
            severity: ConflictLevel.HIGH,
            suggestedResolutions: [],
            detectedAt: new Date()
          })
        }
      }
    }

    return conflicts
  }

  /**
   * Checks if two events overlap in time
   */
  private eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return event1.startTime < event2.endTime && event2.startTime < event1.endTime
  }

  /**
   * Checks for location conflicts
   */
  private hasLocationConflict(event1: CalendarEvent, event2: CalendarEvent): boolean {
    if (!event1.location || !event2.location) return false
    
    // Same physical location
    if (event1.location.name === event2.location.name) return true
    
    // Same coordinates (within 100m)
    if (event1.location.coordinates && event2.location.coordinates) {
      const distance = this.calculateDistance(
        event1.location.coordinates,
        event2.location.coordinates
      )
      return distance < 0.1 // 100 meters
    }

    return false
  }

  /**
   * Checks for attendee conflicts
   */
  private hasAttendeeConflict(event1: CalendarEvent, event2: CalendarEvent): boolean {
    if (!event1.attendees || !event2.attendees || 
        event1.attendees.length === 0 || event2.attendees.length === 0) {
      return false
    }

    const attendees1 = new Set(event1.attendees.map(a => a.id))
    const attendees2 = new Set(event2.attendees.map(a => a.id))
    
    // Check for common attendees
    for (const attendeeId of attendees1) {
      if (attendees2.has(attendeeId)) {
        return true
      }
    }

    return false
  }

  /**
   * Calculates conflict severity based on event properties
   */
  private calculateConflictSeverity(event1: CalendarEvent, event2: CalendarEvent): ConflictLevel {
    const maxPriority = Math.max(event1.priority, event2.priority)
    
    if (maxPriority === Priority.CRITICAL) return ConflictLevel.HIGH
    if (maxPriority === Priority.HIGH) return ConflictLevel.MEDIUM
    
    return ConflictLevel.LOW
  }

  /**
   * Generates resolution suggestions for conflicts
   */
  private generateResolutionSuggestions(event1: CalendarEvent, event2: CalendarEvent): any[] {
    // Implementation would generate specific resolution strategies
    // This is a placeholder for the actual resolution logic
    return []
  }

  /**
   * Calculates distance between two coordinates in kilometers
   */
  private calculateDistance(coord1: {latitude: number, longitude: number}, coord2: {latitude: number, longitude: number}): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(coord2.latitude - coord1.latitude)
    const dLon = this.toRadians(coord2.longitude - coord1.longitude)
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}

// Utility interfaces
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Utility functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Export instances for use throughout the application
export const eventCategorizer = new EventCategorizer()
export const priorityManager = new PriorityManager()
export const conflictDetector = new ConflictDetector()