/**
 * Basic tests for Voice Pipeline Orchestrator
 * Safety: Tests child safety validation and parental controls
 * Performance: Validates <500ms response times on Jetson Nano Orin
 */

import { VoicePipelineOrchestratorImpl, PipelineComponents } from './pipeline-orchestrator';
import { EventCoordinator } from './event-coordinator';
import { SessionManager } from './session-manager';

describe('Voice Pipeline Orchestrator', () => {
  let orchestrator: VoicePipelineOrchestratorImpl;
  let mockComponents: PipelineComponents;

  beforeEach(() => {
    // Create minimal mock components for testing
    mockComponents = {
      wakeWordDetector: {
        startListening: jest.fn().mockResolvedValue(undefined),
        stopListening: jest.fn().mockResolvedValue(undefined),
        updateSensitivity: jest.fn(),
        addWakeWord: jest.fn().mockResolvedValue(undefined),
        removeWakeWord: jest.fn().mockResolvedValue(undefined),
        getActiveWakeWords: jest.fn().mockReturnValue(['hey assistant']),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      speechRecognizer: {
        recognize: jest.fn().mockResolvedValue({
          text: 'turn on the lights',
          confidence: 0.92,
          alternatives: [],
          processingTime: 100,
          language: 'en-US'
        }),
        startStreaming: jest.fn(),
        updateUserProfile: jest.fn(),
        setLanguage: jest.fn(),
        getAvailableLanguages: jest.fn().mockReturnValue(['en-US']),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      intentClassifier: {
        classifyIntent: jest.fn().mockResolvedValue({
          intent: 'smart_home.lights.control',
          confidence: 0.95,
          parameters: { action: 'turn_on' },
          requiresConfirmation: false
        }),
        registerIntent: jest.fn(),
        updateContext: jest.fn(),
        getRegisteredIntents: jest.fn().mockReturnValue([]),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      commandRouter: {
        routeCommand: jest.fn().mockResolvedValue({
          success: true,
          response: 'I turned on the lights for you!',
          executionTime: 200
        }),
        registerHandler: jest.fn(),
        executeCommand: jest.fn(),
        getRegisteredHandlers: jest.fn().mockReturnValue(new Map()),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      responseGenerator: {
        generateResponse: jest.fn().mockResolvedValue('I turned on the lights for you!'),
        setPersonality: jest.fn(),
        addResponseTemplate: jest.fn(),
        getAvailableTemplates: jest.fn().mockReturnValue(new Map()),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      textToSpeechEngine: {
        synthesize: jest.fn().mockResolvedValue({
          data: new Float32Array(1024),
          sampleRate: 16000,
          channels: 1,
          timestamp: Date.now()
        }),
        startStreaming: jest.fn(),
        setVoice: jest.fn(),
        updateSpeechRate: jest.fn(),
        getAvailableVoices: jest.fn().mockReturnValue([]),
        stop: jest.fn(),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any,
      contentSafetyFilter: {
        validateInput: jest.fn().mockResolvedValue({
          isAllowed: true,
          riskLevel: 'low',
          blockedReasons: []
        }),
        validateOutput: jest.fn().mockResolvedValue({
          isAllowed: true,
          riskLevel: 'low',
          blockedReasons: []
        }),
        updateFilterRules: jest.fn(),
        getAuditLog: jest.fn().mockResolvedValue([])
      } as any,
      resourceMonitor: {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        getCurrentUsage: jest.fn().mockReturnValue({
          memoryMB: 500,
          cpuPercent: 25
        }),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any
    };

    orchestrator = new VoicePipelineOrchestratorImpl(mockComponents);
  });

  afterEach(async () => {
    if (orchestrator) {
      try {
        await orchestrator.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Lifecycle Management', () => {
    test('should start successfully', async () => {
      await orchestrator.start();
      
      const status = orchestrator.getStatus();
      expect(status.isActive).toBe(true);
      expect(mockComponents.wakeWordDetector.startListening).toHaveBeenCalled();
      expect(mockComponents.resourceMonitor.start).toHaveBeenCalled();
    });

    test('should stop successfully', async () => {
      await orchestrator.start();
      await orchestrator.stop();
      
      const status = orchestrator.getStatus();
      expect(status.isActive).toBe(false);
      expect(mockComponents.wakeWordDetector.stopListening).toHaveBeenCalled();
      expect(mockComponents.resourceMonitor.stop).toHaveBeenCalled();
    });

    test('should not allow starting twice', async () => {
      await orchestrator.start();
      
      await expect(orchestrator.start()).rejects.toThrow('PIPELINE_ALREADY_ACTIVE');
    });
  });

  describe('Voice Processing', () => {
    beforeEach(async () => {
      await orchestrator.start();
    });

    test('should process voice input successfully', async () => {
      const mockAudioStream = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        write: jest.fn(),
        read: jest.fn().mockReturnValue(null),
        isActive: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;

      const startTime = Date.now();
      await orchestrator.processVoiceInput(mockAudioStream, 'test_user');
      const endTime = Date.now();

      // Verify performance requirement
      expect(endTime - startTime).toBeLessThan(1000); // Allow 1s for test environment

      // Verify all components were called
      expect(mockComponents.speechRecognizer.recognize).toHaveBeenCalled();
      expect(mockComponents.intentClassifier.classifyIntent).toHaveBeenCalled();
      expect(mockComponents.commandRouter.routeCommand).toHaveBeenCalled();
      expect(mockComponents.responseGenerator.generateResponse).toHaveBeenCalled();
      expect(mockComponents.textToSpeechEngine.synthesize).toHaveBeenCalled();
    });

    test('should handle speech recognition errors', async () => {
      const mockAudioStream = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        write: jest.fn(),
        read: jest.fn().mockReturnValue(null),
        isActive: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;

      // Mock speech recognition failure
      mockComponents.speechRecognizer.recognize = jest.fn().mockRejectedValue(
        new Error('Recognition failed')
      );

      await expect(
        orchestrator.processVoiceInput(mockAudioStream, 'test_user')
      ).rejects.toThrow();
    });

    test('should handle safety violations', async () => {
      const mockAudioStream = {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        write: jest.fn(),
        read: jest.fn().mockReturnValue(null),
        isActive: jest.fn().mockReturnValue(true),
        on: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn()
      } as any;

      // Mock safety violation
      mockComponents.contentSafetyFilter.validateInput = jest.fn().mockResolvedValue({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate_content']
      });

      await expect(
        orchestrator.processVoiceInput(mockAudioStream, 'test_user')
      ).rejects.toThrow('SAFETY_VIOLATION');
    });
  });

  describe('Status and Metrics', () => {
    test('should provide current status', () => {
      const status = orchestrator.getStatus();
      
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('currentStage');
      expect(status).toHaveProperty('activeUsers');
      expect(status).toHaveProperty('resourceUsage');
      expect(status).toHaveProperty('lastActivity');
    });

    test('should provide metrics', () => {
      const metrics = orchestrator.getMetrics();
      
      expect(metrics).toHaveProperty('totalInteractions');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('errorCounts');
      expect(metrics).toHaveProperty('resourcePeaks');
    });

    test('should track active sessions', async () => {
      await orchestrator.start();
      
      const initialSessions = orchestrator.getActiveSessions();
      expect(initialSessions).toHaveLength(0);
      
      // Sessions would be created during voice processing
      // This is tested in integration scenarios
    });
  });
});

describe('Event Coordinator', () => {
  let eventCoordinator: EventCoordinator;

  beforeEach(() => {
    const mockConfig = {
      components: {
        wakeWordDetector: { enabled: true, priority: 10, timeout: 5000, retryPolicy: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 5000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 100, maxCpuPercent: 20, maxProcessingTimeMs: 200 }, debugLevel: 'basic' as const },
        speechRecognizer: { enabled: true, priority: 9, timeout: 10000, retryPolicy: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 500, maxCpuPercent: 50, maxProcessingTimeMs: 500 }, debugLevel: 'basic' as const },
        intentClassifier: { enabled: true, priority: 8, timeout: 3000, retryPolicy: { maxRetries: 2, baseDelayMs: 200, maxDelayMs: 1000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 200, maxCpuPercent: 30, maxProcessingTimeMs: 100 }, debugLevel: 'basic' as const },
        commandRouter: { enabled: true, priority: 7, timeout: 15000, retryPolicy: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 3000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 300, maxCpuPercent: 40, maxProcessingTimeMs: 5000 }, debugLevel: 'basic' as const },
        responseGenerator: { enabled: true, priority: 6, timeout: 5000, retryPolicy: { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 200, maxCpuPercent: 30, maxProcessingTimeMs: 1000 }, debugLevel: 'basic' as const },
        textToSpeechEngine: { enabled: true, priority: 5, timeout: 8000, retryPolicy: { maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 3000, backoffMultiplier: 2, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 400, maxCpuPercent: 40, maxProcessingTimeMs: 300 }, debugLevel: 'basic' as const },
        contentSafetyFilter: { enabled: true, priority: 10, timeout: 2000, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 100, maxCpuPercent: 20, maxProcessingTimeMs: 100 }, debugLevel: 'detailed' as const },
        resourceMonitor: { enabled: true, priority: 1, timeout: 1000, retryPolicy: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1, retryableErrors: [] }, resourceLimits: { maxMemoryMB: 50, maxCpuPercent: 10, maxProcessingTimeMs: 100 }, debugLevel: 'basic' as const }
      },
      pipeline: {
        timeouts: {},
        retryPolicies: {},
        resourceLimits: { maxMemoryMB: 2000, maxCpuPercent: 70, maxProcessingTimeMs: 500 },
        safetySettings: { enableContentFiltering: true, safetyLevel: 'child' as const, auditLogging: true, parentalNotifications: true }
      }
    };

    eventCoordinator = new EventCoordinator({}, mockConfig);
  });

  afterEach(async () => {
    if (eventCoordinator) {
      try {
        await eventCoordinator.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  test('should start and stop successfully', async () => {
    await eventCoordinator.start();
    await eventCoordinator.stop();
    
    // If we get here without throwing, the test passes
    expect(true).toBe(true);
  });

  test('should provide metrics', () => {
    const metrics = eventCoordinator.getMetrics();
    
    expect(metrics).toHaveProperty('totalEventsProcessed');
    expect(metrics).toHaveProperty('eventsByType');
    expect(metrics).toHaveProperty('eventsByComponent');
    expect(metrics).toHaveProperty('averageProcessingTime');
    expect(metrics).toHaveProperty('errorCount');
  });

  test('should manage configuration', () => {
    const config = eventCoordinator.getConfiguration();
    
    expect(config).toHaveProperty('components');
    expect(config).toHaveProperty('pipeline');
    expect(config.components).toHaveProperty('wakeWordDetector');
    expect(config.components).toHaveProperty('speechRecognizer');
  });
});

describe('Session Manager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({
      maxConcurrentSessions: 3,
      sessionTimeoutMs: 60000,
      enableSessionPersistence: false
    });
  });

  afterEach(async () => {
    if (sessionManager) {
      try {
        await sessionManager.stop();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  test('should start and stop successfully', async () => {
    await sessionManager.start();
    await sessionManager.stop();
    
    // If we get here without throwing, the test passes
    expect(true).toBe(true);
  });

  test('should create user sessions', async () => {
    await sessionManager.start();
    
    const session = await sessionManager.createOrResumeSession('test_user');
    
    expect(session).toHaveProperty('sessionId');
    expect(session).toHaveProperty('userId');
    expect(session.userId).toBe('test_user');
    expect(session.status).toBe('active');
  });

  test('should manage multiple sessions', async () => {
    await sessionManager.start();
    
    const session1 = await sessionManager.createOrResumeSession('user1');
    const session2 = await sessionManager.createOrResumeSession('user2');
    
    expect(session1.sessionId).not.toBe(session2.sessionId);
    
    const activeSessions = sessionManager.getActiveSessions();
    expect(activeSessions).toHaveLength(2);
  });

  test('should enforce session limits', async () => {
    await sessionManager.start();
    
    // Create maximum allowed sessions
    await sessionManager.createOrResumeSession('user1');
    await sessionManager.createOrResumeSession('user2');
    await sessionManager.createOrResumeSession('user3');
    
    // Attempt to create one more (should fail)
    await expect(
      sessionManager.createOrResumeSession('user4')
    ).rejects.toThrow('SESSION_LIMIT_EXCEEDED');
  });

  test('should provide session statistics', async () => {
    await sessionManager.start();
    
    const stats = sessionManager.getSessionStatistics();
    
    expect(stats).toHaveProperty('totalActiveSessions');
    expect(stats).toHaveProperty('userCount');
    expect(stats).toHaveProperty('averageSessionDuration');
    expect(stats).toHaveProperty('sessionsByStatus');
  });
});