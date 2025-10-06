// Visual notification service for display-based reminder delivery

import { 
  VisualNotificationService, 
  VisualDeliveryResult 
} from './notification-dispatcher'
import { Notification } from './notification-dispatcher'

/**
 * Visual notification service implementation
 * Handles display-based notifications including popups, banners, and screen effects
 */
export class VisualNotificationServiceImpl implements VisualNotificationService {
  private isInitialized = false
  private displayAvailable = false
  private activeNotifications: Map<string, ActiveNotification> = new Map()
  private notificationQueue: QueuedNotification[] = []
  private maxConcurrentNotifications = 3

  constructor() {
    this.initializeDisplaySystem()
  }

  /**
   * Show a popup notification
   */
  async showPopup(notification: Notification): Promise<VisualDeliveryResult> {
    if (!this.displayAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Display system not available'
      }
    }

    try {
      // Validate notification content
      await this.validateNotificationContent(notification)
      
      // Check if we can display immediately or need to queue
      if (this.activeNotifications.size >= this.maxConcurrentNotifications) {
        return await this.queueNotification(notification)
      }
      
      // Create popup display
      const popup = await this.createPopup(notification)
      const startTime = Date.now()
      
      // Track active notification
      this.activeNotifications.set(notification.id, {
        notification,
        popup,
        startTime,
        isVisible: true
      })
      
      // Show popup with timeout
      const result = await this.displayPopup(popup, notification)
      
      // Clean up
      this.activeNotifications.delete(notification.id)
      
      // Process queue if available
      this.processNotificationQueue()
      
      return result
      
    } catch (error) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown display error'
      }
    }
  }

  /**
   * Show a banner notification
   */
  async showBanner(message: string, duration: number): Promise<VisualDeliveryResult> {
    if (!this.displayAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Display system not available'
      }
    }

    try {
      // Validate message content
      await this.validateBannerContent(message)
      
      // Create and display banner
      const startTime = Date.now()
      const result = await this.displayBanner(message, duration)
      
      return {
        ...result,
        displayDuration: Date.now() - startTime
      }
      
    } catch (error) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: error instanceof Error ? error.message : 'Banner display failed'
      }
    }
  }

  /**
   * Flash the screen with a color
   */
  async flashScreen(color: string, duration: number): Promise<VisualDeliveryResult> {
    if (!this.displayAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Display system not available'
      }
    }

    try {
      // Validate color and duration for child safety
      await this.validateFlashParameters(color, duration)
      
      // Perform screen flash
      const startTime = Date.now()
      await this.performScreenFlash(color, duration)
      
      return {
        success: true,
        displayDuration: Date.now() - startTime,
        userDismissed: false,
        clickedThrough: false
      }
      
    } catch (error) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: error instanceof Error ? error.message : 'Screen flash failed'
      }
    }
  }

  /**
   * Check if display system is available
   */
  async isDisplayAvailable(): Promise<boolean> {
    return this.displayAvailable && this.isInitialized
  }

  // Private helper methods

  private async initializeDisplaySystem(): Promise<void> {
    try {
      // Check display system availability
      this.displayAvailable = await this.checkDisplaySystemStatus()
      
      // Initialize notification management
      this.activeNotifications.clear()
      this.notificationQueue = []
      
      this.isInitialized = true
      
    } catch (error) {
      console.error('Failed to initialize display system:', error)
      this.isInitialized = false
      this.displayAvailable = false
    }
  }

  private async checkDisplaySystemStatus(): Promise<boolean> {
    try {
      // In real implementation, this would check the actual display system
      // For now, simulate availability check
      return true
    } catch (error) {
      console.error('Display system check failed:', error)
      return false
    }
  }

  private async validateNotificationContent(notification: Notification): Promise<void> {
    // Implement child safety validation for visual content
    const content = `${notification.title} ${notification.message}`
    
    // Check for inappropriate content
    const inappropriateWords = [
      'scary', 'frightening', 'dangerous', 'harmful',
      'violent', 'aggressive', 'threatening'
    ]
    
    const lowerContent = content.toLowerCase()
    for (const word of inappropriateWords) {
      if (lowerContent.includes(word)) {
        throw new Error(`Visual content failed child safety validation: contains "${word}"`)
      }
    }
    
    // Validate message length for readability
    if (notification.message.length > 200) {
      throw new Error('Notification message too long for visual display')
    }
    
    // Ensure positive, encouraging tone
    if (!this.hasPositiveTone(content)) {
      console.warn('Visual content may not be sufficiently positive for children')
    }
  }

  private async validateBannerContent(message: string): Promise<void> {
    // Validate banner message for child safety
    if (message.length > 100) {
      throw new Error('Banner message too long')
    }
    
    const inappropriateWords = ['error', 'failed', 'danger', 'warning']
    const lowerMessage = message.toLowerCase()
    
    for (const word of inappropriateWords) {
      if (lowerMessage.includes(word)) {
        throw new Error(`Banner content failed child safety validation: contains "${word}"`)
      }
    }
  }

  private async validateFlashParameters(color: string, duration: number): Promise<void> {
    // Validate flash parameters for child safety (prevent seizures)
    if (duration < 100) {
      throw new Error('Flash duration too short - potential seizure risk')
    }
    
    if (duration > 5000) {
      throw new Error('Flash duration too long - may be disruptive')
    }
    
    // Validate color safety (avoid bright flashing colors)
    const dangerousColors = ['red', '#ff0000', 'white', '#ffffff']
    if (dangerousColors.includes(color.toLowerCase())) {
      throw new Error(`Flash color "${color}" not safe for children`)
    }
  }

  private hasPositiveTone(content: string): boolean {
    const positiveWords = [
      'great', 'good', 'wonderful', 'awesome', 'fantastic',
      'remember', 'time', 'ready', 'let\'s', 'you can', 'reminder'
    ]
    
    const lowerContent = content.toLowerCase()
    return positiveWords.some(word => lowerContent.includes(word))
  }

  private async createPopup(notification: Notification): Promise<PopupDisplay> {
    // Create popup display configuration
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      style: this.getPopupStyle(notification),
      buttons: this.getPopupButtons(notification),
      timeout: this.getPopupTimeout(notification),
      position: this.getPopupPosition(notification)
    }
  }

  private getPopupStyle(notification: Notification): PopupStyle {
    // Create child-friendly popup styling based on priority
    const baseStyle: PopupStyle = {
      backgroundColor: '#f0f8ff',
      borderColor: '#87ceeb',
      borderRadius: 15,
      fontSize: 16,
      fontFamily: 'Comic Sans MS, cursive',
      padding: 20,
      shadow: true,
      animation: 'bounce'
    }
    
    // Adjust colors based on priority
    switch (notification.priority) {
      case 4: // CRITICAL
        return { ...baseStyle, borderColor: '#ffa500', backgroundColor: '#fff8dc' }
      case 3: // HIGH
        return { ...baseStyle, borderColor: '#90ee90', backgroundColor: '#f0fff0' }
      case 2: // MEDIUM
        return { ...baseStyle, borderColor: '#87ceeb', backgroundColor: '#f0f8ff' }
      default: // LOW
        return { ...baseStyle, borderColor: '#dda0dd', backgroundColor: '#faf0e6' }
    }
  }

  private getPopupButtons(notification: Notification): PopupButton[] {
    // Create child-friendly buttons
    const buttons: PopupButton[] = [
      {
        id: 'ok',
        text: 'Got it! 👍',
        action: 'acknowledge',
        style: 'primary'
      }
    ]
    
    // Add snooze button for non-critical reminders
    if (notification.priority < 4) {
      buttons.push({
        id: 'snooze',
        text: 'Remind me later ⏰',
        action: 'snooze',
        style: 'secondary'
      })
    }
    
    return buttons
  }

  private getPopupTimeout(notification: Notification): number {
    // Set timeout based on priority (higher priority = longer display)
    switch (notification.priority) {
      case 4: // CRITICAL
        return 15000 // 15 seconds
      case 3: // HIGH
        return 10000 // 10 seconds
      case 2: // MEDIUM
        return 7000  // 7 seconds
      default: // LOW
        return 5000  // 5 seconds
    }
  }

  private getPopupPosition(notification: Notification): PopupPosition {
    // Position popup based on priority and current active notifications
    const activeCount = this.activeNotifications.size
    
    return {
      x: 'center',
      y: activeCount > 0 ? 'top' : 'center',
      offset: activeCount * 60 // Stack notifications
    }
  }

  private async displayPopup(popup: PopupDisplay, notification: Notification): Promise<VisualDeliveryResult> {
    const startTime = Date.now()
    let userDismissed = false
    let clickedThrough = false
    
    try {
      // Simulate popup display
      console.log(`Displaying popup: "${popup.title}" - "${popup.message}"`)
      
      // Simulate user interaction detection
      const userAction = await this.waitForUserAction(popup.timeout)
      
      switch (userAction) {
        case 'acknowledge':
          clickedThrough = true
          break
        case 'dismiss':
          userDismissed = true
          break
        case 'snooze':
          clickedThrough = true
          // Handle snooze action
          break
        case 'timeout':
          // No user action
          break
      }
      
      const duration = Date.now() - startTime
      
      return {
        success: true,
        displayDuration: duration,
        userDismissed,
        clickedThrough
      }
      
    } catch (error) {
      return {
        success: false,
        displayDuration: Date.now() - startTime,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: error instanceof Error ? error.message : 'Popup display failed'
      }
    }
  }

  private async displayBanner(message: string, duration: number): Promise<VisualDeliveryResult> {
    try {
      // Simulate banner display
      console.log(`Displaying banner: "${message}" for ${duration}ms`)
      
      // Simulate display time
      await new Promise(resolve => setTimeout(resolve, Math.min(duration, 100)))
      
      return {
        success: true,
        displayDuration: duration,
        userDismissed: false,
        clickedThrough: false
      }
      
    } catch (error) {
      throw new Error(`Banner display failed: ${error}`)
    }
  }

  private async performScreenFlash(color: string, duration: number): Promise<void> {
    try {
      // Simulate screen flash
      console.log(`Screen flash: ${color} for ${duration}ms`)
      
      // Simulate flash processing
      await new Promise(resolve => setTimeout(resolve, 50))
      
    } catch (error) {
      throw new Error(`Screen flash failed: ${error}`)
    }
  }

  private async waitForUserAction(timeoutMs: number): Promise<string> {
    return new Promise(resolve => {
      // Simulate user action detection
      const actions = ['acknowledge', 'dismiss', 'snooze', 'timeout']
      const randomAction = actions[Math.floor(Math.random() * actions.length)]
      
      // Simulate response time
      const responseTime = Math.random() * timeoutMs
      
      setTimeout(() => {
        resolve(responseTime >= timeoutMs ? 'timeout' : randomAction)
      }, Math.min(responseTime, 1000)) // Cap simulation time
    })
  }

  private async queueNotification(notification: Notification): Promise<VisualDeliveryResult> {
    // Add to queue and return queued result
    this.notificationQueue.push({
      notification,
      queuedAt: new Date()
    })
    
    return {
      success: true,
      displayDuration: 0,
      userDismissed: false,
      clickedThrough: false,
      errorMessage: 'Notification queued for display'
    }
  }

  private processNotificationQueue(): void {
    if (this.notificationQueue.length === 0) {
      return
    }
    
    if (this.activeNotifications.size >= this.maxConcurrentNotifications) {
      return
    }
    
    const queued = this.notificationQueue.shift()!
    
    // Process queued notification
    setTimeout(() => {
      this.showPopup(queued.notification).catch(error => {
        console.error('Failed to display queued notification:', error)
      })
    }, 100)
  }
}

