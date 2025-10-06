/**
 * Service Management Utility
 * Handles service installation, monitoring, and lifecycle management
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

export interface ServiceConfig {
  name: string;
  displayName: string;
  description: string;
  executablePath: string;
  workingDirectory: string;
  environment: Record<string, string>;
  autoStart: boolean;
  restartOnFailure: boolean;
  maxRestarts: number;
  restartDelay: number; // seconds
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  pid?: number;
  uptime?: number; // seconds
  memoryUsageMB?: number;
  cpuUsage?: number;
  restartCount: number;
  lastError?: string;
}

export interface ServiceMetrics {
  startTime: Date;
  totalUptime: number; // seconds
  totalRestarts: number;
  averageMemoryUsage: number; // MB
  peakMemoryUsage: number; // MB
  averageCpuUsage: number; // percentage
  peakCpuUsage: number; // percentage
}

export class ServiceManager extends EventEmitter {
  private services: Map<string, ServiceConfig> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private restartCounts: Map<string, number> = new Map();
  private startTimes: Map<string, Date> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.setupSignalHandlers();
  }

  /**
   * Register a service configuration
   */
  registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.restartCounts.set(config.name, 0);
    this.emit('serviceRegistered', { serviceName: config.name });
  }

  /**
   * Install service on the system (platform-specific)
   */
  async installService(serviceName: string): Promise<void> {
    const config = this.services.get(serviceName);
    if (!config) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    const platform = os.platform();

    try {
      switch (platform) {
        case 'linux':
          await this.installLinuxService(config);
          break;
        case 'win32':
          await this.installWindowsService(config);
          break;
        case 'darwin':
          await this.installMacOSService(config);
          break;
        default:
          throw new Error(`Service installation not supported on ${platform}`);
      }

      this.emit('serviceInstalled', { serviceName });
    } catch (error) {
      this.emit('serviceInstallError', { 
        serviceName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Uninstall service from the system
   */
  async uninstallService(serviceName: string): Promise<void> {
    const platform = os.platform();

    try {
      // Stop the service first
      await this.stopService(serviceName);

      switch (platform) {
        case 'linux':
          await this.uninstallLinuxService(serviceName);
          break;
        case 'win32':
          await this.uninstallWindowsService(serviceName);
          break;
        case 'darwin':
          await this.uninstallMacOSService(serviceName);
          break;
        default:
          throw new Error(`Service uninstallation not supported on ${platform}`);
      }

      this.emit('serviceUninstalled', { serviceName });
    } catch (error) {
      this.emit('serviceUninstallError', { 
        serviceName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Start a service
   */
  async startService(serviceName: string, useSystemService: boolean = true): Promise<void> {
    const config = this.services.get(serviceName);
    if (!config) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    try {
      if (useSystemService && await this.isSystemServiceInstalled(serviceName)) {
        await this.startSystemService(serviceName);
      } else {
        await this.startManagedService(serviceName);
      }

      this.startTimes.set(serviceName, new Date());
      this.emit('serviceStarted', { serviceName });
    } catch (error) {
      this.emit('serviceStartError', { 
        serviceName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Stop a service
   */
  async stopService(serviceName: string, useSystemService: boolean = true): Promise<void> {
    try {
      if (useSystemService && await this.isSystemServiceInstalled(serviceName)) {
        await this.stopSystemService(serviceName);
      } else {
        await this.stopManagedService(serviceName);
      }

      this.startTimes.delete(serviceName);
      this.emit('serviceStopped', { serviceName });
    } catch (error) {
      this.emit('serviceStopError', { 
        serviceName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Restart a service
   */
  async restartService(serviceName: string): Promise<void> {
    await this.stopService(serviceName);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.startService(serviceName);
    
    const currentCount = this.restartCounts.get(serviceName) || 0;
    this.restartCounts.set(serviceName, currentCount + 1);
    
    this.emit('serviceRestarted', { serviceName, restartCount: currentCount + 1 });
  }

  /**
   * Get service status
   */
  async getServiceStatus(serviceName: string): Promise<ServiceStatus> {
    const config = this.services.get(serviceName);
    if (!config) {
      throw new Error(`Service ${serviceName} not registered`);
    }

    const restartCount = this.restartCounts.get(serviceName) || 0;
    const startTime = this.startTimes.get(serviceName);
    const uptime = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : undefined;

    try {
      // Check if running as system service
      if (await this.isSystemServiceInstalled(serviceName)) {
        const systemStatus = await this.getSystemServiceStatus(serviceName);
        return {
          ...systemStatus,
          restartCount,
          uptime
        };
      }

      // Check managed process
      const process = this.processes.get(serviceName);
      if (process && !process.killed) {
        const metrics = await this.getProcessMetrics(process.pid!);
        return {
          name: serviceName,
          status: 'running',
          pid: process.pid,
          uptime,
          memoryUsageMB: metrics.memoryUsageMB,
          cpuUsage: metrics.cpuUsage,
          restartCount
        };
      }

      return {
        name: serviceName,
        status: 'stopped',
        restartCount
      };
    } catch (error) {
      return {
        name: serviceName,
        status: 'error',
        restartCount,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start monitoring services
   */
  startMonitoring(intervalSeconds: number = 30): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      for (const serviceName of this.services.keys()) {
        try {
          const status = await this.getServiceStatus(serviceName);
          this.emit('serviceStatus', status);

          // Handle automatic restart on failure
          const config = this.services.get(serviceName)!;
          if (status.status === 'stopped' && config.restartOnFailure) {
            const restartCount = this.restartCounts.get(serviceName) || 0;
            if (restartCount < config.maxRestarts) {
              this.emit('serviceAutoRestart', { serviceName, restartCount });
              setTimeout(() => {
                this.startService(serviceName, false); // Use managed service for auto-restart
              }, config.restartDelay * 1000);
            } else {
              this.emit('serviceMaxRestartsReached', { serviceName, restartCount });
            }
          }
        } catch (error) {
          this.emit('monitoringError', { 
            serviceName, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
    }, intervalSeconds * 1000);

    this.emit('monitoringStarted', { intervalSeconds });
  }

  /**
   * Stop monitoring services
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    this.emit('monitoringStopped');
  }

  /**
   * Get service metrics
   */
  async getServiceMetrics(serviceName: string): Promise<ServiceMetrics | undefined> {
    const startTime = this.startTimes.get(serviceName);
    if (!startTime) {
      return undefined;
    }

    const status = await this.getServiceStatus(serviceName);
    const totalUptime = Math.floor((Date.now() - startTime.getTime()) / 1000);

    return {
      startTime,
      totalUptime,
      totalRestarts: status.restartCount,
      averageMemoryUsage: status.memoryUsageMB || 0,
      peakMemoryUsage: status.memoryUsageMB || 0, // Would need historical tracking
      averageCpuUsage: status.cpuUsage || 0,
      peakCpuUsage: status.cpuUsage || 0 // Would need historical tracking
    };
  }

  /**
   * Install Linux systemd service
   */
  private async installLinuxService(config: ServiceConfig): Promise<void> {
    const serviceContent = `[Unit]
Description=${config.description}
After=network.target

[Service]
Type=simple
User=\${USER}
WorkingDirectory=${config.workingDirectory}
ExecStart=${config.executablePath}
Restart=${config.restartOnFailure ? 'always' : 'no'}
RestartSec=${config.restartDelay}
${Object.entries(config.environment).map(([key, value]) => `Environment=${key}=${value}`).join('\n')}

[Install]
WantedBy=multi-user.target
`;

    const servicePath = `/etc/systemd/system/${config.name}.service`;
    await fs.writeFile(servicePath, serviceContent);
    
    execSync('systemctl daemon-reload');
    
    if (config.autoStart) {
      execSync(`systemctl enable ${config.name}`);
    }
  }

  /**
   * Install Windows service (requires NSSM)
   */
  private async installWindowsService(config: ServiceConfig): Promise<void> {
    // Check if NSSM is available
    try {
      execSync('nssm version', { stdio: 'ignore' });
    } catch {
      throw new Error('NSSM (Non-Sucking Service Manager) is required for Windows service installation');
    }

    execSync(`nssm install ${config.name} "${config.executablePath}"`);
    execSync(`nssm set ${config.name} DisplayName "${config.displayName}"`);
    execSync(`nssm set ${config.name} Description "${config.description}"`);
    execSync(`nssm set ${config.name} AppDirectory "${config.workingDirectory}"`);
    
    // Set environment variables
    for (const [key, value] of Object.entries(config.environment)) {
      execSync(`nssm set ${config.name} AppEnvironmentExtra ${key}=${value}`);
    }

    if (config.autoStart) {
      execSync(`nssm set ${config.name} Start SERVICE_AUTO_START`);
    }

    if (config.restartOnFailure) {
      execSync(`nssm set ${config.name} AppExit Default Restart`);
      execSync(`nssm set ${config.name} AppRestartDelay ${config.restartDelay * 1000}`);
    }
  }

  /**
   * Install macOS launchd service
   */
  private async installMacOSService(config: ServiceConfig): Promise<void> {
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${config.name}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${config.executablePath}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${config.workingDirectory}</string>
    <key>RunAtLoad</key>
    <${config.autoStart ? 'true' : 'false'}/>
    <key>KeepAlive</key>
    <${config.restartOnFailure ? 'true' : 'false'}/>
    <key>EnvironmentVariables</key>
    <dict>
        ${Object.entries(config.environment).map(([key, value]) => 
          `<key>${key}</key><string>${value}</string>`
        ).join('\n        ')}
    </dict>
</dict>
</plist>
`;

    const plistPath = `/Library/LaunchDaemons/${config.name}.plist`;
    await fs.writeFile(plistPath, plistContent);
    
    if (config.autoStart) {
      execSync(`launchctl load ${plistPath}`);
    }
  }

  /**
   * Start managed service (direct process management)
   */
  private async startManagedService(serviceName: string): Promise<void> {
    const config = this.services.get(serviceName)!;
    
    // Check if already running
    const existingProcess = this.processes.get(serviceName);
    if (existingProcess && !existingProcess.killed) {
      throw new Error(`Service ${serviceName} is already running`);
    }

    const process = spawn(config.executablePath, [], {
      cwd: config.workingDirectory,
      env: { ...process.env, ...config.environment },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    process.on('error', (error) => {
      this.emit('serviceError', { serviceName, error: error.message });
    });

    process.on('exit', (code, signal) => {
      this.processes.delete(serviceName);
      this.emit('serviceExit', { serviceName, code, signal });
    });

    this.processes.set(serviceName, process);
  }

  /**
   * Stop managed service
   */
  private async stopManagedService(serviceName: string): Promise<void> {
    const process = this.processes.get(serviceName);
    if (!process || process.killed) {
      return;
    }

    // Graceful shutdown
    process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
        resolve();
      }, 10000); // 10 second timeout

      process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.processes.delete(serviceName);
  }

  /**
   * Start system service
   */
  private async startSystemService(serviceName: string): Promise<void> {
    const platform = os.platform();
    
    switch (platform) {
      case 'linux':
        execSync(`systemctl start ${serviceName}`);
        break;
      case 'win32':
        execSync(`nssm start ${serviceName}`);
        break;
      case 'darwin':
        execSync(`launchctl start ${serviceName}`);
        break;
    }
  }

  /**
   * Stop system service
   */
  private async stopSystemService(serviceName: string): Promise<void> {
    const platform = os.platform();
    
    switch (platform) {
      case 'linux':
        execSync(`systemctl stop ${serviceName}`);
        break;
      case 'win32':
        execSync(`nssm stop ${serviceName}`);
        break;
      case 'darwin':
        execSync(`launchctl stop ${serviceName}`);
        break;
    }
  }

  /**
   * Check if system service is installed
   */
  private async isSystemServiceInstalled(serviceName: string): Promise<boolean> {
    const platform = os.platform();
    
    try {
      switch (platform) {
        case 'linux':
          execSync(`systemctl status ${serviceName}`, { stdio: 'ignore' });
          return true;
        case 'win32':
          execSync(`nssm status ${serviceName}`, { stdio: 'ignore' });
          return true;
        case 'darwin':
          execSync(`launchctl list | grep ${serviceName}`, { stdio: 'ignore' });
          return true;
      }
    } catch {
      return false;
    }
    
    return false;
  }

  /**
   * Get system service status
   */
  private async getSystemServiceStatus(serviceName: string): Promise<Partial<ServiceStatus>> {
    const platform = os.platform();
    
    try {
      switch (platform) {
        case 'linux':
          const output = execSync(`systemctl is-active ${serviceName}`, { encoding: 'utf8' });
          return {
            name: serviceName,
            status: output.trim() === 'active' ? 'running' : 'stopped'
          };
        case 'win32':
          const nssmOutput = execSync(`nssm status ${serviceName}`, { encoding: 'utf8' });
          return {
            name: serviceName,
            status: nssmOutput.includes('SERVICE_RUNNING') ? 'running' : 'stopped'
          };
        case 'darwin':
          execSync(`launchctl list | grep ${serviceName}`, { stdio: 'ignore' });
          return {
            name: serviceName,
            status: 'running'
          };
      }
    } catch {
      return {
        name: serviceName,
        status: 'stopped'
      };
    }
    
    return {
      name: serviceName,
      status: 'unknown'
    };
  }

  /**
   * Get process metrics
   */
  private async getProcessMetrics(pid: number): Promise<{ memoryUsageMB: number; cpuUsage: number }> {
    try {
      const platform = os.platform();
      
      if (platform === 'linux' || platform === 'darwin') {
        const psOutput = execSync(`ps -p ${pid} -o rss,pcpu --no-headers`, { encoding: 'utf8' });
        const [rss, pcpu] = psOutput.trim().split(/\s+/);
        return {
          memoryUsageMB: parseInt(rss) / 1024, // RSS is in KB
          cpuUsage: parseFloat(pcpu)
        };
      } else if (platform === 'win32') {
        const wmicOutput = execSync(`wmic process where processid=${pid} get workingsetsize,percentprocessortime`, 
          { encoding: 'utf8' });
        // Windows process metrics would need more complex parsing
        return { memoryUsageMB: 0, cpuUsage: 0 };
      }
    } catch {
      // Process might have exited
    }
    
    return { memoryUsageMB: 0, cpuUsage: 0 };
  }

  /**
   * Uninstall Linux service
   */
  private async uninstallLinuxService(serviceName: string): Promise<void> {
    try {
      execSync(`systemctl disable ${serviceName}`);
      execSync(`systemctl stop ${serviceName}`);
    } catch {
      // Service might not be running
    }
    
    const servicePath = `/etc/systemd/system/${serviceName}.service`;
    try {
      await fs.unlink(servicePath);
    } catch {
      // File might not exist
    }
    
    execSync('systemctl daemon-reload');
  }

  /**
   * Uninstall Windows service
   */
  private async uninstallWindowsService(serviceName: string): Promise<void> {
    try {
      execSync(`nssm stop ${serviceName}`);
      execSync(`nssm remove ${serviceName} confirm`);
    } catch {
      // Service might not exist
    }
  }

  /**
   * Uninstall macOS service
   */
  private async uninstallMacOSService(serviceName: string): Promise<void> {
    const plistPath = `/Library/LaunchDaemons/${serviceName}.plist`;
    
    try {
      execSync(`launchctl unload ${plistPath}`);
    } catch {
      // Service might not be loaded
    }
    
    try {
      await fs.unlink(plistPath);
    } catch {
      // File might not exist
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal as NodeJS.Signals, async () => {
        console.log(`Received ${signal}, shutting down services...`);
        
        // Stop all managed services
        for (const serviceName of this.processes.keys()) {
          try {
            await this.stopManagedService(serviceName);
          } catch (error) {
            console.error(`Error stopping service ${serviceName}:`, error);
          }
        }
        
        this.stopMonitoring();
        process.exit(0);
      });
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    
    // Stop all managed processes
    for (const [serviceName, process] of this.processes) {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    }
    
    this.processes.clear();
    this.removeAllListeners();
  }
}

export default ServiceManager;