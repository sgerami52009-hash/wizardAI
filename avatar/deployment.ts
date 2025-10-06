// Avatar System Deployment and Configuration Manager

import { SystemConfiguration } from './system';
import { avatarSystem } from './system';
import { CharacterPackageManager } from '../packages/package-manager';
import { AvatarDataStore } from './storage';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeploymentConfiguration {
  hardware: {
    platform: 'jetson-nano-orin' | 'generic';
    gpuMemoryLimit: number;
    cpuCores: number;
    enableHardwareAcceleration: boolean;
  };
  installation: {
    dataDirectory: string;
    cacheDirectory: string;
    logDirectory: string;
    backupDirectory: string;
  };
  defaultPackages: string[];
  serviceConfig: {
    autoStart: boolean;
    restartOnFailure: boolean;
    maxRestartAttempts: number;
    healthCheckInterval: number;
  };
}

export interface HardwareCompatibility {
  isCompatible: boolean;
  warnings: string[];
  optimizations: string[];
  limitations: string[];
}

export class AvatarDeploymentManager {
  private deploymentConfig: DeploymentConfiguration;
  private readonly configPath = './avatar-deployment.json';

  constructor() {
    this.deploymentConfig = this.getDefaultDeploymentConfig();
  }

  private getDefaultDeploymentConfig(): DeploymentConfiguration {
    return {
      hardware: {
        platform: 'jetson-nano-orin',
        gpuMemoryLimit: 2048, // 2GB
        cpuCores: 6,
        enableHardwareAcceleration: true
      },
      installation: {
        dataDirectory: './data/avatar',
        cacheDirectory: './cache/avatar',
        logDirectory: './logs/avatar',
        backupDirectory: './backups/avatar'
      },
      defaultPackages: [
        'com.kiro.default-child-avatar',
        'com.kiro.default-teen-avatar',
        'com.kiro.default-adult-avatar'
      ],
      serviceConfig: {
        autoStart: true,
        restartOnFailure: true,
        maxRestartAttempts: 3,
        healthCheckInterval: 30000
      }
    };
  }

  async initialize(): Promise<void> {
    console.log('Initializing Avatar Deployment Manager...');
    
    try {
      // Load deployment configuration
      await this.loadDeploymentConfiguration();
      
      // Validate hardware compatibility
      const compatibility = await this.validateHardwareCompatibility();
      if (!compatibility.isCompatible) {
        throw new Error(`Hardware not compatible: ${compatibility.warnings.join(', ')}`);
      }
      
      // Create necessary directories
      await this.createDirectories();
      
      // Initialize system with deployment-specific configuration
      const systemConfig = this.generateSystemConfiguration();
      await avatarSystem.initialize(systemConfig);
      
      // Install default character packages
      await this.installDefaultPackages();
      
      console.log('Avatar Deployment Manager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Avatar Deployment Manager:', error);
      throw error;
    }
  }

  async validateHardwareCompatibility(): Promise<HardwareCompatibility> {
    console.log('Validating hardware compatibility...');
    
    const compatibility: HardwareCompatibility = {
      isCompatible: true,
      warnings: [],
      optimizations: [],
      limitations: []
    };

    try {
      // Check GPU memory (simulated for Jetson Nano Orin)
      const availableGPUMemory = await this.getAvailableGPUMemory();
      if (availableGPUMemory < this.deploymentConfig.hardware.gpuMemoryLimit) {
        compatibility.warnings.push(`Limited GPU memory: ${availableGPUMemory}MB available, ${this.deploymentConfig.hardware.gpuMemoryLimit}MB recommended`);
        compatibility.optimizations.push('Enable aggressive asset compression');
        compatibility.optimizations.push('Reduce texture resolution to 512x512');
      }

      // Check CPU cores
      const availableCPUCores = await this.getAvailableCPUCores();
      if (availableCPUCores < this.deploymentConfig.hardware.cpuCores) {
        compatibility.warnings.push(`Limited CPU cores: ${availableCPUCores} available, ${this.deploymentConfig.hardware.cpuCores} recommended`);
        compatibility.optimizations.push('Reduce background processing threads');
      }

      // Check hardware acceleration support
      const hasHardwareAcceleration = await this.checkHardwareAcceleration();
      if (!hasHardwareAcceleration && this.deploymentConfig.hardware.enableHardwareAcceleration) {
        compatibility.warnings.push('Hardware acceleration not available, falling back to software rendering');
        compatibility.limitations.push('Reduced rendering performance');
        compatibility.optimizations.push('Enable aggressive LOD system');
      }

      // Check storage space
      const availableStorage = await this.getAvailableStorage();
      if (availableStorage < 1024) { // 1GB minimum
        compatibility.isCompatible = false;
        compatibility.warnings.push(`Insufficient storage: ${availableStorage}MB available, 1024MB minimum required`);
      }

      // Platform-specific checks for Jetson Nano Orin
      if (this.deploymentConfig.hardware.platform === 'jetson-nano-orin') {
        const jetsonOptimizations = await this.getJetsonOptimizations();
        compatibility.optimizations.push(...jetsonOptimizations);
      }

    } catch (error) {
      console.error('Error during hardware compatibility check:', error);
      compatibility.warnings.push('Unable to fully validate hardware compatibility');
    }

    return compatibility;
  }

