/**
 * Character Package Manager Tests
 * 
 * Tests for package installation, dependency resolution, version management,
 * and sandboxed execution functionality.
 */

import { CharacterPackageManager, PackageManagerConfig, InstallationResult, UpdateResult } from './package-manager';
import { CharacterPackageCreator, CharacterPackageManifest } from './character-package';
import { mkdir, rmdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CharacterPackageManager', () => {
  let packageManager: CharacterPackageManager;
  let testConfig: PackageManagerConfig;
  let testDirectory: string;
  let packageCreator: CharacterPackageCreator;

  beforeEach(async () => {
    // Create temporary test directory
    testDirectory = join(tmpdir(), `package-manager-test-${Date.now()}`);
    await mkdir(testDirectory, { recursive: true });

    testConfig = {
      packagesDirectory: join(testDirectory, 'packages'),
      maxConcurrentInstalls: 2,
      enableSandboxing: true,
      allowUnsignedPackages: false,
      autoUpdateEnabled: true
    };

    packageManager = new CharacterPackageManager(testConfig);
    packageCreator = new CharacterPackageCreator();
  });

  afterEach(async () => {
    try {
      await rmdir(testDirectory, { recursive: true });
    } catch {
      // Directory might not exist or be in use
    }
  });

  describe('Package Installation', () => {
    it('should successfully install a valid character package', async () => {
      const manifest = createTestManifest('com.test.basic-character', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'basic-character.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      expect(result.packageId).toBe('com.test.basic-character');
      expect(result.errors).toHaveLength(0);
      expect(result.installedAssets.length).toBeGreaterThan(0);

      // Verify package is registered
      const packageInfo = packageManager.getPackageInfo('com.test.basic-character');
      expect(packageInfo).toBeTruthy();
      expect(packageInfo!.version).toBe('1.0.0');
      expect(packageInfo!.isActive).toBe(true);
    });

    it('should reject invalid packages', async () => {
      const invalidManifest = {
        package: {
          // Missing required fields
          name: 'Invalid Package'
        }
      };

      const packagePath = await createTestPackage(invalidManifest, 'invalid-package.kac');
      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Package ID is required'))).toBe(true);
    });

    it('should prevent duplicate installations of same version', async () => {
      const manifest = createTestManifest('com.test.duplicate', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'duplicate.kac');

      // Install first time
      const firstResult = await packageManager.installCharacterPackage(packagePath);
      expect(firstResult.success).toBe(true);

      // Try to install again
      const secondResult = await packageManager.installCharacterPackage(packagePath);
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors.some(e => e.includes('already installed'))).toBe(true);
    });

    it('should handle concurrent installation attempts', async () => {
      const manifest = createTestManifest('com.test.concurrent', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'concurrent.kac');

      // Start two installations simultaneously
      const [result1, result2] = await Promise.all([
        packageManager.installCharacterPackage(packagePath),
        packageManager.installCharacterPackage(packagePath)
      ]);

      // One should succeed, one should fail due to concurrent installation
      const successCount = [result1, result2].filter(r => r.success).length;
      expect(successCount).toBe(1);

      const concurrentError = [result1, result2].find(r => 
        r.errors.some(e => e.includes('already in progress'))
      );
      expect(concurrentError).toBeTruthy();
    });

    it('should validate sandboxed content after extraction', async () => {
      const manifest = createTestManifest('com.test.sandbox', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'sandbox.kac', {
        'assets/models/character.glb': Buffer.from('valid model data'),
        'assets/malicious.exe': Buffer.from('malicious executable') // Should be flagged
      });

      const result = await packageManager.installCharacterPackage(packagePath);

      // The package should be rejected due to malicious content
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.includes('malicious') || 
        e.includes('dangerous') || 
        e.includes('Potentially dangerous file') ||
        e.includes('safety')
      )).toBe(true);
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve simple dependencies', async () => {
      // Install base package first
      const baseManifest = createTestManifest('com.test.base', '1.0.0');
      const basePackagePath = await createTestPackage(baseManifest, 'base.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Install dependent package
      const dependentManifest = createTestManifest('com.test.dependent', '1.0.0', [
        { packageId: 'com.test.base', version: '>=1.0.0' }
      ]);
      const dependentPackagePath = await createTestPackage(dependentManifest, 'dependent.kac');
      
      const result = await packageManager.installCharacterPackage(dependentPackagePath);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject packages with missing dependencies', async () => {
      const dependentManifest = createTestManifest('com.test.missing-deps', '1.0.0', [
        { packageId: 'com.test.nonexistent', version: '1.0.0' }
      ]);
      const packagePath = await createTestPackage(dependentManifest, 'missing-deps.kac');
      
      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Missing dependencies'))).toBe(true);
    });

    it('should detect version conflicts', async () => {
      // Install base package with version 1.0.0
      const baseManifest = createTestManifest('com.test.version-base', '1.0.0');
      const basePackagePath = await createTestPackage(baseManifest, 'version-base.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Try to install package requiring version 2.0.0
      const conflictManifest = createTestManifest('com.test.version-conflict', '1.0.0', [
        { packageId: 'com.test.version-base', version: '2.0.0' }
      ]);
      const conflictPackagePath = await createTestPackage(conflictManifest, 'version-conflict.kac');
      
      const result = await packageManager.installCharacterPackage(conflictPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Version conflict'))).toBe(true);
    });
  });

  describe('Package Updates', () => {
    it('should successfully update to newer version', async () => {
      // Install version 1.0.0
      const v1Manifest = createTestManifest('com.test.updateable', '1.0.0');
      const v1PackagePath = await createTestPackage(v1Manifest, 'updateable-v1.kac');
      await packageManager.installCharacterPackage(v1PackagePath);

      // Update to version 1.1.0
      const v2Manifest = createTestManifest('com.test.updateable', '1.1.0');
      const v2PackagePath = await createTestPackage(v2Manifest, 'updateable-v2.kac');
      
      const result = await packageManager.updateCharacterPackage('com.test.updateable', v2PackagePath);

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
      expect(result.changes.length).toBeGreaterThan(0);

      // Verify updated package info
      const packageInfo = packageManager.getPackageInfo('com.test.updateable');
      expect(packageInfo!.version).toBe('1.1.0');
    });

    it('should reject downgrade attempts', async () => {
      // Install version 2.0.0
      const v2Manifest = createTestManifest('com.test.no-downgrade', '2.0.0');
      const v2PackagePath = await createTestPackage(v2Manifest, 'no-downgrade-v2.kac');
      await packageManager.installCharacterPackage(v2PackagePath);

      // Try to "update" to version 1.0.0
      const v1Manifest = createTestManifest('com.test.no-downgrade', '1.0.0');
      const v1PackagePath = await createTestPackage(v1Manifest, 'no-downgrade-v1.kac');
      
      await expect(
        packageManager.updateCharacterPackage('com.test.no-downgrade', v1PackagePath)
      ).rejects.toThrow('not newer than installed version');
    });

    it('should reject updates for non-existent packages', async () => {
      const manifest = createTestManifest('com.test.nonexistent', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'nonexistent.kac');
      
      await expect(
        packageManager.updateCharacterPackage('com.test.nonexistent', packagePath)
      ).rejects.toThrow('is not installed');
    });
  });

  describe('Package Uninstallation', () => {
    it('should successfully uninstall package', async () => {
      // Install package
      const manifest = createTestManifest('com.test.uninstallable', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'uninstallable.kac');
      await packageManager.installCharacterPackage(packagePath);

      // Verify it's installed
      expect(packageManager.getPackageInfo('com.test.uninstallable')).toBeTruthy();

      // Uninstall
      await packageManager.uninstallCharacterPackage('com.test.uninstallable');

      // Verify it's removed
      expect(packageManager.getPackageInfo('com.test.uninstallable')).toBeNull();
    });

    it('should prevent uninstalling packages with dependents', async () => {
      // Install base package
      const baseManifest = createTestManifest('com.test.base-required', '1.0.0');
      const basePackagePath = await createTestPackage(baseManifest, 'base-required.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Install dependent package
      const dependentManifest = createTestManifest('com.test.dependent-blocker', '1.0.0', [
        { packageId: 'com.test.base-required', version: '1.0.0' }
      ]);
      const dependentPackagePath = await createTestPackage(dependentManifest, 'dependent-blocker.kac');
      await packageManager.installCharacterPackage(dependentPackagePath);

      // Try to uninstall base package
      await expect(
        packageManager.uninstallCharacterPackage('com.test.base-required')
      ).rejects.toThrow('required by');
    });

    it('should handle uninstalling non-existent packages', async () => {
      await expect(
        packageManager.uninstallCharacterPackage('com.test.nonexistent')
      ).rejects.toThrow('is not installed');
    });
  });

  describe('Package Listing and Information', () => {
    it('should list all installed packages', async () => {
      // Install multiple packages
      const manifests = [
        createTestManifest('com.test.list1', '1.0.0'),
        createTestManifest('com.test.list2', '1.1.0'),
        createTestManifest('com.test.list3', '2.0.0')
      ];

      for (let i = 0; i < manifests.length; i++) {
        const packagePath = await createTestPackage(manifests[i], `list${i + 1}.kac`);
        await packageManager.installCharacterPackage(packagePath);
      }

      const installedPackages = packageManager.listInstalledPackages();
      expect(installedPackages).toHaveLength(3);
      
      const packageIds = installedPackages.map(p => p.packageId);
      expect(packageIds).toContain('com.test.list1');
      expect(packageIds).toContain('com.test.list2');
      expect(packageIds).toContain('com.test.list3');
    });

    it('should return detailed package information', async () => {
      const manifest = createTestManifest('com.test.detailed-info', '1.2.3');
      const packagePath = await createTestPackage(manifest, 'detailed-info.kac');
      await packageManager.installCharacterPackage(packagePath);

      const packageInfo = packageManager.getPackageInfo('com.test.detailed-info');
      
      expect(packageInfo).toBeTruthy();
      expect(packageInfo!.packageId).toBe('com.test.detailed-info');
      expect(packageInfo!.name).toBe('Test Character');
      expect(packageInfo!.version).toBe('1.2.3');
      expect(packageInfo!.author).toBe('Test Author');
      expect(packageInfo!.isActive).toBe(true);
      expect(packageInfo!.installedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent packages', () => {
      const packageInfo = packageManager.getPackageInfo('com.test.nonexistent');
      expect(packageInfo).toBeNull();
    });
  });

  describe('Event Emission', () => {
    it('should emit installation events', async () => {
      const events: any[] = [];
      
      packageManager.on('installationStarted', (data) => events.push({ type: 'started', data }));
      packageManager.on('installationCompleted', (data) => events.push({ type: 'completed', data }));
      packageManager.on('installationFailed', (data) => events.push({ type: 'failed', data }));

      const manifest = createTestManifest('com.test.events', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'events.kac');
      
      await packageManager.installCharacterPackage(packagePath);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('completed');
      expect(events[0].data.packageId).toBe('com.test.events');
      expect(events[1].data.packageId).toBe('com.test.events');
    });

    it('should emit failure events for invalid packages', async () => {
      const events: any[] = [];
      
      packageManager.on('installationFailed', (data) => events.push({ type: 'failed', data }));

      const invalidManifest = { package: { name: 'Invalid' } }; // Missing required fields
      const packagePath = await createTestPackage(invalidManifest, 'invalid-events.kac');
      
      await packageManager.installCharacterPackage(packagePath);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('failed');
    });
  });

  describe('Package Format Validation and Digital Signature Verification', () => {
    it('should validate package format structure', async () => {
      const manifest = createTestManifest('com.test.format-validation', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'format-validation.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject packages with corrupted ZIP structure', async () => {
      const corruptedPackagePath = join(testDirectory, 'corrupted.kac');
      await writeFile(corruptedPackagePath, 'This is not a valid ZIP file');

      const result = await packageManager.installCharacterPackage(corruptedPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => 
        e.includes('Package manifest not found') || 
        e.includes('validation failed') ||
        e.includes('Installation failed')
      )).toBe(true);
    });

    it('should verify digital signatures during installation', async () => {
      const manifest = createTestManifest('com.test.signature-verification', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'signature-verification.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      // Package should install successfully with valid signature
      expect(result.success).toBe(true);
      expect(result.errors.filter(e => e.includes('signature')).length).toBe(0);
    });

    it('should reject packages with invalid digital signatures', async () => {
      const manifest = createTestManifest('com.test.invalid-signature', '1.0.0');
      
      // Create package with invalid signature
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('manifest.json', JSON.stringify(manifest));
      zip.file('signature.sig', JSON.stringify({ invalid: 'signature_data' }));
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      const packagePath = join(testDirectory, 'invalid-signature.kac');
      await writeFile(packagePath, packageData);

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('validation failed') || e.includes('signature'))).toBe(true);
    });

    it('should validate package manifest integrity', async () => {
      const manifest = createTestManifest('com.test.manifest-integrity', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'manifest-integrity.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      
      // Verify package info matches manifest
      const packageInfo = packageManager.getPackageInfo('com.test.manifest-integrity');
      expect(packageInfo!.name).toBe(manifest.package.name);
      expect(packageInfo!.version).toBe(manifest.package.version);
      expect(packageInfo!.author).toBe(manifest.package.author);
    });

    it('should detect manifest tampering after extraction', async () => {
      const manifest = createTestManifest('com.test.tamper-detection', '1.0.0');
      
      // Create package with mismatched manifest hash
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      const originalManifest = JSON.stringify(manifest);
      const tamperedManifest = JSON.stringify({
        ...manifest,
        package: { ...manifest.package, name: 'Tampered Package' }
      });
      
      zip.file('manifest.json', tamperedManifest);
      
      // Create signature for original manifest but package contains tampered manifest
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(originalManifest).digest('hex');
      const signature = {
        signer: manifest.package.author,
        timestamp: new Date().toISOString(),
        hash: hash,
        algorithm: 'SHA256'
      };
      zip.file('signature.sig', JSON.stringify(signature));
      
      const packageData = await zip.generateAsync({ type: 'nodebuffer' });
      const packagePath = join(testDirectory, 'tampered.kac');
      await writeFile(packagePath, packageData);

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // The validation should fail due to hash mismatch or other validation issues
      expect(result.errors.some(e => 
        e.includes('validation failed') || 
        e.includes('integrity') || 
        e.includes('Manifest integrity check failed') ||
        e.includes('Package hash mismatch') ||
        e.includes('Invalid digital signature')
      )).toBe(true);
    });
  });

  describe('Installation Security and Sandboxing Mechanisms', () => {
    it('should create sandboxed installation directories', async () => {
      const manifest = createTestManifest('com.test.sandbox-creation', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'sandbox-creation.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      
      const packageInfo = packageManager.getPackageInfo('com.test.sandbox-creation');
      expect(packageInfo!.installPath).toContain('packages');
      expect(packageInfo!.installPath).toContain('com.test.sandbox-creation');
    });

    it('should scan for malicious files during installation', async () => {
      const manifest = createTestManifest('com.test.malware-scan', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'malware-scan.kac', {
        'assets/models/character.glb': Buffer.from('safe model data'),
        'scripts/malicious.exe': Buffer.from('potentially dangerous executable'),
        'assets/suspicious.bat': Buffer.from('batch file content')
      });

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.includes('dangerous') || 
        e.includes('malicious') || 
        e.includes('safety') ||
        e.includes('Potentially dangerous file')
      )).toBe(true);
    });

    it('should detect suspicious code patterns in package files', async () => {
      const manifest = createTestManifest('com.test.code-scan', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'code-scan.kac', {
        'scripts/setup.js': Buffer.from('eval(userInput); exec("rm -rf /"); system("dangerous command");'),
        'config/settings.json': Buffer.from('{"script": "shell_exec(\\"malicious\\")"}')
      });

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.includes('dangerous') || 
        e.includes('safety') || 
        e.includes('code pattern') ||
        e.includes('Potentially dangerous code pattern')
      )).toBe(true);
    });

    it('should isolate package installations from system files', async () => {
      const manifest = createTestManifest('com.test.isolation', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'isolation.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      
      const packageInfo = packageManager.getPackageInfo('com.test.isolation');
      // Verify installation is within designated packages directory
      expect(packageInfo!.installPath).toContain(testConfig.packagesDirectory);
      expect(packageInfo!.installPath).not.toContain('..'); // No directory traversal
    });

    it('should validate extracted content in sandbox environment', async () => {
      const manifest = createTestManifest('com.test.sandbox-validation', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'sandbox-validation.kac', {
        'assets/models/character.glb': Buffer.from('valid model data'),
        'assets/textures/diffuse.png': Buffer.from('valid texture data'),
        'configurations/default.json': Buffer.from('{"valid": "config"}')
      });

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      expect(result.installedAssets).toContain('assets/models/character.glb');
      expect(result.installedAssets).toContain('assets/textures/diffuse.png');
      expect(result.installedAssets).toContain('configurations/default.json');
    });

    it('should execute post-install scripts in secure environment', async () => {
      const manifest = createTestManifest('com.test.post-install', '1.0.0');
      manifest.installation.postInstallScript = 'scripts/setup.js';
      
      const packagePath = await createTestPackage(manifest, 'post-install.kac', {
        'scripts/setup.js': Buffer.from('console.log("Post-install setup");')
      });

      const scriptEvents: any[] = [];
      packageManager.on('postInstallScriptExecuted', (data) => scriptEvents.push(data));

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(true);
      expect(scriptEvents).toHaveLength(1);
      expect(scriptEvents[0].scriptPath).toBe('scripts/setup.js');
    });

    it('should handle missing post-install scripts gracefully', async () => {
      const manifest = createTestManifest('com.test.missing-script', '1.0.0');
      manifest.installation.postInstallScript = 'scripts/nonexistent.js';
      
      const packagePath = await createTestPackage(manifest, 'missing-script.kac');

      const result = await packageManager.installCharacterPackage(packagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Post-install script not found'))).toBe(true);
    });

    it('should prevent concurrent installations of same package', async () => {
      const manifest = createTestManifest('com.test.concurrent-security', '1.0.0');
      const packagePath = await createTestPackage(manifest, 'concurrent-security.kac');

      // Start two installations simultaneously
      const [result1, result2] = await Promise.all([
        packageManager.installCharacterPackage(packagePath),
        packageManager.installCharacterPackage(packagePath)
      ]);

      // One should succeed, one should fail due to concurrent installation
      const successCount = [result1, result2].filter(r => r.success).length;
      expect(successCount).toBe(1);

      const concurrentError = [result1, result2].find(r => 
        r.errors.some(e => e.includes('already in progress'))
      );
      expect(concurrentError).toBeTruthy();
    });
  });

  describe('Package Dependency Resolution and Compatibility Checking', () => {
    it('should resolve simple dependency chains', async () => {
      // Install base dependency first
      const baseManifest = createTestManifest('com.test.base-dependency', '1.0.0');
      const basePackagePath = await createTestPackage(baseManifest, 'base-dependency.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Install package with dependency
      const dependentManifest = createTestManifest('com.test.dependent-simple', '1.0.0', [
        { packageId: 'com.test.base-dependency', version: '>=1.0.0' }
      ]);
      const dependentPackagePath = await createTestPackage(dependentManifest, 'dependent-simple.kac');
      
      const result = await packageManager.installCharacterPackage(dependentPackagePath);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      const packageInfo = packageManager.getPackageInfo('com.test.dependent-simple');
      expect(packageInfo!.dependencies).toContain('com.test.base-dependency');
    });

    it('should resolve complex multi-level dependency chains', async () => {
      // Install level 1 dependency
      const level1Manifest = createTestManifest('com.test.level1', '1.0.0');
      const level1PackagePath = await createTestPackage(level1Manifest, 'level1.kac');
      await packageManager.installCharacterPackage(level1PackagePath);

      // Install level 2 dependency (depends on level 1)
      const level2Manifest = createTestManifest('com.test.level2', '1.0.0', [
        { packageId: 'com.test.level1', version: '1.0.0' }
      ]);
      const level2PackagePath = await createTestPackage(level2Manifest, 'level2.kac');
      await packageManager.installCharacterPackage(level2PackagePath);

      // Install level 3 package (depends on level 2, which depends on level 1)
      const level3Manifest = createTestManifest('com.test.level3', '1.0.0', [
        { packageId: 'com.test.level2', version: '1.0.0' }
      ]);
      const level3PackagePath = await createTestPackage(level3Manifest, 'level3.kac');
      
      const result = await packageManager.installCharacterPackage(level3PackagePath);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect and reject circular dependencies', async () => {
      // Create a package that depends on itself (direct circular dependency)
      const circularManifest = createTestManifest('com.test.circular-self', '1.0.0', [
        { packageId: 'com.test.circular-self', version: '1.0.0' }
      ]);
      const circularPath = await createTestPackage(circularManifest, 'circular-self.kac');
      
      const result = await packageManager.installCharacterPackage(circularPath);

      // Should fail due to circular dependency or missing dependency (since it depends on itself but isn't installed yet)
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.includes('Missing dependencies') || 
        e.includes('Circular dependency') ||
        e.includes('com.test.circular-self')
      )).toBe(true);
    });

    it('should validate semantic version compatibility', async () => {
      // Install base package version 1.2.3
      const baseManifest = createTestManifest('com.test.version-base', '1.2.3');
      const basePackagePath = await createTestPackage(baseManifest, 'version-base.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Test compatible version requirement (>=1.0.0)
      const compatibleManifest = createTestManifest('com.test.version-compatible', '1.0.0', [
        { packageId: 'com.test.version-base', version: '>=1.0.0' }
      ]);
      const compatiblePackagePath = await createTestPackage(compatibleManifest, 'version-compatible.kac');
      
      const compatibleResult = await packageManager.installCharacterPackage(compatiblePackagePath);
      expect(compatibleResult.success).toBe(true);

      // Test incompatible version requirement (2.0.0 exact)
      const incompatibleManifest = createTestManifest('com.test.version-incompatible', '1.0.0', [
        { packageId: 'com.test.version-base', version: '2.0.0' }
      ]);
      const incompatiblePackagePath = await createTestPackage(incompatibleManifest, 'version-incompatible.kac');
      
      const incompatibleResult = await packageManager.installCharacterPackage(incompatiblePackagePath);
      expect(incompatibleResult.success).toBe(false);
      expect(incompatibleResult.errors.some(e => e.includes('Version conflict'))).toBe(true);
    });

    it('should handle missing dependencies gracefully', async () => {
      const dependentManifest = createTestManifest('com.test.missing-dependency', '1.0.0', [
        { packageId: 'com.test.nonexistent-package', version: '1.0.0' },
        { packageId: 'com.test.another-missing', version: '2.0.0' }
      ]);
      const dependentPackagePath = await createTestPackage(dependentManifest, 'missing-dependency.kac');
      
      const result = await packageManager.installCharacterPackage(dependentPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Missing dependencies'))).toBe(true);
      expect(result.errors.some(e => 
        e.includes('com.test.nonexistent-package') && 
        e.includes('com.test.another-missing')
      )).toBe(true);
    });

    it('should prevent uninstalling packages with active dependents', async () => {
      // Install base package
      const baseManifest = createTestManifest('com.test.uninstall-base', '1.0.0');
      const basePackagePath = await createTestPackage(baseManifest, 'uninstall-base.kac');
      await packageManager.installCharacterPackage(basePackagePath);

      // Install dependent package
      const dependentManifest = createTestManifest('com.test.uninstall-dependent', '1.0.0', [
        { packageId: 'com.test.uninstall-base', version: '1.0.0' }
      ]);
      const dependentPackagePath = await createTestPackage(dependentManifest, 'uninstall-dependent.kac');
      await packageManager.installCharacterPackage(dependentPackagePath);

      // Try to uninstall base package (should fail due to dependent)
      await expect(
        packageManager.uninstallCharacterPackage('com.test.uninstall-base')
      ).rejects.toThrow('required by');
    });

    it('should validate dependency package IDs and versions format', async () => {
      const invalidDependencyManifest = createTestManifest('com.test.invalid-deps', '1.0.0', [
        { packageId: '', version: '1.0.0' }, // Empty package ID
        { packageId: 'valid.package', version: '' }, // Empty version
        { packageId: 'another.package', version: 'invalid-version-format' }
      ]);
      const invalidDependencyPackagePath = await createTestPackage(invalidDependencyManifest, 'invalid-deps.kac');
      
      const result = await packageManager.installCharacterPackage(invalidDependencyPackagePath);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid dependency specification'))).toBe(true);
    });

    it('should handle dependency resolution with version ranges', async () => {
      // Install multiple versions of base package (simulated by different package IDs)
      const base10Manifest = createTestManifest('com.test.version-range-base', '1.0.0');
      const base10PackagePath = await createTestPackage(base10Manifest, 'version-range-base-10.kac');
      await packageManager.installCharacterPackage(base10PackagePath);

      // Test package requiring >=1.0.0 (should work)
      const rangeManifest = createTestManifest('com.test.version-range-test', '1.0.0', [
        { packageId: 'com.test.version-range-base', version: '>=1.0.0' }
      ]);
      const rangePackagePath = await createTestPackage(rangeManifest, 'version-range-test.kac');
      
      const result = await packageManager.installCharacterPackage(rangePackagePath);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should track dependency relationships in package info', async () => {
      // Install dependencies
      const dep1Manifest = createTestManifest('com.test.dep1', '1.0.0');
      const dep1PackagePath = await createTestPackage(dep1Manifest, 'dep1.kac');
      await packageManager.installCharacterPackage(dep1PackagePath);

      const dep2Manifest = createTestManifest('com.test.dep2', '1.0.0');
      const dep2PackagePath = await createTestPackage(dep2Manifest, 'dep2.kac');
      await packageManager.installCharacterPackage(dep2PackagePath);

      // Install package with multiple dependencies
      const mainManifest = createTestManifest('com.test.multi-deps', '1.0.0', [
        { packageId: 'com.test.dep1', version: '1.0.0' },
        { packageId: 'com.test.dep2', version: '1.0.0' }
      ]);
      const mainPackagePath = await createTestPackage(mainManifest, 'multi-deps.kac');
      await packageManager.installCharacterPackage(mainPackagePath);

      const packageInfo = packageManager.getPackageInfo('com.test.multi-deps');
      expect(packageInfo!.dependencies).toContain('com.test.dep1');
      expect(packageInfo!.dependencies).toContain('com.test.dep2');
      expect(packageInfo!.dependencies).toHaveLength(2);
    });
  });

  // Helper functions
  async function createTestPackage(
    manifest: any, 
    filename: string, 
    additionalAssets?: Record<string, Buffer>
  ): Promise<string> {
    const assets = new Map<string, Buffer>();
    
    // Add basic required assets
    assets.set('assets/models/character.glb', Buffer.from('dummy model data'));
    assets.set('assets/textures/diffuse.png', Buffer.from('dummy texture data'));
    assets.set('configurations/default_appearance.json', Buffer.from('{}'));
    assets.set('thumbnails/preview.png', Buffer.from('dummy thumbnail'));

    // Add any additional assets
    if (additionalAssets) {
      for (const [path, data] of Object.entries(additionalAssets)) {
        assets.set(path, data);
      }
    }

    const packagePath = join(testDirectory, filename);
    await packageCreator.createPackage(manifest, assets, packagePath);
    
    return packagePath;
  }

  function createTestManifest(
    packageId: string, 
    version: string, 
    dependencies: Array<{ packageId: string; version: string }> = []
  ): CharacterPackageManifest {
    return {
      package: {
        id: packageId,
        name: 'Test Character',
        version: version,
        description: 'A test character package',
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
        ageRating: 'all-ages',
        contentWarnings: [],
        safetyLevel: 'verified',
        parentalApprovalRequired: false
      },
      assets: {
        totalSize: 1024000,
        modelCount: 1,
        textureCount: 1,
        animationCount: 1,
        audioCount: 1
      },
      performance: {
        recommendedGPUMemory: '512MB',
        triangleCount: 5000,
        textureResolution: '512x512',
        performanceLevel: 'medium'
      },
      dependencies: dependencies,
      installation: {
        requiresRestart: false
      }
    };
  }
});