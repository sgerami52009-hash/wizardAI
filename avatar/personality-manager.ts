// Personality Management Engine for Avatar System

import { 
  PersonalityTraits, 
  ValidationResult, 
  SafetyResult, 
  InteractionContext, 
  ResponseStyle, 
  PersonalityPreset,
  AgeRange,
  RiskLevel
} from './types';
import { PersonalityManager } from './core';
import { avatarEventBus } from './events';
// Note: validateChildSafeContent will be implemented in safety-validator.ts

export interface PersonalityValidationRules {
  minAge: number;
  maxAge: number;
  allowedTraitRanges: {
    [key in keyof PersonalityTraits]: { min: number; max: number };
  };
  restrictedCombinations: PersonalityRestriction[];
}

export interface PersonalityRestriction {
  traits: Partial<PersonalityTraits>;
  reason: string;
  ageGroups: AgeRange[];
}

export interface VoicePipelineIntegration {
  updateResponseStyle(traits: PersonalityTraits): Promise<void>;
  generatePersonalizedResponse(input: string, traits: PersonalityTraits, context: InteractionContext): Promise<string>;
  validateResponseContent(response: string, userAge: number): Promise<boolean>;
}

export class PersonalityManagerImpl implements PersonalityManager {
  private validationRules: Map<AgeRange, PersonalityValidationRules> = new Map();
  private personalityPresets: Map<AgeRange, PersonalityPreset[]> = new Map();
  private voicePipelineIntegration?: VoicePipelineIntegration;
  private activePersonalities: Map<string, PersonalityTraits> = new Map();

  constructor() {
    this.initializeValidationRules();
    this.initializePersonalityPresets();
  }

