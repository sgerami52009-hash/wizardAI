/**
 * Entity Extraction System
 * Safety: All extracted entities validated for child-appropriate content
 * Performance: Pattern-based extraction <50ms on Jetson Nano Orin
 */

import { EventEmitter } from 'events';
import { EntityExtractor, ExtractedEntity } from './intent-classifier';
import { validateChildSafeContent } from '../safety/content-safety-filter';

export interface EntityPattern {
  type: string;
  patterns: RegExp[];
  validator?: (value: string) => boolean;
  transformer?: (value: string) => string;
  priority: number;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  processingTime: number;
  confidence: number;
}

export class LocalEntityExtractor extends EventEmitter implements EntityExtractor {
  private entityPatterns: Map<string, EntityPattern> = new Map();
  private maxEntitiesPerType: number = 5;
  private minConfidence: number = 0.6;

  constructor() {
    super();
    this.initializeBuiltInEntityTypes();
  }

  async extractEntities(text: string): Promise<ExtractedEntity[]> {
    const startTime = Date.now();
    const entities: ExtractedEntity[] = [];

    try {
      // Process each registered entity type
      for (const [entityType, pattern] of this.entityPatterns) {
        const typeEntities = await this.extractEntitiesOfType(text, entityType, pattern);
        entities.push(...typeEntities);
      }

      // Sort by confidence and position
      entities.sort((a, b) => {
        if (a.confidence !== b.confidence) return b.confidence - a.confidence;
        return a.startIndex - b.startIndex;
      });

      // Remove overlapping entities (keep highest confidence)
      const filteredEntities = this.removeOverlappingEntities(entities);

      const processingTime = Date.now() - startTime;
      this.emit('entitiesExtracted', { 
        entityCount: filteredEntities.length, 
        processingTime,
        text: text.substring(0, 50) + '...' 
      });

      return filteredEntities;
    } catch (error) {
      this.emit('extractionError', { error, text: text.substring(0, 50) + '...' });
      return [];
    }
  }

  registerEntityType(type: string, patterns: RegExp[]): void {
    if (!type || patterns.length === 0) {
      throw new Error('Invalid entity type or patterns');
    }

    this.entityPatterns.set(type, {
      type,
      patterns,
      priority: 1.0
    });

    this.emit('entityTypeRegistered', { type, patternCount: patterns.length });
  }

