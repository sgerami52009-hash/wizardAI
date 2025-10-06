/**
 * Feature Restoration Manager - Handles automatic restoration of features when connectivity returns
 * Manages graceful transitions between offline and online modes
 */

import { EventEmitter } from 'events';
import { ConnectivityStatus, FeatureAvailability } from './connectivity-monitor';

export interface FeatureState {
  featureId: string;
  isEnabled: boolean;
  wasAvailableBeforeOffline: boolean;
  requiresInitialization: boolean;
  initializationStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  lastRestoreAttempt?: Date;
  restoreAttempts: number;
  maxRestoreAttempts: number;
}

export interface RestorationResult {
  featureId: string;
  success: boolean;
  error?: string;
  restorationTime: number;
  requiresUserAction: boolean;
}

export interface RestorationProgress {
  totalFeatures: number;
  completedFeatures: number;
  failedFeatures: number;
  currentFeature?: string;
  estimatedTimeRemaining: number;
}

export class FeatureRestorationManager extends EventEmitter {
  private featureStates: Map<string, FeatureState> = new Map();
  private restorationInProgress = false;
  private restorationStartTime?: Date;
  private readonly MAX_RESTORE_ATTEMPTS = 3;
  private readonly RESTORE_RETRY_DELAY_MS = 5000; // 5 seconds
  private readonly RESTORATION_TIMEOUT_MS = 30000; // 30 seconds per feature

  constructor() {
    super();
    this.initializeFeatureStates();
  }

  /**
   * Initialize feature states with default configurations
   */
  private initializeFeatureStates(): void {
    const features = [
      {
        featureId: 'weather-updates',
        requiresInitialization: true,
        maxRestoreAttempts: 3
      },
      {
        featureId: 'cloud-sync',
        requiresInitialization: true,
        maxRestoreAttempts: 5
      },
      {
        featureId: 'software-updates',
        requiresInitialization: false,
        maxRestoreAttempts: 2
      },
      {
        featureId: 'enhanced-speech-models',
        requiresInitialization: true,
        maxRestoreAttempts: 3
      },
      {
        featureId: 'cloud-tts-voices',
        requiresInitialization: false,
        maxRestoreAttempts: 2
      }
    ];

    features.forEach(feature => {
      this.featureStates.set(feature.featureId, {
        featureId: feature.featureId,
        isEnabled: false,
        wasAvailableBeforeOffline: false,
        requiresInitialization: feature.requiresInitialization,
        initializationStatus: 'pending',
        restoreAttempts: 0,
        maxRestoreAttempts: feature.maxRestoreAttempts
      });
    });
  }

  /**
   * Handle connectivity going offline - save current feature states
   */
  handleOfflineTransition(availableFeatures: FeatureAvailability[]): void {
    availableFeatures.forEach(feature => {
      const state = this.featureStates.get(feature.featureId);
      if (state) {
        state.wasAvailableBeforeOffline = feature.isAvailable;
        state.isEnabled = false;
        state.initializationStatus = 'pending';
      }
    });

    this.emit('offlineTransitionComplete', {
      timestamp: new Date(),
      featuresDisabled: availableFeatures.filter(f => f.requiresInternet).length
    });
  }

  /**
   * Handle connectivity restoration - begin feature restoration process
   */
  async handleOnlineTransition(connectivityStatus: ConnectivityStatus): Promise<void> {
    if (this.restorationInProgress) {
      console.warn('Feature restoration already in progress');
      return;
    }

    this.restorationInProgress = true;
    this.restorationStartTime = new Date();

    try {
      await this.restoreFeatures(connectivityStatus);
    } catch (error) {
      console.error('Feature restoration failed:', error);
      this.emit('restorationFailed', { error: error.message });
    } finally {
      this.restorationInProgress = false;
    }
  }

