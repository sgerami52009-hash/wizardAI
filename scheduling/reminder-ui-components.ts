// Reminder Management UI Components
// Child-friendly interface for creating and managing reminders

import { EventEmitter } from 'events'
import { Reminder, ReminderType, NotificationMethod, CompletionStatus } from '../reminders/types'
import { UserPreferences } from './configuration-manager'
import { UIComponent, UIElement, UIElementType, UIContent, UIAction, AccessibilityInfo, ChildFriendlyConfig } from './ui-components'

/**
 * Reminder Creation Form Component
 * Simple, child-friendly form for creating reminders
 */
export class ReminderFormComponent extends EventEmitter implements UIComponent {
  private formData: Partial<Reminder> = {}
  private userPreferences: UserPreferences
  private childFriendlyConfig: ChildFriendlyConfig
  private isEditing: boolean = false
  
  constructor(
    userPreferences: UserPreferences,
    childFriendlyConfig: ChildFriendlyConfig,
    existingReminder?: Reminder
  ) {
    super()
    this.userPreferences = userPreferences
    this.childFriendlyConfig = childFriendlyConfig
    
    if (existingReminder) {
      this.formData = { ...existingReminder }
      this.isEditing = true
    }
  }

  async render(): Promise<UIElement> {
    const content = await this.generateFormContent()
    
    return {
      id: 'reminder-form',
      type: UIElementType.REMINDER_FORM,
      content,
      accessibility: {
        ariaLabel: this.isEditing ? 'Edit reminder form' : 'Create new reminder form',
        ariaDescription: 'Form to add or edit reminders',
        tabIndex: 0,
        screenReaderText: 'Use this form to create or edit your reminders',
        highContrastSupport: this.userPreferences.highContrastMode,
        largeTextSupport: this.userPreferences.largeText
      },
      childFriendly: true
    }
  }

  async update(data: Partial<Reminder>): Promise<void> {
    this.formData = { ...this.formData, ...data }
    this.emit('formUpdated', this.formData)
  }

  async destroy(): Promise<void> {
    this.removeAllListeners()
  }

  isAccessible(): boolean {
    return true
  }

  async submitForm(): Promise<Reminder> {
    const validationResult = await this.validateForm()
    
    if (!validationResult.isValid) {
      throw new Error(`Form validation failed: ${validationResult.errors.join(', ')}`)
    }
    
    const reminder: Reminder = {
      id: this.formData.id || this.generateReminderId(),
      userId: this.userPreferences.userId,
      title: this.formData.title || '',
      description: this.formData.description || '',
      type: this.formData.type || ReminderType.TIME_BASED,
      triggerTime: this.formData.triggerTime || new Date(),
      priority: this.formData.priority || 'medium',
      deliveryMethods: this.formData.deliveryMethods || this.getDefaultDeliveryMethods(),
      contextConstraints: this.formData.contextConstraints || [],
      escalationRules: this.formData.escalationRules || [],
      completionStatus: CompletionStatus.PENDING,
      snoozeHistory: [],
      userFeedback: [],
      recurrence: this.formData.recurrence,
      isActive: true
    }
    
    this.emit('reminderSubmitted', reminder)
    return reminder
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
          ${await this.generateTypeField()}
          ${await this.generateTimeField()}
          ${await this.generateDescriptionField()}
          ${await this.generateNotificationMethodField()}
          ${await this.generateRecurrenceField()}
          
          ${this.childFriendlyConfig.showHelpText ? await this.generateFormHelp() : ''}
        </form>
      </div>
    `
  }

  private async generateFormText(): Promise<string> {
    return `${this.getFormTitle()}\n\nSet up a reminder so you don't forget important things!`
  }

