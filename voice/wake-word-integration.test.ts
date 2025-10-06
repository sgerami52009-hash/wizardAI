/**
 * Wake Word System Integration Test
 * Tests the integration between WakeWordDetector and WakeWordManager
 * Simplified test to verify basic functionality
 */

import { WakeWordDetectorImpl } from './wake-word-detector';
import { WakeWordManager } from './wake-word-manager';

describe('Wake Word System Integration', () => {
  let detector: WakeWordDetectorImpl;
  let manager: WakeWordManager;

  beforeEach(() => {
    detector = new WakeWordDetectorImpl({
      sensitivity: 0.7,
      maxConcurrentModels: 2
    });
    
    manager = new WakeWordManager(detector, {
      maxActiveWakeWords: 2,
      safetyValidation: false // Disable for testing
    });
  });

  afterEach(async () => {
    await manager.destroy();
    detector.destroy();
  });

  test('should initialize manager and detector together', async () => {
    await manager.initialize();
    
    const profiles = manager.getAllProfiles();
    expect(profiles.length).toBeGreaterThan(0);
  });

  test('should add and activate wake word through manager', async () => {
    await manager.initialize();
    
    const profileId = await manager.addWakeWord('Test Integration');
    expect(profileId).toBeDefined();
    
    const activeProfiles = manager.getActiveProfiles();
    const activeProfile = activeProfiles.find(p => p.id === profileId);
    expect(activeProfile).toBeDefined();
  });

  test('should handle wake word detection events', async () => {
    await manager.initialize();
    
    const profileId = await manager.addWakeWord('Event Test');
    
    // Simulate wake word detection
    const profiles = manager.getAllProfiles();
    const profile = profiles.find(p => p.id === profileId)!;
    
    let usageUpdated = false;
    manager.on('wake-word-used', () => {
      usageUpdated = true;
    });
    
    // Simulate detector emitting wake word detected event
    detector.emit('wake-word-detected', { phrase: profile.phrase });
    
    expect(usageUpdated).toBe(true);
  });

  test('should get system status', () => {
    const detectorStatus = detector.getStatus();
    expect(detectorStatus).toBeDefined();
    expect(typeof detectorStatus.isListening).toBe('boolean');
    expect(typeof detectorStatus.activeModels).toBe('number');
    expect(typeof detectorStatus.sensitivity).toBe('number');
  });
});