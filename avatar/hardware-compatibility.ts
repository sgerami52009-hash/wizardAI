// Hardware Compatibility Checker for Jetson Nano Orin

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HardwareSpecs {
  platform: string;
  cpuCores: number;
  totalMemory: number;
  gpuMemory: number;
  storageSpace: number;
  hasCUDA: boolean;
  hasOpenGL: boolean;
  thermalThrottling: boolean;
}

export interface OptimizationRecommendations {
  rendering: {
    maxTextureResolution: number;
    enableLOD: boolean;
    targetFPS: number;
    enableHardwareAcceleration: boolean;
  };
  memory: {
    maxAssetCacheSize: number;
    enableAssetStreaming: boolean;
    aggressiveGarbageCollection: boolean;
  };
  performance: {
    maxConcurrentAnimations: number;
    enablePerformanceMonitoring: boolean;
    autoQualityAdjustment: boolean;
  };
  thermal: {
    enableThermalThrottling: boolean;
    temperatureThreshold: number;
    throttlingStrategy: 'reduce-quality' | 'reduce-fps' | 'pause-rendering';
  };
}

export class HardwareCompatibilityChecker {
  private hardwareSpecs?: HardwareSpecs;

  async detectHardware(): Promise<HardwareSpecs> {
    console.log('Detecting hardware specifications...');
    
    const specs: HardwareSpecs = {
      platform: await this.detectPlatform(),
      cpuCores: await this.detectCPUCores(),
      totalMemory: await this.detectTotalMemory(),
      gpuMemory: await this.detectGPUMemory(),
      storageSpace: await this.detectStorageSpace(),
      hasCUDA: await this.detectCUDASupport(),
      hasOpenGL: await this.detectOpenGLSupport(),
      thermalThrottling: await this.detectThermalThrottling()
    };

    this.hardwareSpecs = specs;
    console.log('Hardware detection complete:', specs);
    
    return specs;
  }

  private async detectPlatform(): Promise<string> {
    try {
      // Check for Jetson platform
      const jetsonRelease = await fs.readFile('/etc/nv_tegra_release', 'utf-8').catch(() => null);
      if (jetsonRelease) {
        if (jetsonRelease.includes('ORIN')) {
          return 'jetson-orin';
        } else if (jetsonRelease.includes('NANO')) {
          return 'jetson-nano';
        } else {
          return 'jetson-unknown';
        }
      }

      // Check for other platforms
      const osRelease = await fs.readFile('/etc/os-release', 'utf-8').catch(() => '');
      if (osRelease.includes('Ubuntu')) {
        return 'ubuntu';
      }

      return 'unknown';
    } catch (error) {
      console.warn('Could not detect platform:', error);
      return 'unknown';
    }
  }

  private async detectCPUCores(): Promise<number> {
    try {
      const cpuInfo = await fs.readFile('/proc/cpuinfo', 'utf-8');
      const processors = cpuInfo.match(/^processor\s*:/gm);
      return processors ? processors.length : 4; // Default to 4 cores
    } catch (error) {
      console.warn('Could not detect CPU cores:', error);
      return 4;
    }
  }

  private async detectTotalMemory(): Promise<number> {
    try {
      const memInfo = await fs.readFile('/proc/meminfo', 'utf-8');
      const memTotalMatch = memInfo.match(/MemTotal:\s*(\d+)\s*kB/);
      if (memTotalMatch) {
        return Math.floor(parseInt(memTotalMatch[1]) / 1024); // Convert KB to MB
      }
      return 4096; // Default to 4GB
    } catch (error) {
      console.warn('Could not detect total memory:', error);
      return 4096;
    }
  }

  private async detectGPUMemory(): Promise<number> {
    try {
      // For Jetson platforms, GPU memory is shared with system memory
      if (this.hardwareSpecs?.platform?.includes('jetson')) {
        // Jetson Nano Orin typically has 2GB dedicated GPU memory
        return 2048;
      }

      // Try to detect discrete GPU memory
      const { stdout } = await execAsync('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits').catch(() => ({ stdout: '' }));
      if (stdout.trim()) {
        return parseInt(stdout.trim());
      }

      return 1024; // Default to 1GB
    } catch (error) {
      console.warn('Could not detect GPU memory:', error);
      return 1024;
    }
  }

  private async detectStorageSpace(): Promise<number> {
    try {
      const { stdout } = await execAsync('df -m . | tail -1 | awk \'{print $4}\'');
      return parseInt(stdout.trim()) || 8192; // Default to 8GB
    } catch (error) {
      console.warn('Could not detect storage space:', error);
      return 8192;
    }
  }

  private async detectCUDASupport(): Promise<boolean> {
    try {
      await execAsync('nvidia-smi');
      const { stdout } = await execAsync('nvcc --version').catch(() => ({ stdout: '' }));
      return stdout.includes('cuda');
    } catch (error) {
      return false;
    }
  }

