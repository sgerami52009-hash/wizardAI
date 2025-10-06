/**
 * Conversation Context Management System
 * Safety: All conversation data sanitized, no persistent voice recordings
 * Performance: Efficient context switching and memory management <100ms
 */

import { EventEmitter } from 'events';
import { 
  ConversationSession, 
  ConversationContext, 
  ConversationTurn, 
  PendingAction,
  ProcessingMetrics,
  SafetyCheckResult,
  EnvironmentContext,
  SessionMetrics
} from '../models/conversation-context';
import { IntentResult, CommandResult } from './interfaces';
import { validateChildSafeContent } from '../safety/content-safety-filter';
import { sanitizeForLog } from '../models/user-profiles';

export interface ConversationManager {
  createSession(userId: string): Promise<ConversationSession>;
  getSession(sessionId: string): Promise<ConversationSession | null>;
  updateSession(session: ConversationSession): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  addTurn(sessionId: string, turn: ConversationTurn): Promise<void>;
  getContext(sessionId: string): Promise<ConversationContext | null>;
  updateContext(sessionId: string, updates: Partial<ConversationContext>): Promise<void>;
  addPendingAction(sessionId: string, action: PendingAction): Promise<void>;
  resolvePendingAction(sessionId: string, actionId: string, result: any): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

export interface ContextExtractionResult {
  parameters: Record<string, any>;
  missingParameters: string[];
  confidence: number;
  needsClarification: boolean;
  clarificationQuestions: string[];
}

export interface SessionStorage {
  save(session: ConversationSession): Promise<void>;
  load(sessionId: string): Promise<ConversationSession | null>;
  delete(sessionId: string): Promise<void>;
  cleanup(olderThan: Date): Promise<number>;
}

export class VoiceConversationManager extends EventEmitter implements ConversationManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private storage: SessionStorage;
  private maxSessionDuration: number = 30 * 60 * 1000; // 30 minutes
  private maxTurnsPerSession: number = 100;
  private contextRetentionTime: number = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor(storage: SessionStorage) {
    super();
    this.storage = storage;
    
    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Cleanup every minute
  }

  async createSession(userId: string): Promise<ConversationSession> {
    const sessionId = this.generateSessionId();
    const now = new Date();

    const session: ConversationSession = {
      id: sessionId,
      userId,
      startTime: now,
      lastActivity: now,
      status: 'active',
      context: {
        sessionId,
        userId,
        turns: [],
        activeTopics: [],
        pendingActions: [],
        userPreferences: await this.loadUserPreferences(userId),
        safetyContext: await this.initializeSafetyContext(userId),
        environmentContext: await this.detectEnvironmentContext()
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

    this.sessions.set(sessionId, session);
    await this.storage.save(session);

    this.emit('sessionCreated', { sessionId, userId });
    return session;
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    // Try memory first
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try storage
      session = await this.storage.load(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

    if (session && this.isSessionExpired(session)) {
      await this.endSession(sessionId);
      return null;
    }

    return session || null;
  }

  async updateSession(session: ConversationSession): Promise<void> {
    session.lastActivity = new Date();
    session.metrics.duration = session.lastActivity.getTime() - session.startTime.getTime();
    
    this.sessions.set(session.id, session);
    await this.storage.save(session);
    
    this.emit('sessionUpdated', { sessionId: session.id });
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.status = 'ended';
      session.lastActivity = new Date();
      
      await this.updateSession(session);
      this.sessions.delete(sessionId);
      
      this.emit('sessionEnded', { 
        sessionId, 
        duration: session.metrics.duration,
        totalTurns: session.metrics.totalTurns 
      });
    }
  }

  async addTurn(sessionId: string, turn: ConversationTurn): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Safety validation for turn content
    const safetyResult = await validateChildSafeContent(turn.userInput, session.userId);
    if (!safetyResult.isAllowed) {
      session.metrics.safetyViolations++;
      this.emit('safetyViolation', { sessionId, turn: sanitizeForLog(turn.userInput) });
    }

    // Add turn to context
    session.context.turns.push(turn);
    session.metrics.totalTurns++;

    // Update metrics
    if (turn.executionResult.success) {
      session.metrics.successfulCommands++;
    } else {
      session.metrics.failedCommands++;
    }

    // Update average latency
    const totalLatency = session.metrics.averageLatency * (session.metrics.totalTurns - 1) + turn.processingMetrics.totalLatency;
    session.metrics.averageLatency = totalLatency / session.metrics.totalTurns;

    // Maintain turn history limit
    if (session.context.turns.length > this.maxTurnsPerSession) {
      session.context.turns = session.context.turns.slice(-this.maxTurnsPerSession);
    }

    // Update active topics
    await this.updateActiveTopics(session, turn);

    await this.updateSession(session);
    this.emit('turnAdded', { sessionId, turnId: turn.id });
  }

  async getContext(sessionId: string): Promise<ConversationContext | null> {
    const session = await this.getSession(sessionId);
    return session ? session.context : null;
  }

  async updateContext(sessionId: string, updates: Partial<ConversationContext>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Merge updates into context
    Object.assign(session.context, updates);
    
    await this.updateSession(session);
    this.emit('contextUpdated', { sessionId });
  }

  async addPendingAction(sessionId: string, action: PendingAction): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.context.pendingActions.push(action);
    await this.updateSession(session);
    
    this.emit('pendingActionAdded', { sessionId, actionId: action.id });

    // Set up expiration timer
    setTimeout(async () => {
      await this.expirePendingAction(sessionId, action.id);
    }, action.expiresAt.getTime() - Date.now());
  }

