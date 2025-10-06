// Avatar System Diagnostics and Troubleshooting Tools

import { avatarSystem, SystemHealth } from './system';
import { systemMonitor, SystemMetrics } from './system-monitor';
import { hardwareCompatibilityChecker } from './hardware-compatibility';
import { performanceMonitor } from '../rendering/performance';
import { avatarEventBus } from './events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DiagnosticReport {
  timestamp: Date;
  systemInfo: SystemInfo;
  healthStatus: SystemHealth;
  performanceAnalysis: PerformanceAnalysis;
  errorAnalysis: ErrorAnalysis;
  configurationIssues: ConfigurationIssue[];
  recommendations: Recommendation[];
  troubleshootingSteps: TroubleshootingStep[];
}

export interface SystemInfo {
  platform: string;
  nodeVersion: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  loadAverage: number[];
}

export interface PerformanceAnalysis {
  averageFPS: number;
  fpsStability: 'stable' | 'unstable' | 'critical';
  memoryEfficiency: 'good' | 'moderate' | 'poor';
  renderingPerformance: 'optimal' | 'degraded' | 'critical';
  bottlenecks: string[];
}

export interface ErrorAnalysis {
  recentErrors: number;
  criticalErrors: number;
  errorPatterns: string[];
  mostFrequentErrors: Array<{ error: string; count: number }>;
  errorTrends: 'improving' | 'stable' | 'worsening';
}

export interface ConfigurationIssue {
  category: 'performance' | 'safety' | 'storage' | 'rendering';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentValue: any;
  recommendedValue: any;
  impact: string;
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  action: string;
  expectedImprovement: string;
}

export interface TroubleshootingStep {
  id: string;
  title: string;
  description: string;
  category: 'diagnostic' | 'fix' | 'verification';
  automated: boolean;
  execute?: () => Promise<TroubleshootingResult>;
}

export interface TroubleshootingResult {
  success: boolean;
  message: string;
  details?: any;
  nextSteps?: string[];
}

export class SystemDiagnostics {
  private diagnosticHistory: DiagnosticReport[] = [];
  private readonly maxHistorySize = 50;

  async runFullDiagnostic(): Promise<DiagnosticReport> {
    console.log('Running full system diagnostic...');
    
    const report: DiagnosticReport = {
      timestamp: new Date(),
      systemInfo: await this.collectSystemInfo(),
      healthStatus: avatarSystem.getSystemHealth(),
      performanceAnalysis: await this.analyzePerformance(),
      errorAnalysis: this.analyzeErrors(),
      configurationIssues: await this.detectConfigurationIssues(),
      recommendations: [],
      troubleshootingSteps: []
    };

    // Generate recommendations based on findings
    report.recommendations = this.generateRecommendations(report);
    
    // Generate troubleshooting steps
    report.troubleshootingSteps = this.generateTroubleshootingSteps(report);

    // Add to history
    this.diagnosticHistory.push(report);
    if (this.diagnosticHistory.length > this.maxHistorySize) {
      this.diagnosticHistory = this.diagnosticHistory.slice(-this.maxHistorySize);
    }

    // Emit diagnostic completed event
    avatarEventBus.emit('avatar:system:diagnostic-completed', report);

    console.log('System diagnostic completed');
    return report;
  }

  private async collectSystemInfo(): Promise<SystemInfo> {
    const memUsage = process.memoryUsage();
    const loadAvg = process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0];
    
