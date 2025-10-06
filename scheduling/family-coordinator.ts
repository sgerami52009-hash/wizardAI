// Family schedule coordination system

import { EventEmitter } from 'events'
import { 
  FamilyMember, 
  FamilyEvent, 
  FamilySchedule, 
  FamilyAvailability,
  CoordinationResult,
  FamilyMeetingTimeRequest,
  FamilyConflictResolution,
  FamilyRole,
  ApprovalStatus,
  ResponseType,
  AttendeeResponse,
  ConflictSeverity,
  ResolutionOption,
  ResolutionStrategy,
  FamilyEventType,
  FamilyCoordinationEvent,
  MemberPermissions,
  ApprovalType,
  NotificationRecord,
  FamilyNotificationType,
  NotificationMethod
} from './family-types'
import { 
  TimeRange, 
  TimeSlot, 
  ScheduleConflict, 
  ConflictResolution, 
  Priority,
  AvailabilityStatus,
  ConflictType
} from './types'
import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { scheduleEventBus } from './events'

export interface FamilyCoordinator {
  // Family management
  createFamily(familyId: string, creatorId: string): Promise<FamilySchedule>
  addFamilyMember(familyId: string, member: FamilyMember): Promise<void>
  removeFamilyMember(familyId: string, userId: string): Promise<void>
  updateMemberPermissions(familyId: string, userId: string, permissions: MemberPermissions): Promise<void>
  
  // Family event management
  createFamilyEvent(event: FamilyEvent, organizerId: string): Promise<CoordinationResult>
  updateFamilyEvent(eventId: string, changes: Partial<FamilyEvent>, userId: string): Promise<CoordinationResult>
  cancelFamilyEvent(eventId: string, userId: string, reason?: string): Promise<void>
  
  // Availability and scheduling
  checkFamilyAvailability(familyId: string, timeSlot: TimeSlot, memberIds: string[]): Promise<FamilyAvailability>
  suggestFamilyMeetingTimes(request: FamilyMeetingTimeRequest): Promise<TimeSlot[]>
  getFamilySchedule(familyId: string, timeRange: TimeRange): Promise<FamilySchedule>
  
  // RSVP and attendance
  respondToFamilyEvent(eventId: string, userId: string, response: AttendeeResponse): Promise<void>
  trackAttendance(eventId: string, userId: string, checkIn: boolean, timestamp?: Date): Promise<void>
  
  // Conflict management
  detectFamilyConflicts(familyId: string, event: FamilyEvent): Promise<FamilyConflictResolution[]>
  resolveFamilyConflict(conflictId: string, resolution: ResolutionOption, userId: string): Promise<void>
  
  // Permissions and approval
  requestApproval(eventId: string, requesterId: string, approverIds: string[]): Promise<void>
  processApproval(eventId: string, approverId: string, approved: boolean, reason?: string): Promise<void>
  
  // Notifications
  sendFamilyNotification(familyId: string, notification: NotificationRecord): Promise<void>
  
  // System management
  initialize(): Promise<void>
  shutdown(): Promise<void>
}

export class FamilyCoordinatorImpl extends EventEmitter implements FamilyCoordinator {
  private families: Map<string, FamilySchedule> = new Map()
  private familyEvents: Map<string, FamilyEvent> = new Map()
  private familyConflicts: Map<string, FamilyConflictResolution> = new Map()
  private pendingApprovals: Map<string, string[]> = new Map()
  private isInitialized: boolean = false

  constructor() {
    super()
    this.setupEventListeners()
  }

  async initialize(): Promise<void> {
    try {
      // Load existing family data
      await this.loadFamilyData()
      
      // Initialize conflict detection
      await this.initializeConflictDetection()
      
      // Start periodic tasks
      this.startPeriodicTasks()
      
      this.isInitialized = true
      
      // Emit initialization event
      scheduleEventBus.emit('family:coordinator:initialized', {
        timestamp: new Date(),
        familyCount: this.families.size
      })
    } catch (error) {
      throw new Error(`Failed to initialize FamilyCoordinator: ${error}`)
    }
  }

  async shutdown(): Promise<void> {
    try {
      // Save family data
      await this.saveFamilyData()
      
      // Stop periodic tasks
      this.stopPeriodicTasks()
      
      // Clear memory
      this.families.clear()
      this.familyEvents.clear()
      this.familyConflicts.clear()
      this.pendingApprovals.clear()
      
      this.isInitialized = false
    } catch (error) {
      console.error('Error during FamilyCoordinator shutdown:', error)
    }
  }

  async createFamily(familyId: string, creatorId: string): Promise<FamilySchedule> {
    this.ensureInitialized()
    
    if (this.families.has(familyId)) {
      throw new Error(`Family ${familyId} already exists`)
    }

    // Create family creator as parent
    const creator: FamilyMember = {
      userId: creatorId,
      familyId,
      displayName: `User ${creatorId}`,
      role: FamilyRole.PARENT,
      permissions: this.getDefaultPermissions(FamilyRole.PARENT),
      visibility: this.getDefaultVisibilitySettings(),
      availability: this.getDefaultAvailabilitySchedule(creatorId),
      preferences: this.getDefaultMemberPreferences(),
      isActive: true,
      joinedAt: new Date(),
      lastActiveAt: new Date()
    }

    const familySchedule: FamilySchedule = {
      familyId,
      members: [creator],
      sharedEvents: [],
      memberSchedules: new Map(),
      conflictResolutions: [],
      permissions: this.getDefaultFamilyPermissions(familyId),
      preferences: this.getDefaultFamilyPreferences(familyId),
      lastUpdated: new Date()
    }

    this.families.set(familyId, familySchedule)

    // Emit family creation event
    this.emitFamilyEvent({
      type: FamilyEventType.MEMBER_JOINED,
      familyId,
      userId: creatorId,
      timestamp: new Date(),
      data: { role: FamilyRole.PARENT, isCreator: true }
    })

    return familySchedule
  }

