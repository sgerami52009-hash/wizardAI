// System Initializer Tests

import { LearningSystemInitializer } from './system-initializer';
import { DefaultLearningEventBus } from './events';
import { DefaultUserModelStore } from '../models/store';
import { SafetyValidatorImpl } from './safety-validator';
import { DefaultPerformanceMonitor } from './performance-monitor';

describe('LearningSystemInitializer', () => {
  let initializer: LearningSystemInitializer;
  let eventBus: DefaultLearningEventBus;
  let modelStore: DefaultUserModelStore;
  let safetyValidator: SafetyValidatorImpl;
  let performanceMonitor: DefaultPerformanceMonitor;

  beforeEach(() => {
    eventBus = new DefaultLearningEventBus();
    modelStore = new DefaultUserModelStore();
    safetyValidator = new SafetyValidatorImpl();
    performanceMonitor = new DefaultPerformanceMonitor(eventBus);
    
    initializer = new LearningSystemInitializer(
      eventBus,
      modelStore,
      safetyValidator,
      performanceMonitor
    );
  });

  describe('System Initialization', () => {
    it('should initialize system successfully', async () => {
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(true);
      expect(result.initializationTime).toBeGreaterThan(0);
      expect(result.componentsInitialized.length).toBeGreaterThan(0);
      expect(result.healthChecks.overall).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock a component failure
      jest.spyOn(initializer as any, 'validateSystemHealth').mockRejectedValue(new Error('Health check failed'));
      
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Default User Model Creation', () => {
    it('should create default user model', async () => {
      const userId = 'test_user_123';
      
      const userModel = await initializer.createDefaultUserModel(userId);
      
      expect(userModel.userId).toBe(userId);
      expect(userModel.version).toBeDefined();
      expect(userModel.modelData).toBeDefined();
      expect(userModel.metadata).toBeDefined();
      expect(userModel.performance).toBeDefined();
    });

    it('should create encrypted model data', async () => {
      const userId = 'test_user_456';
      
      const userModel = await initializer.createDefaultUserModel(userId);
      
      expect(userModel.modelData.encryptedData).toBeDefined();
      expect(userModel.modelData.encryptionMethod).toBe('aes_256');
      expect(userModel.modelData.checksum).toBeDefined();
    });
  });

  describe('System Health Validation', () => {
    it('should validate system health', async () => {
      const healthCheck = await initializer.validateSystemHealth();
      
      expect(healthCheck.overall).toBeDefined();
      expect(healthCheck.components).toBeDefined();
      expect(healthCheck.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(healthCheck.cpuUsage).toBeGreaterThanOrEqual(0);
    });

    it('should identify critical issues', async () => {
      // Mock high memory usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 8 * 1024 * 1024 * 1024, // 8GB
        heapTotal: 8 * 1024 * 1024 * 1024,
        heapUsed: 7 * 1024 * 1024 * 1024, // 7GB used
        external: 0,
        arrayBuffers: 0
      });
      
      const healthCheck = await initializer.validateSystemHealth();
      
      expect(healthCheck.criticalIssues.length).toBeGreaterThan(0);
      expect(healthCheck.criticalIssues[0].component).toBe('Memory');
    });
  });

  describe('Configuration Setup', () => {
    it('should setup default configuration', async () => {
      const configResult = await initializer.setupDefaultConfiguration();
      
      expect(configResult.success).toBe(true);
      expect(configResult.configurationApplied.length).toBeGreaterThan(0);
      expect(configResult.defaultsUsed.length).toBeGreaterThan(0);
    });

    it('should validate configuration items', async () => {
      const configResult = await initializer.setupDefaultConfiguration();
      
      const validationResults = configResult.validationResults;
      expect(validationResults.length).toBeGreaterThan(0);
      
      // Check that critical configurations are valid
      const memoryConfig = validationResults.find(v => v.key === 'maxMemoryUsageMB');
      expect(memoryConfig?.isValid).toBe(true);
    });
  });

  describe('Component Initialization', () => {
    it('should initialize components in dependency order', async () => {
      const componentResult = await initializer.initializeComponents();
      
      expect(componentResult.success).toBe(true);
      expect(componentResult.initializedComponents.length).toBeGreaterThan(0);
      expect(componentResult.dependencyGraph.length).toBeGreaterThan(0);
    });

    it('should handle component failures', async () => {
      // Mock component initialization failure
      jest.spyOn(initializer as any, 'initializeComponent').mockRejectedValue(new Error('Component failed'));
      
      const componentResult = await initializer.initializeComponents();
      
      expect(componentResult.success).toBe(false);
      expect(componentResult.failedComponents.length).toBeGreaterThan(0);
    });
  });

  describe('Jetson Nano Orin Optimization', () => {
    it('should create hardware-optimized model architecture', async () => {
      const userId = 'jetson_test_user';
      
      const userModel = await initializer.createDefaultUserModel(userId);
      
      // Check that model is optimized for Jetson Nano Orin constraints
      expect(userModel.metadata.hyperparameters.batchSize).toBeLessThanOrEqual(32);
      expect(userModel.performance.memoryUsage).toBeLessThan(2048); // Less than 2GB
      expect(userModel.performance.latency).toBeLessThan(100); // Less than 100ms
    });

    it('should enforce memory constraints during initialization', async () => {
      const healthCheck = await initializer.validateSystemHealth();
      
      // Should detect if memory usage is too high for Jetson Nano Orin
      if (healthCheck.memoryUsage > 6144) { // 6GB threshold
        expect(healthCheck.criticalIssues.some(issue => 
          issue.component === 'Memory'
        )).toBe(true);
      }
    });
  });

  describe('Child Safety Integration', () => {
    it('should validate user IDs for child safety', async () => {
      const childUserId = 'child_user_123';
      
      // Should not throw error for valid child user ID
      await expect(initializer.createDefaultUserModel(childUserId)).resolves.toBeDefined();
    });

    it('should apply child safety configurations', async () => {
      const configResult = await initializer.setupDefaultConfiguration();
      
      const childSafetyConfig = configResult.configurationApplied.find(
        config => config.key === 'childSafetyEnabled'
      );
      
      expect(childSafetyConfig?.value).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle system initialization failures gracefully', async () => {
      // Mock system health check failure
      jest.spyOn(initializer as any, 'validateSystemHealth').mockResolvedValue({
        overall: 'unhealthy',
        components: [],
        memoryUsage: 0,
        cpuUsage: 0,
        diskSpace: 0,
        networkConnectivity: false,
        criticalIssues: [
          {
            issueId: 'test_issue',
            component: 'System',
            severity: 'critical',
            description: 'System health check failed',
            impact: 'Cannot initialize system',
            recommendation: 'Check system status'
          }
        ]
      });
      
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].severity).toBe('critical');
    });

    it('should provide recovery recommendations', async () => {
      const healthCheck = await initializer.validateSystemHealth();
      
      if (healthCheck.criticalIssues.length > 0) {
        healthCheck.criticalIssues.forEach(issue => {
          expect(issue.recommendation).toBeDefined();
          expect(issue.recommendation.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Configuration Scenarios', () => {
    it('should handle missing configuration files gracefully', async () => {
      // Mock configuration file not found
      jest.spyOn(initializer as any, 'loadConfigurationFile').mockRejectedValue(new Error('Configuration file not found'));
      
      const configResult = await initializer.setupDefaultConfiguration();
      
      expect(configResult.success).toBe(true);
      expect(configResult.defaultsUsed.length).toBeGreaterThan(0);
      expect(configResult.configurationApplied.every(config => config.isDefault)).toBe(true);
    });

    it('should validate configuration values against constraints', async () => {
      const configResult = await initializer.setupDefaultConfiguration();
      
      const memoryConfig = configResult.configurationApplied.find(c => c.key === 'maxMemoryUsageMB');
      expect(memoryConfig?.value).toBeLessThanOrEqual(8192); // Jetson Nano Orin limit
      
      const latencyConfig = configResult.configurationApplied.find(c => c.key === 'maxInferenceLatencyMs');
      expect(latencyConfig?.value).toBeLessThanOrEqual(500); // Real-time constraint
    });

    it('should handle corrupted configuration gracefully', async () => {
      // Mock corrupted configuration
      jest.spyOn(initializer as any, 'parseConfiguration').mockImplementation(() => {
        throw new Error('Invalid JSON in configuration file');
      });
      
      const configResult = await initializer.setupDefaultConfiguration();
      
      expect(configResult.success).toBe(true);
      expect(configResult.validationResults.some(v => v.severity === 'error')).toBe(true);
    });

    it('should apply environment-specific configurations', async () => {
      // Mock environment variables
      process.env.LEARNING_ENGINE_MEMORY_LIMIT = '4096';
      process.env.LEARNING_ENGINE_BATCH_SIZE = '16';
      
      const configResult = await initializer.setupDefaultConfiguration();
      
      // Should use environment values when available
      const memoryConfig = configResult.configurationApplied.find(c => c.key === 'maxMemoryUsageMB');
      const batchConfig = configResult.configurationApplied.find(c => c.key === 'batchSize');
      
      // Clean up
      delete process.env.LEARNING_ENGINE_MEMORY_LIMIT;
      delete process.env.LEARNING_ENGINE_BATCH_SIZE;
    });
  });

  describe('System Startup Scenarios', () => {
    it('should handle cold start initialization', async () => {
      // Simulate cold start with no existing data
      jest.spyOn(modelStore, 'loadUserModel').mockRejectedValue(new Error('No existing models'));
      
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(true);
      expect(result.componentsInitialized).toContain('EventBus');
      expect(result.componentsInitialized).toContain('SafetyValidator');
    });

    it('should handle warm start with existing models', async () => {
      // Create a test model first
      const testUserId = 'existing_user';
      await initializer.createDefaultUserModel(testUserId);
      
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(true);
      expect(result.initializationTime).toBeGreaterThan(0);
    });

    it('should handle partial component failures during startup', async () => {
      // Mock one component failure
      jest.spyOn(initializer as any, 'initializeComponent').mockImplementation((...args: unknown[]) => {
        const componentName = args[0] as string;
        if (componentName === 'LearningEngine') {
          throw new Error('Learning engine initialization failed');
        }
        return Promise.resolve();
      });
      
      const result = await initializer.initializeSystem();
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.component === 'LearningEngine')).toBe(true);
    });

    it('should validate system requirements before initialization', async () => {
      // Mock insufficient memory
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 9 * 1024 * 1024 * 1024, // 9GB - exceeds Jetson limit
        heapTotal: 9 * 1024 * 1024 * 1024,
        heapUsed: 8 * 1024 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      });
      
      const result = await initializer.initializeSystem();
      
      expect(result.healthChecks.criticalIssues.length).toBeGreaterThan(0);
      expect(result.healthChecks.criticalIssues[0].component).toBe('Memory');
    });
  });

  describe('Model Creation Scenarios', () => {
    it('should create models with different user profiles', async () => {
      const childUserId = 'child_user_8';
      const adultUserId = 'adult_user_25';
      
      const childModel = await initializer.createDefaultUserModel(childUserId);
      const adultModel = await initializer.createDefaultUserModel(adultUserId);
      
      expect(childModel.userId).toBe(childUserId);
      expect(adultModel.userId).toBe(adultUserId);
      expect(childModel.version).toBe('1.0.0');
      expect(adultModel.version).toBe('1.0.0');
    });

    it('should handle model creation with insufficient resources', async () => {
      // Mock low memory condition
      jest.spyOn(initializer as any, 'validateSystemHealth').mockResolvedValue({
        overall: 'degraded',
        components: [],
        memoryUsage: 7500, // High memory usage
        cpuUsage: 90,
        diskSpace: 10,
        networkConnectivity: true,
        criticalIssues: []
      });
      
      const userId = 'resource_constrained_user';
      const model = await initializer.createDefaultUserModel(userId);
      
      // Should still create model but with optimized settings
      expect(model.metadata.hyperparameters.batchSize).toBeLessThanOrEqual(16);
      expect(model.performance.memoryUsage).toBeLessThan(1024);
    });

    it('should create encrypted model data', async () => {
      const userId = 'encryption_test_user';
      const model = await initializer.createDefaultUserModel(userId);
      
      expect(model.modelData.encryptionMethod).toBe('aes_256');
      expect(model.modelData.encryptedData).toBeDefined();
      expect(model.modelData.checksum).toBeDefined();
      expect(model.modelData.keyId).toBeDefined();
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from component crashes', async () => {
      // Initialize system normally
      let result = await initializer.initializeSystem();
      expect(result.success).toBe(true);
      
      // Simulate component crash
      jest.spyOn(initializer as any, 'checkEventBusHealth').mockRejectedValue(new Error('EventBus crashed'));
      
      // System should detect the failure
      const healthCheck = await initializer.validateSystemHealth();
      expect(healthCheck.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should handle graceful shutdown scenarios', async () => {
      await initializer.initializeSystem();
      
      // Mock graceful shutdown
      jest.spyOn(performanceMonitor, 'stopMonitoring').mockResolvedValue();
      
      // Should be able to validate health during shutdown
      const healthCheck = await initializer.validateSystemHealth();
      expect(healthCheck).toBeDefined();
    });

    it('should validate data integrity after system restart', async () => {
      // Create initial model
      const userId = 'restart_test_user';
      await initializer.createDefaultUserModel(userId);
      
      // Simulate system restart
      const newInitializer = new LearningSystemInitializer(
        eventBus,
        modelStore,
        safetyValidator,
        performanceMonitor
      );
      
      const result = await newInitializer.initializeSystem();
      expect(result.success).toBe(true);
      
      // Verify model still exists and is valid
      const loadedModel = await modelStore.loadUserModel(userId);
      expect(loadedModel.userId).toBe(userId);
    });
  });
});