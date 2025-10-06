// Calendar-specific events for the event bus

export interface CalendarEvents {
  // Event lifecycle events
  'calendar:event:created': CalendarEventCreatedData
  'calendar:event:updated': CalendarEventUpdatedData
  'calendar:event:deleted': CalendarEventDeletedData
  'calendar:event:imported': CalendarEventImportedData
  
  // Conflict events
  'calendar:conflict:detected': ConflictDetectedData
  'calendar:conflict:resolved': ConflictResolvedData
  
  // View events
  'calendar:view:changed': ViewChangedData
  'calendar:view:rendered': ViewRenderedData
}

export interface CalendarEventCreatedData {
  eventId: string
  userId: string
  source: 'local' | 'sync' | 'import'
  timestamp: Date
}

export interface CalendarEventUpdatedData {
  eventId: string
  userId: string
  changes: string[]
  timestamp: Date
}

export interface CalendarEventDeletedData {
  eventId: string
  userId: string
  reason?: string
  timestamp: Date
}

export interface CalendarEventImportedData {
  eventId: string
  providerId: string
  userId: string
  timestamp: Date
}

export interface ConflictDetectedData {
  conflictId: string
  eventIds: string[]
  conflictType: string
  severity: string
  timestamp: Date
}

export interface ConflictResolvedData {
  conflictId: string
  resolution: string
  resolvedBy: string
  timestamp: Date
}

export interface ViewChangedData {
  userId: string
  viewType: string
  dateRange: {
    start: Date
    end: Date
  }
  timestamp: Date
}

export interface ViewRenderedData {
  userId: string
  viewType: string
  eventCount: number
  renderTime: number
  timestamp: Date
}