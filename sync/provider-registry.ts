import { GoogleCalendarProvider } from './providers/google-calendar-provider';
import { OutlookProvider } from './providers/outlook-provider';
import { CalDAVProvider } from './providers/caldav-provider';
import { ICSProvider } from './providers/ics-provider';
import { 
  CalendarProvider, 
  ProviderType, 
  AuthenticationType,
  ProviderCapabilities,
  RateLimit,
  RateLimitType
} from './types';

/**
 * Calendar Provider Registry
 * 
 * Manages registration and discovery of calendar providers
 * Provides capability detection and feature mapping
 * 
 * Safety: All providers implement child-safety content validation
 * Performance: Optimized provider selection for Jetson Nano Orin
 */
export class ProviderRegistry {
  private providers: Map<ProviderType, any> = new Map();
  private providerConfigs: Map<ProviderType, CalendarProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all supported calendar providers
   */
  private initializeProviders(): void {
    // Google Calendar Provider
    this.providers.set(ProviderType.GOOGLE_CALENDAR, new GoogleCalendarProvider());
    this.providerConfigs.set(ProviderType.GOOGLE_CALENDAR, {
      id: 'google-calendar',
      name: 'Google Calendar',
      type: ProviderType.GOOGLE_CALENDAR,
      apiEndpoint: 'https://www.googleapis.com/calendar/v3',
      authType: AuthenticationType.OAUTH2,
      capabilities: {
        bidirectionalSync: true,
        attendeeManagement: true,
        attachmentSupport: true,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: true,
        maxAttachmentSize: 25,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        maxEventsPerSync: 2500,
        supportsIncrementalSync: true
      },
      rateLimits: [
        {
          type: RateLimitType.REQUESTS_PER_MINUTE,
          limit: 100,
          windowSeconds: 60,
          currentUsage: 0,
          resetTime: new Date()
        },
        {
          type: RateLimitType.REQUESTS_PER_DAY,
          limit: 1000000,
          windowSeconds: 86400,
          currentUsage: 0,
          resetTime: new Date()
        }
      ],
      isActive: true
    });

    // Microsoft Outlook Provider
    this.providers.set(ProviderType.MICROSOFT_OUTLOOK, new OutlookProvider());
    this.providerConfigs.set(ProviderType.MICROSOFT_OUTLOOK, {
      id: 'microsoft-outlook',
      name: 'Microsoft Outlook',
      type: ProviderType.MICROSOFT_OUTLOOK,
      apiEndpoint: 'https://graph.microsoft.com/v1.0',
      authType: AuthenticationType.OAUTH2,
      capabilities: {
        bidirectionalSync: true,
        attendeeManagement: true,
        attachmentSupport: true,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: false,
        maxAttachmentSize: 10,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        maxEventsPerSync: 1000,
        supportsIncrementalSync: true
      },
      rateLimits: [
        {
          type: RateLimitType.REQUESTS_PER_MINUTE,
          limit: 60,
          windowSeconds: 60,
          currentUsage: 0,
          resetTime: new Date()
        },
        {
          type: RateLimitType.REQUESTS_PER_DAY,
          limit: 10000,
          windowSeconds: 86400,
          currentUsage: 0,
          resetTime: new Date()
        }
      ],
      isActive: true
    });

    // Apple iCloud / CalDAV Provider
    this.providers.set(ProviderType.APPLE_ICLOUD, new CalDAVProvider());
    this.providerConfigs.set(ProviderType.APPLE_ICLOUD, {
      id: 'apple-icloud',
      name: 'Apple iCloud',
      type: ProviderType.APPLE_ICLOUD,
      apiEndpoint: 'https://caldav.icloud.com',
      authType: AuthenticationType.APP_PASSWORD,
      capabilities: {
        bidirectionalSync: true,
        attendeeManagement: true,
        attachmentSupport: false,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: false,
        maxAttachmentSize: 0,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        maxEventsPerSync: 1000,
        supportsIncrementalSync: true
      },
      rateLimits: [
        {
          type: RateLimitType.REQUESTS_PER_MINUTE,
          limit: 30,
          windowSeconds: 60,
          currentUsage: 0,
          resetTime: new Date()
        }
      ],
      isActive: true
    });

    // Generic CalDAV Provider
    this.providers.set(ProviderType.CALDAV, new CalDAVProvider());
    this.providerConfigs.set(ProviderType.CALDAV, {
      id: 'caldav-generic',
      name: 'CalDAV Server',
      type: ProviderType.CALDAV,
      apiEndpoint: '', // User-provided
      authType: AuthenticationType.BASIC_AUTH,
      capabilities: {
        bidirectionalSync: true,
        attendeeManagement: true,
        attachmentSupport: false,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: false,
        maxAttachmentSize: 0,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        maxEventsPerSync: 500,
        supportsIncrementalSync: false
      },
      rateLimits: [
        {
          type: RateLimitType.REQUESTS_PER_MINUTE,
          limit: 20,
          windowSeconds: 60,
          currentUsage: 0,
          resetTime: new Date()
        }
      ],
      isActive: true
    });

    // ICS Subscription Provider
    this.providers.set(ProviderType.ICS_SUBSCRIPTION, new ICSProvider());
    this.providerConfigs.set(ProviderType.ICS_SUBSCRIPTION, {
      id: 'ics-subscription',
      name: 'ICS Calendar Feed',
      type: ProviderType.ICS_SUBSCRIPTION,
      apiEndpoint: '', // User-provided URL
      authType: AuthenticationType.OAUTH2, // No auth needed
      capabilities: {
        bidirectionalSync: false, // Read-only
        attendeeManagement: false,
        attachmentSupport: false,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: false,
        maxAttachmentSize: 0,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
        maxEventsPerSync: 1000,
        supportsIncrementalSync: false
      },
      rateLimits: [
        {
          type: RateLimitType.REQUESTS_PER_HOUR,
          limit: 12, // Every 5 minutes max
          windowSeconds: 3600,
          currentUsage: 0,
          resetTime: new Date()
        }
      ],
      isActive: true
    });
  }

