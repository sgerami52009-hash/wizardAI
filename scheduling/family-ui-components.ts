// Family Schedule Coordination UI Components
// Child-friendly interface for family scheduling and coordination

import { EventEmitter } from 'events'
import { CalendarEvent } from '../calendar/types'
import { TimeRange, TimeSlot, ScheduleConflict } from './types'
import { UserPreferences, FamilyVisibilityLevel } from './configuration-manager'
import { UIComponent, UIElement, UIElementType, UIContent, UIAction, ChildFriendlyConfig } from './ui-components'

export interface FamilyMember {
  id: string
  name: string
  role: FamilyRole
  age?: number
  avatar?: string
  isOnline: boolean
  lastSeen?: Date
}

export enum FamilyRole {
  PARENT = 'parent',
  CHILD = 'child',
  GUARDIAN = 'guardian',
  CAREGIVER = 'caregiver'
}

export interface FamilyEvent {
  id: string
  title: string
  description: string
  startTime: Date
  endTime: Date
  organizer: FamilyMember
  requiredAttendees: FamilyMember[]
  optionalAttendees: FamilyMember[]
  location?: string
  category: string
  needsApproval: boolean
  approvals: Map<string, boolean>
  conflicts: ScheduleConflict[]
}

/**
 * Family Schedule Overview Component
 * Shows combined family calendar with member availability
 */
export class FamilyScheduleComponent extends EventEmitter implements UIComponent {
  private familyMembers: FamilyMember[] = []
  private familyEvents: FamilyEvent[] = []
  private currentTimeRange: TimeRange
  private userPreferences: UserPreferences
  private childFriendlyConfig: ChildFriendlyConfig
  private currentUserId: string
  
  constructor(
    userPreferences: UserPreferences,
    childFriendlyConfig: ChildFriendlyConfig,
    currentUserId: string
  ) {
    super()
    this.userPreferences = userPreferences
    this.childFriendlyConfig = childFriendlyConfig
    this.currentUserId = currentUserId
    
    // Default to current week
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    
    this.currentTimeRange = { start: startOfWeek, end: endOfWeek }
  }

  async render(): Promise<UIElement> {
    const content = await this.generateFamilyScheduleContent()
    
    return {
      id: 'family-schedule',
      type: UIElementType.FAMILY_SCHEDULE,
      content,
      accessibility: {
        ariaLabel: 'Family schedule overview',
        ariaDescription: `Family calendar showing ${this.familyMembers.length} members and ${this.familyEvents.length} events`,
        tabIndex: 0,
        screenReaderText: await this.generateScreenReaderText(),
        highContrastSupport: this.userPreferences.highContrastMode,
        largeTextSupport: this.userPreferences.largeText
      },
      childFriendly: true
    }
  }

  async update(data: { 
    members?: FamilyMember[], 
    events?: FamilyEvent[], 
    timeRange?: TimeRange 
  }): Promise<void> {
    if (data.members) {
      this.familyMembers = data.members
    }
    
    if (data.events) {
      this.familyEvents = data.events
    }
    
    if (data.timeRange) {
      this.currentTimeRange = data.timeRange
    }
    
    this.emit('updated', { 
      members: this.familyMembers, 
      events: this.familyEvents, 
      timeRange: this.currentTimeRange 
    })
  }

  async destroy(): Promise<void> {
    this.removeAllListeners()
  }

  isAccessible(): boolean {
    return true
  }

  async createFamilyEvent(eventData: Partial<FamilyEvent>): Promise<void> {
    this.emit('createFamilyEvent', eventData)
  }

  async checkFamilyAvailability(timeSlot: TimeSlot): Promise<void> {
    this.emit('checkAvailability', timeSlot)
  }

  private async generateFamilyScheduleContent(): Promise<UIContent> {
    const actions = await this.generateFamilyScheduleActions()
    
    return {
      html: await this.generateFamilyScheduleHTML(),
      text: await this.generateFamilyScheduleText(),
      actions
    }
  }

  private async generateFamilyScheduleHTML(): Promise<string> {
    const cssClasses = this.getFamilyScheduleCSSClasses()
    
    return `
      <div class="${cssClasses.container}">
        <div class="${cssClasses.header}">
          <h2 class="${cssClasses.title}">
            ${this.getFamilyScheduleTitle()}
          </h2>
          <div class="${cssClasses.timeRange}">
            ${this.formatTimeRange()}
          </div>
        </div>
        
        <div class="${cssClasses.membersList}">
          ${await this.generateFamilyMembersHTML()}
        </div>
        
        <div class="${cssClasses.schedule}">
          ${await this.generateFamilyEventsHTML()}
        </div>
        
        ${await this.generateAvailabilityOverviewHTML()}
        
        ${this.childFriendlyConfig.showHelpText ? await this.generateFamilyScheduleHelp() : ''}
      </div>
    `
  }

