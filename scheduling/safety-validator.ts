// Schedule content safety validation system
// Validates all calendar events and reminders for child-appropriate content

import { CalendarEvent, EventCategory, VisibilityLevel } from '../calendar/types'
import { Reminder, ReminderType } from '../reminders/types'

export interface SafetyValidationResult {
  isValid: boolean
  violations: SafetyViolation[]
  riskLevel: RiskLevel
  recommendations: string[]
  filteredContent?: FilteredContent
}

export interface SafetyViolation {
  type: ViolationType
  field: string
  originalContent: string
  severity: ViolationSeverity
  description: string
  suggestedFix?: string
}

export enum ViolationType {
  INAPPROPRIATE_LANGUAGE = 'inappropriate_language',
  ADULT_CONTENT = 'adult_content',
  VIOLENCE = 'violence',
  UNSAFE_LOCATION = 'unsafe_location',
  INAPPROPRIATE_TIME = 'inappropriate_time',
  EXTERNAL_LINK = 'external_link',
  PERSONAL_INFO = 'personal_info',
  COMMERCIAL_CONTENT = 'commercial_content'
}

export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskLevel {
  SAFE = 'safe',
  LOW_RISK = 'low_risk',
  MEDIUM_RISK = 'medium_risk',
  HIGH_RISK = 'high_risk',
  BLOCKED = 'blocked'
}

export interface FilteredContent {
  title?: string
  description?: string
  location?: string
  attendeeNames?: string[]
}

export interface SafetyConfig {
  strictMode: boolean
  allowedCategories: EventCategory[]
  blockedKeywords: string[]
  allowedDomains: string[]
  maxEventDuration: number // in hours
  allowedTimeRanges: TimeRestriction[]
  externalContentFiltering: boolean
}

export interface TimeRestriction {
  startHour: number
  endHour: number
  daysOfWeek: number[]
  description: string
}

export interface SafetyAuditLog {
  id: string
  timestamp: Date
  userId: string
  contentType: 'event' | 'reminder' | 'external_calendar'
  contentId: string
  validationResult: SafetyValidationResult
  action: SafetyAction
  parentalOverride?: boolean
  source: string
}

export enum SafetyAction {
  APPROVED = 'approved',
  BLOCKED = 'blocked',
  FILTERED = 'filtered',
  FLAGGED_FOR_REVIEW = 'flagged_for_review',
  PARENTAL_APPROVAL_REQUIRED = 'parental_approval_required'
}

/**
 * Main safety validator for scheduling content
 * Validates calendar events, reminders, and external calendar data
 */
export class ScheduleSafetyValidator {
  private config: SafetyConfig
  private auditLogs: SafetyAuditLog[] = []
  
  // Comprehensive list of inappropriate keywords and patterns
  private readonly BLOCKED_KEYWORDS = [
    // Violence and weapons
    'violence', 'weapon', 'gun', 'knife', 'fight', 'attack', 'kill', 'murder',
    'bomb', 'explosive', 'dangerous', 'harm', 'hurt', 'blood', 'death',
    
    // Adult content
    'adult', 'mature', 'explicit', 'inappropriate', 'sexual', 'intimate',
    'dating', 'romance', 'relationship', 'private', 'secret',
    
    // Substances
    'alcohol', 'beer', 'wine', 'drink', 'smoking', 'cigarette', 'drug',
    'medication', 'pills', 'prescription',
    
    // Commercial/spam
    'buy', 'purchase', 'sale', 'discount', 'offer', 'deal', 'money',
    'credit', 'loan', 'investment', 'gambling', 'casino',
    
    // Unsafe activities
    'alone', 'unsupervised', 'without parent', 'secret meeting',
    'don\'t tell', 'keep quiet', 'our secret'
  ]
  
