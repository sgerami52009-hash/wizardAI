/**
 * Unit tests for Avatar Customization Interface Components
 */

import { AvatarCustomizationInterface, AppearanceCustomizationPanel, PersonalityCustomizationPanel, VoiceCustomizationPanel, CustomizationChange } from './customization-interface';
import { Avatar3DRenderer } from '../rendering/renderer';
import { EnhancedAvatarSafetyValidator } from './enhanced-safety-validator';
import { VoiceCharacteristicsManager } from './voice-characteristics-manager';
import { AvatarConfiguration } from './types';

// Mock dependencies
jest.mock('../rendering/renderer');
jest.mock('./enhanced-safety-validator');
jest.mock('./voice-characteristics-manager');

describe('AvatarCustomizationInterface', () => {
  let customizationInterface: AvatarCustomizationInterface;
  let mockRenderer: jest.Mocked<Avatar3DRenderer>;
  let mockSafetyValidator: jest.Mocked<EnhancedAvatarSafetyValidator>;
  let mockVoiceManager: jest.Mocked<VoiceCharacteristicsManager>;
  let mockConfig: any;
  let mockConfiguration: AvatarConfiguration;

  beforeEach(() => {
    mockRenderer = {
      renderAvatar: jest.fn(),
      getPerformanceMetrics: jest.fn()
    } as jest.Mocked<Avatar3DRenderer>;
    mockSafetyValidator = {
      validateCustomization: jest.fn()
    } as jest.Mocked<EnhancedAvatarSafetyValidator>;
    mockVoiceManager = {
      previewVoice: jest.fn()
    } as jest.Mocked<VoiceCharacteristicsManager>;
    
    mockConfig = {
      userAge: 10,
      userId: 'test-user',
      accessibilityMode: false,
      parentalControlsEnabled: true,
      maxComplexity: 'medium'
    };

    mockConfiguration = {
      userId: 'test-user',
      version: '1.0.0',
      appearance: {
        face: { 
          meshId: 'face1', 
          textureId: 'tex1',
          eyeColor: 'brown',
          skinTone: 'medium',
          features: { eyeSize: 1, noseSize: 1, mouthSize: 1, cheekbones: 1 },
          detailLevel: 'medium' as any,
          textureQuality: 1024
        },
        hair: { 
          styleId: 'hair1', 
          color: 'brown',
          length: 10,
          texture: 'wavy' as any,
          physicsEnabled: true,
          strandCount: 1000,
          detailLevel: 'medium' as any
        },
        clothing: { 
          topId: 'shirt1', 
          bottomId: 'pants1',
          shoesId: 'shoes1',
          colors: { primary: 'blue', secondary: 'white', accent: 'black' },
          wrinkleSimulation: false,
          detailLevel: 'medium' as any,
          textureQuality: 512,
          revealingLevel: 1
        },
        accessories: [],
        animations: {
          idle: 'idle_anim',
          talking: 'talk_anim',
          listening: 'listen_anim',
          thinking: 'think_anim',
          expressions: {
            happy: 'happy_anim',
            sad: 'sad_anim',
            surprised: 'surprised_anim',
            confused: 'confused_anim',
            excited: 'excited_anim'
          },
          frameRate: 60,
          blendingEnabled: true
        }
      },
      personality: {
        friendliness: 7,
        formality: 4,
        humor: 6,
        enthusiasm: 8,
        patience: 5,
        supportiveness: 9
      },
      voice: {
        pitch: 0.0,
        speed: 1.0,
        accent: 'neutral' as any,
        emotionalTone: 'cheerful' as any,
        volume: 0.8
      },
      emotions: {
        defaultEmotion: 'neutral' as any,
        expressionIntensity: 0.5,
        transitionSpeed: 1.0,
        emotionMappings: []
      },
      createdAt: new Date(),
      lastModified: new Date(),
      parentallyApproved: true
    } as AvatarConfiguration;

    customizationInterface = new AvatarCustomizationInterface(
      mockRenderer,
      mockSafetyValidator,
      mockVoiceManager,
      mockConfig
    );
  });

  describe('initialization', () => {
    it('should initialize with valid configuration', async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low',
        parentalMessage: undefined
      });

      mockRenderer.renderAvatar.mockResolvedValue({} as any);

      const initPromise = customizationInterface.initialize(mockConfiguration);
      
      await expect(initPromise).resolves.toBeUndefined();
      expect(mockSafetyValidator.validateCustomization).toHaveBeenCalledWith(
        mockConfiguration,
        mockConfig.userAge
      );
      expect(mockRenderer.renderAvatar).toHaveBeenCalledWith(mockConfiguration);
    });

    it('should reject initialization with inappropriate configuration', async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: false,
        requiresApproval: false,
        blockedElements: ['inappropriate-content'],
        riskAssessment: 'high',
        parentalMessage: 'Content not suitable for age'
      });

      const initPromise = customizationInterface.initialize(mockConfiguration);
      
      await expect(initPromise).rejects.toThrow('Current configuration not appropriate for user age');
    });

    it('should emit initialized event on successful initialization', async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low'
      });

      mockRenderer.renderAvatar.mockResolvedValue({} as any);

      const eventSpy = jest.fn();
      customizationInterface.on('initialized', eventSpy);

      await customizationInterface.initialize(mockConfiguration);

      expect(eventSpy).toHaveBeenCalledWith({
        configuration: mockConfiguration,
        validationResult: expect.any(Object)
      });
    });
  });

  describe('preview functionality', () => {
    beforeEach(async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low'
      });
      mockRenderer.renderAvatar.mockResolvedValue({} as any);
      await customizationInterface.initialize(mockConfiguration);
    });

    it('should start preview for appearance changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-1',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      mockRenderer.getPerformanceMetrics.mockReturnValue({
        currentFPS: 60,
        gpuMemoryUsage: 1024,
        cpuUsage: 30,
        renderTime: 16,
        triangleCount: 5000,
        textureMemory: 512,
        shaderCompileTime: 100,
        drawCalls: 50
      });

      const eventSpy = jest.fn();
      customizationInterface.on('previewStarted', eventSpy);

      await customizationInterface.startPreview(change);

      expect(mockRenderer.renderAvatar).toHaveBeenCalledTimes(2); // Initial + preview
      expect(eventSpy).toHaveBeenCalledWith({
        change,
        metrics: expect.any(Object)
      });
    });

    it('should block inappropriate preview content', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-2',
        type: 'appearance',
        category: 'clothing',
        oldValue: 'shirt1',
        newValue: 'inappropriate-outfit',
        timestamp: new Date(),
        requiresApproval: false
      };

      // Mock validation to block the change
      mockSafetyValidator.validateCustomization
        .mockResolvedValueOnce({ // Initial config (allowed)
          isAllowed: true,
          requiresApproval: false,
          blockedElements: [],
          riskAssessment: 'low'
        })
        .mockResolvedValueOnce({ // Preview config (blocked)
          isAllowed: false,
          requiresApproval: false,
          blockedElements: ['inappropriate-clothing'],
          riskAssessment: 'high',
          parentalMessage: 'This outfit is not appropriate for your age'
        });

      const eventSpy = jest.fn();
      customizationInterface.on('previewBlocked', eventSpy);

      await customizationInterface.startPreview(change);

      expect(eventSpy).toHaveBeenCalledWith({
        change,
        reason: 'inappropriate-clothing',
        parentalMessage: 'This outfit is not appropriate for your age'
      });
    });

    it('should preview voice changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-3',
        type: 'voice',
        category: 'pitch',
        oldValue: 0.0,
        newValue: 0.5,
        timestamp: new Date(),
        requiresApproval: false
      };

      mockVoiceManager.previewVoice.mockResolvedValue({} as any);

      await customizationInterface.startPreview(change);

      expect(mockVoiceManager.previewVoice).toHaveBeenCalledWith(
        expect.objectContaining({ pitch: 0.5 }),
        expect.stringContaining('friendly helper')
      );
    });

    it('should stop preview and revert to original configuration', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-4',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      await customizationInterface.startPreview(change);
      
      const eventSpy = jest.fn();
      customizationInterface.on('previewStopped', eventSpy);

      await customizationInterface.stopPreview();

      expect(mockRenderer.renderAvatar).toHaveBeenLastCalledWith(mockConfiguration);
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('applying changes', () => {
    beforeEach(async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low'
      });
      mockRenderer.renderAvatar.mockResolvedValue({} as any);
      await customizationInterface.initialize(mockConfiguration);
    });

    it('should apply allowed changes immediately', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-5',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const eventSpy = jest.fn();
      customizationInterface.on('changeApplied', eventSpy);

      await customizationInterface.applyChange(change);

      expect(eventSpy).toHaveBeenCalledWith({
        change,
        configuration: expect.objectContaining({
          appearance: expect.objectContaining({
            hair: 'hair2'
          })
        })
      });
    });

    it('should require approval for restricted changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-6',
        type: 'personality',
        category: 'humor',
        oldValue: 6,
        newValue: 10,
        timestamp: new Date(),
        requiresApproval: true
      };

      mockSafetyValidator.validateCustomization
        .mockResolvedValueOnce({ // Initial validation
          isAllowed: true,
          requiresApproval: false,
          blockedElements: [],
          riskAssessment: 'low'
        })
        .mockResolvedValueOnce({ // Change validation
          isAllowed: true,
          requiresApproval: true,
          blockedElements: [],
          riskAssessment: 'medium'
        });

      const eventSpy = jest.fn();
      customizationInterface.on('approvalRequired', eventSpy);

      await customizationInterface.applyChange(change);

      expect(eventSpy).toHaveBeenCalledWith({
        change,
        validationResult: expect.objectContaining({
          requiresApproval: true
        })
      });
    });

    it('should block disallowed changes', async () => {
      const change: CustomizationChange = {
        changeId: 'test-change-7',
        type: 'appearance',
        category: 'accessories',
        oldValue: [],
        newValue: ['inappropriate-item'],
        timestamp: new Date(),
        requiresApproval: false
      };

      mockSafetyValidator.validateCustomization
        .mockResolvedValueOnce({ // Initial validation
          isAllowed: true,
          requiresApproval: false,
          blockedElements: [],
          riskAssessment: 'low'
        })
        .mockResolvedValueOnce({ // Change validation
          isAllowed: false,
          requiresApproval: false,
          blockedElements: ['inappropriate-accessory'],
          riskAssessment: 'high'
        });

      const applyPromise = customizationInterface.applyChange(change);

      await expect(applyPromise).rejects.toThrow('Change blocked: inappropriate-accessory');
    });
  });

  describe('age-appropriate options', () => {
    it('should filter options by user age', async () => {
      const mockOptions = [
        { id: 'option1', minAge: 5, maxAge: 12, safetyLevel: 1 },
        { id: 'option2', minAge: 13, maxAge: 17, safetyLevel: 2 },
        { id: 'option3', minAge: 5, maxAge: 17, safetyLevel: 1 }
      ];

      // Mock the private method by overriding it
      (customizationInterface as any).getBaseOptionsForCategory = jest.fn().mockResolvedValue(mockOptions);

      const options = await customizationInterface.getAvailableOptions('hair');

      // Should only include options appropriate for age 10
      expect(options).toHaveLength(2);
      expect(options.map(o => o.id)).toEqual(['option1', 'option3']);
    });
  });

  describe('real-time responsiveness', () => {
    beforeEach(async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low'
      });
      mockRenderer.renderAvatar.mockResolvedValue({} as any);
      await customizationInterface.initialize(mockConfiguration);
    });

    it('should maintain 60fps during real-time preview', async () => {
      const change: CustomizationChange = {
        changeId: 'fps-test-1',
        type: 'appearance',
        category: 'hair',
        oldValue: 'hair1',
        newValue: 'hair2',
        timestamp: new Date(),
        requiresApproval: false
      };

      mockRenderer.getPerformanceMetrics.mockReturnValue({
        currentFPS: 60,
        gpuMemoryUsage: 1024,
        cpuUsage: 30,
        renderTime: 16.67,
        triangleCount: 5000,
        textureMemory: 512,
        shaderCompileTime: 100,
        drawCalls: 50
      });

      await customizationInterface.startPreview(change);

      expect(mockRenderer.getPerformanceMetrics).toHaveBeenCalled();
      const previewState = (customizationInterface as any).previewState;
      expect(previewState.renderingFPS).toBe(60);
    });

    it('should handle performance degradation gracefully', async () => {
      const change: CustomizationChange = {
        changeId: 'fps-test-2',
        type: 'appearance',
        category: 'clothing',
        oldValue: 'shirt1',
        newValue: 'complex-outfit',
        timestamp: new Date(),
        requiresApproval: false
      };

      // Simulate performance drop
      mockRenderer.getPerformanceMetrics.mockReturnValue({
        currentFPS: 40, // Below 45fps threshold
        gpuMemoryUsage: 1800,
        cpuUsage: 60,
        renderTime: 25,
        triangleCount: 15000,
        textureMemory: 1024,
        shaderCompileTime: 200,
        drawCalls: 100
      });

      const eventSpy = jest.fn();
      customizationInterface.on('performanceWarning', eventSpy);

      await customizationInterface.startPreview(change);

      // Should detect performance issue
      const previewState = (customizationInterface as any).previewState;
      expect(previewState.renderingFPS).toBe(40);
    });

    it('should update preview within 100ms for responsiveness', async () => {
      const change: CustomizationChange = {
        changeId: 'responsiveness-test',
        type: 'appearance',
        category: 'face',
        oldValue: 'face1',
        newValue: 'face2',
        timestamp: new Date(),
        requiresApproval: false
      };

      const startTime = Date.now();
      await customizationInterface.startPreview(change);
      const endTime = Date.now();

      // Preview should start within 100ms for good responsiveness
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle rapid successive preview changes', async () => {
      const changes = [
        {
          changeId: 'rapid-1',
          type: 'appearance' as const,
          category: 'hair',
          oldValue: 'hair1',
          newValue: 'hair2',
          timestamp: new Date(),
          requiresApproval: false
        },
        {
          changeId: 'rapid-2',
          type: 'appearance' as const,
          category: 'hair',
          oldValue: 'hair2',
          newValue: 'hair3',
          timestamp: new Date(),
          requiresApproval: false
        }
      ];

      // Start multiple previews rapidly
      const promises = changes.map(change => customizationInterface.startPreview(change));
      await Promise.all(promises);

      // Should handle all changes without errors
      expect(mockRenderer.renderAvatar).toHaveBeenCalledTimes(3); // Initial + 2 previews
    });
  });

  describe('interface accessibility', () => {
    beforeEach(async () => {
      mockSafetyValidator.validateCustomization.mockResolvedValue({
        isAllowed: true,
        requiresApproval: false,
        blockedElements: [],
        riskAssessment: 'low'
      });
      mockRenderer.renderAvatar.mockResolvedValue({} as any);
    });

    it('should support accessibility mode configuration', async () => {
      const accessibleConfig = {
        ...mockConfig,
        accessibilityMode: true
      };

      const accessibleInterface = new AvatarCustomizationInterface(
        mockRenderer,
        mockSafetyValidator,
        mockVoiceManager,
        accessibleConfig
      );

      await accessibleInterface.initialize(mockConfiguration);

      // Should initialize successfully with accessibility mode
      expect(mockRenderer.renderAvatar).toHaveBeenCalled();
    });

    it('should provide age-appropriate preview text', async () => {
      const youngChildConfig = { ...mockConfig, userAge: 6 };
      const youngChildInterface = new AvatarCustomizationInterface(
        mockRenderer,
        mockSafetyValidator,
        mockVoiceManager,
        youngChildConfig
      );

      await youngChildInterface.initialize(mockConfiguration);

      const change: CustomizationChange = {
        changeId: 'voice-preview-test',
        type: 'voice',
        category: 'pitch',
        oldValue: 0.0,
        newValue: 0.2,
        timestamp: new Date(),
        requiresApproval: false
      };

      await youngChildInterface.startPreview(change);

      expect(mockVoiceManager.previewVoice).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('friendly helper')
      );
    });
  });
});

