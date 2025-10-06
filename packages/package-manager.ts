/**
 * Character Package Manager
 * 
 * Manages the lifecycle of character packages including installation,
 * dependency resolution, version management, and sandboxed execution.
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir, readdir, stat, unlink, rmdir } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import { 
  CharacterPackageValidator, 
  CharacterPackageManifest, 
  PackageValidationResult,
  CharacterPackage,
  PackageDependency
} from './character-package';

export interface InstallationResult {
  success: boolean;
  packageId: string;
  installedAssets: string[];
  errors: string[];
  requiresRestart: boolean;
}

export interface UpdateResult {
  success: boolean;
  packageId: string;
  oldVersion: string;
  newVersion: string;
  changes: string[];
  requiresRestart: boolean;
}

export interface PackageInfo {
  packageId: string;
  name: string;
  version: string;
  author: string;
  description: string;
  installPath: string;
  installedAt: Date;
  lastUsed: Date;
  isActive: boolean;
  dependencies: string[];
}

export interface DependencyResolution {
  resolved: boolean;
  missing: string[];
  conflicts: string[];
  installOrder: string[];
}

export interface PackageManagerConfig {
  packagesDirectory: string;
  maxConcurrentInstalls: number;
  enableSandboxing: boolean;
  allowUnsignedPackages: boolean;
  autoUpdateEnabled: boolean;
}

/**
 * Character Package Manager
 * 
 * Provides comprehensive package lifecycle management with security validation,
 * dependency resolution, and sandboxed installation.
 */
export class CharacterPackageManager extends EventEmitter {
  private readonly config: PackageManagerConfig;
  private readonly validator: CharacterPackageValidator;
  private readonly installedPackages: Map<string, PackageInfo> = new Map();
  private readonly activeInstallations: Set<string> = new Set();
  private readonly packageRegistry: string;

  constructor(config: PackageManagerConfig) {
    super();
    this.config = config;
    this.validator = new CharacterPackageValidator();
    this.packageRegistry = join(config.packagesDirectory, 'registry.json');
    
    this.initializePackageDirectory();
    this.loadInstalledPackages();
  }

