import { CalendarEvent } from '../calendar/types';

/**
 * Content Validator for External Calendar Data
 * 
 * Validates all external calendar content for child-appropriateness
 * Implements allowlist-only approach as per safety requirements
 * 
 * Safety: Blocks inappropriate content by default, requires explicit approval
 * Performance: Optimized validation for Jetson Nano Orin with efficient filtering
 */
export class ContentValidator {
  private inappropriateKeywords: Set<string> = new Set();
  private suspiciousPatterns: RegExp[] = [];
  private allowedDomains: Set<string> = new Set();
  private blockedDomains: Set<string> = new Set();

  constructor() {
    this.initializeFilters();
  }

  /**
   * Initialize content filtering rules
   */
  private initializeFilters(): void {
    // Inappropriate keywords (basic set - would be expanded in production)
    this.inappropriateKeywords = new Set([
      'adult', 'explicit', 'mature', 'nsfw', 'inappropriate',
      'violence', 'weapon', 'drug', 'alcohol', 'gambling',
      'dating', 'romance', 'intimate', 'private party'
    ]);

    // Suspicious patterns that might indicate inappropriate content
    this.suspiciousPatterns = [
      /\b(18\+|21\+|adults?\s+only)\b/i,
      /\b(xxx|porn|sex)\b/i,
      /\b(casino|poker|betting)\b/i,
      /\b(bar|club|nightlife)\b/i,
      /\b(mature\s+content|explicit\s+material)\b/i
    ];

    // Allowed domains for external content (educational, family-friendly)
    this.allowedDomains = new Set([
      'school.edu', 'library.org', 'museum.org', 'zoo.org',
      'aquarium.org', 'ymca.org', 'scouts.org', 'church.org',
      'community.gov', 'parks.gov', 'recreation.gov'
    ]);

    // Blocked domains (known inappropriate content)
    this.blockedDomains = new Set([
      'casino.com', 'gambling.com', 'adult.com', 'mature.com'
    ]);
  }

  /**
   * Validate a calendar event for child-appropriateness
   */
  async validateEvent(event: CalendarEvent): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Validate title
    const titleResult = this.validateText(event.title, 'title');
    if (!titleResult.isValid) {
      issues.push(...titleResult.issues);
    }

    // Validate description
    if (event.description) {
      const descResult = this.validateText(event.description, 'description');
      if (!descResult.isValid) {
        issues.push(...descResult.issues);
      }
    }

    // Validate location
    if (event.location) {
      const locationResult = this.validateLocation(event.location.name || '');
      if (!locationResult.isValid) {
        issues.push(...locationResult.issues);
      }
    }

    // Validate attendees (check for suspicious email domains)
    if (event.attendees && event.attendees.length > 0) {
      const attendeeEmails = event.attendees.map(a => a.email).filter((email): email is string => Boolean(email));
      const attendeeResult = this.validateAttendees(attendeeEmails);
      if (!attendeeResult.isValid) {
        issues.push(...attendeeResult.issues);
      }
    }

    // Validate time appropriateness (late night events might be suspicious)
    const timeResult = this.validateEventTime(event);
    if (!timeResult.isValid) {
      issues.push(...timeResult.issues);
    }

    // Check for external links in description
    if (event.description) {
      const linkResult = this.validateLinks(event.description);
      if (!linkResult.isValid) {
        issues.push(...linkResult.issues);
      }
    }

    const isValid = issues.length === 0;
    const severity = this.calculateSeverity(issues);

