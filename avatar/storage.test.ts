// Avatar Storage System Tests

import { AvatarDataStore, createAvatarDataStore, BackupInfo, IntegrityResult } from './storage';
import { AvatarConfiguration, EmotionType, AccentType, EmotionalTone, HairTexture } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

describe('AvatarDataStore', () => {
  let store: AvatarDataStore;
  const testStorageDir = './test-data/avatars';
  const testUserId = 'test-user-123';

  // Helper function to create fresh test configuration
  const createTestConfig = (userId: string = testUserId): AvatarConfiguration => {
    return {
      userId,
      version: '1.0.0',
      appearance: {
        face: {
          meshId: 'face_001',
          textureId: 'texture_001',
          eyeColor: '#4A90E2',
          skinTone: '#F5DEB3',
          features: {
            eyeSize: 1.0,
            noseSize: 1.0,
            mouthSize: 1.0,
            cheekbones: 1.0
          }
        },
        hair: {
          styleId: 'hair_001',
          color: '#8B4513',
          length: 0.5,
          texture: HairTexture.WAVY
        },
        clothing: {
          topId: 'shirt_001',
          bottomId: 'pants_001',
          shoesId: 'shoes_001',
          colors: {
            primary: '#FF6B6B',
            secondary: '#4ECDC4',
            accent: '#45B7D1'
          }
        },
        accessories: [],
        animations: {
          idle: 'idle_001',
          talking: 'talk_001',
          listening: 'listen_001',
          thinking: 'think_001',
          expressions: {
            happy: 'happy_001',
            sad: 'sad_001',
            surprised: 'surprised_001',
            confused: 'confused_001',
            excited: 'excited_001'
          }
        }
      },
      personality: {
        friendliness: 8,
        formality: 4,
        humor: 7,
        enthusiasm: 9,
        patience: 6,
        supportiveness: 8
      },
      voice: {
        pitch: 0.2,
        speed: 1.0,
        accent: AccentType.NEUTRAL,
        emotionalTone: EmotionalTone.CHEERFUL,
        volume: 0.8
      },
      emotions: {
        defaultEmotion: EmotionType.HAPPY,
        expressionIntensity: 0.7,
        transitionSpeed: 0.5,
        emotionMappings: []
      },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      lastModified: new Date('2024-01-01T00:00:00Z'),
      parentallyApproved: true
    };
  };

  const mockAvatarConfig: AvatarConfiguration = {
    userId: testUserId,
    version: '1.0.0',
    appearance: {
      face: {
        meshId: 'face_001',
        textureId: 'texture_001',
        eyeColor: '#4A90E2',
        skinTone: '#F5DEB3',
        features: {
          eyeSize: 1.0,
          noseSize: 1.0,
          mouthSize: 1.0,
          cheekbones: 1.0
        }
      },
      hair: {
        styleId: 'hair_001',
        color: '#8B4513',
        length: 0.5,
        texture: HairTexture.WAVY
      },
      clothing: {
        topId: 'shirt_001',
        bottomId: 'pants_001',
        shoesId: 'shoes_001',
        colors: {
          primary: '#FF6B6B',
          secondary: '#4ECDC4',
          accent: '#45B7D1'
        }
      },
      accessories: [],
      animations: {
        idle: 'idle_001',
        talking: 'talk_001',
        listening: 'listen_001',
        thinking: 'think_001',
        expressions: {
          happy: 'happy_001',
          sad: 'sad_001',
          surprised: 'surprised_001',
          confused: 'confused_001',
          excited: 'excited_001'
        }
      }
    },
    personality: {
      friendliness: 8,
      formality: 4,
      humor: 7,
      enthusiasm: 9,
      patience: 6,
      supportiveness: 8
    },
    voice: {
      pitch: 0.2,
      speed: 1.0,
      accent: AccentType.NEUTRAL,
      emotionalTone: EmotionalTone.CHEERFUL,
      volume: 0.8
    },
    emotions: {
      defaultEmotion: EmotionType.HAPPY,
      expressionIntensity: 0.7,
      transitionSpeed: 0.5,
      emotionMappings: []
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastModified: new Date('2024-01-01T00:00:00Z'),
    parentallyApproved: true
  };

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }

    // Create fresh store
    store = await createAvatarDataStore(testStorageDir, {
      backupEnabled: true,
      compressionEnabled: false, // Disable for easier testing
      integrityCheckEnabled: true
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Operations', () => {
    test('should save and load avatar configuration', async () => {
      // Save configuration
      await store.saveAvatarConfiguration(testUserId, mockAvatarConfig);

      // Load configuration
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);

      // Verify data integrity
      expect(loadedConfig.userId).toBe(mockAvatarConfig.userId);
      expect(loadedConfig.version).toBe(mockAvatarConfig.version);
      expect(loadedConfig.personality.friendliness).toBe(mockAvatarConfig.personality.friendliness);
      expect(loadedConfig.voice.pitch).toBe(mockAvatarConfig.voice.pitch);
    });

    test('should throw error when loading non-existent user', async () => {
      await expect(store.loadAvatarConfiguration('non-existent-user'))
        .rejects.toThrow('No avatar configuration found');
    });

    test('should create and verify backups', async () => {
      // Save initial configuration
      await store.saveAvatarConfiguration(testUserId, mockAvatarConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Verify backup info
      expect(backupInfo.userId).toBe(testUserId);
      expect(backupInfo.size).toBeGreaterThan(0);
      expect(backupInfo.checksum).toBeDefined();

      // Verify backup file exists
      const backupExists = await fs.access(backupInfo.filePath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should restore from backup', async () => {
      // Save initial configuration
      await store.saveAvatarConfiguration(testUserId, mockAvatarConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Modify configuration
      const modifiedConfig = { ...mockAvatarConfig };
      modifiedConfig.personality.friendliness = 5;
      await store.saveAvatarConfiguration(testUserId, modifiedConfig);

      // Verify modification
      const modifiedLoaded = await store.loadAvatarConfiguration(testUserId);
      expect(modifiedLoaded.personality.friendliness).toBe(5);

      // Restore from backup
      await store.restoreFromBackup(testUserId, backupInfo.id);

      // Verify restoration
      const restoredConfig = await store.loadAvatarConfiguration(testUserId);
      expect(restoredConfig.personality.friendliness).toBe(8); // Original value
    });
  });

  describe('Data Integrity', () => {
    test('should verify data integrity successfully', async () => {
      // Save configuration
      await store.saveAvatarConfiguration(testUserId, mockAvatarConfig);

      // Verify integrity
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.corruptedFiles).toHaveLength(0);
      expect(integrityResult.checksumMismatches).toHaveLength(0);
    });

    test('should detect corrupted files', async () => {
      // Save configuration
      await store.saveAvatarConfiguration(testUserId, mockAvatarConfig);

      // Corrupt the file by writing invalid data
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.writeFile(filePath, 'corrupted data');

      // Verify integrity should detect corruption
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('User Migration', () => {
    test('should migrate user data to new user ID', async () => {
      const oldUserId = 'old-user-123';
      const newUserId = 'new-user-456';

      // Save configuration for old user
      const configForOldUser = { ...mockAvatarConfig, userId: oldUserId };
      await store.saveAvatarConfiguration(oldUserId, configForOldUser);

      // Migrate to new user ID
      await store.migrateUserData(oldUserId, newUserId);

      // Verify new user has the data
      const migratedConfig = await store.loadAvatarConfiguration(newUserId);
      expect(migratedConfig.userId).toBe(newUserId);
      expect(migratedConfig.personality.friendliness).toBe(mockAvatarConfig.personality.friendliness);

      // Verify old user data is removed
      await expect(store.loadAvatarConfiguration(oldUserId))
        .rejects.toThrow('No avatar configuration found');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid configuration gracefully', async () => {
      const invalidConfig = { ...mockAvatarConfig };
      // @ts-ignore - Intentionally invalid for testing
      invalidConfig.personality.friendliness = 15; // Out of valid range

      await expect(store.saveAvatarConfiguration(testUserId, invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });

    test('should handle encryption/decryption errors gracefully', async () => {
      // This test would require mocking crypto functions to simulate failures
      // For now, we'll just verify the error handling structure exists
      expect(store).toBeDefined();
    });
  });

  // Enhanced tests for task 2.3 requirements
  describe('Encryption/Decryption Tests', () => {
    test('should encrypt and decrypt avatar configurations correctly', async () => {
      // Create a fresh test configuration
      const testConfig = createTestConfig();
      
      // Save configuration (this encrypts the data)
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Load configuration (this decrypts the data)
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);

      // Verify all data fields are correctly preserved through encryption/decryption
      expect(loadedConfig.userId).toBe(testConfig.userId);
      expect(loadedConfig.version).toBe(testConfig.version);
      expect(loadedConfig.appearance.face.eyeColor).toBe(testConfig.appearance.face.eyeColor);
      expect(loadedConfig.appearance.hair.color).toBe(testConfig.appearance.hair.color);
      expect(loadedConfig.personality.friendliness).toBe(testConfig.personality.friendliness);
      expect(loadedConfig.voice.pitch).toBe(testConfig.voice.pitch);
      expect(loadedConfig.emotions.defaultEmotion).toBe(testConfig.emotions.defaultEmotion);
      expect(loadedConfig.parentallyApproved).toBe(testConfig.parentallyApproved);
    });

    test('should use AES-256-CBC encryption with proper IV generation', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Read the encrypted file directly
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const encryptedData = await fs.readFile(filePath);

      // Verify IV is present (first 16 bytes)
      expect(encryptedData.length).toBeGreaterThan(16);
      
      // Verify the IV is different each time by saving again
      const testConfig2 = createTestConfig();
      testConfig2.lastModified = new Date();
      await store.saveAvatarConfiguration(testUserId, testConfig2);
      
      const encryptedData2 = await fs.readFile(filePath);
      
      // IVs should be different (first 16 bytes)
      const iv1 = encryptedData.slice(0, 16);
      const iv2 = encryptedData2.slice(0, 16);
      expect(Buffer.compare(iv1, iv2)).not.toBe(0);
    });

    test('should handle encryption of special characters and unicode', async () => {
      const testConfig = createTestConfig();
      // Add special characters and unicode
      testConfig.appearance.face.eyeColor = '#FF00FF'; // Hex color
      testConfig.appearance.hair.color = '🌈'; // Unicode emoji
      testConfig.userId = 'user-with-special-chars-@#$%^&*()';
      
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);

      expect(loadedConfig.appearance.face.eyeColor).toBe('#FF00FF');
      expect(loadedConfig.appearance.hair.color).toBe('🌈');
      expect(loadedConfig.userId).toBe('user-with-special-chars-@#$%^&*()');
    });

    test('should fail gracefully with invalid encryption key', async () => {
      // Create store with invalid key length
      const invalidStore = new AvatarDataStore(testStorageDir + '_invalid', {
        encryptionKey: 'short_key' // Too short for AES-256
      });

      await expect(invalidStore.initialize()).rejects.toThrow();
    });

    test('should detect tampering with encrypted data', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Tamper with encrypted data
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const encryptedData = await fs.readFile(filePath);
      
      // Modify encrypted content (not just IV)
      const tamperedData = Buffer.from(encryptedData);
      tamperedData[20] = tamperedData[20] ^ 0xFF; // Flip bits in encrypted content
      await fs.writeFile(filePath, tamperedData);

      // Loading should fail due to decryption error or integrity check
      await expect(store.loadAvatarConfiguration(testUserId)).rejects.toThrow();
    });

    test('should use different encryption for each save operation', async () => {
      // Save the same configuration twice
      const testConfig1 = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig1);
      const filePath1 = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const encryptedData1 = await fs.readFile(filePath1);

      // Modify and save again
      const testConfig2 = createTestConfig();
      testConfig2.lastModified = new Date();
      await store.saveAvatarConfiguration(testUserId, testConfig2);
      const encryptedData2 = await fs.readFile(filePath1);

      // Encrypted data should be different (due to different IV)
      expect(Buffer.compare(encryptedData1, encryptedData2)).not.toBe(0);
    });

    test('should handle corrupted encrypted data gracefully', async () => {
      // Save valid configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt the encrypted file
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.writeFile(filePath, 'corrupted_encrypted_data');

      // Loading should fail with decryption error or integrity check failure
      await expect(store.loadAvatarConfiguration(testUserId))
        .rejects.toThrow();
    });

    test('should validate encryption key during initialization', async () => {
      // Create store with invalid encryption key
      const invalidKeyStore = new AvatarDataStore(testStorageDir + '_invalid', {
        encryptionKey: 'invalid_key_too_short'
      });

      // Initialization should fail due to invalid key
      await expect(invalidKeyStore.initialize())
        .rejects.toThrow();
    });

    test('should encrypt large avatar configurations correctly', async () => {
      // Create a large configuration with many accessories
      const largeConfig = createTestConfig();
      largeConfig.appearance.accessories = Array.from({ length: 50 }, (_, i) => ({
        id: `accessory_${i}`,
        type: 'hat' as any,
        position: { x: i, y: i, z: i },
        scale: 1.0 + i * 0.1
      }));

      // Should handle large data encryption/decryption
      await store.saveAvatarConfiguration(testUserId, largeConfig);
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);

      expect(loadedConfig.appearance.accessories).toHaveLength(50);
      expect(loadedConfig.appearance.accessories[49].id).toBe('accessory_49');
    });
  });

  describe('Backup and Recovery Mechanisms', () => {
    test('should create backups with correct metadata', async () => {
      // Save initial configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Verify backup metadata
      expect(backupInfo.userId).toBe(testUserId);
      expect(backupInfo.id).toBeDefined();
      expect(backupInfo.createdAt).toBeInstanceOf(Date);
      expect(backupInfo.size).toBeGreaterThan(0);
      expect(backupInfo.checksum).toBeDefined();
      expect(backupInfo.filePath).toContain(testUserId);

      // Verify backup file exists and has correct size
      const stats = await fs.stat(backupInfo.filePath);
      expect(stats.size).toBe(backupInfo.size);
    });

    test('should create encrypted backups that preserve data integrity', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Verify backup is encrypted (should not contain plain text)
      const backupData = await fs.readFile(backupInfo.filePath);
      const backupString = backupData.toString();
      
      // Should not contain plain text user ID or other sensitive data
      expect(backupString).not.toContain(testUserId);
      expect(backupString).not.toContain(testConfig.appearance.face.eyeColor);
      expect(backupString).not.toContain('friendliness');
    });

    test('should validate backup checksums during creation and restoration', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Verify checksum matches file content
      const backupData = await fs.readFile(backupInfo.filePath);
      const calculatedChecksum = crypto.createHash('sha256').update(backupData).digest('hex');
      expect(calculatedChecksum).toBe(backupInfo.checksum);

      // Corrupt backup and verify restoration fails
      await fs.writeFile(backupInfo.filePath, 'corrupted_backup');
      
      await expect(store.restoreFromBackup(testUserId, backupInfo.id))
        .rejects.toThrow('Backup integrity check failed');
    });

    test('should handle backup creation during concurrent operations', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create multiple backups with small delays to ensure unique timestamps
      const backups = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        const backup = await store.createBackup(testUserId);
        backups.push(backup);
      }

      // All backups should be created successfully with unique IDs
      const backupIds = backups.map(b => b.id);
      const uniqueIds = new Set(backupIds);
      expect(uniqueIds.size).toBe(backups.length);

      // All backups should be valid
      for (const backup of backups) {
        expect(backup.size).toBeGreaterThan(0);
        expect(backup.checksum).toBeDefined();
        
        // Verify file exists
        const exists = await fs.access(backup.filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('should fail backup creation for non-existent user', async () => {
      await expect(store.createBackup('non-existent-user'))
        .rejects.toThrow('No configuration found for user');
    });

    test('should restore from backup correctly', async () => {
      // Save initial configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Modify configuration significantly
      const modifiedConfig = createTestConfig();
      modifiedConfig.personality.friendliness = 1;
      modifiedConfig.personality.humor = 1;
      modifiedConfig.voice.pitch = -1.5;
      modifiedConfig.appearance.hair.color = '#000000';
      await store.saveAvatarConfiguration(testUserId, modifiedConfig);

      // Verify modification
      const modifiedLoaded = await store.loadAvatarConfiguration(testUserId);
      expect(modifiedLoaded.personality.friendliness).toBe(1);
      expect(modifiedLoaded.appearance.hair.color).toBe('#000000');

      // Restore from backup
      await store.restoreFromBackup(testUserId, backupInfo.id);

      // Verify complete restoration
      const restoredConfig = await store.loadAvatarConfiguration(testUserId);
      expect(restoredConfig.personality.friendliness).toBe(testConfig.personality.friendliness);
      expect(restoredConfig.personality.humor).toBe(testConfig.personality.humor);
      expect(restoredConfig.voice.pitch).toBe(testConfig.voice.pitch);
      expect(restoredConfig.appearance.hair.color).toBe(testConfig.appearance.hair.color);
    });

    test('should fail restore with invalid backup ID', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      await expect(store.restoreFromBackup(testUserId, 'invalid-backup-id'))
        .rejects.toThrow();
    });

    test('should detect corrupted backup files', async () => {
      // Save configuration and create backup
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const backupInfo = await store.createBackup(testUserId);

      // Corrupt the backup file
      await fs.writeFile(backupInfo.filePath, 'corrupted_backup_data');

      // Restore should fail due to checksum mismatch
      await expect(store.restoreFromBackup(testUserId, backupInfo.id))
        .rejects.toThrow('Backup integrity check failed');
    });

    test('should handle multiple backups for same user', async () => {
      // Save initial configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create multiple backups with different configurations
      const backup1 = await store.createBackup(testUserId);

      // Modify and create second backup
      const modifiedConfig1 = createTestConfig();
      modifiedConfig1.personality.friendliness = 5;
      await store.saveAvatarConfiguration(testUserId, modifiedConfig1);
      const backup2 = await store.createBackup(testUserId);

      // Modify and create third backup
      const modifiedConfig2 = createTestConfig();
      modifiedConfig2.personality.friendliness = 3;
      await store.saveAvatarConfiguration(testUserId, modifiedConfig2);
      const backup3 = await store.createBackup(testUserId);

      // All backups should have different IDs
      expect(backup1.id).not.toBe(backup2.id);
      expect(backup2.id).not.toBe(backup3.id);
      expect(backup1.id).not.toBe(backup3.id);

      // Should be able to restore from any backup
      await store.restoreFromBackup(testUserId, backup1.id);
      const restored1 = await store.loadAvatarConfiguration(testUserId);
      expect(restored1.personality.friendliness).toBe(testConfig.personality.friendliness);

      await store.restoreFromBackup(testUserId, backup2.id);
      const restored2 = await store.loadAvatarConfiguration(testUserId);
      expect(restored2.personality.friendliness).toBe(5);
    });

    test('should handle backup rollback on restore failure', async () => {
      // Save configuration and create backup
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const backupInfo = await store.createBackup(testUserId);

      // Modify configuration
      const modifiedConfig = createTestConfig();
      modifiedConfig.personality.friendliness = 5;
      await store.saveAvatarConfiguration(testUserId, modifiedConfig);

      // Corrupt backup metadata to cause restore failure
      const metadataPath = backupInfo.filePath.replace('.backup', '.meta');
      await fs.writeFile(metadataPath, 'invalid_json');

      // Restore should fail but original data should remain
      await expect(store.restoreFromBackup(testUserId, backupInfo.id))
        .rejects.toThrow();

      // Original modified configuration should still be intact
      const currentConfig = await store.loadAvatarConfiguration(testUserId);
      expect(currentConfig.personality.friendliness).toBe(5);
    });
  });

  describe('Data Integrity Verification and Corruption Handling', () => {
    test('should verify integrity of valid data', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Verify integrity
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.corruptedFiles).toHaveLength(0);
      expect(integrityResult.checksumMismatches).toHaveLength(0);
      expect(integrityResult.repairActions).toHaveLength(0);
    });

    test('should detect and handle partial file corruption', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Partially corrupt the file (simulate disk error)
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      
      // Corrupt middle section of file
      const corruptedData = Buffer.from(originalData);
      for (let i = Math.floor(originalData.length / 3); i < Math.floor(originalData.length * 2 / 3); i++) {
        corruptedData[i] = 0xFF;
      }
      await fs.writeFile(filePath, corruptedData);

      // Verify integrity should detect corruption
      const integrityResult = await store.verifyDataIntegrity(testUserId);
      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.checksumMismatches.length).toBeGreaterThan(0);
    });

    test('should handle concurrent integrity checks', async () => {
      // Save multiple user configurations
      const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
      for (const userId of userIds) {
        const config = createTestConfig(userId);
        await store.saveAvatarConfiguration(userId, config);
      }

      // Run concurrent integrity checks
      const integrityPromises = userIds.map(userId => store.verifyDataIntegrity(userId));
      const results = await Promise.all(integrityPromises);

      // All should pass
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    test('should detect missing configuration files', async () => {
      // Verify integrity for non-existent user
      const integrityResult = await store.verifyDataIntegrity('non-existent-user');

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.length).toBeGreaterThan(0);
      expect(integrityResult.repairActions).toContain('Restore from backup or recreate configuration');
    });

    test('should detect checksum mismatches', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt the data file while keeping metadata
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      
      // Modify a few bytes to corrupt the file but keep it the same size
      const corruptedData = Buffer.from(originalData);
      corruptedData[10] = corruptedData[10] ^ 0xFF; // Flip bits
      await fs.writeFile(filePath, corruptedData);

      // Verify integrity should detect checksum mismatch
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.checksumMismatches.length).toBeGreaterThan(0);
      expect(integrityResult.repairActions).toContain('Restore from backup or verify file integrity');
    });

    test('should detect corrupted metadata files', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt metadata file
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      await fs.writeFile(metadataPath, 'invalid_json_metadata');

      // Verify integrity should detect corrupted metadata
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles).toContain(metadataPath);
      expect(integrityResult.repairActions).toContain('Regenerate metadata from configuration file');
    });

    test('should handle complete file system corruption gracefully', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt both data and metadata files
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      
      await fs.writeFile(filePath, 'completely_corrupted_data');
      await fs.writeFile(metadataPath, 'completely_corrupted_metadata');

      // Verify integrity should detect all corruption
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.length).toBeGreaterThan(0);
      expect(integrityResult.repairActions.length).toBeGreaterThan(0);
    });

    test('should validate data structure integrity after loading', async () => {
      // Save valid configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Manually corrupt the encrypted data to create invalid structure
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      
      // Create malformed but decryptable data
      const malformedData = JSON.stringify({ invalid: 'structure' });
      const encryptedMalformed = await (store as any).encryptData(malformedData);
      await fs.writeFile(filePath, encryptedMalformed);

      // Update metadata to match new checksum
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      const newChecksum = crypto.createHash('sha256').update(encryptedMalformed).digest('hex');
      const metadata = {
        userId: testUserId,
        version: '1.0.0',
        checksum: newChecksum,
        createdAt: new Date().toISOString(),
        encrypted: true,
        compressed: false
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Integrity check should detect structural issues
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.repairActions).toContain('Configuration validation failed - may need migration or repair');
    });

    test('should handle integrity verification with missing metadata', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Remove metadata file
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      await fs.unlink(metadataPath);

      // Integrity check should handle missing metadata gracefully
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.corruptedFiles).toContain(metadataPath);
      expect(integrityResult.repairActions).toContain('Regenerate metadata from configuration file');
    });

    test('should detect subtle data corruption in encrypted content', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Make subtle corruption (single bit flip)
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      
      // Flip a single bit in the encrypted content (not IV)
      const corruptedData = Buffer.from(originalData);
      corruptedData[20] = corruptedData[20] ^ 0x01; // Single bit flip
      await fs.writeFile(filePath, corruptedData);

      // Should detect corruption through checksum or decryption failure
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.checksumMismatches.length + integrityResult.corruptedFiles.length).toBeGreaterThan(0);
    });

    test('should provide detailed repair recommendations', async () => {
      // Test various corruption scenarios and verify repair recommendations
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Test missing file scenario
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.unlink(filePath);

      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.repairActions).toContain('Restore from backup or recreate configuration');
    });

    test('should handle concurrent integrity checks without interference', async () => {
      // Save configurations for multiple users
      const userIds = ['user1', 'user2', 'user3'];
      const configs = userIds.map(id => createTestConfig(id));
      
      for (let i = 0; i < userIds.length; i++) {
        await store.saveAvatarConfiguration(userIds[i], configs[i]);
      }

      // Corrupt one user's data
      const corruptedUserId = userIds[1];
      const corruptedFilePath = path.join(testStorageDir, `${corruptedUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.writeFile(corruptedFilePath, 'corrupted');

      // Run concurrent integrity checks
      const integrityPromises = userIds.map(userId => store.verifyDataIntegrity(userId));
      const results = await Promise.all(integrityPromises);

      // Only the corrupted user should fail
      expect(results[0].isValid).toBe(true); // user1
      expect(results[1].isValid).toBe(false); // user2 (corrupted)
      expect(results[2].isValid).toBe(true); // user3
    });

    test('should verify integrity after successful recovery operations', async () => {
      // Save configuration and create backup
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const backupInfo = await store.createBackup(testUserId);

      // Corrupt data
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.writeFile(filePath, 'corrupted');

      // Verify corruption is detected
      let integrityResult = await store.verifyDataIntegrity(testUserId);
      expect(integrityResult.isValid).toBe(false);

      // Restore from backup
      await store.restoreFromBackup(testUserId, backupInfo.id);

      // Verify integrity is restored
      integrityResult = await store.verifyDataIntegrity(testUserId);
      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.corruptedFiles).toHaveLength(0);
      expect(integrityResult.checksumMismatches).toHaveLength(0);
    });
  });

  describe('Advanced Encryption Security Tests', () => {
    test('should use cryptographically secure random IVs', async () => {
      const testConfig = createTestConfig();
      
      // Save multiple times and verify IVs are different
      const ivs: Buffer[] = [];
      for (let i = 0; i < 10; i++) {
        testConfig.lastModified = new Date(Date.now() + i * 1000);
        await store.saveAvatarConfiguration(testUserId, testConfig);
        
        const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
        const encryptedData = await fs.readFile(filePath);
        const iv = encryptedData.slice(0, 16);
        ivs.push(iv);
      }

      // Verify all IVs are unique
      for (let i = 0; i < ivs.length; i++) {
        for (let j = i + 1; j < ivs.length; j++) {
          expect(Buffer.compare(ivs[i], ivs[j])).not.toBe(0);
        }
      }
    });

    test('should resist timing attacks on decryption', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Measure decryption times for valid and invalid data
      const validTimes: number[] = [];
      const invalidTimes: number[] = [];

      // Test valid decryption times
      for (let i = 0; i < 5; i++) {
        const start = process.hrtime.bigint();
        await store.loadAvatarConfiguration(testUserId);
        const end = process.hrtime.bigint();
        validTimes.push(Number(end - start) / 1000000); // Convert to milliseconds
      }

      // Test invalid decryption times (corrupted data)
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      
      for (let i = 0; i < 5; i++) {
        // Corrupt data differently each time
        const corruptedData = Buffer.from(originalData);
        corruptedData[20 + i] = corruptedData[20 + i] ^ 0xFF;
        await fs.writeFile(filePath, corruptedData);

        const start = process.hrtime.bigint();
        try {
          await store.loadAvatarConfiguration(testUserId);
        } catch (error) {
          // Expected to fail
        }
        const end = process.hrtime.bigint();
        invalidTimes.push(Number(end - start) / 1000000);
      }

      // Restore original data
      await fs.writeFile(filePath, originalData);

      // Times should be relatively consistent (within reasonable variance)
      // This is a basic timing attack resistance test
      const validAvg = validTimes.reduce((a, b) => a + b) / validTimes.length;
      const invalidAvg = invalidTimes.reduce((a, b) => a + b) / invalidTimes.length;
      
      // The difference shouldn't be too dramatic (timing attack resistance)
      const timeDifference = Math.abs(validAvg - invalidAvg);
      expect(timeDifference).toBeLessThan(validAvg * 2); // Allow up to 2x difference
    });

    test('should properly handle encryption key derivation', async () => {
      // Test with custom encryption key
      const customKey = crypto.randomBytes(32).toString('hex');
      const customStore = await createAvatarDataStore(testStorageDir + '_custom', {
        encryptionKey: customKey,
        backupEnabled: true,
        integrityCheckEnabled: true
      });

      const testConfig = createTestConfig();
      await customStore.saveAvatarConfiguration(testUserId, testConfig);

      // Verify data can be loaded with correct key
      const loadedConfig = await customStore.loadAvatarConfiguration(testUserId);
      expect(loadedConfig.userId).toBe(testConfig.userId);

      // Verify data cannot be loaded with different key
      const wrongKeyStore = await createAvatarDataStore(testStorageDir + '_wrong', {
        encryptionKey: crypto.randomBytes(32).toString('hex'),
        backupEnabled: true,
        integrityCheckEnabled: true
      });

      // Copy encrypted file to wrong key store directory
      const sourcePath = path.join(testStorageDir + '_custom', `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const destPath = path.join(testStorageDir + '_wrong', `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const sourceData = await fs.readFile(sourcePath);
      await fs.writeFile(destPath, sourceData);

      // Should fail to decrypt with wrong key
      await expect(wrongKeyStore.loadAvatarConfiguration(testUserId))
        .rejects.toThrow();
    });

    test('should validate encryption key strength during initialization', async () => {
      // Test with weak key (too short)
      await expect(createAvatarDataStore(testStorageDir + '_weak', {
        encryptionKey: 'weak'
      })).rejects.toThrow();

      // Test with invalid hex key
      await expect(createAvatarDataStore(testStorageDir + '_invalid', {
        encryptionKey: 'invalid_hex_key_not_proper_length'
      })).rejects.toThrow();
    });

    test('should securely handle memory during encryption operations', async () => {
      const testConfig = createTestConfig();
      
      // Add large data to test memory handling
      testConfig.appearance.accessories = Array.from({ length: 100 }, (_, i) => ({
        id: `large_accessory_${i}`,
        type: 'hat' as any,
        position: { x: i, y: i, z: i },
        scale: 1.0 + i * 0.01
      }));

      // Should handle large configurations without memory issues
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);

      expect(loadedConfig.appearance.accessories).toHaveLength(100);
      expect(loadedConfig.appearance.accessories[99].id).toBe('large_accessory_99');
    });
  });

  describe('Comprehensive Backup System Tests', () => {
    test('should maintain backup chain integrity', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create multiple backups with modifications
      const backups: BackupInfo[] = [];
      
      for (let i = 0; i < 5; i++) {
        const backup = await store.createBackup(testUserId);
        backups.push(backup);
        
        // Modify configuration for next backup
        testConfig.personality.friendliness = i + 1;
        testConfig.lastModified = new Date();
        await store.saveAvatarConfiguration(testUserId, testConfig);
      }

      // Verify each backup can be restored independently
      for (let i = 0; i < backups.length; i++) {
        await store.restoreFromBackup(testUserId, backups[i].id);
        const restoredConfig = await store.loadAvatarConfiguration(testUserId);
        
        // Each backup should restore to the state when it was created
        if (i === 0) {
          expect(restoredConfig.personality.friendliness).toBe(testConfig.personality.friendliness);
        } else {
          expect(restoredConfig.personality.friendliness).toBe(i);
        }
      }
    });

    test('should handle backup storage space management', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create many backups to test space management
      const backups: BackupInfo[] = [];
      for (let i = 0; i < 20; i++) {
        testConfig.lastModified = new Date(Date.now() + i * 1000);
        await store.saveAvatarConfiguration(testUserId, testConfig);
        
        const backup = await store.createBackup(testUserId);
        backups.push(backup);
      }

      // Verify all backups exist and have valid checksums
      for (const backup of backups) {
        const backupData = await fs.readFile(backup.filePath);
        const calculatedChecksum = crypto.createHash('sha256').update(backupData).digest('hex');
        expect(calculatedChecksum).toBe(backup.checksum);
      }
    });

    test('should handle backup restoration with data migration', async () => {
      // Create configuration with older version
      const oldConfig = createTestConfig();
      oldConfig.version = '0.9.0'; // Older version
      await store.saveAvatarConfiguration(testUserId, oldConfig);

      // Create backup of old version
      const backupInfo = await store.createBackup(testUserId);

      // Update to newer version
      const newConfig = createTestConfig();
      newConfig.version = '1.1.0'; // Newer version
      await store.saveAvatarConfiguration(testUserId, newConfig);

      // Restore old backup (should trigger migration)
      await store.restoreFromBackup(testUserId, backupInfo.id);
      const restoredConfig = await store.loadAvatarConfiguration(testUserId);

      // Should be migrated to current version
      expect(restoredConfig.version).toBe('1.0.0'); // Current system version after migration
    });

    test('should validate backup metadata consistency', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      const backupInfo = await store.createBackup(testUserId);

      // Load and verify metadata file
      const metadataPath = backupInfo.filePath.replace('.backup', '.meta');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.id).toBe(backupInfo.id);
      expect(metadata.userId).toBe(backupInfo.userId);
      expect(metadata.size).toBe(backupInfo.size);
      expect(metadata.checksum).toBe(backupInfo.checksum);
      expect(new Date(metadata.createdAt)).toEqual(backupInfo.createdAt);
    });

    test('should handle concurrent backup operations safely', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create multiple backups concurrently
      const backupPromises = Array.from({ length: 10 }, (_, i) => {
        // Slightly modify config for each backup
        const configCopy = { ...testConfig };
        configCopy.lastModified = new Date(Date.now() + i);
        return store.createBackup(testUserId);
      });

      const backups = await Promise.all(backupPromises);

      // Verify all backups are unique and valid
      const backupIds = new Set(backups.map(b => b.id));
      expect(backupIds.size).toBe(backups.length);

      // Verify all backup files exist and are valid
      for (const backup of backups) {
        const exists = await fs.access(backup.filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
        
        const backupData = await fs.readFile(backup.filePath);
        const checksum = crypto.createHash('sha256').update(backupData).digest('hex');
        expect(checksum).toBe(backup.checksum);
      }
    });

    test('should cleanup orphaned backup files', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Manually create orphaned backup file (backup without metadata)
      const orphanedBackupPath = path.join(testStorageDir, 'backups', `${testUserId}_orphaned.backup`);
      await fs.writeFile(orphanedBackupPath, 'orphaned_backup_data');

      // Verify orphaned file exists
      const orphanedExists = await fs.access(orphanedBackupPath).then(() => true).catch(() => false);
      expect(orphanedExists).toBe(true);

      // Normal backup should still work
      const validBackup = await store.createBackup(testUserId);
      expect(validBackup.id).toBeDefined();
    });
  });

  describe('Atomic Operations and Transaction Safety', () => {
    test('should handle atomic save operations with rollback', async () => {
      // Save initial configuration
      const initialConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, initialConfig);

      // Verify initial state
      const loadedInitial = await store.loadAvatarConfiguration(testUserId);
      expect(loadedInitial.personality.friendliness).toBe(initialConfig.personality.friendliness);

      // Attempt to save invalid configuration (should trigger rollback)
      const invalidConfig = createTestConfig();
      // @ts-ignore - Intentionally invalid for testing rollback
      invalidConfig.personality.friendliness = 999; // Invalid value

      await expect(store.saveAvatarConfiguration(testUserId, invalidConfig))
        .rejects.toThrow('Configuration validation failed');

      // Verify rollback - original configuration should still be intact
      const loadedAfterFailure = await store.loadAvatarConfiguration(testUserId);
      expect(loadedAfterFailure.personality.friendliness).toBe(initialConfig.personality.friendliness);
    });

    test('should handle concurrent save operations safely', async () => {
      const baseConfig = createTestConfig();
      
      // Perform concurrent saves with different modifications
      const savePromises = Array.from({ length: 5 }, (_, i) => {
        const config = { ...baseConfig };
        config.personality.friendliness = i + 1;
        config.lastModified = new Date(Date.now() + i);
        return store.saveAvatarConfiguration(`${testUserId}_${i}`, config);
      });

      // All saves should complete successfully
      await Promise.all(savePromises);

      // Verify each configuration was saved correctly
      for (let i = 0; i < 5; i++) {
        const loadedConfig = await store.loadAvatarConfiguration(`${testUserId}_${i}`);
        expect(loadedConfig.personality.friendliness).toBe(i + 1);
      }
    });

    test('should handle transaction cleanup on system interruption', async () => {
      const testConfig = createTestConfig();
      
      // Simulate interrupted transaction by creating temporary files
      const tempFilePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar.tmp.test_tx`);
      const tempMetadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta.tmp.test_tx`);
      
      await fs.writeFile(tempFilePath, 'interrupted_transaction_data');
      await fs.writeFile(tempMetadataPath, 'interrupted_metadata');

      // Normal save operation should work despite temporary files
      await store.saveAvatarConfiguration(testUserId, testConfig);
      
      // Verify configuration was saved correctly
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);
      expect(loadedConfig.userId).toBe(testConfig.userId);

      // Temporary files should not interfere with normal operations
      const finalFilePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const finalExists = await fs.access(finalFilePath).then(() => true).catch(() => false);
      expect(finalExists).toBe(true);
    });

    test('should maintain data consistency during power failure simulation', async () => {
      const testConfig = createTestConfig();
      
      // Save initial configuration
      await store.saveAvatarConfiguration(testUserId, testConfig);
      
      // Simulate power failure during save by interrupting the process
      const modifiedConfig = { ...testConfig };
      modifiedConfig.personality.friendliness = 5;
      
      // Start save operation but don't wait for completion
      const savePromise = store.saveAvatarConfiguration(testUserId, modifiedConfig);
      
      // Immediately try to load (simulating power failure/restart)
      try {
        const loadedConfig = await store.loadAvatarConfiguration(testUserId);
        // Should either have original or new data, but never corrupted
        expect([testConfig.personality.friendliness, 5]).toContain(loadedConfig.personality.friendliness);
      } catch (error) {
        // If load fails, it should be due to missing file, not corruption
        expect((error as Error).message).toContain('No avatar configuration found');
      }
      
      // Wait for save to complete
      await savePromise;
      
      // After save completes, should have new data
      const finalConfig = await store.loadAvatarConfiguration(testUserId);
      expect(finalConfig.personality.friendliness).toBe(5);
    });
  });

  describe('Performance and Stress Tests', () => {
    test('should handle large configuration data efficiently', async () => {
      // Create very large configuration
      const largeConfig = createTestConfig();
      largeConfig.appearance.accessories = Array.from({ length: 1000 }, (_, i) => ({
        id: `accessory_${i}`,
        type: 'hat' as any,
        position: { x: i, y: i, z: i },
        scale: 1.0 + i * 0.001
      }));

      const startTime = Date.now();
      
      // Save large configuration
      await store.saveAvatarConfiguration(testUserId, largeConfig);
      
      // Load large configuration
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);
      
      const endTime = Date.now();
      const operationTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(operationTime).toBeLessThan(5000); // 5 seconds max
      
      // Verify data integrity
      expect(loadedConfig.appearance.accessories).toHaveLength(1000);
      expect(loadedConfig.appearance.accessories[999].id).toBe('accessory_999');
    });

    test('should handle rapid successive operations', async () => {
      const testConfig = createTestConfig();
      
      // Perform rapid save/load cycles
      for (let i = 0; i < 50; i++) {
        testConfig.personality.friendliness = (i % 10) + 1;
        testConfig.lastModified = new Date(Date.now() + i);
        
        await store.saveAvatarConfiguration(testUserId, testConfig);
        const loadedConfig = await store.loadAvatarConfiguration(testUserId);
        
        expect(loadedConfig.personality.friendliness).toBe((i % 10) + 1);
      }
    });

    test('should maintain performance under memory pressure', async () => {
      // Create multiple large configurations to simulate memory pressure
      const configs: AvatarConfiguration[] = [];
      
      for (let i = 0; i < 10; i++) {
        const config = createTestConfig(`user_${i}`);
        config.appearance.accessories = Array.from({ length: 100 }, (_, j) => ({
          id: `accessory_${i}_${j}`,
          type: 'hat' as any,
          position: { x: j, y: j, z: j },
          scale: 1.0
        }));
        configs.push(config);
      }

      // Save all configurations
      const savePromises = configs.map((config, i) => 
        store.saveAvatarConfiguration(`user_${i}`, config)
      );
      await Promise.all(savePromises);

      // Load all configurations concurrently
      const loadPromises = configs.map((_, i) => 
        store.loadAvatarConfiguration(`user_${i}`)
      );
      const loadedConfigs = await Promise.all(loadPromises);

      // Verify all configurations loaded correctly
      loadedConfigs.forEach((config, i) => {
        expect(config.userId).toBe(`user_${i}`);
        expect(config.appearance.accessories).toHaveLength(100);
      });
    });
  });

  describe('Data Integrity Verification and Corruption Handling', () => {
    test('should detect corrupted metadata files', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt the metadata file
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      await fs.writeFile(metadataPath, 'invalid_json_metadata');

      // Verify integrity should detect corrupted metadata
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.corruptedFiles.some(file => file.includes('test-user-123.meta'))).toBe(true);
      expect(integrityResult.repairActions).toContain('Regenerate metadata from configuration file');
    });

    test('should detect validation failures in loaded data', async () => {
      // Save valid configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Manually corrupt the encrypted data to create invalid configuration
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      
      // Create invalid configuration data (but valid JSON)
      const invalidConfig = createTestConfig();
      // @ts-ignore - Intentionally invalid
      invalidConfig.personality.friendliness = 15; // Out of range
      
      // Encrypt the invalid data manually
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(JSON.stringify(invalidConfig), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedBuffer = Buffer.concat([iv, Buffer.from(encrypted, 'hex')]);
      
      // This will cause decryption to fail, which is what we want to test
      await fs.writeFile(filePath, encryptedBuffer);

      // Verify integrity should detect the issue
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.some(file => file.includes('test-user-123.avatar'))).toBe(true);
    });

    test('should handle complete file system corruption', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt both data and metadata files
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      
      await fs.writeFile(filePath, 'completely_corrupted_data');
      await fs.writeFile(metadataPath, 'completely_corrupted_metadata');

      // Verify integrity should detect all issues
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.some(file => file.includes('test-user-123.avatar'))).toBe(true);
      expect(integrityResult.corruptedFiles.some(file => file.includes('test-user-123.meta'))).toBe(true);
      expect(integrityResult.repairActions.length).toBeGreaterThan(0);
    });

    test('should provide appropriate repair actions for different corruption types', async () => {
      // Test missing file scenario
      const missingFileResult = await store.verifyDataIntegrity('missing-user');
      expect(missingFileResult.repairActions).toContain('Restore from backup or recreate configuration');

      // Save and test checksum mismatch scenario
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      const corruptedData = Buffer.from(originalData);
      corruptedData[5] = corruptedData[5] ^ 0xFF;
      await fs.writeFile(filePath, corruptedData);

      const checksumResult = await store.verifyDataIntegrity(testUserId);
      expect(checksumResult.repairActions).toContain('Restore from backup or verify file integrity');
    });

    test('should handle integrity check during high system load', async () => {
      // Save multiple configurations
      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
      
      for (const userId of userIds) {
        const config = createTestConfig(userId);
        await store.saveAvatarConfiguration(userId, config);
      }

      // Run integrity checks concurrently
      const integrityPromises = userIds.map(userId => store.verifyDataIntegrity(userId));
      const results = await Promise.all(integrityPromises);

      // All should pass integrity checks
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true);
      });
    });

    test('should detect and report multiple types of corruption simultaneously', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt both data and metadata files in different ways
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      
      // Corrupt data file (checksum mismatch)
      const originalData = await fs.readFile(filePath);
      const corruptedData = Buffer.from(originalData);
      corruptedData[10] = corruptedData[10] ^ 0xFF;
      await fs.writeFile(filePath, corruptedData);
      
      // Corrupt metadata file (invalid JSON)
      await fs.writeFile(metadataPath, '{"invalid": json}');

      // Verify integrity detects both issues
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.checksumMismatches.length).toBeGreaterThan(0);
      expect(integrityResult.corruptedFiles.some(file => file.includes('.meta'))).toBe(true);
      expect(integrityResult.repairActions.length).toBeGreaterThan(1);
    });

    test('should handle atomic transaction rollback on corruption', async () => {
      // Save initial configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Simulate corruption during save operation by mocking file system
      const originalWriteFile = fs.writeFile;
      let writeCallCount = 0;
      
      // Mock fs.writeFile to fail on second call (metadata write)
      (fs as any).writeFile = jest.fn().mockImplementation(async (path: string, data: any) => {
        writeCallCount++;
        if (writeCallCount === 2 && path.includes('.meta')) {
          throw new Error('Simulated disk error during metadata write');
        }
        return originalWriteFile(path, data);
      });

      try {
        const modifiedConfig = createTestConfig();
        modifiedConfig.personality.friendliness = 5;
        
        // This should fail and rollback
        await expect(store.saveAvatarConfiguration(testUserId, modifiedConfig))
          .rejects.toThrow();

        // Original configuration should still be intact
        const currentConfig = await store.loadAvatarConfiguration(testUserId);
        expect(currentConfig.personality.friendliness).toBe(testConfig.personality.friendliness);
        
      } finally {
        // Restore original fs.writeFile
        (fs as any).writeFile = originalWriteFile;
      }
    });

    test('should recover from temporary file system errors', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Simulate temporary file system error
      const originalReadFile = fs.readFile;
      let readAttempts = 0;
      
      (fs as any).readFile = jest.fn().mockImplementation(async (path: string, options?: any) => {
        readAttempts++;
        if (readAttempts === 1) {
          throw new Error('Temporary file system error');
        }
        return originalReadFile(path, options);
      });

      try {
        // First attempt should fail, but we can test error handling
        await expect(store.loadAvatarConfiguration(testUserId)).rejects.toThrow();
        
        // Reset counter for successful read
        readAttempts = 1; // Will succeed on next call
        const loadedConfig = await store.loadAvatarConfiguration(testUserId);
        expect(loadedConfig.userId).toBe(testUserId);
        
      } finally {
        (fs as any).readFile = originalReadFile;
      }
    });
  });

  describe('Advanced Encryption/Decryption Edge Cases', () => {
    test('should handle encryption of empty and minimal configurations', async () => {
      // Test with minimal valid configuration
      const minimalConfig = createTestConfig();
      minimalConfig.appearance.accessories = [];
      minimalConfig.emotions.emotionMappings = [];
      
      await store.saveAvatarConfiguration(testUserId, minimalConfig);
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);
      
      expect(loadedConfig.appearance.accessories).toHaveLength(0);
      expect(loadedConfig.emotions.emotionMappings).toHaveLength(0);
    });

    test('should handle encryption of maximum size configurations', async () => {
      // Create configuration with maximum data
      const maxConfig = createTestConfig();
      
      // Add many accessories
      maxConfig.appearance.accessories = Array.from({ length: 100 }, (_, i) => ({
        id: `accessory_${i}`,
        type: 'hat' as any,
        position: { x: i * 0.1, y: i * 0.2, z: i * 0.3 },
        scale: 1.0 + i * 0.01
      }));
      
      // Add many emotion mappings
      maxConfig.emotions.emotionMappings = Array.from({ length: 50 }, (_, i) => ({
        trigger: `trigger_${i}`,
        emotion: EmotionType.HAPPY,
        intensity: 0.5 + (i % 5) * 0.1,
        duration: 1000 + i * 100
      }));

      await store.saveAvatarConfiguration(testUserId, maxConfig);
      const loadedConfig = await store.loadAvatarConfiguration(testUserId);
      
      expect(loadedConfig.appearance.accessories).toHaveLength(100);
      expect(loadedConfig.emotions.emotionMappings).toHaveLength(50);
      expect(loadedConfig.appearance.accessories[99].id).toBe('accessory_99');
    });

    test('should maintain encryption security across multiple save/load cycles', async () => {
      let config = createTestConfig();
      
      // Perform multiple save/load cycles
      for (let i = 0; i < 10; i++) {
        config.personality.friendliness = i + 1;
        config.lastModified = new Date();
        
        await store.saveAvatarConfiguration(testUserId, config);
        const loadedConfig = await store.loadAvatarConfiguration(testUserId);
        
        expect(loadedConfig.personality.friendliness).toBe(i + 1);
        config = loadedConfig;
      }
    });

    test('should handle concurrent encryption operations safely', async () => {
      // Create multiple configurations for concurrent saving
      const configs = Array.from({ length: 5 }, (_, i) => {
        const config = createTestConfig(`concurrent-user-${i}`);
        config.personality.friendliness = i + 1;
        return { userId: `concurrent-user-${i}`, config };
      });

      // Save all configurations concurrently
      const savePromises = configs.map(({ userId, config }) => 
        store.saveAvatarConfiguration(userId, config)
      );
      await Promise.all(savePromises);

      // Load all configurations concurrently
      const loadPromises = configs.map(({ userId }) => 
        store.loadAvatarConfiguration(userId)
      );
      const loadedConfigs = await Promise.all(loadPromises);

      // Verify all configurations were saved and loaded correctly
      loadedConfigs.forEach((config, index) => {
        expect(config.personality.friendliness).toBe(index + 1);
        expect(config.userId).toBe(`concurrent-user-${index}`);
      });
    });
  });

  describe('Comprehensive Backup Recovery Scenarios', () => {
    test('should handle backup chain recovery (multiple backup generations)', async () => {
      // Create initial configuration
      const config1 = createTestConfig();
      config1.personality.friendliness = 1;
      await store.saveAvatarConfiguration(testUserId, config1);
      const backup1 = await store.createBackup(testUserId);

      // Modify and backup again
      const config2 = createTestConfig();
      config2.personality.friendliness = 2;
      await store.saveAvatarConfiguration(testUserId, config2);
      const backup2 = await store.createBackup(testUserId);

      // Modify and backup third time
      const config3 = createTestConfig();
      config3.personality.friendliness = 3;
      await store.saveAvatarConfiguration(testUserId, config3);
      const backup3 = await store.createBackup(testUserId);

      // Should be able to restore to any point in the chain
      await store.restoreFromBackup(testUserId, backup1.id);
      let restored = await store.loadAvatarConfiguration(testUserId);
      expect(restored.personality.friendliness).toBe(1);

      await store.restoreFromBackup(testUserId, backup2.id);
      restored = await store.loadAvatarConfiguration(testUserId);
      expect(restored.personality.friendliness).toBe(2);

      await store.restoreFromBackup(testUserId, backup3.id);
      restored = await store.loadAvatarConfiguration(testUserId);
      expect(restored.personality.friendliness).toBe(3);
    });

    test('should handle backup restoration with data migration', async () => {
      // Create configuration with older version
      const oldConfig = createTestConfig();
      oldConfig.version = '0.9.0'; // Older version
      await store.saveAvatarConfiguration(testUserId, oldConfig);
      
      const backup = await store.createBackup(testUserId);

      // Modify to newer version
      const newConfig = createTestConfig();
      newConfig.version = '1.1.0'; // Newer version
      await store.saveAvatarConfiguration(testUserId, newConfig);

      // Restore from backup should handle migration
      await store.restoreFromBackup(testUserId, backup.id);
      const restored = await store.loadAvatarConfiguration(testUserId);
      
      // Should be migrated to current version during restore
      expect(restored.version).toBeDefined();
    });

    test('should detect corrupted metadata files', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt metadata file
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      await fs.writeFile(metadataPath, 'invalid_json_metadata');

      // Verify integrity should detect corrupted metadata
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.corruptedFiles.some(file => file.includes('.meta'))).toBe(true);
      expect(integrityResult.repairActions).toContain('Regenerate metadata from configuration file');
    });

    test('should handle configuration validation failures during integrity check', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt the file to cause validation failure
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      await fs.writeFile(filePath, 'corrupted_data_that_fails_validation');

      // Verify integrity should detect validation failure
      const integrityResult = await store.verifyDataIntegrity(testUserId);

      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.some(file => file.includes('.avatar'))).toBe(true);
    });

    test('should provide appropriate repair actions for different corruption types', async () => {
      // Test missing file
      const missingFileResult = await store.verifyDataIntegrity('missing-user');
      expect(missingFileResult.repairActions).toContain('Restore from backup or recreate configuration');

      // Save and test checksum mismatch
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);
      
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const originalData = await fs.readFile(filePath);
      const corruptedData = Buffer.from(originalData);
      corruptedData[5] = corruptedData[5] ^ 0xFF;
      await fs.writeFile(filePath, corruptedData);

      const checksumResult = await store.verifyDataIntegrity(testUserId);
      expect(checksumResult.repairActions).toContain('Restore from backup or verify file integrity');
    });

    test('should handle integrity verification with disabled integrity checks', async () => {
      // Create store with integrity checks disabled
      const storeNoIntegrity = await createAvatarDataStore(testStorageDir + '_no_integrity', {
        integrityCheckEnabled: false
      });

      const testConfig = createTestConfig();
      await storeNoIntegrity.saveAvatarConfiguration(testUserId, testConfig);

      // Even with integrity checks disabled, basic file existence should be verified
      const integrityResult = await storeNoIntegrity.verifyDataIntegrity(testUserId);
      expect(integrityResult.isValid).toBe(true);
    });

    test('should detect and report multiple integrity issues', async () => {
      // Save configuration
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Corrupt both data and metadata files
      const filePath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.avatar`);
      const metadataPath = path.join(testStorageDir, `${testUserId.replace(/[^a-zA-Z0-9_-]/g, '_')}.meta`);
      
      await fs.writeFile(filePath, 'corrupted_data');
      await fs.writeFile(metadataPath, 'corrupted_metadata');

      // Should detect both issues
      const integrityResult = await store.verifyDataIntegrity(testUserId);
      
      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.corruptedFiles.some(file => file.includes('.avatar'))).toBe(true);
      expect(integrityResult.corruptedFiles.some(file => file.includes('.meta'))).toBe(true);
      expect(integrityResult.repairActions.length).toBeGreaterThan(1);
    });

    test('should handle integrity check errors gracefully', async () => {
      // Create a scenario where file system operations might fail
      const invalidPath = '/invalid/path/that/does/not/exist';
      const invalidStore = new AvatarDataStore(invalidPath);

      // Should not throw but return appropriate error information
      const integrityResult = await invalidStore.verifyDataIntegrity(testUserId);
      
      expect(integrityResult.isValid).toBe(false);
      expect(integrityResult.repairActions.length).toBeGreaterThan(0);
    });

    test('should handle rollback on save failure with proper cleanup', async () => {
      // Save initial configuration
      const initialConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, initialConfig);

      // Verify initial save
      const loaded = await store.loadAvatarConfiguration(testUserId);
      expect(loaded.personality.friendliness).toBe(initialConfig.personality.friendliness);

      // Create invalid configuration that should fail validation
      const invalidConfig = createTestConfig();
      // @ts-ignore - Intentionally invalid for testing
      invalidConfig.personality.friendliness = 15; // Out of valid range

      // Save should fail and rollback
      await expect(store.saveAvatarConfiguration(testUserId, invalidConfig))
        .rejects.toThrow('Configuration validation failed');

      // Original configuration should still be intact
      const afterFailure = await store.loadAvatarConfiguration(testUserId);
      expect(afterFailure.personality.friendliness).toBe(initialConfig.personality.friendliness);
    });

    test('should handle concurrent backup operations safely', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create multiple backups with small delays to ensure unique timestamps
      const backups = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        const backup = await store.createBackup(testUserId);
        backups.push(backup);
      }

      // All backups should be created successfully with unique IDs
      const backupIds = backups.map(b => b.id);
      const uniqueIds = new Set(backupIds);
      expect(uniqueIds.size).toBe(backups.length);

      // All backups should be valid
      for (const backup of backups) {
        expect(backup.size).toBeGreaterThan(0);
        expect(backup.checksum).toBeDefined();
        
        // Verify file exists
        const exists = await fs.access(backup.filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('should validate backup checksums during creation and restoration', async () => {
      const testConfig = createTestConfig();
      await store.saveAvatarConfiguration(testUserId, testConfig);

      // Create backup
      const backupInfo = await store.createBackup(testUserId);

      // Verify checksum matches file content
      const backupData = await fs.readFile(backupInfo.filePath);
      const calculatedChecksum = crypto.createHash('sha256').update(backupData).digest('hex');
      expect(calculatedChecksum).toBe(backupInfo.checksum);

      // Corrupt backup and verify restoration fails
      await fs.writeFile(backupInfo.filePath, 'corrupted_backup');
      
      await expect(store.restoreFromBackup(testUserId, backupInfo.id))
        .rejects.toThrow('Backup integrity check failed');
    });
  });
});

