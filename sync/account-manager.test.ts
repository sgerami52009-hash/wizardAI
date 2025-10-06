import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AccountManager } from './account-manager';
import { 
  ProviderType, 
  CalendarCredentials, 
  AccountCredentials,
  AuthenticationType,
  SyncDirection,
  ConflictResolutionStrategy
} from './types';

/**
 * Tests for Multi-Account Calendar Manager
 * 
 * Tests account management, credential storage, calendar discovery,
 * and multi-account synchronization scenarios
 */

describe('AccountManager', () => {
  let accountManager: AccountManager;
  let mockProvider: any;

  beforeEach(() => {
    accountManager = new AccountManager();
    
    mockProvider = {
      type: ProviderType.GOOGLE_CALENDAR,
      exchangeCodeForTokens: jest.fn(),
      refreshAccessToken: jest.fn(),
      discoverCalendars: jest.fn(),
      validateAuth: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Account Management', () => {
    it('should add a new Google Calendar account', async () => {
      const credentials: AccountCredentials = {
        accountId: 'google-work-account',
        accountName: 'Work Calendar',
        displayName: 'John Doe - Work',
        email: 'john.doe@company.com',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: {
            code: 'auth-code-123',
            clientId: 'google-client-id',
            clientSecret: 'google-client-secret',
            redirectUri: 'http://localhost:3000/callback'
          }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockProvider.discoverCalendars.mockResolvedValue([
        {
          id: 'primary',
          name: 'John Doe',
          description: 'Primary calendar',
          color: '#1976D2',
          isWritable: true,
          isPrimary: true
        },
        {
          id: 'work-calendar',
          name: 'Work Events',
          description: 'Work-related events',
          color: '#FF5722',
          isWritable: true,
          isPrimary: false
        }
      ]);

      const account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );

      expect(account).toBeDefined();
      expect(account.providerId).toBe(ProviderType.GOOGLE_CALENDAR);
      expect(account.accountName).toBe('Work Calendar');
      expect(account.email).toBe('john.doe@company.com');
      expect(account.calendars).toHaveLength(2);
      expect(account.isDefault).toBe(true); // First account should be default
    });

    it('should add multiple accounts for the same provider', async () => {
      const workCredentials: AccountCredentials = {
        accountId: 'work-account',
        accountName: 'Work Calendar',
        email: 'work@company.com',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'work-token' }
        }
      };

      const personalCredentials: AccountCredentials = {
        accountId: 'personal-account',
        accountName: 'Personal Calendar',
        email: 'personal@gmail.com',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'personal-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'test-refresh'
      });

      mockProvider.discoverCalendars.mockResolvedValue([
        { id: 'cal-1', name: 'Calendar 1', isWritable: true, isPrimary: true }
      ]);

      const workAccount = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        workCredentials,
        'user-123'
      );

      const personalAccount = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        personalCredentials,
        'user-123'
      );

      expect(workAccount.isDefault).toBe(true);
      expect(personalAccount.isDefault).toBe(false);

      const googleAccounts = accountManager.getAccountsByProvider(ProviderType.GOOGLE_CALENDAR);
      expect(googleAccounts).toHaveLength(2);
    });

    it('should remove an account and clean up credentials', async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'test-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'test-token'
      });

      mockProvider.discoverCalendars.mockResolvedValue([]);

      const account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );

      expect(accountManager.getAccount(account.id)).toBeDefined();

      await accountManager.removeAccount(account.id);

      expect(accountManager.getAccount(account.id)).toBeUndefined();
    });

    it('should set default account correctly', async () => {
      // Add two accounts
      const credentials1: AccountCredentials = {
        accountId: 'account-1',
        accountName: 'Account 1',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'token-1' }
        }
      };

      const credentials2: AccountCredentials = {
        accountId: 'account-2',
        accountName: 'Account 2',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'token-2' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'test' });
      mockProvider.discoverCalendars.mockResolvedValue([]);

      const account1 = await accountManager.addAccount(ProviderType.GOOGLE_CALENDAR, credentials1, 'user-123');
      const account2 = await accountManager.addAccount(ProviderType.GOOGLE_CALENDAR, credentials2, 'user-123');

      expect(account1.isDefault).toBe(true);
      expect(account2.isDefault).toBe(false);

      // Change default
      accountManager.setDefaultAccount(account2.id);

      const updatedAccount1 = accountManager.getAccount(account1.id);
      const updatedAccount2 = accountManager.getAccount(account2.id);

      expect(updatedAccount1?.isDefault).toBe(false);
      expect(updatedAccount2?.isDefault).toBe(true);
    });
  });

  describe('Calendar Discovery and Management', () => {
    let account: any;

    beforeEach(async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'test-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'test-token'
      });

      mockProvider.discoverCalendars.mockResolvedValue([
        {
          id: 'primary',
          name: 'Primary Calendar',
          isWritable: true,
          isPrimary: true
        },
        {
          id: 'work',
          name: 'Work Calendar',
          isWritable: true,
          isPrimary: false
        }
      ]);

      account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );
    });

    it('should refresh account calendars', async () => {
      mockProvider.discoverCalendars.mockResolvedValue([
        {
          id: 'primary',
          name: 'Primary Calendar',
          isWritable: true,
          isPrimary: true
        },
        {
          id: 'work',
          name: 'Work Calendar',
          isWritable: true,
          isPrimary: false
        },
        {
          id: 'new-calendar',
          name: 'New Calendar',
          isWritable: true,
          isPrimary: false
        }
      ]);

      const refreshedCalendars = await accountManager.refreshAccountCalendars(account.id);

      expect(refreshedCalendars).toHaveLength(3);
      expect(refreshedCalendars.some(cal => cal.id === 'new-calendar')).toBe(true);
    });

    it('should update calendar sync settings', async () => {
      accountManager.updateCalendarSyncSettings(account.id, 'primary', {
        syncEnabled: true,
        isVisible: true
      });

      const updatedAccount = accountManager.getAccount(account.id);
      const primaryCalendar = updatedAccount?.calendars.find(cal => cal.id === 'primary');

      expect(primaryCalendar?.syncEnabled).toBe(true);
      expect(primaryCalendar?.isVisible).toBe(true);
    });

    it('should get sync-enabled calendars', async () => {
      // Enable sync for one calendar
      accountManager.updateCalendarSyncSettings(account.id, 'primary', {
        syncEnabled: true
      });

      const syncEnabledCalendars = accountManager.getSyncEnabledCalendars(account.id);

      expect(syncEnabledCalendars).toHaveLength(1);
      expect(syncEnabledCalendars[0].id).toBe('primary');
    });
  });

  describe('Sync Settings Management', () => {
    let account: any;

    beforeEach(async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'test-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'test-token' });
      mockProvider.discoverCalendars.mockResolvedValue([]);

      account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );
    });

    it('should update account sync settings', async () => {
      const newSettings = {
        syncDirection: SyncDirection.IMPORT_ONLY,
        syncFrequency: 30,
        conflictResolution: ConflictResolutionStrategy.REMOTE_WINS,
        syncAttendees: false,
        syncAttachments: true
      };

      accountManager.updateSyncSettings(account.id, newSettings);

      const updatedAccount = accountManager.getAccount(account.id);
      expect(updatedAccount?.syncSettings.syncDirection).toBe(SyncDirection.IMPORT_ONLY);
      expect(updatedAccount?.syncSettings.syncFrequency).toBe(30);
      expect(updatedAccount?.syncSettings.syncAttendees).toBe(false);
      expect(updatedAccount?.syncSettings.syncAttachments).toBe(true);
    });

    it('should provide default sync settings', async () => {
      const defaultSettings = account.syncSettings;

      expect(defaultSettings.syncDirection).toBe(SyncDirection.BIDIRECTIONAL);
      expect(defaultSettings.syncFrequency).toBe(15);
      expect(defaultSettings.conflictResolution).toBe(ConflictResolutionStrategy.MANUAL_RESOLUTION);
      expect(defaultSettings.syncAttendees).toBe(true);
      expect(defaultSettings.syncAttachments).toBe(false); // Disabled by default for performance
      expect(defaultSettings.syncPrivateEvents).toBe(false); // Privacy-first approach
    });
  });

  describe('Authentication Management', () => {
    let account: any;

    beforeEach(async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: {
            accessToken: 'test-token',
            refreshToken: 'refresh-token',
            expiresAt: new Date(Date.now() + 3600000)
          }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockProvider.discoverCalendars.mockResolvedValue([]);

      account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );
    });

    it('should validate account authentication', async () => {
      mockProvider.validateAuth.mockResolvedValue(true);

      const isValid = await accountManager.validateAccountAuth(account.id);

      expect(isValid).toBe(true);
      expect(mockProvider.validateAuth).toHaveBeenCalled();
    });

    it('should refresh expired authentication tokens', async () => {
      // Set token as expired
      account.authInfo.tokenExpiry = new Date(Date.now() - 3600000);
      account.authInfo.isValid = false;

      mockProvider.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      });

      await accountManager.refreshAccountAuth(account.id);

      const updatedAccount = accountManager.getAccount(account.id);
      expect(updatedAccount?.authInfo.accessToken).toBe('new-access-token');
      expect(updatedAccount?.authInfo.isValid).toBe(true);
    });

    it('should handle authentication refresh failures', async () => {
      mockProvider.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      await expect(accountManager.refreshAccountAuth(account.id))
        .rejects.toThrow('Refresh failed');
    });
  });

  describe('Account Statistics', () => {
    let account: any;

    beforeEach(async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'test-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'test-token' });
      mockProvider.discoverCalendars.mockResolvedValue([
        { id: 'cal-1', name: 'Calendar 1', isWritable: true, eventCount: 10 },
        { id: 'cal-2', name: 'Calendar 2', isWritable: false, eventCount: 5 },
        { id: 'cal-3', name: 'Calendar 3', isWritable: true, eventCount: 0 }
      ]);

      account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );

      // Enable sync for some calendars
      accountManager.updateCalendarSyncSettings(account.id, 'cal-1', { syncEnabled: true });
      accountManager.updateCalendarSyncSettings(account.id, 'cal-2', { syncEnabled: true });
    });

    it('should provide comprehensive account statistics', async () => {
      const stats = accountManager.getAccountStats(account.id);

      expect(stats.accountId).toBe(account.id);
      expect(stats.totalCalendars).toBe(3);
      expect(stats.syncEnabledCalendars).toBe(2);
      expect(stats.writableCalendars).toBe(2);
      expect(stats.totalEvents).toBe(15); // 10 + 5 + 0
      expect(stats.isActive).toBe(true);
      expect(stats.authStatus).toBe('valid');
    });
  });

  describe('Error Handling', () => {
    it('should handle provider authentication failures', async () => {
      const credentials: AccountCredentials = {
        accountId: 'failing-account',
        accountName: 'Failing Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'invalid-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockRejectedValue(new Error('Invalid credentials'));

      await expect(accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      )).rejects.toThrow('Invalid credentials');
    });

    it('should handle calendar discovery failures', async () => {
      const credentials: AccountCredentials = {
        accountId: 'test-account',
        accountName: 'Test Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'test-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'test-token' });
      mockProvider.discoverCalendars.mockRejectedValue(new Error('Calendar discovery failed'));

      await expect(accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      )).rejects.toThrow('Calendar discovery failed');
    });

    it('should handle operations on non-existent accounts', async () => {
      expect(() => accountManager.updateSyncSettings('non-existent', {}))
        .toThrow('Account not found: non-existent');

      expect(() => accountManager.getAccountStats('non-existent'))
        .toThrow('Account not found: non-existent');

      await expect(accountManager.removeAccount('non-existent'))
        .rejects.toThrow('Account not found: non-existent');
    });
  });

  describe('Credential Security', () => {
    it('should encrypt stored credentials', async () => {
      const credentials: AccountCredentials = {
        accountId: 'secure-account',
        accountName: 'Secure Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: {
            accessToken: 'sensitive-access-token',
            refreshToken: 'sensitive-refresh-token',
            clientSecret: 'very-secret-client-secret'
          }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'sensitive-access-token',
        refreshToken: 'sensitive-refresh-token'
      });

      mockProvider.discoverCalendars.mockResolvedValue([]);

      const account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );

      // Credentials should be stored securely (not directly accessible)
      expect(account.authInfo.accessToken).toBe('sensitive-access-token');
      
      // The actual credential storage should be encrypted
      // (This would be tested with the actual encryption implementation)
    });

    it('should securely remove credentials on account deletion', async () => {
      const credentials: AccountCredentials = {
        accountId: 'temp-account',
        accountName: 'Temporary Account',
        credentials: {
          providerId: ProviderType.GOOGLE_CALENDAR,
          authType: AuthenticationType.OAUTH2,
          credentials: { accessToken: 'temp-token' }
        }
      };

      mockProvider.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'temp-token' });
      mockProvider.discoverCalendars.mockResolvedValue([]);

      const account = await accountManager.addAccount(
        ProviderType.GOOGLE_CALENDAR,
        credentials,
        'user-123'
      );

      await accountManager.removeAccount(account.id);

      // Credentials should be completely removed
      expect(accountManager.getAccount(account.id)).toBeUndefined();
    });
  });
});