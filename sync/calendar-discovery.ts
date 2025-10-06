import { EventEmitter } from 'events';
import { 
  CalendarAccount, 
  CalendarInfo, 
  SyncFilter, 
  FilterType, 
  FilterCondition,
  ProviderType 
} from './types';
import { AccountManager } from './account-manager';
import { providerRegistry } from './provider-registry';
import { ContentValidator } from './content-validator';

/**
 * Calendar Discovery and Selection Service
 * 
 * Handles calendar discovery, filtering, and selective sync capabilities
 * Implements privacy controls and content validation for discovered calendars
 * 
 * Safety: All discovered calendars validated for child-appropriateness
 * Performance: Efficient calendar filtering and selection for Jetson Nano Orin
 */
export class CalendarDiscovery extends EventEmitter {
  private accountManager: AccountManager;
  private contentValidator: ContentValidator;
  private discoveryCache: Map<string, DiscoveryResult> = new Map();
  private cacheExpiry: number = 30 * 60 * 1000; // 30 minutes

  constructor(accountManager: AccountManager) {
    super();
    this.accountManager = accountManager;
    this.contentValidator = new ContentValidator();
  }

  /**
   * Discover all available calendars for an account
   */
  async discoverCalendars(accountId: string, forceRefresh = false): Promise<DiscoveryResult> {
    const cacheKey = `discovery_${accountId}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = this.discoveryCache.get(cacheKey);
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached;
      }
    }

    try {
      const account = this.accountManager.getAccount(accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // Get provider instance
      const provider = providerRegistry.getProvider(account.providerId);
      if (!provider.discoverCalendars) {
        throw new Error(`Calendar discovery not supported for provider: ${account.providerId}`);
      }

      // Discover calendars from provider
      const rawCalendars = await provider.discoverCalendars(account.authInfo);
      
      // Validate and process discovered calendars
      const processedCalendars = await this.processDiscoveredCalendars(rawCalendars, account);
      
      // Create discovery result
      const result: DiscoveryResult = {
        accountId,
        providerId: account.providerId,
        calendars: processedCalendars,
        totalFound: rawCalendars.length,
        validCalendars: processedCalendars.filter(cal => cal.isValid).length,
        timestamp: new Date(),
        errors: []
      };

      // Cache result
      this.discoveryCache.set(cacheKey, result);
      
      this.emit('calendarsDiscovered', result);
      return result;
    } catch (error) {
      const errorResult: DiscoveryResult = {
        accountId,
        providerId: ProviderType.GOOGLE_CALENDAR, // Default fallback
        calendars: [],
        totalFound: 0,
        validCalendars: 0,
        timestamp: new Date(),
        errors: [error.message]
      };
      
      this.emit('discoveryError', { accountId, error: error.message });
      return errorResult;
    }
  }

  /**
   * Filter calendars based on user-defined criteria
   */
  filterCalendars(
    calendars: ProcessedCalendarInfo[], 
    filters: SyncFilter[]
  ): ProcessedCalendarInfo[] {
    if (filters.length === 0) {
      return calendars;
    }

    return calendars.filter(calendar => {
      return filters.every(filter => {
        if (!filter.isEnabled) {
          return true; // Skip disabled filters
        }

        return this.applyFilter(calendar, filter);
      });
    });
  }

  /**
   * Get calendar recommendations based on user preferences
   */
  getCalendarRecommendations(
    accountId: string, 
    preferences: CalendarPreferences
  ): CalendarRecommendation[] {
    const account = this.accountManager.getAccount(accountId);
    if (!account) {
      return [];
    }

    const recommendations: CalendarRecommendation[] = [];

    for (const calendar of account.calendars) {
      const score = this.calculateCalendarScore(calendar, preferences);
      const recommendation: CalendarRecommendation = {
        calendarId: calendar.id,
        calendarName: calendar.name,
        score,
        reasons: this.getRecommendationReasons(calendar, preferences, score),
        suggestedSyncSettings: this.getSuggestedSyncSettings(calendar, preferences)
      };

      recommendations.push(recommendation);
    }

    // Sort by score (highest first)
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Validate calendar for child-appropriateness
   */
  async validateCalendar(calendar: CalendarInfo): Promise<CalendarValidationResult> {
    const issues: string[] = [];
    let isValid = true;

    // Validate calendar name
    const nameValidation = await this.contentValidator.validateEvent({
      id: 'temp',
      title: calendar.name,
      description: calendar.description || '',
      startTime: new Date(),
      endTime: new Date(),
      allDay: false,
      location: '',
      attendees: [],
      category: 'general',
      priority: 'medium',
      visibility: 'public',
      reminders: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system'
    } as any);

    if (!nameValidation.isValid) {
      isValid = false;
      issues.push(`Calendar name contains inappropriate content: ${calendar.name}`);
    }

    // Validate calendar description
    if (calendar.description) {
      const descValidation = await this.contentValidator.validateEvent({
        id: 'temp',
        title: 'temp',
        description: calendar.description,
        startTime: new Date(),
        endTime: new Date(),
        allDay: false,
        location: '',
        attendees: [],
        category: 'general',
        priority: 'medium',
        visibility: 'public',
        reminders: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      } as any);

      if (!descValidation.isValid) {
        isValid = false;
        issues.push(`Calendar description contains inappropriate content`);
      }
    }

    return {
      calendarId: calendar.id,
      isValid,
      issues,
      recommendation: isValid ? 'allow' : 'block'
    };
  }

  /**
   * Get calendar selection suggestions for family members
   */
  getFamilyCalendarSuggestions(
    accountId: string, 
    familyMemberAge?: number
  ): FamilyCalendarSuggestion[] {
    const account = this.accountManager.getAccount(accountId);
    if (!account) {
      return [];
    }

    const suggestions: FamilyCalendarSuggestion[] = [];

    for (const calendar of account.calendars) {
      const suggestion: FamilyCalendarSuggestion = {
        calendarId: calendar.id,
        calendarName: calendar.name,
        suitableForChildren: this.isCalendarSuitableForChildren(calendar),
        ageRecommendation: this.getAgeRecommendation(calendar),
        privacyLevel: this.getCalendarPrivacyLevel(calendar),
        syncRecommendation: this.getFamilySyncRecommendation(calendar, familyMemberAge)
      };

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Create calendar selection preset for common scenarios
   */
  createCalendarPreset(presetType: CalendarPresetType): SyncFilter[] {
    switch (presetType) {
      case CalendarPresetType.WORK_ONLY:
        return [
          {
            type: FilterType.CATEGORY,
            condition: FilterCondition.EQUALS,
            value: 'work',
            isEnabled: true
          },
          {
            type: FilterType.TITLE_CONTAINS,
            condition: FilterCondition.CONTAINS,
            value: 'meeting',
            isEnabled: true
          }
        ];

      case CalendarPresetType.PERSONAL_ONLY:
        return [
          {
            type: FilterType.CATEGORY,
            condition: FilterCondition.NOT_EQUALS,
            value: 'work',
            isEnabled: true
          }
        ];

      case CalendarPresetType.FAMILY_SAFE:
        return [
          {
            type: FilterType.PRIVACY_LEVEL,
            condition: FilterCondition.NOT_EQUALS,
            value: 'private',
            isEnabled: true
          },
          {
            type: FilterType.TITLE_CONTAINS,
            condition: FilterCondition.NOT_CONTAINS,
            value: 'adult',
            isEnabled: true
          }
        ];

      case CalendarPresetType.PUBLIC_EVENTS:
        return [
          {
            type: FilterType.PRIVACY_LEVEL,
            condition: FilterCondition.EQUALS,
            value: 'public',
            isEnabled: true
          }
        ];

      default:
        return [];
    }
  }

  // Private helper methods

  private async processDiscoveredCalendars(
    rawCalendars: any[], 
    account: CalendarAccount
  ): Promise<ProcessedCalendarInfo[]> {
    const processed: ProcessedCalendarInfo[] = [];

    for (const rawCalendar of rawCalendars) {
      try {
        // Convert to standard format
        const calendar: CalendarInfo = {
          id: rawCalendar.id,
          name: rawCalendar.name || rawCalendar.summary || 'Untitled Calendar',
          description: rawCalendar.description || '',
          color: rawCalendar.color || '#1976D2',
          isWritable: rawCalendar.isWritable ?? true,
          isVisible: true,
          syncEnabled: false, // Default to disabled for safety
          lastSyncTime: undefined,
          eventCount: rawCalendar.eventCount || 0
        };

        // Validate calendar content
        const validation = await this.validateCalendar(calendar);

        const processedCalendar: ProcessedCalendarInfo = {
          ...calendar,
          isValid: validation.isValid,
          validationIssues: validation.issues,
          recommendation: validation.recommendation,
          metadata: {
            providerId: account.providerId,
            accountId: account.id,
            discoveredAt: new Date(),
            rawData: rawCalendar
          }
        };

        processed.push(processedCalendar);
      } catch (error) {
        console.error(`Failed to process calendar ${rawCalendar.id}:`, error);
      }
    }

    return processed;
  }

  private applyFilter(calendar: ProcessedCalendarInfo, filter: SyncFilter): boolean {
    const value = this.getFilterValue(calendar, filter.type);
    
    switch (filter.condition) {
      case FilterCondition.EQUALS:
        return value === filter.value;
      case FilterCondition.NOT_EQUALS:
        return value !== filter.value;
      case FilterCondition.CONTAINS:
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case FilterCondition.NOT_CONTAINS:
        return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case FilterCondition.STARTS_WITH:
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case FilterCondition.ENDS_WITH:
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      default:
        return true;
    }
  }

  private getFilterValue(calendar: ProcessedCalendarInfo, filterType: FilterType): any {
    switch (filterType) {
      case FilterType.CATEGORY:
        return this.inferCalendarCategory(calendar);
      case FilterType.TITLE_CONTAINS:
        return calendar.name;
      case FilterType.PRIVACY_LEVEL:
        return this.getCalendarPrivacyLevel(calendar);
      default:
        return '';
    }
  }

  private inferCalendarCategory(calendar: ProcessedCalendarInfo): string {
    const name = calendar.name.toLowerCase();
    
    if (name.includes('work') || name.includes('business') || name.includes('office')) {
      return 'work';
    }
    if (name.includes('family') || name.includes('home')) {
      return 'family';
    }
    if (name.includes('personal') || name.includes('private')) {
      return 'personal';
    }
    if (name.includes('holiday') || name.includes('vacation')) {
      return 'holiday';
    }
    
    return 'general';
  }

  private calculateCalendarScore(calendar: CalendarInfo, preferences: CalendarPreferences): number {
    let score = 0;

    // Base score for writable calendars
    if (calendar.isWritable) score += 10;

    // Score based on event count (more events = more useful)
    score += Math.min(calendar.eventCount / 10, 20);

    // Score based on name relevance
    if (preferences.preferredCategories) {
      const category = this.inferCalendarCategory(calendar as ProcessedCalendarInfo);
      if (preferences.preferredCategories.includes(category)) {
        score += 15;
      }
    }

    // Penalty for validation issues
    if ((calendar as ProcessedCalendarInfo).validationIssues?.length > 0) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  private getRecommendationReasons(
    calendar: CalendarInfo, 
    preferences: CalendarPreferences, 
    score: number
  ): string[] {
    const reasons: string[] = [];

    if (calendar.isWritable) {
      reasons.push('Calendar supports creating and editing events');
    }

    if (calendar.eventCount > 0) {
      reasons.push(`Contains ${calendar.eventCount} existing events`);
    }

    const category = this.inferCalendarCategory(calendar as ProcessedCalendarInfo);
    if (preferences.preferredCategories?.includes(category)) {
      reasons.push(`Matches preferred category: ${category}`);
    }

    if (score > 20) {
      reasons.push('Highly recommended based on your preferences');
    }

    return reasons;
  }

  private getSuggestedSyncSettings(
    calendar: CalendarInfo, 
    preferences: CalendarPreferences
  ): Partial<CalendarInfo> {
    return {
      syncEnabled: calendar.isWritable && calendar.eventCount > 0,
      isVisible: true
    };
  }

  private isCalendarSuitableForChildren(calendar: CalendarInfo): boolean {
    const validation = (calendar as ProcessedCalendarInfo).validationIssues;
    return !validation || validation.length === 0;
  }

  private getAgeRecommendation(calendar: CalendarInfo): string {
    const name = calendar.name.toLowerCase();
    
    if (name.includes('school') || name.includes('education')) {
      return '5+';
    }
    if (name.includes('work') || name.includes('business')) {
      return '16+';
    }
    if (name.includes('family') || name.includes('home')) {
      return 'All ages';
    }
    
    return '13+'; // Default conservative recommendation
  }

  private getCalendarPrivacyLevel(calendar: CalendarInfo): string {
    const name = calendar.name.toLowerCase();
    
    if (name.includes('private') || name.includes('personal')) {
      return 'private';
    }
    if (name.includes('public') || name.includes('shared')) {
      return 'public';
    }
    
    return 'internal'; // Default
  }

  private getFamilySyncRecommendation(
    calendar: CalendarInfo, 
    familyMemberAge?: number
  ): 'recommended' | 'optional' | 'not_recommended' {
    if (!this.isCalendarSuitableForChildren(calendar)) {
      return 'not_recommended';
    }

    const category = this.inferCalendarCategory(calendar as ProcessedCalendarInfo);
    
    if (category === 'family' || category === 'general') {
      return 'recommended';
    }
    
    if (familyMemberAge && familyMemberAge >= 16 && category === 'work') {
      return 'optional';
    }
    
    return 'optional';
  }

  private isCacheValid(timestamp: Date): boolean {
    return Date.now() - timestamp.getTime() < this.cacheExpiry;
  }
}

// Type definitions
interface DiscoveryResult {
  accountId: string;
  providerId: ProviderType;
  calendars: ProcessedCalendarInfo[];
  totalFound: number;
  validCalendars: number;
  timestamp: Date;
  errors: string[];
}

interface ProcessedCalendarInfo extends CalendarInfo {
  isValid: boolean;
  validationIssues: string[];
  recommendation: 'allow' | 'block' | 'review';
  metadata: {
    providerId: ProviderType;
    accountId: string;
    discoveredAt: Date;
    rawData: any;
  };
}

interface CalendarValidationResult {
  calendarId: string;
  isValid: boolean;
  issues: string[];
  recommendation: 'allow' | 'block' | 'review';
}

interface CalendarRecommendation {
  calendarId: string;
  calendarName: string;
  score: number;
  reasons: string[];
  suggestedSyncSettings: Partial<CalendarInfo>;
}

interface FamilyCalendarSuggestion {
  calendarId: string;
  calendarName: string;
  suitableForChildren: boolean;
  ageRecommendation: string;
  privacyLevel: string;
  syncRecommendation: 'recommended' | 'optional' | 'not_recommended';
}

interface CalendarPreferences {
  preferredCategories?: string[];
  maxEventCount?: number;
  requireWritable?: boolean;
  privacyLevel?: 'public' | 'internal' | 'private';
}

enum CalendarPresetType {
  WORK_ONLY = 'work_only',
  PERSONAL_ONLY = 'personal_only',
  FAMILY_SAFE = 'family_safe',
  PUBLIC_EVENTS = 'public_events'
}