  private initializeBuiltInEntityTypes(): void {
    // Time entities
    this.registerEntityPattern({
      type: 'time',
      patterns: [
        /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/gi,
        /\b(\d{1,2})\s*(am|pm)\b/gi,
        /\b(morning|afternoon|evening|night|noon|midnight)\b/gi,
        /\bin\s+(\d+)\s+(minutes?|hours?)\b/gi,
        /\bat\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?\b/gi
      ],
      validator: (value) => this.validateTime(value),
      transformer: (value) => this.normalizeTime(value),
      priority: 0.9
    });

    // Date entities
    this.registerEntityPattern({
      type: 'date',
      patterns: [
        /\b(today|tomorrow|yesterday)\b/gi,
        /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
        /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/gi,
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/gi,
        /\bin\s+(\d+)\s+(days?|weeks?|months?)\b/gi,
        /\bnext\s+(week|month|year)\b/gi
      ],
      validator: (value) => this.validateDate(value),
      transformer: (value) => this.normalizeDate(value),
      priority: 0.9
    });

    // Number entities
    this.registerEntityPattern({
      type: 'number',
      patterns: [
        /\b(\d+(?:\.\d+)?)\b/g,
        /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
        /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
        /\b(thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/gi
      ],
      validator: (value) => this.validateNumber(value),
      transformer: (value) => this.normalizeNumber(value),
      priority: 0.7
    });

    // Location entities
    this.registerEntityPattern({
      type: 'location',
      patterns: [
        /\b(living room|bedroom|kitchen|bathroom|garage|basement|attic|office|dining room)\b/gi,
        /\b(upstairs|downstairs|outside|inside)\b/gi,
        /\bin the\s+(\w+(?:\s+\w+)?)\b/gi,
        /\bat\s+(home|work|school)\b/gi
      ],
      validator: (value) => this.validateLocation(value),
      transformer: (value) => this.normalizeLocation(value),
      priority: 0.8
    });

    // Device entities
    this.registerEntityPattern({
      type: 'device',
      patterns: [
        /\b(lights?|lamps?|bulbs?)\b/gi,
        /\b(thermostat|temperature|heating|cooling|ac|air conditioning)\b/gi,
        /\b(tv|television|music|speakers?|sound system)\b/gi,
        /\b(door|doors|lock|locks|security|alarm)\b/gi,
        /\b(fan|fans|ceiling fan)\b/gi
      ],
      validator: (value) => this.validateDevice(value),
      transformer: (value) => this.normalizeDevice(value),
      priority: 0.8
    });

    // Action entities
    this.registerEntityPattern({
      type: 'action',
      patterns: [
        /\b(turn on|turn off|switch on|switch off|enable|disable)\b/gi,
        /\b(increase|decrease|raise|lower|dim|brighten)\b/gi,
        /\b(set|adjust|change|modify)\b/gi,
        /\b(start|stop|pause|resume|play)\b/gi,
        /\b(open|close|lock|unlock)\b/gi
      ],
      validator: (value) => this.validateAction(value),
      transformer: (value) => this.normalizeAction(value),
      priority: 0.8
    });

    // Duration entities
    this.registerEntityPattern({
      type: 'duration',
      patterns: [
        /\b(\d+)\s+(seconds?|minutes?|hours?|days?)\b/gi,
        /\bfor\s+(\d+)\s+(seconds?|minutes?|hours?)\b/gi,
        /\b(briefly|quickly|slowly|a while|a bit)\b/gi
      ],
      validator: (value) => this.validateDuration(value),
      transformer: (value) => this.normalizeDuration(value),
      priority: 0.7
    });

    // Percentage entities
    this.registerEntityPattern({
      type: 'percentage',
      patterns: [
        /\b(\d+)%\b/g,
        /\b(\d+)\s*percent\b/gi,
        /\bto\s+(\d+)%?\b/gi,
        /\b(full|half|quarter|maximum|minimum|max|min)\b/gi
      ],
      validator: (value) => this.validatePercentage(value),
      transformer: (value) => this.normalizePercentage(value),
      priority: 0.8
    });
  }

  private registerEntityPattern(pattern: EntityPattern): void {
    this.entityPatterns.set(pattern.type, pattern);
  }

  private async extractEntitiesOfType(
    text: string, 
    entityType: string, 
    pattern: EntityPattern
  ): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    let entityCount = 0;

    for (const regex of pattern.patterns) {
      if (entityCount >= this.maxEntitiesPerType) break;

      // Reset regex lastIndex for global patterns
      regex.lastIndex = 0;
      
      let match;
      while ((match = regex.exec(text)) !== null && entityCount < this.maxEntitiesPerType) {
        const value = match[0].trim();
        
        // Skip if too short or invalid
        if (value.length < 1) continue;
        
        // Apply validator if present
        if (pattern.validator && !pattern.validator(value)) continue;

        // Safety check for extracted entity
        const safetyResult = await validateChildSafeContent(value, 'system');
        if (!safetyResult.isAllowed) continue;

        // Apply transformer if present
        const transformedValue = pattern.transformer ? pattern.transformer(value) : value;

        // Calculate confidence based on pattern specificity and context
        const confidence = this.calculateEntityConfidence(value, pattern, match);

        if (confidence >= this.minConfidence) {
          entities.push({
            type: entityType,
            value: transformedValue,
            confidence,
            startIndex: match.index!,
            endIndex: match.index! + match[0].length
          });
          entityCount++;
        }

        // Prevent infinite loops with global regex
        if (!regex.global) break;
      }
    }

    return entities;
  }

  private calculateEntityConfidence(
    value: string, 
    pattern: EntityPattern, 
    match: RegExpExecArray
  ): number {
    let confidence = pattern.priority;

    // Boost confidence for exact matches
    if (match[0] === value) confidence += 0.1;

    // Boost confidence for longer matches
    if (value.length > 5) confidence += 0.05;

    // Reduce confidence for very short matches
    if (value.length < 3) confidence -= 0.2;

    // Boost confidence for word boundaries
    const hasWordBoundary = /\b/.test(match[0]);
    if (hasWordBoundary) confidence += 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private removeOverlappingEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const filtered: ExtractedEntity[] = [];
    
    for (const entity of entities) {
      const hasOverlap = filtered.some(existing => 
        this.entitiesOverlap(entity, existing)
      );
      
      if (!hasOverlap) {
        filtered.push(entity);
      }
    }
    
    return filtered;
  }

