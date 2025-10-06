/**
 * Unit tests for Offline Capability Detector
 * Tests connectivity monitoring, notifications, and feature restoration
 */

import { OfflineCapabilityDetector } from './offline-capability-detector';
import { ConnectivityMonitor } from './connectivity-monitor';
import { OfflineNotificationService } from './offline-notification-service';
import { FeatureRestorationManager } from './feature-restoration-manager';

// Mock the dependencies
jest.mock('./connectivity-monitor');
jest.mock('./offline-notification-service');
jest.mock('./feature-restoration-manager');

describe('OfflineCapabilityDetector', () => {
  let detector: OfflineCapabilityDetector;
  let mockConnectivityMonitor: jest.Mocked<ConnectivityMonitor>;
  let mockNotificationService: jest.Mocked<OfflineNotificationService>;
  let mockRestorationManager: jest.Mocked<FeatureRestorationManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create detector instance
    detector = new OfflineCapabilityDetector({
      enableConnectivityMonitoring: true,
      enableNotifications: true,
      enableAutoRestoration: true
    });

    // Get mock instances
    mockConnectivityMonitor = (detector as any).connectivityMonitor;
    mockNotificationService = (detector as any).notificationService;
    mockRestorationManager = (detector as any).restorationManager;

    // Setup default mock behaviors
    mockConnectivityMonitor.getStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'ethernet',
      signalStrength: 100,
      offlineDuration: 0
    });

    mockConnectivityMonitor.getAllFeatureAvailability.mockReturnValue([
      {
        featureId: 'wake-word-detection',
        isAvailable: true,
        requiresInternet: false,
        fallbackAvailable: true
      },
      {
        featureId: 'weather-updates',
        isAvailable: true,
        requiresInternet: true,
        fallbackAvailable: false
      }
    ]);

    mockNotificationService.getActiveNotifications.mockReturnValue([]);
    mockRestorationManager.getRestorationProgress.mockReturnValue(null);
    mockRestorationManager.getFeatureStates.mockReturnValue([]);
  });

  afterEach(async () => {
    if (detector) {
      await detector.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();

      await detector.initialize();

      expect(mockConnectivityMonitor.startMonitoring).toHaveBeenCalled();
      expect(detector.getConfig().enableConnectivityMonitoring).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      const error = new Error('Failed to start monitoring');
      mockConnectivityMonitor.startMonitoring.mockRejectedValue(error);

      await expect(detector.initialize()).rejects.toThrow('Failed to start monitoring');
    });

    it('should not reinitialize if already initialized', async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();

      await detector.initialize();
      await detector.initialize(); // Second call

      expect(mockConnectivityMonitor.startMonitoring).toHaveBeenCalledTimes(1);
    });

    it('should set offline tracking for initial offline state', async () => {
      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 5000
      });

      mockConnectivityMonitor.startMonitoring.mockResolvedValue();

      await detector.initialize();

      const status = detector.getStatus();
      expect(status.offlineSince).toBeDefined();
    });
  });

  describe('Connectivity Change Handling', () => {
    beforeEach(async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();
    });

    it('should handle offline transition', async () => {
      const connectivityEvent = {
        type: 'offline' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: true, connectionType: 'ethernet' as const, signalStrength: 100, offlineDuration: 0 },
        currentStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 0 }
      };

      const eventSpy = jest.fn();
      detector.on('offlineCapabilityChanged', eventSpy);

      // Simulate connectivity change
      mockConnectivityMonitor.emit('connectivityChanged', connectivityEvent);

      expect(mockNotificationService.handleConnectivityChange).toHaveBeenCalledWith(connectivityEvent);
      expect(mockRestorationManager.handleOfflineTransition).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle online transition with feature restoration', async () => {
      const connectivityEvent = {
        type: 'online' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 5000 },
        currentStatus: { isOnline: true, connectionType: 'ethernet' as const, signalStrength: 100, offlineDuration: 0 }
      };

      mockRestorationManager.handleOnlineTransition.mockResolvedValue();

      // Simulate connectivity change
      mockConnectivityMonitor.emit('connectivityChanged', connectivityEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNotificationService.handleConnectivityChange).toHaveBeenCalledWith(connectivityEvent);
      expect(mockRestorationManager.handleOnlineTransition).toHaveBeenCalledWith(connectivityEvent.currentStatus);
    });

    it('should handle connectivity change errors gracefully', async () => {
      const connectivityEvent = {
        type: 'offline' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: true, connectionType: 'ethernet' as const, signalStrength: 100, offlineDuration: 0 },
        currentStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 0 }
      };

      mockRestorationManager.handleOfflineTransition.mockImplementation(() => {
        throw new Error('Restoration manager error');
      });

      const errorSpy = jest.fn();
      detector.on('error', errorSpy);

      // Simulate connectivity change
      mockConnectivityMonitor.emit('connectivityChanged', connectivityEvent);

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'connectivity-handling',
        error: expect.any(Error)
      });
    });
  });

  describe('Feature Availability', () => {
    beforeEach(async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();
    });

    it('should check feature availability correctly', () => {
      mockConnectivityMonitor.isFeatureAvailable.mockReturnValue(true);

      const isAvailable = detector.isFeatureAvailable('wake-word-detection');

      expect(isAvailable).toBe(true);
      expect(mockConnectivityMonitor.isFeatureAvailable).toHaveBeenCalledWith('wake-word-detection');
    });

    it('should handle feature availability changes', () => {
      const featureEvent = {
        featureId: 'weather-updates',
        isAvailable: false,
        isOnline: false
      };

      const eventSpy = jest.fn();
      detector.on('featureAvailabilityChanged', eventSpy);

      // Simulate feature availability change
      mockConnectivityMonitor.emit('featureAvailabilityChanged', featureEvent);

      expect(mockNotificationService.handleFeatureAvailabilityChange).toHaveBeenCalledWith(
        'weather-updates',
        false,
        false
      );
      expect(eventSpy).toHaveBeenCalledWith(featureEvent);
    });
  });

  describe('Status and Messages', () => {
    beforeEach(async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();
    });

    it('should return comprehensive status', () => {
      const mockFeatures = [
        { featureId: 'feature1', isAvailable: true, requiresInternet: false, fallbackAvailable: true },
        { featureId: 'feature2', isAvailable: false, requiresInternet: true, fallbackAvailable: false }
      ];

      const mockNotifications = [
        { id: 'notif1', type: 'info' as const, title: 'Test', message: 'Test message', timestamp: new Date(), isChildFriendly: true }
      ];

      mockConnectivityMonitor.getAllFeatureAvailability.mockReturnValue(mockFeatures);
      mockNotificationService.getActiveNotifications.mockReturnValue(mockNotifications);

      const status = detector.getStatus();

      expect(status.isOnline).toBe(true);
      expect(status.availableFeatures).toHaveLength(1);
      expect(status.unavailableFeatures).toHaveLength(1);
      expect(status.activeNotifications).toHaveLength(1);
    });

    it('should generate appropriate status messages for online state', () => {
      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'ethernet',
        signalStrength: 100,
        offlineDuration: 0
      });

      const message = detector.getStatusMessage();

      expect(message).toBe('All features are available and working normally.');
    });

    it('should generate appropriate status messages for offline state', () => {
      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 300000 // 5 minutes
      });

      mockConnectivityMonitor.getOfflineLimitationsMessage.mockReturnValue('Working offline. Limited features: Weather Updates');

      // Set offline since 5 minutes ago
      (detector as any).offlineSince = new Date(Date.now() - 300000);

      const message = detector.getStatusMessage();

      expect(message).toContain('Working offline. Limited features: Weather Updates');
      expect(message).toContain('5 minute');
    });

    it('should provide offline alternatives', () => {
      const mockAlternatives = [
        'Voice commands for local device control still work',
        'Scheduling and reminders work offline'
      ];

      mockConnectivityMonitor.getOfflineAlternatives.mockReturnValue(mockAlternatives);

      const alternatives = detector.getOfflineAlternatives();

      expect(alternatives).toEqual(mockAlternatives);
    });
  });

  describe('Manual Operations', () => {
    beforeEach(async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();
    });

    it('should manually check connectivity', async () => {
      const mockStatus = {
        isOnline: true,
        connectionType: 'wifi' as const,
        signalStrength: 80,
        offlineDuration: 0
      };

      // Mock the private method
      (detector as any).connectivityMonitor.checkConnectivity = jest.fn().mockResolvedValue();
      mockConnectivityMonitor.getStatus.mockReturnValue(mockStatus);

      const status = await detector.checkConnectivity();

      expect(status).toEqual(mockStatus);
    });

    it('should retry failed features', async () => {
      const mockFailedFeatures = [
        {
          featureId: 'weather-updates',
          isEnabled: false,
          wasAvailableBeforeOffline: true,
          requiresInitialization: true,
          initializationStatus: 'failed' as const,
          restoreAttempts: 1,
          maxRestoreAttempts: 3
        }
      ];

      mockRestorationManager.getFeatureStates.mockReturnValue(mockFailedFeatures);
      mockRestorationManager.retryFeature.mockResolvedValue({
        featureId: 'weather-updates',
        success: true,
        restorationTime: 1000,
        requiresUserAction: false
      });

      await detector.retryFailedFeatures();

      expect(mockRestorationManager.retryFeature).toHaveBeenCalledWith('weather-updates');
    });

    it('should throw error when no failed features to retry', async () => {
      mockRestorationManager.getFeatureStates.mockReturnValue([]);

      await expect(detector.retryFailedFeatures()).rejects.toThrow('No failed features to retry');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        enableNotifications: false,
        notificationPreferences: {
          useChildFriendlyLanguage: false,
          audioNotifications: false,
          showOfflineNotifications: true,
          showFeatureRestorationNotifications: true
        }
      };

      const configSpy = jest.fn();
      detector.on('configUpdated', configSpy);

      detector.updateConfig(newConfig);

      expect(mockNotificationService.updatePreferences).toHaveBeenCalledWith(newConfig.notificationPreferences);
      expect(configSpy).toHaveBeenCalled();
      expect(detector.getConfig().enableNotifications).toBe(false);
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();
    });

    it('should report healthy status when everything is working', () => {
      mockNotificationService.getActiveNotifications.mockReturnValue([]);
      mockRestorationManager.getFeatureStates.mockReturnValue([]);

      const health = detector.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.recommendations).toHaveLength(0);
    });

    it('should report issues when offline for extended period', () => {
      // Set offline since 2 hours ago
      (detector as any).offlineSince = new Date(Date.now() - 2 * 60 * 60 * 1000);

      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 2 * 60 * 60 * 1000
      });

      const health = detector.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Device has been offline for 2 hours');
      expect(health.recommendations).toContain('Check network connection and router status');
    });

    it('should report issues when features failed to restore', () => {
      const mockFailedFeatures = [
        {
          featureId: 'weather-updates',
          isEnabled: false,
          wasAvailableBeforeOffline: true,
          requiresInitialization: true,
          initializationStatus: 'failed' as const,
          restoreAttempts: 3,
          maxRestoreAttempts: 3
        }
      ];

      mockRestorationManager.getFeatureStates.mockReturnValue(mockFailedFeatures);

      const health = detector.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('1 features failed to restore');
      expect(health.recommendations).toContain('Try manually retrying failed features');
    });

    it('should report issues when too many notifications are active', () => {
      const manyNotifications = Array.from({ length: 6 }, (_, i) => ({
        id: `notif${i}`,
        type: 'info' as const,
        title: `Notification ${i}`,
        message: `Message ${i}`,
        timestamp: new Date(),
        isChildFriendly: true
      }));

      mockNotificationService.getActiveNotifications.mockReturnValue(manyNotifications);

      const health = detector.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Too many active notifications');
      expect(health.recommendations).toContain('Clear old notifications to improve user experience');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      mockConnectivityMonitor.startMonitoring.mockResolvedValue();
      await detector.initialize();

      const shutdownSpy = jest.fn();
      detector.on('shutdown', shutdownSpy);

      await detector.shutdown();

      expect(mockConnectivityMonitor.stopMonitoring).toHaveBeenCalled();
      expect(mockNotificationService.clearAllNotifications).toHaveBeenCalled();
      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      // Don't initialize
      await detector.shutdown();

      expect(mockConnectivityMonitor.stopMonitoring).not.toHaveBeenCalled();
    });
  });
});