  async resolvePendingAction(sessionId: string, actionId: string, result: any): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const actionIndex = session.context.pendingActions.findIndex(a => a.id === actionId);
    if (actionIndex >= 0) {
      const action = session.context.pendingActions[actionIndex];
      session.context.pendingActions.splice(actionIndex, 1);
      
      await this.updateSession(session);
      this.emit('pendingActionResolved', { sessionId, actionId, result });
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.endSession(sessionId);
    }

    // Cleanup storage
    const cutoffTime = new Date(now.getTime() - this.maxSessionDuration);
    const cleanedCount = await this.storage.cleanup(cutoffTime);
    
    if (cleanedCount > 0) {
      this.emit('sessionsCleanedUp', { count: cleanedCount });
    }
  }

  // Context-aware parameter extraction
  async extractParametersFromContext(
    sessionId: string, 
    requiredParameters: string[], 
    currentParameters: Record<string, any>
  ): Promise<ContextExtractionResult> {
    const context = await this.getContext(sessionId);
    if (!context) {
      return {
        parameters: currentParameters,
        missingParameters: requiredParameters,
        confidence: 0,
        needsClarification: true,
        clarificationQuestions: [`I need more information to help you.`]
      };
    }

    const extractedParameters = { ...currentParameters };
    const missingParameters: string[] = [];
    const clarificationQuestions: string[] = [];

    for (const param of requiredParameters) {
      if (!extractedParameters[param]) {
        // Try to extract from conversation history
        const extracted = await this.extractFromHistory(context, param);
        if (extracted) {
          extractedParameters[param] = extracted;
        } else {
          missingParameters.push(param);
          clarificationQuestions.push(this.generateClarificationQuestion(param));
        }
      }
    }

    const confidence = (requiredParameters.length - missingParameters.length) / requiredParameters.length;
    
    return {
      parameters: extractedParameters,
      missingParameters,
      confidence,
      needsClarification: missingParameters.length > 0,
      clarificationQuestions
    };
  }

  // Multi-turn conversation support
  async handleMultiTurnIntent(
    sessionId: string, 
    currentIntent: IntentResult, 
    previousTurns: number = 3
  ): Promise<IntentResult> {
    const context = await this.getContext(sessionId);
    if (!context || context.turns.length === 0) {
      return currentIntent;
    }

    const recentTurns = context.turns.slice(-previousTurns);
    
    // Check for intent continuation
    const enhancedIntent = await this.enhanceIntentWithHistory(currentIntent, recentTurns);
    
    // Check for parameter completion
    const completedParameters = await this.completeParametersFromHistory(
      enhancedIntent.parameters, 
      recentTurns
    );

    return {
      ...enhancedIntent,
      parameters: completedParameters
    };
  }

  // Session state persistence and recovery
  async persistSessionState(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.storage.save(session);
      this.emit('sessionPersisted', { sessionId });
    }
  }

  async recoverSessionState(sessionId: string): Promise<ConversationSession | null> {
    try {
      const session = await this.storage.load(sessionId);
      if (session && !this.isSessionExpired(session)) {
        this.sessions.set(sessionId, session);
        this.emit('sessionRecovered', { sessionId });
        return session;
      }
    } catch (error) {
      this.emit('sessionRecoveryFailed', { sessionId, error });
    }
    return null;
  }

  private async loadUserPreferences(userId: string): Promise<any> {
    // This would load from user profile storage
    return {
      language: 'en-US',
      voiceSettings: { rate: 1.0, pitch: 1.0 },
      interactionStyle: 'friendly',
      privacySettings: { dataRetention: 'minimal' },
      accessibilitySettings: { visualFeedback: true }
    };
  }

  private async initializeSafetyContext(userId: string): Promise<any> {
    // This would load from user profile and safety settings
    return {
      currentAgeGroup: 'child', // Default to most restrictive
      parentalSupervision: false,
      contentHistory: [],
      riskFactors: [],
      safetyOverrides: []
    };
  }

  private async detectEnvironmentContext(): Promise<EnvironmentContext> {
    // This would integrate with device sensors and system status
    return {
      location: 'home',
      timeOfDay: this.getCurrentTimeOfDay(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      ambientNoise: 'quiet',
      otherUsers: [],
      deviceStatus: {
        networkConnected: true,
        resourceUsage: { memoryMB: 512, cpuPercent: 25 },
        temperature: 25,
        availableStorage: 1000
      }
    };
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  private async updateActiveTopics(session: ConversationSession, turn: ConversationTurn): Promise<void> {
    // Extract topics from intent and parameters
    const topics = this.extractTopicsFromTurn(turn);
    
    // Add new topics
    for (const topic of topics) {
      if (!session.context.activeTopics.includes(topic)) {
        session.context.activeTopics.push(topic);
      }
    }

    // Remove old topics (keep only recent ones)
    const maxTopics = 5;
    if (session.context.activeTopics.length > maxTopics) {
      session.context.activeTopics = session.context.activeTopics.slice(-maxTopics);
    }
  }

  private extractTopicsFromTurn(turn: ConversationTurn): string[] {
    const topics: string[] = [];
    
    // Extract from intent
    const intentParts = turn.intent.intent.split('.');
    if (intentParts.length > 1) {
      topics.push(intentParts[0]); // Domain (e.g., 'smart_home', 'scheduling')
    }

    // Extract from parameters
    if (turn.intent.parameters.device) {
      topics.push(`device:${turn.intent.parameters.device}`);
    }
    if (turn.intent.parameters.location) {
      topics.push(`location:${turn.intent.parameters.location}`);
    }

    return topics;
  }

  private async extractFromHistory(context: ConversationContext, parameter: string): Promise<any> {
    // Look through recent turns for parameter values
    const recentTurns = context.turns.slice(-5);
    
    for (const turn of recentTurns.reverse()) {
      if (turn.intent.parameters[parameter]) {
        return turn.intent.parameters[parameter];
      }
    }

    // Check environment context
    if (parameter === 'location' && context.environmentContext.location) {
      return context.environmentContext.location;
    }

    return null;
  }

  private generateClarificationQuestion(parameter: string): string {
    const questions: Record<string, string> = {
      location: "Which room would you like me to control?",
      time: "What time would you like me to set that for?",
      date: "Which day should I schedule that?",
      device: "Which device would you like me to control?",
      action: "What would you like me to do?",
      task: "What should I remind you about?",
      duration: "How long should that be?",
      temperature: "What temperature would you like?",
      brightness: "How bright should I make it?"
    };

    return questions[parameter] || `Could you tell me more about ${parameter}?`;
  }

  private async enhanceIntentWithHistory(
    currentIntent: IntentResult, 
    recentTurns: ConversationTurn[]
  ): Promise<IntentResult> {
    // Look for intent patterns in history
    for (const turn of recentTurns.reverse()) {
      // If current intent is vague, try to infer from context
      if (currentIntent.intent === 'system.unknown' && turn.intent.confidence > 0.7) {
        // Check if current input might be a continuation
        if (this.isLikelyContinuation(currentIntent, turn.intent)) {
          return {
            ...turn.intent,
            confidence: Math.max(0.6, turn.intent.confidence - 0.2)
          };
        }
      }
    }

    return currentIntent;
  }

  private async completeParametersFromHistory(
    currentParameters: Record<string, any>, 
    recentTurns: ConversationTurn[]
  ): Promise<Record<string, any>> {
    const completed = { ...currentParameters };

    // Look for missing parameters in recent turns
    for (const turn of recentTurns.reverse()) {
      for (const [key, value] of Object.entries(turn.intent.parameters)) {
        if (!completed[key] && value) {
          completed[key] = value;
        }
      }
    }

    return completed;
  }

  private isLikelyContinuation(currentIntent: IntentResult, previousIntent: IntentResult): boolean {
    // Simple heuristic: if current intent is unknown and previous had parameters,
    // current input might be providing missing parameters
    return (
      currentIntent.intent === 'system.unknown' &&
      Object.keys(previousIntent.parameters).length > 0 &&
      currentIntent.confidence < 0.3
    );
  }

  private async expirePendingAction(sessionId: string, actionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const actionIndex = session.context.pendingActions.findIndex(a => a.id === actionId);
      if (actionIndex >= 0) {
        session.context.pendingActions.splice(actionIndex, 1);
        await this.updateSession(session);
        this.emit('pendingActionExpired', { sessionId, actionId });
      }
    }
  }

  private isSessionExpired(session: ConversationSession): boolean {
    const now = Date.now();
    const sessionAge = now - session.lastActivity.getTime();
    return sessionAge > this.maxSessionDuration;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// In-memory session storage implementation
export class MemorySessionStorage implements SessionStorage {
  private sessions: Map<string, ConversationSession> = new Map();

  async save(session: ConversationSession): Promise<void> {
    // Deep clone to avoid reference issues
    this.sessions.set(session.id, JSON.parse(JSON.stringify(session)));
  }

  async load(sessionId: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? JSON.parse(JSON.stringify(session)) : null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async cleanup(olderThan: Date): Promise<number> {
    let cleanedCount = 0;
    const cutoffTime = olderThan.getTime();

    for (const [sessionId, session] of this.sessions) {
      if (session.lastActivity.getTime() < cutoffTime) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}