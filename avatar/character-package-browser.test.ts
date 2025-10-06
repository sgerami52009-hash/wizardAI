/**
 * Unit tests for Character Package Browser Interface
 */

import { CharacterPackageBrowser, PackageInstallationQueue, PackageFilter, PackageBrowserConfig } from './character-package-browser';
import { CharacterPackageManager } from '../packages/package-manager';
import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';
import { CharacterPackage } from '../packages/types';

// Mock dependencies
jest.mock('../packages/package-manager');
jest.mock('./enhanced-safety-validator');

describe('CharacterPackageBrowser', () => {
  let browser: CharacterPackageBrowser;
  let mockPackageManager: jest.Mocked<CharacterPackageManager>;
  let mockSafetyValidator: jest.Mocked<EnhancedAvatarSafetyValidator>;
  let mockConfig: PackageBrowserConfig;
  let mockPackages: CharacterPackage[];

  beforeEach(() => {
    mockPackageManager = {
      listAvailableCharacters: jest.fn(),
      listInstalledPackages: jest.fn(),
      installCharacterPackage: jest.fn(),
      uninstallCharacterPackage: jest.fn(),
      updateCharacterPackage: jest.fn(),
      getPackageInfo: jest.fn()
    } as jest.Mocked<CharacterPackageManager>;
    mockSafetyValidator = {} as jest.Mocked<EnhancedAvatarSafetyValidator>;
    
    mockConfig = {
      userAge: 10,
      userId: 'test-user',
      parentalControlsEnabled: true,
      maxPackagesPerPage: 6,
      enablePreview: true
    };

    mockPackages = [
      {
        packageId: 'pkg-1',
        version: '1.0.0',
        metadata: {
          name: 'Friendly Robot',
          description: 'A cheerful robot character',
          author: 'Test Studio',
          version: '1.0.0',
          ageRating: 'all-ages' as any,
          tags: ['friendly', 'robot'],
          thumbnail: 'robot-thumb.png',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          fileSize: 1024000,
          checksum: 'abc123',
          license: 'MIT'
        },
        assets: {} as any,
        configuration: {} as any,
        signature: 'signature1',
        manifest: {} as any
      },
      {
        packageId: 'pkg-2',
        version: '1.1.0',
        metadata: {
          name: 'Space Explorer',
          description: 'An adventurous space character',
          author: 'Space Studios',
          version: '1.1.0',
          ageRating: 'all-ages' as any,
          tags: ['adventure', 'space'],
          thumbnail: 'space-thumb.png',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          fileSize: 2048000,
          checksum: 'def456',
          license: 'MIT'
        },
        assets: {} as any,
        configuration: {} as any,
        signature: 'signature2',
        manifest: {} as any
      },
      {
        packageId: 'pkg-3',
        version: '2.0.0',
        metadata: {
          name: 'Teen Hero',
          description: 'A superhero character for teens',
          author: 'Hero Studios',
          version: '2.0.0',
          ageRating: '12+' as any,
          tags: ['superhero', 'teen'],
          thumbnail: 'hero-thumb.png',
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01'),
          fileSize: 3072000,
          checksum: 'ghi789',
          license: 'MIT'
        },
        assets: {} as any,
        configuration: {} as any,
        signature: 'signature3',
        manifest: {} as any
      }
    ] as CharacterPackage[];

    browser = new CharacterPackageBrowser(mockPackageManager, mockSafetyValidator, mockConfig);

    // Setup default mocks
    mockPackageManager.listAvailableCharacters.mockResolvedValue(mockPackages);
    mockPackageManager.listInstalledPackages.mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize and load available packages', async () => {
      const eventSpy = jest.fn();
      browser.on('initialized', eventSpy);

      await browser.initialize();

      expect(mockPackageManager.listAvailableCharacters).toHaveBeenCalledWith(mockConfig.userAge);
      expect(eventSpy).toHaveBeenCalledWith({
        totalPackages: 3,
        installedCount: 0
      });
    });

    it('should load installed packages on initialization', async () => {
      const installedPackage = { ...mockPackages[0] };
      mockPackageManager.listInstalledPackages.mockReturnValue([installedPackage]);

      await browser.initialize();

      const installed = browser.getInstalledPackages();
      expect(installed).toHaveLength(1);
      expect(installed[0].packageId).toBe('pkg-1');
    });

    it('should handle initialization errors', async () => {
      mockPackageManager.listAvailableCharacters.mockRejectedValue(new Error('Network error'));

      const eventSpy = jest.fn();
      browser.on('error', eventSpy);

      const initPromise = browser.initialize();

      await expect(initPromise).rejects.toThrow('Network error');
      expect(eventSpy).toHaveBeenCalledWith({
        type: 'initialization',
        error: 'Network error'
      });
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should apply age range filter', async () => {
      const filter: PackageFilter = {
        ageRange: { min: 5, max: 12 }
      };

      const eventSpy = jest.fn();
      browser.on('filterApplied', eventSpy);

      await browser.applyFilter(filter);

      expect(eventSpy).toHaveBeenCalledWith({
        filter,
        resultCount: expect.any(Number),
        totalPages: expect.any(Number)
      });

      const packages = browser.getCurrentPagePackages();
      // Should exclude teen-appropriate package
      expect(packages.every(pkg => pkg.metadata.ageRating !== '12+')).toBe(true);
    });

    it('should apply category filter', async () => {
      const filter: PackageFilter = {
        categories: ['robots']
      };

      await browser.applyFilter(filter);

      const packages = browser.getCurrentPagePackages();
      expect(packages).toHaveLength(1);
      expect(packages[0].metadata.tags).toContain('robot');
    });

    it('should apply author filter', async () => {
      const filter: PackageFilter = {
        author: 'Test Studio'
      };

      await browser.applyFilter(filter);

      const packages = browser.getCurrentPagePackages();
      expect(packages).toHaveLength(1);
      expect(packages[0].metadata.author).toBe('Test Studio');
    });

    it('should apply tags filter', async () => {
      const filter: PackageFilter = {
        tags: ['friendly']
      };

      await browser.applyFilter(filter);

      const packages = browser.getCurrentPagePackages();
      expect(packages).toHaveLength(1);
      expect(packages[0].metadata.tags).toContain('friendly');
    });

    it('should sort packages by name', async () => {
      const filter: PackageFilter = {
        sortBy: 'name',
        sortOrder: 'asc'
      };

      await browser.applyFilter(filter);

      const packages = browser.getCurrentPagePackages();
      expect(packages[0].metadata.name).toBe('Friendly Robot');
      expect(packages[1].metadata.name).toBe('Space Explorer');
    });

    it('should sort packages by popularity descending', async () => {
      const filter: PackageFilter = {
        sortBy: 'popularity',
        sortOrder: 'desc'
      };

      await browser.applyFilter(filter);

      const packages = browser.getCurrentPagePackages();
      expect(packages[0].metadata.fileSize).toBeGreaterThanOrEqual(packages[1].metadata.fileSize || 0);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      // Create more packages to test pagination
      const morePackages = Array.from({ length: 10 }, (_, i) => ({
        ...mockPackages[0],
        packageId: `pkg-${i + 4}`,
        metadata: {
          ...mockPackages[0].metadata,
          name: `Package ${i + 4}`
        }
      }));

      mockPackageManager.listAvailableCharacters.mockResolvedValue([...mockPackages, ...morePackages]);
      await browser.initialize();
    });

    it('should navigate to different pages', () => {
      const eventSpy = jest.fn();
      browser.on('pageChanged', eventSpy);

      browser.goToPage(2);

      expect(eventSpy).toHaveBeenCalledWith({
        currentPage: 2,
        totalPages: expect.any(Number),
        packages: expect.any(Array)
      });

      const packages = browser.getCurrentPagePackages();
      expect(packages.length).toBeLessThanOrEqual(mockConfig.maxPackagesPerPage);
    });

    it('should reject invalid page numbers', () => {
      expect(() => browser.goToPage(0)).toThrow('Invalid page number');
      expect(() => browser.goToPage(999)).toThrow('Invalid page number');
    });

    it('should return correct packages for current page', () => {
      const firstPagePackages = browser.getCurrentPagePackages();
      expect(firstPagePackages.length).toBeLessThanOrEqual(mockConfig.maxPackagesPerPage);

      browser.goToPage(2);
      const secondPagePackages = browser.getCurrentPagePackages();
      
      // Packages should be different between pages
      expect(firstPagePackages[0].packageId).not.toBe(secondPagePackages[0].packageId);
    });
  });

  describe('package preview', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should generate package preview', async () => {
      const eventSpy = jest.fn();
      browser.on('previewGenerated', eventSpy);

      const preview = await browser.getPackagePreview('pkg-1');

      expect(preview).toMatchObject({
        packageId: 'pkg-1',
        description: 'A cheerful robot character',
        compatibility: {
          isCompatible: true,
          issues: []
        },
        safetyAssessment: {
          isAppropriate: true,
          concerns: [],
          requiresApproval: false
        }
      });

      expect(eventSpy).toHaveBeenCalledWith({
        packageId: 'pkg-1',
        preview
      });
    });

    it('should handle preview for non-existent package', async () => {
      const previewPromise = browser.getPackagePreview('non-existent');

      await expect(previewPromise).rejects.toThrow('Package not found: non-existent');
    });

    it('should assess age appropriateness in preview', async () => {
      // Test with teen package for child user
      const preview = await browser.getPackagePreview('pkg-3');

      expect(preview.safetyAssessment.isAppropriate).toBe(false);
      expect(preview.safetyAssessment.concerns).toContain('Age inappropriate content');
      expect(preview.safetyAssessment.requiresApproval).toBe(true);
    });
  });

  describe('package installation', () => {
    beforeEach(async () => {
      await browser.initialize();
      mockPackageManager.installCharacterPackage.mockResolvedValue({
        success: true,
        packageId: 'pkg-1',
        installedAssets: ['model.glb', 'texture.png'],
        errors: [],
        requiresRestart: false
      });
    });

    it('should install appropriate package', async () => {
      const eventSpy = jest.fn();
      browser.on('packageInstalled', eventSpy);

      await browser.installPackage('pkg-1');

      expect(mockPackageManager.installCharacterPackage).toHaveBeenCalledWith('pkg-1');
      expect(eventSpy).toHaveBeenCalledWith({
        packageId: 'pkg-1',
        result: expect.objectContaining({ success: true })
      });

      const installed = browser.getInstalledPackages();
      expect(installed.some(pkg => pkg.packageId === 'pkg-1')).toBe(true);
    });

    it('should block inappropriate package installation', async () => {
      const installPromise = browser.installPackage('pkg-3'); // Teen package for child user

      await expect(installPromise).rejects.toThrow('Package blocked: Age inappropriate content');
    });

    it('should request parental approval for restricted packages', async () => {
      const eventSpy = jest.fn();
      browser.on('parentalApprovalRequired', eventSpy);

      // Mock the package as requiring approval but not completely blocked
      jest.spyOn(browser as any, 'assessPackageSafety').mockResolvedValue({
        isAppropriate: false,
        concerns: ['Age verification needed'],
        requiresApproval: true
      });

      await browser.installPackage('pkg-3');

      expect(eventSpy).toHaveBeenCalledWith({
        packageId: 'pkg-3',
        packageName: 'Teen Hero',
        reason: 'Age verification required'
      });
    });

    it('should prevent installing already installed packages', async () => {
      // First installation
      await browser.installPackage('pkg-1');

      // Second installation attempt
      const installPromise = browser.installPackage('pkg-1');

      await expect(installPromise).rejects.toThrow('Package is already installed');
    });

    it('should track installation progress', async () => {
      const progressSpy = jest.fn();
      browser.on('installationProgress', progressSpy);

      const installPromise = browser.installPackage('pkg-1');

      // Wait a bit for progress events
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(progressSpy).toHaveBeenCalled();
      
      await installPromise;

      const progress = browser.getInstallationProgress('pkg-1');
      expect(progress?.stage).toBe('complete');
    });
  });

  describe('package uninstallation', () => {
    beforeEach(async () => {
      await browser.initialize();
      // Install a package first
      mockPackageManager.installCharacterPackage.mockResolvedValue({
        success: true,
        packageId: 'pkg-1',
        installedAssets: [],
        errors: [],
        requiresRestart: false
      });
      await browser.installPackage('pkg-1');
      mockPackageManager.uninstallCharacterPackage.mockResolvedValue();
    });

    it('should uninstall installed package', async () => {
      const eventSpy = jest.fn();
      browser.on('packageUninstalled', eventSpy);

      await browser.uninstallPackage('pkg-1');

      expect(mockPackageManager.uninstallCharacterPackage).toHaveBeenCalledWith('pkg-1');
      expect(eventSpy).toHaveBeenCalledWith({ packageId: 'pkg-1' });

      const installed = browser.getInstalledPackages();
      expect(installed.some(pkg => pkg.packageId === 'pkg-1')).toBe(false);
    });

    it('should fail to uninstall non-installed package', async () => {
      const uninstallPromise = browser.uninstallPackage('pkg-2');

      await expect(uninstallPromise).rejects.toThrow('Package is not installed');
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should search packages by name', async () => {
      const results = await browser.searchPackages('robot');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toContain('Robot');
    });

    it('should search packages by description', async () => {
      const results = await browser.searchPackages('cheerful');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.description).toContain('cheerful');
    });

    it('should search packages by tags', async () => {
      const results = await browser.searchPackages('friendly');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.tags).toContain('friendly');
    });

    it('should search with multiple terms', async () => {
      const results = await browser.searchPackages('space adventure');

      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toBe('Space Explorer');
    });

    it('should return empty results for non-matching search', async () => {
      const results = await browser.searchPackages('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('filter options', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should return available filter options', () => {
      const options = browser.getFilterOptions();

      expect(options.categories).toContain('robots');
      expect(options.categories).toContain('space');
      expect(options.authors).toContain('Test Studio');
      expect(options.tags).toContain('friendly');
      expect(options.safetyRatings).toContain('child-safe');
    });

    it('should return sorted filter options', () => {
      const options = browser.getFilterOptions();

      expect(options.categories).toEqual([...options.categories].sort());
      expect(options.authors).toEqual([...options.authors].sort());
      expect(options.tags).toEqual([...options.tags].sort());
    });
  });

  describe('interface responsiveness', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should respond to filter changes within 200ms', async () => {
      const filter: PackageFilter = {
        categories: ['robots']
      };

      const startTime = Date.now();
      await browser.applyFilter(filter);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it('should handle rapid filter changes gracefully', async () => {
      const filters = [
        { categories: ['robots'] },
        { categories: ['space'] },
        { tags: ['friendly'] },
        { author: 'Test Studio' }
      ];

      const promises = filters.map(filter => browser.applyFilter(filter));
      await Promise.all(promises);

      // Should complete all filters without errors
      const packages = browser.getCurrentPagePackages();
      expect(packages).toBeDefined();
    });

    it('should update pagination immediately after filtering', async () => {
      const filter: PackageFilter = {
        categories: ['robots'] // Should result in 1 package
      };

      const eventSpy = jest.fn();
      browser.on('filterApplied', eventSpy);

      await browser.applyFilter(filter);

      expect(eventSpy).toHaveBeenCalledWith({
        filter,
        resultCount: 1,
        totalPages: 1
      });

      const packages = browser.getCurrentPagePackages();
      expect(packages).toHaveLength(1);
    });

    it('should provide real-time search results', async () => {
      const searchQueries = ['robot', 'space', 'friendly'];
      
      for (const query of searchQueries) {
        const startTime = Date.now();
        const results = await browser.searchPackages(query);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(100); // Very fast search
        expect(results).toBeDefined();
      }
    });
  });

  describe('installation interface', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should provide clear installation progress feedback', async () => {
      mockPackageManager.installCharacterPackage.mockImplementation(async () => {
        // Simulate installation delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          success: true,
          packageId: 'pkg-1',
          installedAssets: ['model.glb'],
          errors: [],
          requiresRestart: false
        };
      });

      const progressSpy = jest.fn();
      browser.on('installationProgress', progressSpy);

      const installPromise = browser.installPackage('pkg-1');
      
      // Check that progress events are emitted
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(progressSpy).toHaveBeenCalled();

      await installPromise;

      const finalProgress = browser.getInstallationProgress('pkg-1');
      expect(finalProgress?.stage).toBe('complete');
    });

    it('should handle installation errors gracefully', async () => {
      mockPackageManager.installCharacterPackage.mockRejectedValue(new Error('Network error'));

      const errorSpy = jest.fn();
      browser.on('installationError', errorSpy);

      const installPromise = browser.installPackage('pkg-1');

      await expect(installPromise).rejects.toThrow('Network error');
      expect(errorSpy).toHaveBeenCalledWith({
        packageId: 'pkg-1',
        error: 'Network error'
      });
    });

    it('should show installation queue status', () => {
      const queue = new PackageInstallationQueue(2);
      
      queue.enqueue('pkg-1');
      queue.enqueue('pkg-2');
      queue.enqueue('pkg-3');

      const status = queue.getQueueStatus();
      expect(status.queueLength).toBe(3);
      expect(status.queued).toEqual(['pkg-1', 'pkg-2', 'pkg-3']);
    });

    it('should prevent duplicate installations', async () => {
      // First installation
      mockPackageManager.installCharacterPackage.mockResolvedValue({
        success: true,
        packageId: 'pkg-1',
        installedAssets: [],
        errors: [],
        requiresRestart: false
      });

      await browser.installPackage('pkg-1');

      // Second installation attempt
      const secondInstallPromise = browser.installPackage('pkg-1');

      await expect(secondInstallPromise).rejects.toThrow('Package is already installed');
    });

    it('should handle parental approval workflow', async () => {
      const approvalSpy = jest.fn();
      browser.on('parentalApprovalRequired', approvalSpy);

      // Mock safety assessment to require approval
      jest.spyOn(browser as any, 'assessPackageSafety').mockResolvedValue({
        isAppropriate: false,
        concerns: ['Age verification needed'],
        requiresApproval: true
      });

      await browser.installPackage('pkg-3'); // Teen package

      expect(approvalSpy).toHaveBeenCalledWith({
        packageId: 'pkg-3',
        packageName: 'Teen Hero',
        reason: 'Age verification required'
      });
    });
  });

  describe('package preview interface', () => {
    beforeEach(async () => {
      await browser.initialize();
    });

    it('should generate comprehensive package previews', async () => {
      const preview = await browser.getPackagePreview('pkg-1');

      expect(preview).toMatchObject({
        packageId: 'pkg-1',
        description: expect.any(String),
        compatibility: {
          isCompatible: expect.any(Boolean),
          issues: expect.any(Array)
        },
        safetyAssessment: {
          isAppropriate: expect.any(Boolean),
          concerns: expect.any(Array),
          requiresApproval: expect.any(Boolean)
        }
      });
    });

    it('should show age-appropriate warnings in previews', async () => {
      const preview = await browser.getPackagePreview('pkg-3'); // Teen package for child user

      expect(preview.safetyAssessment.isAppropriate).toBe(false);
      expect(preview.safetyAssessment.concerns).toContain('Age inappropriate content');
    });

    it('should handle preview generation errors', async () => {
      const previewPromise = browser.getPackagePreview('non-existent-package');

      await expect(previewPromise).rejects.toThrow('Package not found: non-existent-package');
    });

    it('should emit preview events for UI updates', async () => {
      const eventSpy = jest.fn();
      browser.on('previewGenerated', eventSpy);

      await browser.getPackagePreview('pkg-1');

      expect(eventSpy).toHaveBeenCalledWith({
        packageId: 'pkg-1',
        preview: expect.any(Object)
      });
    });
  });
});

