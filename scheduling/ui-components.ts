// Scheduling System UI Components
// Child-friendly and accessible interface components for calendar and reminder management

import { EventEmitter } from 'events'
import { CalendarEvent, EventCategory, Priority } from '../calendar/types'
import { Reminder, ReminderType, NotificationMethod } from '../reminders/types'
import { TimeRange, TimeSlot, ScheduleConflict } from './types'
import { UserPreferences, CalendarView } from './configuration-manager'

export interface UIComponent {
  render(): Promise<UIElement>
  update(data: any): Promise<void>
  destroy(): Promise<void>
  isAccessible(): boolean
}

export interface UIElement {
  id: string
  type: UIElementType
  content: string | UIContent
  accessibility: AccessibilityInfo
  childFriendly: boolean
}

export enum UIElementType {
  CALENDAR_VIEW = 'calendar_view',
  EVENT_FORM = 'event_form',
  REMINDER_FORM = 'reminder_form',
  FAMILY_SCHEDULE = 'family_schedule',
  NOTIFICATION_PANEL = 'notification_panel',
  SETTINGS_PANEL = 'settings_panel'
}

export interface UIContent {
  html?: string
  text?: string
  components?: UIComponent[]
  actions?: UIAction[]
}

export interface UIAction {
  id: string
  label: string
  icon?: string
  handler: () => Promise<void>
  accessibility: AccessibilityInfo
  childSafe: boolean
}

export interface AccessibilityInfo {
  ariaLabel: string
  ariaDescription?: string
  tabIndex: number
  keyboardShortcut?: string
  screenReaderText?: string
  highContrastSupport: boolean
  largeTextSupport: boolean
}

export interface ChildFriendlyConfig {
  useSimpleLanguage: boolean
  showHelpText: boolean
  enableGuidedMode: boolean
  restrictAdvancedFeatures: boolean
  parentalApprovalRequired: boolean
}

/**
 * Calendar Display Component
 * Provides intuitive calendar views with child-friendly design
 */
export class CalendarDisplayComponent extends EventEmitter implements UIComponent {
  private currentView: CalendarView = CalendarView.WEEK
  private currentDate: Date = new Date()
  private events: CalendarEvent[] = []
  private userPreferences: UserPreferences
  private childFriendlyConfig: ChildFriendlyConfig
  
  constructor(
    userPreferences: UserPreferences,
    childFriendlyConfig: ChildFriendlyConfig
  ) {
    super()
    this.userPreferences = userPreferences
    this.childFriendlyConfig = childFriendlyConfig
  }

  async render(): Promise<UIElement> {
    const content = await this.generateCalendarContent()
    
    return {
      id: 'calendar-display',
      type: UIElementType.CALENDAR_VIEW,
      content,
      accessibility: {
        ariaLabel: 'Calendar view showing your schedule',
        ariaDescription: `${this.currentView} view for ${this.formatDateForScreenReader(this.currentDate)}`,
        tabIndex: 0,
        keyboardShortcut: 'Alt+C',
        screenReaderText: await this.generateScreenReaderText(),
        highContrastSupport: this.userPreferences.highContrastMode,
        largeTextSupport: this.userPreferences.largeText
      },
      childFriendly: true
    }
  }

  async update(data: { events?: CalendarEvent[], view?: CalendarView, date?: Date }): Promise<void> {
    if (data.events) {
      this.events = data.events
    }
    
    if (data.view) {
      this.currentView = data.view
    }
    
    if (data.date) {
      this.currentDate = data.date
    }
    
    this.emit('updated', { view: this.currentView, date: this.currentDate })
  }

  async destroy(): Promise<void> {
    this.removeAllListeners()
  }

  isAccessible(): boolean {
    return true
  }

  async setView(view: CalendarView): Promise<void> {
    this.currentView = view
    await this.update({ view })
  }

  async navigateToDate(date: Date): Promise<void> {
    this.currentDate = date
    await this.update({ date })
  }

  async navigateNext(): Promise<void> {
    const nextDate = this.getNextPeriodDate()
    await this.navigateToDate(nextDate)
  }

  async navigatePrevious(): Promise<void> {
    const prevDate = this.getPreviousPeriodDate()
    await this.navigateToDate(prevDate)
  }

