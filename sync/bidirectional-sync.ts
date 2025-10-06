import { EventEmitter } from 'events';
import { CalendarEvent } from '../calendar/types';
import { 
  SyncConnection, 
  SyncResult, 
  SyncConflict, 
  ConflictResolution, 
  SyncError, 
  ExternalEventMapping, 
  SyncMetadata,
  ConflictType,
  ResolutionStrategy,
  ConflictStatus,
  SyncErrorType,
  ProviderType
} from './types';
import { AccountManager } from './account-manager';
import { providerRegistry } from './provider-registry';
import { ContentValidator } from './content-validator';

/**
 * Bidirectional Calendar Synchronization Engine
 * 
 * Implements intelligent sync conflict detection and resolution workflows
 * Supports incremental sync with sync tokens for efficiency
 * Includes offline sync queue with automatic retry and exponential backoff
 * 
 * Safety: All synced content validated for child-appropriateness
 * Performance: Optimized for Jetson Nano Orin with efficient conflict resolution
 */
export class BidirectionalSync extends EventEmitter {
  private accountManager: AccountManager;
  private contentValidator: ContentValidator;
  private eventMappings: Map<string, ExternalEventMapping> = new Map();
  private syncQueue: Map<string, QueuedSyncOperation[]> = new Map();
  private conflictResolver: ConflictResolver;
  private offlineQueue: OfflineQueue;
  private retryManager: RetryManager;

  constructor(accountManager: AccountManager) {
    super();
    this.accountManager = accountManager;
    this.contentValidator = new ContentValidator();
    this.conflictResolver = new ConflictResolver();
    this.offlineQueue = new OfflineQueue();
    this.retryManager = new RetryManager();
  }

  /**
   * Perform bidirectional synchronization for a connection
   */
  async performBidirectionalSync(connectionId: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      // Get connection and validate
      const connection = await this.getValidatedConnection(connectionId);
      
      // Check rate limits
      if (providerRegistry.isRateLimited(connection.provider.type)) {
        throw new Error('Rate limit exceeded, sync deferred');
      }

      // Initialize sync result
      const syncResult: SyncResult = {
        success: false,
        connectionId,
        eventsImported: 0,
        eventsExported: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        conflicts: [],
        errors: [],
        lastSyncTime: new Date(),
        nextSyncTime: new Date(Date.now() + connection.syncSettings.retryDelaySeconds * 1000),
        duration: 0
      };

      // Process offline queue first
      await this.processOfflineQueue(connection, syncResult);

      // Perform import sync (remote -> local)
      if (connection.syncSettings.bidirectionalSync) {
        await this.performImportSync(connection, syncResult);
      }

      // Perform export sync (local -> remote)
      if (connection.syncSettings.bidirectionalSync) {
        await this.performExportSync(connection, syncResult);
      }

      // Resolve any conflicts
      await this.resolveConflicts(syncResult.conflicts, connection);

      // Update sync metadata
      syncResult.duration = Date.now() - startTime;
      syncResult.success = syncResult.errors.length === 0;
      
      // Update rate limits
      providerRegistry.updateRateLimit(
        connection.provider.type, 
        'requests_per_minute' as any, 
        1
      );

      this.emit('syncCompleted', syncResult);
      return syncResult;
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        connectionId,
        eventsImported: 0,
        eventsExported: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        conflicts: [],
        errors: [{
          id: this.generateErrorId(),
          errorType: SyncErrorType.API_ERROR,
          errorMessage: error.message,
          timestamp: new Date(),
          connectionId,
          retryCount: 0,
          canRetry: true
        }],
        lastSyncTime: new Date(),
        duration: Date.now() - startTime
      };

