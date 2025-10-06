/**
 * Avatar Customization Workflow Management
 * 
 * Orchestrates customization workflows, manages sessions, and provides
 * undo/redo functionality with state persistence and user feedback.
 */

import { EventEmitter } from 'events';
import { AvatarConfiguration, CustomizationChange } from './types';
import { AvatarDataStore } from './storage';
import { AvatarSafetyValidator } from './enhanced-safety-validator';

export interface CustomizationSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  currentConfiguration: AvatarConfiguration;
  originalConfiguration: AvatarConfiguration;
  changeHistory: CustomizationChange[];
  undoStack: CustomizationChange[];
  redoStack: CustomizationChange[];
  isActive: boolean;
  requiresSaving: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  category: 'appearance' | 'personality' | 'voice' | 'review';
  isCompleted: boolean;
  isOptional: boolean;
  estimatedTime: number; // minutes
}

export interface SaveResult {
  success: boolean;
  savedAt: Date;
  backupCreated: boolean;
  validationPassed: boolean;
  errors: string[];
}

export interface LoadResult {
  success: boolean;
  configuration: AvatarConfiguration | null;
  lastModified: Date | null;
  requiresMigration: boolean;
  errors: string[];
}

/**
 * Main workflow controller for avatar customization
 */
export class AvatarCustomizationController extends EventEmitter {
  private dataStore: AvatarDataStore;
  private safetyValidator: AvatarSafetyValidator;
  private activeSessions: Map<string, CustomizationSession>;
  private workflowSteps: WorkflowStep[];
  private autoSaveInterval: NodeJS.Timeout | null;
  private sessionTimeout: number; // milliseconds

  constructor(
    dataStore: AvatarDataStore,
    safetyValidator: AvatarSafetyValidator,
    sessionTimeout: number = 30 * 60 * 1000 // 30 minutes default
  ) {
    super();
    this.dataStore = dataStore;
    this.safetyValidator = safetyValidator;
    this.activeSessions = new Map();
    this.workflowSteps = this.initializeWorkflowSteps();
    this.autoSaveInterval = null;
    this.sessionTimeout = sessionTimeout;

    this.startSessionCleanup();
  }