  private async generateFormActions(): Promise<UIAction[]> {
    return [
      {
        id: 'save-reminder',
        label: this.getChildFriendlyLabel('Save Reminder'),
        icon: 'bell',
        handler: async () => await this.submitForm(),
        accessibility: {
          ariaLabel: `${this.isEditing ? 'Update' : 'Save'} this reminder`,
          tabIndex: 100,
          keyboardShortcut: 'Ctrl+S',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'cancel-reminder-form',
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
      return this.isEditing ? 'Change Your Reminder' : 'Set Up a Reminder'
    }
    return this.isEditing ? 'Edit Reminder' : 'Create New Reminder'
  }

  private getChildFriendlyLabel(label: string): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return label
    }

    const childFriendlyLabels: Record<string, string> = {
      'Save Reminder': 'Save My Reminder',
      'Cancel': 'Never Mind'
    }

    return childFriendlyLabels[label] || label
  }

  private getFormCSSClasses(): Record<string, string> {
    const baseClasses = {
      container: 'reminder-form-container',
      title: 'reminder-form-title',
      form: 'reminder-form',
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
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'What should we remind you about?' : 'Reminder Title'
    const placeholder = this.childFriendlyConfig.useSimpleLanguage ? 'Brush teeth, do homework, etc.' : 'Enter reminder title'
    
    return `
      <div class="form-field">
        <label for="reminder-title" class="form-label">${label}</label>
        <input 
          type="text" 
          id="reminder-title" 
          class="form-input" 
          value="${this.formData.title || ''}"
          placeholder="${placeholder}"
          required
          aria-describedby="title-help"
        />
        <div id="title-help" class="field-help">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Tell us what you want to remember!' : 'Enter what you want to be reminded about'}
        </div>
      </div>
    `
  }

  private async generateTypeField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'What kind of reminder is this?' : 'Reminder Type'
    
    const types = this.getChildFriendlyReminderTypes()
    const options = types.map(type => 
      `<option value="${type.value}" ${this.formData.type === type.value ? 'selected' : ''}>${type.label}</option>`
    ).join('')
    
    return `
      <div class="form-field">
        <label for="reminder-type" class="form-label">${label}</label>
        <select id="reminder-type" class="form-input">
          ${options}
        </select>
        <div class="field-help">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Choose when you want to be reminded' : 'Select the type of reminder'}
        </div>
      </div>
    `
  }

  private async generateTimeField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'When should we remind you?' : 'Reminder Time'
    