  private async generateCalendarContent(): Promise<UIContent> {
    const actions = await this.generateCalendarActions()
    
    return {
      html: await this.generateCalendarHTML(),
      text: await this.generateCalendarText(),
      actions
    }
  }

  private async generateCalendarHTML(): Promise<string> {
    const cssClasses = this.getCSSClasses()
    const eventsHTML = await this.generateEventsHTML()
    
    return `
      <div class="${cssClasses.container}">
        <div class="${cssClasses.header}">
          <h2 class="${cssClasses.title}">
            ${this.getChildFriendlyTitle()}
          </h2>
          <div class="${cssClasses.navigation}">
            ${await this.generateNavigationHTML()}
          </div>
        </div>
        <div class="${cssClasses.calendar}">
          ${eventsHTML}
        </div>
        ${this.childFriendlyConfig.showHelpText ? await this.generateHelpText() : ''}
      </div>
    `
  }

  private async generateCalendarText(): Promise<string> {
    const title = this.getChildFriendlyTitle()
    const eventsSummary = await this.generateEventsSummary()
    
    return `${title}\n\n${eventsSummary}`
  }

  private async generateCalendarActions(): Promise<UIAction[]> {
    const actions: UIAction[] = [
      {
        id: 'navigate-previous',
        label: this.getChildFriendlyLabel('Previous'),
        icon: 'arrow-left',
        handler: async () => await this.navigatePrevious(),
        accessibility: {
          ariaLabel: `Go to previous ${this.currentView.toLowerCase()}`,
          tabIndex: 1,
          keyboardShortcut: 'ArrowLeft',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'navigate-next',
        label: this.getChildFriendlyLabel('Next'),
        icon: 'arrow-right',
        handler: async () => await this.navigateNext(),
        accessibility: {
          ariaLabel: `Go to next ${this.currentView.toLowerCase()}`,
          tabIndex: 2,
          keyboardShortcut: 'ArrowRight',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'add-event',
        label: this.getChildFriendlyLabel('Add Activity'),
        icon: 'plus',
        handler: async () => this.emit('addEvent'),
        accessibility: {
          ariaLabel: 'Add a new activity to your calendar',
          tabIndex: 3,
          keyboardShortcut: 'Ctrl+N',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      }
    ]

    // Add view switching actions
    const viewActions = this.generateViewSwitchActions()
    actions.push(...viewActions)

    return actions
  }

  private generateViewSwitchActions(): UIAction[] {
    const views = [CalendarView.DAY, CalendarView.WEEK, CalendarView.MONTH]
    
    return views.map((view, index) => ({
      id: `view-${view}`,
      label: this.getChildFriendlyLabel(this.capitalizeFirst(view)),
      handler: async () => await this.setView(view),
      accessibility: {
        ariaLabel: `Switch to ${view} view`,
        tabIndex: 10 + index,
        keyboardShortcut: `Alt+${index + 1}`,
        highContrastSupport: true,
        largeTextSupport: true
      },
      childSafe: true
    }))
  }

  private getChildFriendlyTitle(): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return this.formatDateRange()
    }

    const today = new Date()
    const isToday = this.isSameDay(this.currentDate, today)
    
    if (this.currentView === CalendarView.DAY) {
      return isToday ? "Today's Activities" : `Activities for ${this.formatSimpleDate(this.currentDate)}`
    } else if (this.currentView === CalendarView.WEEK) {
      return isToday ? "This Week's Activities" : `Week of ${this.formatSimpleDate(this.currentDate)}`
    } else {
      return `${this.formatSimpleMonth(this.currentDate)} Activities`
    }
  }

  private getChildFriendlyLabel(label: string): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return label
    }

    const childFriendlyLabels: Record<string, string> = {
      'Previous': 'Back',
      'Next': 'Forward',
      'Add Activity': 'Add Fun Thing',
      'Day': 'Today',
      'Week': 'This Week',
      'Month': 'This Month'
    }

