/**
 * Circular Audio Buffer Implementation
 * Provides efficient real-time audio data management
 * Performance: Lock-free design optimized for Jetson Nano Orin
 * Safety: Bounds checking and overflow protection
 */

import { CircularAudioBuffer } from './interfaces';

export class CircularAudioBufferImpl implements CircularAudioBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private readIndex: number = 0;
  private size: number;
  private dataAvailable: number = 0;

  constructor(size: number) {
    if (size <= 0 || !Number.isInteger(size)) {
      throw new Error('Buffer size must be a positive integer');
    }
    
    this.size = size;
    this.buffer = new Float32Array(size);
  }

  /**
   * Write audio data to the buffer
   * Performance: Lock-free implementation for real-time audio
   * Safety: Prevents buffer overflow by returning false when full
   */
  write(data: Float32Array): boolean {
    if (data.length === 0) {
      return true;
    }

    const availableSpace = this.getAvailableSpace();
    if (data.length > availableSpace) {
      // Buffer would overflow
      return false;
    }

    // Write data in chunks to handle wrap-around
    let dataIndex = 0;
    let remaining = data.length;

    while (remaining > 0) {
      const chunkSize = Math.min(remaining, this.size - this.writeIndex);
      
      // Copy chunk to buffer
      for (let i = 0; i < chunkSize; i++) {
        this.buffer[this.writeIndex + i] = data[dataIndex + i];
      }

      dataIndex += chunkSize;
      this.writeIndex = (this.writeIndex + chunkSize) % this.size;
      remaining -= chunkSize;
      this.dataAvailable += chunkSize;
    }

    return true;
  }

  /**
   * Read audio data from the buffer
   * Performance: Efficient copying with wrap-around handling
   * Safety: Returns null if insufficient data available
   */
  read(length: number): Float32Array | null {
    if (length <= 0) {
      return new Float32Array(0);
    }

    if (length > this.dataAvailable) {
      return null; // Not enough data available
    }

    const result = new Float32Array(length);
    let resultIndex = 0;
    let remaining = length;

    while (remaining > 0) {
      const chunkSize = Math.min(remaining, this.size - this.readIndex);
      
      // Copy chunk from buffer
      for (let i = 0; i < chunkSize; i++) {
        result[resultIndex + i] = this.buffer[this.readIndex + i];
      }

      resultIndex += chunkSize;
      this.readIndex = (this.readIndex + chunkSize) % this.size;
      remaining -= chunkSize;
      this.dataAvailable -= chunkSize;
    }

    return result;
  }

  /**
   * Peek at audio data without consuming it
   * Performance: Non-destructive read for lookahead processing
   * Safety: Returns null if insufficient data available
   */
  peek(length: number): Float32Array | null {
    if (length <= 0) {
      return new Float32Array(0);
    }

    if (length > this.dataAvailable) {
      return null; // Not enough data available
    }

    const result = new Float32Array(length);
    let resultIndex = 0;
    let remaining = length;
    let peekIndex = this.readIndex;

    while (remaining > 0) {
      const chunkSize = Math.min(remaining, this.size - peekIndex);
      
      // Copy chunk from buffer without advancing read index
      for (let i = 0; i < chunkSize; i++) {
        result[resultIndex + i] = this.buffer[peekIndex + i];
      }

      resultIndex += chunkSize;
      peekIndex = (peekIndex + chunkSize) % this.size;
      remaining -= chunkSize;
    }

    return result;
  }

  /**
   * Get amount of data available for reading
   */
  getAvailableData(): number {
    return this.dataAvailable;
  }

  /**
   * Get amount of space available for writing
   */
  getAvailableSpace(): number {
    return this.size - this.dataAvailable;
  }

  /**
   * Clear all data from the buffer
   * Performance: Fast reset without memory reallocation
   */
  clear(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.dataAvailable = 0;
    // Note: We don't clear the actual buffer data for performance
  }

  /**
   * Resize the buffer
   * Safety: Preserves existing data when possible
   */
  resize(newSize: number): void {
    if (newSize <= 0 || !Number.isInteger(newSize)) {
      throw new Error('Buffer size must be a positive integer');
    }

    if (newSize === this.size) {
      return; // No change needed
    }

    const oldBuffer = this.buffer;
    const oldSize = this.size;
    const oldDataAvailable = this.dataAvailable;

    // Create new buffer
    this.buffer = new Float32Array(newSize);
    this.size = newSize;

    // Preserve existing data if possible
    if (oldDataAvailable > 0 && newSize > 0) {
      const preserveLength = Math.min(oldDataAvailable, newSize);
      const tempData = this.readFromOldBuffer(oldBuffer, oldSize, preserveLength);
      
      this.readIndex = 0;
      this.writeIndex = 0;
      this.dataAvailable = 0;
      
      this.write(tempData);
    } else {
      this.clear();
    }
  }

  /**
   * Get buffer utilization as percentage
   * Performance: Useful for monitoring buffer health
   */
  getUtilization(): number {
    return (this.dataAvailable / this.size) * 100;
  }

  /**
   * Check if buffer is nearly full (>90% capacity)
   * Safety: Early warning for potential overflow
   */
  isNearlyFull(): boolean {
    return this.getUtilization() > 90;
  }

  /**
   * Check if buffer is nearly empty (<10% capacity)
   * Performance: Useful for underrun detection
   */
  isNearlyEmpty(): boolean {
    return this.getUtilization() < 10;
  }

  /**
   * Helper method to read data from old buffer during resize
   */
  private readFromOldBuffer(oldBuffer: Float32Array, oldSize: number, length: number): Float32Array {
    const result = new Float32Array(length);
    let resultIndex = 0;
    let remaining = length;
    let readIdx = this.readIndex;

    while (remaining > 0 && resultIndex < length) {
      const chunkSize = Math.min(remaining, oldSize - readIdx);
      
      for (let i = 0; i < chunkSize; i++) {
        result[resultIndex + i] = oldBuffer[readIdx + i];
      }

      resultIndex += chunkSize;
      readIdx = (readIdx + chunkSize) % oldSize;
      remaining -= chunkSize;
    }

    return result;
  }
}