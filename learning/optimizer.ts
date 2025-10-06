// Model Optimizer for Jetson Nano Orin

import { 
  ModelOptimizer, 
  OptimizationGoals, 
  OptimizationSchedule, 
  PerformanceReport, 
  PruningStrategy, 
  PruningResult, 
  QuantizationLevel, 
  QuantizationResult
} from '../models/types';
import { OptimizationResult } from './types';
import { LearningEventBus, LearningEventType } from './events';
import { LearningEngineError } from './errors';

export class JetsonModelOptimizer implements ModelOptimizer {
  private eventBus: LearningEventBus;
  private optimizationSchedules: Map<string, OptimizationSchedule> = new Map();
  private performanceHistory: Map<string, PerformanceMetric[]> = new Map();
  private hardwareMonitor: JetsonHardwareMonitor;
  private optimizationCache: Map<string, OptimizationResult> = new Map();

  // Jetson Nano Orin specific constraints
  private readonly JETSON_MAX_MEMORY_MB = 8192; // 8GB total
  private readonly JETSON_AVAILABLE_MEMORY_MB = 6144; // 6GB available for apps
  private readonly JETSON_TARGET_LATENCY_MS = 100;
  private readonly JETSON_MIN_ACCURACY = 0.75;
  private readonly JETSON_MAX_CPU_TEMP = 85; // Celsius
  private readonly JETSON_MAX_GPU_TEMP = 90; // Celsius
  private readonly JETSON_POWER_BUDGET_W = 15; // Watts

  constructor(eventBus: LearningEventBus) {
    this.eventBus = eventBus;
    this.hardwareMonitor = new JetsonHardwareMonitor();
    this.initializeOptimizer();
  }

  private async initializeOptimizer(): Promise<void> {
    // Start hardware monitoring
    await this.hardwareMonitor.startMonitoring();
    
    // Set up thermal throttling detection
    this.hardwareMonitor.onThermalThrottling((event) => {
      this.handleThermalThrottling(event);
    });

    // Set up memory pressure detection
    this.hardwareMonitor.onMemoryPressure((event) => {
      this.handleMemoryPressure(event);
    });
  }

