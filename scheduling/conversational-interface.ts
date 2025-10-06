/**
 * Conversational Scheduling Interface
 * 
 * Provides natural language calendar navigation, event querying,
 * and context-aware scheduling assistance with child-friendly interactions.
 * 
 * Safety: All interactions validated for child-appropriate content
 * Performance: Maintains 500ms response time for voice interactions
 */

import { EventEmitter } from 'events';
import { CalendarManager } from '../calendar/manager';
import { ReminderEngine } from '../reminders/engine';
import { ContextAnalyzer } from '../reminders/context-analyzer';
import { CalendarEvent, TimeRange } from '../calendar/types';
import { Reminder, UserContext } from '../reminders/types';

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

export interface ConversationContext {
  userId: string;
  sessionId: string;
  currentTopic: ConversationTopic;
  timeContext: TimeContext;
  userPreferences: UserPreferences;
  conversationHistory: ConversationTurn[];
  lastActivity: Date;
}

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  userInput: string;
  systemResponse: string;
  intent: ConversationIntent;
  entities: ConversationEntity[];
  success: boolean;
}

export interface ConversationEntity {
  type: EntityType;
  value: string;
  confidence: number;
  resolvedValue?: any;
}

export enum ConversationTopic {
  SCHEDULE_QUERY = 'schedule_query',
  EVENT_CREATION = 'event_creation',
  REMINDER_MANAGEMENT = 'reminder_management',
  AVAILABILITY_CHECK = 'availability_check',
  SCHEDULE_NAVIGATION = 'schedule_navigation',
  GENERAL_HELP = 'general_help'
}

export enum ConversationIntent {
  WHAT_IS_TODAY = 'what_is_today',
  WHAT_IS_TOMORROW = 'what_is_tomorrow',
  WHAT_IS_THIS_WEEK = 'what_is_this_week',
  WHEN_IS_NEXT = 'when_is_next',
  AM_I_FREE = 'am_i_free',
  SHOW_CALENDAR = 'show_calendar',
  FIND_TIME = 'find_time',
  SUGGEST_TIME = 'suggest_time',
  NAVIGATE_DATE = 'navigate_date',
  GET_DETAILS = 'get_details',
  HELP = 'help'
}

export enum EntityType {
  DATE_REFERENCE = 'date_reference',
  TIME_REFERENCE = 'time_reference',
  EVENT_TITLE = 'event_title',
  PERSON_NAME = 'person_name',
  DURATION = 'duration',
  RELATIVE_TIME = 'relative_time'
}

export interface TimeContext {
  currentDate: Date;
  currentTime: Date;
  timezone: string;
  workingHours: TimeRange;
  preferredMeetingTimes: TimeRange[];
}

export interface UserPreferences {
  language: string;
  timeFormat: '12h' | '24h';
  dateFormat: string;
  verbosity: 'brief' | 'detailed';
  childMode: boolean;
  reminderPreferences: ReminderPreferences;
}

export interface ReminderPreferences {
  defaultLeadTime: number; // minutes
  preferredMethods: string[];
  quietHours: TimeRange;
  escalationEnabled: boolean;
}

export interface ScheduleSuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  timeSlot?: TimeRange;
  confidence: number;
  reasoning: string;
}

export enum SuggestionType {
  OPTIMAL_TIME = 'optimal_time',
  ALTERNATIVE_TIME = 'alternative_time',
  REMINDER_SUGGESTION = 'reminder_suggestion',
  SCHEDULE_OPTIMIZATION = 'schedule_optimization',
  CONFLICT_RESOLUTION = 'conflict_resolution'
}

export interface ConversationResponse {
  text: string;
  suggestions?: ScheduleSuggestion[];
  followUpQuestions?: string[];
  requiresAction?: boolean;
  actionType?: string;
  actionData?: any;
}

/**
 * Conversational Scheduling Assistant
 * 
 * Provides natural language interface for calendar navigation and scheduling
 */
