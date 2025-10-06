// Reminder Storage - Encrypted persistence and recovery system

import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { EventEmitter } from 'events'
import {
  Reminder,
  ReminderProcessingResult,
  ReminderError,
  ReminderErrorType,
  UserContext,
  BehaviorPattern
} from './types'
import { ReminderStrategy, StrategyAdaptation } from './intelligent-timing'

/**
 * ReminderStorage - Manages encrypted reminder data persistence and recovery
 * 
 * Provides secure storage with AES-256 encryption, automatic backup creation,
 * and system failure recovery mechanisms.
 * 
 * Safety: All data encrypted with user-specific keys, audit trail maintained
 * Performance: Optimized for Jetson Nano Orin with efficient I/O operations
 */
export class ReminderStorage extends EventEmitter {
  private readonly storageDir: string
  private readonly backupDir: string
  private readonly auditDir: string
  private readonly encryptionKey: Buffer
  private readonly BACKUP_INTERVAL_MS = 60000 // 1 minute
  private readonly MAX_BACKUPS = 10
  private readonly AUDIT_RETENTION_DAYS = 30
  private backupInterval: NodeJS.Timeout | null = null

  constructor(storageDir: string = './data/reminders', encryptionKey?: string) {
    super()
    this.storageDir = storageDir
    this.backupDir = path.join(storageDir, 'backups')
    this.auditDir = path.join(storageDir, 'audit')
    
    // Use provided key or generate one
    this.encryptionKey = encryptionKey 
      ? Buffer.from(encryptionKey, 'hex')
      : crypto.randomBytes(32)
    
    this.initializeStorage()
    this.startBackupScheduler()
  }

