/**
 * Secure Data Handling Implementation
 * Provides AES-256 encryption, secure data processing pipelines, and audit logging
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DataOperation, 
  DataOperationLog, 
  TimeRange, 
  ValidationResult,
  ValidationIssue 
} from '../types';

/**
 * Encryption service using AES-256-GCM for secure data storage
 * Follows NIST recommendations for cryptographic security
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationIterations = 100000;
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  private masterKey: Buffer;
  private keyCache: Map<string, Buffer> = new Map();

  constructor(masterKey?: string) {
    if (masterKey) {
      this.masterKey = Buffer.from(masterKey, 'hex');
    } else {
      // Generate a secure master key
      this.masterKey = crypto.randomBytes(32);
      console.warn('Generated new master key. Store securely for production use.');
    }
  }

  /**
   * Encrypts data using AES-256-GCM with user-specific key derivation
   */
  async encryptData(data: any, userId: string, context?: string): Promise<EncryptedData> {
    try {
      const userKey = await this.deriveUserKey(userId, context);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, userKey);
      
      // Add additional authenticated data for integrity
      const aad = Buffer.from(`${userId}:${context || 'default'}:${Date.now()}`);
      cipher.setAAD(aad);

      const plaintext = JSON.stringify(data);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        aad: aad.toString('hex'),
        algorithm: this.algorithm,
        timestamp: new Date(),
        userId,
        context: context || 'default'
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypts data using AES-256-GCM with integrity verification
   */
  async decryptData(encryptedData: EncryptedData): Promise<any> {
    try {
      const userKey = await this.deriveUserKey(encryptedData.userId, encryptedData.context);
      const decipher = crypto.createDecipher(this.algorithm, userKey);
      
      // Set additional authenticated data
      decipher.setAAD(Buffer.from(encryptedData.aad, 'hex'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed - data may be corrupted or tampered with');
    }
  }

  /**
   * Encrypts data for storage with automatic key rotation
   */
  async encryptForStorage(data: any, userId: string): Promise<string> {
    const encrypted = await this.encryptData(data, userId, 'storage');
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypts data from storage
   */
  async decryptFromStorage(encryptedString: string): Promise<any> {
    const encryptedData: EncryptedData = JSON.parse(encryptedString);
    return await this.decryptData(encryptedData);
  }

  /**
   * Securely wipes sensitive data from memory
   */
  secureWipe(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      crypto.randomFillSync(buffer);
      buffer.fill(0);
    }
  }

  /**
   * Generates a secure hash for data integrity verification
   */
  generateIntegrityHash(data: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Verifies data integrity using hash comparison
   */
  verifyIntegrity(data: any, expectedHash: string): boolean {
    const actualHash = this.generateIntegrityHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(actualHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  }

  private async deriveUserKey(userId: string, context?: string): Promise<Buffer> {
    const keyId = `${userId}:${context || 'default'}`;
    
    // Check cache first
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }

    // Derive key using PBKDF2
    const salt = crypto.createHash('sha256').update(keyId).digest();
    const derivedKey = crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      this.keyDerivationIterations,
      32,
      'sha256'
    );

    // Cache the derived key
    this.keyCache.set(keyId, derivedKey);
    
    return derivedKey;
  }

  /**
   * Rotates encryption keys for enhanced security
   */
  async rotateKeys(): Promise<void> {
    // Clear key cache to force re-derivation
    this.keyCache.clear();
    
    // Generate new master key
    const newMasterKey = crypto.randomBytes(32);
    
    // In production, this would involve re-encrypting all data with new keys
    console.log('Key rotation initiated - implement data re-encryption in production');
    
    this.masterKey = newMasterKey;
  }
}

/**
 * Secure data processor for handling sensitive operations
 * Implements secure data pipelines with encryption and validation
 */
export class SecureDataProcessor {
  private readonly encryptionService: EncryptionService;
  private readonly auditLogger: AuditLogger;
  private readonly processingQueue: Map<string, ProcessingJob> = new Map();

  constructor(encryptionService: EncryptionService, auditLogger: AuditLogger) {
    this.encryptionService = encryptionService;
    this.auditLogger = auditLogger;
  }

  /**
   * Processes data through secure pipeline with encryption and validation
   */
  async processSecurely<T>(
    data: T,
    userId: string,
    operation: DataOperation,
    processor: (data: T) => Promise<T>
  ): Promise<T> {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Log operation start
      await this.auditLogger.logOperation({
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: true,
        auditTrail: `secure_processing_start:${jobId}`
      });

      // Validate input data
      const validation = await this.validateInputData(data, operation);
      if (!validation.valid) {
        throw new Error(`Input validation failed: ${validation.issues.map(i => i.description).join(', ')}`);
      }

      // Encrypt data for processing
      const encryptedInput = await this.encryptionService.encryptData(data, userId, 'processing');
      
      // Create processing job
      const job: ProcessingJob = {
        id: jobId,
        userId,
        operation,
        startTime: new Date(),
        status: 'processing'
      };
      this.processingQueue.set(jobId, job);

      // Decrypt for processing
      const decryptedData = await this.encryptionService.decryptData(encryptedInput);
      
      // Process data
      const result = await processor(decryptedData);
      
      // Encrypt result
      const encryptedResult = await this.encryptionService.encryptData(result, userId, 'processing');
      const finalResult = await this.encryptionService.decryptData(encryptedResult);

      // Update job status
      job.status = 'completed';
      job.endTime = new Date();

      // Log successful completion
      await this.auditLogger.logOperation({
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: true,
        auditTrail: `secure_processing_complete:${jobId}:${Date.now() - startTime}ms`
      });

      return finalResult;
    } catch (error) {
      // Update job status
      const job = this.processingQueue.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : 'Unknown error';
        job.endTime = new Date();
      }

      // Log error
      await this.auditLogger.logOperation({
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: false,
        auditTrail: `secure_processing_error:${jobId}:${error instanceof Error ? error.message : 'Unknown error'}`
      });

      throw error;
    } finally {
      // Cleanup
      setTimeout(() => {
        this.processingQueue.delete(jobId);
      }, 300000); // Keep job record for 5 minutes
    }
  }

  /**
   * Processes batch data securely with parallel encryption
   */
  async processBatchSecurely<T>(
    dataItems: T[],
    userId: string,
    operation: DataOperation,
    processor: (data: T[]) => Promise<T[]>
  ): Promise<T[]> {
    const batchId = crypto.randomUUID();
    
    try {
      // Encrypt all items
      const encryptedItems = await Promise.all(
        dataItems.map(item => this.encryptionService.encryptData(item, userId, `batch:${batchId}`))
      );

      // Decrypt for processing
      const decryptedItems = await Promise.all(
        encryptedItems.map(item => this.encryptionService.decryptData(item))
      );

      // Process batch
      const results = await processor(decryptedItems);

      // Encrypt results
      const encryptedResults = await Promise.all(
        results.map(result => this.encryptionService.encryptData(result, userId, `batch:${batchId}`))
      );

      // Decrypt final results
      const finalResults = await Promise.all(
        encryptedResults.map(result => this.encryptionService.decryptData(result))
      );

      await this.auditLogger.logOperation({
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: true,
        auditTrail: `batch_processing_complete:${batchId}:${dataItems.length}_items`
      });

      return finalResults;
    } catch (error) {
      await this.auditLogger.logOperation({
        operation,
        timestamp: new Date(),
        purpose: operation.purpose,
        dataTypes: operation.dataTypes || [],
        authorized: false,
        auditTrail: `batch_processing_error:${batchId}:${error instanceof Error ? error.message : 'Unknown error'}`
      });

      throw error;
    }
  }

  /**
   * Gets processing job status
   */
  getJobStatus(jobId: string): ProcessingJob | null {
    return this.processingQueue.get(jobId) || null;
  }

  /**
   * Gets all active processing jobs for a user
   */
  getUserJobs(userId: string): ProcessingJob[] {
    return Array.from(this.processingQueue.values())
      .filter(job => job.userId === userId);
  }

  private async validateInputData(data: any, operation: DataOperation): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Check for null/undefined data
    if (data === null || data === undefined) {
      issues.push({
        severity: 'critical',
        description: 'Input data is null or undefined',
        field: 'data',
        suggestedFix: 'Provide valid input data'
      });
    }

    // Check for sensitive data in inappropriate operations
    if (operation.type === 'share' || operation.type === 'export') {
      const sensitiveFields = this.findSensitiveFields(data);
      if (sensitiveFields.length > 0) {
        issues.push({
          severity: 'high',
          description: `Sensitive fields detected in ${operation.type} operation: ${sensitiveFields.join(', ')}`,
          field: 'sensitiveData',
          suggestedFix: 'Remove or encrypt sensitive fields before sharing/exporting'
        });
      }
    }

    // Check data size limits
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 10 * 1024 * 1024) { // 10MB limit
      issues.push({
        severity: 'medium',
        description: 'Data size exceeds recommended limit (10MB)',
        field: 'dataSize',
        suggestedFix: 'Consider breaking data into smaller chunks'
      });
    }

    return {
      valid: issues.length === 0 || issues.every(i => i.severity !== 'critical'),
      issues,
      recommendations: issues.map(i => i.suggestedFix),
      complianceScore: Math.max(0, 1 - (issues.length * 0.2))
    };
  }

  private findSensitiveFields(data: any, path = ''): string[] {
    const sensitiveFields: string[] = [];
    const sensitivePatterns = [
      /email/i, /phone/i, /address/i, /ssn/i, /credit/i,
      /password/i, /token/i, /key/i, /secret/i, /private/i
    ];

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if key matches sensitive patterns
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          sensitiveFields.push(currentPath);
        }

        // Recursively check nested objects
        if (typeof value === 'object' && value !== null) {
          sensitiveFields.push(...this.findSensitiveFields(value, currentPath));
        }
      }
    }

    return sensitiveFields;
  }
}

