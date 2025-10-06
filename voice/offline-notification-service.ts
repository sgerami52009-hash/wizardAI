/**
 * Offline Notification Service - Manages user notifications for offline limitations
 * Provides child-friendly messages about feature availability and alternatives
 */

import { EventEmitter } from 'events';
import { ConnectivityStatus, FeatureAvailability, ConnectivityEvent } from './connectivity-monitor';

export interface NotificationMessage {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  alternatives?: string[];
  timestamp: Date;
  duration?: number; // milliseconds to show notification
  isChildFriendly: boolean;
}

export interface NotificationPreferences {
  showOfflineNotifications: boolean;
  showFeatureRestorationNotifications: boolean;
  notificationDuration: number;
  useChildFriendlyLanguage: boolean;
  audioNotifications: boolean;
}

export class OfflineNotificationService extends EventEmitter {
  private notifications: Map<string, NotificationMessage> = new Map();
  private preferences: NotificationPreferences;
  private lastOfflineNotification: Date | null = null;
  private readonly NOTIFICATION_COOLDOWN_MS = 30000; // 30 seconds between offline notifications

  constructor(preferences?: Partial<NotificationPreferences>) {
    super();
    
    this.preferences = {
      showOfflineNotifications: true,
      showFeatureRestorationNotifications: true,
      notificationDuration: 5000, // 5 seconds
      useChildFriendlyLanguage: true,
      audioNotifications: true,
      ...preferences
    };
  }

  /**
   * Handle connectivity change events
   */
  handleConnectivityChange(event: ConnectivityEvent): void {
    switch (event.type) {
      case 'offline':
        this.showOfflineNotification(event.currentStatus);
        break;
      case 'online':
        this.showOnlineNotification(event.currentStatus);
        break;
      case 'degraded':
        this.showDegradedConnectionNotification(event.currentStatus);
        break;
    }
  }

  /**
   * Handle feature availability changes
   */
  handleFeatureAvailabilityChange(featureId: string, isAvailable: boolean, isOnline: boolean): void {
    if (isAvailable && isOnline) {
      this.showFeatureRestoredNotification(featureId);
    } else if (!isAvailable && !isOnline) {
      this.showFeatureUnavailableNotification(featureId);
    }
  }

  /**
   * Show offline notification
   */
  private showOfflineNotification(status: ConnectivityStatus): void {
    if (!this.preferences.showOfflineNotifications) return;

    // Implement cooldown to avoid spam
    const now = new Date();
    if (this.lastOfflineNotification && 
        (now.getTime() - this.lastOfflineNotification.getTime()) < this.NOTIFICATION_COOLDOWN_MS) {
      return;
    }

    this.lastOfflineNotification = now;

    const message = this.createOfflineMessage(status);
    this.addNotification(message);

    if (this.preferences.audioNotifications) {
      this.announceOfflineStatus();
    }
  }

  /**
   * Show online notification
   */
  private showOnlineNotification(status: ConnectivityStatus): void {
    if (!this.preferences.showFeatureRestorationNotifications) return;

    const message = this.createOnlineMessage(status);
    this.addNotification(message);

    if (this.preferences.audioNotifications) {
      this.announceOnlineStatus();
    }
  }

  /**
   * Show degraded connection notification
   */
  private showDegradedConnectionNotification(status: ConnectivityStatus): void {
    const message = this.createDegradedConnectionMessage(status);
    this.addNotification(message);
  }

  /**
   * Show feature restored notification
   */
  private showFeatureRestoredNotification(featureId: string): void {
    if (!this.preferences.showFeatureRestorationNotifications) return;

    const message = this.createFeatureRestoredMessage(featureId);
    this.addNotification(message);
  }

  /**
   * Show feature unavailable notification
   */
  private showFeatureUnavailableNotification(featureId: string): void {
    const message = this.createFeatureUnavailableMessage(featureId);
    this.addNotification(message);
  }

  /**
   * Create offline notification message
   */
  private createOfflineMessage(status: ConnectivityStatus): NotificationMessage {
    const isChildFriendly = this.preferences.useChildFriendlyLanguage;
    
    const title = isChildFriendly ? 
      "Working Without Internet" : 
      "Offline Mode Active";

    const message = isChildFriendly ?
      "Don't worry! I can still help you with lots of things even without the internet." :
      "Internet connection lost. Core features remain available offline.";

    const alternatives = [
      "I can still understand your voice commands",
      "Local device control works perfectly",
      "Scheduling and reminders are ready",
      "All safety features are active",
      "Your avatar is still here to help"
    ];

    return {
      id: `offline-${Date.now()}`,
      type: 'info',
      title,
      message,
      alternatives: isChildFriendly ? alternatives : alternatives.slice(0, 3),
      timestamp: new Date(),
      duration: this.preferences.notificationDuration,
      isChildFriendly
    };
  }

  /**
   * Create online notification message
   */
  private createOnlineMessage(status: ConnectivityStatus): NotificationMessage {
    const isChildFriendly = this.preferences.useChildFriendlyLanguage;
    
    const title = isChildFriendly ? 
      "Internet is Back!" : 
      "Connection Restored";

    const message = isChildFriendly ?
      "Great news! The internet is working again and all features are available." :
      "Internet connectivity restored. All features are now available.";

    return {
      id: `online-${Date.now()}`,
      type: 'success',
      title,
      message,
      timestamp: new Date(),
      duration: this.preferences.notificationDuration,
      isChildFriendly
    };
  }

