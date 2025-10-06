/**
 * Voice Integration for Scheduling System
 * 
 * Provides natural language processing for scheduling commands,
 * integrating with the voice pipeline for calendar and reminder operations.
 * 
 * Safety: All voice commands are validated for child-appropriate content
 * Performance: Voice processing must complete within 500ms per requirement
 */

import { EventEmitter } from 'events';
import { CalendarEvent, TimeRange, Priority, NotificationMethod } from '../calendar/types';
import { Reminder, ReminderType } from '../reminders/types';

// Simple child safety validation function
async function validateChildSafeContent(content: string, userId: string): Promise<{ isAppropriate: boolean }> {
  // Basic inappropriate content patterns
  const inappropriatePatterns = [
    /\b(violence|weapon|drug|alcohol|gambling)\b/i,
    /\b(hate|discrimination|bullying)\b/i,
    /\b(adult|mature|explicit)\b/i
  ];
  
  const isAppropriate = !inappropriatePatterns.some(pattern => pattern.test(content));
  return { isAppropriate };
}

export interface VoiceCommand {
  id: string;
  userId: string;
  command: string;
  intent: SchedulingIntent;
  entities: CommandEntity[];
  confidence: number;
  timestamp: Date;
  isChildSafe: boolean;
}

export interface CommandEntity {
  type: EntityType;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export enum SchedulingIntent {
  CREATE_EVENT = 'create_event',
  UPDATE_EVENT = 'update_event',
  DELETE_EVENT = 'delete_event',
  CREATE_REMINDER = 'create_reminder',
  UPDATE_REMINDER = 'update_reminder',
  DELETE_REMINDER = 'delete_reminder',
  QUERY_SCHEDULE = 'query_schedule',
  CHECK_AVAILABILITY = 'check_availability',
  UNKNOWN = 'unknown'
}

export enum EntityType {
  DATE = 'date',
  TIME = 'time',
  DURATION = 'duration',
  TITLE = 'title',
  DESCRIPTION = 'description',
  LOCATION = 'location',
  PERSON = 'person',
  PRIORITY = 'priority',
  RECURRENCE = 'recurrence'
}

export interface VoiceProcessingResult {
  success: boolean;
  intent: SchedulingIntent;
  entities: CommandEntity[];
  parsedEvent?: Partial<CalendarEvent>;
  parsedReminder?: Partial<Reminder>;
  clarificationNeeded?: string[];
  errorMessage?: string;
  processingTime: number;
}

export interface VoiceConfirmation {
  id: string;
  userId: string;
  action: string;
  details: string;
  requiresConfirmation: boolean;
  confirmationPrompt: string;
  timeout: number;
}

/**
 * Voice Command Processor for Scheduling Operations
 * 
 * Handles natural language processing of scheduling commands with
 * child safety validation and performance optimization.
 */
export class VoiceSchedulingProcessor extends EventEmitter {
  private readonly processingTimeout = 500; // 500ms max per requirement
  private readonly intentPatterns: Map<SchedulingIntent, RegExp[]>;
  private readonly entityPatterns: Map<EntityType, RegExp[]>;

  constructor() {
    super();
    this.intentPatterns = this.initializeIntentPatterns();
    this.entityPatterns = this.initializeEntityPatterns();
  }

  /**
   * Process voice command for scheduling operations
   * 
   * @param command Raw voice command text
   * @param userId User identifier for context
   * @returns Processing result with extracted intent and entities
   */
  async processVoiceCommand(command: string, userId: string): Promise<VoiceProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Validate child safety first
      const isChildSafe = await this.validateCommandSafety(command, userId);
      if (!isChildSafe) {
        return {
          success: false,
          intent: SchedulingIntent.UNKNOWN,
          entities: [],
          errorMessage: "I can't help with that request. Let's try something else!",
          processingTime: Date.now() - startTime
        };
      }

      // Extract intent and entities with timeout protection
      const voiceCommand = await Promise.race([
        this.extractIntentAndEntities(command, userId),
        this.createTimeoutPromise()
      ]);

      // Parse command into scheduling objects
      const result = await this.parseSchedulingCommand(voiceCommand);
      
      this.emit('voiceCommandProcessed', {
        userId,
        intent: result.intent,
        success: result.success,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.emit('voiceProcessingError', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        processingTime
      });

      return {
        success: false,
        intent: SchedulingIntent.UNKNOWN,
        entities: [],
        errorMessage: "I didn't catch that. Could you try again?",
        processingTime
      };
    }
  }

