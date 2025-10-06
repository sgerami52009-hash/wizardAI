// System Initializer for Scheduling System
// Main entry point for system initialization and startup

import { DeploymentManager, DEFAULT_JETSON_DEPLOYMENT_CONFIG } from './deployment-manager'
import { SystemMonitor, DEFAULT_MONITORING_CONFIG } from './system-monitor'
import { SchedulingSystemOrchestrator } from './system-orchestrator'
import { scheduleEventBus } from './events'
import { CalendarError } from './errors'

export interface InitializationOptions {
  // Deployment options
  skipDeployment?: boolean
  deploymentConfigPath?: string
  
  // Monitoring options
  enableMonitoring?: boolean
  monitoringConfigPath?: string
  
  // System options
  enableAutoRecovery?: boolean
  enableChildSafety?: boolean
  enablePerformanceOptimization?: boolean
  
  // Development options
  developmentMode?: boolean
  enableDebugLogging?: boolean
  mockExternalServices?: boolean
}

export interface SystemStatus {
  isInitialized: boolean
  isRunning: boolean
  isHealthy: boolean
  deploymentStatus: string
  monitoringStatus: string
  lastHealthCheck?: Date
  errors: string[]
  warnings: string[]
}

export class SystemInitializer {
  private deploymentManager: DeploymentManager
  private systemMonitor: SystemMonitor
  private orchestrator?: SchedulingSystemOrchestrator
  private options: InitializationOptions
  private systemStatus: SystemStatus
  
  constructor(options: InitializationOptions = {}) {
    this.options = {
      skipDeployment: false,
      enableMonitoring: true,
      enableAutoRecovery: true,
      enableChildSafety: true,
      enablePerformanceOptimization: true,
      developmentMode: false,
      enableDebugLogging: false,
      mockExternalServices: false,
      ...options
    }
    
    // Initialize deployment manager
    this.deploymentManager = new DeploymentManager(DEFAULT_JETSON_DEPLOYMENT_CONFIG)
    
    // Initialize system monitor
    this.systemMonitor = new SystemMonitor(DEFAULT_MONITORING_CONFIG)
    
    // Initialize system status
    this.systemStatus = {
      isInitialized: false,
      isRunning: false,
      isHealthy: false,
      deploymentStatus: 'not_started',
      monitoringStatus: 'not_started',
      errors: [],
      warnings: []
    }
    
    this.setupEventListeners()
  }

  /**
   * Initialize the entire scheduling system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Starting scheduling system initialization...')
      console.log('Options:', this.options)
      
      // Phase 1: Deployment (if not skipped)
      if (!this.options.skipDeployment) {
        await this.runDeployment()
      } else {
        console.log('Skipping deployment phase')
        this.systemStatus.deploymentStatus = 'skipped'
      }
      
      // Phase 2: System initialization
      await this.initializeSystem()
      
      // Phase 3: Start monitoring (if enabled)
      if (this.options.enableMonitoring) {
        await this.startMonitoring()
      } else {
        console.log('Monitoring disabled')
        this.systemStatus.monitoringStatus = 'disabled'
      }
      
      // Phase 4: Final health check
      await this.performInitialHealthCheck()
      
      this.systemStatus.isInitialized = true
      this.systemStatus.isRunning = true
      
      console.log('Scheduling system initialization completed successfully')
      
      // Emit system ready event
      scheduleEventBus.emit('system:ready', {
        status: this.systemStatus,
        timestamp: new Date()
      })
      
    } catch (error) {
      this.systemStatus.errors.push((error as Error).message)
      console.error('System initialization failed:', error)
      
      // Attempt cleanup
      await this.cleanup()
      
      throw new CalendarError(
        'System initialization failed',
        'SYSTEM_INITIALIZATION_FAILED',
        { cause: error as Error }
      )
    }
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down scheduling system...')
      
      // Stop monitoring
      if (this.systemMonitor) {
        await this.systemMonitor.stopMonitoring()
        this.systemStatus.monitoringStatus = 'stopped'
      }
      
      // Shutdown orchestrator
      if (this.orchestrator) {
        await this.orchestrator.shutdown()
      }
      
      // Shutdown deployment manager
      if (this.deploymentManager) {
        await this.deploymentManager.shutdownDeployedSystem()
      }
      
      this.systemStatus.isRunning = false
      
      console.log('System shutdown completed')
      
      scheduleEventBus.emit('system:shutdown', {
        status: this.systemStatus,
        timestamp: new Date()
      })
      
    } catch (error) {
      console.error('Error during system shutdown:', error)
      throw error
    }
  }

  /**
   * Restart the system
   */
  async restart(): Promise<void> {
    console.log('Restarting scheduling system...')
    
    await this.shutdown()
    
    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    await this.initialize()
  }

