// Calendar view generators for daily, weekly, and monthly displays
// Implements Requirements: 1.4, 7.3

import { 
  CalendarEvent, 
  CalendarView, 
  ViewType, 
  EventCategory, 
  Priority 
} from './types'
import { 
  TimeRange, 
  ScheduleConflict 
} from '../scheduling/types'
import { CalendarManager } from './manager'

/**
 * Calendar view generator for creating different calendar display formats
 * Requirement 1.4: Calendar view generation and event rendering
 * Requirement 7.3: Calendar navigation and date selection functionality
 */
export class CalendarViewGenerator {
  private calendarManager: CalendarManager

  constructor(calendarManager: CalendarManager) {
    this.calendarManager = calendarManager
  }

  /**
   * Generate daily calendar view
   */
  async generateDayView(date: Date, userId?: string): Promise<CalendarView> {
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    const timeRange: TimeRange = { startTime: startDate, endTime: endDate }
    const events = await this.calendarManager.getEventsInRange(timeRange, userId)
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    
    // Detect conflicts for the day
    const conflicts = await this.detectViewConflicts(sortedEvents, userId)

    return {
      type: ViewType.DAY,
      startDate,
      endDate,
      events: sortedEvents,
      conflicts
    }
  }

  /**
   * Generate weekly calendar view
   */
  async generateWeekView(weekStartDate: Date, userId?: string): Promise<CalendarView> {
    const startDate = new Date(weekStartDate)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(weekStartDate)
    endDate.setDate(endDate.getDate() + 6)
    endDate.setHours(23, 59, 59, 999)

    const timeRange: TimeRange = { startTime: startDate, endTime: endDate }
    const events = await this.calendarManager.getEventsInRange(timeRange, userId)
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    
    // Detect conflicts for the week
    const conflicts = await this.detectViewConflicts(sortedEvents, userId)

    return {
      type: ViewType.WEEK,
      startDate,
      endDate,
      events: sortedEvents,
      conflicts
    }
  }

  /**
   * Generate monthly calendar view
   */
  async generateMonthView(monthDate: Date, userId?: string): Promise<CalendarView> {
    const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
    endDate.setHours(23, 59, 59, 999)

    const timeRange: TimeRange = { startTime: startDate, endTime: endDate }
    const events = await this.calendarManager.getEventsInRange(timeRange, userId)
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    
    // Detect conflicts for the month
    const conflicts = await this.detectViewConflicts(sortedEvents, userId)

    return {
      type: ViewType.MONTH,
      startDate,
      endDate,
      events: sortedEvents,
      conflicts
    }
  }

  /**
   * Generate agenda view (list of upcoming events)
   */
  async generateAgendaView(startDate: Date, daysAhead: number = 30, userId?: string): Promise<CalendarView> {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysAhead)
    endDate.setHours(23, 59, 59, 999)

    const timeRange: TimeRange = { startTime: start, endTime: endDate }
    const events = await this.calendarManager.getEventsInRange(timeRange, userId)
    
    // Sort events by start time
    const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    
    // Detect conflicts for the agenda period
    const conflicts = await this.detectViewConflicts(sortedEvents, userId)

