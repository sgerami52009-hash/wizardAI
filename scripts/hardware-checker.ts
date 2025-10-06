/**
 * Hardware Compatibility Checker
 * Validates system requirements and optimizes configuration for target hardware
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import * as os from 'os';

export interface HardwareInfo {
  platform: string;
  architecture: string;
  totalMemoryGB: number;
  availableMemoryGB: number;
  cpuCores: number;
  cpuModel: string;
  gpu?: GPUInfo;
  jetsonInfo?: JetsonInfo;
}

export interface GPUInfo {
  vendor: string;
  model: string;
  memoryGB?: number;
  cudaSupport: boolean;
  tensorRTSupport: boolean;
}

export interface JetsonInfo {
  model: string;
  jetpackVersion?: string;
  cudaVersion?: string;
  tensorRTVersion?: string;
  nvpModel?: string;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  platform: 'jetson-nano-orin' | 'generic';
  warnings: string[];
  errors: string[];
  recommendations: string[];
  optimizations: OptimizationSettings;
}

export interface OptimizationSettings {
  maxMemoryUsageMB: number;
  maxCpuUsage: number;
  enableGPUAcceleration: boolean;
  enableTensorRT: boolean;
  audioBufferSize: number;
  modelOptimizations: {
    useQuantizedModels: boolean;
    enableModelCaching: boolean;
    maxConcurrentInferences: number;
  };
}

export class HardwareChecker {
  private hardwareInfo?: HardwareInfo;

  /**
   * Detect and analyze hardware configuration
   */
  async detectHardware(): Promise<HardwareInfo> {
    const platform = os.platform();
    const architecture = os.arch();
    const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100;
    const availableMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100;
    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Unknown';

    this.hardwareInfo = {
      platform,
      architecture,
      totalMemoryGB,
      availableMemoryGB,
      cpuCores,
      cpuModel
    };

    // Detect GPU information
    try {
      this.hardwareInfo.gpu = await this.detectGPU();
    } catch (error) {
      console.warn('GPU detection failed:', error);
    }

    // Detect Jetson-specific information
    try {
      this.hardwareInfo.jetsonInfo = await this.detectJetsonInfo();
    } catch (error) {
      // Not a Jetson device or detection failed
    }

    return this.hardwareInfo;
  }

  /**
   * Check hardware compatibility for voice pipeline
   */
  async checkCompatibility(): Promise<CompatibilityResult> {
    if (!this.hardwareInfo) {
      await this.detectHardware();
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];
    let isCompatible = true;
    let platform: 'jetson-nano-orin' | 'generic' = 'generic';

    // Check if this is a Jetson Nano Orin
    if (this.hardwareInfo!.jetsonInfo?.model?.includes('Orin')) {
      platform = 'jetson-nano-orin';
    }

    // Memory requirements
    if (this.hardwareInfo!.totalMemoryGB < 4) {
      errors.push(`Insufficient memory: ${this.hardwareInfo!.totalMemoryGB}GB (minimum 4GB required)`);
      isCompatible = false;
    } else if (this.hardwareInfo!.totalMemoryGB < 8) {
      warnings.push(`Limited memory: ${this.hardwareInfo!.totalMemoryGB}GB (8GB recommended for optimal performance)`);
      recommendations.push('Consider enabling memory optimization features');
    }

    // CPU requirements
    if (this.hardwareInfo!.cpuCores < 2) {
      errors.push(`Insufficient CPU cores: ${this.hardwareInfo!.cpuCores} (minimum 2 cores required)`);
      isCompatible = false;
    } else if (this.hardwareInfo!.cpuCores < 4) {
      warnings.push(`Limited CPU cores: ${this.hardwareInfo!.cpuCores} (4+ cores recommended)`);
    }

    // Architecture compatibility
    if (!['x64', 'arm64'].includes(this.hardwareInfo!.architecture)) {
      errors.push(`Unsupported architecture: ${this.hardwareInfo!.architecture}`);
      isCompatible = false;
    }

    // GPU acceleration checks
    if (this.hardwareInfo!.gpu) {
      if (this.hardwareInfo!.gpu.cudaSupport) {
        recommendations.push('CUDA support detected - enable GPU acceleration for better performance');
      }
      if (this.hardwareInfo!.gpu.tensorRTSupport) {
        recommendations.push('TensorRT support detected - enable TensorRT optimizations');
      }
    } else {
      warnings.push('No GPU detected - voice processing will use CPU only');
      recommendations.push('Consider using quantized models for better CPU performance');
    }

    // Jetson-specific checks
    if (platform === 'jetson-nano-orin') {
      if (!this.hardwareInfo!.jetsonInfo?.jetpackVersion) {
        warnings.push('JetPack version not detected - ensure JetPack is properly installed');
      }
      
      if (!this.hardwareInfo!.gpu?.cudaSupport) {
        warnings.push('CUDA support not detected on Jetson device');
        recommendations.push('Install CUDA toolkit and verify GPU drivers');
      }

      recommendations.push('Use Jetson-optimized models for best performance');
      recommendations.push('Enable thermal management to prevent throttling');
    }

    // Platform-specific warnings
    if (this.hardwareInfo!.platform === 'win32' && platform === 'jetson-nano-orin') {
      warnings.push('Jetson Nano Orin detected but running on Windows - this may be a development environment');
    }

    const optimizations = this.generateOptimizations(platform);

    return {
      isCompatible,
      platform,
      warnings,
      errors,
      recommendations,
      optimizations
    };
  }

  /**
   * Generate optimization settings based on hardware
   */
  private generateOptimizations(platform: 'jetson-nano-orin' | 'generic'): OptimizationSettings {
    const hardware = this.hardwareInfo!;
    
    // Base settings
    let maxMemoryUsageMB = Math.floor(hardware.totalMemoryGB * 1024 * 0.6); // 60% of total memory
    let maxCpuUsage = 70;
    let enableGPUAcceleration = false;
    let enableTensorRT = false;
    let audioBufferSize = 1024;

    // Platform-specific optimizations
    if (platform === 'jetson-nano-orin') {
      maxMemoryUsageMB = Math.min(maxMemoryUsageMB, 6144); // Max 6GB on Jetson
      maxCpuUsage = 80; // Can use more CPU on dedicated device
      enableGPUAcceleration = hardware.gpu?.cudaSupport || false;
      enableTensorRT = hardware.gpu?.tensorRTSupport || false;
      audioBufferSize = 512; // Smaller buffer for lower latency
    }

    // Memory-based adjustments
    if (hardware.totalMemoryGB <= 4) {
      maxMemoryUsageMB = Math.floor(hardware.totalMemoryGB * 1024 * 0.5); // More conservative on low memory
      audioBufferSize = 2048; // Larger buffer to reduce CPU load
    }

    // CPU-based adjustments
    if (hardware.cpuCores <= 2) {
      maxCpuUsage = 60; // More conservative on limited cores
    }

    return {
      maxMemoryUsageMB,
      maxCpuUsage,
      enableGPUAcceleration,
      enableTensorRT,
      audioBufferSize,
      modelOptimizations: {
        useQuantizedModels: !enableGPUAcceleration || hardware.totalMemoryGB < 8,
        enableModelCaching: hardware.totalMemoryGB >= 6,
        maxConcurrentInferences: Math.min(hardware.cpuCores, enableGPUAcceleration ? 4 : 2)
      }
    };
  }

  /**
   * Detect GPU information
   */
  private async detectGPU(): Promise<GPUInfo | undefined> {
    try {
      // Try to detect NVIDIA GPU
      const nvidiaInfo = await this.detectNvidiaGPU();
      if (nvidiaInfo) {
        return nvidiaInfo;
      }

      // Try to detect other GPUs (AMD, Intel)
      return await this.detectOtherGPU();
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Detect NVIDIA GPU information
   */
  private async detectNvidiaGPU(): Promise<GPUInfo | undefined> {
    try {
      // Try nvidia-smi command
      const nvidiaOutput = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', 
        { encoding: 'utf8', timeout: 5000 });
      
      const lines = nvidiaOutput.trim().split('\n');
      if (lines.length > 0) {
        const [name, memoryMB] = lines[0].split(',').map(s => s.trim());
        
        return {
          vendor: 'NVIDIA',
          model: name,
          memoryGB: parseInt(memoryMB) / 1024,
          cudaSupport: await this.checkCudaSupport(),
          tensorRTSupport: await this.checkTensorRTSupport()
        };
      }
    } catch (error) {
      // nvidia-smi not available or failed
    }

    return undefined;
  }

  /**
   * Detect other GPU types
   */
  private async detectOtherGPU(): Promise<GPUInfo | undefined> {
    try {
      if (os.platform() === 'linux') {
        // Try lspci for Linux
        const lspciOutput = execSync('lspci | grep -i vga', { encoding: 'utf8', timeout: 5000 });
        const gpuLine = lspciOutput.split('\n')[0];
        
        if (gpuLine) {
          let vendor = 'Unknown';
          let model = gpuLine;
          
          if (gpuLine.toLowerCase().includes('amd') || gpuLine.toLowerCase().includes('radeon')) {
            vendor = 'AMD';
          } else if (gpuLine.toLowerCase().includes('intel')) {
            vendor = 'Intel';
          }
          
          return {
            vendor,
            model: model.split(':').pop()?.trim() || model,
            cudaSupport: false,
            tensorRTSupport: false
          };
        }
      } else if (os.platform() === 'win32') {
        // Try wmic for Windows
        const wmicOutput = execSync('wmic path win32_VideoController get name', 
          { encoding: 'utf8', timeout: 5000 });
        
        const lines = wmicOutput.split('\n').filter(line => line.trim() && !line.includes('Name'));
        if (lines.length > 0) {
          const gpuName = lines[0].trim();
          let vendor = 'Unknown';
          
          if (gpuName.toLowerCase().includes('nvidia')) {
            vendor = 'NVIDIA';
          } else if (gpuName.toLowerCase().includes('amd') || gpuName.toLowerCase().includes('radeon')) {
            vendor = 'AMD';
          } else if (gpuName.toLowerCase().includes('intel')) {
            vendor = 'Intel';
          }
          
          return {
            vendor,
            model: gpuName,
            cudaSupport: vendor === 'NVIDIA' && await this.checkCudaSupport(),
            tensorRTSupport: vendor === 'NVIDIA' && await this.checkTensorRTSupport()
          };
        }
      }
    } catch (error) {
      // Detection failed
    }

    return undefined;
  }

  /**
   * Detect Jetson-specific information
   */
  private async detectJetsonInfo(): Promise<JetsonInfo | undefined> {
    try {
      // Check for Jetson device tree
      let model = 'Unknown Jetson';
      try {
        const deviceTree = await fs.readFile('/proc/device-tree/model', 'utf8');
        model = deviceTree.trim();
      } catch {
        // Try alternative detection
        const releaseInfo = await fs.readFile('/etc/nv_tegra_release', 'utf8');
        if (releaseInfo.includes('Orin')) {
          model = 'NVIDIA Jetson Nano Orin';
        }
      }

      // Get JetPack version
      let jetpackVersion: string | undefined;
      try {
        const jetpackInfo = execSync('dpkg -l | grep nvidia-jetpack', { encoding: 'utf8' });
        const versionMatch = jetpackInfo.match(/nvidia-jetpack\s+(\S+)/);
        jetpackVersion = versionMatch?.[1];
      } catch {
        // JetPack version not available
      }

      // Get CUDA version
      let cudaVersion: string | undefined;
      try {
        const cudaInfo = execSync('nvcc --version', { encoding: 'utf8' });
        const versionMatch = cudaInfo.match(/release (\d+\.\d+)/);
        cudaVersion = versionMatch?.[1];
      } catch {
        // CUDA not available
      }

      // Get TensorRT version
      let tensorRTVersion: string | undefined;
      try {
        const tensorRTInfo = execSync('dpkg -l | grep tensorrt', { encoding: 'utf8' });
        const versionMatch = tensorRTInfo.match(/libnvinfer\d+\s+(\S+)/);
        tensorRTVersion = versionMatch?.[1];
      } catch {
        // TensorRT not available
      }

      return {
        model,
        jetpackVersion,
        cudaVersion,
        tensorRTVersion
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Check CUDA support
   */
  private async checkCudaSupport(): Promise<boolean> {
    try {
      execSync('nvcc --version', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check TensorRT support
   */
  private async checkTensorRTSupport(): Promise<boolean> {
    try {
      // Check for TensorRT libraries
      if (os.platform() === 'linux') {
        execSync('ldconfig -p | grep tensorrt', { timeout: 3000 });
        return true;
      } else if (os.platform() === 'win32') {
        // Check for TensorRT installation on Windows
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const tensorRTPath = `${programFiles}\\NVIDIA GPU Computing Toolkit\\TensorRT`;
        await fs.access(tensorRTPath);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Get hardware information
   */
  getHardwareInfo(): HardwareInfo | undefined {
    return this.hardwareInfo;
  }

  /**
   * Generate hardware report
   */
  async generateReport(): Promise<string> {
    const compatibility = await this.checkCompatibility();
    const hardware = this.hardwareInfo!;

    const report = [
      '=== Hardware Compatibility Report ===',
      '',
      `Platform: ${hardware.platform} (${hardware.architecture})`,
      `CPU: ${hardware.cpuModel} (${hardware.cpuCores} cores)`,
      `Memory: ${hardware.totalMemoryGB}GB total, ${hardware.availableMemoryGB}GB available`,
      '',
      'GPU Information:',
      hardware.gpu 
        ? `  ${hardware.gpu.vendor} ${hardware.gpu.model}${hardware.gpu.memoryGB ? ` (${hardware.gpu.memoryGB}GB)` : ''}`
        : '  No GPU detected',
      hardware.gpu?.cudaSupport ? '  ✓ CUDA Support' : '  ✗ No CUDA Support',
      hardware.gpu?.tensorRTSupport ? '  ✓ TensorRT Support' : '  ✗ No TensorRT Support',
      '',
      'Jetson Information:',
      hardware.jetsonInfo 
        ? [
            `  Model: ${hardware.jetsonInfo.model}`,
            hardware.jetsonInfo.jetpackVersion ? `  JetPack: ${hardware.jetsonInfo.jetpackVersion}` : '  JetPack: Not detected',
            hardware.jetsonInfo.cudaVersion ? `  CUDA: ${hardware.jetsonInfo.cudaVersion}` : '  CUDA: Not detected',
            hardware.jetsonInfo.tensorRTVersion ? `  TensorRT: ${hardware.jetsonInfo.tensorRTVersion}` : '  TensorRT: Not detected'
          ].join('\n')
        : '  Not a Jetson device',
      '',
      `Compatibility: ${compatibility.isCompatible ? '✓ Compatible' : '✗ Not Compatible'}`,
      `Target Platform: ${compatibility.platform}`,
      '',
      'Errors:',
      compatibility.errors.length > 0 
        ? compatibility.errors.map(e => `  ✗ ${e}`).join('\n')
        : '  None',
      '',
      'Warnings:',
      compatibility.warnings.length > 0 
        ? compatibility.warnings.map(w => `  ⚠ ${w}`).join('\n')
        : '  None',
      '',
      'Recommendations:',
      compatibility.recommendations.length > 0 
        ? compatibility.recommendations.map(r => `  • ${r}`).join('\n')
        : '  None',
      '',
      'Optimization Settings:',
      `  Max Memory Usage: ${compatibility.optimizations.maxMemoryUsageMB}MB`,
      `  Max CPU Usage: ${compatibility.optimizations.maxCpuUsage}%`,
      `  GPU Acceleration: ${compatibility.optimizations.enableGPUAcceleration ? 'Enabled' : 'Disabled'}`,
      `  TensorRT: ${compatibility.optimizations.enableTensorRT ? 'Enabled' : 'Disabled'}`,
      `  Audio Buffer Size: ${compatibility.optimizations.audioBufferSize}`,
      `  Quantized Models: ${compatibility.optimizations.modelOptimizations.useQuantizedModels ? 'Yes' : 'No'}`,
      `  Model Caching: ${compatibility.optimizations.modelOptimizations.enableModelCaching ? 'Yes' : 'No'}`,
      `  Max Concurrent Inferences: ${compatibility.optimizations.modelOptimizations.maxConcurrentInferences}`,
      ''
    ];

    return report.join('\n');
  }
}

export default HardwareChecker;