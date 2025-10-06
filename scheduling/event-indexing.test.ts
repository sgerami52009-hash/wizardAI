/**
 * Unit tests for EventIndexingSystem
 * Tests event indexing, query optimization, and cache management
 */

import EventIndexingSystem from './event-indexing';
import { CalendarEvent } from '../calendar/types';

describe('EventIndexingSystem', () => {
  let indexingSystem: EventIndexingSystem;
  let sampleEvents: CalendarEvent[];

  beforeEach(() => {
    indexingSystem = new EventIndexingSystem();
    sampleEvents = createSampleEvents();
  });

  afterEach(() => {
    indexingSystem.clear();
  });

  describe('Event Indexing', () => {
    test('should index events correctly', () => {
      const event = sampleEvents[0];
      indexingSystem.indexEvent(event);

      const stats = indexingSystem.getStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.indexSize).toBeGreaterThan(0);
    });

    test('should update existing event index', () => {
      const event = sampleEvents[0];
      indexingSystem.indexEvent(event);

      // Update the event
      const updatedEvent = { ...event, title: 'Updated Meeting' };
      indexingSystem.indexEvent(updatedEvent);

      const stats = indexingSystem.getStats();
      expect(stats.totalEvents).toBe(1); // Should still be 1, not 2
    });

    test('should remove events from index', () => {
      const event = sampleEvents[0];
      indexingSystem.indexEvent(event);
      
      expect(indexingSystem.getStats().totalEvents).toBe(1);
      
      indexingSystem.removeEvent(event.id);
      expect(indexingSystem.getStats().totalEvents).toBe(0);
    });

    test('should handle removing non-existent events', () => {
      indexingSystem.removeEvent('non-existent-id');
      expect(indexingSystem.getStats().totalEvents).toBe(0);
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
    });

    test('should query events by user ID', () => {
      const result = indexingSystem.queryEvents({ userId: 'user1' });
      
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      expect(result.queryTime).toBeGreaterThan(0);
      expect(result.indexHit).toBe(true);
    });

    test('should query events by date range', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const result = indexingSystem.queryEvents({ startDate, endDate });
      
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.indexHit).toBe(true);
    });

    test('should query events by category', () => {
      const result = indexingSystem.queryEvents({ category: 'meeting' });
      
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.indexHit).toBe(true);
    });

    test('should apply pagination correctly', () => {
      const result1 = indexingSystem.queryEvents({ limit: 2, offset: 0 });
      const result2 = indexingSystem.queryEvents({ limit: 2, offset: 2 });
      
      expect(result1.items.length).toBeLessThanOrEqual(2);
      expect(result2.items.length).toBeLessThanOrEqual(2);
      
      // Should not have overlapping items
      const overlap = result1.items.filter(id => result2.items.includes(id));
      expect(overlap.length).toBe(0);
    });

    test('should handle empty query results', () => {
      const result = indexingSystem.queryEvents({ userId: 'non-existent-user' });
      
      expect(result.items.length).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.indexHit).toBe(true);
    });

    test('should combine multiple filters', () => {
      const result = indexingSystem.queryEvents({
        userId: 'user1',
        category: 'meeting',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });
      
      expect(result.indexHit).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
    });

    test('should search events by text', () => {
      const result = indexingSystem.searchEvents('meeting');
      
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.indexHit).toBe(true);
    });

    test('should handle case-insensitive search', () => {
      const result1 = indexingSystem.searchEvents('MEETING');
      const result2 = indexingSystem.searchEvents('meeting');
      
      expect(result1.items.length).toBe(result2.items.length);
    });

    test('should filter out stop words', () => {
      // Search terms should not include common stop words
      const result = indexingSystem.searchEvents('the meeting');
      
      // Should find results based on 'meeting', ignoring 'the'
      expect(result.items.length).toBeGreaterThan(0);
    });

    test('should handle empty search terms', () => {
      const result = indexingSystem.searchEvents('');
      
      expect(result.items.length).toBe(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
    });

    test('should cache query results', () => {
      const query = { userId: 'user1' };
      
      // First query should not be from cache
      const result1 = indexingSystem.queryEvents(query);
      expect(result1.fromCache).toBe(false);
      
      // Second identical query should be from cache
      const result2 = indexingSystem.queryEvents(query);
      expect(result2.fromCache).toBe(true);
    });

    test('should invalidate cache when events are modified', () => {
      const query = { userId: 'user1' };
      
      // Cache a query result
      const result1 = indexingSystem.queryEvents(query);
      expect(result1.fromCache).toBe(false);
      
      // Modify an event
      const newEvent: CalendarEvent = {
        id: 'new-event',
        title: 'New Event',
        description: 'A new event',
        startTime: new Date('2024-06-15T10:00:00Z'),
        endTime: new Date('2024-06-15T11:00:00Z'),
        category: 'meeting',
        priority: 'medium',
        createdBy: 'user1',
        attendees: [],
        reminders: [],
        isPrivate: false
      };
      
      indexingSystem.indexEvent(newEvent);
      
      // Query should not be from cache anymore
      const result2 = indexingSystem.queryEvents(query);
      expect(result2.fromCache).toBe(false);
    });

    test('should limit cache size', () => {
      // Create many different queries to exceed cache limit
      for (let i = 0; i < 1100; i++) {
        indexingSystem.queryEvents({ userId: `user${i}` });
      }
      
      const stats = indexingSystem.getStats();
      expect(stats.indexSize).toBeLessThan(2000); // Should have evicted some cache entries
    });
  });

  describe('Performance Optimization', () => {
    test('should optimize indexes', () => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
      
      const statsBefore = indexingSystem.getStats();
      indexingSystem.optimizeIndexes();
      const statsAfter = indexingSystem.getStats();
      
      expect(statsAfter.lastOptimization).not.toEqual(statsBefore.lastOptimization);
    });

    test('should calculate fragmentation level', () => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
      
      // Remove some events to create fragmentation
      indexingSystem.removeEvent(sampleEvents[0].id);
      indexingSystem.removeEvent(sampleEvents[1].id);
      
      indexingSystem.optimizeIndexes();
      const stats = indexingSystem.getStats();
      
      expect(stats.fragmentationLevel).toBeGreaterThanOrEqual(0);
      expect(stats.fragmentationLevel).toBeLessThanOrEqual(1);
    });

    test('should track query performance', () => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
      
      // Perform several queries
      for (let i = 0; i < 10; i++) {
        indexingSystem.queryEvents({ userId: 'user1' });
      }
      
      const stats = indexingSystem.getStats();
      expect(stats.averageQueryTime).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('Index Statistics', () => {
    test('should provide accurate statistics', () => {
      expect(indexingSystem.getStats().totalEvents).toBe(0);
      
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
      
      const stats = indexingSystem.getStats();
      expect(stats.totalEvents).toBe(sampleEvents.length);
      expect(stats.indexSize).toBeGreaterThan(0);
    });

    test('should update statistics after operations', () => {
      const event = sampleEvents[0];
      indexingSystem.indexEvent(event);
      
      const stats1 = indexingSystem.getStats();
      expect(stats1.totalEvents).toBe(1);
      
      indexingSystem.removeEvent(event.id);
      
      const stats2 = indexingSystem.getStats();
      expect(stats2.totalEvents).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle events with minimal data', () => {
      const minimalEvent: CalendarEvent = {
        id: 'minimal',
        title: '',
        description: '',
        startTime: new Date(),
        endTime: new Date(),
        category: '',
        priority: 'low',
        createdBy: 'user1',
        attendees: [],
        reminders: [],
        isPrivate: false
      };
      
      expect(() => indexingSystem.indexEvent(minimalEvent)).not.toThrow();
    });

    test('should handle concurrent operations', async () => {
      const promises = sampleEvents.map(event => 
        Promise.resolve(indexingSystem.indexEvent(event))
      );
      
      await Promise.all(promises);
      
      const stats = indexingSystem.getStats();
      expect(stats.totalEvents).toBe(sampleEvents.length);
    });

    test('should clear all data correctly', () => {
      sampleEvents.forEach(event => indexingSystem.indexEvent(event));
      
      expect(indexingSystem.getStats().totalEvents).toBeGreaterThan(0);
      
      indexingSystem.clear();
      
      const stats = indexingSystem.getStats();
      expect(stats.totalEvents).toBe(0);
      expect(stats.indexSize).toBe(0);
    });
  });
});

