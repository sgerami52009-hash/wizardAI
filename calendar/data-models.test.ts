// Tests for calendar data models and validation
// Tests Requirements: 1.1, 1.2, 1.5

import {
  validateCalendarEvent,
  validateRecurrencePattern,
  validateChildSafeContent,
  serializeCalendarEvent,
  deserializeCalendarEvent,
  EventCategorizer,
  PriorityManager,
  ConflictDetector,
  eventCategorizer,
  priorityManager,
  conflictDetector
} from './data-models'

import {
  CalendarEvent,
  RecurrencePattern,
  EventCategory,
  Priority,
  VisibilityLevel,
  RecurrenceFrequency,
  EventSource,
  SyncStatus,
  ConflictStatus,
  AttendeeRole,
  AttendeeStatus,
  ReminderType,
  NotificationMethod
} from './types'

describe('Calendar Data Models', () => {
  describe('validateCalendarEvent', () => {
    const validEvent: Partial<CalendarEvent> = {
      title: 'Family Dinner',
      description: 'Weekly family dinner at home',
      startTime: new Date('2024-01-15T18:00:00Z'),
      endTime: new Date('2024-01-15T19:30:00Z'),
      category: EventCategory.FAMILY,
      priority: Priority.MEDIUM
    }

    it('should validate a correct event', () => {
      const result = validateCalendarEvent(validEvent)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should require title', () => {
      const event = { ...validEvent, title: '' }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event title is required')
    })

    it('should require start time', () => {
      const event = { ...validEvent, startTime: undefined }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event start time is required')
    })

    it('should require end time', () => {
      const event = { ...validEvent, endTime: undefined }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event end time is required')
    })

    it('should validate start time before end time', () => {
      const event = {
        ...validEvent,
        startTime: new Date('2024-01-15T19:00:00Z'),
        endTime: new Date('2024-01-15T18:00:00Z')
      }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event start time must be before end time')
    })

    it('should validate child-safe content in title', () => {
      const event = { ...validEvent, title: 'Adult content meeting' }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event title contains inappropriate content')
    })

    it('should validate child-safe content in description', () => {
      const event = { ...validEvent, description: 'Discussion about violence' }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Event description contains inappropriate content')
    })

    it('should warn about long duration events', () => {
      const event = {
        ...validEvent,
        startTime: new Date('2024-01-15T08:00:00Z'),
        endTime: new Date('2024-01-16T10:00:00Z') // 26 hours
      }
      const result = validateCalendarEvent(event)
      expect(result.warnings).toContain('Event duration exceeds 24 hours')
    })

    it('should validate attendee information', () => {
      const event = {
        ...validEvent,
        attendees: [
          {
            id: 'att1',
            name: '',
            email: 'invalid-email',
            role: AttendeeRole.REQUIRED,
            status: AttendeeStatus.PENDING,
            isRequired: true
          }
        ]
      }
      const result = validateCalendarEvent(event)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Attendee missing name: att1')
      expect(result.errors).toContain('Invalid email for attendee: ')
    })
  })

  describe('validateRecurrencePattern', () => {
    it('should validate correct recurrence pattern', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        endDate: new Date('2024-12-31'),
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.isValid).toBe(true)
    })

    it('should require positive interval', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.DAILY,
        interval: 0,
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Recurrence interval must be at least 1')
    })

    it('should warn about high intervals', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1000,
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.warnings).toContain('Very high recurrence interval may cause performance issues')
    })

    it('should warn about infinite recurrence', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.DAILY,
        interval: 1,
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.warnings).toContain('Infinite recurrence pattern - consider adding end date or occurrence count')
    })

    it('should validate monthly day of month', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.MONTHLY,
        interval: 1,
        dayOfMonth: 32,
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Day of month must be between 1 and 31')
    })

    it('should validate yearly month', () => {
      const pattern: RecurrencePattern = {
        frequency: RecurrenceFrequency.YEARLY,
        interval: 1,
        monthOfYear: 13,
        exceptions: []
      }
      const result = validateRecurrencePattern(pattern)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Month of year must be between 1 and 12')
    })
  })

  describe('validateChildSafeContent', () => {
    it('should allow safe content', () => {
      expect(validateChildSafeContent('Family dinner')).toBe(true)
      expect(validateChildSafeContent('School meeting')).toBe(true)
      expect(validateChildSafeContent('Birthday party')).toBe(true)
    })

    it('should block inappropriate content', () => {
      expect(validateChildSafeContent('Adult content')).toBe(false)
      expect(validateChildSafeContent('Violence discussion')).toBe(false)
      expect(validateChildSafeContent('Drug meeting')).toBe(false)
    })

    it('should handle empty content', () => {
      expect(validateChildSafeContent('')).toBe(true)
      expect(validateChildSafeContent(null as any)).toBe(true)
      expect(validateChildSafeContent(undefined as any)).toBe(true)
    })
  })

  describe('Event Serialization', () => {
    const testEvent: CalendarEvent = {
      id: 'event1',
      title: 'Test Event',
      description: 'Test Description',
      startTime: new Date('2024-01-15T18:00:00Z'),
      endTime: new Date('2024-01-15T19:00:00Z'),
      allDay: false,
      location: {
        name: 'Home',
        type: 'home' as any
      },
      attendees: [],
      category: EventCategory.FAMILY,
      priority: Priority.MEDIUM,
      visibility: VisibilityLevel.FAMILY,
      reminders: [],
      metadata: {
        source: EventSource.LOCAL,
        syncStatus: SyncStatus.SYNCED,
        conflictStatus: ConflictStatus.NONE,
        safetyValidated: true,
        tags: [],
        customFields: {}
      },
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      createdBy: 'user1',
      isPrivate: false
    }

    it('should serialize and deserialize event correctly', () => {
      const serialized = serializeCalendarEvent(testEvent)
      const deserialized = deserializeCalendarEvent(serialized)

      expect(deserialized.id).toBe(testEvent.id)
      expect(deserialized.title).toBe(testEvent.title)
      expect(deserialized.startTime).toEqual(testEvent.startTime)
      expect(deserialized.endTime).toEqual(testEvent.endTime)
      expect(deserialized.category).toBe(testEvent.category)
    })

    it('should handle recurrence patterns in serialization', () => {
      const eventWithRecurrence = {
        ...testEvent,
        recurrence: {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          endDate: new Date('2024-12-31'),
          exceptions: [new Date('2024-02-15')]
        }
      }

      const serialized = serializeCalendarEvent(eventWithRecurrence)
      const deserialized = deserializeCalendarEvent(serialized)

      expect(deserialized.recurrence?.frequency).toBe(RecurrenceFrequency.WEEKLY)
      expect(deserialized.recurrence?.endDate).toEqual(new Date('2024-12-31'))
      expect(deserialized.recurrence?.exceptions).toHaveLength(1)
    })

    it('should preserve all event metadata during serialization', () => {
      const complexEvent = {
        ...testEvent,
        metadata: {
          ...testEvent.metadata,
          lastSyncTime: new Date('2024-01-15T12:00:00Z'),
          safetyValidatedAt: new Date('2024-01-15T11:00:00Z'),
          tags: ['important', 'family'],
          customFields: { priority: 'high', location: 'home' }
        }
      }

      const serialized = serializeCalendarEvent(complexEvent)
      const deserialized = deserializeCalendarEvent(serialized)

      expect(deserialized.metadata.lastSyncTime).toEqual(complexEvent.metadata.lastSyncTime)
      expect(deserialized.metadata.safetyValidatedAt).toEqual(complexEvent.metadata.safetyValidatedAt)
      expect(deserialized.metadata.tags).toEqual(['important', 'family'])
      expect(deserialized.metadata.customFields).toEqual({ priority: 'high', location: 'home' })
    })

    it('should handle undefined optional fields in serialization', () => {
      const minimalEvent = {
        ...testEvent,
        location: undefined,
        recurrence: undefined,
        metadata: {
          ...testEvent.metadata,
          lastSyncTime: undefined,
          safetyValidatedAt: undefined
        }
      }

      const serialized = serializeCalendarEvent(minimalEvent)
      const deserialized = deserializeCalendarEvent(serialized)

      expect(deserialized.location).toBeUndefined()
      expect(deserialized.recurrence).toBeUndefined()
      expect(deserialized.metadata.lastSyncTime).toBeUndefined()
      expect(deserialized.metadata.safetyValidatedAt).toBeUndefined()
    })
  })

  describe('Recurring Event Pattern Processing', () => {
    // Test helper to create a recurring event
    const createRecurringEvent = (pattern: RecurrencePattern): CalendarEvent => ({
      id: 'recurring-event',
      title: 'Recurring Event',
      description: 'Test recurring event',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T11:00:00Z'),
      allDay: false,
      recurrence: pattern,
      attendees: [],
      category: EventCategory.OTHER,
      priority: Priority.MEDIUM,
      visibility: VisibilityLevel.PRIVATE,
      reminders: [],
      metadata: {
        source: EventSource.LOCAL,
        syncStatus: SyncStatus.SYNCED,
        conflictStatus: ConflictStatus.NONE,
        safetyValidated: true,
        tags: [],
        customFields: {}
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user1',
      isPrivate: false
    })

    describe('Daily Recurrence', () => {
      it('should validate daily recurrence pattern', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          occurrenceCount: 5,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should handle daily recurrence with custom interval', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.DAILY,
          interval: 3, // Every 3 days
          endDate: new Date('2024-01-30'),
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should handle daily recurrence with exceptions', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          endDate: new Date('2024-01-25'),
          exceptions: [new Date('2024-01-20'), new Date('2024-01-22')]
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })
    })

    describe('Weekly Recurrence', () => {
      it('should validate weekly recurrence pattern', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
          endDate: new Date('2024-03-15'),
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should handle bi-weekly recurrence', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 2, // Every 2 weeks
          daysOfWeek: [1], // Monday only
          occurrenceCount: 10,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })
    })

    describe('Monthly Recurrence', () => {
      it('should validate monthly recurrence by day of month', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          dayOfMonth: 15, // 15th of each month
          endDate: new Date('2024-12-31'),
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should validate monthly recurrence by day of week', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          daysOfWeek: [1], // First Monday of each month
          occurrenceCount: 12,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should reject invalid day of month', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          dayOfMonth: 32, // Invalid day
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Day of month must be between 1 and 31')
      })
    })

    describe('Yearly Recurrence', () => {
      it('should validate yearly recurrence pattern', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.YEARLY,
          interval: 1,
          monthOfYear: 6, // June
          dayOfMonth: 15, // June 15th
          occurrenceCount: 5,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(true)
      })

      it('should reject invalid month of year', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.YEARLY,
          interval: 1,
          monthOfYear: 13, // Invalid month
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Month of year must be between 1 and 12')
      })
    })

    describe('Recurrence Edge Cases', () => {
      it('should warn about infinite recurrence without end conditions', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.warnings).toContain('Infinite recurrence pattern - consider adding end date or occurrence count')
      })

      it('should warn about conflicting end conditions', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          endDate: new Date('2024-12-31'),
          occurrenceCount: 10,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.warnings).toContain('Both end date and occurrence count specified - end date will take precedence')
      })

      it('should warn about very high intervals', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.DAILY,
          interval: 1000,
          occurrenceCount: 5,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.warnings).toContain('Very high recurrence interval may cause performance issues')
      })

      it('should reject zero or negative intervals', () => {
        const pattern: RecurrencePattern = {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 0,
          exceptions: []
        }

        const result = validateRecurrencePattern(pattern)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Recurrence interval must be at least 1')
      })
    })
  })

  describe('EventCategorizer', () => {
    const categorizer = new EventCategorizer()

    it('should suggest work category for work-related events', () => {
      const category = categorizer.suggestCategory('Team meeting', 'Project discussion')
      expect(category).toBe(EventCategory.WORK)
    })

    it('should suggest education category for school events', () => {
      const category = categorizer.suggestCategory('Math class', 'Homework review')
      expect(category).toBe(EventCategory.EDUCATION)
    })

    it('should suggest family category for family events', () => {
      const category = categorizer.suggestCategory('Family dinner', 'Birthday celebration')
      expect(category).toBe(EventCategory.FAMILY)
    })

    it('should default to other for unrecognized content', () => {
      const category = categorizer.suggestCategory('Random event', 'Unknown activity')
      expect(category).toBe(EventCategory.OTHER)
    })

    it('should calculate category confidence', () => {
      const confidence = categorizer.getCategoryConfidence(
        'Team meeting project',
        'Business discussion',
        EventCategory.WORK
      )
      expect(confidence).toBeGreaterThan(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('PriorityManager', () => {
    const manager = new PriorityManager()

    it('should suggest critical priority for urgent events', () => {
      const event = {
        title: 'Urgent meeting',
        description: 'Critical deadline',
        startTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
      }
      const priority = manager.suggestPriority(event)
      expect(priority).toBe(Priority.CRITICAL)
    })

    it('should suggest high priority for soon events', () => {
      const event = {
        title: 'Team meeting',
        startTime: new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours from now
      }
      const priority = manager.suggestPriority(event)
      expect(priority).toBe(Priority.HIGH)
    })

    it('should suggest medium priority for weekly events', () => {
      const event = {
        title: 'Regular meeting',
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
      }
      const priority = manager.suggestPriority(event)
      expect(priority).toBe(Priority.MEDIUM)
    })

    it('should suggest low priority for distant events', () => {
      const event = {
        title: 'Future meeting',
        startTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
      const priority = manager.suggestPriority(event)
      expect(priority).toBe(Priority.LOW)
    })
  })

  describe('ConflictDetector', () => {
    const detector = new ConflictDetector()

    const createTestEvent = (id: string, start: Date, end: Date): CalendarEvent => ({
      id,
      title: `Event ${id}`,
      description: '',
      startTime: start,
      endTime: end,
      allDay: false,
      attendees: [],
      category: EventCategory.OTHER,
      priority: Priority.MEDIUM,
      visibility: VisibilityLevel.PRIVATE,
      reminders: [],
      metadata: {
        source: EventSource.LOCAL,
        syncStatus: SyncStatus.SYNCED,
        conflictStatus: ConflictStatus.NONE,
        safetyValidated: true,
        tags: [],
        customFields: {}
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user1',
      isPrivate: false
    })

    describe('Time Conflict Detection', () => {
      it('should detect time conflicts between overlapping events', () => {
        const event1 = createTestEvent('1', 
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts).toHaveLength(1)
        expect(conflicts[0].conflictingEvents).toContain('1')
        expect(conflicts[0].conflictingEvents).toContain('2')
      })

      it('should not detect conflicts for non-overlapping events', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        const event2 = createTestEvent('2',
          new Date('2024-01-15T11:00:00Z'),
          new Date('2024-01-15T12:00:00Z')
        )

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts).toHaveLength(0)
      })

      it('should detect conflicts for events that start at the same time', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T10:30:00Z')
        )

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts).toHaveLength(1)
      })

      it('should detect conflicts for events where one contains the other', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T12:00:00Z')
        )
        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts).toHaveLength(1)
      })

      it('should handle multiple conflicting events', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T12:00:00Z')
        )
        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        const event3 = createTestEvent('3',
          new Date('2024-01-15T11:00:00Z'),
          new Date('2024-01-15T13:00:00Z')
        )

        const conflicts = detector.detectTimeConflicts(event1, [event2, event3])
        expect(conflicts).toHaveLength(2)
      })
    })

    describe('Resource Conflict Detection', () => {
      it('should detect location conflicts', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.location = { name: 'Conference Room A', type: 'work' as any }

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.location = { name: 'Conference Room A', type: 'work' as any }

        const conflicts = detector.detectResourceConflicts(event1, [event2])
        expect(conflicts.length).toBeGreaterThan(0)
      })

      it('should detect attendee conflicts', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.attendees = [{
          id: 'user1',
          name: 'John Doe',
          role: AttendeeRole.REQUIRED,
          status: AttendeeStatus.ACCEPTED,
          isRequired: true
        }]

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.attendees = [{
          id: 'user1',
          name: 'John Doe',
          role: AttendeeRole.REQUIRED,
          status: AttendeeStatus.ACCEPTED,
          isRequired: true
        }]

        const conflicts = detector.detectResourceConflicts(event1, [event2])
        expect(conflicts.length).toBeGreaterThan(0)
      })

      it('should not detect conflicts for different locations', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.location = { name: 'Conference Room A', type: 'work' as any }

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.location = { name: 'Conference Room B', type: 'work' as any }

        const conflicts = detector.detectResourceConflicts(event1, [event2])
        expect(conflicts).toHaveLength(0)
      })

      it('should not detect conflicts for different attendees', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.attendees = [{
          id: 'user1',
          name: 'John Doe',
          role: AttendeeRole.REQUIRED,
          status: AttendeeStatus.ACCEPTED,
          isRequired: true
        }]

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.attendees = [{
          id: 'user2',
          name: 'Jane Doe',
          role: AttendeeRole.REQUIRED,
          status: AttendeeStatus.ACCEPTED,
          isRequired: true
        }]

        const conflicts = detector.detectResourceConflicts(event1, [event2])
        expect(conflicts).toHaveLength(0)
      })

      it('should detect conflicts based on coordinate proximity', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.location = { 
          name: 'Location A', 
          type: 'work' as any,
          coordinates: { latitude: 40.7128, longitude: -74.0060 }
        }

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.location = { 
          name: 'Location B', 
          type: 'work' as any,
          coordinates: { latitude: 40.7129, longitude: -74.0061 } // Very close coordinates
        }

        const conflicts = detector.detectResourceConflicts(event1, [event2])
        expect(conflicts.length).toBeGreaterThan(0)
      })
    })

    describe('Conflict Severity Assessment', () => {
      it('should assign high severity for critical priority conflicts', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.priority = Priority.CRITICAL

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.priority = Priority.MEDIUM

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts[0].severity).toBe('high')
      })

      it('should assign medium severity for high priority conflicts', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.priority = Priority.HIGH

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.priority = Priority.LOW

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts[0].severity).toBe('medium')
      })

      it('should assign low severity for low priority conflicts', () => {
        const event1 = createTestEvent('1',
          new Date('2024-01-15T10:00:00Z'),
          new Date('2024-01-15T11:00:00Z')
        )
        event1.priority = Priority.LOW

        const event2 = createTestEvent('2',
          new Date('2024-01-15T10:30:00Z'),
          new Date('2024-01-15T11:30:00Z')
        )
        event2.priority = Priority.LOW

        const conflicts = detector.detectTimeConflicts(event1, [event2])
        expect(conflicts[0].severity).toBe('low')
      })
    })
  })
})