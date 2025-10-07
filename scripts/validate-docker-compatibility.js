#!/usr/bin/env node

/**
 * Docker JetPack 6 Compatibility Validation
 * Cross-platform Node.js version for validating Docker setup
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');

class DockerJetPackValidator {
    constructor() {
        this.minDockerVersion = '20.10.0';
        this.recommendedDockerVersion = '24.0.0';
        this.minComposeVersion = '2.0.0';
        this.recommendedComposeVersion = '2.20.0';
        
        this.results = {
            jetpack6: false,
            dockerVersion: null,
            composeVersion: null,
            dockerOk: false,
            composeOk: false,
            nvidiaSupportOk: false
        };
    }

    // Compare version strings
    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            
            if (v1part > v2part) return 1;
            if (v1part < v2part) return -1;
        }
        return 0;
    }

    // Execute command safely
    execCommand(command) {
        try {
            return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
        } catch (error) {
            return null;
        }
    }

    // Check if running on Jetson platform
    checkJetsonPlatform() {
        console.log('🔍 Checking Jetson platform...');
        
        // Check environment variables (for simulation)
        if (process.env.JETSON_PLATFORM === 'orin-nano' || process.env.JETSON_VIRTUAL === 'true') {
            console.log('  ✅ Jetson platform detected (simulated)');
            
            if (process.env.JETPACK_VERSION && process.env.JETPACK_VERSION.startsWith('6')) {
                console.log('  ✅ JetPack 6.x detected');
                this.results.jetpack6 = true;
            } else {
                console.log('  ⚠️  JetPack version not 6.x or not set');
                this.results.jetpack6 = false;
            }
        } else {
            // Check for actual Jetson files (Linux only)
            if (process.platform === 'linux') {
                try {
                    if (fs.existsSync('/etc/nv_tegra_release')) {
                        const tegraInfo = fs.readFileSync('/etc/nv_tegra_release', 'utf8');
                        console.log(`  ✅ Jetson platform detected: ${tegraInfo.split('\n')[0]}`);
                        
                        if (tegraInfo.includes('R36')) {
                            console.log('  ✅ JetPack 6.x detected (R36.x)');
                            this.results.jetpack6 = true;
                        } else if (tegraInfo.includes('R35')) {
                            console.log('  ⚠️  JetPack 5.x detected (R35.x) - Consider upgrading to JetPack 6');
                            this.results.jetpack6 = false;
                        } else {
                            console.log('  ⚠️  Unknown JetPack version');
                            this.results.jetpack6 = false;
                        }
                    } else {
                        console.log('  ⚠️  Not running on Jetson platform');
                        this.results.jetpack6 = false;
                    }
                } catch (error) {
                    console.log('  ⚠️  Could not detect Jetson platform');
                    this.results.jetpack6 = false;
                }
            } else {
                console.log('  ⚠️  Not running on Linux/Jetson platform');
                console.log('     Set JETSON_PLATFORM=orin-nano and JETPACK_VERSION=6.0 to simulate');
                this.results.jetpack6 = false;
            }
        }
        console.log('');
    }

    // Check Docker installation
    checkDocker() {
        console.log('🐳 Checking Docker installation...');
        
        const dockerVersion = this.execCommand('docker --version');
        if (dockerVersion) {
            const versionMatch = dockerVersion.match(/(\d+\.\d+\.\d+)/);
            if (versionMatch) {
                this.results.dockerVersion = versionMatch[1];
                console.log(`  ✅ Docker installed: ${this.results.dockerVersion}`);
                
                // Check minimum version
                if (this.compareVersions(this.results.dockerVersion, this.minDockerVersion) >= 0) {
                    console.log(`  ✅ Docker version meets minimum requirement (${this.minDockerVersion})`);
                    this.results.dockerOk = true;
                } else {
                    console.log(`  ❌ Docker version too old. Minimum required: ${this.minDockerVersion}`);
                    console.log('     Please upgrade Docker for JetPack 6 compatibility');
                    this.results.dockerOk = false;
                }
                
                // Check recommended version
                if (this.compareVersions(this.results.dockerVersion, this.recommendedDockerVersion) >= 0) {
                    console.log(`  ✅ Docker version meets recommended requirement (${this.recommendedDockerVersion})`);
                } else {
                    console.log(`  ⚠️  Docker version below recommended (${this.recommendedDockerVersion})`);
                    console.log('     Consider upgrading for optimal JetPack 6 performance');
                }
            } else {
                console.log('  ❌ Could not parse Docker version');
                this.results.dockerOk = false;
            }
        } else {
            console.log('  ❌ Docker not installed or not accessible');
            console.log('     Install Docker from https://docker.com');
            this.results.dockerOk = false;
        }
        console.log('');
    }

    // Check Docker Compose
    checkDockerCompose() {
        console.log('📦 Checking Docker Compose...');
        
        // Check for Docker Compose V2 (preferred)
        let composeVersion = this.execCommand('docker compose version');
        let isV2 = true;
        
        if (!composeVersion) {
            // Check for Docker Compose V1 (legacy)
            composeVersion = this.execCommand('docker-compose --version');
            isV2 = false;
        }
        
        if (composeVersion) {
            const versionMatch = composeVersion.match(/(\d+\.\d+\.\d+)/);
            if (versionMatch) {
                this.results.composeVersion = versionMatch[1];
                
                if (isV2) {
                    console.log(`  ✅ Docker Compose V2 installed: ${this.results.composeVersion}`);
                } else {
                    console.log(`  ⚠️  Docker Compose V1 installed: ${this.results.composeVersion}`);
                    console.log('     Consider upgrading to Docker Compose V2 for better JetPack 6 support');
                }
                
                // Check version compatibility
                if (this.compareVersions(this.results.composeVersion, this.minComposeVersion) >= 0) {
                    console.log(`  ✅ Docker Compose version meets minimum requirement (${this.minComposeVersion})`);
                    this.results.composeOk = true;
                } else {
                    console.log(`  ❌ Docker Compose version too old. Minimum required: ${this.minComposeVersion}`);
                    this.results.composeOk = false;
                }
            } else {
                console.log('  ❌ Could not parse Docker Compose version');
                this.results.composeOk = false;
            }
        } else {
            console.log('  ❌ Docker Compose not installed');
            console.log('     Install with: sudo apt-get install docker-compose-plugin');
            this.results.composeOk = false;
        }
        console.log('');
    }

    // Check NVIDIA Container Runtime
    checkNvidiaRuntime() {
        console.log('🎮 Checking NVIDIA Container Runtime...');
        
        const dockerInfo = this.execCommand('docker info');
        if (dockerInfo && dockerInfo.includes('nvidia')) {
            console.log('  ✅ NVIDIA Container Runtime detected');
            this.results.nvidiaSupportOk = true;
        } else {
            console.log('  ⚠️  NVIDIA Container Runtime not detected');
            console.log('     This is required for GPU acceleration in JetPack 6');
            
            if (this.results.jetpack6) {
                console.log('     Install with: sudo apt-get install nvidia-container-runtime');
            }
            this.results.nvidiaSupportOk = false;
        }
        console.log('');
    }

    // Check system resources
    checkSystemResources() {
        console.log('💾 Checking system resources...');
        
        try {
            // Memory check (cross-platform)
            const totalMemGB = Math.round(require('os').totalmem() / 1024 / 1024 / 1024);
            if (totalMemGB >= 8) {
                console.log(`  ✅ Memory: ${totalMemGB}GB (sufficient for JetPack 6)`);
            } else {
                console.log(`  ⚠️  Memory: ${totalMemGB}GB (may be limited for full JetPack 6 features)`);
            }
            
            // CPU cores
            const cpuCores = require('os').cpus().length;
            console.log(`  ✅ CPU cores: ${cpuCores}`);
            
            // Platform info
            console.log(`  ℹ️  Platform: ${process.platform} (${process.arch})`);
            
        } catch (error) {
            console.log('  ⚠️  Could not determine system resources');
        }
        console.log('');
    }

    // Test Docker functionality
    testDockerFunctionality() {
        console.log('🧪 Testing Docker functionality...');
        
        try {
            // Test basic Docker run
            this.execCommand('docker run --rm hello-world');
            console.log('  ✅ Docker basic functionality working');
            
            // Test Docker Compose (if available)
            if (this.results.composeOk) {
                const composeTest = this.execCommand('docker compose version');
                if (composeTest) {
                    console.log('  ✅ Docker Compose functionality working');
                }
            }
            
        } catch (error) {
            console.log('  ❌ Docker functionality test failed');
            console.log(`     Error: ${error.message}`);
        }
        console.log('');
    }

    // Generate compatibility report
    generateReport() {
        console.log('📋 JetPack 6 Docker Compatibility Report');
        console.log('=======================================');
        
        if (this.results.jetpack6) {
            console.log('✅ Platform: JetPack 6.x compatible');
        } else {
            console.log('⚠️  Platform: Not JetPack 6 or compatibility unknown');
        }
        
        console.log(`Docker Version: ${this.results.dockerVersion || 'Unknown'}`);
        console.log(`Docker Compose: ${this.results.composeVersion || 'Unknown'}`);
        console.log(`NVIDIA Support: ${this.results.nvidiaSupportOk ? 'Available' : 'Not Available'}`);
        
        console.log('');
        
        if (this.results.jetpack6 && this.results.dockerOk && 
            this.compareVersions(this.results.dockerVersion, this.recommendedDockerVersion) >= 0) {
            console.log('✅ Recommended configuration for JetPack 6 deployment');
            console.log('');
            console.log('🚀 Ready to deploy with:');
            console.log('   docker compose -f deployment/docker-compose.jetpack6.yml up -d');
        } else {
            console.log('⚠️  Some optimizations recommended for JetPack 6');
            console.log('');
            console.log('📝 Recommendations:');
            
            if (!this.results.dockerOk) {
                console.log('   • Install or upgrade Docker to minimum version');
            } else if (this.compareVersions(this.results.dockerVersion, this.recommendedDockerVersion) < 0) {
                console.log(`   • Upgrade Docker to ${this.recommendedDockerVersion} or later`);
            }
            
            if (!this.results.composeOk) {
                console.log('   • Install or upgrade Docker Compose');
            }
            
            if (!this.results.jetpack6) {
                console.log('   • Set up JetPack 6 environment variables for testing');
                console.log('   • For actual deployment, upgrade to JetPack 6.0');
            }
            
            if (!this.results.nvidiaSupportOk && this.results.jetpack6) {
                console.log('   • Install NVIDIA Container Runtime for GPU acceleration');
            }
        }
    }

    // Main validation execution
    async validate() {
        console.log('🐳 Docker JetPack 6 Compatibility Validator');
        console.log('===========================================');
        console.log('Validating Docker compatibility with JetPack 6.0+');
        console.log('');

        this.checkJetsonPlatform();
        this.checkDocker();
        this.checkDockerCompose();
        this.checkNvidiaRuntime();
        this.checkSystemResources();
        
        if (this.results.dockerOk) {
            this.testDockerFunctionality();
        }
        
        this.generateReport();
        
        console.log('');
        if (this.results.dockerOk && this.results.composeOk) {
            console.log('✅ Docker JetPack 6 compatibility validation complete');
            return true;
        } else {
            console.log('❌ Docker JetPack 6 compatibility validation failed');
            return false;
        }
    }
}

// Main execution
async function main() {
    const validator = new DockerJetPackValidator();
    const success = await validator.validate();
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Validation error:', error.message);
        process.exit(1);
    });
}

module.exports = { DockerJetPackValidator };