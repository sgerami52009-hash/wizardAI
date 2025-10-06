// Unit tests for CalendarManager
// Tests Requirements: 1.1, 1.2, 1.5, 1.6

import { CalendarManager, CalendarManagerError } from './manager'
import { 
  CalendarEvent, 
  EventCategory, 
  Priority, 
  VisibilityLevel, 
  RecurrenceFrequency,
  DayOfWeek 
} from './types'
import { ConflictLevel, ConflictType } from '../scheduling/types'
import { 
  validateCalendarEvent, 
  validateChildSafeContent, 
  validateRecurrencePattern,
  serializeCalendarEvent,
  deserializeCalendarEvent,
  eventCategorizer,
  priorityManager,
  conflictDetector
} from './data-models'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('CalendarManager', () => {
  let calendarManager: CalendarManager
  let tempDir: string
  let testEncryptionKey: string

  beforeEach(async () => {
    // Create temporary directory for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calendar-test-'))
    testEncryptionKey = 'test-encryption-key-12345'
    
    calendarManager = new CalendarManager(
      path.join(tempDir, 'events'),
      testEncryptionKey
    )
    
    await calendarManager.initialize()
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('Event CRUD Operations', () => {
    test('should add a new event successfully', async () => {
      const eventData = {
        title: 'Test Meeting',
        description: 'A test meeting for unit testing',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        category: EventCategory.WORK,
        priority: Priority.MEDIUM,
        createdBy: 'test-user'
      }

      const eventId = await calendarManager.addEvent(eventData)
      
      expect(eventId).toBeDefined()
      expect(typeof eventId).toBe('string')

      const retrievedEvent = await calendarManager.getEvent(eventId)
      expect(retrievedEvent).toBeDefined()
      expect(retrievedEvent!.title).toBe(eventData.title)
      expect(retrievedEvent!.category).toBe(EventCategory.WORK)
    })

    test('should update an existing event', async () => {
      // Create initial event
      const eventId = await calendarManager.addEvent({
        title: 'Original Title',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      // Update the event
      await calendarManager.updateEvent(eventId, {
        title: 'Updated Title',
        description: 'Updated description'
      })

      const updatedEvent = await calendarManager.getEvent(eventId)
      expect(updatedEvent!.title).toBe('Updated Title')
      expect(updatedEvent!.description).toBe('Updated description')
    })

    test('should remove an event successfully', async () => {
      const eventId = await calendarManager.addEvent({
        title: 'Event to Delete',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      await calendarManager.removeEvent(eventId)

      const deletedEvent = await calendarManager.getEvent(eventId)
      expect(deletedEvent).toBeNull()
    })

    test('should validate event data before adding', async () => {
      const invalidEvent = {
        title: '', // Empty title should fail validation
        startTime: new Date('2024-01-15T11:00:00Z'),
        endTime: new Date('2024-01-15T10:00:00Z'), // End before start
        createdBy: 'test-user'
      }

      await expect(calendarManager.addEvent(invalidEvent))
        .rejects.toThrow(CalendarManagerError)
    })
  })

  describe('Recurring Event Processing', () => {
    test('should expand daily recurring events', async () => {
      const baseEvent = {
        title: 'Daily Standup',
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T09:30:00Z'),
        recurrence: {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          occurrenceCount: 5,
          exceptions: []
        },
        createdBy: 'test-user'
      }

      const eventId = await calendarManager.addEvent(baseEvent)
      
      // Get events for the week
      const weekRange = {
        startTime: new Date('2024-01-15T00:00:00Z'),
        endTime: new Date('2024-01-22T00:00:00Z')
      }

      const events = await calendarManager.getEventsInRange(weekRange, 'test-user')
      
      // Should have base event plus 4 more instances
      expect(events.length).toBeGreaterThanOrEqual(5)
      
      // Check that instances have correct dates
      const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      expect(sortedEvents[0].startTime.getDate()).toBe(15)
      expect(sortedEvents[1].startTime.getDate()).toBe(16)
      expect(sortedEvents[2].startTime.getDate()).toBe(17)
    })

    test('should expand weekly recurring events with specific days', async () => {
      const baseEvent = {
        title: 'Team Meeting',
        startTime: new Date('2024-01-15T14:00:00Z'), // Monday
        endTime: new Date('2024-01-15T15:00:00Z'),
        recurrence: {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY],
          occurrenceCount: 6,
          exceptions: []
        },
        createdBy: 'test-user'
      }

      await calendarManager.addEvent(baseEvent)
      
      const weekRange = {
        startTime: new Date('2024-01-15T00:00:00Z'),
        endTime: new Date('2024-01-29T00:00:00Z') // 2 weeks
      }

      const events = await calendarManager.getEventsInRange(weekRange, 'test-user')
      
      // Should have 6 occurrences (Mon, Wed, Fri for 2 weeks)
      expect(events.length).toBe(6)
      
      // Check that events are on correct days
      const dayOfWeekCounts = events.reduce((acc, event) => {
        const dayOfWeek = event.startTime.getDay()
        acc[dayOfWeek] = (acc[dayOfWeek] || 0) + 1
        return acc
      }, {} as Record<number, number>)
      
      expect(dayOfWeekCounts[DayOfWeek.MONDAY]).toBe(2)
      expect(dayOfWeekCounts[DayOfWeek.WEDNESDAY]).toBe(2)
      expect(dayOfWeekCounts[DayOfWeek.FRIDAY]).toBe(2)
    })

    test('should handle recurring event exceptions', async () => {
      const baseEvent = {
        title: 'Daily Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:30:00Z'),
        recurrence: {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          occurrenceCount: 5,
          exceptions: [new Date('2024-01-17T10:00:00Z')] // Skip Wednesday
        },
        createdBy: 'test-user'
      }

      await calendarManager.addEvent(baseEvent)
      
      const weekRange = {
        startTime: new Date('2024-01-15T00:00:00Z'),
        endTime: new Date('2024-01-22T00:00:00Z')
      }

      const events = await calendarManager.getEventsInRange(weekRange, 'test-user')
      
      // Should have 4 events (5 occurrences - 1 exception)
      expect(events.length).toBe(4)
      
      // Should not have event on January 17th
      const hasJan17Event = events.some(event => 
        event.startTime.getDate() === 17 && event.startTime.getMonth() === 0
      )
      expect(hasJan17Event).toBe(false)
    })
  })

  describe('Conflict Detection', () => {
    test('should detect time overlap conflicts', async () => {
      // Create first event
      await calendarManager.addEvent({
        title: 'Meeting 1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      // Create overlapping event
      const conflictingEvent = {
        title: 'Meeting 2',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        createdBy: 'test-user'
      } as CalendarEvent

      const conflicts = await calendarManager.findConflicts(conflictingEvent, 'test-user')
      
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts[0].conflictType).toBe(ConflictType.TIME_OVERLAP)
    })

    test('should detect attendee conflicts', async () => {
      // Create first event with attendees
      await calendarManager.addEvent({
        title: 'Meeting 1',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        attendees: [
          { id: 'user1', name: 'User 1', role: 'required' as any, status: 'pending' as any, isRequired: true },
          { id: 'user2', name: 'User 2', role: 'optional' as any, status: 'pending' as any, isRequired: false }
        ],
        createdBy: 'test-user'
      })

      // Create overlapping event with same attendee
      const conflictingEvent = {
        title: 'Meeting 2',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        attendees: [
          { id: 'user1', name: 'User 1', role: 'required' as any, status: 'pending' as any, isRequired: true }
        ],
        createdBy: 'test-user'
      } as CalendarEvent

      const conflicts = await calendarManager.findConflicts(conflictingEvent, 'test-user')
      
      expect(conflicts.length).toBeGreaterThan(0)
      const resourceConflict = conflicts.find(c => c.conflictType === ConflictType.RESOURCE_CONFLICT)
      expect(resourceConflict).toBeDefined()
    })

    test('should suggest alternative times for conflicts', async () => {
      // Create blocking event
      await calendarManager.addEvent({
        title: 'Blocking Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      const conflictingEvent = {
        title: 'New Meeting',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        createdBy: 'test-user'
      } as CalendarEvent

      const constraints = {
        preferredTimes: [{
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: new Date('2024-01-15T18:00:00Z')
        }],
        blackoutTimes: [],
        minimumDuration: 60 * 60 * 1000, // 1 hour
        maximumDuration: 60 * 60 * 1000,
        requiredAttendees: [],
        optionalAttendees: [],
        priority: Priority.MEDIUM
      }

      const alternatives = await calendarManager.suggestAlternativeTimes(conflictingEvent, constraints)
      
      expect(alternatives.length).toBeGreaterThan(0)
      expect(alternatives[0].isAvailable).toBe(true)
      expect(alternatives[0].conflictLevel).toBe(ConflictLevel.NONE)
    })
  })

  describe('Event Search and Filtering', () => {
    beforeEach(async () => {
      // Create test events with different categories and priorities
      await calendarManager.addEvent({
        title: 'Work Meeting',
        description: 'Important project discussion',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        createdBy: 'test-user'
      })

      await calendarManager.addEvent({
        title: 'Family Dinner',
        description: 'Weekly family gathering',
        startTime: new Date('2024-01-15T18:00:00Z'),
        endTime: new Date('2024-01-15T20:00:00Z'),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        createdBy: 'test-user'
      })

      await calendarManager.addEvent({
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        startTime: new Date('2024-01-16T14:00:00Z'),
        endTime: new Date('2024-01-16T15:00:00Z'),
        category: EventCategory.HEALTH,
        priority: Priority.HIGH,
        createdBy: 'test-user'
      })
    })

    test('should search events by text content', async () => {
      const results = await calendarManager.searchEvents('meeting', 'test-user')
      
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Work Meeting')
    })

    test('should filter events by category', async () => {
      const workEvents = await calendarManager.getEventsByCategory(EventCategory.WORK, 'test-user')
      const familyEvents = await calendarManager.getEventsByCategory(EventCategory.FAMILY, 'test-user')
      
      expect(workEvents.length).toBe(1)
      expect(workEvents[0].title).toBe('Work Meeting')
      
      expect(familyEvents.length).toBe(1)
      expect(familyEvents[0].title).toBe('Family Dinner')
    })

    test('should filter events by priority', async () => {
      const highPriorityEvents = await calendarManager.getEventsByPriority(Priority.HIGH, 'test-user')
      const mediumPriorityEvents = await calendarManager.getEventsByPriority(Priority.MEDIUM, 'test-user')
      
      expect(highPriorityEvents.length).toBe(2)
      expect(mediumPriorityEvents.length).toBe(1)
      expect(mediumPriorityEvents[0].title).toBe('Family Dinner')
    })

    test('should get events in time range', async () => {
      const dayRange = {
        startTime: new Date('2024-01-15T00:00:00Z'),
        endTime: new Date('2024-01-15T23:59:59Z')
      }

      const dayEvents = await calendarManager.getEventsInRange(dayRange, 'test-user')
      
      expect(dayEvents.length).toBe(2) // Work meeting and family dinner
      
      const titles = dayEvents.map(e => e.title).sort()
      expect(titles).toEqual(['Family Dinner', 'Work Meeting'])
    })

    test('should filter events with complex criteria', async () => {
      const filter = {
        userId: 'test-user',
        categories: [EventCategory.WORK, EventCategory.HEALTH],
        priorities: [Priority.HIGH],
        timeRange: {
          startTime: new Date('2024-01-15T00:00:00Z'),
          endTime: new Date('2024-01-17T00:00:00Z')
        }
      }

      const events = await calendarManager.getEvents(filter)
      
      expect(events.length).toBe(2) // Work meeting and doctor appointment
      expect(events.every(e => e.priority === Priority.HIGH)).toBe(true)
      expect(events.every(e => 
        e.category === EventCategory.WORK || e.category === EventCategory.HEALTH
      )).toBe(true)
    })
  })

  describe('Event Categorization and Prioritization', () => {
    test('should auto-categorize events based on content', async () => {
      const eventId = await calendarManager.addEvent({
        title: 'Team Meeting',
        description: 'Discuss project deadlines and deliverables',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      const event = await calendarManager.getEvent(eventId)
      expect(event!.category).toBe(EventCategory.WORK)
    })

    test('should auto-prioritize events based on content and timing', async () => {
      // Event with urgent keywords
      const urgentEventId = await calendarManager.addEvent({
        title: 'Urgent Client Call',
        description: 'Critical issue needs immediate attention',
        startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        endTime: new Date(Date.now() + 90 * 60 * 1000),
        createdBy: 'test-user'
      })

      const urgentEvent = await calendarManager.getEvent(urgentEventId)
      expect(urgentEvent!.priority).toBeGreaterThanOrEqual(Priority.HIGH)

      // Event far in the future
      const futureEventId = await calendarManager.addEvent({
        title: 'Optional Training Session',
        description: 'Nice to have training whenever convenient',
        startTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        createdBy: 'test-user'
      })

      const futureEvent = await calendarManager.getEvent(futureEventId)
      expect(futureEvent!.priority).toBe(Priority.LOW)
    })
  })

  describe('Error Handling', () => {
    test('should throw error when accessing uninitialized manager', async () => {
      const uninitializedManager = new CalendarManager('/tmp/test', 'key')
      
      await expect(uninitializedManager.addEvent({
        title: 'Test',
        startTime: new Date(),
        endTime: new Date(),
        createdBy: 'test'
      })).rejects.toThrow(CalendarManagerError)
    })

    test('should handle non-existent event updates gracefully', async () => {
      await expect(calendarManager.updateEvent('non-existent-id', {
        title: 'Updated Title'
      })).rejects.toThrow(CalendarManagerError)
    })

    test('should handle event removal of non-existent events', async () => {
      // Should not throw error
      await expect(calendarManager.removeEvent('non-existent-id'))
        .resolves.not.toThrow()
    })
  })

  describe('Event Listeners', () => {
    test('should emit events for CRUD operations', async () => {
      const events: string[] = []
      
      calendarManager.on('eventAdded', () => events.push('added'))
      calendarManager.on('eventUpdated', () => events.push('updated'))
      calendarManager.on('eventRemoved', () => events.push('removed'))
      calendarManager.on('conflictDetected', () => events.push('conflict'))

      // Add event
      const eventId = await calendarManager.addEvent({
        title: 'Test Event',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      // Update event
      await calendarManager.updateEvent(eventId, { title: 'Updated Event' })

      // Remove event
      await calendarManager.removeEvent(eventId)

      expect(events).toContain('added')
      expect(events).toContain('updated')
      expect(events).toContain('removed')
    })
  })

  describe('Child Safety Validation', () => {
    test('should validate child-safe content', () => {
      expect(validateChildSafeContent('Family Dinner')).toBe(true)
      expect(validateChildSafeContent('School Meeting')).toBe(true)
      expect(validateChildSafeContent('Birthday Party')).toBe(true)
      
      // Test blocked content
      expect(validateChildSafeContent('Adult Content Meeting')).toBe(false)
      expect(validateChildSafeContent('Violence Training')).toBe(false)
      expect(validateChildSafeContent('Drug Education')).toBe(false)
    })

    test('should reject events with inappropriate content', async () => {
      const inappropriateEvent = {
        title: 'Adult Content Meeting',
        description: 'Discussion about mature topics',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      }

      await expect(calendarManager.addEvent(inappropriateEvent))
        .rejects.toThrow(CalendarManagerError)
    })

    test('should validate event data comprehensively', () => {
      const validEvent = {
        title: 'Family Meeting',
        description: 'Weekly family discussion',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        createdBy: 'test-user'
      }

      const validation = validateCalendarEvent(validEvent)
      expect(validation.isValid).toBe(true)
      expect(validation.errors.length).toBe(0)
    })

    test('should detect validation errors', () => {
      const invalidEvent = {
        title: '', // Empty title
        startTime: new Date('2024-01-15T11:00:00Z'),
        endTime: new Date('2024-01-15T10:00:00Z'), // End before start
        attendees: [
          { id: 'user1', name: '', email: 'invalid-email', role: 'required' as any, status: 'pending' as any, isRequired: true }
        ]
      }

      const validation = validateCalendarEvent(invalidEvent)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Event title is required')
      expect(validation.errors).toContain('Event start time must be before end time')
      expect(validation.errors.some(error => error.includes('Attendee missing name'))).toBe(true)
      expect(validation.errors.some(error => error.includes('Invalid email'))).toBe(true)
    })
  })

  describe('Event Categorization and Prioritization', () => {
    test('should auto-categorize events correctly', () => {
      expect(eventCategorizer.suggestCategory('Team Meeting', 'Discuss project deadlines'))
        .toBe(EventCategory.WORK)
      
      expect(eventCategorizer.suggestCategory('Math Class', 'Algebra homework review'))
        .toBe(EventCategory.EDUCATION)
      
      expect(eventCategorizer.suggestCategory('Doctor Appointment', 'Annual checkup'))
        .toBe(EventCategory.HEALTH)
      
      expect(eventCategorizer.suggestCategory('Family Dinner', 'Weekly family gathering'))
        .toBe(EventCategory.FAMILY)
      
      expect(eventCategorizer.suggestCategory('Movie Night', 'Watch new release'))
        .toBe(EventCategory.ENTERTAINMENT)
      
      expect(eventCategorizer.suggestCategory('Flight to Paris', 'Vacation trip'))
        .toBe(EventCategory.TRAVEL)
    })

    test('should calculate category confidence scores', () => {
      const confidence = eventCategorizer.getCategoryConfidence(
        'Team Meeting Project Deadline',
        'Important business discussion',
        EventCategory.WORK
      )
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })

    test('should auto-prioritize events based on content', () => {
      const urgentEvent = {
        title: 'Urgent Client Call',
        description: 'Critical issue needs immediate attention',
        startTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      }
      expect(priorityManager.suggestPriority(urgentEvent)).toBe(Priority.CRITICAL)

      const normalEvent = {
        title: 'Regular Team Meeting',
        description: 'Weekly standup',
        startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
      }
      expect(priorityManager.suggestPriority(normalEvent)).toBe(Priority.MEDIUM)
    })

    test('should adjust priority based on conflicts', () => {
      const conflicts = [{
        id: 'conflict1',
        conflictType: ConflictType.TIME_OVERLAP,
        severity: ConflictLevel.HIGH,
        conflictingEvents: ['event1', 'event2'],
        suggestedResolutions: [],
        detectedAt: new Date()
      }]

      const adjustedPriority = priorityManager.adjustPriorityForConflicts(Priority.LOW, conflicts)
      expect(adjustedPriority).toBe(Priority.HIGH)
    })
  })

  describe('Conflict Detection Algorithms', () => {
    test('should detect time overlap conflicts', () => {
      const event1: CalendarEvent = {
        id: 'event1',
        title: 'Meeting 1',
        description: '',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        allDay: false,
        attendees: [],
        category: EventCategory.WORK,
        priority: Priority.MEDIUM,
        visibility: VisibilityLevel.PRIVATE,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: true,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test-user',
        isPrivate: false
      }

      const event2: CalendarEvent = {
        ...event1,
        id: 'event2',
        title: 'Meeting 2',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z')
      }

      const conflicts = conflictDetector.detectTimeConflicts(event1, [event2])
      expect(conflicts.length).toBe(1)
      expect(conflicts[0].conflictType).toBe(ConflictType.TIME_OVERLAP)
    })

    test('should detect resource conflicts', () => {
      const event1: CalendarEvent = {
        id: 'event1',
        title: 'Meeting 1',
        description: '',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        allDay: false,
        location: {
          name: 'Conference Room A',
          type: 'work' as any
        },
        attendees: [
          { id: 'user1', name: 'John Doe', role: 'required' as any, status: 'pending' as any, isRequired: true }
        ],
        category: EventCategory.WORK,
        priority: Priority.MEDIUM,
        visibility: VisibilityLevel.PRIVATE,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: true,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test-user',
        isPrivate: false
      }

      const event2: CalendarEvent = {
        ...event1,
        id: 'event2',
        title: 'Meeting 2',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        attendees: [
          { id: 'user1', name: 'John Doe', role: 'required' as any, status: 'pending' as any, isRequired: true }
        ]
      }

      const conflicts = conflictDetector.detectResourceConflicts(event1, [event2])
      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts.some(c => c.conflictType === ConflictType.RESOURCE_CONFLICT)).toBe(true)
    })
  })

  describe('Data Serialization and Validation', () => {
    test('should serialize and deserialize events correctly', () => {
      const originalEvent: CalendarEvent = {
        id: 'test-event',
        title: 'Test Event',
        description: 'Test description',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        allDay: false,
        recurrence: {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: [DayOfWeek.MONDAY],
          exceptions: [new Date('2024-01-22T10:00:00Z')],
          occurrenceCount: 5
        },
        attendees: [
          { id: 'user1', name: 'John Doe', email: 'john@example.com', role: 'required' as any, status: 'accepted' as any, isRequired: true }
        ],
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        visibility: VisibilityLevel.PRIVATE,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: true,
          safetyValidatedAt: new Date('2024-01-15T09:00:00Z'),
          tags: ['important', 'recurring'],
          customFields: { projectId: 'proj-123' }
        },
        createdAt: new Date('2024-01-14T12:00:00Z'),
        updatedAt: new Date('2024-01-14T12:00:00Z'),
        createdBy: 'test-user',
        isPrivate: false
      }

      const serialized = serializeCalendarEvent(originalEvent)
      expect(serialized).toBeDefined()
      expect(typeof serialized).toBe('string')

      const deserialized = deserializeCalendarEvent(serialized)
      expect(deserialized.id).toBe(originalEvent.id)
      expect(deserialized.title).toBe(originalEvent.title)
      expect(deserialized.startTime.getTime()).toBe(originalEvent.startTime.getTime())
      expect(deserialized.endTime.getTime()).toBe(originalEvent.endTime.getTime())
      expect(deserialized.recurrence?.frequency).toBe(originalEvent.recurrence?.frequency)
      expect(deserialized.recurrence?.exceptions[0].getTime()).toBe(originalEvent.recurrence?.exceptions[0].getTime())
      expect(deserialized.metadata.safetyValidatedAt?.getTime()).toBe(originalEvent.metadata.safetyValidatedAt?.getTime())
    })

    test('should validate recurrence patterns', () => {
      const validPattern = {
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        daysOfWeek: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
        occurrenceCount: 10,
        exceptions: []
      }

      const validation = validateRecurrencePattern(validPattern)
      expect(validation.isValid).toBe(true)

      const invalidPattern = {
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 0, // Invalid interval
        dayOfMonth: 32, // Invalid day
        exceptions: []
      }

      const invalidValidation = validateRecurrencePattern(invalidPattern)
      expect(invalidValidation.isValid).toBe(false)
      expect(invalidValidation.errors).toContain('Recurrence interval must be at least 1')
      expect(invalidValidation.errors).toContain('Day of month must be between 1 and 31')
    })
  })
})