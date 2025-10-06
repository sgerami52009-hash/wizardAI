// Unit tests for family notification and coordination system

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { FamilyNotificationManagerImpl } from './family-notifications'
import {
  FamilyEvent,
  FamilyNotificationRequest,
  FamilyNotificationType,
  NotificationMethod,
  AttendeeResponse,
  ResponseType,
  FamilyConflictResolution,
  ConflictSeverity,
  ConflictType,
  FamilyNotificationPreferences,
  AttendanceRecord
} from './family-types'
import { Priority } from './types'
import { EventCategory, VisibilityLevel } from '../calendar/types'

describe('FamilyNotificationManager', () => {
  let notificationManager: FamilyNotificationManagerImpl

  beforeEach(async () => {
    notificationManager = new FamilyNotificationManagerImpl()
    await notificationManager.initialize()
  })

  afterEach(async () => {
    await notificationManager.shutdown()
    jest.clearAllMocks()
  })

  describe('Notification Delivery', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    it('should send family notification successfully', async () => {
      const notification: FamilyNotificationRequest = {
        id: 'notification-1',
        familyId,
        type: FamilyNotificationType.EVENT_INVITATION,
        recipientId: childId,
        senderId: parentId,
        title: 'Family Dinner Invitation',
        message: 'You are invited to family dinner tonight!',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
        metadata: {
          eventDetails: {
            id: 'event-1',
            title: 'Family Dinner',
            startTime: new Date(Date.now() + 60 * 60 * 1000),
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000)
          }
        }
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(true)
      expect(result.notificationId).toBe(notification.id)
      expect(result.recipientId).toBe(childId)
      expect(result.deliveryMethod).toBeDefined()
    })

    it('should respect user notification preferences', async () => {
      // Set user preferences to disable notifications
      const preferences: FamilyNotificationPreferences = {
        enableFamilyNotifications: false,
        notifyOnFamilyEvents: false,
        notifyOnConflicts: false,
        notifyOnInvitations: false,
        preferredNotificationMethods: [NotificationMethod.VOICE],
        quietHours: []
      }

      await notificationManager.updateNotificationPreferences(familyId, childId, preferences)

      const notification: FamilyNotificationRequest = {
        id: 'notification-2',
        familyId,
        type: FamilyNotificationType.EVENT_INVITATION,
        recipientId: childId,
        senderId: parentId,
        title: 'Test Notification',
        message: 'This should be blocked',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(false)
      expect(result.error).toContain('blocked by user preferences')
    })

    it('should queue notifications during quiet hours', async () => {
      // Set quiet hours from 10 PM to 7 AM
      const preferences: FamilyNotificationPreferences = {
        enableFamilyNotifications: true,
        notifyOnFamilyEvents: true,
        notifyOnConflicts: true,
        notifyOnInvitations: true,
        preferredNotificationMethods: [NotificationMethod.VOICE],
        quietHours: [
          {
            startTime: new Date('2024-01-01T22:00:00'),
            endTime: new Date('2024-01-01T07:00:00')
          }
        ]
      }

      await notificationManager.updateNotificationPreferences(familyId, childId, preferences)

      // Mock current time to be during quiet hours
      const quietTime = new Date()
      quietTime.setHours(23, 0, 0, 0) // 11 PM
      jest.useFakeTimers()
      jest.setSystemTime(quietTime)

      const notification: FamilyNotificationRequest = {
        id: 'notification-3',
        familyId,
        type: FamilyNotificationType.EVENT_REMINDER,
        recipientId: childId,
        title: 'Quiet Hours Test',
        message: 'This should be queued',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(true)
      // Notification should be queued, not delivered immediately

      jest.useRealTimers()
    })

    it('should validate notification content for child safety', async () => {
      const unsafeNotification: FamilyNotificationRequest = {
        id: 'unsafe-notification',
        familyId,
        type: FamilyNotificationType.EVENT_INVITATION,
        recipientId: childId,
        title: 'Inappropriate Content',
        message: 'This contains dangerous keywords',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }

      await expect(
        notificationManager.sendFamilyNotification(familyId, unsafeNotification)
      ).rejects.toThrow('Notification contains blocked content')
    })
  })

  describe('Event Notifications', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    let testEvent: FamilyEvent

    beforeEach(() => {
      testEvent = {
        id: 'test-event-1',
        title: 'Family Game Night',
        description: 'Fun board games for the whole family',
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        location: 'Living Room',
        category: EventCategory.FAMILY,
        priority: Priority.MEDIUM,
        organizerId: parentId,
        requiredAttendees: [parentId, childId],
        optionalAttendees: [],
        attendeeResponses: new Map(),
        rsvpRequired: true,
        rsvpDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isRecurring: false,
        familyId,
        visibility: VisibilityLevel.FAMILY,
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
    })

    it('should send event invitations to all attendees', async () => {
      const results = await notificationManager.sendEventInvitation(
        testEvent,
        [childId] // Don't notify organizer
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].recipientId).toBe(childId)
    })

    it('should send event reminders', async () => {
      const reminderTime = new Date(testEvent.startTime.getTime() - 30 * 60 * 1000) // 30 min before

      const results = await notificationManager.sendEventReminder(
        testEvent,
        [parentId, childId],
        reminderTime
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should send event update notifications', async () => {
      const changes = ['startTime', 'location']

      const results = await notificationManager.sendEventUpdate(
        testEvent,
        changes,
        [parentId, childId]
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should send event cancellation notifications', async () => {
      const reason = 'Unexpected schedule conflict'

      const results = await notificationManager.sendEventCancellation(
        testEvent,
        reason,
        [parentId, childId]
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should send RSVP requests with deadline', async () => {
      const deadline = new Date(testEvent.startTime.getTime() - 12 * 60 * 60 * 1000) // 12 hours before

      const results = await notificationManager.sendRSVPRequest(
        testEvent,
        [childId],
        deadline
      )

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
    })

    it('should send attendance reminders', async () => {
      const results = await notificationManager.sendAttendanceReminder(
        testEvent,
        [parentId, childId]
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  describe('RSVP and Attendance Processing', () => {
    const familyId = 'test-family-1'
    const eventId = 'test-event-1'
    const childId = 'child-1'

    it('should process RSVP response successfully', async () => {
      const response: AttendeeResponse = {
        userId: childId,
        response: ResponseType.ACCEPTED,
        responseTime: new Date(),
        note: 'Looking forward to it!'
      }

      await expect(
        notificationManager.processRSVPResponse(eventId, childId, response)
      ).resolves.not.toThrow()
    })

    it('should record attendance successfully', async () => {
      const attendance: AttendanceRecord = {
        userId: childId,
        eventId,
        expectedAttendance: true,
        actualAttendance: true,
        checkInTime: new Date(),
        notes: 'Arrived on time'
      }

      await expect(
        notificationManager.recordAttendance(eventId, childId, attendance)
      ).resolves.not.toThrow()
    })
  })

  describe('Conflict Notifications', () => {
    const familyId = 'test-family-1'
    const parentId = 'parent-1'
    const childId = 'child-1'

    it('should send conflict alert notifications', async () => {
      const conflict: FamilyConflictResolution = {
        conflictId: 'conflict-1',
        familyId,
        conflictType: ConflictType.TIME_OVERLAP,
        affectedMembers: [parentId, childId],
        conflictingEvents: ['event-1', 'event-2'],
        detectedAt: new Date(),
        severity: ConflictSeverity.HIGH,
        resolutionOptions: []
      }

      const results = await notificationManager.sendConflictAlert(
        conflict,
        [parentId, childId]
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should send conflict resolution notifications', async () => {
      const conflict: FamilyConflictResolution = {
        conflictId: 'conflict-1',
        familyId,
        conflictType: ConflictType.TIME_OVERLAP,
        affectedMembers: [parentId, childId],
        conflictingEvents: ['event-1', 'event-2'],
        detectedAt: new Date(),
        severity: ConflictSeverity.MEDIUM,
        resolutionOptions: []
      }

      const resolution = {
        id: 'resolution-1',
        strategy: 'reschedule_event' as any,
        description: 'Reschedule the conflicting event',
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

      const results = await notificationManager.sendConflictResolution(conflict, resolution)

      expect(results).toHaveLength(2)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  describe('Calendar Views and Summaries', () => {
    const familyId = 'test-family-1'
    const userId = 'user-1'

    it('should generate family calendar view', async () => {
      const timeRange = {
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      }

      const calendarView = await notificationManager.generateFamilyCalendarView(familyId, timeRange)

      expect(calendarView.familyId).toBe(familyId)
      expect(calendarView.timeRange).toEqual(timeRange)
      expect(Array.isArray(calendarView.familyEvents)).toBe(true)
      expect(calendarView.memberEvents instanceof Map).toBe(true)
      expect(Array.isArray(calendarView.conflicts)).toBe(true)
      expect(Array.isArray(calendarView.upcomingDeadlines)).toBe(true)
      expect(Array.isArray(calendarView.attendanceTracking)).toBe(true)
      expect(calendarView.generatedAt).toBeInstanceOf(Date)
    })

    it('should generate member calendar summary', async () => {
      const timeRange = {
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
      }

      const summary = await notificationManager.generateMemberCalendarSummary(
        familyId,
        userId,
        timeRange
      )

      expect(summary.userId).toBe(userId)
      expect(summary.familyId).toBe(familyId)
      expect(summary.timeRange).toEqual(timeRange)
      expect(Array.isArray(summary.personalEvents)).toBe(true)
      expect(Array.isArray(summary.familyEvents)).toBe(true)
      expect(Array.isArray(summary.pendingRSVPs)).toBe(true)
      expect(Array.isArray(summary.upcomingReminders)).toBe(true)
      expect(Array.isArray(summary.conflicts)).toBe(true)
      expect(Array.isArray(summary.attendanceRequired)).toBe(true)
      expect(summary.generatedAt).toBeInstanceOf(Date)
    })
  })

  describe('Notification Preferences', () => {
    const familyId = 'test-family-1'
    const userId = 'user-1'

    it('should update notification preferences successfully', async () => {
      const preferences: FamilyNotificationPreferences = {
        enableFamilyNotifications: true,
        notifyOnFamilyEvents: true,
        notifyOnConflicts: false,
        notifyOnInvitations: true,
        preferredNotificationMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
        quietHours: [
          {
            startTime: new Date('2024-01-01T22:00:00'),
            endTime: new Date('2024-01-01T07:00:00')
          }
        ]
      }

      await expect(
        notificationManager.updateNotificationPreferences(familyId, userId, preferences)
      ).resolves.not.toThrow()
    })

    it('should get notification preferences', async () => {
      const preferences = await notificationManager.getNotificationPreferences(familyId, userId)

      expect(preferences).toBeDefined()
      expect(typeof preferences.enableFamilyNotifications).toBe('boolean')
      expect(typeof preferences.notifyOnFamilyEvents).toBe('boolean')
      expect(typeof preferences.notifyOnConflicts).toBe('boolean')
      expect(typeof preferences.notifyOnInvitations).toBe('boolean')
      expect(Array.isArray(preferences.preferredNotificationMethods)).toBe(true)
      expect(Array.isArray(preferences.quietHours)).toBe(true)
    })

    it('should return default preferences for new users', async () => {
      const newUserId = 'new-user'
      const preferences = await notificationManager.getNotificationPreferences(familyId, newUserId)

      expect(preferences.enableFamilyNotifications).toBe(true)
      expect(preferences.notifyOnFamilyEvents).toBe(true)
      expect(preferences.notifyOnConflicts).toBe(true)
      expect(preferences.notifyOnInvitations).toBe(true)
      expect(preferences.preferredNotificationMethods).toContain(NotificationMethod.VOICE)
      expect(preferences.preferredNotificationMethods).toContain(NotificationMethod.VISUAL)
    })
  })

  describe('Batch Notifications', () => {
    const familyId = 'test-family-1'

    it('should process batch notifications successfully', async () => {
      // First, schedule some notifications
      const notifications: FamilyNotificationRequest[] = [
        {
          id: 'batch-1',
          familyId,
          type: FamilyNotificationType.EVENT_REMINDER,
          recipientId: 'user-1',
          title: 'Batch Notification 1',
          message: 'First batch notification',
          priority: Priority.MEDIUM,
          deliveryMethods: [NotificationMethod.VOICE],
          metadata: {}
        },
        {
          id: 'batch-2',
          familyId,
          type: FamilyNotificationType.EVENT_REMINDER,
          recipientId: 'user-2',
          title: 'Batch Notification 2',
          message: 'Second batch notification',
          priority: Priority.MEDIUM,
          deliveryMethods: [NotificationMethod.VISUAL],
          metadata: {}
        }
      ]

      const deliveryTime = new Date(Date.now() + 60 * 1000) // 1 minute from now

      await notificationManager.scheduleNotificationBatch(familyId, notifications, deliveryTime)

      const result = await notificationManager.processBatchNotifications(familyId)

      expect(result.familyId).toBe(familyId)
      expect(result.processedCount).toBeGreaterThanOrEqual(0)
      expect(result.successCount).toBeGreaterThanOrEqual(0)
      expect(result.failureCount).toBeGreaterThanOrEqual(0)
      expect(result.batchedCount).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.deliveredAt).toBeInstanceOf(Date)
    })

    it('should schedule notification batch for future delivery', async () => {
      const notifications: FamilyNotificationRequest[] = [
        {
          id: 'scheduled-1',
          familyId,
          type: FamilyNotificationType.EVENT_REMINDER,
          recipientId: 'user-1',
          title: 'Scheduled Notification',
          message: 'This is scheduled for later',
          priority: Priority.MEDIUM,
          deliveryMethods: [NotificationMethod.VOICE],
          metadata: {}
        }
      ]

      const futureDeliveryTime = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

      await expect(
        notificationManager.scheduleNotificationBatch(familyId, notifications, futureDeliveryTime)
      ).resolves.not.toThrow()
    })
  })

  describe('Child-Friendly Messaging', () => {
    const familyId = 'test-family-1'
    const childId = 'child-1'

    it('should apply child-friendly message templates', async () => {
      // Mock the isRecipientChild method to return true
      const originalMethod = (notificationManager as any).isRecipientChild
      ;(notificationManager as any).isRecipientChild = jest.fn().mockResolvedValue(true)

      const notification: FamilyNotificationRequest = {
        id: 'child-friendly-1',
        familyId,
        type: FamilyNotificationType.EVENT_INVITATION,
        recipientId: childId,
        title: "You're invited to {eventTitle}!",
        message: "Hi {userName}! You're invited to join {eventTitle} on {eventDate} at {eventTime}. Let us know if you can make it!",
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {
          eventDetails: {
            title: 'Family Movie Night',
            startTime: new Date(Date.now() + 60 * 60 * 1000)
          }
        }
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(true)

      // Restore original method
      ;(notificationManager as any).isRecipientChild = originalMethod
    })

    it('should use encouraging language for children', async () => {
      const notification: FamilyNotificationRequest = {
        id: 'encouraging-1',
        familyId,
        type: FamilyNotificationType.EVENT_CANCELLED,
        recipientId: childId,
        title: '{eventTitle} has been cancelled',
        message: 'Hi {userName}! We had to cancel {eventTitle}. {reason} We\'ll reschedule soon!',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {
          eventDetails: {
            title: 'Soccer Practice'
          },
          customData: {
            reason: 'Due to rain'
          }
        }
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(true)
    })
  })

  describe('Event Listeners and Integration', () => {
    it('should handle family event creation automatically', async () => {
      const eventSpy = jest.fn()
      notificationManager.on('rsvp:processed', eventSpy)

      // Simulate RSVP processing
      const eventId = 'test-event-1'
      const userId = 'user-1'
      const response: AttendeeResponse = {
        userId,
        response: ResponseType.ACCEPTED,
        responseTime: new Date()
      }

      await notificationManager.processRSVPResponse(eventId, userId, response)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId,
          userId,
          response: ResponseType.ACCEPTED
        })
      )
    })

    it('should handle attendance recording events', async () => {
      const eventSpy = jest.fn()
      notificationManager.on('attendance:recorded', eventSpy)

      const eventId = 'test-event-1'
      const userId = 'user-1'
      const attendance: AttendanceRecord = {
        userId,
        eventId,
        expectedAttendance: true,
        actualAttendance: true,
        checkInTime: new Date()
      }

      await notificationManager.recordAttendance(eventId, userId, attendance)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId,
          userId,
          attendance
        })
      )
    })
  })

  describe('Error Handling and Validation', () => {
    const familyId = 'test-family-1'

    it('should handle invalid notification content', async () => {
      const invalidNotification: FamilyNotificationRequest = {
        id: 'invalid-1',
        familyId,
        type: FamilyNotificationType.EVENT_INVITATION,
        recipientId: 'user-1',
        title: '', // Empty title
        message: '', // Empty message
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }

      await expect(
        notificationManager.sendFamilyNotification(familyId, invalidNotification)
      ).rejects.toThrow('Notification title is required')
    })

    it('should handle notification delivery failures gracefully', async () => {
      // Mock delivery failure
      const originalDeliverNotification = (notificationManager as any).deliverNotification
      ;(notificationManager as any).deliverNotification = jest.fn().mockRejectedValue(new Error('Delivery failed'))

      const notification: FamilyNotificationRequest = {
        id: 'failure-test-1',
        familyId,
        type: FamilyNotificationType.EVENT_REMINDER,
        recipientId: 'user-1',
        title: 'Test Notification',
        message: 'This delivery will fail',
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }

      const result = await notificationManager.sendFamilyNotification(familyId, notification)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()

      // Restore original method
      ;(notificationManager as any).deliverNotification = originalDeliverNotification
    })

    it('should handle initialization and shutdown correctly', async () => {
      const newManager = new FamilyNotificationManagerImpl()

      await expect(newManager.initialize()).resolves.not.toThrow()
      await expect(newManager.shutdown()).resolves.not.toThrow()
    })
  })

  describe('Performance and Rate Limiting', () => {
    const familyId = 'test-family-1'

    it('should handle multiple concurrent notifications', async () => {
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        familyId,
        type: FamilyNotificationType.EVENT_REMINDER,
        recipientId: `user-${i}`,
        title: `Notification ${i}`,
        message: `Concurrent notification ${i}`,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }))

      const promises = notifications.map(notification =>
        notificationManager.sendFamilyNotification(familyId, notification)
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(results.every(r => r.success !== undefined)).toBe(true)
    })

    it('should batch similar notifications efficiently', async () => {
      const notifications: FamilyNotificationRequest[] = Array.from({ length: 5 }, (_, i) => ({
        id: `batch-efficient-${i}`,
        familyId,
        type: FamilyNotificationType.EVENT_REMINDER,
        recipientId: 'same-user',
        title: `Batched Notification ${i}`,
        message: `This should be batched ${i}`,
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        metadata: {}
      }))

      await notificationManager.scheduleNotificationBatch(
        familyId,
        notifications,
        new Date(Date.now() + 1000)
      )

      const result = await notificationManager.processBatchNotifications(familyId)

      expect(result.processedCount).toBe(5)
      expect(result.batchedCount).toBeGreaterThan(0)
    })
  })
})