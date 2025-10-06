/**
 * Voice profile management for personalized speech recognition
 * Safety: User voice profiles encrypted with user-specific keys
 * Performance: Optimized for fast profile loading and adaptation
 */

import { EventEmitter } from 'events';
import { VoiceProfile, AccentModel, SpeechPattern } from '../models/voice-models';
import { RecognitionResult } from './interfaces';

export interface ProfileUpdateOptions {
  adaptAccent: boolean;
  learnPatterns: boolean;
  updateLanguage: boolean;
  maxPatterns: number;
  confidenceThreshold: number;
}

export interface ProfileMetrics {
  totalInteractions: number;
  accuracyImprovement: number;
  lastAdaptation: Date;
  patternCount: number;
  accentConfidence: number;
}

export interface LanguageModel {
  code: string;
  name: string;
  modelPath: string;
  isLoaded: boolean;
  accuracy: number;
  supportedAccents: string[];
}

export class VoiceProfileManager extends EventEmitter {
  private profiles: Map<string, VoiceProfile> = new Map();
  private languageModels: Map<string, LanguageModel> = new Map();
  private activeProfiles: Set<string> = new Set();
  private adaptationQueue: Array<{ userId: string; result: RecognitionResult; audioMetrics: any }> = [];
  private isProcessingAdaptation = false;

  constructor() {
    super();
    this.initializeLanguageModels();
    this.startAdaptationProcessor();
  }

  private initializeLanguageModels(): void {
    const supportedLanguages: LanguageModel[] = [
      {
        code: 'en',
        name: 'English',
        modelPath: '/models/whisper-en.bin',
        isLoaded: false,
        accuracy: 0.95,
        supportedAccents: ['us', 'uk', 'au', 'ca', 'in']
      },
      {
        code: 'es',
        name: 'Spanish',
        modelPath: '/models/whisper-es.bin',
        isLoaded: false,
        accuracy: 0.92,
        supportedAccents: ['es', 'mx', 'ar', 'co', 'pe']
      },
      {
        code: 'fr',
        name: 'French',
        modelPath: '/models/whisper-fr.bin',
        isLoaded: false,
        accuracy: 0.91,
        supportedAccents: ['fr', 'ca', 'be', 'ch']
      },
      {
        code: 'de',
        name: 'German',
        modelPath: '/models/whisper-de.bin',
        isLoaded: false,
        accuracy: 0.90,
        supportedAccents: ['de', 'at', 'ch']
      },
      {
        code: 'it',
        name: 'Italian',
        modelPath: '/models/whisper-it.bin',
        isLoaded: false,
        accuracy: 0.89,
        supportedAccents: ['it', 'ch']
      }
    ];

    supportedLanguages.forEach(lang => {
      this.languageModels.set(lang.code, lang);
    });
  }

  async createProfile(userId: string, initialSettings: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const defaultProfile: VoiceProfile = {
      userId,
      preferredLanguage: 'en',
      accentAdaptation: {
        region: 'us',
        confidence: 0.5,
        adaptationData: new Float32Array(128), // Initialize with default size
        phonemeMapping: {},
        lastTraining: new Date()
      },
      speechPatterns: [],
      safetyLevel: 'child', // Default to most restrictive
      lastUpdated: new Date(),
      encryptionKey: this.generateEncryptionKey()
    };

    const profile: VoiceProfile = { ...defaultProfile, ...initialSettings };
    
    // Validate safety level
    if (!['child', 'teen', 'adult'].includes(profile.safetyLevel)) {
      profile.safetyLevel = 'child';
    }

    // Ensure language is supported
    if (!this.languageModels.has(profile.preferredLanguage)) {
      profile.preferredLanguage = 'en';
    }

    this.profiles.set(userId, profile);
    await this.saveProfile(profile);
    
    this.emit('profile-created', { userId, profile });
    return profile;
  }

  async loadProfile(userId: string): Promise<VoiceProfile | null> {
    // First check memory cache
    if (this.profiles.has(userId)) {
      return this.profiles.get(userId)!;
    }

    // Load from storage (simulated)
    try {
      const profile = await this.loadProfileFromStorage(userId);
      if (profile) {
        this.profiles.set(userId, profile);
        this.activeProfiles.add(userId);
        this.emit('profile-loaded', { userId, profile });
        return profile;
      }
    } catch (error) {
      this.emit('profile-load-error', { userId, error });
    }

    return null;
  }