  /**
   * Create degraded connection message
   */
  private createDegradedConnectionMessage(status: ConnectivityStatus): NotificationMessage {
    const isChildFriendly = this.preferences.useChildFriendlyLanguage;
    
    const title = isChildFriendly ? 
      "Internet is Slow" : 
      "Connection Issues";

    const message = isChildFriendly ?
      "The internet is working but it's a bit slow. Some features might take longer." :
      "Network connection is degraded. Some features may have reduced performance.";

    return {
      id: `degraded-${Date.now()}`,
      type: 'warning',
      title,
      message,
      timestamp: new Date(),
      duration: this.preferences.notificationDuration,
      isChildFriendly
    };
  }

  /**
   * Create feature restored message
   */
  private createFeatureRestoredMessage(featureId: string): NotificationMessage {
    const isChildFriendly = this.preferences.useChildFriendlyLanguage;
    const featureName = this.getFeatureFriendlyName(featureId);
    
    const title = isChildFriendly ? 
      `${featureName} is Back!` : 
      `${featureName} Restored`;

    const message = isChildFriendly ?
      `Great! ${featureName} is working again.` :
      `${featureName} functionality has been restored.`;

    return {
      id: `feature-restored-${featureId}-${Date.now()}`,
      type: 'success',
      title,
      message,
      timestamp: new Date(),
      duration: this.preferences.notificationDuration * 0.7, // Shorter duration
      isChildFriendly
    };
  }

  /**
   * Create feature unavailable message
   */
  private createFeatureUnavailableMessage(featureId: string): NotificationMessage {
    const isChildFriendly = this.preferences.useChildFriendlyLanguage;
    const featureName = this.getFeatureFriendlyName(featureId);
    
    const title = isChildFriendly ? 
      `${featureName} Needs Internet` : 
      `${featureName} Unavailable`;

    const message = isChildFriendly ?
      `${featureName} needs the internet to work. Let's try other fun things!` :
      `${featureName} requires internet connectivity and is currently unavailable.`;

    return {
      id: `feature-unavailable-${featureId}-${Date.now()}`,
      type: 'warning',
      title,
      message,
      timestamp: new Date(),
      duration: this.preferences.notificationDuration * 0.7,
      isChildFriendly
    };
  }

  /**
   * Get user-friendly feature name
   */
  private getFeatureFriendlyName(featureId: string): string {
    const friendlyNames: Record<string, string> = {
      'weather-updates': 'Weather Updates',
      'cloud-sync': 'Cloud Sync',
      'software-updates': 'Software Updates',
      'smart-home-control': 'Smart Home Control',
      'speech-recognition': 'Voice Understanding',
      'text-to-speech': 'Voice Responses',
      'wake-word-detection': 'Wake Word Detection'
    };

    return friendlyNames[featureId] || featureId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Add notification to active notifications
   */
  private addNotification(notification: NotificationMessage): void {
    this.notifications.set(notification.id, notification);
    
    // Emit notification event
    this.emit('notificationAdded', notification);

    // Auto-remove after duration
    if (notification.duration) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  /**
   * Remove notification
   */
  removeNotification(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      this.notifications.delete(notificationId);
      this.emit('notificationRemoved', notification);
    }
  }

  /**
   * Get all active notifications
   */
  getActiveNotifications(): NotificationMessage[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    const notifications = Array.from(this.notifications.values());
    this.notifications.clear();
    
    notifications.forEach(notification => {
      this.emit('notificationRemoved', notification);
    });
  }

  /**
   * Update notification preferences
   */
  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Announce offline status via audio (child-friendly)
   */
  private announceOfflineStatus(): void {
    const message = this.preferences.useChildFriendlyLanguage ?
      "I'm working without the internet right now, but I can still help you with lots of things!" :
      "Working offline. Core features remain available.";
    
    this.emit('audioAnnouncement', {
      text: message,
      priority: 'medium',
      emotion: 'neutral'
    });
  }

  /**
   * Announce online status via audio
   */
  private announceOnlineStatus(): void {
    const message = this.preferences.useChildFriendlyLanguage ?
      "Great news! The internet is back and all features are working!" :
      "Connection restored. All features are now available.";
    
    this.emit('audioAnnouncement', {
      text: message,
      priority: 'low',
      emotion: 'happy'
    });
  }

  /**
   * Get summary of current offline limitations
   */
  getOfflineSummary(): {
    isOffline: boolean;
    limitedFeatures: string[];
    availableFeatures: string[];
    userMessage: string;
  } {
    // This would be called with current connectivity status
    return {
      isOffline: true, // Would be determined by connectivity monitor
      limitedFeatures: ['Weather Updates', 'Cloud Sync', 'Software Updates'],
      availableFeatures: ['Voice Commands', 'Local Device Control', 'Scheduling', 'Avatar Interactions'],
      userMessage: this.preferences.useChildFriendlyLanguage ?
        "I'm working offline but can still help with lots of fun things!" :
        "Working offline with core features available."
    };
  }
}