  // Safe, educational, and family-friendly keywords
  private readonly SAFE_KEYWORDS = [
    'school', 'homework', 'study', 'learn', 'education', 'class', 'lesson',
    'family', 'parent', 'sibling', 'grandparent', 'relative',
    'friend', 'playdate', 'game', 'toy', 'book', 'read',
    'sport', 'exercise', 'practice', 'team', 'coach',
    'art', 'music', 'dance', 'creative', 'craft',
    'doctor', 'dentist', 'checkup', 'appointment', 'health',
    'birthday', 'celebration', 'party', 'holiday', 'vacation'
  ]
  
  // URL patterns that are generally safe for children
  private readonly SAFE_DOMAINS = [
    'school.edu', 'library.org', 'museum.org', 'kids.', 'children.',
    'education.', 'learning.', 'family.', 'parent.'
  ]

  constructor(config: SafetyConfig) {
    const defaultConfig = {
      strictMode: true,
      allowedCategories: [
        EventCategory.EDUCATION,
        EventCategory.FAMILY,
        EventCategory.HEALTH,
        EventCategory.ENTERTAINMENT
      ],
      blockedKeywords: this.BLOCKED_KEYWORDS,
      allowedDomains: this.SAFE_DOMAINS,
      maxEventDuration: 8, // 8 hours max
      allowedTimeRanges: [
        {
          startHour: 6,
          endHour: 21,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          description: 'General allowed hours'
        }
      ],
      externalContentFiltering: true
    }
    
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Validates a calendar event for child safety
   */
  async validateEvent(event: CalendarEvent, userId: string): Promise<SafetyValidationResult> {
    const violations: SafetyViolation[] = []
    
    // Validate title
    const titleViolations = this.validateText(event.title, 'title')
    violations.push(...titleViolations)
    
    // Validate description
    const descriptionViolations = this.validateText(event.description, 'description')
    violations.push(...descriptionViolations)
    
    // Validate location
    if (event.location) {
      const locationViolations = this.validateLocation(event.location.name)
      violations.push(...locationViolations)
    }
    
    // Validate category
    if (!this.config.allowedCategories.includes(event.category)) {
      violations.push({
        type: ViolationType.INAPPROPRIATE_LANGUAGE,
        field: 'category',
        originalContent: event.category,
        severity: ViolationSeverity.MEDIUM,
        description: `Event category '${event.category}' is not allowed for children`,
        suggestedFix: `Change to one of: ${this.config.allowedCategories.join(', ')}`
      })
    }
    
    // Validate event duration
    const duration = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60)
    if (duration > this.config.maxEventDuration) {
      violations.push({
        type: ViolationType.INAPPROPRIATE_TIME,
        field: 'duration',
        originalContent: `${duration} hours`,
        severity: ViolationSeverity.MEDIUM,
        description: `Event duration exceeds maximum allowed (${this.config.maxEventDuration} hours)`,
        suggestedFix: `Reduce duration to ${this.config.maxEventDuration} hours or less`
      })
    }
    
    // Validate time restrictions
    const timeViolations = this.validateEventTime(event)
    violations.push(...timeViolations)
    
    // Validate attendees
    const attendeeViolations = this.validateAttendees(event.attendees)
    violations.push(...attendeeViolations)
    
    // Validate external content if from external source
    if (event.metadata?.source !== 'local') {
      const externalViolations = await this.validateExternalEvent(event, event.metadata.source)
      violations.push(...externalViolations)
    }
    
    const result = this.generateValidationResult(violations)
    
    // Log the validation
    await this.logSafetyValidation(userId, 'event', event.id, result, 'calendar_event')
    
    return result
  }

  /**
   * Validates a reminder for child safety
   */
  async validateReminder(reminder: Reminder, userId: string): Promise<SafetyValidationResult> {
    const violations: SafetyViolation[] = []
    
    // Validate title
    const titleViolations = this.validateText(reminder.title, 'title')
    violations.push(...titleViolations)
    
    // Validate description
    const descriptionViolations = this.validateText(reminder.description, 'description')
    violations.push(...descriptionViolations)
    
    // Validate reminder timing
    const timeViolations = this.validateReminderTime(reminder)
    violations.push(...timeViolations)
    
    const result = this.generateValidationResult(violations)
    
    // Log the validation
    await this.logSafetyValidation(userId, 'reminder', reminder.id, result, 'reminder_system')
    
    return result
  }

