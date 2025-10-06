/**
 * Conversation Manager Tests
 * Safety: Validates conversation data sanitization and safety compliance
 * Performance: Ensures context management meets <100ms requirement
 */

import { VoiceConversationManager, MemorySessionStorage } from './conversation-manager';
import { ConversationSession, ConversationTurn, PendingAction } from '../models/conversation-context';
import { IntentResult, CommandResult } from './interfaces';

// Mock the safety filter
jest.mock('../safety/content-safety-filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({
    isAllowed: true,
    riskLevel: 'low',
    blockedReasons: []
  })
}));

// Mock the user profiles sanitizer
jest.mock('../models/user-profiles', () => ({
  sanitizeForLog: jest.fn((text) => text.substring(0, 50) + '...')
}));

describe('VoiceConversationManager', () => {
  let manager: VoiceConversationManager;
  let storage: MemorySessionStorage;

  beforeEach(() => {
    storage = new MemorySessionStorage();
    manager = new VoiceConversationManager(storage);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Session Management', () => {
    test('should create new sessions successfully', async () => {
      const session = await manager.createSession('test-user');
      
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('test-user');
      expect(session.status).toBe('active');
      expect(session.context.sessionId).toBe(session.id);
      expect(session.context.userId).toBe('test-user');
    });

    test('should retrieve existing sessions', async () => {
      const session = await manager.createSession('test-user');
      const retrieved = await manager.getSession(session.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(session.id);
      expect(retrieved!.userId).toBe('test-user');
    });

    test('should update session activity', async () => {
      const session = await manager.createSession('test-user');
      const originalActivity = session.lastActivity;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await manager.updateSession(session);
      const updated = await manager.getSession(session.id);
      
      expect(updated!.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
    });

    test('should end sessions properly', async () => {
      const session = await manager.createSession('test-user');
      
      await manager.endSession(session.id);
      const ended = await manager.getSession(session.id);
      
      expect(ended).toBeNull(); // Session should be removed from memory
    });

    test('should handle non-existent sessions gracefully', async () => {
      const session = await manager.getSession('non-existent');
      
      expect(session).toBeNull();
    });
  });

  describe('Conversation Turns', () => {
    let session: ConversationSession;
    let mockTurn: ConversationTurn;

    beforeEach(async () => {
      session = await manager.createSession('test-user');
      
      mockTurn = {
        id: 'turn-1',
        timestamp: new Date(),
        userInput: 'turn on the lights',
        recognizedText: 'turn on the lights',
        intent: {
          intent: 'smart_home.lights.control',
          confidence: 0.9,
          parameters: { action: 'turn on' },
          requiresConfirmation: false
        },
        response: 'I\'ve turned on the lights',
        executionResult: {
          success: true,
          response: 'I\'ve turned on the lights',
          executionTime: 100
        },
        processingMetrics: {
          recognitionTime: 50,
          intentClassificationTime: 30,
          safetyValidationTime: 10,
          commandExecutionTime: 100,
          responseGenerationTime: 20,
          totalLatency: 210,
          memoryUsage: 512,
          cpuUsage: 25
        },
        safetyChecks: []
      };
    });

    test('should add turns to conversation', async () => {
      await manager.addTurn(session.id, mockTurn);
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.context.turns).toHaveLength(1);
      expect(updatedSession!.context.turns[0].id).toBe('turn-1');
      expect(updatedSession!.metrics.totalTurns).toBe(1);
    });

    test('should update session metrics with turns', async () => {
      await manager.addTurn(session.id, mockTurn);
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.metrics.successfulCommands).toBe(1);
      expect(updatedSession!.metrics.averageLatency).toBe(210);
    });

    test('should handle failed command turns', async () => {
      const failedTurn = {
        ...mockTurn,
        executionResult: {
          success: false,
          response: 'Command failed',
          executionTime: 50
        }
      };

      await manager.addTurn(session.id, failedTurn);
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.metrics.failedCommands).toBe(1);
      expect(updatedSession!.metrics.successfulCommands).toBe(0);
    });

    test('should maintain turn history limits', async () => {
      // Add many turns to test limit
      for (let i = 0; i < 105; i++) {
        const turn = {
          ...mockTurn,
          id: `turn-${i}`,
          userInput: `command ${i}`
        };
        await manager.addTurn(session.id, turn);
      }
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.context.turns.length).toBeLessThanOrEqual(100);
    });

    test('should update active topics from turns', async () => {
      await manager.addTurn(session.id, mockTurn);
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.context.activeTopics).toContain('smart_home');
    });
  });

  describe('Context Management', () => {
    let session: ConversationSession;

    beforeEach(async () => {
      session = await manager.createSession('test-user');
    });

    test('should retrieve conversation context', async () => {
      const context = await manager.getContext(session.id);
      
      expect(context).toBeDefined();
      expect(context!.sessionId).toBe(session.id);
      expect(context!.userId).toBe('test-user');
    });

    test('should update context with partial updates', async () => {
      const updates = {
        activeTopics: ['smart_home', 'lighting']
      };

      await manager.updateContext(session.id, updates);
      
      const context = await manager.getContext(session.id);
      expect(context!.activeTopics).toEqual(['smart_home', 'lighting']);
    });

    test('should handle context updates for non-existent sessions', async () => {
      await expect(manager.updateContext('non-existent', {}))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Pending Actions', () => {
    let session: ConversationSession;
    let mockAction: PendingAction;

    beforeEach(async () => {
      session = await manager.createSession('test-user');
      
      mockAction = {
        id: 'action-1',
        type: 'parameter_clarification',
        parameters: { missingParam: 'location' },
        requiresConfirmation: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        priority: 'medium',
        dependencies: []
      };
    });

    test('should add pending actions', async () => {
      await manager.addPendingAction(session.id, mockAction);
      
      const context = await manager.getContext(session.id);
      expect(context!.pendingActions).toHaveLength(1);
      expect(context!.pendingActions[0].id).toBe('action-1');
    });

    test('should resolve pending actions', async () => {
      await manager.addPendingAction(session.id, mockAction);
      await manager.resolvePendingAction(session.id, 'action-1', { result: 'resolved' });
      
      const context = await manager.getContext(session.id);
      expect(context!.pendingActions).toHaveLength(0);
    });

    test('should handle expiring actions', async () => {
      const shortAction = {
        ...mockAction,
        expiresAt: new Date(Date.now() + 100) // 100ms
      };

      await manager.addPendingAction(session.id, shortAction);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const context = await manager.getContext(session.id);
      expect(context!.pendingActions).toHaveLength(0);
    });
  });

  describe('Multi-turn Conversation Support', () => {
    let session: ConversationSession;

    beforeEach(async () => {
      session = await manager.createSession('test-user');
    });

    test('should enhance intents with conversation history', async () => {
      // Add a previous turn about lights
      const previousTurn: ConversationTurn = {
        id: 'turn-1',
        timestamp: new Date(),
        userInput: 'turn on the lights',
        recognizedText: 'turn on the lights',
        intent: {
          intent: 'smart_home.lights.control',
          confidence: 0.9,
          parameters: { action: 'turn on', device: 'lights' },
          requiresConfirmation: false
        },
        response: 'I\'ve turned on the lights',
        executionResult: {
          success: true,
          response: 'I\'ve turned on the lights',
          executionTime: 100
        },
        processingMetrics: {
          recognitionTime: 50,
          intentClassificationTime: 30,
          safetyValidationTime: 10,
          commandExecutionTime: 100,
          responseGenerationTime: 20,
          totalLatency: 210,
          memoryUsage: 512,
          cpuUsage: 25
        },
        safetyChecks: []
      };

      await manager.addTurn(session.id, previousTurn);

      // Test vague follow-up intent
      const vagueIntent: IntentResult = {
        intent: 'system.unknown',
        confidence: 0.2,
        parameters: {},
        requiresConfirmation: true
      };

      const enhanced = await manager.handleMultiTurnIntent(session.id, vagueIntent);
      
      // Should maintain some context from previous turn
      expect(enhanced.confidence).toBeGreaterThan(0);
    });

    test('should extract parameters from conversation context', async () => {
      // Set up context with location information
      await manager.updateContext(session.id, {
        environmentContext: {
          ...session.context.environmentContext,
          location: 'living room'
        }
      });

      const result = await manager.extractParametersFromContext(
        session.id,
        ['location', 'action'],
        { action: 'turn on' }
      );

      expect(result.parameters.location).toBe('living room');
      expect(result.parameters.action).toBe('turn on');
      expect(result.missingParameters).toHaveLength(0);
    });

    test('should generate clarification questions for missing parameters', async () => {
      const result = await manager.extractParametersFromContext(
        session.id,
        ['location', 'device'],
        {}
      );

      expect(result.needsClarification).toBe(true);
      expect(result.clarificationQuestions).toHaveLength(2);
      expect(result.clarificationQuestions[0]).toContain('room');
      expect(result.clarificationQuestions[1]).toContain('device');
    });
  });

  describe('Session Persistence and Recovery', () => {
    test('should persist session state', async () => {
      const session = await manager.createSession('test-user');
      
      await manager.persistSessionState(session.id);
      
      // Verify it was saved to storage
      const saved = await storage.load(session.id);
      expect(saved).toBeDefined();
      expect(saved!.id).toBe(session.id);
    });

    test('should recover session state', async () => {
      const session = await manager.createSession('test-user');
      await manager.persistSessionState(session.id);
      
      // Simulate recovery
      const recovered = await manager.recoverSessionState(session.id);
      
      expect(recovered).toBeDefined();
      expect(recovered!.id).toBe(session.id);
      expect(recovered!.userId).toBe('test-user');
    });

    test('should handle recovery of expired sessions', async () => {
      // Create an expired session in storage
      const expiredSession: ConversationSession = {
        id: 'expired-session',
        userId: 'test-user',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'active',
        context: {
          sessionId: 'expired-session',
          userId: 'test-user',
          turns: [],
          activeTopics: [],
          pendingActions: [],
          userPreferences: {},
          safetyContext: {
            currentAgeGroup: 'child',
            parentalSupervision: false,
            contentHistory: [],
            riskFactors: [],
            safetyOverrides: []
          },
          environmentContext: {
            location: 'home',
            timeOfDay: 'afternoon',
            dayOfWeek: 'Monday',
            ambientNoise: 'quiet',
            otherUsers: [],
            deviceStatus: {
              networkConnected: true,
              resourceUsage: { memoryMB: 512, cpuPercent: 25 },
              temperature: 25,
              availableStorage: 1000
            }
          }
        },
        metrics: {
          totalTurns: 0,
          averageLatency: 0,
          successfulCommands: 0,
          failedCommands: 0,
          safetyViolations: 0,
          duration: 0
        }
      };

      await storage.save(expiredSession);
      
      const recovered = await manager.recoverSessionState('expired-session');
      expect(recovered).toBeNull(); // Should not recover expired sessions
    });
  });

  describe('Session Cleanup', () => {
    test('should cleanup expired sessions', async () => {
      const session = await manager.createSession('test-user');
      
      // Manually expire the session
      session.lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      await manager.updateSession(session);
      
      await manager.cleanupExpiredSessions();
      
      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    test('should emit cleanup events', async () => {
      const cleanupSpy = jest.fn();
      manager.on('sessionsCleanedUp', cleanupSpy);
      
      // Create and expire a session
      const session = await manager.createSession('test-user');
      session.lastActivity = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await manager.updateSession(session);
      
      await manager.cleanupExpiredSessions();
      
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    test('should create sessions within 100ms', async () => {
      const startTime = Date.now();
      
      await manager.createSession('test-user');
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(100);
    });

    test('should retrieve context within 100ms', async () => {
      const session = await manager.createSession('test-user');
      
      const startTime = Date.now();
      await manager.getContext(session.id);
      
      const retrievalTime = Date.now() - startTime;
      expect(retrievalTime).toBeLessThan(100);
    });

    test('should handle concurrent session operations', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        manager.createSession(`user-${i}`)
      );

      const sessions = await Promise.all(promises);
      
      expect(sessions).toHaveLength(10);
      sessions.forEach((session, i) => {
        expect(session.userId).toBe(`user-${i}`);
      });
    });
  });

  describe('Safety Integration', () => {
    test('should validate turn content for safety', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content']
      });

      const session = await manager.createSession('test-user');
      const unsafeTurn = {
        id: 'unsafe-turn',
        timestamp: new Date(),
        userInput: 'inappropriate content',
        recognizedText: 'inappropriate content',
        intent: {
          intent: 'system.safety_blocked',
          confidence: 1.0,
          parameters: {},
          requiresConfirmation: false
        },
        response: 'Content blocked',
        executionResult: {
          success: false,
          response: 'Content blocked',
          executionTime: 0
        },
        processingMetrics: {
          recognitionTime: 0,
          intentClassificationTime: 0,
          safetyValidationTime: 10,
          commandExecutionTime: 0,
          responseGenerationTime: 0,
          totalLatency: 10,
          memoryUsage: 512,
          cpuUsage: 25
        },
        safetyChecks: []
      };

      await manager.addTurn(session.id, unsafeTurn);
      
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession!.metrics.safetyViolations).toBe(1);
    });

    test('should emit safety violation events', async () => {
      const { validateChildSafeContent } = require('../safety/content-safety-filter');
      validateChildSafeContent.mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate content']
      });

      const safetyViolationSpy = jest.fn();
      manager.on('safetyViolation', safetyViolationSpy);

      const session = await manager.createSession('test-user');
      const unsafeTurn = {
        id: 'unsafe-turn',
        timestamp: new Date(),
        userInput: 'inappropriate content',
        recognizedText: 'inappropriate content',
        intent: {
          intent: 'system.safety_blocked',
          confidence: 1.0,
          parameters: {},
          requiresConfirmation: false
        },
        response: 'Content blocked',
        executionResult: {
          success: false,
          response: 'Content blocked',
          executionTime: 0
        },
        processingMetrics: {
          recognitionTime: 0,
          intentClassificationTime: 0,
          safetyValidationTime: 10,
          commandExecutionTime: 0,
          responseGenerationTime: 0,
          totalLatency: 10,
          memoryUsage: 512,
          cpuUsage: 25
        },
        safetyChecks: []
      };

      await manager.addTurn(session.id, unsafeTurn);
      
      expect(safetyViolationSpy).toHaveBeenCalled();
    });
  });
});

