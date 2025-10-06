/**
 * Resource-aware processing system for scheduling operations
 * Provides intelligent resource management and graceful degradation
 * Optimized for Jetson Nano Orin hardware constraints
 */

import { EventEmitter } from 'events';

export interface ResourceState {
  memory: MemoryState;
  cpu: CpuState;
  network: NetworkState;
  storage: StorageState;
  voice: VoiceState;
  avatar: AvatarState;
}

export interface MemoryState {
  used: number;
  available: number;
  total: number;
  threshold: number;
  pressure: ResourcePressure;
}

export interface CpuState {
  usage: number;
  loadAverage: number[];
  threshold: number;
  pressure: ResourcePressure;
}

export interface NetworkState {
  activeConnections: number;
  bandwidth: number;
  latency: number;
  threshold: number;
  pressure: ResourcePressure;
}

export interface StorageState {
  used: number;
  available: number;
  ioRate: number;
  threshold: number;
  pressure: ResourcePressure;
}

export interface VoiceState {
  activeOperations: number;
  queueDepth: number;
  averageLatency: number;
  threshold: number;
  pressure: ResourcePressure;
}

export interface AvatarState {
  renderingLoad: number;
  animationQueue: number;
  frameRate: number;
  threshold: number;
  pressure: ResourcePressure;
}

export enum ResourcePressure {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ProcessingRequest {
  id: string;
  type: ProcessingType;
  priority: ProcessingPriority;
  resourceRequirements: ResourceRequirements;
  estimatedDuration: number;
  deadline?: Date;
  canDegrade: boolean;
  degradationOptions?: DegradationOption[];
}

export enum ProcessingType {
  CALENDAR_OPERATION = 'calendar_operation',
  REMINDER_DELIVERY = 'reminder_delivery',
  SYNC_OPERATION = 'sync_operation',
  FAMILY_COORDINATION = 'family_coordination',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  INDEX_OPTIMIZATION = 'index_optimization'
}

export enum ProcessingPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface ResourceRequirements {
  memoryMB: number;
  cpuPercent: number;
  networkBandwidth: number;
  storageIO: number;
  voiceOperations: number;
  avatarOperations: number;
}

export interface DegradationOption {
  level: DegradationLevel;
  resourceReduction: Partial<ResourceRequirements>;
  qualityImpact: QualityImpact;
  description: string;
}

export enum DegradationLevel {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

export interface QualityImpact {
  userExperience: number; // 0-1 scale
  functionality: number; // 0-1 scale
  performance: number; // 0-1 scale
}

export interface ProcessingResult {
  success: boolean;
  actualDuration: number;
  resourcesUsed: ResourceRequirements;
  degradationApplied?: DegradationLevel;
  qualityMetrics?: QualityMetrics;
}

export interface QualityMetrics {
  responseTime: number;
  accuracy: number;
  completeness: number;
  userSatisfaction: number;
}

export class ResourceAwareProcessor extends EventEmitter {
  private resourceState: ResourceState;
  private processingQueue: ProcessingRequest[] = [];
  private activeProcessing: Map<string, ProcessingRequest> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private processingInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private degradationHistory: Map<string, DegradationLevel[]> = new Map();

  constructor() {
    super();
    this.resourceState = this.initializeResourceState();
  }

  /**
   * Start resource-aware processing
   */
  public start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    
    // Start resource monitoring
    this.monitoringInterval = setInterval(() => {
      this.updateResourceState();
      this.analyzeResourcePressure();
    }, 1000);

    // Start processing queue
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 500);

    this.emit('processor_started');
  }

