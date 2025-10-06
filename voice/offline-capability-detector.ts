/**
 * Offline Capability Detector - Main orchestrator for offline operation management
 * Integrates connectivity monitoring, notifications, and feature restoration
 */

import { EventEmitter } from 'events';
import { ConnectivityMonitor, ConnectivityStatus, FeatureAvailability, ConnectivityEvent } from './connectivity-monitor';
import { OfflineNotificationService, NotificationMessage } from './offline-notification-service';
import { FeatureRestorationManager, FeatureState, RestorationProgress } from './feature-restoration-manager';

export interface OfflineCapabilityStatus {
  isOnline: boolean;
  connectivityStatus: ConnectivityStatus;
  availableFeatures: FeatureAvailability[];
  unavailableFeatures: FeatureAvailability[];
  restorationProgress?: RestorationProgress;
  activeNotifications: NotificationMessage[];
  offlineSince?: Date;
  lastOnlineTime?: Date;
}

export interface OfflineCapabilityConfig {
  enableConnectivityMonitoring: boolean;
  enableNotifications: boolean;
  enableAutoRestoration: boolean;
  notificationPreferences: {
    showOfflineNotifications: boolean;
    showFeatureRestorationNotifications: boolean;
    useChildFriendlyLanguage: boolean;
    audioNotifications: boolean;
  };
  monitoringInterval: number;
  restorationRetryAttempts: number;
}

export class OfflineCapabilityDetector extends EventEmitter {
  private connectivityMonitor: ConnectivityMonitor;
  private notificationService: OfflineNotificationService;
  private restorationManager: FeatureRestorationManager;
  private config: OfflineCapabilityConfig;
  private isInitialized = false;
  private offlineSince?: Date;

  constructor(config?: Partial<OfflineCapabilityConfig>) {
    super();

    this.config = {
      enableConnectivityMonitoring: true,
      enableNotifications: true,
      enableAutoRestoration: true,
      notificationPreferences: {
        showOfflineNotifications: true,
        showFeatureRestorationNotifications: true,
        useChildFriendlyLanguage: true,
        audioNotifications: true
      },
      monitoringInterval: 5000,
      restorationRetryAttempts: 3,
      ...config
    };

    this.connectivityMonitor = new ConnectivityMonitor();
    this.notificationService = new OfflineNotificationService(this.config.notificationPreferences);
    this.restorationManager = new FeatureRestorationManager();

    this.setupEventHandlers();
  }

  /**
   * Initialize the offline capability detection system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('OfflineCapabilityDetector already initialized');
      return;
    }

    try {
      // Start connectivity monitoring
      if (this.config.enableConnectivityMonitoring) {
        await this.connectivityMonitor.startMonitoring();
      }

      // Check initial connectivity status
      const initialStatus = this.connectivityMonitor.getStatus();
      if (!initialStatus.isOnline) {
        this.offlineSince = new Date();
      }

      this.isInitialized = true;
      this.emit('initialized', { status: initialStatus });

      console.log('OfflineCapabilityDetector initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OfflineCapabilityDetector:', error);
      throw error;
    }
  }

  /**
   * Shutdown the offline capability detection system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      this.connectivityMonitor.stopMonitoring();
      this.notificationService.clearAllNotifications();
      
      this.isInitialized = false;
      this.emit('shutdown');

      console.log('OfflineCapabilityDetector shutdown complete');
    } catch (error) {
      console.error('Error during OfflineCapabilityDetector shutdown:', error);
    }
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Connectivity monitor events
    this.connectivityMonitor.on('connectivityChanged', this.handleConnectivityChange.bind(this));
    this.connectivityMonitor.on('featureAvailabilityChanged', this.handleFeatureAvailabilityChange.bind(this));

    // Notification service events
    this.notificationService.on('notificationAdded', (notification: NotificationMessage) => {
      this.emit('notificationAdded', notification);
    });

    this.notificationService.on('notificationRemoved', (notification: NotificationMessage) => {
      this.emit('notificationRemoved', notification);
    });

    this.notificationService.on('audioAnnouncement', (announcement: any) => {
      this.emit('audioAnnouncement', announcement);
    });

    // Restoration manager events
    this.restorationManager.on('restorationStarted', (event: any) => {
      this.emit('restorationStarted', event);
    });

    this.restorationManager.on('restorationProgress', (progress: RestorationProgress) => {
      this.emit('restorationProgress', progress);
    });

    this.restorationManager.on('restorationComplete', (event: any) => {
      this.emit('restorationComplete', event);
    });

    this.restorationManager.on('restorationFailed', (event: any) => {
      this.emit('restorationFailed', event);
    });

    this.restorationManager.on('featureRetrySuccess', (event: any) => {
      this.emit('featureRetrySuccess', event);
    });
  }

  /**
   * Handle connectivity change events
   */
  private async handleConnectivityChange(event: ConnectivityEvent): Promise<void> {
    try {
      // Update offline tracking
      if (event.type === 'offline' && !this.offlineSince) {
        this.offlineSince = event.timestamp;
      } else if (event.type === 'online' && this.offlineSince) {
        this.offlineSince = undefined;
      }

      // Handle notifications
      if (this.config.enableNotifications) {
        this.notificationService.handleConnectivityChange(event);
      }

      // Handle feature restoration
      if (this.config.enableAutoRestoration) {
        if (event.type === 'offline') {
          const availableFeatures = this.connectivityMonitor.getAllFeatureAvailability();
          this.restorationManager.handleOfflineTransition(availableFeatures);
        } else if (event.type === 'online') {
          await this.restorationManager.handleOnlineTransition(event.currentStatus);
        }
      }

      // Emit unified event
      this.emit('offlineCapabilityChanged', {
        connectivityEvent: event,
        status: this.getStatus()
      });

    } catch (error) {
      console.error('Error handling connectivity change:', error);
      this.emit('error', { type: 'connectivity-handling', error });
    }
  }

