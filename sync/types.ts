// External calendar synchronization types and interfaces

import { CalendarEvent } from '../calendar/types'

export interface CalendarProvider {
  id: string
  name: string
  type: ProviderType
  apiEndpoint: string
  authType: AuthenticationType
  capabilities: ProviderCapabilities
  rateLimits: RateLimit[]
  isActive: boolean
}

export enum ProviderType {
  GOOGLE_CALENDAR = 'google_calendar',
  MICROSOFT_OUTLOOK = 'microsoft_outlook',
  APPLE_ICLOUD = 'apple_icloud',
  CALDAV = 'caldav',
  ICS_SUBSCRIPTION = 'ics_subscription'
}

export enum AuthenticationType {
  OAUTH2 = 'oauth2',
  BASIC_AUTH = 'basic_auth',
  API_KEY = 'api_key',
  APP_PASSWORD = 'app_password'
}

export interface ProviderCapabilities {
  bidirectionalSync: boolean
  attendeeManagement: boolean
  attachmentSupport: boolean
  recurringEvents: boolean
  timezoneSupport: boolean
  categorySupport: boolean
  colorSupport: boolean
  maxAttachmentSize: number // in MB
  supportedRecurrencePatterns: RecurrenceType[]
  maxEventsPerSync: number
  supportsIncrementalSync: boolean
}

export enum RecurrenceType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

export interface RateLimit {
  type: RateLimitType
  limit: number
  windowSeconds: number
  currentUsage: number
  resetTime: Date
}

export enum RateLimitType {
  REQUESTS_PER_MINUTE = 'requests_per_minute',
  REQUESTS_PER_HOUR = 'requests_per_hour',
  REQUESTS_PER_DAY = 'requests_per_day',
  EVENTS_PER_SYNC = 'events_per_sync'
}

export interface CalendarAccount {
  id: string
  providerId: string
  accountName: string
  displayName: string
  email?: string
  isDefault: boolean
  calendars: CalendarInfo[]
  syncSettings: AccountSyncSettings
  authInfo: AuthenticationInfo
  isActive: boolean
  createdAt: Date
  lastSyncTime?: Date
}

export interface CalendarInfo {
  id: string
  name: string
  description?: string
  color: string
  isWritable: boolean
  isVisible: boolean
  syncEnabled: boolean
  lastSyncTime?: Date
  eventCount: number
}

export interface AccountSyncSettings {
  syncDirection: SyncDirection
  syncFrequency: number // minutes
  conflictResolution: ConflictResolutionStrategy
  filterRules: SyncFilter[]
  maxEventsPerSync: number
  syncAttendees: boolean
  syncAttachments: boolean
  syncPrivateEvents: boolean
}

export enum SyncDirection {
  IMPORT_ONLY = 'import_only',
  EXPORT_ONLY = 'export_only',
  BIDIRECTIONAL = 'bidirectional'
}

export enum ConflictResolutionStrategy {
  LOCAL_WINS = 'local_wins',
  REMOTE_WINS = 'remote_wins',
  MANUAL_RESOLUTION = 'manual_resolution',
  MERGE_CHANGES = 'merge_changes'
}

export interface SyncFilter {
  type: FilterType
  condition: FilterCondition
  value: any
  isEnabled: boolean
}

export enum FilterType {
  CATEGORY = 'category',
  TITLE_CONTAINS = 'title_contains',
  DATE_RANGE = 'date_range',
  ATTENDEE = 'attendee',
  PRIVACY_LEVEL = 'privacy_level'
}

export enum FilterCondition {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with'
}

export interface AuthenticationInfo {
  authType: AuthenticationType
  accessToken?: string
  refreshToken?: string
  tokenExpiry?: Date
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  apiKey?: string
  lastAuthTime: Date
  isValid: boolean
}

export interface SyncConnection {
  id: string
  provider: CalendarProvider
  account: CalendarAccount
  isActive: boolean
  lastSyncTime?: Date
  nextSyncTime?: Date
  syncSettings: SyncSettings
  authStatus: AuthenticationStatus
  healthStatus: ConnectionHealth
}

