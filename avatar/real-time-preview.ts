/**
 * Real-Time Preview Integration
 * 
 * Manages real-time preview functionality for avatar customization changes,
 * integrating with the 3D renderer and performance monitoring.
 */

import { EventEmitter } from 'events';
import { Avatar3DRenderer } from '../rendering/renderer';
import { AvatarConfiguration, CustomizationChange } from './types';
import { VoiceCharacteristicsManager } from './voice-characteristics-manager';

export interface PreviewConfig {
  enableRealTimeUpdates: boolean;
  previewQuality: 'low' | 'medium' | 'high';
  maxPreviewDuration: number; // milliseconds
  performanceThreshold: number; // minimum FPS
  autoRevertOnPoorPerformance: boolean;
}

export interface PreviewState {
  isActive: boolean;
  changeId: string;
  startTime: Date;
  currentFPS: number;
  memoryUsage: number;
  previewType: 'appearance' | 'voice' | 'personality';
}

export interface PreviewResult {
  success: boolean;
  performanceImpact: 'low' | 'medium' | 'high';
  renderTime: number;
  memoryDelta: number;
  qualityAdjustments: string[];
}

/**
 * Real-time preview manager
 */
export class RealTimePreviewManager extends EventEmitter {
  private renderer: Avatar3DRenderer;
  private voiceManager: VoiceCharacteristicsManager;
  private config: PreviewConfig;
  private currentState: PreviewState;
  private originalConfiguration: AvatarConfiguration;
  private previewConfiguration: AvatarConfiguration;
  private performanceMonitor: PerformanceMonitor;
  private previewTimeout: NodeJS.Timeout | null;

  constructor(
    renderer: Avatar3DRenderer,
    voiceManager: VoiceCharacteristicsManager,
    config: PreviewConfig
  ) {
    super();
    this.renderer = renderer;
    this.voiceManager = voiceManager;
    this.config = config;
    this.performanceMonitor = new PerformanceMonitor();
    this.previewTimeout = null;
    
    this.currentState = {
      isActive: false,
      changeId: '',
      startTime: new Date(),
      currentFPS: 0,
      memoryUsage: 0,
      previewType: 'appearance'
    };
  }

  /**
   * Start real-time preview for a customization change
   */
  async startPreview(
    change: CustomizationChange,
    originalConfig: AvatarConfiguration
  ): Promise<PreviewResult> {
    try {
      // Stop any existing preview
      if (this.currentState.isActive) {
        await this.stopPreview();
      }

      this.originalConfiguration = { ...originalConfig };
      this.previewConfiguration = this.applyChangeToConfiguration(change, originalConfig);

      // Start performance monitoring
      this.performanceMonitor.startMonitoring();

      // Update state
      this.currentState = {
        isActive: true,
        changeId: change.changeId,
        startTime: new Date(),
        currentFPS: 0,
        memoryUsage: 0,
        previewType: change.type
      };

      // Apply preview based on change type
      let result: PreviewResult;
      switch (change.type) {
        case 'appearance':
          result = await this.previewAppearanceChange();
          break;
        case 'voice':
          result = await this.previewVoiceChange();
          break;
        case 'personality':
          result = await this.previewPersonalityChange();
          break;
        default:
          throw new Error(`Unsupported preview type: ${change.type}`);
      }

      // Set auto-revert timeout
      this.setPreviewTimeout();

      // Monitor performance continuously
      this.startPerformanceMonitoring();

      this.emit('previewStarted', { change, result, state: this.currentState });
      return result;

    } catch (error) {
      this.emit('previewError', { error: error.message, change });
      throw error;
    }
  }