  public async optimizeModel(userId: string, optimizationGoals: OptimizationGoals): Promise<OptimizationResult> {
    try {
      await this.eventBus.emit({
        id: this.generateId(),
        type: LearningEventType.OPTIMIZATION_TRIGGERED,
        timestamp: new Date(),
        userId,
        data: { optimizationGoals }
      });

      // Check if we have cached optimization results
      const cacheKey = this.generateCacheKey(userId, optimizationGoals);
      const cachedResult = this.optimizationCache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        return cachedResult;
      }

      // Get current hardware state
      const hardwareState = await this.hardwareMonitor.getCurrentState();
      
      // Validate optimization goals against Jetson constraints and current hardware state
      const validatedGoals = this.validateOptimizationGoals(optimizationGoals, hardwareState);

      // Get current model performance
      const currentPerformance = await this.getCurrentModelPerformance(userId);

      // Determine hardware-aware optimization strategy
      const strategy = this.determineHardwareAwareStrategy(currentPerformance, validatedGoals, hardwareState);

      // Check if optimization is safe to proceed given current hardware state
      if (!this.isOptimizationSafe(hardwareState)) {
        throw new Error('Optimization postponed due to hardware constraints (thermal/power)');
      }

      // Execute optimization with hardware monitoring
      const result = await this.executeHardwareAwareOptimization(userId, strategy, validatedGoals, hardwareState);

      // Cache the result
      this.optimizationCache.set(cacheKey, result);

      await this.eventBus.emit({
        id: this.generateId(),
        type: LearningEventType.OPTIMIZATION_COMPLETED,
        timestamp: new Date(),
        userId,
        data: { result, hardwareState }
      });

      return result;

    } catch (error) {
      const optimizationError = new Error(`Model optimization failed: ${error.message}`);

      await this.eventBus.emit({
        id: this.generateId(),
        type: LearningEventType.OPTIMIZATION_FAILED,
        timestamp: new Date(),
        userId,
        data: { error: optimizationError.message }
      });

      throw optimizationError;
    }
  }

  public async scheduleOptimization(userId: string, schedule: OptimizationSchedule): Promise<void> {
    this.optimizationSchedules.set(userId, schedule);
    
    // Start scheduled optimization if frequency is continuous
    if (schedule.frequency === 'continuous' as any) {
      this.startContinuousOptimization(userId, schedule);
    }
  }

  public async monitorModelPerformance(userId: string): Promise<PerformanceReport> {
    const performanceMetrics = this.performanceHistory.get(userId) || [];
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

    // Get recent metrics
    const recentMetrics = performanceMetrics.filter(metric => 
      metric.timestamp >= oneHourAgo
    );

    // Calculate trends
    const trends = this.calculatePerformanceTrends(recentMetrics);

    // Identify issues
    const issues = this.identifyPerformanceIssues(recentMetrics);

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(trends, issues);

    return {
      reportId: this.generateId(),
      userId,
      generatedAt: currentTime,
      timeRange: {
        start: oneHourAgo,
        end: currentTime,
        duration: 60 * 60 * 1000
      },
      metrics: this.aggregateMetrics(recentMetrics),
      trends,
      issues,
      recommendations
    };
  }

  public async pruneModel(userId: string, pruningStrategy: PruningStrategy): Promise<PruningResult> {
    try {
      // Get current model size and performance
      const currentMetrics = await this.getCurrentModelPerformance(userId);
      const originalSize = currentMetrics.memoryUsage;

      // Simulate pruning based on strategy
      const pruningResult = await this.executePruning(userId, pruningStrategy, currentMetrics);

      // Validate pruned model meets quality thresholds
      if (pruningResult.qualityMetrics.accuracy < pruningStrategy.qualityThreshold) {
        throw new Error('Pruning resulted in unacceptable quality degradation');
      }

      return pruningResult;

    } catch (error) {
      throw new Error(`Model pruning failed: ${error.message}`);
    }
  }

  public async quantizeModel(userId: string, quantizationLevel: QuantizationLevel): Promise<QuantizationResult> {
    try {
      // Get current model performance
      const currentMetrics = await this.getCurrentModelPerformance(userId);

      // Execute quantization
      const quantizationResult = await this.executeQuantization(userId, quantizationLevel, currentMetrics);

      // Validate quantized model performance
      if (quantizationResult.accuracyImpact > 0.1) { // Max 10% accuracy loss
        throw new Error('Quantization resulted in excessive accuracy loss');
      }

      return quantizationResult;

    } catch (error) {
      throw new Error(`Model quantization failed: ${error.message}`);
    }
  }

  // Hardware-aware optimization methods
  private validateOptimizationGoals(goals: OptimizationGoals, hardwareState?: HardwareState): OptimizationGoals {
    let adjustedGoals = {
      targetLatency: Math.max(goals.targetLatency, this.JETSON_TARGET_LATENCY_MS),
      maxMemoryUsage: Math.min(goals.maxMemoryUsage, this.JETSON_AVAILABLE_MEMORY_MB),
      minAccuracy: Math.max(goals.minAccuracy, this.JETSON_MIN_ACCURACY),
      energyEfficiency: goals.energyEfficiency,
      prioritizeFeatures: goals.prioritizeFeatures || []
    };

    // Adjust goals based on current hardware state
    if (hardwareState) {
      // If thermal throttling is active, be more aggressive with optimization
      if (hardwareState.thermalThrottling) {
        adjustedGoals.targetLatency = Math.min(adjustedGoals.targetLatency, 80); // More aggressive latency target
        adjustedGoals.energyEfficiency = true; // Force energy efficiency
      }

      // If memory pressure is high, reduce memory target
      if (hardwareState.memoryPressure > 0.8) {
        adjustedGoals.maxMemoryUsage = Math.min(adjustedGoals.maxMemoryUsage, this.JETSON_AVAILABLE_MEMORY_MB * 0.7);
      }

      // If power consumption is high, prioritize energy efficiency
      if (hardwareState.powerConsumption > this.JETSON_POWER_BUDGET_W * 0.8) {
        adjustedGoals.energyEfficiency = true;
      }
    }

    return adjustedGoals;
  }

  private determineHardwareAwareStrategy(
    currentPerformance: PerformanceMetric, 
    goals: OptimizationGoals,
    hardwareState: HardwareState
  ): OptimizationStrategy {
    const strategies: OptimizationTechnique[] = [];

    // Base strategy determination
    if (currentPerformance.latency > goals.targetLatency) {
      strategies.push('model_pruning', 'quantization', 'architecture_optimization');
    }

    if (currentPerformance.memoryUsage > goals.maxMemoryUsage) {
      strategies.push('model_compression', 'quantization', 'feature_selection');
    }

    if (currentPerformance.accuracy < goals.minAccuracy) {
      strategies.push('ensemble_methods', 'data_augmentation', 'hyperparameter_tuning');
    }

    // Hardware-specific optimizations
    if (hardwareState.thermalThrottling || hardwareState.cpuTemp > this.JETSON_MAX_CPU_TEMP * 0.9) {
      strategies.push('thermal_optimization', 'dynamic_inference', 'model_distillation');
    }

    if (hardwareState.memoryPressure > 0.8) {
      strategies.push('aggressive_compression', 'memory_optimization', 'gradient_checkpointing');
    }

    if (hardwareState.powerConsumption > this.JETSON_POWER_BUDGET_W * 0.8 || goals.energyEfficiency) {
      strategies.push('quantization', 'dynamic_inference', 'power_optimization');
    }

    // GPU-specific optimizations for Jetson
    if (hardwareState.gpuUtilization > 0.9) {
      strategies.push('gpu_memory_optimization', 'tensor_fusion', 'kernel_optimization');
    }

    return {
      techniques: [...new Set(strategies)], // Remove duplicates
      priority: this.calculateHardwareAwarePriority(currentPerformance, goals, hardwareState),
      estimatedDuration: this.estimateOptimizationDuration(strategies.length, hardwareState),
      resourceRequirements: this.calculateHardwareAwareResourceRequirements(strategies, hardwareState),
      thermalConstraints: this.calculateThermalConstraints(hardwareState),
      powerConstraints: this.calculatePowerConstraints(hardwareState)
    };
  }

  private async executeHardwareAwareOptimization(
    userId: string, 
    strategy: OptimizationStrategy, 
    goals: OptimizationGoals,
    hardwareState: HardwareState
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    let totalSizeReduction = 0;
    let totalPerformanceImprovement = 0;
    const optimizationSteps: OptimizationStep[] = [];

    // Monitor hardware during optimization
    const hardwareMonitoringInterval = setInterval(async () => {
      const currentState = await this.hardwareMonitor.getCurrentState();
      if (!this.isOptimizationSafe(currentState)) {
        clearInterval(hardwareMonitoringInterval);
        throw new Error('Optimization halted due to hardware constraints');
      }
    }, 5000); // Check every 5 seconds

    try {
      // Execute each optimization technique with hardware awareness
      for (const technique of strategy.techniques) {
        const stepStartTime = Date.now();
        
        // Check hardware state before each step
        const currentHardwareState = await this.hardwareMonitor.getCurrentState();
        
        // Adjust technique parameters based on hardware state
        const adjustedTechnique = this.adjustTechniqueForHardware(technique, currentHardwareState);
        
        const techniqueResult = await this.executeHardwareAwareTechnique(
          userId, 
          adjustedTechnique, 
          goals, 
          currentHardwareState
        );
        
        totalSizeReduction += techniqueResult.sizeReduction;
        totalPerformanceImprovement += techniqueResult.performanceImprovement;
        
        optimizationSteps.push({
          technique: adjustedTechnique,
          result: techniqueResult,
          duration: Date.now() - stepStartTime,
          hardwareState: currentHardwareState
        });

        // Add delay between techniques to prevent thermal buildup
        if (currentHardwareState.cpuTemp > this.JETSON_MAX_CPU_TEMP * 0.8) {
          await this.simulateAsyncOperation(2000); // 2 second cooling delay
        }
      }

      clearInterval(hardwareMonitoringInterval);

      const executionTime = Date.now() - startTime;
      const finalHardwareState = await this.hardwareMonitor.getCurrentState();

      return {
        optimized: true,
        sizeBefore: 1000, // Would be actual model size
        sizeAfter: 1000 - totalSizeReduction,
        performanceImprovement: totalPerformanceImprovement,
        memoryReduction: totalSizeReduction,
        executionTime,
        hardwareImpact: {
          thermalImpact: finalHardwareState.cpuTemp - hardwareState.cpuTemp,
          powerImpact: finalHardwareState.powerConsumption - hardwareState.powerConsumption,
          memoryImpact: finalHardwareState.memoryUsage - hardwareState.memoryUsage
        },
        optimizationSteps,
        jetsonSpecificMetrics: {
          gpuUtilizationImprovement: this.calculateGpuUtilizationImprovement(optimizationSteps),
          tensorRtOptimization: this.hasTensorRtOptimization(optimizationSteps),
          cudaKernelOptimization: this.hasCudaKernelOptimization(optimizationSteps)
        }
      };

    } catch (error) {
      clearInterval(hardwareMonitoringInterval);
      throw error;
    }
  }

  private isOptimizationSafe(hardwareState: HardwareState): boolean {
    return (
      hardwareState.cpuTemp < this.JETSON_MAX_CPU_TEMP &&
      hardwareState.gpuTemp < this.JETSON_MAX_GPU_TEMP &&
      hardwareState.powerConsumption < this.JETSON_POWER_BUDGET_W &&
      hardwareState.memoryPressure < 0.95 &&
      !hardwareState.thermalThrottling
    );
  }

  private adjustTechniqueForHardware(
    technique: OptimizationTechnique, 
    hardwareState: HardwareState
  ): OptimizationTechnique {
    // Adjust technique aggressiveness based on hardware state
    if (hardwareState.thermalThrottling) {
      // Use more aggressive techniques when thermal throttling
      if (technique === 'model_pruning') return 'aggressive_pruning' as OptimizationTechnique;
      if (technique === 'quantization') return 'aggressive_quantization' as OptimizationTechnique;
    }

    if (hardwareState.memoryPressure > 0.9) {
      // Use memory-focused techniques
      if (technique === 'model_compression') return 'aggressive_compression' as OptimizationTechnique;
    }

    return technique;
  }

  private async executeHardwareAwareTechnique(
    userId: string, 
    technique: OptimizationTechnique, 
    goals: OptimizationGoals,
    hardwareState: HardwareState
  ): Promise<TechniqueResult> {
    // Adjust execution based on hardware constraints
    const executionTime = this.calculateTechniqueExecutionTime(technique, hardwareState);
    await this.simulateAsyncOperation(executionTime);

    // Hardware-aware technique results
    switch (technique) {
      case 'model_pruning':
        return this.executeJetsonPruning(hardwareState);
      case 'quantization':
        return this.executeJetsonQuantization(hardwareState);
      case 'thermal_optimization':
        return this.executeThermalOptimization(hardwareState);
      case 'gpu_memory_optimization':
        return this.executeGpuMemoryOptimization(hardwareState);
      case 'tensor_fusion':
        return this.executeTensorFusion(hardwareState);
      case 'aggressive_pruning':
        return this.executeAggressivePruning(hardwareState);
      case 'aggressive_quantization':
        return this.executeAggressiveQuantization(hardwareState);
      default:
        // Fallback to basic technique execution
        await this.simulateAsyncOperation(500);
        return { sizeReduction: 50, performanceImprovement: 10 };
    }
  }

  private executeJetsonPruning(hardwareState: HardwareState): TechniqueResult {
    // Jetson-optimized pruning with CUDA acceleration
    const baseReduction = 150 + Math.random() * 200;
    const baseImprovement = 15 + Math.random() * 25;
    
    // Adjust based on GPU utilization
    const gpuBonus = hardwareState.gpuUtilization > 0.5 ? 1.2 : 1.0;
    
    return {
      sizeReduction: baseReduction * gpuBonus,
      performanceImprovement: baseImprovement * gpuBonus
    };
  }

  private executeJetsonQuantization(hardwareState: HardwareState): TechniqueResult {
    // Jetson-optimized quantization with TensorRT
    const baseReduction = 200 + Math.random() * 300;
    const baseImprovement = 20 + Math.random() * 30;
    
    // TensorRT provides significant improvements on Jetson
    const tensorRtBonus = 1.5;
    
    return {
      sizeReduction: baseReduction * tensorRtBonus,
      performanceImprovement: baseImprovement * tensorRtBonus
    };
  }

  private executeThermalOptimization(hardwareState: HardwareState): TechniqueResult {
    // Thermal-aware optimization
    const thermalReduction = hardwareState.thermalThrottling ? 100 : 50;
    const performanceGain = hardwareState.thermalThrottling ? 25 : 15;
    
    return {
      sizeReduction: thermalReduction,
      performanceImprovement: performanceGain
    };
  }

  private executeGpuMemoryOptimization(hardwareState: HardwareState): TechniqueResult {
    // GPU memory optimization for Jetson
    const memoryReduction = 80 + (hardwareState.gpuMemoryUsage * 100);
    const performanceGain = 10 + (hardwareState.gpuUtilization * 20);
    
    return {
      sizeReduction: memoryReduction,
      performanceImprovement: performanceGain
    };
  }

  private executeTensorFusion(hardwareState: HardwareState): TechniqueResult {
    // Tensor fusion optimization
    return {
      sizeReduction: 30 + Math.random() * 50,
      performanceImprovement: 25 + Math.random() * 35
    };
  }

  private executeAggressivePruning(hardwareState: HardwareState): TechniqueResult {
    // More aggressive pruning for thermal constraints
    const result = this.executeJetsonPruning(hardwareState);
    return {
      sizeReduction: result.sizeReduction * 1.5,
      performanceImprovement: result.performanceImprovement * 1.3
    };
  }

  private executeAggressiveQuantization(hardwareState: HardwareState): TechniqueResult {
    // More aggressive quantization for memory constraints
    const result = this.executeJetsonQuantization(hardwareState);
    return {
      sizeReduction: result.sizeReduction * 1.4,
      performanceImprovement: result.performanceImprovement * 1.2
    };
  }

  private handleThermalThrottling(event: ThermalEvent): void {
    // Trigger emergency optimization for all active models
    this.performanceHistory.forEach(async (_, userId) => {
      const emergencyGoals: OptimizationGoals = {
        targetLatency: 50, // Very aggressive
        maxMemoryUsage: this.JETSON_AVAILABLE_MEMORY_MB * 0.5,
        minAccuracy: this.JETSON_MIN_ACCURACY,
        energyEfficiency: true,
        prioritizeFeatures: ['thermal_optimization']
      };
      
      try {
        await this.optimizeModel(userId, emergencyGoals);
      } catch (error) {
        // Log error but continue with other users
        console.error(`Emergency optimization failed for user ${userId}:`, error);
      }
    });
  }

  private handleMemoryPressure(event: MemoryPressureEvent): void {
    // Trigger memory optimization for all active models
    this.performanceHistory.forEach(async (_, userId) => {
      const memoryGoals: OptimizationGoals = {
        targetLatency: this.JETSON_TARGET_LATENCY_MS,
        maxMemoryUsage: this.JETSON_AVAILABLE_MEMORY_MB * 0.6,
        minAccuracy: this.JETSON_MIN_ACCURACY,
        energyEfficiency: false,
        prioritizeFeatures: ['memory_optimization', 'aggressive_compression']
      };
      
      try {
        await this.optimizeModel(userId, memoryGoals);
      } catch (error) {
        console.error(`Memory optimization failed for user ${userId}:`, error);
      }
    });
  }

  private async getCurrentModelPerformance(userId: string): Promise<PerformanceMetric> {
    // Simulate getting current performance metrics
    return {
      timestamp: new Date(),
      latency: 80 + Math.random() * 40, // 80-120ms
      memoryUsage: 200 + Math.random() * 300, // 200-500MB
      accuracy: 0.8 + Math.random() * 0.15, // 80-95%
      throughput: 10 + Math.random() * 20, // 10-30 requests/sec
      cpuUsage: 30 + Math.random() * 40, // 30-70%
      energyConsumption: 5 + Math.random() * 10 // 5-15W
    };
  }

  // Legacy determineOptimizationStrategy method removed - using determineHardwareAwareStrategy

  // Legacy executeOptimization method removed - using executeHardwareAwareOptimization

  // Legacy executeTechnique method - replaced by executeHardwareAwareTechnique

  private async executePruning(
    userId: string, 
    strategy: PruningStrategy, 
    currentMetrics: PerformanceMetric
  ): Promise<PruningResult> {
    // Simulate pruning execution
    await this.simulateAsyncOperation(1000);

    const parametersRemoved = Math.floor(currentMetrics.memoryUsage * strategy.targetReduction / 100);
    const sizeReduction = parametersRemoved * 4; // Assume 4 bytes per parameter

    return {
      success: true,
      parametersRemoved,
      sizeReduction,
      performanceImpact: {
        latencyChange: -10 - Math.random() * 20, // Improvement
        memoryChange: -sizeReduction,
        accuracyChange: -0.01 - Math.random() * 0.05, // Small degradation
        throughputChange: 5 + Math.random() * 15
      },
      qualityMetrics: {
        accuracy: currentMetrics.accuracy - (0.01 + Math.random() * 0.05),
        precision: 0.85 + Math.random() * 0.1,
        recall: 0.8 + Math.random() * 0.15,
        f1Score: 0.82 + Math.random() * 0.13,
        robustness: 0.9 + Math.random() * 0.08
      }
    };
  }

  private async executeQuantization(
    userId: string, 
    level: QuantizationLevel, 
    currentMetrics: PerformanceMetric
  ): Promise<QuantizationResult> {
    // Simulate quantization execution
    await this.simulateAsyncOperation(800);

    let bitReduction: number;
    let sizeReduction: number;
    let speedImprovement: number;
    let accuracyImpact: number;

    switch (level) {
      case 'int8' as any:
        bitReduction = 24; // 32-bit to 8-bit
        sizeReduction = 75; // 75% size reduction
        speedImprovement = 200; // 2x speed improvement
        accuracyImpact = 0.05; // 5% accuracy loss
        break;
      case 'int16' as any:
        bitReduction = 16; // 32-bit to 16-bit
        sizeReduction = 50; // 50% size reduction
        speedImprovement = 150; // 1.5x speed improvement
        accuracyImpact = 0.02; // 2% accuracy loss
        break;
      case 'float16' as any:
        bitReduction = 16; // 32-bit to 16-bit float
        sizeReduction = 50; // 50% size reduction
        speedImprovement = 120; // 1.2x speed improvement
        accuracyImpact = 0.01; // 1% accuracy loss
        break;
      default:
        bitReduction = 8;
        sizeReduction = 25;
        speedImprovement = 110;
        accuracyImpact = 0.03;
    }

    return {
      success: true,
      bitReduction,
      sizeReduction,
      speedImprovement,
      accuracyImpact
    };
  }

  // Legacy calculateOptimizationPriority method - replaced by calculateHardwareAwarePriority

  // Legacy methods removed - using hardware-aware versions

  private validateOptimizationResults(
    goals: OptimizationGoals, 
    performanceImprovement: number, 
    sizeReduction: number
  ): boolean {
    // Check if optimization meets the specified goals
    return performanceImprovement > 10 && sizeReduction > 50; // Minimum thresholds
  }

  private calculatePerformanceTrends(metrics: PerformanceMetric[]): any[] {
    // Placeholder for trend calculation
    return [];
  }

  private identifyPerformanceIssues(metrics: PerformanceMetric[]): any[] {
    // Placeholder for issue identification
    return [];
  }

  private generateOptimizationRecommendations(trends: any[], issues: any[]): any[] {
    // Placeholder for recommendation generation
    return [];
  }

  private aggregateMetrics(metrics: PerformanceMetric[]): any {
    // Placeholder for metric aggregation
    return {};
  }

  private startContinuousOptimization(userId: string, schedule: OptimizationSchedule): void {
    // Placeholder for continuous optimization
  }

  private async simulateAsyncOperation(durationMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, durationMs));
  }

  private generateId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Additional helper methods for hardware-aware optimization
  private generateCacheKey(userId: string, goals: OptimizationGoals): string {
    const goalHash = JSON.stringify(goals);
    return `${userId}_${Buffer.from(goalHash).toString('base64').substring(0, 16)}`;
  }

  private isCacheValid(result: OptimizationResult): boolean {
    // Cache is valid for 1 hour
    const cacheAge = Date.now() - (result as any).timestamp;
    return cacheAge < 3600000; // 1 hour in milliseconds
  }

  private calculateHardwareAwarePriority(
    currentPerformance: PerformanceMetric, 
    goals: OptimizationGoals,
    hardwareState: HardwareState
  ): OptimizationPriority {
    let priority = 0;

    // Base priority calculation
    if (currentPerformance.latency > goals.targetLatency * 1.5) priority += 3;
    else if (currentPerformance.latency > goals.targetLatency) priority += 2;

    if (currentPerformance.memoryUsage > goals.maxMemoryUsage * 1.2) priority += 3;
    else if (currentPerformance.memoryUsage > goals.maxMemoryUsage) priority += 2;

    if (currentPerformance.accuracy < goals.minAccuracy) priority += 4;

    // Hardware-specific priority adjustments
    if (hardwareState.thermalThrottling) priority += 4;
    if (hardwareState.cpuTemp > this.JETSON_MAX_CPU_TEMP * 0.9) priority += 3;
    if (hardwareState.memoryPressure > 0.9) priority += 3;
    if (hardwareState.powerConsumption > this.JETSON_POWER_BUDGET_W * 0.9) priority += 2;

    if (priority >= 8) return 'critical' as any;
    if (priority >= 6) return 'high' as any;
    if (priority >= 3) return 'medium' as any;
    return 'low' as any;
  }

  private estimateOptimizationDuration(techniqueCount: number, hardwareState?: HardwareState): number {
    let baseDuration = 30000 + (techniqueCount * 15000); // 30s base + 15s per technique

    // Adjust for hardware state
    if (hardwareState) {
      // Thermal throttling slows down optimization
      if (hardwareState.thermalThrottling) {
        baseDuration *= 1.5;
      }

      // High CPU utilization slows down optimization
      if (hardwareState.cpuUtilization > 0.8) {
        baseDuration *= 1.2;
      }

      // Memory pressure slows down optimization
      if (hardwareState.memoryPressure > 0.8) {
        baseDuration *= 1.3;
      }
    }

    return baseDuration;
  }

  private calculateHardwareAwareResourceRequirements(
    techniques: OptimizationTechnique[], 
    hardwareState: HardwareState
  ): ResourceRequirements {
    const baseRequirements = {
      cpuCores: Math.min(4, techniques.length), // Max 4 cores on Jetson
      memoryMB: 512 + (techniques.length * 256),
      storageMB: 100 + (techniques.length * 50),
      estimatedDuration: this.estimateOptimizationDuration(techniques.length, hardwareState)
    };

    // Adjust based on hardware state
    if (hardwareState.thermalThrottling) {
      baseRequirements.cpuCores = Math.min(2, baseRequirements.cpuCores); // Reduce CPU usage
    }

    if (hardwareState.memoryPressure > 0.8) {
      baseRequirements.memoryMB = Math.min(256, baseRequirements.memoryMB); // Reduce memory usage
    }

    return baseRequirements;
  }

  private calculateThermalConstraints(hardwareState: HardwareState): ThermalConstraints {
    return {
      maxCpuTemp: this.JETSON_MAX_CPU_TEMP,
      maxGpuTemp: this.JETSON_MAX_GPU_TEMP,
      currentCpuTemp: hardwareState.cpuTemp,
      currentGpuTemp: hardwareState.gpuTemp,
      thermalMargin: Math.min(
        this.JETSON_MAX_CPU_TEMP - hardwareState.cpuTemp,
        this.JETSON_MAX_GPU_TEMP - hardwareState.gpuTemp
      ),
      coolingRequired: hardwareState.thermalThrottling
    };
  }

  private calculatePowerConstraints(hardwareState: HardwareState): PowerConstraints {
    return {
      maxPowerW: this.JETSON_POWER_BUDGET_W,
      currentPowerW: hardwareState.powerConsumption,
      powerMargin: this.JETSON_POWER_BUDGET_W - hardwareState.powerConsumption,
      powerEfficiencyRequired: hardwareState.powerConsumption > this.JETSON_POWER_BUDGET_W * 0.8
    };
  }

  private calculateTechniqueExecutionTime(
    technique: OptimizationTechnique, 
    hardwareState: HardwareState
  ): number {
    let baseTime = 500; // Base 500ms

    // Technique-specific timing
    switch (technique) {
      case 'quantization':
      case 'aggressive_quantization':
        baseTime = 800;
        break;
      case 'model_pruning':
      case 'aggressive_pruning':
        baseTime = 1000;
        break;
      case 'tensor_fusion':
        baseTime = 300;
        break;
      case 'thermal_optimization':
        baseTime = 200;
        break;
      default:
        baseTime = 500;
    }

    // Adjust for hardware state
    if (hardwareState.thermalThrottling) {
      baseTime *= 1.5; // Slower when throttling
    }

    if (hardwareState.cpuUtilization > 0.8) {
      baseTime *= 1.2; // Slower when CPU busy
    }

    return baseTime;
  }

  private calculateGpuUtilizationImprovement(steps: OptimizationStep[]): number {
    const gpuOptimizationSteps = steps.filter(step => 
      ['gpu_memory_optimization', 'tensor_fusion', 'kernel_optimization'].includes(step.technique)
    );
    
    return gpuOptimizationSteps.reduce((sum, step) => sum + step.result.performanceImprovement, 0);
  }

  private hasTensorRtOptimization(steps: OptimizationStep[]): boolean {
    return steps.some(step => 
      ['quantization', 'aggressive_quantization', 'tensor_fusion'].includes(step.technique)
    );
  }

  private hasCudaKernelOptimization(steps: OptimizationStep[]): boolean {
    return steps.some(step => 
      ['kernel_optimization', 'gpu_memory_optimization'].includes(step.technique)
    );
  }
}

