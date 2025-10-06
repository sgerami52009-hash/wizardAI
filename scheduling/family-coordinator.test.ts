// Unit tests for family coordination system

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { FamilyCoordinatorImpl } from './family-coordinator'
import { FamilyPermissionManagerImpl } from './family-permissions'
import { FamilyNotificationManagerImpl } from './family-notifications'
import {
  FamilyMember,
  FamilyEvent,
  FamilyRole,
  ApprovalStatus,
  ResponseType,
  AttendeeResponse,
  FamilyConflictResolution,
  ConflictSeverity,
  ConflictType,
  FamilyEventType
} from './family-types'
import { Priority } from './types'
import { EventCategory, VisibilityLevel } from '../calendar/types'

describe('FamilyCoordinator', () => {
  let familyCoordinator: FamilyCoordinatorImpl
  let mockEventBus: any

  beforeEach(async () => {
    // Mock event bus
    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    }

    familyCoordinator = new FamilyCoordinatorImpl()
    await familyCoordinator.initialize()
  })

  afterEach(async () => {
    await familyCoordinator.shutdown()
    jest.clearAllMocks()
  })

  describe('Family Management', () => {
    it('should create a new family with creator as parent', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'

      const family = await familyCoordinator.createFamily(familyId, creatorId)

      expect(family.familyId).toBe(familyId)
      expect(family.members).toHaveLength(1)
      expect(family.members[0].userId).toBe(creatorId)
      expect(family.members[0].role).toBe(FamilyRole.PARENT)
      expect(family.members[0].isActive).toBe(true)
    })

    it('should not allow creating duplicate families', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'

      await familyCoordinator.createFamily(familyId, creatorId)

      await expect(
        familyCoordinator.createFamily(familyId, creatorId)
      ).rejects.toThrow(`Family ${familyId} already exists`)
    })

    it('should add family member with appropriate permissions', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'
      const childId = 'user-2'

      await familyCoordinator.createFamily(familyId, creatorId)

      const childMember: FamilyMember = {
        userId: childId,
        familyId,
        displayName: 'Child User',
        role: FamilyRole.CHILD,
        permissions: {
          canCreateFamilyEvents: false,
          canModifyFamilyEvents: false,
          canDeleteFamilyEvents: false,
          canViewOtherSchedules: false,
          canModifyOtherSchedules: false,
          requiresApproval: true,
          approvalRequired: [],
          timeRestrictions: [],
          maxEventDuration: 90,
          allowedCategories: [EventCategory.FAMILY, EventCategory.EDUCATION]
        },
        visibility: {
          defaultVisibility: VisibilityLevel.FAMILY,
          shareWithFamily: true,
          shareCalendarDetails: true,
          shareLocationInfo: false,
          shareAvailability: true,
          hiddenCategories: [],
          privateKeywords: []
        },
        availability: {
          userId: childId,
          timeSlots: [],
          defaultAvailability: 'available' as any,
          recurringUnavailability: [],
          lastUpdated: new Date()
        },
        preferences: {
          preferredMeetingTimes: [],
          blackoutTimes: [],
          notificationPreferences: {
            enableFamilyNotifications: true,
            notifyOnFamilyEvents: true,
            notifyOnConflicts: true,
            notifyOnInvitations: true,
            preferredNotificationMethods: [],
            quietHours: []
          },
          schedulingPreferences: {
            autoAcceptFamilyEvents: false,
            suggestAlternativeTimes: true,
            bufferTimeMinutes: 15,
            preferredEventDuration: 60,
            maxDailyEvents: 5,
            preferredDaysOff: [0, 6]
          },
          privacyPreferences: {
            shareDetailedSchedule: true,
            shareAvailabilityOnly: false,
            allowFamilyModifications: false,
            requireConfirmationForChanges: true,
            hidePersonalEvents: false
          }
        },
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, childMember)

      const family = await familyCoordinator.getFamilySchedule(familyId, {
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      expect(family.members).toHaveLength(2)
      expect(family.members.find(m => m.userId === childId)).toBeDefined()
      expect(family.memberSchedules.has(childId)).toBe(true)
    })

    it('should not allow duplicate family members', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'

      await familyCoordinator.createFamily(familyId, creatorId)

      const duplicateMember: FamilyMember = {
        userId: creatorId,
        familyId,
        displayName: 'Duplicate User',
        role: FamilyRole.CHILD,
        permissions: {} as any,
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await expect(
        familyCoordinator.addFamilyMember(familyId, duplicateMember)
      ).rejects.toThrow(`Member ${creatorId} already exists in family ${familyId}`)
    })

    it('should remove family member and handle their events', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'
      const memberId = 'user-2'

      await familyCoordinator.createFamily(familyId, creatorId)

      const member: FamilyMember = {
        userId: memberId,
        familyId,
        displayName: 'Test Member',
        role: FamilyRole.TEEN,
        permissions: {} as any,
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, member)
      await familyCoordinator.removeFamilyMember(familyId, memberId)

      const family = await familyCoordinator.getFamilySchedule(familyId, {
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })

      expect(family.members).toHaveLength(1)
      expect(family.members.find(m => m.userId === memberId)).toBeUndefined()
      expect(family.memberSchedules.has(memberId)).toBe(false)
    })

    it('should not allow removing the last parent', async () => {
      const familyId = 'test-family-1'
      const creatorId = 'user-1'

      await familyCoordinator.createFamily(familyId, creatorId)

      await expect(
        familyCoordinator.removeFamilyMember(familyId, creatorId)
      ).rejects.toThrow('Cannot remove the last parent/guardian from family')
    })
  })

  describe('Family Event Management', () => {
    let familyId: string
    let parentId: string
    let childId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'
      childId = 'child-1'

      await familyCoordinator.createFamily(familyId, parentId)

      const child: FamilyMember = {
        userId: childId,
        familyId,
        displayName: 'Test Child',
        role: FamilyRole.CHILD,
        permissions: {
          canCreateFamilyEvents: false,
          canModifyFamilyEvents: false,
          canDeleteFamilyEvents: false,
          canViewOtherSchedules: false,
          canModifyOtherSchedules: false,
          requiresApproval: true,
          approvalRequired: [],
          timeRestrictions: [],
          maxEventDuration: 90,
          allowedCategories: [EventCategory.FAMILY]
        },
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, child)
    })

    it('should create family event with proper validation', async () => {
      const event: FamilyEvent = {
        id: '',
        title: 'Family Dinner',
        description: 'Weekly family dinner',
        startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        location: 'Home',
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId, childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: true,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      const result = await familyCoordinator.createFamilyEvent(event, parentId)

      expect(result.success).toBe(true)
      expect(result.eventId).toBeDefined()
      expect(result.pendingAttendees).toContain(parentId)
      expect(result.pendingAttendees).toContain(childId)
    })

    it('should reject event creation without proper permissions', async () => {
      const event: FamilyEvent = {
        id: '',
        title: 'Unauthorized Event',
        description: 'Child trying to create event',
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
        approvalStatus: ApprovalStatus.PENDING,
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

      await expect(
        familyCoordinator.createFamilyEvent(event, childId)
      ).rejects.toThrow(`User ${childId} does not have permission to create family events`)
    })

    it('should update family event with proper permissions', async () => {
      // First create an event
      const event: FamilyEvent = {
        id: '',
        title: 'Original Event',
        description: 'Original description',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      const createResult = await familyCoordinator.createFamilyEvent(event, parentId)

      // Update the event
      const changes = {
        title: 'Updated Event',
        description: 'Updated description'
      }

      const updateResult = await familyCoordinator.updateFamilyEvent(
        createResult.eventId,
        changes,
        parentId
      )

      expect(updateResult.success).toBe(true)
      expect(updateResult.eventId).toBe(createResult.eventId)
    })

    it('should cancel family event with proper permissions', async () => {
      // First create an event
      const event: FamilyEvent = {
        id: '',
        title: 'Event to Cancel',
        description: 'This event will be cancelled',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      const createResult = await familyCoordinator.createFamilyEvent(event, parentId)

      // Cancel the event
      await expect(
        familyCoordinator.cancelFamilyEvent(createResult.eventId, parentId, 'Test cancellation')
      ).resolves.not.toThrow()
    })
  })

  describe('RSVP and Attendance', () => {
    let familyId: string
    let parentId: string
    let childId: string
    let eventId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'
      childId = 'child-1'

      await familyCoordinator.createFamily(familyId, parentId)

      const child: FamilyMember = {
        userId: childId,
        familyId,
        displayName: 'Test Child',
        role: FamilyRole.CHILD,
        permissions: {} as any,
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, child)

      // Create a test event
      const event: FamilyEvent = {
        id: '',
        title: 'Test Event',
        description: 'Event for RSVP testing',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId, childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: true,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      const result = await familyCoordinator.createFamilyEvent(event, parentId)
      eventId = result.eventId
    })

    it('should process RSVP response correctly', async () => {
      const response: AttendeeResponse = {
        userId: childId,
        response: ResponseType.ACCEPTED,
        responseTime: new Date(),
        note: 'Looking forward to it!'
      }

      await expect(
        familyCoordinator.respondToFamilyEvent(eventId, childId, response)
      ).resolves.not.toThrow()
    })

    it('should reject RSVP from non-attendee', async () => {
      const nonAttendeeId = 'non-attendee'
      const response: AttendeeResponse = {
        userId: nonAttendeeId,
        response: ResponseType.ACCEPTED,
        responseTime: new Date()
      }

      await expect(
        familyCoordinator.respondToFamilyEvent(eventId, nonAttendeeId, response)
      ).rejects.toThrow(`User ${nonAttendeeId} is not an attendee of event ${eventId}`)
    })

    it('should track attendance correctly', async () => {
      const checkInTime = new Date()

      await expect(
        familyCoordinator.trackAttendance(eventId, childId, true, checkInTime)
      ).resolves.not.toThrow()

      // Check out
      const checkOutTime = new Date(checkInTime.getTime() + 60 * 60 * 1000)
      await expect(
        familyCoordinator.trackAttendance(eventId, childId, false, checkOutTime)
      ).resolves.not.toThrow()
    })
  })

  describe('Conflict Detection and Resolution', () => {
    let familyId: string
    let parentId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'

      await familyCoordinator.createFamily(familyId, parentId)
    })

    it('should detect time conflicts between events', async () => {
      const startTime = new Date(Date.now() + 60 * 60 * 1000)
      const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000)

      // Create first event
      const event1: FamilyEvent = {
        id: '',
        title: 'First Event',
        description: 'First event',
        startTime,
        endTime,
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      await familyCoordinator.createFamilyEvent(event1, parentId)

      // Create overlapping event
      const event2: FamilyEvent = {
        ...event1,
        id: '',
        title: 'Conflicting Event',
        description: 'This event conflicts with the first',
        startTime: new Date(startTime.getTime() + 30 * 60 * 1000), // 30 minutes later
        endTime: new Date(endTime.getTime() + 30 * 60 * 1000)
      }

      const conflicts = await familyCoordinator.detectFamilyConflicts(familyId, event2)

      expect(conflicts.length).toBeGreaterThan(0)
      expect(conflicts[0].conflictType).toBe(ConflictType.TIME_OVERLAP)
    })

    it('should resolve conflicts with appropriate resolution', async () => {
      // Create a mock conflict
      const conflict: FamilyConflictResolution = {
        conflictId: 'test-conflict-1',
        familyId,
        conflictType: ConflictType.TIME_OVERLAP,
        affectedMembers: [parentId],
        conflictingEvents: ['event-1', 'event-2'],
        detectedAt: new Date(),
        severity: ConflictSeverity.MEDIUM,
        resolutionOptions: [
          {
            id: 'resolution-1',
            strategy: 'reschedule_event' as any,
            description: 'Reschedule the second event',
            impact: {
              affectedEvents: 1,
              affectedMembers: 1,
              timeChanges: 1,
              cancellations: 0,
              newConflicts: 0,
              memberSatisfaction: 0.8
            },
            requiredActions: [],
            affectedMembers: [parentId],
            estimatedEffort: 'low' as any
          }
        ]
      }

      await expect(
        familyCoordinator.resolveFamilyConflict(
          conflict.conflictId,
          conflict.resolutionOptions[0],
          parentId
        )
      ).resolves.not.toThrow()
    })
  })

  describe('Family Availability', () => {
    let familyId: string
    let parentId: string
    let childId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'
      childId = 'child-1'

      await familyCoordinator.createFamily(familyId, parentId)

      const child: FamilyMember = {
        userId: childId,
        familyId,
        displayName: 'Test Child',
        role: FamilyRole.CHILD,
        permissions: {} as any,
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, child)
    })

    it('should check family availability for time slot', async () => {
      const timeSlot = {
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        isAvailable: true
      }

      const availability = await familyCoordinator.checkFamilyAvailability(
        familyId,
        timeSlot,
        [parentId, childId]
      )

      expect(availability.familyId).toBe(familyId)
      expect(availability.memberAvailability.size).toBe(2)
      expect(availability.memberAvailability.has(parentId)).toBe(true)
      expect(availability.memberAvailability.has(childId)).toBe(true)
    })

    it('should suggest family meeting times', async () => {
      const request = {
        familyId,
        organizerId: parentId,
        requiredAttendees: [parentId, childId],
        optionalAttendees: [],
        duration: 60, // 1 hour
        preferredTimeRanges: [
          {
            startTime: new Date(Date.now() + 60 * 60 * 1000),
            endTime: new Date(Date.now() + 4 * 60 * 60 * 1000)
          }
        ],
        blackoutTimes: [],
        priority: Priority.MEDIUM,
        category: EventCategory.FAMILY,
        constraints: {
          minAttendees: 2,
          maxAttendees: 10,
          requireAllRequired: true,
          allowPartialAvailability: false,
          bufferTimeMinutes: 15,
          preferredDaysOfWeek: [1, 2, 3, 4, 5], // Weekdays
          avoidWeekends: false,
          workingHoursOnly: false
        }
      }

      const suggestedTimes = await familyCoordinator.suggestFamilyMeetingTimes(request)

      expect(Array.isArray(suggestedTimes)).toBe(true)
      // Note: The actual suggestions would depend on the implementation
      // For now, we just verify the method doesn't throw
    })

    it('should get family schedule for time range', async () => {
      const timeRange = {
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      }

      const schedule = await familyCoordinator.getFamilySchedule(familyId, timeRange)

      expect(schedule.familyId).toBe(familyId)
      expect(schedule.members.length).toBe(2)
      expect(schedule.sharedEvents).toBeDefined()
      expect(schedule.memberSchedules).toBeDefined()
    })
  })

  describe('Approval Workflows', () => {
    let familyId: string
    let parentId: string
    let childId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'
      childId = 'child-1'

      await familyCoordinator.createFamily(familyId, parentId)

      const child: FamilyMember = {
        userId: childId,
        familyId,
        displayName: 'Test Child',
        role: FamilyRole.CHILD,
        permissions: {
          canCreateFamilyEvents: false,
          canModifyFamilyEvents: false,
          canDeleteFamilyEvents: false,
          canViewOtherSchedules: false,
          canModifyOtherSchedules: false,
          requiresApproval: true,
          approvalRequired: [],
          timeRestrictions: [],
          maxEventDuration: 90,
          allowedCategories: [EventCategory.FAMILY]
        },
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, child)
    })

    it('should request approval for child events', async () => {
      const eventId = 'test-event-1'
      const approvers = [parentId]

      await expect(
        familyCoordinator.requestApproval(eventId, childId, approvers)
      ).resolves.not.toThrow()
    })

    it('should process approval correctly', async () => {
      const eventId = 'test-event-1'
      const approvers = [parentId]

      await familyCoordinator.requestApproval(eventId, childId, approvers)

      await expect(
        familyCoordinator.processApproval(eventId, parentId, true, 'Approved for good behavior')
      ).resolves.not.toThrow()
    })

    it('should process rejection correctly', async () => {
      const eventId = 'test-event-1'
      const approvers = [parentId]

      await familyCoordinator.requestApproval(eventId, childId, approvers)

      await expect(
        familyCoordinator.processApproval(eventId, parentId, false, 'Not appropriate time')
      ).resolves.not.toThrow()
    })
  })

  describe('Event Listeners and Integration', () => {
    let familyId: string
    let parentId: string

    beforeEach(async () => {
      familyId = 'test-family-1'
      parentId = 'parent-1'

      await familyCoordinator.createFamily(familyId, parentId)
    })

    it('should emit family events correctly', async () => {
      const eventSpy = jest.fn()
      familyCoordinator.on('family:event', eventSpy)

      const member: FamilyMember = {
        userId: 'new-member',
        familyId,
        displayName: 'New Member',
        role: FamilyRole.TEEN,
        permissions: {} as any,
        visibility: {} as any,
        availability: {} as any,
        preferences: {} as any,
        isActive: true,
        joinedAt: new Date(),
        lastActiveAt: new Date()
      }

      await familyCoordinator.addFamilyMember(familyId, member)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: FamilyEventType.MEMBER_JOINED,
          familyId,
          userId: 'new-member'
        })
      )
    })

    it('should handle initialization and shutdown correctly', async () => {
      const newCoordinator = new FamilyCoordinatorImpl()

      await expect(newCoordinator.initialize()).resolves.not.toThrow()
      await expect(newCoordinator.shutdown()).resolves.not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent family operations', async () => {
      const nonExistentFamilyId = 'non-existent-family'

      await expect(
        familyCoordinator.addFamilyMember(nonExistentFamilyId, {} as FamilyMember)
      ).rejects.toThrow(`Family ${nonExistentFamilyId} not found`)

      await expect(
        familyCoordinator.getFamilySchedule(nonExistentFamilyId, {
          startTime: new Date(),
          endTime: new Date()
        })
      ).rejects.toThrow(`Family ${nonExistentFamilyId} not found`)
    })

    it('should handle non-existent member operations', async () => {
      const familyId = 'test-family-1'
      const parentId = 'parent-1'
      const nonExistentMemberId = 'non-existent-member'

      await familyCoordinator.createFamily(familyId, parentId)

      await expect(
        familyCoordinator.removeFamilyMember(familyId, nonExistentMemberId)
      ).rejects.toThrow(`Member ${nonExistentMemberId} not found in family ${familyId}`)
    })

    it('should handle non-existent event operations', async () => {
      const nonExistentEventId = 'non-existent-event'
      const userId = 'user-1'

      await expect(
        familyCoordinator.respondToFamilyEvent(nonExistentEventId, userId, {} as AttendeeResponse)
      ).rejects.toThrow(`Family event ${nonExistentEventId} not found`)

      await expect(
        familyCoordinator.trackAttendance(nonExistentEventId, userId, true)
      ).rejects.toThrow(`Family event ${nonExistentEventId} not found`)
    })

    it('should validate event content', async () => {
      const familyId = 'test-family-1'
      const parentId = 'parent-1'

      await familyCoordinator.createFamily(familyId, parentId)

      const invalidEvent: FamilyEvent = {
        id: '',
        title: '', // Empty title should be invalid
        description: 'Invalid event',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // End before start
        endTime: new Date(Date.now() + 60 * 60 * 1000),
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: false,
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
        approvalStatus: ApprovalStatus.AUTO_APPROVED,
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

      await expect(
        familyCoordinator.createFamilyEvent(invalidEvent, parentId)
      ).rejects.toThrow()
    })
  })
})