    return {
      type: ViewType.AGENDA,
      startDate: start,
      endDate,
      events: sortedEvents,
      conflicts
    }
  }

  /**
   * Get week start date (Monday) for a given date
   */
  getWeekStartDate(date: Date): Date {
    const weekStart = new Date(date)
    const dayOfWeek = weekStart.getDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0
    weekStart.setDate(weekStart.getDate() - daysToSubtract)
    weekStart.setHours(0, 0, 0, 0)
    return weekStart
  }

  /**
   * Get month start date for a given date
   */
  getMonthStartDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  /**
   * Navigate to next period based on view type
   */
  getNextPeriod(currentDate: Date, viewType: ViewType): Date {
    const nextDate = new Date(currentDate)
    
    switch (viewType) {
      case ViewType.DAY:
        nextDate.setDate(nextDate.getDate() + 1)
        break
      case ViewType.WEEK:
        nextDate.setDate(nextDate.getDate() + 7)
        break
      case ViewType.MONTH:
        nextDate.setMonth(nextDate.getMonth() + 1)
        break
      case ViewType.AGENDA:
        nextDate.setDate(nextDate.getDate() + 30)
        break
    }
    
    return nextDate
  }

  /**
   * Navigate to previous period based on view type
   */
  getPreviousPeriod(currentDate: Date, viewType: ViewType): Date {
    const prevDate = new Date(currentDate)
    
    switch (viewType) {
      case ViewType.DAY:
        prevDate.setDate(prevDate.getDate() - 1)
        break
      case ViewType.WEEK:
        prevDate.setDate(prevDate.getDate() - 7)
        break
      case ViewType.MONTH:
        prevDate.setMonth(prevDate.getMonth() - 1)
        break
      case ViewType.AGENDA:
        prevDate.setDate(prevDate.getDate() - 30)
        break
    }
    
    return prevDate
  }

  /**
   * Get calendar grid for month view (includes previous/next month dates)
   */
  getMonthGrid(monthDate: Date): Date[][] {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
    
    // Get the first Monday of the calendar grid
    const gridStart = new Date(firstDay)
    const firstDayOfWeek = firstDay.getDay()
    const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    gridStart.setDate(gridStart.getDate() - daysToSubtract)
    
    const grid: Date[][] = []
    let currentDate = new Date(gridStart)
    
    // Generate 6 weeks (42 days) to ensure full month coverage
    for (let week = 0; week < 6; week++) {
      const weekDates: Date[] = []
      
      for (let day = 0; day < 7; day++) {
        weekDates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      grid.push(weekDates)
      
      // Stop if we've covered the entire month and are in the next month
      if (currentDate > lastDay && currentDate.getDate() > 7) {
        break
      }
    }
    
    return grid
  }

  /**
   * Detect conflicts within a set of events for view display
   */
  private async detectViewConflicts(events: CalendarEvent[], userId?: string): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = []
    
    if (!userId) return conflicts
    
    for (let i = 0; i < events.length; i++) {
      const eventConflicts = await this.calendarManager.findConflicts(events[i], userId)
      conflicts.push(...eventConflicts)
    }
    
    // Remove duplicate conflicts
    const uniqueConflicts = conflicts.filter((conflict, index, self) => 
      index === self.findIndex(c => c.id === conflict.id)
    )
    
    return uniqueConflicts
  }
}

/**
 * Event renderer for optimized display of calendar events
 * Requirement 1.4: Event rendering and layout optimization
 */
export class EventRenderer {
  /**
   * Render event for day view with time slots
   */
  renderDayViewEvent(event: CalendarEvent, timeSlotHeight: number = 60): EventRenderData {
    const startHour = event.startTime.getHours()
    const startMinute = event.startTime.getMinutes()
    const endHour = event.endTime.getHours()
    const endMinute = event.endTime.getMinutes()
    
    const startPosition = (startHour * 60 + startMinute) * (timeSlotHeight / 60)
    const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
    const height = duration * (timeSlotHeight / 60)
    
    return {
      event,
      position: {
        top: startPosition,
        left: 0,
        width: 100,
        height: Math.max(height, 20) // Minimum height for visibility
      },
      displayText: this.getEventDisplayText(event),
      style: this.getEventStyle(event),
      isAllDay: event.allDay
    }
  }

  /**
   * Render event for week view with column layout
   */
  renderWeekViewEvent(event: CalendarEvent, dayColumn: number, timeSlotHeight: number = 60): EventRenderData {
    if (event.allDay) {
      return {
        event,
        position: {
          top: 0,
          left: dayColumn * (100 / 7),
          width: 100 / 7,
          height: 30
        },
        displayText: this.getEventDisplayText(event),
        style: this.getEventStyle(event),
        isAllDay: true
      }
    }
    
    const dayViewData = this.renderDayViewEvent(event, timeSlotHeight)
    return {
      ...dayViewData,
      position: {
        ...dayViewData.position,
        left: dayColumn * (100 / 7),
        width: 100 / 7
      }
    }
  }

