import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExternalCalendarSync } from './external-calendar-sync';
import { AccountManager } from './account-manager';
import { ContentValidator } from './content-validator';
import { 
  ProviderType, 
  CalendarCredentials, 
  SyncConnection,
  AuthenticationStatus,
  ConnectionHealth
} from './types';

/**
 * Comprehensive tests for External Calendar Synchronization
 * 
 * Tests multi-provider authentication, bidirectional sync, conflict resolution,
 * advanced features, ICS subscriptions, and performance under load conditions
 */

describe('ExternalCalendarSync', () => {
  let syncManager: ExternalCalendarSync;
  let accountManager: AccountManager;
  let mockProvider: any;

  beforeEach(() => {
    accountManager = new AccountManager();
    syncManager = new ExternalCalendarSync();
    
    // Mock provider for testing
    mockProvider = {
      type: ProviderType.GOOGLE_CALENDAR,
      capabilities: {
        bidirectionalSync: true,
        attendeeManagement: true,
        attachmentSupport: true,
        recurringEvents: true,
        timezoneSupport: true,
        categorySupport: true,
        colorSupport: true,
        maxAttachmentSize: 25,
        supportedRecurrencePatterns: ['daily', 'weekly', 'monthly', 'yearly']
      },
      authenticate: jest.fn(),
      discoverCalendars: jest.fn(),
      performSync: jest.fn(),
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Provider Authentication', () => {
    it('should successfully connect to Google Calendar with OAuth 2.0', async () => {
      const credentials: CalendarCredentials = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        expiresAt: new Date(Date.now() + 3600000)
      };

      mockProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'test-account',
        accountName: 'Test Account'
      });

      const connection = await syncManager.connectCalendar(
        mockProvider,
        credentials,
        'user-123'
      );

      expect(connection).toBeDefined();
      expect(connection.provider).toBe(ProviderType.GOOGLE_CALENDAR);
      expect(connection.authStatus).toBe(AuthenticationStatus.AUTHENTICATED);
      expect(mockProvider.authenticate).toHaveBeenCalledWith(mockProvider, credentials);
    });

    it('should successfully connect to Microsoft Outlook with OAuth 2.0', async () => {
      const outlookProvider = {
        ...mockProvider,
        type: ProviderType.MICROSOFT_OUTLOOK
      };

      const credentials: CalendarCredentials = {
        accessToken: 'outlook-access-token',
        refreshToken: 'outlook-refresh-token',
        clientId: 'outlook-client-id',
        clientSecret: 'outlook-client-secret'
      };

      outlookProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'outlook-account',
        accountName: 'Outlook Account'
      });

      const connection = await syncManager.connectCalendar(
        outlookProvider,
        credentials,
        'user-123'
      );

      expect(connection.provider).toBe(ProviderType.MICROSOFT_OUTLOOK);
      expect(connection.authStatus).toBe(AuthenticationStatus.AUTHENTICATED);
    });

    it('should successfully connect to CalDAV server with basic auth', async () => {
      const caldavProvider = {
        ...mockProvider,
        type: ProviderType.CALDAV,
        capabilities: {
          ...mockProvider.capabilities,
          attachmentSupport: false,
          colorSupport: false
        }
      };

      const credentials: CalendarCredentials = {
        username: 'test-user',
        password: 'test-password',
        serverUrl: 'https://caldav.example.com'
      };

      caldavProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'caldav-account',
        accountName: 'CalDAV Account'
      });

      const connection = await syncManager.connectCalendar(
        caldavProvider,
        credentials,
        'user-123'
      );

      expect(connection.provider).toBe(ProviderType.CALDAV);
      expect(connection.authStatus).toBe(AuthenticationStatus.AUTHENTICATED);
    });

    it('should handle authentication failures gracefully', async () => {
      mockProvider.authenticate.mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      });

      const credentials: CalendarCredentials = {
        accessToken: 'invalid-token'
      };

      await expect(syncManager.connectCalendar(mockProvider, credentials, 'user-123'))
        .rejects.toThrow('Authentication failed: Invalid credentials');
    });

    it('should support multiple accounts per provider', async () => {
      const accountCredentials = [
        {
          accountId: 'work-account',
          accountName: 'Work Calendar',
          accessToken: 'work-token',
          refreshToken: 'work-refresh'
        },
        {
          accountId: 'personal-account', 
          accountName: 'Personal Calendar',
          accessToken: 'personal-token',
          refreshToken: 'personal-refresh'
        }
      ];

      mockProvider.authenticate.mockResolvedValueOnce({
        success: true,
        accountId: 'work-account',
        accountName: 'Work Calendar'
      }).mockResolvedValueOnce({
        success: true,
        accountId: 'personal-account',
        accountName: 'Personal Calendar'
      });

      const connections = await syncManager.connectMultipleAccounts(
        mockProvider,
        accountCredentials,
        'user-123'
      );

      expect(connections).toHaveLength(2);
      expect(connections[0].accountName).toBe('Work Calendar');
      expect(connections[1].accountName).toBe('Personal Calendar');
    });
  });

  describe('Bidirectional Sync with Conflict Resolution', () => {
    let connection: SyncConnection;

    beforeEach(async () => {
      mockProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'test-account'
      });

      const credentials: CalendarCredentials = {
        accessToken: 'test-token'
      };

      connection = await syncManager.connectCalendar(mockProvider, credentials, 'user-123');
    });

    it('should perform successful bidirectional sync', async () => {
      const mockSyncData = {
        events: [
          {
            id: 'remote-event-1',
            title: 'Remote Meeting',
            startTime: new Date('2024-01-15T10:00:00Z'),
            endTime: new Date('2024-01-15T11:00:00Z'),
            description: 'Team sync meeting'
          }
        ],
        conflicts: [],
        errors: [],
        nextSyncToken: 'next-token-123'
      };

      mockProvider.performSync.mockResolvedValue(mockSyncData);

      const result = await syncManager.syncCalendar(connection.id);

      expect(result.success).toBe(true);
      expect(result.eventsImported).toBe(1);
      expect(result.conflicts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect and resolve sync conflicts', async () => {
      const localEvent = {
        id: 'event-123',
        title: 'Local Version',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        updatedAt: new Date('2024-01-15T09:00:00Z')
      };

      const remoteEvent = {
        id: 'event-123',
        title: 'Remote Version',
        startTime: new Date('2024-01-15T10:30:00Z'),
        endTime: new Date('2024-01-15T11:30:00Z'),
        updatedAt: new Date('2024-01-15T09:30:00Z')
      };

      const mockSyncData = {
        events: [remoteEvent],
        conflicts: [{
          id: 'conflict-1',
          eventId: 'event-123',
          conflictType: 'modified_both',
          localEvent,
          remoteEvent,
          detectedAt: new Date(),
          resolutionOptions: [
            { strategy: 'keep_local' },
            { strategy: 'keep_remote' },
            { strategy: 'merge' }
          ]
        }],
        errors: []
      };

      mockProvider.performSync.mockResolvedValue(mockSyncData);

      const result = await syncManager.syncCalendar(connection.id);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('modified_both');
    });

    it('should handle sync errors gracefully', async () => {
      mockProvider.performSync.mockRejectedValue(new Error('Network timeout'));

      const result = await syncManager.syncCalendar(connection.id);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errorMessage).toContain('Network timeout');
    });

    it('should validate content for child safety during sync', async () => {
      const inappropriateEvent = {
        id: 'bad-event',
        title: 'Adult Content Event',
        description: 'Inappropriate content for children',
        startTime: new Date(),
        endTime: new Date()
      };

      const mockSyncData = {
        events: [inappropriateEvent],
        conflicts: [],
        errors: []
      };

      mockProvider.performSync.mockResolvedValue(mockSyncData);

      const result = await syncManager.syncCalendar(connection.id);

      // Should have validation errors
      expect(result.errors.some(error => 
        error.errorType === 'VALIDATION_ERROR'
      )).toBe(true);
    });
  });

  describe('Advanced Calendar Integration Features', () => {
    let connection: SyncConnection;

    beforeEach(async () => {
      mockProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'test-account'
      });

      connection = await syncManager.connectCalendar(
        mockProvider,
        { accessToken: 'test-token' },
        'user-123'
      );
    });

    it('should sync attendee information and responses', async () => {
      const eventWithAttendees = {
        id: 'meeting-event',
        title: 'Team Meeting',
        attendees: [
          { email: 'alice@example.com', response: 'accepted' },
          { email: 'bob@example.com', response: 'tentative' }
        ],
        startTime: new Date(),
        endTime: new Date()
      };

      mockProvider.getEventAttendees = jest.fn().mockResolvedValue([
        { email: 'alice@example.com', name: 'Alice Smith', role: 'required' },
        { email: 'bob@example.com', name: 'Bob Jones', role: 'optional' }
      ]);

      mockProvider.getAttendeeResponses = jest.fn().mockResolvedValue([
        { email: 'alice@example.com', status: 'accepted', timestamp: new Date() },
        { email: 'bob@example.com', status: 'tentative', timestamp: new Date() }
      ]);

      // Test attendee sync functionality
      const attendeeSync = await syncManager.syncAttendees(
        'meeting-event',
        ProviderType.GOOGLE_CALENDAR,
        { accessToken: 'test-token' }
      );

      expect(attendeeSync.attendees).toHaveLength(2);
      expect(attendeeSync.responses).toHaveLength(2);
      expect(attendeeSync.responses[0].response).toBe('accepted');
    });

    it('should handle event attachments within size limits', async () => {
      const eventWithAttachments = {
        id: 'document-event',
        title: 'Document Review',
        attachments: [
          {
            id: 'attachment-1',
            filename: 'document.pdf',
            size: 5 * 1024 * 1024, // 5MB
            mimeType: 'application/pdf'
          }
        ]
      };

      mockProvider.getEventAttachments = jest.fn().mockResolvedValue([
        {
          id: 'attachment-1',
          filename: 'document.pdf',
          size: 5 * 1024 * 1024,
          mimeType: 'application/pdf',
          url: 'https://example.com/attachment-1'
        }
      ]);

      const attachmentSync = await syncManager.syncEventAttachments(
        'document-event',
        ProviderType.GOOGLE_CALENDAR,
        { accessToken: 'test-token' }
      );

      expect(attachmentSync.attachments).toHaveLength(1);
      expect(attachmentSync.attachments[0].filename).toBe('document.pdf');
    });

    it('should reject attachments exceeding size limits', async () => {
      const oversizedAttachment = {
        id: 'big-attachment',
        filename: 'huge-file.zip',
        size: 50 * 1024 * 1024, // 50MB (exceeds 25MB limit for Google)
        mimeType: 'application/zip'
      };

      mockProvider.getEventAttachments = jest.fn().mockResolvedValue([oversizedAttachment]);

      const attachmentSync = await syncManager.syncEventAttachments(
        'document-event',
        ProviderType.GOOGLE_CALENDAR,
        { accessToken: 'test-token' }
      );

      // Should filter out oversized attachments
      expect(attachmentSync.attachments).toHaveLength(0);
    });

    it('should handle complex recurring event patterns', async () => {
      const complexRecurringEvent = {
        id: 'recurring-meeting',
        title: 'Weekly Team Standup',
        recurrence: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['monday', 'wednesday', 'friday'],
          endDate: new Date('2024-12-31')
        },
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T09:30:00Z')
      };

      const syncResult = await syncManager.syncRecurringPattern(
        complexRecurringEvent,
        ProviderType.GOOGLE_CALENDAR
      );

      expect(syncResult.isSupported).toBe(true);
      expect(syncResult.pattern).toEqual(complexRecurringEvent.recurrence);
    });

    it('should handle timezone conversions accurately', async () => {
      const eventInEST = {
        id: 'timezone-event',
        title: 'Cross-timezone Meeting',
        startTime: new Date('2024-01-15T14:00:00-05:00'), // 2 PM EST
        endTime: new Date('2024-01-15T15:00:00-05:00')    // 3 PM EST
      };

      const convertedEvent = await syncManager.syncWithTimezone(
        eventInEST,
        'America/New_York',
        'America/Los_Angeles'
      );

      // Should be converted to PST (3 hours earlier)
      expect(convertedEvent.startTime.getHours()).toBe(11); // 11 AM PST
      expect(convertedEvent.metadata.originalTimezone).toBe('America/New_York');
      expect(convertedEvent.metadata.convertedTimezone).toBe('America/Los_Angeles');
    });
  });

  describe('ICS Subscription Management', () => {
    it('should create and manage ICS subscriptions', async () => {
      const icsUrl = 'https://calendar.example.com/public.ics';
      const mockIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
UID:test-event-1
DTSTART:20240115T100000Z
DTEND:20240115T110000Z
SUMMARY:Test Event
DESCRIPTION:A test event from ICS feed
END:VEVENT
END:VCALENDAR`;

      // Mock fetch for ICS content
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockIcsContent),
        headers: {
          get: (header: string) => {
            if (header === 'last-modified') return 'Mon, 15 Jan 2024 10:00:00 GMT';
            if (header === 'etag') return '"test-etag-123"';
            return null;
          }
        }
      });

      const subscription = await syncManager.subscribeToCalendar(
        icsUrl,
        60, // 1 hour refresh interval
        'user-123'
      );

      expect(subscription.url).toBe(icsUrl);
      expect(subscription.refreshInterval).toBe(60);
      expect(subscription.isActive).toBe(true);
      expect(subscription.healthStatus).toBe(ConnectionHealth.HEALTHY);
    });

    it('should validate ICS content for child safety', async () => {
      const inappropriateIcsUrl = 'https://bad-calendar.example.com/adult.ics';
      const inappropriateContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:bad-event
SUMMARY:Adult Content Event
DESCRIPTION:This event contains inappropriate content
END:VEVENT
END:VCALENDAR`;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(inappropriateContent)
      });

      await expect(syncManager.subscribeToCalendar(
        inappropriateIcsUrl,
        60,
        'user-123'
      )).rejects.toThrow('Content validation failed');
    });

    it('should handle ICS subscription refresh with health monitoring', async () => {
      // First, create a subscription
      const icsUrl = 'https://calendar.example.com/events.ics';
      
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('BEGIN:VCALENDAR\nEND:VCALENDAR'),
          headers: { get: () => null }
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });

      const subscription = await syncManager.subscribeToCalendar(icsUrl, 5, 'user-123');
      
      // Simulate refresh failure
      const refreshResult = await syncManager.refreshSubscription(subscription.id, true);
      
      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toContain('404');
    });
  });

  describe('Performance and Rate Limit Management', () => {
    it('should respect rate limits and queue requests', async () => {
      // Mock rate limiter to simulate rate limit exceeded
      const rateLimitedProvider = {
        ...mockProvider,
        performSync: jest.fn()
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockResolvedValueOnce({ events: [], conflicts: [], errors: [] })
      };

      const connection = await syncManager.connectCalendar(
        rateLimitedProvider,
        { accessToken: 'test-token' },
        'user-123'
      );

      // First sync should fail due to rate limit
      const firstResult = await syncManager.syncCalendar(connection.id);
      expect(firstResult.success).toBe(false);

      // Second sync should succeed (simulating rate limit reset)
      const secondResult = await syncManager.syncCalendar(connection.id);
      expect(secondResult.success).toBe(true);
    });

    it('should batch multiple sync operations efficiently', async () => {
      const connections = [];
      
      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        mockProvider.authenticate.mockResolvedValue({
          success: true,
          accountId: `account-${i}`
        });

        const connection = await syncManager.connectCalendar(
          mockProvider,
          { accessToken: `token-${i}` },
          'user-123'
        );
        connections.push(connection);
      }

      mockProvider.performSync.mockResolvedValue({
        events: [],
        conflicts: [],
        errors: []
      });

      // Sync all connections
      const results = await syncManager.syncAllCalendars('user-123');
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle high load conditions gracefully', async () => {
      const startTime = Date.now();
      const promises = [];

      // Create many concurrent sync operations
      for (let i = 0; i < 50; i++) {
        const connection = await syncManager.connectCalendar(
          mockProvider,
          { accessToken: `token-${i}` },
          'user-123'
        );
        
        promises.push(syncManager.syncCalendar(connection.id));
      }

      mockProvider.performSync.mockResolvedValue({
        events: [],
        conflicts: [],
        errors: []
      });

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);
      
      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeGreaterThan(40); // At least 80% success rate
    });

    it('should optimize sync scheduling during peak times', async () => {
      const optimization = syncManager.optimizeSyncScheduling();
      
      expect(optimization).toHaveProperty('totalQueuedRequests');
      expect(optimization).toHaveProperty('recommendations');
      expect(optimization).toHaveProperty('estimatedProcessingTime');
      expect(optimization).toHaveProperty('resourceUsage');
      
      // Should provide actionable recommendations
      if (optimization.recommendations.length > 0) {
        expect(optimization.recommendations[0]).toHaveProperty('type');
        expect(optimization.recommendations[0]).toHaveProperty('priority');
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network connectivity issues', async () => {
      mockProvider.performSync.mockRejectedValue(new Error('Network unreachable'));

      const connection = await syncManager.connectCalendar(
        mockProvider,
        { accessToken: 'test-token' },
        'user-123'
      );

      const result = await syncManager.syncCalendar(connection.id);

      expect(result.success).toBe(false);
      expect(result.errors[0].errorType).toBe('API_ERROR');
      expect(result.errors[0].canRetry).toBe(true);
    });

    it('should handle authentication token expiration', async () => {
      const expiredCredentials: CalendarCredentials = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 3600000) // Expired 1 hour ago
      };

      mockProvider.authenticate.mockResolvedValue({
        success: true,
        accountId: 'test-account'
      });

      mockProvider.refreshAccessToken = jest.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        expiresAt: new Date(Date.now() + 3600000)
      });

      const connection = await syncManager.connectCalendar(
        mockProvider,
        expiredCredentials,
        'user-123'
      );

      // Should automatically refresh token during sync
      mockProvider.performSync.mockResolvedValue({
        events: [],
        conflicts: [],
        errors: []
      });

      const result = await syncManager.syncCalendar(connection.id);
      expect(result.success).toBe(true);
    });

    it('should provide detailed error reporting', async () => {
      const detailedError = new Error('Detailed sync error');
      detailedError.stack = 'Error stack trace...';

      mockProvider.performSync.mockRejectedValue(detailedError);

      const connection = await syncManager.connectCalendar(
        mockProvider,
        { accessToken: 'test-token' },
        'user-123'
      );

      const result = await syncManager.syncCalendar(connection.id);

      expect(result.errors[0]).toHaveProperty('errorMessage');
      expect(result.errors[0]).toHaveProperty('timestamp');
      expect(result.errors[0]).toHaveProperty('connectionId');
      expect(result.errors[0].errorMessage).toContain('Detailed sync error');
    });
  });

  describe('Integration Tests', () => {
    it('should perform end-to-end sync workflow', async () => {
      // 1. Connect to provider
      const connection = await syncManager.connectCalendar(
        mockProvider,
        { accessToken: 'test-token' },
        'user-123'
      );

      // 2. Perform initial sync
      mockProvider.performSync.mockResolvedValue({
        events: [
          {
            id: 'event-1',
            title: 'Initial Event',
            startTime: new Date(),
            endTime: new Date()
          }
        ],
        conflicts: [],
        errors: []
      });

      const initialSync = await syncManager.syncCalendar(connection.id);
      expect(initialSync.success).toBe(true);
      expect(initialSync.eventsImported).toBe(1);

      // 3. Perform incremental sync
      mockProvider.performSync.mockResolvedValue({
        events: [
          {
            id: 'event-2',
            title: 'New Event',
            startTime: new Date(),
            endTime: new Date()
          }
        ],
        conflicts: [],
        errors: []
      });

      const incrementalSync = await syncManager.syncCalendar(connection.id);
      expect(incrementalSync.success).toBe(true);

      // 4. Handle disconnection
      await syncManager.disconnectCalendar(connection.id);
      
      // Should clean up resources
      expect(() => syncManager.syncCalendar(connection.id))
        .rejects.toThrow('Connection not found');
    });

    it('should maintain data consistency across multiple sync cycles', async () => {
      const connection = await syncManager.connectCalendar(
        mockProvider,
        { accessToken: 'test-token' },
        'user-123'
      );

      // Simulate multiple sync cycles with the same event being modified
      const baseEvent = {
        id: 'consistent-event',
        title: 'Consistency Test',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z')
      };

      // First sync
      mockProvider.performSync.mockResolvedValueOnce({
        events: [{ ...baseEvent, version: 1 }],
        conflicts: [],
        errors: []
      });

      const sync1 = await syncManager.syncCalendar(connection.id);
      expect(sync1.success).toBe(true);

      // Second sync with updated event
      mockProvider.performSync.mockResolvedValueOnce({
        events: [{ ...baseEvent, title: 'Updated Title', version: 2 }],
        conflicts: [],
        errors: []
      });

      const sync2 = await syncManager.syncCalendar(connection.id);
      expect(sync2.success).toBe(true);

      // Third sync should show no changes
      mockProvider.performSync.mockResolvedValueOnce({
        events: [{ ...baseEvent, title: 'Updated Title', version: 2 }],
        conflicts: [],
        errors: []
      });

      const sync3 = await syncManager.syncCalendar(connection.id);
      expect(sync3.success).toBe(true);
    });
  });
});

// Helper functions for test setup
function createMockCalendarEvent(overrides: any = {}) {
  return {
    id: 'test-event-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Event',
    description: 'A test calendar event',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000), // 1 hour later
    allDay: false,
    location: 'Test Location',
    attendees: [],
    category: 'general',
    priority: 'medium',
    visibility: 'public',
    reminders: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    ...overrides
  };
}

function createMockSyncResult(overrides: any = {}) {
  return {
    success: true,
    connectionId: 'test-connection',
    eventsImported: 0,
    eventsExported: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    conflicts: [],
    errors: [],
    lastSyncTime: new Date(),
    nextSyncTime: new Date(Date.now() + 900000), // 15 minutes later
    duration: 1000,
    ...overrides
  };
}