/**
 * Age-Appropriate Interface Design Components
 * 
 * Provides interface adaptations based on user age, including simplified layouts,
 * child-friendly language, and appropriate complexity levels.
 */

import { EventEmitter } from 'events';

export interface AgeGroup {
  minAge: number;
  maxAge: number;
  name: string;
  complexity: 'simple' | 'moderate' | 'advanced';
  features: string[];
}

export interface InterfaceTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  fonts: {
    family: string;
    size: string;
    weight: string;
  };
  spacing: {
    small: string;
    medium: string;
    large: string;
  };
  borderRadius: string;
  animations: boolean;
}

export interface LanguageConfig {
  vocabulary: 'simple' | 'intermediate' | 'advanced';
  instructions: 'step-by-step' | 'brief' | 'detailed';
  encouragement: boolean;
  explanations: 'basic' | 'detailed' | 'technical';
}

/**
 * Age-appropriate interface manager
 */
export class AgeAppropriateInterface extends EventEmitter {
  private ageGroups: AgeGroup[];
  private currentAgeGroup: AgeGroup;
  private theme: InterfaceTheme;
  private language: LanguageConfig;

  constructor(userAge: number) {
    super();
    this.ageGroups = this.initializeAgeGroups();
    this.currentAgeGroup = this.determineAgeGroup(userAge);
    this.theme = this.getThemeForAgeGroup(this.currentAgeGroup);
    this.language = this.getLanguageConfigForAgeGroup(this.currentAgeGroup);
  }

  /**
   * Get interface configuration for current age group
   */
  getInterfaceConfig(): {
    ageGroup: AgeGroup;
    theme: InterfaceTheme;
    language: LanguageConfig;
    layout: any;
  } {
    return {
      ageGroup: this.currentAgeGroup,
      theme: this.theme,
      language: this.language,
      layout: this.getLayoutConfig()
    };
  }

  /**
   * Get age-appropriate text for interface elements
   */
  getText(key: string, context?: any): string {
    const texts = this.getTextLibrary();
    const ageGroupTexts = texts[this.currentAgeGroup.name] || texts.default;
    
    let text = ageGroupTexts[key] || texts.default[key] || key;
    
    // Replace placeholders if context provided
    if (context) {
      Object.keys(context).forEach(placeholder => {
        text = text.replace(`{${placeholder}}`, context[placeholder]);
      });
    }

    return text;
  }

  /**
   * Get simplified or detailed instructions based on age
   */
  getInstructions(action: string): string[] {
    const instructionSets = {
      'young-children': {
        'customize-face': [
          "Let's pick a face for your helper!",
          "Touch the face you like best",
          "See how it looks on your helper"
        ],
        'customize-voice': [
          "Now let's choose how your helper sounds!",
          "Try different voices",
          "Pick the one you like!"
        ]
      },
      'children': {
        'customize-face': [
          "Choose your avatar's face",
          "Browse through the different face options",
          "Click to preview, then apply your choice"
        ],
        'customize-voice': [
          "Customize your avatar's voice",
          "Adjust the voice settings using the sliders",
          "Click preview to hear how it sounds"
        ]
      },
      'teens': {
        'customize-face': [
          "Select facial features for your avatar",
          "Use the category tabs to browse options",
          "Preview changes in real-time before applying"
        ],
        'customize-voice': [
          "Configure voice characteristics",
          "Adjust pitch, speed, and tone parameters",
          "Use the preview function to test settings"
        ]
      }
    };

    const ageGroupInstructions = instructionSets[this.currentAgeGroup.name as keyof typeof instructionSets];
    return ageGroupInstructions?.[action] || [`Complete ${action}`];
  }

  /**
   * Get available features for current age group
   */
  getAvailableFeatures(): string[] {
    return this.currentAgeGroup.features;
  }

  /**
   * Check if a feature is appropriate for current age
   */
  isFeatureAllowed(feature: string): boolean {
    return this.currentAgeGroup.features.includes(feature);
  }

