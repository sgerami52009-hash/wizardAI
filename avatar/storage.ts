// Avatar Data Storage with AES-256 Encryption

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AvatarConfiguration } from './types';
import { AvatarDataValidator, AvatarDataSerializer, ValidationResult } from './validation';
import { safelyMigrateAvatarData } from './migration';

export interface StorageOptions {
  encryptionKey?: string;
  backupEnabled?: boolean;
  compressionEnabled?: boolean;
  integrityCheckEnabled?: boolean;
}

export interface BackupInfo {
  id: string;
  userId: string;
  createdAt: Date;
  size: number;
  checksum: string;
  filePath: string;
}

export interface IntegrityResult {
  isValid: boolean;
  corruptedFiles: string[];
  repairActions: string[];
  checksumMismatches: string[];
}

export interface StorageTransaction {
  id: string;
  userId: string;
  operation: 'save' | 'delete' | 'backup' | 'restore';
  startTime: Date;
  completed: boolean;
  rollbackData?: Buffer;
}

/**
 * Encrypted Avatar Data Store Implementation
 * Provides AES-256 encryption, atomic updates, and backup/recovery
 */
export class AvatarDataStore {
  private readonly storageDir: string;
  private readonly backupDir: string;
  private readonly encryptionKey: Buffer;
  private readonly options: Required<StorageOptions>;
  private readonly activeTransactions = new Map<string, StorageTransaction>();

  constructor(storageDir: string = './data/avatars', options: StorageOptions = {}) {
    this.storageDir = path.resolve(storageDir);
    this.backupDir = path.resolve(storageDir, 'backups');
    
    // Initialize encryption key
    this.encryptionKey = options.encryptionKey 
      ? Buffer.from(options.encryptionKey, 'hex')
      : this.generateEncryptionKey();
    
    this.options = {
      encryptionKey: this.encryptionKey.toString('hex'),
      backupEnabled: options.backupEnabled ?? true,
      compressionEnabled: options.compressionEnabled ?? true,
      integrityCheckEnabled: options.integrityCheckEnabled ?? true
    };
  }

