#!/usr/bin/env node

/**
 * Simple Fine-Tuning System Validation
 * 
 * A basic validation script that checks the fine-tuning system files
 * and structure without requiring compilation.
 */

const fs = require('fs');
const path = require('path');

class SimpleValidator {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(message, status = 'info') {
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : status === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${icon} ${message}`);
  }

  test(name, testFn) {
    try {
      const result = testFn();
      if (result) {
        this.log(`${name}: PASSED`, 'pass');
        this.passed++;
        this.results.push({ name, status: 'pass' });
      } else {
        this.log(`${name}: FAILED`, 'fail');
        this.failed++;
        this.results.push({ name, status: 'fail' });
      }
    } catch (error) {
      this.log(`${name}: FAILED - ${error.message}`, 'fail');
      this.failed++;
      this.results.push({ name, status: 'fail', error: error.message });
    }
  }

  checkFileExists(filePath) {
    return fs.existsSync(filePath);
  }

  checkFileContent(filePath, expectedContent) {
    if (!fs.existsSync(filePath)) return false;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.includes(expectedContent);
    } catch {
      return false;
    }
  }

  checkDirectoryStructure() {
    const requiredDirs = [
      'learning',
      'scripts'
    ];

    return requiredDirs.every(dir => fs.existsSync(dir));
  }

  validatePackageJson() {
    if (!fs.existsSync('package.json')) return false;
    
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.name && pkg.version && pkg.scripts;
    } catch {
      return false;
    }
  }

  validateTsConfig() {
    if (!fs.existsSync('tsconfig.json')) return false;
    
    try {
      const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
      return tsconfig.compilerOptions && tsconfig.compilerOptions.target;
    } catch {
      return false;
    }
  }

  validateCoreFiles() {
    const coreFiles = [
      'learning/index.ts',
      'learning/local-llm-fine-tuner.ts',
      'learning/family-llm-factory.ts',
      'learning/fine-tuning-integration.ts',
      'learning/fine-tuning-integration-simple.ts',
      'learning/fine-tuning-config.ts',
      'learning/llm-enhanced-engine.ts',
      'learning/FINE_TUNING_README.md'
    ];

    return coreFiles.every(file => this.checkFileExists(file));
  }

  validateTestFiles() {
    const testFiles = [
      'learning/local-llm-fine-tuner.test.ts',
      'learning/family-llm-factory.test.ts',
      'learning/fine-tuning-integration-simple.test.ts',
      'learning/deployment-validation.test.ts',
      'learning/system-integration.test.ts'
    ];

    const existingTests = testFiles.filter(file => this.checkFileExists(file));
    return existingTests.length >= testFiles.length * 0.8; // At least 80% of tests exist
  }

  validateExports() {
    const indexFile = 'learning/index.ts';
    if (!this.checkFileExists(indexFile)) return false;

    const requiredExports = [
      'local-llm-fine-tuner',
      'family-llm-factory',
      'fine-tuning-integration',
      'fine-tuning-integration-simple',
      'fine-tuning-config'
    ];

    return requiredExports.every(exportName => 
      this.checkFileContent(indexFile, exportName)
    );
  }

  validateClassStructures() {
    const classChecks = [
      {
        file: 'learning/local-llm-fine-tuner.ts',
        className: 'LocalLLMFineTuner',
        methods: ['createFamilyDataset', 'fineTuneModel', 'generateFamilyRecommendations']
      },
      {
        file: 'learning/family-llm-factory.ts',
        className: 'FamilyLLMFactory',
        methods: ['createFamilyModel', 'generateFamilyRecommendations', 'validateFamilyModel']
      },
      {
        file: 'learning/fine-tuning-integration-simple.ts',
        className: 'SimpleFineTuningIntegration',
        methods: ['initialize', 'generatePersonalizedRecommendations', 'createOrUpdateFamilyModel']
      }
    ];

    return classChecks.every(check => {
      if (!this.checkFileExists(check.file)) return false;
      
      const hasClass = this.checkFileContent(check.file, `class ${check.className}`);
      const hasMethods = check.methods.every(method => 
        this.checkFileContent(check.file, method)
      );
      
      return hasClass && hasMethods;
    });
  }

  validateConfiguration() {
    const configFile = 'learning/fine-tuning-config.ts';
    if (!this.checkFileExists(configFile)) return false;

    const requiredConfigs = [
      'DEFAULT_JETSON_CONFIG',
      'DEVELOPMENT_CONFIG',
      'PRODUCTION_CONFIG',
      'CHILD_SAFE_CONFIG',
      'FineTuningConfigFactory'
    ];

    return requiredConfigs.every(config => 
      this.checkFileContent(configFile, config)
    );
  }

  validateDocumentation() {
    const docFiles = [
      'learning/FINE_TUNING_README.md',
      'learning/fine-tuning-example.ts'
    ];

    return docFiles.every(file => this.checkFileExists(file));
  }

  validateSafetyFeatures() {
    const safetyChecks = [
      {
        file: 'learning/local-llm-fine-tuner.ts',
        features: ['SafetyValidator', 'PrivacyFilter', 'safetyThreshold']
      },
      {
        file: 'learning/fine-tuning-config.ts',
        features: ['CHILD_SAFE_CONFIG', 'safetyThreshold', 'privacyLevel']
      }
    ];

    return safetyChecks.every(check => {
      if (!this.checkFileExists(check.file)) return false;
      
      return check.features.some(feature => 
        this.checkFileContent(check.file, feature)
      );
    });
  }

  validateScripts() {
    const scriptFiles = [
      'scripts/validate-fine-tuning-deployment.ts',
      'scripts/validate-fine-tuning-deployment.ps1',
      'scripts/health-check-fine-tuning.js'
    ];

    return scriptFiles.every(file => this.checkFileExists(file));
  }

  runAllValidations() {
    console.log('🚀 Starting Simple Fine-Tuning System Validation...\n');

    this.test('Directory Structure', () => this.checkDirectoryStructure());
    this.test('Package Configuration', () => this.validatePackageJson());
    this.test('TypeScript Configuration', () => this.validateTsConfig());
    this.test('Core Files Present', () => this.validateCoreFiles());
    this.test('Test Files Present', () => this.validateTestFiles());
    this.test('Module Exports', () => this.validateExports());
    this.test('Class Structures', () => this.validateClassStructures());
    this.test('Configuration System', () => this.validateConfiguration());
    this.test('Documentation', () => this.validateDocumentation());
    this.test('Safety Features', () => this.validateSafetyFeatures());
    this.test('Validation Scripts', () => this.validateScripts());

    this.printSummary();
    return this.failed === 0;
  }

  printSummary() {
    const total = this.passed + this.failed;
    
    console.log('\n' + '='.repeat(60));
    console.log('SIMPLE VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    if (this.failed === 0) {
      this.log(`All ${total} validation checks passed! 🎉`, 'pass');
      this.log('The fine-tuning system structure is ready for deployment.', 'info');
    } else {
      this.log(`${this.failed} out of ${total} checks failed.`, 'fail');
      this.log('Please review the failed checks above.', 'warn');
    }
    
    console.log('='.repeat(60));
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        success: this.failed === 0
      },
      results: this.results,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      }
    };

    try {
      fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
      this.log('Validation report saved to validation-report.json', 'info');
    } catch (error) {
      this.log(`Failed to save report: ${error.message}`, 'warn');
    }

    return report;
  }
}

// Additional system checks
function checkSystemRequirements() {
  console.log('📋 System Requirements Check:');
  
  // Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    console.log(`✅ Node.js version: ${nodeVersion} (✓ >= 18.0.0)`);
  } else {
    console.log(`❌ Node.js version: ${nodeVersion} (✗ < 18.0.0)`);
    return false;
  }

  // Memory
  const memoryUsage = process.memoryUsage();
  const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  console.log(`✅ Available memory: ${totalMemoryMB}MB`);

  // Platform
  console.log(`✅ Platform: ${process.platform} (${process.arch})`);
  
  return true;
}

function checkGitRepository() {
  console.log('\n📋 Git Repository Check:');
  
  if (fs.existsSync('.git')) {
    console.log('✅ Git repository initialized');
    
    if (fs.existsSync('.gitignore')) {
      console.log('✅ .gitignore file present');
    } else {
      console.log('⚠️ .gitignore file missing');
    }
    
    return true;
  } else {
    console.log('⚠️ Not a Git repository');
    return false;
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  console.log('Fine-Tuning System Simple Validation');
  console.log('=====================================\n');

  // System requirements
  const systemOk = checkSystemRequirements();
  
  // Git check
  checkGitRepository();
  
  console.log(''); // Empty line
  
  if (!systemOk) {
    console.log('❌ System requirements not met. Please upgrade Node.js to version 18 or higher.');
    process.exit(1);
  }

  // Main validation
  const validator = new SimpleValidator();
  const success = validator.runAllValidations();
  
  // Generate report
  validator.generateReport();
  
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

module.exports = { SimpleValidator };