  /**
   * Validates external calendar content (ICS subscriptions, imported events)
   */
  async validateExternalCalendarContent(
    content: string,
    source: string,
    userId: string
  ): Promise<SafetyValidationResult> {
    const violations: SafetyViolation[] = []
    
    // Parse and validate ICS content
    const events = this.parseICSContent(content)
    
    for (const event of events) {
      const eventViolations = await this.validateExternalEvent(event, source)
      violations.push(...eventViolations)
    }
    
    // Additional validation for external sources
    if (this.config.externalContentFiltering) {
      const sourceViolations = this.validateExternalSource(source)
      violations.push(...sourceViolations)
    }
    
    const result = this.generateValidationResult(violations)
    
    // Log the validation
    await this.logSafetyValidation(userId, 'external_calendar', source, result, source)
    
    return result
  }

  /**
   * Validates text content for inappropriate language and content
   */
  private validateText(text: string, field: string): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    if (!text) return violations
    
    const lowerText = text.toLowerCase()
    
    // Check for blocked keywords
    for (const keyword of this.config.blockedKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        violations.push({
          type: ViolationType.INAPPROPRIATE_LANGUAGE,
          field,
          originalContent: text,
          severity: this.getKeywordSeverity(keyword),
          description: `Contains inappropriate keyword: "${keyword}"`,
          suggestedFix: `Remove or replace the word "${keyword}"`
        })
      }
    }
    
    // Check for URLs and external links
    const urlPattern = /https?:\/\/[^\s]+/gi
    const urls = text.match(urlPattern)
    if (urls) {
      for (const url of urls) {
        if (!this.isAllowedDomain(url)) {
          violations.push({
            type: ViolationType.EXTERNAL_LINK,
            field,
            originalContent: url,
            severity: ViolationSeverity.HIGH,
            description: `Contains external link to unverified domain: ${url}`,
            suggestedFix: 'Remove external links or verify domain safety'
          })
        }
      }
    }
    
    // Check for personal information patterns
    const personalInfoViolations = this.detectPersonalInfo(text, field)
    violations.push(...personalInfoViolations)
    
    return violations
  }

  /**
   * Validates location information
   */
  private validateLocation(location: string): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    if (!location) return violations
    
    const lowerLocation = location.toLowerCase()
    
    // Check for unsafe location keywords
    const unsafeLocations = ['bar', 'club', 'casino', 'adult', 'private residence unknown']
    
    for (const unsafe of unsafeLocations) {
      if (lowerLocation.includes(unsafe)) {
        violations.push({
          type: ViolationType.UNSAFE_LOCATION,
          field: 'location',
          originalContent: location,
          severity: ViolationSeverity.HIGH,
          description: `Location may not be appropriate for children: "${unsafe}"`,
          suggestedFix: 'Choose a family-friendly location'
        })
      }
    }
    
    return violations
  }

  /**
   * Validates event timing against allowed time ranges
   */
  private validateEventTime(event: CalendarEvent): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    const eventHour = event.startTime.getHours()
    const eventDay = event.startTime.getDay()
    
    let isAllowedTime = false
    
    for (const timeRange of this.config.allowedTimeRanges) {
      if (
        timeRange.daysOfWeek.includes(eventDay) &&
        eventHour >= timeRange.startHour &&
        eventHour <= timeRange.endHour
      ) {
        isAllowedTime = true
        break
      }
    }
    
    if (!isAllowedTime) {
      violations.push({
        type: ViolationType.INAPPROPRIATE_TIME,
        field: 'startTime',
        originalContent: event.startTime.toISOString(),
        severity: ViolationSeverity.MEDIUM,
        description: `Event scheduled outside allowed time ranges`,
        suggestedFix: 'Reschedule to an appropriate time for children'
      })
    }
    
    return violations
  }

  /**
   * Validates reminder timing
   */
  private validateReminderTime(reminder: Reminder): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    const reminderHour = reminder.triggerTime.getHours()
    
    // Don't allow reminders during typical sleep hours
    if (reminderHour < 6 || reminderHour > 21) {
      violations.push({
        type: ViolationType.INAPPROPRIATE_TIME,
        field: 'triggerTime',
        originalContent: reminder.triggerTime.toISOString(),
        severity: ViolationSeverity.MEDIUM,
        description: 'Reminder scheduled during sleep hours',
        suggestedFix: 'Reschedule reminder between 6 AM and 9 PM'
      })
    }
    
    return violations
  }

  /**
   * Validates attendee information
   */
  private validateAttendees(attendees: any[]): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    for (const attendee of attendees) {
      if (attendee.email) {
        // Basic email validation and domain checking
        const emailDomain = attendee.email.split('@')[1]
        if (emailDomain && !this.isAllowedDomain(`https://${emailDomain}`)) {
          violations.push({
            type: ViolationType.EXTERNAL_LINK,
            field: 'attendees',
            originalContent: attendee.email,
            severity: ViolationSeverity.MEDIUM,
            description: `Attendee email from unverified domain: ${emailDomain}`,
            suggestedFix: 'Verify attendee identity with parent/guardian'
          })
        }
      }
    }
    
    return violations
  }

  /**
   * Validates external calendar events
   */
  private async validateExternalEvent(event: any, source: string): Promise<SafetyViolation[]> {
    const violations: SafetyViolation[] = []
    
    // Apply stricter validation for external content
    if (event.title) {
      const titleViolations = this.validateText(event.title, 'title')
      violations.push(...titleViolations)
    }
    
    if (event.description) {
      const descriptionViolations = this.validateText(event.description, 'description')
      violations.push(...descriptionViolations)
    }
    
    // Flag all external events for review if in strict mode
    if (this.config.strictMode) {
      violations.push({
        type: ViolationType.EXTERNAL_LINK,
        field: 'source',
        originalContent: source,
        severity: ViolationSeverity.LOW,
        description: 'External calendar content requires review',
        suggestedFix: 'Review content with parent/guardian'
      })
    }
    
    return violations
  }

  /**
   * Validates external source domains
   */
  private validateExternalSource(source: string): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    if (!this.isAllowedDomain(source)) {
      violations.push({
        type: ViolationType.EXTERNAL_LINK,
        field: 'source',
        originalContent: source,
        severity: ViolationSeverity.HIGH,
        description: `External calendar source from unverified domain: ${source}`,
        suggestedFix: 'Only connect to trusted, verified calendar sources'
      })
    }
    
    return violations
  }

  /**
   * Detects personal information in text
   */
  private detectPersonalInfo(text: string, field: string): SafetyViolation[] {
    const violations: SafetyViolation[] = []
    
    // Phone number pattern
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
    if (phonePattern.test(text)) {
      violations.push({
        type: ViolationType.PERSONAL_INFO,
        field,
        originalContent: text,
        severity: ViolationSeverity.HIGH,
        description: 'Contains phone number',
        suggestedFix: 'Remove personal contact information'
      })
    }
    
    // Address pattern (basic)
    const addressPattern = /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln)\b/gi
    if (addressPattern.test(text)) {
      violations.push({
        type: ViolationType.PERSONAL_INFO,
        field,
        originalContent: text,
        severity: ViolationSeverity.HIGH,
        description: 'Contains street address',
        suggestedFix: 'Use general location instead of specific address'
      })
    }
    
    return violations
  }

  /**
   * Determines severity level for blocked keywords
   */
  private getKeywordSeverity(keyword: string): ViolationSeverity {
    const criticalKeywords = ['violence', 'weapon', 'adult', 'sexual', 'drug', 'alcohol']
    const highKeywords = ['fight', 'attack', 'dangerous', 'secret', 'alone']
    
    if (criticalKeywords.some(k => keyword.toLowerCase().includes(k.toLowerCase()))) {
      return ViolationSeverity.CRITICAL
    }
    
    if (highKeywords.some(k => keyword.toLowerCase().includes(k.toLowerCase()))) {
      return ViolationSeverity.HIGH
    }
    
    return ViolationSeverity.MEDIUM
  }

  /**
   * Checks if a domain is in the allowed list
   */
  private isAllowedDomain(url: string): boolean {
    try {
      const domain = new URL(url).hostname.toLowerCase()
      return this.config.allowedDomains.some(allowed => 
        domain.includes(allowed.toLowerCase()) || domain.endsWith(allowed.toLowerCase())
      )
    } catch {
      return false
    }
  }

  /**
   * Parses ICS content to extract events (simplified)
   */
  private parseICSContent(content: string): any[] {
    // Simplified ICS parsing - in production, use a proper ICS parser
    const events: any[] = []
    const lines = content.split('\n')
    let currentEvent: any = null
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine === 'BEGIN:VEVENT') {
        currentEvent = {}
      } else if (trimmedLine === 'END:VEVENT' && currentEvent) {
        events.push(currentEvent)
        currentEvent = null
      } else if (currentEvent && trimmedLine.includes(':')) {
        const [key, ...valueParts] = trimmedLine.split(':')
        const value = valueParts.join(':')
        
        switch (key) {
          case 'SUMMARY':
            currentEvent.title = value
            break
          case 'DESCRIPTION':
            currentEvent.description = value
            break
          case 'LOCATION':
            currentEvent.location = value
            break
        }
      }
    }
    
    return events
  }

  /**
   * Generates final validation result based on violations
   */
  private generateValidationResult(violations: SafetyViolation[]): SafetyValidationResult {
    if (violations.length === 0) {
      return {
        isValid: true,
        violations: [],
        riskLevel: RiskLevel.SAFE,
        recommendations: ['Content is safe for children']
      }
    }
    
    const maxSeverity = Math.max(...violations.map(v => this.severityToNumber(v.severity)))
    const riskLevel = this.determineRiskLevel(maxSeverity, violations.length)
    
    const recommendations = this.generateRecommendations(violations)
    const filteredContent = this.generateFilteredContent(violations)
    
    return {
      isValid: riskLevel === RiskLevel.SAFE || riskLevel === RiskLevel.LOW_RISK,
      violations,
      riskLevel,
      recommendations,
      filteredContent
    }
  }

  /**
   * Converts severity enum to number for comparison
   */
  private severityToNumber(severity: ViolationSeverity): number {
    switch (severity) {
      case ViolationSeverity.LOW: return 1
      case ViolationSeverity.MEDIUM: return 2
      case ViolationSeverity.HIGH: return 3
      case ViolationSeverity.CRITICAL: return 4
      default: return 0
    }
  }

  /**
   * Determines overall risk level based on violations
   */
  private determineRiskLevel(maxSeverity: number, violationCount: number): RiskLevel {
    if (maxSeverity >= 4) return RiskLevel.BLOCKED
    if (maxSeverity >= 3 || violationCount >= 5) return RiskLevel.HIGH_RISK
    if (maxSeverity >= 2 || violationCount >= 3) return RiskLevel.MEDIUM_RISK
    if (violationCount > 0) return RiskLevel.LOW_RISK
    return RiskLevel.SAFE
  }

  /**
   * Generates recommendations based on violations
   */
  private generateRecommendations(violations: SafetyViolation[]): string[] {
    const recommendations: string[] = []
    
    const violationTypes = new Set(violations.map(v => v.type))
    
    if (violationTypes.has(ViolationType.INAPPROPRIATE_LANGUAGE)) {
      recommendations.push('Review and remove inappropriate language')
    }
    
    if (violationTypes.has(ViolationType.EXTERNAL_LINK)) {
      recommendations.push('Verify external links and domains are child-safe')
    }
    
    if (violationTypes.has(ViolationType.INAPPROPRIATE_TIME)) {
      recommendations.push('Reschedule to appropriate times for children')
    }
    
    if (violationTypes.has(ViolationType.PERSONAL_INFO)) {
      recommendations.push('Remove personal information for privacy protection')
    }
    
    if (violations.length > 3) {
      recommendations.push('Consider parental review before approval')
    }
    
    return recommendations
  }

  /**
   * Generates filtered/sanitized content
   */
  private generateFilteredContent(violations: SafetyViolation[]): FilteredContent | undefined {
    const filtered: FilteredContent = {}
    let hasFiltered = false
    
    for (const violation of violations) {
      if (violation.suggestedFix && violation.field) {
        switch (violation.field) {
          case 'title':
            filtered.title = '[Content filtered for safety]'
            hasFiltered = true
            break
          case 'description':
            filtered.description = '[Description filtered for safety]'
            hasFiltered = true
            break
          case 'location':
            filtered.location = '[Location filtered for safety]'
            hasFiltered = true
            break
        }
      }
    }
    
    return hasFiltered ? filtered : undefined
  }

  /**
   * Logs safety validation for audit trail
   */
  private async logSafetyValidation(
    userId: string,
    contentType: 'event' | 'reminder' | 'external_calendar',
    contentId: string,
    result: SafetyValidationResult,
    source: string
  ): Promise<void> {
    const action = this.determineAction(result)
    
    const auditLog: SafetyAuditLog = {
      id: `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      contentType,
      contentId,
      validationResult: result,
      action,
      source
    }
    
    this.auditLogs.push(auditLog)
    
    // In production, persist to secure storage
    console.log(`Safety validation logged: ${action} for ${contentType} ${contentId}`)
  }

  /**
   * Determines action based on validation result
   */
  private determineAction(result: SafetyValidationResult): SafetyAction {
    switch (result.riskLevel) {
      case RiskLevel.SAFE:
        return SafetyAction.APPROVED
      case RiskLevel.LOW_RISK:
        return SafetyAction.APPROVED
      case RiskLevel.MEDIUM_RISK:
        return SafetyAction.FLAGGED_FOR_REVIEW
      case RiskLevel.HIGH_RISK:
        return SafetyAction.PARENTAL_APPROVAL_REQUIRED
      case RiskLevel.BLOCKED:
        return SafetyAction.BLOCKED
      default:
        return SafetyAction.BLOCKED
    }
  }

  /**
   * Gets audit logs for review
   */
  getAuditLogs(userId?: string, startDate?: Date, endDate?: Date): SafetyAuditLog[] {
    let logs = this.auditLogs
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId)
    }
    
    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate)
    }
    
    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate)
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Updates safety configuration
   */
  updateConfig(newConfig: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Gets current safety configuration
   */
  getConfig(): SafetyConfig {
    return { ...this.config }
  }
}

/**
 * Default safety configuration for child-appropriate scheduling
 */
export const DEFAULT_CHILD_SAFETY_CONFIG: SafetyConfig = {
  strictMode: true,
  allowedCategories: [
    EventCategory.EDUCATION,
    EventCategory.FAMILY,
    EventCategory.HEALTH,
    EventCategory.ENTERTAINMENT
  ],
  blockedKeywords: [
    'violence', 'weapon', 'gun', 'knife', 'fight', 'attack', 'kill', 'murder',
    'adult', 'mature', 'explicit', 'inappropriate', 'sexual', 'intimate',
    'alcohol', 'beer', 'wine', 'smoking', 'drug', 'medication',
    'buy', 'purchase', 'sale', 'money', 'gambling', 'casino',
    'alone', 'unsupervised', 'secret', 'don\'t tell'
  ],
  allowedDomains: [
    'school.edu', 'library.org', 'museum.org', 'kids.gov', 'children.org',
    'education.gov', 'learning.com', 'family.org', 'parent.com'
  ],
  maxEventDuration: 8,
  allowedTimeRanges: [
    {
      startHour: 6,
      endHour: 21,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      description: 'General waking hours'
    }
  ],
  externalContentFiltering: true
}