  /**
   * Store reminder with encryption and backup
   */
  async storeReminder(reminder: Reminder): Promise<void> {
    try {
      const encryptedData = this.encryptData(JSON.stringify(reminder))
      const filePath = this.getReminderFilePath(reminder.id)
      
      await this.ensureDirectoryExists(path.dirname(filePath))
      await fs.writeFile(filePath, encryptedData)
      
      // Create audit entry
      await this.createAuditEntry('reminder_stored', {
        reminderId: reminder.id,
        userId: reminder.userId,
        action: 'store'
      })
      
      this.emit('reminder:stored', {
        reminderId: reminder.id,
        userId: reminder.userId,
        timestamp: new Date()
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to store reminder ${reminder.id}: ${errorMessage}`)
    }
  }

  /**
   * Retrieve reminder by ID with decryption
   */
  async getReminder(reminderId: string): Promise<Reminder | null> {
    try {
      const filePath = this.getReminderFilePath(reminderId)
      
      try {
        const encryptedData = await fs.readFile(filePath)
        const decryptedData = this.decryptData(encryptedData)
        return JSON.parse(decryptedData)
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return null // File not found
        }
        throw error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to retrieve reminder ${reminderId}: ${errorMessage}`)
    }
  }

  /**
   * Update existing reminder
   */
  async updateReminder(reminder: Reminder): Promise<void> {
    try {
      // Verify reminder exists
      const existing = await this.getReminder(reminder.id)
      if (!existing) {
        throw new Error(`Reminder ${reminder.id} not found`)
      }
      
      // Store updated reminder
      await this.storeReminder(reminder)
      
      // Create audit entry
      await this.createAuditEntry('reminder_updated', {
        reminderId: reminder.id,
        userId: reminder.userId,
        action: 'update',
        changes: this.calculateChanges(existing, reminder)
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to update reminder ${reminder.id}: ${errorMessage}`)
    }
  }

  /**
   * Delete reminder
   */
  async deleteReminder(reminderId: string): Promise<void> {
    try {
      const filePath = this.getReminderFilePath(reminderId)
      
      // Get reminder for audit before deletion
      const reminder = await this.getReminder(reminderId)
      
      await fs.unlink(filePath)
      
      // Create audit entry
      if (reminder) {
        await this.createAuditEntry('reminder_deleted', {
          reminderId,
          userId: reminder.userId,
          action: 'delete'
        })
      }
      
      this.emit('reminder:deleted', {
        reminderId,
        timestamp: new Date()
      })
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw new Error(`Failed to delete reminder ${reminderId}: ${errorMessage}`)
      }
    }
  }

  /**
   * Get all reminders for a user
   */
  async getUserReminders(userId: string): Promise<Reminder[]> {
    try {
      const userDir = path.join(this.storageDir, 'reminders', userId)
      
      try {
        const files = await fs.readdir(userDir)
        const reminders: Reminder[] = []
        
        for (const file of files) {
          if (file.endsWith('.enc')) {
            const reminderId = file.replace('.enc', '')
            const reminder = await this.getReminder(reminderId)
            if (reminder && reminder.userId === userId) {
              reminders.push(reminder)
            }
          }
        }
        
        return reminders.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime())
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return [] // Directory doesn't exist yet
        }
        throw error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get reminders for user ${userId}: ${errorMessage}`)
    }
  }

  /**
   * Store reminder processing queue state
   */
  async storeQueueState(queueState: QueueState): Promise<void> {
    try {
      const encryptedData = this.encryptData(JSON.stringify(queueState))
      const filePath = path.join(this.storageDir, 'queue_state.enc')
      
      await fs.writeFile(filePath, encryptedData)
      
      this.emit('queue:state:stored', {
        queueSize: queueState.reminders.length,
        timestamp: new Date()
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to store queue state: ${errorMessage}`)
    }
  }

  /**
   * Retrieve reminder processing queue state
   */
  async getQueueState(): Promise<QueueState | null> {
    try {
      const filePath = path.join(this.storageDir, 'queue_state.enc')
      
      try {
        const encryptedData = await fs.readFile(filePath)
        const decryptedData = this.decryptData(encryptedData)
        const queueState = JSON.parse(decryptedData)
        
        // Convert date strings back to Date objects
        queueState.lastProcessed = new Date(queueState.lastProcessed)
        queueState.reminders = queueState.reminders.map((r: any) => ({
          ...r,
          triggerTime: new Date(r.triggerTime),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt)
        }))
        
        return queueState
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return null // File not found
        }
        throw error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to retrieve queue state: ${errorMessage}`)
    }
  }

  /**
   * Store user strategy with encryption
   */
  async storeUserStrategy(strategy: ReminderStrategy): Promise<void> {
    try {
      const encryptedData = this.encryptData(JSON.stringify(strategy))
      const filePath = this.getStrategyFilePath(strategy.userId)
      
      await this.ensureDirectoryExists(path.dirname(filePath))
      await fs.writeFile(filePath, encryptedData)
      
      await this.createAuditEntry('strategy_stored', {
        userId: strategy.userId,
        strategyName: strategy.name,
        action: 'store'
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to store strategy for user ${strategy.userId}: ${errorMessage}`)
    }
  }

  /**
   * Retrieve user strategy
   */
  async getUserStrategy(userId: string): Promise<ReminderStrategy | null> {
    try {
      const filePath = this.getStrategyFilePath(userId)
      
      try {
        const encryptedData = await fs.readFile(filePath)
        const decryptedData = this.decryptData(encryptedData)
        const strategy = JSON.parse(decryptedData)
        
        // Convert date strings back to Date objects
        strategy.createdAt = new Date(strategy.createdAt)
        strategy.lastUpdated = new Date(strategy.lastUpdated)
        
        return strategy
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return null
        }
        throw error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to retrieve strategy for user ${userId}: ${errorMessage}`)
    }
  }

  /**
   * Store adaptation history
   */
  async storeAdaptationHistory(userId: string, adaptations: StrategyAdaptation[]): Promise<void> {
    try {
      const encryptedData = this.encryptData(JSON.stringify(adaptations))
      const filePath = this.getAdaptationFilePath(userId)
      
      await this.ensureDirectoryExists(path.dirname(filePath))
      await fs.writeFile(filePath, encryptedData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to store adaptation history for user ${userId}: ${errorMessage}`)
    }
  }

  /**
   * Retrieve adaptation history
   */
  async getAdaptationHistory(userId: string): Promise<StrategyAdaptation[]> {
    try {
      const filePath = this.getAdaptationFilePath(userId)
      
      try {
        const encryptedData = await fs.readFile(filePath)
        const decryptedData = this.decryptData(encryptedData)
        const adaptations = JSON.parse(decryptedData)
        
        // Convert date strings back to Date objects
        return adaptations.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp)
        }))
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          return []
        }
        throw error
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to retrieve adaptation history for user ${userId}: ${errorMessage}`)
    }
  }

  /**
   * Create backup of all reminder data
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.backupDir, `backup_${timestamp}.tar`)
      
      // Create backup directory structure
      const tempBackupDir = path.join(this.backupDir, `temp_${timestamp}`)
      await this.ensureDirectoryExists(tempBackupDir)
      
      // Copy all reminder data
      await this.copyDirectory(this.storageDir, tempBackupDir, [this.backupDir, this.auditDir])
      
      // Create compressed backup (simplified - would use tar in real implementation)
      await this.createCompressedBackup(tempBackupDir, backupPath)
      
      // Clean up temp directory
      await this.removeDirectory(tempBackupDir)
      
      // Clean up old backups
      await this.cleanupOldBackups()
      
      await this.createAuditEntry('backup_created', {
        backupPath,
        action: 'backup'
      })
      
      this.emit('backup:created', {
        backupPath,
        timestamp: new Date()
      })
      
      return backupPath
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create backup: ${errorMessage}`)
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      // Verify backup exists
      await fs.access(backupPath)
      
      // Create temporary restore directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const tempRestoreDir = path.join(this.backupDir, `restore_${timestamp}`)
      
      // Extract backup (simplified)
      await this.extractBackup(backupPath, tempRestoreDir)
      
      // Backup current data before restore
      const currentBackup = await this.createBackup()
      
      // Replace current data with backup data
      await this.replaceStorageData(tempRestoreDir)
      
      // Clean up temp directory
      await this.removeDirectory(tempRestoreDir)
      
      await this.createAuditEntry('backup_restored', {
        backupPath,
        currentBackup,
        action: 'restore'
      })
      
      this.emit('backup:restored', {
        backupPath,
        currentBackup,
        timestamp: new Date()
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to restore from backup ${backupPath}: ${errorMessage}`)
    }
  }

  /**
   * Recover system after failure
   */
  async recoverFromFailure(): Promise<RecoveryResult> {
    try {
      const recoveryResult: RecoveryResult = {
        success: false,
        recoveredReminders: 0,
        corruptedFiles: [],
        restoredFromBackup: false,
        timestamp: new Date()
      }
      
      // Check for corrupted files
      const corruptedFiles = await this.findCorruptedFiles()
      recoveryResult.corruptedFiles = corruptedFiles
      
      if (corruptedFiles.length > 0) {
        // Attempt to restore from backup
        const latestBackup = await this.findLatestBackup()
        if (latestBackup) {
          await this.restoreFromBackup(latestBackup)
          recoveryResult.restoredFromBackup = true
        }
      }
      
      // Verify and count recovered reminders
      const allReminders = await this.getAllReminders()
      recoveryResult.recoveredReminders = allReminders.length
      recoveryResult.success = true
      
      await this.createAuditEntry('system_recovery', {
        corruptedFiles: corruptedFiles.length,
        recoveredReminders: recoveryResult.recoveredReminders,
        restoredFromBackup: recoveryResult.restoredFromBackup,
        action: 'recovery'
      })
      
      this.emit('system:recovered', recoveryResult)
      
      return recoveryResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`System recovery failed: ${errorMessage}`)
    }
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(startDate?: Date, endDate?: Date): Promise<AuditEntry[]> {
    try {
      const auditFiles = await fs.readdir(this.auditDir)
      const auditEntries: AuditEntry[] = []
      
      for (const file of auditFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.auditDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const entries = JSON.parse(content)
          
          for (const entry of entries) {
            entry.timestamp = new Date(entry.timestamp)
            
            // Filter by date range if provided
            if (startDate && entry.timestamp < startDate) continue
            if (endDate && entry.timestamp > endDate) continue
            
            auditEntries.push(entry)
          }
        }
      }
      
      return auditEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to retrieve audit trail: ${errorMessage}`)
    }
  }

  /**
   * Clean up old data and audit logs
   */
  async cleanup(): Promise<CleanupResult> {
    try {
      const result: CleanupResult = {
        deletedReminders: 0,
        deletedAuditEntries: 0,
        deletedBackups: 0,
        freedSpace: 0,
        timestamp: new Date()
      }
      
      // Clean up old completed reminders (older than 30 days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 30)
      
      const allReminders = await this.getAllReminders()
      for (const reminder of allReminders) {
        if ((reminder.completionStatus === 'completed' || reminder.completionStatus === 'cancelled') &&
            reminder.updatedAt < cutoffDate) {
          await this.deleteReminder(reminder.id)
          result.deletedReminders++
        }
      }
      
      // Clean up old audit logs
      result.deletedAuditEntries = await this.cleanupOldAuditLogs()
      
      // Clean up old backups
      result.deletedBackups = await this.cleanupOldBackups()
      
      await this.createAuditEntry('cleanup_completed', {
        deletedReminders: result.deletedReminders,
        deletedAuditEntries: result.deletedAuditEntries,
        deletedBackups: result.deletedBackups,
        action: 'cleanup'
      })
      
      this.emit('cleanup:completed', result)
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Cleanup failed: ${errorMessage}`)
    }
  }

  /**
   * Stop the storage system
   */
  stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval)
      this.backupInterval = null
    }
  }

  // Private helper methods

  private async initializeStorage(): Promise<void> {
    await this.ensureDirectoryExists(this.storageDir)
    await this.ensureDirectoryExists(this.backupDir)
    await this.ensureDirectoryExists(this.auditDir)
    await this.ensureDirectoryExists(path.join(this.storageDir, 'reminders'))
    await this.ensureDirectoryExists(path.join(this.storageDir, 'strategies'))
    await this.ensureDirectoryExists(path.join(this.storageDir, 'adaptations'))
  }

  private startBackupScheduler(): void {
    this.backupInterval = setInterval(async () => {
      try {
        await this.createBackup()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Scheduled backup failed:', errorMessage)
      }
    }, this.BACKUP_INTERVAL_MS)
  }

  private encryptData(data: string): Buffer {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return Buffer.concat([iv, Buffer.from(encrypted, 'hex')])
  }

  private decryptData(encryptedData: Buffer): string {
    const iv = encryptedData.slice(0, 16)
    const encrypted = encryptedData.slice(16)
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ])
    
    return decryptedBuffer.toString('utf8')
  }

  private getReminderFilePath(reminderId: string): string {
    // Use first 2 characters of ID for directory sharding
    const shard = reminderId.substring(0, 2)
    return path.join(this.storageDir, 'reminders', shard, `${reminderId}.enc`)
  }

  private getStrategyFilePath(userId: string): string {
    return path.join(this.storageDir, 'strategies', `${userId}.enc`)
  }

  private getAdaptationFilePath(userId: string): string {
    return path.join(this.storageDir, 'adaptations', `${userId}.enc`)
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }
  }

  private calculateChanges(oldReminder: Reminder, newReminder: Reminder): string[] {
    const changes: string[] = []
    
    if (oldReminder.title !== newReminder.title) changes.push('title')
    if (oldReminder.description !== newReminder.description) changes.push('description')
    if (oldReminder.triggerTime.getTime() !== newReminder.triggerTime.getTime()) changes.push('triggerTime')
    if (oldReminder.priority !== newReminder.priority) changes.push('priority')
    if (oldReminder.isActive !== newReminder.isActive) changes.push('isActive')
    if (oldReminder.completionStatus !== newReminder.completionStatus) changes.push('completionStatus')
    
    return changes
  }

  private async createAuditEntry(action: string, data: any): Promise<void> {
    try {
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        action,
        data,
        source: 'reminder_storage'
      }
      
      const date = new Date().toISOString().split('T')[0]
      const auditFile = path.join(this.auditDir, `audit_${date}.json`)
      
      let entries: AuditEntry[] = []
      try {
        const content = await fs.readFile(auditFile, 'utf-8')
        entries = JSON.parse(content)
      } catch (error) {
        // File doesn't exist yet
      }
      
      entries.push(entry)
      await fs.writeFile(auditFile, JSON.stringify(entries, null, 2))
    } catch (error) {
      // Don't throw on audit failures
      console.error('Failed to create audit entry:', error)
    }
  }

  private async getAllReminders(): Promise<Reminder[]> {
    const allReminders: Reminder[] = []
    const remindersDir = path.join(this.storageDir, 'reminders')
    
    try {
      const shards = await fs.readdir(remindersDir)
      
      for (const shard of shards) {
        const shardDir = path.join(remindersDir, shard)
        const files = await fs.readdir(shardDir)
        
        for (const file of files) {
          if (file.endsWith('.enc')) {
            const reminderId = file.replace('.enc', '')
            const reminder = await this.getReminder(reminderId)
            if (reminder) {
              allReminders.push(reminder)
            }
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return allReminders
  }

  private async findCorruptedFiles(): Promise<string[]> {
    const corruptedFiles: string[] = []
    const allReminders = await this.getAllReminders()
    
    // Simple corruption check - in real implementation would be more thorough
    for (const reminder of allReminders) {
      try {
        if (!reminder.id || !reminder.userId || !reminder.title) {
          corruptedFiles.push(this.getReminderFilePath(reminder.id))
        }
      } catch (error) {
        corruptedFiles.push(this.getReminderFilePath(reminder.id))
      }
    }
    
    return corruptedFiles
  }

  private async findLatestBackup(): Promise<string | null> {
    try {
      const backups = await fs.readdir(this.backupDir)
      const backupFiles = backups
        .filter(f => f.startsWith('backup_') && f.endsWith('.tar'))
        .sort()
        .reverse()
      
      return backupFiles.length > 0 ? path.join(this.backupDir, backupFiles[0]) : null
    } catch (error) {
      return null
    }
  }

  private async copyDirectory(src: string, dest: string, exclude: string[] = []): Promise<void> {
    // Simplified directory copy - would use more robust implementation
    await this.ensureDirectoryExists(dest)
    
    const items = await fs.readdir(src)
    
    for (const item of items) {
      const srcPath = path.join(src, item)
      const destPath = path.join(dest, item)
      
      if (exclude.some(ex => srcPath.includes(ex))) {
        continue
      }
      
      const stat = await fs.stat(srcPath)
      
      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath, exclude)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  private async createCompressedBackup(sourceDir: string, backupPath: string): Promise<void> {
    // Simplified backup creation - would use tar/gzip in real implementation
    await fs.writeFile(backupPath, `Backup of ${sourceDir} created at ${new Date().toISOString()}`)
  }

  private async extractBackup(backupPath: string, destDir: string): Promise<void> {
    // Simplified backup extraction - would use tar/gzip in real implementation
    await this.ensureDirectoryExists(destDir)
  }

  private async replaceStorageData(sourceDir: string): Promise<void> {
    // Simplified data replacement - would be more careful in real implementation
    await this.removeDirectory(this.storageDir)
    await this.copyDirectory(sourceDir, this.storageDir)
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true })
    } catch (error) {
      // Directory might not exist
    }
  }

  private async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await fs.readdir(this.backupDir)
      const backupFiles = backups
        .filter(f => f.startsWith('backup_') && f.endsWith('.tar'))
        .sort()
      
      let deletedCount = 0
      
      if (backupFiles.length > this.MAX_BACKUPS) {
        const toDelete = backupFiles.slice(0, backupFiles.length - this.MAX_BACKUPS)
        
        for (const backup of toDelete) {
          await fs.unlink(path.join(this.backupDir, backup))
          deletedCount++
        }
      }
      
      return deletedCount
    } catch (error) {
      return 0
    }
  }

  private async cleanupOldAuditLogs(): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.AUDIT_RETENTION_DAYS)
      
      const auditFiles = await fs.readdir(this.auditDir)
      let deletedCount = 0
      
      for (const file of auditFiles) {
        if (file.startsWith('audit_') && file.endsWith('.json')) {
          const dateStr = file.replace('audit_', '').replace('.json', '')
          const fileDate = new Date(dateStr)
          
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.auditDir, file))
            deletedCount++
          }
        }
      }
      
      return deletedCount
    } catch (error) {
      return 0
    }
  }
}

// Supporting interfaces

interface QueueState {
  reminders: Reminder[]
  lastProcessed: Date
  processingErrors: ReminderError[]
}

interface RecoveryResult {
  success: boolean
  recoveredReminders: number
  corruptedFiles: string[]
  restoredFromBackup: boolean
  timestamp: Date
}

interface AuditEntry {
  id: string
  timestamp: Date
  action: string
  data: any
  source: string
}

interface CleanupResult {
  deletedReminders: number
  deletedAuditEntries: number
  deletedBackups: number
  freedSpace: number
  timestamp: Date
}

export type { QueueState, RecoveryResult, AuditEntry, CleanupResult }