export interface SyncSettings {
  bidirectionalSync: boolean
  syncCalendars: string[] // Specific calendar IDs to sync
  excludeCalendars: string[] // Calendar IDs to exclude
  syncAttendees: boolean
  syncAttachments: boolean
  maxAttachmentSize: number // in MB
  syncPrivateEvents: boolean
  conflictResolution: ConflictResolutionStrategy
  retryAttempts: number
  retryDelaySeconds: number
}

export enum AuthenticationStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  INVALID = 'invalid',
  PENDING = 'pending',
  ERROR = 'error'
}

export enum ConnectionHealth {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  ERROR = 'error',
  DISCONNECTED = 'disconnected'
}

export interface SyncResult {
  success: boolean
  connectionId: string
  eventsImported: number
  eventsExported: number
  eventsUpdated: number
  eventsDeleted: number
  conflicts: SyncConflict[]
  errors: SyncError[]
  lastSyncTime: Date
  nextSyncTime?: Date
  duration: number // milliseconds
}

export interface SyncConflict {
  id: string
  eventId: string
  conflictType: ConflictType
  localEvent: CalendarEvent
  remoteEvent: CalendarEvent
  detectedAt: Date
  resolutionOptions: ConflictResolution[]
  isResolved: boolean
  resolution?: ConflictResolution
}

export enum ConflictType {
  MODIFIED_BOTH = 'modified_both',
  DELETED_LOCAL = 'deleted_local',
  DELETED_REMOTE = 'deleted_remote',
  DUPLICATE_EVENT = 'duplicate_event',
  TIMEZONE_MISMATCH = 'timezone_mismatch',
  ATTENDEE_MISMATCH = 'attendee_mismatch'
}

export interface ConflictResolution {
  strategy: ResolutionStrategy
  mergeRules?: MergeRule[]
  userChoice?: boolean
  appliedAt?: Date
  appliedBy?: string
}

export enum ResolutionStrategy {
  KEEP_LOCAL = 'keep_local',
  KEEP_REMOTE = 'keep_remote',
  MERGE = 'merge',
  CREATE_BOTH = 'create_both',
  MANUAL_REVIEW = 'manual_review'
}

export interface MergeRule {
  field: string
  strategy: MergeStrategy
  priority: number
}

export enum MergeStrategy {
  LOCAL_PRIORITY = 'local_priority',
  REMOTE_PRIORITY = 'remote_priority',
  NEWEST_WINS = 'newest_wins',
  COMBINE = 'combine'
}

export interface SyncError {
  id: string
  errorType: SyncErrorType
  errorMessage: string
  errorCode?: string
  timestamp: Date
  connectionId: string
  eventId?: string
  retryCount: number
  canRetry: boolean
  nextRetryTime?: Date
}

export enum SyncErrorType {
  AUTHENTICATION_FAILED = 'authentication_failed',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_DENIED = 'permission_denied',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable'
}

export interface ExternalEventMapping {
  localEventId: string
  externalEventId: string
  providerId: string
  accountId: string
  calendarId: string
  lastSyncTime: Date
  syncHash: string
  conflictStatus: ConflictStatus
}

export enum ConflictStatus {
  NONE = 'none',
  DETECTED = 'detected',
  RESOLVED = 'resolved',
  UNRESOLVED = 'unresolved'
}

export interface SyncMetadata {
  syncToken?: string // For incremental sync
  etag?: string // For change detection
  lastModified: Date
  syncVersion: number
  providerSpecificData: Record<string, any>
}

export interface SubscriptionConnection {
  id: string
  url: string
  name: string
  refreshInterval: number // minutes
  lastRefresh?: Date
  nextRefresh?: Date
  isActive: boolean
  healthStatus: ConnectionHealth
  eventCount: number
  lastError?: SyncError
}

export interface CalendarCredentials {
  providerId: string
  authType: AuthenticationType
  credentials: Record<string, any>
  scopes?: string[]
}

export interface AccountCredentials {
  accountName: string
  displayName: string
  email?: string
  credentials: CalendarCredentials
}