  /**
   * Start a new customization session
   */
  async startCustomization(userId: string): Promise<CustomizationSession> {
    try {
      // End any existing session for this user
      await this.endSession(userId);

      // Load user's current avatar configuration
      const loadResult = await this.loadUserAvatar(userId);
      if (!loadResult.success || !loadResult.configuration) {
        throw new Error('Failed to load user avatar configuration');
      }

      // Create new session
      const session: CustomizationSession = {
        sessionId: `session-${userId}-${Date.now()}`,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        currentConfiguration: { ...loadResult.configuration },
        originalConfiguration: { ...loadResult.configuration },
        changeHistory: [],
        undoStack: [],
        redoStack: [],
        isActive: true,
        requiresSaving: false
      };

      this.activeSessions.set(userId, session);

      // Start auto-save for this session
      this.startAutoSave(session);

      this.emit('sessionStarted', { session });
      return session;

    } catch (error) {
      this.emit('sessionError', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Apply a customization change to the current session
   */
  async applyChange(userId: string, change: CustomizationChange): Promise<void> {
    const session = this.getActiveSession(userId);
    if (!session) {
      throw new Error('No active customization session');
    }

    try {
      // Validate the change
      const newConfiguration = this.applyChangeToConfiguration(change, session.currentConfiguration);
      const validationResult = await this.safetyValidator.validateCustomization(
        newConfiguration,
        this.getUserAge(userId)
      );

      if (!validationResult.isAllowed) {
        throw new Error(`Change blocked: ${validationResult.blockedElements.join(', ')}`);
      }

      // Clear redo stack when new change is applied
      session.redoStack = [];

      // Add current state to undo stack
      const undoChange: CustomizationChange = {
        changeId: `undo-${change.changeId}`,
        type: change.type,
        category: change.category,
        oldValue: change.newValue,
        newValue: change.oldValue,
        timestamp: new Date(),
        requiresApproval: change.requiresApproval
      };
      session.undoStack.push(undoChange);

      // Apply the change
      session.currentConfiguration = newConfiguration;
      session.changeHistory.push(change);
      session.lastActivity = new Date();
      session.requiresSaving = true;

      // Update workflow progress
      this.updateWorkflowProgress(session, change);

      this.emit('changeApplied', { session, change, validationResult });

    } catch (error) {
      this.emit('changeError', { userId, change, error: error.message });
      throw error;
    }
  }

  /**
   * Undo the last change
   */
  async undoLastChange(userId: string): Promise<CustomizationChange | null> {
    const session = this.getActiveSession(userId);
    if (!session || session.undoStack.length === 0) {
      return null;
    }

    try {
      const undoChange = session.undoStack.pop()!;
      
      // Apply the undo change
      const newConfiguration = this.applyChangeToConfiguration(undoChange, session.currentConfiguration);
      
      // Validate the undo operation
      const validationResult = await this.safetyValidator.validateCustomization(
        newConfiguration,
        this.getUserAge(userId)
      );

      if (!validationResult.isAllowed) {
        // Put the change back if undo would create invalid state
        session.undoStack.push(undoChange);
        throw new Error('Cannot undo: would create invalid configuration');
      }

      // Move the original change to redo stack
      const originalChange = session.changeHistory.pop();
      if (originalChange) {
        session.redoStack.push(originalChange);
      }

      session.currentConfiguration = newConfiguration;
      session.lastActivity = new Date();
      session.requiresSaving = true;

      this.emit('changeUndone', { session, undoChange });
      return undoChange;

    } catch (error) {
      this.emit('undoError', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Redo the last undone change
   */
  async redoLastChange(userId: string): Promise<CustomizationChange | null> {
    const session = this.getActiveSession(userId);
    if (!session || session.redoStack.length === 0) {
      return null;
    }

    try {
      const redoChange = session.redoStack.pop()!;
      
      // Apply the redo change
      await this.applyChange(userId, redoChange);

      this.emit('changeRedone', { session, redoChange });
      return redoChange;

    } catch (error) {
      this.emit('redoError', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Save current customization state
   */
  async saveCustomization(userId: string, createBackup: boolean = true): Promise<SaveResult> {
    const session = this.getActiveSession(userId);
    if (!session) {
      throw new Error('No active customization session');
    }

    try {
      // Final validation before saving
      const validationResult = await this.safetyValidator.validateCustomization(
        session.currentConfiguration,
        this.getUserAge(userId)
      );

      if (!validationResult.isAllowed) {
        return {
          success: false,
          savedAt: new Date(),
          backupCreated: false,
          validationPassed: false,
          errors: validationResult.blockedElements
        };
      }

      // Create backup if requested
      let backupCreated = false;
      if (createBackup) {
        try {
          await this.dataStore.createBackup(userId);
          backupCreated = true;
        } catch (backupError) {
          // Continue with save even if backup fails
          this.emit('backupError', { userId, error: backupError.message });
        }
      }

      // Save the configuration
      await this.dataStore.saveAvatarConfiguration(userId, session.currentConfiguration);
      
      // Update session state
      session.originalConfiguration = { ...session.currentConfiguration };
      session.requiresSaving = false;

      const result: SaveResult = {
        success: true,
        savedAt: new Date(),
        backupCreated,
        validationPassed: true,
        errors: []
      };

      this.emit('customizationSaved', { session, result });
      return result;

    } catch (error) {
      const result: SaveResult = {
        success: false,
        savedAt: new Date(),
        backupCreated: false,
        validationPassed: false,
        errors: [error.message]
      };

      this.emit('saveError', { userId, error: error.message, result });
      return result;
    }
  }

  /**
   * Load user avatar configuration
   */
  async loadUserAvatar(userId: string): Promise<LoadResult> {
    try {
      const configuration = await this.dataStore.loadAvatarConfiguration(userId);
      
      return {
        success: true,
        configuration,
        lastModified: configuration.lastModified,
        requiresMigration: false,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        configuration: null,
        lastModified: null,
        requiresMigration: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults(userId: string): Promise<void> {
    const session = this.getActiveSession(userId);
    if (!session) {
      throw new Error('No active customization session');
    }

    try {
      const defaultConfig = await this.getDefaultConfiguration(userId);
      
      // Create a change record for the reset
      const resetChange: CustomizationChange = {
        changeId: `reset-${Date.now()}`,
        type: 'appearance',
        category: 'full-reset',
        oldValue: session.currentConfiguration,
        newValue: defaultConfig,
        timestamp: new Date(),
        requiresApproval: false
      };

      // Add current state to undo stack
      session.undoStack.push({
        changeId: `undo-reset-${Date.now()}`,
        type: 'appearance',
        category: 'full-reset',
        oldValue: defaultConfig,
        newValue: session.currentConfiguration,
        timestamp: new Date(),
        requiresApproval: false
      });

      session.currentConfiguration = defaultConfig;
      session.changeHistory.push(resetChange);
      session.redoStack = [];
      session.lastActivity = new Date();
      session.requiresSaving = true;

      this.emit('configurationReset', { session, defaultConfig });

    } catch (error) {
      this.emit('resetError', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * End customization session
   */
  async endSession(userId: string, autoSave: boolean = true): Promise<void> {
    const session = this.activeSessions.get(userId);
    if (!session) return;

    try {
      // Auto-save if there are unsaved changes
      if (autoSave && session.requiresSaving) {
        await this.saveCustomization(userId);
      }

      // Clean up session
      session.isActive = false;
      this.activeSessions.delete(userId);

      this.emit('sessionEnded', { session, autoSaved: autoSave && session.requiresSaving });

    } catch (error) {
      this.emit('sessionError', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get current session state
   */
  getSessionState(userId: string): CustomizationSession | null {
    return this.activeSessions.get(userId) || null;
  }

  /**
   * Get workflow progress
   */
  getWorkflowProgress(userId: string): {
    steps: WorkflowStep[];
    completedSteps: number;
    totalSteps: number;
    estimatedTimeRemaining: number;
  } {
    const completedSteps = this.workflowSteps.filter(step => step.isCompleted).length;
    const remainingSteps = this.workflowSteps.filter(step => !step.isCompleted && !step.isOptional);
    const estimatedTimeRemaining = remainingSteps.reduce((total, step) => total + step.estimatedTime, 0);

    return {
      steps: [...this.workflowSteps],
      completedSteps,
      totalSteps: this.workflowSteps.filter(step => !step.isOptional).length,
      estimatedTimeRemaining
    };
  }

  private getActiveSession(userId: string): CustomizationSession | null {
    const session = this.activeSessions.get(userId);
    if (!session || !session.isActive) {
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    return session;
  }

  private applyChangeToConfiguration(
    change: CustomizationChange,
    config: AvatarConfiguration
  ): AvatarConfiguration {
    const newConfig = { ...config };
    
    switch (change.type) {
      case 'appearance':
        if (change.category === 'full-reset') {
          newConfig.appearance = change.newValue.appearance;
        } else {
          newConfig.appearance = { 
            ...newConfig.appearance, 
            [change.category]: change.newValue 
          };
        }
        break;
      case 'personality':
        newConfig.personality = { 
          ...newConfig.personality, 
          [change.category]: change.newValue 
        };
        break;
      case 'voice':
        newConfig.voice = { 
          ...newConfig.voice, 
          [change.category]: change.newValue 
        };
        break;
    }
    
    newConfig.lastModified = new Date();
    return newConfig;
  }

  private updateWorkflowProgress(session: CustomizationSession, change: CustomizationChange): void {
    // Mark relevant workflow steps as completed based on the change
    const stepMap = {
      'appearance': ['customize-face', 'customize-hair', 'customize-clothing'],
      'personality': ['set-personality'],
      'voice': ['configure-voice']
    };

    const relevantSteps = stepMap[change.type] || [];
    relevantSteps.forEach(stepId => {
      const step = this.workflowSteps.find(s => s.id === stepId);
      if (step) {
        step.isCompleted = true;
      }
    });
  }

  private initializeWorkflowSteps(): WorkflowStep[] {
    return [
      {
        id: 'customize-face',
        name: 'Choose Face',
        description: 'Select your avatar\'s facial features',
        category: 'appearance',
        isCompleted: false,
        isOptional: false,
        estimatedTime: 3
      },
      {
        id: 'customize-hair',
        name: 'Style Hair',
        description: 'Pick a hairstyle and color',
        category: 'appearance',
        isCompleted: false,
        isOptional: false,
        estimatedTime: 2
      },
      {
        id: 'customize-clothing',
        name: 'Choose Outfit',
        description: 'Select clothing and accessories',
        category: 'appearance',
        isCompleted: false,
        isOptional: true,
        estimatedTime: 4
      },
      {
        id: 'set-personality',
        name: 'Set Personality',
        description: 'Configure personality traits',
        category: 'personality',
        isCompleted: false,
        isOptional: false,
        estimatedTime: 5
      },
      {
        id: 'configure-voice',
        name: 'Voice Settings',
        description: 'Customize voice characteristics',
        category: 'voice',
        isCompleted: false,
        isOptional: true,
        estimatedTime: 3
      },
      {
        id: 'review-avatar',
        name: 'Review & Save',
        description: 'Review your avatar and save changes',
        category: 'review',
        isCompleted: false,
        isOptional: false,
        estimatedTime: 2
      }
    ];
  }

  private startAutoSave(session: CustomizationSession): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(async () => {
      if (session.isActive && session.requiresSaving) {
        try {
          await this.saveCustomization(session.userId, false); // No backup for auto-save
          this.emit('autoSaved', { session });
        } catch (error) {
          this.emit('autoSaveError', { session, error: error.message });
        }
      }
    }, 60000); // Auto-save every minute
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [userId, session] of this.activeSessions.entries()) {
        const timeSinceActivity = now - session.lastActivity.getTime();
        
        if (timeSinceActivity > this.sessionTimeout) {
          this.endSession(userId, true).catch(error => {
            this.emit('sessionCleanupError', { userId, error: error.message });
          });
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private getUserAge(userId: string): number {
    // This would integrate with user profile system
    // For now, return a default age
    return 10;
  }

  private async getDefaultConfiguration(userId: string): Promise<AvatarConfiguration> {
    // This would return age-appropriate default configuration
    // For now, return a mock default
    return {
      userId,
      version: '1.0.0',
      appearance: {
        face: { id: 'default-face', name: 'Friendly Face' },
        hair: { id: 'default-hair', name: 'Short Hair', color: 'brown' },
        clothing: { id: 'default-shirt', name: 'Blue Shirt' },
        accessories: []
      },
      personality: {
        friendliness: 7,
        formality: 5,
        humor: 6,
        enthusiasm: 7,
        patience: 8,
        supportiveness: 9
      },
      voice: {
        pitch: 0.0,
        speed: 1.0,
        accent: 'neutral',
        emotionalTone: 'friendly',
        volume: 0.8
      },
      emotions: {},
      createdAt: new Date(),
      lastModified: new Date(),
      parentallyApproved: true
    } as AvatarConfiguration;
  }
}

/**
 * Session state persistence manager
 */
export class SessionStateManager {
  private dataStore: AvatarDataStore;

  constructor(dataStore: AvatarDataStore) {
    this.dataStore = dataStore;
  }

  /**
   * Save session state for recovery
   */
  async saveSessionState(session: CustomizationSession): Promise<void> {
    const sessionData = {
      sessionId: session.sessionId,
      userId: session.userId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      currentConfiguration: session.currentConfiguration,
      changeHistory: session.changeHistory,
      undoStack: session.undoStack,
      redoStack: session.redoStack
    };

    // Save to temporary session storage
    await this.dataStore.saveSessionData(session.userId, sessionData);
  }

  /**
   * Recover session state after interruption
   */
  async recoverSessionState(userId: string): Promise<CustomizationSession | null> {
    try {
      const sessionData = await this.dataStore.loadSessionData(userId);
      if (!sessionData) return null;

      return {
        ...sessionData,
        isActive: true,
        requiresSaving: true
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Clear session state
   */
  async clearSessionState(userId: string): Promise<void> {
    await this.dataStore.clearSessionData(userId);
  }
}