// Supporting interfaces
interface ActiveNotification {
  notification: Notification
  popup: PopupDisplay
  startTime: number
  isVisible: boolean
}

interface QueuedNotification {
  notification: Notification
  queuedAt: Date
}

interface PopupDisplay {
  id: string
  title: string
  message: string
  priority: number
  style: PopupStyle
  buttons: PopupButton[]
  timeout: number
  position: PopupPosition
}

interface PopupStyle {
  backgroundColor: string
  borderColor: string
  borderRadius: number
  fontSize: number
  fontFamily: string
  padding: number
  shadow: boolean
  animation: string
}

interface PopupButton {
  id: string
  text: string
  action: string
  style: 'primary' | 'secondary'
}

interface PopupPosition {
  x: 'left' | 'center' | 'right'
  y: 'top' | 'center' | 'bottom'
  offset: number
}

/**
 * Factory function to create visual notification service
 */
export function createVisualNotificationService(): VisualNotificationService {
  return new VisualNotificationServiceImpl()
}

/**
 * Mock visual service for testing
 */
export class MockVisualNotificationService implements VisualNotificationService {
  private mockAvailable = true
  private displayedNotifications: Notification[] = []

  async showPopup(notification: Notification): Promise<VisualDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Mock visual service unavailable'
      }
    }

    this.displayedNotifications.push(notification)

    return {
      success: true,
      displayDuration: 3000,
      userDismissed: Math.random() > 0.7,
      clickedThrough: Math.random() > 0.5
    }
  }

  async showBanner(message: string, duration: number): Promise<VisualDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Mock visual service unavailable'
      }
    }

    return {
      success: true,
      displayDuration: duration,
      userDismissed: false,
      clickedThrough: false
    }
  }

  async flashScreen(color: string, duration: number): Promise<VisualDeliveryResult> {
    if (!this.mockAvailable) {
      return {
        success: false,
        displayDuration: 0,
        userDismissed: false,
        clickedThrough: false,
        errorMessage: 'Mock visual service unavailable'
      }
    }

    return {
      success: true,
      displayDuration: duration,
      userDismissed: false,
      clickedThrough: false
    }
  }

  async isDisplayAvailable(): Promise<boolean> {
    return this.mockAvailable
  }

  // Test helper methods
  setAvailable(available: boolean): void {
    this.mockAvailable = available
  }

  getDisplayedNotifications(): Notification[] {
    return [...this.displayedNotifications]
  }

  clearDisplayHistory(): void {
    this.displayedNotifications = []
  }
}