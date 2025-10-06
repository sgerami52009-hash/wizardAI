/**
 * Connectivity Monitor - Tracks network connectivity and manages offline/online state
 * Provides real-time connectivity status and feature availability assessment
 */

import { EventEmitter } from 'events';

export interface ConnectivityStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'ethernet' | 'cellular' | 'none';
  signalStrength: number; // 0-100
  lastOnlineTime?: Date;
  offlineDuration: number; // milliseconds
}

export interface FeatureAvailability {
  featureId: string;
  isAvailable: boolean;
  requiresInternet: boolean;
  fallbackAvailable: boolean;
  userMessage?: string;
}

export interface ConnectivityEvent {
  type: 'online' | 'offline' | 'degraded';
  timestamp: Date;
  previousStatus: ConnectivityStatus;
  currentStatus: ConnectivityStatus;
}

export class ConnectivityMonitor extends EventEmitter {
  private status: ConnectivityStatus;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 5000; // 5 seconds
  private readonly PING_TIMEOUT_MS = 3000;
  private readonly TEST_URLS = [
    'https://www.google.com',
    'https://www.cloudflare.com',
    '8.8.8.8' // Google DNS as fallback
  ];

  private features: Map<string, FeatureAvailability> = new Map();

  constructor() {
    super();
    this.status = {
      isOnline: false,
      connectionType: 'none',
      signalStrength: 0,
      offlineDuration: 0
    };

    this.initializeFeatures();
  }

  /**
   * Initialize feature availability definitions
   */
  private initializeFeatures(): void {
    const featureDefinitions: FeatureAvailability[] = [
      {
        featureId: 'wake-word-detection',
        isAvailable: true,
        requiresInternet: false,
        fallbackAvailable: true,
        userMessage: 'Wake word detection works offline'
      },
      {
        featureId: 'speech-recognition',
        isAvailable: true,
        requiresInternet: false,
        fallbackAvailable: true,
        userMessage: 'Speech recognition works offline'
      },
      {
        featureId: 'text-to-speech',
        isAvailable: true,
        requiresInternet: false,
        fallbackAvailable: true,
        userMessage: 'Voice responses work offline'
      },
      {
        featureId: 'smart-home-control',
        isAvailable: true,
        requiresInternet: false,
        fallbackAvailable: true,
        userMessage: 'Local device control works offline'
      },
      {
        featureId: 'weather-updates',
        isAvailable: false,
        requiresInternet: true,
        fallbackAvailable: false,
        userMessage: 'Weather updates need internet connection'
      },
      {
        featureId: 'cloud-sync',
        isAvailable: false,
        requiresInternet: true,
        fallbackAvailable: false,
        userMessage: 'Cloud sync unavailable offline'
      },
      {
        featureId: 'software-updates',
        isAvailable: false,
        requiresInternet: true,
        fallbackAvailable: false,
        userMessage: 'Updates require internet connection'
      }
    ];

    featureDefinitions.forEach(feature => {
      this.features.set(feature.featureId, feature);
    });
  }

