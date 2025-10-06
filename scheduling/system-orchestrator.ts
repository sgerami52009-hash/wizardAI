// Scheduling System Orchestrator - Coordinates all scheduling components
// Provides system lifecycle management, health monitoring, and configuration

import { EventEmitter } from 'events'
import { scheduleEventBus, ScheduleEventBus } from './events'
import { 
  SchedulingError, 
  ErrorRecoveryManager, 
  CalendarError, 
  ReminderError, 
  FamilyCoordinationError 
} from './errors'
import { 
  SystemHealth,
  HealthStatus,
  ComponentHealth,
  PerformanceMetrics
} from './types'
import { CalendarManager } from '../calendar/manager'
import { ReminderEngine } from '../reminders/engine'
import { FamilyCoordinator } from './family-coordinator'
import { ExternalCalendarSync } from '../sync/external-calendar-sync'
import { SafetyValidator } from './safety-validator'
import { PerformanceMonitor } from './performance-monitor'
import { ContextAnalyzer } from '../reminders/context-analyzer'
import { NotificationDispatcher } from '../reminders/notification-dispatcher'

export interface SystemConfiguration {
  // Memory and performance limits
  maxMemoryUsage: number // MB
  maxActiveReminders: number
  maxSyncConnections: number
  
  // Child safety settings
  enableContentValidation: boolean
  parentalControlsEnabled: boolean
  ageAppropriateMode: boolean
  
  // Feature toggles
  enableVoiceIntegration: boolean
  enableAvatarIntegration: boolean
  enableExternalSync: boolean
  enableFamilyCoordination: boolean
  
  // Performance settings
  reminderProcessingInterval: number // milliseconds
  syncInterval: number // minutes
  healthCheckInterval: number // seconds
  
  // Hardware optimization
  jetsonNanoOptimizations: boolean
  lowPowerMode: boolean
  backgroundProcessingEnabled: boolean
}

export interface ComponentRegistry {
  calendarManager: CalendarManager
  reminderEngine: ReminderEngine
  familyCoordinator: FamilyCoordinator
  externalSync: ExternalCalendarSync
  safetyValidator: SafetyValidator
  performanceMonitor: PerformanceMonitor
  contextAnalyzer: ContextAnalyzer
  notificationDispatcher: NotificationDispatcher
}

export interface SystemLifecycleHooks {
  onInitialize?: () => Promise<void>
  onShutdown?: () => Promise<void>
  onHealthCheck?: (health: SystemHealth) => Promise<void>
  onError?: (error: SchedulingError) => Promise<void>
  onPerformanceWarning?: (metrics: PerformanceMetrics) => Promise<void>
}

export class SchedulingSystemOrchestrator extends EventEmitter {
  private config: SystemConfiguration
  private components: ComponentRegistry
  private eventBus: ScheduleEventBus
  private errorRecoveryManager: ErrorRecoveryManager
  private lifecycleHooks: SystemLifecycleHooks
  
  private isInitialized: boolean = false
  private isShuttingDown: boolean = false
  private healthCheckTimer?: NodeJS.Timeout
  private performanceTimer?: NodeJS.Timeout
  
  constructor(
    config: SystemConfiguration,
    components: ComponentRegistry,
    eventBus: ScheduleEventBus = scheduleEventBus,
    errorRecoveryManager: ErrorRecoveryManager,
    lifecycleHooks: SystemLifecycleHooks = {}
  ) {
    super()
    
    this.config = config
    this.components = components
    this.eventBus = eventBus
    this.errorRecoveryManager = errorRecoveryManager
    this.lifecycleHooks = lifecycleHooks
    
    this.setupEventListeners()
  }