  private entitiesOverlap(entity1: ExtractedEntity, entity2: ExtractedEntity): boolean {
    return !(entity1.endIndex <= entity2.startIndex || entity2.endIndex <= entity1.startIndex);
  }

  // Validation methods
  private validateTime(value: string): boolean {
    const timePattern = /^(\d{1,2}):?(\d{2})?\s*(am|pm)?$|^(morning|afternoon|evening|night|noon|midnight)$/i;
    return timePattern.test(value.trim());
  }

  private validateDate(value: string): boolean {
    const dateKeywords = ['today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (dateKeywords.includes(value.toLowerCase())) return true;
    
    // Basic date format validation
    const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$|^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}$/i;
    return datePattern.test(value.trim());
  }

  private validateNumber(value: string): boolean {
    return !isNaN(parseFloat(value)) || /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)$/i.test(value);
  }

  private validateLocation(value: string): boolean {
    const validLocations = ['living room', 'bedroom', 'kitchen', 'bathroom', 'garage', 'basement', 'attic', 'office', 'dining room', 'upstairs', 'downstairs', 'outside', 'inside', 'home', 'work', 'school'];
    return validLocations.includes(value.toLowerCase()) || value.length > 2;
  }

  private validateDevice(value: string): boolean {
    return value.length > 2 && !/\d/.test(value); // No numbers in device names
  }

  private validateAction(value: string): boolean {
    const validActions = ['turn on', 'turn off', 'switch on', 'switch off', 'enable', 'disable', 'increase', 'decrease', 'raise', 'lower', 'dim', 'brighten', 'set', 'adjust', 'change', 'modify', 'start', 'stop', 'pause', 'resume', 'play', 'open', 'close', 'lock', 'unlock'];
    return validActions.includes(value.toLowerCase());
  }

  private validateDuration(value: string): boolean {
    return /\d+\s+(seconds?|minutes?|hours?|days?)$/i.test(value) || ['briefly', 'quickly', 'slowly', 'a while', 'a bit'].includes(value.toLowerCase());
  }

  private validatePercentage(value: string): boolean {
    const numValue = parseFloat(value.replace('%', '').replace('percent', ''));
    return !isNaN(numValue) && numValue >= 0 && numValue <= 100;
  }

  // Normalization methods
  private normalizeTime(value: string): string {
    return value.toLowerCase().trim();
  }

  private normalizeDate(value: string): string {
    return value.toLowerCase().trim();
  }

  private normalizeNumber(value: string): string {
    const wordToNumber: Record<string, string> = {
      'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
      'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
      'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
      'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
      'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
      'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
      'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
    };
    
    return wordToNumber[value.toLowerCase()] || value;
  }

  private normalizeLocation(value: string): string {
    return value.toLowerCase().trim().replace(/^(in the|at)\s+/, '');
  }

  private normalizeDevice(value: string): string {
    const deviceAliases: Record<string, string> = {
      'lights': 'light',
      'lamps': 'lamp',
      'bulbs': 'light',
      'ac': 'air conditioning',
      'tv': 'television',
      'speakers': 'speaker'
    };
    
    const normalized = value.toLowerCase().trim();
    return deviceAliases[normalized] || normalized;
  }

  private normalizeAction(value: string): string {
    const actionAliases: Record<string, string> = {
      'switch on': 'turn on',
      'switch off': 'turn off',
      'enable': 'turn on',
      'disable': 'turn off',
      'raise': 'increase',
      'lower': 'decrease',
      'brighten': 'increase',
      'dim': 'decrease'
    };
    
    const normalized = value.toLowerCase().trim();
    return actionAliases[normalized] || normalized;
  }

  private normalizeDuration(value: string): string {
    const durationAliases: Record<string, string> = {
      'briefly': '30 seconds',
      'quickly': '1 minute',
      'slowly': '5 minutes',
      'a while': '10 minutes',
      'a bit': '2 minutes'
    };
    
    const normalized = value.toLowerCase().trim();
    return durationAliases[normalized] || normalized;
  }

  private normalizePercentage(value: string): string {
    const percentageAliases: Record<string, string> = {
      'full': '100',
      'maximum': '100',
      'max': '100',
      'half': '50',
      'quarter': '25',
      'minimum': '0',
      'min': '0'
    };
    
    const normalized = value.toLowerCase().trim().replace('%', '').replace('percent', '').trim();
    return percentageAliases[normalized] || normalized;
  }
}