  /**
   * Create confirmation prompt for scheduling actions
   * 
   * @param result Processing result requiring confirmation
   * @param userId User identifier
   * @returns Confirmation object with child-friendly prompts
   */
  async createConfirmation(result: VoiceProcessingResult, userId: string): Promise<VoiceConfirmation> {
    const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let action = '';
    let details = '';
    let prompt = '';

    switch (result.intent) {
      case SchedulingIntent.CREATE_EVENT:
        action = 'create event';
        details = this.formatEventDetails(result.parsedEvent!);
        prompt = `Should I create "${result.parsedEvent?.title}" for ${details}?`;
        break;
        
      case SchedulingIntent.CREATE_REMINDER:
        action = 'create reminder';
        details = this.formatReminderDetails(result.parsedReminder!);
        prompt = `Should I set a reminder for "${result.parsedReminder?.title}" ${details}?`;
        break;
        
      case SchedulingIntent.DELETE_EVENT:
        action = 'delete event';
        prompt = `Should I remove this event from your calendar?`;
        break;
        
      default:
        action = 'unknown action';
        prompt = `Should I go ahead with this?`;
    }

    return {
      id: confirmationId,
      userId,
      action,
      details,
      requiresConfirmation: true,
      confirmationPrompt: prompt,
      timeout: 30000 // 30 second timeout
    };
  }

  /**
   * Handle clarification requests for incomplete commands
   * 
   * @param result Processing result needing clarification
   * @returns Child-friendly clarification questions
   */
  async requestClarification(result: VoiceProcessingResult): Promise<string[]> {
    const questions: string[] = [];

    if (result.clarificationNeeded) {
      for (const missing of result.clarificationNeeded) {
        switch (missing) {
          case 'title':
            questions.push("What would you like to call this event?");
            break;
          case 'date':
            questions.push("What day should this be?");
            break;
          case 'time':
            questions.push("What time works best?");
            break;
          case 'duration':
            questions.push("How long will this take?");
            break;
          default:
            questions.push(`Could you tell me more about ${missing}?`);
        }
      }
    }

    return questions;
  }

  private async validateCommandSafety(command: string, userId: string): Promise<boolean> {
    try {
      // Use existing child safety validation
      const safetyResult = await validateChildSafeContent(command, userId);
      return safetyResult.isAppropriate;
    } catch (error) {
      // Fail safe - block if validation fails
      return false;
    }
  }

  private async extractIntentAndEntities(command: string, userId: string): Promise<VoiceCommand> {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Extract intent
    const intent = this.classifyIntent(normalizedCommand);
    
    // Extract entities
    const entities = this.extractEntities(normalizedCommand);
    
    return {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      command: normalizedCommand,
      intent,
      entities,
      confidence: this.calculateConfidence(intent, entities),
      timestamp: new Date(),
      isChildSafe: true // Already validated
    };
  }

