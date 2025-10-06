/**
 * Accessibility Support for Avatar Customization Interface
 * 
 * Provides comprehensive accessibility features including screen reader support,
 * keyboard navigation, high contrast modes, and motor accessibility options.
 */

import { EventEmitter } from 'events';

export interface AccessibilityConfig {
  screenReaderEnabled: boolean;
  highContrastMode: boolean;
  largeTextMode: boolean;
  reducedMotion: boolean;
  keyboardNavigationOnly: boolean;
  voiceControlEnabled: boolean;
  colorBlindnessType?: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';
}

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  category: 'navigation' | 'change' | 'error' | 'success';
}

/**
 * Main accessibility manager for the customization interface
 */
export class AccessibilityManager extends EventEmitter {
  private config: AccessibilityConfig;
  private announcements: AccessibilityAnnouncement[];
  private focusHistory: string[];
  private currentFocus: string;

  constructor(config: AccessibilityConfig) {
    super();
    this.config = config;
    this.announcements = [];
    this.focusHistory = [];
    this.currentFocus = '';
  }

  /**
   * Announce information to screen readers
   */
  announce(announcement: AccessibilityAnnouncement): void {
    this.announcements.push(announcement);
    
    if (this.config.screenReaderEnabled) {
      this.emit('screenReaderAnnouncement', announcement);
    }

    // Also provide audio feedback for non-screen reader users
    if (announcement.category === 'error') {
      this.emit('audioFeedback', { type: 'error', message: announcement.message });
    } else if (announcement.category === 'success') {
      this.emit('audioFeedback', { type: 'success', message: announcement.message });
    }
  }

  /**
   * Describe the current customization option for screen readers
   */
  describeCustomizationOption(category: string, option: any): string {
    const descriptions = {
      face: this.describeFaceOption(option),
      hair: this.describeHairOption(option),
      clothing: this.describeClothingOption(option),
      accessories: this.describeAccessoryOption(option),
      personality: this.describePersonalityTrait(option),
      voice: this.describeVoiceParameter(option)
    };

    return descriptions[category as keyof typeof descriptions] || 'Customization option';
  }