  /**
   * Updates personality traits with validation and safety checks
   */
  async updatePersonality(traits: PersonalityTraits): Promise<ValidationResult> {
    try {
      // First check if traits are severely out of range (reject completely invalid values)
      const severeValidationResult = this.validateSevereTraitRanges(traits);
      if (!severeValidationResult.isValid) {
        return severeValidationResult;
      }

      // Normalize traits to ensure consistency (for minor adjustments)
      const normalizedTraits = this.normalizePersonalityTraits(traits);

      // Validate normalized trait values are within acceptable ranges
      const validationResult = this.validateTraitRanges(normalizedTraits);
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Check for trait consistency and conflicts
      const consistencyResult = this.validateTraitConsistency(normalizedTraits);
      if (!consistencyResult.isValid) {
        return consistencyResult;
      }

      return {
        isValid: true,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: [`Failed to update personality: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validates personality traits for child-appropriateness based on user age
   */
  async validatePersonalityTraits(traits: PersonalityTraits, userAge: number): Promise<SafetyResult> {
    try {
      const ageRange = this.getAgeRange(userAge);
      const rules = this.validationRules.get(ageRange);
      
      if (!rules) {
        return {
          isAllowed: false,
          violations: ['No validation rules found for age group'],
          riskLevel: 'high' as RiskLevel,
          reason: 'Age validation failed',
          requiresParentalApproval: true,
          blockedContent: [],
          recommendations: ['Please verify user age and try again']
        };
      }

      // Check if user age is within allowed range
      if (userAge < rules.minAge || userAge > rules.maxAge) {
        return {
          isAllowed: false,
          violations: [`Age ${userAge} not within allowed range ${rules.minAge}-${rules.maxAge}`],
          riskLevel: 'high' as RiskLevel,
          reason: 'Age restriction violation',
          requiresParentalApproval: true,
          blockedContent: [],
          recommendations: ['Please verify user age and try again']
        };
      }

      // Validate individual trait values
      const violations: string[] = [];
      for (const [traitName, value] of Object.entries(traits)) {
        const allowedRange = rules.allowedTraitRanges[traitName as keyof PersonalityTraits];
        if (allowedRange && (value < allowedRange.min || value > allowedRange.max)) {
          violations.push(`${traitName} value ${value} outside allowed range ${allowedRange.min}-${allowedRange.max}`);
        }
      }

      // Check for restricted trait combinations
      for (const restriction of rules.restrictedCombinations) {
        if (this.matchesRestriction(traits, restriction)) {
          violations.push(`Restricted personality combination: ${restriction.reason}`);
        }
      }

      const riskLevel = violations.length > 0 ? 'medium' : 'low';
      const requiresApproval = violations.length > 0 && userAge < 13;

      return {
        isAllowed: violations.length === 0,
        violations,
        riskLevel: riskLevel as RiskLevel,
        reason: violations.length > 0 ? 'Personality trait violations detected' : 'Personality traits validated successfully',
        requiresParentalApproval: requiresApproval,
        blockedContent: violations,
        recommendations: violations.length > 0 ? ['Adjust personality traits to age-appropriate values'] : []
      };
    } catch (error) {
      return {
        isAllowed: false,
        violations: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        riskLevel: 'high' as RiskLevel,
        reason: 'Safety validation failed',
        requiresParentalApproval: true,
        blockedContent: [],
        recommendations: ['Please try again or contact support']
      };
    }
  }

  /**
   * Generates response style based on personality traits and interaction context
   */
  generateResponseStyle(traits: PersonalityTraits, context: InteractionContext): ResponseStyle {
    try {
      // Calculate formality based on personality and context
      const baseFormality = traits.formality / 10;
      const contextAdjustment = this.getContextFormalityAdjustment(context);
      const formality = Math.max(0, Math.min(1, baseFormality + contextAdjustment));

      // Calculate enthusiasm from personality traits
      const enthusiasm = (traits.enthusiasm + traits.friendliness) / 20;

      // Determine word choice based on formality and user context
      let wordChoice: 'simple' | 'moderate' | 'advanced' = 'moderate';
      if (formality < 0.3) {
        wordChoice = 'simple';
      } else if (formality > 0.7) {
        wordChoice = 'advanced';
      }

      // Determine response length based on patience and enthusiasm
      let responseLength: 'brief' | 'moderate' | 'detailed' = 'moderate';
      const lengthScore = (traits.patience + traits.supportiveness) / 20;
      if (lengthScore < 0.4) {
        responseLength = 'brief';
      } else if (lengthScore > 0.7) {
        responseLength = 'detailed';
      }

      return {
        formality,
        enthusiasm,
        wordChoice,
        responseLength
      };
    } catch (error) {
      // Return safe defaults on error
      return {
        formality: 0.5,
        enthusiasm: 0.6,
        wordChoice: 'simple',
        responseLength: 'moderate'
      };
    }
  }

  /**
   * Gets available personality presets for a specific age group
   */
  async getPersonalityPresets(userAge: number): Promise<PersonalityPreset[]> {
    try {
      const ageRange = this.getAgeRange(userAge);
      const presets = this.personalityPresets.get(ageRange) || [];
      
      // Filter presets to ensure they're appropriate for the specific age
      return presets.filter(preset => 
        preset.ageAppropriate.includes(ageRange) ||
        preset.ageAppropriate.includes('all')
      );
    } catch (error) {
      // Return empty array on error to fail safely
      return [];
    }
  }

  /**
   * Integrates personality traits with voice pipeline for consistent responses
   */
  async integrateWithVoicePipeline(traits: PersonalityTraits): Promise<void> {
    try {
      if (this.voicePipelineIntegration) {
        await this.voicePipelineIntegration.updateResponseStyle(traits);
        
        // Emit event for successful integration
        avatarEventBus.emitSystemRecovery('personality-manager', 'Voice pipeline integration updated');
      }
    } catch (error) {
      // Emit error event but don't throw to maintain system stability
      avatarEventBus.emitSystemError('personality-manager', {
        code: 'VOICE_INTEGRATION_FAILED',
        message: `Failed to integrate with voice pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
        component: 'personality-manager',
        severity: 'warning',
        recoverable: true,
        context: { traits }
      });
    }
  }

  /**
   * Sets the voice pipeline integration interface
   */
  setVoicePipelineIntegration(integration: VoicePipelineIntegration): void {
    this.voicePipelineIntegration = integration;
  }

  /**
   * Enforces personality consistency across interactions
   */
  enforcePersonalityConsistency(userId: string, traits: PersonalityTraits): void {
    this.activePersonalities.set(userId, traits);
    
    // Emit event for personality consistency enforcement
    avatarEventBus.emit('personality:consistency:enforced', userId, traits);
  }