  /**
   * Render event for month view (compact display)
   */
  renderMonthViewEvent(event: CalendarEvent): EventRenderData {
    return {
      event,
      position: {
        top: 0,
        left: 0,
        width: 100,
        height: 20
      },
      displayText: this.getCompactEventText(event),
      style: this.getEventStyle(event),
      isAllDay: event.allDay
    }
  }

  /**
   * Get event display text based on available space
   */
  private getEventDisplayText(event: CalendarEvent, maxLength: number = 50): string {
    let text = event.title
    
    if (!event.allDay) {
      const timeText = this.formatEventTime(event)
      text = `${timeText} ${event.title}`
    }
    
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + '...'
    }
    
    return text
  }

  /**
   * Get compact event text for month view
   */
  private getCompactEventText(event: CalendarEvent): string {
    const maxLength = 20
    let text = event.title
    
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + '...'
    }
    
    return text
  }

  /**
   * Format event time for display
   */
  private formatEventTime(event: CalendarEvent): string {
    const startTime = event.startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    const endTime = event.endTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    return `${startTime}-${endTime}`
  }

  /**
   * Get event styling based on category and priority
   */
  private getEventStyle(event: CalendarEvent): EventStyle {
    const baseStyle: EventStyle = {
      backgroundColor: this.getCategoryColor(event.category),
      borderColor: this.getPriorityBorderColor(event.priority),
      textColor: '#ffffff',
      borderWidth: this.getPriorityBorderWidth(event.priority),
      opacity: event.isPrivate ? 0.8 : 1.0
    }
    
    return baseStyle
  }

  /**
   * Get color based on event category
   */
  private getCategoryColor(category: EventCategory): string {
    const categoryColors: Record<EventCategory, string> = {
      [EventCategory.WORK]: '#3498db',
      [EventCategory.PERSONAL]: '#2ecc71',
      [EventCategory.FAMILY]: '#e74c3c',
      [EventCategory.EDUCATION]: '#f39c12',
      [EventCategory.HEALTH]: '#9b59b6',
      [EventCategory.ENTERTAINMENT]: '#1abc9c',
      [EventCategory.TRAVEL]: '#34495e',
      [EventCategory.OTHER]: '#95a5a6'
    }
    
    return categoryColors[category] || categoryColors[EventCategory.OTHER]
  }

  /**
   * Get border color based on priority
   */
  private getPriorityBorderColor(priority: Priority): string {
    const priorityColors: Record<Priority, string> = {
      [Priority.LOW]: '#bdc3c7',
      [Priority.MEDIUM]: '#f39c12',
      [Priority.HIGH]: '#e67e22',
      [Priority.CRITICAL]: '#c0392b'
    }
    
    return priorityColors[priority] || priorityColors[Priority.LOW]
  }

  /**
   * Get border width based on priority
   */
  private getPriorityBorderWidth(priority: Priority): number {
    const priorityWidths: Record<Priority, number> = {
      [Priority.LOW]: 1,
      [Priority.MEDIUM]: 2,
      [Priority.HIGH]: 3,
      [Priority.CRITICAL]: 4
    }
    
    return priorityWidths[priority] || 1
  }

  /**
   * Layout events to avoid overlaps in day/week view
   */
  layoutEventsForTimeView(events: CalendarEvent[], timeSlotHeight: number = 60): EventRenderData[] {
    const renderedEvents: EventRenderData[] = []
    const eventGroups = this.groupOverlappingEvents(events)
    
    for (const group of eventGroups) {
      const groupWidth = 100 / group.length
      
      group.forEach((event, index) => {
        const renderData = this.renderDayViewEvent(event, timeSlotHeight)
        renderData.position.left = index * groupWidth
        renderData.position.width = groupWidth - 1 // Small gap between events
        renderedEvents.push(renderData)
      })
    }
    
    return renderedEvents
  }

  /**
   * Group overlapping events for layout optimization
   */
  private groupOverlappingEvents(events: CalendarEvent[]): CalendarEvent[][] {
    const groups: CalendarEvent[][] = []
    const processed = new Set<string>()
    
    for (const event of events) {
      if (processed.has(event.id)) continue
      
      const group = [event]
      processed.add(event.id)
      
      // Find all events that overlap with this one
      for (const otherEvent of events) {
        if (processed.has(otherEvent.id)) continue
        
        if (this.eventsOverlap(event, otherEvent)) {
          group.push(otherEvent)
          processed.add(otherEvent.id)
        }
      }
      
      groups.push(group)
    }
    
    return groups
  }

  /**
   * Check if two events overlap in time
   */
  private eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return event1.startTime < event2.endTime && event2.startTime < event1.endTime
  }
}

