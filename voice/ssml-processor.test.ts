/**
 * Unit tests for SSML Processor
 * Safety: Validate child-safe SSML tag filtering
 * Performance: Test SSML parsing efficiency
 */

import { SSMLProcessor, ProcessedSSML } from './ssml-processor';

describe('SSMLProcessor', () => {
  let processor: SSMLProcessor;

  beforeEach(() => {
    processor = new SSMLProcessor();
  });

  describe('SSML Processing', () => {
    test('should process basic SSML markup', () => {
      const ssml = '<speak>Hello <break time="500ms"/> world!</speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('Hello  world!');
      expect(result.breaks).toHaveLength(1);
      expect(result.breaks[0].duration).toBe(500);
    });

    test('should handle prosody tags', () => {
      const ssml = '<speak><prosody rate="slow" pitch="high">Hello world</prosody></speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('Hello world');
      expect(result.prosody).toHaveLength(1);
      expect(result.prosody[0].rate).toBe(0.75); // 'slow' maps to 0.75
      expect(result.prosody[0].pitch).toBe(1.25); // 'high' maps to 1.25
    });

    test('should handle emphasis tags', () => {
      const ssml = '<speak>This is <emphasis level="strong">very important</emphasis>!</speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('This is very important!');
      expect(result.emphasis).toHaveLength(1);
      expect(result.emphasis[0].level).toBe('strong');
      expect(result.emphasis[0].startIndex).toBe(8);
      expect(result.emphasis[0].endIndex).toBe(22);
    });

    test('should handle nested SSML elements', () => {
      const ssml = `
        <speak>
          <p>
            <prosody rate="fast">
              Quick <emphasis level="moderate">important</emphasis> message
            </prosody>
          </p>
        </speak>
      `;
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toContain('Quick important message');
      expect(result.prosody).toHaveLength(1);
      expect(result.emphasis).toHaveLength(1);
      expect(result.breaks).toHaveLength(1); // From paragraph tag
    });

    test('should handle multiple break elements', () => {
      const ssml = '<speak>First<break time="300ms"/>Second<break time="1s"/>Third</speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('FirstSecondThird');
      expect(result.breaks).toHaveLength(2);
      expect(result.breaks[0].duration).toBe(300);
      expect(result.breaks[1].duration).toBe(1000);
    });
  });

  describe('Child Safety Validation', () => {
    test('should validate child-safe SSML tags', () => {
      const safeSsml = '<speak><p>Hello <break time="500ms"/> world</p></speak>';
      
      const isValid = processor.validateChildSafety(safeSsml);
      
      expect(isValid).toBe(true);
    });

    test('should reject unsafe SSML tags', () => {
      const unsafeSsml = '<speak><audio src="external.mp3">Hello world</audio></speak>';
      
      const isValid = processor.validateChildSafety(unsafeSsml);
      
      expect(isValid).toBe(false);
    });

    test('should sanitize dangerous tags in child safe mode', () => {
      const dangerousSsml = '<speak>Hello <audio src="bad.mp3">world</audio> <mark name="test"/>!</speak>';
      
      const result = processor.processSSML(dangerousSsml, true);
      
      expect(result.text).toBe('Hello !');
      // Dangerous tags should be removed
    });

    test('should allow all safe tags for children', () => {
      const childSafeSsml = `
        <speak>
          <p>Hello there!</p>
          <s>This is a sentence.</s>
          <break time="500ms"/>
          <prosody rate="slow">Slow speech</prosody>
          <emphasis level="moderate">Important</emphasis>
        </speak>
      `;
      
      const result = processor.processSSML(childSafeSsml, true);
      
      expect(result.text).toContain('Hello there!');
      expect(result.text).toContain('This is a sentence.');
      expect(result.text).toContain('Slow speech');
      expect(result.text).toContain('Important');
    });
  });

  describe('SSML Parsing', () => {
    test('should parse SSML attributes correctly', () => {
      const ssml = '<speak><prosody rate="1.5" pitch="high" volume="loud">Test</prosody></speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.prosody[0].rate).toBe(1.5);
      expect(result.prosody[0].pitch).toBe(1.25); // 'high'
      expect(result.prosody[0].volume).toBe(1.0); // 'loud'
    });

    test('should handle self-closing tags', () => {
      const ssml = '<speak>Hello<break time="500ms"/>world</speak>';
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('Helloworld');
      expect(result.breaks).toHaveLength(1);
    });

    test('should handle malformed SSML gracefully', () => {
      const malformedSsml = '<speak>Hello <break time="500ms" world</speak>';
      
      const result = processor.processSSML(malformedSsml);
      
      // Should fallback to plain text
      expect(result.text).toContain('Hello');
      expect(result.text).toContain('world');
    });

    test('should strip all tags when processing fails', () => {
      const invalidSsml = '<speak><invalid>Hello</invalid> <broken>world</broken></speak>';
      
      const result = processor.processSSML(invalidSsml);
      
      expect(result.text).toBe('Hello world');
      expect(result.prosody).toHaveLength(0);
      expect(result.breaks).toHaveLength(0);
    });
  });

  describe('Time and Rate Parsing', () => {
    test('should parse time values correctly', () => {
      const testCases = [
        { input: '500ms', expected: 500 },
        { input: '1s', expected: 1000 },
        { input: '1.5s', expected: 1500 },
        { input: '250ms', expected: 250 }
      ];

      testCases.forEach(({ input, expected }) => {
        const ssml = `<speak>Hello<break time="${input}"/>world</speak>`;
        const result = processor.processSSML(ssml);
        
        expect(result.breaks[0].duration).toBe(expected);
      });
    });

    test('should parse rate values correctly', () => {
      const testCases = [
        { input: 'x-slow', expected: 0.5 },
        { input: 'slow', expected: 0.75 },
        { input: 'medium', expected: 1.0 },
        { input: 'fast', expected: 1.25 },
        { input: 'x-fast', expected: 1.5 },
        { input: '1.2', expected: 1.2 },
        { input: '80%', expected: 0.8 }
      ];

      testCases.forEach(({ input, expected }) => {
        const ssml = `<speak><prosody rate="${input}">Test</prosody></speak>`;
        const result = processor.processSSML(ssml);
        
        expect(result.prosody[0].rate).toBe(expected);
      });
    });

    test('should parse pitch values correctly', () => {
      const testCases = [
        { input: 'x-low', expected: 0.5 },
        { input: 'low', expected: 0.75 },
        { input: 'medium', expected: 1.0 },
        { input: 'high', expected: 1.25 },
        { input: 'x-high', expected: 1.5 },
        { input: '1.3', expected: 1.3 }
      ];

      testCases.forEach(({ input, expected }) => {
        const ssml = `<speak><prosody pitch="${input}">Test</prosody></speak>`;
        const result = processor.processSSML(ssml);
        
        expect(result.prosody[0].pitch).toBe(expected);
      });
    });
  });

  describe('Engine Format Conversion', () => {
    test('should convert to espeak format', () => {
      const ssml = '<speak><prosody rate="fast" pitch="high">Hello</prosody><break time="500ms"/>world</speak>';
      const processed = processor.processSSML(ssml);
      
      const espeakFormat = processor.convertToEngineFormat(processed, 'espeak');
      
      expect(typeof espeakFormat).toBe('string');
      expect(espeakFormat).toContain('[[rate');
      expect(espeakFormat).toContain('[[pitch');
      expect(espeakFormat).toContain('[[pause');
    });

    test('should convert to festival format', () => {
      const ssml = '<speak><prosody rate="slow">Hello world</prosody></speak>';
      const processed = processor.processSSML(ssml);
      
      const festivalFormat = processor.convertToEngineFormat(processed, 'festival');
      
      expect(typeof festivalFormat).toBe('object');
      expect(festivalFormat).toHaveProperty('text');
      expect(festivalFormat).toHaveProperty('prosody');
    });

    test('should return processed format for unknown engine', () => {
      const ssml = '<speak>Hello world</speak>';
      const processed = processor.processSSML(ssml);
      
      const unknownFormat = processor.convertToEngineFormat(processed, 'unknown');
      
      expect(unknownFormat).toEqual(processed);
    });
  });

  describe('Complex SSML Scenarios', () => {
    test('should handle overlapping prosody and emphasis', () => {
      const ssml = `
        <speak>
          <prosody rate="slow">
            This is <emphasis level="strong">very important</emphasis> information
          </prosody>
        </speak>
      `;
      
      const result = processor.processSSML(ssml);
      
      expect(result.prosody).toHaveLength(1);
      expect(result.emphasis).toHaveLength(1);
      expect(result.text).toContain('This is very important information');
    });

    test('should handle sentence and paragraph breaks', () => {
      const ssml = `
        <speak>
          <p>First paragraph.</p>
          <p>Second paragraph with <s>multiple sentences.</s> <s>Another sentence.</s></p>
        </speak>
      `;
      
      const result = processor.processSSML(ssml);
      
      expect(result.breaks.length).toBeGreaterThan(0);
      // Should have breaks for paragraphs and sentences
    });

    test('should preserve text order with complex nesting', () => {
      const ssml = `
        <speak>
          Start
          <prosody rate="fast">
            <emphasis level="moderate">Fast and emphasized</emphasis>
            <break time="200ms"/>
            More fast text
          </prosody>
          End
        </speak>
      `;
      
      const result = processor.processSSML(ssml);
      
      expect(result.text).toBe('Start Fast and emphasized More fast text End');
    });
  });
});