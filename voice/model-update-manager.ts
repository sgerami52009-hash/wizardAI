/**
 * Model Update Manager - Handles offline model updates and version management
 * Manages model downloads, version tracking, and update scheduling
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ModelInfo, ModelUpdateInfo } from './offline-model-manager';

export interface ModelVersion {
  modelId: string;
  version: string;
  releaseDate: Date;
  fileSize: number;
  checksum: string;
  downloadUrl?: string;
  isRequired: boolean;
  minSystemVersion: string;
  releaseNotes: string;
  dependencies: string[];
}

export interface UpdateProgress {
  modelId: string;
  totalSize: number;
  downloadedSize: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  status: 'downloading' | 'validating' | 'installing' | 'complete' | 'failed';
}

export interface UpdateSchedule {
  modelId: string;
  scheduledTime: Date;
  updateType: 'automatic' | 'manual' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpdateManagerConfig {
  enableAutoUpdates: boolean;
  updateCheckInterval: number; // milliseconds
  maxConcurrentDownloads: number;
  downloadTimeout: number; // milliseconds
  retryAttempts: number;
  updateSchedule: 'immediate' | 'scheduled' | 'manual';
  maintenanceWindow: {
    startHour: number; // 0-23
    endHour: number; // 0-23
    daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
  };
  backupOldVersions: boolean;
  maxBackupVersions: number;
}

export class ModelUpdateManager extends EventEmitter {
  private config: UpdateManagerConfig;
  private availableUpdates: Map<string, ModelVersion> = new Map();
  private updateQueue: Map<string, UpdateSchedule> = new Map();
  private activeDownloads: Map<string, UpdateProgress> = new Map();
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private modelsDirectory: string;

  constructor(modelsDirectory: string, config?: Partial<UpdateManagerConfig>) {
    super();

    this.modelsDirectory = modelsDirectory;
    this.config = {
      enableAutoUpdates: true,
      updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
      maxConcurrentDownloads: 2,
      downloadTimeout: 30 * 60 * 1000, // 30 minutes
      retryAttempts: 3,
      updateSchedule: 'scheduled',
      maintenanceWindow: {
        startHour: 2, // 2 AM
        endHour: 4,   // 4 AM
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // Every day
      },
      backupOldVersions: true,
      maxBackupVersions: 3,
      ...config
    };
  }

  /**
   * Initialize the update manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('ModelUpdateManager already initialized');
      return;
    }

    try {
      // Create backup directory
      if (this.config.backupOldVersions) {
        await this.ensureBackupDirectory();
      }

      // Load update history
      await this.loadUpdateHistory();

      // Start periodic update checks
      if (this.config.enableAutoUpdates) {
        this.startUpdateChecks();
      }

      this.isInitialized = true;
      this.emit('initialized');

      console.log('ModelUpdateManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ModelUpdateManager:', error);
      throw error;
    }
  }

  /**
   * Shutdown the update manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop update checks
      if (this.updateCheckInterval) {
        clearInterval(this.updateCheckInterval);
        this.updateCheckInterval = null;
      }

      // Cancel active downloads
      for (const modelId of Array.from(this.activeDownloads.keys())) {
        await this.cancelUpdate(modelId);
      }

      this.isInitialized = false;
      this.emit('shutdown');

      console.log('ModelUpdateManager shutdown complete');
    } catch (error) {
      console.error('Error during ModelUpdateManager shutdown:', error);
    }
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    const backupDir = path.join(this.modelsDirectory, 'backups');
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }
  }

  /**
   * Load update history from file
   */
  private async loadUpdateHistory(): Promise<void> {
    const historyFile = path.join(this.modelsDirectory, 'update-history.json');
    
    try {
      const data = await fs.readFile(historyFile, 'utf-8');
      const history = JSON.parse(data);
      
      // Process history data if needed
      console.log('Loaded update history');
    } catch {
      // No history file exists yet, that's okay
      console.log('No update history found, starting fresh');
    }
  }

  /**
   * Start periodic update checks
   */
  private startUpdateChecks(): void {
    this.updateCheckInterval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }, this.config.updateCheckInterval);

    // Also check immediately
    setTimeout(() => this.checkForUpdates(), 5000);
  }

  /**
   * Check for available model updates
   */
  async checkForUpdates(modelIds?: string[]): Promise<ModelUpdateInfo[]> {
    try {
      console.log('Checking for model updates...');
      
      // In a real implementation, this would query a remote update server
      // For now, we'll simulate available updates
      const updates = await this.simulateUpdateCheck(modelIds);
      
      // Process available updates
      for (const update of updates) {
        this.availableUpdates.set(update.modelId, {
          modelId: update.modelId,
          version: update.availableVersion,
          releaseDate: new Date(),
          fileSize: update.updateSize,
          checksum: 'simulated-checksum',
          isRequired: update.isRequired,
          minSystemVersion: '1.0.0',
          releaseNotes: update.releaseNotes,
          dependencies: []
        });

        // Schedule update if auto-updates are enabled
        if (this.config.enableAutoUpdates) {
          await this.scheduleUpdate(update.modelId, update.isRequired ? 'critical' : 'automatic');
        }
      }

      this.emit('updatesAvailable', updates);
      return updates;
    } catch (error) {
      console.error('Error checking for updates:', error);
      this.emit('updateCheckFailed', { error: error.message });
      return [];
    }
  }

  /**
   * Simulate update check (replace with real implementation)
   */
  private async simulateUpdateCheck(modelIds?: string[]): Promise<ModelUpdateInfo[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate some available updates
    const simulatedUpdates: ModelUpdateInfo[] = [
      {
        modelId: 'wake-word_hey-assistant_v1.2.0',
        currentVersion: 'v1.2.0',
        availableVersion: 'v1.3.0',
        updateSize: 5 * 1024 * 1024, // 5MB
        isRequired: false,
        releaseNotes: 'Improved wake word accuracy and reduced false positives'
      },
      {
        modelId: 'speech-recognition_whisper_v1.0.0',
        currentVersion: 'v1.0.0',
        availableVersion: 'v1.1.0',
        updateSize: 50 * 1024 * 1024, // 50MB
        isRequired: true,
        releaseNotes: 'Critical security update and performance improvements'
      }
    ];

    // Filter by requested model IDs if provided
    if (modelIds) {
      return simulatedUpdates.filter(update => modelIds.includes(update.modelId));
    }

    return simulatedUpdates;
  }

  /**
   * Schedule a model update
   */
  async scheduleUpdate(
    modelId: string, 
    updateType: 'automatic' | 'manual' | 'critical' = 'automatic'
  ): Promise<void> {
    const priority = this.getUpdatePriority(updateType);
    let scheduledTime = new Date();

    // Determine when to schedule the update
    if (updateType === 'critical') {
      // Critical updates: schedule immediately
      scheduledTime = new Date();
    } else if (this.config.updateSchedule === 'scheduled') {
      // Schedule during maintenance window
      scheduledTime = this.getNextMaintenanceWindow();
    } else if (this.config.updateSchedule === 'manual') {
      // Don't auto-schedule manual updates
      return;
    }

    const schedule: UpdateSchedule = {
      modelId,
      scheduledTime,
      updateType,
      priority
    };

    this.updateQueue.set(modelId, schedule);
    
    this.emit('updateScheduled', schedule);
    console.log(`Scheduled ${updateType} update for ${modelId} at ${scheduledTime.toISOString()}`);

    // If scheduled for now or past, start immediately
    if (scheduledTime <= new Date()) {
      await this.startUpdate(modelId);
    }
  }

  /**
   * Get update priority based on type
   */
  private getUpdatePriority(updateType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (updateType) {
      case 'critical': return 'critical';
      case 'automatic': return 'medium';
      case 'manual': return 'low';
      default: return 'low';
    }
  }

  /**
   * Get next maintenance window
   */
  private getNextMaintenanceWindow(): Date {
    const now = new Date();
    const nextWindow = new Date(now);
    
    // Find next maintenance window
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = checkDate.getDay();
      
      if (this.config.maintenanceWindow.daysOfWeek.includes(dayOfWeek)) {
        checkDate.setHours(this.config.maintenanceWindow.startHour, 0, 0, 0);
        
        if (checkDate > now) {
          return checkDate;
        }
      }
    }

    // Fallback: tomorrow at maintenance start time
    nextWindow.setDate(nextWindow.getDate() + 1);
    nextWindow.setHours(this.config.maintenanceWindow.startHour, 0, 0, 0);
    return nextWindow;
  }

  /**
   * Start a model update
   */
  async startUpdate(modelId: string): Promise<void> {
    if (this.activeDownloads.has(modelId)) {
      console.warn(`Update already in progress for ${modelId}`);
      return;
    }

    if (this.activeDownloads.size >= this.config.maxConcurrentDownloads) {
      console.warn('Maximum concurrent downloads reached, queuing update');
      return;
    }

    const updateInfo = this.availableUpdates.get(modelId);
    if (!updateInfo) {
      throw new Error(`No update available for model ${modelId}`);
    }

    try {
      console.log(`Starting update for ${modelId} to version ${updateInfo.version}`);
      
      // Initialize progress tracking
      const progress: UpdateProgress = {
        modelId,
        totalSize: updateInfo.fileSize,
        downloadedSize: 0,
        percentage: 0,
        speed: 0,
        estimatedTimeRemaining: 0,
        status: 'downloading'
      };

      this.activeDownloads.set(modelId, progress);
      this.emit('updateStarted', { modelId, version: updateInfo.version });

      // Backup current version if enabled
      if (this.config.backupOldVersions) {
        await this.backupCurrentVersion(modelId);
      }

      // Download new version
      await this.downloadModel(modelId, updateInfo);

      // Validate downloaded model
      progress.status = 'validating';
      this.emit('updateProgress', { ...progress });
      await this.validateDownloadedModel(modelId, updateInfo);

      // Install new version
      progress.status = 'installing';
      this.emit('updateProgress', { ...progress });
      await this.installModel(modelId, updateInfo);

      // Complete update
      progress.status = 'complete';
      progress.percentage = 100;
      this.emit('updateProgress', { ...progress });
      this.emit('updateComplete', { modelId, version: updateInfo.version });

      // Cleanup
      this.activeDownloads.delete(modelId);
      this.updateQueue.delete(modelId);
      this.availableUpdates.delete(modelId);

      console.log(`Update completed for ${modelId}`);

    } catch (error) {
      console.error(`Update failed for ${modelId}:`, error);
      
      const progress = this.activeDownloads.get(modelId);
      if (progress) {
        progress.status = 'failed';
        this.emit('updateProgress', { ...progress });
      }

      this.emit('updateFailed', { modelId, error: error.message });
      this.activeDownloads.delete(modelId);

      // Retry if attempts remaining
      await this.handleUpdateFailure(modelId, error);
    }
  }

  /**
   * Download model file
   */
  private async downloadModel(modelId: string, updateInfo: ModelVersion): Promise<void> {
    const progress = this.activeDownloads.get(modelId)!;
    const tempFilePath = path.join(this.modelsDirectory, `${modelId}.tmp`);

    // Simulate download with progress updates
    const totalChunks = 100;
    const chunkSize = updateInfo.fileSize / totalChunks;
    const startTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 50));

      progress.downloadedSize = (i + 1) * chunkSize;
      progress.percentage = ((i + 1) / totalChunks) * 90; // Reserve 10% for validation/installation
      
      const elapsedTime = (Date.now() - startTime) / 1000;
      progress.speed = progress.downloadedSize / elapsedTime;
      progress.estimatedTimeRemaining = (updateInfo.fileSize - progress.downloadedSize) / progress.speed;

      this.emit('updateProgress', { ...progress });

      // Check for cancellation
      if (!this.activeDownloads.has(modelId)) {
        throw new Error('Update cancelled');
      }
    }

    // Simulate writing file
    await fs.writeFile(tempFilePath, Buffer.alloc(updateInfo.fileSize));
  }

  /**
   * Validate downloaded model
   */
  private async validateDownloadedModel(modelId: string, updateInfo: ModelVersion): Promise<void> {
    const tempFilePath = path.join(this.modelsDirectory, `${modelId}.tmp`);
    
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check file exists and has correct size
    const stats = await fs.stat(tempFilePath);
    if (stats.size !== updateInfo.fileSize) {
      throw new Error('Downloaded file size mismatch');
    }

    // In real implementation, would verify checksum
    console.log(`Validated downloaded model ${modelId}`);
  }

  /**
   * Install model
   */
  private async installModel(modelId: string, updateInfo: ModelVersion): Promise<void> {
    const tempFilePath = path.join(this.modelsDirectory, `${modelId}.tmp`);
    const finalFilePath = path.join(this.modelsDirectory, `${modelId}.model`);

    // Move temp file to final location
    await fs.rename(tempFilePath, finalFilePath);

    // Update model registry (would integrate with OfflineModelManager)
    console.log(`Installed model ${modelId} version ${updateInfo.version}`);
  }

  /**
   * Backup current model version
   */
  private async backupCurrentVersion(modelId: string): Promise<void> {
    const currentModelPath = path.join(this.modelsDirectory, `${modelId}.model`);
    const backupDir = path.join(this.modelsDirectory, 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${modelId}_${timestamp}.model`);

    try {
      await fs.copyFile(currentModelPath, backupPath);
      console.log(`Backed up ${modelId} to ${backupPath}`);

      // Clean up old backups
      await this.cleanupOldBackups(modelId);
    } catch (error) {
      console.warn(`Failed to backup ${modelId}:`, error);
      // Don't fail the update for backup issues
    }
  }

  /**
   * Clean up old backup versions
   */
  private async cleanupOldBackups(modelId: string): Promise<void> {
    const backupDir = path.join(this.modelsDirectory, 'backups');
    
    try {
      const files = await fs.readdir(backupDir);
      const modelBackups = files
        .filter(file => file.startsWith(`${modelId}_`))
        .map(file => ({
          name: file,
          path: path.join(backupDir, file),
          stat: null as any
        }));

      // Get file stats for sorting by creation time
      for (const backup of modelBackups) {
        backup.stat = await fs.stat(backup.path);
      }

      // Sort by creation time (newest first)
      modelBackups.sort((a, b) => b.stat.birthtime.getTime() - a.stat.birthtime.getTime());

      // Remove excess backups
      if (modelBackups.length > this.config.maxBackupVersions) {
        const toDelete = modelBackups.slice(this.config.maxBackupVersions);
        
        for (const backup of toDelete) {
          await fs.unlink(backup.path);
          console.log(`Deleted old backup: ${backup.name}`);
        }
      }
    } catch (error) {
      console.warn('Error cleaning up old backups:', error);
    }
  }

  /**
   * Handle update failure
   */
  private async handleUpdateFailure(modelId: string, error: any): Promise<void> {
    // Implementation would track retry attempts and potentially reschedule
    console.log(`Handling update failure for ${modelId}: ${error.message}`);
  }

  /**
   * Cancel an active update
   */
  async cancelUpdate(modelId: string): Promise<void> {
    if (this.activeDownloads.has(modelId)) {
      this.activeDownloads.delete(modelId);
      this.emit('updateCancelled', { modelId });
      console.log(`Cancelled update for ${modelId}`);
    }

    if (this.updateQueue.has(modelId)) {
      this.updateQueue.delete(modelId);
    }
  }

  /**
   * Get available updates
   */
  getAvailableUpdates(): ModelUpdateInfo[] {
    return Array.from(this.availableUpdates.values()).map(version => ({
      modelId: version.modelId,
      currentVersion: 'current', // Would get from model registry
      availableVersion: version.version,
      updateSize: version.fileSize,
      isRequired: version.isRequired,
      releaseNotes: version.releaseNotes
    }));
  }

  /**
   * Get update progress
   */
  getUpdateProgress(modelId: string): UpdateProgress | null {
    return this.activeDownloads.get(modelId) || null;
  }

  /**
   * Get all active updates
   */
  getActiveUpdates(): UpdateProgress[] {
    return Array.from(this.activeDownloads.values());
  }

  /**
   * Get update queue
   */
  getUpdateQueue(): UpdateSchedule[] {
    return Array.from(this.updateQueue.values());
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UpdateManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart update checks if interval changed
    if (newConfig.updateCheckInterval && this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.startUpdateChecks();
    }

    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): UpdateManagerConfig {
    return { ...this.config };
  }
}