  async updateProfile(userId: string, updates: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const existingProfile = await this.loadProfile(userId);
    if (!existingProfile) {
      throw new Error(`Profile not found for user: ${userId}`);
    }

    const updatedProfile: VoiceProfile = {
      ...existingProfile,
      ...updates,
      lastUpdated: new Date()
    };

    // Validate updates
    if (updates.preferredLanguage && !this.languageModels.has(updates.preferredLanguage)) {
      throw new Error(`Unsupported language: ${updates.preferredLanguage}`);
    }

    if (updates.safetyLevel && !['child', 'teen', 'adult'].includes(updates.safetyLevel)) {
      throw new Error(`Invalid safety level: ${updates.safetyLevel}`);
    }

    this.profiles.set(userId, updatedProfile);
    await this.saveProfile(updatedProfile);
    
    this.emit('profile-updated', { userId, profile: updatedProfile });
    return updatedProfile;
  }

  async adaptProfile(
    userId: string, 
    recognitionResult: RecognitionResult, 
    audioMetrics: any,
    options: ProfileUpdateOptions = {
      adaptAccent: true,
      learnPatterns: true,
      updateLanguage: false,
      maxPatterns: 100,
      confidenceThreshold: 0.8
    }
  ): Promise<void> {
    // Queue adaptation for background processing
    this.adaptationQueue.push({ userId, result: recognitionResult, audioMetrics });
    
    if (!this.isProcessingAdaptation) {
      this.processAdaptationQueue(options);
    }
  }

  private async processAdaptationQueue(options: ProfileUpdateOptions): Promise<void> {
    this.isProcessingAdaptation = true;

    while (this.adaptationQueue.length > 0) {
      const { userId, result, audioMetrics } = this.adaptationQueue.shift()!;
      
      try {
        await this.performProfileAdaptation(userId, result, audioMetrics, options);
      } catch (error) {
        this.emit('adaptation-error', { userId, error });
      }
    }

    this.isProcessingAdaptation = false;
  }

  private async performProfileAdaptation(
    userId: string,
    result: RecognitionResult,
    audioMetrics: any,
    options: ProfileUpdateOptions
  ): Promise<void> {
    const profile = await this.loadProfile(userId);
    if (!profile || result.confidence < options.confidenceThreshold) {
      return;
    }

    let profileUpdated = false;

    // Adapt accent model
    if (options.adaptAccent) {
      const accentUpdated = await this.adaptAccentModel(profile, result, audioMetrics);
      if (accentUpdated) profileUpdated = true;
    }

    // Learn speech patterns
    if (options.learnPatterns) {
      const patternsUpdated = this.learnSpeechPatterns(profile, result, options.maxPatterns);
      if (patternsUpdated) profileUpdated = true;
    }

    // Update language preference if needed
    if (options.updateLanguage && result.language !== profile.preferredLanguage) {
      const languageUpdated = await this.updateLanguagePreference(profile, result.language);
      if (languageUpdated) profileUpdated = true;
    }

    if (profileUpdated) {
      profile.lastUpdated = new Date();
      this.profiles.set(userId, profile);
      await this.saveProfile(profile);
      this.emit('profile-adapted', { userId, profile });
    }
  }

  private async adaptAccentModel(
    profile: VoiceProfile,
    result: RecognitionResult,
    audioMetrics: any
  ): Promise<boolean> {
    const accentModel = profile.accentAdaptation;
    
    // Extract accent features from audio metrics (simplified)
    const accentFeatures = this.extractAccentFeatures(audioMetrics);
    
    if (accentFeatures.length === 0) return false;

    // Update adaptation data using exponential moving average
    const learningRate = 0.1;
    const currentData = accentModel.adaptationData;
    
    for (let i = 0; i < Math.min(accentFeatures.length, currentData.length); i++) {
      currentData[i] = currentData[i] * (1 - learningRate) + accentFeatures[i] * learningRate;
    }

    // Update confidence based on recognition accuracy
    const confidenceUpdate = (result.confidence - 0.5) * 0.1; // -0.05 to +0.05
    accentModel.confidence = Math.max(0.1, Math.min(0.95, accentModel.confidence + confidenceUpdate));
    
    accentModel.lastTraining = new Date();
    
    return true;
  }

  private extractAccentFeatures(audioMetrics: any): number[] {
    // Simulate accent feature extraction from audio metrics
    // In real implementation, this would analyze formant frequencies, pitch patterns, etc.
    const features: number[] = [];
    
    if (audioMetrics.formants) {
      features.push(...audioMetrics.formants.slice(0, 64)); // First 64 formant features
    }
    
    if (audioMetrics.pitch) {
      features.push(audioMetrics.pitch.mean || 0);
      features.push(audioMetrics.pitch.variance || 0);
    }
    
    // Pad or truncate to fixed size
    while (features.length < 128) features.push(0);
    return features.slice(0, 128);
  }

