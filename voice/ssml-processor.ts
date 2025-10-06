/**
 * SSML (Speech Synthesis Markup Language) Processor
 * Safety: Validate SSML tags for child-safe content
 * Performance: Efficient parsing and processing for real-time synthesis
 */

export interface SSMLElement {
  tag: string;
  attributes: Record<string, string>;
  content: string;
  children: SSMLElement[];
}

export interface ProcessedSSML {
  text: string;
  prosody: ProsodySettings[];
  breaks: BreakSettings[];
  emphasis: EmphasisSettings[];
  emotions: EmotionSettings[];
}

export interface ProsodySettings {
  startIndex: number;
  endIndex: number;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface BreakSettings {
  index: number;
  duration: number; // milliseconds
}

export interface EmphasisSettings {
  startIndex: number;
  endIndex: number;
  level: 'strong' | 'moderate' | 'reduced';
}

export interface EmotionSettings {
  startIndex: number;
  endIndex: number;
  emotion: 'neutral' | 'happy' | 'concerned' | 'excited';
  intensity: number; // 0.0 to 1.0
}

export class SSMLProcessor {
  private allowedTags: Set<string> = new Set([
    'speak', 'p', 's', 'break', 'prosody', 'emphasis', 'say-as'
  ]);

  private childSafeTags: Set<string> = new Set([
    'speak', 'p', 's', 'break', 'prosody', 'emphasis'
  ]);

  /**
   * Process SSML markup and extract speech control information
   */
  processSSML(ssmlText: string, childSafeMode: boolean = true): ProcessedSSML {
    try {
      // Validate and sanitize SSML
      const sanitizedSSML = this.sanitizeSSML(ssmlText, childSafeMode);
      
      // Parse SSML structure
      const parsed = this.parseSSML(sanitizedSSML);
      
      // Extract speech control information
      return this.extractSpeechControls(parsed);
      
    } catch (error) {
      // Fallback to plain text if SSML processing fails
      return {
        text: this.stripAllTags(ssmlText),
        prosody: [],
        breaks: [],
        emphasis: [],
        emotions: []
      };
    }
  }

  /**
   * Convert processed SSML to engine-specific format
   */
  convertToEngineFormat(processed: ProcessedSSML, engineType: string): any {
    switch (engineType) {
      case 'espeak':
        return this.convertToEspeakFormat(processed);
      case 'festival':
        return this.convertToFestivalFormat(processed);
      default:
        return processed;
    }
  }