  /**
   * Restore all features that were available before going offline
   */
  private async restoreFeatures(connectivityStatus: ConnectivityStatus): Promise<void> {
    const featuresToRestore = Array.from(this.featureStates.values())
      .filter(state => state.wasAvailableBeforeOffline && !state.isEnabled);

    if (featuresToRestore.length === 0) {
      this.emit('restorationComplete', {
        totalFeatures: 0,
        successfulFeatures: 0,
        failedFeatures: 0,
        duration: 0
      });
      return;
    }

    this.emit('restorationStarted', {
      totalFeatures: featuresToRestore.length,
      features: featuresToRestore.map(f => f.featureId)
    });

    const results: RestorationResult[] = [];
    let completedCount = 0;

    for (const featureState of featuresToRestore) {
      this.emit('restorationProgress', {
        totalFeatures: featuresToRestore.length,
        completedFeatures: completedCount,
        failedFeatures: results.filter(r => !r.success).length,
        currentFeature: featureState.featureId,
        estimatedTimeRemaining: this.estimateRemainingTime(featuresToRestore.length - completedCount)
      });

      try {
        const result = await this.restoreFeature(featureState, connectivityStatus);
        results.push(result);
        
        if (result.success) {
          featureState.isEnabled = true;
          featureState.initializationStatus = 'completed';
          featureState.restoreAttempts = 0;
        } else {
          featureState.initializationStatus = 'failed';
          featureState.restoreAttempts++;
        }
      } catch (error) {
        const result: RestorationResult = {
          featureId: featureState.featureId,
          success: false,
          error: error.message,
          restorationTime: 0,
          requiresUserAction: false
        };
        results.push(result);
        featureState.initializationStatus = 'failed';
        featureState.restoreAttempts++;
      }

      completedCount++;
    }

    const successfulFeatures = results.filter(r => r.success).length;
    const failedFeatures = results.filter(r => !r.success).length;
    const totalDuration = Date.now() - (this.restorationStartTime?.getTime() || 0);

    this.emit('restorationComplete', {
      totalFeatures: featuresToRestore.length,
      successfulFeatures,
      failedFeatures,
      duration: totalDuration,
      results
    });

    // Schedule retry for failed features
    if (failedFeatures > 0) {
      this.scheduleFailedFeatureRetry();
    }
  }

  /**
   * Restore a specific feature
   */
  private async restoreFeature(
    featureState: FeatureState, 
    connectivityStatus: ConnectivityStatus
  ): Promise<RestorationResult> {
    const startTime = Date.now();
    featureState.initializationStatus = 'in-progress';
    featureState.lastRestoreAttempt = new Date();

    try {
      // Feature-specific restoration logic
      switch (featureState.featureId) {
        case 'weather-updates':
          await this.restoreWeatherUpdates(connectivityStatus);
          break;
        case 'cloud-sync':
          await this.restoreCloudSync(connectivityStatus);
          break;
        case 'software-updates':
          await this.restoreSoftwareUpdates(connectivityStatus);
          break;
        case 'enhanced-speech-models':
          await this.restoreEnhancedSpeechModels(connectivityStatus);
          break;
        case 'cloud-tts-voices':
          await this.restoreCloudTTSVoices(connectivityStatus);
          break;
        default:
          throw new Error(`Unknown feature: ${featureState.featureId}`);
      }

      const restorationTime = Date.now() - startTime;
      
      return {
        featureId: featureState.featureId,
        success: true,
        restorationTime,
        requiresUserAction: false
      };
    } catch (error) {
      const restorationTime = Date.now() - startTime;
      
      return {
        featureId: featureState.featureId,
        success: false,
        error: error.message,
        restorationTime,
        requiresUserAction: this.requiresUserAction(featureState.featureId, error)
      };
    }
  }

  /**
   * Restore weather updates feature
   */
  private async restoreWeatherUpdates(connectivityStatus: ConnectivityStatus): Promise<void> {
    // Simulate weather service initialization
    await this.simulateAsyncOperation('weather-api-connection', 2000);
    
    // Verify weather API accessibility
    const weatherApiAvailable = await this.testWeatherAPI();
    if (!weatherApiAvailable) {
      throw new Error('Weather API is not accessible');
    }
  }

  /**
   * Restore cloud sync feature
   */
  private async restoreCloudSync(connectivityStatus: ConnectivityStatus): Promise<void> {
    // Simulate cloud sync initialization
    await this.simulateAsyncOperation('cloud-sync-connection', 3000);
    
    // Test cloud connectivity
    const cloudAvailable = await this.testCloudConnectivity();
    if (!cloudAvailable) {
      throw new Error('Cloud services are not accessible');
    }
  }

  /**
   * Restore software updates feature
   */
  private async restoreSoftwareUpdates(connectivityStatus: ConnectivityStatus): Promise<void> {
    // Simulate update service check
    await this.simulateAsyncOperation('update-service-check', 1500);
  }

  /**
   * Restore enhanced speech models
   */
  private async restoreEnhancedSpeechModels(connectivityStatus: ConnectivityStatus): Promise<void> {
    // Simulate model download/validation
    await this.simulateAsyncOperation('speech-model-validation', 4000);
  }

  /**
   * Restore cloud TTS voices
   */
  private async restoreCloudTTSVoices(connectivityStatus: ConnectivityStatus): Promise<void> {
    // Simulate TTS service connection
    await this.simulateAsyncOperation('tts-service-connection', 2500);
  }

