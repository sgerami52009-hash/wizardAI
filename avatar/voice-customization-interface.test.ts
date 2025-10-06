// Voice Customization Interface Tests

import { 
  VoiceCustomizationInterfaceImpl,
  VoiceParameterControls,
  VoicePresetSystem,
  VoiceConsistencyValidator,
  VoiceSampleGenerator
} from './voice-customization-interface';

import { 
  VoiceCharacteristics, 
  AccentType, 
  EmotionalTone, 
  AgeRange,
  ValidationResult
} from './types';

import { voiceCharacteristicsManager } from './voice-characteristics-manager';

// Mock the voice characteristics manager
jest.mock('./voice-characteristics-manager', () => ({
  voiceCharacteristicsManager: {
    getActiveVoiceSettings: jest.fn(),
    validateVoiceSettings: jest.fn(),
    updateVoiceCharacteristics: jest.fn(),
    setActiveVoiceSettings: jest.fn(),
    getVoicePresets: jest.fn(),
    previewVoice: jest.fn()
  }
}));

// Mock the event bus and error handler
jest.mock('./events', () => ({
  avatarEventBus: {
    emit: jest.fn(),
    on: jest.fn(),
    emitSystemError: jest.fn()
  }
}));

jest.mock('./errors', () => ({
  AvatarError: class MockAvatarError extends Error {
    constructor(
      public code: string,
      message: string,
      public component: string,
      public severity: string,
      public recoverable: boolean,
      public context?: any
    ) {
      super(message);
    }
  },
  avatarErrorHandler: {
    handleError: jest.fn()
  }
}));