  /**
   * Get encouragement messages for different actions
   */
  getEncouragementMessage(action: 'start' | 'progress' | 'complete' | 'error'): string {
    if (!this.language.encouragement) return '';

    const messages = {
      'young-children': {
        start: "Let's make your helper look amazing!",
        progress: "You're doing great! Keep going!",
        complete: "Wow! Your helper looks fantastic!",
        error: "Oops! Let's try that again together!"
      },
      'children': {
        start: "Time to customize your avatar!",
        progress: "Nice work! You're making great choices!",
        complete: "Awesome! Your avatar is ready!",
        error: "No worries! Let's fix that together."
      },
      'teens': {
        start: "Ready to personalize your avatar?",
        progress: "Looking good! Continue customizing.",
        complete: "Perfect! Your avatar is all set.",
        error: "Something went wrong. Let's try again."
      }
    };

    const ageGroupMessages = messages[this.currentAgeGroup.name as keyof typeof messages];
    return ageGroupMessages?.[action] || '';
  }

  /**
   * Get complexity-appropriate UI elements
   */
  getUIElements(): {
    showAdvancedOptions: boolean;
    maxOptionsPerPage: number;
    showTechnicalDetails: boolean;
    useSimpleNavigation: boolean;
    showProgressIndicator: boolean;
  } {
    switch (this.currentAgeGroup.complexity) {
      case 'simple':
        return {
          showAdvancedOptions: false,
          maxOptionsPerPage: 6,
          showTechnicalDetails: false,
          useSimpleNavigation: true,
          showProgressIndicator: true
        };
      case 'moderate':
        return {
          showAdvancedOptions: false,
          maxOptionsPerPage: 12,
          showTechnicalDetails: false,
          useSimpleNavigation: false,
          showProgressIndicator: true
        };
      case 'advanced':
        return {
          showAdvancedOptions: true,
          maxOptionsPerPage: 20,
          showTechnicalDetails: true,
          useSimpleNavigation: false,
          showProgressIndicator: false
        };
    }
  }

  private initializeAgeGroups(): AgeGroup[] {
    return [
      {
        minAge: 5,
        maxAge: 7,
        name: 'young-children',
        complexity: 'simple',
        features: ['basic-appearance', 'simple-voice', 'basic-personality']
      },
      {
        minAge: 8,
        maxAge: 12,
        name: 'children',
        complexity: 'moderate',
        features: ['appearance', 'voice', 'personality', 'accessories']
      },
      {
        minAge: 13,
        maxAge: 17,
        name: 'teens',
        complexity: 'advanced',
        features: ['appearance', 'voice', 'personality', 'accessories', 'advanced-settings', 'character-packages']
      }
    ];
  }

  private determineAgeGroup(age: number): AgeGroup {
    return this.ageGroups.find(group => age >= group.minAge && age <= group.maxAge) || this.ageGroups[1];
  }

  private getThemeForAgeGroup(ageGroup: AgeGroup): InterfaceTheme {
    const themes = {
      'young-children': {
        colors: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4',
          background: '#FFF9E6',
          text: '#2C3E50',
          accent: '#FFE66D'
        },
        fonts: {
          family: 'Comic Sans MS, cursive',
          size: '18px',
          weight: 'bold'
        },
        spacing: {
          small: '12px',
          medium: '20px',
          large: '32px'
        },
        borderRadius: '16px',
        animations: true
      },
      'children': {
        colors: {
          primary: '#3498DB',
          secondary: '#E74C3C',
          background: '#ECF0F1',
          text: '#2C3E50',
          accent: '#F39C12'
        },
        fonts: {
          family: 'Arial, sans-serif',
          size: '16px',
          weight: 'normal'
        },
        spacing: {
          small: '8px',
          medium: '16px',
          large: '24px'
        },
        borderRadius: '12px',
        animations: true
      },
      'teens': {
        colors: {
          primary: '#2C3E50',
          secondary: '#34495E',
          background: '#FFFFFF',
          text: '#2C3E50',
          accent: '#9B59B6'
        },
        fonts: {
          family: 'Roboto, sans-serif',
          size: '14px',
          weight: 'normal'
        },
        spacing: {
          small: '6px',
          medium: '12px',
          large: '18px'
        },
        borderRadius: '8px',
        animations: false
      }
    };