  /**
   * Gets active personality for a user
   */
  getActivePersonality(userId: string): PersonalityTraits | undefined {
    return this.activePersonalities.get(userId);
  }

  // Private helper methods

  private initializeValidationRules(): void {
    // Child validation rules (5-12 years)
    this.validationRules.set(AgeRange.CHILD, {
      minAge: 5,
      maxAge: 12,
      allowedTraitRanges: {
        friendliness: { min: 6, max: 10 }, // Children should have friendly avatars
        formality: { min: 1, max: 5 },     // Keep it casual for children
        humor: { min: 5, max: 10 },        // Encourage humor
        enthusiasm: { min: 6, max: 10 },   // High enthusiasm is good for children
        patience: { min: 7, max: 10 },     // Avatar should be very patient with children
        supportiveness: { min: 8, max: 10 } // High support for learning
      },
      restrictedCombinations: [
        {
          traits: { formality: 8, humor: 2 },
          reason: 'Too formal and serious for children',
          ageGroups: [AgeRange.CHILD]
        }
      ]
    });

    // Teen validation rules (13-17 years)
    this.validationRules.set(AgeRange.TEEN, {
      minAge: 13,
      maxAge: 17,
      allowedTraitRanges: {
        friendliness: { min: 4, max: 10 },
        formality: { min: 1, max: 8 },
        humor: { min: 3, max: 10 },
        enthusiasm: { min: 4, max: 10 },
        patience: { min: 5, max: 10 },
        supportiveness: { min: 6, max: 10 }
      },
      restrictedCombinations: [
        {
          traits: { friendliness: 2, supportiveness: 3 },
          reason: 'Avatar should be supportive for teens',
          ageGroups: [AgeRange.TEEN]
        }
      ]
    });

    // Adult validation rules (18+ years)
    this.validationRules.set(AgeRange.ADULT, {
      minAge: 18,
      maxAge: 100,
      allowedTraitRanges: {
        friendliness: { min: 1, max: 10 },
        formality: { min: 1, max: 10 },
        humor: { min: 1, max: 10 },
        enthusiasm: { min: 1, max: 10 },
        patience: { min: 1, max: 10 },
        supportiveness: { min: 1, max: 10 }
      },
      restrictedCombinations: [] // Adults have full freedom
    });
  }

  private initializePersonalityPresets(): void {
    // Child presets
    this.personalityPresets.set(AgeRange.CHILD, [
      {
        id: 'friendly-helper',
        name: 'Friendly Helper',
        description: 'A cheerful and supportive assistant perfect for learning',
        traits: {
          friendliness: 9,
          formality: 2,
          humor: 8,
          enthusiasm: 9,
          patience: 10,
          supportiveness: 10
        },
        ageAppropriate: [AgeRange.CHILD]
      },
      {
        id: 'curious-explorer',
        name: 'Curious Explorer',
        description: 'An enthusiastic companion for discovery and learning',
        traits: {
          friendliness: 8,
          formality: 3,
          humor: 9,
          enthusiasm: 10,
          patience: 8,
          supportiveness: 9
        },
        ageAppropriate: [AgeRange.CHILD]
      }
    ]);

    // Teen presets
    this.personalityPresets.set(AgeRange.TEEN, [
      {
        id: 'supportive-mentor',
        name: 'Supportive Mentor',
        description: 'A balanced assistant that adapts to your needs',
        traits: {
          friendliness: 7,
          formality: 5,
          humor: 6,
          enthusiasm: 7,
          patience: 8,
          supportiveness: 9
        },
        ageAppropriate: [AgeRange.TEEN]
      },
      {
        id: 'casual-buddy',
        name: 'Casual Buddy',
        description: 'A relaxed and friendly companion',
        traits: {
          friendliness: 8,
          formality: 3,
          humor: 8,
          enthusiasm: 7,
          patience: 7,
          supportiveness: 8
        },
        ageAppropriate: [AgeRange.TEEN]
      }
    ]);

    // Adult presets
    this.personalityPresets.set(AgeRange.ADULT, [
      {
        id: 'professional-assistant',
        name: 'Professional Assistant',
        description: 'A formal and efficient helper for work and productivity',
        traits: {
          friendliness: 6,
          formality: 8,
          humor: 4,
          enthusiasm: 6,
          patience: 7,
          supportiveness: 8
        },
        ageAppropriate: [AgeRange.ADULT]
      },
      {
        id: 'balanced-companion',
        name: 'Balanced Companion',
        description: 'A well-rounded assistant for daily interactions',
        traits: {
          friendliness: 7,
          formality: 5,
          humor: 6,
          enthusiasm: 6,
          patience: 7,
          supportiveness: 7
        },
        ageAppropriate: [AgeRange.ADULT, AgeRange.TEEN]
      }
    ]);
  }