// Additional interfaces
interface ThermalConstraints {
  maxCpuTemp: number;
  maxGpuTemp: number;
  currentCpuTemp: number;
  currentGpuTemp: number;
  thermalMargin: number;
  coolingRequired: boolean;
}

interface PowerConstraints {
  maxPowerW: number;
  currentPowerW: number;
  powerMargin: number;
  powerEfficiencyRequired: boolean;
}

// Supporting interfaces and types
interface PerformanceMetric {
  timestamp: Date;
  latency: number;
  memoryUsage: number;
  accuracy: number;
  throughput: number;
  cpuUsage: number;
  energyConsumption: number;
}

interface OptimizationStrategy {
  techniques: OptimizationTechnique[];
  priority: OptimizationPriority;
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
  thermalConstraints?: ThermalConstraints;
  powerConstraints?: PowerConstraints;
}

interface TechniqueResult {
  sizeReduction: number;
  performanceImprovement: number;
}

interface ResourceRequirements {
  cpuCores: number;
  memoryMB: number;
  storageMB: number;
  estimatedDuration: number;
}

type OptimizationTechnique = 
  | 'model_pruning' 
  | 'quantization' 
  | 'model_compression' 
  | 'architecture_optimization' 
  | 'feature_selection'
  | 'ensemble_methods'
  | 'data_augmentation'
  | 'hyperparameter_tuning'
  | 'dynamic_inference'
  | 'model_distillation'
  | 'thermal_optimization'
  | 'gpu_memory_optimization'
  | 'tensor_fusion'
  | 'kernel_optimization'
  | 'aggressive_pruning'
  | 'aggressive_quantization'
  | 'aggressive_compression'
  | 'memory_optimization'
  | 'gradient_checkpointing'
  | 'power_optimization';