    return {
      platform: `${process.platform} ${process.arch}`,
      nodeVersion: process.version,
      uptime: process.uptime() * 1000,
      memoryUsage: memUsage,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      loadAverage: loadAvg
    };
  }

  private async analyzePerformance(): Promise<PerformanceAnalysis> {
    const metrics = systemMonitor.getLatestMetrics();
    const history = systemMonitor.getMetricsHistory(20); // Last 20 metrics
    
    if (!metrics) {
      return {
        averageFPS: 0,
        fpsStability: 'critical',
        memoryEfficiency: 'poor',
        renderingPerformance: 'critical',
        bottlenecks: ['No performance data available']
      };
    }

    // Calculate FPS stability
    const fpsValues = history.map(h => h.performance?.averageFPS || 0).filter(fps => fps > 0);
    const fpsVariance = this.calculateVariance(fpsValues);
    let fpsStability: 'stable' | 'unstable' | 'critical';
    
    if (fpsVariance < 5) {
      fpsStability = 'stable';
    } else if (fpsVariance < 15) {
      fpsStability = 'unstable';
    } else {
      fpsStability = 'critical';
    }

    // Analyze memory efficiency
    const memoryUsageRatio = (metrics.memory?.usedGPUMemory || 0) / (metrics.memory?.totalGPUMemory || 1);
    let memoryEfficiency: 'good' | 'moderate' | 'poor';
    
    if (memoryUsageRatio < 0.7) {
      memoryEfficiency = 'good';
    } else if (memoryUsageRatio < 0.9) {
      memoryEfficiency = 'moderate';
    } else {
      memoryEfficiency = 'poor';
    }

    // Analyze rendering performance
    let renderingPerformance: 'optimal' | 'degraded' | 'critical';
    
    if (metrics.performance.averageFPS >= 45 && metrics.performance.renderTime < 16) {
      renderingPerformance = 'optimal';
    } else if (metrics.performance.averageFPS >= 30) {
      renderingPerformance = 'degraded';
    } else {
      renderingPerformance = 'critical';
    }

    // Identify bottlenecks
    const bottlenecks: string[] = [];
    
    if (metrics.performance.averageFPS < 30) {
      bottlenecks.push('Low FPS indicates rendering bottleneck');
    }
    
    if (memoryUsageRatio > 0.9) {
      bottlenecks.push('High GPU memory usage');
    }
    
    if (metrics.performance.cpuUsage > 80) {
      bottlenecks.push('High CPU usage');
    }
    
    if (metrics.hardware.temperature && metrics.hardware.temperature > 80) {
      bottlenecks.push('Thermal throttling');
    }

    return {
      averageFPS: metrics.performance.averageFPS,
      fpsStability,
      memoryEfficiency,
      renderingPerformance,
      bottlenecks
    };
  }

  private analyzeErrors(): ErrorAnalysis {
    const errorHistory = systemMonitor.getErrorHistory();
    const recentErrors = errorHistory.filter(e => 
      Date.now() - e.timestamp.getTime() < 3600000 // Last hour
    );

    // Count error types
    const errorCounts = new Map<string, number>();
    for (const error of errorHistory) {
      const key = `${error.component}: ${error.message}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }

    // Get most frequent errors
    const mostFrequentErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Detect error patterns
    const errorPatterns: string[] = [];
    
    if (recentErrors.filter(e => e.component === 'performance').length > 3) {
      errorPatterns.push('Frequent performance issues');
    }
    
    if (recentErrors.filter(e => e.level === 'critical').length > 0) {
      errorPatterns.push('Critical errors present');
    }
    
    if (recentErrors.filter(e => e.component === 'memory').length > 2) {
      errorPatterns.push('Memory-related issues');
    }

    // Determine error trend
    const oldErrors = errorHistory.filter(e => 
      Date.now() - e.timestamp.getTime() >= 3600000 && 
      Date.now() - e.timestamp.getTime() < 7200000 // Previous hour
    );
    
    let errorTrends: 'improving' | 'stable' | 'worsening';
    
    if (recentErrors.length < oldErrors.length * 0.8) {
      errorTrends = 'improving';
    } else if (recentErrors.length > oldErrors.length * 1.2) {
      errorTrends = 'worsening';
    } else {
      errorTrends = 'stable';
    }

    return {
      recentErrors: recentErrors.length,
      criticalErrors: recentErrors.filter(e => e.level === 'critical').length,
      errorPatterns,
      mostFrequentErrors,
      errorTrends
    };
  }

  private async detectConfigurationIssues(): Promise<ConfigurationIssue[]> {
    const issues: ConfigurationIssue[] = [];
    const config = avatarSystem.getConfiguration();
    const metrics = systemMonitor.getLatestMetrics();

    // Performance configuration issues
    if (config.performance.targetFPS > 60 && metrics?.performance.averageFPS < 45) {
      issues.push({
        category: 'performance',
        severity: 'medium',
        description: 'Target FPS too high for current hardware performance',
        currentValue: config.performance.targetFPS,
        recommendedValue: 30,
        impact: 'May cause frame drops and poor user experience'
      });
    }

    // Memory configuration issues
    if (config.performance.maxGPUMemory > 2048) {
      issues.push({
        category: 'performance',
        severity: 'high',
        description: 'GPU memory limit exceeds hardware capacity',
        currentValue: config.performance.maxGPUMemory,
        recommendedValue: 2048,
        impact: 'May cause out-of-memory errors and system instability'
      });
    }

    // Rendering configuration issues
    if (config.rendering.maxTextureResolution > 1024 && metrics?.memory.usedGPUMemory > 1500) {
      issues.push({
        category: 'rendering',
        severity: 'medium',
        description: 'Texture resolution too high for available GPU memory',
        currentValue: config.rendering.maxTextureResolution,
        recommendedValue: 512,
        impact: 'High memory usage may cause performance degradation'
      });
    }

    // Safety configuration issues
    if (!config.safety.enableParentalControls) {
      issues.push({
        category: 'safety',
        severity: 'critical',
        description: 'Parental controls are disabled',
        currentValue: false,
        recommendedValue: true,
        impact: 'Children may access inappropriate content'
      });
    }

    return issues;
  }

  private generateRecommendations(report: DiagnosticReport): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Performance recommendations
    if (report.performanceAnalysis.averageFPS < 30) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Improve Rendering Performance',
        description: 'Current FPS is below acceptable threshold',
        action: 'Reduce texture quality, enable LOD, or lower target FPS',
        expectedImprovement: 'Increase FPS to 30+ for smooth experience'
      });
    }

    // Memory recommendations
    if (report.performanceAnalysis.memoryEfficiency === 'poor') {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        title: 'Optimize Memory Usage',
        description: 'GPU memory usage is critically high',
        action: 'Enable asset streaming, reduce cache size, or unload unused assets',
        expectedImprovement: 'Reduce memory usage by 20-30%'
      });
    }

    // Error recommendations
    if (report.errorAnalysis.criticalErrors > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'stability',
        title: 'Address Critical Errors',
        description: 'Critical errors detected that may cause system instability',
        action: 'Review error logs and fix underlying issues',
        expectedImprovement: 'Improve system stability and reliability'
      });
    }

    // Configuration recommendations
    for (const issue of report.configurationIssues) {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        recommendations.push({
          priority: issue.severity === 'critical' ? 'critical' : 'high',
          category: issue.category,
          title: `Fix ${issue.category} Configuration`,
          description: issue.description,
          action: `Change ${issue.category} setting from ${issue.currentValue} to ${issue.recommendedValue}`,
          expectedImprovement: issue.impact
        });
      }
    }

    // Hardware recommendations
    if (report.performanceAnalysis.bottlenecks.includes('Thermal throttling')) {
      recommendations.push({
        priority: 'medium',
        category: 'hardware',
        title: 'Address Thermal Issues',
        description: 'System is experiencing thermal throttling',
        action: 'Improve cooling, reduce performance settings, or check for dust buildup',
        expectedImprovement: 'Prevent performance degradation due to overheating'
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateTroubleshootingSteps(report: DiagnosticReport): TroubleshootingStep[] {
    const steps: TroubleshootingStep[] = [];

    // Basic diagnostic steps
    steps.push({
      id: 'check-system-health',
      title: 'Check System Health',
      description: 'Verify all system components are online and functioning',
      category: 'diagnostic',
      automated: true,
      execute: async () => {
        const health = avatarSystem.getSystemHealth();
        const offlineComponents = health.components.filter(c => c.status === 'offline' || c.status === 'error');
        
        return {
          success: offlineComponents.length === 0,
          message: offlineComponents.length === 0 
            ? 'All system components are healthy' 
            : `${offlineComponents.length} components have issues`,
          details: { health, offlineComponents }
        };
      }
    });

    // Performance troubleshooting
    if (report.performanceAnalysis.averageFPS < 30) {
      steps.push({
        id: 'optimize-performance',
        title: 'Optimize Performance Settings',
        description: 'Automatically adjust settings to improve performance',
        category: 'fix',
        automated: true,
        execute: async () => {
          try {
            // This would call actual optimization methods
            await this.optimizePerformanceSettings();
            return {
              success: true,
              message: 'Performance settings optimized',
              nextSteps: ['Monitor FPS for improvement', 'Run diagnostic again in 5 minutes']
            };
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to optimize performance: ${error.message}`
            };
          }
        }
      });
    }

    // Memory troubleshooting
    if (report.performanceAnalysis.memoryEfficiency === 'poor') {
      steps.push({
        id: 'clear-memory',
        title: 'Clear Memory and Cache',
        description: 'Free up GPU memory by clearing caches and unused assets',
        category: 'fix',
        automated: true,
        execute: async () => {
          try {
            await this.clearMemoryAndCache();
            return {
              success: true,
              message: 'Memory and cache cleared successfully',
              nextSteps: ['Monitor memory usage', 'Check if performance improved']
            };
          } catch (error: any) {
            return {
              success: false,
              message: `Failed to clear memory: ${error.message}`
            };
          }
        }
      });
    }

    // Component recovery
    const offlineComponents = report.healthStatus.components.filter(c => 
      c.status === 'offline' || c.status === 'error'
    );
    
    for (const component of offlineComponents) {
      steps.push({
        id: `recover-${component.name.toLowerCase()}`,
        title: `Recover ${component.name}`,
        description: `Attempt to recover the ${component.name} component`,
        category: 'fix',
        automated: true,
        execute: async () => {
          try {
            const recovered = await avatarSystem.recoverComponent(component.name);
            return {
              success: recovered,
              message: recovered 
                ? `${component.name} recovered successfully` 
                : `Failed to recover ${component.name}`,
              nextSteps: recovered 
                ? ['Verify component is working correctly'] 
                : ['Check component logs', 'Consider system restart']
            };
          } catch (error: any) {
            return {
              success: false,
              message: `Error recovering ${component.name}: ${error.message}`
            };
          }
        }
      });
    }

    // Verification steps
    steps.push({
      id: 'verify-fixes',
      title: 'Verify Applied Fixes',
      description: 'Run diagnostic again to verify that fixes were effective',
      category: 'verification',
      automated: true,
      execute: async () => {
        const newReport = await this.runFullDiagnostic();
        const improved = newReport.performanceAnalysis.averageFPS > report.performanceAnalysis.averageFPS;
        
        return {
          success: improved,
          message: improved 
            ? 'System performance has improved' 
            : 'No significant improvement detected',
          details: { 
            oldFPS: report.performanceAnalysis.averageFPS,
            newFPS: newReport.performanceAnalysis.averageFPS
          }
        };
      }
    });

    return steps;
  }

  private async optimizePerformanceSettings(): Promise<void> {
    // This would implement actual performance optimization
    console.log('Optimizing performance settings...');
    
    const config = avatarSystem.getConfiguration();
    const optimizedConfig = {
      ...config,
      performance: {
        ...config.performance,
        targetFPS: 30,
        enableAutoOptimization: true
      },
      rendering: {
        ...config.rendering,
        maxTextureResolution: 512,
        lodEnabled: true
      }
    };
    
    await avatarSystem.updateConfiguration(optimizedConfig);
  }

  private async clearMemoryAndCache(): Promise<void> {
    // This would implement actual memory clearing
    console.log('Clearing memory and cache...');
    
    // Run maintenance task to clear cache
    await systemMonitor.runMaintenanceTask('cache-cleanup');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  async runTroubleshootingStep(stepId: string): Promise<TroubleshootingResult> {
    const latestReport = this.getLatestDiagnosticReport();
    if (!latestReport) {
      throw new Error('No diagnostic report available. Run full diagnostic first.');
    }

    const step = latestReport.troubleshootingSteps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Troubleshooting step ${stepId} not found`);
    }

    if (!step.execute) {
      throw new Error(`Troubleshooting step ${stepId} is not automated`);
    }

    console.log(`Running troubleshooting step: ${step.title}`);
    
    try {
      const result = await step.execute();
      
      avatarEventBus.emit('avatar:system:troubleshooting-step-completed', {
        stepId,
        stepTitle: step.title,
        result
      });
      
      return result;
    } catch (error: any) {
      const result: TroubleshootingResult = {
        success: false,
        message: `Error executing troubleshooting step: ${error.message}`
      };
      
      avatarEventBus.emit('avatar:system:troubleshooting-step-failed', {
        stepId,
        stepTitle: step.title,
        error: error.message
      });
      
      return result;
    }
  }

  getLatestDiagnosticReport(): DiagnosticReport | null {
    return this.diagnosticHistory.length > 0 
      ? this.diagnosticHistory[this.diagnosticHistory.length - 1] 
      : null;
  }

  getDiagnosticHistory(): DiagnosticReport[] {
    return [...this.diagnosticHistory];
  }

  async exportDiagnosticReport(report?: DiagnosticReport): Promise<string> {
    const reportToExport = report || this.getLatestDiagnosticReport();
    if (!reportToExport) {
      throw new Error('No diagnostic report to export');
    }

    const exportData = {
      ...reportToExport,
      exportedAt: new Date(),
      systemVersion: '1.0.0' // Would be actual version
    };

    const filename = `avatar-diagnostic-${reportToExport.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join('./logs/avatar', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`Diagnostic report exported to: ${filepath}`);
    return filepath;
  }
}

// Export singleton instance
export const systemDiagnostics = new SystemDiagnostics();