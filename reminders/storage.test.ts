// ReminderStorage unit tests

import * as fs from 'fs/promises'
import * as path from 'path'
import { ReminderStorage } from './storage'
import {
  Reminder,
  ReminderType,
  CompletionStatus
} from './types'
import { Priority, NotificationMethod } from '../calendar/types'

// Mock fs module
jest.mock('fs/promises')
const mockFs = fs as jest.Mocked<typeof fs>

describe('ReminderStorage', () => {
  let storage: ReminderStorage
  const testStorageDir = './test-data/reminders'
  const testEncryptionKey = 'a'.repeat(64) // 32 bytes in hex
  
  beforeEach(() => {
    jest.clearAllMocks()
    storage = new ReminderStorage(testStorageDir, testEncryptionKey)
    
    // Mock successful directory operations
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.access.mockResolvedValue(undefined)
    mockFs.readdir.mockResolvedValue([])
    mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any)
  })
  
  afterEach(() => {
    storage.stop()
  })

  describe('storeReminder', () => {
    it('should store reminder with encryption', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test description',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockFs.writeFile.mockResolvedValue(undefined)

      let eventEmitted = false
      storage.on('reminder:stored', (data) => {
        eventEmitted = true
        expect(data.reminderId).toBe('test1')
        expect(data.userId).toBe('user1')
      })

      await storage.storeReminder(reminder)
      
      expect(mockFs.writeFile).toHaveBeenCalled()
      expect(eventEmitted).toBe(true)
    })

    it('should handle storage errors gracefully', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockFs.writeFile.mockRejectedValue(new Error('Disk full'))

      await expect(storage.storeReminder(reminder))
        .rejects.toThrow('Failed to store reminder test1: Disk full')
    })
  })

  describe('getReminder', () => {
    it('should retrieve and decrypt reminder', async () => {
      const reminderData = JSON.stringify({
        id: 'test1',
        userId: 'user1',
        title: 'Test Reminder',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date().toISOString(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Mock encrypted data (simplified)
      const mockEncryptedData = Buffer.from('encrypted_' + reminderData)
      mockFs.readFile.mockResolvedValue(mockEncryptedData)

      // Mock the decryption to return original data
      jest.spyOn(storage as any, 'decryptData').mockReturnValue(reminderData)

      const result = await storage.getReminder('test1')
      
      expect(result).toBeDefined()
      expect(result?.id).toBe('test1')
      expect(result?.userId).toBe('user1')
    })

    it('should return null for non-existent reminder', async () => {
      const error = new Error('File not found') as any
      error.code = 'ENOENT'
      mockFs.readFile.mockRejectedValue(error)

      const result = await storage.getReminder('nonexistent')
      expect(result).toBeNull()
    })

    it('should handle decryption errors', async () => {
      mockFs.readFile.mockResolvedValue(Buffer.from('corrupted data'))

      await expect(storage.getReminder('test1'))
        .rejects.toThrow('Failed to retrieve reminder test1')
    })
  })

  describe('updateReminder', () => {
    it('should update existing reminder', async () => {
      const existingReminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Original Title',
        description: 'Original description',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const updatedReminder: Reminder = {
        ...existingReminder,
        title: 'Updated Title',
        updatedAt: new Date()
      }

      // Mock getReminder to return existing reminder
      jest.spyOn(storage, 'getReminder').mockResolvedValue(existingReminder)
      
      // Mock storeReminder
      jest.spyOn(storage, 'storeReminder').mockResolvedValue(undefined)
      
      mockFs.writeFile.mockResolvedValue(undefined)

      await storage.updateReminder(updatedReminder)
      
      expect(storage.storeReminder).toHaveBeenCalledWith(updatedReminder)
    })

    it('should throw error for non-existent reminder', async () => {
      const reminder: Reminder = {
        id: 'nonexistent',
        userId: 'user1',
        title: 'Test',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      jest.spyOn(storage, 'getReminder').mockResolvedValue(null)

      await expect(storage.updateReminder(reminder))
        .rejects.toThrow('Reminder nonexistent not found')
    })
  })

  describe('deleteReminder', () => {
    it('should delete reminder file', async () => {
      const reminder: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Test',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      jest.spyOn(storage, 'getReminder').mockResolvedValue(reminder)
      mockFs.unlink.mockResolvedValue(undefined)

      let eventEmitted = false
      storage.on('reminder:deleted', (data) => {
        eventEmitted = true
        expect(data.reminderId).toBe('test1')
      })

      await storage.deleteReminder('test1')
      
      expect(mockFs.unlink).toHaveBeenCalled()
      expect(eventEmitted).toBe(true)
    })

    it('should handle deletion of non-existent file gracefully', async () => {
      const error = new Error('File not found') as any
      error.code = 'ENOENT'
      
      jest.spyOn(storage, 'getReminder').mockResolvedValue(null)
      mockFs.unlink.mockRejectedValue(error)

      // Should not throw
      await storage.deleteReminder('nonexistent')
    })
  })

  describe('getUserReminders', () => {
    it('should return all reminders for a user', async () => {
      const mockFiles = ['test1.enc', 'test2.enc', 'other.txt']
      mockFs.readdir.mockResolvedValue(mockFiles as any)

      const reminder1: Reminder = {
        id: 'test1',
        userId: 'user1',
        title: 'Reminder 1',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 60000),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const reminder2: Reminder = {
        id: 'test2',
        userId: 'user1',
        title: 'Reminder 2',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(Date.now() + 120000),
        priority: Priority.HIGH,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.PENDING,
        snoozeHistory: [],
        userFeedback: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      jest.spyOn(storage, 'getReminder')
        .mockResolvedValueOnce(reminder1)
        .mockResolvedValueOnce(reminder2)

      const result = await storage.getUserReminders('user1')
      
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Reminder 1') // Should be sorted by trigger time
      expect(result[1].title).toBe('Reminder 2')
    })

    it('should return empty array for user with no reminders', async () => {
      const error = new Error('Directory not found') as any
      error.code = 'ENOENT'
      mockFs.readdir.mockRejectedValue(error)

      const result = await storage.getUserReminders('newuser')
      expect(result).toEqual([])
    })
  })

  describe('storeQueueState', () => {
    it('should store queue state with encryption', async () => {
      const queueState = {
        reminders: [],
        lastProcessed: new Date(),
        processingErrors: []
      }

      mockFs.writeFile.mockResolvedValue(undefined)

      let eventEmitted = false
      storage.on('queue:state:stored', (data) => {
        eventEmitted = true
        expect(data.queueSize).toBe(0)
      })

      await storage.storeQueueState(queueState)
      
      expect(mockFs.writeFile).toHaveBeenCalled()
      expect(eventEmitted).toBe(true)
    })
  })

  describe('getQueueState', () => {
    it('should retrieve and decrypt queue state', async () => {
      const queueStateData = JSON.stringify({
        reminders: [],
        lastProcessed: new Date().toISOString(),
        processingErrors: []
      })

      mockFs.readFile.mockResolvedValue(Buffer.from('encrypted_' + queueStateData))
      jest.spyOn(storage as any, 'decryptData').mockReturnValue(queueStateData)

      const result = await storage.getQueueState()
      
      expect(result).toBeDefined()
      expect(result?.reminders).toEqual([])
      expect(result?.lastProcessed).toBeInstanceOf(Date)
    })

    it('should return null for non-existent queue state', async () => {
      const error = new Error('File not found') as any
      error.code = 'ENOENT'
      mockFs.readFile.mockRejectedValue(error)

      const result = await storage.getQueueState()
      expect(result).toBeNull()
    })
  })

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      mockFs.readdir.mockResolvedValue([])
      mockFs.writeFile.mockResolvedValue(undefined)

      let eventEmitted = false
      storage.on('backup:created', (data) => {
        eventEmitted = true
        expect(data.backupPath).toContain('backup_')
      })

      const backupPath = await storage.createBackup()
      
      expect(backupPath).toContain('backup_')
      expect(eventEmitted).toBe(true)
    })
  })

  describe('recoverFromFailure', () => {
    it('should recover system successfully', async () => {
      // Mock finding no corrupted files
      jest.spyOn(storage as any, 'findCorruptedFiles').mockResolvedValue([])
      jest.spyOn(storage as any, 'getAllReminders').mockResolvedValue([])

      let eventEmitted = false
      storage.on('system:recovered', (data) => {
        eventEmitted = true
        expect(data.success).toBe(true)
      })

      const result = await storage.recoverFromFailure()
      
      expect(result.success).toBe(true)
      expect(result.recoveredReminders).toBe(0)
      expect(result.corruptedFiles).toEqual([])
      expect(eventEmitted).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should clean up old data successfully', async () => {
      // Mock old completed reminder
      const oldReminder: Reminder = {
        id: 'old1',
        userId: 'user1',
        title: 'Old Reminder',
        description: 'Test',
        type: ReminderType.TIME_BASED,
        triggerTime: new Date(),
        priority: Priority.MEDIUM,
        deliveryMethods: [NotificationMethod.VOICE],
        contextConstraints: [],
        escalationRules: [],
        completionStatus: CompletionStatus.COMPLETED,
        snoozeHistory: [],
        userFeedback: [],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago
      }

      jest.spyOn(storage as any, 'getAllReminders').mockResolvedValue([oldReminder])
      jest.spyOn(storage, 'deleteReminder').mockResolvedValue(undefined)
      jest.spyOn(storage as any, 'cleanupOldAuditLogs').mockResolvedValue(0)
      jest.spyOn(storage as any, 'cleanupOldBackups').mockResolvedValue(0)

      let eventEmitted = false
      storage.on('cleanup:completed', (data) => {
        eventEmitted = true
        expect(data.deletedReminders).toBe(1)
      })

      const result = await storage.cleanup()
      
      expect(result.deletedReminders).toBe(1)
      expect(eventEmitted).toBe(true)
    })
  })

  describe('getAuditTrail', () => {
    it('should return audit entries', async () => {
      const mockAuditFiles = ['audit_2024-01-01.json']
      const mockAuditEntries = [
        {
          id: 'audit1',
          timestamp: '2024-01-01T10:00:00.000Z',
          action: 'reminder_stored',
          data: { reminderId: 'test1' },
          source: 'reminder_storage'
        }
      ]

      mockFs.readdir.mockResolvedValue(mockAuditFiles as any)
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockAuditEntries))

      const result = await storage.getAuditTrail()
      
      expect(result).toHaveLength(1)
      expect(result[0].action).toBe('reminder_stored')
      expect(result[0].timestamp).toBeInstanceOf(Date)
    })

    it('should filter audit entries by date range', async () => {
      const mockAuditFiles = ['audit_2024-01-01.json']
      const mockAuditEntries = [
        {
          id: 'audit1',
          timestamp: '2024-01-01T10:00:00.000Z',
          action: 'reminder_stored',
          data: { reminderId: 'test1' },
          source: 'reminder_storage'
        }
      ]

      mockFs.readdir.mockResolvedValue(mockAuditFiles as any)
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockAuditEntries))

      const startDate = new Date('2024-01-02')
      const result = await storage.getAuditTrail(startDate)
      
      expect(result).toHaveLength(0) // Entry should be filtered out
    })
  })
})