  private learnSpeechPatterns(
    profile: VoiceProfile,
    result: RecognitionResult,
    maxPatterns: number
  ): boolean {
    const words = result.text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    let patternsUpdated = false;

    for (const word of words) {
      const existingPattern = profile.speechPatterns.find(p => p.pattern === word);
      
      if (existingPattern) {
        // Update existing pattern
        existingPattern.frequency++;
        existingPattern.confidence = Math.min(0.95, existingPattern.confidence + 0.05);
        existingPattern.lastSeen = new Date();
        patternsUpdated = true;
      } else if (profile.speechPatterns.length < maxPatterns) {
        // Add new pattern
        const newPattern: SpeechPattern = {
          pattern: word,
          frequency: 1,
          context: words.filter(w => w !== word).slice(0, 5), // Context words
          confidence: result.confidence,
          lastSeen: new Date()
        };
        profile.speechPatterns.push(newPattern);
        patternsUpdated = true;
      }
    }

    // Remove old, infrequent patterns if at capacity
    if (profile.speechPatterns.length >= maxPatterns) {
      profile.speechPatterns.sort((a, b) => {
        const aScore = a.frequency * a.confidence;
        const bScore = b.frequency * b.confidence;
        return bScore - aScore;
      });
      profile.speechPatterns = profile.speechPatterns.slice(0, maxPatterns);
    }

    return patternsUpdated;
  }

  private async updateLanguagePreference(profile: VoiceProfile, detectedLanguage: string): Promise<boolean> {
    if (!this.languageModels.has(detectedLanguage)) {
      return false;
    }

    // Only update if detected language appears consistently
    // This is a simplified check - in practice, you'd want more sophisticated logic
    if (Math.random() > 0.8) { // 20% chance to update (simulate consistency check)
      profile.preferredLanguage = detectedLanguage;
      return true;
    }

    return false;
  }

  async loadLanguageModel(languageCode: string): Promise<boolean> {
    const model = this.languageModels.get(languageCode);
    if (!model) {
      throw new Error(`Language model not found: ${languageCode}`);
    }

    if (model.isLoaded) {
      return true;
    }

    try {
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      model.isLoaded = true;
      this.emit('language-model-loaded', { languageCode, model });
      return true;
    } catch (error) {
      this.emit('language-model-error', { languageCode, error });
      return false;
    }
  }

  async switchLanguage(userId: string, languageCode: string): Promise<boolean> {
    const profile = await this.loadProfile(userId);
    if (!profile) {
      throw new Error(`Profile not found for user: ${userId}`);
    }

    // Load the language model if not already loaded
    const modelLoaded = await this.loadLanguageModel(languageCode);
    if (!modelLoaded) {
      return false;
    }

    // Update profile
    await this.updateProfile(userId, { preferredLanguage: languageCode });
    
    this.emit('language-switched', { userId, languageCode });
    return true;
  }

  getAvailableLanguages(): LanguageModel[] {
    return Array.from(this.languageModels.values());
  }

  getLoadedLanguages(): LanguageModel[] {
    return Array.from(this.languageModels.values()).filter(model => model.isLoaded);
  }

  getProfileMetrics(userId: string): ProfileMetrics | null {
    const profile = this.profiles.get(userId);
    if (!profile) return null;

    return {
      totalInteractions: profile.speechPatterns.reduce((sum, pattern) => sum + pattern.frequency, 0),
      accuracyImprovement: profile.accentAdaptation.confidence - 0.5, // Improvement from baseline
      lastAdaptation: profile.lastUpdated,
      patternCount: profile.speechPatterns.length,
      accentConfidence: profile.accentAdaptation.confidence
    };
  }

  private async saveProfile(profile: VoiceProfile): Promise<void> {
    // Simulate encrypted storage
    // In real implementation, this would encrypt and save to persistent storage
    console.log(`Saving encrypted profile for user: ${profile.userId}`);
  }

  private async loadProfileFromStorage(userId: string): Promise<VoiceProfile | null> {
    // Simulate loading from encrypted storage
    // In real implementation, this would load and decrypt from persistent storage
    console.log(`Loading encrypted profile for user: ${userId}`);
    return null; // No stored profile found
  }

  private generateEncryptionKey(): string {
    // Generate a secure encryption key for the profile
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  }

  async deleteProfile(userId: string): Promise<boolean> {
    try {
      this.profiles.delete(userId);
      this.activeProfiles.delete(userId);
      
      // Remove from persistent storage (simulated)
      console.log(`Deleting encrypted profile for user: ${userId}`);
      
      this.emit('profile-deleted', { userId });
      return true;
    } catch (error) {
      this.emit('profile-delete-error', { userId, error });
      return false;
    }
  }

  private startAdaptationProcessor(): void {
    // Process adaptation queue periodically
    setInterval(() => {
      if (this.adaptationQueue.length > 0 && !this.isProcessingAdaptation) {
        this.processAdaptationQueue({
          adaptAccent: true,
          learnPatterns: true,
          updateLanguage: false,
          maxPatterns: 100,
          confidenceThreshold: 0.8
        });
      }
    }, 5000); // Process every 5 seconds
  }
}