  /**
   * Get current system status
   */
  getSystemStatus(): SystemStatus {
    return { ...this.systemStatus }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<any> {
    if (this.orchestrator) {
      return await this.orchestrator.getSystemHealth()
    }
    
    return {
      status: 'not_initialized',
      message: 'System not initialized'
    }
  }

  /**
   * Perform system recovery
   */
  async recoverSystem(): Promise<void> {
    try {
      console.log('Starting system recovery...')
      
      if (this.orchestrator) {
        await this.orchestrator.recoverSystem()
      }
      
      // Clear previous errors
      this.systemStatus.errors = []
      this.systemStatus.isHealthy = true
      
      console.log('System recovery completed')
      
    } catch (error) {
      console.error('System recovery failed:', error)
      throw error
    }
  }

  /**
   * Update system configuration
   */
  async updateConfiguration(updates: any): Promise<void> {
    if (this.deploymentManager) {
      await this.deploymentManager.updateSystemConfiguration(updates)
    }
  }

  /**
   * Create user profile
   */
  async createUserProfile(userId: string, preferences?: any): Promise<void> {
    if (this.deploymentManager) {
      await this.deploymentManager.createDefaultUserProfile(userId, preferences)
    }
  }

  /**
   * Run system diagnostics
   */
  async runDiagnostics(): Promise<any> {
    const diagnostics = {
      timestamp: new Date(),
      systemStatus: this.systemStatus,
      health: await this.getSystemHealth(),
      metrics: this.systemMonitor ? await this.systemMonitor.getCurrentMetrics() : null,
      deployment: this.deploymentManager ? this.deploymentManager.getDeploymentStatus() : null
    }
    
    return diagnostics
  }

  private async runDeployment(): Promise<void> {
    console.log('Starting system deployment...')
    this.systemStatus.deploymentStatus = 'running'
    
    try {
      await this.deploymentManager.deploy()
      this.systemStatus.deploymentStatus = 'completed'
      console.log('System deployment completed')
      
    } catch (error) {
      this.systemStatus.deploymentStatus = 'failed'
      this.systemStatus.errors.push(`Deployment failed: ${(error as Error).message}`)
      throw error
    }
  }

  private async initializeSystem(): Promise<void> {
    console.log('Initializing system orchestrator...')
    
    try {
      this.orchestrator = await this.deploymentManager.initializeDeployedSystem()
      console.log('System orchestrator initialized')
      
    } catch (error) {
      this.systemStatus.errors.push(`System initialization failed: ${(error as Error).message}`)
      throw error
    }
  }

  private async startMonitoring(): Promise<void> {
    console.log('Starting system monitoring...')
    this.systemStatus.monitoringStatus = 'starting'
    
    try {
      await this.systemMonitor.startMonitoring()
      this.systemStatus.monitoringStatus = 'running'
      console.log('System monitoring started')
      
    } catch (error) {
      this.systemStatus.monitoringStatus = 'failed'
      this.systemStatus.warnings.push(`Monitoring failed to start: ${(error as Error).message}`)
      console.warn('Failed to start monitoring:', error)
    }
  }

  private async performInitialHealthCheck(): Promise<void> {
    console.log('Performing initial health check...')
    
    try {
      const health = await this.getSystemHealth()
      this.systemStatus.isHealthy = health.status === 'healthy'
      this.systemStatus.lastHealthCheck = new Date()
      
      if (!this.systemStatus.isHealthy) {
        this.systemStatus.warnings.push(`System health check warning: ${health.status}`)
      }
      
      console.log(`Initial health check completed: ${health.status}`)
      
    } catch (error) {
      this.systemStatus.isHealthy = false
      this.systemStatus.warnings.push(`Health check failed: ${(error as Error).message}`)
      console.warn('Initial health check failed:', error)
    }
  }

  private async cleanup(): Promise<void> {
    console.log('Performing cleanup after initialization failure...')
    
    try {
      if (this.systemMonitor) {
        await this.systemMonitor.stopMonitoring()
      }
      
      if (this.orchestrator) {
        await this.orchestrator.shutdown()
      }
      
      if (this.deploymentManager) {
        await this.deploymentManager.shutdownDeployedSystem()
      }
      
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }

  private setupEventListeners(): void {
    // Listen for deployment progress
    this.deploymentManager.on('deploymentProgress', (status) => {
      console.log(`Deployment progress: ${status.progress}% - ${status.currentStep}`)
    })
    
    // Listen for monitoring events
    this.systemMonitor.on('criticalHealthIssue', async (health) => {
      console.error('Critical health issue detected:', health)
      this.systemStatus.isHealthy = false
      
      if (this.options.enableAutoRecovery) {
        try {
          await this.recoverSystem()
        } catch (error) {
          console.error('Auto-recovery failed:', error)
        }
      }
    })
    
    this.systemMonitor.on('performanceWarning', (warning) => {
      console.warn('Performance warning:', warning)
      this.systemStatus.warnings.push(`Performance warning: ${warning.type} = ${warning.value}`)
    })
    
    // Listen for system events
    scheduleEventBus.on('system:error', (data) => {
      console.error('System error:', data)
      this.systemStatus.errors.push(data.errorMessage || 'Unknown system error')
    })
    
    scheduleEventBus.on('system:health:critical', async (health) => {
      console.error('Critical system health:', health)
      this.systemStatus.isHealthy = false
      
      if (this.options.enableAutoRecovery) {
        try {
          await this.recoverSystem()
        } catch (error) {
          console.error('Auto-recovery failed:', error)
        }
      }
    })
  }
}

/**
 * Main entry point for the scheduling system
 */
export async function startSchedulingSystem(options?: InitializationOptions): Promise<SystemInitializer> {
  const initializer = new SystemInitializer(options)
  
  // Handle process signals for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...')
    try {
      await initializer.shutdown()
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      process.exit(1)
    }
  })
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...')
    try {
      await initializer.shutdown()
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      process.exit(1)
    }
  })
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error)
    try {
      await initializer.shutdown()
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError)
    }
    process.exit(1)
  })
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled promise rejection:', reason)
    try {
      await initializer.shutdown()
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError)
    }
    process.exit(1)
  })
  
  await initializer.initialize()
  return initializer
}

// Export for CLI usage
if (require.main === module) {
  const options: InitializationOptions = {
    developmentMode: process.env.NODE_ENV === 'development',
    enableDebugLogging: process.env.DEBUG === 'true',
    skipDeployment: process.env.SKIP_DEPLOYMENT === 'true',
    enableMonitoring: process.env.ENABLE_MONITORING !== 'false'
  }
  
  startSchedulingSystem(options)
    .then(() => {
      console.log('Scheduling system started successfully')
    })
    .catch((error) => {
      console.error('Failed to start scheduling system:', error)
      process.exit(1)
    })
}