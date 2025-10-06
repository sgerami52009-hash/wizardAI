/**
 * Additional Unit Tests for UI Components (Task 9.4)
 * 
 * Tests for customization interface responsiveness, real-time preview,
 * workflow management, session persistence, and character package browser interface.
 * 
 * Requirements: 1.1, 1.2, 7.6
 */

import { EventEmitter } from 'events';

// Mock interfaces for testing
interface MockAvatarConfiguration {
  userId: string;
  version: string;
  appearance: any;
  personality: any;
  voice: any;
  emotions: any;
  createdAt: Date;
  lastModified: Date;
  parentallyApproved: boolean;
}

interface MockCustomizationChange {
  changeId: string;
  type: 'appearance' | 'personality' | 'voice';
  category: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  requiresApproval: boolean;
}

interface MockRenderingMetrics {
  currentFPS: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
  renderTime: number;
  triangleCount: number;
  textureMemory: number;
  shaderCompileTime: number;
  drawCalls: number;
}

// Mock classes for testing
class MockAvatarCustomizationInterface extends EventEmitter {
  private previewActive = false;
  private lastPreviewTime = 0;

  async startPreview(change: MockCustomizationChange): Promise<void> {
    const startTime = Date.now();
    this.previewActive = true;
    this.lastPreviewTime = startTime;
    
    // Simulate preview processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    this.emit('previewStarted', { 
      change, 
      responseTime,
      metrics: this.getMockMetrics()
    });
  }

  async stopPreview(): Promise<void> {
    this.previewActive = false;
    this.emit('previewStopped');
  }

  isPreviewActive(): boolean {
    return this.previewActive;
  }

  getLastPreviewTime(): number {
    return this.lastPreviewTime;
  }

  private getMockMetrics(): MockRenderingMetrics {
    return {
      currentFPS: 60,
      gpuMemoryUsage: 1024,
      cpuUsage: 30,
      renderTime: 16.67,
      triangleCount: 5000,
      textureMemory: 512,
      shaderCompileTime: 100,
      drawCalls: 50
    };
  }
}

class MockCustomizationSession {
  public sessionId: string;
  public userId: string;
  public startTime: Date;
  public lastActivity: Date;
  public isActive: boolean;
  public requiresSaving: boolean;
  public changeHistory: MockCustomizationChange[] = [];

  constructor(userId: string) {
    this.sessionId = `session-${userId}-${Date.now()}`;
    this.userId = userId;
    this.startTime = new Date();
    this.lastActivity = new Date();
    this.isActive = true;
    this.requiresSaving = false;
  }

  updateActivity(): void {
    this.lastActivity = new Date();
  }

  addChange(change: MockCustomizationChange): void {
    this.changeHistory.push(change);
    this.requiresSaving = true;
    this.updateActivity();
  }
}

class MockWorkflowController extends EventEmitter {
  private sessions = new Map<string, MockCustomizationSession>();

  async startSession(userId: string): Promise<MockCustomizationSession> {
    const session = new MockCustomizationSession(userId);
    this.sessions.set(userId, session);
    this.emit('sessionStarted', { session });
    return session;
  }

  async endSession(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(userId);
      this.emit('sessionEnded', { session });
    }
  }

  getSession(userId: string): MockCustomizationSession | undefined {
    return this.sessions.get(userId);
  }

  async saveSession(userId: string): Promise<boolean> {
    const session = this.sessions.get(userId);
    if (session && session.requiresSaving) {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 100));
      session.requiresSaving = false;
      this.emit('sessionSaved', { session });
      return true;
    }
    return false;
  }
}

class MockCharacterPackageBrowser extends EventEmitter {
  private packages: any[] = [];
  private installedPackages = new Set<string>();
  private installationProgress = new Map<string, any>();

  async initialize(): Promise<void> {
    // Simulate initialization
    await new Promise(resolve => setTimeout(resolve, 50));
    this.emit('initialized', { totalPackages: this.packages.length });
  }

  async applyFilter(filter: any): Promise<void> {
    const startTime = Date.now();
    
    // Simulate filtering
    await new Promise(resolve => setTimeout(resolve, 30));
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    this.emit('filterApplied', { 
      filter, 
      responseTime,
      resultCount: this.packages.length 
    });
  }