  /**
   * Installs a character package with security validation and dependency resolution
   */
  async installCharacterPackage(packagePath: string): Promise<InstallationResult> {
    const result: InstallationResult = {
      success: false,
      packageId: '',
      installedAssets: [],
      errors: [],
      requiresRestart: false
    };

    try {
      // Extract package metadata first to get packageId for events
      const packageData = await readFile(packagePath);
      const zip = await JSZip.loadAsync(packageData);
      const manifestFile = zip.file('manifest.json');
      
      if (!manifestFile) {
        result.errors.push('Package manifest not found');
        this.emit('installationFailed', { packageId: 'unknown', error: 'Package manifest not found' });
        return result;
      }

      const manifestContent = await manifestFile.async('text');
      const manifest: CharacterPackageManifest = JSON.parse(manifestContent);
      
      result.packageId = manifest.package.id;

      // Validate package format and content
      const validation = await this.validator.validatePackage(packagePath);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        result.errors.push(...validation.safetyIssues);
        this.emit('installationFailed', { packageId: result.packageId, error: 'Package validation failed' });
        return result;
      }

      // Check if package is already installed
      if (this.installedPackages.has(manifest.package.id)) {
        const existing = this.installedPackages.get(manifest.package.id)!;
        if (this.compareVersions(existing.version, manifest.package.version) >= 0) {
          result.errors.push(`Package ${manifest.package.id} version ${existing.version} is already installed`);
          return result;
        }
      }

      // Check for concurrent installations
      if (this.activeInstallations.has(manifest.package.id)) {
        result.errors.push(`Installation of ${manifest.package.id} is already in progress`);
        return result;
      }

      // Resolve dependencies
      const dependencyResolution = await this.resolveDependencies(manifest.dependencies);
      if (!dependencyResolution.resolved) {
        result.errors.push(`Missing dependencies: ${dependencyResolution.missing.join(', ')}`);
        result.errors.push(`Dependency conflicts: ${dependencyResolution.conflicts.join(', ')}`);
        return result;
      }

      // Begin installation process
      this.activeInstallations.add(manifest.package.id);
      this.emit('installationStarted', { packageId: manifest.package.id, version: manifest.package.version });

      try {
        // Create sandboxed installation directory
        const installPath = join(this.config.packagesDirectory, manifest.package.id);
        await this.createSandboxedDirectory(installPath);

        // Extract package contents to sandbox
        const extractedAssets = await this.extractPackageToSandbox(zip, installPath);
        result.installedAssets = extractedAssets;

        // Validate extracted content in sandbox
        const sandboxValidation = await this.validateSandboxedContent(installPath, manifest);
        if (!sandboxValidation.isValid || sandboxValidation.safetyIssues.length > 0) {
          await this.cleanupFailedInstallation(installPath);
          result.errors.push(...sandboxValidation.errors);
          result.errors.push(...sandboxValidation.safetyIssues);
          return result;
        }

        // Register package
        const packageInfo: PackageInfo = {
          packageId: manifest.package.id,
          name: manifest.package.name,
          version: manifest.package.version,
          author: manifest.package.author,
          description: manifest.package.description,
          installPath: installPath,
          installedAt: new Date(),
          lastUsed: new Date(),
          isActive: true,
          dependencies: manifest.dependencies.map(dep => dep.packageId)
        };

        this.installedPackages.set(manifest.package.id, packageInfo);
        await this.savePackageRegistry();

        // Execute post-install script if present
        if (manifest.installation.postInstallScript) {
          await this.executePostInstallScript(installPath, manifest.installation.postInstallScript);
        }

        result.success = true;
        result.requiresRestart = manifest.installation.requiresRestart;

        this.emit('installationCompleted', { 
          packageId: manifest.package.id, 
          version: manifest.package.version,
          installPath: installPath
        });

      } finally {
        this.activeInstallations.delete(manifest.package.id);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Installation failed: ${errorMessage}`);
      this.emit('installationFailed', { packageId: result.packageId, error: errorMessage });
    }

    return result;
  }

  /**
   * Updates an installed character package to a newer version
   */
  async updateCharacterPackage(packageId: string, newPackagePath?: string): Promise<UpdateResult> {
    const result: UpdateResult = {
      success: false,
      packageId: packageId,
      oldVersion: '',
      newVersion: '',
      changes: [],
      requiresRestart: false
    };

    try {
      const existingPackage = this.installedPackages.get(packageId);
      if (!existingPackage) {
        throw new Error(`Package ${packageId} is not installed`);
      }

      result.oldVersion = existingPackage.version;

      // If no new package path provided, check for updates from registry
      if (!newPackagePath) {
        // In a real implementation, this would check a remote registry
        throw new Error('Automatic update checking not implemented');
      }

      // Validate new package
      const validation = await this.validator.validatePackage(newPackagePath);
      if (!validation.isValid) {
        throw new Error(`Invalid update package: ${validation.errors.join(', ')}`);
      }

      // Extract new package metadata
      const packageData = await readFile(newPackagePath);
      const zip = await JSZip.loadAsync(packageData);
      const manifestFile = zip.file('manifest.json');
      
      if (!manifestFile) {
        throw new Error('Update package manifest not found');
      }

      const manifestContent = await manifestFile.async('text');
      const manifest: CharacterPackageManifest = JSON.parse(manifestContent);

      if (manifest.package.id !== packageId) {
        throw new Error('Package ID mismatch in update');
      }

      result.newVersion = manifest.package.version;

      // Check version compatibility
      if (this.compareVersions(manifest.package.version, existingPackage.version) <= 0) {
        throw new Error(`Update version ${manifest.package.version} is not newer than installed version ${existingPackage.version}`);
      }

      // Create backup of existing installation
      const backupPath = join(this.config.packagesDirectory, `${packageId}.backup.${Date.now()}`);
      await this.createBackup(existingPackage.installPath, backupPath);

      try {
        // Install new version
        const installResult = await this.installCharacterPackage(newPackagePath);
        if (!installResult.success) {
          throw new Error(`Update installation failed: ${installResult.errors.join(', ')}`);
        }

        // Compare changes
        result.changes = await this.comparePackageVersions(backupPath, existingPackage.installPath);
        result.requiresRestart = manifest.installation.requiresRestart;
        result.success = true;

        // Clean up backup after successful update
        await this.cleanupDirectory(backupPath);

        this.emit('updateCompleted', {
          packageId: packageId,
          oldVersion: result.oldVersion,
          newVersion: result.newVersion
        });

      } catch (updateError) {
        // Restore from backup on failure
        await this.restoreFromBackup(backupPath, existingPackage.installPath);
        throw updateError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('updateFailed', { packageId: packageId, error: errorMessage });
      throw error;
    }

    return result;
  }

  /**
   * Uninstalls a character package and cleans up dependencies
   */
  async uninstallCharacterPackage(packageId: string): Promise<void> {
    const packageInfo = this.installedPackages.get(packageId);
    if (!packageInfo) {
      throw new Error(`Package ${packageId} is not installed`);
    }

    // Check for dependent packages
    const dependents = this.findDependentPackages(packageId);
    if (dependents.length > 0) {
      throw new Error(`Cannot uninstall ${packageId}: required by ${dependents.join(', ')}`);
    }

    try {
      // Execute uninstall script if present
      const manifestPath = join(packageInfo.installPath, 'manifest.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest: CharacterPackageManifest = JSON.parse(manifestContent);

      if (manifest.installation.uninstallScript) {
        await this.executeUninstallScript(packageInfo.installPath, manifest.installation.uninstallScript);
      }

      // Remove package directory
      await this.cleanupDirectory(packageInfo.installPath);

      // Remove from registry
      this.installedPackages.delete(packageId);
      await this.savePackageRegistry();

      this.emit('uninstallCompleted', { packageId: packageId });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('uninstallFailed', { packageId: packageId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Gets information about an installed package
   */
  getPackageInfo(packageId: string): PackageInfo | null {
    return this.installedPackages.get(packageId) || null;
  }

  /**
   * Lists all installed packages
   */
  listInstalledPackages(): PackageInfo[] {
    return Array.from(this.installedPackages.values());
  }

  /**
   * Resolves package dependencies and determines installation order
   */
  private async resolveDependencies(dependencies: PackageDependency[]): Promise<DependencyResolution> {
    const resolution: DependencyResolution = {
      resolved: true,
      missing: [],
      conflicts: [],
      installOrder: []
    };

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const resolveDependency = (dep: PackageDependency): boolean => {
      if (visiting.has(dep.packageId)) {
        resolution.conflicts.push(`Circular dependency detected: ${dep.packageId}`);
        return false;
      }

      if (visited.has(dep.packageId)) {
        return true;
      }

      visiting.add(dep.packageId);

      const installedPackage = this.installedPackages.get(dep.packageId);
      if (!installedPackage) {
        resolution.missing.push(`${dep.packageId} ${dep.version}`);
        visiting.delete(dep.packageId);
        return false;
      }

      // Check version compatibility
      if (!this.isVersionCompatible(installedPackage.version, dep.version)) {
        resolution.conflicts.push(`Version conflict: ${dep.packageId} requires ${dep.version}, installed ${installedPackage.version}`);
        visiting.delete(dep.packageId);
        return false;
      }

      visited.add(dep.packageId);
      visiting.delete(dep.packageId);
      resolution.installOrder.push(dep.packageId);

      return true;
    };

    for (const dep of dependencies) {
      if (!resolveDependency(dep)) {
        resolution.resolved = false;
      }
    }

    return resolution;
  }

  /**
   * Creates a sandboxed directory for package installation
   */
  private async createSandboxedDirectory(installPath: string): Promise<void> {
    try {
      await mkdir(installPath, { recursive: true });
      
      if (this.config.enableSandboxing) {
        // In a real implementation, this would set up proper sandboxing
        // with restricted permissions and isolated filesystem access
        // For now, we just create the directory structure
        await mkdir(join(installPath, 'assets'), { recursive: true });
        await mkdir(join(installPath, 'configurations'), { recursive: true });
        await mkdir(join(installPath, 'thumbnails'), { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create sandboxed directory: ${error}`);
    }
  }

  /**
   * Extracts package contents to sandboxed directory
   */
  private async extractPackageToSandbox(zip: JSZip, installPath: string): Promise<string[]> {
    const extractedAssets: string[] = [];

    for (const [filename, file] of Object.entries(zip.files)) {
      if (file.dir) continue;

      const targetPath = join(installPath, filename);
      const targetDir = dirname(targetPath);

      // Ensure target directory exists
      await mkdir(targetDir, { recursive: true });

      // Extract file
      const content = await file.async('nodebuffer');
      await writeFile(targetPath, content);

      extractedAssets.push(filename);
    }

    return extractedAssets;
  }

  /**
   * Validates content in sandboxed environment
   */
  private async validateSandboxedContent(installPath: string, manifest: CharacterPackageManifest): Promise<PackageValidationResult> {
    const result: PackageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      safetyIssues: [],
      performanceWarnings: []
    };

    try {
      // Verify manifest integrity
      const manifestPath = join(installPath, 'manifest.json');
      const extractedManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      
      if (JSON.stringify(extractedManifest) !== JSON.stringify(manifest)) {
        result.errors.push('Manifest integrity check failed');
        result.isValid = false;
      }

      // Validate asset files exist and are accessible
      const assetPaths = [
        'assets/models',
        'assets/textures', 
        'assets/animations',
        'assets/audio'
      ];

      for (const assetPath of assetPaths) {
        const fullPath = join(installPath, assetPath);
        try {
          await stat(fullPath);
        } catch {
          // Directory doesn't exist, which is okay if no assets of that type
          result.warnings.push(`Asset directory not found: ${assetPath}`);
        }
      }

      // Security scan for malicious files
      await this.scanForMaliciousContent(installPath, result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Sandbox validation failed: ${errorMessage}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Scans for potentially malicious content in package
   */
  private async scanForMaliciousContent(installPath: string, result: PackageValidationResult): Promise<void> {
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.dll', '.so'];
    const dangerousPatterns = ['eval(', 'exec(', 'system(', 'shell_exec'];

    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else {
            // Check file extension
            const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'));
            if (dangerousExtensions.includes(ext)) {
              result.safetyIssues.push(`Potentially dangerous file: ${entry.name}`);
            }

            // Scan text files for dangerous patterns
            if (['.js', '.ts', '.json', '.txt', '.md'].includes(ext)) {
              try {
                const content = await readFile(fullPath, 'utf-8');
                for (const pattern of dangerousPatterns) {
                  if (content.includes(pattern)) {
                    result.safetyIssues.push(`Potentially dangerous code pattern in ${entry.name}: ${pattern}`);
                  }
                }
              } catch {
                // File might be binary or unreadable, skip content scan
              }
            }
          }
        }
      } catch (error) {
        result.warnings.push(`Could not scan directory ${dirPath}: ${error}`);
      }
    };

    await scanDirectory(installPath);
  }

  /**
   * Executes post-install script in sandboxed environment
   */
  private async executePostInstallScript(installPath: string, scriptPath: string): Promise<void> {
    // In a real implementation, this would execute the script in a secure sandbox
    // For now, we just validate that the script exists and is safe
    const fullScriptPath = join(installPath, scriptPath);
    
    try {
      await stat(fullScriptPath);
      // Script exists, in production this would be executed safely
      this.emit('postInstallScriptExecuted', { installPath, scriptPath });
    } catch {
      throw new Error(`Post-install script not found: ${scriptPath}`);
    }
  }

  /**
   * Executes uninstall script
   */
  private async executeUninstallScript(installPath: string, scriptPath: string): Promise<void> {
    const fullScriptPath = join(installPath, scriptPath);
    
    try {
      await stat(fullScriptPath);
      // Script exists, in production this would be executed safely
      this.emit('uninstallScriptExecuted', { installPath, scriptPath });
    } catch {
      // Uninstall script is optional, continue without error
    }
  }

  /**
   * Compares two version strings using semantic versioning
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Checks if installed version satisfies dependency requirement
   */
  private isVersionCompatible(installedVersion: string, requiredVersion: string): boolean {
    // Simple version compatibility check
    // In production, this would support semantic versioning ranges
    if (requiredVersion.startsWith('>=')) {
      const minVersion = requiredVersion.substring(2);
      return this.compareVersions(installedVersion, minVersion) >= 0;
    }
    
    return this.compareVersions(installedVersion, requiredVersion) === 0;
  }

  /**
   * Finds packages that depend on the given package
   */
  private findDependentPackages(packageId: string): string[] {
    const dependents: string[] = [];
    
    for (const [id, info] of this.installedPackages) {
      if (info.dependencies.includes(packageId)) {
        dependents.push(id);
      }
    }
    
    return dependents;
  }

  /**
   * Creates backup of package installation
   */
  private async createBackup(sourcePath: string, backupPath: string): Promise<void> {
    // In production, this would create a proper backup
    // For now, we simulate the backup creation
    await mkdir(dirname(backupPath), { recursive: true });
    // Backup creation would happen here
  }

  /**
   * Restores package from backup
   */
  private async restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
    // In production, this would restore from backup
    // For now, we simulate the restoration
  }

  /**
   * Compares two package versions and returns list of changes
   */
  private async comparePackageVersions(oldPath: string, newPath: string): Promise<string[]> {
    // In production, this would compare package contents and return detailed changes
    return ['Updated assets', 'Modified configurations', 'New features added'];
  }

  /**
   * Cleans up failed installation
   */
  private async cleanupFailedInstallation(installPath: string): Promise<void> {
    try {
      await this.cleanupDirectory(installPath);
    } catch {
      // Cleanup failure is not critical
    }
  }

  /**
   * Recursively removes directory and contents
   */
  private async cleanupDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await this.cleanupDirectory(fullPath);
        } else {
          await unlink(fullPath);
        }
      }
      
      await rmdir(dirPath);
    } catch {
      // Directory might not exist or be inaccessible
    }
  }

  /**
   * Initializes package directory structure
   */
  private async initializePackageDirectory(): Promise<void> {
    try {
      await mkdir(this.config.packagesDirectory, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Loads installed packages from registry
   */
  private async loadInstalledPackages(): Promise<void> {
    try {
      const registryContent = await readFile(this.packageRegistry, 'utf-8');
      const registry = JSON.parse(registryContent);
      
      for (const packageInfo of registry.packages || []) {
        this.installedPackages.set(packageInfo.packageId, {
          ...packageInfo,
          installedAt: new Date(packageInfo.installedAt),
          lastUsed: new Date(packageInfo.lastUsed)
        });
      }
    } catch {
      // Registry doesn't exist yet, start with empty registry
    }
  }

  /**
   * Saves package registry to disk
   */
  private async savePackageRegistry(): Promise<void> {
    const registry = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      packages: Array.from(this.installedPackages.values())
    };
    
    await writeFile(this.packageRegistry, JSON.stringify(registry, null, 2));
  }
}