  private classifyIntent(command: string): SchedulingIntent {
    for (const [intent, patterns] of this.intentPatterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(command)) {
          return intent;
        }
      }
    }
    return SchedulingIntent.UNKNOWN;
  }

  private extractEntities(command: string): CommandEntity[] {
    const entities: CommandEntity[] = [];
    
    for (const [entityType, patterns] of this.entityPatterns.entries()) {
      for (const pattern of patterns) {
        const matches = Array.from(command.matchAll(new RegExp(pattern, 'gi')));
        
        for (const match of matches) {
          if (match.index !== undefined) {
            entities.push({
              type: entityType,
              value: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              confidence: 0.8 // Base confidence
            });
          }
        }
      }
    }
    
    return entities;
  }

  private async parseSchedulingCommand(voiceCommand: VoiceCommand): Promise<VoiceProcessingResult> {
    const startTime = Date.now();
    
    try {
      let parsedEvent: Partial<CalendarEvent> | undefined;
      let parsedReminder: Partial<Reminder> | undefined;
      const clarificationNeeded: string[] = [];

      switch (voiceCommand.intent) {
        case SchedulingIntent.CREATE_EVENT:
          parsedEvent = this.parseEventFromEntities(voiceCommand.entities);
          if (!parsedEvent.title) clarificationNeeded.push('title');
          if (!parsedEvent.startTime) clarificationNeeded.push('date', 'time');
          break;
          
        case SchedulingIntent.CREATE_REMINDER:
          parsedReminder = this.parseReminderFromEntities(voiceCommand.entities);
          if (!parsedReminder.title) clarificationNeeded.push('title');
          if (!parsedReminder.triggerTime) clarificationNeeded.push('date', 'time');
          break;
      }

      return {
        success: true,
        intent: voiceCommand.intent,
        entities: voiceCommand.entities,
        parsedEvent,
        parsedReminder,
        clarificationNeeded: clarificationNeeded.length > 0 ? clarificationNeeded : undefined,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        intent: SchedulingIntent.UNKNOWN,
        entities: [],
        errorMessage: "I had trouble understanding that. Could you try again?",
        processingTime: Date.now() - startTime
      };
    }
  }

  private parseEventFromEntities(entities: CommandEntity[]): Partial<CalendarEvent> {
    const event: Partial<CalendarEvent> = {
      priority: Priority.MEDIUM,
      allDay: false,
      attendees: [],
      reminders: []
    };

    for (const entity of entities) {
      switch (entity.type) {
        case EntityType.TITLE:
          event.title = entity.value;
          break;
        case EntityType.DESCRIPTION:
          event.description = entity.value;
          break;
        case EntityType.DATE:
          // Parse date - simplified for now
          event.startTime = this.parseDate(entity.value);
          break;
        case EntityType.TIME:
          // Parse time - simplified for now
          if (event.startTime) {
            event.startTime = this.parseTime(entity.value, event.startTime);
          }
          break;
        case EntityType.LOCATION:
          event.location = { name: entity.value, type: 'other' as any };
          break;
      }
    }

    return event;
  }

  private parseReminderFromEntities(entities: CommandEntity[]): Partial<Reminder> {
    const reminder: Partial<Reminder> = {
      type: ReminderType.TIME_BASED,
      priority: Priority.MEDIUM,
      deliveryMethods: [NotificationMethod.VOICE],
      isActive: true
    };

    for (const entity of entities) {
      switch (entity.type) {
        case EntityType.TITLE:
          reminder.title = entity.value;
          break;
        case EntityType.DESCRIPTION:
          reminder.description = entity.value;
          break;
        case EntityType.DATE:
          reminder.triggerTime = this.parseDate(entity.value);
          break;
        case EntityType.TIME:
          if (reminder.triggerTime) {
            reminder.triggerTime = this.parseTime(entity.value, reminder.triggerTime);
          }
          break;
      }
    }

    return reminder;
  }

  private parseDate(dateString: string): Date {
    // Simplified date parsing - would need more robust implementation
    const today = new Date();
    
    if (dateString.includes('today')) {
      return today;
    } else if (dateString.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    
    // Default to today if can't parse
    return today;
  }

  private parseTime(timeString: string, baseDate: Date): Date {
    // Simplified time parsing - would need more robust implementation
    const result = new Date(baseDate);
    
    const timeMatch = timeString.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      result.setHours(hours, minutes, 0, 0);
    }
    
    return result;
  }

  private calculateConfidence(intent: SchedulingIntent, entities: CommandEntity[]): number {
    let confidence = 0.5; // Base confidence
    
    if (intent !== SchedulingIntent.UNKNOWN) {
      confidence += 0.3;
    }
    
    // Boost confidence based on number of recognized entities
    confidence += Math.min(entities.length * 0.1, 0.2);
    
    return Math.min(confidence, 1.0);
  }

  private formatEventDetails(event: Partial<CalendarEvent>): string {
    const parts: string[] = [];
    
    if (event.startTime) {
      parts.push(event.startTime.toLocaleDateString());
      parts.push('at');
      parts.push(event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    if (event.location) {
      parts.push('at');
      parts.push(event.location.name);
    }
    
    return parts.join(' ');
  }

  private formatReminderDetails(reminder: Partial<Reminder>): string {
    if (reminder.triggerTime) {
      return `on ${reminder.triggerTime.toLocaleDateString()} at ${reminder.triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return '';
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Voice processing timeout'));
      }, this.processingTimeout);
    });
  }

  private initializeIntentPatterns(): Map<SchedulingIntent, RegExp[]> {
    return new Map([
      [SchedulingIntent.CREATE_EVENT, [
        /^(create|add|schedule|make|set up)\s+(an?\s+)?(event|appointment|meeting)/i,
        /^(plan|book)\s+/i,
        /^i\s+(need|want)\s+to\s+(schedule|plan|add)/i
      ]],
      [SchedulingIntent.CREATE_REMINDER, [
        /^(remind|set\s+a?\s+reminder|don't\s+let\s+me\s+forget)/i,
        /^(alert|notify)\s+me/i,
        /^i\s+need\s+a\s+reminder/i
      ]],
      [SchedulingIntent.UPDATE_EVENT, [
        /^(change|update|modify|edit|move)\s+(the\s+)?(event|appointment|meeting)/i,
        /^(reschedule|postpone)/i
      ]],
      [SchedulingIntent.DELETE_EVENT, [
        /^(delete|remove|cancel|clear)\s+(the\s+)?(event|appointment|meeting)/i,
        /^(get\s+rid\s+of|take\s+off)/i
      ]],
      [SchedulingIntent.QUERY_SCHEDULE, [
        /^(what|show|tell\s+me)\s+(do\s+i\s+have|is\s+on\s+my\s+schedule|are\s+my\s+events)/i,
        /^(check|look\s+at)\s+my\s+(calendar|schedule)/i,
        /^what's\s+(next|coming\s+up|on\s+my\s+calendar)/i,
        /what's\s+on\s+my\s+schedule/i
      ]],
      [SchedulingIntent.CHECK_AVAILABILITY, [
        /^(am\s+i|are\s+we)\s+(free|available|busy)/i,
        /^(do\s+i|do\s+we)\s+have\s+(anything|plans)/i,
        /^(when\s+am\s+i|when\s+are\s+we)\s+(free|available)/i
      ]]
    ]);
  }

  private initializeEntityPatterns(): Map<EntityType, RegExp[]> {
    return new Map([
      [EntityType.DATE, [
        /\b(today|tomorrow|yesterday)\b/i,
        /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
        /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/,
        /\b(next|this)\s+(week|month|year)\b/i
      ]],
      [EntityType.TIME, [
        /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,
        /\b\d{1,2}\s*(am|pm)\b/i,
        /\b(morning|afternoon|evening|night)\b/i,
        /\b(noon|midnight)\b/i
      ]],
      [EntityType.DURATION, [
        /\b\d+\s*(minutes?|mins?|hours?|hrs?|days?)\b/i,
        /\b(half\s+an?\s+hour|thirty\s+minutes)\b/i,
        /\b(an?\s+hour|one\s+hour)\b/i
      ]],
      [EntityType.LOCATION, [
        /\bat\s+([^,\n]+)/i,
        /\bin\s+([^,\n]+)/i,
        /\broom\s+\w+/i
      ]],
      [EntityType.PRIORITY, [
        /\b(urgent|important|high\s+priority)\b/i,
        /\b(low\s+priority|not\s+urgent)\b/i
      ]]
    ]);
  }
}

/**
 * Voice Integration Manager
 * 
 * Coordinates voice command processing with the scheduling system
 */
export class VoiceSchedulingIntegration extends EventEmitter {
  private processor: VoiceSchedulingProcessor;
  private activeConfirmations: Map<string, VoiceConfirmation>;

  constructor() {
    super();
    this.processor = new VoiceSchedulingProcessor();
    this.activeConfirmations = new Map();
    
    this.setupEventHandlers();
  }

  /**
   * Process voice command and return result
   * 
   * @param command Voice command text
   * @param userId User identifier
   * @returns Processing result with scheduling data
   */
  async processCommand(command: string, userId: string): Promise<VoiceProcessingResult> {
    return await this.processor.processVoiceCommand(command, userId);
  }

  /**
   * Handle confirmation response from user
   * 
   * @param confirmationId Confirmation identifier
   * @param confirmed User's yes/no response
   * @returns Success status
   */
  async handleConfirmation(confirmationId: string, confirmed: boolean): Promise<boolean> {
    const confirmation = this.activeConfirmations.get(confirmationId);
    if (!confirmation) {
      return false;
    }

    this.activeConfirmations.delete(confirmationId);
    
    this.emit('confirmationReceived', {
      confirmationId,
      confirmed,
      userId: confirmation.userId,
      action: confirmation.action
    });

    return true;
  }

  /**
   * Get active confirmation for user
   * 
   * @param userId User identifier
   * @returns Active confirmation if exists
   */
  getActiveConfirmation(userId: string): VoiceConfirmation | undefined {
    for (const confirmation of this.activeConfirmations.values()) {
      if (confirmation.userId === userId) {
        return confirmation;
      }
    }
    return undefined;
  }

  private setupEventHandlers(): void {
    this.processor.on('voiceCommandProcessed', (event) => {
      this.emit('commandProcessed', event);
    });

    this.processor.on('voiceProcessingError', (event) => {
      this.emit('processingError', event);
    });

    // Clean up expired confirmations
    setInterval(() => {
      this.cleanupExpiredConfirmations();
    }, 30000); // Check every 30 seconds
  }

  private cleanupExpiredConfirmations(): void {
    const now = Date.now();
    
    for (const [id, confirmation] of this.activeConfirmations.entries()) {
      const age = now - confirmation.timeout;
      if (age > confirmation.timeout) {
        this.activeConfirmations.delete(id);
        
        this.emit('confirmationExpired', {
          confirmationId: id,
          userId: confirmation.userId
        });
      }
    }
  }
}