describe('MemorySessionStorage', () => {
  let storage: MemorySessionStorage;
  let mockSession: ConversationSession;

  beforeEach(() => {
    storage = new MemorySessionStorage();
    
    mockSession = {
      id: 'test-session',
      userId: 'test-user',
      startTime: new Date(),
      lastActivity: new Date(),
      status: 'active',
      context: {
        sessionId: 'test-session',
        userId: 'test-user',
        turns: [],
        activeTopics: [],
        pendingActions: [],
        userPreferences: {},
        safetyContext: {
          currentAgeGroup: 'child',
          parentalSupervision: false,
          contentHistory: [],
          riskFactors: [],
          safetyOverrides: []
        },
        environmentContext: {
          location: 'home',
          timeOfDay: 'afternoon',
          dayOfWeek: 'Monday',
          ambientNoise: 'quiet',
          otherUsers: [],
          deviceStatus: {
            networkConnected: true,
            resourceUsage: { memoryMB: 512, cpuPercent: 25 },
            temperature: 25,
            availableStorage: 1000
          }
        }
      },
      metrics: {
        totalTurns: 0,
        averageLatency: 0,
        successfulCommands: 0,
        failedCommands: 0,
        safetyViolations: 0,
        duration: 0
      }
    };
  });

  test('should save and load sessions', async () => {
    await storage.save(mockSession);
    const loaded = await storage.load('test-session');
    
    expect(loaded).toBeDefined();
    expect(loaded!.id).toBe('test-session');
    expect(loaded!.userId).toBe('test-user');
  });

  test('should return null for non-existent sessions', async () => {
    const loaded = await storage.load('non-existent');
    
    expect(loaded).toBeNull();
  });

  test('should delete sessions', async () => {
    await storage.save(mockSession);
    await storage.delete('test-session');
    
    const loaded = await storage.load('test-session');
    expect(loaded).toBeNull();
  });

  test('should cleanup old sessions', async () => {
    // Save a session with old timestamp
    const oldSession = {
      ...mockSession,
      id: 'old-session',
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    };
    
    await storage.save(mockSession);
    await storage.save(oldSession);
    
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const cleanedCount = await storage.cleanup(cutoffTime);
    
    expect(cleanedCount).toBe(1);
    
    const currentSession = await storage.load('test-session');
    const cleanedSession = await storage.load('old-session');
    
    expect(currentSession).toBeDefined();
    expect(cleanedSession).toBeNull();
  });
});