  /**
   * Initialize storage directories and verify encryption key
   */
  async initialize(): Promise<void> {
    try {
      // Create storage directories
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Verify encryption key works
      await this.testEncryption();
      
      console.log('Avatar data store initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize avatar data store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save avatar configuration with atomic updates and encryption
   */
  async saveAvatarConfiguration(userId: string, configuration: AvatarConfiguration): Promise<void> {
    const transactionId = this.generateTransactionId();
    const transaction: StorageTransaction = {
      id: transactionId,
      userId,
      operation: 'save',
      startTime: new Date(),
      completed: false
    };

    try {
      this.activeTransactions.set(transactionId, transaction);

      // Validate configuration before saving
      const validation = AvatarDataValidator.validateAvatarConfiguration(configuration);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Create backup of existing data if it exists
      const existingData = await this.loadAvatarConfigurationInternal(userId, false);
      if (existingData) {
        transaction.rollbackData = await this.encryptData(AvatarDataSerializer.serialize(existingData));
      }

      // Create automatic backup if enabled
      if (this.options.backupEnabled && existingData) {
        await this.createBackup(userId);
      }

      // Serialize and encrypt the configuration
      const serializedData = AvatarDataSerializer.serialize(configuration, {
        validateOnSerialize: true,
        compress: this.options.compressionEnabled
      });
      
      const encryptedData = await this.encryptData(serializedData);
      
      // Calculate checksum for integrity verification
      const checksum = this.calculateChecksum(encryptedData);
      
      // Create storage metadata
      const metadata = {
        userId,
        version: configuration.version,
        checksum,
        createdAt: new Date().toISOString(),
        encrypted: true,
        compressed: this.options.compressionEnabled
      };

      // Atomic write: write to temporary file first, then rename
      const filePath = this.getUserFilePath(userId);
      const tempFilePath = `${filePath}.tmp.${transactionId}`;
      const metadataPath = this.getUserMetadataPath(userId);
      const tempMetadataPath = `${metadataPath}.tmp.${transactionId}`;

      try {
        // Write encrypted data and metadata to temporary files
        await fs.writeFile(tempFilePath, encryptedData);
        await fs.writeFile(tempMetadataPath, JSON.stringify(metadata, null, 2));

        // Atomic rename (this is the commit point)
        await fs.rename(tempFilePath, filePath);
        await fs.rename(tempMetadataPath, metadataPath);

        transaction.completed = true;
        console.log(`Avatar configuration saved successfully for user ${userId}`);

      } catch (writeError) {
        // Cleanup temporary files on failure
        try {
          await fs.unlink(tempFilePath).catch(() => {});
          await fs.unlink(tempMetadataPath).catch(() => {});
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary files:', cleanupError);
        }
        throw writeError;
      }

    } catch (error) {
      // Rollback if we have rollback data
      if (transaction.rollbackData) {
        try {
          await this.rollbackTransaction(transaction);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }
      
      throw new Error(`Failed to save avatar configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Load avatar configuration with decryption and migration
   */
  async loadAvatarConfiguration(userId: string): Promise<AvatarConfiguration> {
    const config = await this.loadAvatarConfigurationInternal(userId, true);
    if (!config) {
      throw new Error(`No avatar configuration found for user ${userId}`);
    }
    return config;
  }

  /**
   * Internal load method with optional migration
   */
  private async loadAvatarConfigurationInternal(userId: string, performMigration: boolean): Promise<AvatarConfiguration | null> {
    try {
      const filePath = this.getUserFilePath(userId);
      const metadataPath = this.getUserMetadataPath(userId);

      // Check if files exist
      try {
        await fs.access(filePath);
      } catch {
        return null; // File doesn't exist
      }

      // Load and verify metadata
      let metadata: any = {};
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        console.warn(`Failed to load metadata for user ${userId}, proceeding without integrity check`);
      }

      // Load encrypted data
      const encryptedData = await fs.readFile(filePath);

      // Verify integrity if enabled and metadata available
      if (this.options.integrityCheckEnabled && metadata.checksum) {
        const currentChecksum = this.calculateChecksum(encryptedData);
        if (currentChecksum !== metadata.checksum) {
          throw new Error(`Data integrity check failed for user ${userId} - file may be corrupted`);
        }
      }

      // Decrypt data
      const decryptedData = await this.decryptData(encryptedData);
      
      // Deserialize configuration
      let configuration = AvatarDataSerializer.deserialize(decryptedData, {
        validateOnSerialize: false // We'll validate after potential migration
      });

      // Perform migration if needed and requested
      if (performMigration) {
        configuration = await safelyMigrateAvatarData(configuration);
      }

      // Final validation
      const validation = AvatarDataValidator.validateAvatarConfiguration(configuration);
      if (!validation.isValid) {
        console.warn(`Loaded configuration has validation issues: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      return configuration;

    } catch (error) {
      throw new Error(`Failed to load avatar configuration for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create encrypted backup of user's avatar data
   */
  async createBackup(userId: string): Promise<BackupInfo> {
    try {
      const configuration = await this.loadAvatarConfigurationInternal(userId, false);
      if (!configuration) {
        throw new Error(`No configuration found for user ${userId}`);
      }

      const backupId = this.generateBackupId(userId);
      const backupPath = path.join(this.backupDir, `${userId}_${backupId}.backup`);
      
      // Serialize and encrypt backup data
      const serializedData = AvatarDataSerializer.serialize(configuration, {
        includeMetadata: true,
        validateOnSerialize: true
      });
      
      const encryptedBackup = await this.encryptData(serializedData);
      
      // Write backup file
      await fs.writeFile(backupPath, encryptedBackup);
      
      // Calculate file size and checksum
      const stats = await fs.stat(backupPath);
      const checksum = this.calculateChecksum(encryptedBackup);
      
      const backupInfo: BackupInfo = {
        id: backupId,
        userId,
        createdAt: new Date(),
        size: stats.size,
        checksum,
        filePath: backupPath
      };

      // Save backup metadata
      const metadataPath = path.join(this.backupDir, `${userId}_${backupId}.meta`);
      await fs.writeFile(metadataPath, JSON.stringify(backupInfo, null, 2));

      console.log(`Backup created for user ${userId}: ${backupId}`);
      return backupInfo;

    } catch (error) {
      throw new Error(`Failed to create backup for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore avatar configuration from backup
   */
  async restoreFromBackup(userId: string, backupId: string): Promise<void> {
    const transactionId = this.generateTransactionId();
    const transaction: StorageTransaction = {
      id: transactionId,
      userId,
      operation: 'restore',
      startTime: new Date(),
      completed: false
    };

    try {
      this.activeTransactions.set(transactionId, transaction);

      // Load backup metadata
      const metadataPath = path.join(this.backupDir, `${userId}_${backupId}.meta`);
      const backupPath = path.join(this.backupDir, `${userId}_${backupId}.backup`);

      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const backupInfo: BackupInfo = JSON.parse(metadataContent);

      // Verify backup integrity
      const backupData = await fs.readFile(backupPath);
      const currentChecksum = this.calculateChecksum(backupData);
      
      if (currentChecksum !== backupInfo.checksum) {
        throw new Error(`Backup integrity check failed for backup ${backupId}`);
      }

      // Create backup of current data before restore
      const currentData = await this.loadAvatarConfigurationInternal(userId, false);
      if (currentData) {
        transaction.rollbackData = await this.encryptData(AvatarDataSerializer.serialize(currentData));
      }

      // Decrypt and deserialize backup data
      const decryptedData = await this.decryptData(backupData);
      const restoredConfiguration = AvatarDataSerializer.deserialize(decryptedData);

      // Migrate restored data if needed
      const migratedConfiguration = await safelyMigrateAvatarData(restoredConfiguration);

      // Save restored configuration
      await this.saveAvatarConfiguration(userId, migratedConfiguration);

      transaction.completed = true;
      console.log(`Successfully restored user ${userId} from backup ${backupId}`);

    } catch (error) {
      // Rollback if we have rollback data
      if (transaction.rollbackData) {
        try {
          await this.rollbackTransaction(transaction);
        } catch (rollbackError) {
          console.error('Rollback failed during restore:', rollbackError);
        }
      }
      
      throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Verify data integrity for a user's avatar configuration
   */
  async verifyDataIntegrity(userId: string): Promise<IntegrityResult> {
    const result: IntegrityResult = {
      isValid: true,
      corruptedFiles: [],
      repairActions: [],
      checksumMismatches: []
    };

    try {
      const filePath = this.getUserFilePath(userId);
      const metadataPath = this.getUserMetadataPath(userId);

      // Check if main file exists
      try {
        await fs.access(filePath);
      } catch {
        result.isValid = false;
        result.corruptedFiles.push(filePath);
        result.repairActions.push('Restore from backup or recreate configuration');
        return result;
      }

      // Load and verify metadata
      let metadata: any = null;
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
      } catch (error) {
        result.corruptedFiles.push(metadataPath);
        result.repairActions.push('Regenerate metadata from configuration file');
      }

      // Verify file checksum if metadata available
      if (metadata && metadata.checksum) {
        const fileData = await fs.readFile(filePath);
        const currentChecksum = this.calculateChecksum(fileData);
        
        if (currentChecksum !== metadata.checksum) {
          result.isValid = false;
          result.checksumMismatches.push(filePath);
          result.repairActions.push('Restore from backup or verify file integrity');
        }
      }

      // Try to decrypt and validate the configuration
      try {
        const configuration = await this.loadAvatarConfigurationInternal(userId, false);
        if (configuration) {
          const validation = AvatarDataValidator.validateAvatarConfiguration(configuration);
          if (!validation.isValid) {
            result.isValid = false;
            result.repairActions.push('Configuration validation failed - may need migration or repair');
          }
        }
      } catch (error) {
        result.isValid = false;
        result.corruptedFiles.push(filePath);
        result.repairActions.push(`Failed to decrypt/validate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      result.isValid = false;
      result.repairActions.push(`Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Migrate user data from old user ID to new user ID
   */
  async migrateUserData(oldUserId: string, newUserId: string): Promise<void> {
    try {
      // Load configuration from old user ID
      const configuration = await this.loadAvatarConfiguration(oldUserId);
      
      // Update user ID in configuration
      const migratedConfiguration: AvatarConfiguration = {
        ...configuration,
        userId: newUserId,
        lastModified: new Date()
      };

      // Save under new user ID
      await this.saveAvatarConfiguration(newUserId, migratedConfiguration);

      // Create backup of old data before deletion
      await this.createBackup(oldUserId);

      // Remove old user data
      const oldFilePath = this.getUserFilePath(oldUserId);
      const oldMetadataPath = this.getUserMetadataPath(oldUserId);
      
      try {
        await fs.unlink(oldFilePath);
        await fs.unlink(oldMetadataPath);
      } catch (error) {
        console.warn(`Failed to cleanup old user data for ${oldUserId}:`, error);
      }

      console.log(`Successfully migrated user data from ${oldUserId} to ${newUserId}`);

    } catch (error) {
      throw new Error(`Failed to migrate user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async encryptData(data: string): Promise<Buffer> {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      return Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async decryptData(encryptedBuffer: Buffer): Promise<string> {
    try {
      const iv = encryptedBuffer.slice(0, 16);
      const encryptedData = encryptedBuffer.slice(16);
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32); // 256-bit key
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateBackupId(userId: string): string {
    return `${Date.now()}_${crypto.createHash('md5').update(userId).digest('hex').slice(0, 8)}`;
  }

  private getUserFilePath(userId: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeUserId}.avatar`);
  }

  private getUserMetadataPath(userId: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeUserId}.meta`);
  }

  private async testEncryption(): Promise<void> {
    const testData = 'encryption_test_data';
    const encrypted = await this.encryptData(testData);
    const decrypted = await this.decryptData(encrypted);
    
    if (decrypted !== testData) {
      throw new Error('Encryption test failed - key may be invalid');
    }
  }

  private async rollbackTransaction(transaction: StorageTransaction): Promise<void> {
    if (!transaction.rollbackData) {
      throw new Error('No rollback data available for transaction');
    }

    try {
      const filePath = this.getUserFilePath(transaction.userId);
      await fs.writeFile(filePath, transaction.rollbackData);
      console.log(`Transaction ${transaction.id} rolled back successfully`);
    } catch (error) {
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create and initialize avatar data store
 */
export async function createAvatarDataStore(storageDir?: string, options?: StorageOptions): Promise<AvatarDataStore> {
  const store = new AvatarDataStore(storageDir, options);
  await store.initialize();
  return store;
}