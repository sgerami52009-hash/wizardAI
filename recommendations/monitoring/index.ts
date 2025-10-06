/**
 * Monitoring module exports
 * Provides centralized access to all monitoring and maintenance capabilities
 */

export {
  HealthMonitor,
  HealthStatus,
  ComponentHealth,
  HealthAlert,
  HealthCheckConfig,
  HealthThresholds,
  AlertingConfig
} from './health-monitor';

export {
  MaintenanceManager,
  MaintenanceTask,
  MaintenanceSchedule,
  MaintenanceResult,
  MaintenanceConfig,
  MaintenanceReport,
  MaintenanceEvent
} from './maintenance-manager';

export {
  DiagnosticsManager,
  DiagnosticReport,
  SystemInfo,
  DiagnosticRecommendation,
  TroubleshootingStep,
  ConfigurationIssue,
  ResourceUsageAnalysis,
  PerformanceProfiler,
  ProfilingResult
} from './diagnostics';

// Create and export configured instances
import { HealthMonitor } from './health-monitor';
import { MaintenanceManager } from './maintenance-manager';
import { DiagnosticsManager } from './diagnostics';

export const healthMonitor = new HealthMonitor();
export const maintenanceManager = new MaintenanceManager(undefined, healthMonitor);
export const diagnosticsManager = new DiagnosticsManager(healthMonitor, maintenanceManager);

/**
 * Initialize all monitoring systems
 */
export async function initializeMonitoring(): Promise<void> {
  console.log('Initializing recommendation engine monitoring...');
  
  try {
    // Start health monitoring
    healthMonitor.start();
    
    // Start maintenance manager
    maintenanceManager.start();
    
    // Set up monitoring integration
    setupMonitoringIntegration();
    
    console.log('Monitoring initialization completed successfully');
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
    throw error;
  }
}

/**
 * Stop all monitoring systems
 */
export function stopMonitoring(): void {
  console.log('Stopping monitoring systems...');
  
  healthMonitor.stop();
  maintenanceManager.stop();
  
  console.log('Monitoring systems stopped');
}

/**
 * Get comprehensive system status
 */
export async function getSystemStatus(): Promise<{
  health: any;
  maintenance: any;
  diagnostics: any;
}> {
  const health = healthMonitor.getHealthStatus();
  const maintenance = maintenanceManager.getMaintenanceReport(24);
  const diagnostics = await diagnosticsManager.quickHealthCheck();
  
  return {
    health: {
      status: health.overall,
      uptime: health.uptime,
      components: health.components.length,
      alerts: health.alerts.filter(a => !a.resolved).length
    },
    maintenance: {
      tasksExecuted: maintenance.tasksExecuted,
      successRate: maintenance.successRate,
      nextScheduled: maintenance.nextScheduledTasks.length
    },
    diagnostics: {
      status: diagnostics.status,
      issues: diagnostics.issues.length,
      recommendations: diagnostics.recommendations.length
    }
  };
}

/**
 * Setup monitoring system integration
 */
function setupMonitoringIntegration(): void {
  // Set up health monitor alerts to trigger maintenance tasks
  healthMonitor.onAlert('maintenance-trigger', (alert) => {
    if (alert.severity === 'critical') {
      console.log(`Critical alert detected: ${alert.message}`);
      // Could trigger emergency maintenance tasks here
    }
  });
  
  // Set up maintenance notifications
  maintenanceManager.onMaintenanceEvent('health-integration', (event) => {
    if (event.type === 'task_failed') {
      console.warn(`Maintenance task failed: ${event.taskName}`);
      // Could generate health alerts here
    }
  });
  
  console.log('Monitoring integration configured');
}

/**
 * Get monitoring configuration summary
 */
export function getMonitoringConfiguration(): {
  health: any;
  maintenance: any;
  diagnostics: any;
} {
  return {
    health: {
      enabled: true,
      interval: 30000, // 30 seconds
      alerting: true
    },
    maintenance: {
      enabled: true,
      tasksCount: maintenanceManager.getTasks().length,
      window: '02:00-06:00'
    },
    diagnostics: {
      enabled: true,
      profiling: false,
      exportFormats: ['json', 'csv', 'text']
    }
  };
}