    return themes[ageGroup.name as keyof typeof themes] || themes.children;
  }

  private getLanguageConfigForAgeGroup(ageGroup: AgeGroup): LanguageConfig {
    const configs = {
      'young-children': {
        vocabulary: 'simple' as const,
        instructions: 'step-by-step' as const,
        encouragement: true,
        explanations: 'basic' as const
      },
      'children': {
        vocabulary: 'intermediate' as const,
        instructions: 'brief' as const,
        encouragement: true,
        explanations: 'detailed' as const
      },
      'teens': {
        vocabulary: 'advanced' as const,
        instructions: 'detailed' as const,
        encouragement: false,
        explanations: 'technical' as const
      }
    };

    return configs[ageGroup.name as keyof typeof configs] || configs.children;
  }

  private getLayoutConfig(): any {
    const uiElements = this.getUIElements();
    
    return {
      gridColumns: uiElements.maxOptionsPerPage <= 6 ? 2 : uiElements.maxOptionsPerPage <= 12 ? 3 : 4,
      buttonSize: this.currentAgeGroup.complexity === 'simple' ? 'large' : 'medium',
      navigationStyle: uiElements.useSimpleNavigation ? 'tabs' : 'sidebar',
      showLabels: this.currentAgeGroup.complexity !== 'advanced',
      iconSize: this.currentAgeGroup.complexity === 'simple' ? '32px' : '24px'
    };
  }

  private getTextLibrary(): any {
    return {
      'young-children': {
        'customize-appearance': 'Make Your Helper Look Cool!',
        'customize-personality': 'Choose How Your Helper Acts!',
        'customize-voice': 'Pick Your Helper\'s Voice!',
        'preview': 'See How It Looks!',
        'apply': 'I Like This!',
        'cancel': 'Go Back',
        'face': 'Face',
        'hair': 'Hair',
        'clothes': 'Clothes',
        'accessories': 'Fun Stuff'
      },
      'children': {
        'customize-appearance': 'Customize Appearance',
        'customize-personality': 'Set Personality',
        'customize-voice': 'Voice Settings',
        'preview': 'Preview',
        'apply': 'Apply Changes',
        'cancel': 'Cancel',
        'face': 'Face',
        'hair': 'Hair Style',
        'clothes': 'Clothing',
        'accessories': 'Accessories'
      },
      'teens': {
        'customize-appearance': 'Avatar Appearance',
        'customize-personality': 'Personality Traits',
        'customize-voice': 'Voice Characteristics',
        'preview': 'Preview Changes',
        'apply': 'Apply Configuration',
        'cancel': 'Cancel Changes',
        'face': 'Facial Features',
        'hair': 'Hair & Style',
        'clothes': 'Clothing & Outfits',
        'accessories': 'Accessories & Items'
      },
      default: {
        'customize-appearance': 'Customize Appearance',
        'customize-personality': 'Set Personality',
        'customize-voice': 'Voice Settings',
        'preview': 'Preview',
        'apply': 'Apply',
        'cancel': 'Cancel'
      }
    };
  }
}

/**
 * Child-safe interaction patterns
 */
export class ChildSafeInteractions {
  private confirmationRequired: boolean;
  private parentalGuidance: boolean;

  constructor(userAge: number) {
    this.confirmationRequired = userAge < 10;
    this.parentalGuidance = userAge < 8;
  }

  /**
   * Get confirmation dialog for child users
   */
  getConfirmationDialog(action: string): {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  } | null {
    if (!this.confirmationRequired) return null;

    return {
      title: 'Are you sure?',
      message: `Do you want to ${action}?`,
      confirmText: 'Yes!',
      cancelText: 'No, go back'
    };
  }

  /**
   * Check if parental guidance should be shown
   */
  shouldShowParentalGuidance(): boolean {
    return this.parentalGuidance;
  }

  /**
   * Get parental guidance message
   */
  getParentalGuidanceMessage(action: string): string {
    if (!this.parentalGuidance) return '';

    return `Your child is trying to ${action}. You may want to help them with this step.`;
  }
}