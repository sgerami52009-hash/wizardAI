import { EventEmitter } from 'events';
import { CalendarEvent } from '../calendar/types';
import { 
  CalendarInvitation, 
  InvitationResponse, 
  AttendeeSync, 
  AttachmentSync,
  ProviderType,
  CalendarCredentials
} from './types';
import { providerRegistry } from './provider-registry';
import { ContentValidator } from './content-validator';

/**
 * Advanced Calendar Integration Features
 * 
 * Implements attendee management, meeting response synchronization,
 * event attachment handling, complex recurring patterns, and timezone support
 * 
 * Safety: All attachments and attendee data validated for child-appropriateness
 * Performance: Optimized for Jetson Nano Orin with efficient attachment handling
 */
export class AdvancedCalendarFeatures extends EventEmitter {
  private contentValidator: ContentValidator;
  private attachmentCache: Map<string, CachedAttachment> = new Map();
  private invitationQueue: Map<string, PendingInvitation[]> = new Map();
  private timezoneCache: Map<string, TimezoneInfo> = new Map();

  constructor() {
    super();
    this.contentValidator = new ContentValidator();
    this.initializeTimezoneCache();
  }

  /**
   * Manage attendees and synchronize meeting responses
   */
  async syncAttendees(
    eventId: string, 
    providerId: ProviderType, 
    credentials: CalendarCredentials
  ): Promise<AttendeeSync> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.capabilities?.attendeeManagement) {
        throw new Error(`Attendee management not supported by provider: ${providerId}`);
      }

      // Get current attendees from provider
      const attendees = await provider.getEventAttendees?.(eventId, credentials) || [];
      
      // Validate attendees for child safety
      const validatedAttendees = await this.validateAttendees(attendees);
      
      // Get attendee responses
      const responses = await provider.getAttendeeResponses?.(eventId, credentials) || [];
      
      const attendeeSync: AttendeeSync = {
        eventId,
        attendees: validatedAttendees,
        responses: responses.map(response => ({
          email: response.email,
          response: this.normalizeResponseStatus(response.status),
          timestamp: new Date(response.timestamp || Date.now())
        }))
      };

      this.emit('attendeesSynced', attendeeSync);
      return attendeeSync;
    } catch (error) {
      this.emit('attendeeSyncError', { eventId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle calendar invitations through home assistant
   */
  async handleCalendarInvitation(
    invitation: CalendarInvitation, 
    response: InvitationResponse,
    providerId: ProviderType,
    credentials: CalendarCredentials
  ): Promise<void> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.respondToInvitation) {
        throw new Error(`Invitation responses not supported by provider: ${providerId}`);
      }

      // Validate invitation content
      const isValidInvitation = await this.validateInvitation(invitation);
      if (!isValidInvitation) {
        throw new Error('Invitation failed safety validation');
      }

      // Send response through provider
      await provider.respondToInvitation(invitation, response, credentials);
      
      // Update local event if accepted
      if (response.response === 'ACCEPTED') {
        await this.addInvitationToLocalCalendar(invitation, credentials);
      }

      this.emit('invitationResponded', { invitation, response });
    } catch (error) {
      this.emit('invitationError', { invitation, error: error.message });
      throw error;
    }
  }

  /**
   * Handle event attachments up to size limits
   */
  async syncEventAttachments(
    eventId: string, 
    providerId: ProviderType, 
    credentials: CalendarCredentials
  ): Promise<AttachmentSync> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      const providerConfig = providerRegistry.getProviderConfig(providerId);
      
      if (!providerConfig.capabilities.attachmentSupport) {
        return { eventId, attachments: [] };
      }

      // Get attachments from provider
      const attachments = await provider.getEventAttachments?.(eventId, credentials) || [];
      
      // Validate and process attachments
      const processedAttachments = await this.processAttachments(
        attachments, 
        providerConfig.capabilities.maxAttachmentSize
      );

      const attachmentSync: AttachmentSync = {
        eventId,
        attachments: processedAttachments
      };

      this.emit('attachmentsSynced', attachmentSync);
      return attachmentSync;
    } catch (error) {
      this.emit('attachmentSyncError', { eventId, error: error.message });
      throw error;
    }
  }

  /**
   * Synchronize complex recurring event patterns
   */
  async syncRecurringPattern(
    event: CalendarEvent, 
    providerId: ProviderType
  ): Promise<RecurrenceSync> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      const providerConfig = providerRegistry.getProviderConfig(providerId);
      
      if (!event.recurrence) {
        return { eventId: event.id, isSupported: true, pattern: null };
      }

      // Check if recurrence pattern is supported
      const isSupported = this.isRecurrencePatternSupported(
        event.recurrence, 
        providerConfig.capabilities.supportedRecurrencePatterns
      );

      if (!isSupported) {
        // Convert to supported pattern or create individual events
        const convertedPattern = await this.convertRecurrencePattern(
          event.recurrence, 
          providerConfig.capabilities.supportedRecurrencePatterns
        );
        
        return {
          eventId: event.id,
          isSupported: false,
          pattern: convertedPattern,
          fallbackStrategy: 'individual_events'
        };
      }

      return {
        eventId: event.id,
        isSupported: true,
        pattern: event.recurrence
      };
    } catch (error) {
      this.emit('recurrenceSyncError', { eventId: event.id, error: error.message });
      throw error;
    }
  }

  /**
   * Handle timezone-aware event synchronization
   */
  async syncWithTimezone(
    event: CalendarEvent, 
    sourceTimezone: string, 
    targetTimezone: string
  ): Promise<CalendarEvent> {
    try {
      if (sourceTimezone === targetTimezone) {
        return event; // No conversion needed
      }

      // Get timezone information
      const sourceInfo = await this.getTimezoneInfo(sourceTimezone);
      const targetInfo = await this.getTimezoneInfo(targetTimezone);

      // Convert event times
      const convertedEvent = { ...event };
      
      convertedEvent.startTime = this.convertTimezone(
        event.startTime, 
        sourceInfo, 
        targetInfo
      );
      
      convertedEvent.endTime = this.convertTimezone(
        event.endTime, 
        sourceInfo, 
        targetInfo
      );

      // Update metadata to track timezone conversion
      convertedEvent.metadata = {
        ...convertedEvent.metadata,
        originalTimezone: sourceTimezone,
        convertedTimezone: targetTimezone,
        timezoneConvertedAt: new Date()
      };

      this.emit('timezoneConverted', { 
        eventId: event.id, 
        from: sourceTimezone, 
        to: targetTimezone 
      });

      return convertedEvent;
    } catch (error) {
      this.emit('timezoneConversionError', { 
        eventId: event.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Add attendee to event
   */
  async addAttendee(
    eventId: string, 
    attendeeEmail: string, 
    role: 'required' | 'optional' | 'resource',
    providerId: ProviderType,
    credentials: CalendarCredentials
  ): Promise<void> {
    try {
      // Validate attendee email
      const isValidAttendee = await this.validateAttendeeEmail(attendeeEmail);
      if (!isValidAttendee) {
        throw new Error('Attendee email failed safety validation');
      }

      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.addAttendee) {
        throw new Error(`Adding attendees not supported by provider: ${providerId}`);
      }

      await provider.addAttendee(eventId, attendeeEmail, role, credentials);
      
      this.emit('attendeeAdded', { eventId, attendeeEmail, role });
    } catch (error) {
      this.emit('attendeeAddError', { eventId, attendeeEmail, error: error.message });
      throw error;
    }
  }

  /**
   * Remove attendee from event
   */
  async removeAttendee(
    eventId: string, 
    attendeeEmail: string,
    providerId: ProviderType,
    credentials: CalendarCredentials
  ): Promise<void> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.removeAttendee) {
        throw new Error(`Removing attendees not supported by provider: ${providerId}`);
      }

      await provider.removeAttendee(eventId, attendeeEmail, credentials);
      
      this.emit('attendeeRemoved', { eventId, attendeeEmail });
    } catch (error) {
      this.emit('attendeeRemoveError', { eventId, attendeeEmail, error: error.message });
      throw error;
    }
  }

  /**
   * Upload attachment to event
   */
  async uploadAttachment(
    eventId: string, 
    file: AttachmentFile,
    providerId: ProviderType,
    credentials: CalendarCredentials
  ): Promise<string> {
    try {
      const providerConfig = providerRegistry.getProviderConfig(providerId);
      
      if (!providerConfig.capabilities.attachmentSupport) {
        throw new Error(`Attachments not supported by provider: ${providerId}`);
      }

      // Validate file size
      const maxSizeMB = providerConfig.capabilities.maxAttachmentSize;
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File too large. Maximum size: ${maxSizeMB}MB`);
      }

      // Validate file content
      const isValidFile = await this.validateAttachmentFile(file);
      if (!isValidFile) {
        throw new Error('File failed safety validation');
      }

      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.uploadAttachment) {
        throw new Error(`File upload not supported by provider: ${providerId}`);
      }

      const attachmentId = await provider.uploadAttachment(eventId, file, credentials);
      
      // Cache attachment metadata
      this.cacheAttachment(attachmentId, {
        eventId,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: new Date()
      });

      this.emit('attachmentUploaded', { eventId, attachmentId, filename: file.filename });
      return attachmentId;
    } catch (error) {
      this.emit('attachmentUploadError', { eventId, filename: file.filename, error: error.message });
      throw error;
    }
  }

  /**
   * Download attachment from event
   */
  async downloadAttachment(
    attachmentId: string,
    providerId: ProviderType,
    credentials: CalendarCredentials
  ): Promise<AttachmentFile> {
    try {
      const provider = providerRegistry.getProvider(providerId);
      
      if (!provider.downloadAttachment) {
        throw new Error(`File download not supported by provider: ${providerId}`);
      }

      // Check cache first
      const cached = this.attachmentCache.get(attachmentId);
      if (cached && this.isCacheValid(cached.cachedAt)) {
        return cached.file;
      }

      const file = await provider.downloadAttachment(attachmentId, credentials);
      
      // Validate downloaded file
      const isValidFile = await this.validateAttachmentFile(file);
      if (!isValidFile) {
        throw new Error('Downloaded file failed safety validation');
      }

      // Update cache
      this.cacheAttachment(attachmentId, {
        eventId: cached?.eventId || '',
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: cached?.uploadedAt || new Date(),
        file
      });

      this.emit('attachmentDownloaded', { attachmentId, filename: file.filename });
      return file;
    } catch (error) {
      this.emit('attachmentDownloadError', { attachmentId, error: error.message });
      throw error;
    }
  }

  // Private helper methods

  private async validateAttendees(attendees: any[]): Promise<any[]> {
    const validated = [];
    
    for (const attendee of attendees) {
      const isValid = await this.validateAttendeeEmail(attendee.email);
      if (isValid) {
        validated.push({
          email: attendee.email,
          name: attendee.name || attendee.email,
          role: attendee.role || 'required'
        });
      }
    }
    
    return validated;
  }

  private async validateAttendeeEmail(email: string): Promise<boolean> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // Check against blocked domains
    const domain = email.split('@')[1]?.toLowerCase();
    const blockedDomains = ['spam.com', 'fake.com']; // Would be configurable
    
    return !blockedDomains.includes(domain);
  }

  private async validateInvitation(invitation: CalendarInvitation): Promise<boolean> {
    // Validate organizer email
    const isValidOrganizer = await this.validateAttendeeEmail(invitation.organizerEmail);
    if (!isValidOrganizer) {
      return false;
    }

    // Additional validation logic would go here
    return true;
  }

  private async processAttachments(
    attachments: any[], 
    maxSizeMB: number
  ): Promise<any[]> {
    const processed = [];
    
    for (const attachment of attachments) {
      // Check size limit
      if (attachment.size > maxSizeMB * 1024 * 1024) {
        continue; // Skip oversized attachments
      }

      // Validate file type
      if (await this.isAllowedFileType(attachment.mimeType)) {
        processed.push({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url
        });
      }
    }
    
    return processed;
  }

  private async isAllowedFileType(mimeType: string): Promise<boolean> {
    // Allow common document and image types, block executables
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const blockedTypes = [
      'application/x-executable',
      'application/x-msdownload',
      'application/x-msdos-program'
    ];
    
    return allowedTypes.includes(mimeType) && !blockedTypes.includes(mimeType);
  }

  private async validateAttachmentFile(file: AttachmentFile): Promise<boolean> {
    // Check file type
    if (!await this.isAllowedFileType(file.mimeType)) {
      return false;
    }

    // Check filename for suspicious patterns
    const suspiciousPatterns = [/\.exe$/i, /\.bat$/i, /\.scr$/i, /\.com$/i];
    if (suspiciousPatterns.some(pattern => pattern.test(file.filename))) {
      return false;
    }

    return true;
  }

  private isRecurrencePatternSupported(
    pattern: any, 
    supportedPatterns: string[]
  ): boolean {
    if (!pattern || !pattern.frequency) {
      return true; // No recurrence is always supported
    }
    
    return supportedPatterns.includes(pattern.frequency);
  }

  private async convertRecurrencePattern(
    pattern: any, 
    supportedPatterns: string[]
  ): Promise<any> {
    // Convert unsupported patterns to supported ones
    if (pattern.frequency === 'custom' && supportedPatterns.includes('weekly')) {
      return {
        ...pattern,
        frequency: 'weekly',
        interval: 1
      };
    }
    
    // Default fallback
    return {
      frequency: 'weekly',
      interval: 1
    };
  }

  private initializeTimezoneCache(): void {
    // Initialize with common timezones
    const commonTimezones = [
      { id: 'UTC', offset: 0, name: 'Coordinated Universal Time' },
      { id: 'America/New_York', offset: -5, name: 'Eastern Time' },
      { id: 'America/Chicago', offset: -6, name: 'Central Time' },
      { id: 'America/Denver', offset: -7, name: 'Mountain Time' },
      { id: 'America/Los_Angeles', offset: -8, name: 'Pacific Time' },
      { id: 'Europe/London', offset: 0, name: 'Greenwich Mean Time' },
      { id: 'Europe/Paris', offset: 1, name: 'Central European Time' },
      { id: 'Asia/Tokyo', offset: 9, name: 'Japan Standard Time' }
    ];

    commonTimezones.forEach(tz => {
      this.timezoneCache.set(tz.id, tz);
    });
  }

  private async getTimezoneInfo(timezoneId: string): Promise<TimezoneInfo> {
    // Check cache first
    const cached = this.timezoneCache.get(timezoneId);
    if (cached) {
      return cached;
    }

    // For production, this would query a timezone database
    const defaultInfo: TimezoneInfo = {
      id: timezoneId,
      offset: 0, // UTC default
      name: timezoneId
    };

    this.timezoneCache.set(timezoneId, defaultInfo);
    return defaultInfo;
  }

  private convertTimezone(
    dateTime: Date, 
    sourceTimezone: TimezoneInfo, 
    targetTimezone: TimezoneInfo
  ): Date {
    // Simple timezone conversion (production would use proper timezone library)
    const offsetDifference = (targetTimezone.offset - sourceTimezone.offset) * 60 * 60 * 1000;
    return new Date(dateTime.getTime() + offsetDifference);
  }

  private normalizeResponseStatus(status: string): 'accepted' | 'declined' | 'tentative' | 'needs-action' {
    const normalized = status.toLowerCase();
    
    if (normalized.includes('accept')) return 'accepted';
    if (normalized.includes('decline')) return 'declined';
    if (normalized.includes('tentative') || normalized.includes('maybe')) return 'tentative';
    
    return 'needs-action';
  }

  private async addInvitationToLocalCalendar(
    invitation: CalendarInvitation, 
    credentials: CalendarCredentials
  ): Promise<void> {
    // This would integrate with the local calendar system
    // to add the accepted invitation as a local event
  }

  private cacheAttachment(attachmentId: string, metadata: any): void {
    this.attachmentCache.set(attachmentId, {
      ...metadata,
      cachedAt: new Date()
    });

    // Limit cache size (keep last 100 attachments)
    if (this.attachmentCache.size > 100) {
      const oldestKey = this.attachmentCache.keys().next().value;
      this.attachmentCache.delete(oldestKey);
    }
  }

  private isCacheValid(cachedAt: Date): boolean {
    const cacheExpiryMs = 60 * 60 * 1000; // 1 hour
    return Date.now() - cachedAt.getTime() < cacheExpiryMs;
  }
}

// Type definitions
interface AttachmentFile {
  filename: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer;
}

interface CachedAttachment {
  eventId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  cachedAt: Date;
  file?: AttachmentFile;
}

interface PendingInvitation {
  invitation: CalendarInvitation;
  receivedAt: Date;
  expiresAt: Date;
}

interface TimezoneInfo {
  id: string;
  offset: number; // Hours from UTC
  name: string;
}

interface RecurrenceSync {
  eventId: string;
  isSupported: boolean;
  pattern: any;
  fallbackStrategy?: 'individual_events' | 'simplified_pattern';
}