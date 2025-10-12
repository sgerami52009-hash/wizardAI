#!/usr/bin/env node

/**
 * Virtual Jetson Nano Orin JetPack 5.x Testing Script
 * Tests the JetPack 5 deployment in a virtual environment
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class VirtualJetsonTester {
    constructor() {
        this.containerName = 'virtual-jetson-jp5';
        this.testResults = [];
        this.startTime = Date.now();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const levelColors = {
            info: colors.blue,
            success: colors.green,
            warning: colors.yellow,
            error: colors.red,
            test: colors.cyan
        };
        
        console.log(`${levelColors[level]}[${timestamp}] ${message}${colors.reset}`);
    }

    async runCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error && !options.ignoreError) {
                    reject({ error, stdout, stderr });
                } else {
                    resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                }
            });
        });
    }

    async dockerExec(command, options = {}) {
        const fullCommand = `docker exec ${options.user ? `-u ${options.user}` : ''} ${this.containerName} ${command}`;
        return this.runCommand(fullCommand, options);
    }

    async testStep(name, testFunction) {
        this.log(`Testing: ${name}`, 'test');
        const stepStart = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - stepStart;
            this.log(`✅ ${name} - Passed (${duration}ms)`, 'success');
            this.testResults.push({ name, status: 'PASS', duration });
            return true;
        } catch (error) {
            const duration = Date.now() - stepStart;
            this.log(`❌ ${name} - Failed: ${error.message}`, 'error');
            this.testResults.push({ name, status: 'FAIL', duration, error: error.message });
            return false;
        }
    }

    async setupVirtualEnvironment() {
        this.log('Setting up Virtual Jetson JetPack 5.x Environment...', 'info');
        
        // Check if Docker is available
        try {
            await this.runCommand('docker --version');
            this.log('Docker is available', 'success');
        } catch (error) {
            throw new Error('Docker is not available. Please install Docker first.');
        }

        // Stop existing container if running
        try {
            await this.runCommand(`docker stop ${this.containerName}`, { ignoreError: true });
            await this.runCommand(`docker rm ${this.containerName}`, { ignoreError: true });
        } catch (error) {
            // Ignore errors for cleanup
        }

        // Build and start virtual Jetson environment
        this.log('Building virtual Jetson environment...', 'info');
        const buildResult = await this.runCommand(
            'docker compose -f deployment/docker-compose.virtual-jetson-jp5.yml up -d --build',
            { cwd: process.cwd() }
        );

        // Wait for container to be ready
        this.log('Waiting for virtual Jetson to be ready...', 'info');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second wait

        // Verify container is running
        const psResult = await this.runCommand(`docker ps --filter name=${this.containerName} --format "{{.Status}}"`);
        if (!psResult.stdout.includes('Up')) {
            throw new Error('Virtual Jetson container failed to start');
        }

        this.log('Virtual Jetson JetPack 5.x environment is ready!', 'success');
    }

    async testJetPackEnvironment() {
        await this.testStep('JetPack Version Detection', async () => {
            const result = await this.dockerExec('cat /etc/nv_tegra_release');
            if (!result.stdout.includes('R35')) {
                throw new Error('JetPack 5.x version not detected');
            }
        });

        await this.testStep('CUDA 11.4 Availability', async () => {
            const result = await this.dockerExec('nvcc --version');
            if (!result.stdout.includes('11.4')) {
                throw new Error('CUDA 11.4 not found');
            }
        });

        await this.testStep('Node.js 18 LTS', async () => {
            const result = await this.dockerExec('node --version');
            if (!result.stdout.startsWith('v18.')) {
                throw new Error('Node.js 18 LTS not installed');
            }
        });

        await this.testStep('Memory Configuration (8GB)', async () => {
            const result = await this.dockerExec('free -g');
            const memLine = result.stdout.split('\n').find(line => line.startsWith('Mem:'));
            const totalMem = parseInt(memLine.split(/\s+/)[1]);
            if (totalMem < 7) {
                throw new Error('Insufficient memory detected');
            }
        });

        await this.testStep('Audio System Simulation', async () => {
            const result = await this.dockerExec('ls -la /dev/snd/');
            if (!result.stdout.includes('controlC0')) {
                throw new Error('Audio devices not simulated properly');
            }
        });
    }

    async testApplicationDeployment() {
        await this.testStep('Copy Application Files', async () => {
            // Copy package.json and basic files
            await this.dockerExec('mkdir -p /home/jetson/home-assistant');
            await this.dockerExec('cp -r /workspace/* /home/jetson/home-assistant/ || true');
            
            const result = await this.dockerExec('ls /home/jetson/home-assistant/package.json');
            if (result.stderr && result.stderr.includes('No such file')) {
                throw new Error('Application files not copied properly');
            }
        });

        await this.testStep('Install Dependencies', async () => {
            const result = await this.dockerExec(
                'cd /home/jetson/home-assistant && npm ci --production',
                { user: 'jetson' }
            );
            
            // Check if node_modules exists
            const nodeModulesCheck = await this.dockerExec('ls /home/jetson/home-assistant/node_modules');
            if (nodeModulesCheck.stderr && nodeModulesCheck.stderr.includes('No such file')) {
                throw new Error('Dependencies not installed properly');
            }
        });

        await this.testStep('Build Application', async () => {
            // First install dev dependencies for build
            await this.dockerExec(
                'cd /home/jetson/home-assistant && npm install',
                { user: 'jetson' }
            );
            
            const result = await this.dockerExec(
                'cd /home/jetson/home-assistant && npm run build',
                { user: 'jetson' }
            );
            
            // Check if dist directory exists
            const distCheck = await this.dockerExec('ls /home/jetson/home-assistant/dist/index.js');
            if (distCheck.stderr && distCheck.stderr.includes('No such file')) {
                throw new Error('Application build failed');
            }
        });
    }

    async testJetPack5Deployment() {
        await this.testStep('JetPack 5 Docker Build', async () => {
            const result = await this.dockerExec(
                'cd /home/jetson/home-assistant && docker build -f deployment/Dockerfile.jetson-jetpack5 -t test-jetpack5-app .',
                { user: 'jetson' }
            );
            
            // Verify image was created
            const imageCheck = await this.dockerExec('docker images test-jetpack5-app');
            if (!imageCheck.stdout.includes('test-jetpack5-app')) {
                throw new Error('JetPack 5 Docker image build failed');
            }
        });

        await this.testStep('JetPack 5 Container Startup', async () => {
            // Stop any existing test container
            await this.dockerExec('docker stop test-jetpack5-container || true', { ignoreError: true });
            await this.dockerExec('docker rm test-jetpack5-container || true', { ignoreError: true });
            
            // Start test container
            const result = await this.dockerExec(
                'docker run -d --name test-jetpack5-container -p 3001:3000 test-jetpack5-app',
                { user: 'jetson' }
            );
            
            // Wait for container to start
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Check if container is running
            const containerCheck = await this.dockerExec('docker ps --filter name=test-jetpack5-container');
            if (!containerCheck.stdout.includes('test-jetpack5-container')) {
                // Get logs for debugging
                const logs = await this.dockerExec('docker logs test-jetpack5-container');
                throw new Error(`Container failed to start. Logs: ${logs.stdout}`);
            }
        });

        await this.testStep('Application Health Check', async () => {
            // Wait a bit more for application to fully start
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            const result = await this.dockerExec(
                'curl -f http://localhost:3001/health || echo "Health check failed"'
            );
            
            if (result.stdout.includes('Health check failed')) {
                // Try to get application logs
                const logs = await this.dockerExec('docker logs test-jetpack5-container');
                this.log(`Application logs: ${logs.stdout}`, 'warning');
                throw new Error('Health check endpoint not responding');
            }
        });
    }

    async testResourceUsage() {
        await this.testStep('Memory Usage Check', async () => {
            const result = await this.dockerExec('docker stats test-jetpack5-container --no-stream --format "{{.MemUsage}}"');
            const memUsage = result.stdout;
            this.log(`Container memory usage: ${memUsage}`, 'info');
            
            // Extract memory usage (basic check)
            if (memUsage.includes('GiB') && parseFloat(memUsage) > 6) {
                throw new Error('Memory usage exceeds JetPack 5 limits');
            }
        });

        await this.testStep('CPU Usage Check', async () => {
            const result = await this.dockerExec('docker stats test-jetpack5-container --no-stream --format "{{.CPUPerc}}"');
            const cpuUsage = result.stdout;
            this.log(`Container CPU usage: ${cpuUsage}`, 'info');
        });
    }

    async cleanup() {
        this.log('Cleaning up test environment...', 'info');
        
        try {
            // Stop test containers
            await this.dockerExec('docker stop test-jetpack5-container || true', { ignoreError: true });
            await this.dockerExec('docker rm test-jetpack5-container || true', { ignoreError: true });
            await this.dockerExec('docker rmi test-jetpack5-app || true', { ignoreError: true });
            
            // Stop virtual Jetson
            await this.runCommand(`docker compose -f deployment/docker-compose.virtual-jetson-jp5.yml down`, { ignoreError: true });
            
            this.log('Cleanup completed', 'success');
        } catch (error) {
            this.log(`Cleanup warning: ${error.message}`, 'warning');
        }
    }

    generateReport() {
        const totalTime = Date.now() - this.startTime;
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}VIRTUAL JETSON JETPACK 5.x TEST REPORT${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
        console.log(`Total Time: ${totalTime}ms`);
        console.log('='.repeat(60));
        
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? 
                `${colors.green}✅ PASS${colors.reset}` : 
                `${colors.red}❌ FAIL${colors.reset}`;
            console.log(`${status} ${result.name} (${result.duration}ms)`);
            if (result.error) {
                console.log(`    ${colors.red}Error: ${result.error}${colors.reset}`);
            }
        });
        
        console.log('='.repeat(60));
        
        // Save report to file
        const report = {
            timestamp: new Date().toISOString(),
            totalTime,
            passed,
            failed,
            results: this.testResults
        };
        
        fs.writeFileSync('virtual-jetson-jp5-test-report.json', JSON.stringify(report, null, 2));
        this.log('Test report saved to virtual-jetson-jp5-test-report.json', 'info');
        
        return failed === 0;
    }

    async runAllTests() {
        try {
            this.log('Starting Virtual Jetson JetPack 5.x Deployment Test', 'info');
            
            await this.setupVirtualEnvironment();
            await this.testJetPackEnvironment();
            await this.testApplicationDeployment();
            await this.testJetPack5Deployment();
            await this.testResourceUsage();
            
            const success = this.generateReport();
            
            if (success) {
                this.log('🎉 All tests passed! JetPack 5 deployment is working correctly.', 'success');
            } else {
                this.log('⚠️ Some tests failed. Check the report for details.', 'warning');
            }
            
            return success;
            
        } catch (error) {
            this.log(`Fatal error: ${error.message}`, 'error');
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new VirtualJetsonTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = VirtualJetsonTester;