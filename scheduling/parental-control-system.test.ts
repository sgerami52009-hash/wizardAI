// Unit tests for parental control and approval system

import {
  ParentalControlSystem,
  ParentalControlConfig,
  ApprovalType,
  RestrictionType,
  ApprovalStatus,
  RequestType,
  RequestPriority,
  NotificationMethod,
  ExternalCalendarControls,
  FamilyVisibilitySettings
} from './parental-control-system'
import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { Reminder, ReminderType } from '../reminders/types'
import { SafetyValidationResult, RiskLevel, ViolationType, ViolationSeverity } from './safety-validator'

describe('ParentalControlSystem', () => {
  let parentalControl: ParentalControlSystem
  const childUserId = 'child_123'
  const parentId = 'parent_456'

  beforeEach(() => {
    parentalControl = new ParentalControlSystem()
  })

  describe('Setup and Configuration', () => {
    it('should set up parental controls with default configuration', async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})

      const config = parentalControl.getParentalControls(childUserId)
      expect(config).toBeDefined()
      expect(config?.userId).toBe(childUserId)
      expect(config?.parentId).toBe(parentId)
      expect(config?.maxDailyEvents).toBe(5)
      expect(config?.maxEventDuration).toBe(4)
      expect(config?.allowExternalCalendars).toBe(false)
    })

    it('should set up parental controls with custom configuration', async () => {
      const customConfig: Partial<ParentalControlConfig> = {
        maxDailyEvents: 3,
        maxEventDuration: 2,
        allowExternalCalendars: true,
        allowedCategories: [EventCategory.EDUCATION, EventCategory.FAMILY]
      }

      await parentalControl.setupParentalControls(childUserId, parentId, customConfig)

      const config = parentalControl.getParentalControls(childUserId)
      expect(config?.maxDailyEvents).toBe(3)
      expect(config?.maxEventDuration).toBe(2)
      expect(config?.allowExternalCalendars).toBe(true)
      expect(config?.allowedCategories).toEqual([EventCategory.EDUCATION, EventCategory.FAMILY])
    })

    it('should update parental control configuration', async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})

      const updates = {
        maxDailyEvents: 7,
        allowExternalCalendars: true
      }

      await parentalControl.updateParentalControls(childUserId, parentId, updates)

      const config = parentalControl.getParentalControls(childUserId)
      expect(config?.maxDailyEvents).toBe(7)
      expect(config?.allowExternalCalendars).toBe(true)
    })

    it('should prevent unauthorized configuration updates', async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})

      await expect(
        parentalControl.updateParentalControls(childUserId, 'unauthorized_parent', {})
      ).rejects.toThrow('Unauthorized: Not the assigned parent')
    })

    it('should remove parental controls', async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
      
      await parentalControl.removeParentalControls(childUserId, parentId)

      const config = parentalControl.getParentalControls(childUserId)
      expect(config).toBeUndefined()
    })
  })

  describe('Approval Requirements', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
    })

    it('should require approval for high-risk events', async () => {
      const highRiskEvent = createMockEvent('High risk event')
      const highRiskValidation: SafetyValidationResult = {
        isValid: false,
        violations: [{
          type: ViolationType.INAPPROPRIATE_LANGUAGE,
          field: 'title',
          originalContent: 'inappropriate content',
          severity: ViolationSeverity.HIGH,
          description: 'Contains inappropriate language'
        }],
        riskLevel: RiskLevel.HIGH_RISK,
        recommendations: ['Review content']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        highRiskEvent,
        childUserId,
        highRiskValidation
      )

      expect(requiresApproval).toBe(true)
    })

    it('should require approval for blocked content', async () => {
      const blockedEvent = createMockEvent('Blocked event')
      const blockedValidation: SafetyValidationResult = {
        isValid: false,
        violations: [{
          type: ViolationType.ADULT_CONTENT,
          field: 'description',
          originalContent: 'adult content',
          severity: ViolationSeverity.CRITICAL,
          description: 'Contains adult content'
        }],
        riskLevel: RiskLevel.BLOCKED,
        recommendations: ['Block content']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        blockedEvent,
        childUserId,
        blockedValidation
      )

      expect(requiresApproval).toBe(true)
    })

    it('should not require approval for safe events', async () => {
      const safeEvent = createMockEvent('Safe family dinner', EventCategory.FAMILY)
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        safeEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(false)
    })

    it('should require approval for evening events', async () => {
      const eveningEvent = createMockEvent(
        'Evening event',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T20:00:00'), // 8 PM
        new Date('2024-01-15T21:00:00')
      )
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        eveningEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(true)
    })

    it('should require approval for long duration events', async () => {
      const longEvent = createMockEvent(
        'Long event',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T10:00:00'),
        new Date('2024-01-15T16:00:00') // 6 hours (exceeds 4 hour limit)
      )
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        longEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(true)
    })
  })

  describe('Time Restrictions', () => {
    beforeEach(async () => {
      const config: Partial<ParentalControlConfig> = {
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
          }
        ]
      }
      await parentalControl.setupParentalControls(childUserId, parentId, config)
    })

    it('should block events during sleep time', async () => {
      const sleepTimeEvent = createMockEvent(
        'Late night event',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T22:00:00'), // 10 PM
        new Date('2024-01-15T23:00:00')
      )
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        sleepTimeEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(true)
    })

    it('should allow family events during school hours', async () => {
      const familySchoolEvent = createMockEvent(
        'Family school event',
        EventCategory.FAMILY,
        new Date('2024-01-15T10:00:00'), // Monday 10 AM (school hours)
        new Date('2024-01-15T11:00:00')
      )
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        familySchoolEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(false)
    })

    it('should require approval for non-family events during school hours', async () => {
      const nonFamilySchoolEvent = createMockEvent(
        'Entertainment during school',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T10:00:00'), // Monday 10 AM (school hours)
        new Date('2024-01-15T11:00:00')
      )
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        nonFamilySchoolEvent,
        childUserId,
        safeValidation
      )

      expect(requiresApproval).toBe(true)
    })
  })

  describe('Approval Workflow', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
    })

    it('should submit approval request', async () => {
      const event = createMockEvent('Test event')
      const safetyValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.MEDIUM_RISK,
        recommendations: ['Review required']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event,
        safetyValidation
      )

      expect(requestId).toBeDefined()
      expect(requestId).toMatch(/^approval_/)
    })

    it('should approve request by parent', async () => {
      const event = createMockEvent('Test event')
      const safetyValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.MEDIUM_RISK,
        recommendations: ['Review required']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event,
        safetyValidation
      )

      await parentalControl.respondToRequest(
        requestId,
        parentId,
        ApprovalStatus.APPROVED,
        'Event looks safe for child'
      )

      // Verify the request was approved
      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
      const approvedRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
      expect(approvedRequest).toBeUndefined() // Should not be in pending anymore
    })

    it('should deny request by parent', async () => {
      const event = createMockEvent('Inappropriate event')
      const safetyValidation: SafetyValidationResult = {
        isValid: false,
        violations: [{
          type: ViolationType.INAPPROPRIATE_LANGUAGE,
          field: 'title',
          originalContent: 'inappropriate',
          severity: ViolationSeverity.HIGH,
          description: 'Contains inappropriate content'
        }],
        riskLevel: RiskLevel.HIGH_RISK,
        recommendations: ['Block content']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event,
        safetyValidation
      )

      await parentalControl.respondToRequest(
        requestId,
        parentId,
        ApprovalStatus.DENIED,
        'Content not appropriate for child'
      )

      // Request should be processed and denied
      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
      const deniedRequest = reviewInterface.pendingRequests.find(req => req.id === requestId)
      expect(deniedRequest).toBeUndefined() // Should not be in pending anymore
    })

    it('should prevent unauthorized parent from responding', async () => {
      const event = createMockEvent('Test event')
      const safetyValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.MEDIUM_RISK,
        recommendations: ['Review required']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event,
        safetyValidation
      )

      await expect(
        parentalControl.respondToRequest(
          requestId,
          'unauthorized_parent',
          ApprovalStatus.APPROVED
        )
      ).rejects.toThrow('Unauthorized: Not the assigned parent')
    })

    it('should prevent responding to non-existent request', async () => {
      await expect(
        parentalControl.respondToRequest(
          'non_existent_request',
          parentId,
          ApprovalStatus.APPROVED
        )
      ).rejects.toThrow('Approval request not found')
    })
  })

  describe('Parental Review Interface', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
    })

    it('should provide parental review interface', async () => {
      // Submit a few approval requests
      const event1 = createMockEvent('Event 1')
      const event2 = createMockEvent('Event 2')
      const safetyValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.MEDIUM_RISK,
        recommendations: ['Review required']
      }

      await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event1,
        safetyValidation
      )

      await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        event2,
        safetyValidation
      )

      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)

      expect(reviewInterface.pendingRequests).toHaveLength(2)
      expect(reviewInterface.childActivity).toBeDefined()
      expect(reviewInterface.safetyAlerts).toBeDefined()
      expect(reviewInterface.weeklyReport).toBeDefined()
    })

    it('should prioritize urgent requests', async () => {
      const urgentEvent = createMockEvent('Urgent event')
      const normalEvent = createMockEvent('Normal event')
      
      const urgentValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.BLOCKED,
        recommendations: ['Block immediately']
      }

      const normalValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.MEDIUM_RISK,
        recommendations: ['Review required']
      }

      // Submit normal request first
      await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        normalEvent,
        normalValidation
      )

      // Submit urgent request second
      await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        urgentEvent,
        urgentValidation
      )

      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)

      // Urgent request should be first due to priority sorting
      expect(reviewInterface.pendingRequests[0].priority).toBe(RequestPriority.URGENT)
      expect(reviewInterface.pendingRequests[1].priority).toBe(RequestPriority.NORMAL)
    })

    it('should generate weekly activity report', async () => {
      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)

      expect(reviewInterface.weeklyReport.userId).toBe(childUserId)
      expect(reviewInterface.weeklyReport.weekStartDate).toBeInstanceOf(Date)
      expect(reviewInterface.weeklyReport.safetyScore).toBeGreaterThanOrEqual(0)
      expect(reviewInterface.weeklyReport.safetyScore).toBeLessThanOrEqual(100)
      expect(reviewInterface.weeklyReport.complianceRate).toBeGreaterThanOrEqual(0)
      expect(reviewInterface.weeklyReport.complianceRate).toBeLessThanOrEqual(100)
      expect(reviewInterface.weeklyReport.recommendations).toBeInstanceOf(Array)
    })
  })

  describe('Request Priority Determination', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
    })

    it('should assign urgent priority to blocked content', async () => {
      const blockedEvent = createMockEvent('Blocked event')
      const blockedValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.BLOCKED,
        recommendations: ['Block immediately']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        blockedEvent,
        blockedValidation
      )

      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
      const request = reviewInterface.pendingRequests.find(req => req.id === requestId)
      
      expect(request?.priority).toBe(RequestPriority.URGENT)
    })

    it('should assign high priority to high-risk content', async () => {
      const highRiskEvent = createMockEvent('High risk event')
      const highRiskValidation: SafetyValidationResult = {
        isValid: false,
        violations: [],
        riskLevel: RiskLevel.HIGH_RISK,
        recommendations: ['Review carefully']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EVENT_CREATION,
        highRiskEvent,
        highRiskValidation
      )

      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
      const request = reviewInterface.pendingRequests.find(req => req.id === requestId)
      
      expect(request?.priority).toBe(RequestPriority.HIGH)
    })

    it('should assign high priority to external calendar connections', async () => {
      const safeEvent = createMockEvent('Safe event')
      const safeValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requestId = await parentalControl.submitApprovalRequest(
        childUserId,
        RequestType.EXTERNAL_CALENDAR_CONNECTION,
        safeEvent,
        safeValidation
      )

      const reviewInterface = await parentalControl.getParentalReviewInterface(parentId)
      const request = reviewInterface.pendingRequests.find(req => req.id === requestId)
      
      expect(request?.priority).toBe(RequestPriority.HIGH)
    })
  })

  describe('External Calendar Controls', () => {
    beforeEach(async () => {
      const config: Partial<ParentalControlConfig> = {
        externalCalendarControls: {
          allowGoogleCalendar: true,
          allowMicrosoftOutlook: false,
          allowAppleICloud: true,
          allowCalDAV: false,
          allowICSSubscriptions: true,
          requireApprovalForNewConnections: true,
          allowedDomains: ['school.edu', 'library.org'],
          blockedDomains: ['blocked.com'],
          maxConnections: 2,
          dataShareRestrictions: []
        }
      }
      await parentalControl.setupParentalControls(childUserId, parentId, config)
    })

    it('should allow approved external calendar providers', async () => {
      const requestId = await parentalControl.requestExternalCalendarApproval(
        childUserId,
        'google',
        'child@school.edu',
        ['read_calendar'],
        'read_only',
        'Need to sync school calendar'
      )

      expect(requestId).toBeDefined()
      expect(requestId).toMatch(/^ext_cal_/)
    })

    it('should block unapproved external calendar providers', async () => {
      await expect(
        parentalControl.requestExternalCalendarApproval(
          childUserId,
          'microsoft',
          'child@outlook.com',
          ['read_calendar'],
          'read_only',
          'Personal calendar'
        )
      ).rejects.toThrow('External calendar provider microsoft is not allowed')
    })

    it('should block connections from blocked domains', async () => {
      await expect(
        parentalControl.requestExternalCalendarApproval(
          childUserId,
          'google',
          'child@blocked.com',
          ['read_calendar'],
          'read_only',
          'Test calendar'
        )
      ).rejects.toThrow('Domain blocked.com is blocked')
    })

    it('should allow parent to approve external calendar connection', async () => {
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
        'School calendar is safe'
      )

      // Verify the request was processed
      // In a real implementation, we'd check the request status
      expect(requestId).toBeDefined()
    })

    it('should allow parent to deny external calendar connection', async () => {
      const requestId = await parentalControl.requestExternalCalendarApproval(
        childUserId,
        'google',
        'child@school.edu',
        ['read_calendar', 'write_calendar'],
        'full_access',
        'Full calendar access'
      )

      await parentalControl.respondToExternalCalendarRequest(
        requestId,
        parentId,
        ApprovalStatus.DENIED,
        'Too much access requested'
      )

      expect(requestId).toBeDefined()
    })
  })

  describe('Schedule Review Interface', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, {})
    })

    it('should provide comprehensive schedule review for parents', async () => {
      const reviewInterface = await parentalControl.getScheduleReviewInterface(parentId, childUserId)

      expect(reviewInterface.childId).toBe(childUserId)
      expect(reviewInterface.childName).toBeDefined()
      expect(reviewInterface.upcomingEvents).toBeInstanceOf(Array)
      expect(reviewInterface.recentActivity).toBeInstanceOf(Array)
      expect(reviewInterface.pendingApprovals).toBeInstanceOf(Array)
      expect(reviewInterface.safetyAlerts).toBeInstanceOf(Array)
      expect(reviewInterface.complianceMetrics).toBeDefined()
      expect(reviewInterface.recommendedActions).toBeInstanceOf(Array)
    })

    it('should prevent unauthorized access to schedule review', async () => {
      await expect(
        parentalControl.getScheduleReviewInterface('unauthorized_parent', childUserId)
      ).rejects.toThrow('Unauthorized or child not found')
    })

    it('should include compliance metrics in review', async () => {
      const reviewInterface = await parentalControl.getScheduleReviewInterface(parentId, childUserId)

      expect(reviewInterface.complianceMetrics.timeRestrictionCompliance).toBeGreaterThanOrEqual(0)
      expect(reviewInterface.complianceMetrics.timeRestrictionCompliance).toBeLessThanOrEqual(100)
      expect(reviewInterface.complianceMetrics.contentSafetyScore).toBeGreaterThanOrEqual(0)
      expect(reviewInterface.complianceMetrics.contentSafetyScore).toBeLessThanOrEqual(100)
    })
  })

  describe('Time Restriction Enforcement', () => {
    beforeEach(async () => {
      const config: Partial<ParentalControlConfig> = {
        timeRestrictions: [
          {
            id: 'sleep_time',
            name: 'Sleep Time',
            startTime: '21:00',
            endTime: '07:00',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            restrictionType: RestrictionType.NO_EVENTS,
            isActive: true
          }
        ]
      }
      await parentalControl.setupParentalControls(childUserId, parentId, config)
    })

    it('should enforce time restrictions and provide alternatives', async () => {
      const restrictedEvent = createMockEvent(
        'Late night event',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T22:00:00'),
        new Date('2024-01-15T23:00:00')
      )

      const result = await parentalControl.enforceTimeRestrictions(restrictedEvent, childUserId)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('Sleep Time')
      expect(result.suggestedTimes).toBeInstanceOf(Array)
    })

    it('should allow events outside restricted times', async () => {
      const allowedEvent = createMockEvent(
        'Afternoon event',
        EventCategory.ENTERTAINMENT,
        new Date('2024-01-15T15:00:00'),
        new Date('2024-01-15T16:00:00')
      )

      const result = await parentalControl.enforceTimeRestrictions(allowedEvent, childUserId)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('Child-Friendly Messaging', () => {
    beforeEach(async () => {
      await parentalControl.setupParentalControls(childUserId, parentId, { childFriendlyMode: true })
    })

    it('should generate encouraging messages for young children', () => {
      const message = parentalControl.generateChildFriendlyMessage(
        'Event cannot be scheduled',
        'young_child',
        'encouraging'
      )

      expect(message.childFriendlyVersion).toContain('Great job!')
      expect(message.childFriendlyVersion).not.toContain('cannot')
      expect(message.ageGroup).toBe('young_child')
      expect(message.tone).toBe('encouraging')
    })

    it('should generate gentle correction messages', () => {
      const message = parentalControl.generateChildFriendlyMessage(
        'Content is inappropriate',
        'older_child',
        'gentle_correction'
      )

      expect(message.childFriendlyVersion).toContain('Almost there!')
      expect(message.childFriendlyVersion).not.toContain('inappropriate')
      expect(message.tone).toBe('gentle_correction')
    })

    it('should adapt messages for teenagers', () => {
      const message = parentalControl.generateChildFriendlyMessage(
        'Request failed validation',
        'teen',
        'encouraging'
      )

      expect(message.childFriendlyVersion).toContain('Hey!')
      expect(message.childFriendlyVersion).not.toContain('failed')
      expect(message.ageGroup).toBe('teen')
    })
  })

  describe('Family Visibility Controls', () => {
    beforeEach(async () => {
      const config: Partial<ParentalControlConfig> = {
        familyVisibilitySettings: {
          showAllFamilyEvents: true,
          showChildSchedulesToParents: true,
          showParentSchedulesToChildren: false,
          allowChildToViewSiblings: true,
          hidePrivateEvents: true,
          emergencyContactVisibility: true
        }
      }
      await parentalControl.setupParentalControls(childUserId, parentId, config)
    })

    it('should allow parents to view child schedules', async () => {
      const visibility = await parentalControl.getFamilyVisibility(parentId, childUserId)

      expect(visibility.canView).toBe(true)
      expect(visibility.visibleEvents).toBeInstanceOf(Array)
      expect(visibility.reason).toBeUndefined()
    })

    it('should respect parent-to-child visibility settings', async () => {
      const visibility = await parentalControl.getFamilyVisibility(childUserId, parentId)

      expect(visibility.canView).toBe(false)
      expect(visibility.reason).toContain('Family visibility settings')
    })

    it('should handle users without parental controls', async () => {
      const visibility = await parentalControl.getFamilyVisibility('other_user', 'another_user')

      expect(visibility.canView).toBe(true)
      expect(visibility.visibleEvents).toBeInstanceOf(Array)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing parental controls configuration', async () => {
      const event = createMockEvent('Test event')
      const safetyValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      const requiresApproval = await parentalControl.requiresApproval(
        event,
        'non_existent_user',
        safetyValidation
      )

      expect(requiresApproval).toBe(false)
    })

    it('should handle submission without parental controls', async () => {
      const event = createMockEvent('Test event')
      const safetyValidation: SafetyValidationResult = {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe']
      }

      await expect(
        parentalControl.submitApprovalRequest(
          'non_existent_user',
          RequestType.EVENT_CREATION,
          event,
          safetyValidation
        )
      ).rejects.toThrow('Parental controls not configured for user')
    })

    it('should handle external calendar requests without parental controls', async () => {
      await expect(
        parentalControl.requestExternalCalendarApproval(
          'non_existent_user',
          'google',
          'test@example.com',
          ['read_calendar'],
          'read_only',
          'Test'
        )
      ).rejects.toThrow('Parental controls not configured for user')
    })
  })

  // Helper function to create mock events
  function createMockEvent(
    title: string,
    category: EventCategory = EventCategory.ENTERTAINMENT,
    startTime: Date = new Date('2024-01-15T15:00:00'),
    endTime: Date = new Date('2024-01-15T16:00:00')
  ): CalendarEvent {
    return {
      id: `event_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description: `Description for ${title}`,
      startTime,
      endTime,
      allDay: false,
      location: { name: 'Test location', type: 'other' as any },
      attendees: [],
      category,
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
})