  private async generateFamilyScheduleText(): Promise<string> {
    const title = this.getFamilyScheduleTitle()
    const memberCount = this.familyMembers.length
    const eventCount = this.getEventsInRange().length
    
    return `${title}\n\n${memberCount} family members, ${eventCount} events this week`
  }

  private async generateFamilyScheduleActions(): Promise<UIAction[]> {
    const currentMember = this.familyMembers.find(m => m.id === this.currentUserId)
    const isParent = currentMember?.role === FamilyRole.PARENT || currentMember?.role === FamilyRole.GUARDIAN
    
    const actions: UIAction[] = [
      {
        id: 'add-family-event',
        label: this.getChildFriendlyLabel('Plan Family Activity'),
        icon: 'calendar-plus',
        handler: async () => this.emit('addFamilyEvent'),
        accessibility: {
          ariaLabel: 'Create a new family activity',
          tabIndex: 1,
          keyboardShortcut: 'Ctrl+F',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'check-availability',
        label: this.getChildFriendlyLabel('When is Everyone Free?'),
        icon: 'clock',
        handler: async () => this.emit('checkFamilyAvailability'),
        accessibility: {
          ariaLabel: 'Check when all family members are available',
          tabIndex: 2,
          keyboardShortcut: 'Ctrl+A',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      }
    ]

    // Add parent-only actions
    if (isParent) {
      actions.push({
        id: 'manage-permissions',
        label: this.getChildFriendlyLabel('Family Settings'),
        icon: 'settings',
        handler: async () => this.emit('manageFamilySettings'),
        accessibility: {
          ariaLabel: 'Manage family calendar settings and permissions',
          tabIndex: 3,
          keyboardShortcut: 'Ctrl+S',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      })
    }

    return actions
  }

  private getFamilyScheduleTitle(): string {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return "Our Family's Schedule"
    }
    return 'Family Calendar'
  }

  private getChildFriendlyLabel(label: string): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return label
    }

    const childFriendlyLabels: Record<string, string> = {
      'Plan Family Activity': 'Plan Something Fun Together',
      'When is Everyone Free?': 'Find Free Time',
      'Family Settings': 'Family Rules'
    }

    return childFriendlyLabels[label] || label
  }

  private getFamilyScheduleCSSClasses(): Record<string, string> {
    const baseClasses = {
      container: 'family-schedule-container',
      header: 'family-schedule-header',
      title: 'family-schedule-title',
      timeRange: 'family-schedule-time-range',
      membersList: 'family-members-list',
      schedule: 'family-schedule-grid',
      availability: 'family-availability-overview'
    }

    if (this.userPreferences.highContrastMode) {
      Object.keys(baseClasses).forEach(key => {
        baseClasses[key as keyof typeof baseClasses] += ' high-contrast'
      })
    }

    if (this.userPreferences.largeText) {
      Object.keys(baseClasses).forEach(key => {
        baseClasses[key as keyof typeof baseClasses] += ' large-text'
      })
    }

    return baseClasses
  }

  private async generateFamilyMembersHTML(): Promise<string> {
    if (this.familyMembers.length === 0) {
      return `<div class="no-members">No family members found</div>`
    }

    const memberCards = this.familyMembers.map(member => this.generateMemberCardHTML(member))
    
    return `
      <div class="family-members-grid">
        ${memberCards.join('')}
      </div>
    `
  }

  private generateMemberCardHTML(member: FamilyMember): string {
    const statusClass = member.isOnline ? 'online' : 'offline'
    const roleLabel = this.getChildFriendlyRoleLabel(member.role)
    
    return `
      <div class="family-member-card ${statusClass}" data-member-id="${member.id}">
        <div class="member-avatar">
          ${member.avatar ? `<img src="${member.avatar}" alt="${member.name}'s avatar" />` : '👤'}
        </div>
        <div class="member-info">
          <div class="member-name">${this.sanitizeText(member.name)}</div>
          <div class="member-role">${roleLabel}</div>
          <div class="member-status">
            ${member.isOnline ? 
              (this.childFriendlyConfig.useSimpleLanguage ? 'Here now' : 'Online') : 
              (this.childFriendlyConfig.useSimpleLanguage ? 'Away' : 'Offline')
            }
          </div>
        </div>
        <div class="member-actions">
          <button 
            class="view-schedule-btn"
            data-member-id="${member.id}"
            aria-label="View ${member.name}'s schedule"
          >
            ${this.childFriendlyConfig.useSimpleLanguage ? 'See Schedule' : 'View Schedule'}
          </button>
        </div>
      </div>
    `
  }

