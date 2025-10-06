/**
 * Intent Processing Pipeline Integration
 * Safety: End-to-end safety validation and child-appropriate processing
 * Performance: Complete pipeline processing <200ms on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { LocalIntentClassifier } from './intent-classifier';
import { LocalEntityExtractor } from './entity-extractor';
import { VoiceCommandRouter } from './command-router';
import { VoiceConversationManager, MemorySessionStorage } from './conversation-manager';
import { 
  IntentResult, 
  CommandResult, 
  ConversationContext,
  ConversationTurn,
  ProcessingMetrics,
  SafetyCheckResult
} from './interfaces';
import { validateChildSafeContent } from '../safety/content-safety-filter';
import { sanitizeForLog } from '../models/user-profiles';

export interface IntentProcessingRequest {
  text: string;
  userId: string;
  sessionId?: string;
  timestamp?: Date;
}

export interface IntentProcessingResult {
  success: boolean;
  intent: IntentResult;
  commandResult: CommandResult;
  sessionId: string;
  processingMetrics: ProcessingMetrics;
  safetyChecks: SafetyCheckResult[];
  requiresFollowUp: boolean;
  nextActions?: string[];
}

export interface PipelineConfiguration {
  intentClassifier: {
    confidenceThreshold: number;
    maxAlternatives: number;
  };
  commandRouter: {
    defaultTimeout: number;
    maxConcurrentExecutions: number;
  };
  conversationManager: {
    maxSessionDuration: number;
    maxTurnsPerSession: number;
  };
  safety: {
    enableContentFiltering: boolean;
    defaultAgeGroup: 'child' | 'teen' | 'adult';
  };
}

export class IntentProcessingPipeline extends EventEmitter {
  private intentClassifier: LocalIntentClassifier;
  private commandRouter: VoiceCommandRouter;
  private conversationManager: VoiceConversationManager;
  private config: PipelineConfiguration;
  private isInitialized: boolean = false;

  constructor(config?: Partial<PipelineConfiguration>) {
    super();
    
    this.config = {
      intentClassifier: {
        confidenceThreshold: 0.7,
        maxAlternatives: 3
      },
      commandRouter: {
        defaultTimeout: 5000,
        maxConcurrentExecutions: 3
      },
      conversationManager: {
        maxSessionDuration: 30 * 60 * 1000, // 30 minutes
        maxTurnsPerSession: 100
      },
      safety: {
        enableContentFiltering: true,
        defaultAgeGroup: 'child'
      },
      ...config
    };

    this.initializeComponents();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize all components
      await this.setupEventHandlers();
      
      this.isInitialized = true;
      this.emit('pipelineInitialized');
    } catch (error) {
      this.emit('initializationError', { error });
      throw error;
    }
  }

  async processIntent(request: IntentProcessingRequest): Promise<IntentProcessingResult> {
    if (!this.isInitialized) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = Date.now();
    const safetyChecks: SafetyCheckResult[] = [];
    
    try {
      // Get or create session
      const sessionId = await this.ensureSession(request.userId, request.sessionId);
      
      // Initial safety check
      const inputSafetyCheck = await this.performSafetyCheck(
        'input_validation', 
        request.text, 
        request.userId
      );
      safetyChecks.push(inputSafetyCheck);
      
      if (!inputSafetyCheck.passed) {
        return this.createSafetyBlockedResult(sessionId, safetyChecks, startTime);
      }

      // Get conversation context
      const context = await this.conversationManager.getContext(sessionId);
      if (!context) {
        throw new Error('Failed to get conversation context');
      }

      // Classify intent with context
      const intentClassificationStart = Date.now();
      let intent = await this.intentClassifier.classifyIntent(request.text, context);
      const intentClassificationTime = Date.now() - intentClassificationStart;

      // Handle multi-turn conversations
      intent = await this.conversationManager.handleMultiTurnIntent(sessionId, intent);

      // Extract and complete parameters from context
      const parameterExtractionResult = await this.conversationManager.extractParametersFromContext(
        sessionId,
        this.getRequiredParameters(intent.intent),
        intent.parameters
      );

      // Update intent with extracted parameters
      intent.parameters = parameterExtractionResult.parameters;

      // Route and execute command
      const commandExecutionStart = Date.now();
      const commandResult = await this.commandRouter.routeCommand(intent, request.userId);
      const commandExecutionTime = Date.now() - commandExecutionStart;

      // Response safety check
      const responseSafetyCheck = await this.performSafetyCheck(
        'response_validation',
        commandResult.response,
        request.userId
      );
      safetyChecks.push(responseSafetyCheck);

      // Create conversation turn
      const turn = await this.createConversationTurn(
        request,
        intent,
        commandResult,
        {
          recognitionTime: 0, // Would be provided by speech recognition
          intentClassificationTime,
          safetyValidationTime: safetyChecks.reduce((sum, check) => sum + 10, 0), // Estimated
          commandExecutionTime,
          responseGenerationTime: 0, // Would be provided by response generation
          totalLatency: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          cpuUsage: 0 // Would be measured by system monitor
        }
      );

      // Add turn to conversation
      await this.conversationManager.addTurn(sessionId, turn);

      // Handle pending actions if needed
      if (parameterExtractionResult.needsClarification) {
        await this.handleParameterClarification(sessionId, intent, parameterExtractionResult);
      }

      const totalProcessingTime = Date.now() - startTime;
      
      this.emit('intentProcessed', {
        sessionId,
        intent: intent.intent,
        success: commandResult.success,
        processingTime: totalProcessingTime,
        userId: request.userId
      });

      return {
        success: commandResult.success,
        intent,
        commandResult,
        sessionId,
        processingMetrics: turn.processingMetrics,
        safetyChecks,
        requiresFollowUp: commandResult.requiresFollowUp || parameterExtractionResult.needsClarification,
        nextActions: commandResult.nextActions || parameterExtractionResult.clarificationQuestions
      };

    } catch (error) {
      this.emit('processingError', { error, userId: request.userId });
      
      const errorResult = this.createErrorResult(
        request.sessionId || 'unknown',
        safetyChecks,
        startTime,
        error
      );
      
      return errorResult;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    await this.conversationManager.endSession(sessionId);
    this.emit('sessionEnded', { sessionId });
  }

  async getSessionMetrics(sessionId: string): Promise<any> {
    const session = await this.conversationManager.getSession(sessionId);
    return session ? session.metrics : null;
  }

  private initializeComponents(): void {
    // Initialize entity extractor
    const entityExtractor = new LocalEntityExtractor();
    
    // Initialize intent classifier with entity extractor
    this.intentClassifier = new LocalIntentClassifier(entityExtractor);
    
    // Initialize command router
    this.commandRouter = new VoiceCommandRouter();
    
    // Initialize conversation manager with memory storage
    const sessionStorage = new MemorySessionStorage();
    this.conversationManager = new VoiceConversationManager(sessionStorage);
  }

  private async setupEventHandlers(): Promise<void> {
    // Intent classifier events
    this.intentClassifier.on('intentClassified', (data) => {
      this.emit('intentClassified', data);
    });
    
    this.intentClassifier.on('safetyViolation', (data) => {
      this.emit('safetyViolation', data);
    });

    // Command router events
    this.commandRouter.on('commandExecuted', (data) => {
      this.emit('commandExecuted', data);
    });
    
    this.commandRouter.on('commandFailed', (data) => {
      this.emit('commandFailed', data);
    });

    // Conversation manager events
    this.conversationManager.on('sessionCreated', (data) => {
      this.emit('sessionCreated', data);
    });
    
    this.conversationManager.on('turnAdded', (data) => {
      this.emit('turnAdded', data);
    });
  }

  private async ensureSession(userId: string, sessionId?: string): Promise<string> {
    if (sessionId) {
      const existingSession = await this.conversationManager.getSession(sessionId);
      if (existingSession) {
        return sessionId;
      }
    }
    
    // Create new session
    const newSession = await this.conversationManager.createSession(userId);
    return newSession.id;
  }

  private async performSafetyCheck(
    checkType: string, 
    content: string, 
    userId: string
  ): Promise<SafetyCheckResult> {
    const startTime = Date.now();
    
    try {
      if (this.config.safety.enableContentFiltering) {
        const safetyResult = await validateChildSafeContent(content, userId);
        
        return {
          checkType,
          passed: safetyResult.isAllowed,
          riskLevel: safetyResult.riskLevel,
          details: safetyResult.blockedReasons.join(', '),
          timestamp: new Date()
        };
      } else {
        return {
          checkType,
          passed: true,
          riskLevel: 'low',
          details: 'Safety filtering disabled',
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        checkType,
        passed: false,
        riskLevel: 'high',
        details: 'Safety check failed',
        timestamp: new Date()
      };
    }
  }

  private getRequiredParameters(intent: string): string[] {
    // This would be retrieved from intent definitions
    const parameterMap: Record<string, string[]> = {
      'smart_home.lights.control': ['action', 'location'],
      'scheduling.create_reminder': ['task', 'time'],
      'smart_home.temperature.control': ['action', 'temperature'],
      'information.weather': ['location'],
    };
    
    return parameterMap[intent] || [];
  }

  private async createConversationTurn(
    request: IntentProcessingRequest,
    intent: IntentResult,
    commandResult: CommandResult,
    processingMetrics: ProcessingMetrics
  ): Promise<ConversationTurn> {
    return {
      id: this.generateTurnId(),
      timestamp: request.timestamp || new Date(),
      userInput: request.text,
      recognizedText: request.text, // Would be different if from speech recognition
      intent,
      response: commandResult.response,
      executionResult: commandResult,
      processingMetrics,
      safetyChecks: [] // Would be populated with actual safety checks
    };
  }

  private async handleParameterClarification(
    sessionId: string,
    intent: IntentResult,
    extractionResult: any
  ): Promise<void> {
    // Create pending action for parameter completion
    const pendingAction = {
      id: this.generateActionId(),
      type: 'parameter_clarification',
      parameters: {
        intent: intent.intent,
        missingParameters: extractionResult.missingParameters,
        clarificationQuestions: extractionResult.clarificationQuestions
      },
      requiresConfirmation: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      priority: 'medium' as const,
      dependencies: []
    };

    await this.conversationManager.addPendingAction(sessionId, pendingAction);
  }

  private createSafetyBlockedResult(
    sessionId: string, 
    safetyChecks: SafetyCheckResult[], 
    startTime: number
  ): IntentProcessingResult {
    return {
      success: false,
      intent: {
        intent: 'system.safety_blocked',
        confidence: 1.0,
        parameters: {},
        requiresConfirmation: false
      },
      commandResult: {
        success: false,
        response: "I can't help with that request. Let's try something else!",
        executionTime: 0,
        requiresFollowUp: false
      },
      sessionId,
      processingMetrics: {
        recognitionTime: 0,
        intentClassificationTime: 0,
        safetyValidationTime: Date.now() - startTime,
        commandExecutionTime: 0,
        responseGenerationTime: 0,
        totalLatency: Date.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0
      },
      safetyChecks,
      requiresFollowUp: false
    };
  }

  private createErrorResult(
    sessionId: string,
    safetyChecks: SafetyCheckResult[],
    startTime: number,
    error: any
  ): IntentProcessingResult {
    return {
      success: false,
      intent: {
        intent: 'system.error',
        confidence: 0.0,
        parameters: {},
        requiresConfirmation: false
      },
      commandResult: {
        success: false,
        response: "Something went wrong. Let's try that again!",
        executionTime: 0,
        requiresFollowUp: false
      },
      sessionId,
      processingMetrics: {
        recognitionTime: 0,
        intentClassificationTime: 0,
        safetyValidationTime: 0,
        commandExecutionTime: 0,
        responseGenerationTime: 0,
        totalLatency: Date.now() - startTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0
      },
      safetyChecks,
      requiresFollowUp: false
    };
  }

  private generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    this.conversationManager.destroy();
    this.removeAllListeners();
  }
}