/**
 * Audio Device Manager Unit Tests
 * Tests device detection, configuration, and management functionality
 * Safety: Validates error handling and resource cleanup
 */

import { AudioDeviceManagerImpl } from './device-manager';
import { AudioDevice } from './interfaces';

describe('AudioDeviceManager', () => {
  let deviceManager: AudioDeviceManagerImpl;

  beforeEach(() => {
    deviceManager = new AudioDeviceManagerImpl();
  });

  afterEach(() => {
    deviceManager.destroy();
  });

  describe('Device Detection', () => {
    test('should detect available audio devices', async () => {
      const devices = await deviceManager.getAvailableDevices();
      
      expect(devices).toBeDefined();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      
      // Should have at least one input and one output device
      const inputDevices = devices.filter(d => d.type === 'input');
      const outputDevices = devices.filter(d => d.type === 'output');
      
      expect(inputDevices.length).toBeGreaterThan(0);
      expect(outputDevices.length).toBeGreaterThan(0);
    });

    test('should identify default devices correctly', async () => {
      const devices = await deviceManager.getAvailableDevices();
      
      const defaultInput = devices.find(d => d.type === 'input' && d.isDefault);
      const defaultOutput = devices.find(d => d.type === 'output' && d.isDefault);
      
      expect(defaultInput).toBeDefined();
      expect(defaultOutput).toBeDefined();
    });

    test('should provide device capabilities', async () => {
      const devices = await deviceManager.getAvailableDevices();
      
      devices.forEach(device => {
        expect(device.capabilities).toBeDefined();
        expect(device.capabilities.sampleRates).toBeDefined();
        expect(device.capabilities.channels).toBeDefined();
        expect(device.capabilities.bitDepths).toBeDefined();
        expect(typeof device.capabilities.maxLatency).toBe('number');
        expect(typeof device.capabilities.supportsRealTime).toBe('boolean');
      });
    });
  });

  describe('Device Selection', () => {
    test('should select valid input device', async () => {
      const devices = await deviceManager.getAvailableDevices();
      const inputDevice = devices.find(d => d.type === 'input' && d.isAvailable);
      
      expect(inputDevice).toBeDefined();
      
      await expect(deviceManager.selectDevice(inputDevice!.id)).resolves.not.toThrow();
      
      const selected = deviceManager.getSelectedDevices();
      expect(selected.input).toBeDefined();
      expect(selected.input!.id).toBe(inputDevice!.id);
    });

    test('should select valid output device', async () => {
      const devices = await deviceManager.getAvailableDevices();
      const outputDevice = devices.find(d => d.type === 'output' && d.isAvailable);
      
      expect(outputDevice).toBeDefined();
      
      await expect(deviceManager.selectDevice(outputDevice!.id)).resolves.not.toThrow();
      
      const selected = deviceManager.getSelectedDevices();
      expect(selected.output).toBeDefined();
      expect(selected.output!.id).toBe(outputDevice!.id);
    });

    test('should reject invalid device selection', async () => {
      await expect(deviceManager.selectDevice('invalid-device-id'))
        .rejects.toThrow('Device invalid-device-id not found');
    });

    test('should reject unavailable device selection', async () => {
      // Mock an unavailable device
      const devices = await deviceManager.getAvailableDevices();
      const device = devices[0];
      device.isAvailable = false;
      
      await expect(deviceManager.selectDevice(device.id))
        .rejects.toThrow(`Device ${device.id} is not available`);
    });
  });

  describe('Device Testing', () => {
    test('should test available devices successfully', async () => {
      const devices = await deviceManager.getAvailableDevices();
      const availableDevice = devices.find(d => d.isAvailable);
      
      expect(availableDevice).toBeDefined();
      
      const testResult = await deviceManager.testDevice(availableDevice!.id);
      expect(testResult).toBe(true);
    });

    test('should fail test for unavailable devices', async () => {
      const testResult = await deviceManager.testDevice('non-existent-device');
      expect(testResult).toBe(false);
    });
  });

  describe('Default Device Retrieval', () => {
    test('should get default input device', async () => {
      const defaultInput = await deviceManager.getDefaultDevice('input');
      
      expect(defaultInput).toBeDefined();
      expect(defaultInput.type).toBe('input');
      expect(defaultInput.isDefault).toBe(true);
      expect(defaultInput.isAvailable).toBe(true);
    });

    test('should get default output device', async () => {
      const defaultOutput = await deviceManager.getDefaultDevice('output');
      
      expect(defaultOutput).toBeDefined();
      expect(defaultOutput.type).toBe('output');
      expect(defaultOutput.isDefault).toBe(true);
      expect(defaultOutput.isAvailable).toBe(true);
    });
  });

  describe('Event Handling', () => {
    test('should emit device selection events', async () => {
      const devices = await deviceManager.getAvailableDevices();
      const device = devices.find(d => d.isAvailable);
      
      expect(device).toBeDefined();
      
      const eventPromise = new Promise<AudioDevice>((resolve) => {
        deviceManager.once('deviceSelected', resolve);
      });
      
      await deviceManager.selectDevice(device!.id);
      
      const selectedDevice = await eventPromise;
      expect(selectedDevice.id).toBe(device!.id);
    });

    test('should handle device change callbacks', async () => {
      let callbackCalled = false;
      let receivedDevices: AudioDevice[] = [];
      
      deviceManager.onDeviceChange((devices) => {
        callbackCalled = true;
        receivedDevices = devices;
      });
      
      // Trigger device refresh
      await deviceManager.getAvailableDevices();
      
      // Wait a bit for the callback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(callbackCalled).toBe(true);
      expect(receivedDevices.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on destroy', () => {
      const spy = jest.spyOn(deviceManager, 'removeAllListeners');
      
      deviceManager.destroy();
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Jetson Nano Orin Optimization', () => {
    test('should provide optimized capabilities for Jetson hardware', async () => {
      const devices = await deviceManager.getAvailableDevices();
      
      devices.forEach(device => {
        const caps = device.capabilities;
        
        // Should include 16kHz for voice processing
        expect(caps.sampleRates).toContain(16000);
        
        // Should support real-time processing
        expect(caps.supportsRealTime).toBe(true);
        
        // Should have reasonable latency limits
        expect(caps.maxLatency).toBeLessThanOrEqual(100);
        
        // Should support common bit depths
        expect(caps.bitDepths).toContain(16);
      });
    });
  });
});