/**
 * Character Package Browser Interface
 * 
 * Provides browsing, filtering, and installation interface for character packages
 * with age-appropriate content filtering and parental controls.
 */

import { EventEmitter } from 'events';
import { CharacterPackageManager } from '../packages/package-manager';
import { CharacterPackage, InstallationResult } from '../packages/types';
import { AvatarSafetyValidator } from './enhanced-safety-validator';

export interface PackageFilter {
  ageRange?: { min: number; max: number };
  categories?: string[];
  safetyRating?: 'all-ages' | 'child-safe' | 'teen-appropriate';
  author?: string;
  tags?: string[];
  sortBy?: 'name' | 'popularity' | 'date' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface PackageBrowserConfig {
  userAge: number;
  userId: string;
  parentalControlsEnabled: boolean;
  maxPackagesPerPage: number;
  enablePreview: boolean;
}

export interface InstallationProgress {
  packageId: string;
  stage: 'downloading' | 'validating' | 'installing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface PackagePreview {
  packageId: string;
  thumbnails: string[];
  description: string;
  features: string[];
  compatibility: {
    isCompatible: boolean;
    issues: string[];
  };
  safetyAssessment: {
    isAppropriate: boolean;
    concerns: string[];
    requiresApproval: boolean;
  };
}

/**
 * Main character package browser interface
 */
export class CharacterPackageBrowser extends EventEmitter {
  private packageManager: CharacterPackageManager;
  private safetyValidator: AvatarSafetyValidator;
  private config: PackageBrowserConfig;
  private availablePackages: CharacterPackage[];
  private filteredPackages: CharacterPackage[];
  private installedPackages: Map<string, CharacterPackage>;
  private activeInstallations: Map<string, InstallationProgress>;
  private currentFilter: PackageFilter;
  private currentPage: number;

  constructor(
    packageManager: CharacterPackageManager,
    safetyValidator: AvatarSafetyValidator,
    config: PackageBrowserConfig
  ) {
    super();
    this.packageManager = packageManager;
    this.safetyValidator = safetyValidator;
    this.config = config;
    this.availablePackages = [];
    this.filteredPackages = [];
    this.installedPackages = new Map();
    this.activeInstallations = new Map();
    this.currentFilter = {};
    this.currentPage = 1;
  }

