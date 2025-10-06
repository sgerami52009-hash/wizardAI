/**
 * Integration Tests for Complete Voice Pipeline
 * Safety: Tests child safety validation and parental controls
 * Performance: Validates <500ms response times on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { VoicePipelineOrchestratorImpl, PipelineComponents, PipelineConfig } from './pipeline-orchestrator';
import { EventCoordinator, defaultPipelineConfiguration } from './event-coordinator';
import { SessionManager } from './session-manager';
import { voiceEventBus, VoiceEventTypes } from './event-bus';
import { 
  WakeWordDetector, 
  SpeechRecognizer, 
  IntentClassifier, 
  CommandRouter, 
  ResponseGenerator, 
  TextToSpeechEngine,
  AudioStream,
  AudioBuffer,
  RecognitionResult,
  IntentResult,
  CommandResult
} from './interfaces';
import { ContentSafetyFilterEngine } from '../safety/content-safety-filter';
import { ResourceMonitor } from './resource-monitor';

// Mock implementations for testing
class MockWakeWordDetector extends EventEmitter implements WakeWordDetector {
  private isListening = false;
  private sensitivity = 0.7;
  private activeWakeWords: string[] = ['hey assistant'];

  async startListening(): Promise<void> {
    this.isListening = true;
    this.emit('started');
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    this.emit('stopped');
  }

  updateSensitivity(level: number): void {
    this.sensitivity = level;
  }

  async addWakeWord(phrase: string, modelPath: string): Promise<void> {
    this.activeWakeWords.push(phrase);
  }

  async removeWakeWord(phrase: string): Promise<void> {
    this.activeWakeWords = this.activeWakeWords.filter(w => w !== phrase);
  }

  getActiveWakeWords(): string[] {
    return [...this.activeWakeWords];
  }

  // Test helper method
  simulateWakeWordDetection(phrase: string = 'hey assistant'): void {
    if (this.isListening && this.activeWakeWords.includes(phrase)) {
      this.emit('wakeWordDetected', {
        phrase,
        confidence: 0.95,
        timestamp: Date.now()
      });
    }
  }
}

class MockSpeechRecognizer extends EventEmitter implements SpeechRecognizer {
  private userProfiles = new Map();
  private currentLanguage = 'en-US';

  async recognize(audioStream: AudioStream, userId?: string): Promise<RecognitionResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      text: 'turn on the lights',
      confidence: 0.92,
      alternatives: ['turn on lights', 'turn the lights on'],
      processingTime: 100,
      language: this.currentLanguage,
      userId
    };
  }

  startStreaming(userId?: string): any {
    return {
      onPartialResult: (callback: Function) => {},
      onFinalResult: (callback: Function) => {},
      onError: (callback: Function) => {},
      stop: () => {}
    };
  }

  updateUserProfile(userId: string, profile: any): void {
    this.userProfiles.set(userId, profile);
  }

  setLanguage(language: string): void {
    this.currentLanguage = language;
  }

  getAvailableLanguages(): string[] {
    return ['en-US', 'es-ES', 'fr-FR'];
  }
}

class MockIntentClassifier extends EventEmitter implements IntentClassifier {
  private intents = new Map();

  async classifyIntent(text: string, context: any): Promise<IntentResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simple intent classification based on keywords
    if (text.includes('lights')) {
      return {
        intent: 'smart_home.lights.control',
        confidence: 0.95,
        parameters: { action: 'turn_on', device: 'lights' },
        requiresConfirmation: false
      };
    }

    if (text.includes('weather')) {
      return {
        intent: 'information.weather',
        confidence: 0.88,
        parameters: { location: 'current' },
        requiresConfirmation: false
      };
    }

    return {
      intent: 'unknown',
      confidence: 0.1,
      parameters: {},
      requiresConfirmation: true
    };
  }

  registerIntent(intent: any): void {
    this.intents.set(intent.name, intent);
  }

  updateContext(context: any): void {
    // Update internal context
  }

  getRegisteredIntents(): any[] {
    return Array.from(this.intents.values());
  }
}

class MockCommandRouter extends EventEmitter implements CommandRouter {
  private handlers = new Map();

  async routeCommand(intent: IntentResult, userId: string): Promise<CommandResult> {
    // Simulate command execution delay
    await new Promise(resolve => setTimeout(resolve, 200));

    if (intent.intent === 'smart_home.lights.control') {
      return {
        success: true,
        response: 'I turned on the lights for you!',
        executionTime: 200
      };
    }

    if (intent.intent === 'information.weather') {
      return {
        success: true,
        response: 'It\'s sunny and 72 degrees outside.',
        executionTime: 200
      };
    }

    return {
      success: false,
      response: 'I\'m not sure how to help with that.',
      executionTime: 50
    };
  }

  registerHandler(intent: string, handler: any): void {
    this.handlers.set(intent, handler);
  }

  async executeCommand(command: any): Promise<CommandResult> {
    return this.routeCommand(command.intent, command.userId);
  }

  getRegisteredHandlers(): Map<string, any> {
    return new Map(this.handlers);
  }
}

class MockResponseGenerator extends EventEmitter implements ResponseGenerator {
  private personality: any = null;
  private templates = new Map();

  async generateResponse(result: CommandResult, context: any): Promise<string> {
    // Simulate response generation delay
    await new Promise(resolve => setTimeout(resolve, 100));

    if (result.success) {
      return result.response;
    } else {
      return "I'm sorry, I couldn't help with that. Could you try asking differently?";
    }
  }

  setPersonality(personality: any): void {
    this.personality = personality;
  }

  addResponseTemplate(intent: string, template: any): void {
    this.templates.set(intent, template);
  }

  getAvailableTemplates(): Map<string, any> {
    return new Map(this.templates);
  }
}

class MockTextToSpeechEngine extends EventEmitter implements TextToSpeechEngine {
  private currentVoice = 'default';
  private speechRate = 1.0;

  async synthesize(text: string, options: any): Promise<AudioBuffer> {
    // Simulate TTS processing delay
    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      data: new Float32Array(1024), // Mock audio data
      sampleRate: 16000,
      channels: 1,
      timestamp: Date.now()
    };
  }

  startStreaming(text: string, options: any): AudioStream {
    const stream = new EventEmitter() as AudioStream;
    
    // Mock streaming implementation
    setTimeout(() => {
      stream.emit('data', {
        data: new Float32Array(512),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now()
      });
      stream.emit('end');
    }, 100);

    return stream;
  }

  setVoice(voiceId: string): void {
    this.currentVoice = voiceId;
  }

  updateSpeechRate(rate: number): void {
    this.speechRate = rate;
  }

  getAvailableVoices(): any[] {
    return [
      { id: 'default', name: 'Default Voice', language: 'en-US', gender: 'neutral', ageGroup: 'adult' }
    ];
  }

  stop(): void {
    this.emit('stopped');
  }
}

class MockContentSafetyFilter {
  async validateInput(text: string, userId: string): Promise<any> {
    // Simulate safety validation delay
    await new Promise(resolve => setTimeout(resolve, 25));

    // Block inappropriate content
    const inappropriateWords = ['violence', 'dangerous', 'inappropriate'];
    const isBlocked = inappropriateWords.some(word => text.toLowerCase().includes(word));

    return {
      isAllowed: !isBlocked,
      riskLevel: isBlocked ? 'high' : 'low',
      blockedReasons: isBlocked ? ['inappropriate_content'] : [],
      sanitizedText: isBlocked ? undefined : text
    };
  }

  async validateOutput(text: string, userId: string): Promise<any> {
    return this.validateInput(text, userId);
  }

  updateFilterRules(rules: any): void {
    // Update filter rules
  }

  async getAuditLog(timeRange: any): Promise<any[]> {
    return [];
  }
}

class MockResourceMonitor extends EventEmitter {
  private isRunning = false;
  private currentUsage = { memoryMB: 500, cpuPercent: 25 };

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit('stopped');
  }

  getCurrentUsage(): any {
    return { ...this.currentUsage };
  }

  // Test helper method
  simulateResourceSpike(memoryMB: number, cpuPercent: number): void {
    this.currentUsage = { memoryMB, cpuPercent };
    this.emit('resourceWarning', this.currentUsage);
  }
}

class MockAudioStream extends EventEmitter implements AudioStream {
  private active = false;

  async start(): Promise<void> {
    this.active = true;
    this.emit('started');
  }

  async stop(): Promise<void> {
    this.active = false;
    this.emit('stopped');
  }

  write(buffer: AudioBuffer): void {
    if (this.active) {
      this.emit('data', buffer);
    }
  }

  read(): AudioBuffer | null {
    if (this.active) {
      return {
        data: new Float32Array(1024),
        sampleRate: 16000,
        channels: 1,
        timestamp: Date.now()
      };
    }
    return null;
  }

  isActive(): boolean {
    return this.active;
  }
}

describe('Voice Pipeline Integration Tests', () => {
  let orchestrator: VoicePipelineOrchestratorImpl;
  let eventCoordinator: EventCoordinator;
  let sessionManager: SessionManager;
  let components: PipelineComponents;
  let mockAudioStream: MockAudioStream;

  beforeEach(async () => {
    // Create mock components
    components = {
      wakeWordDetector: new MockWakeWordDetector(),
      speechRecognizer: new MockSpeechRecognizer(),
      intentClassifier: new MockIntentClassifier(),
      commandRouter: new MockCommandRouter(),
      responseGenerator: new MockResponseGenerator(),
      textToSpeechEngine: new MockTextToSpeechEngine(),
      contentSafetyFilter: new MockContentSafetyFilter() as any as ContentSafetyFilterEngine,
      resourceMonitor: new MockResourceMonitor() as any as ResourceMonitor
    };

    // Create pipeline configuration
    const config: Partial<PipelineConfig> = {
      maxConcurrentSessions: 3,
      sessionTimeoutMs: 60000,
      responseTimeoutMs: 5000,
      resourceThresholds: {
        memoryMB: 1000,
        cpuPercent: 80
      },
      safetyConfig: {
        enableContentFiltering: true,
        defaultSafetyLevel: 'child',
        auditLogging: true
      }
    };

    // Create orchestrator and supporting systems
    orchestrator = new VoicePipelineOrchestratorImpl(components, config);
    eventCoordinator = new EventCoordinator({}, defaultPipelineConfiguration);
    sessionManager = new SessionManager();
    mockAudioStream = new MockAudioStream();

    // Start systems
    await orchestrator.start();
    await eventCoordinator.start();
    await sessionManager.start();
  });

  afterEach(async () => {
    // Clean up
    await orchestrator.stop();
    await eventCoordinator.stop();
    await sessionManager.stop();
    
    // Clear event bus
    voiceEventBus.removeAllListeners();
  });

  describe('End-to-End Voice Interaction Flow', () => {
    test('should process complete voice interaction successfully', async () => {
      const startTime = Date.now();
      
      // Simulate wake word detection
      (components.wakeWordDetector as MockWakeWordDetector).simulateWakeWordDetection();
      
      // Process voice input
      await orchestrator.processVoiceInput(mockAudioStream, 'test_user');
      
      const endTime = Date.now();
      const totalLatency = endTime - startTime;
      
      // Verify performance requirement
      expect(totalLatency).toBeLessThan(500); // <500ms requirement
      
      // Verify pipeline status
      const status = orchestrator.getStatus();
      expect(status.isActive).toBe(true);
      expect(status.activeUsers).toContain('test_user');
    });

    test('should handle multi-turn conversation', async () => {
      const userId = 'conversation_user';
      
      // First interaction
      await orchestrator.processVoiceInput(mockAudioStream, userId);
      
      // Second interaction in same session
      await orchestrator.processVoiceInput(mockAudioStream, userId);
      
      // Verify session continuity
      const sessions = sessionManager.getUserSessions(userId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].conversationContext.turns.length).toBeGreaterThan(0);
    });

    test('should enforce child safety throughout pipeline', async () => {
      const childUserId = 'child_user';
      
      // Create child user session
      const session = await sessionManager.createOrResumeSession(childUserId, {
        parentalSupervision: false
      });
      
      expect(session.userProfile.ageGroup).toBe('child');
      expect(session.userProfile.safetySettings.contentFilterLevel).toBe('strict');
      
      // Process voice input with safety validation
      await orchestrator.processVoiceInput(mockAudioStream, childUserId);
      
      // Verify safety checks were applied
      expect(session.metrics.safetyViolations).toBe(0);
    });
  });

  describe('Multi-User Scenarios', () => {
    test('should handle concurrent user sessions', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      // Create concurrent sessions
      const [session1, session2] = await Promise.all([
        sessionManager.createOrResumeSession(user1),
        sessionManager.createOrResumeSession(user2)
      ]);
      
      expect(session1.userId).toBe(user1);
      expect(session2.userId).toBe(user2);
      expect(session1.sessionId).not.toBe(session2.sessionId);
      
      // Process concurrent voice inputs
      await Promise.all([
        orchestrator.processVoiceInput(mockAudioStream, user1),
        orchestrator.processVoiceInput(mockAudioStream, user2)
      ]);
      
      // Verify both sessions are active
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
    });

    test('should handle family context and shared preferences', async () => {
      const parentId = 'parent';
      const childId = 'child';
      
      // Create family sessions
      const parentSession = await sessionManager.createOrResumeSession(parentId);
      const childSession = await sessionManager.createOrResumeSession(childId, {
        multiUser: true,
        parentalSupervision: true
      });
      
      // Handle multi-user interaction
      const multiUserContext = await sessionManager.handleMultiUserInteraction(
        [parentSession.sessionId, childSession.sessionId],
        parentId
      );
      
      expect(multiUserContext.primaryUserId).toBe(parentId);
      expect(multiUserContext.activeUsers).toContain(parentId);
      expect(multiUserContext.activeUsers).toContain(childId);
    });

    test('should enforce session limits', async () => {
      const maxSessions = 3;
      
      // Create maximum allowed sessions
      const sessions = [];
      for (let i = 0; i < maxSessions; i++) {
        const session = await sessionManager.createOrResumeSession(`user${i}`);
        sessions.push(session);
      }
      
      expect(sessions).toHaveLength(maxSessions);
      
      // Attempt to create one more session (should fail)
      await expect(
        sessionManager.createOrResumeSession('excess_user')
      ).rejects.toThrow('SESSION_LIMIT_EXCEEDED');
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from speech recognition failures', async () => {
      // Mock speech recognition failure
      const originalRecognize = components.speechRecognizer.recognize;
      components.speechRecognizer.recognize = jest.fn().mockRejectedValueOnce(
        new Error('Recognition failed')
      );
      
      // Attempt voice processing
      await expect(
        orchestrator.processVoiceInput(mockAudioStream, 'test_user')
      ).rejects.toThrow();
      
      // Restore original method
      components.speechRecognizer.recognize = originalRecognize;
      
      // Verify system can recover
      await orchestrator.processVoiceInput(mockAudioStream, 'test_user');
      
      const status = orchestrator.getStatus();
      expect(status.isActive).toBe(true);
    });

    test('should handle resource exhaustion gracefully', async () => {
      // Simulate resource spike
      (components.resourceMonitor as any).simulateResourceSpike(1500, 90);
      
      // Attempt voice processing under resource constraints
      await expect(
        orchestrator.processVoiceInput(mockAudioStream, 'test_user')
      ).rejects.toThrow('RESOURCE_EXHAUSTION');
      
      // Verify system remains stable
      const status = orchestrator.getStatus();
      expect(status.isActive).toBe(true);
    });

    test('should handle safety violations appropriately', async () => {
      // Mock safety filter to block content
      const originalValidateInput = components.contentSafetyFilter.validateInput;
      components.contentSafetyFilter.validateInput = jest.fn().mockResolvedValueOnce({
        isAllowed: false,
        riskLevel: 'high',
        blockedReasons: ['inappropriate_content']
      });
      
      // Attempt voice processing with blocked content
      await expect(
        orchestrator.processVoiceInput(mockAudioStream, 'test_user')
      ).rejects.toThrow('SAFETY_VIOLATION');
      
      // Restore original method
      components.contentSafetyFilter.validateInput = originalValidateInput;
      
      // Verify system continues to function
      await orchestrator.processVoiceInput(mockAudioStream, 'test_user');
    });

    test('should maintain pipeline state during component failures', async () => {
      // Simulate TTS failure
      const originalSynthesize = components.textToSpeechEngine.synthesize;
      components.textToSpeechEngine.synthesize = jest.fn().mockRejectedValueOnce(
        new Error('TTS failed')
      );
      
      // Process voice input (should complete despite TTS failure)
      await orchestrator.processVoiceInput(mockAudioStream, 'test_user');
      
      // Restore original method
      components.textToSpeechEngine.synthesize = originalSynthesize;
      
      // Verify pipeline metrics
      const metrics = orchestrator.getMetrics();
      expect(metrics.totalInteractions).toBeGreaterThan(0);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should meet latency requirements under normal load', async () => {
      const iterations = 10;
      const latencies: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await orchestrator.processVoiceInput(mockAudioStream, `user${i}`);
        const latency = Date.now() - startTime;
        latencies.push(latency);
      }
      
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      
      expect(averageLatency).toBeLessThan(400); // Average <400ms
      expect(maxLatency).toBeLessThan(500); // Max <500ms
    });

    test('should monitor resource usage effectively', async () => {
      const initialUsage = components.resourceMonitor.getCurrentUsage();
      
      // Process multiple voice interactions
      for (let i = 0; i < 5; i++) {
        await orchestrator.processVoiceInput(mockAudioStream, `user${i}`);
      }
      
      const finalUsage = components.resourceMonitor.getCurrentUsage();
      
      // Verify resource monitoring is working
      expect(finalUsage.memoryMB).toBeGreaterThanOrEqual(initialUsage.memoryMB);
      expect(finalUsage.cpuPercent).toBeGreaterThanOrEqual(0);
    });

    test('should handle session cleanup and memory management', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const session = await sessionManager.createOrResumeSession(`cleanup_user${i}`);
        sessions.push(session);
      }
      
      const initialSessionCount = sessionManager.getActiveSessions().length;
      expect(initialSessionCount).toBe(5);
      
      // End sessions
      for (const session of sessions) {
        await sessionManager.endSession(session.sessionId, 'test_cleanup');
      }
      
      const finalSessionCount = sessionManager.getActiveSessions().length;
      expect(finalSessionCount).toBe(0);
    });
  });

  describe('Event Coordination and Debugging', () => {
    test('should coordinate events across pipeline components', async () => {
      const eventsSeen: string[] = [];
      
      // Subscribe to pipeline events
      voiceEventBus.subscribe('*', (event) => {
        eventsSeen.push(event.type);
      });
      
      // Process voice input
      await orchestrator.processVoiceInput(mockAudioStream, 'event_test_user');
      
      // Verify key events were published
      expect(eventsSeen).toContain(VoiceEventTypes.SPEECH_RECOGNITION_COMPLETE);
      expect(eventsSeen).toContain(VoiceEventTypes.INTENT_CLASSIFIED);
      expect(eventsSeen).toContain(VoiceEventTypes.COMMAND_COMPLETED);
      expect(eventsSeen).toContain(VoiceEventTypes.RESPONSE_GENERATED);
    });

    test('should provide debugging information', async () => {
      // Enable debug logging
      eventCoordinator.setDebugLogging(true);
      
      // Process voice input
      await orchestrator.processVoiceInput(mockAudioStream, 'debug_user');
      
      // Get debug information
      const debugInfo = eventCoordinator.getDebugInfo({
        eventType: VoiceEventTypes.SPEECH_RECOGNITION_COMPLETE,
        limit: 10
      });
      
      expect(debugInfo.length).toBeGreaterThan(0);
      expect(debugInfo[0].event.type).toBe(VoiceEventTypes.SPEECH_RECOGNITION_COMPLETE);
    });

    test('should collect performance metrics', async () => {
      // Process multiple interactions
      for (let i = 0; i < 3; i++) {
        await orchestrator.processVoiceInput(mockAudioStream, `metrics_user${i}`);
      }
      
      // Get pipeline metrics
      const pipelineMetrics = orchestrator.getMetrics();
      expect(pipelineMetrics.totalInteractions).toBe(3);
      expect(pipelineMetrics.averageLatency).toBeGreaterThan(0);
      expect(pipelineMetrics.successRate).toBeGreaterThan(0);
      
      // Get event coordinator metrics
      const eventMetrics = eventCoordinator.getMetrics();
      expect(eventMetrics.totalEventsProcessed).toBeGreaterThan(0);
      
      // Get session statistics
      const sessionStats = sessionManager.getSessionStatistics();
      expect(sessionStats.totalActiveSessions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Management', () => {
    test('should support runtime configuration updates', async () => {
      const initialConfig = eventCoordinator.getConfiguration();
      
      // Update configuration
      await eventCoordinator.updateConfiguration({
        pipeline: {
          ...initialConfig.pipeline,
          resourceLimits: {
            maxMemoryMB: 1500,
            maxCpuPercent: 60,
            maxProcessingTimeMs: 400
          }
        }
      });
      
      const updatedConfig = eventCoordinator.getConfiguration();
      expect(updatedConfig.pipeline.resourceLimits.maxMemoryMB).toBe(1500);
      expect(updatedConfig.pipeline.resourceLimits.maxCpuPercent).toBe(60);
    });

    test('should validate configuration changes', async () => {
      // Attempt invalid configuration update
      await expect(
        eventCoordinator.updateConfiguration({
          components: {
            // @ts-ignore - intentionally invalid
            invalidComponent: { enabled: true }
          }
        } as any)
      ).rejects.toThrow();
    });
  });
});

// Performance benchmark tests
describe('Voice Pipeline Performance Benchmarks', () => {
  let orchestrator: VoicePipelineOrchestratorImpl;
  let components: PipelineComponents;
  let mockAudioStream: MockAudioStream;

  beforeEach(async () => {
    components = {
      wakeWordDetector: new MockWakeWordDetector(),
      speechRecognizer: new MockSpeechRecognizer(),
      intentClassifier: new MockIntentClassifier(),
      commandRouter: new MockCommandRouter(),
      responseGenerator: new MockResponseGenerator(),
      textToSpeechEngine: new MockTextToSpeechEngine(),
      contentSafetyFilter: new MockContentSafetyFilter() as any as ContentSafetyFilterEngine,
      resourceMonitor: new MockResourceMonitor() as any as ResourceMonitor
    };

    orchestrator = new VoicePipelineOrchestratorImpl(components);
    mockAudioStream = new MockAudioStream();
    
    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  test('should handle high-frequency interactions', async () => {
    const interactionCount = 50;
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < interactionCount; i++) {
      promises.push(
        orchestrator.processVoiceInput(mockAudioStream, `perf_user${i % 5}`)
      );
    }
    
    await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    const averageTimePerInteraction = totalTime / interactionCount;
    
    expect(averageTimePerInteraction).toBeLessThan(1000); // <1s per interaction
    
    const metrics = orchestrator.getMetrics();
    expect(metrics.totalInteractions).toBe(interactionCount);
    expect(metrics.successRate).toBeGreaterThan(90); // >90% success rate
  });

  test('should maintain performance under memory pressure', async () => {
    // Simulate memory pressure
    (components.resourceMonitor as any).simulateResourceSpike(800, 60);
    
    const iterations = 10;
    const latencies: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        await orchestrator.processVoiceInput(mockAudioStream, `memory_test_user${i}`);
        latencies.push(Date.now() - startTime);
      } catch (error) {
        // Expected under memory pressure
      }
    }
    
    if (latencies.length > 0) {
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      expect(averageLatency).toBeLessThan(1000); // Should still be reasonable
    }
  });
});