  /**
   * Provide keyboard navigation instructions
   */
  getKeyboardInstructions(context: string): string {
    const instructions = {
      mainMenu: "Use arrow keys to navigate categories, Enter to select, Escape to go back",
      optionGrid: "Use arrow keys to browse options, Enter to preview, Space to apply",
      sliders: "Use left and right arrows to adjust values, or type a number",
      preview: "Press P to play preview, Enter to apply, Escape to cancel"
    };

    return instructions[context as keyof typeof instructions] || "Use Tab to navigate, Enter to select";
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(key: string, context: string): string | null {
    switch (key) {
      case 'Tab':
        return this.getNextFocusableElement(context);
      case 'Shift+Tab':
        return this.getPreviousFocusableElement(context);
      case 'Enter':
        return this.activateCurrentElement();
      case 'Escape':
        return this.goBack();
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
        return this.navigateWithArrows(key, context);
      default:
        return null;
    }
  }

  /**
   * Apply accessibility styling based on user preferences
   */
  getAccessibilityStyles(): any {
    const styles: any = {};

    if (this.config.highContrastMode) {
      styles.backgroundColor = '#000000';
      styles.color = '#FFFFFF';
      styles.border = '2px solid #FFFFFF';
    }

    if (this.config.largeTextMode) {
      styles.fontSize = '1.5em';
      styles.lineHeight = '1.6';
    }

    if (this.config.reducedMotion) {
      styles.transition = 'none';
      styles.animation = 'none';
    }

    if (this.config.colorBlindnessType && this.config.colorBlindnessType !== 'none') {
      styles.filter = this.getColorBlindnessFilter(this.config.colorBlindnessType);
    }

    return styles;
  }

  /**
   * Provide alternative text descriptions for visual elements
   */
  getAlternativeText(elementType: string, data: any): string {
    switch (elementType) {
      case 'avatarPreview':
        return this.describeAvatarAppearance(data);
      case 'colorSwatch':
        return this.describeColor(data.color);
      case 'slider':
        return `${data.label}: ${data.value} out of ${data.max}`;
      case 'button':
        return `${data.label} button. ${data.description || ''}`;
      default:
        return data.label || 'Interactive element';
    }
  }

  private describeFaceOption(option: any): string {
    return `Face style: ${option.name}. ${option.description || 'A friendly face option.'}`;
  }

  private describeHairOption(option: any): string {
    return `Hair style: ${option.name}. Color: ${option.color || 'default'}. Length: ${option.length || 'medium'}.`;
  }

  private describeClothingOption(option: any): string {
    return `Clothing: ${option.name}. Type: ${option.type}. Color: ${option.color || 'default'}.`;
  }

  private describeAccessoryOption(option: any): string {
    return `Accessory: ${option.name}. ${option.description || 'A fun accessory option.'}`;
  }

  private describePersonalityTrait(option: any): string {
    const level = option.value <= 3 ? 'low' : option.value <= 7 ? 'medium' : 'high';
    return `${option.trait}: ${level} level (${option.value} out of 10). ${this.getTraitExplanation(option.trait, option.value)}`;
  }

  private describeVoiceParameter(option: any): string {
    return `Voice ${option.parameter}: ${option.value}. ${this.getVoiceParameterExplanation(option.parameter, option.value)}`;
  }

  private describeAvatarAppearance(avatar: any): string {
    const parts = [];
    if (avatar.face) parts.push(`Face: ${avatar.face.name}`);
    if (avatar.hair) parts.push(`Hair: ${avatar.hair.name} in ${avatar.hair.color}`);
    if (avatar.clothing) parts.push(`Wearing: ${avatar.clothing.name}`);
    if (avatar.accessories && avatar.accessories.length > 0) {
      parts.push(`Accessories: ${avatar.accessories.map((a: any) => a.name).join(', ')}`);
    }
    
    return `Avatar appearance: ${parts.join('. ')}`;
  }

  private describeColor(color: string): string {
    // Convert hex/rgb to color names for better accessibility
    const colorNames: { [key: string]: string } = {
      '#FF0000': 'red',
      '#00FF00': 'green',
      '#0000FF': 'blue',
      '#FFFF00': 'yellow',
      '#FF00FF': 'magenta',
      '#00FFFF': 'cyan',
      '#000000': 'black',
      '#FFFFFF': 'white',
      '#808080': 'gray'
    };

    return colorNames[color.toUpperCase()] || `color ${color}`;
  }

  private getTraitExplanation(trait: string, value: number): string {
    const explanations: { [key: string]: { [key: number]: string } } = {
      friendliness: {
        1: "Very reserved and formal",
        5: "Balanced and approachable", 
        10: "Very warm and welcoming"
      },
      humor: {
        1: "Serious and straightforward",
        5: "Occasional light humor",
        10: "Playful and joke-loving"
      }
    };

    const traitExplanations = explanations[trait];
    if (!traitExplanations) return "";

    // Find closest explanation
    const closestValue = Object.keys(traitExplanations)
      .map(Number)
      .reduce((prev, curr) => 
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
      );

    return traitExplanations[closestValue];
  }

  private getVoiceParameterExplanation(parameter: string, value: number): string {
    switch (parameter) {
      case 'pitch':
        if (value < -1) return "Very low pitch";
        if (value < 0) return "Low pitch";
        if (value < 1) return "Normal pitch";
        return "High pitch";
      case 'speed':
        if (value < 0.8) return "Slow speaking speed";
        if (value < 1.2) return "Normal speaking speed";
        return "Fast speaking speed";
      case 'volume':
        if (value < 0.3) return "Quiet volume";
        if (value < 0.7) return "Normal volume";
        return "Loud volume";
      default:
        return "";
    }
  }

  private getColorBlindnessFilter(type: string): string {
    const filters = {
      protanopia: 'url(#protanopia-filter)',
      deuteranopia: 'url(#deuteranopia-filter)', 
      tritanopia: 'url(#tritanopia-filter)'
    };
    return filters[type as keyof typeof filters] || 'none';
  }

  private getNextFocusableElement(context: string): string {
    // Implementation would depend on the current UI context
    return 'next-element-id';
  }

  private getPreviousFocusableElement(context: string): string {
    // Implementation would depend on the current UI context
    return 'previous-element-id';
  }

  private activateCurrentElement(): string {
    return 'activate-current';
  }

  private goBack(): string {
    return 'go-back';
  }

  private navigateWithArrows(key: string, context: string): string {
    // Handle arrow key navigation based on context
    return `navigate-${key.toLowerCase().replace('arrow', '')}-${context}`;
  }
}

/**
 * Voice control integration for hands-free customization
 */
export class VoiceControlAccessibility extends EventEmitter {
  private isListening: boolean;
  private commands: Map<string, () => void>;

