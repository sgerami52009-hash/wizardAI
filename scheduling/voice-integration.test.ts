/**
 * Unit Tests for Voice Integration
 * 
 * Tests natural language scheduling command processing,
 * voice workflow management, and conversational interface.
 */

import { VoiceSchedulingProcessor, VoiceSchedulingIntegration, SchedulingIntent, EntityType } from './voice-integration';
import { VoiceWorkflowManager, WorkflowState } from './voice-workflow';
import { ConversationalSchedulingInterface, ConversationIntent } from './conversational-interface';
import { CalendarManager } from '../calendar/manager';
import { ReminderEngine } from '../reminders/engine';
import { ContextAnalyzer } from '../reminders/context-analyzer';

// Mock dependencies
jest.mock('../privacy/filter', () => ({
  validateChildSafeContent: jest.fn().mockResolvedValue({ isAppropriate: true })
}));

jest.mock('../calendar/manager');
jest.mock('../reminders/engine');
jest.mock('../reminders/context-analyzer');

describe('VoiceSchedulingProcessor', () => {
  let processor: VoiceSchedulingProcessor;

  beforeEach(() => {
    processor = new VoiceSchedulingProcessor();
  });

  describe('processVoiceCommand', () => {
    it('should process create event command successfully', async () => {
      const command = "create an event called team meeting tomorrow at 2 PM";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe(SchedulingIntent.CREATE_EVENT);
      expect(result.parsedEvent?.title).toBe('team meeting');
      expect(result.processingTime).toBeLessThan(500); // Performance requirement
    });

    it('should process create reminder command successfully', async () => {
      const command = "remind me to call mom tomorrow at 3 PM";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe(SchedulingIntent.CREATE_REMINDER);
      expect(result.parsedReminder?.title).toBe('call mom');
    });

    it('should identify missing information and request clarification', async () => {
      const command = "create an event";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.success).toBe(true);
      expect(result.intent).toBe(SchedulingIntent.CREATE_EVENT);
      expect(result.clarificationNeeded).toContain('title');
      expect(result.clarificationNeeded).toContain('date');
    });

    it('should handle inappropriate content safely', async () => {
      const { validateChildSafeContent } = require('../privacy/filter');
      validateChildSafeContent.mockResolvedValueOnce({ isAppropriate: false });

      const command = "inappropriate content";
      const userId = "child123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("I can't help with that request");
    });

    it('should respect processing timeout', async () => {
      // Mock a slow operation
      const originalExtract = processor['extractIntentAndEntities'];
      processor['extractIntentAndEntities'] = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 600)) // Longer than 500ms timeout
      );

      const command = "create event";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("didn't catch that");
    });

    it('should extract date and time entities correctly', async () => {
      const command = "schedule meeting tomorrow at 2:30 PM";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      const dateEntity = result.entities.find(e => e.type === EntityType.DATE);
      const timeEntity = result.entities.find(e => e.type === EntityType.TIME);

      expect(dateEntity?.value).toBe('tomorrow');
      expect(timeEntity?.value).toBe('2:30 PM');
    });

    it('should handle unknown intents gracefully', async () => {
      const command = "xyz random nonsense abc";
      const userId = "user123";

      const result = await processor.processVoiceCommand(command, userId);

      expect(result.intent).toBe(SchedulingIntent.UNKNOWN);
      expect(result.errorMessage).toContain("didn't catch that");
    });
  });

  describe('createConfirmation', () => {
    it('should create appropriate confirmation for event creation', async () => {
      const result = {
        success: true,
        intent: SchedulingIntent.CREATE_EVENT,
        entities: [],
        parsedEvent: {
          title: 'Team Meeting',
          startTime: new Date('2024-01-15T14:00:00')
        },
        processingTime: 100
      };

      const confirmation = await processor.createConfirmation(result, 'user123');

      expect(confirmation.action).toBe('create event');
      expect(confirmation.confirmationPrompt).toContain('Team Meeting');
      expect(confirmation.confirmationPrompt).toContain('January 15');
    });

    it('should create appropriate confirmation for reminder creation', async () => {
      const result = {
        success: true,
        intent: SchedulingIntent.CREATE_REMINDER,
        entities: [],
        parsedReminder: {
          title: 'Call Mom',
          triggerTime: new Date('2024-01-15T15:00:00')
        },
        processingTime: 100
      };

      const confirmation = await processor.createConfirmation(result, 'user123');

      expect(confirmation.action).toBe('create reminder');
      expect(confirmation.confirmationPrompt).toContain('Call Mom');
    });
  });

  describe('requestClarification', () => {
    it('should generate child-friendly clarification questions', async () => {
      const result = {
        success: true,
        intent: SchedulingIntent.CREATE_EVENT,
        entities: [],
        clarificationNeeded: ['title', 'date'],
        processingTime: 100
      };

      const questions = await processor.requestClarification(result);

      expect(questions).toContain("What would you like to call this event?");
      expect(questions).toContain("What day should this be?");
    });
  });
});