type OptimizationPriority = 'low' | 'medium' | 'high' | 'critical';

// Jetson Hardware Monitor
class JetsonHardwareMonitor {
  private monitoringInterval?: NodeJS.Timeout;
  private thermalCallbacks: ((event: ThermalEvent) => void)[] = [];
  private memoryCallbacks: ((event: MemoryPressureEvent) => void)[] = [];

  async startMonitoring(): Promise<void> {
    this.monitoringInterval = setInterval(async () => {
      const state = await this.getCurrentState();
      
      // Check for thermal throttling
      if (state.thermalThrottling || state.cpuTemp > 85) {
        this.thermalCallbacks.forEach(callback => 
          callback({ 
            timestamp: new Date(), 
            cpuTemp: state.cpuTemp, 
            gpuTemp: state.gpuTemp,
            throttling: state.thermalThrottling 
          })
        );
      }

      // Check for memory pressure
      if (state.memoryPressure > 0.8) {
        this.memoryCallbacks.forEach(callback => 
          callback({ 
            timestamp: new Date(), 
            pressure: state.memoryPressure, 
            availableMemory: state.availableMemory 
          })
        );
      }
    }, 10000); // Monitor every 10 seconds
  }

  async getCurrentState(): Promise<HardwareState> {
    // Simulate hardware state reading
    // In production, this would read from actual Jetson sensors
    return {
      cpuTemp: 45 + Math.random() * 30, // 45-75°C
      gpuTemp: 50 + Math.random() * 25, // 50-75°C
      cpuUtilization: 0.3 + Math.random() * 0.4, // 30-70%
      gpuUtilization: 0.2 + Math.random() * 0.6, // 20-80%
      memoryUsage: 2048 + Math.random() * 2048, // 2-4GB
      memoryPressure: 0.4 + Math.random() * 0.4, // 40-80%
      availableMemory: 4096 - (2048 + Math.random() * 2048),
      gpuMemoryUsage: 0.3 + Math.random() * 0.4, // 30-70%
      powerConsumption: 8 + Math.random() * 5, // 8-13W
      thermalThrottling: Math.random() < 0.1, // 10% chance
      clockSpeed: 1.4 + Math.random() * 0.5, // 1.4-1.9 GHz
      fanSpeed: 2000 + Math.random() * 3000 // 2000-5000 RPM
    };
  }

