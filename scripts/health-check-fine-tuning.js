#!/usr/bin/env node

/**
 * Fine-Tuning System Health Check
 * 
 * A simple health check script that can be run periodically to ensure
 * the fine-tuning system is functioning correctly in production.
 */

const fs = require('fs');
const path = require('path');

class HealthChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      status: 'unknown',
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${timestamp} ${prefix} ${message}`);
  }

  addCheck(name, status, message, details = null) {
    this.results.checks.push({
      name,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    });

    this.results.summary.total++;
    if (status === 'pass') {
      this.results.summary.passed++;
    } else if (status === 'fail') {
      this.results.summary.failed++;
    } else if (status === 'warn') {
      this.results.summary.warnings++;
    }
  }

  async checkFileExists(filePath, description) {
    try {
      const exists = fs.existsSync(filePath);
      if (exists) {
        this.addCheck(`File Check: ${description}`, 'pass', `File exists: ${filePath}`);
        this.log(`File exists: ${filePath}`);
        return true;
      } else {
        this.addCheck(`File Check: ${description}`, 'fail', `File missing: ${filePath}`);
        this.log(`File missing: ${filePath}`, 'error');
        return false;
      }
    } catch (error) {
      this.addCheck(`File Check: ${description}`, 'fail', `Error checking file: ${error.message}`);
      this.log(`Error checking file ${filePath}: ${error.message}`, 'error');
      return false;
    }
  }

  async checkNodeModules() {
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      this.addCheck('Dependencies', 'fail', 'package.json not found');
      this.log('package.json not found', 'error');
      return false;
    }

    if (!fs.existsSync(nodeModulesPath)) {
      this.addCheck('Dependencies', 'fail', 'node_modules directory not found');
      this.log('node_modules directory not found', 'error');
      return false;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      let missingDeps = 0;
      for (const dep of Object.keys(dependencies)) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          missingDeps++;
        }
      }

      if (missingDeps === 0) {
        this.addCheck('Dependencies', 'pass', 'All dependencies installed');
        this.log('All dependencies installed');
        return true;
      } else {
        this.addCheck('Dependencies', 'warn', `${missingDeps} dependencies missing`);
        this.log(`${missingDeps} dependencies missing`, 'warn');
        return false;
      }
    } catch (error) {
      this.addCheck('Dependencies', 'fail', `Error checking dependencies: ${error.message}`);
      this.log(`Error checking dependencies: ${error.message}`, 'error');
      return false;
    }
  }

  async checkSystemResources() {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const totalMemoryMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      this.addCheck('Memory Usage', 'pass', `Using ${memoryMB}MB of ${totalMemoryMB}MB`, {
        heapUsed: memoryMB,
        heapTotal: totalMemoryMB,
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      });

      this.log(`Memory usage: ${memoryMB}MB / ${totalMemoryMB}MB`);

      // Check if memory usage is concerning
      if (memoryMB > 1024) {
        this.addCheck('Memory Warning', 'warn', `High memory usage: ${memoryMB}MB`);
        this.log(`High memory usage: ${memoryMB}MB`, 'warn');
      }

      return true;
    } catch (error) {
      this.addCheck('System Resources', 'fail', `Error checking resources: ${error.message}`);
      this.log(`Error checking system resources: ${error.message}`, 'error');
      return false;
    }
  }

  async checkBasicImport() {
    try {
      // Try to import the main learning module
      const learningModule = require('../learning');
      
      const requiredExports = [
        'SimpleFineTuningIntegration',
        'FineTuningConfigFactory',
        'RuntimeConfigDetector'
      ];

      let missingExports = [];
      for (const exportName of requiredExports) {
        if (!learningModule[exportName]) {
          missingExports.push(exportName);
        }
      }

      if (missingExports.length === 0) {
        this.addCheck('Module Import', 'pass', 'All required exports available');
        this.log('All required exports available');
        return true;
      } else {
        this.addCheck('Module Import', 'fail', `Missing exports: ${missingExports.join(', ')}`);
        this.log(`Missing exports: ${missingExports.join(', ')}`, 'error');
        return false;
      }
    } catch (error) {
      this.addCheck('Module Import', 'fail', `Import error: ${error.message}`);
      this.log(`Module import error: ${error.message}`, 'error');
      return false;
    }
  }

  async checkConfiguration() {
    try {
      const { FineTuningConfigFactory } = require('../learning');
      
      const environments = ['development', 'production', 'jetson', 'child-safe'];
      let configErrors = [];

      for (const env of environments) {
        try {
          const config = FineTuningConfigFactory.getConfig(env);
          if (!config || !config.familyLLMConfig) {
            configErrors.push(`Invalid ${env} configuration`);
          }
        } catch (error) {
          configErrors.push(`${env}: ${error.message}`);
        }
      }

      if (configErrors.length === 0) {
        this.addCheck('Configuration', 'pass', 'All environment configurations valid');
        this.log('All environment configurations valid');
        return true;
      } else {
        this.addCheck('Configuration', 'fail', `Configuration errors: ${configErrors.join(', ')}`);
        this.log(`Configuration errors: ${configErrors.join(', ')}`, 'error');
        return false;
      }
    } catch (error) {
      this.addCheck('Configuration', 'fail', `Configuration check error: ${error.message}`);
      this.log(`Configuration check error: ${error.message}`, 'error');
      return false;
    }
  }

  async checkBasicFunctionality() {
    try {
      const { SimpleFineTuningIntegration, FineTuningConfigFactory } = require('../learning');
      
      // Create a mock learning engine
      const mockEngine = {
        getInteractionHistory: async () => [{ userId: 'test', timestamp: new Date() }],
        getFamilyProfile: async () => ({ 
          familyId: 'test', 
          members: [], 
          preferences: {}, 
          safetySettings: {}, 
          createdAt: new Date(), 
          lastUpdated: new Date() 
        }),
        generateRecommendations: async () => ['Test recommendation']
      };

      const config = FineTuningConfigFactory.getConfig('development');
      const integration = new SimpleFineTuningIntegration(config, mockEngine);

      // Test initialization
      await integration.initialize();

      // Test metrics
      const metrics = integration.getIntegrationMetrics();
      if (!metrics || typeof metrics.totalFamilyModels !== 'number') {
        throw new Error('Invalid metrics response');
      }

      // Test recommendation generation
      const context = {
        timeOfDay: 'morning',
        dayOfWeek: 'saturday',
        currentActivity: 'breakfast',
        familyMembers: ['test'],
        environmentalFactors: ['home']
      };

      const recommendations = await integration.generatePersonalizedRecommendations('test-family', context);
      
      if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Invalid recommendations response');
      }

      this.addCheck('Basic Functionality', 'pass', 'Core functionality working', {
        metricsAvailable: true,
        recommendationsGenerated: recommendations.length,
        initializationSuccessful: true
      });

      this.log(`Basic functionality test passed - generated ${recommendations.length} recommendations`);
      return true;

    } catch (error) {
      this.addCheck('Basic Functionality', 'fail', `Functionality test failed: ${error.message}`);
      this.log(`Basic functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runAllChecks() {
    this.log('Starting Fine-Tuning System Health Check...');

    // Core file checks
    const coreFiles = [
      { path: 'learning/index.ts', desc: 'Main learning module' },
      { path: 'learning/local-llm-fine-tuner.ts', desc: 'Fine-tuner module' },
      { path: 'learning/fine-tuning-integration-simple.ts', desc: 'Integration module' },
      { path: 'learning/fine-tuning-config.ts', desc: 'Configuration module' },
      { path: 'package.json', desc: 'Package configuration' }
    ];

    for (const file of coreFiles) {
      await this.checkFileExists(file.path, file.desc);
    }

    // System checks
    await this.checkNodeModules();
    await this.checkSystemResources();
    await this.checkBasicImport();
    await this.checkConfiguration();
    await this.checkBasicFunctionality();

    // Determine overall status
    if (this.results.summary.failed > 0) {
      this.results.status = 'unhealthy';
    } else if (this.results.summary.warnings > 0) {
      this.results.status = 'degraded';
    } else {
      this.results.status = 'healthy';
    }

    return this.results;
  }

  printSummary() {
    const { summary, status } = this.results;
    
    console.log('\n' + '='.repeat(60));
    console.log('FINE-TUNING SYSTEM HEALTH CHECK SUMMARY');
    console.log('='.repeat(60));
    
    const statusIcon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
    console.log(`Overall Status: ${statusIcon} ${status.toUpperCase()}`);
    console.log(`Total Checks: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Warnings: ${summary.warnings}`);
    
    if (summary.failed > 0) {
      console.log('\n❌ FAILED CHECKS:');
      this.results.checks
        .filter(check => check.status === 'fail')
        .forEach(check => {
          console.log(`  - ${check.name}: ${check.message}`);
        });
    }

    if (summary.warnings > 0) {
      console.log('\n⚠️ WARNINGS:');
      this.results.checks
        .filter(check => check.status === 'warn')
        .forEach(check => {
          console.log(`  - ${check.name}: ${check.message}`);
        });
    }

    console.log('='.repeat(60));
  }

  saveResults(outputPath = 'health-check-results.json') {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2));
      this.log(`Health check results saved to ${outputPath}`);
    } catch (error) {
      this.log(`Failed to save results: ${error.message}`, 'error');
    }
  }
}

// Run health check if this script is executed directly
if (require.main === module) {
  const checker = new HealthChecker();
  
  checker.runAllChecks()
    .then(results => {
      checker.printSummary();
      
      // Save results if requested
      if (process.argv.includes('--save-results')) {
        checker.saveResults();
      }
      
      // Exit with appropriate code
      process.exit(results.status === 'healthy' ? 0 : results.status === 'degraded' ? 1 : 2);
    })
    .catch(error => {
      console.error('❌ Health check failed:', error);
      process.exit(3);
    });
}

module.exports = { HealthChecker };