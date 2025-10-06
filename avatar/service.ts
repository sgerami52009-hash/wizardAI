// Avatar System Service Entry Point

import { avatarSystem } from './system';
import { avatarDeploymentManager } from './deployment';
import { avatarEventBus } from './events';
import * as process from 'process';

class AvatarService {
  private isShuttingDown = false;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;

  async start(): Promise<void> {
    console.log('Starting Kiro Avatar Service...');
    
    try {
      // Initialize deployment manager first
      await avatarDeploymentManager.initialize();
      
      // The avatar system is initialized by the deployment manager
      console.log('Avatar Service started successfully');
      
      // Set up graceful shutdown handlers
      this.setupShutdownHandlers();
      
      // Set up health monitoring
      this.setupHealthMonitoring();
      
      // Emit service started event
      avatarEventBus.emit('avatar:service:started', {
        timestamp: new Date(),
        processId: process.pid
      });
      
    } catch (error) {
      console.error('Failed to start Avatar Service:', error);
      await this.handleStartupFailure(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log('Stopping Kiro Avatar Service...');
    
    try {
      // Emit service stopping event
      avatarEventBus.emit('avatar:service:stopping', {
        timestamp: new Date(),
        processId: process.pid
      });
      
      // Shutdown avatar system
      if (avatarSystem.isInitialized()) {
        await avatarSystem.shutdown();
      }
      
      console.log('Avatar Service stopped successfully');
      
      // Emit service stopped event
      avatarEventBus.emit('avatar:service:stopped', {
        timestamp: new Date(),
        processId: process.pid
      });
      
    } catch (error) {
      console.error('Error during Avatar Service shutdown:', error);
      throw error;
    }
  }

  async restart(): Promise<void> {
    console.log('Restarting Kiro Avatar Service...');
    
    this.restartAttempts++;
    
    if (this.restartAttempts > this.maxRestartAttempts) {
      console.error(`Maximum restart attempts (${this.maxRestartAttempts}) exceeded`);
      process.exit(1);
    }
    
    try {
      await this.stop();
      
      // Brief pause before restart
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await this.start();
      
      // Reset restart attempts on successful restart
      this.restartAttempts = 0;
      
      console.log('Avatar Service restarted successfully');
      
    } catch (error) {
      console.error('Failed to restart Avatar Service:', error);
      
      // Exponential backoff for restart attempts
      const backoffDelay = Math.min(30000, 5000 * Math.pow(2, this.restartAttempts - 1));
      console.log(`Retrying restart in ${backoffDelay}ms...`);
      
      setTimeout(() => {
        this.restart();
      }, backoffDelay);
    }
  }

  private setupShutdownHandlers(): void {
    // Handle SIGTERM (systemd stop)
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      
      try {
        // Attempt graceful shutdown
        await this.stop();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled promise rejection at:', promise, 'reason:', reason);
      
      // For critical errors, restart the service
      if (this.isCriticalError(reason)) {
        console.log('Critical error detected, restarting service...');
        await this.restart();
      }
    });
  }

  private setupHealthMonitoring(): void {
    // Periodic health checks
    setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        const health = avatarSystem.getSystemHealth();
        
        if (health.status === 'critical') {
          console.error('System health is critical, attempting restart...');
          await this.restart();
        } else if (health.status === 'degraded') {
          console.warn('System health is degraded:', health);
          
          // Attempt to recover degraded components
          for (const component of health.components) {
            if (component.status === 'error' && !component.isEssential) {
              console.log(`Attempting to recover component: ${component.name}`);
              await avatarSystem.recoverComponent(component.name);
            }
          }
        }
        
      } catch (error) {
        console.error('Error during health check:', error);
      }
    }, 60000); // Check every minute

    // Listen for system events
    avatarEventBus.on('avatar:system:critical-error', async (data) => {
      console.error('Critical system error detected:', data);
      await this.restart();
    });

    avatarEventBus.on('avatar:system:restart-requested', async () => {
      console.log('System restart requested');
      await this.restart();
    });
  }

  private async handleStartupFailure(error: any): Promise<void> {
    console.error('Avatar Service startup failed:', error);
    
    // Emit startup failure event
    avatarEventBus.emit('avatar:service:startup-failed', {
      timestamp: new Date(),
      error: error.message,
      processId: process.pid,
      restartAttempts: this.restartAttempts
    });
    
    // Attempt restart if within limits
    if (this.restartAttempts < this.maxRestartAttempts) {
      console.log(`Attempting restart (${this.restartAttempts + 1}/${this.maxRestartAttempts})...`);
      setTimeout(() => {
        this.restart();
      }, 10000); // Wait 10 seconds before restart
    } else {
      console.error('Maximum startup attempts exceeded, exiting...');
      process.exit(1);
    }
  }

  private isCriticalError(error: any): boolean {
    if (!error) return false;
    
    const criticalErrorPatterns = [
      /ENOSPC/, // No space left on device
      /ENOMEM/, // Out of memory
      /GPU.*failed/, // GPU failures
      /CUDA.*error/, // CUDA errors
      /system.*critical/ // System critical errors
    ];
    
    const errorMessage = error.toString().toLowerCase();
    return criticalErrorPatterns.some(pattern => pattern.test(errorMessage));
  }

  getServiceStatus(): {
    isRunning: boolean;
    uptime: number;
    restartAttempts: number;
    systemHealth: any;
  } {
    return {
      isRunning: avatarSystem.isInitialized() && !this.isShuttingDown,
      uptime: process.uptime() * 1000, // Convert to milliseconds
      restartAttempts: this.restartAttempts,
      systemHealth: avatarSystem.isInitialized() ? avatarSystem.getSystemHealth() : null
    };
  }
}

// Create and export service instance
export const avatarService = new AvatarService();

// Auto-start if this file is run directly
if (require.main === module) {
  avatarService.start().catch(error => {
    console.error('Failed to start Avatar Service:', error);
    process.exit(1);
  });
}