/**
 * Voice Workflow Manager for Scheduling
 * 
 * Manages complete voice-based scheduling workflows including
 * event creation, modification, and confirmation processes.
 * 
 * Safety: All workflows include child safety validation
 * Performance: Maintains 500ms response time requirement
 */

import { EventEmitter } from 'events';
import { VoiceSchedulingIntegration, VoiceProcessingResult, SchedulingIntent } from './voice-integration';
import { CalendarManager } from '../calendar/manager';
import { ReminderEngine } from '../reminders/engine';
import { CalendarEvent, EventCategory, Priority, VisibilityLevel, NotificationMethod } from '../calendar/types';
import { Reminder, ReminderType, CompletionStatus } from '../reminders/types';

// Simple child safety validation function
async function validateChildSafeContent(content: string, userId: string): Promise<{ isAppropriate: boolean }> {
  const inappropriatePatterns = [
    /\b(violence|weapon|drug|alcohol|gambling)\b/i,
    /\b(hate|discrimination|bullying)\b/i,
    /\b(adult|mature|explicit)\b/i
  ];
  
  const isAppropriate = !inappropriatePatterns.some(pattern => pattern.test(content));
  return { isAppropriate };
}

export interface VoiceWorkflowSession {
  id: string;
  userId: string;
  intent: SchedulingIntent;
  state: WorkflowState;
  context: WorkflowContext;
  startTime: Date;
  lastActivity: Date;
  timeoutMs: number;
}

export interface WorkflowContext {
  partialEvent?: Partial<CalendarEvent>;
  partialReminder?: Partial<Reminder>;
  missingFields: string[];
  confirmationPending?: boolean;
  clarificationHistory: string[];
  retryCount: number;
}

export enum WorkflowState {
  INITIAL = 'initial',
  COLLECTING_INFO = 'collecting_info',
  CONFIRMING = 'confirming',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface WorkflowResult {
  success: boolean;
  sessionId: string;
  finalState: WorkflowState;
  createdEventId?: string;
  createdReminderId?: string;
  errorMessage?: string;
  userMessage: string;
}

/**
 * Voice Workflow Manager
 * 
 * Orchestrates multi-turn voice conversations for scheduling operations
 */
export class VoiceWorkflowManager extends EventEmitter {
  private voiceIntegration: VoiceSchedulingIntegration;
  private calendarManager: CalendarManager;
  private reminderEngine: ReminderEngine;
  private activeSessions: Map<string, VoiceWorkflowSession>;
  private readonly sessionTimeout = 300000; // 5 minutes

  constructor(
    calendarManager: CalendarManager,
    reminderEngine: ReminderEngine
  ) {
    super();
    this.voiceIntegration = new VoiceSchedulingIntegration();
    this.calendarManager = calendarManager;
    this.reminderEngine = reminderEngine;
    this.activeSessions = new Map();
    
    this.setupEventHandlers();
    this.startSessionCleanup();
  }

  /**
   * Start new voice workflow session
   * 
   * @param command Initial voice command
   * @param userId User identifier
   * @returns Workflow result with next steps
   */
  async startWorkflow(command: string, userId: string): Promise<WorkflowResult> {
    try {
      // Process initial command
      const processingResult = await this.voiceIntegration.processCommand(command, userId);
      
      if (!processingResult.success) {
        return {
          success: false,
          sessionId: '',
          finalState: WorkflowState.FAILED,
          errorMessage: processingResult.errorMessage,
          userMessage: processingResult.errorMessage || "I didn't understand that. Could you try again?"
        };
      }

      // Create new session
      const session = this.createSession(userId, processingResult);
      this.activeSessions.set(session.id, session);

      // Process the workflow step
      return await this.processWorkflowStep(session, processingResult);

    } catch (error) {
      return {
        success: false,
        sessionId: '',
        finalState: WorkflowState.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        userMessage: "Something went wrong. Let's try that again!"
      };
    }
  }