  private validateSevereTraitRanges(traits: PersonalityTraits): ValidationResult {
    const errors: string[] = [];
    
    for (const [traitName, value] of Object.entries(traits)) {
      if (typeof value !== 'number' || value < -1 || value > 12) {
        errors.push(`${traitName} must be a number between 1 and 10, got ${value}`);
      }
    }

    return {
      isValid: errors.length === 0,
      requiresParentalApproval: false,
      blockedElements: [],
      warnings: [],
      errors
    };
  }

  private validateTraitRanges(traits: PersonalityTraits): ValidationResult {
    const errors: string[] = [];
    
    for (const [traitName, value] of Object.entries(traits)) {
      if (typeof value !== 'number' || value < 1 || value > 10) {
        errors.push(`${traitName} must be a number between 1 and 10, got ${value}`);
      }
    }

    return {
      isValid: errors.length === 0,
      requiresParentalApproval: false,
      blockedElements: [],
      warnings: [],
      errors
    };
  }

  private normalizePersonalityTraits(traits: PersonalityTraits): PersonalityTraits {
    const normalized: PersonalityTraits = { ...traits };
    
    // Ensure all values are within 1-10 range
    for (const key of Object.keys(normalized) as Array<keyof PersonalityTraits>) {
      normalized[key] = Math.max(1, Math.min(10, Math.round(normalized[key])));
    }
    
    return normalized;
  }

  private validateTraitConsistency(traits: PersonalityTraits): ValidationResult {
    const warnings: string[] = [];
    
    // Check for potentially conflicting trait combinations
    if (traits.formality > 8 && traits.humor > 8) {
      warnings.push('High formality and high humor may create inconsistent personality');
    }
    
    if (traits.patience < 3 && traits.supportiveness > 8) {
      warnings.push('Low patience with high supportiveness may seem contradictory');
    }

    return {
      isValid: true,
      requiresParentalApproval: false,
      blockedElements: [],
      warnings,
      errors: []
    };
  }

  private getAgeRange(age: number): AgeRange {
    if (age >= 2 && age <= 4) return AgeRange.TODDLER;
    if (age >= 5 && age <= 12) return AgeRange.CHILD;
    if (age >= 13 && age <= 17) return AgeRange.TEEN;
    return AgeRange.ADULT;
  }

  private matchesRestriction(traits: PersonalityTraits, restriction: PersonalityRestriction): boolean {
    // Check if ALL restricted traits match the restriction criteria
    for (const [traitName, restrictedValue] of Object.entries(restriction.traits)) {
      const actualValue = traits[traitName as keyof PersonalityTraits];
      if (actualValue < restrictedValue) {
        return false; // If any trait doesn't meet the restriction, it's not a match
      }
    }
    return true; // All traits meet the restriction criteria
  }

  private getContextFormalityAdjustment(context: InteractionContext): number {
    // Adjust formality based on conversation context
    let adjustment = 0;
    
    // Check recent topics for formal/informal indicators
    const formalTopics = ['work', 'school', 'homework', 'study'];
    const informalTopics = ['play', 'game', 'fun', 'joke'];
    
    for (const topic of context.recentTopics) {
      if (formalTopics.some(formal => topic.toLowerCase().includes(formal))) {
        adjustment += 0.1;
      }
      if (informalTopics.some(informal => topic.toLowerCase().includes(informal))) {
        adjustment -= 0.1;
      }
    }
    
    return Math.max(-0.3, Math.min(0.3, adjustment));
  }
}

// Export singleton instance
export const personalityManager = new PersonalityManagerImpl();