/**
 * Audio preprocessing pipeline for speech recognition
 * Safety: No persistent audio storage - memory processing only
 * Performance: Optimized for real-time processing on Jetson Nano Orin
 */

import { AudioBuffer } from './interfaces';
import { VoiceProfile, AccentModel } from '../models/voice-models';

export interface PreprocessingConfig {
  noiseReduction: {
    enabled: boolean;
    strength: number; // 0.0 to 1.0
    adaptiveMode: boolean;
  };
  normalization: {
    enabled: boolean;
    targetLevel: number; // dB
    maxGain: number; // dB
  };
  filtering: {
    enabled: boolean;
    highPassCutoff: number; // Hz
    lowPassCutoff: number; // Hz
  };
  enhancement: {
    enabled: boolean;
    speechClarity: number; // 0.0 to 1.0
    dynamicRange: number; // 0.0 to 1.0
  };
}

export interface ProcessingMetrics {
  inputLevel: number;
  outputLevel: number;
  noiseLevel: number;
  processingTime: number;
  qualityScore: number;
}

export class AudioPreprocessor {
  private config: PreprocessingConfig;
  private sampleRate: number;
  private frameSize: number;

  constructor(config: PreprocessingConfig, sampleRate = 16000, frameSize = 1024) {
    this.config = config;
    this.sampleRate = sampleRate;
    this.frameSize = frameSize;
  }

  async processAudio(
    audioBuffer: AudioBuffer, 
    voiceProfile?: VoiceProfile
  ): Promise<{ processedBuffer: AudioBuffer; metrics: ProcessingMetrics }> {
    const startTime = Date.now();
    let processedData = new Float32Array(audioBuffer.data);
    
    const inputLevel = this.calculateRMS(processedData);
    let noiseLevel = 0;

    try {
      // Step 1: Noise reduction
      if (this.config.noiseReduction.enabled) {
        const noiseReductionResult = this.applyNoiseReduction(
          processedData, 
          this.config.noiseReduction,
          voiceProfile?.accentAdaptation
        );
        processedData = noiseReductionResult.processedData;
        noiseLevel = noiseReductionResult.noiseLevel;
      }

      // Step 2: Frequency filtering
      if (this.config.filtering.enabled) {
        processedData = this.applyFrequencyFiltering(processedData, this.config.filtering);
      }

      // Step 3: Normalization
      if (this.config.normalization.enabled) {
        processedData = this.applyNormalization(processedData, this.config.normalization);
      }

      // Step 4: Speech enhancement
      if (this.config.enhancement.enabled) {
        processedData = this.applySpeechEnhancement(
          processedData, 
          this.config.enhancement,
          voiceProfile
        );
      }

      const outputLevel = this.calculateRMS(processedData);
      const processingTime = Date.now() - startTime;
      const qualityScore = this.calculateQualityScore(inputLevel, outputLevel, noiseLevel);

      const processedBuffer: AudioBuffer = {
        ...audioBuffer,
        data: processedData
      };

      const metrics: ProcessingMetrics = {
        inputLevel,
        outputLevel,
        noiseLevel,
        processingTime,
        qualityScore
      };

      return { processedBuffer, metrics };

    } catch (error) {
      throw new Error(`Audio preprocessing failed: ${error.message}`);
    }
  }

  private applyNoiseReduction(
    audioData: Float32Array, 
    config: PreprocessingConfig['noiseReduction'],
    accentModel?: AccentModel
  ): { processedData: Float32Array; noiseLevel: number } {
    const processedData = new Float32Array(audioData.length);
    let noiseLevel = 0;

    // Spectral subtraction-based noise reduction
    const frameSize = this.frameSize;
    const hopSize = frameSize / 2;
    
    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      
      // Estimate noise level in current frame
      const frameNoiseLevel = this.estimateNoiseLevel(frame);
      noiseLevel = Math.max(noiseLevel, frameNoiseLevel);
      
      // Apply noise reduction
      const processedFrame = this.spectralSubtraction(frame, frameNoiseLevel, config.strength);
      
      // Apply accent-specific adjustments if available
      const finalFrame = accentModel 
        ? this.applyAccentAdaptation(processedFrame, accentModel)
        : processedFrame;
      
      // Overlap-add reconstruction
      for (let j = 0; j < frameSize && i + j < processedData.length; j++) {
        processedData[i + j] += finalFrame[j] * this.getWindow(j, frameSize);
      }
    }