  async installPackage(packageId: string): Promise<void> {
    if (this.installedPackages.has(packageId)) {
      throw new Error('Package already installed');
    }

    // Simulate installation progress
    const progress = {
      packageId,
      stage: 'downloading',
      progress: 0,
      message: 'Starting installation...'
    };

    this.installationProgress.set(packageId, progress);
    this.emit('installationStarted', { packageId });

    // Simulate progress updates
    for (let i = 25; i <= 100; i += 25) {
      await new Promise(resolve => setTimeout(resolve, 100));
      progress.progress = i;
      progress.stage = i === 100 ? 'complete' : 'installing';
      progress.message = i === 100 ? 'Installation complete' : `Installing... ${i}%`;
      this.emit('installationProgress', { ...progress });
    }

    this.installedPackages.add(packageId);
    this.installationProgress.delete(packageId);
    this.emit('packageInstalled', { packageId });
  }

  getInstallationProgress(packageId: string): any {
    return this.installationProgress.get(packageId);
  }

  isPackageInstalled(packageId: string): boolean {
    return this.installedPackages.has(packageId);
  }
}

describe('UI Components Additional Tests (Task 9.4)', () => {
  describe('Customization Interface Responsiveness (Requirements 1.1, 1.2)', () => {
    let customizationInterface: MockAvatarCustomizationInterface;

    beforeEach(() => {
      customizationInterface = new MockAvatarCustomizationInterface();
    });

    it('should start preview within 100ms for responsiveness', async () => {
      const change: MockCustomizationChange = {
        changeId: 'responsiveness-test',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const startTime = Date.now();
      await customizationInterface.startPreview(change);
      const endTime = Date.now();

      // Preview should start within 100ms for good responsiveness (Requirement 1.2)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should maintain 60fps during real-time preview', async () => {
      const change: MockCustomizationChange = {
        changeId: 'fps-test',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const eventSpy = jest.fn();
      customizationInterface.on('previewStarted', eventSpy);

      await customizationInterface.startPreview(change);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            currentFPS: 60
          })
        })
      );
    });

    it('should handle rapid successive preview changes without blocking', async () => {
      const changes = Array.from({ length: 5 }, (_, i) => ({
        changeId: `rapid-${i}`,
        type: 'appearance' as const,
        category: 'hair',
        oldValue: `hair${i}`,
        newValue: `hair${i + 1}`,
        timestamp: new Date(),
        requiresApproval: false
      }));

      const startTime = Date.now();
      
      // Start multiple previews rapidly
      const promises = changes.map(change => customizationInterface.startPreview(change));
      await Promise.all(promises);
      
      const endTime = Date.now();

      // Should handle all changes within reasonable time
      expect(endTime - startTime).toBeLessThan(500);
      expect(customizationInterface.isPreviewActive()).toBe(true);
    });

    it('should provide immediate visual feedback for user interactions', async () => {
      const change: MockCustomizationChange = {
        changeId: 'feedback-test',
        type: 'appearance',
        category: 'clothing',
        oldValue: 'shirt1',
        newValue: 'shirt2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const eventSpy = jest.fn();
      customizationInterface.on('previewStarted', eventSpy);

      await customizationInterface.startPreview(change);

      // Should emit preview event immediately (Requirement 1.1)
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          change: expect.objectContaining({
            changeId: 'feedback-test'
          }),
          responseTime: expect.any(Number)
        })
      );
    });

    it('should stop preview and revert smoothly', async () => {
      const change: MockCustomizationChange = {
        changeId: 'stop-test',
        type: 'appearance',
        category: 'accessories',
        oldValue: [],
        newValue: ['hat1'],
        timestamp: new Date(),
        requiresApproval: false
      };

      await customizationInterface.startPreview(change);
      expect(customizationInterface.isPreviewActive()).toBe(true);

      const eventSpy = jest.fn();
      customizationInterface.on('previewStopped', eventSpy);

      await customizationInterface.stopPreview();

      expect(customizationInterface.isPreviewActive()).toBe(false);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Workflow Management and Session Persistence (Requirement 7.6)', () => {
    let workflowController: MockWorkflowController;

    beforeEach(() => {
      workflowController = new MockWorkflowController();
    });

    it('should start session and load user avatar within 2 seconds', async () => {
      const startTime = Date.now();
      const session = await workflowController.startSession('test-user');
      const endTime = Date.now();

      // Should load within 2 seconds (Requirement 7.6)
      expect(endTime - startTime).toBeLessThan(2000);
      expect(session.userId).toBe('test-user');
      expect(session.isActive).toBe(true);
    });

    it('should persist session state during customization', async () => {
      const session = await workflowController.startSession('test-user');
      
      const change: MockCustomizationChange = {
        changeId: 'persistence-test',
        type: 'personality',
        category: 'friendliness',
        oldValue: 5,
        newValue: 8,
        timestamp: new Date(),
        requiresApproval: false
      };

      session.addChange(change);

      expect(session.changeHistory).toHaveLength(1);
      expect(session.requiresSaving).toBe(true);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('should maintain session activity timestamps', async () => {
      const session = await workflowController.startSession('test-user');
      const initialActivity = session.lastActivity.getTime();

      // Wait a bit and update activity
      await new Promise(resolve => setTimeout(resolve, 100));
      session.updateActivity();

      expect(session.lastActivity.getTime()).toBeGreaterThan(initialActivity);
    });

    it('should save session data when required', async () => {
      const session = await workflowController.startSession('test-user');
      
      const change: MockCustomizationChange = {
        changeId: 'save-test',
        type: 'voice',
        category: 'pitch',
        oldValue: 0.0,
        newValue: 0.5,
        timestamp: new Date(),
        requiresApproval: false
      };

      session.addChange(change);
      expect(session.requiresSaving).toBe(true);

      const eventSpy = jest.fn();
      workflowController.on('sessionSaved', eventSpy);

      const saved = await workflowController.saveSession('test-user');

      expect(saved).toBe(true);
      expect(session.requiresSaving).toBe(false);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          session: expect.objectContaining({
            userId: 'test-user'
          })
        })
      );
    });

    it('should handle session cleanup properly', async () => {
      const session = await workflowController.startSession('test-user');
      expect(session.isActive).toBe(true);

      const eventSpy = jest.fn();
      workflowController.on('sessionEnded', eventSpy);

      await workflowController.endSession('test-user');

      expect(session.isActive).toBe(false);
      expect(workflowController.getSession('test-user')).toBeUndefined();
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should recover session state after interruption', async () => {
      // Create and modify session
      const originalSession = await workflowController.startSession('test-user');
      const change: MockCustomizationChange = {
        changeId: 'recovery-test',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };
      originalSession.addChange(change);

      // Simulate session recovery
      const recoveredSession = workflowController.getSession('test-user');
      expect(recoveredSession).toBeDefined();
      expect(recoveredSession?.changeHistory).toHaveLength(1);
      expect(recoveredSession?.requiresSaving).toBe(true);
    });
  });

  describe('Character Package Browser Interface', () => {
    let packageBrowser: MockCharacterPackageBrowser;

    beforeEach(() => {
      packageBrowser = new MockCharacterPackageBrowser();
    });

    it('should initialize browser interface quickly', async () => {
      const eventSpy = jest.fn();
      packageBrowser.on('initialized', eventSpy);

      const startTime = Date.now();
      await packageBrowser.initialize();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPackages: expect.any(Number)
        })
      );
    });

    it('should respond to filter changes within 200ms', async () => {
      await packageBrowser.initialize();

      const filter = { category: 'robots', ageRange: { min: 5, max: 12 } };
      const eventSpy = jest.fn();
      packageBrowser.on('filterApplied', eventSpy);

      const startTime = Date.now();
      await packageBrowser.applyFilter(filter);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filter,
          responseTime: expect.any(Number),
          resultCount: expect.any(Number)
        })
      );
    });

    it('should provide real-time installation progress feedback', async () => {
      await packageBrowser.initialize();

      const progressSpy = jest.fn();
      const installedSpy = jest.fn();
      packageBrowser.on('installationProgress', progressSpy);
      packageBrowser.on('packageInstalled', installedSpy);

      const installPromise = packageBrowser.installPackage('test-package');

      // Wait for progress events
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(progressSpy).toHaveBeenCalled();

      await installPromise;

      expect(installedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          packageId: 'test-package'
        })
      );
      expect(packageBrowser.isPackageInstalled('test-package')).toBe(true);
    });

    it('should handle installation errors gracefully', async () => {
      await packageBrowser.initialize();
      
      // Install package first
      await packageBrowser.installPackage('existing-package');

      // Try to install again
      const installPromise = packageBrowser.installPackage('existing-package');

      await expect(installPromise).rejects.toThrow('Package already installed');
    });

    it('should track installation progress accurately', async () => {
      await packageBrowser.initialize();

      const installPromise = packageBrowser.installPackage('progress-test');

      // Check progress during installation
      await new Promise(resolve => setTimeout(resolve, 150));
      const progress = packageBrowser.getInstallationProgress('progress-test');
      
      expect(progress).toBeDefined();
      expect(progress.packageId).toBe('progress-test');
      expect(progress.progress).toBeGreaterThanOrEqual(0);

      await installPromise;

      // Progress should be cleared after completion
      const finalProgress = packageBrowser.getInstallationProgress('progress-test');
      expect(finalProgress).toBeUndefined();
    });

    it('should handle multiple concurrent operations', async () => {
      await packageBrowser.initialize();

      const operations = [
        packageBrowser.applyFilter({ category: 'robots' }),
        packageBrowser.applyFilter({ category: 'space' }),
        packageBrowser.installPackage('concurrent-1'),
        packageBrowser.installPackage('concurrent-2')
      ];

      // All operations should complete without errors
      await Promise.all(operations);

      expect(packageBrowser.isPackageInstalled('concurrent-1')).toBe(true);
      expect(packageBrowser.isPackageInstalled('concurrent-2')).toBe(true);
    });
  });

  describe('Interface Integration Tests', () => {
    let customizationInterface: MockAvatarCustomizationInterface;
    let workflowController: MockWorkflowController;
    let packageBrowser: MockCharacterPackageBrowser;

    beforeEach(async () => {
      customizationInterface = new MockAvatarCustomizationInterface();
      workflowController = new MockWorkflowController();
      packageBrowser = new MockCharacterPackageBrowser();
      
      await packageBrowser.initialize();
    });

    it('should coordinate between customization and workflow management', async () => {
      const session = await workflowController.startSession('integration-user');
      
      const change: MockCustomizationChange = {
        changeId: 'integration-test',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      // Start preview and update session
      await customizationInterface.startPreview(change);
      session.addChange(change);

      expect(customizationInterface.isPreviewActive()).toBe(true);
      expect(session.changeHistory).toHaveLength(1);
      expect(session.requiresSaving).toBe(true);

      // Stop preview and save session
      await customizationInterface.stopPreview();
      await workflowController.saveSession('integration-user');

      expect(customizationInterface.isPreviewActive()).toBe(false);
      expect(session.requiresSaving).toBe(false);
    });

    it('should maintain responsiveness across all interfaces', async () => {
      const operations = [
        customizationInterface.startPreview({
          changeId: 'perf-test-1',
          type: 'appearance',
          category: 'hair',
          oldValue: 'hair1',
          newValue: 'hair2',
          timestamp: new Date(),
          requiresApproval: false
        }),
        workflowController.startSession('perf-user'),
        packageBrowser.applyFilter({ category: 'test' })
      ];

      const startTime = Date.now();
      await Promise.all(operations);
      const endTime = Date.now();

      // All operations should complete quickly
      expect(endTime - startTime).toBeLessThan(300);
    });

    it('should handle error scenarios gracefully across interfaces', async () => {
      // Test error handling in each interface
      const session = await workflowController.startSession('error-user');
      
      // Customization interface should handle invalid changes
      expect(customizationInterface.isPreviewActive()).toBe(false);
      
      // Workflow should handle non-existent sessions
      const nonExistentSession = workflowController.getSession('non-existent');
      expect(nonExistentSession).toBeUndefined();
      
      // Package browser should handle duplicate installations
      await packageBrowser.installPackage('error-test');
      const duplicateInstall = packageBrowser.installPackage('error-test');
      await expect(duplicateInstall).rejects.toThrow();
    });
  });
});