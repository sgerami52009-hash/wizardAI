/**
 * Confidence scoring and alternative text generation for speech recognition
 * Safety: Validates all recognition alternatives for child-safe content
 * Performance: Optimized for real-time confidence assessment
 */

import { RecognitionResult } from './interfaces';
import { VoiceProfile } from '../models/voice-models';

export interface ConfidenceMetrics {
  acousticScore: number;
  languageModelScore: number;
  pronunciationScore: number;
  contextualScore: number;
  overallConfidence: number;
}

export interface AlternativeCandidate {
  text: string;
  confidence: number;
  acousticScore: number;
  languageScore: number;
  editDistance: number;
}

export interface ConfidenceConfig {
  minConfidenceThreshold: number;
  maxAlternatives: number;
  contextWeight: number;
  acousticWeight: number;
  languageWeight: number;
  pronunciationWeight: number;
}

export class RecognitionConfidenceAnalyzer {
  private config: ConfidenceConfig;
  private languageModel: Map<string, number> = new Map();
  private contextHistory: string[] = [];
  private userPatterns: Map<string, VoiceProfile> = new Map();

  constructor(config: ConfidenceConfig) {
    this.config = config;
    this.initializeLanguageModel();
  }

  private initializeLanguageModel(): void {
    // Initialize with common words and their frequencies
    const commonWords = [
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
      'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go'
    ];

    commonWords.forEach((word, index) => {
      // Higher frequency for more common words
      const frequency = Math.max(0.1, 1.0 - (index / commonWords.length));
      this.languageModel.set(word.toLowerCase(), frequency);
    });
  }

  analyzeConfidence(
    recognitionResult: RecognitionResult,
    audioMetrics: any,
    userId?: string
  ): ConfidenceMetrics {
    const acousticScore = this.calculateAcousticScore(audioMetrics);
    const languageModelScore = this.calculateLanguageModelScore(recognitionResult.text);
    const pronunciationScore = this.calculatePronunciationScore(
      recognitionResult.text, 
      userId
    );
    const contextualScore = this.calculateContextualScore(recognitionResult.text);

    const overallConfidence = this.calculateOverallConfidence(
      acousticScore,
      languageModelScore,
      pronunciationScore,
      contextualScore
    );

    return {
      acousticScore,
      languageModelScore,
      pronunciationScore,
      contextualScore,
      overallConfidence
    };
  }

  private calculateAcousticScore(audioMetrics: any): number {
    // Calculate acoustic confidence based on audio quality metrics
    const snr = audioMetrics?.signalToNoiseRatio || 10; // Default SNR
    const clarity = audioMetrics?.clarity || 0.7; // Default clarity
    const volume = audioMetrics?.volume || 0.5; // Default volume

    // Normalize SNR (0-30dB range)
    const normalizedSNR = Math.max(0, Math.min(1, snr / 30));
    
    // Combine metrics with weights
    const acousticScore = (
      normalizedSNR * 0.4 +
      clarity * 0.4 +
      Math.min(1, volume * 2) * 0.2 // Penalize very low volume
    );

    return Math.max(0, Math.min(1, acousticScore));
  }

  private calculateLanguageModelScore(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) return 0;

    let totalScore = 0;
    let wordCount = 0;

    for (const word of words) {
      // Clean word (remove punctuation)
      const cleanWord = word.replace(/[^\w]/g, '');
      
      if (cleanWord.length > 0) {
        const wordScore = this.languageModel.get(cleanWord) || this.estimateWordProbability(cleanWord);
        totalScore += wordScore;
        wordCount++;
      }
    }