  constructor() {
    super();
    this.isListening = false;
    this.commands = new Map();
    this.setupCommands();
  }

  startListening(): void {
    this.isListening = true;
    this.emit('listeningStarted');
  }

  stopListening(): void {
    this.isListening = false;
    this.emit('listeningStopped');
  }

  processVoiceCommand(command: string): boolean {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Check for exact matches first
    if (this.commands.has(normalizedCommand)) {
      this.commands.get(normalizedCommand)!();
      return true;
    }

    // Check for partial matches
    for (const [cmd, action] of this.commands.entries()) {
      if (normalizedCommand.includes(cmd)) {
        action();
        return true;
      }
    }

    return false;
  }

  private setupCommands(): void {
    this.commands.set('change face', () => this.emit('navigateToCategory', 'face'));
    this.commands.set('change hair', () => this.emit('navigateToCategory', 'hair'));
    this.commands.set('change clothes', () => this.emit('navigateToCategory', 'clothing'));
    this.commands.set('add accessory', () => this.emit('navigateToCategory', 'accessories'));
    this.commands.set('personality', () => this.emit('navigateToCategory', 'personality'));
    this.commands.set('voice settings', () => this.emit('navigateToCategory', 'voice'));
    this.commands.set('preview', () => this.emit('startPreview'));
    this.commands.set('apply changes', () => this.emit('applyChanges'));
    this.commands.set('cancel', () => this.emit('cancelChanges'));
    this.commands.set('go back', () => this.emit('goBack'));
    this.commands.set('help', () => this.emit('showHelp'));
  }
}

/**
 * Motor accessibility support for users with limited mobility
 */
export class MotorAccessibilitySupport {
  private dwellTime: number;
  private clickAssistance: boolean;
  private largeTargets: boolean;

  constructor(config: { dwellTime?: number; clickAssistance?: boolean; largeTargets?: boolean } = {}) {
    this.dwellTime = config.dwellTime || 1000; // ms
    this.clickAssistance = config.clickAssistance || false;
    this.largeTargets = config.largeTargets || false;
  }

  /**
   * Get adjusted target sizes for motor accessibility
   */
  getTargetSize(baseSize: number): number {
    if (this.largeTargets) {
      return Math.max(baseSize * 1.5, 44); // Minimum 44px for touch targets
    }
    return Math.max(baseSize, 32); // Minimum 32px
  }

  /**
   * Handle dwell-based selection
   */
  handleDwellSelection(elementId: string, onSelect: () => void): void {
    if (!this.clickAssistance) return;

    setTimeout(() => {
      onSelect();
    }, this.dwellTime);
  }

  /**
   * Get motor-friendly interaction styles
   */
  getMotorAccessibilityStyles(): any {
    return {
      minHeight: this.getTargetSize(32),
      minWidth: this.getTargetSize(32),
      padding: this.largeTargets ? '12px' : '8px',
      margin: this.largeTargets ? '8px' : '4px',
      cursor: this.clickAssistance ? 'crosshair' : 'pointer'
    };
  }
}