/**
 * Voice Pipeline Orchestrator - Main coordinator for all voice processing components
 * Safety: Comprehensive child safety validation at every stage
 * Performance: End-to-end voice interaction <500ms on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { 
  VoicePipelineOrchestrator, 
  PipelineStatus, 
  PipelineMetrics, 
  ResourceUsage,
  AudioStream,
  WakeWordDetector,
  SpeechRecognizer,
  IntentClassifier,
  CommandRouter,
  ResponseGenerator,
  TextToSpeechEngine,
  ConversationContext
} from './interfaces';
import { voiceEventBus, VoiceEventTypes, VoiceEvent } from './event-bus';
import { VoicePipelineError, ErrorRecoveryManager, errorRecoveryManager } from './errors';
import { ContentSafetyFilter } from '../safety/content-safety-filter';
import { ResourceMonitor } from './resource-monitor';

export interface PipelineConfig {
  maxConcurrentSessions: number;
  sessionTimeoutMs: number;
  responseTimeoutMs: number;
  resourceThresholds: {
    memoryMB: number;
    cpuPercent: number;
    gpuPercent?: number;
  };
  safetyConfig: {
    enableContentFiltering: boolean;
    defaultSafetyLevel: 'child' | 'teen' | 'adult';
    auditLogging: boolean;
  };
  performanceConfig: {
    enableMetrics: boolean;
    metricsRetentionMs: number;
    enableProfiling: boolean;
  };
}

export interface PipelineComponents {
  wakeWordDetector: WakeWordDetector;
  speechRecognizer: SpeechRecognizer;
  intentClassifier: IntentClassifier;
  commandRouter: CommandRouter;
  responseGenerator: ResponseGenerator;
  textToSpeechEngine: TextToSpeechEngine;
  contentSafetyFilter: ContentSafetyFilter;
  resourceMonitor: ResourceMonitor;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  conversationContext: ConversationContext;
  currentStage: 'idle' | 'listening' | 'processing' | 'responding';
  metrics: SessionMetrics;
}

export interface SessionMetrics {
  totalInteractions: number;
  averageLatency: number;
  successfulInteractions: number;
  failedInteractions: number;
  safetyViolations: number;
  resourcePeaks: ResourceUsage;
}

export class VoicePipelineOrchestratorImpl extends EventEmitter implements VoicePipelineOrchestrator {
  private components: PipelineComponents;
  private config: PipelineConfig;
  private isActive: boolean = false;
  private activeSessions: Map<string, UserSession> = new Map();
  private pipelineMetrics: PipelineMetrics;
  private errorRecovery: ErrorRecoveryManager;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(components: PipelineComponents, config: Partial<PipelineConfig> = {}) {
    super();
    
    this.components = components;
    this.config = {
      maxConcurrentSessions: 5,
      sessionTimeoutMs: 300000, // 5 minutes
      responseTimeoutMs: 5000, // 5 seconds
      resourceThresholds: {
        memoryMB: 1600, // 80% of 2GB limit
        cpuPercent: 60
      },
      safetyConfig: {
        enableContentFiltering: true,
        defaultSafetyLevel: 'child',
        auditLogging: true
      },
      performanceConfig: {
        enableMetrics: true,
        metricsRetentionMs: 3600000, // 1 hour
        enableProfiling: false
      },
      ...config
    };

    this.pipelineMetrics = {
      totalInteractions: 0,
      averageLatency: 0,
      successRate: 0,
      errorCounts: {},
      resourcePeaks: { memoryMB: 0, cpuPercent: 0 }
    };

    this.errorRecovery = errorRecoveryManager;
    this.setupEventHandlers();
  }

  /**
   * Start the voice pipeline orchestrator
   */
  async start(): Promise<void> {
    try {
      if (this.isActive) {
        throw new VoicePipelineError(
          'Pipeline already active',
          'PIPELINE_ALREADY_ACTIVE',
          'orchestrator',
          false
        );
      }

      // Initialize all components
      await this.initializeComponents();

      // Start resource monitoring
      await this.components.resourceMonitor.start();

      // Start session cleanup
      this.startSessionCleanup();

      // Start metrics collection
      if (this.config.performanceConfig.enableMetrics) {
        this.startMetricsCollection();
      }

      this.isActive = true;

      // Publish pipeline started event
      await voiceEventBus.publishEvent({
        id: `pipeline_start_${Date.now()}`,
        type: VoiceEventTypes.PIPELINE_STARTED,
        timestamp: new Date(),
        source: 'orchestrator',
        data: { config: this.config },
        priority: 'high'
      });

      this.emit('started');

    } catch (error) {
      const pipelineError = error instanceof VoicePipelineError ? error : 
        new VoicePipelineError(
          `Failed to start pipeline: ${error.message}`,
          'PIPELINE_START_FAILED',
          'orchestrator',
          true
        );

      await this.handleError(pipelineError);
      throw pipelineError;
    }
  }

  /**
   * Stop the voice pipeline orchestrator
   */
  async stop(): Promise<void> {
    try {
      if (!this.isActive) {
        return;
      }

      // Stop all active sessions
      for (const session of this.activeSessions.values()) {
        await this.endSession(session.sessionId, 'pipeline_shutdown');
      }

      // Stop components
      await this.shutdownComponents();

      // Stop monitoring and cleanup
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = null;
      }

      if (this.metricsCollectionInterval) {
        clearInterval(this.metricsCollectionInterval);
        this.metricsCollectionInterval = null;
      }

      await this.components.resourceMonitor.stop();

      this.isActive = false;

      // Publish pipeline stopped event
      await voiceEventBus.publishEvent({
        id: `pipeline_stop_${Date.now()}`,
        type: VoiceEventTypes.PIPELINE_STOPPED,
        timestamp: new Date(),
        source: 'orchestrator',
        data: { finalMetrics: this.pipelineMetrics },
        priority: 'high'
      });

      this.emit('stopped');

    } catch (error) {
      console.error('Error stopping pipeline:', error);
      throw error;
    }
  }

  /**
   * Process voice input through the complete pipeline
   */
  async processVoiceInput(audioStream: AudioStream, userId?: string): Promise<void> {
    const startTime = Date.now();
    let session: UserSession | null = null;

    try {
      // Check if pipeline is active
      if (!this.isActive) {
        throw new VoicePipelineError(
          'Pipeline not active',
          'PIPELINE_NOT_ACTIVE',
          'orchestrator',
          false,
          "I'm not ready to listen right now. Please try again in a moment."
        );
      }

      // Check resource constraints
      await this.checkResourceConstraints();

      // Get or create user session
      session = await this.getOrCreateSession(userId);
      session.currentStage = 'listening';
      session.lastActivity = new Date();

      // Stage 1: Speech Recognition
      const recognitionResult = await this.performSpeechRecognition(audioStream, session);
      
      // Stage 2: Content Safety Validation (Input)
      await this.validateInputSafety(recognitionResult.text, session);

      // Stage 3: Intent Classification
      session.currentStage = 'processing';
      const intentResult = await this.classifyIntent(recognitionResult.text, session);

      // Stage 4: Command Execution
      const commandResult = await this.executeCommand(intentResult, session);

      // Stage 5: Response Generation
      session.currentStage = 'responding';
      const responseText = await this.generateResponse(commandResult, session);

      // Stage 6: Content Safety Validation (Output)
      const safeResponse = await this.validateOutputSafety(responseText, session);

      // Stage 7: Text-to-Speech
      await this.synthesizeSpeech(safeResponse, session);

      // Update metrics
      const totalLatency = Date.now() - startTime;
      this.updateSessionMetrics(session, true, totalLatency);
      this.updatePipelineMetrics(true, totalLatency);

      session.currentStage = 'idle';

    } catch (error) {
      const pipelineError = error instanceof VoicePipelineError ? error : 
        new VoicePipelineError(
          `Voice processing failed: ${error.message}`,
          'VOICE_PROCESSING_FAILED',
          'orchestrator',
          true
        );

      // Update metrics for failure
      const totalLatency = Date.now() - startTime;
      if (session) {
        this.updateSessionMetrics(session, false, totalLatency);
        session.currentStage = 'idle';
      }
      this.updatePipelineMetrics(false, totalLatency);

      // Attempt error recovery
      const recoveryResult = await this.errorRecovery.handleError(pipelineError);
      
      if (recoveryResult.action === 'retry' && session) {
        // Retry the operation
        setTimeout(() => this.processVoiceInput(audioStream, userId), recoveryResult.retryAfter || 1000);
      } else {
        // Provide user feedback
        await this.handleUserError(pipelineError, session);
      }

      throw pipelineError;
    }
  }

  /**
   * Get current pipeline status
   */
  getStatus(): PipelineStatus {
    const resourceUsage = this.components.resourceMonitor.getCurrentUsage();
    
    return {
      isActive: this.isActive,
      currentStage: this.getCurrentStage(),
      activeUsers: Array.from(this.activeSessions.values()).map(s => s.userId),
      resourceUsage,
      lastActivity: this.getLastActivity()
    };
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(): PipelineMetrics {
    return { ...this.pipelineMetrics };
  }

  /**
   * Get active user sessions
   */
  getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * End a specific user session
   */
  async endSession(sessionId: string, reason: string = 'user_request'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Publish session end event
      await voiceEventBus.publishEvent({
        id: `session_end_${Date.now()}`,
        type: VoiceEventTypes.USER_SESSION_ENDED,
        timestamp: new Date(),
        source: 'orchestrator',
        data: { 
          sessionId, 
          userId: session.userId, 
          reason,
          duration: Date.now() - session.startTime.getTime(),
          metrics: session.metrics
        },
        userId: session.userId,
        sessionId,
        priority: 'medium'
      });

      this.activeSessions.delete(sessionId);
      this.emit('session-ended', session);

    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  // Private methods for pipeline stages

  private async initializeComponents(): Promise<void> {
    // Initialize wake word detector
    await this.components.wakeWordDetector.startListening();
    
    // Initialize other components as needed
    // Components should be pre-initialized before passing to orchestrator
  }

  private async shutdownComponents(): Promise<void> {
    // Stop wake word detector
    await this.components.wakeWordDetector.stopListening();
    
    // Stop TTS engine
    this.components.textToSpeechEngine.stop();
    
    // Other components cleanup as needed
  }

  private async checkResourceConstraints(): Promise<void> {
    const usage = this.components.resourceMonitor.getCurrentUsage();
    
    if (usage.memoryMB > this.config.resourceThresholds.memoryMB) {
      throw new VoicePipelineError(
        `Memory usage ${usage.memoryMB}MB exceeds threshold ${this.config.resourceThresholds.memoryMB}MB`,
        'RESOURCE_EXHAUSTION',
        'orchestrator',
        true,
        "I'm working hard right now. Please give me a moment."
      );
    }

    if (usage.cpuPercent > this.config.resourceThresholds.cpuPercent) {
      throw new VoicePipelineError(
        `CPU usage ${usage.cpuPercent}% exceeds threshold ${this.config.resourceThresholds.cpuPercent}%`,
        'RESOURCE_EXHAUSTION',
        'orchestrator',
        true,
        "I'm processing a lot right now. Let me catch up."
      );
    }
  }

  private async getOrCreateSession(userId?: string): Promise<UserSession> {
    // Check session limits
    if (this.activeSessions.size >= this.config.maxConcurrentSessions) {
      throw new VoicePipelineError(
        'Maximum concurrent sessions reached',
        'SESSION_LIMIT_EXCEEDED',
        'orchestrator',
        true,
        "I'm helping other family members right now. Please try again in a moment."
      );
    }

    // Find existing session for user
    if (userId) {
      for (const session of this.activeSessions.values()) {
        if (session.userId === userId) {
          return session;
        }
      }
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const session: UserSession = {
      sessionId,
      userId: userId || 'anonymous',
      startTime: new Date(),
      lastActivity: new Date(),
      conversationContext: {
        sessionId,
        userId: userId || 'anonymous',
        startTime: new Date(),
        turns: [],
        activeTopics: [],
        pendingActions: []
      },
      currentStage: 'idle',
      metrics: {
        totalInteractions: 0,
        averageLatency: 0,
        successfulInteractions: 0,
        failedInteractions: 0,
        safetyViolations: 0,
        resourcePeaks: { memoryMB: 0, cpuPercent: 0 }
      }
    };

    this.activeSessions.set(sessionId, session);

    // Publish session start event
    await voiceEventBus.publishEvent({
      id: `session_start_${Date.now()}`,
      type: VoiceEventTypes.USER_SESSION_STARTED,
      timestamp: new Date(),
      source: 'orchestrator',
      data: { sessionId, userId: session.userId },
      userId: session.userId,
      sessionId,
      priority: 'medium'
    });

    this.emit('session-started', session);
    return session;
  }

  private async performSpeechRecognition(audioStream: AudioStream, session: UserSession) {
    try {
      const result = await this.components.speechRecognizer.recognize(audioStream, session.userId);
      
      // Publish recognition event
      await voiceEventBus.publishEvent({
        id: `recognition_${Date.now()}`,
        type: VoiceEventTypes.SPEECH_RECOGNITION_COMPLETE,
        timestamp: new Date(),
        source: 'speech-recognizer',
        data: { 
          text: result.text, 
          confidence: result.confidence,
          processingTime: result.processingTime
        },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });

      return result;
    } catch (error) {
      throw new VoicePipelineError(
        `Speech recognition failed: ${error.message}`,
        'SPEECH_RECOGNITION_ERROR',
        'speech-recognition',
        true,
        "I didn't understand that clearly. Could you say it again?"
      );
    }
  }

  private async validateInputSafety(text: string, session: UserSession): Promise<void> {
    if (!this.config.safetyConfig.enableContentFiltering) {
      return;
    }

    try {
      const safetyResult = await this.components.contentSafetyFilter.validateInput(text, session.userId);
      
      if (!safetyResult.isAllowed) {
        session.metrics.safetyViolations++;
        
        // Publish safety violation event
        await voiceEventBus.publishEvent({
          id: `safety_violation_${Date.now()}`,
          type: VoiceEventTypes.SAFETY_VIOLATION,
          timestamp: new Date(),
          source: 'safety-filter',
          data: { 
            text: '[REDACTED]',
            riskLevel: safetyResult.riskLevel,
            blockedReasons: safetyResult.blockedReasons
          },
          userId: session.userId,
          sessionId: session.sessionId,
          priority: 'high'
        });

        throw new VoicePipelineError(
          `Content safety violation: ${safetyResult.blockedReasons.join(', ')}`,
          'SAFETY_VIOLATION',
          'safety',
          false,
          "I can't help with that request. Let's try something else!"
        );
      }
    } catch (error) {
      if (error instanceof VoicePipelineError) {
        throw error;
      }
      
      throw new VoicePipelineError(
        `Safety validation failed: ${error.message}`,
        'SAFETY_VALIDATION_ERROR',
        'safety',
        true,
        "I need to check that request. Please try again."
      );
    }
  }

  private async classifyIntent(text: string, session: UserSession) {
    try {
      const result = await this.components.intentClassifier.classifyIntent(text, session.conversationContext);
      
      // Publish intent classification event
      await voiceEventBus.publishEvent({
        id: `intent_${Date.now()}`,
        type: VoiceEventTypes.INTENT_CLASSIFIED,
        timestamp: new Date(),
        source: 'intent-classifier',
        data: { 
          intent: result.intent,
          confidence: result.confidence,
          parameters: result.parameters
        },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });

      return result;
    } catch (error) {
      throw new VoicePipelineError(
        `Intent classification failed: ${error.message}`,
        'INTENT_CLASSIFICATION_ERROR',
        'intent',
        true,
        "I'm not sure what you'd like me to do. Can you be more specific?"
      );
    }
  }

  private async executeCommand(intentResult: any, session: UserSession) {
    try {
      const result = await this.components.commandRouter.routeCommand(intentResult, session.userId);
      
      // Publish command execution event
      await voiceEventBus.publishEvent({
        id: `command_${Date.now()}`,
        type: result.success ? VoiceEventTypes.COMMAND_COMPLETED : VoiceEventTypes.COMMAND_FAILED,
        timestamp: new Date(),
        source: 'command-router',
        data: { 
          intent: intentResult.intent,
          success: result.success,
          executionTime: result.executionTime
        },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });

      return result;
    } catch (error) {
      throw new VoicePipelineError(
        `Command execution failed: ${error.message}`,
        'COMMAND_EXECUTION_ERROR',
        'command',
        true,
        "I couldn't complete that action right now. Let's try again."
      );
    }
  }

  private async generateResponse(commandResult: any, session: UserSession): Promise<string> {
    try {
      const responseContext = {
        userId: session.userId,
        conversationHistory: session.conversationContext.turns,
        currentIntent: commandResult.intent || 'unknown',
        userPreferences: {},
        safetyLevel: this.config.safetyConfig.defaultSafetyLevel
      };

      const response = await this.components.responseGenerator.generateResponse(commandResult, responseContext);
      
      // Publish response generation event
      await voiceEventBus.publishEvent({
        id: `response_${Date.now()}`,
        type: VoiceEventTypes.RESPONSE_GENERATED,
        timestamp: new Date(),
        source: 'response-generator',
        data: { responseLength: response.length },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });

      return response;
    } catch (error) {
      throw new VoicePipelineError(
        `Response generation failed: ${error.message}`,
        'RESPONSE_GENERATION_ERROR',
        'response',
        true,
        "I'm having trouble forming a response. Let me try again."
      );
    }
  }

  private async validateOutputSafety(text: string, session: UserSession): Promise<string> {
    if (!this.config.safetyConfig.enableContentFiltering) {
      return text;
    }

    try {
      const safetyResult = await this.components.contentSafetyFilter.validateOutput(text, session.userId);
      
      if (!safetyResult.isAllowed) {
        session.metrics.safetyViolations++;
        
        // Use sanitized text if available, otherwise use safe fallback
        return safetyResult.sanitizedText || "I need to think about that differently. Let's try something else!";
      }

      return text;
    } catch (error) {
      // Fail safe with generic response
      return "I'm having trouble with my response. Let's try that again!";
    }
  }

  private async synthesizeSpeech(text: string, session: UserSession): Promise<void> {
    try {
      const ttsOptions = {
        voiceId: 'default',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        emotion: 'neutral' as const
      };

      await this.components.textToSpeechEngine.synthesize(text, ttsOptions);
      
      // Publish TTS event
      await voiceEventBus.publishEvent({
        id: `tts_${Date.now()}`,
        type: VoiceEventTypes.TTS_COMPLETED,
        timestamp: new Date(),
        source: 'tts-engine',
        data: { textLength: text.length },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });

    } catch (error) {
      // TTS failure is not critical - user can read the response
      console.warn('TTS synthesis failed:', error);
      
      await voiceEventBus.publishEvent({
        id: `tts_error_${Date.now()}`,
        type: VoiceEventTypes.TTS_ERROR,
        timestamp: new Date(),
        source: 'tts-engine',
        data: { error: error.message },
        userId: session.userId,
        sessionId: session.sessionId,
        priority: 'medium'
      });
    }
  }

  private updateSessionMetrics(session: UserSession, success: boolean, latency: number): void {
    session.metrics.totalInteractions++;
    
    if (success) {
      session.metrics.successfulInteractions++;
    } else {
      session.metrics.failedInteractions++;
    }

    // Update average latency
    const totalLatency = session.metrics.averageLatency * (session.metrics.totalInteractions - 1) + latency;
    session.metrics.averageLatency = totalLatency / session.metrics.totalInteractions;

    // Update resource peaks
    const currentUsage = this.components.resourceMonitor.getCurrentUsage();
    session.metrics.resourcePeaks.memoryMB = Math.max(session.metrics.resourcePeaks.memoryMB, currentUsage.memoryMB);
    session.metrics.resourcePeaks.cpuPercent = Math.max(session.metrics.resourcePeaks.cpuPercent, currentUsage.cpuPercent);
  }

  private updatePipelineMetrics(success: boolean, latency: number): void {
    this.pipelineMetrics.totalInteractions++;
    
    // Update average latency
    const totalLatency = this.pipelineMetrics.averageLatency * (this.pipelineMetrics.totalInteractions - 1) + latency;
    this.pipelineMetrics.averageLatency = totalLatency / this.pipelineMetrics.totalInteractions;

    // Update success rate
    const successfulInteractions = success ? 
      (this.pipelineMetrics.successRate * (this.pipelineMetrics.totalInteractions - 1) / 100) + 1 :
      (this.pipelineMetrics.successRate * (this.pipelineMetrics.totalInteractions - 1) / 100);
    
    this.pipelineMetrics.successRate = (successfulInteractions / this.pipelineMetrics.totalInteractions) * 100;

    // Update resource peaks
    const currentUsage = this.components.resourceMonitor.getCurrentUsage();
    this.pipelineMetrics.resourcePeaks.memoryMB = Math.max(this.pipelineMetrics.resourcePeaks.memoryMB, currentUsage.memoryMB);
    this.pipelineMetrics.resourcePeaks.cpuPercent = Math.max(this.pipelineMetrics.resourcePeaks.cpuPercent, currentUsage.cpuPercent);
  }

  private async handleError(error: VoicePipelineError): Promise<void> {
    // Log error
    console.error('Pipeline error:', error);

    // Update error counts
    this.pipelineMetrics.errorCounts[error.code] = (this.pipelineMetrics.errorCounts[error.code] || 0) + 1;

    // Emit error event
    this.emit('error', error);
  }

  private async handleUserError(error: VoicePipelineError, session: UserSession | null): Promise<void> {
    if (!session) {
      return;
    }

    try {
      // Provide user feedback through TTS
      await this.synthesizeSpeech(error.userMessage, session);
    } catch (ttsError) {
      // If TTS fails, just log it - the error has already been handled
      console.warn('Failed to provide user error feedback:', ttsError);
    }
  }

  private setupEventHandlers(): void {
    // Handle wake word detection
    this.components.wakeWordDetector.on('wakeWordDetected', async (result) => {
      try {
        // Start listening for speech input
        // This would typically trigger audio stream capture
        this.emit('wake-word-detected', result);
      } catch (error) {
        await this.handleError(new VoicePipelineError(
          `Wake word handling failed: ${error.message}`,
          'WAKE_WORD_HANDLING_ERROR',
          'orchestrator',
          true
        ));
      }
    });

    // Handle resource warnings
    this.components.resourceMonitor.on('resourceWarning', async (warning) => {
      await voiceEventBus.publishEvent({
        id: `resource_warning_${Date.now()}`,
        type: VoiceEventTypes.RESOURCE_WARNING,
        timestamp: new Date(),
        source: 'resource-monitor',
        data: warning,
        priority: 'high'
      });
    });
  }

  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeoutMs = this.config.sessionTimeoutMs;

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now - session.lastActivity.getTime() > timeoutMs) {
          this.endSession(sessionId, 'timeout');
        }
      }
    }, 60000); // Check every minute
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      // Collect and emit metrics
      this.emit('metrics-updated', this.getMetrics());
    }, 10000); // Every 10 seconds
  }

  private getCurrentStage(): 'idle' | 'listening' | 'processing' | 'responding' {
    // Return the most active stage across all sessions
    const stages = Array.from(this.activeSessions.values()).map(s => s.currentStage);
    
    if (stages.includes('responding')) return 'responding';
    if (stages.includes('processing')) return 'processing';
    if (stages.includes('listening')) return 'listening';
    return 'idle';
  }

  private getLastActivity(): Date {
    let lastActivity = new Date(0);
    
    for (const session of this.activeSessions.values()) {
      if (session.lastActivity > lastActivity) {
        lastActivity = session.lastActivity;
      }
    }
    
    return lastActivity;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}