  /**
   * Stop resource-aware processing
   */
  public async stop(): Promise<void> {
    this.isActive = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active processing to complete
    while (this.activeProcessing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.emit('processor_stopped');
  }

  /**
   * Submit processing request
   */
  public submitRequest(request: Omit<ProcessingRequest, 'id'>): string {
    const processingRequest: ProcessingRequest = {
      id: this.generateRequestId(),
      ...request
    };

    // Check if request can be processed immediately
    if (this.canProcessImmediately(processingRequest)) {
      this.processRequest(processingRequest);
    } else {
      // Add to queue with priority ordering
      this.insertRequestByPriority(processingRequest);
      this.emit('request_queued', processingRequest);
    }

    return processingRequest.id;
  }

  /**
   * Cancel processing request
   */
  public cancelRequest(requestId: string): boolean {
    // Check queue first
    const queueIndex = this.processingQueue.findIndex(req => req.id === requestId);
    if (queueIndex !== -1) {
      const cancelled = this.processingQueue.splice(queueIndex, 1)[0];
      this.emit('request_cancelled', cancelled);
      return true;
    }

    // Check active processing
    if (this.activeProcessing.has(requestId)) {
      // Mark for cancellation
      this.emit('request_cancellation_requested', requestId);
      return true;
    }

    return false;
  }

  /**
   * Get current resource state
   */
  public getResourceState(): ResourceState {
    return { ...this.resourceState };
  }

  /**
   * Get processing statistics
   */
  public getProcessingStats(): {
    queueLength: number;
    activeProcessing: number;
    resourcePressure: ResourcePressure;
    degradationActive: boolean;
  } {
    const overallPressure = this.calculateOverallResourcePressure();
    const degradationActive = Array.from(this.degradationHistory.values())
      .some(history => history.length > 0 && history[history.length - 1] !== DegradationLevel.MINIMAL);

    return {
      queueLength: this.processingQueue.length,
      activeProcessing: this.activeProcessing.size,
      resourcePressure: overallPressure,
      degradationActive
    };
  }

  private initializeResourceState(): ResourceState {
    return {
      memory: {
        used: 0,
        available: 0,
        total: 1024 * 1024 * 1024, // 1GB for Jetson Nano Orin
        threshold: 1024 * 1024 * 1024 * 0.8, // 80% threshold
        pressure: ResourcePressure.LOW
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0],
        threshold: 80, // 80% threshold
        pressure: ResourcePressure.LOW
      },
      network: {
        activeConnections: 0,
        bandwidth: 0,
        latency: 0,
        threshold: 10, // Max 10 concurrent connections
        pressure: ResourcePressure.LOW
      },
      storage: {
        used: 0,
        available: 0,
        ioRate: 0,
        threshold: 50, // 50 MB/s threshold
        pressure: ResourcePressure.LOW
      },
      voice: {
        activeOperations: 0,
        queueDepth: 0,
        averageLatency: 0,
        threshold: 2, // Max 2 concurrent voice operations
        pressure: ResourcePressure.LOW
      },
      avatar: {
        renderingLoad: 0,
        animationQueue: 0,
        frameRate: 60,
        threshold: 80, // 80% rendering load threshold
        pressure: ResourcePressure.LOW
      }
    };
  }

  private updateResourceState(): void {
    // Update memory state
    const memUsage = process.memoryUsage();
    this.resourceState.memory.used = memUsage.rss;
    this.resourceState.memory.available = this.resourceState.memory.total - memUsage.rss;
    this.resourceState.memory.pressure = this.calculateMemoryPressure();

    // Update CPU state
    const cpuUsage = process.cpuUsage();
    this.resourceState.cpu.usage = (cpuUsage.user + cpuUsage.system) / 10000; // Rough percentage
    this.resourceState.cpu.pressure = this.calculateCpuPressure();

    // Update other resource states (simplified for this implementation)
    this.resourceState.network.pressure = this.calculateNetworkPressure();
    this.resourceState.storage.pressure = this.calculateStoragePressure();
    this.resourceState.voice.pressure = this.calculateVoicePressure();
    this.resourceState.avatar.pressure = this.calculateAvatarPressure();
  }