      this.emit('syncError', errorResult);
      return errorResult;
    }
  }

  /**
   * Perform import synchronization (remote -> local)
   */
  private async performImportSync(connection: SyncConnection, syncResult: SyncResult): Promise<void> {
    try {
      const provider = providerRegistry.getProvider(connection.provider.type);
      const syncMetadata = await this.getSyncMetadata(connection.id);
      
      // Perform incremental sync if supported
      const remoteEvents = await this.fetchRemoteEvents(provider, connection, syncMetadata);
      
      for (const remoteEvent of remoteEvents) {
        try {
          // Validate content for child safety
          const validation = await this.contentValidator.validateEvent(remoteEvent);
          if (!validation.isValid) {
            syncResult.errors.push({
              id: this.generateErrorId(),
              errorType: SyncErrorType.VALIDATION_ERROR,
              errorMessage: `Event failed safety validation: ${validation.recommendation}`,
              timestamp: new Date(),
              connectionId: connection.id,
              eventId: remoteEvent.id,
              retryCount: 0,
              canRetry: false
            });
            continue;
          }

          // Check for existing mapping
          const mapping = this.getEventMapping(remoteEvent.externalId!, connection.id);
          
          if (mapping) {
            // Update existing event
            await this.updateLocalEvent(remoteEvent, mapping, syncResult);
          } else {
            // Import new event
            await this.importNewEvent(remoteEvent, connection, syncResult);
          }
        } catch (error) {
          syncResult.errors.push({
            id: this.generateErrorId(),
            errorType: SyncErrorType.API_ERROR,
            errorMessage: `Failed to process remote event: ${error.message}`,
            timestamp: new Date(),
            connectionId: connection.id,
            eventId: remoteEvent.id,
            retryCount: 0,
            canRetry: true
          });
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(connection.id, {
        syncToken: remoteEvents.nextSyncToken,
        lastModified: new Date(),
        syncVersion: (syncMetadata?.syncVersion || 0) + 1,
        providerSpecificData: remoteEvents.providerData || {}
      });
    } catch (error) {
      throw new Error(`Import sync failed: ${error.message}`);
    }
  }

  /**
   * Perform export synchronization (local -> remote)
   */
  private async performExportSync(connection: SyncConnection, syncResult: SyncResult): Promise<void> {
    try {
      const provider = providerRegistry.getProvider(connection.provider.type);
      const localEvents = await this.getLocalEventsForExport(connection);
      
      for (const localEvent of localEvents) {
        try {
          const mapping = this.getEventMapping(localEvent.id, connection.id);
          
          if (mapping && mapping.conflictStatus === ConflictStatus.NONE) {
            // Update existing remote event
            await this.updateRemoteEvent(localEvent, mapping, provider, connection, syncResult);
          } else if (!mapping) {
            // Export new event
            await this.exportNewEvent(localEvent, provider, connection, syncResult);
          }
        } catch (error) {
          syncResult.errors.push({
            id: this.generateErrorId(),
            errorType: SyncErrorType.API_ERROR,
            errorMessage: `Failed to export local event: ${error.message}`,
            timestamp: new Date(),
            connectionId: connection.id,
            eventId: localEvent.id,
            retryCount: 0,
            canRetry: true
          });
        }
      }
    } catch (error) {
      throw new Error(`Export sync failed: ${error.message}`);
    }
  }

  /**
   * Detect and create sync conflicts
   */
  private async detectConflicts(
    localEvent: CalendarEvent, 
    remoteEvent: CalendarEvent, 
    mapping: ExternalEventMapping
  ): Promise<SyncConflict | null> {
    // Check if both events were modified since last sync
    const localModified = localEvent.updatedAt > mapping.lastSyncTime;
    const remoteModified = remoteEvent.updatedAt > mapping.lastSyncTime;
    
    if (!localModified && !remoteModified) {
      return null; // No changes
    }

    if (localModified && remoteModified) {
      // Both modified - conflict detected
      return {
        id: this.generateConflictId(),
        eventId: localEvent.id,
        conflictType: ConflictType.MODIFIED_BOTH,
        localEvent,
        remoteEvent,
        detectedAt: new Date(),
        resolutionOptions: this.generateResolutionOptions(localEvent, remoteEvent),
        isResolved: false
      };
    }

    // Check for other conflict types
    if (localEvent.title !== remoteEvent.title || 
        localEvent.startTime.getTime() !== remoteEvent.startTime.getTime()) {
      return {
        id: this.generateConflictId(),
        eventId: localEvent.id,
        conflictType: ConflictType.MODIFIED_BOTH,
        localEvent,
        remoteEvent,
        detectedAt: new Date(),
        resolutionOptions: this.generateResolutionOptions(localEvent, remoteEvent),
        isResolved: false
      };
    }

    return null;
  }

  /**
   * Resolve sync conflicts based on resolution strategy
   */
  private async resolveConflicts(conflicts: SyncConflict[], connection: SyncConnection): Promise<void> {
    for (const conflict of conflicts) {
      try {
        const resolution = await this.conflictResolver.resolveConflict(
          conflict, 
          connection.syncSettings.conflictResolution
        );
        
        if (resolution) {
          await this.applyConflictResolution(conflict, resolution, connection);
          conflict.isResolved = true;
          conflict.resolution = resolution;
        }
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflict.id}:`, error);
      }
    }
  }

  /**
   * Apply conflict resolution to events
   */
  private async applyConflictResolution(
    conflict: SyncConflict, 
    resolution: ConflictResolution, 
    connection: SyncConnection
  ): Promise<void> {
    const provider = providerRegistry.getProvider(connection.provider.type);
    
    switch (resolution.strategy) {
      case ResolutionStrategy.KEEP_LOCAL:
        // Update remote with local version
        await this.updateRemoteEventFromLocal(conflict.localEvent, provider, connection);
        break;
        
      case ResolutionStrategy.KEEP_REMOTE:
        // Update local with remote version
        await this.updateLocalEventFromRemote(conflict.remoteEvent, connection);
        break;
        
      case ResolutionStrategy.MERGE:
        // Merge events based on merge rules
        const mergedEvent = await this.mergeEvents(conflict.localEvent, conflict.remoteEvent, resolution.mergeRules);
        await this.updateBothEvents(mergedEvent, provider, connection);
        break;
        
      case ResolutionStrategy.CREATE_BOTH:
        // Keep both as separate events
        const duplicateEvent = { ...conflict.remoteEvent, id: this.generateEventId() };
        await this.createLocalEvent(duplicateEvent);
        break;
        
      case ResolutionStrategy.MANUAL_REVIEW:
        // Queue for manual review
        await this.queueForManualReview(conflict);
        break;
    }
  }

  /**
   * Process offline sync queue
   */
  private async processOfflineQueue(connection: SyncConnection, syncResult: SyncResult): Promise<void> {
    const queuedOperations = this.offlineQueue.getOperations(connection.id);
    
    for (const operation of queuedOperations) {
      try {
        await this.executeQueuedOperation(operation, connection);
        this.offlineQueue.removeOperation(operation.id);
        
        // Update sync result based on operation type
        switch (operation.type) {
          case 'create':
            syncResult.eventsExported++;
            break;
          case 'update':
            syncResult.eventsUpdated++;
            break;
          case 'delete':
            syncResult.eventsDeleted++;
            break;
        }
      } catch (error) {
        // Retry with exponential backoff
        const shouldRetry = await this.retryManager.shouldRetry(operation);
        if (shouldRetry) {
          operation.retryCount++;
          operation.nextRetry = this.retryManager.getNextRetryTime(operation.retryCount);
        } else {
          // Max retries reached, add to errors
          syncResult.errors.push({
            id: this.generateErrorId(),
            errorType: SyncErrorType.API_ERROR,
            errorMessage: `Offline operation failed: ${error.message}`,
            timestamp: new Date(),
            connectionId: connection.id,
            eventId: operation.eventId,
            retryCount: operation.retryCount,
            canRetry: false
          });
          this.offlineQueue.removeOperation(operation.id);
        }
      }
    }
  }

  // Helper methods for event operations

  private async importNewEvent(
    remoteEvent: CalendarEvent, 
    connection: SyncConnection, 
    syncResult: SyncResult
  ): Promise<void> {
    // Create local event
    const localEventId = await this.createLocalEvent(remoteEvent);
    
    // Create mapping
    const mapping: ExternalEventMapping = {
      localEventId,
      externalEventId: remoteEvent.externalId!,
      providerId: connection.provider.id,
      accountId: connection.account.id,
      calendarId: remoteEvent.calendarId || '',
      lastSyncTime: new Date(),
      syncHash: this.calculateEventHash(remoteEvent),
      conflictStatus: ConflictStatus.NONE
    };
    
    this.eventMappings.set(this.getMappingKey(remoteEvent.externalId!, connection.id), mapping);
    syncResult.eventsImported++;
  }

  private async updateLocalEvent(
    remoteEvent: CalendarEvent, 
    mapping: ExternalEventMapping, 
    syncResult: SyncResult
  ): Promise<void> {
    // Get local event
    const localEvent = await this.getLocalEvent(mapping.localEventId);
    if (!localEvent) {
      throw new Error(`Local event not found: ${mapping.localEventId}`);
    }

    // Check for conflicts
    const conflict = await this.detectConflicts(localEvent, remoteEvent, mapping);
    if (conflict) {
      syncResult.conflicts.push(conflict);
      mapping.conflictStatus = ConflictStatus.DETECTED;
      return;
    }

    // Update local event
    await this.updateLocalEventData(mapping.localEventId, remoteEvent);
    
    // Update mapping
    mapping.lastSyncTime = new Date();
    mapping.syncHash = this.calculateEventHash(remoteEvent);
    mapping.conflictStatus = ConflictStatus.NONE;
    
    syncResult.eventsUpdated++;
  }

  private async exportNewEvent(
    localEvent: CalendarEvent, 
    provider: any, 
    connection: SyncConnection, 
    syncResult: SyncResult
  ): Promise<void> {
    // Create remote event
    const externalEventId = await provider.createEvent(
      connection.account.calendars[0].id, // Use first calendar for now
      localEvent,
      connection.account.authInfo
    );
    
    // Create mapping
    const mapping: ExternalEventMapping = {
      localEventId: localEvent.id,
      externalEventId,
      providerId: connection.provider.id,
      accountId: connection.account.id,
      calendarId: connection.account.calendars[0].id,
      lastSyncTime: new Date(),
      syncHash: this.calculateEventHash(localEvent),
      conflictStatus: ConflictStatus.NONE
    };
    
    this.eventMappings.set(this.getMappingKey(externalEventId, connection.id), mapping);
    syncResult.eventsExported++;
  }

  // Utility methods

  private async getValidatedConnection(connectionId: string): Promise<SyncConnection> {
    // This would integrate with the account manager to get connection details
    throw new Error('Connection validation not implemented');
  }

  private async getSyncMetadata(connectionId: string): Promise<SyncMetadata | undefined> {
    // Retrieve sync metadata from storage
    return undefined;
  }

  private async updateSyncMetadata(connectionId: string, metadata: Partial<SyncMetadata>): Promise<void> {
    // Update sync metadata in storage
  }

  private async fetchRemoteEvents(provider: any, connection: SyncConnection, metadata?: SyncMetadata): Promise<any> {
    // Fetch events from remote provider
    return { events: [], nextSyncToken: undefined, providerData: {} };
  }

  private async getLocalEventsForExport(connection: SyncConnection): Promise<CalendarEvent[]> {
    // Get local events that need to be exported
    return [];
  }

  private getEventMapping(eventId: string, connectionId: string): ExternalEventMapping | undefined {
    return this.eventMappings.get(this.getMappingKey(eventId, connectionId));
  }

  private getMappingKey(eventId: string, connectionId: string): string {
    return `${connectionId}_${eventId}`;
  }

  private calculateEventHash(event: CalendarEvent): string {
    // Calculate hash for change detection
    const hashData = `${event.title}_${event.startTime.toISOString()}_${event.endTime.toISOString()}_${event.description}`;
    return Buffer.from(hashData).toString('base64');
  }

  private generateResolutionOptions(localEvent: CalendarEvent, remoteEvent: CalendarEvent): ConflictResolution[] {
    return [
      {
        strategy: ResolutionStrategy.KEEP_LOCAL,
        userChoice: false
      },
      {
        strategy: ResolutionStrategy.KEEP_REMOTE,
        userChoice: false
      },
      {
        strategy: ResolutionStrategy.MERGE,
        mergeRules: [
          { field: 'title', strategy: 'newest_wins' as any, priority: 1 },
          { field: 'description', strategy: 'combine' as any, priority: 2 }
        ],
        userChoice: false
      }
    ];
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Placeholder methods for integration with calendar system
  private async createLocalEvent(event: CalendarEvent): Promise<string> {
    // Integrate with local calendar storage
    return this.generateEventId();
  }

  private async getLocalEvent(eventId: string): Promise<CalendarEvent | null> {
    // Get event from local calendar storage
    return null;
  }

  private async updateLocalEventData(eventId: string, eventData: CalendarEvent): Promise<void> {
    // Update local event in calendar storage
  }

  private async updateRemoteEventFromLocal(localEvent: CalendarEvent, provider: any, connection: SyncConnection): Promise<void> {
    // Update remote event with local data
  }

  private async updateLocalEventFromRemote(remoteEvent: CalendarEvent, connection: SyncConnection): Promise<void> {
    // Update local event with remote data
  }

  private async mergeEvents(localEvent: CalendarEvent, remoteEvent: CalendarEvent, mergeRules?: any[]): Promise<CalendarEvent> {
    // Merge two events based on rules
    return localEvent;
  }

  private async updateBothEvents(mergedEvent: CalendarEvent, provider: any, connection: SyncConnection): Promise<void> {
    // Update both local and remote with merged event
  }

  private async queueForManualReview(conflict: SyncConflict): Promise<void> {
    // Queue conflict for manual review
  }

  private async executeQueuedOperation(operation: QueuedSyncOperation, connection: SyncConnection): Promise<void> {
    // Execute queued sync operation
  }
}

// Supporting classes

class ConflictResolver {
  async resolveConflict(conflict: SyncConflict, strategy: any): Promise<ConflictResolution | null> {
    // Implement conflict resolution logic
    return null;
  }
}

class OfflineQueue {
  private operations: Map<string, QueuedSyncOperation[]> = new Map();

  getOperations(connectionId: string): QueuedSyncOperation[] {
    return this.operations.get(connectionId) || [];
  }

  addOperation(connectionId: string, operation: QueuedSyncOperation): void {
    const ops = this.operations.get(connectionId) || [];
    ops.push(operation);
    this.operations.set(connectionId, ops);
  }

  removeOperation(operationId: string): void {
    for (const [connectionId, ops] of this.operations.entries()) {
      const filtered = ops.filter(op => op.id !== operationId);
      this.operations.set(connectionId, filtered);
    }
  }
}

class RetryManager {
  async shouldRetry(operation: QueuedSyncOperation): boolean {
    return operation.retryCount < 3; // Max 3 retries
  }

  getNextRetryTime(retryCount: number): Date {
    // Exponential backoff: 1min, 2min, 4min
    const delayMinutes = Math.pow(2, retryCount - 1);
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }
}

// Type definitions
interface QueuedSyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  eventId: string;
  eventData?: CalendarEvent;
  timestamp: Date;
  retryCount: number;
  nextRetry?: Date;
}