  /**
   * Start monitoring connectivity
   */
  async startMonitoring(): Promise<void> {
    // Initial connectivity check
    await this.checkConnectivity();

    // Set up periodic monitoring
    this.checkInterval = setInterval(async () => {
      await this.checkConnectivity();
    }, this.CHECK_INTERVAL_MS);

    // Listen for network events if available
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnlineEvent.bind(this));
      window.addEventListener('offline', this.handleOfflineEvent.bind(this));
    }
  }

  /**
   * Stop monitoring connectivity
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent.bind(this));
      window.removeEventListener('offline', this.handleOfflineEvent.bind(this));
    }
  }

  /**
   * Check current connectivity status
   */
  private async checkConnectivity(): Promise<void> {
    const previousStatus = { ...this.status };
    const startTime = Date.now();

    try {
      const isOnline = await this.performConnectivityTest();
      const currentTime = new Date();

      if (isOnline && !this.status.isOnline) {
        // Coming back online
        this.status = {
          isOnline: true,
          connectionType: await this.detectConnectionType(),
          signalStrength: await this.measureSignalStrength(),
          lastOnlineTime: currentTime,
          offlineDuration: 0
        };

        this.updateFeatureAvailability(true);
        this.emitConnectivityEvent('online', previousStatus);
      } else if (!isOnline && this.status.isOnline) {
        // Going offline
        this.status = {
          isOnline: false,
          connectionType: 'none',
          signalStrength: 0,
          lastOnlineTime: this.status.lastOnlineTime,
          offlineDuration: 0
        };

        this.updateFeatureAvailability(false);
        this.emitConnectivityEvent('offline', previousStatus);
      } else if (!isOnline) {
        // Still offline - update duration
        const offlineStart = this.status.lastOnlineTime || currentTime;
        this.status.offlineDuration = currentTime.getTime() - offlineStart.getTime();
      }
    } catch (error) {
      console.error('Connectivity check failed:', error);
      // Treat as offline if check fails
      if (this.status.isOnline) {
        this.handleOfflineEvent();
      }
    }
  }

  /**
   * Perform actual connectivity test
   */
  private async performConnectivityTest(): Promise<boolean> {
    const testPromises = this.TEST_URLS.map(url => this.testUrl(url));
    
    try {
      // If any URL responds successfully, we're online
      const results = await Promise.allSettled(testPromises);
      return results.some(result => result.status === 'fulfilled' && result.value);
    } catch {
      return false;
    }
  }

  /**
   * Test connectivity to a specific URL
   */
  private async testUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), this.PING_TIMEOUT_MS);
      
      // Simple fetch test with timeout
      fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      })
      .then(() => {
        clearTimeout(timeout);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Detect connection type (simplified for Jetson Nano Orin)
   */
  private async detectConnectionType(): Promise<'wifi' | 'ethernet' | 'cellular' | 'none'> {
    // On Jetson Nano Orin, typically ethernet or wifi
    // This would need platform-specific implementation
    if (this.status.isOnline) {
      return 'ethernet'; // Default assumption for Jetson
    }
    return 'none';
  }

  /**
   * Measure signal strength (simplified)
   */
  private async measureSignalStrength(): Promise<number> {
    if (!this.status.isOnline) return 0;
    
    // Simplified signal strength based on response time
    const startTime = Date.now();
    try {
      await this.testUrl(this.TEST_URLS[0]);
      const responseTime = Date.now() - startTime;
      
      // Convert response time to signal strength (0-100)
      if (responseTime < 100) return 100;
      if (responseTime < 500) return 80;
      if (responseTime < 1000) return 60;
      if (responseTime < 2000) return 40;
      return 20;
    } catch {
      return 0;
    }
  }

  /**
   * Update feature availability based on connectivity
   */
  private updateFeatureAvailability(isOnline: boolean): void {
    this.features.forEach((feature, featureId) => {
      const wasAvailable = feature.isAvailable;
      
      if (feature.requiresInternet) {
        feature.isAvailable = isOnline;
      } else {
        feature.isAvailable = true; // Offline features always available
      }

      // Emit feature availability change if status changed
      if (wasAvailable !== feature.isAvailable) {
        this.emit('featureAvailabilityChanged', {
          featureId,
          isAvailable: feature.isAvailable,
          isOnline
        });
      }
    });
  }

  /**
   * Handle browser online event
   */
  private handleOnlineEvent(): void {
    this.checkConnectivity();
  }

  /**
   * Handle browser offline event
   */
  private handleOfflineEvent(): void {
    const previousStatus = { ...this.status };
    this.status.isOnline = false;
    this.status.connectionType = 'none';
    this.status.signalStrength = 0;
    
    this.updateFeatureAvailability(false);
    this.emitConnectivityEvent('offline', previousStatus);
  }

  /**
   * Emit connectivity change event
   */
  private emitConnectivityEvent(
    type: 'online' | 'offline' | 'degraded',
    previousStatus: ConnectivityStatus
  ): void {
    const event: ConnectivityEvent = {
      type,
      timestamp: new Date(),
      previousStatus,
      currentStatus: { ...this.status }
    };

    this.emit('connectivityChanged', event);
  }

  /**
   * Get current connectivity status
   */
  getStatus(): ConnectivityStatus {
    return { ...this.status };
  }

  /**
   * Get feature availability
   */
  getFeatureAvailability(featureId: string): FeatureAvailability | null {
    return this.features.get(featureId) || null;
  }

  /**
   * Get all feature availability
   */
  getAllFeatureAvailability(): FeatureAvailability[] {
    return Array.from(this.features.values());
  }

  /**
   * Check if a specific feature is available
   */
  isFeatureAvailable(featureId: string): boolean {
    const feature = this.features.get(featureId);
    return feature ? feature.isAvailable : false;
  }

  /**
   * Get user-friendly message for offline limitations
   */
  getOfflineLimitationsMessage(): string {
    if (this.status.isOnline) {
      return "All features are available";
    }

    const unavailableFeatures = Array.from(this.features.values())
      .filter(f => !f.isAvailable && f.requiresInternet);

    if (unavailableFeatures.length === 0) {
      return "Working offline - all core features available";
    }

    const featureNames = unavailableFeatures
      .map(f => f.userMessage || f.featureId)
      .join(', ');

    return `Working offline. Limited features: ${featureNames}`;
  }

  /**
   * Get available alternatives for offline mode
   */
  getOfflineAlternatives(): string[] {
    const alternatives: string[] = [];
    
    if (!this.status.isOnline) {
      alternatives.push("Voice commands for local device control still work");
      alternatives.push("Scheduling and reminders work offline");
      alternatives.push("Avatar interactions continue normally");
      alternatives.push("All safety features remain active");
    }

    return alternatives;
  }
}