  /**
   * Stop current preview and revert to original configuration
   */
  async stopPreview(): Promise<void> {
    if (!this.currentState.isActive) return;

    try {
      // Clear timeout
      if (this.previewTimeout) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = null;
      }

      // Stop performance monitoring
      this.performanceMonitor.stopMonitoring();

      // Revert to original configuration
      if (this.currentState.previewType === 'appearance') {
        await this.renderer.renderAvatar(this.originalConfiguration);
      }

      // Update state
      this.currentState.isActive = false;
      
      this.emit('previewStopped', { 
        duration: Date.now() - this.currentState.startTime.getTime(),
        finalMetrics: this.performanceMonitor.getMetrics()
      });

    } catch (error) {
      this.emit('previewError', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply preview changes permanently
   */
  async applyPreview(): Promise<void> {
    if (!this.currentState.isActive) {
      throw new Error('No active preview to apply');
    }

    try {
      // The preview configuration becomes the new original
      this.originalConfiguration = { ...this.previewConfiguration };
      
      // Stop preview monitoring but keep the current render
      this.performanceMonitor.stopMonitoring();
      this.currentState.isActive = false;

      if (this.previewTimeout) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = null;
      }

      this.emit('previewApplied', { 
        configuration: this.originalConfiguration,
        metrics: this.performanceMonitor.getMetrics()
      });

    } catch (error) {
      this.emit('previewError', { error: error.message });
      throw error;
    }
  }

  /**
   * Update preview quality based on performance
   */
  async adjustPreviewQuality(targetFPS: number): Promise<void> {
    if (!this.currentState.isActive) return;

    try {
      const currentMetrics = this.performanceMonitor.getMetrics();
      
      if (currentMetrics.averageFPS < targetFPS) {
        // Reduce quality
        const newQuality = this.getReducedQuality(this.config.previewQuality);
        this.config.previewQuality = newQuality;
        
        // Apply quality settings to renderer
        await this.renderer.optimizeRenderQuality(targetFPS);
        
        this.emit('qualityAdjusted', { 
          newQuality, 
          reason: 'performance',
          currentFPS: currentMetrics.averageFPS,
          targetFPS 
        });
      }
    } catch (error) {
      this.emit('previewError', { error: error.message });
    }
  }

  /**
   * Get current preview metrics
   */
  getPreviewMetrics(): {
    isActive: boolean;
    duration: number;
    performance: any;
    memoryUsage: number;
  } {
    return {
      isActive: this.currentState.isActive,
      duration: this.currentState.isActive ? 
        Date.now() - this.currentState.startTime.getTime() : 0,
      performance: this.performanceMonitor.getMetrics(),
      memoryUsage: this.currentState.memoryUsage
    };
  }

  private async previewAppearanceChange(): Promise<PreviewResult> {
    const startTime = performance.now();
    const initialMemory = this.performanceMonitor.getMemoryUsage();

    try {
      // Render the preview configuration
      await this.renderer.renderAvatar(this.previewConfiguration);
      
      const renderTime = performance.now() - startTime;
      const memoryDelta = this.performanceMonitor.getMemoryUsage() - initialMemory;
      const metrics = this.renderer.getPerformanceMetrics();

      return {
        success: true,
        performanceImpact: this.calculatePerformanceImpact(renderTime, memoryDelta),
        renderTime,
        memoryDelta,
        qualityAdjustments: []
      };

    } catch (error) {
      return {
        success: false,
        performanceImpact: 'high',
        renderTime: performance.now() - startTime,
        memoryDelta: 0,
        qualityAdjustments: ['Failed to render preview']
      };
    }
  }

  private async previewVoiceChange(): Promise<PreviewResult> {
    const startTime = performance.now();

    try {
      // Generate voice preview
      const sampleText = "This is how your avatar will sound with these settings.";
      await this.voiceManager.previewVoice(this.previewConfiguration.voice, sampleText);
      
      const renderTime = performance.now() - startTime;

      return {
        success: true,
        performanceImpact: 'low',
        renderTime,
        memoryDelta: 0,
        qualityAdjustments: []
      };

    } catch (error) {
      return {
        success: false,
        performanceImpact: 'low',
        renderTime: performance.now() - startTime,
        memoryDelta: 0,
        qualityAdjustments: ['Voice preview failed']
      };
    }
  }

  private async previewPersonalityChange(): Promise<PreviewResult> {
    // Personality changes don't have immediate visual/audio feedback
    // but we can show text examples of how responses might change
    
    return {
      success: true,
      performanceImpact: 'low',
      renderTime: 0,
      memoryDelta: 0,
      qualityAdjustments: []
    };
  }

  private applyChangeToConfiguration(
    change: CustomizationChange,
    config: AvatarConfiguration
  ): AvatarConfiguration {
    const newConfig = { ...config };
    
    switch (change.type) {
      case 'appearance':
        newConfig.appearance = { 
          ...newConfig.appearance, 
          [change.category]: change.newValue 
        };
        break;
      case 'personality':
        newConfig.personality = { 
          ...newConfig.personality, 
          [change.category]: change.newValue 
        };
        break;
      case 'voice':
        newConfig.voice = { 
          ...newConfig.voice, 
          [change.category]: change.newValue 
        };
        break;
    }
    
    return newConfig;
  }

  private setPreviewTimeout(): void {
    if (this.config.maxPreviewDuration > 0) {
      this.previewTimeout = setTimeout(async () => {
        await this.stopPreview();
        this.emit('previewTimeout');
      }, this.config.maxPreviewDuration);
    }
  }

  private startPerformanceMonitoring(): void {
    const monitorInterval = setInterval(() => {
      if (!this.currentState.isActive) {
        clearInterval(monitorInterval);
        return;
      }

      const metrics = this.performanceMonitor.getMetrics();
      this.currentState.currentFPS = metrics.currentFPS;
      this.currentState.memoryUsage = metrics.memoryUsage;

      // Check if performance is below threshold
      if (this.config.autoRevertOnPoorPerformance && 
          metrics.currentFPS < this.config.performanceThreshold) {
        this.emit('poorPerformance', { metrics });
        
        // Auto-revert if performance is too poor
        this.stopPreview().catch(error => {
          this.emit('previewError', { error: error.message });
        });
      }

      this.emit('performanceUpdate', { metrics, state: this.currentState });
    }, 100); // Monitor every 100ms
  }

  private calculatePerformanceImpact(renderTime: number, memoryDelta: number): 'low' | 'medium' | 'high' {
    if (renderTime > 100 || memoryDelta > 50 * 1024 * 1024) { // 50MB
      return 'high';
    } else if (renderTime > 50 || memoryDelta > 20 * 1024 * 1024) { // 20MB
      return 'medium';
    }
    return 'low';
  }

  private getReducedQuality(currentQuality: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
    switch (currentQuality) {
      case 'high': return 'medium';
      case 'medium': return 'low';
      case 'low': return 'low';
    }
  }
}

/**
 * Performance monitoring for preview operations
 */
class PerformanceMonitor {
  private isMonitoring: boolean;
  private startTime: number;
  private frameCount: number;
  private lastFrameTime: number;
  private fpsHistory: number[];
  private memoryHistory: number[];

