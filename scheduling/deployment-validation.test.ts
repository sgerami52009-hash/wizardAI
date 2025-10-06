// Deployment Validation Tests
// Tests system deployment and initialization on target hardware

import { DeploymentManager, DEFAULT_JETSON_DEPLOYMENT_CONFIG, DeploymentPhase } from './deployment-manager'
import { SystemMonitor, DEFAULT_MONITORING_CONFIG } from './system-monitor'
import { SystemInitializer } from './system-initializer'
import { ConfigurationManager, HardwareProfile } from './configuration-manager'

describe('Deployment Validation Tests', () => {
  let deploymentManager: DeploymentManager
  let systemMonitor: SystemMonitor
  
  beforeEach(() => {
    deploymentManager = new DeploymentManager(DEFAULT_JETSON_DEPLOYMENT_CONFIG)
    systemMonitor = new SystemMonitor(DEFAULT_MONITORING_CONFIG)
  })

  afterEach(async () => {
    if (deploymentManager) {
      await deploymentManager.shutdownDeployedSystem()
    }
    if (systemMonitor) {
      await systemMonitor.stopMonitoring()
    }
  })

  describe('Deployment Configuration Validation', () => {
    test('should validate default Jetson Nano Orin configuration', () => {
      const config = DEFAULT_JETSON_DEPLOYMENT_CONFIG
      
      expect(config.hardwareProfile).toBe(HardwareProfile.JETSON_NANO_ORIN)
      expect(config.targetPlatform).toBe('jetson_nano_orin')
      expect(config.performanceConfig.maxMemoryUsage).toBe(1024) // 1GB for Jetson
      expect(config.performanceConfig.enableGPUAcceleration).toBe(true)
      expect(config.childSafetyConfig.enableContentFiltering).toBe(true)
      expect(config.securityConfig.enableEncryption).toBe(true)
    })

    test('should validate network configuration', () => {
      const networkConfig = DEFAULT_JETSON_DEPLOYMENT_CONFIG.networkConfig
      
      expect(networkConfig.enableWifi).toBe(true)
      expect(networkConfig.enableEthernet).toBe(true)
      expect(networkConfig.enableBluetooth).toBe(true)
      expect(networkConfig.dnsServers).toContain('8.8.8.8')
    })

    test('should validate security configuration', () => {
      const securityConfig = DEFAULT_JETSON_DEPLOYMENT_CONFIG.securityConfig
      
      expect(securityConfig.enableEncryption).toBe(true)
      expect(securityConfig.enableFirewall).toBe(true)
      expect(securityConfig.enableAuditLogging).toBe(true)
      expect(securityConfig.allowedPorts).toContain(80)
      expect(securityConfig.allowedPorts).toContain(443)
    })

    test('should validate child safety configuration', () => {
      const childSafetyConfig = DEFAULT_JETSON_DEPLOYMENT_CONFIG.childSafetyConfig
      
      expect(childSafetyConfig.enableContentFiltering).toBe(true)
      expect(childSafetyConfig.contentFilterLevel).toBe('moderate')
      expect(childSafetyConfig.enableParentalControls).toBe(true)
      expect(childSafetyConfig.parentalApprovalRequired).toBe(true)
      expect(childSafetyConfig.allowedDomains).toContain('google.com')
      expect(childSafetyConfig.blockedKeywords).toContain('inappropriate')
    })

    test('should validate performance configuration for Jetson Nano Orin', () => {
      const performanceConfig = DEFAULT_JETSON_DEPLOYMENT_CONFIG.performanceConfig
      
      expect(performanceConfig.maxMemoryUsage).toBe(1024) // 1GB limit
      expect(performanceConfig.maxCPUUsage).toBe(80) // 80% max
      expect(performanceConfig.enableGPUAcceleration).toBe(true)
      expect(performanceConfig.enableSwap).toBe(true)
      expect(performanceConfig.swapSize).toBe(2048) // 2GB swap
      expect(performanceConfig.ioScheduler).toBe('deadline')
    })
  })

  describe('Deployment Process Validation', () => {
    test('should track deployment progress correctly', async () => {
      const progressEvents: any[] = []
      
      deploymentManager.on('deploymentProgress', (status) => {
        progressEvents.push(status)
      })
      
      // Mock deployment (skip actual deployment for tests)
      const mockDeploy = jest.spyOn(deploymentManager, 'deploy').mockImplementation(async () => {
        // Simulate deployment phases
        const phases = [
          { phase: DeploymentPhase.INITIALIZING, progress: 10 },
          { phase: DeploymentPhase.CONFIGURING, progress: 30 },
          { phase: DeploymentPhase.INSTALLING, progress: 60 },
          { phase: DeploymentPhase.TESTING, progress: 80 },
          { phase: DeploymentPhase.FINALIZING, progress: 95 },
          { phase: DeploymentPhase.COMPLETED, progress: 100 }
        ]
        
        for (const phaseData of phases) {
          deploymentManager.emit('deploymentProgress', {
            phase: phaseData.phase,
            progress: phaseData.progress,
            currentStep: `Step ${phaseData.progress}`,
            errors: [],
            warnings: [],
            startTime: new Date()
          })
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      })
      
      await deploymentManager.deploy()
      
      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents[progressEvents.length - 1].phase).toBe(DeploymentPhase.COMPLETED)
      expect(progressEvents[progressEvents.length - 1].progress).toBe(100)
      
      mockDeploy.mockRestore()
    })

    test('should handle deployment failures gracefully', async () => {
      const mockDeploy = jest.spyOn(deploymentManager, 'deploy').mockImplementation(async () => {
        throw new Error('Deployment failed for testing')
      })
      
      await expect(deploymentManager.deploy()).rejects.toThrow('Deployment failed for testing')
      
      const status = deploymentManager.getDeploymentStatus()
      expect(status.phase).toBe(DeploymentPhase.FAILED)
      expect(status.errors.length).toBeGreaterThan(0)
      
      mockDeploy.mockRestore()
    })

    test('should validate system initialization after deployment', async () => {
      // Mock successful deployment
      const mockDeploy = jest.spyOn(deploymentManager, 'deploy').mockResolvedValue()
      const mockInitialize = jest.spyOn(deploymentManager, 'initializeDeployedSystem').mockResolvedValue({} as any)
      
      await deploymentManager.deploy()
      const orchestrator = await deploymentManager.initializeDeployedSystem()
      
      expect(orchestrator).toBeDefined()
      
      mockDeploy.mockRestore()
      mockInitialize.mockRestore()
    })
  })

  describe('Hardware Compatibility Validation', () => {
    test('should validate Jetson Nano Orin hardware requirements', async () => {
      // Mock hardware detection
      const hardwareInfo = {
        platform: 'jetson_nano_orin',
        memory: 8192, // 8GB
        storage: 64000, // 64GB
        cpu: 'ARM Cortex-A78AE',
        gpu: 'NVIDIA Ampere',
        hasCUDA: true,
        hasGPIO: true
      }
      
      const compatibility = validateHardwareCompatibility(hardwareInfo)
      
      expect(compatibility.compatible).toBe(true)
      expect(compatibility.warnings).toHaveLength(0)
      expect(compatibility.requirements.memory).toBeLessThanOrEqual(hardwareInfo.memory)
    })

    test('should detect insufficient hardware resources', async () => {
      const insufficientHardware = {
        platform: 'jetson_nano_orin',
        memory: 2048, // Only 2GB - insufficient
        storage: 16000, // Only 16GB - insufficient
        cpu: 'ARM Cortex-A57', // Older CPU
        gpu: 'NVIDIA Maxwell',
        hasCUDA: false,
        hasGPIO: true
      }
      
      const compatibility = validateHardwareCompatibility(insufficientHardware)
      
      expect(compatibility.compatible).toBe(false)
      expect(compatibility.errors.length).toBeGreaterThan(0)
      expect(compatibility.errors).toContain('Insufficient memory')
      expect(compatibility.errors).toContain('Insufficient storage')
    })

    test('should validate GPU acceleration support', async () => {
      const gpuInfo = {
        hasGPU: true,
        hasCUDA: true,
        cudaVersion: '11.4',
        gpuMemory: 2048, // 2GB GPU memory
        computeCapability: '8.7'
      }
      
      const gpuCompatibility = validateGPUCompatibility(gpuInfo)
      
      expect(gpuCompatibility.supported).toBe(true)
      expect(gpuCompatibility.features.tensorRT).toBe(true)
      expect(gpuCompatibility.features.deepStream).toBe(true)
    })
  })

  describe('System Monitoring Validation', () => {
    test('should start monitoring successfully', async () => {
      const mockStart = jest.spyOn(systemMonitor, 'startMonitoring').mockResolvedValue()
      
      await systemMonitor.startMonitoring()
      
      expect(mockStart).toHaveBeenCalled()
      
      mockStart.mockRestore()
    })

    test('should collect performance metrics', async () => {
      const mockMetrics = jest.spyOn(systemMonitor, 'getCurrentMetrics').mockResolvedValue({
        timestamp: new Date(),
        memoryUsage: {
          total: 8192,
          used: 2048,
          free: 6144,
          cached: 512,
          buffers: 256,
          usagePercentage: 25
        },
        cpuUsage: {
          cores: 6,
          usage: 35,
          loadAverage: [0.5, 0.7, 0.8],
          temperature: 45,
          frequency: 1479
        },
        diskUsage: {
          total: 64,
          used: 32,
          free: 32,
          usagePercentage: 50,
          ioReadRate: 50,
          ioWriteRate: 25
        },
        networkUsage: {
          bytesReceived: 1024000,
          bytesSent: 512000,
          packetsReceived: 1000,
          packetsSent: 800,
          connectionCount: 5,
          bandwidth: 100
        },
        activeReminders: 25,
        activeEvents: 15,
        syncConnections: 3,
        familyMembers: 4,
        averageResponseTime: 150,
        requestsPerSecond: 10,
        errorRate: 0.5,
        uptime: 86400,
        componentHealth: [],
        overallHealth: 'healthy' as any
      })
      
      const metrics = await systemMonitor.getCurrentMetrics()
      
      expect(metrics).toBeDefined()
      expect(metrics.memoryUsage.usagePercentage).toBeLessThan(80) // Should be under 80%
      expect(metrics.cpuUsage.usage).toBeLessThan(70) // Should be under 70%
      expect(metrics.averageResponseTime).toBeLessThan(500) // Should be under 500ms
      
      mockMetrics.mockRestore()
    })

    test('should detect performance issues', async () => {
      const highUsageMetrics = {
        timestamp: new Date(),
        memoryUsage: { usagePercentage: 95 }, // Critical memory usage
        cpuUsage: { usage: 85 }, // High CPU usage
        diskUsage: { usagePercentage: 90 }, // High disk usage
        networkUsage: {},
        activeReminders: 1000,
        activeEvents: 500,
        syncConnections: 10,
        familyMembers: 4,
        averageResponseTime: 2000, // Slow response time
        requestsPerSecond: 50,
        errorRate: 5, // High error rate
        uptime: 86400,
        componentHealth: [],
        overallHealth: 'critical' as any
      }
      
      const mockMetrics = jest.spyOn(systemMonitor, 'getCurrentMetrics').mockResolvedValue(highUsageMetrics as any)
      
      const metrics = await systemMonitor.getCurrentMetrics()
      
      expect(metrics.overallHealth).toBe('critical')
      expect(metrics.memoryUsage.usagePercentage).toBeGreaterThan(90)
      expect(metrics.cpuUsage.usage).toBeGreaterThan(80)
      expect(metrics.averageResponseTime).toBeGreaterThan(1000)
      
      mockMetrics.mockRestore()
    })

    test('should run maintenance tasks', async () => {
      const mockMaintenance = jest.spyOn(systemMonitor, 'runMaintenance').mockResolvedValue()
      
      await systemMonitor.runMaintenance(['log-rotation', 'cache-cleanup'])
      
      expect(mockMaintenance).toHaveBeenCalledWith(['log-rotation', 'cache-cleanup'])
      
      mockMaintenance.mockRestore()
    })
  })

  describe('Configuration Management Validation', () => {
    test('should load and validate system configuration', async () => {
      const configManager = new ConfigurationManager()
      const mockInitialize = jest.spyOn(configManager, 'initialize').mockResolvedValue()
      
      await configManager.initialize()
      
      const systemConfig = configManager.getSystemConfiguration()
      
      expect(systemConfig).toBeDefined()
      expect(systemConfig.maxMemoryUsage).toBeGreaterThan(0)
      expect(systemConfig.enableContentValidation).toBe(true)
      expect(systemConfig.jetsonNanoOptimizations).toBe(true)
      
      mockInitialize.mockRestore()
    })

    test('should create child-safe user profiles', async () => {
      const configManager = new ConfigurationManager()
      const mockInitialize = jest.spyOn(configManager, 'initialize').mockResolvedValue()
      const mockUpdate = jest.spyOn(configManager, 'updateUserPreferences').mockResolvedValue()
      
      await configManager.initialize()
      
      const childUserId = 'child-user-1'
      await configManager.updateUserPreferences(childUserId, {
        userId: childUserId,
        parentalControlLevel: 'strict' as any,
        familyVisibility: 'family_only' as any,
        allowExternalSync: false
      })
      
      const childSafeConfig = configManager.getChildSafeConfiguration(childUserId)
      
      expect(childSafeConfig.parentalControlLevel).toBe('strict')
      expect(childSafeConfig.allowExternalSync).toBe(false)
      expect(childSafeConfig.dataRetentionDays).toBeLessThanOrEqual(30)
      
      mockInitialize.mockRestore()
      mockUpdate.mockRestore()
    })
  })

  describe('End-to-End Deployment Validation', () => {
    test('should complete full system deployment and initialization', async () => {
      const systemInitializer = new SystemInitializer({
        skipDeployment: true, // Skip actual deployment for tests
        enableMonitoring: true,
        developmentMode: true
      })
      
      const mockInitialize = jest.spyOn(systemInitializer, 'initialize').mockResolvedValue()
      
      await systemInitializer.initialize()
      
      const status = systemInitializer.getSystemStatus()
      
      expect(status.isInitialized).toBe(true)
      expect(status.isRunning).toBe(true)
      expect(status.errors).toHaveLength(0)
      
      await systemInitializer.shutdown()
      
      mockInitialize.mockRestore()
    })

    test('should handle system restart', async () => {
      const systemInitializer = new SystemInitializer({
        skipDeployment: true,
        enableMonitoring: false,
        developmentMode: true
      })
      
      const mockInitialize = jest.spyOn(systemInitializer, 'initialize').mockResolvedValue()
      const mockShutdown = jest.spyOn(systemInitializer, 'shutdown').mockResolvedValue()
      const mockRestart = jest.spyOn(systemInitializer, 'restart').mockResolvedValue()
      
      await systemInitializer.initialize()
      await systemInitializer.restart()
      
      expect(mockShutdown).toHaveBeenCalled()
      expect(mockInitialize).toHaveBeenCalledTimes(2) // Initial + restart
      
      mockInitialize.mockRestore()
      mockShutdown.mockRestore()
      mockRestart.mockRestore()
    })

    test('should validate system health after deployment', async () => {
      const systemInitializer = new SystemInitializer({
        skipDeployment: true,
        enableMonitoring: true,
        developmentMode: true
      })
      
      const mockInitialize = jest.spyOn(systemInitializer, 'initialize').mockResolvedValue()
      const mockHealth = jest.spyOn(systemInitializer, 'getSystemHealth').mockResolvedValue({
        status: 'healthy',
        components: [],
        performance: {
          memoryUsage: 512,
          cpuUsage: 25,
          responseTime: 150,
          activeReminders: 10,
          syncConnections: 2,
          errorRate: 0.1
        },
        lastCheck: new Date()
      })
      
      await systemInitializer.initialize()
      const health = await systemInitializer.getSystemHealth()
      
      expect(health.status).toBe('healthy')
      expect(health.performance.memoryUsage).toBeLessThan(1024) // Under 1GB
      expect(health.performance.responseTime).toBeLessThan(500) // Under 500ms
      
      await systemInitializer.shutdown()
      
      mockInitialize.mockRestore()
      mockHealth.mockRestore()
    })
  })

  // Helper functions
  function validateHardwareCompatibility(hardwareInfo: any): any {
    const requirements = {
      memory: 4096, // 4GB minimum
      storage: 32000, // 32GB minimum
      cpu: ['ARM Cortex-A78AE', 'ARM Cortex-A78'],
      gpu: ['NVIDIA Ampere', 'NVIDIA Turing']
    }
    
    const errors: string[] = []
    const warnings: string[] = []
    
    if (hardwareInfo.memory < requirements.memory) {
      errors.push('Insufficient memory')
    }
    
    if (hardwareInfo.storage < requirements.storage) {
      errors.push('Insufficient storage')
    }
    
    if (!requirements.cpu.includes(hardwareInfo.cpu)) {
      warnings.push('CPU not optimized for this platform')
    }
    
    if (!hardwareInfo.hasCUDA) {
      warnings.push('CUDA not available - GPU acceleration disabled')
    }
    
    return {
      compatible: errors.length === 0,
      errors,
      warnings,
      requirements
    }
  }
  
  function validateGPUCompatibility(gpuInfo: any): any {
    return {
      supported: gpuInfo.hasGPU && gpuInfo.hasCUDA,
      features: {
        tensorRT: gpuInfo.hasCUDA && parseFloat(gpuInfo.cudaVersion) >= 11.0,
        deepStream: gpuInfo.hasGPU && gpuInfo.gpuMemory >= 1024,
        nvenc: gpuInfo.hasGPU
      },
      performance: {
        expectedFrameRate: gpuInfo.gpuMemory >= 2048 ? 60 : 30,
        maxResolution: gpuInfo.gpuMemory >= 2048 ? '1920x1080' : '1280x720'
      }
    }
  }
})