// Avatar Data Migration System

import { AvatarConfiguration } from './types';
import { AvatarDataValidator, ValidationResult } from './validation';

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedData?: AvatarConfiguration;
  errors: string[];
  warnings: string[];
  backupCreated: boolean;
}

export interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate: (data: any) => any;
  validate?: (data: any) => boolean;
}

export interface MigrationPlan {
  steps: MigrationStep[];
  totalSteps: number;
  estimatedTime: number;
}

/**
 * Avatar Data Migration Manager
 * Handles version upgrades and data structure changes safely
 */
export class AvatarDataMigrator {
  private static readonly CURRENT_VERSION = '1.0.0';
  private static readonly migrations: MigrationStep[] = [
    // Example migration from 0.9.0 to 1.0.0
    {
      fromVersion: '0.9.0',
      toVersion: '1.0.0',
      description: 'Add emotional configuration and parental approval fields',
      migrate: (data: any) => {
        return {
          ...data,
          emotions: data.emotions || {
            defaultEmotion: 'neutral',
            expressionIntensity: 0.5,
            transitionSpeed: 0.3,
            emotionMappings: []
          },
          parentallyApproved: data.parentallyApproved ?? false,
          version: '1.0.0'
        };
      },
      validate: (data: any) => {
        return data.emotions && typeof data.parentallyApproved === 'boolean';
      }
    },
    // Future migration example: 1.0.0 to 1.1.0
    {
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Add accessibility features and enhanced safety controls',
      migrate: (data: any) => {
        return {
          ...data,
          accessibility: {
            highContrast: false,
            largeText: false,
            reducedMotion: false,
            screenReader: false
          },
          safetyLevel: data.safetyLevel || 'standard',
          version: '1.1.0'
        };
      },
      validate: (data: any) => {
        return data.accessibility && data.safetyLevel;
      }
    }
  ];

  /**
   * Determines if migration is needed for the given data
   */
  static needsMigration(data: any): boolean {
    if (!data || !data.version) {
      return true; // No version means very old data
    }
    return this.compareVersions(data.version, this.CURRENT_VERSION) < 0;
  }

  /**
   * Gets the current version that data should be migrated to
   */
  static getCurrentVersion(): string {
    return this.CURRENT_VERSION;
  }

  /**
   * Creates a migration plan for the given data
   */
  static createMigrationPlan(data: any): MigrationPlan {
    const currentVersion = data?.version || '0.9.0'; // Default to oldest version
    const steps = this.getMigrationPath(currentVersion, this.CURRENT_VERSION);
    
    return {
      steps,
      totalSteps: steps.length,
      estimatedTime: steps.length * 100 // Estimate 100ms per step
    };
  }