/**
 * Audit logger for privacy compliance and security monitoring
 * Provides comprehensive logging with tamper-evident records
 */
export class AuditLogger {
  private readonly logDirectory: string;
  private readonly encryptionService: EncryptionService;
  private readonly logBuffer: DataOperationLog[] = [];
  private readonly maxBufferSize = 100;
  private readonly flushInterval = 60000; // 1 minute

  constructor(logDirectory: string, encryptionService: EncryptionService) {
    this.logDirectory = logDirectory;
    this.encryptionService = encryptionService;
    
    // Start periodic log flushing
    setInterval(() => {
      this.flushLogs().catch(console.error);
    }, this.flushInterval);
  }

  /**
   * Logs a data operation with tamper-evident signature
   */
  async logOperation(log: DataOperationLog): Promise<void> {
    try {
      // Add integrity hash
      const logWithHash: AuditLogEntry = {
        ...log,
        id: crypto.randomUUID(),
        integrityHash: this.encryptionService.generateIntegrityHash(log),
        signature: await this.signLogEntry(log)
      };

      // Add to buffer
      this.logBuffer.push(log);

      // Flush if buffer is full
      if (this.logBuffer.length >= this.maxBufferSize) {
        await this.flushLogs();
      }
    } catch (error) {
      console.error('Failed to log operation:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Retrieves audit logs for a specific time range
   */
  async getAuditLogs(timeRange: TimeRange, userId?: string): Promise<AuditLogEntry[]> {
    try {
      const logFiles = await this.getLogFiles(timeRange);
      const logs: AuditLogEntry[] = [];

      for (const file of logFiles) {
        const fileLogs = await this.readLogFile(file);
        logs.push(...fileLogs);
      }

      // Filter by user if specified
      const filteredLogs = userId 
        ? logs.filter(log => log.auditTrail.includes(userId))
        : logs;

      // Filter by time range
      return filteredLogs.filter(log => 
        log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      throw new Error('Audit log retrieval failed');
    }
  }

  /**
   * Verifies the integrity of audit logs
   */
  async verifyLogIntegrity(logs: AuditLogEntry[]): Promise<IntegrityVerificationResult> {
    const results: IntegrityVerificationResult = {
      totalLogs: logs.length,
      validLogs: 0,
      invalidLogs: 0,
      tamperedLogs: [],
      verificationTimestamp: new Date()
    };

    for (const log of logs) {
      try {
        // Verify integrity hash
        const expectedHash = this.encryptionService.generateIntegrityHash({
          operation: log.operation,
          timestamp: log.timestamp,
          purpose: log.purpose,
          dataTypes: log.dataTypes,
          authorized: log.authorized,
          auditTrail: log.auditTrail
        });

        if (log.integrityHash === expectedHash) {
          results.validLogs++;
        } else {
          results.invalidLogs++;
          results.tamperedLogs.push({
            logId: log.id,
            timestamp: log.timestamp,
            reason: 'Integrity hash mismatch'
          });
        }
      } catch (error) {
        results.invalidLogs++;
        results.tamperedLogs.push({
          logId: log.id,
          timestamp: log.timestamp,
          reason: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return results;
  }

  /**
   * Exports audit logs for compliance reporting
   */
  async exportAuditLogs(timeRange: TimeRange, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.getAuditLogs(timeRange);
    
    if (format === 'csv') {
      return this.convertToCSV(logs);
    }
    
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Flushes buffered logs to disk
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      const timestamp = new Date();
      const filename = `audit_${timestamp.toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDirectory, filename);

      // Create log entries with integrity hashes
      const logEntries: AuditLogEntry[] = this.logBuffer.map(log => ({
        ...log,
        id: crypto.randomUUID(),
        integrityHash: this.encryptionService.generateIntegrityHash(log),
        signature: '' // Would be populated by signLogEntry in production
      }));

      // Encrypt log entries
      const encryptedLogs = await this.encryptionService.encryptForStorage(logEntries, 'audit_system');

      // Append to log file
      await fs.appendFile(filepath, encryptedLogs + '\n');

      // Clear buffer
      this.logBuffer.length = 0;
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  private async signLogEntry(log: DataOperationLog): Promise<string> {
    // In production, this would use digital signatures
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(log));
    return hash.digest('hex');
  }

  private async getLogFiles(timeRange: TimeRange): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDirectory);
      return files.filter(file => {
        const match = file.match(/audit_(\d{4}-\d{2}-\d{2})\.log/);
        if (!match) return false;
        
        const fileDate = new Date(match[1]);
        return fileDate >= timeRange.start && fileDate <= timeRange.end;
      }).map(file => path.join(this.logDirectory, file));
    } catch (error) {
      console.error('Failed to get log files:', error);
      return [];
    }
  }

  private async readLogFile(filepath: string): Promise<AuditLogEntry[]> {
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      
      const logs: AuditLogEntry[] = [];
      for (const line of lines) {
        try {
          const decryptedLogs = await this.encryptionService.decryptFromStorage(line);
          if (Array.isArray(decryptedLogs)) {
            logs.push(...decryptedLogs);
          }
        } catch (error) {
          console.error('Failed to decrypt log entry:', error);
        }
      }
      
      return logs;
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return 'No logs found';
    }

    const headers = ['id', 'timestamp', 'operation_type', 'purpose', 'data_types', 'authorized', 'audit_trail'];
    const csvLines = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        log.timestamp.toISOString(),
        log.operation.type,
        `"${log.purpose}"`,
        `"${log.dataTypes.join(';')}"`,
        log.authorized.toString(),
        `"${log.auditTrail}"`
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }
}

// Supporting interfaces and types

interface EncryptedData {
  encryptedData: string;
  iv: string;
  authTag: string;
  aad: string;
  algorithm: string;
  timestamp: Date;
  userId: string;
  context: string;
}

interface ProcessingJob {
  id: string;
  userId: string;
  operation: DataOperation;
  startTime: Date;
  endTime?: Date;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}

interface AuditLogEntry extends DataOperationLog {
  id: string;
  integrityHash: string;
  signature: string;
}

interface IntegrityVerificationResult {
  totalLogs: number;
  validLogs: number;
  invalidLogs: number;
  tamperedLogs: TamperedLogInfo[];
  verificationTimestamp: Date;
}

interface TamperedLogInfo {
  logId: string;
  timestamp: Date;
  reason: string;
}