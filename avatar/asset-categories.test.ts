import {
  FaceCustomizationSystem,
  HairStyleSystem,
  ClothingAccessorySystem,
  type FaceCustomizations,
  type HairCustomizations,
  type ClothingSelections,
  type AccessorySelection
} from './asset-categories';
import {
  PerformanceLevel,
  SafetyRating,
  HairTexture,
  AccessoryType
} from './types';

describe('FaceCustomizationSystem', () => {
  let faceSystem: FaceCustomizationSystem;

  beforeEach(() => {
    faceSystem = new FaceCustomizationSystem();
  });

  describe('getAvailableFaceVariants', () => {
    it('should return age-appropriate face variants for children', () => {
      const variants = faceSystem.getAvailableFaceVariants(8, SafetyRating.SAFE);
      
      expect(variants.length).toBeGreaterThan(0);
      variants.forEach(variant => {
        expect(variant.minAge).toBeLessThanOrEqual(8);
        expect(variant.maxAge).toBeGreaterThanOrEqual(8);
        expect(variant.safetyRating).toBe(SafetyRating.SAFE);
      });
    });

    it('should return age-appropriate face variants for teens', () => {
      const variants = faceSystem.getAvailableFaceVariants(15, SafetyRating.SAFE);
      
      expect(variants.length).toBeGreaterThan(0);
      variants.forEach(variant => {
        expect(variant.minAge).toBeLessThanOrEqual(15);
        expect(variant.maxAge).toBeGreaterThanOrEqual(15);
      });
    });

    it('should filter by safety rating', () => {
      const safeVariants = faceSystem.getAvailableFaceVariants(10, SafetyRating.SAFE);
      const allVariants = faceSystem.getAvailableFaceVariants(10, SafetyRating.BLOCKED);
      
      expect(safeVariants.length).toBeLessThanOrEqual(allVariants.length);
    });
  });

  describe('createFaceConfiguration', () => {
    it('should create valid face configuration with default values', () => {
      const customizations: FaceCustomizations = {
        eyeColor: 'blue',
        skinTone: 'light'
      };

      const config = faceSystem.createFaceConfiguration('child_face_01', customizations);

      expect(config.eyeColor).toBe('blue');
      expect(config.skinTone).toBe('light');
      expect(config.features.eyeSize).toBe(1.0);
      expect(config.detailLevel).toBe(PerformanceLevel.MEDIUM);
      expect(config.matureFeatures).toBe(false);
    });

    it('should clamp feature values to valid ranges', () => {
      const customizations: FaceCustomizations = {
        eyeSize: 5.0, // Too large
        noseSize: 0.1, // Too small
        mouthSize: 1.5 // Valid
      };

      const config = faceSystem.createFaceConfiguration('child_face_01', customizations);

      expect(config.features.eyeSize).toBe(2.0); // Clamped to max
      expect(config.features.noseSize).toBe(0.5); // Clamped to min
      expect(config.features.mouthSize).toBe(1.5); // Unchanged
    });

    it('should throw error for invalid variant ID', () => {
      const customizations: FaceCustomizations = {};

      expect(() => {
        faceSystem.createFaceConfiguration('invalid_variant', customizations);
      }).toThrow('Face variant not found: invalid_variant');
    });

    it('should emit faceConfigurationCreated event', () => {
      const eventSpy = jest.fn();
      faceSystem.on('faceConfigurationCreated', eventSpy);

      const customizations: FaceCustomizations = { eyeColor: 'green' };
      faceSystem.createFaceConfiguration('child_face_01', customizations);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        variantId: 'child_face_01',
        config: expect.any(Object)
      }));
    });
  });

  describe('validateFaceCustomization', () => {
    it('should reject mature features for young users', () => {
      const config = faceSystem.createFaceConfiguration('child_face_01', { matureFeatures: true });
      const result = faceSystem.validateFaceCustomization(config, 10);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Mature facial features not appropriate for age');
    });

    it('should accept appropriate customizations', () => {
      const config = faceSystem.createFaceConfiguration('child_face_01', { eyeColor: 'brown' });
      const result = faceSystem.validateFaceCustomization(config, 10);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});

describe('HairStyleSystem', () => {
  let hairSystem: HairStyleSystem;

  beforeEach(() => {
    hairSystem = new HairStyleSystem();
  });

  describe('getAvailableHairStyles', () => {
    it('should return age-appropriate hair styles', () => {
      const styles = hairSystem.getAvailableHairStyles(8, PerformanceLevel.HIGH);
      
      expect(styles.length).toBeGreaterThan(0);
      styles.forEach(style => {
        expect(style.minAge).toBeLessThanOrEqual(8);
        expect(style.maxAge).toBeGreaterThanOrEqual(8);
      });
    });

    it('should filter by performance requirements', () => {
      const lowPerfStyles = hairSystem.getAvailableHairStyles(15, PerformanceLevel.LOW);
      const highPerfStyles = hairSystem.getAvailableHairStyles(15, PerformanceLevel.HIGH);
      
      expect(lowPerfStyles.length).toBeLessThanOrEqual(highPerfStyles.length);
      lowPerfStyles.forEach(style => {
        expect(style.performanceImpact).toBe(PerformanceLevel.LOW);
      });
    });
  });

  describe('createHairConfiguration', () => {
    it('should create valid hair configuration', () => {
      const customizations: HairCustomizations = {
        color: 'red',
        length: 0.7,
        texture: HairTexture.CURLY,
        quality: PerformanceLevel.HIGH
      };

      const config = hairSystem.createHairConfiguration('short_straight', customizations);

      expect(config.color).toBe('red');
      expect(config.length).toBe(0.7);
      expect(config.texture).toBe(HairTexture.CURLY);
      expect(config.physicsEnabled).toBe(true);
      expect(config.strandCount).toBeGreaterThan(0);
    });

    it('should clamp length values', () => {
      const customizations: HairCustomizations = {
        length: 5.0 // Too long
      };

      const config = hairSystem.createHairConfiguration('short_straight', customizations);

      expect(config.length).toBe(2.0); // Clamped to max
    });

    it('should disable physics for high strand counts', () => {
      const eventSpy = jest.fn();
      hairSystem.on('physicsDisabled', eventSpy);

      const customizations: HairCustomizations = {
        quality: PerformanceLevel.ULTRA // Will create high strand count
      };

      const config = hairSystem.createHairConfiguration('long_wavy', customizations);

      if (config.strandCount > 1500) {
        expect(config.physicsEnabled).toBe(false);
        expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
          reason: 'performance',
          strandCount: config.strandCount
        }));
      }
    });

    it('should throw error for invalid style ID', () => {
      expect(() => {
        hairSystem.createHairConfiguration('invalid_style', {});
      }).toThrow('Hair style not found: invalid_style');
    });
  });

  describe('setPhysicsEnabled', () => {
    it('should update physics setting and emit event', () => {
      const eventSpy = jest.fn();
      hairSystem.on('physicsSettingChanged', eventSpy);

      hairSystem.setPhysicsEnabled(false);

      expect(eventSpy).toHaveBeenCalledWith({ enabled: false });
    });
  });

  describe('optimizeHairForPerformance', () => {
    it('should optimize hair configuration for performance', () => {
      const originalConfig = hairSystem.createHairConfiguration('long_wavy', {
        physicsEnabled: true,
        quality: PerformanceLevel.HIGH
      });

      const optimized = hairSystem.optimizeHairForPerformance(originalConfig);

      expect(optimized.physicsEnabled).toBe(false);
      expect(optimized.strandCount).toBeLessThanOrEqual(800);
      expect(optimized.detailLevel).toBe(PerformanceLevel.LOW);
    });
  });
});

