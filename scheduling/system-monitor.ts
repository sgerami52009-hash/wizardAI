// System Monitor for Scheduling System
// Provides health monitoring, performance tracking, and maintenance tools

import { EventEmitter } from 'events'
import { scheduleEventBus } from './events'
import { CalendarError } from './errors'
import { SystemHealth, HealthStatus, ComponentHealth, PerformanceMetrics } from './types'

export interface MonitoringConfig {
  // Monitoring intervals
  healthCheckInterval: number // seconds
  performanceCheckInterval: number // seconds
  logRotationInterval: number // hours
  backupInterval: number // hours
  
  // Thresholds
  memoryWarningThreshold: number // percentage
  memoryErrorThreshold: number // percentage
  cpuWarningThreshold: number // percentage
  cpuErrorThreshold: number // percentage
  diskWarningThreshold: number // percentage
  diskErrorThreshold: number // percentage
  responseTimeWarningThreshold: number // milliseconds
  responseTimeErrorThreshold: number // milliseconds
  
  // Alerting
  enableEmailAlerts: boolean
  enableSMSAlerts: boolean
  alertRecipients: string[]
  
  // Logging
  logLevel: LogLevel
  maxLogFileSize: number // MB
  maxLogFiles: number
  enableRemoteLogging: boolean
  remoteLogEndpoint?: string
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface SystemMetrics {
  timestamp: Date
  
  // System resources
  memoryUsage: MemoryMetrics
  cpuUsage: CPUMetrics
  diskUsage: DiskMetrics
  networkUsage: NetworkMetrics
  
  // Application metrics
  activeReminders: number
  activeEvents: number
  syncConnections: number
  familyMembers: number
  
  // Performance metrics
  averageResponseTime: number
  requestsPerSecond: number
  errorRate: number
  uptime: number
  
  // Health indicators
  componentHealth: ComponentHealth[]
  overallHealth: HealthStatus
}

export interface MemoryMetrics {
  total: number // MB
  used: number // MB
  free: number // MB
  cached: number // MB
  buffers: number // MB
  usagePercentage: number
}

export interface CPUMetrics {
  cores: number
  usage: number // percentage
  loadAverage: number[]
  temperature?: number // Celsius
  frequency?: number // MHz
}

export interface DiskMetrics {
  total: number // GB
  used: number // GB
  free: number // GB
  usagePercentage: number
  ioReadRate: number // MB/s
  ioWriteRate: number // MB/s
}

export interface NetworkMetrics {
  bytesReceived: number
  bytesSent: number
  packetsReceived: number
  packetsSent: number
  connectionCount: number
  bandwidth: number // Mbps
}

export interface MaintenanceTask {
  id: string
  name: string
  description: string
  schedule: string // cron expression
  lastRun?: Date
  nextRun: Date
  enabled: boolean
  priority: MaintenancePriority
  estimatedDuration: number // minutes
}

export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class SystemMonitor extends EventEmitter {
  private config: MonitoringConfig
  private isMonitoring: boolean = false
  private healthCheckTimer?: NodeJS.Timeout
  private performanceTimer?: NodeJS.Timeout
  private maintenanceTimer?: NodeJS.Timeout
  private metricsHistory: SystemMetrics[] = []
  private maintenanceTasks: MaintenanceTask[] = []
  
  constructor(config: MonitoringConfig) {
    super()
    this.config = config
    this.initializeMaintenanceTasks()
  }

  /**
   * Start system monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return
    }

    try {
      console.log('Starting system monitoring...')
      
      // Start health checks
      this.healthCheckTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.healthCheckInterval * 1000
      )
      
      // Start performance monitoring
      this.performanceTimer = setInterval(
        () => this.collectPerformanceMetrics(),
        this.config.performanceCheckInterval * 1000
      )
      
      // Start maintenance scheduler
      this.maintenanceTimer = setInterval(
        () => this.runScheduledMaintenance(),
        60000 // Check every minute
      )
      
      this.isMonitoring = true
      
      // Perform initial checks
      await this.performHealthCheck()
      await this.collectPerformanceMetrics()
      
      this.emit('monitoringStarted')
      console.log('System monitoring started successfully')
      
    } catch (error) {
      throw new CalendarError(
        'Failed to start system monitoring',
        'MONITORING_START_FAILED',
        { cause: error as Error }
      )
    }
  }

  /**
   * Stop system monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return
    }

    console.log('Stopping system monitoring...')
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer)
    }
    
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer)
    }
    
    this.isMonitoring = false
    this.emit('monitoringStopped')
    console.log('System monitoring stopped')
  }

  /**
   * Get current system metrics
   */
  async getCurrentMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      memoryUsage: await this.getMemoryMetrics(),
      cpuUsage: await this.getCPUMetrics(),
      diskUsage: await this.getDiskMetrics(),
      networkUsage: await this.getNetworkMetrics(),
      activeReminders: await this.getActiveRemindersCount(),
      activeEvents: await this.getActiveEventsCount(),
      syncConnections: await this.getSyncConnectionsCount(),
      familyMembers: await this.getFamilyMembersCount(),
      averageResponseTime: await this.getAverageResponseTime(),
      requestsPerSecond: await this.getRequestsPerSecond(),
      errorRate: await this.getErrorRate(),
      uptime: await this.getSystemUptime(),
      componentHealth: await this.getComponentHealth(),
      overallHealth: HealthStatus.HEALTHY
    }
    