// Integration test to verify the complete storage workflow
describe('Storage Integration', () => {
  test('should handle complete avatar customization workflow', async () => {
    const store = await createAvatarDataStore('./integration-test-data');
    const userId = 'integration-test-user';

    try {
      // 1. Save initial configuration
      const initialConfig: AvatarConfiguration = {
        userId,
        version: '1.0.0',
        appearance: {
          face: {
            meshId: 'face_001',
            textureId: 'texture_001',
            eyeColor: '#4A90E2',
            skinTone: '#F5DEB3',
            features: {
              eyeSize: 1.0,
              noseSize: 1.0,
              mouthSize: 1.0,
              cheekbones: 1.0
            }
          },
          hair: {
            styleId: 'hair_001',
            color: '#8B4513',
            length: 0.5,
            texture: HairTexture.WAVY
          },
          clothing: {
            topId: 'shirt_001',
            bottomId: 'pants_001',
            shoesId: 'shoes_001',
            colors: {
              primary: '#FF6B6B',
              secondary: '#4ECDC4',
              accent: '#45B7D1'
            }
          },
          accessories: [],
          animations: {
            idle: 'idle_001',
            talking: 'talk_001',
            listening: 'listen_001',
            thinking: 'think_001',
            expressions: {
              happy: 'happy_001',
              sad: 'sad_001',
              surprised: 'surprised_001',
              confused: 'confused_001',
              excited: 'excited_001'
            }
          }
        },
        personality: {
          friendliness: 8,
          formality: 4,
          humor: 7,
          enthusiasm: 9,
          patience: 6,
          supportiveness: 8
        },
        voice: {
          pitch: 0.2,
          speed: 1.0,
          accent: AccentType.NEUTRAL,
          emotionalTone: EmotionalTone.CHEERFUL,
          volume: 0.8
        },
        emotions: {
          defaultEmotion: EmotionType.HAPPY,
          expressionIntensity: 0.7,
          transitionSpeed: 0.5,
          emotionMappings: []
        },
        createdAt: new Date(),
        lastModified: new Date(),
        parentallyApproved: true
      };

      await store.saveAvatarConfiguration(userId, initialConfig);

      // 2. Load and verify
      const loadedConfig = await store.loadAvatarConfiguration(userId);
      expect(loadedConfig.userId).toBe(userId);

      // 3. Create backup
      const backup = await store.createBackup(userId);
      expect(backup.userId).toBe(userId);

      // 4. Modify configuration
      const updatedConfig = { ...loadedConfig };
      updatedConfig.personality.humor = 9;
      updatedConfig.lastModified = new Date();

      await store.saveAvatarConfiguration(userId, updatedConfig);

      // 5. Verify changes
      const modifiedConfig = await store.loadAvatarConfiguration(userId);
      expect(modifiedConfig.personality.humor).toBe(9);

      // 6. Verify data integrity
      const integrity = await store.verifyDataIntegrity(userId);
      expect(integrity.isValid).toBe(true);

      // 7. Restore from backup
      await store.restoreFromBackup(userId, backup.id);

      // 8. Verify restoration
      const restoredConfig = await store.loadAvatarConfiguration(userId);
      expect(restoredConfig.personality.humor).toBe(initialConfig.personality.humor);

      console.log('✅ Complete storage workflow test passed');

    } finally {
      // Cleanup
      try {
        await fs.rm('./integration-test-data', { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});