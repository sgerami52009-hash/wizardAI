import { EventEmitter } from 'events';
import { 
  SyncConnection, 
  SyncResult, 
  SyncError, 
  ConnectionHealth,
  AuthenticationStatus,
  ProviderType
} from './types';
import { AccountManager } from './account-manager';
import { providerRegistry } from './provider-registry';

/**
 * Sync Status Monitoring and Error Reporting
 * 
 * Monitors sync operations and provides detailed status reporting
 * Implements automatic error recovery and health monitoring
 * 
 * Safety: Monitors for content validation failures and security issues
 * Performance: Tracks sync performance metrics for Jetson Nano Orin optimization
 */
export class SyncMonitor extends EventEmitter {
  private accountManager: AccountManager;
  private syncHistory: Map<string, SyncHistoryEntry[]> = new Map();
  private connectionHealth: Map<string, ConnectionHealthStatus> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(accountManager: AccountManager) {
    super();
    this.accountManager = accountManager;
    this.startMonitoring();
  }

  /**
   * Start continuous monitoring of sync operations
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute

    this.emit('monitoringStarted');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Record sync result for monitoring
   */
  recordSyncResult(result: SyncResult): void {
    const connectionId = result.connectionId;
    
    // Add to sync history
    const historyEntry: SyncHistoryEntry = {
      timestamp: result.lastSyncTime,
      success: result.success,
      duration: result.duration,
      eventsProcessed: result.eventsImported + result.eventsExported + result.eventsUpdated,
      errorCount: result.errors.length,
      conflictCount: result.conflicts.length
    };

    const history = this.syncHistory.get(connectionId) || [];
    history.push(historyEntry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.syncHistory.set(connectionId, history);

    // Update connection health
    this.updateConnectionHealth(connectionId, result);

    // Update performance metrics
    this.updatePerformanceMetrics(connectionId, result);

    // Analyze error patterns
    this.analyzeErrorPatterns(connectionId, result.errors);

    this.emit('syncResultRecorded', { connectionId, result });
  }

  /**
   * Get sync status for a connection
   */
  getSyncStatus(connectionId: string): SyncStatus {
    const history = this.syncHistory.get(connectionId) || [];
    const health = this.connectionHealth.get(connectionId);
    const metrics = this.performanceMetrics.get(connectionId);
    const lastSync = history[history.length - 1];

    return {
      connectionId,
      lastSyncTime: lastSync?.timestamp,
      lastSyncSuccess: lastSync?.success ?? false,
      health: health?.status || ConnectionHealth.DISCONNECTED,
      totalSyncs: history.length,
      successRate: this.calculateSuccessRate(history),
      averageDuration: metrics?.averageDuration || 0,
      averageEventsPerSync: metrics?.averageEventsPerSync || 0,
      recentErrors: this.getRecentErrors(connectionId),
      nextScheduledSync: this.getNextScheduledSync(connectionId)
    };
  }

  /**
   * Get comprehensive sync statistics
   */
  getSyncStatistics(): SyncStatistics {
    const allConnections = this.accountManager.getAllAccounts()
      .flatMap(account => account.calendars.map(cal => ({ accountId: account.id, calendarId: cal.id })));

    const totalConnections = allConnections.length;
    const activeConnections = Array.from(this.connectionHealth.values())
      .filter(health => health.status === ConnectionHealth.HEALTHY).length;

    const allHistory = Array.from(this.syncHistory.values()).flat();
    const totalSyncs = allHistory.length;
    const successfulSyncs = allHistory.filter(entry => entry.success).length;
    const totalErrors = allHistory.reduce((sum, entry) => sum + entry.errorCount, 0);
    const totalConflicts = allHistory.reduce((sum, entry) => sum + entry.conflictCount, 0);

    return {
      totalConnections,
      activeConnections,
      totalSyncs,
      successfulSyncs,
      overallSuccessRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0,
      totalErrors,
      totalConflicts,
      averageSyncDuration: this.calculateOverallAverageDuration(),
      providerStatistics: this.getProviderStatistics()
    };
  }

  /**
   * Get error analysis and recommendations
   */
  getErrorAnalysis(connectionId?: string): ErrorAnalysis {
    const errorPatterns = connectionId 
      ? [this.errorPatterns.get(connectionId)].filter(Boolean)
      : Array.from(this.errorPatterns.values());

    const commonErrors = this.identifyCommonErrors(errorPatterns);
    const recommendations = this.generateRecommendations(commonErrors);

    return {
      commonErrors,
      recommendations,
      errorTrends: this.analyzeErrorTrends(errorPatterns),
      criticalIssues: this.identifyCriticalIssues(errorPatterns)
    };
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): PerformanceInsights {
    const allMetrics = Array.from(this.performanceMetrics.values());
    
    return {
      slowestConnections: this.identifySlowestConnections(allMetrics),
      fastestConnections: this.identifyFastestConnections(allMetrics),
      performanceTrends: this.analyzePerformanceTrends(),
      resourceUsage: this.estimateResourceUsage(),
      optimizationSuggestions: this.generateOptimizationSuggestions(allMetrics)
    };
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const accounts = this.accountManager.getActiveAccounts();
    
    for (const account of accounts) {
      try {
        // Check authentication status
        const authValid = await this.accountManager.validateAccountAuth(account.id);
        
        // Update health status
        const connectionId = account.id;
        const currentHealth = this.connectionHealth.get(connectionId);
        
        if (!authValid) {
          this.updateHealthStatus(connectionId, ConnectionHealth.ERROR, 'Authentication failed');
        } else if (this.hasRecentErrors(connectionId)) {
          this.updateHealthStatus(connectionId, ConnectionHealth.WARNING, 'Recent sync errors detected');
        } else {
          this.updateHealthStatus(connectionId, ConnectionHealth.HEALTHY, 'All systems operational');
        }
      } catch (error) {
        this.updateHealthStatus(account.id, ConnectionHealth.ERROR, error.message);
      }
    }

    this.emit('healthCheckCompleted');
  }

  /**
   * Update connection health status
   */
  private updateConnectionHealth(connectionId: string, result: SyncResult): void {
    const currentHealth = this.connectionHealth.get(connectionId) || {
      status: ConnectionHealth.HEALTHY,
      lastCheck: new Date(),
      message: 'Newly connected',
      consecutiveFailures: 0,
      lastSuccessfulSync: undefined
    };

    if (result.success) {
      currentHealth.status = ConnectionHealth.HEALTHY;
      currentHealth.message = 'Sync completed successfully';
      currentHealth.consecutiveFailures = 0;
      currentHealth.lastSuccessfulSync = result.lastSyncTime;
    } else {
      currentHealth.consecutiveFailures++;
      
      if (currentHealth.consecutiveFailures >= 3) {
        currentHealth.status = ConnectionHealth.ERROR;
        currentHealth.message = `${currentHealth.consecutiveFailures} consecutive sync failures`;
      } else {
        currentHealth.status = ConnectionHealth.WARNING;
        currentHealth.message = `Sync failed: ${result.errors[0]?.errorMessage || 'Unknown error'}`;
      }
    }

    currentHealth.lastCheck = new Date();
    this.connectionHealth.set(connectionId, currentHealth);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(connectionId: string, result: SyncResult): void {
    const currentMetrics = this.performanceMetrics.get(connectionId) || {
      totalSyncs: 0,
      totalDuration: 0,
      totalEvents: 0,
      averageDuration: 0,
      averageEventsPerSync: 0,
      fastestSync: Infinity,
      slowestSync: 0,
      lastUpdated: new Date()
    };

    const eventsProcessed = result.eventsImported + result.eventsExported + result.eventsUpdated;
    
    currentMetrics.totalSyncs++;
    currentMetrics.totalDuration += result.duration;
    currentMetrics.totalEvents += eventsProcessed;
    currentMetrics.averageDuration = currentMetrics.totalDuration / currentMetrics.totalSyncs;
    currentMetrics.averageEventsPerSync = currentMetrics.totalEvents / currentMetrics.totalSyncs;
    currentMetrics.fastestSync = Math.min(currentMetrics.fastestSync, result.duration);
    currentMetrics.slowestSync = Math.max(currentMetrics.slowestSync, result.duration);
    currentMetrics.lastUpdated = new Date();

    this.performanceMetrics.set(connectionId, currentMetrics);
  }

  /**
   * Analyze error patterns for a connection
   */
  private analyzeErrorPatterns(connectionId: string, errors: SyncError[]): void {
    if (errors.length === 0) {
      return;
    }

    const currentPattern = this.errorPatterns.get(connectionId) || {
      connectionId,
      errorCounts: new Map(),
      recentErrors: [],
      firstSeen: new Date(),
      lastSeen: new Date()
    };

    for (const error of errors) {
      // Count error types
      const count = currentPattern.errorCounts.get(error.errorType) || 0;
      currentPattern.errorCounts.set(error.errorType, count + 1);

      // Add to recent errors (keep last 10)
      currentPattern.recentErrors.push(error);
      if (currentPattern.recentErrors.length > 10) {
        currentPattern.recentErrors.shift();
      }
    }

    currentPattern.lastSeen = new Date();
    this.errorPatterns.set(connectionId, currentPattern);
  }

  // Helper methods

  private calculateSuccessRate(history: SyncHistoryEntry[]): number {
    if (history.length === 0) return 0;
    const successful = history.filter(entry => entry.success).length;
    return (successful / history.length) * 100;
  }

  private getRecentErrors(connectionId: string): SyncError[] {
    const pattern = this.errorPatterns.get(connectionId);
    return pattern?.recentErrors || [];
  }

  private getNextScheduledSync(connectionId: string): Date | undefined {
    // This would integrate with the sync scheduler
    return new Date(Date.now() + 15 * 60 * 1000); // Default 15 minutes
  }

  private hasRecentErrors(connectionId: string): boolean {
    const pattern = this.errorPatterns.get(connectionId);
    if (!pattern) return false;
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return pattern.recentErrors.some(error => error.timestamp > fiveMinutesAgo);
  }

  private updateHealthStatus(connectionId: string, status: ConnectionHealth, message: string): void {
    const health = this.connectionHealth.get(connectionId) || {
      status: ConnectionHealth.DISCONNECTED,
      lastCheck: new Date(),
      message: '',
      consecutiveFailures: 0,
      lastSuccessfulSync: undefined
    };

    health.status = status;
    health.message = message;
    health.lastCheck = new Date();

    this.connectionHealth.set(connectionId, health);
  }

  private calculateOverallAverageDuration(): number {
    const allMetrics = Array.from(this.performanceMetrics.values());
    if (allMetrics.length === 0) return 0;
    
    const totalDuration = allMetrics.reduce((sum, metrics) => sum + metrics.totalDuration, 0);
    const totalSyncs = allMetrics.reduce((sum, metrics) => sum + metrics.totalSyncs, 0);
    
    return totalSyncs > 0 ? totalDuration / totalSyncs : 0;
  }

  private getProviderStatistics(): Record<string, ProviderStats> {
    const stats: Record<string, ProviderStats> = {};
    
    // This would aggregate statistics by provider type
    Object.values(ProviderType).forEach(providerType => {
      stats[providerType] = {
        totalConnections: 0,
        activeConnections: 0,
        successRate: 0,
        averageDuration: 0
      };
    });

    return stats;
  }

  private identifyCommonErrors(patterns: ErrorPattern[]): CommonError[] {
    const errorCounts = new Map<string, number>();
    
    patterns.forEach(pattern => {
      pattern.errorCounts.forEach((count, errorType) => {
        const total = errorCounts.get(errorType) || 0;
        errorCounts.set(errorType, total + count);
      });
    });

    return Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({ errorType, count, percentage: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 errors
  }

  private generateRecommendations(commonErrors: CommonError[]): string[] {
    const recommendations: string[] = [];
    
    commonErrors.forEach(error => {
      switch (error.errorType) {
        case 'AUTHENTICATION_FAILED':
          recommendations.push('Check and refresh authentication tokens for affected accounts');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          recommendations.push('Reduce sync frequency or implement better rate limiting');
          break;
        case 'NETWORK_ERROR':
          recommendations.push('Check network connectivity and consider offline queue');
          break;
        case 'VALIDATION_ERROR':
          recommendations.push('Review content validation rules for external calendars');
          break;
      }
    });

    return recommendations;
  }

  private analyzeErrorTrends(patterns: ErrorPattern[]): ErrorTrend[] {
    // Analyze error trends over time
    return [];
  }

  private identifyCriticalIssues(patterns: ErrorPattern[]): CriticalIssue[] {
    const critical: CriticalIssue[] = [];
    
    patterns.forEach(pattern => {
      const authFailures = pattern.errorCounts.get('AUTHENTICATION_FAILED') || 0;
      if (authFailures > 5) {
        critical.push({
          type: 'authentication',
          severity: 'high',
          description: `Multiple authentication failures for connection ${pattern.connectionId}`,
          recommendation: 'Immediate attention required - check account credentials'
        });
      }
    });

    return critical;
  }

  private identifySlowestConnections(metrics: PerformanceMetrics[]): ConnectionPerformance[] {
    return metrics
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5)
      .map(m => ({
        connectionId: '', // Would be filled from connection mapping
        averageDuration: m.averageDuration,
        totalSyncs: m.totalSyncs
      }));
  }

  private identifyFastestConnections(metrics: PerformanceMetrics[]): ConnectionPerformance[] {
    return metrics
      .filter(m => m.totalSyncs > 5) // Only consider connections with sufficient data
      .sort((a, b) => a.averageDuration - b.averageDuration)
      .slice(0, 5)
      .map(m => ({
        connectionId: '', // Would be filled from connection mapping
        averageDuration: m.averageDuration,
        totalSyncs: m.totalSyncs
      }));
  }

  private analyzePerformanceTrends(): PerformanceTrend[] {
    // Analyze performance trends over time
    return [];
  }

  private estimateResourceUsage(): ResourceUsage {
    const totalConnections = this.connectionHealth.size;
    const estimatedMemoryMB = totalConnections * 2; // Rough estimate: 2MB per connection
    const estimatedCpuPercent = Math.min(totalConnections * 0.5, 10); // Max 10% CPU
    
    return {
      memoryUsageMB: estimatedMemoryMB,
      cpuUsagePercent: estimatedCpuPercent,
      networkBandwidthKbps: totalConnections * 10, // Rough estimate
      storageUsageMB: totalConnections * 5 // Rough estimate for sync metadata
    };
  }

  private generateOptimizationSuggestions(metrics: PerformanceMetrics[]): string[] {
    const suggestions: string[] = [];
    
    const slowConnections = metrics.filter(m => m.averageDuration > 30000); // > 30 seconds
    if (slowConnections.length > 0) {
      suggestions.push(`${slowConnections.length} connections are syncing slowly - consider reducing sync frequency`);
    }

    const highVolumeConnections = metrics.filter(m => m.averageEventsPerSync > 100);
    if (highVolumeConnections.length > 0) {
      suggestions.push(`${highVolumeConnections.length} connections process many events - consider implementing pagination`);
    }

    return suggestions;
  }
}

// Type definitions
interface SyncHistoryEntry {
  timestamp: Date;
  success: boolean;
  duration: number;
  eventsProcessed: number;
  errorCount: number;
  conflictCount: number;
}

interface ConnectionHealthStatus {
  status: ConnectionHealth;
  lastCheck: Date;
  message: string;
  consecutiveFailures: number;
  lastSuccessfulSync?: Date;
}

interface PerformanceMetrics {
  totalSyncs: number;
  totalDuration: number;
  totalEvents: number;
  averageDuration: number;
  averageEventsPerSync: number;
  fastestSync: number;
  slowestSync: number;
  lastUpdated: Date;
}

interface ErrorPattern {
  connectionId: string;
  errorCounts: Map<string, number>;
  recentErrors: SyncError[];
  firstSeen: Date;
  lastSeen: Date;
}

interface SyncStatus {
  connectionId: string;
  lastSyncTime?: Date;
  lastSyncSuccess: boolean;
  health: ConnectionHealth;
  totalSyncs: number;
  successRate: number;
  averageDuration: number;
  averageEventsPerSync: number;
  recentErrors: SyncError[];
  nextScheduledSync?: Date;
}

interface SyncStatistics {
  totalConnections: number;
  activeConnections: number;
  totalSyncs: number;
  successfulSyncs: number;
  overallSuccessRate: number;
  totalErrors: number;
  totalConflicts: number;
  averageSyncDuration: number;
  providerStatistics: Record<string, ProviderStats>;
}

interface ProviderStats {
  totalConnections: number;
  activeConnections: number;
  successRate: number;
  averageDuration: number;
}

interface ErrorAnalysis {
  commonErrors: CommonError[];
  recommendations: string[];
  errorTrends: ErrorTrend[];
  criticalIssues: CriticalIssue[];
}

interface CommonError {
  errorType: string;
  count: number;
  percentage: number;
}

interface ErrorTrend {
  errorType: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

interface CriticalIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

interface PerformanceInsights {
  slowestConnections: ConnectionPerformance[];
  fastestConnections: ConnectionPerformance[];
  performanceTrends: PerformanceTrend[];
  resourceUsage: ResourceUsage;
  optimizationSuggestions: string[];
}

interface ConnectionPerformance {
  connectionId: string;
  averageDuration: number;
  totalSyncs: number;
}

interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changePercent: number;
}

interface ResourceUsage {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkBandwidthKbps: number;
  storageUsageMB: number;
}