    // Determine overall health
    metrics.overallHealth = this.determineOverallHealth(metrics)
    
    return metrics
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.metricsHistory.filter(m => m.timestamp >= cutoff)
  }

  /**
   * Get system health report
   */
  async getHealthReport(): Promise<SystemHealth> {
    const metrics = await this.getCurrentMetrics()
    
    return {
      status: metrics.overallHealth,
      components: metrics.componentHealth,
      performance: {
        memoryUsage: metrics.memoryUsage.used,
        cpuUsage: metrics.cpuUsage.usage,
        responseTime: metrics.averageResponseTime,
        activeReminders: metrics.activeReminders,
        syncConnections: metrics.syncConnections,
        errorRate: metrics.errorRate
      },
      lastCheck: metrics.timestamp
    }
  }

  /**
   * Run system maintenance
   */
  async runMaintenance(taskIds?: string[]): Promise<void> {
    const tasksToRun = taskIds 
      ? this.maintenanceTasks.filter(t => taskIds.includes(t.id) && t.enabled)
      : this.maintenanceTasks.filter(t => t.enabled)
    
    console.log(`Running ${tasksToRun.length} maintenance tasks...`)
    
    for (const task of tasksToRun) {
      try {
        await this.runMaintenanceTask(task)
      } catch (error) {
        console.error(`Maintenance task ${task.name} failed:`, error)
        this.emit('maintenanceTaskFailed', { task, error })
      }
    }
  }

  /**
   * Add custom maintenance task
   */
  addMaintenanceTask(task: Omit<MaintenanceTask, 'nextRun'>): void {
    const fullTask: MaintenanceTask = {
      ...task,
      nextRun: this.calculateNextRun(task.schedule)
    }
    
    this.maintenanceTasks.push(fullTask)
    this.emit('maintenanceTaskAdded', fullTask)
  }

  /**
   * Remove maintenance task
   */
  removeMaintenanceTask(taskId: string): void {
    const index = this.maintenanceTasks.findIndex(t => t.id === taskId)
    if (index >= 0) {
      const task = this.maintenanceTasks.splice(index, 1)[0]
      this.emit('maintenanceTaskRemoved', task)
    }
  }

  /**
   * Get maintenance tasks
   */
  getMaintenanceTasks(): MaintenanceTask[] {
    return [...this.maintenanceTasks]
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.getHealthReport()
      
      // Check for critical issues
      if (health.status === HealthStatus.CRITICAL) {
        this.emit('criticalHealthIssue', health)
        await this.sendAlert('Critical system health issue detected', health)
      } else if (health.status === HealthStatus.ERROR) {
        this.emit('healthError', health)
        await this.sendAlert('System health error detected', health)
      } else if (health.status === HealthStatus.WARNING) {
        this.emit('healthWarning', health)
      }
      
      scheduleEventBus.emit('system:health:check', health)
      
    } catch (error) {
      console.error('Health check failed:', error)
      this.emit('healthCheckFailed', error)
    }
  }

  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics()
      
      // Store metrics in history
      this.metricsHistory.push(metrics)
      
      // Keep only last 24 hours of metrics
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoff)
      
      // Check performance thresholds
      await this.checkPerformanceThresholds(metrics)
      
      this.emit('metricsCollected', metrics)
      
    } catch (error) {
      console.error('Performance metrics collection failed:', error)
      this.emit('metricsCollectionFailed', error)
    }
  }

  private async checkPerformanceThresholds(metrics: SystemMetrics): Promise<void> {
    // Memory usage checks
    if (metrics.memoryUsage.usagePercentage >= this.config.memoryErrorThreshold) {
      await this.sendAlert('Critical memory usage', { usage: metrics.memoryUsage.usagePercentage })
    } else if (metrics.memoryUsage.usagePercentage >= this.config.memoryWarningThreshold) {
      this.emit('performanceWarning', { type: 'memory', value: metrics.memoryUsage.usagePercentage })
    }
    
    // CPU usage checks
    if (metrics.cpuUsage.usage >= this.config.cpuErrorThreshold) {
      await this.sendAlert('Critical CPU usage', { usage: metrics.cpuUsage.usage })
    } else if (metrics.cpuUsage.usage >= this.config.cpuWarningThreshold) {
      this.emit('performanceWarning', { type: 'cpu', value: metrics.cpuUsage.usage })
    }
    
    // Disk usage checks
    if (metrics.diskUsage.usagePercentage >= this.config.diskErrorThreshold) {
      await this.sendAlert('Critical disk usage', { usage: metrics.diskUsage.usagePercentage })
    } else if (metrics.diskUsage.usagePercentage >= this.config.diskWarningThreshold) {
      this.emit('performanceWarning', { type: 'disk', value: metrics.diskUsage.usagePercentage })
    }
    
    // Response time checks
    if (metrics.averageResponseTime >= this.config.responseTimeErrorThreshold) {
      await this.sendAlert('Critical response time', { responseTime: metrics.averageResponseTime })
    } else if (metrics.averageResponseTime >= this.config.responseTimeWarningThreshold) {
      this.emit('performanceWarning', { type: 'responseTime', value: metrics.averageResponseTime })
    }
  }

  private async runScheduledMaintenance(): Promise<void> {
    const now = new Date()
    const tasksToRun = this.maintenanceTasks.filter(task => 
      task.enabled && task.nextRun <= now
    )
    
    for (const task of tasksToRun) {
      try {
        await this.runMaintenanceTask(task)
        task.nextRun = this.calculateNextRun(task.schedule)
      } catch (error) {
        console.error(`Scheduled maintenance task ${task.name} failed:`, error)
      }
    }
  }

  private async runMaintenanceTask(task: MaintenanceTask): Promise<void> {
    console.log(`Running maintenance task: ${task.name}`)
    task.lastRun = new Date()
    
    this.emit('maintenanceTaskStarted', task)
    
    try {
      switch (task.id) {
        case 'log-rotation':
          await this.rotateLogFiles()
          break
        case 'database-cleanup':
          await this.cleanupDatabase()
          break
        case 'backup-creation':
          await this.createBackup()
          break
        case 'cache-cleanup':
          await this.cleanupCache()
          break
        case 'performance-optimization':
          await this.optimizePerformance()
          break
        case 'security-scan':
          await this.runSecurityScan()
          break
        default:
          console.warn(`Unknown maintenance task: ${task.id}`)
      }
      
      this.emit('maintenanceTaskCompleted', task)
      console.log(`Maintenance task completed: ${task.name}`)
      
    } catch (error) {
      this.emit('maintenanceTaskFailed', { task, error })
      throw error
    }
  }

  private async getMemoryMetrics(): Promise<MemoryMetrics> {
    // Mock implementation - in real system would use actual system calls
    return {
      total: 8192, // 8GB
      used: 2048, // 2GB
      free: 6144, // 6GB
      cached: 512, // 512MB
      buffers: 256, // 256MB
      usagePercentage: 25
    }
  }

  private async getCPUMetrics(): Promise<CPUMetrics> {
    // Mock implementation
    return {
      cores: 6,
      usage: 35,
      loadAverage: [0.5, 0.7, 0.8],
      temperature: 45,
      frequency: 1479
    }
  }

  private async getDiskMetrics(): Promise<DiskMetrics> {
    // Mock implementation
    return {
      total: 64, // 64GB
      used: 32, // 32GB
      free: 32, // 32GB
      usagePercentage: 50,
      ioReadRate: 50, // 50 MB/s
      ioWriteRate: 25 // 25 MB/s
    }
  }

  private async getNetworkMetrics(): Promise<NetworkMetrics> {
    // Mock implementation
    return {
      bytesReceived: 1024000,
      bytesSent: 512000,
      packetsReceived: 1000,
      packetsSent: 800,
      connectionCount: 5,
      bandwidth: 100 // 100 Mbps
    }
  }

  private async getActiveRemindersCount(): Promise<number> {
    // Mock implementation
    return 25
  }

  private async getActiveEventsCount(): Promise<number> {
    // Mock implementation
    return 15
  }

  private async getSyncConnectionsCount(): Promise<number> {
    // Mock implementation
    return 3
  }

  private async getFamilyMembersCount(): Promise<number> {
    // Mock implementation
    return 4
  }

  private async getAverageResponseTime(): Promise<number> {
    // Mock implementation
    return 150 // 150ms
  }

  private async getRequestsPerSecond(): Promise<number> {
    // Mock implementation
    return 10
  }

  private async getErrorRate(): Promise<number> {
    // Mock implementation
    return 0.5 // 0.5%
  }

  private async getSystemUptime(): Promise<number> {
    // Mock implementation - return uptime in seconds
    return 86400 // 24 hours
  }

  private async getComponentHealth(): Promise<ComponentHealth[]> {
    // Mock implementation
    return [
      {
        name: 'CalendarManager',
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        metrics: { responseTime: 50, memoryUsage: 128 },
        errors: []
      },
      {
        name: 'ReminderEngine',
        status: HealthStatus.HEALTHY,
        lastCheck: new Date(),
        metrics: { activeReminders: 25, processingTime: 10 },
        errors: []
      },
      {
        name: 'ExternalSync',
        status: HealthStatus.WARNING,
        lastCheck: new Date(),
        metrics: { syncConnections: 3, lastSyncTime: 300 },
        errors: ['Google Calendar sync delayed']
      }
    ]
  }

  private determineOverallHealth(metrics: SystemMetrics): HealthStatus {
    // Check for critical conditions
    if (metrics.memoryUsage.usagePercentage >= this.config.memoryErrorThreshold ||
        metrics.cpuUsage.usage >= this.config.cpuErrorThreshold ||
        metrics.diskUsage.usagePercentage >= this.config.diskErrorThreshold) {
      return HealthStatus.CRITICAL
    }
    
    // Check for error conditions
    const errorComponents = metrics.componentHealth.filter(c => c.status === HealthStatus.ERROR)
    if (errorComponents.length > 0) {
      return HealthStatus.ERROR
    }
    
    // Check for warning conditions
    if (metrics.memoryUsage.usagePercentage >= this.config.memoryWarningThreshold ||
        metrics.cpuUsage.usage >= this.config.cpuWarningThreshold ||
        metrics.diskUsage.usagePercentage >= this.config.diskWarningThreshold) {
      return HealthStatus.WARNING
    }
    
    const warningComponents = metrics.componentHealth.filter(c => c.status === HealthStatus.WARNING)
    if (warningComponents.length > 0) {
      return HealthStatus.WARNING
    }
    
    return HealthStatus.HEALTHY
  }

  private async sendAlert(message: string, data: any): Promise<void> {
    console.log(`ALERT: ${message}`, data)
    
    // In real implementation, would send actual alerts
    if (this.config.enableEmailAlerts) {
      // Send email alert
    }
    
    if (this.config.enableSMSAlerts) {
      // Send SMS alert
    }
    
    this.emit('alertSent', { message, data })
  }

  private initializeMaintenanceTasks(): void {
    this.maintenanceTasks = [
      {
        id: 'log-rotation',
        name: 'Log File Rotation',
        description: 'Rotate and compress old log files',
        schedule: '0 2 * * *', // Daily at 2 AM
        nextRun: this.calculateNextRun('0 2 * * *'),
        enabled: true,
        priority: MaintenancePriority.MEDIUM,
        estimatedDuration: 5
      },
      {
        id: 'database-cleanup',
        name: 'Database Cleanup',
        description: 'Clean up old data and optimize database',
        schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
        nextRun: this.calculateNextRun('0 3 * * 0'),
        enabled: true,
        priority: MaintenancePriority.HIGH,
        estimatedDuration: 30
      },
      {
        id: 'backup-creation',
        name: 'System Backup',
        description: 'Create system and data backups',
        schedule: '0 1 * * *', // Daily at 1 AM
        nextRun: this.calculateNextRun('0 1 * * *'),
        enabled: true,
        priority: MaintenancePriority.HIGH,
        estimatedDuration: 15
      },
      {
        id: 'cache-cleanup',
        name: 'Cache Cleanup',
        description: 'Clear temporary files and caches',
        schedule: '0 4 * * *', // Daily at 4 AM
        nextRun: this.calculateNextRun('0 4 * * *'),
        enabled: true,
        priority: MaintenancePriority.LOW,
        estimatedDuration: 10
      },
      {
        id: 'performance-optimization',
        name: 'Performance Optimization',
        description: 'Optimize system performance and memory usage',
        schedule: '0 5 * * 0', // Weekly on Sunday at 5 AM
        nextRun: this.calculateNextRun('0 5 * * 0'),
        enabled: true,
        priority: MaintenancePriority.MEDIUM,
        estimatedDuration: 20
      },
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'Run security checks and vulnerability scans',
        schedule: '0 6 * * 0', // Weekly on Sunday at 6 AM
        nextRun: this.calculateNextRun('0 6 * * 0'),
        enabled: true,
        priority: MaintenancePriority.HIGH,
        estimatedDuration: 45
      }
    ]
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser - in real implementation would use a proper cron library
    const now = new Date()
    const nextRun = new Date(now)
    nextRun.setDate(nextRun.getDate() + 1) // Default to tomorrow
    return nextRun
  }

  private async rotateLogFiles(): Promise<void> {
    console.log('Rotating log files...')
    // Implementation would rotate actual log files
  }

  private async cleanupDatabase(): Promise<void> {
    console.log('Cleaning up database...')
    // Implementation would clean up old database records
  }

  private async createBackup(): Promise<void> {
    console.log('Creating system backup...')
    // Implementation would create actual backups
  }

  private async cleanupCache(): Promise<void> {
    console.log('Cleaning up cache...')
    // Implementation would clear temporary files and caches
  }

  private async optimizePerformance(): Promise<void> {
    console.log('Optimizing performance...')
    // Implementation would run performance optimizations
  }

  private async runSecurityScan(): Promise<void> {
    console.log('Running security scan...')
    // Implementation would run security checks
  }
}

// Default monitoring configuration for Jetson Nano Orin
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  healthCheckInterval: 30, // 30 seconds
  performanceCheckInterval: 60, // 1 minute
  logRotationInterval: 24, // 24 hours
  backupInterval: 24, // 24 hours
  
  memoryWarningThreshold: 80, // 80%
  memoryErrorThreshold: 95, // 95%
  cpuWarningThreshold: 70, // 70%
  cpuErrorThreshold: 90, // 90%
  diskWarningThreshold: 80, // 80%
  diskErrorThreshold: 95, // 95%
  responseTimeWarningThreshold: 1000, // 1 second
  responseTimeErrorThreshold: 5000, // 5 seconds
  
  enableEmailAlerts: false,
  enableSMSAlerts: false,
  alertRecipients: [],
  
  logLevel: LogLevel.INFO,
  maxLogFileSize: 100, // 100MB
  maxLogFiles: 10,
  enableRemoteLogging: false
}