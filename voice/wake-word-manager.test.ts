/**
 * Wake Word Manager Unit Tests
 * Tests wake word management, training data validation, and runtime operations
 * Safety: Validates content filtering and secure data handling
 * Performance: Tests model loading and memory management
 */

import { WakeWordManager, WakeWordProfile, TrainingDataSet } from './wake-word-manager';
import { WakeWordDetectorImpl } from './wake-word-detector';
import { ContentSafetyFilter, SafetyResult } from '../safety/interfaces';
import { voiceEventBus, VoiceEventTypes } from './event-bus';

// Mock dependencies
jest.mock('./wake-word-detector');
jest.mock('../safety/interfaces');

describe('WakeWordManager', () => {
  let manager: WakeWordManager;
  let mockDetector: jest.Mocked<WakeWordDetectorImpl>;
  let mockSafetyFilter: jest.Mocked<ContentSafetyFilter>;

  beforeEach(() => {
    mockDetector = new WakeWordDetectorImpl() as jest.Mocked<WakeWordDetectorImpl>;
    mockSafetyFilter = {
      validateInput: jest.fn(),
      validateOutput: jest.fn(),
      updateFilterRules: jest.fn(),
      getAuditLog: jest.fn(),
      validateChildSafeContent: jest.fn()
    } as any;

    // Setup default mock responses
    mockSafetyFilter.validateInput.mockResolvedValue({
      isAllowed: true,
      riskLevel: 'low',
      blockedReasons: [],
      confidence: 0.9,
      processingTime: 10
    });

    mockDetector.addWakeWord = jest.fn().mockResolvedValue(undefined);
    mockDetector.removeWakeWord = jest.fn().mockResolvedValue(undefined);

    manager = new WakeWordManager(mockDetector, {
      maxActiveWakeWords: 3,
      safetyValidation: true
    }, mockSafetyFilter);
  });

  afterEach(async () => {
    await manager.destroy();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const eventSpy = jest.spyOn(voiceEventBus, 'publishEvent');
      
      await manager.initialize();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: VoiceEventTypes.WAKE_WORD_MANAGER_INITIALIZED
        })
      );
    });

    test('should load existing profiles on initialization', async () => {
      await manager.initialize();
      
      const profiles = manager.getAllProfiles();
      expect(profiles.length).toBeGreaterThan(0);
      
      // Should have default profiles
      const defaultProfile = profiles.find(p => p.phrase === 'Hey Assistant');
      expect(defaultProfile).toBeDefined();
    });

    test('should activate default wake words', async () => {
      await manager.initialize();
      
      const activeProfiles = manager.getActiveProfiles();
      expect(activeProfiles.length).toBeGreaterThan(0);
      expect(mockDetector.addWakeWord).toHaveBeenCalled();
    });
  });

  describe('Wake Word Addition', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should add wake word successfully', async () => {
      const phrase = 'Hello Helper';
      
      const profileId = await manager.addWakeWord(phrase);
      
      expect(profileId).toBeDefined();
      expect(typeof profileId).toBe('string');
      
      const profiles = manager.getAllProfiles();
      const addedProfile = profiles.find(p => p.id === profileId);
      
      expect(addedProfile).toBeDefined();
      expect(addedProfile!.phrase).toBe(phrase);
    });

    test('should validate wake word safety', async () => {
      const phrase = 'Inappropriate Wake Word';
      
      mockSafetyFilter.validateInput.mockResolvedValue({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content'],
        confidence: 0.95,
        processingTime: 15
      });
      
      await expect(manager.addWakeWord(phrase))
        .rejects.toThrow('Wake word phrase rejected: inappropriate content');
      
      expect(mockSafetyFilter.validateInput).toHaveBeenCalledWith(phrase, 'system');
    });

    test('should reject duplicate wake words', async () => {
      const phrase = 'Duplicate Wake Word';
      
      await manager.addWakeWord(phrase);
      
      await expect(manager.addWakeWord(phrase))
        .rejects.toThrow(`Wake word "${phrase}" already exists`);
    });

    test('should enforce maximum active wake words limit', async () => {
      // Add wake words up to the limit
      for (let i = 0; i < 10; i++) {
        await manager.addWakeWord(`Wake Word ${i}`);
      }
      
      await expect(manager.addWakeWord('Exceeds Limit'))
        .rejects.toThrow('Maximum 3 active wake words allowed');
    });

    test('should add wake word with training data', async () => {
      const phrase = 'Trained Wake Word';
      const trainingData: TrainingDataSet = {
        positiveExamples: [
          {
            id: 'pos1',
            audioData: new Float32Array(1000),
            sampleRate: 16000,
            duration: 1.0,
            quality: 'high'
          }
        ],
        negativeExamples: [
          {
            id: 'neg1',
            audioData: new Float32Array(1000),
            sampleRate: 16000,
            duration: 1.0,
            quality: 'high'
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 2,
          speakerCount: 1,
          environmentVariations: ['quiet'],
          qualityDistribution: { high: 2 },
          createdAt: new Date()
        }
      };
      
      const profileId = await manager.addWakeWord(phrase, { trainingData });
      
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId);
      
      expect(profile!.trainingData).toBeDefined();
      expect(profile!.trainingData!.positiveExamples.length).toBe(1);
    });

    test('should add user-specific wake word', async () => {
      const phrase = 'User Specific';
      const userId = 'user123';
      
      const profileId = await manager.addWakeWord(phrase, { userId });
      
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId);
      
      expect(profile!.userId).toBe(userId);
    });
  });

  describe('Wake Word Removal', () => {
    let testProfileId: string;

    beforeEach(async () => {
      await manager.initialize();
      testProfileId = await manager.addWakeWord('Test Remove');
    });

    test('should remove wake word successfully', async () => {
      await manager.removeWakeWord(testProfileId);
      
      const profiles = manager.getAllProfiles();
      const removedProfile = profiles.find(p => p.id === testProfileId);
      
      expect(removedProfile).toBeUndefined();
      expect(mockDetector.removeWakeWord).toHaveBeenCalled();
    });

    test('should handle removal of non-existent wake word', async () => {
      await expect(manager.removeWakeWord('non-existent-id'))
        .rejects.toThrow('Wake word profile non-existent-id not found');
    });

    test('should deactivate before removal if active', async () => {
      // Ensure the wake word is active
      await manager.activateWakeWord(testProfileId);
      
      await manager.removeWakeWord(testProfileId);
      
      expect(mockDetector.removeWakeWord).toHaveBeenCalled();
    });
  });

  describe('Wake Word Activation/Deactivation', () => {
    let testProfileId: string;

    beforeEach(async () => {
      await manager.initialize();
      testProfileId = await manager.addWakeWord('Test Activation');
    });

    test('should activate wake word successfully', async () => {
      await manager.activateWakeWord(testProfileId);
      
      const activeProfiles = manager.getActiveProfiles();
      const activeProfile = activeProfiles.find(p => p.id === testProfileId);
      
      expect(activeProfile).toBeDefined();
      expect(activeProfile!.isActive).toBe(true);
      expect(mockDetector.addWakeWord).toHaveBeenCalled();
    });

    test('should deactivate wake word successfully', async () => {
      await manager.activateWakeWord(testProfileId);
      await manager.deactivateWakeWord(testProfileId);
      
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === testProfileId);
      
      expect(profile!.isActive).toBe(false);
      expect(mockDetector.removeWakeWord).toHaveBeenCalled();
    });

    test('should handle activation of non-existent profile', async () => {
      await expect(manager.activateWakeWord('non-existent-id'))
        .rejects.toThrow('Wake word profile non-existent-id not found');
    });

    test('should handle deactivation of non-existent profile', async () => {
      await expect(manager.deactivateWakeWord('non-existent-id'))
        .rejects.toThrow('Wake word profile non-existent-id not found');
    });

    test('should not activate already active wake word', async () => {
      await manager.activateWakeWord(testProfileId);
      
      // Reset mock to check if it's called again
      mockDetector.addWakeWord.mockClear();
      
      await manager.activateWakeWord(testProfileId);
      
      expect(mockDetector.addWakeWord).not.toHaveBeenCalled();
    });
  });

  describe('Priority Management', () => {
    let profileIds: string[];

    beforeEach(async () => {
      await manager.initialize();
      profileIds = [];
      
      for (let i = 0; i < 3; i++) {
        const id = await manager.addWakeWord(`Priority Test ${i}`, { priority: i });
        profileIds.push(id);
      }
    });

    test('should update wake word priority', async () => {
      const newPriority = 10;
      
      await manager.updateWakeWordPriority(profileIds[0], newPriority);
      
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === profileIds[0]);
      
      expect(profile!.priority).toBe(newPriority);
    });

    test('should order active profiles by priority', async () => {
      // Activate all profiles
      for (const id of profileIds) {
        await manager.activateWakeWord(id);
      }
      
      const activeProfiles = manager.getActiveProfiles();
      
      // Should be ordered by priority (descending)
      for (let i = 1; i < activeProfiles.length; i++) {
        expect(activeProfiles[i - 1].priority).toBeGreaterThanOrEqual(activeProfiles[i].priority);
      }
    });
  });

  describe('Training Data Management', () => {
    let testProfileId: string;

    beforeEach(async () => {
      await manager.initialize();
      testProfileId = await manager.addWakeWord('Training Test');
    });

    test('should add training data to existing wake word', async () => {
      const trainingData: TrainingDataSet = {
        positiveExamples: [
          {
            id: 'new1',
            audioData: new Float32Array(500),
            sampleRate: 16000,
            duration: 0.5,
            quality: 'medium'
          }
        ],
        negativeExamples: [
          {
            id: 'new2',
            audioData: new Float32Array(500),
            sampleRate: 16000,
            duration: 0.5,
            quality: 'medium'
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 2,
          speakerCount: 1,
          environmentVariations: ['noisy'],
          qualityDistribution: { medium: 2 },
          createdAt: new Date()
        }
      };
      
      await manager.addTrainingData(testProfileId, trainingData);
      
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === testProfileId);
      
      expect(profile!.trainingData).toBeDefined();
      expect(profile!.trainingData!.positiveExamples.length).toBe(1);
    });

    test('should validate training data quality', async () => {
      const invalidTrainingData: TrainingDataSet = {
        positiveExamples: [], // Empty - should fail
        negativeExamples: [
          {
            id: 'neg1',
            audioData: new Float32Array(500),
            sampleRate: 16000,
            duration: 0.5,
            quality: 'high'
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 1,
          speakerCount: 1,
          environmentVariations: [],
          qualityDistribution: { high: 1 },
          createdAt: new Date()
        }
      };
      
      await expect(manager.addTrainingData(testProfileId, invalidTrainingData))
        .rejects.toThrow('Training data must include positive examples');
    });

    test('should validate example duration', async () => {
      const trainingData: TrainingDataSet = {
        positiveExamples: [
          {
            id: 'invalid',
            audioData: new Float32Array(100),
            sampleRate: 16000,
            duration: 5.0, // Too long
            quality: 'high'
          }
        ],
        negativeExamples: [
          {
            id: 'neg1',
            audioData: new Float32Array(500),
            sampleRate: 16000,
            duration: 0.5,
            quality: 'high'
          }
        ],
        validationExamples: [],
        metadata: {
          totalExamples: 2,
          speakerCount: 1,
          environmentVariations: [],
          qualityDistribution: { high: 2 },
          createdAt: new Date()
        }
      };
      
      await expect(manager.addTrainingData(testProfileId, trainingData))
        .rejects.toThrow('Invalid example duration: 5s');
    });
  });

  describe('Usage Statistics', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should provide usage statistics', () => {
      const stats = manager.getUsageStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalProfiles).toBe('number');
      expect(typeof stats.activeProfiles).toBe('number');
      expect(Array.isArray(stats.mostUsed)).toBe(true);
      expect(Array.isArray(stats.recentlyUsed)).toBe(true);
    });

    test('should track wake word usage', async () => {
      const profileId = await manager.addWakeWord('Usage Test');
      
      // Simulate wake word detection
      const profiles = manager.getAllProfiles();
      const profile = profiles.find(p => p.id === profileId)!;
      
      // Simulate detector event
      mockDetector.emit('wake-word-detected', { phrase: profile.phrase });
      
      const updatedProfiles = manager.getAllProfiles();
      const updatedProfile = updatedProfiles.find(p => p.id === profileId)!;
      
      expect(updatedProfile.usageCount).toBe(1);
      expect(updatedProfile.lastUsed).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should emit wake word addition events', async () => {
      const eventSpy = jest.fn();
      manager.on('wake-word-added', eventSpy);
      
      await manager.addWakeWord('Event Test');
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should emit wake word removal events', async () => {
      const profileId = await manager.addWakeWord('Remove Event Test');
      
      const eventSpy = jest.fn();
      manager.on('wake-word-removed', eventSpy);
      
      await manager.removeWakeWord(profileId);
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should emit activation/deactivation events', async () => {
      const profileId = await manager.addWakeWord('Activation Event Test');
      
      const activationSpy = jest.fn();
      const deactivationSpy = jest.fn();
      
      manager.on('wake-word-activated', activationSpy);
      manager.on('wake-word-deactivated', deactivationSpy);
      
      await manager.activateWakeWord(profileId);
      expect(activationSpy).toHaveBeenCalled();
      
      await manager.deactivateWakeWord(profileId);
      expect(deactivationSpy).toHaveBeenCalled();
    });

    test('should publish events to voice event bus', async () => {
      const eventSpy = jest.spyOn(voiceEventBus, 'publishEvent');
      
      await manager.addWakeWord('Bus Event Test');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: VoiceEventTypes.WAKE_WORD_ADDED
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should handle detector errors gracefully', async () => {
      mockDetector.addWakeWord.mockRejectedValue(new Error('Detector error'));
      
      const errorSpy = jest.fn();
      manager.on('error', errorSpy);
      
      await expect(manager.addWakeWord('Error Test'))
        .rejects.toThrow();
      
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should handle safety filter errors', async () => {
      mockSafetyFilter.validateInput.mockRejectedValue(new Error('Safety filter error'));
      
      await expect(manager.addWakeWord('Safety Error Test'))
        .rejects.toThrow();
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on destroy', async () => {
      await manager.initialize();
      
      const profileId = await manager.addWakeWord('Cleanup Test');
      await manager.activateWakeWord(profileId);
      
      await manager.destroy();
      
      expect(mockDetector.removeWakeWord).toHaveBeenCalled();
      
      const profiles = manager.getAllProfiles();
      expect(profiles.length).toBe(0);
    });

    test('should deactivate all wake words on destroy', async () => {
      await manager.initialize();
      
      const profileIds = [];
      for (let i = 0; i < 3; i++) {
        const id = await manager.addWakeWord(`Destroy Test ${i}`);
        await manager.activateWakeWord(id);
        profileIds.push(id);
      }
      
      await manager.destroy();
      
      expect(mockDetector.removeWakeWord).toHaveBeenCalledTimes(profileIds.length);
    });
  });

  describe('Configuration', () => {
    test('should respect maximum active wake words configuration', () => {
      const customManager = new WakeWordManager(mockDetector, {
        maxActiveWakeWords: 1
      });
      
      // Configuration should be applied
      expect((customManager as any).config.maxActiveWakeWords).toBe(1);
      
      customManager.destroy();
    });

    test('should disable safety validation when configured', async () => {
      const unsafeManager = new WakeWordManager(mockDetector, {
        safetyValidation: false
      });
      
      await unsafeManager.initialize();
      await unsafeManager.addWakeWord('Unsafe Test');
      
      expect(mockSafetyFilter.validateInput).not.toHaveBeenCalled();
      
      await unsafeManager.destroy();
    });
  });
});