  /**
   * Get provider instance by type
   */
  getProvider(providerType: ProviderType): any {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider not found: ${providerType}`);
    }
    return provider;
  }

  /**
   * Get provider configuration by type
   */
  getProviderConfig(providerType: ProviderType): CalendarProvider {
    const config = this.providerConfigs.get(providerType);
    if (!config) {
      throw new Error(`Provider configuration not found: ${providerType}`);
    }
    return config;
  }

  /**
   * Get all available providers
   */
  getAllProviders(): CalendarProvider[] {
    return Array.from(this.providerConfigs.values()).filter(provider => provider.isActive);
  }

  /**
   * Get providers that support specific capabilities
   */
  getProvidersByCapability(capability: keyof ProviderCapabilities): CalendarProvider[] {
    return this.getAllProviders().filter(provider => 
      provider.capabilities[capability] === true
    );
  }

  /**
   * Get providers that support bidirectional sync
   */
  getBidirectionalProviders(): CalendarProvider[] {
    return this.getProvidersByCapability('bidirectionalSync');
  }

  /**
   * Get read-only providers (subscriptions)
   */
  getReadOnlyProviders(): CalendarProvider[] {
    return this.getAllProviders().filter(provider => 
      !provider.capabilities.bidirectionalSync
    );
  }

  /**
   * Get providers that support OAuth 2.0 authentication
   */
  getOAuthProviders(): CalendarProvider[] {
    return this.getAllProviders().filter(provider => 
      provider.authType === AuthenticationType.OAUTH2
    );
  }

  /**
   * Get providers that support attendee management
   */
  getAttendeeProviders(): CalendarProvider[] {
    return this.getProvidersByCapability('attendeeManagement');
  }

  /**
   * Get providers that support file attachments
   */
  getAttachmentProviders(): CalendarProvider[] {
    return this.getProvidersByCapability('attachmentSupport');
  }

  /**
   * Check if provider supports specific recurrence pattern
   */
  supportsRecurrencePattern(
    providerType: ProviderType, 
    pattern: string
  ): boolean {
    const config = this.getProviderConfig(providerType);
    return config.capabilities.supportedRecurrencePatterns.includes(pattern as any);
  }

  /**
   * Get maximum attachment size for provider
   */
  getMaxAttachmentSize(providerType: ProviderType): number {
    const config = this.getProviderConfig(providerType);
    return config.capabilities.maxAttachmentSize;
  }

  /**
   * Check if provider supports incremental sync
   */
  supportsIncrementalSync(providerType: ProviderType): boolean {
    const config = this.getProviderConfig(providerType);
    return config.capabilities.supportsIncrementalSync;
  }

  /**
   * Get rate limits for provider
   */
  getRateLimits(providerType: ProviderType): RateLimit[] {
    const config = this.getProviderConfig(providerType);
    return config.rateLimits;
  }

  /**
   * Check if provider is currently rate limited
   */
  isRateLimited(providerType: ProviderType): boolean {
    const rateLimits = this.getRateLimits(providerType);
    const now = new Date();
    
    return rateLimits.some(limit => {
      if (now < limit.resetTime) {
        return limit.currentUsage >= limit.limit;
      }
      return false;
    });
  }

  /**
   * Update rate limit usage for provider
   */
  updateRateLimit(
    providerType: ProviderType, 
    limitType: RateLimitType, 
    usage: number
  ): void {
    const config = this.getProviderConfig(providerType);
    const rateLimit = config.rateLimits.find(limit => limit.type === limitType);
    
    if (rateLimit) {
      const now = new Date();
      
      // Reset if window has passed
      if (now >= rateLimit.resetTime) {
        rateLimit.currentUsage = 0;
        rateLimit.resetTime = new Date(now.getTime() + (rateLimit.windowSeconds * 1000));
      }
      
      rateLimit.currentUsage += usage;
    }
  }

  /**
   * Get time until rate limit resets
   */
  getRateLimitResetTime(providerType: ProviderType): Date | null {
    const rateLimits = this.getRateLimits(providerType);
    const now = new Date();
    
    let earliestReset: Date | null = null;
    
    for (const limit of rateLimits) {
      if (limit.currentUsage >= limit.limit && limit.resetTime > now) {
        if (!earliestReset || limit.resetTime < earliestReset) {
          earliestReset = limit.resetTime;
        }
      }
    }
    
    return earliestReset;
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(providerType: ProviderType): boolean {
    try {
      const config = this.getProviderConfig(providerType);
      const provider = this.getProvider(providerType);
      
      // Basic validation
      if (!config.id || !config.name || !config.type) {
        return false;
      }
      
      // Check if provider instance exists
      if (!provider) {
        return false;
      }
      
      // Validate capabilities
      if (!config.capabilities) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get provider recommendations based on user needs
   */
  getProviderRecommendations(requirements: {
    needsBidirectionalSync?: boolean;
    needsAttendeeManagement?: boolean;
    needsAttachments?: boolean;
    preferredAuth?: AuthenticationType;
    maxAttachmentSize?: number;
  }): CalendarProvider[] {
    let candidates = this.getAllProviders();
    
    if (requirements.needsBidirectionalSync) {
      candidates = candidates.filter(p => p.capabilities.bidirectionalSync);
    }
    
    if (requirements.needsAttendeeManagement) {
      candidates = candidates.filter(p => p.capabilities.attendeeManagement);
    }
    
    if (requirements.needsAttachments) {
      candidates = candidates.filter(p => p.capabilities.attachmentSupport);
    }
    
    if (requirements.preferredAuth) {
      candidates = candidates.filter(p => p.authType === requirements.preferredAuth);
    }
    
    if (requirements.maxAttachmentSize) {
      candidates = candidates.filter(p => 
        p.capabilities.maxAttachmentSize >= requirements.maxAttachmentSize!
      );
    }
    
    // Sort by capabilities (more features = higher score)
    return candidates.sort((a, b) => {
      const scoreA = this.calculateProviderScore(a);
      const scoreB = this.calculateProviderScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate provider capability score for ranking
   */
  private calculateProviderScore(provider: CalendarProvider): number {
    let score = 0;
    
    if (provider.capabilities.bidirectionalSync) score += 10;
    if (provider.capabilities.attendeeManagement) score += 8;
    if (provider.capabilities.attachmentSupport) score += 6;
    if (provider.capabilities.recurringEvents) score += 4;
    if (provider.capabilities.timezoneSupport) score += 3;
    if (provider.capabilities.categorySupport) score += 2;
    if (provider.capabilities.colorSupport) score += 1;
    if (provider.capabilities.supportsIncrementalSync) score += 5;
    
    // Bonus for higher attachment size limits
    score += Math.min(provider.capabilities.maxAttachmentSize / 5, 5);
    
    return score;
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();