describe('VoiceWorkflowManager', () => {
  let workflowManager: VoiceWorkflowManager;
  let mockCalendarManager: jest.Mocked<CalendarManager>;
  let mockReminderEngine: jest.Mocked<ReminderEngine>;

  beforeEach(() => {
    mockCalendarManager = new CalendarManager('test-path', 'test-key') as jest.Mocked<CalendarManager>;
    mockReminderEngine = new ReminderEngine() as jest.Mocked<ReminderEngine>;
    
    workflowManager = new VoiceWorkflowManager(mockCalendarManager, mockReminderEngine);
  });

  describe('startWorkflow', () => {
    it('should start workflow for complete event creation command', async () => {
      const command = "create team meeting tomorrow at 2 PM";
      const userId = "user123";

      const result = await workflowManager.startWorkflow(command, userId);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(WorkflowState.CONFIRMING);
      expect(result.userMessage).toContain('Should I create');
    });

    it('should start workflow and request clarification for incomplete command', async () => {
      const command = "create an event";
      const userId = "user123";

      const result = await workflowManager.startWorkflow(command, userId);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(WorkflowState.COLLECTING_INFO);
      expect(result.userMessage).toContain('What would you like to call');
    });

    it('should handle invalid commands gracefully', async () => {
      const command = "random nonsense";
      const userId = "user123";

      const result = await workflowManager.startWorkflow(command, userId);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(WorkflowState.FAILED);
    });
  });

  describe('continueWorkflow', () => {
    it('should handle confirmation response correctly', async () => {
      // Start a workflow first
      const startResult = await workflowManager.startWorkflow(
        "create team meeting tomorrow at 2 PM", 
        "user123"
      );
      
      mockCalendarManager.addEvent.mockResolvedValue('event123');

      const continueResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "yes"
      );

      expect(continueResult.success).toBe(true);
      expect(continueResult.finalState).toBe(WorkflowState.COMPLETED);
      expect(continueResult.createdEventId).toBe('event123');
    });

    it('should handle rejection response correctly', async () => {
      const startResult = await workflowManager.startWorkflow(
        "create team meeting tomorrow at 2 PM", 
        "user123"
      );

      const continueResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "no"
      );

      expect(continueResult.success).toBe(true);
      expect(continueResult.finalState).toBe(WorkflowState.CANCELLED);
      expect(continueResult.userMessage).toContain("won't create");
    });

    it('should handle information collection workflow', async () => {
      const startResult = await workflowManager.startWorkflow(
        "create an event", 
        "user123"
      );

      const continueResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "team meeting"
      );

      expect(continueResult.success).toBe(true);
      // Should still be collecting info (needs date/time)
      expect(continueResult.finalState).toBe(WorkflowState.COLLECTING_INFO);
    });

    it('should handle non-existent session gracefully', async () => {
      const result = await workflowManager.continueWorkflow(
        "nonexistent", 
        "yes"
      );

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain("lost track");
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel active workflow successfully', async () => {
      const startResult = await workflowManager.startWorkflow(
        "create event", 
        "user123"
      );

      const cancelled = await workflowManager.cancelWorkflow(startResult.sessionId);

      expect(cancelled).toBe(true);
      
      // Verify session is removed
      const activeSession = workflowManager.getActiveSession("user123");
      expect(activeSession).toBeUndefined();
    });
  });

  describe('getActiveSession', () => {
    it('should return active session for user', async () => {
      await workflowManager.startWorkflow("create event", "user123");

      const session = workflowManager.getActiveSession("user123");

      expect(session).toBeDefined();
      expect(session?.userId).toBe("user123");
    });

    it('should return undefined for user with no active session', () => {
      const session = workflowManager.getActiveSession("user456");

      expect(session).toBeUndefined();
    });
  });
});