  /**
   * Initialize the entire scheduling system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new CalendarError('System already initialized', 'ALREADY_INITIALIZED')
    }

    try {
      console.log('Initializing scheduling system orchestrator...')
      
      // Execute pre-initialization hook
      if (this.lifecycleHooks.onInitialize) {
        await this.lifecycleHooks.onInitialize()
      }
      
      // Initialize components in dependency order
      await this.initializeComponents()
      
      // Start system monitoring
      await this.startSystemMonitoring()
      
      // Validate system health
      const health = await this.getSystemHealth()
      if (health.status === HealthStatus.CRITICAL) {
        throw new CalendarError('System failed health check', 'HEALTH_CHECK_FAILED')
      }
      
      // Start background processing
      if (this.config.backgroundProcessingEnabled) {
        await this.startBackgroundProcessing()
      }
      
      this.isInitialized = true
      
      // Emit system ready event
      this.eventBus.emit('system:initialized', {
        timestamp: new Date(),
        health,
        config: this.config
      })
      
      console.log('Scheduling system orchestrator initialized successfully')
      
    } catch (error) {
      const initError = new CalendarError(
        'Failed to initialize scheduling system',
        'SYSTEM_INITIALIZATION_FAILED',
        { cause: error as Error }
      )
      
      await this.handleSystemError(initError)
      throw initError
    }
  }

  /**
   * Gracefully shutdown the scheduling system
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true
    
    try {
      console.log('Shutting down scheduling system orchestrator...')
      
      // Stop monitoring timers
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer)
      }
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer)
      }
      
      // Stop background processing
      await this.stopBackgroundProcessing()
      
      // Shutdown components in reverse dependency order
      await this.shutdownComponents()
      
      // Execute shutdown hook
      if (this.lifecycleHooks.onShutdown) {
        await this.lifecycleHooks.onShutdown()
      }
      
      this.isInitialized = false
      this.isShuttingDown = false
      
      // Emit system shutdown event
      this.eventBus.emit('system:shutdown', {
        timestamp: new Date()
      })
      
      console.log('Scheduling system orchestrator shutdown complete')
      
    } catch (error) {
      console.error('Error during system shutdown:', error)
      this.isShuttingDown = false
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const componentHealth = await this.getComponentHealth()
      const performanceMetrics = await this.getPerformanceMetrics()
      const overallStatus = this.determineOverallHealth(componentHealth, performanceMetrics)
      
      const health: SystemHealth = {
        status: overallStatus,
        components: componentHealth,
        performance: performanceMetrics,
        lastCheck: new Date()
      }
      
      // Execute health check hook
      if (this.lifecycleHooks.onHealthCheck) {
        await this.lifecycleHooks.onHealthCheck(health)
      }
      
      return health
      
    } catch (error) {
      console.error('Error getting system health:', error)
      
      return {
        status: HealthStatus.ERROR,
        components: [],
        performance: {
          memoryUsage: 0,
          cpuUsage: 0,
          responseTime: 0,
          activeReminders: 0,
          syncConnections: 0,
          errorRate: 0
        },
        lastCheck: new Date()
      }
    }
  }

  /**
   * Update system configuration
   */
  async updateConfiguration(newConfig: Partial<SystemConfiguration>): Promise<void> {
    this.ensureInitialized()
    
    try {
      const previousConfig = { ...this.config }
      this.config = { ...this.config, ...newConfig }
      
      // Apply configuration changes to components
      await this.applyConfigurationChanges(previousConfig, this.config)
      
      this.eventBus.emit('system:configuration:updated', {
        previousConfig,
        newConfig: this.config,
        timestamp: new Date()
      })
      
    } catch (error) {
      const configError = new CalendarError(
        'Failed to update system configuration',
        'CONFIGURATION_UPDATE_FAILED',
        { cause: error as Error }
      )
      
      await this.handleSystemError(configError)
      throw configError
    }
  }