  private async generateFamilyEventsHTML(): Promise<string> {
    const eventsInRange = this.getEventsInRange()
    
    if (eventsInRange.length === 0) {
      return this.generateNoEventsHTML()
    }

    // Group events by day
    const eventsByDay = this.groupEventsByDay(eventsInRange)
    
    return Object.entries(eventsByDay)
      .map(([date, events]) => this.generateDayEventsHTML(date, events))
      .join('')
  }

  private generateDayEventsHTML(date: string, events: FamilyEvent[]): string {
    const dayLabel = this.formatDayLabel(new Date(date))
    
    const eventCards = events.map(event => this.generateFamilyEventHTML(event))
    
    return `
      <div class="family-day-section">
        <h3 class="day-header">${dayLabel}</h3>
        <div class="day-events">
          ${eventCards.join('')}
        </div>
      </div>
    `
  }

  private generateFamilyEventHTML(event: FamilyEvent): string {
    const timeDisplay = this.formatEventTime(event)
    const attendeeCount = event.requiredAttendees.length + event.optionalAttendees.length
    const hasConflicts = event.conflicts.length > 0
    const needsApproval = event.needsApproval && !this.isEventApproved(event)
    
    return `
      <div class="family-event-card ${hasConflicts ? 'has-conflicts' : ''} ${needsApproval ? 'needs-approval' : ''}" 
           data-event-id="${event.id}">
        <div class="event-header">
          <div class="event-title">${this.sanitizeText(event.title)}</div>
          <div class="event-time">${timeDisplay}</div>
        </div>
        
        <div class="event-details">
          ${event.description ? `<div class="event-description">${this.sanitizeText(event.description)}</div>` : ''}
          ${event.location ? `<div class="event-location">📍 ${this.sanitizeText(event.location)}</div>` : ''}
        </div>
        
        <div class="event-attendees">
          <div class="attendee-count">
            ${this.childFriendlyConfig.useSimpleLanguage ? 
              `${attendeeCount} family member${attendeeCount !== 1 ? 's' : ''}` :
              `${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}`
            }
          </div>
          <div class="attendee-avatars">
            ${this.generateAttendeeAvatarsHTML(event)}
          </div>
        </div>
        
        ${hasConflicts ? this.generateConflictWarningHTML(event.conflicts) : ''}
        ${needsApproval ? this.generateApprovalStatusHTML(event) : ''}
        
        <div class="event-actions">
          ${this.generateEventActionButtonsHTML(event)}
        </div>
      </div>
    `
  }

  private generateAttendeeAvatarsHTML(event: FamilyEvent): string {
    const allAttendees = [...event.requiredAttendees, ...event.optionalAttendees]
    const maxVisible = 4
    
    const visibleAttendees = allAttendees.slice(0, maxVisible)
    const remainingCount = allAttendees.length - maxVisible
    
    const avatars = visibleAttendees.map(attendee => 
      `<div class="attendee-avatar" title="${attendee.name}">
        ${attendee.avatar ? `<img src="${attendee.avatar}" alt="${attendee.name}" />` : '👤'}
      </div>`
    ).join('')
    
    const remaining = remainingCount > 0 ? 
      `<div class="attendee-count-more">+${remainingCount}</div>` : ''
    
    return avatars + remaining
  }

  private generateConflictWarningHTML(conflicts: ScheduleConflict[]): string {
    const conflictCount = conflicts.length
    const message = this.childFriendlyConfig.useSimpleLanguage ?
      `Uh oh! ${conflictCount} scheduling problem${conflictCount !== 1 ? 's' : ''}` :
      `${conflictCount} scheduling conflict${conflictCount !== 1 ? 's' : ''}`
    
    return `
      <div class="conflict-warning">
        <div class="conflict-icon">⚠️</div>
        <div class="conflict-message">${message}</div>
        <button class="resolve-conflicts-btn" data-event-id="${conflicts[0]?.eventId}">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Fix This' : 'Resolve'}
        </button>
      </div>
    `
  }

  private generateApprovalStatusHTML(event: FamilyEvent): string {
    const approvalCount = Array.from(event.approvals.values()).filter(approved => approved).length
    const totalRequired = this.familyMembers.filter(m => 
      m.role === FamilyRole.PARENT || m.role === FamilyRole.GUARDIAN
    ).length
    
    const message = this.childFriendlyConfig.useSimpleLanguage ?
      `Waiting for parent approval (${approvalCount}/${totalRequired})` :
      `Pending approval (${approvalCount}/${totalRequired})`
    
    return `
      <div class="approval-status">
        <div class="approval-icon">⏳</div>
        <div class="approval-message">${message}</div>
      </div>
    `
  }