  async addFamilyMember(familyId: string, member: FamilyMember): Promise<void> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    // Check if member already exists
    const existingMember = family.members.find(m => m.userId === member.userId)
    if (existingMember) {
      throw new Error(`Member ${member.userId} already exists in family ${familyId}`)
    }

    // Set default permissions based on role
    member.permissions = member.permissions || this.getDefaultPermissions(member.role)
    member.visibility = member.visibility || this.getDefaultVisibilitySettings()
    member.availability = member.availability || this.getDefaultAvailabilitySchedule(member.userId)
    member.preferences = member.preferences || this.getDefaultMemberPreferences()
    member.familyId = familyId
    member.joinedAt = new Date()
    member.lastActiveAt = new Date()
    member.isActive = true

    family.members.push(member)
    family.lastUpdated = new Date()

    // Initialize member schedule
    family.memberSchedules.set(member.userId, {
      userId: member.userId,
      events: [],
      reminders: [],
      availability: member.availability,
      conflicts: [],
      lastSyncTime: new Date()
    })

    // Emit member joined event
    this.emitFamilyEvent({
      type: FamilyEventType.MEMBER_JOINED,
      familyId,
      userId: member.userId,
      timestamp: new Date(),
      data: { role: member.role }
    })
  }

  async removeFamilyMember(familyId: string, userId: string): Promise<void> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    const memberIndex = family.members.findIndex(m => m.userId === userId)
    if (memberIndex === -1) {
      throw new Error(`Member ${userId} not found in family ${familyId}`)
    }

    const member = family.members[memberIndex]
    
    // Check if this is the last parent
    const parentCount = family.members.filter(m => 
      m.role === FamilyRole.PARENT || m.role === FamilyRole.GUARDIAN
    ).length
    
    if ((member.role === FamilyRole.PARENT || member.role === FamilyRole.GUARDIAN) && parentCount <= 1) {
      throw new Error('Cannot remove the last parent/guardian from family')
    }

    // Remove member from family
    family.members.splice(memberIndex, 1)
    family.memberSchedules.delete(userId)
    family.lastUpdated = new Date()

    // Cancel or reassign events organized by this member
    await this.handleMemberRemovalEvents(familyId, userId)

    // Emit member left event
    this.emitFamilyEvent({
      type: FamilyEventType.MEMBER_LEFT,
      familyId,
      userId,
      timestamp: new Date(),
      data: { role: member.role }
    })
  }

  async updateMemberPermissions(familyId: string, userId: string, permissions: MemberPermissions): Promise<void> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    const member = family.members.find(m => m.userId === userId)
    if (!member) {
      throw new Error(`Member ${userId} not found in family ${familyId}`)
    }

    const previousPermissions = { ...member.permissions }
    member.permissions = permissions
    family.lastUpdated = new Date()

    // Emit permissions updated event
    this.emitFamilyEvent({
      type: FamilyEventType.PERMISSIONS_UPDATED,
      familyId,
      userId,
      timestamp: new Date(),
      data: { 
        previousPermissions, 
        newPermissions: permissions 
      }
    })
  }

  async createFamilyEvent(event: FamilyEvent, organizerId: string): Promise<CoordinationResult> {
    this.ensureInitialized()
    
    const family = this.families.get(event.familyId)
    if (!family) {
      throw new Error(`Family ${event.familyId} not found`)
    }

    const organizer = family.members.find(m => m.userId === organizerId)
    if (!organizer) {
      throw new Error(`Organizer ${organizerId} not found in family ${event.familyId}`)
    }

    // Check permissions
    if (!organizer.permissions.canCreateFamilyEvents) {
      throw new Error(`User ${organizerId} does not have permission to create family events`)
    }

    // Validate event content for child safety
    await this.validateEventContent(event)

    // Set event metadata
    event.id = this.generateEventId()
    event.organizerId = organizerId
    event.createdAt = new Date()
    event.updatedAt = new Date()
    event.attendeeResponses = new Map()
    event.approvalStatus = this.determineApprovalStatus(event, organizer)
    event.metadata = {
      createdBy: organizerId,
      lastModifiedBy: organizerId,
      approvalHistory: [],
      conflictHistory: [],
      notificationsSent: [],
      attendanceTracking: []
    }

    // Initialize attendee responses
    const allAttendees = [...event.requiredAttendees, ...event.optionalAttendees]
    allAttendees.forEach(attendeeId => {
      event.attendeeResponses.set(attendeeId, {
        userId: attendeeId,
        response: ResponseType.PENDING,
        responseTime: new Date()
      })
    })

    // Detect conflicts
    const conflicts = await this.detectFamilyConflicts(event.familyId, event)

    // Generate suggested alternatives if conflicts exist
    const suggestedAlternatives = conflicts.length > 0 
      ? await this.generateAlternativeTimeSlots(event)
      : []

    // Check if approval is required
    const approvalRequired = event.approvalStatus === ApprovalStatus.REQUIRES_APPROVAL
    const approvalRequiredFrom = approvalRequired 
      ? await this.getRequiredApprovers(event, organizer)
      : []

    // Store the event
    this.familyEvents.set(event.id, event)
    family.sharedEvents.push(event)
    family.lastUpdated = new Date()

    // Send notifications
    const notifications = await this.sendEventNotifications(event, FamilyNotificationType.EVENT_INVITATION)

    // Request approval if needed
    if (approvalRequired && approvalRequiredFrom.length > 0) {
      await this.requestApproval(event.id, organizerId, approvalRequiredFrom)
    }

    // Emit event creation
    this.emitFamilyEvent({
      type: FamilyEventType.FAMILY_EVENT_CREATED,
      familyId: event.familyId,
      userId: organizerId,
      eventId: event.id,
      timestamp: new Date(),
      data: { event }
    })

    return {
      success: true,
      eventId: event.id,
      confirmedAttendees: [],
      pendingAttendees: allAttendees,
      declinedAttendees: [],
      conflicts: conflicts.map(c => this.convertToScheduleConflict(c)),
      suggestedAlternatives,
      approvalRequired,
      approvalRequiredFrom,
      notifications
    }
  }

  async updateFamilyEvent(eventId: string, changes: Partial<FamilyEvent>, userId: string): Promise<CoordinationResult> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    const family = this.families.get(event.familyId)
    if (!family) {
      throw new Error(`Family ${event.familyId} not found`)
    }

    const member = family.members.find(m => m.userId === userId)
    if (!member) {
      throw new Error(`User ${userId} not found in family ${event.familyId}`)
    }

    // Check permissions
    const canModify = member.permissions.canModifyFamilyEvents || 
                     event.organizerId === userId ||
                     member.role === FamilyRole.PARENT ||
                     member.role === FamilyRole.GUARDIAN

    if (!canModify) {
      throw new Error(`User ${userId} does not have permission to modify this family event`)
    }

    // Apply changes
    const previousEvent = { ...event }
    Object.assign(event, changes)
    event.updatedAt = new Date()
    event.metadata.lastModifiedBy = userId

    // Validate updated content
    await this.validateEventContent(event)

    // Detect new conflicts
    const conflicts = await this.detectFamilyConflicts(event.familyId, event)

    // Send update notifications
    const notifications = await this.sendEventNotifications(event, FamilyNotificationType.EVENT_MODIFIED)

    // Emit event update
    this.emitFamilyEvent({
      type: FamilyEventType.FAMILY_EVENT_UPDATED,
      familyId: event.familyId,
      userId,
      eventId: event.id,
      timestamp: new Date(),
      data: { 
        previousEvent, 
        updatedEvent: event,
        changes: Object.keys(changes)
      }
    })

    return {
      success: true,
      eventId: event.id,
      confirmedAttendees: this.getAttendeesByResponse(event, ResponseType.ACCEPTED),
      pendingAttendees: this.getAttendeesByResponse(event, ResponseType.PENDING),
      declinedAttendees: this.getAttendeesByResponse(event, ResponseType.DECLINED),
      conflicts: conflicts.map(c => this.convertToScheduleConflict(c)),
      suggestedAlternatives: [],
      approvalRequired: false,
      approvalRequiredFrom: [],
      notifications
    }
  }

  async cancelFamilyEvent(eventId: string, userId: string, reason?: string): Promise<void> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    const family = this.families.get(event.familyId)
    if (!family) {
      throw new Error(`Family ${event.familyId} not found`)
    }

    const member = family.members.find(m => m.userId === userId)
    if (!member) {
      throw new Error(`User ${userId} not found in family ${event.familyId}`)
    }

    // Check permissions
    const canCancel = member.permissions.canDeleteFamilyEvents || 
                     event.organizerId === userId ||
                     member.role === FamilyRole.PARENT ||
                     member.role === FamilyRole.GUARDIAN

    if (!canCancel) {
      throw new Error(`User ${userId} does not have permission to cancel this family event`)
    }

    // Remove event from family schedule
    const eventIndex = family.sharedEvents.findIndex(e => e.id === eventId)
    if (eventIndex !== -1) {
      family.sharedEvents.splice(eventIndex, 1)
    }

    // Remove from events map
    this.familyEvents.delete(eventId)
    family.lastUpdated = new Date()

    // Send cancellation notifications
    await this.sendEventNotifications(event, FamilyNotificationType.EVENT_CANCELLED)

    // Emit event cancellation
    this.emitFamilyEvent({
      type: FamilyEventType.FAMILY_EVENT_CANCELLED,
      familyId: event.familyId,
      userId,
      eventId: event.id,
      timestamp: new Date(),
      data: { reason, cancelledBy: userId }
    })
  }

  async checkFamilyAvailability(familyId: string, timeSlot: TimeSlot, memberIds: string[]): Promise<FamilyAvailability> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    const timeRange: TimeRange = {
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime
    }

    const memberAvailability = new Map<string, TimeSlot[]>()
    const conflicts: ScheduleConflict[] = []

    // Check availability for each requested member
    for (const memberId of memberIds) {
      const member = family.members.find(m => m.userId === memberId)
      if (!member) {
        continue
      }

      const memberSchedule = family.memberSchedules.get(memberId)
      if (!memberSchedule) {
        continue
      }

      // Calculate member availability for the time range
      const availability = await this.calculateMemberAvailability(member, timeRange)
      memberAvailability.set(memberId, availability)

      // Check for conflicts
      const memberConflicts = await this.detectMemberConflicts(member, timeSlot)
      conflicts.push(...memberConflicts)
    }

    // Find common available slots
    const commonAvailableSlots = this.findCommonAvailableSlots(memberAvailability, timeSlot)

    // Generate suggested meeting times
    const suggestedMeetingTimes = await this.generateSuggestedMeetingTimes(
      familyId, 
      memberIds, 
      timeRange,
      60 // default 1 hour duration
    )

    return {
      familyId,
      timeRange,
      memberAvailability,
      commonAvailableSlots,
      conflicts,
      suggestedMeetingTimes,
      lastCalculated: new Date()
    }
  }

  async suggestFamilyMeetingTimes(request: FamilyMeetingTimeRequest): Promise<TimeSlot[]> {
    this.ensureInitialized()
    
    const family = this.families.get(request.familyId)
    if (!family) {
      throw new Error(`Family ${request.familyId} not found`)
    }

    const allMemberIds = [...request.requiredAttendees, ...request.optionalAttendees]
    const suggestedSlots: TimeSlot[] = []

    // For each preferred time range, find available slots
    for (const timeRange of request.preferredTimeRanges) {
      const slots = await this.findAvailableSlotsInRange(
        request.familyId,
        allMemberIds,
        timeRange,
        request.duration,
        request.constraints
      )
      suggestedSlots.push(...slots)
    }

    // Sort by preference score (considering member availability, conflicts, etc.)
    return this.rankMeetingTimeSlots(suggestedSlots, request)
  }

  async getFamilySchedule(familyId: string, timeRange: TimeRange): Promise<FamilySchedule> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    // Filter events within time range
    const filteredEvents = family.sharedEvents.filter(event => 
      this.isEventInTimeRange(event, timeRange)
    )

    // Update member schedules with current data
    for (const member of family.members) {
      const memberSchedule = family.memberSchedules.get(member.userId)
      if (memberSchedule) {
        // Filter member events within time range
        memberSchedule.events = memberSchedule.events.filter(event =>
          this.isEventInTimeRange(event, timeRange)
        )
        
        // Filter reminders within time range
        memberSchedule.reminders = memberSchedule.reminders.filter(reminder =>
          reminder.triggerTime >= timeRange.startTime && 
          reminder.triggerTime <= timeRange.endTime
        )
      }
    }

    return {
      ...family,
      sharedEvents: filteredEvents,
      lastUpdated: new Date()
    }
  }

  async respondToFamilyEvent(eventId: string, userId: string, response: AttendeeResponse): Promise<void> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    // Check if user is an attendee
    const isAttendee = event.requiredAttendees.includes(userId) || 
                      event.optionalAttendees.includes(userId)
    
    if (!isAttendee) {
      throw new Error(`User ${userId} is not an attendee of event ${eventId}`)
    }

    // Update response
    response.userId = userId
    response.responseTime = new Date()
    event.attendeeResponses.set(userId, response)
    event.updatedAt = new Date()

    // Emit RSVP event
    this.emitFamilyEvent({
      type: FamilyEventType.RSVP_RECEIVED,
      familyId: event.familyId,
      userId,
      eventId: event.id,
      timestamp: new Date(),
      data: { response: response.response, note: response.note }
    })

    // Send notification to organizer
    await this.notifyEventOrganizer(event, userId, response)
  }

  async trackAttendance(eventId: string, userId: string, checkIn: boolean, timestamp?: Date): Promise<void> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    const attendanceTime = timestamp || new Date()
    
    // Find or create attendance record
    let attendanceRecord = event.metadata.attendanceTracking.find(record => 
      record.userId === userId && record.eventId === eventId
    )

    if (!attendanceRecord) {
      attendanceRecord = {
        userId,
        eventId,
        expectedAttendance: event.requiredAttendees.includes(userId),
        checkInTime: undefined,
        checkOutTime: undefined,
        notes: undefined
      }
      event.metadata.attendanceTracking.push(attendanceRecord)
    }

    // Update attendance record
    if (checkIn) {
      attendanceRecord.checkInTime = attendanceTime
      attendanceRecord.actualAttendance = true
    } else {
      attendanceRecord.checkOutTime = attendanceTime
    }

    // Emit attendance event
    this.emitFamilyEvent({
      type: FamilyEventType.ATTENDANCE_RECORDED,
      familyId: event.familyId,
      userId,
      eventId: event.id,
      timestamp: attendanceTime,
      data: { 
        checkIn, 
        checkInTime: attendanceRecord.checkInTime,
        checkOutTime: attendanceRecord.checkOutTime
      }
    })
  }

  async detectFamilyConflicts(familyId: string, event: FamilyEvent): Promise<FamilyConflictResolution[]> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    const conflicts: FamilyConflictResolution[] = []
    const allAttendees = [...event.requiredAttendees, ...event.optionalAttendees]

    // Check for time conflicts with existing events
    for (const attendeeId of allAttendees) {
      const memberSchedule = family.memberSchedules.get(attendeeId)
      if (!memberSchedule) continue

      // Check conflicts with member's existing events
      const timeConflicts = memberSchedule.events.filter(existingEvent =>
        this.eventsOverlap(event, existingEvent)
      )

      for (const conflictingEvent of timeConflicts) {
        const conflict: FamilyConflictResolution = {
          conflictId: this.generateConflictId(),
          familyId,
          conflictType: ConflictType.TIME_OVERLAP,
          affectedMembers: [attendeeId],
          conflictingEvents: [event.id, conflictingEvent.id],
          detectedAt: new Date(),
          severity: this.calculateConflictSeverity(event, conflictingEvent),
          resolutionOptions: await this.generateResolutionOptions(event, conflictingEvent)
        }

        conflicts.push(conflict)
        this.familyConflicts.set(conflict.conflictId, conflict)
      }
    }

    // Check for permission conflicts
    const permissionConflicts = await this.detectPermissionConflicts(event, family)
    conflicts.push(...permissionConflicts)

    // Emit conflict detection events
    for (const conflict of conflicts) {
      this.emitFamilyEvent({
        type: FamilyEventType.CONFLICT_DETECTED,
        familyId,
        eventId: event.id,
        timestamp: new Date(),
        data: { conflict }
      })
    }

    return conflicts
  }

  async resolveFamilyConflict(conflictId: string, resolution: ResolutionOption, userId: string): Promise<void> {
    this.ensureInitialized()
    
    const conflict = this.familyConflicts.get(conflictId)
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`)
    }

    // Apply the resolution
    await this.applyConflictResolution(conflict, resolution, userId)

    // Update conflict record
    conflict.selectedResolution = resolution
    conflict.resolvedAt = new Date()
    conflict.resolvedBy = userId

    // Emit conflict resolution event
    this.emitFamilyEvent({
      type: FamilyEventType.CONFLICT_RESOLVED,
      familyId: conflict.familyId,
      timestamp: new Date(),
      data: { 
        conflictId, 
        resolution: resolution.strategy,
        resolvedBy: userId
      }
    })
  }

  async requestApproval(eventId: string, requesterId: string, approverIds: string[]): Promise<void> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    // Store pending approvals
    this.pendingApprovals.set(eventId, approverIds)

    // Send approval request notifications
    for (const approverId of approverIds) {
      await this.sendApprovalRequestNotification(event, requesterId, approverId)
    }

    // Emit approval request event
    this.emitFamilyEvent({
      type: FamilyEventType.APPROVAL_REQUESTED,
      familyId: event.familyId,
      userId: requesterId,
      eventId: event.id,
      timestamp: new Date(),
      data: { 
        approverIds,
        requestedBy: requesterId
      }
    })
  }

  async processApproval(eventId: string, approverId: string, approved: boolean, reason?: string): Promise<void> {
    this.ensureInitialized()
    
    const event = this.familyEvents.get(eventId)
    if (!event) {
      throw new Error(`Family event ${eventId} not found`)
    }

    const pendingApprovers = this.pendingApprovals.get(eventId) || []
    if (!pendingApprovers.includes(approverId)) {
      throw new Error(`User ${approverId} is not a pending approver for event ${eventId}`)
    }

    // Record approval decision
    event.metadata.approvalHistory.push({
      approverId,
      action: approved ? 'approved' : 'rejected',
      timestamp: new Date(),
      reason
    })

    // Remove from pending approvals
    const updatedPendingApprovers = pendingApprovers.filter(id => id !== approverId)
    
    if (approved) {
      // Add to approved list
      if (!event.approvedBy) {
        event.approvedBy = []
      }
      event.approvedBy.push(approverId)

      // Check if all required approvals are received
      if (updatedPendingApprovers.length === 0) {
        event.approvalStatus = ApprovalStatus.APPROVED
        this.pendingApprovals.delete(eventId)
      } else {
        this.pendingApprovals.set(eventId, updatedPendingApprovers)
      }

      // Emit approval granted event
      this.emitFamilyEvent({
        type: FamilyEventType.APPROVAL_GRANTED,
        familyId: event.familyId,
        userId: approverId,
        eventId: event.id,
        timestamp: new Date(),
        data: { 
          approvedBy: approverId,
          reason,
          allApproved: event.approvalStatus === ApprovalStatus.APPROVED
        }
      })
    } else {
      // Rejection - event is rejected
      event.approvalStatus = ApprovalStatus.REJECTED
      this.pendingApprovals.delete(eventId)

      // Emit approval denied event
      this.emitFamilyEvent({
        type: FamilyEventType.APPROVAL_DENIED,
        familyId: event.familyId,
        userId: approverId,
        eventId: event.id,
        timestamp: new Date(),
        data: { 
          rejectedBy: approverId,
          reason
        }
      })
    }

    event.updatedAt = new Date()
  }

  async sendFamilyNotification(familyId: string, notification: NotificationRecord): Promise<void> {
    this.ensureInitialized()
    
    const family = this.families.get(familyId)
    if (!family) {
      throw new Error(`Family ${familyId} not found`)
    }

    // Send notification through appropriate channels
    await this.deliverNotification(notification)

    // Record notification
    notification.sentAt = new Date()
    
    // Store notification in family events if related to an event
    if (notification.notificationId.startsWith('event_')) {
      const eventId = notification.notificationId.split('_')[1]
      const event = this.familyEvents.get(eventId)
      if (event) {
        event.metadata.notificationsSent.push(notification)
      }
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    // Listen for schedule changes that might affect family coordination
    scheduleEventBus.on('calendar:event:created', (data) => {
      this.handleMemberEventChange(data)
    })

    scheduleEventBus.on('calendar:event:updated', (data) => {
      this.handleMemberEventChange(data)
    })

    scheduleEventBus.on('calendar:event:deleted', (data) => {
      this.handleMemberEventChange(data)
    })
  }

  private async handleMemberEventChange(data: any): Promise<void> {
    // Check if this affects any family events
    // Recheck conflicts for affected families
    // This would be implemented to maintain family schedule consistency
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('FamilyCoordinator not initialized')
    }
  }

  private async loadFamilyData(): Promise<void> {
    // Load family data from storage
    // This would be implemented with actual storage backend
  }

  private async saveFamilyData(): Promise<void> {
    // Save family data to storage
    // This would be implemented with actual storage backend
  }

  private async initializeConflictDetection(): Promise<void> {
    // Initialize conflict detection algorithms
    // This would set up periodic conflict checking
  }

  private startPeriodicTasks(): void {
    // Start periodic tasks like conflict detection, cleanup, etc.
    // This would use setInterval or similar for periodic operations
  }

  private stopPeriodicTasks(): void {
    // Stop all periodic tasks
    // This would clear intervals and cleanup resources
  }

  private generateEventId(): string {
    return `family_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateConflictId(): string {
    return `family_conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getDefaultPermissions(role: FamilyRole): MemberPermissions {
    const basePermissions: MemberPermissions = {
      canCreateFamilyEvents: false,
      canModifyFamilyEvents: false,
      canDeleteFamilyEvents: false,
      canViewOtherSchedules: false,
      canModifyOtherSchedules: false,
      requiresApproval: true,
      approvalRequired: [ApprovalType.EVENT_CREATION],
      timeRestrictions: [],
      maxEventDuration: 120, // 2 hours
      allowedCategories: [EventCategory.FAMILY, EventCategory.PERSONAL]
    }

    switch (role) {
      case FamilyRole.PARENT:
      case FamilyRole.GUARDIAN:
        return {
          ...basePermissions,
          canCreateFamilyEvents: true,
          canModifyFamilyEvents: true,
          canDeleteFamilyEvents: true,
          canViewOtherSchedules: true,
          canModifyOtherSchedules: true,
          requiresApproval: false,
          approvalRequired: [],
          maxEventDuration: 480, // 8 hours
          allowedCategories: Object.values(EventCategory)
        }
      
      case FamilyRole.TEEN:
        return {
          ...basePermissions,
          canCreateFamilyEvents: true,
          canViewOtherSchedules: true,
          maxEventDuration: 240, // 4 hours
          allowedCategories: [
            EventCategory.FAMILY, 
            EventCategory.PERSONAL, 
            EventCategory.EDUCATION,
            EventCategory.ENTERTAINMENT
          ]
        }
      
      case FamilyRole.ADULT_CHILD:
        return {
          ...basePermissions,
          canCreateFamilyEvents: true,
          canModifyFamilyEvents: true,
          canViewOtherSchedules: true,
          requiresApproval: false,
          approvalRequired: [],
          maxEventDuration: 480, // 8 hours
          allowedCategories: Object.values(EventCategory)
        }
      
      default:
        return basePermissions
    }
  }

  private getDefaultVisibilitySettings(): any {
    // Return default visibility settings
    return {
      defaultVisibility: VisibilityLevel.FAMILY,
      shareWithFamily: true,
      shareCalendarDetails: true,
      shareLocationInfo: false,
      shareAvailability: true,
      hiddenCategories: [],
      privateKeywords: []
    }
  }

  private getDefaultAvailabilitySchedule(userId: string): any {
    // Return default availability schedule
    return {
      userId,
      timeSlots: [],
      defaultAvailability: AvailabilityStatus.AVAILABLE,
      recurringUnavailability: [],
      lastUpdated: new Date()
    }
  }

  private getDefaultMemberPreferences(): any {
    // Return default member preferences
    return {
      preferredMeetingTimes: [],
      blackoutTimes: [],
      notificationPreferences: {
        enableFamilyNotifications: true,
        notifyOnFamilyEvents: true,
        notifyOnConflicts: true,
        notifyOnInvitations: true,
        preferredNotificationMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
        quietHours: []
      },
      schedulingPreferences: {
        autoAcceptFamilyEvents: false,
        suggestAlternativeTimes: true,
        bufferTimeMinutes: 15,
        preferredEventDuration: 60,
        maxDailyEvents: 10,
        preferredDaysOff: [0, 6] // Sunday and Saturday
      },
      privacyPreferences: {
        shareDetailedSchedule: true,
        shareAvailabilityOnly: false,
        allowFamilyModifications: false,
        requireConfirmationForChanges: true,
        hidePersonalEvents: false
      }
    }
  }

  private getDefaultFamilyPermissions(familyId: string): any {
    // Return default family permissions
    return {
      familyId,
      defaultMemberPermissions: this.getDefaultPermissions(FamilyRole.CHILD),
      roleBasedPermissions: new Map(),
      customPermissions: new Map(),
      parentalControls: {
        enabled: true,
        requireApprovalForChildren: true,
        timeRestrictions: new Map(),
        contentFiltering: {
          enabled: true,
          blockedKeywords: [],
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
      },
      lastUpdated: new Date()
    }
  }

  private getDefaultFamilyPreferences(familyId: string): any {
    // Return default family preferences
    return {
      familyId,
      coordinationSettings: {
        autoResolveConflicts: false,
        suggestMeetingTimes: true,
        enableFamilyCalendar: true,
        shareAvailability: true,
        requireRSVP: true,
        defaultRSVPDeadlineHours: 24
      },
      notificationSettings: {
        enableFamilyNotifications: true,
        notificationMethods: [NotificationMethod.VOICE, NotificationMethod.VISUAL],
        quietHours: [],
        urgentNotificationOverride: true,
        batchNotifications: false,
        maxNotificationsPerHour: 10
      },
      privacySettings: {
        defaultEventVisibility: VisibilityLevel.FAMILY,
        allowMemberVisibilityOverride: true,
        shareLocationData: false,
        shareAttendanceData: true,
        externalSharingAllowed: false,
        dataRetentionDays: 365
      },
      schedulingDefaults: {
        defaultEventDuration: 60,
        defaultBufferTime: 15,
        defaultPriority: Priority.MEDIUM,
        defaultCategory: EventCategory.FAMILY,
        autoAcceptFamilyEvents: false,
        suggestOptimalTimes: true
      }
    }
  }

  private async validateEventContent(event: FamilyEvent): Promise<void> {
    // Validate event content for child safety
    // This would integrate with the safety validator
    // For now, basic validation
    if (!event.title || event.title.trim().length === 0) {
      throw new Error('Event title is required')
    }
    
    if (event.startTime >= event.endTime) {
      throw new Error('Event start time must be before end time')
    }
  }

  private determineApprovalStatus(event: FamilyEvent, organizer: FamilyMember): ApprovalStatus {
    // Determine if approval is required based on organizer permissions and event details
    if (organizer.permissions.requiresApproval) {
      if (organizer.permissions.approvalRequired.includes(ApprovalType.EVENT_CREATION)) {
        return ApprovalStatus.REQUIRES_APPROVAL
      }
    }
    
    return ApprovalStatus.AUTO_APPROVED
  }

  private async getRequiredApprovers(event: FamilyEvent, organizer: FamilyMember): Promise<string[]> {
    // Get list of users who need to approve this event
    const family = this.families.get(event.familyId)
    if (!family) return []

    // For children, parents/guardians need to approve
    if (organizer.role === FamilyRole.CHILD || organizer.role === FamilyRole.TEEN) {
      return family.members
        .filter(m => m.role === FamilyRole.PARENT || m.role === FamilyRole.GUARDIAN)
        .map(m => m.userId)
    }

    return []
  }

  private async sendEventNotifications(event: FamilyEvent, type: FamilyNotificationType): Promise<NotificationRecord[]> {
    // Send notifications to all attendees
    const notifications: NotificationRecord[] = []
    const allAttendees = [...event.requiredAttendees, ...event.optionalAttendees]

    for (const attendeeId of allAttendees) {
      if (attendeeId === event.organizerId) continue // Don't notify organizer

      const notification: NotificationRecord = {
        notificationId: `event_${event.id}_${attendeeId}`,
        recipientId: attendeeId,
        notificationType: type,
        sentAt: new Date(),
        deliveryMethod: NotificationMethod.VOICE, // Default method
        acknowledged: false
      }

      await this.deliverNotification(notification)
      notifications.push(notification)
    }

    return notifications
  }

  private async deliverNotification(notification: NotificationRecord): Promise<void> {
    // Deliver notification through appropriate channels
    // This would integrate with the notification dispatcher
    console.log(`Delivering notification ${notification.notificationId} to ${notification.recipientId}`)
  }

  private getAttendeesByResponse(event: FamilyEvent, responseType: ResponseType): string[] {
    const attendees: string[] = []
    
    event.attendeeResponses.forEach((response, userId) => {
      if (response.response === responseType) {
        attendees.push(userId)
      }
    })

    return attendees
  }

  private convertToScheduleConflict(familyConflict: FamilyConflictResolution): ScheduleConflict {
    // Convert family conflict to schedule conflict format
    return {
      id: familyConflict.conflictId,
      conflictType: familyConflict.conflictType,
      conflictingEvents: familyConflict.conflictingEvents,
      severity: familyConflict.severity as any,
      suggestedResolutions: [],
      detectedAt: familyConflict.detectedAt
    }
  }

  private async calculateMemberAvailability(member: FamilyMember, timeRange: TimeRange): Promise<TimeSlot[]> {
    // Calculate member availability within time range
    // This would check member's schedule, working hours, restrictions, etc.
    return [{
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      isAvailable: true
    }]
  }

  private async detectMemberConflicts(member: FamilyMember, timeSlot: TimeSlot): Promise<ScheduleConflict[]> {
    // Detect conflicts for a specific member
    return []
  }

  private findCommonAvailableSlots(memberAvailability: Map<string, TimeSlot[]>, requestedSlot: TimeSlot): TimeSlot[] {
    // Find time slots where all members are available
    const commonSlots: TimeSlot[] = []
    
    // Simple implementation - would need more sophisticated logic
    let allAvailable = true
    memberAvailability.forEach((slots) => {
      const hasAvailableSlot = slots.some(slot => 
        slot.isAvailable && 
        slot.startTime <= requestedSlot.startTime && 
        slot.endTime >= requestedSlot.endTime
      )
      if (!hasAvailableSlot) {
        allAvailable = false
      }
    })

    if (allAvailable) {
      commonSlots.push(requestedSlot)
    }

    return commonSlots
  }

  private async generateSuggestedMeetingTimes(
    familyId: string, 
    memberIds: string[], 
    timeRange: TimeRange, 
    duration: number
  ): Promise<TimeSlot[]> {
    // Generate suggested meeting times based on member availability
    return []
  }

  private async findAvailableSlotsInRange(
    familyId: string,
    memberIds: string[],
    timeRange: TimeRange,
    duration: number,
    constraints: any
  ): Promise<TimeSlot[]> {
    // Find available slots within a time range
    return []
  }

  private rankMeetingTimeSlots(slots: TimeSlot[], request: FamilyMeetingTimeRequest): TimeSlot[] {
    // Rank meeting time slots by preference
    return slots.sort((a, b) => {
      // Simple ranking - would implement more sophisticated scoring
      return a.startTime.getTime() - b.startTime.getTime()
    })
  }

  private isEventInTimeRange(event: CalendarEvent | FamilyEvent, timeRange: TimeRange): boolean {
    return event.startTime < timeRange.endTime && event.endTime > timeRange.startTime
  }

  private async handleMemberRemovalEvents(familyId: string, userId: string): Promise<void> {
    // Handle events organized by removed member
    const family = this.families.get(familyId)
    if (!family) return

    const eventsToHandle = family.sharedEvents.filter(event => event.organizerId === userId)
    
    for (const event of eventsToHandle) {
      // Cancel or reassign to another family member
      // For now, just cancel the events
      await this.cancelFamilyEvent(event.id, userId, 'Organizer left family')
    }
  }

  private emitFamilyEvent(event: FamilyCoordinationEvent): void {
    this.emit('family:event', event)
    scheduleEventBus.emit('family:coordination', event)
  }

  private eventsOverlap(event1: CalendarEvent | FamilyEvent, event2: CalendarEvent | FamilyEvent): boolean {
    return event1.startTime < event2.endTime && event1.endTime > event2.startTime
  }

  private calculateConflictSeverity(event1: CalendarEvent | FamilyEvent, event2: CalendarEvent | FamilyEvent): ConflictSeverity {
    // Calculate conflict severity based on event priorities, types, etc.
    const priority1 = (event1 as any).priority || Priority.MEDIUM
    const priority2 = (event2 as any).priority || Priority.MEDIUM
    
    if (priority1 === Priority.CRITICAL || priority2 === Priority.CRITICAL) {
      return ConflictSeverity.CRITICAL
    } else if (priority1 === Priority.HIGH || priority2 === Priority.HIGH) {
      return ConflictSeverity.HIGH
    } else {
      return ConflictSeverity.MEDIUM
    }
  }

  private async generateResolutionOptions(event1: CalendarEvent | FamilyEvent, event2: CalendarEvent | FamilyEvent): Promise<ResolutionOption[]> {
    // Generate resolution options for conflicts
    return [
      {
        id: 'reschedule_1',
        strategy: ResolutionStrategy.RESCHEDULE_EVENT,
        description: `Reschedule "${event1.title}"`,
        impact: {
          affectedEvents: 1,
          affectedMembers: 1,
          timeChanges: 1,
          cancellations: 0,
          newConflicts: 0,
          memberSatisfaction: 0.8
        },
        requiredActions: [],
        affectedMembers: [],
        estimatedEffort: 'low' as any
      }
    ]
  }

  private async detectPermissionConflicts(event: FamilyEvent, family: FamilySchedule): Promise<FamilyConflictResolution[]> {
    // Detect permission-related conflicts
    return []
  }

  private async applyConflictResolution(conflict: FamilyConflictResolution, resolution: ResolutionOption, userId: string): Promise<void> {
    // Apply the selected conflict resolution
    // This would implement the actual resolution logic
  }

  private async sendApprovalRequestNotification(event: FamilyEvent, requesterId: string, approverId: string): Promise<void> {
    // Send approval request notification
    const notification: NotificationRecord = {
      notificationId: `approval_${event.id}_${approverId}`,
      recipientId: approverId,
      notificationType: FamilyNotificationType.APPROVAL_REQUIRED,
      sentAt: new Date(),
      deliveryMethod: NotificationMethod.VOICE,
      acknowledged: false
    }

    await this.deliverNotification(notification)
  }

  private async notifyEventOrganizer(event: FamilyEvent, responderId: string, response: AttendeeResponse): Promise<void> {
    // Notify event organizer of RSVP response
    const notification: NotificationRecord = {
      notificationId: `rsvp_${event.id}_${responderId}`,
      recipientId: event.organizerId,
      notificationType: FamilyNotificationType.EVENT_REMINDER,
      sentAt: new Date(),
      deliveryMethod: NotificationMethod.VOICE,
      acknowledged: false
    }

    await this.deliverNotification(notification)
  }

  private async generateAlternativeTimeSlots(event: FamilyEvent): Promise<TimeSlot[]> {
    // Generate alternative time slots for conflicted events
    return []
  }
}

// Export singleton instance
export const familyCoordinator = new FamilyCoordinatorImpl()