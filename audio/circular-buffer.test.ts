/**
 * Circular Audio Buffer Unit Tests
 * Tests real-time audio buffer management functionality
 * Performance: Validates lock-free operation and memory efficiency
 */

import { CircularAudioBufferImpl } from './circular-buffer';

describe('CircularAudioBuffer', () => {
  let buffer: CircularAudioBufferImpl;
  const bufferSize = 1024;

  beforeEach(() => {
    buffer = new CircularAudioBufferImpl(bufferSize);
  });

  describe('Buffer Creation', () => {
    test('should create buffer with valid size', () => {
      expect(buffer).toBeDefined();
      expect(buffer.getAvailableSpace()).toBe(bufferSize);
      expect(buffer.getAvailableData()).toBe(0);
    });

    test('should reject invalid buffer sizes', () => {
      expect(() => new CircularAudioBufferImpl(0)).toThrow('Buffer size must be a positive integer');
      expect(() => new CircularAudioBufferImpl(-1)).toThrow('Buffer size must be a positive integer');
      expect(() => new CircularAudioBufferImpl(1.5)).toThrow('Buffer size must be a positive integer');
    });
  });

  describe('Write Operations', () => {
    test('should write data successfully when space available', () => {
      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      
      const result = buffer.write(testData);
      
      expect(result).toBe(true);
      expect(buffer.getAvailableData()).toBe(testData.length);
      expect(buffer.getAvailableSpace()).toBe(bufferSize - testData.length);
    });

    test('should handle empty data writes', () => {
      const emptyData = new Float32Array(0);
      
      const result = buffer.write(emptyData);
      
      expect(result).toBe(true);
      expect(buffer.getAvailableData()).toBe(0);
    });

    test('should reject writes when buffer full', () => {
      const largeData = new Float32Array(bufferSize + 1);
      largeData.fill(0.5);
      
      const result = buffer.write(largeData);
      
      expect(result).toBe(false);
      expect(buffer.getAvailableData()).toBe(0);
    });

    test('should handle wrap-around writes', () => {
      const halfSize = Math.floor(bufferSize / 2);
      const firstData = new Float32Array(halfSize);
      const secondData = new Float32Array(halfSize);
      const thirdData = new Float32Array(halfSize);
      
      firstData.fill(0.1);
      secondData.fill(0.2);
      thirdData.fill(0.3);
      
      // Fill half the buffer
      expect(buffer.write(firstData)).toBe(true);
      expect(buffer.write(secondData)).toBe(true);
      
      // Read half to make space
      const readData = buffer.read(halfSize);
      expect(readData).not.toBeNull();
      
      // Write again, should wrap around
      expect(buffer.write(thirdData)).toBe(true);
      expect(buffer.getAvailableData()).toBe(bufferSize);
    });
  });

  describe('Read Operations', () => {
    beforeEach(() => {
      // Fill buffer with test data
      const testData = new Float32Array(512);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = i / 1000; // Values from 0 to 0.511
      }
      buffer.write(testData);
    });

    test('should read data successfully when available', () => {
      const readLength = 256;
      const result = buffer.read(readLength);
      
      expect(result).not.toBeNull();
      expect(result!.length).toBe(readLength);
      expect(buffer.getAvailableData()).toBe(512 - readLength);
      
      // Verify data integrity
      for (let i = 0; i < readLength; i++) {
        expect(result![i]).toBeCloseTo(i / 1000, 5);
      }
    });

    test('should return null when insufficient data', () => {
      const result = buffer.read(1000); // More than available
      
      expect(result).toBeNull();
      expect(buffer.getAvailableData()).toBe(512); // Data should remain
    });

    test('should handle zero-length reads', () => {
      const result = buffer.read(0);
      
      expect(result).not.toBeNull();
      expect(result!.length).toBe(0);
      expect(buffer.getAvailableData()).toBe(512); // No data consumed
    });

    test('should handle wrap-around reads', () => {
      // Read most of the data
      const firstRead = buffer.read(400);
      expect(firstRead).not.toBeNull();
      
      // Write more data to cause wrap-around
      const newData = new Float32Array(400);
      newData.fill(0.9);
      expect(buffer.write(newData)).toBe(true);
      
      // Read across the wrap-around boundary
      const secondRead = buffer.read(300);
      expect(secondRead).not.toBeNull();
      expect(secondRead!.length).toBe(300);
    });
  });

  describe('Peek Operations', () => {
    beforeEach(() => {
      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      buffer.write(testData);
    });

    test('should peek data without consuming it', () => {
      const peekLength = 3;
      const peekedData = buffer.peek(peekLength);
      
      expect(peekedData).not.toBeNull();
      expect(peekedData!.length).toBe(peekLength);
      expect(buffer.getAvailableData()).toBe(5); // Data should remain
      
      // Verify peeked data matches expected values
      expect(peekedData![0]).toBeCloseTo(0.1, 5);
      expect(peekedData![1]).toBeCloseTo(0.2, 5);
      expect(peekedData![2]).toBeCloseTo(0.3, 5);
    });

    test('should return null when insufficient data for peek', () => {
      const result = buffer.peek(10); // More than available
      
      expect(result).toBeNull();
      expect(buffer.getAvailableData()).toBe(5); // Data should remain
    });

    test('should handle zero-length peeks', () => {
      const result = buffer.peek(0);
      
      expect(result).not.toBeNull();
      expect(result!.length).toBe(0);
    });

    test('should peek same data multiple times', () => {
      const peek1 = buffer.peek(3);
      const peek2 = buffer.peek(3);
      
      expect(peek1).not.toBeNull();
      expect(peek2).not.toBeNull();
      expect(peek1!.length).toBe(peek2!.length);
      
      // Should be identical
      for (let i = 0; i < peek1!.length; i++) {
        expect(peek1![i]).toBe(peek2![i]);
      }
    });
  });

  describe('Buffer Management', () => {
    test('should clear buffer correctly', () => {
      const testData = new Float32Array([0.1, 0.2, 0.3]);
      buffer.write(testData);
      
      buffer.clear();
      
      expect(buffer.getAvailableData()).toBe(0);
      expect(buffer.getAvailableSpace()).toBe(bufferSize);
    });

    test('should resize buffer preserving data', () => {
      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      buffer.write(testData);
      
      const newSize = 2048;
      buffer.resize(newSize);
      
      expect(buffer.getAvailableData()).toBe(testData.length);
      expect(buffer.getAvailableSpace()).toBe(newSize - testData.length);
      
      // Verify data integrity
      const readData = buffer.read(testData.length);
      expect(readData).not.toBeNull();
      for (let i = 0; i < testData.length; i++) {
        expect(readData![i]).toBeCloseTo(testData[i], 5);
      }
    });

    test('should handle resize to smaller buffer', () => {
      const testData = new Float32Array(800);
      testData.fill(0.5);
      buffer.write(testData);
      
      const newSize = 512;
      buffer.resize(newSize);
      
      // Should preserve as much data as possible
      expect(buffer.getAvailableData()).toBeLessThanOrEqual(newSize);
    });

    test('should reject invalid resize', () => {
      expect(() => buffer.resize(0)).toThrow('Buffer size must be a positive integer');
      expect(() => buffer.resize(-1)).toThrow('Buffer size must be a positive integer');
    });
  });

  describe('Utilization Monitoring', () => {
    test('should calculate utilization correctly', () => {
      expect(buffer.getUtilization()).toBe(0);
      
      const halfData = new Float32Array(bufferSize / 2);
      buffer.write(halfData);
      
      expect(buffer.getUtilization()).toBeCloseTo(50, 1);
      
      const quarterData = new Float32Array(bufferSize / 4);
      buffer.write(quarterData);
      
      expect(buffer.getUtilization()).toBeCloseTo(75, 1);
    });

    test('should detect nearly full condition', () => {
      expect(buffer.isNearlyFull()).toBe(false);
      
      const almostFullData = new Float32Array(Math.floor(bufferSize * 0.95));
      buffer.write(almostFullData);
      
      expect(buffer.isNearlyFull()).toBe(true);
    });

    test('should detect nearly empty condition', () => {
      const smallData = new Float32Array(Math.floor(bufferSize * 0.05));
      buffer.write(smallData);
      
      expect(buffer.isNearlyEmpty()).toBe(true);
      
      const moreData = new Float32Array(Math.floor(bufferSize * 0.2));
      buffer.write(moreData);
      
      expect(buffer.isNearlyEmpty()).toBe(false);
    });
  });

  describe('Performance and Memory Efficiency', () => {
    test('should handle rapid write/read cycles', () => {
      const iterations = 1000;
      const chunkSize = 64;
      
      for (let i = 0; i < iterations; i++) {
        const writeData = new Float32Array(chunkSize);
        writeData.fill(i / iterations);
        
        if (buffer.getAvailableSpace() >= chunkSize) {
          expect(buffer.write(writeData)).toBe(true);
        }
        
        if (buffer.getAvailableData() >= chunkSize) {
          const readData = buffer.read(chunkSize);
          expect(readData).not.toBeNull();
          expect(readData!.length).toBe(chunkSize);
        }
      }
    });

    test('should maintain performance under stress', () => {
      const startTime = performance.now();
      
      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        const data = new Float32Array(16);
        data.fill(Math.random());
        
        if (buffer.getAvailableSpace() >= 16) {
          buffer.write(data);
        }
        
        if (buffer.getAvailableData() >= 8) {
          buffer.read(8);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second max
    });
  });
});