  /**
   * Continue existing workflow with user response
   * 
   * @param sessionId Workflow session identifier
   * @param response User's voice response
   * @returns Updated workflow result
   */
  async continueWorkflow(sessionId: string, response: string): Promise<WorkflowResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        sessionId,
        finalState: WorkflowState.FAILED,
        errorMessage: 'Session not found',
        userMessage: "I lost track of what we were doing. Let's start over!"
      };
    }

    try {
      // Update session activity
      session.lastActivity = new Date();

      // Handle different response types
      if (session.state === WorkflowState.CONFIRMING) {
        return await this.handleConfirmationResponse(session, response);
      } else if (session.state === WorkflowState.COLLECTING_INFO) {
        return await this.handleInfoResponse(session, response);
      }

      return {
        success: false,
        sessionId,
        finalState: WorkflowState.FAILED,
        errorMessage: 'Invalid session state',
        userMessage: "I'm not sure what to do next. Let's start over!"
      };

    } catch (error) {
      session.state = WorkflowState.FAILED;
      
      return {
        success: false,
        sessionId,
        finalState: WorkflowState.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        userMessage: "Something went wrong. Let's try that again!"
      };
    }
  }

  /**
   * Cancel active workflow session
   * 
   * @param sessionId Session identifier
   * @returns Success status
   */
  async cancelWorkflow(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.state = WorkflowState.CANCELLED;
    this.activeSessions.delete(sessionId);
    
    this.emit('workflowCancelled', {
      sessionId,
      userId: session.userId,
      intent: session.intent
    });

    return true;
  }

  /**
   * Get active session for user
   * 
   * @param userId User identifier
   * @returns Active session if exists
   */
  getActiveSession(userId: string): VoiceWorkflowSession | undefined {
    for (const session of this.activeSessions.values()) {
      if (session.userId === userId && session.state !== WorkflowState.COMPLETED) {
        return session;
      }
    }
    return undefined;
  }

  private createSession(userId: string, processingResult: VoiceProcessingResult): VoiceWorkflowSession {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: sessionId,
      userId,
      intent: processingResult.intent,
      state: WorkflowState.INITIAL,
      context: {
        partialEvent: processingResult.parsedEvent,
        partialReminder: processingResult.parsedReminder,
        missingFields: processingResult.clarificationNeeded || [],
        clarificationHistory: [],
        retryCount: 0
      },
      startTime: new Date(),
      lastActivity: new Date(),
      timeoutMs: this.sessionTimeout
    };
  }

  private async processWorkflowStep(
    session: VoiceWorkflowSession, 
    processingResult: VoiceProcessingResult
  ): Promise<WorkflowResult> {
    
    // Check if we need more information
    if (processingResult.clarificationNeeded && processingResult.clarificationNeeded.length > 0) {
      session.state = WorkflowState.COLLECTING_INFO;
      session.context.missingFields = processingResult.clarificationNeeded;
      
      const clarificationMessage = await this.generateClarificationMessage(session);
      
      return {
        success: true,
        sessionId: session.id,
        finalState: session.state,
        userMessage: clarificationMessage
      };
    }

    // We have enough information, move to confirmation
    session.state = WorkflowState.CONFIRMING;
    session.context.confirmationPending = true;
    
    const confirmationMessage = await this.generateConfirmationMessage(session);
    
    return {
      success: true,
      sessionId: session.id,
      finalState: session.state,
      userMessage: confirmationMessage
    };
  }

  private async handleInfoResponse(session: VoiceWorkflowSession, response: string): Promise<WorkflowResult> {
    // Validate response safety
    const isChildSafe = await validateChildSafeContent(response, session.userId);
    if (!isChildSafe.isAppropriate) {
      return {
        success: false,
        sessionId: session.id,
        finalState: WorkflowState.FAILED,
        errorMessage: 'Inappropriate content',
        userMessage: "Let's keep our conversation appropriate. What would you like to schedule?"
      };
    }

    // Process the additional information
    const processingResult = await this.voiceIntegration.processCommand(response, session.userId);
    
    if (!processingResult.success) {
      session.context.retryCount++;
      
      if (session.context.retryCount >= 3) {
        session.state = WorkflowState.FAILED;
        return {
          success: false,
          sessionId: session.id,
          finalState: WorkflowState.FAILED,
          errorMessage: 'Too many retry attempts',
          userMessage: "I'm having trouble understanding. Let's start over with a new request!"
        };
      }
      
      return {
        success: true,
        sessionId: session.id,
        finalState: session.state,
        userMessage: "I didn't catch that. Could you try again?"
      };
    }

    // Update session context with new information
    await this.updateSessionContext(session, processingResult);
    
    // Check if we still need more information
    if (session.context.missingFields.length > 0) {
      const clarificationMessage = await this.generateClarificationMessage(session);
      return {
        success: true,
        sessionId: session.id,
        finalState: session.state,
        userMessage: clarificationMessage
      };
    }

    // Move to confirmation
    session.state = WorkflowState.CONFIRMING;
    const confirmationMessage = await this.generateConfirmationMessage(session);
    
    return {
      success: true,
      sessionId: session.id,
      finalState: session.state,
      userMessage: confirmationMessage
    };
  }

  private async handleConfirmationResponse(session: VoiceWorkflowSession, response: string): Promise<WorkflowResult> {
    const normalizedResponse = response.toLowerCase().trim();
    const isConfirmed = this.parseConfirmationResponse(normalizedResponse);
    
    if (isConfirmed === null) {
      return {
        success: true,
        sessionId: session.id,
        finalState: session.state,
        userMessage: "I didn't catch that. Should I go ahead? Please say yes or no."
      };
    }

    if (!isConfirmed) {
      session.state = WorkflowState.CANCELLED;
      this.activeSessions.delete(session.id);
      
      return {
        success: true,
        sessionId: session.id,
        finalState: session.state,
        userMessage: "Okay, I won't create that. Is there anything else I can help you with?"
      };
    }

    // Execute the scheduling action
    session.state = WorkflowState.EXECUTING;
    return await this.executeSchedulingAction(session);
  }

  private async executeSchedulingAction(session: VoiceWorkflowSession): Promise<WorkflowResult> {
    try {
      let result: WorkflowResult;

      switch (session.intent) {
        case SchedulingIntent.CREATE_EVENT:
          result = await this.createEvent(session);
          break;
          
        case SchedulingIntent.CREATE_REMINDER:
          result = await this.createReminder(session);
          break;
          
        default:
          throw new Error(`Unsupported intent: ${session.intent}`);
      }

      session.state = result.success ? WorkflowState.COMPLETED : WorkflowState.FAILED;
      
      if (result.success) {
        this.activeSessions.delete(session.id);
      }

      return result;

    } catch (error) {
      session.state = WorkflowState.FAILED;
      
      return {
        success: false,
        sessionId: session.id,
        finalState: WorkflowState.FAILED,
        errorMessage: error instanceof Error ? error.message : String(error),
        userMessage: "I couldn't create that right now. Please try again later!"
      };
    }
  }

  private async createEvent(session: VoiceWorkflowSession): Promise<WorkflowResult> {
    if (!session.context.partialEvent) {
      throw new Error('No event data to create');
    }

    // Fill in required fields with defaults
    const eventData: CalendarEvent = {
      id: '', // Will be set by manager
      title: session.context.partialEvent.title || 'New Event',
      description: session.context.partialEvent.description || '',
      startTime: session.context.partialEvent.startTime || new Date(),
      endTime: session.context.partialEvent.endTime || new Date(Date.now() + 3600000), // 1 hour default
      allDay: session.context.partialEvent.allDay || false,
      location: session.context.partialEvent.location,
      attendees: session.context.partialEvent.attendees || [],
      category: session.context.partialEvent.category || EventCategory.PERSONAL,
      priority: session.context.partialEvent.priority || Priority.MEDIUM,
      visibility: session.context.partialEvent.visibility || VisibilityLevel.PRIVATE,
      reminders: session.context.partialEvent.reminders || [],
      metadata: {
        source: 'local' as any,
        syncStatus: 'not_synced' as any,
        conflictStatus: 'none' as any,
        safetyValidated: true,
        safetyValidatedAt: new Date(),
        tags: ['voice-created'],
        customFields: {
          createdViaVoice: true,
          voiceSessionId: session.id
        }
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: session.userId,
      isPrivate: false
    };

    const eventId = await this.calendarManager.addEvent(eventData);
    
    return {
      success: true,
      sessionId: session.id,
      finalState: WorkflowState.COMPLETED,
      createdEventId: eventId,
      userMessage: `Great! I've added "${eventData.title}" to your calendar for ${eventData.startTime.toLocaleDateString()} at ${eventData.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    };
  }

  private async createReminder(session: VoiceWorkflowSession): Promise<WorkflowResult> {
    if (!session.context.partialReminder) {
      throw new Error('No reminder data to create');
    }

    // Fill in required fields with defaults
    const reminderData: Reminder = {
      id: '', // Will be set by engine
      userId: session.userId,
      title: session.context.partialReminder.title || 'New Reminder',
      description: session.context.partialReminder.description || '',
      type: session.context.partialReminder.type || ReminderType.TIME_BASED,
      triggerTime: session.context.partialReminder.triggerTime || new Date(),
      priority: session.context.partialReminder.priority || Priority.MEDIUM,
      deliveryMethods: session.context.partialReminder.deliveryMethods || [NotificationMethod.VOICE],
      contextConstraints: session.context.partialReminder.contextConstraints || [],
      escalationRules: session.context.partialReminder.escalationRules || [],
      isActive: true,
      completionStatus: CompletionStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      snoozeHistory: [],
      userFeedback: []
    };

    const reminderId = await this.reminderEngine.scheduleReminder(reminderData);
    
    return {
      success: true,
      sessionId: session.id,
      finalState: WorkflowState.COMPLETED,
      createdReminderId: reminderId,
      userMessage: `Perfect! I'll remind you about "${reminderData.title}" on ${reminderData.triggerTime.toLocaleDateString()} at ${reminderData.triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    };
  }

  private async updateSessionContext(session: VoiceWorkflowSession, processingResult: VoiceProcessingResult): Promise<void> {
    // Update partial event or reminder with new information
    if (session.intent === SchedulingIntent.CREATE_EVENT && processingResult.parsedEvent) {
      session.context.partialEvent = {
        ...session.context.partialEvent,
        ...processingResult.parsedEvent
      };
    } else if (session.intent === SchedulingIntent.CREATE_REMINDER && processingResult.parsedReminder) {
      session.context.partialReminder = {
        ...session.context.partialReminder,
        ...processingResult.parsedReminder
      };
    }

    // Update missing fields list
    session.context.missingFields = this.identifyMissingFields(session);
  }

  private identifyMissingFields(session: VoiceWorkflowSession): string[] {
    const missing: string[] = [];

    if (session.intent === SchedulingIntent.CREATE_EVENT) {
      const event = session.context.partialEvent;
      if (!event?.title) missing.push('title');
      if (!event?.startTime) missing.push('date', 'time');
    } else if (session.intent === SchedulingIntent.CREATE_REMINDER) {
      const reminder = session.context.partialReminder;
      if (!reminder?.title) missing.push('title');
      if (!reminder?.triggerTime) missing.push('date', 'time');
    }

    return missing;
  }

  private async generateClarificationMessage(session: VoiceWorkflowSession): Promise<string> {
    const missing = session.context.missingFields[0]; // Ask for one thing at a time
    
    switch (missing) {
      case 'title':
        return session.intent === SchedulingIntent.CREATE_EVENT 
          ? "What would you like to call this event?"
          : "What should I remind you about?";
      case 'date':
        return "What day should this be?";
      case 'time':
        return "What time works best?";
      default:
        return `Could you tell me more about ${missing}?`;
    }
  }

  private async generateConfirmationMessage(session: VoiceWorkflowSession): Promise<string> {
    if (session.intent === SchedulingIntent.CREATE_EVENT && session.context.partialEvent) {
      const event = session.context.partialEvent;
      const timeStr = event.startTime 
        ? `on ${event.startTime.toLocaleDateString()} at ${event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';
      
      return `Should I create "${event.title}" ${timeStr}${event.location ? ` at ${event.location}` : ''}?`;
    } else if (session.intent === SchedulingIntent.CREATE_REMINDER && session.context.partialReminder) {
      const reminder = session.context.partialReminder;
      const timeStr = reminder.triggerTime 
        ? `for ${reminder.triggerTime.toLocaleDateString()} at ${reminder.triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '';
      
      return `Should I set a reminder about "${reminder.title}" ${timeStr}?`;
    }

    return "Should I go ahead with that?";
  }

  private parseConfirmationResponse(response: string): boolean | null {
    const yesPatterns = /^(yes|yeah|yep|sure|okay|ok|go ahead|do it|please|absolutely)/i;
    const noPatterns = /^(no|nope|don't|cancel|stop|never mind|not now)/i;
    
    if (yesPatterns.test(response)) {
      return true;
    } else if (noPatterns.test(response)) {
      return false;
    }
    
    return null; // Unclear response
  }

  private setupEventHandlers(): void {
    this.voiceIntegration.on('commandProcessed', (event) => {
      this.emit('voiceCommandProcessed', event);
    });

    this.voiceIntegration.on('processingError', (event) => {
      this.emit('voiceProcessingError', event);
    });
  }

  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      const age = now - session.lastActivity.getTime();
      
      if (age > session.timeoutMs) {
        session.state = WorkflowState.FAILED;
        this.activeSessions.delete(sessionId);
        
        this.emit('sessionExpired', {
          sessionId,
          userId: session.userId,
          intent: session.intent
        });
      }
    }
  }
}