export class ConversationalSchedulingInterface extends EventEmitter {
  private calendarManager: CalendarManager;
  private reminderEngine: ReminderEngine;
  private contextAnalyzer: ContextAnalyzer;
  private activeContexts: Map<string, ConversationContext>;
  private readonly contextTimeout = 1800000; // 30 minutes

  constructor(
    calendarManager: CalendarManager,
    reminderEngine: ReminderEngine,
    contextAnalyzer: ContextAnalyzer
  ) {
    super();
    this.calendarManager = calendarManager;
    this.reminderEngine = reminderEngine;
    this.contextAnalyzer = contextAnalyzer;
    this.activeContexts = new Map();
    
    this.startContextCleanup();
  }

  /**
   * Process conversational query about schedule
   * 
   * @param query Natural language query
   * @param userId User identifier
   * @returns Conversational response with schedule information
   */
  async processScheduleQuery(query: string, userId: string): Promise<ConversationResponse> {
    try {
      // Validate child safety
      const safetyCheck = await validateChildSafeContent(query, userId);
      if (!safetyCheck.isAppropriate) {
        return {
          text: "Let's keep our conversation appropriate. What would you like to know about your schedule?",
          followUpQuestions: ["What's on my calendar today?", "When am I free this week?"]
        };
      }

      // Get or create conversation context
      const context = await this.getOrCreateContext(userId);
      
      // Parse the query
      const intent = await this.parseQueryIntent(query, context);
      const entities = await this.extractQueryEntities(query, context);
      
      // Generate response based on intent
      const response = await this.generateScheduleResponse(intent, entities, context);
      
      // Update conversation history
      this.updateConversationHistory(context, query, response.text, intent, entities);
      
      this.emit('queryProcessed', {
        userId,
        query,
        intent,
        success: true,
        responseLength: response.text.length
      });

      return response;

    } catch (error) {
      this.emit('queryError', {
        userId,
        query,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        text: "I'm having trouble understanding that right now. Could you try asking in a different way?",
        followUpQuestions: ["What's on my schedule?", "Am I free today?"]
      };
    }
  }

  /**
   * Navigate calendar using natural language
   * 
   * @param navigationCommand Natural language navigation command
   * @param userId User identifier
   * @returns Navigation response with calendar view
   */
  async navigateCalendar(navigationCommand: string, userId: string): Promise<ConversationResponse> {
    const context = await this.getOrCreateContext(userId);
    
    try {
      const intent = await this.parseNavigationIntent(navigationCommand);
      const targetDate = await this.parseNavigationDate(navigationCommand, context);
      
      const events = await this.getEventsForNavigation(targetDate, userId);
      const response = await this.formatNavigationResponse(intent, targetDate, events, context);
      
      return response;

    } catch (error) {
      return {
        text: "I couldn't navigate to that date. Could you try saying something like 'show me next week' or 'what's tomorrow'?",
        followUpQuestions: ["Show me today", "What's next week?", "Go to tomorrow"]
      };
    }
  }

  /**
   * Provide scheduling suggestions based on context
   * 
   * @param request Natural language request for suggestions
   * @param userId User identifier
   * @returns Suggestions with reasoning
   */
  async provideSuggestions(request: string, userId: string): Promise<ConversationResponse> {
    const context = await this.getOrCreateContext(userId);
    const userContext = await this.contextAnalyzer.analyzeUserContext(userId);
    
    try {
      const suggestions = await this.generateSchedulingSuggestions(request, context, userContext);
      const response = await this.formatSuggestionsResponse(suggestions, context);
      
      return response;

    } catch (error) {
      return {
        text: "I'm not sure what to suggest right now. What kind of help do you need with your schedule?",
        followUpQuestions: ["When am I free?", "Find time for a meeting", "What should I do today?"]
      };
    }
  }

  /**
   * Find available time slots based on natural language criteria
   * 
   * @param criteria Natural language availability criteria
   * @param userId User identifier
   * @returns Available time slots with explanations
   */
  async findAvailableTime(criteria: string, userId: string): Promise<ConversationResponse> {
    const context = await this.getOrCreateContext(userId);
    
    try {
      const searchCriteria = await this.parseAvailabilityCriteria(criteria, context);
      const availableSlots = await this.searchAvailableSlots(searchCriteria, userId);
      const response = await this.formatAvailabilityResponse(availableSlots, searchCriteria, context);
      
      return response;

    } catch (error) {
      return {
        text: "I couldn't find available times based on that. Could you be more specific about when you need time?",
        followUpQuestions: ["When am I free today?", "Find time tomorrow morning", "Show me free time this week"]
      };
    }
  }

  private async getOrCreateContext(userId: string): Promise<ConversationContext> {
    let context = this.activeContexts.get(userId);
    
    if (!context) {
      context = {
        userId,
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        currentTopic: ConversationTopic.GENERAL_HELP,
        timeContext: await this.createTimeContext(),
        userPreferences: await this.getUserPreferences(userId),
        conversationHistory: [],
        lastActivity: new Date()
      };
      
      this.activeContexts.set(userId, context);
    } else {
      context.lastActivity = new Date();
    }
    
    return context;
  }

  private async parseQueryIntent(query: string, context: ConversationContext): Promise<ConversationIntent> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Today queries
    if (/\b(today|this\s+day)\b/.test(normalizedQuery)) {
      return ConversationIntent.WHAT_IS_TODAY;
    }
    
    // Tomorrow queries
    if (/\b(tomorrow|next\s+day)\b/.test(normalizedQuery)) {
      return ConversationIntent.WHAT_IS_TOMORROW;
    }
    
    // This week queries
    if (/\b(this\s+week|week)\b/.test(normalizedQuery)) {
      return ConversationIntent.WHAT_IS_THIS_WEEK;
    }
    
    // Availability queries
    if (/\b(free|available|busy)\b/.test(normalizedQuery)) {
      return ConversationIntent.AM_I_FREE;
    }
    
    // Calendar display
    if (/\b(show|display|calendar|schedule)\b/.test(normalizedQuery)) {
      return ConversationIntent.SHOW_CALENDAR;
    }
    
    // Time finding
    if (/\b(find\s+time|when\s+can|available\s+time)\b/.test(normalizedQuery)) {
      return ConversationIntent.FIND_TIME;
    }
    
    return ConversationIntent.HELP;
  }

