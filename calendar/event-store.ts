// Encrypted calendar data storage with AES-256 encryption
// Implements Requirements: 8.1, 8.3, 8.6

import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { CalendarEvent, EventFilter, Priority, EventCategory } from './types'
import { validateCalendarEvent, serializeCalendarEvent, deserializeCalendarEvent } from './data-models'

/**
 * Encrypted event store with atomic operations and backup capabilities
 * Requirement 8.1: AES-256 encryption for all calendar data
 */
export class EventStore {
  private readonly storePath: string
  private readonly backupPath: string
  private readonly encryptionKey: Buffer
  private readonly indexPath: string
  private eventIndex: Map<string, EventIndexEntry> = new Map()
  private isInitialized = false

  constructor(storePath: string, encryptionKey: string) {
    this.storePath = storePath
    this.backupPath = path.join(path.dirname(storePath), 'backups')
    this.indexPath = path.join(path.dirname(storePath), 'event-index.json')
    this.encryptionKey = crypto.scryptSync(encryptionKey, 'salt', 32)
  }

  /**
   * Initialize the event store and load existing data
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      await fs.mkdir(path.dirname(this.storePath), { recursive: true })
      await fs.mkdir(this.backupPath, { recursive: true })

      // Load event index
      await this.loadEventIndex()
      
      this.isInitialized = true
    } catch (error) {
      throw new EventStoreError('Failed to initialize event store', error as Error)
    }
  }

  /**
   * Store a calendar event with encryption and atomic operations
   * Requirement 8.1: Atomic event operations with rollback capabilities
   */
  async storeEvent(event: CalendarEvent): Promise<void> {
    this.ensureInitialized()

    // Validate event before storing
    const validation = validateCalendarEvent(event)
    if (!validation.isValid) {
      throw new EventStoreError(`Event validation failed: ${validation.errors.join(', ')}`)
    }

    const transaction = new StoreTransaction(this)
    
    try {
      await transaction.begin()
      
      // Encrypt and store event data
      const encryptedData = await this.encryptEventData(event)
      const eventFilePath = this.getEventFilePath(event.id)
      
      await transaction.writeFile(eventFilePath, encryptedData)
      
      // Update index
      const indexEntry: EventIndexEntry = {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        category: event.category,
        priority: event.priority,
        createdBy: event.createdBy,
        tags: event.metadata.tags,
        filePath: eventFilePath,
        lastModified: new Date()
      }
      
      this.eventIndex.set(event.id, indexEntry)
      await transaction.writeIndex(this.indexPath, this.serializeIndex())
      
      // Create backup
      await this.createBackup(event.id, encryptedData)
      
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw new EventStoreError('Failed to store event', error as Error)
    }
  }

  /**
   * Retrieve a calendar event by ID with decryption
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    this.ensureInitialized()

    const indexEntry = this.eventIndex.get(eventId)
    if (!indexEntry) {
      return null
    }

    try {
      const encryptedData = await fs.readFile(indexEntry.filePath)
      const decryptedData = await this.decryptEventData(encryptedData)
      return deserializeCalendarEvent(decryptedData)
    } catch (error) {
      // Try to recover from backup
      return await this.recoverEventFromBackup(eventId)
    }
  }

  /**
   * Update an existing calendar event with atomic operations
   */
  async updateEvent(eventId: string, updatedEvent: CalendarEvent): Promise<void> {
    this.ensureInitialized()

    if (eventId !== updatedEvent.id) {
      throw new EventStoreError('Event ID mismatch in update operation')
    }

    // Validate updated event
    const validation = validateCalendarEvent(updatedEvent)
    if (!validation.isValid) {
      throw new EventStoreError(`Event validation failed: ${validation.errors.join(', ')}`)
    }

    const transaction = new StoreTransaction(this)
    
    try {
      await transaction.begin()
      
      // Backup current version before update
      const currentEvent = await this.getEvent(eventId)
      if (currentEvent) {
        await this.createBackup(eventId, await this.encryptEventData(currentEvent), 'pre-update')
      }
      
      // Store updated event
      await this.storeEvent(updatedEvent)
      
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw new EventStoreError('Failed to update event', error as Error)
    }
  }

  /**
   * Delete a calendar event with backup creation
   */
  async deleteEvent(eventId: string): Promise<void> {
    this.ensureInitialized()

    const indexEntry = this.eventIndex.get(eventId)
    if (!indexEntry) {
      return // Event doesn't exist, nothing to delete
    }

    const transaction = new StoreTransaction(this)
    
    try {
      await transaction.begin()
      
      // Create backup before deletion
      const eventData = await fs.readFile(indexEntry.filePath)
      await this.createBackup(eventId, eventData, 'pre-delete')
      
      // Remove event file
      await transaction.deleteFile(indexEntry.filePath)
      
      // Update index
      this.eventIndex.delete(eventId)
      await transaction.writeIndex(this.indexPath, this.serializeIndex())
      
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw new EventStoreError('Failed to delete event', error as Error)
    }
  }

