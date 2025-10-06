// Unit tests for schedule content safety validation system

import {
  ScheduleSafetyValidator,
  SafetyValidationResult,
  ViolationType,
  ViolationSeverity,
  RiskLevel,
  SafetyAction,
  DEFAULT_CHILD_SAFETY_CONFIG
} from './safety-validator'
import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { Reminder, ReminderType } from '../reminders/types'

describe('ScheduleSafetyValidator', () => {
  let validator: ScheduleSafetyValidator
  const mockUserId = 'child_user_123'

  beforeEach(() => {
    validator = new ScheduleSafetyValidator(DEFAULT_CHILD_SAFETY_CONFIG)
  })

  describe('Event Validation', () => {
    it('should approve safe educational events', async () => {
      const safeEvent: CalendarEvent = {
        id: 'event_1',
        title: 'Math homework session',
        description: 'Complete algebra homework with study group',
        startTime: new Date('2024-01-15T15:00:00'),
        endTime: new Date('2024-01-15T16:00:00'),
        allDay: false,
        location: { name: 'School library', type: 'school' as any },
        attendees: [
          { id: 'att1', name: 'Study buddy', email: 'friend@school.edu', role: 'required' as any, status: 'pending' as any, isRequired: true }
        ],
        category: EventCategory.EDUCATION,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(safeEvent, mockUserId)

      expect(result.isValid).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
      expect(result.violations).toHaveLength(0)
      expect(result.recommendations).toContain('Content is safe for children')
    })

    it('should block events with inappropriate language', async () => {
      const inappropriateEvent: CalendarEvent = {
        id: 'event_2',
        title: 'Adult party with alcohol',
        description: 'Secret meeting - don\'t tell parents',
        startTime: new Date('2024-01-15T20:00:00'),
        endTime: new Date('2024-01-15T23:00:00'),
        allDay: false,
        location: { name: 'Unknown location', type: 'other' as any },
        attendees: [],
        category: EventCategory.ENTERTAINMENT,
        priority: 2,
        visibility: VisibilityLevel.PRIVATE,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(inappropriateEvent, mockUserId)

      expect(result.isValid).toBe(false)
      expect(result.riskLevel).toBe(RiskLevel.BLOCKED)
      expect(result.violations.length).toBeGreaterThan(0)
      
      const violationTypes = result.violations.map(v => v.type)
      expect(violationTypes).toContain(ViolationType.INAPPROPRIATE_LANGUAGE)
      
      const adultViolation = result.violations.find(v => v.originalContent.includes('Adult party with alcohol'))
      expect(adultViolation?.severity).toBe(ViolationSeverity.CRITICAL)
    })

    it('should flag events with external links', async () => {
      const eventWithLinks: CalendarEvent = {
        id: 'event_3',
        title: 'Online meeting',
        description: 'Join at https://suspicious-site.com/meeting',
        startTime: new Date('2024-01-15T14:00:00'),
        endTime: new Date('2024-01-15T15:00:00'),
        allDay: false,
        location: { name: 'Online', type: 'other' as any },
        attendees: [],
        category: EventCategory.EDUCATION,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(eventWithLinks, mockUserId)

      expect(result.isValid).toBe(false)
      expect(result.violations.some(v => v.type === ViolationType.EXTERNAL_LINK)).toBe(true)
      expect(result.recommendations).toContain('Verify external links and domains are child-safe')
    })

    it('should validate event duration limits', async () => {
      const longEvent: CalendarEvent = {
        id: 'event_4',
        title: 'All day gaming session',
        description: 'Playing games all day',
        startTime: new Date('2024-01-15T08:00:00'),
        endTime: new Date('2024-01-15T20:00:00'), // 12 hours
        allDay: false,
        location: { name: 'Home', type: 'home' as any },
        attendees: [],
        category: EventCategory.ENTERTAINMENT,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(longEvent, mockUserId)

      expect(result.violations.some(v => v.type === ViolationType.INAPPROPRIATE_TIME)).toBe(true)
      expect(result.violations.some(v => v.field === 'duration')).toBe(true)
    })

    it('should validate time restrictions', async () => {
      const lateNightEvent: CalendarEvent = {
        id: 'event_5',
        title: 'Late night study',
        description: 'Studying late',
        startTime: new Date('2024-01-15T23:00:00'), // 11 PM
        endTime: new Date('2024-01-16T01:00:00'),   // 1 AM
        allDay: false,
        location: { name: 'Home', type: 'home' as any },
        attendees: [],
        category: EventCategory.EDUCATION,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(lateNightEvent, mockUserId)

      expect(result.violations.some(v => 
        v.type === ViolationType.INAPPROPRIATE_TIME && v.field === 'startTime'
      )).toBe(true)
    })

    it('should detect personal information in descriptions', async () => {
      const eventWithPII: CalendarEvent = {
        id: 'event_6',
        title: 'Doctor appointment',
        description: 'Call Dr. Smith at 555-123-4567 or visit 123 Main Street',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
        allDay: false,
        location: { name: 'Medical center', type: 'other' as any },
        attendees: [],
        category: EventCategory.HEALTH,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(eventWithPII, mockUserId)

      expect(result.violations.some(v => v.type === ViolationType.PERSONAL_INFO)).toBe(true)
      expect(result.recommendations).toContain('Remove personal information for privacy protection')
    })

    it('should validate external calendar events more strictly', async () => {
      const externalEvent: CalendarEvent = {
        id: 'event_7',
        title: 'School assembly',
        description: 'Monthly school assembly',
        startTime: new Date('2024-01-15T09:00:00'),
        endTime: new Date('2024-01-15T10:00:00'),
        allDay: false,
        location: { name: 'School auditorium', type: 'school' as any },
        attendees: [],
        category: EventCategory.EDUCATION,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'google_calendar' as any, // External source
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'external_system',
        isPrivate: false
      }

      const result = await validator.validateEvent(externalEvent, mockUserId)

      // In strict mode, external events should be flagged for review
      expect(result.violations.some(v => 
        v.type === ViolationType.EXTERNAL_LINK && v.field === 'source'
      )).toBe(true)
    })
  })

  describe('Reminder Validation', () => {
    it('should approve safe reminders', async () => {
      const safeReminder: Reminder = {
        id: 'reminder_1',
        userId: mockUserId,
        eventId: 'event_1',
        title: 'Time for homework',
        description: 'Don\'t forget to do your math homework',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date('2024-01-15T15:00:00'),
        priority: 2,
        deliveryMethods: ['voice' as any],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: 'pending' as any,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await validator.validateReminder(safeReminder, mockUserId)

      expect(result.isValid).toBe(true)
      expect(result.riskLevel).toBe(RiskLevel.SAFE)
      expect(result.violations).toHaveLength(0)
    })

    it('should block reminders with inappropriate content', async () => {
      const inappropriateReminder: Reminder = {
        id: 'reminder_2',
        userId: mockUserId,
        title: 'Secret meeting reminder',
        description: 'Don\'t tell anyone about this - meet at the bar',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date('2024-01-15T20:00:00'),
        priority: 2,
        deliveryMethods: ['voice' as any],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: 'pending' as any,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await validator.validateReminder(inappropriateReminder, mockUserId)

      expect(result.isValid).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.type === ViolationType.INAPPROPRIATE_LANGUAGE)).toBe(true)
    })

    it('should validate reminder timing', async () => {
      const lateReminder: Reminder = {
        id: 'reminder_3',
        userId: mockUserId,
        title: 'Late night reminder',
        description: 'Time to study',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date('2024-01-15T02:00:00'), // 2 AM
        priority: 2,
        deliveryMethods: ['voice' as any],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: 'pending' as any,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await validator.validateReminder(lateReminder, mockUserId)

      expect(result.violations.some(v => 
        v.type === ViolationType.INAPPROPRIATE_TIME && v.field === 'triggerTime'
      )).toBe(true)
    })
  })

  describe('External Calendar Content Validation', () => {
    it('should validate ICS subscription content', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
SUMMARY:School Holiday
DESCRIPTION:No classes today
DTSTART:20240115T000000Z
DTEND:20240115T235959Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Adult Content Event
DESCRIPTION:This event contains inappropriate material
DTSTART:20240116T180000Z
DTEND:20240116T200000Z
END:VEVENT
END:VCALENDAR`

      const result = await validator.validateExternalCalendarContent(
        icsContent,
        'https://school.edu/calendar.ics',
        mockUserId
      )

      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations.some(v => v.originalContent.includes('Adult Content Event'))).toBe(true)
    })

    it('should validate external source domains', async () => {
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
SUMMARY:Safe Event
DESCRIPTION:This is a safe event
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
END:VEVENT
END:VCALENDAR`

      const result = await validator.validateExternalCalendarContent(
        icsContent,
        'https://suspicious-domain.com/calendar.ics',
        mockUserId
      )

      expect(result.violations.some(v => 
        v.type === ViolationType.EXTERNAL_LINK && v.field === 'source'
      )).toBe(true)
    })
  })

  describe('Safety Configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        strictMode: false,
        maxEventDuration: 6,
        blockedKeywords: ['test', 'blocked']
      }

      validator.updateConfig(newConfig)
      const config = validator.getConfig()

      expect(config.strictMode).toBe(false)
      expect(config.maxEventDuration).toBe(6)
      expect(config.blockedKeywords).toContain('test')
      expect(config.blockedKeywords).toContain('blocked')
    })

    it('should maintain default values for non-updated config', () => {
      const newConfig = { strictMode: false }
      
      validator.updateConfig(newConfig)
      const config = validator.getConfig()

      expect(config.strictMode).toBe(false)
      expect(config.allowedCategories).toEqual(DEFAULT_CHILD_SAFETY_CONFIG.allowedCategories)
      expect(config.externalContentFiltering).toBe(DEFAULT_CHILD_SAFETY_CONFIG.externalContentFiltering)
    })
  })

  describe('Audit Logging', () => {
    it('should log safety validations', async () => {
      const event: CalendarEvent = {
        id: 'event_audit',
        title: 'Test event',
        description: 'Safe test event',
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T11:00:00'),
        allDay: false,
        location: { name: 'Home', type: 'home' as any },
        attendees: [],
        category: EventCategory.FAMILY,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      await validator.validateEvent(event, mockUserId)

      const auditLogs = validator.getAuditLogs(mockUserId)
      expect(auditLogs.length).toBeGreaterThan(0)
      
      const eventLog = auditLogs.find(log => log.contentId === 'event_audit')
      expect(eventLog).toBeDefined()
      expect(eventLog?.userId).toBe(mockUserId)
      expect(eventLog?.contentType).toBe('event')
      expect(eventLog?.action).toBe(SafetyAction.APPROVED)
    })

    it('should filter audit logs by date range', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const filteredLogs = validator.getAuditLogs(mockUserId, startDate, endDate)
      
      filteredLogs.forEach(log => {
        expect(log.timestamp).toBeInstanceOf(Date)
        expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
        expect(log.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime())
      })
    })
  })

  describe('Risk Level Determination', () => {
    it('should correctly determine risk levels', async () => {
      // Safe content
      const safeEvent: CalendarEvent = {
        id: 'safe',
        title: 'Family dinner',
        description: 'Having dinner with family',
        startTime: new Date('2024-01-15T18:00:00'),
        endTime: new Date('2024-01-15T19:00:00'),
        allDay: false,
        location: { name: 'Home', type: 'home' as any },
        attendees: [],
        category: EventCategory.FAMILY,
        priority: 2,
        visibility: VisibilityLevel.FAMILY,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const safeResult = await validator.validateEvent(safeEvent, mockUserId)
      expect(safeResult.riskLevel).toBe(RiskLevel.SAFE)

      // High risk content
      const riskyEvent: CalendarEvent = {
        ...safeEvent,
        id: 'risky',
        title: 'Violence and weapons demonstration',
        description: 'Learning about dangerous weapons'
      }

      const riskyResult = await validator.validateEvent(riskyEvent, mockUserId)
      expect(riskyResult.riskLevel).toBe(RiskLevel.BLOCKED)
    })
  })

  describe('Content Filtering', () => {
    it('should generate filtered content suggestions', async () => {
      const inappropriateEvent: CalendarEvent = {
        id: 'filter_test',
        title: 'Adult party with alcohol',
        description: 'Secret meeting with inappropriate content',
        startTime: new Date('2024-01-15T20:00:00'),
        endTime: new Date('2024-01-15T22:00:00'),
        allDay: false,
        location: { name: 'Bar location', type: 'other' as any },
        attendees: [],
        category: EventCategory.ENTERTAINMENT,
        priority: 2,
        visibility: VisibilityLevel.PRIVATE,
        reminders: [],
        metadata: {
          source: 'local' as any,
          syncStatus: 'synced' as any,
          conflictStatus: 'none' as any,
          safetyValidated: false,
          tags: [],
          customFields: {}
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUserId,
        isPrivate: false
      }

      const result = await validator.validateEvent(inappropriateEvent, mockUserId)

      expect(result.filteredContent).toBeDefined()
      expect(result.filteredContent?.title).toBe('[Content filtered for safety]')
      expect(result.filteredContent?.description).toBe('[Description filtered for safety]')
      expect(result.filteredContent?.location).toBe('[Location filtered for safety]')
    })
  })
})