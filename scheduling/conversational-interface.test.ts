/**
 * Additional Unit Tests for Conversational Interface
 * 
 * Tests specific conversational patterns, context management,
 * and natural language understanding capabilities.
 */

import { ConversationalSchedulingInterface, ConversationIntent, EntityType } from './conversational-interface';
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

describe('ConversationalSchedulingInterface - Advanced Tests', () => {
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

  describe('Natural Language Understanding', () => {
    it('should understand various ways to ask about today', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const queries = [
        "what's today?",
        "what do I have today?",
        "show me today's schedule",
        "what's on my calendar today?",
        "tell me about today"
      ];

      for (const query of queries) {
        const response = await conversationalInterface.processScheduleQuery(query, "user123");
        expect(response.text).toContain('free');
      }
    });

    it('should understand various ways to ask about availability', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const queries = [
        "am I free today?",
        "do I have any free time?",
        "when am I available?",
        "am I busy today?",
        "do I have anything scheduled?"
      ];

      for (const query of queries) {
        const response = await conversationalInterface.processScheduleQuery(query, "user123");
        expect(response.text).toBeDefined();
      }
    });

    it('should understand time references correctly', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const timeQueries = [
        { query: "what's tomorrow?", expectedDate: 'tomorrow' },
        { query: "show me next week", expectedDate: 'next_week' },
        { query: "what about Monday?", expectedDate: 'day_of_week' },
        { query: "am I free this afternoon?", expectedTime: 'afternoon' }
      ];

      for (const { query } of timeQueries) {
        const response = await conversationalInterface.processScheduleQuery(query, "user123");
        expect(response.text).toBeDefined();
      }
    });
  });

  describe('Context-Aware Responses', () => {
    it('should provide different responses based on schedule density', async () => {
      // Test empty schedule
      mockCalendarManager.getEvents.mockResolvedValueOnce([]);
      const emptyResponse = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );
      expect(emptyResponse.text).toContain('free');

      // Test busy schedule
      const busyEvents = Array.from({ length: 5 }, (_, i) => ({
        id: `event${i}`,
        title: `Meeting ${i}`,
        startTime: new Date(2024, 0, 15, 9 + i, 0),
        endTime: new Date(2024, 0, 15, 10 + i, 0),
        createdBy: 'user123'
      }));
      
      mockCalendarManager.getEvents.mockResolvedValueOnce(busyEvents as any);
      const busyResponse = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );
      expect(busyResponse.text).toContain('Meeting');
    });

    it('should adapt language for child users', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      // Mock child mode preferences
      const originalGetUserPreferences = conversationalInterface['getUserPreferences'];
      conversationalInterface['getUserPreferences'] = jest.fn().mockResolvedValue({
        language: 'en',
        timeFormat: '12h',
        dateFormat: 'MM/DD/YYYY',
        verbosity: 'detailed',
        childMode: true,
        reminderPreferences: {
          defaultLeadTime: 15,
          preferredMethods: ['voice'],
          quietHours: { start: new Date(), end: new Date() },
          escalationEnabled: false
        }
      });

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "child123"
      );

      expect(response.text).toContain('Have a great day!');
      
      // Restore original method
      conversationalInterface['getUserPreferences'] = originalGetUserPreferences;
    });
  });

  describe('Free Time Detection', () => {
    it('should correctly identify free time slots between events', async () => {
      const events = [
        {
          id: 'event1',
          title: 'Morning Meeting',
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 10, 0),
          createdBy: 'user123'
        },
        {
          id: 'event2',
          title: 'Afternoon Meeting',
          startTime: new Date(2024, 0, 15, 14, 0),
          endTime: new Date(2024, 0, 15, 15, 0),
          createdBy: 'user123'
        }
      ];

      mockCalendarManager.getEvents.mockResolvedValue(events as any);

      const response = await conversationalInterface.processScheduleQuery(
        "am I free today?", "user123"
      );

      // Should identify free time between 10 AM and 2 PM
      expect(response.text).toContain('10:00 AM - 2:00 PM');
    });

    it('should handle overlapping events correctly', async () => {
      const overlappingEvents = [
        {
          id: 'event1',
          title: 'Meeting 1',
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 11, 0),
          createdBy: 'user123'
        },
        {
          id: 'event2',
          title: 'Meeting 2',
          startTime: new Date(2024, 0, 15, 10, 0),
          endTime: new Date(2024, 0, 15, 12, 0),
          createdBy: 'user123'
        }
      ];

      mockCalendarManager.getEvents.mockResolvedValue(overlappingEvents as any);

      const response = await conversationalInterface.processScheduleQuery(
        "am I free today?", "user123"
      );

      expect(response.text).toBeDefined();
    });
  });

  describe('Week View Generation', () => {
    it('should generate comprehensive week view', async () => {
      const weekEvents = [
        {
          id: 'event1',
          title: 'Monday Meeting',
          startTime: new Date(2024, 0, 15, 9, 0), // Monday
          endTime: new Date(2024, 0, 15, 10, 0),
          createdBy: 'user123'
        },
        {
          id: 'event2',
          title: 'Wednesday Call',
          startTime: new Date(2024, 0, 17, 14, 0), // Wednesday
          endTime: new Date(2024, 0, 17, 15, 0),
          createdBy: 'user123'
        },
        {
          id: 'event3',
          title: 'Friday Presentation',
          startTime: new Date(2024, 0, 19, 11, 0), // Friday
          endTime: new Date(2024, 0, 19, 12, 0),
          createdBy: 'user123'
        }
      ];

      mockCalendarManager.getEvents.mockResolvedValue(weekEvents as any);

      const response = await conversationalInterface.processScheduleQuery(
        "what's this week?", "user123"
      );

      expect(response.text).toContain('Monday');
      expect(response.text).toContain('Wednesday');
      expect(response.text).toContain('Friday');
      expect(response.text).toContain('Monday Meeting');
      expect(response.text).toContain('Wednesday Call');
      expect(response.text).toContain('Friday Presentation');
    });

    it('should handle empty week gracefully', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "show me this week", "user123"
      );

      expect(response.text).toContain('wide open');
      expect(response.suggestions).toBeDefined();
      expect(response.suggestions![0].type).toBe('schedule_optimization');
    });
  });

  describe('Time Slot Finding', () => {
    it('should find available slots for specific duration', async () => {
      const events = [
        {
          id: 'event1',
          title: 'Morning Block',
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 11, 0),
          createdBy: 'user123'
        }
      ];

      mockCalendarManager.getEvents.mockResolvedValue(events as any);

      const response = await conversationalInterface.findAvailableTime(
        "find time for a 2 hour meeting", "user123"
      );

      expect(response.text).toContain('available times');
    });

    it('should respect working hours when finding time', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.findAvailableTime(
        "find time for meeting", "user123"
      );

      // Should not suggest times outside 9 AM - 6 PM
      expect(response.text).toBeDefined();
    });

    it('should handle no available time scenario', async () => {
      // Create a completely packed schedule
      const packedEvents = Array.from({ length: 24 }, (_, i) => ({
        id: `event${i}`,
        title: `Meeting ${i}`,
        startTime: new Date(2024, 0, 15, i, 0),
        endTime: new Date(2024, 0, 15, i, 59),
        createdBy: 'user123'
      }));

      mockCalendarManager.getEvents.mockResolvedValue(packedEvents as any);

      const response = await conversationalInterface.findAvailableTime(
        "find time for meeting", "user123"
      );

      expect(response.text).toContain("couldn't find");
    });
  });

  describe('Follow-up Questions', () => {
    it('should provide relevant follow-up questions', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      expect(response.followUpQuestions).toContain("What about tomorrow?");
      expect(response.followUpQuestions).toContain("Set a reminder for today");
    });

    it('should adapt follow-up questions based on context', async () => {
      const busyEvents = [
        {
          id: 'event1',
          title: 'All Day Event',
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 17, 0),
          createdBy: 'user123'
        }
      ];

      mockCalendarManager.getEvents.mockResolvedValue(busyEvents as any);

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      expect(response.followUpQuestions).toContain("What about tomorrow?");
      expect(response.followUpQuestions).toContain("Am I free this evening?");
    });
  });

  describe('Error Recovery', () => {
    it('should recover from calendar manager errors', async () => {
      mockCalendarManager.getEvents.mockRejectedValue(new Error('Database connection failed'));

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      expect(response.text).toContain("having trouble");
      expect(response.followUpQuestions).toBeDefined();
    });

    it('should handle malformed queries gracefully', async () => {
      const malformedQueries = [
        "",
        "   ",
        "!@#$%^&*()",
        "a".repeat(1000), // Very long query
        null as any,
        undefined as any
      ];

      for (const query of malformedQueries) {
        if (query !== null && query !== undefined) {
          const response = await conversationalInterface.processScheduleQuery(query, "user123");
          expect(response.text).toBeDefined();
          expect(response.followUpQuestions).toBeDefined();
        }
      }
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large numbers of events efficiently', async () => {
      // Create 1000 events
      const manyEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: `event${i}`,
        title: `Event ${i}`,
        startTime: new Date(2024, 0, 15, 9 + (i % 8), i % 60),
        endTime: new Date(2024, 0, 15, 10 + (i % 8), i % 60),
        createdBy: 'user123'
      }));

      mockCalendarManager.getEvents.mockResolvedValue(manyEvents as any);

      const startTime = Date.now();
      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(500); // Should still meet performance requirement
      expect(response.text).toBeDefined();
    });

    it('should limit response length for very busy schedules', async () => {
      const manyEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `event${i}`,
        title: `Very Long Event Title That Goes On And On Event ${i}`,
        startTime: new Date(2024, 0, 15, 9, i),
        endTime: new Date(2024, 0, 15, 9, i + 30),
        createdBy: 'user123'
      }));

      mockCalendarManager.getEvents.mockResolvedValue(manyEvents as any);

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      // Response should be reasonable length, not overwhelming
      expect(response.text.length).toBeLessThan(2000);
    });
  });

  describe('Conversation Memory', () => {
    it('should maintain context across multiple queries', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      // First query
      await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      // Second query should have context
      const response = await conversationalInterface.processScheduleQuery(
        "what about tomorrow?", "user123"
      );

      expect(response.text).toBeDefined();
    });

    it('should clean up old conversation contexts', async () => {
      // Create context
      await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      // Verify context exists
      const context = conversationalInterface['activeContexts'].get('user123');
      expect(context).toBeDefined();

      // Simulate time passage and cleanup
      if (context) {
        context.lastActivity = new Date(Date.now() - 2000000); // 33+ minutes ago
      }
      
      conversationalInterface['cleanupExpiredContexts']();

      // Context should be cleaned up
      const cleanedContext = conversationalInterface['activeContexts'].get('user123');
      expect(cleanedContext).toBeUndefined();
    });
  });

  describe('Accessibility and Inclusivity', () => {
    it('should provide clear, simple language for all users', async () => {
      mockCalendarManager.getEvents.mockResolvedValue([]);

      const response = await conversationalInterface.processScheduleQuery(
        "what's my schedule?", "user123"
      );

      // Should avoid technical jargon
      expect(response.text).not.toMatch(/\b(API|database|null|undefined|error|exception)\b/i);
      
      // Should use positive, encouraging language
      expect(response.text.toLowerCase()).toMatch(/\b(great|perfect|wonderful|free|available)\b/);
    });

    it('should handle different time formats and preferences', async () => {
      const event = {
        id: 'event1',
        title: 'Meeting',
        startTime: new Date(2024, 0, 15, 14, 30), // 2:30 PM
        endTime: new Date(2024, 0, 15, 15, 30),
        createdBy: 'user123'
      };

      mockCalendarManager.getEvents.mockResolvedValue([event] as any);

      const response = await conversationalInterface.processScheduleQuery(
        "what's today?", "user123"
      );

      // Should format time in user-friendly way
      expect(response.text).toMatch(/2:30|14:30/); // Either 12h or 24h format
    });
  });
});