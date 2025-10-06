/**
 * Character Package Format and Validation System
 * 
 * Implements the .kac (Kiro Avatar Character) package format specification
 * with digital signature verification and content safety scanning.
 */

import { createHash, createVerify } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import JSZip from 'jszip';

// Package format interfaces
export interface CharacterPackageManifest {
  package: {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    website?: string;
    license: string;
  };
  compatibility: {
    minSystemVersion: string;
    maxSystemVersion: string;
    requiredFeatures: string[];
    optionalFeatures: string[];
  };
  content: {
    ageRating: AgeRating;
    contentWarnings: string[];
    safetyLevel: SafetyLevel;
    parentalApprovalRequired: boolean;
  };
  assets: {
    totalSize: number;
    modelCount: number;
    textureCount: number;
    animationCount: number;
    audioCount: number;
  };
  performance: {
    recommendedGPUMemory: string;
    triangleCount: number;
    textureResolution: string;
    performanceLevel: PerformanceLevel;
  };
  dependencies: PackageDependency[];
  installation: {
    requiresRestart: boolean;
    postInstallScript?: string;
    uninstallScript?: string;
  };
}

export interface PackageDependency {
  packageId: string;
  version: string;
}

export interface CharacterPackage {
  packageId: string;
  version: string;
  metadata: CharacterMetadata;
  assets: CharacterAssets;
  configuration: CharacterConfiguration;
  signature: string;
}

export interface CharacterMetadata {
  name: string;
  description: string;
  author: string;
  version: string;
  ageRating: AgeRating;
  tags: string[];
  thumbnail: string;
  createdAt: Date;
  fileSize: number;
  checksum: string;
}

export interface CharacterAssets {
  models: ModelAsset[];
  textures: TextureAsset[];
  animations: AnimationAsset[];
  audio: AudioAsset[];
  metadata: AssetManifest;
}

export interface ModelAsset {
  id: string;
  name: string;
  path: string;
  category: 'face' | 'hair' | 'clothing' | 'accessory';
  triangleCount: number;
  fileSize: number;
}

export interface TextureAsset {
  id: string;
  name: string;
  path: string;
  type: 'diffuse' | 'normal' | 'specular' | 'emission';
  resolution: string;
  fileSize: number;
}

export interface AnimationAsset {
  id: string;
  name: string;
  path: string;
  type: 'idle' | 'expression' | 'gesture' | 'transition';
  duration: number;
  fileSize: number;
}

export interface AudioAsset {
  id: string;
  name: string;
  path: string;
  type: 'voice_sample' | 'sound_effect';
  duration: number;
  fileSize: number;
}

export interface AssetManifest {
  version: string;
  totalAssets: number;
  totalSize: number;
  checksums: Record<string, string>;
}

export interface CharacterConfiguration {
  defaultAppearance: any; // Will be typed based on appearance system
  personalityPresets: any[]; // Will be typed based on personality system
  voicePresets: any[]; // Will be typed based on voice system
  emotionMappings: any[]; // Will be typed based on emotion system
  compatibilityVersion: string;
}

export type AgeRating = 'all-ages' | '6+' | '9+' | '12+' | '15+' | '18+';
export type SafetyLevel = 'verified' | 'community' | 'unverified';
export type PerformanceLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface PackageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  safetyIssues: string[];
  performanceWarnings: string[];
}

export interface SignatureValidationResult {
  isValid: boolean;
  signer: string;
  timestamp: Date;
  error?: string;
}

/**
 * Character Package Format Validator
 * 
 * Validates .kac package format, manifest structure, and content safety
 */
export class CharacterPackageValidator {
  private readonly SUPPORTED_MANIFEST_VERSION = '1.0.0';
  private readonly MAX_PACKAGE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly REQUIRED_FILES = ['manifest.json', 'signature.sig'];
  
  /**
   * Validates a character package file
   */
  async validatePackage(packagePath: string): Promise<PackageValidationResult> {
    const result: PackageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: [],
      performanceWarnings: []
    };

