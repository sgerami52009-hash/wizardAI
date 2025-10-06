import { EventEmitter } from 'events';
import { CalendarEvent } from '../calendar/types';
import { SubscriptionConnection, ConnectionHealth } from './types';
import { ICSProvider } from './providers/ics-provider';
import { ContentValidator } from './content-validator';

/**
 * ICS Subscription Manager
 * 
 * Manages ICS/iCal subscription feeds with configurable refresh intervals
 * Implements content safety filtering and subscription health monitoring
 * 
 * Safety: All subscribed content validated for child-appropriateness
 * Performance: Optimized refresh scheduling and URL validation for Jetson Nano Orin
 */
export class ICSSubscriptionManager extends EventEmitter {
  private subscriptions: Map<string, SubscriptionConnection> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private icsProvider: ICSProvider;
  private contentValidator: ContentValidator;
  private healthMonitor: SubscriptionHealthMonitor;

  constructor() {
    super();
    this.icsProvider = new ICSProvider();
    this.contentValidator = new ContentValidator();
    this.healthMonitor = new SubscriptionHealthMonitor();
    this.startHealthMonitoring();
  }

  /**
   * Create a new ICS subscription
   */
  async createSubscription(
    url: string,
    name: string,
    refreshInterval: number, // minutes
    userId: string,
    options: SubscriptionOptions = {}
  ): Promise<SubscriptionConnection> {
    try {
      // Validate URL security and format
      await this.validateSubscriptionUrl(url);

      // Test initial fetch
      const testResult = await this.icsProvider.fetchCalendar(url);
      if (!testResult.success) {
        throw new Error(`Failed to fetch calendar: ${testResult.error}`);
      }

      // Validate content safety
      const contentValidation = await this.validateSubscriptionContent(testResult.events);
      if (!contentValidation.isValid) {
        throw new Error(`Content validation failed: ${contentValidation.reason}`);
      }

      // Create subscription
      const subscription: SubscriptionConnection = {
        id: this.generateSubscriptionId(),
        url,
        name,
        refreshInterval: Math.max(refreshInterval, 5), // Minimum 5 minutes
        lastRefresh: new Date(),
        nextRefresh: new Date(Date.now() + refreshInterval * 60000),
        isActive: true,
        healthStatus: ConnectionHealth.HEALTHY,
        eventCount: testResult.events.length,
        userId,
        metadata: {
          contentType: this.detectContentType(testResult.events),
          lastModified: testResult.lastModified,
          etag: testResult.etag,
          contentLength: testResult.contentLength,
          createdAt: new Date(),
          options
        }
      };

      // Store subscription
      this.subscriptions.set(subscription.id, subscription);

      // Schedule refresh
      this.scheduleRefresh(subscription);

      // Import initial events
      await this.importSubscriptionEvents(subscription, testResult.events);

      this.emit('subscriptionCreated', subscription);
      return subscription;
    } catch (error) {
      this.emit('subscriptionError', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Update subscription settings
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<SubscriptionConnection>
  ): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    try {
      // Update subscription properties
      Object.assign(subscription, updates);

      // If refresh interval changed, reschedule
      if (updates.refreshInterval) {
        this.cancelRefresh(subscriptionId);
        this.scheduleRefresh(subscription);
      }

      // If URL changed, validate and test
      if (updates.url) {
        await this.validateSubscriptionUrl(updates.url);
        await this.refreshSubscription(subscriptionId, true);
      }

      this.emit('subscriptionUpdated', subscription);
    } catch (error) {
      this.emit('subscriptionError', { subscriptionId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    try {
      // Cancel refresh timer
      this.cancelRefresh(subscriptionId);

      // Remove subscription events from local storage
      await this.removeSubscriptionEvents(subscriptionId);

      // Remove subscription
      this.subscriptions.delete(subscriptionId);

      this.emit('subscriptionDeleted', subscriptionId);
    } catch (error) {
      this.emit('subscriptionError', { subscriptionId, error: error.message });
      throw error;
    }
  }

  /**
   * Manually refresh a subscription
   */
  async refreshSubscription(subscriptionId: string, force = false): Promise<RefreshResult> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    try {
      // Check if refresh is needed (unless forced)
      if (!force && !this.shouldRefresh(subscription)) {
        return {
          subscriptionId,
          success: true,
          eventsUpdated: 0,
          message: 'Refresh not needed yet'
        };
      }

      // Fetch latest content
      const fetchResult = await this.icsProvider.fetchCalendar(subscription.url);
      
      if (!fetchResult.success) {
        subscription.healthStatus = ConnectionHealth.ERROR;
        subscription.lastError = {
          id: this.generateErrorId(),
          errorType: 'FETCH_ERROR' as any,
          errorMessage: fetchResult.error || 'Unknown fetch error',
          timestamp: new Date(),
          connectionId: subscriptionId,
          retryCount: 0,
          canRetry: true
        };
        
        this.emit('subscriptionFetchError', { subscriptionId, error: fetchResult.error });
        
        return {
          subscriptionId,
          success: false,
          eventsUpdated: 0,
          error: fetchResult.error
        };
      }

      // Check if content has changed
      const hasChanged = this.hasContentChanged(subscription, fetchResult);
      if (!hasChanged && !force) {
        subscription.lastRefresh = new Date();
        subscription.nextRefresh = new Date(Date.now() + subscription.refreshInterval * 60000);
        
        return {
          subscriptionId,
          success: true,
          eventsUpdated: 0,
          message: 'No changes detected'
        };
      }

      // Validate content safety
      const contentValidation = await this.validateSubscriptionContent(fetchResult.events);
      if (!contentValidation.isValid) {
        subscription.healthStatus = ConnectionHealth.WARNING;
        
        this.emit('subscriptionContentWarning', { 
          subscriptionId, 
          reason: contentValidation.reason 
        });
        
        return {
          subscriptionId,
          success: false,
          eventsUpdated: 0,
          error: `Content validation failed: ${contentValidation.reason}`
        };
      }

      // Update subscription events
      const eventsUpdated = await this.updateSubscriptionEvents(subscription, fetchResult.events);

      // Update subscription metadata
      subscription.lastRefresh = new Date();
      subscription.nextRefresh = new Date(Date.now() + subscription.refreshInterval * 60000);
      subscription.eventCount = fetchResult.events.length;
      subscription.healthStatus = ConnectionHealth.HEALTHY;
      subscription.lastError = undefined;
      
      if (subscription.metadata) {
        subscription.metadata.lastModified = fetchResult.lastModified;
        subscription.metadata.etag = fetchResult.etag;
        subscription.metadata.contentLength = fetchResult.contentLength;
      }

      this.emit('subscriptionRefreshed', { subscriptionId, eventsUpdated });
      
      return {
        subscriptionId,
        success: true,
        eventsUpdated,
        message: `Successfully updated ${eventsUpdated} events`
      };
    } catch (error) {
      subscription.healthStatus = ConnectionHealth.ERROR;
      this.emit('subscriptionError', { subscriptionId, error: error.message });
      
      return {
        subscriptionId,
        success: false,
        eventsUpdated: 0,
        error: error.message
      };
    }
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): SubscriptionConnection | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get all subscriptions for a user
   */
  getUserSubscriptions(userId: string): SubscriptionConnection[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.userId === userId);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionConnection[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.isActive);
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(subscriptionId: string): SubscriptionStats {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const refreshHistory = this.healthMonitor.getRefreshHistory(subscriptionId);
    const uptime = this.calculateUptime(refreshHistory);
    const averageRefreshTime = this.calculateAverageRefreshTime(refreshHistory);

    return {
      subscriptionId,
      name: subscription.name,
      url: subscription.url,
      isActive: subscription.isActive,
      healthStatus: subscription.healthStatus,
      eventCount: subscription.eventCount,
      refreshInterval: subscription.refreshInterval,
      lastRefresh: subscription.lastRefresh,
      nextRefresh: subscription.nextRefresh,
      uptime,
      averageRefreshTime,
      totalRefreshes: refreshHistory.length,
      successfulRefreshes: refreshHistory.filter(r => r.success).length
    };
  }

  // Private helper methods

  private async validateSubscriptionUrl(url: string): Promise<void> {
    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    // Block private IP ranges for security
    const hostname = parsedUrl.hostname.toLowerCase();
    if (this.isPrivateIP(hostname)) {
      throw new Error('Private IP addresses are not allowed');
    }

    // Check for common ICS patterns
    const pathname = parsedUrl.pathname.toLowerCase();
    if (!pathname.endsWith('.ics') && 
        !pathname.endsWith('.ical') && 
        !pathname.includes('calendar') &&
        !parsedUrl.search.includes('format=ics')) {
      console.warn('URL does not appear to be an ICS calendar feed');
    }
  }

  private isPrivateIP(hostname: string): boolean {
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Check for private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const [, a, b] = match.map(Number);
      
      // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
      return a === 10 || 
             (a === 172 && b >= 16 && b <= 31) || 
             (a === 192 && b === 168) || 
             (a === 169 && b === 254);
    }

    return false;
  }

  private async validateSubscriptionContent(events: CalendarEvent[]): Promise<ContentValidationResult> {
    let validEvents = 0;
    const issues: string[] = [];

    for (const event of events) {
      try {
        const validation = await this.contentValidator.validateEvent(event);
        if (validation.isValid) {
          validEvents++;
        } else {
          issues.push(`Event "${event.title}": ${validation.recommendation}`);
        }
      } catch (error) {
        issues.push(`Event validation error: ${error.message}`);
      }
    }

    const validationRate = events.length > 0 ? (validEvents / events.length) : 1;
    const isValid = validationRate >= 0.8; // Allow up to 20% invalid events

    return {
      isValid,
      validEvents,
      totalEvents: events.length,
      validationRate,
      issues,
      reason: isValid ? 'Content is appropriate' : `Too many inappropriate events (${issues.length})`
    };
  }

  private detectContentType(events: CalendarEvent[]): string {
    if (events.length === 0) return 'unknown';

    // Analyze event titles and descriptions to detect content type
    const titles = events.map(e => e.title.toLowerCase()).join(' ');
    
    if (titles.includes('school') || titles.includes('class') || titles.includes('homework')) {
      return 'education';
    }
    if (titles.includes('holiday') || titles.includes('vacation')) {
      return 'holidays';
    }
    if (titles.includes('sport') || titles.includes('game') || titles.includes('match')) {
      return 'sports';
    }
    if (titles.includes('meeting') || titles.includes('conference')) {
      return 'business';
    }
    
    return 'general';
  }

  private scheduleRefresh(subscription: SubscriptionConnection): void {
    // Cancel existing timer if any
    this.cancelRefresh(subscription.id);

    // Calculate next refresh time
    const nextRefresh = subscription.nextRefresh || 
      new Date(Date.now() + subscription.refreshInterval * 60000);

    const delay = Math.max(0, nextRefresh.getTime() - Date.now());

    // Schedule refresh
    const timer = setTimeout(() => {
      this.refreshSubscription(subscription.id);
    }, delay);

    this.refreshTimers.set(subscription.id, timer);
  }

  private cancelRefresh(subscriptionId: string): void {
    const timer = this.refreshTimers.get(subscriptionId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(subscriptionId);
    }
  }

  private shouldRefresh(subscription: SubscriptionConnection): boolean {
    if (!subscription.nextRefresh) {
      return true; // No next refresh time set, should refresh
    }
    
    return new Date() >= subscription.nextRefresh;
  }

  private hasContentChanged(
    subscription: SubscriptionConnection, 
    fetchResult: any
  ): boolean {
    const metadata = subscription.metadata;
    if (!metadata) {
      return true; // No previous metadata, assume changed
    }

    // Check ETag
    if (metadata.etag && fetchResult.etag) {
      return metadata.etag !== fetchResult.etag;
    }

    // Check Last-Modified
    if (metadata.lastModified && fetchResult.lastModified) {
      return metadata.lastModified !== fetchResult.lastModified;
    }

    // Check content length
    if (metadata.contentLength && fetchResult.contentLength) {
      return metadata.contentLength !== fetchResult.contentLength;
    }

    // Default to changed if we can't determine
    return true;
  }

  private async importSubscriptionEvents(
    subscription: SubscriptionConnection, 
    events: CalendarEvent[]
  ): Promise<void> {
    // This would integrate with the local calendar storage system
    // to import the subscription events as read-only events
    
    for (const event of events) {
      // Mark event as read-only and from subscription
      event.metadata = {
        ...event.metadata,
        isReadOnly: true,
        subscriptionId: subscription.id,
        subscriptionName: subscription.name,
        importedAt: new Date()
      };
    }

    this.emit('eventsImported', { subscriptionId: subscription.id, eventCount: events.length });
  }

  private async updateSubscriptionEvents(
    subscription: SubscriptionConnection, 
    events: CalendarEvent[]
  ): Promise<number> {
    // This would update the local calendar storage with new/changed events
    // and remove events that are no longer in the subscription
    
    // For now, return the number of events as a placeholder
    await this.removeSubscriptionEvents(subscription.id);
    await this.importSubscriptionEvents(subscription, events);
    
    return events.length;
  }

  private async removeSubscriptionEvents(subscriptionId: string): Promise<void> {
    // This would remove all events associated with the subscription
    // from the local calendar storage
    
    this.emit('eventsRemoved', { subscriptionId });
  }

  private startHealthMonitoring(): void {
    // Monitor subscription health every 5 minutes
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  private performHealthCheck(): void {
    const now = new Date();
    
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.isActive) {
        continue;
      }

      // Check if subscription is overdue for refresh
      if (subscription.nextRefresh && now > subscription.nextRefresh) {
        const overdueMinutes = Math.floor((now.getTime() - subscription.nextRefresh.getTime()) / 60000);
        
        if (overdueMinutes > subscription.refreshInterval * 2) {
          // Mark as unhealthy if significantly overdue
          subscription.healthStatus = ConnectionHealth.WARNING;
          this.emit('subscriptionOverdue', { 
            subscriptionId: subscription.id, 
            overdueMinutes 
          });
        }
      }
    }
  }

  private calculateUptime(refreshHistory: RefreshHistoryEntry[]): number {
    if (refreshHistory.length === 0) return 100;
    
    const successful = refreshHistory.filter(r => r.success).length;
    return (successful / refreshHistory.length) * 100;
  }

  private calculateAverageRefreshTime(refreshHistory: RefreshHistoryEntry[]): number {
    if (refreshHistory.length === 0) return 0;
    
    const totalTime = refreshHistory.reduce((sum, r) => sum + (r.duration || 0), 0);
    return totalTime / refreshHistory.length;
  }

  private generateSubscriptionId(): string {
    return `ics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Subscription Health Monitor
 */
class SubscriptionHealthMonitor {
  private refreshHistory: Map<string, RefreshHistoryEntry[]> = new Map();

  recordRefresh(subscriptionId: string, success: boolean, duration?: number, error?: string): void {
    const history = this.refreshHistory.get(subscriptionId) || [];
    
    history.push({
      timestamp: new Date(),
      success,
      duration,
      error
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }

    this.refreshHistory.set(subscriptionId, history);
  }

  getRefreshHistory(subscriptionId: string): RefreshHistoryEntry[] {
    return this.refreshHistory.get(subscriptionId) || [];
  }

  clearHistory(subscriptionId: string): void {
    this.refreshHistory.delete(subscriptionId);
  }
}

// Type definitions
interface SubscriptionOptions {
  autoRefresh?: boolean;
  contentFilter?: 'strict' | 'moderate' | 'permissive';
  maxEvents?: number;
  categories?: string[];
}

interface ContentValidationResult {
  isValid: boolean;
  validEvents: number;
  totalEvents: number;
  validationRate: number;
  issues: string[];
  reason: string;
}

interface RefreshResult {
  subscriptionId: string;
  success: boolean;
  eventsUpdated: number;
  message?: string;
  error?: string;
}

interface SubscriptionStats {
  subscriptionId: string;
  name: string;
  url: string;
  isActive: boolean;
  healthStatus: ConnectionHealth;
  eventCount: number;
  refreshInterval: number;
  lastRefresh?: Date;
  nextRefresh?: Date;
  uptime: number;
  averageRefreshTime: number;
  totalRefreshes: number;
  successfulRefreshes: number;
}

interface RefreshHistoryEntry {
  timestamp: Date;
  success: boolean;
  duration?: number;
  error?: string;
}