  /**
   * Trigger manual system recovery
   */
  async recoverSystem(): Promise<void> {
    this.ensureInitialized()
    
    try {
      console.log('Starting system recovery...')
      
      // Stop all processing
      await this.stopBackgroundProcessing()
      
      // Reset components
      await this.resetComponents()
      
      // Restart monitoring
      await this.startSystemMonitoring()
      
      // Restart background processing
      if (this.config.backgroundProcessingEnabled) {
        await this.startBackgroundProcessing()
      }
      
      this.eventBus.emit('system:recovery:completed', {
        timestamp: new Date()
      })
      
      console.log('System recovery completed')
      
    } catch (error) {
      const recoveryError = new CalendarError(
        'System recovery failed',
        'SYSTEM_RECOVERY_FAILED',
        { cause: error as Error }
      )
      
      await this.handleSystemError(recoveryError)
      throw recoveryError
    }
  }

  /**
   * Get current system configuration
   */
  getConfiguration(): SystemConfiguration {
    return { ...this.config }
  }

  /**
   * Check if system is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && !this.isShuttingDown
  }

  private async initializeComponents(): Promise<void> {
    console.log('Initializing system components...')
    
    // Initialize safety validator first (required by other components)
    if (this.config.enableContentValidation) {
      await this.initializeComponent('safetyValidator', this.components.safetyValidator)
    }
    
    // Initialize performance monitor
    await this.initializeComponent('performanceMonitor', this.components.performanceMonitor)
    
    // Initialize core components
    await this.initializeComponent('calendarManager', this.components.calendarManager)
    await this.initializeComponent('reminderEngine', this.components.reminderEngine)
    
    // Initialize context analyzer
    await this.initializeComponent('contextAnalyzer', this.components.contextAnalyzer)
    
    // Initialize notification dispatcher
    await this.initializeComponent('notificationDispatcher', this.components.notificationDispatcher)
    
    // Initialize optional components
    if (this.config.enableFamilyCoordination) {
      await this.initializeComponent('familyCoordinator', this.components.familyCoordinator)
    }
    
    if (this.config.enableExternalSync) {
      await this.initializeComponent('externalSync', this.components.externalSync)
    }
  }

  private async initializeComponent(name: string, component: any): Promise<void> {
    try {
      console.log(`Initializing ${name}...`)
      
      if (component && typeof component.initialize === 'function') {
        await component.initialize()
      }
      
      console.log(`${name} initialized successfully`)
      
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error)
      throw new CalendarError(
        `Component initialization failed: ${name}`,
        'COMPONENT_INITIALIZATION_FAILED',
        { component: name, cause: error as Error }
      )
    }
  }

  private async shutdownComponents(): Promise<void> {
    console.log('Shutting down system components...')
    
    const components = [
      'externalSync',
      'familyCoordinator', 
      'notificationDispatcher',
      'contextAnalyzer',
      'reminderEngine',
      'calendarManager',
      'performanceMonitor',
      'safetyValidator'
    ]
    
    for (const componentName of components) {
      try {
        const component = (this.components as any)[componentName]
        if (component && typeof component.shutdown === 'function') {
          await component.shutdown()
          console.log(`${componentName} shutdown successfully`)
        }
      } catch (error) {
        console.error(`Error shutting down ${componentName}:`, error)
      }
    }
  }

  private async resetComponents(): Promise<void> {
    console.log('Resetting system components...')
    
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (component && typeof (component as any).reset === 'function') {
          await (component as any).reset()
          console.log(`${name} reset successfully`)
        }
      } catch (error) {
        console.error(`Error resetting ${name}:`, error)
      }
    }
  }

  private async startSystemMonitoring(): Promise<void> {
    // Start health check monitoring
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getSystemHealth()
        
        if (health.status === HealthStatus.WARNING || health.status === HealthStatus.ERROR) {
          this.eventBus.emit('system:health:warning', health)
        }
        
        if (health.status === HealthStatus.CRITICAL) {
          this.eventBus.emit('system:health:critical', health)
          await this.recoverSystem()
        }
        
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, this.config.healthCheckInterval * 1000)
    
    // Start performance monitoring
    this.performanceTimer = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics()
        
        // Check for performance warnings
        if (metrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
          this.eventBus.emit('system:performance:warning', {
            component: 'System',
            metric: 'memoryUsage',
            currentValue: metrics.memoryUsage,
            threshold: this.config.maxMemoryUsage * 0.8
          })
          
          if (this.lifecycleHooks.onPerformanceWarning) {
            await this.lifecycleHooks.onPerformanceWarning(metrics)
          }
        }
        
        if (metrics.activeReminders > this.config.maxActiveReminders * 0.9) {
          this.eventBus.emit('system:performance:warning', {
            component: 'ReminderEngine',
            metric: 'activeReminders',
            currentValue: metrics.activeReminders,
            threshold: this.config.maxActiveReminders * 0.9
          })
        }
        
      } catch (error) {
        console.error('Performance monitoring failed:', error)
      }
    }, 30000) // Check every 30 seconds
  }

  private async stopBackgroundProcessing(): Promise<void> {
    // Stop reminder processing
    if (this.components.reminderEngine && typeof this.components.reminderEngine.stopProcessing === 'function') {
      await this.components.reminderEngine.stopProcessing()
    }
    
    // Stop sync operations
    if (this.components.externalSync && typeof this.components.externalSync.stopSync === 'function') {
      await this.components.externalSync.stopSync()
    }
  }

  private async startBackgroundProcessing(): Promise<void> {
    // Start reminder processing
    if (this.components.reminderEngine && typeof this.components.reminderEngine.startProcessing === 'function') {
      await this.components.reminderEngine.startProcessing()
    }
    
    // Start sync operations
    if (this.components.externalSync && typeof this.components.externalSync.startSync === 'function') {
      await this.components.externalSync.startSync()
    }
  }

  private async getComponentHealth(): Promise<ComponentHealth[]> {
    const health: ComponentHealth[] = []
    
    for (const [name, component] of Object.entries(this.components)) {
      try {
        let componentHealth: ComponentHealth
        
        if (component && typeof (component as any).getHealth === 'function') {
          componentHealth = await (component as any).getHealth()
        } else {
          // Default health check
          componentHealth = {
            name,
            status: HealthStatus.HEALTHY,
            lastCheck: new Date(),
            metrics: {},
            errors: []
          }
        }
        
        health.push(componentHealth)
        
      } catch (error) {
        health.push({
          name,
          status: HealthStatus.ERROR,
          lastCheck: new Date(),
          metrics: {},
          errors: [(error as Error).message]
        })
      }
    }
    
    return health
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      return await this.components.performanceMonitor.getMetrics()
    } catch (error) {
      console.error('Failed to get performance metrics:', error)
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        responseTime: 0,
        activeReminders: 0,
        syncConnections: 0,
        errorRate: 0
      }
    }
  }

  private determineOverallHealth(components: ComponentHealth[], performance: PerformanceMetrics): HealthStatus {
    // Check for critical component failures
    const criticalComponents = components.filter(c => c.status === HealthStatus.CRITICAL)
    if (criticalComponents.length > 0) {
      return HealthStatus.CRITICAL
    }
    
    // Check for error conditions
    const errorComponents = components.filter(c => c.status === HealthStatus.ERROR)
    if (errorComponents.length > 0) {
      return HealthStatus.ERROR
    }
    
    // Check performance thresholds
    if (performance.memoryUsage > this.config.maxMemoryUsage) {
      return HealthStatus.CRITICAL
    }
    
    if (performance.memoryUsage > this.config.maxMemoryUsage * 0.9) {
      return HealthStatus.WARNING
    }
    
    if (performance.activeReminders > this.config.maxActiveReminders) {
      return HealthStatus.WARNING
    }
    
    // Check for warning conditions
    const warningComponents = components.filter(c => c.status === HealthStatus.WARNING)
    if (warningComponents.length > 0) {
      return HealthStatus.WARNING
    }
    
    return HealthStatus.HEALTHY
  }

  private async applyConfigurationChanges(
    previousConfig: SystemConfiguration, 
    newConfig: SystemConfiguration
  ): Promise<void> {
    // Apply memory limit changes
    if (previousConfig.maxMemoryUsage !== newConfig.maxMemoryUsage) {
      this.components.performanceMonitor.updateMemoryLimit(newConfig.maxMemoryUsage)
    }
    
    // Apply reminder limit changes
    if (previousConfig.maxActiveReminders !== newConfig.maxActiveReminders) {
      this.components.reminderEngine.updateReminderLimit(newConfig.maxActiveReminders)
    }
    
    // Apply safety setting changes
    if (previousConfig.enableContentValidation !== newConfig.enableContentValidation) {
      if (newConfig.enableContentValidation && !this.components.safetyValidator) {
        throw new CalendarError('Safety validator not available', 'SAFETY_VALIDATOR_UNAVAILABLE')
      }
    }
    
    // Apply feature toggle changes
    if (previousConfig.enableFamilyCoordination !== newConfig.enableFamilyCoordination) {
      if (newConfig.enableFamilyCoordination) {
        await this.initializeComponent('familyCoordinator', this.components.familyCoordinator)
      } else {
        if (this.components.familyCoordinator && typeof this.components.familyCoordinator.shutdown === 'function') {
          await this.components.familyCoordinator.shutdown()
        }
      }
    }
  }

  private setupEventListeners(): void {
    // Listen for system errors
    this.eventBus.on('system:error', async (data) => {
      await this.handleSystemError(data.error)
    })
    
    // Listen for component errors
    this.eventBus.on('component:error', async (data) => {
      console.error(`Component error in ${data.component}:`, data.error)
      
      // Attempt component recovery
      try {
        const component = (this.components as any)[data.component]
        if (component && typeof component.recover === 'function') {
          await component.recover()
        }
      } catch (error) {
        console.error(`Failed to recover component ${data.component}:`, error)
      }
    })
    
    // Listen for performance warnings
    this.eventBus.on('system:performance:warning', (data) => {
      console.warn(`Performance warning: ${data.component} ${data.metric} = ${data.currentValue} (threshold: ${data.threshold})`)
    })
  }

  private async handleSystemError(error: SchedulingError): Promise<void> {
    try {
      await this.errorRecoveryManager.handleError(error)
      
      if (this.lifecycleHooks.onError) {
        await this.lifecycleHooks.onError(error)
      }
      
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError)
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new CalendarError('System not initialized', 'SYSTEM_NOT_INITIALIZED')
    }
    
    if (this.isShuttingDown) {
      throw new CalendarError('System is shutting down', 'SYSTEM_SHUTTING_DOWN')
    }
  }
}

// Default configuration for Jetson Nano Orin
export const DEFAULT_SYSTEM_CONFIG: SystemConfiguration = {
  // Memory and performance limits optimized for Jetson Nano Orin
  maxMemoryUsage: 1024, // 1GB limit
  maxActiveReminders: 1000,
  maxSyncConnections: 5,
  
  // Child safety enabled by default
  enableContentValidation: true,
  parentalControlsEnabled: true,
  ageAppropriateMode: true,
  
  // Feature toggles
  enableVoiceIntegration: true,
  enableAvatarIntegration: true,
  enableExternalSync: true,
  enableFamilyCoordination: true,
  
  // Performance settings optimized for embedded hardware
  reminderProcessingInterval: 5000, // 5 seconds
  syncInterval: 15, // 15 minutes
  healthCheckInterval: 30, // 30 seconds
  
  // Hardware optimization for Jetson Nano Orin
  jetsonNanoOptimizations: true,
  lowPowerMode: false,
  backgroundProcessingEnabled: true
}