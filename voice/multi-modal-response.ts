/**
 * Multi-Modal Response Support System
 * 
 * Handles response formatting for both audio and visual output, SSML generation
 * for speech control, emotional tone expression, and fallback text display.
 * 
 * Safety: All output validated for child-appropriate content
 * Performance: Optimized for real-time generation on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { PersonalityProfile } from '../models/voice-models';
import { ResponseContext } from './interfaces';

export interface MultiModalResponse {
  text: string;
  ssml: string;
  visualElements: VisualElement[];
  audioMetadata: AudioMetadata;
  fallbackText: string;
  emotionalTone: EmotionalTone;
}

export interface VisualElement {
  type: 'text' | 'icon' | 'animation' | 'progress' | 'notification';
  content: string;
  style: VisualStyle;
  duration?: number;
  priority: 'low' | 'medium' | 'high';
  accessibility: AccessibilityInfo;
}

export interface VisualStyle {
  fontSize: 'small' | 'medium' | 'large';
  color: string;
  backgroundColor?: string;
  animation?: 'fade' | 'slide' | 'bounce' | 'pulse';
  position: 'top' | 'center' | 'bottom';
  alignment: 'left' | 'center' | 'right';
}

export interface AccessibilityInfo {
  altText: string;
  ariaLabel: string;
  highContrast: boolean;
  screenReaderText?: string;
}

export interface AudioMetadata {
  expectedDuration: number;
  voiceId: string;
  speechRate: number;
  pitch: number;
  volume: number;
  emotionalMarkers: EmotionalMarker[];
}

export interface EmotionalMarker {
  position: number; // Position in text (character index)
  emotion: EmotionalTone;
  intensity: number; // 0.0 to 1.0
  duration: number; // Duration in milliseconds
}

export interface EmotionalTone {
  primary: 'neutral' | 'happy' | 'excited' | 'calm' | 'concerned' | 'encouraging';
  secondary?: 'gentle' | 'enthusiastic' | 'patient' | 'playful' | 'serious';
  intensity: number; // 0.0 to 1.0
  childAppropriate: boolean;
}

export interface SSMLOptions {
  includeBreaks: boolean;
  includeEmphasis: boolean;
  includeEmotions: boolean;
  includeProsody: boolean;
  voiceEffects: boolean;
}

export interface MultiModalOptions {
  enableVisualFeedback: boolean;
  enableSSML: boolean;
  enableEmotionalTones: boolean;
  fallbackMode: 'text' | 'visual' | 'both';
  accessibilityMode: boolean;
}

export class MultiModalResponseProcessor extends EventEmitter {
  private personality: PersonalityProfile | null = null;
  private options: MultiModalOptions;
  private ssmlTemplates: Map<string, string> = new Map();
  private emotionalProfiles: Map<string, EmotionalTone> = new Map();

  constructor(options: Partial<MultiModalOptions> = {}) {
    super();
    
    this.options = {
      enableVisualFeedback: true,
      enableSSML: true,
      enableEmotionalTones: true,
      fallbackMode: 'both',
      accessibilityMode: false,
      ...options
    };

    this.initializeSSMLTemplates();
    this.initializeEmotionalProfiles();
  }

  /**
   * Process response into multi-modal format
   * Requirements: 3.5, 3.6 - Multi-modal response support with emotional tone
   */
  async processResponse(
    text: string, 
    context: ResponseContext,
    options: Partial<SSMLOptions> = {}
  ): Promise<MultiModalResponse> {
    const startTime = Date.now();

    try {
      // Determine emotional tone based on context and personality
      const emotionalTone = this.determineEmotionalTone(text, context);
      
      // Generate SSML for speech control
      const ssml = this.options.enableSSML ? 
        await this.generateSSML(text, emotionalTone, options) : text;
      
      // Create visual elements
      const visualElements = this.options.enableVisualFeedback ? 
        this.generateVisualElements(text, emotionalTone, context) : [];
      
      // Generate audio metadata
      const audioMetadata = this.generateAudioMetadata(text, emotionalTone, context);
      
      // Create fallback text
      const fallbackText = this.generateFallbackText(text, context);
      
      const response: MultiModalResponse = {
        text,
        ssml,
        visualElements,
        audioMetadata,
        fallbackText,
        emotionalTone
      };

      const processingTime = Date.now() - startTime;
      this.emit('responseProcessed', {
        processingTime,
        hasVisualElements: visualElements.length > 0,
        hasSSML: ssml !== text,
        emotionalTone: emotionalTone.primary
      });

      return response;

    } catch (error) {
      this.emit('error', { error, text, context, stage: 'multi_modal_processing' });
      return this.generateErrorFallback(text, context);
    }
  }

  /**
   * Set personality for emotional tone adaptation
   */
  setPersonality(personality: PersonalityProfile): void {
    this.personality = personality;
    this.emit('personalityUpdated', { personalityId: personality.id });
  }

  /**
   * Generate SSML markup for speech control and emphasis
   * Requirements: 3.5 - SSML generation for speech control
   */
  private async generateSSML(
    text: string, 
    emotionalTone: EmotionalTone,
    options: Partial<SSMLOptions> = {}
  ): Promise<string> {
    const ssmlOptions: SSMLOptions = {
      includeBreaks: true,
      includeEmphasis: true,
      includeEmotions: true,
      includeProsody: true,
      voiceEffects: false,
      ...options
    };

    let ssml = `<speak>${text}</speak>`;

    // Apply prosody based on emotional tone
    if (ssmlOptions.includeProsody) {
      ssml = this.applyProsodySSML(ssml, emotionalTone);
    }

    // Add emphasis for important words
    if (ssmlOptions.includeEmphasis) {
      ssml = this.addEmphasisSSML(ssml);
    }

    // Add natural breaks
    if (ssmlOptions.includeBreaks) {
      ssml = this.addBreaksSSML(ssml);
    }

    // Apply emotional markers
    if (ssmlOptions.includeEmotions && this.options.enableEmotionalTones) {
      ssml = this.addEmotionalMarkersSSML(ssml, emotionalTone);
    }

    // Apply voice effects (carefully for child safety)
    if (ssmlOptions.voiceEffects && this.isVoiceEffectSafe(emotionalTone)) {
      ssml = this.addVoiceEffectsSSML(ssml, emotionalTone);
    }

    return ssml;
  }

  /**
   * Determine appropriate emotional tone based on context
   * Requirements: 3.6 - Emotional tone and personality expression
   */
  private determineEmotionalTone(text: string, context: ResponseContext): EmotionalTone {
    // Start with neutral tone
    let tone: EmotionalTone = {
      primary: 'neutral',
      intensity: 0.5,
      childAppropriate: true
    };

    // Analyze text content for emotional cues (only if emotional tones are enabled)
    if (this.options.enableEmotionalTones) {
      const textLower = text.toLowerCase();
      
      if (textLower.includes('great') || textLower.includes('awesome') || textLower.includes('excellent')) {
        tone.primary = 'excited';
        tone.intensity = 0.7;
      } else if (textLower.includes('help') || textLower.includes('assist')) {
        tone.primary = 'encouraging';
        tone.secondary = 'gentle';
        tone.intensity = 0.6;
      } else if (textLower.includes('sorry') || textLower.includes('problem')) {
        tone.primary = 'concerned';
        tone.secondary = 'gentle';
        tone.intensity = 0.4;
      } else if (textLower.includes('done') || textLower.includes('complete')) {
        tone.primary = 'happy';
        tone.intensity = 0.6;
      }
    }

    // Apply personality influence
    if (this.personality) {
      tone = this.applyPersonalityToTone(tone, this.personality);
    }

    // Ensure child-appropriate tone
    tone = this.ensureChildAppropriateTone(tone, context);

    return tone;
  }

  /**
   * Generate visual elements for display
   * Requirements: 3.5 - Response formatting for visual output
   */
  private generateVisualElements(
    text: string, 
    emotionalTone: EmotionalTone, 
    context: ResponseContext
  ): VisualElement[] {
    const elements: VisualElement[] = [];

    // Main text display
    elements.push({
      type: 'text',
      content: text,
      style: this.getTextStyle(emotionalTone, context),
      priority: 'high',
      accessibility: {
        altText: text,
        ariaLabel: `Assistant response: ${text}`,
        highContrast: context.userPreferences?.accessibilitySettings?.visualFeedback || false,
        screenReaderText: text
      }
    });

    // Emotional indicator icon
    if (emotionalTone.primary !== 'neutral') {
      elements.push({
        type: 'icon',
        content: this.getEmotionalIcon(emotionalTone),
        style: {
          fontSize: 'medium',
          color: this.getEmotionalColor(emotionalTone),
          position: 'top',
          alignment: 'right',
          animation: 'fade'
        },
        duration: 2000,
        priority: 'medium',
        accessibility: {
          altText: `Emotional tone: ${emotionalTone.primary}`,
          ariaLabel: `Assistant is expressing ${emotionalTone.primary} emotion`,
          highContrast: false
        }
      });
    }

    // Progress indicator for long responses
    if (text.length > 100) {
      elements.push({
        type: 'progress',
        content: 'Speaking...',
        style: {
          fontSize: 'small',
          color: '#666666',
          position: 'bottom',
          alignment: 'center'
        },
        priority: 'low',
        accessibility: {
          altText: 'Speech in progress',
          ariaLabel: 'Assistant is currently speaking',
          highContrast: false
        }
      });
    }

    return elements;
  }

  /**
   * Generate audio metadata for TTS processing
   */
  private generateAudioMetadata(
    text: string, 
    emotionalTone: EmotionalTone, 
    context: ResponseContext
  ): AudioMetadata {
    // Estimate duration based on text length and speech rate
    const wordsPerMinute = 150; // Average speaking rate
    const wordCount = text.split(' ').length;
    const baseDuration = (wordCount / wordsPerMinute) * 60 * 1000; // milliseconds

    // Adjust for emotional tone
    let speechRate = 1.0;
    let pitch = 1.0;
    let volume = 0.8;

    switch (emotionalTone.primary) {
      case 'excited':
        speechRate = 1.1;
        pitch = 1.1;
        volume = 0.9;
        break;
      case 'calm':
        speechRate = 0.9;
        pitch = 0.95;
        volume = 0.7;
        break;
      case 'concerned':
        speechRate = 0.85;
        pitch = 0.9;
        volume = 0.75;
        break;
      case 'encouraging':
        speechRate = 1.0;
        pitch = 1.05;
        volume = 0.85;
        break;
    }

    // Apply user preferences
    const userVoiceSettings = context.userPreferences.voiceSettings;
    speechRate *= userVoiceSettings.speechRate;
    pitch *= userVoiceSettings.pitch;
    volume *= userVoiceSettings.volume;

    // Generate emotional markers
    const emotionalMarkers = this.generateEmotionalMarkers(text, emotionalTone);

    return {
      expectedDuration: baseDuration / speechRate,
      voiceId: userVoiceSettings.preferredVoice,
      speechRate,
      pitch,
      volume,
      emotionalMarkers
    };
  }

  /**
   * Generate fallback text for TTS failures
   * Requirements: 3.5 - Fallback text display for TTS failures
   */
  private generateFallbackText(text: string, context: ResponseContext): string {
    // Clean text for display
    let fallbackText = text;
    
    // Handle empty text
    if (!fallbackText.trim()) {
      fallbackText = 'I\'m here to help!';
    }
    
    // Remove SSML tags if present
    fallbackText = fallbackText.replace(/<[^>]*>/g, '');
    
    // Add visual indicators for emotional tone
    const emotionalIndicators: Record<string, string> = {
      'happy': '😊 ',
      'excited': '🎉 ',
      'calm': '😌 ',
      'concerned': '😔 ',
      'encouraging': '💪 '
    };

    // Add accessibility enhancements
    if (context.userPreferences?.accessibilitySettings?.visualFeedback) {
      fallbackText = `[Assistant]: ${fallbackText}`;
    }

    return fallbackText;
  }

  // Helper methods for SSML generation

  private applyProsodySSML(ssml: string, emotionalTone: EmotionalTone): string {
    const prosodyAttributes: string[] = [];
    
    switch (emotionalTone.primary) {
      case 'excited':
        prosodyAttributes.push('rate="fast"', 'pitch="high"');
        break;
      case 'calm':
        prosodyAttributes.push('rate="slow"', 'pitch="low"');
        break;
      case 'happy':
        prosodyAttributes.push('pitch="medium"', 'volume="loud"');
        break;
      case 'concerned':
        prosodyAttributes.push('rate="slow"', 'volume="soft"');
        break;
    }

    if (prosodyAttributes.length > 0) {
      const prosodyTag = `<prosody ${prosodyAttributes.join(' ')}>`;
      ssml = ssml.replace('<speak>', `<speak>${prosodyTag}`);
      ssml = ssml.replace('</speak>', '</prosody></speak>');
    }

    return ssml;
  }

  private addEmphasisSSML(ssml: string): string {
    // Emphasize important words
    const emphasisWords = ['important', 'please', 'help', 'great', 'excellent', 'done'];
    
    emphasisWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      ssml = ssml.replace(regex, `<emphasis level="moderate">${word}</emphasis>`);
    });

    return ssml;
  }

  private addBreaksSSML(ssml: string): string {
    // Add natural pauses
    ssml = ssml.replace(/\./g, '.<break time="500ms"/>');
    ssml = ssml.replace(/,/g, ',<break time="250ms"/>');
    ssml = ssml.replace(/!/g, '!<break time="750ms"/>');
    ssml = ssml.replace(/\?/g, '?<break time="750ms"/>');
    
    return ssml;
  }

  private addEmotionalMarkersSSML(ssml: string, emotionalTone: EmotionalTone): string {
    // Add emotional expression markers
    if (emotionalTone.primary === 'happy' || emotionalTone.primary === 'excited') {
      ssml = ssml.replace('<speak>', '<speak><amazon:emotion name="excited" intensity="medium">');
      ssml = ssml.replace('</speak>', '</amazon:emotion></speak>');
    }
    
    return ssml;
  }

  private addVoiceEffectsSSML(ssml: string, emotionalTone: EmotionalTone): string {
    // Add subtle voice effects (only if child-safe)
    if (emotionalTone.childAppropriate && emotionalTone.secondary === 'playful') {
      // Very subtle effects only
      ssml = ssml.replace('<speak>', '<speak><amazon:effect name="whispered">');
      ssml = ssml.replace('</speak>', '</amazon:effect></speak>');
    }
    
    return ssml;
  }

  // Helper methods for visual and emotional processing

  private getTextStyle(emotionalTone: EmotionalTone, context: ResponseContext): VisualStyle {
    const baseStyle: VisualStyle = {
      fontSize: 'medium',
      color: '#333333',
      position: 'center',
      alignment: 'left'
    };

    // Adjust for emotional tone
    switch (emotionalTone.primary) {
      case 'excited':
        baseStyle.color = '#FF6B35';
        baseStyle.animation = 'bounce';
        break;
      case 'happy':
        baseStyle.color = '#4CAF50';
        break;
      case 'calm':
        baseStyle.color = '#2196F3';
        break;
      case 'concerned':
        baseStyle.color = '#FF9800';
        break;
    }

    // Apply accessibility settings
    if (context.userPreferences?.accessibilitySettings?.visualFeedback) {
      baseStyle.fontSize = 'large';
      baseStyle.backgroundColor = '#F5F5F5';
    }

    return baseStyle;
  }

  private getEmotionalIcon(emotionalTone: EmotionalTone): string {
    const icons: Record<string, string> = {
      'happy': '😊',
      'excited': '🎉',
      'calm': '😌',
      'concerned': '😔',
      'encouraging': '💪',
      'neutral': '🤖'
    };

    return icons[emotionalTone.primary] || icons['neutral'];
  }

  private getEmotionalColor(emotionalTone: EmotionalTone): string {
    const colors: Record<string, string> = {
      'happy': '#4CAF50',
      'excited': '#FF6B35',
      'calm': '#2196F3',
      'concerned': '#FF9800',
      'encouraging': '#9C27B0',
      'neutral': '#666666'
    };

    return colors[emotionalTone.primary] || colors['neutral'];
  }

  private applyPersonalityToTone(tone: EmotionalTone, personality: PersonalityProfile): EmotionalTone {
    const responseStyle = personality.responseStyle;
    
    // Adjust intensity based on personality traits
    if (responseStyle.enthusiasm > 0.7) {
      tone.intensity = Math.min(1.0, tone.intensity * 1.2);
    }
    
    if (responseStyle.humor > 0.6 && tone.primary === 'happy') {
      tone.secondary = 'playful';
    }
    
    if (responseStyle.patience > 0.8) {
      tone.secondary = 'gentle';
    }

    return tone;
  }

  private ensureChildAppropriateTone(tone: EmotionalTone, context: ResponseContext): EmotionalTone {
    // Ensure tone is appropriate for child safety level
    if (context.safetyLevel === 'child') {
      // Limit intensity for children
      tone.intensity = Math.min(0.7, tone.intensity);
      
      // Ensure only child-appropriate emotions
      const childSafeEmotions = ['happy', 'excited', 'calm', 'encouraging', 'neutral'];
      if (!childSafeEmotions.includes(tone.primary)) {
        tone.primary = 'neutral';
      }
    }

    tone.childAppropriate = true;
    return tone;
  }

  private generateEmotionalMarkers(text: string, emotionalTone: EmotionalTone): EmotionalMarker[] {
    const markers: EmotionalMarker[] = [];
    
    // Add markers at key positions
    const sentences = text.split(/[.!?]+/);
    let position = 0;
    
    sentences.forEach(sentence => {
      if (sentence.trim()) {
        markers.push({
          position,
          emotion: emotionalTone,
          intensity: emotionalTone.intensity,
          duration: sentence.length * 50 // Rough estimate
        });
        position += sentence.length + 1;
      }
    });

    return markers;
  }

  private isVoiceEffectSafe(emotionalTone: EmotionalTone): boolean {
    // Only allow very mild voice effects for child safety
    return emotionalTone.childAppropriate && emotionalTone.intensity < 0.8;
  }

  private generateErrorFallback(text: string, context: ResponseContext): MultiModalResponse {
    return {
      text,
      ssml: text,
      visualElements: [{
        type: 'text',
        content: text,
        style: {
          fontSize: 'medium',
          color: '#333333',
          position: 'center',
          alignment: 'center'
        },
        priority: 'high',
        accessibility: {
          altText: text,
          ariaLabel: text,
          highContrast: false
        }
      }],
      audioMetadata: {
        expectedDuration: text.length * 100,
        voiceId: 'default',
        speechRate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        emotionalMarkers: []
      },
      fallbackText: text,
      emotionalTone: {
        primary: 'neutral',
        intensity: 0.5,
        childAppropriate: true
      }
    };
  }

  private initializeSSMLTemplates(): void {
    // Initialize common SSML templates
    this.ssmlTemplates.set('greeting', '<speak><prosody rate="medium" pitch="medium">{{text}}</prosody></speak>');
    this.ssmlTemplates.set('confirmation', '<speak><emphasis level="moderate">{{text}}</emphasis></speak>');
    this.ssmlTemplates.set('error', '<speak><prosody rate="slow" volume="soft">{{text}}</prosody></speak>');
  }

  private initializeEmotionalProfiles(): void {
    // Initialize emotional tone profiles
    this.emotionalProfiles.set('child_friendly', {
      primary: 'happy',
      secondary: 'gentle',
      intensity: 0.6,
      childAppropriate: true
    });
    
    this.emotionalProfiles.set('encouraging', {
      primary: 'encouraging',
      secondary: 'patient',
      intensity: 0.7,
      childAppropriate: true
    });
  }
}