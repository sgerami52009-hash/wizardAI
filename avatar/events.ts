// Avatar System Event Bus Integration

import { AvatarConfiguration, CustomizationChange, EmotionType, VoiceCharacteristics } from './types';

// Simple EventEmitter interface for Node.js compatibility
interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): this;
  setMaxListeners(n: number): this;
}

export interface AvatarEventBus extends EventEmitter {
  // Avatar state change events
  onAvatarConfigurationChanged(listener: (userId: string, config: AvatarConfiguration) => void): this;
  onCustomizationStarted(listener: (userId: string, sessionId: string) => void): this;
  onCustomizationCompleted(listener: (userId: string, sessionId: string, success: boolean) => void): this;
  onPreviewUpdated(listener: (userId: string, change: CustomizationChange) => void): this;
  
  // Appearance events
  onAppearanceChanged(listener: (userId: string, category: string, change: any) => void): this;
  onAnimationTriggered(listener: (userId: string, animationType: string, intensity: number) => void): this;
  onEmotionChanged(listener: (userId: string, emotion: EmotionType, intensity: number) => void): this;
  
  // Voice events
  onVoiceCharacteristicsChanged(listener: (userId: string, characteristics: VoiceCharacteristics) => void): this;
  onVoicePreviewGenerated(listener: (userId: string, previewData: any) => void): this;
  onVoiceTTSIntegrated(listener: (characteristics: VoiceCharacteristics) => void): this;
  
  // Performance events
  onPerformanceWarning(listener: (metric: string, value: number, threshold: number) => void): this;
  onRenderingOptimized(listener: (userId: string, optimizations: string[]) => void): this;
  
  // Safety events
  onSafetyViolation(listener: (userId: string, violation: SafetyViolation) => void): this;
  onParentalApprovalRequired(listener: (userId: string, reviewId: string) => void): this;
  onParentalDecisionProcessed(listener: (reviewId: string, approved: boolean) => void): this;
  
  // System events
  onSystemError(listener: (component: string, error: AvatarSystemError) => void): this;
  onSystemRecovery(listener: (component: string, recoveryAction: string) => void): this;
  
  // Voice event listeners
  onVoiceCharacteristicsChanged(listener: (userId: string, characteristics: VoiceCharacteristics) => void): this;
  onVoicePreviewGenerated(listener: (userId: string, previewData: any) => void): this;
  onVoiceTTSIntegrated(listener: (characteristics: VoiceCharacteristics) => void): this;
  
  // Emit methods
  emitAvatarConfigurationChanged(userId: string, config: AvatarConfiguration): boolean;
  emitCustomizationStarted(userId: string, sessionId: string): boolean;
  emitCustomizationCompleted(userId: string, sessionId: string, success: boolean): boolean;
  emitPreviewUpdated(userId: string, change: CustomizationChange): boolean;
  emitAppearanceChanged(userId: string, category: string, change: any): boolean;
  emitAnimationTriggered(userId: string, animationType: string, intensity: number): boolean;
  emitEmotionChanged(userId: string, emotion: EmotionType, intensity: number): boolean;
  emitPerformanceWarning(metric: string, value: number, threshold: number): boolean;
  emitRenderingOptimized(userId: string, optimizations: string[]): boolean;
  emitSafetyViolation(userId: string, violation: SafetyViolation): boolean;
  emitParentalApprovalRequired(userId: string, reviewId: string): boolean;
  emitParentalDecisionProcessed(reviewId: string, approved: boolean): boolean;
  emitSystemError(component: string, error: AvatarSystemError): boolean;
  emitSystemRecovery(component: string, recoveryAction: string): boolean;
}

export interface SafetyViolation {
  type: 'content' | 'age_restriction' | 'performance' | 'security' | 'voice_characteristics';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  blockedContent: string[];
  timestamp: Date;
}

export interface AvatarSystemError {
  code: string;
  message: string;
  component: string;
  severity: 'warning' | 'error' | 'critical';
  recoverable: boolean;
  context?: any;
}

export class AvatarEventBusImpl implements AvatarEventBus {
  private static instance: AvatarEventBusImpl;
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  
  private constructor() {
    // Initialize empty listeners map
  }
  
  public static getInstance(): AvatarEventBusImpl {
    if (!AvatarEventBusImpl.instance) {
      AvatarEventBusImpl.instance = new AvatarEventBusImpl();
    }
    return AvatarEventBusImpl.instance;
  }
  
  // Simple event emitter implementation
  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  setMaxListeners(n: number): this {
    // Simple implementation - just return this
    return this;
  }

  // Event listener registration methods
  onAvatarConfigurationChanged(listener: (userId: string, config: AvatarConfiguration) => void): this {
    return this.on('avatar:configuration:changed', listener);
  }
  
  onCustomizationStarted(listener: (userId: string, sessionId: string) => void): this {
    return this.on('avatar:customization:started', listener);
  }
  
  onCustomizationCompleted(listener: (userId: string, sessionId: string, success: boolean) => void): this {
    return this.on('avatar:customization:completed', listener);
  }
  
