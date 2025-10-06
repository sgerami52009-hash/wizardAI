// Unit tests for calendar view generators and display systems
// Tests Requirements: 1.4, 7.3

import { CalendarViewGenerator, EventRenderer, CalendarNavigator } from './view-generator'
import { EventDetailDisplay, EventEditor } from './event-interface'
import { CalendarManager } from './manager'
import { 
  ViewType, 
  EventCategory, 
  Priority, 
  VisibilityLevel,
  RecurrenceFrequency,
  DayOfWeek 
} from './types'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Calendar View and Display Systems', () => {
  let calendarManager: CalendarManager
  let viewGenerator: CalendarViewGenerator
  let eventRenderer: EventRenderer
  let navigator: CalendarNavigator
  let eventDisplay: EventDetailDisplay
  let eventEditor: EventEditor
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for test data
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calendar-view-test-'))
    
    calendarManager = new CalendarManager(
      path.join(tempDir, 'events'),
      'test-encryption-key-12345'
    )
    
    await calendarManager.initialize()
    
    viewGenerator = new CalendarViewGenerator(calendarManager)
    eventRenderer = new EventRenderer()
    navigator = new CalendarNavigator()
    eventDisplay = new EventDetailDisplay(calendarManager)
    eventEditor = new EventEditor(calendarManager)

    // Create test events
    await createTestEvents()
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  async function createTestEvents() {
    // Create events for testing different views
    await calendarManager.addEvent({
      title: 'Morning Meeting',
      description: 'Daily standup meeting',
      startTime: new Date('2024-01-15T09:00:00Z'),
      endTime: new Date('2024-01-15T09:30:00Z'),
      category: EventCategory.WORK,
      priority: Priority.HIGH,
      createdBy: 'test-user'
    })

    await calendarManager.addEvent({
      title: 'Lunch Break',
      description: 'Team lunch',
      startTime: new Date('2024-01-15T12:00:00Z'),
      endTime: new Date('2024-01-15T13:00:00Z'),
      category: EventCategory.PERSONAL,
      priority: Priority.MEDIUM,
      createdBy: 'test-user'
    })

    await calendarManager.addEvent({
      title: 'All Day Conference',
      description: 'Annual company conference',
      startTime: new Date('2024-01-16T00:00:00Z'),
      endTime: new Date('2024-01-16T23:59:59Z'),
      allDay: true,
      category: EventCategory.WORK,
      priority: Priority.HIGH,
      createdBy: 'test-user'
    })

    await calendarManager.addEvent({
      title: 'Weekly Team Meeting',
      description: 'Recurring team meeting',
      startTime: new Date('2024-01-15T14:00:00Z'),
      endTime: new Date('2024-01-15T15:00:00Z'),
      recurrence: {
        frequency: RecurrenceFrequency.WEEKLY,
        interval: 1,
        daysOfWeek: [DayOfWeek.MONDAY],
        occurrenceCount: 4,
        exceptions: []
      },
      category: EventCategory.WORK,
      priority: Priority.MEDIUM,
      createdBy: 'test-user'
    })
  }

  describe('CalendarViewGenerator', () => {
    test('should generate day view correctly', async () => {
      const testDate = new Date('2024-01-15T12:00:00Z')
      const dayView = await viewGenerator.generateDayView(testDate, 'test-user')

      expect(dayView.type).toBe(ViewType.DAY)
      expect(dayView.events.length).toBeGreaterThan(0)
      
      // Check that all events are on the correct day
      dayView.events.forEach(event => {
        expect(event.startTime.getDate()).toBe(testDate.getDate())
        expect(event.startTime.getMonth()).toBe(testDate.getMonth())
        expect(event.startTime.getFullYear()).toBe(testDate.getFullYear())
      })

      // Events should be sorted by start time
      for (let i = 1; i < dayView.events.length; i++) {
        expect(dayView.events[i].startTime.getTime())
          .toBeGreaterThanOrEqual(dayView.events[i - 1].startTime.getTime())
      }
    })

    test('should generate week view correctly', async () => {
      const weekStart = viewGenerator.getWeekStartDate(new Date('2024-01-15T00:00:00Z'))
      const weekView = await viewGenerator.generateWeekView(weekStart, 'test-user')

      expect(weekView.type).toBe(ViewType.WEEK)
      expect(weekView.startDate.getDay()).toBe(1) // Monday
      
      // Week should span 7 days
      const weekDuration = weekView.endDate.getTime() - weekView.startDate.getTime()
      const expectedDuration = 7 * 24 * 60 * 60 * 1000 - 1 // 7 days minus 1ms
      expect(Math.abs(weekDuration - expectedDuration)).toBeLessThan(1000) // Within 1 second
    })

    test('should generate month view correctly', async () => {
      const monthDate = new Date('2024-01-15T12:00:00Z')
      const monthView = await viewGenerator.generateMonthView(monthDate, 'test-user')

      expect(monthView.type).toBe(ViewType.MONTH)
      expect(monthView.startDate.getDate()).toBe(1) // First day of month
      expect(monthView.startDate.getMonth()).toBe(monthDate.getMonth())
      
      // Should include events from the entire month
      expect(monthView.events.length).toBeGreaterThan(0)
    })

    test('should generate agenda view correctly', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z')
      const agendaView = await viewGenerator.generateAgendaView(startDate, 7, 'test-user')

      expect(agendaView.type).toBe(ViewType.AGENDA)
      
      // Should span the specified number of days (7 days + 1 day - 1ms)
      const agendaDuration = agendaView.endDate.getTime() - agendaView.startDate.getTime()
      const expectedDuration = 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000 - 1
      expect(Math.abs(agendaDuration - expectedDuration)).toBeLessThan(1000)
    })

    test('should get correct week start date', () => {
      // Test various days of the week
      const tuesday = new Date('2024-01-16T12:00:00Z') // Tuesday
      const weekStart = viewGenerator.getWeekStartDate(tuesday)
      
      expect(weekStart.getDay()).toBe(1) // Monday
      expect(weekStart.getDate()).toBe(15) // Monday Jan 15
    })

    test('should get month grid correctly', () => {
      const monthDate = new Date('2024-01-15T12:00:00Z')
      const grid = viewGenerator.getMonthGrid(monthDate)

      expect(grid.length).toBeGreaterThan(0)
      expect(grid[0].length).toBe(7) // 7 days per week
      
      // First day should be a Monday
      expect(grid[0][0].getDay()).toBe(1)
    })

    test('should navigate between periods correctly', () => {
      const currentDate = new Date('2024-01-15T12:00:00Z')
      
      // Test day navigation
      const nextDay = viewGenerator.getNextPeriod(currentDate, ViewType.DAY)
      expect(nextDay.getDate()).toBe(16)
      
      const prevDay = viewGenerator.getPreviousPeriod(currentDate, ViewType.DAY)
      expect(prevDay.getDate()).toBe(14)
      
      // Test week navigation
      const nextWeek = viewGenerator.getNextPeriod(currentDate, ViewType.WEEK)
      expect(nextWeek.getDate()).toBe(22)
      
      // Test month navigation
      const nextMonth = viewGenerator.getNextPeriod(currentDate, ViewType.MONTH)
      expect(nextMonth.getMonth()).toBe(1) // February
    })
  })

  describe('EventRenderer', () => {
    test('should render day view event correctly', () => {
      const event = {
        id: 'test-event',
        title: 'Test Meeting',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        allDay: false,
        attendees: []
      } as any

      const renderData = eventRenderer.renderDayViewEvent(event, 60)

      expect(renderData.event).toBe(event)
      expect(renderData.position.height).toBe(60) // 1 hour = 60px
      expect(renderData.displayText).toContain('Test Meeting')
      expect(renderData.isAllDay).toBe(false)
    })

    test('should render week view event correctly', () => {
      const event = {
        id: 'test-event',
        title: 'Test Meeting',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        allDay: false,
        attendees: []
      } as any

      const renderData = eventRenderer.renderWeekViewEvent(event, 1, 60) // Monday column

      expect(renderData.position.left).toBe(100 / 7) // Second column (Monday)
      expect(renderData.position.width).toBe(100 / 7)
    })

    test('should render month view event correctly', () => {
      const event = {
        id: 'test-event',
        title: 'Very Long Event Title That Should Be Truncated',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        allDay: false,
        attendees: []
      } as any

      const renderData = eventRenderer.renderMonthViewEvent(event)

      expect(renderData.displayText.length).toBeLessThanOrEqual(23) // Should be truncated
      expect(renderData.displayText).toContain('...')
    })

    test('should apply correct styling based on category and priority', () => {
      const event = {
        id: 'test-event',
        title: 'Test Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        category: EventCategory.WORK,
        priority: Priority.CRITICAL,
        isPrivate: false,
        allDay: false,
        attendees: []
      } as any

      const renderData = eventRenderer.renderDayViewEvent(event, 60)

      expect(renderData.style.backgroundColor).toBe('#3498db') // Work category color
      expect(renderData.style.borderColor).toBe('#c0392b') // Critical priority color
      expect(renderData.style.borderWidth).toBe(4) // Critical priority border width
    })

    test('should layout overlapping events correctly', () => {
      const events = [
        {
          id: 'event1',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
          category: EventCategory.WORK,
          priority: Priority.MEDIUM,
          attendees: []
        },
        {
          id: 'event2',
          startTime: new Date('2024-01-15T10:30:00Z'),
          endTime: new Date('2024-01-15T11:30:00Z'),
          category: EventCategory.PERSONAL,
          priority: Priority.MEDIUM,
          attendees: []
        }
      ] as any[]

      const layoutData = eventRenderer.layoutEventsForTimeView(events, 60)

      expect(layoutData.length).toBe(2)
      
      // Events should have different left positions to avoid overlap
      expect(layoutData[0].position.left).not.toBe(layoutData[1].position.left)
      
      // Each event should take up less than full width
      expect(layoutData[0].position.width).toBeLessThan(100)
      expect(layoutData[1].position.width).toBeLessThan(100)
    })
  })

  describe('CalendarNavigator', () => {
    test('should navigate to today correctly', () => {
      const today = navigator.goToToday()
      const actualToday = new Date()
      
      expect(today.getDate()).toBe(actualToday.getDate())
      expect(today.getMonth()).toBe(actualToday.getMonth())
      expect(today.getFullYear()).toBe(actualToday.getFullYear())
    })

    test('should get correct date ranges for different view types', () => {
      const testDate = new Date('2024-01-15T12:00:00Z')
      
      // Day view range
      const dayRange = navigator.getViewDateRange(testDate, ViewType.DAY)
      expect(dayRange.startTime.getHours()).toBe(0)
      expect(dayRange.endTime.getHours()).toBe(23)
      
      // Week view range
      const weekRange = navigator.getViewDateRange(testDate, ViewType.WEEK)
      expect(weekRange.startTime.getDay()).toBe(1) // Monday
      
      // Month view range
      const monthRange = navigator.getViewDateRange(testDate, ViewType.MONTH)
      expect(monthRange.startTime.getDate()).toBe(1) // First day of month
    })

    test('should format dates correctly for display', () => {
      const testDate = new Date('2024-01-15T12:00:00Z')
      
      const dayFormat = navigator.formatDateForDisplay(testDate, ViewType.DAY)
      expect(dayFormat).toContain('Monday')
      expect(dayFormat).toContain('January')
      expect(dayFormat).toContain('15')
      expect(dayFormat).toContain('2024')
      
      const monthFormat = navigator.formatDateForDisplay(testDate, ViewType.MONTH)
      expect(monthFormat).toContain('January')
      expect(monthFormat).toContain('2024')
    })

    test('should correctly identify date properties', () => {
      const testDate = new Date('2024-01-15T12:00:00Z')
      const currentMonth = new Date('2024-01-15T00:00:00Z') // Same month as testDate
      
      expect(navigator.isDateInCurrentMonth(testDate, currentMonth)).toBe(true)
      
      const today = new Date()
      expect(navigator.isToday(today)).toBe(true)
      expect(navigator.isToday(testDate)).toBe(false)
      
      const pastDate = new Date('2020-01-01T00:00:00Z')
      expect(navigator.isPastDate(pastDate)).toBe(true)
    })
  })

  describe('EventDetailDisplay', () => {
    test('should get and format event details correctly', async () => {
      // Create a test event
      const eventId = await calendarManager.addEvent({
        title: 'Detailed Test Event',
        description: 'This is a test event with detailed information',
        startTime: new Date('2024-01-15T14:00:00Z'),
        endTime: new Date('2024-01-15T15:30:00Z'),
        category: EventCategory.WORK,
        priority: Priority.HIGH,
        location: {
          name: 'Conference Room A',
          address: '123 Main St',
          type: 'work' as any
        },
        attendees: [
          {
            id: 'user1',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'required' as any,
            status: 'accepted' as any,
            isRequired: true
          }
        ],
        createdBy: 'test-user'
      })

      const details = await eventDisplay.getEventDetails(eventId)

      expect(details).toBeDefined()
      expect(details!.event.title).toBe('Detailed Test Event')
      expect(details!.formattedDetails.title).toBe('Detailed Test Event')
      expect(details!.formattedDetails.duration).toContain('1 hour 30 minutes')
      expect(details!.formattedDetails.location).toContain('Conference Room A')
      expect(details!.formattedDetails.attendees).toContain('John Doe')
      expect(details!.formattedDetails.category).toBe('Work')
      expect(details!.formattedDetails.priority).toBe('High')
    })

    test('should handle events with recurrence correctly', async () => {
      const eventId = await calendarManager.addEvent({
        title: 'Recurring Meeting',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        recurrence: {
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          daysOfWeek: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY],
          occurrenceCount: 10,
          exceptions: []
        },
        createdBy: 'test-user'
      })

      const details = await eventDisplay.getEventDetails(eventId)

      expect(details!.formattedDetails.recurrence).toContain('weekly')
      expect(details!.formattedDetails.recurrence).toContain('Monday')
      expect(details!.formattedDetails.recurrence).toContain('Wednesday')
      expect(details!.formattedDetails.recurrence).toContain('10 occurrences')
    })
  })

  describe('EventEditor', () => {
    test('should create new event from form data', async () => {
      const formData = {
        title: 'New Test Event',
        description: 'Created from form data',
        startDate: '2024-01-20',
        startTime: '10:00',
        endDate: '2024-01-20',
        endTime: '11:00',
        category: EventCategory.PERSONAL,
        priority: Priority.MEDIUM,
        createdBy: 'test-user'
      }

      const result = await eventEditor.createEvent(formData)

      expect(result.success).toBe(true)
      expect(result.eventId).toBeDefined()
      expect(result.errors.length).toBe(0)

      // Verify the event was created
      const event = await calendarManager.getEvent(result.eventId!)
      expect(event!.title).toBe('New Test Event')
    })

    test('should validate form data correctly', async () => {
      const invalidFormData = {
        title: '', // Empty title
        startDate: '2024-01-20',
        startTime: '11:00',
        endDate: '2024-01-20',
        endTime: '10:00', // End before start
        attendees: [
          { 
            id: 'test-user-1',
            name: 'Test User', 
            email: 'invalid-email',
            role: 'required' as any,
            status: 'pending' as any,
            isRequired: true
          } // Invalid email
        ]
      }

      const result = await eventEditor.createEvent(invalidFormData)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors).toContain('Event title is required')
      expect(result.errors).toContain('End time must be after start time')
      expect(result.errors.some(error => error.includes('Invalid email'))).toBe(true)
    })

    test('should update existing event', async () => {
      // Create initial event
      const eventId = await calendarManager.addEvent({
        title: 'Original Event',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      // Update with form data
      const updateFormData = {
        title: 'Updated Event',
        description: 'Updated description',
        startDate: '2024-01-15',
        startTime: '10:00',
        endDate: '2024-01-15',
        endTime: '12:00', // Extended duration
        category: EventCategory.WORK
      }

      const result = await eventEditor.updateEvent(eventId, updateFormData)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)

      // Verify the update
      const updatedEvent = await calendarManager.getEvent(eventId)
      expect(updatedEvent!.title).toBe('Updated Event')
      expect(updatedEvent!.description).toBe('Updated description')
      expect(updatedEvent!.category).toBe(EventCategory.WORK)
    })

    test('should delete event correctly', async () => {
      // Create event to delete
      const eventId = await calendarManager.addEvent({
        title: 'Event to Delete',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        createdBy: 'test-user'
      })

      const result = await eventEditor.deleteEvent(eventId)

      expect(result.success).toBe(true)
      expect(result.errors.length).toBe(0)

      // Verify deletion
      const deletedEvent = await calendarManager.getEvent(eventId)
      expect(deletedEvent).toBeNull()
    })

    test('should convert between event and form data correctly', async () => {
      // Create event
      const eventId = await calendarManager.addEvent({
        title: 'Conversion Test Event',
        description: 'Test description',
        startTime: new Date('2024-01-15T14:30:00Z'),
        endTime: new Date('2024-01-15T16:00:00Z'),
        category: EventCategory.EDUCATION,
        priority: Priority.HIGH,
        createdBy: 'test-user'
      })

      // Get form data
      const formData = await eventEditor.getEventFormData(eventId)

      expect(formData).toBeDefined()
      expect(formData!.title).toBe('Conversion Test Event')
      expect(formData!.description).toBe('Test description')
      expect(formData!.startDate).toBe('2024-01-15')
      expect(formData!.startTime).toBe('14:30')
      expect(formData!.endDate).toBe('2024-01-15')
      expect(formData!.endTime).toBe('16:00')
      expect(formData!.category).toBe(EventCategory.EDUCATION)
      expect(formData!.priority).toBe(Priority.HIGH)
    })
  })
})