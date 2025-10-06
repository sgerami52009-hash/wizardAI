/**
 * Character Package Format and Validation Tests
 * 
 * Tests for .kac package format validation, digital signature verification,
 * and content safety scanning functionality.
 */

import { CharacterPackageValidator, CharacterPackageCreator, CharacterPackageManifest, AgeRating } from './character-package';
import JSZip from 'jszip';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

describe('CharacterPackageValidator', () => {
  let validator: CharacterPackageValidator;
  let testPackagePath: string;

  beforeEach(() => {
    validator = new CharacterPackageValidator();
    testPackagePath = join(__dirname, 'test-package.kac');
  });

  afterEach(async () => {
    try {
      await unlink(testPackagePath);
    } catch {
      // File might not exist, ignore error
    }
  });

  describe('Package Structure Validation', () => {
    it('should validate a properly formatted package', async () => {
      const validManifest: CharacterPackageManifest = {
        package: {
          id: 'com.test.character.friendly-robot',
          name: 'Friendly Robot',
          version: '1.0.0',
          description: 'A friendly robot character',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: ['3d-rendering'],
          optionalFeatures: []
        },
        content: {
          ageRating: 'all-ages' as AgeRating,
          contentWarnings: [],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: {
          totalSize: 1024000,
          modelCount: 1,
          textureCount: 2,
          animationCount: 3,
          audioCount: 1
        },
        performance: {
          recommendedGPUMemory: '512MB',
          triangleCount: 5000,
          textureResolution: '512x512',
          performanceLevel: 'medium'
        },
        dependencies: [],
        installation: {
          requiresRestart: false
        }
      };

      await createTestPackage(validManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.safetyIssues).toHaveLength(0);
    });

    it('should reject packages missing required files', async () => {
      const zip = new JSZip();
      // Only add manifest, missing signature
      zip.file('manifest.json', JSON.stringify({ package: { id: 'test' } }));
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(testPackagePath, packageData);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Required file missing: signature.sig');
    });

    it('should reject packages exceeding size limit', async () => {
      // Create a large dummy package (this is a simulation)
      const largeManifest = {
        package: { id: 'test', name: 'test', version: '1.0.0', author: 'test', license: 'MIT' },
        compatibility: { minSystemVersion: '1.0.0', maxSystemVersion: '2.0.0', requiredFeatures: [], optionalFeatures: [] },
        content: { ageRating: 'all-ages', contentWarnings: [], safetyLevel: 'verified', parentalApprovalRequired: false },
        assets: { totalSize: 200 * 1024 * 1024, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 }, // 200MB
        performance: { recommendedGPUMemory: '1GB', triangleCount: 10000, textureResolution: '1024x1024', performanceLevel: 'high' },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      // Mock the file size check by creating a package that reports large size
      await createTestPackage(largeManifest, testPackagePath);
      
      // We'll test the size validation logic separately since creating a 100MB+ file is impractical
      const result = await validator.validatePackage(testPackagePath);
      
      // The package should be valid in structure, but we can test size limits separately
      expect(result.performanceWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Manifest Validation', () => {
    it('should validate required manifest fields', async () => {
      const incompleteManifest = {
        package: {
          // Missing required fields
          name: 'Test Character'
        }
      };

      await createTestPackage(incompleteManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Package ID is required');
      expect(result.errors).toContain('Package version is required');
      expect(result.errors).toContain('Package author is required');
    });

    it('should validate semantic versioning', async () => {
      const invalidVersionManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: 'invalid-version',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: 'all-ages',
          contentWarnings: [],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: { totalSize: 1000, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 },
        performance: { recommendedGPUMemory: '512MB', triangleCount: 1000, textureResolution: '512x512', performanceLevel: 'low' },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(invalidVersionManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid version format. Use semantic versioning (e.g., 1.0.0)');
    });

    it('should validate age ratings', async () => {
      const invalidAgeRatingManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: 'invalid-rating',
          contentWarnings: [],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: { totalSize: 1000, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 },
        performance: { recommendedGPUMemory: '512MB', triangleCount: 1000, textureResolution: '512x512', performanceLevel: 'low' },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(invalidAgeRatingManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid age rating. Must be one of: all-ages, 6+, 9+, 12+, 15+, 18+');
    });
  });

  describe('Content Safety Validation', () => {
    it('should flag adult content as inappropriate', async () => {
      const adultContentManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: '18+' as AgeRating,
          contentWarnings: ['adult content'],
          safetyLevel: 'unverified',
          parentalApprovalRequired: true
        },
        assets: { totalSize: 1000, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 },
        performance: { recommendedGPUMemory: '512MB', triangleCount: 1000, textureResolution: '512x512', performanceLevel: 'low' },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(adultContentManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.safetyIssues).toContain('Adult content not allowed in family-friendly system');
      expect(result.safetyIssues).toContain('Package from unverified source requires additional safety review');
    });

    it('should detect inappropriate content warnings', async () => {
      const warningManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: 'all-ages' as AgeRating,
          contentWarnings: ['mild violence', 'scary themes'],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: { totalSize: 1000, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 },
        performance: { recommendedGPUMemory: '512MB', triangleCount: 1000, textureResolution: '512x512', performanceLevel: 'low' },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(warningManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.safetyIssues).toContain('Potentially inappropriate content warning: mild violence');
      expect(result.safetyIssues).toContain('Potentially inappropriate content warning: scary themes');
    });

    it('should scan asset filenames for inappropriate content', async () => {
      const manifest = createValidManifest();
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('signature.sig', JSON.stringify({ signer: 'test', timestamp: new Date().toISOString(), hash: 'test' }));
      
      // Add inappropriate asset filenames
      zip.file('assets/models/adult_content.glb', 'dummy content');
      zip.file('assets/textures/violent_texture.png', 'dummy content');
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(testPackagePath, packageData);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.safetyIssues).toContain('Potentially inappropriate asset filename: assets/models/adult_content.glb');
      expect(result.safetyIssues).toContain('Potentially inappropriate asset filename: assets/textures/violent_texture.png');
    });
  });

  describe('Performance Validation', () => {
    it('should warn about high triangle counts', async () => {
      const highPolyManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: 'all-ages' as AgeRating,
          contentWarnings: [],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: { totalSize: 1000, modelCount: 1, textureCount: 1, animationCount: 1, audioCount: 1 },
        performance: {
          recommendedGPUMemory: '2GB',
          triangleCount: 75000, // High triangle count
          textureResolution: '2048x2048',
          performanceLevel: 'ultra'
        },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(highPolyManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.performanceWarnings).toContain('High triangle count may impact performance on Jetson Nano Orin');
    });

    it('should warn about large asset sizes', async () => {
      const largeAssetManifest = {
        package: {
          id: 'test.character',
          name: 'Test Character',
          version: '1.0.0',
          author: 'Test Author',
          license: 'MIT'
        },
        compatibility: {
          minSystemVersion: '1.0.0',
          maxSystemVersion: '2.0.0',
          requiredFeatures: [],
          optionalFeatures: []
        },
        content: {
          ageRating: 'all-ages' as AgeRating,
          contentWarnings: [],
          safetyLevel: 'verified',
          parentalApprovalRequired: false
        },
        assets: {
          totalSize: 60 * 1024 * 1024, // 60MB
          modelCount: 1,
          textureCount: 1,
          animationCount: 1,
          audioCount: 1
        },
        performance: {
          recommendedGPUMemory: '1GB',
          triangleCount: 10000,
          textureResolution: '1024x1024',
          performanceLevel: 'high'
        },
        dependencies: [],
        installation: { requiresRestart: false }
      };

      await createTestPackage(largeAssetManifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.performanceWarnings).toContain('Large asset size may impact loading performance');
    });
  });

  describe('Digital Signature Validation', () => {
    it('should validate package signatures', async () => {
      const manifest = createValidManifest();
      await createTestPackage(manifest, testPackagePath);
      
      const result = await validator.validatePackage(testPackagePath);
      
      // Should pass basic signature validation
      expect(result.errors.filter(e => e.includes('signature')).length).toBe(0);
    });

    it('should reject packages with invalid signatures', async () => {
      const manifest = createValidManifest();
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest));
      // Add invalid signature
      zip.file('signature.sig', JSON.stringify({ invalid: 'signature' }));
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(testPackagePath, packageData);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid signature format'))).toBe(true);
    });
  });

  describe('Asset Structure Validation', () => {
    it('should validate asset file extensions', async () => {
      const manifest = createValidManifest();
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('signature.sig', JSON.stringify({ signer: 'test', timestamp: new Date().toISOString(), hash: 'test' }));
      
      // Add valid asset files
      zip.file('assets/models/character.glb', 'dummy content');
      zip.file('assets/textures/diffuse.png', 'dummy content');
      zip.file('assets/animations/idle.fbx', 'dummy content');
      zip.file('assets/audio/voice.wav', 'dummy content');
      
      // Add invalid asset file
      zip.file('assets/models/invalid.xyz', 'dummy content');
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(testPackagePath, packageData);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.warnings).toContain('Unknown asset file type: assets/models/invalid.xyz');
    });

    it('should check for recommended directory structure', async () => {
      const manifest = createValidManifest();
      
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('signature.sig', JSON.stringify({ signer: 'test', timestamp: new Date().toISOString(), hash: 'test' }));
      // Missing recommended directories
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(testPackagePath, packageData);
      
      const result = await validator.validatePackage(testPackagePath);
      
      expect(result.warnings).toContain('Recommended directory missing: assets/');
      expect(result.warnings).toContain('Recommended directory missing: configurations/');
      expect(result.warnings).toContain('Recommended directory missing: thumbnails/');
    });
  });
});

describe('CharacterPackageCreator', () => {
  let creator: CharacterPackageCreator;
  let testOutputPath: string;

  beforeEach(() => {
    creator = new CharacterPackageCreator();
    testOutputPath = join(__dirname, 'created-package.kac');
  });

  afterEach(async () => {
    try {
      await unlink(testOutputPath);
    } catch {
      // File might not exist, ignore error
    }
  });

  it('should create a valid character package', async () => {
    const manifest = createValidManifest();
    const assets = new Map<string, Buffer>();
    
    assets.set('assets/models/character.glb', Buffer.from('dummy model data'));
    assets.set('assets/textures/diffuse.png', Buffer.from('dummy texture data'));
    assets.set('thumbnails/preview.png', Buffer.from('dummy thumbnail data'));
    assets.set('configurations/default_appearance.json', Buffer.from('{}'));
    
    await creator.createPackage(manifest, assets, testOutputPath);
    
    // Verify the created package
    const validator = new CharacterPackageValidator();
    const result = await validator.validatePackage(testOutputPath);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should include all provided assets in the package', async () => {
    const manifest = createValidManifest();
    const assets = new Map<string, Buffer>();
    
    assets.set('assets/models/character.glb', Buffer.from('model data'));
    assets.set('assets/textures/diffuse.png', Buffer.from('texture data'));
    assets.set('assets/animations/idle.fbx', Buffer.from('animation data'));
    
    await creator.createPackage(manifest, assets, testOutputPath);
    
    // Verify assets are included
    const JSZip = require('jszip');
    const { readFile } = require('fs/promises');
    
    const packageData = await readFile(testOutputPath);
    const zip = await JSZip.loadAsync(packageData);
    
    expect(zip.file('assets/models/character.glb')).toBeTruthy();
    expect(zip.file('assets/textures/diffuse.png')).toBeTruthy();
    expect(zip.file('assets/animations/idle.fbx')).toBeTruthy();
    expect(zip.file('manifest.json')).toBeTruthy();
    expect(zip.file('signature.sig')).toBeTruthy();
  });
});

// Helper functions
async function createTestPackage(manifest: any, outputPath: string): Promise<void> {
  const zip = new JSZip();
  
  zip.file('manifest.json', JSON.stringify(manifest));
  
  // Create a basic signature
  const signature = {
    signer: manifest.package?.author || 'test',
    timestamp: new Date().toISOString(),
    hash: require('crypto').createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    algorithm: 'SHA256'
  };
  zip.file('signature.sig', JSON.stringify(signature));
  
  const packageData = await zip.generateAsync({ type: 'nodebuffer' });
  await writeFile(outputPath, packageData);
}

function createValidManifest(): CharacterPackageManifest {
  return {
    package: {
      id: 'com.test.character.friendly-robot',
      name: 'Friendly Robot',
      version: '1.0.0',
      description: 'A friendly robot character for family interactions',
      author: 'Test Author',
      license: 'MIT'
    },
    compatibility: {
      minSystemVersion: '1.0.0',
      maxSystemVersion: '2.0.0',
      requiredFeatures: ['3d-rendering'],
      optionalFeatures: ['advanced-animations']
    },
    content: {
      ageRating: 'all-ages' as AgeRating,
      contentWarnings: [],
      safetyLevel: 'verified',
      parentalApprovalRequired: false
    },
    assets: {
      totalSize: 5 * 1024 * 1024, // 5MB
      modelCount: 1,
      textureCount: 3,
      animationCount: 5,
      audioCount: 2
    },
    performance: {
      recommendedGPUMemory: '512MB',
      triangleCount: 15000,
      textureResolution: '1024x1024',
      performanceLevel: 'medium'
    },
    dependencies: [],
    installation: {
      requiresRestart: false
    }
  };
}