describe('PackageInstallationQueue', () => {
  let queue: PackageInstallationQueue;

  beforeEach(() => {
    queue = new PackageInstallationQueue(2); // Max 2 concurrent installations
  });

  it('should enqueue packages', () => {
    const eventSpy = jest.fn();
    queue.on('packageQueued', eventSpy);

    queue.enqueue('pkg-1');
    queue.enqueue('pkg-2');

    expect(eventSpy).toHaveBeenCalledTimes(2);
    expect(eventSpy).toHaveBeenCalledWith({
      packageId: 'pkg-1',
      queuePosition: 1
    });

    const status = queue.getQueueStatus();
    expect(status.queueLength).toBe(2);
  });

  it('should not enqueue duplicate packages', () => {
    queue.enqueue('pkg-1');
    queue.enqueue('pkg-1'); // Duplicate

    const status = queue.getQueueStatus();
    expect(status.queueLength).toBe(1);
  });

  it('should dequeue packages', () => {
    queue.enqueue('pkg-1');
    queue.enqueue('pkg-2');

    const eventSpy = jest.fn();
    queue.on('packageDequeued', eventSpy);

    const removed = queue.dequeue('pkg-1');

    expect(removed).toBe(true);
    expect(eventSpy).toHaveBeenCalledWith({ packageId: 'pkg-1' });

    const status = queue.getQueueStatus();
    expect(status.queueLength).toBe(1);
  });

  it('should return false when dequeuing non-existent package', () => {
    const removed = queue.dequeue('non-existent');

    expect(removed).toBe(false);
  });

  it('should provide queue status', () => {
    queue.enqueue('pkg-1');
    queue.enqueue('pkg-2');
    queue.enqueue('pkg-3');

    const status = queue.getQueueStatus();

    expect(status.queueLength).toBe(3);
    expect(status.queued).toEqual(['pkg-1', 'pkg-2', 'pkg-3']);
    expect(status.active).toEqual([]);
  });
});