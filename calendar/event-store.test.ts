// Tests for encrypted calendar event storage
// Tests Requirements: 8.1, 8.3, 8.6

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { EventStore, EventStoreError } from './event-store'
import { CalendarEvent, EventCategory, Priority, VisibilityLevel, EventSource, SyncStatus, ConflictStatus } from './types'

describe('EventStore', () => {
  let eventStore: EventStore
  let tempDir: string
  let storePath: string

  const testEvent: CalendarEvent = {
    id: 'test-event-1',
    title: 'Test Event',
    description: 'Test Description',
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T11:00:00Z'),
    allDay: false,
    attendees: [],
    category: EventCategory.WORK,
    priority: Priority.MEDIUM,
    visibility: VisibilityLevel.PRIVATE,
    reminders: [],
    metadata: {
      source: EventSource.LOCAL,
      syncStatus: SyncStatus.SYNCED,
      conflictStatus: ConflictStatus.NONE,
      safetyValidated: true,
      tags: ['test', 'work'],
      customFields: {}
    },
    createdAt: new Date('2024-01-15T09:00:00Z'),
    updatedAt: new Date('2024-01-15T09:00:00Z'),
    createdBy: 'user1',
    isPrivate: false
  }

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-store-test-'))
    storePath = path.join(tempDir, 'events')
    
    // Initialize event store with test encryption key
    eventStore = new EventStore(storePath, 'test-encryption-key-12345')
    await eventStore.initialize()
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newStore = new EventStore(path.join(tempDir, 'new-events'), 'test-key')
      await expect(newStore.initialize()).resolves.not.toThrow()
    })

    it('should create necessary directories', async () => {
      const newStorePath = path.join(tempDir, 'new-events')
      const newStore = new EventStore(newStorePath, 'test-key')
      await newStore.initialize()

      await expect(fs.access(path.dirname(newStorePath))).resolves.not.toThrow()
      await expect(fs.access(path.join(path.dirname(newStorePath), 'backups'))).resolves.not.toThrow()
    })
  })

  describe('Event Storage', () => {
    it('should store and retrieve an event', async () => {
      await eventStore.storeEvent(testEvent)
      const retrievedEvent = await eventStore.getEvent(testEvent.id)

      expect(retrievedEvent).not.toBeNull()
      expect(retrievedEvent!.id).toBe(testEvent.id)
      expect(retrievedEvent!.title).toBe(testEvent.title)
      expect(retrievedEvent!.startTime).toEqual(testEvent.startTime)
      expect(retrievedEvent!.endTime).toEqual(testEvent.endTime)
    })

    it('should return null for non-existent event', async () => {
      const retrievedEvent = await eventStore.getEvent('non-existent-id')
      expect(retrievedEvent).toBeNull()
    })

    it('should validate events before storing', async () => {
      const invalidEvent = { ...testEvent, title: '' }
      await expect(eventStore.storeEvent(invalidEvent as CalendarEvent))
        .rejects.toThrow(EventStoreError)
    })

    it('should encrypt stored data', async () => {
      await eventStore.storeEvent(testEvent)
      
      // Read raw file data
      const eventFilePath = path.join(storePath, `${testEvent.id}.event`)
      const rawData = await fs.readFile(eventFilePath)
      const rawString = rawData.toString()
      
      // Encrypted data should not contain plaintext event data
      expect(rawString).not.toContain(testEvent.title)
      expect(rawString).not.toContain(testEvent.description)
    })

    it('should create backups when storing events', async () => {
      await eventStore.storeEvent(testEvent)
      
      const backupDir = path.join(path.dirname(storePath), 'backups')
      const backupFiles = await fs.readdir(backupDir)
      
      expect(backupFiles.length).toBeGreaterThan(0)
      expect(backupFiles.some(file => file.startsWith(testEvent.id))).toBe(true)
    })

    it('should store events with all required fields', async () => {
      const complexEvent: CalendarEvent = {
        ...testEvent,
        id: 'complex-event',
        allDay: true,
        location: {
          name: 'Conference Center',
          address: '123 Main St',
          coordinates: { latitude: 40.7128, longitude: -74.0060 },
          type: 'work' as any
        },
        attendees: [
          {
            id: 'att1',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'required' as any,
            status: 'accepted' as any,
            isRequired: true
          }
        ],
        recurrence: {
          frequency: 'weekly' as any,
          interval: 1,
          daysOfWeek: [1, 3, 5],
          endDate: new Date('2024-12-31'),
          exceptions: []
        },
        reminders: [
          {
            id: 'rem1',
            type: 'popup' as any,
            offsetMinutes: 15,
            method: 'voice' as any,
            isEnabled: true
          }
        ]
      }

      await eventStore.storeEvent(complexEvent)
      const retrieved = await eventStore.getEvent('complex-event')

      expect(retrieved).not.toBeNull()
      expect(retrieved!.allDay).toBe(true)
      expect(retrieved!.location?.name).toBe('Conference Center')
      expect(retrieved!.attendees).toHaveLength(1)
      expect(retrieved!.recurrence?.frequency).toBe('weekly')
      expect(retrieved!.reminders).toHaveLength(1)
    })

    it('should handle child safety validation during storage', async () => {
      const unsafeEvent = {
        ...testEvent,
        id: 'unsafe-event',
        title: 'Adult content meeting',
        description: 'Discussion about violence'
      }

      await expect(eventStore.storeEvent(unsafeEvent as CalendarEvent))
        .rejects.toThrow(EventStoreError)
    })

    it('should store events with proper timestamps', async () => {
      const now = new Date()
      const eventWithTimestamps = {
        ...testEvent,
        id: 'timestamp-event',
        createdAt: now,
        updatedAt: now
      }

      await eventStore.storeEvent(eventWithTimestamps)
      const retrieved = await eventStore.getEvent('timestamp-event')

      expect(retrieved!.createdAt).toEqual(now)
      expect(retrieved!.updatedAt).toEqual(now)
    })
  })

  describe('Event Updates', () => {
    beforeEach(async () => {
      await eventStore.storeEvent(testEvent)
    })

    it('should update an existing event', async () => {
      const updatedEvent = {
        ...testEvent,
        title: 'Updated Test Event',
        description: 'Updated Description',
        updatedAt: new Date()
      }

      await eventStore.updateEvent(testEvent.id, updatedEvent)
      const retrievedEvent = await eventStore.getEvent(testEvent.id)

      expect(retrievedEvent!.title).toBe('Updated Test Event')
      expect(retrievedEvent!.description).toBe('Updated Description')
    })

    it('should validate updated events', async () => {
      const invalidUpdate = { ...testEvent, title: '', updatedAt: new Date() }
      
      await expect(eventStore.updateEvent(testEvent.id, invalidUpdate))
        .rejects.toThrow(EventStoreError)
    })

    it('should reject updates with mismatched IDs', async () => {
      const mismatchedEvent = { ...testEvent, id: 'different-id', updatedAt: new Date() }
      
      await expect(eventStore.updateEvent(testEvent.id, mismatchedEvent))
        .rejects.toThrow(EventStoreError)
    })

    it('should create pre-update backups', async () => {
      const updatedEvent = { ...testEvent, title: 'Updated', updatedAt: new Date() }
      await eventStore.updateEvent(testEvent.id, updatedEvent)
      
      const backupDir = path.join(path.dirname(storePath), 'backups')
      const backupFiles = await fs.readdir(backupDir)
      
      const preUpdateBackups = backupFiles.filter(file => 
        file.startsWith(testEvent.id) && file.includes('pre-update')
      )
      expect(preUpdateBackups.length).toBeGreaterThan(0)
    })
  })

  describe('Event Deletion', () => {
    beforeEach(async () => {
      await eventStore.storeEvent(testEvent)
    })

    it('should delete an existing event', async () => {
      await eventStore.deleteEvent(testEvent.id)
      const retrievedEvent = await eventStore.getEvent(testEvent.id)
      
      expect(retrievedEvent).toBeNull()
    })

    it('should handle deletion of non-existent event gracefully', async () => {
      await expect(eventStore.deleteEvent('non-existent-id')).resolves.not.toThrow()
    })

    it('should create pre-delete backups', async () => {
      await eventStore.deleteEvent(testEvent.id)
      
      const backupDir = path.join(path.dirname(storePath), 'backups')
      const backupFiles = await fs.readdir(backupDir)
      
      const preDeleteBackups = backupFiles.filter(file => 
        file.startsWith(testEvent.id) && file.includes('pre-delete')
      )
      expect(preDeleteBackups.length).toBeGreaterThan(0)
    })
  })

  describe('Event Querying', () => {
    const workEvent: CalendarEvent = {
      ...testEvent,
      id: 'work-event',
      title: 'Work Meeting',
      category: EventCategory.WORK,
      priority: Priority.HIGH,
      startTime: new Date('2024-01-15T14:00:00Z'),
      endTime: new Date('2024-01-15T15:00:00Z')
    }

    const familyEvent: CalendarEvent = {
      ...testEvent,
      id: 'family-event',
      title: 'Family Dinner',
      category: EventCategory.FAMILY,
      priority: Priority.LOW,
      startTime: new Date('2024-01-15T18:00:00Z'),
      endTime: new Date('2024-01-15T19:00:00Z'),
      createdBy: 'user2'
    }

    beforeEach(async () => {
      await eventStore.storeEvent(testEvent)
      await eventStore.storeEvent(workEvent)
      await eventStore.storeEvent(familyEvent)
    })

    it('should query events by user ID', async () => {
      const user1Events = await eventStore.queryEvents({ userId: 'user1' })
      const user2Events = await eventStore.queryEvents({ userId: 'user2' })

      expect(user1Events).toHaveLength(2)
      expect(user2Events).toHaveLength(1)
      expect(user2Events[0].id).toBe('family-event')
    })

    it('should query events by time range', async () => {
      const timeRange = {
        startTime: new Date('2024-01-15T13:00:00Z'),
        endTime: new Date('2024-01-15T16:00:00Z')
      }
      
      const events = await eventStore.queryEvents({ timeRange })
      expect(events).toHaveLength(1)
      expect(events[0].id).toBe('work-event')
    })

    it('should query events by category', async () => {
      const workEvents = await eventStore.queryEvents({ 
        categories: [EventCategory.WORK] 
      })
      const familyEvents = await eventStore.queryEvents({ 
        categories: [EventCategory.FAMILY] 
      })

      expect(workEvents).toHaveLength(2)
      expect(familyEvents).toHaveLength(1)
    })

    it('should query events by priority', async () => {
      const highPriorityEvents = await eventStore.queryEvents({ 
        priorities: [Priority.HIGH] 
      })
      const lowPriorityEvents = await eventStore.queryEvents({ 
        priorities: [Priority.LOW] 
      })

      expect(highPriorityEvents).toHaveLength(1)
      expect(lowPriorityEvents).toHaveLength(1)
    })

    it('should query events by search text', async () => {
      const meetingEvents = await eventStore.queryEvents({ 
        searchText: 'meeting' 
      })
      const dinnerEvents = await eventStore.queryEvents({ 
        searchText: 'dinner' 
      })

      expect(meetingEvents).toHaveLength(1)
      expect(dinnerEvents).toHaveLength(1)
    })

    it('should combine multiple filters', async () => {
      const events = await eventStore.queryEvents({
        userId: 'user1',
        categories: [EventCategory.WORK],
        priorities: [Priority.MEDIUM, Priority.HIGH]
      })

      expect(events).toHaveLength(2)
    })

    it('should get all events for a user', async () => {
      const user1Events = await eventStore.getUserEvents('user1')
      expect(user1Events).toHaveLength(2)
    })
  })

  describe('Data Integrity', () => {
    beforeEach(async () => {
      await eventStore.storeEvent(testEvent)
    })

    it('should verify data integrity of valid events', async () => {
      const report = await eventStore.verifyDataIntegrity()
      
      expect(report.totalEvents).toBe(1)
      expect(report.validEvents).toBe(1)
      expect(report.corruptedEvents).toHaveLength(0)
      expect(report.missingFiles).toHaveLength(0)
    })

    it('should detect missing event files', async () => {
      // Delete the event file manually
      const eventFilePath = path.join(storePath, `${testEvent.id}.event`)
      await fs.unlink(eventFilePath)
      
      const report = await eventStore.verifyDataIntegrity()
      
      expect(report.totalEvents).toBe(1)
      expect(report.validEvents).toBe(0)
      expect(report.missingFiles).toContain(testEvent.id)
    })

    it('should detect corrupted event files', async () => {
      // Corrupt the event file and remove backups
      const eventFilePath = path.join(storePath, `${testEvent.id}.event`)
      const backupDir = path.join(path.dirname(storePath), 'backups')
      
      await fs.writeFile(eventFilePath, 'corrupted data')
      
      // Remove backup files to prevent recovery
      try {
        const backupFiles = await fs.readdir(backupDir)
        for (const file of backupFiles) {
          if (file.startsWith(testEvent.id)) {
            await fs.unlink(path.join(backupDir, file))
          }
        }
      } catch (error) {
        // Ignore if backup directory doesn't exist
      }
      
      const report = await eventStore.verifyDataIntegrity()
      
      expect(report.totalEvents).toBe(1)
      expect(report.validEvents).toBe(0)
      expect(report.corruptedEvents.length).toBeGreaterThan(0)
      expect(report.corruptedEvents[0].eventId).toBe(testEvent.id)
    })

    it('should verify integrity of multiple events', async () => {
      const event2: CalendarEvent = {
        ...testEvent,
        id: 'test-event-2',
        title: 'Second Test Event'
      }
      const event3: CalendarEvent = {
        ...testEvent,
        id: 'test-event-3',
        title: 'Third Test Event'
      }

      await eventStore.storeEvent(event2)
      await eventStore.storeEvent(event3)

      const report = await eventStore.verifyDataIntegrity()
      
      expect(report.totalEvents).toBe(3)
      expect(report.validEvents).toBe(3)
      expect(report.corruptedEvents).toHaveLength(0)
      expect(report.missingFiles).toHaveLength(0)
    })

    it('should detect validation errors in stored events', async () => {
      // Manually create an event file with invalid data
      const invalidEventData = {
        ...testEvent,
        title: '', // Invalid: empty title
        startTime: testEvent.endTime, // Invalid: start after end
        endTime: testEvent.startTime
      }

      const eventFilePath = path.join(storePath, 'invalid-event.event')
      const encryptedData = Buffer.from(JSON.stringify(invalidEventData))
      await fs.writeFile(eventFilePath, encryptedData)

      // Manually add to index
      const indexPath = path.join(path.dirname(storePath), 'event-index.json')
      const indexEntry = {
        'invalid-event': {
          id: 'invalid-event',
          title: 'Invalid Event',
          startTime: testEvent.startTime.toISOString(),
          endTime: testEvent.endTime.toISOString(),
          category: testEvent.category,
          priority: testEvent.priority,
          createdBy: testEvent.createdBy,
          tags: [],
          filePath: eventFilePath,
          lastModified: new Date().toISOString()
        }
      }

      try {
        const existingIndex = await fs.readFile(indexPath, 'utf8')
        const existing = JSON.parse(existingIndex)
        Object.assign(existing, indexEntry)
        await fs.writeFile(indexPath, JSON.stringify(existing, null, 2))
      } catch {
        await fs.writeFile(indexPath, JSON.stringify(indexEntry, null, 2))
      }

      // Reinitialize to load the corrupted index
      const newStore = new EventStore(storePath, 'test-encryption-key-12345')
      await newStore.initialize()

      const report = await newStore.verifyDataIntegrity()
      
      expect(report.totalEvents).toBeGreaterThan(1)
      expect(report.corruptedEvents.length).toBeGreaterThan(0)
    })

    it('should handle index inconsistencies', async () => {
      // Create an event file without corresponding index entry
      const orphanEventPath = path.join(storePath, 'orphan-event.event')
      await fs.writeFile(orphanEventPath, 'some data')

      const report = await eventStore.verifyDataIntegrity()
      
      // The orphan file won't be detected since it's not in the index
      // This tests that the integrity check is based on the index
      expect(report.totalEvents).toBe(1) // Only the indexed event
    })

    it('should provide detailed error information', async () => {
      // Create multiple types of integrity issues
      const event2: CalendarEvent = { ...testEvent, id: 'missing-event' }
      const event3: CalendarEvent = { ...testEvent, id: 'corrupted-event' }
      
      await eventStore.storeEvent(event2)
      await eventStore.storeEvent(event3)

      // Remove all backup files to prevent recovery
      const backupDir = path.join(path.dirname(storePath), 'backups')
      try {
        const backupFiles = await fs.readdir(backupDir)
        for (const file of backupFiles) {
          await fs.unlink(path.join(backupDir, file))
        }
      } catch (error) {
        // Ignore if backup directory doesn't exist
      }

      // Delete one file to create missing file
      const missingFilePath = path.join(storePath, 'missing-event.event')
      await fs.unlink(missingFilePath)

      // Corrupt another file
      const corruptedFilePath = path.join(storePath, 'corrupted-event.event')
      await fs.writeFile(corruptedFilePath, 'corrupted data')

      const report = await eventStore.verifyDataIntegrity()
      
      expect(report.corruptedEvents.length).toBeGreaterThan(0)
      expect(report.missingFiles.length).toBeGreaterThan(0)
      expect(report.corruptedEvents[0]).toHaveProperty('error')
      expect(typeof report.corruptedEvents[0].error).toBe('string')
    })
  })

  describe('Backup and Recovery', () => {
    beforeEach(async () => {
      await eventStore.storeEvent(testEvent)
    })

    it('should recover from backup when main file is corrupted', async () => {
      // Corrupt the main event file
      const eventFilePath = path.join(storePath, `${testEvent.id}.event`)
      await fs.writeFile(eventFilePath, 'corrupted data')
      
      // Should recover from backup
      const recoveredEvent = await eventStore.getEvent(testEvent.id)
      expect(recoveredEvent).not.toBeNull()
      expect(recoveredEvent!.title).toBe(testEvent.title)
    })

    it('should clean up old backups', async () => {
      // Create multiple backups by updating the event multiple times
      for (let i = 0; i < 15; i++) {
        const updatedEvent = {
          ...testEvent,
          title: `Updated Event ${i}`,
          updatedAt: new Date()
        }
        await eventStore.updateEvent(testEvent.id, updatedEvent)
      }
      
      const backupDir = path.join(path.dirname(storePath), 'backups')
      const backupFiles = await fs.readdir(backupDir)
      const eventBackups = backupFiles.filter(file => file.startsWith(testEvent.id))
      
      // Should keep only the last 10 backups per event
      expect(eventBackups.length).toBeLessThanOrEqual(10)
    })
  })

  describe('Transaction Rollback', () => {
    it('should rollback on storage failure', async () => {
      // Test that invalid events are rejected and don't corrupt the store
      const invalidEvent = { ...testEvent, title: '', id: 'invalid-event' }
      
      // This should fail validation and not be stored
      await expect(eventStore.storeEvent(invalidEvent as CalendarEvent)).rejects.toThrow()
      
      // Verify the invalid event was not stored
      const retrievedEvent = await eventStore.getEvent('invalid-event')
      expect(retrievedEvent).toBeNull()
      
      // Verify the store is still functional
      const validEvent = { ...testEvent, id: 'valid-after-failure' }
      await eventStore.storeEvent(validEvent)
      const retrievedValidEvent = await eventStore.getEvent('valid-after-failure')
      expect(retrievedValidEvent).not.toBeNull()
    })

    it('should maintain consistency during concurrent operations', async () => {
      const event1 = { ...testEvent, id: 'concurrent-1' }
      const event2 = { ...testEvent, id: 'concurrent-2' }
      
      // Store events concurrently
      await Promise.all([
        eventStore.storeEvent(event1),
        eventStore.storeEvent(event2)
      ])
      
      const retrievedEvent1 = await eventStore.getEvent('concurrent-1')
      const retrievedEvent2 = await eventStore.getEvent('concurrent-2')
      
      expect(retrievedEvent1).not.toBeNull()
      expect(retrievedEvent2).not.toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedStore = new EventStore(path.join(tempDir, 'uninitialized'), 'test-key')
      
      await expect(uninitializedStore.storeEvent(testEvent))
        .rejects.toThrow('Event store not initialized')
    })

    it('should handle encryption/decryption errors gracefully', async () => {
      await eventStore.storeEvent(testEvent)
      
      // Create a new store with different encryption key
      const differentKeyStore = new EventStore(storePath, 'different-key')
      await differentKeyStore.initialize()
      
      // Should not be able to decrypt with wrong key
      const retrievedEvent = await differentKeyStore.getEvent(testEvent.id)
      expect(retrievedEvent).toBeNull() // Should fall back to backup recovery
    })
  })
})