function createSampleEvents(): CalendarEvent[] {
  return [
    {
      id: 'event1',
      title: 'Team Meeting',
      description: 'Weekly team sync meeting',
      startTime: new Date('2024-06-15T10:00:00Z'),
      endTime: new Date('2024-06-15T11:00:00Z'),
      category: 'meeting',
      priority: 'high',
      createdBy: 'user1',
      attendees: ['user1', 'user2'],
      reminders: [],
      isPrivate: false
    },
    {
      id: 'event2',
      title: 'Doctor Appointment',
      description: 'Annual checkup',
      startTime: new Date('2024-06-16T14:00:00Z'),
      endTime: new Date('2024-06-16T15:00:00Z'),
      category: 'personal',
      priority: 'medium',
      createdBy: 'user2',
      attendees: ['user2'],
      reminders: [],
      isPrivate: true
    },
    {
      id: 'event3',
      title: 'Project Review',
      description: 'Quarterly project review meeting',
      startTime: new Date('2024-06-17T09:00:00Z'),
      endTime: new Date('2024-06-17T10:30:00Z'),
      category: 'meeting',
      priority: 'high',
      createdBy: 'user1',
      attendees: ['user1', 'user3'],
      reminders: [],
      isPrivate: false
    },
    {
      id: 'event4',
      title: 'Lunch Break',
      description: 'Daily lunch break',
      startTime: new Date('2024-06-15T12:00:00Z'),
      endTime: new Date('2024-06-15T13:00:00Z'),
      category: 'personal',
      priority: 'low',
      createdBy: 'user1',
      attendees: ['user1'],
      reminders: [],
      isPrivate: false
    },
    {
      id: 'event5',
      title: 'Conference Call',
      description: 'Client conference call discussion',
      startTime: new Date('2024-06-18T16:00:00Z'),
      endTime: new Date('2024-06-18T17:00:00Z'),
      category: 'meeting',
      priority: 'high',
      createdBy: 'user3',
      attendees: ['user1', 'user2', 'user3'],
      reminders: [],
      isPrivate: false
    }
  ];
}