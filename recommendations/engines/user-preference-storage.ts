/**
 * User Preference Storage Implementation
 * 
 * Provides encrypted storage for user preferences with privacy-preserving operations.
 * Uses AES-256 encryption for all user data as required by safety guidelines.
 * 
 * Requirements: 6.1, 6.2, 6.4
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  UserPreferences,
  Interest,
  PrivacySettings
} from '../types';
import { IUserPreferenceStorage } from './user-preference-engine';

/**
 * File-based storage implementation for user preferences
 * Uses AES-256 encryption for all stored data
 */
export class UserPreferenceStorage implements IUserPreferenceStorage {
  private readonly storageDir: string;
  private readonly encryptionKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationSalt: Buffer = Buffer.from('family-assistant-salt', 'utf8');

  constructor(storageDir: string = './data/preferences', encryptionPassword?: string) {
    this.storageDir = storageDir;
    
    // Generate or derive encryption key
    if (encryptionPassword) {
      this.encryptionKey = crypto.pbkdf2Sync(encryptionPassword, this.keyDerivationSalt, 100000, 32, 'sha256');
    } else {
      // Generate random key (should be stored securely in production)
      this.encryptionKey = crypto.randomBytes(32);
    }

    this.ensureStorageDirectory();
  }

  /**
   * Save user preferences with AES-256 encryption
   * Requirements: 6.2, 6.4
   */
  async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    try {
      // Validate user ID for safety
      this.validateUserId(userId);

      // Encrypt preferences
      const encryptedData = await this.encryptPreferences(preferences);

      // Save to file
      const filePath = this.getUserPreferencesPath(userId);
      await fs.writeFile(filePath, encryptedData, 'utf8');

      // Log operation for audit (without sensitive data)
      console.log(`User preferences saved for user: ${this.sanitizeForLog(userId)}`);
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      throw new Error('Failed to save user preferences');
    }
  }

  /**
   * Load user preferences with decryption
   * Requirements: 6.1, 6.2
   */
  async loadUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      // Validate user ID
      this.validateUserId(userId);

      const filePath = this.getUserPreferencesPath(userId);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return null; // File doesn't exist
      }

      // Read and decrypt
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const preferences = await this.decryptPreferences(encryptedData);

      // Validate loaded data
      this.validatePreferences(preferences);

      return preferences;
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      throw new Error('Failed to load user preferences');
    }
  }

  /**
   * Update user interests with encryption
   * Requirements: 6.2, 6.4
   */
  async updateInterests(userId: string, interests: Interest[]): Promise<void> {
    const preferences = await this.loadUserPreferences(userId);
    if (!preferences) {
      throw new Error('User preferences not found');
    }

    preferences.interests = interests;
    preferences.lastUpdated = new Date();

    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Get interest history for analysis
   * Requirements: 6.1, 6.2
   */
  async getInterestHistory(userId: string, timeRange: { start: Date; end: Date }): Promise<Interest[]> {
    const preferences = await this.loadUserPreferences(userId);
    if (!preferences) {
      return [];
    }

    // Filter interests by time range
    return preferences.interests.filter(interest => 
      interest.recency >= timeRange.start && interest.recency <= timeRange.end
    );
  }

  /**
   * Delete user preferences (GDPR compliance)
   * Requirements: 6.1, 6.4
   */
  async deleteUserPreferences(userId: string): Promise<void> {
    try {
      this.validateUserId(userId);

      const filePath = this.getUserPreferencesPath(userId);
      
      // Securely delete file
      await this.secureDelete(filePath);

      console.log(`User preferences deleted for user: ${this.sanitizeForLog(userId)}`);
    } catch (error) {
      console.error('Failed to delete user preferences:', error);
      throw new Error('Failed to delete user preferences');
    }
  }

  /**
   * Encrypt user preferences using AES-256-GCM
   * Requirements: 6.2
   */
  async encryptPreferences(preferences: UserPreferences): Promise<string> {
    try {
      // Convert to JSON
      const jsonData = JSON.stringify(preferences);
      
      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from(preferences.userId, 'utf8')); // Additional authenticated data
      
      // Encrypt
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted
      };
      
      return JSON.stringify(result);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt preferences');
    }
  }

  /**
   * Decrypt user preferences
   * Requirements: 6.2
   */
  async decryptPreferences(encryptedData: string): Promise<UserPreferences> {
    try {
      // Parse encrypted data structure
      const data = JSON.parse(encryptedData);
      const { iv, authTag, encrypted } = data;
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse JSON
      const preferences = JSON.parse(decrypted) as UserPreferences;
      
      return preferences;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt preferences');
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
      throw new Error('Failed to initialize storage');
    }
  }

  /**
   * Get file path for user preferences
   */
  private getUserPreferencesPath(userId: string): string {
    // Hash user ID for filename privacy
    const hashedUserId = crypto.createHash('sha256').update(userId).digest('hex');
    return path.join(this.storageDir, `${hashedUserId}.prefs`);
  }

  /**
   * Validate user ID for security
   */
  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }

    // Check for path traversal attempts
    if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) {
      throw new Error('Invalid user ID format');
    }

    // Limit length
    if (userId.length > 100) {
      throw new Error('User ID too long');
    }
  }

  /**
   * Validate preferences structure
   */
  private validatePreferences(preferences: UserPreferences): void {
    if (!preferences || typeof preferences !== 'object') {
      throw new Error('Invalid preferences structure');
    }

    if (!preferences.userId || !preferences.lastUpdated) {
      throw new Error('Missing required preference fields');
    }

    // Validate interests array
    if (!Array.isArray(preferences.interests)) {
      throw new Error('Invalid interests structure');
    }

    // Validate each interest
    for (const interest of preferences.interests) {
      if (!interest.category || typeof interest.strength !== 'number') {
        throw new Error('Invalid interest structure');
      }

      if (interest.strength < 0 || interest.strength > 1) {
        throw new Error('Invalid interest strength value');
      }
    }
  }

  /**
   * Securely delete file by overwriting with random data
   * Requirements: 6.4
   */
  private async secureDelete(filePath: string): Promise<void> {
    try {
      // Check if file exists
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Overwrite with random data multiple times
      for (let i = 0; i < 3; i++) {
        const randomData = crypto.randomBytes(fileSize);
        await fs.writeFile(filePath, randomData);
      }

      // Finally delete the file
      await fs.unlink(filePath);
    } catch (error: any) {
      // If file doesn't exist, that's fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Sanitize user ID for logging (remove PII)
   */
  private sanitizeForLog(userId: string): string {
    // Return only first 4 characters + hash for logging
    const hash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
    return `${userId.substring(0, 4)}...${hash}`;
  }

  /**
   * Get storage statistics for monitoring
   */
  async getStorageStats(): Promise<{
    totalUsers: number;
    totalSize: number;
    lastCleanup: Date;
  }> {
    try {
      const files = await fs.readdir(this.storageDir);
      const prefFiles = files.filter(f => f.endsWith('.prefs'));
      
      let totalSize = 0;
      for (const file of prefFiles) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return {
        totalUsers: prefFiles.length,
        totalSize,
        lastCleanup: new Date() // This would be tracked separately in production
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalUsers: 0,
        totalSize: 0,
        lastCleanup: new Date()
      };
    }
  }

  /**
   * Cleanup old or invalid preference files
   * Requirements: 6.1 (data minimization)
   */
  async cleanupStorage(maxAge: number = 365): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      const prefFiles = files.filter(f => f.endsWith('.prefs'));
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);

      for (const file of prefFiles) {
        const filePath = path.join(this.storageDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await this.secureDelete(filePath);
          console.log(`Cleaned up old preference file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Storage cleanup failed:', error);
    }
  }
}

/**
 * In-memory storage implementation for testing
 */
export class InMemoryUserPreferenceStorage implements IUserPreferenceStorage {
  private preferences: Map<string, UserPreferences> = new Map();
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = crypto.randomBytes(32);
  }

  async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    this.preferences.set(userId, { ...preferences });
  }

  async loadUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.preferences.get(userId) || null;
  }

  async updateInterests(userId: string, interests: Interest[]): Promise<void> {
    const prefs = this.preferences.get(userId);
    if (prefs) {
      prefs.interests = interests;
      prefs.lastUpdated = new Date();
    }
  }

  async getInterestHistory(userId: string, timeRange: { start: Date; end: Date }): Promise<Interest[]> {
    const prefs = this.preferences.get(userId);
    if (!prefs) return [];

    return prefs.interests.filter(interest => 
      interest.recency >= timeRange.start && interest.recency <= timeRange.end
    );
  }

  async deleteUserPreferences(userId: string): Promise<void> {
    this.preferences.delete(userId);
  }

  async encryptPreferences(preferences: UserPreferences): Promise<string> {
    // Simple base64 encoding for testing
    return Buffer.from(JSON.stringify(preferences)).toString('base64');
  }

  async decryptPreferences(encryptedData: string): Promise<UserPreferences> {
    // Simple base64 decoding for testing
    const jsonData = Buffer.from(encryptedData, 'base64').toString('utf8');
    return JSON.parse(jsonData);
  }
}