describe('ClothingAccessorySystem', () => {
  let clothingSystem: ClothingAccessorySystem;

  beforeEach(() => {
    clothingSystem = new ClothingAccessorySystem();
  });

  describe('createClothingConfiguration', () => {
    it('should create valid clothing configuration', () => {
      const selections: ClothingSelections = {
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers',
        colors: {
          primary: 'red',
          secondary: 'blue',
          accent: 'white'
        }
      };

      const config = clothingSystem.createClothingConfiguration(selections);

      expect(config.topId).toBe('casual_tshirt');
      expect(config.bottomId).toBe('jeans');
      expect(config.shoesId).toBe('sneakers');
      expect(config.colors.primary).toBe('red');
      expect(config.wrinkleSimulation).toBe(true);
      expect(config.revealingLevel).toBe(1);
    });

    it('should use default colors when not specified', () => {
      const selections: ClothingSelections = {
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      };

      const config = clothingSystem.createClothingConfiguration(selections);

      expect(config.colors.primary).toBeDefined();
      expect(config.colors.secondary).toBeDefined();
      expect(config.colors.accent).toBeDefined();
    });

    it('should throw error for invalid clothing items', () => {
      const selections: ClothingSelections = {
        topId: 'invalid_top',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      };

      expect(() => {
        clothingSystem.createClothingConfiguration(selections);
      }).toThrow('Invalid clothing item selection');
    });

    it('should emit clothingConfigurationCreated event', () => {
      const eventSpy = jest.fn();
      clothingSystem.on('clothingConfigurationCreated', eventSpy);

      const selections: ClothingSelections = {
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      };

      clothingSystem.createClothingConfiguration(selections);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        selections,
        config: expect.any(Object)
      }));
    });
  });

  describe('createAccessoryConfiguration', () => {
    it('should create valid accessory configurations', () => {
      const selections: AccessorySelection[] = [
        {
          accessoryId: 'baseball_cap',
          position: { x: 0, y: 1.3, z: 0 },
          scale: 1.1
        },
        {
          accessoryId: 'glasses'
        }
      ];

      const configs = clothingSystem.createAccessoryConfiguration(selections);

      expect(configs).toHaveLength(2);
      expect(configs[0].id).toBe('baseball_cap');
      expect(configs[0].type).toBe(AccessoryType.HAT);
      expect(configs[0].position.y).toBe(1.3);
      expect(configs[0].scale).toBe(1.1);
      
      expect(configs[1].id).toBe('glasses');
      expect(configs[1].type).toBe(AccessoryType.GLASSES);
    });

    it('should use default positions when not specified', () => {
      const selections: AccessorySelection[] = [
        { accessoryId: 'baseball_cap' }
      ];

      const configs = clothingSystem.createAccessoryConfiguration(selections);

      expect(configs[0].position).toEqual({ x: 0, y: 1.2, z: 0 });
    });

    it('should throw error for invalid accessory ID', () => {
      const selections: AccessorySelection[] = [
        { accessoryId: 'invalid_accessory' }
      ];

      expect(() => {
        clothingSystem.createAccessoryConfiguration(selections);
      }).toThrow('Accessory not found: invalid_accessory');
    });

    it('should throw error for too many accessories', () => {
      const selections: AccessorySelection[] = Array(6).fill(0).map((_, i) => ({
        accessoryId: 'baseball_cap',
        position: { x: i, y: 0, z: 0 } // Different positions to avoid position conflicts
      }));

      expect(() => {
        clothingSystem.createAccessoryConfiguration(selections);
      }).toThrow('Too many accessories selected (maximum 5)');
    });

    it('should emit accessoryConfigurationCreated event', () => {
      const eventSpy = jest.fn();
      clothingSystem.on('accessoryConfigurationCreated', eventSpy);

      const selections: AccessorySelection[] = [
        { accessoryId: 'baseball_cap' }
      ];

      clothingSystem.createAccessoryConfiguration(selections);

      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        configurations: expect.any(Array)
      }));
    });
  });

  describe('getAvailableClothing', () => {
    it('should return age-appropriate clothing items', () => {
      const topItems = clothingSystem.getAvailableClothing('top', 10);
      
      expect(topItems.length).toBeGreaterThan(0);
      topItems.forEach(item => {
        expect(item.category).toBe('top');
        expect(item.minAge).toBeLessThanOrEqual(10);
        expect(item.maxAge).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('getAvailableAccessories', () => {
    it('should return age-appropriate accessories by type', () => {
      const hats = clothingSystem.getAvailableAccessories(AccessoryType.HAT, 8);
      
      expect(hats.length).toBeGreaterThan(0);
      hats.forEach(accessory => {
        expect(accessory.type).toBe(AccessoryType.HAT);
        expect(accessory.minAge).toBeLessThanOrEqual(8);
        expect(accessory.maxAge).toBeGreaterThanOrEqual(8);
      });
    });
  });

  describe('applyColorCustomization', () => {
    it('should apply color customizations to clothing configuration', () => {
      const baseConfig = clothingSystem.createClothingConfiguration({
        topId: 'casual_tshirt',
        bottomId: 'jeans',
        shoesId: 'sneakers'
      });

      const colorCustomizations = {
        primary: 'purple',
        secondary: 'yellow'
      };

      const customizedConfig = clothingSystem.applyColorCustomization(baseConfig, colorCustomizations);

      expect(customizedConfig.colors.primary).toBe('purple');
      expect(customizedConfig.colors.secondary).toBe('yellow');
      expect(customizedConfig.colors.accent).toBe(baseConfig.colors.accent); // Unchanged
    });
  });
});