  /**
   * Initialize the browser and load available packages
   */
  async initialize(): Promise<void> {
    try {
      // Load available packages from repository
      this.availablePackages = await this.packageManager.listAvailableCharacters(this.config.userAge);
      
      // Load installed packages
      const installed = await this.packageManager.getInstalledPackages();
      installed.forEach(pkg => this.installedPackages.set(pkg.packageId, pkg));

      // Apply initial filtering
      await this.applyFilter(this.getDefaultFilter());

      this.emit('initialized', {
        totalPackages: this.availablePackages.length,
        installedCount: this.installedPackages.size
      });

    } catch (error) {
      this.emit('error', { type: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Apply filter to package list
   */
  async applyFilter(filter: PackageFilter): Promise<void> {
    try {
      this.currentFilter = { ...filter };
      this.filteredPackages = await this.filterPackages(this.availablePackages, filter);
      this.currentPage = 1;

      this.emit('filterApplied', {
        filter,
        resultCount: this.filteredPackages.length,
        totalPages: this.getTotalPages()
      });

    } catch (error) {
      this.emit('error', { type: 'filtering', error: error.message });
      throw error;
    }
  }

  /**
   * Get packages for current page
   */
  getCurrentPagePackages(): CharacterPackage[] {
    const startIndex = (this.currentPage - 1) * this.config.maxPackagesPerPage;
    const endIndex = startIndex + this.config.maxPackagesPerPage;
    return this.filteredPackages.slice(startIndex, endIndex);
  }

  /**
   * Navigate to specific page
   */
  goToPage(page: number): void {
    const totalPages = this.getTotalPages();
    if (page < 1 || page > totalPages) {
      throw new Error(`Invalid page number: ${page}. Must be between 1 and ${totalPages}`);
    }

    this.currentPage = page;
    this.emit('pageChanged', {
      currentPage: page,
      totalPages,
      packages: this.getCurrentPagePackages()
    });
  }

  /**
   * Get detailed preview for a package
   */
  async getPackagePreview(packageId: string): Promise<PackagePreview> {
    try {
      const pkg = this.findPackage(packageId);
      if (!pkg) {
        throw new Error(`Package not found: ${packageId}`);
      }

      // Check compatibility
      const compatibility = await this.checkCompatibility(pkg);

      // Perform safety assessment
      const safetyAssessment = await this.assessPackageSafety(pkg);

      const preview: PackagePreview = {
        packageId,
        thumbnails: pkg.metadata.thumbnails || [pkg.metadata.thumbnail],
        description: pkg.metadata.description,
        features: pkg.metadata.features || [],
        compatibility,
        safetyAssessment
      };

      this.emit('previewGenerated', { packageId, preview });
      return preview;

    } catch (error) {
      this.emit('error', { type: 'preview', packageId, error: error.message });
      throw error;
    }
  }

  /**
   * Install a character package
   */
  async installPackage(packageId: string): Promise<void> {
    try {
      const pkg = this.findPackage(packageId);
      if (!pkg) {
        throw new Error(`Package not found: ${packageId}`);
      }

      // Check if already installed
      if (this.installedPackages.has(packageId)) {
        throw new Error('Package is already installed');
      }

      // Perform safety check
      const safetyAssessment = await this.assessPackageSafety(pkg);
      if (!safetyAssessment.isAppropriate) {
        throw new Error(`Package blocked: ${safetyAssessment.concerns.join(', ')}`);
      }

      // Check for parental approval if needed
      if (safetyAssessment.requiresApproval && this.config.parentalControlsEnabled) {
        await this.requestParentalApproval(pkg);
        return; // Installation will continue after approval
      }

      // Start installation
      await this.performInstallation(pkg);

    } catch (error) {
      this.emit('installationError', { packageId, error: error.message });
      throw error;
    }
  }

  /**
   * Uninstall a character package
   */
  async uninstallPackage(packageId: string): Promise<void> {
    try {
      if (!this.installedPackages.has(packageId)) {
        throw new Error('Package is not installed');
      }

      await this.packageManager.uninstallCharacterPackage(packageId);
      this.installedPackages.delete(packageId);

      this.emit('packageUninstalled', { packageId });

    } catch (error) {
      this.emit('uninstallationError', { packageId, error: error.message });
      throw error;
    }
  }

  /**
   * Update an installed package
   */
  async updatePackage(packageId: string): Promise<void> {
    try {
      const installedPkg = this.installedPackages.get(packageId);
      if (!installedPkg) {
        throw new Error('Package is not installed');
      }

      const updateResult = await this.packageManager.updateCharacterPackage(packageId);
      
      if (updateResult.success) {
        // Reload package info
        const updatedPkg = await this.packageManager.getPackageInfo(packageId);
        this.installedPackages.set(packageId, updatedPkg);
        
        this.emit('packageUpdated', { packageId, newVersion: updatedPkg.version });
      }

    } catch (error) {
      this.emit('updateError', { packageId, error: error.message });
      throw error;
    }
  }

  /**
   * Get installation progress for active installations
   */
  getInstallationProgress(packageId: string): InstallationProgress | null {
    return this.activeInstallations.get(packageId) || null;
  }

  /**
   * Get all active installations
   */
  getActiveInstallations(): InstallationProgress[] {
    return Array.from(this.activeInstallations.values());
  }

  /**
   * Get installed packages
   */
  getInstalledPackages(): CharacterPackage[] {
    return Array.from(this.installedPackages.values());
  }

  /**
   * Search packages by text query
   */
  async searchPackages(query: string): Promise<CharacterPackage[]> {
    const searchTerms = query.toLowerCase().split(' ');
    
    return this.filteredPackages.filter(pkg => {
      const searchableText = [
        pkg.metadata.name,
        pkg.metadata.description,
        pkg.metadata.author,
        ...(pkg.metadata.tags || [])
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  /**
   * Get available filter options
   */
  getFilterOptions(): {
    categories: string[];
    authors: string[];
    tags: string[];
    safetyRatings: string[];
  } {
    const categories = new Set<string>();
    const authors = new Set<string>();
    const tags = new Set<string>();
    const safetyRatings = new Set<string>();

    this.availablePackages.forEach(pkg => {
      if (pkg.metadata.category) categories.add(pkg.metadata.category);
      if (pkg.metadata.author) authors.add(pkg.metadata.author);
      if (pkg.metadata.tags) pkg.metadata.tags.forEach(tag => tags.add(tag));
      if (pkg.content.ageRating) safetyRatings.add(pkg.content.ageRating);
    });

    return {
      categories: Array.from(categories).sort(),
      authors: Array.from(authors).sort(),
      tags: Array.from(tags).sort(),
      safetyRatings: Array.from(safetyRatings).sort()
    };
  }

  private async filterPackages(packages: CharacterPackage[], filter: PackageFilter): Promise<CharacterPackage[]> {
    let filtered = [...packages];

    // Age range filter
    if (filter.ageRange) {
      filtered = filtered.filter(pkg => {
        const pkgAgeRange = this.parseAgeRange(pkg.content.ageRating);
        return pkgAgeRange.min <= filter.ageRange!.max && pkgAgeRange.max >= filter.ageRange!.min;
      });
    }

    // Category filter
    if (filter.categories && filter.categories.length > 0) {
      filtered = filtered.filter(pkg => 
        filter.categories!.includes(pkg.metadata.category || 'general')
      );
    }

    // Safety rating filter
    if (filter.safetyRating) {
      filtered = filtered.filter(pkg => pkg.content.ageRating === filter.safetyRating);
    }

    // Author filter
    if (filter.author) {
      filtered = filtered.filter(pkg => 
        pkg.metadata.author.toLowerCase().includes(filter.author!.toLowerCase())
      );
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(pkg => 
        filter.tags!.some(tag => (pkg.metadata.tags || []).includes(tag))
      );
    }

    // Apply safety filtering for user age
    filtered = await this.applySafetyFilter(filtered);

    // Sort results
    if (filter.sortBy) {
      filtered = this.sortPackages(filtered, filter.sortBy, filter.sortOrder || 'asc');
    }

    return filtered;
  }

  private async applySafetyFilter(packages: CharacterPackage[]): Promise<CharacterPackage[]> {
    const safePackages: CharacterPackage[] = [];

    for (const pkg of packages) {
      try {
        const safetyAssessment = await this.assessPackageSafety(pkg);
        if (safetyAssessment.isAppropriate || !safetyAssessment.requiresApproval) {
          safePackages.push(pkg);
        }
      } catch (error) {
        // Skip packages that fail safety assessment
        continue;
      }
    }

    return safePackages;
  }

  private async assessPackageSafety(pkg: CharacterPackage): Promise<{
    isAppropriate: boolean;
    concerns: string[];
    requiresApproval: boolean;
  }> {
    // Mock implementation - would integrate with actual safety validation
    const ageRange = this.parseAgeRange(pkg.content.ageRating);
    const isAppropriate = this.config.userAge >= ageRange.min && this.config.userAge <= ageRange.max;
    
    return {
      isAppropriate,
      concerns: isAppropriate ? [] : ['Age inappropriate content'],
      requiresApproval: !isAppropriate && this.config.parentalControlsEnabled
    };
  }

  private async checkCompatibility(pkg: CharacterPackage): Promise<{
    isCompatible: boolean;
    issues: string[];
  }> {
    // Mock implementation - would check system compatibility
    return {
      isCompatible: true,
      issues: []
    };
  }

  private async requestParentalApproval(pkg: CharacterPackage): Promise<void> {
    this.emit('parentalApprovalRequired', {
      packageId: pkg.packageId,
      packageName: pkg.metadata.name,
      reason: 'Age verification required'
    });
  }

  private async performInstallation(pkg: CharacterPackage): Promise<void> {
    const progress: InstallationProgress = {
      packageId: pkg.packageId,
      stage: 'downloading',
      progress: 0,
      message: 'Starting download...'
    };

    this.activeInstallations.set(pkg.packageId, progress);
    this.emit('installationStarted', { packageId: pkg.packageId });

    try {
      // Simulate installation progress
      await this.updateInstallationProgress(progress, 'downloading', 25, 'Downloading package...');
      await this.updateInstallationProgress(progress, 'validating', 50, 'Validating package integrity...');
      await this.updateInstallationProgress(progress, 'installing', 75, 'Installing package files...');

      // Perform actual installation
      const result = await this.packageManager.installCharacterPackage(pkg.packageId);
      
      if (result.success) {
        await this.updateInstallationProgress(progress, 'complete', 100, 'Installation complete!');
        this.installedPackages.set(pkg.packageId, pkg);
        this.emit('packageInstalled', { packageId: pkg.packageId, result });
      } else {
        throw new Error(result.errors.join(', '));
      }

    } catch (error) {
      progress.stage = 'error';
      progress.message = `Installation failed: ${error.message}`;
      this.emit('installationProgress', progress);
      throw error;
    } finally {
      // Clean up after installation completes or fails
      setTimeout(() => {
        this.activeInstallations.delete(pkg.packageId);
      }, 5000);
    }
  }

  private async updateInstallationProgress(
    progress: InstallationProgress,
    stage: InstallationProgress['stage'],
    percent: number,
    message: string
  ): Promise<void> {
    progress.stage = stage;
    progress.progress = percent;
    progress.message = message;
    
    this.emit('installationProgress', { ...progress });
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private findPackage(packageId: string): CharacterPackage | null {
    return this.availablePackages.find(pkg => pkg.packageId === packageId) || null;
  }

  private parseAgeRange(ageRating: string): { min: number; max: number } {
    const ageRanges = {
      'all-ages': { min: 5, max: 17 },
      'child-safe': { min: 5, max: 12 },
      'teen-appropriate': { min: 13, max: 17 }
    };

    return ageRanges[ageRating as keyof typeof ageRanges] || { min: 13, max: 17 };
  }

  private sortPackages(
    packages: CharacterPackage[],
    sortBy: string,
    order: 'asc' | 'desc'
  ): CharacterPackage[] {
    const sorted = [...packages].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.metadata.name.localeCompare(b.metadata.name);
          break;
        case 'date':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;
        case 'popularity':
          comparison = (a.metadata.downloadCount || 0) - (b.metadata.downloadCount || 0);
          break;
        case 'rating':
          comparison = (a.metadata.rating || 0) - (b.metadata.rating || 0);
          break;
        default:
          return 0;
      }

      return order === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  private getDefaultFilter(): PackageFilter {
    return {
      ageRange: { min: Math.max(5, this.config.userAge - 2), max: Math.min(17, this.config.userAge + 2) },
      safetyRating: this.config.userAge < 13 ? 'child-safe' : 'teen-appropriate',
      sortBy: 'popularity',
      sortOrder: 'desc'
    };
  }

  private getTotalPages(): number {
    return Math.ceil(this.filteredPackages.length / this.config.maxPackagesPerPage);
  }
}

/**
 * Package installation queue manager
 */
export class PackageInstallationQueue extends EventEmitter {
  private queue: string[];
  private maxConcurrentInstallations: number;
  private activeInstallations: Set<string>;

  constructor(maxConcurrentInstallations: number = 2) {
    super();
    this.queue = [];
    this.maxConcurrentInstallations = maxConcurrentInstallations;
    this.activeInstallations = new Set();
  }

  /**
   * Add package to installation queue
   */
  enqueue(packageId: string): void {
    if (!this.queue.includes(packageId) && !this.activeInstallations.has(packageId)) {
      this.queue.push(packageId);
      this.emit('packageQueued', { packageId, queuePosition: this.queue.length });
      this.processQueue();
    }
  }

  /**
   * Remove package from queue
   */
  dequeue(packageId: string): boolean {
    const index = this.queue.indexOf(packageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('packageDequeued', { packageId });
      return true;
    }
    return false;
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    queued: string[];
    active: string[];
    queueLength: number;
  } {
    return {
      queued: [...this.queue],
      active: Array.from(this.activeInstallations),
      queueLength: this.queue.length
    };
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeInstallations.size < this.maxConcurrentInstallations) {
      const packageId = this.queue.shift()!;
      this.activeInstallations.add(packageId);
      
      this.emit('installationStarted', { packageId });
      
      try {
        // Installation would be handled by the browser
        this.emit('installationCompleted', { packageId });
      } catch (error) {
        this.emit('installationFailed', { packageId, error: error.message });
      } finally {
        this.activeInstallations.delete(packageId);
        // Continue processing queue
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }
}