  constructor() {
    this.isMonitoring = false;
    this.startTime = 0;
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fpsHistory = [];
    this.memoryHistory = [];
  }

  startMonitoring(): void {
    this.isMonitoring = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.fpsHistory = [];
    this.memoryHistory = [];
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  recordFrame(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    if (this.lastFrameTime > 0) {
      const fps = 1000 / (currentTime - this.lastFrameTime);
      this.fpsHistory.push(fps);
      
      // Keep only last 60 frames for rolling average
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }
    }
    
    this.lastFrameTime = currentTime;
    this.frameCount++;

    // Record memory usage periodically
    if (this.frameCount % 10 === 0) {
      this.memoryHistory.push(this.getMemoryUsage());
    }
  }

  getMetrics(): {
    currentFPS: number;
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    memoryUsage: number;
    averageMemory: number;
    duration: number;
  } {
    const currentFPS = this.fpsHistory.length > 0 ? 
      this.fpsHistory[this.fpsHistory.length - 1] : 0;
    
    const averageFPS = this.fpsHistory.length > 0 ?
      this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length : 0;
    
    const minFPS = this.fpsHistory.length > 0 ? Math.min(...this.fpsHistory) : 0;
    const maxFPS = this.fpsHistory.length > 0 ? Math.max(...this.fpsHistory) : 0;
    
    const memoryUsage = this.getMemoryUsage();
    const averageMemory = this.memoryHistory.length > 0 ?
      this.memoryHistory.reduce((sum, mem) => sum + mem, 0) / this.memoryHistory.length : 0;

    return {
      currentFPS,
      averageFPS,
      minFPS,
      maxFPS,
      memoryUsage,
      averageMemory,
      duration: this.isMonitoring ? performance.now() - this.startTime : 0
    };
  }

  getMemoryUsage(): number {
    // In a real implementation, this would get actual memory usage
    // For now, return a mock value
    return process.memoryUsage?.()?.heapUsed || 0;
  }
}