  private calculateMemoryPressure(): ResourcePressure {
    const usagePercent = (this.resourceState.memory.used / this.resourceState.memory.total) * 100;
    
    if (usagePercent >= 95) return ResourcePressure.CRITICAL;
    if (usagePercent >= 85) return ResourcePressure.HIGH;
    if (usagePercent >= 70) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateCpuPressure(): ResourcePressure {
    const usage = this.resourceState.cpu.usage;
    
    if (usage >= 95) return ResourcePressure.CRITICAL;
    if (usage >= 80) return ResourcePressure.HIGH;
    if (usage >= 60) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateNetworkPressure(): ResourcePressure {
    const connections = this.resourceState.network.activeConnections;
    const threshold = this.resourceState.network.threshold;
    
    if (connections >= threshold) return ResourcePressure.CRITICAL;
    if (connections >= threshold * 0.8) return ResourcePressure.HIGH;
    if (connections >= threshold * 0.6) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateStoragePressure(): ResourcePressure {
    const ioRate = this.resourceState.storage.ioRate;
    const threshold = this.resourceState.storage.threshold;
    
    if (ioRate >= threshold) return ResourcePressure.CRITICAL;
    if (ioRate >= threshold * 0.8) return ResourcePressure.HIGH;
    if (ioRate >= threshold * 0.6) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateVoicePressure(): ResourcePressure {
    const operations = this.resourceState.voice.activeOperations;
    const threshold = this.resourceState.voice.threshold;
    
    if (operations >= threshold) return ResourcePressure.CRITICAL;
    if (operations >= threshold * 0.8) return ResourcePressure.HIGH;
    if (operations >= threshold * 0.6) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateAvatarPressure(): ResourcePressure {
    const load = this.resourceState.avatar.renderingLoad;
    const threshold = this.resourceState.avatar.threshold;
    
    if (load >= threshold) return ResourcePressure.CRITICAL;
    if (load >= threshold * 0.8) return ResourcePressure.HIGH;
    if (load >= threshold * 0.6) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private calculateOverallResourcePressure(): ResourcePressure {
    const pressures = [
      this.resourceState.memory.pressure,
      this.resourceState.cpu.pressure,
      this.resourceState.network.pressure,
      this.resourceState.storage.pressure,
      this.resourceState.voice.pressure,
      this.resourceState.avatar.pressure
    ];

    // Return highest pressure level
    if (pressures.includes(ResourcePressure.CRITICAL)) return ResourcePressure.CRITICAL;
    if (pressures.includes(ResourcePressure.HIGH)) return ResourcePressure.HIGH;
    if (pressures.includes(ResourcePressure.MEDIUM)) return ResourcePressure.MEDIUM;
    return ResourcePressure.LOW;
  }

  private analyzeResourcePressure(): void {
    const overallPressure = this.calculateOverallResourcePressure();
    
    if (overallPressure === ResourcePressure.CRITICAL) {
      this.handleCriticalResourcePressure();
    } else if (overallPressure === ResourcePressure.HIGH) {
      this.handleHighResourcePressure();
    } else if (overallPressure === ResourcePressure.MEDIUM) {
      this.handleMediumResourcePressure();
    }

    this.emit('resource_pressure_analyzed', overallPressure);
  }

  private handleCriticalResourcePressure(): void {
    // Implement severe degradation
    this.processingQueue.forEach(request => {
      if (request.canDegrade && request.priority >= ProcessingPriority.MEDIUM) {
        this.applyDegradation(request, DegradationLevel.SEVERE);
      }
    });

    // Cancel low-priority requests
    this.processingQueue = this.processingQueue.filter(request => {
      if (request.priority >= ProcessingPriority.LOW) {
        this.emit('request_cancelled_pressure', request);
        return false;
      }
      return true;
    });

    this.emit('critical_pressure_handled');
  }

  private handleHighResourcePressure(): void {
    // Implement significant degradation
    this.processingQueue.forEach(request => {
      if (request.canDegrade && request.priority >= ProcessingPriority.LOW) {
        this.applyDegradation(request, DegradationLevel.SIGNIFICANT);
      }
    });

    this.emit('high_pressure_handled');
  }

  private handleMediumResourcePressure(): void {
    // Implement moderate degradation
    this.processingQueue.forEach(request => {
      if (request.canDegrade && request.priority >= ProcessingPriority.BACKGROUND) {
        this.applyDegradation(request, DegradationLevel.MODERATE);
      }
    });

    this.emit('medium_pressure_handled');
  }

  private processQueue(): void {
    if (!this.isActive || this.processingQueue.length === 0) {
      return;
    }

    // Process requests that can fit within current resource constraints
    while (this.processingQueue.length > 0) {
      const request = this.processingQueue[0];
      
      if (this.canProcessRequest(request)) {
        this.processingQueue.shift();
        this.processRequest(request);
      } else {
        break; // Wait for resources to become available
      }
    }
  }

  private canProcessImmediately(request: ProcessingRequest): boolean {
    return this.canProcessRequest(request) && this.activeProcessing.size < 3;
  }

  private canProcessRequest(request: ProcessingRequest): boolean {
    const requirements = request.resourceRequirements;
    const state = this.resourceState;

    return (
      state.memory.available >= requirements.memoryMB * 1024 * 1024 &&
      state.cpu.usage + requirements.cpuPercent <= state.cpu.threshold &&
      state.network.activeConnections + (requirements.networkBandwidth > 0 ? 1 : 0) <= state.network.threshold &&
      state.voice.activeOperations + requirements.voiceOperations <= state.voice.threshold &&
      state.avatar.renderingLoad + requirements.avatarOperations <= state.avatar.threshold
    );
  }

  private async processRequest(request: ProcessingRequest): Promise<void> {
    const startTime = performance.now();
    this.activeProcessing.set(request.id, request);

    try {
      this.emit('request_processing_started', request);
      
      // Simulate processing based on request type
      await this.executeProcessing(request);
      
      const duration = performance.now() - startTime;
      const result: ProcessingResult = {
        success: true,
        actualDuration: duration,
        resourcesUsed: request.resourceRequirements,
        degradationApplied: this.getCurrentDegradation(request.id)
      };

      this.activeProcessing.delete(request.id);
      this.emit('request_processing_completed', request, result);

    } catch (error) {
      const duration = performance.now() - startTime;
      const result: ProcessingResult = {
        success: false,
        actualDuration: duration,
        resourcesUsed: request.resourceRequirements
      };

      this.activeProcessing.delete(request.id);
      this.emit('request_processing_failed', request, result, error);
    }
  }

  private async executeProcessing(request: ProcessingRequest): Promise<void> {
    // Simulate processing time based on request type and degradation
    const baseDuration = request.estimatedDuration;
    const degradation = this.getCurrentDegradation(request.id);
    const degradationMultiplier = this.getDegradationMultiplier(degradation);
    
    const actualDuration = baseDuration * degradationMultiplier;
    await new Promise(resolve => setTimeout(resolve, actualDuration));
  }

  private applyDegradation(request: ProcessingRequest, level: DegradationLevel): void {
    if (!request.degradationOptions) {
      return;
    }

    const option = request.degradationOptions.find(opt => opt.level === level);
    if (!option) {
      return;
    }

    // Apply resource reduction
    if (option.resourceReduction.memoryMB) {
      request.resourceRequirements.memoryMB -= option.resourceReduction.memoryMB;
    }
    if (option.resourceReduction.cpuPercent) {
      request.resourceRequirements.cpuPercent -= option.resourceReduction.cpuPercent;
    }

    // Record degradation
    if (!this.degradationHistory.has(request.id)) {
      this.degradationHistory.set(request.id, []);
    }
    this.degradationHistory.get(request.id)!.push(level);

    this.emit('degradation_applied', request, level, option);
  }

  private getCurrentDegradation(requestId: string): DegradationLevel | undefined {
    const history = this.degradationHistory.get(requestId);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  private getDegradationMultiplier(level?: DegradationLevel): number {
    switch (level) {
      case DegradationLevel.MINIMAL: return 1.1;
      case DegradationLevel.MODERATE: return 1.3;
      case DegradationLevel.SIGNIFICANT: return 1.6;
      case DegradationLevel.SEVERE: return 2.0;
      default: return 1.0;
    }
  }

  private insertRequestByPriority(request: ProcessingRequest): void {
    let insertIndex = 0;
    
    for (let i = 0; i < this.processingQueue.length; i++) {
      const existing = this.processingQueue[i];
      
      if (request.priority < existing.priority) {
        insertIndex = i;
        break;
      } else if (request.priority === existing.priority) {
        // Same priority, check deadline
        if (request.deadline && existing.deadline && request.deadline < existing.deadline) {
          insertIndex = i;
          break;
        }
      }
      
      insertIndex = i + 1;
    }
    
    this.processingQueue.splice(insertIndex, 0, request);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ResourceAwareProcessor;