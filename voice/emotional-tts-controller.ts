/**
 * Emotional Text-to-Speech Controller
 * Safety: Child-appropriate emotional expressions only
 * Performance: Real-time emotion processing for natural speech
 */

import { EventEmitter } from 'events';
import { TTSOptions } from './interfaces';
import { PersonalityProfile } from '../models/voice-models';

export interface EmotionalState {
  primary: EmotionType;
  intensity: number; // 0.0 to 1.0
  secondary?: EmotionType;
  duration?: number; // milliseconds
}

export type EmotionType = 'neutral' | 'happy' | 'concerned' | 'excited' | 'calm' | 'encouraging';

export interface EmotionMapping {
  emotion: EmotionType;
  voiceModifications: VoiceModifications;
  childSafe: boolean;
  ageAppropriate: string[]; // 'child', 'teen', 'adult'
}

export interface VoiceModifications {
  pitchMultiplier: number; // 0.5 to 2.0
  rateMultiplier: number;  // 0.5 to 2.0
  volumeMultiplier: number; // 0.5 to 1.5
  breathiness: number;     // 0.0 to 1.0
  tension: number;         // 0.0 to 1.0
}

export interface EmotionTransition {
  from: EmotionType;
  to: EmotionType;
  duration: number; // milliseconds
  curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export class EmotionalTTSController extends EventEmitter {
  private currentEmotion: EmotionalState;
  private emotionMappings: Map<EmotionType, EmotionMapping>;
  private activeTransition: EmotionTransition | null = null;
  private personality: PersonalityProfile | null = null;

  constructor() {
    super();
    this.currentEmotion = {
      primary: 'neutral',
      intensity: 0.5
    };
    this.initializeEmotionMappings();
  }

  /**
   * Set the current emotional state for speech synthesis
   */
  setEmotion(emotion: EmotionType, intensity: number = 0.7, ageGroup: string = 'child'): void {
    // Validate emotion is child-safe for the age group
    const mapping = this.emotionMappings.get(emotion);
    if (!mapping || !mapping.childSafe || !mapping.ageAppropriate.includes(ageGroup)) {
      console.warn(`Emotion ${emotion} not appropriate for age group ${ageGroup}, using neutral`);
      emotion = 'neutral';
      intensity = 0.5;
    }

    // Clamp intensity to safe ranges for children
    if (ageGroup === 'child') {
      intensity = Math.min(intensity, 0.8); // Limit intensity for children
    }

    const previousEmotion = this.currentEmotion.primary;
    this.currentEmotion = {
      primary: emotion,
      intensity: Math.max(0.0, Math.min(1.0, intensity))
    };

    this.emit('emotionChanged', {
      from: previousEmotion,
      to: emotion,
      intensity
    });
  }

  /**
   * Transition smoothly between emotions
   */
  transitionToEmotion(
    targetEmotion: EmotionType, 
    duration: number = 1000,
    ageGroup: string = 'child'
  ): void {
    if (this.activeTransition) {
      this.cancelTransition();
    }

    // Validate target emotion
    const mapping = this.emotionMappings.get(targetEmotion);
    if (!mapping || !mapping.childSafe || !mapping.ageAppropriate.includes(ageGroup)) {
      targetEmotion = 'neutral';
    }

    this.activeTransition = {
      from: this.currentEmotion.primary,
      to: targetEmotion,
      duration,
      curve: 'ease-in-out'
    };

    this.executeTransition();
  }

  /**
   * Apply emotional modifications to TTS options
   */
  applyEmotionalModifications(baseOptions: TTSOptions, ageGroup: string = 'child'): TTSOptions {
    const mapping = this.emotionMappings.get(this.currentEmotion.primary);
    if (!mapping) {
      return baseOptions;
    }

    const modifications = mapping.voiceModifications;
    const intensity = this.currentEmotion.intensity;

    // Apply personality-based adjustments if available
    let personalityAdjustment = 1.0;
    if (this.personality) {
      personalityAdjustment = this.calculatePersonalityAdjustment();
    }

    // Calculate modified values with intensity scaling
    const pitchMod = 1.0 + (modifications.pitchMultiplier - 1.0) * intensity * personalityAdjustment;
    const rateMod = 1.0 + (modifications.rateMultiplier - 1.0) * intensity * personalityAdjustment;
    const volumeMod = 1.0 + (modifications.volumeMultiplier - 1.0) * intensity * personalityAdjustment;

    // Apply child-safe limits
    const safePitch = ageGroup === 'child' ? 
      Math.max(0.8, Math.min(1.3, pitchMod)) : 
      Math.max(0.5, Math.min(2.0, pitchMod));

    const safeRate = ageGroup === 'child' ?
      Math.max(0.8, Math.min(1.2, rateMod)) :
      Math.max(0.5, Math.min(2.0, rateMod));

    return {
      ...baseOptions,
      pitch: (baseOptions.pitch || 1.0) * safePitch,
      rate: (baseOptions.rate || 1.0) * safeRate,
      volume: (baseOptions.volume || 1.0) * volumeMod,
      emotion: this.currentEmotion.primary
    };
  }

  /**
   * Set personality profile for emotional expression
   */
  setPersonality(personality: PersonalityProfile): void {
    this.personality = personality;
    this.emit('personalitySet', personality.id);
  }

  /**
   * Get current emotional state
   */
  getCurrentEmotion(): EmotionalState {
    return { ...this.currentEmotion };
  }

  /**
   * Check if an emotion is appropriate for the given age group
   */
  isEmotionAppropriate(emotion: EmotionType, ageGroup: string): boolean {
    const mapping = this.emotionMappings.get(emotion);
    return mapping ? mapping.childSafe && mapping.ageAppropriate.includes(ageGroup) : false;
  }

  /**
   * Get list of available emotions for age group
   */
  getAvailableEmotions(ageGroup: string): EmotionType[] {
    const available: EmotionType[] = [];
    
    for (const [emotion, mapping] of this.emotionMappings) {
      if (mapping.childSafe && mapping.ageAppropriate.includes(ageGroup)) {
        available.push(emotion);
      }
    }
    
    return available;
  }

  /**
   * Analyze text content to suggest appropriate emotion
   */
  suggestEmotionFromText(text: string, ageGroup: string = 'child'): EmotionType {
    const lowerText = text.toLowerCase();
    
    // Positive indicators
    if (lowerText.includes('great') || lowerText.includes('awesome') || 
        lowerText.includes('wonderful') || lowerText.includes('excellent')) {
      return this.isEmotionAppropriate('excited', ageGroup) ? 'excited' : 'happy';
    }
    
    // Happy indicators
    if (lowerText.includes('good') || lowerText.includes('nice') || 
        lowerText.includes('fun') || lowerText.includes('yay')) {
      return 'happy';
    }
    
    // Concern indicators
    if (lowerText.includes('careful') || lowerText.includes('watch out') || 
        lowerText.includes('be safe') || lowerText.includes('important')) {
      return 'concerned';
    }
    
    // Encouraging indicators
    if (lowerText.includes('you can') || lowerText.includes('try again') || 
        lowerText.includes('keep going') || lowerText.includes('almost')) {
      return 'encouraging';
    }
    
    return 'neutral';
  }

  private initializeEmotionMappings(): void {
    this.emotionMappings = new Map([
      ['neutral', {
        emotion: 'neutral',
        voiceModifications: {
          pitchMultiplier: 1.0,
          rateMultiplier: 1.0,
          volumeMultiplier: 1.0,
          breathiness: 0.0,
          tension: 0.0
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }],
      
      ['happy', {
        emotion: 'happy',
        voiceModifications: {
          pitchMultiplier: 1.15,
          rateMultiplier: 1.1,
          volumeMultiplier: 1.1,
          breathiness: 0.2,
          tension: 0.1
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }],
      
      ['excited', {
        emotion: 'excited',
        voiceModifications: {
          pitchMultiplier: 1.25,
          rateMultiplier: 1.2,
          volumeMultiplier: 1.2,
          breathiness: 0.3,
          tension: 0.2
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }],
      
      ['concerned', {
        emotion: 'concerned',
        voiceModifications: {
          pitchMultiplier: 0.95,
          rateMultiplier: 0.9,
          volumeMultiplier: 0.9,
          breathiness: 0.1,
          tension: 0.3
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }],
      
      ['calm', {
        emotion: 'calm',
        voiceModifications: {
          pitchMultiplier: 0.9,
          rateMultiplier: 0.85,
          volumeMultiplier: 0.8,
          breathiness: 0.4,
          tension: 0.0
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }],
      
      ['encouraging', {
        emotion: 'encouraging',
        voiceModifications: {
          pitchMultiplier: 1.1,
          rateMultiplier: 0.95,
          volumeMultiplier: 1.05,
          breathiness: 0.2,
          tension: 0.1
        },
        childSafe: true,
        ageAppropriate: ['child', 'teen', 'adult']
      }]
    ]);
  }

  private calculatePersonalityAdjustment(): number {
    if (!this.personality) return 1.0;
    
    const traits = this.personality.responseStyle;
    
    // Calculate adjustment based on personality traits
    let adjustment = 1.0;
    
    // Enthusiasm affects emotional intensity
    adjustment *= (0.5 + traits.enthusiasm * 0.5);
    
    // Patience affects rate of emotional expression
    if (traits.patience > 0.7) {
      adjustment *= 0.8; // More subdued emotions for patient personalities
    }
    
    // Humor can enhance positive emotions
    if (this.currentEmotion.primary === 'happy' || this.currentEmotion.primary === 'excited') {
      adjustment *= (1.0 + traits.humor * 0.2);
    }
    
    return Math.max(0.5, Math.min(1.5, adjustment));
  }

  private executeTransition(): void {
    if (!this.activeTransition) return;
    
    const startTime = Date.now();
    const transition = this.activeTransition;
    
    const updateTransition = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / transition.duration, 1.0);
      
      if (progress >= 1.0) {
        // Transition complete
        this.setEmotion(transition.to, this.currentEmotion.intensity);
        this.activeTransition = null;
        this.emit('transitionComplete', transition);
        return;
      }
      
      // Calculate intermediate emotion state
      const easedProgress = this.applyEasingCurve(progress, transition.curve);
      this.interpolateEmotion(transition.from, transition.to, easedProgress);
      
      // Continue transition
      setTimeout(updateTransition, 50); // 20fps update rate
    };
    
    updateTransition();
  }

  private cancelTransition(): void {
    if (this.activeTransition) {
      this.emit('transitionCancelled', this.activeTransition);
      this.activeTransition = null;
    }
  }

  private applyEasingCurve(progress: number, curve: string): number {
    switch (curve) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5 ? 
          2 * progress * progress : 
          1 - 2 * (1 - progress) * (1 - progress);
      default:
        return progress;
    }
  }

  private interpolateEmotion(from: EmotionType, to: EmotionType, progress: number): void {
    // For now, just update the primary emotion
    // In a more sophisticated implementation, we could blend voice characteristics
    this.currentEmotion.primary = progress > 0.5 ? to : from;
    this.emit('emotionInterpolated', {
      from,
      to,
      progress,
      current: this.currentEmotion.primary
    });
  }
}