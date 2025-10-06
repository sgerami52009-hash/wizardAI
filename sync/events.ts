// Sync-specific events for the event bus

export interface SyncEvents {
  // Connection events
  'sync:connection:established': ConnectionEstablishedData
  'sync:connection:lost': ConnectionLostData
  'sync:connection:restored': ConnectionRestoredData
  
  // Sync operation events
  'sync:started': SyncStartedData
  'sync:progress': SyncProgressData
  'sync:completed': SyncCompletedData
  'sync:failed': SyncFailedData
  
  // Conflict events
  'sync:conflict:detected': SyncConflictDetectedData
  'sync:conflict:resolved': SyncConflictResolvedData
  
  // Authentication events
  'sync:auth:required': AuthRequiredData
  'sync:auth:success': AuthSuccessData
  'sync:auth:failed': AuthFailedData
}

export interface ConnectionEstablishedData {
  connectionId: string
  providerId: string
  accountId: string
  timestamp: Date
}

export interface ConnectionLostData {
  connectionId: string
  providerId: string
  reason: string
  timestamp: Date
}

export interface ConnectionRestoredData {
  connectionId: string
  providerId: string
  downtime: number // milliseconds
  timestamp: Date
}

export interface SyncStartedData {
  connectionId: string
  providerId: string
  syncType: 'full' | 'incremental'
  expectedDuration?: number
  timestamp: Date
}

export interface SyncProgressData {
  connectionId: string
  providerId: string
  progress: number // 0-100
  eventsProcessed: number
  totalEvents: number
  timestamp: Date
}

export interface SyncCompletedData {
  connectionId: string
  providerId: string
  duration: number // milliseconds
  eventsImported: number
  eventsExported: number
  eventsUpdated: number
  eventsDeleted: number
  conflicts: number
  errors: number
  timestamp: Date
}

export interface SyncFailedData {
  connectionId: string
  providerId: string
  errorType: string
  errorMessage: string
  errorCode?: string
  retryScheduled: boolean
  nextRetryTime?: Date
  timestamp: Date
}

export interface SyncConflictDetectedData {
  conflictId: string
  connectionId: string
  providerId: string
  eventId: string
  conflictType: string
  timestamp: Date
}

export interface SyncConflictResolvedData {
  conflictId: string
  connectionId: string
  providerId: string
  resolution: string
  resolvedBy: string
  timestamp: Date
}

export interface AuthRequiredData {
  connectionId: string
  providerId: string
  authType: string
  reason: string
  timestamp: Date
}

export interface AuthSuccessData {
  connectionId: string
  providerId: string
  authType: string
  timestamp: Date
}

export interface AuthFailedData {
  connectionId: string
  providerId: string
  authType: string
  errorMessage: string
  retryAllowed: boolean
  timestamp: Date
}