describe('AppearanceCustomizationPanel', () => {
  let panel: AppearanceCustomizationPanel;
  let mockInterface: jest.Mocked<AvatarCustomizationInterface>;

  beforeEach(() => {
    mockInterface = {
      getAvailableOptions: jest.fn(),
      startPreview: jest.fn()
    } as any;

    panel = new AppearanceCustomizationPanel(mockInterface);
  });

  it('should select category and emit available options', async () => {
    const mockOptions = [
      { id: 'face1', name: 'Friendly Face' },
      { id: 'face2', name: 'Happy Face' }
    ];

    mockInterface.getAvailableOptions.mockResolvedValue(mockOptions);

    const eventSpy = jest.fn();
    panel.on('categorySelected', eventSpy);

    await panel.selectCategory('face');

    expect(mockInterface.getAvailableOptions).toHaveBeenCalledWith('face');
    expect(eventSpy).toHaveBeenCalledWith({
      category: 'face',
      options: mockOptions
    });
  });

  it('should reject invalid categories', async () => {
    const selectPromise = panel.selectCategory('invalid-category');
    
    await expect(selectPromise).rejects.toThrow('Invalid category: invalid-category');
  });

  it('should select option and start preview', async () => {
    await panel.selectCategory('hair');

    const eventSpy = jest.fn();
    panel.on('optionSelected', eventSpy);

    await panel.selectOption('hair2');

    expect(mockInterface.startPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'appearance',
        category: 'hair',
        newValue: 'hair2'
      })
    );
    expect(eventSpy).toHaveBeenCalled();
  });
});