    return `
      <div class="form-field">
        <label for="reminder-time" class="form-label">${label}</label>
        <input 
          type="datetime-local" 
          id="reminder-time" 
          class="form-input"
          value="${this.formatDateTimeForInput(this.formData.triggerTime)}"
          required
        />
        <div class="field-help">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Pick the exact time you want to be reminded' : 'Set the date and time for this reminder'}
        </div>
      </div>
    `
  }

  private async generateDescriptionField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'Any extra details?' : 'Description'
    const placeholder = this.childFriendlyConfig.useSimpleLanguage ? 'What do you need to remember to do or bring?' : 'Enter additional details'
    
    return `
      <div class="form-field">
        <label for="reminder-description" class="form-label">${label}</label>
        <textarea 
          id="reminder-description" 
          class="form-input form-textarea"
          placeholder="${placeholder}"
          rows="2"
        >${this.formData.description || ''}</textarea>
      </div>
    `
  }

  private async generateNotificationMethodField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'How should we remind you?' : 'Notification Method'
    
    const methods = this.getChildFriendlyNotificationMethods()
    const checkboxes = methods.map(method => {
      const isChecked = this.formData.deliveryMethods?.includes(method.value) || 
                       this.userPreferences.preferredNotificationMethods.includes(method.value)
      
      return `
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            name="notification-methods"
            value="${method.value}"
            ${isChecked ? 'checked' : ''}
          />
          ${method.label}
        </label>
      `
    }).join('')
    
    return `
      <div class="form-field">
        <fieldset>
          <legend class="form-label">${label}</legend>
          <div class="checkbox-group">
            ${checkboxes}
          </div>
          <div class="field-help">
            ${this.childFriendlyConfig.useSimpleLanguage ? 'You can pick more than one way!' : 'Select one or more notification methods'}
          </div>
        </fieldset>
      </div>
    `
  }

  private async generateRecurrenceField(): Promise<string> {
    const label = this.childFriendlyConfig.useSimpleLanguage ? 'Should we remind you again?' : 'Repeat Reminder'
    
    return `
      <div class="form-field">
        <label for="reminder-recurrence" class="form-label">${label}</label>
        <select id="reminder-recurrence" class="form-input">
          <option value="">Just once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
          <option value="monthly">Every month</option>
          <option value="weekdays">School days only</option>
          <option value="weekends">Weekends only</option>
        </select>
        <div class="field-help">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Choose if this happens regularly' : 'Set if this reminder should repeat'}
        </div>
      </div>
    `
  }

  private async generateFormHelp(): Promise<string> {
    return `
      <div class="form-help">
        <h4>Tips for great reminders:</h4>
        <ul>
          <li>Be specific about what you need to do</li>
          <li>Set the reminder for a few minutes before you need to do it</li>
          <li>Choose how you want to be reminded (voice, visual, etc.)</li>
          <li>If it's something you do regularly, set it to repeat</li>
        </ul>
      </div>
    `
  }

  private getChildFriendlyReminderTypes(): Array<{value: ReminderType, label: string}> {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return [
        { value: ReminderType.TIME_BASED, label: 'At a specific time' },
        { value: ReminderType.LOCATION_BASED, label: 'When I get somewhere' },
        { value: ReminderType.CONTEXT_BASED, label: 'When I\'m doing something' }
      ]
    }

    return [
      { value: ReminderType.TIME_BASED, label: 'Time-based' },
      { value: ReminderType.LOCATION_BASED, label: 'Location-based' },
      { value: ReminderType.CONTEXT_BASED, label: 'Context-based' }
    ]
  }

  private getChildFriendlyNotificationMethods(): Array<{value: NotificationMethod, label: string}> {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      return [
        { value: NotificationMethod.VOICE, label: 'Tell me out loud' },
        { value: NotificationMethod.VISUAL, label: 'Show me on screen' },
        { value: NotificationMethod.AVATAR, label: 'Have my avatar tell me' },
        { value: NotificationMethod.SOUND, label: 'Play a sound' }
      ]
    }

    return [
      { value: NotificationMethod.VOICE, label: 'Voice notification' },
      { value: NotificationMethod.VISUAL, label: 'Visual notification' },
      { value: NotificationMethod.AVATAR, label: 'Avatar notification' },
      { value: NotificationMethod.SOUND, label: 'Sound notification' }
    ]
  }

  private getDefaultDeliveryMethods(): NotificationMethod[] {
    return this.userPreferences.preferredNotificationMethods.length > 0
      ? this.userPreferences.preferredNotificationMethods
      : [NotificationMethod.VOICE, NotificationMethod.VISUAL]
  }

  private formatDateTimeForInput(date?: Date): string {
    if (!date) {
      // Default to 15 minutes from now
      const defaultTime = new Date()
      defaultTime.setMinutes(defaultTime.getMinutes() + 15)
      date = defaultTime
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
      errors.push('Reminder title is required')
    }
    
    if (!this.formData.triggerTime) {
      errors.push('Reminder time is required')
    }
    
    if (this.formData.triggerTime && this.formData.triggerTime <= new Date()) {
      errors.push('Reminder time must be in the future')
    }
    
    if (!this.formData.deliveryMethods || this.formData.deliveryMethods.length === 0) {
      errors.push('At least one notification method must be selected')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private generateReminderId(): string {
    return `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Reminder List Component
 * Displays active reminders with child-friendly interface
 */
export class ReminderListComponent extends EventEmitter implements UIComponent {
  private reminders: Reminder[] = []
  private userPreferences: UserPreferences
  private childFriendlyConfig: ChildFriendlyConfig
  private filter: ReminderFilter = ReminderFilter.ALL
  
  constructor(
    userPreferences: UserPreferences,
    childFriendlyConfig: ChildFriendlyConfig
  ) {
    super()
    this.userPreferences = userPreferences
    this.childFriendlyConfig = childFriendlyConfig
  }

  async render(): Promise<UIElement> {
    const content = await this.generateListContent()
    
    return {
      id: 'reminder-list',
      type: UIElementType.NOTIFICATION_PANEL,
      content,
      accessibility: {
        ariaLabel: 'List of your reminders',
        ariaDescription: `Showing ${this.getFilteredReminders().length} reminders`,
        tabIndex: 0,
        screenReaderText: await this.generateScreenReaderText(),
        highContrastSupport: this.userPreferences.highContrastMode,
        largeTextSupport: this.userPreferences.largeText
      },
      childFriendly: true
    }
  }

  async update(data: { reminders?: Reminder[], filter?: ReminderFilter }): Promise<void> {
    if (data.reminders) {
      this.reminders = data.reminders
    }
    
    if (data.filter) {
      this.filter = data.filter
    }
    
    this.emit('updated', { reminders: this.reminders, filter: this.filter })
  }

  async destroy(): Promise<void> {
    this.removeAllListeners()
  }

  isAccessible(): boolean {
    return true
  }

  async setFilter(filter: ReminderFilter): Promise<void> {
    this.filter = filter
    await this.update({ filter })
  }

  async completeReminder(reminderId: string): Promise<void> {
    const reminder = this.reminders.find(r => r.id === reminderId)
    if (reminder) {
      reminder.completionStatus = CompletionStatus.COMPLETED
      this.emit('reminderCompleted', reminder)
    }
  }

  async snoozeReminder(reminderId: string, minutes: number): Promise<void> {
    const reminder = this.reminders.find(r => r.id === reminderId)
    if (reminder) {
      const newTriggerTime = new Date(Date.now() + minutes * 60000)
      reminder.triggerTime = newTriggerTime
      reminder.snoozeHistory.push({
        snoozeTime: new Date(),
        duration: minutes,
        reason: 'user_requested'
      })
      this.emit('reminderSnoozed', { reminder, minutes })
    }
  }

  private async generateListContent(): Promise<UIContent> {
    const actions = await this.generateListActions()
    
    return {
      html: await this.generateListHTML(),
      text: await this.generateListText(),
      actions
    }
  }

  private async generateListHTML(): Promise<string> {
    const cssClasses = this.getListCSSClasses()
    const filteredReminders = this.getFilteredReminders()
    
    return `
      <div class="${cssClasses.container}">
        <div class="${cssClasses.header}">
          <h2 class="${cssClasses.title}">
            ${this.getListTitle()}
          </h2>
          ${await this.generateFilterControls()}
        </div>
        
        <div class="${cssClasses.list}">
          ${filteredReminders.length > 0 
            ? filteredReminders.map(reminder => this.generateReminderHTML(reminder)).join('')
            : this.generateEmptyStateHTML()
          }
        </div>
      </div>
    `
  }

  private async generateListText(): Promise<string> {
    const filteredReminders = this.getFilteredReminders()
    const title = this.getListTitle()
    
    if (filteredReminders.length === 0) {
      return `${title}\n\nNo reminders to show.`
    }
    
    const reminderTexts = filteredReminders.map(reminder => {
      const time = this.formatReminderTime(reminder)
      return `${time}: ${reminder.title}`
    })
    
    return `${title}\n\n${reminderTexts.join('\n')}`
  }

  private async generateListActions(): Promise<UIAction[]> {
    return [
      {
        id: 'add-reminder',
        label: this.getChildFriendlyLabel('Add Reminder'),
        icon: 'plus',
        handler: async () => this.emit('addReminder'),
        accessibility: {
          ariaLabel: 'Add a new reminder',
          tabIndex: 1,
          keyboardShortcut: 'Ctrl+N',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      },
      {
        id: 'refresh-reminders',
        label: this.getChildFriendlyLabel('Refresh'),
        icon: 'refresh',
        handler: async () => this.emit('refreshRequested'),
        accessibility: {
          ariaLabel: 'Refresh the reminder list',
          tabIndex: 2,
          keyboardShortcut: 'F5',
          highContrastSupport: true,
          largeTextSupport: true
        },
        childSafe: true
      }
    ]
  }

  private getListTitle(): string {
    if (this.childFriendlyConfig.useSimpleLanguage) {
      const filterLabels = {
        [ReminderFilter.ALL]: 'All My Reminders',
        [ReminderFilter.ACTIVE]: 'Coming Up Soon',
        [ReminderFilter.COMPLETED]: 'Already Done',
        [ReminderFilter.OVERDUE]: 'Oops, I Missed These'
      }
      return filterLabels[this.filter]
    }

    const filterLabels = {
      [ReminderFilter.ALL]: 'All Reminders',
      [ReminderFilter.ACTIVE]: 'Active Reminders',
      [ReminderFilter.COMPLETED]: 'Completed Reminders',
      [ReminderFilter.OVERDUE]: 'Overdue Reminders'
    }
    return filterLabels[this.filter]
  }

  private getChildFriendlyLabel(label: string): string {
    if (!this.childFriendlyConfig.useSimpleLanguage) {
      return label
    }

    const childFriendlyLabels: Record<string, string> = {
      'Add Reminder': 'Add New Reminder',
      'Refresh': 'Check for Updates'
    }

    return childFriendlyLabels[label] || label
  }

  private getListCSSClasses(): Record<string, string> {
    const baseClasses = {
      container: 'reminder-list-container',
      header: 'reminder-list-header',
      title: 'reminder-list-title',
      list: 'reminder-list',
      item: 'reminder-item',
      filter: 'reminder-filter'
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

  private async generateFilterControls(): Promise<string> {
    const filters = [
      { value: ReminderFilter.ALL, label: this.childFriendlyConfig.useSimpleLanguage ? 'All' : 'All' },
      { value: ReminderFilter.ACTIVE, label: this.childFriendlyConfig.useSimpleLanguage ? 'Coming Up' : 'Active' },
      { value: ReminderFilter.COMPLETED, label: this.childFriendlyConfig.useSimpleLanguage ? 'Done' : 'Completed' },
      { value: ReminderFilter.OVERDUE, label: this.childFriendlyConfig.useSimpleLanguage ? 'Missed' : 'Overdue' }
    ]
    
    const buttons = filters.map(filter => 
      `<button 
        class="filter-button ${this.filter === filter.value ? 'active' : ''}"
        data-filter="${filter.value}"
        aria-pressed="${this.filter === filter.value}"
      >
        ${filter.label}
      </button>`
    ).join('')
    
    return `
      <div class="reminder-filters">
        ${buttons}
      </div>
    `
  }

  private generateReminderHTML(reminder: Reminder): string {
    const cssClasses = this.getListCSSClasses()
    const timeDisplay = this.formatReminderTime(reminder)
    const statusClass = this.getReminderStatusClass(reminder)
    
    return `
      <div class="${cssClasses.item} ${statusClass}" data-reminder-id="${reminder.id}">
        <div class="reminder-content">
          <div class="reminder-title">${this.sanitizeText(reminder.title)}</div>
          <div class="reminder-time">${timeDisplay}</div>
          ${reminder.description ? `<div class="reminder-description">${this.sanitizeText(reminder.description)}</div>` : ''}
        </div>
        
        <div class="reminder-actions">
          ${this.generateReminderActionButtons(reminder)}
        </div>
      </div>
    `
  }

  private generateReminderActionButtons(reminder: Reminder): string {
    const buttons: string[] = []
    
    if (reminder.completionStatus === CompletionStatus.PENDING) {
      buttons.push(`
        <button 
          class="reminder-action-btn complete-btn"
          data-action="complete"
          data-reminder-id="${reminder.id}"
          aria-label="Mark as completed"
        >
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Done!' : 'Complete'}
        </button>
      `)
      
      buttons.push(`
        <button 
          class="reminder-action-btn snooze-btn"
          data-action="snooze"
          data-reminder-id="${reminder.id}"
          aria-label="Snooze reminder"
        >
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Later' : 'Snooze'}
        </button>
      `)
    }
    
    buttons.push(`
      <button 
        class="reminder-action-btn edit-btn"
        data-action="edit"
        data-reminder-id="${reminder.id}"
        aria-label="Edit reminder"
      >
        ${this.childFriendlyConfig.useSimpleLanguage ? 'Change' : 'Edit'}
      </button>
    `)
    
    return buttons.join('')
  }

  private generateEmptyStateHTML(): string {
    const message = this.childFriendlyConfig.useSimpleLanguage
      ? "You don't have any reminders right now. Want to add one?"
      : "No reminders found. Click 'Add Reminder' to create one."
    
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <div class="empty-state-message">${message}</div>
        <button class="empty-state-action" data-action="add-reminder">
          ${this.childFriendlyConfig.useSimpleLanguage ? 'Add My First Reminder' : 'Add Reminder'}
        </button>
      </div>
    `
  }

  private getFilteredReminders(): Reminder[] {
    const now = new Date()
    
    switch (this.filter) {
      case ReminderFilter.ACTIVE:
        return this.reminders.filter(r => 
          r.completionStatus === CompletionStatus.PENDING && r.triggerTime > now
        )
      case ReminderFilter.COMPLETED:
        return this.reminders.filter(r => r.completionStatus === CompletionStatus.COMPLETED)
      case ReminderFilter.OVERDUE:
        return this.reminders.filter(r => 
          r.completionStatus === CompletionStatus.PENDING && r.triggerTime <= now
        )
      case ReminderFilter.ALL:
      default:
        return this.reminders
    }
  }

  private getReminderStatusClass(reminder: Reminder): string {
    const now = new Date()
    
    if (reminder.completionStatus === CompletionStatus.COMPLETED) {
      return 'completed'
    }
    
    if (reminder.triggerTime <= now) {
      return 'overdue'
    }
    
    // Check if reminder is due soon (within next hour)
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
    if (reminder.triggerTime <= oneHourFromNow) {
      return 'due-soon'
    }
    
    return 'active'
  }

  private formatReminderTime(reminder: Reminder): string {
    const now = new Date()
    const timeDiff = reminder.triggerTime.getTime() - now.getTime()
    
    if (reminder.completionStatus === CompletionStatus.COMPLETED) {
      return this.childFriendlyConfig.useSimpleLanguage ? 'All done!' : 'Completed'
    }
    
    if (timeDiff < 0) {
      const overdueDiff = Math.abs(timeDiff)
      const hours = Math.floor(overdueDiff / (1000 * 60 * 60))
      const minutes = Math.floor((overdueDiff % (1000 * 60 * 60)) / (1000 * 60))
      
      if (this.childFriendlyConfig.useSimpleLanguage) {
        if (hours > 0) {
          return `Oops! ${hours} hour${hours > 1 ? 's' : ''} ago`
        }
        return `Oops! ${minutes} minute${minutes > 1 ? 's' : ''} ago`
      }
      
      if (hours > 0) {
        return `Overdue by ${hours}h ${minutes}m`
      }
      return `Overdue by ${minutes}m`
    }
    
    // Format future time
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    const timeString = reminder.triggerTime.toLocaleTimeString(
      this.userPreferences.voiceLanguage || 'en-US',
      options
    )
    
    // Check if it's today, tomorrow, or another day
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (this.isSameDay(reminder.triggerTime, today)) {
      return `Today at ${timeString}`
    } else if (this.isSameDay(reminder.triggerTime, tomorrow)) {
      return `Tomorrow at ${timeString}`
    } else {
      const dateString = reminder.triggerTime.toLocaleDateString(
        this.userPreferences.voiceLanguage || 'en-US',
        { month: 'short', day: 'numeric' }
      )
      return `${dateString} at ${timeString}`
    }
  }

  private async generateScreenReaderText(): Promise<string> {
    const filteredReminders = this.getFilteredReminders()
    const count = filteredReminders.length
    
    if (count === 0) {
      return `No reminders in ${this.filter} category`
    }
    
    return `${count} reminder${count > 1 ? 's' : ''} in ${this.filter} category`
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

export enum ReminderFilter {
  ALL = 'all',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}