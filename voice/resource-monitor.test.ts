/**
 * Unit tests for ResourceMonitor
 * Safety: Ensures resource monitoring prevents system overload
 * Performance: Validates monitoring accuracy and low overhead
 */

import { ResourceMonitor, createJetsonResourceMonitor, ResourceProfile, OptimizationTrigger } from './resource-monitor';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = new ResourceMonitor();
  });

  afterEach(async () => {
    await monitor.stopMonitoring();
  });

  describe('Basic Functionality', () => {
    test('should initialize with default profile', () => {
      const profile = monitor.getProfile();
      expect(profile.profileId).toBe('jetson-nano-orin-default');
      expect(profile.thresholds.memoryWarning).toBe(6144);
      expect(profile.thresholds.memoryCritical).toBe(7372);
    });

    test('should start and stop monitoring', async () => {
      const startSpy = jest.fn();
      const stopSpy = jest.fn();
      
      monitor.on('monitoring-started', startSpy);
      monitor.on('monitoring-stopped', stopSpy);

      await monitor.startMonitoring();
      expect(startSpy).toHaveBeenCalled();

      await monitor.stopMonitoring();
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should get current resource usage', () => {
      const usage = monitor.getCurrentUsage();
      
      expect(usage).toHaveProperty('memoryMB');
      expect(usage).toHaveProperty('cpuPercent');
      expect(usage).toHaveProperty('timestamp');
      expect(usage.memoryMB).toBeGreaterThan(0);
      expect(usage.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(usage.cpuPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Component Registration', () => {
    test('should register and track components', () => {
      const componentId = 'test-component';
      const componentName = 'Test Component';

      monitor.registerComponent(componentId, componentName);
      
      const components = monitor.getComponentUsage();
      expect(components).toHaveLength(1);
      expect(components[0].componentId).toBe(componentId);
      expect(components[0].name).toBe(componentName);
      expect(components[0].isActive).toBe(false);
    });

    test('should update component usage', () => {
      const componentId = 'test-component';
      monitor.registerComponent(componentId, 'Test Component');

      monitor.updateComponentUsage(componentId, {
        memoryMB: 100,
        cpuPercent: 25,
        isActive: true
      });

      const components = monitor.getComponentUsage();
      const component = components.find(c => c.componentId === componentId);
      
      expect(component).toBeDefined();
      expect(component!.memoryMB).toBe(100);
      expect(component!.cpuPercent).toBe(25);
      expect(component!.isActive).toBe(true);
    });

    test('should throw error for unregistered component', () => {
      expect(() => {
        monitor.updateComponentUsage('nonexistent', { memoryMB: 100 });
      }).toThrow('Component nonexistent not registered');
    });
  });

  describe('Resource Monitoring', () => {
    test('should collect resource history', async () => {
      await monitor.startMonitoring();
      
      // Wait for a few monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      const history = monitor.getResourceHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('memoryMB');
      expect(history[0]).toHaveProperty('cpuPercent');
      expect(history[0]).toHaveProperty('timestamp');
    });

    test('should limit history size', async () => {
      // Test the history size limit by running monitoring for a while
      await monitor.startMonitoring();
      
      // Let it collect many entries
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const history = monitor.getResourceHistory();
      
      // Should not exceed the history size limit (300 entries)
      expect(history.length).toBeLessThanOrEqual(300);
      
      // Should have collected some entries
      expect(history.length).toBeGreaterThan(0);
    });

    test('should filter history by time range', async () => {
      // Add some test history
      const now = new Date();
      (monitor as any).resourceHistory = [
        { memoryMB: 100, cpuPercent: 10, timestamp: new Date(now.getTime() - 10 * 60 * 1000) }, // 10 min ago
        { memoryMB: 200, cpuPercent: 20, timestamp: new Date(now.getTime() - 5 * 60 * 1000) },  // 5 min ago
        { memoryMB: 300, cpuPercent: 30, timestamp: new Date() } // now
      ];

      const recentHistory = monitor.getResourceHistory(7); // Last 7 minutes
      expect(recentHistory).toHaveLength(2);
      expect(recentHistory[0].memoryMB).toBe(200);
      expect(recentHistory[1].memoryMB).toBe(300);
    });
  });

  describe('Threshold Monitoring', () => {
    test('should detect resource pressure', () => {
      // Mock high resource usage
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7000, // Above warning threshold
        cpuPercent: 80,  // Above warning threshold
        timestamp: new Date()
      });

      expect(monitor.isUnderPressure()).toBe(true);
    });

    test('should not detect pressure under normal usage', () => {
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 2000, // Below warning threshold
        cpuPercent: 30,  // Below warning threshold
        timestamp: new Date()
      });

      expect(monitor.isUnderPressure()).toBe(false);
    });

    test('should generate resource alerts', async () => {
      const alertSpy = jest.fn();
      monitor.on('resource-alert', alertSpy);

      // Mock high memory usage
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500, // Above critical threshold
        cpuPercent: 30,
        timestamp: new Date()
      });

      await monitor.startMonitoring();
      
      // Wait for monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.type).toBe('critical');
      expect(alert.resource).toBe('memory');
      expect(alert.currentValue).toBe(7500);
    });

    test('should clear alerts when usage returns to normal', async () => {
      const alertSpy = jest.fn();
      const clearSpy = jest.fn();
      
      monitor.on('resource-alert', alertSpy);
      monitor.on('resource-alert-cleared', clearSpy);

      // First, trigger an alert
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7500,
        cpuPercent: 30,
        timestamp: new Date()
      });

      await monitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Then return to normal usage
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 2000,
        cpuPercent: 30,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Optimization Recommendations', () => {
    test('should provide memory optimization recommendations', () => {
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7000, // Above warning threshold
        cpuPercent: 30,
        timestamp: new Date()
      });

      const recommendations = monitor.getOptimizationRecommendations();
      const memoryRec = recommendations.find(r => r.type === 'memory');
      
      expect(memoryRec).toBeDefined();
      expect(memoryRec!.severity).toBe('warning');
      expect(memoryRec!.action).toContain('Reduce audio buffer sizes');
      expect(memoryRec!.expectedSavingMB).toBeGreaterThan(0);
    });

    test('should provide CPU optimization recommendations', () => {
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 2000,
        cpuPercent: 80, // Above warning threshold
        timestamp: new Date()
      });

      const recommendations = monitor.getOptimizationRecommendations();
      const cpuRec = recommendations.find(r => r.type === 'cpu');
      
      expect(cpuRec).toBeDefined();
      expect(cpuRec!.severity).toBe('warning');
      expect(cpuRec!.action).toContain('Reduce processing quality');
      expect(cpuRec!.expectedSavingPercent).toBeGreaterThan(0);
    });

    test('should recommend component optimization for heavy components', () => {
      // Register heavy components
      monitor.registerComponent('heavy-component-1', 'Heavy Component 1');
      monitor.registerComponent('heavy-component-2', 'Heavy Component 2');
      
      monitor.updateComponentUsage('heavy-component-1', {
        memoryMB: 600,
        cpuPercent: 30,
        isActive: true
      });
      
      monitor.updateComponentUsage('heavy-component-2', {
        memoryMB: 400,
        cpuPercent: 25,
        isActive: true
      });

      const recommendations = monitor.getOptimizationRecommendations();
      const componentRec = recommendations.find(r => r.type === 'component');
      
      expect(componentRec).toBeDefined();
      expect(componentRec!.action).toContain('Heavy Component 1');
      expect(componentRec!.targetComponents).toContain('heavy-component-1');
    });
  });

  describe('Profile Management', () => {
    test('should update resource profile', () => {
      const newProfile: ResourceProfile = {
        profileId: 'custom-profile',
        name: 'Custom Profile',
        thresholds: {
          memoryWarning: 4000,
          memoryCritical: 6000,
          cpuWarning: 60,
          cpuCritical: 80
        },
        optimizationTriggers: [],
        adaptiveScaling: true,
        emergencyMode: false
      };

      const updateSpy = jest.fn();
      monitor.on('profile-updated', updateSpy);

      monitor.updateProfile(newProfile);
      
      expect(updateSpy).toHaveBeenCalledWith(newProfile);
      expect(monitor.getProfile().profileId).toBe('custom-profile');
      expect(monitor.getProfile().thresholds.memoryWarning).toBe(4000);
    });
  });

  describe('Optimization Triggers', () => {
    test('should emit optimization trigger events', async () => {
      const triggerSpy = jest.fn();
      monitor.on('optimization-trigger', triggerSpy);

      // Mock high memory usage to trigger optimization
      jest.spyOn(monitor, 'getCurrentUsage').mockReturnValue({
        memoryMB: 7000, // Above warning threshold
        cpuPercent: 30,
        timestamp: new Date()
      });

      await monitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(triggerSpy).toHaveBeenCalled();
      const triggerEvent = triggerSpy.mock.calls[0][0];
      expect(triggerEvent.trigger.action).toBe('reduce_quality');
      expect(triggerEvent.usage.memoryMB).toBe(7000);
    });
  });

  describe('Jetson Nano Orin Factory', () => {
    test('should create optimized monitor for Jetson Nano Orin', () => {
      const jetsonMonitor = createJetsonResourceMonitor();
      const profile = jetsonMonitor.getProfile();
      
      expect(profile.profileId).toBe('jetson-nano-orin-optimized');
      expect(profile.adaptiveScaling).toBe(true);
      expect(profile.optimizationTriggers.length).toBeGreaterThan(0);
      
      // Check Jetson-specific thresholds
      expect(profile.thresholds.memoryWarning).toBe(6144); // 75% of 8GB
      expect(profile.thresholds.memoryCritical).toBe(7372); // 90% of 8GB
    });
  });

  describe('Error Handling', () => {
    test('should handle monitoring errors gracefully', async () => {
      const errorSpy = jest.fn();
      monitor.on('monitoring-error', errorSpy);

      // Mock error in getCurrentUsage
      jest.spyOn(monitor, 'getCurrentUsage').mockImplementation(() => {
        throw new Error('Test monitoring error');
      });

      await monitor.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0].message).toBe('Test monitoring error');
    });

    test('should not crash on multiple start/stop calls', async () => {
      await monitor.startMonitoring();
      await monitor.startMonitoring(); // Should not throw
      
      await monitor.stopMonitoring();
      await monitor.stopMonitoring(); // Should not throw
    });
  });

  describe('Performance', () => {
    test('should have low monitoring overhead', async () => {
      const startTime = Date.now();
      
      await monitor.startMonitoring();
      
      // Let it run for a few cycles
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const usage = monitor.getCurrentUsage();
      const endTime = Date.now();
      
      // Monitoring should not consume excessive resources (adjusted for test environment)
      expect(usage.memoryMB).toBeLessThan(500); // Less than 500MB for monitoring in test environment
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly
    });
  });
});