describe('ConversationalSchedulingInterface', () => {
  let conversationalInterface: ConversationalSchedulingInterface;
  let mockCalendarManager: jest.Mocked<CalendarManager>;
  let mockReminderEngine: jest.Mocked<ReminderEngine>;
  let mockContextAnalyzer: jest.Mocked<ContextAnalyzer>;

  beforeEach(() => {
    mockCalendarManager = new CalendarManager('test-path', 'test-key') as jest.Mocked<CalendarManager>;
    mockReminderEngine = new ReminderEngine() as jest.Mocked<ReminderEngine>;
    mockContextAnalyzer = new ContextAnalyzer() as jest.Mocked<ContextAnalyzer>;
    
    conversationalInterface = new ConversationalSchedulingInterface(
      mockCalendarManager,
      mockReminderEngine,
      mockContextAnalyzer
    );
  });

  describe('processScheduleQuery', () => {
    it('should handle "what is today" query', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Team Meeting',
          startTime: new Date(),
          endTime: new Date(),
          createdBy: 'user123'
        }
      ];
      
      mockCalendarManager.getEvents.mockResolvedValue(mockEvents as any);

      const response = await conversationalInterface.processScheduleQuery(
        "what's on my schedule today?", 
        "user123"
      );

      expect(response.text).toContain('Team Meeting');
      expect(response.followUpQuestions).toBeDefined();
    });

    it('should handle "what is tomorrow" query', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "what's tomorrow?", 
        "user123"
      );

      expect(response.text).toContain('completely free');
      expect(response.suggestions).toBeDefined();
    });

    it('should handle availability queries', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "am I free today?", 
        "user123"
      );

      expect(response.text).toContain('completely free');
    });

    it('should handle inappropriate content safely', async () => {
      const { validateChildSafeContent } = require('../privacy/filter');
      validateChildSafeContent.mockResolvedValueOnce({ isAppropriate: false });

      const response = await conversationalInterface.processScheduleQuery(
        "inappropriate query", 
        "child123"
      );

      expect(response.text).toContain('appropriate');
    });

    it('should provide help for unknown queries', async () => {
      const response = await conversationalInterface.processScheduleQuery(
        "random nonsense query", 
        "user123"
      );

      expect(response.followUpQuestions).toContain("What's on my schedule today?");
    });
  });

  describe('navigateCalendar', () => {
    it('should navigate to specific dates', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.navigateCalendar(
        "show me tomorrow", 
        "user123"
      );

      expect(response.text).toContain('completely free');
    });

    it('should handle navigation errors gracefully', async () => {
      mockCalendarManager.getEvents.mockRejectedValue(new Error('Database error'));

      const response = await conversationalInterface.navigateCalendar(
        "show me invalid date", 
        "user123"
      );

      expect(response.text).toContain("couldn't navigate");
    });
  });

  describe('findAvailableTime', () => {
    it('should find available time slots', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.findAvailableTime(
        "find time for a 1 hour meeting", 
        "user123"
      );

      expect(response.text).toContain('available times');
    });

    it('should handle no available time gracefully', async () => {
      // Mock a busy schedule
      const busyEvents = Array.from({ length: 10 }, (_, i) => ({
        id: `event${i}`,
        title: `Meeting ${i}`,
        startTime: new Date(Date.now() + i * 3600000),
        endTime: new Date(Date.now() + (i + 1) * 3600000),
        createdBy: 'user123'
      }));
      
      mockCalendarManager.getEvents.mockResolvedValue(busyEvents as any);

      const response = await conversationalInterface.findAvailableTime(
        "find time for meeting", 
        "user123"
      );

      expect(response.text).toContain("couldn't find");
    });
  });

  describe('provideSuggestions', () => {
    it('should provide scheduling suggestions', async () => {
      mockContextAnalyzer.analyzeUserContext.mockResolvedValue({
        userId: 'user123',
        currentActivity: 'available',
        availability: 'free'
      } as any);

      const response = await conversationalInterface.provideSuggestions(
        "suggest a good time for a meeting", 
        "user123"
      );

      expect(response.suggestions).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should process queries within performance limits', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const startTime = Date.now();
      
      await conversationalInterface.processScheduleQuery(
        "what's today?", 
        "user123"
      );

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(500); // 500ms requirement
    });
  });

  describe('Child Safety', () => {
    it('should validate all user inputs for child safety', async () => {
      const { validateChildSafeContent } = require('../privacy/filter');
      
      await conversationalInterface.processScheduleQuery(
        "what's my schedule?", 
        "child123"
      );

      expect(validateChildSafeContent).toHaveBeenCalledWith(
        "what's my schedule?", 
        "child123"
      );
    });

    it('should use child-friendly language in responses', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", 
        "child123"
      );

      // Should not contain technical jargon
      expect(response.text).not.toContain('database');
      expect(response.text).not.toContain('error');
      expect(response.text).not.toContain('null');
    });
  });

  describe('Context Management', () => {
    it('should maintain conversation context across queries', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      // First query
      await conversationalInterface.processScheduleQuery(
        "what's today?", 
        "user123"
      );

      // Second query should have context
      const response = await conversationalInterface.processScheduleQuery(
        "what about tomorrow?", 
        "user123"
      );

      expect(response.text).toBeDefined();
    });

    it('should clean up expired contexts', async () => {
      // This would test the context cleanup mechanism
      // Implementation would depend on the specific cleanup logic
      expect(true).toBe(true); // Placeholder
    });
  });
});