    try {
      // Check file size
      const stats = await import('fs').then(fs => fs.promises.stat(packagePath));
      if (stats.size > this.MAX_PACKAGE_SIZE) {
        result.errors.push(`Package size ${stats.size} exceeds maximum allowed size ${this.MAX_PACKAGE_SIZE}`);
        result.isValid = false;
      }

      // Load and validate ZIP structure
      const packageData = await readFile(packagePath);
      const zip = await JSZip.loadAsync(packageData);
      
      // Validate required files exist
      for (const requiredFile of this.REQUIRED_FILES) {
        if (!zip.file(requiredFile)) {
          result.errors.push(`Required file missing: ${requiredFile}`);
          result.isValid = false;
        }
      }

      if (!result.isValid) {
        return result;
      }

      // Validate manifest
      const manifestFile = zip.file('manifest.json');
      if (manifestFile) {
        const manifestContent = await manifestFile.async('text');
        const manifestValidation = await this.validateManifest(manifestContent);
        
        result.errors.push(...manifestValidation.errors);
        result.warnings.push(...manifestValidation.warnings);
        result.safetyIssues.push(...manifestValidation.safetyIssues);
        result.performanceWarnings.push(...manifestValidation.performanceWarnings);
        
        if (!manifestValidation.isValid) {
          result.isValid = false;
        }
      }

      // Validate digital signature
      const signatureValidation = await this.validateSignature(zip);
      if (!signatureValidation.isValid) {
        result.errors.push(`Invalid digital signature: ${signatureValidation.error}`);
        result.isValid = false;
      }

      // Validate asset structure
      const assetValidation = await this.validateAssetStructure(zip);
      result.errors.push(...assetValidation.errors);
      result.warnings.push(...assetValidation.warnings);
      
      if (!assetValidation.isValid) {
        result.isValid = false;
      }

      // Content safety scanning
      const safetyValidation = await this.validateContentSafety(zip);
      result.safetyIssues.push(...safetyValidation.safetyIssues);
      
      if (safetyValidation.safetyIssues.length > 0) {
        result.isValid = false;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Package validation failed: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validates package manifest structure and content
   */
  private async validateManifest(manifestContent: string): Promise<PackageValidationResult> {
    const result: PackageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: [],
      performanceWarnings: []
    };

    try {
      const manifest: CharacterPackageManifest = JSON.parse(manifestContent);

      // Validate required fields
      if (!manifest.package?.id) {
        result.errors.push('Package ID is required');
        result.isValid = false;
      }

      if (!manifest.package?.name) {
        result.errors.push('Package name is required');
        result.isValid = false;
      }

      if (!manifest.package?.version) {
        result.errors.push('Package version is required');
        result.isValid = false;
      }

      if (!manifest.package?.author) {
        result.errors.push('Package author is required');
        result.isValid = false;
      }

      // Validate version format (semantic versioning)
      if (manifest.package?.version && !this.isValidVersion(manifest.package.version)) {
        result.errors.push('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
        result.isValid = false;
      }

      // Validate compatibility
      if (!manifest.compatibility?.minSystemVersion) {
        result.errors.push('Minimum system version is required');
        result.isValid = false;
      }

      // Validate content rating
      if (!manifest.content?.ageRating) {
        result.errors.push('Age rating is required');
        result.isValid = false;
      }

      const validAgeRatings: AgeRating[] = ['all-ages', '6+', '9+', '12+', '15+', '18+'];
      if (manifest.content?.ageRating && !validAgeRatings.includes(manifest.content.ageRating)) {
        result.errors.push(`Invalid age rating. Must be one of: ${validAgeRatings.join(', ')}`);
        result.isValid = false;
      }

      // Safety validation
      if (manifest.content?.ageRating === '18+') {
        result.safetyIssues.push('Adult content not allowed in family-friendly system');
      }

      if (manifest.content?.contentWarnings?.length > 0) {
        result.warnings.push(`Content warnings present: ${manifest.content.contentWarnings.join(', ')}`);
      }

      // Performance validation
      if (manifest.performance?.triangleCount > 50000) {
        result.performanceWarnings.push('High triangle count may impact performance on Jetson Nano Orin');
      }

      if (manifest.assets?.totalSize > 50 * 1024 * 1024) { // 50MB
        result.performanceWarnings.push('Large asset size may impact loading performance');
      }

      // Validate dependencies
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          if (!dep.packageId || !dep.version) {
            result.errors.push('Invalid dependency specification');
            result.isValid = false;
          }
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Invalid manifest JSON: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validates digital signature for package integrity
   */
  private async validateSignature(zip: JSZip): Promise<SignatureValidationResult> {
    try {
      const signatureFile = zip.file('signature.sig');
      if (!signatureFile) {
        return {
          isValid: false,
          signer: '',
          timestamp: new Date(),
          error: 'Signature file not found'
        };
      }

      const signatureData = await signatureFile.async('text');
      
      // For now, implement basic signature validation
      // In production, this would use proper PKI with trusted certificate authorities
      const signature = JSON.parse(signatureData);
      
      if (!signature.signer || !signature.timestamp || !signature.hash) {
        return {
          isValid: false,
          signer: '',
          timestamp: new Date(),
          error: 'Invalid signature format'
        };
      }

      // Validate package hash
      const manifestFile = zip.file('manifest.json');
      if (manifestFile) {
        const manifestContent = await manifestFile.async('text');
        const calculatedHash = createHash('sha256').update(manifestContent).digest('hex');
        
        if (calculatedHash !== signature.hash) {
          return {
            isValid: false,
            signer: signature.signer,
            timestamp: new Date(signature.timestamp),
            error: 'Package hash mismatch'
          };
        }
      }

      return {
        isValid: true,
        signer: signature.signer,
        timestamp: new Date(signature.timestamp)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        signer: '',
        timestamp: new Date(),
        error: `Signature validation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Validates asset structure and file integrity
   */
  private async validateAssetStructure(zip: JSZip): Promise<PackageValidationResult> {
    const result: PackageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: [],
      performanceWarnings: []
    };

    const requiredDirectories = ['assets/', 'configurations/', 'thumbnails/'];
    
    for (const dir of requiredDirectories) {
      const files = Object.keys(zip.files).filter(name => name.startsWith(dir));
      if (files.length === 0) {
        result.warnings.push(`Recommended directory missing: ${dir}`);
      }
    }

    // Validate asset file types
    const allowedExtensions = {
      models: ['.glb', '.gltf', '.fbx', '.obj'],
      textures: ['.png', '.jpg', '.jpeg', '.webp'],
      animations: ['.fbx', '.gltf', '.bvh'],
      audio: ['.wav', '.mp3', '.ogg']
    };

    Object.keys(zip.files).forEach(filename => {
      if (filename.startsWith('assets/')) {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        const isValidExtension = Object.values(allowedExtensions).some(exts => exts.includes(extension));
        
        if (!isValidExtension && !filename.endsWith('/')) {
          result.warnings.push(`Unknown asset file type: ${filename}`);
        }
      }
    });

    return result;
  }

  /**
   * Validates content safety for child-appropriate usage
   */
  private async validateContentSafety(zip: JSZip): Promise<{ safetyIssues: string[] }> {
    const safetyIssues: string[] = [];

    // Get manifest for content analysis
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        const manifestContent = await manifestFile.async('text');
        const manifest: CharacterPackageManifest = JSON.parse(manifestContent);

        // Check age rating compliance
        if (manifest.content.ageRating !== 'all-ages' && manifest.content.ageRating !== '6+') {
          safetyIssues.push(`Age rating ${manifest.content.ageRating} may not be appropriate for all family members`);
        }

        // Check for content warnings
        const dangerousWarnings = ['violence', 'scary', 'adult', 'inappropriate'];
        manifest.content.contentWarnings?.forEach(warning => {
          if (dangerousWarnings.some(dangerous => warning.toLowerCase().includes(dangerous))) {
            safetyIssues.push(`Potentially inappropriate content warning: ${warning}`);
          }
        });

        // Validate safety level
        if (manifest.content.safetyLevel === 'unverified') {
          safetyIssues.push('Package from unverified source requires additional safety review');
        }

      } catch (error) {
        safetyIssues.push('Unable to validate content safety due to manifest parsing error');
      }
    }

    // Scan asset filenames for inappropriate content
    Object.keys(zip.files).forEach(filename => {
      const inappropriateKeywords = ['adult', 'violent', 'scary', 'inappropriate', 'nsfw'];
      const lowerFilename = filename.toLowerCase();
      
      inappropriateKeywords.forEach(keyword => {
        if (lowerFilename.includes(keyword)) {
          safetyIssues.push(`Potentially inappropriate asset filename: ${filename}`);
        }
      });
    });

    return { safetyIssues };
  }

  /**
   * Validates semantic version format
   */
  private isValidVersion(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  }
}

/**
 * Character Package Creator
 * 
 * Creates .kac packages from character data and assets
 */
export class CharacterPackageCreator {
  /**
   * Creates a character package from provided data
   */
  async createPackage(
    manifest: CharacterPackageManifest,
    assets: Map<string, Buffer>,
    outputPath: string,
    privateKey?: string
  ): Promise<void> {
    const zip = new JSZip();

    // Add manifest
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add assets
    assets.forEach((data, path) => {
      zip.file(path, data);
    });

    // Create and add signature
    const signature = await this.createSignature(manifest, privateKey);
    zip.file('signature.sig', JSON.stringify(signature, null, 2));

    // Generate package
    const packageData = await zip.generateAsync({ type: 'nodebuffer' });
    await writeFile(outputPath, packageData);
  }

  /**
   * Creates digital signature for package integrity
   */
  private async createSignature(manifest: CharacterPackageManifest, privateKey?: string): Promise<any> {
    // Use the same JSON formatting as the validator expects
    const manifestString = JSON.stringify(manifest, null, 2);
    const hash = createHash('sha256').update(manifestString).digest('hex');

    // Basic signature implementation
    // In production, this would use proper digital signatures with PKI
    return {
      signer: manifest.package.author,
      timestamp: new Date().toISOString(),
      hash: hash,
      algorithm: 'SHA256'
    };
  }
}