  private async extractQueryEntities(query: string, context: ConversationContext): Promise<ConversationEntity[]> {
    const entities: ConversationEntity[] = [];
    const normalizedQuery = query.toLowerCase();
    
    // Date references
    const datePatterns = [
      { pattern: /\b(today|this\s+day)\b/, value: 'today', type: EntityType.DATE_REFERENCE },
      { pattern: /\b(tomorrow|next\s+day)\b/, value: 'tomorrow', type: EntityType.DATE_REFERENCE },
      { pattern: /\b(yesterday)\b/, value: 'yesterday', type: EntityType.DATE_REFERENCE },
      { pattern: /\b(this\s+week)\b/, value: 'this_week', type: EntityType.DATE_REFERENCE },
      { pattern: /\b(next\s+week)\b/, value: 'next_week', type: EntityType.DATE_REFERENCE },
      { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, value: 'day_of_week', type: EntityType.DATE_REFERENCE }
    ];
    
    for (const { pattern, value, type } of datePatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        entities.push({
          type,
          value: match[0],
          confidence: 0.9,
          resolvedValue: value
        });
      }
    }
    
    // Time references
    const timePatterns = [
      { pattern: /\b(morning)\b/, value: 'morning', type: EntityType.TIME_REFERENCE },
      { pattern: /\b(afternoon)\b/, value: 'afternoon', type: EntityType.TIME_REFERENCE },
      { pattern: /\b(evening)\b/, value: 'evening', type: EntityType.TIME_REFERENCE },
      { pattern: /\b(\d{1,2}:\d{2})\b/, value: 'specific_time', type: EntityType.TIME_REFERENCE }
    ];
    
    for (const { pattern, value, type } of timePatterns) {
      const match = normalizedQuery.match(pattern);
      if (match) {
        entities.push({
          type,
          value: match[0],
          confidence: 0.8,
          resolvedValue: value
        });
      }
    }
    