    return childFriendlyLabels[label] || label
  }

  private getCSSClasses(): Record<string, string> {
    const baseClasses = {
      container: 'calendar-container',
      header: 'calendar-header',
      title: 'calendar-title',
      navigation: 'calendar-navigation',
      calendar: 'calendar-grid'
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

  private async generateEventsHTML(): Promise<string> {
    const visibleEvents = this.getEventsForCurrentView()
    
    if (visibleEvents.length === 0) {
      return `<div class="no-events">${this.getNoEventsMessage()}</div>`
    }

    return visibleEvents.map(event => this.generateEventHTML(event)).join('')
  }

  private generateEventHTML(event: CalendarEvent): string {
    const eventClasses = this.getEventCSSClasses(event)
    const timeDisplay = this.formatEventTime(event)
    const title = this.sanitizeEventTitle(event.title)
    
    return `
      <div class="${eventClasses}" data-event-id="${event.id}">
        <div class="event-time">${timeDisplay}</div>
        <div class="event-title">${title}</div>
        ${event.description ? `<div class="event-description">${this.sanitizeEventDescription(event.description)}</div>` : ''}
      </div>
    `
  }

  private getEventCSSClasses(event: CalendarEvent): string {
    let classes = 'calendar-event'
    
    // Add priority class
    classes += ` priority-${event.priority.toLowerCase()}`
    
    // Add category class
    classes += ` category-${event.category.toLowerCase().replace(/\s+/g, '-')}`
    
    // Add accessibility classes
    if (this.userPreferences.highContrastMode) {
      classes += ' high-contrast'
    }
    
    if (this.userPreferences.largeText) {
      classes += ' large-text'
    }
    
    return classes
  }

  private getNoEventsMessage(): string {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return "No fun activities planned! Want to add something?"
    }
    return "No events scheduled for this period."
  }

  private async generateScreenReaderText(): Promise<string> {
    const eventsCount = this.getEventsForCurrentView().length
    const dateRange = this.formatDateRange()
    
    return `Calendar ${this.currentView} view showing ${dateRange}. ${eventsCount} events scheduled.`
  }

  private async generateEventsSummary(): Promise<string> {
    const events = this.getEventsForCurrentView()
    
    if (events.length === 0) {
      return this.getNoEventsMessage()
    }

    return events.map(event => {
      const time = this.formatEventTime(event)
      return `${time}: ${event.title}`
    }).join('\n')
  }

  private async generateHelpText(): Promise<string> {
    return `
      <div class="help-text">
        <h3>How to use your calendar:</h3>
        <ul>
          <li>Click "Add Fun Thing" to add new activities</li>
          <li>Use the arrow buttons to see different days</li>
          <li>Click on any activity to see more details</li>
        </ul>
      </div>
    `
  }

  private getEventsForCurrentView(): CalendarEvent[] {
    const range = this.getDateRangeForView()
    return this.events.filter(event => 
      event.startTime >= range.start && event.startTime <= range.end
    )
  }

  private getDateRangeForView(): TimeRange {
    const start = new Date(this.currentDate)
    const end = new Date(this.currentDate)

    switch (this.currentView) {
      case CalendarView.DAY:
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case CalendarView.WEEK:
        const dayOfWeek = start.getDay()
        start.setDate(start.getDate() - dayOfWeek)
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        break
      case CalendarView.MONTH:
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        end.setMonth(end.getMonth() + 1, 0)
        end.setHours(23, 59, 59, 999)
        break
    }

    return { start, end }
  }

  private getNextPeriodDate(): Date {
    const next = new Date(this.currentDate)
    
    switch (this.currentView) {
      case CalendarView.DAY:
        next.setDate(next.getDate() + 1)
        break
      case CalendarView.WEEK:
        next.setDate(next.getDate() + 7)
        break
      case CalendarView.MONTH:
        next.setMonth(next.getMonth() + 1)
        break
    }
    
    return next
  }

  private getPreviousPeriodDate(): Date {
    const prev = new Date(this.currentDate)
    
    switch (this.currentView) {
      case CalendarView.DAY:
        prev.setDate(prev.getDate() - 1)
        break
      case CalendarView.WEEK:
        prev.setDate(prev.getDate() - 7)
        break
      case CalendarView.MONTH:
        prev.setMonth(prev.getMonth() - 1)
        break
    }
    
    return prev
  }

  private formatDateRange(): string {
    const range = this.getDateRangeForView()
    
    if (this.currentView === CalendarView.DAY) {
      return this.formatDate(this.currentDate)
    } else if (this.currentView === CalendarView.WEEK) {
      return `${this.formatDate(range.start)} - ${this.formatDate(range.end)}`
    } else {
      return this.formatMonth(this.currentDate)
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString(this.userPreferences.voiceLanguage || 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  private formatMonth(date: Date): string {
    return date.toLocaleDateString(this.userPreferences.voiceLanguage || 'en-US', {
      year: 'numeric',
      month: 'long'
    })
  }

  private formatSimpleDate(date: Date): string {
    return date.toLocaleDateString(this.userPreferences.voiceLanguage || 'en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  private formatSimpleMonth(date: Date): string {
    return date.toLocaleDateString(this.userPreferences.voiceLanguage || 'en-US', {
      month: 'long'
    })
  }

  private formatDateForScreenReader(date: Date): string {
    return date.toLocaleDateString(this.userPreferences.voiceLanguage || 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  private formatEventTime(event: CalendarEvent): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    if (event.allDay) {
      return 'All day'
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

  private sanitizeEventTitle(title: string): string {
    // Basic HTML sanitization for child safety
    return title.replace(/[<>]/g, '')
  }

  private sanitizeEventDescription(description: string): string {
    // Basic HTML sanitization for child safety
    return description.replace(/[<>]/g, '').substring(0, 100)
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

/**
 * Event Creation Form Component
 * Child-friendly form for creating calendar events
 */
export class EventFormComponent extends EventEmitter implements UIComponent {
  private formData: Partial<CalendarEvent> = {}
  private userPreferences: UserPreferences
  private childFriendlyConfig: ChildFriendlyConfig
  private isEditing: boolean = false
  
  constructor(
    userPreferences: UserPreferences,
    childFriendlyConfig: ChildFriendlyConfig,
    existingEvent?: CalendarEvent
  ) {
    super()
    this.userPreferences = userPreferences
    this.childFriendlyConfig = childFriendlyConfig
    
    if (existingEvent) {
      this.formData = { ...existingEvent }
      this.isEditing = true
    }
  }

  async render(): Promise<UIElement> {
    const content = await this.generateFormContent()
    
    return {
      id: 'event-form',
      type: UIElementType.EVENT_FORM,
      content,
      accessibility: {
        ariaLabel: this.isEditing ? 'Edit activity form' : 'Create new activity form',
        ariaDescription: 'Form to add or edit calendar activities',
        tabIndex: 0,
        screenReaderText: 'Use this form to create or edit your calendar activities',
        highContrastSupport: this.userPreferences.highContrastMode,
        largeTextSupport: this.userPreferences.largeText
      },
      childFriendly: true
    }
  }

  async update(data: Partial<CalendarEvent>): Promise<void> {
    this.formData = { ...this.formData, ...data }
    this.emit('formUpdated', this.formData)
  }

  async destroy(): Promise<void> {
    this.removeAllListeners()
  }

  isAccessible(): boolean {
    return true
  }

  async submitForm(): Promise<CalendarEvent> {
    const validationResult = await this.validateForm()
    
    if (!validationResult.isValid) {
      throw new Error(`Form validation failed: ${validationResult.errors.join(', ')}`)
    }
    
    const event: CalendarEvent = {
      id: this.formData.id || this.generateEventId(),
      title: this.formData.title || '',
      description: this.formData.description || '',
      startTime: this.formData.startTime || new Date(),
      endTime: this.formData.endTime || new Date(),
      allDay: this.formData.allDay || false,
      category: this.formData.category || EventCategory.PERSONAL,
      priority: this.formData.priority || Priority.MEDIUM,
      attendees: this.formData.attendees || [],
      location: this.formData.location,
      recurrence: this.formData.recurrence,
      reminders: this.formData.reminders || [],
      visibility: this.formData.visibility || 'private',
      metadata: this.formData.metadata || {},
      createdAt: this.formData.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: this.userPreferences.userId
    }
    
    this.emit('eventSubmitted', event)
    return event
  }

  private async generateFormContent(): Promise<UIContent> {
    const actions = await this.generateFormActions()
    
    return {
      html: await this.generateFormHTML(),
      text: await this.generateFormText(),
      actions
    }
  }

  private async generateFormHTML(): Promise<string> {
    const cssClasses = this.getFormCSSClasses()
    
    return `
      <div class="${cssClasses.container}">
        <h2 class="${cssClasses.title}">
          ${this.getFormTitle()}
        </h2>
        
        <form class="${cssClasses.form}">
          ${await this.generateTitleField()}
          ${await this.generateTimeFields()}
          ${await this.generateDescriptionField()}
          ${await this.generateCategoryField()}
          ${await this.generateLocationField()}
          ${await this.generateReminderField()}
          
          ${this.childFriendlyConfig.showHelpText ? await this.generateFormHelp() : ''}
        </form>
      </div>
    `
  }

  private async generateFormText(): Promise<string> {
    return `${this.getFormTitle()}\n\nFill out the form to ${this.isEditing ? 'update' : 'create'} your activity.`
  }

  private async generateFormActions(): Promise<UIAction[]> {
    return [
      {
        id: 'save-event',
        label: this.getChildFriendlyLabel('Save Activity'),
        icon: 'save',
        handler: async () => await this.submitForm(),
        accessibility: {
          ariaLabel: `${this.isEditing ? 'Update' : 'Save'} this activity`,
          tabIndex: 100,
          keyboardShortcut: 'Ctrl+S',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'cancel-form',
        label: this.getChildFriendlyLabel('Cancel'),
        icon: 'cancel',
        handler: async () => this.emit('formCancelled'),
        accessibility: {
          ariaLabel: 'Cancel and close this form',
          tabIndex: 101,
          keyboardShortcut: 'Escape',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      }
    ]
  }

  private getFormTitle(): string {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return this.isEditing ? 'Change Your Activity' : 'Add a Fun Activity'
    }
    return this.isEditing ? 'Edit Event' : 'Create New Event'
  }

  private getChildFriendlyLabel(label: string): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return label
    }

    const childFriendlyLabels: Record<string, string> = {
      'Save Activity': 'Save My Activity',
      'Cancel': 'Never Mind'
    }

    return childFriendlyLabels[label] || label
  }

  private getFormCSSClasses(): Record<string, string> {
    const baseClasses = {
      container: 'event-form-container',
      title: 'event-form-title',
      form: 'event-form',
      field: 'form-field',
      label: 'form-label',
      input: 'form-input'
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

  private async generateTitleField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'What is your activity?' : 'Event Title'
    const placeholder = this.childFriendlyConfig.useSimpleLanguage ? 'Soccer practice, birthday party, etc.' : 'Enter event title'
    
    return `
      <div class="form-field">
        <label for="event-title" class="form-label">${label}</label>
        <input 
          type="text" 
          id="event-title" 
          class="form-input" 
          value="${this.formData.title || ''}"
          placeholder="${placeholder}"
          required
          aria-describedby="title-help"
        />
        <div id="title-help" class="field-help">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Give your activity a fun name!' : 'Enter a descriptive title for your event'}
        </div>
      </div>
    `
  }

  private async generateTimeFields(): Promise<string> {
    const startLabel = this.childFriendlyConfig.useSimpleLanguage ? 'When does it start?' : 'Start Time'
    const endLabel = this.childFriendlyConfig.useSimpleLanguage ? 'When does it end?' : 'End Time'
    
    return `
      <div class="form-field-group">
        <div class="form-field">
          <label for="start-time" class="form-label">${startLabel}</label>
          <input 
            type="datetime-local" 
            id="start-time" 
            class="form-input"
            value="${this.formatDateTimeForInput(this.formData.startTime)}"
            required
          />
        </div>
        
        <div class="form-field">
          <label for="end-time" class="form-label">${endLabel}</label>
          <input 
            type="datetime-local" 
            id="end-time" 
            class="form-input"
            value="${this.formatDateTimeForInput(this.formData.endTime)}"
            required
          />
        </div>
        
        <div class="form-field">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              id="all-day"
              ${this.formData.allDay ? 'checked' : ''}
            />
            ${this.childFriendlyConfig.useSimpleLanguage ? 'All day activity' : 'All day event'}
          </label>
        </div>
      </div>
    `
  }

  private async generateDescriptionField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'Tell us more about it:' : 'Description'
    const placeholder = this.childFriendlyConfig.useSimpleLanguage ? 'What will you do? Who will be there?' : 'Enter event description'
    
    return `
      <div class="form-field">
        <label for="event-description" class="form-label">${label}</label>
        <textarea 
          id="event-description" 
          class="form-input form-textarea"
          placeholder="${placeholder}"
          rows="3"
        >${this.formData.description || ''}</textarea>
      </div>
    `
  }

  private async generateCategoryField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'What type of activity is this?' : 'Category'
    
    const categories = this.getChildFriendlyCategories()
    const options = categories.map(cat => 
      `<option value="${cat.value}" ${this.formData.category === cat.value ? 'selected' : ''}>${cat.label}</option>`
    ).join('')
    
    return `
      <div class="form-field">
        <label for="event-category" class="form-label">${label}</label>
        <select id="event-category" class="form-input">
          ${options}
        </select>
      </div>
    `
  }

  private async generateLocationField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'Where will it happen?' : 'Location'
    const placeholder = this.childFriendlyConfig.useSimpleLanguage ? 'Home, school, park, etc.' : 'Enter location'
    
    return `
      <div class="form-field">
        <label for="event-location" class="form-label">${label}</label>
        <input 
          type="text" 
          id="event-location" 
          class="form-input"
          value="${this.formData.location || ''}"
          placeholder="${placeholder}"
        />
      </div>
    `
  }

  private async generateReminderField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'When should we remind you?' : 'Reminder'
    
    return `
      <div class="form-field">
        <label for="reminder-time" class="form-label">${label}</label>
        <select id="reminder-time" class="form-input">
          <option value="0">No reminder</option>
          <option value="5">5 minutes before</option>
          <option value="15" selected>15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60">1 hour before</option>
          <option value="1440">1 day before</option>
        </select>
      </div>
    `
  }

  private async generateFormHelp(): Promise<string> {
    return `
      <div class="form-help">
        <h4>Tips for creating activities:</h4>
        <ul>
          <li>Give your activity a fun, easy-to-remember name</li>
          <li>Make sure the times are correct</li>
          <li>Add details so you remember what to bring</li>
          <li>Choose when you want to be reminded</li>
        </ul>
      </div>
    `
  }

  private getChildFriendlyCategories(): Array<{value: string, label: string}> {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return [
        { value: EventCategory.PERSONAL, label: 'Personal Fun' },
        { value: EventCategory.FAMILY, label: 'Family Time' },
        { value: EventCategory.SCHOOL, label: 'School Stuff' },
        { value: EventCategory.SPORTS, label: 'Sports & Games' },
        { value: EventCategory.SOCIAL, label: 'Friends & Fun' },
        { value: EventCategory.HEALTH, label: 'Health & Doctor' },
        { value: EventCategory.CHORES, label: 'Chores & Tasks' }
      ]
    }

    return [
      { value: EventCategory.PERSONAL, label: 'Personal' },
      { value: EventCategory.FAMILY, label: 'Family' },
      { value: EventCategory.SCHOOL, label: 'School' },
      { value: EventCategory.WORK, label: 'Work' },
      { value: EventCategory.SPORTS, label: 'Sports' },
      { value: EventCategory.SOCIAL, label: 'Social' },
      { value: EventCategory.HEALTH, label: 'Health' },
      { value: EventCategory.CHORES, label: 'Chores' }
    ]
  }

  private formatDateTimeForInput(date?: Date): string {
    if (!date) {
      return ''
    }
    
    // Format for datetime-local input: YYYY-MM-DDTHH:MM
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  private async validateForm(): Promise<{isValid: boolean, errors: string[]}> {
    const errors: string[] = []
    
    if (!this.formData.title || this.formData.title.trim().length === 0) {
      errors.push('Activity name is required')
    }
    
    if (!this.formData.startTime) {
      errors.push('Start time is required')
    }
    
    if (!this.formData.endTime) {
      errors.push('End time is required')
    }
    
    if (this.formData.startTime && this.formData.endTime && 
        this.formData.startTime >= this.formData.endTime) {
      errors.push('End time must be after start time')
    }
    
    // Child safety validation
    if (this.childFriendlyConfig.parentalApprovalRequired) {
      // Add validation for content that requires parental approval
      const sensitiveKeywords = ['alone', 'secret', 'private meeting']
      const content = `${this.formData.title} ${this.formData.description}`.toLowerCase()
      
      if (sensitiveKeywords.some(keyword => content.includes(keyword))) {
        errors.push('This activity may need parent approval')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}