  /**
   * Validate SSML for child safety
   */
  validateChildSafety(ssmlText: string): boolean {
    const tags = this.extractTags(ssmlText);
    
    for (const tag of tags) {
      if (!this.childSafeTags.has(tag.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }

  private sanitizeSSML(ssmlText: string, childSafeMode: boolean): string {
    let sanitized = ssmlText;
    
    // Remove dangerous or inappropriate tags
    const dangerousTags = ['audio', 'mark', 'phoneme', 'sub', 'voice'];
    
    for (const tag of dangerousTags) {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      
      // Also remove self-closing tags
      const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    }
    
    // In child safe mode, only allow specific tags
    if (childSafeMode) {
      const allowedPattern = Array.from(this.childSafeTags).join('|');
      const disallowedRegex = new RegExp(`<(?!/?(?:${allowedPattern})\\b)[^>]+>`, 'gi');
      sanitized = sanitized.replace(disallowedRegex, '');
    }
    
    return sanitized;
  }

  private parseSSML(ssmlText: string): SSMLElement {
    // Simple SSML parser - in production, use a proper XML parser
    const root: SSMLElement = {
      tag: 'root',
      attributes: {},
      content: '',
      children: []
    };

    // Extract speak tag content if present
    const speakMatch = ssmlText.match(/<speak[^>]*>(.*?)<\/speak>/s);
    const content = speakMatch ? speakMatch[1] : ssmlText;
    
    root.content = content;
    root.children = this.parseElements(content);
    
    return root;
  }

  private parseElements(content: string): SSMLElement[] {
    const elements: SSMLElement[] = [];
    const tagRegex = /<(\w+)([^>]*)(?:\/>|>(.*?)<\/\1>)/g;
    
    let match;
    let lastIndex = 0;
    
    while ((match = tagRegex.exec(content)) !== null) {
      // Add text before tag as text element
      if (match.index > lastIndex) {
        const textContent = content.substring(lastIndex, match.index).trim();
        if (textContent) {
          elements.push({
            tag: 'text',
            attributes: {},
            content: textContent,
            children: []
          });
        }
      }
      
      // Add the tag element
      const [, tagName, attributesStr, innerContent] = match;
      const attributes = this.parseAttributes(attributesStr);
      
      elements.push({
        tag: tagName,
        attributes,
        content: innerContent || '',
        children: innerContent ? this.parseElements(innerContent) : []
      });
      
      lastIndex = tagRegex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      const textContent = content.substring(lastIndex).trim();
      if (textContent) {
        elements.push({
          tag: 'text',
          attributes: {},
          content: textContent,
          children: []
        });
      }
    }
    
    return elements;
  }

  private parseAttributes(attributesStr: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    
    let match;
    while ((match = attrRegex.exec(attributesStr)) !== null) {
      attributes[match[1]] = match[2];
    }
    
    return attributes;
  }

  private extractSpeechControls(element: SSMLElement): ProcessedSSML {
    const result: ProcessedSSML = {
      text: '',
      prosody: [],
      breaks: [],
      emphasis: [],
      emotions: []
    };
    
    this.processElement(element, result, 0);
    
    return result;
  }

  private processElement(
    element: SSMLElement, 
    result: ProcessedSSML, 
    currentIndex: number
  ): number {
    let index = currentIndex;
    
    switch (element.tag) {
      case 'text':
      case 'root':
        result.text += element.content;
        index += element.content.length;
        break;
        
      case 'break':
        const duration = this.parseBreakDuration(element.attributes.time || '500ms');
        result.breaks.push({
          index,
          duration
        });
        break;
        
      case 'prosody':
        const startIndex = index;
        
        // Process children to get the text length
        for (const child of element.children) {
          index = this.processElement(child, result, index);
        }
        
        const prosody: ProsodySettings = {
          startIndex,
          endIndex: index
        };
        
        if (element.attributes.rate) {
          prosody.rate = this.parseRate(element.attributes.rate);
        }
        if (element.attributes.pitch) {
          prosody.pitch = this.parsePitch(element.attributes.pitch);
        }
        if (element.attributes.volume) {
          prosody.volume = this.parseVolume(element.attributes.volume);
        }
        
        result.prosody.push(prosody);
        return index;
        
      case 'emphasis':
        const emphasisStart = index;
        
        for (const child of element.children) {
          index = this.processElement(child, result, index);
        }
        
        result.emphasis.push({
          startIndex: emphasisStart,
          endIndex: index,
          level: (element.attributes.level as any) || 'moderate'
        });
        return index;
        
      case 'p':
      case 's':
        // Add implicit breaks for paragraphs and sentences
        if (element.tag === 'p') {
          result.breaks.push({ index, duration: 750 });
        } else {
          result.breaks.push({ index, duration: 300 });
        }
        break;
    }
    
    // Process children
    for (const child of element.children) {
      index = this.processElement(child, result, index);
    }
    
    return index;
  }

  private parseBreakDuration(timeStr: string): number {
    const match = timeStr.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
    if (!match) return 500; // Default 500ms
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    return unit === 's' ? value * 1000 : value;
  }

  private parseRate(rateStr: string): number {
    if (rateStr.endsWith('%')) {
      return parseFloat(rateStr) / 100;
    }
    
    const namedRates: Record<string, number> = {
      'x-slow': 0.5,
      'slow': 0.75,
      'medium': 1.0,
      'fast': 1.25,
      'x-fast': 1.5
    };
    
    return namedRates[rateStr] || parseFloat(rateStr) || 1.0;
  }

  private parsePitch(pitchStr: string): number {
    const namedPitches: Record<string, number> = {
      'x-low': 0.5,
      'low': 0.75,
      'medium': 1.0,
      'high': 1.25,
      'x-high': 1.5
    };
    
    return namedPitches[pitchStr] || parseFloat(pitchStr) || 1.0;
  }

  private parseVolume(volumeStr: string): number {
    const namedVolumes: Record<string, number> = {
      'silent': 0.0,
      'x-soft': 0.25,
      'soft': 0.5,
      'medium': 0.75,
      'loud': 1.0,
      'x-loud': 1.0
    };
    
    return namedVolumes[volumeStr] || parseFloat(volumeStr) || 1.0;
  }

  private convertToEspeakFormat(processed: ProcessedSSML): string {
    let result = processed.text;
    
    // Convert prosody settings to espeak format
    for (const prosody of processed.prosody.reverse()) {
      const before = result.substring(0, prosody.startIndex);
      const content = result.substring(prosody.startIndex, prosody.endIndex);
      const after = result.substring(prosody.endIndex);
      
      let espeakTags = '';
      if (prosody.rate) {
        espeakTags += `[[rate ${Math.round(prosody.rate * 100)}]]`;
      }
      if (prosody.pitch) {
        espeakTags += `[[pitch ${Math.round(prosody.pitch * 100)}]]`;
      }
      
      result = before + espeakTags + content + after;
    }
    
    // Add breaks
    for (const breakSetting of processed.breaks.reverse()) {
      const before = result.substring(0, breakSetting.index);
      const after = result.substring(breakSetting.index);
      
      result = before + `[[pause ${breakSetting.duration}]]` + after;
    }
    
    return result;
  }

  private convertToFestivalFormat(processed: ProcessedSSML): any {
    // Convert to Festival Scheme format
    return {
      text: processed.text,
      prosody: processed.prosody,
      breaks: processed.breaks
    };
  }

  private extractTags(ssmlText: string): string[] {
    const tagRegex = /<(\w+)[^>]*>/g;
    const tags: string[] = [];
    
    let match;
    while ((match = tagRegex.exec(ssmlText)) !== null) {
      tags.push(match[1]);
    }
    
    return tags;
  }

  private stripAllTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }
}