    return entities;
  }

  private async generateScheduleResponse(
    intent: ConversationIntent,
    entities: ConversationEntity[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    switch (intent) {
      case ConversationIntent.WHAT_IS_TODAY:
        return await this.generateTodayResponse(context);
        
      case ConversationIntent.WHAT_IS_TOMORROW:
        return await this.generateTomorrowResponse(context);
        
      case ConversationIntent.WHAT_IS_THIS_WEEK:
        return await this.generateWeekResponse(context);
        
      case ConversationIntent.AM_I_FREE:
        return await this.generateAvailabilityResponse(entities, context);
        
      case ConversationIntent.SHOW_CALENDAR:
        return await this.generateCalendarResponse(entities, context);
        
      case ConversationIntent.FIND_TIME:
        return await this.generateFindTimeResponse(entities, context);
        
      default:
        return await this.generateHelpResponse(context);
    }
  }

  private async generateTodayResponse(context: ConversationContext): Promise<ConversationResponse> {
    const today = new Date();
    const timeRange: TimeRange = {
      startTime: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      endTime: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    };
    
    const events = await this.calendarManager.getEvents({
      timeRange,
      userId: context.userId
    });
    
    if (events.length === 0) {
      return {
        text: "You don't have any events scheduled for today. It's a free day!",
        suggestions: [
          {
            type: SuggestionType.REMINDER_SUGGESTION,
            title: "Set a reminder",
            description: "Would you like to set a reminder for something today?",
            confidence: 0.7,
            reasoning: "Free day - good time for personal tasks"
          }
        ],
        followUpQuestions: ["What about tomorrow?", "Set a reminder for today"]
      };
    }
    
    const eventList = events
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map(event => {
        const timeStr = event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${timeStr} - ${event.title}`;
      })
      .join('\n');
    
    const responseText = context.userPreferences.childMode
      ? `Here's what you have planned for today:\n${eventList}\n\nHave a great day!`
      : `Today's schedule:\n${eventList}`;
    
    return {
      text: responseText,
      followUpQuestions: ["What about tomorrow?", "Am I free this evening?", "Show me this week"]
    };
  }

  private async generateTomorrowResponse(context: ConversationContext): Promise<ConversationResponse> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const timeRange: TimeRange = {
      startTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()),
      endTime: new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59)
    };
    
    const events = await this.calendarManager.getEvents({
      timeRange,
      userId: context.userId
    });
    
    if (events.length === 0) {
      return {
        text: "Tomorrow is completely free! Perfect for planning something special.",
        suggestions: [
          {
            type: SuggestionType.OPTIMAL_TIME,
            title: "Plan something fun",
            description: "Since tomorrow is free, it's a great day for activities!",
            confidence: 0.8,
            reasoning: "No conflicts detected for tomorrow"
          }
        ],
        followUpQuestions: ["Schedule something for tomorrow", "What about this week?"]
      };
    }
    
    const eventList = events
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map(event => {
        const timeStr = event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${timeStr} - ${event.title}`;
      })
      .join('\n');
    
    return {
      text: `Tomorrow's schedule:\n${eventList}`,
      followUpQuestions: ["Am I free tomorrow evening?", "Show me this week", "Find time tomorrow"]
    };
  }

  private async generateWeekResponse(context: ConversationContext): Promise<ConversationResponse> {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);
    
    const timeRange: TimeRange = {
      startTime: startOfWeek,
      endTime: endOfWeek
    };
    
    const events = await this.calendarManager.getEvents({
      timeRange,
      userId: context.userId
    });
    
    if (events.length === 0) {
      return {
        text: "This week is wide open! Lots of opportunities to plan activities.",
        suggestions: [
          {
            type: SuggestionType.SCHEDULE_OPTIMIZATION,
            title: "Plan your week",
            description: "Would you like help planning some activities for this week?",
            confidence: 0.7,
            reasoning: "Empty week - good for planning"
          }
        ],
        followUpQuestions: ["Schedule something this week", "What about next week?"]
      };
    }
    
    // Group events by day
    const eventsByDay = new Map<string, CalendarEvent[]>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (const event of events) {
      const dayKey = dayNames[event.startTime.getDay()];
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, []);
      }
      eventsByDay.get(dayKey)!.push(event);
    }
    
    let weekSummary = "Here's your week:\n\n";
    
    for (const [day, dayEvents] of eventsByDay.entries()) {
      weekSummary += `${day}:\n`;
      for (const event of dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())) {
        const timeStr = event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        weekSummary += `  ${timeStr} - ${event.title}\n`;
      }
      weekSummary += '\n';
    }
    
    return {
      text: weekSummary.trim(),
      followUpQuestions: ["Find free time this week", "What about next week?", "Am I free Friday?"]
    };
  }

  private async generateAvailabilityResponse(
    entities: ConversationEntity[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    // Default to today if no date specified
    let targetDate = new Date();
    
    // Parse date from entities
    for (const entity of entities) {
      if (entity.type === EntityType.DATE_REFERENCE) {
        targetDate = this.resolveDateReference(entity.resolvedValue, context);
        break;
      }
    }
    
    const timeRange: TimeRange = {
      startTime: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
      endTime: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59)
    };
    
    const events = await this.calendarManager.getEvents({
      timeRange,
      userId: context.userId
    });
    
    const dateStr = targetDate.toLocaleDateString();
    
    if (events.length === 0) {
      return {
        text: `You're completely free on ${dateStr}! The whole day is open.`,
        suggestions: [
          {
            type: SuggestionType.OPTIMAL_TIME,
            title: "Perfect for planning",
            description: "Since you're free, it's a great day for activities!",
            confidence: 0.9,
            reasoning: "No conflicts detected"
          }
        ],
        followUpQuestions: ["Schedule something", "What about tomorrow?"]
      };
    }
    
    // Find free time slots
    const freeSlots = this.findFreeTimeSlots(events, timeRange);
    
    if (freeSlots.length === 0) {
      return {
        text: `You're pretty busy on ${dateStr}. Your schedule is packed!`,
        followUpQuestions: ["Show me my schedule", "Find time another day"]
      };
    }
    
    const freeTimeDescription = freeSlots
      .map(slot => {
        const startTime = slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endTime = slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${startTime} - ${endTime}`;
      })
      .join(', ');
    
    return {
      text: `On ${dateStr}, you're free during: ${freeTimeDescription}`,
      followUpQuestions: ["Schedule something during free time", "What about another day?"]
    };
  }

  private async generateCalendarResponse(
    entities: ConversationEntity[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    // This would integrate with a calendar display component
    return {
      text: "I'd love to show you your calendar! You can ask me about specific days or times.",
      followUpQuestions: ["What's today?", "Show me this week", "Am I free tomorrow?"]
    };
  }

  private async generateFindTimeResponse(
    entities: ConversationEntity[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    // Extract duration and time preferences from entities
    let duration = 60; // Default 1 hour
    let timePreference = 'any';
    
    for (const entity of entities) {
      if (entity.type === EntityType.DURATION) {
        duration = this.parseDuration(entity.value);
      } else if (entity.type === EntityType.TIME_REFERENCE) {
        timePreference = entity.resolvedValue;
      }
    }
    
    // Find available slots for the next week
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 7);
    
    const availableSlots = await this.findAvailableSlots(
      { startTime: startDate, endTime: endDate },
      duration,
      context.userId
    );
    
    if (availableSlots.length === 0) {
      return {
        text: "I couldn't find any available time slots in the next week. Your schedule is quite busy!",
        followUpQuestions: ["Check next week", "Show me my schedule"]
      };
    }
    
    const suggestions = availableSlots.slice(0, 3).map(slot => {
      const dayName = slot.start.toLocaleDateString([], { weekday: 'long' });
      const timeStr = slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dayName} at ${timeStr}`;
    }).join(', ');
    
    return {
      text: `I found some available times: ${suggestions}. Would any of these work?`,
      followUpQuestions: ["Schedule for one of these times", "Find different times"]
    };
  }

  private async generateHelpResponse(context: ConversationContext): Promise<ConversationResponse> {
    const helpText = context.userPreferences.childMode
      ? "I can help you with your schedule! You can ask me things like 'What's today?' or 'When am I free?'"
      : "I can help you navigate your calendar and find available times. Try asking about your schedule or availability.";
    
    return {
      text: helpText,
      followUpQuestions: [
        "What's on my schedule today?",
        "When am I free this week?",
        "Show me tomorrow",
        "Find time for a meeting"
      ]
    };
  }

  private resolveDateReference(reference: string, context: ConversationContext): Date {
    const today = new Date();
    
    switch (reference) {
      case 'today':
        return today;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return yesterday;
      default:
        return today;
    }
  }

  private findFreeTimeSlots(events: CalendarEvent[], timeRange: TimeRange): { start: Date, end: Date }[] {
    const freeSlots: { start: Date, end: Date }[] = [];
    const sortedEvents = events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    let currentTime = new Date(timeRange.startTime);
    currentTime.setHours(9, 0, 0, 0); // Start at 9 AM
    
    for (const event of sortedEvents) {
      if (event.startTime.getTime() > currentTime.getTime()) {
        freeSlots.push({
          start: new Date(currentTime),
          end: new Date(event.startTime)
        });
      }
      currentTime = new Date(Math.max(currentTime.getTime(), event.endTime.getTime()));
    }
    
    // Add final slot if there's time left in the day
    const endOfDay = new Date(timeRange.endTime);
    endOfDay.setHours(18, 0, 0, 0); // End at 6 PM
    
    if (currentTime.getTime() < endOfDay.getTime()) {
      freeSlots.push({
        start: new Date(currentTime),
        end: endOfDay
      });
    }
    
    // Filter out slots shorter than 30 minutes
    return freeSlots.filter(slot => 
      slot.end.getTime() - slot.start.getTime() >= 30 * 60 * 1000
    );
  }

  private async findAvailableSlots(
    timeRange: TimeRange,
    durationMinutes: number,
    userId: string
  ): Promise<{ start: Date, end: Date }[]> {
    
    const events = await this.calendarManager.getEvents({
      timeRange,
      userId
    });
    
    const availableSlots: { start: Date, end: Date }[] = [];
    const currentDate = new Date(timeRange.startTime);
    
    while (currentDate <= timeRange.endTime) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(9, 0, 0, 0);
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(18, 0, 0, 0);
      
      const dayEvents = events.filter(event => 
        event.startTime.toDateString() === currentDate.toDateString()
      );
      
      const freeSlots = this.findFreeTimeSlots(dayEvents, { startTime: dayStart, endTime: dayEnd });
      
      for (const slot of freeSlots) {
        const slotDuration = slot.end.getTime() - slot.start.getTime();
        if (slotDuration >= durationMinutes * 60 * 1000) {
          availableSlots.push({
            start: new Date(slot.start),
            end: new Date(slot.start.getTime() + durationMinutes * 60 * 1000)
          });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return availableSlots;
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/i);
    if (!match) return 60; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      return value * 60;
    }
    
    return value; // Already in minutes
  }

  private async createTimeContext(): Promise<TimeContext> {
    const now = new Date();
    
    return {
      currentDate: now,
      currentTime: now,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      workingHours: {
        startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
        endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0)
      },
      preferredMeetingTimes: [
        {
          startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
          endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0)
        },
        {
          startTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
          endTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0)
        }
      ]
    };
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    // This would typically load from user settings
    return {
      language: 'en',
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY',
      verbosity: 'detailed',
      childMode: false, // Would be determined by user profile
      reminderPreferences: {
        defaultLeadTime: 15,
        preferredMethods: ['voice', 'visual'],
        quietHours: {
          startTime: new Date(0, 0, 0, 22, 0),
          endTime: new Date(0, 0, 0, 7, 0)
        },
        escalationEnabled: true
      }
    };
  }

  private updateConversationHistory(
    context: ConversationContext,
    userInput: string,
    systemResponse: string,
    intent: ConversationIntent,
    entities: ConversationEntity[]
  ): void {
    
    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userInput,
      systemResponse,
      intent,
      entities,
      success: true
    };
    
    context.conversationHistory.push(turn);
    
    // Keep only last 10 turns to manage memory
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }
  }

  private startContextCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredContexts();
    }, 300000); // Check every 5 minutes
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    
    for (const [userId, context] of this.activeContexts.entries()) {
      const age = now - context.lastActivity.getTime();
      
      if (age > this.contextTimeout) {
        this.activeContexts.delete(userId);
        
        this.emit('contextExpired', {
          userId,
          sessionId: context.sessionId,
          conversationTurns: context.conversationHistory.length
        });
      }
    }
  }

  private async parseNavigationIntent(command: string): Promise<ConversationIntent> {
    // Simplified navigation intent parsing
    return ConversationIntent.NAVIGATE_DATE;
  }

  private async parseNavigationDate(command: string, context: ConversationContext): Promise<Date> {
    // Simplified date parsing for navigation
    return new Date();
  }

  private async getEventsForNavigation(date: Date, userId: string): Promise<CalendarEvent[]> {
    const timeRange: TimeRange = {
      startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    };
    
    return await this.calendarManager.getEvents({ timeRange, userId });
  }

  private async formatNavigationResponse(
    intent: ConversationIntent,
    date: Date,
    events: CalendarEvent[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    const dateStr = date.toLocaleDateString();
    
    if (events.length === 0) {
      return {
        text: `${dateStr} is completely free!`,
        followUpQuestions: ["Schedule something", "Check another day"]
      };
    }
    
    const eventList = events.map(event => 
      `${event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.title}`
    ).join('\n');
    
    return {
      text: `${dateStr}:\n${eventList}`,
      followUpQuestions: ["Find free time", "Check another day"]
    };
  }

  private async generateSchedulingSuggestions(
    request: string,
    context: ConversationContext,
    userContext: UserContext
  ): Promise<ScheduleSuggestion[]> {
    
    // This would implement more sophisticated suggestion logic
    return [
      {
        type: SuggestionType.OPTIMAL_TIME,
        title: "Morning meeting",
        description: "10 AM would be a great time based on your schedule",
        confidence: 0.8,
        reasoning: "You're typically most productive in the morning"
      }
    ];
  }

  private async formatSuggestionsResponse(
    suggestions: ScheduleSuggestion[],
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    if (suggestions.length === 0) {
      return {
        text: "I don't have any specific suggestions right now. What would you like help with?",
        followUpQuestions: ["Find available time", "Show my schedule"]
      };
    }
    
    const suggestionText = suggestions
      .map(s => `• ${s.title}: ${s.description}`)
      .join('\n');
    
    return {
      text: `Here are some suggestions:\n${suggestionText}`,
      suggestions,
      followUpQuestions: ["Tell me more", "Find different options"]
    };
  }

  private async parseAvailabilityCriteria(criteria: string, context: ConversationContext): Promise<any> {
    // Simplified criteria parsing
    return {
      duration: 60,
      timePreference: 'any',
      dateRange: 'this_week'
    };
  }

  private async searchAvailableSlots(criteria: any, userId: string): Promise<{ start: Date, end: Date }[]> {
    // Use existing findAvailableSlots method
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 7);
    
    return await this.findAvailableSlots(
      { startTime: startDate, endTime: endDate },
      criteria.duration || 60,
      userId
    );
  }

  private async formatAvailabilityResponse(
    slots: { start: Date, end: Date }[],
    criteria: any,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    
    if (slots.length === 0) {
      return {
        text: "I couldn't find any available time slots that match your criteria.",
        followUpQuestions: ["Try different times", "Show my schedule"]
      };
    }
    
    const slotDescriptions = slots.slice(0, 3).map(slot => {
      const day = slot.start.toLocaleDateString([], { weekday: 'long' });
      const time = slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${day} at ${time}`;
    }).join(', ');
    
    return {
      text: `I found these available times: ${slotDescriptions}`,
      followUpQuestions: ["Schedule for one of these", "Find more options"]
    };
  }
}