  onPreviewUpdated(listener: (userId: string, change: CustomizationChange) => void): this {
    return this.on('avatar:preview:updated', listener);
  }
  
  onAppearanceChanged(listener: (userId: string, category: string, change: any) => void): this {
    return this.on('avatar:appearance:changed', listener);
  }
  
  onAnimationTriggered(listener: (userId: string, animationType: string, intensity: number) => void): this {
    return this.on('avatar:animation:triggered', listener);
  }
  
  onEmotionChanged(listener: (userId: string, emotion: EmotionType, intensity: number) => void): this {
    return this.on('avatar:emotion:changed', listener);
  }
  
  onPerformanceWarning(listener: (metric: string, value: number, threshold: number) => void): this {
    return this.on('avatar:performance:warning', listener);
  }
  
  onRenderingOptimized(listener: (userId: string, optimizations: string[]) => void): this {
    return this.on('avatar:rendering:optimized', listener);
  }
  
  onSafetyViolation(listener: (userId: string, violation: SafetyViolation) => void): this {
    return this.on('avatar:safety:violation', listener);
  }
  
  onParentalApprovalRequired(listener: (userId: string, reviewId: string) => void): this {
    return this.on('avatar:parental:approval_required', listener);
  }
  
  onParentalDecisionProcessed(listener: (reviewId: string, approved: boolean) => void): this {
    return this.on('avatar:parental:decision_processed', listener);
  }
  
  onSystemError(listener: (component: string, error: AvatarSystemError) => void): this {
    return this.on('avatar:system:error', listener);
  }
  
  onSystemRecovery(listener: (component: string, recoveryAction: string) => void): this {
    return this.on('avatar:system:recovery', listener);
  }

  // Voice event listener methods
  onVoiceCharacteristicsChanged(listener: (userId: string, characteristics: VoiceCharacteristics) => void): this {
    return this.on('avatar:voice:characteristics:changed', listener);
  }

  onVoicePreviewGenerated(listener: (userId: string, previewData: any) => void): this {
    return this.on('avatar:voice:preview:generated', listener);
  }

  onVoiceTTSIntegrated(listener: (characteristics: VoiceCharacteristics) => void): this {
    return this.on('avatar:voice:tts:integrated', listener);
  }
  
  // Event emission methods
  emitAvatarConfigurationChanged(userId: string, config: AvatarConfiguration): boolean {
    return this.emit('avatar:configuration:changed', userId, config);
  }
  
  emitCustomizationStarted(userId: string, sessionId: string): boolean {
    return this.emit('avatar:customization:started', userId, sessionId);
  }
  
  emitCustomizationCompleted(userId: string, sessionId: string, success: boolean): boolean {
    return this.emit('avatar:customization:completed', userId, sessionId, success);
  }
  
  emitPreviewUpdated(userId: string, change: CustomizationChange): boolean {
    return this.emit('avatar:preview:updated', userId, change);
  }
  
  emitAppearanceChanged(userId: string, category: string, change: any): boolean {
    return this.emit('avatar:appearance:changed', userId, category, change);
  }
  
  emitAnimationTriggered(userId: string, animationType: string, intensity: number): boolean {
    return this.emit('avatar:animation:triggered', userId, animationType, intensity);
  }
  
  emitEmotionChanged(userId: string, emotion: EmotionType, intensity: number): boolean {
    return this.emit('avatar:emotion:changed', userId, emotion, intensity);
  }
  
  emitPerformanceWarning(metric: string, value: number, threshold: number): boolean {
    return this.emit('avatar:performance:warning', metric, value, threshold);
  }
  
  emitRenderingOptimized(userId: string, optimizations: string[]): boolean {
    return this.emit('avatar:rendering:optimized', userId, optimizations);
  }
  
  emitSafetyViolation(userId: string, violation: SafetyViolation): boolean {
    return this.emit('avatar:safety:violation', userId, violation);
  }
  
  emitParentalApprovalRequired(userId: string, reviewId: string): boolean {
    return this.emit('avatar:parental:approval_required', userId, reviewId);
  }
  
  emitParentalDecisionProcessed(reviewId: string, approved: boolean): boolean {
    return this.emit('avatar:parental:decision_processed', reviewId, approved);
  }
  
  emitSystemError(component: string, error: AvatarSystemError): boolean {
    return this.emit('avatar:system:error', component, error);
  }
  
  emitSystemRecovery(component: string, recoveryAction: string): boolean {
    return this.emit('avatar:system:recovery', component, recoveryAction);
  }

  // Voice event emission methods
  emitVoiceCharacteristicsChanged(userId: string, characteristics: VoiceCharacteristics): boolean {
    return this.emit('avatar:voice:characteristics:changed', userId, characteristics);
  }

  emitVoicePreviewGenerated(userId: string, previewData: any): boolean {
    return this.emit('avatar:voice:preview:generated', userId, previewData);
  }

  emitVoiceTTSIntegrated(characteristics: VoiceCharacteristics): boolean {
    return this.emit('avatar:voice:tts:integrated', characteristics);
  }
}

// Export singleton instance
export const avatarEventBus = AvatarEventBusImpl.getInstance();