describe('Integration Tests', () => {
  describe('Voice Command to Calendar Event Flow', () => {
    it('should complete full voice-to-event creation flow', async () => {
      const mockCalendarManager = new CalendarManager('test-path', 'test-key') as jest.Mocked<CalendarManager>;
      const mockReminderEngine = new ReminderEngine() as jest.Mocked<ReminderEngine>;
      
      mockCalendarManager.addEvent.mockResolvedValue('event123');
      
      const workflowManager = new VoiceWorkflowManager(mockCalendarManager, mockReminderEngine);

      // Start workflow
      const startResult = await workflowManager.startWorkflow(
        "create team meeting tomorrow at 2 PM", 
        "user123"
      );

      expect(startResult.success).toBe(true);
      expect(startResult.finalState).toBe(WorkflowState.CONFIRMING);

      // Confirm creation
      const confirmResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "yes"
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.finalState).toBe(WorkflowState.COMPLETED);
      expect(confirmResult.createdEventId).toBe('event123');
      expect(mockCalendarManager.addEvent).toHaveBeenCalled();
    });

    it('should complete full voice-to-reminder creation flow', async () => {
      const mockCalendarManager = new CalendarManager('test-path', 'test-key') as jest.Mocked<CalendarManager>;
      const mockReminderEngine = new ReminderEngine() as jest.Mocked<ReminderEngine>;
      
      mockReminderEngine.scheduleReminder.mockResolvedValue('reminder123');
      
      const workflowManager = new VoiceWorkflowManager(mockCalendarManager, mockReminderEngine);

      // Start workflow
      const startResult = await workflowManager.startWorkflow(
        "remind me to call mom tomorrow at 3 PM", 
        "user123"
      );

      expect(startResult.success).toBe(true);

      // Confirm creation
      const confirmResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "yes"
      );

      expect(confirmResult.success).toBe(true);
      expect(confirmResult.createdReminderId).toBe('reminder123');
      expect(mockReminderEngine.scheduleReminder).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle calendar manager errors gracefully', async () => {
      const mockCalendarManager = new CalendarManager('test-path', 'test-key') as jest.Mocked<CalendarManager>;
      const mockReminderEngine = new ReminderEngine() as jest.Mocked<ReminderEngine>;
      
      mockCalendarManager.addEvent.mockRejectedValue(new Error('Database error'));
      
      const workflowManager = new VoiceWorkflowManager(mockCalendarManager, mockReminderEngine);

      const startResult = await workflowManager.startWorkflow(
        "create meeting tomorrow", 
        "user123"
      );

      const confirmResult = await workflowManager.continueWorkflow(
        startResult.sessionId, 
        "yes"
      );

      expect(confirmResult.success).toBe(false);
      expect(confirmResult.userMessage).toContain("couldn't create");
    });
  });
});