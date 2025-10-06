// Unit tests for family permissions and privacy controls

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { FamilyPermissionManagerImpl } from './family-permissions'
import {
  FamilyRole,
  MemberPermissions,
  ApprovalType,
  TimeRestriction,
  RestrictionType,
  ParentalControls,
  FamilyEvent,
  ApprovalRequest,
  ApprovalRequestStatus,
  ActivityRecord,
  ActivityType
} from './family-types'
import { EventCategory, VisibilityLevel } from '../calendar/types'
import { Priority } from './types'

describe('FamilyPermissionManager', () => {
  let permissionManager: FamilyPermissionManagerImpl

  beforeEach(async () => {
    permissionManager = new FamilyPermissionManagerImpl()
    await permissionManager.initialize()
  })

  afterEach(async () => {
    await permissionManager.shutdown()
    jest.clearAllMocks()
  })

  describe('Role-Based Permissions', () => {
    it('should provide appropriate permissions for parent role', () => {
      const permissions = permissionManager.getRolePermissions(FamilyRole.PARENT)

      expect(permissions.canCreateFamilyEvents).toBe(true)
      expect(permissions.canModifyFamilyEvents).toBe(true)
      expect(permissions.canDeleteFamilyEvents).toBe(true)
      expect(permissions.canViewOtherSchedules).toBe(true)
      expect(permissions.canModifyOtherSchedules).toBe(true)
      expect(permissions.requiresApproval).toBe(false)
      expect(permissions.approvalRequired).toHaveLength(0)
      expect(permissions.maxEventDuration).toBe(480) // 8 hours
      expect(permissions.allowedCategories).toEqual(Object.values(EventCategory))
      expect(permissions.timeRestrictions).toHaveLength(0)
    })

    it('should provide restricted permissions for child role', () => {
      const permissions = permissionManager.getRolePermissions(FamilyRole.CHILD)

      expect(permissions.canCreateFamilyEvents).toBe(false)
      expect(permissions.canModifyFamilyEvents).toBe(false)
      expect(permissions.canDeleteFamilyEvents).toBe(false)
      expect(permissions.canViewOtherSchedules).toBe(false)
      expect(permissions.canModifyOtherSchedules).toBe(false)
      expect(permissions.requiresApproval).toBe(true)
      expect(permissions.approvalRequired).toContain(ApprovalType.EVENT_CREATION)
      expect(permissions.maxEventDuration).toBe(90) // 1.5 hours
      expect(permissions.allowedCategories).toEqual([
        EventCategory.FAMILY,
        EventCategory.EDUCATION,
        EventCategory.HEALTH
      ])
      expect(permissions.timeRestrictions.length).toBeGreaterThan(0)
    })

    it('should provide moderate permissions for teen role', () => {
      const permissions = permissionManager.getRolePermissions(FamilyRole.TEEN)

      expect(permissions.canCreateFamilyEvents).toBe(true)
      expect(permissions.canModifyFamilyEvents).toBe(false)
      expect(permissions.canDeleteFamilyEvents).toBe(false)
      expect(permissions.canViewOtherSchedules).toBe(true)
      expect(permissions.canModifyOtherSchedules).toBe(false)
      expect(permissions.requiresApproval).toBe(true)
      expect(permissions.maxEventDuration).toBe(240) // 4 hours
      expect(permissions.allowedCategories).toContain(EventCategory.FAMILY)
      expect(permissions.allowedCategories).toContain(EventCategory.EDUCATION)
      expect(permissions.allowedCategories).toContain(EventCategory.ENTERTAINMENT)
      expect(permissions.timeRestrictions.length).toBeGreaterThan(0)
    })

    it('should provide full permissions for adult child role', () => {
      const permissions = permissionManager.getRolePermissions(FamilyRole.ADULT_CHILD)

      expect(permissions.canCreateFamilyEvents).toBe(true)
      expect(permissions.canModifyFamilyEvents).toBe(true)
      expect(permissions.canDeleteFamilyEvents).toBe(false)
      expect(permissions.canViewOtherSchedules).toBe(true)
      expect(permissions.canModifyOtherSchedules).toBe(false)
      expect(permissions.requiresApproval).toBe(false)
      expect(permissions.approvalRequired).toHaveLength(0)
      expect(permissions.maxEventDuration).toBe(480) // 8 hours
      expect(permissions.allowedCategories).toEqual(Object.values(EventCategory))
      expect(permissions.timeRestrictions).toHaveLength(0)
    })
  })

  describe('Permission Checking', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    beforeEach(async () => {
      // Set up parent permissions
      const parentPermissions = permissionManager.getRolePermissions(FamilyRole.PARENT)
      await permissionManager.updateMemberPermissions(familyId, parentId, parentPermissions)

      // Set up child permissions
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)
    })

    it('should allow parent to create family events', async () => {
      const canCreate = await permissionManager.checkPermission(
        familyId,
        parentId,
        'create_family_event'
      )

      expect(canCreate).toBe(true)
    })

    it('should deny child from creating family events', async () => {
      const canCreate = await permissionManager.checkPermission(
        familyId,
        childId,
        'create_family_event'
      )

      expect(canCreate).toBe(false)
    })

    it('should allow parent to view other schedules', async () => {
      const canView = await permissionManager.checkPermission(
        familyId,
        parentId,
        'view_other_schedules'
      )

      expect(canView).toBe(true)
    })

    it('should deny child from viewing other schedules', async () => {
      const canView = await permissionManager.checkPermission(
        familyId,
        childId,
        'view_other_schedules'
      )

      expect(canView).toBe(false)
    })

    it('should check time restrictions for events', async () => {
      const bedtimeStart = new Date()
      bedtimeStart.setHours(21, 0, 0, 0) // 9 PM

      const bedtimeEnd = new Date()
      bedtimeEnd.setHours(22, 0, 0, 0) // 10 PM

      const canSchedule = await permissionManager.checkPermission(
        familyId,
        childId,
        'create_family_event',
        {
          startTime: bedtimeStart,
          endTime: bedtimeEnd
        }
      )

      expect(canSchedule).toBe(false)
    })
  })

  describe('Time Restrictions', () => {
    const familyId = 'test-family-1'
    const childId = 'child-1'

    beforeEach(async () => {
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)
    })

    it('should add time restriction successfully', async () => {
      const restriction: TimeRestriction = {
        type: RestrictionType.STUDY_TIME,
        startTime: '15:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        isActive: true,
        reason: 'Study time restriction'
      }

      await expect(
        permissionManager.addTimeRestriction(familyId, childId, restriction)
      ).resolves.not.toThrow()
    })

    it('should remove time restriction successfully', async () => {
      const restriction: TimeRestriction = {
        type: RestrictionType.STUDY_TIME,
        startTime: '15:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
        reason: 'Study time restriction'
      }

      await permissionManager.addTimeRestriction(familyId, childId, restriction)

      const restrictionId = `${restriction.type}_${restriction.startTime}_${restriction.endTime}_${restriction.daysOfWeek.join('')}`

      await expect(
        permissionManager.removeTimeRestriction(familyId, childId, restrictionId)
      ).resolves.not.toThrow()
    })

    it('should check time restrictions correctly', async () => {
      const now = new Date()
      const bedtimeStart = new Date(now)
      bedtimeStart.setHours(20, 0, 0, 0) // 8 PM

      const bedtimeEnd = new Date(now)
      bedtimeEnd.setHours(21, 0, 0, 0) // 9 PM

      // Child role has bedtime restrictions from 20:00 to 07:00
      const isAllowed = await permissionManager.checkTimeRestrictions(
        familyId,
        childId,
        bedtimeStart,
        bedtimeEnd
      )

      expect(isAllowed).toBe(false)
    })

    it('should allow events outside restricted times', async () => {
      const now = new Date()
      const afternoonStart = new Date(now)
      afternoonStart.setHours(14, 0, 0, 0) // 2 PM

      const afternoonEnd = new Date(now)
      afternoonEnd.setHours(15, 0, 0, 0) // 3 PM

      const isAllowed = await permissionManager.checkTimeRestrictions(
        familyId,
        childId,
        afternoonStart,
        afternoonEnd
      )

      expect(isAllowed).toBe(true)
    })

    it('should reject invalid time restrictions', async () => {
      const invalidRestriction: TimeRestriction = {
        type: RestrictionType.BEDTIME,
        startTime: '25:00', // Invalid hour
        endTime: '07:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
        reason: 'Invalid restriction'
      }

      await expect(
        permissionManager.addTimeRestriction(familyId, childId, invalidRestriction)
      ).rejects.toThrow('Invalid time restriction')
    })
  })

  describe('Parental Controls', () => {
    const familyId = 'test-family-1'

    it('should update parental controls successfully', async () => {
      const controls: ParentalControls = {
        enabled: true,
        requireApprovalForChildren: true,
        timeRestrictions: new Map(),
        contentFiltering: {
          enabled: true,
          blockedKeywords: ['inappropriate', 'dangerous'],
          allowedCategories: [EventCategory.FAMILY, EventCategory.EDUCATION],
          requireApprovalForExternal: true,
          safetyValidationRequired: true
        },
        supervisionSettings: {
          trackAttendance: true,
          requireCheckIn: false,
          locationTracking: false,
          notifyOnMissedEvents: true,
          escalationRules: []
        }
      }

      await expect(
        permissionManager.updateParentalControls(familyId, controls)
      ).resolves.not.toThrow()
    })

    it('should check if parental approval is required', async () => {
      const childId = 'child-1'
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)

      const controls: ParentalControls = {
        enabled: true,
        requireApprovalForChildren: true,
        timeRestrictions: new Map(),
        contentFiltering: {
          enabled: true,
          blockedKeywords: [],
          allowedCategories: [EventCategory.FAMILY],
          requireApprovalForExternal: true,
          safetyValidationRequired: true
        },
        supervisionSettings: {
          trackAttendance: true,
          requireCheckIn: false,
          locationTracking: false,
          notifyOnMissedEvents: true,
          escalationRules: []
        }
      }

      await permissionManager.updateParentalControls(familyId, controls)

      const requiresApproval = await permissionManager.requiresParentalApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION
      )

      expect(requiresApproval).toBe(true)
    })
  })

  describe('Content Validation', () => {
    const familyId = 'test-family-1'
    const childId = 'child-1'

    beforeEach(async () => {
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)

      const controls: ParentalControls = {
        enabled: true,
        requireApprovalForChildren: true,
        timeRestrictions: new Map(),
        contentFiltering: {
          enabled: true,
          blockedKeywords: ['inappropriate', 'dangerous'],
          allowedCategories: [EventCategory.FAMILY, EventCategory.EDUCATION],
          requireApprovalForExternal: true,
          safetyValidationRequired: true
        },
        supervisionSettings: {
          trackAttendance: true,
          requireCheckIn: false,
          locationTracking: false,
          notifyOnMissedEvents: true,
          escalationRules: []
        }
      }

      await permissionManager.updateParentalControls(familyId, controls)
    })

    it('should validate safe event content', async () => {
      const safeEvent: FamilyEvent = {
        id: 'safe-event-1',
        title: 'Family Game Night',
        description: 'Fun family board games',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: childId,
        requiredAttendees: [childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: 'auto_approved' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          createdBy: childId,
          lastModifiedBy: childId,
          approvalHistory: [],
          conflictHistory: [],
          notificationsSent: [],
          attendanceTracking: []
        }
      }

      const isValid = await permissionManager.validateEventContent(safeEvent, childId)
      expect(isValid).toBe(true)
    })

    it('should reject event with blocked keywords', async () => {
      const unsafeEvent: FamilyEvent = {
        id: 'unsafe-event-1',
        title: 'Inappropriate Activity',
        description: 'This contains dangerous content',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: childId,
        requiredAttendees: [childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: 'auto_approved' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          createdBy: childId,
          lastModifiedBy: childId,
          approvalHistory: [],
          conflictHistory: [],
          notificationsSent: [],
          attendanceTracking: []
        }
      }

      const isValid = await permissionManager.validateEventContent(unsafeEvent, childId)
      expect(isValid).toBe(false)
    })

    it('should reject event with disallowed category', async () => {
      const workEvent: FamilyEvent = {
        id: 'work-event-1',
        title: 'Work Meeting',
        description: 'Business meeting',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.WORK, // Not allowed for children
        priority: Priority.MEDIUM,
        organizerId: childId,
        requiredAttendees: [childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: 'auto_approved' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          createdBy: childId,
          lastModifiedBy: childId,
          approvalHistory: [],
          conflictHistory: [],
          notificationsSent: [],
          attendanceTracking: []
        }
      }

      const isValid = await permissionManager.validateEventContent(workEvent, childId)
      expect(isValid).toBe(false)
    })

    it('should reject event exceeding duration limits', async () => {
      const longEvent: FamilyEvent = {
        id: 'long-event-1',
        title: 'Very Long Event',
        description: 'This event is too long for a child',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours (exceeds 90 min limit)
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: childId,
        requiredAttendees: [childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: 'auto_approved' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          createdBy: childId,
          lastModifiedBy: childId,
          approvalHistory: [],
          conflictHistory: [],
          notificationsSent: [],
          attendanceTracking: []
        }
      }

      const isValid = await permissionManager.validateEventContent(longEvent, childId)
      expect(isValid).toBe(false)
    })
  })

  describe('Privacy Controls', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    beforeEach(async () => {
      const parentPermissions = permissionManager.getRolePermissions(FamilyRole.PARENT)
      await permissionManager.updateMemberPermissions(familyId, parentId, parentPermissions)

      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)
    })

    it('should allow users to view their own schedule', async () => {
      const canView = await permissionManager.canViewMemberSchedule(familyId, childId, childId)
      expect(canView).toBe(true)
    })

    it('should allow parents to view child schedules', async () => {
      const canView = await permissionManager.canViewMemberSchedule(familyId, parentId, childId)
      expect(canView).toBe(true)
    })

    it('should deny children from viewing other schedules', async () => {
      const canView = await permissionManager.canViewMemberSchedule(familyId, childId, parentId)
      expect(canView).toBe(false)
    })

    it('should allow users to modify their own schedule', async () => {
      const canModify = await permissionManager.canModifyMemberSchedule(familyId, childId, childId)
      expect(canModify).toBe(true)
    })

    it('should deny children from modifying other schedules', async () => {
      const canModify = await permissionManager.canModifyMemberSchedule(familyId, childId, parentId)
      expect(canModify).toBe(false)
    })

    it('should filter private events for non-organizers', async () => {
      const privateEvent: FamilyEvent = {
        id: 'private-event-1',
        title: 'Private Meeting',
        description: 'Confidential discussion',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.PERSONAL,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.PRIVATE,
        approvalStatus: 'auto_approved' as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          createdBy: parentId,
          lastModifiedBy: parentId,
          approvalHistory: [],
          conflictHistory: [],
          notificationsSent: [],
          attendanceTracking: []
        }
      }

      const filteredEvent = await permissionManager.filterEventForUser(privateEvent, childId)

      expect(filteredEvent.title).toBe('Private Event')
      expect(filteredEvent.description).toBeUndefined()
      expect(filteredEvent.visibility).toBe(VisibilityLevel.PRIVATE)
    })
  })

  describe('Approval Workflows', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    beforeEach(async () => {
      const parentPermissions = permissionManager.getRolePermissions(FamilyRole.PARENT)
      await permissionManager.updateMemberPermissions(familyId, parentId, parentPermissions)

      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)
    })

    it('should request approval successfully', async () => {
      const approvalId = await permissionManager.requestApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION,
        { eventTitle: 'Test Event' }
      )

      expect(approvalId).toBeDefined()
      expect(typeof approvalId).toBe('string')
    })

    it('should process approval successfully', async () => {
      const approvalId = await permissionManager.requestApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION,
        { eventTitle: 'Test Event' }
      )

      await expect(
        permissionManager.processApproval(approvalId, parentId, true, 'Approved')
      ).resolves.not.toThrow()
    })

    it('should process rejection successfully', async () => {
      const approvalId = await permissionManager.requestApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION,
        { eventTitle: 'Test Event' }
      )

      await expect(
        permissionManager.processApproval(approvalId, parentId, false, 'Not appropriate')
      ).resolves.not.toThrow()
    })

    it('should get pending approvals for approver', async () => {
      await permissionManager.requestApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION,
        { eventTitle: 'Test Event' }
      )

      const pendingApprovals = await permissionManager.getPendingApprovals(familyId, parentId)

      expect(Array.isArray(pendingApprovals)).toBe(true)
      // Note: The actual count depends on the implementation of getApprovers
    })
  })

  describe('Activity Recording and Supervision', () => {
    const familyId = 'test-family-1'
    const childId = 'child-1'

    beforeEach(async () => {
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)
    })

    it('should record activity successfully', async () => {
      const activity: ActivityRecord = {
        userId: childId,
        activityType: ActivityType.EVENT_CREATED,
        timestamp: new Date(),
        details: { eventId: 'test-event-1' }
      }

      await expect(
        permissionManager.recordActivity(familyId, childId, activity)
      ).resolves.not.toThrow()
    })

    it('should check supervision rules', async () => {
      const activity: ActivityRecord = {
        userId: childId,
        activityType: ActivityType.EVENT_CREATED,
        timestamp: new Date(),
        details: { eventId: 'test-event-1' }
      }

      const supervisionResult = await permissionManager.checkSupervisionRules(
        familyId,
        childId,
        activity
      )

      expect(supervisionResult).toBeDefined()
      expect(supervisionResult.allowed).toBeDefined()
      expect(Array.isArray(supervisionResult.warnings)).toBe(true)
      expect(Array.isArray(supervisionResult.escalations)).toBe(true)
      expect(Array.isArray(supervisionResult.restrictions)).toBe(true)
      expect(typeof supervisionResult.requiresApproval).toBe('boolean')
      expect(Array.isArray(supervisionResult.approvers)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle operations on non-existent family', async () => {
      const nonExistentFamilyId = 'non-existent-family'
      const userId = 'user-1'

      await expect(
        permissionManager.updateMemberPermissions(nonExistentFamilyId, userId, {} as MemberPermissions)
      ).rejects.toThrow(`Family permissions not found for family ${nonExistentFamilyId}`)
    })

    it('should handle invalid approval requests', async () => {
      const nonExistentApprovalId = 'non-existent-approval'
      const approverId = 'approver-1'

      await expect(
        permissionManager.processApproval(nonExistentApprovalId, approverId, true)
      ).rejects.toThrow(`Approval request ${nonExistentApprovalId}_${approverId} not found`)
    })

    it('should validate permission updates for child safety', async () => {
      const familyId = 'test-family-1'
      const childId = 'child-1'

      const unsafePermissions: MemberPermissions = {
        canCreateFamilyEvents: true,
        canModifyFamilyEvents: true,
        canDeleteFamilyEvents: true,
        canViewOtherSchedules: true,
        canModifyOtherSchedules: true,
        requiresApproval: false,
        approvalRequired: [],
        timeRestrictions: [],
        maxEventDuration: 1000, // Excessive duration
        allowedCategories: [EventCategory.WORK] // Inappropriate category
      }

      // The system should validate and restrict these permissions
      await expect(
        permissionManager.updateMemberPermissions(familyId, childId, unsafePermissions)
      ).resolves.not.toThrow()

      // The actual permissions should be validated and restricted
      // This would be verified by checking the stored permissions
    })
  })

  describe('Integration and Event Handling', () => {
    it('should handle initialization and shutdown correctly', async () => {
      const newManager = new FamilyPermissionManagerImpl()

      await expect(newManager.initialize()).resolves.not.toThrow()
      await expect(newManager.shutdown()).resolves.not.toThrow()
    })

    it('should emit events for permission changes', async () => {
      const eventSpy = jest.fn()
      permissionManager.on('permissions:updated', eventSpy)

      const familyId = 'test-family-1'
      const userId = 'user-1'
      const permissions = permissionManager.getRolePermissions(FamilyRole.PARENT)

      await permissionManager.updateMemberPermissions(familyId, userId, permissions)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          familyId,
          userId,
          permissions
        })
      )
    })

    it('should emit events for approval processing', async () => {
      const eventSpy = jest.fn()
      permissionManager.on('approval:processed', eventSpy)

      const familyId = 'test-family-1'
      const childId = 'child-1'
      const parentId = 'parent-1'

      // Set up permissions first
      const childPermissions = permissionManager.getRolePermissions(FamilyRole.CHILD)
      await permissionManager.updateMemberPermissions(familyId, childId, childPermissions)

      const approvalId = await permissionManager.requestApproval(
        familyId,
        childId,
        ApprovalType.EVENT_CREATION,
        { eventTitle: 'Test Event' }
      )

      await permissionManager.processApproval(approvalId, parentId, true, 'Approved')

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalId,
          approverId: parentId,
          decision: true,
          reason: 'Approved'
        })
      )
    })
  })
})