  private generateEventActionButtonsHTML(event: FamilyEvent): string {
    const currentMember = this.familyMembers.find(m => m.id === this.currentUserId)
    const isOrganizer = event.organizer.id === this.currentUserId
    const isParent = currentMember?.role === FamilyRole.PARENT || currentMember?.role === FamilyRole.GUARDIAN
    const canApprove = isParent && event.needsApproval && !this.isEventApproved(event)
    
    const buttons: string[] = []
    
    // View details button (always available)
    buttons.push(`
      <button 
        class="event-action-btn view-btn"
        data-action="view"
        data-event-id="${event.id}"
        aria-label="View event details"
      >
        ${this.childFriendlyConfig.useSimpleLanguage ? 'Details' : 'View'}
      </button>
    `)
    
    // Edit button (organizer or parent)
    if (isOrganizer || isParent) {
      buttons.push(`
        <button 
          class="event-action-btn edit-btn"
          data-action="edit"
          data-event-id="${event.id}"
          aria-label="Edit event"
        >
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Change' : 'Edit'}
        </button>
      `)
    }
    
    // Approval button (parents only)
    if (canApprove) {
      buttons.push(`
        <button 
          class="event-action-btn approve-btn"
          data-action="approve"
          data-event-id="${event.id}"
          aria-label="Approve event"
        >
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Say Yes' : 'Approve'}
        </button>
      `)
    }
    
    return buttons.join('')
  }

  private generateNoEventsHTML(): string {
    const message = this.childFriendlyConfig.useSimpleLanguage ?
      "No family activities planned for this week. Want to plan something fun?" :
      "No family events scheduled for this period."
    
    return `
      <div class="no-family-events">
        <div class="no-events-icon">📅</div>
        <div class="no-events-message">${message}</div>
        <button class="add-family-event-btn" data-action="add-family-event">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Plan Something Fun' : 'Add Family Event'}
        </button>
      </div>
    `
  }

  private async generateAvailabilityOverviewHTML(): Promise<string> {
    const availableSlots = await this.findCommonAvailableSlots()
    
    if (availableSlots.length === 0) {
      return `
        <div class="availability-overview">
          <h3>Family Availability</h3>
          <div class="no-availability">
            ${this.childFriendlyConfig.useSimpleLanguage ? 
              "Looks like everyone's pretty busy this week!" :
              "No common available time slots found"
            }
          </div>
        </div>
      `
    }
    
    const slotCards = availableSlots.slice(0, 3).map(slot => this.generateAvailabilitySlotHTML(slot))
    
    return `
      <div class="availability-overview">
        <h3>${this.childFriendlyConfig.useSimpleLanguage ? 'When Everyone is Free' : 'Common Availability'}</h3>
        <div class="availability-slots">
          ${slotCards.join('')}
        </div>
      </div>
    `
  }

  private generateAvailabilitySlotHTML(slot: TimeSlot): string {
    const dayLabel = this.formatDayLabel(slot.start)
    const timeRange = this.formatTimeSlot(slot)
    
    return `
      <div class="availability-slot" data-start="${slot.start.toISOString()}" data-end="${slot.end.toISOString()}">
        <div class="slot-day">${dayLabel}</div>
        <div class="slot-time">${timeRange}</div>
        <button 
          class="plan-activity-btn"
          data-action="plan-activity"
          data-slot-start="${slot.start.toISOString()}"
          data-slot-end="${slot.end.toISOString()}"
        >
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Plan Activity' : 'Schedule Event'}
        </button>
      </div>
    `
  }

  private async generateFamilyScheduleHelp(): Promise<string> {
    return `
      <div class="family-schedule-help">
        <h4>${this.childFriendlyConfig.useSimpleLanguage ? 'How to use the family calendar:' : 'Family Calendar Help:'}</h4>
        <ul>
          <li>${this.childFriendlyConfig.useSimpleLanguage ? 'See what everyone in your family is doing' : 'View all family members\' schedules'}</li>
          <li>${this.childFriendlyConfig.useSimpleLanguage ? 'Plan fun activities together' : 'Create family events and activities'}</li>
          <li>${this.childFriendlyConfig.useSimpleLanguage ? 'Find times when everyone is free' : 'Check family availability'}</li>
          <li>${this.childFriendlyConfig.useSimpleLanguage ? 'Ask parents before adding big events' : 'Get parental approval for events'}</li>
        </ul>
      </div>
    `
  }

