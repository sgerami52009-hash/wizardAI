// Avatar Data Validation and Serialization

import { 
  AvatarConfiguration, 
  AppearanceConfiguration, 
  PersonalityTraits, 
  VoiceCharacteristics,
  EmotionalConfiguration,
  CustomizationChange,
  AgeRange,
  SafetyRating
} from './types';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface SerializationOptions {
  includeMetadata?: boolean;
  compress?: boolean;
  validateOnSerialize?: boolean;
}

export class AvatarDataValidator {
  
  /**
   * Validates complete avatar configuration for child safety and data integrity
   */
  static validateAvatarConfiguration(config: AvatarConfiguration, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!config.userId || typeof config.userId !== 'string') {
      errors.push({
        field: 'userId',
        message: 'User ID is required and must be a string',
        code: 'MISSING_USER_ID',
        severity: 'error'
      });
    }

    if (!config.version || typeof config.version !== 'string') {
      errors.push({
        field: 'version',
        message: 'Version is required and must be a string',
        code: 'MISSING_VERSION',
        severity: 'error'
      });
    }

    // Validate appearance configuration
    const appearanceResult = this.validateAppearanceConfiguration(config.appearance, userAge);
    errors.push(...appearanceResult.errors);
    warnings.push(...appearanceResult.warnings);

    // Validate personality traits
    const personalityResult = this.validatePersonalityTraits(config.personality, userAge);
    errors.push(...personalityResult.errors);
    warnings.push(...personalityResult.warnings);

    // Validate voice characteristics
    const voiceResult = this.validateVoiceCharacteristics(config.voice, userAge);
    errors.push(...voiceResult.errors);
    warnings.push(...voiceResult.warnings);

    // Validate emotional configuration
    const emotionResult = this.validateEmotionalConfiguration(config.emotions, userAge);
    errors.push(...emotionResult.errors);
    warnings.push(...emotionResult.warnings);

    // Validate dates
    if (!config.createdAt || !(config.createdAt instanceof Date)) {
      errors.push({
        field: 'createdAt',
        message: 'Created date is required and must be a valid Date',
        code: 'INVALID_CREATED_DATE',
        severity: 'error'
      });
    }

    if (!config.lastModified || !(config.lastModified instanceof Date)) {
      errors.push({
        field: 'lastModified',
        message: 'Last modified date is required and must be a valid Date',
        code: 'INVALID_MODIFIED_DATE',
        severity: 'error'
      });
    }