  private async detectOpenGLSupport(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('glxinfo | grep "OpenGL version"').catch(() => ({ stdout: '' }));
      return stdout.includes('OpenGL');
    } catch (error) {
      return false;
    }
  }

  private async detectThermalThrottling(): Promise<boolean> {
    try {
      // Check for thermal zone files (common on ARM platforms like Jetson)
      const thermalZones = await fs.readdir('/sys/class/thermal').catch(() => []);
      return thermalZones.some(zone => zone.startsWith('thermal_zone'));
    } catch (error) {
      return false;
    }
  }

  generateOptimizationRecommendations(specs: HardwareSpecs): OptimizationRecommendations {
    console.log('Generating optimization recommendations...');
    
    const recommendations: OptimizationRecommendations = {
      rendering: {
        maxTextureResolution: this.getRecommendedTextureResolution(specs),
        enableLOD: specs.gpuMemory < 2048,
        targetFPS: this.getRecommendedTargetFPS(specs),
        enableHardwareAcceleration: specs.hasCUDA || specs.hasOpenGL
      },
      memory: {
        maxAssetCacheSize: Math.floor(specs.gpuMemory * 0.6), // 60% of GPU memory
        enableAssetStreaming: specs.gpuMemory < 2048,
        aggressiveGarbageCollection: specs.totalMemory < 4096
      },
      performance: {
        maxConcurrentAnimations: this.getMaxConcurrentAnimations(specs),
        enablePerformanceMonitoring: true,
        autoQualityAdjustment: true
      },
      thermal: {
        enableThermalThrottling: specs.thermalThrottling,
        temperatureThreshold: specs.platform.includes('jetson') ? 75 : 85, // Celsius
        throttlingStrategy: this.getThermalThrottlingStrategy(specs)
      }
    };

    console.log('Optimization recommendations generated:', recommendations);
    return recommendations;
  }

  private getRecommendedTextureResolution(specs: HardwareSpecs): number {
    if (specs.gpuMemory >= 2048) {
      return 1024;
    } else if (specs.gpuMemory >= 1024) {
      return 512;
    } else {
      return 256;
    }
  }

  private getRecommendedTargetFPS(specs: HardwareSpecs): number {
    if (specs.platform.includes('jetson') && specs.gpuMemory >= 2048) {
      return 60;
    } else if (specs.gpuMemory >= 1024) {
      return 30;
    } else {
      return 24;
    }
  }

  private getMaxConcurrentAnimations(specs: HardwareSpecs): number {
    if (specs.cpuCores >= 6 && specs.gpuMemory >= 2048) {
      return 8;
    } else if (specs.cpuCores >= 4) {
      return 4;
    } else {
      return 2;
    }
  }

  private getThermalThrottlingStrategy(specs: HardwareSpecs): 'reduce-quality' | 'reduce-fps' | 'pause-rendering' {
    if (specs.platform.includes('jetson')) {
      return 'reduce-quality'; // Jetson platforms handle thermal throttling better with quality reduction
    } else if (specs.gpuMemory < 1024) {
      return 'pause-rendering'; // Low-end hardware should pause rendering to prevent overheating
    } else {
      return 'reduce-fps'; // Mid-range hardware can reduce FPS
    }
  }

  async validateMinimumRequirements(specs: HardwareSpecs): Promise<{
    isCompatible: boolean;
    failedRequirements: string[];
    warnings: string[];
  }> {
    const failedRequirements: string[] = [];
    const warnings: string[] = [];

    // Minimum requirements
    if (specs.totalMemory < 2048) {
      failedRequirements.push('Minimum 2GB RAM required');
    }

    if (specs.gpuMemory < 512) {
      failedRequirements.push('Minimum 512MB GPU memory required');
    }

    if (specs.storageSpace < 1024) {
      failedRequirements.push('Minimum 1GB free storage required');
    }

    if (specs.cpuCores < 2) {
      failedRequirements.push('Minimum 2 CPU cores required');
    }

    // Warnings for suboptimal configurations
    if (specs.totalMemory < 4096) {
      warnings.push('4GB+ RAM recommended for optimal performance');
    }

    if (specs.gpuMemory < 1024) {
      warnings.push('1GB+ GPU memory recommended for high-quality rendering');
    }

    if (!specs.hasCUDA && !specs.hasOpenGL) {
      warnings.push('Hardware acceleration not available, performance may be limited');
    }

    if (specs.cpuCores < 4) {
      warnings.push('4+ CPU cores recommended for smooth operation');
    }

    return {
      isCompatible: failedRequirements.length === 0,
      failedRequirements,
      warnings
    };
  }

  async getCurrentTemperature(): Promise<number | null> {
    try {
      // Try to read temperature from thermal zones
      const thermalZones = await fs.readdir('/sys/class/thermal').catch(() => []);
      
      for (const zone of thermalZones) {
        if (zone.startsWith('thermal_zone')) {
          try {
            const tempPath = `/sys/class/thermal/${zone}/temp`;
            const tempStr = await fs.readFile(tempPath, 'utf-8');
            const temp = parseInt(tempStr.trim()) / 1000; // Convert millicelsius to celsius
            
            if (temp > 0 && temp < 150) { // Sanity check
              return temp;
            }
          } catch (error) {
            continue; // Try next thermal zone
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Could not read temperature:', error);
      return null;
    }
  }

  async monitorThermalStatus(callback: (temperature: number, isThrottling: boolean) => void): Promise<() => void> {
    const interval = setInterval(async () => {
      const temperature = await this.getCurrentTemperature();
      
      if (temperature !== null) {
        const isThrottling = temperature > 80; // Threshold for thermal throttling
        callback(temperature, isThrottling);
      }
    }, 5000); // Check every 5 seconds

    // Return cleanup function
    return () => clearInterval(interval);
  }
}

// Export singleton instance
export const hardwareCompatibilityChecker = new HardwareCompatibilityChecker();