  /**
   * Test weather API availability
   */
  private async testWeatherAPI(): Promise<boolean> {
    try {
      // Simulate API test
      await this.simulateAsyncOperation('weather-api-test', 1000);
      return Math.random() > 0.1; // 90% success rate
    } catch {
      return false;
    }
  }

  /**
   * Test cloud connectivity
   */
  private async testCloudConnectivity(): Promise<boolean> {
    try {
      // Simulate cloud test
      await this.simulateAsyncOperation('cloud-connectivity-test', 1500);
      return Math.random() > 0.05; // 95% success rate
    } catch {
      return false;
    }
  }

  /**
   * Simulate async operation with timeout
   */
  private async simulateAsyncOperation(operation: string, duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (Math.random() > 0.9) { // 10% failure rate
          reject(new Error(`${operation} failed`));
        } else {
          resolve();
        }
      }, duration);

      // Respect restoration timeout
      const maxTimeout = setTimeout(() => {
        clearTimeout(timeout);
        reject(new Error(`${operation} timed out`));
      }, this.RESTORATION_TIMEOUT_MS);

      timeout.unref();
      maxTimeout.unref();
    });
  }

  /**
   * Determine if feature restoration requires user action
   */
  private requiresUserAction(featureId: string, error: any): boolean {
    const userActionFeatures = ['cloud-sync']; // Features that might need user re-authentication
    return userActionFeatures.includes(featureId) && 
           error.message.includes('authentication');
  }

  /**
   * Schedule retry for failed features
   */
  private scheduleFailedFeatureRetry(): void {
    setTimeout(async () => {
      const failedFeatures = Array.from(this.featureStates.values())
        .filter(state => 
          state.initializationStatus === 'failed' && 
          state.restoreAttempts < state.maxRestoreAttempts
        );

      if (failedFeatures.length > 0 && !this.restorationInProgress) {
        this.emit('retryingFailedFeatures', {
          features: failedFeatures.map(f => f.featureId),
          attempt: Math.max(...failedFeatures.map(f => f.restoreAttempts)) + 1
        });

        // Retry restoration for failed features
        for (const featureState of failedFeatures) {
          try {
            const result = await this.restoreFeature(featureState, { isOnline: true } as ConnectivityStatus);
            if (result.success) {
              featureState.isEnabled = true;
              featureState.initializationStatus = 'completed';
              featureState.restoreAttempts = 0;
              
              this.emit('featureRetrySuccess', {
                featureId: featureState.featureId,
                attempt: featureState.restoreAttempts + 1
              });
            }
          } catch (error) {
            console.error(`Retry failed for ${featureState.featureId}:`, error);
          }
        }
      }
    }, this.RESTORE_RETRY_DELAY_MS);
  }

  /**
   * Estimate remaining restoration time
   */
  private estimateRemainingTime(remainingFeatures: number): number {
    const averageTimePerFeature = 3000; // 3 seconds average
    return remainingFeatures * averageTimePerFeature;
  }

  /**
   * Get current feature states
   */
  getFeatureStates(): FeatureState[] {
    return Array.from(this.featureStates.values());
  }

  /**
   * Get restoration progress
   */
  getRestorationProgress(): RestorationProgress | null {
    if (!this.restorationInProgress) return null;

    const states = Array.from(this.featureStates.values());
    const totalFeatures = states.filter(s => s.wasAvailableBeforeOffline).length;
    const completedFeatures = states.filter(s => s.initializationStatus === 'completed').length;
    const failedFeatures = states.filter(s => s.initializationStatus === 'failed').length;
    const currentFeature = states.find(s => s.initializationStatus === 'in-progress')?.featureId;

    return {
      totalFeatures,
      completedFeatures,
      failedFeatures,
      currentFeature,
      estimatedTimeRemaining: this.estimateRemainingTime(totalFeatures - completedFeatures)
    };
  }

  /**
   * Force retry of a specific failed feature
   */
  async retryFeature(featureId: string): Promise<RestorationResult> {
    const featureState = this.featureStates.get(featureId);
    if (!featureState) {
      throw new Error(`Feature ${featureId} not found`);
    }

    if (featureState.restoreAttempts >= featureState.maxRestoreAttempts) {
      throw new Error(`Maximum restore attempts exceeded for ${featureId}`);
    }

    return await this.restoreFeature(featureState, { isOnline: true } as ConnectivityStatus);
  }

  /**
   * Reset all feature states (for testing or manual reset)
   */
  resetAllFeatureStates(): void {
    this.featureStates.forEach(state => {
      state.isEnabled = false;
      state.wasAvailableBeforeOffline = false;
      state.initializationStatus = 'pending';
      state.restoreAttempts = 0;
      state.lastRestoreAttempt = undefined;
    });

    this.emit('featureStatesReset');
  }
}