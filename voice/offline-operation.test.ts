/**
 * Comprehensive unit tests for offline operation functionality
 * Tests offline mode detection, feature availability, model management, and connectivity restoration
 */

import { OfflineCapabilityDetector } from './offline-capability-detector';
import { ConnectivityMonitor } from './connectivity-monitor';
import { OfflineNotificationService } from './offline-notification-service';
import { FeatureRestorationManager } from './feature-restoration-manager';
import { OfflineModelManager } from './offline-model-manager';
import { ModelUpdateManager } from './model-update-manager';

// Mock all dependencies
jest.mock('./connectivity-monitor');
jest.mock('./offline-notification-service');
jest.mock('./feature-restoration-manager');
jest.mock('./offline-model-manager');
jest.mock('./model-update-manager');

describe('Offline Operation Integration Tests', () => {
  let offlineDetector: OfflineCapabilityDetector;
  let modelManager: OfflineModelManager;
  let updateManager: ModelUpdateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    offlineDetector = new OfflineCapabilityDetector({
      enableConnectivityMonitoring: true,
      enableNotifications: true,
      enableAutoRestoration: true
    });

    modelManager = new OfflineModelManager({
      modelsDirectory: './test-models',
      enableAutoValidation: true
    });

    updateManager = new ModelUpdateManager('./test-models', {
      enableAutoUpdates: true
    });
  });

  afterEach(async () => {
    if (offlineDetector) await offlineDetector.shutdown();
    if (modelManager) await modelManager.shutdown();
    if (updateManager) await updateManager.shutdown();
  });

  describe('Offline Mode Detection', () => {
    it('should detect transition to offline mode', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      
      // Setup initial online state
      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'ethernet',
        signalStrength: 100,
        offlineDuration: 0
      });

      mockConnectivityMonitor.getAllFeatureAvailability.mockReturnValue([
        { featureId: 'wake-word-detection', isAvailable: true, requiresInternet: false, fallbackAvailable: true },
        { featureId: 'weather-updates', isAvailable: true, requiresInternet: true, fallbackAvailable: false }
      ]);

      await offlineDetector.initialize();

      const offlineEventSpy = jest.fn();
      offlineDetector.on('offlineCapabilityChanged', offlineEventSpy);

      // Simulate going offline
      const offlineEvent = {
        type: 'offline' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: true, connectionType: 'ethernet' as const, signalStrength: 100, offlineDuration: 0 },
        currentStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 0 }
      };

      mockConnectivityMonitor.emit('connectivityChanged', offlineEvent);

      expect(offlineEventSpy).toHaveBeenCalledWith({
        connectivityEvent: offlineEvent,
        status: expect.objectContaining({
          isOnline: false
        })
      });
    });

    it('should assess feature availability correctly in offline mode', () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      
      mockConnectivityMonitor.getAllFeatureAvailability.mockReturnValue([
        { featureId: 'wake-word-detection', isAvailable: true, requiresInternet: false, fallbackAvailable: true },
        { featureId: 'speech-recognition', isAvailable: true, requiresInternet: false, fallbackAvailable: true },
        { featureId: 'weather-updates', isAvailable: false, requiresInternet: true, fallbackAvailable: false },
        { featureId: 'cloud-sync', isAvailable: false, requiresInternet: true, fallbackAvailable: false }
      ]);

      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 30000
      });

      const status = offlineDetector.getStatus();

      expect(status.isOnline).toBe(false);
      expect(status.availableFeatures).toHaveLength(2); // wake-word and speech-recognition
      expect(status.unavailableFeatures).toHaveLength(2); // weather and cloud-sync
      
      const availableFeatureIds = status.availableFeatures.map(f => f.featureId);
      expect(availableFeatureIds).toContain('wake-word-detection');
      expect(availableFeatureIds).toContain('speech-recognition');
    });

    it('should provide appropriate user notifications for offline limitations', async () => {
      const mockNotificationService = (offlineDetector as any).notificationService;
      
      mockNotificationService.getActiveNotifications.mockReturnValue([
        {
          id: 'offline-notification',
          type: 'info',
          title: 'Working Without Internet',
          message: "Don't worry! I can still help you with lots of things even without the internet.",
          timestamp: new Date(),
          isChildFriendly: true
        }
      ]);

      await offlineDetector.initialize();

      const status = offlineDetector.getStatus();
      expect(status.activeNotifications).toHaveLength(1);
      expect(status.activeNotifications[0].title).toBe('Working Without Internet');
      expect(status.activeNotifications[0].isChildFriendly).toBe(true);
    });

    it('should track offline duration correctly', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      
      // Set offline state with duration
      const offlineTime = new Date(Date.now() - 300000); // 5 minutes ago
      (offlineDetector as any).offlineSince = offlineTime;

      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 300000,
        lastOnlineTime: offlineTime
      });

      await offlineDetector.initialize();

      const statusMessage = offlineDetector.getStatusMessage();
      expect(statusMessage).toContain('5 minute');
    });
  });

  describe('Local Model Management', () => {
    it('should validate model integrity correctly', async () => {
      const mockValidationResult = {
        modelId: 'wake-word_test_v1.0.0',
        isValid: true,
        issues: [],
        checksumMatch: true,
        fileExists: true,
        fileSize: 1024 * 1024,
        validationTime: 150
      };

      modelManager.validateModel = jest.fn().mockResolvedValue(mockValidationResult);

      const result = await modelManager.validateModel('wake-word_test_v1.0.0');

      expect(result.isValid).toBe(true);
      expect(result.checksumMatch).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect corrupted models and use fallbacks', async () => {
      const corruptedModelResult = {
        modelId: 'speech-recognition_whisper_v1.0.0',
        isValid: false,
        issues: ['Checksum mismatch - file may be corrupted'],
        checksumMatch: false,
        fileExists: true,
        fileSize: 1024 * 1024,
        validationTime: 200
      };

      const fallbackLoadResult = {
        modelId: 'speech-recognition_whisper_v1.0.0',
        success: true,
        loadTime: 2000,
        memoryUsage: 512 * 1024 * 1024,
        fallbackUsed: true
      };

      modelManager.validateModel = jest.fn().mockResolvedValue(corruptedModelResult);
      modelManager.loadModel = jest.fn().mockResolvedValue(fallbackLoadResult);

      const validationResult = await modelManager.validateModel('speech-recognition_whisper_v1.0.0');
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.issues).toContain('Checksum mismatch - file may be corrupted');

      const loadResult = await modelManager.loadModel('speech-recognition_whisper_v1.0.0');
      expect(loadResult.success).toBe(true);
      expect(loadResult.fallbackUsed).toBe(true);
    });

    it('should manage model memory usage efficiently', async () => {
      const memoryStats = {
        totalUsage: 1.5 * 1024 * 1024 * 1024, // 1.5GB
        maxUsage: 2 * 1024 * 1024 * 1024, // 2GB
        loadedModels: 3,
        availableMemory: 0.5 * 1024 * 1024 * 1024, // 0.5GB
        usagePercentage: 75
      };

      modelManager.getMemoryStats = jest.fn().mockReturnValue(memoryStats);
      modelManager.optimizeMemoryUsage = jest.fn().mockResolvedValue(undefined);

      const stats = modelManager.getMemoryStats();
      expect(stats.usagePercentage).toBe(75);
      expect(stats.loadedModels).toBe(3);

      // Should trigger optimization when usage is high
      if (stats.usagePercentage > 70) {
        await modelManager.optimizeMemoryUsage();
        expect(modelManager.optimizeMemoryUsage).toHaveBeenCalled();
      }
    });

    it('should handle model loading failures gracefully', async () => {
      const failedLoadResult = {
        modelId: 'text-to-speech_tacotron_v1.0.0',
        success: false,
        loadTime: 100,
        memoryUsage: 0,
        error: 'Model file corrupted and no fallback available',
        fallbackUsed: false
      };

      modelManager.loadModel = jest.fn().mockResolvedValue(failedLoadResult);

      const result = await modelManager.loadModel('text-to-speech_tacotron_v1.0.0');

      expect(result.success).toBe(false);
      expect(result.error).toContain('corrupted');
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('Connectivity Restoration', () => {
    it('should detect return to online mode', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      await offlineDetector.initialize();

      const onlineEventSpy = jest.fn();
      offlineDetector.on('offlineCapabilityChanged', onlineEventSpy);

      // Simulate coming back online
      const onlineEvent = {
        type: 'online' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 60000 },
        currentStatus: { isOnline: true, connectionType: 'wifi' as const, signalStrength: 85, offlineDuration: 0 }
      };

      mockRestorationManager.handleOnlineTransition.mockResolvedValue();
      mockConnectivityMonitor.emit('connectivityChanged', onlineEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRestorationManager.handleOnlineTransition).toHaveBeenCalledWith(onlineEvent.currentStatus);
      expect(onlineEventSpy).toHaveBeenCalledWith({
        connectivityEvent: onlineEvent,
        status: expect.objectContaining({
          isOnline: true
        })
      });
    });

    it('should restore features automatically when connectivity returns', async () => {
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      const restorationProgress = {
        totalFeatures: 3,
        completedFeatures: 2,
        failedFeatures: 0,
        currentFeature: 'cloud-sync',
        estimatedTimeRemaining: 5000
      };

      const restorationComplete = {
        totalFeatures: 3,
        successfulFeatures: 3,
        failedFeatures: 0,
        duration: 8000,
        results: [
          { featureId: 'weather-updates', success: true, restorationTime: 2000, requiresUserAction: false },
          { featureId: 'cloud-sync', success: true, restorationTime: 3000, requiresUserAction: false },
          { featureId: 'software-updates', success: true, restorationTime: 3000, requiresUserAction: false }
        ]
      };

      await offlineDetector.initialize();

      const progressSpy = jest.fn();
      const completeSpy = jest.fn();
      offlineDetector.on('restorationProgress', progressSpy);
      offlineDetector.on('restorationComplete', completeSpy);

      // Simulate restoration events
      mockRestorationManager.emit('restorationProgress', restorationProgress);
      mockRestorationManager.emit('restorationComplete', restorationComplete);

      expect(progressSpy).toHaveBeenCalledWith(restorationProgress);
      expect(completeSpy).toHaveBeenCalledWith(restorationComplete);
      expect(restorationComplete.successfulFeatures).toBe(3);
      expect(restorationComplete.failedFeatures).toBe(0);
    });

    it('should handle partial feature restoration failures', async () => {
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      const restorationComplete = {
        totalFeatures: 3,
        successfulFeatures: 2,
        failedFeatures: 1,
        duration: 10000,
        results: [
          { featureId: 'weather-updates', success: true, restorationTime: 2000, requiresUserAction: false },
          { featureId: 'cloud-sync', success: false, error: 'Authentication required', restorationTime: 5000, requiresUserAction: true },
          { featureId: 'software-updates', success: true, restorationTime: 3000, requiresUserAction: false }
        ]
      };

      await offlineDetector.initialize();

      const completeSpy = jest.fn();
      const retrySpy = jest.fn();
      offlineDetector.on('restorationComplete', completeSpy);
      offlineDetector.on('retryingFailedFeatures', retrySpy);

      mockRestorationManager.emit('restorationComplete', restorationComplete);

      expect(completeSpy).toHaveBeenCalledWith(restorationComplete);
      expect(restorationComplete.failedFeatures).toBe(1);
      
      const failedFeature = restorationComplete.results.find(r => !r.success);
      expect(failedFeature?.requiresUserAction).toBe(true);
    });

    it('should retry failed feature restorations', async () => {
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      mockRestorationManager.getFeatureStates.mockReturnValue([
        {
          featureId: 'weather-updates',
          isEnabled: false,
          wasAvailableBeforeOffline: true,
          requiresInitialization: true,
          initializationStatus: 'failed',
          restoreAttempts: 1,
          maxRestoreAttempts: 3
        }
      ]);

      mockRestorationManager.retryFeature.mockResolvedValue({
        featureId: 'weather-updates',
        success: true,
        restorationTime: 2500,
        requiresUserAction: false
      });

      await offlineDetector.initialize();
      await offlineDetector.retryFailedFeatures();

      expect(mockRestorationManager.retryFeature).toHaveBeenCalledWith('weather-updates');
    });
  });

  describe('Model Update Management', () => {
    it('should check for model updates when connectivity is restored', async () => {
      const mockUpdates = [
        {
          modelId: 'wake-word_hey-assistant_v1.2.0',
          currentVersion: 'v1.2.0',
          availableVersion: 'v1.3.0',
          updateSize: 5 * 1024 * 1024,
          isRequired: false,
          releaseNotes: 'Improved accuracy'
        }
      ];

      updateManager.checkForUpdates = jest.fn().mockResolvedValue(mockUpdates);

      await updateManager.initialize();
      const updates = await updateManager.checkForUpdates();

      expect(updates).toHaveLength(1);
      expect(updates[0].availableVersion).toBe('v1.3.0');
      expect(updates[0].isRequired).toBe(false);
    });

    it('should handle critical model updates immediately', async () => {
      const criticalUpdate = {
        modelId: 'speech-recognition_whisper_v1.0.0',
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.1.0',
        updateSize: 50 * 1024 * 1024,
        isRequired: true,
        releaseNotes: 'Critical security update'
      };

      updateManager.scheduleUpdate = jest.fn().mockResolvedValue(undefined);
      updateManager.startUpdate = jest.fn().mockResolvedValue(undefined);

      await updateManager.scheduleUpdate(criticalUpdate.modelId, 'critical');

      expect(updateManager.scheduleUpdate).toHaveBeenCalledWith(criticalUpdate.modelId, 'critical');
    });

    it('should track update progress correctly', async () => {
      const updateProgress = {
        modelId: 'text-to-speech_tacotron_v2.0.0',
        totalSize: 100 * 1024 * 1024,
        downloadedSize: 50 * 1024 * 1024,
        percentage: 50,
        speed: 1024 * 1024, // 1MB/s
        estimatedTimeRemaining: 50,
        status: 'downloading' as const
      };

      updateManager.getUpdateProgress = jest.fn().mockReturnValue(updateProgress);

      const progress = updateManager.getUpdateProgress('text-to-speech_tacotron_v2.0.0');

      expect(progress?.percentage).toBe(50);
      expect(progress?.status).toBe('downloading');
      expect(progress?.estimatedTimeRemaining).toBe(50);
    });
  });

  describe('System Health and Recovery', () => {
    it('should assess system health correctly', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      const mockNotificationService = (offlineDetector as any).notificationService;
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      // Set up healthy system state
      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'ethernet',
        signalStrength: 100,
        offlineDuration: 0
      });

      mockNotificationService.getActiveNotifications.mockReturnValue([]);
      mockRestorationManager.getFeatureStates.mockReturnValue([]);

      await offlineDetector.initialize();

      const health = offlineDetector.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.recommendations).toHaveLength(0);
    });

    it('should identify health issues when offline for extended period', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;

      // Set offline for 3 hours
      const offlineTime = new Date(Date.now() - 3 * 60 * 60 * 1000);
      (offlineDetector as any).offlineSince = offlineTime;

      mockConnectivityMonitor.getStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        signalStrength: 0,
        offlineDuration: 3 * 60 * 60 * 1000
      });

      await offlineDetector.initialize();

      const health = offlineDetector.getHealthStatus();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Device has been offline for 3 hours');
      expect(health.recommendations).toContain('Check network connection and router status');
    });

    it('should provide offline alternatives when internet is unavailable', () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;

      const alternatives = [
        'Voice commands for local device control still work',
        'Scheduling and reminders work offline',
        'Avatar interactions continue normally',
        'All safety features remain active'
      ];

      mockConnectivityMonitor.getOfflineAlternatives.mockReturnValue(alternatives);

      const offlineAlternatives = offlineDetector.getOfflineAlternatives();

      expect(offlineAlternatives).toHaveLength(4);
      expect(offlineAlternatives).toContain('Voice commands for local device control still work');
      expect(offlineAlternatives).toContain('All safety features remain active');
    });
  });

  describe('Configuration and Customization', () => {
    it('should allow configuration updates', () => {
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
      offlineDetector.on('configUpdated', configSpy);

      offlineDetector.updateConfig(newConfig);

      expect(offlineDetector.getConfig().enableNotifications).toBe(false);
      expect(configSpy).toHaveBeenCalled();
    });

    it('should support custom notifications', () => {
      const customNotification = {
        type: 'warning' as const,
        title: 'Custom Warning',
        message: 'This is a custom notification for testing',
        isChildFriendly: true
      };

      const notificationSpy = jest.fn();
      offlineDetector.on('notificationAdded', notificationSpy);

      offlineDetector.addNotification(customNotification);

      expect(notificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Custom Warning',
          message: 'This is a custom notification for testing'
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle connectivity check failures gracefully', async () => {
      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;

      mockConnectivityMonitor.startMonitoring.mockRejectedValue(new Error('Network interface not available'));

      await expect(offlineDetector.initialize()).rejects.toThrow('Network interface not available');
    });

    it('should handle model validation errors without crashing', async () => {
      modelManager.validateModel = jest.fn().mockRejectedValue(new Error('File system error'));

      await expect(modelManager.validateModel('invalid-model')).rejects.toThrow('File system error');
    });

    it('should handle restoration manager failures', async () => {
      const mockRestorationManager = (offlineDetector as any).restorationManager;

      await offlineDetector.initialize();

      const errorSpy = jest.fn();
      offlineDetector.on('error', errorSpy);

      // Simulate restoration failure
      const connectivityEvent = {
        type: 'online' as const,
        timestamp: new Date(),
        previousStatus: { isOnline: false, connectionType: 'none' as const, signalStrength: 0, offlineDuration: 60000 },
        currentStatus: { isOnline: true, connectionType: 'wifi' as const, signalStrength: 85, offlineDuration: 0 }
      };

      mockRestorationManager.handleOnlineTransition.mockRejectedValue(new Error('Restoration failed'));

      const mockConnectivityMonitor = (offlineDetector as any).connectivityMonitor;
      mockConnectivityMonitor.emit('connectivityChanged', connectivityEvent);

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errorSpy).toHaveBeenCalledWith({
        type: 'connectivity-handling',
        error: expect.any(Error)
      });
    });
  });
});