  private async getAvailableGPUMemory(): Promise<number> {
    // Simulated GPU memory check for Jetson Nano Orin
    // In a real implementation, this would query the actual GPU
    return 2048; // 2GB for Jetson Nano Orin
  }

  private async getAvailableCPUCores(): Promise<number> {
    // Simulated CPU core check
    // In a real implementation, this would query the actual CPU
    return 6; // 6 cores for Jetson Nano Orin
  }

  private async checkHardwareAcceleration(): Promise<boolean> {
    // Simulated hardware acceleration check
    // In a real implementation, this would check for CUDA/OpenGL support
    return true;
  }

  private async getAvailableStorage(): Promise<number> {
    // Simulated storage check
    // In a real implementation, this would check actual disk space
    return 8192; // 8GB available
  }

  private async getJetsonOptimizations(): Promise<string[]> {
    return [
      'Enable CUDA acceleration for 3D rendering',
      'Use hardware-accelerated video decoding',
      'Optimize memory allocation for unified memory architecture',
      'Enable power management for thermal throttling',
      'Use NVENC for video encoding if available'
    ];
  }

  private async createDirectories(): Promise<void> {
    console.log('Creating necessary directories...');
    
    const directories = [
      this.deploymentConfig.installation.dataDirectory,
      this.deploymentConfig.installation.cacheDirectory,
      this.deploymentConfig.installation.logDirectory,
      this.deploymentConfig.installation.backupDirectory
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
        throw error;
      }
    }
  }

  private generateSystemConfiguration(): SystemConfiguration {
    const compatibility = this.validateHardwareCompatibility();
    
    return {
      performance: {
        targetFPS: 60,
        maxGPUMemory: this.deploymentConfig.hardware.gpuMemoryLimit,
        maxCPUUsage: 50,
        enableAutoOptimization: true
      },
      safety: {
        enableParentalControls: true,
        defaultAgeRating: 'all-ages',
        auditLogging: true
      },
      rendering: {
        enableHardwareAcceleration: this.deploymentConfig.hardware.enableHardwareAcceleration,
        lodEnabled: true,
        maxTextureResolution: this.deploymentConfig.hardware.gpuMemoryLimit < 2048 ? 512 : 1024
      },
      storage: {
        encryptionEnabled: true,
        backupInterval: 3600000, // 1 hour
        maxBackups: 10
      },
      monitoring: {
        healthCheckInterval: this.deploymentConfig.serviceConfig.healthCheckInterval,
        performanceLogging: true,
        alertThresholds: {
          fps: 45,
          memory: Math.floor(this.deploymentConfig.hardware.gpuMemoryLimit * 0.9),
          cpu: 70
        }
      }
    };
  }

  private async installDefaultPackages(): Promise<void> {
    console.log('Installing default character packages...');
    
    const packageManager = new CharacterPackageManager();

    for (const packageId of this.deploymentConfig.defaultPackages) {
      try {
        console.log(`Installing default package: ${packageId}`);
        
        // Check if package is already installed (simplified check)
        console.log(`Installing package: ${packageId}`);

        // In a real implementation, this would download and install the package
        // For now, we'll simulate the installation
        const installResult = await this.simulatePackageInstallation(packageId);
        
        if (installResult.success) {
          console.log(`Successfully installed package: ${packageId}`);
        } else {
          console.warn(`Failed to install package ${packageId}: ${installResult.error}`);
        }
        
      } catch (error: any) {
        console.error(`Error installing package ${packageId}:`, error);
        // Continue with other packages even if one fails
      }
    }
  }

  private async simulatePackageInstallation(packageId: string): Promise<{ success: boolean; error?: string }> {
    // Simulate package installation process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate success for default packages
    if (this.deploymentConfig.defaultPackages.includes(packageId)) {
      return { success: true };
    }
    
    return { success: false, error: 'Package not found in default repository' };
  }

  async loadDeploymentConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      this.deploymentConfig = { ...this.deploymentConfig, ...config };
      console.log('Loaded deployment configuration from file');
    } catch (error) {
      console.log('No existing deployment configuration found, using defaults');
      await this.saveDeploymentConfiguration();
    }
  }

  async saveDeploymentConfiguration(): Promise<void> {
    try {
      const configData = JSON.stringify(this.deploymentConfig, null, 2);
      await fs.writeFile(this.configPath, configData, 'utf-8');
      console.log('Saved deployment configuration to file');
    } catch (error) {
      console.error('Failed to save deployment configuration:', error);
      throw error;
    }
  }

  async updateDeploymentConfiguration(updates: Partial<DeploymentConfiguration>): Promise<void> {
    console.log('Updating deployment configuration...');
    
    this.deploymentConfig = { ...this.deploymentConfig, ...updates };
    await this.saveDeploymentConfiguration();
    
    // Revalidate hardware compatibility with new configuration
    const compatibility = await this.validateHardwareCompatibility();
    if (!compatibility.isCompatible) {
      console.warn('Updated configuration may not be compatible with current hardware');
    }
    
    console.log('Deployment configuration updated successfully');
  }

  getDeploymentConfiguration(): DeploymentConfiguration {
    return { ...this.deploymentConfig };
  }

  async createServiceConfiguration(): Promise<string> {
    console.log('Creating service configuration...');
    
    const serviceConfig = `
[Unit]
Description=Kiro Avatar System
After=network.target
Wants=network.target

[Service]
Type=simple
User=kiro
Group=kiro
WorkingDirectory=${process.cwd()}
ExecStart=node avatar/service.js
Restart=${this.deploymentConfig.serviceConfig.restartOnFailure ? 'on-failure' : 'no'}
RestartSec=10
StartLimitBurst=${this.deploymentConfig.serviceConfig.maxRestartAttempts}
StartLimitIntervalSec=60

# Environment variables
Environment=NODE_ENV=production
Environment=AVATAR_DATA_DIR=${this.deploymentConfig.installation.dataDirectory}
Environment=AVATAR_CACHE_DIR=${this.deploymentConfig.installation.cacheDirectory}
Environment=AVATAR_LOG_DIR=${this.deploymentConfig.installation.logDirectory}

# Resource limits for Jetson Nano Orin
MemoryMax=6G
CPUQuota=400%

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${this.deploymentConfig.installation.dataDirectory}
ReadWritePaths=${this.deploymentConfig.installation.cacheDirectory}
ReadWritePaths=${this.deploymentConfig.installation.logDirectory}
ReadWritePaths=${this.deploymentConfig.installation.backupDirectory}

[Install]
WantedBy=multi-user.target
`;

    return serviceConfig.trim();
  }

  async generateInitializationScript(): Promise<string> {
    console.log('Generating initialization script...');
    
    const script = `#!/bin/bash
# Kiro Avatar System Initialization Script for Jetson Nano Orin

set -e

echo "Initializing Kiro Avatar System..."

# Check if running on Jetson Nano Orin
if [ -f /etc/nv_tegra_release ]; then
    echo "Detected NVIDIA Jetson platform"
    
    # Enable maximum performance mode
    sudo nvpmodel -m 0
    sudo jetson_clocks
    
    # Set GPU memory frequency
    echo "Setting optimal GPU memory frequency..."
    sudo sh -c 'echo 1300000000 > /sys/kernel/debug/bpmp/debug/clk/emc/rate'
    
else
    echo "Warning: Not running on Jetson platform, some optimizations may not apply"
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p "${this.deploymentConfig.installation.dataDirectory}"
mkdir -p "${this.deploymentConfig.installation.cacheDirectory}"
mkdir -p "${this.deploymentConfig.installation.logDirectory}"
mkdir -p "${this.deploymentConfig.installation.backupDirectory}"

# Set proper permissions
echo "Setting permissions..."
chmod 755 "${this.deploymentConfig.installation.dataDirectory}"
chmod 755 "${this.deploymentConfig.installation.cacheDirectory}"
chmod 755 "${this.deploymentConfig.installation.logDirectory}"
chmod 755 "${this.deploymentConfig.installation.backupDirectory}"

# Install Node.js dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install --production
fi

# Initialize avatar system
echo "Initializing avatar system..."
node -e "
const { avatarDeploymentManager } = require('./avatar/deployment');
avatarDeploymentManager.initialize()
  .then(() => console.log('Avatar system initialized successfully'))
  .catch(error => {
    console.error('Failed to initialize avatar system:', error);
    process.exit(1);
  });
"

# Create systemd service if requested
if [ "${this.deploymentConfig.serviceConfig.autoStart}" = "true" ]; then
    echo "Creating systemd service..."
    
    # Generate service file
    node -e "
    const { avatarDeploymentManager } = require('./avatar/deployment');
    avatarDeploymentManager.createServiceConfiguration()
      .then(config => {
        const fs = require('fs');
        fs.writeFileSync('/tmp/kiro-avatar.service', config);
        console.log('Service configuration created');
      });
    "
    
    # Install service
    sudo cp /tmp/kiro-avatar.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable kiro-avatar.service
    
    echo "Systemd service installed and enabled"
fi

echo "Kiro Avatar System initialization complete!"
echo "Run 'sudo systemctl start kiro-avatar' to start the service"
`;

    return script.trim();
  }
}

// Export singleton instance
export const avatarDeploymentManager = new AvatarDeploymentManager();