  /**
   * Migrates avatar data to the current version
   */
  static async migrateData(data: any, createBackup: boolean = true): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      fromVersion: data?.version || 'unknown',
      toVersion: this.CURRENT_VERSION,
      errors: [],
      warnings: [],
      backupCreated: false
    };

    try {
      // Check if migration is needed
      if (!this.needsMigration(data)) {
        result.success = true;
        result.migratedData = data as AvatarConfiguration;
        result.warnings.push('No migration needed - data is already current version');
        return result;
      }

      // Create backup if requested
      if (createBackup) {
        try {
          await this.createMigrationBackup(data);
          result.backupCreated = true;
        } catch (error) {
          result.warnings.push(`Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Get migration path
      const migrationSteps = this.getMigrationPath(result.fromVersion, this.CURRENT_VERSION);
      
      if (migrationSteps.length === 0) {
        result.errors.push(`No migration path found from ${result.fromVersion} to ${this.CURRENT_VERSION}`);
        return result;
      }

      // Apply migrations step by step
      let currentData = { ...data };
      
      for (const step of migrationSteps) {
        try {
          console.log(`Applying migration: ${step.description}`);
          
          // Apply the migration
          currentData = step.migrate(currentData);
          
          // Validate the result if validation function is provided
          if (step.validate && !step.validate(currentData)) {
            result.errors.push(`Migration validation failed for step: ${step.description}`);
            return result;
          }
          
          console.log(`Migration step completed: ${step.fromVersion} -> ${step.toVersion}`);
          
        } catch (error) {
          result.errors.push(`Migration step failed (${step.fromVersion} -> ${step.toVersion}): ${error instanceof Error ? error.message : 'Unknown error'}`);
          return result;
        }
      }

      // Final validation using the avatar validator
      const validation = AvatarDataValidator.validateAvatarConfiguration(currentData as AvatarConfiguration);
      if (!validation.isValid) {
        result.errors.push('Final validation failed after migration');
        result.errors.push(...validation.errors.map(e => e.message));
        return result;
      }

      // Add any validation warnings
      if (validation.warnings.length > 0) {
        result.warnings.push(...validation.warnings.map(w => w.message));
      }

      result.success = true;
      result.migratedData = currentData as AvatarConfiguration;
      result.toVersion = this.CURRENT_VERSION;
      
      console.log(`Migration completed successfully: ${result.fromVersion} -> ${result.toVersion}`);
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Gets the migration path between two versions
   */
  private static getMigrationPath(fromVersion: string, toVersion: string): MigrationStep[] {
    const path: MigrationStep[] = [];
    let currentVersion = fromVersion;

    // Handle unknown/missing version
    if (!currentVersion || currentVersion === 'unknown') {
      currentVersion = '0.9.0'; // Start from oldest known version
    }

    while (this.compareVersions(currentVersion, toVersion) < 0) {
      const nextStep = this.migrations.find(m => m.fromVersion === currentVersion);
      
      if (!nextStep) {
        console.warn(`No migration step found from version ${currentVersion}`);
        break;
      }
      
      path.push(nextStep);
      currentVersion = nextStep.toVersion;
    }

    return path;
  }

  /**
   * Compares two version strings
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  private static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    const maxLength = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  /**
   * Creates a backup of data before migration
   */
  private static async createMigrationBackup(data: any): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        originalData: data,
        backupCreatedAt: new Date().toISOString(),
        originalVersion: data?.version || 'unknown'
      };
      
      // In a real implementation, this would save to encrypted storage
      console.log(`Migration backup created at ${timestamp}:`, backupData);
      
      // For now, just log the backup creation
      // In the actual storage implementation (task 2.2), this would be properly persisted
      
    } catch (error) {
      throw new Error(`Failed to create migration backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that a migration can be safely performed
   */
  static validateMigrationSafety(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if data has required structure
    if (!data || typeof data !== 'object') {
      errors.push('Invalid data structure - must be an object');
    }

    // Check if user ID exists (critical for data integrity)
    if (!data.userId) {
      errors.push('Missing user ID - cannot safely migrate without user identification');
    }

    // Check for potential data corruption
    if (data.version && !this.isValidVersion(data.version)) {
      warnings.push('Invalid version format detected - migration may be risky');
    }

    // Check for very old data that might be incompatible
    if (!data.version || this.compareVersions(data.version || '0.0.0', '0.9.0') < 0) {
      warnings.push('Very old data detected - migration may require manual intervention');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.map(msg => ({ field: 'migration', message: msg, code: 'MIGRATION_ERROR', severity: 'error' as const })),
      warnings: warnings.map(msg => ({ field: 'migration', message: msg, code: 'MIGRATION_WARNING', severity: 'warning' as const }))
    };
  }

  /**
   * Checks if a version string is valid
   */
  private static isValidVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  /**
   * Gets information about available migrations
   */
  static getMigrationInfo(): { currentVersion: string; availableMigrations: string[] } {
    return {
      currentVersion: this.CURRENT_VERSION,
      availableMigrations: this.migrations.map(m => `${m.fromVersion} -> ${m.toVersion}: ${m.description}`)
    };
  }
}

/**
 * Utility function to safely migrate avatar data with error handling
 */
export async function safelyMigrateAvatarData(data: any): Promise<AvatarConfiguration> {
  // Validate migration safety first
  const safetyCheck = AvatarDataMigrator.validateMigrationSafety(data);
  if (!safetyCheck.isValid) {
    throw new Error(`Migration safety check failed: ${safetyCheck.errors.map(e => e.message).join(', ')}`);
  }

  // Perform migration
  const result = await AvatarDataMigrator.migrateData(data, true);
  
  if (!result.success) {
    throw new Error(`Migration failed: ${result.errors.join(', ')}`);
  }

  if (!result.migratedData) {
    throw new Error('Migration completed but no migrated data returned');
  }

  // Log any warnings
  if (result.warnings.length > 0) {
    console.warn('Migration completed with warnings:', result.warnings);
  }

  return result.migratedData;
}