  private getChildFriendlyRoleLabel(role: FamilyRole): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return role.charAt(0).toUpperCase() + role.slice(1)
    }

    const roleLabels: Record<FamilyRole, string> = {
      [FamilyRole.PARENT]: 'Mom/Dad',
      [FamilyRole.CHILD]: 'Kid',
      [FamilyRole.GUARDIAN]: 'Guardian',
      [FamilyRole.CAREGIVER]: 'Caregiver'
    }

    return roleLabels[role] || role
  }

  private formatTimeRange(): string {
    const start = this.currentTimeRange.start.toLocaleDateString(
      this.userPreferences.voiceLanguage || 'en-US',
      { month: 'short', day: 'numeric' }
    )
    const end = this.currentTimeRange.end.toLocaleDateString(
      this.userPreferences.voiceLanguage || 'en-US',
      { month: 'short', day: 'numeric' }
    )
    
    return `${start} - ${end}`
  }

  private formatDayLabel(date: Date): string {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (this.isSameDay(date, today)) {
      return this.childFriendlyConfig.useSimpleLanguage ? 'Today' : 'Today'
    } else if (this.isSameDay(date, tomorrow)) {
      return this.childFriendlyConfig.useSimpleLanguage ? 'Tomorrow' : 'Tomorrow'
    } else {
      return date.toLocaleDateString(
        this.userPreferences.voiceLanguage || 'en-US',
        { weekday: 'long', month: 'short', day: 'numeric' }
      )
    }
  }

  private formatEventTime(event: FamilyEvent): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    const startTime = event.startTime.toLocaleTimeString(
      this.userPreferences.voiceLanguage || 'en-US',
      options
    )
    
    if (this.isSameDay(event.startTime, event.endTime)) {
      const endTime = event.endTime.toLocaleTimeString(
        this.userPreferences.voiceLanguage || 'en-US',
        options
      )
      return `${startTime} - ${endTime}`
    }
    
    return startTime
  }

  private formatTimeSlot(slot: TimeSlot): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    const startTime = slot.start.toLocaleTimeString(
      this.userPreferences.voiceLanguage || 'en-US',
      options
    )
    const endTime = slot.end.toLocaleTimeString(
      this.userPreferences.voiceLanguage || 'en-US',
      options
    )
    
    return `${startTime} - ${endTime}`
  }

  private getEventsInRange(): FamilyEvent[] {
    return this.familyEvents.filter(event =>
      event.startTime >= this.currentTimeRange.start &&
      event.startTime <= this.currentTimeRange.end
    )
  }

  private groupEventsByDay(events: FamilyEvent[]): Record<string, FamilyEvent[]> {
    const grouped: Record<string, FamilyEvent[]> = {}
    
    events.forEach(event => {
      const dateKey = event.startTime.toISOString().split('T')[0]
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(event)
    })
    
    // Sort events within each day by start time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    })
    
    return grouped
  }

  private async findCommonAvailableSlots(): Promise<TimeSlot[]> {
    // Mock implementation - in real app, this would check all family members' calendars
    const slots: TimeSlot[] = []
    
    // Generate some sample available slots
    const now = new Date()
    for (let i = 1; i <= 7; i++) {
      const date = new Date(now)
      date.setDate(now.getDate() + i)
      
      // Morning slot
      const morningStart = new Date(date)
      morningStart.setHours(10, 0, 0, 0)
      const morningEnd = new Date(date)
      morningEnd.setHours(12, 0, 0, 0)
      
      slots.push({ start: morningStart, end: morningEnd })
      
      // Evening slot
      const eveningStart = new Date(date)
      eveningStart.setHours(18, 0, 0, 0)
      const eveningEnd = new Date(date)
      eveningEnd.setHours(20, 0, 0, 0)
      
      slots.push({ start: eveningStart, end: eveningEnd })
    }
    
    return slots.slice(0, 5) // Return first 5 slots
  }

  private isEventApproved(event: FamilyEvent): boolean {
    const requiredApprovers = this.familyMembers.filter(m => 
      m.role === FamilyRole.PARENT || m.role === FamilyRole.GUARDIAN
    )
    
    return requiredApprovers.every(approver => 
      event.approvals.get(approver.id) === true
    )
  }

  private async generateScreenReaderText(): Promise<string> {
    const memberCount = this.familyMembers.length
    const eventCount = this.getEventsInRange().length
    
    return `Family schedule with ${memberCount} members and ${eventCount} events for the selected time period`
  }

  private sanitizeText(text: string): string {
    // Basic HTML sanitization for child safety
    return text.replace(/[<>]/g, '')
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }
}