  onThermalThrottling(callback: (event: ThermalEvent) => void): void {
    this.thermalCallbacks.push(callback);
  }

  onMemoryPressure(callback: (event: MemoryPressureEvent) => void): void {
    this.memoryCallbacks.push(callback);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Additional interfaces
interface HardwareState {
  cpuTemp: number;
  gpuTemp: number;
  cpuUtilization: number;
  gpuUtilization: number;
  memoryUsage: number;
  memoryPressure: number;
  availableMemory: number;
  gpuMemoryUsage: number;
  powerConsumption: number;
  thermalThrottling: boolean;
  clockSpeed: number;
  fanSpeed: number;
}

interface ThermalEvent {
  timestamp: Date;
  cpuTemp: number;
  gpuTemp: number;
  throttling: boolean;
}

interface MemoryPressureEvent {
  timestamp: Date;
  pressure: number;
  availableMemory: number;
}

interface OptimizationStep {
  technique: OptimizationTechnique;
  result: TechniqueResult;
  duration: number;
  hardwareState: HardwareState;
}

interface HardwareImpact {
  thermalImpact: number;
  powerImpact: number;
  memoryImpact: number;
}

interface JetsonSpecificMetrics {
  gpuUtilizationImprovement: number;
  tensorRtOptimization: boolean;
  cudaKernelOptimization: boolean;
}