// Interfaces for rendering data
export interface EventRenderData {
  event: CalendarEvent
  position: {
    top: number
    left: number
    width: number
    height: number
  }
  displayText: string
  style: EventStyle
  isAllDay: boolean
}

export interface EventStyle {
  backgroundColor: string
  borderColor: string
  textColor: string
  borderWidth: number
  opacity: number
}

/**
 * Calendar navigation helper
 * Requirement 7.3: Calendar navigation and date selection functionality
 */
export class CalendarNavigator {
  /**
   * Navigate to today
   */
  goToToday(): Date {
    return new Date()
  }

  /**
   * Navigate to specific date
   */
  goToDate(date: Date): Date {
    return new Date(date)
  }

  /**
   * Get date range for current view
   */
  getViewDateRange(date: Date, viewType: ViewType): TimeRange {
    let startDate: Date
    let endDate: Date
    
    switch (viewType) {
      case ViewType.DAY:
        startDate = new Date(date)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(date)
        endDate.setHours(23, 59, 59, 999)
        break
        
      case ViewType.WEEK:
        const weekStart = new Date(date)
        const dayOfWeek = weekStart.getDay()
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(weekStart.getDate() - daysToSubtract)
        weekStart.setHours(0, 0, 0, 0)
        
        startDate = weekStart
        endDate = new Date(weekStart)
        endDate.setDate(endDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
        break
        
      case ViewType.MONTH:
        startDate = new Date(date.getFullYear(), date.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
        endDate.setHours(23, 59, 59, 999)
        break
        
      case ViewType.AGENDA:
        startDate = new Date(date)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(date)
        endDate.setDate(endDate.getDate() + 30)
        endDate.setHours(23, 59, 59, 999)
        break
        
      default:
        startDate = new Date(date)
        endDate = new Date(date)
    }
    
    return { startTime: startDate, endTime: endDate }
  }

  /**
   * Check if date is in current month
   */
  isDateInCurrentMonth(date: Date, currentMonth: Date): boolean {
    return date.getMonth() === currentMonth.getMonth() && 
           date.getFullYear() === currentMonth.getFullYear()
  }

  /**
   * Check if date is today
   */
  isToday(date: Date): boolean {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  /**
   * Check if date is in the past
   */
  isPastDate(date: Date): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  /**
   * Get formatted date string for display
   */
  formatDateForDisplay(date: Date, viewType: ViewType): string {
    switch (viewType) {
      case ViewType.DAY:
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        
      case ViewType.WEEK:
        const weekEnd = new Date(date)
        weekEnd.setDate(weekEnd.getDate() + 6)
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        
      case ViewType.MONTH:
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long'
        })
        
      case ViewType.AGENDA:
        return `Agenda from ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        
      default:
        return date.toLocaleDateString()
    }
  }
}