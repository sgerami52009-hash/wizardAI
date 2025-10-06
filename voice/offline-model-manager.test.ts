/**
 * Unit tests for Offline Model Manager
 * Tests model validation, loading, and management functionality
 */

import { OfflineModelManager, ModelInfo, ModelValidationResult } from './offline-model-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('OfflineModelManager', () => {
  let modelManager: OfflineModelManager;
  const testModelsDir = './test-models';

  beforeEach(() => {
    jest.clearAllMocks();
    
    modelManager = new OfflineModelManager({
      modelsDirectory: testModelsDir,
      enableAutoValidation: false, // Disable for testing
      maxMemoryUsage: 1024 * 1024 * 1024 // 1GB
    });

    // Setup default mock behaviors
    mockFs.access.mockResolvedValue();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
  });

  afterEach(async () => {
    if (modelManager) {
      await modelManager.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'wake-word_hey-assistant_v1.0.0.onnx', isFile: () => true } as any
      ]);

      mockFs.stat.mockResolvedValue({
        size: 1024 * 1024 // 1MB
      } as any);

      mockFs.readFile.mockResolvedValue(Buffer.from('test-model-data'));

      await modelManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(testModelsDir, { recursive: true });
      expect(mockFs.readdir).toHaveBeenCalledWith(testModelsDir, { withFileTypes: true });
    });

    it('should handle initialization failure', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory access failed'));

      await expect(modelManager.initialize()).rejects.toThrow('Directory access failed');
    });

    it('should not reinitialize if already initialized', async () => {
      mockFs.readdir.mockResolvedValue([]);
      
      await modelManager.initialize();
      await modelManager.initialize(); // Second call

      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });
  });

  describe('Model Discovery and Registration', () => {
    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();
    });

    it('should discover and register valid model files', async () => {
      const mockFiles = [
        { name: 'wake-word_hey-assistant_v1.0.0.onnx', isFile: () => true },
        { name: 'speech-recognition_whisper_v1.1.0.tflite', isFile: () => true },
        { name: 'text-to-speech_tacotron_v2.0.0.bin', isFile: () => true },
        { name: 'not-a-model.txt', isFile: () => true } // Should be ignored
      ] as any[];

      mockFs.readdir.mockResolvedValue(mockFiles);
      mockFs.stat.mockResolvedValue({ size: 1024 * 1024 } as any);
      mockFs.readFile.mockResolvedValue(Buffer.from('test-data'));

      // Reinitialize to trigger discovery
      await modelManager.shutdown();
      modelManager = new OfflineModelManager({ modelsDirectory: testModelsDir });
      await modelManager.initialize();

      const models = modelManager.getAllModels();
      expect(models).toHaveLength(3); // Should ignore non-model file
      
      const wakeWordModel = models.find(m => m.type === 'wake-word');
      expect(wakeWordModel).toBeDefined();
      expect(wakeWordModel?.name).toBe('hey-assistant');
      expect(wakeWordModel?.version).toBe('v1.0.0');
    });

    it('should handle invalid model filenames gracefully', async () => {
      const mockFiles = [
        { name: 'invalid-filename.onnx', isFile: () => true }
      ] as any[];

      mockFs.readdir.mockResolvedValue(mockFiles);

      // Should not throw, but should log error
      await modelManager.shutdown();
      modelManager = new OfflineModelManager({ modelsDirectory: testModelsDir });
      await modelManager.initialize();

      const models = modelManager.getAllModels();
      expect(models).toHaveLength(0);
    });

    it('should detect fallback models correctly', async () => {
      const mockFiles = [
        { name: 'wake-word_hey-assistant_v1.0.0.onnx', isFile: () => true },
        { name: 'wake-word_hey-assistant_v1.0.0_fallback.onnx', isFile: () => true }
      ] as any[];

      mockFs.readdir.mockResolvedValue(mockFiles);
      mockFs.stat.mockResolvedValue({ size: 1024 * 1024 } as any);
      mockFs.readFile.mockResolvedValue(Buffer.from('test-data'));

      await modelManager.shutdown();
      modelManager = new OfflineModelManager({ modelsDirectory: testModelsDir });
      await modelManager.initialize();

      const models = modelManager.getAllModels();
      const fallbackModel = models.find(m => m.id.includes('fallback'));
      
      expect(fallbackModel).toBeDefined();
      expect(fallbackModel?.fallbackFor).toBe('wake-word_hey-assistant_v1.0.0');
    });
  });

  describe('Model Validation', () => {
    let testModel: ModelInfo;

    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();

      // Add a test model manually
      testModel = {
        id: 'test-model',
        name: 'test',
        version: 'v1.0.0',
        type: 'wake-word',
        filePath: path.join(testModelsDir, 'test-model.onnx'),
        fileSize: 1024,
        checksum: 'test-checksum',
        isLoaded: false,
        isValid: false,
        lastValidated: new Date(),
        compressionLevel: 'none',
        hardwareOptimized: false
      };

      (modelManager as any).models.set(testModel.id, testModel);
    });

    it('should validate model successfully', async () => {
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.readFile.mockResolvedValue(Buffer.from('test-data'));
      mockFs.open.mockResolvedValue({
        read: jest.fn().mockResolvedValue({ buffer: Buffer.from('ONNX test data') }),
        close: jest.fn().mockResolvedValue(undefined)
      } as any);

      const result = await modelManager.validateModel(testModel.id);

      expect(result.isValid).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.checksumMatch).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect file size mismatch', async () => {
      mockFs.stat.mockResolvedValue({ size: 2048 } as any); // Different size
      mockFs.readFile.mockResolvedValue(Buffer.from('test-data'));

      const result = await modelManager.validateModel(testModel.id);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('File size mismatch: expected 1024, got 2048');
    });

    it('should detect missing file', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await modelManager.validateModel(testModel.id);

      expect(result.isValid).toBe(false);
      expect(result.fileExists).toBe(false);
      expect(result.issues).toContain('File access error: File not found');
    });

    it('should validate all models', async () => {
      // Add another test model
      const testModel2: ModelInfo = {
        ...testModel,
        id: 'test-model-2',
        filePath: path.join(testModelsDir, 'test-model-2.onnx')
      };
      (modelManager as any).models.set(testModel2.id, testModel2);

      mockFs.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.readFile.mockResolvedValue(Buffer.from('test-data'));
      mockFs.open.mockResolvedValue({
        read: jest.fn().mockResolvedValue({ buffer: Buffer.from('ONNX test data') }),
        close: jest.fn().mockResolvedValue(undefined)
      } as any);

      const results = await modelManager.validateAllModels();

      expect(results).toHaveLength(2);
      expect(results.every(r => r.isValid)).toBe(true);
    });
  });

  describe('Model Loading', () => {
    let testModel: ModelInfo;

    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();

      testModel = {
        id: 'test-model',
        name: 'test',
        version: 'v1.0.0',
        type: 'wake-word',
        filePath: path.join(testModelsDir, 'test-model.onnx'),
        fileSize: 1024 * 1024, // 1MB
        checksum: 'test-checksum',
        isLoaded: false,
        isValid: true, // Mark as valid for loading tests
        lastValidated: new Date(),
        compressionLevel: 'none',
        hardwareOptimized: false
      };

      (modelManager as any).models.set(testModel.id, testModel);
    });

    it('should load model successfully', async () => {
      const result = await modelManager.loadModel(testModel.id);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(false);
      expect(result.loadTime).toBeGreaterThan(0);
      expect(result.memoryUsage).toBeGreaterThan(0);
      expect(modelManager.isModelLoaded(testModel.id)).toBe(true);
    });

    it('should fail to load invalid model', async () => {
      testModel.isValid = false;

      const result = await modelManager.loadModel(testModel.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid');
      expect(modelManager.isModelLoaded(testModel.id)).toBe(false);
    });

    it('should load fallback model when primary fails', async () => {
      // Create fallback model
      const fallbackModel: ModelInfo = {
        ...testModel,
        id: 'test-model-fallback',
        fallbackFor: testModel.id
      };
      (modelManager as any).models.set(fallbackModel.id, fallbackModel);

      // Make primary model invalid
      testModel.isValid = false;

      const result = await modelManager.loadModel(testModel.id);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
    });

    it('should respect memory constraints', async () => {
      // Set very low memory limit
      modelManager.updateConfig({ maxMemoryUsage: 100 }); // 100 bytes

      const result = await modelManager.loadModel(testModel.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient memory');
    });

    it('should unload model successfully', async () => {
      await modelManager.loadModel(testModel.id);
      expect(modelManager.isModelLoaded(testModel.id)).toBe(true);

      await modelManager.unloadModel(testModel.id);
      expect(modelManager.isModelLoaded(testModel.id)).toBe(false);
    });

    it('should unload all models', async () => {
      // Load multiple models
      await modelManager.loadModel(testModel.id);
      
      const testModel2 = { ...testModel, id: 'test-model-2' };
      (modelManager as any).models.set(testModel2.id, testModel2);
      await modelManager.loadModel(testModel2.id);

      expect(modelManager.getLoadedModels()).toHaveLength(2);

      await modelManager.unloadAllModels();
      expect(modelManager.getLoadedModels()).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();
    });

    it('should track memory usage correctly', () => {
      const stats = modelManager.getMemoryStats();

      expect(stats.totalUsage).toBe(0);
      expect(stats.loadedModels).toBe(0);
      expect(stats.usagePercentage).toBe(0);
      expect(stats.availableMemory).toBe(modelManager.getConfig().maxMemoryUsage);
    });

    it('should optimize memory usage when threshold exceeded', async () => {
      // Create models that would exceed memory
      const largeModel1: ModelInfo = {
        id: 'large-model-1',
        name: 'large1',
        version: 'v1.0.0',
        type: 'wake-word',
        filePath: 'test1.onnx',
        fileSize: 600 * 1024 * 1024, // 600MB
        checksum: 'checksum1',
        isLoaded: true,
        isValid: true,
        lastValidated: new Date(Date.now() - 10000), // Older
        compressionLevel: 'none',
        hardwareOptimized: false
      };

      const largeModel2: ModelInfo = {
        id: 'large-model-2',
        name: 'large2',
        version: 'v1.0.0',
        type: 'speech-recognition',
        filePath: 'test2.onnx',
        fileSize: 600 * 1024 * 1024, // 600MB
        checksum: 'checksum2',
        isLoaded: true,
        isValid: true,
        lastValidated: new Date(), // Newer
        compressionLevel: 'none',
        hardwareOptimized: false
      };

      (modelManager as any).models.set(largeModel1.id, largeModel1);
      (modelManager as any).models.set(largeModel2.id, largeModel2);
      (modelManager as any).loadedModels.set(largeModel1.id, {});
      (modelManager as any).loadedModels.set(largeModel2.id, {});

      const optimizeSpy = jest.fn();
      modelManager.on('memoryOptimized', optimizeSpy);

      await modelManager.optimizeMemoryUsage();

      // Should unload the older model first
      expect(largeModel1.isLoaded).toBe(false);
      expect(optimizeSpy).toHaveBeenCalled();
    });
  });

  describe('Model Queries', () => {
    beforeEach(async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();

      // Add test models
      const models: ModelInfo[] = [
        {
          id: 'wake-word-1',
          name: 'model1',
          version: 'v1.0.0',
          type: 'wake-word',
          filePath: 'test1.onnx',
          fileSize: 1024,
          checksum: 'checksum1',
          isLoaded: false,
          isValid: true,
          lastValidated: new Date(),
          compressionLevel: 'none',
          hardwareOptimized: false
        },
        {
          id: 'speech-rec-1',
          name: 'model2',
          version: 'v1.0.0',
          type: 'speech-recognition',
          filePath: 'test2.onnx',
          fileSize: 2048,
          checksum: 'checksum2',
          isLoaded: true,
          isValid: true,
          lastValidated: new Date(),
          compressionLevel: 'low',
          hardwareOptimized: true
        }
      ];

      models.forEach(model => {
        (modelManager as any).models.set(model.id, model);
        if (model.isLoaded) {
          (modelManager as any).loadedModels.set(model.id, {});
        }
      });
    });

    it('should get model by ID', () => {
      const model = modelManager.getModelInfo('wake-word-1');
      expect(model).toBeDefined();
      expect(model?.type).toBe('wake-word');
    });

    it('should get models by type', () => {
      const wakeWordModels = modelManager.getModelsByType('wake-word');
      expect(wakeWordModels).toHaveLength(1);
      expect(wakeWordModels[0].id).toBe('wake-word-1');
    });

    it('should get loaded models', () => {
      const loadedModels = modelManager.getLoadedModels();
      expect(loadedModels).toHaveLength(1);
      expect(loadedModels[0].id).toBe('speech-rec-1');
    });

    it('should check if model is loaded', () => {
      expect(modelManager.isModelLoaded('wake-word-1')).toBe(false);
      expect(modelManager.isModelLoaded('speech-rec-1')).toBe(true);
    });

    it('should get model instance', () => {
      const instance = modelManager.getModelInstance('speech-rec-1');
      expect(instance).toBeDefined();

      const nonExistentInstance = modelManager.getModelInstance('wake-word-1');
      expect(nonExistentInstance).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableAutoValidation: true,
        maxMemoryUsage: 2 * 1024 * 1024 * 1024 // 2GB
      };

      const configSpy = jest.fn();
      modelManager.on('configUpdated', configSpy);

      modelManager.updateConfig(newConfig);

      expect(modelManager.getConfig().enableAutoValidation).toBe(true);
      expect(modelManager.getConfig().maxMemoryUsage).toBe(2 * 1024 * 1024 * 1024);
      expect(configSpy).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      mockFs.readdir.mockResolvedValue([]);
      await modelManager.initialize();

      const shutdownSpy = jest.fn();
      modelManager.on('shutdown', shutdownSpy);

      await modelManager.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      // Don't initialize
      await modelManager.shutdown();
      // Should not throw
    });
  });
});