    // Validate parental approval for children
    if (userAge && userAge < 18 && !config.parentallyApproved) {
      warnings.push({
        field: 'parentallyApproved',
        message: 'Configuration requires parental approval for users under 18',
        code: 'REQUIRES_PARENTAL_APPROVAL',
        severity: 'warning'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates appearance configuration for age-appropriateness and safety
   */
  static validateAppearanceConfiguration(config: AppearanceConfiguration, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate face configuration
    if (!config.face?.meshId || !config.face?.textureId) {
      errors.push({
        field: 'appearance.face',
        message: 'Face mesh and texture IDs are required',
        code: 'MISSING_FACE_CONFIG',
        severity: 'error'
      });
    }

    // Validate hair configuration
    if (!config.hair?.styleId) {
      errors.push({
        field: 'appearance.hair',
        message: 'Hair style ID is required',
        code: 'MISSING_HAIR_CONFIG',
        severity: 'error'
      });
    }

    // Validate clothing configuration
    if (!config.clothing?.topId || !config.clothing?.bottomId) {
      errors.push({
        field: 'appearance.clothing',
        message: 'Top and bottom clothing IDs are required',
        code: 'MISSING_CLOTHING_CONFIG',
        severity: 'error'
      });
    }

    // Age-appropriate content validation
    if (userAge && userAge < 13) {
      // Additional restrictions for younger children
      if (config.accessories && config.accessories.length > 3) {
        warnings.push({
          field: 'appearance.accessories',
          message: 'Too many accessories for young children (max 3 recommended)',
          code: 'EXCESSIVE_ACCESSORIES',
          severity: 'warning'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates personality traits for child-appropriateness
   */
  static validatePersonalityTraits(traits: PersonalityTraits, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate trait ranges (1-10)
    const traitNames = ['friendliness', 'formality', 'humor', 'enthusiasm', 'patience', 'supportiveness'] as const;
    
    for (const traitName of traitNames) {
      const value = traits[traitName];
      if (typeof value !== 'number' || value < 1 || value > 10) {
        errors.push({
          field: `personality.${traitName}`,
          message: `${traitName} must be a number between 1 and 10`,
          code: 'INVALID_TRAIT_RANGE',
          severity: 'error'
        });
      }
    }

    // Child-specific validation
    if (userAge && userAge < 13) {
      // Ensure high supportiveness for young children
      if (traits.supportiveness < 7) {
        warnings.push({
          field: 'personality.supportiveness',
          message: 'High supportiveness recommended for young children',
          code: 'LOW_SUPPORTIVENESS',
          severity: 'warning'
        });
      }

      // Ensure appropriate patience levels
      if (traits.patience < 6) {
        warnings.push({
          field: 'personality.patience',
          message: 'Higher patience recommended for young children',
          code: 'LOW_PATIENCE',
          severity: 'warning'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates voice characteristics for safety and hardware constraints
   */
  static validateVoiceCharacteristics(voice: VoiceCharacteristics, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate pitch range (-2.0 to 2.0)
    if (typeof voice.pitch !== 'number' || voice.pitch < -2.0 || voice.pitch > 2.0) {
      errors.push({
        field: 'voice.pitch',
        message: 'Pitch must be a number between -2.0 and 2.0',
        code: 'INVALID_PITCH_RANGE',
        severity: 'error'
      });
    }

    // Validate speed range (0.5 to 2.0)
    if (typeof voice.speed !== 'number' || voice.speed < 0.5 || voice.speed > 2.0) {
      errors.push({
        field: 'voice.speed',
        message: 'Speed must be a number between 0.5 and 2.0',
        code: 'INVALID_SPEED_RANGE',
        severity: 'error'
      });
    }

    // Validate volume range (0.0 to 1.0)
    if (typeof voice.volume !== 'number' || voice.volume < 0.0 || voice.volume > 1.0) {
      errors.push({
        field: 'voice.volume',
        message: 'Volume must be a number between 0.0 and 1.0',
        code: 'INVALID_VOLUME_RANGE',
        severity: 'error'
      });
    }

    // Child-specific validation
    if (userAge && userAge < 13) {
      // Recommend moderate speed for children
      if (voice.speed > 1.5) {
        warnings.push({
          field: 'voice.speed',
          message: 'Slower speech speed recommended for young children',
          code: 'HIGH_SPEED_FOR_CHILD',
          severity: 'warning'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates emotional configuration
   */
  static validateEmotionalConfiguration(emotions: EmotionalConfiguration, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate expression intensity (0.0 to 1.0)
    if (typeof emotions.expressionIntensity !== 'number' || 
        emotions.expressionIntensity < 0.0 || emotions.expressionIntensity > 1.0) {
      errors.push({
        field: 'emotions.expressionIntensity',
        message: 'Expression intensity must be between 0.0 and 1.0',
        code: 'INVALID_INTENSITY_RANGE',
        severity: 'error'
      });
    }

    // Validate transition speed (0.0 to 1.0)
    if (typeof emotions.transitionSpeed !== 'number' || 
        emotions.transitionSpeed < 0.0 || emotions.transitionSpeed > 1.0) {
      errors.push({
        field: 'emotions.transitionSpeed',
        message: 'Transition speed must be between 0.0 and 1.0',
        code: 'INVALID_TRANSITION_SPEED',
        severity: 'error'
      });
    }

    // Validate emotion mappings
    if (!emotions.emotionMappings || !Array.isArray(emotions.emotionMappings)) {
      errors.push({
        field: 'emotions.emotionMappings',
        message: 'Emotion mappings must be an array',
        code: 'INVALID_EMOTION_MAPPINGS',
        severity: 'error'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates customization changes for safety and appropriateness
   */
  static validateCustomizationChange(change: CustomizationChange, userAge?: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!change.changeId || !change.type || !change.category) {
      errors.push({
        field: 'change',
        message: 'Change ID, type, and category are required',
        code: 'MISSING_CHANGE_FIELDS',
        severity: 'error'
      });
    }

    // Validate timestamp
    if (!change.timestamp || !(change.timestamp instanceof Date)) {
      errors.push({
        field: 'change.timestamp',
        message: 'Valid timestamp is required',
        code: 'INVALID_TIMESTAMP',
        severity: 'error'
      });
    }

    // Check if change requires approval for children
    if (userAge && userAge < 18 && !change.requiresApproval) {
      warnings.push({
        field: 'change.requiresApproval',
        message: 'Changes for minors typically require parental approval',
        code: 'SHOULD_REQUIRE_APPROVAL',
        severity: 'warning'
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}

export class AvatarDataSerializer {
  
  /**
   * Serializes avatar configuration to JSON with optional validation
   */
  static serialize(config: AvatarConfiguration, options: SerializationOptions = {}): string {
    try {
      // Validate before serialization if requested
      if (options.validateOnSerialize) {
        const validation = AvatarDataValidator.validateAvatarConfiguration(config);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // Create serializable object (convert Dates to ISO strings)
      const serializable = {
        ...config,
        createdAt: config.createdAt.toISOString(),
        lastModified: config.lastModified.toISOString(),
        // Add metadata if requested
        ...(options.includeMetadata && {
          _metadata: {
            serializedAt: new Date().toISOString(),
            version: '1.0.0',
            serializer: 'AvatarDataSerializer'
          }
        })
      };

      return JSON.stringify(serializable, null, options.compress ? 0 : 2);
    } catch (error) {
      throw new Error(`Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserializes avatar configuration from JSON with validation
   */
  static deserialize(jsonData: string, options: SerializationOptions = {}): AvatarConfiguration {
    try {
      const parsed = JSON.parse(jsonData);
      
      // Convert ISO strings back to Dates
      const config: AvatarConfiguration = {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        lastModified: new Date(parsed.lastModified)
      };

      // Validate after deserialization if requested
      if (options.validateOnSerialize) {
        const validation = AvatarDataValidator.validateAvatarConfiguration(config);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      return config;
    } catch (error) {
      throw new Error(`Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a deep clone of avatar configuration
   */
  static clone(config: AvatarConfiguration): AvatarConfiguration {
    return this.deserialize(this.serialize(config));
  }
}

/**
 * Validates child-safe content across all avatar customization types
 * Implements allowlist-only approach as per safety requirements
 */
export function validateChildSafeContent(config: AvatarConfiguration, userAge: number): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Age-based validation rules
  if (userAge < 5) {
    // Toddler restrictions - very limited customization
    errors.push({
      field: 'age',
      message: 'Avatar customization not recommended for children under 5',
      code: 'AGE_TOO_YOUNG',
      severity: 'error'
    });
  } else if (userAge < 13) {
    // Child restrictions - moderate customization with safety focus
    const validation = AvatarDataValidator.validateAvatarConfiguration(config, userAge);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    // Additional child-specific checks
    if (config.personality.humor > 8) {
      warnings.push({
        field: 'personality.humor',
        message: 'Very high humor levels may not be appropriate for young children',
        code: 'HIGH_HUMOR_CHILD',
        severity: 'warning'
      });
    }
  } else if (userAge < 18) {
    // Teen restrictions - more freedom but still monitored
    const validation = AvatarDataValidator.validateAvatarConfiguration(config, userAge);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
  }

  return { isValid: errors.length === 0, errors, warnings };
}