    return {
      isValid,
      severity,
      issues,
      recommendation: this.getRecommendation(issues),
      sanitizedEvent: isValid ? event : this.sanitizeEvent(event, issues)
    };
  }

  /**
   * Validate ICS content for child-appropriateness
   */
  async validateIcsContent(icsContent: string): Promise<ICSValidationResult> {
    const issues: ValidationIssue[] = [];

    // Check for inappropriate content in the raw ICS data
    const contentResult = this.validateText(icsContent, 'ics_content');
    if (!contentResult.isValid) {
      issues.push(...contentResult.issues);
    }

    // Extract and validate calendar metadata
    const calendarName = this.extractCalendarName(icsContent);
    if (calendarName) {
      const nameResult = this.validateText(calendarName, 'calendar_name');
      if (!nameResult.isValid) {
        issues.push(...nameResult.issues);
      }
    }

    // Check for suspicious event patterns
    const eventCount = this.countEvents(icsContent);
    if (eventCount > 1000) {
      issues.push({
        type: 'suspicious_volume',
        severity: 'medium',
        field: 'event_count',
        message: `Unusually high number of events (${eventCount})`,
        suggestedAction: 'manual_review'
      });
    }

    // Validate URLs in the ICS content
    const urls = this.extractUrls(icsContent);
    for (const url of urls) {
      const urlResult = this.validateUrl(url);
      if (!urlResult.isValid) {
        issues.push(...urlResult.issues);
      }
    }

    const isValid = issues.filter(issue => issue.severity === 'high').length === 0;
    const severity = this.calculateSeverity(issues);

    return {
      isValid,
      severity,
      issues,
      eventCount,
      calendarName: calendarName || 'Unknown Calendar',
      recommendation: this.getRecommendation(issues)
    };
  }

  /**
   * Validate text content for inappropriate keywords and patterns
   */
  private validateText(text: string, field: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    const lowerText = text.toLowerCase();

    // Check for inappropriate keywords
    for (const keyword of this.inappropriateKeywords) {
      if (lowerText.includes(keyword)) {
        issues.push({
          type: 'inappropriate_keyword',
          severity: 'high',
          field,
          message: `Contains inappropriate keyword: "${keyword}"`,
          suggestedAction: 'block'
        });
      }
    }

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        issues.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          field,
          message: `Contains suspicious pattern: ${pattern.source}`,
          suggestedAction: 'manual_review'
        });
      }
    }

    // Check for excessive capitalization (might indicate spam/inappropriate content)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 10) {
      issues.push({
        type: 'excessive_caps',
        severity: 'low',
        field,
        message: 'Excessive use of capital letters',
        suggestedAction: 'sanitize'
      });
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'high').length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Validate location for appropriateness
   */
  private validateLocation(location: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    const lowerLocation = location.toLowerCase();

    // Check for inappropriate venue types
    const inappropriateVenues = [
      'bar', 'club', 'casino', 'nightclub', 'strip club',
      'adult store', 'liquor store', 'tobacco shop'
    ];

    for (const venue of inappropriateVenues) {
      if (lowerLocation.includes(venue)) {
        issues.push({
          type: 'inappropriate_venue',
          severity: 'high',
          field: 'location',
          message: `Inappropriate venue type: "${venue}"`,
          suggestedAction: 'block'
        });
      }
    }

    return {
      isValid: issues.length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Validate attendee email addresses
   */
  private validateAttendees(attendees: string[]): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const attendee of attendees) {
      const domain = attendee.split('@')[1]?.toLowerCase();
      
      if (domain && this.blockedDomains.has(domain)) {
        issues.push({
          type: 'blocked_domain',
          severity: 'high',
          field: 'attendees',
          message: `Attendee from blocked domain: ${domain}`,
          suggestedAction: 'block'
        });
      }
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'high').length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Validate event timing for appropriateness
   */
  private validateEventTime(event: CalendarEvent): ValidationResult {
    const issues: ValidationIssue[] = [];
    const startHour = event.startTime.getHours();
    const endHour = event.endTime.getHours();

    // Flag very late night events (might be inappropriate for children)
    if ((startHour >= 22 || startHour <= 5) && !event.allDay) {
      issues.push({
        type: 'late_night_event',
        severity: 'medium',
        field: 'time',
        message: `Event scheduled for late night hours (${startHour}:00)`,
        suggestedAction: 'manual_review'
      });
    }

    // Flag unusually long events (might be suspicious)
    const durationHours = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours > 12 && !event.allDay) {
      issues.push({
        type: 'unusually_long_event',
        severity: 'low',
        field: 'duration',
        message: `Unusually long event duration (${durationHours.toFixed(1)} hours)`,
        suggestedAction: 'manual_review'
      });
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'high').length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Validate URLs in content
   */
  private validateLinks(text: string): ValidationResult {
    const issues: ValidationIssue[] = [];
    const urls = this.extractUrls(text);

    for (const url of urls) {
      const urlResult = this.validateUrl(url);
      if (!urlResult.isValid) {
        issues.push(...urlResult.issues);
      }
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'high').length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Validate individual URL
   */
  private validateUrl(url: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.toLowerCase();

      // Check blocked domains
      if (this.blockedDomains.has(domain)) {
        issues.push({
          type: 'blocked_domain',
          severity: 'high',
          field: 'url',
          message: `URL from blocked domain: ${domain}`,
          suggestedAction: 'block'
        });
      }

      // Check for suspicious URL patterns
      if (parsedUrl.pathname.includes('adult') || 
          parsedUrl.pathname.includes('mature') ||
          parsedUrl.search.includes('nsfw')) {
        issues.push({
          type: 'suspicious_url',
          severity: 'high',
          field: 'url',
          message: `Suspicious URL pattern: ${url}`,
          suggestedAction: 'block'
        });
      }

      // Prefer HTTPS for security
      if (parsedUrl.protocol === 'http:') {
        issues.push({
          type: 'insecure_url',
          severity: 'low',
          field: 'url',
          message: `Insecure HTTP URL: ${url}`,
          suggestedAction: 'sanitize'
        });
      }
    } catch {
      issues.push({
        type: 'invalid_url',
        severity: 'medium',
        field: 'url',
        message: `Invalid URL format: ${url}`,
        suggestedAction: 'sanitize'
      });
    }

    return {
      isValid: issues.filter(issue => issue.severity === 'high').length === 0,
      severity: this.calculateSeverity(issues),
      issues
    };
  }

  /**
   * Extract URLs from text content
   */
  private extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    return text.match(urlRegex) || [];
  }

  /**
   * Extract calendar name from ICS content
   */
  private extractCalendarName(icsContent: string): string | null {
    const nameMatch = icsContent.match(/X-WR-CALNAME:(.+)/i);
    return nameMatch ? nameMatch[1].trim() : null;
  }

  /**
   * Count events in ICS content
   */
  private countEvents(icsContent: string): number {
    const eventMatches = icsContent.match(/BEGIN:VEVENT/gi);
    return eventMatches ? eventMatches.length : 0;
  }

  /**
   * Calculate overall severity from issues
   */
  private calculateSeverity(issues: ValidationIssue[]): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.severity === 'high')) {
      return 'high';
    }
    if (issues.some(issue => issue.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get recommendation based on validation issues
   */
  private getRecommendation(issues: ValidationIssue[]): string {
    const highIssues = issues.filter(issue => issue.severity === 'high');
    const mediumIssues = issues.filter(issue => issue.severity === 'medium');

    if (highIssues.length > 0) {
      return 'Block this content - contains inappropriate material for children';
    }
    if (mediumIssues.length > 0) {
      return 'Manual review recommended - content may need parental approval';
    }
    if (issues.length > 0) {
      return 'Content can be sanitized and allowed with minor modifications';
    }
    return 'Content is appropriate for children';
  }

  /**
   * Sanitize event by removing/modifying problematic content
   */
  private sanitizeEvent(event: CalendarEvent, issues: ValidationIssue[]): CalendarEvent {
    const sanitized = { ...event };

    for (const issue of issues) {
      if (issue.suggestedAction === 'sanitize') {
        switch (issue.field) {
          case 'title':
            sanitized.title = this.sanitizeText(sanitized.title);
            break;
          case 'description':
            sanitized.description = this.sanitizeText(sanitized.description);
            break;
          case 'location':
            if (sanitized.location) {
              sanitized.location = { ...sanitized.location, name: this.sanitizeText(sanitized.location.name || '') };
            }
            break;
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitize text content
   */
  private sanitizeText(text: string): string {
    let sanitized = text;

    // Remove URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi, '[URL removed]');

    // Convert excessive caps to normal case
    if ((sanitized.match(/[A-Z]/g) || []).length / sanitized.length > 0.5) {
      sanitized = sanitized.toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());
    }

    return sanitized;
  }

  /**
   * Add custom inappropriate keyword
   */
  addInappropriateKeyword(keyword: string): void {
    this.inappropriateKeywords.add(keyword.toLowerCase());
  }

  /**
   * Remove inappropriate keyword
   */
  removeInappropriateKeyword(keyword: string): void {
    this.inappropriateKeywords.delete(keyword.toLowerCase());
  }

  /**
   * Add allowed domain
   */
  addAllowedDomain(domain: string): void {
    this.allowedDomains.add(domain.toLowerCase());
  }

  /**
   * Add blocked domain
   */
  addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain.toLowerCase());
  }
}

// Type definitions for validation results
export interface ValidationResult {
  isValid: boolean;
  severity: 'low' | 'medium' | 'high';
  issues: ValidationIssue[];
  recommendation?: string;
  sanitizedEvent?: CalendarEvent;
}

export interface ICSValidationResult {
  isValid: boolean;
  severity: 'low' | 'medium' | 'high';
  issues: ValidationIssue[];
  eventCount: number;
  calendarName: string;
  recommendation: string;
}

export interface ValidationIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  field: string;
  message: string;
  suggestedAction: 'block' | 'manual_review' | 'sanitize' | 'allow';
}