  /**
   * Handle feature availability change events
   */
  private handleFeatureAvailabilityChange(event: any): void {
    try {
      if (this.config.enableNotifications) {
        this.notificationService.handleFeatureAvailabilityChange(
          event.featureId,
          event.isAvailable,
          event.isOnline
        );
      }

      this.emit('featureAvailabilityChanged', event);
    } catch (error) {
      console.error('Error handling feature availability change:', error);
      this.emit('error', { type: 'feature-availability-handling', error });
    }
  }

  /**
   * Get current offline capability status
   */
  getStatus(): OfflineCapabilityStatus {
    const connectivityStatus = this.connectivityMonitor.getStatus();
    const allFeatures = this.connectivityMonitor.getAllFeatureAvailability();
    const availableFeatures = allFeatures.filter(f => f.isAvailable);
    const unavailableFeatures = allFeatures.filter(f => !f.isAvailable);
    const restorationProgress = this.restorationManager.getRestorationProgress();
    const activeNotifications = this.notificationService.getActiveNotifications();

    return {
      isOnline: connectivityStatus.isOnline,
      connectivityStatus,
      availableFeatures,
      unavailableFeatures,
      restorationProgress,
      activeNotifications,
      offlineSince: this.offlineSince,
      lastOnlineTime: connectivityStatus.lastOnlineTime
    };
  }

  /**
   * Check if a specific feature is available
   */
  isFeatureAvailable(featureId: string): boolean {
    return this.connectivityMonitor.isFeatureAvailable(featureId);
  }

  /**
   * Get user-friendly status message
   */
  getStatusMessage(): string {
    const status = this.connectivityMonitor.getStatus();
    
    if (status.isOnline) {
      return "All features are available and working normally.";
    }

    const offlineDuration = this.getOfflineDurationString();
    const limitationsMessage = this.connectivityMonitor.getOfflineLimitationsMessage();
    
    return `${limitationsMessage}${offlineDuration ? ` (offline for ${offlineDuration})` : ''}`;
  }

  /**
   * Get offline alternatives message
   */
  getOfflineAlternatives(): string[] {
    return this.connectivityMonitor.getOfflineAlternatives();
  }

  /**
   * Get offline duration as human-readable string
   */
  private getOfflineDurationString(): string {
    if (!this.offlineSince) return '';

    const duration = Date.now() - this.offlineSince.getTime();
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return 'less than a minute';
    }
  }

  /**
   * Manually trigger connectivity check
   */
  async checkConnectivity(): Promise<ConnectivityStatus> {
    // Force a connectivity check
    await (this.connectivityMonitor as any).checkConnectivity();
    return this.connectivityMonitor.getStatus();
  }

  /**
   * Manually retry failed feature restoration
   */
  async retryFailedFeatures(): Promise<void> {
    const failedFeatures = this.restorationManager.getFeatureStates()
      .filter(state => state.initializationStatus === 'failed');

    if (failedFeatures.length === 0) {
      throw new Error('No failed features to retry');
    }

    for (const feature of failedFeatures) {
      try {
        await this.restorationManager.retryFeature(feature.featureId);
      } catch (error) {
        console.error(`Failed to retry feature ${feature.featureId}:`, error);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OfflineCapabilityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update notification preferences if changed
    if (newConfig.notificationPreferences) {
      this.notificationService.updatePreferences(newConfig.notificationPreferences);
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): OfflineCapabilityConfig {
    return { ...this.config };
  }

  /**
   * Get detailed feature states
   */
  getFeatureStates(): FeatureState[] {
    return this.restorationManager.getFeatureStates();
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    this.notificationService.clearAllNotifications();
  }

  /**
   * Add custom notification
   */
  addNotification(notification: Omit<NotificationMessage, 'id' | 'timestamp'>): void {
    const fullNotification: NotificationMessage = {
      ...notification,
      id: `custom-${Date.now()}`,
      timestamp: new Date()
    };

    (this.notificationService as any).addNotification(fullNotification);
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const status = this.getStatus();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for connectivity issues
    if (!status.isOnline && this.offlineSince) {
      const offlineHours = (Date.now() - this.offlineSince.getTime()) / (1000 * 60 * 60);
      if (offlineHours > 1) {
        issues.push(`Device has been offline for ${Math.round(offlineHours)} hours`);
        recommendations.push('Check network connection and router status');
      }
    }

    // Check for failed feature restorations
    const failedFeatures = this.getFeatureStates()
      .filter(state => state.initializationStatus === 'failed');
    
    if (failedFeatures.length > 0) {
      issues.push(`${failedFeatures.length} features failed to restore`);
      recommendations.push('Try manually retrying failed features');
    }

    // Check for excessive notifications
    if (status.activeNotifications.length > 5) {
      issues.push('Too many active notifications');
      recommendations.push('Clear old notifications to improve user experience');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}