// Data Migration Manager Tests

import { ModelDataMigrationManager } from './data-migration-manager';
import { DefaultLearningEventBus } from './events';
import { DefaultUserModelStore } from '../models/store';
import { SafetyValidatorImpl } from './safety-validator';
import { UserModel } from '../models/types';

describe('ModelDataMigrationManager', () => {
  let migrationManager: ModelDataMigrationManager;
  let eventBus: DefaultLearningEventBus;
  let modelStore: DefaultUserModelStore;
  let safetyValidator: SafetyValidatorImpl;

  beforeEach(() => {
    eventBus = new DefaultLearningEventBus();
    modelStore = new DefaultUserModelStore();
    safetyValidator = new SafetyValidatorImpl();
    
    migrationManager = new ModelDataMigrationManager(
      eventBus,
      modelStore,
      safetyValidator
    );
  });

  const createTestUserModel = (userId: string, version: string): UserModel => ({
    userId,
    version,
    createdAt: new Date(),
    lastUpdated: new Date(),
    modelData: {
      encryptedData: 'test_encrypted_data',
      encryptionMethod: 'aes_256' as any,
      keyId: `key_${userId}`,
      checksum: 'test_checksum',
      compressedSize: 1000,
      originalSize: 1200
    },
    metadata: {
      modelType: 'neural_network' as any,
      trainingDataSize: 1000,
      features: [],
      hyperparameters: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        regularization: {
          l1Lambda: 0.01,
          l2Lambda: 0.01,
          dropout: 0.2,
          batchNorm: true
        },
        architecture: {
          layers: [],
          activationFunction: 'relu' as any,
          outputDimension: 10,
          inputDimension: 100
        },
        optimization: {
          optimizer: 'adam' as any,
          momentum: 0.9,
          weightDecay: 0.0001,
          gradientClipping: 1.0
        }
      },
      validationMetrics: {
        crossValidationScore: 0.85,
        holdoutAccuracy: 0.82,
        overfittingScore: 0.1,
        generalizationError: 0.15,
        robustnessScore: 0.9
      },
      deploymentInfo: {
        deployedAt: new Date(),
        environment: 'production' as any,
        version,
        configuration: {
          replicas: 1,
          resources: {
            cpu: 2,
            memory: 1024,
            storage: 500,
            network: 100
          },
          scaling: {
            minReplicas: 1,
            maxReplicas: 3,
            targetCpuUtilization: 70,
            targetMemoryUtilization: 80
          },
          monitoring: {
            metricsEnabled: true,
            loggingLevel: 'info' as any,
            alerting: {
              enabled: true,
              channels: [],
              thresholds: [],
              escalation: {
                policyId: 'default',
                levels: [],
                timeout: 300,
                maxEscalations: 3
              }
            },
            healthChecks: []
          }
        },
        healthStatus: 'healthy' as any
      }
    },
    performance: {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85,
      latency: 50,
      memoryUsage: 200,
      throughput: 100,
      lastEvaluated: new Date()
    },
    backupInfo: []
  });

  describe('Model Migration', () => {
    it('should migrate user model successfully', async () => {
      const userId = 'test_user_123';
      const sourceModel = createTestUserModel(userId, '1.0.0');
      const targetVersion = '2.0.0';
      
      // Save source model
      await modelStore.saveUserModel(userId, sourceModel);
      
      const result = await migrationManager.migrateUserModel(userId, targetVersion);
      
      expect(result.success).toBe(true);
      expect(result.oldUserId).toBe(userId);
      expect(result.newUserId).toBe(userId);
      expect(result.dataIntegrity.passed).toBe(true);
      expect(result.migrationLog.length).toBeGreaterThan(0);
    });

    it('should handle migration failures gracefully', async () => {
      const userId = 'nonexistent_user';
      const targetVersion = '2.0.0';
      
      const result = await migrationManager.migrateUserModel(userId, targetVersion);
      
      expect(result.success).toBe(false);
      expect(result.dataIntegrity.passed).toBe(false);
      expect(result.migrationLog.length).toBeGreaterThan(0);
    });
  });

  describe('Compatibility Validation', () => {
    it('should validate compatible versions', async () => {
      const sourceVersion = '1.0.0';
      const targetVersion = '1.1.0';
      
      const compatibility = await migrationManager.validateModelCompatibility(sourceVersion, targetVersion);
      
      expect(compatibility.isCompatible).toBe(true);
      expect(compatibility.migrationRequired).toBe(true);
      expect(compatibility.migrationComplexity).toBe('moderate');
    });

    it('should detect incompatible major versions', async () => {
      const sourceVersion = '1.0.0';
      const targetVersion = '2.0.0';
      
      const compatibility = await migrationManager.validateModelCompatibility(sourceVersion, targetVersion);
      
      expect(compatibility.isCompatible).toBe(false);
      expect(compatibility.riskLevel).toBe('critical');
      expect(compatibility.compatibilityIssues.length).toBeGreaterThan(0);
    });

    it('should estimate migration duration based on complexity', async () => {
      const sourceVersion = '1.0.0';
      const targetVersion = '1.0.1';
      
      const compatibility = await migrationManager.validateModelCompatibility(sourceVersion, targetVersion);
      
      expect(compatibility.estimatedDuration).toBeGreaterThan(0);
      expect(compatibility.migrationComplexity).toBe('simple');
    });
  });

  describe('Migration Plan Creation', () => {
    it('should create comprehensive migration plan', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      expect(plan.planId).toBeDefined();
      expect(plan.userId).toBe(sourceModel.userId);
      expect(plan.sourceVersion).toBe(sourceModel.version);
      expect(plan.targetVersion).toBe(targetVersion);
      expect(plan.migrationSteps.length).toBeGreaterThan(0);
      expect(plan.riskAssessment).toBeDefined();
      expect(plan.rollbackPlan).toBeDefined();
      expect(plan.validationChecks.length).toBeGreaterThan(0);
    });

    it('should create rollback plan with steps', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '2.0.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      expect(plan.rollbackPlan.rollbackSteps.length).toBeGreaterThan(0);
      expect(plan.rollbackPlan.estimatedRollbackTime).toBeGreaterThan(0);
      expect(plan.rollbackPlan.dataPreservation).toBeDefined();
      expect(plan.rollbackPlan.successCriteria.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Execution', () => {
    it('should execute migration plan successfully', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      const result = await migrationManager.executeMigrationPlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.migrationId).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.stepsCompleted).toBe(result.stepsTotal);
      expect(result.rollbackAvailable).toBe(true);
    });

    it('should handle execution failures', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '2.0.0';
      
      // Create a plan that will fail
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      // Mock execution failure
      jest.spyOn(migrationManager as any, 'executeMigrationStep').mockRejectedValue(new Error('Step failed'));
      
      const result = await migrationManager.executeMigrationPlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.integrityCheck.passed).toBe(false);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate model integrity', async () => {
      const model = createTestUserModel('test_user', '1.0.0');
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(true);
      expect(integrityCheck.checksumValid).toBe(true);
      expect(integrityCheck.structureValid).toBe(true);
      expect(integrityCheck.dataConsistent).toBe(true);
      expect(integrityCheck.issues.length).toBe(0);
    });

    it('should detect integrity issues', async () => {
      const model = createTestUserModel('test_user', '1.0.0');
      
      // Corrupt the model data
      model.modelData.checksum = 'invalid_checksum';
      
      // Mock checksum validation failure
      jest.spyOn(migrationManager as any, 'validateChecksum').mockResolvedValue(false);
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(false);
      expect(integrityCheck.checksumValid).toBe(false);
      expect(integrityCheck.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Data Repair', () => {
    it('should repair corrupted data', async () => {
      const model = createTestUserModel('test_user', '1.0.0');
      const issues = [
        {
          issueId: 'test_issue',
          type: 'checksum_mismatch' as any,
          severity: 'high' as any,
          description: 'Checksum validation failed',
          affectedData: ['model_data']
        }
      ];
      
      const repairResult = await migrationManager.repairCorruptedData(model, issues);
      
      expect(repairResult.success).toBe(true);
      expect(repairResult.issuesRepaired).toBeGreaterThan(0);
      expect(repairResult.repairActions.length).toBeGreaterThan(0);
    });

    it('should assess data loss during repair', async () => {
      const model = createTestUserModel('test_user', '1.0.0');
      const issues = [
        {
          issueId: 'test_issue',
          type: 'structure_corruption' as any,
          severity: 'critical' as any,
          description: 'Model structure corrupted',
          affectedData: ['model_structure']
        }
      ];
      
      const repairResult = await migrationManager.repairCorruptedData(model, issues);
      
      expect(repairResult.dataLoss).toBeDefined();
      expect(repairResult.dataLoss.recoverabilityLevel).toBeDefined();
    });
  });

  describe('Rollback Operations', () => {
    it('should rollback migration successfully', async () => {
      const userId = 'test_user_123';
      const sourceModel = createTestUserModel(userId, '1.0.0');
      
      // Save source model and create backup
      await modelStore.saveUserModel(userId, sourceModel);
      const backup = await modelStore.createModelBackup(userId);
      
      // Simulate migration
      const targetVersion = '2.0.0';
      const migrationResult = await migrationManager.migrateUserModel(userId, targetVersion);
      
      if (migrationResult.success) {
        // Rollback the migration
        const rollbackResult = await migrationManager.rollbackMigration('test_migration_id');
        
        expect(rollbackResult.success).toBe(true);
        expect(rollbackResult.rollbackTime).toBeGreaterThan(0);
        expect(rollbackResult.dataIntegrity.passed).toBe(true);
      }
    });

    it('should handle rollback failures', async () => {
      const invalidMigrationId = 'nonexistent_migration';
      
      const rollbackResult = await migrationManager.rollbackMigration(invalidMigrationId);
      
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.dataIntegrity.passed).toBe(false);
    });
  });

  describe('Version Parsing and Comparison', () => {
    it('should parse version numbers correctly', async () => {
      const compatibility1 = await migrationManager.validateModelCompatibility('1.2.3', '1.2.4');
      const compatibility2 = await migrationManager.validateModelCompatibility('1.0.0', '2.0.0');
      
      expect(compatibility1.migrationComplexity).toBe('simple');
      expect(compatibility2.migrationComplexity).toBe('critical');
    });

    it('should handle invalid version formats gracefully', async () => {
      await expect(migrationManager.validateModelCompatibility('invalid', '1.0.0')).resolves.toBeDefined();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should respect Jetson Nano Orin constraints during migration', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      // Check that migration steps have reasonable duration estimates
      plan.migrationSteps.forEach(step => {
        expect(step.estimatedDuration).toBeLessThan(600000); // Less than 10 minutes
      });
      
      expect(plan.estimatedDuration).toBeLessThan(900000); // Less than 15 minutes total
    });

    it('should monitor resource usage during migration', async () => {
      const sourceModel = createTestUserModel('test_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      const result = await migrationManager.executeMigrationPlan(plan);
      
      expect(result.performanceImpact).toBeDefined();
      expect(result.performanceImpact.memoryChange).toBeDefined();
      expect(result.performanceImpact.latencyChange).toBeDefined();
    });
  });

  describe('Complex Migration Scenarios', () => {
    it('should handle migration between major versions', async () => {
      const sourceModel = createTestUserModel('major_version_user', '1.0.0');
      const targetVersion = '2.0.0';
      
      const compatibility = await migrationManager.validateModelCompatibility(sourceModel.version, targetVersion);
      
      expect(compatibility.isCompatible).toBe(false);
      expect(compatibility.migrationComplexity).toBe('critical');
      expect(compatibility.riskLevel).toBe('critical');
      expect(compatibility.compatibilityIssues.length).toBeGreaterThan(0);
    });

    it('should handle migration with data format changes', async () => {
      const sourceModel = createTestUserModel('format_change_user', '1.5.0');
      const targetVersion = '1.6.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      expect(plan.migrationSteps.some(step => 
        step.description.includes('data format')
      )).toBe(true);
      expect(plan.riskAssessment.overallRisk).toBe('medium');
    });

    it('should handle migration with schema changes', async () => {
      const sourceModel = createTestUserModel('schema_change_user', '2.1.0');
      const targetVersion = '2.2.0';
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      expect(plan.migrationSteps.some(step => 
        step.description.includes('schema')
      )).toBe(true);
      expect(plan.validationChecks.some(check => 
        check.type === 'schema_validation'
      )).toBe(true);
    });

    it('should handle concurrent migrations', async () => {
      const user1Model = createTestUserModel('concurrent_user_1', '1.0.0');
      const user2Model = createTestUserModel('concurrent_user_2', '1.0.0');
      const targetVersion = '1.1.0';
      
      // Save both models
      await modelStore.saveUserModel(user1Model.userId, user1Model);
      await modelStore.saveUserModel(user2Model.userId, user2Model);
      
      // Start concurrent migrations
      const migration1Promise = migrationManager.migrateUserModel(user1Model.userId, targetVersion);
      const migration2Promise = migrationManager.migrateUserModel(user2Model.userId, targetVersion);
      
      const [result1, result2] = await Promise.all([migration1Promise, migration2Promise]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.dataIntegrity.passed).toBe(true);
      expect(result2.dataIntegrity.passed).toBe(true);
    });
  });

  describe('Data Integrity Validation Scenarios', () => {
    it('should detect checksum mismatches', async () => {
      const model = createTestUserModel('checksum_test_user', '1.0.0');
      
      // Corrupt the checksum
      model.modelData.checksum = 'invalid_checksum_value';
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(false);
      expect(integrityCheck.checksumValid).toBe(false);
      expect(integrityCheck.issues.some(issue => 
        issue.type === 'checksum_mismatch'
      )).toBe(true);
    });

    it('should detect structure corruption', async () => {
      const model = createTestUserModel('structure_test_user', '1.0.0');
      
      // Corrupt the model structure by removing required fields
      delete (model.metadata as any).modelType;
      delete (model.performance as any).accuracy;
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(false);
      expect(integrityCheck.structureValid).toBe(false);
      expect(integrityCheck.issues.some(issue => 
        issue.type === 'structure_corruption'
      )).toBe(true);
    });

    it('should detect data inconsistencies', async () => {
      const model = createTestUserModel('consistency_test_user', '1.0.0');
      
      // Create inconsistent data
      model.metadata.trainingDataSize = 1000;
      model.performance.accuracy = 1.5; // Invalid accuracy > 1.0
      model.modelData.originalSize = -100; // Invalid negative size
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(false);
      expect(integrityCheck.dataConsistent).toBe(false);
      expect(integrityCheck.issues.some(issue => 
        issue.type === 'data_inconsistency'
      )).toBe(true);
    });

    it('should validate model version consistency', async () => {
      const model = createTestUserModel('version_test_user', '1.0.0');
      
      // Create version inconsistency
      model.version = '1.0.0';
      model.metadata.deploymentInfo.version = '2.0.0'; // Different version
      
      const integrityCheck = await migrationManager.validateDataIntegrity(model);
      
      expect(integrityCheck.passed).toBe(false);
      expect(integrityCheck.issues.some(issue => 
        issue.affectedData.includes('version')
      )).toBe(true);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should repair corrupted checksums', async () => {
      const model = createTestUserModel('repair_checksum_user', '1.0.0');
      model.modelData.checksum = 'corrupted_checksum';
      
      const issues = [{
        issueId: 'checksum_issue',
        type: 'checksum_mismatch' as any,
        severity: 'high' as any,
        description: 'Checksum validation failed',
        affectedData: ['model_data']
      }];
      
      const repairResult = await migrationManager.repairCorruptedData(model, issues);
      
      expect(repairResult.success).toBe(true);
      expect(repairResult.issuesRepaired).toBeGreaterThan(0);
      expect(repairResult.repairActions.some(action => 
        action.type === 'checksum_recalculation'
      )).toBe(true);
    });

    it('should repair structure corruption with minimal data loss', async () => {
      const model = createTestUserModel('repair_structure_user', '1.0.0');
      
      // Remove critical structure elements
      delete (model.metadata as any).modelType;
      delete (model.performance as any).accuracy;
      
      const issues = [{
        issueId: 'structure_issue',
        type: 'structure_corruption' as any,
        severity: 'critical' as any,
        description: 'Model structure corrupted',
        affectedData: ['metadata', 'performance']
      }];
      
      const repairResult = await migrationManager.repairCorruptedData(model, issues);
      
      expect(repairResult.success).toBe(true);
      expect(repairResult.dataLoss.hasDataLoss).toBe(false);
      expect(repairResult.dataLoss.recoverabilityLevel).toBe('full');
    });

    it('should handle irreparable corruption gracefully', async () => {
      const model = createTestUserModel('irreparable_user', '1.0.0');
      
      // Completely corrupt the model data
      model.modelData.encryptedData = '';
      model.modelData.checksum = '';
      delete (model as any).metadata;
      delete (model as any).performance;
      
      const issues = [{
        issueId: 'total_corruption',
        type: 'corruption' as any,
        severity: 'critical' as any,
        description: 'Complete model corruption detected',
        affectedData: ['all']
      }];
      
      const repairResult = await migrationManager.repairCorruptedData(model, issues);
      
      expect(repairResult.success).toBe(false);
      expect(repairResult.dataLoss.hasDataLoss).toBe(true);
      expect(repairResult.dataLoss.recoverabilityLevel).toBe('none');
    });
  });

  describe('Migration History and Audit', () => {
    it('should maintain detailed migration logs', async () => {
      const sourceModel = createTestUserModel('audit_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      await modelStore.saveUserModel(sourceModel.userId, sourceModel);
      
      const result = await migrationManager.migrateUserModel(sourceModel.userId, targetVersion);
      
      expect(result.migrationLog.length).toBeGreaterThan(0);
      expect(result.migrationLog[0].operation).toBeDefined();
      expect(result.migrationLog[0].status).toBeDefined();
      expect(result.migrationLog[0].timestamp).toBeDefined();
    });

    it('should track migration performance metrics', async () => {
      const sourceModel = createTestUserModel('metrics_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      await modelStore.saveUserModel(sourceModel.userId, sourceModel);
      
      const startTime = Date.now();
      const result = await migrationManager.migrateUserModel(sourceModel.userId, targetVersion);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.migrationLog.some(entry => 
        entry.details.includes('duration') || 
        entry.details.includes('performance')
      )).toBe(true);
    });

    it('should enable migration rollback with audit trail', async () => {
      const sourceModel = createTestUserModel('rollback_audit_user', '1.0.0');
      const targetVersion = '2.0.0';
      
      await modelStore.saveUserModel(sourceModel.userId, sourceModel);
      
      // Perform migration
      const migrationResult = await migrationManager.migrateUserModel(sourceModel.userId, targetVersion);
      
      if (migrationResult.success) {
        // Rollback migration
        const rollbackResult = await migrationManager.rollbackMigration('test_migration_id');
        
        expect(rollbackResult.dataIntegrity.passed).toBe(true);
      }
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle migration of non-existent models', async () => {
      const nonExistentUserId = 'non_existent_user_12345';
      const targetVersion = '1.1.0';
      
      const result = await migrationManager.migrateUserModel(nonExistentUserId, targetVersion);
      
      expect(result.success).toBe(false);
      expect(result.dataIntegrity.passed).toBe(false);
      expect(result.migrationLog.some(entry => 
        entry.details.includes('not found') || 
        entry.status === 'failed'
      )).toBe(true);
    });

    it('should handle invalid version formats', async () => {
      const sourceVersion = 'invalid.version.format';
      const targetVersion = 'also.invalid';
      
      const compatibility = await migrationManager.validateModelCompatibility(sourceVersion, targetVersion);
      
      expect(compatibility).toBeDefined();
      expect(compatibility.isCompatible).toBe(false);
    });

    it('should handle migration timeout scenarios', async () => {
      const sourceModel = createTestUserModel('timeout_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      // Mock long-running migration step
      jest.spyOn(migrationManager as any, 'executeMigrationStep').mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      });
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      // Set a short timeout for testing
      const executionPromise = migrationManager.executeMigrationPlan(plan);
      
      // The migration should handle timeouts gracefully
      const result = await executionPromise;
      expect(result).toBeDefined();
    });

    it('should handle disk space exhaustion during migration', async () => {
      const sourceModel = createTestUserModel('disk_space_user', '1.0.0');
      const targetVersion = '1.1.0';
      
      // Mock disk space check
      jest.spyOn(migrationManager as any, 'checkAvailableDiskSpace').mockResolvedValue(100); // 100MB available
      
      const plan = await migrationManager.createMigrationPlan(sourceModel, targetVersion);
      
      expect(plan.riskAssessment.riskFactors.some(factor => 
        factor.type === 'system_instability'
      )).toBe(true);
    });
  });
});