    return { processedData, noiseLevel };
  }

  private estimateNoiseLevel(frame: Float32Array): number {
    // Simple noise estimation based on minimum statistics
    const sortedFrame = Array.from(frame).sort((a, b) => Math.abs(a) - Math.abs(b));
    const noiseFloor = sortedFrame.slice(0, Math.floor(frame.length * 0.1));
    return noiseFloor.reduce((sum, val) => sum + Math.abs(val), 0) / noiseFloor.length;
  }

  private spectralSubtraction(
    frame: Float32Array, 
    noiseLevel: number, 
    strength: number
  ): Float32Array {
    const processedFrame = new Float32Array(frame.length);
    
    for (let i = 0; i < frame.length; i++) {
      const signalLevel = Math.abs(frame[i]);
      const snr = signalLevel / (noiseLevel + 1e-10);
      
      // Apply spectral subtraction with over-subtraction factor
      const reductionFactor = Math.max(0.1, 1 - (strength * (1 / (1 + snr))));
      processedFrame[i] = frame[i] * reductionFactor;
    }
    
    return processedFrame;
  }

  private applyAccentAdaptation(frame: Float32Array, accentModel: AccentModel): Float32Array {
    // Apply accent-specific frequency adjustments
    const adaptedFrame = new Float32Array(frame.length);
    
    for (let i = 0; i < frame.length; i++) {
      // Simple accent adaptation based on stored adaptation data
      const adaptationFactor = accentModel.adaptationData[i % accentModel.adaptationData.length] || 1.0;
      adaptedFrame[i] = frame[i] * adaptationFactor;
    }
    
    return adaptedFrame;
  }

  private applyFrequencyFiltering(
    audioData: Float32Array, 
    config: PreprocessingConfig['filtering']
  ): Float32Array {
    // Simple high-pass and low-pass filtering
    const processedData = new Float32Array(audioData.length);
    
    // High-pass filter (remove low-frequency noise)
    const highPassAlpha = this.calculateFilterAlpha(config.highPassCutoff, this.sampleRate);
    let highPassPrev = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const highPassOutput = highPassAlpha * (highPassPrev + audioData[i] - (i > 0 ? audioData[i - 1] : 0));
      highPassPrev = highPassOutput;
      processedData[i] = highPassOutput;
    }
    
    // Low-pass filter (remove high-frequency noise)
    const lowPassAlpha = this.calculateFilterAlpha(config.lowPassCutoff, this.sampleRate);
    let lowPassPrev = 0;
    
    for (let i = 0; i < processedData.length; i++) {
      lowPassPrev = lowPassPrev + lowPassAlpha * (processedData[i] - lowPassPrev);
      processedData[i] = lowPassPrev;
    }
    
    return processedData;
  }

  private calculateFilterAlpha(cutoffFreq: number, sampleRate: number): number {
    const rc = 1.0 / (2.0 * Math.PI * cutoffFreq);
    const dt = 1.0 / sampleRate;
    return dt / (rc + dt);
  }

  private applyNormalization(
    audioData: Float32Array, 
    config: PreprocessingConfig['normalization']
  ): Float32Array {
    const currentLevel = this.calculateRMS(audioData);
    const targetLinear = this.dbToLinear(config.targetLevel);
    const maxGainLinear = this.dbToLinear(config.maxGain);
    
    const gainNeeded = targetLinear / (currentLevel + 1e-10);
    const actualGain = Math.min(gainNeeded, maxGainLinear);
    
    const processedData = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      processedData[i] = audioData[i] * actualGain;
      // Prevent clipping
      processedData[i] = Math.max(-1.0, Math.min(1.0, processedData[i]));
    }
    
    return processedData;
  }

  private applySpeechEnhancement(
    audioData: Float32Array, 
    config: PreprocessingConfig['enhancement'],
    voiceProfile?: VoiceProfile
  ): Float32Array {
    const processedData = new Float32Array(audioData.length);
    
    // Speech clarity enhancement using spectral shaping
    const frameSize = this.frameSize;
    const hopSize = frameSize / 2;
    
    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize);
      
      // Apply speech-specific enhancement
      const enhancedFrame = this.enhanceSpeechClarity(frame, config.speechClarity);
      const dynamicFrame = this.applyDynamicRangeCompression(enhancedFrame, config.dynamicRange);
      
      // Apply user-specific enhancements if profile available
      const finalFrame = voiceProfile 
        ? this.applyUserSpecificEnhancement(dynamicFrame, voiceProfile)
        : dynamicFrame;
      
      // Overlap-add reconstruction
      for (let j = 0; j < frameSize && i + j < processedData.length; j++) {
        processedData[i + j] += finalFrame[j] * this.getWindow(j, frameSize);
      }
    }
    
    return processedData;
  }

  private enhanceSpeechClarity(frame: Float32Array, clarityStrength: number): Float32Array {
    // Enhance speech formants and reduce inter-formant noise
    const enhancedFrame = new Float32Array(frame.length);
    
    for (let i = 0; i < frame.length; i++) {
      // Simple spectral enhancement
      const enhancement = 1.0 + clarityStrength * 0.5;
      enhancedFrame[i] = frame[i] * enhancement;
    }
    
    return enhancedFrame;
  }

  private applyDynamicRangeCompression(frame: Float32Array, compressionStrength: number): Float32Array {
    const compressedFrame = new Float32Array(frame.length);
    const threshold = 0.5;
    const ratio = 1.0 + compressionStrength * 3.0; // 1:1 to 4:1 compression
    
    for (let i = 0; i < frame.length; i++) {
      const amplitude = Math.abs(frame[i]);
      let compressedAmplitude = amplitude;
      
      if (amplitude > threshold) {
        const excess = amplitude - threshold;
        compressedAmplitude = threshold + excess / ratio;
      }
      
      compressedFrame[i] = Math.sign(frame[i]) * compressedAmplitude;
    }
    
    return compressedFrame;
  }

  private applyUserSpecificEnhancement(frame: Float32Array, voiceProfile: VoiceProfile): Float32Array {
    // Apply user-specific speech pattern enhancements
    const enhancedFrame = new Float32Array(frame.length);
    
    for (let i = 0; i < frame.length; i++) {
      // Simple user adaptation based on speech patterns
      let adaptationFactor = 1.0;
      
      // Adjust based on user's typical speech characteristics
      if (voiceProfile.speechPatterns.length > 0) {
        const avgConfidence = voiceProfile.speechPatterns.reduce(
          (sum, pattern) => sum + pattern.confidence, 0
        ) / voiceProfile.speechPatterns.length;
        adaptationFactor = 0.8 + 0.4 * avgConfidence;
      }
      
      enhancedFrame[i] = frame[i] * adaptationFactor;
    }
    
    return enhancedFrame;
  }

  private getWindow(index: number, frameSize: number): number {
    // Hann window for overlap-add processing
    return 0.5 * (1 - Math.cos(2 * Math.PI * index / (frameSize - 1)));
  }

  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  private calculateQualityScore(inputLevel: number, outputLevel: number, noiseLevel: number): number {
    // Calculate a quality score based on signal-to-noise ratio and processing effectiveness
    const snr = outputLevel / (noiseLevel + 1e-10);
    const snrDb = 20 * Math.log10(snr);
    
    // Normalize to 0-1 scale
    const qualityScore = Math.max(0, Math.min(1, (snrDb + 10) / 40)); // -10dB to 30dB range
    
    return qualityScore;
  }

  updateConfig(newConfig: Partial<PreprocessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PreprocessingConfig {
    return { ...this.config };
  }
}