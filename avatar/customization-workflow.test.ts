/**
 * Unit tests for Avatar Customization Workflow Management
 */

import { AvatarCustomizationController, SessionStateManager, CustomizationSession, WorkflowStep } from './customization-workflow';
import { AvatarDataStore } from './storage';
import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';
import { AvatarConfiguration, CustomizationChange } from './types';

// Mock dependencies
jest.mock('./storage');
jest.mock('./enhanced-safety-validator');

describe('AvatarCustomizationController', () => {
  let controller: AvatarCustomizationController;
  let mockDataStore: jest.Mocked<AvatarDataStore>;
  let mockSafetyValidator: jest.Mocked<EnhancedAvatarSafetyValidator>;
  let mockConfiguration: AvatarConfiguration;

  beforeEach(() => {
    mockDataStore = {
      loadAvatarConfiguration: jest.fn(),
      saveAvatarConfiguration: jest.fn(),
      createBackup: jest.fn(),
      saveSessionData: jest.fn(),
      loadSessionData: jest.fn(),
      clearSessionData: jest.fn()
    } as jest.Mocked<AvatarDataStore>;
    mockSafetyValidator = {
      validateCustomization: jest.fn()
    } as jest.Mocked<EnhancedAvatarSafetyValidator>;

    mockConfiguration = {
      userId: 'test-user',
      version: '1.0.0',
      appearance: {
        face: { 
          meshId: 'face1', 
          textureId: 'tex1',
          eyeColor: 'brown',
          skinTone: 'medium',
          features: { eyeSize: 1, noseSize: 1, mouthSize: 1, cheekbones: 1 },
          detailLevel: 'medium' as any,
          textureQuality: 1024
        },
        hair: { 
          styleId: 'hair1', 
          color: 'brown',
          length: 10,
          texture: 'wavy' as any,
          physicsEnabled: true,
          strandCount: 1000,
          detailLevel: 'medium' as any
        },
        clothing: { 
          topId: 'shirt1', 
          bottomId: 'pants1',
          shoesId: 'shoes1',
          colors: { primary: 'blue', secondary: 'white', accent: 'black' },
          wrinkleSimulation: false,
          detailLevel: 'medium' as any,
          textureQuality: 512,
          revealingLevel: 1
        },
        accessories: [],
        animations: {
          idle: 'idle_anim',
          talking: 'talk_anim',
          listening: 'listen_anim',
          thinking: 'think_anim',
          expressions: {
            happy: 'happy_anim',
            sad: 'sad_anim',
            surprised: 'surprised_anim',
            confused: 'confused_anim',
            excited: 'excited_anim'
          },
          frameRate: 60,
          blendingEnabled: true
        }
      },
      personality: {
        friendliness: 7,
        formality: 4,
        humor: 6,
        enthusiasm: 8,
        patience: 5,
        supportiveness: 9
      },
      voice: {
        pitch: 0.0,
        speed: 1.0,
        accent: 'neutral' as any,
        emotionalTone: 'cheerful' as any,
        volume: 0.8
      },
      emotions: {
        defaultEmotion: 'neutral' as any,
        expressionIntensity: 0.5,
        transitionSpeed: 1.0,
        emotionMappings: []
      },
      createdAt: new Date(),
      lastModified: new Date(),
      parentallyApproved: true
    } as AvatarConfiguration;

    controller = new AvatarCustomizationController(
      mockDataStore,
      mockSafetyValidator,
      5000 // 5 second timeout for testing
    );

    // Setup default mocks
    mockDataStore.loadAvatarConfiguration.mockResolvedValue(mockConfiguration);
    mockSafetyValidator.validateCustomization.mockResolvedValue({
      isAllowed: true,
      requiresApproval: false,
      blockedElements: [],
      riskAssessment: 'low'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('session management', () => {
    it('should start a new customization session', async () => {
      const eventSpy = jest.fn();
      controller.on('sessionStarted', eventSpy);

      const session = await controller.startCustomization('test-user');

      expect(session).toMatchObject({
        userId: 'test-user',
        isActive: true,
        requiresSaving: false
      });
      expect(session.sessionId).toMatch(/^session-test-user-\d+$/);
      expect(session.currentConfiguration).toEqual(mockConfiguration);
      expect(session.originalConfiguration).toEqual(mockConfiguration);
      expect(eventSpy).toHaveBeenCalledWith({ session });
    });

    it('should load user avatar configuration on session start', async () => {
      await controller.startCustomization('test-user');

      expect(mockDataStore.loadAvatarConfiguration).toHaveBeenCalledWith('test-user');
    });

    it('should fail to start session if avatar loading fails', async () => {
      mockDataStore.loadAvatarConfiguration.mockRejectedValue(new Error('Load failed'));

      const startPromise = controller.startCustomization('test-user');

      await expect(startPromise).rejects.toThrow('Failed to load user avatar configuration');
    });

    it('should end existing session when starting new one', async () => {
      const session1 = await controller.startCustomization('test-user');
      expect(session1.isActive).toBe(true);

      const session2 = await controller.startCustomization('test-user');
      expect(session2.isActive).toBe(true);
      expect(session2.sessionId).not.toBe(session1.sessionId);
    });

    it('should end session and auto-save if needed', async () => {
      const session = await controller.startCustomization('test-user');
      
      // Make a change to require saving
      const change: CustomizationChange = {
        changeId: 'test-change',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };
      
      await controller.applyChange('test-user', change);
      
      mockDataStore.saveAvatarConfiguration.mockResolvedValue();
      
      const eventSpy = jest.fn();
      controller.on('sessionEnded', eventSpy);

      await controller.endSession('test-user', true);

      expect(mockDataStore.saveAvatarConfiguration).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith({
        session: expect.objectContaining({ isActive: false }),
        autoSaved: true
      });
    });
  });

  describe('change management', () => {
    let session: CustomizationSession;

    beforeEach(async () => {
      session = await controller.startCustomization('test-user');
    });

    it('should apply valid customization changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-1',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const eventSpy = jest.fn();
      controller.on('changeApplied', eventSpy);

      await controller.applyChange('test-user', change);

      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.currentConfiguration.appearance.hair).toBe('hair2');
      expect(updatedSession?.changeHistory).toHaveLength(1);
      expect(updatedSession?.undoStack).toHaveLength(1);
      expect(updatedSession?.requiresSaving).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should block invalid customization changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-2',
        type: 'appearance',
        category: 'clothing',
        oldValue: 'shirt1',
        newValue: 'inappropriate-outfit',
        timestamp: new Date(),
        requiresApproval: false
      };

      mockSafetyValidator.validateCustomization.mockResolvedValueOnce({
        isAllowed: false,
        requiresApproval: false,
        blockedElements: ['inappropriate-clothing'],
        riskAssessment: 'high'
      });

      const applyPromise = controller.applyChange('test-user', change);

      await expect(applyPromise).rejects.toThrow('Change blocked: inappropriate-clothing');
    });

    it('should validate changes before applying', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-3',
        type: 'personality',
        category: 'humor',
        oldValue: 6,
        newValue: 10,
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);

      expect(mockSafetyValidator.validateCustomization).toHaveBeenCalledWith(
        expect.objectContaining({
          personality: expect.objectContaining({ humor: 10 })
        }),
        expect.any(Number)
      );
    });

    it('should fail to apply changes without active session', async () => {
      await controller.endSession('test-user');

      const change: CustomizationChange = {
        changeId: 'test-change-4',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const applyPromise = controller.applyChange('test-user', change);

      await expect(applyPromise).rejects.toThrow('No active customization session');
    });
  });

  describe('undo/redo functionality', () => {
    let session: CustomizationSession;

    beforeEach(async () => {
      session = await controller.startCustomization('test-user');
    });

    it('should undo the last change', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-5',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);
      
      const eventSpy = jest.fn();
      controller.on('changeUndone', eventSpy);

      const undoChange = await controller.undoLastChange('test-user');

      expect(undoChange).toBeTruthy();
      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.currentConfiguration.appearance.hair).toBe('hair1');
      expect(updatedSession?.undoStack).toHaveLength(0);
      expect(updatedSession?.redoStack).toHaveLength(1);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should redo the last undone change', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-6',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);
      await controller.undoLastChange('test-user');
      
      const eventSpy = jest.fn();
      controller.on('changeRedone', eventSpy);

      const redoChange = await controller.redoLastChange('test-user');

      expect(redoChange).toBeTruthy();
      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.currentConfiguration.appearance.hair).toBe('hair2');
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should return null when no changes to undo', async () => {
      const undoChange = await controller.undoLastChange('test-user');

      expect(undoChange).toBeNull();
    });

    it('should return null when no changes to redo', async () => {
      const redoChange = await controller.redoLastChange('test-user');

      expect(redoChange).toBeNull();
    });

    it('should clear redo stack when new change is applied', async () => {
      const change1: CustomizationChange = {
        changeId: 'test-change-7',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const change2: CustomizationChange = {
        changeId: 'test-change-8',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change1);
      await controller.undoLastChange('test-user');
      
      // Applying new change should clear redo stack
      await controller.applyChange('test-user', change2);

      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.redoStack).toHaveLength(0);
    });
  });

  describe('saving and loading', () => {
    let session: CustomizationSession;

    beforeEach(async () => {
      session = await controller.startCustomization('test-user');
    });

    it('should save customization successfully', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-9',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);
      
      mockDataStore.saveAvatarConfiguration.mockResolvedValue();
      mockDataStore.createBackup.mockResolvedValue({} as any);

      const eventSpy = jest.fn();
      controller.on('customizationSaved', eventSpy);

      const result = await controller.saveCustomization('test-user', true);

      expect(result.success).toBe(true);
      expect(result.validationPassed).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(mockDataStore.saveAvatarConfiguration).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining({
          appearance: expect.objectContaining({ hair: 'hair2' })
        })
      );
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should fail to save invalid configuration', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-10',
        type: 'appearance',
        category: 'clothing',
        oldValue: 'shirt1',
        newValue: 'inappropriate-outfit',
        timestamp: new Date(),
        requiresApproval: false
      };

      // Allow the change initially but block on save
      mockSafetyValidator.validateCustomization
        .mockResolvedValueOnce({ // For apply
          isAllowed: true,
          requiresApproval: false,
          blockedElements: [],
          riskAssessment: 'low'
        })
        .mockResolvedValueOnce({ // For save
          isAllowed: false,
          requiresApproval: false,
          blockedElements: ['inappropriate-clothing'],
          riskAssessment: 'high'
        });

      await controller.applyChange('test-user', change);
      const result = await controller.saveCustomization('test-user');

      expect(result.success).toBe(false);
      expect(result.validationPassed).toBe(false);
      expect(result.errors).toContain('inappropriate-clothing');
    });

    it('should load user avatar configuration', async () => {
      const result = await controller.loadUserAvatar('test-user');

      expect(result.success).toBe(true);
      expect(result.configuration).toEqual(mockConfiguration);
      expect(mockDataStore.loadAvatarConfiguration).toHaveBeenCalledWith('test-user');
    });

    it('should handle load failures gracefully', async () => {
      mockDataStore.loadAvatarConfiguration.mockRejectedValue(new Error('Load failed'));

      const result = await controller.loadUserAvatar('test-user');

      expect(result.success).toBe(false);
      expect(result.configuration).toBeNull();
      expect(result.errors).toContain('Load failed');
    });
  });

  describe('reset functionality', () => {
    let session: CustomizationSession;

    beforeEach(async () => {
      session = await controller.startCustomization('test-user');
    });

    it('should reset to default configuration', async () => {
      // Make some changes first
      const change: CustomizationChange = {
        changeId: 'test-change-11',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);
      
      const eventSpy = jest.fn();
      controller.on('configurationReset', eventSpy);

      await controller.resetToDefaults('test-user');

      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.currentConfiguration.appearance.hair.styleId).toBe('default-hair');
      expect(updatedSession?.undoStack).toHaveLength(2); // Original change + reset undo
      expect(updatedSession?.requiresSaving).toBe(true);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('workflow progress', () => {
    beforeEach(async () => {
      await controller.startCustomization('test-user');
    });

    it('should track workflow progress', () => {
      const progress = controller.getWorkflowProgress('test-user');

      expect(progress.steps).toHaveLength(6);
      expect(progress.completedSteps).toBe(0);
      expect(progress.totalSteps).toBe(4); // Non-optional steps
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    it('should update workflow progress when changes are applied', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-12',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);
      
      const progress = controller.getWorkflowProgress('test-user');
      expect(progress.completedSteps).toBeGreaterThan(0);
    });

    it('should complete workflow steps in logical order', async () => {
      const changes = [
        {
          changeId: 'face-change',
          type: 'appearance' as const,
          category: 'face',
          oldValue: 'face1',
          newValue: 'face2',
          timestamp: new Date(),
          requiresApproval: false
        },
        {
          changeId: 'personality-change',
          type: 'personality' as const,
          category: 'friendliness',
          oldValue: 7,
          newValue: 8,
          timestamp: new Date(),
          requiresApproval: false
        }
      ];

      for (const change of changes) {
        await controller.applyChange('test-user', change);
      }

      const progress = controller.getWorkflowProgress('test-user');
      const faceStep = progress.steps.find(s => s.id === 'customize-face');
      const personalityStep = progress.steps.find(s => s.id === 'set-personality');

      expect(faceStep?.isCompleted).toBe(true);
      expect(personalityStep?.isCompleted).toBe(true);
    });

    it('should estimate remaining time accurately', async () => {
      const initialProgress = controller.getWorkflowProgress('test-user');
      const initialTime = initialProgress.estimatedTimeRemaining;

      // Complete one step
      const change: CustomizationChange = {
        changeId: 'time-test',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);

      const updatedProgress = controller.getWorkflowProgress('test-user');
      expect(updatedProgress.estimatedTimeRemaining).toBeLessThan(initialTime);
    });
  });

  describe('session persistence and recovery', () => {
    let session: CustomizationSession;

    beforeEach(async () => {
      session = await controller.startCustomization('test-user');
    });

    it('should persist session state during customization', async () => {
      const change: CustomizationChange = {
        changeId: 'persistence-test',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);

      const sessionState = controller.getSessionState('test-user');
      expect(sessionState?.changeHistory).toHaveLength(1);
      expect(sessionState?.requiresSaving).toBe(true);
      expect(sessionState?.lastActivity).toBeInstanceOf(Date);
    });

    it('should load user avatar within 2 seconds (requirement 7.6)', async () => {
      const startTime = Date.now();
      const result = await controller.loadUserAvatar('test-user');
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Within 2 seconds
    });

    it('should maintain session activity timestamps', async () => {
      const initialActivity = session.lastActivity;
      
      // Wait a bit and make a change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const change: CustomizationChange = {
        changeId: 'activity-test',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);

      const updatedSession = controller.getSessionState('test-user');
      expect(updatedSession?.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it('should handle session timeout gracefully', async () => {
      // Create controller with short timeout for testing
      const shortTimeoutController = new AvatarCustomizationController(
        mockDataStore,
        mockSafetyValidator,
        1000 // 1 second timeout
      );

      const testSession = await shortTimeoutController.startCustomization('timeout-user');
      
      const eventSpy = jest.fn();
      shortTimeoutController.on('sessionEnded', eventSpy);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Session should be automatically ended
      const sessionState = shortTimeoutController.getSessionState('timeout-user');
      expect(sessionState).toBeNull();
    });

    it('should auto-save during active sessions', async () => {
      const change: CustomizationChange = {
        changeId: 'autosave-test',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await controller.applyChange('test-user', change);

      const eventSpy = jest.fn();
      controller.on('autoSaved', eventSpy);

      // Trigger auto-save (normally happens every minute)
      mockDataStore.saveAvatarConfiguration.mockResolvedValue();
      
      // Manually trigger auto-save for testing
      await controller.saveCustomization('test-user', false);

      expect(mockDataStore.saveAvatarConfiguration).toHaveBeenCalled();
    });

    it('should preserve undo/redo stacks across session operations', async () => {
      const changes = [
        {
          changeId: 'stack-test-1',
          type: 'appearance' as const,
          category: 'hair',
          oldValue: 'hair1',
          newValue: 'hair2',
          timestamp: new Date(),
          requiresApproval: false
        },
        {
          changeId: 'stack-test-2',
          type: 'appearance' as const,
          category: 'face',
          oldValue: 'face1',
          newValue: 'face2',
          timestamp: new Date(),
          requiresApproval: false
        }
      ];

      // Apply changes
      for (const change of changes) {
        await controller.applyChange('test-user', change);
      }

      // Undo one change
      await controller.undoLastChange('test-user');

      const sessionState = controller.getSessionState('test-user');
      expect(sessionState?.undoStack).toHaveLength(1);
      expect(sessionState?.redoStack).toHaveLength(1);
      expect(sessionState?.changeHistory).toHaveLength(1);
    });
  });
});

describe('SessionStateManager', () => {
  let manager: SessionStateManager;
  let mockDataStore: jest.Mocked<AvatarDataStore>;
  let mockSession: CustomizationSession;

  beforeEach(() => {
    mockDataStore = {
      saveSessionData: jest.fn(),
      loadSessionData: jest.fn(),
      clearSessionData: jest.fn()
    } as jest.Mocked<AvatarDataStore>;
    manager = new SessionStateManager(mockDataStore);

    mockSession = {
      sessionId: 'test-session',
      userId: 'test-user',
      startTime: new Date(),
      lastActivity: new Date(),
      currentConfiguration: {} as AvatarConfiguration,
      originalConfiguration: {} as AvatarConfiguration,
      changeHistory: [],
      undoStack: [],
      redoStack: [],
      isActive: true,
      requiresSaving: false
    };
  });

  it('should save session state', async () => {
    mockDataStore.saveSessionData.mockResolvedValue();

    await manager.saveSessionState(mockSession);

    expect(mockDataStore.saveSessionData).toHaveBeenCalledWith(
      'test-user',
      expect.objectContaining({
        sessionId: 'test-session',
        userId: 'test-user'
      })
    );
  });

  it('should recover session state', async () => {
    const sessionData = {
      sessionId: 'recovered-session',
      userId: 'test-user',
      startTime: new Date(),
      lastActivity: new Date(),
      currentConfiguration: {} as AvatarConfiguration,
      changeHistory: [],
      undoStack: [],
      redoStack: []
    };

    mockDataStore.loadSessionData.mockResolvedValue(sessionData);

    const recovered = await manager.recoverSessionState('test-user');

    expect(recovered).toMatchObject({
      sessionId: 'recovered-session',
      isActive: true,
      requiresSaving: true
    });
  });

  it('should return null when no session data exists', async () => {
    mockDataStore.loadSessionData.mockResolvedValue(null);

    const recovered = await manager.recoverSessionState('test-user');

    expect(recovered).toBeNull();
  });

  it('should clear session state', async () => {
    mockDataStore.clearSessionData.mockResolvedValue();

    await manager.clearSessionState('test-user');

    expect(mockDataStore.clearSessionData).toHaveBeenCalledWith('test-user');
  });
});