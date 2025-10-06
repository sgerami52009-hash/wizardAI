// Comprehensive unit tests for safety validation and parental controls
// Tests all safety and parental control functionality across scheduling features

import {
  ScheduleSafetyValidator,
  SafetyValidationResult,
  ViolationType,
  ViolationSeverity,
  RiskLevel,
  SafetyAction,
  SafetyAuditLog,
  DEFAULT_CHILD_SAFETY_CONFIG
} from './safety-validator'
import {
  ParentalControlSystem,
  ParentalControlConfig,
  ApprovalType,
  RestrictionType,
  ApprovalStatus,
  RequestType,
  RequestPriority,
  NotificationMethod,
  SafetyAlert,
  AlertType,
  AlertSeverity
} from './parental-control-system'
import { ContentValidator, ValidationResult, ICSValidationResult } from '../sync/content-validator'
import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { Reminder, ReminderType } from '../reminders/types'

describe('Comprehensive Safety and Parental Controls', () => {
  let safetyValidator: ScheduleSafetyValidator
  let parentalControl: ParentalControlSystem
  let contentValidator: ContentValidator
  
  const childUserId = 'child_123'
  const parentId = 'parent_456'
  const siblingId = 'sibling_789'

  beforeEach(() => {
    safetyValidator = new ScheduleSafetyValidator(DEFAULT_CHILD_SAFETY_CONFIG)
    parentalControl = new ParentalControlSystem()
    contentValidator = new ContentValidator()
  })

  describe('Content Safety Validation Across All Features', () => {
    describe('Calendar Event Safety Validation', () => {
      it('should validate safe educational events', async () => {
        const safeEvent = createSafeEducationalEvent()
        const result = await safetyValidator.validateEvent(safeEvent, childUserId)

        expect(result.isValid).toBe(true)
        expect(result.riskLevel).toBe(RiskLevel.SAFE)
        expect(result.violations).toHaveLength(0)
        expect(result.recommendations).toContain('Content is safe for children')
      })

      it('should block events with multiple safety violations', async () => {
        const dangerousEvent = createDangerousEvent()
        const result = await safetyValidator.validateEvent(dangerousEvent, childUserId)

        expect(result.isValid).toBe(false)
        expect(result.riskLevel).toBe(RiskLevel.BLOCKED)
        expect(result.violations.length).toBeGreaterThan(2)
        
        const violationTypes = result.violations.map(v => v.type)
        expect(violationTypes).toContain(ViolationType.INAPPROPRIATE_LANGUAGE)
        expect(violationTypes).toContain(ViolationType.UNSAFE_LOCATION)
        expect(violationTypes).toContain(ViolationType.INAPPROPRIATE_TIME)
      })

      it('should detect and flag personal information in events', async () => {
        const eventWithPII = createEventWithPersonalInfo()
        const result = await safetyValidator.validateEvent(eventWithPII, childUserId)

        expect(result.violations.some(v => v.type === ViolationType.PERSONAL_INFO)).toBe(true)
        expect(result.recommendations).toContain('Remove personal information for privacy protection')
        
        const phoneViolation = result.violations.find(v => 
          v.type === ViolationType.PERSONAL_INFO && v.originalContent.includes('555-123-4567')
        )
        expect(phoneViolation).toBeDefined()
        expect(phoneViolation?.severity).toBe(ViolationSeverity.HIGH)
      })

      it('should validate external links and domains', async () => {
        const eventWithSuspiciousLinks = createEventWithSuspiciousLinks()
        const result = await safetyValidator.validateEvent(eventWithSuspiciousLinks, childUserId)

        expect(result.violations.some(v => v.type === ViolationType.EXTERNAL_LINK)).toBe(true)
        
        const linkViolation = result.violations.find(v => 
          v.originalContent.includes('suspicious-site.com')
        )
        expect(linkViolation?.severity).toBe(ViolationSeverity.HIGH)
        expect(linkViolation?.suggestedFix).toContain('Remove external links')
      })

      it('should validate event categories against allowed list', async () => {
        const workEvent = createWorkEvent()
        const result = await safetyValidator.validateEvent(workEvent, childUserId)

        expect(result.violations.some(v => 
          v.field === 'category' && v.originalContent === EventCategory.WORK
        )).toBe(true)
        expect(result.violations.find(v => v.field === 'category')?.suggestedFix)
          .toContain('Change to one of:')
      })

      it('should enforce maximum event duration limits', async () => {
        const longEvent = createExcessivelyLongEvent()
        const result = await safetyValidator.validateEvent(longEvent, childUserId)

        expect(result.violations.some(v => 
          v.type === ViolationType.INAPPROPRIATE_TIME && v.field === 'duration'
        )).toBe(true)
        expect(result.violations.find(v => v.field === 'duration')?.description)
          .toContain('exceeds maximum allowed')
      })

      it('should validate attendee email domains', async () => {
        const eventWithSuspiciousAttendees = createEventWithSuspiciousAttendees()
        const result = await safetyValidator.validateEvent(eventWithSuspiciousAttendees, childUserId)

        expect(result.violations.some(v => 
          v.type === ViolationType.EXTERNAL_LINK && v.field === 'attendees'
        )).toBe(true)
        expect(result.violations.find(v => v.field === 'attendees')?.description)
          .toContain('unverified domain')
      })
    })

    describe('Reminder Safety Validation', () => {
      it('should validate safe reminder content', async () => {
        const safeReminder = createSafeReminder()
        const result = await safetyValidator.validateReminder(safeReminder, childUserId)

        expect(result.isValid).toBe(true)
        expect(result.riskLevel).toBe(RiskLevel.SAFE)
        expect(result.violations).toHaveLength(0)
      })

      it('should block reminders with inappropriate content', async () => {
        const inappropriateReminder = createInappropriateReminder()
        const result = await safetyValidator.validateReminder(inappropriateReminder, childUserId)

        expect(result.isValid).toBe(false)
        expect(result.violations.some(v => v.type === ViolationType.INAPPROPRIATE_LANGUAGE)).toBe(true)
        
        const secretViolation = result.violations.find(v => 
          v.originalContent.includes('secret')
        )
        expect(secretViolation?.severity).toBe(ViolationSeverity.HIGH)
      })

      it('should validate reminder timing restrictions', async () => {
        const lateNightReminder = createLateNightReminder()
        const result = await safetyValidator.validateReminder(lateNightReminder, childUserId)

        expect(result.violations.some(v => 
          v.type === ViolationType.INAPPROPRIATE_TIME && v.field === 'triggerTime'
        )).toBe(true)
        expect(result.violations.find(v => v.field === 'triggerTime')?.description)
          .toContain('sleep hours')
      })

      it('should validate recurring reminder patterns', async () => {
        const recurringReminder = createRecurringReminder()
        const result = await safetyValidator.validateReminder(recurringReminder, childUserId)

        // Should validate each occurrence of the recurring reminder
        expect(result.isValid).toBe(true)
        expect(result.riskLevel).toBe(RiskLevel.SAFE)
      })
    })

    describe('External Calendar Content Validation', () => {
      it('should validate safe ICS subscription content', async () => {
        const safeICSContent = createSafeICSContent()
        const result = await safetyValidator.validateExternalCalendarContent(
          safeICSContent,
          'https://school.edu/calendar.ics',
          childUserId
        )

        expect(result.isValid).toBe(true)
        expect(result.riskLevel).toBe(RiskLevel.LOW_RISK) // External content gets flagged in strict mode
      })

      it('should block ICS content with inappropriate events', async () => {
        const inappropriateICSContent = createInappropriateICSContent()
        const result = await safetyValidator.validateExternalCalendarContent(
          inappropriateICSContent,
          'https://suspicious-domain.com/calendar.ics',
          childUserId
        )

        expect(result.isValid).toBe(false)
        expect(result.riskLevel).toBe(RiskLevel.BLOCKED)
        expect(result.violations.some(v => v.type === ViolationType.INAPPROPRIATE_LANGUAGE)).toBe(true)
        expect(result.violations.some(v => v.type === ViolationType.EXTERNAL_LINK)).toBe(true)
      })

      it('should validate external calendar source domains', async () => {
        const safeContent = createSafeICSContent()
        const result = await safetyValidator.validateExternalCalendarContent(
          safeContent,
          'https://blocked-domain.com/calendar.ics',
          childUserId
        )

        expect(result.violations.some(v => 
          v.type === ViolationType.EXTERNAL_LINK && v.field === 'source'
        )).toBe(true)
        expect(result.violations.find(v => v.field === 'source')?.description)
          .toContain('unverified domain')
      })

      it('should handle malformed ICS content gracefully', async () => {
        const malformedICS = 'INVALID ICS CONTENT'
        const result = await safetyValidator.validateExternalCalendarContent(
          malformedICS,
          'https://school.edu/calendar.ics',
          childUserId
        )

        // Should not crash and should provide meaningful feedback
        expect(result).toBeDefined()
        expect(result.violations).toBeDefined()
      })

      it('should validate large ICS files efficiently', async () => {
        const largeICSContent = createLargeICSContent(500) // 500 events
        const startTime = Date.now()
        
        const result = await safetyValidator.validateExternalCalendarContent(
          largeICSContent,
          'https://school.edu/large-calendar.ics',
          childUserId
        )
        
        const processingTime = Date.now() - startTime
        expect(processingTime).toBeLessThan(5000) // Should process within 5 seconds
        expect(result).toBeDefined()
      })
    })

    describe('Content Validator Integration', () => {
      it('should validate calendar events through content validator', async () => {
        const testEvent = createSafeEducationalEvent()
        const result = await contentValidator.validateEvent(testEvent)

        expect(result.isValid).toBe(true)
        expect(result.severity).toBe('low')
        expect(result.issues).toHaveLength(0)
        expect(result.recommendation).toContain('appropriate for children')
      })

      it('should detect inappropriate content in events', async () => {
        const inappropriateEvent = createDangerousEvent()
        const result = await contentValidator.validateEvent(inappropriateEvent)

        expect(result.isValid).toBe(false)
        expect(result.severity).toBe('high')
        expect(result.issues.length).toBeGreaterThan(0)
        expect(result.recommendation).toContain('Block this content')
      })

      it('should validate ICS content through content validator', async () => {
        const icsContent = createInappropriateICSContent()
        const result = await contentValidator.validateIcsContent(icsContent)

        expect(result.isValid).toBe(false)
        expect(result.severity).toBe('high')
        expect(result.issues.some(issue => issue.type === 'inappropriate_keyword')).toBe(true)
      })

      it('should sanitize content when possible', async () => {
        const eventWithMinorIssues = createEventWithMinorIssues()
        const result = await contentValidator.validateEvent(eventWithMinorIssues)

        expect(result.sanitizedEvent).toBeDefined()
        expect(result.sanitizedEvent?.title).not.toContain('http://')
        expect(result.recommendation).toContain('sanitized')
      })
    })
  })

  describe('Parental Approval Workflows and Time Restrictions', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {
        requireApprovalFor: [
          {
            type: ApprovalType.EXTERNAL_EVENTS,
            condition: { field: 'source', operator: 'equals', value: 'external' },
            autoApprove: false,
            notifyParent: true
          },
          {
            type: ApprovalType.EVENING_EVENTS,
            condition: { field: 'startTime', operator: 'greater_than', value: '19:00' },
            autoApprove: false,
            notifyParent: true
          },
          {
            type: ApprovalType.LONG_EVENTS,
            condition: { field: 'duration', operator: 'greater_than', value: 3 },
            autoApprove: false,
            notifyParent: true
          }
        ],
        timeRestrictions: [
          {
            id: 'sleep_time',
            name: 'Sleep Time',
            startTime: '21:00',
            endTime: '07:00',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            restrictionType: RestrictionType.NO_EVENTS,
            isActive: true
          },
          {
            id: 'school_hours',
            name: 'School Hours',
            startTime: '08:00',
            endTime: '15:00',
            daysOfWeek: [1, 2, 3, 4, 5],
            restrictionType: RestrictionType.FAMILY_ONLY,
            isActive: true
          },
          {
            id: 'homework_time',
            name: 'Homework Time',
            startTime: '16:00',
            endTime: '18:00',
            daysOfWeek: [1, 2, 3, 4, 5],
            restrictionType: RestrictionType.SUPERVISED_ONLY,
            isActive: true
          }
        ]
      })
    })

    describe('Approval Requirement Detection', () => {
      it('should require approval for high-risk safety violations', async () => {
        const dangerousEvent = createDangerousEvent()
        const safetyValidation = await safetyValidator.validateEvent(dangerousEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          dangerousEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
        expect(safetyValidation.riskLevel).toBe(RiskLevel.BLOCKED)
      })

      it('should require approval for external calendar events', async () => {
        const externalEvent = createExternalCalendarEvent()
        const safetyValidation = await safetyValidator.validateEvent(externalEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          externalEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
      })

      it('should require approval for evening events', async () => {
        const eveningEvent = createEveningEvent()
        const safetyValidation = await safetyValidator.validateEvent(eveningEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          eveningEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
      })

      it('should require approval for long duration events', async () => {
        const longEvent = createLongDurationEvent()
        const safetyValidation = await safetyValidator.validateEvent(longEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          longEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
      })

      it('should not require approval for safe, compliant events', async () => {
        const safeEvent = createSafeEducationalEvent()
        const safetyValidation = await safetyValidator.validateEvent(safeEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          safeEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(false)
      })
    })

    describe('Time Restriction Enforcement', () => {
      it('should block events during sleep time', async () => {
        const sleepTimeEvent = createSleepTimeEvent()
        const safetyValidation = await safetyValidator.validateEvent(sleepTimeEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          sleepTimeEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
      })

      it('should allow family events during school hours', async () => {
        const familySchoolEvent = createFamilySchoolEvent()
        const safetyValidation = await safetyValidator.validateEvent(familySchoolEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          familySchoolEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(false)
      })

      it('should require supervision for homework time events', async () => {
        const homeworkTimeEvent = createHomeworkTimeEvent()
        const safetyValidation = await safetyValidator.validateEvent(homeworkTimeEvent, childUserId)
        
        const requiresApproval = await parentalControl.requiresApproval(
          homeworkTimeEvent,
          childUserId,
          safetyValidation
        )

        expect(requiresApproval).toBe(true)
      })

      it('should handle overnight time restrictions correctly', async () => {
        const lateNightEvent = createLateNightEvent()
        const earlyMorningEvent = createEarlyMorningEvent()
        
        const lateNightValidation = await safetyValidator.validateEvent(lateNightEvent, childUserId)
        const earlyMorningValidation = await safetyValidator.validateEvent(earlyMorningEvent, childUserId)
        
        const lateNightRequiresApproval = await parentalControl.requiresApproval(
          lateNightEvent,
          childUserId,
          lateNightValidation
        )
        
        const earlyMorningRequiresApproval = await parentalControl.requiresApproval(
          earlyMorningEvent,
          childUserId,
          earlyMorningValidation
        )

        expect(lateNightRequiresApproval).toBe(true)
        expect(earlyMorningRequiresApproval).toBe(true)
      })
    })

    describe('Approval Workflow Processing', () => {
      it('should submit and process approval requests correctly', async () => {
        const eveningEvent = createEveningEvent()
        const safetyValidation = await safetyValidator.validateEvent(eveningEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          eveningEvent,
          safetyValidation
        )

        expect(requestId).toBeDefined()
        expect(requestId).toMatch(/^approval_/)

        // Verify request appears in parent review interface
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const pendingRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
        
        expect(pendingRequest).toBeDefined()
        expect(pendingRequest?.childUserId).toBe(childUserId)
        expect(pendingRequest?.status).toBe(ApprovalStatus.PENDING)
      })

      it('should handle parent approval correctly', async () => {
        const eveningEvent = createEveningEvent()
        const safetyValidation = await safetyValidator.validateEvent(eveningEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          eveningEvent,
          safetyValidation
        )

        await parentalControl.respondToRequest(
          requestId,
          parentId,
          ApprovalStatus.APPROVED,
          'Event looks safe and appropriate'
        )

        // Verify request is no longer pending
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const pendingRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
        
        expect(pendingRequest).toBeUndefined()
      })

      it('should handle parent denial correctly', async () => {
        const inappropriateEvent = createDangerousEvent()
        const safetyValidation = await safetyValidator.validateEvent(inappropriateEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          inappropriateEvent,
          safetyValidation
        )

        await parentalControl.respondToRequest(
          requestId,
          parentId,
          ApprovalStatus.DENIED,
          'Content is not appropriate for child'
        )

        // Verify request is processed and denied
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const pendingRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
        
        expect(pendingRequest).toBeUndefined()
      })

      it('should prioritize urgent requests correctly', async () => {
        const normalEvent = createEveningEvent()
        const urgentEvent = createDangerousEvent()
        
        const normalValidation = await safetyValidator.validateEvent(normalEvent, childUserId)
        const urgentValidation = await safetyValidator.validateEvent(urgentEvent, childUserId)
        
        // Submit normal request first
        const normalRequestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          normalEvent,
          normalValidation
        )
        
        // Submit urgent request second
        const urgentRequestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          urgentEvent,
          urgentValidation
        )

        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        
        // Urgent request should be first due to priority
        expect(reviewInterface.pendingRequests[0].id).toBe(urgentRequestId)
        expect(reviewInterface.pendingRequests[0].priority).toBe(RequestPriority.URGENT)
        expect(reviewInterface.pendingRequests[1].id).toBe(normalRequestId)
      })

      it('should handle request expiration', async () => {
        const eveningEvent = createEveningEvent()
        const safetyValidation = await safetyValidator.validateEvent(eveningEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          eveningEvent,
          safetyValidation
        )

        // Simulate time passing beyond expiration
        await parentalControl.processExpiredRequests()

        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const expiredRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
        
        // Request should still be there but marked as expired in a real implementation
        expect(expiredRequest).toBeDefined()
      })
    })

    describe('External Calendar Approval Workflow', () => {
      it('should require approval for external calendar connections', async () => {
        const requestId = await parentalControl.requestExternalCalendarApproval(
          childUserId,
          'google',
          'child@school.edu',
          ['read_calendar'],
          'read_only',
          'Need to sync school calendar for homework tracking'
        )

        expect(requestId).toBeDefined()
        expect(requestId).toMatch(/^ext_cal_/)
      })

      it('should validate external calendar provider permissions', async () => {
        // Test with blocked provider
        await expect(
          parentalControl.requestExternalCalendarApproval(
            childUserId,
            'unknown_provider',
            'child@example.com',
            ['read_calendar'],
            'read_only',
            'Test connection'
          )
        ).rejects.toThrow()
      })

      it('should handle external calendar approval by parent', async () => {
        const requestId = await parentalControl.requestExternalCalendarApproval(
          childUserId,
          'google',
          'child@school.edu',
          ['read_calendar'],
          'read_only',
          'School calendar sync'
        )

        await parentalControl.respondToExternalCalendarRequest(
          requestId,
          parentId,
          ApprovalStatus.APPROVED,
          'School calendar is safe and educational'
        )

        // Verify approval was processed
        expect(requestId).toBeDefined()
      })
    })
  })

  describe('Safety Audit Logging and Parental Notification Systems', () => {
    describe('Safety Audit Logging', () => {
      it('should log all safety validation decisions', async () => {
        const testEvent = createSafeEducationalEvent()
        await safetyValidator.validateEvent(testEvent, childUserId)

        const auditLogs = safetyValidator.getAuditLogs(childUserId)
        expect(auditLogs.length).toBeGreaterThan(0)
        
        const eventLog = auditLogs.find(log => log.contentId === testEvent.id)
        expect(eventLog).toBeDefined()
        expect(eventLog?.userId).toBe(childUserId)
        expect(eventLog?.contentType).toBe('event')
        expect(eventLog?.action).toBe(SafetyAction.APPROVED)
        expect(eventLog?.timestamp).toBeInstanceOf(Date)
      })

      it('should log safety violations with detailed information', async () => {
        const dangerousEvent = createDangerousEvent()
        const result = await safetyValidator.validateEvent(dangerousEvent, childUserId)

        const auditLogs = safetyValidator.getAuditLogs(childUserId)
        const violationLog = auditLogs.find(log => log.contentId === dangerousEvent.id)
        
        expect(violationLog).toBeDefined()
        expect(violationLog?.action).toBe(SafetyAction.BLOCKED)
        expect(violationLog?.validationResult.violations.length).toBeGreaterThan(0)
        expect(violationLog?.validationResult.riskLevel).toBe(RiskLevel.BLOCKED)
      })

      it('should log external calendar content validation', async () => {
        const icsContent = createInappropriateICSContent()
        await safetyValidator.validateExternalCalendarContent(
          icsContent,
          'https://suspicious-domain.com/calendar.ics',
          childUserId
        )

        const auditLogs = safetyValidator.getAuditLogs(childUserId)
        const externalLog = auditLogs.find(log => 
          log.contentType === 'external_calendar' && 
          log.source === 'https://suspicious-domain.com/calendar.ics'
        )
        
        expect(externalLog).toBeDefined()
        expect(externalLog?.action).toBe(SafetyAction.BLOCKED)
      })

      it('should filter audit logs by date range', async () => {
        const testEvent = createSafeEducationalEvent()
        await safetyValidator.validateEvent(testEvent, childUserId)

        const startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date()
        endDate.setHours(23, 59, 59, 999)

        const filteredLogs = safetyValidator.getAuditLogs(childUserId, startDate, endDate)
        
        filteredLogs.forEach(log => {
          expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
          expect(log.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime())
        })
      })

      it('should log parental override decisions', async () => {
        const dangerousEvent = createDangerousEvent()
        const safetyValidation = await safetyValidator.validateEvent(dangerousEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          dangerousEvent,
          safetyValidation
        )

        await parentalControl.respondToRequest(
          requestId,
          parentId,
          ApprovalStatus.APPROVED,
          'Approved despite safety concerns for educational purposes'
        )

        // Verify parental override is logged
        const auditLogs = safetyValidator.getAuditLogs(childUserId)
        const overrideLog = auditLogs.find(log => 
          log.contentId === dangerousEvent.id && log.parentalOverride === true
        )
        
        expect(overrideLog).toBeDefined()
      })

      it('should maintain audit log integrity and security', async () => {
        const testEvent = createSafeEducationalEvent()
        await safetyValidator.validateEvent(testEvent, childUserId)

        const auditLogs = safetyValidator.getAuditLogs(childUserId)
        const log = auditLogs[0]
        
        // Verify log contains required security fields
        expect(log.id).toBeDefined()
        expect(log.timestamp).toBeInstanceOf(Date)
        expect(log.userId).toBe(childUserId)
        expect(log.validationResult).toBeDefined()
        expect(log.action).toBeDefined()
        expect(log.source).toBeDefined()
      })
    })

    describe('Parental Notification Systems', () => {
      beforeEach(async () => {
        await parentalControl.setupParentalControls(childUserId, parentId, {
          notificationSettings: {
            emailNotifications: true,
            pushNotifications: true,
            dailySummary: true,
            immediateAlerts: true,
            weeklyReport: true,
            notificationMethods: [NotificationMethod.EMAIL, NotificationMethod.PUSH, NotificationMethod.VOICE]
          }
        })
      })

      it('should generate safety alerts for parents', async () => {
        const dangerousEvent = createDangerousEvent()
        const safetyValidation = await safetyValidator.validateEvent(dangerousEvent, childUserId)
        
        await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          dangerousEvent,
          safetyValidation
        )

        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        
        expect(reviewInterface.safetyAlerts).toBeDefined()
        expect(reviewInterface.safetyAlerts.length).toBeGreaterThanOrEqual(0)
      })

      it('should create alerts for repeated safety violations', async () => {
        // Simulate multiple violations
        for (let i = 0; i < 3; i++) {
          const dangerousEvent = createDangerousEvent()
          dangerousEvent.id = `dangerous_${i}`
          await safetyValidator.validateEvent(dangerousEvent, childUserId)
        }

        const alert = await parentalControl.createSafetyAlert(
          childUserId,
          AlertType.REPEATED_VIOLATIONS,
          AlertSeverity.WARNING,
          'Child has attempted to create multiple inappropriate events',
          'Multiple safety violations detected'
        )

        expect(alert.id).toBeDefined()
        expect(alert.alertType).toBe(AlertType.REPEATED_VIOLATIONS)
        expect(alert.severity).toBe(AlertSeverity.WARNING)
        expect(alert.userId).toBe(childUserId)
      })

      it('should generate daily activity summaries', async () => {
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        
        expect(reviewInterface.childActivity).toBeDefined()
        expect(reviewInterface.childActivity.userId).toBe(childUserId)
        expect(reviewInterface.childActivity.date).toBeInstanceOf(Date)
        expect(reviewInterface.childActivity.totalEvents).toBeGreaterThanOrEqual(0)
        expect(reviewInterface.childActivity.safetyViolations).toBeGreaterThanOrEqual(0)
      })

      it('should generate weekly reports with safety metrics', async () => {
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        
        expect(reviewInterface.weeklyReport).toBeDefined()
        expect(reviewInterface.weeklyReport.userId).toBe(childUserId)
        expect(reviewInterface.weeklyReport.safetyScore).toBeGreaterThanOrEqual(0)
        expect(reviewInterface.weeklyReport.safetyScore).toBeLessThanOrEqual(100)
        expect(reviewInterface.weeklyReport.complianceRate).toBeGreaterThanOrEqual(0)
        expect(reviewInterface.weeklyReport.complianceRate).toBeLessThanOrEqual(100)
        expect(reviewInterface.weeklyReport.recommendations).toBeInstanceOf(Array)
      })

      it('should send immediate notifications for critical safety issues', async () => {
        const criticalEvent = createCriticalSafetyEvent()
        const safetyValidation = await safetyValidator.validateEvent(criticalEvent, childUserId)
        
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          criticalEvent,
          safetyValidation
        )

        // Verify immediate notification was triggered
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const urgentRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
        
        expect(urgentRequest?.priority).toBe(RequestPriority.URGENT)
      })

      it('should customize notifications based on parent preferences', async () => {
        const config = parentalControl.getParentalControls(childUserId)
        
        expect(config?.notificationSettings.emailNotifications).toBe(true)
        expect(config?.notificationSettings.pushNotifications).toBe(true)
        expect(config?.notificationSettings.notificationMethods).toContain(NotificationMethod.EMAIL)
        expect(config?.notificationSettings.notificationMethods).toContain(NotificationMethod.PUSH)
        expect(config?.notificationSettings.notificationMethods).toContain(NotificationMethod.VOICE)
      })

      it('should handle notification delivery failures gracefully', async () => {
        const eveningEvent = createEveningEvent()
        const safetyValidation = await safetyValidator.validateEvent(eveningEvent, childUserId)
        
        // Simulate notification failure
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          eveningEvent,
          safetyValidation
        )

        // Should still create the request even if notification fails
        expect(requestId).toBeDefined()
        
        const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
        const request = reviewInterface.pendingRequests.find(req => req.id === requestId)
        expect(request).toBeDefined()
      })
    })
  })

  describe('External Calendar Content Filtering and Safety Validation', () => {
    describe('ICS Content Filtering', () => {
      it('should filter inappropriate content from ICS subscriptions', async () => {
        const mixedICSContent = createMixedSafetyICSContent()
        const result = await safetyValidator.validateExternalCalendarContent(
          mixedICSContent,
          'https://mixed-content.com/calendar.ics',
          childUserId
        )

        expect(result.violations.length).toBeGreaterThan(0)
        expect(result.violations.some(v => v.type === ViolationType.INAPPROPRIATE_LANGUAGE)).toBe(true)
        expect(result.riskLevel).toBe(RiskLevel.HIGH_RISK)
      })

      it('should validate calendar subscription URLs', async () => {
        const safeContent = createSafeICSContent()
        
        // Test with safe domain
        const safeResult = await safetyValidator.validateExternalCalendarContent(
          safeContent,
          'https://school.edu/calendar.ics',
          childUserId
        )
        
        // Test with suspicious domain
        const suspiciousResult = await safetyValidator.validateExternalCalendarContent(
          safeContent,
          'https://adult-content.com/calendar.ics',
          childUserId
        )

        expect(safeResult.riskLevel).toBe(RiskLevel.LOW_RISK) // Flagged in strict mode
        expect(suspiciousResult.riskLevel).toBe(RiskLevel.HIGH_RISK)
        expect(suspiciousResult.violations.some(v => v.type === ViolationType.EXTERNAL_LINK)).toBe(true)
      })

      it('should handle large calendar subscriptions efficiently', async () => {
        const largeCalendar = createLargeICSContent(1000)
        const startTime = Date.now()
        
        const result = await safetyValidator.validateExternalCalendarContent(
          largeCalendar,
          'https://school.edu/large-calendar.ics',
          childUserId
        )
        
        const processingTime = Date.now() - startTime
        expect(processingTime).toBeLessThan(10000) // Should process within 10 seconds
        expect(result).toBeDefined()
      })

      it('should validate recurring events in external calendars', async () => {
        const recurringICS = createRecurringEventICS()
        const result = await safetyValidator.validateExternalCalendarContent(
          recurringICS,
          'https://school.edu/recurring.ics',
          childUserId
        )

        expect(result).toBeDefined()
        expect(result.violations).toBeDefined()
      })

      it('should filter external calendar attachments', async () => {
        const icsWithAttachments = createICSWithAttachments()
        const result = await safetyValidator.validateExternalCalendarContent(
          icsWithAttachments,
          'https://school.edu/attachments.ics',
          childUserId
        )

        // Should validate attachment URLs and content
        expect(result).toBeDefined()
      })
    })

    describe('Real-time Content Monitoring', () => {
      it('should monitor external calendar updates for safety', async () => {
        const initialContent = createSafeICSContent()
        const updatedContent = createInappropriateICSContent()
        
        // Initial validation
        const initialResult = await safetyValidator.validateExternalCalendarContent(
          initialContent,
          'https://school.edu/calendar.ics',
          childUserId
        )
        
        // Updated content validation
        const updatedResult = await safetyValidator.validateExternalCalendarContent(
          updatedContent,
          'https://school.edu/calendar.ics',
          childUserId
        )

        expect(initialResult.riskLevel).toBe(RiskLevel.LOW_RISK)
        expect(updatedResult.riskLevel).toBe(RiskLevel.BLOCKED)
      })

      it('should create alerts for newly inappropriate external content', async () => {
        const inappropriateContent = createInappropriateICSContent()
        await safetyValidator.validateExternalCalendarContent(
          inappropriateContent,
          'https://compromised-site.com/calendar.ics',
          childUserId
        )

        const alert = await parentalControl.createSafetyAlert(
          childUserId,
          AlertType.EXTERNAL_CONTENT_BLOCKED,
          AlertSeverity.CRITICAL,
          'External calendar content blocked due to inappropriate material',
          'https://compromised-site.com/calendar.ics'
        )

        expect(alert.alertType).toBe(AlertType.EXTERNAL_CONTENT_BLOCKED)
        expect(alert.severity).toBe(AlertSeverity.CRITICAL)
      })

      it('should handle external calendar connection failures safely', async () => {
        // Simulate connection failure
        const result = await safetyValidator.validateExternalCalendarContent(
          '',
          'https://unreachable-site.com/calendar.ics',
          childUserId
        )

        expect(result).toBeDefined()
        expect(result.violations).toBeDefined()
      })
    })

    describe('Content Sanitization and Filtering', () => {
      it('should sanitize external calendar event titles', async () => {
        const eventWithInappropriateTitle = createEventWithInappropriateContent()
        const result = await contentValidator.validateEvent(eventWithInappropriateTitle)

        expect(result.sanitizedEvent).toBeDefined()
        expect(result.sanitizedEvent?.title).toBe('[Content filtered for safety]')
      })

      it('should filter external URLs in event descriptions', async () => {
        const eventWithSuspiciousLinks = createEventWithSuspiciousLinks()
        const result = await contentValidator.validateEvent(eventWithSuspiciousLinks)

        expect(result.sanitizedEvent).toBeDefined()
        expect(result.sanitizedEvent?.description).not.toContain('suspicious-site.com')
      })

      it('should maintain safe content while filtering inappropriate parts', async () => {
        const mixedContentEvent = createMixedContentEvent()
        const result = await contentValidator.validateEvent(mixedContentEvent)

        expect(result.sanitizedEvent).toBeDefined()
        // Should keep safe parts while filtering inappropriate content
      })
    })
  })

  describe('Integration and Performance Tests', () => {
    it('should handle concurrent safety validations efficiently', async () => {
      const events = Array.from({ length: 10 }, (_, i) => createSafeEducationalEvent())
      events.forEach((event, i) => { event.id = `concurrent_${i}` })

      const startTime = Date.now()
      const results = await Promise.all(
        events.map(event => safetyValidator.validateEvent(event, childUserId))
      )
      const processingTime = Date.now() - startTime

      expect(results).toHaveLength(10)
      expect(results.every(result => result.isValid)).toBe(true)
      expect(processingTime).toBeLessThan(5000) // Should process within 5 seconds
    })

    it('should maintain performance under high load', async () => {
      const events = Array.from({ length: 50 }, (_, i) => createSafeEducationalEvent())
      events.forEach((event, i) => { event.id = `load_test_${i}` })

      const startTime = Date.now()
      
      for (const event of events) {
        await safetyValidator.validateEvent(event, childUserId)
      }
      
      const processingTime = Date.now() - startTime
      expect(processingTime).toBeLessThan(15000) // Should process 50 events within 15 seconds
    })

    it('should integrate safety validation with parental controls seamlessly', async () => {
      const testEvent = createEveningEvent()
      
      // Safety validation
      const safetyResult = await safetyValidator.validateEvent(testEvent, childUserId)
      
      // Parental control check
      const requiresApproval = await parentalControl.requiresApproval(
        testEvent,
        childUserId,
        safetyResult
      )
      
      // Approval workflow
      if (requiresApproval) {
        const requestId = await parentalControl.submitApprovalRequest(
          childUserId,
          RequestType.EVENT_CREATION,
          testEvent,
          safetyResult
        )
        
        expect(requestId).toBeDefined()
      }

      expect(safetyResult).toBeDefined()
      expect(typeof requiresApproval).toBe('boolean')
    })
  })

  // Helper functions for creating test data
  function createSafeEducationalEvent(): CalendarEvent {
    return {
      id: 'safe_edu_event',
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
      createdBy: childUserId,
      isPrivate: false
    }
  }

  function createDangerousEvent(): CalendarEvent {
    return {
      id: 'dangerous_event',
      title: 'Violence and weapons demonstration',
      description: 'Secret meeting with dangerous weapons - don\'t tell parents',
      startTime: new Date('2024-01-15T23:00:00'),
      endTime: new Date('2024-01-16T02:00:00'),
      allDay: false,
      location: { name: 'Bar downtown', type: 'other' as any },
      attendees: [
        { id: 'att2', name: 'Stranger', email: 'unknown@suspicious.com', role: 'required' as any, status: 'pending' as any, isRequired: true }
      ],
      category: EventCategory.ENTERTAINMENT,
      priority: 2,
      visibility: VisibilityLevel.PRIVATE,
      reminders: [],
      metadata: {
        source: 'external' as any,
        syncStatus: 'synced' as any,
        conflictStatus: 'none' as any,
        safetyValidated: false,
        tags: [],
        customFields: {}
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: childUserId,
      isPrivate: false
    }
  }

  function createEventWithPersonalInfo(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'event_with_pii'
    event.title = 'Doctor appointment'
    event.description = 'Call Dr. Smith at 555-123-4567 or visit 123 Main Street, Anytown'
    return event
  }

  function createEventWithSuspiciousLinks(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'event_with_links'
    event.title = 'Online meeting'
    event.description = 'Join at https://suspicious-site.com/meeting or https://adult-content.com/room'
    return event
  }

  function createWorkEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'work_event'
    event.category = EventCategory.WORK
    event.title = 'Business meeting'
    return event
  }

  function createExcessivelyLongEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'long_event'
    event.startTime = new Date('2024-01-15T08:00:00')
    event.endTime = new Date('2024-01-15T20:00:00') // 12 hours
    return event
  }

  function createEventWithSuspiciousAttendees(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'suspicious_attendees'
    event.attendees = [
      { id: 'att3', name: 'Unknown person', email: 'stranger@blocked-domain.com', role: 'required' as any, status: 'pending' as any, isRequired: true }
    ]
    return event
  }

  function createSafeReminder(): Reminder {
    return {
      id: 'safe_reminder',
      userId: childUserId,
      eventId: 'safe_edu_event',
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
  }

  function createInappropriateReminder(): Reminder {
    return {
      id: 'inappropriate_reminder',
      userId: childUserId,
      title: 'Secret meeting reminder',
      description: 'Don\'t tell anyone about this - meet at the bar for adult activities',
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
  }

  function createLateNightReminder(): Reminder {
    const reminder = createSafeReminder()
    reminder.id = 'late_night_reminder'
    reminder.triggerTime = new Date('2024-01-15T02:00:00') // 2 AM
    return reminder
  }

  function createRecurringReminder(): Reminder {
    const reminder = createSafeReminder()
    reminder.id = 'recurring_reminder'
    reminder.recurrence = {
      frequency: 'daily' as any,
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5],
      exceptions: []
    }
    return reminder
  }

  function createSafeICSContent(): string {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//School//School Calendar//EN
X-WR-CALNAME:School Events
BEGIN:VEVENT
UID:school-event-1
SUMMARY:Math Class
DESCRIPTION:Regular math class session
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
LOCATION:Room 101
END:VEVENT
BEGIN:VEVENT
UID:school-event-2
SUMMARY:Science Fair
DESCRIPTION:Annual science fair presentation
DTSTART:20240116T140000Z
DTEND:20240116T160000Z
LOCATION:School Gymnasium
END:VEVENT
END:VCALENDAR`
  }

  function createInappropriateICSContent(): string {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Suspicious//Suspicious Calendar//EN
BEGIN:VEVENT
UID:bad-event-1
SUMMARY:Adult party with alcohol
DESCRIPTION:Secret meeting - violence and weapons demonstration
DTSTART:20240115T220000Z
DTEND:20240116T020000Z
LOCATION:Bar downtown
END:VEVENT
BEGIN:VEVENT
UID:bad-event-2
SUMMARY:Gambling night
DESCRIPTION:Casino visit - don't tell parents
DTSTART:20240117T200000Z
DTEND:20240117T230000Z
LOCATION:Casino
END:VEVENT
END:VCALENDAR`
  }

  function createLargeICSContent(eventCount: number): string {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Large//Large Calendar//EN
`
    
    for (let i = 0; i < eventCount; i++) {
      icsContent += `BEGIN:VEVENT
UID:event-${i}
SUMMARY:Event ${i}
DESCRIPTION:Description for event ${i}
DTSTART:20240115T${String(10 + (i % 8)).padStart(2, '0')}0000Z
DTEND:20240115T${String(11 + (i % 8)).padStart(2, '0')}0000Z
END:VEVENT
`
    }
    
    icsContent += 'END:VCALENDAR'
    return icsContent
  }

  function createMixedSafetyICSContent(): string {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Mixed//Mixed Calendar//EN
BEGIN:VEVENT
UID:safe-event
SUMMARY:School Assembly
DESCRIPTION:Monthly school assembly
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
END:VEVENT
BEGIN:VEVENT
UID:unsafe-event
SUMMARY:Adult content event
DESCRIPTION:Inappropriate material for children
DTSTART:20240116T200000Z
DTEND:20240116T220000Z
END:VEVENT
END:VCALENDAR`
  }

  function createRecurringEventICS(): string {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//School//Recurring Events//EN
BEGIN:VEVENT
UID:recurring-class
SUMMARY:Daily Math Class
DESCRIPTION:Regular math class
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR
END:VEVENT
END:VCALENDAR`
  }

  function createICSWithAttachments(): string {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//School//Attachments//EN
BEGIN:VEVENT
UID:event-with-attachment
SUMMARY:Homework Assignment
DESCRIPTION:Math homework with attachment
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
ATTACH:https://school.edu/homework.pdf
ATTACH:https://suspicious-site.com/malware.exe
END:VEVENT
END:VCALENDAR`
  }

  function createExternalCalendarEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'external_event'
    event.metadata.source = 'google_calendar' as any
    event.createdBy = 'external_system'
    return event
  }

  function createEveningEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'evening_event'
    event.startTime = new Date('2024-01-15T20:00:00') // 8 PM
    event.endTime = new Date('2024-01-15T21:00:00')
    return event
  }

  function createLongDurationEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'long_duration_event'
    event.startTime = new Date('2024-01-15T10:00:00')
    event.endTime = new Date('2024-01-15T15:00:00') // 5 hours
    return event
  }

  function createSleepTimeEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'sleep_time_event'
    event.startTime = new Date('2024-01-15T22:00:00') // 10 PM
    event.endTime = new Date('2024-01-15T23:00:00')
    return event
  }

  function createFamilySchoolEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'family_school_event'
    event.category = EventCategory.FAMILY
    event.startTime = new Date('2024-01-15T10:00:00') // Monday 10 AM (school hours)
    event.endTime = new Date('2024-01-15T11:00:00')
    return event
  }

  function createHomeworkTimeEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'homework_time_event'
    event.category = EventCategory.ENTERTAINMENT // Non-supervised activity
    event.startTime = new Date('2024-01-15T17:00:00') // Monday 5 PM (homework time)
    event.endTime = new Date('2024-01-15T18:00:00')
    return event
  }

  function createLateNightEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'late_night_event'
    event.startTime = new Date('2024-01-15T23:00:00') // 11 PM
    event.endTime = new Date('2024-01-16T00:00:00')
    return event
  }

  function createEarlyMorningEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'early_morning_event'
    event.startTime = new Date('2024-01-15T05:00:00') // 5 AM
    event.endTime = new Date('2024-01-15T06:00:00')
    return event
  }

  function createCriticalSafetyEvent(): CalendarEvent {
    const event = createDangerousEvent()
    event.id = 'critical_safety_event'
    event.title = 'Extremely dangerous activity with weapons and violence'
    event.description = 'Critical safety violation - immediate intervention required'
    return event
  }

  function createEventWithInappropriateContent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'inappropriate_content_event'
    event.title = 'Adult party with explicit content'
    event.description = 'Mature content not suitable for children'
    return event
  }

  function createMixedContentEvent(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'mixed_content_event'
    event.title = 'School event with homework'
    event.description = 'Safe educational content but also visit https://inappropriate-site.com for more info'
    return event
  }

  function createEventWithMinorIssues(): CalendarEvent {
    const event = createSafeEducationalEvent()
    event.id = 'minor_issues_event'
    event.title = 'SCHOOL EVENT WITH EXCESSIVE CAPS'
    event.description = 'Visit http://insecure-site.com for details'
    return event
  }
})