  /**
   * Query events with efficient filtering using the index
   * Requirement 8.6: Event indexing and efficient query mechanisms
   */
  async queryEvents(filter: EventFilter): Promise<CalendarEvent[]> {
    this.ensureInitialized()

    // Use index for efficient filtering
    let filteredEntries = Array.from(this.eventIndex.values())

    // Apply filters using index data
    if (filter.userId) {
      filteredEntries = filteredEntries.filter(entry => entry.createdBy === filter.userId)
    }

    if (filter.timeRange) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.startTime < filter.timeRange!.endTime && 
        entry.endTime > filter.timeRange!.startTime
      )
    }

    if (filter.categories && filter.categories.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        filter.categories!.includes(entry.category)
      )
    }

    if (filter.priorities && filter.priorities.length > 0) {
      filteredEntries = filteredEntries.filter(entry => 
        filter.priorities!.includes(entry.priority)
      )
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase()
      filteredEntries = filteredEntries.filter(entry => 
        entry.title.toLowerCase().includes(searchLower) ||
        entry.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    // Load and decrypt the filtered events
    const events: CalendarEvent[] = []
    for (const entry of filteredEntries) {
      try {
        const event = await this.getEvent(entry.id)
        if (event) {
          events.push(event)
        }
      } catch (error) {
        console.warn(`Failed to load event ${entry.id}:`, error)
      }
    }

    return events
  }

  /**
   * Get all events for a specific user
   */
  async getUserEvents(userId: string): Promise<CalendarEvent[]> {
    return this.queryEvents({ userId })
  }

  /**
   * Verify data integrity of all stored events
   * Requirement 8.3: Data integrity verification
   */
  async verifyDataIntegrity(): Promise<IntegrityReport> {
    this.ensureInitialized()

    const report: IntegrityReport = {
      totalEvents: this.eventIndex.size,
      validEvents: 0,
      corruptedEvents: [],
      missingFiles: [],
      indexInconsistencies: []
    }

    for (const [eventId, indexEntry] of this.eventIndex) {
      try {
        // Check if file exists
        await fs.access(indexEntry.filePath)
        
        // Try to decrypt and validate event
        const event = await this.getEvent(eventId)
        if (event) {
          const validation = validateCalendarEvent(event)
          if (validation.isValid) {
            report.validEvents++
          } else {
            report.corruptedEvents.push({
              eventId,
              error: `Validation failed: ${validation.errors.join(', ')}`
            })
          }
        } else {
          report.corruptedEvents.push({
            eventId,
            error: 'Failed to decrypt event data'
          })
        }
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          report.missingFiles.push(eventId)
        } else {
          report.corruptedEvents.push({
            eventId,
            error: (error as Error).message
          })
        }
      }
    }

    return report
  }

  /**
   * Create automatic backup of event data
   * Requirement 8.3: Automatic backup creation
   */
  private async createBackup(eventId: string, encryptedData: Buffer, suffix = ''): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true })
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `${eventId}_${timestamp}${suffix ? '_' + suffix : ''}.backup`
      const backupFilePath = path.join(this.backupPath, backupFileName)
      
      await fs.writeFile(backupFilePath, encryptedData)
      
      // Clean up old backups (keep last 10 per event)
      await this.cleanupOldBackups(eventId)
    } catch (error) {
      console.warn('Failed to create backup:', error)
      // Don't fail the main operation if backup fails
    }
  }

  /**
   * Recover event from backup if main file is corrupted
   */
  private async recoverEventFromBackup(eventId: string): Promise<CalendarEvent | null> {
    try {
      const backupFiles = await fs.readdir(this.backupPath)
      const eventBackups = backupFiles
        .filter(file => file.startsWith(eventId + '_'))
        .sort()
        .reverse() // Most recent first

      for (const backupFile of eventBackups) {
        try {
          const backupPath = path.join(this.backupPath, backupFile)
          const encryptedData = await fs.readFile(backupPath)
          const decryptedData = await this.decryptEventData(encryptedData)
          return deserializeCalendarEvent(decryptedData)
        } catch (error) {
          continue // Try next backup
        }
      }
    } catch (error) {
      // No backups available
    }

    return null
  }

  /**
   * Encrypt event data using AES-256-CBC
   */
  private async encryptEventData(event: CalendarEvent): Promise<Buffer> {
    const serializedEvent = serializeCalendarEvent(event)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    let encrypted = cipher.update(serializedEvent, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    // Combine IV and encrypted data
    const result = Buffer.concat([iv, encrypted])
    
    return result
  }

  /**
   * Decrypt event data using AES-256-CBC
   */
  private async decryptEventData(encryptedData: Buffer): Promise<string> {
    const iv = encryptedData.slice(0, 16)
    const encrypted = encryptedData.slice(16)
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
  }

  /**
   * Load event index from disk
   */
  private async loadEventIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf8')
      const indexObj = JSON.parse(indexData)
      
      this.eventIndex.clear()
      for (const [id, entry] of Object.entries(indexObj)) {
        this.eventIndex.set(id, {
          ...entry as EventIndexEntry,
          startTime: new Date((entry as any).startTime),
          endTime: new Date((entry as any).endTime),
          lastModified: new Date((entry as any).lastModified)
        })
      }
    } catch (error) {
      // Index doesn't exist yet, start with empty index
      this.eventIndex.clear()
    }
  }

  /**
   * Serialize event index for storage
   */
  private serializeIndex(): string {
    const indexObj: Record<string, any> = {}
    
    for (const [id, entry] of this.eventIndex) {
      indexObj[id] = {
        ...entry,
        startTime: entry.startTime.toISOString(),
        endTime: entry.endTime.toISOString(),
        lastModified: entry.lastModified.toISOString()
      }
    }
    
    return JSON.stringify(indexObj, null, 2)
  }

  /**
   * Get file path for event storage
   */
  private getEventFilePath(eventId: string): string {
    return path.join(this.storePath, `${eventId}.event`)
  }

  /**
   * Clean up old backup files (keep last 10 per event)
   */
  private async cleanupOldBackups(eventId: string): Promise<void> {
    try {
      const backupFiles = await fs.readdir(this.backupPath)
      const eventBackups = backupFiles
        .filter(file => file.startsWith(eventId + '_'))
        .sort()

      if (eventBackups.length > 10) {
        const filesToDelete = eventBackups.slice(0, eventBackups.length - 10)
        for (const file of filesToDelete) {
          await fs.unlink(path.join(this.backupPath, file))
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Ensure store is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new EventStoreError('Event store not initialized. Call initialize() first.')
    }
  }
}

/**
 * Transaction manager for atomic operations
 * Requirement 8.1: Atomic event operations with rollback capabilities
 */
class StoreTransaction {
  private operations: TransactionOperation[] = []
  private isActive = false

  constructor(private store: EventStore) {}

  async begin(): Promise<void> {
    this.operations = []
    this.isActive = true
  }

  async writeFile(filePath: string, data: Buffer): Promise<void> {
    if (!this.isActive) throw new Error('Transaction not active')
    
    this.operations.push({
      type: 'write',
      filePath,
      data,
      originalExists: await this.fileExists(filePath),
      originalData: await this.readFileIfExists(filePath)
    })
  }

  async deleteFile(filePath: string): Promise<void> {
    if (!this.isActive) throw new Error('Transaction not active')
    
    this.operations.push({
      type: 'delete',
      filePath,
      originalExists: await this.fileExists(filePath),
      originalData: await this.readFileIfExists(filePath)
    })
  }

  async writeIndex(indexPath: string, data: string): Promise<void> {
    if (!this.isActive) throw new Error('Transaction not active')
    
    this.operations.push({
      type: 'writeIndex',
      filePath: indexPath,
      data: Buffer.from(data, 'utf8'),
      originalExists: await this.fileExists(indexPath),
      originalData: await this.readFileIfExists(indexPath)
    })
  }

  async commit(): Promise<void> {
    if (!this.isActive) throw new Error('Transaction not active')
    
    try {
      // Execute all operations
      for (const op of this.operations) {
        if (op.type === 'write' || op.type === 'writeIndex') {
          // Ensure directory exists before writing
          await fs.mkdir(path.dirname(op.filePath), { recursive: true })
          await fs.writeFile(op.filePath, op.data!)
        } else if (op.type === 'delete') {
          await fs.unlink(op.filePath)
        }
      }
      
      this.isActive = false
      this.operations = []
    } catch (error) {
      await this.rollback()
      throw error
    }
  }

  async rollback(): Promise<void> {
    if (!this.isActive) return
    
    try {
      // Reverse all operations
      for (const op of this.operations.reverse()) {
        if (op.type === 'write' || op.type === 'writeIndex') {
          if (op.originalExists && op.originalData) {
            await fs.writeFile(op.filePath, op.originalData)
          } else if (!op.originalExists) {
            await fs.unlink(op.filePath).catch(() => {}) // Ignore if file doesn't exist
          }
        } else if (op.type === 'delete') {
          if (op.originalExists && op.originalData) {
            await fs.writeFile(op.filePath, op.originalData)
          }
        }
      }
    } catch (error) {
      console.error('Error during transaction rollback:', error)
    }
    
    this.isActive = false
    this.operations = []
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async readFileIfExists(filePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(filePath)
    } catch {
      return null
    }
  }
}

// Interfaces and types
interface EventIndexEntry {
  id: string
  title: string
  startTime: Date
  endTime: Date
  category: EventCategory
  priority: Priority
  createdBy: string
  tags: string[]
  filePath: string
  lastModified: Date
}

interface TransactionOperation {
  type: 'write' | 'delete' | 'writeIndex'
  filePath: string
  data?: Buffer
  originalExists: boolean
  originalData: Buffer | null
}

export interface IntegrityReport {
  totalEvents: number
  validEvents: number
  corruptedEvents: Array<{
    eventId: string
    error: string
  }>
  missingFiles: string[]
  indexInconsistencies: string[]
}

export class EventStoreError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'EventStoreError'
  }
}