describe('VoiceCustomizationInterface', () => {
  let voiceInterface: VoiceCustomizationInterfaceImpl;
  const mockUserId = 'test-user-123';
  const mockUserAge = 10;

  const mockVoiceCharacteristics: VoiceCharacteristics = {
    pitch: 0.2,
    speed: 1.1,
    accent: AccentType.AMERICAN,
    emotionalTone: EmotionalTone.CHEERFUL,
    volume: 0.8
  };

  beforeEach(() => {
    voiceInterface = new VoiceCustomizationInterfaceImpl();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid user data', async () => {
      // Mock existing voice settings
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);

      // Mock voice presets
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([
          {
            id: 'child-friendly',
            name: 'Friendly Helper',
            description: 'A warm voice for children',
            characteristics: mockVoiceCharacteristics,
            ageAppropriate: [AgeRange.CHILD]
          }
        ]);

      await voiceInterface.initialize(mockUserId, mockUserAge);

      expect(voiceInterface.getCurrentCharacteristics()).toEqual(mockVoiceCharacteristics);
    });

    it('should use age-appropriate defaults when no existing settings', async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(undefined);

      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([
          {
            id: 'child-default',
            name: 'Default Child Voice',
            description: 'Safe default for children',
            characteristics: {
              pitch: 0.5,
              speed: 0.9,
              accent: AccentType.NEUTRAL,
              emotionalTone: EmotionalTone.GENTLE,
              volume: 0.7
            },
            ageAppropriate: [AgeRange.CHILD]
          }
        ]);

      await voiceInterface.initialize(mockUserId, mockUserAge);

      const characteristics = voiceInterface.getCurrentCharacteristics();
      expect(characteristics.pitch).toBe(0.5);
      expect(characteristics.emotionalTone).toBe(EmotionalTone.GENTLE);
    });

    it('should handle initialization errors gracefully', async () => {
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockRejectedValue(new Error('Network error'));

      await expect(voiceInterface.initialize(mockUserId, mockUserAge))
        .rejects.toThrow('Network error');
    });
  });

  describe('Voice Characteristics Management', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should update voice characteristics successfully', async () => {
      const validationResult: ValidationResult = {
        isValid: true,
        requiresParentalApproval: false,
        blockedElements: [],
        warnings: [],
        errors: []
      };

      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: true,
          violations: [],
          riskLevel: 'low',
          reason: 'Settings are appropriate',
          requiresParentalApproval: false,
          blockedContent: [],
          recommendations: []
        });

      (voiceCharacteristicsManager.updateVoiceCharacteristics as jest.Mock)
        .mockResolvedValue(validationResult);

      const newCharacteristics = { pitch: 0.5 };
      const result = await voiceInterface.updateCharacteristics(newCharacteristics);

      expect(result.isValid).toBe(true);
      expect(voiceCharacteristicsManager.updateVoiceCharacteristics)
        .toHaveBeenCalledWith({ ...mockVoiceCharacteristics, ...newCharacteristics });
    });

    it('should reject inappropriate voice characteristics', async () => {
      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: false,
          violations: ['Pitch too high for age group'],
          riskLevel: 'high',
          reason: 'Age inappropriate settings',
          requiresParentalApproval: true,
          blockedContent: ['pitch'],
          recommendations: ['Lower the pitch setting']
        });

      const inappropriateCharacteristics = { pitch: 2.0 };
      const result = await voiceInterface.updateCharacteristics(inappropriateCharacteristics);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pitch too high for age group');
      expect(result.requiresParentalApproval).toBe(true);
    });

    it('should reset to age-appropriate defaults', async () => {
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([
          {
            id: 'default',
            name: 'Default',
            description: 'Default voice',
            characteristics: {
              pitch: 0.0,
              speed: 1.0,
              accent: AccentType.NEUTRAL,
              emotionalTone: EmotionalTone.CALM,
              volume: 0.8
            },
            ageAppropriate: [AgeRange.CHILD]
          }
        ]);

      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: true,
          violations: [],
          riskLevel: 'low',
          reason: 'Default settings are safe',
          requiresParentalApproval: false,
          blockedContent: [],
          recommendations: []
        });

      (voiceCharacteristicsManager.updateVoiceCharacteristics as jest.Mock)
        .mockResolvedValue({
          isValid: true,
          requiresParentalApproval: false,
          blockedElements: [],
          warnings: [],
          errors: []
        });

      await voiceInterface.resetToDefaults();

      const characteristics = voiceInterface.getCurrentCharacteristics();
      expect(characteristics.pitch).toBe(0.0);
      expect(characteristics.emotionalTone).toBe(EmotionalTone.CALM);
    });
  });

  describe('Parameter Controls', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should provide parameter controls with correct ranges', () => {
      const controls = voiceInterface.getParameterControls();

      expect(controls.pitch.min).toBe(-1.0); // Child age range
      expect(controls.pitch.max).toBe(1.5);
      expect(controls.speed.min).toBe(0.8);
      expect(controls.speed.max).toBe(1.4);
      expect(controls.volume.max).toBe(0.9);
    });

    it('should validate parameter values correctly', async () => {
      const controls = voiceInterface.getParameterControls();

      // Valid pitch
      const validPitchResult = controls.pitch.onValidate(0.5);
      expect(validPitchResult.isValid).toBe(true);

      // Invalid pitch (too high)
      const invalidPitchResult = controls.pitch.onValidate(3.0);
      expect(invalidPitchResult.isValid).toBe(false);
      expect(invalidPitchResult.errors).toContain('Pitch must be between -2.0 and 2.0');

      // Valid speed
      const validSpeedResult = controls.speed.onValidate(1.2);
      expect(validSpeedResult.isValid).toBe(true);

      // Invalid speed (too fast)
      const invalidSpeedResult = controls.speed.onValidate(3.0);
      expect(invalidSpeedResult.isValid).toBe(false);
    });

    it('should provide age-appropriate accent options', () => {
      const controls = voiceInterface.getParameterControls();
      const accentOptions = controls.accent.options;

      // Child age should have limited accent options
      const childAppropriateAccents = accentOptions.filter((option: any) => 
        option.ageAppropriate.includes(AgeRange.CHILD)
      );

      expect(childAppropriateAccents.length).toBeGreaterThan(0);
      expect(childAppropriateAccents.some((option: any) => option.value === AccentType.NEUTRAL)).toBe(true);
    });

    it('should provide age-appropriate emotional tone options', () => {
      const controls = voiceInterface.getParameterControls();
      const toneOptions = controls.emotionalTone.options;

      // All tones should be appropriate for children
      const childAppropriateTones = toneOptions.filter((option: any) => 
        option.ageAppropriate.includes(AgeRange.CHILD)
      );

      expect(childAppropriateTones.length).toBeGreaterThan(0);
      expect(childAppropriateTones.some((option: any) => option.value === EmotionalTone.CHEERFUL)).toBe(true);
      expect(childAppropriateTones.some((option: any) => option.value === EmotionalTone.GENTLE)).toBe(true);
    });
  });

  describe('Preset System', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);

      const mockPresets = [
        {
          id: 'child-friendly',
          name: 'Friendly Helper',
          description: 'A warm voice for children',
          characteristics: mockVoiceCharacteristics,
          ageAppropriate: [AgeRange.CHILD]
        },
        {
          id: 'child-calm',
          name: 'Calm Companion',
          description: 'A soothing voice',
          characteristics: {
            pitch: 0.0,
            speed: 0.9,
            accent: AccentType.NEUTRAL,
            emotionalTone: EmotionalTone.GENTLE,
            volume: 0.7
          },
          ageAppropriate: [AgeRange.CHILD]
        }
      ];

      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue(mockPresets);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should load age-appropriate presets', async () => {
      const presetSystem = voiceInterface.getPresetSystem();
      const presets = await presetSystem.getPresetsForAge(mockUserAge);

      expect(presets.length).toBe(2);
      expect(presets[0].name).toBe('Friendly Helper');
      expect(presets[1].name).toBe('Calm Companion');
    });

    it('should load preset successfully', async () => {
      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: true,
          violations: [],
          riskLevel: 'low',
          reason: 'Preset is appropriate',
          requiresParentalApproval: false,
          blockedContent: [],
          recommendations: []
        });

      (voiceCharacteristicsManager.updateVoiceCharacteristics as jest.Mock)
        .mockResolvedValue({
          isValid: true,
          requiresParentalApproval: false,
          blockedElements: [],
          warnings: [],
          errors: []
        });

      const presetSystem = voiceInterface.getPresetSystem();
      const result = await presetSystem.loadPreset('child-friendly');

      expect(result.isValid).toBe(true);
    });

    it('should handle loading non-existent preset', async () => {
      const presetSystem = voiceInterface.getPresetSystem();
      const result = await presetSystem.loadPreset('non-existent');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Preset not found');
    });

    it('should save custom preset', async () => {
      const presetSystem = voiceInterface.getPresetSystem();
      const customPreset = await presetSystem.saveCustomPreset(
        'My Custom Voice',
        'A personalized voice setting'
      );

      expect(customPreset.name).toBe('My Custom Voice');
      expect(customPreset.description).toBe('A personalized voice setting');
      expect(customPreset.characteristics).toEqual(mockVoiceCharacteristics);
      expect(customPreset.ageAppropriate).toContain(AgeRange.CHILD);
    });

    it('should delete custom preset', async () => {
      const presetSystem = voiceInterface.getPresetSystem();
      
      // First save a custom preset
      const customPreset = await presetSystem.saveCustomPreset('Test Preset', 'Test description');
      expect(presetSystem.customPresets.length).toBe(1);

      // Then delete it
      await presetSystem.deleteCustomPreset(customPreset.id);
      expect(presetSystem.customPresets.length).toBe(0);
    });
  });

  describe('Consistency Validation', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should detect parameter conflicts', async () => {
      const validator = voiceInterface.getConsistencyValidator();
      
      // High pitch with calm tone should create conflict
      const conflictingCharacteristics: VoiceCharacteristics = {
        pitch: 1.5,
        speed: 1.0,
        accent: AccentType.NEUTRAL,
        emotionalTone: EmotionalTone.CALM,
        volume: 0.8
      };

      const result = await validator.validateCharacteristics(conflictingCharacteristics, mockUserAge);

      expect(result.isConsistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].parameter).toBe('pitch');
      expect(result.overallScore).toBeLessThan(1.0);
    });

    it('should validate consistent characteristics', async () => {
      const validator = voiceInterface.getConsistencyValidator();
      
      // Matching pitch and tone
      const consistentCharacteristics: VoiceCharacteristics = {
        pitch: 0.3,
        speed: 1.1,
        accent: AccentType.AMERICAN,
        emotionalTone: EmotionalTone.CHEERFUL,
        volume: 0.8
      };

      const result = await validator.validateCharacteristics(consistentCharacteristics, mockUserAge);

      expect(result.isConsistent).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.overallScore).toBe(1.0);
    });

    it('should check parameter conflicts', () => {
      const validator = voiceInterface.getConsistencyValidator();
      
      const conflictingCharacteristics: VoiceCharacteristics = {
        pitch: -1.5, // Very low pitch
        speed: 1.0,
        accent: AccentType.NEUTRAL,
        emotionalTone: EmotionalTone.CHEERFUL, // Cheerful tone
        volume: 0.8
      };

      const conflicts = validator.checkParameterConflicts(conflictingCharacteristics);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe('parameter');
      expect(conflicts[0].parameters).toContain('pitch');
      expect(conflicts[0].parameters).toContain('emotionalTone');
    });

    it('should suggest optimal settings based on preferences', async () => {
      const validator = voiceInterface.getConsistencyValidator();
      
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([
          {
            id: 'default',
            name: 'Default',
            description: 'Default voice',
            characteristics: {
              pitch: 0.0,
              speed: 1.0,
              accent: AccentType.NEUTRAL,
              emotionalTone: EmotionalTone.CALM,
              volume: 0.8
            },
            ageAppropriate: [AgeRange.CHILD]
          }
        ]);

      const preferences = {
        preferredTone: [EmotionalTone.CHEERFUL],
        preferredAccent: [AccentType.AMERICAN],
        speedPreference: 'fast' as const,
        pitchPreference: 'high' as const
      };

      const optimal = await validator.suggestOptimalSettings(mockUserAge, preferences);

      expect(optimal.emotionalTone).toBe(EmotionalTone.CHEERFUL);
      expect(optimal.accent).toBe(AccentType.AMERICAN);
      expect(optimal.speed).toBeGreaterThan(1.0); // Should be faster
      expect(optimal.pitch).toBeGreaterThan(0.0); // Should be higher
    });
  });

  describe('Sample Generation', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should generate voice sample successfully', async () => {
      const mockAudioBuffer = {
        length: 44100,
        duration: 1.0,
        sampleRate: 44100,
        numberOfChannels: 1
      };

      (voiceCharacteristicsManager.previewVoice as jest.Mock)
        .mockResolvedValue(mockAudioBuffer);

      const generator = voiceInterface.getSampleGenerator();
      const sample = await generator.generateSample(mockVoiceCharacteristics, 'Hello world');

      expect(sample.audioBuffer).toEqual(mockAudioBuffer);
      expect(sample.characteristics).toEqual(mockVoiceCharacteristics);
      expect(sample.sampleText).toBe('Hello world');
      expect(sample.quality.clarity).toBeGreaterThan(0);
    });

    it('should use default sample text when none provided', async () => {
      const mockAudioBuffer = {
        length: 44100,
        duration: 1.0,
        sampleRate: 44100,
        numberOfChannels: 1
      };

      (voiceCharacteristicsManager.previewVoice as jest.Mock)
        .mockResolvedValue(mockAudioBuffer);

      const generator = voiceInterface.getSampleGenerator();
      const sample = await generator.generateSample(mockVoiceCharacteristics);

      expect(sample.sampleText).toContain('excited'); // Should use cheerful default text
    });

    it('should generate comparison between two voice settings', async () => {
      const mockAudioBuffer = {
        length: 44100,
        duration: 1.0,
        sampleRate: 44100,
        numberOfChannels: 1
      };

      (voiceCharacteristicsManager.previewVoice as jest.Mock)
        .mockResolvedValue(mockAudioBuffer);

      const characteristics2: VoiceCharacteristics = {
        ...mockVoiceCharacteristics,
        pitch: 0.8,
        speed: 1.3
      };

      const generator = voiceInterface.getSampleGenerator();
      const comparison = await generator.generateComparison(mockVoiceCharacteristics, characteristics2);

      expect(comparison.sample1.characteristics).toEqual(mockVoiceCharacteristics);
      expect(comparison.sample2.characteristics).toEqual(characteristics2);
      expect(comparison.differences.length).toBeGreaterThan(0);
      expect(comparison.differences.some((diff: any) => diff.parameter === 'pitch')).toBe(true);
      expect(comparison.differences.some((diff: any) => diff.parameter === 'speed')).toBe(true);
    });

    it('should provide age-appropriate default sample texts', () => {
      const generator = voiceInterface.getSampleGenerator();
      
      const childTexts = generator.getDefaultSampleTexts(8);
      const teenTexts = generator.getDefaultSampleTexts(15);
      const adultTexts = generator.getDefaultSampleTexts(25);

      expect(childTexts.length).toBeGreaterThan(0);
      expect(teenTexts.length).toBeGreaterThan(0);
      expect(adultTexts.length).toBeGreaterThan(0);

      // Child texts should be more playful
      expect(childTexts.some((text: string) => text.includes('play') || text.includes('fun'))).toBe(true);
      
      // Teen texts should be more casual
      expect(teenTexts.some((text: string) => text.includes('Hey') || text.includes('What\'s up'))).toBe(true);
    });

    it('should handle sample generation errors gracefully', async () => {
      (voiceCharacteristicsManager.previewVoice as jest.Mock)
        .mockRejectedValue(new Error('TTS engine unavailable'));

      const generator = voiceInterface.getSampleGenerator();
      
      await expect(generator.generateSample(mockVoiceCharacteristics))
        .rejects.toThrow('Failed to generate voice sample: TTS engine unavailable');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(mockVoiceCharacteristics);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, mockUserAge);
    });

    it('should trigger characteristics changed callback', async () => {
      const callback = jest.fn();
      voiceInterface.onCharacteristicsChanged(callback);

      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: true,
          violations: [],
          riskLevel: 'low',
          reason: 'Settings are appropriate',
          requiresParentalApproval: false,
          blockedContent: [],
          recommendations: []
        });

      (voiceCharacteristicsManager.updateVoiceCharacteristics as jest.Mock)
        .mockResolvedValue({
          isValid: true,
          requiresParentalApproval: false,
          blockedElements: [],
          warnings: [],
          errors: []
        });

      await voiceInterface.updateCharacteristics({ pitch: 0.5 });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ pitch: 0.5 })
      );
    });

    it('should trigger validation error callback', async () => {
      const callback = jest.fn();
      voiceInterface.onValidationError(callback);

      (voiceCharacteristicsManager.validateVoiceSettings as jest.Mock)
        .mockResolvedValue({
          isAllowed: false,
          violations: ['Invalid setting'],
          riskLevel: 'high',
          reason: 'Inappropriate for age',
          requiresParentalApproval: true,
          blockedContent: ['pitch'],
          recommendations: []
        });

      await voiceInterface.updateCharacteristics({ pitch: 3.0 });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isValid: false,
          errors: ['Invalid setting']
        })
      );
    });

    it('should trigger sample generated callback', async () => {
      const callback = jest.fn();
      voiceInterface.onSampleGenerated(callback);

      const mockAudioBuffer = {
        length: 44100,
        duration: 1.0,
        sampleRate: 44100,
        numberOfChannels: 1
      };

      (voiceCharacteristicsManager.previewVoice as jest.Mock)
        .mockResolvedValue(mockAudioBuffer);

      const generator = voiceInterface.getSampleGenerator();
      await generator.generateSample(mockVoiceCharacteristics);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          audioBuffer: mockAudioBuffer,
          characteristics: mockVoiceCharacteristics
        })
      );
    });
  });

  describe('Age-Specific Behavior', () => {
    it('should apply toddler-specific restrictions', async () => {
      const toddlerAge = 3;
      
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(undefined);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, toddlerAge);

      const controls = voiceInterface.getParameterControls();
      
      // Toddler should have more restricted ranges
      expect(controls.pitch.min).toBe(-0.5);
      expect(controls.pitch.max).toBe(1.0);
      expect(controls.speed.min).toBe(0.7);
      expect(controls.speed.max).toBe(1.2);
      expect(controls.volume.max).toBe(0.8);
    });

    it('should apply teen-specific permissions', async () => {
      const teenAge = 15;
      
      (voiceCharacteristicsManager.getActiveVoiceSettings as jest.Mock)
        .mockReturnValue(undefined);
      (voiceCharacteristicsManager.getVoicePresets as jest.Mock)
        .mockResolvedValue([]);

      await voiceInterface.initialize(mockUserId, teenAge);

      const controls = voiceInterface.getParameterControls();
      
      // Teen should have broader ranges
      expect(controls.pitch.min).toBe(-1.5);
      expect(controls.pitch.max).toBe(1.5);
      expect(controls.speed.min).toBe(0.6);
      expect(controls.speed.max).toBe(1.8);
      expect(controls.volume.max).toBe(1.0);

      // Should have more accent options
      expect(controls.accent.options.length).toBeGreaterThan(2);
    });

    it('should provide age-appropriate sample texts', () => {
      const generator = voiceInterface.getSampleGenerator();
      
      const toddlerTexts = generator.getDefaultSampleTexts(3);
      const childTexts = generator.getDefaultSampleTexts(8);
      const teenTexts = generator.getDefaultSampleTexts(15);

      // Toddler texts should be simple and encouraging
      expect(toddlerTexts.some((text: string) => text.includes('fun') || text.includes('play'))).toBe(true);
      
      // Child texts should be educational
      expect(childTexts.some((text: string) => text.includes('learn') || text.includes('explore'))).toBe(true);
      
      // Teen texts should be more casual
      expect(teenTexts.some((text: string) => text.includes('Hey') || text.includes('challenges'))).toBe(true);
    });
  });
});