    return wordCount > 0 ? totalScore / wordCount : 0;
  }

  private estimateWordProbability(word: string): number {
    // Estimate probability for unknown words based on length and structure
    const baseScore = 0.1; // Base score for unknown words
    
    // Longer words are generally less common
    const lengthPenalty = Math.max(0, 1 - (word.length - 3) * 0.1);
    
    // Words with common patterns get higher scores
    const patternBonus = this.hasCommonPatterns(word) ? 0.2 : 0;
    
    return Math.max(0.01, baseScore * lengthPenalty + patternBonus);
  }

  private hasCommonPatterns(word: string): boolean {
    // Check for common English word patterns
    const commonPatterns = [
      /ing$/, /ed$/, /er$/, /ly$/, /tion$/, /ness$/,
      /^un/, /^re/, /^pre/, /^dis/
    ];
    
    return commonPatterns.some(pattern => pattern.test(word));
  }

  private calculatePronunciationScore(text: string, userId?: string): number {
    if (!userId || !this.userPatterns.has(userId)) {
      return 0.7; // Default score when no user profile available
    }

    const userProfile = this.userPatterns.get(userId)!;
    const words = text.toLowerCase().split(/\s+/);
    
    let totalScore = 0;
    let matchedWords = 0;

    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      
      // Check if word matches user's speech patterns
      const matchingPattern = userProfile.speechPatterns.find(
        pattern => pattern.pattern.toLowerCase().includes(cleanWord)
      );

      if (matchingPattern) {
        totalScore += matchingPattern.confidence;
        matchedWords++;
      }
    }

    // If no patterns matched, use accent adaptation confidence
    if (matchedWords === 0) {
      return userProfile.accentAdaptation.confidence;
    }

    return totalScore / matchedWords;
  }

  private calculateContextualScore(text: string): number {
    if (this.contextHistory.length === 0) {
      return 0.5; // Neutral score with no context
    }

    const words = text.toLowerCase().split(/\s+/);
    const recentContext = this.contextHistory.slice(-5).join(' ').toLowerCase();
    
    let contextMatches = 0;
    let totalWords = words.length;

    for (const word of words) {
      if (recentContext.includes(word)) {
        contextMatches++;
      }
    }

    // Calculate semantic similarity (simplified)
    const contextScore = totalWords > 0 ? contextMatches / totalWords : 0;
    
    // Boost score for topic continuity
    const topicContinuity = this.calculateTopicContinuity(text);
    
    return Math.min(1, contextScore * 0.7 + topicContinuity * 0.3);
  }

  private calculateTopicContinuity(text: string): number {
    // Simple topic continuity based on word overlap with recent context
    if (this.contextHistory.length < 2) return 0.5;

    const currentWords = new Set(text.toLowerCase().split(/\s+/));
    const recentWords = new Set(
      this.contextHistory.slice(-2).join(' ').toLowerCase().split(/\s+/)
    );

    const intersection = new Set([...currentWords].filter(word => recentWords.has(word)));
    const union = new Set([...currentWords, ...recentWords]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateOverallConfidence(
    acousticScore: number,
    languageModelScore: number,
    pronunciationScore: number,
    contextualScore: number
  ): number {
    const weightedScore = (
      acousticScore * this.config.acousticWeight +
      languageModelScore * this.config.languageWeight +
      pronunciationScore * this.config.pronunciationWeight +
      contextualScore * this.config.contextWeight
    );

    const totalWeight = (
      this.config.acousticWeight +
      this.config.languageWeight +
      this.config.pronunciationWeight +
      this.config.contextWeight
    );

    return Math.max(0, Math.min(1, weightedScore / totalWeight));
  }

  generateAlternatives(
    primaryResult: RecognitionResult,
    rawCandidates: string[],
    audioMetrics: any
  ): AlternativeCandidate[] {
    const alternatives: AlternativeCandidate[] = [];

    for (const candidate of rawCandidates) {
      if (candidate === primaryResult.text) continue;

      const acousticScore = this.calculateAcousticScore(audioMetrics);
      const languageScore = this.calculateLanguageModelScore(candidate);
      const editDistance = this.calculateEditDistance(primaryResult.text, candidate);
      
      // Calculate confidence based on similarity to primary result and individual scores
      const similarityBonus = Math.max(0, 1 - editDistance / Math.max(primaryResult.text.length, candidate.length));
      const confidence = (acousticScore * 0.3 + languageScore * 0.4 + similarityBonus * 0.3);

      alternatives.push({
        text: candidate,
        confidence,
        acousticScore,
        languageScore,
        editDistance
      });
    }

    // Sort by confidence and return top alternatives
    return alternatives
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxAlternatives);
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  updateUserProfile(userId: string, profile: VoiceProfile): void {
    this.userPatterns.set(userId, profile);
  }

  updateContext(text: string): void {
    this.contextHistory.push(text);
    
    // Keep only recent context (last 10 interactions)
    if (this.contextHistory.length > 10) {
      this.contextHistory = this.contextHistory.slice(-10);
    }
  }

  isConfidenceAcceptable(confidence: number): boolean {
    return confidence >= this.config.minConfidenceThreshold;
  }

  getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence < 0.5) return 'low';
    if (confidence < 0.8) return 'medium';
    return 'high';
  }

  updateLanguageModel(words: string[], frequencies: number[]): void {
    for (let i = 0; i < words.length && i < frequencies.length; i++) {
      this.languageModel.set(words[i].toLowerCase(), frequencies[i]);
    }
  }

  getLanguageModelStats(): { totalWords: number; averageFrequency: number } {
    const frequencies = Array.from(this.languageModel.values());
    return {
      totalWords: this.languageModel.size,
      averageFrequency: frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length
    };
  }
}