describe('PersonalityCustomizationPanel', () => {
  let panel: PersonalityCustomizationPanel;
  let mockInterface: jest.Mocked<AvatarCustomizationInterface>;

  beforeEach(() => {
    mockInterface = {
      startPreview: jest.fn()
    } as any;

    panel = new PersonalityCustomizationPanel(mockInterface);
  });

  it('should update personality trait within valid range', async () => {
    const eventSpy = jest.fn();
    panel.on('traitUpdated', eventSpy);

    await panel.updateTrait('friendliness', 8);

    expect(mockInterface.startPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'personality',
        category: 'friendliness',
        newValue: 8
      })
    );
    expect(eventSpy).toHaveBeenCalledWith({
      trait: 'friendliness',
      value: 8,
      change: expect.any(Object)
    });
  });

  it('should reject trait values outside valid range', async () => {
    const updatePromise = panel.updateTrait('humor', 15);
    
    await expect(updatePromise).rejects.toThrow('Trait value must be between 1 and 10');
  });

  it('should provide trait descriptions', () => {
    const description = panel.getTraitDescription('friendliness');
    
    expect(description).toBe('How warm and welcoming your assistant is');
  });
});

describe('VoiceCustomizationPanel', () => {
  let panel: VoiceCustomizationPanel;
  let mockInterface: jest.Mocked<AvatarCustomizationInterface>;
  let mockVoiceManager: jest.Mocked<VoiceCharacteristicsManager>;

  beforeEach(() => {
    mockInterface = {
      startPreview: jest.fn()
    } as any;

    mockVoiceManager = {} as any;

    panel = new VoiceCustomizationPanel(mockInterface, mockVoiceManager);
  });

  it('should update voice parameter within valid range', async () => {
    const eventSpy = jest.fn();
    panel.on('voiceParameterUpdated', eventSpy);

    await panel.updateVoiceParameter('pitch', 0.5);

    expect(mockInterface.startPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voice',
        category: 'pitch',
        newValue: 0.5
      })
    );
    expect(eventSpy).toHaveBeenCalledWith({
      parameter: 'pitch',
      value: 0.5,
      change: expect.any(Object)
    });
  });

  it('should reject parameter values outside valid range', async () => {
    const updatePromise = panel.updateVoiceParameter('pitch', 5.0);
    
    await expect(updatePromise).rejects.toThrow('pitch must be between -2 and 2');
  });

  it('should play voice preview', async () => {
    const eventSpy = jest.fn();
    panel.on('voicePreviewPlayed', eventSpy);

    await panel.playVoicePreview();

    expect(eventSpy).toHaveBeenCalled();
  });
});